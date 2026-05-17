"""
CoverageIQ — Flask backend for Policy Cross-Examination
Fixes:
  - PDFs are extracted to text via pdfplumber (never sent as raw base64)
  - Rate limit 429 errors are retried with exponential backoff
  - Large documents are chunked so no single request exceeds token limits
  - 100-page PDF limit is never hit because we extract text first
  - All findings, coverage items, and conflicts now include page_ref, document, and clause
"""

import anthropic
import pdfplumber
import json
import time
import random
from pathlib import Path
from typing import Optional
from flask import Flask, request, jsonify, send_from_directory
from io import BytesIO

app = Flask(__name__, static_folder=".")
client = anthropic.Anthropic()  # reads ANTHROPIC_API_KEY from env
MODEL = "claude-sonnet-4-5"

MAX_CHARS_PER_REQUEST = 60_000   # ~15k tokens — safe margin under 30k TPM limit
MAX_RETRIES = 5


# ─────────────────────────────────────────────────────────────────────────────
# RETRY HELPER
# ─────────────────────────────────────────────────────────────────────────────

def call_claude_with_retry(system: str, user_content: str, max_tokens: int = 4096) -> str:
    delay = 5
    for attempt in range(MAX_RETRIES):
        try:
            response = client.messages.create(
                model=MODEL,
                max_tokens=max_tokens,
                system=system,
                messages=[{"role": "user", "content": user_content}]
            )
            return response.content[0].text
        except anthropic.RateLimitError as e:
            if attempt == MAX_RETRIES - 1:
                raise
            jitter = random.uniform(0, delay * 0.3)
            wait = delay + jitter
            print(f"  [rate_limit] attempt {attempt+1}/{MAX_RETRIES}, waiting {wait:.1f}s...")
            time.sleep(wait)
            delay = min(delay * 2, 120)
        except anthropic.BadRequestError as e:
            raise


# ─────────────────────────────────────────────────────────────────────────────
# PDF / TEXT EXTRACTION
# ─────────────────────────────────────────────────────────────────────────────

def extract_text_from_file(file_storage) -> str:
    filename = file_storage.filename.lower()
    raw_bytes = file_storage.read()

    if filename.endswith(".pdf"):
        pages = []
        with pdfplumber.open(BytesIO(raw_bytes)) as pdf:
            total = len(pdf.pages)
            print(f"  PDF has {total} pages — extracting text (no 100-page limit applies)")
            for i, page in enumerate(pdf.pages, start=1):
                text = page.extract_text() or ""
                if text.strip():
                    pages.append(f"[Page {i}]\n{text.strip()}")
        return "\n\n".join(pages)

    elif filename.endswith(".txt"):
        return raw_bytes.decode("utf-8", errors="replace")

    elif filename.endswith((".docx", ".doc")):
        try:
            import docx
            doc = docx.Document(BytesIO(raw_bytes))
            return "\n".join(p.text for p in doc.paragraphs if p.text.strip())
        except ImportError:
            return raw_bytes.decode("utf-8", errors="replace")

    else:
        return raw_bytes.decode("utf-8", errors="replace")


def chunk_text(text: str, max_chars: int = MAX_CHARS_PER_REQUEST) -> list[str]:
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


# ─────────────────────────────────────────────────────────────────────────────
# SAFE JSON PARSE
# ─────────────────────────────────────────────────────────────────────────────

def safe_parse(raw: str) -> dict:
    raw = raw.strip()
    if raw.startswith("```"):
        start = raw.find("{")
        end = raw.rfind("}") + 1
        if start != -1 and end > 0:
            raw = raw[start:end]
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return {"summary": raw, "verdict": "unclear", "key_findings": [], "coverage_items": [], "conflicts": []}


# ─────────────────────────────────────────────────────────────────────────────
# CROSS-EXAMINATION LOGIC
# ─────────────────────────────────────────────────────────────────────────────

ANALYSIS_SYSTEM = """You are an expert insurance coverage attorney. You analyze insurance 
policies against case files to determine coverage, identify conflicts, and flag gaps.

CRITICAL CITATION REQUIREMENT: Every finding, coverage item, and conflict MUST include:
- document: which source document the finding comes from ("policy" or "case_file")
- page_ref: the exact page number(s) where the clause or fact appears (e.g. "p. 12" or "pp. 4-5")
- clause: the specific section, clause, or exhibit identifier (e.g. "Section 3.2(b)", "Exclusion F", "Exhibit A", "Schedule 1", "Definition 14")

If a finding spans both documents, cite both. If no page number is determinable, use "n/a" but always provide the clause/section name.

Always respond with valid JSON only. No prose, no markdown fences."""

def build_analysis_prompt(policy_chunk: str, case_chunk: str, context: str, is_partial: bool = False) -> str:
    partial_note = "NOTE: These are excerpts from larger documents. Extract what you can from this portion." if is_partial else ""
    return f"""Analyze this insurance policy against this case file.
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

Respond with exactly this JSON schema. Every finding MUST have page_ref, document, and clause populated:
{{
  "verdict": "covered | not_covered | partial | unclear",
  "summary": "2-3 sentence plain English verdict summary",
  "coverage_limit": "e.g. $1,000,000 or null",
  "deductible": "e.g. $10,000 or null",
  "key_findings": [
    {{
      "type": "success | danger | warning | info | neutral",
      "title": "short title",
      "detail": "1-2 sentence explanation",
      "document": "policy | case_file | both",
      "page_ref": "p. 12 | pp. 4-5 | n/a",
      "clause": "Section 3.2(b) | Exclusion F | Definition 14 | etc."
    }}
  ],
  "coverage_items": [
    {{
      "item": "coverage area name",
      "status": "covered | excluded | partial | unclear",
      "note": "brief explanation",
      "document": "policy | case_file | both",
      "page_ref": "p. 7 | n/a",
      "clause": "Section or clause identifier"
    }}
  ],
  "conflicts": [
    {{
      "type": "gap | conflict | exclusion | ambiguity",
      "title": "short title",
      "detail": "explanation",
      "policy_ref": {{
        "page_ref": "p. 3",
        "clause": "Section 1.4"
      }},
      "case_ref": {{
        "page_ref": "p. 18",
        "clause": "Incident Report §2"
      }}
    }}
  ],
  "recommendation": "1-2 sentence attorney recommendation or null"
}}"""

MERGE_SYSTEM = """You are an expert insurance coverage attorney. You merge multiple partial 
coverage analyses into one final authoritative verdict.
Always respond with valid JSON only. No prose, no markdown fences.
Preserve all page_ref, document, and clause citation fields from partial analyses."""

def merge_partial_analyses(partials: list[dict], context: str) -> dict:
    prompt = f"""Merge these partial insurance coverage analyses into one final authoritative verdict.
Preserve all citation fields (page_ref, document, clause, policy_ref, case_ref) exactly as found.
{f'Context: {context}' if context else ''}

Partial analyses:
{json.dumps(partials, indent=2)}

Produce a single merged JSON using the same schema:
{{
  "verdict": "covered | not_covered | partial | unclear",
  "summary": "2-3 sentence plain English verdict summary",
  "coverage_limit": "string or null",
  "deductible": "string or null",
  "key_findings": [
    {{
      "type": "success|danger|warning|info|neutral",
      "title": "...",
      "detail": "...",
      "document": "policy | case_file | both",
      "page_ref": "p. X",
      "clause": "Section X.X"
    }}
  ],
  "coverage_items": [
    {{
      "item": "...",
      "status": "covered|excluded|partial|unclear",
      "note": "...",
      "document": "policy | case_file | both",
      "page_ref": "p. X",
      "clause": "Section X.X"
    }}
  ],
  "conflicts": [
    {{
      "type": "gap|conflict|exclusion|ambiguity",
      "title": "...",
      "detail": "...",
      "policy_ref": {{"page_ref": "p. X", "clause": "Section X.X"}},
      "case_ref": {{"page_ref": "p. X", "clause": "Section X.X"}}
    }}
  ],
  "recommendation": "string or null"
}}

Rules:
- If any partial says not_covered for the core claim, lean toward not_covered or partial
- Deduplicate similar findings but preserve all unique citations
- Preserve all unique conflicts and gaps with their full citation data
- Synthesize a coherent summary"""

    raw = call_claude_with_retry(MERGE_SYSTEM, prompt, max_tokens=4096)
    return safe_parse(raw)


def cross_examine(policy_text: str, case_text: str, context: str) -> dict:
    combined_len = len(policy_text) + len(case_text)

    if combined_len <= MAX_CHARS_PER_REQUEST:
        print("  Single-call analysis")
        prompt = build_analysis_prompt(policy_text, case_text, context, is_partial=False)
        raw = call_claude_with_retry(ANALYSIS_SYSTEM, prompt, max_tokens=4096)
        return safe_parse(raw)

    policy_chunks = chunk_text(policy_text, MAX_CHARS_PER_REQUEST // 2)
    case_chunks = chunk_text(case_text, MAX_CHARS_PER_REQUEST // 2)
    print(f"  Chunked: {len(policy_chunks)} policy chunks × {len(case_chunks)} case chunks")

    partials = []
    first_case = case_chunks[0]
    for i, policy_chunk in enumerate(policy_chunks):
        print(f"  Analyzing policy chunk {i+1}/{len(policy_chunks)}...")
        prompt = build_analysis_prompt(policy_chunk, first_case, context, is_partial=True)
        raw = call_claude_with_retry(ANALYSIS_SYSTEM, prompt, max_tokens=3000)
        partials.append(safe_parse(raw))
        if i < len(policy_chunks) - 1:
            time.sleep(2)

    if len(case_chunks) > 1:
        first_policy = policy_chunks[0]
        for i, case_chunk in enumerate(case_chunks[1:], start=2):
            print(f"  Analyzing case chunk {i}/{len(case_chunks)}...")
            prompt = build_analysis_prompt(first_policy, case_chunk, context, is_partial=True)
            raw = call_claude_with_retry(ANALYSIS_SYSTEM, prompt, max_tokens=3000)
            partials.append(safe_parse(raw))
            time.sleep(2)

    print(f"  Merging {len(partials)} partial analyses...")
    return merge_partial_analyses(partials, context)


# ─────────────────────────────────────────────────────────────────────────────
# FLASK ROUTES
# ─────────────────────────────────────────────────────────────────────────────

@app.route("/")
def index():
    return send_from_directory(".", "index.html")

@app.route("/cross-examine", methods=["POST"])
def cross_examine_route():
    try:
        policy_file = request.files.get("policy")
        case_file   = request.files.get("case_file")
        context     = request.form.get("context", "").strip()

        if not policy_file or not case_file:
            return jsonify({"error": "Both policy and case_file are required"}), 400

        print(f"\nNew request: policy={policy_file.filename}, case={case_file.filename}")

        print("  Extracting policy text...")
        policy_text = extract_text_from_file(policy_file)
        print(f"  Policy: {len(policy_text):,} chars")

        print("  Extracting case text...")
        case_text = extract_text_from_file(case_file)
        print(f"  Case: {len(case_text):,} chars")

        if not policy_text.strip():
            return jsonify({"error": "Could not extract text from policy file. Is it a scanned PDF?"}), 400
        if not case_text.strip():
            return jsonify({"error": "Could not extract text from case file. Is it a scanned PDF?"}), 400

        result = cross_examine(policy_text, case_text, context)
        return jsonify(result)

    except anthropic.RateLimitError as e:
        return jsonify({"error": f"Rate limit exceeded after retries. Please wait a minute and try again."}), 429
    except anthropic.BadRequestError as e:
        return jsonify({"error": f"API error: {str(e)}"}), 400
    except Exception as e:
        print(f"  ERROR: {e}")
        import traceback; traceback.print_exc()
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    app.run(debug=True, port=5000)
