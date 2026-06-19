/**
 * Normalização de convênios.
 *
 * O CSV traz `convenio` como texto livre com ~90 variações. Guardamos SEMPRE o valor
 * original (convenio_raw) e derivamos um slug de OPERADORA (convenio_normalizado) só para
 * filtro/agrupamento — sem perder informação, já que o raw é preservado.
 *
 * Usado tanto na importação (scripts/import-pacientes.ts) quanto nos filtros do front.
 */

function canonical(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // remove acentos
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim()
}

// Regras ordenadas: a primeira que casar vence. Específicas antes das genéricas.
const REGRAS: Array<[RegExp, string]> = [
  [/^PARTICULAR/, 'particular'],
  [/SUL AMERICA/, 'sulamerica'],
  [/^AMIL/, 'amil'],
  [/BRADESCO/, 'bradesco'],
  [/PREVENT SENIOR/, 'prevent_senior'],
  // Grupo GNDI / NotreDame / Intermédica / Greenline
  [/NOTREDAME|INTERMEDICA|GREENLINE|GNDI/, 'gndi'],
  [/HAPVIDA/, 'hapvida'],
  [/CENTRAL NACIONAL/, 'central_nacional'], // Unimed CNU (LOCAL/INTERCÂMBIO no raw)
  [/UNIMED/, 'unimed'],
  [/SOMPO/, 'sompo'],
  [/OMINT/, 'omint'],
  [/PORTO SEGURO/, 'porto_seguro'],
  [/ALLIANZ/, 'allianz'],
  [/MAPFRE/, 'mapfre'],
  [/CARE PLUS/, 'care_plus'],
  [/QSAUDE/, 'qsaude'],
  [/TRASMONTANO/, 'trasmontano'],
  [/MEDISERVICE/, 'mediservice'],
  [/BIOVIDAS/, 'biovidas'],
  [/BIO SAUDE/, 'bio_saude'],
  [/SAMI/, 'sami'],
  [/GAMA SAUDE/, 'gama_saude'],
  [/ITALICA/, 'italica'],
  [/TOTAL MEDCARE/, 'total_medcare'],
  [/MED.?TOUR/, 'med_tour'],
  [/CRUZ AZUL/, 'cruz_azul'],
  [/AMAFRESP/, 'amafresp'],
  [/LIFE EMPRESARIAL/, 'life'],
  [/SANTAMALIA/, 'santamalia'],
  [/MEDSENIOR/, 'medsenior'],
  [/TEMPO SAUDE/, 'tempo'],
  [/MEDISANITAS/, 'medisanitas'],
  [/SBC SAUDE/, 'sbc'],
  [/PROASA/, 'proasa'],
  [/CUIDAR/, 'cuidar_me'],
  [/ATIVIA/, 'ativia'],
  [/ABERTTA/, 'abertta'],
  [/ANA COSTA/, 'ana_costa'],
  [/SAO CAMILO/, 'sao_camilo'],
  [/PLAN ASSISTE/, 'plan_assiste'],
  [/^ABET/, 'abet'],
  [/SAO CRISTOVAO/, 'sao_cristovao'],
  [/SANTA CASA/, 'santa_casa'],
  [/ALICE/, 'alice'],
  [/ALVORECER|BLUE MED|^BLUE$/, 'blue_med'],
  [/HOSPITAL REGIONAL DE FRANCA/, 'hospital_franca'],
  [/ITALICA/, 'italica'],
  // ---- Públicos / autogestão (não são alvo comercial de reativação) ----
  [/^SUS$/, 'sus'],
  [/AUTARQUIA HOSPITALAR MUNICIPAL/, 'autarquia_municipal'],
  [/SAUDE CAIXA/, 'saude_caixa'],
  [/POSTAL SAUDE/, 'postal_saude'],
  [/FUSEX/, 'fusex'],
  [/AERONAUTICA/, 'aeronautica'],
  [/MARINHA/, 'marinha'],
  [/BANCO CENTRAL/, 'banco_central'],
  [/SABESPREV/, 'sabesprev'],
  [/VIVEST/, 'vivest'],
  [/METRUS/, 'metrus'],
  [/ECONOMUS/, 'economus'],
  [/SEPACO/, 'sepaco'],
  [/GEAP/, 'geap'],
  [/CETESB/, 'cetesb'],
  [/EMBRATEL/, 'embratel'],
  [/FILANTROPICO/, 'filantropico'],
]

/** Slugs considerados pagadores públicos / autogestão (filtrar à parte da reativação comercial). */
export const CONVENIOS_PUBLICOS = new Set<string>([
  'sus', 'autarquia_municipal', 'saude_caixa', 'postal_saude', 'fusex', 'aeronautica',
  'marinha', 'banco_central', 'sabesprev', 'vivest', 'metrus', 'economus', 'sepaco',
  'geap', 'cetesb', 'embratel', 'filantropico',
])

/**
 * Converte o convênio bruto do CSV num slug de operadora. Cobre o grosso do volume;
 * a cauda longa cai num slug derivado do próprio texto (sempre com o raw preservado).
 */
export function normalizarConvenio(raw: string | null | undefined): string {
  if (!raw || !raw.trim()) return 'nao_informado'
  const s = canonical(raw)
  if (s === 'NAO INFORMADO') return 'nao_informado'
  for (const [re, slug] of REGRAS) {
    if (re.test(s)) return slug
  }
  // fallback: slug do texto (ex: "GEAP SAUDE" -> "geap_saude")
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'outro'
}

/** Rótulo amigável a partir do slug, para filtros/badges. */
export function rotuloConvenio(slug: string): string {
  const fixos: Record<string, string> = {
    sulamerica: 'SulAmérica', amil: 'Amil', bradesco: 'Bradesco', gndi: 'GNDI / NotreDame',
    prevent_senior: 'Prevent Sênior', central_nacional: 'Central Nacional', unimed: 'Unimed',
    particular: 'Particular', sompo: 'Sompo', omint: 'Omint', porto_seguro: 'Porto Seguro',
    care_plus: 'Care Plus', sus: 'SUS', saude_caixa: 'Saúde Caixa', postal_saude: 'Postal Saúde',
    nao_informado: 'Não informado', hapvida: 'Hapvida',
  }
  if (fixos[slug]) return fixos[slug]
  return slug.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

/** Extrai o código CID do `identificador_produto` (ex: "F32:1" -> "F32"; "Não Informado:1" -> null). */
export function extrairCid(identificadorProduto: string | null | undefined): string | null {
  if (!identificadorProduto) return null
  const prefixo = identificadorProduto.split(':')[0]?.trim()
  if (!prefixo || /^N[ãa]o Informado$/i.test(prefixo)) return null
  // CID-10 começa com letra; evita capturar lixo
  return /^[A-Z]\d/i.test(prefixo) ? prefixo.toUpperCase() : null
}
