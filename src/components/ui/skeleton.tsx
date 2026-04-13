import type { HTMLAttributes } from 'react'

interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  width?: string | number
  height?: string | number
}

export function Skeleton({ width, height, className = '', style, ...props }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse rounded bg-surface-tertiary ${className}`}
      style={{ width, height, ...style }}
      {...props}
    />
  )
}

export function SkeletonCard({ className = '' }: { className?: string }) {
  return (
    <div className={`bg-surface-secondary border border-border rounded-lg p-4 space-y-3 ${className}`}>
      <Skeleton height={12} width="40%" />
      <Skeleton height={28} width="60%" />
      <Skeleton height={12} width="30%" />
    </div>
  )
}

export function SkeletonKanbanCard() {
  return (
    <div className="bg-surface-secondary border border-border rounded-lg p-3 space-y-2 w-[280px]">
      <div className="flex justify-between">
        <Skeleton height={10} width={60} />
        <Skeleton height={10} width={50} />
      </div>
      <Skeleton height={14} width="80%" />
      <Skeleton height={10} width="50%" />
    </div>
  )
}
