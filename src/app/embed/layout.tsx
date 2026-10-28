import { createClient } from '@/lib/supabase/server'
import { PapelProvider } from '@/components/layout/papel'
import { EntrarNoCrm } from '@/components/embed/entrar-no-crm'

/**
 * Telas do CRM dentro do Chatwoot (Dashboard Apps). Sem sidebar; só /embed/* pode abrir
 * em iframe (next.config.mjs → frame-ancestors). O middleware não redireciona /embed
 * para /login (o login não abre em iframe): sem sessão, mostra o "Entrar no CRM".
 */
export default async function EmbedLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return (
      <main className="min-h-screen bg-surface-primary p-4">
        <EntrarNoCrm />
      </main>
    )
  }

  const { data: usuario } = await supabase.from('usuarios').select('role').eq('id', user.id).single()
  return (
    <main className="min-h-screen bg-surface-primary p-4">
      <PapelProvider admin={usuario?.role === 'gestor'}>{children}</PapelProvider>
    </main>
  )
}
