/**
 * URLs do Chatwoot para o navegador (links "Abrir no Chatwoot").
 * Só usa NEXT_PUBLIC_* (inlinado no build) — seguro em componentes client.
 */

export function chatwootBaseUrl(): string | null {
  const base = process.env.NEXT_PUBLIC_CHATWOOT_BASE_URL
  return base ? base.replace(/\/$/, '') : null
}

export function chatwootAccountId(): string {
  return process.env.NEXT_PUBLIC_CHATWOOT_ACCOUNT_ID || '1'
}

export function chatwootConversationUrl(conversationId: string | number | null | undefined): string | null {
  const base = chatwootBaseUrl()
  if (!base || conversationId == null || conversationId === '') return null
  return `${base}/app/accounts/${chatwootAccountId()}/conversations/${conversationId}`
}

export function chatwootContactUrl(contactId: string | number | null | undefined): string | null {
  const base = chatwootBaseUrl()
  if (!base || contactId == null || contactId === '') return null
  return `${base}/app/accounts/${chatwootAccountId()}/contacts/${contactId}`
}

/**
 * Melhor link para um lead: a conversa (quando existe) ou a ficha do contato
 * (lead criado no CRM e espelhado no Chatwoot sem conversa).
 */
export function chatwootLinkDoLead(t: {
  conversation_id?: string | number | null
  chatwoot_contact_id?: number | null
}): { url: string; tipo: 'conversa' | 'contato' } | null {
  const conv = chatwootConversationUrl(t.conversation_id)
  if (conv) return { url: conv, tipo: 'conversa' }
  const contato = chatwootContactUrl(t.chatwoot_contact_id)
  if (contato) return { url: contato, tipo: 'contato' }
  return null
}
