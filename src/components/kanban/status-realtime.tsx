'use client'

import { useEffect, useState } from 'react'
import type { StatusRealtime } from '@/lib/realtime'

/**
 * Selinho discreto de "tempo real" ao lado da contagem de leads. Serve para o
 * atendente saber se o que está na tela é o estado atual — quando a conexão cai,
 * ele precisa ver isso, senão confia num board velho.
 */

const CORES: Record<StatusRealtime, string> = {
  ligado: 'bg-success-500',
  conectando: 'bg-warning-500 animate-pulse',
  reconectando: 'bg-warning-500 animate-pulse',
  desligado: 'bg-content-tertiary',
}

const RÓTULOS: Record<StatusRealtime, string> = {
  ligado: 'tempo real',
  conectando: 'conectando…',
  reconectando: 'reconectando…',
  desligado: 'sem tempo real',
}

function desde(data: Date | null, agora: number): string | null {
  if (!data) return null
  const seg = Math.max(0, Math.round((agora - data.getTime()) / 1000))
  if (seg < 5) return 'agora'
  if (seg < 60) return `há ${seg}s`
  const min = Math.round(seg / 60)
  return min < 60 ? `há ${min}min` : `há ${Math.round(min / 60)}h`
}

export function StatusRealtimeBadge({
  status,
  ultimaAtualizacao,
}: {
  status: StatusRealtime
  ultimaAtualizacao: Date | null
}) {
  const [agora, setAgora] = useState(() => Date.now())

  // Só conta o tempo quando há algo para contar (evita render a cada 15s à toa).
  useEffect(() => {
    if (!ultimaAtualizacao) return
    const t = setInterval(() => setAgora(Date.now()), 15_000)
    return () => clearInterval(t)
  }, [ultimaAtualizacao])

  const quando = desde(ultimaAtualizacao, agora)

  return (
    <span
      className="inline-flex items-center gap-1.5 text-caption text-content-tertiary"
      title={
        status === 'ligado'
          ? 'O funil se atualiza sozinho: mudanças feitas no Chatwoot, pelo bot ou por outro atendente aparecem aqui na hora.'
          : 'Sem conexão em tempo real — recarregue a página para ver as mudanças mais recentes.'
      }
    >
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${CORES[status]}`} />
      {RÓTULOS[status]}
      {status === 'ligado' && quando && <span className="text-content-tertiary/70">· {quando}</span>}
    </span>
  )
}
