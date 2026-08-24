import { NextResponse, type NextRequest } from 'next/server'
import { requireUserApi } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { isKids } from '@/lib/idade'
import { chatwootConfigured } from '@/lib/chatwoot/client'
import { listarCampos, sincronizarSePreciso } from '@/lib/chatwoot/campos'
import { chatwootAttrsFromAtributos, coerceCampoValor, contactAttrsFromTriagem } from '@/lib/chatwoot/mapping'
import { encontrarOuCriarContato, pushTriagemParaChatwoot } from '@/lib/chatwoot/sync'
import { escreverComRedeDeSeguranca, inserirComRedeDeSeguranca, type AnyObj } from '@/lib/triagem-db'
import { triagemCreateSchema, triagemPatchSchema, zodMensagem } from '@/lib/validation'

/**
 * Leads (triagem_hsm). Toda escrita passa por validação (zod) e, quando há vínculo com o
 * Chatwoot (conversa ou contato), é espelhada lá (best-effort, nunca derruba a gravação).
 * `observacoes` deixou de ser editável aqui: anotações vivem em /api/anotacoes (histórico).
 */

/** Valida/coage os campos dinâmicos contra o cadastro (chaves desconhecidas são descartadas). */
async function normalizarAtributos(atributos: Record<string, unknown> | null | undefined, atual: AnyObj | null) {
  if (atributos === undefined) return undefined
  const campos = await listarCampos({ somenteAtivos: true })
  const out: AnyObj = { ...((atual?.atributos as AnyObj | null) ?? {}) }
  for (const c of campos) {
    if (atributos && c.chave in atributos) out[c.chave] = coerceCampoValor(c, atributos[c.chave])
  }
  return out
}

// Triagens de um paciente (contatos associados no funil unificado).
export async function GET(request: NextRequest) {
  const { supabase, error } = await requireUserApi()
  if (error) return error

  const pacienteId = request.nextUrl.searchParams.get('paciente_id')
  if (!pacienteId || !/^[0-9a-f-]{36}$/i.test(pacienteId)) {
    return NextResponse.json({ error: 'paciente_id obrigatório' }, { status: 400 })
  }

  const { data, error: dbErr } = await supabase
    .from('triagem_hsm')
    .select('*')
    .eq('paciente_id', pacienteId)
    .order('updated_at', { ascending: false })
    .limit(50)

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })
  const rows = (data ?? []).map((t) => ({
    id: t.id,
    contact_name: t.contact_name,
    phone: t.phone,
    email: t.email,
    conversation_id: t.conversation_id,
    chatwoot_contact_id: t.chatwoot_contact_id ?? null,
    estagio_funil: t.estagio_funil,
    motivo_perda: t.motivo_perda,
    tipo_contato: t.tipo_contato,
    created_at: t.created_at,
    updated_at: t.updated_at,
  }))
  return NextResponse.json({ rows })
}

// Cria um lead manualmente. Entra no funil como "Contato" e é espelhado no Chatwoot
// como CONTATO (com todos os atributos) — sem abrir conversa.
export async function POST(request: NextRequest) {
  const { supabase, user, error } = await requireUserApi()
  if (error) return error

  const parsed = triagemCreateSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: zodMensagem(parsed.error) }, { status: 400 })
  const { anotacao_inicial, atributos, ...campos } = parsed.data

  const row: AnyObj = { estagio_funil: null, status: 'em_triagem' }
  for (const [k, v] of Object.entries(campos)) if (v !== undefined && v !== null && v !== '') row[k] = v
  row.kids = isKids(row.data_nascimento)
  const atributosNorm = await normalizarAtributos(atributos ?? {}, null)
  if (atributosNorm && Object.keys(atributosNorm).length) row.atributos = atributosNorm

  let criado: AnyObj | null
  try {
    criado = await inserirComRedeDeSeguranca(supabase, row)
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
  if (!criado) return NextResponse.json({ error: 'falha ao criar o lead' }, { status: 500 })

  // Espelho no Chatwoot: contato com todos os campos (item 8).
  let chatwoot: 'ok' | 'skipped' | 'failed' = 'skipped'
  if (chatwootConfigured() && (criado.phone || criado.email)) {
    const camposDef = await listarCampos({ somenteAtivos: true })
    const attrs = {
      ...contactAttrsFromTriagem(criado),
      ...chatwootAttrsFromAtributos(camposDef, criado.atributos).contact,
    }
    const contactId = await encontrarOuCriarContato(
      { contact_name: criado.contact_name, phone: criado.phone, email: criado.email },
      attrs
    )
    if (contactId) {
      chatwoot = 'ok'
      const admin = createAdminClient()
      const salvo = await escreverComRedeDeSeguranca(admin, { id: criado.id }, { chatwoot_contact_id: contactId })
      if (salvo) criado = salvo
    } else {
      chatwoot = 'failed'
    }
  }

  // Anotação inicial → histórico (sem conversa ainda, não vai para o Chatwoot).
  if (anotacao_inicial && anotacao_inicial.trim()) {
    const admin = createAdminClient()
    await admin.from('anotacoes').insert({ triagem_id: criado.id, usuario_id: user!.id, conteudo: anotacao_inicial.trim(), origem: 'crm' })
  }

  return NextResponse.json({ triagem: criado, chatwoot })
}

export async function PATCH(request: NextRequest) {
  const { supabase, error } = await requireUserApi()
  if (error) return error

  const parsed = triagemPatchSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: zodMensagem(parsed.error) }, { status: 400 })
  const { id, ...body } = parsed.data

  const patch: AnyObj = {}
  for (const [k, v] of Object.entries(body)) if (v !== undefined) patch[k] = v
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'no syncable fields' }, { status: 400 })
  }

  void sincronizarSePreciso()

  // Linha atual (RLS): base para mesclar atributos e derivar kids.
  // '*' de propósito: listar colunas novas quebraria a edição enquanto a migration não roda.
  const { data: atual } = await supabase.from('triagem_hsm').select('*').eq('id', id).maybeSingle()
  if (!atual) return NextResponse.json({ error: 'lead não encontrado' }, { status: 404 })

  if ('atributos' in patch) patch.atributos = await normalizarAtributos(patch.atributos, atual)
  if ('data_nascimento' in patch) patch.kids = isKids(patch.data_nascimento)
  // Sair de "Perdido" limpa o motivo; entrar em "Internação" limpa também.
  if ('estagio_funil' in patch && patch.estagio_funil !== 'recusou_internacao' && !('motivo_perda' in patch)) {
    if (patch.estagio_funil === 'internado' || atual.motivo_perda) patch.motivo_perda = null
  }

  // 1) Grava no banco (sessão autenticada → RLS) com rede de segurança p/ coluna ausente.
  let updated: AnyObj | null
  try {
    updated = await escreverComRedeDeSeguranca(supabase, { id }, patch)
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
  if (!updated) return NextResponse.json({ error: 'lead não encontrado' }, { status: 404 })

  // 2) Empurra pro Chatwoot (best-effort — não falha a gravação do banco)
  const push = await pushTriagemParaChatwoot(supabase, updated, patch)
  if (push.contactId && !updated.chatwoot_contact_id) {
    const admin = createAdminClient()
    const salvo = await escreverComRedeDeSeguranca(admin, { id }, { chatwoot_contact_id: push.contactId })
    if (salvo) updated = salvo
  }

  return NextResponse.json({ ok: true, chatwoot: push.status, chatwootDetalhes: push.detalhes, triagem: updated })
}

