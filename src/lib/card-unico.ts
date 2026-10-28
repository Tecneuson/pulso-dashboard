import type { SupabaseClient } from '@supabase/supabase-js'
import {
  acharPessoa,
  identificarPessoa,
  normalizarTelefone,
  registrarNoHistorico,
  variantesTelefone,
  vincularAoCard,
  type PessoaIdentificada,
} from '@/lib/contatos'
import { PACIENTE_RESUMO_FIELDS } from '@/types'
import { etapaFromEstagio } from '@/lib/funil-etapas'
import type { AnyObj } from '@/lib/triagem-db'

/**
 * Card ÚNICO por paciente (regra do cliente, out/2026).
 *
 * O Chatwoot abre uma conversa nova toda vez que a anterior foi resolvida, e o n8n cria
 * uma linha em `triagem_hsm` por conversa. No fim da triagem — quando a Mônica já sabe
 * QUEM é o paciente — a conversa nova é levada para o card que o paciente já tinha:
 *  1. mesmo CPF → mesmo card (sempre);
 *  2. sem CPF: o telefone só decide quando o número tem UM card e o nome do paciente
 *     bate. Número com vários cards (pai com dois filhos, consultora) ou nome diferente
 *     = outro paciente → o card novo continua.
 * O card do paciente recebe a conversa (conversation_id), os dados desta triagem, as
 * anotações/agendamentos/vínculos; a linha provisória é apagada.
 */

/** Campos do ciclo de atendimento: a triagem nova manda (quando veio preenchido). */
const DO_CICLO = [
  'nome_contato',
  'para_quem',
  'tipo_contato',
  'forma_internacao',
  'plano_saude',
  'carteirinha_enviada',
  'carteirinha_url',
  'assunto',
  'status',
  'etapa_atual',
  'triagem_concluida',
  'transbordado',
  'motivo_desqualificacao',
  'ex_paciente',
  'chatwoot_status',
  'chatwoot_contact_id',
  'message_id',
] as const

/** Identidade e cadastro do card: só completa o que o card do paciente não tinha. */
const DE_IDENTIDADE = [
  'contact_name',
  'cpf',
  'data_nascimento',
  'email',
  'phone',
  'paciente_id',
  'kids',
  'atendente_id',
  'captador_id',
  'consultor_id',
  'numero_paciente',
  'motivo_contato',
  'origem_conversa',
  'origem_hospital_id',
  'origem_consultor_id',
  'origem_profissional_tipo',
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_content',
  'utm_term',
] as const

function vazio(v: unknown): boolean {
  return v === null || v === undefined || v === '' || (Array.isArray(v) && v.length === 0)
}

function cpfLimpo(v: unknown): string | null {
  const d = String(v ?? '').replace(/\D/g, '')
  return d.length === 11 ? d : null
}

/** Mesmo paciente pelo nome: primeiro e último nome iguais (sem acento/caixa). */
function nomeIgual(a: unknown, b: unknown): boolean {
  const partes = (s: unknown) =>
    String(s ?? '')
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z\s]/g, ' ')
      .split(/\s+/)
      .filter(Boolean)
  const pa = partes(a)
  const pb = partes(b)
  if (pa.length === 0 || pb.length === 0) return false
  return pa[0] === pb[0] && pa[pa.length - 1] === pb[pb.length - 1]
}

export async function acharCardDoPaciente(
  admin: SupabaseClient,
  record: AnyObj
): Promise<{ alvo: AnyObj; motivo: string } | null> {
  const cpf = cpfLimpo(record.cpf)
  if (cpf) {
    const { data } = await admin
      .from('triagem_hsm')
      .select('*')
      .eq('cpf', cpf)
      .neq('id', record.id)
      .order('updated_at', { ascending: false })
      .limit(1)
    if (data?.[0]) return { alvo: data[0] as AnyObj, motivo: 'mesmo CPF' }
  }

  const tel = normalizarTelefone(record.phone)
  if (!tel) return null
  const formatos = variantesTelefone(tel).flatMap((v) => [v, `55${v}`, `+55${v}`])
  const { data } = await admin
    .from('triagem_hsm')
    .select('*')
    .in('phone', formatos)
    .neq('id', record.id)
    .or('assunto.is.null,assunto.eq.internacao')
    .limit(2)
  const cards = (data ?? []) as AnyObj[]
  if (cards.length !== 1) return null // nenhum, ou o número fala de vários pacientes
  const unico = cards[0]
  const cpfUnico = cpfLimpo(unico.cpf)
  if (cpf && cpfUnico && cpf !== cpfUnico) return null
  if (!nomeIgual(record.contact_name, unico.contact_name)) return null
  return { alvo: unico, motivo: 'mesmo telefone e mesmo nome' }
}

/** Leva a conversa e a triagem de `record` (linha provisória) para o card `alvo`. */
export async function fundirNoCard(
  admin: SupabaseClient,
  record: AnyObj,
  alvo: AnyObj,
  motivo: string
): Promise<AnyObj> {
  const conv = record.conversation_id as string
  const patch: AnyObj = {}
  for (const k of DO_CICLO) if (!vazio(record[k])) patch[k] = record[k]
  for (const k of DE_IDENTIDADE) if (vazio(alvo[k]) && !vazio(record[k])) patch[k] = record[k]

  const tags = Array.from(new Set([...((alvo.tags as string[]) ?? []), ...((record.tags as string[]) ?? [])]))
  if (tags.length !== ((alvo.tags as string[]) ?? []).length) patch.tags = tags
  if (!vazio(record.observacoes) && record.observacoes !== alvo.observacoes) {
    patch.observacoes = vazio(alvo.observacoes)
      ? record.observacoes
      : `${record.observacoes}\n\n— Conversa anterior: ${alvo.observacoes}`
  }

  // Funil: quem voltou sai de Perdido (vai para Contato) e, com a triagem concluída e
  // qualificada, segue para Atendendo. Outras etapas (ex.: Internação) ficam onde estão.
  let etapa = etapaFromEstagio(alvo.estagio_funil)
  if (etapa === 'perdido') {
    patch.estagio_funil = null
    patch.motivo_perda = null
    etapa = 'contato'
  }
  if (etapa === 'contato' && record.status === 'qualificado') patch.estagio_funil = 'em_atendimento'
  patch.desfecho_reaberturas = 0
  patch.conversation_id = conv

  // conversation_id é UNIQUE: solta da linha provisória antes de prender no card.
  const solta = await admin.from('triagem_hsm').update({ conversation_id: null }).eq('id', record.id)
  if (solta.error) throw new Error(`soltar conversa: ${solta.error.message}`)

  const prender = () => admin.from('triagem_hsm').update(patch).eq('id', alvo.id).select('*').single()
  let res = await prender()
  if (res.error && /duplicate|unique/i.test(res.error.message)) {
    // O n8n ("Criar contato") pode ter recriado a linha da conversa nesse meio-tempo.
    await admin
      .from('triagem_hsm')
      .delete()
      .eq('conversation_id', conv)
      .neq('id', alvo.id)
      .eq('status', 'em_triagem')
      .is('cpf', null)
    res = await prender()
  }
  if (res.error || !res.data) {
    await admin.from('triagem_hsm').update({ conversation_id: conv }).eq('id', record.id)
    throw new Error(`prender conversa no card: ${res.error?.message ?? 'sem retorno'}`)
  }

  await moverDependentes(admin, record.id as string, alvo.id as string)
  const apagar = await admin.from('triagem_hsm').delete().eq('id', record.id)
  if (apagar.error) console.warn('[card-unico] apagar linha provisória:', apagar.error.message)

  await registrarNoHistorico(admin, alvo.id as string, `🔁 Nova conversa (#${conv}) unificada neste card — ${motivo}.`)
  return res.data as AnyObj
}

async function moverDependentes(admin: SupabaseClient, de: string, para: string): Promise<void> {
  for (const tabela of ['anotacoes', 'agendamentos']) {
    const { error } = await admin.from(tabela).update({ triagem_id: para }).eq('triagem_id', de)
    if (error) console.warn(`[card-unico] mover ${tabela}:`, error.message)
  }

  // Vínculos: sem duplicar a mesma pessoa; o principal continua sendo o do card.
  const { data: jaTem } = await admin
    .from('contato_vinculos')
    .select('responsavel_id, consultor_id, principal')
    .eq('triagem_id', para)
  const { data: vindo } = await admin
    .from('contato_vinculos')
    .select('id, responsavel_id, consultor_id')
    .eq('triagem_id', de)
  const existentes = (jaTem ?? []) as AnyObj[]
  const temPrincipal = existentes.some((v) => v.principal)
  for (const v of (vindo ?? []) as AnyObj[]) {
    const repetido = existentes.some(
      (j) =>
        (v.responsavel_id && j.responsavel_id === v.responsavel_id) ||
        (v.consultor_id && j.consultor_id === v.consultor_id)
    )
    const op = repetido
      ? admin.from('contato_vinculos').delete().eq('id', v.id)
      : admin
          .from('contato_vinculos')
          .update({ triagem_id: para, ...(temPrincipal ? { principal: false } : {}) })
          .eq('id', v.id)
    const { error } = await op
    if (error) {
      // Ex.: limite de responsáveis no card do paciente — não pode travar a fusão.
      console.warn('[card-unico] vínculo:', error.message)
      await admin.from('contato_vinculos').delete().eq('id', v.id)
    }
  }
}

// ============================================================
// Pacientes de quem está falando (abas do card dentro do Chatwoot)
// ============================================================

/**
 * A mesma pessoa (consultor, responsável) fala de vários pacientes. Pelo telefone da
 * conversa achamos a pessoa (sem criar nada) e os cards a que ela está vinculada; o
 * card da conversa vem primeiro.
 */
export async function pacientesDoContato(
  client: SupabaseClient,
  telefone: string | null | undefined,
  convId: string | null | undefined
): Promise<{ pessoa: PessoaIdentificada | null; cards: AnyObj[] }> {
  const pessoa = await acharPessoa(client, telefone)
  const ids = new Set<string>()
  if (pessoa) {
    const coluna = pessoa.papel === 'responsavel' ? 'responsavel_id' : 'consultor_id'
    const { data: vinculos } = await client.from('contato_vinculos').select('triagem_id').eq(coluna, pessoa.id)
    for (const v of (vinculos ?? []) as AnyObj[]) if (v.triagem_id) ids.add(v.triagem_id as string)
  }

  const cards: AnyObj[] = []
  if (ids.size) {
    const { data } = await client.from('triagem_hsm').select('*').in('id', Array.from(ids))
    cards.push(...((data ?? []) as AnyObj[]))
  }
  if (convId && !cards.some((c) => String(c.conversation_id) === String(convId))) {
    const { data } = await client.from('triagem_hsm').select('*').eq('conversation_id', String(convId)).maybeSingle()
    if (data) cards.push(data as AnyObj)
  }

  const pacienteIds = Array.from(new Set(cards.map((c) => c.paciente_id).filter(Boolean)))
  if (pacienteIds.length) {
    const { data } = await client.from('pacientes').select(PACIENTE_RESUMO_FIELDS).in('id', pacienteIds)
    const porId = new Map(((data ?? []) as AnyObj[]).map((p) => [p.id, p]))
    for (const c of cards) c.paciente = c.paciente_id ? porId.get(c.paciente_id) ?? null : null
  }

  const daConversa = (c: AnyObj) => (convId && String(c.conversation_id) === String(convId) ? 0 : 1)
  cards.sort((a, b) => daConversa(a) - daConversa(b) || String(b.updated_at).localeCompare(String(a.updated_at)))
  return { pessoa, cards }
}

/**
 * A conversa caiu no paciente errado (ou a pessoa passou a falar de outro): leva a
 * conversa para o card `paraId`. O card de antes fica sem conversa.
 */
export async function moverConversa(
  admin: SupabaseClient,
  convId: string,
  paraId: string,
  autor: string
): Promise<{ para: AnyObj; de: AnyObj | null }> {
  const { data: deData } = await admin.from('triagem_hsm').select('*').eq('conversation_id', convId).maybeSingle()
  const de = (deData as AnyObj | null) ?? null
  if (de?.id === paraId) return { para: de, de: null }

  const { data: alvo } = await admin.from('triagem_hsm').select('*').eq('id', paraId).maybeSingle()
  if (!alvo) throw new Error('card de destino não encontrado')
  // O card guarda a última conversa dele; só trava se ela ainda está em andamento.
  const outra = (alvo as AnyObj).conversation_id
  if (outra && String(outra) !== convId && ['open', 'pending'].includes(String((alvo as AnyObj).chatwoot_status))) {
    throw new Error(`este paciente está em outra conversa em andamento (#${outra})`)
  }

  // conversation_id é UNIQUE: solta do card atual antes de prender no outro.
  if (de) {
    const solta = await admin.from('triagem_hsm').update({ conversation_id: null }).eq('id', de.id)
    if (solta.error) throw new Error(`soltar conversa: ${solta.error.message}`)
  }
  const patch: AnyObj = { conversation_id: convId }
  if (!(alvo as AnyObj).chatwoot_contact_id && de?.chatwoot_contact_id) patch.chatwoot_contact_id = de.chatwoot_contact_id
  const res = await admin.from('triagem_hsm').update(patch).eq('id', paraId).select('*').single()
  if (res.error || !res.data) {
    if (de) await admin.from('triagem_hsm').update({ conversation_id: convId }).eq('id', de.id)
    throw new Error(`mover conversa: ${res.error?.message ?? 'sem retorno'}`)
  }
  const para = res.data as AnyObj

  await registrarNoHistorico(
    admin,
    para.id as string,
    `🔀 Conversa #${convId} trazida para este card${de ? ` (estava em ${de.contact_name ?? 'outro card'})` : ''}.`,
    autor
  )
  if (de) {
    await registrarNoHistorico(admin, de.id as string, `🔀 Conversa #${convId} movida para o card de ${para.contact_name ?? 'outro paciente'}.`, autor)
  }
  return { para, de }
}

/**
 * Outro paciente da mesma pessoa, cadastrado pelo Chatwoot: o card nasce já com a
 * pessoa como contato. CPF que já tem card não cria outro (card único).
 */
export async function criarPacienteDoContato(
  admin: SupabaseClient,
  dados: { nome: string; cpf?: string | null; telefone: string; convId?: string | null; nomeContato?: string | null },
  autor: string
): Promise<{ card: AnyObj } | { existente: AnyObj }> {
  const cpf = cpfLimpo(dados.cpf)
  if (cpf) {
    const { data } = await admin.from('triagem_hsm').select('*').eq('cpf', cpf).limit(1)
    if (data?.[0]) return { existente: data[0] as AnyObj }
  }

  const { data: daConversa } = dados.convId
    ? await admin.from('triagem_hsm').select('chatwoot_contact_id, phone').eq('conversation_id', dados.convId).maybeSingle()
    : { data: null }
  const row: AnyObj = {
    contact_name: dados.nome.trim(),
    cpf,
    phone: (daConversa as AnyObj | null)?.phone ?? dados.telefone,
    chatwoot_contact_id: (daConversa as AnyObj | null)?.chatwoot_contact_id ?? null,
    status: 'em_triagem',
    estagio_funil: null,
  }
  const { data: card, error } = await admin.from('triagem_hsm').insert(row).select('*').single()
  if (error || !card) throw new Error(`criar paciente: ${error?.message ?? 'sem retorno'}`)

  const pessoa = await identificarPessoa(admin, dados.telefone, dados.nomeContato ?? null)
  if (pessoa) await vincularAoCard(admin, (card as AnyObj).id as string, pessoa)
  await registrarNoHistorico(
    admin,
    (card as AnyObj).id as string,
    `➕ Paciente cadastrado pelo Chatwoot${pessoa ? ` — contato: ${pessoa.nome}` : ''}.`,
    autor
  )
  return { card: card as AnyObj }
}
