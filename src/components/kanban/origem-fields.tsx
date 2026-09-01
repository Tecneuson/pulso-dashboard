'use client'

import { useState } from 'react'
import { Check, X } from 'lucide-react'
import { Combobox, Select, type ComboboxOption } from '@/components/ui'
import { ORIGEM_CONVERSA_OPTIONS, ORIGEM_PROFISSIONAL_OPTIONS } from '@/lib/funil-etapas'
import { useConsultores, useHospitais } from '@/lib/api-store'

/**
 * Origem da conversa: por onde o paciente chegou.
 *
 * ⚠️ ORIGEM ≠ CATEGORIA DO CONTATO. Aqui é **por onde o paciente chegou** — vale o
 * PRIMEIRO contato e não muda quando outra pessoa liga depois. Quem está falando é
 * a categoria (`CategoriaContatoField`).
 *
 * As duas podem apontar para consultores diferentes: o paciente pode ligar por conta
 * própria tendo sido encaminhado pelo consultor A, e depois o consultor B ligar sobre
 * ele. Por isso este campo é independente — o que foi removido antes era o `captador`,
 * um vínculo legado que duplicava ESTE aqui.
 */

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

/** Cadastro rápido de hospital (só o nome — a lista vem do Chatwoot). */
function NovoHospital({ onAdd, onCancel }: { onAdd: (nome: string) => void; onCancel: () => void }) {
  const [nome, setNome] = useState('')
  const inputCls =
    'flex-1 h-9 rounded bg-surface-tertiary border border-border text-sm text-content-primary placeholder:text-content-tertiary px-3 focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500'
  return (
    <div className="flex items-center gap-1.5">
      <input
        autoFocus
        value={nome}
        onChange={(e) => setNome(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            if (nome.trim()) onAdd(nome.trim())
          }
          if (e.key === 'Escape') onCancel()
        }}
        placeholder="Nome do hospital"
        className={inputCls}
      />
      <button
        type="button"
        onClick={() => nome.trim() && onAdd(nome.trim())}
        className="shrink-0 inline-flex items-center justify-center h-9 w-9 rounded-md border border-border text-success-600 hover:bg-surface-tertiary"
        aria-label="Confirmar cadastro"
      >
        <Check size={14} />
      </button>
      <button
        type="button"
        onClick={onCancel}
        className="shrink-0 inline-flex items-center justify-center h-9 w-9 rounded-md border border-border text-content-tertiary hover:bg-surface-tertiary"
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
  /** Bloqueia a edição quando a origem já foi registrada no primeiro contato. */
  travada = false,
}: {
  value: OrigemValue
  onChange: (patch: Partial<OrigemValue>) => void
  travada?: boolean
}) {
  const consultores = useConsultores()
  const hospitais = useHospitais()
  const [addingHospital, setAddingHospital] = useState(false)

  const hospitalOpts: ComboboxOption[] = hospitais.items
    .filter((h) => h.ativo || h.id === value.origem_hospital_id)
    .map((h) => ({ value: h.id, label: h.nome }))


  return (
    <div className="space-y-3">
      <div>
        <p className="text-overline uppercase text-content-tertiary mb-1">Origem da conversa</p>
        <Select
          options={withEmpty(ORIGEM_CONVERSA_OPTIONS, 'Selecione a origem')}
          value={value.origem_conversa ?? ''}
          disabled={travada}
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
              <button
                type="button"
                className="text-xs text-brand-500 hover:text-brand-400"
                onClick={() => setAddingHospital(true)}
              >
                + Cadastrar
              </button>
            )}
          </div>
          {addingHospital ? (
            <NovoHospital
              onCancel={() => setAddingHospital(false)}
              onAdd={async (nome) => {
                const h = await hospitais.add({ nome })
                if (h) onChange({ origem_hospital_id: h.id })
                setAddingHospital(false)
              }}
            />
          ) : (
            <Combobox
              options={hospitalOpts}
              value={value.origem_hospital_id}
              onChange={(id) => onChange({ origem_hospital_id: id })}
              placeholder="Buscar hospital…"
              textoVazio="— sem hospital —"
              onCriar={() => setAddingHospital(true)}
              criarLabel="Cadastrar hospital"
            />
          )}
        </div>
      )}

      {value.origem_conversa === 'consultor' && (
        <div>
          <p className="text-overline uppercase text-content-tertiary mb-1">Consultor que encaminhou</p>
          <Combobox
            options={consultores.items
              .filter((c) => c.ativo || c.id === value.origem_consultor_id)
              .map((c) => ({
                value: c.id,
                label: c.nome,
                hint: [c.telefones?.[0] ?? c.telefone, c.email].filter(Boolean).join(' · ') || undefined,
              }))}
            value={value.origem_consultor_id}
            onChange={(id) => onChange({ origem_consultor_id: id })}
            placeholder="Buscar consultor…"
            textoVazio="— sem consultor —"
            disabled={travada}
          />
          <p className="text-xs text-content-tertiary mt-1">
            Quem trouxe o paciente. É diferente de quem está falando agora — pode ser outra pessoa.
          </p>
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
