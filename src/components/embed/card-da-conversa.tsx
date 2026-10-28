'use client'

import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Loader2, Plus } from 'lucide-react'
import { useTriagensRealtime } from '@/lib/realtime'
import { comEtapa, etapaFromEstagio } from '@/lib/funil-etapas'
import { lerContexto, ORIGENS_CHATWOOT, PEDIDO_CONTEXTO, type ContextoChatwoot } from '@/lib/chatwoot/embed'
import type { TriagemLead } from '@/types'
import { CardDetail } from '@/components/kanban/card-detail'
import { FunilDadosProvider } from '@/components/kanban/funil-dados'
import { Badge, Button, EtapaBadge } from '@/components/ui'
import { NovoPacienteForm } from './novo-paciente'

/** Pede o contexto de novo de tempos em tempos: se o atendente troca de conversa com a
 *  aba aberta, o card acompanha (e nunca fica editando o lead da conversa anterior). */
const REPEDIR_MS = 10_000

function pedirContexto() {
  for (const origem of ORIGENS_CHATWOOT) window.parent?.postMessage(PEDIDO_CONTEXTO, origem)
}

// O tempo real aqui só serve de gatilho para reler (a lista vem da API).
const ignorar: React.Dispatch<React.SetStateAction<TriagemLead[]>> = () => {}

interface Pessoa {
  papel: 'responsavel' | 'consultor'
  id: string
  nome: string
}

/**
 * Card do lead dentro do Chatwoot (Dashboard App "Pulso"). Em cima, uma aba por
 * paciente da pessoa que está falando (consultor, pai com dois filhos…): dá para abrir
 * outro paciente, levar a conversa para ele ou cadastrar um paciente novo.
 */
export function CardDaConversa() {
  const [ctx, setCtx] = useState<ContextoChatwoot | null>(null)
  const [semContexto, setSemContexto] = useState(false)
  const [pessoa, setPessoa] = useState<Pessoa | null>(null)
  const [cards, setCards] = useState<TriagemLead[]>([])
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [abertoId, setAbertoId] = useState<string | null>(null)
  const [criando, setCriando] = useState(false)
  const [movendo, setMovendo] = useState(false)
  const [erroAcao, setErroAcao] = useState<string | null>(null)
  // Relê a lista a cada contexto recebido (~10s) e a cada evento do tempo real: no fim
  // da triagem a conversa pode TROCAR de card (card único).
  const [releitura, setReleitura] = useState(0)
  const reler = () => setReleitura((n) => n + 1)

  useTriagensRealtime(ignorar, { onEvento: reler })

  useEffect(() => {
    function onMessage(ev: MessageEvent) {
      const c = lerContexto(ev)
      if (c) {
        setCtx(c)
        reler()
      }
    }
    window.addEventListener('message', onMessage)
    window.addEventListener('focus', pedirContexto)
    pedirContexto()
    const repetir = setInterval(pedirContexto, REPEDIR_MS)
    const aviso = setTimeout(() => setSemContexto(true), 4000)
    return () => {
      window.removeEventListener('message', onMessage)
      window.removeEventListener('focus', pedirContexto)
      clearInterval(repetir)
      clearTimeout(aviso)
    }
  }, [])

  const convId = ctx?.conversation?.id ? String(ctx.conversation.id) : null
  const telefone = ctx?.contact?.phone_number ?? null

  // Outra conversa: volta para o paciente dela. Spinner só aqui; a releitura é silenciosa.
  useEffect(() => {
    if (!convId) return
    setCarregando(true)
    setAbertoId(null)
    setCriando(false)
    setErroAcao(null)
  }, [convId])

  useEffect(() => {
    if (!convId) return
    let vivo = true
    const qs = new URLSearchParams({ conversation_id: convId })
    if (telefone) qs.set('telefone', telefone)
    fetch(`/api/card/pacientes?${qs}`)
      .then(async (r) => {
        const d = await r.json().catch(() => ({}))
        if (!r.ok) throw new Error(d.error ?? `erro ${r.status}`)
        return d as { pessoa: Pessoa | null; cards: TriagemLead[] }
      })
      .then((d) => {
        if (!vivo) return
        setPessoa(d.pessoa)
        setCards(d.cards ?? [])
        setErro(null)
      })
      .catch((e: Error) => vivo && setErro(e.message))
      .finally(() => vivo && setCarregando(false))
    return () => {
      vivo = false
    }
  }, [convId, telefone, releitura])

  const daConversa = useMemo(
    () => cards.find((c) => convId && String(c.conversation_id) === convId) ?? null,
    [cards, convId]
  )
  const aberto = (abertoId ? cards.find((c) => c.id === abertoId) : null) ?? daConversa
  const leadAberto = useMemo(() => (aberto ? comEtapa(aberto) : null), [aberto])
  const leads = useMemo(() => cards.map(comEtapa), [cards])
  const nomeContato = daConversa?.nome_contato ?? pessoa?.nome ?? ctx?.contact?.name ?? null

  async function moverPara(destino: TriagemLead) {
    if (!convId) return
    const nome = destino.contact_name ?? 'este paciente'
    const antes = daConversa?.contact_name
    if (!window.confirm(`Mover a conversa #${convId} para ${nome}?${antes ? ` O card de ${antes} fica sem esta conversa.` : ''}`)) return
    setMovendo(true)
    setErroAcao(null)
    const res = await fetch('/api/card/mover-conversa', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversation_id: convId, para_id: destino.id }),
    }).catch(() => null)
    const d = await res?.json().catch(() => null)
    setMovendo(false)
    if (!res?.ok) {
      setErroAcao(d?.error ?? 'Não foi possível mover a conversa.')
      return
    }
    setAbertoId(destino.id)
    reler()
  }

  if (!ctx) {
    return (
      <Aviso>
        {semContexto ? 'Abra este painel pela aba de uma conversa no Chatwoot.' : 'Carregando a conversa…'}
      </Aviso>
    )
  }

  const conv = ctx.conversation
  const botPausado = conv?.custom_attributes?.bot_pausado === true
  const semAtendente = !conv?.meta?.assignee
  const vendoOutro = !criando && !!aberto && aberto.id !== daConversa?.id

  return (
    <div className="space-y-4">
      <p className="text-caption text-content-tertiary">
        Conversa #{convId}
        {ctx.contact?.name ? ` · ${ctx.contact.name}` : ''}
      </p>

      {botPausado && semAtendente && (
        <div className="flex items-start gap-2 rounded-lg border border-warning-500/40 bg-warning-500/10 p-3 text-sm text-warning-700 dark:text-warning-500">
          <AlertTriangle size={16} className="shrink-0 mt-0.5" />
          <span>
            A Mônica já transferiu esta conversa, mas <strong>ninguém está atribuído</strong>. Atribua a um
            atendente para o paciente não ficar sem resposta.
          </span>
        </div>
      )}

      {/* Pacientes de quem está falando */}
      <section aria-label="Pacientes deste contato" className="space-y-2">
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="text-overline uppercase text-content-tertiary">
            {pessoa ? `Pacientes de ${pessoa.nome}` : 'Pacientes deste contato'}
          </span>
          {pessoa && <Badge variant="brand">{pessoa.papel === 'consultor' ? 'Consultor' : 'Responsável'}</Badge>}
          <span className="text-caption text-content-tertiary">
            {telefone ? `${telefone} · ` : ''}
            {cards.length} {cards.length === 1 ? 'paciente' : 'pacientes'}
          </span>
        </div>
        <div role="tablist" className="flex flex-wrap gap-2">
          {cards.map((c) => {
            const ativa = !criando && aberto?.id === c.id
            const nestaConversa = c.id === daConversa?.id
            return (
              <button
                key={c.id}
                type="button"
                role="tab"
                aria-selected={ativa}
                onClick={() => {
                  setAbertoId(c.id)
                  setCriando(false)
                  setErroAcao(null)
                }}
                className={`flex min-h-[56px] flex-col justify-center gap-1 rounded-lg border-2 px-3.5 py-2 text-left transition-colors ${
                  ativa
                    ? 'border-brand-500 bg-surface-elevated shadow-sm'
                    : 'border-transparent bg-surface-tertiary hover:bg-surface-secondary'
                }`}
              >
                <span className="flex items-center gap-1.5 text-sm font-semibold text-content-primary">
                  {nestaConversa && <span aria-hidden="true" className="h-2 w-2 rounded-full bg-info-500" />}
                  {c.contact_name || 'Sem nome'}
                </span>
                <span className="flex items-center gap-1.5">
                  <EtapaBadge etapa={etapaFromEstagio(c.estagio_funil)} />
                  {nestaConversa && <span className="text-[11px] font-medium text-info-600">esta conversa</span>}
                </span>
              </button>
            )
          })}
          {telefone && (
            <button
              type="button"
              onClick={() => {
                setCriando(true)
                setErroAcao(null)
              }}
              className="flex min-h-[56px] items-center gap-1.5 rounded-lg border border-dashed border-border px-4 text-sm font-semibold text-brand-600 transition-colors hover:bg-surface-secondary"
            >
              <Plus size={16} />
              Novo paciente
            </button>
          )}
        </div>
      </section>

      {vendoOutro && aberto && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-info-500/30 bg-info-500/10 p-3 text-sm text-content-primary">
          <span className="min-w-[240px] flex-1">
            Você está vendo outro paciente{pessoa ? ` de ${pessoa.nome}` : ''}.{' '}
            {daConversa ? (
              <>
                Esta conversa está no card de <strong>{daConversa.contact_name || 'outro paciente'}</strong>.
              </>
            ) : (
              'Esta conversa ainda não está em nenhum card.'
            )}
          </span>
          <Button size="sm" variant="secondary" loading={movendo} onClick={() => moverPara(aberto)}>
            Mover esta conversa para {(aberto.contact_name || 'este paciente').split(' ')[0]}
          </Button>
        </div>
      )}
      {erroAcao && <p className="text-sm text-danger-500">{erroAcao}</p>}

      {erro ? (
        <Aviso>Erro ao carregar o card: {erro}</Aviso>
      ) : criando && telefone ? (
        <NovoPacienteForm
          telefone={telefone}
          convId={convId}
          nomeContato={nomeContato}
          pacienteDaConversa={daConversa?.contact_name ?? null}
          onCriado={(card) => {
            setCards((prev) => [...prev, card])
            setAbertoId(card.id)
            setCriando(false)
            reler()
          }}
          onCancelar={() => setCriando(false)}
        />
      ) : carregando && !leadAberto ? (
        <Aviso>
          <Loader2 size={14} className="animate-spin" /> Buscando o card…
        </Aviso>
      ) : !leadAberto ? (
        <Aviso>Esta conversa ainda não tem card no funil. Ele aparece aqui assim que a Mônica começar a triagem.</Aviso>
      ) : (
        <FunilDadosProvider leads={leads}>
          <CardDetail
            triagem={leadAberto}
            open
            inline
            onClose={() => {}}
            onSaved={(t) => setCards((prev) => prev.map((x) => (x.id === t.id ? t : x)))}
          />
        </FunilDadosProvider>
      )}
    </div>
  )
}

function Aviso({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-border bg-surface-secondary p-4 text-sm text-content-secondary">
      {children}
    </div>
  )
}
