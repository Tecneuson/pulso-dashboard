'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      router.push('/kanban')
    }
  }

  return (
    <div className="w-full max-w-sm space-y-8">
      {/* Logo */}
      <div className="text-center space-y-3">
        <div className="w-14 h-14 rounded-2xl bg-brand-500 flex items-center justify-center mx-auto shadow-card">
          <span className="text-white text-xl font-bold font-display">P</span>
        </div>
        <div>
          <h1 className="font-display text-[26px] font-semibold tracking-tight text-content-primary">
            Pulso
          </h1>
          <p className="text-sm text-content-tertiary mt-1">
            Hospital Santa Mônica
          </p>
        </div>
      </div>

      {/* Card */}
      <div className="bg-surface-elevated border border-border rounded-xl p-6 shadow-elevated">
        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-1.5">
            <label
              htmlFor="email"
              className="block text-[13px] font-medium text-content-secondary"
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com"
              required
              className="w-full h-11 px-3.5 rounded-lg bg-surface-secondary border border-border text-sm text-content-primary placeholder:text-content-tertiary focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition-all"
            />
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="password"
              className="block text-[13px] font-medium text-content-secondary"
            >
              Senha
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              className="w-full h-11 px-3.5 rounded-lg bg-surface-secondary border border-border text-sm text-content-primary placeholder:text-content-tertiary focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition-all"
            />
          </div>

          {error && (
            <p className="text-sm text-danger-500">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full h-11 rounded-full bg-brand-500 text-sm font-medium text-white hover:bg-brand-600 active:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  )
}
