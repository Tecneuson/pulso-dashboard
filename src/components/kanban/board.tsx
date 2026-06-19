'use client'

import { useState } from 'react'
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core'
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { ESTAGIO_FUNIL } from '@/types'
import type { Triagem, EstagioFunil } from '@/types'
import { KanbanColumn } from './column'
import { KanbanCard } from './card'

function groupByStage(triagens: Triagem[]): Record<EstagioFunil, Triagem[]> {
  const init = ESTAGIO_FUNIL.reduce(
    (acc, s) => ({ ...acc, [s]: [] }),
    {} as Record<EstagioFunil, Triagem[]>
  )
  for (const t of triagens) {
    const stage = (t.estagio_funil ?? 'em_atendimento') as EstagioFunil
    if (init[stage]) init[stage].push(t)
    else init.em_atendimento.push(t)
  }
  return init
}

interface KanbanBoardProps {
  triagens: Triagem[]
  onStageChange?: (id: string, newStage: EstagioFunil) => void
  onCardClick?: (triagem: Triagem) => void
}

export function KanbanBoard({ triagens, onStageChange, onCardClick }: KanbanBoardProps) {
  const [items, setItems] = useState(() => groupByStage(triagens))
  const [active, setActive] = useState<Triagem | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  function handleDragStart(event: DragStartEvent) {
    const t = triagens.find((x) => x.id === event.active.id)
    if (t) setActive(t)
  }

  function handleDragEnd(event: DragEndEvent) {
    setActive(null)
    const { active, over } = event
    if (!over) return

    const id = active.id as string
    const target = over.id as EstagioFunil

    let source: EstagioFunil | null = null
    for (const s of ESTAGIO_FUNIL) {
      if (items[s].some((t) => t.id === id)) {
        source = s
        break
      }
    }

    if (!source || source === target) return

    setItems((prev) => {
      const t = prev[source!].find((x) => x.id === id)
      if (!t) return prev
      return {
        ...prev,
        [source!]: prev[source!].filter((x) => x.id !== id),
        [target]: [...prev[target], { ...t, estagio_funil: target }],
      }
    })

    onStageChange?.(id, target)
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-3 overflow-x-auto pb-4 min-h-[calc(100vh-10rem)]">
        {ESTAGIO_FUNIL.map((stage) => (
          <KanbanColumn
            key={stage}
            stage={stage}
            triagens={items[stage]}
            onCardClick={onCardClick}
          />
        ))}
      </div>

      <DragOverlay>{active && <KanbanCard triagem={active} isDragOverlay />}</DragOverlay>
    </DndContext>
  )
}
