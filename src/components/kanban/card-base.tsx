'use client'

import { forwardRef, type CSSProperties, type HTMLAttributes, type ReactNode } from 'react'
import {
  SITUACAO_BADGE,
  SITUACAO_LABELS,
  formatDataBR,
  type SituacaoAgendamento,
} from '@/lib/agendamentos'

/**
 * Layout único do card do funil (leads e pacientes). Estrutura fixa, sem ícones:
 *
 *   [badges]
 *   Nome
 *   CPF                      Convênio
 *   ─────────────────────────────────
 *   Contatos Associados / Agente de Atendimento
 *   ─────────────────────────────────
 *   ● internações  ● perdas  ● conversas
 *   ─────────────────────────────────
 *   Próximo Contato → nota + data + situação
 */

export interface CardBadge {
  label: string
  /** Classe de tinta do badge (default = neutro). */
  className?: string
}

export interface CardContadores {
  internacoes: number
  perdas: number
  conversas: number
}

export interface CardProximoContato {
  data: string | null
  nota: string | null
  situacao: SituacaoAgendamento
}

interface CardBaseProps extends HTMLAttributes<HTMLDivElement> {
  badges: CardBadge[]
  nome: string
  documento?: string | null
  convenio?: string | null
  contatos: string[]
  agente?: string | null
  contadores: CardContadores
  proximo?: CardProximoContato
  /** Cor da barra lateral (etapa do funil / classificação). */
  accent?: string
  /** Conteúdo extra antes do rodapé (ex.: motivo da perda). */
  extra?: ReactNode
  style?: CSSProperties
}

const BADGE_NEUTRO = 'bg-surface-tertiary text-content-secondary border border-border'

function Secao({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div>
      <p className="text-[11px] font-semibold text-content-primary leading-tight">{titulo}</p>
      <p className="text-[12px] text-content-secondary truncate leading-tight mt-0.5">{children}</p>
    </div>
  )
}

function Contador({ cor, valor, label }: { cor: string; valor: number; label: string }) {
  return (
    <span className="inline-flex items-center gap-1 min-w-0">
      <span className={`w-2 h-2 rounded-full shrink-0 ${cor}`} />
      <span className="tabular-nums text-content-primary font-medium">{valor}</span>
      <span className="text-content-secondary truncate">{label}</span>
    </span>
  )
}

export const CardBase = forwardRef<HTMLDivElement, CardBaseProps>(function CardBase(
  {
    badges,
    nome,
    documento,
    convenio,
    contatos,
    agente,
    contadores,
    proximo,
    accent,
    extra,
    className = '',
    style,
    ...rest
  },
  ref
) {
  const listaContatos = contatos.filter(Boolean)

  return (
    <div
      ref={ref}
      style={{ ...(accent ? { borderLeftColor: accent } : {}), ...style }}
      className={`bg-surface-secondary border border-border ${
        accent ? 'border-l-[3px]' : ''
      } rounded-lg p-3 shadow-card transition-[transform,box-shadow,border-color] duration-150 hover:border-border-hover hover:shadow-card-hover hover:-translate-y-px ${className}`}
      {...rest}
    >
      {badges.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
          {badges.map((b, i) => (
            <span
              key={`${b.label}-${i}`}
              className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium leading-tight ${
                b.className ?? BADGE_NEUTRO
              }`}
            >
              {b.label}
            </span>
          ))}
        </div>
      )}

      <p className="text-[15px] font-semibold text-content-primary truncate leading-snug">{nome}</p>

      <div className="flex items-baseline justify-between gap-2 mt-0.5">
        <span className="text-[12px] text-content-secondary font-mono tabular-nums truncate">
          {documento || '—'}
        </span>
        <span className="text-[12px] text-content-secondary truncate shrink-0 max-w-[55%] text-right">
          {convenio || 'Sem convênio'}
        </span>
      </div>

      <div className="mt-2 pt-2 border-t border-border space-y-1.5">
        <Secao titulo="Contatos Associados">
          {listaContatos.length ? listaContatos.join(', ') : '—'}
        </Secao>
        <Secao titulo="Agente de Atendimento">{agente || 'Não atribuído'}</Secao>
      </div>

      <div className="mt-2 pt-2 border-t border-border flex items-center justify-between gap-1.5 text-[11px]">
        <Contador cor="bg-success-500" valor={contadores.internacoes} label="internações" />
        <Contador cor="bg-danger-500" valor={contadores.perdas} label="perdas" />
        <Contador cor="bg-info-500" valor={contadores.conversas} label="conversas" />
      </div>

      {extra}

      {proximo && (
        <div className="mt-2 pt-2 border-t border-border">
          <p className="text-[11px] font-semibold text-content-primary leading-tight">
            Próximo Contato
          </p>
          <p className="text-[12px] text-content-secondary truncate leading-tight mt-0.5">
            {proximo.nota || 'Indefinido'}
          </p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[12px] font-mono tabular-nums text-content-secondary">
              {formatDataBR(proximo.data)}
            </span>
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${
                SITUACAO_BADGE[proximo.situacao]
              }`}
            >
              {SITUACAO_LABELS[proximo.situacao]}
            </span>
          </div>
        </div>
      )}
    </div>
  )
})
