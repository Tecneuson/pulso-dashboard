'use client'

import { useMemo, useSyncExternalStore } from 'react'
import type { Agendamento, Captador, Consultor, Hospital } from '@/types'
import { chaveAlvo, situacaoAgendamento, type SituacaoAgendamento } from '@/lib/agendamentos'

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
/** Só os agendamentos PENDENTES — é o que o card do funil precisa (próximo contato). */
const agendamentosCol = new ApiCollection<Agendamento>('/api/agendamentos', '?status=pendente')

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
  return { items, porId }
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
