'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useState } from 'react'
import { Button } from '@/components/ui'
import type { UsuarioResumo } from '@/lib/api-store'

/**
 * Filtros do BI: período (presets ou de/até) e atendente. Tudo vai para a querystring —
 * a página (server) recalcula. Link compartilhável.
 */

const PRESETS = [
  { value: 'tudo', label: 'Tudo' },
  { value: 'hoje', label: 'Hoje' },
  { value: '7d', label: '7 dias' },
  { value: '30d', label: '30 dias' },
  { value: 'mes', label: 'Mês atual' },
]

const inputCls =
  'h-9 rounded bg-surface-secondary border border-border text-sm px-2 text-content-primary focus:outline-none focus:ring-2 focus:ring-brand-500/40'

export function FiltrosBI({
  de,
  ate,
  atendente,
  preset,
  atendentes,
}: {
  de: string
  ate: string
  atendente: string
  preset: string
  atendentes: UsuarioResumo[]
}) {
  const router = useRouter()
  const sp = useSearchParams()
  const [deLocal, setDeLocal] = useState(de)
  const [ateLocal, setAteLocal] = useState(ate)

  function push(next: Record<string, string>) {
    const params = new URLSearchParams(sp.toString())
    for (const [k, v] of Object.entries(next)) {
      if (v) params.set(k, v)
      else params.delete(k)
    }
    router.push(`/reports?${params.toString()}`)
  }

  const presetAtivo = preset || (de || ate ? 'custom' : 'tudo')

  return (
    <div className="flex flex-wrap items-end gap-3 mb-6 p-3 rounded-lg border border-border bg-surface-secondary/60">
      <div>
        <p className="text-xs text-content-secondary mb-1">Período</p>
        <div className="inline-flex rounded-lg bg-surface-secondary border border-border p-0.5">
          {PRESETS.map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => push({ preset: p.value, de: '', ate: '' })}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                presetAtivo === p.value
                  ? 'bg-surface-elevated text-content-primary shadow-card'
                  : 'text-content-secondary hover:text-content-primary'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>
      <div>
        <p className="text-xs text-content-secondary mb-1">De</p>
        <input type="date" className={inputCls} value={deLocal} onChange={(e) => setDeLocal(e.target.value)} />
      </div>
      <div>
        <p className="text-xs text-content-secondary mb-1">Até</p>
        <input type="date" className={inputCls} value={ateLocal} onChange={(e) => setAteLocal(e.target.value)} />
      </div>
      <Button size="sm" variant="secondary" onClick={() => push({ preset: '', de: deLocal, ate: ateLocal })}>
        Aplicar datas
      </Button>
      <div className="min-w-[200px]">
        <p className="text-xs text-content-secondary mb-1">Atendente</p>
        <select className={`${inputCls} w-full`} value={atendente} onChange={(e) => push({ atendente: e.target.value })}>
          <option value="">Todos</option>
          {atendentes.map((u) => (
            <option key={u.id} value={u.id}>
              {u.nome}
            </option>
          ))}
        </select>
      </div>
      {(de || ate || atendente || preset) && (
        <button
          type="button"
          onClick={() => router.push('/reports')}
          className="text-xs text-content-secondary hover:text-danger-500 pb-2"
        >
          Limpar filtros
        </button>
      )}
    </div>
  )
}
