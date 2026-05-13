'use client'

import { ExternalLink, Phone, Mail, Clock } from 'lucide-react'
import type { Triagem } from '@/types'
import { ESTAGIO_FUNIL_LABELS } from '@/types'
import { Modal } from '@/components/ui/modal'
import { Badge, StageBadge } from '@/components/ui/badge'

interface CardDetailProps {
  triagem: Triagem | null
  open: boolean
  onClose: () => void
  chatwootBaseUrl?: string
}

const motivoLabels: Record<string, string> = {
  transtorno_mental_adulto: 'Transtorno mental adulto',
  transtorno_mental_infantojuvenil: 'Transtorno mental infantojuvenil',
  abuso_de_substancias: 'Abuso de substâncias',
}

const assuntoLabels: Record<string, string> = {
  internacao: 'Internação',
  consulta: 'Consulta',
  informacao_paciente: 'Informação de paciente',
  administrativo: 'Administrativo',
  outros: 'Outros',
}

const planoLabels: Record<string, string> = {
  amil: 'Amil',
  bradesco_saude: 'Bradesco Saúde',
  omint: 'Omint',
  prevent_senior: 'Prevent Sênior',
  sulamerica: 'SulAmérica',
}

const formaLabels: Record<string, string> = {
  plano: 'Plano de saúde',
  particular: 'Particular',
  nao_sabe: 'Não sabe',
}

export function CardDetail({ triagem, open, onClose, chatwootBaseUrl }: CardDetailProps) {
  if (!triagem) return null

  const chatwootUrl =
    chatwootBaseUrl && triagem.conversation_id
      ? `${chatwootBaseUrl}/app/accounts/1/conversations/${triagem.conversation_id}`
      : null

  const stage = triagem.estagio_funil ?? 'novo_contato'

  return (
    <Modal open={open} onClose={onClose} title="Detalhes do contato" size="lg">
      <div className="space-y-5">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-display text-lg font-medium text-content-primary">
              {triagem.contact_name ?? 'Sem nome'}
            </h3>
            <StageBadge stage={stage} className="mt-1" />
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

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-content-tertiary text-xs mb-0.5">Tipo de contato</p>
            <p className="text-content-primary capitalize">
              {triagem.tipo_contato?.replace(/_/g, ' ') ?? '—'}
            </p>
          </div>
          <div>
            <p className="text-content-tertiary text-xs mb-0.5">Assunto</p>
            <p className="text-content-primary">
              {triagem.assunto ? assuntoLabels[triagem.assunto] : '—'}
            </p>
          </div>
          <div>
            <p className="text-content-tertiary text-xs mb-0.5">Motivo do contato</p>
            <p className="text-content-primary">
              {triagem.motivo_contato ? motivoLabels[triagem.motivo_contato] : '—'}
            </p>
          </div>
          <div>
            <p className="text-content-tertiary text-xs mb-0.5">Para quem</p>
            <p className="text-content-primary capitalize">
              {triagem.para_quem?.replace(/_/g, ' ') ?? '—'}
            </p>
          </div>
          <div>
            <p className="text-content-tertiary text-xs mb-0.5">Forma de internação</p>
            <p className="text-content-primary">
              {triagem.forma_internacao ? formaLabels[triagem.forma_internacao] : '—'}
            </p>
          </div>
          <div>
            <p className="text-content-tertiary text-xs mb-0.5">Plano de saúde</p>
            <p className="text-content-primary">
              {triagem.plano_saude ? planoLabels[triagem.plano_saude] : '—'}
            </p>
          </div>
        </div>

        {triagem.utm_source && (
          <div>
            <p className="text-content-tertiary text-xs mb-1">Origem</p>
            <div className="flex gap-1.5 flex-wrap">
              <Badge>source: {triagem.utm_source}</Badge>
              {triagem.utm_medium && <Badge>medium: {triagem.utm_medium}</Badge>}
              {triagem.utm_campaign && <Badge>campaign: {triagem.utm_campaign}</Badge>}
            </div>
          </div>
        )}

        <div className="flex items-center gap-2 text-sm text-content-secondary">
          <Clock size={14} className="text-content-tertiary" />
          No estágio &quot;{ESTAGIO_FUNIL_LABELS[stage]}&quot; desde{' '}
          {new Date(triagem.updated_at).toLocaleString('pt-BR')}
        </div>

        {triagem.observacoes && (
          <div>
            <p className="text-content-tertiary text-xs mb-1">Observações</p>
            <p className="text-sm text-content-secondary bg-surface-tertiary rounded p-3 whitespace-pre-wrap">
              {triagem.observacoes}
            </p>
          </div>
        )}
      </div>
    </Modal>
  )
}
