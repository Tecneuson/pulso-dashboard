import type { CampoModelo, CampoTipo } from '@/types'

/**
 * REGISTRO CANÔNICO dos custom attributes do Chatwoot usados pelo Pulso.
 *
 * O Chatwoot é a central desses campos (decisão do cliente): as definições vivem lá
 * (Configurações → Atributos personalizados) e o CRM garante que TODAS existam com o
 * mesmo vocabulário — `ensureCoreDefinitions()` cria/atualiza o que faltar.
 *
 * Campos NOVOS criados pela equipe (no Chatwoot ou na tela de Configurações do CRM)
 * não entram aqui: vão para a tabela `campos_personalizados` e sincronizam nos dois
 * sentidos (ver `campos.ts`).
 */

/** Enums do Chatwoot (app/models/custom_attribute_definition.rb). */
export const CW_ATTRIBUTE_MODEL: Record<CampoModelo, number> = {
  conversation: 0,
  contact: 1,
}
export const CW_DISPLAY_TYPE: Record<CampoTipo, number> = {
  text: 0,
  number: 1,
  // currency: 2, percent: 3 — não usados
  link: 4,
  date: 5,
  list: 6,
  checkbox: 7,
}

const MODEL_BY_NAME: Record<string, CampoModelo> = {
  conversation_attribute: 'conversation',
  contact_attribute: 'contact',
  '0': 'conversation',
  '1': 'contact',
}
const TYPE_BY_NAME: Record<string, CampoTipo> = {
  text: 'text',
  number: 'number',
  link: 'link',
  date: 'date',
  list: 'list',
  checkbox: 'checkbox',
  '0': 'text',
  '1': 'number',
  '4': 'link',
  '5': 'date',
  '6': 'list',
  '7': 'checkbox',
}

/** A API devolve os enums como string ("list") ou número (6): aceita os dois. */
export function parseModelo(v: unknown): CampoModelo | null {
  return MODEL_BY_NAME[String(v)] ?? null
}
export function parseTipo(v: unknown): CampoTipo | null {
  return TYPE_BY_NAME[String(v)] ?? null
}

export interface AttributeDefinitionSpec {
  key: string
  label: string
  modelo: CampoModelo
  tipo: CampoTipo
  opcoes?: string[]
  descricao?: string
  /** Gerenciado por outro sistema (n8n); o CRM não cria nem edita, só reconhece. */
  sistema?: boolean
}

export const ETAPAS_CHATWOOT = ['Contato', 'Atendendo', 'Negociando', 'Rastreio', 'Internação', 'Perdido']

export const PLANOS_CHATWOOT = [
  'Alice',
  'Allianz Saúde',
  'Amafresp',
  'Amil',
  'Banco Central do Brasil Saúde',
  'Blue',
  'Bradesco Saúde',
  'Care Plus',
  'Central Nacional Unimed - CNU',
  'Economus',
  'Fundação Saúde Itaú',
  'Gama Saúde',
  'Life Empresarial Saúde',
  'MediService',
  'MedSenior',
  'MedTour',
  'Metrus',
  'Notredame Intermédica',
  'Omint Saúde',
  'Porto Saúde',
  'Postal Saúde',
  'Prevent Senior',
  'PROASA Adventista de Saúde',
  'Sami Saúde',
  'Santa Casa Saúde',
  'Saúde Caixa',
  'SBC Saúde',
  'Sepaco',
  'SulAmérica',
  'Total MedCare',
  'Trasmontano',
  'Vivest',
  'Particular',
  'Não possui',
]

export const MOTIVOS_PERDA_CHATWOOT = [
  'Alta Origem',
  'Cancelado pela Origem',
  'Card Duplicado',
  'Convênio por Direcionamento',
  'Convênio sem Contrato para Adulto',
  'Convênio sem Contrato para Kids',
  'Convênio Suspenso',
  'Consulta Psiquiátrica',
  'Demora no Atendimento',
  'Falta de Interação',
  'Família Desistiu da Internação',
  'Família Rejeitou Vaga',
  'Financeiro - Itens de Higiene',
  'Financeiro - Lavanderia',
  'Financeiro - Lavanderia e Itens de Higiene',
  'Localização',
  'Médico HSM - Vaga Negada',
  'Não Gostou do Hospital',
  'Paciente Evadiu na Origem',
  'Pendências Administrativas',
  'Plano de Saúde Não Atendido pelo HSM',
  'Plano de Saúde Não Autorizou',
  'Plano em Carência',
  'Plano Não Elegível',
  'Recusa de Internação na Avaliação',
  'Sem Acompanhante Kids',
  'Sem Condições Financeiras',
  'Sem Indicação Médica para Internação',
  'Sem Leito Disponível',
  'Transferido para Outro Serviço',
]

/** Chaves fixas usadas pelo código (evita string solta espalhada). */
export const KEYS = {
  estagio: 'estagio_no_funil',
  plano: 'plano_de_saude',
  tipoContato: 'quem_e_o_contato',
  paraQuem: 'para_quem_e_a_solicitacao',
  motivoContato: 'motivo_contato_crm',
  dataNascimento: 'data_de_nascimento',
  kids: 'kids',
  assunto: 'assunto_da_conversa',
  motivoPerda: 'motivo_de_perda',
  venda: 'venda',
  elegivel: 'elegivel',
  hospitalOrigem: 'hospital_origem',
  consultorOrigem: 'consultor_origem',
  botPausado: 'bot_pausado',
} as const

export const CORE_DEFINITIONS: AttributeDefinitionSpec[] = [
  // ---------------- CONTATO (pessoa) ----------------
  {
    key: KEYS.estagio,
    label: 'Estágio no funil',
    modelo: 'contact',
    tipo: 'list',
    opcoes: ETAPAS_CHATWOOT,
    descricao: 'Etapa do lead no funil do Pulso (sincroniza com o CRM).',
  },
  { key: KEYS.plano, label: 'Plano de saúde', modelo: 'contact', tipo: 'list', opcoes: PLANOS_CHATWOOT },
  {
    key: KEYS.tipoContato,
    label: 'Quem é o contato',
    modelo: 'contact',
    tipo: 'list',
    opcoes: ['Lead', 'Ex-paciente', 'Responsável', 'Médico', 'Consultor'],
    descricao: 'Perfil do contato. No CRM agrupa em Paciente (Lead/Ex-paciente), Responsável e Consultor (Médico/Consultor).',
  },
  {
    key: KEYS.paraQuem,
    label: 'Para quem é a solicitação',
    modelo: 'contact',
    tipo: 'list',
    opcoes: ['Você mesmo(a)', 'Familiar', 'Amigo(a)'],
  },
  {
    key: KEYS.motivoContato,
    label: 'Motivo do contato (CRM)',
    modelo: 'contact',
    tipo: 'list',
    opcoes: ['TM', 'TUS'],
    descricao: 'TM = transtorno mental · TUS = abuso de substâncias.',
  },
  {
    key: KEYS.dataNascimento,
    label: 'Data de nascimento',
    modelo: 'contact',
    tipo: 'date',
    descricao: 'Data de nascimento do PACIENTE. Define automaticamente o campo Kids (8 a 17 anos).',
  },
  {
    key: KEYS.kids,
    label: 'Kids',
    modelo: 'contact',
    tipo: 'checkbox',
    descricao: 'Preenchido automaticamente: paciente entre 8 e 17 anos (unidade infantojuvenil).',
  },
  // ---------------- CONVERSA ----------------
  {
    key: KEYS.assunto,
    label: 'Assunto da conversa',
    modelo: 'conversation',
    tipo: 'list',
    opcoes: ['Internação', 'Consulta', 'Informação de paciente', 'Administrativo', 'Recursos humanos', 'Outro(s)'],
  },
  {
    key: KEYS.venda,
    label: 'Venda',
    modelo: 'conversation',
    tipo: 'list',
    opcoes: ['Sim', 'Não'],
    descricao: 'Sim = paciente internado. Marcar aqui move o lead para Internação no CRM.',
  },
  {
    key: KEYS.motivoPerda,
    label: 'Motivo de perda',
    modelo: 'conversation',
    tipo: 'list',
    opcoes: MOTIVOS_PERDA_CHATWOOT,
    descricao: 'Marcar aqui move o lead para Perdido no CRM. Obrigatório (ou Venda) para encerrar. Lista oficial (30 motivos).',
  },
  {
    key: KEYS.elegivel,
    label: 'Elegível',
    modelo: 'conversation',
    tipo: 'list',
    opcoes: ['Sim', 'Não'],
  },
  // Listas no Chatwoot (≈250 hospitais / consultores). As opções de `consultor_origem` seguem a
  // tabela `consultores` do CRM (lista única); `hospital_origem` fica como está no Chatwoot.
  { key: KEYS.hospitalOrigem, label: 'Hospital (origem)', modelo: 'conversation', tipo: 'list' },
  { key: KEYS.consultorOrigem, label: 'Consultor (origem)', modelo: 'conversation', tipo: 'list' },
  {
    key: KEYS.botPausado,
    label: 'Bot pausado',
    modelo: 'conversation',
    tipo: 'checkbox',
    descricao: 'Controle do bot Mônica (true = humano assumiu).',
    sistema: true,
  },
]

export const CORE_KEYS = new Set(CORE_DEFINITIONS.map((d) => d.key))

/**
 * Chaves conhecidas de versões anteriores que ficaram REDUNDANTES. A auditoria
 * (/api/chatwoot/auditoria) aponta se ainda existem no Chatwoot.
 */
export const LEGACY_KEYS: Record<string, string> = {
  motivo_do_contato:
    'Substituído por `motivo_contato_crm` (TM/TUS). A distinção adulto/infantojuvenil agora vem de `data_de_nascimento` + `kids`.',
  observacoes:
    'Observações deixaram de ser atributo — viraram notas privadas (histórico do CRM ⇄ Chatwoot).',
  dados_carteirinha:
    'Dados da carteirinha vão para as observações da triagem (nota); atributo livre pode ser removido.',
  motivo_contato: 'Chave antiga; usar `motivo_contato_crm`.',
  estagio_funil: 'Chave antiga; usar `estagio_no_funil`.',
  tipo_contato: 'Chave antiga; usar `quem_e_o_contato`.',
  outras_origem:
    'Origem antiga (Transferência hospitalar/Indicação médica/…). A origem oficial é a do CRM (Interhospitalar/Consultor/Profissional/Residência) com `hospital_origem`/`consultor_origem`.',
  conversa_outras_origem: 'Mesmo caso de `outras_origem`, no nível da conversa.',
}
