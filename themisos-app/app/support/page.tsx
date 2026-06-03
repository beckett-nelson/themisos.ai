export default function SupportPage() {
  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#0a0f1e", color: "#ffffff" }}>
      <nav style={{ borderBottom: "1px solid #1e2d4a", padding: "16px 32px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h1 style={{ fontFamily: "Georgia, serif", fontSize: "20px" }}>
          <span style={{ color: "#ffffff" }}>Themis</span><span style={{ color: "#c9a84c" }}>OS</span>
        </h1>
        <a href="/dashboard" style={{ color: "#9ca3af", fontSize: "14px", textDecoration: "none" }}>Back to Dashboard</a>
      </nav>
      <main style={{ padding: "48px 32px", maxWidth: "600px", margin: "0 auto" }}>
        <h2 style={{ fontSize: "24px", fontWeight: 600, marginBottom: "8px" }}>Contact Support</h2>
        <p style={{ color: "#9ca3af", marginBottom: "40px" }}>Our team will respond within one business day.</p>
        <div style={{ backgroundColor: "#111827", border: "1px solid #1e2d4a", borderRadius: "12px", padding: "32px" }}>
          <p style={{ color: "#9ca3af", fontSize: "14px", marginBottom: "8px" }}>Email us directly at</p>
          <a href="mailto:support@themisos.ai" style={{ color: "#c9a84c", fontSize: "18px", fontWeight: 600, textDecoration: "none" }}>support@themisos.ai</a>
          <p style={{ color: "#6b7280", fontSize: "13px", marginTop: "16px" }}>Please include your firm name and a brief description of your issue.</p>
          <div style={{ marginTop: "32px", paddingTop: "24px", borderTop: "1px solid #1e2d4a" }}>
            <a href="mailto:support@themisos.ai" style={{ display: "inline-block", backgroundColor: "#c9a84c", color: "#0a0f1e", padding: "12px 28px", borderRadius: "8px", fontSize: "14px", fontWeight: 600, textDecoration: "none" }}>Open Email</a>
          </div>
        </div>
      </main>
    </div>
  )
}
