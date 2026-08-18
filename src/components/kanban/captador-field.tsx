'use client'

import { useState } from 'react'
import { Check, Plus, X } from 'lucide-react'
import { Select } from '@/components/ui'
import { useCaptadores } from '@/lib/api-store'

/**
 * Campo controlado de Consultor com cadastro inline. Serve para lead e paciente.
 * (a coluna/tabela no banco continua sendo `captador_id`/`captadores` — só o rótulo mudou.)
 */
export function CaptadorField({
  value,
  onChange,
  label = 'Consultor',
}: {
  value: string | null
  onChange: (id: string | null) => void
  label?: string
}) {
  const captadores = useCaptadores()
  const [adding, setAdding] = useState(false)
  const [nome, setNome] = useState('')

  const opts = captadores.items
    .filter((c) => c.ativo)
    .map((c) => ({ value: c.id, label: c.nome }))

  async function confirmar() {
    const v = nome.trim()
    if (!v) return
    const c = await captadores.add({ nome: v })
    if (c) onChange(c.id)
    setNome('')
    setAdding(false)
  }

  const inputCls =
    'flex-1 h-10 rounded bg-surface-tertiary border border-border text-sm text-content-primary placeholder:text-content-tertiary px-3 focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500'

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <p className="text-overline uppercase text-content-tertiary">{label}</p>
        {!adding && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="text-xs text-brand-500 hover:text-brand-400 inline-flex items-center gap-1"
          >
            <Plus size={12} /> Cadastrar
          </button>
        )}
      </div>
      {adding ? (
        <div className="flex items-center gap-1.5">
          <input
            autoFocus
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                confirmar()
              }
              if (e.key === 'Escape') setAdding(false)
            }}
            placeholder="Nome do consultor"
            className={inputCls}
          />
          <button
            type="button"
            onClick={confirmar}
            className="shrink-0 inline-flex items-center justify-center h-10 w-10 rounded-md border border-border text-success-600 hover:bg-surface-tertiary transition-colors"
            aria-label="Confirmar cadastro"
          >
            <Check size={14} />
          </button>
          <button
            type="button"
            onClick={() => setAdding(false)}
            className="shrink-0 inline-flex items-center justify-center h-10 w-10 rounded-md border border-border text-content-tertiary hover:bg-surface-tertiary transition-colors"
            aria-label="Cancelar"
          >
            <X size={14} />
          </button>
        </div>
      ) : (
        <Select
          options={[{ value: '', label: 'Sem consultor' }, ...opts]}
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value || null)}
        />
      )}
    </div>
  )
}
