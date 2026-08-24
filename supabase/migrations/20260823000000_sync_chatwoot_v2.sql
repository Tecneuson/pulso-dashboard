-- =============================================================================
-- Migração 2026-08-23 — Sincronização CRM ⇄ Chatwoot v2 + segurança (RLS)
-- Rodar no SQL Editor do Supabase. Idempotente: pode rodar mais de uma vez.
--
-- Itens cobertos (pedido HSM ago/2026):
--  1/2/8  campos personalizados espelhados do Chatwoot (tabela campos_personalizados +
--         coluna triagem_hsm.atributos), contato do Chatwoot vinculado ao lead
--  4/5    data_nascimento + kids (8–17 anos, trigger automático)
--  7      perfil do contato: lead | ex_paciente | responsavel | medico | consultor (categorias derivadas)
--  BI     30 motivos de perda oficiais, consultores unificados (+seed do CSV), chatwoot_status
--  10     anotações do Chatwoot no histórico (origem/autor/id da mensagem)
--  12     contador de reaberturas por falta de desfecho
--  seg.   policies permissivas demais em triagem_hsm (anon podia ler/escrever)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 0) Pré-requisitos de migrações anteriores que podem não ter rodado (idempotentes)
-- -----------------------------------------------------------------------------
ALTER TABLE public.triagem_hsm ADD COLUMN IF NOT EXISTS data_nascimento date;
ALTER TABLE public.triagem_hsm ADD COLUMN IF NOT EXISTS elegivel boolean;
ALTER TABLE public.triagem_hsm ADD COLUMN IF NOT EXISTS cpf text;
ALTER TABLE public.triagem_hsm ADD COLUMN IF NOT EXISTS paciente_id uuid;
ALTER TABLE public.captadores ADD COLUMN IF NOT EXISTS tipo text;

-- UNIQUE(conversation_id): necessário para o upsert do 1º contato não duplicar.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.triagem_hsm'::regclass AND conname = 'triagem_hsm_conversation_id_unique'
  ) THEN
    ALTER TABLE public.triagem_hsm ADD CONSTRAINT triagem_hsm_conversation_id_unique UNIQUE (conversation_id);
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 1) Novas colunas no lead
-- -----------------------------------------------------------------------------
ALTER TABLE public.triagem_hsm
  ADD COLUMN IF NOT EXISTS chatwoot_contact_id bigint,
  ADD COLUMN IF NOT EXISTS kids boolean,
  ADD COLUMN IF NOT EXISTS atributos jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS desfecho_reaberturas integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.triagem_hsm.chatwoot_contact_id IS 'Id do contato no Chatwoot (sincroniza atributos mesmo sem conversa).';
COMMENT ON COLUMN public.triagem_hsm.kids IS 'Derivado de data_nascimento: paciente entre 8 e 17 anos (unidade infantojuvenil). NULL = sem data.';
COMMENT ON COLUMN public.triagem_hsm.atributos IS 'Valores dos campos personalizados (chave = attribute_key do Chatwoot).';
COMMENT ON COLUMN public.triagem_hsm.desfecho_reaberturas IS 'Quantas vezes a conversa foi reaberta por tentar encerrar sem venda/motivo de perda.';

CREATE INDEX IF NOT EXISTS idx_triagem_chatwoot_contact ON public.triagem_hsm(chatwoot_contact_id);
CREATE INDEX IF NOT EXISTS idx_triagem_kids ON public.triagem_hsm(kids) WHERE kids = true;

-- -----------------------------------------------------------------------------
-- 2) Kids automático (8 a 17 anos) — trigger, para valer para QUALQUER escritor
--    (app, n8n, SQL manual). O app também calcula, por segurança.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.triagem_hsm_calcula_kids()
RETURNS trigger AS $$
DECLARE idade integer;
BEGIN
  IF NEW.data_nascimento IS NULL THEN
    NEW.kids := NULL;
  ELSE
    idade := EXTRACT(YEAR FROM age(current_date, NEW.data_nascimento))::integer;
    NEW.kids := (idade BETWEEN 8 AND 17);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_triagem_hsm_kids ON public.triagem_hsm;
CREATE TRIGGER trg_triagem_hsm_kids
  BEFORE INSERT OR UPDATE OF data_nascimento ON public.triagem_hsm
  FOR EACH ROW EXECUTE FUNCTION public.triagem_hsm_calcula_kids();

-- Backfill dos leads que já têm data de nascimento.
UPDATE public.triagem_hsm
SET kids = (EXTRACT(YEAR FROM age(current_date, data_nascimento))::integer BETWEEN 8 AND 17)
WHERE data_nascimento IS NOT NULL AND kids IS DISTINCT FROM (EXTRACT(YEAR FROM age(current_date, data_nascimento))::integer BETWEEN 8 AND 17);

-- -----------------------------------------------------------------------------
-- 3) Perfil do contato: lead | ex_paciente | responsavel | medico | consultor
--    (as 3 categorias Paciente/Responsável/Consultor são derivadas no app)
-- -----------------------------------------------------------------------------
DO $$
DECLARE c text;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.triagem_hsm'::regclass AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%tipo_contato%'
  LOOP
    EXECUTE format('ALTER TABLE public.triagem_hsm DROP CONSTRAINT %I', c);
  END LOOP;
END $$;

-- Preserva a informação "ex-paciente" das categorias antigas.
UPDATE public.triagem_hsm SET ex_paciente = true
WHERE tipo_contato IN ('ex_paciente','responsavel_ex_paciente') AND ex_paciente IS DISTINCT FROM true;

UPDATE public.triagem_hsm SET tipo_contato = CASE tipo_contato
  WHEN 'responsavel_lead' THEN 'responsavel'
  WHEN 'responsavel_ex_paciente' THEN 'responsavel'
  WHEN 'parceiro' THEN 'consultor'
  WHEN 'paciente' THEN 'lead'
  ELSE tipo_contato END
WHERE tipo_contato IN ('responsavel_lead','responsavel_ex_paciente','parceiro','paciente');

ALTER TABLE public.triagem_hsm
  ADD CONSTRAINT triagem_hsm_tipo_contato_check
  CHECK (tipo_contato IS NULL OR tipo_contato IN ('lead','ex_paciente','responsavel','medico','consultor'));

-- -----------------------------------------------------------------------------
-- 3b) Motivos de perda: vocabulário oficial (30 valores, CSV ago/2026)
-- -----------------------------------------------------------------------------
DO $$
DECLARE c text;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.triagem_hsm'::regclass AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%motivo_perda%'
  LOOP
    EXECUTE format('ALTER TABLE public.triagem_hsm DROP CONSTRAINT %I', c);
  END LOOP;
END $$;

UPDATE public.triagem_hsm SET motivo_perda = CASE motivo_perda
  WHEN 'parou_de_interagir' THEN 'falta_de_interacao'
  WHEN 'desistiu_do_tratamento' THEN 'familia_desistiu_da_internacao'
  WHEN 'financeiro' THEN 'sem_condicoes_financeiras'
  WHEN 'plano_de_saude_sem_convenio' THEN 'plano_de_saude_nao_atendido_pelo_hsm'
  ELSE motivo_perda END
WHERE motivo_perda IN ('parou_de_interagir','desistiu_do_tratamento','financeiro','plano_de_saude_sem_convenio');

ALTER TABLE public.triagem_hsm
  ADD CONSTRAINT triagem_hsm_motivo_perda_check
  CHECK (motivo_perda IS NULL OR motivo_perda IN (
    'alta_origem',
    'cancelado_pela_origem',
    'card_duplicado',
    'convenio_por_direcionamento',
    'convenio_sem_contrato_para_adulto',
    'convenio_sem_contrato_para_kids',
    'convenio_suspenso',
    'consulta_psiquiatrica',
    'demora_no_atendimento',
    'falta_de_interacao',
    'familia_desistiu_da_internacao',
    'familia_rejeitou_vaga',
    'financeiro_itens_de_higiene',
    'financeiro_lavanderia',
    'financeiro_lavanderia_e_itens_de_higiene',
    'localizacao',
    'medico_hsm_vaga_negada',
    'nao_gostou_do_hospital',
    'paciente_evadiu_na_origem',
    'pendencias_administrativas',
    'plano_de_saude_nao_atendido_pelo_hsm',
    'plano_de_saude_nao_autorizou',
    'plano_em_carencia',
    'plano_nao_elegivel',
    'recusa_de_internacao_na_avaliacao',
    'sem_acompanhante_kids',
    'sem_condicoes_financeiras',
    'sem_indicacao_medica_para_internacao',
    'sem_leito_disponivel',
    'transferido_para_outro_servico',
    -- legado (sem equivalente direto; só leitura)
    'nao_tem_plano_de_saude', 'sus', 'outro', 'colaborador_do_hospital'
  ));

-- Assunto: alinha ao vocabulário do bot/Chatwoot (outro_assunto, recursos_humanos).
DO $$
DECLARE c text;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.triagem_hsm'::regclass AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%assunto%' AND pg_get_constraintdef(oid) NOT ILIKE '%motivo%'
  LOOP
    EXECUTE format('ALTER TABLE public.triagem_hsm DROP CONSTRAINT %I', c);
  END LOOP;
END $$;
UPDATE public.triagem_hsm SET assunto = 'outro_assunto' WHERE assunto = 'outros';
ALTER TABLE public.triagem_hsm
  ADD CONSTRAINT triagem_hsm_assunto_check
  CHECK (assunto IS NULL OR assunto IN ('internacao','consulta','informacao_paciente','administrativo','recursos_humanos','outro_assunto'));

-- -----------------------------------------------------------------------------
-- 4) Anotações: notas do Chatwoot (privadas) entram no histórico e vice-versa
-- -----------------------------------------------------------------------------
ALTER TABLE public.anotacoes ALTER COLUMN usuario_id DROP NOT NULL;
ALTER TABLE public.anotacoes
  ADD COLUMN IF NOT EXISTS origem text NOT NULL DEFAULT 'crm',
  ADD COLUMN IF NOT EXISTS autor_nome text,
  ADD COLUMN IF NOT EXISTS chatwoot_message_id bigint;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'anotacoes_origem_check') THEN
    ALTER TABLE public.anotacoes ADD CONSTRAINT anotacoes_origem_check CHECK (origem IN ('crm','chatwoot','bot'));
  END IF;
END $$;
-- Índice único COMPLETO (não parcial): o upsert do PostgREST usa ON CONFLICT (chatwoot_message_id)
-- e índice parcial não serve para isso. NULLs não conflitam entre si.
DROP INDEX IF EXISTS public.uq_anotacoes_chatwoot_message;
CREATE UNIQUE INDEX IF NOT EXISTS uq_anotacoes_chatwoot_message_full ON public.anotacoes(chatwoot_message_id);
CREATE INDEX IF NOT EXISTS idx_anotacoes_triagem ON public.anotacoes(triagem_id);

COMMENT ON COLUMN public.anotacoes.origem IS 'crm (Pulso) | chatwoot (nota privada) | bot (resumo da Mônica)';

-- -----------------------------------------------------------------------------
-- 5) Campos personalizados (espelho das definições do Chatwoot)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.campos_personalizados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chave text NOT NULL,
  rotulo text NOT NULL,
  descricao text,
  modelo text NOT NULL CHECK (modelo IN ('contact','conversation')),
  tipo text NOT NULL CHECK (tipo IN ('text','number','date','list','checkbox','link')),
  opcoes jsonb NOT NULL DEFAULT '[]'::jsonb,
  ativo boolean NOT NULL DEFAULT true,
  ordem integer NOT NULL DEFAULT 0,
  chatwoot_definition_id bigint,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (modelo, chave)
);
COMMENT ON TABLE public.campos_personalizados IS 'Custom attributes do Chatwoot (central) espelhados no CRM. Valores em triagem_hsm.atributos.';

ALTER TABLE public.campos_personalizados ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS campos_personalizados_read ON public.campos_personalizados;
CREATE POLICY campos_personalizados_read ON public.campos_personalizados
  FOR SELECT TO authenticated USING (true);
-- Escrita só via service role (rota /api/campos valida gestor).

DROP TRIGGER IF EXISTS trg_campos_personalizados_updated_at ON public.campos_personalizados;
CREATE TRIGGER trg_campos_personalizados_updated_at
  BEFORE UPDATE ON public.campos_personalizados
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 6) Agente do Chatwoot ↔ usuário do Pulso (para "Agente de atendimento" no card)
-- -----------------------------------------------------------------------------
ALTER TABLE public.usuarios ADD COLUMN IF NOT EXISTS chatwoot_agent_id integer;
CREATE UNIQUE INDEX IF NOT EXISTS uq_usuarios_chatwoot_agent ON public.usuarios(chatwoot_agent_id) WHERE chatwoot_agent_id IS NOT NULL;
COMMENT ON COLUMN public.usuarios.chatwoot_agent_id IS 'Id do agente no Chatwoot (Configurações → Agentes). Preencher à mão.';

-- -----------------------------------------------------------------------------
-- 6b) Consultores: lista ÚNICA (`consultores`) — acaba a duplicidade com `captadores`.
--     Semeia os nomes do CSV do cliente e migra os vínculos captador_id → consultor_id.
-- -----------------------------------------------------------------------------
-- Nome único (case-insensitive) para o seed ser idempotente.
DELETE FROM public.consultores a USING public.consultores b
  WHERE a.ctid > b.ctid AND lower(trim(a.nome)) = lower(trim(b.nome));
CREATE UNIQUE INDEX IF NOT EXISTS uq_consultores_nome ON public.consultores (lower(trim(nome)));

INSERT INTO public.consultores (nome)
SELECT v.nome FROM (VALUES
  ('Adriana Higienopolis'),
  ('Adriano Almeida'),
  ('Alex'),
  ('Beatriz Santos'),
  ('Bruno Santos'),
  ('Carlos Polli'),
  ('Cátia'),
  ('Danilo Silva'),
  ('Daniel Garcia'),
  ('David Duarte'),
  ('Diego Antônio Rodrigues dos Santo'),
  ('Diego de Jesus'),
  ('Edilma Pinheiro'),
  ('Eduardo Andrade'),
  ('Eduardo Gatti'),
  ('Felipe Medeiros'),
  ('Felipe Trindade'),
  ('Fabiano Freitas'),
  ('Fernando Casoto'),
  ('Fernando Zaccardi'),
  ('Gisele Silva'),
  ('Gisleine Fatibello'),
  ('Gustavo'),
  ('Igor'),
  ('Jefferson'),
  ('Junior Alcantara'),
  ('Karen'),
  ('Karina Yukari'),
  ('Leandro Silva'),
  ('Luiz Alpha Remoções'),
  ('Manoelio Prado'),
  ('Paulo Cesa'),
  ('Paulo Malta'),
  ('Paulo Rondon'),
  ('Rafael Azevedo'),
  ('Ronaldo Cazissi'),
  ('Rosana Fatibello'),
  ('Rodrigo Toledo'),
  ('Tatiana Nunes'),
  ('Thayane Vasconcelos'),
  ('Thiago Araujo'),
  ('Thiago Lennon'),
  ('Thiago Silva'),
  ('Uilian de Almeida'),
  ('Wesley Abrantes'),
  ('William Antonio da Rocha'),
  ('Iusi Moreira'),
  ('Audrei Ribeiro')
) AS v(nome)
WHERE NOT EXISTS (SELECT 1 FROM public.consultores c WHERE lower(trim(c.nome)) = lower(trim(v.nome)));

-- Quem só existia em captadores também entra na lista única.
INSERT INTO public.consultores (nome, telefone, email, observacoes, ativo)
SELECT k.nome, k.telefone, k.email, k.observacoes, k.ativo FROM public.captadores k
WHERE NOT EXISTS (SELECT 1 FROM public.consultores c WHERE lower(trim(c.nome)) = lower(trim(k.nome)));

ALTER TABLE public.triagem_hsm ADD COLUMN IF NOT EXISTS consultor_id uuid REFERENCES public.consultores(id) ON DELETE SET NULL;
ALTER TABLE public.pacientes   ADD COLUMN IF NOT EXISTS consultor_id uuid REFERENCES public.consultores(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_triagem_consultor ON public.triagem_hsm(consultor_id);
CREATE INDEX IF NOT EXISTS idx_pacientes_consultor ON public.pacientes(consultor_id);

-- Backfill pelo nome (captador → consultor).
UPDATE public.triagem_hsm t SET consultor_id = c.id
FROM public.captadores k JOIN public.consultores c ON lower(trim(c.nome)) = lower(trim(k.nome))
WHERE t.captador_id = k.id AND t.consultor_id IS NULL;
UPDATE public.pacientes p SET consultor_id = c.id
FROM public.captadores k JOIN public.consultores c ON lower(trim(c.nome)) = lower(trim(k.nome))
WHERE p.captador_id = k.id AND p.consultor_id IS NULL;

COMMENT ON COLUMN public.triagem_hsm.captador_id IS 'LEGADO — use consultor_id (lista unificada em consultores).';

-- Status da conversa no Chatwoot (para o BI "Status das conversas"), mantido pelo webhook.
ALTER TABLE public.triagem_hsm ADD COLUMN IF NOT EXISTS chatwoot_status text;

-- -----------------------------------------------------------------------------
-- 7) SEGURANÇA — RLS do triagem_hsm
--    Existiam policies "para todos" (USING (true) / WITH CHECK (true)) que valiam
--    também para o papel `anon` — e a anon key é pública no navegador. Trocamos por
--    policies restritas a `authenticated`. O service_role (n8n, webhooks) bypassa RLS.
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Service role full access on triagem_hsm" ON public.triagem_hsm;
DROP POLICY IF EXISTS triagem_insert ON public.triagem_hsm;
DROP POLICY IF EXISTS triagem_update ON public.triagem_hsm;

DROP POLICY IF EXISTS triagem_update_auth ON public.triagem_hsm;
CREATE POLICY triagem_update_auth ON public.triagem_hsm
  FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- (triagem_select_auth / triagem_insert_auth já existem da migração 20260730120000;
--  garante que existam mesmo se ela não rodou)
DROP POLICY IF EXISTS triagem_select_auth ON public.triagem_hsm;
CREATE POLICY triagem_select_auth ON public.triagem_hsm
  FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS triagem_insert_auth ON public.triagem_hsm;
CREATE POLICY triagem_insert_auth ON public.triagem_hsm
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

-- Garante RLS ligada nas tabelas sensíveis (não muda policies existentes).
ALTER TABLE public.triagem_hsm ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.anotacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pacientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- 8) Conferência (opcional): policies que ainda valem para `anon`/`public`
-- -----------------------------------------------------------------------------
-- SELECT schemaname, tablename, policyname, roles, cmd, qual, with_check
-- FROM pg_policies WHERE schemaname = 'public'
--   AND (roles = '{public}' OR 'anon' = ANY(roles))
-- ORDER BY tablename, policyname;
