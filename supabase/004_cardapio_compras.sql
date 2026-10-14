-- =====================================================================
-- MEU EIXO · Atualização 004: cardápio e lista de compras
-- Execute uma única vez em: Supabase › SQL Editor › New query › Run
-- Cardápio e listas ficam no espaço (pessoal ou compartilhado).
-- =====================================================================

create table if not exists public.planos_alimentares (
  espaco_id uuid not null references public.espacos on delete cascade,
  mes text not null,                       -- 'AAAA-MM'
  dados jsonb not null default '{}'::jsonb,
  criado_por uuid default auth.uid() references auth.users on delete set null,
  atualizado_em timestamptz not null default now(),
  primary key (espaco_id, mes)
);

create table if not exists public.listas_compra (
  espaco_id uuid not null references public.espacos on delete cascade,
  chave text not null,                     -- 'AAAA-MM:mensal' ou 'AAAA-MM:semana'
  itens jsonb not null default '{}'::jsonb, -- estado por alimento: comprado, ja_tenho, preco
  atualizado_em timestamptz not null default now(),
  primary key (espaco_id, chave)
);

alter table public.planos_alimentares enable row level security;
alter table public.listas_compra enable row level security;

drop policy if exists planos_alimentares_membros on public.planos_alimentares;
create policy planos_alimentares_membros on public.planos_alimentares for all to authenticated
  using (public.eh_membro(espaco_id)) with check (public.eh_membro(espaco_id));

drop policy if exists listas_compra_membros on public.listas_compra;
create policy listas_compra_membros on public.listas_compra for all to authenticated
  using (public.eh_membro(espaco_id)) with check (public.eh_membro(espaco_id));

grant select, insert, update, delete on public.planos_alimentares, public.listas_compra to authenticated;
revoke all on public.planos_alimentares, public.listas_compra from anon;

do $$
declare t text;
begin
  foreach t in array array['planos_alimentares','listas_compra'] loop
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- Pronto. Deve aparecer "Success. No rows returned".
