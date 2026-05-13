import { Database, MessageSquare, Workflow, ExternalLink, Hospital } from 'lucide-react'
import { Header } from '@/components/layout/header'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui'

interface IntegrationProps {
  icon: React.ReactNode
  title: string
  status: 'online' | 'configurado' | 'pendente'
  description: string
  url?: string
}

function Integration({ icon, title, status, description, url }: IntegrationProps) {
  const statusStyles = {
    online: 'bg-success-500/10 text-success-700 border-success-500/30',
    configurado: 'bg-info-500/10 text-info-700 border-info-500/30',
    pendente: 'bg-warning-500/10 text-warning-700 border-warning-500/30',
  }
  const statusLabels = {
    online: 'Online',
    configurado: 'Configurado',
    pendente: 'Pendente',
  }

  return (
    <div className="flex items-start gap-4 p-4 bg-surface-secondary border border-border rounded-lg">
      <div className="w-10 h-10 rounded-lg bg-brand-500/10 flex items-center justify-center shrink-0 text-brand-500">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <h3 className="text-sm font-medium text-content-primary">{title}</h3>
          <span
            className={`text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded border ${statusStyles[status]}`}
          >
            {statusLabels[status]}
          </span>
        </div>
        <p className="text-xs text-content-secondary mb-2">{description}</p>
        {url && (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[11px] text-brand-500 hover:text-brand-400 transition-colors"
          >
            Abrir
            <ExternalLink size={10} />
          </a>
        )}
      </div>
    </div>
  )
}

export default function SettingsPage() {
  const chatwootUrl = process.env.NEXT_PUBLIC_CHATWOOT_BASE_URL
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL

  return (
    <>
      <Header title="Configurações" subtitle="Sistema e integrações" />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <Card>
          <CardHeader>
            <CardTitle>Integrações</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <Integration
                icon={<Database size={18} />}
                title="Supabase"
                status="online"
                description="Banco de dados PostgreSQL (tabela triagem_hsm)"
                url={supabaseUrl}
              />
              <Integration
                icon={<MessageSquare size={18} />}
                title="Chatwoot"
                status={chatwootUrl ? 'online' : 'pendente'}
                description="Plataforma de atendimento ao cliente"
                url={chatwootUrl}
              />
              <Integration
                icon={<Workflow size={18} />}
                title="N8N — Agente IA"
                status="online"
                description="Agente virtual de triagem (GPT-4.1-mini)"
                url="https://hospitalsantamonica.app.n8n.cloud"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Sobre o Pulso</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-start gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-brand-500 flex items-center justify-center shrink-0">
                <Hospital size={22} className="text-white" />
              </div>
              <div>
                <h3 className="font-display text-base font-medium text-content-primary">
                  Hospital Santa Mônica
                </h3>
                <p className="text-xs text-content-secondary mt-0.5">
                  Referência em saúde mental desde 1969 — ONA 3 Ouro
                </p>
              </div>
            </div>

            <dl className="space-y-2 text-sm">
              <div className="flex justify-between border-t border-border pt-2">
                <dt className="text-content-tertiary">Versão</dt>
                <dd className="text-content-primary font-mono text-xs">1.0.0</dd>
              </div>
              <div className="flex justify-between border-t border-border pt-2">
                <dt className="text-content-tertiary">Stack</dt>
                <dd className="text-content-primary text-xs">Next.js 14 + Supabase</dd>
              </div>
              <div className="flex justify-between border-t border-border pt-2">
                <dt className="text-content-tertiary">Deploy</dt>
                <dd className="text-content-primary text-xs">Coolify VPS</dd>
              </div>
              <div className="flex justify-between border-t border-border pt-2">
                <dt className="text-content-tertiary">Repositório</dt>
                <dd>
                  <a
                    href="https://github.com/Tecneuson/pulso-dashboard"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-brand-500 hover:text-brand-400 text-xs flex items-center gap-1"
                  >
                    GitHub
                    <ExternalLink size={10} />
                  </a>
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Estágios do funil</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-content-secondary mb-3">
            Os contatos passam por estes estágios no funil de atendimento, do primeiro
            contato até a internação confirmada.
          </p>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
            {[
              ['Novo contato', 'bg-neutral-500'],
              ['Atendendo', 'bg-info-500'],
              ['Consultando convênio', 'bg-warning-500'],
              ['Autorizado pelo convênio', 'bg-brand-500'],
              ['Paciente a caminho', 'bg-info-500'],
              ['Hospital recepção', 'bg-brand-400'],
              ['Internação confirmada', 'bg-success-500'],
              ['Recusou internação', 'bg-danger-500'],
            ].map(([label, color]) => (
              <div
                key={label}
                className="flex items-center gap-2 p-2 bg-surface-secondary border border-border rounded text-xs"
              >
                <span className={`w-2 h-2 rounded-full ${color}`} />
                <span className="text-content-primary">{label}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </>
  )
}
