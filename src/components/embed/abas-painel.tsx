'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const ABAS = [
  { href: '/embed/painel', label: 'Dashboard' },
  { href: '/embed/painel/relatorios', label: 'Relatórios' },
]

/** Abas do Painel dentro do Chatwoot (o menu lateral do CRM não aparece no iframe). */
export function AbasPainel() {
  const pathname = usePathname()
  return (
    <nav className="mb-4 flex gap-1 border-b border-border">
      {ABAS.map((a) => {
        const ativa = pathname === a.href
        return (
          <Link
            key={a.href}
            href={a.href}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
              ativa
                ? 'border-brand-500 text-content-primary'
                : 'border-transparent text-content-tertiary hover:text-content-primary'
            }`}
          >
            {a.label}
          </Link>
        )
      })}
    </nav>
  )
}
