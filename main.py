from fastapi import FastAPI, UploadFile, File, Form, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
from pydantic import BaseModel
import tempfile, os, anthropic, json, time, random
import httpx
from io import BytesIO

app = FastAPI()

app.add_middleware(CORSMiddleware, allow_origins=["*"],
                   allow_methods=["*"], allow_headers=["*"])

# v2.1
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


MAX_CHARS = 250_000

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
    kwargs.setdefault("temperature", 0)
    delay = 5
    retryable = (
        anthropic.RateLimitError,        # 429 rate limit
        anthropic.InternalServerError,   # 5xx, including 529 overloaded
        anthropic.APIConnectionError,    # network blip
        anthropic.APITimeoutError,       # request timed out
    )
    last_err = None
    for attempt in range(5):
        try:
            response = client.messages.create(**kwargs)
            return response.content[0].text
        except retryable as e:
            last_err = e
            if attempt == 4:
                raise
            jitter = random.uniform(0, delay * 0.3)
            time.sleep(delay + jitter)
            delay = min(delay * 2, 120)
    if last_err:
        raise last_err
    raise RuntimeError("call_with_retry exhausted without a response")


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


async def send_notification_email(case_name: str, user_email: str, firm_name: str, analyses_run: int):
    sendgrid_key = os.environ.get("SENDGRID_API_KEY")
    if not sendgrid_key:
        return

    is_first = analyses_run == 1
    subject = f"{'🎉 First analysis' if is_first else '📊 Analysis run'} — {firm_name or user_email}"

    html = f"""
    <div style="background:#f4f4f0;padding:32px 20px;font-family:Arial,sans-serif">
      <div style="max-width:480px;margin:0 auto;background:#0a0f1e;border-radius:8px;overflow:hidden">
        <div style="background:#05090F;padding:24px 32px;border-bottom:1px solid #1A2E4A;text-align:center">
          <div style="font-size:20px;font-weight:600;color:#fff;font-family:Georgia,serif">
            Themis<span style="color:#C9962B">OS</span>
          </div>
        </div>
        <div style="padding:32px">
          <div style="font-size:11px;letter-spacing:0.15em;text-transform:uppercase;color:#C9962B;margin-bottom:12px">
            {'First analysis alert' if is_first else 'Analysis notification'}
          </div>
          <h2 style="font-size:22px;font-weight:400;color:#fff;margin:0 0 20px;font-family:Georgia,serif">
            {'A client just ran their <em style="color:#C9962B">first analysis</em>' if is_first else 'A client ran an <em style="color:#C9962B">analysis</em>'}
          </h2>
          <div style="background:#111827;border:1px solid #1A2E4A;border-radius:4px;padding:16px 20px;margin-bottom:24px">
            <table style="width:100%;font-size:13px;font-family:Arial,sans-serif">
              <tr><td style="color:#6E7D94;padding:4px 0">Client</td><td style="color:#EDE6D0;text-align:right">{user_email}</td></tr>
              <tr><td style="color:#6E7D94;padding:4px 0">Firm</td><td style="color:#EDE6D0;text-align:right">{firm_name or '—'}</td></tr>
              <tr><td style="color:#6E7D94;padding:4px 0">Case</td><td style="color:#EDE6D0;text-align:right">{case_name}</td></tr>
              <tr><td style="color:#6E7D94;padding:4px 0">Total analyses</td><td style="color:#C9962B;text-align:right;font-weight:600">{analyses_run}</td></tr>
            </table>
          </div>
          <div style="text-align:center">
            <a href="https://platform.themisos.ai/admin/clients" style="display:inline-block;background:#C9962B;color:#05090F;padding:12px 28px;border-radius:2px;font-size:12px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;text-decoration:none">
              View Client Manager →
            </a>
          </div>
        </div>
      </div>
    </div>
    """

    async with httpx.AsyncClient() as client:
        await client.post(
            "https://api.sendgrid.com/v3/mail/send",
            headers={
                "Authorization": f"Bearer {sendgrid_key}",
                "Content-Type": "application/json"
            },
            json={
                "personalizations": [{"to": [{"email": "beckett@themisos.ai"}]}],
                "from": {"email": "noreply@themisos.ai", "name": "ThemisOS"},
                "subject": subject,
                "content": [{"type": "text/html", "value": html}]
            }
        )


async def track_analysis(case_id: str, case_name: str, user_email: str, firm_name: str):
    supabase_url = os.environ.get("SUPABASE_URL")
    service_role_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not supabase_url or not service_role_key:
        return

    headers = {
        "apikey": service_role_key,
        "Authorization": f"Bearer {service_role_key}",
        "Content-Type": "application/json",
        "Prefer": "return=representation"
    }

    async with httpx.AsyncClient() as client:
        res = await client.get(
            f"{supabase_url}/rest/v1/cases?id=eq.{case_id}&select=analyses_run",
            headers=headers
        )
        data = res.json()
        current = data[0].get("analyses_run", 0) if data else 0
        new_count = current + 1

        await client.patch(
            f"{supabase_url}/rest/v1/cases?id=eq.{case_id}",
            headers=headers,
            json={"analyses_run": new_count}
        )

    await send_notification_email(case_name, user_email, firm_name, new_count)


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

RECOVERY OPPORTUNITY RULES (critical for consistency and defensibility):
- Classify every recovery_opportunity as "computed" or "projected".
- COMPUTED = derived directly from dollar amounts documented in the case file or a coverage calculation. Its estimated_exposure MUST equal that math exactly (e.g. eligible expenses minus deductible, times coinsurance). These are your high-confidence figures.
- PROJECTED = contingent or future recovery not yet incurred. Bound it CONSERVATIVELY to the actual injuries, treatment, and prognosis described in the case file, using the low defensible end of a reasonable range.
- NEVER use the remaining policy limit, coverage headroom, or unused aggregate as a recovery figure. Unused limit is not recoverable until expense is actually incurred. Treating headroom as recovery is a critical error.
- Every estimated_exposure must be traceable to its "basis". If a number cannot be grounded in the documents, do not invent one.
- confidence: high = directly computed from documents; medium = supported but assumption-dependent; low = speculative.

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
      "theory": "legal theory or coverage argument supporting this recovery",
      "recovery_type": "computed | projected",
      "basis": "what the figure is derived from — cite the specific line items, coverage calculation, or policy provision. Never leave empty.",
      "estimated_exposure": "integer string. computed: the exact documented/calculated amount (e.g. 1840). projected: a conservative low-end figure bounded by the documented injuries and treatment — NEVER the remaining policy limit or unused coverage.",
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
            max_tokens=16000,
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
            max_tokens=4096,
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
                max_tokens=4096,
                system=ANALYSIS_SYSTEM,
                messages=[{"role": "user", "content": build_prompt(first_policy, case_chunk, context, is_partial=True)}]
            )
            partials.append(safe_parse(raw))
            time.sleep(2)

    raw = call_with_retry(
        client,
        model="claude-sonnet-4-5",
        max_tokens=16000,
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
    context: str = Form(default=""),
    case_id: str = Form(default=""),
    case_name: str = Form(default="Unknown Case"),
    user_email: str = Form(default=""),
    firm_name: str = Form(default=""),
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

        if case_id:
            try:
                await track_analysis(case_id, case_name, user_email, firm_name)
            except Exception:
                pass

        return JSONResponse(content=result)

    except anthropic.RateLimitError:
        return JSONResponse(status_code=429, content={"error": "Rate limit exceeded. Wait 60 seconds and try again."})
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e), "type": type(e).__name__})


# ─────────────────────────────────────────────────────────────────────────────
# Admin: clients endpoint
# ─────────────────────────────────────────────────────────────────────────────

@app.get("/admin/clients")
async def get_clients():
    supabase_url = os.environ.get("SUPABASE_URL")
    service_role_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

    if not supabase_url or not service_role_key:
        return JSONResponse(status_code=500, content={"error": "Supabase credentials not configured."})

    headers = {
        "apikey": service_role_key,
        "Authorization": f"Bearer {service_role_key}",
        "Content-Type": "application/json"
    }

    async with httpx.AsyncClient() as client:
        # Fetch all auth users (includes email + user_metadata with firm_name)
        users_res = await client.get(
            f"{supabase_url}/auth/v1/admin/users?per_page=1000",
            headers=headers
        )
        users_data = users_res.json()
        users = users_data.get("users", [])

        # Fetch all cases with user_id, analyses_run, created_at
        cases_res = await client.get(
            f"{supabase_url}/rest/v1/cases?select=user_id,analyses_run,created_at,name",
            headers=headers
        )
        cases = cases_res.json()

    # Build case stats per user
    user_stats: dict = {}
    for c in cases:
        uid = c.get("user_id")
        if not uid:
            continue
        if uid not in user_stats:
            user_stats[uid] = {"cases": 0, "analyses_run": 0, "last_active": None}
        user_stats[uid]["cases"] += 1
        user_stats[uid]["analyses_run"] += (c.get("analyses_run") or 0)
        created = c.get("created_at")
        if created and (not user_stats[uid]["last_active"] or created > user_stats[uid]["last_active"]):
            user_stats[uid]["last_active"] = created

    # Build response — one row per user
    result = []
    for u in users:
        uid = u.get("id")
        email = u.get("email", "")
        meta = u.get("user_metadata") or {}
        raw_meta = u.get("raw_user_meta_data") or {}
        firm_name = meta.get("firm_name") or raw_meta.get("firm_name") or ""
        full_name = meta.get("full_name") or raw_meta.get("full_name") or ""
        joined = u.get("created_at", "")
        stats = user_stats.get(uid, {"cases": 0, "analyses_run": 0, "last_active": None})

        result.append({
            "id": uid,
            "email": email,
            "firm_name": firm_name,
            "full_name": full_name,
            "joined": joined,
            "cases": stats["cases"],
            "analyses_run": stats["analyses_run"],
            "last_active": stats["last_active"],
        })

    # Sort by analyses_run desc
    result.sort(key=lambda x: x["analyses_run"], reverse=True)

    return JSONResponse(content={"clients": result})


# ─────────────────────────────────────────────────────────────────────────────
# Invite endpoint
# ─────────────────────────────────────────────────────────────────────────────

class InviteRequest(BaseModel):
    email: str
    firm_name: str

@app.post("/invite")
async def invite_client(req: InviteRequest):
    supabase_url = os.environ.get("SUPABASE_URL")
    service_role_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

    if not supabase_url or not service_role_key:
        return JSONResponse(status_code=500, content={"error": "Supabase credentials not configured."})

    headers = {
        "apikey": service_role_key,
        "Authorization": f"Bearer {service_role_key}",
        "Content-Type": "application/json"
    }

    payload = {
        "email": req.email,
        "data": {"firm_name": req.firm_name},
        "redirect_to": "https://platform.themisos.ai/auth/confirm"
    }

    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{supabase_url}/auth/v1/invite",
            headers=headers,
            json=payload
        )

    if response.status_code == 200:
        return JSONResponse(content={"success": True, "message": f"Invite sent to {req.email}"})
    else:
        return JSONResponse(
            status_code=response.status_code,
            content={"error": response.json()}
        )


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "api_key_set": bool(os.environ.get("ANTHROPIC_API_KEY")),
        "supabase_configured": bool(os.environ.get("SUPABASE_URL") and os.environ.get("SUPABASE_SERVICE_ROLE_KEY")),
        "sendgrid_configured": bool(os.environ.get("SENDGRID_API_KEY"))
    }


app.mount("/", StaticFiles(directory=".", html=True), name="static")