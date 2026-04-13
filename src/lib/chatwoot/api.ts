const CHATWOOT_BASE_URL = process.env.CHATWOOT_BASE_URL ?? ''
const CHATWOOT_API_TOKEN = process.env.CHATWOOT_API_TOKEN ?? ''
const ACCOUNT_ID = 1

interface ChatwootRequestOptions {
  method?: string
  body?: unknown
}

async function chatwootFetch<T>(path: string, options: ChatwootRequestOptions = {}): Promise<T> {
  const url = `${CHATWOOT_BASE_URL}/api/v1/accounts/${ACCOUNT_ID}${path}`
  const res = await fetch(url, {
    method: options.method ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
      api_access_token: CHATWOOT_API_TOKEN,
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  })

  if (!res.ok) {
    throw new Error(`Chatwoot API error: ${res.status} ${res.statusText}`)
  }

  return res.json() as Promise<T>
}

export const chatwootApi = {
  getContact(contactId: number) {
    return chatwootFetch(`/contacts/${contactId}`)
  },

  getConversation(conversationId: number) {
    return chatwootFetch(`/conversations/${conversationId}`)
  },

  getContactConversations(contactId: number) {
    return chatwootFetch(`/contacts/${contactId}/conversations`)
  },

  assignConversation(conversationId: number, assigneeId: number) {
    return chatwootFetch(`/conversations/${conversationId}/assignments`, {
      method: 'POST',
      body: { assignee_id: assigneeId },
    })
  },

  addLabel(conversationId: number, labels: string[]) {
    return chatwootFetch(`/conversations/${conversationId}/labels`, {
      method: 'POST',
      body: { labels },
    })
  },
}
