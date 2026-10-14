-- =====================================================================
-- MEU EIXO · Atualização 003: perfil alimentar
-- Execute uma única vez em: Supabase › SQL Editor › New query › Run
-- O perfil é individual: fica ligado à pessoa, não ao espaço, e
-- ninguém mais o vê, nem quem divide um espaço compartilhado.
-- =====================================================================

create table if not exists public.perfil_alimentar (
  usuario_id uuid primary key default auth.uid() references auth.users on delete cascade,
  dados jsonb not null default '{}'::jsonb,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table if not exists public.pesagens (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null default auth.uid() references auth.users on delete cascade,
  data date not null default current_date,
  peso numeric(5,2) not null check (peso between 20 and 400),
  cintura numeric(5,1) check (cintura between 30 and 250),
  criado_em timestamptz not null default now()
);
create index if not exists pesagens_usuario on public.pesagens (usuario_id, data);

alter table public.perfil_alimentar enable row level security;
alter table public.pesagens enable row level security;

drop policy if exists perfil_alimentar_proprio on public.perfil_alimentar;
create policy perfil_alimentar_proprio on public.perfil_alimentar for all to authenticated
  using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

drop policy if exists pesagens_proprias on public.pesagens;
create policy pesagens_proprias on public.pesagens for all to authenticated
  using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

grant select, insert, update, delete on public.perfil_alimentar, public.pesagens to authenticated;
revoke all on public.perfil_alimentar, public.pesagens from anon;

-- Pronto. Deve aparecer "Success. No rows returned".
