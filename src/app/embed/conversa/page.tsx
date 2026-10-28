import { createClient } from '@/lib/supabase/server'
import { PapelProvider } from '@/components/layout/papel'
import { CardDaConversa } from '@/components/embed/card-da-conversa'
import { EntrarNoCrm } from '@/components/embed/entrar-no-crm'

export const dynamic = 'force-dynamic'

/**
 * Card do lead dentro do Chatwoot — cadastrar em Configurações → Integrações →
 * Dashboard Apps com a URL https://crm.hospitalsantamonica.com.br/embed/conversa.
 * Fora do grupo (dashboard): sem sidebar. Só esta rota pode abrir em iframe
 * (next.config.mjs → frame-ancestors).
 */
export default async function EmbedConversaPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return (
    <main className="min-h-screen bg-surface-primary p-4">
      {user ? <ComPapel userId={user.id} /> : <EntrarNoCrm />}
    </main>
  )
}

async function ComPapel({ userId }: { userId: string }) {
  const supabase = await createClient()
  const { data: usuario } = await supabase.from('usuarios').select('role').eq('id', userId).single()
  return (
    <PapelProvider admin={usuario?.role === 'gestor'}>
      <CardDaConversa />
    </PapelProvider>
  )
}
