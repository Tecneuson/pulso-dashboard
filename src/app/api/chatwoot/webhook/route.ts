import { NextResponse, type NextRequest } from 'next/server'
import { segredoConfere } from '@/lib/auth'
import { isProd } from '@/lib/env'
import { handleChatwootEvent } from '@/lib/chatwoot/webhook-handlers'

/**
 * Webhook do Chatwoot → dashboard. Configurar no Chatwoot (Configurações → Integrações →
 * Webhooks) com a URL:
 *   https://SEU_DOMINIO/api/chatwoot/webhook
 * e o header `x-webhook-secret: <CHATWOOT_WEBHOOK_SECRET>` (o Chatwoot não permite header
 * customizado na UI — nesse caso use `?secret=` na URL; o valor fica no log do proxy, então
 * prefira um segredo dedicado e rotacione-o).
 *
 * Eventos a marcar: conversation_created, conversation_updated, conversation_status_changed,
 * contact_updated, message_created.
 *
 * Anti-loop: os handlers só gravam no banco o que REALMENTE mudou e só escrevem no Chatwoot
 * como consequência direta do evento (reabrir sem desfecho, corrigir estágio após venda).
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

  try {
    const result = await handleChatwootEvent(body)
    return NextResponse.json({ ok: true, ...result })
  } catch (e) {
    console.error('[chatwoot webhook]', (e as Error).message)
    return NextResponse.json({ error: 'erro interno' }, { status: 500 })
  }
}
