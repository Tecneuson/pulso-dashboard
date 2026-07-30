'use client'

import { useState } from 'react'
import { Plus, Trash2, UserRound, UserPlus, Building2 } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent, Button, Input } from '@/components/ui'
import { useCaptadores, useConsultores, useHospitais } from '@/lib/api-store'

function EmptyRow({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-content-tertiary py-2">{children}</p>
}

function ConsultoresCard() {
  const { items, add, remove, error } = useConsultores()
  const [nome, setNome] = useState('')
  const [telefone, setTelefone] = useState('')
  const [email, setEmail] = useState('')

  async function salvar() {
    if (!nome.trim()) return
    const criado = await add({
      nome: nome.trim(),
      telefone: telefone.trim() || null,
      email: email.trim() || null,
    })
    if (!criado) return // erro fica visível abaixo do formulário
    setNome('')
    setTelefone('')
    setEmail('')
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <span className="inline-flex items-center gap-2">
            <UserRound size={16} className="text-brand-500" />
            Consultores
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-content-secondary mb-3">
          Intermediários entre a família do paciente e o hospital. Ficam salvos no banco e
          aparecem na origem da conversa.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-2">
          <Input placeholder="Nome" value={nome} onChange={(e) => setNome(e.target.value)} />
          <Input placeholder="Telefone" value={telefone} onChange={(e) => setTelefone(e.target.value)} />
          <Input placeholder="E-mail" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="flex justify-end mb-3">
          <Button size="sm" onClick={salvar}>
            <Plus size={14} />
            Adicionar consultor
          </Button>
        </div>

        {error && (
          <p className="text-xs text-danger-500 mb-2">Falha ao salvar: {error}</p>
        )}

        <div className="divide-y divide-border border-t border-border">
          {items.length === 0 && <EmptyRow>Nenhum consultor cadastrado.</EmptyRow>}
          {items.map((c) => (
            <div key={c.id} className="flex items-center justify-between gap-2 py-2">
              <div className="min-w-0">
                <p className="text-sm text-content-primary truncate">{c.nome}</p>
                {(c.telefone || c.email) && (
                  <p className="text-xs text-content-tertiary truncate">
                    {[c.telefone, c.email].filter(Boolean).join(' · ')}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => remove(c.id)}
                className="shrink-0 inline-flex items-center justify-center h-8 w-8 rounded-md border border-border text-content-tertiary hover:text-danger-500 hover:bg-surface-tertiary transition-colors"
                aria-label={`Remover ${c.nome}`}
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

function CaptadoresCard() {
  const { items, add, remove, error } = useCaptadores()
  const [nome, setNome] = useState('')
  const [telefone, setTelefone] = useState('')
  const [email, setEmail] = useState('')

  async function salvar() {
    if (!nome.trim()) return
    const criado = await add({
      nome: nome.trim(),
      telefone: telefone.trim() || null,
      email: email.trim() || null,
    })
    if (!criado) return // erro fica visível abaixo do formulário
    setNome('')
    setTelefone('')
    setEmail('')
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <span className="inline-flex items-center gap-2">
            <UserPlus size={16} className="text-brand-500" />
            Captadores
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-content-secondary mb-3">
          Quem capta/indica leads e pacientes. Ficam salvos no banco e podem ser vinculados a
          leads (no card) e a pacientes (no detalhe do paciente).
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-2">
          <Input placeholder="Nome" value={nome} onChange={(e) => setNome(e.target.value)} />
          <Input placeholder="Telefone" value={telefone} onChange={(e) => setTelefone(e.target.value)} />
          <Input placeholder="E-mail" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="flex justify-end mb-3">
          <Button size="sm" onClick={salvar}>
            <Plus size={14} />
            Adicionar captador
          </Button>
        </div>

        {error && (
          <p className="text-xs text-danger-500 mb-2">Falha ao salvar: {error}</p>
        )}

        <div className="divide-y divide-border border-t border-border">
          {items.length === 0 && <EmptyRow>Nenhum captador cadastrado.</EmptyRow>}
          {items.map((c) => (
            <div key={c.id} className="flex items-center justify-between gap-2 py-2">
              <div className="min-w-0">
                <p className="text-sm text-content-primary truncate">{c.nome}</p>
                {(c.telefone || c.email) && (
                  <p className="text-xs text-content-tertiary truncate">
                    {[c.telefone, c.email].filter(Boolean).join(' · ')}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => remove(c.id)}
                className="shrink-0 inline-flex items-center justify-center h-8 w-8 rounded-md border border-border text-content-tertiary hover:text-danger-500 hover:bg-surface-tertiary transition-colors"
                aria-label={`Remover ${c.nome}`}
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

function HospitaisCard() {
  const { items, add, remove, error } = useHospitais()
  const [nome, setNome] = useState('')

  async function salvar() {
    if (!nome.trim()) return
    const criado = await add({ nome: nome.trim() })
    if (!criado) return // erro fica visível abaixo do formulário
    setNome('')
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <span className="inline-flex items-center gap-2">
            <Building2 size={16} className="text-brand-500" />
            Hospitais parceiros
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-content-secondary mb-3">
          Hospitais de origem (conversas interhospitalares). Ficam salvos no banco.
        </p>

        <div className="flex items-end gap-2 mb-3">
          <div className="flex-1">
            <Input
              placeholder="Nome do hospital"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') salvar()
              }}
            />
          </div>
          <Button size="sm" onClick={salvar}>
            <Plus size={14} />
            Adicionar
          </Button>
        </div>

        {error && (
          <p className="text-xs text-danger-500 mb-2">Falha ao salvar: {error}</p>
        )}

        <div className="divide-y divide-border border-t border-border">
          {items.length === 0 && <EmptyRow>Nenhum hospital cadastrado.</EmptyRow>}
          {items.map((h) => (
            <div key={h.id} className="flex items-center justify-between gap-2 py-2">
              <p className="text-sm text-content-primary truncate">{h.nome}</p>
              <button
                type="button"
                onClick={() => remove(h.id)}
                className="shrink-0 inline-flex items-center justify-center h-8 w-8 rounded-md border border-border text-content-tertiary hover:text-danger-500 hover:bg-surface-tertiary transition-colors"
                aria-label={`Remover ${h.nome}`}
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

export function Cadastros() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
      <CaptadoresCard />
      <ConsultoresCard />
      <HospitaisCard />
    </div>
  )
}
