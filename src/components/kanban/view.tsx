'use client'

import { useEffect, useMemo, useState } from 'react'
import { Plus } from 'lucide-react'
import { Header } from '@/components/layout/header'
import { KanbanBoard } from './board'
import { CardDetail } from './card-detail'
import { LeadForm } from './lead-form'
import { Filtros } from './filtros'
import { FunilDadosProvider } from './funil-dados'
import { Button } from '@/components/ui'
import type { TriagemLead } from '@/types'
import { useAgendamentosPendentes } from '@/lib/api-store'
import { comEtapa, ETAPA_TO_ESTAGIO, type FunilEtapa } from '@/lib/funil-etapas'
import {
  FILTROS_INICIAL,
  filtrarLeads,
  ordenarLeads,
  type FiltroContexto,
  type FiltrosState,
} from '@/lib/filtros'

interface KanbanViewProps {
  triagens: TriagemLead[]
}

export function KanbanView({ triagens }: KanbanViewProps) {
  const [items, setItems] = useState<TriagemLead[]>(triagens)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [autoInternar, setAutoInternar] = useState(false)
  const [autoPerda, setAutoPerda] = useState(false)
  const [showLeadForm, setShowLeadForm] = useState(false)
  const [filtros, setFiltros] = useState<FiltrosState>(FILTROS_INICIAL)
  const [qDebounced, setQDebounced] = useState('')

  const agendamentos = useAgendamentosPendentes()

  // Re-sincroniza quando o servidor traz novos dados (revalidate).
  useEffect(() => {
    setItems(triagens)
  }, [triagens])

  // Debounce só para a busca das colunas de pacientes (servidor).
  useEffect(() => {
    const t = setTimeout(() => setQDebounced(filtros.q), 300)
    return () => clearTimeout(t)
  }, [filtros.q])

  const allLeads = useMemo(() => items.map(comEtapa), [items])

  const ctx = useMemo<FiltroContexto>(
    () => ({ situacao: agendamentos.situacaoLead, proximaData: agendamentos.dataLead }),
    [agendamentos]
  )

  const leadsFiltrados = useMemo(
    () => ordenarLeads(filtrarLeads(allLeads, filtros, ctx), filtros.ordenar, ctx),
    [allLeads, filtros, ctx]
  )
  const selected = selectedId ? allLeads.find((l) => l.id === selectedId) ?? null : null

  // Perdido só entra no board quando o usuário busca um lead ou filtra por perda.
  const mostrarPerdidos =
    filtros.q.trim().length > 0 ||
    filtros.etapas.includes('perdido') ||
    filtros.motivosPerda.length > 0

  // Arrastar card = grava a etapa no banco (estagio_funil canônico) + Chatwoot via PATCH.
  async function handleStageChange(id: string, etapa: FunilEtapa) {
    const novoEstagio = ETAPA_TO_ESTAGIO[etapa]
    const estagioAnterior = items.find((t) => t.id === id)?.estagio_funil ?? null
    setItems((prev) => prev.map((t) => (t.id === id ? { ...t, estagio_funil: novoEstagio } : t)))
    try {
      const res = await fetch('/api/triagem', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, estagio_funil: novoEstagio }),
      })
      if (!res.ok) throw new Error(await res.text())
    } catch (e) {
      console.error('Falha ao salvar etapa:', e)
      // Reverte SÓ este card (updater funcional) — não descarta mudanças concorrentes.
      setItems((prev) =>
        prev.map((t) => (t.id === id ? { ...t, estagio_funil: estagioAnterior } : t))
      )
    }
  }

  function handleSaved(updated: TriagemLead) {
    setItems((prev) => prev.map((t) => (t.id === updated.id ? updated : t)))
  }

  function handleCreated(novo: TriagemLead) {
    setItems((prev) => [novo, ...prev])
    setSelectedId(novo.id)
    setAutoInternar(false)
    setAutoPerda(false)
  }

  return (
    <FunilDadosProvider leads={allLeads}>
      {/* A tela inteira não rola: header/filtros fixos e o board ocupa o resto. */}
      <div className="flex flex-col h-full min-h-0">
        <div className="shrink-0">
          <Header
            title="Funil"
            search={{
              value: filtros.q,
              onChange: (q) => setFiltros((f) => ({ ...f, q })),
              placeholder: 'Pesquisar por nome, telefone, e-mail ou nº do paciente',
            }}
            action={
              <Button size="sm" onClick={() => setShowLeadForm(true)}>
                <Plus size={14} />
                Adicionar Contato
              </Button>
            }
          />

          <Filtros
            leads={allLeads}
            filtrados={leadsFiltrados.length}
            filtros={filtros}
            onChange={setFiltros}
          />
        </div>

        <div className="flex-1 min-h-0">
          <KanbanBoard
            triagens={leadsFiltrados}
            onStageChange={handleStageChange}
            onInternarRequest={(id) => {
              setSelectedId(id)
              setAutoInternar(true)
              setAutoPerda(false)
            }}
            onPerdaRequest={(id) => {
              setSelectedId(id)
              setAutoPerda(true)
              setAutoInternar(false)
            }}
            onCardClick={(t) => {
              setSelectedId(t.id)
              setAutoInternar(false)
              setAutoPerda(false)
            }}
            pacienteQuery={{ q: qDebounced, convenios: filtros.convenios }}
            classificacoesFiltro={filtros.classificacoes}
            etapasVisiveis={filtros.etapas}
            mostrarPerdidos={mostrarPerdidos}
          />
        </div>
      </div>

      <CardDetail
        triagem={selected}
        open={!!selected}
        autoInternar={autoInternar}
        autoPerda={autoPerda}
        onClose={() => {
          setSelectedId(null)
          setAutoInternar(false)
          setAutoPerda(false)
        }}
        onSaved={handleSaved}
      />

      <LeadForm
        open={showLeadForm}
        onClose={() => setShowLeadForm(false)}
        onCreated={handleCreated}
      />
    </FunilDadosProvider>
  )
}
