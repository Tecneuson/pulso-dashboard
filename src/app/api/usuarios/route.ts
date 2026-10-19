import { randomBytes } from 'crypto'
import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireUserApi } from '@/lib/auth'

// Equipe interna (atendentes/gestores). Alimenta o filtro "Agente de Atendimento",
// o nome do agente no card do funil e o responsável das tarefas.
//
// Escrita (POST/PATCH) é só de admin e usa service role: cria a conta no Supabase Auth
// e a linha em `usuarios` com o MESMO id (o app assume usuarios.id = auth.uid()).
// Não mandamos convite por e-mail — o SMTP padrão do Supabase não entrega para fora
// do projeto. O admin recebe uma senha temporária e repassa para a pessoa.

const PAPEIS = ['gestor', 'atendente'] as const
type Papel = (typeof PAPEIS)[number]

const uuid = /^[0-9a-f-]{36}$/i
const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** ~12 caracteres legíveis (sem 0/O/l/1) para ditar ou colar no WhatsApp. */
function senhaTemporaria(): string {
  const alfabeto = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const bytes = randomBytes(12)
  return Array.from(bytes, (b) => alfabeto[b % alfabeto.length]).join('')
}

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('usuarios')
    .select('id, nome, email, role, ativo')
    .order('nome', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ rows: data ?? [] })
}

/** Cria (ou reaproveita, se o e-mail já tem login) uma conta da equipe. */
export async function POST(request: NextRequest) {
  const { error: negado } = await requireUserApi({ gestor: true })
  if (negado) return negado

  const body = await request.json().catch(() => null)
  const nome = typeof body?.nome === 'string' ? body.nome.trim() : ''
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''
  const role = body?.role as Papel
  if (!nome) return NextResponse.json({ error: 'Informe o nome' }, { status: 400 })
  if (!emailRe.test(email)) return NextResponse.json({ error: 'E-mail inválido' }, { status: 400 })
  if (!PAPEIS.includes(role)) return NextResponse.json({ error: 'Papel inválido' }, { status: 400 })

  const admin = createAdminClient()

  const { data: existente } = await admin.from('usuarios').select('id').ilike('email', email).maybeSingle()
  if (existente) return NextResponse.json({ error: 'Já existe um usuário com esse e-mail' }, { status: 409 })

  // O login pode já existir no Auth sem linha em `usuarios` (criado à mão no painel).
  let authId: string | null = null
  let senha: string | null = null
  for (let page = 1; page <= 10 && !authId; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    authId = data.users.find((u) => u.email?.toLowerCase() === email)?.id ?? null
    if (data.users.length < 200) break
  }

  if (!authId) {
    senha = senhaTemporaria()
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password: senha,
      email_confirm: true,
      user_metadata: { nome },
    })
    if (error || !data.user) {
      return NextResponse.json({ error: error?.message ?? 'Falha ao criar o login' }, { status: 500 })
    }
    authId = data.user.id
  }

  const { data: row, error } = await admin
    .from('usuarios')
    .insert({ id: authId, nome, email, role, ativo: true })
    .select('id, nome, email, role, ativo')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // senha = null → o login já existia; a pessoa continua com a senha que tinha.
  return NextResponse.json({ row, senha_temporaria: senha })
}

/** Muda nome/papel, ativa/desativa (bloqueia o login) ou gera nova senha temporária. */
export async function PATCH(request: NextRequest) {
  const { user, error: negado } = await requireUserApi({ gestor: true })
  if (negado) return negado

  const body = await request.json().catch(() => null)
  const id: string | undefined = body?.id
  if (!id || !uuid.test(id)) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 })

  const ehVoce = id === user!.id
  const patch: Record<string, unknown> = {}
  if (typeof body.nome === 'string' && body.nome.trim()) patch.nome = body.nome.trim()
  if ('role' in body) {
    if (!PAPEIS.includes(body.role)) return NextResponse.json({ error: 'Papel inválido' }, { status: 400 })
    if (ehVoce && body.role !== 'gestor') {
      return NextResponse.json({ error: 'Você não pode tirar o seu próprio acesso de admin' }, { status: 400 })
    }
    patch.role = body.role
  }
  if (typeof body.ativo === 'boolean') {
    if (ehVoce && !body.ativo) {
      return NextResponse.json({ error: 'Você não pode desativar a si mesmo' }, { status: 400 })
    }
    patch.ativo = body.ativo
  }

  const admin = createAdminClient()
  let senha: string | null = null

  if (typeof body.ativo === 'boolean') {
    // Desativar bloqueia o login de verdade (não só some da lista).
    const { error } = await admin.auth.admin.updateUserById(id, {
      ban_duration: body.ativo ? 'none' : '876000h',
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }
  if (body.nova_senha === true) {
    senha = senhaTemporaria()
    const { error } = await admin.auth.admin.updateUserById(id, { password: senha })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  let row = null
  if (Object.keys(patch).length) {
    const { data, error } = await admin
      .from('usuarios')
      .update(patch)
      .eq('id', id)
      .select('id, nome, email, role, ativo')
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    row = data
  }

  return NextResponse.json({ row, senha_temporaria: senha })
}
