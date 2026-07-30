-- Habilita RLS na triagem_hsm
ALTER TABLE triagem_hsm ENABLE ROW LEVEL SECURITY;

-- Gestores veem tudo
CREATE POLICY "triagem_gestor_select" ON triagem_hsm
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND role = 'gestor')
  );

-- Atendentes veem apenas os que foram atribuídos a eles
CREATE POLICY "triagem_atendente_select" ON triagem_hsm
  FOR SELECT USING (atendente_id = auth.uid());

-- Qualquer autenticado pode atualizar (status, atendente, etc.)
CREATE POLICY "triagem_update" ON triagem_hsm
  FOR UPDATE USING (auth.uid() IS NOT NULL);

-- Service role (N8N/AI) pode inserir
CREATE POLICY "triagem_insert" ON triagem_hsm
  FOR INSERT WITH CHECK (true);
