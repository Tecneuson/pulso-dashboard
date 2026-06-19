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

// Funil canônico — espelha os valores de `estagio_no_funil` do Chatwoot (fonte da verdade).
export const ESTAGIO_FUNIL = [
  'em_atendimento',
  'convenio_nao_legivel',
  'convenio_legivel',
  'em_avaliacao_hsm',
  'vaga_cedida',
  'vaga_recusada_medico',
  'recusou_origem',
  'recusou_internacao',
  'sem_condicoes_financeiras',
  'internado',
] as const
export type EstagioFunil = (typeof ESTAGIO_FUNIL)[number]

export const ESTAGIO_FUNIL_LABELS: Record<EstagioFunil, string> = {
  em_atendimento: 'Em atendimento',
  convenio_nao_legivel: 'Convênio não legível',
  convenio_legivel: 'Convênio legível',
  em_avaliacao_hsm: 'Em avaliação no HSM',
  vaga_cedida: 'Vaga cedida',
  vaga_recusada_medico: 'Vaga recusada pelo médico HSM',
  recusou_origem: 'Recusou a internação na origem',
  recusou_internacao: 'Recusou a internação',
  sem_condicoes_financeiras: 'Sem condições financeiras',
  internado: 'Internado',
}

// Rótulos exatos no Chatwoot (atributo de contato `estagio_no_funil`), na MESMA ordem dos slugs.
export const ESTAGIO_FUNIL_CHATWOOT: Record<EstagioFunil, string> = ESTAGIO_FUNIL_LABELS

export const TERMINAL_STAGES: EstagioFunil[] = [
  'internado',
  'recusou_internacao',
  'recusou_origem',
  'vaga_recusada_medico',
  'sem_condicoes_financeiras',
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

// ============================================================
// Pacientes — base de reativação (tabela `pacientes`)
// ============================================================

export const ESTAGIO_REATIVACAO = [
  'nao_contatado',
  'tentativa_contato',
  'em_conversa',
  'interesse',
  'reativado',
  'sem_interesse',
  'nao_localizado',
] as const
export type EstagioReativacao = (typeof ESTAGIO_REATIVACAO)[number]

export const ESTAGIO_REATIVACAO_LABELS: Record<EstagioReativacao, string> = {
  nao_contatado: 'Não contatado',
  tentativa_contato: 'Tentativa de contato',
  em_conversa: 'Em conversa',
  interesse: 'Com interesse',
  reativado: 'Reativado',
  sem_interesse: 'Sem interesse',
  nao_localizado: 'Não localizado',
}

// Estágios terminais (positivo e negativos)
export const ESTAGIO_REATIVACAO_TERMINAIS: EstagioReativacao[] = [
  'reativado',
  'sem_interesse',
  'nao_localizado',
]

export interface Paciente {
  id: string
  identificador_cliente: number
  nome_cliente: string
  convenio_raw: string | null
  convenio_normalizado: string | null
  classificacao_cliente: string | null
  classificacao_produto: string | null
  identificador_produto: string | null
  cid_codigo: string | null
  sub_familia_produto: string | null
  mes_rexis: string | null
  data_emissao_max: string | null
  data_emissao_min: string | null
  penultima_internacao: string | null
  estagio_reativacao: EstagioReativacao
  responsavel_id: string | null
  observacoes: string | null
  tags: string[] | null
  ultimo_contato_at: string | null
  origem_carga: string | null
  created_at: string
  updated_at: string
}
