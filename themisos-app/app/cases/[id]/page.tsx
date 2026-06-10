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
    <button onClick={handlePrint} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "8px 16px", background: "transparent", border: "1px solid #C9962B", borderRadius: "8px", color: "#C9962B", fontSize: "12px", fontFamily: "SF Mono, monospace", fontWeight: 600, cursor: "pointer", letterSpacing: "0.04em" }}>
      <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z"/></svg>
      Download Report
    </button>
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
  const [activeTab, setActiveTab] = useState("findings")
  const [policyDrag, setPolicyDrag] = useState(false)
  const [caseDrag, setCaseDrag] = useState(false)
  const router = useRouter()
  const params = useParams()
  const supabase = createClient()

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
      // Get user info for tracking
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
    <div style={{ minHeight: "100vh", backgroundColor: "#0d0f12", display: "flex", alignItems: "center", justifyContent: "center", color: "#8b92a8", fontFamily: "SF Mono, Fira Code, monospace" }}>Loading...</div>
  )

  const verdictColor = results?.verdict === "covered" ? "#22c987" : results?.verdict === "not_covered" ? "#ff5a5a" : results?.verdict === "partial" ? "#f0a030" : "#60c8f0"
  const verdictLabel = results?.verdict === "covered" ? "Covered" : results?.verdict === "not_covered" ? "Not Covered" : results?.verdict === "partial" ? "Partial Coverage" : "Unclear"

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#0d0f12", color: "#e8ecf4", fontFamily: "SF Mono, Fira Code, Cascadia Code, monospace", fontSize: "14px" }}>

      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-report { display: block !important; }
          body { background: #fff !important; }
          @page { margin: 0.75in; size: letter; }
        }
        @media screen {
          .print-report { display: none !important; }
        }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      {results && (
        <div className="print-report" style={{ fontFamily: "Georgia, serif", color: "#111", padding: "0", background: "#fff" }}>
          <div style={{ borderBottom: "2px solid #0d0f12", paddingBottom: "16px", marginBottom: "28px", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ fontSize: "24px", fontWeight: 700, letterSpacing: "-0.02em" }}>Themis<span style={{ color: "#C9962B" }}>OS</span></div>
              <div style={{ fontSize: "11px", color: "#666", marginTop: "3px", letterSpacing: "0.1em", textTransform: "uppercase", fontFamily: "Arial, sans-serif" }}>Cross-Examination Analysis Report</div>
            </div>
            <div style={{ textAlign: "right", fontSize: "12px", color: "#555", fontFamily: "Arial, sans-serif", lineHeight: 1.6 }}>
              <div style={{ fontWeight: 600, color: "#111" }}>{caseData.name}</div>
              {caseData.claimant && <div>Claimant: {caseData.claimant}</div>}
              <div>{new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</div>
            </div>
          </div>
          <div style={{ marginBottom: "24px", padding: "16px 20px", border: "1px solid #ddd", borderRadius: "6px", borderLeft: "4px solid " + verdictColor }}>
            <div style={{ fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.1em", color: "#888", fontFamily: "Arial, sans-serif", marginBottom: "6px" }}>Overall Verdict</div>
            <div style={{ fontSize: "18px", fontWeight: 700, color: verdictColor, marginBottom: "8px" }}>{verdictLabel}</div>
            <div style={{ fontSize: "13px", color: "#444", lineHeight: 1.7, fontFamily: "Arial, sans-serif" }}>{results.summary}</div>
          </div>
          {results.recovery_opportunities?.length > 0 && (
            <div style={{ marginBottom: "24px", pageBreakInside: "avoid" }}>
              <div style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.1em", color: "#C9962B", fontFamily: "Arial, sans-serif", fontWeight: 700, marginBottom: "10px", paddingBottom: "6px", borderBottom: "1px solid #eee" }}>Recovery Opportunities</div>
              {results.recovery_opportunities.map((r: any, i: number) => (
                <div key={i} style={{ padding: "10px 14px", background: "#fafafa", borderRadius: "4px", marginBottom: "8px", display: "flex", justifyContent: "space-between", alignItems: "center", border: "1px solid #eee" }}>
                  <div style={{ fontSize: "12px", fontFamily: "Arial, sans-serif", color: "#222" }}>{r.theory}</div>
                  <div style={{ textAlign: "right", flexShrink: 0, marginLeft: "20px" }}>
                    <div style={{ fontSize: "13px", fontWeight: 700, color: "#C9962B" }}>{r.estimated_exposure}</div>
                    <div style={{ fontSize: "10px", color: r.confidence === "high" ? "#22a96d" : r.confidence === "medium" ? "#c47a00" : "#888", fontFamily: "Arial, sans-serif", textTransform: "uppercase", letterSpacing: "0.06em" }}>{r.confidence} confidence</div>
                  </div>
                </div>
              ))}
            </div>
          )}
          {results.attorney_flags?.length > 0 && (
            <div style={{ marginBottom: "24px", pageBreakInside: "avoid" }}>
              <div style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.1em", color: "#555", fontFamily: "Arial, sans-serif", fontWeight: 700, marginBottom: "10px", paddingBottom: "6px", borderBottom: "1px solid #eee" }}>Attorney Flags</div>
              {results.attorney_flags.map((f: any, i: number) => (
                <div key={i} style={{ padding: "10px 14px", marginBottom: "8px", borderLeft: "3px solid " + (f.priority === "urgent" ? "#cc2200" : f.priority === "review" ? "#c47a00" : "#3355cc"), background: "#fafafa", borderRadius: "0 4px 4px 0" }}>
                  <div style={{ fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.08em", color: f.priority === "urgent" ? "#cc2200" : f.priority === "review" ? "#c47a00" : "#3355cc", fontFamily: "Arial, sans-serif", marginBottom: "3px" }}>{f.priority}</div>
                  <div style={{ fontSize: "12px", fontFamily: "Arial, sans-serif", color: "#222" }}>{f.issue}</div>
                </div>
              ))}
            </div>
          )}
          {results.key_findings?.length > 0 && (
            <div style={{ marginBottom: "24px" }}>
              <div style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.1em", color: "#555", fontFamily: "Arial, sans-serif", fontWeight: 700, marginBottom: "10px", paddingBottom: "6px", borderBottom: "1px solid #eee" }}>Key Findings</div>
              {results.key_findings.map((f: any, i: number) => (
                <div key={i} style={{ padding: "10px 14px", marginBottom: "8px", borderLeft: "3px solid " + (f.type === "success" ? "#22a96d" : f.type === "danger" ? "#cc2200" : f.type === "warning" ? "#c47a00" : "#3355cc"), background: "#fafafa", borderRadius: "0 4px 4px 0" }}>
                  <div style={{ fontSize: "12px", fontWeight: 700, color: "#111", fontFamily: "Arial, sans-serif", marginBottom: "3px" }}>{f.title}</div>
                  <div style={{ fontSize: "12px", color: "#444", fontFamily: "Arial, sans-serif", lineHeight: 1.6 }}>{f.detail}</div>
                  {f.page_ref && <div style={{ marginTop: "6px", fontSize: "10px", color: "#3355cc", fontFamily: "Arial, sans-serif" }}>{f.document} · {f.page_ref}{f.clause ? " · " + f.clause : ""}</div>}
                </div>
              ))}
            </div>
          )}
          {results.coverage_items?.length > 0 && (
            <div style={{ marginBottom: "24px", pageBreakInside: "avoid" }}>
              <div style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.1em", color: "#555", fontFamily: "Arial, sans-serif", fontWeight: 700, marginBottom: "10px", paddingBottom: "6px", borderBottom: "1px solid #eee" }}>Coverage Map</div>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px", fontFamily: "Arial, sans-serif" }}>
                <thead>
                  <tr style={{ background: "#f5f5f5" }}>
                    {["Coverage Area", "Status", "Notes", "Reference"].map(h => (
                      <th key={h} style={{ padding: "8px 12px", textAlign: "left", fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.08em", color: "#666", borderBottom: "1px solid #ddd", fontWeight: 600 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {results.coverage_items.map((item: any, i: number) => (
                    <tr key={i} style={{ borderBottom: "1px solid #eee", background: i % 2 === 0 ? "#fff" : "#fafafa" }}>
                      <td style={{ padding: "8px 12px", fontWeight: 600, color: "#111" }}>{item.item}</td>
                      <td style={{ padding: "8px 12px" }}><span style={{ padding: "2px 8px", borderRadius: "99px", fontSize: "10px", fontWeight: 700, background: item.status === "covered" ? "#d4f5e9" : item.status === "excluded" ? "#fde8e8" : "#fff3cd", color: item.status === "covered" ? "#166534" : item.status === "excluded" ? "#991b1b" : "#854d0e" }}>{item.status}</span></td>
                      <td style={{ padding: "8px 12px", color: "#444" }}>{item.note}</td>
                      <td style={{ padding: "8px 12px", color: "#3355cc", fontSize: "11px" }}>{item.page_ref}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {results.conflicts?.length > 0 && (
            <div style={{ marginBottom: "24px" }}>
              <div style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.1em", color: "#555", fontFamily: "Arial, sans-serif", fontWeight: 700, marginBottom: "10px", paddingBottom: "6px", borderBottom: "1px solid #eee" }}>Conflicts & Gaps</div>
              {results.conflicts.map((c: any, i: number) => (
                <div key={i} style={{ padding: "10px 14px", marginBottom: "8px", borderLeft: "3px solid #cc2200", background: "#fafafa", borderRadius: "0 4px 4px 0" }}>
                  <div style={{ fontSize: "12px", fontWeight: 700, color: "#111", fontFamily: "Arial, sans-serif", marginBottom: "3px" }}>{c.title}</div>
                  <div style={{ fontSize: "12px", color: "#444", fontFamily: "Arial, sans-serif", lineHeight: 1.6 }}>{c.detail}</div>
                </div>
              ))}
            </div>
          )}
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
        <header style={{ padding: "0 32px", borderBottom: "1px solid #2a2f3d", display: "flex", alignItems: "center", backgroundColor: "#151820", position: "sticky", top: 0, zIndex: 100, height: "56px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", paddingRight: "24px", borderRight: "1px solid #2a2f3d", marginRight: "20px", height: "100%" }}>
            <svg viewBox="0 0 64 64" fill="none" style={{ width: "22px", height: "22px" }}>
              <rect x="30" y="8" width="4" height="44" rx="2" fill="#C9962B"/>
              <rect x="20" y="50" width="24" height="2.5" rx="1.25" fill="#C9962B"/>
              <circle cx="32" cy="8" r="3.5" fill="#C9962B"/>
              <rect x="8" y="20" width="48" height="2" rx="1" fill="#C9962B"/>
              <line x1="12" y1="22" x2="12" y2="31" stroke="#C9962B" strokeWidth="1.5"/>
              <line x1="52" y1="22" x2="52" y2="31" stroke="#C9962B" strokeWidth="1.5"/>
              <path d="M6 31 Q12 36 18 31" stroke="#C9962B" strokeWidth="2" fill="none"/>
              <path d="M46 31 Q52 36 58 31" stroke="#C9962B" strokeWidth="2" fill="none"/>
            </svg>
            <span style={{ fontSize: "13px", fontWeight: 700, letterSpacing: "0.08em" }}>Themis<span style={{ color: "#C9962B" }}>OS</span></span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", color: "#555d72" }}>
            <span style={{ color: "#3a4055" }}>/</span>
            <span style={{ color: "#8b92a8", fontWeight: 500 }}>Policy Cross-Examination</span>
          </div>
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "16px" }}>
            <a href="/support" style={{ fontSize: "11px", color: "#555d72", textDecoration: "none", letterSpacing: "0.04em" }}>Support</a>
            <a href="/dashboard" style={{ fontSize: "11px", color: "#555d72", textDecoration: "none", letterSpacing: "0.04em" }}>← Dashboard</a>
          </div>
        </header>

        <div style={{ maxWidth: "1100px", margin: "0 auto", padding: "36px 32px" }}>
          <div style={{ marginBottom: "32px" }}>
            <h2 style={{ fontSize: "20px", fontWeight: 600, color: "#e8ecf4", marginBottom: "6px", letterSpacing: "-0.01em" }}>{caseData.name}</h2>
            {caseData.claimant && <p style={{ color: "#8b92a8", fontSize: "13px", fontFamily: "-apple-system, sans-serif" }}>Claimant: {caseData.claimant}</p>}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginBottom: "24px" }}>
            <div style={{ background: "#151820", border: "1px solid " + (policyFile ? "#22c987" : policyDrag ? "#4f7cff" : "#2a2f3d"), borderRadius: "10px", overflow: "hidden", transition: "border-color 0.2s" }}
              onDragOver={e => { e.preventDefault(); setPolicyDrag(true) }}
              onDragLeave={() => setPolicyDrag(false)}
              onDrop={e => { e.preventDefault(); setPolicyDrag(false); const f = e.dataTransfer.files[0]; if (f) setPolicyFile(f) }}>
              <div style={{ padding: "11px 16px", borderBottom: "1px solid #2a2f3d", display: "flex", alignItems: "center", gap: "8px", background: "#1c2030" }}>
                <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#4f7cff" }}></div>
                <span style={{ fontSize: "11px", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "#8b92a8" }}>Insurance Policy <span style={{ color: "#555d72", fontWeight: 400 }}>// document A</span></span>
              </div>
              <div onClick={() => document.getElementById("policy-input")?.click()} style={{ padding: "48px 20px", textAlign: "center", cursor: "pointer" }}>
                <input id="policy-input" type="file" accept=".pdf,.txt,.docx" style={{ display: "none" }} onChange={e => setPolicyFile(e.target.files?.[0] || null)} />
                <div style={{ width: "48px", height: "48px", border: "1.5px " + (policyFile ? "solid #22c987" : "dashed #3a4055"), borderRadius: "10px", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px", fontSize: "22px" }}>{policyFile ? "✓" : "📄"}</div>
                <div style={{ fontSize: "13px", color: policyFile ? "#22c987" : "#8b92a8", fontFamily: "-apple-system, sans-serif" }}>
                  {policyFile ? <strong style={{ color: "#22c987" }}>{policyFile.name}</strong> : <><strong style={{ color: "#e8ecf4", display: "block", marginBottom: "4px" }}>Drop policy file here</strong>Click to browse</>}
                </div>
                <div style={{ fontSize: "11px", color: "#555d72", marginTop: "6px", fontFamily: "-apple-system, sans-serif" }}>PDF · TXT · DOCX — any size</div>
              </div>
            </div>

            <div style={{ background: "#151820", border: "1px solid " + (caseFile ? "#22c987" : caseDrag ? "#4f7cff" : "#2a2f3d"), borderRadius: "10px", overflow: "hidden", transition: "border-color 0.2s" }}
              onDragOver={e => { e.preventDefault(); setCaseDrag(true) }}
              onDragLeave={() => setCaseDrag(false)}
              onDrop={e => { e.preventDefault(); setCaseDrag(false); const f = e.dataTransfer.files[0]; if (f) setCaseFile(f) }}>
              <div style={{ padding: "11px 16px", borderBottom: "1px solid #2a2f3d", display: "flex", alignItems: "center", gap: "8px", background: "#1c2030" }}>
                <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#f0a030" }}></div>
                <span style={{ fontSize: "11px", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "#8b92a8" }}>Case File <span style={{ color: "#555d72", fontWeight: 400 }}>// document B</span></span>
              </div>
              <div onClick={() => document.getElementById("case-input")?.click()} style={{ padding: "48px 20px", textAlign: "center", cursor: "pointer" }}>
                <input id="case-input" type="file" accept=".pdf,.txt,.docx" style={{ display: "none" }} onChange={e => setCaseFile(e.target.files?.[0] || null)} />
                <div style={{ width: "48px", height: "48px", border: "1.5px " + (caseFile ? "solid #22c987" : "dashed #3a4055"), borderRadius: "10px", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px", fontSize: "22px" }}>{caseFile ? "✓" : "📁"}</div>
                <div style={{ fontSize: "13px", color: caseFile ? "#22c987" : "#8b92a8", fontFamily: "-apple-system, sans-serif" }}>
                  {caseFile ? <strong style={{ color: "#22c987" }}>{caseFile.name}</strong> : <><strong style={{ color: "#e8ecf4", display: "block", marginBottom: "4px" }}>Drop case file here</strong>Click to browse</>}
                </div>
                <div style={{ fontSize: "11px", color: "#555d72", marginTop: "6px", fontFamily: "-apple-system, sans-serif" }}>PDF · TXT · DOCX — any size</div>
              </div>
            </div>
          </div>

          <div style={{ background: "#151820", border: "1px solid #2a2f3d", borderRadius: "10px", overflow: "hidden", marginBottom: "24px" }}>
            <div style={{ padding: "10px 16px", borderBottom: "1px solid #2a2f3d", background: "#1c2030", fontSize: "11px", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "#8b92a8" }}>// Optional context</div>
            <textarea value={context} onChange={e => setContext(e.target.value)} placeholder="e.g. Focus on liability exclusions. Incident occurred 03/15/2024 involving commercial vehicle on I-90..." style={{ width: "100%", display: "block", background: "transparent", border: "none", outline: "none", color: "#e8ecf4", fontFamily: "SF Mono, Fira Code, monospace", fontSize: "13px", padding: "14px 16px", resize: "vertical", minHeight: "72px", lineHeight: 1.6 }} />
          </div>

          {error && <div style={{ background: "rgba(255,90,90,0.1)", border: "1px solid #ff5a5a", borderRadius: "10px", padding: "16px 20px", marginBottom: "24px", fontSize: "13px", color: "#ff5a5a", fontFamily: "-apple-system, sans-serif" }}>{error}</div>}

          <button onClick={runAnalysis} disabled={!policyFile || !caseFile || analyzing} style={{ width: "100%", padding: "14px", background: "#4f7cff", color: "#fff", border: "none", borderRadius: "10px", fontSize: "14px", fontWeight: 600, fontFamily: "SF Mono, monospace", cursor: (!policyFile || !caseFile || analyzing) ? "not-allowed" : "pointer", opacity: (!policyFile || !caseFile || analyzing) ? 0.35 : 1, transition: "opacity 0.2s", letterSpacing: "0.02em", marginBottom: "32px" }}>
            {analyzing ? (
              <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "10px" }}>
                <span style={{ display: "inline-block", width: "14px", height: "14px", border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                {statusMsg}
              </span>
            ) : "⚡ Run Cross-Examination"}
          </button>

          {results && (
            <div>
              <div style={{ borderRadius: "10px", padding: "20px 24px", marginBottom: "24px", display: "flex", alignItems: "center", gap: "20px", border: "1px solid", background: results.verdict === "covered" ? "rgba(34,201,135,0.1)" : results.verdict === "not_covered" ? "rgba(255,90,90,0.1)" : results.verdict === "partial" ? "rgba(240,160,48,0.1)" : "rgba(96,200,240,0.1)", borderColor: verdictColor }}>
                <div style={{ flexShrink: 0 }}>
                  <div style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.1em", color: "#555d72", marginBottom: "4px" }}>Overall verdict</div>
                  <div style={{ fontSize: "20px", fontWeight: 700, color: verdictColor }}>
                    {results.verdict === "covered" ? "✅ Covered" : results.verdict === "not_covered" ? "❌ Not Covered" : results.verdict === "partial" ? "⚠️ Partial Coverage" : "❓ Unclear"}
                  </div>
                </div>
                <div style={{ fontFamily: "-apple-system, sans-serif", fontSize: "13px", color: "#8b92a8", lineHeight: 1.6, flex: 1 }}>{results.summary}</div>
                <DownloadReportButton results={results} caseData={caseData} />
              </div>

              {results.recovery_opportunities?.length > 0 && (
                <div style={{ background: "#151820", border: "1px solid #C9962B", borderRadius: "10px", padding: "16px 20px", marginBottom: "24px" }}>
                  <div style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.1em", color: "#C9962B", marginBottom: "12px" }}>Recovery Opportunities</div>
                  {results.recovery_opportunities.map((r: any, i: number) => (
                    <div key={i} style={{ padding: "12px", background: "#1c2030", borderRadius: "8px", marginBottom: "8px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: "13px", fontFamily: "-apple-system, sans-serif" }}>{r.theory}</span>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: "13px", color: "#C9962B", fontWeight: 600 }}>{r.estimated_exposure}</div>
                        <div style={{ fontSize: "11px", color: r.confidence === "high" ? "#22c987" : r.confidence === "medium" ? "#f0a030" : "#8b92a8" }}>{r.confidence} confidence</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {results.attorney_flags?.length > 0 && (
                <div style={{ background: "#151820", border: "1px solid #2a2f3d", borderRadius: "10px", padding: "16px 20px", marginBottom: "24px" }}>
                  <div style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.1em", color: "#8b92a8", marginBottom: "12px" }}>Attorney Flags</div>
                  {results.attorney_flags.map((f: any, i: number) => (
                    <div key={i} style={{ padding: "12px", background: "#1c2030", borderRadius: "8px", marginBottom: "8px", borderLeft: "3px solid " + (f.priority === "urgent" ? "#ff5a5a" : f.priority === "review" ? "#f0a030" : "#4f7cff") }}>
                      <div style={{ fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.08em", color: f.priority === "urgent" ? "#ff5a5a" : f.priority === "review" ? "#f0a030" : "#4f7cff", marginBottom: "4px" }}>{f.priority}</div>
                      <div style={{ fontSize: "13px", fontFamily: "-apple-system, sans-serif", color: "#e8ecf4" }}>{f.issue}</div>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ display: "flex", gap: "2px", background: "#1c2030", border: "1px solid #2a2f3d", borderRadius: "10px", padding: "4px", marginBottom: "20px" }}>
                {["findings", "coverage", "conflicts"].map(tab => (
                  <button key={tab} onClick={() => setActiveTab(tab)} style={{ flex: 1, padding: "8px 12px", background: activeTab === tab ? "#151820" : "transparent", border: activeTab === tab ? "1px solid #2a2f3d" : "1px solid transparent", borderRadius: "6px", color: activeTab === tab ? "#e8ecf4" : "#555d72", fontFamily: "SF Mono, monospace", fontSize: "12px", cursor: "pointer", fontWeight: 500, letterSpacing: "0.02em" }}>
                    {tab === "findings" ? "Key Findings" : tab === "coverage" ? "Coverage Map" : "Conflicts & Gaps"}
                  </button>
                ))}
              </div>

              {activeTab === "findings" && (results.key_findings || []).map((f: any, i: number) => (
                <div key={i} style={{ background: "#151820", border: "1px solid #2a2f3d", borderRadius: "10px", padding: "14px 16px", marginBottom: "10px", borderLeftWidth: "3px", borderLeftColor: f.type === "success" ? "#22c987" : f.type === "danger" ? "#ff5a5a" : f.type === "warning" ? "#f0a030" : "#4f7cff" }}>
                  <div style={{ fontSize: "13px", fontWeight: 600, color: "#e8ecf4", marginBottom: "4px" }}>{f.title}</div>
                  <div style={{ fontFamily: "-apple-system, sans-serif", fontSize: "13px", color: "#8b92a8", lineHeight: 1.6 }}>{f.detail}</div>
                  {f.page_ref && <div style={{ marginTop: "10px", paddingTop: "10px", borderTop: "1px solid #2a2f3d", fontSize: "10px", color: "#7fa3ff", fontFamily: "SF Mono, monospace" }}>{f.document} · {f.page_ref}{f.clause ? " · " + f.clause : ""}</div>}
                </div>
              ))}

              {activeTab === "coverage" && (
                <div style={{ background: "#151820", border: "1px solid #2a2f3d", borderRadius: "10px", overflow: "hidden" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ borderBottom: "1px solid #2a2f3d" }}>
                        {["Coverage Area", "Status", "Notes", "Reference"].map(h => (
                          <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.1em", color: "#555d72", fontWeight: 600 }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(results.coverage_items || []).map((item: any, i: number) => (
                        <tr key={i} style={{ borderBottom: "1px solid #2a2f3d" }}>
                          <td style={{ padding: "12px 14px", fontSize: "13px", color: "#e8ecf4", fontWeight: 500 }}>{item.item}</td>
                          <td style={{ padding: "12px 14px" }}>
                            <span style={{ padding: "3px 10px", borderRadius: "99px", fontSize: "11px", fontWeight: 600, background: item.status === "covered" ? "rgba(34,201,135,0.1)" : item.status === "excluded" ? "rgba(255,90,90,0.1)" : "rgba(240,160,48,0.1)", color: item.status === "covered" ? "#22c987" : item.status === "excluded" ? "#ff5a5a" : "#f0a030" }}>{item.status}</span>
                          </td>
                          <td style={{ padding: "12px 14px", fontSize: "13px", color: "#8b92a8", fontFamily: "-apple-system, sans-serif" }}>{item.note}</td>
                          <td style={{ padding: "12px 14px", fontSize: "11px", color: "#7fa3ff", fontFamily: "SF Mono, monospace" }}>{item.page_ref}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {activeTab === "conflicts" && (
                (results.conflicts || []).length === 0
                  ? <div style={{ background: "#151820", border: "1px solid #2a2f3d", borderRadius: "10px", padding: "14px 16px", borderLeftWidth: "3px", borderLeftColor: "#22c987" }}><div style={{ fontSize: "13px", fontWeight: 600, color: "#e8ecf4" }}>No conflicts detected</div><div style={{ fontSize: "13px", color: "#8b92a8", fontFamily: "-apple-system, sans-serif", marginTop: "4px" }}>The case file appears consistent with policy terms.</div></div>
                  : (results.conflicts || []).map((c: any, i: number) => (
                    <div key={i} style={{ background: "#151820", border: "1px solid #2a2f3d", borderRadius: "10px", padding: "14px 16px", marginBottom: "10px", borderLeftWidth: "3px", borderLeftColor: "#ff5a5a" }}>
                      <div style={{ fontSize: "13px", fontWeight: 600, color: "#e8ecf4", marginBottom: "4px" }}>{c.title} <span style={{ fontSize: "10px", fontWeight: 400, textTransform: "uppercase", letterSpacing: "0.08em", color: "#555d72", marginLeft: "8px" }}>{c.type}</span></div>
                      <div style={{ fontFamily: "-apple-system, sans-serif", fontSize: "13px", color: "#8b92a8", lineHeight: 1.6 }}>{c.detail}</div>
                    </div>
                  ))
              )}

              {results.recommendation && (
                <div style={{ background: "rgba(79,124,255,0.1)", border: "1px solid rgba(79,124,255,0.3)", borderRadius: "10px", padding: "16px 20px", marginTop: "20px" }}>
                  <div style={{ fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.1em", color: "#4f7cff", marginBottom: "6px" }}>// Recommendation</div>
                  <div style={{ fontFamily: "-apple-system, sans-serif", fontSize: "14px", color: "#e8ecf4", lineHeight: 1.6 }}>{results.recommendation}</div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}