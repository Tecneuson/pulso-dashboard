'use client'

import { useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Bell, Sun, Moon, X } from 'lucide-react'
import { useTheme } from '@/components/theme-provider'

interface HeaderProps {
  title: string
  subtitle?: string
  /**
   * Busca da própria página (ex.: o funil). Quando informada, ocupa o centro do
   * header e SUBSTITUI a busca global de contatos — evita duas barras de busca
   * na mesma tela.
   */
  search?: {
    value: string
    onChange: (value: string) => void
    placeholder?: string
  }
  /** Ação principal à direita (ex.: "Adicionar Contato"). */
  action?: ReactNode
}

export function Header({ title, subtitle, search, action }: HeaderProps) {
  const [buscaGlobal, setBuscaGlobal] = useState('')
  const { theme, toggle } = useTheme()
  const router = useRouter()

  function handleSearchGlobal(e: React.FormEvent) {
    e.preventDefault()
    if (buscaGlobal.trim()) {
      router.push(`/contacts?q=${encodeURIComponent(buscaGlobal.trim())}`)
    }
  }

  return (
    <header className="flex items-center gap-4 mb-6 pb-4 border-b border-border">
      <div className="min-w-0 shrink-0">
        <h1 className="font-display text-display-md text-content-primary truncate">{title}</h1>
        {subtitle && <p className="text-sm text-content-secondary mt-0.5 truncate">{subtitle}</p>}
      </div>

      {search ? (
        <div className="relative flex-1 max-w-2xl mx-auto">
          <Search
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-content-tertiary pointer-events-none"
          />
          <input
            type="search"
            value={search.value}
            onChange={(e) => search.onChange(e.target.value)}
            placeholder={search.placeholder ?? 'Pesquisar'}
            className="w-full h-10 pl-9 pr-8 rounded-lg bg-surface-secondary border border-border text-sm text-content-primary placeholder:text-content-tertiary focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/40 transition-colors"
          />
          {search.value && (
            <button
              type="button"
              onClick={() => search.onChange('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-content-tertiary hover:text-content-primary"
              aria-label="Limpar busca"
            >
              <X size={14} />
            </button>
          )}
        </div>
      ) : (
        <div className="flex-1" />
      )}

      <div className="flex items-center gap-1.5 shrink-0">
        {action}

        {!search && (
          <form onSubmit={handleSearchGlobal} className="relative hidden md:block w-56">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-content-tertiary pointer-events-none"
            />
            <input
              type="text"
              placeholder="Buscar contato..."
              value={buscaGlobal}
              onChange={(e) => setBuscaGlobal(e.target.value)}
              className="h-9 w-full pl-8 pr-3 rounded-lg bg-surface-secondary border border-border text-sm text-content-primary placeholder:text-content-tertiary focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/40 transition-colors"
            />
          </form>
        )}

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
