import { NextResponse, type NextRequest } from 'next/server'
import { requireUserApi } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { chatwootConfigured, createAttributeDefinition, updateAttributeDefinition } from '@/lib/chatwoot/client'
import { CORE_KEYS } from '@/lib/chatwoot/attributes'
import { invalidarCacheCampos, listarCampos, sincronizarSePreciso } from '@/lib/chatwoot/campos'
import { campoCreateSchema, campoPatchSchema, zodMensagem } from '@/lib/validation'

/**
 * Campos personalizados (espelho do Chatwoot). Leitura: qualquer usuário logado.
 * Escrita: gestor. Criar aqui = criar no Chatwoot na hora (o Chatwoot é a central).
 */

export async function GET() {
  const { error } = await requireUserApi()
  if (error) return error
  await sincronizarSePreciso()
  const rows = await listarCampos()
  return NextResponse.json({ rows, chatwoot: chatwootConfigured() })
}

export async function POST(request: NextRequest) {
  const { error } = await requireUserApi({ gestor: true })
  if (error) return error

  const parsed = campoCreateSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: zodMensagem(parsed.error) }, { status: 400 })
  const c = parsed.data
  if (CORE_KEYS.has(c.chave)) {
    return NextResponse.json({ error: `"${c.chave}" é um campo padrão do sistema` }, { status: 400 })
  }
  if (c.tipo === 'list' && !(c.opcoes?.length)) {
    return NextResponse.json({ error: 'campo do tipo lista precisa de opções' }, { status: 400 })
  }

  // 1) Chatwoot (central) — se falhar, não cria localmente.
  let definitionId: number | null = null
  if (chatwootConfigured()) {
    try {
      const def = await createAttributeDefinition({
        key: c.chave,
        label: c.rotulo,
        modelo: c.modelo,
        tipo: c.tipo,
        opcoes: c.opcoes ?? [],
        descricao: c.descricao ?? null,
      })
      definitionId = def?.id ?? null
    } catch (e) {
      return NextResponse.json({ error: `Chatwoot recusou: ${(e as Error).message}` }, { status: 502 })
    }
  }

  const admin = createAdminClient()
  const { count } = await admin.from('campos_personalizados').select('id', { count: 'exact', head: true })
  const { data, error: dbErr } = await admin
    .from('campos_personalizados')
    .insert({
      chave: c.chave,
      rotulo: c.rotulo,
      descricao: c.descricao ?? null,
      modelo: c.modelo,
      tipo: c.tipo,
      opcoes: c.opcoes ?? [],
      ativo: true,
      ordem: count ?? 0,
      chatwoot_definition_id: definitionId,
    })
    .select('*')
    .single()
  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })
  invalidarCacheCampos()
  return NextResponse.json({ row: data, chatwoot: definitionId ? 'ok' : chatwootConfigured() ? 'failed' : 'skipped' })
}

export async function PATCH(request: NextRequest) {
  const { error } = await requireUserApi({ gestor: true })
  if (error) return error

  const parsed = campoPatchSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: zodMensagem(parsed.error) }, { status: 400 })
  const { id, ...patch } = parsed.data
  if (!Object.keys(patch).length) return NextResponse.json({ error: 'nada a atualizar' }, { status: 400 })

  const admin = createAdminClient()
  const { data: atual } = await admin.from('campos_personalizados').select('*').eq('id', id).maybeSingle()
  if (!atual) return NextResponse.json({ error: 'campo não encontrado' }, { status: 404 })

  // Rótulo/opções/descrição também mudam no Chatwoot (mantém as duas pontas iguais).
  if (chatwootConfigured() && atual.chatwoot_definition_id && ('rotulo' in patch || 'opcoes' in patch || 'descricao' in patch)) {
    try {
      await updateAttributeDefinition(atual.chatwoot_definition_id, {
        label: patch.rotulo,
        opcoes: patch.opcoes,
        descricao: patch.descricao,
      })
    } catch (e) {
      return NextResponse.json({ error: `Chatwoot recusou: ${(e as Error).message}` }, { status: 502 })
    }
  }

  const { data, error: dbErr } = await admin
    .from('campos_personalizados')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single()
  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })
  invalidarCacheCampos()
  return NextResponse.json({ row: data })
}

/**
 * Remover = desativar (os valores já gravados em `atributos` são preservados).
 * A definição no Chatwoot NÃO é apagada automaticamente — apagar lá remove o valor de
 * todos os contatos/conversas; isso fica como decisão humana na tela do Chatwoot.
 */
export async function DELETE(request: NextRequest) {
  const { error } = await requireUserApi({ gestor: true })
  if (error) return error
  const id = request.nextUrl.searchParams.get('id')
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 })
  const admin = createAdminClient()
  const { error: dbErr } = await admin.from('campos_personalizados').update({ ativo: false }).eq('id', id)
  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })
  invalidarCacheCampos()
  return NextResponse.json({ ok: true })
}
