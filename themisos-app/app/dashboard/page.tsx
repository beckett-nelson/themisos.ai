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
  last_analysis?: any
  last_examine?: any
  last_document_analysis?: any
}

type Tab = 'cross' | 'examine' | 'document'

const TAB_CONFIG: Record<Tab, { label: string; field: keyof Case; route: (id: string) => string; btnLabel: string }> = {
  examine:  { label: 'Case Examination',  field: 'last_examine',           route: id => `/cases/${id}/examine`,            btnLabel: 'Examine Case'     },
  cross:    { label: 'Cross Examination', field: 'last_analysis',           route: id => `/cases/${id}`,                    btnLabel: 'Run Analysis'     },
  document: { label: 'Document Analysis', field: 'last_document_analysis',  route: id => `/cases/${id}/document-analysis`,  btnLabel: 'Analyze Document' },
}

const TABS: Tab[] = ['examine', 'cross', 'document']

export default function DashboardPage() {
  const [cases, setCases] = useState<Case[]>([])
  const [loading, setLoading] = useState(true)
  const [userName, setUserName] = useState('there')
  const [userEmail, setUserEmail] = useState('')
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<Tab>('cross')
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const loadData = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUserEmail(user.email || '')
      const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user.id).single()
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

  const activeCases   = cases.filter(c => c.status === 'active').length
  const totalDocs     = cases.reduce((sum, c) => sum + (c.documents_analyzed || 0), 0)
  const totalRecovery = cases.reduce((sum, c) => sum + (c.recovery_identified || 0), 0)

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
  const cfg = TAB_CONFIG[activeTab]

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#05090F',
      color: '#EDE6D0',
      fontFamily: "'Syne', sans-serif",
      // Faint legal-paper line texture — pure CSS, no images
      backgroundImage: `repeating-linear-gradient(
        180deg,
        transparent,
        transparent 47px,
        rgba(255,255,255,0.028) 47px,
        rgba(255,255,255,0.028) 48px
      )`,
    }}>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400;1,600&family=Syne:wght@400;500;600;700&display=swap');
        @keyframes fadeSlideIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        .tab-panel { animation: fadeSlideIn 0.35s cubic-bezier(0.22, 1, 0.36, 1); }
        .case-row { transition: background 0.2s ease; }
        .case-row:hover { background-color: rgba(255,255,255,0.02) !important; }
        .tab-btn { transition: color 0.25s ease, background 0.3s ease, box-shadow 0.4s ease, border-color 0.3s ease; }
      `}</style>

      {/* ── NAV ── */}
      <nav style={{
        borderBottom: '1px solid #1A2E4A',
        padding: '0 32px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: 'rgba(5,9,15,0.96)',
        backdropFilter: 'blur(8px)',
        position: 'sticky', top: 0, zIndex: 100, height: '56px',
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', paddingRight: '24px', borderRight: '1px solid #1A2E4A', height: '100%' }}>
          <svg viewBox="0 0 64 64" fill="none" style={{ width: '22px', height: '22px', flexShrink: 0 }}>
            <rect x="30" y="8" width="4" height="44" rx="2" fill="#C9962B"/>
            <rect x="20" y="50" width="24" height="2.5" rx="1.25" fill="#C9962B"/>
            <circle cx="32" cy="8" r="3.5" fill="#C9962B"/>
            <rect x="8" y="20" width="48" height="2" rx="1" fill="#C9962B"/>
            <line x1="12" y1="22" x2="12" y2="31" stroke="#C9962B" strokeWidth="1.5"/>
            <line x1="52" y1="22" x2="52" y2="31" stroke="#C9962B" strokeWidth="1.5"/>
            <path d="M6 31 Q12 36 18 31" stroke="#C9962B" strokeWidth="2" fill="none"/>
            <path d="M46 31 Q52 36 58 31" stroke="#C9962B" strokeWidth="2" fill="none"/>
          </svg>
          <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.25rem', fontWeight: 600, color: '#ffffff', letterSpacing: '0.01em' }}>
            Themis<span style={{ color: '#C9962B' }}>OS</span>
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginLeft: '24px' }}>
          {isAdmin && (
            <>
              {[
                { href: '/admin/invite', label: 'Invite Client', icon: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></> },
                { href: '/admin/clients', label: 'Clients', icon: <><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></> },
              ].map(({ href, label, icon }) => (
                <a key={href} href={href} style={{
                  display: 'inline-flex', alignItems: 'center', gap: '6px',
                  fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase',
                  color: '#C9962B', textDecoration: 'none', fontWeight: 600,
                  border: '1px solid rgba(201,150,43,0.3)', borderRadius: '2px',
                  padding: '6px 14px', background: 'rgba(201,150,43,0.06)', transition: 'all 0.2s',
                }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(201,150,43,0.12)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(201,150,43,0.6)' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(201,150,43,0.06)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(201,150,43,0.3)' }}
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">{icon}</svg>
                  {label}
                </a>
              ))}
            </>
          )}
          <span style={{ color: '#2A3F5F', fontSize: '12px', letterSpacing: '0.04em' }}>Recovery Platform</span>
          <button onClick={handleSignOut} style={{
            background: 'transparent', border: '1px solid #1A2E4A', color: '#6E7D94',
            padding: '6px 16px', borderRadius: '2px', fontSize: '12px', cursor: 'pointer',
            letterSpacing: '0.06em', fontFamily: "'Syne', sans-serif", transition: 'all 0.2s',
          }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = '#6E7D94'; (e.currentTarget as HTMLElement).style.color = '#EDE6D0' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = '#1A2E4A'; (e.currentTarget as HTMLElement).style.color = '#6E7D94' }}
          >Sign Out</button>
        </div>
      </nav>

      <main style={{ padding: '48px 32px', maxWidth: '1100px', margin: '0 auto' }}>

        {/* ── HEADER ── */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '40px' }}>
          <div>
            <div style={{ fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#C9962B', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ display: 'inline-block', width: '20px', height: '1px', background: '#C9962B', opacity: 0.6 }}></span>
              Dashboard
            </div>
            <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '2rem', fontWeight: 600, color: '#ffffff', marginBottom: '6px', lineHeight: 1.1 }}>
              Welcome, <em style={{ color: '#C9962B', fontStyle: 'italic' }}>{userName}</em>
            </h2>
            <p style={{ fontFamily: "'Cormorant Garamond', serif", fontStyle: 'italic', color: '#6E7D94', fontSize: '15px' }}>
              Your recovery cases and analysis tools are below.
            </p>
          </div>
          <button
            onClick={() => router.push('/cases/new')}
            style={{ backgroundColor: '#C9962B', color: '#05090F', padding: '11px 28px', borderRadius: '2px', fontSize: '12px', fontWeight: 700, border: 'none', cursor: 'pointer', letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: "'Syne', sans-serif", transition: 'background 0.2s', marginTop: '8px', flexShrink: 0 }}
            onMouseEnter={e => (e.currentTarget.style.background = '#E2B44A')}
            onMouseLeave={e => (e.currentTarget.style.background = '#C9962B')}
          >+ New Case</button>
        </div>

        {/* ── STATS STRIP ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1px', background: '#1A2E4A', border: '1px solid #1A2E4A', borderRadius: '3px', overflow: 'hidden', marginBottom: '32px' }}>
          {[
            { label: 'Active Cases',        value: activeCases.toString(),         gold: false, sub: 'across all matters' },
            { label: 'Cases Analyzed',       value: totalDocs.toString(),           gold: false, sub: 'all features combined' },
            { label: 'Recovery Identified',  value: `$${totalRecovery.toLocaleString()}`, gold: true,  sub: 'cross-examination only' },
          ].map(card => (
            <div key={card.label} style={{ backgroundColor: '#0A1220', padding: '24px 28px' }}>
              <p style={{ fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#6E7D94', marginBottom: '10px', fontFamily: "'Syne', sans-serif", fontWeight: 600 }}>{card.label}</p>
              <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '2.25rem', fontWeight: 600, color: card.gold ? '#C9962B' : '#ffffff', lineHeight: 1, marginBottom: '4px' }}>
                {loading ? '—' : card.value}
              </p>
              <p style={{ fontSize: '10px', color: '#2A3F5F', fontFamily: "'Syne', sans-serif", letterSpacing: '0.06em' }}>{card.sub}</p>
            </div>
          ))}
        </div>

        {/* ── THREE-TAB TOGGLE ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0', background: '#0A1220', border: '1px solid #1A2E4A', borderRadius: '3px', overflow: 'hidden', marginBottom: '24px' }}>
          {TABS.map((tab, idx) => {
            const selected = activeTab === tab
            return (
              <button key={tab} className="tab-btn" onClick={() => setActiveTab(tab)} style={{
                padding: '14px 12px',
                background: selected ? 'rgba(201,150,43,0.08)' : 'transparent',
                border: 'none',
                borderRight: idx < 2 ? '1px solid #1A2E4A' : 'none',
                borderBottom: selected ? '2px solid #C9962B' : '2px solid transparent',
                color: selected ? '#C9962B' : '#6E7D94',
                fontFamily: "'Syne', sans-serif",
                fontSize: '11px',
                fontWeight: selected ? 700 : 500,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                cursor: 'pointer',
                boxShadow: selected ? '0 0 12px rgba(201,150,43,0.4) inset, 0 2px 0 #C9962B' : 'none',
              }}
                onMouseEnter={e => { if (!selected) (e.currentTarget as HTMLElement).style.color = '#9A927E' }}
                onMouseLeave={e => { if (!selected) (e.currentTarget as HTMLElement).style.color = '#6E7D94' }}
              >
                {TAB_CONFIG[tab].label}
              </button>
            )
          })}
        </div>

        {/* ── CASES TABLE ── */}
        <div key={activeTab} className="tab-panel" style={{ background: '#0A1220', border: '1px solid #1A2E4A', borderRadius: '3px', overflow: 'hidden', marginBottom: '48px' }}>
          <div style={{ padding: '16px 24px', borderBottom: '1px solid #1A2E4A', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#C9962B', fontFamily: "'Syne', sans-serif", fontWeight: 700 }}>
                {cfg.label}
              </div>
              <div style={{ fontSize: '10px', color: '#2A3F5F', fontFamily: "'Syne', sans-serif", letterSpacing: '0.06em' }}>
                {loading ? '' : `${cases.length} case${cases.length !== 1 ? 's' : ''}`}
              </div>
            </div>
          </div>

          {loading ? (
            <div style={{ padding: '48px', textAlign: 'center', color: '#6E7D94', fontFamily: "'Cormorant Garamond', serif", fontStyle: 'italic' }}>Loading...</div>
          ) : cases.length === 0 ? (
            <div style={{ padding: '48px', textAlign: 'center' }}>
              <p style={{ fontFamily: "'Cormorant Garamond', serif", fontStyle: 'italic', color: '#9A927E', fontSize: '15px' }}>
                No cases yet. Click <strong style={{ color: '#C9962B', fontStyle: 'normal' }}>+ New Case</strong> to get started.
              </p>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #1A2E4A' }}>
                  {['Case', 'Claimant', 'Status', 'Docs', 'Recovery', 'Analysis', ''].map(h => (
                    <th key={h} style={{ padding: '10px 20px', textAlign: 'left', fontSize: '10px', color: '#3A4A5E', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: "'Syne', sans-serif" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {cases.map(c => {
                  const hasResult = !!(c[cfg.field])
                  return (
                    <tr key={c.id} className="case-row" style={{ borderBottom: '1px solid #1A2E4A', transition: 'background 0.15s' }}>
                      {/* Case name */}
                      <td onClick={() => router.push(`/cases/${c.id}`)} style={{ padding: '14px 20px', fontSize: '14px', color: '#EDE6D0', fontWeight: 500, cursor: 'pointer', fontFamily: "'Cormorant Garamond', serif" }}>{c.name}</td>
                      {/* Claimant */}
                      <td onClick={() => router.push(`/cases/${c.id}`)} style={{ padding: '14px 20px', fontSize: '13px', color: '#6E7D94', cursor: 'pointer', fontFamily: "'Cormorant Garamond', serif", fontStyle: 'italic' }}>{c.claimant || '—'}</td>
                      {/* Status badge */}
                      <td style={{ padding: '14px 20px' }}>
                        <span style={{
                          background: c.status === 'active' ? 'rgba(34,201,135,0.08)' : 'rgba(110,125,148,0.1)',
                          color: c.status === 'active' ? '#22c987' : '#6E7D94',
                          border: `1px solid ${c.status === 'active' ? 'rgba(34,201,135,0.2)' : 'rgba(110,125,148,0.2)'}`,
                          padding: '3px 10px', borderRadius: '2px', fontSize: '10px',
                          letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: "'Syne', sans-serif", fontWeight: 700,
                        }}>{c.status}</span>
                      </td>
                      {/* Docs */}
                      <td style={{ padding: '14px 20px', fontSize: '13px', color: '#6E7D94', fontFamily: "'Syne', sans-serif" }}>{c.documents_analyzed}</td>
                      {/* Recovery */}
                      <td style={{ padding: '14px 20px', fontSize: '14px', color: c.recovery_identified > 0 ? '#C9962B' : '#3A4A5E', fontWeight: c.recovery_identified > 0 ? 600 : 400, fontFamily: "'Cormorant Garamond', serif" }}>
                        ${c.recovery_identified.toLocaleString()}
                      </td>
                      {/* Analysis status for active tab */}
                      <td style={{ padding: '14px 20px' }}>
                        {hasResult ? (
                          <span style={{ fontSize: '10px', color: '#22c987', fontFamily: "'Syne', sans-serif", letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 700 }}>✓ Run</span>
                        ) : (
                          <span style={{ fontSize: '10px', color: '#2A3F5F', fontFamily: "'Syne', sans-serif", letterSpacing: '0.06em', textTransform: 'uppercase' }}>No analysis run</span>
                        )}
                      </td>
                      {/* Actions */}
                      <td style={{ padding: '14px 20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          {/* Tool button for active tab */}
                          <button
                            onClick={() => router.push(cfg.route(c.id))}
                            style={{
                              background: 'transparent',
                              border: '1px solid #1A2E4A',
                              color: '#9A927E',
                              padding: '5px 12px',
                              borderRadius: '2px',
                              fontSize: '10px',
                              fontWeight: 700,
                              letterSpacing: '0.08em',
                              textTransform: 'uppercase',
                              fontFamily: "'Syne', sans-serif",
                              cursor: 'pointer',
                              whiteSpace: 'nowrap',
                              transition: 'all 0.2s',
                            }}
                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = '#C9962B'; (e.currentTarget as HTMLElement).style.color = '#C9962B' }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = '#1A2E4A'; (e.currentTarget as HTMLElement).style.color = '#9A927E' }}
                          >{cfg.btnLabel}</button>

                          {/* Status toggle */}
                          <button onClick={() => toggleStatus(c)} title={c.status === 'active' ? 'Mark inactive' : 'Mark active'} style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px', color: c.status === 'active' ? '#22c987' : '#3A4A5E', display: 'flex', alignItems: 'center', transition: 'color 0.15s' }}
                            onMouseEnter={e => { if (c.status !== 'active') (e.currentTarget as HTMLElement).style.color = '#6E7D94' }}
                            onMouseLeave={e => { if (c.status !== 'active') (e.currentTarget as HTMLElement).style.color = '#3A4A5E' }}
                          >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              {c.status === 'active'
                                ? <><rect x="1" y="5" width="22" height="14" rx="7"/><circle cx="16" cy="12" r="3" fill="currentColor" stroke="none"/></>
                                : <><rect x="1" y="5" width="22" height="14" rx="7"/><circle cx="8" cy="12" r="3" fill="currentColor" stroke="none"/></>
                              }
                            </svg>
                          </button>

                          {/* Delete */}
                          {confirmDelete === c.id ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <button onClick={() => handleDelete(c.id)} style={{ background: 'rgba(220,38,38,0.1)', border: '1px solid rgba(220,38,38,0.3)', color: '#fca5a5', padding: '3px 10px', borderRadius: '2px', fontSize: '10px', cursor: 'pointer', fontWeight: 700, letterSpacing: '0.06em', fontFamily: "'Syne', sans-serif" }}>Confirm</button>
                              <button onClick={() => setConfirmDelete(null)} style={{ background: 'transparent', border: '1px solid #1A2E4A', color: '#6E7D94', padding: '3px 10px', borderRadius: '2px', fontSize: '10px', cursor: 'pointer', fontFamily: "'Syne', sans-serif" }}>Cancel</button>
                            </div>
                          ) : (
                            <button onClick={() => setConfirmDelete(c.id)} title="Delete case" style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px', color: '#1A2E4A', display: 'flex', alignItems: 'center', transition: 'color 0.15s' }}
                              onMouseEnter={e => (e.currentTarget.style.color = '#dc2626')}
                              onMouseLeave={e => (e.currentTarget.style.color = '#1A2E4A')}
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/>
                              </svg>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* ── FOOTER ── */}
        <div style={{ paddingTop: '28px', borderTop: '1px solid #1A2E4A', display: 'flex', alignItems: 'center', gap: '12px' }}>
          {[
            { href: '/support', label: 'Support' },
            { href: '/terms',   label: 'Terms'   },
          ].map(link => (
            <a key={link.href} href={link.href} style={{
              display: 'inline-block', background: 'transparent',
              border: '1px solid #1A2E4A', color: '#6E7D94',
              padding: '8px 18px', borderRadius: '2px',
              fontSize: '11px', textDecoration: 'none',
              letterSpacing: '0.08em', textTransform: 'uppercase',
              fontFamily: "'Syne', sans-serif", transition: 'all 0.2s',
            }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = '#6E7D94'; (e.currentTarget as HTMLElement).style.color = '#EDE6D0' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = '#1A2E4A'; (e.currentTarget as HTMLElement).style.color = '#6E7D94' }}
            >{link.label}</a>
          ))}
          <span style={{ marginLeft: 'auto', fontSize: '11px', color: '#1A2E4A', fontFamily: "'Syne', sans-serif", letterSpacing: '0.06em' }}>
            ThemisOS is not legal counsel. Analysis is provided for attorney review only.
          </span>
        </div>

      </main>
    </div>
  )
}