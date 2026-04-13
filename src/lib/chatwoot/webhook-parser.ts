import {
  chatwootWebhookSchema,
  chatwootContactSchema,
  chatwootConversationSchema,
  chatwootMessageSchema,
  type ChatwootContact,
  type ChatwootConversation,
  type ChatwootMessage,
} from '@/lib/validators/webhook'

export type WebhookEvent =
  | { type: 'contact_created'; contact: ChatwootContact }
  | { type: 'contact_updated'; contact: ChatwootContact }
  | { type: 'conversation_created'; conversation: ChatwootConversation }
  | { type: 'conversation_updated'; conversation: ChatwootConversation }
  | { type: 'conversation_status_changed'; conversation: ChatwootConversation }
  | { type: 'message_created'; message: ChatwootMessage }
  | { type: 'unknown'; event: string }

export function parseWebhookPayload(payload: unknown): WebhookEvent {
  const base = chatwootWebhookSchema.parse(payload)
  const raw = payload as Record<string, unknown>

  switch (base.event) {
    case 'contact_created':
    case 'contact_updated': {
      const contact = chatwootContactSchema.parse(raw)
      return { type: base.event, contact }
    }

    case 'conversation_created':
    case 'conversation_updated':
    case 'conversation_status_changed': {
      const conversation = chatwootConversationSchema.parse(raw)
      return { type: base.event, conversation }
    }

    case 'message_created': {
      const message = chatwootMessageSchema.parse(raw)
      return { type: 'message_created', message }
    }

    default:
      return { type: 'unknown', event: base.event }
  }
}
