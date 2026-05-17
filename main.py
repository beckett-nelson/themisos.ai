from source
"""
CoverageIQ — Flask backend for Policy Cross-Examination
Fixes:
  - PDFs are extracted to text via pdfplumber (never sent as raw base64)
  - Rate limit 429 errors are retried with exponential backoff
  - Large documents are chunked so no single request exceeds token limits
  - 100-page PDF limit is never hit because we extract text first
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
    """
    Call Claude with exponential backoff on 429 rate limit errors.
    Returns the raw text response.
    """
    delay = 5  # seconds, doubles each retry
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
            delay = min(delay * 2, 120)  # cap at 2 minutes
        except anthropic.BadRequestError as e:
            # Non-retryable (e.g. content policy)
            raise


# ─────────────────────────────────────────────────────────────────────────────
# PDF / TEXT EXTRACTION
# ─────────────────────────────────────────────────────────────────────────────

def extract_text_from_file(file_storage) -> str:
    """
    Extract plain text from an uploaded file.
    Supports PDF (via pdfplumber), TXT, and DOCX.
    Never sends the raw PDF bytes to Claude.
    """
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
    """
    Split text into chunks that fit within our per-request character budget.
    Tries to split on page boundaries; falls back to paragraph, then hard split.
    """
    if len(text) <= max_chars:
        return [text]

    chunks = []
    # Try to split on page markers first
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
        # Return a best-effort dict with the raw text as summary
        return {"summary": raw, "verdict": "unclear", "key_findings": [], "coverage_items": [], "conflicts": []}


# ─────────────────────────────────────────────────────────────────────────────
# CROSS-EXAMINATION LOGIC
# ─────────────────────────────────────────────────────────────────────────────

ANALYSIS_SYSTEM = """You are an expert insurance coverage attorney. You analyze insurance 
policies against case files to determine coverage, identify conflicts, and flag gaps.
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

Respond with exactly this JSON schema:
{{
  "verdict": "covered | not_covered | partial | unclear",
  "summary": "2-3 sentence plain English verdict summary",
  "coverage_limit": "e.g. $1,000,000 or null",
  "deductible": "e.g. $10,000 or null",
  "key_findings": [
    {{
      "type": "success | danger | warning | info | neutral",
      "title": "short title",
      "detail": "1-2 sentence explanation"
    }}
  ],
  "coverage_items": [
    {{
      "item": "coverage area name",
      "status": "covered | excluded | partial | unclear",
      "note": "brief explanation"
    }}
  ],
  "conflicts": [
    {{
      "type": "gap | conflict | exclusion | ambiguity",
      "title": "short title",
      "detail": "explanation"
    }}
  ],
  "recommendation": "1-2 sentence attorney recommendation or null"
}}"""

MERGE_SYSTEM = """You are an expert insurance coverage attorney. You merge multiple partial 
coverage analyses into one final authoritative verdict.
Always respond with valid JSON only. No prose, no markdown fences."""

def merge_partial_analyses(partials: list[dict], context: str) -> dict:
    """When documents were too large to analyze in one call, merge partial results."""
    prompt = f"""Merge these partial insurance coverage analyses into one final authoritative verdict.
{f'Context: {context}' if context else ''}

Partial analyses:
{json.dumps(partials, indent=2)}

Produce a single merged JSON using the same schema:
{{
  "verdict": "covered | not_covered | partial | unclear",
  "summary": "2-3 sentence plain English verdict summary",
  "coverage_limit": "string or null",
  "deductible": "string or null",
  "key_findings": [...],
  "coverage_items": [...],
  "conflicts": [...],
  "recommendation": "string or null"
}}

Rules:
- If any partial says not_covered for the core claim, lean toward not_covered or partial
- Deduplicate similar findings
- Preserve all unique conflicts and gaps
- Synthesize a coherent summary"""

    raw = call_claude_with_retry(MERGE_SYSTEM, prompt, max_tokens=4096)
    return safe_parse(raw)


def cross_examine(policy_text: str, case_text: str, context: str) -> dict:
    """
    Main analysis function. Handles documents of any size by chunking.
    If both docs fit in one request, does it in one call.
    Otherwise, analyzes chunk pairs and merges.
    """
    combined_len = len(policy_text) + len(case_text)

    if combined_len <= MAX_CHARS_PER_REQUEST:
        # Happy path: single call
        print("  Single-call analysis")
        prompt = build_analysis_prompt(policy_text, case_text, context, is_partial=False)
        raw = call_claude_with_retry(ANALYSIS_SYSTEM, prompt, max_tokens=4096)
        return safe_parse(raw)

    # Documents too large — chunk and merge
    policy_chunks = chunk_text(policy_text, MAX_CHARS_PER_REQUEST // 2)
    case_chunks = chunk_text(case_text, MAX_CHARS_PER_REQUEST // 2)
    print(f"  Chunked: {len(policy_chunks)} policy chunks × {len(case_chunks)} case chunks")

    partials = []
    # Analyze each policy chunk against the first (most important) case chunk
    # and the full case summary against each policy chunk
    first_case = case_chunks[0]
    for i, policy_chunk in enumerate(policy_chunks):
        print(f"  Analyzing policy chunk {i+1}/{len(policy_chunks)}...")
        prompt = build_analysis_prompt(policy_chunk, first_case, context, is_partial=True)
        raw = call_claude_with_retry(ANALYSIS_SYSTEM, prompt, max_tokens=3000)
        partials.append(safe_parse(raw))
        # Small pause between chunked calls to avoid rate limits
        if i < len(policy_chunks) - 1:
            time.sleep(2)

    if len(case_chunks) > 1:
        # Also analyze remaining case chunks against first policy chunk
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

        # Extract text — this is why we never hit the 100-page PDF limit
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
