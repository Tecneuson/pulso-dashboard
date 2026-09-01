import { z } from 'zod'
import {
  ASSUNTO,
  CAMPO_MODELO,
  CAMPO_TIPO,
  ESTAGIO_FUNIL,
  MOTIVO_CONTATO,
  MOTIVO_PERDA,
  PARA_QUEM,
  STATUS_TRIAGEM,
  TIPO_CONTATO,
} from '@/types'
import { ORIGEM_CONVERSA, ORIGEM_PROFISSIONAL } from '@/lib/funil-etapas'

/**
 * Validação de entrada das rotas de API (zod). Antes, o PATCH de triagem aceitava
 * qualquer valor nos campos — o CHECK do banco segurava parte, o resto passava.
 */

const uuid = z.string().uuid()
const nullableUuid = uuid.nullable()
const textoCurto = z.string().trim().max(200)
const textoLongo = z.string().trim().max(5000)
const dataISO = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'data no formato YYYY-MM-DD')
  .nullable()

/** '' vindo de <select> vazio vira null. */
const enumOuNull = <T extends readonly [string, ...string[]]>(values: T) =>
  z.preprocess((v) => (v === '' ? null : v), z.enum(values).nullable())

const atributos = z.record(z.string().regex(/^[a-z0-9_-]{1,64}$/), z.unknown()).nullable()

export const triagemPatchSchema = z
  .object({
    id: uuid,
    estagio_funil: enumOuNull(ESTAGIO_FUNIL),
    plano_saude: z.preprocess((v) => (v === '' ? null : v), textoCurto.nullable()),
    tipo_contato: enumOuNull(TIPO_CONTATO),
    para_quem: enumOuNull(PARA_QUEM),
    motivo_contato: enumOuNull(MOTIVO_CONTATO),
    forma_internacao: enumOuNull(['plano', 'particular', 'nao_sabe'] as const),
    assunto: enumOuNull(ASSUNTO),
    motivo_perda: enumOuNull(MOTIVO_PERDA),
    tags: z.array(z.string().trim().min(1).max(60)).max(30).nullable(),
    status: enumOuNull(STATUS_TRIAGEM),
    motivo_desqualificacao: textoCurto.nullable(),
    paciente_id: nullableUuid,
    contact_name: z.preprocess((v) => (v === '' ? null : v), textoCurto.nullable()),
    data_nascimento: z.preprocess((v) => (v === '' ? null : v), dataISO),
    elegivel: z.boolean().nullable(),
    phone: z.preprocess((v) => (v === '' ? null : v), z.string().trim().max(40).nullable()),
    email: z.preprocess((v) => (v === '' ? null : v), z.string().trim().email().max(200).nullable()),
    numero_paciente: z.preprocess((v) => (v === '' ? null : v), textoCurto.nullable()),
    origem_conversa: enumOuNull(ORIGEM_CONVERSA),
    origem_hospital_id: nullableUuid,
    origem_consultor_id: nullableUuid,
    origem_profissional_tipo: enumOuNull(ORIGEM_PROFISSIONAL),
    captador_id: nullableUuid,
    consultor_id: nullableUuid,
    responsavel_contato_id: nullableUuid,
    atributos,
  })
  .partial()
  .required({ id: true })
  .strict()

export type TriagemPatch = z.infer<typeof triagemPatchSchema>

export const triagemCreateSchema = z
  .object({
    contact_name: textoCurto.min(1, 'contact_name obrigatório'),
    phone: z.preprocess((v) => (v === '' ? null : v), z.string().trim().max(40).nullable()).optional(),
    email: z.preprocess((v) => (v === '' ? null : v), z.string().trim().email().max(200).nullable()).optional(),
    data_nascimento: z.preprocess((v) => (v === '' ? null : v), dataISO).optional(),
    tipo_contato: enumOuNull(TIPO_CONTATO).optional(),
    para_quem: enumOuNull(PARA_QUEM).optional(),
    plano_saude: z.preprocess((v) => (v === '' ? null : v), textoCurto.nullable()).optional(),
    forma_internacao: enumOuNull(['plano', 'particular', 'nao_sabe'] as const).optional(),
    motivo_contato: enumOuNull(MOTIVO_CONTATO).optional(),
    assunto: enumOuNull(ASSUNTO).optional(),
    elegivel: z.boolean().nullable().optional(),
    origem_conversa: enumOuNull(ORIGEM_CONVERSA).optional(),
    origem_hospital_id: nullableUuid.optional(),
    origem_consultor_id: nullableUuid.optional(),
    origem_profissional_tipo: enumOuNull(ORIGEM_PROFISSIONAL).optional(),
    captador_id: nullableUuid.optional(),
    consultor_id: nullableUuid.optional(),
    responsavel_contato_id: nullableUuid.optional(),
    atributos: atributos.optional(),
    /** Primeira anotação (vai para o histórico e, se houver conversa, para o Chatwoot). */
    anotacao_inicial: textoLongo.nullable().optional(),
  })
  .strict()

export type TriagemCreate = z.infer<typeof triagemCreateSchema>

export const anotacaoCreateSchema = z.object({
  triagem_id: uuid,
  conteudo: textoLongo.min(1),
})

// ---------------------------------------------------------------------------
// Pessoas do contato: consultor e responsável (mesma ficha)
// ---------------------------------------------------------------------------
const cpfDigitos = z
  .preprocess(
    (v) => {
      if (v == null || v === '') return null
      const d = String(v).replace(/\D/g, '')
      return d || null
    },
    z.string().regex(/^\d{11}$/, 'CPF deve ter 11 dígitos').nullable()
  )
  .optional()

export const pessoaCreateSchema = z.object({
  nome: z.string().trim().min(2, 'nome muito curto').max(120),
  telefone: z.preprocess((v) => (v === '' ? null : v), z.string().trim().max(40).nullable()).optional(),
  email: z.preprocess((v) => (v === '' ? null : v), z.string().trim().email().max(200).nullable()).optional(),
  cpf: cpfDigitos,
  telefones: z.array(z.string().trim().min(8).max(20)).max(3).optional(),
  observacoes: z.preprocess((v) => (v === '' ? null : v), z.string().trim().max(1000).nullable()).optional(),
})

export const pessoaPatchSchema = z
  .object({
    id: uuid,
    nome: z.string().trim().min(2).max(120),
    telefone: z.preprocess((v) => (v === '' ? null : v), z.string().trim().max(40).nullable()),
    email: z.preprocess((v) => (v === '' ? null : v), z.string().trim().email().max(200).nullable()),
    cpf: cpfDigitos,
    telefones: z.array(z.string().trim().min(8).max(20)).max(3),
    observacoes: z.preprocess((v) => (v === '' ? null : v), z.string().trim().max(1000).nullable()),
    ativo: z.boolean(),
  })
  .partial()
  .required({ id: true })

export const vinculoCreateSchema = z.object({
  triagem_id: uuid,
  papel: z.enum(['responsavel', 'consultor']),
  pessoa_id: uuid,
  observacao: z.string().trim().max(300).nullable().optional(),
})

export const campoCreateSchema = z.object({
  chave: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z][a-z0-9_]{1,63}$/, 'chave: letras minúsculas, números e _ (ex.: numero_carteirinha)'),
  rotulo: z.string().trim().min(1).max(80),
  descricao: z.string().trim().max(300).nullable().optional(),
  modelo: z.enum(CAMPO_MODELO),
  tipo: z.enum(CAMPO_TIPO),
  opcoes: z.array(z.string().trim().min(1).max(80)).max(100).optional(),
})

export const campoPatchSchema = z
  .object({
    id: uuid,
    rotulo: z.string().trim().min(1).max(80),
    descricao: z.string().trim().max(300).nullable(),
    opcoes: z.array(z.string().trim().min(1).max(80)).max(100),
    ativo: z.boolean(),
    ordem: z.number().int().min(0).max(1000),
  })
  .partial()
  .required({ id: true })

/** Mensagem de erro amigável a partir de um ZodError. */
export function zodMensagem(e: z.ZodError): string {
  return e.issues.map((i) => `${i.path.join('.') || 'payload'}: ${i.message}`).join('; ')
}
