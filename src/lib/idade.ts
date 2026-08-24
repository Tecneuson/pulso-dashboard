/**
 * Idade e classificação "Kids" (unidade infantojuvenil: 8 a 17 anos).
 * Puro (sem I/O) — usado no servidor (API, webhook) e no cliente (badge do card).
 */

export const KIDS_IDADE_MIN = 8
export const KIDS_IDADE_MAX = 17

/** Idade completa em anos a partir de YYYY-MM-DD. null se a data for inválida/ausente. */
export function idadeEm(dataNascimento: string | null | undefined, hoje: Date = new Date()): number | null {
  if (!dataNascimento) return null
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dataNascimento)
  if (!m) return null
  const ano = Number(m[1])
  const mes = Number(m[2])
  const dia = Number(m[3])
  if (!ano || mes < 1 || mes > 12 || dia < 1 || dia > 31) return null
  let idade = hoje.getFullYear() - ano
  const aindaNaoFezAniversario =
    hoje.getMonth() + 1 < mes || (hoje.getMonth() + 1 === mes && hoje.getDate() < dia)
  if (aindaNaoFezAniversario) idade -= 1
  if (idade < 0 || idade > 130) return null
  return idade
}

/**
 * Kids = paciente entre 8 e 17 anos (inclusive). Retorna null quando não dá para saber
 * (sem data de nascimento) — assim o campo no banco/Chatwoot fica "não avaliado" em vez de "Não".
 */
export function isKids(dataNascimento: string | null | undefined, hoje: Date = new Date()): boolean | null {
  const idade = idadeEm(dataNascimento, hoje)
  if (idade == null) return null
  return idade >= KIDS_IDADE_MIN && idade <= KIDS_IDADE_MAX
}
