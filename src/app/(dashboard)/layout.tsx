import { Sidebar } from '@/components/layout/sidebar'
import type { DashboardUser } from '@/types'

const demoUser: DashboardUser = {
  id: 'demo',
  email: 'arthur@elocriativo.com.br',
  name: 'Arthur Barbosa',
  role: 'admin',
  avatar_url: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar user={demoUser} />
      <main className="flex-1 overflow-y-auto p-6 lg:p-8">
        {children}
      </main>
    </div>
  )
}
