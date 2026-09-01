'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import type { Triagem, TriagemLead } from '@/types'

/**
 * Tempo real no funil (Supabase Realtime → `postgres_changes` em `triagem_hsm`).
 *
 * Qualquer escrita na tabela chega aqui, não importa quem escreveu: outro atendente
 * no CRM, o webhook do Chatwoot, o bot da Mônica no n8n ou um UPDATE manual no SQL.
 * É o que faz o card se mover sozinho quando o atendente marca a venda no Chatwoot.
 *
 * Detalhes que importam:
 *  - o payload traz só a linha de `triagem_hsm`; o paciente conciliado (`paciente`)
 *    é preservado do estado local, senão o card perderia nome/convênio a cada evento;
 *  - a RLS vale para o Realtime: só chega o que o usuário logado poderia ler;
 *  - a tabela precisa estar na publicação `supabase_realtime` (migração 20260901).
 */

export type StatusRealtime = 'conectando' | 'ligado' | 'reconectando' | 'desligado'

interface Opcoes {
  /** Sem isso o hook não assina nada (ex.: enquanto a lista inicial não chegou). */
  ativo?: boolean
  /** Chamado quando a linha é criada/alterada/removida — para telas com estado próprio. */
  onEvento?: (tipo: 'INSERT' | 'UPDATE' | 'DELETE', id: string) => void
}

export function useTriagensRealtime(
  setItems: React.Dispatch<React.SetStateAction<TriagemLead[]>>,
  { ativo = true, onEvento }: Opcoes = {}
): { status: StatusRealtime; ultimaAtualizacao: Date | null } {
  const supabase = useMemo(() => createClient(), [])
  const [status, setStatus] = useState<StatusRealtime>('conectando')
  const [ultimaAtualizacao, setUltimaAtualizacao] = useState<Date | null>(null)

  // Guarda o setter numa ref: o efeito não deve reassinar o canal a cada render.
  const setItemsRef = useRef(setItems)
  setItemsRef.current = setItems
  const onEventoRef = useRef(onEvento)
  onEventoRef.current = onEvento

  useEffect(() => {
    if (!ativo) {
      setStatus('desligado')
      return
    }

    function aplicar(payload: RealtimePostgresChangesPayload<Triagem>) {
      const novo = payload.new as Triagem | undefined
      const antigo = payload.old as Partial<Triagem> | undefined
      const id = (novo?.id ?? antigo?.id) as string | undefined
      if (!id) return

      setUltimaAtualizacao(new Date())
      onEventoRef.current?.(payload.eventType as 'INSERT' | 'UPDATE' | 'DELETE', id)

      setItemsRef.current((prev) => {
        if (payload.eventType === 'DELETE') return prev.filter((t) => t.id !== id)
        if (!novo) return prev

        const existente = prev.find((t) => t.id === id)
        if (!existente) {
          // Lead novo (1º contato pelo WhatsApp, lead criado por outro atendente…).
          return [{ ...novo }, ...prev]
        }
        // Preserva o paciente conciliado: ele vem de outra tabela e não está no payload.
        const paciente = existente.paciente_id === novo.paciente_id ? existente.paciente : null
        return prev.map((t) => (t.id === id ? { ...novo, paciente } : t))
      })
    }

    const canal = supabase
      .channel('pulso:triagem_hsm')
      .on<Triagem>('postgres_changes', { event: '*', schema: 'public', table: 'triagem_hsm' }, aplicar)
      .subscribe((estado) => {
        if (estado === 'SUBSCRIBED') setStatus('ligado')
        else if (estado === 'CHANNEL_ERROR' || estado === 'TIMED_OUT') setStatus('reconectando')
        else if (estado === 'CLOSED') setStatus('desligado')
      })

    return () => {
      void supabase.removeChannel(canal)
    }
  }, [supabase, ativo])

  return { status, ultimaAtualizacao }
}
