'use client'

import { useEffect } from 'react'
import { LogIn, RotateCw } from 'lucide-react'
import { Button } from '@/components/ui'

/**
 * Sem sessão dentro do Chatwoot. O login não abre em iframe, então abre numa aba nova;
 * como crm. e chat. são o mesmo site, o cookie da sessão vale aqui também — ao voltar
 * para o Chatwoot o card recarrega sozinho.
 */
export function EntrarNoCrm() {
  // Volta da aba do login → recarrega. (Não usar `focus`: no iframe ele dispara no
  // primeiro clique e recarregaria antes do botão "Entrar" funcionar.)
  useEffect(() => {
    const recarregar = () => {
      if (document.visibilityState === 'visible') window.location.reload()
    }
    document.addEventListener('visibilitychange', recarregar)
    return () => document.removeEventListener('visibilitychange', recarregar)
  }, [])

  return (
    <div className="flex flex-col items-start gap-3 rounded-lg border border-border bg-surface-secondary p-4 text-sm text-content-secondary">
      <p>Entre no CRM para ver o card do lead desta conversa.</p>
      <div className="flex gap-2">
        <Button size="sm" onClick={() => window.open('/login', '_blank', 'noopener')}>
          <LogIn size={14} />
          Entrar no CRM
        </Button>
        <Button size="sm" variant="ghost" onClick={() => window.location.reload()}>
          <RotateCw size={14} />
          Já entrei
        </Button>
      </div>
    </div>
  )
}
