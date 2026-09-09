'use client'

import { useMemo } from 'react'
import { type CategoriaContato } from '@/types'
import { useCategoriasContato, useConsultores, useResponsaveis } from '@/lib/api-store'
import { CATEGORIAS_PADRAO, grupoDoSlug, porGrupo } from '@/lib/categorias'
import { PessoaField } from './pessoa-field'

/**
 * Quem está falando com o hospital. São três categorias — **Paciente**,
 * **Responsável** e **Consultor** — e nem sempre é o paciente que liga.
 *
 * Responsável e Consultor têm ficha própria (nome, telefone, e-mail, CPF), porque
 * a pessoa que intermedeia costuma voltar em outros atendimentos: o mesmo
 * consultor (ou o mesmo familiar) pode estar vinculado a VÁRIOS pacientes.
 *
 * Nos relatórios a categoria se desdobra em PERFIS (Lead / Ex-paciente / Responsável /
 * Médico / Consultor / Terapeuta / …) — é o que fica gravado em `tipo_contato`. A lista
 * é gerenciada pelo administrador em Configurações, então nada aqui é fixo no código.
 *
 * ⚠️ CATEGORIA ≠ ORIGEM. Aqui é **quem está falando agora**. Por onde o paciente
 * chegou é outra dimensão, editada em `OrigemFields` (`origem_conversa`), e as duas
 * se cruzam livremente: um paciente pode ligar tendo sido encaminhado por consultor,
 * e um consultor pode ligar sobre um paciente que chegou por outra via. Os dois
 * campos de consultor existem de propósito e guardam pessoas possivelmente diferentes.
 */

export interface ContatoValue {
  tipo_contato: string | null
  consultor_id: string | null
  responsavel_contato_id: string | null
}

const DESCRICAO: Record<CategoriaContato, string> = {
  paciente: 'A própria pessoa que será atendida entrou em contato.',
  responsavel: 'Familiar, amigo(a) ou responsável legal falando pelo paciente.',
  consultor: 'Médico, psicólogo, hospital ou outra instituição que encaminha o paciente.',
}

export function CategoriaContatoField({
  value,
  onChange,
}: {
  value: ContatoValue
  onChange: (patch: Partial<ContatoValue>) => void
}) {
  const consultores = useConsultores()
  const responsaveis = useResponsaveis()
  const categorias = useCategoriasContato()

  // Antes do primeiro carregamento (e enquanto a migration não roda) vale a lista fixa:
  // um seletor vazio impediria de classificar o contato.
  const perfis = categorias.ativos.length ? categorias.ativos : CATEGORIAS_PADRAO
  const grupos = useMemo(() => porGrupo(perfis), [perfis])

  const categoria = grupoDoSlug(perfis, value.tipo_contato)

  function escolherCategoria(c: CategoriaContato | null) {
    if (!c) {
      onChange({ tipo_contato: null, consultor_id: null, responsavel_contato_id: null })
      return
    }
    // Mantém o perfil quando ele já pertence à categoria escolhida.
    const daCategoria = grupos.find((g) => g.grupo === c)?.perfis ?? []
    const atual = daCategoria.find((p) => p.slug === value.tipo_contato)
    // Não apagamos os vínculos ao trocar de categoria: um RESPONSÁVEL pode ter sido
    // encaminhado por um CONSULTOR (as duas informações convivem). Para desfazer um
    // vínculo, use o "x" do próprio campo.
    onChange({ tipo_contato: atual?.slug ?? daCategoria[0]?.slug ?? null })
  }

  const perfisDaCategoria = categoria ? grupos.find((g) => g.grupo === categoria)?.perfis ?? [] : []

  return (
    <div className="space-y-3">
      <div>
        <p className="text-overline uppercase text-content-tertiary mb-1">Categoria do contato</p>
        <div className="grid grid-cols-3 gap-1.5">
          {grupos.map((g) => {
            const ativo = categoria === g.grupo
            return (
              <button
                key={g.grupo}
                type="button"
                onClick={() => escolherCategoria(ativo ? null : g.grupo)}
                className={`rounded-lg border px-2 py-2 text-sm font-medium transition-colors ${
                  ativo
                    ? 'bg-brand-500/15 border-brand-500/40 text-brand-700 dark:text-brand-300'
                    : 'bg-surface-secondary border-border text-content-secondary hover:border-border-hover hover:text-content-primary'
                }`}
              >
                {g.label}
              </button>
            )
          })}
        </div>
        {categoria && <p className="text-xs text-content-tertiary mt-1">{DESCRICAO[categoria]}</p>}
      </div>

      {/* Refinamento só quando a categoria tem mais de um perfil (relatórios). */}
      {perfisDaCategoria.length > 1 && (
        <div>
          <p className="text-overline uppercase text-content-tertiary mb-1">
            Perfil <span className="normal-case tracking-normal text-[10px]">(relatórios)</span>
          </p>
          <div className="flex gap-1.5">
            {perfisDaCategoria.map((p) => (
              <button
                key={p.slug}
                type="button"
                onClick={() => onChange({ tipo_contato: p.slug })}
                title={p.descricao ?? undefined}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                  value.tipo_contato === p.slug
                    ? 'bg-brand-500/12 border-brand-500/40 text-brand-700 dark:text-brand-300'
                    : 'bg-surface-secondary border-border text-content-secondary hover:text-content-primary'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {categoria === 'responsavel' && (
        <PessoaField
          label="Responsável (quem fez o contato)"
          itens={responsaveis.items}
          value={value.responsavel_contato_id}
          onChange={(id) => onChange({ responsavel_contato_id: id })}
          onCriar={(p) => responsaveis.add(p)}
          descricao="O nome do PACIENTE continua no campo de nome do card."
        />
      )}

      {categoria === 'consultor' && (
        <PessoaField
          label="Consultor que está falando"
          itens={consultores.items}
          value={value.consultor_id}
          onChange={(id) => onChange({ consultor_id: id })}
          onCriar={(p) => consultores.add(p)}
          descricao="Quem fez ESTE contato. Se o paciente foi encaminhado por um consultor, isso é a origem da conversa — campo separado, mais abaixo."
        />
      )}
    </div>
  )
}
