/**
 * Imagens anexadas ao card. O arquivo mora no Chatwoot (nota privada com anexo);
 * o Pulso guarda só os links em `anotacoes.anexos`. Usado no cliente e no servidor.
 */

export interface AnexoNota {
  /** Id do attachment no Chatwoot. */
  id: number | null
  url: string
  thumb_url: string | null
  nome: string | null
  tamanho: number | null
  largura: number | null
  altura: number | null
}

export const ANEXO_MAX_BYTES = 10 * 1024 * 1024
export const ANEXO_TIPOS = ['image/jpeg', 'image/png', 'image/webp'] as const
export const ANEXO_ACCEPT = ANEXO_TIPOS.join(',')

/** Texto gravado em `conteudo` quando a imagem vai sem legenda. */
export const NOTA_SEM_LEGENDA = '📎 Imagem'

/** Confere o tipo pelos primeiros bytes (não confia na extensão nem no Content-Type). */
export function tipoDaImagem(bytes: Uint8Array): (typeof ANEXO_TIPOS)[number] | null {
  if (bytes.length < 12) return null
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg'
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return 'image/png'
  const ascii = (i: number, s: string) => s.split('').every((c, k) => bytes[i + k] === c.charCodeAt(0))
  if (ascii(0, 'RIFF') && ascii(8, 'WEBP')) return 'image/webp'
  return null
}

/** Attachments de uma mensagem do Chatwoot (API ou webhook) → só as imagens, no nosso formato. */
export function anexosDeImagem(attachments: unknown): AnexoNota[] {
  if (!Array.isArray(attachments)) return []
  const out: AnexoNota[] = []
  for (const a of attachments as Record<string, unknown>[]) {
    if (!a || a.file_type !== 'image' || typeof a.data_url !== 'string' || !/^https?:\/\//.test(a.data_url)) continue
    const num = (v: unknown) => (Number.isFinite(Number(v)) && v != null ? Number(v) : null)
    let nome: string | null = null
    try {
      nome = decodeURIComponent(new URL(a.data_url).pathname.split('/').pop() || '') || null
    } catch {
      nome = null
    }
    out.push({
      id: num(a.id),
      url: a.data_url,
      thumb_url: typeof a.thumb_url === 'string' && a.thumb_url ? a.thumb_url : null,
      nome,
      tamanho: num(a.file_size),
      largura: num(a.width),
      altura: num(a.height),
    })
  }
  return out
}

export function tamanhoLegivel(bytes: number | null | undefined): string {
  if (!bytes) return ''
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} MB`
}
