import { NextResponse, type NextRequest } from 'next/server'
import { segredoConfere } from '@/lib/auth'
import { isProd, n8nAtivo } from '@/lib/env'
import { createAdminClient } from '@/lib/supabase/admin'
import { chatwootConfigured } from '@/lib/chatwoot/client'
import { encerrarInativas } from '@/lib/automacoes'

/**
 * Automações agendadas (a cada 5 min): encerra conversas paradas por inatividade,
 * marcando "Falta de Interação" antes (senão a regra 12 reabriria a conversa).
 * Chamar com `Authorization: Bearer <CRON_SECRET>`.
 *
 * A distribuição de conversas é da atribuição automática NATIVA do Chatwoot.
 * Só executa em modo sem n8n (N8N_ATIVO=0); com n8n ativo responde 200 sem fazer nada,
 * para os dois não disputarem.
 *
 * Agendar via pg_cron + pg_net no Supabase (ver docs/SYNC_CHATWOOT.md) ou qualquer cron externo.
 */
async function run(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  const auth = request.headers.get('authorization') ?? ''
  const provided = auth.startsWith('Bearer ') ? auth.slice(7) : request.nextUrl.searchParams.get('secret')
  if (!secret) {
    if (isProd()) return NextResponse.json({ error: 'cron não configurado' }, { status: 503 })
  } else if (!segredoConfere(provided, secret)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 401 })
  }
  if (n8nAtivo()) return NextResponse.json({ ok: true, skipped: 'N8N_ATIVO=1 — o n8n cuida das automações' })
  if (!chatwootConfigured()) return NextResponse.json({ ok: true, skipped: 'chatwoot não configurado' })

  const admin = createAdminClient()
  const encerrar = await encerrarInativas(admin)
  return NextResponse.json({ ok: true, encerrar })
}

export const GET = run
export const POST = run
