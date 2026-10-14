-- =====================================================================
-- MEU EIXO · Atualização 005: compras de mercado e histórico de preços
-- Execute uma única vez em: Supabase › SQL Editor › New query › Run
-- =====================================================================

create table if not exists public.compras (
  id uuid primary key default gen_random_uuid(),
  espaco_id uuid not null references public.espacos on delete cascade,
  data date not null,
  estabelecimento text default '',
  cnpj text default '',
  total numeric(12,2) not null default 0,
  desconto numeric(12,2) not null default 0,
  forma_pagamento text default '',
  chave_acesso text,
  comprovante text,
  comprovante_hash text,
  despesa_ids uuid[] default '{}',
  criado_por uuid default auth.uid() references auth.users on delete set null,
  criado_em timestamptz not null default now()
);
create index if not exists compras_espaco on public.compras (espaco_id, data);
create unique index if not exists compras_chave on public.compras (espaco_id, chave_acesso) where chave_acesso is not null and chave_acesso <> '';

create table if not exists public.compra_itens (
  id uuid primary key default gen_random_uuid(),
  compra_id uuid not null references public.compras on delete cascade,
  espaco_id uuid not null references public.espacos on delete cascade,
  descricao text not null,
  destino text not null default 'alimento',   -- alimento | outro_alimento | limpeza | higiene | outros | ignorar
  alimento_id text,                           -- id do catálogo do Meu Eixo
  quantidade numeric(12,3) not null default 1,
  unidade text default 'UN',
  valor_total numeric(12,2) not null default 0,
  gramas numeric(12,1),                       -- peso total comprado, quando identificável
  unidades numeric(12,2)                      -- contagem (ovos, frutas, latas), quando identificável
);
create index if not exists compra_itens_compra on public.compra_itens (compra_id);
create index if not exists compra_itens_alimento on public.compra_itens (espaco_id, alimento_id);

create table if not exists public.precos (
  id uuid primary key default gen_random_uuid(),
  espaco_id uuid not null references public.espacos on delete cascade,
  alimento_id text not null,
  data date not null,
  valor numeric(12,2) not null,               -- valor pago pela quantidade abaixo
  gramas numeric(12,1),
  unidades numeric(12,2),
  origem text not null default 'cupom' check (origem in ('cupom','manual','pesquisa')),
  estabelecimento text default '',
  fonte text default '',                      -- link ou descrição da fonte, quando for pesquisa
  compra_item_id uuid references public.compra_itens on delete cascade,
  criado_em timestamptz not null default now()
);
create index if not exists precos_alimento on public.precos (espaco_id, alimento_id, data desc);

alter table public.compras enable row level security;
alter table public.compra_itens enable row level security;
alter table public.precos enable row level security;

do $$
declare t text;
begin
  foreach t in array array['compras','compra_itens','precos'] loop
    execute format('drop policy if exists %1$s_membros on public.%1$s', t);
    execute format('create policy %1$s_membros on public.%1$s for all to authenticated using (public.eh_membro(espaco_id)) with check (public.eh_membro(espaco_id))', t);
    execute format('grant select, insert, update, delete on public.%1$s to authenticated', t);
    execute format('revoke all on public.%1$s from anon', t);
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- Categoria "Limpeza" para os produtos de limpeza dos cupons (cria nos espaços que ainda não têm)
insert into public.categorias (espaco_id, nome, ordem, alimentacao)
select e.id, 'Limpeza', 15, false from public.espacos e
where not exists (select 1 from public.categorias c where c.espaco_id = e.id and lower(c.nome) = 'limpeza');

-- Contas novas já nascem com a categoria Limpeza
create or replace function public.semear_categorias(e uuid) returns void
language sql security definer set search_path = public as $$
  insert into categorias (espaco_id, nome, ordem, alimentacao) values
    (e,'Moradia',1,false),(e,'Água, energia e internet',2,false),(e,'Alimentação',3,true),
    (e,'Marmitas compradas',4,true),(e,'Supermercado',5,true),(e,'Transporte',6,false),
    (e,'Saúde',7,false),(e,'Higiene e cuidados pessoais',8,false),(e,'Vestuário',9,false),
    (e,'Lazer',10,false),(e,'Assinaturas',11,false),(e,'Dívidas e parcelas',12,false),
    (e,'Educação',13,false),(e,'Outras despesas',14,false),(e,'Limpeza',15,false);
$$;
revoke all on function public.semear_categorias(uuid) from public, anon, authenticated;

-- Pronto. Deve aparecer "Success. No rows returned".
