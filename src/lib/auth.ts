import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

/**
 * Papel do usuário logado, lido da tabela `usuarios` ('gestor' | 'atendente' | null).
 * Fonte da verdade do controle de acesso (o mapeamento pra 'admin'/'agent' no layout
 * é só pra UI).
 */
export async function getUserRole(): Promise<string | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase.from('usuarios').select('role').eq('id', user.id).single()
  return data?.role ?? null
}

/**
 * Restringe uma página a gestores. Atendente (ou sem papel) é redirecionado pro funil.
 * Chamar no topo de páginas server-side restritas (dashboard, relatórios, configurações).
 */
export async function requireGestor(): Promise<void> {
  const role = await getUserRole()
  if (role !== 'gestor') redirect('/kanban')
}
