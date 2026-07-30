import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Equipe interna (atendentes/gestores). Alimenta o filtro "Agente de Atendimento"
// e o nome do agente no card do funil.
export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('usuarios')
    .select('id, nome, email, role, ativo')
    .order('nome', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ rows: data ?? [] })
}
