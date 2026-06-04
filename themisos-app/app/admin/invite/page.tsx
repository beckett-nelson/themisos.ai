"use client"
import { useState } from "react"

export default function InvitePage() {
  const [email, setEmail] = useState("")
  const [firmName, setFirmName] = useState("")
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle")
  const [message, setMessage] = useState("")

  async function handleInvite() {
    if (!email || !firmName) {
      setStatus("error")
      setMessage("Please enter both an email and firm name.")
      return
    }
    setStatus("loading")
    setMessage("")
    try {
      const res = await fetch("https://app.themisos.ai/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, firm_name: firmName }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setStatus("success")
        setMessage(`Invite sent to ${email}`)
        setEmail("")
        setFirmName("")
      } else {
        setStatus("error")
        setMessage(data.error ? JSON.stringify(data.error) : "Something went wrong.")
      }
    } catch (err) {
      setStatus("error")
      setMessage("Could not reach the server. Check your connection.")
    }
  }

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#05090F", color: "#EDE6D0", fontFamily: "'Syne', sans-serif", display: "flex", flexDirection: "column" }}>

      {/* Nav */}
      <nav style={{ borderBottom: "1px solid #1A2E4A", padding: "20px 32px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontFamily: "Georgia, serif", fontSize: "18px", fontWeight: 600, letterSpacing: "0.08em", color: "#fff" }}>
          Themis<span style={{ color: "#C9962B" }}>OS</span>
        </div>
        <a href="/dashboard" style={{ color: "#6E7D94", fontSize: "13px", letterSpacing: "0.08em", textDecoration: "none" }}>
          ← Back to Dashboard
        </a>
      </nav>

      {/* Main */}
      <main style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "48px 24px" }}>
        <div style={{ width: "100%", maxWidth: "480px" }}>

          {/* Kicker */}
          <div style={{ fontSize: "11px", letterSpacing: "0.15em", textTransform: "uppercase", color: "#C9962B", marginBottom: "12px", display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ display: "inline-block", width: "20px", height: "1px", background: "#C9962B", opacity: 0.6 }}></span>
            Admin
          </div>

          <h1 style={{ fontFamily: "Georgia, serif", fontSize: "2.25rem", fontWeight: 400, color: "#fff", marginBottom: "8px", lineHeight: 1.1 }}>
            Invite a <em style={{ color: "#C9962B", fontStyle: "italic" }}>client</em>
          </h1>
          <p style={{ fontFamily: "Georgia, serif", fontStyle: "italic", fontSize: "15px", color: "#9A927E", marginBottom: "40px", lineHeight: 1.7 }}>
            They'll receive an email with a link to set their password and access the platform.
          </p>

          {/* Card */}
          <div style={{ background: "#0A1220", border: "1px solid #1A2E4A", borderRadius: "4px", padding: "32px" }}>

            {/* Firm name */}
            <div style={{ marginBottom: "20px" }}>
              <label style={{ display: "block", fontSize: "11px", letterSpacing: "0.1em", textTransform: "uppercase", color: "#6E7D94", marginBottom: "8px", fontFamily: "monospace" }}>
                Firm Name
              </label>
              <input
                type="text"
                value={firmName}
                onChange={e => setFirmName(e.target.value)}
                placeholder="e.g. Henderson & Associates"
                style={{
                  width: "100%", padding: "12px 14px",
                  background: "#05090F", border: "1px solid #1A2E4A",
                  borderRadius: "2px", color: "#EDE6D0",
                  fontSize: "15px", fontFamily: "Georgia, serif",
                  outline: "none", boxSizing: "border-box",
                  transition: "border-color 0.2s"
                }}
                onFocus={e => e.target.style.borderColor = "#C9962B"}
                onBlur={e => e.target.style.borderColor = "#1A2E4A"}
              />
            </div>

            {/* Email */}
            <div style={{ marginBottom: "28px" }}>
              <label style={{ display: "block", fontSize: "11px", letterSpacing: "0.1em", textTransform: "uppercase", color: "#6E7D94", marginBottom: "8px", fontFamily: "monospace" }}>
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="attorney@firm.com"
                onKeyDown={e => e.key === "Enter" && handleInvite()}
                style={{
                  width: "100%", padding: "12px 14px",
                  background: "#05090F", border: "1px solid #1A2E4A",
                  borderRadius: "2px", color: "#EDE6D0",
                  fontSize: "15px", fontFamily: "Georgia, serif",
                  outline: "none", boxSizing: "border-box",
                  transition: "border-color 0.2s"
                }}
                onFocus={e => e.target.style.borderColor = "#C9962B"}
                onBlur={e => e.target.style.borderColor = "#1A2E4A"}
              />
            </div>

            {/* Button */}
            <button
              onClick={handleInvite}
              disabled={status === "loading"}
              style={{
                width: "100%", padding: "14px",
                background: status === "loading" ? "#7A5A18" : "#C9962B",
                color: "#05090F", border: "none", borderRadius: "2px",
                fontSize: "13px", fontWeight: 700,
                letterSpacing: "0.1em", textTransform: "uppercase",
                cursor: status === "loading" ? "not-allowed" : "pointer",
                fontFamily: "'Syne', sans-serif",
                transition: "background 0.2s"
              }}
            >
              {status === "loading" ? "Sending Invite..." : "Send Invite →"}
            </button>

            {/* Status message */}
            {message && (
              <div style={{
                marginTop: "16px", padding: "12px 14px",
                borderRadius: "2px", fontSize: "13px",
                fontFamily: "monospace", letterSpacing: "0.04em",
                background: status === "success" ? "rgba(39,201,63,0.08)" : "rgba(255,90,90,0.08)",
                border: `1px solid ${status === "success" ? "rgba(39,201,63,0.2)" : "rgba(255,90,90,0.2)"}`,
                color: status === "success" ? "#27C93F" : "#ff5a5a"
              }}>
                {status === "success" ? "✓ " : "✕ "}{message}
              </div>
            )}
          </div>

          {/* Note */}
          <p style={{ marginTop: "20px", fontSize: "11px", color: "#6E7D94", fontFamily: "monospace", letterSpacing: "0.06em", textTransform: "uppercase", textAlign: "center" }}>
            Invite links expire after 24 hours
          </p>
        </div>
      </main>
    </div>
  )
}