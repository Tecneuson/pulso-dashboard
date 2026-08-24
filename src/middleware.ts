import { type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export async function middleware(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  // Rotas server-to-server (webhooks/cron) autenticam por segredo próprio, não por sessão:
  // api/chatwoot (webhook + auditoria), api/sync (database webhook), api/cron.
  // A auditoria (/api/chatwoot/auditoria) valida a sessão dentro da própria rota.
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|logo.svg|api/health|api/chatwoot|api/sync|api/cron).*)',
  ],
}
