'use client'

import { useState } from 'react'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { FIELD_OPTIONS } from '@/lib/chatwoot/mapping'
import { useCampos } from '@/lib/api-store'
import { idadeEm, isKids } from '@/lib/idade'
import type { TriagemLead } from '@/types'
import { OrigemFields, ORIGEM_VAZIA, type OrigemValue } from './origem-fields'
import { CategoriaContatoField, type ContatoValue } from './categoria-contato'
import { CamposDinamicos } from './campos-dinamicos'

/**
 * "Adicionar contato": tem TODOS os campos que existem no Chatwoot (core + personalizados).
 * Ao salvar, o lead entra em "Contato" e é espelhado como contato no Chatwoot (com os
 * atributos), mesmo sem conversa. A primeira anotação vai para o histórico.
 *
 * A categoria de quem está falando (Paciente / Responsável / Consultor) é escolhida aqui:
 * nem todo contato é o próprio paciente.
 */

function withEmpty(opts?: { value: string; label: string }[]) {
  return [{ value: '', label: '—' }, ...(opts ?? [])]
}

const FORMA_OPTIONS = [
  { value: 'plano', label: 'Plano de saúde' },
  { value: 'particular', label: 'Particular' },
  { value: 'nao_sabe', label: 'Não sabe' },
]
const ELEGIVEL_OPTIONS = [
  { value: 'sim', label: 'Sim' },
  { value: 'nao', label: 'Não' },
]

const EMPTY = {
  contact_name: '',
  phone: '',
  email: '',
  data_nascimento: '',
  para_quem: '',
  assunto: '',
  motivo_contato: '',
  forma_internacao: '',
  plano_saude: '',
  elegivel: '',
  anotacao_inicial: '',
}

const CONTATO_VAZIO: ContatoValue = {
  tipo_contato: null,
  consultor_id: null,
  responsavel_contato_id: null,
}

interface LeadFormProps {
  open: boolean
  onClose: () => void
  onCreated: (lead: TriagemLead) => void
}

export function LeadForm({ open, onClose, onCreated }: LeadFormProps) {
  const [form, setForm] = useState({ ...EMPTY })
  const [contato, setContato] = useState<ContatoValue>({ ...CONTATO_VAZIO })
  const [origem, setOrigem] = useState<OrigemValue>({ ...ORIGEM_VAZIA })
  const [atributos, setAtributos] = useState<Record<string, unknown>>({})
  const [erro, setErro] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const campos = useCampos()

  function set(field: keyof typeof EMPTY, value: string) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  function reset() {
    setForm({ ...EMPTY })
    setContato({ ...CONTATO_VAZIO })
    setOrigem({ ...ORIGEM_VAZIA })
    setAtributos({})
    setErro(null)
  }

  function fechar() {
    reset()
    onClose()
  }

  async function salvar() {
    if (!form.contact_name.trim()) {
      setErro('Informe o nome do paciente.')
      return
    }
    setSaving(true)
    setErro(null)
    try {
      const res = await fetch('/api/triagem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contact_name: form.contact_name.trim(),
          phone: form.phone.trim() || null,
          email: form.email.trim() || null,
          data_nascimento: form.data_nascimento || null,
          tipo_contato: contato.tipo_contato,
          consultor_id: contato.consultor_id,
          responsavel_contato_id: contato.responsavel_contato_id,
          para_quem: form.para_quem || null,
          assunto: form.assunto || null,
          motivo_contato: form.motivo_contato || null,
          forma_internacao: form.forma_internacao || null,
          plano_saude: form.plano_saude || null,
          elegivel: form.elegivel ? form.elegivel === 'sim' : null,
          origem_conversa: origem.origem_conversa,
          origem_hospital_id: origem.origem_hospital_id,
          // Dimensão própria: o consultor que ENCAMINHOU, que pode não ser quem ligou.
          origem_consultor_id: origem.origem_consultor_id,
          origem_profissional_tipo: origem.origem_profissional_tipo,
          atributos,
          anotacao_inicial: form.anotacao_inicial.trim() || null,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || `erro HTTP ${res.status}`)
      onCreated(data.triagem as TriagemLead)
      fechar()
    } catch (e) {
      console.error('Falha ao criar lead:', e)
      // Mostra o motivo real (ex.: RLS recusando o insert) — sem isso o erro fica invisível.
      setErro(e instanceof Error ? `Falha ao criar o lead: ${e.message}` : 'Falha ao criar o lead.')
    } finally {
      setSaving(false)
    }
  }

  const inputCls =
    'w-full rounded bg-surface-tertiary border border-border text-sm text-content-primary placeholder:text-content-tertiary px-3 py-2.5 transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500'
  const idade = idadeEm(form.data_nascimento)
  const kids = isKids(form.data_nascimento)

  return (
    <Modal open={open} onClose={fechar} title="Adicionar contato" size="lg">
      <div className="space-y-4">
        <p className="text-xs text-content-secondary">
          Cria o lead na coluna <strong>Contato</strong> e espelha no Chatwoot como contato (com
          todos os campos) — sem abrir conversa. Telefone ou e-mail é necessário para o espelho.
        </p>

        {/* Quem está falando: paciente, responsável ou consultor */}
        <div className="rounded-lg border border-border p-3">
          <CategoriaContatoField
            value={contato}
            onChange={(p) => setContato((c) => ({ ...c, ...p }))}
          />
        </div>

        <Input
          label="Nome do paciente *"
          value={form.contact_name}
          onChange={(e) => set('contact_name', e.target.value)}
          placeholder="Nome de quem será atendido"
        />

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Telefone (WhatsApp)"
            value={form.phone}
            onChange={(e) => set('phone', e.target.value)}
            placeholder="(11) 99999-9999"
          />
          <Input
            label="E-mail"
            value={form.email}
            onChange={(e) => set('email', e.target.value)}
            placeholder="email@exemplo.com"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Input
              label="Data de nascimento"
              type="date"
              value={form.data_nascimento}
              onChange={(e) => set('data_nascimento', e.target.value)}
            />
            {idade != null && (
              <p className="text-xs text-content-tertiary mt-1">
                {idade} anos{kids ? ' · Kids (8–17)' : ''}
              </p>
            )}
          </div>
          <Select
            label="Para quem"
            options={withEmpty(FIELD_OPTIONS.para_quem)}
            value={form.para_quem}
            onChange={(e) => set('para_quem', e.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Select
            label="Assunto"
            options={withEmpty(FIELD_OPTIONS.assunto)}
            value={form.assunto}
            onChange={(e) => set('assunto', e.target.value)}
          />
          <Select
            label="Motivo do contato"
            options={withEmpty(FIELD_OPTIONS.motivo_contato)}
            value={form.motivo_contato}
            onChange={(e) => set('motivo_contato', e.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Select
            label="Forma de internação"
            options={withEmpty(FORMA_OPTIONS)}
            value={form.forma_internacao}
            onChange={(e) => set('forma_internacao', e.target.value)}
          />
          <Select
            label="Plano de saúde"
            options={withEmpty(FIELD_OPTIONS.plano_saude)}
            value={form.plano_saude}
            onChange={(e) => set('plano_saude', e.target.value)}
          />
        </div>

        <Select
          label="Elegível"
          options={withEmpty(ELEGIVEL_OPTIONS)}
          value={form.elegivel}
          onChange={(e) => set('elegivel', e.target.value)}
        />

        <div className="pt-3 border-t border-border">
          <OrigemFields
            value={origem}
            onChange={(patch) => setOrigem((o) => ({ ...o, ...patch }))}
          />
        </div>

        {campos.ativos.length > 0 && (
          <div className="pt-3 border-t border-border">
            <CamposDinamicos
              campos={campos.ativos}
              valores={atributos}
              onChange={(chave, valor) => setAtributos((a) => ({ ...a, [chave]: valor }))}
            />
          </div>
        )}

        <div>
          <p className="text-overline uppercase text-content-tertiary mb-1">Primeira anotação</p>
          <textarea
            value={form.anotacao_inicial}
            onChange={(e) => set('anotacao_inicial', e.target.value)}
            rows={3}
            className={inputCls}
            placeholder="Contexto do contato — vai para o histórico do lead"
          />
        </div>

        {erro && <p className="text-sm text-danger-500">{erro}</p>}

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
          <Button variant="ghost" size="sm" onClick={fechar}>
            Cancelar
          </Button>
          <Button size="sm" onClick={salvar} loading={saving}>
            Adicionar contato
          </Button>
        </div>
      </div>
    </Modal>
  )
}
