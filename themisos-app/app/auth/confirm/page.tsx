'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function ConfirmPage() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [ready, setReady] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    // Supabase puts the token in the URL hash — this exchanges it for a session
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        setReady(true)
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  const handleSetPassword = async () => {
    if (!password || password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.updateUser({ password })
    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      router.push('/dashboard')
    }
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#05090F', color: '#EDE6D0', fontFamily: "'Syne', sans-serif", display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{ width: '100%', maxWidth: '420px' }}>

        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <h1 style={{ fontFamily: 'Georgia, serif', fontSize: '28px', fontWeight: 600, letterSpacing: '0.05em' }}>
            <span style={{ color: '#ffffff' }}>Themis</span><span style={{ color: '#C9962B' }}>OS</span>
          </h1>
          <p style={{ color: '#6E7D94', marginTop: '8px', fontSize: '14px' }}>Insurance Recovery Platform</p>
        </div>

        <div style={{ background: '#0A1220', border: '1px solid #1A2E4A', borderRadius: '4px', padding: '32px' }}>
          {!ready ? (
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic', color: '#9A927E', fontSize: '15px', marginBottom: '8px' }}>
                Verifying your invite link...
              </p>
              <p style={{ fontSize: '13px', color: '#6E7D94' }}>This will only take a moment.</p>
            </div>
          ) : (
            <>
              <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#ffffff', marginBottom: '6px' }}>Set your password</h2>
              <p style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic', color: '#9A927E', fontSize: '14px', marginBottom: '28px' }}>
                Choose a password to secure your account.
              </p>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#6E7D94', marginBottom: '8px', fontFamily: 'monospace' }}>
                  New Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Min. 8 characters"
                  style={{ width: '100%', padding: '12px 14px', background: '#05090F', border: '1px solid #1A2E4A', borderRadius: '2px', color: '#EDE6D0', fontSize: '15px', outline: 'none', boxSizing: 'border-box' }}
                  onFocus={e => e.target.style.borderColor = '#C9962B'}
                  onBlur={e => e.target.style.borderColor = '#1A2E4A'}
                />
              </div>

              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#6E7D94', marginBottom: '8px', fontFamily: 'monospace' }}>
                  Confirm Password
                </label>
                <input
                  type="password"
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  placeholder="Re-enter password"
                  onKeyDown={e => e.key === 'Enter' && handleSetPassword()}
                  style={{ width: '100%', padding: '12px 14px', background: '#05090F', border: '1px solid #1A2E4A', borderRadius: '2px', color: '#EDE6D0', fontSize: '15px', outline: 'none', boxSizing: 'border-box' }}
                  onFocus={e => e.target.style.borderColor = '#C9962B'}
                  onBlur={e => e.target.style.borderColor = '#1A2E4A'}
                />
              </div>

              {error && (
                <p style={{ color: '#ff5a5a', fontSize: '13px', fontFamily: 'monospace', marginBottom: '16px' }}>{error}</p>
              )}

              <button
                onClick={handleSetPassword}
                disabled={loading}
                style={{ width: '100%', padding: '14px', background: loading ? '#7A5A18' : '#C9962B', color: '#05090F', border: 'none', borderRadius: '2px', fontSize: '13px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', cursor: loading ? 'not-allowed' : 'pointer', fontFamily: "'Syne', sans-serif" }}
              >
                {loading ? 'Setting password...' : 'Set Password & Enter Platform →'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}