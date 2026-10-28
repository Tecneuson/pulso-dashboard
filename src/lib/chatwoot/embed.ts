/**
 * Card do lead dentro do Chatwoot (Dashboard App → /embed/conversa).
 *
 * O Chatwoot abre a página num iframe e entrega o contexto (conversa, contato, agente)
 * por postMessage. Só aceitamos mensagens destes endereços — os mesmos liberados no
 * `frame-ancestors` do next.config.mjs.
 */
const PADRAO = ['https://chat.hospitalsantamonica.com.br']

function origem(url: string | undefined): string | null {
  if (!url) return null
  try {
    return new URL(url).origin
  } catch {
    return null
  }
}

export const ORIGENS_CHATWOOT: string[] = Array.from(
  new Set(
    [...PADRAO, process.env.NEXT_PUBLIC_CHATWOOT_BASE_URL]
      .map(origem)
      .filter((o): o is string => !!o)
  )
)

/** Pedido que o app manda ao Chatwoot para receber (de novo) o contexto da conversa. */
export const PEDIDO_CONTEXTO = 'chatwoot-dashboard-app:fetch-info'

export interface ContextoChatwoot {
  conversation?: {
    id?: number
    account_id?: number
    status?: string
    custom_attributes?: Record<string, unknown>
    meta?: { assignee?: { id?: number; name?: string } | null; team?: { name?: string } | null }
  }
  contact?: { id?: number; name?: string; phone_number?: string }
  currentAgent?: { id?: number; name?: string; email?: string }
}

/** Lê o evento `appContext` do Chatwoot; ignora qualquer outra mensagem. */
export function lerContexto(ev: MessageEvent): ContextoChatwoot | null {
  if (!ORIGENS_CHATWOOT.includes(ev.origin)) return null
  let dado: unknown = ev.data
  if (typeof dado === 'string') {
    try {
      dado = JSON.parse(dado)
    } catch {
      return null
    }
  }
  const msg = dado as { event?: string; data?: ContextoChatwoot } | null
  if (!msg || msg.event !== 'appContext' || !msg.data) return null
  return msg.data
}
