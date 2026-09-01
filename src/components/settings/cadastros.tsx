'use client'

import { useMemo, useState } from 'react'
import { Building2, Plus, Search, Trash2, UserRound, Users } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent, Button, Input } from '@/components/ui'
import { useConsultores, useHospitais, useResponsaveis } from '@/lib/api-store'
import { cpfValido, formatarCpf, normalizarCpf } from '@/lib/cpf'

/**
 * Cadastros compartilhados: Consultores, Responsáveis e Hospitais.
 *
 * Consultor e responsável têm a MESMA ficha (nome, telefone, e-mail, CPF) e os dois
 * podem estar vinculados a vários pacientes — por isso o mesmo card serve para ambos.
 * As listas são longas (≈260 hospitais), então todas têm busca e rolagem.
 */

function normalizar(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
}

interface PessoaLinha {
  id: string
  nome: string
  telefone?: string | null
  email?: string | null
  cpf?: string | null
  ativo: boolean
  vinculos?: number
}

function PessoasCard({
  titulo,
  descricao,
  icone,
  store,
}: {
  titulo: string
  descricao: string
  icone: React.ReactNode
  store: {
    items: PessoaLinha[]
    add: (body: Record<string, unknown>) => Promise<unknown>
    remove: (id: string) => Promise<void>
    error: string | null
  }
}) {
  const [nome, setNome] = useState('')
  const [telefone, setTelefone] = useState('')
  const [email, setEmail] = useState('')
  const [cpf, setCpf] = useState('')
  const [busca, setBusca] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)

  const filtrados = useMemo(() => {
    const q = normalizar(busca)
    const ativos = store.items.filter((p) => p.ativo)
    if (!q) return ativos
    return ativos.filter((p) => normalizar(`${p.nome} ${p.telefone ?? ''} ${p.email ?? ''} ${p.cpf ?? ''}`).includes(q))
  }, [store.items, busca])

  async function salvar() {
    const n = nome.trim()
    if (!n) {
      setErro('Informe o nome.')
      return
    }
    if (cpf.trim() && !cpfValido(cpf)) {
      setErro('CPF inválido.')
      return
    }
    setSalvando(true)
    setErro(null)
    const criado = await store.add({
      nome: n,
      telefone: telefone.trim() || null,
      email: email.trim() || null,
      cpf: normalizarCpf(cpf),
    })
    setSalvando(false)
    if (!criado) {
      setErro(store.error ?? 'Falha ao salvar.')
      return
    }
    setNome('')
    setTelefone('')
    setEmail('')
    setCpf('')
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <span className="inline-flex items-center gap-2">
            {icone}
            {titulo}
            <span className="text-xs font-normal text-content-tertiary tabular-nums">
              ({store.items.filter((p) => p.ativo).length})
            </span>
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-content-secondary mb-3">{descricao}</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2">
          <Input placeholder="Nome *" value={nome} onChange={(e) => setNome(e.target.value)} />
          <Input placeholder="Telefone" value={telefone} onChange={(e) => setTelefone(e.target.value)} />
          <Input placeholder="E-mail" value={email} onChange={(e) => setEmail(e.target.value)} />
          <Input
            placeholder="CPF"
            value={cpf}
            inputMode="numeric"
            onChange={(e) => setCpf(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') salvar()
            }}
          />
        </div>
        <div className="flex justify-end mb-3">
          <Button size="sm" onClick={salvar} loading={salvando}>
            <Plus size={14} />
            Adicionar
          </Button>
        </div>

        {(erro || store.error) && <p className="text-xs text-danger-500 mb-2">{erro ?? store.error}</p>}

        <div className="relative mb-2">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-content-tertiary" />
          <Input placeholder="Buscar…" value={busca} onChange={(e) => setBusca(e.target.value)} className="pl-9" />
        </div>

        {/* rolagem: a lista pode ter dezenas de nomes */}
        <div className="max-h-64 overflow-y-auto divide-y divide-border border-t border-border">
          {filtrados.length === 0 && (
            <p className="text-xs text-content-tertiary py-2">
              {busca ? 'Nada encontrado.' : 'Nenhum cadastro ainda.'}
            </p>
          )}
          {filtrados.map((p) => (
            <div key={p.id} className="flex items-center justify-between gap-2 py-2">
              <div className="min-w-0">
                <p className="text-sm text-content-primary truncate">
                  {p.nome}
                  {typeof p.vinculos === 'number' && p.vinculos > 0 && (
                    <span className="ml-2 text-[11px] text-content-tertiary tabular-nums">
                      {p.vinculos} {p.vinculos === 1 ? 'contato' : 'contatos'}
                    </span>
                  )}
                </p>
                {(p.telefone || p.email || p.cpf) && (
                  <p className="text-xs text-content-tertiary truncate">
                    {[p.telefone, p.email, p.cpf ? formatarCpf(p.cpf) : null].filter(Boolean).join(' · ')}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => store.remove(p.id)}
                className="shrink-0 inline-flex items-center justify-center h-8 w-8 rounded-md border border-border text-content-tertiary hover:text-danger-500 hover:bg-surface-tertiary transition-colors"
                aria-label={`Desativar ${p.nome}`}
                title="Desativar (o histórico dos leads é preservado)"
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
  const [busca, setBusca] = useState('')

  const filtrados = useMemo(() => {
    const q = normalizar(busca)
    const ativos = items.filter((h) => h.ativo)
    return q ? ativos.filter((h) => normalizar(h.nome).includes(q)) : ativos
  }, [items, busca])

  async function salvar() {
    if (!nome.trim()) return
    const criado = await add({ nome: nome.trim() })
    if (criado) setNome('')
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <span className="inline-flex items-center gap-2">
            <Building2 size={16} className="text-brand-500" />
            Hospitais parceiros
            <span className="text-xs font-normal text-content-tertiary tabular-nums">
              ({items.filter((h) => h.ativo).length})
            </span>
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-content-secondary mb-3">
          Hospitais de origem (conversas interhospitalares). A lista veio do Chatwoot e é a mesma
          usada no campo <strong>Origem da conversa → Hospital</strong>.
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

        {error && <p className="text-xs text-danger-500 mb-2">Falha ao salvar: {error}</p>}

        <div className="relative mb-2">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-content-tertiary" />
          <Input placeholder="Buscar hospital…" value={busca} onChange={(e) => setBusca(e.target.value)} className="pl-9" />
        </div>

        <div className="max-h-64 overflow-y-auto divide-y divide-border border-t border-border">
          {filtrados.length === 0 && (
            <p className="text-xs text-content-tertiary py-2">
              {busca ? 'Nada encontrado.' : 'Nenhum hospital cadastrado.'}
            </p>
          )}
          {filtrados.map((h) => (
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
  const consultores = useConsultores()
  const responsaveis = useResponsaveis()

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
      <PessoasCard
        titulo="Consultores"
        icone={<UserRound size={16} className="text-brand-500" />}
        descricao="Quem encaminha o paciente (médico, psicólogo, clínica, outro hospital). Um consultor pode estar vinculado a vários pacientes — o número ao lado do nome mostra quantos."
        store={consultores}
      />
      <PessoasCard
        titulo="Responsáveis"
        icone={<Users size={16} className="text-brand-500" />}
        descricao="Familiar, amigo(a) ou responsável legal que faz o contato pelo paciente. Mesma ficha do consultor."
        store={responsaveis}
      />
      <HospitaisCard />
    </div>
  )
}
