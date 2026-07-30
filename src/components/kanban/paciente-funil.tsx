'use client'

import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import type { Paciente } from '@/types'
import { formatarCpf } from '@/lib/cpf'
import { classificacaoMeta, internacoesConhecidas, type ClassificacaoMeta } from '@/lib/funil'
import { situacaoAgendamento } from '@/lib/agendamentos'
import { CardBase } from './card-base'
import { useFunilDados } from './funil-dados'

// Colunas de classificação do funil unificado: somente leitura, dados servidos
// paginados (11k+ pacientes — nunca carregar tudo). O card entra/sai conforme a
// classificação do CSV mensal; ninguém arrasta card para cá.

const PAGE = 30

interface PacientesState {
  rows: Paciente[]
  count: number
  loading: boolean
  error: boolean
}

/** Filtros do funil aplicados no servidor às colunas de pacientes. */
export interface PacienteQuery {
  q?: string
  convenios?: string[]
}

function buildParams(classificacao: string, query: PacienteQuery, offset: number): URLSearchParams {
  const params = new URLSearchParams({
    classificacao,
    limit: String(PAGE),
    offset: String(offset),
  })
  if (query.q?.trim()) params.set('q', query.q.trim())
  if (query.convenios?.length) params.set('convenio', query.convenios.join(','))
  return params
}

function usePacientesClassificacao(
  classificacao: string,
  query: PacienteQuery
): PacientesState & { loadMore: () => void } {
  const [state, setState] = useState<PacientesState>({
    rows: [],
    count: 0,
    loading: true,
    error: false,
  })
  const q = query.q?.trim() ?? ''
  const conveniosKey = (query.convenios ?? []).join(',')
  const convenios = conveniosKey ? conveniosKey.split(',') : []

  useEffect(() => {
    let alive = true
    setState({ rows: [], count: 0, loading: true, error: false })
    fetch(`/api/pacientes?${buildParams(classificacao, { q, convenios }, 0)}`)
      .then((r) => r.json())
      .then((data) => {
        if (!alive) return
        if (data.error) {
          setState((s) => ({ ...s, loading: false, error: true }))
          return
        }
        setState({ rows: data.rows ?? [], count: data.count ?? 0, loading: false, error: false })
      })
      .catch(() => {
        if (alive) setState((s) => ({ ...s, loading: false, error: true }))
      })
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classificacao, q, conveniosKey])

  function loadMore() {
    const params = buildParams(classificacao, { q, convenios }, state.rows.length)
    setState((s) => ({ ...s, loading: true }))
    fetch(`/api/pacientes?${params}`)
      .then((r) => r.json())
      .then((data) => {
        setState((prev) => ({
          rows: [...prev.rows, ...(data.rows ?? [])],
          count: data.count ?? prev.count,
          loading: false,
          error: false,
        }))
      })
      .catch(() => setState((prev) => ({ ...prev, loading: false })))
  }

  return { ...state, loadMore }
}

export function PacienteFunilCard({
  paciente,
  onClick,
}: {
  paciente: Paciente
  onClick?: () => void
}) {
  const meta = classificacaoMeta(paciente.classificacao_cliente ?? '')
  const dados = useFunilDados()

  // Leads conciliados a este paciente (nas colunas de classificação normalmente
  // não há nenhum — o card só aparece lá quando o paciente não está no funil).
  const leads = dados.leadsDoPaciente(paciente.id)
  const agendamento = dados.proximoDoPaciente(paciente.id)

  return (
    <CardBase
      onClick={onClick}
      className="cursor-pointer"
      accent={meta.colorVar}
      badges={[{ label: 'Paciente' }, { label: meta.label, className: meta.badgeClass }]}
      nome={paciente.nome_cliente}
      documento={paciente.cpf ? formatarCpf(paciente.cpf) : null}
      convenio={paciente.convenio_raw}
      contatos={Array.from(
        new Set(leads.map((l) => l.contact_name).filter((n): n is string => !!n))
      )}
      agente={dados.nomeAgente(paciente.responsavel_id)}
      contadores={{
        internacoes: internacoesConhecidas(paciente).length,
        perdas: leads.filter((l) => l.etapa === 'perdido' || !!l.motivo_perda).length,
        conversas: leads.filter((l) => !!l.conversation_id).length,
      }}
      proximo={{
        data: agendamento?.data ?? null,
        nota: agendamento?.nota ?? null,
        situacao: situacaoAgendamento(agendamento),
      }}
    />
  )
}

function LoadMoreButton({
  state,
  onLoadMore,
}: {
  state: PacientesState
  onLoadMore: () => void
}) {
  if (state.loading) {
    return (
      <div className="flex justify-center py-3 text-content-tertiary">
        <Loader2 size={14} className="animate-spin" />
      </div>
    )
  }
  if (state.error) {
    return (
      <p className="py-2 text-center text-caption text-danger-500">Erro ao carregar pacientes</p>
    )
  }
  if (state.rows.length >= state.count) return null
  return (
    <button
      onClick={onLoadMore}
      className="focus-ring w-full py-2 text-caption text-content-secondary hover:text-content-primary rounded-lg hover:bg-surface-tertiary transition-colors"
    >
      Carregar mais ({(state.count - state.rows.length).toLocaleString('pt-BR')})
    </button>
  )
}

/** Coluna de classificação (pós-Internado): visual diferenciado, sem drag. */
export function PacienteColumn({
  meta,
  excludeIds,
  query,
  onCardClick,
}: {
  meta: ClassificacaoMeta
  excludeIds: Set<string>
  query: PacienteQuery
  onCardClick?: (p: Paciente) => void
}) {
  const state = usePacientesClassificacao(meta.value, query)
  const visiveis = state.rows.filter((p) => !excludeIds.has(p.id))

  return (
    <div
      className="flex flex-col shrink-0 w-[300px] h-full min-h-0 rounded-xl border border-dashed border-border-strong bg-surface-secondary/40"
      style={{ borderTop: `2px solid ${meta.colorVar}` }}
    >
      <div className="flex items-center gap-2 px-2.5 py-2.5 mb-1 shrink-0">
        <span
          className="w-1.5 h-1.5 rounded-full shrink-0"
          style={{ backgroundColor: meta.colorVar }}
        />
        <h3 className="text-overline uppercase text-content-secondary truncate">{meta.label}</h3>
        <span className="ml-auto inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-surface-tertiary text-caption font-mono text-content-secondary tabular-nums">
          {state.count.toLocaleString('pt-BR')}
        </span>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto space-y-2 px-1.5 pb-2">
        {visiveis.map((p) => (
          <PacienteFunilCard key={p.id} paciente={p} onClick={() => onCardClick?.(p)} />
        ))}
        {!state.loading && !state.error && visiveis.length === 0 && (
          <p className="py-4 text-center text-caption text-content-tertiary">Nenhum paciente</p>
        )}
        <LoadMoreButton state={state} onLoadMore={state.loadMore} />
      </div>
    </div>
  )
}

/** Pacientes "Atualmente internado" exibidos dentro da coluna Internado. */
export function PacientesInternadosSection({
  classificacao,
  excludeIds,
  query,
  onCardClick,
}: {
  classificacao: string
  excludeIds: Set<string>
  query: PacienteQuery
  onCardClick?: (p: Paciente) => void
}) {
  const state = usePacientesClassificacao(classificacao, query)
  const visiveis = state.rows.filter((p) => !excludeIds.has(p.id))

  return (
    <div className="mt-3 pt-3 border-t border-dashed border-border-strong space-y-2">
      <div className="flex items-center gap-1.5 px-1.5">
        <span
          className="w-1.5 h-1.5 rounded-full shrink-0"
          style={{ backgroundColor: 'var(--stage-confirmado)' }}
        />
        <span className="text-overline uppercase text-content-tertiary">
          Atualmente internados
        </span>
        <span className="ml-auto text-caption font-mono text-content-tertiary tabular-nums">
          {state.count.toLocaleString('pt-BR')}
        </span>
      </div>
      {visiveis.map((p) => (
        <PacienteFunilCard key={p.id} paciente={p} onClick={() => onCardClick?.(p)} />
      ))}
      <LoadMoreButton state={state} onLoadMore={state.loadMore} />
    </div>
  )
}
