import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Escrita "só se mudou" no triagem_hsm. Sem isso, um update com valores idênticos ainda
 * dispara o database webhook do Supabase → n8n/app → Chatwoot → webhook de novo,
 * criando um loop de eco infinito. Também serve de rede de segurança para colunas
 * que ainda não existem no banco (migration pendente): tira só a coluna e regrava.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyObj = Record<string, any>

export type FiltroTriagem = { id: string } | { conversation_id: string | number }

function igual(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) || Array.isArray(b) || (a && typeof a === 'object') || (b && typeof b === 'object')) {
    return JSON.stringify(a ?? null) === JSON.stringify(b ?? null)
  }
  // Datas: '2020-01-01' vs '2020-01-01T00:00:00' → compara só a parte da data.
  if (typeof a === 'string' && typeof b === 'string' && /^\d{4}-\d{2}-\d{2}/.test(a) && /^\d{4}-\d{2}-\d{2}/.test(b)) {
    return a.slice(0, 10) === b.slice(0, 10)
  }
  return (a ?? null) === (b ?? null)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function aplicaFiltro(q: any, f: FiltroTriagem): any {
  return 'id' in f ? q.eq('id', f.id) : q.eq('conversation_id', String(f.conversation_id))
}

export async function lerTriagem(
  client: SupabaseClient,
  filtro: FiltroTriagem,
  colunas = '*'
): Promise<AnyObj | null> {
  const { data } = await aplicaFiltro(client.from('triagem_hsm').select(colunas), filtro).maybeSingle()
  return (data as AnyObj | null) ?? null
}

/**
 * Atualiza só as chaves cujo valor difere do que está no banco. Devolve as chaves gravadas.
 * `atual` pode ser passado para poupar um SELECT (quando quem chama já leu a linha).
 */
export async function atualizarSeMudou(
  client: SupabaseClient,
  filtro: FiltroTriagem,
  patch: AnyObj,
  atual?: AnyObj | null
): Promise<string[]> {
  const campos = Object.keys(patch).filter((k) => patch[k] !== undefined)
  if (!campos.length) return []
  let row: AnyObj = atual ?? {}
  if (!atual) {
    row = (await lerTriagem(client, filtro, campos.join(','))) ?? {}
  }
  const diff: AnyObj = {}
  for (const k of campos) if (!igual(row[k], patch[k])) diff[k] = patch[k]
  if (!Object.keys(diff).length) return []

  await escreverComRedeDeSeguranca(client, filtro, diff)
  return Object.keys(diff)
}

/**
 * UPDATE que tolera coluna inexistente (migration ainda não rodada): remove a coluna do
 * patch e tenta de novo, em vez de derrubar a gravação inteira. Devolve a linha gravada.
 */
export async function escreverComRedeDeSeguranca(
  client: SupabaseClient,
  filtro: FiltroTriagem,
  patch: AnyObj,
  select = '*'
): Promise<AnyObj | null> {
  const pendente = { ...patch }
  for (let tentativa = 0; tentativa < 6; tentativa++) {
    if (!Object.keys(pendente).length) return null
    const { data, error } = await aplicaFiltro(client.from('triagem_hsm').update(pendente), filtro)
      .select(select)
      .maybeSingle()
    if (!error) return (data as AnyObj | null) ?? null
    const col = colunaAusente(error.message)
    if (col && col in pendente) {
      console.warn(`[triagem] coluna ausente no banco: ${col} — salvando sem ela (rode a migration)`)
      delete pendente[col]
      continue
    }
    throw new Error(error.message)
  }
  return null
}

export function colunaAusente(msg: string): string | null {
  if (!/column .* does not exist|could not find the .* column/i.test(msg)) return null
  return (
    msg.match(/column "?[\w.]*?\.?(\w+)"? does not exist/i)?.[1] ??
    msg.match(/could not find the '?(\w+)'? column/i)?.[1] ??
    null
  )
}

/** INSERT que tolera coluna inexistente (mesma rede de segurança do update). */
export async function inserirComRedeDeSeguranca(
  client: SupabaseClient,
  row: AnyObj,
  opts: { ignorarDuplicado?: boolean } = {}
): Promise<AnyObj | null> {
  const pendente = { ...row }
  for (let tentativa = 0; tentativa < 6; tentativa++) {
    const q = opts.ignorarDuplicado
      ? client.from('triagem_hsm').upsert(pendente, { onConflict: 'conversation_id', ignoreDuplicates: true })
      : client.from('triagem_hsm').insert(pendente)
    const { data, error } = await q.select('*').maybeSingle()
    if (!error) return (data as AnyObj | null) ?? null
    const col = colunaAusente(error.message)
    if (col && col in pendente) {
      console.warn(`[triagem] coluna ausente no banco: ${col} — inserindo sem ela (rode a migration)`)
      delete pendente[col]
      continue
    }
    throw new Error(error.message)
  }
  return null
}
