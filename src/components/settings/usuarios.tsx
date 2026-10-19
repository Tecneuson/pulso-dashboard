'use client'

import { useState } from 'react'
import { Copy, KeyRound, Plus } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent, Button, Input, Select } from '@/components/ui'
import { useUsuarios, type UsuarioResumo } from '@/lib/api-store'

/**
 * Configurações → Usuários.
 *
 * Admin cria a conta (nome, e-mail, papel) e recebe uma SENHA TEMPORÁRIA para repassar
 * à pessoa — não há convite por e-mail. Desativar bloqueia o login.
 */

const PAPEL_OPTS = [
  { value: 'gestor', label: 'Admin' },
  { value: 'atendente', label: 'Agente de atendimento' },
]

const DICA_PAPEL: Record<string, string> = {
  gestor: 'Acesso total: cadastros, configurações, usuários, exportação.',
  atendente:
    'Vê todas as telas e trabalha os cards (inclusive de colegas), mas não cadastra, edita ou apaga cadastros e não exporta.',
}

export function Usuarios() {
  const { items, refresh } = useUsuarios()
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('atendente')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  /** Senha recém-gerada: aparece uma única vez. */
  const [senha, setSenha] = useState<{ email: string; senha: string } | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)

  async function chamar(method: 'POST' | 'PATCH', body: object) {
    setErro(null)
    const res = await fetch('/api/usuarios', {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      setErro(data.error || 'Não foi possível salvar')
      return null
    }
    await refresh()
    return data as { row: UsuarioResumo | null; senha_temporaria: string | null }
  }

  async function criar() {
    if (!nome.trim() || !email.trim()) return
    setSalvando(true)
    const data = await chamar('POST', { nome, email, role })
    setSalvando(false)
    if (!data) return
    setSenha(
      data.senha_temporaria
        ? { email: email.trim().toLowerCase(), senha: data.senha_temporaria }
        : null
    )
    setAviso(
      data.senha_temporaria
        ? null
        : 'Esse e-mail já tinha login no sistema: a pessoa continua com a senha atual (use "Nova senha" se precisar).'
    )
    setNome('')
    setEmail('')
  }

  async function novaSenha(u: UsuarioResumo) {
    const data = await chamar('PATCH', { id: u.id, nova_senha: true })
    if (data?.senha_temporaria) setSenha({ email: u.email ?? u.nome, senha: data.senha_temporaria })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Usuários</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-content-secondary mb-4">
          Quem acessa o Pulso. Ao criar, o sistema gera uma <strong>senha temporária</strong>: copie e
          envie para a pessoa.
        </p>

        <div className="flex flex-wrap items-end gap-2 mb-1">
          <div className="flex-1 min-w-[180px]">
            <label className="text-overline uppercase text-content-tertiary block mb-1">Nome</label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome completo" />
          </div>
          <div className="flex-1 min-w-[220px]">
            <label className="text-overline uppercase text-content-tertiary block mb-1">E-mail</label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nome@hospitalsantamonica.com.br"
              onKeyDown={(e) => {
                if (e.key === 'Enter') void criar()
              }}
            />
          </div>
          <div className="min-w-[200px]">
            <label className="text-overline uppercase text-content-tertiary block mb-1">Papel</label>
            <Select value={role} onChange={(e) => setRole(e.target.value)} options={PAPEL_OPTS} />
          </div>
          <Button onClick={() => void criar()} disabled={!nome.trim() || !email.trim() || salvando}>
            <Plus className="w-4 h-4" />
            Criar usuário
          </Button>
        </div>
        <p className="text-xs text-content-tertiary mb-4">{DICA_PAPEL[role]}</p>

        {senha && (
          <div className="mb-4 rounded-lg border border-success-500/30 bg-success-500/10 p-3 text-sm">
            <p className="text-content-primary">
              Senha temporária de <strong>{senha.email}</strong> (só aparece agora):
            </p>
            <div className="flex items-center gap-2 mt-1.5">
              <code className="font-mono text-base px-2 py-1 rounded bg-surface-primary border border-border select-all">
                {senha.senha}
              </code>
              <button
                type="button"
                onClick={() => void navigator.clipboard?.writeText(senha.senha)}
                className="p-1.5 rounded text-content-secondary hover:bg-surface-tertiary"
                aria-label="Copiar senha"
              >
                <Copy size={14} />
              </button>
              <button
                type="button"
                onClick={() => setSenha(null)}
                className="ml-auto text-xs text-content-tertiary hover:text-content-primary"
              >
                Fechar
              </button>
            </div>
          </div>
        )}

        {aviso && <p className="mb-4 text-sm text-content-secondary">{aviso}</p>}

        {erro && (
          <div className="mb-4 bg-danger-500/10 border border-danger-500/30 rounded-lg p-3 text-sm text-danger-500">
            {erro}
          </div>
        )}

        <div className="divide-y divide-border border border-border rounded-lg">
          {items.map((u) => (
            <div key={u.id} className="flex flex-wrap items-center gap-3 p-3">
              <div className="flex-1 min-w-[200px]">
                <p className={`text-sm font-medium ${u.ativo === false ? 'text-content-tertiary line-through' : 'text-content-primary'}`}>
                  {u.nome}
                </p>
                <p className="text-xs text-content-tertiary">{u.email}</p>
              </div>
              <div className="w-56">
                <Select
                  value={u.role ?? 'atendente'}
                  onChange={(e) => void chamar('PATCH', { id: u.id, role: e.target.value })}
                  options={PAPEL_OPTS}
                />
              </div>
              <Button variant="ghost" size="sm" onClick={() => void novaSenha(u)} title="Gerar nova senha temporária">
                <KeyRound size={14} />
                Nova senha
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => void chamar('PATCH', { id: u.id, ativo: u.ativo === false })}
              >
                {u.ativo === false ? 'Reativar' : 'Desativar'}
              </Button>
            </div>
          ))}
          {items.length === 0 && <p className="p-3 text-sm text-content-tertiary">Nenhum usuário.</p>}
        </div>
      </CardContent>
    </Card>
  )
}
