import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { AGENDAMENTO_STATUS, type Agendamento, type AgendamentoStatus } from '@/types'

// Agendamentos = próximo contato de um lead/paciente + eventos avulsos da agenda.
// Leitura/escrita com a sessão do usuário (RLS: qualquer autenticado). Os NOMES do
// lead/paciente são resolvidos com service role — a RLS de `triagem_hsm` é restrita
// a gestor/atendente e esconderia o nome na agenda.

const SELECT = '*'

function isUuid(v: unknown): v is string {
  return typeof v === 'string' && /^[0-9a-f-]{36}$/i.test(v)
}

/** Anexa `alvo_nome` (nome do lead ou do paciente) a cada agendamento. */
async function comNomes(rows: Agendamento[]): Promise<Agendamento[]> {
  if (rows.length === 0) return rows
  const admin = createAdminClient()

  const triagemIds = Array.from(new Set(rows.map((r) => r.triagem_id).filter(isUuid)))
  const pacienteIds = Array.from(new Set(rows.map((r) => r.paciente_id).filter(isUuid)))

  const [leads, pacientes] = await Promise.all([
    triagemIds.length
      ? admin.from('triagem_hsm').select('id, contact_name').in('id', triagemIds)
      : Promise.resolve({ data: [] as { id: string; contact_name: string | null }[] }),
    pacienteIds.length
      ? admin.from('pacientes').select('id, nome_cliente').in('id', pacienteIds)
      : Promise.resolve({ data: [] as { id: string; nome_cliente: string | null }[] }),
  ])

  const nomeLead = new Map((leads.data ?? []).map((l) => [l.id, l.contact_name]))
  const nomePaciente = new Map((pacientes.data ?? []).map((p) => [p.id, p.nome_cliente]))

  return rows.map((r) => ({
    ...r,
    alvo_nome:
      (r.triagem_id ? nomeLead.get(r.triagem_id) : null) ??
      (r.paciente_id ? nomePaciente.get(r.paciente_id) : null) ??
      r.titulo ??
      null,
  }))
}

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const sp = request.nextUrl.searchParams
  const triagemId = sp.get('triagem_id')
  const pacienteId = sp.get('paciente_id')
  const de = sp.get('de')
  const ate = sp.get('ate')
  const status = sp.get('status')
  const limit = Math.min(Number(sp.get('limit')) || 500, 1000)

  let query = supabase.from('agendamentos').select(SELECT)

  if (triagemId) query = query.eq('triagem_id', triagemId)
  if (pacienteId) query = query.eq('paciente_id', pacienteId)
  if (de) query = query.gte('data', de)
  if (ate) query = query.lte('data', ate)

  // Sem alvo e sem intervalo → só os pendentes (é o que o board precisa).
  const statusFiltro = status ?? (triagemId || pacienteId || de || ate ? null : 'pendente')
  if (statusFiltro && statusFiltro !== 'todos') {
    if (!AGENDAMENTO_STATUS.includes(statusFiltro as AgendamentoStatus)) {
      return NextResponse.json({ error: 'status inválido' }, { status: 400 })
    }
    query = query.eq('status', statusFiltro)
  }

  const { data, error } = await query
    .order('data', { ascending: true })
    .order('hora', { ascending: true, nullsFirst: true })
    .limit(limit)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ rows: await comNomes((data ?? []) as Agendamento[]) })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'payload inválido' }, { status: 400 })
  }

  const tipo = body.tipo === 'evento' ? 'evento' : 'contato'
  const data: string | undefined = typeof body.data === 'string' ? body.data.slice(0, 10) : undefined
  if (!data || !/^\d{4}-\d{2}-\d{2}$/.test(data)) {
    return NextResponse.json({ error: 'data obrigatória (YYYY-MM-DD)' }, { status: 400 })
  }
  if (tipo === 'contato' && !isUuid(body.triagem_id) && !isUuid(body.paciente_id)) {
    return NextResponse.json({ error: 'informe triagem_id ou paciente_id' }, { status: 400 })
  }
  const titulo = typeof body.titulo === 'string' ? body.titulo.trim() : ''
  if (tipo === 'evento' && !titulo) {
    return NextResponse.json({ error: 'título obrigatório no evento' }, { status: 400 })
  }

  const row = {
    tipo,
    titulo: titulo || null,
    triagem_id: isUuid(body.triagem_id) ? body.triagem_id : null,
    paciente_id: isUuid(body.paciente_id) ? body.paciente_id : null,
    data,
    hora: typeof body.hora === 'string' && body.hora ? body.hora : null,
    nota: typeof body.nota === 'string' && body.nota.trim() ? body.nota.trim() : null,
    criado_por: user.id,
    responsavel_id: isUuid(body.responsavel_id) ? body.responsavel_id : user.id,
  }

  const { data: created, error } = await supabase
    .from('agendamentos')
    .insert(row)
    .select(SELECT)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const [comNome] = await comNomes([created as Agendamento])
  return NextResponse.json({ agendamento: comNome })
}

export async function PATCH(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => null)
  const id: string | undefined = body?.id
  if (!isUuid(id)) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 })

  const patch: Record<string, unknown> = {}

  if (typeof body.status === 'string') {
    if (!AGENDAMENTO_STATUS.includes(body.status as AgendamentoStatus)) {
      return NextResponse.json({ error: 'status inválido' }, { status: 400 })
    }
    patch.status = body.status
    // Resolver o lembrete carimba a data; reabrir limpa.
    patch.concluido_at = body.status === 'pendente' ? null : new Date().toISOString()
  }
  if (typeof body.data === 'string') patch.data = body.data.slice(0, 10)
  if ('hora' in body) patch.hora = body.hora || null
  if ('nota' in body) patch.nota = typeof body.nota === 'string' ? body.nota.trim() || null : null
  if ('titulo' in body) patch.titulo = typeof body.titulo === 'string' ? body.titulo.trim() || null : null
  if ('resultado_nota' in body) {
    patch.resultado_nota =
      typeof body.resultado_nota === 'string' ? body.resultado_nota.trim() || null : null
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'nada a atualizar' }, { status: 400 })
  }

  const { data: updated, error } = await supabase
    .from('agendamentos')
    .update(patch)
    .eq('id', id)
    .select(SELECT)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const [comNome] = await comNomes([updated as Agendamento])
  return NextResponse.json({ agendamento: comNome })
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const id = request.nextUrl.searchParams.get('id')
  if (!isUuid(id)) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 })

  const { error } = await supabase.from('agendamentos').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
