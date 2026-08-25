# Automações (n8n) e migrações

Workflows do n8n e scripts SQL que fazem o CRM (Pulso), o Chatwoot e o bot (Mônica)
conversarem entre si. Versionados aqui porque o n8n não tem histórico próprio.

## Workflows

| Arquivo | O que é |
|---|---|
| `Chatwoot Moniquinha — HSM (v16).json` | **VERSÃO A ATIVAR.** Prompt v16 (sem "outros assuntos/remoção/falar com atendente" no menu; categorias Paciente/Responsável/Consultor) + correção do webhook `/chatwoot`. Gerado a partir do v15 + `prompt-monica-v16.md`. |
| `prompt-monica-v16.md` | Fonte única do prompt da Mônica (o mesmo texto vai para `src/lib/bot/prompt-monica.json`, usado pelo bot interno do app). |
| `Chatwoot Moniquinha — HSM (v15).json` | Versão em produção até a troca. |
| `Chatwoot Moniquinha — HSM (v11..v14).json` | Histórico das correções (ver abaixo). |
| `HSM — Automacoes (encerrar + roleta) v2.json` | **VERSÃO A ATIVAR.** Igual à v1, mas marca `motivo_de_perda = Falta de Interação` + `venda = Não` ANTES de encerrar — exigência da regra "não encerra sem desfecho" do Pulso. |
| `HSM — Automacoes (encerrar + roleta).json` | v1 (desativar ao ativar a v2). |
| `Chatwoot MCP Server — HSM (v10).json` | Versão anterior do bot, antes da reescrita. |

### Evolução das correções
- **v11** — pausa do bot quando um atendente humano responde; roleta na chegada.
- **v12** — pausa após a triagem terminar; nota com o resumo; repasse de data de nascimento/elegível.
- **v13** — nota e pausa disparam só na TRANSIÇÃO (`old_record` vs `record`), matando o loop de eco que spammava notas.
- **v14** — atualização de atributos da conversa passa a MESCLAR (o endpoint do Chatwoot substitui o objeto inteiro e apagava `bot_pausado`/`assunto_da_conversa`).
- **v15** — mapa de `motivo_contato` atualizado para TM/TUS; `toLabel` nunca manda slug cru para campos de lista.
- **v16** — prompt v16 (menu enxuto, transbordo só ao fim, perfis Lead/Ex-paciente/Responsável/Médico/Consultor); `Snake to Label` com os 30 motivos de perda oficiais; `salvar_triagem` aceita `paciente|responsavel|consultor`; `Snake to Label` traduz as categorias novas (e as antigas, por segurança); o webhook `/chatwoot` passa a filtrar pela conversa (`body.id`) — no v15 usava o id do contato e não achava a linha.

## Quando o bot volta a atender (novo ciclo)
O Chatwoot **reabre a mesma conversa** quando o paciente escreve depois de encerrada — mesmo id,
mesmos `custom_attributes`. Por isso existem DUAS travas e as duas precisam ser abertas:

| Trava | Onde | Quem abre |
|---|---|---|
| `bot_pausado` | atributo da conversa (Chatwoot) | nó `Reativar bot (novo ciclo)` no fluxo `/chatwoot` |
| `transbordado` / `triagem_concluida` | `triagem_hsm` (Supabase) | nó `Update a row2` (mesmo fluxo) |

Abrir só a primeira faz o bot responder **uma vez** e se pausar de novo no check
`Triagem finalizada?`. Abrir só a segunda não adianta: ele nem passa do `Bot pausado?`.

**Condição:** a reativação só acontece quando a conversa é encerrada **com desfecho**
(`venda = Sim` ou `motivo_de_perda` preenchido). Sem desfecho o Pulso reabre a conversa
(regra 12) e o atendente continua — por isso o bot segue pausado, de propósito. Isso também
evita disputa entre o n8n e o app: as duas condições são mutuamente exclusivas.
Para reativar em QUALQUER encerramento, troque a condição do nó `Encerrou com desfecho?` por `true`.

## Regras de inatividade (encerramento automático)
Contato 10 min · Atendendo 30 min · Negociando 30 min · **Rastreio nunca fecha**.

## SQL
- `hsm-ajustes-apresentacao.sql` — coluna `elegivel` em `triagem_hsm`.
- `crm-lead-1o-contato.sql` — `UNIQUE (conversation_id)`, necessário para o lead ser criado no primeiro contato sem duplicar.
- A migração consolidada (ago/2026) está em `supabase/migrations/20260823000000_sync_chatwoot_v2.sql` (inclui as duas acima, idempotente).

## O n8n ainda é necessário?
Não obrigatoriamente — ver `docs/SYNC_CHATWOOT.md` §5. Com `N8N_ATIVO=0` o app assume 1º contato, roleta, pausa do bot, encerramento por inatividade e o sync banco → Chatwoot; o bot Mônica tem uma implementação interna (`BOT_ENABLED=1`) que ainda precisa ser homologada.

## Ao importar no n8n
1. Import from File.
2. **Reconectar as credenciais** (o export não traz os segredos): OpenAI, Supabase, Postgres e os dois headers do Chatwoot.

   **Regra das credenciais HTTP (v16 em diante):** *todo* nó HTTP usa `Header Auth admin` (token de administrador: atributos, atribuição, notas privadas, encerrar conversa, baixar anexo) — **a única exceção é `HTTP Request6`**, que envia a mensagem visível ao paciente e usa `Header Auth account` (token do bot, para a mensagem sair como a Mônica). Cada nó tem exatamente UMA credencial: as credenciais `Chatwoot` (basic) e `Bearer Auth account` que sobravam no `HTTP Request6` foram removidas no v16 — não eram usadas (o nó já autenticava por header) e só confundiam.
3. Ativar o novo e desativar o antigo.

## Cuidado conhecido
O endpoint de `custom_attributes` do Chatwoot **substitui** o objeto inteiro — sempre mesclar com os atributos atuais antes de gravar.
