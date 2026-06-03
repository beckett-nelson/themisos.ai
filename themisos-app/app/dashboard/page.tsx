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

      if (profile?.full_name) {
        setUserName(profile.full_name.split(' ')[0])
      }

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
          <button
            onClick={() => router.push('/cases/new')}
            style={{ backgroundColor: '#c9a84c', color: '#0a0f1e', padding: '10px 24px', borderRadius: '8px', fontSize: '14px', fontWeight: 600, border: 'none', cursor: 'pointer' }}
          >
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
                  {['Case Name', 'Claimant', 'Status', 'Docs', 'Recovery'].map(h => (
                    <th key={h} style={{ padding: '12px 24px', textAlign: 'left', fontSize: '12px', color: '#6b7280', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {cases.map((c) => (
                  <tr
                    key={c.id}
                    onClick={() => router.push(`/cases/${c.id}`)}
                    style={{ borderBottom: '1px solid #1e2d4a', cursor: 'pointer' }}
                    onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#0a0f1e')}
                    onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    <td style={{ padding: '16px 24px', fontSize: '14px', color: '#ffffff', fontWeight: 500 }}>{c.name}</td>
                    <td style={{ padding: '16px 24px', fontSize: '14px', color: '#9ca3af' }}>{c.claimant || '—'}</td>
                    <td style={{ padding: '16px 24px' }}>
                      <span style={{ backgroundColor: c.status === 'active' ? '#052e16' : '#1c1917', color: c.status === 'active' ? '#4ade80' : '#9ca3af', padding: '2px 10px', borderRadius: '99px', fontSize: '12px' }}>
                        {c.status}
                      </span>
                    </td>
                    <td style={{ padding: '16px 24px', fontSize: '14px', color: '#9ca3af' }}>{c.documents_analyzed}</td>
                    <td style={{ padding: '16px 24px', fontSize: '14px', color: '#9ca3af' }}>${c.recovery_identified.toLocaleString()}</td>
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