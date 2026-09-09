import { NextResponse, type NextRequest } from 'next/server'
import { requireUserApi } from '@/lib/auth'
import { listarCategorias, CATEGORIAS_PADRAO, SLUGS_SISTEMA } from '@/lib/categorias'
import { categoriaCreateSchema, categoriaPatchSchema, zodMensagem } from '@/lib/validation'

/**
 * Perfis de contato (Paciente, Responsável, Consultor, Terapeuta, Psicólogo, …).
 *
 * Leitura: qualquer pessoa logada — o seletor do card depende dela.
 * Escrita: só gestor, porque mexe no vocabulário que vai para o Chatwoot e para o BI.
 *
 * Enquanto a migration 20260909 não roda, o GET devolve a lista fixa do código e as
 * escritas respondem 503 com a instrução — melhor que um erro de "tabela não existe".
 */

const TABELA_AUSENTE = /categorias_contato|schema cache|does not exist/i

function semTabela() {
  return NextResponse.json(
    { error: 'Rode a migration 20260909_categorias_contato.sql antes de gerenciar os perfis.' },
    { status: 503 }
  )
}

/** "Psicólogo" → "psicologo". O slug é o que fica gravado no lead, então nada de acento. */
function slugificar(label: string): string {
  const base = label
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
  return /^[a-z]/.test(base) ? base.slice(0, 64) : `perfil_${base}`.slice(0, 64)
}

export async function GET(request: NextRequest) {
  const { supabase, error } = await requireUserApi()
  if (error) return error
  const todas = request.nextUrl.searchParams.get('todas') === '1'
  const rows = await listarCategorias(supabase, !todas)
  return NextResponse.json({ rows, padrao: rows === CATEGORIAS_PADRAO })
}

export async function POST(request: NextRequest) {
  const { supabase, error } = await requireUserApi({ gestor: true })
  if (error) return error

  const parsed = categoriaCreateSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: zodMensagem(parsed.error) }, { status: 400 })

  const { label, grupo, descricao, ordem } = parsed.data
  const slug = slugificar(label)
  if (!slug) return NextResponse.json({ error: 'nome inválido' }, { status: 400 })

  const { data, error: dbErr } = await supabase
    .from('categorias_contato')
    .insert({ slug, label, grupo, descricao: descricao ?? null, ordem: ordem ?? 100 })
    .select('*')
    .single()

  if (dbErr) {
    if (dbErr.code === '23505') {
      return NextResponse.json({ error: `Já existe um perfil chamado "${label}".` }, { status: 409 })
    }
    if (TABELA_AUSENTE.test(dbErr.message)) return semTabela()
    return NextResponse.json({ error: dbErr.message }, { status: 500 })
  }
  return NextResponse.json({ row: data })
}

export async function PATCH(request: NextRequest) {
  const { supabase, error } = await requireUserApi({ gestor: true })
  if (error) return error

  const parsed = categoriaPatchSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: zodMensagem(parsed.error) }, { status: 400 })
  const { id, ...patch } = parsed.data
  if (!Object.keys(patch).length) return NextResponse.json({ error: 'nada a atualizar' }, { status: 400 })

  // Renomear um perfil de sistema é permitido (o hospital pode preferir "Paciente" a
  // "Lead"); desativar não, porque leads antigos e o Chatwoot ainda apontam para ele.
  if (patch.ativo === false) {
    const { data: alvo } = await supabase
      .from('categorias_contato')
      .select('slug, sistema')
      .eq('id', id)
      .maybeSingle()
    const row = alvo as { slug: string; sistema: boolean } | null
    if (row && (row.sistema || SLUGS_SISTEMA.includes(row.slug))) {
      return NextResponse.json(
        { error: 'Este perfil é usado pelo Chatwoot e pelos leads antigos — pode renomear, mas não desativar.' },
        { status: 409 }
      )
    }
  }

  const { data, error: dbErr } = await supabase
    .from('categorias_contato')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single()

  if (dbErr) {
    if (TABELA_AUSENTE.test(dbErr.message)) return semTabela()
    return NextResponse.json({ error: dbErr.message }, { status: 500 })
  }
  return NextResponse.json({ row: data })
}

/**
 * Remover = desativar. Apagar de verdade deixaria os leads que usam o perfil apontando
 * para um slug inexistente — o card perderia a categoria e o BI perderia a linha.
 */
export async function DELETE(request: NextRequest) {
  const { supabase, error } = await requireUserApi({ gestor: true })
  if (error) return error
  const id = request.nextUrl.searchParams.get('id')
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 })

  const { data: alvo } = await supabase
    .from('categorias_contato')
    .select('slug, sistema')
    .eq('id', id)
    .maybeSingle()
  const row = alvo as { slug: string; sistema: boolean } | null
  if (row && (row.sistema || SLUGS_SISTEMA.includes(row.slug))) {
    return NextResponse.json(
      { error: 'Este perfil é usado pelo Chatwoot e pelos leads antigos — pode renomear, mas não remover.' },
      { status: 409 }
    )
  }

  const { error: dbErr } = await supabase.from('categorias_contato').update({ ativo: false }).eq('id', id)
  if (dbErr) {
    if (TABELA_AUSENTE.test(dbErr.message)) return semTabela()
    return NextResponse.json({ error: dbErr.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
