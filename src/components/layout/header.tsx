'use client'

import { useState } from 'react'
import { Search, Bell, Sun, Moon } from 'lucide-react'
import { useTheme } from '@/components/theme-provider'

const periods = [
  { value: 'today', label: 'Hoje' },
  { value: 'week', label: 'Semana' },
  { value: 'month', label: 'Mês' },
] as const

interface HeaderProps {
  title: string
  subtitle?: string
}

export function Header({ title, subtitle }: HeaderProps) {
  const [period, setPeriod] = useState<string>('today')
  const { theme, toggle } = useTheme()

  return (
    <header className="flex items-center justify-between gap-4 mb-6">
      {/* Left — title */}
      <div>
        <h1 className="font-display text-[22px] font-semibold text-content-primary">
          {title}
        </h1>
        {subtitle && (
          <p className="text-sm text-content-secondary mt-0.5">{subtitle}</p>
        )}
      </div>

      {/* Right — actions */}
      <div className="flex items-center gap-2">
        {/* Search */}
        <div className="relative hidden md:block">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-content-tertiary"
          />
          <input
            type="text"
            placeholder="Buscar contato..."
            className="h-9 w-56 pl-8 pr-3 rounded-lg bg-surface-secondary border border-border text-sm text-content-primary placeholder:text-content-tertiary focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-colors"
          />
        </div>

        {/* Period filter */}
        <div className="flex rounded-lg bg-surface-secondary border border-border p-0.5">
          {periods.map((p) => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                period === p.value
                  ? 'bg-surface-elevated text-content-primary shadow-card'
                  : 'text-content-secondary hover:text-content-primary'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Theme toggle */}
        <button
          onClick={toggle}
          className="p-2 rounded-lg hover:bg-surface-secondary text-content-secondary transition-colors"
          title={theme === 'light' ? 'Modo escuro' : 'Modo claro'}
        >
          {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
        </button>

        {/* Notifications */}
        <button className="relative p-2 rounded-lg hover:bg-surface-secondary text-content-secondary transition-colors">
          <Bell size={16} />
        </button>
      </div>
    </header>
  )
}
