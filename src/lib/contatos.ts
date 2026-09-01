import type { SupabaseClient } from '@supabase/supabase-js'
import { LIMITE_RESPONSAVEIS, type PapelContato } from '@/types'

/**
 * Reconhecimento de quem está falando e vínculo com o card certo.
 *
 * Fluxo combinado com o cliente (set/2026):
 *  1. chega mensagem → identifica a PESSOA pelo telefone do WhatsApp
 *     (consultor já cadastrado vence; senão, cria/reaproveita um responsável);
 *  2. procura o PACIENTE pelo CPF entre os cards existentes;
 *     ⚠️ o telefone identifica a PESSOA, nunca o paciente: o mesmo número fala de
 *     vários pacientes (pai com dois filhos, consultor com vários encaminhados).
 *     Card por telefone juntaria pacientes diferentes no mesmo atendimento;
 *  3. achou → vincula a pessoa àquele card; não achou → card novo;
 *  4. o card aceita 4 responsáveis. Do 5º em diante o contato NÃO vira vínculo,
 *     só evento no histórico — foi o que o cliente pediu.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyObj = Record<string, any>

/** Só os dígitos, e sem o 55 do país — é assim que comparamos com o cadastro. */
export function normalizarTelefone(bruto: string | null | undefined): string | null {
  if (!bruto) return null
  let d = String(bruto).replace(/\D/g, '')
  if (d.length > 11 && d.startsWith('55')) d = d.slice(2)
  return d.length >= 10 ? d : null
}

/**
 * Variantes do mesmo número: o WhatsApp entrega celulares de SP com e sem o 9
 * extra, e o cadastro pode ter vindo de qualquer um dos dois jeitos.
 */
export function variantesTelefone(tel: string): string[] {
  const out = new Set<string>([tel])
  if (tel.length === 11 && tel[2] === '9') out.add(tel.slice(0, 2) + tel.slice(3))
  if (tel.length === 10) out.add(tel.slice(0, 2) + '9' + tel.slice(2))
  return Array.from(out)
}

export interface PessoaIdentificada {
  papel: PapelContato
  id: string
  nome: string
  novo: boolean
}

/**
 * Quem é esta pessoa? Consultor cadastrado tem prioridade (a lista deles é
 * fechada e veio do formulário); qualquer outro número vira responsável.
 */
export async function identificarPessoa(
  admin: SupabaseClient,
  telefoneBruto: string | null | undefined,
  nomeWhatsapp: string | null | undefined
): Promise<PessoaIdentificada | null> {
  const tel = normalizarTelefone(telefoneBruto)
  if (!tel) return null
  const variantes = variantesTelefone(tel)

  const { data: consultores } = await admin
    .from('consultores')
    .select('id, nome, telefones')
    .overlaps('telefones', variantes)
    .limit(1)
  if (consultores?.length) {
    const c = consultores[0] as AnyObj
    return { papel: 'consultor', id: c.id, nome: c.nome, novo: false }
  }

  const { data: responsaveis } = await admin
    .from('responsaveis')
    .select('id, nome, telefones')
    .overlaps('telefones', variantes)
    .limit(1)
  if (responsaveis?.length) {
    const r = responsaveis[0] as AnyObj
    return { papel: 'responsavel', id: r.id, nome: r.nome, novo: false }
  }

  // Ninguém conhecido: cria a ficha do responsável com o que o WhatsApp entrega.
  const nome = (nomeWhatsapp ?? '').trim() || `Contato ${tel}`
  const { data: criado, error } = await admin
    .from('responsaveis')
    .insert({ nome, telefone: tel, telefones: [tel] })
    .select('id, nome')
    .single()
  if (error || !criado) {
    console.warn('[contatos] não foi possível criar o responsável:', error?.message)
    return null
  }
  return { papel: 'responsavel', id: (criado as AnyObj).id, nome: (criado as AnyObj).nome, novo: true }
}

/** Card existente do paciente, pelo CPF (critério único combinado com o cliente). */
export async function acharCardPorCpf(admin: SupabaseClient, cpf: string | null | undefined): Promise<AnyObj | null> {
  const limpo = (cpf ?? '').replace(/\D/g, '')
  if (limpo.length !== 11) return null
  const { data } = await admin
    .from('triagem_hsm')
    .select('id, contact_name, cpf, conversation_id')
    .eq('cpf', limpo)
    .order('updated_at', { ascending: false })
    .limit(1)
  return (data?.[0] as AnyObj) ?? null
}

export interface ResultadoVinculo {
  status: 'vinculado' | 'ja_vinculado' | 'limite' | 'erro'
  detalhe?: string
}

/**
 * Vincula a pessoa ao card, respeitando o limite de responsáveis. Quando o limite
 * estoura, devolve `limite` para quem chamou registrar apenas no histórico.
 */
export async function vincularAoCard(
  admin: SupabaseClient,
  triagemId: string,
  pessoa: PessoaIdentificada
): Promise<ResultadoVinculo> {
  const coluna = pessoa.papel === 'responsavel' ? 'responsavel_id' : 'consultor_id'

  const { data: existente } = await admin
    .from('contato_vinculos')
    .select('id')
    .eq('triagem_id', triagemId)
    .eq(coluna, pessoa.id)
    .maybeSingle()
  if (existente) return { status: 'ja_vinculado' }

  const { count } = await admin
    .from('contato_vinculos')
    .select('id', { count: 'exact', head: true })
    .eq('triagem_id', triagemId)
    .eq('papel', 'responsavel')

  const primeiro = !count

  const { error } = await admin.from('contato_vinculos').insert({
    triagem_id: triagemId,
    papel: pessoa.papel,
    [coluna]: pessoa.id,
    principal: pessoa.papel === 'responsavel' && primeiro,
  })

  if (error) {
    if (error.message.includes('LIMITE_RESPONSAVEIS')) return { status: 'limite' }
    if (error.code === '23505') return { status: 'ja_vinculado' }
    return { status: 'erro', detalhe: error.message }
  }
  return { status: 'vinculado' }
}

/** Evento no histórico do card — o cliente pediu que todo contato apareça lá. */
export async function registrarNoHistorico(
  admin: SupabaseClient,
  triagemId: string,
  conteudo: string,
  autor = 'Sistema'
): Promise<void> {
  try {
    await admin.from('anotacoes').insert({
      triagem_id: triagemId,
      usuario_id: null,
      conteudo,
      origem: 'chatwoot',
      autor_nome: autor,
    })
  } catch (e) {
    console.warn('[contatos] histórico:', (e as Error).message)
  }
}

export { LIMITE_RESPONSAVEIS }
