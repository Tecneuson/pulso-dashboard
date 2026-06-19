'use client'

import { Calendar, IdCard, ShieldPlus, Stethoscope } from 'lucide-react'
import type { Paciente } from '@/types'
import { ESTAGIO_REATIVACAO_LABELS } from '@/types'
import { Modal } from '@/components/ui/modal'
import { Badge } from '@/components/ui/badge'
import { REATIVACAO_VARIANT, formatDateBR } from './stage-meta'

interface PacienteDetailProps {
  paciente: Paciente | null
  open: boolean
  onClose: () => void
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-overline uppercase text-content-tertiary mb-0.5">{label}</p>
      <p className="text-sm text-content-primary">{value}</p>
    </div>
  )
}

export function PacienteDetail({ paciente, open, onClose }: PacienteDetailProps) {
  if (!paciente) return null

  return (
    <Modal open={open} onClose={onClose} title="Detalhes do paciente" size="lg">
      <div className="space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h3 className="font-display text-lg font-medium text-content-primary">
              {paciente.nome_cliente}
            </h3>
            <p className="flex items-center gap-1.5 text-caption text-content-tertiary mt-1 font-mono">
              <IdCard size={13} /> #{paciente.identificador_cliente}
            </p>
          </div>
          <Badge variant={REATIVACAO_VARIANT[paciente.estagio_reativacao]}>
            {ESTAGIO_REATIVACAO_LABELS[paciente.estagio_reativacao]}
          </Badge>
        </div>

        <div className="flex flex-wrap gap-2">
          {paciente.classificacao_cliente && <Badge>{paciente.classificacao_cliente}</Badge>}
          {paciente.classificacao_produto && <Badge>{paciente.classificacao_produto}</Badge>}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field
            label="Convênio"
            value={paciente.convenio_raw ?? '—'}
          />
          <div>
            <p className="text-overline uppercase text-content-tertiary mb-0.5">CID</p>
            <p className="flex items-center gap-1.5 text-sm text-content-primary">
              {paciente.cid_codigo ? (
                <>
                  <Stethoscope size={13} className="text-content-tertiary" />
                  {paciente.cid_codigo}
                </>
              ) : (
                '—'
              )}
            </p>
          </div>
          <Field label="Última internação" value={formatDateBR(paciente.data_emissao_max)} />
          <Field label="Primeira internação" value={formatDateBR(paciente.data_emissao_min)} />
          <Field label="Penúltima internação" value={formatDateBR(paciente.penultima_internacao)} />
          <Field label="Sub-família" value={paciente.sub_familia_produto ?? '—'} />
        </div>

        {paciente.observacoes && (
          <div>
            <p className="text-overline uppercase text-content-tertiary mb-1">Observações</p>
            <p className="text-sm text-content-secondary bg-surface-tertiary rounded p-3 whitespace-pre-wrap">
              {paciente.observacoes}
            </p>
          </div>
        )}

        <div className="flex items-center gap-2 text-caption text-content-tertiary pt-1 border-t border-border">
          <Calendar size={13} />
          Importado em {formatDateBR(paciente.created_at)}
          {paciente.mes_rexis && (
            <span className="inline-flex items-center gap-1 ml-auto">
              <ShieldPlus size={13} /> Safra {paciente.mes_rexis}
            </span>
          )}
        </div>
      </div>
    </Modal>
  )
}
