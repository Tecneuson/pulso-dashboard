/**
 * Utilidades de CPF — identificador único do paciente.
 *
 * Guardamos SEMPRE o CPF normalizado (11 dígitos, só números) na coluna
 * `pacientes.cpf` / `triagem_hsm.cpf`, para casar lead↔paciente de forma
 * determinística. A formatação com máscara é só apresentação.
 */

/** Normaliza para 11 dígitos (só números). Retorna null se não tiver 11 dígitos. */
export function normalizarCpf(raw: string | null | undefined): string | null {
  if (!raw) return null
  const d = raw.replace(/\D/g, '')
  return d.length === 11 ? d : null
}

/** Valida CPF pelos dígitos verificadores; rejeita sequências repetidas (000…, 111…). */
export function cpfValido(raw: string | null | undefined): boolean {
  const cpf = normalizarCpf(raw)
  if (!cpf) return false
  if (/^(\d)\1{10}$/.test(cpf)) return false
  const digito = (base: string, pesoInicial: number): number => {
    let soma = 0
    for (let i = 0; i < base.length; i++) soma += parseInt(base[i], 10) * (pesoInicial - i)
    const resto = (soma * 10) % 11
    return resto === 10 ? 0 : resto
  }
  const d1 = digito(cpf.slice(0, 9), 10)
  const d2 = digito(cpf.slice(0, 10), 11)
  return d1 === parseInt(cpf[9], 10) && d2 === parseInt(cpf[10], 10)
}

/** Formata 11 dígitos como 000.000.000-00. Se não normalizar, devolve o valor cru. */
export function formatarCpf(raw: string | null | undefined): string {
  const d = normalizarCpf(raw)
  if (!d) return raw ?? ''
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`
}
