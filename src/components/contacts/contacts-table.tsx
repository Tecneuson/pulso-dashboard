'use client'

import { useMemo, useState } from 'react'
import { Search, Download, Phone, Mail } from 'lucide-react'
import { Input, Select, Button, StageBadge } from '@/components/ui'
import { CardDetail } from '@/components/kanban/card-detail'
import { ESTAGIO_FUNIL_LABELS } from '@/types'
import type { Triagem, EstagioFunil } from '@/types'

const planoLabels: Record<string, string> = {
  amil: 'Amil',
  bradesco_saude: 'Bradesco Saúde',
  omint: 'Omint',
  prevent_senior: 'Prevent Sênior',
  sulamerica: 'SulAmérica',
}

const motivoLabels: Record<string, string> = {
  transtorno_mental_adulto: 'Transtorno mental adulto',
  transtorno_mental_infantojuvenil: 'Transtorno infantojuvenil',
  abuso_de_substancias: 'Abuso de substâncias',
}

const assuntoLabels: Record<string, string> = {
  internacao: 'Internação',
  consulta: 'Consulta',
  informacao_paciente: 'Informação',
  administrativo: 'Administrativo',
  outros: 'Outros',
}

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

  const filtered = useMemo(() => {
    return triagens.filter((t) => {
      if (stage && (t.estagio_funil ?? 'novo_contato') !== stage) return false
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
  }, [triagens, search, stage, plano, motivo])

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
          options={[
            { value: '', label: 'Todos os estágios' },
            ...Object.entries(ESTAGIO_FUNIL_LABELS).map(([v, l]) => ({
              value: v,
              label: l,
            })),
          ]}
        />
        <Select
          value={plano}
          onChange={(e) => setPlano(e.target.value)}
          options={[
            { value: '', label: 'Todos os convênios' },
            ...Object.entries(planoLabels).map(([v, l]) => ({ value: v, label: l })),
          ]}
        />
        <Select
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          options={[
            { value: '', label: 'Todos os motivos' },
            ...Object.entries(motivoLabels).map(([v, l]) => ({ value: v, label: l })),
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
                  <td colSpan={7} className="text-center text-content-tertiary py-8">
                    Nenhum contato encontrado
                  </td>
                </tr>
              )}
              {filtered.map((t) => {
                const stageKey = (t.estagio_funil ?? 'novo_contato') as EstagioFunil
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
                      {t.assunto ? assuntoLabels[t.assunto] : '—'}
                    </td>
                    <td className="px-4 py-3 text-content-secondary">
                      {t.motivo_contato ? motivoLabels[t.motivo_contato] : '—'}
                    </td>
                    <td className="px-4 py-3 text-content-secondary">
                      {t.plano_saude
                        ? planoLabels[t.plano_saude] ?? t.plano_saude
                        : t.forma_internacao === 'particular'
                        ? 'Particular'
                        : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <StageBadge stage={stageKey} />
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
        triagem={selected}
        open={!!selected}
        onClose={() => setSelected(null)}
        onSaved={(t) => setSelected(t)}
      />
    </>
  )
}
