# Revisão de segurança — Pulso (ago/2026)

Escopo: código do app (Next.js), políticas SQL versionadas, integração Chatwoot/n8n. Não foi
possível inspecionar o estado real do banco/Chatwoot (sem credenciais nesta máquina) — os
itens marcados com ⚠️ dependem de conferir em produção.

## Corrigido nesta entrega

| Sev. | Problema | Correção |
|---|---|---|
| Média (higiene) | `triagem_hsm` tinha policies `USING (true)` / `WITH CHECK (true)` sem restringir papel (`Service role full access`, `triagem_insert`, `triagem_update`) — valem também para `anon`. **Conferido ao vivo (23/08, anon key via PostgREST): `triagem_hsm`, `pacientes`, `anotacoes` e `usuarios` respondem `401 permission denied` — o role `anon` não tem GRANT nessas tabelas, então NÃO havia exposição real.** O risco era latente: bastava um `GRANT` acidental (ou o padrão do Supabase em tabela nova) para as policies abrirem tudo. | Migration `20260823` remove essas policies e recria `select/insert/update` só para `authenticated`; service_role (n8n/webhooks) bypassa RLS, nada quebra. `consultores` é legível por `anon` no GRANT, mas a policy (`auth.uid() IS NOT NULL`) devolve 0 linhas — ok. |
| Alta | Webhook do Chatwoot aceitava qualquer chamada se `CHATWOOT_WEBHOOK_SECRET` não estivesse definido (fail-open). | Em produção responde 503 até o segredo existir; comparação em tempo constante; segredo preferencialmente por header `x-webhook-secret`. |
| Média | `/api/triagem` PATCH aceitava qualquer valor em qualquer campo da lista (só o CHECK do banco segurava). | Validação com zod (`src/lib/validation.ts`) em POST/PATCH; enums, UUIDs, e-mail, tamanhos. O mesmo em `/api/anotacoes` e `/api/campos`. |
| Média | Sem cabeçalhos de segurança HTTP. | `next.config.mjs`: `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, HSTS, `poweredByHeader: false`. |
| Média | Escrita em `campos_personalizados` e ações administrativas (sync, auditoria) precisavam de papel. | `requireUserApi({ gestor: true })` → 403 para atendente. |
| Baixa | `chatwootUrl` hard-coded com `accounts/1`. | `NEXT_PUBLIC_CHATWOOT_ACCOUNT_ID`. |
| Baixa | Bug de sync no n8n v15 (`/chatwoot`): filtrava `conversation_id` pelo id do **contato**. | Corrigido no v16 e coberto pelo app. |
| Baixa | `ensureObservacoesDefinition` criava o atributo com `attribute_display_type: 6` (= `list`, não `text`). | Removido; registro canônico usa o enum correto. |

## Recomendações pendentes (para você decidir/rodar)

1. **Rodar a migration** e a query de conferência de policies (defesa em profundidade — hoje o GRANT já segura o `anon`).
2. **Rotacionar** `CHATWOOT_API_TOKEN` e `SUPABASE_SERVICE_ROLE_KEY` se em algum momento estiveram em repositório/print (os exports do n8n em `automacoes/` **não** contêm segredos — conferido; contêm o host do Chatwoot e ids de agentes, o que é aceitável).
3. O webhook do Chatwoot só permite URL (sem header customizado) — o segredo vai na query string e **aparece nos logs do proxy**. Use um segredo exclusivo para isso e rotacione periodicamente.
4. RLS de `triagem_hsm` ainda permite que **qualquer** usuário autenticado edite **qualquer** lead (modelo "equipe interna"). Se quiser restringir atendentes aos próprios leads, dá para trocar `triagem_update_auth` por `atendente_id = auth.uid() OR gestor`.
5. Rate limiting de login fica por conta do Supabase Auth (padrão). Considerar MFA para gestores no painel do Supabase.
6. Logs (`console.error`) podem conter nome/telefone em mensagens de erro do Chatwoot; em produção, prefira um logger com redação de PII.
7. `npm audit` não pôde ser executado com credibilidade (registro pediu aprovação de scripts); rodar `npm audit` no CI.
