"use client"
import { useEffect, useState } from "react"
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

export default function CasePage() {
  const [caseData, setCaseData] = useState<Case | null>(null)
  const [policyFile, setPolicyFile] = useState<File | null>(null)
  const [caseFile, setCaseFile] = useState<File | null>(null)
  const [context, setContext] = useState("")
  const [analyzing, setAnalyzing] = useState(false)
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
    }
    load()
  }, [])

  const runAnalysis = async () => {
    if (!policyFile || !caseFile) return
    setAnalyzing(true)
    setError("")
    setResults(null)
    try {
      const fd = new FormData()
      fd.append("policy", policyFile)
      fd.append("case_file", caseFile)
      fd.append("context", context)
      const resp = await fetch("/api/cross-examine", { method: "POST", body: fd })
      const data = await resp.json()
      if (!resp.ok || data.error) { setError(data.error || "Analysis failed"); setAnalyzing(false); return }
      setResults(data)
      await supabase.from("cases").update({ documents_analyzed: (caseData?.documents_analyzed || 0) + 2 }).eq("id", params.id)
    } catch (e: any) {
      setError("Backend unreachable: " + e.message)
    }
    setAnalyzing(false)
  }

  if (!caseData) return (
    <div style={{ minHeight: "100vh", backgroundColor: "#0d0f12", display: "flex", alignItems: "center", justifyContent: "center", color: "#8b92a8", fontFamily: "SF Mono, Fira Code, monospace" }}>Loading...</div>
  )

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#0d0f12", color: "#e8ecf4", fontFamily: "SF Mono, Fira Code, Cascadia Code, monospace", fontSize: "14px" }}>

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
          {analyzing ? "⚡ Analyzing… (large docs may take 30-60s)" : "⚡ Run Cross-Examination"}
        </button>

        {results && (
          <div>
            <div style={{ borderRadius: "10px", padding: "20px 24px", marginBottom: "24px", display: "flex", alignItems: "center", gap: "20px", border: "1px solid", background: results.verdict === "covered" ? "rgba(34,201,135,0.1)" : results.verdict === "not_covered" ? "rgba(255,90,90,0.1)" : results.verdict === "partial" ? "rgba(240,160,48,0.1)" : "rgba(96,200,240,0.1)", borderColor: results.verdict === "covered" ? "#22c987" : results.verdict === "not_covered" ? "#ff5a5a" : results.verdict === "partial" ? "#f0a030" : "#60c8f0" }}>
              <div>
                <div style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.1em", color: "#555d72", marginBottom: "4px" }}>Overall verdict</div>
                <div style={{ fontSize: "20px", fontWeight: 700, color: results.verdict === "covered" ? "#22c987" : results.verdict === "not_covered" ? "#ff5a5a" : results.verdict === "partial" ? "#f0a030" : "#60c8f0" }}>
                  {results.verdict === "covered" ? "✅ Covered" : results.verdict === "not_covered" ? "❌ Not Covered" : results.verdict === "partial" ? "⚠️ Partial Coverage" : "❓ Unclear"}
                </div>
              </div>
              <div style={{ fontFamily: "-apple-system, sans-serif", fontSize: "13px", color: "#8b92a8", lineHeight: 1.6, flex: 1 }}>{results.summary}</div>
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
  )
}
