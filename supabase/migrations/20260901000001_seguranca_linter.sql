-- =============================================================================
-- Migração 2026-09-01b — Higiene de segurança apontada pelo linter do Supabase
-- Rodar no SQL Editor. Idempotente. NÃO altera dados, só permissões e metadados.
--
-- Nenhum destes itens é uma brecha aberta hoje (a RLS já barra as linhas), mas
-- os dois primeiros reduzem superfície e o terceiro tira um aviso recorrente.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) `search_path` fixo nas funções (lint 0011)
--    Sem isso, o schema de resolução depende de quem chama: alguém que consiga
--    criar um schema no caminho poderia sombrear `now()`/`age()` e mudar o
--    comportamento do trigger. Fixar o caminho elimina a classe do problema.
-- -----------------------------------------------------------------------------
ALTER FUNCTION public.set_updated_at() SET search_path = pg_catalog, public;
ALTER FUNCTION public.triagem_hsm_calcula_kids() SET search_path = pg_catalog, public;

-- -----------------------------------------------------------------------------
-- 2) Tabelas de negócio somem do schema exposto ao papel `anon` (lint 0026)
--    A anon key é pública (vai no navegador). A RLS dessas tabelas já exige
--    `auth.uid() IS NOT NULL`, então ninguém deslogado lê linha nenhuma — mas
--    sem o GRANT elas deixam de ser sequer descobríveis via PostgREST/GraphQL.
--    O app sempre acessa com sessão (`authenticated`), então nada quebra.
-- -----------------------------------------------------------------------------
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'agendamentos', 'campos_personalizados', 'captadores', 'consultores', 'hospitais'
  ] LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=t) THEN
      EXECUTE format('REVOKE ALL ON public.%I FROM anon', t);
    END IF;
  END LOOP;
END $$;

-- -----------------------------------------------------------------------------
-- 3) `n8n_chat_histories`: RLS ligada e sem policy (lint 0008)
--    É a memória do bot no n8n, que acessa via service_role (bypassa RLS).
--    Deixamos explícito que nenhum usuário final deve ler: sem policy + sem GRANT.
--    (Se algum dia o bot sair do n8n, esta tabela pode ser descartada.)
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='n8n_chat_histories') THEN
    REVOKE ALL ON public.n8n_chat_histories FROM anon, authenticated;
    COMMENT ON TABLE public.n8n_chat_histories IS
      'Memória de conversa do bot no n8n. Acesso apenas por service_role — sem policy e sem GRANT de propósito.';
  END IF;
END $$;

-- Conferência: rode `get_advisors(security)` depois — os avisos 0011 e 0026
-- devem sumir. Continuam de pé (fora do SQL):
--   · "Leaked password protection disabled" → ligar em Auth → Providers no painel;
--   · `pg_trgm` no schema public → mover exige recriar índices; baixo risco, deixar.
