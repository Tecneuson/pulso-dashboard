'use client'

import { useMemo, useSyncExternalStore } from 'react'
import type { Agendamento, CampoPersonalizado, Captador, Consultor, Hospital, Responsavel } from '@/types'
import { chaveAlvo, situacaoAgendamento, type SituacaoAgendamento } from '@/lib/agendamentos'
import type { CategoriaContatoRow } from '@/lib/categorias'
import { TIPO_CONTATO_LABELS } from '@/types'

/**
 * Coleções pequenas servidas por API (consultores, hospitais) com cache reativo
 * compartilhado entre componentes. Substitui o antigo store de localStorage — agora
 * os cadastros são persistidos no banco e vistos por toda a equipe.
 */

const EMPTY: unknown[] = []

class ApiCollection<T extends { id: string }> {
  private cache: T[] = []
  private loaded = false
  private loading = false
  private readonly listeners = new Set<() => void>()

  /** `listQuery` só entra no GET — POST/PATCH/DELETE continuam na URL limpa. */
  constructor(private readonly url: string, private readonly listQuery = '') {}

  readonly subscribe = (l: () => void): (() => void) => {
    this.listeners.add(l)
    if (!this.loaded && !this.loading) void this.load()
    return () => {
      this.listeners.delete(l)
    }
  }

  readonly getSnapshot = (): T[] => this.cache
  readonly getServerSnapshot = (): T[] => EMPTY as T[]

  private emit() {
    this.listeners.forEach((l) => l())
  }

  async load(): Promise<void> {
    this.loading = true
    try {
      const res = await fetch(`${this.url}${this.listQuery}`)
      if (!res.ok) return // não marca loaded → permite retry numa próxima montagem
      const data = await res.json()
      if (Array.isArray(data.rows)) this.cache = data.rows as T[]
      this.loaded = true
    } catch {
      /* mantém cache anterior; loaded continua false → permite retry */
    } finally {
      this.loading = false
      this.emit()
    }
  }

  /** Última falha de escrita — a UI mostra em vez de "não aconteceu nada". */
  private lastError: string | null = null
  readonly getError = (): string | null => this.lastError

  readonly add = async (body: Record<string, unknown>): Promise<T | null> => {
    try {
      const res = await fetch(this.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || `falha ao salvar (HTTP ${res.status})`)
      this.lastError = null
      await this.load()
      return (data.row ?? null) as T | null
    } catch (e) {
      this.lastError = e instanceof Error ? e.message : 'falha ao salvar'
      this.emit()
      return null
    }
  }

  readonly update = async (id: string, body: Record<string, unknown>): Promise<void> => {
    try {
      await fetch(this.url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...body }),
      })
      await this.load()
    } catch {
      /* ignore */
    }
  }

  readonly remove = async (id: string): Promise<void> => {
    try {
      await fetch(`${this.url}?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
      await this.load()
    } catch {
      /* ignore */
    }
  }
}

const consultoresCol = new ApiCollection<Consultor>('/api/consultores')
const hospitaisCol = new ApiCollection<Hospital>('/api/hospitais')
const captadoresCol = new ApiCollection<Captador>('/api/captadores')
const usuariosCol = new ApiCollection<UsuarioResumo>('/api/usuarios')
const camposCol = new ApiCollection<CampoPersonalizado>('/api/campos')
const responsaveisCol = new ApiCollection<Responsavel>('/api/responsaveis')
/** Só os agendamentos PENDENTES — é o que o card do funil precisa (próximo contato). */
const agendamentosCol = new ApiCollection<Agendamento>('/api/agendamentos', '?status=pendente')
/** `todas=1`: a tela de Configurações precisa ver também os perfis desativados. */
const categoriasCol = new ApiCollection<CategoriaContatoRow>('/api/categorias-contato', '?todas=1')

export function useConsultores() {
  const items = useSyncExternalStore(
    consultoresCol.subscribe,
    consultoresCol.getSnapshot,
    consultoresCol.getServerSnapshot
  )
  return {
    items,
    add: consultoresCol.add,
    update: consultoresCol.update,
    remove: consultoresCol.remove,
    error: consultoresCol.getError(),
  }
}

export function useHospitais() {
  const items = useSyncExternalStore(
    hospitaisCol.subscribe,
    hospitaisCol.getSnapshot,
    hospitaisCol.getServerSnapshot
  )
  return {
    items,
    add: hospitaisCol.add,
    update: hospitaisCol.update,
    remove: hospitaisCol.remove,
    error: hospitaisCol.getError(),
  }
}

/**
 * Responsáveis (familiar/amigo/responsável legal que faz o contato). Mesma ficha
 * do consultor; um responsável pode aparecer em vários leads.
 */
export function useResponsaveis() {
  const items = useSyncExternalStore(
    responsaveisCol.subscribe,
    responsaveisCol.getSnapshot,
    responsaveisCol.getServerSnapshot
  )
  return {
    items,
    add: responsaveisCol.add,
    update: responsaveisCol.update,
    remove: responsaveisCol.remove,
    refresh: () => responsaveisCol.load(),
    error: responsaveisCol.getError(),
  }
}

export function useCaptadores() {
  const items = useSyncExternalStore(
    captadoresCol.subscribe,
    captadoresCol.getSnapshot,
    captadoresCol.getServerSnapshot
  )
  return {
    items,
    add: captadoresCol.add,
    update: captadoresCol.update,
    remove: captadoresCol.remove,
    error: captadoresCol.getError(),
  }
}

/**
 * Perfis de contato gerenciados pelo administrador. `ativos` é o que o card oferece;
 * `items` inclui os desativados, para a tela de Configurações poder reativá-los.
 */
export function useCategoriasContato() {
  const items = useSyncExternalStore(
    categoriasCol.subscribe,
    categoriasCol.getSnapshot,
    categoriasCol.getServerSnapshot
  )
  const ativos = useMemo(() => items.filter((c) => c.ativo), [items])
  return {
    items,
    ativos,
    add: categoriasCol.add,
    update: categoriasCol.update,
    remove: categoriasCol.remove,
    refresh: () => categoriasCol.load(),
    error: categoriasCol.getError(),
  }
}

/**
 * Tradutor slug → rótulo do perfil, já com os perfis que o administrador cadastrou.
 * Devolve o próprio slug quando não conhece — nunca uma célula vazia.
 */
export function useLabelPerfil(): (slug: string | null | undefined) => string {
  const items = useSyncExternalStore(
    categoriasCol.subscribe,
    categoriasCol.getSnapshot,
    categoriasCol.getServerSnapshot
  )
  return useMemo(() => {
    const mapa: Record<string, string> = { ...TIPO_CONTATO_LABELS }
    for (const c of items) mapa[c.slug] = c.label
    return (slug: string | null | undefined) => (slug ? mapa[slug] ?? slug : '—')
  }, [items])
}

/**
 * Campos personalizados (espelho do Chatwoot). `ativos` é o que o card/formulário
 * renderiza; a tela de Configurações usa `items` (inclui inativos).
 */
export function useCampos() {
  const items = useSyncExternalStore(camposCol.subscribe, camposCol.getSnapshot, camposCol.getServerSnapshot)
  const ativos = useMemo(() => items.filter((c) => c.ativo), [items])
  return {
    items,
    ativos,
    add: camposCol.add,
    update: camposCol.update,
    remove: camposCol.remove,
    refresh: () => camposCol.load(),
    error: camposCol.getError(),
  }
}

export interface UsuarioResumo {
  id: string
  nome: string
  email: string | null
  role: string | null
  ativo: boolean | null
}

export function useUsuarios() {
  const items = useSyncExternalStore(
    usuariosCol.subscribe,
    usuariosCol.getSnapshot,
    usuariosCol.getServerSnapshot
  )
  const porId = useMemo(() => new Map(items.map((u) => [u.id, u.nome])), [items])
  return { items, porId, refresh: () => usuariosCol.load() }
}

/**
 * Próximo contato (agendamentos pendentes) indexado por alvo. Compartilhado entre
 * board, cards e detalhe — `refresh()` depois de criar/resolver um lembrete.
 */
export function useAgendamentosPendentes() {
  const items = useSyncExternalStore(
    agendamentosCol.subscribe,
    agendamentosCol.getSnapshot,
    agendamentosCol.getServerSnapshot
  )

  const porAlvo = useMemo(() => {
    // A API já devolve por data crescente: o primeiro de cada alvo é o mais próximo.
    const map = new Map<string, Agendamento>()
    for (const a of items) {
      const k = chaveAlvo(a)
      if (!map.has(k)) map.set(k, a)
    }
    return map
  }, [items])

  const doLead = (triagemId: string): Agendamento | null => porAlvo.get(`t:${triagemId}`) ?? null
  const doPaciente = (pacienteId: string): Agendamento | null =>
    porAlvo.get(`p:${pacienteId}`) ?? null

  return {
    items,
    porAlvo,
    doLead,
    doPaciente,
    situacaoLead: (triagemId: string): SituacaoAgendamento =>
      situacaoAgendamento(doLead(triagemId)),
    dataLead: (triagemId: string): string | null => doLead(triagemId)?.data ?? null,
    refresh: () => agendamentosCol.load(),
  }
}
