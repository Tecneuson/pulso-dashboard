-- Imagens anexadas ao card (10/11/2026).
-- O ARQUIVO fica no Chatwoot (nota privada com anexo, no disco da VPS). Aqui só guardamos
-- os links: [{ id, url, thumb_url, nome, tamanho, largura, altura }].
-- Idempotente e sem efeito nas linhas existentes (coluna nula).
ALTER TABLE public.anotacoes
  ADD COLUMN IF NOT EXISTS anexos jsonb;

COMMENT ON COLUMN public.anotacoes.anexos IS
  'Imagens da nota (links do Chatwoot): [{id,url,thumb_url,nome,tamanho,largura,altura}]. O arquivo mora no Chatwoot.';
