'use client'

import { useDroppable } from '@dnd-kit/core'
import type { ContactWithPlan, FunnelStage } from '@/types'
import { FUNNEL_STAGE_LABELS } from '@/types'
import { KanbanCard } from './card'

const stageColors: Record<FunnelStage, string> = {
  novo_contato: 'bg-neutral-500',
  atendendo: 'bg-info-500',
  consultando_convenio: 'bg-warning-500',
  autorizado_pelo_convenio: 'bg-brand-500',
  paciente_a_caminho: 'bg-info-500',
  hospital_recepcao: 'bg-brand-400',
  recusou_internacao: 'bg-danger-500',
  internacao_confirmada: 'bg-success-500',
}

interface KanbanColumnProps {
  stage: FunnelStage
  contacts: ContactWithPlan[]
  onCardClick?: (contact: ContactWithPlan) => void
}

export function KanbanColumn({ stage, contacts, onCardClick }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: stage })

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col shrink-0 w-[280px] rounded-lg transition-colors ${
        isOver ? 'bg-surface-tertiary/50' : ''
      }`}
    >
      {/* Column header */}
      <div className="flex items-center gap-2 px-2 py-2.5 mb-1">
        <div className={`w-2 h-2 rounded-full ${stageColors[stage]}`} />
        <h3 className="text-[13px] font-medium text-content-primary truncate">
          {FUNNEL_STAGE_LABELS[stage]}
        </h3>
        <span className="text-xs font-mono text-content-tertiary tabular-nums ml-auto">
          {contacts.length}
        </span>
      </div>

      {/* Cards */}
      <div className="flex-1 space-y-2 px-1 min-h-[200px]">
        {contacts.map((contact) => (
          <KanbanCard
            key={contact.id}
            contact={contact}
            onClick={() => onCardClick?.(contact)}
          />
        ))}
      </div>
    </div>
  )
}
