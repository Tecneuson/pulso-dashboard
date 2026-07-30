-- Captadores: quem capta/indica o lead ou paciente. Cadastro próprio + vínculo
-- com leads (triagem_hsm) e com pacientes (base de reativação).
-- Mudança ADITIVA: só cria tabela e colunas nullable novas.

CREATE TABLE IF NOT EXISTS public.captadores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  telefone text,
  email text,
  observacoes text,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.captadores IS 'Captadores/indicadores de leads e pacientes.';

ALTER TABLE public.captadores ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS captadores_rw ON public.captadores;
CREATE POLICY captadores_rw ON public.captadores
  FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- updated_at automático (reaproveita a função criada na migração anterior).
DROP TRIGGER IF EXISTS trg_captadores_updated_at ON public.captadores;
CREATE TRIGGER trg_captadores_updated_at
  BEFORE UPDATE ON public.captadores
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Vínculo com leads e pacientes.
ALTER TABLE public.triagem_hsm
  ADD COLUMN IF NOT EXISTS captador_id uuid REFERENCES public.captadores(id) ON DELETE SET NULL;

ALTER TABLE public.pacientes
  ADD COLUMN IF NOT EXISTS captador_id uuid REFERENCES public.captadores(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_triagem_captador ON public.triagem_hsm(captador_id);
CREATE INDEX IF NOT EXISTS idx_pacientes_captador ON public.pacientes(captador_id);
