'use client'

import { useMemo, useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import type { CampoPersonalizado } from '@/types'
import { Select } from '@/components/ui/select'

/**
 * Renderiza os campos personalizados (definidos no Chatwoot e espelhados em
 * `campos_personalizados`). Os valores vivem em `triagem_hsm.atributos`.
 *
 * Os campos de RASTREIO (utm_*) ficam recolhidos atrás de "Ver mais": são 10 no
 * total (5 do contato + 5 da conversa), servem para relatório e não para o
 * atendimento do dia a dia — deixá-los sempre abertos enterrava o resto do card.
 * Quando algum deles está preenchido, o resumo aparece no próprio botão.
 */

const inputCls =
  'w-full rounded bg-surface-tertiary border border-border text-sm text-content-primary placeholder:text-content-tertiary px-3 py-2.5 transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500'

/** Campos de rastreio de campanha (UTM), no contato ou na conversa. */
function ehRastreio(chave: string): boolean {
  return /(^|_)utm(_|$)/.test(chave)
}

function valorTexto(v: unknown): string {
  if (v == null) return ''
  if (typeof v === 'boolean') return v ? 'true' : 'false'
  return String(v)
}

function Campo({
  campo,
  valor,
  onChange,
}: {
  campo: CampoPersonalizado
  valor: unknown
  onChange: (chave: string, valor: unknown) => void
}) {
  const label = (
    <p className="text-overline uppercase text-content-tertiary mb-1" title={campo.descricao ?? undefined}>
      {campo.rotulo}
      <span className="ml-1 normal-case tracking-normal text-[10px] text-content-tertiary/70">
        {campo.modelo === 'contact' ? '· contato' : '· conversa'}
      </span>
    </p>
  )

  if (campo.tipo === 'list') {
    return (
      <div>
        {label}
        <Select
          options={[{ value: '', label: '—' }, ...campo.opcoes.map((o) => ({ value: o, label: o }))]}
          value={valorTexto(valor)}
          onChange={(e) => onChange(campo.chave, e.target.value || null)}
        />
      </div>
    )
  }
  if (campo.tipo === 'checkbox') {
    return (
      <div>
        {label}
        <Select
          options={[
            { value: '', label: '—' },
            { value: 'true', label: 'Sim' },
            { value: 'false', label: 'Não' },
          ]}
          value={valorTexto(valor)}
          onChange={(e) => onChange(campo.chave, e.target.value === '' ? null : e.target.value === 'true')}
        />
      </div>
    )
  }
  const type =
    campo.tipo === 'date' ? 'date' : campo.tipo === 'number' ? 'number' : campo.tipo === 'link' ? 'url' : 'text'
  return (
    <div>
      {label}
      <input
        type={type}
        value={valorTexto(valor)}
        onChange={(e) => onChange(campo.chave, e.target.value === '' ? null : e.target.value)}
        placeholder={campo.descricao ?? undefined}
        className={inputCls}
      />
    </div>
  )
}

export function CamposDinamicos({
  campos,
  valores,
  onChange,
  titulo = 'Campos personalizados',
}: {
  campos: CampoPersonalizado[]
  valores: Record<string, unknown>
  onChange: (chave: string, valor: unknown) => void
  titulo?: string | null
}) {
  const [abrirRastreio, setAbrirRastreio] = useState(false)

  const { principais, rastreio } = useMemo(() => {
    const principais: CampoPersonalizado[] = []
    const rastreio: CampoPersonalizado[] = []
    for (const c of campos) (ehRastreio(c.chave) ? rastreio : principais).push(c)
    return { principais, rastreio }
  }, [campos])

  /** Resumo curto do que está preenchido, para o botão não esconder informação. */
  const resumoRastreio = useMemo(() => {
    const partes = rastreio
      .map((c) => valorTexto(valores[c.chave]).trim())
      .filter(Boolean)
    return Array.from(new Set(partes)).slice(0, 3).join(' · ')
  }, [rastreio, valores])

  if (!campos.length) return null

  return (
    <div className="space-y-3">
      {titulo && principais.length > 0 && (
        <p className="text-xs font-semibold uppercase tracking-wide text-content-tertiary">{titulo}</p>
      )}

      {principais.map((c) => (
        <Campo key={c.id} campo={c} valor={valores[c.chave]} onChange={onChange} />
      ))}

      {rastreio.length > 0 && (
        <div className={principais.length ? 'pt-1' : ''}>
          <button
            type="button"
            onClick={() => setAbrirRastreio((v) => !v)}
            className="inline-flex items-center gap-1 text-xs text-brand-500 hover:text-brand-400 transition-colors"
          >
            {abrirRastreio ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
            {abrirRastreio ? 'Ocultar' : 'Ver mais'} · rastreio de campanha ({rastreio.length})
          </button>
          {!abrirRastreio && resumoRastreio && (
            <p className="text-xs text-content-tertiary mt-1 truncate" title={resumoRastreio}>
              {resumoRastreio}
            </p>
          )}
          {abrirRastreio && (
            <div className="space-y-3 mt-2 pl-3 border-l-2 border-border">
              {rastreio.map((c) => (
                <Campo key={c.id} campo={c} valor={valores[c.chave]} onChange={onChange} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
