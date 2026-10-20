-- =====================================================================
-- MEU EIXO · Atualização 010: foto de perfil
-- Execute uma única vez em: Supabase › SQL Editor › New query › Run
-- =====================================================================

-- Foto da pessoa, já reduzida no aparelho (256 x 256, cerca de 20 KB).
-- Só a própria pessoa lê e altera (regra perfis_proprio já existente).
alter table public.perfis add column if not exists foto text;

-- Pronto. Deve aparecer "Success. No rows returned".
