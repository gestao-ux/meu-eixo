-- =====================================================================
-- MEU EIXO · Atualização 011: contas, transferências, ajustes e estornos
-- Execute uma única vez em: Supabase › SQL Editor › New query › Run
-- Só acrescenta tabelas e campos. Nenhum dado existente é apagado.
-- =====================================================================

-- Contas onde o dinheiro fica: banco, poupança, carteira, investimento.
create table if not exists public.contas (
  id uuid primary key default gen_random_uuid(),
  espaco_id uuid not null references public.espacos on delete cascade,
  nome text not null,
  tipo text not null default 'corrente' check (tipo in ('corrente','poupanca','carteira','investimento','outra')),
  saldo_inicial numeric(12,2) not null default 0,
  data_saldo date not null default current_date,   -- saldo no início deste dia
  padrao boolean not null default false,           -- usada quando o lançamento não informa a conta
  ativa boolean not null default true,
  ordem int not null default 0,
  criado_em timestamptz not null default now()
);
create index if not exists contas_espaco on public.contas (espaco_id);

-- Em qual conta o dinheiro saiu ou entrou
alter table public.despesas add column if not exists conta_id uuid references public.contas on delete set null;
alter table public.receitas add column if not exists conta_id uuid references public.contas on delete set null;

-- Estorno: dinheiro de volta de uma despesa. Não conta como receita;
-- abate o gasto da despesa original.
alter table public.receitas add column if not exists natureza text not null default 'receita';
alter table public.receitas drop constraint if exists receitas_natureza_check;
alter table public.receitas add constraint receitas_natureza_check check (natureza in ('receita','estorno'));
alter table public.receitas add column if not exists estorno_de uuid references public.despesas on delete set null;

-- Transferência entre contas e ajuste de saldo. Não entram em receitas nem despesas.
create table if not exists public.transferencias (
  id uuid primary key default gen_random_uuid(),
  espaco_id uuid not null references public.espacos on delete cascade,
  tipo text not null default 'transferencia' check (tipo in ('transferencia','ajuste')),
  conta_origem uuid references public.contas on delete cascade,
  conta_destino uuid references public.contas on delete cascade,
  valor numeric(12,2) not null check (valor <> 0),   -- no ajuste pode ser negativo
  data date not null,
  descricao text default '',
  obs text default '',
  criado_por uuid default auth.uid() references auth.users on delete set null,
  criado_em timestamptz not null default now(),
  check ((tipo = 'transferencia' and conta_origem is not null and conta_destino is not null and conta_origem <> conta_destino and valor > 0)
      or (tipo = 'ajuste' and conta_destino is not null))
);
create index if not exists transferencias_espaco on public.transferencias (espaco_id, data);

alter table public.contas enable row level security;
alter table public.transferencias enable row level security;

do $$
declare t text;
begin
  foreach t in array array['contas','transferencias'] loop
    execute format('drop policy if exists %1$s_membros on public.%1$s', t);
    execute format('create policy %1$s_membros on public.%1$s for all to authenticated using (public.eh_membro(espaco_id)) with check (public.eh_membro(espaco_id))', t);
    execute format('grant select, insert, update, delete on public.%1$s to authenticated', t);
    execute format('revoke all on public.%1$s from anon', t);
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- O saldo inicial já informado em Configurações vira a "Conta principal"
-- (uma única vez por espaço; o valor antigo continua guardado).
insert into public.contas (espaco_id, nome, tipo, saldo_inicial, data_saldo, padrao, ordem)
select c.espaco_id, 'Conta principal', 'corrente', c.saldo_inicial, c.data_saldo, true, 1
from public.configuracoes c
where c.saldo_inicial is not null and c.data_saldo is not null
  and not exists (select 1 from public.contas x where x.espaco_id = c.espaco_id);

-- Pronto. Deve aparecer "Success. No rows returned".
