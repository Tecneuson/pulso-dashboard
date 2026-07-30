'use client'

import { useState } from 'react'
import { Check, Plus, X } from 'lucide-react'
import { Select } from '@/components/ui'
import {
  ORIGEM_CONVERSA_OPTIONS,
  ORIGEM_PROFISSIONAL_OPTIONS,
} from '@/lib/funil-etapas'
import { useConsultores, useHospitais } from '@/lib/api-store'

export interface OrigemValue {
  origem_conversa: string | null
  origem_hospital_id: string | null
  origem_consultor_id: string | null
  origem_profissional_tipo: string | null
}

export const ORIGEM_VAZIA: OrigemValue = {
  origem_conversa: null,
  origem_hospital_id: null,
  origem_consultor_id: null,
  origem_profissional_tipo: null,
}

function withEmpty(opts: { value: string; label: string }[], placeholder = '—') {
  return [{ value: '', label: placeholder }, ...opts]
}

/** Input inline para cadastrar um novo item (consultor/hospital) na hora. */
function QuickAdd({
  placeholder,
  onAdd,
  onCancel,
}: {
  placeholder: string
  onAdd: (nome: string) => void
  onCancel: () => void
}) {
  const [nome, setNome] = useState('')
  const inputCls =
    'flex-1 h-9 rounded bg-surface-tertiary border border-border text-sm text-content-primary placeholder:text-content-tertiary px-3 transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500'

  function confirmar() {
    const v = nome.trim()
    if (v) onAdd(v)
  }

  return (
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
          if (e.key === 'Escape') onCancel()
        }}
        placeholder={placeholder}
        className={inputCls}
      />
      <button
        type="button"
        onClick={confirmar}
        className="shrink-0 inline-flex items-center justify-center h-9 w-9 rounded-md border border-border text-success-600 hover:bg-surface-tertiary transition-colors"
        aria-label="Confirmar cadastro"
      >
        <Check size={14} />
      </button>
      <button
        type="button"
        onClick={onCancel}
        className="shrink-0 inline-flex items-center justify-center h-9 w-9 rounded-md border border-border text-content-tertiary hover:bg-surface-tertiary transition-colors"
        aria-label="Cancelar"
      >
        <X size={14} />
      </button>
    </div>
  )
}

export function OrigemFields({
  value,
  onChange,
}: {
  value: OrigemValue
  onChange: (patch: Partial<OrigemValue>) => void
}) {
  const consultores = useConsultores()
  const hospitais = useHospitais()
  const [addingHospital, setAddingHospital] = useState(false)
  const [addingConsultor, setAddingConsultor] = useState(false)

  const hospitalOpts = hospitais.items
    .filter((h) => h.ativo)
    .map((h) => ({ value: h.id, label: h.nome }))
  const consultorOpts = consultores.items
    .filter((c) => c.ativo)
    .map((c) => ({ value: c.id, label: c.nome }))

  const linkCls = 'text-xs text-brand-500 hover:text-brand-400 transition-colors inline-flex items-center gap-1'

  return (
    <div className="space-y-3">
      <div>
        <p className="text-overline uppercase text-content-tertiary mb-1">Origem da conversa</p>
        <Select
          options={withEmpty(ORIGEM_CONVERSA_OPTIONS, 'Selecione a origem')}
          value={value.origem_conversa ?? ''}
          onChange={(e) =>
            onChange({
              origem_conversa: e.target.value || null,
              // Ao trocar de origem, limpa os subcampos das outras origens.
              origem_hospital_id: null,
              origem_consultor_id: null,
              origem_profissional_tipo: null,
            })
          }
        />
      </div>

      {value.origem_conversa === 'interhospitalar' && (
        <div>
          <div className="flex items-center justify-between mb-1">
            <p className="text-overline uppercase text-content-tertiary">Hospital</p>
            {!addingHospital && (
              <button type="button" className={linkCls} onClick={() => setAddingHospital(true)}>
                <Plus size={12} /> Cadastrar
              </button>
            )}
          </div>
          {addingHospital ? (
            <QuickAdd
              placeholder="Nome do hospital"
              onCancel={() => setAddingHospital(false)}
              onAdd={async (nome) => {
                const h = await hospitais.add({ nome })
                if (h) onChange({ origem_hospital_id: h.id })
                setAddingHospital(false)
              }}
            />
          ) : (
            <Select
              options={withEmpty(hospitalOpts, 'Selecione o hospital')}
              value={value.origem_hospital_id ?? ''}
              onChange={(e) => onChange({ origem_hospital_id: e.target.value || null })}
            />
          )}
        </div>
      )}

      {value.origem_conversa === 'consultor' && (
        <div>
          <div className="flex items-center justify-between mb-1">
            <p className="text-overline uppercase text-content-tertiary">Consultor</p>
            {!addingConsultor && (
              <button type="button" className={linkCls} onClick={() => setAddingConsultor(true)}>
                <Plus size={12} /> Cadastrar
              </button>
            )}
          </div>
          {addingConsultor ? (
            <QuickAdd
              placeholder="Nome do consultor"
              onCancel={() => setAddingConsultor(false)}
              onAdd={async (nome) => {
                const c = await consultores.add({ nome })
                if (c) onChange({ origem_consultor_id: c.id })
                setAddingConsultor(false)
              }}
            />
          ) : (
            <Select
              options={withEmpty(consultorOpts, 'Selecione o consultor')}
              value={value.origem_consultor_id ?? ''}
              onChange={(e) => onChange({ origem_consultor_id: e.target.value || null })}
            />
          )}
        </div>
      )}

      {value.origem_conversa === 'profissional_saude' && (
        <div>
          <p className="text-overline uppercase text-content-tertiary mb-1">Tipo de profissional</p>
          <Select
            options={withEmpty(ORIGEM_PROFISSIONAL_OPTIONS, 'Selecione o tipo')}
            value={value.origem_profissional_tipo ?? ''}
            onChange={(e) => onChange({ origem_profissional_tipo: e.target.value || null })}
          />
        </div>
      )}
    </div>
  )
}
