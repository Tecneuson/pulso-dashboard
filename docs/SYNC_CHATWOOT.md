# Sincronização CRM (Pulso) ⇄ Chatwoot — v2 (ago/2026)

Este documento descreve como o Pulso e o Chatwoot ficam **sempre iguais**, o que mudou nos
12 pedidos do HSM, o que precisa ser configurado (migração, webhooks, variáveis) e a
análise do **modo sem n8n**.

## 1. Princípios

| Princípio | Como está implementado |
|---|---|
| **Chatwoot é a central dos campos** | As definições de custom attributes vivem no Chatwoot. O registro canônico do CRM (`src/lib/chatwoot/attributes.ts`) garante que os campos padrão existam lá com o vocabulário certo; campos novos são espelhados na tabela `campos_personalizados` (`POST /api/campos/sync`, botão "Sincronizar" em Configurações, ou automaticamente a cada ~5 min de uso). |
| **Sempre sincronizado, nos dois sentidos** | CRM → Chatwoot: `pushTriagemParaChatwoot` (usado por `/api/triagem`, `/api/sync/triagem`, bot). Chatwoot → CRM: `/api/chatwoot/webhook` (eventos `conversation_updated`, `contact_updated`, `conversation_status_changed`, `message_created`). Só grava o que mudou (anti-eco). |
| **Um lugar para cada tradução** | `src/lib/chatwoot/mapping.ts` traduz slug ⇄ rótulo. Rótulos de UI vêm de `src/types` (`TIPO_CONTATO_LABELS`, `ASSUNTO_LABELS`, `MOTIVO_CONTATO_LABELS`, `MOTIVO_PERDA_LABELS`) e `PLANO_LABELS` — acabaram as 4 cópias parciais que existiam nas telas. |

## 2. O que mudou (mapa pedido → implementação)

| # | Pedido | Onde |
|---|---|---|
| 1 | Campos personalizados sempre sincronizados | `attributes.ts` (registro) + `campos.ts` (sync de definições) + `sync.ts` / `webhook-handlers.ts` (valores) |
| 2 | Chatwoot como central | definições importadas do Chatwoot para `campos_personalizados`; auditoria em `GET /api/chatwoot/auditoria` |
| 3 | Campos duplicados/redundantes | auditoria aponta legados (`motivo_do_contato`, `observacoes`, `dados_carteirinha`…), chaves duplicadas nos dois modelos, chaves parecidas e listas divergentes. No código: labels centralizados; `captadores` × `consultores` continua (já documentado em `cadastros.tsx`). **Bug encontrado**: o antigo `ensureObservacoesDefinition` criava o atributo como tipo `6`, que no Chatwoot é `list`, não `text` (removido). |
| 4 | Data de nascimento | já existia; agora está no formulário de novo contato, na definição garantida no Chatwoot (`data_de_nascimento`, tipo date) e na migration (idempotente) |
| 5 | Kids automático (8–17) | `src/lib/idade.ts`; coluna `triagem_hsm.kids` + **trigger** no banco (vale para n8n/SQL); atributo `kids` (checkbox) no contato do Chatwoot; badge no card; filtro "Faixa etária" |
| 6 | Triagem sem "remoção / outros assuntos / falar com atendente" | prompt v16 (`automacoes/prompt-monica-v16.md`) aplicado em `Chatwoot Moniquinha — HSM (v16).json` e no bot interno (`src/lib/bot/prompt-monica.json`) |
| 7 | Categorias Paciente / Responsável / Consultor | O campo gravado é o **perfil** (5 valores da lista `quem_e_o_contato` / BI "PERFIL": Lead, Ex-paciente, Responsável, Médico, Consultor — "Parceiro" virou Consultor). As 3 categorias são derivadas (`categoriaDoTipo`): Lead+Ex-paciente → Paciente, Responsável → Responsável, Médico+Consultor → Consultor. CHECK + migração de valores no banco, bot v16 (ETAPA 5). |
| 8 | Novo contato no CRM com todos os campos no Chatwoot | `LeadForm` tem todos os campos (core + personalizados); `POST /api/triagem` cria/acha o **contato** no Chatwoot (por telefone/e-mail) e grava `chatwoot_contact_id` |
| 9 | Botão para a conversa no Chatwoot | card do funil e detalhe do lead (`chatwootLinkDoLead`): conversa quando existe, senão a ficha do contato |
| 10 | Sem "observações"; notas ⇄ histórico | campo removido do card/formulário; `POST /api/anotacoes` → nota privada na conversa; webhook `message_created` (privada) → `anotacoes` com `origem`/`autor_nome`; observações do bot aparecem como evento do histórico |
| 11 | Venda / motivo de perda no Chatwoot ⇄ CRM | `venda = Sim` → Internação; `motivo_de_perda` → Perdido (+motivo). CRM → Chatwoot já existia (`venda` derivado, `motivo_de_perda`) |
| BI | Relatórios (visão do cliente) | `/reports`: big numbers (contatos, conversas, internações, perdas), motivos de perda (30 oficiais), origens, forma de internação por plano (com motivos), pipeline com churn, perfil, status das conversas (Chatwoot ao vivo + por período), filtros de período e atendente (`src/lib/bi.ts`) |
| BI | Motivos de perda oficiais | 30 valores do CSV (`MOTIVO_PERDA` em `src/types`), migração dos slugs antigos, lista exata no Chatwoot, `Snake to Label` do n8n v16; encerramento automático usa "Falta de Interação" |
| BI | Consultores | lista única `consultores` (populada em produção a partir do Chatwoot; seed do CSV removido da migration para não duplicar grafias), `consultor_id` em leads e pacientes (backfill por nome a partir de `captadores`, que vira legado) |
| 12 | Não encerra sem venda/motivo | `conversation_status_changed` → `resolved` sem desfecho ⇒ reabre + nota privada explicando (máx. 3 vezes por conversa). Encerramento automático por inatividade marca "Parou de interagir" antes (n8n v2 e cron do app). Reabrir depois disso devolve o lead para "Atendendo". |

## 3. O que você precisa fazer (uma vez)

1. **Migrations**: rodar no SQL Editor, nesta ordem, `supabase/migrations/20260823000000_sync_chatwoot_v2.sql` (schema, vocabulários, consultores do CSV, RLS) e `20260823000001_seed_hospitais_chatwoot.sql` (258 hospitais importados da lista `hospital_origem` do Chatwoot). Ambas idempotentes.
2. **Variáveis** (ver `.env.local.example`): `CHATWOOT_WEBHOOK_SECRET` (obrigatório em produção), `NEXT_PUBLIC_CHATWOOT_ACCOUNT_ID`, `SYNC_WEBHOOK_SECRET`, `CRON_SECRET`, `N8N_ATIVO`.
3. **Webhook do Chatwoot** (Configurações → Integrações → Webhooks): URL `https://SEU_DOMINIO/api/chatwoot/webhook?secret=<CHATWOOT_WEBHOOK_SECRET>` com os eventos `conversation_created`, `conversation_updated`, `conversation_status_changed`, `contact_updated`, `message_created`.
4. **Sincronizar definições**: Configurações → Campos personalizados → "Sincronizar com o Chatwoot". Atenção ao que isso muda nas listas do Chatwoot (conferido ao vivo em 23/08):
   - `quem_e_o_contato`: hoje tem **Paciente | Responsável | Consultor**; passa a ter os 5 perfis do BI (**Lead | Ex-paciente | Responsável | Médico | Consultor**). Valores antigos continuam legíveis (Paciente → Lead). Se preferir manter 3, tire `quem_e_o_contato` de `LISTAS_EXATAS` em `campos.ts` e troque as opções em `attributes.ts`.
   - `motivo_de_perda`: a lista intermediária (21 itens, ex.: "Carência", "Alta na origem", "Colaborador do hospital") vira a lista oficial de 30 do CSV; os rótulos antigos seguem sendo traduzidos (`mapping.ts`).
   - `consultor_origem`: as opções passam a ser a tabela `consultores` do CRM (lista única). Em 24/08 a tabela foi populada em produção com as grafias do Chatwoot ("Catia", "Jeferson", "Karem"…), então o seed do CSV foi REMOVIDO da migration (evita quase-duplicatas tipo "Cátia"/"Catia"). O CSV do cliente diverge da lista oficial em ~8 grafias — se quiserem padronizar, renomear direto em Configurações → Consultores.
   - `hospital_origem` não é alterado (o CRM importa os hospitais de lá, e não o contrário).
   - `numero-carteirinha` e `nome_do_responsavel` (já existem no Chatwoot) viram campos personalizados no card automaticamente.
   Depois, "Auditar atributos" mostra o que sobrou (`outras_origem`/`conversa_outras_origem` são legados).
5. **Backfill** (opcional, recomendado): `npx tsx scripts/backfill-chatwoot.ts --dry` e depois sem `--dry` — reenvia categoria/kids/data etc. dos leads existentes para o Chatwoot.
6. **n8n**: importar `Chatwoot Moniquinha — HSM (v16).json` (ativar) e desativar o v15; importar `HSM — Automacoes (encerrar + roleta) v2.json` e desativar o v1 — **sem o v2, o encerramento automático briga com a regra 12** (fecha → app reabre).
7. **Agente de atendimento no card**: preencher `usuarios.chatwoot_agent_id` com o id de cada agente no Chatwoot (ids atuais: Angela 6, Kaylane 7, Larissa 8, Natali 9; admins: Arthur 1, Rafael 4, Marcelo 5, Raquel 10); a atribuição da conversa passa a refletir no lead e no filtro "Atendente" do BI.

## 4. Eventos e fluxos

```
Chatwoot ──webhook──▶ /api/chatwoot/webhook ──▶ triagem_hsm (só se mudou)
   ▲                         │
   │                         ├─ conversation_status_changed: regra 12 (reabre) / reativa lead
   │                         └─ message_created (privada): anotacoes
   │
CRM (card/form) ──▶ /api/triagem ──▶ triagem_hsm ──▶ pushTriagemParaChatwoot ──▶ Chatwoot
                                        │
                     (Database Webhook) └──▶ /api/sync/triagem ──▶ Chatwoot   ← substitui n8n "agente-humano"
```

Anti-loop: o webhook compara com o banco e só grava diferenças; o push CRM → Chatwoot só manda os campos do patch; o Database Webhook só manda `record` ≠ `old_record`.

## 5. Modo sem n8n — análise

O n8n faz hoje 5 coisas. Todas têm equivalente no app, ligadas por `N8N_ATIVO=0`:

| n8n | No app | Status |
|---|---|---|
| Bot Mônica (IA, tools, memória Postgres, RAG, visão da carteirinha) | `src/lib/bot/monica.ts` (`BOT_ENABLED=1` + `OPENAI_API_KEY`), disparado por `message_created`. Memória = mensagens da própria conversa (API do Chatwoot). RAG usa a mesma função `match_documents`. | **implementado, não testado em produção** — ligar em homologação primeiro |
| Sync banco → Chatwoot (`/agente-humano`) + pausa do bot + resumo | `/api/sync/triagem` (Database Webhook do Supabase) | implementado |
| Criar lead no 1º contato + roleta na chegada + pausar bot quando humano responde | `message_created` no webhook (`onMessageCreated`) | implementado |
| Encerrar inativas + roleta a cada 5 min | `/api/cron/automacoes` (`CRON_SECRET`). Agendar com pg_cron + pg_net no Supabase: | implementado |
| `/chatwoot` (resolved → transbordado=false) | `onStatusChanged` | implementado (e corrige o bug do v15, que filtrava pelo id do contato) |

Agendamento no Supabase (SQL Editor):

```sql
create extension if not exists pg_cron; create extension if not exists pg_net;
select cron.schedule('pulso-automacoes', '*/5 * * * *', $$
  select net.http_post('https://SEU_DOMINIO/api/cron/automacoes',
    headers := '{"Authorization": "Bearer SEU_CRON_SECRET"}'::jsonb, body := '{}'::jsonb);
$$);
```

**Recomendação de migração**: (1) rodar a migration e o v16/v2 no n8n; (2) apontar o Database Webhook para `/api/sync/triagem` e desligar o fluxo "agente-humano" do n8n; (3) ligar `N8N_ATIVO=0` + cron, mantendo o bot no n8n **ou** ligando `BOT_ENABLED=1` após testar. Custo/risco: o bot é a única peça com LLM; o resto é determinístico e já está coberto.

Limitações conhecidas: o webhook do Chatwoot tem timeout curto (~5 s) — o bot interno responde depois desse tempo (a requisição continua no servidor), o que é aceitável em VPS/Coolify, mas em serverless pode ser cortado. Chatwoot não emite webhook para *notas do contato* (só mensagens privadas da conversa) nem para mudanças nas *definições* de atributos (por isso o sync periódico/botão).
