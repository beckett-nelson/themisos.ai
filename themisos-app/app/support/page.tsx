export default function SupportPage() {
  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#0a0f1e", color: "#ffffff", fontFamily: "Georgia, serif" }}>

      {/* Nav */}
      <nav style={{ borderBottom: "1px solid #1e2d4a", padding: "16px 32px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h1 style={{ margin: 0, fontSize: "20px" }}>
          <span style={{ color: "#ffffff" }}>Themis</span><span style={{ color: "#c9a84c" }}>OS</span>
        </h1>
        <a href="/dashboard" style={{ color: "#9ca3af", fontSize: "14px", textDecoration: "none", fontFamily: "sans-serif" }}>
          Back to Dashboard
        </a>
      </nav>

      {/* Main */}
      <main style={{ padding: "48px 32px", maxWidth: "680px", margin: "0 auto" }}>
        <h2 style={{ fontSize: "24px", fontWeight: 600, margin: "0 0 8px" }}>Support</h2>
        <p style={{ color: "#9ca3af", margin: "0 0 40px", fontFamily: "sans-serif", fontSize: "15px" }}>
          Resources to help you get the most out of ThemisOS.
        </p>

        {/* How to Use Card */}
        <div style={{ backgroundColor: "#111827", border: "1px solid #1e2d4a", borderRadius: "12px", padding: "32px", marginBottom: "24px" }}>
          <p style={{ fontSize: "16px", fontWeight: 600, margin: "0 0 4px", fontFamily: "sans-serif", color: "#ffffff" }}>
            How to use ThemisOS
          </p>
          <p style={{ color: "#9ca3af", fontSize: "14px", fontFamily: "sans-serif", margin: "0 0 24px" }}>
            A quick guide for plaintiff attorneys
          </p>

          <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: "16px" }}>
            {[
              {
                num: 1,
                title: "Log in to the platform",
                desc: "Sign in using your credentials at app.themisos.ai. ThemisOS is built for plaintiff attorneys — your login gives you access to your firm's case workspace.",
              },
              {
                num: 2,
                title: "Start a new case",
                desc: 'Click New Case to begin a fresh cross-examination or policy analysis. Each case is associated with a single insurance policy.',
              },
              {
                num: 3,
                title: "Upload your insurance policy",
                desc: "Upload the policy document for the case. ThemisOS will analyze it and prepare targeted cross-examination questions and coverage findings.",
              },
              {
                num: 4,
                title: "Review and use your results",
                desc: "Work through the AI-generated cross-examination output. Download, copy, or share findings directly from the case view.",
              },
            ].map(({ num, title, desc }) => (
              <li key={num} style={{ display: "flex", gap: "16px", alignItems: "flex-start" }}>
                <span style={{
                  minWidth: "32px", height: "32px", borderRadius: "50%",
                  backgroundColor: "#1e2d4a", border: "1px solid rgba(201,168,76,0.15)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "13px", fontWeight: 600, color: "#c9a84c",
                  fontFamily: "sans-serif", flexShrink: 0, marginTop: "2px",
                }}>
                  {num}
                </span>
                <div>
                  <p style={{ fontSize: "15px", fontWeight: 600, margin: "0 0 4px", color: "#ffffff", fontFamily: "sans-serif" }}>
                    {title}
                  </p>
                  <p style={{ fontSize: "13px", color: "#9ca3af", margin: 0, fontFamily: "sans-serif", lineHeight: 1.6 }}>
                    {desc}
                  </p>
                </div>
              </li>
            ))}
          </ol>

          {/* Tip box */}
          <div style={{
            marginTop: "20px",
            backgroundColor: "#0d1526",
            border: "1px solid rgba(201,168,76,0.2)",
            borderLeft: "3px solid #c9a84c",
            borderRadius: "8px",
            padding: "14px 16px",
          }}>
            <p style={{ margin: 0, fontSize: "13px", color: "#9ca3af", fontFamily: "sans-serif", lineHeight: 1.6 }}>
              <span style={{ color: "#c9a84c", fontWeight: 600 }}>Multiple policies?</span>{" "}
              We recommend opening a separate New Case for each insurance policy. This keeps your cross-examinations clean and organized — one case per policy per matter.
            </p>
          </div>
        </div>

        {/* Contact Card */}
        <div style={{ backgroundColor: "#111827", border: "1px solid #1e2d4a", borderRadius: "12px", padding: "32px" }}>
          <p style={{ color: "#9ca3af", fontSize: "14px", margin: "0 0 8px", fontFamily: "sans-serif" }}>
            Contact support
          </p>
          <a href="mailto:support@themisos.ai" style={{ color: "#c9a84c", fontSize: "18px", fontWeight: 600, textDecoration: "none" }}>
            support@themisos.ai
          </a>
          <p style={{ color: "#6b7280", fontSize: "13px", margin: "16px 0 0", fontFamily: "sans-serif" }}>
            Please include your firm name and a brief description of your issue. We respond within one business day.
          </p>
          <div style={{ marginTop: "28px", paddingTop: "24px", borderTop: "1px solid #1e2d4a" }}>
            <a href="mailto:support@themisos.ai" style={{
              display: "inline-block", backgroundColor: "#c9a84c", color: "#0a0f1e",
              padding: "12px 28px", borderRadius: "8px", fontSize: "14px",
              fontWeight: 600, textDecoration: "none", fontFamily: "sans-serif",
            }}>
              Open Email
            </a>
          </div>
        </div>

      </main>
    </div>
  )
}