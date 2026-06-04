'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

const ADMIN_EMAIL = 'beckett@themisos.ai'

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
  const [userEmail, setUserEmail] = useState('')
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const loadData = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      setUserEmail(user.email || '')

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

  const isAdmin = userEmail === ADMIN_EMAIL

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#05090F', color: '#EDE6D0', fontFamily: "'Syne', sans-serif" }}>

      {/* NAV */}
      <nav style={{ borderBottom: '1px solid #1A2E4A', padding: '18px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(5,9,15,0.95)', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ fontFamily: 'Georgia, serif', fontSize: '18px', fontWeight: 600, letterSpacing: '0.05em' }}>
          <span style={{ color: '#ffffff' }}>Themis</span><span style={{ color: '#C9962B' }}>OS</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          {isAdmin && (
            <a
              href="/admin/invite"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px',
                fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase',
                color: '#C9962B', textDecoration: 'none', fontWeight: 600,
                border: '1px solid rgba(201,150,43,0.3)', borderRadius: '2px',
                padding: '6px 14px', background: 'rgba(201,150,43,0.06)',
                transition: 'all 0.2s'
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.background = 'rgba(201,150,43,0.12)'
                ;(e.currentTarget as HTMLElement).style.borderColor = 'rgba(201,150,43,0.6)'
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.background = 'rgba(201,150,43,0.06)'
                ;(e.currentTarget as HTMLElement).style.borderColor = 'rgba(201,150,43,0.3)'
              }}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/>
              </svg>
              Invite Client
            </a>
          )}
          <span style={{ color: '#6E7D94', fontSize: '13px', letterSpacing: '0.04em' }}>Insurance Recovery Platform</span>
          <button
            onClick={handleSignOut}
            style={{ background: 'transparent', border: '1px solid #1A2E4A', color: '#6E7D94', padding: '6px 16px', borderRadius: '2px', fontSize: '12px', cursor: 'pointer', letterSpacing: '0.06em', fontFamily: "'Syne', sans-serif", transition: 'all 0.2s' }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.borderColor = '#6E7D94'
              ;(e.currentTarget as HTMLElement).style.color = '#EDE6D0'
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.borderColor = '#1A2E4A'
              ;(e.currentTarget as HTMLElement).style.color = '#6E7D94'
            }}
          >
            Sign Out
          </button>
        </div>
      </nav>

      <main style={{ padding: '52px 32px', maxWidth: '1000px', margin: '0 auto' }}>

        {/* HEADER */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '48px' }}>
          <div>
            <div style={{ fontSize: '11px', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#C9962B', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ display: 'inline-block', width: '20px', height: '1px', background: '#C9962B', opacity: 0.6 }}></span>
              Dashboard
            </div>
            <h2 style={{ fontFamily: 'Georgia, serif', fontSize: '2rem', fontWeight: 400, color: '#ffffff', marginBottom: '6px', lineHeight: 1.1 }}>
              Welcome, <em style={{ color: '#C9962B', fontStyle: 'italic' }}>{userName}</em>
            </h2>
            <p style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic', color: '#9A927E', fontSize: '15px' }}>
              Your recovery cases and analysis tools are below.
            </p>
          </div>
          <button
            onClick={() => router.push('/cases/new')}
            style={{ backgroundColor: '#C9962B', color: '#05090F', padding: '11px 28px', borderRadius: '2px', fontSize: '13px', fontWeight: 700, border: 'none', cursor: 'pointer', letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: "'Syne', sans-serif", transition: 'background 0.2s', marginTop: '8px' }}
            onMouseEnter={e => (e.currentTarget.style.background = '#E2B44A')}
            onMouseLeave={e => (e.currentTarget.style.background = '#C9962B')}
          >
            + New Case
          </button>
        </div>

        {/* STAT CARDS */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1px', background: '#1A2E4A', border: '1px solid #1A2E4A', marginBottom: '40px' }}>
          {[
            { label: 'Active Cases', value: activeCases.toString(), gold: false },
            { label: 'Documents Analyzed', value: totalDocs.toString(), gold: false },
            { label: 'Recovery Identified', value: `$${totalRecovery.toLocaleString()}`, gold: true },
          ].map((card) => (
            <div key={card.label} style={{ backgroundColor: '#0A1220', padding: '28px 24px' }}>
              <p style={{ fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#6E7D94', marginBottom: '12px', fontFamily: 'monospace' }}>{card.label}</p>
              <p style={{ fontFamily: 'Georgia, serif', fontSize: '2.25rem', fontWeight: 400, color: card.gold ? '#C9962B' : '#ffffff', lineHeight: 1 }}>
                {loading ? '—' : card.value}
              </p>
            </div>
          ))}
        </div>

        {/* CASES TABLE */}
        <div style={{ background: '#0A1220', border: '1px solid #1A2E4A', overflow: 'hidden', marginBottom: '48px' }}>
          <div style={{ padding: '20px 24px', borderBottom: '1px solid #1A2E4A', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: '11px', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#C9962B', fontFamily: 'monospace', fontWeight: 600 }}>
              Cases
            </div>
            <div style={{ fontSize: '12px', color: '#6E7D94', fontFamily: 'monospace' }}>
              {loading ? '' : `${cases.length} total`}
            </div>
          </div>

          {loading ? (
            <div style={{ padding: '48px', textAlign: 'center', color: '#6E7D94', fontFamily: 'Georgia, serif', fontStyle: 'italic' }}>Loading...</div>
          ) : cases.length === 0 ? (
            <div style={{ padding: '48px', textAlign: 'center' }}>
              <p style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic', color: '#9A927E', fontSize: '15px' }}>
                No cases yet. Click <strong style={{ color: '#C9962B', fontStyle: 'normal' }}>+ New Case</strong> to get started.
              </p>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #1A2E4A' }}>
                  {['Case Name', 'Claimant', 'Status', 'Docs', 'Recovery', ''].map(h => (
                    <th key={h} style={{ padding: '12px 24px', textAlign: 'left', fontSize: '10px', color: '#6E7D94', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: 'monospace' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {cases.map((c) => (
                  <tr
                    key={c.id}
                    style={{ borderBottom: '1px solid #1A2E4A', transition: 'background 0.15s' }}
                    onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#05090F')}
                    onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    <td onClick={() => router.push(`/cases/${c.id}`)} style={{ padding: '16px 24px', fontSize: '14px', color: '#EDE6D0', fontWeight: 500, cursor: 'pointer', fontFamily: 'Georgia, serif' }}>{c.name}</td>
                    <td onClick={() => router.push(`/cases/${c.id}`)} style={{ padding: '16px 24px', fontSize: '13px', color: '#9A927E', cursor: 'pointer', fontFamily: 'Georgia, serif', fontStyle: 'italic' }}>{c.claimant || '—'}</td>
                    <td style={{ padding: '16px 24px' }}>
                      <span style={{
                        background: c.status === 'active' ? 'rgba(39,201,63,0.08)' : 'rgba(110,125,148,0.1)',
                        color: c.status === 'active' ? '#27C93F' : '#6E7D94',
                        border: `1px solid ${c.status === 'active' ? 'rgba(39,201,63,0.2)' : 'rgba(110,125,148,0.2)'}`,
                        padding: '3px 10px', borderRadius: '2px', fontSize: '11px',
                        letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: 'monospace'
                      }}>
                        {c.status}
                      </span>
                    </td>
                    <td onClick={() => router.push(`/cases/${c.id}`)} style={{ padding: '16px 24px', fontSize: '13px', color: '#9A927E', cursor: 'pointer', fontFamily: 'monospace' }}>{c.documents_analyzed}</td>
                    <td onClick={() => router.push(`/cases/${c.id}`)} style={{ padding: '16px 24px', fontSize: '14px', color: c.recovery_identified > 0 ? '#C9962B' : '#9A927E', fontWeight: c.recovery_identified > 0 ? 600 : 400, cursor: 'pointer', fontFamily: 'Georgia, serif' }}>
                      ${c.recovery_identified.toLocaleString()}
                    </td>
                    <td style={{ padding: '16px 24px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <button
                          onClick={() => toggleStatus(c)}
                          title={c.status === 'active' ? 'Mark inactive' : 'Mark active'}
                          style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px', color: c.status === 'active' ? '#27C93F' : '#6E7D94', display: 'flex', alignItems: 'center' }}
                        >
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            {c.status === 'active'
                              ? <><rect x="1" y="5" width="22" height="14" rx="7"/><circle cx="16" cy="12" r="3" fill="currentColor" stroke="none"/></>
                              : <><rect x="1" y="5" width="22" height="14" rx="7"/><circle cx="8" cy="12" r="3" fill="currentColor" stroke="none"/></>
                            }
                          </svg>
                        </button>
                        {confirmDelete === c.id ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <button onClick={() => handleDelete(c.id)} style={{ background: 'rgba(220,38,38,0.1)', border: '1px solid rgba(220,38,38,0.3)', color: '#fca5a5', padding: '3px 10px', borderRadius: '2px', fontSize: '11px', cursor: 'pointer', fontWeight: 600, letterSpacing: '0.06em', fontFamily: "'Syne', sans-serif" }}>
                              Confirm
                            </button>
                            <button onClick={() => setConfirmDelete(null)} style={{ background: 'transparent', border: '1px solid #1A2E4A', color: '#6E7D94', padding: '3px 10px', borderRadius: '2px', fontSize: '11px', cursor: 'pointer', fontFamily: "'Syne', sans-serif" }}>
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setConfirmDelete(c.id)}
                            title="Delete case"
                            style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px', color: '#1A2E4A', display: 'flex', alignItems: 'center', transition: 'color 0.15s' }}
                            onMouseEnter={e => (e.currentTarget.style.color = '#dc2626')}
                            onMouseLeave={e => (e.currentTarget.style.color = '#1A2E4A')}
                          >
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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

        {/* FOOTER */}
        <div style={{ paddingTop: '32px', borderTop: '1px solid #1A2E4A', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <a
            href="/support"
            style={{ display: 'inline-block', background: 'transparent', border: '1px solid #1A2E4A', color: '#6E7D94', padding: '10px 20px', borderRadius: '2px', fontSize: '12px', textDecoration: 'none', letterSpacing: '0.06em', textTransform: 'uppercase', fontFamily: "'Syne', sans-serif", transition: 'all 0.2s' }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.borderColor = '#6E7D94'
              ;(e.currentTarget as HTMLElement).style.color = '#EDE6D0'
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.borderColor = '#1A2E4A'
              ;(e.currentTarget as HTMLElement).style.color = '#6E7D94'
            }}
          >
            Contact Support
          </a>
        </div>
      </main>
    </div>
  )
}