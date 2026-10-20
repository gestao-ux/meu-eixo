-- =====================================================================
-- MEU EIXO · Atualização 008: contas fixas lançadas automaticamente
-- Execute uma única vez em: Supabase › SQL Editor › New query › Run
-- =====================================================================

-- Até qual mês ('AAAA-MM') a conta fixa já foi lançada no Financeiro.
-- O site lança sozinho os meses seguintes (12 meses à frente) e não
-- recria um mês que você tenha excluído de propósito.
alter table public.recorrencias add column if not exists gerado_ate text;

-- Pronto. Deve aparecer "Success. No rows returned".
