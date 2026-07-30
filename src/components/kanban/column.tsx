'use client'

import type { ReactNode } from 'react'
import { useDroppable } from '@dnd-kit/core'
import {
  FUNIL_ETAPA_LABELS,
  FUNIL_ETAPA_VAR,
  type FunilEtapa,
  type LeadComEtapa,
} from '@/lib/funil-etapas'
import { KanbanCard } from './card'

interface KanbanColumnProps {
  etapa: FunilEtapa
  triagens: LeadComEtapa[]
  onCardClick?: (triagem: LeadComEtapa) => void
  /** Conteúdo extra ao fim da coluna (ex.: pacientes internados na coluna Internação). */
  footer?: ReactNode
}

export function KanbanColumn({ etapa, triagens, onCardClick, footer }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: etapa })

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col shrink-0 w-[300px] h-full min-h-0 rounded-xl transition-colors ${
        isOver ? 'bg-surface-secondary ring-2 ring-brand-500/30' : ''
      }`}
    >
      <div className="flex items-center gap-2 px-2.5 py-2.5 mb-1 shrink-0">
        <span
          className="w-1.5 h-1.5 rounded-full shrink-0"
          style={{ backgroundColor: FUNIL_ETAPA_VAR[etapa] }}
        />
        <h3 className="text-overline uppercase text-content-secondary truncate">
          {FUNIL_ETAPA_LABELS[etapa]}
        </h3>
        <span className="ml-auto inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-surface-tertiary text-caption font-mono text-content-secondary tabular-nums">
          {triagens.length}
        </span>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto space-y-2 px-1 pb-2">
        {triagens.map((triagem) => (
          <KanbanCard
            key={triagem.id}
            triagem={triagem}
            onClick={() => onCardClick?.(triagem)}
          />
        ))}
        {footer}
      </div>
    </div>
  )
}
