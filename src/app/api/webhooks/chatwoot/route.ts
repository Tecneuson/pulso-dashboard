import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { parseWebhookPayload } from '@/lib/chatwoot/webhook-parser'
import { mapContactAttributes, mapConversationAttributes } from '@/lib/chatwoot/field-mapper'

export async function POST(request: NextRequest) {
  const supabase = createAdminClient()

  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // Log the raw webhook
  const { data: log } = await supabase
    .from('webhook_logs')
    .insert({
      event_type: (payload as Record<string, unknown>).event as string ?? 'unknown',
      payload: payload as Record<string, unknown>,
    })
    .select('id')
    .single()

  const logId = log?.id

  try {
    const event = parseWebhookPayload(payload)

    switch (event.type) {
      case 'contact_created':
      case 'contact_updated': {
        const { contact } = event
        const mappedAttrs = mapContactAttributes(contact.custom_attributes ?? {})

        await supabase
          .from('contacts')
          .upsert(
            {
              chatwoot_contact_id: contact.id,
              name: contact.name ?? 'Sem nome',
              phone: contact.phone_number,
              email: contact.email,
              ...Object.fromEntries(
                Object.entries(mappedAttrs).filter(([, v]) => v !== undefined)
              ),
            },
            { onConflict: 'chatwoot_contact_id' }
          )

        break
      }

      case 'conversation_created':
      case 'conversation_updated':
      case 'conversation_status_changed': {
        const { conversation } = event

        // Ensure contact exists
        let contactId: string | null = null
        if (conversation.contact) {
          const { data: existingContact } = await supabase
            .from('contacts')
            .select('id')
            .eq('chatwoot_contact_id', conversation.contact.id)
            .single()

          if (existingContact) {
            contactId = existingContact.id
          } else {
            // Create contact first
            const contactAttrs = mapContactAttributes(
              conversation.contact.custom_attributes ?? {}
            )
            const { data: newContact } = await supabase
              .from('contacts')
              .insert({
                chatwoot_contact_id: conversation.contact.id,
                name: conversation.contact.name ?? 'Sem nome',
                phone: conversation.contact.phone_number,
                email: conversation.contact.email,
                ...Object.fromEntries(
                  Object.entries(contactAttrs).filter(([, v]) => v !== undefined)
                ),
              })
              .select('id')
              .single()
            contactId = newContact?.id ?? null
          }
        }

        if (!contactId) break

        const convAttrs = mapConversationAttributes(conversation.custom_attributes ?? {})

        await supabase
          .from('conversations')
          .upsert(
            {
              chatwoot_conversation_id: conversation.id,
              contact_id: contactId,
              chatwoot_status: conversation.status,
              chatwoot_assignee: conversation.assignee?.name,
              chatwoot_inbox: conversation.inbox?.name,
              tags: conversation.labels ?? [],
              ...Object.fromEntries(
                Object.entries(convAttrs).filter(([, v]) => v !== undefined)
              ),
            },
            { onConflict: 'chatwoot_conversation_id' }
          )

        break
      }

      case 'message_created': {
        const { message } = event
        // message_type 1 = outgoing (agent reply)
        if (message.message_type === 1 && message.conversation?.id) {
          // Set first_reply_at if not already set
          const { data: conv } = await supabase
            .from('conversations')
            .select('id, first_reply_at')
            .eq('chatwoot_conversation_id', message.conversation.id)
            .single()

          if (conv && !conv.first_reply_at) {
            await supabase
              .from('conversations')
              .update({
                first_reply_at: new Date(
                  (message.created_at ?? Date.now() / 1000) * 1000
                ).toISOString(),
              })
              .eq('id', conv.id)
          }
        }
        break
      }

      case 'unknown':
        // Log but don't process
        break
    }

    // Mark webhook as processed
    if (logId) {
      await supabase
        .from('webhook_logs')
        .update({ processed: true })
        .eq('id', logId)
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    // Log the error
    if (logId) {
      await supabase
        .from('webhook_logs')
        .update({
          processed: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        })
        .eq('id', logId)
    }

    return NextResponse.json(
      { error: 'Processing failed' },
      { status: 500 }
    )
  }
}
