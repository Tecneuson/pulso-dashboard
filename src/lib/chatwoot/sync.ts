import type { SupabaseClient } from '@supabase/supabase-js'
import type { Triagem } from '@/types'
import { isKids } from '@/lib/idade'
import {
  chatwootConfigured,
  createContact,
  getContact,
  getConversation,
  postPrivateNote,
  searchContacts,
  setConversationLabels,
  telefoneE164,
  updateContact,
  updateContactCustomAttributes,
  updateConversationCustomAttributes,
  type ChatwootConversation,
} from './client'
import { listarCampos } from './campos'
import {
  chatwootAttrsFromAtributos,
  contactAttrsFromTriagem,
  conversationAttrsFromTriagem,
  CONSULTOR_ORIGEM_KEY,
  HOSPITAL_ORIGEM_KEY,
} from './mapping'

/**
 * CRM → Chatwoot. Único caminho de escrita no Chatwoot a partir de uma triagem — usado
 * pelo PATCH/POST de /api/triagem e pelo endpoint do database webhook (/api/sync/triagem),
 * que substitui o fluxo "agente-humano" do n8n.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyObj = Record<string, any>

export interface PushResult {
  status: 'ok' | 'skipped' | 'failed'
  detalhes?: string
  /** Id do contato no Chatwoot descoberto durante o push (para gravar no lead). */
  contactId?: number | null
}

/** Marcador das notas que o CRM escreve no Chatwoot (para não importar o próprio eco). */
export const MARCADOR_NOTA_CRM = '(CRM):'
export function ehNotaDoCrm(conteudo: string | null | undefined): boolean {
  return !!conteudo && /^📝 [\s\S]{0,120}?\(CRM\):/.test(conteudo)
}

/** Nomes de hospital/consultor da origem, quando a origem faz parte do patch. */
async function atributosDeOrigem(supabase: SupabaseClient, row: AnyObj, patch: AnyObj): Promise<AnyObj> {
  const out: AnyObj = {}
  if ('origem_hospital_id' in patch || 'origem_conversa' in patch) {
    let nome = ''
    if (row.origem_hospital_id) {
      const { data } = await supabase.from('hospitais').select('nome').eq('id', row.origem_hospital_id).maybeSingle()
      nome = (data?.nome as string) ?? ''
    }
    out[HOSPITAL_ORIGEM_KEY] = nome
  }
  if ('origem_consultor_id' in patch || 'origem_conversa' in patch) {
    let nome = ''
    if (row.origem_consultor_id) {
      const { data } = await supabase.from('consultores').select('nome').eq('id', row.origem_consultor_id).maybeSingle()
      nome = (data?.nome as string) ?? ''
    }
    out[CONSULTOR_ORIGEM_KEY] = nome
  }
  return out
}

/**
 * Empurra para o Chatwoot os campos de `patch` (já gravados em `row`).
 * - Com conversa: atributos de contato + de conversa + labels.
 * - Sem conversa mas com `chatwoot_contact_id`: só atributos de contato.
 * Best-effort: nunca lança; devolve status.
 */
export async function pushTriagemParaChatwoot(
  supabase: SupabaseClient,
  row: AnyObj,
  patch: AnyObj,
  opts: { conv?: ChatwootConversation | null } = {}
): Promise<PushResult> {
  if (!chatwootConfigured()) return { status: 'skipped', detalhes: 'chatwoot não configurado' }
  const convId = row.conversation_id as string | number | null | undefined
  let contactId = (row.chatwoot_contact_id as number | null | undefined) ?? null
  if (!convId && !contactId) return { status: 'skipped', detalhes: 'lead sem conversa e sem contato no Chatwoot' }

  try {
    const campos = await listarCampos({ somenteAtivos: true })
    const dinamicos = chatwootAttrsFromAtributos(campos, patch.atributos as AnyObj | null | undefined)

    // Kids acompanha a data de nascimento (o Chatwoot só recebe via CRM).
    const p: Partial<Triagem> = { ...(patch as Partial<Triagem>) }
    if ('data_nascimento' in p && !('kids' in p)) p.kids = isKids(p.data_nascimento)

    const contactAttrs: AnyObj = { ...contactAttrsFromTriagem(p), ...dinamicos.contact }
    const convAttrs: AnyObj = { ...conversationAttrsFromTriagem(p), ...dinamicos.conversation }

    let conv: ChatwootConversation | null = opts.conv ?? null
    let contatoAttrsAtuais: AnyObj | undefined
    if (convId) {
      conv = conv ?? (await getConversation(convId))
      contactId = conv.meta?.sender?.id ?? contactId
      contatoAttrsAtuais = conv.meta?.sender?.custom_attributes
      Object.assign(convAttrs, await atributosDeOrigem(supabase, row, patch))
    }

    if (contactId) {
      if (Object.keys(contactAttrs).length) {
        await updateContactCustomAttributes(contactId, contactAttrs, contatoAttrsAtuais)
      }
      if ('contact_name' in patch && typeof patch.contact_name === 'string' && patch.contact_name.trim()) {
        await updateContact(contactId, { name: patch.contact_name.trim() })
      }
    }
    if (convId) {
      if (Object.keys(convAttrs).length) {
        // passa os atributos atuais para MESCLAR (o endpoint do Chatwoot substitui tudo)
        await updateConversationCustomAttributes(convId, convAttrs, conv?.custom_attributes)
      }
      if (Array.isArray(patch.tags)) await setConversationLabels(convId, patch.tags as string[])
    }
    return { status: 'ok', contactId }
  } catch (e) {
    console.error('[sync triagem->chatwoot]', (e as Error).message)
    return { status: 'failed', detalhes: (e as Error).message, contactId }
  }
}

/**
 * Lead criado no CRM: acha (por telefone/e-mail) ou cria o contato no Chatwoot para que
 * TODOS os campos do lead existam lá também. Devolve o id do contato (ou null).
 */
export async function encontrarOuCriarContato(
  lead: { contact_name: string; phone?: string | null; email?: string | null },
  contactAttrs: AnyObj
): Promise<number | null> {
  if (!chatwootConfigured()) return null
  const phone = telefoneE164(lead.phone)
  const email = lead.email?.trim().toLowerCase() || null
  try {
    const digitos = phone?.replace(/\D/g, '')
    if (phone) {
      const achados = await searchContacts(phone)
      const hit = achados.find((c) => (c.phone_number ?? '').replace(/\D/g, '') === digitos)
      if (hit) {
        await updateContactCustomAttributes(hit.id, contactAttrs, hit.custom_attributes)
        return hit.id
      }
    }
    if (email) {
      const achados = await searchContacts(email)
      const hit = achados.find((c) => (c.email ?? '').toLowerCase() === email)
      if (hit) {
        await updateContactCustomAttributes(hit.id, contactAttrs, hit.custom_attributes)
        return hit.id
      }
    }
    const criado = await createContact({
      name: lead.contact_name,
      phone_number: phone,
      email,
      custom_attributes: contactAttrs,
    })
    return criado?.id ?? null
  } catch (e) {
    // Telefone já existe em outro contato (422) é o caso comum: tenta achar de novo por busca ampla.
    console.error('[chatwoot contato]', (e as Error).message)
    try {
      if (phone) {
        const achados = await searchContacts(phone.replace('+', ''))
        const hit = achados[0]
        if (hit) return hit.id
      }
    } catch {
      /* ignore */
    }
    return null
  }
}

/** Anotação do CRM → nota privada na conversa. Devolve o id da mensagem no Chatwoot. */
export async function espelharNotaNoChatwoot(
  conversationId: string | number,
  autor: string,
  conteudo: string
): Promise<number | null> {
  if (!chatwootConfigured()) return null
  try {
    return await postPrivateNote(conversationId, `📝 ${autor} ${MARCADOR_NOTA_CRM} ${conteudo}`)
  } catch (e) {
    console.error('[nota->chatwoot]', (e as Error).message)
    return null
  }
}

/** Atributos atuais do contato (para leads sem conversa). */
export async function atributosDoContato(contactId: number): Promise<AnyObj> {
  try {
    const c = await getContact(contactId)
    return c?.custom_attributes ?? {}
  } catch {
    return {}
  }
}
