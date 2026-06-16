"""
ThemisOS — onboarding.py
Branded firm activation email (SendGrid).
"""

import os

import httpx
from fastapi import APIRouter
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional

router = APIRouter()

FROM_EMAIL = "noreply@themisos.ai"


class ActivationEmailRequest(BaseModel):
    owner_email: str
    firm_name: str
    checkout_url: str
    seats: int = 1
    plan_label: str = "20 Cases / month"
    rate_per_seat: str = "$50"
    discount_label: Optional[str] = None
    monthly_total: str = ""
    owner_name: Optional[str] = None


def build_activation_email_html(req: ActivationEmailRequest) -> str:
    greeting_name = req.owner_name or "there"

    def row(label: str, value: str, gold: bool = False) -> str:
        color = "#C9962B" if gold else "#EDE6D0"
        weight = "600" if gold else "400"
        return (f'<tr><td style="color:#6E7D94;padding:5px 0">{label}</td>'
                f'<td style="color:{color};text-align:right;font-weight:{weight}">{value}</td></tr>')

    rows = row("Plan", req.plan_label)
    rows += row("Seats", f"{req.seats} attorneys")
    rows += row("Rate", f"{req.rate_per_seat} / seat / month")
    if req.discount_label:
        rows += row("Volume discount", req.discount_label)
    if req.monthly_total:
        rows += row("Monthly total", req.monthly_total, gold=True)

    return f"""
    <div style="background:#f4f4f0;padding:32px 20px;font-family:Arial,sans-serif">
      <div style="max-width:480px;margin:0 auto;background:#0a0f1e;border-radius:8px;overflow:hidden">
        <div style="background:#05090F;padding:24px 32px;border-bottom:1px solid #1A2E4A;text-align:center">
          <div style="font-size:20px;font-weight:600;color:#fff;font-family:Georgia,serif">
            Themis<span style="color:#C9962B">OS</span>
          </div>
        </div>
        <div style="padding:32px">
          <div style="font-size:11px;letter-spacing:0.15em;text-transform:uppercase;color:#C9962B;margin-bottom:12px">
            Workspace activation
          </div>
          <h2 style="font-size:22px;font-weight:400;color:#fff;margin:0 0 8px;font-family:Georgia,serif">
            Your <em style="color:#C9962B">{req.firm_name}</em> workspace is ready
          </h2>
          <p style="font-size:14px;color:#9AA7B8;line-height:1.6;margin:0 0 24px">
            Hi {greeting_name}, your firm's ThemisOS workspace is provisioned. Review the plan below
            and activate to bring it online.
          </p>
          <div style="background:#111827;border:1px solid #1A2E4A;border-radius:4px;padding:16px 20px;margin-bottom:24px">
            <table style="width:100%;font-size:13px;font-family:Arial,sans-serif">
              {rows}
            </table>
          </div>
          <div style="text-align:center;margin-bottom:24px">
            <a href="{req.checkout_url}" style="display:inline-block;background:#C9962B;color:#05090F;padding:13px 30px;border-radius:2px;font-size:12px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;text-decoration:none">
              Activate &amp; add payment &rarr;
            </a>
          </div>
          <p style="font-size:12px;color:#6E7D94;line-height:1.6;margin:0">
            As the billing owner, you're the only person who pays. After activating, you can invite
            your attorneys and they'll join the workspace at no additional cost, up to your seat count.
            Billing runs monthly through Stripe, and you'll receive a receipt automatically each cycle.
          </p>
        </div>
      </div>
    </div>
    """


@router.post("/send-activation-email")
async def send_activation_email(req: ActivationEmailRequest):
    sendgrid_key = os.environ.get("SENDGRID_API_KEY")
    if not sendgrid_key:
        return JSONResponse(status_code=500, content={"error": "SENDGRID_API_KEY not set."})

    html = build_activation_email_html(req)
    subject = f"Activate your ThemisOS workspace — {req.firm_name}"

    try:
        async with httpx.AsyncClient() as client:
            res = await client.post(
                "https://api.sendgrid.com/v3/mail/send",
                headers={
                    "Authorization": f"Bearer {sendgrid_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "personalizations": [{"to": [{"email": req.owner_email}]}],
                    "from": {"email": FROM_EMAIL, "name": "ThemisOS"},
                    "subject": subject,
                    "content": [{"type": "text/html", "value": html}],
                },
            )
        if res.status_code in (200, 202):
            return JSONResponse(content={"success": True, "sent_to": req.owner_email})
        return JSONResponse(status_code=502,
                            content={"error": "SendGrid rejected the send", "detail": res.text})
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e), "type": type(e).__name__})
