"""
ThemisOS — billing.py
Firm-level Stripe billing: one billing owner pays, the whole firm (organization) inherits access.

Drop this file next to main.py and wire it in (see INTEGRATION at the bottom).
It reuses the same async-httpx + service-role pattern as track_analysis() in main.py.

Endpoints:
  POST /create-checkout-session   -> returns a Stripe Checkout URL for a firm to pay
  POST /stripe-webhook            -> Stripe calls this; flips organizations.subscription_status

Env vars required (set in Railway):
  STRIPE_SECRET_KEY        sk_live_... / sk_test_...
  STRIPE_WEBHOOK_SECRET    whsec_...           (from the Stripe webhook you create)
  STRIPE_PRICE_ID          price_...           (your $47/mo recurring per-seat price)
  SUPABASE_URL             (already set)
  SUPABASE_SERVICE_ROLE_KEY(already set)
"""

import os
from datetime import datetime, timezone

import httpx
import stripe
from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel

router = APIRouter()

stripe.api_key = os.environ.get("STRIPE_SECRET_KEY")
WEBHOOK_SECRET = os.environ.get("STRIPE_WEBHOOK_SECRET")
PRICE_ID = os.environ.get("STRIPE_PRICE_ID")

PLATFORM_URL = "https://platform.themisos.ai"

# Stripe subscription.status -> our organizations.subscription_status check constraint.
# (Our allowed set: pending, trialing, active, past_due, canceled, incomplete, unpaid)
STATUS_MAP = {
    "active": "active",
    "trialing": "trialing",
    "past_due": "past_due",
    "unpaid": "unpaid",
    "canceled": "canceled",
    "incomplete": "incomplete",
    "incomplete_expired": "canceled",
    "paused": "past_due",
}


# ─────────────────────────────────────────────────────────────────────────────
# Supabase helpers (service role — same headers/pattern as main.py track_analysis)
# ─────────────────────────────────────────────────────────────────────────────

def _supabase():
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        return None, None
    headers = {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    }
    return url, headers


async def _get_org(filter_q: str) -> dict | None:
    """Fetch one organization row by a PostgREST filter, e.g. 'id=eq.<uuid>'."""
    url, headers = _supabase()
    if not url:
        return None
    async with httpx.AsyncClient() as client:
        res = await client.get(
            f"{url}/rest/v1/organizations?{filter_q}"
            f"&select=id,stripe_customer_id,seats_allowed,billing_owner_id",
            headers=headers,
        )
    rows = res.json() if res.status_code == 200 else []
    return rows[0] if rows else None


async def _patch_org(org_id: str, fields: dict) -> None:
    url, headers = _supabase()
    if not url:
        return
    async with httpx.AsyncClient() as client:
        await client.patch(
            f"{url}/rest/v1/organizations?id=eq.{org_id}",
            headers=headers,
            json=fields,
        )


def _iso(ts: int | None) -> str | None:
    if not ts:
        return None
    return datetime.fromtimestamp(ts, tz=timezone.utc).isoformat()


# ─────────────────────────────────────────────────────────────────────────────
# 1) Create a Checkout Session — generate the firm owner's payment link
# ─────────────────────────────────────────────────────────────────────────────

class CheckoutRequest(BaseModel):
    organization_id: str
    email: str                 # the billing owner's email
    seats: int = 1
    firm_name: str = ""


@router.post("/create-checkout-session")
async def create_checkout_session(req: CheckoutRequest):
    if not stripe.api_key or not PRICE_ID:
        return JSONResponse(status_code=500,
                            content={"error": "Stripe not configured (STRIPE_SECRET_KEY / STRIPE_PRICE_ID)."})

    org = await _get_org(f"id=eq.{req.organization_id}")
    if not org:
        return JSONResponse(status_code=404, content={"error": "Organization not found."})

    try:
        # Reuse the firm's Stripe customer if one exists, else create + persist it.
        customer_id = org.get("stripe_customer_id")
        if not customer_id:
            customer = stripe.Customer.create(
                email=req.email,
                name=req.firm_name or None,
                metadata={"organization_id": req.organization_id},
            )
            customer_id = customer.id
            await _patch_org(req.organization_id, {"stripe_customer_id": customer_id})

        seats = max(1, int(req.seats or org.get("seats_allowed") or 1))

        session = stripe.checkout.Session.create(
            mode="subscription",
            customer=customer_id,
            line_items=[{"price": PRICE_ID, "quantity": seats}],
            # organization_id rides on the subscription so EVERY future webhook
            # event (renewal, payment failure, cancel) can find the firm without a lookup.
            subscription_data={"metadata": {"organization_id": req.organization_id}},
            metadata={"organization_id": req.organization_id},
            allow_promotion_codes=True,
            success_url=f"{PLATFORM_URL}/billing/success?session_id={{CHECKOUT_SESSION_ID}}",
            cancel_url=f"{PLATFORM_URL}/billing/cancelled",
        )
        return JSONResponse(content={"url": session.url})

    except stripe.error.StripeError as e:
        return JSONResponse(status_code=502, content={"error": str(e)})
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e), "type": type(e).__name__})


# ─────────────────────────────────────────────────────────────────────────────
# 2) Webhook — Stripe is the source of truth; we mirror status into Supabase
# ─────────────────────────────────────────────────────────────────────────────

async def _apply_subscription(sub: dict) -> None:
    """Write a Stripe subscription object's state onto its organization row."""
    org_id = (sub.get("metadata") or {}).get("organization_id")

    item = (sub.get("items", {}).get("data") or [{}])[0]
    seats = item.get("quantity")
    sub_item_id = item.get("id")
    price = item.get("price") or {}
    price_id = price.get("id")
    case_cap = (price.get("metadata") or {}).get("case_cap")

    fields = {
        "stripe_subscription_id": sub.get("id"),
        "stripe_subscription_item_id": sub_item_id,
        "stripe_price_id": price_id,
        "subscription_status": STATUS_MAP.get(sub.get("status"), "incomplete"),
        "current_period_start": _iso(sub.get("current_period_start")),
        "current_period_end": _iso(sub.get("current_period_end")),
    }
    if seats:
        fields["seats_allowed"] = seats
    if case_cap is not None:
        try:
            fields["monthly_case_cap"] = int(case_cap)
        except (TypeError, ValueError):
            pass
    fields = {k: v for k, v in fields.items() if v is not None}

    if org_id:
        await _patch_org(org_id, fields)
    else:
        found = await _get_org(f"stripe_subscription_id=eq.{sub.get('id')}")
        if found:
            await _patch_org(found["id"], fields)


@router.post("/stripe-webhook")
async def stripe_webhook(request: Request):
    if not WEBHOOK_SECRET:
        return JSONResponse(status_code=500, content={"error": "STRIPE_WEBHOOK_SECRET not set."})

    payload = await request.body()
    sig = request.headers.get("stripe-signature")
    try:
        event = stripe.Webhook.construct_event(payload, sig, WEBHOOK_SECRET)
    except (ValueError, stripe.error.SignatureVerificationError):
        return JSONResponse(status_code=400, content={"error": "Invalid signature."})

    etype = event["type"]
    obj = event["data"]["object"]

    try:
        if etype == "checkout.session.completed":
            # First payment landed. The session points at the new subscription;
            # retrieve it for the full item/status/period data, then apply.
            sub_id = obj.get("subscription")
            org_id = (obj.get("metadata") or {}).get("organization_id")
            if sub_id:
                sub = stripe.Subscription.retrieve(sub_id)
                # ensure org_id is present even if it wasn't set on the subscription
                if org_id and not (sub.get("metadata") or {}).get("organization_id"):
                    sub["metadata"] = {**(sub.get("metadata") or {}), "organization_id": org_id}
                await _apply_subscription(sub)

        elif etype in ("customer.subscription.created",
                       "customer.subscription.updated"):
            await _apply_subscription(obj)

        elif etype == "customer.subscription.deleted":
            obj["status"] = "canceled"
            await _apply_subscription(obj)

        elif etype == "invoice.payment_failed":
            # Belt-and-suspenders: subscription.updated usually flips this too,
            # but mark past_due immediately so access restricts on the gate.
            sub_id = obj.get("subscription")
            if sub_id:
                found = await _get_org(f"stripe_subscription_id=eq.{sub_id}")
                if found:
                    await _patch_org(found["id"], {"subscription_status": "past_due"})

        # All other event types: acknowledged and ignored.
    except Exception as e:
        # Return 200 anyway on internal errors so Stripe doesn't hammer retries for a
        # bug on our side; log for inspection. (Signature failures already returned 400.)
        print(f"[stripe-webhook] handler error on {etype}: {e}")

    return JSONResponse(content={"received": True})


# ─────────────────────────────────────────────────────────────────────────────
# INTEGRATION — add to main.py
# ─────────────────────────────────────────────────────────────────────────────
# 1. requirements.txt:  add a line   ->   stripe
#
# 2. In main.py, near the top imports, add:
#        from billing import router as billing_router
#
# 3. IMPORTANT — add this line BEFORE the catch-all static mount at the bottom
#    of main.py (the `app.mount("/", StaticFiles(...))` line). Routes registered
#    after that mount get swallowed and 404. So:
#
#        app.include_router(billing_router)          # <-- add this
#        app.mount("/", StaticFiles(directory=".", html=True), name="static")
# ─────────────────────────────────────────────────────────────────────────────