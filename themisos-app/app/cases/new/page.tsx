"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"

type Feature = "cross_examine" | "case_examine" | "document_analysis"

const FEATURES: { value: Feature; label: string; tagline: string }[] = [
  { value: "cross_examine", label: "Policy Cross-Examination", tagline: "I have a policy and a case file" },
  { value: "case_examine", label: "Case Examination", tagline: "I want to assess case merit" },
  { value: "document_analysis", label: "Document Analysis", tagline: "I have a contract or agreement to review" },
]

const SUBMIT_LABELS: Record<Feature, string> = {
  cross_examine: "Create Case & Run Cross-Examination →",
  case_examine: "Create Case & Examine →",
  document_analysis: "Create Case & Analyze Document →",
}

const ROUTES: Record<Feature, (id: string) => string> = {
  cross_examine: id => `/cases/${id}`,
  case_examine: id => `/cases/${id}/examine`,
  document_analysis: id => `/cases/${id}/document-analysis`,
}

export default function NewCasePage() {
  const [name, setName] = useState("")
  const [claimant, setClaimant] = useState("")
  const [feature, setFeature] = useState<Feature>("cross_examine")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [nameFocus, setNameFocus] = useState(false)
  const [claimantFocus, setClaimantFocus] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleCreate = async () => {
    if (!name.trim()) { setError("Case name is required"); return }
    setLoading(true)
    setError("")
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push("/login"); return }
    const { data: profile } = await supabase.from("profiles").select("organization_id").eq("id", user.id).single()
    const { data, error: err } = await supabase.from("cases").insert({ name: name.trim(), claimant: claimant.trim() || null, user_id: user.id, organization_id: profile?.organization_id || null, status: "active" }).select().single()
    if (err) { setError(err.message); setLoading(false); return }
    router.push(ROUTES[feature](data.id))
  }

  const inputStyle = (focused: boolean) => ({
    width: "100%",
    display: "block" as const,
    backgroundColor: "transparent",
    border: "1px solid " + (focused ? "#C9962B" : "#1A2E4A"),
    borderRadius: "3px",
    padding: "12px 16px",
    color: "#EDE6D0",
    fontSize: "14px",
    fontFamily: "Georgia, serif",
    outline: "none",
    transition: "border-color 0.2s",
    boxShadow: focused ? "0 0 0 1px rgba(201,150,43,0.25)" : "none",
  })

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#05090F", color: "#EDE6D0", fontFamily: "'Syne', sans-serif", fontSize: "14px", display: "flex", flexDirection: "column" }}>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;0,700;1,400;1,600&family=Syne:wght@400;500;600;700&display=swap');
        input::placeholder { color: #6E7D94; font-style: italic; font-family: Georgia, serif; }
        @keyframes spin { to { transform: rotate(360deg); } }
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
          <a href="/support" style={{ fontSize: "11px", color: "#6E7D94", textDecoration: "none", letterSpacing: "0.06em", textTransform: "uppercase", transition: "color 0.2s" }}
            onMouseEnter={e => e.currentTarget.style.color = "#EDE6D0"}
            onMouseLeave={e => e.currentTarget.style.color = "#6E7D94"}>Support</a>
          <a href="/dashboard" style={{ fontSize: "11px", color: "#6E7D94", textDecoration: "none", letterSpacing: "0.06em", textTransform: "uppercase", transition: "color 0.2s" }}
            onMouseEnter={e => e.currentTarget.style.color = "#EDE6D0"}
            onMouseLeave={e => e.currentTarget.style.color = "#6E7D94"}>Dashboard</a>
        </div>
      </header>

      {/* ── PAGE TITLE STRIP ── */}
      <div style={{
        borderBottom: "1px solid #1A2E4A",
        backgroundColor: "#05090F",
        padding: "1.25rem 32px",
      }}>
        <div style={{ maxWidth: "640px", margin: "0 auto" }}>
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
            Case Intake
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
            New Case
          </h1>
        </div>
      </div>

      {/* ── MAIN CONTENT ── */}
      <div style={{ maxWidth: "640px", margin: "0 auto", padding: "36px 32px", width: "100%", boxSizing: "border-box", flex: 1 }}>

        <p style={{ fontFamily: "Georgia, serif", fontStyle: "italic", color: "#9A927E", fontSize: "14px", marginBottom: "28px", lineHeight: 1.6 }}>
          Create a case, choose the tool you want to start with, and you&apos;ll land there ready to upload.
        </p>

        {/* ── CASE DETAILS CARD ── */}
        <div style={{ background: "#0A1220", border: "1px solid #1A2E4A", borderRadius: "3px", overflow: "hidden", marginBottom: "24px" }}>
          <div style={{ padding: "11px 16px", borderBottom: "1px solid #1A2E4A", display: "flex", alignItems: "center", gap: "8px", background: "#0d1526" }}>
            <div style={{ width: "7px", height: "7px", borderRadius: "50%", background: "#C9962B", flexShrink: 0 }}></div>
            <span style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#9A927E", fontFamily: "'Syne', sans-serif" }}>
              Case Details
            </span>
          </div>
          <div style={{ padding: "24px 20px" }}>
            <div style={{ marginBottom: "20px" }}>
              <label style={{ display: "block", fontSize: "10px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#6E7D94", marginBottom: "8px", fontFamily: "'Syne', sans-serif" }}>Case Name</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                onFocus={() => setNameFocus(true)}
                onBlur={() => setNameFocus(false)}
                placeholder="e.g. Smith v. Acme Insurance"
                style={inputStyle(nameFocus)}
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "10px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#6E7D94", marginBottom: "8px", fontFamily: "'Syne', sans-serif" }}>Claimant Name <span style={{ color: "#3A4A5E", textTransform: "none", letterSpacing: "0.02em", fontWeight: 500 }}>(optional)</span></label>
              <input
                type="text"
                value={claimant}
                onChange={e => setClaimant(e.target.value)}
                onFocus={() => setClaimantFocus(true)}
                onBlur={() => setClaimantFocus(false)}
                placeholder="e.g. John Smith"
                style={inputStyle(claimantFocus)}
              />
            </div>
          </div>
        </div>

        {/* ── FEATURE TOGGLE ── */}
        <div style={{ marginBottom: "24px" }}>
          <div style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#9A927E", fontFamily: "'Syne', sans-serif", marginBottom: "12px" }}>
            Where do you want to start?
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "10px" }}>
            {FEATURES.map(f => {
              const selected = feature === f.value
              return (
                <button key={f.value} onClick={() => setFeature(f.value)} style={{
                  padding: "14px 18px",
                  background: selected ? "rgba(201,150,43,0.10)" : "#0A1220",
                  border: "1px solid " + (selected ? "#C9962B" : "#1A2E4A"),
                  borderRadius: "3px",
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "all 0.2s",
                  display: "flex",
                  alignItems: "center",
                  gap: "14px",
                }}
                  onMouseEnter={e => { if (!selected) { e.currentTarget.style.borderColor = "#2A3F5F" } }}
                  onMouseLeave={e => { if (!selected) { e.currentTarget.style.borderColor = "#1A2E4A" } }}
                >
                  {/* Radio dot */}
                  <span style={{
                    width: "14px", height: "14px", borderRadius: "50%", flexShrink: 0,
                    border: "1.5px solid " + (selected ? "#C9962B" : "#2A3F5F"),
                    display: "flex", alignItems: "center", justifyContent: "center",
                    transition: "all 0.2s",
                  }}>
                    {selected && <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#C9962B" }}></span>}
                  </span>
                  <span>
                    <span style={{ display: "block", fontSize: "13px", fontWeight: selected ? 700 : 600, color: selected ? "#C9962B" : "#EDE6D0", fontFamily: "'Syne', sans-serif", letterSpacing: "0.02em", marginBottom: "2px", transition: "color 0.2s" }}>
                      {f.label}
                    </span>
                    <span style={{ display: "block", fontSize: "12px", color: "#6E7D94", fontFamily: "Georgia, serif", fontStyle: "italic" }}>
                      {f.tagline}
                    </span>
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {error && (
          <div style={{ background: "rgba(255,90,90,0.08)", border: "1px solid rgba(255,90,90,0.3)", borderRadius: "3px", padding: "14px 18px", marginBottom: "24px", fontSize: "13px", color: "#ff5a5a", fontFamily: "'Syne', sans-serif" }}>
            {error}
          </div>
        )}

        {/* ── SUBMIT + CANCEL ── */}
        <div style={{ display: "flex", gap: "12px" }}>
          <button
            onClick={handleCreate}
            disabled={loading}
            style={{
              flex: 1,
              padding: "14px",
              background: loading ? "#0A1220" : "#C9962B",
              color: loading ? "#3A4A5E" : "#05090F",
              border: "1px solid " + (loading ? "#1A2E4A" : "#C9962B"),
              borderRadius: "2px",
              fontSize: "12px",
              fontWeight: 700,
              fontFamily: "'Syne', sans-serif",
              cursor: loading ? "not-allowed" : "pointer",
              transition: "all 0.2s",
              letterSpacing: "0.12em",
              textTransform: "uppercase",
            }}
            onMouseEnter={e => { if (!loading) e.currentTarget.style.background = "#E2B44A" }}
            onMouseLeave={e => { if (!loading) e.currentTarget.style.background = "#C9962B" }}
          >
            {loading ? (
              <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "10px" }}>
                <span style={{ display: "inline-block", width: "13px", height: "13px", border: "2px solid rgba(255,255,255,0.2)", borderTopColor: "#C9962B", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                Creating...
              </span>
            ) : SUBMIT_LABELS[feature]}
          </button>
          <a href="/dashboard" style={{
            padding: "14px 24px",
            border: "1px solid #1A2E4A",
            borderRadius: "2px",
            color: "#6E7D94",
            fontSize: "12px",
            fontWeight: 700,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            textDecoration: "none",
            display: "flex",
            alignItems: "center",
            fontFamily: "'Syne', sans-serif",
            transition: "all 0.2s",
          }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = "#6E7D94"; e.currentTarget.style.color = "#EDE6D0" }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = "#1A2E4A"; e.currentTarget.style.color = "#6E7D94" }}
          >Cancel</a>
        </div>

      </div>

      {/* ── FOOTER ── */}
      <footer style={{ borderTop: "1px solid #1A2E4A", padding: "1.25rem 32px", marginTop: "48px" }}>
        <div style={{ maxWidth: "1100px", margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem" }}>
          <p style={{ fontSize: "11px", color: "#3A4A5E", fontFamily: "'Syne', sans-serif", letterSpacing: "0.03em", margin: 0 }}>
            ThemisOS is not legal counsel. Analysis is provided for attorney review only.
          </p>
          <a href="/terms" style={{ fontSize: "11px", color: "#3A4A5E", fontFamily: "'Syne', sans-serif", letterSpacing: "0.06em", textTransform: "uppercase", textDecoration: "none", transition: "color 0.2s" }}
            onMouseEnter={e => e.currentTarget.style.color = "#6E7D94"}
            onMouseLeave={e => e.currentTarget.style.color = "#3A4A5E"}>
            Terms
          </a>
        </div>
      </footer>

    </div>
  )
}