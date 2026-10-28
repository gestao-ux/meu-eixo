-- =====================================================================
-- MEU EIXO · Atualização 013: ciclos financeiros configuráveis
-- Execute uma única vez em: Supabase › SQL Editor › New query › Run
-- Os dias 10 e 20 deixam de ser regra fixa e passam a ser a configuração
-- atual de "datas de recebimento". Nada é apagado: o campo antigo
-- "periodo" continua guardado; os valores 10 e 20 são copiados para a
-- nova estrutura.
-- =====================================================================

-- Datas de recebimento do espaço (quantas forem necessárias):
-- [{"id":"e10","nome":"","regra":"dia","dia":10,"ativo":true}, ...]
-- regra: dia (dia fixo) | primeiro_util | ultimo_util | util (N-ésimo dia útil)
alter table public.configuracoes add column if not exists entradas jsonb not null default '[]'::jsonb;

-- Ligação com a entrada: na receita, diz que ela É aquela entrada (ex.: o salário);
-- nas contas, diz com qual entrada você escolheu pagar (vazio = pela data de vencimento).
alter table public.receitas     add column if not exists entrada_id text;
alter table public.despesas     add column if not exists entrada_id text;
alter table public.recorrencias add column if not exists entrada_id text;
alter table public.dividas      add column if not exists entrada_id text;
alter table public.cartoes      add column if not exists entrada_id text;

-- Configuração atual (dias 10 e 20) para os espaços que já usavam esses períodos
insert into public.configuracoes (espaco_id)
select e.id from public.espacos e
where not exists (select 1 from public.configuracoes c where c.espaco_id = e.id)
  and (exists (select 1 from public.receitas r where r.espaco_id = e.id and r.periodo in ('10','20'))
    or exists (select 1 from public.despesas d where d.espaco_id = e.id and d.periodo in ('10','20'))
    or exists (select 1 from public.recorrencias t where t.espaco_id = e.id and t.periodo in ('10','20')));

update public.configuracoes c
set entradas = '[{"id":"e10","nome":"","regra":"dia","dia":10,"ativo":true},{"id":"e20","nome":"","regra":"dia","dia":20,"ativo":true}]'::jsonb
where c.entradas = '[]'::jsonb
  and (exists (select 1 from public.receitas r where r.espaco_id = c.espaco_id and r.periodo in ('10','20'))
    or exists (select 1 from public.despesas d where d.espaco_id = c.espaco_id and d.periodo in ('10','20'))
    or exists (select 1 from public.recorrencias t where t.espaco_id = c.espaco_id and t.periodo in ('10','20')));

-- Contas, dívidas e cartões que você tinha colocado no período 10 ou 20
update public.despesas     set entrada_id = 'e' || periodo where periodo in ('10','20') and entrada_id is null;
update public.recorrencias set entrada_id = 'e' || periodo where periodo in ('10','20') and entrada_id is null;
update public.dividas      set entrada_id = 'e' || periodo where periodo in ('10','20') and entrada_id is null;
update public.cartoes      set entrada_id = 'e' || periodo where periodo in ('10','20') and entrada_id is null;

-- Receitas: ficam ligadas à entrada as recorrentes e as de salário/comissões;
-- as demais passam a ser eventuais (não mudam o calendário de recebimentos).
update public.receitas set entrada_id = 'e' || periodo
where periodo in ('10','20') and entrada_id is null
  and (recorrencia_id is not null or origem in ('Salário','Comissões'));

-- Pronto. Deve aparecer "Success. No rows returned".
