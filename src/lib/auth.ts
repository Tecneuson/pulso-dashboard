import { redirect } from 'next/navigation'
import { NextResponse } from 'next/server'
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

/**
 * Versão para rotas de API: devolve o usuário autenticado ou uma resposta de erro pronta
 * (401 sem sessão; 403 quando `gestor` é exigido e o papel é outro).
 */
export async function requireUserApi(opts: { gestor?: boolean } = {}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { supabase, user: null, role: null, error: NextResponse.json({ error: 'unauthorized' }, { status: 401 }) }
  }
  let role: string | null = null
  if (opts.gestor) {
    const { data } = await supabase.from('usuarios').select('role').eq('id', user.id).single()
    role = data?.role ?? null
    if (role !== 'gestor') {
      return { supabase, user, role, error: NextResponse.json({ error: 'forbidden' }, { status: 403 }) }
    }
  }
  return { supabase, user, role, error: null }
}

/** Comparação em tempo constante para segredos de webhook/cron (evita timing attack). */
export function segredoConfere(fornecido: string | null | undefined, esperado: string | null | undefined): boolean {
  if (!fornecido || !esperado) return false
  const a = Buffer.from(fornecido)
  const b = Buffer.from(esperado)
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i]
  return diff === 0
}
