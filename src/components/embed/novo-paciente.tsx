'use client'

import { useState, type FormEvent } from 'react'
import { Button, Input } from '@/components/ui'
import type { TriagemLead } from '@/types'

interface Props {
  telefone: string
  convId: string | null
  /** Quem está falando (vira contato do paciente novo). */
  nomeContato: string | null
  onCriado: (card: TriagemLead) => void
  onCancelar: () => void
}

/** Outro paciente da pessoa que está falando, cadastrado de dentro do Chatwoot. */
export function NovoPacienteForm({ telefone, convId, nomeContato, onCriado, onCancelar }: Props) {
  const [nome, setNome] = useState('')
  const [cpf, setCpf] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function criar(e: FormEvent) {
    e.preventDefault()
    if (nome.trim().length < 2) {
      setErro('Informe o nome do paciente.')
      return
    }
    setSalvando(true)
    setErro(null)
    const res = await fetch('/api/card/novo-paciente', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nome: nome.trim(),
        cpf: cpf.trim() || null,
        telefone,
        nome_contato: nomeContato,
        conversation_id: convId,
      }),
    }).catch(() => null)
    const dados = await res?.json().catch(() => null)
    setSalvando(false)
    if (!res?.ok || !dados?.card) {
      setErro(dados?.error ?? 'Não foi possível cadastrar o paciente.')
      return
    }
    onCriado(dados.card as TriagemLead)
  }

  return (
    <form
      onSubmit={criar}
      className="space-y-4 rounded-lg border border-border bg-surface-elevated p-5"
      aria-label="Novo paciente"
    >
      <div className="space-y-1">
        <h3 className="font-display text-lg font-medium text-content-primary">
          Novo paciente{nomeContato ? ` de ${nomeContato}` : ''}
        </h3>
        <p className="text-sm text-content-secondary">
          O card já nasce com {nomeContato ?? 'quem está falando'} como contato do paciente.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Input id="novo-nome" label="Nome do paciente" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome completo" autoFocus />
        <Input id="novo-cpf" label="CPF do paciente (opcional)" value={cpf} onChange={(e) => setCpf(e.target.value)} placeholder="000.000.000-00" inputMode="numeric" />
      </div>
      {erro && <p className="text-sm text-danger-500">{erro}</p>}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onCancelar}>
          Cancelar
        </Button>
        <Button type="submit" size="sm" loading={salvando}>
          Criar paciente
        </Button>
      </div>
    </form>
  )
}
