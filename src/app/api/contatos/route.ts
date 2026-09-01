import { NextResponse, type NextRequest } from 'next/server'
import { requireUserApi } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { LIMITE_RESPONSAVEIS, type ContatoVinculo } from '@/types'
import { vinculoCreateSchema, zodMensagem } from '@/lib/validation'

/**
 * Contatos de um card: quem já falou com o hospital sobre aquele paciente.
 * Relação N:N — o mesmo responsável/consultor aparece em vários cards, e um card
 * acumula até 4 responsáveis (o limite é garantido por trigger no banco) e
 * quantos consultores forem.
 */

const uuid = /^[0-9a-f-]{36}$/i

/** Junta nome/telefones/e-mail da pessoa a cada vínculo, para a UI não fazer N buscas. */
async function comPessoas(rows: ContatoVinculo[]): Promise<ContatoVinculo[]> {
  if (!rows.length) return rows
  const admin = createAdminClient()
  const respIds = rows.map((r) => r.responsavel_id).filter((v): v is string => !!v)
  const consIds = rows.map((r) => r.consultor_id).filter((v): v is string => !!v)

  const [resp, cons] = await Promise.all([
    respIds.length
      ? admin.from('responsaveis').select('id, nome, telefones, telefone, email, cpf').in('id', respIds)
      : Promise.resolve({ data: [] }),
    consIds.length
      ? admin.from('consultores').select('id, nome, telefones, telefone, email, cpf').in('id', consIds)
      : Promise.resolve({ data: [] }),
  ])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const porId = new Map<string, any>()
  for (const p of [...((resp.data ?? []) as never[]), ...((cons.data ?? []) as never[])]) {
    const pessoa = p as { id: string }
    porId.set(pessoa.id, pessoa)
  }

  return rows.map((v) => {
    const p = porId.get((v.responsavel_id ?? v.consultor_id) as string)
    const telefones: string[] = p?.telefones?.length ? p.telefones : p?.telefone ? [p.telefone] : []
    return { ...v, nome: p?.nome ?? null, telefones, email: p?.email ?? null, cpf: p?.cpf ?? null }
  })
}

export async function GET(request: NextRequest) {
  const { error } = await requireUserApi()
  if (error) return error

  const triagemId = request.nextUrl.searchParams.get('triagem_id')
  if (!triagemId || !uuid.test(triagemId)) {
    return NextResponse.json({ error: 'triagem_id obrigatório' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data, error: dbErr } = await admin
    .from('contato_vinculos')
    .select('*')
    .eq('triagem_id', triagemId)
    .order('principal', { ascending: false })
    .order('created_at', { ascending: true })

  if (dbErr) {
    if (/does not exist|schema cache/i.test(dbErr.message)) return NextResponse.json({ rows: [] })
    return NextResponse.json({ error: dbErr.message }, { status: 500 })
  }
  return NextResponse.json({ rows: await comPessoas((data ?? []) as ContatoVinculo[]) })
}

export async function POST(request: NextRequest) {
  const { user, error } = await requireUserApi()
  if (error) return error

  const parsed = vinculoCreateSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: zodMensagem(parsed.error) }, { status: 400 })
  const { triagem_id, papel, pessoa_id, observacao } = parsed.data

  const admin = createAdminClient()
  const linha = {
    triagem_id,
    papel,
    responsavel_id: papel === 'responsavel' ? pessoa_id : null,
    consultor_id: papel === 'consultor' ? pessoa_id : null,
    observacao: observacao ?? null,
    // O primeiro contato do card é o principal.
    principal: false,
  }

  const { data, error: dbErr } = await admin.from('contato_vinculos').insert(linha).select('*').single()

  if (dbErr) {
    // O limite de 4 é imposto por trigger: devolve mensagem útil em vez de 500.
    if (dbErr.message.includes('LIMITE_RESPONSAVEIS')) {
      return NextResponse.json(
        {
          error: `Este card já tem ${LIMITE_RESPONSAVEIS} responsáveis. Registre o contato no histórico.`,
          limite: true,
        },
        { status: 409 }
      )
    }
    if (dbErr.code === '23505') {
      return NextResponse.json({ error: 'Essa pessoa já está vinculada a este card.' }, { status: 409 })
    }
    return NextResponse.json({ error: dbErr.message }, { status: 500 })
  }

  // Vincular é informação de atendimento: entra no histórico do card.
  const { data: autor } = await admin.from('usuarios').select('nome').eq('id', user!.id).maybeSingle()
  const [comPessoa] = await comPessoas([data as ContatoVinculo])
  await admin.from('anotacoes').insert({
    triagem_id,
    usuario_id: user!.id,
    conteudo: `🔗 ${papel === 'responsavel' ? 'Responsável' : 'Consultor'} vinculado: ${comPessoa.nome ?? '—'}`,
    origem: 'crm',
    autor_nome: (autor?.nome as string | undefined) ?? null,
  })

  return NextResponse.json({ row: comPessoa })
}

export async function DELETE(request: NextRequest) {
  const { user, error } = await requireUserApi()
  if (error) return error
  const id = request.nextUrl.searchParams.get('id')
  if (!id || !uuid.test(id)) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 })

  const admin = createAdminClient()
  const { data: atual } = await admin.from('contato_vinculos').select('*').eq('id', id).maybeSingle()
  const { error: dbErr } = await admin.from('contato_vinculos').delete().eq('id', id)
  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })

  if (atual) {
    const [comPessoa] = await comPessoas([atual as ContatoVinculo])
    await admin.from('anotacoes').insert({
      triagem_id: (atual as ContatoVinculo).triagem_id,
      usuario_id: user!.id,
      conteudo: `🔗 Vínculo removido: ${comPessoa.nome ?? '—'}`,
      origem: 'crm',
    })
  }
  return NextResponse.json({ ok: true })
}
