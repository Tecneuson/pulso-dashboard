import { NextResponse, type NextRequest } from 'next/server'
import { requireUserApi } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { chatwootConfigured } from '@/lib/chatwoot/client'
import { espelharImagemNoChatwoot } from '@/lib/chatwoot/sync'
import { ANEXO_MAX_BYTES, NOTA_SEM_LEGENDA, tipoDaImagem } from '@/lib/anexos'

// Imagem anexada ao card. O ARQUIVO vai para o Chatwoot (nota privada com anexo, no disco
// da VPS); em `anotacoes.anexos` fica só o link. Sem conversa no Chatwoot não há onde
// guardar, então a rota recusa em vez de usar o storage do Supabase (plano free).

export const runtime = 'nodejs'
export const maxDuration = 60

const SELECT =
  'id, triagem_id, usuario_id, conteudo, created_at, origem, autor_nome, chatwoot_message_id, anexos, usuarios(nome)'
const EXT: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }

export async function POST(request: NextRequest) {
  const { user, error } = await requireUserApi()
  if (error) return error

  const form = await request.formData().catch(() => null)
  if (!form) return NextResponse.json({ error: 'envio inválido' }, { status: 400 })

  const triagemId = String(form.get('triagem_id') ?? '')
  if (!/^[0-9a-f-]{36}$/i.test(triagemId)) {
    return NextResponse.json({ error: 'triagem_id obrigatório' }, { status: 400 })
  }
  const legenda = String(form.get('conteudo') ?? '').trim()
  if (legenda.length > 5000) return NextResponse.json({ error: 'Legenda muito longa.' }, { status: 400 })

  const arquivo = form.get('arquivo')
  if (!(arquivo instanceof Blob) || arquivo.size === 0) {
    return NextResponse.json({ error: 'Escolha uma imagem.' }, { status: 400 })
  }
  if (arquivo.size > ANEXO_MAX_BYTES) {
    return NextResponse.json({ error: 'Imagem acima de 10 MB.' }, { status: 413 })
  }
  const buffer = await arquivo.arrayBuffer()
  const tipo = tipoDaImagem(new Uint8Array(buffer))
  if (!tipo) return NextResponse.json({ error: 'Formato não aceito. Use JPG, PNG ou WEBP.' }, { status: 415 })

  const admin = createAdminClient()
  const { data: lead } = await admin
    .from('triagem_hsm')
    .select('id, conversation_id')
    .eq('id', triagemId)
    .maybeSingle()
  if (!lead) return NextResponse.json({ error: 'lead não encontrado' }, { status: 404 })
  if (!lead.conversation_id || !chatwootConfigured()) {
    return NextResponse.json(
      { error: 'Este card não tem conversa no Chatwoot, então não há onde guardar a imagem.' },
      { status: 409 }
    )
  }

  // Antes de subir o arquivo: a coluna existe? (Senão a imagem ficaria no Chatwoot sem aparecer no card.)
  const { error: colErr } = await admin.from('anotacoes').select('anexos').limit(1)
  if (colErr) {
    return NextResponse.json(
      { error: 'Anexos ainda não habilitados no banco (rode a migration 20261110000000_anotacoes_anexos).' },
      { status: 503 }
    )
  }

  const { data: autor } = await admin.from('usuarios').select('nome').eq('id', user!.id).maybeSingle()
  // Checado antes do upload: sem isso a FK de usuario_id falharia com a imagem já no Chatwoot.
  if (!autor) return NextResponse.json({ error: 'Usuário não cadastrado na equipe (tabela usuarios).' }, { status: 403 })
  const nomeAutor = (autor.nome as string | undefined) || user!.email || 'Equipe'

  // Nome limpo, sem caminho nem caractere estranho; a extensão vem do tipo real do arquivo.
  const original = arquivo instanceof File ? arquivo.name : ''
  const base =
    original
      .replace(/\.[^.]*$/, '')
      .normalize('NFD')
      .replace(/[^\w-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'imagem'
  const nome = `${base}.${EXT[tipo]}`

  let enviado: Awaited<ReturnType<typeof espelharImagemNoChatwoot>>
  try {
    enviado = await espelharImagemNoChatwoot(lead.conversation_id, nomeAutor, legenda, {
      dados: new Blob([buffer], { type: tipo }),
      nome,
    })
  } catch (e) {
    console.warn('[anotacoes/anexo] upload no Chatwoot falhou:', (e as Error).message)
    return NextResponse.json({ error: 'O Chatwoot não aceitou a imagem. Tente de novo.' }, { status: 502 })
  }
  if (!enviado.anexos.length) {
    return NextResponse.json({ error: 'O Chatwoot não devolveu o link da imagem.' }, { status: 502 })
  }
  const anexos = enviado.anexos.map((a) => ({ ...a, nome: a.nome || nome, tamanho: a.tamanho ?? arquivo.size }))

  const { data, error: dbErr } = await admin
    .from('anotacoes')
    .insert({
      triagem_id: triagemId,
      usuario_id: user!.id,
      conteudo: legenda || NOTA_SEM_LEGENDA,
      origem: 'crm',
      autor_nome: nomeAutor,
      chatwoot_message_id: enviado.messageId,
      anexos,
    })
    .select(SELECT)
    .single()
  if (dbErr) {
    const msg =
      dbErr.code === '23503'
        ? 'Usuário não cadastrado na equipe (tabela usuarios).'
        : `A imagem foi para o Chatwoot, mas o card não registrou: ${dbErr.message}`
    return NextResponse.json({ error: msg }, { status: 500 })
  }
  return NextResponse.json({ ok: true, anotacao: data })
}
