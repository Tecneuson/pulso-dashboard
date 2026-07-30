import type { HTMLAttributes } from 'react'
import type { FunnelStage } from '@/types'
import { ESTAGIO_FUNIL_LABELS } from '@/types'
import { FUNIL_ETAPA_LABELS, FUNIL_ETAPA_VARIANT, type FunilEtapa } from '@/lib/funil-etapas'

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'brand'

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant
}

// Tints translúcidos: funcionam no dark (padrão) e no light. Texto mais escuro no light,
// mais claro no dark, para manter contraste AA sobre o tom.
const variantStyles: Record<BadgeVariant, string> = {
  default: 'bg-surface-tertiary text-content-secondary border border-border',
  success: 'bg-success-500/12 text-success-700 dark:text-success-500 border border-success-500/20',
  warning: 'bg-warning-500/12 text-warning-700 dark:text-warning-500 border border-warning-500/20',
  danger: 'bg-danger-500/12 text-danger-700 dark:text-danger-500 border border-danger-500/20',
  info: 'bg-info-500/12 text-info-700 dark:text-info-500 border border-info-500/20',
  brand: 'bg-brand-500/12 text-brand-700 dark:text-brand-400 border border-brand-500/20',
}

export function Badge({ variant = 'default', className = '', children, ...props }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-sm text-body-sm font-medium ${variantStyles[variant]} ${className}`}
      {...props}
    >
      {children}
    </span>
  )
}

// Maps funnel stages to badge variants
const stageVariants: Record<FunnelStage, BadgeVariant> = {
  em_atendimento: 'info',
  convenio_nao_legivel: 'warning',
  convenio_legivel: 'brand',
  em_avaliacao_hsm: 'info',
  vaga_cedida: 'brand',
  vaga_recusada_medico: 'danger',
  recusou_origem: 'danger',
  recusou_internacao: 'danger',
  sem_condicoes_financeiras: 'warning',
  internado: 'success',
}

interface StageBadgeProps extends HTMLAttributes<HTMLSpanElement> {
  stage: FunnelStage
  label?: string
}

export function StageBadge({ stage, label, className = '', ...props }: StageBadgeProps) {
  return (
    <Badge variant={stageVariants[stage]} className={className} {...props}>
      {label ?? ESTAGIO_FUNIL_LABELS[stage]}
    </Badge>
  )
}

// Badge das etapas do novo funil (camada visual). Ver `@/lib/funil-etapas`.
interface EtapaBadgeProps extends HTMLAttributes<HTMLSpanElement> {
  etapa: FunilEtapa
  label?: string
}

export function EtapaBadge({ etapa, label, className = '', ...props }: EtapaBadgeProps) {
  return (
    <Badge variant={FUNIL_ETAPA_VARIANT[etapa]} className={className} {...props}>
      {label ?? FUNIL_ETAPA_LABELS[etapa]}
    </Badge>
  )
}
