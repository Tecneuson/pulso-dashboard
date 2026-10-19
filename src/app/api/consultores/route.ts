import { NextResponse, type NextRequest } from 'next/server'
import { requireUserApi } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { pessoaCreateSchema, pessoaPatchSchema, zodMensagem } from '@/lib/validation'

/**
 * Consultores: quem intermedeia entre a família e o hospital (médico, psicólogo,
 * clínica, outro hospital). Ficha completa — nome, telefone, e-mail e CPF — porque
 * o mesmo consultor costuma voltar em vários atendimentos.
 *
 * Lista ÚNICA: é a mesma usada no card do lead, na origem da conversa e no
 * atributo `consultor_origem` do Chatwoot.
 */

/** Quantos leads apontam para cada consultor (some no card como "vinculado a N"). */
async function comVinculos(rows: Record<string, unknown>[]): Promise<Record<string, unknown>[]> {
  if (!rows.length) return rows
  try {
    const admin = createAdminClient()
    const { data } = await admin
      .from('triagem_hsm')
      .select('consultor_id')
      .not('consultor_id', 'is', null)
      .limit(10000)
    const contagem = new Map<string, number>()
    for (const r of (data ?? []) as { consultor_id: string }[]) {
      contagem.set(r.consultor_id, (contagem.get(r.consultor_id) ?? 0) + 1)
    }
    return rows.map((r) => ({ ...r, vinculos: contagem.get(r.id as string) ?? 0 }))
  } catch {
    return rows // coluna ainda não existe (migration pendente)
  }
}

export async function GET() {
  const { supabase, error } = await requireUserApi()
  if (error) return error

  const { data, error: dbErr } = await supabase
    .from('consultores')
    .select('*')
    .order('nome', { ascending: true })

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })
  return NextResponse.json({ rows: await comVinculos(data ?? []) })
}

export async function POST(request: NextRequest) {
  const { supabase, error } = await requireUserApi({ gestor: true })
  if (error) return error

  const parsed = pessoaCreateSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: zodMensagem(parsed.error) }, { status: 400 })

  let { data, error: dbErr } = await supabase.from('consultores').insert(parsed.data).select('*').single()

  // Migration 20260831 pendente: grava sem o CPF em vez de recusar o cadastro.
  if (dbErr && /cpf/i.test(dbErr.message) && /column|schema cache/i.test(dbErr.message)) {
    const { cpf: _cpf, ...semCpf } = parsed.data
    void _cpf
    ;({ data, error: dbErr } = await supabase.from('consultores').insert(semCpf).select('*').single())
  }
  if (dbErr) {
    if (dbErr.code === '23505') {
      return NextResponse.json(
        { error: 'Já existe um consultor com esse nome ou CPF.' },
        { status: 409 }
      )
    }
    return NextResponse.json({ error: dbErr.message }, { status: 500 })
  }
  return NextResponse.json({ row: data })
}

export async function PATCH(request: NextRequest) {
  const { supabase, error } = await requireUserApi({ gestor: true })
  if (error) return error

  const parsed = pessoaPatchSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: zodMensagem(parsed.error) }, { status: 400 })
  const { id, ...patch } = parsed.data
  if (!Object.keys(patch).length) return NextResponse.json({ error: 'nada a atualizar' }, { status: 400 })

  const { data, error: dbErr } = await supabase
    .from('consultores')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single()

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })
  return NextResponse.json({ row: data })
}

/**
 * Remover = desativar. Apagar de verdade quebraria o histórico: os leads
 * vinculados perderiam a referência do consultor que os encaminhou.
 */
export async function DELETE(request: NextRequest) {
  const { supabase, error } = await requireUserApi({ gestor: true })
  if (error) return error
  const id = request.nextUrl.searchParams.get('id')
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 })

  const { error: dbErr } = await supabase.from('consultores').update({ ativo: false }).eq('id', id)
  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
