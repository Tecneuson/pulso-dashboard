import { NextResponse, type NextRequest } from 'next/server'
import { requireUserApi } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { pessoaCreateSchema, pessoaPatchSchema, zodMensagem } from '@/lib/validation'

/**
 * Responsáveis pelo paciente (familiar, amigo ou responsável legal que faz o contato).
 * Mesma ficha do consultor: nome, telefone, e-mail e CPF. Um responsável pode estar
 * vinculado a vários leads — por isso é cadastro, e não texto solto no card.
 */

/** Quantos leads apontam para cada responsável (mostrado no campo do card). */
async function comVinculos(rows: Record<string, unknown>[]): Promise<Record<string, unknown>[]> {
  if (!rows.length) return rows
  try {
    const admin = createAdminClient()
    const { data } = await admin
      .from('triagem_hsm')
      .select('responsavel_contato_id')
      .not('responsavel_contato_id', 'is', null)
      .limit(10000)
    const contagem = new Map<string, number>()
    for (const r of (data ?? []) as { responsavel_contato_id: string }[]) {
      contagem.set(r.responsavel_contato_id, (contagem.get(r.responsavel_contato_id) ?? 0) + 1)
    }
    return rows.map((r) => ({ ...r, vinculos: contagem.get(r.id as string) ?? 0 }))
  } catch {
    return rows // coluna ainda não existe (migration pendente) — segue sem a contagem
  }
}

export async function GET() {
  const { supabase, error } = await requireUserApi()
  if (error) return error

  const { data, error: dbErr } = await supabase
    .from('responsaveis')
    .select('*')
    .order('nome', { ascending: true })

  if (dbErr) {
    // Tabela ainda não migrada: devolve vazio para a tela continuar utilizável.
    if (/does not exist|schema cache/i.test(dbErr.message)) {
      return NextResponse.json({ rows: [], aviso: 'tabela responsaveis pendente de migração' })
    }
    return NextResponse.json({ error: dbErr.message }, { status: 500 })
  }
  return NextResponse.json({ rows: await comVinculos(data ?? []) })
}

export async function POST(request: NextRequest) {
  const { supabase, error } = await requireUserApi()
  if (error) return error

  const parsed = pessoaCreateSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: zodMensagem(parsed.error) }, { status: 400 })

  const { data, error: dbErr } = await supabase
    .from('responsaveis')
    .insert(parsed.data)
    .select('*')
    .single()

  if (dbErr) {
    if (/does not exist|schema cache/i.test(dbErr.message)) {
      return NextResponse.json(
        { error: 'Cadastro de responsáveis indisponível: rode a migration 20260831.' },
        { status: 503 }
      )
    }
    if (dbErr.code === '23505') {
      return NextResponse.json({ error: 'Já existe um responsável com esse CPF.' }, { status: 409 })
    }
    return NextResponse.json({ error: dbErr.message }, { status: 500 })
  }
  return NextResponse.json({ row: data })
}

export async function PATCH(request: NextRequest) {
  const { supabase, error } = await requireUserApi()
  if (error) return error

  const parsed = pessoaPatchSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: zodMensagem(parsed.error) }, { status: 400 })
  const { id, ...patch } = parsed.data
  if (!Object.keys(patch).length) return NextResponse.json({ error: 'nada a atualizar' }, { status: 400 })

  const { data, error: dbErr } = await supabase
    .from('responsaveis')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single()

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })
  return NextResponse.json({ row: data })
}

/** Remover = desativar (os leads já vinculados continuam apontando para a ficha). */
export async function DELETE(request: NextRequest) {
  const { supabase, error } = await requireUserApi()
  if (error) return error
  const id = request.nextUrl.searchParams.get('id')
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 })

  const { error: dbErr } = await supabase.from('responsaveis').update({ ativo: false }).eq('id', id)
  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
