import { redirect } from 'next/navigation'
import { Sidebar } from '@/components/layout/sidebar'
import { createClient } from '@/lib/supabase/server'
import type { DashboardUser } from '@/types'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Defesa em profundidade — o middleware já protege, mas garantimos aqui também.
  if (!user) redirect('/login')

  const { data: usuario } = await supabase
    .from('usuarios')
    .select('nome, role')
    .eq('id', user.id)
    .single()

  const dashboardUser: DashboardUser = {
    id: user.id,
    email: user.email ?? '',
    name: usuario?.nome ?? user.email ?? 'Usuário',
    role: usuario?.role === 'gestor' ? 'admin' : 'agent',
    avatar_url: null,
    created_at: user.created_at ?? '',
    updated_at: '',
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar user={dashboardUser} />
      <main className="flex-1 overflow-y-auto p-6 lg:p-8">{children}</main>
    </div>
  )
}
