'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Loader2, Plus, X } from 'lucide-react'
import { Header } from '@/components/layout/header'
import { Button } from '@/components/ui'
import type { Agendamento } from '@/types'
import {
  formatDataBR,
  formatHora,
  hojeISO,
  ordenarPorDataHora,
  situacaoAgendamento,
  SITUACAO_BADGE,
  SITUACAO_LABELS,
} from '@/lib/agendamentos'

type Modo = 'dia' | 'semana' | 'mes'

const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const MESES = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
]

// ---------- Datas (sempre em YYYY-MM-DD local, sem passar por UTC) ----------

function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`
}

function doIso(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, (m ?? 1) - 1, d ?? 1)
}

function somaDias(s: string, n: number): string {
  const d = doIso(s)
  d.setDate(d.getDate() + n)
  return iso(d)
}

function inicioSemana(s: string): string {
  const d = doIso(s)
  d.setDate(d.getDate() - d.getDay())
  return iso(d)
}

function inicioMes(s: string): string {
  const d = doIso(s)
  return iso(new Date(d.getFullYear(), d.getMonth(), 1))
}

function fimMes(s: string): string {
  const d = doIso(s)
  return iso(new Date(d.getFullYear(), d.getMonth() + 1, 0))
}

/** Intervalo carregado da API conforme o modo de visualização. */
function intervalo(modo: Modo, ref: string): { de: string; ate: string } {
  if (modo === 'dia') return { de: ref, ate: ref }
  if (modo === 'semana') {
    const de = inicioSemana(ref)
    return { de, ate: somaDias(de, 6) }
  }
  // Mês: completa as semanas das bordas para a grade fechar certinho.
  const de = inicioSemana(inicioMes(ref))
  const ate = somaDias(inicioSemana(fimMes(ref)), 6)
  return { de, ate }
}

function tituloPeriodo(modo: Modo, ref: string): string {
  const d = doIso(ref)
  if (modo === 'dia') {
    return `${DIAS_SEMANA[d.getDay()]}, ${formatDataBR(ref)}`
  }
  if (modo === 'semana') {
    const de = inicioSemana(ref)
    return `${formatDataBR(de)} — ${formatDataBR(somaDias(de, 6))}`
  }
  return `${MESES[d.getMonth()]} de ${d.getFullYear()}`
}

// ---------- Componentes ----------

function ItemAgenda({
  ag,
  onResolver,
  onRemover,
  variante = 'lista',
}: {
  ag: Agendamento
  onResolver?: (id: string, status: 'contatado' | 'nao_contatado' | 'concluido') => void
  onRemover?: (id: string) => void
  /** lista = visão Dia (card completo) · semana = coluna estreita · mes = uma linha */
  variante?: 'lista' | 'semana' | 'mes'
}) {
  const evento = ag.tipo === 'evento'
  const resolvido = ag.status !== 'pendente'
  const hora = formatHora(ag.hora)
  const titulo = evento ? ag.titulo ?? 'Evento' : ag.alvo_nome ?? 'Contato'
  const cor = resolvido ? 'bg-content-tertiary' : evento ? 'bg-info-500' : 'bg-brand-500'

  if (variante === 'mes') {
    return (
      <div
        className={`flex items-center gap-1 text-[11px] leading-tight min-w-0 ${
          resolvido ? 'text-content-tertiary line-through' : 'text-content-secondary'
        }`}
        title={`${titulo}${ag.nota ? ` — ${ag.nota}` : ''}`}
      >
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${cor}`} />
        {hora && <span className="font-mono shrink-0">{hora}</span>}
        <span className="truncate">{titulo}</span>
      </div>
    )
  }

  // Semana: coluna estreita — tudo empilhado, nada de linha horizontal que estoura.
  if (variante === 'semana') {
    const btn =
      'flex-1 min-w-0 truncate text-[10px] px-1.5 py-1 rounded border border-border text-content-secondary hover:bg-surface-tertiary transition-colors'
    return (
      <div className="rounded-lg border border-border bg-surface-secondary p-2 min-w-0">
        <div className="flex items-center gap-1 min-w-0">
          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${cor}`} />
          {hora && (
            <span className="text-[10px] font-mono tabular-nums text-content-tertiary shrink-0">
              {hora}
            </span>
          )}
          <span className="text-[10px] text-content-tertiary truncate">
            {evento ? 'Evento' : 'Contato'}
          </span>
          {!evento && !resolvido && situacaoAgendamento(ag) === 'atrasado' && (
            <span className="ml-auto text-[10px] text-danger-500 shrink-0">Atrasado</span>
          )}
        </div>

        <p
          className={`text-[12px] font-medium mt-1 break-words ${
            resolvido ? 'text-content-tertiary line-through' : 'text-content-primary'
          }`}
        >
          {titulo}
        </p>
        {ag.nota && (
          <p className="text-[11px] text-content-secondary mt-0.5 break-words">{ag.nota}</p>
        )}

        {!resolvido && onResolver && (
          <div className="flex items-center gap-1 mt-1.5 min-w-0">
            <button
              type="button"
              onClick={() => onResolver(ag.id, evento ? 'concluido' : 'contatado')}
              className={btn}
            >
              {evento ? 'Concluir' : 'Contatado'}
            </button>
            {!evento && (
              <button
                type="button"
                onClick={() => onResolver(ag.id, 'nao_contatado')}
                className={btn}
              >
                Sem contato
              </button>
            )}
          </div>
        )}
        {resolvido && (
          <p className="text-[10px] text-content-tertiary mt-1">
            {ag.status === 'contatado'
              ? 'Contato feito'
              : ag.status === 'nao_contatado'
              ? 'Sem contato'
              : 'Concluído'}
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-border bg-surface-secondary p-3">
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-surface-tertiary text-content-secondary border border-border">
              {evento ? 'Evento' : 'Contato'}
            </span>
            {!evento && (
              <span
                className={`text-[11px] px-2 py-0.5 rounded-full ${
                  SITUACAO_BADGE[situacaoAgendamento(ag)]
                }`}
              >
                {resolvido
                  ? ag.status === 'contatado'
                    ? 'Contato feito'
                    : 'Sem contato'
                  : SITUACAO_LABELS[situacaoAgendamento(ag)]}
              </span>
            )}
            {hora && (
              <span className="text-[11px] font-mono text-content-tertiary tabular-nums">
                {hora}
              </span>
            )}
          </div>
          <p
            className={`text-sm font-medium mt-1 truncate ${
              resolvido ? 'text-content-tertiary line-through' : 'text-content-primary'
            }`}
          >
            {titulo}
          </p>
          {ag.nota && <p className="text-[13px] text-content-secondary mt-0.5">{ag.nota}</p>}
          {ag.resultado_nota && (
            <p className="text-[13px] text-content-tertiary mt-0.5">↳ {ag.resultado_nota}</p>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {!resolvido && onResolver && (
            <>
              <button
                type="button"
                onClick={() => onResolver(ag.id, evento ? 'concluido' : 'contatado')}
                className="text-xs px-2 py-1 rounded-md border border-border text-content-secondary hover:bg-surface-tertiary transition-colors"
              >
                {evento ? 'Concluir' : 'Contatado'}
              </button>
              {!evento && (
                <button
                  type="button"
                  onClick={() => onResolver(ag.id, 'nao_contatado')}
                  className="text-xs px-2 py-1 rounded-md border border-border text-content-secondary hover:bg-surface-tertiary transition-colors"
                >
                  Sem contato
                </button>
              )}
            </>
          )}
          {onRemover && (
            <button
              type="button"
              onClick={() => onRemover(ag.id)}
              className="p-1 rounded-md text-content-tertiary hover:text-danger-500 hover:bg-surface-tertiary transition-colors"
              aria-label="Remover"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export function AgendaView() {
  const [modo, setModo] = useState<Modo>('semana')
  const [ref, setRef] = useState<string>(hojeISO())
  const [rows, setRows] = useState<Agendamento[]>([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [busca, setBusca] = useState('')

  const [novoAberto, setNovoAberto] = useState(false)
  const [novoTitulo, setNovoTitulo] = useState('')
  const [novaData, setNovaData] = useState(hojeISO())
  const [novaHora, setNovaHora] = useState('')
  const [novaNota, setNovaNota] = useState('')
  const [salvando, setSalvando] = useState(false)

  const { de, ate } = useMemo(() => intervalo(modo, ref), [modo, ref])

  const carregar = useCallback(async () => {
    setLoading(true)
    setErro(null)
    try {
      const res = await fetch(`/api/agendamentos?de=${de}&ate=${ate}&status=todos&limit=1000`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'erro')
      setRows(Array.isArray(data.rows) ? data.rows : [])
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao carregar a agenda')
    } finally {
      setLoading(false)
    }
  }, [de, ate])

  useEffect(() => {
    carregar()
  }, [carregar])

  const porDia = useMemo(() => {
    const q = busca.trim().toLowerCase()
    const map = new Map<string, Agendamento[]>()
    for (const a of rows) {
      if (q) {
        const alvo = `${a.titulo ?? ''} ${a.alvo_nome ?? ''} ${a.nota ?? ''}`.toLowerCase()
        if (!alvo.includes(q)) continue
      }
      const lista = map.get(a.data)
      if (lista) lista.push(a)
      else map.set(a.data, [a])
    }
    map.forEach((lista) => lista.sort(ordenarPorDataHora))
    return map
  }, [rows, busca])

  const dias = useMemo(() => {
    const out: string[] = []
    for (let d = de; d <= ate; d = somaDias(d, 1)) out.push(d)
    return out
  }, [de, ate])

  function navegar(delta: number) {
    if (modo === 'dia') return setRef((r) => somaDias(r, delta))
    if (modo === 'semana') return setRef((r) => somaDias(r, delta * 7))
    const d = doIso(ref)
    setRef(iso(new Date(d.getFullYear(), d.getMonth() + delta, 1)))
  }

  async function resolver(id: string, status: 'contatado' | 'nao_contatado' | 'concluido') {
    const res = await fetch('/api/agendamentos', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status }),
    })
    if (res.ok) carregar()
  }

  async function remover(id: string) {
    const res = await fetch(`/api/agendamentos?id=${id}`, { method: 'DELETE' })
    if (res.ok) setRows((prev) => prev.filter((a) => a.id !== id))
  }

  async function criarEvento() {
    if (!novoTitulo.trim() || !novaData) return
    setSalvando(true)
    try {
      const res = await fetch('/api/agendamentos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo: 'evento',
          titulo: novoTitulo.trim(),
          data: novaData,
          hora: novaHora || null,
          nota: novaNota.trim() || null,
        }),
      })
      if (res.ok) {
        setNovoTitulo('')
        setNovaHora('')
        setNovaNota('')
        setNovoAberto(false)
        carregar()
      }
    } finally {
      setSalvando(false)
    }
  }

  const hoje = hojeISO()
  const inputCls =
    'h-10 rounded-lg bg-surface-secondary border border-border text-sm px-3 text-content-primary placeholder:text-content-tertiary focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500'

  return (
    <>
      <Header
        title="Agenda"
        search={{
          value: busca,
          onChange: setBusca,
          placeholder: 'Pesquisar na agenda',
        }}
        action={
          <Button size="sm" onClick={() => setNovoAberto((v) => !v)}>
            <Plus size={14} />
            Novo Evento
          </Button>
        }
      />

      {novoAberto && (
        <div className="mb-4 rounded-lg border border-border bg-surface-secondary p-3 flex flex-wrap items-end gap-2 animate-fade-up">
          <div className="flex-1 min-w-[220px]">
            <p className="text-xs text-content-secondary mb-1">Título *</p>
            <input
              autoFocus
              value={novoTitulo}
              onChange={(e) => setNovoTitulo(e.target.value)}
              placeholder="Ex.: reunião com o hospital parceiro"
              className={`${inputCls} w-full`}
            />
          </div>
          <div>
            <p className="text-xs text-content-secondary mb-1">Data *</p>
            <input
              type="date"
              value={novaData}
              onChange={(e) => setNovaData(e.target.value)}
              className={inputCls}
            />
          </div>
          <div>
            <p className="text-xs text-content-secondary mb-1">Hora</p>
            <input
              type="time"
              value={novaHora}
              onChange={(e) => setNovaHora(e.target.value)}
              className={inputCls}
            />
          </div>
          <div className="flex-1 min-w-[200px]">
            <p className="text-xs text-content-secondary mb-1">Nota</p>
            <input
              value={novaNota}
              onChange={(e) => setNovaNota(e.target.value)}
              placeholder="Detalhes do evento"
              className={`${inputCls} w-full`}
            />
          </div>
          <Button variant="ghost" size="sm" onClick={() => setNovoAberto(false)}>
            Cancelar
          </Button>
          <Button size="sm" onClick={criarEvento} loading={salvando}>
            Salvar
          </Button>
        </div>
      )}

      {/* Controles de período */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="inline-flex items-center gap-1">
          <button
            type="button"
            onClick={() => navegar(-1)}
            className="focus-ring p-2 rounded-lg border border-border text-content-secondary hover:bg-surface-secondary transition-colors"
            aria-label="Período anterior"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            type="button"
            onClick={() => setRef(hojeISO())}
            className="focus-ring px-3 h-9 rounded-lg border border-border text-sm text-content-secondary hover:bg-surface-secondary transition-colors"
          >
            Hoje
          </button>
          <button
            type="button"
            onClick={() => navegar(1)}
            className="focus-ring p-2 rounded-lg border border-border text-content-secondary hover:bg-surface-secondary transition-colors"
            aria-label="Próximo período"
          >
            <ChevronRight size={16} />
          </button>
        </div>

        <h2 className="font-display text-lg font-medium text-content-primary capitalize">
          {tituloPeriodo(modo, ref)}
        </h2>

        {loading && <Loader2 size={14} className="animate-spin text-content-tertiary" />}

        <div className="ml-auto inline-flex items-center gap-0.5 p-0.5 rounded-full bg-surface-secondary border border-border">
          {(['dia', 'semana', 'mes'] as const).map((m) => (
            <button
              key={m}
              onClick={() => setModo(m)}
              aria-pressed={modo === m}
              className={`focus-ring px-4 h-8 rounded-full text-body-sm font-medium capitalize transition-colors ${
                modo === m
                  ? 'bg-brand-500 text-white'
                  : 'text-content-secondary hover:text-content-primary'
              }`}
            >
              {m === 'mes' ? 'Mês' : m}
            </button>
          ))}
        </div>
      </div>

      {erro && (
        <div className="mb-4 bg-danger-500/10 border border-danger-500/30 rounded-lg p-3 text-sm text-danger-500">
          {erro}
        </div>
      )}

      {/* Dia — lista */}
      {modo === 'dia' && (
        <div className="space-y-2 max-w-3xl">
          {(porDia.get(ref) ?? []).map((a) => (
            <ItemAgenda key={a.id} ag={a} onResolver={resolver} onRemover={remover} />
          ))}
          {(porDia.get(ref) ?? []).length === 0 && !loading && (
            <p className="text-sm text-content-tertiary py-8 text-center">
              Nada agendado para este dia.
            </p>
          )}
        </div>
      )}

      {/* Semana — 7 colunas */}
      {modo === 'semana' && (
        <div className="grid grid-cols-1 sm:grid-cols-7 gap-2">
          {dias.map((d) => {
            const itens = porDia.get(d) ?? []
            return (
              <div
                key={d}
                className={`rounded-xl border p-2 min-h-[180px] min-w-0 overflow-hidden ${
                  d === hoje ? 'border-brand-500/50 bg-brand-500/5' : 'border-border'
                }`}
              >
                <div className="flex items-baseline justify-between mb-2">
                  <span className="text-overline uppercase text-content-tertiary">
                    {DIAS_SEMANA[doIso(d).getDay()]}
                  </span>
                  <span
                    className={`text-sm font-medium tabular-nums ${
                      d === hoje ? 'text-brand-500' : 'text-content-secondary'
                    }`}
                  >
                    {doIso(d).getDate()}
                  </span>
                </div>
                <div className="space-y-1.5">
                  {itens.map((a) => (
                    <ItemAgenda key={a.id} ag={a} onResolver={resolver} variante="semana" />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Mês — grade */}
      {modo === 'mes' && (
        <div>
          <div className="grid grid-cols-7 gap-2 mb-1">
            {DIAS_SEMANA.map((d) => (
              <span key={d} className="text-overline uppercase text-content-tertiary px-1">
                {d}
              </span>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-2">
            {dias.map((d) => {
              const itens = porDia.get(d) ?? []
              const doMes = doIso(d).getMonth() === doIso(ref).getMonth()
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => {
                    setRef(d)
                    setModo('dia')
                  }}
                  className={`text-left rounded-lg border p-2 min-h-[104px] min-w-0 overflow-hidden transition-colors hover:border-border-hover ${
                    d === hoje ? 'border-brand-500/50 bg-brand-500/5' : 'border-border'
                  } ${doMes ? '' : 'opacity-40'}`}
                >
                  <span
                    className={`text-sm font-medium tabular-nums ${
                      d === hoje ? 'text-brand-500' : 'text-content-secondary'
                    }`}
                  >
                    {doIso(d).getDate()}
                  </span>
                  <div className="mt-1 space-y-1">
                    {itens.slice(0, 3).map((a) => (
                      <ItemAgenda key={a.id} ag={a} variante="mes" />
                    ))}
                    {itens.length > 3 && (
                      <span className="text-[11px] text-content-tertiary">
                        +{itens.length - 3}
                      </span>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </>
  )
}
