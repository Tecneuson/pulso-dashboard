'use client'

import { createContext, useContext, type ReactNode } from 'react'

/**
 * Papel de quem está logado, disponível para qualquer componente do painel.
 * Só serve para esconder botões na UI: quem garante a regra são as rotas de API
 * (`requireUserApi({ gestor: true })`).
 *
 * Admin (gestor) faz tudo. Agente de atendimento vê todas as telas e trabalha os
 * cards, mas não cadastra, não edita nem apaga cadastros, e não exporta/importa.
 */
const PapelContext = createContext<{ admin: boolean }>({ admin: false })

export function PapelProvider({ admin, children }: { admin: boolean; children: ReactNode }) {
  return <PapelContext.Provider value={{ admin }}>{children}</PapelContext.Provider>
}

export function useEhAdmin(): boolean {
  return useContext(PapelContext).admin
}
