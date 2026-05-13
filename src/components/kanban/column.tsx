'use client'

import { useDroppable } from '@dnd-kit/core'
import type { Triagem, EstagioFunil } from '@/types'
import { ESTAGIO_FUNIL_LABELS } from '@/types'
import { KanbanCard } from './card'

const stageColors: Record<EstagioFunil, string> = {
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
  stage: EstagioFunil
  triagens: Triagem[]
  onCardClick?: (triagem: Triagem) => void
}

export function KanbanColumn({ stage, triagens, onCardClick }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: stage })

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col shrink-0 w-[280px] rounded-lg transition-colors ${
        isOver ? 'bg-surface-tertiary/50' : ''
      }`}
    >
      <div className="flex items-center gap-2 px-2 py-2.5 mb-1">
        <div className={`w-2 h-2 rounded-full ${stageColors[stage]}`} />
        <h3 className="text-[13px] font-medium text-content-primary truncate">
          {ESTAGIO_FUNIL_LABELS[stage]}
        </h3>
        <span className="text-xs font-mono text-content-tertiary tabular-nums ml-auto">
          {triagens.length}
        </span>
      </div>

      <div className="flex-1 space-y-2 px-1 min-h-[200px]">
        {triagens.map((triagem) => (
          <KanbanCard
            key={triagem.id}
            triagem={triagem}
            onClick={() => onCardClick?.(triagem)}
          />
        ))}
      </div>
    </div>
  )
}
