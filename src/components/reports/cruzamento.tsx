'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import type { Cruzamento } from '@/lib/bi'

/**
 * Cruzamento de duas dimensões — "Motivo de perda × Convênio" e afins.
 *
 * A escolha vai para a querystring e o servidor recalcula, pelo mesmo motivo dos
 * filtros de período: o link fica compartilhável e o cálculo continua no servidor,
 * onde os leads já estão carregados.
 *
 * As células ganham fundo proporcional ao maior valor da matriz: o olho encontra a
 * concentração antes de ler os números (ex.: quase toda perda de um convênio caindo
 * num único motivo).
 */

export function TabelaCruzamento({
  dados,
  dimensoes,
  linhaAtual,
  colunaAtual,
}: {
  dados: Cruzamento
  dimensoes: { chave: string; label: string }[]
  linhaAtual: string
  colunaAtual: string
}) {
  const router = useRouter()
  // A mesma tela abre em /reports e dentro do Chatwoot (/embed/painel/relatorios).
  const pathname = usePathname()
  const sp = useSearchParams()

  function push(chave: string, valor: string) {
    const params = new URLSearchParams(sp.toString())
    params.set(chave, valor)
    router.push(`${pathname}?${params.toString()}`)
  }

  const sel =
    'h-9 rounded bg-surface-secondary border border-border text-sm px-2 text-content-primary focus:outline-none focus:ring-2 focus:ring-brand-500/40'
  const maior = Math.max(1, ...dados.linhas.flatMap((l) => l.celulas))

  return (
    <div>
      <div className="flex flex-wrap items-end gap-3 mb-4">
        <div>
          <p className="text-xs text-content-secondary mb-1">Linhas</p>
          <select className={sel} value={linhaAtual} onChange={(e) => push('cruzA', e.target.value)}>
            {dimensoes.map((d) => (
              <option key={d.chave} value={d.chave}>
                {d.label}
              </option>
            ))}
          </select>
        </div>
        <span className="pb-2 text-content-tertiary">x</span>
        <div>
          <p className="text-xs text-content-secondary mb-1">Colunas</p>
          <select className={sel} value={colunaAtual} onChange={(e) => push('cruzB', e.target.value)}>
            {dimensoes.map((d) => (
              <option key={d.chave} value={d.chave}>
                {d.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {!dados.linhas.length ? (
        <p className="text-sm text-content-tertiary py-10 text-center">
          Nenhum lead tem as duas informações preenchidas no período.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface-tertiary">
                <th className="text-left font-medium px-3 py-2 text-xs uppercase tracking-wide text-content-tertiary sticky left-0 bg-surface-tertiary">
                  {dimensoes.find((d) => d.chave === linhaAtual)?.label}
                </th>
                {dados.colunas.map((c) => (
                  <th
                    key={c.chave}
                    className="text-right font-medium px-3 py-2 text-xs uppercase tracking-wide text-content-tertiary whitespace-nowrap"
                  >
                    {c.label}
                  </th>
                ))}
                <th className="text-right font-medium px-3 py-2 text-xs uppercase tracking-wide text-content-secondary">
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {dados.linhas.map((l) => (
                <tr key={l.chave} className="border-t border-border">
                  <td className="px-3 py-2 font-medium text-content-primary sticky left-0 bg-surface-primary whitespace-nowrap">
                    {l.label}
                  </td>
                  {l.celulas.map((n, i) => (
                    <td
                      key={dados.colunas[i].chave}
                      className="px-3 py-2 text-right tabular-nums"
                      style={n ? { backgroundColor: `rgb(46 144 250 / ${0.06 + (n / maior) * 0.28})` } : undefined}
                    >
                      {n || '—'}
                    </td>
                  ))}
                  <td className="px-3 py-2 text-right tabular-nums font-semibold text-content-primary">{l.total}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-border-strong bg-surface-tertiary/60 font-semibold">
                <td className="px-3 py-2 sticky left-0 bg-surface-tertiary/60">Total</td>
                {dados.colunas.map((c) => (
                  <td key={c.chave} className="px-3 py-2 text-right tabular-nums">
                    {c.total}
                  </td>
                ))}
                <td className="px-3 py-2 text-right tabular-nums">{dados.total}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  )
}
