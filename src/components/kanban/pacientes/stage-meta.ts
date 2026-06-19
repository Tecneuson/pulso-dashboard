import type { EstagioReativacao } from '@/types'

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'brand'

export const REATIVACAO_VARIANT: Record<EstagioReativacao, BadgeVariant> = {
  nao_contatado: 'default',
  tentativa_contato: 'warning',
  em_conversa: 'info',
  interesse: 'brand',
  reativado: 'success',
  sem_interesse: 'danger',
  nao_localizado: 'default',
}

// Cor (CSS var) usada no dot/barra do board
export const REATIVACAO_COLOR: Record<EstagioReativacao, string> = {
  nao_contatado: 'var(--stage-novo)',
  tentativa_contato: 'var(--stage-consultando)',
  em_conversa: 'var(--stage-atendendo)',
  interesse: 'var(--stage-autorizado)',
  reativado: 'var(--stage-confirmado)',
  sem_interesse: 'var(--stage-recusou)',
  nao_localizado: 'var(--stage-novo)',
}

export function formatDateBR(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso + (iso.length === 10 ? 'T00:00:00' : ''))
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('pt-BR')
}
