'use client'

import { useState } from 'react'
import { Filter } from 'lucide-react'
import { KanbanBoard } from './board'
import { CardDetail } from './card-detail'
import { Select, Button } from '@/components/ui'
import { createClient } from '@/lib/supabase/client'
import type { Triagem, EstagioFunil } from '@/types'

interface KanbanViewProps {
  triagens: Triagem[]
}

export function KanbanView({ triagens }: KanbanViewProps) {
  const [selected, setSelected] = useState<Triagem | null>(null)
  const [showFilters, setShowFilters] = useState(false)
  const [items, setItems] = useState(triagens)

  async function handleStageChange(id: string, newStage: EstagioFunil) {
    setItems((prev) =>
      prev.map((t) => (t.id === id ? { ...t, estagio_funil: newStage } : t))
    )

    const supabase = createClient()
    const { error } = await supabase
      .from('triagem_hsm')
      .update({ estagio_funil: newStage })
      .eq('id', id)

    if (error) {
      console.error('Falha ao salvar estágio:', error.message)
    }
  }

  return (
    <>
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
              { value: 'amil', label: 'Amil' },
              { value: 'bradesco_saude', label: 'Bradesco Saúde' },
              { value: 'omint', label: 'Omint' },
              { value: 'prevent_senior', label: 'Prevent Sênior' },
              { value: 'sulamerica', label: 'SulAmérica' },
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
            placeholder="Assunto"
            options={[
              { value: 'internacao', label: 'Internação' },
              { value: 'consulta', label: 'Consulta' },
              { value: 'informacao_paciente', label: 'Informação' },
              { value: 'administrativo', label: 'Administrativo' },
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

      <KanbanBoard
        triagens={items}
        onStageChange={handleStageChange}
        onCardClick={setSelected}
      />

      <CardDetail
        triagem={selected}
        open={!!selected}
        onClose={() => setSelected(null)}
      />
    </>
  )
}
