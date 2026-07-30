'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core'
import { Loader2 } from 'lucide-react'
import type { Paciente, EstagioReativacao } from '@/types'
import { ESTAGIO_REATIVACAO, ESTAGIO_REATIVACAO_LABELS } from '@/types'
import { formatarCpf } from '@/lib/cpf'
import { classificacaoMeta, internacoesConhecidas } from '@/lib/funil'
import { situacaoAgendamento } from '@/lib/agendamentos'
import { CardBase } from '../card-base'
import { useFunilDados } from '../funil-dados'
import { REATIVACAO_COLOR } from './stage-meta'
import { PacienteDetail } from './paciente-detail'

const PAGE = 50

interface ColState {
  rows: Paciente[]
  count: number
  loading: boolean
}
type Cols = Record<EstagioReativacao, ColState>

function emptyCols(): Cols {
  return ESTAGIO_REATIVACAO.reduce((acc, s) => {
    acc[s] = { rows: [], count: 0, loading: true }
    return acc
  }, {} as Cols)
}

interface PacientesBoardProps {
  q: string
  classificacao: string
  convenio: string
}

export function PacientesBoard({ q, classificacao, convenio }: PacientesBoardProps) {
  const [cols, setCols] = useState<Cols>(emptyCols)
  const [active, setActive] = useState<Paciente | null>(null)
  const [selected, setSelected] = useState<Paciente | null>(null)

  const buildParams = useCallback(
    (estagio: EstagioReativacao, offset: number) => {
      const p = new URLSearchParams({ estagio, limit: String(PAGE), offset: String(offset) })
      if (q) p.set('q', q)
      if (classificacao) p.set('classificacao', classificacao)
      if (convenio) p.set('convenio', convenio)
      return p
    },
    [q, classificacao, convenio]
  )

  useEffect(() => {
    let alive = true
    setCols(emptyCols())
    ESTAGIO_REATIVACAO.forEach((estagio) => {
      fetch(`/api/pacientes?${buildParams(estagio, 0)}`)
        .then((r) => r.json())
        .then((data) => {
          if (!alive || data.error) return
          setCols((prev) => ({
            ...prev,
            [estagio]: { rows: data.rows, count: data.count, loading: false },
          }))
        })
        .catch(() => {})
    })
    return () => {
      alive = false
    }
  }, [buildParams])

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  function handleDragStart(e: DragStartEvent) {
    const id = e.active.id as string
    for (const s of ESTAGIO_REATIVACAO) {
      const found = cols[s].rows.find((p) => p.id === id)
      if (found) {
        setActive(found)
        break
      }
    }
  }

  async function handleDragEnd(e: DragEndEvent) {
    setActive(null)
    const { active: a, over } = e
    if (!over) return
    const id = a.id as string
    const target = over.id as EstagioReativacao

    let source: EstagioReativacao | null = null
    for (const s of ESTAGIO_REATIVACAO) {
      if (cols[s].rows.some((p) => p.id === id)) {
        source = s
        break
      }
    }
    if (!source || source === target) return
    const card = cols[source].rows.find((p) => p.id === id)
    if (!card) return
    const src = source

    // Atualização otimista
    setCols((prev) => ({
      ...prev,
      [src]: {
        ...prev[src],
        rows: prev[src].rows.filter((p) => p.id !== id),
        count: prev[src].count - 1,
      },
      [target]: {
        ...prev[target],
        rows: [{ ...card, estagio_reativacao: target }, ...prev[target].rows],
        count: prev[target].count + 1,
      },
    }))

    const res = await fetch('/api/pacientes', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, estagio_reativacao: target }),
    })

    if (!res.ok) {
      // Reverte em caso de falha
      setCols((prev) => ({
        ...prev,
        [target]: {
          ...prev[target],
          rows: prev[target].rows.filter((p) => p.id !== id),
          count: prev[target].count - 1,
        },
        [src]: {
          ...prev[src],
          rows: [card, ...prev[src].rows],
          count: prev[src].count + 1,
        },
      }))
    }
  }

  async function loadMore(estagio: EstagioReativacao) {
    const cur = cols[estagio]
    setCols((prev) => ({ ...prev, [estagio]: { ...prev[estagio], loading: true } }))
    const data = await fetch(`/api/pacientes?${buildParams(estagio, cur.rows.length)}`)
      .then((r) => r.json())
      .catch(() => ({ rows: [] }))
    setCols((prev) => ({
      ...prev,
      [estagio]: {
        rows: [...prev[estagio].rows, ...(data.rows || [])],
        count: data.count ?? prev[estagio].count,
        loading: false,
      },
    }))
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-3 overflow-x-auto h-full min-h-0 pb-2">
        {ESTAGIO_REATIVACAO.map((stage) => (
          <Column
            key={stage}
            stage={stage}
            state={cols[stage]}
            onCardClick={setSelected}
            onLoadMore={() => loadMore(stage)}
          />
        ))}
      </div>
      <DragOverlay>{active && <PacienteKanbanCard paciente={active} dragOverlay />}</DragOverlay>
      <PacienteDetail paciente={selected} open={!!selected} onClose={() => setSelected(null)} />
    </DndContext>
  )
}

function Column({
  stage,
  state,
  onCardClick,
  onLoadMore,
}: {
  stage: EstagioReativacao
  state: ColState
  onCardClick: (p: Paciente) => void
  onLoadMore: () => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage })

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
          style={{ backgroundColor: REATIVACAO_COLOR[stage] }}
        />
        <h3 className="text-overline uppercase text-content-secondary truncate">
          {ESTAGIO_REATIVACAO_LABELS[stage]}
        </h3>
        <span className="ml-auto inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-surface-tertiary text-caption font-mono text-content-secondary tabular-nums">
          {state.count.toLocaleString('pt-BR')}
        </span>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto space-y-2 px-1 pb-2">
        {state.rows.map((p) => (
          <PacienteKanbanCard key={p.id} paciente={p} onClick={() => onCardClick(p)} />
        ))}
        {state.loading && (
          <div className="flex justify-center py-3 text-content-tertiary">
            <Loader2 size={14} className="animate-spin" />
          </div>
        )}
        {!state.loading && state.rows.length < state.count && (
          <button
            onClick={onLoadMore}
            className="focus-ring w-full py-2 text-caption text-content-secondary hover:text-content-primary rounded-lg hover:bg-surface-tertiary transition-colors"
          >
            Carregar mais ({(state.count - state.rows.length).toLocaleString('pt-BR')})
          </button>
        )}
      </div>
    </div>
  )
}

function PacienteKanbanCard({
  paciente,
  onClick,
  dragOverlay,
}: {
  paciente: Paciente
  onClick?: () => void
  dragOverlay?: boolean
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: paciente.id,
  })
  const dados = useFunilDados()
  const meta = classificacaoMeta(paciente.classificacao_cliente ?? '')
  const agendamento = dados.proximoDoPaciente(paciente.id)

  return (
    <CardBase
      ref={!dragOverlay ? setNodeRef : undefined}
      {...(!dragOverlay ? { ...attributes, ...listeners } : {})}
      onClick={onClick}
      style={transform ? { transform: `translate(${transform.x}px, ${transform.y}px)` } : undefined}
      className={`cursor-grab active:cursor-grabbing ${isDragging ? 'opacity-30' : ''} ${
        dragOverlay ? 'shadow-elevated scale-[1.02] cursor-grabbing' : ''
      }`}
      accent={REATIVACAO_COLOR[paciente.estagio_reativacao]}
      badges={[
        { label: 'Paciente' },
        ...(paciente.classificacao_cliente
          ? [{ label: meta.label, className: meta.badgeClass }]
          : []),
      ]}
      nome={paciente.nome_cliente}
      documento={paciente.cpf ? formatarCpf(paciente.cpf) : null}
      convenio={paciente.convenio_raw}
      contatos={[]}
      agente={dados.nomeAgente(paciente.responsavel_id)}
      contadores={{
        internacoes: internacoesConhecidas(paciente).length,
        perdas: 0,
        conversas: 0,
      }}
      proximo={{
        data: agendamento?.data ?? null,
        nota: agendamento?.nota ?? null,
        situacao: situacaoAgendamento(agendamento),
      }}
    />
  )
}
