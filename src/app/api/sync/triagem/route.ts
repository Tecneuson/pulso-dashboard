import { NextResponse, type NextRequest } from 'next/server'
import { segredoConfere } from '@/lib/auth'
import { botAtivo, isProd } from '@/lib/env'
import { createAdminClient } from '@/lib/supabase/admin'
import { chatwootConfigured, getConversation, postPrivateNote, updateConversationCustomAttributes } from '@/lib/chatwoot/client'
import { KEYS } from '@/lib/chatwoot/attributes'
import { pushTriagemParaChatwoot } from '@/lib/chatwoot/sync'
import { escreverComRedeDeSeguranca, type AnyObj } from '@/lib/triagem-db'

/**
 * Database Webhook do Supabase (tabela triagem_hsm, INSERT/UPDATE) → Chatwoot.
 * Substitui o fluxo "agente-humano" do n8n: qualquer escrita no banco (bot, script,
 * SQL manual, CRM) é espelhada no Chatwoot. Só o que mudou (record vs old_record).
 *
 * Configurar em Supabase → Database → Webhooks: POST https://SEU_DOMINIO/api/sync/triagem
 * com header `x-sync-secret: <SYNC_WEBHOOK_SECRET>`.
 */

const CAMPOS_SYNC = [
  'estagio_funil',
  'plano_saude',
  'tipo_contato',
  'para_quem',
  'motivo_contato',
  'assunto',
  'motivo_perda',
  'elegivel',
  'data_nascimento',
  'kids',
  'tags',
  'contact_name',
  'origem_conversa',
  'origem_hospital_id',
  'origem_consultor_id',
  'atributos',
]

function mudou(a: unknown, b: unknown): boolean {
  return JSON.stringify(a ?? null) !== JSON.stringify(b ?? null)
}

export async function POST(request: NextRequest) {
  const secret = process.env.SYNC_WEBHOOK_SECRET
  if (!secret) {
    if (isProd()) return NextResponse.json({ error: 'sync não configurado' }, { status: 503 })
  } else if (!segredoConfere(request.headers.get('x-sync-secret'), secret)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 401 })
  }
  if (!chatwootConfigured()) return NextResponse.json({ ok: true, skipped: 'chatwoot não configurado' })

  const body = (await request.json().catch(() => null)) as AnyObj | null
  const record = body?.record as AnyObj | undefined
  if (!record || body?.table !== 'triagem_hsm') return NextResponse.json({ error: 'payload inválido' }, { status: 400 })
  const old = (body?.old_record as AnyObj | null) ?? null

  const patch: AnyObj = {}
  for (const k of CAMPOS_SYNC) {
    if (!(k in record)) continue
    if (!old || mudou(old[k], record[k])) patch[k] = record[k]
  }
  const admin = createAdminClient()
  const out: AnyObj = { id: record.id, campos: Object.keys(patch) }

  if (Object.keys(patch).length) {
    const push = await pushTriagemParaChatwoot(admin, record, patch)
    out.chatwoot = push.status
    if (push.detalhes) out.detalhes = push.detalhes
    if (push.contactId && !record.chatwoot_contact_id) {
      await escreverComRedeDeSeguranca(admin, { id: record.id }, { chatwoot_contact_id: push.contactId }).catch(() => null)
    }
  }

  // Transição "triagem acabou agora" (bot n8n gravou transbordado/concluída): pausa o bot e
  // deixa o resumo. Quando o bot roda dentro do app ele mesmo faz isso.
  const acabouAgora =
    !!old &&
    record.conversation_id &&
    ((record.transbordado === true && old.transbordado !== true) ||
      (record.triagem_concluida === true && old.triagem_concluida !== true))
  if (acabouAgora && !botAtivo()) {
    try {
      const conv = await getConversation(record.conversation_id)
      await updateConversationCustomAttributes(record.conversation_id, { [KEYS.botPausado]: true }, conv.custom_attributes)
      await postPrivateNote(
        record.conversation_id,
        [
          '📝 Resumo da triagem (Mônica)',
          `Paciente: ${record.contact_name ?? '—'}`,
          `Nascimento: ${record.data_nascimento ?? '—'}${record.kids ? ' (Kids)' : ''}`,
          `Assunto: ${record.assunto ?? '—'}`,
          `Para quem: ${record.para_quem ?? '—'}`,
          `Categoria: ${record.tipo_contato ?? '—'}`,
          `Forma: ${record.forma_internacao ?? '—'}`,
          `Plano: ${record.plano_saude ?? '—'}`,
          `CPF: ${record.cpf ?? '—'}`,
          '',
          `Observações: ${record.observacoes ?? '—'}`,
        ].join('\n')
      )
      out.posTriagem = 'bot pausado + resumo'
    } catch (e) {
      out.posTriagemErro = (e as Error).message
    }
  }
  return NextResponse.json({ ok: true, ...out })
}
