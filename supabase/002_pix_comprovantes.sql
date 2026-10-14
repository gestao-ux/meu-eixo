-- =====================================================================
-- MEU EIXO · Atualização 002: chave Pix e comprovantes
-- Execute uma única vez em: Supabase › SQL Editor › New query › Run
-- Pode ser executado de novo com segurança.
-- =====================================================================

-- 1. Chave Pix e comprovante nos lançamentos
alter table public.despesas     add column if not exists chave_pix text default '';
alter table public.despesas     add column if not exists pix_copia_cola text default '';
alter table public.despesas     add column if not exists comprovante text;
alter table public.despesas     add column if not exists comprovante_hash text;
alter table public.receitas     add column if not exists comprovante text;
alter table public.receitas     add column if not exists comprovante_hash text;
alter table public.recorrencias add column if not exists chave_pix text default '';
alter table public.recorrencias add column if not exists pix_copia_cola text default '';

create index if not exists despesas_hash on public.despesas (espaco_id, comprovante_hash);
create index if not exists receitas_hash on public.receitas (espaco_id, comprovante_hash);

-- 2. Pasta privada para os arquivos de comprovante (até 10 MB cada)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('comprovantes', 'comprovantes', false, 10485760,
        array['image/jpeg','image/png','image/webp','image/heic','image/heif','application/pdf'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Cada arquivo fica em "<id do espaço>/<arquivo>"; só membros do espaço acessam.
create or replace function public.eh_membro_pasta(pasta text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from membros where espaco_id::text = pasta and usuario_id = auth.uid());
$$;
grant execute on function public.eh_membro_pasta(text) to authenticated;

drop policy if exists comprovantes_ler on storage.objects;
create policy comprovantes_ler on storage.objects for select to authenticated
  using (bucket_id = 'comprovantes' and public.eh_membro_pasta((storage.foldername(name))[1]));

drop policy if exists comprovantes_enviar on storage.objects;
create policy comprovantes_enviar on storage.objects for insert to authenticated
  with check (bucket_id = 'comprovantes' and public.eh_membro_pasta((storage.foldername(name))[1]));

drop policy if exists comprovantes_excluir on storage.objects;
create policy comprovantes_excluir on storage.objects for delete to authenticated
  using (bucket_id = 'comprovantes' and public.eh_membro_pasta((storage.foldername(name))[1]));

-- Pronto. Deve aparecer "Success. No rows returned".
