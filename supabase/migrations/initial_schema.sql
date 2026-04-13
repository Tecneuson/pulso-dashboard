-- ============================================================
-- HSM Dashboard — Schema Inicial
-- Supabase / PostgreSQL
-- ============================================================

-- ============================================================
-- 0. EXTENSÕES
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- 1. ENUMS — Baseados no mapeamento de campos do HSM
-- ============================================================

-- Tipo do contato
CREATE TYPE contact_type AS ENUM (
  'lead',
  'ex_paciente',
  'responsavel',
  'medico',
  'parceiro'
);

-- Para quem é a solicitação
CREATE TYPE solicitation_target AS ENUM (
  'voce_mesmo',
  'familiar',
  'amigo'
);

-- Motivo do contato
CREATE TYPE contact_reason AS ENUM (
  'transtorno_mental_adulto',
  'transtorno_mental_infantojuvenil',
  'abuso_de_substancias'
);

-- Estágio no funil (colunas do Kanban)
CREATE TYPE funnel_stage AS ENUM (
  'novo_contato',
  'atendendo',
  'consultando_convenio',
  'autorizado_pelo_convenio',
  'paciente_a_caminho',
  'hospital_recepcao',
  'recusou_internacao',
  'internacao_confirmada'
);

-- Assunto da conversa
CREATE TYPE conversation_subject AS ENUM (
  'internacao',
  'consulta',
  'informacao_de_paciente',
  'administrativo',
  'recursos_humanos',
  'outro'
);

-- Motivo de perda
CREATE TYPE loss_reason AS ENUM (
  'parou_de_interagir',
  'desistiu_do_tratamento',
  'financeiro',
  'plano_nao_autorizou',
  'plano_sem_convenio',
  'nao_tem_plano',
  'nao_gostou_do_hospital',
  'sus',
  'outro'
);

-- Origem do contato/conversa
CREATE TYPE origin_type AS ENUM (
  'transferencia_hospitalar',
  'indicacao_medica',
  'ex_paciente',
  'parceiro',
  'outro'
);

-- ============================================================
-- 2. TABELA DE PLANOS DE SAÚDE (lookup table)
-- ============================================================
CREATE TABLE health_plans (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name        text NOT NULL UNIQUE,
  slug        text NOT NULL UNIQUE,
  active      boolean DEFAULT true NOT NULL,
  created_at  timestamptz DEFAULT now() NOT NULL
);

-- Seed dos planos mapeados no documento
INSERT INTO health_plans (name, slug) VALUES
  ('Alice', 'alice'),
  ('Allianz Saúde', 'allianz_saude'),
  ('Amafresp', 'amafresp'),
  ('Amil', 'amil'),
  ('Banco Central do Brasil Saúde', 'banco_central_saude'),
  ('Blue', 'blue'),
  ('Bradesco Saúde', 'bradesco_saude'),
  ('Care Plus', 'care_plus'),
  ('Central Nacional Unimed - CNU', 'cnu'),
  ('Economus', 'economus'),
  ('Fundação Saúde Itaú', 'fundacao_saude_itau'),
  ('Gama Saúde', 'gama_saude'),
  ('Life Empresarial Saúde', 'life_empresarial'),
  ('MediService', 'mediservice'),
  ('MedSenior', 'medsenior'),
  ('MedTour', 'medtour'),
  ('Metrus', 'metrus'),
  ('Notredame Intermédica', 'notredame_intermedica'),
  ('Omint Saúde', 'omint_saude'),
  ('Porto Saúde', 'porto_saude'),
  ('Postal Saúde', 'postal_saude'),
  ('Prevent Senior', 'prevent_senior'),
  ('PROASA Adventista de Saúde', 'proasa'),
  ('Sami Saúde', 'sami_saude'),
  ('Santa Casa Saúde', 'santa_casa_saude'),
  ('Saúde Caixa', 'saude_caixa'),
  ('SBC Saúde', 'sbc_saude'),
  ('Sepaco', 'sepaco'),
  ('SulAmérica', 'sulamerica'),
  ('Total MedCare', 'total_medcare'),
  ('Trasmontano', 'trasmontano'),
  ('Vivest', 'vivest');

-- ============================================================
-- 3. TABELA DE CONTATOS (Campos do Contato)
-- ============================================================
CREATE TABLE contacts (
  id                    uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at            timestamptz DEFAULT now() NOT NULL,
  updated_at            timestamptz DEFAULT now() NOT NULL,

  -- Dados pessoais
  name                  text NOT NULL,
  phone                 text,
  whatsapp              text,
  email                 text,

  -- Classificação
  contact_type          contact_type NOT NULL DEFAULT 'lead',
  solicitation_target   solicitation_target,
  contact_reason        contact_reason,

  -- Plano de saúde
  health_plan_id        uuid REFERENCES health_plans(id) ON DELETE SET NULL,

  -- Funil (Kanban)
  funnel_stage          funnel_stage NOT NULL DEFAULT 'novo_contato',
  funnel_stage_changed_at timestamptz DEFAULT now() NOT NULL,

  -- UTMs de origem do contato
  utm_source            text,
  utm_medium            text,
  utm_campaign          text,
  utm_term              text,
  utm_content           text,

  -- Origem alternativa
  origin                origin_type,
  origin_details        text,

  -- ID externo do Chatwoot
  chatwoot_contact_id   bigint UNIQUE,

  -- Metadados
  notes                 text
);

-- ============================================================
-- 4. TABELA DE CONVERSAS (Campos da Conversa)
-- ============================================================
CREATE TABLE conversations (
  id                    uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at            timestamptz DEFAULT now() NOT NULL,
  updated_at            timestamptz DEFAULT now() NOT NULL,

  -- Relacionamento com contato
  contact_id            uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,

  -- Classificação da conversa
  subject               conversation_subject NOT NULL DEFAULT 'outro',
  is_sale               boolean,
  loss_reason           loss_reason,

  -- UTMs da conversa (podem diferir das UTMs do contato)
  utm_source            text,
  utm_medium            text,
  utm_campaign          text,
  utm_term              text,
  utm_content           text,

  -- Origem alternativa da conversa
  origin                origin_type,
  origin_details        text,

  -- Tags (array de texto flexível)
  tags                  text[] DEFAULT '{}',

  -- ID externo do Chatwoot
  chatwoot_conversation_id bigint UNIQUE,

  -- Dados do Chatwoot
  chatwoot_status       text,
  chatwoot_assignee     text,
  chatwoot_inbox        text,

  -- Timestamps de atendimento (para métricas)
  first_reply_at        timestamptz,
  resolved_at           timestamptz
);

-- ============================================================
-- 5. TABELA DE HISTÓRICO DO FUNIL (para métricas de tempo)
-- ============================================================
CREATE TABLE funnel_history (
  id                    uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at            timestamptz DEFAULT now() NOT NULL,
  contact_id            uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  from_stage            funnel_stage,
  to_stage              funnel_stage NOT NULL,
  changed_by            text, -- nome do agente ou 'system'
  notes                 text
);

-- ============================================================
-- 6. TABELA DE USUÁRIOS DO DASHBOARD
-- ============================================================
CREATE TABLE dashboard_users (
  id                    uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at            timestamptz DEFAULT now() NOT NULL,
  updated_at            timestamptz DEFAULT now() NOT NULL,
  name                  text NOT NULL,
  email                 text NOT NULL UNIQUE,
  role                  text NOT NULL DEFAULT 'viewer'
    CHECK (role IN ('admin', 'manager', 'agent', 'viewer')),
  avatar_url            text,
  active                boolean DEFAULT true NOT NULL
);

-- ============================================================
-- 7. TABELA DE WEBHOOKS LOG (auditoria dos dados do Chatwoot)
-- ============================================================
CREATE TABLE webhook_logs (
  id                    uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at            timestamptz DEFAULT now() NOT NULL,
  event_type            text NOT NULL,
  payload               jsonb NOT NULL,
  processed             boolean DEFAULT false NOT NULL,
  error                 text
);

-- ============================================================
-- 8. VIEWS MATERIALIZADAS PARA MÉTRICAS
-- ============================================================

-- Métricas diárias de conversas
CREATE MATERIALIZED VIEW daily_conversation_metrics AS
SELECT
  DATE(c.created_at) AS date,
  c.subject,
  COUNT(*) AS total,
  COUNT(*) FILTER (WHERE c.is_sale = true) AS sales,
  COUNT(*) FILTER (WHERE c.is_sale = false) AS losses,
  COUNT(*) FILTER (WHERE c.loss_reason IS NOT NULL) AS with_loss_reason
FROM conversations c
GROUP BY DATE(c.created_at), c.subject
ORDER BY date DESC;

-- Métricas por plano de saúde
CREATE MATERIALIZED VIEW health_plan_metrics AS
SELECT
  hp.name AS health_plan,
  ct.funnel_stage,
  COUNT(*) AS total,
  COUNT(*) FILTER (WHERE ct.funnel_stage = 'internacao_confirmada') AS internacoes
FROM contacts ct
LEFT JOIN health_plans hp ON ct.health_plan_id = hp.id
GROUP BY hp.name, ct.funnel_stage;

-- Métricas por motivo de perda
CREATE MATERIALIZED VIEW loss_reason_metrics AS
SELECT
  c.loss_reason,
  COUNT(*) AS total,
  DATE(c.created_at) AS date
FROM conversations c
WHERE c.loss_reason IS NOT NULL
GROUP BY c.loss_reason, DATE(c.created_at)
ORDER BY date DESC;

-- ============================================================
-- 9. ÍNDICES
-- ============================================================

-- Contacts
CREATE INDEX idx_contacts_chatwoot_id ON contacts(chatwoot_contact_id);
CREATE INDEX idx_contacts_funnel_stage ON contacts(funnel_stage);
CREATE INDEX idx_contacts_contact_type ON contacts(contact_type);
CREATE INDEX idx_contacts_health_plan ON contacts(health_plan_id);
CREATE INDEX idx_contacts_created_at ON contacts(created_at DESC);
CREATE INDEX idx_contacts_utm_source ON contacts(utm_source) WHERE utm_source IS NOT NULL;

-- Conversations
CREATE INDEX idx_conversations_contact ON conversations(contact_id);
CREATE INDEX idx_conversations_chatwoot_id ON conversations(chatwoot_conversation_id);
CREATE INDEX idx_conversations_subject ON conversations(subject);
CREATE INDEX idx_conversations_is_sale ON conversations(is_sale) WHERE is_sale IS NOT NULL;
CREATE INDEX idx_conversations_created_at ON conversations(created_at DESC);
CREATE INDEX idx_conversations_tags ON conversations USING gin(tags);

-- Funnel History
CREATE INDEX idx_funnel_history_contact ON funnel_history(contact_id);
CREATE INDEX idx_funnel_history_created_at ON funnel_history(created_at DESC);
CREATE INDEX idx_funnel_history_to_stage ON funnel_history(to_stage);

-- Webhook Logs
CREATE INDEX idx_webhook_logs_processed ON webhook_logs(processed) WHERE processed = false;
CREATE INDEX idx_webhook_logs_event ON webhook_logs(event_type);

-- ============================================================
-- 10. TRIGGERS
-- ============================================================

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at_contacts
  BEFORE UPDATE ON contacts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_updated_at_conversations
  BEFORE UPDATE ON conversations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_updated_at_dashboard_users
  BEFORE UPDATE ON dashboard_users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Registrar mudanças de estágio no funil automaticamente
CREATE OR REPLACE FUNCTION log_funnel_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.funnel_stage IS DISTINCT FROM NEW.funnel_stage THEN
    INSERT INTO funnel_history (contact_id, from_stage, to_stage)
    VALUES (NEW.id, OLD.funnel_stage, NEW.funnel_stage);

    NEW.funnel_stage_changed_at = now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER track_funnel_change
  BEFORE UPDATE ON contacts
  FOR EACH ROW EXECUTE FUNCTION log_funnel_change();

-- ============================================================
-- 11. ROW LEVEL SECURITY (RLS)
-- ============================================================

ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE funnel_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE dashboard_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE health_plans ENABLE ROW LEVEL SECURITY;

-- Usuários autenticados podem ler tudo (dashboard interno)
CREATE POLICY "authenticated_read_contacts" ON contacts
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "authenticated_read_conversations" ON conversations
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "authenticated_read_funnel_history" ON funnel_history
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "authenticated_read_health_plans" ON health_plans
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "authenticated_read_dashboard_users" ON dashboard_users
  FOR SELECT USING (auth.role() = 'authenticated');

-- Somente admins e managers podem inserir/atualizar
CREATE POLICY "managers_write_contacts" ON contacts
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM dashboard_users
      WHERE id = auth.uid()
      AND role IN ('admin', 'manager')
    )
  );

CREATE POLICY "managers_write_conversations" ON conversations
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM dashboard_users
      WHERE id = auth.uid()
      AND role IN ('admin', 'manager')
    )
  );

-- Webhook logs: somente service_role (API Routes no backend)
CREATE POLICY "service_role_webhook_logs" ON webhook_logs
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================================
-- 12. FUNÇÃO PARA REFRESH DAS MATERIALIZED VIEWS
-- ============================================================
CREATE OR REPLACE FUNCTION refresh_dashboard_metrics()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW daily_conversation_metrics;
  REFRESH MATERIALIZED VIEW health_plan_metrics;
  REFRESH MATERIALIZED VIEW loss_reason_metrics;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;