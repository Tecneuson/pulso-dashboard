import { NextResponse, type NextRequest } from 'next/server'
import { requireUserApi } from '@/lib/auth'
import { pacientesDoContato } from '@/lib/card-unico'

/**
 * Pacientes de quem está falando na conversa (abas do card dentro do Chatwoot):
 * GET /api/card/pacientes?telefone=<do contato>&conversation_id=<da conversa>
 */
export async function GET(request: NextRequest) {
  const { supabase, error } = await requireUserApi()
  if (error) return error

  const sp = request.nextUrl.searchParams
  const telefone = sp.get('telefone')
  const convId = sp.get('conversation_id')
  if (!telefone && !convId) return NextResponse.json({ error: 'informe telefone ou conversation_id' }, { status: 400 })

  const { pessoa, cards } = await pacientesDoContato(supabase, telefone, convId)
  return NextResponse.json({ pessoa, cards })
}
