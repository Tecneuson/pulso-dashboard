/**
 * Cliente REST do Chatwoot (server-side). Usa CHATWOOT_BASE_URL + CHATWOOT_API_TOKEN.
 * Header de auth: `api_access_token`. Account default = 1 (CHATWOOT_ACCOUNT_ID).
 *
 * Regras que valem para TODOS os endpoints de custom_attributes do Chatwoot:
 *  - o endpoint SUBSTITUI o objeto inteiro → sempre mesclar com o que já existe
 *    (já apagou `bot_pausado`/`assunto_da_conversa` em produção);
 *  - nunca mandar `undefined` (vira ausência e apaga a chave).
 */

import type { CampoModelo, CampoTipo } from '@/types'
import { CW_ATTRIBUTE_MODEL, CW_DISPLAY_TYPE, parseModelo, parseTipo } from './attributes'

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

export class ChatwootError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly path: string
  ) {
    super(message)
    this.name = 'ChatwootError'
  }
}

const TIMEOUT_MS = 15_000

async function cw<T = unknown>(path: string, init?: RequestInit, tentativa = 0): Promise<T> {
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
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
  if (!res.ok) {
    // Uma nova tentativa em rate-limit / erro transitório do servidor.
    if ((res.status === 429 || res.status >= 500) && tentativa < 1) {
      await new Promise((r) => setTimeout(r, 800))
      return cw<T>(path, init, tentativa + 1)
    }
    const body = await res.text().catch(() => '')
    throw new ChatwootError(
      `Chatwoot ${init?.method || 'GET'} ${path} -> ${res.status} ${body.slice(0, 200)}`,
      res.status,
      path
    )
  }
  if (res.status === 204) return null as T
  const text = await res.text()
  return (text ? JSON.parse(text) : null) as T
}

// ============================================================
// Conversas
// ============================================================

export interface ChatwootSender {
  id: number
  name?: string | null
  phone_number?: string | null
  email?: string | null
  /** 'contact' | 'user' (agente/bot) */
  type?: string
  custom_attributes?: Record<string, unknown>
}

export interface ChatwootConversation {
  id: number
  status?: string
  custom_attributes: Record<string, unknown>
  labels?: string[]
  last_activity_at?: number
  timestamp?: number
  meta?: {
    sender?: ChatwootSender
    assignee?: { id: number; name?: string } | null
  }
}

export interface ChatwootMessage {
  id: number
  content: string | null
  /** 0 incoming | 1 outgoing | 2 activity | 3 template (na API) */
  message_type: number | string
  private?: boolean
  created_at?: number
  sender?: ChatwootSender | null
  attachments?: Array<{ file_type?: string; data_url?: string }>
}

export async function getConversation(conversationId: string | number): Promise<ChatwootConversation> {
  return cw<ChatwootConversation>(`/conversations/${conversationId}`)
}

/** Conversas abertas (paginação de 25 do Chatwoot). */
export async function listConversations(params: {
  status?: 'open' | 'pending' | 'resolved' | 'snoozed' | 'all'
  page?: number
}): Promise<ChatwootConversation[]> {
  const sp = new URLSearchParams()
  if (params.status) sp.set('status', params.status)
  if (params.page) sp.set('page', String(params.page))
  const r = await cw<{ data?: { payload?: ChatwootConversation[] }; payload?: ChatwootConversation[] }>(
    `/conversations?${sp.toString()}`
  )
  return r?.data?.payload ?? r?.payload ?? []
}

/** Totais de conversas por status (o que o Chatwoot mostra na barra lateral). */
export async function contarConversasPorStatus(): Promise<Record<string, number>> {
  const out: Record<string, number> = {}
  for (const status of ['open', 'pending', 'snoozed', 'resolved'] as const) {
    try {
      const r = await cw<{ data?: { meta?: { all_count?: number } }; meta?: { all_count?: number } }>(
        `/conversations?status=${status}&page=1`
      )
      out[status] = Number(r?.data?.meta?.all_count ?? r?.meta?.all_count ?? 0)
    } catch {
      out[status] = -1 // indisponível
    }
  }
  return out
}

/** Mensagens da conversa (as ~20 mais recentes; `before` pagina para trás). */
export async function listConversationMessages(
  conversationId: string | number,
  before?: number
): Promise<ChatwootMessage[]> {
  const q = before ? `?before=${before}` : ''
  const r = await cw<{ payload?: ChatwootMessage[] }>(`/conversations/${conversationId}/messages${q}`)
  return r?.payload ?? []
}

export async function toggleConversationStatus(
  conversationId: string | number,
  status: 'open' | 'resolved' | 'pending' | 'snoozed'
): Promise<void> {
  await cw(`/conversations/${conversationId}/toggle_status`, {
    method: 'POST',
    body: JSON.stringify({ status }),
  })
}

export async function assignConversation(conversationId: string | number, assigneeId: number): Promise<void> {
  await cw(`/conversations/${conversationId}/assignments`, {
    method: 'POST',
    body: JSON.stringify({ assignee_id: assigneeId }),
  })
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

/**
 * Merge de custom attributes na CONVERSA.
 * ⚠️ O endpoint do Chatwoot SUBSTITUI o objeto inteiro — mandar só um atributo apaga os
 * demais. Então lemos os atuais e enviamos o conjunto mesclado.
 */
export async function updateConversationCustomAttributes(
  conversationId: string | number,
  attrs: Record<string, unknown>,
  existing?: Record<string, unknown>
): Promise<void> {
  if (Object.keys(attrs).length === 0) return
  let base = existing
  if (!base) {
    try {
      const conv = await getConversation(conversationId)
      base = conv?.custom_attributes ?? {}
    } catch {
      base = {}
    }
  }
  await cw(`/conversations/${conversationId}/custom_attributes`, {
    method: 'POST',
    body: JSON.stringify({ custom_attributes: { ...base, ...attrs } }),
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

/** Envia mensagem na conversa (pública ou nota privada). Devolve a mensagem criada. */
export async function sendMessage(
  conversationId: string | number,
  content: string,
  opts: { private?: boolean } = {}
): Promise<ChatwootMessage | null> {
  if (!content.trim()) return null
  return cw<ChatwootMessage>(`/conversations/${conversationId}/messages`, {
    method: 'POST',
    body: JSON.stringify({ content, message_type: 'outgoing', private: !!opts.private }),
  })
}

/** Cria uma NOTA PRIVADA (visível só à equipe) na conversa. Devolve o id da mensagem. */
export async function postPrivateNote(
  conversationId: string | number,
  content: string
): Promise<number | null> {
  const m = await sendMessage(conversationId, content, { private: true })
  return m?.id ?? null
}

// ============================================================
// Contatos
// ============================================================

export interface ChatwootContact {
  id: number
  name?: string | null
  phone_number?: string | null
  email?: string | null
  identifier?: string | null
  custom_attributes?: Record<string, unknown>
}

export async function getContact(contactId: number): Promise<ChatwootContact | null> {
  const r = await cw<{ payload?: ChatwootContact } | ChatwootContact>(`/contacts/${contactId}`)
  return (r && 'payload' in r ? r.payload : (r as ChatwootContact)) ?? null
}

export async function searchContacts(q: string): Promise<ChatwootContact[]> {
  const r = await cw<{ payload?: ChatwootContact[] }>(`/contacts/search?q=${encodeURIComponent(q)}`)
  return r?.payload ?? []
}

export async function createContact(body: {
  name: string
  phone_number?: string | null
  email?: string | null
  custom_attributes?: Record<string, unknown>
}): Promise<ChatwootContact | null> {
  const clean: Record<string, unknown> = { name: body.name }
  if (body.phone_number) clean.phone_number = body.phone_number
  if (body.email) clean.email = body.email
  if (body.custom_attributes) clean.custom_attributes = body.custom_attributes
  const r = await cw<{ payload?: { contact?: ChatwootContact } | ChatwootContact }>(`/contacts`, {
    method: 'POST',
    body: JSON.stringify(clean),
  })
  const p = r?.payload as { contact?: ChatwootContact } | ChatwootContact | undefined
  if (!p) return null
  return 'contact' in p && p.contact ? p.contact : (p as ChatwootContact)
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
    const contact = await getContact(contactId)
    base = contact?.custom_attributes || {}
  }
  const merged = { ...base, ...attrs }
  await cw(`/contacts/${contactId}`, {
    method: 'PUT',
    body: JSON.stringify({ custom_attributes: merged }),
  })
}

export async function updateContact(
  contactId: number,
  body: { name?: string; phone_number?: string | null; email?: string | null }
): Promise<void> {
  const clean: Record<string, unknown> = {}
  if (body.name) clean.name = body.name
  if (body.phone_number) clean.phone_number = body.phone_number
  if (body.email) clean.email = body.email
  if (!Object.keys(clean).length) return
  await cw(`/contacts/${contactId}`, { method: 'PUT', body: JSON.stringify(clean) })
}

// ============================================================
// Agentes
// ============================================================

export interface ChatwootAgent {
  id: number
  name: string
  email?: string
  availability_status?: string
  role?: string
}

export async function listAgents(): Promise<ChatwootAgent[]> {
  const r = await cw<ChatwootAgent[] | { payload?: ChatwootAgent[] }>(`/agents`)
  return Array.isArray(r) ? r : r?.payload ?? []
}

// ============================================================
// Definições de custom attributes (o "cadastro" dos campos no Chatwoot)
// ============================================================

export interface ChatwootAttributeDefinition {
  id: number
  attribute_key: string
  attribute_display_name: string
  attribute_description?: string | null
  attribute_values?: string[] | null
  default_value?: string | null
  modelo: CampoModelo
  tipo: CampoTipo
}

function normalizeDef(raw: Record<string, unknown>): ChatwootAttributeDefinition | null {
  const modelo = parseModelo(raw.attribute_model)
  const tipo = parseTipo(raw.attribute_display_type)
  if (!modelo || !tipo || typeof raw.attribute_key !== 'string') return null
  return {
    id: Number(raw.id),
    attribute_key: raw.attribute_key,
    attribute_display_name: String(raw.attribute_display_name ?? raw.attribute_key),
    attribute_description: (raw.attribute_description as string | null) ?? null,
    attribute_values: Array.isArray(raw.attribute_values) ? (raw.attribute_values as string[]) : null,
    default_value: (raw.default_value as string | null) ?? null,
    modelo,
    tipo,
  }
}

/** Todas as definições (contato + conversa). Consulta os dois modelos e mescla por id. */
export async function listAttributeDefinitions(): Promise<ChatwootAttributeDefinition[]> {
  const out = new Map<number, ChatwootAttributeDefinition>()
  for (const model of ['contact_attribute', 'conversation_attribute']) {
    const r = await cw<Record<string, unknown>[] | { payload?: Record<string, unknown>[] }>(
      `/custom_attribute_definitions?attribute_model=${model}`
    )
    const list = Array.isArray(r) ? r : r?.payload ?? []
    for (const raw of list) {
      const d = normalizeDef(raw)
      if (d) out.set(d.id, d)
    }
  }
  return Array.from(out.values())
}

export interface AttributeDefinitionInput {
  key: string
  label: string
  modelo: CampoModelo
  tipo: CampoTipo
  opcoes?: string[]
  descricao?: string | null
}

export async function createAttributeDefinition(
  input: AttributeDefinitionInput
): Promise<ChatwootAttributeDefinition | null> {
  const r = await cw<Record<string, unknown>>(`/custom_attribute_definitions`, {
    method: 'POST',
    body: JSON.stringify({
      attribute_display_name: input.label,
      attribute_key: input.key,
      attribute_model: CW_ATTRIBUTE_MODEL[input.modelo],
      attribute_display_type: CW_DISPLAY_TYPE[input.tipo],
      attribute_values: input.tipo === 'list' ? input.opcoes ?? [] : [],
      attribute_description: input.descricao ?? '',
    }),
  })
  return r ? normalizeDef(r) : null
}

export async function updateAttributeDefinition(
  id: number,
  input: Partial<Pick<AttributeDefinitionInput, 'label' | 'opcoes' | 'descricao'>>
): Promise<void> {
  const body: Record<string, unknown> = {}
  if (input.label !== undefined) body.attribute_display_name = input.label
  if (input.opcoes !== undefined) body.attribute_values = input.opcoes
  if (input.descricao !== undefined) body.attribute_description = input.descricao ?? ''
  if (!Object.keys(body).length) return
  await cw(`/custom_attribute_definitions/${id}`, { method: 'PATCH', body: JSON.stringify(body) })
}

export async function deleteAttributeDefinition(id: number): Promise<void> {
  await cw(`/custom_attribute_definitions/${id}`, { method: 'DELETE' })
}

// ============================================================
// Utilidades
// ============================================================

/**
 * Telefone para o formato E.164 que o Chatwoot usa (+55DDDNÚMERO). Aceita máscara
 * brasileira "(11) 99999-9999"; devolve null se não parecer um telefone.
 */
export function telefoneE164(raw: string | null | undefined): string | null {
  if (!raw) return null
  const d = raw.replace(/\D/g, '')
  if (d.length < 10) return null
  if (d.startsWith('55') && (d.length === 12 || d.length === 13)) return `+${d}`
  if (d.length === 10 || d.length === 11) return `+55${d}`
  return `+${d}`
}
