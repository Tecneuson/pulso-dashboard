'use client'

import { useDroppable } from '@dnd-kit/core'
import type { Triagem, EstagioFunil } from '@/types'
import { ESTAGIO_FUNIL_LABELS } from '@/types'
import { KanbanCard } from './card'

const STAGE_VAR: Record<EstagioFunil, string> = {
  em_atendimento: 'var(--stage-atendendo)',
  convenio_nao_legivel: 'var(--stage-consultando)',
  convenio_legivel: 'var(--stage-autorizado)',
  em_avaliacao_hsm: 'var(--stage-a-caminho)',
  vaga_cedida: 'var(--stage-recepcao)',
  vaga_recusada_medico: 'var(--stage-recusou)',
  recusou_origem: 'var(--stage-recusou)',
  recusou_internacao: 'var(--stage-recusou)',
  sem_condicoes_financeiras: 'var(--stage-novo)',
  internado: 'var(--stage-confirmado)',
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
      className={`flex flex-col shrink-0 w-[280px] rounded-xl transition-colors ${
        isOver ? 'bg-surface-secondary ring-2 ring-brand-500/30' : ''
      }`}
    >
      <div className="flex items-center gap-2 px-2.5 py-2.5 mb-1">
        <span
          className="w-1.5 h-1.5 rounded-full shrink-0"
          style={{ backgroundColor: STAGE_VAR[stage] }}
        />
        <h3 className="text-overline uppercase text-content-secondary truncate">
          {ESTAGIO_FUNIL_LABELS[stage]}
        </h3>
        <span className="ml-auto inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-surface-tertiary text-caption font-mono text-content-secondary tabular-nums">
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
