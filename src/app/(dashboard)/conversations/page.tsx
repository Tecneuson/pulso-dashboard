import { Header } from '@/components/layout/header'
import { ConversationList } from '@/components/conversations/conversation-list'
import { createClient } from '@/lib/supabase/server'
import type { Triagem } from '@/types'

export const revalidate = 0

export default async function ConversationsPage() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('triagem_hsm')
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(500)

  if (error) {
    return (
      <>
        <Header title="Conversas" subtitle="Conversas do Chatwoot" />
        <div className="bg-danger-500/10 border border-danger-500/30 rounded-lg p-4 text-sm text-danger-500">
          Erro ao carregar dados: {error.message}
        </div>
      </>
    )
  }

  const triagens = (data ?? []) as Triagem[]

  return (
    <>
      <Header title="Conversas" subtitle="Conversas atendidas pelo agente de IA" />
      <ConversationList
        triagens={triagens}
        chatwootBaseUrl={process.env.NEXT_PUBLIC_CHATWOOT_BASE_URL}
      />
    </>
  )
}
