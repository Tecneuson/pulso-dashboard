'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Activity, ShieldCheck } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button, Input } from '@/components/ui'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setLoading(false)
      setError('E-mail ou senha incorretos.')
      return
    }

    router.replace('/dashboard')
    router.refresh()
  }

  return (
    <div className="min-h-screen flex bg-surface-primary">
      {/* Painel de marca */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-gradient-to-br from-brand-800 via-brand-900 to-[#0A2417] p-12 flex-col justify-between">
        <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-brand-500/20 blur-3xl" />
        <div className="absolute -bottom-32 -left-16 w-96 h-96 rounded-full bg-brand-400/10 blur-3xl" />

        <div className="relative flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-500 flex items-center justify-center shadow-lg">
            <Activity size={22} className="text-white" strokeWidth={2.5} />
          </div>
          <span className="font-display text-2xl font-semibold tracking-tight text-white">Pulso</span>
        </div>

        <div className="relative">
          <h2 className="font-display text-3xl font-semibold leading-tight text-white max-w-sm">
            Gestão de atendimento do Hospital Santa Mônica
          </h2>
          <p className="text-white/60 mt-4 max-w-sm leading-relaxed">
            Triagem, funil de internação e reativação de pacientes em um só lugar — com a clareza e o
            cuidado que o hospital exige.
          </p>
        </div>

        <div className="relative flex items-center gap-2 text-white/50 text-sm">
          <ShieldCheck size={16} />
          Acesso restrito e protegido
        </div>
      </div>

      {/* Formulário */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="lg:hidden flex flex-col items-center mb-8">
            <div className="w-12 h-12 rounded-xl bg-brand-500 flex items-center justify-center mb-3">
              <Activity size={24} className="text-white" strokeWidth={2.5} />
            </div>
            <h1 className="font-display text-xl font-semibold text-content-primary">Pulso</h1>
          </div>

          <div className="mb-6">
            <h1 className="font-display text-display-md text-content-primary">Entrar</h1>
            <p className="text-sm text-content-tertiary mt-1">
              Use suas credenciais da equipe do hospital.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              id="email"
              label="E-mail"
              type="email"
              autoComplete="email"
              placeholder="voce@hospital.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <Input
              id="password"
              label="Senha"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />

            {error && (
              <div className="flex items-start gap-2 rounded bg-danger-500/12 border border-danger-500/20 px-3 py-2">
                <p className="text-sm text-danger-700 dark:text-danger-500" role="alert">
                  {error}
                </p>
              </div>
            )}

            <Button type="submit" size="lg" className="w-full" loading={loading}>
              {loading ? 'Entrando...' : 'Entrar'}
            </Button>
          </form>

          <p className="text-center text-xs text-content-tertiary mt-6">
            Hospital Santa Mônica · Pulso
          </p>
        </div>
      </div>
    </div>
  )
}
