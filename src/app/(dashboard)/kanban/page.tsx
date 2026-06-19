import { Header } from '@/components/layout/header'
import { KanbanView } from '@/components/kanban/view'
import { ViewSwitcher } from '@/components/kanban/view-switcher'
import { PacientesView } from '@/components/kanban/pacientes/pacientes-view'
import { createClient } from '@/lib/supabase/server'
import type { Triagem } from '@/types'

export const revalidate = 0

interface PageProps {
  searchParams: Promise<{ view?: string }>
}

export default async function KanbanPage({ searchParams }: PageProps) {
  const { view } = await searchParams
  const isPacientes = view === 'pacientes'

  let leads: Triagem[] = []
  let leadsError: string | null = null

  if (!isPacientes) {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('triagem_hsm')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(500)
    leads = (data ?? []) as Triagem[]
    leadsError = error?.message ?? null
  }

  return (
    <>
      <Header
        title={isPacientes ? 'Pacientes' : 'Kanban'}
        subtitle={isPacientes ? 'Base de reativação de ex-pacientes' : 'Funil de atendimento'}
      />

      <ViewSwitcher current={isPacientes ? 'pacientes' : 'leads'} />

      {isPacientes ? (
        <PacientesView />
      ) : leadsError ? (
        <div className="bg-danger-500/10 border border-danger-500/30 rounded-lg p-4 text-sm text-danger-500">
          Erro ao carregar dados: {leadsError}
        </div>
      ) : (
        <KanbanView triagens={leads} />
      )}
    </>
  )
}
