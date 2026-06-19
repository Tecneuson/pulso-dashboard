import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { ESTAGIO_REATIVACAO, type EstagioReativacao } from '@/types'

// Lista paginada/filtrada de pacientes. Server-side: roda com a sessão do usuário
// (cookies) → RLS garante que só autenticados leem. Filtros viram WHERE no Postgres.
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const sp = request.nextUrl.searchParams
  const q = sp.get('q')?.trim()
  const classificacao = sp.get('classificacao')
  const convenio = sp.get('convenio')
  const estagio = sp.get('estagio')
  const limit = Math.min(Number(sp.get('limit')) || 50, 200)
  const offset = Math.max(Number(sp.get('offset')) || 0, 0)

  let query = supabase.from('pacientes').select('*', { count: 'exact' })

  if (q) query = query.ilike('nome_cliente', `%${q}%`)
  if (classificacao) query = query.eq('classificacao_cliente', classificacao)
  if (convenio) query = query.eq('convenio_normalizado', convenio)
  if (estagio && ESTAGIO_REATIVACAO.includes(estagio as EstagioReativacao)) {
    query = query.eq('estagio_reativacao', estagio)
  }

  query = query
    .order('data_emissao_max', { ascending: false, nullsFirst: false })
    .range(offset, offset + limit - 1)

  const { data, count, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ rows: data ?? [], count: count ?? 0 })
}

// Atualiza o estágio de reativação de um paciente (board). Server-side + RLS.
export async function PATCH(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => null)
  const id: string | undefined = body?.id
  const estagio: string | undefined = body?.estagio_reativacao

  if (!id || !estagio || !ESTAGIO_REATIVACAO.includes(estagio as EstagioReativacao)) {
    return NextResponse.json({ error: 'invalid payload' }, { status: 400 })
  }

  const { error } = await supabase
    .from('pacientes')
    .update({ estagio_reativacao: estagio })
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
