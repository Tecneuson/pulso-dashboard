'use client'

import { Header } from '@/components/layout/header'
import { KpiCard } from '@/components/metrics/kpi-card'
import { LineChart } from '@/components/metrics/line-chart'
import { DonutChart } from '@/components/metrics/donut-chart'
import { BarChart } from '@/components/metrics/bar-chart'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui'
import {
  kpiData,
  dailyVolumeData,
  reasonDistribution,
  healthPlanConversion,
  lossReasons,
} from '@/lib/mock-data'

export default function DashboardPage() {
  return (
    <>
      <Header title="Dashboard" subtitle="Visão geral do atendimento" />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <KpiCard
          label="Total de contatos (mês)"
          value={kpiData.totalContacts.month}
        />
        <KpiCard
          label="Taxa de conversão"
          value={kpiData.conversionRate}
          suffix="%"
          delta={kpiData.conversionRateDelta}
        />
        <KpiCard
          label="Tempo médio no funil"
          value={kpiData.avgFunnelTime}
          delta={kpiData.avgFunnelTimeDelta}
          deltaLabel="min vs semana anterior"
        />
        <KpiCard
          label="Contatos aguardando"
          value={kpiData.waitingContacts}
        />
      </div>

      {/* Charts — row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Volume de contatos (30 dias)</CardTitle>
          </CardHeader>
          <CardContent>
            <LineChart
              data={dailyVolumeData}
              xKey="date"
              lines={[
                { key: 'contatos', color: '#2EA866', label: 'Contatos' },
                { key: 'internacoes', color: '#2E90FA', label: 'Internações' },
              ]}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Motivo do contato</CardTitle>
          </CardHeader>
          <CardContent>
            <DonutChart data={reasonDistribution} />
          </CardContent>
        </Card>
      </div>

      {/* Charts — row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Conversão por convênio (top 10)</CardTitle>
          </CardHeader>
          <CardContent>
            <BarChart
              data={healthPlanConversion}
              xKey="plan"
              bars={[
                { key: 'total', color: '#78786E', label: 'Total' },
                { key: 'converted', color: '#2EA866', label: 'Internações' },
              ]}
              layout="vertical"
              height={360}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Motivos de perda</CardTitle>
          </CardHeader>
          <CardContent>
            <BarChart
              data={lossReasons}
              xKey="reason"
              bars={[{ key: 'count', color: '#F04438', label: 'Perdas' }]}
              layout="vertical"
              height={360}
            />
          </CardContent>
        </Card>
      </div>
    </>
  )
}
