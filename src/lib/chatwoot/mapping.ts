import type { Triagem } from '@/types'
import { ESTAGIO_FUNIL } from '@/types'
import {
  ETAPA_TO_ESTAGIO,
  FUNIL_ETAPAS,
  FUNIL_ETAPA_LABELS,
  etapaFromEstagio,
} from '@/lib/funil-etapas'

/**
 * Tradução de valores entre o triagem_hsm (slugs) e os custom attributes do Chatwoot (rótulos).
 * Vocabulário canônico = Chatwoot (decisão do cliente). Valores conferidos ao vivo na API.
 */

type Level = 'contact' | 'conversation'

interface FieldMap {
  triagemField: keyof Triagem
  level: Level
  chatwootKey: string
  slugToLabel: Record<string, string>
  /** Volta explícita (Chatwoot → banco) quando vários slugs compartilham o mesmo rótulo. */
  labelToSlug?: Record<string, string>
}

/**
 * Funil: o Chatwoot mostra as MESMAS 6 etapas do CRM (Contato → Atendendo → Negociando →
 * Rastreio → Internação, + Perdido). O banco continua guardando os 10 slugs granulares;
 * a tradução acontece aqui, nos dois sentidos. "Contato" = estagio_funil null.
 */
const estagioMap: Record<string, string> = Object.fromEntries(
  ESTAGIO_FUNIL.map((slug) => [slug, FUNIL_ETAPA_LABELS[etapaFromEstagio(slug)]])
)

/** Rótulo da etapa → slug canônico do banco (o inverso de ETAPA_TO_ESTAGIO). */
const estagioLabelToSlug: Record<string, string> = Object.fromEntries(
  FUNIL_ETAPAS.filter((e) => ETAPA_TO_ESTAGIO[e]).map((e) => [
    FUNIL_ETAPA_LABELS[e],
    ETAPA_TO_ESTAGIO[e] as string,
  ])
)

/** Rótulo da etapa "Contato" — no banco equivale a estagio_funil = null. */
export const ETAPA_CONTATO_LABEL = FUNIL_ETAPA_LABELS.contato

const planoMap: Record<string, string> = {
  alice: 'Alice',
  allianz_saude: 'Allianz Saúde',
  amafresp: 'Amafresp',
  amil: 'Amil',
  banco_central_do_brasil_saude: 'Banco Central do Brasil Saúde',
  blue: 'Blue',
  bradesco_saude: 'Bradesco Saúde',
  care_plus: 'Care Plus',
  central_nacional_unimed_cnu: 'Central Nacional Unimed - CNU',
  economus: 'Economus',
  fundacao_saude_itau: 'Fundação Saúde Itaú',
  gama_saude: 'Gama Saúde',
  life_empresarial_saude: 'Life Empresarial Saúde',
  mediservice: 'MediService',
  medsenior: 'MedSenior',
  medtour: 'MedTour',
  metrus: 'Metrus',
  notredame_intermedica: 'Notredame Intermédica',
  omint_saude: 'Omint Saúde',
  porto_saude: 'Porto Saúde',
  postal_saude: 'Postal Saúde',
  prevent_senior: 'Prevent Senior',
  proasa_adventista_de_saude: 'PROASA Adventista de Saúde',
  sami_saude: 'Sami Saúde',
  santa_casa_saude: 'Santa Casa Saúde',
  saude_caixa: 'Saúde Caixa',
  sbc_saude: 'SBC Saúde',
  sepaco: 'Sepaco',
  sulamerica: 'SulAmérica',
  total_medcare: 'Total MedCare',
  trasmontano: 'Trasmontano',
  vivest: 'Vivest',
  particular: 'Particular',
  nao_possui: 'Não possui',
}

const tipoContatoMap: Record<string, string> = {
  lead: 'Lead',
  ex_paciente: 'Ex-paciente',
  responsavel: 'Responsável',
  medico: 'Médico',
  parceiro: 'Parceiro',
}

const paraQuemMap: Record<string, string> = {
  voce_mesmo: 'Você mesmo(a)',
  familiar: 'Familiar',
  amigo: 'Amigo(a)',
}

// Campo `motivo_contato_crm` (contato, list TM/TUS) — só o dashboard escreve nele, o n8n
// não toca. A distinção adulto/infantojuvenil deixou de ser um valor de motivo e passou a
// vir da `data_de_nascimento`. Chave separada do `motivo_do_contato` do n8n.
const motivoContatoMap: Record<string, string> = {
  transtorno_mental: 'TM',
  abuso_de_substancias: 'TUS',
}

const assuntoMap: Record<string, string> = {
  internacao: 'Internação',
  consulta: 'Consulta',
  informacao_paciente: 'Informação de paciente',
  administrativo: 'Administrativo',
  recursos_humanos: 'Recursos humanos',
  outro_assunto: 'Outro(s)',
}

const motivoPerdaMap: Record<string, string> = {
  parou_de_interagir: 'Parou de interagir',
  desistiu_do_tratamento: 'Desistiu do tratamento',
  financeiro: 'Financeiro',
  plano_de_saude_nao_autorizou: 'Plano de saúde não autorizou',
  plano_de_saude_sem_convenio: 'Plano de saúde sem cobertura',
  nao_tem_plano_de_saude: 'Não tem plano de saúde',
  nao_gostou_do_hospital: 'Não gostou do hospital',
  sus: 'SUS',
  outro: 'Outro(s)',
}

export const FIELD_MAPS: FieldMap[] = [
  {
    triagemField: 'estagio_funil',
    level: 'contact',
    chatwootKey: 'estagio_no_funil',
    slugToLabel: estagioMap,
    labelToSlug: estagioLabelToSlug,
  },
  { triagemField: 'plano_saude', level: 'contact', chatwootKey: 'plano_de_saude', slugToLabel: planoMap },
  { triagemField: 'tipo_contato', level: 'contact', chatwootKey: 'quem_e_o_contato', slugToLabel: tipoContatoMap },
  { triagemField: 'para_quem', level: 'contact', chatwootKey: 'para_quem_e_a_solicitacao', slugToLabel: paraQuemMap },
  { triagemField: 'motivo_contato', level: 'contact', chatwootKey: 'motivo_contato_crm', slugToLabel: motivoContatoMap },
  { triagemField: 'assunto', level: 'conversation', chatwootKey: 'assunto_da_conversa', slugToLabel: assuntoMap },
  { triagemField: 'motivo_perda', level: 'conversation', chatwootKey: 'motivo_de_perda', slugToLabel: motivoPerdaMap },
]

/** Custom attribute (novo) usado pra espelhar as observações do dashboard. */
export const OBSERVACOES_KEY = 'observacoes'
/** Custom attribute (conversa) derivado: paciente foi internado? */
export const VENDA_KEY = 'venda'
/** Custom attribute (contato, date) — data de nascimento do paciente. */
export const DATA_NASCIMENTO_KEY = 'data_de_nascimento'
/** Custom attribute (conversa, list Sim/Não) — elegibilidade avaliada na conversa. */
export const ELEGIVEL_KEY = 'elegivel'
/** Custom attributes (conversa) — origem da conversa, associada ao paciente. */
export const HOSPITAL_ORIGEM_KEY = 'hospital_origem'
export const CONSULTOR_ORIGEM_KEY = 'consultor_origem'

function reverse(m: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(m).map(([k, v]) => [v, k]))
}

/** Opções {value(slug), label} por campo — usadas nos selects de edição do card. */
export const FIELD_OPTIONS: Partial<Record<keyof Triagem, { value: string; label: string }[]>> =
  Object.fromEntries(
    FIELD_MAPS.map((f) => [
      f.triagemField,
      Object.entries(f.slugToLabel).map(([value, label]) => ({ value, label })),
    ])
  )

/** Dashboard → Chatwoot: atributos do CONTATO a partir de uma triagem (slug→rótulo; ignora nulos). */
export function contactAttrsFromTriagem(t: Partial<Triagem>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const f of FIELD_MAPS) {
    if (f.level !== 'contact') continue
    const v = t[f.triagemField] as string | null | undefined
    if (v && f.slugToLabel[v]) out[f.chatwootKey] = f.slugToLabel[v]
  }
  if (typeof t.data_nascimento === 'string' && t.data_nascimento) {
    out[DATA_NASCIMENTO_KEY] = t.data_nascimento
  }
  return out
}

/** Dashboard → Chatwoot: atributos da CONVERSA (inclui `venda` derivado e `observacoes`). */
export function conversationAttrsFromTriagem(t: Partial<Triagem>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const f of FIELD_MAPS) {
    if (f.level !== 'conversation') continue
    const v = t[f.triagemField] as string | null | undefined
    if (v && f.slugToLabel[v]) out[f.chatwootKey] = f.slugToLabel[v]
  }
  if (t.estagio_funil !== undefined && t.estagio_funil !== null) {
    out[VENDA_KEY] = t.estagio_funil === 'internado' ? 'Sim' : 'Não'
  }
  if (typeof t.elegivel === 'boolean') out[ELEGIVEL_KEY] = t.elegivel ? 'Sim' : 'Não'
  // observacoes NÃO é mais atributo: vira nota privada na conversa (ver /api/triagem).
  return out
}

/** Chatwoot → Dashboard: produz uma triagem parcial (slugs) a partir dos custom attributes. */
export function triagemFromChatwoot(
  contactAttrs: Record<string, unknown> = {},
  convAttrs: Record<string, unknown> = {}
): Partial<Triagem> {
  const out: Partial<Triagem> = {}
  for (const f of FIELD_MAPS) {
    const src = f.level === 'contact' ? contactAttrs : convAttrs
    const label = src[f.chatwootKey]
    if (label != null && label !== '') {
      const slug = (f.labelToSlug ?? reverse(f.slugToLabel))[String(label)]
      if (slug) (out as Record<string, unknown>)[f.triagemField] = slug
    }
  }
  // Etapa "Contato" no Chatwoot = sem estágio no banco (o atendente pode voltar o card pra lá).
  if (contactAttrs['estagio_no_funil'] === ETAPA_CONTATO_LABEL) out.estagio_funil = null
  const obs = convAttrs[OBSERVACOES_KEY]
  if (typeof obs === 'string') out.observacoes = obs
  const dn = contactAttrs[DATA_NASCIMENTO_KEY]
  if (typeof dn === 'string' && dn) out.data_nascimento = dn.slice(0, 10)
  const el = convAttrs[ELEGIVEL_KEY]
  if (el === 'Sim') out.elegivel = true
  else if (el === 'Não') out.elegivel = false
  return out
}
