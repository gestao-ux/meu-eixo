-- =====================================================================
-- MEU EIXO · Atualização 012: cartões de crédito e faturas
-- Execute uma única vez em: Supabase › SQL Editor › New query › Run
-- Só acrescenta tabelas e campos. Nenhum dado existente é apagado.
-- =====================================================================

create table if not exists public.cartoes (
  id uuid primary key default gen_random_uuid(),
  espaco_id uuid not null references public.espacos on delete cascade,
  nome text not null,
  limite numeric(12,2) not null default 0 check (limite >= 0),
  dia_fechamento int not null check (dia_fechamento between 1 and 31),
  dia_vencimento int not null check (dia_vencimento between 1 and 31),
  conta_pagamento uuid references public.contas on delete set null,  -- conta que paga a fatura
  periodo text not null default '' check (periodo in ('','10','20')), -- recebimento que paga a fatura
  ativo boolean not null default true,
  ordem int not null default 0,
  criado_em timestamptz not null default now()
);
create index if not exists cartoes_espaco on public.cartoes (espaco_id);

-- Compra no cartão: a despesa fica ligada ao cartão. O vencimento dela é o
-- vencimento da fatura em que caiu. O dinheiro só sai da conta no pagamento da fatura.
alter table public.despesas add column if not exists cartao_id uuid references public.cartoes on delete set null;
create index if not exists despesas_cartao on public.despesas (cartao_id) where cartao_id is not null;

-- Pagamento da fatura: tira dinheiro da conta, mas não é uma nova despesa
-- (as compras já foram contadas). Assim nada é contado duas vezes.
create table if not exists public.pagamentos_fatura (
  id uuid primary key default gen_random_uuid(),
  espaco_id uuid not null references public.espacos on delete cascade,
  cartao_id uuid not null references public.cartoes on delete cascade,
  fatura text not null,                    -- 'AAAA-MM' (mês de vencimento da fatura)
  valor numeric(12,2) not null check (valor > 0),
  data date not null,
  conta_id uuid references public.contas on delete set null,
  obs text default '',
  criado_por uuid default auth.uid() references auth.users on delete set null,
  criado_em timestamptz not null default now()
);
create index if not exists pagamentos_fatura_cartao on public.pagamentos_fatura (cartao_id, fatura);

alter table public.cartoes enable row level security;
alter table public.pagamentos_fatura enable row level security;

do $$
declare t text;
begin
  foreach t in array array['cartoes','pagamentos_fatura'] loop
    execute format('drop policy if exists %1$s_membros on public.%1$s', t);
    execute format('create policy %1$s_membros on public.%1$s for all to authenticated using (public.eh_membro(espaco_id)) with check (public.eh_membro(espaco_id))', t);
    execute format('grant select, insert, update, delete on public.%1$s to authenticated', t);
    execute format('revoke all on public.%1$s from anon', t);
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- Pronto. Deve aparecer "Success. No rows returned".
