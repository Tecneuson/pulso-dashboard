'use client'

import { useRouter } from 'next/navigation'

interface ViewSwitcherProps {
  current: 'leads' | 'pacientes'
}

const options = [
  { key: 'leads', label: 'Funil' },
  { key: 'pacientes', label: 'Pacientes' },
] as const

export function ViewSwitcher({ current }: ViewSwitcherProps) {
  const router = useRouter()

  return (
    <div className="inline-flex items-center gap-0.5 p-0.5 mb-4 rounded-full bg-surface-secondary border border-border">
      {options.map((o) => {
        const active = current === o.key
        return (
          <button
            key={o.key}
            onClick={() => router.push(`/kanban?view=${o.key}`)}
            aria-pressed={active}
            className={`focus-ring inline-flex items-center px-4 h-9 rounded-full text-sm font-medium transition-colors ${
              active
                ? 'bg-brand-500 text-white shadow-sm'
                : 'text-content-secondary hover:text-content-primary'
            }`}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
