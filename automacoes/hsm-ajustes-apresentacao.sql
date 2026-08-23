-- ============================================================
-- HSM — ajustes para a apresentação (rodar no SQL Editor do Supabase)
-- Seguro e idempotente. Não apaga nada.
-- ============================================================

-- 1) Campo "Elegível" (Sim/Não) na triagem — relativo à conversa
ALTER TABLE public.triagem_hsm
  ADD COLUMN IF NOT EXISTS elegivel boolean;

-- 2) Conferência rápida
SELECT
  (SELECT count(*) FROM public.consultores) AS consultores,
  (SELECT count(*) FROM public.hospitais)   AS hospitais,
  (SELECT count(*) FROM public.triagem_hsm) AS leads;
