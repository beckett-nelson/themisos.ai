import os, json, re, traceback
from flask import Flask, request, jsonify, send_from_directory, abort
from flask_cors import CORS
import anthropic

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

try:
    import fitz
    HAS_FITZ = True
except ImportError:
    HAS_FITZ = False

try:
    from docx import Document as DocxDocument
    HAS_DOCX = True
except ImportError:
    HAS_DOCX = False

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

app = Flask(__name__)
CORS(app)
client = anthropic.Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY"))
MODEL = "claude-sonnet-4-5"
MAX_CHARS = 80000


def extract_text(file_storage):
    filename = file_storage.filename.lower()
    raw = file_storage.read()
    if filename.endswith(".pdf") and HAS_FITZ:
        doc = fitz.open(stream=raw, filetype="pdf")
        return "\n\n".join(page.get_text() for page in doc)[:MAX_CHARS]
    if filename.endswith(".docx") and HAS_DOCX:
        import io
        doc = DocxDocument(io.BytesIO(raw))
        return "\n".join(p.text for p in doc.paragraphs)[:MAX_CHARS]
    try:
        return raw.decode("utf-8", errors="replace")[:MAX_CHARS]
    except:
        return raw.decode("latin-1", errors="replace")[:MAX_CHARS]


def parse_json_response(text):
    text = text.strip()
    text = re.sub(r"^```(?:json)?\s*", "", text)
    text = re.sub(r"\s*```$", "", text)
    return json.loads(text)


ANALYZE_SYSTEM = """You are ThemisOS, an expert insurance coverage analyst.
Respond ONLY with valid JSON, no markdown, no explanation.
Schema:
{
  "policy_summary": {"policy_type":"","form_type":"","insurer":"","named_insured":"","policy_number":"","policy_period":""},
  "reconciled_limits": {
    "each_occurrence":{"value":0,"page":null},
    "general_aggregate":{"value":0,"page":null},
    "products_completed_ops_aggregate":{"value":0,"page":null},
    "personal_advertising_injury":{"value":0,"page":null},
    "attachment_point":{"value":0,"page":null},
    "self_insured_retention":{"value":0,"page":null},
    "maximum_available":0
  },
  "attorney_flags":[{"priority":"urgent|review|informational","issue":"","pages":[]}],
  "recovery_opportunities":[{"theory":"","estimated_exposure":"$0M","confidence":"high|medium|low"}],
  "all_exclusions":[{"name":"","key_language":"","page":null,"endorsement_number":null}],
  "all_endorsements":[{"number":"","title":"","effect":"broadening|restricting|clarifying","summary":""}],
  "coverage_gaps":[{"description":"","severity":"high|medium|low","recovery_implication":""}]
}"""

CROSS_SYSTEM = """You are ThemisOS, an expert insurance coverage attorney.
Respond ONLY with valid JSON, no markdown, no explanation.
Schema:
{
  "verdict":"covered|not_covered|partial|unclear",
  "summary":"",
  "coverage_limit":null,
  "deductible":null,
  "key_findings":[{"type":"success|danger|warning|info|neutral","title":"","detail":""}],
  "coverage_items":[{"item":"","status":"covered|excluded|partial|unclear","note":""}],
  "conflicts":[{"type":"gap|conflict|exclusion|ambiguity","title":"","detail":""}],
  "recommendation":null
}"""


# ─── API ROUTES (must be before the catch-all) ────────────────────────────────

@app.route("/analyze", methods=["POST"])
def analyze():
    if "file" not in request.files:
        return jsonify({"error": "No file uploaded"}), 400
    f = request.files["file"]
    try:
        text = extract_text(f)
        response = client.messages.create(
            model=MODEL, max_tokens=8192, system=ANALYZE_SYSTEM,
            messages=[{"role": "user", "content": f"Analyze this insurance policy:\n\n{text}"}]
        )
        result = parse_json_response(response.content[0].text)
        result["_source_file"] = f.filename
        return jsonify(result)
    except anthropic.RateLimitError:
        return jsonify({"error": "Rate limit — wait 60s and retry"}), 429
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route("/cross-examine", methods=["POST"])
def cross_examine():
    if "policy" not in request.files or "case_file" not in request.files:
        return jsonify({"error": "Both policy and case_file required"}), 400
    policy_file = request.files["policy"]
    case_file   = request.files["case_file"]
    context     = request.form.get("context", "")
    try:
        policy_text = extract_text(policy_file)
        case_text   = extract_text(case_file)
        prompt = f"POLICY:\n{policy_text}\n\nCASE FILE:\n{case_text}"
        if context:
            prompt = f"CONTEXT:\n{context}\n\n{prompt}"
        prompt += "\n\nCross-examine and return JSON."
        response = client.messages.create(
            model=MODEL, max_tokens=4096, system=CROSS_SYSTEM,
            messages=[{"role": "user", "content": prompt}]
        )
        return jsonify(parse_json_response(response.content[0].text))
    except anthropic.RateLimitError:
        return jsonify({"error": "Rate limit — wait 60s and retry"}), 429
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route("/health")
def health():
    return jsonify({
        "status": "ok",
        "api_key_set": bool(os.environ.get("ANTHROPIC_API_KEY")),
        "pdf_support": HAS_FITZ
    })


# ─── STATIC FILE ROUTES (catch-all last) ─────────────────────────────────────

@app.route("/")
def index():
    return send_from_directory(BASE_DIR, "index.html")

@app.route("/<path:filename>")
def static_files(filename):
    # Never serve API endpoint names as static files
    if filename in ("cross-examine", "analyze", "health"):
        abort(404)
    return send_from_directory(BASE_DIR, filename)


if __name__ == "__main__":
    print("\n✓ ThemisOS backend running on http://127.0.0.1:5001\n")
    app.run(host="0.0.0.0", port=5001, debug=True)