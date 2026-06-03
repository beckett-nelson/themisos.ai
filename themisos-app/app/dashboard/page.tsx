'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

type Case = {
  id: string
  name: string
  claimant: string | null
  status: string
  documents_analyzed: number
  recovery_identified: number
  created_at: string
}

export default function DashboardPage() {
  const [cases, setCases] = useState<Case[]>([])
  const [loading, setLoading] = useState(true)
  const [userName, setUserName] = useState('there')
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const loadData = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .single()

      if (profile?.full_name) setUserName(profile.full_name.split(' ')[0])

      const { data: casesData } = await supabase
        .from('cases')
        .select('*')
        .order('created_at', { ascending: false })

      setCases(casesData || [])
      setLoading(false)
    }
    loadData()
  }, [])

  const activeCases = cases.filter(c => c.status === 'active').length
  const totalDocs = cases.reduce((sum, c) => sum + c.documents_analyzed, 0)
  const totalRecovery = cases.reduce((sum, c) => sum + c.recovery_identified, 0)

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const toggleStatus = async (c: Case) => {
    const newStatus = c.status === 'active' ? 'inactive' : 'active'
    await supabase.from('cases').update({ status: newStatus }).eq('id', c.id)
    setCases(prev => prev.map(x => x.id === c.id ? { ...x, status: newStatus } : x))
  }

  const handleDelete = async (id: string) => {
    await supabase.from('cases').delete().eq('id', id)
    setCases(prev => prev.filter(x => x.id !== id))
    setConfirmDelete(null)
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0a0f1e', color: '#ffffff' }}>
      <nav style={{ borderBottom: '1px solid #1e2d4a', padding: '16px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h1 style={{ fontFamily: 'Georgia, serif', fontSize: '20px', letterSpacing: '0.05em' }}>
          <span style={{ color: '#ffffff' }}>Themis</span><span style={{ color: '#c9a84c' }}>OS</span>
        </h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
          <span style={{ color: '#9ca3af', fontSize: '14px' }}>Insurance Recovery Platform</span>
          <button onClick={handleSignOut} style={{ backgroundColor: 'transparent', border: '1px solid #1e2d4a', color: '#9ca3af', padding: '6px 14px', borderRadius: '6px', fontSize: '13px', cursor: 'pointer' }}>
            Sign Out
          </button>
        </div>
      </nav>

      <main style={{ padding: '48px 32px', maxWidth: '1000px', margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '40px' }}>
          <div>
            <h2 style={{ fontSize: '24px', fontWeight: 600, marginBottom: '4px' }}>Welcome, {userName}</h2>
            <p style={{ color: '#9ca3af' }}>Your recovery cases and analysis tools are below.</p>
          </div>
          <button onClick={() => router.push('/cases/new')} style={{ backgroundColor: '#c9a84c', color: '#0a0f1e', padding: '10px 24px', borderRadius: '8px', fontSize: '14px', fontWeight: 600, border: 'none', cursor: 'pointer' }}>
            + New Case
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px', marginBottom: '48px' }}>
          {[
            { label: 'Active Cases', value: activeCases.toString() },
            { label: 'Documents Analyzed', value: totalDocs.toString() },
            { label: 'Recovery Identified', value: `$${totalRecovery.toLocaleString()}` },
          ].map((card) => (
            <div key={card.label} style={{ backgroundColor: '#111827', border: '1px solid #1e2d4a', borderRadius: '12px', padding: '24px' }}>
              <p style={{ color: '#9ca3af', fontSize: '14px', marginBottom: '8px' }}>{card.label}</p>
              <p style={{ fontSize: '32px', fontWeight: 700, color: '#ffffff' }}>{loading ? '—' : card.value}</p>
            </div>
          ))}
        </div>

        <div style={{ backgroundColor: '#111827', border: '1px solid #1e2d4a', borderRadius: '12px', overflow: 'hidden', marginBottom: '48px' }}>
          <div style={{ padding: '20px 24px', borderBottom: '1px solid #1e2d4a' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600 }}>Cases</h3>
          </div>
          {loading ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#9ca3af' }}>Loading...</div>
          ) : cases.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#9ca3af' }}>
              No cases yet. Click <strong style={{ color: '#c9a84c' }}>+ New Case</strong> to get started.
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #1e2d4a' }}>
                  {['Case Name', 'Claimant', 'Status', 'Docs', 'Recovery', ''].map(h => (
                    <th key={h} style={{ padding: '12px 24px', textAlign: 'left', fontSize: '12px', color: '#6b7280', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {cases.map((c) => (
                  <tr
                    key={c.id}
                    style={{ borderBottom: '1px solid #1e2d4a' }}
                    onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#0a0f1e')}
                    onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    <td onClick={() => router.push(`/cases/${c.id}`)} style={{ padding: '16px 24px', fontSize: '14px', color: '#ffffff', fontWeight: 500, cursor: 'pointer' }}>{c.name}</td>
                    <td onClick={() => router.push(`/cases/${c.id}`)} style={{ padding: '16px 24px', fontSize: '14px', color: '#9ca3af', cursor: 'pointer' }}>{c.claimant || '—'}</td>
                    <td style={{ padding: '16px 24px' }}>
                      <span style={{ backgroundColor: c.status === 'active' ? '#052e16' : '#1c1917', color: c.status === 'active' ? '#4ade80' : '#9ca3af', padding: '2px 10px', borderRadius: '99px', fontSize: '12px' }}>
                        {c.status}
                      </span>
                    </td>
                    <td onClick={() => router.push(`/cases/${c.id}`)} style={{ padding: '16px 24px', fontSize: '14px', color: '#9ca3af', cursor: 'pointer' }}>{c.documents_analyzed}</td>
                    <td onClick={() => router.push(`/cases/${c.id}`)} style={{ padding: '16px 24px', fontSize: '14px', color: c.recovery_identified > 0 ? '#c9a84c' : '#9ca3af', fontWeight: c.recovery_identified > 0 ? 600 : 400, cursor: 'pointer' }}>
                      ${c.recovery_identified.toLocaleString()}
                    </td>
                    <td style={{ padding: '16px 24px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>

                        {/* Active/Inactive toggle */}
                        <button
                          onClick={() => toggleStatus(c)}
                          title={c.status === 'active' ? 'Mark inactive' : 'Mark active'}
                          style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px', color: c.status === 'active' ? '#4ade80' : '#6b7280', display: 'flex', alignItems: 'center' }}
                        >
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            {c.status === 'active'
                              ? <><rect x="1" y="5" width="22" height="14" rx="7"/><circle cx="16" cy="12" r="3" fill="currentColor" stroke="none"/></>
                              : <><rect x="1" y="5" width="22" height="14" rx="7"/><circle cx="8" cy="12" r="3" fill="currentColor" stroke="none"/></>
                            }
                          </svg>
                        </button>

                        {/* Delete button */}
                        {confirmDelete === c.id ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <button onClick={() => handleDelete(c.id)} style={{ background: '#7f1d1d', border: '1px solid #dc2626', color: '#fca5a5', padding: '3px 10px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer', fontWeight: 600 }}>
                              Confirm
                            </button>
                            <button onClick={() => setConfirmDelete(null)} style={{ background: 'transparent', border: '1px solid #1e2d4a', color: '#9ca3af', padding: '3px 10px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer' }}>
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setConfirmDelete(c.id)}
                            title="Delete case"
                            style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px', color: '#4b5563', display: 'flex', alignItems: 'center' }}
                            onMouseEnter={e => (e.currentTarget.style.color = '#dc2626')}
                            onMouseLeave={e => (e.currentTarget.style.color = '#4b5563')}
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/>
                            </svg>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div style={{ paddingTop: '32px', borderTop: '1px solid #1e2d4a' }}>
          <a href="/support" style={{ display: 'inline-block', backgroundColor: 'transparent', border: '1px solid #1e2d4a', color: '#9ca3af', padding: '10px 20px', borderRadius: '8px', fontSize: '14px', textDecoration: 'none' }}>
            Contact Support
          </a>
        </div>
      </main>
    </div>
  )
}
