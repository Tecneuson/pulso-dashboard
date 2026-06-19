'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Bell, Sun, Moon } from 'lucide-react'
import { useTheme } from '@/components/theme-provider'

interface HeaderProps {
  title: string
  subtitle?: string
}

export function Header({ title, subtitle }: HeaderProps) {
  const [search, setSearch] = useState('')
  const { theme, toggle } = useTheme()
  const router = useRouter()

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    if (search.trim()) {
      router.push(`/contacts?q=${encodeURIComponent(search.trim())}`)
    }
  }

  return (
    <header className="flex items-center justify-between gap-4 mb-6 pb-4 border-b border-border">
      <div className="min-w-0">
        <h1 className="font-display text-display-md text-content-primary truncate">
          {title}
        </h1>
        {subtitle && (
          <p className="text-sm text-content-secondary mt-0.5 truncate">{subtitle}</p>
        )}
      </div>

      <div className="flex items-center gap-1.5">
        <form onSubmit={handleSearch} className="relative hidden md:block">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-content-tertiary pointer-events-none"
          />
          <input
            type="text"
            placeholder="Buscar contato..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 w-56 pl-8 pr-3 rounded-lg bg-surface-secondary border border-border text-sm text-content-primary placeholder:text-content-tertiary focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/40 transition-colors"
          />
        </form>

        <button
          onClick={toggle}
          className="focus-ring p-2 rounded-lg hover:bg-surface-secondary text-content-secondary hover:text-content-primary transition-colors"
          title={theme === 'light' ? 'Modo escuro' : 'Modo claro'}
          aria-label="Alternar tema"
        >
          {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
        </button>

        <button
          className="focus-ring relative p-2 rounded-lg hover:bg-surface-secondary text-content-secondary hover:text-content-primary transition-colors"
          aria-label="Notificações"
        >
          <Bell size={16} />
        </button>
      </div>
    </header>
  )
}
