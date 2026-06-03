'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

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

  return (
    <div className="min-h-screen bg-[#0a0f1e] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-serif tracking-wide">
  <span className="text-white">Themis</span><span className="text-[#c9a84c]">OS</span>
</h1>

          <p className="text-gray-400 mt-2 text-sm">Insurance Recovery Platform</p>
        </div>

        <div className="bg-[#111827] border border-[#1e2d4a] rounded-xl p-8">
          <h2 className="text-white text-xl font-semibold mb-6">Sign in to your account</h2>

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full bg-[#0a0f1e] border border-[#1e2d4a] text-white rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-[#c9a84c]"
                placeholder="you@yourfirm.com"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full bg-[#0a0f1e] border border-[#1e2d4a] text-white rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-[#c9a84c]"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <p className="text-red-400 text-sm">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#c9a84c] hover:bg-[#b8963e] text-[#0a0f1e] font-semibold rounded-lg py-2.5 text-sm transition-colors disabled:opacity-50"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        </div>

        <p className="text-center text-gray-600 text-xs mt-6">
  Access is by invitation only. Contact your administrator.
</p>
<p className="text-center mt-3">
  <a href="https://www.themisos.ai" className="text-[#c9a84c] text-xs hover:underline">
    ← Return to Home
  </a>
</p>
      </div>
    </div>
  )
}