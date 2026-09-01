'use client'

import { useState } from 'react'
import { Check, Loader2, X } from 'lucide-react'
import { Combobox, type ComboboxOption } from '@/components/ui'
import { cpfValido, formatarCpf, normalizarCpf } from '@/lib/cpf'

/**
 * Campo de PESSOA com cadastro completo (nome, telefone, e-mail, CPF) e busca.
 * Serve para Consultor e Responsável — os dois têm a mesma ficha e os dois podem
 * estar vinculados a vários pacientes, por isso são escolhidos de uma lista.
 */

export interface PessoaCadastro {
  id: string
  nome: string
  telefone?: string | null
  email?: string | null
  cpf?: string | null
  ativo: boolean
  vinculos?: number
}

export type NovaPessoa = {
  nome: string
  telefone: string | null
  email: string | null
  cpf: string | null
}

const inputCls =
  'w-full h-9 rounded bg-surface-tertiary border border-border text-sm text-content-primary placeholder:text-content-tertiary px-3 focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500'

function detalhes(p: PessoaCadastro): string | undefined {
  const partes = [p.telefone, p.email, p.cpf ? formatarCpf(p.cpf) : null].filter(Boolean)
  return partes.length ? partes.join(' · ') : undefined
}

export function PessoaField({
  label,
  itens,
  value,
  onChange,
  onCriar,
  placeholder = 'Buscar pelo nome, telefone, e-mail ou CPF…',
  descricao,
}: {
  label: string
  itens: PessoaCadastro[]
  value: string | null
  onChange: (id: string | null) => void
  onCriar: (p: NovaPessoa) => Promise<PessoaCadastro | null>
  placeholder?: string
  descricao?: string
}) {
  const [cadastrando, setCadastrando] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [form, setForm] = useState({ nome: '', telefone: '', email: '', cpf: '' })

  const ativos = itens.filter((p) => p.ativo || p.id === value)
  const options: ComboboxOption[] = ativos.map((p) => ({
    value: p.id,
    label: p.nome,
    hint: detalhes(p),
  }))
  const selecionado = itens.find((p) => p.id === value) ?? null

  function set(campo: keyof typeof form, v: string) {
    setForm((f) => ({ ...f, [campo]: v }))
  }

  async function salvar() {
    const nome = form.nome.trim()
    if (!nome) {
      setErro('Informe o nome.')
      return
    }
    const cpf = form.cpf.trim()
    if (cpf && !cpfValido(cpf)) {
      setErro('CPF inválido.')
      return
    }
    const email = form.email.trim()
    if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      setErro('E-mail inválido.')
      return
    }
    setSalvando(true)
    setErro(null)
    const criado = await onCriar({
      nome,
      telefone: form.telefone.trim() || null,
      email: email || null,
      cpf: normalizarCpf(cpf),
    })
    setSalvando(false)
    if (!criado) {
      setErro('Não foi possível cadastrar. Tente de novo.')
      return
    }
    onChange(criado.id)
    setForm({ nome: '', telefone: '', email: '', cpf: '' })
    setCadastrando(false)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <p className="text-overline uppercase text-content-tertiary">{label}</p>
        {!cadastrando && (
          <button
            type="button"
            onClick={() => setCadastrando(true)}
            className="text-xs text-brand-500 hover:text-brand-400"
          >
            + Cadastrar
          </button>
        )}
      </div>

      {cadastrando ? (
        <div className="rounded-lg border border-border p-2.5 space-y-2 animate-fade-up">
          <input
            autoFocus
            value={form.nome}
            onChange={(e) => set('nome', e.target.value)}
            placeholder="Nome completo *"
            className={inputCls}
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              value={form.telefone}
              onChange={(e) => set('telefone', e.target.value)}
              placeholder="Telefone"
              className={inputCls}
            />
            <input
              value={form.cpf}
              onChange={(e) => set('cpf', e.target.value)}
              placeholder="CPF"
              inputMode="numeric"
              className={inputCls}
            />
          </div>
          <input
            value={form.email}
            onChange={(e) => set('email', e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') salvar()
              if (e.key === 'Escape') setCadastrando(false)
            }}
            placeholder="E-mail"
            className={inputCls}
          />
          {erro && <p className="text-xs text-danger-500">{erro}</p>}
          <div className="flex items-center justify-end gap-1.5">
            <button
              type="button"
              onClick={() => {
                setCadastrando(false)
                setErro(null)
              }}
              className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1 text-xs text-content-tertiary hover:bg-surface-tertiary"
            >
              <X size={12} /> Cancelar
            </button>
            <button
              type="button"
              onClick={salvar}
              disabled={salvando}
              className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1 text-xs text-success-600 hover:bg-surface-tertiary disabled:opacity-50"
            >
              {salvando ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} Salvar
            </button>
          </div>
        </div>
      ) : (
        <>
          <Combobox
            options={options}
            value={value}
            onChange={onChange}
            placeholder={placeholder}
            textoVazio="— sem vínculo —"
            onCriar={() => setCadastrando(true)}
            criarLabel="Cadastrar novo"
          />
          {selecionado ? (
            <p className="text-xs text-content-tertiary mt-1">
              {detalhes(selecionado) ?? 'Sem telefone/e-mail/CPF cadastrados'}
              {typeof selecionado.vinculos === 'number' && selecionado.vinculos > 1 && (
                <span className="ml-1 text-content-secondary">
                  · vinculado a {selecionado.vinculos} contatos
                </span>
              )}
            </p>
          ) : (
            descricao && <p className="text-xs text-content-tertiary mt-1">{descricao}</p>
          )}
        </>
      )}
    </div>
  )
}
