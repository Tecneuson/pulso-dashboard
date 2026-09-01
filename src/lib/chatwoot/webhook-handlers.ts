import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import { MOTIVO_PERDA_INATIVIDADE } from '@/types'
import { isKids } from '@/lib/idade'
import { assuntosIsentosDesfecho, botAtivo, botNome, exigirDesfecho, n8nAtivo } from '@/lib/env'
import { ETAPA_TO_ESTAGIO, etapaFromEstagio } from '@/lib/funil-etapas'
import {
  getContactConversations,
  postPrivateNote,
  toggleConversationStatus,
  updateContactCustomAttributes,
  updateConversationCustomAttributes,
} from './client'
import { KEYS } from './attributes'
import { listarCampos } from './campos'
import {
  atributosFromChatwoot,
  contactAttrsFromTriagem,
  desfechoFromChatwoot,
  triagemFromChatwoot,
} from './mapping'
import { ehNotaDoCrm } from './sync'
import { atualizarSeMudou, inserirComRedeDeSeguranca, lerTriagem, type AnyObj } from '@/lib/triagem-db'
import {
  acharCardPorCpf,
  identificarPessoa,
  registrarNoHistorico,
  vincularAoCard,
  LIMITE_RESPONSAVEIS,
} from '@/lib/contatos'

/**
 * Chatwoot → CRM. Um handler por evento. Regras de ouro:
 *  - só grava o que REALMENTE mudou (anti-eco);
 *  - escreve no Chatwoot a partir daqui só quando é consequência direta do evento
 *    (reabrir conversa sem desfecho, corrigir estágio após "venda = Sim") — e sempre
 *    de forma idempotente;
 *  - tarefas que o n8n já faz (criar lead no 1º contato, pausar bot) só rodam quando
 *    N8N_ATIVO=0. A distribuição entre atendentes é da atribuição automática nativa
 *    do Chatwoot — o app nunca atribui conversa.
 */

// '*' de propósito: listar colunas novas quebraria o webhook enquanto a migration não roda.
const COLS_LEAD = '*'

const MAX_REABERTURAS = 3

function convIdDe(body: AnyObj): string {
  return String(body.id ?? body.display_id ?? '')
}

/** usuarios.chatwoot_agent_id → usuarios.id (atendente no CRM). */
async function atendenteIdPorAgente(admin: SupabaseClient, agentId: number | null | undefined): Promise<string | null | undefined> {
  if (!agentId) return null
  try {
    const { data } = await admin.from('usuarios').select('id').eq('chatwoot_agent_id', agentId).maybeSingle()
    return (data?.id as string | undefined) ?? undefined // undefined = sem mapeamento → não mexe
  } catch {
    return undefined
  }
}

/**
 * Monta o patch do lead a partir dos atributos do Chatwoot (contato + conversa) e grava
 * se mudou. Devolve as chaves gravadas. Usado por conversation_* e contact_updated.
 */
async function aplicarAtributos(
  admin: SupabaseClient,
  row: AnyObj,
  contactAttrs: AnyObj,
  convAttrs: AnyObj,
  extra: AnyObj = {},
  contactId: number | null = null
): Promise<string[]> {
  const campos = await listarCampos({ somenteAtivos: true })
  const patch: AnyObj = { ...triagemFromChatwoot(contactAttrs, convAttrs), ...extra }

  // Desfecho marcado na conversa (venda / motivo de perda) manda no estágio.
  const desfechoAtivo =
    convAttrs[KEYS.venda] === 'Sim' || (convAttrs[KEYS.motivoPerda] != null && convAttrs[KEYS.motivoPerda] !== '')
  if (desfechoAtivo) {
    Object.assign(patch, desfechoFromChatwoot(convAttrs, { estagio_funil: row.estagio_funil, motivo_perda: row.motivo_perda }))
  }

  // Campos dinâmicos: mescla sobre o que já está no banco.
  const din = atributosFromChatwoot(campos, contactAttrs, convAttrs)
  if (Object.keys(din).length) patch.atributos = { ...(row.atributos ?? {}), ...din }

  // Kids acompanha a data de nascimento.
  const dn = 'data_nascimento' in patch ? patch.data_nascimento : row.data_nascimento
  const kids = isKids(dn)
  if ('data_nascimento' in patch || (row.kids == null && kids != null)) patch.kids = kids

  const mudou = await atualizarSeMudou(admin, { id: row.id }, patch, row)

  // Consequências no Chatwoot (idempotentes, comparadas com o que o Chatwoot já tem):
  // estágio do contato coerente com venda/perda marcadas na conversa; kids.
  const alvo = contactId ?? (row.chatwoot_contact_id as number | null) ?? null
  if (alvo) {
    const volta: AnyObj = {}
    const estagioFinal = 'estagio_funil' in patch ? patch.estagio_funil : row.estagio_funil
    if (desfechoAtivo) {
      const esperado = contactAttrsFromTriagem({ estagio_funil: estagioFinal })[KEYS.estagio]
      if (esperado !== undefined && contactAttrs[KEYS.estagio] !== esperado) volta[KEYS.estagio] = esperado
    }
    const kidsFinal = 'kids' in patch ? patch.kids : row.kids
    if (typeof kidsFinal === 'boolean' && contactAttrs[KEYS.kids] !== kidsFinal) volta[KEYS.kids] = kidsFinal
    if (Object.keys(volta).length) {
      try {
        await updateContactCustomAttributes(alvo, volta, Object.keys(contactAttrs).length ? contactAttrs : undefined)
      } catch (e) {
        console.warn('[webhook] volta p/ Chatwoot falhou:', (e as Error).message)
      }
    }
  }
  return mudou
}

// ------------------------------------------------------------
// conversation_created / conversation_updated
// ------------------------------------------------------------
export async function onConversation(body: AnyObj): Promise<AnyObj> {
  const admin = createAdminClient()
  const convId = convIdDe(body)
  if (!convId) return { skipped: 'sem conversation id' }

  const convAttrs = (body.custom_attributes || {}) as AnyObj
  const sender = (body.meta?.sender || {}) as AnyObj
  const contactAttrs = { ...((sender.custom_attributes || {}) as AnyObj) }
  const contactId = sender.id ? Number(sender.id) : null

  let row = await lerTriagem(admin, { conversation_id: convId }, COLS_LEAD)
  if (!row) {
    if (n8nAtivo() || body.event !== 'conversation_created') return { skipped: 'lead inexistente' }
    row = await criarLeadDoPrimeiroContato(admin, convId, sender, body.meta?.assignee)
    if (!row) return { skipped: 'não foi possível criar o lead' }
  }

  const extra: AnyObj = {}
  if (Array.isArray(body.labels)) extra.tags = body.labels
  if (typeof body.status === 'string' && body.status) extra.chatwoot_status = body.status
  if (!row.chatwoot_contact_id && sender.id) extra.chatwoot_contact_id = Number(sender.id)
  const atendente = await atendenteIdPorAgente(admin, body.meta?.assignee?.id)
  if (atendente !== undefined) extra.atendente_id = atendente

  const fields = await aplicarAtributos(admin, row, contactAttrs, convAttrs, extra, contactId)
  return { convId, fields }
}

// ------------------------------------------------------------
// contact_updated
// ------------------------------------------------------------
export async function onContactUpdated(body: AnyObj): Promise<AnyObj> {
  const admin = createAdminClient()
  const contactId: number | undefined = body.id ? Number(body.id) : undefined
  if (!contactId) return { skipped: 'sem contact id' }
  const contactAttrs = { ...((body.custom_attributes || {}) as AnyObj) }

  // Leads ligados por chatwoot_contact_id (inclui os sem conversa) + conversas do contato.
  const alvo = new Map<string, AnyObj>()
  const { data: porContato } = await admin.from('triagem_hsm').select(COLS_LEAD).eq('chatwoot_contact_id', contactId)
  for (const r of porContato ?? []) alvo.set(r.id, r)
  try {
    const convs = await getContactConversations(contactId)
    for (const c of convs) {
      const cid = String(c.id ?? c.display_id ?? '')
      if (!cid) continue
      const r = await lerTriagem(admin, { conversation_id: cid }, COLS_LEAD)
      if (r) alvo.set(r.id, r)
    }
  } catch (e) {
    console.warn('[webhook contact_updated] conversas do contato:', (e as Error).message)
  }

  const mudou: string[] = []
  const leads = Array.from(alvo.values())

  /**
   * ⚠️ Um telefone atende VÁRIOS pacientes. Quase todo atributo de contato no Chatwoot
   * (data de nascimento, plano, motivo, estágio) descreve o PACIENTE, não o dono do
   * telefone — então, quando o contato tem mais de um card, não há como saber a qual
   * paciente a mudança se refere. Propagar cruzava os dados: marcou os dois cards do
   * mesmo telefone como "Consultor" e apagou a data de nascimento de um deles.
   * Com vários cards, gravamos só o que é inequívoco (o id do contato).
   */
  const varios = leads.length > 1
  for (const row of leads) {
    const extra: AnyObj = {}
    if (!row.chatwoot_contact_id) extra.chatwoot_contact_id = contactId
    // O nome do contato no Chatwoot é o DONO DO TELEFONE; `contact_name` no CRM é o
    // PACIENTE. Nunca copiar um no outro (foi assim que "Miguel dos Anjos" virou o
    // nome do card do Pablo).
    if (varios) {
      mudou.push(...(await atualizarSeMudou(admin, { id: row.id }, extra, row)))
      continue
    }
    mudou.push(...(await aplicarAtributos(admin, row, contactAttrs, {}, extra, contactId)))
  }
  return { contactId, leads: leads.length, propagado: !varios, fields: Array.from(new Set(mudou)) }
}

// ------------------------------------------------------------
// conversation_status_changed — regra 12 (não encerra sem venda/motivo) + reabertura
// ------------------------------------------------------------
export async function onStatusChanged(body: AnyObj): Promise<AnyObj> {
  const admin = createAdminClient()
  const convId = convIdDe(body)
  const status = String(body.status ?? '')
  if (!convId || !status) return { skipped: 'payload incompleto' }
  const convAttrs = (body.custom_attributes || {}) as AnyObj
  const row = await lerTriagem(admin, { conversation_id: convId }, COLS_LEAD)
  if (!row) return { skipped: 'lead inexistente', status }

  if (status === 'resolved') {
    const temDesfecho =
      convAttrs[KEYS.venda] === 'Sim' ||
      (convAttrs[KEYS.motivoPerda] != null && convAttrs[KEYS.motivoPerda] !== '') ||
      etapaFromEstagio(row.estagio_funil) === 'internacao' ||
      !!row.motivo_perda
    const isento = row.assunto ? assuntosIsentosDesfecho().includes(row.assunto) : false
    const reaberturas = Number(row.desfecho_reaberturas ?? 0)

    if (exigirDesfecho() && !temDesfecho && !isento && reaberturas < MAX_REABERTURAS) {
      try {
        await toggleConversationStatus(convId, 'open')
        await postPrivateNote(
          convId,
          '⚠️ Conversa reaberta automaticamente: não é possível encerrar sem marcar **Venda = Sim** ou um **Motivo de perda** nos atributos da conversa. Marque o desfecho e encerre de novo.'
        )
        // Reaberta à força: quem está no comando é o atendente, então o bot PERMANECE
        // pausado (não mexemos em bot_pausado aqui de propósito).
        await atualizarSeMudou(admin, { id: row.id }, { desfecho_reaberturas: reaberturas + 1, chatwoot_status: 'open' }, row)
        return { convId, reaberta: true, motivo: 'sem desfecho' }
      } catch (e) {
        console.error('[webhook status] reabrir falhou:', (e as Error).message)
      }
    }
    // Encerrou com desfecho: o ciclo de atendimento acabou.
    // Zera os DOIS portões do bot para que, se o paciente escrever de novo (o Chatwoot
    // reabre a MESMA conversa), a Mônica atenda o novo ciclo:
    //   1) `bot_pausado` (Chatwoot) — senão o bot nem entra;
    //   2) `transbordado` / `triagem_concluida` (banco) — senão ele responde uma vez e
    //      se pausa de novo no check "Triagem finalizada?".
    const patch: AnyObj = {
      transbordado: false,
      triagem_concluida: false,
      chatwoot_status: 'resolved',
    }
    Object.assign(patch, desfechoFromChatwoot(convAttrs, { estagio_funil: row.estagio_funil, motivo_perda: row.motivo_perda }))
    const fields = await atualizarSeMudou(admin, { id: row.id }, patch, row)
    if (convAttrs[KEYS.botPausado] === true) {
      try {
        await updateConversationCustomAttributes(convId, { [KEYS.botPausado]: false }, convAttrs)
      } catch (e) {
        console.warn('[webhook status] reativar bot falhou:', (e as Error).message)
      }
    }
    return { convId, status, fields, botReativado: convAttrs[KEYS.botPausado] === true }
  }

  if (status === 'open') {
    // Voltou a interagir depois de um encerramento automático por inatividade → sai de Perdido.
    if (
      etapaFromEstagio(row.estagio_funil) === 'perdido' &&
      (row.motivo_perda === MOTIVO_PERDA_INATIVIDADE || row.motivo_perda === 'parou_de_interagir')
    ) {
      const fields = await atualizarSeMudou(
        admin,
        { id: row.id },
        { estagio_funil: ETAPA_TO_ESTAGIO.atendendo, motivo_perda: null, chatwoot_status: 'open' },
        row
      )
      try {
        await updateConversationCustomAttributes(convId, { [KEYS.motivoPerda]: '', [KEYS.venda]: 'Não' }, convAttrs)
        if (row.chatwoot_contact_id) {
          await updateContactCustomAttributes(row.chatwoot_contact_id, contactAttrsFromTriagem({ estagio_funil: ETAPA_TO_ESTAGIO.atendendo }))
        }
      } catch (e) {
        console.warn('[webhook status] limpar perda no Chatwoot falhou:', (e as Error).message)
      }
      return { convId, status, reativado: true, fields }
    }
  }
  const fields = await atualizarSeMudou(admin, { id: row.id }, { chatwoot_status: status }, row)
  return { convId, status, fields }
}

// ------------------------------------------------------------
// message_created — notas privadas ⇄ histórico, 1º contato, pausa do bot, bot
// ------------------------------------------------------------
export async function onMessageCreated(body: AnyObj): Promise<AnyObj> {
  const admin = createAdminClient()
  const conversation = (body.conversation || {}) as AnyObj
  const convId = String(conversation.id ?? conversation.display_id ?? '')
  if (!convId) return { skipped: 'sem conversation id' }
  const sender = (body.sender || conversation.messages?.[0]?.sender || {}) as AnyObj
  const tipo = String(body.message_type ?? '')
  const privada = body.private === true
  const conteudo: string = typeof body.content === 'string' ? body.content : ''

  // 1) Nota privada escrita no Chatwoot → histórico do CRM.
  if (privada) {
    if (!conteudo.trim()) return { skipped: 'nota vazia' }
    if (ehNotaDoCrm(conteudo)) return { skipped: 'eco de nota do CRM' }
    const row = await lerTriagem(admin, { conversation_id: convId }, 'id')
    if (!row) return { skipped: 'lead inexistente' }
    const nomeBot = botNome()
    const ehBot = sender?.name === nomeBot || /^📝 Resumo da triagem/.test(conteudo)
    const { error } = await admin.from('anotacoes').upsert(
      {
        triagem_id: row.id,
        usuario_id: null,
        conteudo: conteudo.trim(),
        origem: ehBot ? 'bot' : 'chatwoot',
        autor_nome: ehBot ? 'Mônica' : (sender?.name as string | undefined) ?? 'Chatwoot',
        chatwoot_message_id: Number(body.id) || null,
      },
      { onConflict: 'chatwoot_message_id', ignoreDuplicates: true }
    )
    if (error) return { erro: `anotacoes: ${error.message} (rode a migration 20260823)` }
    return { convId, nota: 'importada' }
  }

  // 2) Mensagem do contato.
  if (tipo === 'incoming') {
    const out: AnyObj = { convId, incoming: true }
    let row = await lerTriagem(admin, { conversation_id: convId }, COLS_LEAD)

    // Reconhecer quem está falando e vincular ao card é trabalho do CRM, não do bot:
    // roda SEMPRE, inclusive com o n8n no ar. (Antes ficava depois do return abaixo e
    // nunca era executado na configuração real.)
    if (row) Object.assign(out, await reconhecerContato(admin, row, conversation.meta?.sender ?? sender))

    // Daqui para baixo é papel do bot — com o n8n ativo, é ele quem faz.
    if (n8nAtivo()) return { ...out, skipped: 'n8n ativo cuida do 1º contato/bot' }

    if (!row) {
      row = await criarLeadDoPrimeiroContato(admin, convId, conversation.meta?.sender ?? sender, conversation.meta?.assignee)
      out.leadCriado = !!row
      if (row) Object.assign(out, await reconhecerContato(admin, row, conversation.meta?.sender ?? sender))
    }
    const pausado = conversation.custom_attributes?.[KEYS.botPausado] === true
    if (botAtivo() && !pausado && row) {
      const { responderComoMonica } = await import('@/lib/bot/monica')
      out.bot = await responderComoMonica({ admin, conversation, triagem: row, mensagem: body })
    }
    return out
  }

  // 3) Humano respondeu → pausa o bot (n8n faz isso quando está ativo).
  if (tipo === 'outgoing' && !privada && sender?.type === 'user' && sender?.name !== botNome()) {
    if (n8nAtivo()) return { convId, skipped: 'n8n ativo pausa o bot' }
    if (conversation.custom_attributes?.[KEYS.botPausado] === true) return { convId, jaPausado: true }
    try {
      await updateConversationCustomAttributes(convId, { [KEYS.botPausado]: true }, conversation.custom_attributes)
      return { convId, botPausado: true }
    } catch (e) {
      return { convId, erro: (e as Error).message }
    }
  }
  return { convId, ignored: tipo }
}

/**
 * Reconhece quem está falando e liga ao card certo.
 *
 * Regra combinada com o cliente: a pessoa é identificada pelo telefone do WhatsApp
 * (consultor cadastrado vence; qualquer outro número vira responsável, criado na
 * hora com o nome do WhatsApp). Em seguida procuramos o paciente pelo CPF: se já
 * existe card, o contato é vinculado a ELE — é o caso da esposa falando do mesmo
 * filho. Passando de 4 responsáveis, o contato só entra no histórico.
 */
async function reconhecerContato(admin: SupabaseClient, row: AnyObj, sender: AnyObj): Promise<AnyObj> {
  const out: AnyObj = {}
  try {
    const pessoa = await identificarPessoa(admin, sender?.phone_number, sender?.name)
    if (!pessoa) return out
    out.contato = { papel: pessoa.papel, nome: pessoa.nome, novo: pessoa.novo }

    // Qual card recebe o vínculo? Quem manda é o CPF do paciente DESTA conversa —
    // nunca o telefone. A mesma pessoa pode falar de vários pacientes, e cada um tem
    // o seu card. Sem CPF, fica no card da própria conversa.
    const cardDoPaciente = (await acharCardPorCpf(admin, row.cpf)) ?? row
    if (cardDoPaciente.id !== row.id) out.cardDoPaciente = cardDoPaciente.id

    const r = await vincularAoCard(admin, cardDoPaciente.id, pessoa)
    out.vinculo = r.status

    if (r.status === 'vinculado') {
      await registrarNoHistorico(
        admin,
        cardDoPaciente.id,
        `👤 ${pessoa.papel === 'consultor' ? 'Consultor' : 'Responsável'} entrou em contato: ${pessoa.nome}` +
          (pessoa.novo ? ' (cadastro criado pelo WhatsApp)' : ''),
        pessoa.nome
      )
    } else if (r.status === 'limite') {
      // O cliente pediu: a partir do 5º, não vira vínculo — fica registrado.
      await registrarNoHistorico(
        admin,
        cardDoPaciente.id,
        `👤 ${pessoa.nome} entrou em contato sobre este paciente, mas o card já tem ` +
          `${LIMITE_RESPONSAVEIS} responsáveis vinculados — não foi vinculado.`,
        pessoa.nome
      )
    }
  } catch (e) {
    out.contatoErro = (e as Error).message
  }
  return out
}

/** Lead no 1º contato (modo sem n8n). UNIQUE(conversation_id) evita duplicar. */
async function criarLeadDoPrimeiroContato(
  admin: SupabaseClient,
  convId: string,
  sender: AnyObj,
  assignee?: AnyObj | null
): Promise<AnyObj | null> {
  try {
    const atendente = await atendenteIdPorAgente(admin, assignee?.id)
    const row: AnyObj = {
      conversation_id: convId,
      contact_name: (sender?.name as string | undefined) ?? null,
      phone: (sender?.phone_number as string | undefined) ?? null,
      email: (sender?.email as string | undefined) ?? null,
      chatwoot_contact_id: sender?.id ? Number(sender.id) : null,
      status: 'em_triagem',
      estagio_funil: null,
    }
    if (atendente) row.atendente_id = atendente
    const criado = await inserirComRedeDeSeguranca(admin, row, { ignorarDuplicado: true })
    return criado ?? (await lerTriagem(admin, { conversation_id: convId }, COLS_LEAD))
  } catch (e) {
    console.error('[webhook] criar lead 1º contato:', (e as Error).message)
    return null
  }
}

/** Roteador de eventos. */
export async function handleChatwootEvent(body: AnyObj): Promise<AnyObj> {
  const event = String(body.event ?? '')
  switch (event) {
    case 'conversation_created':
    case 'conversation_updated':
      return { event, ...(await onConversation(body)) }
    case 'contact_updated':
      return { event, ...(await onContactUpdated(body)) }
    case 'conversation_status_changed':
      return { event, ...(await onStatusChanged(body)) }
    case 'message_created':
      return { event, ...(await onMessageCreated(body)) }
    default:
      return { ignored: event }
  }
}
