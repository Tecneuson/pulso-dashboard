import type { Triagem } from '@/types'
import { ASSUNTO_LABELS, MOTIVO_CONTATO_LABELS } from '@/types'
import { etapaFromEstagio } from './funil-etapas'
import { PLANO_LABELS } from './chatwoot/mapping'

export interface KpiData {
  totalMonth: number
  totalToday: number
  conversionRate: number
  waiting: number
  qualificados: number
}

export function computeKpis(triagens: Triagem[]): KpiData {
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  const monthList = triagens.filter((t) => new Date(t.created_at) >= startOfMonth)
  const todayList = triagens.filter((t) => new Date(t.created_at) >= startOfToday)
  const qualificados = triagens.filter((t) => t.status === 'qualificado')
  const internados = triagens.filter((t) => etapaFromEstagio(t.estagio_funil) === 'internacao')
  const waiting = triagens.filter((t) => {
    const etapa = etapaFromEstagio(t.estagio_funil)
    return etapa === 'contato' || etapa === 'atendendo'
  })

  const conversionRate =
    monthList.length > 0 ? (internados.length / monthList.length) * 100 : 0

  return {
    totalMonth: monthList.length,
    totalToday: todayList.length,
    conversionRate: Math.round(conversionRate * 10) / 10,
    waiting: waiting.length,
    qualificados: qualificados.length,
  }
}

export function dailyVolume(triagens: Triagem[], days = 30) {
  const buckets: Record<string, { date: string; contatos: number; concluidas: number }> = {}
  const today = new Date()

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    const key = d.toISOString().slice(0, 10)
    buckets[key] = {
      date: d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
      contatos: 0,
      concluidas: 0,
    }
  }

  for (const t of triagens) {
    const key = t.created_at.slice(0, 10)
    if (buckets[key]) {
      buckets[key].contatos += 1
      if (t.triagem_concluida) buckets[key].concluidas += 1
    }
  }

  return Object.values(buckets)
}

const motivoLabels: Record<string, string> = MOTIVO_CONTATO_LABELS

export function reasonDistribution(triagens: Triagem[]) {
  const counts: Record<string, number> = {}
  for (const t of triagens) {
    const key = t.motivo_contato ?? 'nao_informado'
    counts[key] = (counts[key] ?? 0) + 1
  }
  const colors = ['#2EA866', '#2E90FA', '#F79009', '#9CA3AF']
  return Object.entries(counts).map(([key, value], i) => ({
    name: motivoLabels[key] ?? 'Não informado',
    value,
    color: colors[i % colors.length],
  }))
}

const planoLabels: Record<string, string> = PLANO_LABELS

export function healthPlanBreakdown(triagens: Triagem[]) {
  const counts: Record<string, { total: number; converted: number }> = {}
  for (const t of triagens) {
    const key = t.plano_saude ?? 'sem_plano'
    if (!counts[key]) counts[key] = { total: 0, converted: 0 }
    counts[key].total += 1
    if (etapaFromEstagio(t.estagio_funil) === 'internacao') counts[key].converted += 1
  }
  return Object.entries(counts)
    .map(([key, { total, converted }]) => ({
      plan: planoLabels[key] ?? 'Sem plano',
      total,
      converted,
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 10)
}

const assuntoLabels: Record<string, string> = ASSUNTO_LABELS

export function assuntoDistribution(triagens: Triagem[]) {
  const counts: Record<string, number> = {}
  for (const t of triagens) {
    const key = t.assunto ?? 'outro_assunto'
    counts[key] = (counts[key] ?? 0) + 1
  }
  return Object.entries(counts)
    .map(([key, count]) => ({
      reason: assuntoLabels[key] ?? key,
      count,
    }))
    .sort((a, b) => b.count - a.count)
}
