import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { requireUserApi } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { moverConversa } from '@/lib/card-unico'
import { pushCardInteiro } from '@/lib/chatwoot/sync'
import { zodMensagem } from '@/lib/validation'

const schema = z.object({
  conversation_id: z.string().trim().min(1).max(20),
  para_id: z.string().uuid(),
})

/** Leva a conversa para outro card (paciente certo). POST { conversation_id, para_id } */
export async function POST(request: NextRequest) {
  const { user, error } = await requireUserApi()
  if (error) return error
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: zodMensagem(parsed.error) }, { status: 400 })

  const admin = createAdminClient()
  const { data: autor } = await admin.from('usuarios').select('nome').eq('id', user!.id).maybeSingle()
  try {
    const { para } = await moverConversa(
      admin,
      parsed.data.conversation_id,
      parsed.data.para_id,
      (autor?.nome as string | undefined) ?? 'CRM'
    )
    // A conversa passa a mostrar o paciente novo: atributos e a label da etapa dele.
    const push = await pushCardInteiro(admin, para)
    return NextResponse.json({ card: para, chatwoot: push.status })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 409 })
  }
}
