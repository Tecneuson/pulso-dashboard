'use client'

import { useEffect, useState } from 'react'
import { Table2, Columns3 } from 'lucide-react'
import { Header } from '@/components/layout/header'
import { Select } from '@/components/ui/select'
import { FunilDadosProvider } from '../funil-dados'
import { ViewSwitcher } from '../view-switcher'
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
    <FunilDadosProvider leads={[]}>
      {/* Mesma regra do funil: a página não rola, o conteúdo rola por dentro. */}
      <div className="flex flex-col h-full min-h-0">
        <div className="shrink-0">
          <Header
            title="Pacientes"
            search={{
              value: search,
              onChange: setSearch,
              placeholder: 'Pesquisar por nome, CPF ou nº do paciente',
            }}
          />

          <ViewSwitcher current="pacientes" />
        </div>

        <div className="shrink-0 mb-4 flex flex-wrap items-end gap-2">
          <label className="block w-64">
            <span className="block text-xs text-content-secondary mb-1">
              Classificação do Paciente
            </span>
            <Select
              options={CLASSIFICACAO_OPTS}
              value={classificacao}
              onChange={(e) => setClassificacao(e.target.value)}
            />
          </label>

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

        <div className="flex-1 min-h-0 overflow-y-auto">
          {mode === 'tabela' ? (
            <PacientesTable
              key={`${debouncedQ}|${classificacao}`}
              q={debouncedQ}
              classificacao={classificacao}
              convenio=""
            />
          ) : (
            <div className="h-full min-h-0">
              <PacientesBoard q={debouncedQ} classificacao={classificacao} convenio="" />
            </div>
          )}
        </div>
      </div>
    </FunilDadosProvider>
  )
}
