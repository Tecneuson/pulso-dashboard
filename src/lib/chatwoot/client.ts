/**
 * Cliente REST do Chatwoot (server-side). Usa CHATWOOT_BASE_URL + CHATWOOT_API_TOKEN.
 * Header de auth: `api_access_token`. Account default = 1 (CHATWOOT_ACCOUNT_ID).
 */

function cfg() {
  return {
    BASE: process.env.CHATWOOT_BASE_URL?.replace(/\/$/, ''),
    TOKEN: process.env.CHATWOOT_API_TOKEN,
    ACCOUNT: process.env.CHATWOOT_ACCOUNT_ID || '1',
  }
}

export function chatwootConfigured(): boolean {
  const { BASE, TOKEN } = cfg()
  return Boolean(BASE && TOKEN)
}

async function cw<T = unknown>(path: string, init?: RequestInit): Promise<T> {
  const { BASE, TOKEN, ACCOUNT } = cfg()
  if (!BASE || !TOKEN) throw new Error('Chatwoot não configurado (BASE/TOKEN ausentes)')
  const res = await fetch(`${BASE}/api/v1/accounts/${ACCOUNT}${path}`, {
    ...init,
    headers: {
      api_access_token: TOKEN,
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
    cache: 'no-store',
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Chatwoot ${init?.method || 'GET'} ${path} -> ${res.status} ${body.slice(0, 200)}`)
  }
  return (res.status === 204 ? (null as T) : ((await res.json()) as T))
}

export interface ChatwootConversation {
  id: number
  custom_attributes: Record<string, unknown>
  labels?: string[]
  meta?: { sender?: { id: number; custom_attributes?: Record<string, unknown> } }
}

export async function getConversation(conversationId: string | number): Promise<ChatwootConversation> {
  return cw<ChatwootConversation>(`/conversations/${conversationId}`)
}

/** Lista as conversas de um contato (usado no webhook contact_updated). */
export async function getContactConversations(
  contactId: number
): Promise<Array<{ id?: number; display_id?: number }>> {
  const r = await cw<{ payload?: Array<{ id?: number; display_id?: number }> } | Array<{ id?: number; display_id?: number }>>(
    `/contacts/${contactId}/conversations`
  )
  return Array.isArray(r) ? r : r?.payload ?? []
}

/** Merge de custom attributes na CONVERSA (endpoint dedicado já faz merge). */
export async function updateConversationCustomAttributes(
  conversationId: string | number,
  attrs: Record<string, unknown>
): Promise<void> {
  if (Object.keys(attrs).length === 0) return
  await cw(`/conversations/${conversationId}/custom_attributes`, {
    method: 'POST',
    body: JSON.stringify({ custom_attributes: attrs }),
  })
}

/** Merge de custom attributes no CONTATO (busca o existente e faz PUT do conjunto mesclado). */
export async function updateContactCustomAttributes(
  contactId: number,
  attrs: Record<string, unknown>,
  existing?: Record<string, unknown>
): Promise<void> {
  if (Object.keys(attrs).length === 0) return
  let base = existing
  if (!base) {
    const contact = await cw<{ payload?: { custom_attributes?: Record<string, unknown> } }>(
      `/contacts/${contactId}`
    )
    base = contact?.payload?.custom_attributes || {}
  }
  const merged = { ...base, ...attrs }
  await cw(`/contacts/${contactId}`, {
    method: 'PUT',
    body: JSON.stringify({ custom_attributes: merged }),
  })
}

/** Define as labels (tags) da conversa — substitui o conjunto. */
export async function setConversationLabels(
  conversationId: string | number,
  labels: string[]
): Promise<void> {
  await cw(`/conversations/${conversationId}/labels`, {
    method: 'POST',
    body: JSON.stringify({ labels }),
  })
}

/** Best-effort: garante a definição do custom attribute `observacoes` (conversa, texto). */
export async function ensureObservacoesDefinition(): Promise<void> {
  try {
    const defs = await cw<Array<{ attribute_key: string }>>(`/custom_attribute_definitions`)
    if (defs.some((d) => d.attribute_key === 'observacoes')) return
    await cw(`/custom_attribute_definitions`, {
      method: 'POST',
      body: JSON.stringify({
        attribute_display_name: 'Observações',
        attribute_key: 'observacoes',
        attribute_model: 0, // 0 = conversation_attribute
        attribute_display_type: 6, // 6 = text
      }),
    })
  } catch {
    // não bloqueia o sync: a conversa aceita o atributo mesmo sem definição (só não renderiza no UI)
  }
}
