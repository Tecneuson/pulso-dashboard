'use client'

import { useDraggable } from '@dnd-kit/core'
import { Clock, AlertTriangle } from 'lucide-react'
import type { ContactWithPlan } from '@/types'
import { Badge } from '@/components/ui'

interface KanbanCardProps {
  contact: ContactWithPlan
  onClick?: () => void
  isDragOverlay?: boolean
}

function formatDuration(isoDate: string): string {
  const ms = Date.now() - new Date(isoDate).getTime()
  const hours = Math.floor(ms / 3600000)
  const mins = Math.floor((ms % 3600000) / 60000)
  if (hours > 0) return `${hours}h ${mins}m`
  return `${mins}m`
}

function getTimeColor(isoDate: string): string {
  const hours = (Date.now() - new Date(isoDate).getTime()) / 3600000
  if (hours < 2) return 'text-success-500'
  if (hours < 6) return 'text-warning-500'
  return 'text-danger-500'
}

const contactTypeLabels: Record<string, string> = {
  lead: 'Lead',
  ex_paciente: 'Ex-paciente',
  responsavel: 'Responsável',
  medico: 'Médico',
  parceiro: 'Parceiro',
}

export function KanbanCard({ contact, onClick, isDragOverlay }: KanbanCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: contact.id,
  })

  const isUrgent = contact.notes?.toLowerCase().includes('urgente')

  const style = transform
    ? { transform: `translate(${transform.x}px, ${transform.y}px)` }
    : undefined

  return (
    <div
      ref={!isDragOverlay ? setNodeRef : undefined}
      style={style}
      {...(!isDragOverlay ? { ...attributes, ...listeners } : {})}
      onClick={onClick}
      className={`bg-surface-secondary border border-border rounded-lg p-3 shadow-card cursor-grab active:cursor-grabbing transition-all duration-150 hover:border-border-hover hover:shadow-card-hover hover:-translate-y-px ${
        isDragging ? 'opacity-30' : ''
      } ${isDragOverlay ? 'shadow-elevated rotate-2' : ''}`}
    >
      {/* Top row — badge + time */}
      <div className="flex items-center justify-between mb-2">
        <Badge variant="default" className="text-[11px]">
          {contactTypeLabels[contact.contact_type] ?? contact.contact_type}
        </Badge>
        <span className={`flex items-center gap-1 text-[11px] font-mono tabular-nums ${getTimeColor(contact.funnel_stage_changed_at)}`}>
          <Clock size={10} />
          {formatDuration(contact.funnel_stage_changed_at)}
        </span>
      </div>

      {/* Name */}
      <p className="text-sm font-medium text-content-primary truncate">{contact.name}</p>

      {/* Health plan */}
      <p className="text-[13px] text-content-secondary truncate mt-0.5">
        {contact.health_plan?.name ?? 'Sem convênio'}
      </p>

      {/* Bottom row — tags + agent */}
      <div className="flex items-center gap-1.5 mt-2">
        {isUrgent && (
          <Badge variant="danger" className="text-[10px] gap-0.5">
            <AlertTriangle size={10} />
            Urgente
          </Badge>
        )}
      </div>
    </div>
  )
}
