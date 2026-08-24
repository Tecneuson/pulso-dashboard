'use client'

import { useEffect, useMemo, useState } from 'react'
import { Search, Download, Phone, Mail } from 'lucide-react'
import { Input, Select, Button, EtapaBadge } from '@/components/ui'
import { CardDetail } from '@/components/kanban/card-detail'
import type { Triagem, TriagemLead } from '@/types'
import { ASSUNTO_LABELS, MOTIVO_CONTATO, MOTIVO_CONTATO_LABELS, TIPO_CONTATO_LABELS } from '@/types'
import { comEtapa, etapaFromEstagio, FUNIL_ETAPA_OPTIONS } from '@/lib/funil-etapas'
import { PLANO_LABELS } from '@/lib/chatwoot/mapping'
import { CONVENIO_FILTRO } from '@/lib/funil'

const planoLabels: Record<string, string> = PLANO_LABELS
const motivoLabels: Record<string, string> = MOTIVO_CONTATO_LABELS
const assuntoLabels: Record<string, string> = ASSUNTO_LABELS

function toCsv(rows: Triagem[]): string {
  const headers = [
    'nome',
    'email',
    'telefone',
    'assunto',
    'motivo',
    'tipo_contato',
    'para_quem',
    'plano',
    'forma_internacao',
    'estagio',
    'status',
    'triagem_concluida',
    'transbordado',
    'created_at',
  ]
  const lines = rows.map((r) =>
    [
      r.contact_name ?? '',
      r.email ?? '',
      r.phone ?? '',
      r.assunto ?? '',
      r.motivo_contato ?? '',
      r.tipo_contato ?? '',
      r.para_quem ?? '',
      r.plano_saude ?? '',
      r.forma_internacao ?? '',
      r.estagio_funil ?? '',
      r.status ?? '',
      String(r.triagem_concluida ?? false),
      String(r.transbordado ?? false),
      r.created_at,
    ]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(',')
  )
  return [headers.join(','), ...lines].join('\n')
}

interface ContactsTableProps {
  triagens: Triagem[]
  initialSearch?: string
}

export function ContactsTable({ triagens, initialSearch = '' }: ContactsTableProps) {
  const [search, setSearch] = useState(initialSearch)
  const [stage, setStage] = useState<string>('')
  const [plano, setPlano] = useState<string>('')
  const [motivo, setMotivo] = useState<string>('')
  const [selected, setSelected] = useState<Triagem | null>(null)
  const [rows, setRows] = useState<Triagem[]>(triagens)
  useEffect(() => setRows(triagens), [triagens])
  const selectedLead = selected ? comEtapa(selected) : null

  const filtered = useMemo(() => {
    return rows.filter((t) => {
      if (stage && etapaFromEstagio(t.estagio_funil) !== stage) return false
      if (plano && t.plano_saude !== plano) return false
      if (motivo && t.motivo_contato !== motivo) return false
      if (search) {
        const q = search.toLowerCase()
        const hay = [
          t.contact_name,
          t.email,
          t.phone,
          t.observacoes,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [rows, search, stage, plano, motivo])

  function handleExport() {
    const csv = toCsv(filtered)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `contatos-hsm-${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <>
      <div className="flex flex-col md:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-content-tertiary"
          />
          <Input
            placeholder="Buscar por nome, email, telefone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select
          value={stage}
          onChange={(e) => setStage(e.target.value)}
          options={[{ value: '', label: 'Todas as etapas' }, ...FUNIL_ETAPA_OPTIONS]}
        />
        <Select
          value={plano}
          onChange={(e) => setPlano(e.target.value)}
          options={[
            { value: '', label: 'Todos os convênios' },
            ...CONVENIO_FILTRO.flatMap((c) => c.leadSlugs.map((v) => ({ value: v, label: c.label }))),
          ]}
        />
        <Select
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          options={[
            { value: '', label: 'Todos os motivos' },
            ...MOTIVO_CONTATO.map((v) => ({ value: v, label: motivoLabels[v] })),
          ]}
        />
        <Button variant="secondary" size="md" onClick={handleExport}>
          <Download size={14} />
          CSV
        </Button>
      </div>

      <div className="text-xs text-content-tertiary mb-2 tabular-nums">
        {filtered.length} {filtered.length === 1 ? 'contato' : 'contatos'}
      </div>

      <div className="bg-surface-secondary border border-border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface-tertiary text-content-tertiary text-xs uppercase tracking-wide">
                <th className="text-left font-medium px-4 py-2.5">Nome</th>
                <th className="text-left font-medium px-4 py-2.5">Contato</th>
                <th className="text-left font-medium px-4 py-2.5">Categoria</th>
                <th className="text-left font-medium px-4 py-2.5">Assunto</th>
                <th className="text-left font-medium px-4 py-2.5">Motivo</th>
                <th className="text-left font-medium px-4 py-2.5">Convênio</th>
                <th className="text-left font-medium px-4 py-2.5">Estágio</th>
                <th className="text-left font-medium px-4 py-2.5">Data</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center text-content-tertiary py-8">
                    Nenhum contato encontrado
                  </td>
                </tr>
              )}
              {filtered.map((t) => {
                return (
                  <tr
                    key={t.id}
                    onClick={() => setSelected(t)}
                    className="border-t border-border hover:bg-surface-tertiary cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3 font-medium text-content-primary">
                      {t.contact_name ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-content-secondary">
                      <div className="flex flex-col gap-0.5">
                        {t.phone && (
                          <span className="flex items-center gap-1 text-xs">
                            <Phone size={11} className="text-content-tertiary" />
                            {t.phone}
                          </span>
                        )}
                        {t.email && (
                          <span className="flex items-center gap-1 text-xs">
                            <Mail size={11} className="text-content-tertiary" />
                            {t.email}
                          </span>
                        )}
                        {!t.phone && !t.email && '—'}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-content-secondary">
                      {t.tipo_contato ? TIPO_CONTATO_LABELS[t.tipo_contato] ?? t.tipo_contato : '—'}
                      {t.kids && <span className="ml-1 text-[10px] uppercase text-info-600">Kids</span>}
                    </td>
                    <td className="px-4 py-3 text-content-secondary">
                      {t.assunto ? assuntoLabels[t.assunto] ?? t.assunto : '—'}
                    </td>
                    <td className="px-4 py-3 text-content-secondary">
                      {t.motivo_contato ? motivoLabels[t.motivo_contato] ?? t.motivo_contato : '—'}
                    </td>
                    <td className="px-4 py-3 text-content-secondary">
                      {t.plano_saude
                        ? planoLabels[t.plano_saude] ?? t.plano_saude
                        : t.forma_internacao === 'particular'
                        ? 'Particular'
                        : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <EtapaBadge etapa={etapaFromEstagio(t.estagio_funil)} />
                    </td>
                    <td className="px-4 py-3 text-content-tertiary text-xs tabular-nums">
                      {new Date(t.created_at).toLocaleDateString('pt-BR', {
                        day: '2-digit',
                        month: '2-digit',
                        year: '2-digit',
                      })}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <CardDetail
        triagem={selectedLead}
        open={!!selected}
        onClose={() => setSelected(null)}
        onSaved={(u: TriagemLead) => {
          setRows((prev) => prev.map((r) => (r.id === u.id ? u : r)))
          setSelected(u)
        }}
      />
    </>
  )
}
