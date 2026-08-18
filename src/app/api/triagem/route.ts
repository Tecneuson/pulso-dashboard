import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  chatwootConfigured,
  getConversation,
  updateContactCustomAttributes,
  updateConversationCustomAttributes,
  setConversationLabels,
  postPrivateNote,
} from '@/lib/chatwoot/client'
import {
  contactAttrsFromTriagem,
  conversationAttrsFromTriagem,
  ETAPA_CONTATO_LABEL,
} from '@/lib/chatwoot/mapping'
import type { Triagem } from '@/types'

// Campos do triagem_hsm que o dashboard pode editar. Os que têm mapeamento em
// chatwoot/mapping.ts sincronizam com o Chatwoot; os demais (contact_name, número,
// origem_*) só gravam no banco.
const SYNCABLE: (keyof Triagem)[] = [
  'estagio_funil',
  'plano_saude',
  'tipo_contato',
  'para_quem',
  'motivo_contato',
  'forma_internacao',
  'assunto',
  'motivo_perda',
  'observacoes',
  'tags',
  'status',
  'motivo_desqualificacao',
  'paciente_id',
  'contact_name',
  'data_nascimento',
  'elegivel',
  // Dados de contato: só gravam no banco. O webhook do Chatwoot não mexe neles
  // (o mapeamento cobre apenas atributos customizados), então não são sobrescritos.
  'phone',
  'email',
  'numero_paciente',
  'origem_conversa',
  'origem_hospital_id',
  'origem_consultor_id',
  'origem_profissional_tipo',
  'captador_id',
]

// Campos aceitos ao criar um lead manualmente (sem passar pelo Chatwoot/n8n).
const CREATABLE: (keyof Triagem)[] = [
  'contact_name',
  'phone',
  'email',
  'data_nascimento',
  'tipo_contato',
  'plano_saude',
  'motivo_contato',
  'observacoes',
  'origem_conversa',
  'origem_hospital_id',
  'origem_consultor_id',
  'origem_profissional_tipo',
  'captador_id',
]

// Triagens de um paciente (contatos associados no funil unificado).
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const pacienteId = request.nextUrl.searchParams.get('paciente_id')
  if (!pacienteId) {
    return NextResponse.json({ error: 'paciente_id obrigatório' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('triagem_hsm')
    .select(
      'id, contact_name, phone, email, conversation_id, estagio_funil, motivo_perda, tipo_contato, created_at, updated_at'
    )
    .eq('paciente_id', pacienteId)
    .order('updated_at', { ascending: false })
    .limit(50)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ rows: data ?? [] })
}

// Cria um lead manualmente (sem conversa no Chatwoot). Entra no funil como "Contato".
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => null)
  const nome = typeof body?.contact_name === 'string' ? body.contact_name.trim() : ''
  if (!nome) return NextResponse.json({ error: 'contact_name obrigatório' }, { status: 400 })

  const row: Record<string, unknown> = { contact_name: nome, estagio_funil: null }
  for (const k of CREATABLE) {
    if (k === 'contact_name') continue
    if (body && k in body && body[k] !== '' && body[k] != null) row[k] = body[k]
  }

  const { data, error } = await supabase
    .from('triagem_hsm')
    .insert(row)
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ triagem: data })
}

export async function PATCH(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => null)
  const id: string | undefined = body?.id
  if (!id || typeof body !== 'object') {
    return NextResponse.json({ error: 'invalid payload' }, { status: 400 })
  }

  const patch: Record<string, unknown> = {}
  for (const k of SYNCABLE) if (k in body) patch[k] = body[k]
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'no syncable fields' }, { status: 400 })
  }

  if (
    'paciente_id' in patch &&
    patch.paciente_id !== null &&
    !/^[0-9a-f-]{36}$/i.test(String(patch.paciente_id))
  ) {
    return NextResponse.json({ error: 'paciente_id inválido' }, { status: 400 })
  }

  // Observação anterior — para lançar nota no Chatwoot só quando realmente mudar.
  let obsAntes: string | null = null
  if ('observacoes' in patch) {
    const { data: cur } = await supabase
      .from('triagem_hsm')
      .select('observacoes')
      .eq('id', id)
      .single()
    obsAntes = (cur?.observacoes as string | null) ?? null
  }

  // 1) Grava no banco (sessão autenticada → RLS)
  let { data: updated, error } = await supabase
    .from('triagem_hsm')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single()

  // Rede de segurança: se alguma coluna ainda não existe no banco (migration pendente),
  // remove só ela do patch e regrava, em vez de derrubar a edição inteira.
  if (error && /column .* does not exist/i.test(error.message)) {
    const col = error.message.match(/column "?[\w.]*?\.?(\w+)"? does not exist/i)?.[1]
    if (col && col in patch) {
      console.warn(`[triagem] coluna ausente no banco: ${col} — salvando sem ela`)
      delete patch[col]
      ;({ data: updated, error } = await supabase
        .from('triagem_hsm')
        .update(patch)
        .eq('id', id)
        .select('*')
        .single())
    }
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // 2) Empurra pro Chatwoot (best-effort — não falha a gravação do banco)
  let chatwoot: 'ok' | 'skipped' | 'failed' = 'skipped'
  const convId = updated?.conversation_id as string | null | undefined
  if (chatwootConfigured() && convId) {
    try {
      const conv = await getConversation(convId)
      const contactId = conv.meta?.sender?.id
      const contactAttrs = contactAttrsFromTriagem(patch as Partial<Triagem>)
      const convAttrs = conversationAttrsFromTriagem(patch as Partial<Triagem>)

      // Etapa "Contato" grava estagio_funil=null; limpa o rótulo antigo no Chatwoot
      // (o mapeamento ignora valores nulos, senão o atributo ficaria preso no valor anterior).
      if ('estagio_funil' in patch && patch.estagio_funil === null) {
        contactAttrs['estagio_no_funil'] = ETAPA_CONTATO_LABEL
        convAttrs['venda'] = 'Não'
      }

      // Origem da conversa → nomes do hospital/consultor nos atributos da conversa.
      if ('origem_hospital_id' in patch || 'origem_conversa' in patch) {
        const hid = updated?.origem_hospital_id as string | null | undefined
        let nome = ''
        if (hid) {
          const { data: h } = await supabase.from('hospitais').select('nome').eq('id', hid).single()
          nome = (h?.nome as string) ?? ''
        }
        convAttrs['hospital_origem'] = nome
      }
      if ('origem_consultor_id' in patch || 'origem_conversa' in patch) {
        const cid = updated?.origem_consultor_id as string | null | undefined
        let nome = ''
        if (cid) {
          const { data: c } = await supabase.from('consultores').select('nome').eq('id', cid).single()
          nome = (c?.nome as string) ?? ''
        }
        convAttrs['consultor_origem'] = nome
      }

      if (contactId && Object.keys(contactAttrs).length) {
        await updateContactCustomAttributes(contactId, contactAttrs, conv.meta?.sender?.custom_attributes)
      }
      if (Object.keys(convAttrs).length) {
        await updateConversationCustomAttributes(convId, convAttrs)
      }
      if (Array.isArray(patch.tags)) {
        await setConversationLabels(convId, patch.tags as string[])
      }
      // Observações → NOTA PRIVADA na conversa (não atributo). Só quando mudou e não vazio.
      const obsNova = (patch.observacoes as string | null | undefined) ?? null
      if (obsNova && obsNova.trim() && obsNova !== obsAntes) {
        await postPrivateNote(convId, `📝 Observação (CRM): ${obsNova.trim()}`)
      }
      chatwoot = 'ok'
    } catch (e) {
      console.error('[sync triagem->chatwoot]', e)
      chatwoot = 'failed'
    }
  }

  return NextResponse.json({ ok: true, chatwoot, triagem: updated })
}
