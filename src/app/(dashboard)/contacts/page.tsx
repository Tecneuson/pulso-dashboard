import { Header } from '@/components/layout/header'
import { ContactsTable } from '@/components/contacts/contacts-table'
import { createClient } from '@/lib/supabase/server'
import type { Triagem } from '@/types'

export const revalidate = 0

interface PageProps {
  searchParams: Promise<{ q?: string }>
}

export default async function ContactsPage({ searchParams }: PageProps) {
  const { q } = await searchParams
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('triagem_hsm')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(2000)

  if (error) {
    return (
      <>
        <Header title="Contatos" subtitle="Lista de contatos do atendimento" />
        <div className="bg-danger-500/10 border border-danger-500/30 rounded-lg p-4 text-sm text-danger-500">
          Erro ao carregar dados: {error.message}
        </div>
      </>
    )
  }

  const triagens = (data ?? []) as Triagem[]

  return (
    <>
      <Header title="Contatos" subtitle="Lista de contatos do atendimento" />
      <ContactsTable triagens={triagens} initialSearch={q ?? ''} />
    </>
  )
}
