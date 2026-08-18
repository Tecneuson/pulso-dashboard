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

  /**
   * Grava só o que REALMENTE mudou. Sem isso, um update com valores idênticos ainda
   * dispara o database webhook do Supabase → n8n → Chatwoot → este webhook de novo,
   * criando um loop de eco infinito.
   */
  async function updateSeMudou(convId: string, patch: AnyObj): Promise<string[]> {
    const campos = Object.keys(patch)
    if (!campos.length) return []
    const { data: atual } = await admin
      .from('triagem_hsm')
      .select(campos.join(','))
      .eq('conversation_id', convId)
      .maybeSingle()
    const row = (atual ?? {}) as AnyObj
    const diff: AnyObj = {}
    for (const k of campos) {
      const a = row[k]
      const b = patch[k]
      const igual = Array.isArray(a) && Array.isArray(b)
        ? JSON.stringify(a) === JSON.stringify(b)
        : (a ?? null) === (b ?? null)
      if (!igual) diff[k] = b
    }
    if (!Object.keys(diff).length) return []
    await admin.from('triagem_hsm').update(diff).eq('conversation_id', convId)
    return Object.keys(diff)
  }

  try {
    if (event === 'conversation_updated' || event === 'conversation_created') {
      const convId = String(body.id ?? body.display_id ?? '')
      if (!convId) return NextResponse.json({ ok: true, skipped: 'sem conversation id' })

      const convAttrs = (body.custom_attributes || {}) as AnyObj
      const contactAttrs = (body.meta?.sender?.custom_attributes || {}) as AnyObj
      const patch: AnyObj = { ...triagemFromChatwoot(contactAttrs, convAttrs) }
      if (Array.isArray(body.labels)) patch.tags = body.labels

      const mudou = await updateSeMudou(convId, patch)
      return NextResponse.json({ ok: true, event, convId, fields: mudou })
    }

    if (event === 'contact_updated') {
      const contactId: number | undefined = body.id
      const contactAttrs = (body.custom_attributes || {}) as AnyObj
      const patch = triagemFromChatwoot(contactAttrs, {})
      if (contactId && Object.keys(patch).length) {
        const convs = await getContactConversations(contactId)
        const mudou: string[] = []
        for (const c of convs) {
          const cid = String(c.id ?? c.display_id ?? '')
          if (cid) mudou.push(...(await updateSeMudou(cid, patch)))
        }
        return NextResponse.json({ ok: true, event, contactId, convs: convs.length, fields: mudou })
      }
      return NextResponse.json({ ok: true, event, skipped: true })
    }

    return NextResponse.json({ ok: true, ignored: event })
  } catch (e) {
    console.error('[chatwoot webhook]', e)
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
