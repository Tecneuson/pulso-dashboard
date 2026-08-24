/**
 * Backfill CRM → Chatwoot: reenvia, para cada lead com conversa/contato no Chatwoot, os
 * atributos sincronizáveis (categoria nova, kids, data de nascimento, estágio, plano…).
 * Use depois de rodar a migration 20260823 e o "Sincronizar com o Chatwoot" (definições).
 *
 * Uso: npx tsx scripts/backfill-chatwoot.ts [--dry] [--limit=200]
 * Requer NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, CHATWOOT_* no .env.local.
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'
import { chatwootConfigured } from '../src/lib/chatwoot/client'
import { pushTriagemParaChatwoot } from '../src/lib/chatwoot/sync'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
for (const line of readFileSync(join(ROOT, '.env.local'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim()
}

const DRY = process.argv.includes('--dry')
const LIMIT = Number(process.argv.find((a) => a.startsWith('--limit='))?.split('=')[1] ?? 500)

const CAMPOS = [
  'estagio_funil',
  'plano_saude',
  'tipo_contato',
  'para_quem',
  'motivo_contato',
  'assunto',
  'motivo_perda',
  'elegivel',
  'data_nascimento',
  'kids',
  'atributos',
]

async function main() {
  if (!chatwootConfigured()) {
    console.error('✗ Chatwoot não configurado (CHATWOOT_BASE_URL/CHATWOOT_API_TOKEN).')
    process.exit(1)
  }
  const supa = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })
  const { data: rows, error } = await supa
    .from('triagem_hsm')
    .select('*')
    .or('conversation_id.not.is.null,chatwoot_contact_id.not.is.null')
    .order('updated_at', { ascending: false })
    .limit(LIMIT)
  if (error) {
    console.error('✗', error.message)
    process.exit(1)
  }
  console.log(`${DRY ? '[dry] ' : ''}Backfill de ${rows.length} leads...`)
  let ok = 0
  let falha = 0
  for (const r of rows) {
    const patch: Record<string, unknown> = {}
    for (const k of CAMPOS) if (k in r) patch[k] = r[k]
    if (DRY) {
      console.log(`  · ${r.id} conv=${r.conversation_id ?? '-'} contato=${r.chatwoot_contact_id ?? '-'}`, JSON.stringify(patch))
      continue
    }
    const res = await pushTriagemParaChatwoot(supa, r, patch)
    if (res.status === 'ok') {
      ok++
      if (res.contactId && !r.chatwoot_contact_id) {
        await supa.from('triagem_hsm').update({ chatwoot_contact_id: res.contactId }).eq('id', r.id)
      }
    } else {
      falha++
      console.error(`  ✗ ${r.id}: ${res.detalhes}`)
    }
    await new Promise((x) => setTimeout(x, 150)) // respeita o rate limit do Chatwoot
  }
  console.log(`\nFeito. ok=${ok} falhas=${falha}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
