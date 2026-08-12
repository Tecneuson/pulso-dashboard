-- =============================================================================
-- Migração 2026-08-05 — Motivo TM/TUS (remove KIDS) + Data de nascimento
-- Rodar no SQL Editor do Supabase (MCP estava desconectado).
-- Seguro/idempotente. Assume que motivo_contato é TEXT com CHECK (não enum).
-- =============================================================================

-- 1) Nova coluna: data de nascimento (substitui a distinção adulto/infantojuvenil)
ALTER TABLE public.triagem_hsm
  ADD COLUMN IF NOT EXISTS data_nascimento date;

-- 2) Remover qualquer CHECK antigo em motivo_contato (nome pode variar)
DO $$
DECLARE c text;
BEGIN
  SELECT conname INTO c
  FROM pg_constraint
  WHERE conrelid = 'public.triagem_hsm'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) ILIKE '%motivo_contato%';
  IF c IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.triagem_hsm DROP CONSTRAINT %I', c);
  END IF;
END $$;

-- 3) Migrar os slugs antigos -> transtorno_mental (adulto e infantojuvenil viram TM)
UPDATE public.triagem_hsm
SET motivo_contato = 'transtorno_mental'
WHERE motivo_contato IN ('transtorno_mental_adulto', 'transtorno_mental_infantojuvenil');

-- 4) Novo CHECK com os 2 valores válidos (permite NULL)
ALTER TABLE public.triagem_hsm
  ADD CONSTRAINT triagem_hsm_motivo_contato_check
  CHECK (motivo_contato IS NULL OR motivo_contato IN ('transtorno_mental', 'abuso_de_substancias'));

-- 5) Captadores: tipo do captador (interhospitalar, consultor, profissional_saude, residencia)
ALTER TABLE public.captadores
  ADD COLUMN IF NOT EXISTS tipo text;

-- 6) Conferência (opcional)
SELECT motivo_contato, count(*) FROM public.triagem_hsm GROUP BY 1 ORDER BY 2 DESC;

-- OBS: se motivo_contato for um ENUM (e não TEXT com CHECK), os passos 2-4 falham —
-- nesse caso me avisa que eu ajusto o script pra ALTER TYPE do enum.
