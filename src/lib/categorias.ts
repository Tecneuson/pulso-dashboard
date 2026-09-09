import type { SupabaseClient } from '@supabase/supabase-js'
import {
  CATEGORIA_CONTATO,
  CATEGORIA_CONTATO_LABELS,
  TIPO_CONTATO,
  TIPO_CONTATO_LABELS,
  categoriaDoTipo,
  type CategoriaContato,
} from '@/types'
import { registrarPerfisContato } from '@/lib/chatwoot/mapping'

/**
 * Perfis de contato — a lista que o administrador gerencia em Configurações.
 *
 * Dois níveis, de propósito:
 *  • PERFIL (`slug`) é o que fica gravado em `triagem_hsm.tipo_contato` e vai para o
 *    atributo `quem_e_o_contato` do Chatwoot;
 *  • GRUPO é o que os relatórios somam — "Consultores: 20 internações" e, dentro,
 *    o detalhe por pessoa.
 *
 * ⚠️ Tudo aqui degrada para a lista fixa do código quando a tabela ainda não existe
 * (migration 20260909 pendente). Sem isso o funil quebraria entre o deploy e o SQL.
 */

export interface CategoriaContatoRow {
  id: string
  slug: string
  label: string
  grupo: CategoriaContato
  descricao: string | null
  ordem: number
  ativo: boolean
  sistema: boolean
}

const DESCRICAO_PADRAO: Record<string, string> = {
  lead: 'A própria pessoa que será atendida, em primeiro contato.',
  ex_paciente: 'Paciente que já se internou no hospital antes.',
  responsavel: 'Familiar, amigo(a) ou responsável legal falando pelo paciente.',
  medico: 'Médico que encaminha o paciente.',
  consultor: 'Quem intermedeia entre a família e o hospital.',
}

/** A lista fixa que existia antes da tabela — fallback e semente. */
export const CATEGORIAS_PADRAO: CategoriaContatoRow[] = TIPO_CONTATO.map((slug, i) => ({
  id: `padrao:${slug}`,
  slug,
  label: TIPO_CONTATO_LABELS[slug],
  grupo: categoriaDoTipo(slug) ?? 'consultor',
  descricao: DESCRICAO_PADRAO[slug] ?? null,
  ordem: (i + 1) * 10,
  ativo: true,
  sistema: true,
}))

/** Slugs que a aplicação nunca deixa apagar: leads antigos e o Chatwoot apontam para eles. */
export const SLUGS_SISTEMA: readonly string[] = TIPO_CONTATO

function ordenar(rows: CategoriaContatoRow[]): CategoriaContatoRow[] {
  return [...rows].sort((a, b) => a.ordem - b.ordem || a.label.localeCompare(b.label, 'pt-BR'))
}

/**
 * Lista os perfis. `apenasAtivos` deixa de fora os desativados — use `false` na tela
 * de administração, onde o desativado ainda precisa aparecer para ser reativado.
 */
export async function listarCategorias(
  client: SupabaseClient,
  apenasAtivos = true
): Promise<CategoriaContatoRow[]> {
  try {
    const { data, error } = await client
      .from('categorias_contato')
      .select('id, slug, label, grupo, descricao, ordem, ativo, sistema')
      .order('ordem', { ascending: true })
    if (error || !data?.length) return CATEGORIAS_PADRAO
    const rows = data as CategoriaContatoRow[]
    // Ensina o tradutor de/para o Chatwoot os perfis novos. Fica aqui porque este é o
    // único caminho por onde a lista é carregada — deixar a cargo de cada chamador
    // seria esquecer em algum deles.
    registrarPerfisContato(rows.map(({ slug, label }) => ({ slug, label })))
    return ordenar(apenasAtivos ? rows.filter((r) => r.ativo) : rows)
  } catch {
    return CATEGORIAS_PADRAO // migration 20260909 ainda não rodou
  }
}

/** slug → rótulo, já com os slugs legados que não estão mais na lista. */
export function mapaLabels(rows: CategoriaContatoRow[]): Record<string, string> {
  const out: Record<string, string> = { ...TIPO_CONTATO_LABELS }
  for (const r of rows) out[r.slug] = r.label
  return out
}

/** Grupo de um perfil; cai no mapa legado quando o slug não está mais cadastrado. */
export function grupoDoSlug(
  rows: CategoriaContatoRow[],
  slug: string | null | undefined
): CategoriaContato | null {
  if (!slug) return null
  const achado = rows.find((r) => r.slug === slug)
  return achado ? achado.grupo : categoriaDoTipo(slug)
}

/** Perfis agrupados, na ordem das categorias — é assim que o card monta o seletor. */
export function porGrupo(rows: CategoriaContatoRow[]): {
  grupo: CategoriaContato
  label: string
  perfis: CategoriaContatoRow[]
}[] {
  return CATEGORIA_CONTATO.map((grupo) => ({
    grupo,
    label: CATEGORIA_CONTATO_LABELS[grupo],
    perfis: ordenar(rows.filter((r) => r.grupo === grupo)),
  })).filter((g) => g.perfis.length > 0)
}
