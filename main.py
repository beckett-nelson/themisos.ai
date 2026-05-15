from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
import tempfile, os, anthropic, base64, json, time, random
from io import BytesIO
from pipeline import process_policy

app = FastAPI()

app.add_middleware(CORSMiddleware, allow_origins=["*"],
                   allow_methods=["*"], allow_headers=["*"])


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def extract_pdf_text(pdf_bytes: bytes) -> str:
    """Extract plain text from PDF bytes using pdfplumber. Never hits the 100-page limit."""
    import pdfplumber
    pages = []
    with pdfplumber.open(BytesIO(pdf_bytes)) as pdf:
        for i, page in enumerate(pdf.pages, start=1):
            text = page.extract_text() or ""
            if text.strip():
                pages.append(f"[Page {i}]\n{text.strip()}")
    return "\n\n".join(pages)


def extract_file_text(file_bytes: bytes, filename: str) -> str:
    """Route to the right extractor based on file extension."""
    name = filename.lower()
    if name.endswith(".pdf"):
        return extract_pdf_text(file_bytes)
    elif name.endswith(".txt"):
        return file_bytes.decode("utf-8", errors="replace")
    elif name.endswith((".docx", ".doc")):
        try:
            import docx
            doc = docx.Document(BytesIO(file_bytes))
            return "\n".join(p.text for p in doc.paragraphs if p.text.strip())
        except ImportError:
            return file_bytes.decode("utf-8", errors="replace")
    return file_bytes.decode("utf-8", errors="replace")


MAX_CHARS = 60_000   # ~15k tokens per doc — safe under 30k TPM

def truncate(text: str, max_chars: int = MAX_CHARS) -> str:
    if len(text) <= max_chars:
        return text
    return text[:max_chars] + f"\n\n[... truncated at {max_chars} chars ...]"


def call_with_retry(client, **kwargs) -> str:
    """Call client.messages.create with exponential backoff on 429."""
    delay = 5
    for attempt in range(5):
        try:
            response = client.messages.create(**kwargs)
            return response.content[0].text
        except anthropic.RateLimitError:
            if attempt == 4:
                raise
            jitter = random.uniform(0, delay * 0.3)
            time.sleep(delay + jitter)
            delay = min(delay * 2, 120)


def safe_parse(raw: str) -> dict:
    """Strip markdown fences and parse JSON. Returns error dict on failure."""
    clean = raw.strip()
    if clean.startswith("```"):
        start = clean.find("{")
        end   = clean.rfind("}") + 1
        if start != -1 and end > 0:
            clean = clean[start:end]
    try:
        return json.loads(clean)
    except json.JSONDecodeError as e:
        return {
            "error": f"JSON parse error: {e}",
            "verdict": "unclear",
            "summary": "Analysis completed but response could not be parsed. Raw output below.",
            "raw": raw[:2000],
            "key_findings": [],
            "coverage_items": [],
            "conflicts": []
        }


# ─────────────────────────────────────────────────────────────────────────────
# Routes
# ─────────────────────────────────────────────────────────────────────────────

@app.post("/analyze")
async def analyze(file: UploadFile):
    with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
        tmp.write(await file.read())
        tmp_path = tmp.name
    try:
        result = process_policy(tmp_path)
        return result
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e), "type": type(e).__name__})
    finally:
        os.unlink(tmp_path)


@app.post("/cross-examine")
async def cross_examine(
    policy: UploadFile = File(...),
    case_file: UploadFile = File(...),
    context: str = Form(default="")
):
    try:
        policy_bytes    = await policy.read()
        case_bytes      = await case_file.read()

        # Extract text — avoids 100-page PDF limit entirely
        policy_text = extract_file_text(policy_bytes, policy.filename or "policy.pdf")
        case_text   = extract_file_text(case_bytes,   case_file.filename or "case.pdf")

        if not policy_text.strip():
            return JSONResponse(status_code=400, content={
                "error": "Could not extract text from policy. Is it a scanned PDF with no text layer?"
            })
        if not case_text.strip():
            return JSONResponse(status_code=400, content={
                "error": "Could not extract text from case file. Is it a scanned PDF with no text layer?"
            })

        # Truncate to stay well under rate limits
        policy_text = truncate(policy_text)
        case_text   = truncate(case_text)

        client = anthropic.Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY"))

        prompt = f"""Cross-examine these two insurance documents and return a JSON analysis.
{f'Additional context: {context}' if context else ''}

INSURANCE POLICY:
<policy>
{policy_text}
</policy>

CASE FILE:
<case_file>
{case_text}
</case_file>

Return ONLY valid JSON — no markdown fences, no commentary. Use this exact schema:
{{
  "verdict": "covered | not_covered | partial | unclear",
  "coverage_limit": "string or null",
  "deductible": "string or null",
  "summary": "2-3 sentence overview",
  "key_findings": [
    {{"type": "success|warning|danger|info", "title": "short title", "detail": "explanation"}}
  ],
  "coverage_items": [
    {{"item": "coverage area", "status": "covered|excluded|partial|unclear", "note": "reasoning"}}
  ],
  "conflicts": [
    {{"type": "gap|conflict|exclusion|ambiguity", "title": "short title", "detail": "explanation"}}
  ],
  "recommendation": "one clear actionable next step"
}}"""

        raw = call_with_retry(
            client,
            model="claude-sonnet-4-5",
            max_tokens=4096,          # was 2000 — caused truncated JSON
            system="You are an expert insurance claims analyst. Return only valid JSON, never markdown.",
            messages=[{"role": "user", "content": prompt}]
        )

        return safe_parse(raw)

    except anthropic.RateLimitError as e:
        return JSONResponse(status_code=429, content={
            "error": "Rate limit exceeded after retries. Wait 60 seconds and try again."
        })
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e), "type": type(e).__name__})


app.mount("/", StaticFiles(directory=".", html=True), name="static")