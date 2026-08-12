import { Header } from '@/components/layout/header'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui'
import { KpiCard } from '@/components/metrics/kpi-card'
import { LineChart } from '@/components/metrics/line-chart'
import { DonutChart } from '@/components/metrics/donut-chart'
import { BarChart } from '@/components/metrics/bar-chart'
import { createClient } from '@/lib/supabase/server'
import {
  funnelBreakdown,
  weeklyConversion,
  utmSourceBreakdown,
  paraQuemBreakdown,
  tipoContatoBreakdown,
  lossReasons,
  summaryStats,
} from '@/lib/reports'
import { healthPlanBreakdown, assuntoDistribution } from '@/lib/metrics'
import type { Triagem } from '@/types'
import { requireGestor } from '@/lib/auth'

export const revalidate = 0

function EmptyChart({ message = 'Sem dados ainda' }: { message?: string }) {
  return (
    <p className="text-sm text-content-tertiary py-12 text-center">{message}</p>
  )
}

export default async function ReportsPage() {
  await requireGestor()
  const supabase = await createClient()
  const { data } = await supabase
    .from('triagem_hsm')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(5000)

  const triagens = (data ?? []) as Triagem[]
  const stats = summaryStats(triagens)
  const funnel = funnelBreakdown(triagens)
  const weekly = weeklyConversion(triagens)
  const utms = utmSourceBreakdown(triagens)
  const paraQuem = paraQuemBreakdown(triagens)
  const tipoContato = tipoContatoBreakdown(triagens)
  const losses = lossReasons(triagens)
  const planos = healthPlanBreakdown(triagens)
  const assuntos = assuntoDistribution(triagens)

  return (
    <>
      <Header
        title="Relatórios"
        subtitle="Análise completa do funil de atendimento"
      />

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KpiCard label="Total de triagens" value={stats.total} />
        <KpiCard label="Triagens concluídas" value={stats.concluidas} />
        <KpiCard label="Transbordadas" value={stats.transbordadas} />
        <KpiCard label="Em atendimento" value={stats.ativos} />
        <KpiCard label="Internações confirmadas" value={stats.internados} />
        <KpiCard label="Recusas" value={stats.perdidos} />
        <KpiCard
          label="Taxa de conversão"
          value={stats.conversionRate}
          suffix="%"
        />
        <KpiCard
          label="Tempo médio (min)"
          value={stats.avgTime}
        />
      </div>

      {/* Funnel + Weekly */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <Card>
          <CardHeader>
            <CardTitle>Funil de atendimento</CardTitle>
          </CardHeader>
          <CardContent>
            {funnel.length > 0 ? (
              <BarChart
                data={funnel}
                xKey="stage"
                bars={[{ key: 'count', color: '#2EA866', label: 'Contatos' }]}
                layout="vertical"
                height={360}
              />
            ) : (
              <EmptyChart />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Conversão semanal (8 semanas)</CardTitle>
          </CardHeader>
          <CardContent>
            {weekly.some((w) => w.total > 0) ? (
              <LineChart
                data={weekly}
                xKey="week"
                lines={[
                  { key: 'total', color: '#2E90FA', label: 'Total' },
                  { key: 'internados', color: '#2EA866', label: 'Internados' },
                  { key: 'perdidos', color: '#F04438', label: 'Recusas' },
                ]}
              />
            ) : (
              <EmptyChart />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Origin + Para quem */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        <Card>
          <CardHeader>
            <CardTitle>Origem (UTM)</CardTitle>
          </CardHeader>
          <CardContent>
            {utms.length > 0 ? <DonutChart data={utms} /> : <EmptyChart />}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Para quem é o atendimento</CardTitle>
          </CardHeader>
          <CardContent>
            {paraQuem.length > 0 ? <DonutChart data={paraQuem} /> : <EmptyChart />}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Tipo de contato</CardTitle>
          </CardHeader>
          <CardContent>
            {tipoContato.length > 0 ? (
              <BarChart
                data={tipoContato}
                xKey="tipo"
                bars={[{ key: 'count', color: '#2E90FA', label: 'Contatos' }]}
                layout="vertical"
                height={300}
              />
            ) : (
              <EmptyChart />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Plans + Loss reasons */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <Card>
          <CardHeader>
            <CardTitle>Performance por convênio</CardTitle>
          </CardHeader>
          <CardContent>
            {planos.length > 0 ? (
              <BarChart
                data={planos}
                xKey="plan"
                bars={[
                  { key: 'total', color: '#78786E', label: 'Total' },
                  { key: 'converted', color: '#2EA866', label: 'Internações' },
                ]}
                layout="vertical"
                height={360}
              />
            ) : (
              <EmptyChart />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Motivos de perda</CardTitle>
          </CardHeader>
          <CardContent>
            {losses.length > 0 ? (
              <BarChart
                data={losses}
                xKey="reason"
                bars={[{ key: 'count', color: '#F04438', label: 'Perdas' }]}
                layout="vertical"
                height={360}
              />
            ) : (
              <EmptyChart message="Nenhuma perda registrada ainda" />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Assuntos */}
      <div className="grid grid-cols-1 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Distribuição por assunto</CardTitle>
          </CardHeader>
          <CardContent>
            {assuntos.length > 0 ? (
              <BarChart
                data={assuntos}
                xKey="reason"
                bars={[{ key: 'count', color: '#2EA866', label: 'Contatos' }]}
                height={280}
              />
            ) : (
              <EmptyChart />
            )}
          </CardContent>
        </Card>
      </div>
    </>
  )
}
