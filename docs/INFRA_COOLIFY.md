# Pulso — Guia de Infraestrutura com Coolify

## Visão geral da infra

```
VPS (Coolify)
├── Chatwoot (Docker Compose)
│   ├── chatwoot-web
│   ├── chatwoot-worker
│   ├── chatwoot-postgres
│   └── chatwoot-redis
├── Pulso Dashboard (Next.js via Git deploy)
│   └── standalone Node.js server
└── Coolify (orquestrador)

Supabase Cloud (externo)
├── PostgreSQL (banco do dashboard)
├── Auth (autenticação)
└── Realtime (websockets)
```

---

## Pré-requisitos da VPS

| Recurso | Mínimo | Recomendado |
|---------|--------|-------------|
| CPU | 2 vCPUs | 4 vCPUs |
| RAM | 4 GB | 8 GB |
| Disco | 40 GB SSD | 80 GB SSD |
| OS | Ubuntu 22.04+ | Ubuntu 24.04 LTS |
| Rede | IP público fixo | IP público fixo |

---

## 1. Instalação do Coolify

Se o Coolify ainda não estiver instalado:

```bash
curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash
```

Após a instalação, acessar `http://<IP_DA_VPS>:8000` para configurar a conta admin.

---

## 2. Informações necessárias para provisionar via API

Para eu configurar tudo automaticamente via API do Coolify, vou precisar de:

### Obrigatório
- **Coolify API URL**: geralmente `http://<IP_DA_VPS>:8000/api/v1`
- **API Token**: gerar em Coolify → Settings → API Tokens → "Create new token"
- **Server UUID**: o ID do servidor no Coolify (visível em Servers → seu server)

### Para os domínios (DNS)
- **Domínio do Chatwoot**: ex: `chat.hospitalsantamonica.com.br`
- **Domínio do Pulso**: ex: `pulso.hospitalsantamonica.com.br`
- Ambos precisam de registro DNS tipo A apontando pro IP da VPS

### Para o Supabase
- **Supabase Project URL**: ex: `https://xxxxx.supabase.co`
- **Supabase Anon Key**: chave pública
- **Supabase Service Role Key**: chave privada (só backend)

---

## 3. O que vou provisionar via API

### 3.1 — Chatwoot (Docker Compose)

Vou criar um serviço Docker Compose no Coolify com:
- Imagem oficial `chatwoot/chatwoot:latest`
- PostgreSQL 15 dedicado
- Redis 7 dedicado
- Variáveis de ambiente configuradas
- SSL automático via Let's Encrypt
- Webhook URL apontando pro Pulso

### 3.2 — Pulso Dashboard (Git Deploy)

Vou criar uma aplicação com:
- Source: repositório Git (GitHub)
- Build: `npm run build`
- Runtime: Node.js 20
- Port: 3000
- SSL automático
- Variáveis de ambiente (Supabase + Chatwoot)

---

## 4. Endpoints da API do Coolify que vou usar

```
POST /api/v1/applications     → criar aplicação Next.js
POST /api/v1/services         → criar serviço Chatwoot (Docker Compose)
GET  /api/v1/servers           → listar servidores
GET  /api/v1/projects          → listar projetos
POST /api/v1/projects          → criar projeto "HSM"
POST /api/v1/deploy            → disparar deploy
GET  /api/v1/applications/{uuid}/envs → ver variáveis
POST /api/v1/applications/{uuid}/envs → configurar variáveis
```

---

## 5. Docker Compose do Chatwoot (será enviado via API)

```yaml
version: '3.8'

services:
  chatwoot-web:
    image: chatwoot/chatwoot:latest
    depends_on:
      - chatwoot-postgres
      - chatwoot-redis
    ports:
      - "3001:3000"
    environment:
      - SECRET_KEY_BASE=${CHATWOOT_SECRET_KEY}
      - FRONTEND_URL=${CHATWOOT_DOMAIN}
      - DEFAULT_LOCALE=pt_BR
      - DATABASE_URL=postgresql://chatwoot:${CHATWOOT_DB_PASSWORD}@chatwoot-postgres:5432/chatwoot
      - REDIS_URL=redis://chatwoot-redis:6379
      - RAILS_ENV=production
      - NODE_ENV=production
      - INSTALLATION_ENV=docker
      - ENABLE_ACCOUNT_SIGNUP=false
      - MAILER_SENDER_EMAIL=noreply@hospitalsantamonica.com.br
    entrypoint: docker/entrypoints/rails.sh
    command: ['bundle', 'exec', 'rails', 's', '-p', '3000', '-b', '0.0.0.0']
    restart: unless-stopped

  chatwoot-worker:
    image: chatwoot/chatwoot:latest
    depends_on:
      - chatwoot-postgres
      - chatwoot-redis
    environment:
      - SECRET_KEY_BASE=${CHATWOOT_SECRET_KEY}
      - FRONTEND_URL=${CHATWOOT_DOMAIN}
      - DATABASE_URL=postgresql://chatwoot:${CHATWOOT_DB_PASSWORD}@chatwoot-postgres:5432/chatwoot
      - REDIS_URL=redis://chatwoot-redis:6379
      - RAILS_ENV=production
      - NODE_ENV=production
    command: ['bundle', 'exec', 'sidekiq', '-C', 'config/sidekiq.yml']
    restart: unless-stopped

  chatwoot-postgres:
    image: postgres:15
    environment:
      - POSTGRES_DB=chatwoot
      - POSTGRES_USER=chatwoot
      - POSTGRES_PASSWORD=${CHATWOOT_DB_PASSWORD}
    volumes:
      - chatwoot_pg_data:/var/lib/postgresql/data
    restart: unless-stopped

  chatwoot-redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes
    volumes:
      - chatwoot_redis_data:/data
    restart: unless-stopped

volumes:
  chatwoot_pg_data:
  chatwoot_redis_data:
```

---

## 6. Checklist antes de começar

Antes de me enviar a API key, confirme:

- [ ] VPS está rodando e acessível via SSH
- [ ] Coolify está instalado e acessível na porta 8000
- [ ] Servidor adicionado no Coolify (Settings → Servers)
- [ ] API Token gerado no Coolify
- [ ] Domínios decididos (chat.xxx e pulso.xxx)
- [ ] DNS apontando pro IP da VPS (registro A)
- [ ] Projeto criado no Supabase Cloud com as chaves em mãos

---

## 7. Formato das credenciais

Quando estiver pronto, me envie assim:

```
COOLIFY_API_URL=http://<IP>:8000/api/v1
COOLIFY_API_TOKEN=<seu-token>
COOLIFY_SERVER_UUID=<uuid-do-servidor>

CHATWOOT_DOMAIN=https://chat.hospitalsantamonica.com.br
PULSO_DOMAIN=https://pulso.hospitalsantamonica.com.br

NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxx...
SUPABASE_SERVICE_ROLE_KEY=eyJxxx...
```

Com essas informações, vou:
1. Criar o projeto "HSM" no Coolify
2. Provisionar o Chatwoot via Docker Compose
3. Configurar o Pulso Dashboard como aplicação Next.js
4. Configurar todas as variáveis de ambiente
5. Configurar SSL automático nos dois domínios
6. Disparar os deploys iniciais
