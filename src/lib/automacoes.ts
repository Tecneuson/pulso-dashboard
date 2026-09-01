import type { SupabaseClient } from '@supabase/supabase-js'
import { MOTIVO_PERDA_INATIVIDADE, MOTIVO_PERDA_LABELS, type EstagioFunil } from '@/types'
import { etapaFromEstagio, ETAPA_TO_ESTAGIO } from '@/lib/funil-etapas'
import { limitesInatividade } from '@/lib/env'
import {
  listConversations,
  toggleConversationStatus,
  updateConversationCustomAttributes,
  type ChatwootConversation,
} from '@/lib/chatwoot/client'
import { KEYS } from '@/lib/chatwoot/attributes'
import { atualizarSeMudou } from '@/lib/triagem-db'

/**
 * Automações agendadas (a cada 5 min) para o modo sem n8n. Acionadas por /api/cron/automacoes.
 *
 * A distribuição de conversas entre atendentes NÃO mora mais aqui: passou a ser a
 * **atribuição automática nativa do Chatwoot** (Configurações → Caixas de entrada →
 * Atribuição automática), que respeita disponibilidade e limite por agente — coisa que
 * a roleta antiga (round-robin por `id % nº de agentes`) não fazia.
 *
 * Diferença importante em relação ao n8n: antes de encerrar por inatividade o app marca
 * `motivo_de_perda = Falta de Interação` (Chatwoot) e `motivo_perda/estagio` (CRM) —
 * senão a regra "não encerra sem venda/motivo" reabriria a conversa em seguida.
 */

const MAX_PAGINAS = 12 // 12 × 25 = 300 conversas abertas por rodada

async function todasAbertas(): Promise<ChatwootConversation[]> {
  const out: ChatwootConversation[] = []
  for (let page = 1; page <= MAX_PAGINAS; page++) {
    const lote = await listConversations({ status: 'open', page })
    out.push(...lote)
    if (lote.length < 25) break
  }
  return out
}

export interface ResultadoEncerrar {
  avaliadas: number
  encerradas: Array<{ conversation_id: string; etapa: string; minutos: number; limite: number }>
  erros: string[]
}

export async function encerrarInativas(admin: SupabaseClient): Promise<ResultadoEncerrar> {
  const limites = limitesInatividade()
  const r: ResultadoEncerrar = { avaliadas: 0, encerradas: [], erros: [] }
  const abertas = await todasAbertas()
  r.avaliadas = abertas.length
  if (!abertas.length) return r

  const ids = abertas.map((c) => String(c.id))
  const { data: triagens } = await admin
    .from('triagem_hsm')
    .select('id, conversation_id, estagio_funil, motivo_perda')
    .in('conversation_id', ids)
  const porConversa = new Map<string, { id: string; estagio_funil: EstagioFunil | null; motivo_perda: string | null }>()
  for (const t of triagens ?? []) porConversa.set(String(t.conversation_id), t as never)

  const agora = Math.floor(Date.now() / 1000)
  for (const c of abertas) {
    const t = porConversa.get(String(c.id))
    const etapa = t ? etapaFromEstagio(t.estagio_funil) : 'contato'
    const limite = limites[etapa]
    if (!limite) continue // rastreio/internacao/perdido: nunca fecha
    const last = Number(c.last_activity_at || c.timestamp || 0)
    if (!last) continue
    const minutos = (agora - last) / 60
    if (minutos < limite) continue
    try {
      // 1) desfecho no Chatwoot (permite encerrar) e 2) no CRM (vira Perdido)
      await updateConversationCustomAttributes(
        c.id,
        { [KEYS.motivoPerda]: MOTIVO_PERDA_LABELS[MOTIVO_PERDA_INATIVIDADE], [KEYS.venda]: 'Não' },
        c.custom_attributes
      )
      if (t) {
        await atualizarSeMudou(admin, { id: t.id }, {
          motivo_perda: MOTIVO_PERDA_INATIVIDADE,
          estagio_funil: ETAPA_TO_ESTAGIO.perdido,
          transbordado: false,
        })
      }
      await toggleConversationStatus(c.id, 'resolved')
      r.encerradas.push({ conversation_id: String(c.id), etapa, minutos: Math.round(minutos), limite })
    } catch (e) {
      r.erros.push(`${c.id}: ${(e as Error).message}`)
    }
  }
  return r
}
