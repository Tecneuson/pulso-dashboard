import {
  FUNIL_ETAPA_OPTIONS,
  ORIGEM_CONVERSA_OPTIONS,
  ORIGEM_PROFISSIONAL_OPTIONS,
  type LeadComEtapa,
} from '@/lib/funil-etapas'
import { CONVENIO_FILTRO, CLASSIFICACAO_FILTRO_OPTS } from '@/lib/funil'
import { FIELD_OPTIONS } from '@/lib/chatwoot/mapping'
import type { SituacaoAgendamento } from '@/lib/agendamentos'

/**
 * Sistema de filtros do funil (100% client-side). Multi-seleção por dimensão,
 * contagens facetadas e visões salvas — tudo sobre os leads já em memória.
 */

export type OrdenacaoFunil = 'recentes' | 'antigos' | 'nome' | 'proximo_contato'

export const ORDENACAO_OPTS: { value: OrdenacaoFunil; label: string }[] = [
  { value: 'recentes', label: 'Mais recentes' },
  { value: 'antigos', label: 'Mais antigos' },
  { value: 'nome', label: 'Nome (A–Z)' },
  { value: 'proximo_contato', label: 'Próximo contato' },
]

export interface FiltrosState {
  q: string
  etapas: string[]
  convenios: string[]
  motivos: string[]
  assuntos: string[]
  tipos: string[]
  origens: string[]
  captadores: string[]
  consultores: string[]
  hospitais: string[]
  profissionais: string[]
  motivosPerda: string[]
  classificacoes: string[]
  /** Agente de atendimento (usuarios.id em triagem_hsm.atendente_id). */
  atendentes: string[]
  datePreset: '' | 'hoje' | '7d' | '30d' | 'semana' | 'mes' | 'custom'
  dataInicio: string
  dataFim: string
  urgencia: '' | 'sim' | 'nao'
  fonte: '' | 'manual' | 'banco'
  /** Situação do próximo contato — '' = todos. */
  agendado: '' | 'indefinido' | 'em_conformidade' | 'atrasado'
  ordenar: OrdenacaoFunil
}

export const FILTROS_INICIAL: FiltrosState = {
  q: '',
  etapas: [],
  convenios: [],
  motivos: [],
  assuntos: [],
  tipos: [],
  origens: [],
  captadores: [],
  consultores: [],
  hospitais: [],
  profissionais: [],
  motivosPerda: [],
  classificacoes: [],
  atendentes: [],
  datePreset: '',
  dataInicio: '',
  dataFim: '',
  urgencia: '',
  fonte: '',
  agendado: '',
  ordenar: 'recentes',
}

/** Dimensões multi-seleção (arrays) — usado para contar filtros ativos e facetar. */
export const DIMENSOES_ARRAY: (keyof FiltrosState)[] = [
  'etapas',
  'convenios',
  'motivos',
  'assuntos',
  'tipos',
  'origens',
  'captadores',
  'consultores',
  'hospitais',
  'profissionais',
  'motivosPerda',
  'classificacoes',
  'atendentes',
]

/** Nº de dimensões ativas (para o badge do botão "Filtros"). */
export function contarDimensoesAtivas(f: FiltrosState): number {
  let n = 0
  for (const k of DIMENSOES_ARRAY) if ((f[k] as string[]).length > 0) n++
  if (f.q.trim()) n++
  if (f.datePreset) n++
  if (f.urgencia) n++
  if (f.fonte) n++
  if (f.agendado) n++
  return n
}

export function temFiltroAtivo(f: FiltrosState): boolean {
  return contarDimensoesAtivas(f) > 0
}

// ------------------------------------------------------------
// Convênio: casa o slug do plano do lead com os valores de operadora
// ------------------------------------------------------------
function leadCasaConvenio(l: LeadComEtapa, value: string): boolean {
  const op = CONVENIO_FILTRO.find((c) => c.value === value)
  const bateLead = !!l.plano_saude && !!op && op.leadSlugs.includes(l.plano_saude)
  const bateParticular = value === 'particular' && l.forma_internacao === 'particular'
  return bateLead || bateParticular
}

function leadCasaClassificacao(l: LeadComEtapa, value: string): boolean {
  if (value === 'sem_paciente') return !l.paciente_id
  return l.paciente?.classificacao_cliente === value
}

/** Data de calendário LOCAL de um instante ISO (YYYY-MM-DD no fuso do navegador). */
function diaLocal(iso: string): string {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`
}

function dentroDaData(l: LeadComEtapa, f: FiltrosState): boolean {
  if (!f.datePreset) return true
  if (!l.created_at) return false
  const t = new Date(l.created_at).getTime()
  if (Number.isNaN(t)) return false

  // Personalizado: compara pela data de calendário LOCAL do lead (os inputs de
  // data também são datas locais), evitando descasar por fuso.
  if (f.datePreset === 'custom') {
    const dia = diaLocal(l.created_at)
    if (f.dataInicio && dia < f.dataInicio) return false
    if (f.dataFim && dia > f.dataFim) return false
    return true
  }

  // Presets: compara INSTANTES ancorados na meia-noite local (correto em qualquer fuso).
  const agora = new Date()
  const inicioHoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate()).getTime()
  if (f.datePreset === 'hoje') return t >= inicioHoje

  // "Esta semana" = domingo desta semana até agora. "Mês atual" = dia 1º até agora.
  if (f.datePreset === 'semana') {
    const inicioSemana = inicioHoje - agora.getDay() * 24 * 3600 * 1000
    return t >= inicioSemana
  }
  if (f.datePreset === 'mes') {
    return t >= new Date(agora.getFullYear(), agora.getMonth(), 1).getTime()
  }

  // "Últimos N dias" = hoje + (N-1) dias anteriores (janela por datas de calendário).
  const dias = f.datePreset === '7d' ? 7 : 30
  return t >= inicioHoje - (dias - 1) * 24 * 3600 * 1000
}

function ehUrgente(l: LeadComEtapa): boolean {
  const obs = l.observacoes?.toLowerCase() ?? ''
  return obs.includes('urgente') || obs.includes('crise')
}

/**
 * Predicado principal. `skip` permite ignorar dimensões (usado nas contagens
 * facetadas). Dentro de cada dimensão multi, a lógica é OR; entre dimensões, AND.
 */
export function leadPassa(
  l: LeadComEtapa,
  f: FiltrosState,
  skip?: Set<keyof FiltrosState>,
  ctx?: FiltroContexto
): boolean {
  const on = (k: keyof FiltrosState) => !skip?.has(k)

  if (on('q') && f.q.trim()) {
    const q = f.q.trim().toLowerCase()
    const alvo = [
      l.contact_name,
      l.phone,
      l.email,
      l.paciente?.nome_cliente,
      l.paciente ? String(l.paciente.identificador_cliente) : null,
      l.numero_paciente,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
    if (!alvo.includes(q)) return false
  }

  if (on('etapas') && f.etapas.length && !f.etapas.includes(l.etapa)) return false
  if (on('convenios') && f.convenios.length && !f.convenios.some((v) => leadCasaConvenio(l, v)))
    return false
  if (on('motivos') && f.motivos.length && !(l.motivo_contato && f.motivos.includes(l.motivo_contato)))
    return false
  if (on('assuntos') && f.assuntos.length && !(l.assunto && f.assuntos.includes(l.assunto)))
    return false
  if (on('tipos') && f.tipos.length && !(l.tipo_contato && f.tipos.includes(l.tipo_contato)))
    return false
  if (on('origens') && f.origens.length && !(l.origem_conversa && f.origens.includes(l.origem_conversa)))
    return false
  if (on('captadores') && f.captadores.length && !(l.captador_id && f.captadores.includes(l.captador_id)))
    return false
  if (
    on('atendentes') &&
    f.atendentes.length &&
    !(l.atendente_id && f.atendentes.includes(l.atendente_id))
  )
    return false

  // Consultor / Hospital / Tipo de profissional são facetas da MESMA origem (o lead
  // tem só uma), então combinam em OR entre si — senão selecionar duas zeraria tudo.
  {
    const selConsultor = on('consultores') ? f.consultores : []
    const selHospital = on('hospitais') ? f.hospitais : []
    const selProf = on('profissionais') ? f.profissionais : []
    if (selConsultor.length || selHospital.length || selProf.length) {
      const casa =
        (!!l.origem_consultor_id && selConsultor.includes(l.origem_consultor_id)) ||
        (!!l.origem_hospital_id && selHospital.includes(l.origem_hospital_id)) ||
        (!!l.origem_profissional_tipo && selProf.includes(l.origem_profissional_tipo))
      if (!casa) return false
    }
  }

  if (
    on('motivosPerda') &&
    f.motivosPerda.length &&
    !(l.motivo_perda && f.motivosPerda.includes(l.motivo_perda))
  )
    return false
  if (
    on('classificacoes') &&
    f.classificacoes.length &&
    !f.classificacoes.some((v) => leadCasaClassificacao(l, v))
  )
    return false

  if (on('datePreset') && !dentroDaData(l, f)) return false

  if (on('urgencia') && f.urgencia) {
    const u = ehUrgente(l)
    if (f.urgencia === 'sim' && !u) return false
    if (f.urgencia === 'nao' && u) return false
  }

  if (on('fonte') && f.fonte) {
    const manual = !l.conversation_id // sem conversa no Chatwoot = criado manualmente
    if (f.fonte === 'manual' && !manual) return false
    if (f.fonte === 'banco' && manual) return false
  }

  // "Agendados": situação do próximo contato (depende dos agendamentos carregados).
  if (on('agendado') && f.agendado) {
    const situacao = ctx?.situacao?.(l.id) ?? 'indefinido'
    if (situacao !== f.agendado) return false
  }

  return true
}

/**
 * Dados externos usados por filtros/ordenação que não vivem no lead (hoje só a
 * situação do próximo contato, que vem da tabela `agendamentos`).
 */
export interface FiltroContexto {
  situacao?: (leadId: string) => SituacaoAgendamento
  /** Data (YYYY-MM-DD) do próximo contato pendente do lead. */
  proximaData?: (leadId: string) => string | null
}

export function filtrarLeads(
  leads: LeadComEtapa[],
  f: FiltrosState,
  ctx?: FiltroContexto
): LeadComEtapa[] {
  return leads.filter((l) => leadPassa(l, f, undefined, ctx))
}

/** Ordenação das colunas do funil (dimensão "Ordenar" do header). */
export function ordenarLeads(
  leads: LeadComEtapa[],
  ordenar: OrdenacaoFunil,
  ctx?: FiltroContexto
): LeadComEtapa[] {
  const out = [...leads]
  switch (ordenar) {
    case 'antigos':
      return out.sort((a, b) => (a.created_at ?? '').localeCompare(b.created_at ?? ''))
    case 'nome':
      return out.sort((a, b) =>
        (a.contact_name ?? '').localeCompare(b.contact_name ?? '', 'pt-BR')
      )
    case 'proximo_contato':
      // Quem tem lembrete marcado vem primeiro, do mais antigo (mais atrasado) ao mais novo.
      return out.sort((a, b) => {
        const da = ctx?.proximaData?.(a.id) ?? ''
        const db = ctx?.proximaData?.(b.id) ?? ''
        if (!da && !db) return (b.updated_at ?? '').localeCompare(a.updated_at ?? '')
        if (!da) return 1
        if (!db) return -1
        return da.localeCompare(db)
      })
    default:
      return out.sort((a, b) => (b.updated_at ?? '').localeCompare(a.updated_at ?? ''))
  }
}

/**
 * Contagem facetada: quantos leads apareceriam se, além dos filtros das OUTRAS
 * dimensões, a dimensão `dim` fosse exatamente `[value]`. Ignora a seleção atual
 * de `dim` (padrão de facet). Barato em ≤500 leads.
 */
export function contarOpcao(
  leads: LeadComEtapa[],
  f: FiltrosState,
  dim: keyof FiltrosState,
  value: string
): number {
  // Faceta ao substituir a própria dimensão por [value]. Para consultor/hospital/
  // profissional (grupo OR sobre a origem), zera as irmãs para não colapsar a contagem.
  const grupoOrigem: (keyof FiltrosState)[] = ['consultores', 'hospitais', 'profissionais']
  const teste = grupoOrigem.includes(dim)
    ? ({ ...f, consultores: [], hospitais: [], profissionais: [], [dim]: [value] } as FiltrosState)
    : ({ ...f, [dim]: [value] } as FiltrosState)
  return leads.reduce((n, l) => (leadPassa(l, teste) ? n + 1 : n), 0)
}

// ------------------------------------------------------------
// Opções estáticas por dimensão
// ------------------------------------------------------------
export const OPCOES = {
  etapas: FUNIL_ETAPA_OPTIONS,
  convenios: CONVENIO_FILTRO.map(({ value, label }) => ({ value, label })),
  motivos: [
    { value: 'transtorno_mental_adulto', label: 'TM adulto' },
    { value: 'transtorno_mental_infantojuvenil', label: 'TM infantojuvenil' },
    { value: 'abuso_de_substancias', label: 'Abuso de substâncias' },
  ],
  assuntos: FIELD_OPTIONS.assunto ?? [],
  tipos: FIELD_OPTIONS.tipo_contato ?? [],
  origens: ORIGEM_CONVERSA_OPTIONS,
  profissionais: ORIGEM_PROFISSIONAL_OPTIONS,
  motivosPerda: FIELD_OPTIONS.motivo_perda ?? [],
  classificacoes: CLASSIFICACAO_FILTRO_OPTS,
}

/** Períodos do painel "Filtros" (o print pede Esta semana / Mês atual em destaque). */
export const PERIODO_OPTS: { value: FiltrosState['datePreset']; label: string }[] = [
  { value: 'hoje', label: 'Hoje' },
  { value: 'semana', label: 'Esta semana' },
  { value: 'mes', label: 'Mês atual' },
  { value: '7d', label: '7 dias' },
  { value: '30d', label: '30 dias' },
  { value: 'custom', label: 'Personalizado' },
]
