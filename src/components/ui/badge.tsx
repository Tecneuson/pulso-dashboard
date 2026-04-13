import type { HTMLAttributes } from 'react'
import type { FunnelStage } from '@/types'

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'brand'

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant
}

const variantStyles: Record<BadgeVariant, string> = {
  default: 'bg-surface-tertiary text-content-secondary',
  success: 'bg-success-50 text-success-700',
  warning: 'bg-warning-50 text-warning-700',
  danger: 'bg-danger-50 text-danger-700',
  info: 'bg-info-50 text-info-700',
  brand: 'bg-brand-50 text-brand-700',
}

export function Badge({ variant = 'default', className = '', children, ...props }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-[6px] text-[13px] font-medium ${variantStyles[variant]} ${className}`}
      {...props}
    >
      {children}
    </span>
  )
}

// Maps funnel stages to badge variants
const stageVariants: Record<FunnelStage, BadgeVariant> = {
  novo_contato: 'default',
  atendendo: 'info',
  consultando_convenio: 'warning',
  autorizado_pelo_convenio: 'brand',
  paciente_a_caminho: 'info',
  hospital_recepcao: 'brand',
  recusou_internacao: 'danger',
  internacao_confirmada: 'success',
}

interface StageBadgeProps extends HTMLAttributes<HTMLSpanElement> {
  stage: FunnelStage
  label?: string
}

export function StageBadge({ stage, label, className = '', ...props }: StageBadgeProps) {
  const labels: Record<FunnelStage, string> = {
    novo_contato: 'Novo contato',
    atendendo: 'Atendendo',
    consultando_convenio: 'Consultando convênio',
    autorizado_pelo_convenio: 'Autorizado',
    paciente_a_caminho: 'A caminho',
    hospital_recepcao: 'Recepção',
    recusou_internacao: 'Recusou',
    internacao_confirmada: 'Internado',
  }

  return (
    <Badge variant={stageVariants[stage]} className={className} {...props}>
      {label ?? labels[stage]}
    </Badge>
  )
}
