"""
ThemisOS — onboarding.py
Firm onboarding: branded activation email + one-shot "onboard firm" command.

Endpoints:
  POST /send-activation-email   -> sends the branded activation email (manual checkout_url)
  POST /onboard-firm            -> picks tier+price, applies firm-size discount, creates the
                                   Stripe checkout, and emails the branded activation link.
                                   One call does the whole thing.

Env vars:
  SENDGRID_API_KEY
  STRIPE_SECRET_KEY
  STRIPE_PRICE_ID        the $50 / 20-case price (used as the 20-case price)
  STRIPE_PRICE_20CASE    optional override for the 20-case price
  STRIPE_PRICE_50CASE    the $100 / 50-case price   <-- add this in Railway

Firm-size discount coupons (create these in Stripe with these exact IDs for discounts to apply):
  SIZE_5_9 = 6%,  SIZE_10_19 = 10%,  SIZE_20_49 = 16%,  SIZE_50 = 22%
  (1-4 seats: no discount. If a coupon is missing, onboarding still works — it just skips the %.)
"""

import os

import httpx
import stripe
from fastapi import APIRouter
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional

# reuse the Supabase helpers already defined in billing.py
from billing import _get_org, _patch_org

router = APIRouter()

stripe.api_key = os.environ.get("STRIPE_SECRET_KEY")
FROM_EMAIL = "noreply@themisos.ai"
PLATFORM_URL = "https://platform.themisos.ai"

# tier -> display + base per-seat price (dollars)
TIER_META = {
    "20": {"label": "20 Cases / month", "rate": "$50",  "base": 50},
    "50": {"label": "50 Cases / month", "rate": "$100", "base": 100},
}


def _price_for_tier(tier: str) -> Optional[str]:
    if tier == "20":
        return os.environ.get("STRIPE_PRICE_20CASE") or os.environ.get("STRIPE_PRICE_ID")
    if tier == "50":
        return os.environ.get("STRIPE_PRICE_50CASE")
    return None


def _band_for_seats(seats: int):
    """Return (coupon_id, discount_pct, band_label) for a firm size."""
    if seats <= 4:
        return (None, 0, "1-4")
    if seats <= 9:
        return ("SIZE_5_9", 6, "5-9")
    if seats <= 19:
        return ("SIZE_10_19", 10, "10-19")
    if seats <= 49:
        return ("SIZE_20_49", 16, "20-49")
    return ("SIZE_50", 22, "50+")


async def _send_branded_email(to_email: str, subject: str, html: str):
    sendgrid_key = os.environ.get("SENDGRID_API_KEY")
    if not sendgrid_key:
        return False, "SENDGRID_API_KEY not set."
    async with httpx.AsyncClient() as client:
        res = await client.post(
            "https://api.sendgrid.com/v3/mail/send",
            headers={"Authorization": f"Bearer {sendgrid_key}", "Content-Type": "application/json"},
            json={
                "personalizations": [{"to": [{"email": to_email}]}],
                "from": {"email": FROM_EMAIL, "name": "ThemisOS"},
                "subject": subject,
                "content": [{"type": "text/html", "value": html}],
            },
        )
    if res.status_code in (200, 202):
        return True, None
    return False, res.text


# ─────────────────────────────────────────────────────────────────────────────
# Branded activation email
# ─────────────────────────────────────────────────────────────────────────────

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

    def rowf(label: str, value: str, gold: bool = False) -> str:
        color = "#C9962B" if gold else "#EDE6D0"
        weight = "600" if gold else "400"
        return (f'<tr><td style="color:#6E7D94;padding:5px 0">{label}</td>'
                f'<td style="color:{color};text-align:right;font-weight:{weight}">{value}</td></tr>')

    rows = rowf("Plan", req.plan_label)
    rows += rowf("Seats", f"{req.seats} attorneys")
    rows += rowf("Rate", f"{req.rate_per_seat} / seat / month")
    if req.discount_label:
        rows += rowf("Volume discount", req.discount_label)
    if req.monthly_total:
        rows += rowf("Monthly total", req.monthly_total, gold=True)

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
    html = build_activation_email_html(req)
    subject = f"Activate your ThemisOS workspace — {req.firm_name}"
    ok, err = await _send_branded_email(req.owner_email, subject, html)
    if ok:
        return JSONResponse(content={"success": True, "sent_to": req.owner_email})
    return JSONResponse(status_code=502, content={"error": "Email failed", "detail": err})


# ─────────────────────────────────────────────────────────────────────────────
# One-shot: onboard a firm (pick tier + discount, create checkout, email it)
# ─────────────────────────────────────────────────────────────────────────────

class OnboardFirmRequest(BaseModel):
    organization_id: str
    owner_email: str
    firm_name: str
    seats: int = 1
    tier: str = "20"               # "20" or "50"
    owner_name: Optional[str] = None
    send_email: bool = True        # set false to just get the checkout URL back


@router.post("/onboard-firm")
async def onboard_firm(req: OnboardFirmRequest):
    if req.tier not in TIER_META:
        return JSONResponse(status_code=400, content={"error": "tier must be '20' or '50'."})

    price_id = _price_for_tier(req.tier)
    if not stripe.api_key or not price_id:
        return JSONResponse(status_code=500,
                            content={"error": f"Stripe price for tier {req.tier} not configured."})

    org = await _get_org(f"id=eq.{req.organization_id}")
    if not org:
        return JSONResponse(status_code=404, content={"error": "Organization not found."})

    seats = max(1, int(req.seats or 1))
    coupon_id, pct, band = _band_for_seats(seats)
    meta = TIER_META[req.tier]

    # compute the monthly total exactly as Stripe will charge it
    total = meta["base"] * seats * (100 - pct) / 100
    monthly_total = f"${total:,.2f}"
    discount_label = f"-{pct}% (firm size {band})" if pct else None

    try:
        # reuse or create the firm's Stripe customer
        customer_id = org.get("stripe_customer_id")
        if not customer_id:
            customer = stripe.Customer.create(
                email=req.owner_email,
                name=req.firm_name or None,
                metadata={"organization_id": req.organization_id},
            )
            customer_id = customer.id
            await _patch_org(req.organization_id, {"stripe_customer_id": customer_id})

        base_args = dict(
            mode="subscription",
            customer=customer_id,
            line_items=[{"price": price_id, "quantity": seats}],
            subscription_data={"metadata": {"organization_id": req.organization_id}},
            metadata={"organization_id": req.organization_id},
            success_url=f"{PLATFORM_URL}/billing/success?session_id={{CHECKOUT_SESSION_ID}}",
            cancel_url=f"{PLATFORM_URL}/billing/cancelled",
        )

        discount_applied = False
        try:
            if coupon_id:
                session = stripe.checkout.Session.create(
                    **base_args, discounts=[{"coupon": coupon_id}]
                )
                discount_applied = True
            else:
                session = stripe.checkout.Session.create(
                    **base_args, allow_promotion_codes=True
                )
        except stripe.error.InvalidRequestError:
            # coupon doesn't exist yet — fall back to no discount so onboarding still works
            session = stripe.checkout.Session.create(
                **base_args, allow_promotion_codes=True
            )
            total = meta["base"] * seats
            monthly_total = f"${total:,.2f}"
            discount_label = None

    except stripe.error.StripeError as e:
        return JSONResponse(status_code=502, content={"error": str(e)})
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e), "type": type(e).__name__})

    emailed = False
    email_error = None
    if req.send_email:
        html = build_activation_email_html(ActivationEmailRequest(
            owner_email=req.owner_email,
            firm_name=req.firm_name,
            checkout_url=session.url,
            seats=seats,
            plan_label=meta["label"],
            rate_per_seat=meta["rate"],
            discount_label=discount_label,
            monthly_total=monthly_total,
            owner_name=req.owner_name,
        ))
        subject = f"Activate your ThemisOS workspace — {req.firm_name}"
        emailed, email_error = await _send_branded_email(req.owner_email, subject, html)

    return JSONResponse(content={
        "success": True,
        "checkout_url": session.url,
        "tier": req.tier,
        "seats": seats,
        "discount_band": band,
        "discount_applied": discount_applied,
        "monthly_total": monthly_total,
        "emailed": emailed,
        "email_error": email_error,
    })