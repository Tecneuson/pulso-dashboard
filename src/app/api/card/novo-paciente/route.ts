import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { requireUserApi } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { criarPacienteDoContato } from '@/lib/card-unico'
import { zodMensagem } from '@/lib/validation'

const schema = z.object({
  nome: z.string().trim().min(2).max(160),
  cpf: z.string().trim().max(20).nullish(),
  telefone: z.string().trim().min(8).max(30),
  nome_contato: z.string().trim().max(160).nullish(),
  conversation_id: z.string().trim().max(20).nullish(),
})

/**
 * Outro paciente da pessoa que está falando (consultor com vários pacientes, pai com
 * dois filhos). Cria o card já vinculado a ela (a conversa continua onde está).
 * CPF que já tem card devolve 409 com o card existente (card único).
 */
export async function POST(request: NextRequest) {
  const { user, error } = await requireUserApi()
  if (error) return error
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: zodMensagem(parsed.error) }, { status: 400 })
  const d = parsed.data

  const admin = createAdminClient()
  const { data: autorRow } = await admin.from('usuarios').select('nome').eq('id', user!.id).maybeSingle()
  const autor = (autorRow?.nome as string | undefined) ?? 'CRM'
  try {
    const r = await criarPacienteDoContato(
      admin,
      { nome: d.nome, cpf: d.cpf, telefone: d.telefone, convId: d.conversation_id, nomeContato: d.nome_contato },
      autor
    )
    if ('existente' in r) {
      return NextResponse.json(
        { error: `Já existe um card com esse CPF: ${r.existente.contact_name ?? 'sem nome'}.`, existente: r.existente },
        { status: 409 }
      )
    }
    return NextResponse.json({ card: r.card })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
