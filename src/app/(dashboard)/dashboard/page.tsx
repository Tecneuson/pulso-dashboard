import { Header } from '@/components/layout/header'
import { KpiCard } from '@/components/metrics/kpi-card'
import { LineChart } from '@/components/metrics/line-chart'
import { DonutChart } from '@/components/metrics/donut-chart'
import { BarChart } from '@/components/metrics/bar-chart'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui'
import { createClient } from '@/lib/supabase/server'
import {
  computeKpis,
  dailyVolume,
  reasonDistribution,
  healthPlanBreakdown,
  assuntoDistribution,
} from '@/lib/metrics'
import type { Triagem } from '@/types'

export const revalidate = 0

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data } = await supabase
    .from('triagem_hsm')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(2000)

  const triagens = (data ?? []) as Triagem[]
  const kpis = computeKpis(triagens)
  const volume = dailyVolume(triagens)
  const reasons = reasonDistribution(triagens)
  const plans = healthPlanBreakdown(triagens)
  const assuntos = assuntoDistribution(triagens)

  return (
    <>
      <Header title="Dashboard" subtitle="Visão geral do atendimento" />

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <KpiCard label="Contatos no mês" value={kpis.totalMonth} />
        <KpiCard label="Contatos hoje" value={kpis.totalToday} />
        <KpiCard label="Taxa de conversão" value={kpis.conversionRate} suffix="%" />
        <KpiCard label="Aguardando atendimento" value={kpis.waiting} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Volume de contatos (30 dias)</CardTitle>
          </CardHeader>
          <CardContent>
            <LineChart
              data={volume}
              xKey="date"
              lines={[
                { key: 'contatos', color: '#2EA866', label: 'Contatos' },
                { key: 'concluidas', color: '#2E90FA', label: 'Triagens concluídas' },
              ]}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Motivo do contato</CardTitle>
          </CardHeader>
          <CardContent>
            {reasons.length > 0 ? (
              <DonutChart data={reasons} />
            ) : (
              <p className="text-sm text-content-tertiary py-8 text-center">
                Sem dados ainda
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Conversão por convênio (top 10)</CardTitle>
          </CardHeader>
          <CardContent>
            {plans.length > 0 ? (
              <BarChart
                data={plans}
                xKey="plan"
                bars={[
                  { key: 'total', color: '#78786E', label: 'Total' },
                  { key: 'converted', color: '#2EA866', label: 'Internações' },
                ]}
                layout="vertical"
                height={360}
              />
            ) : (
              <p className="text-sm text-content-tertiary py-8 text-center">
                Sem dados ainda
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Distribuição por assunto</CardTitle>
          </CardHeader>
          <CardContent>
            {assuntos.length > 0 ? (
              <BarChart
                data={assuntos}
                xKey="reason"
                bars={[{ key: 'count', color: '#2E90FA', label: 'Contatos' }]}
                layout="vertical"
                height={360}
              />
            ) : (
              <p className="text-sm text-content-tertiary py-8 text-center">
                Sem dados ainda
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  )
}
