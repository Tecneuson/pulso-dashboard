/**
 * Carga inicial / reconciliação: Chatwoot → banco (Chatwoot vence).
 * Para cada triagem com conversation_id, puxa os custom attributes do contato/conversa
 * no Chatwoot e sobrescreve os campos correspondentes no triagem_hsm.
 *
 * Uso: npx tsx scripts/sync-from-chatwoot.ts
 * Requer NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, CHATWOOT_* no .env.local.
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'
import { getConversation, chatwootConfigured } from '../src/lib/chatwoot/client'
import { triagemFromChatwoot } from '../src/lib/chatwoot/mapping'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

// Carrega .env.local em process.env (o client lê env de forma lazy)
for (const line of readFileSync(join(ROOT, '.env.local'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim()
}

async function main() {
  if (!chatwootConfigured()) {
    console.error('✗ Chatwoot não configurado (CHATWOOT_BASE_URL/CHATWOOT_API_TOKEN).')
    process.exit(1)
  }

  const supa = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  const { data: rows, error } = await supa
    .from('triagem_hsm')
    .select('id, conversation_id')
    .not('conversation_id', 'is', null)

  if (error) {
    console.error('✗', error.message)
    process.exit(1)
  }

  console.log(`Reconciliando ${rows.length} triagens com conversation_id...`)
  let updated = 0
  let skipped = 0
  let failed = 0

  for (const r of rows) {
    try {
      const conv = await getConversation(r.conversation_id as string)
      const contactAttrs = conv.meta?.sender?.custom_attributes || {}
      const convAttrs = conv.custom_attributes || {}
      const patch: Record<string, unknown> = { ...triagemFromChatwoot(contactAttrs, convAttrs) }
      if (Array.isArray(conv.labels) && conv.labels.length) patch.tags = conv.labels

      if (Object.keys(patch).length === 0) {
        skipped++
        continue
      }
      const { error: upErr } = await supa.from('triagem_hsm').update(patch).eq('id', r.id)
      if (upErr) {
        console.error(`  ✗ ${r.conversation_id}: ${upErr.message}`)
        failed++
        continue
      }
      updated++
      console.log(`  ✓ conv ${r.conversation_id}:`, JSON.stringify(patch))
    } catch (e) {
      console.error(`  ✗ conv ${r.conversation_id}:`, (e as Error).message)
      failed++
    }
  }

  console.log(`\nFeito. Atualizados: ${updated} | sem dados mapeáveis: ${skipped} | falhas: ${failed}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
