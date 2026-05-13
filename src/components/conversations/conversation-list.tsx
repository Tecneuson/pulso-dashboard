'use client'

import { useMemo, useState } from 'react'
import { Search, ExternalLink, MessageCircle, Check, X } from 'lucide-react'
import { Input, StageBadge } from '@/components/ui'
import { CardDetail } from '@/components/kanban/card-detail'
import type { Triagem, EstagioFunil } from '@/types'

interface ConversationListProps {
  triagens: Triagem[]
  chatwootBaseUrl?: string
}

export function ConversationList({ triagens, chatwootBaseUrl }: ConversationListProps) {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'concluidas' | 'em_andamento' | 'transbordadas'>(
    'all'
  )
  const [selected, setSelected] = useState<Triagem | null>(null)

  const filtered = useMemo(() => {
    return triagens.filter((t) => {
      if (filter === 'concluidas' && !t.triagem_concluida) return false
      if (filter === 'em_andamento' && t.triagem_concluida) return false
      if (filter === 'transbordadas' && !t.transbordado) return false
      if (search) {
        const q = search.toLowerCase()
        const hay = [
          t.contact_name,
          t.email,
          t.phone,
          t.observacoes,
          t.conversation_id,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [triagens, search, filter])

  return (
    <>
      <div className="flex flex-col md:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-content-tertiary"
          />
          <Input
            placeholder="Buscar conversa..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex rounded-lg bg-surface-secondary border border-border p-0.5">
          {([
            ['all', 'Todas'],
            ['em_andamento', 'Em andamento'],
            ['concluidas', 'Concluídas'],
            ['transbordadas', 'Transbordadas'],
          ] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                filter === key
                  ? 'bg-surface-elevated text-content-primary shadow-card'
                  : 'text-content-secondary hover:text-content-primary'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="text-xs text-content-tertiary mb-2 tabular-nums">
        {filtered.length} {filtered.length === 1 ? 'conversa' : 'conversas'}
      </div>

      <div className="space-y-2">
        {filtered.length === 0 && (
          <div className="bg-surface-secondary border border-border rounded-lg p-8 text-center text-content-tertiary text-sm">
            Nenhuma conversa encontrada
          </div>
        )}
        {filtered.map((t) => {
          const stage = (t.estagio_funil ?? 'novo_contato') as EstagioFunil
          const chatwootUrl =
            chatwootBaseUrl && t.conversation_id
              ? `${chatwootBaseUrl}/app/accounts/1/conversations/${t.conversation_id}`
              : null

          return (
            <div
              key={t.id}
              className="bg-surface-secondary border border-border rounded-lg p-4 hover:border-border-hover hover:shadow-card-hover transition-all cursor-pointer"
              onClick={() => setSelected(t)}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  <div className="w-10 h-10 rounded-full bg-brand-500/10 flex items-center justify-center shrink-0">
                    <MessageCircle size={18} className="text-brand-500" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-content-primary truncate">
                        {t.contact_name ?? 'Sem nome'}
                      </span>
                      <span className="text-[11px] font-mono text-content-tertiary tabular-nums">
                        #{t.conversation_id ?? '—'}
                      </span>
                    </div>
                    <p className="text-xs text-content-secondary truncate">
                      {t.observacoes ?? 'Sem observações'}
                    </p>
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <StageBadge stage={stage} />
                      {t.triagem_concluida && (
                        <span className="inline-flex items-center gap-1 text-[11px] text-success-500">
                          <Check size={11} />
                          Triagem concluída
                        </span>
                      )}
                      {!t.triagem_concluida && (
                        <span className="inline-flex items-center gap-1 text-[11px] text-warning-500">
                          <X size={11} />
                          Em andamento
                        </span>
                      )}
                      {t.transbordado && (
                        <span className="inline-flex items-center gap-1 text-[11px] text-info-500">
                          → Atendente
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <span className="text-[11px] text-content-tertiary tabular-nums">
                    {new Date(t.updated_at).toLocaleDateString('pt-BR', {
                      day: '2-digit',
                      month: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                  {chatwootUrl && (
                    <a
                      href={chatwootUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="flex items-center gap-1 text-[11px] text-brand-500 hover:text-brand-400 transition-colors"
                    >
                      Abrir
                      <ExternalLink size={10} />
                    </a>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <CardDetail
        triagem={selected}
        open={!!selected}
        onClose={() => setSelected(null)}
        chatwootBaseUrl={chatwootBaseUrl}
      />
    </>
  )
}
