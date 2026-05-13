'use client'

import { useDraggable } from '@dnd-kit/core'
import { Clock, AlertTriangle } from 'lucide-react'
import type { Triagem } from '@/types'
import { Badge } from '@/components/ui'

interface KanbanCardProps {
  triagem: Triagem
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

const tipoContatoLabels: Record<string, string> = {
  lead: 'Lead',
  ex_paciente: 'Ex-paciente',
  responsavel: 'Responsável',
  responsavel_lead: 'Resp. lead',
  responsavel_ex_paciente: 'Resp. ex-paciente',
  parceiro: 'Parceiro',
}

const planoLabels: Record<string, string> = {
  amil: 'Amil',
  bradesco_saude: 'Bradesco Saúde',
  omint: 'Omint',
  prevent_senior: 'Prevent Sênior',
  sulamerica: 'SulAmérica',
}

export function KanbanCard({ triagem, onClick, isDragOverlay }: KanbanCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: triagem.id,
  })

  const isUrgent = triagem.observacoes?.toLowerCase().includes('urgente') ||
    triagem.observacoes?.toLowerCase().includes('crise')

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
      <div className="flex items-center justify-between mb-2">
        <Badge variant="default" className="text-[11px]">
          {triagem.tipo_contato
            ? tipoContatoLabels[triagem.tipo_contato] ?? triagem.tipo_contato
            : 'Lead'}
        </Badge>
        <span
          className={`flex items-center gap-1 text-[11px] font-mono tabular-nums ${getTimeColor(triagem.updated_at)}`}
        >
          <Clock size={10} />
          {formatDuration(triagem.updated_at)}
        </span>
      </div>

      <p className="text-sm font-medium text-content-primary truncate">
        {triagem.contact_name ?? 'Sem nome'}
      </p>

      <p className="text-[13px] text-content-secondary truncate mt-0.5">
        {triagem.plano_saude
          ? planoLabels[triagem.plano_saude] ?? triagem.plano_saude
          : triagem.forma_internacao === 'particular'
          ? 'Particular'
          : 'Sem convênio'}
      </p>

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
