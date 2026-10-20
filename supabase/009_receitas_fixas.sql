-- =====================================================================
-- MEU EIXO · Atualização 009: receitas fixas (todo mês)
-- Execute uma única vez em: Supabase › SQL Editor › New query › Run
-- =====================================================================

-- O mesmo cadastro de "contas fixas" passa a guardar também receitas fixas.
alter table public.recorrencias add column if not exists tipo text not null default 'despesa';
alter table public.recorrencias drop constraint if exists recorrencias_tipo_check;
alter table public.recorrencias add constraint recorrencias_tipo_check check (tipo in ('despesa','receita'));
alter table public.recorrencias add column if not exists origem text default '';

-- Cada receita lançada sabe de qual receita fixa veio.
alter table public.receitas add column if not exists recorrencia_id uuid references public.recorrencias on delete set null;
create index if not exists receitas_recorrencia on public.receitas (recorrencia_id) where recorrencia_id is not null;

-- Pronto. Deve aparecer "Success. No rows returned".
