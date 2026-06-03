"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"

export default function NewCasePage() {
  const [name, setName] = useState("")
  const [claimant, setClaimant] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
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
    router.push("/cases/" + data.id)
  }

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#0a0f1e", color: "#ffffff" }}>
      <nav style={{ borderBottom: "1px solid #1e2d4a", padding: "16px 32px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h1 style={{ fontFamily: "Georgia, serif", fontSize: "20px" }}><span style={{ color: "#ffffff" }}>Themis</span><span style={{ color: "#c9a84c" }}>OS</span></h1>
        <a href="/dashboard" style={{ color: "#9ca3af", fontSize: "14px", textDecoration: "none" }}>Back to Dashboard</a>
      </nav>
      <main style={{ padding: "48px 32px", maxWidth: "560px", margin: "0 auto" }}>
        <h2 style={{ fontSize: "24px", fontWeight: 600, marginBottom: "8px" }}>New Case</h2>
        <p style={{ color: "#9ca3af", marginBottom: "40px" }}>Create a case to start uploading documents and running analysis.</p>
        <div style={{ backgroundColor: "#111827", border: "1px solid #1e2d4a", borderRadius: "12px", padding: "32px" }}>
          <div style={{ marginBottom: "24px" }}>
            <label style={{ display: "block", fontSize: "13px", color: "#9ca3af", marginBottom: "8px" }}>Case Name</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Smith v. Acme Insurance" style={{ width: "100%", backgroundColor: "#0a0f1e", border: "1px solid #1e2d4a", borderRadius: "8px", padding: "10px 14px", color: "#ffffff", fontSize: "14px", outline: "none" }} />
          </div>
          <div style={{ marginBottom: "32px" }}>
            <label style={{ display: "block", fontSize: "13px", color: "#9ca3af", marginBottom: "8px" }}>Claimant Name</label>
            <input type="text" value={claimant} onChange={e => setClaimant(e.target.value)} placeholder="e.g. John Smith" style={{ width: "100%", backgroundColor: "#0a0f1e", border: "1px solid #1e2d4a", borderRadius: "8px", padding: "10px 14px", color: "#ffffff", fontSize: "14px", outline: "none" }} />
          </div>
          {error && <p style={{ color: "#f87171", fontSize: "13px", marginBottom: "16px" }}>{error}</p>}
          <div style={{ display: "flex", gap: "12px" }}>
            <button onClick={handleCreate} disabled={loading} style={{ flex: 1, backgroundColor: "#c9a84c", color: "#0a0f1e", border: "none", borderRadius: "8px", padding: "12px", fontSize: "14px", fontWeight: 600, cursor: "pointer", opacity: loading ? 0.6 : 1 }}>
              {loading ? "Creating..." : "Create Case"}
            </button>
            <a href="/dashboard" style={{ padding: "12px 20px", border: "1px solid #1e2d4a", borderRadius: "8px", color: "#9ca3af", fontSize: "14px", textDecoration: "none", display: "flex", alignItems: "center" }}>Cancel</a>
          </div>
        </div>
      </main>
    </div>
  )
}