// ============================================================
// Enums — espelham os enums do banco
// ============================================================

// Perfil do contato (lista do Chatwoot `quem_e_o_contato`, BI "PERFIL"):
// Lead · Ex-paciente · Responsável · Médico · Consultor. "Parceiro" (antigo) virou Consultor.
// As 3 CATEGORIAS pedidas (Paciente / Responsável / Consultor) são um agrupamento derivado:
// Lead + Ex-paciente → Paciente · Responsável → Responsável · Médico + Consultor → Consultor.
export const TIPO_CONTATO = ['lead', 'ex_paciente', 'responsavel', 'medico', 'consultor'] as const
export type TipoContato = (typeof TIPO_CONTATO)[number]

export const TIPO_CONTATO_LABELS: Record<TipoContato, string> = {
  lead: 'Lead',
  ex_paciente: 'Ex-paciente',
  responsavel: 'Responsável',
  medico: 'Médico',
  consultor: 'Consultor',
}

export const CATEGORIA_CONTATO = ['paciente', 'responsavel', 'consultor'] as const
export type CategoriaContato = (typeof CATEGORIA_CONTATO)[number]

export const CATEGORIA_CONTATO_LABELS: Record<CategoriaContato, string> = {
  paciente: 'Paciente',
  responsavel: 'Responsável',
  consultor: 'Consultor',
}

/** Categoria (3) derivada do perfil (5). */
export function categoriaDoTipo(tipo: string | null | undefined): CategoriaContato | null {
  switch (tipo) {
    case 'lead':
    case 'ex_paciente':
    case 'paciente':
      return 'paciente'
    case 'responsavel':
      return 'responsavel'
    case 'medico':
    case 'consultor':
    case 'parceiro':
      return 'consultor'
    default:
      return null
  }
}

/** Mapa de valores legados → perfil atual (banco e Chatwoot). */
export const TIPO_CONTATO_LEGADO: Record<string, TipoContato> = {
  lead: 'lead',
  ex_paciente: 'ex_paciente',
  paciente: 'lead',
  responsavel: 'responsavel',
  responsavel_lead: 'responsavel',
  responsavel_ex_paciente: 'responsavel',
  medico: 'medico',
  parceiro: 'consultor',
  consultor: 'consultor',
}

export function normalizarTipoContato(v: string | null | undefined): TipoContato | null {
  if (!v) return null
  return TIPO_CONTATO_LEGADO[v] ?? null
}

export const PARA_QUEM = ['voce_mesmo', 'familiar', 'amigo'] as const
export type ParaQuem = (typeof PARA_QUEM)[number]

export const ASSUNTO = [
  'internacao',
  'consulta',
  'informacao_paciente',
  'administrativo',
  'recursos_humanos',
  'outro_assunto',
] as const
export type Assunto = (typeof ASSUNTO)[number]

export const ASSUNTO_LABELS: Record<string, string> = {
  internacao: 'Internação',
  consulta: 'Consulta',
  informacao_paciente: 'Informação de paciente',
  administrativo: 'Administrativo',
  recursos_humanos: 'Recursos humanos',
  outro_assunto: 'Outro(s)',
  outros: 'Outro(s)', // valor legado
}

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

// Motivo do contato: TM (transtorno mental) ou TUS (abuso de substâncias).
// A distinção adulto/infantojuvenil saiu daqui e passou a vir da data de nascimento.
export const MOTIVO_CONTATO = ['transtorno_mental', 'abuso_de_substancias'] as const
export type MotivoContato = (typeof MOTIVO_CONTATO)[number]

export const MOTIVO_CONTATO_LABELS: Record<string, string> = {
  transtorno_mental: 'Transtorno mental (TM)',
  abuso_de_substancias: 'Abuso de substâncias (TUS)',
  // valores legados (antes da migração 2026-08-05) — só para exibição de dados antigos
  transtorno_mental_adulto: 'Transtorno mental (TM)',
  transtorno_mental_infantojuvenil: 'Transtorno mental (TM)',
}

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

// Motivos de perda — vocabulário do cliente (CSV ago/2026), 30 valores. Rótulo = valor
// EXATO da lista `motivo_de_perda` no Chatwoot. Os slugs antigos que não têm equivalente
// direto continuam aceitos como legado (só exibição; não aparecem nos selects).
export const MOTIVO_PERDA = [
  'alta_origem',
  'cancelado_pela_origem',
  'card_duplicado',
  'convenio_por_direcionamento',
  'convenio_sem_contrato_para_adulto',
  'convenio_sem_contrato_para_kids',
  'convenio_suspenso',
  'consulta_psiquiatrica',
  'demora_no_atendimento',
  'falta_de_interacao',
  'familia_desistiu_da_internacao',
  'familia_rejeitou_vaga',
  'financeiro_itens_de_higiene',
  'financeiro_lavanderia',
  'financeiro_lavanderia_e_itens_de_higiene',
  'localizacao',
  'medico_hsm_vaga_negada',
  'nao_gostou_do_hospital',
  'paciente_evadiu_na_origem',
  'pendencias_administrativas',
  'plano_de_saude_nao_atendido_pelo_hsm',
  'plano_de_saude_nao_autorizou',
  'plano_em_carencia',
  'plano_nao_elegivel',
  'recusa_de_internacao_na_avaliacao',
  'sem_acompanhante_kids',
  'sem_condicoes_financeiras',
  'sem_indicacao_medica_para_internacao',
  'sem_leito_disponivel',
  'transferido_para_outro_servico',
] as const
export type MotivoPerda = (typeof MOTIVO_PERDA)[number]

export const MOTIVO_PERDA_LABELS: Record<string, string> = {
  alta_origem: 'Alta Origem',
  cancelado_pela_origem: 'Cancelado pela Origem',
  card_duplicado: 'Card Duplicado',
  convenio_por_direcionamento: 'Convênio por Direcionamento',
  convenio_sem_contrato_para_adulto: 'Convênio sem Contrato para Adulto',
  convenio_sem_contrato_para_kids: 'Convênio sem Contrato para Kids',
  convenio_suspenso: 'Convênio Suspenso',
  consulta_psiquiatrica: 'Consulta Psiquiátrica',
  demora_no_atendimento: 'Demora no Atendimento',
  falta_de_interacao: 'Falta de Interação',
  familia_desistiu_da_internacao: 'Família Desistiu da Internação',
  familia_rejeitou_vaga: 'Família Rejeitou Vaga',
  financeiro_itens_de_higiene: 'Financeiro - Itens de Higiene',
  financeiro_lavanderia: 'Financeiro - Lavanderia',
  financeiro_lavanderia_e_itens_de_higiene: 'Financeiro - Lavanderia e Itens de Higiene',
  localizacao: 'Localização',
  medico_hsm_vaga_negada: 'Médico HSM - Vaga Negada',
  nao_gostou_do_hospital: 'Não Gostou do Hospital',
  paciente_evadiu_na_origem: 'Paciente Evadiu na Origem',
  pendencias_administrativas: 'Pendências Administrativas',
  plano_de_saude_nao_atendido_pelo_hsm: 'Plano de Saúde Não Atendido pelo HSM',
  plano_de_saude_nao_autorizou: 'Plano de Saúde Não Autorizou',
  plano_em_carencia: 'Plano em Carência',
  plano_nao_elegivel: 'Plano Não Elegível',
  recusa_de_internacao_na_avaliacao: 'Recusa de Internação na Avaliação',
  sem_acompanhante_kids: 'Sem Acompanhante Kids',
  sem_condicoes_financeiras: 'Sem Condições Financeiras',
  sem_indicacao_medica_para_internacao: 'Sem Indicação Médica para Internação',
  sem_leito_disponivel: 'Sem Leito Disponível',
  transferido_para_outro_servico: 'Transferido para Outro Serviço',
  // legado (antes de ago/2026)
  nao_tem_plano_de_saude: 'Não tem plano de saúde (legado)',
  sus: 'SUS (legado)',
  outro: 'Outro(s) (legado)',
  colaborador_do_hospital: 'Colaborador do hospital (legado)',
  parou_de_interagir: 'Falta de Interação',
  desistiu_do_tratamento: 'Família Desistiu da Internação',
  financeiro: 'Sem Condições Financeiras',
  plano_de_saude_sem_convenio: 'Plano de Saúde Não Atendido pelo HSM',
}

/** Slugs antigos → novos (migração de dados e leitura de valores antigos). */
export const MOTIVO_PERDA_LEGADO: Record<string, string> = {
  parou_de_interagir: 'falta_de_interacao',
  desistiu_do_tratamento: 'familia_desistiu_da_internacao',
  financeiro: 'sem_condicoes_financeiras',
  plano_de_saude_sem_convenio: 'plano_de_saude_nao_atendido_pelo_hsm',
  plano_de_saude_nao_autorizou: 'plano_de_saude_nao_autorizou',
  nao_gostou_do_hospital: 'nao_gostou_do_hospital',
}

/** Slugs legados ainda aceitos pelo CHECK do banco (só leitura). */
export const MOTIVO_PERDA_LEGADO_ACEITO = ['nao_tem_plano_de_saude', 'sus', 'outro', 'colaborador_do_hospital'] as const

/** Motivo usado pelo encerramento automático por inatividade. */
export const MOTIVO_PERDA_INATIVIDADE = 'falta_de_interacao'

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
  /** Slug do plano (vocabulário completo em chatwoot/mapping PLANO_LABELS — o enum PLANO_SAUDE é legado). */
  plano_saude: string | null
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
  paciente_id: string | null
  cpf: string | null
  data_nascimento: string | null
  /** Elegibilidade do contato (avaliada na conversa): true = Sim, false = Não, null = não avaliado. */
  elegivel: boolean | null
  /** Derivado da data de nascimento: paciente entre 8 e 17 anos (unidade infantojuvenil). */
  kids: boolean | null
  /** Id do contato no Chatwoot (permite sincronizar mesmo sem conversa). */
  chatwoot_contact_id: number | null
  /** Valores dos campos personalizados (chave = attribute_key do Chatwoot). */
  atributos: Record<string, unknown> | null
  // Origem da conversa + número do paciente (colunas novas)
  numero_paciente: string | null
  origem_conversa: string | null
  origem_hospital_id: string | null
  origem_consultor_id: string | null
  origem_profissional_tipo: string | null
  /** Legado: vínculo antigo com `captadores` (substituído por consultor_id). */
  captador_id: string | null
  /** Consultor responsável pelo lead (tabela `consultores`, lista unificada). */
  consultor_id: string | null
  /** Status da conversa no Chatwoot (open | pending | snoozed | resolved), atualizado pelo webhook. */
  chatwoot_status: string | null
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

// ------------------------------------------------------------
// Funil unificado — classificações do paciente (coluna
// `classificacao_cliente`, texto livre vindo do CSV mensal).
// Valores EXATOS do banco; a UI traduz via CLASSIFICACAO_LABELS.
// ------------------------------------------------------------

export const CLASSIFICACAO_INTERNADO = 'Cliente Atualmente Internado'

// Classificações que viram colunas próprias após "Internado" no Kanban.
export const CLASSIFICACAO_FUNIL = [
  'Cliente Churn',
  'Cliente Churn até 1 ano sem internação',
  'Cliente Irregular',
] as const
export type ClassificacaoFunil = (typeof CLASSIFICACAO_FUNIL)[number]

export const CLASSIFICACAO_LABELS: Record<string, string> = {
  'Cliente Churn': 'Churn',
  'Cliente Churn até 1 ano sem internação': 'Churn < 1 ano',
  'Cliente Irregular': 'Irregular',
  [CLASSIFICACAO_INTERNADO]: 'Atualmente internado',
}

/** Resumo do paciente anexado ao lead no funil unificado (via triagem_hsm.paciente_id). */
export interface PacienteResumo {
  id: string
  identificador_cliente: number
  nome_cliente: string
  convenio_raw: string | null
  classificacao_cliente: string | null
  data_emissao_max: string | null
  data_emissao_min: string | null
  penultima_internacao: string | null
  cpf: string | null
  telefones: string[] | null
}

/** Campos do resumo — usar no .select() para não trafegar a linha inteira. */
export const PACIENTE_RESUMO_FIELDS =
  'id, identificador_cliente, nome_cliente, convenio_raw, classificacao_cliente, data_emissao_max, data_emissao_min, penultima_internacao, cpf, telefones'

/** Lead do funil unificado: triagem + paciente conciliado (quando houver). */
export type TriagemLead = Triagem & {
  paciente?: PacienteResumo | null
}

// ============================================================
// Cadastros visuais (localStorage) — não existem no banco
// ============================================================

/** Consultor: intermediário entre a família do paciente e o hospital. */
export interface Consultor {
  id: string
  nome: string
  telefone?: string | null
  email?: string | null
  observacoes?: string | null
  ativo: boolean
  created_at: string
}

/** Hospital parceiro (origem "Interhospitalar"). */
export interface Hospital {
  id: string
  nome: string
  ativo: boolean
  created_at: string
}

/** Captador/indicador de leads e pacientes. */
export interface Captador {
  id: string
  nome: string
  /** Tipo do captador — mesma taxonomia de origem (interhospitalar, consultor, etc.). */
  tipo?: string | null
  telefone?: string | null
  email?: string | null
  observacoes?: string | null
  ativo: boolean
  created_at: string
}

// ============================================================
// Agendamentos — próximo contato (lead/paciente) + eventos da agenda
// ============================================================

export const AGENDAMENTO_STATUS = [
  'pendente',
  'contatado',
  'nao_contatado',
  'concluido',
  'cancelado',
] as const
export type AgendamentoStatus = (typeof AGENDAMENTO_STATUS)[number]

export const AGENDAMENTO_STATUS_LABELS: Record<AgendamentoStatus, string> = {
  pendente: 'Pendente',
  contatado: 'Entrou em contato',
  nao_contatado: 'Não conseguiu contato',
  concluido: 'Concluído',
  cancelado: 'Cancelado',
}

export type AgendamentoTipo = 'contato' | 'evento'

/** Lembrete de próximo contato ou evento avulso da agenda (tabela `agendamentos`). */
export interface Agendamento {
  id: string
  tipo: AgendamentoTipo
  titulo: string | null
  triagem_id: string | null
  paciente_id: string | null
  /** YYYY-MM-DD */
  data: string
  /** HH:MM:SS ou null (dia inteiro) */
  hora: string | null
  nota: string | null
  status: AgendamentoStatus
  resultado_nota: string | null
  concluido_at: string | null
  criado_por: string | null
  responsavel_id: string | null
  created_at: string
  updated_at: string
  /** Nome do lead/paciente, resolvido pela API para a agenda. */
  alvo_nome?: string | null
}

export const ANOTACAO_ORIGEM = ['crm', 'chatwoot', 'bot'] as const
export type AnotacaoOrigem = (typeof ANOTACAO_ORIGEM)[number]

export interface Anotacao {
  id: string
  triagem_id: string | null
  /** Null quando a nota nasceu no Chatwoot (autor fora da tabela `usuarios`). */
  usuario_id: string | null
  conteudo: string
  created_at: string | null
  /** Onde a nota foi escrita: crm (Pulso), chatwoot (nota privada) ou bot (Mônica). */
  origem?: AnotacaoOrigem | null
  /** Nome do autor quando não é usuário do Pulso (agente do Chatwoot, bot). */
  autor_nome?: string | null
  /** Id da mensagem privada no Chatwoot (dedupe do eco CRM ⇄ Chatwoot). */
  chatwoot_message_id?: number | null
  usuarios?: { nome: string } | null
}

// ============================================================
// Campos personalizados — definidos no Chatwoot (central) e espelhados aqui
// (tabela `campos_personalizados`). Valores ficam em `triagem_hsm.atributos`.
// ============================================================

export const CAMPO_MODELO = ['contact', 'conversation'] as const
export type CampoModelo = (typeof CAMPO_MODELO)[number]

export const CAMPO_TIPO = ['text', 'number', 'date', 'list', 'checkbox', 'link'] as const
export type CampoTipo = (typeof CAMPO_TIPO)[number]

export const CAMPO_TIPO_LABELS: Record<CampoTipo, string> = {
  text: 'Texto',
  number: 'Número',
  date: 'Data',
  list: 'Lista',
  checkbox: 'Sim/Não',
  link: 'Link',
}

export interface CampoPersonalizado {
  id: string
  /** attribute_key no Chatwoot (snake_case). */
  chave: string
  rotulo: string
  descricao: string | null
  modelo: CampoModelo
  tipo: CampoTipo
  /** Opções quando tipo = list. */
  opcoes: string[]
  ativo: boolean
  ordem: number
  /** Id da definição no Chatwoot (null = ainda não sincronizado). */
  chatwoot_definition_id: number | null
  created_at: string
  updated_at: string
}

export interface Paciente {
  id: string
  identificador_cliente: number
  nome_cliente: string
  cpf: string | null
  telefones: string[]
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
  /** Legado (ver consultor_id). */
  captador_id: string | null
  consultor_id: string | null
  observacoes: string | null
  tags: string[] | null
  ultimo_contato_at: string | null
  origem_carga: string | null
  created_at: string
  updated_at: string
}
