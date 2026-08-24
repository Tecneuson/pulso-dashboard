import { Suspense } from 'react'
import { Header } from '@/components/layout/header'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui'
import { KpiCard } from '@/components/metrics/kpi-card'
import { BarChart } from '@/components/metrics/bar-chart'
import { FiltrosBI } from '@/components/reports/filtros-bi'
import { createClient } from '@/lib/supabase/server'
import { requireGestor } from '@/lib/auth'
import { chatwootConfigured, contarConversasPorStatus } from '@/lib/chatwoot/client'
import {
  contar,
  motivosDePerda,
  pipeline,
  porCategoria,
  porFormaInternacao,
  porOrigem,
  porPerfil,
  resolverFiltros,
  statusConversas,
  STATUS_CHATWOOT_LABELS,
  taxaConversao,
  type Linha,
} from '@/lib/bi'
import { CLASSIFICACAO_FUNIL, CLASSIFICACAO_INTERNADO, CLASSIFICACAO_LABELS, type Triagem } from '@/types'
import type { UsuarioResumo } from '@/lib/api-store'

export const revalidate = 0

interface PageProps {
  searchParams: Promise<Record<string, string | undefined>>
}

function EmptyChart({ message = 'Sem dados no período' }: { message?: string }) {
  return <p className="text-sm text-content-tertiary py-10 text-center">{message}</p>
}

const th = 'text-left font-medium px-3 py-2 text-xs uppercase tracking-wide text-content-tertiary'
const td = 'px-3 py-2 tabular-nums'

function TabelaContagens({ linhas, primeiraColuna }: { linhas: Linha[]; primeiraColuna: string }) {
  if (!linhas.length) return <EmptyChart />
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-surface-tertiary">
            <th className={th}>{primeiraColuna}</th>
            <th className={`${th} text-right`}>Contatos</th>
            <th className={`${th} text-right`}>Conversas</th>
            <th className={`${th} text-right`}>Internações</th>
            <th className={`${th} text-right`}>Perdas</th>
            <th className={`${th} text-right`}>Conversão</th>
            <th className={th}>Motivos de perda</th>
          </tr>
        </thead>
        <tbody>
          {linhas.map((l) => (
            <tr key={l.chave} className="border-t border-border align-top">
              <td className={`${td} font-medium text-content-primary`}>{l.label}</td>
              <td className={`${td} text-right`}>{l.contatos}</td>
              <td className={`${td} text-right`}>{l.conversas}</td>
              <td className={`${td} text-right text-success-600 dark:text-success-500`}>{l.internacoes}</td>
              <td className={`${td} text-right text-danger-600 dark:text-danger-500`}>{l.perdas}</td>
              <td className={`${td} text-right`}>{l.taxa}%</td>
              <td className={`${td} text-xs text-content-secondary`}>
                {l.motivos && l.motivos.length
                  ? l.motivos.slice(0, 4).map((m) => `${m.label} (${m.count})`).join(' · ') +
                    (l.motivos.length > 4 ? ` · +${l.motivos.length - 4}` : '')
                  : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default async function ReportsPage({ searchParams }: PageProps) {
  await requireGestor()
  const sp = await searchParams
  const filtros = resolverFiltros(sp)
  const supabase = await createClient()

  // Leads no período/atendente (limite alto; o BI roda em memória).
  let query = supabase.from('triagem_hsm').select('*').order('created_at', { ascending: false }).limit(10000)
  if (filtros.de) query = query.gte('created_at', `${filtros.de}T00:00:00`)
  if (filtros.ate) query = query.lte('created_at', `${filtros.ate}T23:59:59.999`)
  if (filtros.atendente) query = query.eq('atendente_id', filtros.atendente)

  const [{ data: leadsData }, { data: usuariosData }, churn, chatwootStatus] = await Promise.all([
    query,
    supabase.from('usuarios').select('id, nome, email, role, ativo').order('nome'),
    // Colunas de churn do funil unificado (classificação do CSV mensal — não depende do período).
    Promise.all(
      [...CLASSIFICACAO_FUNIL, CLASSIFICACAO_INTERNADO].map(async (c) => {
        const { count } = await supabase
          .from('pacientes')
          .select('id', { count: 'exact', head: true })
          .eq('classificacao_cliente', c)
        return { chave: c, label: CLASSIFICACAO_LABELS[c] ?? c, count: count ?? 0 }
      })
    ),
    chatwootConfigured() ? contarConversasPorStatus() : Promise.resolve<Record<string, number> | null>(null),
  ])

  const leads = (leadsData ?? []) as Triagem[]
  const atendentes = (usuariosData ?? []) as UsuarioResumo[]

  const big = contar(leads)
  const motivos = motivosDePerda(leads)
  const origens = porOrigem(leads)
  const forma = porFormaInternacao(leads)
  const etapas = pipeline(leads)
  const perfil = porPerfil(leads)
  const categorias = porCategoria(leads)
  const statusPeriodo = statusConversas(leads)
  const perdidos = leads.filter((t) => t.motivo_perda || t.estagio_funil === 'recusou_internacao').length

  const periodoLabel = filtros.de || filtros.ate ? `${filtros.de || '…'} → ${filtros.ate || '…'}` : 'todo o histórico'

  return (
    <>
      <Header title="Relatórios" subtitle={`BI do funil de internação · ${periodoLabel}`} />

      <Suspense fallback={null}>
        <FiltrosBI
          de={filtros.de}
          ate={filtros.ate}
          atendente={filtros.atendente}
          preset={filtros.preset}
          atendentes={atendentes}
        />
      </Suspense>

      {/* BIG NUMBERS */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <KpiCard label="Contatos" value={big.contatos} />
        <KpiCard label="Conversas" value={big.conversas} />
        <KpiCard label="Internações" value={big.internacoes} />
        <KpiCard label="Perdas" value={big.perdas} />
        <KpiCard label="Conversão (internações / contatos)" value={taxaConversao(big)} suffix="%" />
      </div>
      <p className="text-xs text-content-tertiary -mt-3 mb-6">
        Contatos = pessoas distintas (contato do Chatwoot ou telefone) · Conversas = leads com conversa no Chatwoot ·
        Internações = etapa Internação · Perdas = etapa Perdido ou motivo de perda preenchido.
      </p>

      {/* PIPELINE */}
      <Card className="mb-4">
        <CardHeader>
          <CardTitle>Visão do pipeline</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-2">
            {etapas.map((e, i) => (
              <div key={e.chave} className="flex items-center gap-2">
                <div className="rounded-lg border border-border bg-surface-secondary px-4 py-2 min-w-[120px]">
                  <p className="text-[11px] uppercase tracking-wide text-content-tertiary">{e.label}</p>
                  <p className="font-display text-2xl font-semibold text-content-primary tabular-nums">{e.count}</p>
                </div>
                {i < etapas.length - 1 && <span className="text-content-tertiary">›</span>}
              </div>
            ))}
            <span className="text-content-tertiary text-lg px-1">»</span>
            {churn.map((c, i) => (
              <div key={c.chave} className="flex items-center gap-2">
                <div className="rounded-lg border border-dashed border-border-strong bg-surface-secondary/40 px-4 py-2 min-w-[120px]">
                  <p className="text-[11px] uppercase tracking-wide text-content-tertiary">{c.label}</p>
                  <p className="font-display text-2xl font-semibold text-content-primary tabular-nums">
                    {c.count.toLocaleString('pt-BR')}
                  </p>
                </div>
                {i < churn.length - 1 && <span className="text-content-tertiary">›</span>}
              </div>
            ))}
            <div className="rounded-lg border border-danger-500/30 bg-danger-500/5 px-4 py-2 min-w-[120px]">
              <p className="text-[11px] uppercase tracking-wide text-danger-600 dark:text-danger-500">Perdido</p>
              <p className="font-display text-2xl font-semibold text-content-primary tabular-nums">{perdidos}</p>
            </div>
          </div>
          <p className="text-xs text-content-tertiary mt-3">
            As colunas de churn vêm da base de pacientes (classificação do carrinho mensal) e não seguem o filtro de período.
          </p>
        </CardContent>
      </Card>

      {/* MOTIVOS DE PERDA + PERFIL */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <Card>
          <CardHeader>
            <CardTitle>Motivos de perda</CardTitle>
          </CardHeader>
          <CardContent>
            {motivos.length ? (
              <BarChart
                data={motivos.map((m) => ({ motivo: m.label, count: m.count }))}
                xKey="motivo"
                bars={[{ key: 'count', color: '#F04438', label: 'Perdas' }]}
                layout="vertical"
                height={Math.max(240, motivos.length * 28)}
              />
            ) : (
              <EmptyChart message="Nenhuma perda registrada no período" />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Perfil do contato</CardTitle>
          </CardHeader>
          <CardContent>
            {perfil.some((p) => p.count > 0) ? (
              <>
                <BarChart
                  data={perfil.map((p) => ({ perfil: p.label, count: p.count }))}
                  xKey="perfil"
                  bars={[{ key: 'count', color: '#2E90FA', label: 'Contatos' }]}
                  layout="vertical"
                  height={260}
                />
                <div className="mt-3 flex flex-wrap gap-2">
                  {categorias.map((c) => (
                    <span key={c.chave} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-secondary px-2.5 py-1 text-xs">
                      <span className="text-content-secondary">{c.label}</span>
                      <span className="font-semibold tabular-nums text-content-primary">{c.count}</span>
                    </span>
                  ))}
                </div>
              </>
            ) : (
              <EmptyChart />
            )}
          </CardContent>
        </Card>
      </div>

      {/* ORIGENS */}
      <Card className="mb-4">
        <CardHeader>
          <CardTitle>Origens</CardTitle>
        </CardHeader>
        <CardContent>
          <TabelaContagens linhas={origens} primeiraColuna="Origem" />
        </CardContent>
      </Card>

      {/* FORMA DE INTERNAÇÃO */}
      <Card className="mb-4">
        <CardHeader>
          <CardTitle>Forma de internação</CardTitle>
        </CardHeader>
        <CardContent>
          <TabelaContagens
            linhas={[forma.particular, ...forma.planos, ...(forma.semPlano.contatos ? [forma.semPlano] : [])]}
            primeiraColuna="Particular / Plano de saúde"
          />
        </CardContent>
      </Card>

      {/* STATUS DAS CONVERSAS */}
      <Card>
        <CardHeader>
          <CardTitle>Status das conversas (visão do Chatwoot)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <p className="text-xs text-content-tertiary mb-2">Agora, no Chatwoot (todas as conversas)</p>
              {chatwootStatus ? (
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(chatwootStatus).map(([s, n]) => (
                    <div key={s} className="rounded-lg border border-border bg-surface-secondary px-3 py-2">
                      <p className="text-[11px] uppercase tracking-wide text-content-tertiary">{STATUS_CHATWOOT_LABELS[s] ?? s}</p>
                      <p className="font-display text-xl font-semibold text-content-primary tabular-nums">
                        {n < 0 ? '—' : n.toLocaleString('pt-BR')}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyChart message="Chatwoot não configurado neste ambiente" />
              )}
            </div>
            <div>
              <p className="text-xs text-content-tertiary mb-2">Conversas dos leads do período (último status recebido pelo webhook)</p>
              {statusPeriodo.length ? (
                <div className="grid grid-cols-2 gap-2">
                  {statusPeriodo.map((s) => (
                    <div key={s.chave} className="rounded-lg border border-border bg-surface-secondary px-3 py-2">
                      <p className="text-[11px] uppercase tracking-wide text-content-tertiary">{s.label}</p>
                      <p className="font-display text-xl font-semibold text-content-primary tabular-nums">{s.count}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyChart message="Sem conversas no período" />
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </>
  )
}
