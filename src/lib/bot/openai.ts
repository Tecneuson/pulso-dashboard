/**
 * Cliente mínimo da API da OpenAI (chat completions com tools, visão e embeddings),
 * sem SDK — só o que o bot Mônica precisa. Server-only.
 */

export type ChatMessage =
  | { role: 'system' | 'user' | 'assistant'; content: string | null; tool_calls?: ToolCall[] }
  | { role: 'tool'; tool_call_id: string; content: string }
  | { role: 'user'; content: Array<{ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }> }

export interface ToolCall {
  id: string
  type: 'function'
  function: { name: string; arguments: string }
}

export interface ToolSpec {
  type: 'function'
  function: { name: string; description: string; parameters: Record<string, unknown> }
}

function apiKey(): string {
  const k = process.env.OPENAI_API_KEY
  if (!k) throw new Error('OPENAI_API_KEY ausente')
  return k
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`https://api.openai.com/v1${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(60_000),
  })
  if (!res.ok) {
    const txt = await res.text().catch(() => '')
    throw new Error(`OpenAI ${path} -> ${res.status} ${txt.slice(0, 300)}`)
  }
  return (await res.json()) as T
}

export interface ChatResult {
  content: string | null
  tool_calls?: ToolCall[]
}

export async function chat(params: {
  model: string
  messages: ChatMessage[]
  tools?: ToolSpec[]
  temperature?: number
}): Promise<ChatResult> {
  const r = await post<{ choices: Array<{ message: { content: string | null; tool_calls?: ToolCall[] } }> }>(
    '/chat/completions',
    {
      model: params.model,
      messages: params.messages,
      tools: params.tools?.length ? params.tools : undefined,
      tool_choice: params.tools?.length ? 'auto' : undefined,
      temperature: params.temperature ?? 0.3,
    }
  )
  const m = r.choices?.[0]?.message
  return { content: m?.content ?? null, tool_calls: m?.tool_calls }
}

export async function embed(model: string, input: string): Promise<number[]> {
  const r = await post<{ data: Array<{ embedding: number[] }> }>('/embeddings', { model, input })
  return r.data?.[0]?.embedding ?? []
}
