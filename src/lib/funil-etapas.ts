import type { EstagioFunil, TriagemLead } from '@/types'

/**
 * Funil de exibição (novo). É uma camada PURAMENTE VISUAL sobre o `estagio_funil`
 * que já existe no banco — nada aqui altera schema, Chatwoot ou n8n. As mudanças de
 * etapa feitas na tela são persistidas no navegador (localStorage), ver `local-store`.
 *
 * Etapas: Contato → Atendendo → Negociando → Rastreio → Internação, + Perdido.
 * (o slug interno da etapa "Rastreio" continua sendo `elegivel`, por compatibilidade
 * com os dados já gravados em `estagio_funil`.)
 */

export const FUNIL_ETAPAS = [
  'contato',
  'atendendo',
  'negociando',
  'elegivel',
  'internacao',
  'perdido',
] as const
export type FunilEtapa = (typeof FUNIL_ETAPAS)[number]

export const FUNIL_ETAPA_LABELS: Record<FunilEtapa, string> = {
  contato: 'Contato',
  atendendo: 'Atendendo',
  negociando: 'Negociando',
  elegivel: 'Rastreio',
  internacao: 'Internação',
  perdido: 'Perdido',
}

/** Cor (CSS var) da etapa — reaproveita as vars `--stage-*` já definidas no tema. */
export const FUNIL_ETAPA_VAR: Record<FunilEtapa, string> = {
  contato: 'var(--stage-novo)',
  atendendo: 'var(--stage-atendendo)',
  negociando: 'var(--stage-consultando)',
  elegivel: 'var(--stage-autorizado)',
  internacao: 'var(--stage-confirmado)',
  perdido: 'var(--stage-recusou)',
}

export type EtapaBadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'brand'

export const FUNIL_ETAPA_VARIANT: Record<FunilEtapa, EtapaBadgeVariant> = {
  contato: 'default',
  atendendo: 'info',
  negociando: 'warning',
  elegivel: 'brand',
  internacao: 'success',
  perdido: 'danger',
}

/**
 * Leitura: traduz o `estagio_funil` (10 valores de storage) para uma das 6 etapas de
 * exibição. `null`/desconhecido → Contato (lead recém-chegado / sem atendimento).
 */
const ESTAGIO_TO_ETAPA: Record<EstagioFunil, FunilEtapa> = {
  em_atendimento: 'atendendo',
  convenio_nao_legivel: 'negociando',
  convenio_legivel: 'negociando',
  em_avaliacao_hsm: 'negociando',
  vaga_cedida: 'elegivel',
  vaga_recusada_medico: 'perdido',
  recusou_origem: 'perdido',
  recusou_internacao: 'perdido',
  sem_condicoes_financeiras: 'perdido',
  internado: 'internacao',
}

export function etapaFromEstagio(estagio: EstagioFunil | null | undefined): FunilEtapa {
  return estagio ? ESTAGIO_TO_ETAPA[estagio] ?? 'contato' : 'contato'
}

/**
 * Escrita: valor canônico de `estagio_funil` gravado quando o card entra numa etapa.
 * Mantém compatibilidade com o vocabulário do banco/Chatwoot (10 valores). `contato`
 * grava null. Só grave quando a etapa realmente mudou (para não perder a nuance dos
 * estágios granulares que também mapeiam para a mesma etapa).
 */
export const ETAPA_TO_ESTAGIO: Record<FunilEtapa, EstagioFunil | null> = {
  contato: null,
  atendendo: 'em_atendimento',
  negociando: 'convenio_legivel',
  elegivel: 'vaga_cedida',
  internacao: 'internado',
  perdido: 'recusou_internacao',
}

/** Lead efetivo com a etapa de exibição resolvida a partir de `estagio_funil`. */
export type LeadComEtapa = TriagemLead & { etapa: FunilEtapa }

/** Anexa a etapa de exibição a um lead. */
export function comEtapa(lead: TriagemLead): LeadComEtapa {
  return { ...lead, etapa: etapaFromEstagio(lead.estagio_funil) }
}

export const FUNIL_ETAPA_OPTIONS = FUNIL_ETAPAS.map((value) => ({
  value,
  label: FUNIL_ETAPA_LABELS[value],
}))

export function isFunilEtapa(value: string): value is FunilEtapa {
  return (FUNIL_ETAPAS as readonly string[]).includes(value)
}

// ============================================================
// Origem da Conversa (dimensão nova — só visual, persistida no navegador)
// ============================================================

export const ORIGEM_CONVERSA = [
  'interhospitalar',
  'consultor',
  'profissional_saude',
  'residencia',
] as const
export type OrigemConversa = (typeof ORIGEM_CONVERSA)[number]

export const ORIGEM_CONVERSA_LABELS: Record<OrigemConversa, string> = {
  interhospitalar: 'Interhospitalar',
  consultor: 'Consultor',
  profissional_saude: 'Profissional de Saúde',
  residencia: 'Residência',
}

export const ORIGEM_CONVERSA_OPTIONS = ORIGEM_CONVERSA.map((value) => ({
  value,
  label: ORIGEM_CONVERSA_LABELS[value],
}))

export const ORIGEM_PROFISSIONAL = ['medico', 'psicologo', 'outros'] as const
export type OrigemProfissional = (typeof ORIGEM_PROFISSIONAL)[number]

export const ORIGEM_PROFISSIONAL_LABELS: Record<OrigemProfissional, string> = {
  medico: 'Médico',
  psicologo: 'Psicólogo',
  outros: 'Outros',
}

export const ORIGEM_PROFISSIONAL_OPTIONS = ORIGEM_PROFISSIONAL.map((value) => ({
  value,
  label: ORIGEM_PROFISSIONAL_LABELS[value],
}))
