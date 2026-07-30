ALTER TABLE anotacoes 
  ADD COLUMN IF NOT EXISTS triagem_id UUID REFERENCES triagem_hsm(id);
