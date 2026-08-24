import type { CampoPersonalizado, Triagem } from '@/types'
import {
  ESTAGIO_FUNIL,
  MOTIVO_PERDA,
  MOTIVO_PERDA_LABELS,
  MOTIVO_PERDA_LEGADO,
  TIPO_CONTATO,
  TIPO_CONTATO_LABELS,
  TIPO_CONTATO_LEGADO,
} from '@/types'
import {
  ETAPA_TO_ESTAGIO,
  FUNIL_ETAPAS,
  FUNIL_ETAPA_LABELS,
  etapaFromEstagio,
} from '@/lib/funil-etapas'
import { KEYS, MOTIVOS_PERDA_CHATWOOT, PLANOS_CHATWOOT } from './attributes'

/**
 * Tradução de valores entre o triagem_hsm (slugs) e os custom attributes do Chatwoot (rótulos).
 * Vocabulário canônico = Chatwoot (decisão do cliente). Os rótulos aqui são EXATAMENTE os
 * das definições em `attributes.ts` (que o CRM garante no Chatwoot).
 */

type Level = 'contact' | 'conversation'

interface FieldMap {
  triagemField: keyof Triagem
  level: Level
  chatwootKey: string
  slugToLabel: Record<string, string>
  /** Volta explícita (Chatwoot → banco) quando vários slugs compartilham o mesmo rótulo. */
  labelToSlug?: Record<string, string>
  /** Chatwoot com valor vazio ('') limpa o campo no banco (null). Padrão: ignora vazio. */
  vazioLimpa?: boolean
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

const PLANO_SLUGS = [
  'alice',
  'allianz_saude',
  'amafresp',
  'amil',
  'banco_central_do_brasil_saude',
  'blue',
  'bradesco_saude',
  'care_plus',
  'central_nacional_unimed_cnu',
  'economus',
  'fundacao_saude_itau',
  'gama_saude',
  'life_empresarial_saude',
  'mediservice',
  'medsenior',
  'medtour',
  'metrus',
  'notredame_intermedica',
  'omint_saude',
  'porto_saude',
  'postal_saude',
  'prevent_senior',
  'proasa_adventista_de_saude',
  'sami_saude',
  'santa_casa_saude',
  'saude_caixa',
  'sbc_saude',
  'sepaco',
  'sulamerica',
  'total_medcare',
  'trasmontano',
  'vivest',
  'particular',
  'nao_possui',
]
const planoMap: Record<string, string> = Object.fromEntries(
  PLANO_SLUGS.map((slug, i) => [slug, PLANOS_CHATWOOT[i]])
)
/** Rótulo do plano por slug — único lugar (antes havia 4 cópias parciais na UI). */
export const PLANO_LABELS: Record<string, string> = { ...planoMap, omint: 'Omint Saúde' }

// Perfil do contato (Lead / Ex-paciente / Responsável / Médico / Consultor). Rótulos antigos
// no Chatwoot ("Parceiro", "Paciente") continuam sendo lidos.
const tipoContatoMap: Record<string, string> = Object.fromEntries(
  TIPO_CONTATO.map((slug) => [slug, TIPO_CONTATO_LABELS[slug]])
)
const tipoContatoLabelToSlug: Record<string, string> = {
  ...Object.fromEntries(TIPO_CONTATO.map((slug) => [TIPO_CONTATO_LABELS[slug], slug])),
  Parceiro: 'consultor',
  Paciente: 'lead',
}

const paraQuemMap: Record<string, string> = {
  voce_mesmo: 'Você mesmo(a)',
  familiar: 'Familiar',
  amigo: 'Amigo(a)',
}

// Campo `motivo_contato_crm` (contato, list TM/TUS). A distinção adulto/infantojuvenil
// deixou de ser um valor de motivo e passou a vir da `data_de_nascimento` (+ `kids`).
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

const motivoPerdaMap: Record<string, string> = Object.fromEntries(
  MOTIVO_PERDA.map((slug) => [slug, MOTIVO_PERDA_LABELS[slug]])
)
// Rótulos antigos do Chatwoot → slug atual (conversas antigas continuam legíveis).
const motivoPerdaLabelToSlug: Record<string, string> = {
  ...Object.fromEntries(MOTIVO_PERDA.map((slug) => [MOTIVO_PERDA_LABELS[slug], slug])),
  'Parou de interagir': 'falta_de_interacao',
  'Desistiu do tratamento': 'familia_desistiu_da_internacao',
  Financeiro: 'sem_condicoes_financeiras',
  'Plano de saúde não autorizou': 'plano_de_saude_nao_autorizou',
  'Plano de saúde sem cobertura': 'plano_de_saude_nao_atendido_pelo_hsm',
  'Não gostou do hospital': 'nao_gostou_do_hospital',
  'Não tem plano de saúde': 'nao_tem_plano_de_saude',
  SUS: 'sus',
  'Outro(s)': 'outro',
  // lista intermediária que existia no Chatwoot em ago/2026
  Carência: 'plano_em_carencia',
  'Alta na origem': 'alta_origem',
  'Cancelado pela origem': 'cancelado_pela_origem',
  'Colaborador do hospital': 'colaborador_do_hospital',
  'Convênio por direcionamento': 'convenio_por_direcionamento',
  'Convênio sem contrato para adulto/kids': 'convenio_sem_contrato_para_adulto',
  'Convênio suspenso': 'convenio_suspenso',
  'Família desistiu da internação': 'familia_desistiu_da_internacao',
  'Rejeitou vaga localização': 'familia_rejeitou_vaga',
  'Evadiu na origem': 'paciente_evadiu_na_origem',
  'Sem leito disponível': 'sem_leito_disponivel',
  'Transferido para outro serviço': 'transferido_para_outro_servico',
}

/** Chave de comparação tolerante: sem acento, minúscula, espaços colapsados. */
function chaveRotulo(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

/** Procura o slug pelo rótulo: exato primeiro, depois tolerante a acento/caixa. */
function slugPorRotulo(mapa: Record<string, string>, rotulo: string): string | undefined {
  if (mapa[rotulo] !== undefined) return mapa[rotulo]
  const alvo = chaveRotulo(rotulo)
  for (const [k, v] of Object.entries(mapa)) if (chaveRotulo(k) === alvo) return v
  return undefined
}

export const FIELD_MAPS: FieldMap[] = [
  {
    triagemField: 'estagio_funil',
    level: 'contact',
    chatwootKey: KEYS.estagio,
    slugToLabel: estagioMap,
    labelToSlug: estagioLabelToSlug,
  },
  { triagemField: 'plano_saude', level: 'contact', chatwootKey: KEYS.plano, slugToLabel: planoMap },
  {
    triagemField: 'tipo_contato',
    level: 'contact',
    chatwootKey: KEYS.tipoContato,
    slugToLabel: tipoContatoMap,
    labelToSlug: tipoContatoLabelToSlug,
  },
  { triagemField: 'para_quem', level: 'contact', chatwootKey: KEYS.paraQuem, slugToLabel: paraQuemMap },
  { triagemField: 'motivo_contato', level: 'contact', chatwootKey: KEYS.motivoContato, slugToLabel: motivoContatoMap },
  { triagemField: 'assunto', level: 'conversation', chatwootKey: KEYS.assunto, slugToLabel: assuntoMap },
  {
    triagemField: 'motivo_perda',
    level: 'conversation',
    chatwootKey: KEYS.motivoPerda,
    slugToLabel: motivoPerdaMap,
    labelToSlug: motivoPerdaLabelToSlug,
    vazioLimpa: true,
  },
]

/** Custom attribute (conversa) derivado: paciente foi internado? */
export const VENDA_KEY = KEYS.venda
/** Custom attribute (contato, date) — data de nascimento do paciente. */
export const DATA_NASCIMENTO_KEY = KEYS.dataNascimento
/** Custom attribute (contato, checkbox) — derivado da data de nascimento (8–17 anos). */
export const KIDS_KEY = KEYS.kids
/** Custom attribute (conversa, list Sim/Não) — elegibilidade avaliada na conversa. */
export const ELEGIVEL_KEY = KEYS.elegivel
/** Custom attributes (conversa) — origem da conversa, associada ao paciente. */
export const HOSPITAL_ORIGEM_KEY = KEYS.hospitalOrigem
export const CONSULTOR_ORIGEM_KEY = KEYS.consultorOrigem

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

function simNao(v: boolean | null | undefined): string {
  return v === true ? 'Sim' : v === false ? 'Não' : ''
}

/**
 * Dashboard → Chatwoot: atributos do CONTATO a partir de uma triagem (slug→rótulo).
 * Chave presente com valor null/'' → manda '' (limpa no Chatwoot). Chave ausente → não toca.
 */
export function contactAttrsFromTriagem(t: Partial<Triagem>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const f of FIELD_MAPS) {
    if (f.level !== 'contact') continue
    if (!(f.triagemField in t)) continue
    const v = t[f.triagemField] as string | null | undefined
    if (v && f.slugToLabel[v]) out[f.chatwootKey] = f.slugToLabel[v]
    else if (v == null || v === '') out[f.chatwootKey] = ''
  }
  if ('estagio_funil' in t && t.estagio_funil === null) out[KEYS.estagio] = ETAPA_CONTATO_LABEL
  if ('data_nascimento' in t) {
    out[DATA_NASCIMENTO_KEY] =
      typeof t.data_nascimento === 'string' && t.data_nascimento ? t.data_nascimento.slice(0, 10) : ''
  }
  if ('kids' in t) out[KIDS_KEY] = t.kids === true
  return out
}

/** Dashboard → Chatwoot: atributos da CONVERSA (inclui `venda` derivado e `elegivel`). */
export function conversationAttrsFromTriagem(t: Partial<Triagem>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const f of FIELD_MAPS) {
    if (f.level !== 'conversation') continue
    if (!(f.triagemField in t)) continue
    const v = t[f.triagemField] as string | null | undefined
    if (v && f.slugToLabel[v]) out[f.chatwootKey] = f.slugToLabel[v]
    else if (v == null || v === '') out[f.chatwootKey] = ''
  }
  if ('estagio_funil' in t) {
    out[VENDA_KEY] = t.estagio_funil === 'internado' ? 'Sim' : 'Não'
  }
  if ('elegivel' in t) out[ELEGIVEL_KEY] = simNao(t.elegivel)
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
    if (!(f.chatwootKey in src)) continue
    const label = src[f.chatwootKey]
    if (label != null && label !== '') {
      const slug = slugPorRotulo(f.labelToSlug ?? reverse(f.slugToLabel), String(label))
      if (slug) (out as Record<string, unknown>)[f.triagemField] = slug
    } else if (f.vazioLimpa) {
      ;(out as Record<string, unknown>)[f.triagemField] = null
    }
  }
  // Etapa "Contato" no Chatwoot = sem estágio no banco (o atendente pode voltar o card pra lá).
  if (contactAttrs[KEYS.estagio] === ETAPA_CONTATO_LABEL) out.estagio_funil = null
  const dn = contactAttrs[DATA_NASCIMENTO_KEY]
  if (typeof dn === 'string' && /^\d{4}-\d{2}-\d{2}/.test(dn)) out.data_nascimento = dn.slice(0, 10)
  else if (dn === '' || dn === null) out.data_nascimento = null
  const el = convAttrs[ELEGIVEL_KEY]
  if (el === 'Sim') out.elegivel = true
  else if (el === 'Não') out.elegivel = false
  else if (el === '') out.elegivel = null
  return out
}

/**
 * Chatwoot → Dashboard: desfecho marcado na conversa. `venda = Sim` → Internação;
 * `motivo_de_perda` preenchido → Perdido (com o motivo). Devolve só o que precisa mudar
 * dado o estágio atual do lead — quem chama já comparou os demais campos.
 */
export function desfechoFromChatwoot(
  convAttrs: Record<string, unknown>,
  atual: { estagio_funil: string | null; motivo_perda: string | null }
): Partial<Triagem> {
  const out: Partial<Triagem> = {}
  const etapaAtual = etapaFromEstagio(atual.estagio_funil as Triagem['estagio_funil'])
  const venda = convAttrs[VENDA_KEY]
  const motivoLabel = convAttrs[KEYS.motivoPerda]
  const motivoSlug =
    motivoLabel != null && motivoLabel !== '' ? slugPorRotulo(motivoPerdaLabelToSlug, String(motivoLabel)) ?? null : null

  if (venda === 'Sim' && etapaAtual !== 'internacao') {
    out.estagio_funil = 'internado'
    out.motivo_perda = null
    return out
  }
  if (motivoSlug) {
    if (etapaAtual !== 'perdido') out.estagio_funil = ETAPA_TO_ESTAGIO.perdido
    if (atual.motivo_perda !== motivoSlug) out.motivo_perda = motivoSlug as Triagem['motivo_perda']
    return out
  }
  return out
}

// ============================================================
// Campos personalizados (dinâmicos) — valores em triagem_hsm.atributos
// ============================================================

/** Coerção do valor digitado/recebido para o tipo do campo. */
export function coerceCampoValor(campo: Pick<CampoPersonalizado, 'tipo' | 'opcoes'>, v: unknown): unknown {
  if (v === undefined) return undefined
  if (v === null || v === '') return null
  switch (campo.tipo) {
    case 'checkbox':
      if (typeof v === 'boolean') return v
      return ['true', '1', 'sim', 'yes'].includes(String(v).toLowerCase())
    case 'number': {
      const n = typeof v === 'number' ? v : Number(String(v).replace(',', '.'))
      return Number.isFinite(n) ? n : null
    }
    case 'date': {
      const s = String(v)
      return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : null
    }
    case 'list': {
      const s = String(v)
      return campo.opcoes.length === 0 || campo.opcoes.includes(s) ? s : null
    }
    default:
      return String(v)
  }
}

/** Chatwoot → Dashboard: só as chaves dos campos dinâmicos presentes no payload. */
export function atributosFromChatwoot(
  campos: CampoPersonalizado[],
  contactAttrs: Record<string, unknown> = {},
  convAttrs: Record<string, unknown> = {}
): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const c of campos) {
    const src = c.modelo === 'contact' ? contactAttrs : convAttrs
    if (!(c.chave in src)) continue
    out[c.chave] = coerceCampoValor(c, src[c.chave])
  }
  return out
}

/** Dashboard → Chatwoot: separa os valores dinâmicos por modelo (contato/conversa). */
export function chatwootAttrsFromAtributos(
  campos: CampoPersonalizado[],
  atributos: Record<string, unknown> | null | undefined
): { contact: Record<string, unknown>; conversation: Record<string, unknown> } {
  const out = { contact: {} as Record<string, unknown>, conversation: {} as Record<string, unknown> }
  if (!atributos) return out
  for (const c of campos) {
    if (!(c.chave in atributos)) continue
    const v = coerceCampoValor(c, atributos[c.chave])
    const alvo = c.modelo === 'contact' ? out.contact : out.conversation
    if (c.tipo === 'checkbox') alvo[c.chave] = v === true
    else alvo[c.chave] = v ?? ''
  }
  return out
}

/** Slug de tipo de contato aceito pelo banco (normaliza valores antigos). */
export function tipoContatoSlug(v: unknown): string | null {
  if (typeof v !== 'string' || !v) return null
  return TIPO_CONTATO_LEGADO[v] ?? null
}

/** Slug de motivo de perda atual (traduz os slugs antigos). */
export function motivoPerdaSlug(v: unknown): string | null {
  if (typeof v !== 'string' || !v) return null
  return MOTIVO_PERDA_LEGADO[v] ?? v
}
