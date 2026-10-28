'use client'

import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useTriagensRealtime } from '@/lib/realtime'
import { comEtapa } from '@/lib/funil-etapas'
import { lerContexto, ORIGENS_CHATWOOT, PEDIDO_CONTEXTO, type ContextoChatwoot } from '@/lib/chatwoot/embed'
import { PACIENTE_RESUMO_FIELDS } from '@/types'
import type { PacienteResumo, Triagem, TriagemLead } from '@/types'
import { CardDetail } from '@/components/kanban/card-detail'
import { FunilDadosProvider } from '@/components/kanban/funil-dados'

/** Pede o contexto de novo de tempos em tempos: se o atendente troca de conversa com a
 *  aba aberta, o card acompanha (e nunca fica editando o lead da conversa anterior). */
const REPEDIR_MS = 10_000

function pedirContexto() {
  for (const origem of ORIGENS_CHATWOOT) window.parent?.postMessage(PEDIDO_CONTEXTO, origem)
}

/**
 * Card do lead da conversa aberta no Chatwoot (Dashboard App). O Chatwoot entrega a
 * conversa por postMessage; o card é o mesmo do funil, sem o modal.
 */
export function CardDaConversa() {
  const supabase = useMemo(() => createClient(), [])
  const [ctx, setCtx] = useState<ContextoChatwoot | null>(null)
  const [semContexto, setSemContexto] = useState(false)
  const [items, setItems] = useState<TriagemLead[]>([])
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  // Relê o card da conversa a cada contexto recebido (~10s) e a cada evento do tempo
  // real: no fim da triagem a conversa pode TROCAR de card (card único — a linha
  // provisória some e a conversa vai para o card do paciente), e o merge do payload do
  // tempo real sozinho não dava conta disso.
  const [releitura, setReleitura] = useState(0)
  const reler = () => setReleitura((n) => n + 1)

  useTriagensRealtime(setItems, { onEvento: reler })

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

  // Spinner só ao abrir/trocar de conversa; a releitura periódica é silenciosa.
  useEffect(() => {
    if (convId) setCarregando(true)
  }, [convId])

  useEffect(() => {
    if (!convId) return
    let vivo = true
    ;(async () => {
      const { data, error } = await supabase
        .from('triagem_hsm')
        .select('*')
        .eq('conversation_id', convId)
        .order('updated_at', { ascending: false })
        .limit(1)
      if (!vivo) return
      if (error) {
        setErro(error.message)
        setCarregando(false)
        return
      }
      const lead = (data?.[0] ?? null) as Triagem | null
      let paciente: PacienteResumo | null = null
      if (lead?.paciente_id) {
        const { data: p } = await supabase
          .from('pacientes')
          .select(PACIENTE_RESUMO_FIELDS)
          .eq('id', lead.paciente_id)
          .maybeSingle()
        paciente = (p as PacienteResumo | null) ?? null
      }
      if (!vivo) return
      setErro(null)
      setItems(lead ? [{ ...lead, paciente }] : [])
      setCarregando(false)
    })()
    return () => {
      vivo = false
    }
  }, [convId, releitura, supabase])

  // Pela conversa (não por id): se o card ainda não existia, ele aparece quando a
  // Mônica criar a linha (o tempo real traz o INSERT).
  const lead = useMemo(() => {
    if (!convId) return null
    const daConversa = items.filter((t) => String(t.conversation_id) === convId)
    daConversa.sort((a, b) => (b.updated_at ?? '').localeCompare(a.updated_at ?? ''))
    return daConversa[0] ? comEtapa(daConversa[0]) : null
  }, [items, convId])
  const leads = useMemo(() => (lead ? [lead] : []), [lead])

  if (!ctx) {
    return (
      <Aviso>
        {semContexto
          ? 'Abra este painel pela aba de uma conversa no Chatwoot.'
          : 'Carregando a conversa…'}
      </Aviso>
    )
  }

  const conv = ctx.conversation
  const botPausado = conv?.custom_attributes?.bot_pausado === true
  const semAtendente = !conv?.meta?.assignee

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

      {erro ? (
        <Aviso>Erro ao carregar o card: {erro}</Aviso>
      ) : carregando && !lead ? (
        <Aviso>
          <Loader2 size={14} className="animate-spin" /> Buscando o card…
        </Aviso>
      ) : !lead ? (
        <Aviso>Esta conversa ainda não tem card no funil. Ele aparece aqui assim que a Mônica começar a triagem.</Aviso>
      ) : (
        <FunilDadosProvider leads={leads}>
          <CardDetail
            triagem={lead}
            open
            inline
            onClose={() => {}}
            onSaved={(t) => setItems((prev) => prev.map((x) => (x.id === t.id ? t : x)))}
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
