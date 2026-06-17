export default function PrivacyPage() {
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

  const li = {
    fontFamily: "Georgia, serif",
    fontSize: "14px",
    color: "#9A927E",
    lineHeight: 1.7,
    margin: "0 0 10px",
  } as const

  const term = { color: "#EDE6D0", fontWeight: 600 }
  const label = { color: "#C9962B", fontFamily: "'Syne', sans-serif", fontWeight: 700, fontStyle: "normal" as const }

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
            Privacy Policy
          </h1>
        </div>
      </div>

      {/* ── CONTENT ── */}
      <main style={{ padding: "36px 32px", maxWidth: "760px", margin: "0 auto", width: "100%", boxSizing: "border-box", flex: 1 }}>

        <p style={{ ...body, fontStyle: "italic", color: "#6E7D94", marginBottom: "8px" }}>Last updated: {updated}</p>
        <p style={body}>
          This Privacy Policy explains what data ThemisOS collects, how your documents are processed, who
          processes them, and how long information is kept. It applies to the ThemisOS platform operated by{" "}
          <strong style={term}>ThemisOS LLC</strong> (&ldquo;ThemisOS,&rdquo; &ldquo;we,&rdquo; &ldquo;us&rdquo;).
        </p>

        <h2 style={heading}>Information we collect</h2>
        <ul style={{ paddingLeft: "20px", margin: "0 0 12px" }}>
          <li style={li}><strong style={term}>Account information:</strong> name, email address, firm name, and role, used to create and manage your workspace.</li>
          <li style={li}><strong style={term}>Documents you upload:</strong> insurance policies, case files, and other legal documents you submit for analysis.</li>
          <li style={li}><strong style={term}>Analysis results:</strong> the findings, citations, and assessments ThemisOS generates from your documents.</li>
          <li style={li}><strong style={term}>Billing information:</strong> firm name, billing contact, and subscription details. Payment card data is collected and processed solely by Stripe and never reaches ThemisOS servers.</li>
          <li style={li}><strong style={term}>Usage information:</strong> records such as the number of analyses run, used to operate and support your account.</li>
        </ul>

        <h2 style={heading}>How your documents are processed</h2>
        <p style={body}>
          When you upload a document, it is transmitted to our processing service, where the text is
          extracted and analyzed. We do not retain the documents you upload. They are processed in memory
          and discarded once the analysis is complete — no copy of your uploaded file is stored on our
          systems.
        </p>
        <p style={body}>
          We do retain the analysis results we generate, so you can return to them within your workspace.
          Because these results cite and summarize the source material, they may include short excerpts or
          references drawn from your documents.
        </p>

        <h2 style={heading}>AI processing and third-party providers</h2>
        <p style={body}>
          ThemisOS uses third-party service providers (subprocessors) to operate the platform. Your
          document text is processed by Anthropic to produce the analysis. This processing occurs under
          Anthropic&rsquo;s commercial API terms, which provide that your inputs and outputs are not used to
          train Anthropic&rsquo;s models and are deleted from Anthropic&rsquo;s systems within 30 days.
        </p>
        <p style={body}>Our subprocessors are:</p>
        <ul style={{ paddingLeft: "20px", margin: "0 0 12px" }}>
          <li style={li}><strong style={term}>Anthropic</strong> — AI analysis of document text</li>
          <li style={li}><strong style={term}>Supabase</strong> — account, workspace, and analysis-results database and authentication</li>
          <li style={li}><strong style={term}>Stripe</strong> — subscription billing and payment processing</li>
          <li style={li}><strong style={term}>SendGrid</strong> — transactional and notification email</li>
          <li style={li}><strong style={term}>Railway</strong> — application hosting (processing)</li>
          <li style={li}><strong style={term}>Vercel</strong> — web application hosting</li>
        </ul>

        <h2 style={heading}>Data retention</h2>
        <ul style={{ paddingLeft: "20px", margin: "0 0 12px" }}>
          <li style={li}><strong style={term}>Uploaded documents:</strong> not retained — processed and discarded after analysis.</li>
          <li style={li}><strong style={term}>Analysis results and account data:</strong> retained until you request deletion. You may request deletion of your data at any time by contacting <a className="inline-link" href="mailto:legal@themisos.ai">legal@themisos.ai</a>; we will delete it within 30 days, except where retention is required by law.</li>
          <li style={li}><strong style={term}>Anthropic-side processing data:</strong> deleted by Anthropic within 30 days, as described above.</li>
        </ul>

        <h2 style={heading}>Security</h2>
        <p style={body}>
          Data is transmitted over encrypted (TLS) connections and stored in access-controlled databases,
          with access to each firm&rsquo;s workspace restricted to that firm through row-level access
          controls.
        </p>

        <h2 style={heading}>Your choices</h2>
        <p style={body}>
          You may access, correct, or request deletion of your account information and analysis results by
          contacting <a className="inline-link" href="mailto:legal@themisos.ai">legal@themisos.ai</a>.
          Questions about this policy can be directed to the same address.
        </p>

        <h2 style={heading}>Contact</h2>
        <p style={body}>
          ThemisOS LLC<br />
          5 West Mendenhall Street, Unit 316<br />
          Bozeman, MT 59715<br />
          <a className="inline-link" href="mailto:legal@themisos.ai">legal@themisos.ai</a>
        </p>

        <div style={{ background: "#0d1526", border: "1px solid #1A2E4A", borderRadius: "3px", padding: "14px 18px", margin: "28px 0 0" }}>
          <p style={{ ...body, margin: 0, fontSize: "12px", fontStyle: "italic", color: "#6E7D94" }}>
            This document is a draft template provided for convenience. It is not legal advice and should
            be reviewed and approved by licensed counsel before use. Verify the current Anthropic commercial
            terms (no-training and 30-day deletion) before publishing. <span style={label}>[REVIEW WITH COUNSEL]</span>
          </p>
        </div>

      </main>

      {/* ── FOOTER ── */}
      <footer style={{ borderTop: "1px solid #1A2E4A", padding: "1.25rem 32px", marginTop: "48px" }}>
        <div style={{ maxWidth: "1100px", margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem" }}>
          <p style={{ fontSize: "11px", color: "#3A4A5E", fontFamily: "'Syne', sans-serif", letterSpacing: "0.03em", margin: 0 }}>
            ThemisOS is not legal counsel. Analysis is provided for attorney review only.
          </p>
          <a href="/terms" style={{ fontSize: "11px", color: "#3A4A5E", fontFamily: "'Syne', sans-serif", letterSpacing: "0.06em", textTransform: "uppercase", textDecoration: "none" }}>
            Terms
          </a>
        </div>
      </footer>

    </div>
  )
}