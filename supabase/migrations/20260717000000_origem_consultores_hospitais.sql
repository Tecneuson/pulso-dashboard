-- Cutover "funcional": cadastros novos (consultores e hospitais parceiros) + dimensão
-- "Origem da Conversa" e número do paciente na triagem.
-- Mudança ADITIVA: não altera colunas/constraints existentes, não toca no vocabulário
-- de estagio_funil nem no Chatwoot/n8n.

CREATE TABLE IF NOT EXISTS public.consultores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  telefone text,
  email text,
  observacoes text,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.consultores IS 'Consultores intermediários entre a família do paciente e o hospital (origem da conversa).';

CREATE TABLE IF NOT EXISTS public.hospitais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.hospitais IS 'Hospitais parceiros (origem interhospitalar).';

ALTER TABLE public.consultores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hospitais ENABLE ROW LEVEL SECURITY;

-- Qualquer usuário autenticado da equipe pode ler/gerenciar os cadastros.
DROP POLICY IF EXISTS consultores_rw ON public.consultores;
CREATE POLICY consultores_rw ON public.consultores
  FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS hospitais_rw ON public.hospitais;
CREATE POLICY hospitais_rw ON public.hospitais
  FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- Colunas novas na triagem (todas nullable; não sincronizam com Chatwoot).
ALTER TABLE public.triagem_hsm
  ADD COLUMN IF NOT EXISTS numero_paciente text,
  ADD COLUMN IF NOT EXISTS origem_conversa text
    CHECK (origem_conversa IS NULL OR origem_conversa IN ('interhospitalar','consultor','profissional_saude','residencia')),
  ADD COLUMN IF NOT EXISTS origem_hospital_id uuid REFERENCES public.hospitais(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS origem_consultor_id uuid REFERENCES public.consultores(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS origem_profissional_tipo text
    CHECK (origem_profissional_tipo IS NULL OR origem_profissional_tipo IN ('medico','psicologo','outros'));

COMMENT ON COLUMN public.triagem_hsm.numero_paciente IS 'Número/identificador do paciente informado ao internar.';
COMMENT ON COLUMN public.triagem_hsm.origem_conversa IS 'Origem da conversa: interhospitalar | consultor | profissional_saude | residencia.';

-- updated_at automático para consultores.
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_consultores_updated_at ON public.consultores;
CREATE TRIGGER trg_consultores_updated_at
  BEFORE UPDATE ON public.consultores
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_triagem_origem_consultor ON public.triagem_hsm(origem_consultor_id);
CREATE INDEX IF NOT EXISTS idx_triagem_origem_hospital ON public.triagem_hsm(origem_hospital_id);
