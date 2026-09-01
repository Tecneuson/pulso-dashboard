import type { CampoPersonalizado } from '@/types'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  chatwootConfigured,
  createAttributeDefinition,
  listAttributeDefinitions,
  updateAttributeDefinition,
  type ChatwootAttributeDefinition,
} from './client'
import { CORE_DEFINITIONS, CORE_KEYS, LEGACY_KEYS, type AttributeDefinitionSpec } from './attributes'

/**
 * Campos personalizados: o Chatwoot é a CENTRAL das definições; a tabela
 * `campos_personalizados` é o espelho que o CRM usa para renderizar/validar.
 *
 *  - Campo criado na tela de Configurações do CRM → criado no Chatwoot na hora.
 *  - Campo criado direto no Chatwoot → importado aqui na próxima sincronização
 *    (botão "Sincronizar" ou automaticamente a cada ~5 min quando alguém usa o app).
 *  - Campos "core" (funil, plano, venda, motivo de perda…) são garantidos pelo registro
 *    em `attributes.ts` — se alguém apagar no Chatwoot, o sync recria.
 */

const TTL_MS = 60_000
let cache: { at: number; rows: CampoPersonalizado[] } | null = null

export function invalidarCacheCampos(): void {
  cache = null
}

/** Lista os campos dinâmicos (espelho). Cache curto em memória por instância. */
export async function listarCampos(opts: { somenteAtivos?: boolean } = {}): Promise<CampoPersonalizado[]> {
  if (!cache || Date.now() - cache.at > TTL_MS) {
    try {
      const admin = createAdminClient()
      const { data, error } = await admin
        .from('campos_personalizados')
        .select('*')
        .order('ordem', { ascending: true })
        .order('rotulo', { ascending: true })
      if (error) throw new Error(error.message)
      cache = { at: Date.now(), rows: (data ?? []) as CampoPersonalizado[] }
    } catch (e) {
      // Tabela ainda não migrada → app segue sem campos dinâmicos.
      console.warn('[campos] não foi possível ler campos_personalizados:', (e as Error).message)
      cache = { at: Date.now(), rows: [] }
    }
  }
  const rows = cache.rows
  return opts.somenteAtivos ? rows.filter((c) => c.ativo) : rows
}

export interface SyncDefinicoesResult {
  coreCriados: string[]
  coreAtualizados: string[]
  criadosNoChatwoot: string[]
  importadosDoChatwoot: string[]
  atualizadosDoChatwoot: string[]
  desativados: string[]
  legadosEncontrados: string[]
  erros: string[]
}

function mesmoConjunto(a: string[] | null | undefined, b: string[]): boolean {
  const sa = new Set(a ?? [])
  const sb = new Set(b)
  if (sa.size !== sb.size) return false
  for (const v of Array.from(sa)) if (!sb.has(v)) return false
  return true
}

/** Listas core que devem ficar EXATAMENTE como o registro (o resto faz união). */
const LISTAS_EXATAS = new Set(['quem_e_o_contato', 'estagio_no_funil', 'motivo_contato_crm', 'venda', 'elegivel', 'motivo_de_perda', 'consultor_origem'])

function acharDef(defs: ChatwootAttributeDefinition[], key: string, modelo: string) {
  return defs.find((d) => d.attribute_key === key && d.modelo === modelo)
}

async function garantirCore(
  defs: ChatwootAttributeDefinition[],
  r: SyncDefinicoesResult,
  consultores: string[]
): Promise<void> {
  for (const spec0 of CORE_DEFINITIONS) {
    if (spec0.sistema) continue
    // Lista de consultores: o CRM (`consultores`) é a fonte; o Chatwoot recebe a mesma lista.
    const spec: AttributeDefinitionSpec =
      spec0.key === 'consultor_origem' && consultores.length ? { ...spec0, opcoes: consultores } : spec0
    const existente = acharDef(defs, spec.key, spec.modelo)
    try {
      if (!existente) {
        const criado = await createAttributeDefinition({
          key: spec.key,
          label: spec.label,
          modelo: spec.modelo,
          tipo: spec.tipo,
          opcoes: spec.opcoes,
          descricao: spec.descricao,
        })
        if (criado) defs.push(criado)
        r.coreCriados.push(spec.key)
        continue
      }
      if (spec.tipo === 'list' && spec.opcoes) {
        const alvo = LISTAS_EXATAS.has(spec.key)
          ? spec.opcoes
          : Array.from(new Set([...spec.opcoes, ...(existente.attribute_values ?? [])]))
        if (!mesmoConjunto(existente.attribute_values, alvo)) {
          await updateAttributeDefinition(existente.id, { opcoes: alvo })
          existente.attribute_values = alvo
          r.coreAtualizados.push(spec.key)
        }
      }
    } catch (e) {
      r.erros.push(`${spec.key}: ${(e as Error).message}`)
    }
  }
}

/**
 * Reconciliação completa das definições (core + dinâmicas), nos dois sentidos.
 * Idempotente — pode rodar quantas vezes quiser.
 */
export async function sincronizarDefinicoes(): Promise<SyncDefinicoesResult> {
  const r: SyncDefinicoesResult = {
    coreCriados: [],
    coreAtualizados: [],
    criadosNoChatwoot: [],
    importadosDoChatwoot: [],
    atualizadosDoChatwoot: [],
    desativados: [],
    legadosEncontrados: [],
    erros: [],
  }
  if (!chatwootConfigured()) {
    r.erros.push('Chatwoot não configurado (CHATWOOT_BASE_URL/CHATWOOT_API_TOKEN).')
    return r
  }
  const admin = createAdminClient()
  const defs = await listAttributeDefinitions()

  // 1) Core: existe com o vocabulário certo (consultores vêm da lista única do CRM).
  const { data: cons } = await admin.from('consultores').select('nome').eq('ativo', true).order('nome')
  const nomesConsultores = Array.from(new Set(((cons ?? []) as { nome: string }[]).map((c) => c.nome.trim()).filter(Boolean)))
  await garantirCore(defs, r, nomesConsultores)

  // 2) Dinâmicos do banco.
  const { data: rows, error } = await admin.from('campos_personalizados').select('*')
  if (error) {
    r.erros.push(`campos_personalizados: ${error.message} (rode a migration 20260823)`)
    return r
  }
  const campos = (rows ?? []) as CampoPersonalizado[]
  const vistos = new Set<number>()

  for (const c of campos) {
    try {
      const def =
        (c.chatwoot_definition_id ? defs.find((d) => d.id === c.chatwoot_definition_id) : undefined) ??
        acharDef(defs, c.chave, c.modelo)
      if (def) {
        vistos.add(def.id)
        // Chatwoot é a central: rótulo/opções/descrição de lá mandam.
        const patch: Partial<CampoPersonalizado> = {}
        if (c.chatwoot_definition_id !== def.id) patch.chatwoot_definition_id = def.id
        if (def.attribute_display_name && def.attribute_display_name !== c.rotulo) patch.rotulo = def.attribute_display_name
        if ((def.attribute_description ?? null) !== (c.descricao ?? null)) patch.descricao = def.attribute_description ?? null
        if (def.tipo !== c.tipo) patch.tipo = def.tipo
        if (def.tipo === 'list' && !mesmoConjunto(c.opcoes, def.attribute_values ?? [])) patch.opcoes = def.attribute_values ?? []
        if (!c.ativo && !(c.chave in LEGACY_KEYS)) patch.ativo = true
        if (Object.keys(patch).length) {
          await admin.from('campos_personalizados').update(patch).eq('id', c.id)
          r.atualizadosDoChatwoot.push(c.chave)
        }
      } else if (c.ativo) {
        // Criado no CRM e ainda não existe lá → cria.
        const criado = await createAttributeDefinition({
          key: c.chave,
          label: c.rotulo,
          modelo: c.modelo,
          tipo: c.tipo,
          opcoes: c.opcoes,
          descricao: c.descricao,
        })
        if (criado) {
          defs.push(criado)
          vistos.add(criado.id)
          await admin.from('campos_personalizados').update({ chatwoot_definition_id: criado.id }).eq('id', c.id)
        }
        r.criadosNoChatwoot.push(c.chave)
      }
    } catch (e) {
      r.erros.push(`${c.chave}: ${(e as Error).message}`)
    }
  }

  // 2b) Campo dinâmico que virou CORE depois (ex.: `nome_do_responsavel`): desativa a
  //     cópia em `campos_personalizados` — senão o card mostraria o mesmo campo duas
  //     vezes e as duas escritas disputariam o mesmo atributo no Chatwoot.
  for (const c of campos) {
    if (!c.ativo || !CORE_KEYS.has(c.chave)) continue
    try {
      await admin.from('campos_personalizados').update({ ativo: false }).eq('id', c.id)
      r.desativados.push(c.chave)
    } catch (e) {
      r.erros.push(`${c.chave}: ${(e as Error).message}`)
    }
  }

  // 3) Definições no Chatwoot que o CRM ainda não conhece → importa.
  const chavesDb = new Set(campos.map((c) => `${c.modelo}:${c.chave}`))
  let ordem = campos.length
  for (const d of defs) {
    if (CORE_KEYS.has(d.attribute_key)) continue
    if (vistos.has(d.id) || chavesDb.has(`${d.modelo}:${d.attribute_key}`)) continue
    const legado = d.attribute_key in LEGACY_KEYS
    if (legado) r.legadosEncontrados.push(d.attribute_key)
    try {
      const { error: insErr } = await admin.from('campos_personalizados').insert({
        chave: d.attribute_key,
        rotulo: d.attribute_display_name || d.attribute_key,
        descricao: d.attribute_description ?? null,
        modelo: d.modelo,
        tipo: d.tipo,
        opcoes: d.attribute_values ?? [],
        ativo: !legado,
        ordem: ordem++,
        chatwoot_definition_id: d.id,
      })
      if (insErr) throw new Error(insErr.message)
      r.importadosDoChatwoot.push(d.attribute_key)
    } catch (e) {
      r.erros.push(`${d.attribute_key}: ${(e as Error).message}`)
    }
  }

  invalidarCacheCampos()
  return r
}

/** Especificações core (para a tela de auditoria). */
export function definicoesCore(): AttributeDefinitionSpec[] {
  return CORE_DEFINITIONS
}

// Sincronização "preguiçosa": no máximo 1x a cada 5 min por instância, disparada por
// quem usa a tela de campos/card. Falha silenciosa (nunca derruba a tela).
let ultimaSync = 0
export async function sincronizarSePreciso(): Promise<void> {
  if (!chatwootConfigured()) return
  if (Date.now() - ultimaSync < 5 * 60_000) return
  ultimaSync = Date.now()
  try {
    await sincronizarDefinicoes()
  } catch (e) {
    console.warn('[campos] sync automático falhou:', (e as Error).message)
  }
}
