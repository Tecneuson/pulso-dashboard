import type { SupabaseClient } from '@supabase/supabase-js'
import prompt from './prompt-monica.json'
import { chat, embed, type ChatMessage, type ToolSpec } from './openai'
import {
  listConversationMessages,
  sendMessage,
  updateConversationCustomAttributes,
  postPrivateNote,
} from '@/lib/chatwoot/client'
import { KEYS } from '@/lib/chatwoot/attributes'
import { pushTriagemParaChatwoot } from '@/lib/chatwoot/sync'
import { escreverComRedeDeSeguranca, lerTriagem, type AnyObj } from '@/lib/triagem-db'
import { isKids } from '@/lib/idade'

/**
 * Bot Mônica DENTRO do app (modo sem n8n; BOT_ENABLED=1 + OPENAI_API_KEY + N8N_ATIVO=0).
 *
 * Reimplementa o fluxo do workflow "Chatwoot Moniquinha — HSM": histórico vem das próprias
 * mensagens da conversa no Chatwoot (sem Postgres Chat Memory), tools `salvar_triagem`,
 * `buscar_paciente_por_cpf` e `base_conhecimento_hsm` (RAG via match_documents, opcional),
 * leitura de carteirinha por visão, resposta quebrada por parágrafo, pausa + resumo ao
 * fim da triagem.
 *
 * ⚠️ Não foi exercitado contra um Chatwoot/OpenAI reais nesta versão — ligar em
 * homologação primeiro.
 */

const ASSUNTOS = ['internacao', 'consulta', 'informacao_paciente', 'administrativo', 'recursos_humanos', 'outro_assunto']
const PARA_QUEM = ['voce_mesmo', 'familiar', 'amigo']
const TIPOS = ['lead', 'ex_paciente', 'responsavel', 'medico', 'consultor']
const FORMAS = ['plano', 'particular', 'nao_sabe']
const PLANOS = [
  'alice', 'allianz_saude', 'amafresp', 'amil', 'banco_central_do_brasil_saude', 'blue', 'bradesco_saude', 'care_plus',
  'central_nacional_unimed_cnu', 'economus', 'fundacao_saude_itau', 'gama_saude', 'life_empresarial_saude', 'mediservice',
  'medsenior', 'medtour', 'metrus', 'notredame_intermedica', 'omint_saude', 'porto_saude', 'postal_saude', 'prevent_senior',
  'proasa_adventista_de_saude', 'sami_saude', 'santa_casa_saude', 'saude_caixa', 'sbc_saude', 'sepaco', 'sulamerica',
  'total_medcare', 'trasmontano', 'vivest', 'particular', 'nao_possui',
]
const STATUS = ['em_triagem', 'qualificado', 'desqualificado', 'internado']
const DESQUALIFICACAO = ['lgpd_recusada', 'fora_do_escopo', 'plano_nao_aceito', 'desistiu']

const TOOLS: ToolSpec[] = [
  {
    type: 'function',
    function: {
      name: 'salvar_triagem',
      description: 'Grava a triagem no CRM (Supabase). Chamar UMA ÚNICA VEZ, ao final do fluxo.',
      parameters: {
        type: 'object',
        properties: {
          contact_name: { type: 'string', description: 'Nome completo do PACIENTE (nunca do interlocutor, salvo para_quem=voce_mesmo)' },
          email: { type: ['string', 'null'] },
          cpf: { type: ['string', 'null'], description: '11 dígitos, só números' },
          data_nascimento: { type: ['string', 'null'], description: 'AAAA-MM-DD' },
          paciente_id: { type: ['string', 'null'], description: 'uuid retornado por buscar_paciente_por_cpf' },
          assunto: { type: ['string', 'null'], enum: [...ASSUNTOS, null] },
          para_quem: { type: ['string', 'null'], enum: [...PARA_QUEM, null] },
          tipo_contato: { type: ['string', 'null'], enum: [...TIPOS, null] },
          ex_paciente: { type: ['boolean', 'null'] },
          forma_internacao: { type: ['string', 'null'], enum: [...FORMAS, null] },
          plano_saude: { type: ['string', 'null'] },
          carteirinha_enviada: { type: 'boolean' },
          tags: { type: 'array', items: { type: 'string' } },
          etapa_atual: { type: 'integer', minimum: 1, maximum: 9 },
          triagem_concluida: { type: 'boolean' },
          transbordado: { type: 'boolean' },
          status: { type: 'string', enum: STATUS },
          motivo_desqualificacao: { type: ['string', 'null'], enum: [...DESQUALIFICACAO, null] },
          observacoes: { type: ['string', 'null'] },
        },
        required: ['contact_name', 'triagem_concluida', 'transbordado', 'status'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'buscar_paciente_por_cpf',
      description: 'Busca o paciente na base do hospital pelo CPF (11 dígitos). Devolve id e nome quando existe.',
      parameters: { type: 'object', properties: { cpf: { type: 'string' } }, required: ['cpf'] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'base_conhecimento_hsm',
      description:
        'Base de conhecimento oficial do hospital (visitas, enxoval, itens proibidos, localização, internação, coparticipação, prontuário, remoção). Passe a pergunta do contato como query.',
      parameters: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] },
    },
  },
]

const VISION_PROMPT = `Você é um extrator de dados de carteirinhas de plano de saúde. Retorne EXATAMENTE no formato:
Nome: [nome completo do titular]
Plano: [nome do plano]
Número: [número da carteirinha]
Se algum campo não estiver legível escreva "não identificado". Sem explicações, sem markdown. Se a imagem NÃO for uma carteirinha, retorne os três campos como "não identificado".`

function modelo(): string {
  return process.env.BOT_MODEL || 'gpt-4.1-mini'
}

function pick<T extends string>(v: unknown, lista: readonly T[]): T | null {
  const s = String(v ?? '').trim().toLowerCase()
  return (lista as readonly string[]).includes(s) ? (s as T) : null
}

async function extrairCarteirinha(dataUrl: string): Promise<string | null> {
  try {
    const res = await fetch(dataUrl, { signal: AbortSignal.timeout(20_000) })
    if (!res.ok) return null
    const buf = Buffer.from(await res.arrayBuffer())
    const mime = res.headers.get('content-type') || 'image/jpeg'
    const b64 = `data:${mime};base64,${buf.toString('base64')}`
    const r = await chat({
      model: process.env.BOT_VISION_MODEL || 'gpt-4o-mini',
      messages: [
        { role: 'system', content: VISION_PROMPT },
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Extraia os dados da carteirinha na imagem.' },
            { type: 'image_url', image_url: { url: b64 } },
          ],
        },
      ],
      temperature: 0,
    })
    return r.content
  } catch (e) {
    console.warn('[bot] visão falhou:', (e as Error).message)
    return null
  }
}

async function historico(conversationId: string | number, atualId: number, anexoTexto: string | null): Promise<ChatMessage[]> {
  const msgs = await listConversationMessages(conversationId)
  const ordenadas = [...msgs].sort((a, b) => (a.created_at ?? 0) - (b.created_at ?? 0)).slice(-30)
  const out: ChatMessage[] = []
  for (const m of ordenadas) {
    if (m.private) continue
    const tipo = typeof m.message_type === 'number' ? (m.message_type === 0 ? 'incoming' : m.message_type === 1 ? 'outgoing' : 'other') : String(m.message_type)
    if (tipo !== 'incoming' && tipo !== 'outgoing') continue
    let texto = (m.content ?? '').trim()
    if (m.id === atualId && anexoTexto) texto = `${texto}\n\n${anexoTexto}`.trim()
    if (!texto) {
      const ft = m.attachments?.[0]?.file_type
      texto = ft === 'audio' ? '[áudio recebido — peça para escrever em texto]' : ft ? `[${ft} recebido]` : ''
    }
    if (!texto) continue
    out.push({ role: tipo === 'incoming' ? 'user' : 'assistant', content: texto })
  }
  return out
}

async function executarTool(
  nome: string,
  args: AnyObj,
  ctx: { admin: SupabaseClient; conversationId: string; messageId: number | null; phone: string | null }
): Promise<{ resultado: string; salvou?: AnyObj }> {
  if (nome === 'buscar_paciente_por_cpf') {
    const cpf = String(args.cpf ?? '').replace(/\D/g, '')
    if (cpf.length !== 11) return { resultado: JSON.stringify({ encontrados: [] }) }
    const { data } = await ctx.admin.from('pacientes').select('id, nome_cliente, identificador_cliente').eq('cpf', cpf).limit(3)
    return { resultado: JSON.stringify({ encontrados: data ?? [] }) }
  }
  if (nome === 'base_conhecimento_hsm') {
    try {
      const vec = await embed(process.env.BOT_EMBEDDING_MODEL || 'text-embedding-3-small', String(args.query ?? ''))
      const { data, error } = await ctx.admin.rpc('match_documents', { query_embedding: vec, match_count: 4, filter: {} })
      if (error) throw new Error(error.message)
      const docs = ((data ?? []) as Array<{ content?: string }>).map((d) => d.content).filter(Boolean)
      return { resultado: docs.length ? docs.join('\n---\n') : 'Nada encontrado na base; use o ANEXO A.' }
    } catch (e) {
      return { resultado: `Base indisponível (${(e as Error).message}); use o ANEXO A.` }
    }
  }
  if (nome === 'salvar_triagem') {
    const patch: AnyObj = {
      message_id: ctx.messageId,
      phone: ctx.phone,
      contact_name: typeof args.contact_name === 'string' ? args.contact_name.trim() || null : null,
      email: typeof args.email === 'string' && args.email.includes('@') ? args.email.trim() : null,
      assunto: pick(args.assunto, ASSUNTOS),
      para_quem: pick(args.para_quem, PARA_QUEM),
      tipo_contato: pick(args.tipo_contato, TIPOS),
      ex_paciente: typeof args.ex_paciente === 'boolean' ? args.ex_paciente : null,
      forma_internacao: pick(args.forma_internacao, FORMAS),
      plano_saude: pick(args.plano_saude, PLANOS),
      carteirinha_enviada: args.carteirinha_enviada === true,
      tags: Array.isArray(args.tags) ? args.tags.filter((t: unknown) => typeof t === 'string').slice(0, 10) : [],
      etapa_atual: Number.isFinite(Number(args.etapa_atual)) ? Number(args.etapa_atual) : null,
      triagem_concluida: args.triagem_concluida === true,
      transbordado: args.transbordado === true,
      status: pick(args.status, STATUS) ?? 'em_triagem',
      motivo_desqualificacao: pick(args.motivo_desqualificacao, DESQUALIFICACAO),
      observacoes: typeof args.observacoes === 'string' ? args.observacoes.slice(0, 4000) : null,
      cpf: String(args.cpf ?? '').replace(/\D/g, '').length === 11 ? String(args.cpf).replace(/\D/g, '') : null,
      data_nascimento: /^\d{4}-\d{2}-\d{2}$/.test(String(args.data_nascimento ?? '')) ? String(args.data_nascimento) : null,
      paciente_id: /^[0-9a-f-]{36}$/i.test(String(args.paciente_id ?? '')) ? String(args.paciente_id) : null,
    }
    patch.kids = isKids(patch.data_nascimento)
    const salvo = await escreverComRedeDeSeguranca(ctx.admin, { conversation_id: ctx.conversationId }, patch)
    return { resultado: JSON.stringify({ ok: true }), salvou: salvo ?? patch }
  }
  return { resultado: `tool desconhecida: ${nome}` }
}

function resumo(t: AnyObj): string {
  const linhas = [
    '📝 Resumo da triagem (Mônica)',
    `Paciente: ${t.contact_name ?? '—'}`,
    `Nascimento: ${t.data_nascimento ?? '—'}${t.kids ? ' (Kids)' : ''}`,
    `Assunto: ${t.assunto ?? '—'}`,
    `Para quem: ${t.para_quem ?? '—'}`,
    `Categoria: ${t.tipo_contato ?? '—'}`,
    `Forma: ${t.forma_internacao ?? '—'}`,
    `Plano: ${t.plano_saude ?? '—'}`,
    `CPF: ${t.cpf ?? '—'}`,
    '',
    `Observações: ${t.observacoes ?? '—'}`,
  ]
  return linhas.join('\n')
}

export async function responderComoMonica(input: {
  admin: SupabaseClient
  conversation: AnyObj
  triagem: AnyObj
  mensagem: AnyObj
}): Promise<AnyObj> {
  const { admin, conversation, mensagem } = input
  const conversationId = String(conversation.id)
  const messageId = Number(mensagem.id) || null
  const phone = (conversation.meta?.sender?.phone_number as string | undefined) ?? null

  // Anexos: imagem → visão (carteirinha); áudio → pede texto.
  let anexoTexto: string | null = null
  const anexo = Array.isArray(mensagem.attachments) ? mensagem.attachments[0] : null
  if (anexo?.file_type === 'image' && anexo.data_url) {
    const dados = await extrairCarteirinha(String(anexo.data_url))
    if (dados) anexoTexto = `DADOS EXTRAÍDOS DA CARTEIRINHA (o usuário enviou a foto):\n${dados}`
  }

  const messages: ChatMessage[] = [
    { role: 'system', content: prompt.system },
    ...(await historico(conversationId, messageId ?? -1, anexoTexto)),
  ]
  if (!messages.some((m) => m.role === 'user')) {
    const texto = String(mensagem.content ?? '').trim() || anexoTexto || '[mensagem sem texto]'
    messages.push({ role: 'user', content: texto })
  }

  let salvou: AnyObj | null = null
  let resposta: string | null = null
  for (let i = 0; i < 4; i++) {
    const r = await chat({ model: modelo(), messages, tools: TOOLS })
    if (r.tool_calls?.length) {
      messages.push({ role: 'assistant', content: r.content ?? null, tool_calls: r.tool_calls })
      for (const tc of r.tool_calls) {
        let args: AnyObj = {}
        try {
          args = JSON.parse(tc.function.arguments || '{}')
        } catch {
          args = {}
        }
        const out = await executarTool(tc.function.name, args, { admin, conversationId, messageId, phone })
        if (out.salvou) salvou = out.salvou
        messages.push({ role: 'tool', tool_call_id: tc.id, content: out.resultado })
      }
      continue
    }
    resposta = r.content
    break
  }

  const enviadas: number[] = []
  if (resposta) {
    const partes = resposta
      .split('\n\n')
      .map((p) => p.trim())
      .filter((p) => p && !p.includes('triagem_concluida'))
    for (const parte of partes) {
      const m = await sendMessage(conversationId, parte)
      if (m?.id) enviadas.push(m.id)
      await new Promise((r) => setTimeout(r, 1200))
    }
  }

  // Fim da triagem: pausa o bot, espelha no Chatwoot e deixa o resumo para a equipe.
  const atual = (await lerTriagem(admin, { conversation_id: conversationId })) ?? salvou
  const acabou = !!atual && (atual.transbordado === true || atual.triagem_concluida === true)
  if (acabou) {
    try {
      await updateConversationCustomAttributes(conversationId, { [KEYS.botPausado]: true }, conversation.custom_attributes)
      if (salvou) {
        await pushTriagemParaChatwoot(admin, atual, salvou)
        await postPrivateNote(conversationId, resumo(atual))
      }
    } catch (e) {
      console.warn('[bot] pós-triagem:', (e as Error).message)
    }
  }
  return { respondeu: enviadas.length, salvou: !!salvou, triagemFinalizada: acabou }
}
