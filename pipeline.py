"""
CoverageIQ — Insurance Policy Extraction Pipeline
Three-pass extraction strategy using the Claude API.

Pass 1: Document classification & chunking
Pass 2: Structured field extraction (per chunk)
Pass 3: Cross-document reconciliation & gap detection

Dependencies:
    pip install anthropic pdfplumber
"""

import anthropic
import pdfplumber
import json
from pathlib import Path
from typing import Optional

client = anthropic.Anthropic()  # reads ANTHROPIC_API_KEY from env
MODEL = "claude-sonnet-4-5"


# ─────────────────────────────────────────────────────────────────────────────
# STEP 0 — PDF text extraction
# ─────────────────────────────────────────────────────────────────────────────

def extract_pdf_text(pdf_path: str) -> list[dict]:
    pages = []
    with pdfplumber.open(pdf_path) as pdf:
        for i, page in enumerate(pdf.pages, start=1):
            text = page.extract_text() or ""
            pages.append({"page": i, "text": text.strip()})
    return pages


def chunk_pages(pages: list[dict], chunk_size: int = 20) -> list[dict]:
    chunks = []
    for i in range(0, len(pages), chunk_size):
        group = pages[i:i + chunk_size]
        chunks.append({
            "page_start": group[0]["page"],
            "page_end": group[-1]["page"],
            "text": "\n\n--- PAGE BREAK ---\n\n".join(
                f"[Page {p['page']}]\n{p['text']}" for p in group
            )
        })
    return chunks


# ─────────────────────────────────────────────────────────────────────────────
# SHARED HELPER
# ─────────────────────────────────────────────────────────────────────────────

def _safe_parse(raw: str, context: str) -> dict:
    """Strip markdown fences and parse JSON. Raises with context on failure."""
    raw = raw.strip()
    if raw.startswith("```"):
        start = raw.find("{")
        end = raw.rfind("}") + 1
        if start == -1 or end == 0:
            raise ValueError(f"{context}: response contained no JSON object.\nRaw: {raw!r}")
        raw = raw[start:end]
    if not raw:
        raise ValueError(f"{context}: response was empty.")
    return json.loads(raw)


# ─────────────────────────────────────────────────────────────────────────────
# PASS 1 — Document classification
# ─────────────────────────────────────────────────────────────────────────────

CLASSIFICATION_SYSTEM = """You are an expert insurance coverage attorney with 20 years of 
experience reading complex commercial insurance policies. You classify insurance documents 
with surgical precision.

Always respond with valid JSON only. No prose, no markdown fences."""

CLASSIFICATION_PROMPT = """Classify this insurance document. Examine the first several pages carefully.

Document text:
<document>
{text}
</document>

Respond with this exact JSON schema:
{{
  "policy_type": "CGL | Umbrella | Excess | D&O | E&O | Property | Auto | Workers_Comp | Professional_Liability | Other",
  "form_type": "occurrence | claims_made | unknown",
  "insurer": "string or null",
  "named_insured": "string or null",
  "policy_number": "string or null",
  "policy_period_start": "YYYY-MM-DD or null",
  "policy_period_end": "YYYY-MM-DD or null",
  "currency": "USD | GBP | EUR | other",
  "endorsement_count": "integer estimate",
  "confidence": "high | medium | low",
  "classification_notes": "any ambiguities or caveats in 1-2 sentences"
}}"""


def classify_document(pages: list[dict]) -> dict:
    """Pass 1: Classify document type using first 5 pages."""
    preview_text = "\n\n".join(p["text"] for p in pages[:5])
    response = client.messages.create(
        model=MODEL,
        max_tokens=512,
        system=CLASSIFICATION_SYSTEM,
        messages=[{"role": "user", "content": CLASSIFICATION_PROMPT.format(text=preview_text)}]
    )
    raw = response.content[0].text
    print(f"  [classify] stop_reason={response.stop_reason} raw_len={len(raw)}")
    return _safe_parse(raw, "classify_document")


# ─────────────────────────────────────────────────────────────────────────────
# PASS 2 — Structured field extraction (per chunk)
# ─────────────────────────────────────────────────────────────────────────────

EXTRACTION_SYSTEM = """You are a senior insurance coverage attorney specializing in complex 
commercial claims and coverage litigation. You extract structured data from insurance policy 
documents with extreme precision.

Critical rules:
- Extract ONLY what is explicitly stated. Never infer or assume.
- Every extracted value must include a page citation.
- If a field is not present in this chunk, set it to null — do not guess.
- Exclusions and conditions are as important as grants of coverage.
- Pay special attention to: manuscript endorsements, time-element extensions, 
  anti-stacking provisions, other insurance clauses, and follow-form language.

Always respond with valid JSON only. No prose, no markdown fences."""

EXTRACTION_PROMPT = """Extract all insurance coverage data from this policy chunk.

Policy context:
- Policy type: {policy_type}
- Form type: {form_type}
- Pages in this chunk: {page_start}–{page_end}

Policy text:
<chunk>
{text}
</chunk>

Extract using this exact JSON schema. Use null for any field not found in this chunk.
For all monetary values, extract as numbers (no $ signs or commas).
For all page citations, use the [Page N] markers in the text.

{{
  "limits": {{
    "each_occurrence": {{"value": null, "page": null}},
    "general_aggregate": {{"value": null, "page": null}},
    "products_completed_ops_aggregate": {{"value": null, "page": null}},
    "personal_advertising_injury": {{"value": null, "page": null}},
    "damage_to_rented_premises": {{"value": null, "page": null}},
    "medical_expense": {{"value": null, "page": null}},
    "self_insured_retention": {{"value": null, "page": null}},
    "deductible": {{"value": null, "page": null}},
    "attachment_point": {{"value": null, "page": null}},
    "other_limits": []
  }},
  "coverage_triggers": {{
    "occurrence_definition": {{"text": null, "page": null}},
    "bodily_injury_definition": {{"text": null, "page": null}},
    "property_damage_definition": {{"text": null, "page": null}},
    "coverage_territory": {{"text": null, "page": null}}
  }},
  "exclusions": [
    {{
      "name": "string",
      "endorsement_number": "string or null",
      "key_language": "verbatim excerpt under 50 words",
      "page": "integer"
    }}
  ],
  "endorsements": [
    {{
      "number": "string",
      "title": "string",
      "effect": "broadening | restricting | clarifying | adding_coverage",
      "summary": "1-2 sentence plain English summary",
      "page": "integer"
    }}
  ],
  "conditions": {{
    "notice_of_occurrence": {{"text": null, "page": null}},
    "cooperation_clause": {{"text": null, "page": null}},
    "other_insurance_clause": {{"type": null, "text": null, "page": null}},
    "follow_form_language": {{"text": null, "page": null}},
    "anti_stacking": {{"text": null, "page": null}}
  }},
  "additional_insureds": [
    {{"name": null, "basis": null, "page": null}}
  ],
  "flags": [
    {{
      "type": "ambiguity | gap | conflict | missing_definition | unusual_provision",
      "description": "string",
      "page": "integer",
      "severity": "high | medium | low"
    }}
  ]
}}"""


def extract_chunk(chunk: dict, classification: dict) -> dict:
    """Pass 2: Extract structured fields from a single chunk."""
    response = client.messages.create(
        model=MODEL,
        max_tokens=8192,
        system=EXTRACTION_SYSTEM,
        messages=[{
            "role": "user",
            "content": EXTRACTION_PROMPT.format(
                policy_type=classification["policy_type"],
                form_type=classification["form_type"],
                page_start=chunk["page_start"],
                page_end=chunk["page_end"],
                text=chunk["text"]
            )
        }]
    )
    raw = response.content[0].text
    print(f"  [extract p{chunk['page_start']}-{chunk['page_end']}] stop_reason={response.stop_reason} raw_len={len(raw)}")
    result = _safe_parse(raw, f"extract_chunk pages {chunk['page_start']}–{chunk['page_end']}")
    result["_chunk_pages"] = f"{chunk['page_start']}–{chunk['page_end']}"
    return result


def extract_all_chunks(chunks: list[dict], classification: dict) -> list[dict]:
    """Run Pass 2 over all chunks."""
    results = []
    for i, chunk in enumerate(chunks):
        print(f"  Extracting chunk {i+1}/{len(chunks)} (pages {chunk['page_start']}–{chunk['page_end']})")
        results.append(extract_chunk(chunk, classification))
    return results


# ─────────────────────────────────────────────────────────────────────────────
# PASS 3 — Reconciliation & gap detection
# ─────────────────────────────────────────────────────────────────────────────

RECONCILIATION_SYSTEM = """You are a coverage litigation expert. You synthesize partial 
policy extractions from multiple document chunks into a single authoritative coverage record, 
then identify recovery opportunities and coverage gaps.

When values conflict across chunks, prefer the most specific and most recently 
cited instance. Flag all conflicts for attorney review.

Always respond with valid JSON only. No prose, no markdown fences."""

RECONCILIATION_PROMPT = """Reconcile these chunk extractions into one authoritative policy record.
Identify conflicts, gaps, and recovery opportunities.

Policy classification:
{classification}

Chunk extractions:
{extractions}

Produce a final reconciled JSON record:
{{
  "policy_summary": {{
    "policy_type": "string",
    "form_type": "string",
    "insurer": "string or null",
    "named_insured": "string or null",
    "policy_number": "string or null",
    "policy_period": "string or null"
  }},
  "reconciled_limits": {{
    "each_occurrence": {{"value": null, "page": null}},
    "general_aggregate": {{"value": null, "page": null}},
    "products_completed_ops_aggregate": {{"value": null, "page": null}},
    "attachment_point": {{"value": null, "page": null}},
    "self_insured_retention": {{"value": null, "page": null}},
    "maximum_available": null
  }},
  "all_exclusions": [],
  "all_endorsements": [],
  "coverage_conflicts": [
    {{
      "description": "string",
      "chunk_a_page": null,
      "chunk_b_page": null,
      "resolution": "string or null"
    }}
  ],
  "coverage_gaps": [
    {{
      "description": "what coverage is absent or unclear",
      "severity": "high | medium | low",
      "recovery_implication": "string"
    }}
  ],
  "recovery_opportunities": [
    {{
      "theory": "string",
      "estimated_exposure": "string or null",
      "pages": [],
      "confidence": "high | medium | low"
    }}
  ],
  "attorney_flags": [
    {{
      "priority": "urgent | review | informational",
      "issue": "string",
      "pages": []
    }}
  ]
}}"""


def reconcile_extractions(classification: dict, chunk_extractions: list[dict]) -> dict:
    """Pass 3: Reconcile all chunk extractions into a final policy record."""
    response = client.messages.create(
        model=MODEL,
        max_tokens=8192,
        system=RECONCILIATION_SYSTEM,
        messages=[{
            "role": "user",
            "content": RECONCILIATION_PROMPT.format(
                classification=json.dumps(classification, indent=2),
                extractions=json.dumps(chunk_extractions, indent=2)
            )
        }]
    )
    raw = response.content[0].text
    print(f"  [reconcile] stop_reason={response.stop_reason} raw_len={len(raw)}")
    print(f"  [reconcile] first 300 chars: {raw[:300]}")
    return _safe_parse(raw, "reconcile_extractions")


# ─────────────────────────────────────────────────────────────────────────────
# MAIN PIPELINE
# ─────────────────────────────────────────────────────────────────────────────

def process_policy(pdf_path: str, output_path: Optional[str] = None) -> dict:
    """
    Full three-pass extraction pipeline.
    Returns the reconciled policy record as a dict.
    Optionally saves to output_path as JSON.
    """
    path = Path(pdf_path)
    print(f"\nProcessing: {path.name}")

    print("  Extracting PDF text...")
    pages = extract_pdf_text(pdf_path)
    chunks = chunk_pages(pages, chunk_size=20)
    print(f"  {len(pages)} pages → {len(chunks)} chunks")

    print("  Pass 1: Classifying document...")
    classification = classify_document(pages)
    print(f"  → {classification['policy_type']} / {classification['form_type']} "
          f"(confidence: {classification['confidence']})")

    print("  Pass 2: Extracting structured fields...")
    chunk_extractions = extract_all_chunks(chunks, classification)

    print("  Pass 3: Reconciling and detecting gaps...")
    final_record = reconcile_extractions(classification, chunk_extractions)

    final_record["_classification"] = classification
    final_record["_source_file"] = str(path.name)
    final_record["_page_count"] = len(pages)

    if output_path:
        with open(output_path, "w") as f:
            json.dump(final_record, f, indent=2)
        print(f"  Saved to: {output_path}")

    opps = final_record.get("recovery_opportunities", [])
    flags = final_record.get("attorney_flags", [])
    print(f"\n  Recovery opportunities found: {len(opps)}")
    print(f"  Attorney flags: {len([f for f in flags if f['priority'] == 'urgent'])} urgent, "
          f"{len([f for f in flags if f['priority'] == 'review'])} review")

    return final_record


# ─────────────────────────────────────────────────────────────────────────────
# BONUS: Cross-policy tower analysis (for multi-policy matters)
# ─────────────────────────────────────────────────────────────────────────────

TOWER_SYSTEM = """You are a coverage litigation expert analyzing a complete insurance tower 
for maximum recovery. You trace how excess and umbrella policies sit above primary policies, 
identify attachment points, and calculate the total available limits.

Always respond with valid JSON only."""

TOWER_PROMPT = """Analyze this set of policy records and construct the coverage tower.
Identify the recovery waterfall and total maximum available limits.

Policy records:
{policies}

Respond with:
{{
  "tower_layers": [
    {{
      "layer": 1,
      "policy_type": "Primary CGL",
      "insurer": "string",
      "policy_number": "string",
      "limit": null,
      "attachment_point": 0,
      "exhaustion_point": null,
      "follows_form_to": "policy_number or null",
      "notes": "string or null"
    }}
  ],
  "total_available_limits": null,
  "gaps_in_tower": [],
  "anti_stacking_issues": [],
  "recommended_demand_sequence": []
}}"""


def build_coverage_tower(policy_records: list[dict]) -> dict:
    """Analyze multiple reconciled policy records to build the coverage tower."""
    response = client.messages.create(
        model=MODEL,
        max_tokens=4096,
        system=TOWER_SYSTEM,
        messages=[{
            "role": "user",
            "content": TOWER_PROMPT.format(policies=json.dumps(policy_records, indent=2))
        }]
    )
    raw = response.content[0].text
    return _safe_parse(raw, "build_coverage_tower")


# ─────────────────────────────────────────────────────────────────────────────
# EXAMPLE USAGE
# ─────────────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    record = process_policy(
        pdf_path="policies/berkshire_umbrella_2019.pdf",
        output_path="output/berkshire_umbrella_2019.json"
    )