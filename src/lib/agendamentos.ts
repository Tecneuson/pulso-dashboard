import type { Agendamento } from '@/types'

/**
 * Próximo contato: o agendamento PENDENTE mais próximo de um lead/paciente.
 * A "situação" derivada alimenta o card do funil (badge Atrasado) e o filtro
 * "Agendados" do header.
 */

export const SITUACAO_AGENDAMENTO = ['indefinido', 'em_conformidade', 'atrasado'] as const
export type SituacaoAgendamento = (typeof SITUACAO_AGENDAMENTO)[number]

export const SITUACAO_LABELS: Record<SituacaoAgendamento, string> = {
  indefinido: 'Indefinido',
  em_conformidade: 'Em conformidade',
  atrasado: 'Atrasado',
}

/** Classe do badge por situação (sem ícone — só tinta). */
export const SITUACAO_BADGE: Record<SituacaoAgendamento, string> = {
  indefinido: 'bg-surface-tertiary text-content-secondary border border-border',
  em_conformidade:
    'bg-success-500/12 text-success-700 dark:text-success-500 border border-success-500/25',
  atrasado: 'bg-danger-500/12 text-danger-700 dark:text-danger-500 border border-danger-500/25',
}

export const AGENDADOS_FILTRO_OPTS = [
  { value: '', label: 'Todos' },
  { value: 'indefinido', label: 'Indefinido' },
  { value: 'em_conformidade', label: 'Em conformidade' },
  { value: 'atrasado', label: 'Atrasado' },
]

/** Data de hoje (fuso do navegador/servidor) em YYYY-MM-DD. */
export function hojeISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`
}

/** Situação do próximo contato: sem agendamento = indefinido; data passada = atrasado. */
export function situacaoAgendamento(
  ag: Agendamento | null | undefined,
  hoje = hojeISO()
): SituacaoAgendamento {
  if (!ag || ag.status !== 'pendente') return 'indefinido'
  return ag.data < hoje ? 'atrasado' : 'em_conformidade'
}

/** Chave usada nos mapas de agendamento pendente do board. */
export function chaveAlvo(alvo: { triagem_id?: string | null; paciente_id?: string | null }): string {
  return alvo.triagem_id ? `t:${alvo.triagem_id}` : `p:${alvo.paciente_id}`
}

/** Formata YYYY-MM-DD em DD/MM/AAAA (sem passar por Date, evita fuso). */
export function formatDataBR(iso: string | null | undefined): string {
  if (!iso) return '—'
  const [y, m, d] = iso.slice(0, 10).split('-')
  return y && m && d ? `${d}/${m}/${y}` : '—'
}

/** HH:MM a partir de HH:MM:SS. */
export function formatHora(hora: string | null | undefined): string | null {
  return hora ? hora.slice(0, 5) : null
}

/** Ordena por data e hora crescentes (nulos de hora primeiro — "dia inteiro"). */
export function ordenarPorDataHora(a: Agendamento, b: Agendamento): number {
  if (a.data !== b.data) return a.data.localeCompare(b.data)
  return (a.hora ?? '').localeCompare(b.hora ?? '')
}
