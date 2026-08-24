'use client'

import type { CampoPersonalizado } from '@/types'
import { Select } from '@/components/ui/select'

/**
 * Renderiza os campos personalizados (definidos no Chatwoot e espelhados em
 * `campos_personalizados`). Os valores vivem em `triagem_hsm.atributos`.
 */

const inputCls =
  'w-full rounded bg-surface-tertiary border border-border text-sm text-content-primary placeholder:text-content-tertiary px-3 py-2.5 transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500'

function valorTexto(v: unknown): string {
  if (v == null) return ''
  if (typeof v === 'boolean') return v ? 'true' : 'false'
  return String(v)
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
  if (!campos.length) return null
  return (
    <div className="space-y-3">
      {titulo && (
        <p className="text-xs font-semibold uppercase tracking-wide text-content-tertiary">{titulo}</p>
      )}
      {campos.map((c) => {
        const v = valores[c.chave]
        const label = (
          <p className="text-overline uppercase text-content-tertiary mb-1" title={c.descricao ?? undefined}>
            {c.rotulo}
            <span className="ml-1 normal-case tracking-normal text-[10px] text-content-tertiary/70">
              {c.modelo === 'contact' ? '· contato' : '· conversa'}
            </span>
          </p>
        )
        if (c.tipo === 'list') {
          return (
            <div key={c.id}>
              {label}
              <Select
                options={[{ value: '', label: '—' }, ...c.opcoes.map((o) => ({ value: o, label: o }))]}
                value={valorTexto(v)}
                onChange={(e) => onChange(c.chave, e.target.value || null)}
              />
            </div>
          )
        }
        if (c.tipo === 'checkbox') {
          return (
            <div key={c.id}>
              {label}
              <Select
                options={[
                  { value: '', label: '—' },
                  { value: 'true', label: 'Sim' },
                  { value: 'false', label: 'Não' },
                ]}
                value={valorTexto(v)}
                onChange={(e) => onChange(c.chave, e.target.value === '' ? null : e.target.value === 'true')}
              />
            </div>
          )
        }
        const type = c.tipo === 'date' ? 'date' : c.tipo === 'number' ? 'number' : c.tipo === 'link' ? 'url' : 'text'
        return (
          <div key={c.id}>
            {label}
            <input
              type={type}
              value={valorTexto(v)}
              onChange={(e) => onChange(c.chave, e.target.value === '' ? null : e.target.value)}
              placeholder={c.descricao ?? undefined}
              className={inputCls}
            />
          </div>
        )
      })}
    </div>
  )
}
