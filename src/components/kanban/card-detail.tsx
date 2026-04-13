'use client'

import { ExternalLink, Phone, Mail, Clock, Tag } from 'lucide-react'
import type { ContactWithPlan } from '@/types'
import { FUNNEL_STAGE_LABELS } from '@/types'
import { Modal } from '@/components/ui/modal'
import { Badge, StageBadge } from '@/components/ui/badge'

interface CardDetailProps {
  contact: ContactWithPlan | null
  open: boolean
  onClose: () => void
  chatwootBaseUrl?: string
}

const reasonLabels: Record<string, string> = {
  transtorno_mental_adulto: 'Transtorno mental adulto',
  transtorno_mental_infantojuvenil: 'Transtorno mental infantojuvenil',
  abuso_de_substancias: 'Abuso de substâncias',
}

export function CardDetail({ contact, open, onClose, chatwootBaseUrl }: CardDetailProps) {
  if (!contact) return null

  const chatwootUrl = chatwootBaseUrl && contact.chatwoot_contact_id
    ? `${chatwootBaseUrl}/app/accounts/1/contacts/${contact.chatwoot_contact_id}`
    : null

  return (
    <Modal open={open} onClose={onClose} title="Detalhes do contato" size="lg">
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-display text-lg font-medium text-content-primary">
              {contact.name}
            </h3>
            <StageBadge stage={contact.funnel_stage} className="mt-1" />
          </div>
          {chatwootUrl && (
            <a
              href={chatwootUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs text-brand-500 hover:text-brand-400 transition-colors"
            >
              Abrir no Chatwoot
              <ExternalLink size={12} />
            </a>
          )}
        </div>

        {/* Contact info */}
        <div className="grid grid-cols-2 gap-3">
          {contact.phone && (
            <div className="flex items-center gap-2 text-sm text-content-secondary">
              <Phone size={14} className="text-content-tertiary" />
              {contact.phone}
            </div>
          )}
          {contact.email && (
            <div className="flex items-center gap-2 text-sm text-content-secondary">
              <Mail size={14} className="text-content-tertiary" />
              {contact.email}
            </div>
          )}
        </div>

        {/* Details grid */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-content-tertiary text-xs mb-0.5">Tipo</p>
            <p className="text-content-primary">{contact.contact_type}</p>
          </div>
          <div>
            <p className="text-content-tertiary text-xs mb-0.5">Motivo</p>
            <p className="text-content-primary">
              {contact.contact_reason ? reasonLabels[contact.contact_reason] : '—'}
            </p>
          </div>
          <div>
            <p className="text-content-tertiary text-xs mb-0.5">Convênio</p>
            <p className="text-content-primary">{contact.health_plan?.name ?? 'Sem convênio'}</p>
          </div>
          <div>
            <p className="text-content-tertiary text-xs mb-0.5">Solicitação para</p>
            <p className="text-content-primary">{contact.solicitation_target ?? '—'}</p>
          </div>
        </div>

        {/* UTMs */}
        {contact.utm_source && (
          <div>
            <p className="text-content-tertiary text-xs mb-1">Origem</p>
            <div className="flex gap-1.5 flex-wrap">
              {contact.utm_source && <Badge>source: {contact.utm_source}</Badge>}
              {contact.utm_medium && <Badge>medium: {contact.utm_medium}</Badge>}
              {contact.utm_campaign && <Badge>campaign: {contact.utm_campaign}</Badge>}
            </div>
          </div>
        )}

        {/* Stage time */}
        <div className="flex items-center gap-2 text-sm text-content-secondary">
          <Clock size={14} className="text-content-tertiary" />
          No estágio "{FUNNEL_STAGE_LABELS[contact.funnel_stage]}" desde{' '}
          {new Date(contact.funnel_stage_changed_at).toLocaleString('pt-BR')}
        </div>

        {/* Notes */}
        {contact.notes && (
          <div>
            <p className="text-content-tertiary text-xs mb-1">Notas</p>
            <p className="text-sm text-content-secondary bg-surface-tertiary rounded p-3">
              {contact.notes}
            </p>
          </div>
        )}
      </div>
    </Modal>
  )
}
