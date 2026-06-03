from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
import tempfile, os, anthropic, json, time, random
from io import BytesIO

app = FastAPI()

app.add_middleware(CORSMiddleware, allow_origins=["*"],
                   allow_methods=["*"], allow_headers=["*"])


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def extract_pdf_text(pdf_bytes: bytes) -> str:
    import pdfplumber
    pages = []
    with pdfplumber.open(BytesIO(pdf_bytes)) as pdf:
        for i, page in enumerate(pdf.pages, start=1):
            text = page.extract_text() or ""
            if text.strip():
                pages.append(f"[Page {i}]\n{text.strip()}")
    return "\n\n".join(pages)


def extract_file_text(file_bytes: bytes, filename: str) -> str:
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


MAX_CHARS = 60_000

def truncate(text: str, max_chars: int = MAX_CHARS) -> str:
    if len(text) <= max_chars:
        return text
    return text[:max_chars] + f"\n\n[... truncated at {max_chars} chars ...]"


def chunk_text(text: str, max_chars: int = MAX_CHARS) -> list:
    if len(text) <= max_chars:
        return [text]
    chunks = []
    parts = text.split("\n\n[Page ")
    current = ""
    for i, part in enumerate(parts):
        segment = ("\n\n[Page " + part) if i > 0 else part
        if len(current) + len(segment) > max_chars and current:
            chunks.append(current.strip())
            current = segment
        else:
            current += segment
    if current.strip():
        chunks.append(current.strip())
    return chunks


def call_with_retry(client, **kwargs) -> str:
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
            "summary": "Analysis completed but response could not be parsed.",
            "raw": raw[:2000],
            "key_findings": [], "coverage_items": [], "conflicts": [],
            "attorney_flags": [], "recovery_opportunities": [],
            "all_exclusions": [], "all_endorsements": [], "coverage_gaps": [],
            "reconciled_limits": {}
        }


# ─────────────────────────────────────────────────────────────────────────────
# Prompts
# ─────────────────────────────────────────────────────────────────────────────

ANALYSIS_SYSTEM = """You are ThemisOS, an expert insurance coverage attorney specializing in 
plaintiff-side tort and insurance recovery litigation. You analyze insurance policies against 
case files to maximize financial recovery.

CRITICAL CITATION REQUIREMENT: Every finding, coverage item, and conflict MUST include:
- document: "policy" | "case_file" | "both"
- page_ref: exact page number(s) from [Page N] markers, e.g. "p. 12" or "pp. 4-5"
- clause: specific section, clause, or exhibit identifier

Always respond with valid JSON only. No prose, no markdown fences."""


def build_prompt(policy_chunk: str, case_chunk: str, context: str, is_partial: bool = False) -> str:
    partial_note = "NOTE: These are excerpts from larger documents. Extract what you can." if is_partial else ""
    return f"""Analyze this insurance policy against this case file for maximum plaintiff recovery.
{partial_note}
{f'Additional context: {context}' if context else ''}

INSURANCE POLICY:
<policy>
{policy_chunk}
</policy>

CASE FILE:
<case_file>
{case_chunk}
</case_file>

Return ONLY this JSON schema — no markdown, no commentary:
{{
  "verdict": "covered | not_covered | partial | unclear",
  "summary": "2-3 sentence plain English verdict summary",
  "coverage_limit": "e.g. $1,000,000 or null",
  "deductible": "e.g. $10,000 or null",
  "reconciled_limits": {{
    "each_occurrence": {{"value": 0, "page": null}},
    "general_aggregate": {{"value": 0, "page": null}},
    "products_completed_ops_aggregate": {{"value": 0, "page": null}},
    "personal_advertising_injury": {{"value": 0, "page": null}},
    "attachment_point": {{"value": 0, "page": null}},
    "self_insured_retention": {{"value": 0, "page": null}},
    "maximum_available": 0
  }},
  "attorney_flags": [
    {{
      "priority": "urgent | review | informational",
      "issue": "clear description of the issue",
      "pages": ["p. 3", "p. 7"]
    }}
  ],
  "recovery_opportunities": [
    {{
      "theory": "legal theory or coverage argument — always populate this if any dollar amount appears in the case file",
      "estimated_exposure": "exact dollar amount as integer string e.g. 250000 — required, never null, never 0 unless truly zero",
      "confidence": "high | medium | low"
    }}
  ],
  "key_findings": [
    {{
      "type": "success | danger | warning | info | neutral",
      "title": "short title",
      "detail": "1-2 sentence explanation",
      "document": "policy | case_file | both",
      "page_ref": "p. 12",
      "clause": "Section 3.2(b)"
    }}
  ],
  "coverage_items": [
    {{
      "item": "coverage area name",
      "status": "covered | excluded | partial | unclear",
      "note": "brief explanation",
      "document": "policy | case_file | both",
      "page_ref": "p. 7",
      "clause": "Section or clause identifier"
    }}
  ],
  "all_exclusions": [
    {{
      "name": "exclusion name",
      "key_language": "verbatim or near-verbatim key language",
      "page": "p. X",
      "endorsement_number": null
    }}
  ],
  "all_endorsements": [
    {{
      "number": "endorsement number",
      "title": "endorsement title",
      "effect": "broadening | restricting | clarifying",
      "summary": "what it does"
    }}
  ],
  "coverage_gaps": [
    {{
      "description": "gap description",
      "severity": "high | medium | low",
      "recovery_implication": "what this means for recovery"
    }}
  ],
  "conflicts": [
    {{
      "type": "gap | conflict | exclusion | ambiguity",
      "title": "short title",
      "detail": "explanation",
      "policy_ref": {{"page_ref": "p. 3", "clause": "Section 1.4"}},
      "case_ref": {{"page_ref": "p. 18", "clause": "Incident Report §2"}}
    }}
  ],
  "recommendation": "1-2 sentence attorney recommendation"
}}"""


MERGE_SYSTEM = """You are ThemisOS, an expert insurance coverage attorney.
Merge partial analyses into one final authoritative verdict.
Preserve all citation fields exactly. Respond with valid JSON only."""


def build_merge_prompt(partials: list, context: str) -> str:
    return f"""Merge these partial insurance coverage analyses into one final verdict.
Preserve all citation fields (page_ref, document, clause, policy_ref, case_ref).
{f'Context: {context}' if context else ''}

Partial analyses:
{json.dumps(partials, indent=2)}

Return a single merged JSON using the same full schema as the partial analyses.
Rules:
- If any partial says not_covered for the core claim, lean toward not_covered or partial
- Deduplicate similar findings but preserve all unique citations
- Combine all attorney_flags, recovery_opportunities, exclusions, endorsements, gaps
- Synthesize a coherent summary and recommendation"""


# ─────────────────────────────────────────────────────────────────────────────
# Core analysis logic
# ─────────────────────────────────────────────────────────────────────────────

def run_cross_examine(policy_text: str, case_text: str, context: str, client) -> dict:
    combined_len = len(policy_text) + len(case_text)

    if combined_len <= MAX_CHARS:
        raw = call_with_retry(
            client,
            model="claude-sonnet-4-5",
            max_tokens=4096,
            system=ANALYSIS_SYSTEM,
            messages=[{"role": "user", "content": build_prompt(policy_text, case_text, context)}]
        )
        return safe_parse(raw)

    policy_chunks = chunk_text(policy_text, MAX_CHARS // 2)
    case_chunks   = chunk_text(case_text,   MAX_CHARS // 2)

    partials = []
    first_case = case_chunks[0]
    for i, policy_chunk in enumerate(policy_chunks):
        raw = call_with_retry(
            client,
            model="claude-sonnet-4-5",
            max_tokens=3000,
            system=ANALYSIS_SYSTEM,
            messages=[{"role": "user", "content": build_prompt(policy_chunk, first_case, context, is_partial=True)}]
        )
        partials.append(safe_parse(raw))
        if i < len(policy_chunks) - 1:
            time.sleep(2)

    if len(case_chunks) > 1:
        first_policy = policy_chunks[0]
        for i, case_chunk in enumerate(case_chunks[1:], start=2):
            raw = call_with_retry(
                client,
                model="claude-sonnet-4-5",
                max_tokens=3000,
                system=ANALYSIS_SYSTEM,
                messages=[{"role": "user", "content": build_prompt(first_policy, case_chunk, context, is_partial=True)}]
            )
            partials.append(safe_parse(raw))
            time.sleep(2)

    raw = call_with_retry(
        client,
        model="claude-sonnet-4-5",
        max_tokens=4096,
        system=MERGE_SYSTEM,
        messages=[{"role": "user", "content": build_merge_prompt(partials, context)}]
    )
    return safe_parse(raw)


# ─────────────────────────────────────────────────────────────────────────────
# Routes
# ─────────────────────────────────────────────────────────────────────────────

@app.post("/cross-examine")
async def cross_examine(
    policy: UploadFile = File(...),
    case_file: UploadFile = File(...),
    context: str = Form(default="")
):
    try:
        policy_bytes = await policy.read()
        case_bytes   = await case_file.read()

        policy_text = extract_file_text(policy_bytes, policy.filename or "policy.pdf")
        case_text   = extract_file_text(case_bytes,   case_file.filename or "case.pdf")

        if not policy_text.strip():
            return JSONResponse(status_code=400, content={"error": "Could not extract text from policy."})
        if not case_text.strip():
            return JSONResponse(status_code=400, content={"error": "Could not extract text from case file."})

        ai_client = anthropic.Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY"))
        result = run_cross_examine(policy_text, case_text, context.strip(), ai_client)
        return JSONResponse(content=result)

    except anthropic.RateLimitError:
        return JSONResponse(status_code=429, content={"error": "Rate limit exceeded. Wait 60 seconds and try again."})
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e), "type": type(e).__name__})


@app.get("/health")
async def health():
    return {"status": "ok", "api_key_set": bool(os.environ.get("ANTHROPIC_API_KEY"))}


app.mount("/", StaticFiles(directory=".", html=True), name="static")
