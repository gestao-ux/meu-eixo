-- =====================================================================
-- MEU EIXO · Atualização 007: dívidas, plano de quitação e metas
-- Execute uma única vez em: Supabase › SQL Editor › New query › Run
-- =====================================================================

-- Dívidas que não estão parceladas no Financeiro: cartão rotativo,
-- cheque especial, empréstimo, financiamento, acordo, dívida com pessoa.
-- (Compras parceladas já lançadas no Financeiro entram sozinhas no plano.)
create table if not exists public.dividas (
  id uuid primary key default gen_random_uuid(),
  espaco_id uuid not null references public.espacos on delete cascade,
  nome text not null,
  credor text default '',
  tipo text not null default 'outra' check (tipo in ('cartao','cheque_especial','emprestimo','consignado','financiamento','acordo','pessoa','outra')),
  saldo numeric(12,2) not null check (saldo >= 0),     -- saldo devedor informado
  data_saldo date not null,                            -- data em que o saldo foi informado
  juros_mes numeric(6,3) not null default 0 check (juros_mes >= 0 and juros_mes <= 30),  -- % ao mês
  parcela numeric(12,2) check (parcela is null or parcela > 0),  -- pagamento mensal combinado (ou mínimo)
  dia int check (dia is null or dia between 1 and 31),
  periodo text not null default '' check (periodo in ('','10','20')),
  forma_pagamento text default '',
  chave_pix text default '',
  quitada boolean not null default false,
  quitada_em date,
  historico jsonb not null default '[]'::jsonb,        -- [{data, saldo}] a cada atualização de saldo
  obs text default '',
  criado_por uuid default auth.uid() references auth.users on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz
);
create index if not exists dividas_espaco on public.dividas (espaco_id);

-- Pagamento de dívida = despesa ligada à dívida (entra no saldo, nos dias 10/20 e nos relatórios)
alter table public.despesas add column if not exists divida_id uuid references public.dividas on delete set null;
create index if not exists despesas_divida on public.despesas (divida_id) where divida_id is not null;

-- Metas do gestor pessoal (valor-alvo, prazo e configurações de cada meta)
create table if not exists public.metas (
  id uuid primary key default gen_random_uuid(),
  espaco_id uuid not null references public.espacos on delete cascade,
  tipo text not null check (tipo in ('quitar_dividas','limite_credito','reserva','reduzir_marmitas','teto_categoria')),
  titulo text default '',
  valor_alvo numeric(12,2),
  prazo date,
  inicio date not null default current_date,
  ativo boolean not null default true,
  dados jsonb not null default '{}'::jsonb,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz
);
create index if not exists metas_espaco on public.metas (espaco_id, tipo);

alter table public.dividas enable row level security;
alter table public.metas enable row level security;

do $$
declare t text;
begin
  foreach t in array array['dividas','metas'] loop
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
