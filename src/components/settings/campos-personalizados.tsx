'use client'

import { useState } from 'react'
import { Plus, RefreshCw, ShieldCheck, ToggleLeft, ToggleRight } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent, Button, Input, Select } from '@/components/ui'
import { useCampos } from '@/lib/api-store'
import { CAMPO_TIPO, CAMPO_TIPO_LABELS, type CampoModelo, type CampoTipo } from '@/types'

/**
 * Configurações → Campos personalizados. O Chatwoot é a central: criar aqui cria lá na
 * hora; o que for criado lá aparece aqui ao sincronizar. Os valores ficam no card do lead.
 */

function slugify(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/^[^a-z]+/, '')
    .slice(0, 64)
}

interface Auditoria {
  total: number
  faltando: Array<{ chave: string; modelo: string }>
  legados: Array<{ chave: string; modelo: string; motivo: string }>
  desconhecidas: Array<{ chave: string; modelo: string; rotulo: string }>
  duplicadas: Array<{ chave: string; modelos: string[] }>
  parecidas: string[][]
  listasDivergentes: Array<{ chave: string; faltam: string[]; extras: string[] }>
}

export function CamposPersonalizados() {
  const campos = useCampos()
  const [rotulo, setRotulo] = useState('')
  const [chave, setChave] = useState('')
  const [chaveEditada, setChaveEditada] = useState(false)
  const [modelo, setModelo] = useState<CampoModelo>('contact')
  const [tipo, setTipo] = useState<CampoTipo>('text')
  const [opcoes, setOpcoes] = useState('')
  const [descricao, setDescricao] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [auditoria, setAuditoria] = useState<Auditoria | null>(null)

  async function criar() {
    setErro(null)
    setMsg(null)
    if (!rotulo.trim() || !chave) {
      setErro('Informe o rótulo (a chave é gerada automaticamente).')
      return
    }
    const lista = opcoes
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean)
    if (tipo === 'list' && !lista.length) {
      setErro('Campo do tipo Lista precisa de pelo menos uma opção (uma por linha).')
      return
    }
    setBusy(true)
    const criado = await campos.add({
      rotulo: rotulo.trim(),
      chave,
      modelo,
      tipo,
      opcoes: lista,
      descricao: descricao.trim() || null,
    })
    setBusy(false)
    if (!criado) {
      setErro(campos.error ?? 'Falha ao criar o campo.')
      return
    }
    setRotulo('')
    setChave('')
    setChaveEditada(false)
    setOpcoes('')
    setDescricao('')
    setMsg(`Campo "${criado.rotulo}" criado no Chatwoot e no CRM.`)
  }

  async function sincronizar() {
    setBusy(true)
    setErro(null)
    setMsg(null)
    try {
      const res = await fetch('/api/campos/sync', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
      const partes = [
        data.coreCriados?.length ? `${data.coreCriados.length} campo(s) padrão criado(s) no Chatwoot` : null,
        data.coreAtualizados?.length ? `${data.coreAtualizados.length} lista(s) padrão alinhada(s)` : null,
        data.criadosNoChatwoot?.length ? `${data.criadosNoChatwoot.length} criado(s) no Chatwoot` : null,
        data.importadosDoChatwoot?.length ? `${data.importadosDoChatwoot.length} importado(s) do Chatwoot` : null,
        data.atualizadosDoChatwoot?.length ? `${data.atualizadosDoChatwoot.length} atualizado(s) a partir do Chatwoot` : null,
        data.legadosEncontrados?.length ? `legados encontrados: ${data.legadosEncontrados.join(', ')}` : null,
      ].filter(Boolean)
      setMsg(partes.length ? `Sincronizado: ${partes.join(' · ')}.` : 'Tudo já estava sincronizado.')
      if (data.erros?.length) setErro(data.erros.join(' | '))
      await campos.refresh()
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao sincronizar')
    } finally {
      setBusy(false)
    }
  }

  async function auditar() {
    setBusy(true)
    setErro(null)
    try {
      const res = await fetch('/api/chatwoot/auditoria')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
      setAuditoria(data as Auditoria)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha na auditoria')
    } finally {
      setBusy(false)
    }
  }

  const inputCls =
    'w-full rounded bg-surface-tertiary border border-border text-sm text-content-primary placeholder:text-content-tertiary px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500'

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <span className="inline-flex items-center gap-2">Campos personalizados (Chatwoot ⇄ CRM)</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-content-secondary mb-3">
          O Chatwoot é a central desses campos. Criar aqui cria o atributo no Chatwoot na hora; o que
          for criado lá aparece aqui ao sincronizar. Os valores são editados no card do lead e ficam
          sempre iguais nos dois lados.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2">
          <Input
            placeholder="Rótulo (ex.: Número da carteirinha)"
            value={rotulo}
            onChange={(e) => {
              setRotulo(e.target.value)
              if (!chaveEditada) setChave(slugify(e.target.value))
            }}
          />
          <Input
            placeholder="chave_no_chatwoot"
            value={chave}
            onChange={(e) => {
              setChaveEditada(true)
              setChave(slugify(e.target.value))
            }}
          />
          <Select
            options={[
              { value: 'contact', label: 'Do contato (pessoa)' },
              { value: 'conversation', label: 'Da conversa' },
            ]}
            value={modelo}
            onChange={(e) => setModelo(e.target.value as CampoModelo)}
          />
          <Select
            options={CAMPO_TIPO.map((t) => ({ value: t, label: CAMPO_TIPO_LABELS[t] }))}
            value={tipo}
            onChange={(e) => setTipo(e.target.value as CampoTipo)}
          />
          {tipo === 'list' && (
            <textarea
              className={`${inputCls} sm:col-span-2`}
              rows={3}
              placeholder={'Opções da lista — uma por linha'}
              value={opcoes}
              onChange={(e) => setOpcoes(e.target.value)}
            />
          )}
          <div className="sm:col-span-2">
            <Input
              placeholder="Descrição (opcional — aparece como dica)"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
            />
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2 mb-3">
          <Button variant="secondary" size="sm" onClick={auditar} loading={busy}>
            <ShieldCheck size={14} />
            Auditar atributos
          </Button>
          <Button variant="secondary" size="sm" onClick={sincronizar} loading={busy}>
            <RefreshCw size={14} />
            Sincronizar com o Chatwoot
          </Button>
          <Button size="sm" onClick={criar} loading={busy}>
            <Plus size={14} />
            Criar campo
          </Button>
        </div>

        {erro && <p className="text-xs text-danger-500 mb-2">{erro}</p>}
        {msg && <p className="text-xs text-success-600 mb-2">{msg}</p>}

        {auditoria && (
          <div className="mb-3 rounded-lg border border-border bg-surface-secondary p-3 text-xs space-y-1">
            <p className="font-medium text-content-primary">
              Auditoria: {auditoria.total} atributos no Chatwoot
            </p>
            <p>
              Faltando (padrão): {auditoria.faltando.length ? auditoria.faltando.map((f) => f.chave).join(', ') : 'nenhum'}
            </p>
            <p>
              Redundantes/legados: {auditoria.legados.length ? auditoria.legados.map((l) => `${l.chave} — ${l.motivo}`).join(' · ') : 'nenhum'}
            </p>
            <p>
              Duplicados (contato e conversa): {auditoria.duplicadas.length ? auditoria.duplicadas.map((d) => d.chave).join(', ') : 'nenhum'}
            </p>
            <p>
              Chaves parecidas: {auditoria.parecidas.length ? auditoria.parecidas.map((g) => g.join(' ≈ ')).join(' · ') : 'nenhuma'}
            </p>
            <p>
              Listas divergentes: {auditoria.listasDivergentes.length ? auditoria.listasDivergentes.map((l) => `${l.chave} (faltam: ${l.faltam.join(', ') || '—'}; extras: ${l.extras.join(', ') || '—'})`).join(' · ') : 'nenhuma'}
            </p>
            <p>
              Não gerenciados pelo CRM: {auditoria.desconhecidas.length ? auditoria.desconhecidas.map((d) => d.chave).join(', ') : 'nenhum'}
            </p>
          </div>
        )}

        <div className="divide-y divide-border border-t border-border">
          {campos.items.length === 0 && (
            <p className="text-xs text-content-tertiary py-2">
              Nenhum campo personalizado ainda. Os campos padrão (funil, plano, venda, motivo de perda,
              data de nascimento, Kids…) são garantidos automaticamente no Chatwoot.
            </p>
          )}
          {campos.items.map((c) => (
            <div key={c.id} className="flex items-center justify-between gap-3 py-2">
              <div className="min-w-0">
                <p className={`text-sm truncate ${c.ativo ? 'text-content-primary' : 'text-content-tertiary line-through'}`}>
                  {c.rotulo}
                  <span className="ml-2 font-mono text-[11px] text-content-tertiary">{c.chave}</span>
                </p>
                <p className="text-xs text-content-tertiary truncate">
                  {c.modelo === 'contact' ? 'Contato' : 'Conversa'} · {CAMPO_TIPO_LABELS[c.tipo] ?? c.tipo}
                  {c.tipo === 'list' && c.opcoes.length ? ` · ${c.opcoes.join(', ')}` : ''}
                  {c.chatwoot_definition_id ? '' : ' · ainda não existe no Chatwoot'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => campos.update(c.id, { ativo: !c.ativo })}
                className="shrink-0 inline-flex items-center gap-1 text-xs text-content-secondary hover:text-content-primary"
                title={c.ativo ? 'Desativar no CRM (mantém no Chatwoot)' : 'Reativar'}
              >
                {c.ativo ? <ToggleRight size={18} className="text-success-600" /> : <ToggleLeft size={18} />}
                {c.ativo ? 'Ativo' : 'Inativo'}
              </button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
