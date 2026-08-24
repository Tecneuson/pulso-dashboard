import { NextResponse } from 'next/server'
import { requireUserApi } from '@/lib/auth'
import { sincronizarDefinicoes } from '@/lib/chatwoot/campos'

/** Reconcilia as definições de campos (core + personalizados) com o Chatwoot, nos dois sentidos. */
export async function POST() {
  const { error } = await requireUserApi({ gestor: true })
  if (error) return error
  try {
    const result = await sincronizarDefinicoes()
    return NextResponse.json({ ok: result.erros.length === 0, ...result })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
