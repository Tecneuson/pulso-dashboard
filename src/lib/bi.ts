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
export function porPerfil(leads: Triagem[]): { chave: string; label: string; count: number }[] {
  const counts = new Map<string, number>()
  for (const t of leads) counts.set(t.tipo_contato ?? 'nao_informado', (counts.get(t.tipo_contato ?? 'nao_informado') ?? 0) + 1)
  const out: { chave: string; label: string; count: number }[] = TIPO_CONTATO.map((tipo) => ({
    chave: tipo,
    label: TIPO_CONTATO_LABELS[tipo],
    count: counts.get(tipo) ?? 0,
  }))
  // valores legados que ainda não migraram
  for (const [k, v] of Array.from(counts.entries())) {
    if ((TIPO_CONTATO as readonly string[]).includes(k) || k === 'nao_informado') continue
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
