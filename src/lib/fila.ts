/**
 * Fila simples em memória, uma por chave. Serializa o processamento de eventos da
 * MESMA conversa sem bloquear conversas diferentes.
 *
 * Por que: os handlers do webhook leem a linha, comparam e gravam a diferença. Dois
 * eventos da mesma conversa chegando juntos (o Chatwoot dispara vários por ação)
 * fariam leitura-escrita concorrente e um sobrescreveria o outro. Enfileirando por
 * `conversation_id`, cada conversa é processada em ordem.
 *
 * Escopo: uma instância do app. Com várias réplicas, a garantia vira "por réplica" —
 * o `atualizarSeMudou` (que só grava o que mudou) continua sendo a rede de segurança.
 */

const filas = new Map<string, Promise<unknown>>()

export function enfileirar<T>(chave: string, tarefa: () => Promise<T>): Promise<T> {
  const anterior = filas.get(chave) ?? Promise.resolve()
  // O `catch` evita que uma falha anterior derrube os próximos da fila.
  const atual = anterior.catch(() => {}).then(tarefa)
  filas.set(chave, atual)
  // Limpa a chave quando esta foi a última tarefa (senão o Map cresce sem parar).
  void atual.catch(() => {}).finally(() => {
    if (filas.get(chave) === atual) filas.delete(chave)
  })
  return atual
}

export function tamanhoDaFila(): number {
  return filas.size
}
