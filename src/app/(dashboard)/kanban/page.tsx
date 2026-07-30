import { Header } from '@/components/layout/header'
import { KanbanView } from '@/components/kanban/view'
import { ViewSwitcher } from '@/components/kanban/view-switcher'
import { PacientesView } from '@/components/kanban/pacientes/pacientes-view'
import { createClient } from '@/lib/supabase/server'
import { PACIENTE_RESUMO_FIELDS } from '@/types'
import type { PacienteResumo, Triagem, TriagemLead } from '@/types'

export const revalidate = 0

interface PageProps {
  searchParams: Promise<{ view?: string }>
}

export default async function KanbanPage({ searchParams }: PageProps) {
  const { view } = await searchParams
  const isPacientes = view === 'pacientes'

  let leads: TriagemLead[] = []
  let leadsError: string | null = null

  if (!isPacientes) {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('triagem_hsm')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(500)
    leads = ((data ?? []) as Triagem[]).map((t) => ({ ...t }))
    leadsError = error?.message ?? null

    // Concilia lead ↔ paciente: busca em lote os pacientes vinculados via paciente_id.
    const pacienteIds = Array.from(
      new Set(leads.map((t) => t.paciente_id).filter((id): id is string => !!id))
    )
    if (pacienteIds.length > 0) {
      const { data: pacientes } = await supabase
        .from('pacientes')
        .select(PACIENTE_RESUMO_FIELDS)
        .in('id', pacienteIds)
      const byId = new Map(
        ((pacientes ?? []) as PacienteResumo[]).map((p) => [p.id, p])
      )
      for (const lead of leads) {
        lead.paciente = lead.paciente_id ? byId.get(lead.paciente_id) ?? null : null
      }
    }
  }

  // Header e alternador de visão são renderizados por cada view (client), porque a
  // busca do header controla o filtro do funil.
  if (isPacientes) return <PacientesView />

  if (leadsError) {
    return (
      <>
        <Header title="Funil" subtitle="Funil unificado — leads e pacientes" />
        <ViewSwitcher current="leads" />
        <div className="bg-danger-500/10 border border-danger-500/30 rounded-lg p-4 text-sm text-danger-500">
          Erro ao carregar dados: {leadsError}
        </div>
      </>
    )
  }

  return <KanbanView triagens={leads} />
}
