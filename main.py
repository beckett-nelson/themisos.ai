from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
import tempfile, os, anthropic
from pipeline import process_policy

app = FastAPI()

app.add_middleware(CORSMiddleware, allow_origins=["*"],
                   allow_methods=["*"], allow_headers=["*"])

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
        policy_bytes = await policy.read()
        case_bytes   = await case_file.read()

        client = anthropic.Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY"))

        prompt = f"""Cross-examine these two insurance documents and return a JSON analysis.
{f'Additional context: {context}' if context else ''}

Return ONLY valid JSON — no markdown fences, no commentary. Use this exact schema:
{{
  "verdict": "covered" | "not_covered" | "partial" | "unclear",
  "coverage_limit": "string or null",
  "deductible": "string or null",
  "summary": "2-3 sentence overview of the cross-examination",
  "key_findings": [
    {{ "type": "success|warning|danger|info", "title": "short title", "detail": "explanation" }}
  ],
  "coverage_items": [
    {{ "item": "coverage area", "status": "covered|excluded|partial|unclear", "note": "clause or reasoning" }}
  ],
  "conflicts": [
    {{ "type": "gap|conflict|exclusion|ambiguity", "title": "short title", "detail": "explanation" }}
  ],
  "recommendation": "one clear actionable next step"
}}"""

        message = client.messages.create(
            model="claude-sonnet-4-5",
            max_tokens=2000,
            system="You are an expert insurance claims analyst. Return only valid JSON, never markdown.",
            messages=[{
                "role": "user",
                "content": [
                    {
                        "type": "document",
                        "source": {
                            "type": "base64",
                            "media_type": "application/pdf",
                            "data": __import__('base64').b64encode(policy_bytes).decode()
                        },
                        "title": "Insurance Policy"
                    },
                    {
                        "type": "document",
                        "source": {
                            "type": "base64",
                            "media_type": "application/pdf",
                            "data": __import__('base64').b64encode(case_bytes).decode()
                        },
                        "title": "Case File"
                    },
                    {
                        "type": "text",
                        "text": prompt
                    }
                ]
            }]
        )

        import json
        raw = message.content[0].text
        clean = raw.replace("```json", "").replace("```", "").strip()
        return json.loads(clean)

    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e), "type": type(e).__name__})

app.mount("/", StaticFiles(directory=".", html=True), name="static")