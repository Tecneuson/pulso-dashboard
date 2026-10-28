import { NextResponse, type NextRequest } from 'next/server'
import { segredoConfere } from '@/lib/auth'
import { isProd, n8nAtivo } from '@/lib/env'
import { createAdminClient } from '@/lib/supabase/admin'
import { chatwootConfigured, getConversation, postPrivateNote, updateConversationCustomAttributes } from '@/lib/chatwoot/client'
import { KEYS } from '@/lib/chatwoot/attributes'
import { pushTriagemParaChatwoot } from '@/lib/chatwoot/sync'
import { atualizarSeMudou, escreverComRedeDeSeguranca, type AnyObj } from '@/lib/triagem-db'
import { acharCardDoPaciente, fundirNoCard } from '@/lib/card-unico'
import { etapaFromEstagio } from '@/lib/funil-etapas'
import { reconhecerContato } from '@/lib/chatwoot/webhook-handlers'

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
  'consultor_id',
  'responsavel_contato_id',
  'atributos',
]

function mudou(a: unknown, b: unknown): boolean {
  return JSON.stringify(a ?? null) !== JSON.stringify(b ?? null)
}

function vazio(v: unknown): boolean {
  return v === null || v === undefined || v === '' || (Array.isArray(v) && v.length === 0)
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

  // INSERT: só o que veio preenchido. Mandar os nulos apagava os atributos do contato
  // e devolvia os outros cards do mesmo telefone para "Contato".
  let patch: AnyObj = {}
  for (const k of CAMPOS_SYNC) {
    if (!(k in record)) continue
    if (old ? mudou(old[k], record[k]) : !vazio(record[k])) patch[k] = record[k]
  }
  const admin = createAdminClient()
  const out: AnyObj = { id: record.id, campos: Object.keys(patch) }

  // "Triagem acabou agora" (a Mônica salvou e transferiu). Na MESMA conversa: quando a
  // conversa troca de card (fusão abaixo), a gravação no card do paciente não é um fim
  // de triagem novo — senão sairiam nota e pausa em dobro.
  const acabouAgora =
    !!old &&
    !!record.conversation_id &&
    old.conversation_id === record.conversation_id &&
    ((record.transbordado === true && old.transbordado !== true) ||
      (record.triagem_concluida === true && old.triagem_concluida !== true))

  let card: AnyObj = record
  let fundido = false

  // 1) Card único: a conversa vai para o card que o paciente já tinha (CPF/telefone).
  if (acabouAgora && record.assunto === 'internacao') {
    try {
      const achado = await acharCardDoPaciente(admin, record)
      if (achado) {
        card = await fundirNoCard(admin, record, achado.alvo, achado.motivo)
        fundido = true
        out.unificado = { card: card.id, motivo: achado.motivo }
        // A conversa nova recebe o card inteiro (atributos e label da etapa).
        patch = {}
        for (const k of CAMPOS_SYNC) if (!vazio(card[k])) patch[k] = card[k]
      }
    } catch (e) {
      out.unificadoErro = (e as Error).message
    }
  }

  // 2) Funil: triagem concluída e qualificada tira o card de Contato → Atendendo.
  //    (Na fusão isso já foi decidido junto.)
  if (!fundido && acabouAgora && record.status === 'qualificado' && etapaFromEstagio(record.estagio_funil) === 'contato') {
    await atualizarSeMudou(admin, { id: record.id }, { estagio_funil: 'em_atendimento' }, record)
    card = { ...record, estagio_funil: 'em_atendimento' }
    patch.estagio_funil = 'em_atendimento'
    out.funil = 'atendendo'
  }

  // 3) Quem falou na triagem vira contato do paciente (responsável/consultor).
  const paraQuemAgora = card.para_quem && (fundido || !old || old.para_quem !== record.para_quem)
  if (paraQuemAgora && card.conversation_id) {
    out.contato = await reconhecerContato(admin, card, { phone_number: record.phone, name: record.nome_contato })
  }

  if (Object.keys(patch).length) {
    const push = await pushTriagemParaChatwoot(admin, card, patch)
    out.chatwoot = push.status
    if (push.detalhes) out.detalhes = push.detalhes
    if (push.contactId && !card.chatwoot_contact_id) {
      await escreverComRedeDeSeguranca(admin, { id: card.id }, { chatwoot_contact_id: push.contactId }).catch(() => null)
    }
  }

  // Pausar o bot e deixar a nota de resumo é CICLO DE VIDA DO BOT — quem faz é quem
  // hospeda o bot. Com o n8n no ar (padrão), é ele; o app só assume no modo sem n8n.
  // Sem essa guarda sairiam duas notas.
  if (acabouAgora && !n8nAtivo()) {
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
