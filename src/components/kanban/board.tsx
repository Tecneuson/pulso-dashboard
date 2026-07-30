'use client'

import { useEffect, useMemo, useState } from 'react'
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
import { CLASSIFICACAO_INTERNADO } from '@/types'
import type { Paciente } from '@/types'
import { COLUNAS_CLASSIFICACAO } from '@/lib/funil'
import { FUNIL_ETAPAS, type FunilEtapa, type LeadComEtapa } from '@/lib/funil-etapas'
import { KanbanColumn } from './column'
import { KanbanCard } from './card'
import { PacienteColumn, PacientesInternadosSection, type PacienteQuery } from './paciente-funil'
import { PacienteDetail } from './pacientes/paciente-detail'

function groupByEtapa(leads: LeadComEtapa[]): Record<FunilEtapa, LeadComEtapa[]> {
  const init = FUNIL_ETAPAS.reduce(
    (acc, e) => ({ ...acc, [e]: [] }),
    {} as Record<FunilEtapa, LeadComEtapa[]>
  )
  for (const t of leads) {
    ;(init[t.etapa] ?? init.contato).push(t)
  }
  return init
}

interface KanbanBoardProps {
  triagens: LeadComEtapa[]
  onStageChange?: (id: string, etapa: FunilEtapa) => void
  /** Arrastar p/ Internação: exige número do paciente, então abre o card em vez de mover. */
  onInternarRequest?: (id: string) => void
  onCardClick?: (triagem: LeadComEtapa) => void
  /** Busca/convênios aplicados no servidor às colunas de pacientes. */
  pacienteQuery?: PacienteQuery
  /** Classificações selecionadas no filtro: restringem quais colunas de paciente aparecem. */
  classificacoesFiltro?: string[]
  /** Etapas selecionadas no filtro. Vazio = mostra todas as colunas. */
  etapasVisiveis?: string[]
  /**
   * A coluna "Perdido" fica oculta por padrão — só aparece quando há busca ou
   * filtro de perda ativo.
   */
  mostrarPerdidos?: boolean
}

export function KanbanBoard({
  triagens,
  onStageChange,
  onInternarRequest,
  onCardClick,
  pacienteQuery = {},
  classificacoesFiltro = [],
  etapasVisiveis = [],
  mostrarPerdidos = false,
}: KanbanBoardProps) {
  const [items, setItems] = useState(() => groupByEtapa(triagens))
  const [active, setActive] = useState<LeadComEtapa | null>(null)
  const [selectedPaciente, setSelectedPaciente] = useState<Paciente | null>(null)

  // Re-agrupa quando a lista muda (salvamentos no card-detail, rollback de drag).
  useEffect(() => {
    setItems(groupByEtapa(triagens))
  }, [triagens])

  // Card único por paciente: quem já está conciliado a um lead do board não
  // aparece de novo nas colunas de classificação.
  const linkedPacienteIds = useMemo(() => {
    const ids = new Set<string>()
    for (const s of FUNIL_ETAPAS) {
      for (const t of items[s]) if (t.paciente_id) ids.add(t.paciente_id)
    }
    return ids
  }, [items])

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
    const target = over.id as FunilEtapa
    // Colunas de classificação não são droppable; só etapas do funil persistem.
    if (!FUNIL_ETAPAS.includes(target)) return

    let source: FunilEtapa | null = null
    for (const s of FUNIL_ETAPAS) {
      if (items[s].some((t) => t.id === id)) {
        source = s
        break
      }
    }

    if (!source || source === target) return

    // Internar exige o número do paciente: não move direto, abre o card no painel.
    if (target === 'internacao') {
      onInternarRequest?.(id)
      return
    }

    setItems((prev) => {
      const t = prev[source!].find((x) => x.id === id)
      if (!t) return prev
      return {
        ...prev,
        [source!]: prev[source!].filter((x) => x.id !== id),
        [target]: [...prev[target], { ...t, etapa: target }],
      }
    })

    onStageChange?.(id, target)
  }

  // Filtro de etapa ativo: mostra só as colunas selecionadas (as não selecionadas
  // somem). Sem filtro de etapa → todas as 6 colunas.
  const semFiltroEtapa = etapasVisiveis.length === 0
  const etapasParaMostrar = (
    semFiltroEtapa ? FUNIL_ETAPAS : FUNIL_ETAPAS.filter((e) => etapasVisiveis.includes(e))
  ).filter((e) => e !== 'perdido' || mostrarPerdidos)

  // Filtro de classificação (multi): mostra só as colunas selecionadas; 'sem_paciente'
  // (ou nenhuma classificação de paciente marcada) esconde as colunas. Ao filtrar por
  // etapa, as colunas de pacientes (base de reativação) também somem.
  const semFiltroClassif = classificacoesFiltro.length === 0
  const mostraInternados =
    semFiltroEtapa && (semFiltroClassif || classificacoesFiltro.includes(CLASSIFICACAO_INTERNADO))
  const colunasVisiveis = semFiltroEtapa
    ? COLUNAS_CLASSIFICACAO.filter(
        (meta) => semFiltroClassif || classificacoesFiltro.includes(meta.value)
      )
    : []

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      {/* Altura travada na tela: o board rola na horizontal e CADA coluna rola por dentro. */}
      <div className="flex gap-3 overflow-x-auto h-full min-h-0 pb-2">
        {etapasParaMostrar.map((etapa) => (
          <KanbanColumn
            key={etapa}
            etapa={etapa}
            triagens={items[etapa]}
            onCardClick={onCardClick}
            footer={
              etapa === 'internacao' && mostraInternados ? (
                <PacientesInternadosSection
                  classificacao={CLASSIFICACAO_INTERNADO}
                  excludeIds={linkedPacienteIds}
                  query={pacienteQuery}
                  onCardClick={setSelectedPaciente}
                />
              ) : undefined
            }
          />
        ))}

        {/* Colunas de classificação (pós-Internação): somente leitura, paginadas */}
        {colunasVisiveis.map((meta) => (
          <PacienteColumn
            key={meta.value}
            meta={meta}
            excludeIds={linkedPacienteIds}
            query={pacienteQuery}
            onCardClick={setSelectedPaciente}
          />
        ))}
      </div>

      <DragOverlay>{active && <KanbanCard triagem={active} isDragOverlay />}</DragOverlay>

      <PacienteDetail
        paciente={selectedPaciente}
        open={!!selectedPaciente}
        onClose={() => setSelectedPaciente(null)}
      />
    </DndContext>
  )
}
