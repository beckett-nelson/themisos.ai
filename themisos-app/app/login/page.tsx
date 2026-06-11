'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [resetSent, setResetSent] = useState(false)
  const [resetLoading, setResetLoading] = useState(false)
  const [showReset, setShowReset] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const hash = window.location.hash
    if (hash && hash.includes('type=invite')) {
      router.replace('/auth/confirm' + hash)
    }
  }, [])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      router.push('/dashboard')
    }
  }

  const handlePasswordReset = async () => {
    if (!email) {
      setError('Enter your email address above, then click forgot password.')
      return
    }
    setResetLoading(true)
    setError('')
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset`,
    })
    setResetLoading(false)
    if (error) {
      setError(error.message)
    } else {
      setResetSent(true)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: '#0a0f1e' }}>
      <div className="w-full max-w-md">

        {/* Wordmark — no icon, no header bar */}
        <div className="text-center mb-10">
          <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '2rem', fontWeight: 600, letterSpacing: '0.01em', lineHeight: 1 }}>
            <span style={{ color: '#ffffff' }}>Themis</span><span style={{ color: '#C9962B' }}>OS</span>
          </h1>
          <p style={{ color: '#6E7D94', marginTop: '0.5rem', fontSize: '0.8125rem', letterSpacing: '0.04em' }}>
            Insurance Recovery Platform
          </p>
        </div>

        <div style={{
          background: '#111827',
          border: '1px solid #1e2d4a',
          borderRadius: '4px',
          padding: '2rem',
        }}>
          <h2 style={{ color: '#ffffff', fontSize: '1.125rem', fontWeight: 600, marginBottom: '1.5rem', letterSpacing: '0.01em' }}>
            Sign in to your account
          </h2>

          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', color: '#6E7D94', marginBottom: '0.375rem', letterSpacing: '0.06em', textTransform: 'uppercase', fontFamily: "'Syne', sans-serif" }}>
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                style={{
                  width: '100%',
                  background: '#0a0f1e',
                  border: '1px solid #1e2d4a',
                  color: '#ffffff',
                  borderRadius: '3px',
                  padding: '0.625rem 1rem',
                  fontSize: '0.875rem',
                  outline: 'none',
                  transition: 'border-color 0.2s',
                }}
                onFocus={e => e.currentTarget.style.borderColor = '#C9962B'}
                onBlur={e => e.currentTarget.style.borderColor = '#1e2d4a'}
                placeholder="you@yourfirm.com"
              />
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.375rem' }}>
                <label style={{ fontSize: '0.75rem', color: '#6E7D94', letterSpacing: '0.06em', textTransform: 'uppercase', fontFamily: "'Syne', sans-serif" }}>
                  Password
                </label>
                <button
                  type="button"
                  onClick={handlePasswordReset}
                  disabled={resetLoading}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '0.6875rem',
                    color: '#7A5A18',
                    letterSpacing: '0.04em',
                    padding: 0,
                    transition: 'color 0.2s',
                    fontFamily: "'DM Mono', monospace",
                  }}
                  onMouseEnter={e => e.currentTarget.style.color = '#C9962B'}
                  onMouseLeave={e => e.currentTarget.style.color = '#7A5A18'}
                >
                  {resetLoading ? 'Sending…' : 'Forgot password?'}
                </button>
              </div>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    background: '#0a0f1e',
                    border: '1px solid #1e2d4a',
                    color: '#ffffff',
                    borderRadius: '3px',
                    padding: '0.625rem 2.5rem 0.625rem 1rem',
                    fontSize: '0.875rem',
                    outline: 'none',
                    transition: 'border-color 0.2s',
                  }}
                  onFocus={e => e.currentTarget.style.borderColor = '#C9962B'}
                  onBlur={e => e.currentTarget.style.borderColor = '#1e2d4a'}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                  style={{
                    position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer', color: '#4a5568', padding: 0,
                    transition: 'color 0.2s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.color = '#9A927E'}
                  onMouseLeave={e => e.currentTarget.style.color = '#4a5568'}
                >
                  {showPassword ? (
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                      <line x1="1" y1="1" x2="23" y2="23"/>
                    </svg>
                  ) : (
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                      <circle cx="12" cy="12" r="3"/>
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Reset confirmation */}
            {resetSent && (
              <div style={{
                background: 'rgba(201,150,43,0.06)',
                border: '1px solid rgba(201,150,43,0.25)',
                borderRadius: '3px',
                padding: '0.75rem 1rem',
                fontSize: '0.8125rem',
                color: '#C9962B',
                fontFamily: "'DM Mono', monospace",
                letterSpacing: '0.03em',
              }}>
                Reset link sent — check your inbox.
              </div>
            )}

            {error && (
              <p style={{ color: '#f87171', fontSize: '0.8125rem', margin: 0 }}>{error}</p>
            )}

            {/* Sign In button — sharp, glowing on hover */}
            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                background: '#C9962B',
                color: '#05090F',
                border: 'none',
                borderRadius: '2px',
                padding: '0.8rem 1.5rem',
                fontSize: '0.8125rem',
                fontWeight: 700,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.6 : 1,
                transition: 'background 0.2s, box-shadow 0.2s, transform 0.15s',
                fontFamily: "'Syne', sans-serif",
              }}
              onMouseEnter={e => {
                if (!loading) {
                  e.currentTarget.style.background = '#E2B44A'
                  e.currentTarget.style.boxShadow = '0 0 24px rgba(201,150,43,0.45), 0 4px 16px rgba(201,150,43,0.25)'
                  e.currentTarget.style.transform = 'translateY(-1px)'
                }
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = '#C9962B'
                e.currentTarget.style.boxShadow = 'none'
                e.currentTarget.style.transform = 'translateY(0)'
              }}
            >
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>
        </div>

        <p style={{ textAlign: 'center', color: '#4a5568', fontSize: '0.6875rem', marginTop: '1.5rem', letterSpacing: '0.03em' }}>
          Access is by invitation only. Contact your administrator.
        </p>
        <p style={{ textAlign: 'center', marginTop: '0.75rem' }}>
          <a
            href="https://www.themisos.ai"
            style={{ color: '#7A5A18', fontSize: '0.75rem', textDecoration: 'none', transition: 'color 0.2s' }}
            onMouseEnter={e => e.currentTarget.style.color = '#C9962B'}
            onMouseLeave={e => e.currentTarget.style.color = '#7A5A18'}
          >
            ← Return to Home
          </a>
        </p>
      </div>
    </div>
  )
}