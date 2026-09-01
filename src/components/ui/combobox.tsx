'use client'

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown, Search, X } from 'lucide-react'

/**
 * Select com BUSCA e rolagem. O `<select>` nativo vira inviável nas listas grandes
 * do HSM (≈260 hospitais, dezenas de consultores): não dá para pesquisar e a lista
 * do sistema operacional fica gigante.
 *
 * - digita para filtrar (ignora acento e caixa; casa por qualquer palavra)
 * - ↑/↓ navega, Enter escolhe, Esc fecha
 * - a lista é renderizada num PORTAL com posição fixa: dentro do modal do card,
 *   um dropdown absoluto seria cortado pelo `overflow-y-auto` do corpo do modal.
 *   Abre para cima quando não há espaço embaixo.
 */

export interface ComboboxOption {
  value: string
  label: string
  /** Linha secundária (ex.: telefone · e-mail · CPF). */
  hint?: string
}

function normalizar(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
}

interface Posicao {
  left: number
  width: number
  /** Uma das duas é usada, conforme a direção de abertura. */
  top?: number
  bottom?: number
  maxHeight: number
}

interface ComboboxProps {
  options: ComboboxOption[]
  value: string | null
  onChange: (value: string | null) => void
  placeholder?: string
  /** Texto do item que limpa a seleção. */
  textoVazio?: string
  disabled?: boolean
  /** Mostra "Cadastrar" no rodapé da lista. */
  onCriar?: () => void
  criarLabel?: string
  id?: string
}

const ALTURA_MAX = 300

export function Combobox({
  options,
  value,
  onChange,
  placeholder = 'Selecione…',
  textoVazio = '— nenhum —',
  disabled = false,
  onCriar,
  criarLabel = 'Cadastrar novo',
  id,
}: ComboboxProps) {
  const [aberto, setAberto] = useState(false)
  const [busca, setBusca] = useState('')
  const [destaque, setDestaque] = useState(0)
  const [pos, setPos] = useState<Posicao | null>(null)
  const [montado, setMontado] = useState(false)

  const gatilho = useRef<HTMLDivElement | null>(null)
  const painel = useRef<HTMLDivElement | null>(null)
  const inputBusca = useRef<HTMLInputElement | null>(null)
  const listaRef = useRef<HTMLUListElement | null>(null)

  useEffect(() => setMontado(true), [])

  const selecionado = options.find((o) => o.value === value) ?? null

  const filtradas = useMemo(() => {
    const q = normalizar(busca)
    if (!q) return options
    const termos = q.split(/\s+/)
    return options.filter((o) => {
      const alvo = normalizar(`${o.label} ${o.hint ?? ''}`)
      return termos.every((t) => alvo.includes(t))
    })
  }, [options, busca])

  const medir = useCallback(() => {
    const el = gatilho.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const abaixo = window.innerHeight - r.bottom - 8
    const acima = r.top - 8
    const paraCima = abaixo < 220 && acima > abaixo
    setPos({
      left: r.left,
      width: r.width,
      ...(paraCima
        ? { bottom: window.innerHeight - r.top + 4, maxHeight: Math.min(ALTURA_MAX, acima) }
        : { top: r.bottom + 4, maxHeight: Math.min(ALTURA_MAX, abaixo) }),
    })
  }, [])

  useLayoutEffect(() => {
    if (aberto) medir()
  }, [aberto, medir])

  useEffect(() => {
    if (!aberto) return
    setDestaque(0)
    const t = setTimeout(() => inputBusca.current?.focus(), 10)

    function fora(e: MouseEvent) {
      const alvo = e.target as Node
      if (gatilho.current?.contains(alvo) || painel.current?.contains(alvo)) return
      setAberto(false)
    }
    // `capture` para acompanhar também a rolagem interna do modal.
    const reposicionar = () => medir()
    document.addEventListener('mousedown', fora)
    window.addEventListener('scroll', reposicionar, true)
    window.addEventListener('resize', reposicionar)
    return () => {
      clearTimeout(t)
      document.removeEventListener('mousedown', fora)
      window.removeEventListener('scroll', reposicionar, true)
      window.removeEventListener('resize', reposicionar)
    }
  }, [aberto, medir])

  // Mantém o item destacado visível durante a navegação por teclado.
  useEffect(() => {
    if (!aberto) return
    const el = listaRef.current?.children[destaque] as HTMLElement | undefined
    el?.scrollIntoView({ block: 'nearest' })
  }, [destaque, aberto])

  function escolher(v: string | null) {
    onChange(v)
    setAberto(false)
    setBusca('')
  }

  function teclado(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setDestaque((d) => Math.min(d + 1, filtradas.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setDestaque((d) => Math.max(d - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const opt = filtradas[destaque]
      if (opt) escolher(opt.value)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setAberto(false)
    }
  }

  const lista = aberto && pos && montado && (
    <div
      ref={painel}
      style={{
        position: 'fixed',
        left: pos.left,
        width: pos.width,
        ...(pos.top !== undefined ? { top: pos.top } : { bottom: pos.bottom }),
      }}
      className="z-[60] rounded-lg border border-border bg-surface-elevated shadow-modal animate-fade-in overflow-hidden"
    >
      <div className="relative border-b border-border">
        <Search
          size={14}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-content-tertiary pointer-events-none"
        />
        <input
          ref={inputBusca}
          value={busca}
          onChange={(e) => {
            setBusca(e.target.value)
            setDestaque(0)
          }}
          onKeyDown={teclado}
          placeholder="Buscar…"
          className="w-full h-10 pl-9 pr-3 bg-transparent text-sm text-content-primary placeholder:text-content-tertiary focus:outline-none"
        />
      </div>

      <ul
        ref={listaRef}
        style={{ maxHeight: Math.max(120, pos.maxHeight - 82) }}
        className="overflow-y-auto py-1"
        role="listbox"
      >
        {value && (
          <li>
            <button
              type="button"
              onClick={() => escolher(null)}
              className="w-full text-left px-3 py-1.5 text-sm text-content-tertiary hover:bg-surface-tertiary"
            >
              {textoVazio}
            </button>
          </li>
        )}
        {filtradas.map((o, i) => (
          <li key={o.value} role="option" aria-selected={o.value === value}>
            <button
              type="button"
              onMouseEnter={() => setDestaque(i)}
              onClick={() => escolher(o.value)}
              className={`w-full text-left px-3 py-1.5 text-sm flex items-start gap-2 ${
                i === destaque ? 'bg-surface-tertiary' : ''
              } ${o.value === value ? 'text-brand-600 dark:text-brand-400' : 'text-content-primary'}`}
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate">{o.label}</span>
                {o.hint && <span className="block truncate text-xs text-content-tertiary">{o.hint}</span>}
              </span>
              {o.value === value && <Check size={14} className="shrink-0 mt-0.5" />}
            </button>
          </li>
        ))}
        {filtradas.length === 0 && (
          <li className="px-3 py-3 text-xs text-content-tertiary">Nenhum resultado para “{busca}”.</li>
        )}
      </ul>

      <div className="flex items-center justify-between gap-2 border-t border-border px-3 py-1.5">
        <span className="text-[11px] text-content-tertiary tabular-nums">
          {filtradas.length} de {options.length}
        </span>
        {onCriar && (
          <button
            type="button"
            onClick={() => {
              setAberto(false)
              onCriar()
            }}
            className="text-xs text-brand-500 hover:text-brand-400"
          >
            + {criarLabel}
          </button>
        )}
      </div>
    </div>
  )

  return (
    <div className="relative" ref={gatilho}>
      <button
        type="button"
        id={id}
        disabled={disabled}
        onClick={() => setAberto((a) => !a)}
        className={`w-full h-10 px-3 pr-14 rounded bg-surface-tertiary border border-border text-sm text-left transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500 disabled:opacity-50 disabled:cursor-not-allowed ${
          selecionado ? 'text-content-primary' : 'text-content-tertiary'
        }`}
        aria-haspopup="listbox"
        aria-expanded={aberto}
      >
        <span className="block truncate">{selecionado ? selecionado.label : placeholder}</span>
      </button>

      {selecionado && !disabled && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            escolher(null)
          }}
          title="Limpar"
          aria-label="Limpar seleção"
          className="absolute right-8 top-1/2 -translate-y-1/2 text-content-tertiary hover:text-danger-500"
        >
          <X size={13} />
        </button>
      )}
      <ChevronDown
        size={16}
        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-content-tertiary pointer-events-none"
      />

      {montado && lista ? createPortal(lista, document.body) : null}
    </div>
  )
}
