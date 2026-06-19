import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  chatwootConfigured,
  getConversation,
  updateContactCustomAttributes,
  updateConversationCustomAttributes,
  setConversationLabels,
} from '@/lib/chatwoot/client'
import { contactAttrsFromTriagem, conversationAttrsFromTriagem } from '@/lib/chatwoot/mapping'
import type { Triagem } from '@/types'

// Campos do triagem_hsm que o dashboard pode editar e que sincronizam com o Chatwoot.
const SYNCABLE: (keyof Triagem)[] = [
  'estagio_funil',
  'plano_saude',
  'tipo_contato',
  'para_quem',
  'motivo_contato',
  'forma_internacao',
  'assunto',
  'motivo_perda',
  'observacoes',
  'tags',
  'status',
  'motivo_desqualificacao',
]

export async function PATCH(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => null)
  const id: string | undefined = body?.id
  if (!id || typeof body !== 'object') {
    return NextResponse.json({ error: 'invalid payload' }, { status: 400 })
  }

  const patch: Record<string, unknown> = {}
  for (const k of SYNCABLE) if (k in body) patch[k] = body[k]
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'no syncable fields' }, { status: 400 })
  }

  // 1) Grava no banco (sessão autenticada → RLS)
  const { data: updated, error } = await supabase
    .from('triagem_hsm')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // 2) Empurra pro Chatwoot (best-effort — não falha a gravação do banco)
  let chatwoot: 'ok' | 'skipped' | 'failed' = 'skipped'
  const convId = updated?.conversation_id as string | null | undefined
  if (chatwootConfigured() && convId) {
    try {
      const conv = await getConversation(convId)
      const contactId = conv.meta?.sender?.id
      const contactAttrs = contactAttrsFromTriagem(patch as Partial<Triagem>)
      const convAttrs = conversationAttrsFromTriagem(patch as Partial<Triagem>)

      if (contactId && Object.keys(contactAttrs).length) {
        await updateContactCustomAttributes(contactId, contactAttrs, conv.meta?.sender?.custom_attributes)
      }
      if (Object.keys(convAttrs).length) {
        await updateConversationCustomAttributes(convId, convAttrs)
      }
      if (Array.isArray(patch.tags)) {
        await setConversationLabels(convId, patch.tags as string[])
      }
      chatwoot = 'ok'
    } catch (e) {
      console.error('[sync triagem->chatwoot]', e)
      chatwoot = 'failed'
    }
  }

  return NextResponse.json({ ok: true, chatwoot, triagem: updated })
}
