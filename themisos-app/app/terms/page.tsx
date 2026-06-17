export default function TermsPage() {
  const updated = "June 17, 2026"

  const heading = {
    fontFamily: "'Cormorant Garamond', serif",
    fontSize: "1.25rem",
    fontWeight: 600,
    color: "#ffffff",
    letterSpacing: "-0.01em",
    margin: "32px 0 10px",
  } as const

  const body = {
    fontFamily: "Georgia, serif",
    fontSize: "14px",
    color: "#9A927E",
    lineHeight: 1.8,
    margin: "0 0 12px",
  } as const

  const label = {
    color: "#C9962B",
    fontFamily: "'Syne', sans-serif",
    fontWeight: 700,
    fontStyle: "normal" as const,
  }

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#05090F", color: "#EDE6D0", fontFamily: "'Syne', sans-serif", fontSize: "14px", display: "flex", flexDirection: "column" }}>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;0,700;1,400;1,600&family=Syne:wght@400;500;600;700&display=swap');
        a.inline-link { color: #C9962B; text-decoration: none; }
        a.inline-link:hover { text-decoration: underline; }
      `}</style>

      {/* ── NAV ── */}
      <header style={{ padding: "0 32px", borderBottom: "1px solid #1A2E4A", display: "flex", alignItems: "center", backgroundColor: "#05090F", position: "sticky", top: 0, zIndex: 100, height: "56px" }}>
        <a href="/dashboard" style={{ display: "flex", alignItems: "center", gap: "10px", textDecoration: "none", paddingRight: "24px", borderRight: "1px solid #1A2E4A", marginRight: "24px", height: "100%" }}>
          <svg viewBox="0 0 64 64" fill="none" style={{ width: "22px", height: "22px", flexShrink: 0 }}>
            <rect x="30" y="8" width="4" height="44" rx="2" fill="#C9962B"/>
            <rect x="20" y="50" width="24" height="2.5" rx="1.25" fill="#C9962B"/>
            <circle cx="32" cy="8" r="3.5" fill="#C9962B"/>
            <rect x="8" y="20" width="48" height="2" rx="1" fill="#C9962B"/>
            <line x1="12" y1="22" x2="12" y2="31" stroke="#C9962B" strokeWidth="1.5"/>
            <line x1="52" y1="22" x2="52" y2="31" stroke="#C9962B" strokeWidth="1.5"/>
            <path d="M6 31 Q12 36 18 31" stroke="#C9962B" strokeWidth="2" fill="none"/>
            <path d="M46 31 Q52 36 58 31" stroke="#C9962B" strokeWidth="2" fill="none"/>
          </svg>
          <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "1.25rem", fontWeight: 600, letterSpacing: "0.01em", color: "#ffffff", lineHeight: 1 }}>
            Themis<span style={{ color: "#C9962B" }}>OS</span>
          </span>
        </a>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "20px" }}>
          <a href="/support" style={{ fontSize: "11px", color: "#6E7D94", textDecoration: "none", letterSpacing: "0.06em", textTransform: "uppercase" }}>Support</a>
          <a href="/dashboard" style={{ fontSize: "11px", color: "#6E7D94", textDecoration: "none", letterSpacing: "0.06em", textTransform: "uppercase" }}>Dashboard</a>
        </div>
      </header>

      {/* ── TITLE STRIP ── */}
      <div style={{ borderBottom: "1px solid #1A2E4A", backgroundColor: "#05090F", padding: "1.25rem 32px" }}>
        <div style={{ maxWidth: "760px", margin: "0 auto" }}>
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "0.625rem", letterSpacing: "0.14em", textTransform: "uppercase", color: "#C9962B", marginBottom: "0.3rem", display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ display: "inline-block", width: "20px", height: "1px", background: "#C9962B", opacity: 0.6 }}></span>
            Legal
          </div>
          <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "1.625rem", fontWeight: 600, color: "#ffffff", letterSpacing: "-0.01em", lineHeight: 1.1, margin: 0 }}>
            Terms of Service
          </h1>
        </div>
      </div>

      {/* ── CONTENT ── */}
      <main style={{ padding: "36px 32px", maxWidth: "760px", margin: "0 auto", width: "100%", boxSizing: "border-box", flex: 1 }}>

        <p style={{ ...body, fontStyle: "italic", color: "#6E7D94", marginBottom: "8px" }}>Last updated: {updated}</p>
        <p style={body}>
          These Terms of Service (&ldquo;Terms&rdquo;) govern your access to and use of the ThemisOS platform,
          operated by <strong style={{ color: "#EDE6D0", fontWeight: 600 }}>ThemisOS LLC</strong>, a Montana limited
          liability company (&ldquo;ThemisOS,&rdquo; &ldquo;we,&rdquo; &ldquo;us&rdquo;). By accessing or using the
          platform, you agree to these Terms on behalf of yourself and the firm you represent.
        </p>

        <div style={{ background: "#0d1526", border: "1px solid #1A2E4A", borderLeft: "3px solid #C9962B", borderRadius: "0 3px 3px 0", padding: "14px 18px", margin: "20px 0" }}>
          <p style={{ ...body, margin: 0, fontStyle: "italic" }}>
            <span style={label}>Important — Not Legal Advice.</span> ThemisOS is a software tool that
            supports attorney judgment. It does not provide legal advice, does not practice law, and using
            it does not create an attorney-client relationship between you and ThemisOS. You, the licensed
            attorney, remain solely responsible for all professional judgments and work product.
          </p>
        </div>

        <h2 style={heading}>1. Who may use ThemisOS</h2>
        <p style={body}>
          ThemisOS is offered as a boutique, invite-only managed service to law firms and legal
          professionals. Access is provisioned by ThemisOS as part of a negotiated engagement. You must be
          a licensed attorney, or authorized firm personnel acting under the supervision of one, and you
          must be at least 18 years old and able to form a binding contract on behalf of your firm.
        </p>

        <h2 style={heading}>2. Workspaces, accounts, and seats</h2>
        <p style={body}>
          Each firm subscribes as a single unit. One billing owner pays at the firm level, and each
          attorney granted access is a &ldquo;seat&rdquo; within the firm&rsquo;s workspace. You are responsible for
          maintaining the confidentiality of your credentials and for all activity that occurs under your
          account. Notify us promptly at <a className="inline-link" href="mailto:legal@themisos.ai">legal@themisos.ai</a> if
          you suspect unauthorized use.
        </p>

        <h2 style={heading}>3. Subscription, pricing, and billing</h2>
        <p style={body}>
          ThemisOS is provided as a per-seat subscription billed at the firm level. Each firm selects a
          monthly case-volume tier, and the per-seat rate scales with firm size. The case-volume cap is
          shared firm-wide across all seats, resets each billing cycle, and counts matters opened rather
          than individual analyses run. Your specific tier, seat count, and rate are set as part of your
          engagement.
        </p>
        <p style={body}>
          Current per-seat monthly rates (set during onboarding):
        </p>
        <div style={{ background: "#0A1220", border: "1px solid #1A2E4A", borderRadius: "3px", overflow: "hidden", margin: "0 0 16px" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #1A2E4A" }}>
                {["Firm Size", "20 Cases / mo", "50 Cases / mo", "Discount"].map(h => (
                  <th key={h} style={{ padding: "10px 16px", textAlign: "left", fontSize: "10px", color: "#6E7D94", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", fontFamily: "'Syne', sans-serif" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                ["1–4", "$50", "$100", "—"],
                ["5–9", "$47", "$94", "6%"],
                ["10–19", "$45", "$90", "10%"],
                ["20–49", "$42", "$82", "16%"],
                ["50+", "$39", "$78", "22%"],
              ].map((row, i) => (
                <tr key={i} style={{ borderBottom: i < 4 ? "1px solid #1A2E4A" : "none" }}>
                  {row.map((cell, j) => (
                    <td key={j} style={{ padding: "11px 16px", fontSize: "13px", color: j === 0 ? "#EDE6D0" : "#9A927E", fontFamily: j === 0 ? "'Cormorant Garamond', serif" : "'Syne', sans-serif", fontWeight: j === 0 ? 600 : 400 }}>{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p style={body}>
          Subscription fees are billed and processed through Stripe. Payment card data is collected and
          handled solely by Stripe and never reaches ThemisOS servers. You authorize recurring charges to
          your payment method for the applicable subscription period.
        </p>

        <h2 style={heading}>4. Cancellation and refunds</h2>
        <p style={body}>
          You may cancel your subscription at any time through the billing portal managed by Stripe.
          Cancellation takes effect at the end of your current subscription month, and you retain access
          through that period. Fees already paid are non-refundable except where a refund is required by
          law.
        </p>

        <h2 style={heading}>5. Your documents and content</h2>
        <p style={body}>
          You retain all rights to the documents and content you upload. You grant ThemisOS a limited
          license to process that content solely to provide the analysis you request. You represent that
          you have the right to upload each document and to have it processed as described in our{" "}
          <a className="inline-link" href="/privacy">Privacy Policy</a>. Details on how documents are
          processed, by which subprocessors, and for how long are set out there.
        </p>

        <h2 style={heading}>6. Acceptable use</h2>
        <p style={body}>
          You agree not to misuse the platform, including by: uploading content you lack the right to
          submit; attempting to reverse-engineer, scrape, or disrupt the service; reselling or sublicensing
          access; or using ThemisOS to provide a competing service. You are responsible for ensuring your
          use complies with your professional and ethical obligations, including those governing client
          confidentiality.
        </p>

        <h2 style={heading}>7. AI-generated output and professional responsibility</h2>
        <p style={body}>
          ThemisOS uses artificial intelligence to generate analysis, including coverage assessments,
          liability theories, recovery estimates, document grades, and flags. This output may contain
          errors, omissions, or misinterpretations and is provided for attorney review only. It is not a
          substitute for independent legal research, professional judgment, or verification against source
          documents. You are solely responsible for reviewing, verifying, and deciding how to use any
          output, and for all advice and work product you provide to your own clients.
        </p>

        <h2 style={heading}>8. Disclaimer of warranties</h2>
        <p style={body}>
          The platform is provided &ldquo;as is&rdquo; and &ldquo;as available,&rdquo; without warranties of any
          kind, whether express or implied, including any implied warranties of merchantability, fitness
          for a particular purpose, accuracy, or non-infringement. ThemisOS does not warrant that the
          platform will be uninterrupted, error-free, or that any analysis will be accurate or complete.
        </p>

        <h2 style={heading}>9. Limitation of liability</h2>
        <p style={body}>
          To the maximum extent permitted by law, ThemisOS and its members, officers, and suppliers will
          not be liable for any indirect, incidental, special, consequential, or punitive damages, or for
          any loss of profits, data, goodwill, or professional opportunity, arising out of or related to
          your use of the platform. In all cases, ThemisOS&rsquo;s total aggregate liability arising out of
          or related to these Terms will not exceed the total fees you paid to ThemisOS in the twelve (12)
          months immediately preceding the event giving rise to the claim.
        </p>

        <h2 style={heading}>10. Indemnification</h2>
        <p style={body}>
          You agree to indemnify and hold harmless ThemisOS from any claims, damages, or expenses arising
          out of your use of the platform, your content, or your breach of these Terms, including claims by
          your own clients relating to advice or work product you provided.
        </p>

        <h2 style={heading}>11. Confidentiality and data</h2>
        <p style={body}>
          We treat the documents and information you submit as confidential and handle them as described in
          our <a className="inline-link" href="/privacy">Privacy Policy</a>. We do not retain uploaded
          documents after analysis; analysis results are retained in your workspace so you can return to
          them. Nothing in these Terms requires you to upload privileged material, and you should exercise
          your own professional judgment about what to submit.
        </p>

        <h2 style={heading}>12. Changes to these Terms</h2>
        <p style={body}>
          We may update these Terms from time to time. When we do, we will revise the &ldquo;Last
          updated&rdquo; date above and, for material changes, provide reasonable notice. Your continued use
          of the platform after changes take effect constitutes acceptance of the revised Terms.
        </p>

        <h2 style={heading}>13. Governing law</h2>
        <p style={body}>
          These Terms are governed by the laws of the State of Montana, without regard to its conflict-of-
          laws rules. The exclusive venue for any dispute arising out of or relating to these Terms or the
          platform will be the state and federal courts located in Montana, and you consent to their
          jurisdiction.
        </p>

        <h2 style={heading}>14. Contact</h2>
        <p style={body}>
          ThemisOS LLC<br />
          5 West Mendenhall Street, Unit 316<br />
          Bozeman, MT 59715<br />
          <a className="inline-link" href="mailto:legal@themisos.ai">legal@themisos.ai</a>
        </p>

        <div style={{ background: "#0d1526", border: "1px solid #1A2E4A", borderRadius: "3px", padding: "14px 18px", margin: "28px 0 0" }}>
          <p style={{ ...body, margin: 0, fontSize: "12px", fontStyle: "italic", color: "#6E7D94" }}>
            This document is a draft template provided for convenience. It is not legal advice and should
            be reviewed and approved by licensed counsel before use. <span style={label}>[REVIEW WITH COUNSEL]</span>
          </p>
        </div>

      </main>

      {/* ── FOOTER ── */}
      <footer style={{ borderTop: "1px solid #1A2E4A", padding: "1.25rem 32px", marginTop: "48px" }}>
        <div style={{ maxWidth: "1100px", margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem" }}>
          <p style={{ fontSize: "11px", color: "#3A4A5E", fontFamily: "'Syne', sans-serif", letterSpacing: "0.03em", margin: 0 }}>
            ThemisOS is not legal counsel. Analysis is provided for attorney review only.
          </p>
          <a href="/privacy" style={{ fontSize: "11px", color: "#3A4A5E", fontFamily: "'Syne', sans-serif", letterSpacing: "0.06em", textTransform: "uppercase", textDecoration: "none" }}>
            Privacy
          </a>
        </div>
      </footer>

    </div>
  )
}