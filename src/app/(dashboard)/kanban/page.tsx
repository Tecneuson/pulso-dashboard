'use client'

import { useState } from 'react'
import { Filter } from 'lucide-react'
import { Header } from '@/components/layout/header'
import { KanbanBoard } from '@/components/kanban/board'
import { CardDetail } from '@/components/kanban/card-detail'
import { Select, Button } from '@/components/ui'
import { kanbanContacts } from '@/lib/mock-data'
import type { ContactWithPlan, FunnelStage } from '@/types'

export default function KanbanPage() {
  const [selectedContact, setSelectedContact] = useState<ContactWithPlan | null>(null)
  const [showFilters, setShowFilters] = useState(false)

  function handleStageChange(contactId: string, newStage: FunnelStage) {
    // TODO: call API to update funnel_stage
    console.log(`Contact ${contactId} moved to ${newStage}`)
  }

  return (
    <>
      <Header title="Kanban" subtitle="Funil de atendimento" />

      {/* Filters bar */}
      <div className="flex items-center gap-3 mb-4">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setShowFilters(!showFilters)}
        >
          <Filter size={14} />
          Filtros
        </Button>
      </div>

      {showFilters && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4 p-3 bg-surface-secondary border border-border rounded-lg animate-fade-up">
          <Select
            placeholder="Convênio"
            options={[
              { value: 'bradesco_saude', label: 'Bradesco Saúde' },
              { value: 'sulamerica', label: 'SulAmérica' },
              { value: 'amil', label: 'Amil' },
              { value: 'care_plus', label: 'Care Plus' },
              { value: 'porto_saude', label: 'Porto Saúde' },
            ]}
          />
          <Select
            placeholder="Motivo"
            options={[
              { value: 'transtorno_mental_adulto', label: 'Transtorno mental adulto' },
              { value: 'transtorno_mental_infantojuvenil', label: 'Transtorno infantojuvenil' },
              { value: 'abuso_de_substancias', label: 'Abuso de substâncias' },
            ]}
          />
          <Select
            placeholder="Agente"
            options={[
              { value: 'all', label: 'Todos os agentes' },
            ]}
          />
          <Select
            placeholder="Período"
            options={[
              { value: 'today', label: 'Hoje' },
              { value: 'week', label: 'Esta semana' },
              { value: 'month', label: 'Este mês' },
            ]}
          />
        </div>
      )}

      {/* Board */}
      <KanbanBoard
        contacts={kanbanContacts}
        onStageChange={handleStageChange}
        onCardClick={setSelectedContact}
      />

      {/* Detail drawer */}
      <CardDetail
        contact={selectedContact}
        open={!!selectedContact}
        onClose={() => setSelectedContact(null)}
      />
    </>
  )
}
