import { NextResponse, type NextRequest } from 'next/server'
import { requireUserApi } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { espelharNotaNoChatwoot } from '@/lib/chatwoot/sync'
import { anotacaoCreateSchema, zodMensagem } from '@/lib/validation'

// Anotações de triagem (histórico do lead). Vão para o Chatwoot como NOTA PRIVADA na
// conversa; notas escritas no Chatwoot chegam aqui pelo webhook (message_created, private).
// A RLS de `anotacoes` foi escrita para o modelo legado (sessoes_conversa) e bloquearia
// atendentes em anotações de triagem — por isso a rota autentica a sessão e opera via
// service role.

const SELECT = 'id, triagem_id, usuario_id, conteudo, created_at, origem, autor_nome, chatwoot_message_id, usuarios(nome)'
const SELECT_LEGADO = 'id, triagem_id, usuario_id, conteudo, created_at, usuarios(nome)'

export async function GET(request: NextRequest) {
  const { error } = await requireUserApi()
  if (error) return error

  const triagemId = request.nextUrl.searchParams.get('triagem_id')
  if (!triagemId || !/^[0-9a-f-]{36}$/i.test(triagemId)) {
    return NextResponse.json({ error: 'triagem_id obrigatório' }, { status: 400 })
  }

  const admin = createAdminClient()
  const consulta = (select: string) =>
    admin.from('anotacoes').select(select).eq('triagem_id', triagemId).order('created_at', { ascending: false }).limit(200)

  let data: unknown[] | null = null
  let dbErr: { message: string } | null = null
  {
    const r = await consulta(SELECT)
    data = r.data as unknown[] | null
    dbErr = r.error
  }
  // Migration 20260823 ainda não rodou → cai para as colunas antigas.
  if (dbErr && /column|does not exist/i.test(dbErr.message)) {
    const r = await consulta(SELECT_LEGADO)
    data = r.data as unknown[] | null
    dbErr = r.error
  }

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })
  return NextResponse.json({ rows: data ?? [] })
}

export async function POST(request: NextRequest) {
  const { user, error } = await requireUserApi()
  if (error) return error

  const parsed = anotacaoCreateSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: zodMensagem(parsed.error) }, { status: 400 })
  const { triagem_id: triagemId, conteudo } = parsed.data

  const admin = createAdminClient()
  const { data: lead } = await admin
    .from('triagem_hsm')
    .select('id, conversation_id')
    .eq('id', triagemId)
    .maybeSingle()
  if (!lead) return NextResponse.json({ error: 'lead não encontrado' }, { status: 404 })

  const { data: autor } = await admin.from('usuarios').select('nome').eq('id', user!.id).maybeSingle()
  const nomeAutor = (autor?.nome as string | undefined) || user!.email || 'Equipe'

  // 1) Chatwoot primeiro (para gravar o id da mensagem e não importar o eco).
  let chatwootMessageId: number | null = null
  if (lead.conversation_id) {
    chatwootMessageId = await espelharNotaNoChatwoot(lead.conversation_id, nomeAutor, conteudo)
  }

  const row = {
    triagem_id: triagemId,
    usuario_id: user!.id,
    conteudo,
    origem: 'crm',
    autor_nome: nomeAutor,
    chatwoot_message_id: chatwootMessageId,
  }
  let data: unknown = null
  let dbErr: { message: string; code?: string } | null = null
  {
    const r = await admin.from('anotacoes').insert(row).select(SELECT).single()
    data = r.data
    dbErr = r.error
  }
  if (dbErr && /column|does not exist/i.test(dbErr.message)) {
    const r = await admin
      .from('anotacoes')
      .insert({ triagem_id: triagemId, usuario_id: user!.id, conteudo })
      .select(SELECT_LEGADO)
      .single()
    data = r.data
    dbErr = r.error
  }

  if (dbErr) {
    // FK de usuario_id: o usuário autenticado precisa existir em `usuarios`.
    const msg = dbErr.code === '23503' ? 'Usuário não cadastrado na equipe (tabela usuarios).' : dbErr.message
    return NextResponse.json({ error: msg }, { status: 500 })
  }
  return NextResponse.json({
    ok: true,
    anotacao: data,
    chatwoot: lead.conversation_id ? (chatwootMessageId ? 'ok' : 'failed') : 'skipped',
  })
}
