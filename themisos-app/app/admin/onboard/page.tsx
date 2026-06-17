'use client';

import { useMemo, useState } from 'react';

/**
 * ThemisOS — internal admin onboarding form
 * Drop in at: app/admin/onboard/page.tsx
 *
 * Fires POST /onboard-firm on the backend. With org-creation folded into the
 * endpoint, no organization_id is sent — firm name + owner + seats + tier is
 * enough for the endpoint to create the org, build the Stripe checkout, and send
 * the branded activation email in one call.
 *
 * ASSUMPTIONS (confirm against onboarding.py request model, then tweak if needed):
 *   - API base: NEXT_PUBLIC_API_BASE, falling back to https://app.themisos.ai
 *   - Request keys: firm_name, owner_name, owner_email, seats, tier, coupon
 *   - tier value is the case cap as a string: "20" or "50"
 *   - Response: { checkout_url, monthly_total, discount_applied, emailed }
 *   - This page lives under your existing /admin gate (no auth added here)
 */

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE?.replace(/\/$/, '') || 'https://app.themisos.ai';

// Source of truth = the Stripe size coupons (percentage off, forever).
// Preview math mirrors what Stripe will actually bill.
const BANDS = [
  { min: 1, max: 4, pct: 0, label: '1–4 seats', coupon: null },
  { min: 5, max: 9, pct: 6, label: '5–9 seats', coupon: 'SIZE_5_9' },
  { min: 10, max: 19, pct: 10, label: '10–19 seats', coupon: 'SIZE_10_19' },
  { min: 20, max: 49, pct: 16, label: '20–49 seats', coupon: 'SIZE_20_49' },
  { min: 50, max: Infinity, pct: 22, label: '50+ seats', coupon: 'SIZE_50' },
];

// Manual discount overrides. These REPLACE the size band (Stripe allows one
// coupon per subscription). value must match the Stripe coupon ID exactly.
const DISCOUNTS = [
  { value: '', label: 'None — standard size pricing', coupon: null, pct: 0 },
  { value: 'INTERNAL_100', label: 'Internal — 100% off (free)', coupon: 'INTERNAL_100', pct: 100 },
  { value: 'MARKETING_5', label: 'Marketing partner — 5% off', coupon: 'MARKETING_5', pct: 5 },
];

const TIERS = [
  { value: '20', base: 50, label: '20 cases / mo — $50 per seat' },
  { value: '50', base: 100, label: '50 cases / mo — $100 per seat' },
];

function bandFor(seats: number) {
  return BANDS.find((b) => seats >= b.min && seats <= b.max) ?? BANDS[0];
}

const usd = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);

type Result = {
  checkout_url?: string;
  monthly_total?: number | string;
  discount_applied?: boolean | string;
  emailed?: boolean;
};

export default function OnboardFirmPage() {
  const [firmName, setFirmName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [seats, setSeats] = useState(5);
  const [tier, setTier] = useState('20');
  const [discount, setDiscount] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [copied, setCopied] = useState(false);

  const preview = useMemo(() => {
    const s = Number.isFinite(seats) && seats > 0 ? seats : 0;
    const base = TIERS.find((t) => t.value === tier)?.base ?? 50;
    const band = bandFor(s || 1);
    const override = DISCOUNTS.find((d) => d.value === discount) ?? DISCOUNTS[0];
    const usingOverride = !!override.coupon;
    const pct = usingOverride ? override.pct : band.pct;
    const effectiveCoupon = usingOverride ? override.coupon : band.coupon;
    const perSeat = base * (1 - pct / 100);
    return { band, override, usingOverride, pct, effectiveCoupon, perSeat, monthly: perSeat * s, full: base };
  }, [seats, tier, discount]);

  const canSubmit =
    firmName.trim() && ownerName.trim() && ownerEmail.trim() && seats >= 1 && !submitting;

  async function onboard() {
    setError(null);
    setResult(null);
    setCopied(false);

    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(ownerEmail.trim())) {
      setError('That owner email doesn’t look right. Check it before sending the invite.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/onboard-firm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firm_name: firmName.trim(),
          owner_name: ownerName.trim(),
          owner_email: ownerEmail.trim(),
          seats,
          tier,
          coupon: discount || null,
          // organization_id intentionally omitted — endpoint creates the org.
        }),
      });

      const text = await res.text();
      let data: Result = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        // non-JSON body
      }

      if (!res.ok) {
        throw new Error(
          (data as { detail?: string }).detail ||
            text ||
            `Onboarding failed (${res.status}).`
        );
      }
      setResult(data);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : 'Something went wrong reaching the backend. Try again.'
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function copyLink() {
    if (!result?.checkout_url) return;
    try {
      await navigator.clipboard.writeText(result.checkout_url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard blocked — link is still visible to copy manually */
    }
  }

  return (
    <main className="onb">
      <style>{css}</style>

      <header className="onb__head">
        <span className="onb__eyebrow">ThemisOS · Admin</span>
        <h1 className="onb__title">Onboard a firm</h1>
        <p className="onb__sub">
          Set the plan per the engagement. One click creates the firm, builds the Stripe
          checkout, and sends the branded activation email.
        </p>
      </header>

      <div className="onb__grid">
        <section className="onb__panel" aria-label="Firm details">
          <label className="onb__field">
            <span className="onb__label">Firm name</span>
            <input
              className="onb__input"
              value={firmName}
              onChange={(e) => setFirmName(e.target.value)}
              placeholder="Harlan & Reyes LLP"
              autoComplete="off"
            />
          </label>

          <label className="onb__field">
            <span className="onb__label">Billing owner — name</span>
            <input
              className="onb__input"
              value={ownerName}
              onChange={(e) => setOwnerName(e.target.value)}
              placeholder="Dana Reyes"
              autoComplete="off"
            />
          </label>

          <label className="onb__field">
            <span className="onb__label">Billing owner — email</span>
            <input
              className="onb__input"
              type="email"
              value={ownerEmail}
              onChange={(e) => setOwnerEmail(e.target.value)}
              placeholder="dana@harlanreyes.com"
              autoComplete="off"
            />
          </label>

          <div className="onb__row">
            <label className="onb__field onb__field--seats">
              <span className="onb__label">Seats</span>
              <input
                className="onb__input"
                type="number"
                min={1}
                value={seats}
                onChange={(e) => setSeats(Math.max(1, parseInt(e.target.value || '1', 10)))}
              />
            </label>

            <label className="onb__field onb__field--tier">
              <span className="onb__label">Tier</span>
              <select
                className="onb__input onb__select"
                value={tier}
                onChange={(e) => setTier(e.target.value)}
              >
                {TIERS.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="onb__field">
            <span className="onb__label">Discount (optional)</span>
            <select
              className="onb__input onb__select"
              value={discount}
              onChange={(e) => setDiscount(e.target.value)}
            >
              {DISCOUNTS.map((d) => (
                <option key={d.value || 'none'} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
          </label>

          <button className="onb__cta" onClick={onboard} disabled={!canSubmit}>
            {submitting ? 'Onboarding…' : 'Onboard firm'}
          </button>

          {error && (
            <p className="onb__error" role="alert">
              {error}
            </p>
          )}
        </section>

        <aside className="onb__panel onb__preview" aria-label="Pricing preview">
          <span className="onb__previewTag">Estimate</span>
          <div className="onb__previewBig">
            {usd(preview.perSeat)}
            <span className="onb__previewUnit"> / seat · mo</span>
          </div>

          <dl className="onb__stats">
            <div>
              <dt>Discount</dt>
              <dd>
                {preview.usingOverride
                  ? preview.override.label
                  : preview.band.pct > 0
                  ? `${preview.band.label} · ${preview.band.pct}% off`
                  : 'None'}
              </dd>
            </div>
            <div>
              <dt>Full rate</dt>
              <dd>
                {usd(preview.full)} / seat
                {preview.effectiveCoupon ? ` · coupon ${preview.effectiveCoupon}` : ''}
              </dd>
            </div>
            <div>
              <dt>Monthly total</dt>
              <dd className="onb__total">{usd(preview.monthly)}</dd>
            </div>
          </dl>

          <p className="onb__note">
            {preview.usingOverride
              ? 'A chosen discount replaces the automatic size coupon — Stripe allows one coupon per subscription. The charged amount in Stripe is the source of truth.'
              : 'Stripe applies the size coupon, so the charged amount is the source of truth. This mirrors that math.'}
          </p>
        </aside>
      </div>

      {result && (
        <section className="onb__result" aria-live="polite">
          <h2 className="onb__resultTitle">Firm onboarded</h2>
          <div className="onb__resultStats">
            <div>
              <span className="onb__rk">Monthly total</span>
              <span className="onb__rv">
                {typeof result.monthly_total === 'number'
                  ? usd(result.monthly_total)
                  : result.monthly_total ?? '—'}
              </span>
            </div>
            <div>
              <span className="onb__rk">Discount</span>
              <span className="onb__rv">
                {String(result.discount_applied) === 'true' || result.discount_applied === true
                  ? 'Applied'
                  : 'None'}
              </span>
            </div>
            <div>
              <span className="onb__rk">Activation email</span>
              <span className="onb__rv">{result.emailed ? 'Sent' : 'Not sent'}</span>
            </div>
          </div>

          {result.checkout_url && (
            <div className="onb__link">
              <code className="onb__url">{result.checkout_url}</code>
              <div className="onb__linkBtns">
                <button className="onb__ghost" onClick={copyLink}>
                  {copied ? 'Copied' : 'Copy link'}
                </button>
                <a
                  className="onb__ghost"
                  href={result.checkout_url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Open checkout
                </a>
              </div>
            </div>
          )}
        </section>
      )}
    </main>
  );
}

const css = `
.onb {
  --bg: #0d0f12;
  --panel: #14171b;
  --line: #23262b;
  --gold: #C9962B;
  --ink: #e7e3da;
  --mut: #8a8f98;
  min-height: 100%;
  max-width: 920px;
  margin: 0 auto;
  padding: 56px 24px 96px;
  color: var(--ink);
  background: var(--bg);
  font-family: Georgia, 'Times New Roman', serif;
}
.onb__head { margin-bottom: 32px; }
.onb__eyebrow {
  font-family: Georgia, serif;
  font-size: 12px;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: var(--gold);
}
.onb__title {
  font-family: 'Cormorant Garamond', Georgia, serif;
  font-weight: 600;
  font-size: 44px;
  line-height: 1.05;
  margin: 10px 0 8px;
}
.onb__sub { color: var(--mut); font-size: 16px; max-width: 56ch; margin: 0; }

.onb__grid {
  display: grid;
  grid-template-columns: 1.5fr 1fr;
  gap: 20px;
  align-items: start;
}
.onb__panel {
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 4px;
  padding: 24px;
}

.onb__field { display: block; margin-bottom: 18px; }
.onb__label {
  display: block;
  font-size: 12px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--mut);
  margin-bottom: 8px;
}
.onb__input {
  width: 100%;
  box-sizing: border-box;
  background: var(--bg);
  border: 1px solid var(--line);
  border-radius: 3px;
  color: var(--ink);
  font-family: Georgia, serif;
  font-size: 16px;
  padding: 12px 14px;
  outline: none;
  transition: border-color 0.15s ease;
}
.onb__input::placeholder { color: #565a62; }
.onb__input:focus { border-color: var(--gold); }
.onb__select { appearance: none; cursor: pointer; }

.onb__row { display: flex; gap: 16px; }
.onb__field--seats { flex: 0 0 120px; }
.onb__field--tier { flex: 1; }

.onb__cta {
  width: 100%;
  margin-top: 6px;
  background: var(--gold);
  color: #1a1206;
  border: none;
  border-radius: 3px;
  font-family: 'Cormorant Garamond', Georgia, serif;
  font-weight: 600;
  font-size: 18px;
  letter-spacing: 0.02em;
  padding: 14px;
  cursor: pointer;
  transition: filter 0.15s ease;
}
.onb__cta:hover:not(:disabled) { filter: brightness(1.08); }
.onb__cta:disabled { opacity: 0.4; cursor: not-allowed; }

.onb__error {
  margin: 14px 0 0;
  color: #e0826f;
  font-size: 14px;
}

.onb__preview { display: flex; flex-direction: column; }
.onb__previewTag {
  font-size: 11px;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--mut);
}
.onb__previewBig {
  font-family: 'Cormorant Garamond', Georgia, serif;
  font-size: 40px;
  font-weight: 600;
  color: var(--gold);
  margin: 8px 0 18px;
  line-height: 1;
}
.onb__previewUnit { font-size: 15px; color: var(--mut); font-family: Georgia, serif; }

.onb__stats { margin: 0; display: grid; gap: 12px; }
.onb__stats div { display: flex; justify-content: space-between; gap: 12px; border-bottom: 1px solid var(--line); padding-bottom: 12px; }
.onb__stats div:last-child { border-bottom: none; padding-bottom: 0; }
.onb__stats dt { color: var(--mut); font-size: 14px; }
.onb__stats dd { margin: 0; font-size: 14px; text-align: right; }
.onb__total { color: var(--gold); font-weight: 600; }

.onb__note { color: var(--mut); font-size: 12.5px; line-height: 1.5; margin: 18px 0 0; }

.onb__result {
  margin-top: 24px;
  background: var(--panel);
  border: 1px solid var(--gold);
  border-radius: 4px;
  padding: 24px;
}
.onb__resultTitle {
  font-family: 'Cormorant Garamond', Georgia, serif;
  font-size: 26px;
  font-weight: 600;
  margin: 0 0 18px;
  color: var(--gold);
}
.onb__resultStats { display: flex; flex-wrap: wrap; gap: 28px; margin-bottom: 20px; }
.onb__rk { display: block; color: var(--mut); font-size: 12px; letter-spacing: 0.12em; text-transform: uppercase; margin-bottom: 6px; }
.onb__rv { font-size: 18px; }

.onb__link { border-top: 1px solid var(--line); padding-top: 18px; }
.onb__url {
  display: block;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12.5px;
  color: var(--ink);
  background: var(--bg);
  border: 1px solid var(--line);
  border-radius: 3px;
  padding: 10px 12px;
  word-break: break-all;
  margin-bottom: 12px;
}
.onb__linkBtns { display: flex; gap: 10px; }
.onb__ghost {
  background: transparent;
  border: 1px solid var(--gold);
  color: var(--gold);
  border-radius: 3px;
  font-family: Georgia, serif;
  font-size: 14px;
  padding: 8px 16px;
  cursor: pointer;
  text-decoration: none;
  display: inline-block;
  transition: background 0.15s ease;
}
.onb__ghost:hover { background: rgba(201, 150, 43, 0.12); }

@media (max-width: 680px) {
  .onb { padding: 40px 18px 72px; }
  .onb__title { font-size: 34px; }
  .onb__grid { grid-template-columns: 1fr; }
}

@media (prefers-reduced-motion: reduce) {
  .onb__input, .onb__cta, .onb__ghost { transition: none; }
}
`;