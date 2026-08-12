-- Correções que destravam a criação de lead manual pelo dashboard.
-- Ambas são relaxamentos/ajustes de metadado: nenhuma linha existente é alterada.

-- 1) Lead criado à mão não tem conversa no Chatwoot, mas a coluna era NOT NULL —
--    o insert do formulário sempre falhava. O app já trata NULL como "lead manual".
ALTER TABLE public.triagem_hsm ALTER COLUMN conversation_id DROP NOT NULL;

COMMENT ON COLUMN public.triagem_hsm.conversation_id IS
  'Id da conversa no Chatwoot. NULL = lead criado manualmente no dashboard.';

-- 2) O default da coluna status era 'novo_lead', valor que o CHECK
--    triagem_hsm_status_check NÃO aceita ('em_triagem', 'qualificado',
--    'desqualificado', 'internado'). Qualquer insert sem status explícito era
--    recusado. Troca só o default; o CHECK continua igual.
ALTER TABLE public.triagem_hsm ALTER COLUMN status SET DEFAULT 'em_triagem';
