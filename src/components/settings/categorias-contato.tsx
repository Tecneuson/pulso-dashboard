'use client'

import { useState } from 'react'
import { Lock, Plus, RotateCcw, Trash2 } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent, Button, Input, Select } from '@/components/ui'
import { useCategoriasContato } from '@/lib/api-store'
import { CATEGORIA_CONTATO, CATEGORIA_CONTATO_LABELS, type CategoriaContato } from '@/types'

/**
 * Configurações → Categorias de contato.
 *
 * Cada linha é um PERFIL (o que fica gravado no lead e vai para o atributo
 * `quem_e_o_contato` do Chatwoot). O GRUPO é o que os relatórios somam: cadastrar
 * "Terapeuta" no grupo Consultor faz o perfil aparecer sozinho na lista e, ao mesmo
 * tempo, entrar no total de "Consultores".
 *
 * Os cinco perfis originais vêm marcados com cadeado: podem ser renomeados, não
 * removidos — leads antigos e o Chatwoot ainda apontam para esses slugs.
 */

const OPCOES_GRUPO = CATEGORIA_CONTATO.map((c) => ({ value: c, label: CATEGORIA_CONTATO_LABELS[c] }))

const DICA_GRUPO: Record<CategoriaContato, string> = {
  paciente: 'A própria pessoa que será atendida.',
  responsavel: 'Familiar, amigo(a) ou responsável legal falando pelo paciente.',
  consultor: 'Quem encaminha: médico, terapeuta, psicólogo, clínica ou outro hospital.',
}

export function CategoriasContato() {
  const categorias = useCategoriasContato()
  const [label, setLabel] = useState('')
  const [grupo, setGrupo] = useState<CategoriaContato>('consultor')
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)

  async function criar() {
    const nome = label.trim()
    if (!nome) return
    setSalvando(true)
    setErro(null)
    const maiorOrdem = categorias.items.reduce((m, c) => Math.max(m, c.ordem), 0)
    const criado = await categorias.add({ label: nome, grupo, ordem: maiorOrdem + 10 })
    setSalvando(false)
    if (!criado) {
      setErro(categorias.error ?? 'Não foi possível criar o perfil.')
      return
    }
    setLabel('')
  }

  async function renomear(id: string, novo: string) {
    const nome = novo.trim()
    if (!nome) return
    setErro(null)
    await categorias.update(id, { label: nome })
    if (categorias.error) setErro(categorias.error)
  }

  async function trocarGrupo(id: string, novo: CategoriaContato) {
    setErro(null)
    await categorias.update(id, { grupo: novo })
    if (categorias.error) setErro(categorias.error)
  }

  async function alternarAtivo(id: string, ativo: boolean) {
    setErro(null)
    if (ativo) await categorias.update(id, { ativo: true })
    else await categorias.remove(id)
    if (categorias.error) setErro(categorias.error)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Categorias de contato</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-content-secondary mb-4">
          Quem pode estar falando com o hospital. O <strong>grupo</strong> define onde o perfil é somado
          nos relatórios — &ldquo;Consultores&rdquo; junta Médico, Terapeuta, Psicólogo e Consultor, e o
          detalhamento por pessoa continua disponível.
        </p>

        {/* novo perfil */}
        <div className="flex flex-wrap items-end gap-2 mb-4">
          <div className="flex-1 min-w-[180px]">
            <label className="text-overline uppercase text-content-tertiary block mb-1">Nome do perfil</label>
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Ex.: Terapeuta"
              onKeyDown={(e) => {
                if (e.key === 'Enter') void criar()
              }}
            />
          </div>
          <div className="min-w-[180px]">
            <label className="text-overline uppercase text-content-tertiary block mb-1">Grupo (relatórios)</label>
            <Select
              value={grupo}
              onChange={(e) => setGrupo(e.target.value as CategoriaContato)}
              options={OPCOES_GRUPO}
            />
          </div>
          <Button onClick={() => void criar()} disabled={!label.trim() || salvando}>
            <Plus className="w-4 h-4" />
            Adicionar
          </Button>
        </div>
        <p className="text-xs text-content-tertiary -mt-2 mb-4">{DICA_GRUPO[grupo]}</p>

        {erro && (
          <p className="text-sm text-danger-600 dark:text-danger-500 mb-3" role="alert">
            {erro}
          </p>
        )}

        {/* lista */}
        <div className="divide-y divide-border border border-border rounded-lg overflow-hidden">
          {categorias.items.length === 0 && (
            <p className="text-sm text-content-tertiary px-3 py-6 text-center">
              Carregando… se continuar vazio, rode a migration 20260909_categorias_contato.sql.
            </p>
          )}
          {categorias.items.map((c) => (
            <div
              key={c.id}
              className={`flex flex-wrap items-center gap-2 px-3 py-2 ${c.ativo ? '' : 'opacity-55'}`}
            >
              <div className="flex items-center gap-1.5 flex-1 min-w-[160px]">
                {c.sistema && (
                  <span title="Perfil usado pelo Chatwoot e por leads antigos: pode renomear, não remover.">
                    <Lock className="w-3.5 h-3.5 text-content-tertiary shrink-0" />
                  </span>
                )}
                <Input
                  defaultValue={c.label}
                  onBlur={(e) => {
                    if (e.target.value.trim() !== c.label) void renomear(c.id, e.target.value)
                  }}
                  className="h-8"
                />
              </div>

              <Select
                value={c.grupo}
                onChange={(e) => void trocarGrupo(c.id, e.target.value as CategoriaContato)}
                options={OPCOES_GRUPO}
                className="h-8 w-[150px]"
              />

              <code className="text-[11px] text-content-tertiary w-[110px] truncate" title={c.slug}>
                {c.slug}
              </code>

              {c.sistema ? (
                <span className="w-8 text-center text-content-tertiary text-xs">—</span>
              ) : (
                <button
                  type="button"
                  onClick={() => void alternarAtivo(c.id, !c.ativo)}
                  title={c.ativo ? 'Desativar (some do seletor, os leads antigos continuam)' : 'Reativar'}
                  className="p-1.5 rounded-md text-content-tertiary hover:text-content-primary hover:bg-surface-tertiary"
                >
                  {c.ativo ? <Trash2 className="w-4 h-4" /> : <RotateCcw className="w-4 h-4" />}
                </button>
              )}
            </div>
          ))}
        </div>

        <p className="text-xs text-content-tertiary mt-3">
          Ao adicionar ou renomear, use <strong>Sincronizar</strong> em Campos personalizados para levar a
          lista ao Chatwoot (atributo &ldquo;Quem é o contato&rdquo;).
        </p>
      </CardContent>
    </Card>
  )
}
