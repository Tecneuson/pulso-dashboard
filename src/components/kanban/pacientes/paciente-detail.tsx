'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { Calendar, Check, IdCard, Loader2, Lock, Phone, ShieldPlus, Stethoscope } from 'lucide-react'
import type { Paciente } from '@/types'
import { ESTAGIO_REATIVACAO_LABELS } from '@/types'
import { formatarCpf } from '@/lib/cpf'
import { Modal } from '@/components/ui/modal'
import { Badge } from '@/components/ui/badge'
import { classificacaoMeta, internacoesConhecidas, formatDateBR } from '@/lib/funil'
import { CaptadorField } from '../captador-field'
import { REATIVACAO_VARIANT } from './stage-meta'

interface PacienteDetailProps {
  paciente: Paciente | null
  open: boolean
  onClose: () => void
}

/** Campo somente-leitura no mesmo visual dos selects do card de lead. Quando o dado
 *  não existe para paciente, fica travado (cadeado + esmaecido). */
function Campo({
  label,
  value,
  icon,
  travado = false,
}: {
  label: string
  value?: string | null
  icon?: ReactNode
  travado?: boolean
}) {
  const temValor = !!value && !travado
  return (
    <div>
      <p className="text-overline uppercase text-content-tertiary mb-1">{label}</p>
      <div
        className={`flex items-center justify-between gap-2 h-10 px-3 rounded border border-border text-sm ${
          travado
            ? 'bg-surface-tertiary/40 text-content-tertiary'
            : 'bg-surface-tertiary text-content-primary'
        }`}
        title={travado ? 'Não disponível para pacientes' : undefined}
      >
        <span className="inline-flex items-center gap-1.5 min-w-0 truncate">
          {icon}
          {temValor ? value : '—'}
        </span>
        {travado && <Lock size={12} className="text-content-tertiary shrink-0" />}
      </div>
    </div>
  )
}

function EventRow({ data, desfecho }: { data: string; desfecho: string }) {
  return (
    <div className="py-2.5">
      <div className="flex items-center gap-3">
        <span className="h-2.5 w-2.5 rounded-full shrink-0 bg-success-500" />
        <span className="text-sm text-content-secondary shrink-0">{data}</span>
        <span className="text-sm text-content-tertiary truncate">HSM</span>
        <span className="ml-auto text-sm font-medium text-right shrink-0 text-success-600 dark:text-success-500">
          {desfecho}
        </span>
      </div>
    </div>
  )
}

export function PacienteDetail({ paciente, open, onClose }: PacienteDetailProps) {
  const [captadorId, setCaptadorId] = useState<string | null>(null)
  const [savingCaptador, setSavingCaptador] = useState(false)
  const [savedCaptador, setSavedCaptador] = useState(false)

  useEffect(() => {
    setCaptadorId(paciente?.consultor_id ?? paciente?.captador_id ?? null)
    setSavedCaptador(false)
  }, [paciente?.id, paciente?.consultor_id, paciente?.captador_id])

  if (!paciente) return null

  const pacienteId = paciente.id
  async function salvarCaptador(id: string | null) {
    setCaptadorId(id)
    setSavingCaptador(true)
    setSavedCaptador(false)
    try {
      const res = await fetch('/api/pacientes', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: pacienteId, consultor_id: id }),
      })
      if (res.ok) setSavedCaptador(true)
    } catch {
      /* ignore */
    } finally {
      setSavingCaptador(false)
    }
  }

  const classif = paciente.classificacao_cliente
    ? classificacaoMeta(paciente.classificacao_cliente)
    : null
  const internacoes = internacoesConhecidas(paciente)

  const contadores = [
    { label: 'Internações', valor: internacoes.length },
    { label: 'Telefones', valor: paciente.telefones?.length ?? 0 },
    { label: 'Convênio', valor: paciente.convenio_raw ? 1 : 0 },
  ]

  return (
    <Modal open={open} onClose={onClose} title="Detalhes do paciente" size="xl">
      <div className="space-y-5">
        {/* Cabeçalho — mesmo layout do card de lead */}
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-overline uppercase text-content-tertiary mb-1">Classificação</p>
            <div className="flex items-center gap-1.5 flex-wrap">
              {classif && (
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-sm text-body-sm font-medium ${classif.badgeClass}`}
                >
                  {classif.label}
                </span>
              )}
              <Badge variant={REATIVACAO_VARIANT[paciente.estagio_reativacao]}>
                {ESTAGIO_REATIVACAO_LABELS[paciente.estagio_reativacao]}
              </Badge>
            </div>
            <h3 className="font-display text-lg font-medium text-content-primary mt-1.5 flex items-center gap-2 min-w-0">
              <span className="truncate">{paciente.nome_cliente}</span>
              <span className="text-content-tertiary font-normal text-sm shrink-0 font-mono">
                #{paciente.identificador_cliente}
              </span>
            </h3>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium border border-border text-content-tertiary shrink-0">
            <Lock size={13} />
            Somente leitura
          </span>
        </div>

        {/* Corpo em 2 colunas — igual ao card de lead */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* ESQUERDA: campos de dados */}
          <div className="md:pr-6 space-y-4">
            <h4 className="text-sm font-semibold text-content-primary">Campos de dados</h4>

            {/* Consultor — único campo editável do paciente (salva na hora) */}
            <div>
              <CaptadorField value={captadorId} onChange={salvarCaptador} />
              {savingCaptador && (
                <p className="text-xs text-content-tertiary mt-1 flex items-center gap-1">
                  <Loader2 size={11} className="animate-spin" /> salvando…
                </p>
              )}
              {savedCaptador && !savingCaptador && (
                <p className="text-xs text-success-600 dark:text-success-500 mt-1 flex items-center gap-1">
                  <Check size={11} /> consultor salvo
                </p>
              )}
            </div>

            <Campo label="Classificação do cliente" value={paciente.classificacao_cliente} />
            <Campo
              label="Estágio de reativação"
              value={ESTAGIO_REATIVACAO_LABELS[paciente.estagio_reativacao]}
            />
            <Campo label="Convênio" value={paciente.convenio_raw} />
            <Campo
              label="CPF"
              value={paciente.cpf ? formatarCpf(paciente.cpf) : null}
              icon={<IdCard size={13} className="text-content-tertiary shrink-0" />}
            />
            <Campo
              label="CID"
              value={paciente.cid_codigo}
              icon={<Stethoscope size={13} className="text-content-tertiary shrink-0" />}
            />
            <Campo label="Sub-família do produto" value={paciente.sub_familia_produto} />

            {/* Campos do funil de leads — não se aplicam a pacientes: travados */}
            <div className="pt-3 border-t border-border space-y-4">
              <p className="text-caption text-content-tertiary flex items-center gap-1.5">
                <Lock size={11} />
                Campos do funil de leads (não se aplicam a pacientes)
              </p>
              <Campo label="Etapa do funil" travado />
              <Campo label="Tipo de contato" travado />
              <Campo label="Assunto" travado />
              <Campo label="Motivo do contato" travado />
              <Campo label="Origem da conversa" travado />
            </div>

            {/* Telefones */}
            <div className="pt-4 border-t border-border">
              <h4 className="text-sm font-semibold text-content-primary mb-3">Telefones</h4>
              {paciente.telefones && paciente.telefones.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {paciente.telefones.map((tel) => (
                    <span
                      key={tel}
                      className="inline-flex items-center gap-1.5 text-sm text-content-primary bg-surface-tertiary rounded px-2 py-1"
                    >
                      <Phone size={12} className="text-content-tertiary" />
                      {tel}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-content-tertiary">Nenhum telefone cadastrado.</p>
              )}
            </div>
          </div>

          {/* DIREITA: contadores + histórico de internações */}
          <div className="md:pl-6 md:border-l md:border-border space-y-4">
            <div className="rounded-lg border border-border p-4">
              <div className="grid grid-cols-3 gap-2">
                {contadores.map((c) => (
                  <div key={c.label}>
                    <p className="text-overline uppercase text-content-tertiary">{c.label}</p>
                    <p className="font-display text-2xl font-semibold text-content-primary leading-tight">
                      {c.valor}
                    </p>
                  </div>
                ))}
              </div>
              <div className="mt-2 max-h-52 overflow-y-auto pr-1 divide-y divide-border">
                {internacoes.length === 0 ? (
                  <p className="py-3 text-sm text-content-tertiary">Sem internações conhecidas.</p>
                ) : (
                  internacoes
                    .slice()
                    .reverse()
                    .map((d) => <EventRow key={d} data={formatDateBR(d)} desfecho="Internação" />)
                )}
              </div>
            </div>

            <div className="rounded-lg border border-border p-4 space-y-2">
              <h4 className="text-sm font-semibold text-content-primary mb-1">Histórico</h4>
              <div className="flex items-center gap-2 text-caption text-content-tertiary">
                <Calendar size={13} />
                Importado em {formatDateBR(paciente.created_at)}
                {paciente.mes_rexis && (
                  <span className="inline-flex items-center gap-1 ml-auto">
                    <ShieldPlus size={13} /> Safra {paciente.mes_rexis}
                  </span>
                )}
              </div>
              {paciente.observacoes && (
                <p className="text-sm text-content-secondary bg-surface-tertiary rounded p-3 whitespace-pre-wrap mt-2">
                  {paciente.observacoes}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Rodapé */}
        <div className="flex items-center justify-between gap-3 pt-3 border-t border-border">
          <span className="text-caption text-content-tertiary inline-flex items-center gap-1.5">
            <Lock size={12} />
            Somente leitura · base de reativação (carrinho mensal)
          </span>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center rounded-md px-3 py-1.5 text-sm font-medium border border-border text-content-secondary hover:bg-surface-tertiary transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </Modal>
  )
}
