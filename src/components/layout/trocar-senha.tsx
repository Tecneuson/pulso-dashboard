'use client'

import { useState } from 'react'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { createClient } from '@/lib/supabase/client'

const MIN = 8

/**
 * Troca da própria senha. Confere a senha atual antes (reloga com ela) para que
 * alguém com o computador destravado não troque a senha de outra pessoa.
 */
export function TrocarSenha({
  open,
  onClose,
  email,
}: {
  open: boolean
  onClose: () => void
  email: string
}) {
  const [atual, setAtual] = useState('')
  const [nova, setNova] = useState('')
  const [confirma, setConfirma] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [ok, setOk] = useState(false)
  const [salvando, setSalvando] = useState(false)

  function fechar() {
    setAtual('')
    setNova('')
    setConfirma('')
    setErro(null)
    setOk(false)
    onClose()
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    setErro(null)
    if (nova.length < MIN) return setErro(`A nova senha precisa ter pelo menos ${MIN} caracteres.`)
    if (nova !== confirma) return setErro('A confirmação não é igual à nova senha.')
    if (nova === atual) return setErro('A nova senha precisa ser diferente da atual.')

    setSalvando(true)
    const supabase = createClient()
    const { error: errAtual } = await supabase.auth.signInWithPassword({ email, password: atual })
    if (errAtual) {
      setSalvando(false)
      return setErro('Senha atual incorreta.')
    }
    const { error } = await supabase.auth.updateUser({ password: nova })
    setSalvando(false)
    if (error) return setErro(error.message)
    setOk(true)
  }

  return (
    <Modal open={open} onClose={fechar} title="Trocar senha" size="sm">
      {ok ? (
        <div className="space-y-4">
          <p className="text-sm text-content-primary">Senha alterada. Use a nova senha no próximo acesso.</p>
          <div className="flex justify-end">
            <Button onClick={fechar}>Fechar</Button>
          </div>
        </div>
      ) : (
        <form onSubmit={salvar} className="space-y-3">
          <Input
            label="Senha atual"
            type="password"
            autoComplete="current-password"
            value={atual}
            onChange={(e) => setAtual(e.target.value)}
            autoFocus
          />
          <Input
            label="Nova senha"
            type="password"
            autoComplete="new-password"
            value={nova}
            onChange={(e) => setNova(e.target.value)}
          />
          <Input
            label="Confirmar nova senha"
            type="password"
            autoComplete="new-password"
            value={confirma}
            onChange={(e) => setConfirma(e.target.value)}
          />
          <p className="text-xs text-content-tertiary">Mínimo de {MIN} caracteres.</p>
          {erro && <p className="text-sm text-danger-500">{erro}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" onClick={fechar}>
              Cancelar
            </Button>
            <Button type="submit" loading={salvando} disabled={!atual || !nova || !confirma}>
              Salvar
            </Button>
          </div>
        </form>
      )}
    </Modal>
  )
}
