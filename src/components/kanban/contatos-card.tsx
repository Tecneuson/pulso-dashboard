'use client'

import { useEffect, useState } from 'react'
import { Loader2, Star, UserPlus, X } from 'lucide-react'
import {
  LIMITE_RESPONSAVEIS,
  PAPEL_CONTATO_LABELS,
  type ContatoVinculo,
  type PapelContato,
} from '@/types'
import { formatarCpf } from '@/lib/cpf'
import { useConsultores, useResponsaveis } from '@/lib/api-store'
import { PessoaField } from './pessoa-field'

/**
 * Contatos do card: todo mundo que já falou com o hospital sobre este paciente.
 *
 * O mesmo paciente costuma ter mais de uma pessoa ligando (pai, mãe, o consultor
 * que encaminhou), e a mesma pessoa aparece em vários pacientes — por isso é uma
 * lista, e não um campo. O limite de responsáveis é 4; do 5º em diante o contato
 * fica só no histórico.
 */

export function ContatosDoCard({ triagemId }: { triagemId: string }) {
  const [rows, setRows] = useState<ContatoVinculo[]>([])
  const [carregando, setCarregando] = useState(true)
  const [adicionando, setAdicionando] = useState<PapelContato | null>(null)
  const [pessoaId, setPessoaId] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const consultores = useConsultores()
  const responsaveis = useResponsaveis()

  useEffect(() => {
    let vivo = true
    setCarregando(true)
    fetch(`/api/contatos?triagem_id=${triagemId}`)
      .then((r) => r.json())
      .then((d) => {
        if (vivo && Array.isArray(d.rows)) setRows(d.rows)
      })
      .catch(() => {})
      .finally(() => vivo && setCarregando(false))
    return () => {
      vivo = false
    }
  }, [triagemId])

  const responsaveisVinculados = rows.filter((r) => r.papel === 'responsavel')
  const noLimite = responsaveisVinculados.length >= LIMITE_RESPONSAVEIS

  async function vincular() {
    if (!pessoaId || !adicionando) return
    setSalvando(true)
    setErro(null)
    try {
      const res = await fetch('/api/contatos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ triagem_id: triagemId, papel: adicionando, pessoa_id: pessoaId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'erro')
      setRows((prev) => [...prev, data.row])
      setPessoaId(null)
      setAdicionando(null)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao vincular')
    } finally {
      setSalvando(false)
    }
  }

  async function desvincular(id: string) {
    setRows((prev) => prev.filter((r) => r.id !== id))
    await fetch(`/api/contatos?id=${id}`, { method: 'DELETE' }).catch(() => {})
  }

  const botao =
    'inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1 text-xs text-content-secondary hover:bg-surface-tertiary transition-colors'

  return (
    <div className="rounded-lg border border-border p-4">
      <div className="flex items-center justify-between gap-2 mb-2">
        <h4 className="text-sm font-semibold text-content-primary">
          Contatos do paciente
          {rows.length > 0 && (
            <span className="ml-1.5 text-xs font-normal text-content-tertiary tabular-nums">
              {responsaveisVinculados.length}/{LIMITE_RESPONSAVEIS} responsáveis
            </span>
          )}
        </h4>
        {!adicionando && (
          <div className="flex items-center gap-1.5">
            <button type="button" className={botao} onClick={() => setAdicionando('responsavel')} disabled={noLimite}
              title={noLimite ? `Limite de ${LIMITE_RESPONSAVEIS} responsáveis atingido` : undefined}>
              <UserPlus size={12} /> Responsável
            </button>
            <button type="button" className={botao} onClick={() => setAdicionando('consultor')}>
              <UserPlus size={12} /> Consultor
            </button>
          </div>
        )}
      </div>

      {carregando ? (
        <p className="text-xs text-content-tertiary flex items-center gap-1.5">
          <Loader2 size={12} className="animate-spin" /> carregando…
        </p>
      ) : rows.length === 0 ? (
        <p className="text-xs text-content-tertiary">
          Ninguém vinculado ainda. Quem falar pelo WhatsApp é reconhecido pelo telefone e entra aqui
          automaticamente.
        </p>
      ) : (
        <div className="divide-y divide-border">
          {rows.map((v) => (
            <div key={v.id} className="flex items-start justify-between gap-2 py-2">
              <div className="min-w-0">
                <p className="text-sm text-content-primary truncate flex items-center gap-1.5">
                  {v.principal && <Star size={11} className="text-warning-500 shrink-0" aria-label="Primeiro contato" />}
                  {v.nome ?? '—'}
                  <span className="text-[11px] text-content-tertiary font-normal">
                    {PAPEL_CONTATO_LABELS[v.papel]}
                  </span>
                </p>
                {(v.telefones?.length || v.cpf) && (
                  <p className="text-xs text-content-tertiary truncate">
                    {[...(v.telefones ?? []), v.cpf ? formatarCpf(v.cpf) : null].filter(Boolean).join(' · ')}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => desvincular(v.id)}
                className="shrink-0 p-1 rounded text-content-tertiary hover:text-danger-500"
                aria-label={`Desvincular ${v.nome ?? ''}`}
                title="Desvincular (a ficha da pessoa continua cadastrada)"
              >
                <X size={13} />
              </button>
            </div>
          ))}
        </div>
      )}

      {adicionando && (
        <div className="mt-3 pt-3 border-t border-border space-y-2 animate-fade-up">
          <PessoaField
            label={adicionando === 'responsavel' ? 'Vincular responsável' : 'Vincular consultor'}
            itens={adicionando === 'responsavel' ? responsaveis.items : consultores.items}
            value={pessoaId}
            onChange={setPessoaId}
            onCriar={(p) => (adicionando === 'responsavel' ? responsaveis.add(p) : consultores.add(p))}
          />
          {erro && <p className="text-xs text-danger-500">{erro}</p>}
          <div className="flex items-center justify-end gap-2">
            <button type="button" className={botao} onClick={() => { setAdicionando(null); setPessoaId(null); setErro(null) }}>
              Cancelar
            </button>
            <button type="button" className={botao} onClick={vincular} disabled={!pessoaId || salvando}>
              {salvando ? <Loader2 size={12} className="animate-spin" /> : null} Vincular
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
