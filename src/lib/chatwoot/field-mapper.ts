import type { ContactType, SolicitationTarget, ContactReason, ConversationSubject, LossReason, OriginType } from '@/types'

/**
 * Maps Chatwoot custom_attributes to our database schema fields.
 * Keys match the custom attribute names configured in Chatwoot.
 */

const CONTACT_TYPE_MAP: Record<string, ContactType> = {
  lead: 'lead',
  ex_paciente: 'ex_paciente',
  'ex-paciente': 'ex_paciente',
  responsavel: 'responsavel',
  responsável: 'responsavel',
  medico: 'medico',
  médico: 'medico',
  parceiro: 'parceiro',
}

const SOLICITATION_TARGET_MAP: Record<string, SolicitationTarget> = {
  voce_mesmo: 'voce_mesmo',
  'você mesmo': 'voce_mesmo',
  familiar: 'familiar',
  amigo: 'amigo',
}

const CONTACT_REASON_MAP: Record<string, ContactReason> = {
  transtorno_mental_adulto: 'transtorno_mental_adulto',
  'transtorno mental adulto': 'transtorno_mental_adulto',
  transtorno_mental_infantojuvenil: 'transtorno_mental_infantojuvenil',
  'transtorno mental infantojuvenil': 'transtorno_mental_infantojuvenil',
  abuso_de_substancias: 'abuso_de_substancias',
  'abuso de substâncias': 'abuso_de_substancias',
}

const CONVERSATION_SUBJECT_MAP: Record<string, ConversationSubject> = {
  internacao: 'internacao',
  internação: 'internacao',
  consulta: 'consulta',
  informacao_de_paciente: 'informacao_de_paciente',
  administrativo: 'administrativo',
  recursos_humanos: 'recursos_humanos',
  outro: 'outro',
}

const LOSS_REASON_MAP: Record<string, LossReason> = {
  parou_de_interagir: 'parou_de_interagir',
  desistiu_do_tratamento: 'desistiu_do_tratamento',
  financeiro: 'financeiro',
  plano_nao_autorizou: 'plano_nao_autorizou',
  plano_sem_convenio: 'plano_sem_convenio',
  nao_tem_plano: 'nao_tem_plano',
  nao_gostou_do_hospital: 'nao_gostou_do_hospital',
  sus: 'sus',
  outro: 'outro',
}

const ORIGIN_MAP: Record<string, OriginType> = {
  transferencia_hospitalar: 'transferencia_hospitalar',
  indicacao_medica: 'indicacao_medica',
  ex_paciente: 'ex_paciente',
  parceiro: 'parceiro',
  outro: 'outro',
}

function safeLookup<T>(map: Record<string, T>, value: unknown): T | undefined {
  if (typeof value !== 'string') return undefined
  return map[value.toLowerCase().trim()]
}

export function mapContactAttributes(attrs: Record<string, unknown>) {
  return {
    contact_type: safeLookup(CONTACT_TYPE_MAP, attrs.tipo_contato ?? attrs.contact_type),
    solicitation_target: safeLookup(SOLICITATION_TARGET_MAP, attrs.para_quem ?? attrs.solicitation_target),
    contact_reason: safeLookup(CONTACT_REASON_MAP, attrs.motivo ?? attrs.contact_reason),
    origin: safeLookup(ORIGIN_MAP, attrs.origem ?? attrs.origin),
    origin_details: typeof attrs.origem_detalhe === 'string' ? attrs.origem_detalhe : undefined,
    utm_source: typeof attrs.utm_source === 'string' ? attrs.utm_source : undefined,
    utm_medium: typeof attrs.utm_medium === 'string' ? attrs.utm_medium : undefined,
    utm_campaign: typeof attrs.utm_campaign === 'string' ? attrs.utm_campaign : undefined,
    utm_term: typeof attrs.utm_term === 'string' ? attrs.utm_term : undefined,
    utm_content: typeof attrs.utm_content === 'string' ? attrs.utm_content : undefined,
  }
}

export function mapConversationAttributes(attrs: Record<string, unknown>) {
  return {
    subject: safeLookup(CONVERSATION_SUBJECT_MAP, attrs.assunto ?? attrs.subject),
    is_sale: attrs.is_sale === true || attrs.is_sale === 'true' ? true : attrs.is_sale === false || attrs.is_sale === 'false' ? false : undefined,
    loss_reason: safeLookup(LOSS_REASON_MAP, attrs.motivo_perda ?? attrs.loss_reason),
    origin: safeLookup(ORIGIN_MAP, attrs.origem ?? attrs.origin),
    origin_details: typeof attrs.origem_detalhe === 'string' ? attrs.origem_detalhe : undefined,
    utm_source: typeof attrs.utm_source === 'string' ? attrs.utm_source : undefined,
    utm_medium: typeof attrs.utm_medium === 'string' ? attrs.utm_medium : undefined,
    utm_campaign: typeof attrs.utm_campaign === 'string' ? attrs.utm_campaign : undefined,
    utm_term: typeof attrs.utm_term === 'string' ? attrs.utm_term : undefined,
    utm_content: typeof attrs.utm_content === 'string' ? attrs.utm_content : undefined,
  }
}
