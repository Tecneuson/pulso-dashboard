'use client'

import { useMemo } from 'react'
import { Combobox } from '@/components/ui/combobox'
import { useUsuarios } from '@/lib/api-store'

/**
 * Escolhe quem da equipe fica responsável por uma tarefa (agendamento).
 * Vazio = "Eu" na criação (a API usa o usuário logado).
 */
export function ResponsavelField({
  value,
  onChange,
  placeholder = 'Eu (quem está criando)',
  disabled,
}: {
  value: string | null
  onChange: (id: string | null) => void
  placeholder?: string
  disabled?: boolean
}) {
  const { items } = useUsuarios()
  const options = useMemo(
    () =>
      items
        // Mantém o responsável atual na lista mesmo que tenha sido desativado.
        .filter((u) => u.ativo !== false || u.id === value)
        .map((u) => ({ value: u.id, label: u.nome, hint: u.email ?? undefined })),
    [items, value]
  )
  return (
    <Combobox
      options={options}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      textoVazio={placeholder}
      disabled={disabled}
    />
  )
}
