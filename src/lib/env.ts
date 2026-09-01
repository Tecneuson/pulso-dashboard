/**
 * Leitura centralizada das variáveis de ambiente do servidor (nunca importar em
 * componente client — use `process.env.NEXT_PUBLIC_*` literal lá).
 */

export function isProd(): boolean {
  return process.env.NODE_ENV === 'production'
}

/**
 * Enquanto o n8n estiver ativo (padrão), o app NÃO executa as tarefas que o n8n já
 * faz (criar lead no 1º contato, pausar bot, encerrar inativas, bot Mônica)
 * — senão os dois disputam. `N8N_ATIVO=0` liga o "modo sem n8n".
 */
export function n8nAtivo(): boolean {
  return process.env.N8N_ATIVO !== '0'
}

/** Bloqueia encerrar conversa no Chatwoot sem venda/motivo de perda (padrão: ligado). */
export function exigirDesfecho(): boolean {
  return process.env.CHATWOOT_EXIGIR_DESFECHO !== '0'
}

/** Assuntos isentos da exigência de desfecho (ex.: "consulta,administrativo"). Padrão: nenhum. */
export function assuntosIsentosDesfecho(): string[] {
  return (process.env.CHATWOOT_DESFECHO_ASSUNTOS_ISENTOS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

/** Nome do usuário do bot no Chatwoot (mensagens dele não pausam o bot). */
export function botNome(): string {
  return process.env.CHATWOOT_BOT_NAME || 'Moniquinha'
}

/** Bot Mônica dentro do app (modo sem n8n). Exige BOT_ENABLED=1 e OPENAI_API_KEY. */
export function botAtivo(): boolean {
  return process.env.BOT_ENABLED === '1' && !!process.env.OPENAI_API_KEY && !n8nAtivo()
}

/** Limites de inatividade (minutos) por etapa, para o encerramento automático. */
export function limitesInatividade(): Record<string, number> {
  const parse = (v: string | undefined, d: number) => {
    const n = Number(v)
    return Number.isFinite(n) && n > 0 ? n : d
  }
  return {
    contato: parse(process.env.INATIVIDADE_CONTATO_MIN, 10),
    atendendo: parse(process.env.INATIVIDADE_ATENDENDO_MIN, 30),
    negociando: parse(process.env.INATIVIDADE_NEGOCIANDO_MIN, 30),
  }
}
