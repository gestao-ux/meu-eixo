-- =====================================================================
-- MEU EIXO · Estrutura do banco de dados (Supabase / PostgreSQL)
-- Execute este arquivo inteiro uma única vez em: Supabase › SQL Editor › New query
-- Pode ser executado de novo com segurança (usa "if not exists" / "or replace").
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- 1. Pessoas, espaços e membros
--    Cada pessoa tem um espaço pessoal criado automaticamente no cadastro.
--    Espaços compartilhados (casa, família) recebem membros por código de convite.
-- ---------------------------------------------------------------------
create table if not exists public.perfis (
  id uuid primary key references auth.users on delete cascade,
  nome text,
  criado_em timestamptz not null default now()
);

create table if not exists public.espacos (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (char_length(nome) between 1 and 60),
  tipo text not null default 'pessoal' check (tipo in ('pessoal','compartilhado')),
  dono uuid not null references auth.users on delete cascade,
  codigo_convite text unique default upper(encode(gen_random_bytes(5),'hex')),
  criado_em timestamptz not null default now()
);

create table if not exists public.membros (
  espaco_id uuid not null references public.espacos on delete cascade,
  usuario_id uuid not null references auth.users on delete cascade,
  papel text not null default 'membro' check (papel in ('dono','membro')),
  criado_em timestamptz not null default now(),
  primary key (espaco_id, usuario_id)
);

create or replace function public.eh_membro(e uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from membros where espaco_id = e and usuario_id = auth.uid());
$$;

create or replace function public.eh_dono(e uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from membros where espaco_id = e and usuario_id = auth.uid() and papel = 'dono');
$$;

-- ---------------------------------------------------------------------
-- 2. Financeiro
-- ---------------------------------------------------------------------
create table if not exists public.categorias (
  id uuid primary key default gen_random_uuid(),
  espaco_id uuid not null references public.espacos on delete cascade,
  nome text not null check (char_length(nome) between 1 and 40),
  ordem int not null default 99,
  alimentacao boolean not null default false,
  criado_em timestamptz not null default now()
);
create index if not exists categorias_espaco on public.categorias (espaco_id);

create table if not exists public.recorrencias (
  id uuid primary key default gen_random_uuid(),
  espaco_id uuid not null references public.espacos on delete cascade,
  descricao text not null,
  valor numeric(12,2) not null check (valor > 0),
  categoria uuid references public.categorias on delete set null,
  subcategoria text default '',
  forma_pagamento text default '',
  periodo text not null default '' check (periodo in ('','10','20')),
  dia int not null check (dia between 1 and 31),
  inicio text not null,               -- 'AAAA-MM'
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);
create index if not exists recorrencias_espaco on public.recorrencias (espaco_id);

create table if not exists public.receitas (
  id uuid primary key default gen_random_uuid(),
  espaco_id uuid not null references public.espacos on delete cascade,
  descricao text not null,
  origem text default '',
  valor_previsto numeric(12,2) not null check (valor_previsto >= 0),
  valor_recebido numeric(12,2) check (valor_recebido >= 0),
  data_prevista date not null,
  data_efetiva date,
  situacao text not null default 'prevista' check (situacao in ('prevista','recebida','cancelada')),
  periodo text not null default '' check (periodo in ('','10','20')),
  obs text default '',
  criado_por uuid default auth.uid() references auth.users on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz
);
create index if not exists receitas_espaco on public.receitas (espaco_id, data_prevista);

create table if not exists public.despesas (
  id uuid primary key default gen_random_uuid(),
  espaco_id uuid not null references public.espacos on delete cascade,
  descricao text not null,
  valor numeric(12,2) not null check (valor > 0),
  categoria uuid references public.categorias on delete set null,
  subcategoria text default '',
  comportamento text not null default 'variavel' check (comportamento in ('fixa','variavel')),
  forma_pagamento text default '',
  data_compra date,
  vencimento date not null,
  data_pagamento date,
  situacao text not null default 'pendente' check (situacao in ('prevista','pendente','paga','cancelada')),
  periodo text not null default '' check (periodo in ('','10','20')),
  parcelas int not null default 1 check (parcelas between 1 and 72),
  parcela_atual int,
  valor_total numeric(12,2),
  grupo_parcela text,
  recorrencia_id uuid references public.recorrencias on delete set null,
  obs text default '',
  criado_por uuid default auth.uid() references auth.users on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz
);
create index if not exists despesas_espaco on public.despesas (espaco_id, vencimento);

create table if not exists public.orcamentos (
  espaco_id uuid not null references public.espacos on delete cascade,
  mes text not null,                  -- 'AAAA-MM'
  limites jsonb not null default '{}'::jsonb,
  primary key (espaco_id, mes)
);

create table if not exists public.configuracoes (
  espaco_id uuid primary key references public.espacos on delete cascade,
  saldo_inicial numeric(12,2),
  data_saldo date
);

-- ---------------------------------------------------------------------
-- 3. Segurança: cada pessoa só enxerga os espaços dos quais é membro
-- ---------------------------------------------------------------------
alter table public.perfis        enable row level security;
alter table public.espacos       enable row level security;
alter table public.membros       enable row level security;
alter table public.categorias    enable row level security;
alter table public.recorrencias  enable row level security;
alter table public.receitas      enable row level security;
alter table public.despesas      enable row level security;
alter table public.orcamentos    enable row level security;
alter table public.configuracoes enable row level security;

drop policy if exists perfis_proprio on public.perfis;
create policy perfis_proprio on public.perfis for all
  using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists espacos_ler on public.espacos;
create policy espacos_ler on public.espacos for select using (public.eh_membro(id));
drop policy if exists espacos_editar on public.espacos;
create policy espacos_editar on public.espacos for update using (public.eh_dono(id)) with check (public.eh_dono(id));
drop policy if exists espacos_excluir on public.espacos;
create policy espacos_excluir on public.espacos for delete using (public.eh_dono(id) and tipo = 'compartilhado');

drop policy if exists membros_ler on public.membros;
create policy membros_ler on public.membros for select using (public.eh_membro(espaco_id));
drop policy if exists membros_sair on public.membros;
create policy membros_sair on public.membros for delete
  using ((usuario_id = auth.uid() and papel <> 'dono') or (public.eh_dono(espaco_id) and papel <> 'dono'));

do $$
declare t text;
begin
  foreach t in array array['categorias','recorrencias','receitas','despesas','orcamentos','configuracoes'] loop
    execute format('drop policy if exists %1$s_membros on public.%1$s', t);
    execute format('create policy %1$s_membros on public.%1$s for all using (public.eh_membro(espaco_id)) with check (public.eh_membro(espaco_id))', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 4. Funções usadas pelo site
-- ---------------------------------------------------------------------
create or replace function public.semear_categorias(e uuid) returns void
language sql security definer set search_path = public as $$
  insert into categorias (espaco_id, nome, ordem, alimentacao) values
    (e,'Moradia',1,false),(e,'Água, energia e internet',2,false),(e,'Alimentação',3,true),
    (e,'Marmitas compradas',4,true),(e,'Supermercado',5,true),(e,'Transporte',6,false),
    (e,'Saúde',7,false),(e,'Higiene e cuidados pessoais',8,false),(e,'Vestuário',9,false),
    (e,'Lazer',10,false),(e,'Assinaturas',11,false),(e,'Dívidas e parcelas',12,false),
    (e,'Educação',13,false),(e,'Outras despesas',14,false);
$$;

-- Cria perfil e espaço pessoal (chamada no cadastro e, por garantia, ao entrar)
create or replace function public.garantir_espaco_pessoal() returns uuid
language plpgsql security definer set search_path = public as $$
declare e uuid; u uuid := auth.uid(); n text;
begin
  if u is null then raise exception 'Sessão inválida'; end if;
  select id into e from espacos where dono = u and tipo = 'pessoal' limit 1;
  if e is null then
    select coalesce(raw_user_meta_data->>'nome', split_part(email,'@',1)) into n from auth.users where id = u;
    insert into perfis (id, nome) values (u, n) on conflict (id) do nothing;
    insert into espacos (nome, tipo, dono, codigo_convite) values ('Pessoal', 'pessoal', u, null) returning id into e;
    insert into membros (espaco_id, usuario_id, papel) values (e, u, 'dono');
    perform semear_categorias(e);
  end if;
  return e;
end $$;

create or replace function public.ao_cadastrar() returns trigger
language plpgsql security definer set search_path = public as $$
declare e uuid;
begin
  insert into perfis (id, nome) values (new.id, coalesce(new.raw_user_meta_data->>'nome', split_part(new.email,'@',1)))
    on conflict (id) do nothing;
  insert into espacos (nome, tipo, dono, codigo_convite) values ('Pessoal', 'pessoal', new.id, null) returning id into e;
  insert into membros (espaco_id, usuario_id, papel) values (e, new.id, 'dono');
  perform semear_categorias(e);
  return new;
end $$;

drop trigger if exists ao_cadastrar on auth.users;
create trigger ao_cadastrar after insert on auth.users for each row execute function public.ao_cadastrar();

create or replace function public.criar_espaco(nome_espaco text) returns uuid
language plpgsql security definer set search_path = public as $$
declare e uuid;
begin
  if auth.uid() is null then raise exception 'Sessão inválida'; end if;
  insert into espacos (nome, tipo, dono) values (trim(nome_espaco), 'compartilhado', auth.uid()) returning id into e;
  insert into membros (espaco_id, usuario_id, papel) values (e, auth.uid(), 'dono');
  perform semear_categorias(e);
  return e;
end $$;

create or replace function public.entrar_no_espaco(codigo text) returns uuid
language plpgsql security definer set search_path = public as $$
declare e uuid;
begin
  if auth.uid() is null then raise exception 'Sessão inválida'; end if;
  select id into e from espacos where codigo_convite = upper(trim(codigo)) and tipo = 'compartilhado';
  if e is null then raise exception 'Código de convite não encontrado'; end if;
  insert into membros (espaco_id, usuario_id, papel) values (e, auth.uid(), 'membro') on conflict do nothing;
  return e;
end $$;

create or replace function public.novo_codigo_convite(e uuid) returns text
language plpgsql security definer set search_path = public as $$
declare c text := upper(encode(gen_random_bytes(5),'hex'));
begin
  if not eh_dono(e) then raise exception 'Somente quem criou o espaço pode gerar um novo código'; end if;
  update espacos set codigo_convite = c where id = e and tipo = 'compartilhado';
  return c;
end $$;

create or replace function public.lista_membros(e uuid)
returns table (usuario_id uuid, nome text, email text, papel text)
language sql stable security definer set search_path = public as $$
  select m.usuario_id, p.nome, u.email::text, m.papel
  from membros m join auth.users u on u.id = m.usuario_id left join perfis p on p.id = m.usuario_id
  where m.espaco_id = e and eh_membro(e)
  order by m.papel desc, p.nome;
$$;

-- Exclui a conta de quem está conectado, o espaço pessoal e os espaços que ela criou
create or replace function public.excluir_minha_conta() returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Sessão inválida'; end if;
  delete from espacos where dono = auth.uid();
  delete from auth.users where id = auth.uid();
end $$;

revoke all on function public.semear_categorias(uuid) from public, anon, authenticated;
grant execute on function public.garantir_espaco_pessoal() to authenticated;
grant execute on function public.criar_espaco(text) to authenticated;
grant execute on function public.entrar_no_espaco(text) to authenticated;
grant execute on function public.novo_codigo_convite(uuid) to authenticated;
grant execute on function public.lista_membros(uuid) to authenticated;
grant execute on function public.excluir_minha_conta() to authenticated;

-- ---------------------------------------------------------------------
-- 5. Sincronização em tempo real entre celular e computador
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['categorias','recorrencias','receitas','despesas','orcamentos','configuracoes'] loop
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- Pronto. Deve aparecer "Success. No rows returned".
