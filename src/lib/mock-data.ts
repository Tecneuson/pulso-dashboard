import type { ContactWithPlan, FunnelStage } from '@/types'

// ============================================================
// KPI data
// ============================================================

export const kpiData = {
  totalContacts: { today: 12, week: 67, month: 284 },
  conversionRate: 34.2,
  conversionRateDelta: 2.8,
  avgFunnelTime: '4h 32m',
  avgFunnelTimeDelta: -12,
  waitingContacts: 23,
  topLossReason: 'Parou de interagir',
}

// ============================================================
// Chart data — Volume de contatos (30 dias)
// ============================================================

export const dailyVolumeData = Array.from({ length: 30 }, (_, i) => {
  const date = new Date()
  date.setDate(date.getDate() - (29 - i))
  return {
    date: date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
    contatos: Math.floor(Math.random() * 15) + 5,
    internacoes: Math.floor(Math.random() * 6) + 1,
  }
})

// ============================================================
// Chart data — Distribuição por motivo
// ============================================================

export const reasonDistribution = [
  { name: 'Transtorno mental adulto', value: 142, color: '#2EA866' },
  { name: 'Abuso de substâncias', value: 89, color: '#2E90FA' },
  { name: 'Transtorno infantojuvenil', value: 53, color: '#F79009' },
]

// ============================================================
// Chart data — Conversão por convênio (top 10)
// ============================================================

export const healthPlanConversion = [
  { plan: 'Bradesco Saúde', total: 42, converted: 18 },
  { plan: 'SulAmérica', total: 38, converted: 14 },
  { plan: 'Amil', total: 35, converted: 12 },
  { plan: 'Notredame', total: 28, converted: 11 },
  { plan: 'Porto Saúde', total: 24, converted: 8 },
  { plan: 'Care Plus', total: 20, converted: 9 },
  { plan: 'Prevent Senior', total: 18, converted: 5 },
  { plan: 'Omint Saúde', total: 15, converted: 7 },
  { plan: 'Saúde Caixa', total: 12, converted: 4 },
  { plan: 'MediService', total: 10, converted: 3 },
]

// ============================================================
// Chart data — Motivos de perda
// ============================================================

export const lossReasons = [
  { reason: 'Parou de interagir', count: 45 },
  { reason: 'Financeiro', count: 32 },
  { reason: 'Plano não autorizou', count: 28 },
  { reason: 'Desistiu do tratamento', count: 22 },
  { reason: 'Não tem plano', count: 18 },
  { reason: 'Não gostou do hospital', count: 12 },
  { reason: 'SUS', count: 8 },
  { reason: 'Outro', count: 15 },
]

// ============================================================
// Kanban mock contacts
// ============================================================

function hoursAgo(h: number): string {
  return new Date(Date.now() - h * 3600000).toISOString()
}

export const kanbanContacts: ContactWithPlan[] = [
  {
    id: '1', created_at: hoursAgo(48), updated_at: hoursAgo(1), name: 'Maria Silva',
    phone: '(11) 99999-0001', whatsapp: '(11) 99999-0001', email: 'maria@email.com',
    contact_type: 'lead', solicitation_target: 'familiar', contact_reason: 'transtorno_mental_adulto',
    health_plan_id: '1', funnel_stage: 'novo_contato', funnel_stage_changed_at: hoursAgo(1),
    utm_source: 'google', utm_medium: 'cpc', utm_campaign: null, utm_term: null, utm_content: null,
    origin: null, origin_details: null, chatwoot_contact_id: 1001, notes: null,
    health_plan: { id: '1', name: 'Bradesco Saúde', slug: 'bradesco_saude', active: true, created_at: '' },
  },
  {
    id: '2', created_at: hoursAgo(24), updated_at: hoursAgo(3), name: 'João Santos',
    phone: '(11) 99999-0002', whatsapp: '(11) 99999-0002', email: null,
    contact_type: 'responsavel', solicitation_target: 'familiar', contact_reason: 'abuso_de_substancias',
    health_plan_id: '2', funnel_stage: 'novo_contato', funnel_stage_changed_at: hoursAgo(3),
    utm_source: null, utm_medium: null, utm_campaign: null, utm_term: null, utm_content: null,
    origin: 'indicacao_medica', origin_details: null, chatwoot_contact_id: 1002, notes: null,
    health_plan: { id: '2', name: 'SulAmérica', slug: 'sulamerica', active: true, created_at: '' },
  },
  {
    id: '3', created_at: hoursAgo(12), updated_at: hoursAgo(0.5), name: 'Ana Oliveira',
    phone: '(11) 99999-0003', whatsapp: '(11) 99999-0003', email: 'ana@email.com',
    contact_type: 'lead', solicitation_target: 'voce_mesmo', contact_reason: 'transtorno_mental_adulto',
    health_plan_id: '3', funnel_stage: 'atendendo', funnel_stage_changed_at: hoursAgo(0.5),
    utm_source: 'instagram', utm_medium: 'social', utm_campaign: null, utm_term: null, utm_content: null,
    origin: null, origin_details: null, chatwoot_contact_id: 1003, notes: null,
    health_plan: { id: '3', name: 'Amil', slug: 'amil', active: true, created_at: '' },
  },
  {
    id: '4', created_at: hoursAgo(36), updated_at: hoursAgo(4), name: 'Carlos Mendes',
    phone: '(11) 99999-0004', whatsapp: null, email: 'carlos@email.com',
    contact_type: 'medico', solicitation_target: null, contact_reason: 'transtorno_mental_infantojuvenil',
    health_plan_id: '4', funnel_stage: 'atendendo', funnel_stage_changed_at: hoursAgo(4),
    utm_source: null, utm_medium: null, utm_campaign: null, utm_term: null, utm_content: null,
    origin: 'indicacao_medica', origin_details: 'Dr. Fernando', chatwoot_contact_id: 1004, notes: null,
    health_plan: { id: '4', name: 'Care Plus', slug: 'care_plus', active: true, created_at: '' },
  },
  {
    id: '5', created_at: hoursAgo(72), updated_at: hoursAgo(8), name: 'Fernanda Lima',
    phone: '(11) 99999-0005', whatsapp: '(11) 99999-0005', email: null,
    contact_type: 'responsavel', solicitation_target: 'familiar', contact_reason: 'abuso_de_substancias',
    health_plan_id: '1', funnel_stage: 'consultando_convenio', funnel_stage_changed_at: hoursAgo(8),
    utm_source: 'google', utm_medium: 'organic', utm_campaign: null, utm_term: null, utm_content: null,
    origin: null, origin_details: null, chatwoot_contact_id: 1005, notes: 'Urgente — paciente em crise',
    health_plan: { id: '1', name: 'Bradesco Saúde', slug: 'bradesco_saude', active: true, created_at: '' },
  },
  {
    id: '6', created_at: hoursAgo(24), updated_at: hoursAgo(2), name: 'Roberto Alves',
    phone: '(11) 99999-0006', whatsapp: '(11) 99999-0006', email: 'roberto@email.com',
    contact_type: 'lead', solicitation_target: 'voce_mesmo', contact_reason: 'transtorno_mental_adulto',
    health_plan_id: '5', funnel_stage: 'autorizado_pelo_convenio', funnel_stage_changed_at: hoursAgo(2),
    utm_source: null, utm_medium: null, utm_campaign: null, utm_term: null, utm_content: null,
    origin: 'ex_paciente', origin_details: null, chatwoot_contact_id: 1006, notes: null,
    health_plan: { id: '5', name: 'Porto Saúde', slug: 'porto_saude', active: true, created_at: '' },
  },
  {
    id: '7', created_at: hoursAgo(6), updated_at: hoursAgo(1), name: 'Luciana Costa',
    phone: '(11) 99999-0007', whatsapp: '(11) 99999-0007', email: null,
    contact_type: 'lead', solicitation_target: 'amigo', contact_reason: 'transtorno_mental_adulto',
    health_plan_id: '2', funnel_stage: 'paciente_a_caminho', funnel_stage_changed_at: hoursAgo(1),
    utm_source: null, utm_medium: null, utm_campaign: null, utm_term: null, utm_content: null,
    origin: null, origin_details: null, chatwoot_contact_id: 1007, notes: null,
    health_plan: { id: '2', name: 'SulAmérica', slug: 'sulamerica', active: true, created_at: '' },
  },
  {
    id: '8', created_at: hoursAgo(96), updated_at: hoursAgo(12), name: 'Pedro Henrique',
    phone: '(11) 99999-0008', whatsapp: '(11) 99999-0008', email: 'pedro@email.com',
    contact_type: 'responsavel', solicitation_target: 'familiar', contact_reason: 'abuso_de_substancias',
    health_plan_id: '3', funnel_stage: 'hospital_recepcao', funnel_stage_changed_at: hoursAgo(0.3),
    utm_source: 'google', utm_medium: 'cpc', utm_campaign: 'internacao', utm_term: null, utm_content: null,
    origin: null, origin_details: null, chatwoot_contact_id: 1008, notes: null,
    health_plan: { id: '3', name: 'Amil', slug: 'amil', active: true, created_at: '' },
  },
  {
    id: '9', created_at: hoursAgo(120), updated_at: hoursAgo(24), name: 'Beatriz Souza',
    phone: '(11) 99999-0009', whatsapp: null, email: 'beatriz@email.com',
    contact_type: 'lead', solicitation_target: 'voce_mesmo', contact_reason: 'transtorno_mental_adulto',
    health_plan_id: '4', funnel_stage: 'internacao_confirmada', funnel_stage_changed_at: hoursAgo(24),
    utm_source: null, utm_medium: null, utm_campaign: null, utm_term: null, utm_content: null,
    origin: 'transferencia_hospitalar', origin_details: 'Hospital Albert Einstein', chatwoot_contact_id: 1009, notes: null,
    health_plan: { id: '4', name: 'Care Plus', slug: 'care_plus', active: true, created_at: '' },
  },
  {
    id: '10', created_at: hoursAgo(48), updated_at: hoursAgo(6), name: 'Ricardo Ferreira',
    phone: '(11) 99999-0010', whatsapp: '(11) 99999-0010', email: null,
    contact_type: 'responsavel', solicitation_target: 'familiar', contact_reason: 'transtorno_mental_infantojuvenil',
    health_plan_id: null, funnel_stage: 'recusou_internacao', funnel_stage_changed_at: hoursAgo(6),
    utm_source: null, utm_medium: null, utm_campaign: null, utm_term: null, utm_content: null,
    origin: null, origin_details: null, chatwoot_contact_id: 1010, notes: 'Sem convênio, optou por tratamento ambulatorial',
    health_plan: null,
  },
]

// Helper: group contacts by funnel stage
export function groupByStage(contacts: ContactWithPlan[]): Record<FunnelStage, ContactWithPlan[]> {
  const stages: FunnelStage[] = [
    'novo_contato', 'atendendo', 'consultando_convenio', 'autorizado_pelo_convenio',
    'paciente_a_caminho', 'hospital_recepcao', 'recusou_internacao', 'internacao_confirmada',
  ]
  const grouped: Record<FunnelStage, ContactWithPlan[]> = {
    novo_contato: [], atendendo: [], consultando_convenio: [], autorizado_pelo_convenio: [],
    paciente_a_caminho: [], hospital_recepcao: [], recusou_internacao: [], internacao_confirmada: [],
  }
  for (const c of contacts) {
    grouped[c.funnel_stage].push(c)
  }
  return grouped
}
