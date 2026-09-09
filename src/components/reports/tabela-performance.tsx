'use client'

import { useMemo, useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import type { Linha } from '@/lib/bi'

/**
 * Tabela de performance com cabeçalho clicável para ordenar.
 *
 * A ordenação é local (os dados já vieram calculados do servidor) e não mexe na
 * querystring: quem está lendo o relatório quer reordenar sem recarregar a página
 * inteira nem perder o período filtrado.
 *
 * O primeiro clique numa coluna numérica ordena do MAIOR para o menor — é o que se
 * quer ao perguntar "quem internou mais?". Na coluna de nome, começa em A→Z.
 */

type Campo = 'label' | 'contatos' | 'conversas' | 'internacoes' | 'perdas' | 'taxa'

const COLUNAS: { campo: Campo; titulo: string; numerica: boolean }[] = [
  { campo: 'label', titulo: '', numerica: false },
  { campo: 'contatos', titulo: 'Contatos', numerica: true },
  { campo: 'conversas', titulo: 'Conversas', numerica: true },
  { campo: 'internacoes', titulo: 'Internações', numerica: true },
  { campo: 'perdas', titulo: 'Perdas', numerica: true },
  { campo: 'taxa', titulo: 'Conversão', numerica: true },
]

const th = 'font-medium px-3 py-2 text-xs uppercase tracking-wide text-content-tertiary select-none'
const td = 'px-3 py-2 tabular-nums'

export function TabelaPerformance({
  linhas,
  primeiraColuna,
  total,
  motivos = true,
  ordemInicial = 'internacoes',
  vazio = 'Sem dados no período',
}: {
  linhas: Linha[]
  primeiraColuna: string
  total?: Linha
  motivos?: boolean
  ordemInicial?: Campo
  vazio?: string
}) {
  const [campo, setCampo] = useState<Campo>(ordemInicial)
  const [desc, setDesc] = useState(true)

  const ordenadas = useMemo(() => {
    const copia = [...linhas]
    copia.sort((a, b) => {
      if (campo === 'label') return a.label.localeCompare(b.label, 'pt-BR')
      return (a[campo] as number) - (b[campo] as number)
    })
    return desc ? copia.reverse() : copia
  }, [linhas, campo, desc])

  function ordenarPor(c: Campo, numerica: boolean) {
    if (c === campo) {
      setDesc(!desc)
      return
    }
    setCampo(c)
    setDesc(numerica) // número começa do maior; texto começa em A→Z
  }

  if (!linhas.length) return <p className="text-sm text-content-tertiary py-10 text-center">{vazio}</p>

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-surface-tertiary">
            {COLUNAS.map((c) => {
              const ativo = campo === c.campo
              return (
                <th
                  key={c.campo}
                  scope="col"
                  aria-sort={ativo ? (desc ? 'descending' : 'ascending') : 'none'}
                  className={`${th} ${c.numerica ? 'text-right' : 'text-left'}`}
                >
                  <button
                    type="button"
                    onClick={() => ordenarPor(c.campo, c.numerica)}
                    className={`inline-flex items-center gap-1 hover:text-content-primary transition-colors ${
                      ativo ? 'text-content-primary' : ''
                    } ${c.numerica ? 'flex-row-reverse' : ''}`}
                    title="Ordenar por esta coluna"
                  >
                    {c.campo === 'label' ? primeiraColuna : c.titulo}
                    {ativo &&
                      (desc ? <ChevronDown className="w-3 h-3 shrink-0" /> : <ChevronUp className="w-3 h-3 shrink-0" />)}
                  </button>
                </th>
              )
            })}
            {motivos && <th className={`${th} text-left`}>Motivos de perda</th>}
          </tr>
        </thead>
        <tbody>
          {ordenadas.map((l) => (
            <tr key={l.chave} className="border-t border-border align-top">
              <td className={`${td} font-medium text-content-primary`}>{l.label}</td>
              <td className={`${td} text-right`}>{l.contatos}</td>
              <td className={`${td} text-right`}>{l.conversas}</td>
              <td className={`${td} text-right text-success-600 dark:text-success-500`}>{l.internacoes}</td>
              <td className={`${td} text-right text-danger-600 dark:text-danger-500`}>{l.perdas}</td>
              <td className={`${td} text-right`}>{l.taxa}%</td>
              {motivos && (
                <td className={`${td} text-xs text-content-secondary`}>
                  {l.motivos && l.motivos.length
                    ? l.motivos
                        .slice(0, 4)
                        .map((m) => `${m.label} (${m.count})`)
                        .join(' · ') + (l.motivos.length > 4 ? ` · +${l.motivos.length - 4}` : '')
                    : '—'}
                </td>
              )}
            </tr>
          ))}
        </tbody>
        {total && (
          <tfoot>
            <tr className="border-t-2 border-border-strong bg-surface-tertiary/60 font-semibold">
              <td className={`${td} text-content-primary`}>{total.label}</td>
              <td className={`${td} text-right`}>{total.contatos}</td>
              <td className={`${td} text-right`}>{total.conversas}</td>
              <td className={`${td} text-right text-success-600 dark:text-success-500`}>{total.internacoes}</td>
              <td className={`${td} text-right text-danger-600 dark:text-danger-500`}>{total.perdas}</td>
              <td className={`${td} text-right`}>{total.taxa}%</td>
              {motivos && <td className={td} />}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  )
}
