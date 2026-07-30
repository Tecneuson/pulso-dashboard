'use client'

import { useMemo, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Header } from '@/components/layout/header'
import { Button, Input } from '@/components/ui'
import { useCaptadores } from '@/lib/api-store'

export function CaptadoresView() {
  const { items, add, update, remove, error } = useCaptadores()
  const [busca, setBusca] = useState('')
  const [nome, setNome] = useState('')
  const [telefone, setTelefone] = useState('')
  const [email, setEmail] = useState('')
  const [observacoes, setObservacoes] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase()
    if (!q) return items
    return items.filter((c) =>
      `${c.nome} ${c.telefone ?? ''} ${c.email ?? ''}`.toLowerCase().includes(q)
    )
  }, [items, busca])

  async function salvar() {
    if (!nome.trim()) {
      setAviso('Informe o nome do captador.')
      return
    }
    setSalvando(true)
    setAviso(null)
    const criado = await add({
      nome: nome.trim(),
      telefone: telefone.trim() || null,
      email: email.trim() || null,
      observacoes: observacoes.trim() || null,
    })
    setSalvando(false)
    if (!criado) {
      setAviso('Não foi possível cadastrar o captador.')
      return
    }
    setNome('')
    setTelefone('')
    setEmail('')
    setObservacoes('')
  }

  return (
    <>
      <Header
        title="Captadores"
        subtitle="Quem capta e indica leads e pacientes"
        search={{ value: busca, onChange: setBusca, placeholder: 'Pesquisar captador' }}
      />

      <div className="max-w-4xl space-y-5">
        {/* Cadastro */}
        <div className="rounded-xl border border-border bg-surface-secondary p-4">
          <h2 className="text-sm font-semibold text-content-primary mb-3">Novo captador</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
            <Input placeholder="Nome *" value={nome} onChange={(e) => setNome(e.target.value)} />
            <Input
              placeholder="Telefone"
              value={telefone}
              onChange={(e) => setTelefone(e.target.value)}
            />
            <Input placeholder="E-mail" value={email} onChange={(e) => setEmail(e.target.value)} />
            <Input
              placeholder="Observações"
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
            />
          </div>
          <div className="flex items-center justify-between gap-3 mt-3">
            <p className="text-xs text-danger-500">{aviso ?? error ?? ''}</p>
            <Button size="sm" onClick={salvar} loading={salvando}>
              <Plus size={14} />
              Adicionar captador
            </Button>
          </div>
        </div>

        {/* Lista */}
        <div className="rounded-xl border border-border">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <h2 className="text-sm font-semibold text-content-primary">
              Captadores cadastrados
              <span className="ml-2 text-content-tertiary font-normal tabular-nums">
                {filtrados.length}
              </span>
            </h2>
          </div>

          {filtrados.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-content-tertiary">
              {items.length === 0
                ? 'Nenhum captador cadastrado ainda.'
                : 'Nenhum captador encontrado para esta busca.'}
            </p>
          ) : (
            <div className="divide-y divide-border">
              {filtrados.map((c) => (
                <div key={c.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-sm text-content-primary truncate">
                      {c.nome}
                      {!c.ativo && (
                        <span className="ml-2 text-[11px] px-1.5 py-0.5 rounded-full bg-surface-tertiary text-content-tertiary border border-border">
                          inativo
                        </span>
                      )}
                    </p>
                    {(c.telefone || c.email || c.observacoes) && (
                      <p className="text-xs text-content-tertiary truncate">
                        {[c.telefone, c.email, c.observacoes].filter(Boolean).join(' · ')}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => update(c.id, { ativo: !c.ativo })}
                      className="text-xs px-2 py-1 rounded-md border border-border text-content-secondary hover:bg-surface-tertiary transition-colors"
                    >
                      {c.ativo ? 'Desativar' : 'Reativar'}
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(c.id)}
                      className="inline-flex items-center justify-center h-8 w-8 rounded-md border border-border text-content-tertiary hover:text-danger-500 hover:bg-surface-tertiary transition-colors"
                      aria-label={`Remover ${c.nome}`}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
