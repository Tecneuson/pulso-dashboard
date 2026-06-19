'use client'

import { useEffect, useState } from 'react'
import { Search, Table2, Columns3 } from 'lucide-react'
import { Select } from '@/components/ui/select'
import { PacientesTable } from './pacientes-table'
import { PacientesBoard } from './pacientes-board'

type Mode = 'tabela' | 'funil'

const CLASSIFICACAO_OPTS = [
  { value: '', label: 'Todas as classificações' },
  { value: 'Cliente Churn', label: 'Churn' },
  { value: 'Cliente Churn até 1 ano sem internação', label: 'Churn < 1 ano' },
  { value: 'Cliente Irregular', label: 'Irregular' },
  { value: 'Cliente Atualmente Internado', label: 'Atualmente internado' },
]

export function PacientesView() {
  const [mode, setMode] = useState<Mode>('tabela')
  const [search, setSearch] = useState('')
  const [debouncedQ, setDebouncedQ] = useState('')
  const [classificacao, setClassificacao] = useState('')

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(search.trim()), 300)
    return () => clearTimeout(t)
  }, [search])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-content-tertiary pointer-events-none"
          />
          <input
            type="text"
            placeholder="Buscar por nome..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 w-64 pl-8 pr-3 rounded-lg bg-surface-secondary border border-border text-sm text-content-primary placeholder:text-content-tertiary focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/40 transition-colors"
          />
        </div>

        <div className="w-56">
          <Select
            options={CLASSIFICACAO_OPTS}
            value={classificacao}
            onChange={(e) => setClassificacao(e.target.value)}
          />
        </div>

        <div className="ml-auto inline-flex items-center gap-0.5 p-0.5 rounded-full bg-surface-secondary border border-border">
          {([
            { key: 'tabela', label: 'Tabela', icon: Table2 },
            { key: 'funil', label: 'Funil', icon: Columns3 },
          ] as const).map((o) => {
            const activeMode = mode === o.key
            const Icon = o.icon
            return (
              <button
                key={o.key}
                onClick={() => setMode(o.key)}
                aria-pressed={activeMode}
                className={`focus-ring inline-flex items-center gap-1.5 px-3 h-8 rounded-full text-body-sm font-medium transition-colors ${
                  activeMode
                    ? 'bg-brand-500 text-white'
                    : 'text-content-secondary hover:text-content-primary'
                }`}
              >
                <Icon size={14} />
                {o.label}
              </button>
            )
          })}
        </div>
      </div>

      {mode === 'tabela' ? (
        <PacientesTable
          key={`${debouncedQ}|${classificacao}`}
          q={debouncedQ}
          classificacao={classificacao}
          convenio=""
        />
      ) : (
        <PacientesBoard q={debouncedQ} classificacao={classificacao} convenio="" />
      )}
    </div>
  )
}
