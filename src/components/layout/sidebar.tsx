'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Columns3,
  Users,
  UserPlus,
  CalendarDays,
  MessageSquare,
  BarChart3,
  Settings,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Activity,
} from 'lucide-react'
import type { DashboardUser } from '@/types'
import { createClient } from '@/lib/supabase/client'

const navSections = [
  {
    label: 'Operação',
    items: [
      { href: '/kanban' as const, label: 'Funil', icon: Columns3 },
      { href: '/agenda' as const, label: 'Agenda', icon: CalendarDays },
      { href: '/contacts' as const, label: 'Contatos', icon: Users },
      { href: '/captadores' as const, label: 'Captadores', icon: UserPlus },
      { href: '/conversations' as const, label: 'Conversas', icon: MessageSquare },
    ],
  },
  {
    label: 'Análise',
    items: [
      { href: '/dashboard' as const, label: 'Dashboard', icon: LayoutDashboard },
      { href: '/reports' as const, label: 'Relatórios', icon: BarChart3 },
    ],
  },
  {
    label: 'Sistema',
    items: [{ href: '/settings' as const, label: 'Configurações', icon: Settings }],
  },
]

interface SidebarProps {
  user: DashboardUser | null
}

export function Sidebar({ user }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false)
  const pathname = usePathname()

  useEffect(() => {
    setCollapsed(localStorage.getItem('pulso-sidebar-collapsed') === '1')
  }, [])

  function toggleCollapsed() {
    setCollapsed((c) => {
      const next = !c
      localStorage.setItem('pulso-sidebar-collapsed', next ? '1' : '0')
      return next
    })
  }

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  return (
    <aside
      className={`flex flex-col h-screen bg-sidebar-bg border-r border-sidebar-border transition-[width] duration-200 ${
        collapsed ? 'w-16' : 'w-60'
      }`}
    >
      {/* Logo */}
      <div className="flex items-center justify-between h-14 px-4 border-b border-sidebar-border">
        <Link href="/kanban" className={`focus-ring flex items-center gap-2.5 rounded ${collapsed ? 'mx-auto' : ''}`}>
          <div className="w-8 h-8 rounded-lg bg-brand-500 flex items-center justify-center shrink-0 shadow-sm">
            <Activity size={18} className="text-white" strokeWidth={2.5} />
          </div>
          {!collapsed && (
            <span className="font-display text-lg font-semibold tracking-tight text-sidebar-text-active">
              Pulso
            </span>
          )}
        </Link>
        {!collapsed && (
          <button
            onClick={toggleCollapsed}
            className="focus-ring p-1.5 rounded hover:bg-sidebar-hover text-sidebar-text transition-colors"
            aria-label="Recolher menu"
          >
            <ChevronLeft size={16} />
          </button>
        )}
      </div>

      {collapsed && (
        <div className="flex justify-center py-2">
          <button
            onClick={toggleCollapsed}
            className="focus-ring p-1.5 rounded hover:bg-sidebar-hover text-sidebar-text transition-colors"
            aria-label="Expandir menu"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 py-3 px-2 overflow-y-auto">
        {navSections.map((section) => (
          <div key={section.label} className="mb-4 last:mb-0">
            {!collapsed && (
              <p className="px-3 mb-1 text-overline uppercase text-white/45 select-none">
                {section.label}
              </p>
            )}
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const isActive = pathname.startsWith(item.href)
                const Icon = item.icon
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={collapsed ? item.label : undefined}
                    className={`focus-ring group relative flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                      isActive
                        ? 'bg-sidebar-active-bg text-sidebar-text-active font-medium'
                        : 'text-sidebar-text hover:bg-sidebar-hover hover:text-sidebar-text-active'
                    } ${collapsed ? 'justify-center' : ''}`}
                  >
                    {isActive && (
                      <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-full bg-brand-400" />
                    )}
                    <Icon
                      size={18}
                      className={`shrink-0 ${isActive ? 'text-brand-400' : ''}`}
                    />
                    {!collapsed && <span>{item.label}</span>}
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* User menu */}
      <div className="border-t border-sidebar-border p-3">
        <div className={`flex items-center gap-3 ${collapsed ? 'justify-center' : ''}`}>
          <div className="w-8 h-8 rounded-full bg-brand-500/25 ring-1 ring-brand-500/30 flex items-center justify-center shrink-0">
            <span className="text-xs font-semibold text-brand-200">
              {user?.name?.charAt(0)?.toUpperCase() ?? '?'}
            </span>
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-sidebar-text-active truncate">
                {user?.name ?? 'Usuário'}
              </p>
              <p className="text-[11px] text-sidebar-text truncate capitalize">
                {user?.role ?? 'viewer'}
              </p>
            </div>
          )}
          {!collapsed && (
            <button
              onClick={handleLogout}
              className="focus-ring p-1.5 rounded hover:bg-sidebar-hover text-sidebar-text transition-colors"
              title="Sair"
              aria-label="Sair"
            >
              <LogOut size={14} />
            </button>
          )}
        </div>
      </div>
    </aside>
  )
}
