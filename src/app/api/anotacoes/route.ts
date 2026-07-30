import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// Anotações de triagem (funil unificado). A RLS de `anotacoes` foi escrita para
// o modelo legado (sessoes_conversa) e bloquearia atendentes em anotações de
// triagem — por isso a rota autentica a sessão e opera via service role.

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const triagemId = request.nextUrl.searchParams.get('triagem_id')
  if (!triagemId) {
    return NextResponse.json({ error: 'triagem_id obrigatório' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('anotacoes')
    .select('id, triagem_id, usuario_id, conteudo, created_at, usuarios(nome)')
    .eq('triagem_id', triagemId)
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ rows: data ?? [] })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => null)
  const triagemId: string | undefined = body?.triagem_id
  const conteudo: string | undefined =
    typeof body?.conteudo === 'string' ? body.conteudo.trim() : undefined

  if (!triagemId || !conteudo) {
    return NextResponse.json({ error: 'triagem_id e conteudo são obrigatórios' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('anotacoes')
    .insert({ triagem_id: triagemId, usuario_id: user.id, conteudo })
    .select('id, triagem_id, usuario_id, conteudo, created_at, usuarios(nome)')
    .single()

  if (error) {
    // FK de usuario_id: o usuário autenticado precisa existir em `usuarios`.
    const msg = error.code === '23503' ? 'Usuário não cadastrado na equipe (tabela usuarios).' : error.message
    return NextResponse.json({ error: msg }, { status: 500 })
  }
  return NextResponse.json({ ok: true, anotacao: data })
}
