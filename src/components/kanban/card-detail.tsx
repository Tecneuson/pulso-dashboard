'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import {
  Check,
  AlertCircle,
  XCircle,
  CheckCircle2,
  ChevronDown,
  ExternalLink,
  IdCard,
  Loader2,
  Phone,
  Search,
  Unlink,
} from 'lucide-react'
import type {
  Agendamento,
  Anotacao,
  EstagioFunil,
  MotivoPerda,
  PacienteResumo,
  TriagemLead,
} from '@/types'
import { MOTIVO_PERDA_LABELS } from '@/types'
import { formatarCpf } from '@/lib/cpf'
import { idadeEm, isKids } from '@/lib/idade'
import { chatwootLinkDoLead } from '@/lib/chatwoot/urls'
import { useCampos } from '@/lib/api-store'
import { CamposDinamicos } from './campos-dinamicos'
import { Modal } from '@/components/ui/modal'
import { Badge, EtapaBadge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { FIELD_OPTIONS } from '@/lib/chatwoot/mapping'
import { classificacaoMeta, formatDateBR, internacoesConhecidas } from '@/lib/funil'
import {
  SITUACAO_BADGE,
  SITUACAO_LABELS,
  formatDataBR,
  hojeISO,
  situacaoAgendamento,
} from '@/lib/agendamentos'
import { useFunilDados } from './funil-dados'
import {
  etapaFromEstagio,
  ETAPA_TO_ESTAGIO,
  FUNIL_ETAPA_OPTIONS,
  type FunilEtapa,
  type LeadComEtapa,
} from '@/lib/funil-etapas'
import { OrigemFields, type OrigemValue } from './origem-fields'
import { CaptadorField } from './captador-field'

interface CardDetailProps {
  triagem: LeadComEtapa | null
  open: boolean
  onClose: () => void
  /** Abre já no painel de internação (usado quando o card é arrastado p/ Internação). */
  autoInternar?: boolean
  /** Abre já no painel de perda (card arrastado p/ Perdido — motivo é obrigatório). */
  autoPerda?: boolean
  onSaved?: (t: TriagemLead) => void
}

const FORMA_OPTIONS = [
  { value: 'plano', label: 'Plano de saúde' },
  { value: 'particular', label: 'Particular' },
  { value: 'nao_sabe', label: 'Não sabe' },
]

/** Triagem resumida retornada por GET /api/triagem?paciente_id= (contatos associados). */
interface Associado {
  id: string
  contact_name: string | null
  phone: string | null
  email: string | null
  conversation_id: string | null
  estagio_funil: EstagioFunil | null
  motivo_perda: MotivoPerda | null
  tipo_contato: string | null
  created_at: string
  updated_at: string
}

type Evento = {
  dataISO: string
  data: string
  agente: string
  tipo: 'ganho' | 'perda' | 'anotacao'
  desfecho: string
  nota?: string
}

function withEmpty(opts?: { value: string; label: string }[]) {
  return [{ value: '', label: '—' }, ...(opts ?? [])]
}

/** Elegibilidade do contato (avaliada na conversa). Grava boolean no banco. */
const ELEGIVEL_OPTIONS = [
  { value: 'sim', label: 'Sim' },
  { value: 'nao', label: 'Não' },
]

function formatDateTimeBR(iso: string | null): string {
  if (!iso) return '—'
  return formatDateBR(iso.slice(0, 10))
}

function ContatoPaciente({ paciente: p }: { paciente: PacienteResumo }) {
  const telefones = p.telefones ?? []
  if (!p.cpf && telefones.length === 0) return null
  return (
    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-content-secondary">
      {p.cpf && (
        <span className="inline-flex items-center gap-1">
          <IdCard size={12} className="text-content-tertiary" />
          {formatarCpf(p.cpf)}
        </span>
      )}
      {telefones.map((tel) => (
        <span key={tel} className="inline-flex items-center gap-1">
          <Phone size={12} className="text-content-tertiary" />
          {tel}
        </span>
      ))}
    </div>
  )
}

function EventRow({ ev }: { ev: Evento }) {
  const dot =
    ev.tipo === 'ganho' ? 'bg-success-500' : ev.tipo === 'anotacao' ? 'bg-brand-500' : 'bg-danger-500'
  const text =
    ev.tipo === 'ganho'
      ? 'text-success-600 dark:text-success-500'
      : ev.tipo === 'anotacao'
      ? 'text-brand-500'
      : 'text-danger-500'
  return (
    <div className="py-2.5">
      <div className="flex items-center gap-3">
        <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${dot}`} />
        <span className="text-sm text-content-secondary shrink-0">{ev.data}</span>
        <span className="text-sm text-content-tertiary truncate">{ev.agente}</span>
        <span className={`ml-auto text-sm font-medium text-right shrink-0 ${text}`}>{ev.desfecho}</span>
      </div>
      {ev.nota && <p className="text-sm text-content-secondary mt-1.5 pl-[22px]">{ev.nota}</p>}
    </div>
  )
}

export function CardDetail({ triagem, open, onClose, autoInternar = false, autoPerda = false, onSaved }: CardDetailProps) {
  const [form, setForm] = useState<Record<string, string>>({})
  const [editandoNome, setEditandoNome] = useState(false)
  const [nomeEdit, setNomeEdit] = useState('')
  const [numeroPaciente, setNumeroPaciente] = useState('')
  const [captadorId, setCaptadorId] = useState<string | null>(null)
  const [origem, setOrigem] = useState<OrigemValue>({
    origem_conversa: null,
    origem_hospital_id: null,
    origem_consultor_id: null,
    origem_profissional_tipo: null,
  })
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState<'idle' | 'saved' | 'error'>('idle')
  const [sync, setSync] = useState<string | null>(null)
  const [showMoreFields, setShowMoreFields] = useState(false)

  const [paciente, setPaciente] = useState<PacienteResumo | null>(null)
  const [linking, setLinking] = useState(false)
  const [busca, setBusca] = useState('')
  const [resultados, setResultados] = useState<PacienteResumo[]>([])
  const [buscando, setBuscando] = useState(false)

  const [associados, setAssociados] = useState<Associado[]>([])
  const [anotacoes, setAnotacoes] = useState<Anotacao[]>([])
  const [showMoreContatos, setShowMoreContatos] = useState(false)

  const [painel, setPainel] = useState<'none' | 'anotacao' | 'perda' | 'internacao' | 'proximo'>(
    'none'
  )
  const [notaTexto, setNotaTexto] = useState('')
  const [motivoPerda, setMotivoPerda] = useState('')
  const [acaoLoading, setAcaoLoading] = useState(false)
  const [acaoErro, setAcaoErro] = useState<string | null>(null)

  // Próximo contato (agendamentos deste lead)
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([])
  const [novaData, setNovaData] = useState('')
  const [novaNota, setNovaNota] = useState('')
  const [resolucao, setResolucao] = useState('')
  const [menuAcoes, setMenuAcoes] = useState(false)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const dadosFunil = useFunilDados()
  const camposDef = useCampos()
  const [atributos, setAtributos] = useState<Record<string, unknown>>({})

  useEffect(() => {
    if (!triagem) return
    setForm({
      etapa: triagem.etapa,
      phone: triagem.phone ?? '',
      email: triagem.email ?? '',
      data_nascimento: triagem.data_nascimento ?? '',
      elegivel: triagem.elegivel == null ? '' : triagem.elegivel ? 'sim' : 'nao',
      tipo_contato: triagem.tipo_contato ?? '',
      assunto: triagem.assunto ?? '',
      motivo_contato: triagem.motivo_contato ?? '',
      para_quem: triagem.para_quem ?? '',
      forma_internacao: triagem.forma_internacao ?? '',
      plano_saude: triagem.plano_saude ?? '',
    })
    setAtributos({ ...(triagem.atributos ?? {}) })
    setOrigem({
      origem_conversa: triagem.origem_conversa ?? null,
      origem_hospital_id: triagem.origem_hospital_id ?? null,
      origem_consultor_id: triagem.origem_consultor_id ?? null,
      origem_profissional_tipo: triagem.origem_profissional_tipo ?? null,
    })
    setStatus('idle')
    setSync(null)
    setPaciente(triagem.paciente ?? null)
    setBusca('')
    setResultados([])
    // Lead manual: já abre com todos os campos do cadastro à vista, para editar direto.
    setShowMoreFields(!triagem.conversation_id)
    setShowMoreContatos(false)
    setPainel(autoInternar ? 'internacao' : autoPerda ? 'perda' : 'none')
    setNotaTexto('')
    setMotivoPerda('')
    setAcaoErro(null)
    setEditandoNome(false)
    setNomeEdit(triagem.contact_name ?? '')
    setCaptadorId(triagem.consultor_id ?? triagem.captador_id ?? null)
    setNumeroPaciente(
      triagem.numero_paciente ??
        (triagem.paciente?.identificador_cliente != null
          ? String(triagem.paciente.identificador_cliente)
          : '')
    )
    // Reinicia só ao abrir outro lead (ou pedir internação/perda), não a cada revalidação.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [triagem?.id, autoInternar, autoPerda])

  // Contatos associados ao mesmo paciente (leitura)
  useEffect(() => {
    const pid = paciente?.id
    if (!pid) {
      setAssociados([])
      return
    }
    let alive = true
    fetch(`/api/triagem?paciente_id=${pid}`)
      .then((r) => r.json())
      .then((data) => {
        if (alive && Array.isArray(data.rows)) setAssociados(data.rows)
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [paciente?.id])

  // Anotações do lead
  useEffect(() => {
    if (!triagem?.id) return
    let alive = true
    setAnotacoes([])
    fetch(`/api/anotacoes?triagem_id=${triagem.id}`)
      .then((r) => r.json())
      .then((data) => {
        if (alive && Array.isArray(data.rows)) setAnotacoes(data.rows)
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [triagem?.id])

  // Agendamentos do lead (próximo contato + histórico de lembretes)
  useEffect(() => {
    if (!triagem?.id) return
    let alive = true
    setAgendamentos([])
    setResolucao('')
    setNovaData('')
    setNovaNota('')
    fetch(`/api/agendamentos?triagem_id=${triagem.id}&status=todos`)
      .then((r) => r.json())
      .then((data) => {
        if (alive && Array.isArray(data.rows)) setAgendamentos(data.rows)
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [triagem?.id])

  // Fecha o menu "Ações" ao clicar fora
  useEffect(() => {
    if (!menuAcoes) return
    function onClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuAcoes(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [menuAcoes])

  // Busca de paciente para conciliação
  useEffect(() => {
    if (!busca.trim() || paciente) {
      setResultados([])
      return
    }
    const t = setTimeout(() => {
      setBuscando(true)
      fetch(`/api/pacientes?q=${encodeURIComponent(busca.trim())}&limit=5`)
        .then((r) => r.json())
        .then((data) => setResultados(Array.isArray(data.rows) ? data.rows : []))
        .catch(() => setResultados([]))
        .finally(() => setBuscando(false))
    }, 300)
    return () => clearTimeout(t)
  }, [busca, paciente])

  if (!triagem) return null

  // Link para a conversa (ou, sem conversa, para o contato) no Chatwoot.
  const linkChatwoot = chatwootLinkDoLead(triagem)
  const idade = idadeEm(form.data_nascimento || triagem.data_nascimento)
  const kids = form.data_nascimento ? isKids(form.data_nascimento) : triagem.kids ?? isKids(triagem.data_nascimento)

  function set(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }))
    setStatus('idle')
  }

  async function patchTriagem(
    payload: Record<string, unknown>,
    pac: PacienteResumo | null = paciente
  ): Promise<TriagemLead> {
    const res = await fetch('/api/triagem', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: triagem!.id, ...payload }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'erro')
    setSync(data.chatwoot ?? null)
    const updated = { ...(data.triagem as TriagemLead), paciente: pac }
    onSaved?.(updated)
    return updated
  }

  function salvarNome() {
    patchTriagem({ contact_name: nomeEdit.trim() || null })
      .then(() => setEditandoNome(false))
      .catch(() => setAcaoErro('Falha ao salvar nome'))
  }

  async function handleSave() {
    if (!triagem) return
    // Exige número só ao TRANSICIONAR para internação (não trava edições de um lead já internado).
    if (form.etapa === 'internacao' && triagem.etapa !== 'internacao' && !numeroPaciente.trim()) {
      setPainel('internacao')
      setAcaoErro('Informe o número do paciente para internar.')
      return
    }
    // Perdido exige motivo (é o que sincroniza com o Chatwoot e libera o encerramento).
    if (form.etapa === 'perdido' && triagem.etapa !== 'perdido' && !motivoPerda && !triagem.motivo_perda) {
      setPainel('perda')
      setAcaoErro('Selecione o motivo da perda para mover para Perdido.')
      return
    }
    const payload: Record<string, unknown> = {
      numero_paciente: numeroPaciente.trim() || null,
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
      data_nascimento: form.data_nascimento || null,
      elegivel: form.elegivel ? form.elegivel === 'sim' : null,
      tipo_contato: form.tipo_contato || null,
      assunto: form.assunto || null,
      motivo_contato: form.motivo_contato || null,
      para_quem: form.para_quem || null,
      forma_internacao: form.forma_internacao || null,
      plano_saude: form.plano_saude || null,
      consultor_id: captadorId,
      atributos,
      ...origem,
    }
    // Só grava estagio_funil se a etapa realmente mudou (preserva a nuance granular).
    if (form.etapa !== triagem.etapa) {
      payload.estagio_funil = ETAPA_TO_ESTAGIO[form.etapa as FunilEtapa]
      // Ao sair de "Perdido", limpa o motivo da perda (senão fica fantasma nos relatórios).
      if (form.etapa !== 'perdido') payload.motivo_perda = null
      else if (motivoPerda) payload.motivo_perda = motivoPerda
    }
    setSaving(true)
    setStatus('idle')
    try {
      await patchTriagem(payload)
      setStatus('saved')
      setAcaoErro(null)
    } catch (e) {
      console.error('Falha ao salvar:', e)
      setStatus('error')
      setAcaoErro(e instanceof Error && e.message !== 'erro' ? e.message : null)
    } finally {
      setSaving(false)
    }
  }

  async function vincular(p: PacienteResumo) {
    setLinking(true)
    setAcaoErro(null)
    try {
      await patchTriagem({ paciente_id: p.id }, p)
      setPaciente(p)
      if (!numeroPaciente.trim() && p.identificador_cliente != null) {
        setNumeroPaciente(String(p.identificador_cliente))
      }
      setBusca('')
      setResultados([])
    } catch (e) {
      console.error('Falha ao vincular paciente:', e)
      setAcaoErro('Falha ao vincular paciente')
    } finally {
      setLinking(false)
    }
  }

  async function desvincular() {
    setLinking(true)
    setAcaoErro(null)
    try {
      await patchTriagem({ paciente_id: null }, null)
      setPaciente(null)
      setAssociados([])
    } catch (e) {
      console.error('Falha ao desvincular paciente:', e)
      setAcaoErro('Falha ao desvincular paciente')
    } finally {
      setLinking(false)
    }
  }

  async function marcarInternacao() {
    if (!numeroPaciente.trim()) {
      setAcaoErro('Informe o número do paciente para internar.')
      return
    }
    setAcaoLoading(true)
    setAcaoErro(null)
    try {
      await patchTriagem({ estagio_funil: 'internado', numero_paciente: numeroPaciente.trim() })
      setForm((f) => ({ ...f, etapa: 'internacao' }))
      setPainel('none')
      setStatus('saved')
    } catch (e) {
      console.error('Falha ao marcar internação:', e)
      setAcaoErro('Falha ao marcar internação')
    } finally {
      setAcaoLoading(false)
    }
  }

  async function marcarPerda() {
    if (!motivoPerda) {
      setAcaoErro('Selecione o motivo da perda')
      return
    }
    setAcaoLoading(true)
    setAcaoErro(null)
    try {
      await patchTriagem({ estagio_funil: 'recusou_internacao', motivo_perda: motivoPerda })
      setForm((f) => ({ ...f, etapa: 'perdido' }))
      setPainel('none')
      setStatus('saved')
    } catch (e) {
      console.error('Falha ao marcar perda:', e)
      setAcaoErro('Falha ao marcar perda')
    } finally {
      setAcaoLoading(false)
    }
  }

  async function salvarAnotacao() {
    if (!notaTexto.trim()) return
    setAcaoLoading(true)
    setAcaoErro(null)
    try {
      const res = await fetch('/api/anotacoes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ triagem_id: triagem!.id, conteudo: notaTexto.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'erro')
      setAnotacoes((prev) => [data.anotacao, ...prev])
      setNotaTexto('')
      setPainel('none')
    } catch (e) {
      console.error('Falha ao salvar anotação:', e)
      setAcaoErro(e instanceof Error ? e.message : 'Falha ao salvar anotação')
    } finally {
      setAcaoLoading(false)
    }
  }

  async function salvarProximoContato() {
    if (!novaData) {
      setAcaoErro('Escolha a data do próximo contato')
      return
    }
    setAcaoLoading(true)
    setAcaoErro(null)
    try {
      const res = await fetch('/api/agendamentos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo: 'contato',
          triagem_id: triagem!.id,
          paciente_id: paciente?.id ?? null,
          data: novaData,
          nota: novaNota.trim() || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'erro')
      setAgendamentos((prev) => [data.agendamento, ...prev])
      setNovaData('')
      setNovaNota('')
      setPainel('none')
      dadosFunil.recarregarAgendamentos()
    } catch (e) {
      console.error('Falha ao agendar contato:', e)
      setAcaoErro(e instanceof Error ? e.message : 'Falha ao agendar contato')
    } finally {
      setAcaoLoading(false)
    }
  }

  async function resolverAgendamento(id: string, status: 'contatado' | 'nao_contatado') {
    setAcaoLoading(true)
    setAcaoErro(null)
    try {
      const res = await fetch('/api/agendamentos', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status, resultado_nota: resolucao.trim() || null }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'erro')
      setAgendamentos((prev) => prev.map((a) => (a.id === id ? data.agendamento : a)))
      setResolucao('')
      dadosFunil.recarregarAgendamentos()
    } catch (e) {
      console.error('Falha ao resolver lembrete:', e)
      setAcaoErro(e instanceof Error ? e.message : 'Falha ao resolver lembrete')
    } finally {
      setAcaoLoading(false)
    }
  }

  // ---------- Dados derivados ----------

  const classif = paciente?.classificacao_cliente
    ? classificacaoMeta(paciente.classificacao_cliente)
    : null

  const fontes: Associado[] = associados.length
    ? associados
    : [
        {
          id: triagem.id,
          contact_name: triagem.contact_name,
          phone: triagem.phone,
          email: triagem.email,
          conversation_id: triagem.conversation_id,
          estagio_funil: triagem.estagio_funil,
          motivo_perda: triagem.motivo_perda,
          tipo_contato: triagem.tipo_contato,
          created_at: triagem.created_at,
          updated_at: triagem.updated_at,
        },
      ]

  const eventosTriagem: Evento[] = fontes.flatMap((a) => {
    const out: Evento[] = []
    if (a.estagio_funil === 'internado') {
      out.push({
        dataISO: a.updated_at,
        data: formatDateTimeBR(a.updated_at),
        agente: a.contact_name ?? 'Lead',
        tipo: 'ganho',
        desfecho: 'Internação',
      })
    }
    if (a.motivo_perda) {
      out.push({
        dataISO: a.updated_at,
        data: formatDateTimeBR(a.updated_at),
        agente: a.contact_name ?? 'Lead',
        tipo: 'perda',
        desfecho: MOTIVO_PERDA_LABELS[a.motivo_perda] ?? a.motivo_perda,
      })
    }
    return out
  })

  const internacoesPassadas = paciente ? internacoesConhecidas(paciente) : []
  const eventosInternacoes: Evento[] = internacoesPassadas.map((d) => ({
    dataISO: d,
    data: formatDateBR(d),
    agente: 'HSM',
    tipo: 'ganho',
    desfecho: 'Internação',
  }))

  const eventosAnotacoes: Evento[] = anotacoes.map((a) => ({
    dataISO: a.created_at ?? '',
    data: formatDateTimeBR(a.created_at),
    agente: a.autor_nome ?? a.usuarios?.nome ?? (a.origem === 'chatwoot' ? 'Chatwoot' : 'Equipe'),
    tipo: 'anotacao',
    desfecho: a.origem === 'chatwoot' ? 'Nota (Chatwoot)' : a.origem === 'bot' ? 'Resumo (Mônica)' : 'Anotação',
    nota: a.conteudo,
  }))

  // Observações gravadas pelo bot na triagem (coluna `observacoes`) viram um evento do histórico.
  const eventosTriagemBot: Evento[] = triagem.observacoes
    ? [
        {
          dataISO: triagem.created_at,
          data: formatDateTimeBR(triagem.created_at),
          agente: 'Mônica (triagem)',
          tipo: 'anotacao',
          desfecho: 'Observações da triagem',
          nota: triagem.observacoes,
        },
      ]
    : []

  // Lembretes entram no histórico: quando marcados e quando resolvidos.
  const eventosAgendamentos: Evento[] = agendamentos.flatMap((a) => {
    const out: Evento[] = [
      {
        dataISO: a.created_at,
        data: formatDataBR(a.data),
        agente: dadosFunil.nomeAgente(a.criado_por) ?? 'Equipe',
        tipo: 'anotacao',
        desfecho: 'Próximo contato',
        nota: a.nota ?? undefined,
      },
    ]
    if (a.status !== 'pendente' && a.concluido_at) {
      out.push({
        dataISO: a.concluido_at,
        data: formatDateTimeBR(a.concluido_at),
        agente: dadosFunil.nomeAgente(a.criado_por) ?? 'Equipe',
        tipo: a.status === 'contatado' ? 'ganho' : 'perda',
        desfecho: a.status === 'contatado' ? 'Contato feito' : 'Sem contato',
        nota: a.resultado_nota ?? undefined,
      })
    }
    return out
  })

  const proximoContato = agendamentos
    .filter((a) => a.status === 'pendente')
    .sort((a, b) => a.data.localeCompare(b.data))[0]

  const historico = [
    ...eventosTriagem,
    ...eventosInternacoes,
    ...eventosAnotacoes,
    ...eventosTriagemBot,
    ...eventosAgendamentos,
  ].sort((a, b) => b.dataISO.localeCompare(a.dataISO))
  const desfechosRecentes = [...eventosTriagem, ...eventosInternacoes]
    .sort((a, b) => b.dataISO.localeCompare(a.dataISO))
    .slice(0, 5)

  const contadores = [
    { label: 'Conversas', valor: fontes.length },
    {
      label: 'Internações',
      valor: paciente
        ? internacoesPassadas.length
        : fontes.filter((a) => a.estagio_funil === 'internado').length,
    },
    { label: 'Perdas', valor: fontes.filter((a) => a.motivo_perda).length },
  ]

  const outrosContatos = associados.filter((a) => a.id !== triagem.id)
  const contatosVisiveis = showMoreContatos ? outrosContatos : outrosContatos.slice(0, 2)

  const headerBtn =
    'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium border border-border text-content-secondary hover:bg-surface-tertiary transition-colors'
  const inputCls =
    'w-full rounded bg-surface-tertiary border border-border text-sm text-content-primary placeholder:text-content-tertiary px-3 py-2.5 transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500'

  return (
    <Modal open={open} onClose={onClose} title="Detalhes do contato" size="xl">
      <div className="space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-overline uppercase text-content-tertiary mb-1">Estágio no Funil</p>
            <div className="flex items-center gap-1.5 flex-wrap">
              {form.etapa && <EtapaBadge etapa={form.etapa as FunilEtapa} />}
              {kids === true && <Badge variant="info">Kids</Badge>}
              {form.etapa === 'perdido' && triagem.motivo_perda && (
                <Badge variant="danger">
                  Motivo: {MOTIVO_PERDA_LABELS[triagem.motivo_perda] ?? triagem.motivo_perda}
                </Badge>
              )}
              {classif && (
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-sm text-body-sm font-medium ${classif.badgeClass}`}
                >
                  {classif.label}
                </span>
              )}
            </div>
            {editandoNome ? (
              <div className="flex items-center gap-2 mt-1.5">
                <input
                  autoFocus
                  value={nomeEdit}
                  onChange={(e) => setNomeEdit(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') salvarNome()
                    if (e.key === 'Escape') setEditandoNome(false)
                  }}
                  className="font-display text-lg font-medium bg-surface-tertiary border border-border rounded px-2 py-0.5 text-content-primary focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500"
                />
                <button type="button" onClick={salvarNome} className="text-xs text-brand-500 hover:text-brand-400">
                  Salvar
                </button>
                <button type="button" onClick={() => setEditandoNome(false)} className="text-xs text-content-tertiary hover:text-content-primary">
                  Cancelar
                </button>
              </div>
            ) : (
              <h3 className="font-display text-lg font-medium text-content-primary mt-1.5 flex items-center gap-2 min-w-0">
                <span className="truncate">
                  {triagem.contact_name ?? 'Sem nome'}
                  {(triagem.cpf || paciente?.cpf) && (
                    <span className="text-content-secondary font-normal">
                      {' '}
                      - {formatarCpf((triagem.cpf ?? paciente?.cpf) as string)}
                    </span>
                  )}
                </span>
                {numeroPaciente && !paciente && (
                  <span className="text-content-tertiary font-normal text-sm shrink-0">· Nº {numeroPaciente}</span>
                )}
                {paciente && (
                  <span className="text-content-tertiary font-normal text-sm shrink-0">
                    · Paciente #{paciente.identificador_cliente}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setNomeEdit(triagem.contact_name ?? '')
                    setEditandoNome(true)
                  }}
                  className="text-xs text-brand-500 hover:text-brand-400 font-normal shrink-0"
                >
                  Editar
                </button>
              </h3>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                className={headerBtn}
                onClick={() => setMenuAcoes((v) => !v)}
                aria-expanded={menuAcoes}
              >
                Ações
                <ChevronDown size={14} />
              </button>
              {menuAcoes && (
                <div className="absolute right-0 top-full mt-1 z-10 min-w-[180px] rounded-md border border-border bg-surface-elevated shadow-elevated py-1 animate-fade-in">
                  <button
                    type="button"
                    className="w-full text-left px-3 py-2 text-sm text-content-secondary hover:bg-surface-tertiary hover:text-content-primary transition-colors"
                    onClick={() => {
                      setMenuAcoes(false)
                      setPainel(painel === 'anotacao' ? 'none' : 'anotacao')
                    }}
                  >
                    Adicionar Nota
                  </button>
                  <button
                    type="button"
                    className="w-full text-left px-3 py-2 text-sm text-content-secondary hover:bg-surface-tertiary hover:text-content-primary transition-colors"
                    onClick={() => {
                      setMenuAcoes(false)
                      setNovaData((d) => d || hojeISO())
                      setPainel(painel === 'proximo' ? 'none' : 'proximo')
                    }}
                  >
                    Próximo Contato
                  </button>
                </div>
              )}
            </div>
            {linkChatwoot && (
              <a
                href={linkChatwoot.url}
                target="_blank"
                rel="noopener noreferrer"
                className={headerBtn}
                title={linkChatwoot.tipo === 'conversa' ? 'Abrir a conversa no Chatwoot' : 'Abrir o contato no Chatwoot (sem conversa)'}
              >
                <ExternalLink size={14} />
                {linkChatwoot.tipo === 'conversa' ? 'Abrir no Chatwoot' : 'Contato no Chatwoot'}
              </a>
            )}
            <button type="button" className={headerBtn} onClick={() => setPainel(painel === 'internacao' ? 'none' : 'internacao')}>
              <CheckCircle2 size={14} />
              Marcar Internação
            </button>
            <button type="button" className={headerBtn} onClick={() => setPainel(painel === 'perda' ? 'none' : 'perda')}>
              <XCircle size={14} />
              Marcar Perda
            </button>
          </div>
        </div>

        {painel === 'anotacao' && (
          <div className="rounded-lg border border-border p-3 space-y-2 animate-fade-up">
            <textarea
              value={notaTexto}
              onChange={(e) => setNotaTexto(e.target.value)}
              rows={3}
              autoFocus
              placeholder="Escreva a anotação…"
              className={inputCls}
            />
            <div className="flex items-center justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setPainel('none')}>
                Cancelar
              </Button>
              <Button size="sm" onClick={salvarAnotacao} loading={acaoLoading}>
                Salvar anotação
              </Button>
            </div>
          </div>
        )}
        {painel === 'proximo' && (
          <div className="rounded-lg border border-border p-3 space-y-2 animate-fade-up">
            <p className="text-sm text-content-secondary">
              Marque a data do próximo contato. O lembrete aparece no card, na Agenda e no
              histórico.
            </p>
            <div className="flex flex-wrap items-end gap-2">
              <div>
                <p className="text-overline uppercase text-content-tertiary mb-1">Data *</p>
                <input
                  type="date"
                  autoFocus
                  value={novaData}
                  onChange={(e) => setNovaData(e.target.value)}
                  className="h-10 rounded bg-surface-tertiary border border-border text-sm px-3 text-content-primary focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500"
                />
              </div>
              <div className="flex-1 min-w-[200px]">
                <p className="text-overline uppercase text-content-tertiary mb-1">Nota</p>
                <input
                  value={novaNota}
                  onChange={(e) => setNovaNota(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') salvarProximoContato()
                  }}
                  placeholder="Ex.: retornar após a autorização do convênio"
                  className="w-full h-10 rounded bg-surface-tertiary border border-border text-sm px-3 text-content-primary placeholder:text-content-tertiary focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500"
                />
              </div>
              <Button variant="ghost" size="sm" onClick={() => setPainel('none')}>
                Cancelar
              </Button>
              <Button size="sm" onClick={salvarProximoContato} loading={acaoLoading}>
                Agendar
              </Button>
            </div>
          </div>
        )}
        {painel === 'internacao' && (
          <div className="rounded-lg border border-success-500/30 bg-success-500/5 p-3 space-y-2 animate-fade-up">
            <p className="text-sm text-content-secondary">
              Para internar, informe o <strong>número do paciente</strong>. O card vai para a coluna{' '}
              <strong>Internação</strong>.
            </p>
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <p className="text-overline uppercase text-content-tertiary mb-1">Número do paciente *</p>
                <input
                  autoFocus
                  value={numeroPaciente}
                  onChange={(e) => setNumeroPaciente(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') marcarInternacao()
                  }}
                  placeholder="Ex.: 123456"
                  className={inputCls}
                />
              </div>
              <Button variant="ghost" size="sm" onClick={() => setPainel('none')}>
                Cancelar
              </Button>
              <Button size="sm" onClick={marcarInternacao} loading={acaoLoading}>
                Confirmar internação
              </Button>
            </div>
          </div>
        )}
        {painel === 'perda' && (
          <div className="rounded-lg border border-danger-500/30 bg-danger-500/5 p-3 space-y-2 animate-fade-up">
            <p className="text-sm text-content-secondary">Qual o motivo da perda?</p>
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <Select options={withEmpty(FIELD_OPTIONS.motivo_perda)} value={motivoPerda} onChange={(e) => setMotivoPerda(e.target.value)} />
              </div>
              <Button variant="ghost" size="sm" onClick={() => setPainel('none')}>
                Cancelar
              </Button>
              <Button size="sm" onClick={marcarPerda} loading={acaoLoading}>
                Confirmar perda
              </Button>
            </div>
          </div>
        )}
        {acaoErro && (
          <p className="text-sm text-danger-500 flex items-center gap-1.5">
            <AlertCircle size={13} />
            {acaoErro}
          </p>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="md:pr-6 space-y-4">
            <h4 className="text-sm font-semibold text-content-primary">Campos de dados</h4>

            <Field label="Paciente vinculado">
              {paciente ? (
                <div className="rounded-lg border border-border bg-surface-tertiary/50 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-content-primary truncate">
                        {paciente.nome_cliente}
                        <span className="text-content-tertiary font-mono text-xs ml-1.5">#{paciente.identificador_cliente}</span>
                      </p>
                      <p className="text-xs text-content-secondary mt-0.5">
                        {paciente.convenio_raw ?? 'Sem convênio'} · Última internação {formatDateBR(paciente.data_emissao_max)}
                      </p>
                      <ContatoPaciente paciente={paciente} />
                    </div>
                    <button
                      type="button"
                      onClick={desvincular}
                      disabled={linking}
                      title="Desvincular paciente"
                      className="shrink-0 inline-flex items-center gap-1 rounded-md border border-border px-2 py-1.5 text-xs text-content-secondary hover:bg-surface-tertiary transition-colors"
                    >
                      {linking ? <Loader2 size={12} className="animate-spin" /> : <Unlink size={12} />}
                      Desvincular
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-content-tertiary" />
                    <input
                      type="text"
                      value={busca}
                      onChange={(e) => setBusca(e.target.value)}
                      placeholder="Buscar paciente por nome ou nº…"
                      className={`${inputCls} pl-9`}
                    />
                  </div>
                  {buscando && (
                    <p className="text-xs text-content-tertiary flex items-center gap-1.5">
                      <Loader2 size={12} className="animate-spin" /> Buscando…
                    </p>
                  )}
                  {!buscando && busca.trim() && resultados.length === 0 && (
                    <p className="text-xs text-content-tertiary">Nenhum paciente encontrado.</p>
                  )}
                  {resultados.map((p) => {
                    const m = p.classificacao_cliente ? classificacaoMeta(p.classificacao_cliente) : null
                    return (
                      <div key={p.id} className="flex items-center justify-between gap-2 rounded-lg border border-border p-2.5">
                        <div className="min-w-0">
                          <p className="text-sm text-content-primary truncate">
                            {p.nome_cliente}
                            <span className="text-content-tertiary font-mono text-xs ml-1.5">#{p.identificador_cliente}</span>
                          </p>
                          {m && (
                            <span className={`inline-flex items-center mt-1 px-1.5 py-0.5 rounded-sm text-[11px] font-medium ${m.badgeClass}`}>
                              {m.label}
                            </span>
                          )}
                        </div>
                        <Button size="sm" variant="secondary" onClick={() => vincular(p)} loading={linking}>
                          Vincular
                        </Button>
                      </div>
                    )
                  })}
                </div>
              )}
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Telefone">
                <input
                  value={form.phone}
                  onChange={(e) => set('phone', e.target.value)}
                  placeholder="(00) 00000-0000"
                  className={inputCls}
                />
              </Field>
              <Field label="E-mail">
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => set('email', e.target.value)}
                  placeholder="email@exemplo.com"
                  className={inputCls}
                />
              </Field>
            </div>

            <Field label="Data de nascimento">
              <input
                type="date"
                value={form.data_nascimento}
                onChange={(e) => set('data_nascimento', e.target.value)}
                className={inputCls}
              />
              {idade != null && (
                <p className="text-xs text-content-tertiary mt-1">
                  {idade} anos{kids ? ' · Kids (8–17) — marcado automaticamente no CRM e no Chatwoot' : ''}
                </p>
              )}
            </Field>

            <Field label="Etapa do funil">
              <Select options={FUNIL_ETAPA_OPTIONS} value={form.etapa} onChange={(e) => set('etapa', e.target.value)} />
            </Field>
            <Field label="Elegível">
              <Select options={withEmpty(ELEGIVEL_OPTIONS)} value={form.elegivel} onChange={(e) => set('elegivel', e.target.value)} />
            </Field>
            <Field label="Categoria do contato">
              <Select options={withEmpty(FIELD_OPTIONS.tipo_contato)} value={form.tipo_contato} onChange={(e) => set('tipo_contato', e.target.value)} />
            </Field>
            <Field label="Assunto">
              <Select options={withEmpty(FIELD_OPTIONS.assunto)} value={form.assunto} onChange={(e) => set('assunto', e.target.value)} />
            </Field>
            <Field label="Motivo do contato">
              <Select options={withEmpty(FIELD_OPTIONS.motivo_contato)} value={form.motivo_contato} onChange={(e) => set('motivo_contato', e.target.value)} />
            </Field>

            <div className="pt-3 border-t border-border space-y-4">
              <OrigemFields value={origem} onChange={(p) => { setOrigem((o) => ({ ...o, ...p })); setStatus('idle') }} />
              <CaptadorField value={captadorId} onChange={(id) => { setCaptadorId(id); setStatus('idle') }} />
            </div>

            {camposDef.ativos.length > 0 && (
              <div className="pt-3 border-t border-border">
                <CamposDinamicos
                  campos={camposDef.ativos}
                  valores={atributos}
                  onChange={(chave, valor) => { setAtributos((a) => ({ ...a, [chave]: valor })); setStatus('idle') }}
                />
              </div>
            )}

            {showMoreFields && (
              <>
                <Field label="Para quem">
                  <Select options={withEmpty(FIELD_OPTIONS.para_quem)} value={form.para_quem} onChange={(e) => set('para_quem', e.target.value)} />
                </Field>
                <Field label="Forma de internação">
                  <Select options={withEmpty(FORMA_OPTIONS)} value={form.forma_internacao} onChange={(e) => set('forma_internacao', e.target.value)} />
                </Field>
                <Field label="Plano de saúde">
                  <Select options={withEmpty(FIELD_OPTIONS.plano_saude)} value={form.plano_saude} onChange={(e) => set('plano_saude', e.target.value)} />
                </Field>
                {/* "Observações" saiu do card: use Ações → Adicionar Nota (histórico ⇄ notas do Chatwoot). */}
              </>
            )}

            <button type="button" onClick={() => setShowMoreFields((v) => !v)} className="text-xs text-brand-500 hover:text-brand-400 transition-colors">
              {showMoreFields ? 'Mostrar menos' : 'Mostrar mais'}
            </button>

            <div className="pt-4 border-t border-border">
              <h4 className="text-sm font-semibold text-content-primary mb-3">Contatos associados ao paciente</h4>
              {!paciente ? (
                <p className="text-xs text-content-tertiary">Vincule um paciente para ver os contatos associados.</p>
              ) : outrosContatos.length === 0 ? (
                <p className="text-xs text-content-tertiary">Nenhum outro contato conciliado a este paciente.</p>
              ) : (
                <div className="space-y-3">
                  {contatosVisiveis.map((c) => (
                    <div key={c.id}>
                      <p className="text-sm font-medium text-content-primary">
                        {c.contact_name ?? 'Sem nome'}
                        {c.phone && <span className="text-content-tertiary font-normal text-xs ml-2">{c.phone}</span>}
                      </p>
                      {c.estagio_funil && (
                        <div className="mt-1.5">
                          <EtapaBadge etapa={etapaFromEstagio(c.estagio_funil)} className="text-[11px] px-1.5" />
                        </div>
                      )}
                    </div>
                  ))}
                  {outrosContatos.length > 2 && (
                    <button type="button" onClick={() => setShowMoreContatos((v) => !v)} className="text-xs text-brand-500 hover:text-brand-400 transition-colors">
                      {showMoreContatos ? 'Mostrar menos' : 'Mostrar mais'}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="md:pl-6 md:border-l md:border-border space-y-4">
            {/* Próximo contato */}
            <div className="rounded-lg border border-border p-4">
              <div className="flex items-center justify-between gap-2">
                <h4 className="text-sm font-semibold text-content-primary">Próximo Contato</h4>
                {!proximoContato && (
                  <button
                    type="button"
                    onClick={() => {
                      setNovaData((d) => d || hojeISO())
                      setPainel('proximo')
                    }}
                    className="text-xs text-brand-500 hover:text-brand-400"
                  >
                    Agendar
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2 mt-2">
                <span className="text-sm font-mono tabular-nums text-content-primary">
                  {proximoContato ? formatDataBR(proximoContato.data) : 'Indefinido'}
                </span>
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${
                    SITUACAO_BADGE[situacaoAgendamento(proximoContato)]
                  }`}
                >
                  {SITUACAO_LABELS[situacaoAgendamento(proximoContato)]}
                </span>
              </div>

              {proximoContato?.nota && (
                <p className="text-sm text-content-secondary mt-1.5">{proximoContato.nota}</p>
              )}

              {proximoContato && (
                <>
                  <textarea
                    value={resolucao}
                    onChange={(e) => setResolucao(e.target.value)}
                    rows={3}
                    placeholder="O que aconteceu neste contato?"
                    className={`${inputCls} mt-2`}
                  />
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    <Button
                      size="sm"
                      onClick={() => resolverAgendamento(proximoContato.id, 'contatado')}
                      loading={acaoLoading}
                    >
                      Entrou em contato
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => resolverAgendamento(proximoContato.id, 'nao_contatado')}
                      loading={acaoLoading}
                    >
                      Não conseguiu contato
                    </Button>
                  </div>
                </>
              )}
            </div>

            <div className="rounded-lg border border-border p-4">
              <div className="grid grid-cols-3 gap-2">
                {contadores.map((c) => (
                  <div key={c.label}>
                    <p className="text-overline uppercase text-content-tertiary">{c.label}</p>
                    <p className="font-display text-2xl font-semibold text-content-primary leading-tight">{c.valor}</p>
                  </div>
                ))}
              </div>
              <div className="mt-2 max-h-52 overflow-y-auto pr-1 divide-y divide-border">
                {desfechosRecentes.length === 0 ? (
                  <p className="py-3 text-sm text-content-tertiary">Sem desfechos registrados.</p>
                ) : (
                  desfechosRecentes.map((ev, i) => <EventRow key={i} ev={ev} />)
                )}
              </div>
            </div>

            <div className="rounded-lg border border-border p-4">
              <h4 className="text-sm font-semibold text-content-primary mb-1">Histórico</h4>
              <div className="max-h-56 overflow-y-auto pr-1 divide-y divide-border">
                {historico.length === 0 ? (
                  <p className="py-3 text-sm text-content-tertiary">Sem eventos ainda — internações, perdas e anotações aparecem aqui.</p>
                ) : (
                  historico.map((ev, i) => <EventRow key={i} ev={ev} />)
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 pt-3 border-t border-border">
          <div className="text-caption">
            {status === 'saved' && (
              <span className="inline-flex items-center gap-1.5 text-success-600 dark:text-success-500">
                <Check size={13} />
                Salvo
                {sync === 'ok' ? ' · sincronizado com o Chatwoot' : sync === 'failed' ? ' · falha ao sincronizar Chatwoot' : ''}
              </span>
            )}
            {status === 'error' && (
              <span className="inline-flex items-center gap-1.5 text-danger-500">
                <AlertCircle size={13} />
                Erro ao salvar
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={onClose}>
              Fechar
            </Button>
            <Button size="sm" onClick={handleSave} loading={saving}>
              Salvar
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="text-overline uppercase text-content-tertiary mb-1">{label}</p>
      {children}
    </div>
  )
}
