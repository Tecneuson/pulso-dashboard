-- Necessário pro 'criar no 1o contato' não duplicar (roda no SQL Editor do Supabase)
ALTER TABLE public.triagem_hsm
  ADD CONSTRAINT triagem_hsm_conversation_id_unique UNIQUE (conversation_id);
-- (NULL é permitido/múltiplo no Postgres, então leads manuais sem conversation_id seguem ok)
