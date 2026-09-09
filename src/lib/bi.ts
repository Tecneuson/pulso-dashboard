import type { Triagem } from '@/types'
import {
  CATEGORIA_CONTATO,
  CATEGORIA_CONTATO_LABELS,
  MOTIVO_PERDA_LABELS,
  TIPO_CONTATO,
  TIPO_CONTATO_LABELS,
  categoriaDoTipo,
} from '@/types'
import { etapaFromEstagio, FUNIL_ETAPA_LABELS, ORIGEM_CONVERSA, ORIGEM_CONVERSA_LABELS } from './funil-etapas'
import { PLANO_LABELS } from './chatwoot/mapping'

/**
 * Cálculos do BI (página Relatórios). Tudo em memória sobre os leads já filtrados por
 * período/atendente no servidor. Definições:
 *  - Contatos: pessoas distintas (contato do Chatwoot → telefone → lead)
 *  - Conversas: leads com conversa no Chatwoot
 *  - Internações: leads na etapa Internação
 *  - Perdas: leads na etapa Perdido (ou com motivo de perda)
 */

export interface Contagem {
  contatos: number
  conversas: number
  internacoes: number
  perdas: number
}

function chavePessoa(t: Triagem): string {
  if (t.chatwoot_contact_id) return `c:${t.chatwoot_contact_id}`
  const dig = (t.phone ?? '').replace(/\D/g, '')
  if (dig.length >= 8) return `p:${dig.slice(-11)}`
  return `t:${t.id}`
}

export function ehInternacao(t: Triagem): boolean {
  return etapaFromEstagio(t.estagio_funil) === 'internacao'
}
export function ehPerda(t: Triagem): boolean {
  return etapaFromEstagio(t.estagio_funil) === 'perdido' || !!t.motivo_perda
}

export function contar(leads: Triagem[]): Contagem {
  const pessoas = new Set<string>()
  let conversas = 0
  let internacoes = 0
  let perdas = 0
  for (const t of leads) {
    pessoas.add(chavePessoa(t))
    if (t.conversation_id) conversas++
    if (ehInternacao(t)) internacoes++
    if (ehPerda(t)) perdas++
  }
  return { contatos: pessoas.size, conversas, internacoes, perdas }
}

export function taxaConversao(c: Contagem): number {
  return c.contatos > 0 ? Math.round((c.internacoes / c.contatos) * 1000) / 10 : 0
}

export interface Linha extends Contagem {
  chave: string
  label: string
  taxa: number
  motivos?: { label: string; count: number }[]
}

function linha(chave: string, label: string, leads: Triagem[], comMotivos = false): Linha {
  const c = contar(leads)
  const l: Linha = { chave, label, ...c, taxa: taxaConversao(c) }
  if (comMotivos) l.motivos = motivosDePerda(leads).map(({ label, count }) => ({ label, count }))
  return l
}

// ---------- motivos de perda ----------
export function motivosDePerda(leads: Triagem[]): { slug: string; label: string; count: number }[] {
  const counts = new Map<string, number>()
  for (const t of leads) {
    if (!t.motivo_perda) continue
    counts.set(t.motivo_perda, (counts.get(t.motivo_perda) ?? 0) + 1)
  }
  return Array.from(counts.entries())
    .map(([slug, count]) => ({ slug, label: MOTIVO_PERDA_LABELS[slug] ?? slug, count }))
    .sort((a, b) => b.count - a.count)
}

// ---------- origens ----------
export function porOrigem(leads: Triagem[]): Linha[] {
  const ordem: string[] = ['interhospitalar', 'consultor', 'residencia', 'profissional_saude']
  const out: Linha[] = []
  for (const o of ordem) {
    if (!(ORIGEM_CONVERSA as readonly string[]).includes(o)) continue
    const subset = leads.filter((t) => t.origem_conversa === o)
    out.push(linha(o, ORIGEM_CONVERSA_LABELS[o as keyof typeof ORIGEM_CONVERSA_LABELS], subset, true))
  }
  const semOrigem = leads.filter((t) => !t.origem_conversa)
  if (semOrigem.length) out.push(linha('sem_origem', 'Sem origem informada', semOrigem, true))
  return out
}

// ---------- forma de internação ----------
export interface FormaInternacaoBI {
  particular: Linha
  planos: Linha[]
  semPlano: Linha
}

export function porFormaInternacao(leads: Triagem[]): FormaInternacaoBI {
  const particular = leads.filter((t) => t.forma_internacao === 'particular' || t.plano_saude === 'particular')
  const porPlano = new Map<string, Triagem[]>()
  const semPlano: Triagem[] = []
  for (const t of leads) {
    if (particular.includes(t)) continue
    if (t.plano_saude && t.plano_saude !== 'nao_possui') {
      porPlano.set(t.plano_saude, [...(porPlano.get(t.plano_saude) ?? []), t])
    } else {
      semPlano.push(t)
    }
  }
  const planos = Array.from(porPlano.entries())
    .map(([slug, subset]) => linha(slug, PLANO_LABELS[slug] ?? slug, subset, true))
    .sort((a, b) => b.contatos - a.contatos)
  return {
    particular: linha('particular', 'Particular', particular, true),
    planos,
    semPlano: linha('sem_plano', 'Sem plano informado / não sabe', semPlano, true),
  }
}

// ---------- pipeline ----------
export interface EtapaPipeline {
  chave: string
  label: string
  count: number
}

export function pipeline(leads: Triagem[]): EtapaPipeline[] {
  const etapas = ['contato', 'atendendo', 'negociando', 'elegivel', 'internacao'] as const
  return etapas.map((e) => ({
    chave: e,
    label: FUNIL_ETAPA_LABELS[e],
    count: leads.filter((t) => etapaFromEstagio(t.estagio_funil) === e).length,
  }))
}

// ---------- perfil ----------
export function porPerfil(
  leads: Triagem[],
  perfis?: { slug: string; label: string }[]
): { chave: string; label: string; count: number }[] {
  const counts = new Map<string, number>()
  for (const t of leads) counts.set(t.tipo_contato ?? 'nao_informado', (counts.get(t.tipo_contato ?? 'nao_informado') ?? 0) + 1)
  // Sem a lista cadastrada (migration pendente) cai nos 5 perfis fixos do código.
  const base = perfis?.length ? perfis : TIPO_CONTATO.map((t) => ({ slug: t, label: TIPO_CONTATO_LABELS[t] }))
  const conhecidos = new Set(base.map((b) => b.slug))
  const out: { chave: string; label: string; count: number }[] = base.map((b) => ({
    chave: b.slug,
    label: b.label,
    count: counts.get(b.slug) ?? 0,
  }))
  // valores legados que ainda não migraram
  for (const [k, v] of Array.from(counts.entries())) {
    if (conhecidos.has(k) || k === 'nao_informado') continue
    out.push({ chave: k, label: `${k} (legado)`, count: v })
  }
  if (counts.get('nao_informado')) out.push({ chave: 'nao_informado', label: 'Não informado', count: counts.get('nao_informado')! })
  return out
}

export function porCategoria(leads: Triagem[]): { chave: string; label: string; count: number }[] {
  const counts = new Map<string, number>()
  for (const t of leads) {
    const c = categoriaDoTipo(t.tipo_contato) ?? 'nao_informado'
    counts.set(c, (counts.get(c) ?? 0) + 1)
  }
  return [
    ...CATEGORIA_CONTATO.map((c) => ({ chave: c, label: CATEGORIA_CONTATO_LABELS[c], count: counts.get(c) ?? 0 })),
    ...(counts.get('nao_informado') ? [{ chave: 'nao_informado', label: 'Não informado', count: counts.get('nao_informado')! }] : []),
  ]
}

// ---------- status das conversas (visão do Chatwoot) ----------
export const STATUS_CHATWOOT_LABELS: Record<string, string> = {
  open: 'Abertas',
  pending: 'Pendentes',
  snoozed: 'Adiadas',
  resolved: 'Resolvidas',
}

export function statusConversas(leads: Triagem[]): { chave: string; label: string; count: number }[] {
  const counts = new Map<string, number>()
  for (const t of leads) {
    if (!t.conversation_id) continue
    const s = t.chatwoot_status ?? 'desconhecido'
    counts.set(s, (counts.get(s) ?? 0) + 1)
  }
  const ordem = ['open', 'pending', 'snoozed', 'resolved', 'desconhecido']
  return ordem
    .filter((s) => counts.has(s))
    .map((s) => ({ chave: s, label: STATUS_CHATWOOT_LABELS[s] ?? 'Sem status (webhook ainda não atualizou)', count: counts.get(s)! }))
}

// ---------- filtros (querystring) ----------
export interface FiltrosBI {
  de: string
  ate: string
  atendente: string
  preset: string
}

function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Resolve os filtros a partir da querystring (presets viram datas concretas). */
export function resolverFiltros(sp: Record<string, string | undefined>): FiltrosBI {
  const hoje = new Date()
  const preset = sp.preset ?? ''
  let de = /^\d{4}-\d{2}-\d{2}$/.test(sp.de ?? '') ? (sp.de as string) : ''
  let ate = /^\d{4}-\d{2}-\d{2}$/.test(sp.ate ?? '') ? (sp.ate as string) : ''
  if (preset === 'hoje') de = ate = iso(hoje)
  else if (preset === '7d') {
    const d = new Date(hoje); d.setDate(d.getDate() - 6); de = iso(d); ate = iso(hoje)
  } else if (preset === '30d') {
    const d = new Date(hoje); d.setDate(d.getDate() - 29); de = iso(d); ate = iso(hoje)
  } else if (preset === 'mes') {
    de = iso(new Date(hoje.getFullYear(), hoje.getMonth(), 1)); ate = iso(hoje)
  } else if (preset === 'tudo') {
    de = ''; ate = ''
  }
  const atendente = /^[0-9a-f-]{36}$/i.test(sp.atendente ?? '') ? (sp.atendente as string) : ''
  return { de, ate, atendente, preset }
}

// =============================================================================
// Performance por dimensão (Consultor · Atendente · Convênio) e cruzamentos.
//
// O hospital quer ler o total do grupo e, dentro dele, o detalhe por pessoa:
// "Consultores: 20 internações" e, abaixo, Rafael 10 e Arthur 10.
//
// Por isso tudo aqui devolve `Linha` (as mesmas colunas da tabela de origens), e o
// total do grupo é uma `Linha` calculada sobre a união — não a soma das partes,
// senão um lead sem consultor sumiria da conta.
// =============================================================================

const SEM_ATRIBUICAO = 'sem_atribuicao'

/** Agrupa por uma chave do lead, com um dicionário chave → nome. */
function porChave(
  leads: Triagem[],
  chaveDe: (t: Triagem) => string | null | undefined,
  nomeDe: (chave: string) => string,
  rotuloVazio: string | null
): Linha[] {
  const grupos = new Map<string, Triagem[]>()
  const vazios: Triagem[] = []
  for (const t of leads) {
    const k = chaveDe(t)
    if (!k) {
      vazios.push(t)
      continue
    }
    const atual = grupos.get(k)
    if (atual) atual.push(t)
    else grupos.set(k, [t])
  }
  const out = Array.from(grupos.entries())
    .map(([k, subset]) => linha(k, nomeDe(k), subset, true))
    .sort((a, b) => b.internacoes - a.internacoes || b.contatos - a.contatos)
  if (rotuloVazio && vazios.length) out.push(linha(SEM_ATRIBUICAO, rotuloVazio, vazios, true))
  return out
}

/** Performance de cada consultor. `nomes` vem da tabela `consultores`. */
export function porConsultor(leads: Triagem[], nomes: Map<string, string>): Linha[] {
  return porChave(leads, (t) => t.consultor_id, (k) => nomes.get(k) ?? 'Consultor removido', 'Sem consultor')
}

/** Performance de cada agente do comercial. `nomes` vem da tabela `usuarios`. */
export function porAtendente(leads: Triagem[], nomes: Map<string, string>): Linha[] {
  return porChave(leads, (t) => t.atendente_id, (k) => nomes.get(k) ?? 'Usuário removido', 'Sem atendente')
}

/** Performance por convênio. Particular entra como uma linha própria. */
export function porConvenio(leads: Triagem[]): Linha[] {
  return porChave(
    leads,
    (t) => (t.forma_internacao === 'particular' ? 'particular' : t.plano_saude || null),
    (k) => (k === 'particular' ? 'Particular' : PLANO_LABELS[k] ?? k),
    'Sem convênio informado'
  )
}

/** O conjunto inteiro como uma `Linha` — serve de rodapé das tabelas. */
export function totalLinha(leads: Triagem[], label = 'Total'): Linha {
  return linha('__total__', label, leads, true)
}

export interface GrupoPerformance {
  chave: string
  label: string
  total: Linha
  itens: Linha[]
}

/**
 * Performance por GRUPO de contato (Paciente / Responsável / Consultor), com os
 * perfis de cada grupo detalhados dentro. `grupoDe` e `labelPerfil` vêm de
 * `lib/categorias`, para respeitar os perfis que o administrador cadastrou.
 */
export function porGrupoContato(
  leads: Triagem[],
  grupoDe: (slug: string | null | undefined) => string | null,
  labelPerfil: (slug: string) => string
): GrupoPerformance[] {
  const mapa = new Map<string, Triagem[]>()
  for (const t of leads) {
    const g = grupoDe(t.tipo_contato) ?? 'nao_informado'
    const atual = mapa.get(g)
    if (atual) atual.push(t)
    else mapa.set(g, [t])
  }
  const ordem: string[] = [...CATEGORIA_CONTATO, 'nao_informado']
  return ordem
    .filter((g) => mapa.has(g))
    .map((g) => {
      const subset = mapa.get(g)!
      return {
        chave: g,
        label:
          g === 'nao_informado'
            ? 'Não informado'
            : CATEGORIA_CONTATO_LABELS[g as keyof typeof CATEGORIA_CONTATO_LABELS],
        total: linha(g, 'Total do grupo', subset, true),
        itens: porChave(subset, (t) => t.tipo_contato, (k) => labelPerfil(k), null),
      }
    })
}

// ---------- cruzamento de duas dimensões ----------

export interface DimensaoSpec {
  chave: string
  label: string
  valor: (t: Triagem) => { chave: string; label: string } | null
}

export interface ContextoDimensoes {
  consultores: Map<string, string>
  atendentes: Map<string, string>
  labelPerfil: (slug: string) => string
}

/**
 * As dimensões que podem ser cruzadas. `valor` devolve null quando o lead não
 * pertence à dimensão — assim uma linha "não informado" só aparece se houver caso.
 */
export function dimensoesDisponiveis(ctx: ContextoDimensoes): DimensaoSpec[] {
  return [
    {
      chave: 'motivo_perda',
      label: 'Motivo de perda',
      valor: (t) =>
        t.motivo_perda ? { chave: t.motivo_perda, label: MOTIVO_PERDA_LABELS[t.motivo_perda] ?? t.motivo_perda } : null,
    },
    {
      chave: 'convenio',
      label: 'Convênio',
      valor: (t) =>
        t.forma_internacao === 'particular'
          ? { chave: 'particular', label: 'Particular' }
          : t.plano_saude
            ? { chave: t.plano_saude, label: PLANO_LABELS[t.plano_saude] ?? t.plano_saude }
            : null,
    },
    {
      chave: 'consultor',
      label: 'Consultor',
      valor: (t) =>
        t.consultor_id ? { chave: t.consultor_id, label: ctx.consultores.get(t.consultor_id) ?? 'Consultor removido' } : null,
    },
    {
      chave: 'atendente',
      label: 'Agente de atendimento',
      valor: (t) =>
        t.atendente_id ? { chave: t.atendente_id, label: ctx.atendentes.get(t.atendente_id) ?? 'Usuário removido' } : null,
    },
    {
      chave: 'perfil',
      label: 'Perfil do contato',
      valor: (t) => (t.tipo_contato ? { chave: t.tipo_contato, label: ctx.labelPerfil(t.tipo_contato) } : null),
    },
    {
      chave: 'origem',
      label: 'Origem da conversa',
      valor: (t) =>
        t.origem_conversa
          ? {
              chave: t.origem_conversa,
              label:
                ORIGEM_CONVERSA_LABELS[t.origem_conversa as keyof typeof ORIGEM_CONVERSA_LABELS] ?? t.origem_conversa,
            }
          : null,
    },
    {
      chave: 'etapa',
      label: 'Etapa do funil',
      valor: (t) => {
        const e = etapaFromEstagio(t.estagio_funil)
        return e ? { chave: e, label: FUNIL_ETAPA_LABELS[e] } : null
      },
    },
  ]
}

export interface Cruzamento {
  colunas: { chave: string; label: string; total: number }[]
  linhas: { chave: string; label: string; celulas: number[]; total: number }[]
  total: number
}

/**
 * Matriz de contagens entre duas dimensões (ex.: Motivo de perda x Convênio).
 * Leads que não pertencem a alguma das duas ficam de fora: cruzar "motivo de perda"
 * com qualquer coisa só faz sentido sobre quem tem motivo de perda.
 */
export function cruzar(leads: Triagem[], dimLinha: DimensaoSpec, dimColuna: DimensaoSpec): Cruzamento {
  const rotulosLinha = new Map<string, string>()
  const rotulosColuna = new Map<string, string>()
  const celulas = new Map<string, number>()

  for (const t of leads) {
    const a = dimLinha.valor(t)
    const b = dimColuna.valor(t)
    if (!a || !b) continue
    rotulosLinha.set(a.chave, a.label)
    rotulosColuna.set(b.chave, b.label)
    const k = `${a.chave} ${b.chave}`
    celulas.set(k, (celulas.get(k) ?? 0) + 1)
  }

  const colunas = Array.from(rotulosColuna.entries()).map(([chave, label]) => ({
    chave,
    label,
    total: Array.from(rotulosLinha.keys()).reduce((s, lk) => s + (celulas.get(`${lk} ${chave}`) ?? 0), 0),
  }))
  colunas.sort((a, b) => b.total - a.total)

  const linhas = Array.from(rotulosLinha.entries())
    .map(([chave, label]) => {
      const vals = colunas.map((c) => celulas.get(`${chave} ${c.chave}`) ?? 0)
      return { chave, label, celulas: vals, total: vals.reduce((s, n) => s + n, 0) }
    })
    .sort((a, b) => b.total - a.total)

  return { colunas, linhas, total: linhas.reduce((s, l) => s + l.total, 0) }
}
