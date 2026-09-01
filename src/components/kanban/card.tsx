'use client'

import { useDraggable } from '@dnd-kit/core'
import { ExternalLink } from 'lucide-react'
import { MOTIVO_PERDA_LABELS, TIPO_CONTATO_LABELS } from '@/types'
import { formatarCpf } from '@/lib/cpf'
import { classificacaoMeta } from '@/lib/funil'
import { situacaoAgendamento } from '@/lib/agendamentos'
import { FUNIL_ETAPA_VAR, type LeadComEtapa } from '@/lib/funil-etapas'
import { PLANO_LABELS } from '@/lib/chatwoot/mapping'
import { chatwootLinkDoLead } from '@/lib/chatwoot/urls'
import { isKids } from '@/lib/idade'
import { CardBase, type CardBadge } from './card-base'
import { useFunilDados } from './funil-dados'

interface KanbanCardProps {
  triagem: LeadComEtapa
  onClick?: () => void
  isDragOverlay?: boolean
}

const tipoContatoLabels: Record<string, string> = TIPO_CONTATO_LABELS

function convenioDoLead(t: LeadComEtapa): string {
  if (t.plano_saude) return PLANO_LABELS[t.plano_saude] ?? t.plano_saude
  if (t.paciente?.convenio_raw) return t.paciente.convenio_raw
  if (t.forma_internacao === 'particular') return 'Particular'
  return 'Sem convênio'
}

export function KanbanCard({ triagem, onClick, isDragOverlay }: KanbanCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: triagem.id,
  })
  const dados = useFunilDados()

  const isUrgent =
    triagem.observacoes?.toLowerCase().includes('urgente') ||
    triagem.observacoes?.toLowerCase().includes('crise')

  const classif = triagem.paciente?.classificacao_cliente
    ? classificacaoMeta(triagem.paciente.classificacao_cliente)
    : null

  const badges: CardBadge[] = [
    {
      label: triagem.tipo_contato
        ? tipoContatoLabels[triagem.tipo_contato] ?? triagem.tipo_contato
        : 'Lead',
    },
  ]
  // Kids: derivado da data de nascimento (8–17 anos) — vale mesmo antes da migration.
  if (triagem.kids === true || (triagem.kids == null && isKids(triagem.data_nascimento) === true)) {
    badges.push({
      label: 'Kids',
      className: 'bg-info-500/12 text-info-700 dark:text-info-500 border border-info-500/25',
    })
  }
  if (classif) badges.push({ label: classif.label, className: classif.badgeClass })
  if (!triagem.conversation_id) {
    badges.push({
      label: 'Manual',
      className: 'bg-brand-500/12 text-brand-700 dark:text-brand-400 border border-brand-500/25',
    })
  }
  if (isUrgent) {
    badges.push({
      label: 'Urgente',
      className: 'bg-danger-500/12 text-danger-700 dark:text-danger-500 border border-danger-500/25',
    })
  }

  // Contatos associados: os leads conciliados ao mesmo paciente (o próprio incluso).
  const associados = dados.leadsDoPaciente(triagem.paciente_id)
  const contatos = (associados.length ? associados : [triagem])
    .map((l) => l.contact_name)
    .filter((n): n is string => !!n)
  const contatosUnicos = Array.from(new Set(contatos))

  const internacoes = triagem.paciente
    ? [
        triagem.paciente.data_emissao_min,
        triagem.paciente.penultima_internacao,
        triagem.paciente.data_emissao_max,
      ].filter((d, i, arr) => !!d && arr.indexOf(d) === i).length
    : 0
  const base = associados.length ? associados : [triagem]
  const contadores = {
    internacoes: internacoes + base.filter((l) => l.etapa === 'internacao').length,
    perdas: base.filter((l) => l.etapa === 'perdido' || !!l.motivo_perda).length,
    conversas: base.filter((l) => !!l.conversation_id).length,
  }

  const agendamento = dados.proximoDoLead(triagem.id)
  const cpf = triagem.cpf ?? triagem.paciente?.cpf ?? null

  const accent = isUrgent ? 'var(--stage-recusou)' : FUNIL_ETAPA_VAR[triagem.etapa]
  const linkChatwoot = chatwootLinkDoLead(triagem)

  return (
    <CardBase
      ref={!isDragOverlay ? setNodeRef : undefined}
      {...(!isDragOverlay ? { ...attributes, ...listeners } : {})}
      onClick={onClick}
      style={transform ? { transform: `translate(${transform.x}px, ${transform.y}px)` } : undefined}
      className={`cursor-grab active:cursor-grabbing ${isDragging ? 'opacity-30' : ''} ${
        isDragOverlay ? 'shadow-elevated scale-[1.02] cursor-grabbing' : ''
      } ${isUrgent ? 'ring-1 ring-danger-500/30' : ''}`}
      accent={accent}
      badges={badges}
      nome={triagem.contact_name ?? triagem.paciente?.nome_cliente ?? 'Sem nome'}
      contatoPrincipal={triagem.contato_principal ?? null}
      documento={cpf ? formatarCpf(cpf) : null}
      convenio={convenioDoLead(triagem)}
      contatos={contatosUnicos}
      agente={dados.nomeAgente(triagem.atendente_id)}
      contadores={contadores}
      proximo={{
        data: agendamento?.data ?? null,
        nota: agendamento?.nota ?? null,
        situacao: situacaoAgendamento(agendamento),
      }}
      extra={
        <>
          {triagem.etapa === 'perdido' && triagem.motivo_perda && (
            <p className="mt-2 text-[11px] text-danger-600 dark:text-danger-500 truncate">
              Perda: {MOTIVO_PERDA_LABELS[triagem.motivo_perda] ?? triagem.motivo_perda}
            </p>
          )}
          {linkChatwoot && !isDragOverlay && (
            <a
              href={linkChatwoot.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
              className="mt-2 inline-flex items-center gap-1 text-[11px] text-brand-500 hover:text-brand-400"
              title={linkChatwoot.tipo === 'conversa' ? 'Abrir a conversa no Chatwoot' : 'Abrir o contato no Chatwoot'}
            >
              <ExternalLink size={11} />
              {linkChatwoot.tipo === 'conversa' ? 'Conversa no Chatwoot' : 'Contato no Chatwoot'}
            </a>
          )}
        </>
      }
    />
  )
}
