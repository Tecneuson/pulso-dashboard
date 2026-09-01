import { Header } from '@/components/layout/header'
import { KanbanView } from '@/components/kanban/view'
import { createClient } from '@/lib/supabase/server'
import { PACIENTE_RESUMO_FIELDS } from '@/types'
import type { PacienteResumo, Triagem, TriagemLead } from '@/types'

export const revalidate = 0

export default async function KanbanPage() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('triagem_hsm')
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(500)

  const leads: TriagemLead[] = ((data ?? []) as Triagem[]).map((t) => ({ ...t }))
  const leadsError = error?.message ?? null

  // Quem falou primeiro sobre cada paciente — vira a tag ao lado do nome no card.
  // Uma consulta só para todos os leads (o card não pode disparar N buscas).
  if (leads.length > 0) {
    const { data: vinculos } = await supabase
      .from('contato_vinculos')
      .select('triagem_id, papel, principal, created_at, responsaveis(nome), consultores(nome)')
      .in('triagem_id', leads.map((l) => l.id))
      .order('principal', { ascending: false })
      .order('created_at', { ascending: true })

    type LinhaVinculo = {
      triagem_id: string
      responsaveis?: { nome: string } | { nome: string }[] | null
      consultores?: { nome: string } | { nome: string }[] | null
    }
    const primeiro = new Map<string, string>()
    for (const v of (vinculos ?? []) as LinhaVinculo[]) {
      if (primeiro.has(v.triagem_id)) continue
      const pessoa = v.responsaveis ?? v.consultores
      const nome = Array.isArray(pessoa) ? pessoa[0]?.nome : pessoa?.nome
      if (nome) primeiro.set(v.triagem_id, nome)
    }
    for (const lead of leads) lead.contato_principal = primeiro.get(lead.id) ?? null
  }

  // Concilia lead ↔ paciente: busca em lote os pacientes vinculados via paciente_id.
  const pacienteIds = Array.from(
    new Set(leads.map((t) => t.paciente_id).filter((id): id is string => !!id))
  )
  if (pacienteIds.length > 0) {
    const { data: pacientes } = await supabase
      .from('pacientes')
      .select(PACIENTE_RESUMO_FIELDS)
      .in('id', pacienteIds)
    const byId = new Map(((pacientes ?? []) as PacienteResumo[]).map((p) => [p.id, p]))
    for (const lead of leads) {
      lead.paciente = lead.paciente_id ? byId.get(lead.paciente_id) ?? null : null
    }
  }

  // O Header é renderizado pela view (client), porque a busca dele controla o filtro.
  if (leadsError) {
    return (
      <>
        <Header title="Funil" subtitle="Funil unificado — leads e pacientes" />
        <div className="bg-danger-500/10 border border-danger-500/30 rounded-lg p-4 text-sm text-danger-500">
          Erro ao carregar dados: {leadsError}
        </div>
      </>
    )
  }

  return <KanbanView triagens={leads} />
}
