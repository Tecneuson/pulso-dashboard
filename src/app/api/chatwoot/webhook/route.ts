import { NextResponse, type NextRequest } from 'next/server'
import { segredoConfere } from '@/lib/auth'
import { isProd } from '@/lib/env'
import { enfileirar } from '@/lib/fila'
import { handleChatwootEvent } from '@/lib/chatwoot/webhook-handlers'

/**
 * Webhook do Chatwoot → dashboard. Configurar no Chatwoot (Configurações → Integrações →
 * Webhooks) com a URL:
 *   https://SEU_DOMINIO/api/chatwoot/webhook?secret=<CHATWOOT_WEBHOOK_SECRET>
 * (o Chatwoot não deixa definir header customizado na UI; se puder, prefira o header
 * `x-webhook-secret`, porque a query string aparece no log do proxy).
 *
 * Eventos a marcar: conversation_created, conversation_updated,
 * conversation_status_changed, contact_updated, message_created.
 *
 * ⚠️ RESPOSTA IMEDIATA: o Chatwoot espera o HTTP com timeout curto e REENVIA o evento
 * se estourar — o que geraria trabalho duplicado (no limite, resposta repetida ao
 * paciente). Então validamos o segredo, respondemos 200 na hora e processamos depois.
 * Como o app roda em servidor Node de longa duração (Coolify), a promessa sobrevive à
 * resposta; em serverless isso precisaria de fila externa.
 *
 * Anti-loop: os handlers só gravam no banco o que REALMENTE mudou e só escrevem no
 * Chatwoot como consequência direta do evento (reabrir sem desfecho, corrigir estágio).
 */
export async function POST(request: NextRequest) {
  const secret = process.env.CHATWOOT_WEBHOOK_SECRET
  if (!secret) {
    // Fail-closed em produção: sem segredo configurado ninguém pode chamar este endpoint.
    if (isProd()) return NextResponse.json({ error: 'webhook não configurado' }, { status: 503 })
    console.warn('[chatwoot webhook] CHATWOOT_WEBHOOK_SECRET ausente — aceitando em dev')
  } else {
    const provided = request.headers.get('x-webhook-secret') || request.nextUrl.searchParams.get('secret')
    if (!segredoConfere(provided, secret)) {
      return NextResponse.json({ error: 'forbidden' }, { status: 401 })
    }
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'invalid payload' }, { status: 400 })
  }

  const evento = String(body.event ?? 'desconhecido')
  // Eventos da MESMA conversa são processados em ordem; conversas diferentes, em paralelo.
  const conversa =
    (body.conversation as { id?: number } | undefined)?.id ??
    (body.id as number | undefined) ??
    (body.display_id as number | undefined)
  const chave = `conv:${conversa ?? 'sem-conversa'}`

  void enfileirar(chave, async () => {
    try {
      const r = await handleChatwootEvent(body)
      if (r && typeof r === 'object' && 'erro' in r) console.warn('[chatwoot webhook]', evento, r)
    } catch (e) {
      console.error('[chatwoot webhook]', evento, (e as Error).message)
    }
  })

  return NextResponse.json({ ok: true, event: evento, enfileirado: true })
}
