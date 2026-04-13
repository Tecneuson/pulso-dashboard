'use client'

import { useEffect, useRef, useState } from 'react'

interface KpiCardProps {
  label: string
  value: string | number
  delta?: number
  deltaLabel?: string
  prefix?: string
  suffix?: string
}

export function KpiCard({ label, value, delta, deltaLabel, prefix, suffix }: KpiCardProps) {
  const [displayed, setDisplayed] = useState(typeof value === 'number' ? 0 : value)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (typeof value !== 'number') {
      setDisplayed(value)
      return
    }

    const target = value
    const duration = 600
    const start = performance.now()

    function tick(now: number) {
      const elapsed = now - start
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplayed(Math.round(target * eased))
      if (progress < 1) requestAnimationFrame(tick)
    }

    requestAnimationFrame(tick)
  }, [value])

  return (
    <div
      ref={ref}
      className="bg-surface-secondary border border-border rounded-lg p-4 shadow-card animate-fade-up"
    >
      <p className="text-[13px] text-content-secondary mb-1">{label}</p>
      <p className="font-mono text-[28px] font-semibold text-content-primary tabular-nums leading-tight">
        {prefix}
        {displayed}
        {suffix}
      </p>
      {delta !== undefined && (
        <p
          className={`text-xs font-mono mt-1 ${
            delta > 0
              ? 'text-success-500'
              : delta < 0
              ? 'text-danger-500'
              : 'text-content-tertiary'
          }`}
        >
          {delta > 0 ? '+' : ''}
          {delta}
          {deltaLabel ? ` ${deltaLabel}` : '%'}
        </p>
      )}
    </div>
  )
}
