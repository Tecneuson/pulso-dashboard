import {
  CLASSIFICACAO_FUNIL,
  CLASSIFICACAO_INTERNADO,
  CLASSIFICACAO_LABELS,
  type ClassificacaoFunil,
  type TriagemLead,
} from '@/types'

/**
 * Funil unificado: metadados de exibição das colunas de classificação de
 * paciente que aparecem no Kanban após "Internado". A classificação vem
 * pronta do banco (CSV mensal) — as colunas são somente leitura.
 */

export interface ClassificacaoMeta {
  value: string
  label: string
  colorVar: string
  badgeClass: string
}

// Escala termômetro (do mais "frio"/saudável ao mais "quente"/grave):
// Internado (verde) → Churn < 1 ano (amarelo) → Churn (laranja) → Irregular (vermelho).
const META: Record<string, Omit<ClassificacaoMeta, 'value' | 'label'>> = {
  'Cliente Churn': {
    colorVar: 'var(--class-churn)',
    badgeClass: 'bg-orange-500/12 text-orange-700 dark:text-orange-400 border border-orange-500/25',
  },
  'Cliente Churn até 1 ano sem internação': {
    colorVar: 'var(--class-churn-recente)',
    badgeClass: 'bg-yellow-500/12 text-yellow-700 dark:text-yellow-400 border border-yellow-500/25',
  },
  'Cliente Irregular': {
    colorVar: 'var(--class-irregular)',
    badgeClass: 'bg-red-500/12 text-red-700 dark:text-red-400 border border-red-500/25',
  },
  [CLASSIFICACAO_INTERNADO]: {
    colorVar: 'var(--stage-confirmado)',
    badgeClass:
      'bg-success-500/12 text-success-700 dark:text-success-500 border border-success-500/25',
  },
}

const FALLBACK: Omit<ClassificacaoMeta, 'value' | 'label'> = {
  colorVar: 'var(--stage-novo)',
  badgeClass: 'bg-surface-tertiary text-content-secondary border border-border',
}

export function classificacaoMeta(value: string): ClassificacaoMeta {
  const meta = META[value] ?? FALLBACK
  return { value, label: CLASSIFICACAO_LABELS[value] ?? value, ...meta }
}

/** Colunas de classificação renderizadas após "Internado", na ordem do funil. */
export const COLUNAS_CLASSIFICACAO: ClassificacaoMeta[] = CLASSIFICACAO_FUNIL.map((c) =>
  classificacaoMeta(c)
)

export function isClassificacaoFunil(value: string): value is ClassificacaoFunil {
  return (CLASSIFICACAO_FUNIL as readonly string[]).includes(value)
}

export function formatDateBR(iso: string | null): string {
  if (!iso) return '—'
  const [y, m, d] = iso.slice(0, 10).split('-')
  if (!y || !m || !d) return '—'
  return `${d}/${m}/${y}`
}

/** Datas de internação conhecidas do paciente (CSV traz no máximo 3). */
export function internacoesConhecidas(p: {
  data_emissao_min: string | null
  data_emissao_max: string | null
  penultima_internacao: string | null
}): string[] {
  const datas = [p.data_emissao_min, p.penultima_internacao, p.data_emissao_max].filter(
    (d): d is string => !!d
  )
  return Array.from(new Set(datas)).sort()
}

// ============================================================
// Filtros do funil unificado
// ============================================================

export interface FiltrosFunil {
  /** Busca livre: nome, telefone, e-mail ou nº do paciente. */
  q: string
  /** Slug de operadora (vocabulário do paciente, convenio_normalizado). */
  convenio: string
  motivo: string
  assunto: string
  tipo: string
  /** '' | valor de origem_conversa (interhospitalar | consultor | ...). */
  origem: string
  /** '' | slug de motivo_perda (financeiro, sus, ...). */
  motivoPerda: string
  /** '' | valor exato de classificacao_cliente | 'sem_paciente'. */
  classificacao: string
  periodo: '' | 'hoje' | '7d' | '30d'
  /** Filtro por data (created_at), formato YYYY-MM-DD. */
  dataInicio: string
  dataFim: string
  urgencia: '' | 'urgente'
}

export const FILTROS_VAZIOS: FiltrosFunil = {
  q: '',
  convenio: '',
  motivo: '',
  assunto: '',
  tipo: '',
  origem: '',
  motivoPerda: '',
  classificacao: '',
  periodo: '',
  dataInicio: '',
  dataFim: '',
  urgencia: '',
}

export function contarFiltrosAtivos(f: FiltrosFunil): number {
  return Object.entries(f).filter(([k, v]) => k !== 'q' && v !== '').length + (f.q.trim() ? 1 : 0)
}

/**
 * Filtro de convênio unificado: `value` é o slug da operadora no lado do
 * paciente (convenio_normalizado); `leadSlugs` são os valores equivalentes de
 * triagem_hsm.plano_saude. Ordenado por volume real da base.
 */
export const CONVENIO_FILTRO: { value: string; label: string; leadSlugs: string[] }[] = [
  { value: 'sulamerica', label: 'SulAmérica', leadSlugs: ['sulamerica'] },
  { value: 'bradesco', label: 'Bradesco Saúde', leadSlugs: ['bradesco_saude'] },
  { value: 'amil', label: 'Amil', leadSlugs: ['amil'] },
  { value: 'gndi', label: 'GNDI / NotreDame', leadSlugs: ['notredame_intermedica'] },
  { value: 'particular', label: 'Particular', leadSlugs: ['particular'] },
  { value: 'prevent_senior', label: 'Prevent Sênior', leadSlugs: ['prevent_senior'] },
  { value: 'central_nacional', label: 'Central Nacional (CNU)', leadSlugs: ['central_nacional_unimed_cnu'] },
  { value: 'unimed', label: 'Unimed', leadSlugs: [] },
  { value: 'postal_saude', label: 'Postal Saúde', leadSlugs: ['postal_saude'] },
  { value: 'sompo', label: 'Sompo', leadSlugs: [] },
  { value: 'mediservice', label: 'MediService', leadSlugs: ['mediservice'] },
  { value: 'saude_caixa', label: 'Saúde Caixa', leadSlugs: ['saude_caixa'] },
  { value: 'alice', label: 'Alice', leadSlugs: ['alice'] },
  { value: 'omint', label: 'Omint', leadSlugs: ['omint_saude'] },
  { value: 'care_plus', label: 'Care Plus', leadSlugs: ['care_plus'] },
  { value: 'medsenior', label: 'MedSenior', leadSlugs: ['medsenior'] },
]

export const CLASSIFICACAO_FILTRO_OPTS = [
  ...[...CLASSIFICACAO_FUNIL, CLASSIFICACAO_INTERNADO].map((c) => ({
    value: c,
    label: CLASSIFICACAO_LABELS[c] ?? c,
  })),
  { value: 'sem_paciente', label: 'Sem paciente vinculado' },
]

export const PERIODO_OPTS = [
  { value: 'hoje', label: 'Hoje' },
  { value: '7d', label: 'Últimos 7 dias' },
  { value: '30d', label: 'Últimos 30 dias' },
]

function dentroDoPeriodo(iso: string, periodo: FiltrosFunil['periodo']): boolean {
  if (!periodo) return true
  const data = new Date(iso).getTime()
  const agora = new Date()
  if (periodo === 'hoje') {
    const inicio = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate()).getTime()
    return data >= inicio
  }
  const dias = periodo === '7d' ? 7 : 30
  return data >= agora.getTime() - dias * 24 * 3600 * 1000
}

/** Aplica os filtros a um lead do board (client-side, ≤500 linhas carregadas). */
export function leadPassaFiltros(t: TriagemLead, f: FiltrosFunil): boolean {
  const q = f.q.trim().toLowerCase()
  if (q) {
    const alvo = [
      t.contact_name,
      t.phone,
      t.email,
      t.paciente?.nome_cliente,
      t.paciente ? String(t.paciente.identificador_cliente) : null,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
    if (!alvo.includes(q)) return false
  }

  if (f.convenio) {
    const op = CONVENIO_FILTRO.find((c) => c.value === f.convenio)
    const bateLead = !!t.plano_saude && !!op && op.leadSlugs.includes(t.plano_saude)
    const bateParticular = f.convenio === 'particular' && t.forma_internacao === 'particular'
    if (!bateLead && !bateParticular) return false
  }

  if (f.motivo && t.motivo_contato !== f.motivo) return false
  if (f.assunto && t.assunto !== f.assunto) return false
  if (f.tipo && t.tipo_contato !== f.tipo) return false
  if (f.origem && t.origem_conversa !== f.origem) return false
  if (f.motivoPerda && t.motivo_perda !== f.motivoPerda) return false

  if (f.dataInicio || f.dataFim) {
    const dia = (t.created_at ?? '').slice(0, 10)
    if (f.dataInicio && dia < f.dataInicio) return false
    if (f.dataFim && dia > f.dataFim) return false
  }

  if (f.classificacao === 'sem_paciente') {
    if (t.paciente_id) return false
  } else if (f.classificacao) {
    if (t.paciente?.classificacao_cliente !== f.classificacao) return false
  }

  if (f.periodo && !dentroDoPeriodo(t.updated_at, f.periodo)) return false

  if (f.urgencia === 'urgente') {
    const obs = t.observacoes?.toLowerCase() ?? ''
    if (!obs.includes('urgente') && !obs.includes('crise')) return false
  }

  return true
}
