import type { HTMLAttributes } from 'react'

type AvatarSize = 'sm' | 'md' | 'lg'

interface AvatarProps extends HTMLAttributes<HTMLDivElement> {
  name: string
  src?: string | null
  size?: AvatarSize
}

const sizeStyles: Record<AvatarSize, string> = {
  sm: 'w-6 h-6 text-[10px]',
  md: 'w-8 h-8 text-xs',
  lg: 'w-10 h-10 text-sm',
}

export function Avatar({ name, src, size = 'md', className = '', ...props }: AvatarProps) {
  const initials = name
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className={`rounded-full object-cover shrink-0 ${sizeStyles[size]} ${className}`}
      />
    )
  }

  return (
    <div
      className={`rounded-full bg-brand-500/20 flex items-center justify-center shrink-0 font-medium text-brand-500 ${sizeStyles[size]} ${className}`}
      title={name}
      {...props}
    >
      {initials}
    </div>
  )
}
