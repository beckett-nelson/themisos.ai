'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type ClientRow = {
  id: string
  email: string
  firm_name: string
  full_name: string
  joined: string
  cases: number
  analyses_run: number
  last_active: string | null
}

export default function ClientsPage() {
  const [clients, setClients] = useState<ClientRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      try {
        const res = await fetch('https://app.themisos.ai/admin/clients')
        const data = await res.json()
        if (data.error) { setError(data.error); setLoading(false); return }
        setClients(data.clients || [])
      } catch (e: any) {
        setError('Could not reach server.')
      }
      setLoading(false)
    }
    load()
  }, [])

  const totalAnalyses = clients.reduce((s, c) => s + c.analyses_run, 0)
  const totalCases = clients.reduce((s, c) => s + c.cases, 0)

  const fmt = (d: string | null) => d
    ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : '—'

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#05090F', color: '#EDE6D0', fontFamily: "'Syne', sans-serif" }}>

      {/* NAV */}
      <nav style={{ borderBottom: '1px solid #1A2E4A', padding: '18px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(5,9,15,0.95)', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ fontFamily: 'Georgia, serif', fontSize: '18px', fontWeight: 600, letterSpacing: '0.05em' }}>
          <span style={{ color: '#ffffff' }}>Themis</span><span style={{ color: '#C9962B' }}>OS</span>
        </div>
        <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
          <a href="/admin/invite" style={{ fontSize: '12px', color: '#6E7D94', textDecoration: 'none', letterSpacing: '0.06em' }}>Invite Client</a>
          <a href="/dashboard" style={{ fontSize: '12px', color: '#6E7D94', textDecoration: 'none', letterSpacing: '0.06em' }}>← Dashboard</a>
        </div>
      </nav>

      <main style={{ padding: '52px 32px', maxWidth: '1100px', margin: '0 auto' }}>

        {/* HEADER */}
        <div style={{ marginBottom: '40px' }}>
          <div style={{ fontSize: '11px', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#C9962B', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ display: 'inline-block', width: '20px', height: '1px', background: '#C9962B', opacity: 0.6 }}></span>
            Admin
          </div>
          <h2 style={{ fontFamily: 'Georgia, serif', fontSize: '2rem', fontWeight: 400, color: '#ffffff', marginBottom: '6px' }}>
            Client <em style={{ color: '#C9962B', fontStyle: 'italic' }}>Manager</em>
          </h2>
          <p style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic', color: '#9A927E', fontSize: '15px' }}>
            Platform usage across all active clients.
          </p>
        </div>

        {/* STAT CARDS */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1px', background: '#1A2E4A', border: '1px solid #1A2E4A', marginBottom: '40px' }}>
          {[
            { label: 'Total Clients', value: loading ? '—' : clients.length.toString(), gold: false },
            { label: 'Total Cases', value: loading ? '—' : totalCases.toString(), gold: false },
            { label: 'Total Analyses Run', value: loading ? '—' : totalAnalyses.toString(), gold: true },
          ].map(card => (
            <div key={card.label} style={{ backgroundColor: '#0A1220', padding: '28px 24px' }}>
              <p style={{ fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#6E7D94', marginBottom: '12px', fontFamily: 'monospace' }}>{card.label}</p>
              <p style={{ fontFamily: 'Georgia, serif', fontSize: '2.25rem', fontWeight: 400, color: card.gold ? '#C9962B' : '#ffffff', lineHeight: 1 }}>{card.value}</p>
            </div>
          ))}
        </div>

        {/* TABLE */}
        <div style={{ background: '#0A1220', border: '1px solid #1A2E4A', overflow: 'hidden' }}>
          <div style={{ padding: '20px 24px', borderBottom: '1px solid #1A2E4A', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: '11px', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#C9962B', fontFamily: 'monospace', fontWeight: 600 }}>Clients</div>
            <div style={{ fontSize: '12px', color: '#6E7D94', fontFamily: 'monospace' }}>{loading ? '' : `${clients.length} total`}</div>
          </div>

          {loading ? (
            <div style={{ padding: '48px', textAlign: 'center', color: '#6E7D94', fontFamily: 'Georgia, serif', fontStyle: 'italic' }}>Loading...</div>
          ) : error ? (
            <div style={{ padding: '48px', textAlign: 'center', color: '#ff5a5a', fontFamily: 'monospace', fontSize: '13px' }}>{error}</div>
          ) : clients.length === 0 ? (
            <div style={{ padding: '48px', textAlign: 'center' }}>
              <p style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic', color: '#9A927E' }}>No clients yet.</p>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #1A2E4A' }}>
                  {['Email', 'Firm', 'Name', 'Cases', 'Analyses Run', 'Joined', 'Last Active'].map(h => (
                    <th key={h} style={{ padding: '12px 20px', textAlign: 'left', fontSize: '10px', color: '#6E7D94', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {clients.map((c) => (
                  <tr
                    key={c.id}
                    style={{ borderBottom: '1px solid #1A2E4A', transition: 'background 0.15s' }}
                    onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#05090F')}
                    onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    <td style={{ padding: '14px 20px', fontSize: '13px', color: '#EDE6D0', fontFamily: 'monospace' }}>{c.email || '—'}</td>
                    <td style={{ padding: '14px 20px', fontSize: '13px', color: '#9A927E', fontFamily: 'Georgia, serif', fontStyle: 'italic' }}>{c.firm_name || '—'}</td>
                    <td style={{ padding: '14px 20px', fontSize: '13px', color: '#9A927E', fontFamily: 'Georgia, serif' }}>{c.full_name || '—'}</td>
                    <td style={{ padding: '14px 20px', fontSize: '13px', color: '#9A927E', fontFamily: 'monospace' }}>{c.cases}</td>
                    <td style={{ padding: '14px 20px' }}>
                      <span style={{ fontSize: '14px', fontFamily: 'Georgia, serif', color: c.analyses_run > 0 ? '#C9962B' : '#6E7D94', fontWeight: 400 }}>
                        {c.analyses_run}
                      </span>
                    </td>
                    <td style={{ padding: '14px 20px', fontSize: '12px', color: '#6E7D94', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{fmt(c.joined)}</td>
                    <td style={{ padding: '14px 20px', fontSize: '12px', color: '#6E7D94', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{fmt(c.last_active)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <p style={{ marginTop: '16px', fontSize: '11px', color: '#6E7D94', fontFamily: 'monospace', letterSpacing: '0.06em' }}>
          Sorted by analyses run.
        </p>
      </main>
    </div>
  )
}