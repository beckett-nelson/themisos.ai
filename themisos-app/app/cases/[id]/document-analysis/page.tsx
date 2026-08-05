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
  last_document_analysis?: any
}

const DOC_TYPES = [
  { value: "nda", label: "NDA / Confidentiality" },
  { value: "insurance_policy", label: "Insurance Policy" },
  { value: "renters_agreement", label: "Renters / Lease" },
  { value: "employment_contract", label: "Employment Contract" },
  { value: "service_agreement", label: "Service Agreement" },
  { value: "purchase_agreement", label: "Purchase Agreement" },
  { value: "operating_agreement", label: "Operating / Partnership" },
  { value: "resume", label: "Resume / CV" },
  { value: "other", label: "Other Document" },
]

const DOC_TYPE_LABELS: Record<string, string> = {
  nda: "NDA / Confidentiality Agreement",
  insurance_policy: "Insurance Policy",
  renters_agreement: "Renters / Lease Agreement",
  employment_contract: "Employment Contract",
  service_agreement: "Service Agreement",
  purchase_agreement: "Purchase Agreement",
  operating_agreement: "Operating / Partnership Agreement",
  resume: "Resume / CV",
  other: "Other Document",
}

function DownloadReportButton({ caseData }: { caseData: Case }) {
  const handlePrint = () => {
    document.title = `ThemisOS — ${caseData.name} — Document Analysis`
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

export default function DocumentAnalysisPage() {
  const [caseData, setCaseData] = useState<Case | null>(null)
  const [docFile, setDocFile] = useState<File | null>(null)
  const [documentType, setDocumentType] = useState("other")
  const [context, setContext] = useState("")
  const [analyzing, setAnalyzing] = useState(false)
  const [statusMsg, setStatusMsg] = useState("")
  const statusInterval = useRef<any>(null)
  const [results, setResults] = useState<any>(null)
  const [error, setError] = useState("")
  const [fileError, setFileError] = useState<{ doc?: string }>({})
  const [activeTab, setActiveTab] = useState("governing")
  const [docDrag, setDocDrag] = useState(false)
  const [docPopover, setDocPopover] = useState(false)
  const router = useRouter()
  const params = useParams()
  const supabase = createClient()

  const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB

  const validateFile = (file: File): boolean => {
    if (file.size > MAX_FILE_SIZE) {
      setFileError({ doc: `File exceeds 5MB. Please split into 10-page sections and upload separately.` })
      return false
    }
    setFileError({})
    return true
  }

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push("/login"); return }
      const { data } = await supabase.from("cases").select("*").eq("id", params.id).single()
      if (!data) { router.push("/dashboard"); return }
      setCaseData(data)
      if (data.last_document_analysis) {
        setResults(data.last_document_analysis)
        // Restore the type the saved analysis was actually run against so
        // labels and tabs match the stored result, not a stale default.
        if (data.last_document_analysis.document_type_submitted) {
          setDocumentType(data.last_document_analysis.document_type_submitted)
        }
      }
    }
    load()
  }, [])

  const runAnalysis = async () => {
    if (!docFile || !documentType) return
    setAnalyzing(true)
    setError("")
    setResults(null)
    const stages = documentType === "resume" ? [
      "Reading resume...",
      "Identifying candidate and current role...",
      "Reviewing experience and credentials...",
      "Checking dates for gaps and overlaps...",
      "Flagging inconsistencies and thin claims...",
      "Grading overall candidate strength...",
      "Compiling analysis...",
    ] : [
      "Reading document...",
      "Identifying document type and parties...",
      "Reviewing provisions and protections...",
      "Flagging weak and missing clauses...",
      "Assessing governing terms and deadlines...",
      "Grading overall document strength...",
      "Compiling analysis...",
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
      fd.append("document", docFile)
      fd.append("document_type", documentType)
      fd.append("context", context)
      fd.append("case_id", caseData?.id || "")
      fd.append("case_name", caseData?.name || "")
      fd.append("user_email", user?.email || "")
      fd.append("firm_name", profile?.full_name || "")
      const resp = await fetch("https://app.themisos.ai/analyze-document", { method: "POST", body: fd })
      const data = await resp.json()
      if (!resp.ok || data.error) { setError(data.error || "Analysis failed"); setAnalyzing(false); return }
      // Stamp the submitted type onto the result so a reloaded analysis renders
      // with the correct labels even if the toggle is later changed.
      const stamped = { ...data, document_type_submitted: documentType }
      setResults(stamped)
      // NOTE: recovery_identified is intentionally NOT written here.
      // Recovery is tracked ONLY by the cross-examine flow. Document Analysis
      // contributes to documents_analyzed (the cross-feature count) and persists
      // its own result in last_document_analysis.
      await supabase.from("cases").update({
        documents_analyzed: (caseData?.documents_analyzed || 0) + 1,
        last_document_analysis: stamped
      }).eq("id", params.id)
      setCaseData(prev => prev ? { ...prev, documents_analyzed: (prev.documents_analyzed || 0) + 1 } : prev)
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

  // ── Resume-aware labeling ──
  // The result schema is identical for every document type; only the language changes.
  const analyzedType = results?.document_type_submitted || documentType
  const isResume = analyzedType === "resume"

  const gradeColor =
    results?.document_grade === "I" ? "#22c987" :
    results?.document_grade === "II" ? "#f0a030" :
    results?.document_grade === "III" ? "#ff5a5a" : "#60c8f0"
  const gradeLabel = isResume
    ? (results?.document_grade === "I" ? "I · Strong Candidate" :
       results?.document_grade === "II" ? "II · Qualified" :
       results?.document_grade === "III" ? "III · Concerns" : "Unrated")
    : (results?.document_grade === "I" ? "I · Counsel Grade" :
       results?.document_grade === "II" ? "II · Standard" :
       results?.document_grade === "III" ? "III · At Risk" : "Unrated")
  const gradeBg =
    results?.document_grade === "I" ? "rgba(34,201,135,0.07)" :
    results?.document_grade === "II" ? "rgba(240,160,48,0.07)" :
    results?.document_grade === "III" ? "rgba(255,90,90,0.07)" : "rgba(96,200,240,0.07)"

  const gradeHeading = isResume ? "Candidate Grade" : "Document Grade"
  const strongHeading = isResume ? "Credentials & Strengths" : "Strong Provisions"
  const weakHeading = isResume ? "Gaps & Concerns" : "Weak / Missing / One-Sided Provisions"
  const flagsHeading = isResume ? "Screening Flags" : "Attorney Flags"
  const profileTabLabel = isResume ? "Candidate Profile" : "Governing Terms"
  const datesTabLabel = isResume ? "Dates & Gaps" : "Deadlines"

  const sevColor = (s: string) => s === "high" ? "#ff5a5a" : s === "medium" ? "#f0a030" : "#4f7cff"
  const gov = results?.governing_terms || {}

  // Rows shown in the first tab, swapped by document type.
  const profileRows = isResume ? [
    { label: "Candidate", value: gov.candidate },
    { label: "Current Role", value: gov.current_role },
    { label: "Experience", value: gov.experience_summary },
    { label: "Credentials / Admissions", value: gov.credentials },
  ] : [
    { label: "Governing Law", value: gov.governing_law },
    { label: "Jurisdiction / Venue", value: gov.jurisdiction_venue },
    { label: "Notice Requirements", value: gov.notice_requirements },
    { label: "Key Dates", value: gov.key_dates },
  ]
  const hasProfileData = profileRows.some(r => r.value)

  const uploadExamples = documentType === "resume"
    ? ["Candidate resume or CV", "Expert witness curriculum vitae", "Attorney or paralegal application", "Consultant or vendor bio packet"]
    : ["NDA or confidentiality agreement", "Insurance policy", "Lease or rental agreement", "Employment contract", "Service or vendor agreement", "Operating or partnership agreement"]

  const uploadNote = documentType === "resume"
    ? "No case file needed — this reviews the resume on its own terms. 5MB limit per file."
    : "No case file needed — this reviews the document on its own terms. 5MB limit per file; if larger, upload the most relevant sections first."

  const contextPlaceholder = documentType === "resume"
    ? "e.g. Screening for a mid-level litigation associate. Flag thin trial experience, unexplained gaps, and any credential claims worth verifying..."
    : "e.g. Reviewing on behalf of the receiving party. Flag any indefinite confidentiality terms and missing carve-outs..."

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

      {/* ── PRINT REPORT ── */}
      {results && (
        <div className="print-report" style={{ fontFamily: "Georgia, serif", color: "#111", padding: "0", background: "#fff" }}>
          <div style={{ borderBottom: "2px solid #0d0f12", paddingBottom: "16px", marginBottom: "28px", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ fontSize: "24px", fontWeight: 700, letterSpacing: "-0.02em", fontFamily: "Georgia, serif" }}>Themis<span style={{ color: "#C9962B" }}>OS</span></div>
              <div style={{ fontSize: "11px", color: "#666", marginTop: "3px", letterSpacing: "0.1em", textTransform: "uppercase", fontFamily: "Arial, sans-serif" }}>
                {isResume ? "Resume Review" : "Document Analysis Report"} · {DOC_TYPE_LABELS[analyzedType] || "Document"}
              </div>
            </div>
            <div style={{ textAlign: "right", fontSize: "12px", color: "#555", fontFamily: "Arial, sans-serif", lineHeight: 1.6 }}>
              <div style={{ fontWeight: 600, color: "#111" }}>{caseData.name}</div>
              {results.document_type_detected && <div>Detected: {results.document_type_detected}</div>}
              {!isResume && results.favors && <div>Favors: {results.favors}</div>}
              <div>{new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</div>
            </div>
          </div>

          {/* Grade */}
          <div style={{ marginBottom: "24px", padding: "14px 18px", background: "#f5f7fa", borderRadius: "6px", border: "1px solid #dde3ec" }}>
            <div style={{ fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.1em", color: "#555", fontFamily: "Arial, sans-serif", fontWeight: 700, marginBottom: "6px" }}>{gradeHeading} — {gradeLabel}</div>
            <div style={{ fontSize: "13px", color: "#222", fontFamily: "Arial, sans-serif", lineHeight: 1.7 }}>{results.grade_summary}</div>
          </div>

          {/* Strong provisions */}
          {results.strong_provisions?.length > 0 && (
            <div style={{ marginBottom: "24px" }}>
              <div style={{ fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.08em", color: "#111", fontFamily: "Arial, sans-serif", fontWeight: 700, marginBottom: "10px", borderBottom: "1px solid #ddd", paddingBottom: "4px" }}>{strongHeading}</div>
              {results.strong_provisions.map((p: any, i: number) => (
                <div key={i} style={{ marginBottom: "8px", fontSize: "12px", fontFamily: "Arial, sans-serif", lineHeight: 1.6 }}>
                  <span style={{ fontWeight: 700, color: "#111" }}>{p.provision}{p.clause ? ` · ${p.clause}` : ""}:</span> {p.detail} {p.page_ref ? `(${p.page_ref})` : ""}
                </div>
              ))}
            </div>
          )}

          {/* Weak provisions */}
          {results.weak_provisions?.length > 0 && (
            <div style={{ marginBottom: "24px" }}>
              <div style={{ fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.08em", color: "#111", fontFamily: "Arial, sans-serif", fontWeight: 700, marginBottom: "10px", borderBottom: "1px solid #ddd", paddingBottom: "4px" }}>{weakHeading}</div>
              {results.weak_provisions.map((p: any, i: number) => (
                <div key={i} style={{ marginBottom: "8px", fontSize: "12px", fontFamily: "Arial, sans-serif", lineHeight: 1.6 }}>
                  <span style={{ fontWeight: 700, color: "#111" }}>{p.provision}{p.clause ? ` · ${p.clause}` : ""} <span style={{ fontWeight: 400, color: "#888" }}>[{(p.issue || "").replace(/_/g, " ")} · {p.severity}]</span>:</span> {p.detail} {p.page_ref ? `(${p.page_ref})` : "—"}
                </div>
              ))}
            </div>
          )}

          {/* Governing terms / candidate profile */}
          {hasProfileData && (
            <div style={{ marginBottom: "24px" }}>
              <div style={{ fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.08em", color: "#111", fontFamily: "Arial, sans-serif", fontWeight: 700, marginBottom: "10px", borderBottom: "1px solid #ddd", paddingBottom: "4px" }}>{profileTabLabel}</div>
              {profileRows.map((row, i) => row.value ? (
                <div key={i} style={{ fontSize: "12px", fontFamily: "Arial, sans-serif", lineHeight: 1.6 }}><strong>{row.label}:</strong> {row.value}</div>
              ) : null)}
            </div>
          )}

          {/* Deadlines / dates & gaps */}
          {results.deadlines?.length > 0 && (
            <div style={{ marginBottom: "24px" }}>
              <div style={{ fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.08em", color: "#b00020", fontFamily: "Arial, sans-serif", fontWeight: 700, marginBottom: "10px", borderBottom: "1px solid #ddd", paddingBottom: "4px" }}>{datesTabLabel}</div>
              {results.deadlines.map((d: any, i: number) => (
                <div key={i} style={{ marginBottom: "8px", fontSize: "12px", fontFamily: "Arial, sans-serif", lineHeight: 1.6 }}>
                  <span style={{ fontWeight: 700, color: "#111", textTransform: "capitalize" }}>{(d.type || "").replace(/_/g, " ")}:</span> {d.description} — <em>{d.timeframe}</em> {d.page_ref ? `(${d.page_ref})` : ""}
                </div>
              ))}
            </div>
          )}

          {/* Next steps */}
          {results.recommended_next_steps?.length > 0 && (
            <div style={{ marginBottom: "24px" }}>
              <div style={{ fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.08em", color: "#111", fontFamily: "Arial, sans-serif", fontWeight: 700, marginBottom: "10px", borderBottom: "1px solid #ddd", paddingBottom: "4px" }}>Recommended Next Steps</div>
              <ol style={{ margin: 0, paddingLeft: "18px" }}>
                {results.recommended_next_steps.map((s: any, i: number) => (
                  <li key={i} style={{ marginBottom: "6px", fontSize: "12px", fontFamily: "Arial, sans-serif", lineHeight: 1.6, color: "#222" }}>
                    <strong>{s.step}</strong>{s.rationale ? ` — ${s.rationale}` : ""}
                  </li>
                ))}
              </ol>
            </div>
          )}

          <div style={{ marginTop: "48px", paddingTop: "12px", borderTop: "1px solid #ddd", fontSize: "10px", color: "#aaa", textAlign: "center", fontFamily: "Arial, sans-serif" }}>
            Generated by ThemisOS · {isResume ? "Confidential — Internal Hiring Use Only" : "Confidential Attorney Work Product"} · {new Date().toLocaleDateString()}
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
              Document Analysis
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

          {/* ── DOCUMENT TYPE TOGGLE ── */}
          <div style={{ marginBottom: "20px" }}>
            <div style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#9A927E", fontFamily: "'Syne', sans-serif", marginBottom: "12px" }}>
              Document Type
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px" }}>
              {DOC_TYPES.map(dt => {
                const selected = documentType === dt.value
                return (
                  <button key={dt.value} onClick={() => setDocumentType(dt.value)} style={{
                    padding: "11px 14px",
                    background: selected ? "rgba(201,150,43,0.10)" : "#0A1220",
                    border: "1px solid " + (selected ? "#C9962B" : "#1A2E4A"),
                    borderRadius: "3px",
                    color: selected ? "#C9962B" : "#9A927E",
                    fontFamily: "'Syne', sans-serif",
                    fontSize: "12px",
                    fontWeight: selected ? 700 : 500,
                    letterSpacing: "0.02em",
                    cursor: "pointer",
                    textAlign: "left",
                    transition: "all 0.2s",
                  }}
                    onMouseEnter={e => { if (!selected) { e.currentTarget.style.borderColor = "#2A3F5F"; e.currentTarget.style.color = "#EDE6D0" } }}
                    onMouseLeave={e => { if (!selected) { e.currentTarget.style.borderColor = "#1A2E4A"; e.currentTarget.style.color = "#9A927E" } }}
                  >
                    {dt.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* ── UPLOAD CARD (single) ── */}
          <div style={{ marginBottom: "12px" }}>
            <div style={{
              background: "#0A1220",
              border: "1px solid " + (fileError.doc ? "#ff5a5a" : docFile ? "#22c987" : docDrag ? "#C9962B" : "#1A2E4A"),
              borderRadius: "3px", overflow: "visible", transition: "border-color 0.2s", position: "relative",
            }}
              onDragOver={e => { e.preventDefault(); setDocDrag(true) }}
              onDragLeave={() => setDocDrag(false)}
              onDrop={e => {
                e.preventDefault(); setDocDrag(false)
                const f = e.dataTransfer.files[0]
                if (f) { if (validateFile(f)) setDocFile(f) }
              }}>
              <div style={{ padding: "11px 16px", borderBottom: "1px solid #1A2E4A", display: "flex", alignItems: "center", gap: "8px", background: "#0d1526", position: "relative" }}>
                <div style={{ width: "7px", height: "7px", borderRadius: "50%", background: "#C9962B", flexShrink: 0 }}></div>
                <span style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#9A927E", fontFamily: "'Syne', sans-serif" }}>
                  {documentType === "resume" ? "Resume" : "Document"}
                </span>
                {/* ? button */}
                <button
                  onClick={() => setDocPopover(v => !v)}
                  style={{ marginLeft: "6px", width: "16px", height: "16px", borderRadius: "50%", background: "transparent", border: "1px solid #1A2E4A", color: "#6E7D94", fontSize: "9px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Syne', sans-serif", fontWeight: 700, flexShrink: 0, transition: "all 0.2s" }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = "#C9962B"; e.currentTarget.style.color = "#C9962B" }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = "#1A2E4A"; e.currentTarget.style.color = "#6E7D94" }}
                >?</button>
                {docPopover && (
                  <InfoPopover onClose={() => setDocPopover(false)} content={
                    <div>
                      <div style={{ fontFamily: "'Syne', sans-serif", fontSize: "10px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#C9962B", marginBottom: "8px" }}>What to upload</div>
                      <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "6px" }}>
                        {uploadExamples.map(item => (
                          <li key={item} style={{ fontSize: "12px", color: "#9A927E", fontFamily: "Georgia, serif", fontStyle: "italic", display: "flex", gap: "8px", alignItems: "flex-start" }}>
                            <span style={{ color: "#7A5A18", flexShrink: 0, marginTop: "1px" }}>—</span>{item}
                          </li>
                        ))}
                      </ul>
                      <div style={{ marginTop: "10px", paddingTop: "10px", borderTop: "1px solid #1A2E4A", fontSize: "11px", color: "#6E7D94", fontFamily: "'Syne', sans-serif", lineHeight: 1.6 }}>
                        {uploadNote}
                      </div>
                    </div>
                  } />
                )}
              </div>
              <div onClick={() => document.getElementById("doc-input")?.click()} style={{ padding: "40px 20px", textAlign: "center", cursor: "pointer" }}>
                <input id="doc-input" type="file" accept=".pdf,.txt,.docx" style={{ display: "none" }}
                  onChange={e => { const f = e.target.files?.[0]; if (f) { if (validateFile(f)) setDocFile(f) } }} />
                <div style={{ width: "44px", height: "44px", border: "1.5px " + (docFile ? "solid #22c987" : "dashed #2A3F5F"), borderRadius: "3px", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}>
                  {docFile ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#22c987" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6E7D94" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                  )}
                </div>
                <div style={{ fontSize: "13px", fontFamily: "Georgia, serif", fontStyle: "italic", color: docFile ? "#22c987" : "#9A927E", marginBottom: "4px" }}>
                  {docFile ? docFile.name : (documentType === "resume" ? "Drop resume here" : "Drop document here")}
                </div>
                {!docFile && <div style={{ fontSize: "12px", color: "#6E7D94", fontFamily: "'Syne', sans-serif" }}>Click to browse</div>}
                <div style={{ fontSize: "11px", color: "#3A4A5E", marginTop: "8px", fontFamily: "'Syne', sans-serif", letterSpacing: "0.04em" }}>PDF · TXT · DOCX — 5MB max</div>
              </div>
              {fileError.doc && (
                <div style={{ padding: "8px 16px", borderTop: "1px solid #1A2E4A", background: "rgba(255,90,90,0.06)", fontSize: "11px", color: "#ff5a5a", fontFamily: "'Syne', sans-serif", lineHeight: 1.5 }}>
                  {fileError.doc}
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
              placeholder={contextPlaceholder}
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
            disabled={!docFile || !documentType || analyzing}
            style={{
              width: "100%", padding: "14px",
              background: (!docFile || !documentType || analyzing) ? "#0A1220" : "#C9962B",
              color: (!docFile || !documentType || analyzing) ? "#3A4A5E" : "#05090F",
              border: "1px solid " + ((!docFile || !documentType || analyzing) ? "#1A2E4A" : "#C9962B"),
              borderRadius: "2px",
              fontSize: "12px", fontWeight: 700,
              fontFamily: "'Syne', sans-serif",
              cursor: (!docFile || !documentType || analyzing) ? "not-allowed" : "pointer",
              transition: "all 0.2s",
              letterSpacing: "0.12em", textTransform: "uppercase",
              marginBottom: "32px",
            }}
            onMouseEnter={e => { if (docFile && documentType && !analyzing) e.currentTarget.style.background = "#E2B44A" }}
            onMouseLeave={e => { if (docFile && documentType && !analyzing) e.currentTarget.style.background = "#C9962B" }}
          >
            {analyzing ? (
              <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "10px" }}>
                <span style={{ display: "inline-block", width: "13px", height: "13px", border: "2px solid rgba(255,255,255,0.2)", borderTopColor: "#C9962B", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                {statusMsg}
              </span>
            ) : (documentType === "resume" ? "Run Resume Analysis" : "Run Document Analysis")}
          </button>

          {/* ── RESULTS ── */}
          {results && (
            <div>
              {/* Grade banner */}
              <div style={{
                borderRadius: "3px", padding: "20px 24px", marginBottom: "24px",
                display: "flex", alignItems: "center", gap: "20px",
                border: "1px solid " + gradeColor,
                background: gradeBg,
              }}>
                <div style={{ flexShrink: 0 }}>
                  <div style={{ fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.12em", color: "#6E7D94", marginBottom: "6px", fontFamily: "'Syne', sans-serif" }}>{gradeHeading}</div>
                  <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "1.5rem", fontWeight: 600, color: gradeColor }}>{gradeLabel}</div>
                  {!isResume && results.favors && <div style={{ fontSize: "11px", color: "#6E7D94", fontFamily: "'Syne', sans-serif", marginTop: "4px", letterSpacing: "0.04em" }}>Favors: {results.favors}</div>}
                </div>
                <div style={{ fontFamily: "Georgia, serif", fontStyle: "italic", fontSize: "14px", color: "#9A927E", lineHeight: 1.7, flex: 1 }}>{results.grade_summary}</div>
                <DownloadReportButton caseData={caseData} />
              </div>

              {/* Strong provisions / credentials */}
              {results.strong_provisions?.length > 0 && (
                <div style={{ background: "#0A1220", border: "1px solid #1A2E4A", borderRadius: "3px", padding: "20px 24px", marginBottom: "24px" }}>
                  <div style={{ fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.12em", color: "#22c987", marginBottom: "16px", fontFamily: "'Syne', sans-serif", fontWeight: 700 }}>{strongHeading}</div>
                  {results.strong_provisions.map((p: any, i: number) => (
                    <div key={i} style={{ padding: "12px 16px", background: "#0d1526", border: "1px solid #1A2E4A", borderLeft: "3px solid #22c987", borderRadius: "0 3px 3px 0", marginBottom: "8px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px", marginBottom: "4px" }}>
                        <span style={{ fontSize: "14px", fontFamily: "'Cormorant Garamond', serif", fontWeight: 600, color: "#ffffff" }}>{p.provision}</span>
                        {p.clause && <span style={{ flexShrink: 0, fontSize: "10px", color: "#6E7D94", fontFamily: "'Syne', sans-serif", letterSpacing: "0.04em" }}>{p.clause}</span>}
                      </div>
                      <div style={{ fontSize: "13px", fontFamily: "Georgia, serif", fontStyle: "italic", color: "#9A927E", lineHeight: 1.7 }}>{p.detail}</div>
                      {p.page_ref && <div style={{ marginTop: "8px", fontSize: "10px", color: "#7fa3ff", fontFamily: "'Syne', sans-serif", letterSpacing: "0.06em" }}>{p.page_ref}</div>}
                    </div>
                  ))}
                </div>
              )}

              {/* Weak provisions / gaps & concerns */}
              {results.weak_provisions?.length > 0 && (
                <div style={{ background: "#0A1220", border: "1px solid #1A2E4A", borderRadius: "3px", padding: "20px 24px", marginBottom: "24px" }}>
                  <div style={{ fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.12em", color: "#f0a030", marginBottom: "16px", fontFamily: "'Syne', sans-serif", fontWeight: 700 }}>{weakHeading}</div>
                  {results.weak_provisions.map((p: any, i: number) => (
                    <div key={i} style={{ padding: "12px 16px", background: "#0d1526", border: "1px solid #1A2E4A", borderLeft: "3px solid " + sevColor(p.severity), borderRadius: "0 3px 3px 0", marginBottom: "8px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px", marginBottom: "4px" }}>
                        <span style={{ fontSize: "14px", fontFamily: "'Cormorant Garamond', serif", fontWeight: 600, color: "#ffffff" }}>{p.provision}</span>
                        <div style={{ display: "flex", gap: "6px", flexShrink: 0, alignItems: "center" }}>
                          <span style={{ padding: "2px 8px", borderRadius: "2px", fontSize: "9px", fontWeight: 700, fontFamily: "'Syne', sans-serif", letterSpacing: "0.08em", textTransform: "uppercase", background: "rgba(110,125,148,0.12)", color: "#9A927E" }}>{(p.issue || "").replace(/_/g, " ")}</span>
                          <span style={{ fontSize: "9px", textTransform: "uppercase", letterSpacing: "0.08em", color: sevColor(p.severity), fontFamily: "'Syne', sans-serif", fontWeight: 700 }}>{p.severity}</span>
                        </div>
                      </div>
                      <div style={{ fontSize: "13px", fontFamily: "Georgia, serif", fontStyle: "italic", color: "#9A927E", lineHeight: 1.7 }}>{p.detail}</div>
                      <div style={{ marginTop: "8px", fontSize: "10px", color: p.page_ref ? "#7fa3ff" : "#3A4A5E", fontFamily: "'Syne', sans-serif", letterSpacing: "0.06em" }}>{p.page_ref ? p.page_ref : "—"}{p.clause ? " · " + p.clause : ""}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Attorney / screening flags */}
              {results.attorney_flags?.length > 0 && (
                <div style={{ background: "#0A1220", border: "1px solid #1A2E4A", borderRadius: "3px", padding: "20px 24px", marginBottom: "24px" }}>
                  <div style={{ fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.12em", color: "#9A927E", marginBottom: "12px", fontFamily: "'Syne', sans-serif", fontWeight: 700 }}>{flagsHeading}</div>
                  {results.attorney_flags.map((f: any, i: number) => (
                    <div key={i} style={{ padding: "12px 16px", background: "#0d1526", borderRadius: "0 3px 3px 0", marginBottom: "8px", borderLeft: "3px solid " + (f.priority === "urgent" ? "#ff5a5a" : f.priority === "review" ? "#f0a030" : "#4f7cff") }}>
                      <div style={{ fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.1em", color: f.priority === "urgent" ? "#ff5a5a" : f.priority === "review" ? "#f0a030" : "#4f7cff", marginBottom: "4px", fontFamily: "'Syne', sans-serif" }}>{f.priority}</div>
                      <div style={{ fontSize: "13px", fontFamily: "Georgia, serif", color: "#EDE6D0", lineHeight: 1.6 }}>{f.issue}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Tabs: governing (or candidate profile) / deadlines (or dates & gaps) / steps */}
              <div style={{ display: "flex", gap: "2px", background: "#0d1526", border: "1px solid #1A2E4A", borderRadius: "3px", padding: "3px", marginBottom: "20px" }}>
                {["governing", "deadlines", "steps"].map(tab => (
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
                    {tab === "governing" ? profileTabLabel : tab === "deadlines" ? datesTabLabel : "Next Steps"}
                  </button>
                ))}
              </div>

              {activeTab === "governing" && (
                <div style={{ background: "#0A1220", border: "1px solid #1A2E4A", borderRadius: "3px", overflow: "hidden" }}>
                  {profileRows.map((row, i) => (
                    <div key={i} style={{ display: "flex", borderBottom: i < profileRows.length - 1 ? "1px solid #1A2E4A" : "none" }}>
                      <div style={{ width: "200px", flexShrink: 0, padding: "12px 16px", fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.08em", color: "#6E7D94", fontFamily: "'Syne', sans-serif", fontWeight: 700, background: "#0d1526" }}>{row.label}</div>
                      <div style={{ padding: "12px 16px", fontSize: "13px", fontFamily: "Georgia, serif", color: "#EDE6D0", lineHeight: 1.6 }}>{row.value || "—"}</div>
                    </div>
                  ))}
                </div>
              )}

              {activeTab === "deadlines" && (
                (results.deadlines || []).length === 0
                  ? <div style={{ background: "#0A1220", border: "1px solid #1A2E4A", borderRadius: "0 3px 3px 0", padding: "14px 18px", borderLeftWidth: "3px", borderLeftColor: "#22c987" }}>
                    <div style={{ fontSize: "14px", fontWeight: 600, fontFamily: "'Cormorant Garamond', serif", color: "#ffffff" }}>
                      {isResume ? "No date issues identified" : "No embedded deadlines identified"}
                    </div>
                    <div style={{ fontSize: "13px", fontFamily: "Georgia, serif", fontStyle: "italic", color: "#9A927E", marginTop: "4px" }}>
                      {isResume ? "The employment timeline is continuous with no unexplained gaps or overlaps." : "No dated or time-bound obligations were found in the document."}
                    </div>
                  </div>
                  : (results.deadlines || []).map((d: any, i: number) => (
                    <div key={i} style={{ padding: "12px 16px", background: "#0d1526", border: "1px solid #1A2E4A", borderLeft: "3px solid #ff5a5a", borderRadius: "0 3px 3px 0", marginBottom: "8px" }}>
                      <div style={{ fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.1em", color: "#ff5a5a", marginBottom: "4px", fontFamily: "'Syne', sans-serif" }}>{(d.type || "").replace(/_/g, " ")}</div>
                      <div style={{ fontSize: "13px", fontFamily: "Georgia, serif", color: "#EDE6D0", lineHeight: 1.6 }}>{d.description}</div>
                      <div style={{ marginTop: "6px", fontSize: "12px", fontFamily: "Georgia, serif", fontStyle: "italic", color: "#C9962B" }}>{d.timeframe}{d.page_ref ? ` · ${d.page_ref}` : ""}</div>
                    </div>
                  ))
              )}

              {activeTab === "steps" && (
                (results.recommended_next_steps || []).map((s: any, i: number) => (
                  <div key={i} style={{ background: "#0A1220", border: "1px solid #1A2E4A", borderRadius: "0 3px 3px 0", padding: "14px 18px", marginBottom: "10px", borderLeftWidth: "3px", borderLeftColor: s.priority === "high" ? "#22c987" : s.priority === "medium" ? "#f0a030" : "#4f7cff", display: "flex", gap: "14px", alignItems: "flex-start" }}>
                    <div style={{ flexShrink: 0, width: "24px", height: "24px", borderRadius: "50%", background: "#0d1526", border: "1px solid #1A2E4A", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px", fontWeight: 700, color: "#C9962B", fontFamily: "'Syne', sans-serif" }}>{i + 1}</div>
                    <div>
                      <div style={{ fontSize: "14px", fontWeight: 600, fontFamily: "'Cormorant Garamond', serif", color: "#ffffff", marginBottom: "4px" }}>{s.step}</div>
                      {s.rationale && <div style={{ fontFamily: "Georgia, serif", fontStyle: "italic", fontSize: "13px", color: "#9A927E", lineHeight: 1.7 }}>{s.rationale}</div>}
                    </div>
                  </div>
                ))
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