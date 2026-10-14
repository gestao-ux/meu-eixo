-- =====================================================================
-- MEU EIXO · Atualização 006: lançamento rápido por comprovante
-- Execute uma única vez em: Supabase › SQL Editor › New query › Run
-- =====================================================================

-- Quem recebeu (despesa) ou quem pagou (receita), como aparece no comprovante.
-- É o que permite reconhecer "Uber", "iFood" ou a loja da parcela da próxima vez.
alter table public.despesas add column if not exists favorecido text default '';
alter table public.receitas add column if not exists favorecido text default '';
alter table public.recorrencias add column if not exists favorecido text default '';

-- Lançamentos feitos automaticamente ficam "a conferir" até a pessoa confirmar.
alter table public.despesas add column if not exists conferido boolean not null default true;
alter table public.receitas add column if not exists conferido boolean not null default true;

create index if not exists despesas_favorecido on public.despesas (espaco_id, favorecido);
create index if not exists despesas_conferir on public.despesas (espaco_id) where conferido = false;
create index if not exists receitas_conferir on public.receitas (espaco_id) where conferido = false;

-- Pronto. Deve aparecer "Success. No rows returned".
