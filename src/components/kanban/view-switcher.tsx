'use client'

import { useRouter } from 'next/navigation'
import { Columns3, HeartPulse } from 'lucide-react'

interface ViewSwitcherProps {
  current: 'leads' | 'pacientes'
}

const options = [
  { key: 'leads', label: 'Leads', icon: Columns3 },
  { key: 'pacientes', label: 'Pacientes', icon: HeartPulse },
] as const

export function ViewSwitcher({ current }: ViewSwitcherProps) {
  const router = useRouter()

  return (
    <div className="inline-flex items-center gap-0.5 p-0.5 mb-4 rounded-full bg-surface-secondary border border-border">
      {options.map((o) => {
        const active = current === o.key
        const Icon = o.icon
        return (
          <button
            key={o.key}
            onClick={() => router.push(`/kanban?view=${o.key}`)}
            aria-pressed={active}
            className={`focus-ring inline-flex items-center gap-2 px-4 h-9 rounded-full text-sm font-medium transition-colors ${
              active
                ? 'bg-brand-500 text-white shadow-sm'
                : 'text-content-secondary hover:text-content-primary'
            }`}
          >
            <Icon size={15} />
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
