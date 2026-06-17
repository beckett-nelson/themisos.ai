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
import json
from datetime import datetime, timezone

import httpx
import stripe
from fastapi import APIRouter, Request, Header
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


def _as_dict(obj) -> dict:
    """Normalize a Stripe SDK object (or anything) into a plain dict so dict-style
    .get() works regardless of the installed Stripe library version. Stripe
    StripeObjects no longer expose a real dict .get(), so calling .get() on them
    raises AttributeError('get'); convert first, then read."""
    if isinstance(obj, dict):
        return obj
    if hasattr(obj, "to_dict_recursive"):
        try:
            return obj.to_dict_recursive()
        except Exception:
            pass
    try:
        return json.loads(str(obj))
    except Exception:
        return {}


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
    """Write a Stripe subscription object's state onto its organization row.
    `sub` MUST be a plain dict (see _as_dict) — never a raw StripeObject."""
    org_id = (sub.get("metadata") or {}).get("organization_id")

    items = (sub.get("items") or {}).get("data") or []
    item = items[0] if items else {}
    seats = item.get("quantity")
    sub_item_id = item.get("id")
    price = item.get("price") or {}
    price_id = price.get("id")
    case_cap = (price.get("metadata") or {}).get("case_cap")

    # current_period_start/end moved from the subscription to the line item in
    # recent Stripe API versions (2025-03 basil onward). Read from the item, then
    # fall back to the subscription for older versions.
    period_start = item.get("current_period_start") or sub.get("current_period_start")
    period_end = item.get("current_period_end") or sub.get("current_period_end")

    fields = {
        "stripe_subscription_id": sub.get("id"),
        "stripe_subscription_item_id": sub_item_id,
        "stripe_price_id": price_id,
        "subscription_status": STATUS_MAP.get(sub.get("status"), "incomplete"),
        "current_period_start": _iso(period_start),
        "current_period_end": _iso(period_end),
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

    # Verify the signature for security...
    try:
        stripe.Webhook.construct_event(payload, sig, WEBHOOK_SECRET)
    except (ValueError, stripe.error.SignatureVerificationError):
        return JSONResponse(status_code=400, content={"error": "Invalid signature."})

    # ...then read the event from the raw JSON so every .get() below is a real
    # dict method, independent of the installed Stripe SDK's object wrappers.
    event = json.loads(payload)
    etype = event.get("type")
    obj = (event.get("data") or {}).get("object") or {}

    try:
        if etype == "checkout.session.completed":
            # First payment landed. The session only carries the subscription id;
            # retrieve the full subscription, normalize it to a dict, then apply.
            sub_id = obj.get("subscription")
            org_id = (obj.get("metadata") or {}).get("organization_id")
            if sub_id:
                sub = _as_dict(stripe.Subscription.retrieve(sub_id))
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
        # bug on our side; log the type + message for inspection.
        print(f"[stripe-webhook] handler error on {etype}: {type(e).__name__}: {e}")

    return JSONResponse(content={"received": True})


# ─────────────────────────────────────────────────────────────────────────────
# 3) Customer Portal — let a firm manage / cancel their own subscription
# ─────────────────────────────────────────────────────────────────────────────
# Returns a Stripe-hosted billing portal URL for the caller's firm. The frontend
# redirects to it; cancellations there flow back through the webhook above and
# flip subscription_status automatically. The caller is authenticated by their
# Supabase access token (Authorization: Bearer ...); only firm managers qualify.
#
# NOTE: enable the Customer Portal once in Stripe (Settings -> Billing -> Customer
# portal) or Session.create raises "No configuration provided".

_MANAGER_ROLES = {"owner", "billing_admin", "admin"}


async def _verify_user_id(client, authorization) -> str | None:
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not authorization or not authorization.lower().startswith("bearer "):
        return None
    token = authorization.split(" ", 1)[1].strip()
    if not token or not url or not key:
        return None
    r = await client.get(
        f"{url}/auth/v1/user",
        headers={"apikey": key, "Authorization": f"Bearer {token}"},
    )
    if r.status_code != 200:
        return None
    return (r.json() or {}).get("id")


async def _get_profile(client, user_id: str) -> dict | None:
    url, headers = _supabase()
    if not url:
        return None
    r = await client.get(
        f"{url}/rest/v1/profiles?id=eq.{user_id}&select=organization_id,role",
        headers=headers,
    )
    rows = r.json() if r.status_code == 200 else []
    return rows[0] if isinstance(rows, list) and rows else None


@router.post("/billing-portal")
async def billing_portal(authorization: str | None = Header(default=None)):
    if not stripe.api_key:
        return JSONResponse(status_code=500, content={"error": "Stripe not configured."})

    async with httpx.AsyncClient() as client:
        user_id = await _verify_user_id(client, authorization)
        if not user_id:
            return JSONResponse(status_code=401, content={"error": "Not authenticated."})

        profile = await _get_profile(client, user_id)
        if not profile or not profile.get("organization_id"):
            return JSONResponse(status_code=400, content={"error": "No firm is associated with this account."})
        if (profile.get("role") or "") not in _MANAGER_ROLES:
            return JSONResponse(status_code=403, content={"error": "Only a firm owner or manager can manage billing."})

        org = await _get_org(f"id=eq.{profile['organization_id']}")
        customer_id = (org or {}).get("stripe_customer_id")
        if not customer_id:
            return JSONResponse(status_code=400,
                                content={"error": "No billing account yet — activate your subscription first."})

    try:
        session = stripe.billing_portal.Session.create(
            customer=customer_id,
            return_url=f"{PLATFORM_URL}/dashboard",
        )
        return JSONResponse(content={"url": session.url})
    except stripe.error.StripeError as e:
        return JSONResponse(status_code=502, content={"error": str(e)})
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e), "type": type(e).__name__})


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