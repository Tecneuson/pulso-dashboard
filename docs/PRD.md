# Pulso — Product Requirements Document (PRD)

## Visão geral

**Pulso** é um dashboard de atendimento hospitalar integrado ao Chatwoot, desenvolvido para o Hospital Santa Mônica (HSM). O sistema monitora em tempo real o fluxo de pacientes — desde o primeiro contato até a internação — oferecendo visão Kanban do funil de atendimento, métricas de conversão e relatórios operacionais.

---

## Contexto

O Hospital Santa Mônica é referência em saúde mental em São Paulo (fundado em 1969, ONA 3 Ouro), especializado em transtornos mentais adultos, infantojuvenis e dependência química. O hospital recebe contatos via WhatsApp, telefone e formulários web, gerenciados pelo Chatwoot. Atualmente falta visibilidade centralizada do funil, métricas de performance e gestão visual dos atendimentos.

---

## Stack técnica

| Camada | Tecnologia | Hospedagem |
|--------|-----------|------------|
| Frontend | Next.js 14+ (App Router), TypeScript, Tailwind CSS | VPS via Coolify |
| Backend | Next.js API Routes + Supabase Edge Functions | VPS + Supabase Cloud |
| Banco de dados | PostgreSQL (Supabase Cloud) | Supabase Cloud |
| Autenticação | Supabase Auth (email + magic link) | Supabase Cloud |
| Atendimento | Chatwoot (self-hosted) | VPS via Coolify |
| Orquestração | Coolify | VPS |
| Domínio | Subdomínio do HSM (ex: pulso.hospitalsantamonica.com.br) | Cloudflare/DNS |

---

## Usuários

| Papel | Permissões | Exemplos |
|-------|-----------|----------|
| Admin | Tudo — gerenciar usuários, configurações, CRUD completo | Gestor de TI, Direção |
| Manager | Visualizar tudo, mover cards no Kanban, editar contatos/conversas | Coordenador de atendimento |
| Agent | Visualizar métricas, mover cards atribuídos a ele | Atendente do Chatwoot |
| Viewer | Somente leitura em métricas e relatórios | Diretoria clínica |

---

## Funcionalidades — MVP (v1.0)

### F1 — Kanban de atendimento

**O quê:** Board visual com colunas representando os estágios do funil de atendimento.

**Colunas (estágios do funil):**
1. Novo contato
2. Atendendo
3. Consultando convênio
4. Autorizado pelo convênio
5. Paciente a caminho
6. Hospital recepção
7. Recusou internação (terminal)
8. Internação confirmada (terminal)

**Comportamento:**
- Cards representam contatos, exibindo: nome, tipo de contato, motivo, plano de saúde, tempo no estágio atual
- Drag-and-drop entre colunas (registra automaticamente no funnel_history)
- Filtros por: plano de saúde, motivo do contato, agente responsável, período
- Badge de "urgente" e "aguardando vaga" via tags
- Indicador visual de tempo no estágio (verde < 2h, amarelo 2-6h, vermelho > 6h)
- Click no card abre detalhes completos + link direto pra conversa no Chatwoot

### F2 — Dashboard de métricas

**O quê:** Painel com KPIs e gráficos do atendimento hospitalar.

**Métricas principais (cards no topo):**
- Total de contatos (hoje / semana / mês)
- Taxa de conversão (contato → internação confirmada)
- Tempo médio no funil (primeiro contato → desfecho)
- Motivo de perda mais frequente
- Contatos aguardando (em estágios ativos)

**Gráficos:**
- Volume de contatos por dia (linha, últimos 30 dias)
- Distribuição por motivo de contato (donut: adulto / infantojuvenil / substâncias)
- Conversão por plano de saúde (barras horizontais, top 10)
- Motivos de perda (barras, ranking)
- Performance por canal de origem (UTM source)
- Tempo médio por estágio do funil (barras empilhadas)

### F3 — Detalhes do contato

**O quê:** Página/drawer com informações completas do contato.

**Dados exibidos:**
- Dados pessoais (nome, telefone, WhatsApp, email)
- Classificação (tipo, motivo, para quem é a solicitação)
- Plano de saúde
- Estágio atual no funil + histórico de mudanças com timestamps
- UTMs de origem
- Lista de conversas vinculadas (com status de venda e motivo de perda)
- Link direto para o contato no Chatwoot
- Notas internas

### F4 — Integração Chatwoot → Supabase

**O quê:** Pipeline de dados via webhooks do Chatwoot.

**Fluxo:**
1. Chatwoot dispara webhook (conversation_created, conversation_updated, contact_created, etc.)
2. Next.js API Route `/api/webhooks/chatwoot` recebe o payload
3. Valida payload com Zod, registra em webhook_logs
4. Processa e faz upsert em contacts / conversations no Supabase
5. Mapeia custom_attributes do Chatwoot para os campos do schema

**Eventos processados:**
- `conversation_created` → cria/atualiza conversa
- `conversation_updated` → atualiza status, tags
- `conversation_status_changed` → atualiza status
- `contact_created` → cria contato
- `contact_updated` → atualiza contato
- `message_created` → atualiza first_reply_at (se for primeira resposta do agente)

### F5 — Autenticação e controle de acesso

**O quê:** Login seguro com controle de papéis.

**Implementação:**
- Supabase Auth com magic link (email)
- Middleware protegendo todas as rotas `/dashboard/*`
- RLS no banco filtrando por papel do usuário
- Página de gerenciamento de usuários (somente admin)

---

## Funcionalidades — Futuro (v2.0+)

- Relatórios exportáveis (PDF/Excel)
- Alertas automáticos (Slack/WhatsApp) quando contato fica > 6h sem movimentação
- Painel de performance por agente
- Integração com calendário (agendamento de consultas)
- Dashboard mobile (PWA)
- Previsão de demanda com base em histórico

---

## Estrutura de pastas do projeto

```
pulso/
├── src/
│   ├── app/
│   │   ├── (auth)/
│   │   │   ├── login/page.tsx
│   │   │   └── layout.tsx
│   │   ├── (dashboard)/
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx                    # Dashboard de métricas
│   │   │   ├── kanban/page.tsx             # Kanban board
│   │   │   ├── contacts/
│   │   │   │   ├── page.tsx                # Lista de contatos
│   │   │   │   └── [id]/page.tsx           # Detalhe do contato
│   │   │   ├── conversations/page.tsx      # Lista de conversas
│   │   │   ├── reports/page.tsx            # Relatórios
│   │   │   └── settings/
│   │   │       ├── page.tsx                # Config geral
│   │   │       └── users/page.tsx          # Gerenciamento de usuários
│   │   ├── api/
│   │   │   ├── webhooks/
│   │   │   │   └── chatwoot/route.ts       # Webhook receiver
│   │   │   ├── contacts/route.ts
│   │   │   ├── conversations/route.ts
│   │   │   ├── metrics/route.ts
│   │   │   └── health/route.ts
│   │   ├── layout.tsx
│   │   └── page.tsx                        # Redirect → login ou dashboard
│   ├── components/
│   │   ├── ui/                             # Design system components
│   │   │   ├── button.tsx
│   │   │   ├── card.tsx
│   │   │   ├── badge.tsx
│   │   │   ├── input.tsx
│   │   │   ├── select.tsx
│   │   │   ├── modal.tsx
│   │   │   ├── dropdown.tsx
│   │   │   ├── skeleton.tsx
│   │   │   ├── tooltip.tsx
│   │   │   └── avatar.tsx
│   │   ├── kanban/
│   │   │   ├── board.tsx
│   │   │   ├── column.tsx
│   │   │   ├── card.tsx
│   │   │   └── card-detail.tsx
│   │   ├── metrics/
│   │   │   ├── kpi-card.tsx
│   │   │   ├── line-chart.tsx
│   │   │   ├── donut-chart.tsx
│   │   │   ├── bar-chart.tsx
│   │   │   └── funnel-chart.tsx
│   │   ├── contacts/
│   │   │   ├── contact-list.tsx
│   │   │   ├── contact-detail.tsx
│   │   │   └── contact-form.tsx
│   │   └── layout/
│   │       ├── sidebar.tsx
│   │       ├── header.tsx
│   │       ├── nav-item.tsx
│   │       └── user-menu.tsx
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts
│   │   │   ├── server.ts
│   │   │   └── admin.ts
│   │   ├── chatwoot/
│   │   │   ├── api.ts                      # Chatwoot REST API client
│   │   │   ├── webhook-parser.ts           # Parser de payloads
│   │   │   └── field-mapper.ts             # Mapeia custom_attributes → schema
│   │   ├── validators/
│   │   │   ├── contact.ts
│   │   │   ├── conversation.ts
│   │   │   └── webhook.ts
│   │   └── utils.ts
│   ├── hooks/
│   │   ├── use-contacts.ts
│   │   ├── use-conversations.ts
│   │   ├── use-metrics.ts
│   │   └── use-kanban.ts
│   ├── types/
│   │   ├── database.types.ts               # Gerado pelo Supabase CLI
│   │   ├── chatwoot.ts
│   │   └── index.ts
│   └── middleware.ts
├── supabase/
│   └── migrations/
│       └── 001_initial_schema.sql
├── public/
│   └── logo.svg
├── .env.local.example
├── tailwind.config.ts
├── next.config.ts
├── tsconfig.json
├── package.json
└── README.md
```

---

## Variáveis de ambiente

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Chatwoot
CHATWOOT_BASE_URL=
CHATWOOT_API_TOKEN=
CHATWOOT_WEBHOOK_SECRET=

# App
NEXT_PUBLIC_APP_URL=
NODE_ENV=production
```

---

## Critérios de sucesso (MVP)

1. Kanban funcional com drag-and-drop e atualização em tempo real
2. Métricas atualizadas com defasagem máxima de 5 minutos
3. Webhooks do Chatwoot processados com taxa de sucesso > 99%
4. Tempo de carregamento do dashboard < 2 segundos
5. Zero dados de paciente expostos sem autenticação (RLS + middleware)
