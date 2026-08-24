import { NextResponse } from 'next/server'
import { requireUserApi } from '@/lib/auth'
import { chatwootConfigured, listAttributeDefinitions } from '@/lib/chatwoot/client'
import { CORE_DEFINITIONS, LEGACY_KEYS } from '@/lib/chatwoot/attributes'
import { listarCampos } from '@/lib/chatwoot/campos'

/**
 * Auditoria dos atributos do Chatwoot: o que falta, o que sobrou (legado/redundante) e
 * duplicidades (mesma chave nos dois modelos, chaves parecidas). Gestor.
 */
export async function GET() {
  const { error } = await requireUserApi({ gestor: true })
  if (error) return error
  if (!chatwootConfigured()) return NextResponse.json({ error: 'Chatwoot não configurado' }, { status: 503 })

  const defs = await listAttributeDefinitions()
  const campos = await listarCampos()
  const conhecidas = new Map<string, string>()
  for (const c of CORE_DEFINITIONS) conhecidas.set(`${c.modelo}:${c.key}`, 'core')
  for (const c of campos) conhecidas.set(`${c.modelo}:${c.chave}`, c.ativo ? 'personalizado' : 'personalizado (inativo)')

  const faltando = CORE_DEFINITIONS.filter(
    (c) => !c.sistema && !defs.some((d) => d.attribute_key === c.key && d.modelo === c.modelo)
  ).map((c) => ({ chave: c.key, modelo: c.modelo, rotulo: c.label }))

  const legados = defs
    .filter((d) => d.attribute_key in LEGACY_KEYS)
    .map((d) => ({ id: d.id, chave: d.attribute_key, modelo: d.modelo, motivo: LEGACY_KEYS[d.attribute_key] }))

  const desconhecidas = defs
    .filter((d) => !conhecidas.has(`${d.modelo}:${d.attribute_key}`) && !(d.attribute_key in LEGACY_KEYS))
    .map((d) => ({ id: d.id, chave: d.attribute_key, modelo: d.modelo, rotulo: d.attribute_display_name, tipo: d.tipo }))

  // Mesma chave em contato E conversa (quase sempre é duplicidade).
  const porChave = new Map<string, typeof defs>()
  for (const d of defs) porChave.set(d.attribute_key, [...(porChave.get(d.attribute_key) ?? []), d])
  const duplicadas = Array.from(porChave.entries())
    .filter(([, list]) => list.length > 1)
    .map(([chave, list]) => ({ chave, modelos: list.map((d) => d.modelo) }))

  // Chaves "parecidas" (ex.: motivo_contato vs motivo_do_contato vs motivo_contato_crm).
  const norm = (k: string) => k.replace(/_(do|da|de|no|na|crm)_?/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '')
  const grupos = new Map<string, string[]>()
  for (const d of defs) grupos.set(norm(d.attribute_key), [...(grupos.get(norm(d.attribute_key)) ?? []), d.attribute_key])
  const parecidas = Array.from(grupos.values()).filter((g) => new Set(g).size > 1).map((g) => Array.from(new Set(g)))

  // Divergência de opções nas listas core.
  const listasDivergentes = CORE_DEFINITIONS.filter((c) => c.tipo === 'list' && c.opcoes).flatMap((c) => {
    const d = defs.find((x) => x.attribute_key === c.key && x.modelo === c.modelo)
    if (!d) return []
    const atual = new Set(d.attribute_values ?? [])
    const faltam = c.opcoes!.filter((o) => !atual.has(o))
    const extras = (d.attribute_values ?? []).filter((o) => !c.opcoes!.includes(o))
    return faltam.length || extras.length ? [{ chave: c.key, faltam, extras }] : []
  })

  return NextResponse.json({
    total: defs.length,
    definicoes: defs.map((d) => ({ id: d.id, chave: d.attribute_key, modelo: d.modelo, tipo: d.tipo, rotulo: d.attribute_display_name, opcoes: d.attribute_values ?? [] })),
    faltando,
    legados,
    desconhecidas,
    duplicadas,
    parecidas,
    listasDivergentes,
    recomendacao:
      'Rode POST /api/campos/sync para criar o que falta e alinhar as listas. Campos "legados" podem ser removidos no Chatwoot depois de conferir que não há dado útil neles.',
  })
}
