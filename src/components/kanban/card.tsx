'use client'

import { useDraggable } from '@dnd-kit/core'
import { Clock, AlertTriangle } from 'lucide-react'
import type { Triagem, EstagioFunil } from '@/types'
import { Badge } from '@/components/ui'

interface KanbanCardProps {
  triagem: Triagem
  onClick?: () => void
  isDragOverlay?: boolean
}

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

  const isUrgent =
    triagem.observacoes?.toLowerCase().includes('urgente') ||
    triagem.observacoes?.toLowerCase().includes('crise')

  const stage = (triagem.estagio_funil ?? 'em_atendimento') as EstagioFunil
  const accent = isUrgent ? 'var(--stage-recusou)' : STAGE_VAR[stage]

  const style: React.CSSProperties = {
    borderLeftColor: accent,
    ...(transform ? { transform: `translate(${transform.x}px, ${transform.y}px)` } : {}),
  }

  return (
    <div
      ref={!isDragOverlay ? setNodeRef : undefined}
      style={style}
      {...(!isDragOverlay ? { ...attributes, ...listeners } : {})}
      onClick={onClick}
      className={`bg-surface-secondary border border-border border-l-[3px] rounded-lg p-3 shadow-card cursor-grab active:cursor-grabbing transition-[transform,box-shadow,border-color] duration-150 hover:border-border-hover hover:shadow-card-hover hover:-translate-y-px ${
        isDragging ? 'opacity-30' : ''
      } ${isDragOverlay ? 'shadow-elevated scale-[1.02] cursor-grabbing' : ''} ${
        isUrgent ? 'ring-1 ring-danger-500/30' : ''
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <Badge variant="default" className="text-[11px] px-1.5">
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

      {isUrgent && (
        <div className="flex items-center gap-1.5 mt-2">
          <Badge variant="danger" className="text-[10px] px-1.5">
            <AlertTriangle size={10} />
            Urgente
          </Badge>
        </div>
      )}
    </div>
  )
}
