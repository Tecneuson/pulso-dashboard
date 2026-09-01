-- =============================================================================
-- Migração 2026-08-31 — Cadastro de pessoas do contato (consultor / responsável)
-- Rodar DEPOIS de 20260823000000_sync_chatwoot_v2.sql. Idempotente.
--
-- Pedido HSM (ago/2026):
--  · quem entra em contato nem sempre fala de si: pode ser o PACIENTE, um
--    RESPONSÁVEL ou um CONSULTOR;
--  · responsável e consultor precisam de cadastro próprio: nome, telefone,
--    e-mail e CPF;
--  · um consultor pode estar vinculado a VÁRIOS pacientes/leads (N:1 — o
--    vínculo mora no lead, então isso já vale sem tabela de junção);
--  · o card do lead tinha DOIS campos "Consultor" (o do contato e o da origem
--    da conversa) — vira um só, e a origem passa a espelhar esse valor.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) Consultores: cadastro completo (nome, telefone, e-mail, CPF)
-- -----------------------------------------------------------------------------
ALTER TABLE public.consultores
  ADD COLUMN IF NOT EXISTS cpf text;

COMMENT ON COLUMN public.consultores.cpf IS 'CPF normalizado (11 dígitos, só números).';

-- CPF é único quando informado (dois cadastros da mesma pessoa viram um só).
CREATE UNIQUE INDEX IF NOT EXISTS uq_consultores_cpf
  ON public.consultores (cpf) WHERE cpf IS NOT NULL;

-- -----------------------------------------------------------------------------
-- 2) Responsáveis: mesma estrutura do consultor (familiar / responsável legal)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.responsaveis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  telefone text,
  email text,
  cpf text,
  observacoes text,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.responsaveis IS
  'Responsáveis pelo paciente (familiar, amigo ou responsável legal) que entram em contato. Um responsável pode estar ligado a vários leads.';

-- Sem índice único por NOME de propósito: homônimos são comuns entre familiares.
CREATE UNIQUE INDEX IF NOT EXISTS uq_responsaveis_cpf
  ON public.responsaveis (cpf) WHERE cpf IS NOT NULL;

ALTER TABLE public.responsaveis ENABLE ROW LEVEL SECURITY;

-- A tabela guarda CPF: o papel `anon` (chave pública do navegador) não deve nem
-- enxergá-la. A RLS já barraria as linhas, mas sem o GRANT ela some também do
-- schema GraphQL/PostgREST — é a recomendação do linter do Supabase (0026).
REVOKE ALL ON public.responsaveis FROM anon;
DROP POLICY IF EXISTS responsaveis_rw ON public.responsaveis;
CREATE POLICY responsaveis_rw ON public.responsaveis
  FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

DROP TRIGGER IF EXISTS trg_responsaveis_updated_at ON public.responsaveis;
CREATE TRIGGER trg_responsaveis_updated_at
  BEFORE UPDATE ON public.responsaveis
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 3) Vínculo do lead com o responsável
--    (NÃO usar `responsavel_id`: em `pacientes` esse nome já significa o
--     ATENDENTE responsável — daria ambiguidade.)
-- -----------------------------------------------------------------------------
ALTER TABLE public.triagem_hsm
  ADD COLUMN IF NOT EXISTS responsavel_contato_id uuid REFERENCES public.responsaveis(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.triagem_hsm.responsavel_contato_id IS
  'Responsável que fez o contato (tabela responsaveis). O paciente continua em contact_name/cpf.';

CREATE INDEX IF NOT EXISTS idx_triagem_responsavel_contato
  ON public.triagem_hsm(responsavel_contato_id);

-- -----------------------------------------------------------------------------
-- 4) Um consultor, vários pacientes: só índices (o vínculo já é N:1 pelo lead)
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_triagem_origem_consultor_id
  ON public.triagem_hsm(origem_consultor_id);

-- Origem "consultor" passa a espelhar o consultor do contato (campo único no card),
-- e vice-versa. Depende de `consultor_id`, criada na migração 20260823 — se ela ainda
-- não rodou, este bloco é pulado com um aviso em vez de derrubar o script.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'triagem_hsm' AND column_name = 'consultor_id'
  ) THEN
    UPDATE public.triagem_hsm
    SET origem_consultor_id = consultor_id
    WHERE origem_conversa = 'consultor'
      AND consultor_id IS NOT NULL
      AND origem_consultor_id IS DISTINCT FROM consultor_id;

    UPDATE public.triagem_hsm
    SET consultor_id = origem_consultor_id
    WHERE consultor_id IS NULL AND origem_consultor_id IS NOT NULL;
  ELSE
    RAISE NOTICE 'triagem_hsm.consultor_id não existe: rode 20260823000000_sync_chatwoot_v2.sql e depois esta migração de novo (é idempotente).';
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 5) Conferência (opcional)
-- -----------------------------------------------------------------------------
-- SELECT c.nome, count(t.id) AS leads
-- FROM public.consultores c LEFT JOIN public.triagem_hsm t ON t.consultor_id = c.id
-- GROUP BY c.nome HAVING count(t.id) > 0 ORDER BY 2 DESC;
