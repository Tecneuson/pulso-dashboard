-- =============================================================================
-- Migração 2026-09-09 — Categorias de contato gerenciáveis pelo administrador
-- Rodar no SQL Editor. Idempotente: pode rodar quantas vezes quiser.
--
-- Até aqui os perfis de contato eram uma lista fixa no código (Lead, Ex-paciente,
-- Responsável, Médico, Consultor). O hospital precisa acrescentar outros — Terapeuta,
-- Psicólogo, e o que aparecer — sem depender de deploy.
--
-- Continuam existindo DOIS níveis, e isso é de propósito:
--   • PERFIL (slug)  — o que fica gravado em `triagem_hsm.tipo_contato`;
--   • GRUPO          — o agrupamento que os relatórios somam ("Consultores > 20
--                      internações", e dentro dele Rafael 10 / Arthur 10).
-- Terapeuta e Psicólogo entram como perfis do grupo `consultor`: aparecem separados
-- na lista e somados no total do grupo.
--
-- Os 5 originais vão marcados como `sistema` e a aplicação não deixa apagá-los:
-- o mapeamento com o Chatwoot e os leads antigos apontam para esses slugs.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.categorias_contato (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug       text NOT NULL UNIQUE,
  label      text NOT NULL,
  grupo      text NOT NULL DEFAULT 'consultor',
  descricao  text,
  ordem      integer NOT NULL DEFAULT 100,
  ativo      boolean NOT NULL DEFAULT true,
  sistema    boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Slug é o valor gravado no lead e enviado ao Chatwoot: sem acento, sem espaço.
ALTER TABLE public.categorias_contato DROP CONSTRAINT IF EXISTS categorias_contato_slug_formato;
ALTER TABLE public.categorias_contato ADD CONSTRAINT categorias_contato_slug_formato
  CHECK (slug ~ '^[a-z][a-z0-9_]*$');

-- O grupo é o que os relatórios somam; manter fechado evita total órfão no BI.
ALTER TABLE public.categorias_contato DROP CONSTRAINT IF EXISTS categorias_contato_grupo_valido;
ALTER TABLE public.categorias_contato ADD CONSTRAINT categorias_contato_grupo_valido
  CHECK (grupo IN ('paciente', 'responsavel', 'consultor'));

CREATE INDEX IF NOT EXISTS idx_categorias_contato_ordem
  ON public.categorias_contato (ativo, ordem, label);

ALTER TABLE public.categorias_contato ENABLE ROW LEVEL SECURITY;

-- Mesma postura das demais tabelas de cadastro: invisível para o papel `anon`
-- (chave pública do navegador) e liberada para quem tem sessão.
REVOKE ALL ON public.categorias_contato FROM anon;
DROP POLICY IF EXISTS categorias_contato_rw ON public.categorias_contato;
CREATE POLICY categorias_contato_rw ON public.categorias_contato
  FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

DROP TRIGGER IF EXISTS trg_categorias_contato_updated_at ON public.categorias_contato;
CREATE TRIGGER trg_categorias_contato_updated_at
  BEFORE UPDATE ON public.categorias_contato
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Semente: os 5 perfis que já existiam (marcados como sistema) + os 2 pedidos.
-- ON CONFLICT DO NOTHING preserva qualquer renomeação feita pelo administrador.
-- -----------------------------------------------------------------------------
INSERT INTO public.categorias_contato (slug, label, grupo, ordem, sistema, descricao) VALUES
  ('lead',        'Lead',        'paciente',    10, true,  'A própria pessoa que será atendida, em primeiro contato.'),
  ('ex_paciente', 'Ex-paciente', 'paciente',    20, true,  'Paciente que já se internou no hospital antes.'),
  ('responsavel', 'Responsável', 'responsavel', 30, true,  'Familiar, amigo(a) ou responsável legal falando pelo paciente.'),
  ('medico',      'Médico',      'consultor',   40, true,  'Médico que encaminha o paciente.'),
  ('consultor',   'Consultor',   'consultor',   50, true,  'Quem intermedeia entre a família e o hospital.'),
  ('terapeuta',   'Terapeuta',   'consultor',   60, false, 'Terapeuta que acompanha o paciente e encaminha.'),
  ('psicologo',   'Psicólogo',   'consultor',   70, false, 'Psicólogo(a) que acompanha o paciente e encaminha.')
ON CONFLICT (slug) DO NOTHING;

-- Garante que os 5 originais fiquem protegidos mesmo se a linha já existia.
UPDATE public.categorias_contato SET sistema = true
WHERE slug IN ('lead', 'ex_paciente', 'responsavel', 'medico', 'consultor') AND sistema = false;
