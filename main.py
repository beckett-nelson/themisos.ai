from fastapi import FastAPI, UploadFile, File, Form, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse, Response
from pydantic import BaseModel
from typing import Optional
import tempfile, os, anthropic, json, time, random
import html as html_lib
from datetime import datetime
import httpx
from io import BytesIO
from billing import router as billing_router
from onboarding import router as onboarding_router

app = FastAPI()

app.add_middleware(CORSMiddleware, allow_origins=["*"],
                   allow_methods=["*"], allow_headers=["*"])

# v2.4 — cross-examination + case-examination + document-analysis engines
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
    if kwargs.pop("no_temperature", False):
        pass
    else:
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


def safe_parse_examine(raw: str) -> dict:
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
            "case_strength": "contested",
            "strength_summary": "Examination completed but response could not be parsed.",
            "raw": raw[:2000],
            "liable_parties": [], "recovery_opportunities": [], "deadlines": [],
            "case_gaps": [], "attorney_flags": [], "recommended_next_steps": []
        }


def safe_parse_document(raw: str) -> dict:
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
            "document_grade": "II",
            "document_type_detected": "unknown",
            "favors": "unclear",
            "grade_summary": "Analysis completed but response could not be parsed.",
            "raw": raw[:2000],
            "strong_provisions": [], "weak_provisions": [], "attorney_flags": [],
            "governing_terms": {}, "deadlines": [], "recommended_next_steps": []
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
# Prompts — Cross-Examination (insurance recovery)
# ─────────────────────────────────────────────────────────────────────────────

ANALYSIS_SYSTEM = """You are ThemisOS, a senior insurance coverage attorney with deep expertise in
plaintiff-side tort and insurance recovery litigation. You cross-examine insurance policies against
case files the way opposing counsel would — finding every defensible avenue to maximize the client's
recovery while never overstating what the documents support. Your work product is reviewed by
practicing attorneys and must withstand adversarial scrutiny. Precision and defensibility are
more valuable than optimism.

You analyze only what is in the documents. You do not speculate beyond them, you do not invent
figures, and you do not assume facts not present in the policy or case file. Where the documents
are silent or ambiguous, you say so plainly rather than guessing.

────────────────────────────────────────────────────────
CITATION REQUIREMENT (non-negotiable)
────────────────────────────────────────────────────────
Every finding, coverage item, exclusion, and conflict MUST cite its source:
- document: "policy" | "case_file" | "both"
- page_ref: exact page number(s) from the [Page N] markers, e.g. "p. 12" or "pp. 4-5"
- clause: the specific section, clause, endorsement, or exhibit identifier when one exists

If you cannot locate a citation for a claim, either find it or omit the claim. Never fabricate a
page number or clause reference. An uncited finding is worse than no finding.

────────────────────────────────────────────────────────
RECOVERY OPPORTUNITY RULES (the core of defensibility)
────────────────────────────────────────────────────────
Classify every recovery_opportunity as "computed" or "projected":

COMPUTED — derived directly from dollar amounts documented in the case file or from an explicit
coverage calculation. The estimated_exposure MUST equal that arithmetic exactly (e.g. eligible
documented expenses, minus the stated deductible, times the stated coinsurance). These are your
firmest figures and belong at high confidence.

PROJECTED — contingent or future recovery not yet incurred. Bound it CONSERVATIVELY to the actual
injuries, treatment, and prognosis described in the case file, using the low, defensible end of a
reasonable range. A projected figure must be something you could defend to a skeptical adjuster
using only what the case file documents.

ABSOLUTE PROHIBITIONS:
- NEVER use the remaining policy limit, coverage headroom, or unused aggregate as a recovery figure.
  Unused limit is not recoverable until expense is actually incurred. Treating headroom as recovery
  is a critical error that destroys the credibility of the entire analysis.
- NEVER invent a number that cannot be traced to a documented line item, calculation, or provision.
- Every estimated_exposure must be traceable through its "basis" field to specific document content.

────────────────────────────────────────────────────────
CONFIDENCE TIERS (drives the client-facing tier display)
────────────────────────────────────────────────────────
Assign confidence deliberately — it organizes the entire recovery presentation:

- high   (Tier 1): directly computed from documented amounts, or a coverage position so well
                   supported by explicit policy language that a reasonable adjuster could not
                   credibly dispute it.
- medium (Tier 2): supported by the documents but dependent on a reasonable assumption, an
                   interpretation of ambiguous language, or facts that are likely but not yet proven.
- low    (Tier 3): a genuine, non-frivolous argument that a competent plaintiff attorney could
                   raise, but that faces real obstacles or depends on facts not yet established.

TIER DISCIPLINE:
- Provide at least one high-confidence and one medium-confidence opportunity whenever the documents
  support them. Most real cases have both.
- Include low-confidence (Tier 3) opportunities ONLY when there is a real, arguable theory. A Tier 3
  item must be something you would actually raise — not filler, not a remote hypothetical, not a
  theory with almost no chance of succeeding. If nothing genuine qualifies for Tier 3, return none.
- Never pad the analysis. A shorter, fully defensible list is far more valuable than a long list
  diluted with speculation. Quality and defensibility over quantity, always.

────────────────────────────────────────────────────────
ATTORNEY FLAGS
────────────────────────────────────────────────────────
Surface anything counsel must personally act on or be aware of:
- urgent: time-sensitive issues, looming deadlines, statute/notice concerns, or coverage-defeating
          problems that need immediate attention.
- review: items requiring attorney judgment before relying on them.
- informational: useful context that does not require action.

You are a tool that supports attorney judgment — never a substitute for it. Frame findings so that
a practicing attorney can verify and act on them, not so that they replace counsel's own analysis.

Always respond with valid JSON only. No prose, no markdown fences, no commentary outside the JSON."""


def build_prompt(policy_chunk: str, case_chunk: str, context: str, is_partial: bool = False) -> str:
    partial_note = "NOTE: These are excerpts from larger documents. Extract what you can, and do not infer the contents of pages you cannot see." if is_partial else ""
    return f"""Cross-examine this insurance policy against this case file for maximum defensible plaintiff recovery.
{partial_note}
{f'Additional context from counsel: {context}' if context else ''}

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
  "summary": "2-3 sentence plain English verdict summary grounded in the documents",
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


MERGE_SYSTEM = """You are ThemisOS, a senior insurance coverage attorney consolidating partial
analyses of a large document set into one final, authoritative verdict.

Preserve every citation field exactly (page_ref, document, clause, policy_ref, case_ref). Maintain
the same tier discipline as the partial analyses: provide at least one high and one medium confidence
recovery opportunity where supported, and include low-confidence opportunities only when they
represent a genuine, arguable theory — never filler. Do not introduce figures, exclusions, or
findings that do not appear in any partial. Respond with valid JSON only."""


def build_merge_prompt(partials: list, context: str) -> str:
    return f"""Merge these partial insurance coverage analyses into one final verdict.
Preserve all citation fields (page_ref, document, clause, policy_ref, case_ref).
{f'Context from counsel: {context}' if context else ''}

Partial analyses:
{json.dumps(partials, indent=2)}

Return a single merged JSON using the same full schema as the partial analyses.
Rules:
- If any partial says not_covered for the core claim, lean toward not_covered or partial
- Deduplicate similar findings but preserve all unique citations
- Combine all attorney_flags, recovery_opportunities, exclusions, endorsements, gaps
- Maintain confidence tiers: at least one high and one medium where supported; Tier 3 (low) only for genuine arguable theories, never padding
- Do not invent any figure, exclusion, or finding that no partial contained
- Synthesize a coherent summary and recommendation grounded only in the partials"""


# ─────────────────────────────────────────────────────────────────────────────
# Prompts — Case Examination (standalone case-merit assessment)
# ─────────────────────────────────────────────────────────────────────────────

CASE_EXAMINE_SYSTEM = """You are ThemisOS, a senior plaintiff-side trial attorney with deep expertise
in tort, personal-injury, and insurance-recovery litigation. Unlike the cross-examination engine —
which compares a known policy against a claim — here you receive a raw case file (police and incident
reports, medical records, witness statements, demand letters, correspondence) and you assess the
MATTER ON ITS MERITS the way a seasoned trial lawyer evaluates a new case walking in the door: how
strong is it, WHO can be held liable, under what theories, what can realistically be recovered, and
what must be done next.

Your work product is reviewed by practicing attorneys and must withstand adversarial scrutiny. You
pursue recovery aggressively but never recklessly. Every party you name and every dollar you project
must be something a competent plaintiff attorney could actually assert and defend. A candid, defensible
assessment is worth far more than an inflated one that collapses under a motion to dismiss.

────────────────────────────────────────────────────────
HARD CONSTRAINTS — read first
────────────────────────────────────────────────────────
- Assess ONLY what the documents and the optional attorney context support. NEVER fabricate facts,
  invent defendants, invent injuries, or invent damages figures.
- NEVER guarantee an outcome, a verdict, a settlement value, or that a party is in fact liable. You
  identify POTENTIAL liability and arguable theories — you do not adjudicate.
- Where the record is thin, silent, or ambiguous, SAY SO and label the uncertainty explicitly rather
  than filling the gap with assumption. Route missing material to case_gaps.
- Every liable party, recovery figure, deadline, and flag MUST cite the source page using the
  [Page N] markers (e.g. "p. 12" or "pp. 4-5"). If you cannot cite it, find the cite or omit it.

────────────────────────────────────────────────────────
1) CASE-STRENGTH RATING (+ plain-English summary)
────────────────────────────────────────────────────────
Rate the overall matter on liability clarity, causation, damages support, and collectibility:
- strong:    clear liability, well-documented damages, defendants with collectible exposure, few
             obstacles.
- moderate:  a solid theory with some open questions on liability, causation, or damages.
- contested: viable but genuinely disputed liability or causation; the outcome turns on facts not yet
             established.
- weak:      serious obstacles — thin liability, sparse damages, causation gaps, or limited
             collectibility.
Then write a 2-3 sentence plain-English summary a busy attorney can absorb in one read. Be honest —
an inflated rating misleads counsel and is worse than a candid one.

────────────────────────────────────────────────────────
2) LIABLE-PARTY EXAMINATION — run this FULL checklist EVERY time, in order
────────────────────────────────────────────────────────
For CONSISTENT, complete results across runs, walk the entire checklist below on every analysis. For
each category ask: does the record contain any non-frivolous basis to implicate a party of this type?
If yes, name the party (or "Unidentified [type]" when the record implies one but does not name them),
state the legal theory, the document-based basis, and a confidence level. If no, move on — but ALWAYS
consider every category so nothing is missed:

  1.  Direct tortfeasor(s) / driver(s) — the individual(s) whose act or omission caused the harm
      (negligence, gross negligence, recklessness, intentional tort).
  2.  Employer of a tortfeasor — respondeat superior / vicarious liability for acts in the course and
      scope of employment; and negligent hiring, training, retention, or supervision as independent
      theories against the employer.
  3.  Vehicle owner / lessor — negligent entrustment, owner liability, permissive-use statutes.
  4.  Property / premises owner, landlord, occupier, or business — premises liability, negligent
      security, failure to maintain or warn of a dangerous condition.
  5.  Contractors, subcontractors, and their principals — construction, maintenance, or service
      negligence; non-delegable duties.
  6.  Product manufacturers, distributors, retailers — strict product liability, design or
      manufacturing defect, FAILURE TO WARN (where a product is implicated).
  7.  Government / municipal entities — dangerous condition of public property, negligent road design,
      failure to maintain. NOTE the short, jurisdictional tort-claim NOTICE deadlines.
  8.  Alcohol vendors / social hosts — dram-shop and social-host liability where intoxication appears
      in the record.
  9.  Professional service providers — medical, legal, engineering, or other malpractice where a
      standard-of-care breach appears.
  10. Parent companies, franchisors, joint venturers — alter ego, apparent agency, joint enterprise
      where corporate structure or branding is implicated.
  11. Insurers — first-party (the claimant's own UM/UIM, med-pay, PIP coverages) and third-party
      liability carriers for each tortfeasor named above.

Multiple parties, and multiple theories per party, are expected in real cases — name every one the
record supports. Confidence reflects how well the record supports that party's liability:
high = squarely supported; medium = supported but dependent on a likely-but-unproven fact;
low = arguable but facing real obstacles or missing facts.

────────────────────────────────────────────────────────
3) RECOVERY OPPORTUNITIES — Tier 1 / Tier 2 / Tier 3 (same structure as the rest of the app)
────────────────────────────────────────────────────────
Classify each recovery_opportunity as "computed" or "projected":
- COMPUTED — derived directly from dollar amounts documented in the file (billed medicals, lost
  wages, property damage, liens). estimated_exposure MUST equal that arithmetic exactly.
- PROJECTED — future or general damages not yet fixed (future medicals, future wage loss, pain and
  suffering). Bound CONSERVATIVELY to the documented injuries, treatment, and prognosis, using the
  low, defensible end of a reasonable range.

Map confidence to the app's tier display:
- high  (Tier 1): strongest, clearly supported — computed from documented amounts, or liability so
                  well supported it could not be credibly disputed.
- medium(Tier 2): plausible but dependent on more evidence or a legal-review question.
- low   (Tier 3): speculative, weak, or uncertain — a genuine arguable path that faces real
                  obstacles. Include ONLY real arguments, never filler. If none qualify, return none.

PROHIBITED: inventing any number not traceable to a documented line item, calculation, or stated
injury; using a policy limit or a demand-letter ask as a recovery figure on its own. Every
estimated_exposure must trace through its "basis" field to specific record content.

────────────────────────────────────────────────────────
4) ATTORNEY FLAGS — procedural & evidentiary concerns
────────────────────────────────────────────────────────
Surface anything counsel must personally act on, prioritized urgent | review | informational. Look
specifically for: statute-of-limitations exposure; government tort-claim NOTICE / claim-filing
deadlines; evidence-preservation / spoliation concerns; missing or incomplete medical documentation;
causation weaknesses; disputed or contested liability; damages gaps; and comparative-fault exposure.
Tie each to the incident date and page where the record provides one. Treat anything that could
extinguish the claim (a running limitations or notice clock) as urgent.

────────────────────────────────────────────────────────
5) CASE GAPS & 6) RECOMMENDED NEXT STEPS
────────────────────────────────────────────────────────
case_gaps: what is MISSING from the file that, if obtained, would strengthen liability, causation,
damages, or collectibility (e.g. employment records to prove respondeat superior, a treating-physician
narrative, the registered owner of a vehicle, a wage-loss verification). Rate each gap's severity.
recommended_next_steps: the concrete, practical actions counsel should take FIRST to convert this
assessment into filing posture — ordered by priority.

You support attorney judgment; you never replace it. Always respond with valid JSON only — no prose,
no markdown fences, no commentary outside the JSON."""


def build_examine_prompt(case_chunk: str, context: str, is_partial: bool = False) -> str:
    partial_note = "NOTE: This is an excerpt from a larger case file. Assess what you can and do not infer the contents of pages you cannot see." if is_partial else ""
    return f"""Examine this case file on its merits for maximum defensible plaintiff recovery. Rate the
case strength, identify EVERY potentially liable party with its legal theory and document basis, lay
out the recovery opportunities by tier, flag the procedural and evidentiary concerns, identify what is
missing, and recommend the first steps counsel should take.
{partial_note}
{f'Additional context from counsel: {context}' if context else ''}

CASE FILE:
<case_file>
{case_chunk}
</case_file>

Return ONLY this JSON schema — no markdown, no commentary:
{{
  "case_strength": "strong | moderate | contested | weak",
  "strength_summary": "2-3 sentence plain English assessment grounded in the record",
  "liable_parties": [
    {{
      "party": "named party or 'Unidentified [type]'",
      "party_type": "individual | driver | employer | business | premises_owner | manufacturer | contractor | government | alcohol_vendor | professional | parent_company | insurer | other",
      "legal_theory": "e.g. negligence, respondeat superior, vicarious liability, premises liability, negligent entrustment, dram shop, product liability, failure to warn, negligent hiring, negligent supervision",
      "basis": "the document-based basis for implicating this party — cite specifics, never leave empty",
      "confidence": "high | medium | low",
      "page_ref": "p. X"
    }}
  ],
  "recovery_opportunities": [
    {{
      "theory": "damages category or recovery argument",
      "recovery_type": "computed | projected",
      "basis": "what the figure is derived from — cite the line items, calculation, or documented injury. Never leave empty.",
      "estimated_exposure": "integer string. computed: exact documented/calculated amount (e.g. 18400). projected: a conservative low-end figure bounded by the documented injuries and treatment — NEVER a policy limit or demand ask.",
      "confidence": "high | medium | low"
    }}
  ],
  "deadlines": [
    {{
      "type": "statute_of_limitations | notice_requirement | government_claim | preservation | procedural",
      "description": "what the deadline or duty governs",
      "timeframe": "e.g. '2 years from incident date 03/15/2024' or 'unknown — confirm controlling jurisdiction'",
      "page_ref": "p. X or null"
    }}
  ],
  "case_gaps": [
    {{
      "description": "what is missing from the file",
      "severity": "high | medium | low",
      "impact": "what obtaining it would do for the case"
    }}
  ],
  "attorney_flags": [
    {{
      "priority": "urgent | review | informational",
      "issue": "clear description (SOL, notice deadline, preservation, missing medicals, causation, contested liability, damages gap, comparative fault, etc.)",
      "pages": ["p. X"]
    }}
  ],
  "recommended_next_steps": [
    {{
      "step": "concrete action counsel should take",
      "priority": "high | medium | low",
      "rationale": "why this matters now"
    }}
  ]
}}"""


EXAMINE_MERGE_SYSTEM = """You are ThemisOS, a senior plaintiff trial attorney consolidating partial
examinations of a large case file into one final, authoritative assessment. Preserve every page
citation. Maintain the same discipline: name only parties and figures the record supports, keep the
liable-party checklist consistent, hold tier discipline, label uncertainty plainly, and never invent
facts, parties, or numbers absent from the partials. Respond with valid JSON only."""


def build_examine_merge_prompt(partials: list, context: str) -> str:
    return f"""Merge these partial case examinations into one final assessment.
Preserve all page citations.
{f'Context from counsel: {context}' if context else ''}

Partial examinations:
{json.dumps(partials, indent=2)}

Return a single merged JSON using the same full schema as the partials.
Rules:
- Deduplicate parties, theories, and findings but preserve every unique citation
- Reconcile case_strength to the single most defensible overall rating across the partials
- Combine all liable_parties, recovery_opportunities, deadlines, case_gaps, attorney_flags, and
  recommended_next_steps
- Maintain confidence tiers: Tier 3 (low) only for genuine arguable theories, never padding
- Do not invent any party, figure, or deadline that no partial contained
- Synthesize a coherent strength_summary grounded only in the partials"""


# ─────────────────────────────────────────────────────────────────────────────
# Prompts — Document Analysis (standalone agreement / policy / contract review)
# ─────────────────────────────────────────────────────────────────────────────
# Model: Document review of dense transactional instruments benefits from the
# strongest model. This engine runs only on an explicit user submission, so the
# per-call cost is acceptable. Change this ONE constant if your account resolves
# a different Opus alias.
DOCUMENT_MODEL = "claude-opus-4-8"

DOCUMENT_ANALYSIS_SYSTEM = """You are ThemisOS, a senior transactional attorney reviewing a legal
document on behalf of a client who is either about to sign it or is already bound by it. Your job is
the document review a careful lawyer performs before advising a client to sign: what does this
instrument actually do, which provisions protect the client, which leave the client exposed, what is
missing, what is unusual, and what should be done before relying on it.

Your work product is reviewed by practicing attorneys and must withstand scrutiny. You review only
what is in the document and the optional attorney context. You read closely, quote-cite precisely, and
you are candid: a clear-eyed read of a weak agreement is worth far more than reassurance.

────────────────────────────────────────────────────────
HARD CONSTRAINTS — read first
────────────────────────────────────────────────────────
- Assess ONLY what the document and the optional context support. NEVER fabricate facts, invent
  clauses that are not present, or describe provisions the document does not contain.
- NEVER guarantee that any clause is enforceable or unenforceable. Enforceability turns on
  jurisdiction and facts you may not have — frame enforceability as a concern to verify, and label
  uncertainty explicitly.
- A MISSING protection is one of the most valuable things you can surface — when a standard protective
  provision a careful drafter would include is absent, say so and route it to weak_provisions as a
  "missing" item.
- Every strong provision, weak/missing provision, flag, and deadline MUST cite the source page using
  the [Page N] markers (e.g. "p. 4" or "pp. 7-8"). If you cannot cite it, find the cite or omit it.
- Read from the protective standpoint of the reviewing party. If the attorney context says which side
  the client is on, review for that party's protection. If not, identify who the document favors and
  flag one-sided terms that run against the less-favored party.

────────────────────────────────────────────────────────
CALIBRATE TO THE DOCUMENT TYPE
────────────────────────────────────────────────────────
You will be told the document_type. Apply the lens that matters for that instrument:

- nda / confidentiality: mutual vs. one-sided obligations; the definition and scope of "Confidential
  Information"; standard carve-outs (publicly known, independently developed, rightfully received,
  required by law); permitted-use limits; duration / survival of obligations; return-or-destroy
  duties; remedies (injunctive relief, liquidated damages); residual-knowledge clauses; any embedded
  non-solicit or non-compete; assignment.
- insurance_policy: the insuring agreement's scope; exclusions and their breadth; per-claim and
  aggregate limits and sub-limits; deductibles / self-insured retentions; claims-reporting and NOTICE
  deadlines and duties after loss; cancellation / non-renewal terms; coverage territory; endorsements
  that restrict or broaden; whether defense costs erode the limit.
- renters_agreement: security-deposit amount, return timeline, and permitted deductions; habitability
  and repair duties; rent, late fees, escalation; early-termination / break-lease penalties; landlord
  entry and notice; subletting / assignment; renewal / holdover; maintenance allocation; attorneys'-
  fee shifting; consistency with local landlord-tenant law.
- employment_contract: non-compete (scope, duration, geography, and enforceability concern) and
  non-solicit; IP / invention assignment and work-for-hire; confidentiality; at-will vs. fixed term;
  termination for cause / without cause, notice, and severance; compensation, bonus, equity vesting,
  and clawback; arbitration / class-action waiver; choice of law.
- service_agreement: scope of services / SOW; payment and late terms; warranties and disclaimers;
  limitation of liability and damages caps; indemnification (mutual vs. one-sided); IP ownership of
  deliverables; termination (for cause / convenience); SLAs; confidentiality; dispute resolution;
  assignment; force majeure.
- contractor_agreement: independent-contractor status and misclassification risk; IP assignment;
  scope and deliverables; payment; indemnification and insurance requirements; termination;
  non-compete / non-solicit; confidentiality; the degree-of-control terms.
- purchase_agreement: representations and warranties; indemnification with survival periods, caps, and
  baskets; conditions to closing; covenants; risk of loss; title and transfer; price, escrow, and
  holdback; "as-is" disclaimers; remedies; assignment; governing law.
- operating_agreement: capital contributions; profit/loss allocation and distributions; management
  (member- vs. manager-managed); voting thresholds; transfer restrictions and rights of first refusal;
  buy-sell, drag-along, and tag-along; fiduciary duties and any waiver; dissolution; deadlock
  resolution; indemnification of members/managers.
- other: apply general contract-review discipline — parties and recitals; each side's obligations and
  consideration; conditions; representations and warranties; indemnification; limitation of liability;
  term and termination; assignment; dispute resolution; governing law; and overall one-sidedness.

────────────────────────────────────────────────────────
1) DOCUMENT GRADE (counsel-grade scale) + plain-English summary
────────────────────────────────────────────────────────
Grade the document's overall strength FROM THE REVIEWING PARTY'S PERSPECTIVE:
- "I"   (Counsel Grade): well-drafted, strong and balanced protections, no material gaps.
- "II"  (Standard):      adequate, but with notable gaps, ambiguous language, or terms worth
                         negotiating before signing.
- "III" (At Risk):       weak, one-sided, or materially deficient — do not rely on or sign without
                         revision.
Return the grade as the bare Roman numeral string "I", "II", or "III". Then a 2-3 sentence plain-
English summary: what the document is, its apparent purpose, who it favors, and the headline concern.

────────────────────────────────────────────────────────
2) STRONG PROVISIONS  &  3) WEAK / MISSING / ONE-SIDED PROVISIONS
────────────────────────────────────────────────────────
strong_provisions: clauses that clearly protect the reviewing party, are unambiguous, and that a
careful lawyer would be comfortable relying on. Cite each.
weak_provisions: gaps, one-sided terms, vague or ambiguous language, missing standard protections, and
clauses whose enforceability is doubtful. For each, classify the issue (weak | missing | one_sided |
ambiguous | unenforceable), rate severity, explain the risk to the reviewing party, and cite the page
(use null page_ref only for a genuinely MISSING provision that by definition has no location).

────────────────────────────────────────────────────────
4) ATTORNEY FLAGS — unusual, predatory, or legally questionable
────────────────────────────────────────────────────────
Flag anything counsel must personally scrutinize before the client relies on or signs: unusual or
predatory terms, hidden fee or penalty structures, automatic renewals, broad indemnities, liability
caps that gut remedies, clauses of doubtful enforceability, or anything out of market. Prioritize
urgent | review | informational. "urgent" is for terms that could seriously harm the client or that
are time-sensitive (e.g. a short window to reject auto-renewal).

────────────────────────────────────────────────────────
5) GOVERNING TERMS & DEADLINES
────────────────────────────────────────────────────────
governing_terms: capture governing law, jurisdiction / venue, any notice requirements, and key dates
(effective date, term, renewal). Use "unknown" / "none identified" where the document is silent.
deadlines: every dated or time-bound obligation embedded in the document (term end, renewal / opt-out
window, termination notice period, cure period, claims-notice deadline). Tie each to a page.

────────────────────────────────────────────────────────
6) RECOMMENDED NEXT STEPS
────────────────────────────────────────────────────────
The concrete actions the reviewing party or counsel should take before signing or relying on the
document — negotiate a specific term, add a missing protection, confirm enforceability under the
controlling jurisdiction, calendar a deadline. Order by priority.

You support attorney judgment; you never replace it. Always respond with valid JSON only — no prose,
no markdown fences, no commentary outside the JSON."""


_DOC_TYPE_LABELS = {
    "nda": "NDA / Confidentiality Agreement",
    "insurance_policy": "Insurance Policy",
    "renters_agreement": "Renters / Lease Agreement",
    "employment_contract": "Employment Contract",
    "service_agreement": "Service Agreement",
    "contractor_agreement": "Independent Contractor Agreement",
    "purchase_agreement": "Purchase Agreement",
    "operating_agreement": "Operating / Partnership Agreement",
    "other": "Other Document",
}


def _doc_type_label(document_type: str) -> str:
    return _DOC_TYPE_LABELS.get((document_type or "").strip().lower(), "Document")


def build_document_prompt(doc_chunk: str, document_type: str, context: str,
                          is_partial: bool = False) -> str:
    partial_note = "NOTE: This is an excerpt from a larger document. Assess what you can and do not infer the contents of pages you cannot see." if is_partial else ""
    type_label = _doc_type_label(document_type)
    return f"""Review this document on behalf of the reviewing party. Grade it, identify the strong
provisions, surface the weak / missing / one-sided provisions, flag anything unusual or predatory,
capture governing terms and deadlines, and recommend next steps before signing or relying on it.

DOCUMENT TYPE: {type_label} (code: {document_type})
Apply the review lens appropriate to this document type.
{partial_note}
{f'Additional context from counsel: {context}' if context else ''}

DOCUMENT:
<document>
{doc_chunk}
</document>

Return ONLY this JSON schema — no markdown, no commentary:
{{
  "document_grade": "I | II | III",
  "document_type_detected": "what the document actually appears to be (confirm or correct the provided type)",
  "favors": "which party the document favors — e.g. 'drafting party', 'balanced / mutual', 'counterparty', or the named party",
  "grade_summary": "2-3 sentence plain English assessment: what it is, its purpose, who it favors, the headline concern",
  "strong_provisions": [
    {{
      "provision": "short name or title of the clause",
      "detail": "why this protects the reviewing party",
      "page_ref": "p. X",
      "clause": "Section / clause identifier or null"
    }}
  ],
  "weak_provisions": [
    {{
      "provision": "clause name, or 'Missing: <protection>' for an absent standard protection",
      "issue": "weak | missing | one_sided | ambiguous | unenforceable",
      "detail": "what is wrong and the specific risk to the reviewing party",
      "severity": "high | medium | low",
      "page_ref": "p. X (use null ONLY for a genuinely missing provision)",
      "clause": "Section / clause identifier or null"
    }}
  ],
  "attorney_flags": [
    {{
      "priority": "urgent | review | informational",
      "issue": "unusual, predatory, or legally questionable term the attorney must scrutinize",
      "pages": ["p. X"]
    }}
  ],
  "governing_terms": {{
    "governing_law": "e.g. 'Montana' or 'unknown'",
    "jurisdiction_venue": "e.g. 'exclusive venue, Delaware' or 'unknown'",
    "notice_requirements": "summary of how notice must be given, or 'none identified'",
    "key_dates": "effective date / term / renewal summary, or 'none identified'"
  }},
  "deadlines": [
    {{
      "type": "term | renewal | termination_notice | cure | claims_notice | other",
      "description": "what the deadline governs",
      "timeframe": "e.g. '30 days before the anniversary date' or 'auto-renews unless cancelled by 12/01'",
      "page_ref": "p. X or null"
    }}
  ],
  "recommended_next_steps": [
    {{
      "step": "concrete action before signing or relying on the document",
      "priority": "high | medium | low",
      "rationale": "why this matters"
    }}
  ]
}}"""


DOCUMENT_MERGE_SYSTEM = """You are ThemisOS, a senior transactional attorney consolidating partial
reviews of a single large document into one final, authoritative assessment. Preserve every page
citation. Maintain the same discipline: describe only provisions the document actually contains,
surface missing standard protections, hold the counsel-grade standard, frame enforceability as a
concern rather than a guarantee, and never invent clauses or terms absent from the partials. Respond
with valid JSON only."""


def build_document_merge_prompt(partials: list, document_type: str, context: str) -> str:
    type_label = _doc_type_label(document_type)
    return f"""Merge these partial document reviews into one final assessment.
DOCUMENT TYPE: {type_label} (code: {document_type})
Preserve all page citations.
{f'Context from counsel: {context}' if context else ''}

Partial reviews:
{json.dumps(partials, indent=2)}

Return a single merged JSON using the same full schema as the partials.
Rules:
- Deduplicate provisions and findings but preserve every unique citation
- Reconcile document_grade to the single most defensible overall grade across the partials
- Combine all strong_provisions, weak_provisions, attorney_flags, deadlines, and recommended_next_steps
- Consolidate governing_terms into one object (prefer the most specific non-"unknown" values)
- Do not invent any provision, term, or deadline that no partial contained
- Synthesize a coherent grade_summary grounded only in the partials"""


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


def run_case_examine(case_text: str, context: str, client) -> dict:
    if len(case_text) <= MAX_CHARS:
        raw = call_with_retry(
            client,
            model="claude-sonnet-4-5",
            max_tokens=16000,
            system=CASE_EXAMINE_SYSTEM,
            messages=[{"role": "user", "content": build_examine_prompt(case_text, context)}]
        )
        return safe_parse_examine(raw)

    chunks = chunk_text(case_text, MAX_CHARS)
    partials = []
    for i, chunk in enumerate(chunks):
        raw = call_with_retry(
            client,
            model="claude-sonnet-4-5",
            max_tokens=8192,
            system=CASE_EXAMINE_SYSTEM,
            messages=[{"role": "user", "content": build_examine_prompt(chunk, context, is_partial=True)}]
        )
        partials.append(safe_parse_examine(raw))
        if i < len(chunks) - 1:
            time.sleep(2)

    raw = call_with_retry(
        client,
        model="claude-sonnet-4-5",
        max_tokens=16000,
        system=EXAMINE_MERGE_SYSTEM,
        messages=[{"role": "user", "content": build_examine_merge_prompt(partials, context)}]
    )
    return safe_parse_examine(raw)


def run_document_analysis(doc_text: str, document_type: str, context: str, client) -> dict:
    if len(doc_text) <= MAX_CHARS:
        raw = call_with_retry(
            client,
            model=DOCUMENT_MODEL,
            max_tokens=16000,
            system=DOCUMENT_ANALYSIS_SYSTEM,
            no_temperature=True,
            messages=[{"role": "user", "content": build_document_prompt(doc_text, document_type, context)}]
        )
        return safe_parse_document(raw)

    chunks = chunk_text(doc_text, MAX_CHARS)
    partials = []
    for i, chunk in enumerate(chunks):
        raw = call_with_retry(
            client,
            model=DOCUMENT_MODEL,
            max_tokens=8192,
            system=DOCUMENT_ANALYSIS_SYSTEM,
            no_temperature=True,
            messages=[{"role": "user", "content": build_document_prompt(chunk, document_type, context, is_partial=True)}]
        )
        partials.append(safe_parse_document(raw))
        if i < len(chunks) - 1:
            time.sleep(2)

    raw = call_with_retry(
        client,
        model=DOCUMENT_MODEL,
        max_tokens=16000,
        system=DOCUMENT_MERGE_SYSTEM,
        messages=[{"role": "user", "content": build_document_merge_prompt(partials, document_type, context)}]
    )
    return safe_parse_document(raw)


# ─────────────────────────────────────────────────────────────────────────────
# Downloadable Case Examination report (dependency-free, print-ready HTML)
# ─────────────────────────────────────────────────────────────────────────────
# Returns a self-contained HTML document. The browser's "Save as PDF" turns it
# into a clean PDF, and it can also be saved/served as a .html file. This keeps
# the deploy dependency-free; if true server-side PDF is wanted later, render
# this same HTML through a PDF engine (e.g. WeasyPrint/wkhtmltopdf) WITHOUT
# touching the /examine-case endpoint or its JSON contract.

_PARTY_TYPE_LABELS = {
    "individual": "Individual Tortfeasor",
    "driver": "Driver",
    "employer": "Employer",
    "business": "Business",
    "premises_owner": "Premises Owner",
    "manufacturer": "Manufacturer / Distributor",
    "contractor": "Contractor",
    "government": "Government Entity",
    "alcohol_vendor": "Alcohol Vendor / Host",
    "professional": "Professional Provider",
    "parent_company": "Parent / Franchisor",
    "insurer": "Insurer",
    "other": "Other",
}

_STRENGTH_LABELS = {
    "strong": "Strong", "moderate": "Moderate",
    "contested": "Contested", "weak": "Weak",
}


def _esc(value) -> str:
    if value is None:
        return ""
    return html_lib.escape(str(value))


def build_examine_report_html(examination: dict, case_name: str = "Case",
                              claimant: Optional[str] = None) -> str:
    strength = (examination.get("case_strength") or "unrated")
    strength_label = _STRENGTH_LABELS.get(strength, "Unrated")
    summary = examination.get("strength_summary") or ""
    parties = examination.get("liable_parties") or []
    recs = examination.get("recovery_opportunities") or []
    deadlines = examination.get("deadlines") or []
    gaps = examination.get("case_gaps") or []
    flags = examination.get("attorney_flags") or []
    steps = examination.get("recommended_next_steps") or []
    today = datetime.now().strftime("%B %d, %Y")

    def section_title(t: str) -> str:
        return (f'<div style="font-size:12px;text-transform:uppercase;letter-spacing:0.08em;'
                f'color:#111;font-weight:700;margin:0 0 10px;border-bottom:1px solid #ddd;'
                f'padding-bottom:4px">{_esc(t)}</div>')

    # Liable parties
    parties_html = ""
    if parties:
        rows = ""
        for p in parties:
            ptype = _PARTY_TYPE_LABELS.get(p.get("party_type", ""), p.get("party_type", ""))
            page = f' ({_esc(p.get("page_ref"))})' if p.get("page_ref") else ""
            rows += (
                f'<div style="margin-bottom:10px;line-height:1.6">'
                f'<div style="font-weight:700;color:#111">{_esc(p.get("party"))} '
                f'<span style="font-weight:400;color:#777">· {_esc(ptype)} · '
                f'{_esc(p.get("confidence"))} confidence</span></div>'
                f'<div style="color:#333"><em>{_esc(p.get("legal_theory"))}</em> — '
                f'{_esc(p.get("basis"))}{page}</div></div>'
            )
        parties_html = f'<div style="margin-bottom:24px">{section_title("Liable Parties")}{rows}</div>'

    # Recovery opportunities grouped by tier
    rec_html = ""
    if recs:
        def tier_block(label: str, conf: str) -> str:
            items = [r for r in recs if r.get("confidence") == conf]
            if not items:
                return ""
            rows = ""
            for r in items:
                rows += (
                    f'<div style="display:flex;justify-content:space-between;margin-bottom:6px">'
                    f'<span style="color:#222">{_esc(r.get("theory"))} '
                    f'<span style="color:#888">({_esc(r.get("recovery_type"))})</span></span>'
                    f'<span style="font-weight:700;color:#111;margin-left:16px;white-space:nowrap">'
                    f'{_esc(r.get("estimated_exposure"))}</span></div>'
                )
            return (f'<div style="margin-bottom:10px"><div style="font-size:11px;font-weight:700;'
                    f'text-transform:uppercase;letter-spacing:0.06em;color:#555;margin-bottom:4px">'
                    f'{_esc(label)}</div>{rows}</div>')
        body = tier_block("Tier 1 · High Confidence", "high") \
            + tier_block("Tier 2 · Medium Confidence", "medium") \
            + tier_block("Tier 3 · Lower Confidence", "low")
        rec_html = f'<div style="margin-bottom:24px">{section_title("Recovery Opportunities")}{body}</div>'

    # Deadlines
    dl_html = ""
    if deadlines:
        rows = ""
        for d in deadlines:
            page = f' ({_esc(d.get("page_ref"))})' if d.get("page_ref") else ""
            dtype = _esc((d.get("type") or "").replace("_", " "))
            rows += (f'<div style="margin-bottom:8px;line-height:1.6">'
                     f'<span style="font-weight:700;color:#111;text-transform:capitalize">{dtype}:</span> '
                     f'{_esc(d.get("description"))} — <em>{_esc(d.get("timeframe"))}</em>{page}</div>')
        dl_html = f'<div style="margin-bottom:24px">{section_title("Controlling Deadlines")}{rows}</div>'

    # Attorney flags
    flags_html = ""
    if flags:
        rows = ""
        for f in flags:
            pages = ", ".join(_esc(x) for x in (f.get("pages") or []))
            pages = f' ({pages})' if pages else ""
            rows += (f'<div style="margin-bottom:8px;line-height:1.6">'
                     f'<span style="font-weight:700;color:#111;text-transform:uppercase">'
                     f'{_esc(f.get("priority"))}:</span> {_esc(f.get("issue"))}{pages}</div>')
        flags_html = f'<div style="margin-bottom:24px">{section_title("Attorney Flags")}{rows}</div>'

    # Case gaps
    gaps_html = ""
    if gaps:
        rows = ""
        for g in gaps:
            rows += (f'<div style="margin-bottom:8px;line-height:1.6">'
                     f'<span style="font-weight:700;color:#111">{_esc(g.get("description"))} '
                     f'<span style="font-weight:400;color:#888">({_esc(g.get("severity"))})</span>:</span> '
                     f'{_esc(g.get("impact"))}</div>')
        gaps_html = f'<div style="margin-bottom:24px">{section_title("Case Gaps")}{rows}</div>'

    # Next steps
    steps_html = ""
    if steps:
        items = ""
        for s in steps:
            rationale = f' — {_esc(s.get("rationale"))}' if s.get("rationale") else ""
            items += (f'<li style="margin-bottom:6px;line-height:1.6">'
                      f'<strong>{_esc(s.get("step"))}</strong>{rationale}</li>')
        steps_html = (f'<div style="margin-bottom:24px">{section_title("Recommended Next Steps")}'
                      f'<ol style="margin:0;padding-left:18px">{items}</ol></div>')

    claimant_html = f'<div>Claimant: {_esc(claimant)}</div>' if claimant else ""

    return f"""<!DOCTYPE html>
<html><head><meta charset="utf-8">
<title>ThemisOS — {_esc(case_name)} — Case Examination</title>
<style>
  @page {{ margin: 0.75in; size: letter; }}
  body {{ font-family: Georgia, serif; color: #111; margin: 0; padding: 32px; background: #fff; }}
  .wrap {{ max-width: 760px; margin: 0 auto; }}
  .hdr {{ border-bottom: 2px solid #0d0f12; padding-bottom: 16px; margin-bottom: 28px;
          display: flex; justify-content: space-between; align-items: flex-start; }}
  .brand {{ font-size: 24px; font-weight: 700; letter-spacing: -0.02em; }}
  .brand span {{ color: #C9962B; }}
  .sub {{ font-size: 11px; color: #666; margin-top: 3px; letter-spacing: 0.1em;
          text-transform: uppercase; font-family: Arial, sans-serif; }}
  .meta {{ text-align: right; font-size: 12px; color: #555; font-family: Arial, sans-serif; line-height: 1.6; }}
  .strength {{ padding: 14px 18px; background: #f5f7fa; border: 1px solid #dde3ec;
               border-radius: 6px; margin-bottom: 24px; font-family: Arial, sans-serif; }}
  .strength .lbl {{ font-size: 10px; text-transform: uppercase; letter-spacing: 0.1em;
                    color: #555; font-weight: 700; margin-bottom: 6px; }}
  .strength .txt {{ font-size: 13px; color: #222; line-height: 1.7; }}
  .ftr {{ margin-top: 48px; padding-top: 12px; border-top: 1px solid #ddd; font-size: 10px;
          color: #aaa; text-align: center; font-family: Arial, sans-serif; }}
  div, span, li {{ font-size: 12px; font-family: Arial, sans-serif; }}
</style></head>
<body><div class="wrap">
  <div class="hdr">
    <div><div class="brand">Themis<span>OS</span></div>
      <div class="sub">Case Examination Report</div></div>
    <div class="meta"><div style="font-weight:600;color:#111">{_esc(case_name)}</div>
      {claimant_html}<div>{_esc(today)}</div></div>
  </div>
  <div class="strength">
    <div class="lbl">Case Strength — {_esc(strength_label)}</div>
    <div class="txt">{_esc(summary)}</div>
  </div>
  {parties_html}
  {rec_html}
  {dl_html}
  {flags_html}
  {gaps_html}
  {steps_html}
  <div class="ftr">Generated by ThemisOS · Confidential Attorney Work Product · {_esc(today)}</div>
</div></body></html>"""


# ─────────────────────────────────────────────────────────────────────────────
# Downloadable Document Analysis report (dependency-free, print-ready HTML)
# ─────────────────────────────────────────────────────────────────────────────

_DOC_GRADE_LABELS = {
    "I": "I · Counsel Grade",
    "II": "II · Standard",
    "III": "III · At Risk",
}


def build_document_report_html(analysis: dict, case_name: str = "Document",
                               document_type: str = "other") -> str:
    grade = (analysis.get("document_grade") or "II")
    grade_label = _DOC_GRADE_LABELS.get(grade, f"{grade} · Unrated")
    type_label = _doc_type_label(document_type)
    detected = analysis.get("document_type_detected") or ""
    favors = analysis.get("favors") or ""
    summary = analysis.get("grade_summary") or ""
    strong = analysis.get("strong_provisions") or []
    weak = analysis.get("weak_provisions") or []
    flags = analysis.get("attorney_flags") or []
    gov = analysis.get("governing_terms") or {}
    deadlines = analysis.get("deadlines") or []
    steps = analysis.get("recommended_next_steps") or []
    today = datetime.now().strftime("%B %d, %Y")

    def section_title(t: str) -> str:
        return (f'<div style="font-size:12px;text-transform:uppercase;letter-spacing:0.08em;'
                f'color:#111;font-weight:700;margin:0 0 10px;border-bottom:1px solid #ddd;'
                f'padding-bottom:4px">{_esc(t)}</div>')

    # Strong provisions
    strong_html = ""
    if strong:
        rows = ""
        for p in strong:
            clause = f' · {_esc(p.get("clause"))}' if p.get("clause") else ""
            page = f' ({_esc(p.get("page_ref"))})' if p.get("page_ref") else ""
            rows += (f'<div style="margin-bottom:10px;line-height:1.6">'
                     f'<span style="font-weight:700;color:#111">{_esc(p.get("provision"))}{clause}:</span> '
                     f'{_esc(p.get("detail"))}{page}</div>')
        strong_html = f'<div style="margin-bottom:24px">{section_title("Strong Provisions")}{rows}</div>'

    # Weak / missing / one-sided provisions
    weak_html = ""
    if weak:
        rows = ""
        for p in weak:
            clause = f' · {_esc(p.get("clause"))}' if p.get("clause") else ""
            page = f' ({_esc(p.get("page_ref"))})' if p.get("page_ref") else ""
            issue = _esc((p.get("issue") or "").replace("_", " "))
            sev = _esc(p.get("severity"))
            rows += (f'<div style="margin-bottom:10px;line-height:1.6">'
                     f'<span style="font-weight:700;color:#111">{_esc(p.get("provision"))}{clause} '
                     f'<span style="font-weight:400;color:#888">[{issue} · {sev}]</span>:</span> '
                     f'{_esc(p.get("detail"))}{page}</div>')
        weak_html = f'<div style="margin-bottom:24px">{section_title("Weak / Missing / One-Sided Provisions")}{rows}</div>'

    # Attorney flags
    flags_html = ""
    if flags:
        rows = ""
        for f in flags:
            pages = ", ".join(_esc(x) for x in (f.get("pages") or []))
            pages = f' ({pages})' if pages else ""
            rows += (f'<div style="margin-bottom:8px;line-height:1.6">'
                     f'<span style="font-weight:700;color:#111;text-transform:uppercase">'
                     f'{_esc(f.get("priority"))}:</span> {_esc(f.get("issue"))}{pages}</div>')
        flags_html = f'<div style="margin-bottom:24px">{section_title("Attorney Flags")}{rows}</div>'

    # Governing terms
    gov_html = ""
    if gov:
        def grow(lbl, key):
            val = gov.get(key)
            if not val:
                return ""
            return (f'<div style="margin-bottom:6px;line-height:1.6">'
                    f'<span style="font-weight:700;color:#111">{_esc(lbl)}:</span> {_esc(val)}</div>')
        body = (grow("Governing Law", "governing_law")
                + grow("Jurisdiction / Venue", "jurisdiction_venue")
                + grow("Notice Requirements", "notice_requirements")
                + grow("Key Dates", "key_dates"))
        if body:
            gov_html = f'<div style="margin-bottom:24px">{section_title("Governing Terms")}{body}</div>'

    # Deadlines
    dl_html = ""
    if deadlines:
        rows = ""
        for d in deadlines:
            page = f' ({_esc(d.get("page_ref"))})' if d.get("page_ref") else ""
            dtype = _esc((d.get("type") or "").replace("_", " "))
            rows += (f'<div style="margin-bottom:8px;line-height:1.6">'
                     f'<span style="font-weight:700;color:#111;text-transform:capitalize">{dtype}:</span> '
                     f'{_esc(d.get("description"))} — <em>{_esc(d.get("timeframe"))}</em>{page}</div>')
        dl_html = f'<div style="margin-bottom:24px">{section_title("Deadlines")}{rows}</div>'

    # Next steps
    steps_html = ""
    if steps:
        items = ""
        for s in steps:
            rationale = f' — {_esc(s.get("rationale"))}' if s.get("rationale") else ""
            items += (f'<li style="margin-bottom:6px;line-height:1.6">'
                      f'<strong>{_esc(s.get("step"))}</strong>{rationale}</li>')
        steps_html = (f'<div style="margin-bottom:24px">{section_title("Recommended Next Steps")}'
                      f'<ol style="margin:0;padding-left:18px">{items}</ol></div>')

    detected_html = f'<div>Detected: {_esc(detected)}</div>' if detected else ""
    favors_html = f'<div>Favors: {_esc(favors)}</div>' if favors else ""

    return f"""<!DOCTYPE html>
<html><head><meta charset="utf-8">
<title>ThemisOS — {_esc(case_name)} — Document Analysis</title>
<style>
  @page {{ margin: 0.75in; size: letter; }}
  body {{ font-family: Georgia, serif; color: #111; margin: 0; padding: 32px; background: #fff; }}
  .wrap {{ max-width: 760px; margin: 0 auto; }}
  .hdr {{ border-bottom: 2px solid #0d0f12; padding-bottom: 16px; margin-bottom: 28px;
          display: flex; justify-content: space-between; align-items: flex-start; }}
  .brand {{ font-size: 24px; font-weight: 700; letter-spacing: -0.02em; }}
  .brand span {{ color: #C9962B; }}
  .sub {{ font-size: 11px; color: #666; margin-top: 3px; letter-spacing: 0.1em;
          text-transform: uppercase; font-family: Arial, sans-serif; }}
  .meta {{ text-align: right; font-size: 12px; color: #555; font-family: Arial, sans-serif; line-height: 1.6; }}
  .grade {{ padding: 14px 18px; background: #f5f7fa; border: 1px solid #dde3ec;
            border-radius: 6px; margin-bottom: 24px; font-family: Arial, sans-serif; }}
  .grade .lbl {{ font-size: 10px; text-transform: uppercase; letter-spacing: 0.1em;
                 color: #555; font-weight: 700; margin-bottom: 6px; }}
  .grade .txt {{ font-size: 13px; color: #222; line-height: 1.7; }}
  .ftr {{ margin-top: 48px; padding-top: 12px; border-top: 1px solid #ddd; font-size: 10px;
          color: #aaa; text-align: center; font-family: Arial, sans-serif; }}
  div, span, li {{ font-size: 12px; font-family: Arial, sans-serif; }}
</style></head>
<body><div class="wrap">
  <div class="hdr">
    <div><div class="brand">Themis<span>OS</span></div>
      <div class="sub">Document Analysis Report · {_esc(type_label)}</div></div>
    <div class="meta"><div style="font-weight:600;color:#111">{_esc(case_name)}</div>
      {detected_html}{favors_html}<div>{_esc(today)}</div></div>
  </div>
  <div class="grade">
    <div class="lbl">Document Grade — {_esc(grade_label)}</div>
    <div class="txt">{_esc(summary)}</div>
  </div>
  {strong_html}
  {weak_html}
  {flags_html}
  {gov_html}
  {dl_html}
  {steps_html}
  <div class="ftr">Generated by ThemisOS · Confidential Attorney Work Product · {_esc(today)}</div>
</div></body></html>"""


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


@app.post("/examine-case")
async def examine_case(
    case_file: UploadFile = File(...),
    context: str = Form(default=""),
    case_id: str = Form(default=""),
    case_name: str = Form(default="Unknown Case"),
    user_email: str = Form(default=""),
    firm_name: str = Form(default=""),
):
    try:
        case_bytes = await case_file.read()
        case_text  = extract_file_text(case_bytes, case_file.filename or "case.pdf")

        if not case_text.strip():
            return JSONResponse(status_code=400, content={"error": "Could not extract text from case file."})

        ai_client = anthropic.Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY"))
        result = run_case_examine(case_text, context.strip(), ai_client)

        # Counts toward "cases analyzed across all features" (analyses_run) and triggers the
        # client notification email — but recovery is NOT tracked here. Per product rule,
        # recovery_identified is written ONLY by the cross-examine flow.
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


@app.post("/analyze-document")
async def analyze_document(
    document: UploadFile = File(...),
    document_type: str = Form(default="other"),
    context: str = Form(default=""),
    case_id: str = Form(default=""),
    case_name: str = Form(default="Unknown Document"),
    user_email: str = Form(default=""),
    firm_name: str = Form(default=""),
):
    try:
        doc_bytes = await document.read()
        doc_text  = extract_file_text(doc_bytes, document.filename or "document.pdf")

        if not doc_text.strip():
            return JSONResponse(status_code=400, content={"error": "Could not extract text from document."})

        ai_client = anthropic.Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY"))
        result = run_document_analysis(doc_text, document_type.strip() or "other", context.strip(), ai_client)

        # Counts toward "cases analyzed across all features" (analyses_run) and triggers the
        # client notification email — but recovery is NOT tracked here. Per product rule,
        # recovery_identified is written ONLY by the cross-examine flow.
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


class ExamineReportRequest(BaseModel):
    examination: dict
    case_name: str = "Case"
    claimant: Optional[str] = None


@app.post("/examine-case/report")
async def examine_case_report(req: ExamineReportRequest):
    """Generate a downloadable, print-ready Case Examination report from an
    examination JSON object (the response body of /examine-case). Returns an
    HTML document with an attachment disposition so the frontend can offer a
    direct download; the browser's Save-as-PDF produces a clean PDF."""
    try:
        report_html = build_examine_report_html(
            req.examination, req.case_name or "Case", req.claimant
        )
        safe_name = "".join(c if c.isalnum() or c in (" ", "-", "_") else "_"
                            for c in (req.case_name or "Case")).strip().replace(" ", "_")
        filename = f"ThemisOS_Case_Examination_{safe_name or 'Case'}.html"
        return Response(
            content=report_html,
            media_type="text/html",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e), "type": type(e).__name__})


class DocumentReportRequest(BaseModel):
    analysis: dict
    case_name: str = "Document"
    document_type: str = "other"


@app.post("/analyze-document/report")
async def analyze_document_report(req: DocumentReportRequest):
    """Generate a downloadable, print-ready Document Analysis report from an
    analysis JSON object (the response body of /analyze-document). Returns an
    HTML document with an attachment disposition so the frontend can offer a
    direct download; the browser's Save-as-PDF produces a clean PDF."""
    try:
        report_html = build_document_report_html(
            req.analysis, req.case_name or "Document", req.document_type or "other"
        )
        safe_name = "".join(c if c.isalnum() or c in (" ", "-", "_") else "_"
                            for c in (req.case_name or "Document")).strip().replace(" ", "_")
        filename = f"ThemisOS_Document_Analysis_{safe_name or 'Document'}.html"
        return Response(
            content=report_html,
            media_type="text/html",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )
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

app.include_router(billing_router)
app.include_router(onboarding_router)
app.mount("/", StaticFiles(directory=".", html=True), name="static")