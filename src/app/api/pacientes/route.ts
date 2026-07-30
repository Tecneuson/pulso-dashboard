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
  const convenios = (sp.get('convenio') ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  const estagio = sp.get('estagio')
  const limit = Math.min(Number(sp.get('limit')) || 50, 200)
  const offset = Math.max(Number(sp.get('offset')) || 0, 0)

  let query = supabase.from('pacientes').select('*', { count: 'exact' })

  if (q) {
    // Busca unificada. Dígitos digitados (após remover máscara) casam com CPF por
    // prefixo — o CPF é guardado normalizado (11 dígitos) em `pacientes.cpf`.
    const digitos = q.replace(/\D/g, '')
    if (!digitos) {
      // Só texto → busca por nome (fora do .or() para não colidir com vírgulas/parênteses).
      query = query.ilike('nome_cliente', `%${q}%`)
    } else {
      // Valores dentro do .or() vão entre aspas duplas — escape do PostgREST para
      // vírgula/parêntese no texto (senão o parser da árvore lógica quebra → 500).
      // Aspas duplas no próprio termo são removidas (não há nome com aspas na base).
      const qSafe = q.replace(/"/g, '')
      const orParts = [`nome_cliente.ilike."%${qSafe}%"`]
      // Nº do identificador (vínculo lead→paciente): só quando q é puramente numérico e
      // cabe em int (evita "value out of range" no Postgres ao digitar um CPF de 11 dígitos).
      if (/^\d+$/.test(q) && Number(q) <= 2147483647) {
        orParts.push(`identificador_cliente.eq.${q}`)
      }
      // CPF por prefixo dos dígitos digitados.
      orParts.push(`cpf.like."${digitos}%"`)
      query = query.or(orParts.join(','))
    }
  }
  if (classificacao) query = query.eq('classificacao_cliente', classificacao)
  if (convenios.length === 1) query = query.eq('convenio_normalizado', convenios[0])
  else if (convenios.length > 1) query = query.in('convenio_normalizado', convenios)
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
  if (!id || typeof body !== 'object') {
    return NextResponse.json({ error: 'id obrigatório' }, { status: 400 })
  }

  const patch: Record<string, unknown> = {}
  if (typeof body.estagio_reativacao === 'string') {
    if (!ESTAGIO_REATIVACAO.includes(body.estagio_reativacao as EstagioReativacao)) {
      return NextResponse.json({ error: 'estagio_reativacao inválido' }, { status: 400 })
    }
    patch.estagio_reativacao = body.estagio_reativacao
  }
  // Vínculo de captador (uuid ou null).
  if ('captador_id' in body) patch.captador_id = body.captador_id ?? null

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'nada a atualizar' }, { status: 400 })
  }

  const { error } = await supabase.from('pacientes').update(patch).eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
