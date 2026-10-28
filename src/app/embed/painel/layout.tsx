import { AbasPainel } from '@/components/embed/abas-painel'

/** Dashboard App "Painel" no Chatwoot: Dashboard + Relatórios do CRM. */
export default function PainelLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AbasPainel />
      {children}
    </>
  )
}
