'use client'

import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'
import type { Paciente } from '@/types'
import { ESTAGIO_REATIVACAO_LABELS } from '@/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { REATIVACAO_VARIANT, formatDateBR } from './stage-meta'
import { PacienteDetail } from './paciente-detail'

const PAGE_SIZE = 50

interface PacientesTableProps {
  q: string
  classificacao: string
  convenio: string
}

export function PacientesTable({ q, classificacao, convenio }: PacientesTableProps) {
  const [rows, setRows] = useState<Paciente[]>([])
  const [count, setCount] = useState(0)
  const [offset, setOffset] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<Paciente | null>(null)

  useEffect(() => {
    let active = true
    setLoading(true)
    const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(offset) })
    if (q) params.set('q', q)
    if (classificacao) params.set('classificacao', classificacao)
    if (convenio) params.set('convenio', convenio)

    fetch(`/api/pacientes?${params}`)
      .then((r) => r.json())
      .then((data) => {
        if (!active) return
        if (data.error) {
          setError(data.error)
          return
        }
        setError(null)
        setRows(data.rows)
        setCount(data.count)
      })
      .catch((e) => active && setError(String(e)))
      .finally(() => active && setLoading(false))

    return () => {
      active = false
    }
  }, [q, classificacao, convenio, offset])

  const from = count === 0 ? 0 : offset + 1
  const to = Math.min(offset + PAGE_SIZE, count)

  return (
    <div className="bg-surface-secondary border border-border rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border-strong text-left">
              <th className="px-4 py-2.5 text-overline uppercase text-content-tertiary font-semibold">Paciente</th>
              <th className="px-4 py-2.5 text-overline uppercase text-content-tertiary font-semibold">Convênio</th>
              <th className="px-4 py-2.5 text-overline uppercase text-content-tertiary font-semibold">Classificação</th>
              <th className="px-4 py-2.5 text-overline uppercase text-content-tertiary font-semibold">Última intern.</th>
              <th className="px-4 py-2.5 text-overline uppercase text-content-tertiary font-semibold">CID</th>
              <th className="px-4 py-2.5 text-overline uppercase text-content-tertiary font-semibold">Estágio</th>
            </tr>
          </thead>
          <tbody>
            {error && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-danger-500">
                  {error}
                </td>
              </tr>
            )}
            {!error && rows.length === 0 && !loading && (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-sm text-content-tertiary">
                  Nenhum paciente encontrado.
                </td>
              </tr>
            )}
            {rows.map((p) => (
              <tr
                key={p.id}
                onClick={() => setSelected(p)}
                className="border-b border-border last:border-0 hover:bg-surface-tertiary cursor-pointer transition-colors"
              >
                <td className="px-4 py-2.5">
                  <span className="font-medium text-content-primary">{p.nome_cliente}</span>
                  <span className="block text-caption text-content-tertiary font-mono">
                    #{p.identificador_cliente}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-content-secondary max-w-[200px] truncate">
                  {p.convenio_raw ?? '—'}
                </td>
                <td className="px-4 py-2.5 text-content-secondary">{p.classificacao_cliente ?? '—'}</td>
                <td className="px-4 py-2.5 text-content-secondary font-mono tabular-nums">
                  {formatDateBR(p.data_emissao_max)}
                </td>
                <td className="px-4 py-2.5 text-content-secondary font-mono">{p.cid_codigo ?? '—'}</td>
                <td className="px-4 py-2.5">
                  <Badge variant={REATIVACAO_VARIANT[p.estagio_reativacao]}>
                    {ESTAGIO_REATIVACAO_LABELS[p.estagio_reativacao]}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pager */}
      <div className="flex items-center justify-between gap-4 px-4 py-3 border-t border-border">
        <p className="text-caption text-content-tertiary tabular-nums">
          {loading ? (
            <span className="inline-flex items-center gap-1.5">
              <Loader2 size={12} className="animate-spin" /> Carregando…
            </span>
          ) : (
            <>
              {from.toLocaleString('pt-BR')}–{to.toLocaleString('pt-BR')} de{' '}
              {count.toLocaleString('pt-BR')}
            </>
          )}
        </p>
        <div className="flex items-center gap-1.5">
          <Button
            variant="secondary"
            size="sm"
            disabled={offset === 0 || loading}
            onClick={() => setOffset((o) => Math.max(0, o - PAGE_SIZE))}
          >
            <ChevronLeft size={14} /> Anterior
          </Button>
          <Button
            variant="secondary"
            size="sm"
            disabled={to >= count || loading}
            onClick={() => setOffset((o) => o + PAGE_SIZE)}
          >
            Próxima <ChevronRight size={14} />
          </Button>
        </div>
      </div>

      <PacienteDetail paciente={selected} open={!!selected} onClose={() => setSelected(null)} />
    </div>
  )
}
