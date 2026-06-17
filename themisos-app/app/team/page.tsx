'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'https://app.themisos.ai'

const MANAGER_ROLES = ['owner', 'billing_admin', 'admin']

const ROLE_LABELS: Record<string, string> = {
  owner: 'Owner',
  billing_admin: 'Billing Admin',
  admin: 'Admin',
  member: 'Member',
  viewer: 'Viewer',
}

type Member = {
  id: string
  email: string
  full_name: string
  role: string
  status: 'active' | 'invited' | 'suspended'
}

type Notice = { type: 'success' | 'error'; text: string } | null

export default function TeamPage() {
  const [loading, setLoading] = useState(true)
  const [myId, setMyId] = useState('')
  const [userName, setUserName] = useState('there')

  const [firmName, setFirmName] = useState('')
  const [seatsUsed, setSeatsUsed] = useState(0)
  const [seatsAllowed, setSeatsAllowed] = useState<number | null>(null)
  const [members, setMembers] = useState<Member[]>([])

  const [inviteName, setInviteName] = useState('')
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviting, setInviting] = useState(false)
  const [notice, setNotice] = useState<Notice>(null)

  const [confirmRemove, setConfirmRemove] = useState<string | null>(null)
  const [removingId, setRemovingId] = useState<string | null>(null)

  const router = useRouter()
  const supabase = createClient()

  const getToken = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token || ''
  }

  const loadTeam = async () => {
    const token = await getToken()
    const res = await fetch(`${API_BASE}/firm-members`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const data = await res.json().catch(() => ({}))
    if (res.ok) {
      setMembers(data.members || [])
      setSeatsUsed(data.seats_used ?? 0)
      setSeatsAllowed(data.seats_allowed ?? null)
      setFirmName(data.firm_name || '')
    }
  }

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setMyId(user.id)

      const { data: profile } = await supabase
        .from('profiles').select('full_name, role').eq('id', user.id).single()
      const role = profile?.role || ''

      if (!MANAGER_ROLES.includes(role)) { router.push('/dashboard'); return }

      if (profile?.full_name) {
        setUserName(profile.full_name.split(' ')[0])
      } else if (user.email) {
        const prefix = user.email.split('@')[0]
        setUserName(prefix.charAt(0).toUpperCase() + prefix.slice(1))
      }

      await loadTeam()
      setLoading(false)
    }
    init()
  }, [])

  const seatsFull = seatsAllowed != null && seatsUsed >= seatsAllowed

  const handleInvite = async () => {
    const email = inviteEmail.trim()
    if (!email) { setNotice({ type: 'error', text: 'Enter an email address to send an invite.' }); return }
    setInviting(true)
    setNotice(null)
    try {
      const token = await getToken()
      const res = await fetch(`${API_BASE}/invite-member`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ member_email: email, member_name: inviteName.trim() }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.success) {
        setNotice({ type: 'success', text: `Invitation sent to ${email}. They'll set their password and land in your firm.` })
        setInviteEmail('')
        setInviteName('')
        await loadTeam()
      } else {
        setNotice({ type: 'error', text: data.error || 'Could not send the invitation.' })
      }
    } catch {
      setNotice({ type: 'error', text: 'Network error — please try again.' })
    } finally {
      setInviting(false)
    }
  }

  const handleRemove = async (id: string) => {
    setRemovingId(id)
    try {
      const token = await getToken()
      const res = await fetch(`${API_BASE}/remove-member`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ member_id: id }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.success) {
        setConfirmRemove(null)
        await loadTeam()
      } else {
        setNotice({ type: 'error', text: data.error || 'Could not remove that member.' })
        setConfirmRemove(null)
      }
    } catch {
      setNotice({ type: 'error', text: 'Network error — please try again.' })
    } finally {
      setRemovingId(null)
    }
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const inputStyle = {
    flex: 1,
    minWidth: 0,
    background: '#05090F',
    border: '1px solid #1A2E4A',
    borderRadius: '2px',
    color: '#EDE6D0',
    padding: '11px 14px',
    fontSize: '14px',
    fontFamily: "'Syne', sans-serif",
    outline: 'none',
    transition: 'border-color 0.2s',
  }

  const statusStyles: Record<string, { bg: string; color: string; border: string; label: string }> = {
    active:    { bg: 'rgba(34,201,135,0.08)',  color: '#22c987', border: 'rgba(34,201,135,0.2)',  label: 'Active'    },
    invited:   { bg: 'rgba(201,150,43,0.08)',  color: '#C9962B', border: 'rgba(201,150,43,0.25)', label: 'Invited'   },
    suspended: { bg: 'rgba(110,125,148,0.1)',  color: '#6E7D94', border: 'rgba(110,125,148,0.2)', label: 'Removed'   },
  }

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#05090F',
      color: '#EDE6D0',
      fontFamily: "'Syne', sans-serif",
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
        .panel { animation: fadeSlideIn 0.35s cubic-bezier(0.22, 1, 0.36, 1); }
        .member-row { transition: background 0.2s ease; }
        .member-row:hover { background-color: rgba(255,255,255,0.02) !important; }
        input::placeholder { color: #3A4A5E; }
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
        {/* Logo → back to dashboard */}
        <a href="/dashboard" style={{ display: 'flex', alignItems: 'center', gap: '10px', paddingRight: '24px', borderRight: '1px solid #1A2E4A', height: '100%', textDecoration: 'none' }}>
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
        </a>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginLeft: '24px' }}>
          <a href="/dashboard" style={{
            display: 'inline-flex', alignItems: 'center', gap: '6px',
            fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase',
            color: '#C9962B', textDecoration: 'none', fontWeight: 600,
            border: '1px solid rgba(201,150,43,0.3)', borderRadius: '2px',
            padding: '6px 14px', background: 'rgba(201,150,43,0.06)', transition: 'all 0.2s',
          }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(201,150,43,0.12)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(201,150,43,0.6)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(201,150,43,0.06)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(201,150,43,0.3)' }}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
            Dashboard
          </a>
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
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '40px', gap: '24px', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#C9962B', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ display: 'inline-block', width: '20px', height: '1px', background: '#C9962B', opacity: 0.6 }}></span>
              Team
            </div>
            <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '2rem', fontWeight: 600, color: '#ffffff', marginBottom: '6px', lineHeight: 1.1 }}>
              {firmName ? <>{firmName} <em style={{ color: '#C9962B', fontStyle: 'italic' }}>Team</em></> : <>Your <em style={{ color: '#C9962B', fontStyle: 'italic' }}>Team</em></>}
            </h2>
            <p style={{ fontFamily: "'Cormorant Garamond', serif", fontStyle: 'italic', color: '#6E7D94', fontSize: '15px' }}>
              Invite attorneys to your firm and manage who has access.
            </p>
          </div>

          {/* Seat counter */}
          <div style={{ background: '#0A1220', border: '1px solid #1A2E4A', borderRadius: '3px', padding: '18px 26px', minWidth: '150px', textAlign: 'right', flexShrink: 0 }}>
            <p style={{ fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#6E7D94', marginBottom: '8px', fontWeight: 600 }}>Seats</p>
            <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '2rem', fontWeight: 600, color: seatsFull ? '#C9962B' : '#ffffff', lineHeight: 1, marginBottom: '4px' }}>
              {loading ? '—' : `${seatsUsed} / ${seatsAllowed != null ? seatsAllowed : '∞'}`}
            </p>
            <p style={{ fontSize: '10px', color: '#2A3F5F', letterSpacing: '0.06em' }}>
              {seatsAllowed == null ? 'no limit set yet' : seatsFull ? 'all seats in use' : 'seats in use'}
            </p>
          </div>
        </div>

        {/* ── INVITE PANEL ── */}
        <div className="panel" style={{ background: '#0A1220', border: '1px solid #1A2E4A', borderRadius: '3px', overflow: 'hidden', marginBottom: '32px' }}>
          <div style={{ padding: '16px 24px', borderBottom: '1px solid #1A2E4A' }}>
            <div style={{ fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#C9962B', fontWeight: 700 }}>
              Invite a Member
            </div>
          </div>

          <div style={{ padding: '24px' }}>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'stretch' }}>
              <input
                style={{ ...inputStyle, flex: '1 1 200px' }}
                placeholder="Full name (optional)"
                value={inviteName}
                onChange={e => setInviteName(e.target.value)}
                onFocus={e => (e.currentTarget.style.borderColor = '#C9962B')}
                onBlur={e => (e.currentTarget.style.borderColor = '#1A2E4A')}
                disabled={inviting}
              />
              <input
                style={{ ...inputStyle, flex: '1 1 240px' }}
                placeholder="attorney@firm.com"
                type="email"
                value={inviteEmail}
                onChange={e => setInviteEmail(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !inviting && !seatsFull) handleInvite() }}
                onFocus={e => (e.currentTarget.style.borderColor = '#C9962B')}
                onBlur={e => (e.currentTarget.style.borderColor = '#1A2E4A')}
                disabled={inviting}
              />
              <button
                onClick={handleInvite}
                disabled={inviting || seatsFull}
                style={{
                  backgroundColor: (inviting || seatsFull) ? '#2A3F5F' : '#C9962B',
                  color: (inviting || seatsFull) ? '#6E7D94' : '#05090F',
                  padding: '11px 28px', borderRadius: '2px', fontSize: '12px', fontWeight: 700,
                  border: 'none', cursor: (inviting || seatsFull) ? 'not-allowed' : 'pointer',
                  letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: "'Syne', sans-serif",
                  transition: 'background 0.2s', whiteSpace: 'nowrap', flexShrink: 0,
                }}
                onMouseEnter={e => { if (!inviting && !seatsFull) e.currentTarget.style.background = '#E2B44A' }}
                onMouseLeave={e => { if (!inviting && !seatsFull) e.currentTarget.style.background = '#C9962B' }}
              >{inviting ? 'Sending…' : 'Send Invite'}</button>
            </div>

            {seatsFull && (
              <p style={{ marginTop: '14px', fontSize: '12px', color: '#C9962B', fontFamily: "'Cormorant Garamond', serif", fontStyle: 'italic' }}>
                All {seatsAllowed} seats are in use. Remove a member, or add seats to your plan, before inviting another.
              </p>
            )}

            {notice && (
              <div style={{
                marginTop: '16px', padding: '12px 16px', borderRadius: '2px', fontSize: '13px',
                background: notice.type === 'success' ? 'rgba(34,201,135,0.08)' : 'rgba(220,38,38,0.08)',
                border: `1px solid ${notice.type === 'success' ? 'rgba(34,201,135,0.25)' : 'rgba(220,38,38,0.3)'}`,
                color: notice.type === 'success' ? '#22c987' : '#fca5a5',
                fontFamily: "'Syne', sans-serif",
              }}>
                {notice.text}
              </div>
            )}
          </div>
        </div>

        {/* ── MEMBERS TABLE ── */}
        <div className="panel" style={{ background: '#0A1220', border: '1px solid #1A2E4A', borderRadius: '3px', overflow: 'hidden', marginBottom: '48px' }}>
          <div style={{ padding: '16px 24px', borderBottom: '1px solid #1A2E4A', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#C9962B', fontWeight: 700 }}>Members</div>
            <div style={{ fontSize: '10px', color: '#2A3F5F', letterSpacing: '0.06em' }}>
              {loading ? '' : `${members.length} ${members.length === 1 ? 'person' : 'people'}`}
            </div>
          </div>

          {loading ? (
            <div style={{ padding: '48px', textAlign: 'center', color: '#6E7D94', fontFamily: "'Cormorant Garamond', serif", fontStyle: 'italic' }}>Loading…</div>
          ) : members.length === 0 ? (
            <div style={{ padding: '48px', textAlign: 'center' }}>
              <p style={{ fontFamily: "'Cormorant Garamond', serif", fontStyle: 'italic', color: '#9A927E', fontSize: '15px' }}>
                No members yet. Send an invite above to add your first attorney.
              </p>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #1A2E4A' }}>
                  {['Member', 'Email', 'Role', 'Status', ''].map(h => (
                    <th key={h} style={{ padding: '10px 20px', textAlign: 'left', fontSize: '10px', color: '#3A4A5E', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: "'Syne', sans-serif" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {members.map(m => {
                  const st = statusStyles[m.status] || statusStyles.invited
                  const isSelf = m.id === myId
                  const isOwner = m.role === 'owner'
                  const canRemove = !isSelf && !isOwner
                  return (
                    <tr key={m.id} className="member-row" style={{ borderBottom: '1px solid #1A2E4A' }}>
                      {/* Name */}
                      <td style={{ padding: '14px 20px', fontSize: '14px', color: '#EDE6D0', fontWeight: 500, fontFamily: "'Cormorant Garamond', serif" }}>
                        {m.full_name || '—'}
                        {isSelf && <span style={{ marginLeft: '8px', fontSize: '9px', color: '#6E7D94', fontFamily: "'Syne', sans-serif", letterSpacing: '0.08em', textTransform: 'uppercase' }}>You</span>}
                      </td>
                      {/* Email */}
                      <td style={{ padding: '14px 20px', fontSize: '13px', color: '#6E7D94', fontFamily: "'Syne', sans-serif" }}>{m.email || '—'}</td>
                      {/* Role */}
                      <td style={{ padding: '14px 20px', fontSize: '12px', color: isOwner ? '#C9962B' : '#9A927E', fontFamily: "'Syne', sans-serif", letterSpacing: '0.04em' }}>
                        {ROLE_LABELS[m.role] || m.role}
                      </td>
                      {/* Status */}
                      <td style={{ padding: '14px 20px' }}>
                        <span style={{ background: st.bg, color: st.color, border: `1px solid ${st.border}`, padding: '3px 10px', borderRadius: '2px', fontSize: '10px', letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: "'Syne', sans-serif", fontWeight: 700 }}>{st.label}</span>
                      </td>
                      {/* Remove */}
                      <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                        {!canRemove ? (
                          <span style={{ fontSize: '10px', color: '#1A2E4A', fontFamily: "'Syne', sans-serif", letterSpacing: '0.06em', textTransform: 'uppercase' }}>—</span>
                        ) : confirmRemove === m.id ? (
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px' }}>
                            <button onClick={() => handleRemove(m.id)} disabled={removingId === m.id} style={{ background: 'rgba(220,38,38,0.1)', border: '1px solid rgba(220,38,38,0.3)', color: '#fca5a5', padding: '3px 10px', borderRadius: '2px', fontSize: '10px', cursor: 'pointer', fontWeight: 700, letterSpacing: '0.06em', fontFamily: "'Syne', sans-serif" }}>
                              {removingId === m.id ? 'Removing…' : 'Confirm'}
                            </button>
                            <button onClick={() => setConfirmRemove(null)} style={{ background: 'transparent', border: '1px solid #1A2E4A', color: '#6E7D94', padding: '3px 10px', borderRadius: '2px', fontSize: '10px', cursor: 'pointer', fontFamily: "'Syne', sans-serif" }}>Cancel</button>
                          </div>
                        ) : (
                          <button onClick={() => setConfirmRemove(m.id)} style={{ background: 'transparent', border: '1px solid #1A2E4A', color: '#6E7D94', padding: '5px 12px', borderRadius: '2px', fontSize: '10px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: "'Syne', sans-serif", cursor: 'pointer', transition: 'all 0.2s' }}
                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = '#dc2626'; (e.currentTarget as HTMLElement).style.color = '#fca5a5' }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = '#1A2E4A'; (e.currentTarget as HTMLElement).style.color = '#6E7D94' }}
                          >Remove</button>
                        )}
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