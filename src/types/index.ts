// ============================================================
// Enums — espelham os enums do banco
// ============================================================

export const TIPO_CONTATO = [
  'lead',
  'ex_paciente',
  'responsavel',
  'responsavel_lead',
  'responsavel_ex_paciente',
  'parceiro',
] as const
export type TipoContato = (typeof TIPO_CONTATO)[number]

export const PARA_QUEM = ['voce_mesmo', 'familiar', 'amigo'] as const
export type ParaQuem = (typeof PARA_QUEM)[number]

export const ASSUNTO = [
  'internacao',
  'consulta',
  'informacao_paciente',
  'administrativo',
  'outros',
] as const
export type Assunto = (typeof ASSUNTO)[number]

export const FORMA_INTERNACAO = ['plano', 'particular', 'nao_sabe'] as const
export type FormaInternacao = (typeof FORMA_INTERNACAO)[number]

export const PLANO_SAUDE = [
  'amil',
  'bradesco_saude',
  'omint',
  'prevent_senior',
  'sulamerica',
] as const
export type PlanoSaude = (typeof PLANO_SAUDE)[number]

export const MOTIVO_CONTATO = [
  'transtorno_mental_adulto',
  'transtorno_mental_infantojuvenil',
  'abuso_de_substancias',
] as const
export type MotivoContato = (typeof MOTIVO_CONTATO)[number]

export const ESTAGIO_FUNIL = [
  'novo_contato',
  'atendendo',
  'consultando_convenio',
  'autorizado_pelo_convenio',
  'paciente_a_caminho',
  'hospital_recepcao',
  'recusou_internacao',
  'internacao_confirmada',
] as const
export type EstagioFunil = (typeof ESTAGIO_FUNIL)[number]

export const ESTAGIO_FUNIL_LABELS: Record<EstagioFunil, string> = {
  novo_contato: 'Novo contato',
  atendendo: 'Atendendo',
  consultando_convenio: 'Consultando convênio',
  autorizado_pelo_convenio: 'Autorizado pelo convênio',
  paciente_a_caminho: 'Paciente a caminho',
  hospital_recepcao: 'Hospital recepção',
  recusou_internacao: 'Recusou internação',
  internacao_confirmada: 'Internação confirmada',
}

export const TERMINAL_STAGES: EstagioFunil[] = [
  'recusou_internacao',
  'internacao_confirmada',
]

export const STATUS_TRIAGEM = [
  'qualificado',
  'desqualificado',
  'em_atendimento',
  'finalizado',
] as const
export type StatusTriagem = (typeof STATUS_TRIAGEM)[number]

export const MOTIVO_PERDA = [
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
export type MotivoPerda = (typeof MOTIVO_PERDA)[number]

// Aliases para compatibilidade
export type FunnelStage = EstagioFunil
export const FUNNEL_STAGES = ESTAGIO_FUNIL
export const FUNNEL_STAGE_LABELS = ESTAGIO_FUNIL_LABELS

// ============================================================
// Row types — baseados na tabela triagem_hsm
// ============================================================

export interface Triagem {
  id: string
  conversation_id: string | null
  message_id: string | null
  contact_name: string | null
  email: string | null
  phone: string | null
  assunto: Assunto | null
  para_quem: ParaQuem | null
  tipo_contato: TipoContato | null
  ex_paciente: boolean | null
  forma_internacao: FormaInternacao | null
  plano_saude: PlanoSaude | null
  carteirinha_enviada: boolean | null
  carteirinha_url: string | null
  etapa_atual: number | null
  triagem_concluida: boolean | null
  transbordado: boolean | null
  motivo_contato: MotivoContato | null
  estagio_funil: EstagioFunil | null
  status: StatusTriagem | null
  atendente_id: string | null
  motivo_desqualificacao: string | null
  motivo_perda: MotivoPerda | null
  observacoes: string | null
  tags: string[] | null
  utm_source: string | null
  utm_medium: string | null
  utm_campaign: string | null
  utm_term: string | null
  utm_content: string | null
  created_at: string
  updated_at: string
}

export interface DashboardUser {
  id: string
  name: string
  email: string
  role: 'admin' | 'manager' | 'agent' | 'viewer'
  avatar_url: string | null
  created_at: string
  updated_at: string
}
