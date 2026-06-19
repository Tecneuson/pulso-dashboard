import { createClient } from '@supabase/supabase-js'

/**
 * Client service_role (server-only). Bypassa RLS — usar SOMENTE em rotas server-side
 * confiáveis (ex: webhook do Chatwoot, validado por segredo). NUNCA expor ao browser.
 */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}
