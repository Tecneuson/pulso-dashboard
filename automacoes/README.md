# Automações (n8n) e migrações

Workflows do n8n e scripts SQL que fazem o CRM (Pulso), o Chatwoot e o bot (Mônica)
conversarem entre si. Versionados aqui porque o n8n não tem histórico próprio.

## Workflows

| Arquivo | O que é |
|---|---|
| `Chatwoot Moniquinha — HSM (v15).json` | **VERSÃO EM PRODUÇÃO.** Bot de triagem + sync com o CRM. |
| `Chatwoot Moniquinha — HSM (v11..v14).json` | Histórico das correções (ver abaixo). |
| `HSM — Automacoes (encerrar + roleta).json` | Agendado (5 min): encerra conversas por inatividade e distribui as sem atendente. |
| `Chatwoot MCP Server — HSM (v10).json` | Versão anterior do bot, antes da reescrita. |

### Evolução das correções
- **v11** — pausa do bot quando um atendente humano responde; roleta na chegada.
- **v12** — pausa após a triagem terminar; nota com o resumo; repasse de data de nascimento/elegível.
- **v13** — nota e pausa disparam só na TRANSIÇÃO (`old_record` vs `record`), matando o loop de eco que spammava notas.
- **v14** — atualização de atributos da conversa passa a MESCLAR (o endpoint do Chatwoot substitui o objeto inteiro e apagava `bot_pausado`/`assunto_da_conversa`).
- **v15** — mapa de `motivo_contato` atualizado para TM/TUS; `toLabel` nunca manda slug cru para campos de lista.

## Regras de inatividade (encerramento automático)
Contato 10 min · Atendendo 30 min · Negociando 30 min · **Rastreio nunca fecha**.

## SQL
- `hsm-ajustes-apresentacao.sql` — coluna `elegivel` em `triagem_hsm`.
- `crm-lead-1o-contato.sql` — `UNIQUE (conversation_id)`, necessário para o lead ser criado no primeiro contato sem duplicar.

## Ao importar no n8n
1. Import from File.
2. **Reconectar as credenciais** (o export não traz os segredos): OpenAI, Supabase, Postgres e os dois headers do Chatwoot — `Header Auth admin` (token de administrador, usado para atributos/atribuição/notas) e `Header Auth account` (token do bot, usado só para enviar mensagem).
3. Ativar o novo e desativar o antigo.

## Cuidado conhecido
O endpoint de `custom_attributes` do Chatwoot **substitui** o objeto inteiro — sempre mesclar com os atributos atuais antes de gravar.
