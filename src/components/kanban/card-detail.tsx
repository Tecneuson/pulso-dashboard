'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { ExternalLink, Phone, Mail, Check, AlertCircle } from 'lucide-react'
import type { Triagem, FunnelStage } from '@/types'
import { ESTAGIO_FUNIL_LABELS } from '@/types'
import { Modal } from '@/components/ui/modal'
import { StageBadge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { FIELD_OPTIONS } from '@/lib/chatwoot/mapping'

interface CardDetailProps {
  triagem: Triagem | null
  open: boolean
  onClose: () => void
  onSaved?: (t: Triagem) => void
}

const EDITABLE = [
  'estagio_funil',
  'tipo_contato',
  'assunto',
  'motivo_contato',
  'para_quem',
  'forma_internacao',
  'plano_saude',
  'observacoes',
] as const

const FORMA_OPTIONS = [
  { value: 'plano', label: 'Plano de saúde' },
  { value: 'particular', label: 'Particular' },
  { value: 'nao_sabe', label: 'Não sabe' },
]

const estagioOptions = Object.entries(ESTAGIO_FUNIL_LABELS).map(([value, label]) => ({ value, label }))

function withEmpty(opts?: { value: string; label: string }[]) {
  return [{ value: '', label: '—' }, ...(opts ?? [])]
}

export function CardDetail({ triagem, open, onClose, onSaved }: CardDetailProps) {
  const [form, setForm] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState<'idle' | 'saved' | 'error'>('idle')
  const [sync, setSync] = useState<string | null>(null)

  useEffect(() => {
    if (!triagem) return
    setForm({
      estagio_funil: triagem.estagio_funil ?? '',
      tipo_contato: triagem.tipo_contato ?? '',
      assunto: triagem.assunto ?? '',
      motivo_contato: triagem.motivo_contato ?? '',
      para_quem: triagem.para_quem ?? '',
      forma_internacao: triagem.forma_internacao ?? '',
      plano_saude: triagem.plano_saude ?? '',
      observacoes: triagem.observacoes ?? '',
    })
    setStatus('idle')
    setSync(null)
  }, [triagem])

  if (!triagem) return null

  const chatwootBase = process.env.NEXT_PUBLIC_CHATWOOT_BASE_URL
  const chatwootUrl =
    chatwootBase && triagem.conversation_id
      ? `${chatwootBase}/app/accounts/1/conversations/${triagem.conversation_id}`
      : null

  function set(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }))
    setStatus('idle')
  }

  async function handleSave() {
    if (!triagem) return
    setSaving(true)
    setStatus('idle')
    setSync(null)
    const payload: Record<string, unknown> = { id: triagem.id }
    for (const k of EDITABLE) payload[k] = form[k] === '' ? null : form[k]
    try {
      const res = await fetch('/api/triagem', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'erro')
      setStatus('saved')
      setSync(data.chatwoot)
      if (data.triagem) onSaved?.(data.triagem as Triagem)
    } catch (e) {
      console.error('Falha ao salvar triagem:', e)
      setStatus('error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Detalhes do contato" size="lg">
      <div className="space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h3 className="font-display text-lg font-medium text-content-primary truncate">
              {triagem.contact_name ?? 'Sem nome'}
            </h3>
            {form.estagio_funil && (
              <StageBadge stage={form.estagio_funil as FunnelStage} className="mt-1" />
            )}
          </div>
          {chatwootUrl && (
            <a
              href={chatwootUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs text-brand-500 hover:text-brand-400 transition-colors shrink-0"
            >
              Abrir no Chatwoot
              <ExternalLink size={12} />
            </a>
          )}
        </div>

        {(triagem.phone || triagem.email) && (
          <div className="grid grid-cols-2 gap-3">
            {triagem.phone && (
              <div className="flex items-center gap-2 text-sm text-content-secondary">
                <Phone size={14} className="text-content-tertiary" />
                {triagem.phone}
              </div>
            )}
            {triagem.email && (
              <div className="flex items-center gap-2 text-sm text-content-secondary">
                <Mail size={14} className="text-content-tertiary" />
                {triagem.email}
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Estágio no funil">
            <Select options={withEmpty(estagioOptions)} value={form.estagio_funil} onChange={(e) => set('estagio_funil', e.target.value)} />
          </Field>
          <Field label="Tipo de contato">
            <Select options={withEmpty(FIELD_OPTIONS.tipo_contato)} value={form.tipo_contato} onChange={(e) => set('tipo_contato', e.target.value)} />
          </Field>
          <Field label="Assunto">
            <Select options={withEmpty(FIELD_OPTIONS.assunto)} value={form.assunto} onChange={(e) => set('assunto', e.target.value)} />
          </Field>
          <Field label="Motivo do contato">
            <Select options={withEmpty(FIELD_OPTIONS.motivo_contato)} value={form.motivo_contato} onChange={(e) => set('motivo_contato', e.target.value)} />
          </Field>
          <Field label="Para quem">
            <Select options={withEmpty(FIELD_OPTIONS.para_quem)} value={form.para_quem} onChange={(e) => set('para_quem', e.target.value)} />
          </Field>
          <Field label="Forma de internação">
            <Select options={withEmpty(FORMA_OPTIONS)} value={form.forma_internacao} onChange={(e) => set('forma_internacao', e.target.value)} />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Plano de saúde">
              <Select options={withEmpty(FIELD_OPTIONS.plano_saude)} value={form.plano_saude} onChange={(e) => set('plano_saude', e.target.value)} />
            </Field>
          </div>
        </div>

        <Field label="Observações">
          <textarea
            value={form.observacoes}
            onChange={(e) => set('observacoes', e.target.value)}
            rows={3}
            className="w-full rounded bg-surface-tertiary border border-border text-sm text-content-primary placeholder:text-content-tertiary p-3 transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500"
            placeholder="Notas internas sobre o atendimento…"
          />
        </Field>

        <div className="flex items-center justify-between gap-3 pt-3 border-t border-border">
          <div className="text-caption">
            {status === 'saved' && (
              <span className="inline-flex items-center gap-1.5 text-success-600 dark:text-success-500">
                <Check size={13} />
                Salvo
                {sync === 'ok'
                  ? ' · sincronizado com o Chatwoot'
                  : sync === 'failed'
                  ? ' · falha ao sincronizar Chatwoot'
                  : ''}
              </span>
            )}
            {status === 'error' && (
              <span className="inline-flex items-center gap-1.5 text-danger-500">
                <AlertCircle size={13} />
                Erro ao salvar
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={onClose}>
              Fechar
            </Button>
            <Button size="sm" onClick={handleSave} loading={saving}>
              Salvar
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="text-overline uppercase text-content-tertiary mb-1">{label}</p>
      {children}
    </div>
  )
}
