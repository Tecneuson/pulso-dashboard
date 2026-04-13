// ============================================================
// Enums — espelham os enums do PostgreSQL
// ============================================================

export const CONTACT_TYPES = [
  'lead',
  'ex_paciente',
  'responsavel',
  'medico',
  'parceiro',
] as const
export type ContactType = (typeof CONTACT_TYPES)[number]

export const SOLICITATION_TARGETS = [
  'voce_mesmo',
  'familiar',
  'amigo',
] as const
export type SolicitationTarget = (typeof SOLICITATION_TARGETS)[number]

export const CONTACT_REASONS = [
  'transtorno_mental_adulto',
  'transtorno_mental_infantojuvenil',
  'abuso_de_substancias',
] as const
export type ContactReason = (typeof CONTACT_REASONS)[number]

export const FUNNEL_STAGES = [
  'novo_contato',
  'atendendo',
  'consultando_convenio',
  'autorizado_pelo_convenio',
  'paciente_a_caminho',
  'hospital_recepcao',
  'recusou_internacao',
  'internacao_confirmada',
] as const
export type FunnelStage = (typeof FUNNEL_STAGES)[number]

export const FUNNEL_STAGE_LABELS: Record<FunnelStage, string> = {
  novo_contato: 'Novo contato',
  atendendo: 'Atendendo',
  consultando_convenio: 'Consultando convênio',
  autorizado_pelo_convenio: 'Autorizado pelo convênio',
  paciente_a_caminho: 'Paciente a caminho',
  hospital_recepcao: 'Hospital recepção',
  recusou_internacao: 'Recusou internação',
  internacao_confirmada: 'Internação confirmada',
}

export const TERMINAL_STAGES: FunnelStage[] = [
  'recusou_internacao',
  'internacao_confirmada',
]

export const CONVERSATION_SUBJECTS = [
  'internacao',
  'consulta',
  'informacao_de_paciente',
  'administrativo',
  'recursos_humanos',
  'outro',
] as const
export type ConversationSubject = (typeof CONVERSATION_SUBJECTS)[number]

export const LOSS_REASONS = [
  'parou_de_interagir',
  'desistiu_do_tratamento',
  'financeiro',
  'plano_nao_autorizou',
  'plano_sem_convenio',
  'nao_tem_plano',
  'nao_gostou_do_hospital',
  'sus',
  'outro',
] as const
export type LossReason = (typeof LOSS_REASONS)[number]

export const ORIGIN_TYPES = [
  'transferencia_hospitalar',
  'indicacao_medica',
  'ex_paciente',
  'parceiro',
  'outro',
] as const
export type OriginType = (typeof ORIGIN_TYPES)[number]

export const USER_ROLES = ['admin', 'manager', 'agent', 'viewer'] as const
export type UserRole = (typeof USER_ROLES)[number]

// ============================================================
// Database row types
// ============================================================

export interface HealthPlan {
  id: string
  name: string
  slug: string
  active: boolean
  created_at: string
}

export interface Contact {
  id: string
  created_at: string
  updated_at: string
  name: string
  phone: string | null
  whatsapp: string | null
  email: string | null
  contact_type: ContactType
  solicitation_target: SolicitationTarget | null
  contact_reason: ContactReason | null
  health_plan_id: string | null
  funnel_stage: FunnelStage
  funnel_stage_changed_at: string
  utm_source: string | null
  utm_medium: string | null
  utm_campaign: string | null
  utm_term: string | null
  utm_content: string | null
  origin: OriginType | null
  origin_details: string | null
  chatwoot_contact_id: number | null
  notes: string | null
}

export interface ContactWithPlan extends Contact {
  health_plan: HealthPlan | null
}

export interface Conversation {
  id: string
  created_at: string
  updated_at: string
  contact_id: string
  subject: ConversationSubject
  is_sale: boolean | null
  loss_reason: LossReason | null
  utm_source: string | null
  utm_medium: string | null
  utm_campaign: string | null
  utm_term: string | null
  utm_content: string | null
  origin: OriginType | null
  origin_details: string | null
  tags: string[]
  chatwoot_conversation_id: number | null
  chatwoot_status: string | null
  chatwoot_assignee: string | null
  chatwoot_inbox: string | null
  first_reply_at: string | null
  resolved_at: string | null
}

export interface FunnelHistory {
  id: string
  created_at: string
  contact_id: string
  from_stage: FunnelStage | null
  to_stage: FunnelStage
  changed_by: string | null
  notes: string | null
}

export interface DashboardUser {
  id: string
  created_at: string
  updated_at: string
  name: string
  email: string
  role: UserRole
  avatar_url: string | null
  active: boolean
}

export interface WebhookLog {
  id: string
  created_at: string
  event_type: string
  payload: Record<string, unknown>
  processed: boolean
  error: string | null
}
