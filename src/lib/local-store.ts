'use client'

import { useSyncExternalStore } from 'react'

/**
 * Único uso de localStorage que sobra após o cutover para o banco: as **visões de
 * filtro salvas** — preferência de UI por navegador, não é dado de negócio. Todo o
 * resto (leads, etapa, origem, consultores, hospitais, anotações) é persistido no
 * Supabase (ver api-store.ts e as rotas /api/*).
 */

const NS = 'pulso:v1:'

function uid(prefix: string): string {
  try {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
      return `${prefix}-${crypto.randomUUID()}`
    }
  } catch {
    /* ignore */
  }
  return `${prefix}-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`
}

type Listener = () => void

class LocalValue<T> {
  private readonly key: string
  private readonly fallback: T
  private cache: T
  private readonly listeners = new Set<Listener>()
  private hydrated = false

  constructor(key: string, fallback: T) {
    this.key = NS + key
    this.fallback = fallback
    this.cache = fallback
  }

  private read(): T {
    if (typeof window === 'undefined') return this.fallback
    try {
      const raw = window.localStorage.getItem(this.key)
      return raw ? (JSON.parse(raw) as T) : this.fallback
    } catch {
      return this.fallback
    }
  }

  private hydrate() {
    if (this.hydrated || typeof window === 'undefined') return
    this.hydrated = true
    this.cache = this.read()
    window.addEventListener('storage', (e) => {
      if (e.key === this.key) {
        this.cache = this.read()
        this.emit()
      }
    })
    this.emit()
  }

  private emit() {
    this.listeners.forEach((l) => l())
  }

  readonly subscribe = (l: Listener): (() => void) => {
    this.hydrate()
    this.listeners.add(l)
    return () => {
      this.listeners.delete(l)
    }
  }

  readonly getSnapshot = (): T => this.cache
  readonly getServerSnapshot = (): T => this.fallback

  get(): T {
    return this.cache
  }

  set(next: T) {
    this.cache = next
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(this.key, JSON.stringify(next))
      } catch {
        /* quota/full — ignora */
      }
    }
    this.emit()
  }
}

function useLocalValue<T>(store: LocalValue<T>): T {
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot)
}

/** Visão de filtro salva. `estado` é um FiltrosState (tipado como unknown p/ evitar ciclo). */
export interface VisaoSalva {
  id: string
  nome: string
  emoji: string
  estado: unknown
}

const visoesStore = new LocalValue<VisaoSalva[]>('visoes-filtro', [])

export function useVisoesSalvas() {
  const items = useLocalValue(visoesStore)

  function add(nome: string, emoji: string, estado: unknown): VisaoSalva {
    const v: VisaoSalva = { id: uid('visao'), nome, emoji, estado }
    visoesStore.set([...visoesStore.get(), v])
    return v
  }
  function remove(id: string) {
    visoesStore.set(visoesStore.get().filter((v) => v.id !== id))
  }

  return { items, add, remove }
}
