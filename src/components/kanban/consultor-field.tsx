'use client'

import { useConsultores } from '@/lib/api-store'
import { PessoaField } from './pessoa-field'

/**
 * Campo de Consultor isolado (usado no detalhe do paciente, onde não há categoria
 * de contato). No card do lead o consultor vem de `CategoriaContatoField`.
 * Lista única `consultores` (coluna `consultor_id`); `captadores` é legado.
 */
export function ConsultorField({
  value,
  onChange,
  label = 'Consultor',
}: {
  value: string | null
  onChange: (id: string | null) => void
  label?: string
}) {
  const consultores = useConsultores()
  return (
    <PessoaField
      label={label}
      itens={consultores.items}
      value={value}
      onChange={onChange}
      onCriar={(p) => consultores.add(p)}
      descricao="O mesmo consultor pode estar vinculado a vários pacientes."
    />
  )
}
