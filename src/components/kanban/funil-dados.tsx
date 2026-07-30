'use client'

import { createContext, useContext, useMemo, type ReactNode } from 'react'
import type { Agendamento } from '@/types'
import type { LeadComEtapa } from '@/lib/funil-etapas'
import { useAgendamentosPendentes, useUsuarios } from '@/lib/api-store'

/**
 * Dados derivados que o card do funil precisa e que não vivem no lead:
 * contatos associados (outros leads do mesmo paciente), nome do agente de
 * atendimento e o próximo contato agendado. Fica num contexto para o card não
 * precisar de prop drilling por board → coluna → card.
 */

interface FunilDados {
  leadsDoPaciente: (pacienteId: string | null | undefined) => LeadComEtapa[]
  nomeAgente: (atendenteId: string | null | undefined) => string | null
  proximoDoLead: (leadId: string) => Agendamento | null
  proximoDoPaciente: (pacienteId: string) => Agendamento | null
  recarregarAgendamentos: () => void
}

const VAZIO: FunilDados = {
  leadsDoPaciente: () => [],
  nomeAgente: () => null,
  proximoDoLead: () => null,
  proximoDoPaciente: () => null,
  recarregarAgendamentos: () => {},
}

const FunilDadosContext = createContext<FunilDados>(VAZIO)

export function FunilDadosProvider({
  leads,
  children,
}: {
  leads: LeadComEtapa[]
  children: ReactNode
}) {
  const { porId } = useUsuarios()
  const agendamentos = useAgendamentosPendentes()

  const porPaciente = useMemo(() => {
    const map = new Map<string, LeadComEtapa[]>()
    for (const l of leads) {
      if (!l.paciente_id) continue
      const atual = map.get(l.paciente_id)
      if (atual) atual.push(l)
      else map.set(l.paciente_id, [l])
    }
    return map
  }, [leads])

  const valor = useMemo<FunilDados>(
    () => ({
      leadsDoPaciente: (pacienteId) => (pacienteId ? porPaciente.get(pacienteId) ?? [] : []),
      nomeAgente: (atendenteId) => (atendenteId ? porId.get(atendenteId) ?? null : null),
      proximoDoLead: agendamentos.doLead,
      proximoDoPaciente: agendamentos.doPaciente,
      recarregarAgendamentos: agendamentos.refresh,
    }),
    [porPaciente, porId, agendamentos]
  )

  return <FunilDadosContext.Provider value={valor}>{children}</FunilDadosContext.Provider>
}

export function useFunilDados(): FunilDados {
  return useContext(FunilDadosContext)
}
