'use client'

import { useMemo, useState } from 'react'
import { SlidersHorizontal, X } from 'lucide-react'
import { Button } from '@/components/ui'
import { FUNIL_ETAPA_VAR, type LeadComEtapa } from '@/lib/funil-etapas'
import { useConsultores, useHospitais, useUsuarios } from '@/lib/api-store'
import { AGENDADOS_FILTRO_OPTS } from '@/lib/agendamentos'
import {
  FILTROS_INICIAL,
  OPCOES,
  ORDENACAO_OPTS,
  PERIODO_OPTS,
  contarDimensoesAtivas,
  contarOpcao,
  temFiltroAtivo,
  type FiltrosState,
  type OrdenacaoFunil,
} from '@/lib/filtros'

type Opt = { value: string; label: string }

interface FiltrosProps {
  leads: LeadComEtapa[]
  filtrados: number
  filtros: FiltrosState
  onChange: (f: FiltrosState) => void
}

const DIM_LABEL: Record<string, string> = {
  etapas: 'Etapa',
  convenios: 'Convênio',
  motivos: 'Motivo',
  assuntos: 'Assunto',
  tipos: 'Tipo',
  origens: 'Origem',
  // `captadores` é a dimensão do vínculo direto do lead (coluna consultor_id; nome da
  // dimensão mantido por compatibilidade) — rotulada "Consultor"; `consultores` é o
  // consultor da origem da conversa. Os dois usam a lista unificada `consultores`.
  captadores: 'Consultor',
  consultores: 'Consultor (origem)',
  hospitais: 'Hospital',
  profissionais: 'Profissional',
  motivosPerda: 'Motivo da perda',
  classificacoes: 'Classificação',
  atendentes: 'Agente',
}

// ------------------------------------------------------------
// Átomos
// ------------------------------------------------------------

const SELECT_CLS =
  "w-full h-10 px-3 pr-8 rounded-lg bg-surface-secondary border border-border text-sm text-content-primary transition-colors focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/40 appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2216%22%20height%3D%2216%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%239C9C96%22%20stroke-width%3D%222%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-[length:16px] bg-[right_8px_center] bg-no-repeat"

/** Select simples com rótulo em cima (linha de filtros do header). */
function CampoSelect({
  label,
  value,
  options,
  onChange,
  vazio = 'Todos',
}: {
  label: string
  value: string
  options: Opt[]
  onChange: (v: string) => void
  vazio?: string
}) {
  return (
    <label className="block min-w-0">
      <span className="block text-xs text-content-secondary mb-1 truncate">{label}</span>
      <select className={SELECT_CLS} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">{vazio}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  )
}

/**
 * Select de uma dimensão multi-seleção. Escolher um valor substitui a seleção;
 * quando o painel "Filtros" tem vários marcados, exibe "Vários (N)".
 */
function CampoDimensao({
  label,
  dim,
  options,
  filtros,
  onChange,
}: {
  label: string
  dim: keyof FiltrosState
  options: Opt[]
  filtros: FiltrosState
  onChange: (f: FiltrosState) => void
}) {
  const selecionados = filtros[dim] as string[]
  const varios = selecionados.length > 1

  return (
    <label className="block min-w-0">
      <span className="block text-xs text-content-secondary mb-1 truncate">{label}</span>
      <select
        className={SELECT_CLS}
        value={varios ? '__varios__' : selecionados[0] ?? ''}
        onChange={(e) => {
          const v = e.target.value
          onChange({ ...filtros, [dim]: v && v !== '__varios__' ? [v] : [] })
        }}
      >
        <option value="">Todos</option>
        {varios && <option value="__varios__">Vários ({selecionados.length})</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  )
}

function ToggleChip({
  active,
  onClick,
  children,
  count,
  dot,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
  count?: number
  dot?: string
}) {
  const zero = count === 0 && !active
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
        active
          ? 'bg-brand-500/15 border-brand-500/40 text-brand-700 dark:text-brand-300'
          : 'bg-surface-secondary border-border text-content-secondary hover:border-border-hover hover:text-content-primary'
      } ${zero ? 'opacity-40' : ''}`}
    >
      {dot && <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: dot }} />}
      {children}
      {count !== undefined && (
        <span
          className={`tabular-nums ${
            active ? 'text-brand-600 dark:text-brand-300' : 'text-content-tertiary'
          }`}
        >
          {count}
        </span>
      )}
    </button>
  )
}

function Segmented({
  value,
  onChange,
  options,
}: {
  value: string
  onChange: (v: string) => void
  options: Opt[]
}) {
  return (
    <div className="inline-flex rounded-lg bg-surface-secondary border border-border p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
            value === o.value
              ? 'bg-surface-elevated text-content-primary shadow-card'
              : 'text-content-secondary hover:text-content-primary'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

// Grupo de toggle-chips de uma dimensão, com contagem facetada.
function ChipGroup({
  label,
  dim,
  options,
  filtros,
  leads,
  onChange,
  colorFn,
}: {
  label: string
  dim: keyof FiltrosState
  options: Opt[]
  filtros: FiltrosState
  leads: LeadComEtapa[]
  onChange: (f: FiltrosState) => void
  colorFn?: (value: string) => string | undefined
}) {
  const selecionados = filtros[dim] as string[]

  const comContagem = useMemo(
    () =>
      options
        .map((o) => ({ ...o, count: contarOpcao(leads, filtros, dim, o.value) }))
        .sort((a, b) => {
          const aSel = selecionados.includes(a.value)
          const bSel = selecionados.includes(b.value)
          if (aSel !== bSel) return aSel ? -1 : 1
          return b.count - a.count
        }),
    [options, leads, filtros, dim, selecionados]
  )

  function toggle(value: string) {
    const next = selecionados.includes(value)
      ? selecionados.filter((v) => v !== value)
      : [...selecionados, value]
    onChange({ ...filtros, [dim]: next })
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <p className="text-sm text-content-secondary">{label}</p>
        {selecionados.length > 0 && (
          <button
            type="button"
            onClick={() => onChange({ ...filtros, [dim]: [] })}
            className="text-[11px] text-content-tertiary hover:text-danger-500"
          >
            limpar
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {comContagem.map((o) => (
          <ToggleChip
            key={o.value}
            active={selecionados.includes(o.value)}
            onClick={() => toggle(o.value)}
            count={o.count}
            dot={colorFn?.(o.value)}
          >
            {o.label}
          </ToggleChip>
        ))}
        {options.length === 0 && (
          <p className="text-xs text-content-tertiary">Nenhuma opção cadastrada.</p>
        )}
      </div>
    </div>
  )
}

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-border pt-5 mt-5 first:border-0 first:pt-0 first:mt-0 space-y-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-content-tertiary">{titulo}</p>
      {children}
    </section>
  )
}

// ------------------------------------------------------------
// Componente principal
// ------------------------------------------------------------

export function Filtros({ leads, filtrados, filtros, onChange }: FiltrosProps) {
  const [aberto, setAberto] = useState(false)

  const consultores = useConsultores()
  const hospitais = useHospitais()
  const usuarios = useUsuarios()

  const total = leads.length
  const dimsAtivas = contarDimensoesAtivas(filtros)
  const ativo = temFiltroAtivo(filtros)

  const consultorOpts: Opt[] = consultores.items.filter((c) => c.ativo).map((c) => ({ value: c.id, label: c.nome }))
  const hospitalOpts: Opt[] = hospitais.items.filter((h) => h.ativo).map((h) => ({ value: h.id, label: h.nome }))
  // Lista unificada: o "Consultor" do lead e o "Consultor (origem)" usam o mesmo cadastro.
  const captadorOpts: Opt[] = consultorOpts
  const agenteOpts: Opt[] = usuarios.items.map((u) => ({ value: u.id, label: u.nome }))

  function optionLabel(dim: keyof FiltrosState, value: string): string {
    if (dim === 'consultores') return consultorOpts.find((o) => o.value === value)?.label ?? value
    if (dim === 'hospitais') return hospitalOpts.find((o) => o.value === value)?.label ?? value
    if (dim === 'captadores') return captadorOpts.find((o) => o.value === value)?.label ?? value
    if (dim === 'atendentes') return agenteOpts.find((o) => o.value === value)?.label ?? value
    const list = (OPCOES as Record<string, Opt[]>)[dim as string]
    return list?.find((o) => o.value === value)?.label ?? value
  }

  function setDatePreset(p: FiltrosState['datePreset']) {
    onChange({ ...filtros, datePreset: filtros.datePreset === p ? '' : p })
  }

  // Chips ativos (1 por dimensão)
  const chips: { key: string; label: string; onClear: () => void }[] = []
  for (const dim of Object.keys(DIM_LABEL) as (keyof FiltrosState)[]) {
    const vals = filtros[dim] as string[]
    if (vals.length) {
      const resumo = vals.length === 1 ? optionLabel(dim, vals[0]) : `${optionLabel(dim, vals[0])} +${vals.length - 1}`
      chips.push({
        key: dim as string,
        label: `${DIM_LABEL[dim as string]}: ${resumo}`,
        onClear: () => onChange({ ...filtros, [dim]: [] }),
      })
    }
  }
  if (filtros.datePreset) {
    const dl =
      PERIODO_OPTS.find((p) => p.value === filtros.datePreset)?.label ??
      `${filtros.dataInicio || '…'} — ${filtros.dataFim || '…'}`
    chips.push({
      key: 'data',
      label: dl,
      onClear: () => onChange({ ...filtros, datePreset: '', dataInicio: '', dataFim: '' }),
    })
  }
  if (filtros.urgencia)
    chips.push({
      key: 'urgencia',
      label: filtros.urgencia === 'sim' ? 'Urgente' : 'Não urgente',
      onClear: () => onChange({ ...filtros, urgencia: '' }),
    })
  if (filtros.fonte)
    chips.push({
      key: 'fonte',
      label: filtros.fonte === 'manual' ? 'Lead manual' : 'Lead do banco',
      onClear: () => onChange({ ...filtros, fonte: '' }),
    })
  if (filtros.kids)
    chips.push({
      key: 'kids',
      label: filtros.kids === 'sim' ? 'Kids (8–17)' : 'Adulto',
      onClear: () => onChange({ ...filtros, kids: '' }),
    })

  function limparTudo() {
    onChange({ ...FILTROS_INICIAL })
  }

  const contagem =
    filtrados === total ? (
      <span className="text-content-secondary tabular-nums">{total} leads</span>
    ) : (
      <span className="tabular-nums">
        <span className={`font-medium ${filtrados === 0 ? 'text-warning-500' : 'text-content-primary'}`}>
          {filtrados}
        </span>{' '}
        <span className="text-content-secondary">de {total} leads</span>
      </span>
    )

  return (
    <div className="mb-4 space-y-2">
      {/* Linha de filtros — selects + painel avançado */}
      <div className="flex items-end gap-3">
        <div className="grid flex-1 min-w-0 grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-x-3 gap-y-2">
          <CampoDimensao
            label="Status Atendimento"
            dim="etapas"
            options={OPCOES.etapas}
            filtros={filtros}
            onChange={onChange}
          />
          <CampoDimensao
            label="Classificação do Paciente"
            dim="classificacoes"
            options={OPCOES.classificacoes}
            filtros={filtros}
            onChange={onChange}
          />
          <CampoSelect
            label="Agendados"
            value={filtros.agendado}
            options={AGENDADOS_FILTRO_OPTS.filter((o) => o.value)}
            onChange={(v) => onChange({ ...filtros, agendado: v as FiltrosState['agendado'] })}
          />
          <CampoDimensao
            label="Agente de Atendimento"
            dim="atendentes"
            options={agenteOpts}
            filtros={filtros}
            onChange={onChange}
          />
          <CampoDimensao
            label="Plano de Saúde"
            dim="convenios"
            options={OPCOES.convenios}
            filtros={filtros}
            onChange={onChange}
          />
          <label className="block min-w-0">
            <span className="block text-xs text-content-secondary mb-1 truncate">Ordenar</span>
            <select
              className={SELECT_CLS}
              value={filtros.ordenar}
              onChange={(e) =>
                onChange({ ...filtros, ordenar: e.target.value as OrdenacaoFunil })
              }
            >
              {ORDENACAO_OPTS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="shrink-0 flex flex-col items-end gap-1">
          <span className="text-caption">{contagem}</span>
          <Button variant="secondary" size="sm" onClick={() => setAberto(true)}>
            <SlidersHorizontal size={14} />
            Filtros
            {dimsAtivas > 0 && (
              <span className="ml-1 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-brand-500 text-white text-[11px] font-semibold tabular-nums">
                {dimsAtivas}
              </span>
            )}
          </Button>
        </div>
      </div>

      {/* Chips ativos */}
      {chips.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {chips.map((c) => (
            <span
              key={c.key}
              className="inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-full bg-surface-secondary border border-border text-xs text-content-secondary"
            >
              {c.label}
              <button
                type="button"
                onClick={c.onClear}
                className="rounded-full p-0.5 hover:bg-surface-tertiary text-content-tertiary hover:text-content-primary"
                aria-label={`Remover ${c.label}`}
              >
                <X size={12} />
              </button>
            </span>
          ))}
          <button type="button" onClick={limparTudo} className="text-xs text-content-secondary hover:text-danger-500">
            Limpar tudo
          </button>
        </div>
      )}

      {/* Drawer */}
      {aberto && (
        <div className="fixed inset-0 z-50 flex justify-end animate-fade-in">
          <div className="absolute inset-0 bg-black/30" onClick={() => setAberto(false)} />
          <div className="relative w-full max-w-[400px] h-full bg-surface-elevated border-l border-border shadow-modal flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between gap-2 px-5 py-4 border-b border-border shrink-0">
              <div className="flex items-baseline gap-2">
                <h2 className="font-display text-lg font-medium text-content-primary">Filtros</h2>
                <span className="text-caption">{contagem}</span>
              </div>
              <div className="flex items-center gap-2">
                {ativo && (
                  <button type="button" onClick={limparTudo} className="text-xs text-content-secondary hover:text-danger-500">
                    Limpar tudo
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setAberto(false)}
                  className="p-1 rounded hover:bg-surface-tertiary text-content-tertiary"
                  aria-label="Fechar filtros"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Corpo */}
            <div className="flex-1 min-h-0 overflow-y-auto px-5 py-5">
              <Secao titulo="Período">
                <div className="flex flex-wrap items-center gap-1.5">
                  {PERIODO_OPTS.map((p) => (
                    <ToggleChip
                      key={p.value}
                      active={filtros.datePreset === p.value}
                      onClick={() => setDatePreset(p.value)}
                    >
                      {p.label}
                    </ToggleChip>
                  ))}
                </div>
                {filtros.datePreset === 'custom' && (
                  <div className="flex items-center gap-2 mt-2">
                    <input
                      type="date"
                      value={filtros.dataInicio}
                      onChange={(e) => onChange({ ...filtros, dataInicio: e.target.value })}
                      className="flex-1 h-9 rounded bg-surface-tertiary border border-border text-sm px-2 text-content-primary focus:outline-none focus:ring-2 focus:ring-brand-500/40"
                    />
                    <span className="text-content-tertiary text-xs">até</span>
                    <input
                      type="date"
                      value={filtros.dataFim}
                      onChange={(e) => onChange({ ...filtros, dataFim: e.target.value })}
                      className="flex-1 h-9 rounded bg-surface-tertiary border border-border text-sm px-2 text-content-primary focus:outline-none focus:ring-2 focus:ring-brand-500/40"
                    />
                  </div>
                )}
              </Secao>

              <Secao titulo="Essencial">
                <ChipGroup
                  label="Etapa"
                  dim="etapas"
                  options={OPCOES.etapas}
                  filtros={filtros}
                  leads={leads}
                  onChange={onChange}
                  colorFn={(v) => FUNIL_ETAPA_VAR[v as keyof typeof FUNIL_ETAPA_VAR]}
                />
                <div>
                  <p className="text-sm text-content-secondary mb-1.5">Urgência</p>
                  <Segmented
                    value={filtros.urgencia}
                    onChange={(v) => onChange({ ...filtros, urgencia: v as FiltrosState['urgencia'] })}
                    options={[
                      { value: '', label: 'Todos' },
                      { value: 'sim', label: 'Urgente' },
                      { value: 'nao', label: 'Não' },
                    ]}
                  />
                </div>
                <ChipGroup label="Convênio" dim="convenios" options={OPCOES.convenios} filtros={filtros} leads={leads} onChange={onChange} />
              </Secao>

              <Secao titulo="Perfil do lead">
                <div>
                  <p className="text-sm text-content-secondary mb-1.5">Faixa etária</p>
                  <Segmented
                    value={filtros.kids}
                    onChange={(v) => onChange({ ...filtros, kids: v as FiltrosState['kids'] })}
                    options={[
                      { value: '', label: 'Todos' },
                      { value: 'sim', label: 'Kids (8–17)' },
                      { value: 'nao', label: 'Adulto' },
                    ]}
                  />
                </div>
                <ChipGroup label="Motivo do contato" dim="motivos" options={OPCOES.motivos} filtros={filtros} leads={leads} onChange={onChange} />
                <ChipGroup label="Assunto" dim="assuntos" options={OPCOES.assuntos} filtros={filtros} leads={leads} onChange={onChange} />
                <ChipGroup label="Tipo de contato" dim="tipos" options={OPCOES.tipos} filtros={filtros} leads={leads} onChange={onChange} />
              </Secao>

              <Secao titulo="Origem & pessoas">
                <ChipGroup label="Agente de atendimento" dim="atendentes" options={agenteOpts} filtros={filtros} leads={leads} onChange={onChange} />
                <ChipGroup label="Origem da conversa" dim="origens" options={OPCOES.origens} filtros={filtros} leads={leads} onChange={onChange} />
                <ChipGroup label="Consultor" dim="captadores" options={captadorOpts} filtros={filtros} leads={leads} onChange={onChange} />
                <ChipGroup label="Consultor (origem)" dim="consultores" options={consultorOpts} filtros={filtros} leads={leads} onChange={onChange} />
                <ChipGroup label="Hospital" dim="hospitais" options={hospitalOpts} filtros={filtros} leads={leads} onChange={onChange} />
                <ChipGroup label="Tipo de profissional" dim="profissionais" options={OPCOES.profissionais} filtros={filtros} leads={leads} onChange={onChange} />
              </Secao>

              <Secao titulo="Motivo da perda">
                <ChipGroup label="Motivo da perda" dim="motivosPerda" options={OPCOES.motivosPerda} filtros={filtros} leads={leads} onChange={onChange} />
              </Secao>

              <Secao titulo="Classificação do paciente">
                <ChipGroup label="Classificação" dim="classificacoes" options={OPCOES.classificacoes} filtros={filtros} leads={leads} onChange={onChange} />
              </Secao>

              <Secao titulo="Fonte">
                <Segmented
                  value={filtros.fonte}
                  onChange={(v) => onChange({ ...filtros, fonte: v as FiltrosState['fonte'] })}
                  options={[
                    { value: '', label: 'Todos' },
                    { value: 'manual', label: 'Manual' },
                    { value: 'banco', label: 'Banco' },
                  ]}
                />
              </Secao>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between gap-2 px-5 py-3 border-t border-border shrink-0">
              <button
                type="button"
                onClick={limparTudo}
                className="text-xs text-content-secondary hover:text-danger-500 disabled:opacity-40"
                disabled={!ativo}
              >
                Limpar tudo
              </button>
              <Button size="sm" onClick={() => setAberto(false)}>
                Ver {filtrados} {filtrados === 1 ? 'lead' : 'leads'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
