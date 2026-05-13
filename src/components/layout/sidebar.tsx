'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Columns3,
  Users,
  MessageSquare,
  BarChart3,
  Settings,
  ChevronLeft,
  ChevronRight,
  LogOut,
} from 'lucide-react'
import type { DashboardUser } from '@/types'

const navItems = [
  { href: '/kanban' as const, label: 'Kanban', icon: Columns3 },
  { href: '/dashboard' as const, label: 'Dashboard', icon: LayoutDashboard },
  { href: '/contacts' as const, label: 'Contatos', icon: Users },
  { href: '/conversations' as const, label: 'Conversas', icon: MessageSquare },
  { href: '/reports' as const, label: 'Relatórios', icon: BarChart3 },
  { href: '/settings' as const, label: 'Configurações', icon: Settings },
]

interface SidebarProps {
  user: DashboardUser | null
}

export function Sidebar({ user }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false)
  const pathname = usePathname()

  function handleLogout() {
    window.location.href = '/login'
  }

  return (
    <aside
      className={`flex flex-col h-screen bg-sidebar-bg transition-[width] duration-200 ${
        collapsed ? 'w-16' : 'w-60'
      }`}
    >
      {/* Logo */}
      <div className="flex items-center justify-between h-14 px-4 border-b border-sidebar-border">
        {!collapsed && (
          <Link href="/kanban" className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-brand-500 flex items-center justify-center">
              <span className="text-white text-xs font-bold">P</span>
            </div>
            <span className="font-display text-lg font-semibold text-sidebar-text-active">
              Pulso
            </span>
          </Link>
        )}
        {collapsed && (
          <div className="w-7 h-7 rounded-lg bg-brand-500 flex items-center justify-center mx-auto">
            <span className="text-white text-xs font-bold">P</span>
          </div>
        )}
        {!collapsed && (
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-1.5 rounded hover:bg-sidebar-hover text-sidebar-text transition-colors"
          >
            <ChevronLeft size={16} />
          </button>
        )}
      </div>

      {/* Expand button when collapsed */}
      {collapsed && (
        <div className="flex justify-center py-2">
          <button
            onClick={() => setCollapsed(false)}
            className="p-1.5 rounded hover:bg-sidebar-hover text-sidebar-text transition-colors"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = pathname.startsWith(item.href)
          const Icon = item.icon

          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? item.label : undefined}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                isActive
                  ? 'bg-sidebar-active-bg text-sidebar-text-active font-medium'
                  : 'text-sidebar-text hover:bg-sidebar-hover hover:text-sidebar-text-active'
              } ${collapsed ? 'justify-center' : ''}`}
            >
              <Icon size={18} className="shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          )
        })}
      </nav>

      {/* User menu */}
      <div className="border-t border-sidebar-border p-3">
        <div className={`flex items-center gap-3 ${collapsed ? 'justify-center' : ''}`}>
          <div className="w-8 h-8 rounded-full bg-brand-500/30 flex items-center justify-center shrink-0">
            <span className="text-xs font-medium text-brand-200">
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
              className="p-1.5 rounded hover:bg-sidebar-hover text-sidebar-text transition-colors"
              title="Sair"
            >
              <LogOut size={14} />
            </button>
          )}
        </div>
      </div>
    </aside>
  )
}
