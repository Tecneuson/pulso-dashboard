import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getContactConversations } from '@/lib/chatwoot/client'
import { triagemFromChatwoot } from '@/lib/chatwoot/mapping'

/**
 * Webhook do Chatwoot → dashboard. Configurar no Chatwoot com a URL:
 *   https://SEU_DOMINIO/api/chatwoot/webhook?secret=<CHATWOOT_WEBHOOK_SECRET>
 * Eventos úteis: conversation_updated, conversation_created, contact_updated.
 *
 * Anti-loop: este handler SÓ escreve no banco (service_role). O push pro Chatwoot
 * acontece apenas em edição explícita no dashboard (/api/triagem). Sem ciclo.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyObj = Record<string, any>

export async function POST(request: NextRequest) {
  const secret = process.env.CHATWOOT_WEBHOOK_SECRET
  if (secret) {
    const provided =
      request.nextUrl.searchParams.get('secret') || request.headers.get('x-webhook-secret')
    if (provided !== secret) {
      return NextResponse.json({ error: 'forbidden' }, { status: 401 })
    }
  }

  const body = (await request.json().catch(() => null)) as AnyObj | null
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'invalid payload' }, { status: 400 })
  }

  const event: string | undefined = body.event
  const admin = createAdminClient()

  try {
    if (event === 'conversation_updated' || event === 'conversation_created') {
      const convId = String(body.id ?? body.display_id ?? '')
      if (!convId) return NextResponse.json({ ok: true, skipped: 'sem conversation id' })

      const convAttrs = (body.custom_attributes || {}) as AnyObj
      const contactAttrs = (body.meta?.sender?.custom_attributes || {}) as AnyObj
      const patch: AnyObj = { ...triagemFromChatwoot(contactAttrs, convAttrs) }
      if (Array.isArray(body.labels)) patch.tags = body.labels

      if (Object.keys(patch).length) {
        await admin.from('triagem_hsm').update(patch).eq('conversation_id', convId)
      }
      return NextResponse.json({ ok: true, event, convId, fields: Object.keys(patch) })
    }

    if (event === 'contact_updated') {
      const contactId: number | undefined = body.id
      const contactAttrs = (body.custom_attributes || {}) as AnyObj
      const patch = triagemFromChatwoot(contactAttrs, {})
      if (contactId && Object.keys(patch).length) {
        const convs = await getContactConversations(contactId)
        for (const c of convs) {
          const cid = String(c.id ?? c.display_id ?? '')
          if (cid) await admin.from('triagem_hsm').update(patch).eq('conversation_id', cid)
        }
        return NextResponse.json({ ok: true, event, contactId, convs: convs.length, fields: Object.keys(patch) })
      }
      return NextResponse.json({ ok: true, event, skipped: true })
    }

    return NextResponse.json({ ok: true, ignored: event })
  } catch (e) {
    console.error('[chatwoot webhook]', e)
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
