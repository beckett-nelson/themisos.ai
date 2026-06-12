"use client"
import { useEffect, useState, useRef } from "react"
import { useRouter, useParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"

type Case = {
  id: string
  name: string
  claimant: string | null
  status: string
  documents_analyzed: number
  recovery_identified: number
  created_at: string
}

function DownloadReportButton({ results, caseData }: { results: any, caseData: Case }) {
  const handlePrint = () => {
    document.title = `ThemisOS — ${caseData.name} — Analysis Report`
    window.print()
    setTimeout(() => { document.title = "ThemisOS" }, 1000)
  }
  return (
    <button onClick={handlePrint} style={{
      display: "flex", alignItems: "center", gap: "8px",
      padding: "8px 18px",
      background: "transparent",
      border: "1px solid #C9962B",
      borderRadius: "2px",
      color: "#C9962B",
      fontSize: "11px",
      fontFamily: "'Syne', sans-serif",
      fontWeight: 700,
      cursor: "pointer",
      letterSpacing: "0.1em",
      textTransform: "uppercase",
      transition: "all 0.2s",
    }}
      onMouseEnter={e => { e.currentTarget.style.background = "#C9962B"; e.currentTarget.style.color = "#05090F" }}
      onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#C9962B" }}
    >
      <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
      </svg>
      Download Report
    </button>
  )
}

// Inline popover for ? tooltips
function InfoPopover({ content, onClose }: { content: React.ReactNode, onClose: () => void }) {
  return (
    <div style={{
      position: "absolute", top: "calc(100% + 8px)", left: 0, zIndex: 200,
      background: "#0d1526", border: "1px solid #1A2E4A",
      borderRadius: "3px", padding: "1rem 1.25rem",
      width: "280px", boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
    }}>
      <button onClick={onClose} style={{
        position: "absolute", top: "8px", right: "10px",
        background: "none", border: "none", color: "#6E7D94",
        fontSize: "14px", cursor: "pointer", lineHeight: 1, padding: 0,
      }}>✕</button>
      {content}
    </div>
  )
}

export default function CasePage() {
  const [caseData, setCaseData] = useState<Case | null>(null)
  const [policyFile, setPolicyFile] = useState<File | null>(null)
  const [caseFile, setCaseFile] = useState<File | null>(null)
  const [context, setContext] = useState("")
  const [analyzing, setAnalyzing] = useState(false)
  const [statusMsg, setStatusMsg] = useState("")
  const statusInterval = useRef<any>(null)
  const [results, setResults] = useState<any>(null)
  const [error, setError] = useState("")
  const [fileError, setFileError] = useState<{ policy?: string, case?: string }>({})
  const [activeTab, setActiveTab] = useState("findings")
  const [policyDrag, setPolicyDrag] = useState(false)
  const [caseDrag, setCaseDrag] = useState(false)
  const [policyPopover, setPolicyPopover] = useState(false)
  const [casePopover, setCasePopover] = useState(false)
  const router = useRouter()
  const params = useParams()
  const supabase = createClient()

  const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB

  const validateFile = (file: File, field: "policy" | "case"): boolean => {
    if (file.size > MAX_FILE_SIZE) {
      setFileError(prev => ({ ...prev, [field]: `File exceeds 5MB. Please split into 10-page sections and upload separately.` }))
      return false
    }
    setFileError(prev => ({ ...prev, [field]: undefined }))
    return true
  }

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push("/login"); return }
      const { data } = await supabase.from("cases").select("*").eq("id", params.id).single()
      if (!data) { router.push("/dashboard"); return }
      setCaseData(data)
      if (data.last_analysis) setResults(data.last_analysis)
    }
    load()
  }, [])

  const runAnalysis = async () => {
    if (!policyFile || !caseFile) return
    setAnalyzing(true)
    setError("")
    setResults(null)
    const stages = [
      "Reading policy document...",
      "Parsing coverage terms and limits...",
      "Cross-referencing case file...",
      "Identifying exclusions and conflicts...",
      "Calculating recovery opportunities...",
      "Building attorney flags...",
      "Compiling findings...",
      "Finalizing analysis...",
    ]
    let i = 0
    setStatusMsg(stages[0])
    statusInterval.current = setInterval(() => {
      i = Math.min(i + 1, stages.length - 1)
      setStatusMsg(stages[i])
    }, 6000)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", user?.id).single()
      const fd = new FormData()
      fd.append("policy", policyFile)
      fd.append("case_file", caseFile)
      fd.append("context", context)
      fd.append("case_id", caseData?.id || "")
      fd.append("case_name", caseData?.name || "")
      fd.append("user_email", user?.email || "")
      fd.append("firm_name", profile?.full_name || "")
      const resp = await fetch("https://app.themisos.ai/cross-examine", { method: "POST", body: fd })
      const data = await resp.json()
      if (!resp.ok || data.error) { setError(data.error || "Analysis failed"); setAnalyzing(false); return }
      setResults(data)
      const parseExposure = (raw: string | number): number => {
        if (!raw) return 0
        if (typeof raw === "number") return Math.round(raw)
        const s = raw.toString().toUpperCase().replace(/,/g, "").trim()
        const num = parseFloat(s.replace(/[^0-9.]/g, ""))
        if (isNaN(num)) return 0
        if (s.includes("B")) return Math.round(num * 1_000_000_000)
        if (s.includes("M")) return Math.round(num * 1_000_000)
        if (s.includes("K")) return Math.round(num * 1_000)
        return Math.round(num)
      }
      const recoveryTotal = (data.recovery_opportunities || []).reduce((sum: number, r: any) => {
        return sum + parseExposure(r.estimated_exposure || "")
      }, 0)
      await supabase.from("cases").update({
        documents_analyzed: (caseData?.documents_analyzed || 0) + 2,
        recovery_identified: recoveryTotal,
        last_analysis: data
      }).eq("id", params.id)
      setCaseData(prev => prev ? { ...prev, documents_analyzed: (prev.documents_analyzed || 0) + 2, recovery_identified: recoveryTotal } : prev)
    } catch (e: any) {
      setError("Backend unreachable: " + e.message)
    }
    clearInterval(statusInterval.current)
    setStatusMsg("")
    setAnalyzing(false)
  }

  if (!caseData) return (
    <div style={{ minHeight: "100vh", backgroundColor: "#05090F", display: "flex", alignItems: "center", justifyContent: "center", color: "#6E7D94", fontFamily: "'Syne', sans-serif", fontSize: "13px", letterSpacing: "0.08em" }}>
      Loading...
    </div>
  )

  const verdictColor = results?.verdict === "covered" ? "#22c987" : results?.verdict === "not_covered" ? "#ff5a5a" : results?.verdict === "partial" ? "#f0a030" : "#60c8f0"
  const verdictLabel = results?.verdict === "covered" ? "Covered" : results?.verdict === "not_covered" ? "Not Covered" : results?.verdict === "partial" ? "Partial Coverage" : "Unclear"

  const tierGroups = results?.recovery_opportunities ? {
    tier1: (results.recovery_opportunities as any[]).filter((r: any) => r.confidence === "high"),
    tier2: (results.recovery_opportunities as any[]).filter((r: any) => r.confidence === "medium"),
    tier3: (results.recovery_opportunities as any[]).filter((r: any) => r.confidence === "low"),
  } : null

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#05090F", color: "#EDE6D0", fontFamily: "'Syne', sans-serif", fontSize: "14px" }}>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;0,700;1,400;1,600&family=Syne:wght@400;500;600;700&display=swap');
        @media print {
          .no-print { display: none !important; }
          .print-report { display: block !important; }
          body { background: #fff !important; }
          @page { margin: 0.75in; size: letter; }
        }
        @media screen { .print-report { display: none !important; } }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100%{opacity:0.3;transform:scale(1)} 50%{opacity:1;transform:scale(1.3)} }
      `}</style>

      {/* ── PRINT REPORT (unchanged) ── */}
      {results && (
        <div className="print-report" style={{ fontFamily: "Georgia, serif", color: "#111", padding: "0", background: "#fff" }}>
          <div style={{ borderBottom: "2px solid #0d0f12", paddingBottom: "16px", marginBottom: "28px", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ fontSize: "24px", fontWeight: 700, letterSpacing: "-0.02em", fontFamily: "Georgia, serif" }}>Themis<span style={{ color: "#C9962B" }}>OS</span></div>
              <div style={{ fontSize: "11px", color: "#666", marginTop: "3px", letterSpacing: "0.1em", textTransform: "uppercase", fontFamily: "Arial, sans-serif" }}>Cross-Examination Analysis Report</div>
            </div>
            <div style={{ textAlign: "right", fontSize: "12px", color: "#555", fontFamily: "Arial, sans-serif", lineHeight: 1.6 }}>
              <div style={{ fontWeight: 600, color: "#111" }}>{caseData.name}</div>
              {caseData.claimant && <div>Claimant: {caseData.claimant}</div>}
              <div>{new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</div>
            </div>
          </div>
          {/* verdict, findings, coverage, conflicts — print layout unchanged */}
          {results.recommendation && (
            <div style={{ marginBottom: "24px", padding: "14px 18px", background: "#eef2ff", borderRadius: "6px", border: "1px solid #c7d2fe" }}>
              <div style={{ fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.1em", color: "#3355cc", fontFamily: "Arial, sans-serif", fontWeight: 700, marginBottom: "6px" }}>Recommendation</div>
              <div style={{ fontSize: "13px", color: "#1e1e4a", fontFamily: "Arial, sans-serif", lineHeight: 1.7 }}>{results.recommendation}</div>
            </div>
          )}
          <div style={{ marginTop: "48px", paddingTop: "12px", borderTop: "1px solid #ddd", fontSize: "10px", color: "#aaa", textAlign: "center", fontFamily: "Arial, sans-serif" }}>
            Generated by ThemisOS · Confidential Attorney Work Product · {new Date().toLocaleDateString()}
          </div>
        </div>
      )}

      <div className="no-print">

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
          <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
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
              Feature
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
              Policy Cross-Examination
            </h1>
          </div>
        </div>

        {/* ── MAIN CONTENT ── */}
        <div style={{ maxWidth: "1100px", margin: "0 auto", padding: "36px 32px" }}>

          {/* Case heading */}
          <div style={{ marginBottom: "32px" }}>
            <h2 style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontSize: "1.75rem", fontWeight: 600,
              color: "#ffffff", marginBottom: "6px", letterSpacing: "-0.01em",
            }}>{caseData.name}</h2>
            {caseData.claimant && (
              <p style={{ color: "#6E7D94", fontSize: "13px", fontFamily: "'Syne', sans-serif", letterSpacing: "0.02em" }}>
                Claimant: {caseData.claimant}
              </p>
            )}
          </div>

          {/* ── UPLOAD CARDS ── */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginBottom: "12px" }}>

            {/* Policy upload */}
            <div style={{
              background: "#0A1220",
              border: "1px solid " + (fileError.policy ? "#ff5a5a" : policyFile ? "#22c987" : policyDrag ? "#C9962B" : "#1A2E4A"),
              borderRadius: "3px", overflow: "visible", transition: "border-color 0.2s", position: "relative",
            }}
              onDragOver={e => { e.preventDefault(); setPolicyDrag(true) }}
              onDragLeave={() => setPolicyDrag(false)}
              onDrop={e => {
                e.preventDefault(); setPolicyDrag(false)
                const f = e.dataTransfer.files[0]
                if (f) { if (validateFile(f, "policy")) setPolicyFile(f) }
              }}>
              <div style={{ padding: "11px 16px", borderBottom: "1px solid #1A2E4A", display: "flex", alignItems: "center", gap: "8px", background: "#0d1526", position: "relative" }}>
                <div style={{ width: "7px", height: "7px", borderRadius: "50%", background: "#4f7cff", flexShrink: 0 }}></div>
                <span style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#9A927E", fontFamily: "'Syne', sans-serif" }}>
                  Insurance Policy
                </span>
                {/* ? button */}
                <button
                  onClick={() => { setPolicyPopover(v => !v); setCasePopover(false) }}
                  style={{ marginLeft: "6px", width: "16px", height: "16px", borderRadius: "50%", background: "transparent", border: "1px solid #1A2E4A", color: "#6E7D94", fontSize: "9px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Syne', sans-serif", fontWeight: 700, flexShrink: 0, transition: "all 0.2s" }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = "#C9962B"; e.currentTarget.style.color = "#C9962B" }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = "#1A2E4A"; e.currentTarget.style.color = "#6E7D94" }}
                >?</button>
                {policyPopover && (
                  <InfoPopover onClose={() => setPolicyPopover(false)} content={
                    <div>
                      <div style={{ fontFamily: "'Syne', sans-serif", fontSize: "10px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#C9962B", marginBottom: "8px" }}>What to upload</div>
                      <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "6px" }}>
                        {["Declarations page", "Policy schedule", "Endorsements", "Coverage summary"].map(item => (
                          <li key={item} style={{ fontSize: "12px", color: "#9A927E", fontFamily: "Georgia, serif", fontStyle: "italic", display: "flex", gap: "8px", alignItems: "flex-start" }}>
                            <span style={{ color: "#7A5A18", flexShrink: 0, marginTop: "1px" }}>—</span>{item}
                          </li>
                        ))}
                      </ul>
                      <div style={{ marginTop: "10px", paddingTop: "10px", borderTop: "1px solid #1A2E4A", fontSize: "11px", color: "#6E7D94", fontFamily: "'Syne', sans-serif", lineHeight: 1.6 }}>
                        5MB limit per file. If your policy is larger, upload the declarations and relevant sections first.
                      </div>
                    </div>
                  } />
                )}
              </div>
              <div onClick={() => document.getElementById("policy-input")?.click()} style={{ padding: "40px 20px", textAlign: "center", cursor: "pointer" }}>
                <input id="policy-input" type="file" accept=".pdf,.txt,.docx" style={{ display: "none" }}
                  onChange={e => { const f = e.target.files?.[0]; if (f) { if (validateFile(f, "policy")) setPolicyFile(f) } }} />
                <div style={{ width: "44px", height: "44px", border: "1.5px " + (policyFile ? "solid #22c987" : "dashed #2A3F5F"), borderRadius: "3px", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}>
                  {policyFile ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#22c987" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6E7D94" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                  )}
                </div>
                <div style={{ fontSize: "13px", fontFamily: "Georgia, serif", fontStyle: "italic", color: policyFile ? "#22c987" : "#9A927E", marginBottom: "4px" }}>
                  {policyFile ? policyFile.name : "Drop policy file here"}
                </div>
                {!policyFile && <div style={{ fontSize: "12px", color: "#6E7D94", fontFamily: "'Syne', sans-serif" }}>Click to browse</div>}
                <div style={{ fontSize: "11px", color: "#3A4A5E", marginTop: "8px", fontFamily: "'Syne', sans-serif", letterSpacing: "0.04em" }}>PDF · TXT · DOCX — 5MB max</div>
              </div>
              {fileError.policy && (
                <div style={{ padding: "8px 16px", borderTop: "1px solid #1A2E4A", background: "rgba(255,90,90,0.06)", fontSize: "11px", color: "#ff5a5a", fontFamily: "'Syne', sans-serif", lineHeight: 1.5 }}>
                  {fileError.policy}
                </div>
              )}
            </div>

            {/* Case file upload */}
            <div style={{
              background: "#0A1220",
              border: "1px solid " + (fileError.case ? "#ff5a5a" : caseFile ? "#22c987" : caseDrag ? "#C9962B" : "#1A2E4A"),
              borderRadius: "3px", overflow: "visible", transition: "border-color 0.2s", position: "relative",
            }}
              onDragOver={e => { e.preventDefault(); setCaseDrag(true) }}
              onDragLeave={() => setCaseDrag(false)}
              onDrop={e => {
                e.preventDefault(); setCaseDrag(false)
                const f = e.dataTransfer.files[0]
                if (f) { if (validateFile(f, "case")) setCaseFile(f) }
              }}>
              <div style={{ padding: "11px 16px", borderBottom: "1px solid #1A2E4A", display: "flex", alignItems: "center", gap: "8px", background: "#0d1526", position: "relative" }}>
                <div style={{ width: "7px", height: "7px", borderRadius: "50%", background: "#f0a030", flexShrink: 0 }}></div>
                <span style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#9A927E", fontFamily: "'Syne', sans-serif" }}>
                  Case File
                </span>
                <button
                  onClick={() => { setCasePopover(v => !v); setPolicyPopover(false) }}
                  style={{ marginLeft: "6px", width: "16px", height: "16px", borderRadius: "50%", background: "transparent", border: "1px solid #1A2E4A", color: "#6E7D94", fontSize: "9px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Syne', sans-serif", fontWeight: 700, flexShrink: 0, transition: "all 0.2s" }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = "#C9962B"; e.currentTarget.style.color = "#C9962B" }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = "#1A2E4A"; e.currentTarget.style.color = "#6E7D94" }}
                >?</button>
                {casePopover && (
                  <InfoPopover onClose={() => setCasePopover(false)} content={
                    <div>
                      <div style={{ fontFamily: "'Syne', sans-serif", fontSize: "10px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#C9962B", marginBottom: "8px" }}>What to upload</div>
                      <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "6px" }}>
                        {["Police report", "Medical records", "Incident report", "Demand letter"].map(item => (
                          <li key={item} style={{ fontSize: "12px", color: "#9A927E", fontFamily: "Georgia, serif", fontStyle: "italic", display: "flex", gap: "8px", alignItems: "flex-start" }}>
                            <span style={{ color: "#7A5A18", flexShrink: 0, marginTop: "1px" }}>—</span>{item}
                          </li>
                        ))}
                      </ul>
                      <div style={{ marginTop: "10px", paddingTop: "10px", borderTop: "1px solid #1A2E4A", fontSize: "11px", color: "#6E7D94", fontFamily: "'Syne', sans-serif", lineHeight: 1.6 }}>
                        5MB limit per file. If your case file is larger, upload the most relevant sections first.
                      </div>
                    </div>
                  } />
                )}
              </div>
              <div onClick={() => document.getElementById("case-input")?.click()} style={{ padding: "40px 20px", textAlign: "center", cursor: "pointer" }}>
                <input id="case-input" type="file" accept=".pdf,.txt,.docx" style={{ display: "none" }}
                  onChange={e => { const f = e.target.files?.[0]; if (f) { if (validateFile(f, "case")) setCaseFile(f) } }} />
                <div style={{ width: "44px", height: "44px", border: "1.5px " + (caseFile ? "solid #22c987" : "dashed #2A3F5F"), borderRadius: "3px", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}>
                  {caseFile ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#22c987" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6E7D94" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
                  )}
                </div>
                <div style={{ fontSize: "13px", fontFamily: "Georgia, serif", fontStyle: "italic", color: caseFile ? "#22c987" : "#9A927E", marginBottom: "4px" }}>
                  {caseFile ? caseFile.name : "Drop case file here"}
                </div>
                {!caseFile && <div style={{ fontSize: "12px", color: "#6E7D94", fontFamily: "'Syne', sans-serif" }}>Click to browse</div>}
                <div style={{ fontSize: "11px", color: "#3A4A5E", marginTop: "8px", fontFamily: "'Syne', sans-serif", letterSpacing: "0.04em" }}>PDF · TXT · DOCX — 5MB max</div>
              </div>
              {fileError.case && (
                <div style={{ padding: "8px 16px", borderTop: "1px solid #1A2E4A", background: "rgba(255,90,90,0.06)", fontSize: "11px", color: "#ff5a5a", fontFamily: "'Syne', sans-serif", lineHeight: 1.5 }}>
                  {fileError.case}
                </div>
              )}
            </div>
          </div>

          {/* File size note */}
          <p style={{ fontSize: "11px", color: "#3A4A5E", fontFamily: "'Syne', sans-serif", letterSpacing: "0.03em", marginBottom: "24px", lineHeight: 1.6 }}>
            If your document exceeds 5MB, we recommend splitting it into 10-page sections and running the analysis in parts.
          </p>

          {/* Optional context */}
          <div style={{ background: "#0A1220", border: "1px solid #1A2E4A", borderRadius: "3px", overflow: "hidden", marginBottom: "24px" }}>
            <div style={{ padding: "10px 16px", borderBottom: "1px solid #1A2E4A", background: "#0d1526", fontSize: "11px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#9A927E", fontFamily: "'Syne', sans-serif" }}>
              Optional Context
            </div>
            <textarea
              value={context}
              onChange={e => setContext(e.target.value)}
              placeholder="e.g. Focus on liability exclusions. Incident occurred 03/15/2024 involving commercial vehicle on I-90..."
              style={{ width: "100%", display: "block", background: "transparent", border: "none", outline: "none", color: "#EDE6D0", fontFamily: "Georgia, serif", fontStyle: "italic", fontSize: "13px", padding: "14px 16px", resize: "vertical", minHeight: "72px", lineHeight: 1.6 }}
            />
          </div>

          {error && (
            <div style={{ background: "rgba(255,90,90,0.08)", border: "1px solid rgba(255,90,90,0.3)", borderRadius: "3px", padding: "14px 18px", marginBottom: "24px", fontSize: "13px", color: "#ff5a5a", fontFamily: "'Syne', sans-serif" }}>
              {error}
            </div>
          )}

          {/* Run button */}
          <button
            onClick={runAnalysis}
            disabled={!policyFile || !caseFile || analyzing}
            style={{
              width: "100%", padding: "14px",
              background: (!policyFile || !caseFile || analyzing) ? "#0A1220" : "#C9962B",
              color: (!policyFile || !caseFile || analyzing) ? "#3A4A5E" : "#05090F",
              border: "1px solid " + ((!policyFile || !caseFile || analyzing) ? "#1A2E4A" : "#C9962B"),
              borderRadius: "2px",
              fontSize: "12px", fontWeight: 700,
              fontFamily: "'Syne', sans-serif",
              cursor: (!policyFile || !caseFile || analyzing) ? "not-allowed" : "pointer",
              transition: "all 0.2s",
              letterSpacing: "0.12em", textTransform: "uppercase",
              marginBottom: "32px",
            }}
            onMouseEnter={e => { if (policyFile && caseFile && !analyzing) e.currentTarget.style.background = "#E2B44A" }}
            onMouseLeave={e => { if (policyFile && caseFile && !analyzing) e.currentTarget.style.background = "#C9962B" }}
          >
            {analyzing ? (
              <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "10px" }}>
                <span style={{ display: "inline-block", width: "13px", height: "13px", border: "2px solid rgba(255,255,255,0.2)", borderTopColor: "#C9962B", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                {statusMsg}
              </span>
            ) : "Run Cross-Examination"}
          </button>

          {/* ── RESULTS ── */}
          {results && (
            <div>
              {/* Verdict */}
              <div style={{
                borderRadius: "3px", padding: "20px 24px", marginBottom: "24px",
                display: "flex", alignItems: "center", gap: "20px",
                border: "1px solid " + verdictColor,
                background: results.verdict === "covered" ? "rgba(34,201,135,0.07)" : results.verdict === "not_covered" ? "rgba(255,90,90,0.07)" : results.verdict === "partial" ? "rgba(240,160,48,0.07)" : "rgba(96,200,240,0.07)",
              }}>
                <div style={{ flexShrink: 0 }}>
                  <div style={{ fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.12em", color: "#6E7D94", marginBottom: "6px", fontFamily: "'Syne', sans-serif" }}>Overall Verdict</div>
                  <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "1.5rem", fontWeight: 600, color: verdictColor }}>{verdictLabel}</div>
                </div>
                <div style={{ fontFamily: "Georgia, serif", fontStyle: "italic", fontSize: "14px", color: "#9A927E", lineHeight: 1.7, flex: 1 }}>{results.summary}</div>
                <DownloadReportButton results={results} caseData={caseData} />
              </div>

              {/* Recovery opportunities with tiers */}
              {tierGroups && (tierGroups.tier1.length > 0 || tierGroups.tier2.length > 0 || tierGroups.tier3.length > 0) && (
                <div style={{ background: "#0A1220", border: "1px solid #1A2E4A", borderRadius: "3px", padding: "20px 24px", marginBottom: "24px" }}>
                  <div style={{ fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.12em", color: "#C9962B", marginBottom: "20px", fontFamily: "'Syne', sans-serif", fontWeight: 700 }}>Recovery Opportunities</div>

                  {tierGroups.tier1.length > 0 && (
                    <div style={{ marginBottom: "20px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
                        <div style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#22c987", fontFamily: "'Syne', sans-serif" }}>Tier 1</div>
                        <div style={{ fontSize: "11px", color: "#6E7D94", fontFamily: "Georgia, serif", fontStyle: "italic" }}>High Confidence</div>
                        <div style={{ flex: 1, height: "1px", background: "#1A2E4A" }}></div>
                      </div>
                      {tierGroups.tier1.map((r: any, i: number) => (
                        <div key={i} style={{ padding: "12px 16px", background: "#0d1526", border: "1px solid #1A2E4A", borderLeft: "3px solid #22c987", borderRadius: "0 3px 3px 0", marginBottom: "8px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ fontSize: "13px", fontFamily: "Georgia, serif", color: "#EDE6D0" }}>{r.theory}</span>
                          <div style={{ textAlign: "right", flexShrink: 0, marginLeft: "20px" }}>
                            <div style={{ fontSize: "14px", color: "#C9962B", fontWeight: 600, fontFamily: "'Cormorant Garamond', serif" }}>{r.estimated_exposure}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {tierGroups.tier2.length > 0 && (
                    <div style={{ marginBottom: "20px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
                        <div style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#f0a030", fontFamily: "'Syne', sans-serif" }}>Tier 2</div>
                        <div style={{ fontSize: "11px", color: "#6E7D94", fontFamily: "Georgia, serif", fontStyle: "italic" }}>Medium Confidence</div>
                        <div style={{ flex: 1, height: "1px", background: "#1A2E4A" }}></div>
                      </div>
                      {tierGroups.tier2.map((r: any, i: number) => (
                        <div key={i} style={{ padding: "12px 16px", background: "#0d1526", border: "1px solid #1A2E4A", borderLeft: "3px solid #f0a030", borderRadius: "0 3px 3px 0", marginBottom: "8px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ fontSize: "13px", fontFamily: "Georgia, serif", color: "#EDE6D0" }}>{r.theory}</span>
                          <div style={{ textAlign: "right", flexShrink: 0, marginLeft: "20px" }}>
                            <div style={{ fontSize: "14px", color: "#C9962B", fontWeight: 600, fontFamily: "'Cormorant Garamond', serif" }}>{r.estimated_exposure}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {tierGroups.tier3.length > 0 && (
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
                        <div style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#6E7D94", fontFamily: "'Syne', sans-serif" }}>Tier 3</div>
                        <div style={{ fontSize: "11px", color: "#6E7D94", fontFamily: "Georgia, serif", fontStyle: "italic" }}>Lower Confidence</div>
                        <div style={{ flex: 1, height: "1px", background: "#1A2E4A" }}></div>
                      </div>
                      {tierGroups.tier3.map((r: any, i: number) => (
                        <div key={i} style={{ padding: "12px 16px", background: "#0d1526", border: "1px solid #1A2E4A", borderLeft: "3px solid #3A4A5E", borderRadius: "0 3px 3px 0", marginBottom: "8px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ fontSize: "13px", fontFamily: "Georgia, serif", color: "#9A927E" }}>{r.theory}</span>
                          <div style={{ textAlign: "right", flexShrink: 0, marginLeft: "20px" }}>
                            <div style={{ fontSize: "14px", color: "#7A5A18", fontWeight: 600, fontFamily: "'Cormorant Garamond', serif" }}>{r.estimated_exposure}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Attorney flags */}
              {results.attorney_flags?.length > 0 && (
                <div style={{ background: "#0A1220", border: "1px solid #1A2E4A", borderRadius: "3px", padding: "20px 24px", marginBottom: "24px" }}>
                  <div style={{ fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.12em", color: "#9A927E", marginBottom: "12px", fontFamily: "'Syne', sans-serif", fontWeight: 700 }}>Attorney Flags</div>
                  {results.attorney_flags.map((f: any, i: number) => (
                    <div key={i} style={{ padding: "12px 16px", background: "#0d1526", borderRadius: "0 3px 3px 0", marginBottom: "8px", borderLeft: "3px solid " + (f.priority === "urgent" ? "#ff5a5a" : f.priority === "review" ? "#f0a030" : "#4f7cff") }}>
                      <div style={{ fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.1em", color: f.priority === "urgent" ? "#ff5a5a" : f.priority === "review" ? "#f0a030" : "#4f7cff", marginBottom: "4px", fontFamily: "'Syne', sans-serif" }}>{f.priority}</div>
                      <div style={{ fontSize: "13px", fontFamily: "Georgia, serif", color: "#EDE6D0", lineHeight: 1.6 }}>{f.issue}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Tabs */}
              <div style={{ display: "flex", gap: "2px", background: "#0d1526", border: "1px solid #1A2E4A", borderRadius: "3px", padding: "3px", marginBottom: "20px" }}>
                {["findings", "coverage", "conflicts"].map(tab => (
                  <button key={tab} onClick={() => setActiveTab(tab)} style={{
                    flex: 1, padding: "8px 12px",
                    background: activeTab === tab ? "#0A1220" : "transparent",
                    border: activeTab === tab ? "1px solid #1A2E4A" : "1px solid transparent",
                    borderRadius: "2px",
                    color: activeTab === tab ? "#EDE6D0" : "#6E7D94",
                    fontFamily: "'Syne', sans-serif",
                    fontSize: "11px", cursor: "pointer", fontWeight: activeTab === tab ? 600 : 400,
                    letterSpacing: "0.06em", textTransform: "uppercase", transition: "all 0.2s",
                  }}>
                    {tab === "findings" ? "Key Findings" : tab === "coverage" ? "Coverage Map" : "Conflicts & Gaps"}
                  </button>
                ))}
              </div>

              {activeTab === "findings" && (results.key_findings || []).map((f: any, i: number) => (
                <div key={i} style={{ background: "#0A1220", border: "1px solid #1A2E4A", borderRadius: "0 3px 3px 0", padding: "14px 18px", marginBottom: "10px", borderLeftWidth: "3px", borderLeftColor: f.type === "success" ? "#22c987" : f.type === "danger" ? "#ff5a5a" : f.type === "warning" ? "#f0a030" : "#4f7cff" }}>
                  <div style={{ fontSize: "14px", fontWeight: 600, fontFamily: "'Cormorant Garamond', serif", color: "#ffffff", marginBottom: "6px" }}>{f.title}</div>
                  <div style={{ fontFamily: "Georgia, serif", fontStyle: "italic", fontSize: "13px", color: "#9A927E", lineHeight: 1.7 }}>{f.detail}</div>
                  {f.page_ref && <div style={{ marginTop: "10px", paddingTop: "10px", borderTop: "1px solid #1A2E4A", fontSize: "10px", color: "#7fa3ff", fontFamily: "'Syne', sans-serif", letterSpacing: "0.06em" }}>{f.document} · {f.page_ref}{f.clause ? " · " + f.clause : ""}</div>}
                </div>
              ))}

              {activeTab === "coverage" && (
                <div style={{ background: "#0A1220", border: "1px solid #1A2E4A", borderRadius: "3px", overflow: "hidden" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ borderBottom: "1px solid #1A2E4A" }}>
                        {["Coverage Area", "Status", "Notes", "Reference"].map(h => (
                          <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.1em", color: "#6E7D94", fontWeight: 700, fontFamily: "'Syne', sans-serif" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(results.coverage_items || []).map((item: any, i: number) => (
                        <tr key={i} style={{ borderBottom: "1px solid #1A2E4A" }}>
                          <td style={{ padding: "12px 14px", fontSize: "13px", fontFamily: "Georgia, serif", color: "#EDE6D0", fontWeight: 500 }}>{item.item}</td>
                          <td style={{ padding: "12px 14px" }}>
                            <span style={{ padding: "3px 10px", borderRadius: "2px", fontSize: "10px", fontWeight: 700, fontFamily: "'Syne', sans-serif", letterSpacing: "0.08em", textTransform: "uppercase", background: item.status === "covered" ? "rgba(34,201,135,0.1)" : item.status === "excluded" ? "rgba(255,90,90,0.1)" : "rgba(240,160,48,0.1)", color: item.status === "covered" ? "#22c987" : item.status === "excluded" ? "#ff5a5a" : "#f0a030" }}>{item.status}</span>
                          </td>
                          <td style={{ padding: "12px 14px", fontSize: "13px", fontFamily: "Georgia, serif", fontStyle: "italic", color: "#9A927E" }}>{item.note}</td>
                          <td style={{ padding: "12px 14px", fontSize: "11px", color: "#7fa3ff", fontFamily: "'Syne', sans-serif", letterSpacing: "0.04em" }}>{item.page_ref}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {activeTab === "conflicts" && (
                (results.conflicts || []).length === 0
                  ? <div style={{ background: "#0A1220", border: "1px solid #1A2E4A", borderRadius: "0 3px 3px 0", padding: "14px 18px", borderLeftWidth: "3px", borderLeftColor: "#22c987" }}>
                    <div style={{ fontSize: "14px", fontWeight: 600, fontFamily: "'Cormorant Garamond', serif", color: "#ffffff" }}>No conflicts detected</div>
                    <div style={{ fontSize: "13px", fontFamily: "Georgia, serif", fontStyle: "italic", color: "#9A927E", marginTop: "4px" }}>The case file appears consistent with policy terms.</div>
                  </div>
                  : (results.conflicts || []).map((c: any, i: number) => (
                    <div key={i} style={{ background: "#0A1220", border: "1px solid #1A2E4A", borderRadius: "0 3px 3px 0", padding: "14px 18px", marginBottom: "10px", borderLeftWidth: "3px", borderLeftColor: "#ff5a5a" }}>
                      <div style={{ fontSize: "14px", fontWeight: 600, fontFamily: "'Cormorant Garamond', serif", color: "#ffffff", marginBottom: "6px" }}>{c.title}</div>
                      <div style={{ fontFamily: "Georgia, serif", fontStyle: "italic", fontSize: "13px", color: "#9A927E", lineHeight: 1.7 }}>{c.detail}</div>
                    </div>
                  ))
              )}

              {results.recommendation && (
                <div style={{ background: "rgba(79,124,255,0.06)", border: "1px solid rgba(79,124,255,0.2)", borderRadius: "3px", padding: "18px 22px", marginTop: "20px" }}>
                  <div style={{ fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.12em", color: "#4f7cff", marginBottom: "8px", fontFamily: "'Syne', sans-serif", fontWeight: 700 }}>Recommendation</div>
                  <div style={{ fontFamily: "Georgia, serif", fontStyle: "italic", fontSize: "14px", color: "#EDE6D0", lineHeight: 1.7 }}>{results.recommendation}</div>
                </div>
              )}
            </div>
          )}
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
    </div>
  )
}