-- =============================================
-- Tabela: triagem_hsm
-- Armazena dados de triagem coletados pelo agente IA
-- =============================================

CREATE TABLE IF NOT EXISTS triagem_hsm (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

  -- Dados do Chatwoot
  conversation_id INTEGER,
  message_id INTEGER,

  -- Dados do contato
  contact_name TEXT,
  email TEXT,
  phone TEXT,

  -- Triagem
  assunto TEXT CHECK (assunto IN ('internacao', 'consulta', 'informacao_paciente', 'administrativo', 'outros')),
  para_quem TEXT CHECK (para_quem IN ('voce_mesmo', 'familiar', 'amigo')),
  tipo_contato TEXT CHECK (tipo_contato IN ('lead', 'ex_paciente', 'responsavel_lead', 'responsavel_ex_paciente', 'parceiro')),
  ex_paciente BOOLEAN DEFAULT false,

  -- Internação
  forma_internacao TEXT CHECK (forma_internacao IN ('plano_de_saude', 'particular', 'nao_sabe') OR forma_internacao IS NULL),
  plano_saude TEXT,
  carteirinha_enviada BOOLEAN DEFAULT false,
  carteirinha_url TEXT,

  -- Controle do fluxo
  etapa_atual TEXT DEFAULT 'saudacao',
  triagem_concluida BOOLEAN DEFAULT false,
  transbordado BOOLEAN DEFAULT false,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_triagem_hsm_email ON triagem_hsm(email);
CREATE INDEX IF NOT EXISTS idx_triagem_hsm_conversation_id ON triagem_hsm(conversation_id);
CREATE INDEX IF NOT EXISTS idx_triagem_hsm_transbordado ON triagem_hsm(transbordado);

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_triagem_hsm_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trigger_triagem_hsm_updated_at
  BEFORE UPDATE ON triagem_hsm
  FOR EACH ROW
  EXECUTE FUNCTION update_triagem_hsm_updated_at();

-- RLS (desabilitado por padrão, service_role bypassa)
ALTER TABLE triagem_hsm ENABLE ROW LEVEL SECURITY;

-- Policy para service_role (n8n usa service_role key)
CREATE POLICY "Service role full access on triagem_hsm"
  ON triagem_hsm
  FOR ALL
  USING (true)
  WITH CHECK (true);
