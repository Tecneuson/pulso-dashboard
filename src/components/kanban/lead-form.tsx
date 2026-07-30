'use client'

import { useState } from 'react'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { FIELD_OPTIONS } from '@/lib/chatwoot/mapping'
import type { TriagemLead } from '@/types'
import { OrigemFields, ORIGEM_VAZIA, type OrigemValue } from './origem-fields'

const MOTIVO_OPTS = [
  { value: '', label: '—' },
  { value: 'transtorno_mental_adulto', label: 'Transtorno mental adulto' },
  { value: 'transtorno_mental_infantojuvenil', label: 'Transtorno infantojuvenil' },
  { value: 'abuso_de_substancias', label: 'Abuso de substâncias' },
]

function withEmpty(opts?: { value: string; label: string }[]) {
  return [{ value: '', label: '—' }, ...(opts ?? [])]
}

const EMPTY = {
  contact_name: '',
  phone: '',
  email: '',
  tipo_contato: '',
  plano_saude: '',
  motivo_contato: '',
  observacoes: '',
}

interface LeadFormProps {
  open: boolean
  onClose: () => void
  onCreated: (lead: TriagemLead) => void
}

export function LeadForm({ open, onClose, onCreated }: LeadFormProps) {
  const [form, setForm] = useState({ ...EMPTY })
  const [origem, setOrigem] = useState<OrigemValue>({ ...ORIGEM_VAZIA })
  const [erro, setErro] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  function set(field: keyof typeof EMPTY, value: string) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  function reset() {
    setForm({ ...EMPTY })
    setOrigem({ ...ORIGEM_VAZIA })
    setErro(null)
  }

  function fechar() {
    reset()
    onClose()
  }

  async function salvar() {
    if (!form.contact_name.trim()) {
      setErro('Informe o nome do contato.')
      return
    }
    setSaving(true)
    setErro(null)
    try {
      const res = await fetch('/api/triagem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contact_name: form.contact_name.trim(),
          phone: form.phone.trim() || null,
          email: form.email.trim() || null,
          tipo_contato: form.tipo_contato || null,
          plano_saude: form.plano_saude || null,
          motivo_contato: form.motivo_contato || null,
          observacoes: form.observacoes.trim() || null,
          origem_conversa: origem.origem_conversa,
          origem_hospital_id: origem.origem_hospital_id,
          origem_consultor_id: origem.origem_consultor_id,
          origem_profissional_tipo: origem.origem_profissional_tipo,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'erro')
      onCreated(data.triagem as TriagemLead)
      fechar()
    } catch (e) {
      console.error('Falha ao criar lead:', e)
      setErro('Falha ao criar o lead. Tente novamente.')
    } finally {
      setSaving(false)
    }
  }

  const inputCls =
    'w-full rounded bg-surface-tertiary border border-border text-sm text-content-primary placeholder:text-content-tertiary px-3 py-2.5 transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500'

  return (
    <Modal open={open} onClose={fechar} title="Adicionar lead" size="md">
      <div className="space-y-4">
        <p className="text-xs text-content-secondary">
          Cria um lead manualmente na coluna <strong>Contato</strong>. É salvo no banco (sem abrir
          conversa no Chatwoot).
        </p>

        <Input
          label="Nome do contato *"
          value={form.contact_name}
          onChange={(e) => set('contact_name', e.target.value)}
          placeholder="Nome de quem entrou em contato"
        />

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Telefone"
            value={form.phone}
            onChange={(e) => set('phone', e.target.value)}
            placeholder="(00) 00000-0000"
          />
          <Input
            label="E-mail"
            value={form.email}
            onChange={(e) => set('email', e.target.value)}
            placeholder="email@exemplo.com"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Select
            label="Tipo de contato"
            options={withEmpty(FIELD_OPTIONS.tipo_contato)}
            value={form.tipo_contato}
            onChange={(e) => set('tipo_contato', e.target.value)}
          />
          <Select
            label="Plano de saúde"
            options={withEmpty(FIELD_OPTIONS.plano_saude)}
            value={form.plano_saude}
            onChange={(e) => set('plano_saude', e.target.value)}
          />
        </div>

        <Select
          label="Motivo do contato"
          options={MOTIVO_OPTS}
          value={form.motivo_contato}
          onChange={(e) => set('motivo_contato', e.target.value)}
        />

        <div className="pt-3 border-t border-border">
          <OrigemFields value={origem} onChange={(patch) => setOrigem((o) => ({ ...o, ...patch }))} />
        </div>

        <div>
          <p className="text-overline uppercase text-content-tertiary mb-1">Observações</p>
          <textarea
            value={form.observacoes}
            onChange={(e) => set('observacoes', e.target.value)}
            rows={3}
            className={inputCls}
            placeholder="Notas internas sobre o atendimento…"
          />
        </div>

        {erro && <p className="text-sm text-danger-500">{erro}</p>}

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
          <Button variant="ghost" size="sm" onClick={fechar}>
            Cancelar
          </Button>
          <Button size="sm" onClick={salvar} loading={saving}>
            Adicionar lead
          </Button>
        </div>
      </div>
    </Modal>
  )
}
