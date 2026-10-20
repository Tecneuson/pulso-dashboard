-- Triagem v22: nome de QUEM está falando com a Mônica (interlocutor). O paciente
-- continua em contact_name. Mudança ADITIVA: só uma coluna nova, nullable.
ALTER TABLE public.triagem_hsm ADD COLUMN IF NOT EXISTS nome_contato text;

COMMENT ON COLUMN public.triagem_hsm.nome_contato IS
  'Nome completo de quem conversou com o bot (interlocutor). Pode ser o próprio paciente.';
