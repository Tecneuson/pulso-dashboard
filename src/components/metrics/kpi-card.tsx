'use client'

import { useEffect, useState } from 'react'
import { ArrowDown, ArrowUp, Minus } from 'lucide-react'

interface KpiCardProps {
  label: string
  value: string | number
  delta?: number
  deltaLabel?: string
  prefix?: string
  suffix?: string
}

export function KpiCard({ label, value, delta, deltaLabel, prefix, suffix }: KpiCardProps) {
  const isNumber = typeof value === 'number'
  const decimals = isNumber && !Number.isInteger(value) ? (String(value).split('.')[1]?.length ?? 0) : 0
  const [displayed, setDisplayed] = useState<number>(isNumber ? 0 : 0)

  useEffect(() => {
    if (!isNumber) return
    const target = value as number
    const duration = 600
    const start = performance.now()
    let raf = 0

    function tick(now: number) {
      const progress = Math.min((now - start) / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplayed(progress < 1 ? Number((target * eased).toFixed(decimals)) : target)
      if (progress < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [value, isNumber, decimals])

  const shown = isNumber
    ? displayed.toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
    : value

  const DeltaIcon = delta === undefined ? null : delta > 0 ? ArrowUp : delta < 0 ? ArrowDown : Minus
  const deltaColor =
    delta === undefined
      ? ''
      : delta > 0
      ? 'text-success-600 dark:text-success-500'
      : delta < 0
      ? 'text-danger-600 dark:text-danger-500'
      : 'text-content-tertiary'

  return (
    <div className="surface-elevated-highlight bg-surface-secondary border border-border rounded-lg p-4 shadow-card transition-colors hover:border-border-hover animate-fade-up">
      <p className="text-overline uppercase text-content-tertiary">{label}</p>
      <p className="mt-2 font-mono text-mono-lg font-semibold text-content-primary tabular-nums leading-none">
        {prefix}
        {shown}
        {suffix}
      </p>
      <div className="mt-2 h-4 flex items-center">
        {delta !== undefined && DeltaIcon && (
          <span className={`inline-flex items-center gap-1 font-mono text-mono-sm tabular-nums ${deltaColor}`}>
            <DeltaIcon size={12} strokeWidth={2.5} />
            {Math.abs(delta)}
            {deltaLabel ? ` ${deltaLabel}` : '%'}
          </span>
        )}
      </div>
    </div>
  )
}
