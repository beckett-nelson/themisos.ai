export default function SupportPage() {
  const steps = [
    {
      num: 1,
      title: "Log in to the platform",
      desc: "Sign in using your credentials at app.themisos.ai. ThemisOS is built for plaintiff attorneys — your login gives you access to your firm's case workspace.",
    },
    {
      num: 2,
      title: "Start a new case",
      desc: "Click New Case to begin a fresh cross-examination or policy analysis. Each case is associated with a single insurance policy.",
    },
    {
      num: 3,
      title: "Upload your insurance policy",
      desc: "Upload the relevant policy document for the case. For best results, use the Declarations Page or Policy Contract — not the full insurance packet. ThemisOS will analyze it and prepare targeted cross-examination questions and coverage findings.",
    },
    {
      num: 4,
      title: "Review and use your results",
      desc: "Work through the AI-generated cross-examination output. Download, copy, or share findings directly from the case view.",
    },
  ]

  const features = [
    {
      title: "Policy Cross-Examination",
      desc: "Upload an insurance policy and a case file. The AI cross-examines the policy against the claim and returns a coverage verdict, recovery opportunities by tier, exclusions, conflicts, and attorney flags.",
    },
    {
      title: "Case Examination",
      desc: "Upload a case file only. The AI assesses case merit, maps every liable party with legal theory and confidence, surfaces recovery opportunities, flags deadlines and procedural concerns, and recommends next steps.",
    },
    {
      title: "Document Analysis",
      desc: "Upload any legal document — NDA, lease, contract, employment agreement. The AI grades the document (I · Counsel Grade / II · Standard / III · At Risk), identifies strong and weak provisions, flags unusual or predatory terms, and recommends what to address before signing.",
    },
  ]

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#05090F", color: "#EDE6D0", fontFamily: "'Syne', sans-serif", fontSize: "14px", display: "flex", flexDirection: "column" }}>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;0,700;1,400;1,600&family=Syne:wght@400;500;600;700&display=swap');
      `}</style>

      {/* ── NAV ── */}
      <header style={{
        padding: "0 32px",
        borderBottom: "1px solid #1A2E4A",
        display: "flex", alignItems: "center",
        backgroundColor: "#05090F",
        position: "sticky", top: 0, zIndex: 100, height: "56px",
      }}>
        {/* Logo */}
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
        {/* Nav links */}
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "20px" }}>
          <a href="/support" style={{ fontSize: "11px", color: "#6E7D94", textDecoration: "none", letterSpacing: "0.06em", textTransform: "uppercase" }}>Support</a>
          <a href="/dashboard" style={{ fontSize: "11px", color: "#6E7D94", textDecoration: "none", letterSpacing: "0.06em", textTransform: "uppercase" }}>Dashboard</a>
        </div>
      </header>

      {/* ── PAGE TITLE STRIP ── */}
      <div style={{
        borderBottom: "1px solid #1A2E4A",
        backgroundColor: "#05090F",
        padding: "1.25rem 32px",
      }}>
        <div style={{ maxWidth: "720px", margin: "0 auto" }}>
          <div style={{
            fontFamily: "'DM Mono', monospace",
            fontSize: "0.625rem",
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: "#C9962B",
            marginBottom: "0.3rem",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}>
            <span style={{ display: "inline-block", width: "20px", height: "1px", background: "#C9962B", opacity: 0.6 }}></span>
            Support
          </div>
          <h1 style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: "1.625rem",
            fontWeight: 600,
            color: "#ffffff",
            letterSpacing: "-0.01em",
            lineHeight: 1.1,
            margin: 0,
          }}>
            How can we help?
          </h1>
        </div>
      </div>

      {/* ── MAIN CONTENT ── */}
      <main style={{ padding: "36px 32px", maxWidth: "720px", margin: "0 auto", width: "100%", boxSizing: "border-box", flex: 1 }}>

        <p style={{ fontFamily: "Georgia, serif", fontStyle: "italic", color: "#9A927E", fontSize: "14px", margin: "0 0 28px", lineHeight: 1.6 }}>
          Resources to help you get the most out of ThemisOS.
        </p>

        {/* ── HOW TO USE CARD ── */}
        <div style={{ background: "#0A1220", border: "1px solid #1A2E4A", borderRadius: "3px", overflow: "hidden", marginBottom: "24px" }}>
          <div style={{ padding: "11px 16px", borderBottom: "1px solid #1A2E4A", display: "flex", alignItems: "center", gap: "8px", background: "#0d1526" }}>
            <div style={{ width: "7px", height: "7px", borderRadius: "50%", background: "#C9962B", flexShrink: 0 }}></div>
            <span style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#9A927E", fontFamily: "'Syne', sans-serif" }}>
              How to use ThemisOS
            </span>
          </div>
          <div style={{ padding: "24px" }}>
            <p style={{ fontFamily: "Georgia, serif", fontStyle: "italic", color: "#6E7D94", fontSize: "13px", margin: "0 0 24px" }}>
              A quick guide for plaintiff attorneys
            </p>

            <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: "18px" }}>
              {steps.map(({ num, title, desc }) => (
                <li key={num} style={{ display: "flex", gap: "16px", alignItems: "flex-start" }}>
                  <span style={{
                    minWidth: "28px", height: "28px", borderRadius: "50%",
                    background: "#0d1526", border: "1px solid #1A2E4A",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: "12px", fontWeight: 700, color: "#C9962B",
                    fontFamily: "'Syne', sans-serif", flexShrink: 0, marginTop: "2px",
                  }}>
                    {num}
                  </span>
                  <div>
                    <p style={{ fontSize: "15px", fontWeight: 600, margin: "0 0 4px", color: "#ffffff", fontFamily: "'Cormorant Garamond', serif" }}>
                      {title}
                    </p>
                    <p style={{ fontSize: "13px", color: "#9A927E", margin: 0, fontFamily: "Georgia, serif", fontStyle: "italic", lineHeight: 1.7 }}>
                      {desc}
                    </p>
                  </div>
                </li>
              ))}
            </ol>

            {/* Tip box */}
            <div style={{
              marginTop: "20px",
              background: "#0d1526",
              border: "1px solid #1A2E4A",
              borderLeft: "3px solid #C9962B",
              borderRadius: "0 3px 3px 0",
              padding: "14px 16px",
            }}>
              <p style={{ margin: 0, fontSize: "13px", color: "#9A927E", fontFamily: "Georgia, serif", fontStyle: "italic", lineHeight: 1.7 }}>
                <span style={{ color: "#C9962B", fontWeight: 700, fontFamily: "'Syne', sans-serif", fontStyle: "normal", fontSize: "11px", letterSpacing: "0.06em", textTransform: "uppercase" }}>Multiple policies?</span>{" "}
                We recommend opening a separate New Case for each insurance policy. This keeps your cross-examinations clean and organized — one case per policy per matter.
              </p>
            </div>

            {/* Document tip box */}
            <div style={{
              marginTop: "12px",
              background: "#0d1526",
              border: "1px solid #1A2E4A",
              borderLeft: "3px solid #C9962B",
              borderRadius: "0 3px 3px 0",
              padding: "14px 16px",
            }}>
              <p style={{ margin: 0, fontSize: "13px", color: "#9A927E", fontFamily: "Georgia, serif", fontStyle: "italic", lineHeight: 1.7 }}>
                <span style={{ color: "#C9962B", fontWeight: 700, fontFamily: "'Syne', sans-serif", fontStyle: "normal", fontSize: "11px", letterSpacing: "0.06em", textTransform: "uppercase" }}>What to upload?</span>{" "}
                Use the <span style={{ color: "#EDE6D0" }}>Declarations Page</span> or <span style={{ color: "#EDE6D0" }}>Policy Contract</span> from the insurance carrier — not the full insurance packet. These contain the coverage terms, limits, and exclusions ThemisOS needs. Uploading only the relevant documents produces faster, more accurate results.
              </p>
            </div>
          </div>
        </div>

        {/* ── PLATFORM FEATURES ── */}
        <div style={{ marginBottom: "24px" }}>
          <div style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#C9962B", fontFamily: "'Syne', sans-serif", marginBottom: "12px", display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ display: "inline-block", width: "20px", height: "1px", background: "#C9962B", opacity: 0.6 }}></span>
            Platform Features
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {features.map(f => (
              <div key={f.title} style={{ background: "#0A1220", border: "1px solid #1A2E4A", borderRadius: "3px", overflow: "hidden" }}>
                <div style={{ padding: "11px 16px", borderBottom: "1px solid #1A2E4A", display: "flex", alignItems: "center", gap: "8px", background: "#0d1526" }}>
                  <div style={{ width: "7px", height: "7px", borderRadius: "50%", background: "#C9962B", flexShrink: 0 }}></div>
                  <span style={{ fontSize: "14px", fontWeight: 600, color: "#ffffff", fontFamily: "'Cormorant Garamond', serif" }}>
                    {f.title}
                  </span>
                </div>
                <div style={{ padding: "16px" }}>
                  <p style={{ margin: 0, fontSize: "13px", color: "#9A927E", fontFamily: "Georgia, serif", fontStyle: "italic", lineHeight: 1.7 }}>
                    {f.desc}
                  </p>
                  <a href="/dashboard" style={{ display: "inline-block", marginTop: "10px", fontSize: "10px", color: "#6E7D94", fontFamily: "'Syne', sans-serif", letterSpacing: "0.08em", textTransform: "uppercase", textDecoration: "none" }}>
                    Open from your dashboard →
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── CONTACT CARD ── */}
        <div style={{ background: "#0A1220", border: "1px solid #1A2E4A", borderRadius: "3px", overflow: "hidden" }}>
          <div style={{ padding: "11px 16px", borderBottom: "1px solid #1A2E4A", display: "flex", alignItems: "center", gap: "8px", background: "#0d1526" }}>
            <div style={{ width: "7px", height: "7px", borderRadius: "50%", background: "#C9962B", flexShrink: 0 }}></div>
            <span style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#9A927E", fontFamily: "'Syne', sans-serif" }}>
              Contact Support
            </span>
          </div>
          <div style={{ padding: "24px" }}>
            <a href="mailto:support@themisos.ai" style={{ color: "#C9962B", fontSize: "20px", fontWeight: 600, textDecoration: "none", fontFamily: "'Cormorant Garamond', serif" }}>
              support@themisos.ai
            </a>
            <p style={{ color: "#6E7D94", fontSize: "13px", margin: "12px 0 0", fontFamily: "Georgia, serif", fontStyle: "italic", lineHeight: 1.7 }}>
              Please include your firm name and a brief description of your issue. We respond within one business day.
            </p>
            <div style={{ marginTop: "24px", paddingTop: "20px", borderTop: "1px solid #1A2E4A" }}>
              <a href="mailto:support@themisos.ai" style={{
                display: "inline-block", background: "#C9962B", color: "#05090F",
                padding: "11px 28px", borderRadius: "2px", fontSize: "12px",
                fontWeight: 700, textDecoration: "none", fontFamily: "'Syne', sans-serif",
                letterSpacing: "0.1em", textTransform: "uppercase",
              }}>
                Open Email
              </a>
            </div>
          </div>
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