ALTER TABLE triagem_hsm 
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'novo_lead',
  ADD COLUMN IF NOT EXISTS atendente_id UUID REFERENCES usuarios(id),
  ADD COLUMN IF NOT EXISTS motivo_desqualificacao TEXT;
