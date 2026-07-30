-- Agenda / Próximo contato: lembretes com data + nota, ligados a um lead ou paciente,
-- e eventos avulsos da agenda do consultor.
-- Mudança ADITIVA: cria apenas uma tabela nova. Não toca em nenhuma tabela existente.

CREATE TABLE IF NOT EXISTS public.agendamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo text NOT NULL DEFAULT 'contato' CHECK (tipo IN ('contato', 'evento')),
  titulo text,
  triagem_id uuid REFERENCES public.triagem_hsm(id) ON DELETE CASCADE,
  paciente_id uuid REFERENCES public.pacientes(id) ON DELETE CASCADE,
  data date NOT NULL,
  hora time,
  nota text,
  status text NOT NULL DEFAULT 'pendente'
    CHECK (status IN ('pendente', 'contatado', 'nao_contatado', 'concluido', 'cancelado')),
  resultado_nota text,
  concluido_at timestamptz,
  -- uuid do usuário autenticado (auth.uid()). Sem FK para `usuarios` de propósito:
  -- nem todo login da equipe tem linha lá, e um FK bloquearia o agendamento.
  criado_por uuid,
  responsavel_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT agendamentos_alvo_check CHECK (
    (tipo = 'contato' AND (triagem_id IS NOT NULL OR paciente_id IS NOT NULL))
    OR (tipo = 'evento' AND titulo IS NOT NULL)
  )
);

COMMENT ON TABLE public.agendamentos IS 'Lembretes de próximo contato (lead/paciente) e eventos da agenda.';
COMMENT ON COLUMN public.agendamentos.status IS 'pendente | contatado | nao_contatado | concluido | cancelado';

ALTER TABLE public.agendamentos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS agendamentos_rw ON public.agendamentos;
CREATE POLICY agendamentos_rw ON public.agendamentos
  FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

DROP TRIGGER IF EXISTS trg_agendamentos_updated_at ON public.agendamentos;
CREATE TRIGGER trg_agendamentos_updated_at
  BEFORE UPDATE ON public.agendamentos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_agendamentos_data ON public.agendamentos(data);
CREATE INDEX IF NOT EXISTS idx_agendamentos_pendentes ON public.agendamentos(status, data);
CREATE INDEX IF NOT EXISTS idx_agendamentos_triagem ON public.agendamentos(triagem_id);
CREATE INDEX IF NOT EXISTS idx_agendamentos_paciente ON public.agendamentos(paciente_id);
