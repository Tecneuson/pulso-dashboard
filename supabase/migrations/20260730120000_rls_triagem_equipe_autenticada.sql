-- A equipe logada passa a ler e criar leads. Mudança ADITIVA: só acrescenta
-- policies permissivas; as antigas (gestor/atendente/update) continuam valendo.
-- Sem isso não existia NENHUMA policy de INSERT — criar lead pelo dashboard era
-- recusado pela RLS — e o SELECT só funcionava para quem estivesse em `usuarios`
-- com role 'gestor' (tabela vazia).

DROP POLICY IF EXISTS triagem_select_auth ON public.triagem_hsm;
CREATE POLICY triagem_select_auth ON public.triagem_hsm
  FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS triagem_insert_auth ON public.triagem_hsm;
CREATE POLICY triagem_insert_auth ON public.triagem_hsm
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);
