import { ESTAGIO_FUNIL, ESTAGIO_FUNIL_LABELS } from '@/types'
import type { Triagem, EstagioFunil } from '@/types'

export function funnelBreakdown(triagens: Triagem[]) {
  return ESTAGIO_FUNIL.map((stage) => ({
    stage: ESTAGIO_FUNIL_LABELS[stage],
    count: triagens.filter((t) => (t.estagio_funil ?? 'novo_contato') === stage)
      .length,
  })).filter((s) => s.count > 0)
}

export function weeklyConversion(triagens: Triagem[], weeks = 8) {
  const now = new Date()
  const buckets: { week: string; total: number; internados: number; perdidos: number }[] = []

  for (let i = weeks - 1; i >= 0; i--) {
    const start = new Date(now)
    start.setDate(start.getDate() - start.getDay() - i * 7)
    start.setHours(0, 0, 0, 0)
    const end = new Date(start)
    end.setDate(end.getDate() + 7)

    const inWeek = triagens.filter((t) => {
      const d = new Date(t.created_at)
      return d >= start && d < end
    })

    buckets.push({
      week: start.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
      total: inWeek.length,
      internados: inWeek.filter((t) => t.estagio_funil === 'internado').length,
      perdidos: inWeek.filter((t) => t.estagio_funil === 'recusou_internacao').length,
    })
  }

  return buckets
}

export function utmSourceBreakdown(triagens: Triagem[]) {
  const counts: Record<string, number> = {}
  for (const t of triagens) {
    const key = t.utm_source ?? 'direto'
    counts[key] = (counts[key] ?? 0) + 1
  }
  const colors = ['#2EA866', '#2E90FA', '#F79009', '#F04438', '#A78BFA', '#9CA3AF']
  return Object.entries(counts)
    .map(([name, value], i) => ({
      name: name === 'direto' ? 'Direto' : name,
      value,
      color: colors[i % colors.length],
    }))
    .sort((a, b) => b.value - a.value)
}

export function paraQuemBreakdown(triagens: Triagem[]) {
  const labels: Record<string, string> = {
    voce_mesmo: 'Você mesmo',
    familiar: 'Familiar',
    amigo: 'Amigo',
  }
  const counts: Record<string, number> = {}
  for (const t of triagens) {
    const key = t.para_quem ?? 'nao_informado'
    counts[key] = (counts[key] ?? 0) + 1
  }
  const colors = ['#2EA866', '#2E90FA', '#F79009', '#9CA3AF']
  return Object.entries(counts).map(([k, v], i) => ({
    name: labels[k] ?? 'Não informado',
    value: v,
    color: colors[i % colors.length],
  }))
}

export function tipoContatoBreakdown(triagens: Triagem[]) {
  const labels: Record<string, string> = {
    lead: 'Lead',
    ex_paciente: 'Ex-paciente',
    responsavel: 'Responsável',
    responsavel_lead: 'Resp. do lead',
    responsavel_ex_paciente: 'Resp. do ex-paciente',
    parceiro: 'Parceiro',
  }
  const counts: Record<string, number> = {}
  for (const t of triagens) {
    const key = t.tipo_contato ?? 'nao_informado'
    counts[key] = (counts[key] ?? 0) + 1
  }
  return Object.entries(counts)
    .map(([k, count]) => ({ tipo: labels[k] ?? 'Não informado', count }))
    .sort((a, b) => b.count - a.count)
}

export function lossReasons(triagens: Triagem[]) {
  const labels: Record<string, string> = {
    parou_de_interagir: 'Parou de interagir',
    desistiu_do_tratamento: 'Desistiu',
    financeiro: 'Financeiro',
    plano_nao_autorizou: 'Plano não autorizou',
    plano_sem_convenio: 'Plano sem convênio',
    nao_tem_plano: 'Não tem plano',
    nao_gostou_do_hospital: 'Não gostou',
    sus: 'SUS',
    outro: 'Outro',
  }
  const counts: Record<string, number> = {}
  for (const t of triagens) {
    if (!t.motivo_perda) continue
    counts[t.motivo_perda] = (counts[t.motivo_perda] ?? 0) + 1
  }
  return Object.entries(counts)
    .map(([k, count]) => ({ reason: labels[k] ?? k, count }))
    .sort((a, b) => b.count - a.count)
}

export function avgFunnelTimeMinutes(triagens: Triagem[]) {
  const concluidas = triagens.filter((t) => t.triagem_concluida)
  if (concluidas.length === 0) return 0
  const total = concluidas.reduce((sum, t) => {
    const start = new Date(t.created_at).getTime()
    const end = new Date(t.updated_at).getTime()
    return sum + (end - start)
  }, 0)
  return Math.round(total / concluidas.length / 60000)
}

export function summaryStats(triagens: Triagem[]) {
  const concluidas = triagens.filter((t) => t.triagem_concluida).length
  const transbordadas = triagens.filter((t) => t.transbordado).length
  const internados = triagens.filter((t) => t.estagio_funil === 'internado').length
  const perdidos = triagens.filter((t) => t.estagio_funil === 'recusou_internacao').length
  const ativos = triagens.length - internados - perdidos

  return {
    total: triagens.length,
    concluidas,
    transbordadas,
    internados,
    perdidos,
    ativos,
    avgTime: avgFunnelTimeMinutes(triagens),
    conversionRate:
      triagens.length > 0
        ? Math.round((internados / triagens.length) * 1000) / 10
        : 0,
    completionRate:
      triagens.length > 0
        ? Math.round((concluidas / triagens.length) * 1000) / 10
        : 0,
  }
}

export type StageBreakdown = { stage: EstagioFunil; label: string; count: number }
