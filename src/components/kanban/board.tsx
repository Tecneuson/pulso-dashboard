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
import { FUNNEL_STAGES } from '@/types'
import type { ContactWithPlan, FunnelStage } from '@/types'
import { groupByStage } from '@/lib/mock-data'
import { KanbanColumn } from './column'
import { KanbanCard } from './card'

interface KanbanBoardProps {
  contacts: ContactWithPlan[]
  onStageChange?: (contactId: string, newStage: FunnelStage) => void
  onCardClick?: (contact: ContactWithPlan) => void
}

export function KanbanBoard({ contacts, onStageChange, onCardClick }: KanbanBoardProps) {
  const [items, setItems] = useState(() => groupByStage(contacts))
  const [activeContact, setActiveContact] = useState<ContactWithPlan | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  function handleDragStart(event: DragStartEvent) {
    const contact = contacts.find((c) => c.id === event.active.id)
    if (contact) setActiveContact(contact)
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveContact(null)
    const { active, over } = event
    if (!over) return

    const contactId = active.id as string
    const targetStage = over.id as FunnelStage

    // Find current stage
    let sourceStage: FunnelStage | null = null
    for (const stage of FUNNEL_STAGES) {
      if (items[stage].some((c) => c.id === contactId)) {
        sourceStage = stage
        break
      }
    }

    if (!sourceStage || sourceStage === targetStage) return

    // Move contact between stages
    setItems((prev) => {
      const contact = prev[sourceStage!].find((c) => c.id === contactId)
      if (!contact) return prev

      return {
        ...prev,
        [sourceStage!]: prev[sourceStage!].filter((c) => c.id !== contactId),
        [targetStage]: [...prev[targetStage], { ...contact, funnel_stage: targetStage }],
      }
    })

    onStageChange?.(contactId, targetStage)
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-3 overflow-x-auto pb-4 min-h-[calc(100vh-10rem)]">
        {FUNNEL_STAGES.map((stage) => (
          <KanbanColumn key={stage} stage={stage} contacts={items[stage]} onCardClick={onCardClick} />
        ))}
      </div>

      <DragOverlay>
        {activeContact && <KanbanCard contact={activeContact} isDragOverlay />}
      </DragOverlay>
    </DndContext>
  )
}
