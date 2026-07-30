/**
 * Importação idempotente da base de pacientes (carrinho mensal) para a tabela `pacientes`.
 *
 * Uso:
 *   npx tsx scripts/import-pacientes.ts --dry           # só analisa o CSV (não toca no banco)
 *   npx tsx scripts/import-pacientes.ts                 # importa (precisa SUPABASE_SERVICE_ROLE_KEY no .env.local)
 *   npx tsx scripts/import-pacientes.ts --emit-sql      # gera scripts/sql/pacientes_batch_*.sql (p/ rodar via MCP, sem service_role)
 *   CSV=/caminho/arquivo.csv npx tsx scripts/import-pacientes.ts ...
 *
 * CSV novo (16 colunas, com CPF e telefones) — ordem 0-indexed:
 *   0 data_de_emissao_completa_max   1 data_de_emissao_completa_min   2 sub_familia_produto
 *   3 identificador_cliente          4 identificador_produto          5 classificacao_cliente
 *   6 mes_rexis                      7 nome_cliente                   8 convenio
 *   9 tel  10 tel_1  11 tel_2  12 tel_3  13 tel_4
 *   14 penultima_internacao          15 cpf (com máscara)
 *
 * Idempotente: UPSERT ON CONFLICT(identificador_cliente) atualizando SÓ colunas do CSV —
 * nunca toca estagio_reativacao/observacoes/tags/responsavel_id (trabalho da equipe).
 * O CSV novo NÃO traz `classificacao_produto`; essa coluna fica FORA do UPSERT (preservada).
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { normalizarConvenio, extrairCid, CONVENIOS_PUBLICOS } from '../src/lib/convenios'
import { cpfValido, normalizarCpf } from '../src/lib/cpf'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const ORIGEM_CARGA = 'csv_2026_07'
const BATCH = 500

const DRY = process.argv.includes('--dry')
const EMIT_SQL = process.argv.includes('--emit-sql')
const CSV_PATH = process.env.CSV || join(ROOT, '..', 'draive.Carrinho_HospitalSantaMonicaCOMCPF.csv')

type Row = {
  identificador_cliente: number
  nome_cliente: string
  convenio_raw: string
  convenio_normalizado: string
  classificacao_cliente: string | null
  identificador_produto: string | null
  cid_codigo: string | null
  sub_familia_produto: string | null
  mes_rexis: string | null
  data_emissao_max: string | null
  data_emissao_min: string | null
  penultima_internacao: string | null
  cpf: string | null
  telefones: string[]
  origem_carga: string
  raw: Record<string, string>
}

function toDate(v: string | undefined): string | null {
  if (!v) return null
  const s = v.trim()
  if (!s) return null
  const d = s.slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null
}

/**
 * Limpa um telefone: mantém só dígitos e descarta lixo.
 * Descarta: vazio, < 8 dígitos, todos-zeros, ou placeholder tipo (0XX)00000-0000
 * (corpo do assinante — os últimos 8 dígitos — todo zero).
 * Retorna a string de dígitos (com DDD/tronco preservados) ou null.
 */
function limparTelefone(raw: string): string | null {
  const d = raw.replace(/\D/g, '')
  if (d.length < 8) return null
  if (/^0+$/.test(d)) return null
  if (/^0+$/.test(d.slice(-8))) return null
  return d
}

/** Junta as 5 colunas de telefone, limpa, dedup preservando ordem. */
function extrairTelefones(cols: string[]): string[] {
  const out: string[] = []
  for (const c of cols) {
    const t = limparTelefone(c)
    if (t && !out.includes(t)) out.push(t)
  }
  return out
}

function parseCsv(): { rows: Row[]; descartadas: number; telefonesLixo: number } {
  const text = readFileSync(CSV_PATH, 'utf8')
  const lines = text.split(/\r?\n/).filter((l) => l.length > 0)
  const header = lines[0].split(',')
  const rows: Row[] = []
  let descartadas = 0
  let telefonesLixo = 0

  for (let i = 1; i < lines.length; i++) {
    const f = lines[i].split(',')
    if (f.length !== 16) { descartadas++; continue }
    const id = parseInt(f[3], 10)
    if (!Number.isFinite(id)) { descartadas++; continue }

    const raw: Record<string, string> = {}
    header.forEach((h, idx) => (raw[h] = f[idx]))

    const telCols = f.slice(9, 14)
    const telefones = extrairTelefones(telCols)
    telefonesLixo += telCols.filter((c) => c.trim() && limparTelefone(c) === null).length

    rows.push({
      identificador_cliente: id,
      nome_cliente: f[7].trim(),
      convenio_raw: f[8].trim(),
      convenio_normalizado: normalizarConvenio(f[8]),
      classificacao_cliente: f[5].trim() || null,
      identificador_produto: f[4].trim() || null,
      cid_codigo: extrairCid(f[4]),
      sub_familia_produto: f[2].trim() || null,
      mes_rexis: f[6].trim() || null,
      data_emissao_max: toDate(f[0]),
      data_emissao_min: toDate(f[1]),
      penultima_internacao: toDate(f[14]),
      cpf: cpfValido(f[15]) ? normalizarCpf(f[15]) : null,
      telefones,
      origem_carga: ORIGEM_CARGA,
      raw,
    })
  }
  if (descartadas) console.warn(`⚠️  ${descartadas} linha(s) descartada(s) (NF!=16 ou id inválido)`)
  return { rows, descartadas, telefonesLixo }
}

function printSummary(rows: Row[], telefonesLixo: number) {
  console.log(`\n=== RESUMO (${rows.length} pacientes) ===`)
  const uniq = new Set(rows.map((r) => r.identificador_cliente))
  console.log(`IDs únicos: ${uniq.size} ${uniq.size === rows.length ? '✓' : '⚠️ HÁ DUPLICADOS'}`)

  const byConv = new Map<string, number>()
  let publicos = 0
  let comCid = 0
  let comCpf = 0
  let comTel = 0
  let totalTel = 0
  for (const r of rows) {
    byConv.set(r.convenio_normalizado, (byConv.get(r.convenio_normalizado) ?? 0) + 1)
    if (CONVENIOS_PUBLICOS.has(r.convenio_normalizado)) publicos++
    if (r.cid_codigo) comCid++
    if (r.cpf) comCpf++
    if (r.telefones.length) { comTel++; totalTel += r.telefones.length }
  }
  console.log(`Convênios normalizados distintos: ${byConv.size}`)
  console.log(`Pacientes com pagador público/autogestão: ${publicos}`)
  console.log(`Pacientes com CID identificado: ${comCid}`)
  console.log(`Pacientes com CPF válido: ${comCpf} (${((comCpf / rows.length) * 100).toFixed(1)}%)`)
  console.log(`Pacientes com ≥1 telefone: ${comTel} (${totalTel} telefones; ${telefonesLixo} descartados por lixo)`)
  console.log('\nTop 20 convênios normalizados:')
  Array.from(byConv.entries()).sort((a, b) => b[1] - a[1]).slice(0, 20)
    .forEach(([slug, n]) => console.log(`  ${String(n).padStart(5)}  ${slug}`))
  console.log('\nAmostra (3 primeiras):')
  rows.slice(0, 3).forEach((r) =>
    console.log(
      `  #${r.identificador_cliente} ${r.nome_cliente} | ${r.convenio_raw} -> ${r.convenio_normalizado} | CID ${r.cid_codigo ?? '-'}` +
      ` | CPF ${r.cpf ?? '-'} | tel [${r.telefones.join(', ') || '-'}]`
    )
  )
}

function sqlEscape(v: string | number | null): string {
  if (v === null) return 'NULL'
  if (typeof v === 'number') return String(v)
  return `'${v.replace(/'/g, "''")}'`
}
function sqlEscapeStr(v: string | null): string { return v === null ? 'NULL' : sqlEscape(v) }

/** text[] literal para SQL. Vazio -> '{}'::text[]; senão ARRAY['..','..']::text[] com escape. */
function sqlTextArray(arr: string[]): string {
  if (arr.length === 0) return `'{}'::text[]`
  return `ARRAY[${arr.map((x) => sqlEscape(x)).join(',')}]::text[]`
}

const COLS = [
  'identificador_cliente', 'nome_cliente', 'convenio_raw', 'convenio_normalizado',
  'classificacao_cliente', 'identificador_produto', 'cid_codigo',
  'sub_familia_produto', 'mes_rexis', 'data_emissao_max', 'data_emissao_min',
  'penultima_internacao', 'cpf', 'telefones', 'origem_carga', 'raw',
] as const

function rowValues(r: Row): string {
  const vals = [
    r.identificador_cliente, sqlEscapeStr(r.nome_cliente), sqlEscapeStr(r.convenio_raw),
    sqlEscapeStr(r.convenio_normalizado), sqlEscapeStr(r.classificacao_cliente),
    sqlEscapeStr(r.identificador_produto), sqlEscapeStr(r.cid_codigo),
    sqlEscapeStr(r.sub_familia_produto), sqlEscapeStr(r.mes_rexis),
    sqlEscapeStr(r.data_emissao_max), sqlEscapeStr(r.data_emissao_min),
    sqlEscapeStr(r.penultima_internacao), sqlEscapeStr(r.cpf), sqlTextArray(r.telefones),
    sqlEscapeStr(r.origem_carga), `${sqlEscape(JSON.stringify(r.raw))}::jsonb`,
  ]
  return `(${vals.join(',')})`
}

function buildUpsertSql(batch: Row[]): string {
  const updates = COLS.filter((c) => c !== 'identificador_cliente')
    .map((c) => `${c}=EXCLUDED.${c}`)
    .join(', ')
  return (
    `INSERT INTO public.pacientes (${COLS.join(',')}) VALUES\n` +
    batch.map(rowValues).join(',\n') +
    `\nON CONFLICT (identificador_cliente) DO UPDATE SET ${updates};`
  )
}

function emitSql(rows: Row[]) {
  const outDir = join(ROOT, 'scripts', 'sql')
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true })
  let n = 0
  for (let i = 0; i < rows.length; i += BATCH) {
    n++
    const file = join(outDir, `pacientes_batch_${String(n).padStart(3, '0')}.sql`)
    writeFileSync(file, buildUpsertSql(rows.slice(i, i + BATCH)))
  }
  console.log(`\n✓ ${n} arquivo(s) SQL gerados em scripts/sql/ (lotes de ${BATCH}).`)
}

function readEnv(key: string): string | undefined {
  try {
    const env = readFileSync(join(ROOT, '.env.local'), 'utf8')
    const m = env.match(new RegExp(`^${key}=(.*)$`, 'm'))
    return m?.[1]?.trim() || undefined
  } catch {
    return process.env[key]
  }
}

async function upsertViaServiceRole(rows: Row[]) {
  const url = readEnv('NEXT_PUBLIC_SUPABASE_URL')
  const key = readEnv('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !key) {
    console.error('✗ Faltam NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY no .env.local.')
    console.error('  Use --dry (analisar) ou --emit-sql (gerar SQL p/ rodar via MCP) ou preencha a service_role.')
    process.exit(1)
  }
  const { createClient } = await import('@supabase/supabase-js')
  const supa = createClient(url, key, { auth: { persistSession: false } })

  let ok = 0
  for (let i = 0; i < rows.length; i += BATCH) {
    // telefones é array JS normal; supabase-js serializa como text[]. cpf string|null.
    const batch = rows.slice(i, i + BATCH).map(({ raw, ...rest }) => ({ ...rest, raw }))
    const { error } = await supa.from('pacientes').upsert(batch, { onConflict: 'identificador_cliente' })
    if (error) { console.error(`✗ Lote ${i / BATCH + 1}:`, error.message); process.exit(1) }
    ok += batch.length
    console.log(`  ✓ ${ok}/${rows.length}`)
  }
  console.log(`\n✓ Importação concluída: ${ok} pacientes.`)
}

async function main() {
  console.log(`CSV: ${CSV_PATH}`)
  const { rows, telefonesLixo } = parseCsv()
  printSummary(rows, telefonesLixo)
  if (DRY) return
  if (EMIT_SQL) { emitSql(rows); return }
  await upsertViaServiceRole(rows)
}

main().catch((e) => { console.error(e); process.exit(1) })
