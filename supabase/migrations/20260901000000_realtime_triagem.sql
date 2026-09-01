-- =============================================================================
-- Migração 2026-09-01 — Tempo real no funil
-- Rodar no SQL Editor do Supabase. Idempotente.
--
-- Coloca `triagem_hsm` na publicação do Realtime para o Kanban se atualizar sozinho
-- quando alguém mexe no Chatwoot, o bot grava a triagem ou outro atendente edita.
-- A RLS continua valendo: o Realtime só entrega a linha para quem poderia lê-la
-- (policy `triagem_select_auth`, criada na migração 20260823).
-- =============================================================================

-- A publicação `supabase_realtime` já existe em todo projeto Supabase; se alguém
-- a tiver removido, recria vazia antes de adicionar a tabela.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'triagem_hsm'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.triagem_hsm;
    RAISE NOTICE 'triagem_hsm adicionada à publicação supabase_realtime.';
  ELSE
    RAISE NOTICE 'triagem_hsm já estava na publicação — nada a fazer.';
  END IF;
END $$;

-- REPLICA IDENTITY: o padrão (chave primária) basta — no DELETE o app só precisa do
-- `id` para tirar o card da tela, e no UPDATE o Postgres manda a linha nova inteira.
-- (FULL faria o WAL carregar a linha antiga também, sem ganho para o nosso caso.)

-- Conferência:
-- SELECT schemaname, tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime';
