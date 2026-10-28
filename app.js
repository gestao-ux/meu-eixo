/* =====================================================================
   MEU EIXO · aplicação web
   Banco, login e sincronização: Supabase. Hospedagem: Vercel.
   ===================================================================== */
(() => {
'use strict';

/* ---------- utilidades ---------- */
const $ = s => document.querySelector(s);
const BRL = new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'});
const money = v => BRL.format(+v||0);
const esc = s => String(s ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const r2 = v => Math.round((+v||0)*100)/100;
const sum = (arr,f) => r2(arr.reduce((a,x)=>a+(+f(x)||0),0));
const MESES = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
function hoje(){ return new Intl.DateTimeFormat('en-CA',{timeZone:'America/Cuiaba',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()); }
const mesLabel = ym => { const [y,m]=ym.split('-'); return MESES[+m-1]+' '+y; };
const mesCurto = ym => { const [y,m]=ym.split('-'); return MESES[+m-1].slice(0,3)+'/'+y.slice(2); };
function addMes(ym,n){ let [y,m]=ym.split('-').map(Number); m+=n; while(m>12){m-=12;y++} while(m<1){m+=12;y--} return y+'-'+String(m).padStart(2,'0'); }
function addMesData(d,n){ const dd=+d.slice(8,10); const ym=addMes(d.slice(0,7),n); const [Y,M]=ym.split('-').map(Number); const last=new Date(Y,M,0).getDate(); return ym+'-'+String(Math.min(dd,last)).padStart(2,'0'); }
const dataBR = d => d ? d.slice(8,10)+'/'+d.slice(5,7)+'/'+d.slice(0,4) : '—';
const dataCurta = d => d ? d.slice(8,10)+'/'+d.slice(5,7) : '—';
function diasEntre(a,b){ return Math.round((Date.parse(b+'T12:00:00Z')-Date.parse(a+'T12:00:00Z'))/864e5); }
function parseValor(s){ if(typeof s==='number') return s; s=String(s||'').trim().replace(/[R$\s]/g,''); if(!s) return NaN;
  if(!s.includes(',') && /^\d{1,3}(\.\d{3})+$/.test(s)) s=s.replace(/\./g,'');
  if(s.includes(',')) s=s.replace(/\./g,'').replace(',','.'); const n=Number(s); return isFinite(n)?n:NaN; }
const fmtInput = v => (v===undefined||v===null||v==='') ? '' : r2(v).toFixed(2).replace('.',',');
const uid = () => Date.now().toString(36)+Math.random().toString(36).slice(2,7);
const ls = { get(k){ try{ return localStorage.getItem(k); }catch(_){ return null; } }, set(k,v){ try{ localStorage.setItem(k,v); }catch(_){} }, del(k){ try{ localStorage.removeItem(k); }catch(_){} } };

/* ---------- Supabase ---------- */
const CFG = window.MEU_EIXO_CONFIG || {};
const LEMBRAR = 'meuEixo.lembrar';
// Sessão: "Manter conectada" guarda no aparelho; caso contrário, só até fechar o navegador.
const armazenamento = {
  getItem(k){ try{ return localStorage.getItem(k) ?? sessionStorage.getItem(k); }catch(_){ return null; } },
  setItem(k,v){ try{ if(ls.get(LEMBRAR)==='0'){ sessionStorage.setItem(k,v); localStorage.removeItem(k); } else { localStorage.setItem(k,v); sessionStorage.removeItem(k); } }catch(_){} },
  removeItem(k){ try{ localStorage.removeItem(k); sessionStorage.removeItem(k); }catch(_){} }
};
const configurado = !!(CFG.SUPABASE_URL && CFG.SUPABASE_ANON_KEY && window.supabase);
const sb = configurado ? window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY, { auth:{ persistSession:true, autoRefreshToken:true, detectSessionInUrl:true, storage:armazenamento } }) : null;

const toSnake = k => k.replace(/[A-Z]/g,m=>'_'+m.toLowerCase());
const toCamel = k => k.replace(/_([a-z])/g,(_,c)=>c.toUpperCase());
const NULOS = new Set(['conta_id','estorno_de','data_compra','vencimento','data_pagamento','data_prevista','data_efetiva','data_saldo','categoria','recorrencia_id','grupo_parcela','parcela_atual','valor_total','valor_recebido','comprovante','comprovante_hash','divida_id','quitada_em','prazo','parcela','dia','valor_alvo']);
function toDb(o){ const r={}; for(const [k,v] of Object.entries(o)){ if(v===undefined || k==='id') continue; const sk=toSnake(k); r[sk]=(v===''&&NULOS.has(sk))?null:v; } return r; }
function fromDb(o){ const r={}; for(const [k,v] of Object.entries(o)) r[toCamel(k)]=v; return r; }
const TABELAS = { receitas:'id', despesas:'id', categorias:'id', recorrencias:'id', orcamentos:'mes', configuracoes:'espaco_id' };

/* ---------- estado ---------- */
const S = { rec:[], desp:[], cats:[], recor:[], orc:{}, cfg:{}, espacos:[], esp:null, user:null, perfil:null,
  mes:hoje().slice(0,7), view:'inicio', tab:'despesas', filtro:{sit:'',cat:''}, fase:'iniciando', auth:'login', authMsg:'', canal:null, membros:null };

const NAV = [
  {id:'inicio',t:'Início',ic:'M3 11.5 12 4l9 7.5M5.5 10v9.5h13V10'},
  {id:'financeiro',t:'Lançamentos',ic:'M3 7h18v12H3zM3 11h18M7 15h3'},
  {id:'planejamento',t:'Planejamento',ic:'M4 4h16v16H4zM4 9h16M9 4v16'},
  {id:'relatorios',t:'Relatórios',ic:'M5 20V10M12 20V4M19 20v-7'},
  {id:'metas',t:'Metas',ic:'M12 21a9 9 0 1 1 0-18 9 9 0 0 1 0 18zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zM12 12h.01'},
  {id:'config',t:'Configurações',ic:'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19 12a7 7 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7 7 0 0 0-2-1.2L14 3h-4l-.5 2.6a7 7 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6A7 7 0 0 0 5 12c0 .4 0 .8.1 1.2l-2 1.6 2 3.4 2.4-1a7 7 0 0 0 2 1.2L10 21h4l.5-2.6a7 7 0 0 0 2-1.2l2.4 1 2-3.4-2-1.6c.1-.4.1-.8.1-1.2z'}
];
const ORIGENS = ['Salário','Comissões','Renda extra','Reembolso','Outra'];
const FORMAS = ['Pix','Débito','Crédito','Boleto','Dinheiro','Transferência','Débito automático','Outra'];
const SIT_D = {pendente:'Pendente',prevista:'Programado',paga:'Pago',atrasada:'Vencido',cancelada:'Cancelado'};
const SIT_R = {prevista:'Programado',recebida:'Recebido',atrasada:'Atrasado',cancelada:'Cancelado'};

/* ---------- regras de negócio ---------- */
const compDesp = d => (d.vencimento||d.dataCompra||'').slice(0,7);
const compRec = r => (r.dataPrevista||r.dataEfetiva||'').slice(0,7);
// Pago · Vencido · Programado (meses seguintes ou marcado assim) · Pendente (mês atual)
function sitDesp(d){ if(d.situacao==='paga'||d.situacao==='cancelada') return d.situacao; const h=hoje(); if(d.vencimento && d.vencimento<h) return 'atrasada'; if(d.situacao==='prevista' || (d.vencimento||'').slice(0,7)>h.slice(0,7)) return 'prevista'; return 'pendente'; }
function sitRec(r){ if(r.situacao==='recebida'||r.situacao==='cancelada') return r.situacao; if(r.dataPrevista && r.dataPrevista<hoje()) return 'atrasada'; return 'prevista'; }
const ativa = x => x.situacao!=='cancelada';
const despMes = ym => S.desp.filter(d=>compDesp(d)===ym);
const recMes = ym => S.rec.filter(r=>compRec(r)===ym && r.natureza!=='estorno');
const recEsperado = r => r.situacao==='recebida' ? (+r.valorRecebido||0) : (+r.valorPrevisto||0);
const catById = id => S.cats.find(c=>c.id===id);
const catNome = id => catById(id)?.nome || 'Sem categoria';
const ehAlimentacao = d => !!catById(d.categoria)?.alimentacao;
const espAtual = () => S.espacos.find(e=>e.id===S.esp);
const souDono = () => espAtual()?.dono === S.user?.id;

function resumo(ym){
  const D = despMes(ym).filter(ativa), R = recMes(ym).filter(ativa);
  const out = {
    recPrev: sum(R,r=>r.valorPrevisto), recReal: sum(R.filter(r=>r.situacao==='recebida'),r=>r.valorRecebido), recEsp: sum(R,recEsperado),
    despTot: sum(D,valorLiq), despPaga: sum(D.filter(d=>d.situacao==='paga'),d=>d.valor),
    fixas: sum(D.filter(d=>d.comportamento==='fixa'),valorLiq), variaveis: sum(D.filter(d=>d.comportamento!=='fixa'),valorLiq),
    parcelas: sum(D.filter(d=>(+d.parcelas||1)>1),d=>d.valor), pend: D.filter(d=>d.situacao!=='paga'), D, R };
  out.pendVal = sum(out.pend,d=>d.valor); out.saldoPrev = r2(out.recEsp - out.despTot); out.saldoReal = r2(out.recReal - out.despPaga);
  return out;
}
function saldoDisponivel(){
  if(temContas() && contasAtivas().length) return saldoEmConta();
  const c=S.cfg; if(c.saldoInicial===undefined||c.saldoInicial===null||!c.dataSaldo) return null;
  let s=+c.saldoInicial;
  for(const r of S.rec) if(r.situacao==='recebida' && r.dataEfetiva && r.dataEfetiva>=c.dataSaldo) s+= +r.valorRecebido||0;
  for(const d of S.desp) if(d.situacao==='paga' && d.dataPagamento && d.dataPagamento>=c.dataSaldo) s-= +d.valor||0;
  return r2(s);
}
function proximoRecebimento(){ const h=hoje(), d=+h.slice(8,10), ym=h.slice(0,7); if(d<10) return ym+'-10'; if(d<20) return ym+'-20'; return addMes(ym,1)+'-10'; }
function periodo(ym,p){
  const R=recMes(ym).filter(r=>ativa(r)&&(r.periodo||'')===p), D=despMes(ym).filter(d=>ativa(d)&&(d.periodo||'')===p);
  const esper=sum(R,recEsperado), comp=sum(D,d=>d.valor), pagos=sum(D.filter(d=>d.situacao==='paga'),d=>d.valor);
  return {R,D,prev:sum(R,r=>r.valorPrevisto),receb:sum(R.filter(r=>r.situacao==='recebida'),r=>r.valorRecebido),esper,comp,pagos,pend:r2(comp-pagos),saldo:r2(esper-comp)};
}
const parcelasFuturas = () => S.desp.filter(d=>(+d.parcelas||1)>1 && ativa(d) && d.situacao!=='paga');
const orcamentoMes = ym => S.orc[ym]?.limites || {};
const gastoCat = (ym,catId) => sum(despMes(ym).filter(d=>ativa(d)&&d.categoria===catId),valorLiq);
const ehRecR = t => t?.tipo==='receita';
const recorD = () => S.recor.filter(t=>!ehRecR(t));
const lancsRec = t => ehRecR(t) ? S.rec.filter(r=>r.recorrenciaId===t.id) : S.desp.filter(d=>d.recorrenciaId===t.id);
const compL = (t,x) => ehRecR(t) ? compRec(x) : compDesp(x);
const quitadoL = (t,x) => ehRecR(t) ? x.situacao==='recebida' : x.situacao==='paga';
const recorrentesFaltando = ym => recorD().filter(t=>t.ativo!==false && (t.inicio||'0000-00')<=ym && !(t.geradoAte && t.geradoAte>=ym) && !S.desp.some(d=>d.recorrenciaId===t.id && compDesp(d)===ym));

function alertas(ym){
  const a=[], h=hoje();
  const atras=S.desp.filter(d=>sitDesp(d)==='atrasada');
  if(atras.length) a.push({k:'danger',t:`${atras.length} ${atras.length>1?'contas vencidas':'conta vencida'} sem pagamento registrado (${money(sum(atras,d=>d.valor))}).`,h:'Se já pagou, marque como paga para manter o saldo correto. Se não, priorize no próximo recebimento.'});
  const breve=S.desp.filter(d=>['pendente','prevista'].includes(sitDesp(d))&&d.vencimento&&diasEntre(h,d.vencimento)<=3);
  if(breve.length) a.push({k:'warn',t:`${breve.length} ${breve.length>1?'contas vencem':'conta vence'} nos próximos 3 dias: ${breve.slice(0,3).map(d=>esc(d.descricao)).join(', ')}${breve.length>3?'…':''}.`,h:'Confira se o saldo do período cobre esses pagamentos.'});
  const p10=periodo(ym,'10'), p20=periodo(ym,'20');
  if(p10.comp>0 && p10.comp>p10.esper) a.push({k:'warn',t:`O período do dia 10 está sobrecarregado em ${money(p10.comp-p10.esper)}.`,h:'Veja no Planejamento quais contas podem ir para o dia 20. Nada é movido sem a sua decisão.'});
  if((p20.comp>0||p20.esper>0) && p10.saldo+p20.saldo<0) a.push({k:'warn',t:`O período do dia 20 fecha negativo em ${money(Math.abs(p10.saldo+p20.saldo))}.`,h:'Revise gastos variáveis antes de assumir novos compromissos.'});
  const lim=orcamentoMes(ym);
  for(const c of S.cats){ const L=+lim[c.id]; if(!L) continue; const g=gastoCat(ym,c.id);
    if(g>L) a.push({k:'danger',t:`${esc(c.nome)} passou do orçamento: ${money(g)} de ${money(L)}.`,h:'Avalie o que pode ser adiado ou reduzido nesta categoria até o fim do mês.'});
    else if(g>=L*.85) a.push({k:'warn',t:`${esc(c.nome)} já usou ${Math.round(g/L*100)}% do orçamento.`,h:`Restam ${money(L-g)} para o mês.`}); }
  const sd=saldoDisponivel();
  if(sd!==null && ym===h.slice(0,7)){ const pr=proximoRecebimento(); const ate=S.desp.filter(d=>ativa(d)&&d.situacao!=='paga'&&d.vencimento&&d.vencimento<pr);
    const prev=r2(sd-sum(ate,d=>d.valor)); if(prev<0) a.push({k:'danger',t:`O saldo previsto até ${dataCurta(pr)} fica negativo (${money(prev)}).`,h:'As contas que vencem antes do próximo recebimento superam o saldo em conta.'}); }
  a.push(...alertasMetas(ym));
  const rm=recorrentesFaltando(ym);
  if(rm.length) a.push({k:'',t:`${rm.length} ${rm.length>1?'contas fixas ainda não foram lançadas':'conta fixa ainda não foi lançada'} em ${mesLabel(ym)}.`,h:'Use “Lançar contas fixas” no Planejamento para gerar esses compromissos.'});
  return a;
}

/* ---------- acesso a dados ---------- */
function erroAmigavel(e){
  const m=(e?.message||'').toLowerCase();
  if(m.includes('invalid login')) return 'E-mail ou senha incorretos.';
  if(m.includes('email not confirmed')) return 'Confirme seu e-mail pelo link que enviamos antes de entrar.';
  if(m.includes('already registered')||m.includes('already been registered')) return 'Este e-mail já tem conta. Use “Entrar” ou “Esqueci minha senha”.';
  if(m.includes('password should be')||m.includes('weak')) return 'A senha é fraca. Use pelo menos 8 caracteres, misturando letras e números.';
  if(m.includes('rate limit')||m.includes('too many')) return 'Muitas tentativas seguidas. Aguarde alguns minutos e tente de novo.';
  if(m.includes('código de convite')) return 'Código de convite não encontrado. Confira as letras e números.';
  if(/(conferido|favorecido)/.test(m) && /column|coluna|schema cache/.test(m)) return 'Falta executar a atualização 006_lancamento_rapido.sql no Supabase (SQL Editor).';
  if(/(divida_id|dividas|\bmetas\b)/.test(m) && /column|coluna|relation|schema cache|does not exist/.test(m)) return 'Falta executar a atualização 007_dividas_metas.sql no Supabase (SQL Editor).';
  if(/(compras|precos|compra_itens)/.test(m) && /relation|schema cache|does not exist/.test(m)) return 'Falta executar a atualização 005_compras_precos.sql no Supabase (SQL Editor).';
  if(m.includes('failed to fetch')||m.includes('network')) return 'Sem conexão com o servidor. Verifique a internet e tente de novo.';
  return e?.message || 'Algo não saiu como esperado. Tente novamente.';
}
function dbErr(e){ console.error(e); toast(erroAmigavel(e)); }
const chk = ({data,error}) => { if(error) throw error; return data; };

async function buscarTudo(t){
  let out=[], de=0; const chave=TABELAS[t];
  for(;;){ const data=chk(await sb.from(t).select('*').eq('espaco_id',S.esp).order(chave).range(de,de+999)); out=out.concat(data); if(data.length<1000) break; de+=1000; }
  return out.map(fromDb);
}
function aplicar(t,rows){
  if(t==='receitas') S.rec=rows;
  else if(t==='despesas') S.desp=rows;
  else if(t==='categorias') S.cats=rows.sort((a,b)=>(a.ordem??99)-(b.ordem??99)||a.nome.localeCompare(b.nome,'pt'));
  else if(t==='recorrencias') S.recor=rows;
  else if(t==='orcamentos') S.orc=Object.fromEntries(rows.map(r=>[r.mes,r]));
  else if(t==='configuracoes') S.cfg=rows[0]||{};
}
async function recarregar(t){ const esp=S.esp; const rows=await buscarTudo(t); if(esp===S.esp){ aplicar(t,rows); schedule(); } }
const pendentes=new Set(); let tRecarga=null;
function recarregarDepois(t){ pendentes.add(t); clearTimeout(tRecarga); tRecarga=setTimeout(async()=>{ const ts=[...pendentes]; pendentes.clear(); try{ for(const x of ts) await recarregar(x); }catch(e){ console.error(e); } },400); }

async function inserir(t,rows){ const arr=(Array.isArray(rows)?rows:[rows]).map(r=>({...toDb(r),espaco_id:S.esp})); const data=chk(await sb.from(t).insert(arr).select('id')); await recarregar(t); return data?.[0]?.id; }
async function atualizar(t,id,patch){ chk(await sb.from(t).update(toDb(patch)).eq('id',id).eq('espaco_id',S.esp)); await recarregar(t); }
async function remover(t,ids){ ids=Array.isArray(ids)?ids:[ids]; chk(await sb.from(t).delete().in('id',ids).eq('espaco_id',S.esp)); await recarregar(t); }
async function salvarOrc(mes,limites){ chk(await sb.from('orcamentos').upsert({espaco_id:S.esp,mes,limites},{onConflict:'espaco_id,mes'})); await recarregar('orcamentos'); }
async function salvarCfg(p){ chk(await sb.from('configuracoes').upsert({espaco_id:S.esp,...toDb(p)},{onConflict:'espaco_id'})); await recarregar('configuracoes'); }

async function carregarEspacos(){
  const data=chk(await sb.from('espacos').select('*').order('criado_em'));
  S.espacos=data.map(fromDb).sort((a,b)=>(a.tipo==='pessoal'?-1:1)-(b.tipo==='pessoal'?-1:1));
}
async function abrirEspaco(id){
  S.esp=id; ls.set('meuEixo.espaco',id); S.membros=null; S.fase='carregando'; render();
  if(S.canal){ sb.removeChannel(S.canal); S.canal=null; }
  const tabs=Object.keys(TABELAS); const res=await Promise.all(tabs.map(buscarTudo));
  if(S.esp!==id) return;
  tabs.forEach((t,i)=>aplicar(t,res[i]));
  S.canal=sb.channel('espaco-'+id);
  for(const t of tabs) S.canal.on('postgres_changes',{event:'*',schema:'public',table:t,filter:'espaco_id=eq.'+id},()=>recarregarDepois(t));
  for(const t of ['compras','precos']) S.canal.on('postgres_changes',{event:'*',schema:'public',table:t,filter:'espaco_id=eq.'+id},()=>{ clearTimeout(S._tcp); S._tcp=setTimeout(carregarComprasPrecos,500); });
  for(const t of ['dividas','metas']) S.canal.on('postgres_changes',{event:'*',schema:'public',table:t,filter:'espaco_id=eq.'+id},()=>{ clearTimeout(S._tmt); S._tmt=setTimeout(carregarMetas,400); });
  S.planos={}; S.listas={}; carregarComprasPrecos(); S.dividas=undefined; S.metas=[]; carregarMetas(); S.contas=undefined; S.transf=[]; S.contasErro=false; carregarContas();
  for(const t of ['contas','transferencias']) S.canal.on('postgres_changes',{event:'*',schema:'public',table:t,filter:'espaco_id=eq.'+id},()=>{ clearTimeout(S._tct); S._tct=setTimeout(carregarContas,400); });
  S.canal.subscribe();
  S.fase='pronto'; render(); garantirRecorrentes();
}
async function entrar(session){
  S.user=session.user; S.fase='carregando'; render();
  try{
    await carregarEspacos();
    if(!S.espacos.some(e=>e.tipo==='pessoal')){ chk(await sb.rpc('garantir_espaco_pessoal')); await carregarEspacos(); }
    const p=chk(await sb.from('perfis').select('nome').eq('id',S.user.id).maybeSingle()); S.perfil=p||{}; S.perfilAl=null;
    sb.from('perfis').select('foto').eq('id',S.user.id).maybeSingle().then(({data,error})=>{ S.fotoOk=!error; if(data?.foto){ S.perfil={...S.perfil,foto:data.foto}; schedule(); } });
    const salvo=ls.get('meuEixo.espaco'); const alvo=S.espacos.find(e=>e.id===salvo)||S.espacos[0];
    await abrirEspaco(alvo.id);
  }catch(e){ dbErr(e); S.fase='erro'; render(); }
}
function sairLocal(){ if(S.canal){ sb.removeChannel(S.canal); S.canal=null; } Object.assign(S,{rec:[],desp:[],cats:[],recor:[],orc:{},cfg:{},espacos:[],esp:null,user:null,perfil:null,perfilAl:undefined,perfilAlErro:false,pesagens:[],quiz:null,planos:undefined,listas:{},compras:[],precos:[],cupom:null,dividas:undefined,metas:[],metasErro:false,contas:undefined,transf:[],contasErro:false,mtTab:'dividas',membros:null,fase:'auth',auth:'login'}); render(); }

/* ---------- render ---------- */
let pend=false; function schedule(){ if(pend) return; pend=true; requestAnimationFrame(()=>{pend=false; render();}); }
const icon = d => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="${d}"/></svg>`;
const I = { plus:'M12 5v14M5 12h14', check:'M5 12.5 10 17l9-10', edit:'M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4', trash:'M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13', down:'M12 4v12M6 11l6 6 6-6M5 20h14', copy:'M8 8h11v11H8zM5 16V5h11', clip:'M20 11.5 12.2 19.3a5 5 0 0 1-7-7L13 4.5a3.3 3.3 0 0 1 4.7 4.7l-7.8 7.8a1.7 1.7 0 0 1-2.4-2.4l7.1-7.1', foto:'M4 8h3l2-3h6l2 3h3v11H4zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z' };
const logo = `<img src="icone.svg" width="56" height="56" alt="">`;
/* personalização: nome no perfil; frase e cor guardadas na conta */
const CORES_AV = {salvia:['Sálvia','#4F8468'],azul:['Azul','#22446A'],terracota:['Terracota','#B4654A'],petroleo:['Petróleo','#1F6F78'],ameixa:['Ameixa','#7A4F6D'],grafite:['Grafite','#3F4A55']};
const FRASE_PADRAO = 'Organize hoje. Viva com mais leveza.';
const meuNome = () => (S.perfil?.nome||'').trim();
const primeiroNome = () => meuNome().split(/\s+/)[0] || '';
const iniciais = n => { const p=(n||'').trim().split(/\s+/).filter(Boolean); return ((p[0]?.[0]||'')+(p.length>1?p[p.length-1][0]:'')).toUpperCase(); };
const minhaFrase = () => (S.user?.user_metadata?.frase||'').trim() || FRASE_PADRAO;
const minhaCor = () => CORES_AV[S.user?.user_metadata?.cor]?.[1] || CORES_AV.salvia[1];
/* reduz a foto no próprio aparelho: recorte quadrado central, 256 px, JPEG */
function reduzirFoto(file){ return new Promise((ok,erro)=>{ if(!file||!/^image\//.test(file.type||'image/')) return erro(new Error('Escolha um arquivo de imagem.'));
  const url=URL.createObjectURL(file), img=new Image();
  img.onload=()=>{ const L=256, m=Math.min(img.naturalWidth,img.naturalHeight), c=document.createElement('canvas'); c.width=c.height=L;
    const g=c.getContext('2d'); g.imageSmoothingQuality='high'; g.drawImage(img,(img.naturalWidth-m)/2,(img.naturalHeight-m)/2,m,m,0,0,L,L); URL.revokeObjectURL(url); ok(c.toDataURL('image/jpeg',0.85)); };
  img.onerror=()=>{ URL.revokeObjectURL(url); erro(new Error('Não consegui abrir esta imagem. Tente uma foto em JPG ou PNG.')); }; img.src=url; }); }
const avatarHtml = (foto, ini, cor, tam=48) => `<span class="avatar-pv" style="width:${tam}px;height:${tam}px;background:${cor}">${foto?`<img src="${esc(foto)}" alt="">`:esc(ini||'·')}</span>`;
function saudacao(){ const h=+new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Cuiaba',hour:'numeric',hourCycle:'h23'}).format(new Date()); return h<5?'Boa noite':h<12?'Bom dia':h<18?'Boa tarde':'Boa noite'; }
const dataExtenso = () => { const t=new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Cuiaba',weekday:'long',day:'numeric',month:'long'}).format(new Date()); return t.charAt(0).toUpperCase()+t.slice(1); };

function renderNav(){
  $('#nav').innerHTML = `<div class="nav-label">Navegação</div>` + NAV.map(n=>`<button data-act="ir" data-v="${n.id}" ${S.view===n.id?'aria-current="page"':''}>${icon(n.ic)}<span>${n.t}</span>${n.soon?`<span class="soon">Etapa ${n.soon}</span>`:''}</button>`).join('');
  $('#espacoSel').innerHTML = S.espacos.map(e=>`<option value="${e.id}" ${e.id===S.esp?'selected':''}>${esc(e.nome)}${e.tipo==='compartilhado'?' · compartilhado':''}</option>`).join('');
  $('#quem').textContent = S.perfil?.nome || S.user?.email || '';
  const nome=meuNome(), ini=iniciais(nome);
  $('#brandNome').textContent = nome || 'Meu Eixo';
  $('#brandFrase').textContent = minhaFrase();
  $('#avatar').innerHTML = S.perfil?.foto ? `<img class="foto" src="${esc(S.perfil.foto)}" alt="">` : ini ? esc(ini) : '<img src="icone.svg" width="22" height="22" alt="">';
  $('#brand').style.setProperty('--av', minhaCor());
  $('#spacePick').hidden = S.espacos.length<=1;
}
function render(){
  const v=$('#view');
  const travado = S.fase!=='pronto';
  document.body.classList.toggle('locked',travado);
  $('#monthLabel').textContent=mesLabel(S.mes);
  if(!configurado){ $('#pageTitle').textContent='Meu Eixo'; v.innerHTML=`<div class="lock"><div class="mark">${logo}</div><h2>Configuração pendente</h2><p class="lead">Preencha o endereço e a chave pública do Supabase no arquivo config.js e publique novamente.</p></div>`; return; }
  if(S.fase==='iniciando'||S.fase==='carregando'){ $('#pageTitle').textContent='Meu Eixo'; v.innerHTML=`<div class="empty" style="max-width:420px;margin:10vh auto 0"><strong>Abrindo o Meu Eixo</strong>Carregando seus dados com segurança…</div>`; return; }
  if(S.fase==='erro'){ v.innerHTML=`<div class="lock"><div class="mark">${logo}</div><h2>Não foi possível carregar</h2><p class="lead">Verifique a conexão e tente novamente.</p><button class="btn primary" data-act="recarregarPagina">Tentar de novo</button></div>`; return; }
  if(S.fase==='auth'){ $('#pageTitle').textContent='Meu Eixo'; v.innerHTML=vAuth(); setTimeout(()=>{ const i=v.querySelector('input'); i&&i.focus(); },30); return; }
  renderNav();
  const n=NAV.find(x=>x.id===S.view); $('#pageTitle').textContent=n?.t||'';
  $('#monthNav').hidden = S.view==='config';
  document.querySelector('.fab').hidden = false;
  const views={inicio:vInicio,financeiro:vFinanceiro,planejamento:vPlanejamento,relatorios:vRelatorios,config:vConfig,metas:vMetas};
  v.innerHTML = (views[S.view]||vRoadmap)();
  ls.set('meuEixo.view',S.view);
  if(S.view==='config' && espAtual()?.tipo==='compartilhado' && S.membros===null) carregarMembros();
}

/* ---------- telas de acesso ---------- */
function vAuth(){
  const msg = S.authMsg ? `<div class="ok-box">${S.authMsg}</div>` : '';
  const lembrar = `<label class="check"><input type="checkbox" name="lembrar" ${ls.get(LEMBRAR)!=='0'?'checked':''}> Manter conectada neste aparelho</label>`;
  if(S.auth==='cadastro') return `<div class="lock"><div class="mark">${logo}</div><h2>Criar conta</h2><p class="lead">Cada conta tem o próprio espaço, com dados que só a pessoa vê.</p>
    <form data-form="cadastro">${msg}
      <div class="field"><label for="aN">Seu nome</label><input id="aN" name="nome" autocomplete="name" required maxlength="60"></div>
      <div class="field"><label for="aE">E-mail</label><input id="aE" name="email" type="email" autocomplete="email" required></div>
      <div class="field"><label for="aS">Senha</label><input id="aS" name="senha" type="password" autocomplete="new-password" minlength="8" required></div>
      <div class="field"><label for="aS2">Repita a senha</label><input id="aS2" name="senha2" type="password" autocomplete="new-password" minlength="8" required></div>
      <p class="note" style="margin:0">Use pelo menos 8 caracteres, misturando letras e números.</p>
      <p class="err" id="authErr"></p><button class="btn primary" type="submit">Criar conta</button>
      <p class="switch">Já tem conta? <button type="button" class="link" data-act="auth" data-v="login">Entrar</button></p></form></div>`;
  if(S.auth==='esqueci') return `<div class="lock"><div class="mark">${logo}</div><h2>Redefinir senha</h2><p class="lead">Enviaremos um link para você criar uma nova senha.</p>
    <form data-form="esqueci">${msg}
      <div class="field"><label for="aE">E-mail da conta</label><input id="aE" name="email" type="email" autocomplete="email" required></div>
      <p class="err" id="authErr"></p><button class="btn primary" type="submit">Enviar link</button>
      <p class="switch"><button type="button" class="link" data-act="auth" data-v="login">Voltar para entrar</button></p></form></div>`;
  if(S.auth==='novaSenha') return `<div class="lock"><div class="mark">${logo}</div><h2>Crie uma nova senha</h2><p class="lead">Ela passa a valer em todos os aparelhos.</p>
    <form data-form="novaSenha">
      <div class="field"><label for="aS">Nova senha</label><input id="aS" name="senha" type="password" autocomplete="new-password" minlength="8" required></div>
      <div class="field"><label for="aS2">Repita a nova senha</label><input id="aS2" name="senha2" type="password" autocomplete="new-password" minlength="8" required></div>
      <p class="err" id="authErr"></p><button class="btn primary" type="submit">Salvar nova senha</button></form></div>`;
  return `<div class="lock"><div class="mark">${logo}</div><h2>Bem-vinda ao Meu Eixo</h2><p class="lead">Organize hoje. Viva com mais leveza.</p>
    <form data-form="login">${msg}
      <div class="field"><label for="aE">E-mail</label><input id="aE" name="email" type="email" autocomplete="email" required></div>
      <div class="field"><label for="aS">Senha</label><input id="aS" name="senha" type="password" autocomplete="current-password" required></div>
      ${lembrar}<p class="err" id="authErr"></p><button class="btn primary" type="submit">Entrar</button>
      <p class="switch"><button type="button" class="link" data-act="auth" data-v="esqueci">Esqueci minha senha</button></p>
      <p class="switch">Ainda não tem conta? <button type="button" class="link" data-act="auth" data-v="cadastro">Criar conta</button></p></form></div>`;
}

/* ---------- componentes ---------- */
function pillD(d){ const s=sitDesp(d); return `<span class="pill ${s}">${SIT_D[s]}</span>`; }
function pillR(r){ const s=sitRec(r); return `<span class="pill ${s}">${SIT_R[s]}</span>`; }
const pillP = p => p ? `<span class="pill p${p}">Dia ${p}</span>` : '';

function rowDesp(d,o={}){
  const s=sitDesp(d), grupo=(+d.parcelas||1)>1, ops=[];
  const pix=d.pixCopiaCola||d.chavePix;
  if(d.conferido===false) ops.push(`<button class="btn sm conf" data-act="conferir" data-col="despesas" data-id="${d.id}">${icon(I.check)}Conferido</button>`);
  if(pix && s!=='paga' && s!=='cancelada') ops.push(`<button class="btn sm pixbtn" data-act="copiarPix" data-id="${d.id}" title="${esc(d.chavePix||'Pix copia e cola')}">${icon(I.copy)}Copiar Pix</button>`);
  if(s!=='paga'&&s!=='cancelada') ops.push(`<button class="btn sm sage" data-act="pagar" data-id="${d.id}">${icon(I.check)}Pago</button>`);
  if(d.comprovante) ops.push(`<button class="btn sm ghost" data-act="verComp" data-path="${esc(d.comprovante)}" aria-label="Ver comprovante" title="Ver comprovante">${icon(I.clip)}</button>`);
  if(o.mover){ if(d.periodo!=='10') ops.push(`<button class="btn sm" data-act="periodo" data-id="${d.id}" data-p="10">Dia 10</button>`); if(d.periodo!=='20') ops.push(`<button class="btn sm" data-act="periodo" data-id="${d.id}" data-p="20">Dia 20</button>`); if(d.periodo) ops.push(`<button class="btn sm ghost" data-act="periodo" data-id="${d.id}" data-p="">Tirar do período</button>`); }
  if(s==='paga' && !o.mover && temContas() && valorLiq(d)>0) ops.push(`<button class="btn sm ghost" data-act="estornar" data-id="${d.id}" title="Registrar estorno">Estorno</button>`);
  ops.push(`<button class="btn sm ghost" data-act="editar" data-col="despesas" data-id="${d.id}" aria-label="Editar">${icon(I.edit)}</button>`);
  if(!o.mover) ops.push(`<button class="btn sm ghost" data-act="excluir" data-col="despesas" data-id="${d.id}" aria-label="Excluir">${icon(I.trash)}</button>`);
  const parc = grupo ? `<span class="pill parc">Parcela ${d.parcelaAtual} de ${d.parcelas}</span>` : (d.recorrenciaId?'<span class="pill">Todo mês</span>':(d.comportamento==='fixa'?'<span class="pill">Fixa</span>':''));
  const falta = grupo ? Math.max(0,(+d.parcelas)-(+d.parcelaAtual)) : 0;
  const restante = grupo ? `<span>${falta===0?'última parcela':`faltam ${falta} depois desta`}</span>` : '';
  return `<div class="row"><div><div class="t">${esc(d.descricao)}${d.conferido===false?' <span class="pill conferir">A conferir</span>':''}</div><div class="meta"><span>${esc(catNome(d.categoria))}${d.subcategoria?' · '+esc(d.subcategoria):''}</span><span>${s==='paga'&&d.dataPagamento?'paga em '+dataCurta(d.dataPagamento):'vence '+dataCurta(d.vencimento)}</span>${pillD(d)}${parc}${restante}${o.mover?'':pillP(d.periodo)}${d.formaPagamento?`<span>${esc(d.formaPagamento)}</span>`:''}${contasAtivas().length>1&&contaDe(d)?`<span>${esc(contaNome(contaDe(d)))}</span>`:''}${valorEstornado(d.id)?`<span class="pill paga">Estornado ${money(valorEstornado(d.id))}</span>`:''}</div></div><div class="v ${s==='cancelada'?'muted':''}">${money(d.valor)}</div><div class="ops">${ops.join('')}</div></div>`;
}
function rowRec(r,o={}){
  const s=sitRec(r); const ops=[];
  if(r.conferido===false) ops.push(`<button class="btn sm conf" data-act="conferir" data-col="receitas" data-id="${r.id}">${icon(I.check)}Conferido</button>`);
  if(s!=='recebida'&&s!=='cancelada') ops.push(`<button class="btn sm sage" data-act="receber" data-id="${r.id}">${icon(I.check)}Recebido</button>`);
  if(r.comprovante) ops.push(`<button class="btn sm ghost" data-act="verComp" data-path="${esc(r.comprovante)}" aria-label="Ver comprovante" title="Ver comprovante">${icon(I.clip)}</button>`);
  if(o.mover){ if(r.periodo!=='10') ops.push(`<button class="btn sm" data-act="periodoR" data-id="${r.id}" data-p="10">Dia 10</button>`); if(r.periodo!=='20') ops.push(`<button class="btn sm" data-act="periodoR" data-id="${r.id}" data-p="20">Dia 20</button>`); }
  ops.push(`<button class="btn sm ghost" data-act="editar" data-col="receitas" data-id="${r.id}" aria-label="Editar">${icon(I.edit)}</button>`);
  if(!o.mover) ops.push(`<button class="btn sm ghost" data-act="excluir" data-col="receitas" data-id="${r.id}" aria-label="Excluir">${icon(I.trash)}</button>`);
  const val = s==='recebida' ? `${money(r.valorRecebido)}${r2(r.valorRecebido)!==r2(r.valorPrevisto)?`<div class="small muted">previsto ${money(r.valorPrevisto)}</div>`:''}` : money(r.valorPrevisto);
  return `<div class="row"><div><div class="t">${esc(r.descricao)}${r.conferido===false?' <span class="pill conferir">A conferir</span>':''}</div><div class="meta"><span>${esc(r.origem||'')}</span>${r.recorrenciaId?'<span class="pill">Todo mês</span>':''}<span>${s==='recebida'?'recebido '+dataCurta(r.dataEfetiva):'previsto '+dataCurta(r.dataPrevista)}</span>${pillR(r)}${o.mover?'':pillP(r.periodo)}</div></div><div class="v pos">${val}</div><div class="ops">${ops.join('')}</div></div>`;
}
const linha = (a,b) => `<div class="row" style="grid-template-columns:1fr auto"><span>${a}</span><b class="num">${b}</b></div>`;

/* ---------- telas ---------- */
function vInicio(){
  const ym=S.mes, rs=resumo(ym), sd=saldoDisponivel(), pr=proximoRecebimento(), h=hoje();
  const ate=S.desp.filter(d=>ativa(d)&&d.situacao!=='paga'&&d.vencimento&&d.vencimento<pr);
  const prevAte = sd===null?null:r2(sd-sum(ate,d=>d.valor));
  const prox=S.desp.filter(d=>ativa(d)&&d.situacao!=='paga'&&d.vencimento&&d.vencimento>=h).sort((a,b)=>a.vencimento.localeCompare(b.vencimento)).slice(0,6);
  const al=alertas(ym), vazio=!S.rec.length&&!S.desp.length;
  return `
  <section class="saudacao"><h2>${saudacao()}${primeiroNome()?', '+esc(primeiroNome()):''}</h2><p>${esc(dataExtenso())} · ${esc(minhaFrase())}</p></section>
  ${blocoConferir()}
  ${vazio?`<div class="empty"><strong>Vamos começar pelo essencial</strong>Registre seu saldo atual em Configurações, depois cadastre suas receitas e contas do mês. O painel se monta a partir dos seus dados reais.<div class="actions" style="justify-content:center;margin-top:14px"><button class="btn primary" data-act="ir" data-v="config">Definir saldo inicial</button><button class="btn" data-act="novo" data-tipo="receita">Registrar receita</button></div></div>`:''}
  <section><div class="section-head"><h2>Visão financeira</h2><p>${esc(espAtual()?.nome||'')} · ${mesLabel(ym)}</p></div>
    <div class="kpis">
      <div class="kpi"><span class="lbl">Receitas do mês</span><span class="val pos">${money(rs.recReal)}</span><span class="sub">de ${money(rs.recPrev)} previstos</span></div>
      <div class="kpi"><span class="lbl">Despesas do mês</span><span class="val">${money(rs.despTot)}</span><span class="sub">${money(rs.despPaga)} já pagos</span></div>
      <div class="kpi"><span class="lbl">Contas pendentes</span><span class="val">${money(rs.pendVal)}</span><span class="sub">${rs.pend.length} ${rs.pend.length===1?'lançamento':'lançamentos'}</span></div>
      <div class="kpi"><span class="lbl">Livre para não planejados</span><span class="val ${rs.saldoPrev<0?'neg':''}">${money(rs.saldoPrev)}</span><span class="sub">receitas menos todas as despesas do mês</span></div>
    </div></section>
  <div class="grid2">
    <section class="panel"><h3>Alertas</h3>${al.length?`<div class="alerts">${al.map(x=>`<div class="alert ${x.k}"><span class="dot"></span><div><p>${x.t}</p><p class="hint">${x.h}</p></div></div>`).join('')}</div>`:`<div class="alert ok"><span class="dot"></span><div><p>Nada exige atenção agora.</p><p class="hint">Os alertas aparecem quando contas vencem, períodos ficam apertados ou orçamentos chegam perto do limite.</p></div></div>`}</section>
    <section class="panel"><h3>Próximos vencimentos</h3>${prox.length?`<div class="list">${prox.map(d=>`<div class="row" style="grid-template-columns:minmax(0,1fr) auto"><div><div class="t">${esc(d.descricao)}</div><div class="meta"><span>${dataBR(d.vencimento)}</span>${pillP(d.periodo)}</div></div><div class="v">${money(d.valor)}</div></div>`).join('')}</div>`:`<p class="muted small">Nenhuma conta pendente a vencer.</p>`}</section>
  </div>
  <div class="grid2">
    <section class="panel"><h3>Composição das despesas</h3><div class="list">${linha('Despesas fixas',money(rs.fixas))}${linha('Despesas variáveis',money(rs.variaveis))}${linha('Parcelas neste mês',money(rs.parcelas))}${linha('Parcelas a pagar (todos os meses)',money(sum(parcelasFuturas(),d=>d.valor)))}</div></section>
    <section class="panel"><h3>Maiores despesas do mês</h3>${(()=>{ const top=[...rs.D].sort((a,b)=>(+b.valor)-(+a.valor)).slice(0,5);
      return top.length?`<div class="list">${top.map((d,i)=>`<div class="row" style="grid-template-columns:minmax(0,1fr) auto"><div><div class="t">${i+1}. ${esc(d.descricao)}</div><div class="meta"><span>${esc(catNome(d.categoria))}</span><span>${sitDesp(d)==='paga'&&d.dataPagamento?'paga em '+dataCurta(d.dataPagamento):'vence '+dataCurta(d.vencimento)}</span>${pillD(d)}</div></div><div class="v">${money(d.valor)}</div></div>`).join('')}</div>`:`<p class="muted small">Nenhuma despesa em ${mesLabel(ym)}.</p>`; })()}</section>
  </div>`;
}

function vFinanceiro(){
  const ym=S.mes, rs=resumo(ym), f=S.filtro; let D=despMes(ym), R=recMes(ym);
  if(f.sit) D=D.filter(d=>sitDesp(d)===f.sit); if(f.cat) D=D.filter(d=>d.categoria===f.cat);
  D.sort((a,b)=>(a.vencimento||'').localeCompare(b.vencimento||'')); R.sort((a,b)=>(a.dataPrevista||'').localeCompare(b.dataPrevista||''));
  const isD=S.tab==='despesas', isM=S.tab==='movimentacoes';
  return `${blocoConferir()}
  ${faixaContas()}
  <div class="kpis">
    <div class="kpi"><span class="lbl">Receitas</span><span class="val pos">${money(rs.recEsp)}</span><span class="sub">${money(rs.recReal)} recebidos</span></div>
    <div class="kpi"><span class="lbl">Despesas</span><span class="val">${money(rs.despTot)}</span><span class="sub">${money(rs.despPaga)} pagos</span></div>
    <div class="kpi"><span class="lbl">Saldo previsto</span><span class="val ${rs.saldoPrev<0?'neg':''}">${money(rs.saldoPrev)}</span><span class="sub">realizado até agora ${money(rs.saldoReal)}</span></div>
  </div>
  <section>
    <div class="tabs" role="tablist"><button role="tab" aria-selected="${isD}" data-act="tab" data-v="despesas">Despesas (${despMes(ym).length})</button><button role="tab" aria-selected="${S.tab==='receitas'}" data-act="tab" data-v="receitas">Receitas (${R.length})</button>${temContas()||S.contasErro?`<button role="tab" aria-selected="${isM}" data-act="tab" data-v="movimentacoes">Movimentações</button>`:''}</div>
    ${isM?`<div class="section-head"><p>Transferências entre contas, ajustes de saldo e estornos.</p><div class="right">${temContas()?`<button class="btn primary" data-act="novo" data-tipo="transferencia">${icon(I.plus)}Nova movimentação</button>`:''}</div></div>${vMovimentacoes(ym)}`:`
    <div class="section-head"><p>${isD?'Contas do mês pela data de vencimento.':'Recebimentos do mês pela data prevista.'}</p><div class="right"><button class="btn" data-act="enviarComprovante" data-tipo="${isD?'despesa':'receita'}">${icon(I.clip)}Enviar comprovante</button><button class="btn primary" data-act="novo" data-tipo="${isD?'despesa':'receita'}">${icon(I.plus)}Novo lançamento</button></div></div>
    ${isD?`<div class="filters">
      <div class="field"><label for="fSit">Situação</label><select id="fSit" data-chg="fsit"><option value="">Todas</option>${Object.entries(SIT_D).map(([k,v])=>`<option value="${k}" ${f.sit===k?'selected':''}>${v}</option>`).join('')}</select></div>
      <div class="field"><label for="fCat">Categoria</label><select id="fCat" data-chg="fcat"><option value="">Todas</option>${S.cats.map(c=>`<option value="${c.id}" ${f.cat===c.id?'selected':''}>${esc(c.nome)}</option>`).join('')}</select></div></div>`:''}
    <div class="list">${isD?(D.length?D.map(d=>rowDesp(d)).join(''):`<div class="empty"><strong>Nenhuma despesa ${f.sit||f.cat?'com esses filtros':'em '+mesLabel(ym)}</strong>Use “Nova despesa” para registrar contas, compras parceladas ou despesas fixas.</div>`)
      :(R.length?R.map(r=>rowRec(r)).join(''):`<div class="empty"><strong>Nenhuma receita em ${mesLabel(ym)}</strong>Cadastre salário, comissões e outras entradas com a data prevista. Depois registre o valor efetivamente recebido.</div>`)}</div>`}
  </section>`;
}

function blocoPeriodo(ym,p,carry){
  const P=periodo(ym,p), final=r2(P.saldo+(carry||0));
  return `<article class="period">
    <header><span class="day num">${p}</span><div><h3>Recebimento do dia ${p}</h3><span class="small muted">${p==='10'?'primeira metade do mês':'segunda metade do mês'}</span></div></header>
    <div class="figs"><div>Previsto para receber<b>${money(P.prev)}</b></div><div>Efetivamente recebido<b class="pos">${money(P.receb)}</b></div><div>Compromissos<b>${money(P.comp)}</b></div><div>Pagos · pendentes<b>${money(P.pagos)} · ${money(P.pend)}</b></div>
      ${carry!==undefined?`<div style="grid-column:1/-1">Sobra do período do dia 10<b class="${carry<0?'neg':''}">${money(carry)}</b></div>`:''}</div>
    <div class="body">
      ${P.R.length?`<div class="small muted" style="padding:8px 4px 0">Receitas</div><div class="list">${P.R.map(r=>rowRec(r,{mover:true})).join('')}</div>`:`<p class="small muted" style="padding:8px 4px">Nenhuma receita atribuída a este período.</p>`}
      ${P.D.length?`<div class="small muted" style="padding:8px 4px 0">Compromissos</div><div class="list">${P.D.map(d=>rowDesp(d,{mover:true})).join('')}</div>`:`<p class="small muted" style="padding:0 4px 8px">Nenhuma conta atribuída a este período.</p>`}
    </div>
    <footer><span class="small muted">Saldo previsto após os pagamentos</span><span class="big ${final<0?'neg':'pos'}">${money(final)}</span></footer></article>`;
}
function vPlanejamento(){
  const ym=S.mes, p10=periodo(ym,'10');
  const semD=despMes(ym).filter(d=>ativa(d)&&!d.periodo).sort((a,b)=>(a.vencimento||'').localeCompare(b.vencimento||''));
  const semR=recMes(ym).filter(r=>ativa(r)&&!r.periodo), rs=resumo(ym), rm=recorrentesFaltando(ym);
  const sobre=p10.comp>p10.esper&&p10.comp>0;
  const cand=sobre?p10.D.filter(d=>d.situacao!=='paga'&&(d.comportamento!=='fixa'||+(d.vencimento||'').slice(8,10)>=20)):[];
  const futuros=S.desp.filter(d=>ativa(d)&&d.situacao!=='paga'&&compDesp(d)>ym);
  const lim=orcamentoMes(ym), temOrc=Object.keys(lim).length>0, temAnt=Object.keys(orcamentoMes(addMes(ym,-1))).length>0;
  return `
  ${S.falta008?`<div class="alert warn"><span class="dot"></span><div><p>Para as contas fixas entrarem sozinhas em todos os meses, execute a atualização <b>008_recorrencias_automaticas.sql</b> no Supabase (SQL Editor).</p><p class="hint">Até lá, use o botão abaixo para lançar as contas fixas de cada mês.</p></div></div>`:''}
  ${rm.length?`<div class="alert"><span class="dot"></span><div style="flex:1"><p>${rm.length} ${rm.length>1?'contas fixas recorrentes ainda não foram lançadas':'conta fixa recorrente ainda não foi lançada'} em ${mesLabel(ym)}: ${rm.map(t=>esc(t.descricao)).join(', ')}.</p><div class="actions" style="margin-top:8px"><button class="btn sm primary" data-act="gerarRecorrentes">Lançar contas fixas de ${MESES[+ym.slice(5)-1]}</button></div></div></div>`:''}
  <section><div class="section-head"><h2>Visão mensal</h2><p>Tudo o que entra e sai em ${mesLabel(ym)}</p></div>
    <div class="kpis">
      <div class="kpi"><span class="lbl">Total de receitas</span><span class="val pos">${money(rs.recEsp)}</span><span class="sub">${money(rs.recReal)} já recebidos</span></div>
      <div class="kpi"><span class="lbl">Total de despesas</span><span class="val">${money(rs.despTot)}</span><span class="sub">${money(rs.despPaga)} já pagos</span></div>
      <div class="kpi hero"><span class="lbl">Saldo previsto</span><span class="val ${rs.saldoPrev<0?'neg':''}">${money(rs.saldoPrev)}</span><span class="sub">saldo realizado ${money(rs.saldoReal)}</span></div>
      <div class="kpi"><span class="lbl">Dívidas e parcelas</span><span class="val">${money(sum(parcelasFuturas(),d=>d.valor))}</span><span class="sub">${money(rs.parcelas)} neste mês</span></div>
      <div class="kpi"><span class="lbl">Compromissos futuros</span><span class="val">${money(sum(futuros,d=>d.valor))}</span><span class="sub">nos meses seguintes</span></div>
    </div></section>
  <section><div class="section-head"><h2>Orçamento por categoria</h2><p>Defina quanto pode gastar em cada categoria neste mês.</p><div class="right">${!temOrc&&temAnt?`<button class="btn sm" data-act="copiarOrc">${icon(I.copy)}Copiar de ${MESES[+addMes(ym,-1).slice(5)-1]}</button>`:''}</div></div>
    ${S.cats.length?`<div class="scroll"><table><thead><tr><th>Categoria</th><th class="r">Orçamento planejado</th><th class="r">Gasto no mês</th><th class="r">Saldo do orçamento</th><th style="min-width:120px">Uso</th></tr></thead>
      <tbody>${S.cats.map(c=>{ const L=+lim[c.id]||0, g=gastoCat(ym,c.id), pc=L?g/L:0, cls=pc>1?'danger':pc>=.85?'warn':'';
        return `<tr><td>${esc(c.nome)}</td><td class="r"><input class="inline-input num" inputmode="decimal" aria-label="Orçamento de ${esc(c.nome)}" data-orc="${c.id}" value="${L?fmtInput(L):''}" placeholder="0,00"></td><td class="r">${money(g)}</td><td class="r ${L&&L-g<0?'neg':''}">${L?money(L-g):'—'}</td><td>${L?`<div class="bar ${cls}"><i style="width:${Math.min(100,pc*100).toFixed(0)}%"></i></div>`:'<span class="small muted">sem limite</span>'}</td></tr>`; }).join('')}</tbody></table></div>
      <p class="small muted" style="margin-top:8px">O valor é salvo ao sair do campo. O gasto considera todas as despesas não canceladas do mês, pagas ou pendentes.</p>`
      :`<div class="empty"><strong>Nenhuma categoria cadastrada</strong>Crie suas categorias em Configurações para montar o orçamento.</div>`}
  </section>
  ${sobre?`<div class="alert warn"><span class="dot"></span><div><p>Os compromissos do dia 10 (${money(p10.comp)}) passam da receita prevista do período (${money(p10.esper)}) em ${money(p10.comp-p10.esper)}.</p><p class="hint">${cand.length?`Contas que podem ir para o dia 20 por serem variáveis ou vencerem depois do dia 20: ${cand.map(d=>esc(d.descricao)+' ('+money(d.valor)+')').join(', ')}. Use os botões em cada conta para decidir.`:'Revise os gastos variáveis do período. Nenhuma conta foi movida automaticamente.'}</p></div></div>`:''}
  <section><div class="section-head"><h2>Recebimentos dos dias 10 e 20</h2><p>Atribua cada compromisso ao recebimento que vai pagá-lo.</p></div>
    <div class="periods">${blocoPeriodo(ym,'10')}${blocoPeriodo(ym,'20',p10.saldo)}
      <article class="period unassigned"><header><span class="day">·</span><div><h3>Sem período definido</h3><span class="small muted">aguardando a sua decisão</span></div></header>
        <div class="figs"><div>Compromissos<b>${money(sum(semD,d=>d.valor))}</b></div><div>Receitas<b>${money(sum(semR,recEsperado))}</b></div></div>
        <div class="body">${semR.length?`<div class="list">${semR.map(r=>rowRec(r,{mover:true})).join('')}</div>`:''}${semD.length?`<div class="list">${semD.map(d=>rowDesp(d,{mover:true})).join('')}</div>`:`<p class="small muted" style="padding:8px 4px">Todas as contas do mês já têm período.</p>`}</div></article>
    </div></section>
`;
}

function vRelatorios(){
  const meses=[]; for(let i=5;i>=0;i--) meses.push(addMes(S.mes,-i));
  const dados=meses.map(m=>{const r=resumo(m); return {m,rec:r.recEsp,desp:r.despTot};});
  const max=Math.max(1,...dados.flatMap(d=>[d.rec,d.desp]));
  const ym=S.mes, D=despMes(ym).filter(ativa), ant=despMes(addMes(ym,-1)).filter(ativa), rs=resumo(ym);
  const porCat=S.cats.map(c=>({c,v:sum(D.filter(d=>d.categoria===c.id),valorLiq),a:sum(ant.filter(d=>d.categoria===c.id),valorLiq)})).filter(x=>x.v||x.a).sort((a,b)=>b.v-a.v);
  const maior=[...D].sort((a,b)=>b.valor-a.valor)[0], temDados=dados.some(d=>d.rec||d.desp);
  return `
  <section class="panel"><h3>Receitas e despesas · últimos 6 meses</h3>
    ${temDados?`<div class="legend" style="margin-bottom:12px"><span><i style="background:var(--sage)"></i>Receitas</span><span><i style="background:var(--blue)"></i>Despesas</span></div>
    <div class="bars">${dados.map(d=>`<div class="item"><span class="muted num">${mesCurto(d.m)}</span><div class="track"><div class="b in" style="width:${(d.rec/max*100).toFixed(1)}%" title="Receitas ${money(d.rec)}"></div><div class="b out" style="width:${(d.desp/max*100).toFixed(1)}%" title="Despesas ${money(d.desp)}"></div></div></div>`).join('')}</div>
    <div class="scroll" style="margin-top:16px"><table><thead><tr><th>Mês</th><th class="r">Receitas</th><th class="r">Despesas</th><th class="r">Saldo</th></tr></thead><tbody>${dados.map(d=>`<tr><td style="text-transform:capitalize">${mesLabel(d.m)}</td><td class="r">${money(d.rec)}</td><td class="r">${money(d.desp)}</td><td class="r ${d.rec-d.desp<0?'neg':'pos'}">${money(d.rec-d.desp)}</td></tr>`).join('')}</tbody></table></div>`
    :`<div class="empty"><strong>Ainda não há movimentações registradas</strong>O comparativo aparece assim que houver receitas ou despesas nos últimos meses.</div>`}</section>
  <div class="grid2">
    <section class="panel"><h3>Gastos por categoria em ${mesLabel(ym)}</h3>
      ${porCat.length?`<div class="scroll"><table><thead><tr><th>Categoria</th><th class="r">Mês</th><th class="r">Mês anterior</th><th class="r">Variação</th></tr></thead><tbody>${porCat.map(x=>{const dv=x.v-x.a; return `<tr><td>${esc(x.c.nome)}</td><td class="r">${money(x.v)}</td><td class="r">${money(x.a)}</td><td class="r ${dv>0?'neg':dv<0?'pos':''}">${x.a?(dv>0?'+':'')+(dv/x.a*100).toFixed(1).replace('.',',')+'%':'—'}</td></tr>`}).join('')}</tbody></table></div>`:`<p class="muted small">Sem despesas no mês selecionado.</p>`}</section>
    <section class="panel"><h3>Destaques do mês</h3><div class="list">${linha('Categoria com maior gasto',porCat[0]&&porCat[0].v?esc(porCat[0].c.nome):'—')}${linha('Maior despesa individual',maior?esc(maior.descricao)+' · '+money(maior.valor):'—')}${linha('Despesas fixas · variáveis',money(rs.fixas)+' · '+money(rs.variaveis))}</div>
      <p class="note" style="margin:12px 0 0">O relatório mensal automático, com análise do gestor pessoal e plano para o mês seguinte, chega na Etapa 11. Ele será gerado no primeiro dia útil de cada mês, no horário de Cuiabá.</p></section>
  </div>`;
}

function vConfig(){
  const c=S.cfg, e=espAtual(), dono=souDono(), comp=e?.tipo==='compartilhado';
  const membros = comp ? (S.membros===null?'<p class="small muted">Carregando membros…</p>':`<div class="list">${S.membros.map(m=>`<div class="row" style="grid-template-columns:minmax(0,1fr) auto"><div><div class="t">${esc(m.nome||m.email)}${m.usuario_id===S.user.id?' (você)':''}</div><div class="meta"><span>${esc(m.email)}</span><span class="pill">${m.papel==='dono'?'Criou o espaço':'Membro'}</span></div></div><div class="ops" style="grid-column:auto">${dono&&m.papel!=='dono'?`<button class="btn sm ghost" data-act="removerMembro" data-id="${m.usuario_id}">Remover</button>`:''}</div></div>`).join('')}</div>`) : '';
  return `
  <section class="panel"><h3>Minha conta</h3>
    <p class="small muted" style="margin:0 0 14px">${esc(S.perfil?.nome||'')} · ${esc(S.user?.email||'')}</p>
    <div class="actions"><button class="btn" data-act="personalizar">Personalizar nome e frase</button><button class="btn" data-act="trocarSenha">Alterar senha</button><button class="btn" data-act="sair">Sair deste aparelho</button></div></section>
  <section class="panel"><div class="section-head"><h3 style="margin:0">Espaços</h3><div class="right"><button class="btn sm" data-act="entrarEspaco">Entrar com código</button><button class="btn sm primary" data-act="criarEspaco">${icon(I.plus)}Criar espaço compartilhado</button></div></div>
    <p class="small muted" style="margin:0 0 12px">Seu espaço pessoal é só seu. Em um espaço compartilhado, todos os membros veem e lançam os mesmos dados. Você está em: <b>${esc(e?.nome||'')}</b>.</p>
    ${comp?`<div class="panel" style="background:var(--surface);border:0">
      ${dono?`<p class="small" style="margin:0 0 8px">Código de convite deste espaço. Envie para quem deve participar; a pessoa cria a conta dela e usa “Entrar com código”.</p>
      <div class="actions" style="align-items:center"><span class="code" id="codigo">${esc(e.codigoConvite||'')}</span><button class="btn sm" data-act="copiarCodigo">Copiar</button><button class="btn sm ghost" data-act="novoCodigo">Gerar novo código</button></div>`:''}
      <h3 style="margin:16px 0 6px;font-size:15px">Membros</h3>${membros}
      <div class="actions" style="margin-top:12px">${dono?`<button class="btn sm ghost" data-act="renomearEspaco">Renomear espaço</button><button class="btn sm danger" data-act="excluirEspaco">Excluir espaço</button>`:`<button class="btn sm danger" data-act="sairEspaco">Sair deste espaço</button>`}</div></div>`:''}
  </section>
  ${temContas()?`<section class="panel"><div class="section-head"><h3 style="margin:0">Contas</h3><div class="right"><button class="btn sm primary" data-act="novaConta">${icon(I.plus)}Nova conta</button></div></div>
    <p class="small muted" style="margin:0 0 10px">Onde o seu dinheiro fica. O saldo de cada conta parte do valor informado e soma recebimentos, pagamentos, transferências e ajustes.</p>
    ${(S.contas||[]).length?`<div class="list">${[...S.contas].sort((a,b)=>(b.ativa!==false)-(a.ativa!==false)||(b.padrao-a.padrao)||a.nome.localeCompare(b.nome,'pt')).map(c=>`<div class="row" style="grid-template-columns:minmax(0,1fr) auto auto"><div><div class="t">${esc(c.nome)}</div><div class="meta"><span>${esc(TIPOS_CONTA[c.tipo]||'')}</span>${c.padrao?'<span class="pill paga">Principal</span>':''}${c.ativa===false?'<span class="pill cancelada">Arquivada</span>':''}<span>saldo informado ${money(c.saldoInicial)} em ${dataCurta(c.dataSaldo)}</span></div></div><div class="v ${saldoConta(c)<0?'neg':''}">${money(saldoConta(c))}<div class="small muted">hoje</div></div><div class="ops" style="grid-column:auto"><button class="btn sm ghost" data-act="editConta" data-id="${c.id}" aria-label="Editar">${icon(I.edit)}</button></div></div>`).join('')}</div>`:`<div class="empty"><strong>Nenhuma conta cadastrada</strong>Cadastre banco, poupança e carteira com o saldo de hoje.</div>`}</section>`:`  <section class="panel"><h3>Saldo inicial</h3>
    <p class="small muted" style="margin:0 0 14px">Informe quanto havia em conta no início de uma data. A partir dela, o saldo disponível soma os recebimentos e subtrai os pagamentos registrados.</p>
    <form class="form-grid" data-form="saldo" style="max-width:520px">
      <div class="field"><label for="sVal">Saldo em conta (R$)</label><input id="sVal" name="valor" inputmode="decimal" required value="${fmtInput(c.saldoInicial)}" placeholder="0,00"></div>
      <div class="field"><label for="sData">No início do dia</label><input id="sData" name="data" type="date" required value="${c.dataSaldo||hoje()}"></div>
      <div class="full actions"><button class="btn primary" type="submit">Salvar saldo</button></div></form></section>`}
  <section class="panel"><div class="section-head"><h3 style="margin:0">Categorias de despesa</h3><div class="right"><button class="btn sm primary" data-act="novaCat">${icon(I.plus)}Nova categoria</button></div></div>
    ${S.cats.length?`<div class="list">${S.cats.map(k=>`<div class="row" style="grid-template-columns:minmax(0,1fr) auto"><div><div class="t">${esc(k.nome)}</div><div class="meta">${k.alimentacao?'<span class="pill paga">Conta como alimentação</span>':''}<span>${S.desp.filter(d=>d.categoria===k.id).length} lançamentos</span></div></div><div class="ops" style="grid-column:auto"><button class="btn sm ghost" data-act="editCat" data-id="${k.id}" aria-label="Editar">${icon(I.edit)}</button><button class="btn sm ghost" data-act="delCat" data-id="${k.id}" aria-label="Excluir">${icon(I.trash)}</button></div></div>`).join('')}</div>`:`<div class="empty"><strong>Nenhuma categoria</strong>Crie categorias como Moradia, Transporte e Supermercado.</div>`}</section>
  <section class="panel"><h3>Receitas e contas fixas</h3>
    <p class="small muted" style="margin:0 0 10px">Entram sozinhas em todos os meses, sempre 12 meses à frente. Alterações valem para os meses ainda não pagos ou recebidos.</p>
    ${S.recor.length?`<div class="list">${[...S.recor].sort((a,b)=>(ehRecR(b)-ehRecR(a))||a.descricao.localeCompare(b.descricao,'pt')).map(t=>`<div class="row" style="grid-template-columns:minmax(0,1fr) auto auto"><div><div class="t">${esc(t.descricao)}</div><div class="meta">${ehRecR(t)?'<span class="pill paga">Receita</span>':'<span class="pill">Despesa</span>'}<span>${ehRecR(t)?esc(t.origem||'Receita'):esc(catNome(t.categoria))}</span><span>todo dia ${t.dia}</span>${pillP(t.periodo)}${t.ativo===false?'<span class="pill cancelada">Pausada</span>':''}</div></div><div class="v ${ehRecR(t)?'pos':''}">${money(t.valor)}</div><div class="ops" style="grid-column:auto"><button class="btn sm ghost" data-act="editRecor" data-id="${t.id}" aria-label="Editar">${icon(I.edit)}</button><button class="btn sm ghost" data-act="delRecor" data-id="${t.id}" aria-label="Excluir">${icon(I.trash)}</button></div></div>`).join('')}</div>`:`<p class="small muted">Nenhuma conta recorrente. Marque “Repete todo mês” ao cadastrar uma despesa fixa.</p>`}</section>
  <section class="panel"><h3>Seus dados</h3>
    <p class="small muted" style="margin:0 0 14px">Espaço “${esc(e?.nome||'')}”: ${S.rec.length} receitas, ${S.desp.length} despesas, ${S.cats.length} categorias.</p>
    <div class="actions"><button class="btn" data-act="exportar">${icon(I.down)}Exportar dados do espaço (JSON)</button>${dono?`<button class="btn danger" data-act="apagarTudo">Excluir todos os dados do espaço</button>`:''}<button class="btn danger" data-act="excluirConta">Excluir minha conta</button></div></section>`;
}

const ROADMAP = {};
function vRoadmap(){ const r=ROADMAP[S.view]; if(!r) return '';
  return `<div class="roadmap"><span class="eyebrow">Etapa ${r.e} do plano</span><h2>${r.t}</h2><ul>${r.l.map(x=>`<li>${x}</li>`).join('')}</ul><p class="note" style="margin:0">Este módulo usa o mesmo banco de dados de Lançamentos. Quando for ativado, as compras de alimentação já registradas nas categorias marcadas como alimentação entram no histórico.</p></div>`; }

/* ---------- modais ---------- */
let modalSubmit=null;
function abrirModal(html,onSubmit,afterMount){ anexo=null; $('#sheet').innerHTML=html; $('#modal').hidden=false; modalSubmit=onSubmit; afterMount&&afterMount($('#sheet')); setTimeout(()=>{ const f=$('#sheet').querySelector('input:not([type=hidden]):not([type=checkbox]),select,textarea'); f&&f.focus(); },30); }
function fecharModal(){ if(S.fila?.resolver){ const rv=S.fila.resolver; S.fila.resolver=null; S.fila.parar=true; rv(null); } $('#modal').hidden=true; $('#sheet').innerHTML=''; modalSubmit=null; }
function toast(t){ const el=$('#toast'); el.textContent=t; el.hidden=false; clearTimeout(toast.h); toast.h=setTimeout(()=>el.hidden=true,3600); }
const head = t => `<header><h2>${t}</h2><button type="button" class="icon-btn" data-act="fechar" aria-label="Fechar">${icon('M6 6l12 12M18 6 6 18')}</button></header>`;
const opts = (arr,sel) => arr.map(([v,t])=>`<option value="${esc(v)}" ${String(sel??'')===String(v)?'selected':''}>${esc(t)}</option>`).join('');
const rodape = (txt,cls='primary') => `<p class="err" id="formErr"></p><footer><button type="button" class="btn" data-act="fechar">Cancelar</button><button class="btn ${cls}" type="submit">${txt}</button></footer>`;
function confirmar(titulo,texto,botoes){
  abrirModal(`<div>${head(titulo)}</div><p style="margin:0">${texto}</p><footer><button type="button" class="btn" data-act="fechar">${botoes.length?'Cancelar':'Entendi'}</button>${botoes.map((b,i)=>`<button type="button" class="btn ${b.cls??'danger'}" data-act="conf" data-i="${i}">${b.t}</button>`).join('')}</footer>`,null);
  confirmar.cb=botoes.map(b=>b.fn);
}

/* ---------- comprovante anexado ao formulário ---------- */
let anexo=null;
const LEITOR = () => window.MeuEixoLeitor;
function blocoAnexo(item,texto){
  const tem=!!item?.comprovante;
  return `<div class="anexo">
    <input type="file" id="arqComp" accept="image/*,application/pdf" hidden>
    <div class="anexo-linha">
      <span class="anexo-ic">${icon(I.clip)}</span>
      <div class="anexo-txt"><b id="anexoTitulo">${tem?'Comprovante anexado':'Comprovante'}</b><span id="anexoStatus">${tem?'Envie outro arquivo se quiser substituir.':(texto||'Envie a foto, o print ou o PDF. Eu leio o valor, a data e o destinatário para você conferir.')}</span></div>
      <div class="anexo-ops">${tem?`<button type="button" class="btn sm ghost" data-act="verComp" data-path="${esc(item.comprovante)}">Ver</button>`:''}<button type="button" class="btn sm" data-act="escolherArquivo">${tem?'Substituir':'Anexar'}</button></div>
    </div><div id="anexoAviso"></div></div>`;
}
function definirSeg(form,nome,v){ form.elements[nome].value=v; const seg=form.querySelector(nome==='modo'?'#segModo':'#segValor'); seg&&seg.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.v===v))); form.dispatchEvent(new Event('change',{bubbles:true})); }
function marcar(el,valor){ if(!el||valor===undefined||valor===null||valor==='') return false; el.value=valor; el.classList.add('lido'); el.dispatchEvent(new Event('change',{bubbles:true})); return true; }
async function processarAnexo(input){
  const arq=input.files?.[0]; if(!arq) return;
  const form=input.closest('form'), st=$('#anexoStatus'), aviso=$('#anexoAviso');
  aviso.innerHTML='';
  if(arq.size>10*1024*1024){ st.textContent='O arquivo passa de 10 MB. Envie um print ou uma foto menor.'; input.value=''; return; }
  anexo={file:arq, hash:null};
  $('#anexoTitulo').textContent=arq.name||'Comprovante';
  st.textContent='Lendo o comprovante…';
  try{ anexo.hash=await LEITOR().hash(arq); }catch(_){}
  const idAtual=form.dataset.id||form.dataset.ref||'';
  const dup=anexo.hash && [...S.desp.map(x=>({...x,_c:'despesas'})),...S.rec.map(x=>({...x,_c:'receitas'}))].find(x=>x.comprovanteHash===anexo.hash && x.id!==idAtual);
  if(dup) aviso.innerHTML=`<div class="alert warn" style="margin-top:10px"><span class="dot"></span><div><p>Este comprovante já foi enviado em “${esc(dup.descricao)}” (${money(dup.valor??dup.valorRecebido??dup.valorPrevisto)}).</p><p class="hint">Se for a mesma operação, cancele e use o lançamento existente. Se for outra, pode continuar.</p><div class="actions" style="margin-top:6px"><button type="button" class="btn sm" data-act="editar" data-col="${dup._c}" data-id="${dup.id}">Abrir o lançamento existente</button></div></div></div>`;
  let r=null;
  try{ r=await LEITOR().ler(arq, p=>{ st.textContent=`Lendo o comprovante… ${p}%`; }); }
  catch(e){ console.error(e); st.textContent='Não consegui ler este arquivo automaticamente. Ele será anexado mesmo assim; preencha os campos.'; return; }
  if(!document.body.contains(form)) return;
  const lidos=preencherComLeitura(form,r);
  st.innerHTML = lidos.length ? `Li: <b>${lidos.map(esc).join(' · ')}</b>. Os campos em destaque vieram do comprovante; confira antes de salvar.` : 'Não encontrei valor nem data legíveis. O arquivo será anexado; preencha os campos.';
  if(r.entrada && form.dataset.form==='despesa') aviso.insertAdjacentHTML('beforeend','<p class="note" style="margin:10px 0 0">Parece um Pix <b>recebido</b>. Se for uma entrada de dinheiro, cancele e registre como Receita.</p>');
}
function preencherComLeitura(form,r){
  const E=form.elements, lidos=[], novo=!form.dataset.id;
  const vazio = el => el && !String(el.value||'').trim();
  if(r.valor) lidos.push(money(r.valor)); if(r.data) lidos.push(dataBR(r.data)); if(r.nome) lidos.push(r.nome); if(r.chave) lidos.push('chave Pix');
  const tipo=form.dataset.form;
  if(tipo==='despesa'){
    if(r.valor){ if(E.modoValor && E.modoValor.value==='total') definirSeg(form,'modoValor','parcela'); marcar(E.valor,fmtInput(r.valor)); }
    if(novo && r.nome && vazio(E.descricao)) marcar(E.descricao,r.nome);
    marcar(E.situacao,'paga');
    if(r.data){ marcar(E.dataPagamento,r.data); if(novo) marcar(E.vencimento,r.data); }
    if(r.pix) marcar(E.formaPagamento,'Pix');
    if(r.chave && vazio(E.chavePix)) marcar(E.chavePix,r.chave);
  } else if(tipo==='receita'){
    if(novo && r.nome && vazio(E.descricao)) marcar(E.descricao,r.nome);
    if(r.valor){ if(vazio(E.valorPrevisto)) marcar(E.valorPrevisto,fmtInput(r.valor)); marcar(E.valorRecebido,fmtInput(r.valor)); }
    marcar(E.situacao,'recebida');
    if(r.data){ marcar(E.dataEfetiva,r.data); if(novo) marcar(E.dataPrevista,r.data); }
  } else if(tipo==='quick'){
    if(r.valor) marcar(E.v,fmtInput(r.valor)); if(r.data) marcar(E.d,r.data);
    if(r.chave && E.chavePix && vazio(E.chavePix)) marcar(E.chavePix,r.chave);
  }
  return lidos;
}
async function enviarArquivo(){
  if(!anexo?.file) return null;
  const f=anexo.file; let ext=((f.name||'').split('.').pop()||'').toLowerCase().replace(/[^a-z0-9]/g,'');
  if(!ext||ext.length>5) ext = f.type==='application/pdf'?'pdf':(f.type.split('/')[1]||'jpg');
  const path=`${S.esp}/${hoje().slice(0,7)}/${uid()}.${ext}`;
  chk(await sb.storage.from('comprovantes').upload(path,f,{contentType:f.type||undefined,upsert:false}));
  return {comprovante:path, comprovanteHash:anexo.hash||null};
}
async function apagarArquivos(paths){ paths=paths.filter(Boolean); if(!paths.length) return; try{ await sb.storage.from('comprovantes').remove(paths); }catch(e){ console.error(e); } }

/* ---------- formulário de despesa ---------- */
const blocoPix = d => `<div class="grupo" data-show="pix">
  <span class="grupo-t">Pix para pagar</span>
  <div class="form-grid">
    <div class="field"><label for="dChave">Chave Pix</label><input id="dChave" name="chavePix" maxlength="140" autocomplete="off" value="${esc(d.chavePix)}" placeholder="CPF, CNPJ, e-mail, celular ou chave aleatória"></div>
    <div class="field"><label for="dCopia">Pix copia e cola (opcional)</label><input id="dCopia" name="pixCopiaCola" maxlength="600" autocomplete="off" value="${esc(d.pixCopiaCola)}" placeholder="Cole aqui o código, se a cobrança tiver um"></div>
  </div>
  <p class="small muted" style="margin:6px 0 0">Fica salvo no lançamento. Na lista, o botão “Copiar Pix” copia a chave para você colar no app do banco.</p>
</div>`;

function formDespesa(d){
  const novo=!d; d=d||{situacao:'pendente',comportamento:'variavel',periodo:'',formaPagamento:'Pix',vencimento:S.mes===hoje().slice(0,7)?hoje():S.mes+'-10'};
  const grupo=(+d.parcelas||1)>1;
  return `<form data-form="despesa" data-id="${d.id||''}">${head(novo?'Nova despesa':'Editar despesa')}
  ${novo?`<div class="seg"><button type="button" aria-pressed="true">Despesa</button><button type="button" aria-pressed="false" data-act="novo" data-tipo="receita">Receita</button>${temContas()?`<button type="button" aria-pressed="false" data-act="novo" data-tipo="transferencia">Transferência</button>`:''}</div>`:''}
  ${blocoAnexo(d)}
  <div class="grupo"><span class="grupo-t">O que é</span>
    <div class="form-grid">
      <div class="field full"><label for="dDesc">Descrição</label><input id="dDesc" name="descricao" required maxlength="120" value="${esc(d.descricao)}" placeholder="Ex.: Aluguel, Ar-condicionado, Supermercado"></div>
      <div class="field"><label for="dCat">Categoria</label><select id="dCat" name="categoria" required><option value="">Selecione</option>${opts(S.cats.map(c=>[c.id,c.nome]),d.categoria)}</select></div>
      <div class="field"><label for="dSub">Subcategoria</label><input id="dSub" name="subcategoria" maxlength="60" value="${esc(d.subcategoria)}" placeholder="Opcional"></div>
    </div></div>
  ${novo?`<div class="grupo"><span class="grupo-t">Como é a cobrança</span>
    <input type="hidden" name="modo" value="unica">
    <div class="seg" id="segModo"><button type="button" aria-pressed="true" data-act="modo" data-v="unica">Única</button><button type="button" aria-pressed="false" data-act="modo" data-v="parcelada">Parcelada</button><button type="button" aria-pressed="false" data-act="modo" data-v="mensal">Todo mês</button></div>
    <div class="form-grid" data-show="parcelada" style="margin-top:12px">
      <div class="field"><label for="dAtual">Parcela que vou pagar agora</label><input id="dAtual" name="parcelaAtual" type="number" inputmode="numeric" min="1" max="120" value="1"></div>
      <div class="field"><label for="dTotal">Total de parcelas</label><input id="dTotal" name="totalParcelas" type="number" inputmode="numeric" min="2" max="120" value="12"></div>
      <div class="field full"><span class="lbl">O valor informado abaixo é</span><div class="seg" id="segValor"><button type="button" aria-pressed="true" data-act="modoValor" data-v="parcela">O valor de cada parcela</button><button type="button" aria-pressed="false" data-act="modoValor" data-v="total">O total da compra</button></div><input type="hidden" name="modoValor" value="parcela"></div>
    </div>
    <p class="note" id="parcPrev" data-show="parcelada" style="margin:12px 0 0"></p>
    <p class="note" data-show="mensal" style="margin:12px 0 0">Vira uma conta fixa: entra automaticamente em todos os meses a partir deste vencimento, com o mesmo valor, dia e chave Pix. Os próximos 12 meses ficam sempre lançados.</p>
  </div>`:(grupo?`<div class="grupo"><span class="grupo-t">Parcelamento</span>
    <div class="form-grid">
      <div class="field"><label for="dAtual">Esta é a parcela nº</label><input id="dAtual" name="parcelaAtual" type="number" inputmode="numeric" min="1" max="120" value="${d.parcelaAtual}"></div>
      <div class="field"><label for="dTotal">De um total de</label><input id="dTotal" name="totalParcelas" type="number" inputmode="numeric" min="2" max="120" value="${d.parcelas}"></div>
      <label class="check full"><input type="checkbox" name="aplicarProximas" checked> Ajustar também as próximas parcelas (numeração, valor e chave Pix)</label>
    </div>
    <p class="note" id="parcPrev" style="margin:12px 0 0"></p></div>`:'')}
  <div class="grupo"><span class="grupo-t">Valor e datas</span>
    <div class="form-grid">
      <div class="field"><label for="dValor" id="dValorLbl">${grupo?'Valor desta parcela (R$)':'Valor (R$)'}</label><input id="dValor" name="valor" inputmode="decimal" required value="${fmtInput(d.valor)}" placeholder="0,00"></div>
      <div class="field"><label for="dVenc" id="dVencLbl">${grupo?'Vencimento desta parcela':'Vencimento'}</label><input id="dVenc" name="vencimento" type="date" required value="${d.vencimento||''}"></div>
      <div class="field"><label for="dSit">Situação</label><select id="dSit" name="situacao">${opts([['pendente','Pendente'],['paga','Pago'],['prevista','Programado'],['cancelada','Cancelado']],d.situacao)}</select></div>
      <div class="field" data-show="paga"><label for="dPag">Pago em</label><input id="dPag" name="dataPagamento" type="date" value="${d.dataPagamento||hoje()}"></div>
      <div class="field"><label for="dPer">Pagar com o recebimento</label><select id="dPer" name="periodo">${opts([['','Decidir depois'],['10','Dia 10'],['20','Dia 20']],d.periodo||'')}</select></div>
      <div class="field"><label for="dComp">Tipo de despesa</label><select id="dComp" name="comportamento">${opts([['variavel','Variável'],['fixa','Fixa']],d.comportamento)}</select></div>
      <div class="field"><label for="dCompra">Data da compra</label><input id="dCompra" name="dataCompra" type="date" value="${d.dataCompra||''}"></div>
      <div class="field"><label for="dForma">Forma de pagamento</label><select id="dForma" name="formaPagamento"><option value="">Selecione</option>${opts(FORMAS.map(x=>[x,x]),d.formaPagamento)}</select></div>
      ${campoConta(d.contaId,'Sai da conta')}
    </div></div>
  ${blocoPix(d)}
  <div class="field"><label for="dObs">Observações</label><textarea id="dObs" name="obs" rows="2" maxlength="500">${esc(d.obs)}</textarea></div>
  ${rodape(novo?'Salvar despesa':'Salvar alterações')}</form>`;
}
function wireDespesa(root){
  const f=root.querySelector('form'), E=f.elements, novo=!f.dataset.id;
  const sync=()=>{
    root.querySelectorAll('[data-show="paga"]').forEach(el=>el.hidden=E.situacao.value!=='paga');
    root.querySelectorAll('[data-show="pix"]').forEach(el=>el.hidden=E.formaPagamento.value!=='Pix');
    const prev=$('#parcPrev'); if(!prev) return;
    const modo=E.modo?.value||'parcelada';
    if(novo){ root.querySelectorAll('[data-show="parcelada"]').forEach(el=>el.hidden=modo!=='parcelada'); root.querySelectorAll('[data-show="mensal"]').forEach(el=>el.hidden=modo!=='mensal');
      $('#dValorLbl').textContent = modo==='parcelada' ? (E.modoValor.value==='total'?'Valor total da compra (R$)':'Valor de cada parcela (R$)') : 'Valor (R$)';
      $('#dVencLbl').textContent = modo==='parcelada' ? 'Vencimento desta parcela' : (modo==='mensal'?'Vencimento deste mês':'Vencimento'); }
    if(modo!=='parcelada' && novo) return;
    const A=parseInt(E.parcelaAtual.value)||1, N=parseInt(E.totalParcelas.value)||1, v=parseValor(E.valor.value), venc=E.vencimento.value;
    if(N<2||A<1||A>N){ prev.textContent='A parcela atual precisa estar entre 1 e o total de parcelas.'; return; }
    const vp = novo && E.modoValor.value==='total' ? r2(v/N) : v;
    const qtd=N-A+1, fim=venc?addMesData(venc,qtd-1):'';
    if(novo) prev.innerHTML = `Serão lançadas <b>${qtd===1?'a parcela '+A:`as parcelas ${A} a ${N}`}</b> (${qtd} ${qtd===1?'parcela':'parcelas'}${vp>0?' de '+money(vp):''})${venc?`, de ${mesCurto(venc.slice(0,7))} a ${mesCurto(fim.slice(0,7))}`:''}.${vp>0?` Restante a pagar: <b>${money(vp*qtd)}</b>.`:''}${A>1?` As parcelas 1 a ${A-1} são consideradas já pagas e não entram no sistema.`:''}`;
    else prev.innerHTML = E.aplicarProximas.checked ? `As parcelas seguintes serão renumeradas a partir da ${A+1}, até a ${N}. Parcelas a pagar que passarem de ${N} serão excluídas; se faltar alguma, ela será criada mês a mês.` : 'Só este lançamento será alterado.';
  };
  f.addEventListener('input',sync); f.addEventListener('change',sync); sync();
}
function camposDespesa(fd){
  return {descricao:fd.descricao.trim(),categoria:fd.categoria,subcategoria:(fd.subcategoria||'').trim(),formaPagamento:fd.formaPagamento||'',comportamento:fd.comportamento,periodo:fd.periodo||'',dataCompra:fd.dataCompra||'',situacao:fd.situacao,dataPagamento:fd.situacao==='paga'?(fd.dataPagamento||hoje()):'',obs:(fd.obs||'').trim(),
    chavePix:fd.formaPagamento==='Pix'?(fd.chavePix||'').trim():'', pixCopiaCola:fd.formaPagamento==='Pix'?(fd.pixCopiaCola||'').trim():'', ...(fd.contaId!==undefined?{contaId:fd.contaId}:{})};
}
async function salvarDespesa(f){
  const fd=Object.fromEntries(new FormData(f)), id=f.dataset.id, valor=parseValor(fd.valor);
  if(!fd.descricao.trim()) return 'Informe a descrição.';
  if(!(valor>0)) return 'Informe um valor maior que zero, por exemplo 202,00.';
  if(!fd.categoria) return 'Escolha uma categoria.';
  if(!fd.vencimento) return 'Informe a data de vencimento.';
  const base=camposDespesa(fd), agora=new Date().toISOString();
  if(id) return editarDespesa(f,fd,base,valor);
  const modo=fd.modo||'unica';
  if(modo==='parcelada'){
    const A=parseInt(fd.parcelaAtual)||1, N=parseInt(fd.totalParcelas)||0;
    if(N<2) return 'Informe o total de parcelas (2 ou mais).';
    if(A<1||A>N) return `A parcela atual precisa estar entre 1 e ${N}.`;
    const total = fd.modoValor==='total' ? r2(valor) : r2(valor*N);
    const vp = fd.modoValor==='total' ? r2(Math.floor(total/N*100)/100) : r2(valor);
    const ult = fd.modoValor==='total' ? r2(total-vp*(N-1)) : vp;
    const arq=await enviarArquivo(); const grupo='g'+uid(); const rows=[];
    for(let n=A;n<=N;n++){ const i=n-A;
      rows.push({...base,valor:n===N?ult:vp,valorTotal:total,parcelas:N,parcelaAtual:n,grupoParcela:grupo,vencimento:addMesData(fd.vencimento,i),
        situacao:i===0?base.situacao:'pendente',dataPagamento:i===0?base.dataPagamento:'',...(i===0&&arq?arq:{})}); }
    await inserir('despesas',rows); toast(`${rows.length} ${rows.length>1?'parcelas lançadas':'parcela lançada'} (${A} a ${N}).`); return;
  }
  const arq=await enviarArquivo();
  let recorrenciaId='';
  if(modo==='mensal'){ recorrenciaId=await inserirRecorrencia({descricao:base.descricao,valor:r2(valor),categoria:base.categoria,subcategoria:base.subcategoria,formaPagamento:base.formaPagamento,periodo:base.periodo,dia:+fd.vencimento.slice(8,10),inicio:fd.vencimento.slice(0,7),geradoAte:fd.vencimento.slice(0,7),ativo:true,chavePix:base.chavePix,pixCopiaCola:base.pixCopiaCola}); base.comportamento='fixa'; }
  await inserir('despesas',{...base,valor:r2(valor),vencimento:fd.vencimento,parcelas:1,recorrenciaId,...(arq||{})});
  if(modo==='mensal') await garantirRecorrentes();
  toast(modo==='mensal'?'Conta fixa salva e lançada em todos os meses a partir deste.':'Despesa salva.');
}
async function editarDespesa(f,fd,base,valor){
  const id=f.dataset.id, d=S.desp.find(x=>x.id===id); if(!d) return 'Este lançamento não existe mais. Feche e atualize a página.';
  const agora=new Date().toISOString(), arq=await enviarArquivo();
  const grupo=(+d.parcelas||1)>1 && d.grupoParcela;
  if(!grupo){
    await atualizar('despesas',id,{...base,valor:r2(valor),vencimento:fd.vencimento,atualizadoEm:agora,conferido:true,...(arq||{})});
    if(arq && d.comprovante) apagarArquivos([d.comprovante]);
    toast('Despesa atualizada.'); return;
  }
  const A=parseInt(fd.parcelaAtual)||d.parcelaAtual, N=parseInt(fd.totalParcelas)||d.parcelas;
  if(N<2) return 'O total de parcelas precisa ser 2 ou mais.';
  if(A<1||A>N) return `A parcela precisa estar entre 1 e ${N}.`;
  const ups=[{id, dados:{...base,valor:r2(valor),vencimento:fd.vencimento,parcelaAtual:A,parcelas:N,atualizadoEm:agora,...(arq||{})}}];
  const apagar=[], criar=[];
  if(fd.aplicarProximas){
    const doGrupo=S.desp.filter(x=>x.grupoParcela===d.grupoParcela && x.id!==id).sort((a,b)=>(a.vencimento||'').localeCompare(b.vencimento||''));
    const antes=doGrupo.filter(x=>(x.vencimento||'')<(d.vencimento||'')).reverse(), depois=doGrupo.filter(x=>(x.vencimento||'')>=(d.vencimento||''));
    let n=A; for(const x of antes){ n--; ups.push({id:x.id,dados:{parcelaAtual:Math.max(1,n),parcelas:N}}); }
    n=A; let ultimo=fd.vencimento;
    for(const x of depois){ n++;
      if(n<=N){ ups.push({id:x.id,dados:{parcelaAtual:n,parcelas:N,...(x.situacao!=='paga'?{valor:r2(valor),descricao:base.descricao,categoria:base.categoria,subcategoria:base.subcategoria,formaPagamento:base.formaPagamento,periodo:base.periodo,chavePix:base.chavePix,pixCopiaCola:base.pixCopiaCola}:{})}}); ultimo=x.vencimento; }
      else if(x.situacao!=='paga') apagar.push(x);
      else ups.push({id:x.id,dados:{parcelaAtual:n,parcelas:Math.max(N,n)}});
    }
    while(n<N){ n++; ultimo=addMesData(ultimo,1);
      criar.push({...base,situacao:'pendente',dataPagamento:'',valor:r2(valor),valorTotal:d.valorTotal,parcelas:N,parcelaAtual:n,grupoParcela:d.grupoParcela,vencimento:ultimo}); }
  }
  for(const u of ups) chk(await sb.from('despesas').update(toDb(u.dados)).eq('id',u.id).eq('espaco_id',S.esp));
  if(apagar.length){ chk(await sb.from('despesas').delete().in('id',apagar.map(x=>x.id)).eq('espaco_id',S.esp)); apagarArquivos(apagar.map(x=>x.comprovante)); }
  if(criar.length) chk(await sb.from('despesas').insert(criar.map(r=>({...toDb(r),espaco_id:S.esp}))));
  if(arq && d.comprovante) apagarArquivos([d.comprovante]);
  await recarregar('despesas');
  toast(fd.aplicarProximas ? `Parcelamento ajustado: parcela ${A} de ${N}${apagar.length?`, ${apagar.length} excluída${apagar.length>1?'s':''}`:''}${criar.length?`, ${criar.length} criada${criar.length>1?'s':''}`:''}.` : 'Parcela atualizada.');
}

/* ---------- formulário de receita ---------- */
function formReceita(r){
  const novo=!r; r=r||{situacao:'prevista',origem:'Salário',dataPrevista:S.mes+'-10',periodo:''};
  return `<form data-form="receita" data-id="${r.id||''}">${head(novo?'Nova receita':'Editar receita')}
  ${novo?`<div class="seg"><button type="button" aria-pressed="false" data-act="novo" data-tipo="despesa">Despesa</button><button type="button" aria-pressed="true">Receita</button>${temContas()?`<button type="button" aria-pressed="false" data-act="novo" data-tipo="transferencia">Transferência</button>`:''}</div>`:''}
  ${blocoAnexo(r,'Envie o comprovante do Pix ou da transferência recebida. Eu leio o valor, a data e quem pagou.')}
  <div class="grupo"><span class="grupo-t">O que é</span>
    <div class="form-grid">
      <div class="field full"><label for="rDesc">Descrição</label><input id="rDesc" name="descricao" required maxlength="120" value="${esc(r.descricao)}" placeholder="Ex.: Salário, Comissão de setembro"></div>
      <div class="field"><label for="rOri">Origem</label><select id="rOri" name="origem">${opts(ORIGENS.map(x=>[x,x]),r.origem)}</select></div>
      <div class="field"><label for="rPer">Período de recebimento</label><select id="rPer" name="periodo">${opts([['auto','Pela data prevista'],['10','Dia 10'],['20','Dia 20'],['','Sem período']],novo?'auto':(r.periodo||''))}</select></div>
      <div class="field full"><label>Tipo de receita</label><div class="seg" id="segValor"><button type="button" aria-pressed="${!r.recorrenciaId}" data-act="modoValor" data-v="variavel">Variável</button><button type="button" aria-pressed="${!!r.recorrenciaId}" data-act="modoValor" data-v="fixa">Fixa (todo mês)</button></div><input type="hidden" name="modoValor" value="${r.recorrenciaId?'fixa':'variavel'}"></div>
      <p class="note full" data-show="fixa" style="margin:0">${r.recorrenciaId?'Receita fixa: entra em todos os meses com o mesmo valor e dia.':'Entra automaticamente em todos os meses a partir da data prevista, com o mesmo valor e dia. Os próximos 12 meses ficam sempre lançados.'}</p>
      ${r.recorrenciaId?`<label class="check full" data-show="fixa"><input type="checkbox" name="propagar" checked> Aplicar descrição, valor, dia e período também aos próximos meses</label><p class="note full" data-show="variavel" style="margin:0">Ao mudar para variável, a receita deixa de repetir: os meses futuros ainda não recebidos saem de Lançamentos.</p>`:''}
    </div></div>
  <div class="grupo"><span class="grupo-t">Previsto</span>
    <div class="form-grid">
      <div class="field"><label for="rPrev">Valor previsto (R$)</label><input id="rPrev" name="valorPrevisto" inputmode="decimal" required value="${fmtInput(r.valorPrevisto)}" placeholder="0,00"></div>
      <div class="field"><label for="rData">Data prevista</label><input id="rData" name="dataPrevista" type="date" required value="${r.dataPrevista||''}"></div>
    </div></div>
  <div class="grupo"><span class="grupo-t">Recebido</span>
    <div class="form-grid">
      <div class="field"><label for="rSit">Situação</label><select id="rSit" name="situacao">${opts([['prevista','A receber'],['recebida','Recebida'],['cancelada','Cancelada']],r.situacao)}</select></div>
      <div class="field" data-show="rec"><label for="rReal">Valor recebido (R$)</label><input id="rReal" name="valorRecebido" inputmode="decimal" value="${fmtInput(r.valorRecebido)}" placeholder="0,00"></div>
      <div class="field" data-show="rec"><label for="rEf">Recebido em</label><input id="rEf" name="dataEfetiva" type="date" value="${r.dataEfetiva||hoje()}"></div>
      ${campoConta(r.contaId,'Entra na conta')}
    </div></div>
  <div class="field"><label for="rObs">Observações</label><textarea id="rObs" name="obs" rows="2" maxlength="500">${esc(r.obs)}</textarea></div>
  ${rodape(novo?'Salvar receita':'Salvar alterações')}</form>`;
}
function wireReceita(root){ const f=root.querySelector('form'); const sync=()=>{ root.querySelectorAll('[data-show="rec"]').forEach(el=>el.hidden=f.elements.situacao.value!=='recebida'); const fx=f.elements.modoValor?.value; root.querySelectorAll('[data-show="fixa"]').forEach(el=>el.hidden=fx!=='fixa'); root.querySelectorAll('[data-show="variavel"]').forEach(el=>el.hidden=fx!=='variavel'); }; f.addEventListener('change',sync); sync(); }
async function salvarReceita(f){
  const fd=Object.fromEntries(new FormData(f)), id=f.dataset.id, vp=parseValor(fd.valorPrevisto);
  if(!fd.descricao.trim()) return 'Informe a descrição.';
  if(!(vp>=0)) return 'Informe o valor previsto, por exemplo 3200,00.';
  if(!fd.dataPrevista) return 'Informe a data prevista.';
  let vr=null; if(fd.situacao==='recebida'){ vr=parseValor(fd.valorRecebido); if(isNaN(vr)) vr=vp; if(vr<0) return 'O valor recebido não pode ser negativo.'; }
  const periodo = fd.periodo==='auto' ? (+fd.dataPrevista.slice(8,10)<=15?'10':'20') : fd.periodo;
  const arq=await enviarArquivo();
  const dados={descricao:fd.descricao.trim(),origem:fd.origem,valorPrevisto:r2(vp),dataPrevista:fd.dataPrevista,periodo,situacao:fd.situacao,valorRecebido:vr===null?null:r2(vr),...(fd.contaId!==undefined?{contaId:fd.contaId}:{}),dataEfetiva:fd.situacao==='recebida'?(fd.dataEfetiva||hoje()):'',obs:(fd.obs||'').trim(),...(arq||{})};
  const fixa=fd.modoValor==='fixa', ym=fd.dataPrevista.slice(0,7);
  const modelo=()=>({tipo:'receita',descricao:dados.descricao,origem:dados.origem,valor:r2(vp),dia:+fd.dataPrevista.slice(8,10),periodo,inicio:ym,geradoAte:ym,ativo:true});
  if(id){ const old=S.rec.find(x=>x.id===id), t=old?.recorrenciaId?S.recor.find(x=>x.id===old.recorrenciaId):null;
    let recorrenciaId=old?.recorrenciaId||null, msg='Receita atualizada.';
    if(fixa && !t){ recorrenciaId=await inserirRecorrencia(modelo()); msg='Receita agora é fixa e foi lançada nos próximos meses.'; }
    await atualizar('receitas',id,{...dados,...(recorrenciaId?{recorrenciaId}:{}),conferido:true,atualizadoEm:new Date().toISOString()}); if(arq&&old?.comprovante) apagarArquivos([old.comprovante]);
    if(t && fixa && fd.propagar){ const novo={descricao:dados.descricao,origem:dados.origem,valor:r2(vp),dia:+fd.dataPrevista.slice(8,10),periodo}; await atualizar('recorrencias',t.id,novo); await aplicarModeloFuturo(t,novo,ym); msg='Receita atualizada neste e nos próximos meses.'; }
    if(t && !fixa){ await aplicarModeloFuturo(t,{ativo:false},ym); await atualizar('recorrencias',t.id,{ativo:false}); msg='Receita deixou de repetir. Os meses futuros não recebidos foram retirados.'; }
    await garantirRecorrentes(); toast(msg); }
  else if(fixa){ const recorrenciaId=await inserirRecorrencia(modelo()); await inserir('receitas',{...dados,recorrenciaId}); await garantirRecorrentes(); toast('Receita fixa salva e lançada em todos os meses a partir deste.'); }
  else { await inserir('receitas',dados); toast('Receita salva.'); }
}
function abrirCat(c){
  abrirModal(`<form data-form="quick">${head(c?'Editar categoria':'Nova categoria')}<div class="field"><label for="cN">Nome</label><input id="cN" name="nome" required maxlength="40" value="${esc(c?.nome)}"></div>
    <label class="check"><input type="checkbox" name="alimentacao" ${c?.alimentacao?'checked':''}> Conta como gasto com alimentação</label>${rodape('Salvar')}</form>`,
  async f=>{ const nome=f.elements.nome.value.trim(); if(!nome) return 'Informe o nome.'; if(S.cats.some(x=>x.nome.toLowerCase()===nome.toLowerCase()&&x.id!==c?.id)) return 'Já existe uma categoria com esse nome.';
    if(c) await atualizar('categorias',c.id,{nome,alimentacao:f.elements.alimentacao.checked}); else await inserir('categorias',{nome,alimentacao:f.elements.alimentacao.checked,ordem:S.cats.length+1}); toast('Categoria salva.'); });
}
async function carregarMembros(){ const id=S.esp; try{ const d=chk(await sb.rpc('lista_membros',{e:id})); if(S.esp===id){ S.membros=d; schedule(); } }catch(e){ S.membros=[]; dbErr(e); } }
function baixar(nome,texto){ const url=URL.createObjectURL(new Blob([texto],{type:'application/json'})); const a=document.createElement('a'); a.href=url; a.download=nome; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(url),2000); }

/* ---------- metas: dívidas, plano de quitação e crédito (Etapa 10) ---------- */
const MT = () => window.MeuEixoMetas;
const TIPOS_DIV = {cartao:'Cartão de crédito (fatura ou rotativo)',cheque_especial:'Cheque especial',emprestimo:'Empréstimo pessoal',consignado:'Consignado',financiamento:'Financiamento',acordo:'Acordo ou renegociação',pessoa:'Dívida com pessoa',outra:'Outra dívida'};
const TIPOS_DIV_CURTO = {cartao:'Cartão',cheque_especial:'Cheque especial',emprestimo:'Empréstimo',consignado:'Consignado',financiamento:'Financiamento',acordo:'Acordo',pessoa:'Pessoa',outra:'Outra'};
const ESTRATEGIAS = {avalanche:{t:'Maior juros primeiro',d:'Paga menos juros no total. É a forma mais barata de sair das dívidas.'},bola:{t:'Menor saldo primeiro',d:'Quita uma dívida mais cedo e libera a parcela dela para a próxima. Ajuda a manter o ritmo.'}};
const curto = v => v>=1000 ? 'R$ '+(Math.round(v/100)/10).toLocaleString('pt-BR')+' mil' : 'R$ '+Math.round(v);
const pct = v => (Math.round(v*10)/10).toFixed(1).replace('.',',')+'%';
const ultimoDia = ym => ym+'-'+String(diasNoMes(ym)).padStart(2,'0');

async function carregarMetas(){
  const id=S.esp;
  try{
    const d=chk(await sb.from('dividas').select('*').eq('espaco_id',id).order('criado_em'));
    const m=chk(await sb.from('metas').select('*').eq('espaco_id',id).order('criado_em'));
    if(S.esp!==id) return; S.dividas=d.map(fromDb); S.metas=m.map(fromDb); S.metasErro=false;
  }catch(e){ console.error(e); S.dividas=[]; S.metas=[]; S.metasErro=true; }
  schedule();
}
const metaDe = tipo => (S.metas||[]).find(m=>m.tipo===tipo && m.ativo!==false) || null;
async function salvarMeta(tipo, patch){
  const m=metaDe(tipo), agora=new Date().toISOString();
  if(m) chk(await sb.from('metas').update(toDb({...patch,atualizadoEm:agora})).eq('id',m.id).eq('espaco_id',S.esp));
  else chk(await sb.from('metas').insert({...toDb({tipo,inicio:hoje(),ativo:true,...patch}),espaco_id:S.esp}));
  await carregarMetas();
}
async function gravarDivida(id, patch){
  if(id) chk(await sb.from('dividas').update(toDb({...patch,atualizadoEm:new Date().toISOString()})).eq('id',id).eq('espaco_id',S.esp));
  else chk(await sb.from('dividas').insert({...toDb(patch),espaco_id:S.esp}));
  await carregarMetas();
}

/* pagamentos já registrados (despesas pagas ligadas à dívida) */
const pagamentosDiv = id => S.desp.filter(d=>d.dividaId===id && ativa(d) && d.situacao==='paga').map(d=>({data:d.dataPagamento||d.vencimento,valor:+d.valor}));
const saldoDiv = (dv, ate=hoje()) => MT().saldoEstimado(dv, pagamentosDiv(dv.id), ate);
const dividasAtivas = () => (S.dividas||[]).filter(d=>!d.quitada);

/* compras parceladas do Financeiro, agrupadas */
function parcelamentos(){
  const g={};
  for(const d of S.desp){ if((+d.parcelas||1)<=1 || !ativa(d) || d.dividaId) continue;
    const k=d.grupoParcela || ['x',d.descricao,d.parcelas,r2(d.valorTotal||0)].join('|'); (g[k]=g[k]||[]).push(d); }
  return Object.entries(g).map(([k,arr])=>{
    arr.sort((a,b)=>(+a.parcelaAtual||0)-(+b.parcelaAtual||0));
    const ab=arr.filter(d=>d.situacao!=='paga'), agenda={};
    for(const d of ab){ const m=compDesp(d); if(m) agenda[m]=r2((agenda[m]||0)+(+d.valor||0)); }
    const meses=Object.keys(agenda).sort(), total=+arr[0].parcelas||arr.length;
    return { id:k, nome:arr[0].descricao, credito:arr.some(d=>d.formaPagamento==='Crédito'), total, pagas:Math.max(0,total-ab.length),
      restante:sum(ab,d=>d.valor), parcela:+(ab[0]||arr[0]).valor, proxima:ab[0]?.vencimento||null, fim:meses[meses.length-1]||null, agenda, linhas:arr };
  }).filter(p=>p.restante>0).sort((a,b)=>(a.fim||'').localeCompare(b.fim||''));
}

/* entrada da simulação a partir dos dados do espaço */
function entradaPlano(orcamento, estrategia){
  const ini=hoje().slice(0,7);
  const dividas=dividasAtivas().map(d=>({id:d.id,nome:d.nome,saldo:saldoDiv(d),jurosMes:+d.jurosMes||0,minimo:+d.parcela||0})).filter(d=>d.saldo>0);
  const parc=parcelamentos().map(p=>{ const ag={}; for(const [m,v] of Object.entries(p.agenda)){ const mm=m<ini?ini:m; ag[mm]=r2((ag[mm]||0)+v); } return {id:p.id,nome:p.nome,agenda:ag}; });
  return {inicio:ini, dividas, parcelamentos:parc, orcamento:orcamento??null, estrategia:estrategia||'avalanche'};
}
function analiseDividas(){
  const meta=metaDe('quitar_dividas'), est=meta?.dados?.estrategia||'avalanche';
  const e=entradaPlano(null,est), base=MT().simular(e), minimo=MT().minimoMensal(e);
  const orc=meta?.valorAlvo!=null ? +meta.valorAlvo : null;
  const plano = orc!=null ? MT().simular({...e,orcamento:orc}) : null;
  const prazoYm = meta?.prazo ? meta.prazo.slice(0,7) : null;
  const paraPrazo = prazoYm ? MT().valorParaPrazo(e,prazoYm) : null;
  const totalCad=sum(e.dividas,d=>d.saldo), parcs=parcelamentos(), totalParc=sum(parcs,p=>p.restante);
  const jurosMes=sum(e.dividas,d=>MT().jurosDoMes(d.saldo,d.jurosMes));
  return {meta,est,e,base,plano,orc,minimo,prazoYm,paraPrazo,totalCad,totalParc,total:r2(totalCad+totalParc),parcs,jurosMes};
}
/* dívida total no fim de cada mês passado (com os lançamentos) */
function evolucaoDividas(n=6){
  const fim=hoje().slice(0,7), out=[];
  for(let i=n-1;i>=0;i--){ const m=addMes(fim,-i), ate= i===0 ? hoje() : ultimoDia(m);
    const parc=sum(S.desp.filter(d=>(+d.parcelas||1)>1 && ativa(d) && !d.dividaId && (d.dataCompra||(d.criadoEm||'').slice(0,10)||'0000')<=ate && (compDesp(d)>m || (compDesp(d)<=m && d.situacao!=='paga'))),d=>d.valor);
    const cad=sum((S.dividas||[]).filter(d=>d.dataSaldo && d.dataSaldo<=ate && !(d.quitada && d.quitadaEm && d.quitadaEm<=ate)),d=>MT().saldoEstimado({...d,quitada:false},pagamentosDiv(d.id),ate));
    out.push({mes:m,total:r2(parc+cad),parcial:(S.dividas||[]).some(d=>d.dataSaldo && d.dataSaldo>ate && !d.quitada)}); }
  return out;
}
/* pagamentos mensais das dívidas cadastradas ainda não lançados no Financeiro */
const pagamentosFaltando = ym => dividasAtivas().filter(d=>+d.parcela>0 && d.dia && (d.dataSaldo||'').slice(0,7)<=ym && !S.desp.some(x=>x.dividaId===d.id && ativa(x) && compDesp(x)===ym));

/* cartão de crédito */
const ehCredito = d => d.formaPagamento==='Crédito' && ativa(d);
function analiseCredito(ym){
  const meses=[]; for(let i=-5;i<=6;i++) meses.push(addMes(ym,i));
  const porMes=meses.map(m=>{ const D=despMes(m).filter(ehCredito); return {mes:m,total:sum(D,d=>d.valor),parcelado:sum(D.filter(d=>(+d.parcelas||1)>1),d=>d.valor)}; });
  const atual=porMes[5], teto=metaDe('limite_credito')?.valorAlvo!=null ? +metaDe('limite_credito').valorAlvo : null;
  const anteriores=porMes.slice(2,5), media=anteriores.length?r2(anteriores.reduce((a,x)=>a+x.total,0)/anteriores.length):0;
  const futuros=porMes.slice(6), comprometido=sum(futuros,x=>x.total), prox=porMes[6];
  const D=despMes(ym).filter(ehCredito);
  const porCat=S.cats.map(c=>({c,v:sum(D.filter(d=>d.categoria===c.id),d=>d.valor)})).filter(x=>x.v>0).sort((a,b)=>b.v-a.v);
  const semCat=sum(D.filter(d=>!d.categoria),d=>d.valor); if(semCat) porCat.push({c:{nome:'Sem categoria'},v:semCat});
  const usados=porMes.slice(0,6).filter(x=>x.total>0), dentro=teto?usados.filter(x=>x.total<=teto).length:0;
  return {porMes,atual,teto,media,comprometido,prox,porCat,dentro,usados:usados.length};
}

/* gráfico de colunas (sem bibliotecas) */
function colunas(dados, o={}){
  const max=Math.max(1,o.linha||0,...dados.map(d=>d.v));
  return `<div class="cols${o.compacto?' compacto':''}" role="img" aria-label="${esc(o.rotulo||'Gráfico')}">
    ${o.linha?`<div class="cols-area" aria-hidden="true"><div class="cols-linha" style="bottom:${(o.linha/max*100).toFixed(1)}%"><span>${esc(o.linhaRot||'')} ${money(o.linha)}</span></div></div>`:''}
    ${dados.map(d=>`<div class="col ${d.cls||''}" title="${esc(d.titulo||'')}"><span class="col-v">${d.vRot??''}</span><div class="col-b"><i style="height:${Math.max(d.v>0?2:0,d.v/max*100).toFixed(1)}%"></i></div><span class="col-l">${esc(d.l)}</span></div>`).join('')}
  </div>`;
}

function vMetas(){
  if(S.metasErro) return `<div class="alert warn"><span class="dot"></span><div><p>Falta executar a atualização <b>007_dividas_metas.sql</b> no Supabase.</p><p class="hint">Abra o Supabase › SQL Editor › New query, cole o conteúdo do arquivo e clique em Run. Depois recarregue esta página.</p></div></div>`;
  if(S.dividas===undefined) return `<div class="empty"><strong>Carregando metas</strong>Um instante…</div>`;
  const tab=S.mtTab||'dividas';
  return `<div class="tabs" role="tablist"><button role="tab" aria-selected="${tab==='dividas'}" data-act="mtTab" data-v="dividas">Quitar dívidas</button><button role="tab" aria-selected="${tab==='credito'}" data-act="mtTab" data-v="credito">Reduzir o crédito</button></div>
  ${tab==='credito'?vMetaCredito():vMetaDividas()}`;
}

function vMetaDividas(){
  const A=analiseDividas(), {base,plano,meta,est}=A, ym=hoje().slice(0,7), rs=resumo(ym);
  const semNada=!A.e.dividas.length && !A.parcs.length;
  const quitadas=(S.dividas||[]).filter(d=>d.quitada);
  if(semNada) return `<div class="empty"><strong>Nenhuma dívida em aberto</strong>As compras parceladas de Lançamentos aparecem aqui sozinhas. Cadastre também cartão no rotativo, cheque especial, empréstimos, acordos ou dívidas com pessoas para montar o plano de quitação.<div class="actions" style="justify-content:center;margin-top:14px"><button class="btn primary" data-act="novaDivida">${icon(I.plus)}Cadastrar dívida</button></div></div>
    ${quitadas.length?blocoQuitadas(quitadas):''}`;
  const compMes = r2(sum(despMes(ym).filter(d=>ativa(d)&&((+d.parcelas||1)>1||d.dividaId)),d=>d.valor) + sum(pagamentosFaltando(ym),d=>d.parcela));
  const pctRenda = rs.recEsp>0 ? compMes/rs.recEsp*100 : null;
  const ref = plano || base;
  const fimTxt = ref.fim ? mesLabel(ref.fim) : 'sem data';
  const evo=evolucaoDividas(6), ant=evo[evo.length-2]?.total, atualEvo=evo[evo.length-1]?.total;
  const variacao = ant ? atualEvo-ant : null;
  const falt=pagamentosFaltando(S.mes);
  return `
  ${falt.length?`<div class="alert"><span class="dot"></span><div style="flex:1"><p>${falt.length} ${falt.length>1?'pagamentos de dívidas ainda não foram lançados':'pagamento de dívida ainda não foi lançado'} em ${mesLabel(S.mes)}: ${falt.map(d=>esc(d.nome)).join(', ')}.</p><div class="actions" style="margin-top:8px"><button class="btn sm primary" data-act="lancarPagDiv">Lançar agora</button></div></div></div>`:''}
  <section><div class="section-head"><h2>Situação das dívidas</h2><p>Hoje, com os seus lançamentos</p></div>
    <div class="kpis">
      <div class="kpi hero"><span class="lbl">Total devido</span><span class="val">${money(A.total)}</span><span class="sub">${money(A.totalCad)} em dívidas · ${money(A.totalParc)} em parcelas</span></div>
      <div class="kpi"><span class="lbl">Comprometido em ${MESES[+ym.slice(5)-1]}</span><span class="val ${pctRenda!==null&&pctRenda>30?'neg':''}">${money(compMes)}</span><span class="sub">${pctRenda!==null?`${pct(pctRenda)} da receita prevista · referência prudente: até 30%`:'cadastre as receitas do mês para ver o peso na renda'}</span></div>
      <div class="kpi"><span class="lbl">Juros por mês</span><span class="val ${A.jurosMes>0?'neg':''}">${money(A.jurosMes)}</span><span class="sub">${A.jurosMes>0?'quanto as dívidas crescem por mês sem pagamento':'nenhuma dívida com juros informados'}</span></div>
      <div class="kpi"><span class="lbl">${plano?'Quitação com o plano':'Quitação no ritmo atual'}</span><span class="val">${ref.fim?esc(mesCurto(ref.fim)):'—'}</span><span class="sub">${ref.fim?`${ref.meses} ${ref.meses===1?'mês':'meses'} · ${money(ref.juros)} de juros`:ref.deficit?'o valor mensal não cobre os mínimos':'há dívida que não diminui só com o mínimo'}</span></div>
    </div></section>
  ${blocoPlano(A)}
  <section class="panel"><h3>Evolução da dívida · últimos 6 meses</h3>
    ${evo.some(x=>x.total>0)?colunas(evo.map((x,i)=>({l:mesCurto(x.mes),v:x.total,vRot:x.total?curto(x.total):'',titulo:`${mesLabel(x.mes)}: ${money(x.total)}`,cls:i===evo.length-1?'atual':''})),{rotulo:'Dívida total no fim de cada mês'})
      +`<p class="small muted" style="margin:10px 0 0">${variacao===null||evo[evo.length-2].parcial?'O histórico se forma com os lançamentos e as atualizações de saldo.':variacao<0?`<b class="pos">A dívida caiu ${money(-variacao)}</b> desde o fim de ${mesLabel(evo[evo.length-2].mes)}.`:variacao>0?`<b class="neg">A dívida aumentou ${money(variacao)}</b> desde o fim de ${mesLabel(evo[evo.length-2].mes)}. Veja se entraram novas compras parceladas ou se algum pagamento não cobre os juros.`:'Sem variação em relação ao mês anterior.'}${evo.some(x=>x.parcial)?' Dívidas cadastradas entram a partir da data do saldo informado.':''}</p>`
      :`<p class="small muted">O histórico aparece com os lançamentos dos próximos meses.</p>`}
  </section>
  <section><div class="section-head"><h2>Suas dívidas</h2><p>Saldo estimado com juros e pagamentos registrados</p><div class="right"><button class="btn primary" data-act="novaDivida">${icon(I.plus)}Nova dívida</button></div></div>
    ${A.e.dividas.length||dividasAtivas().length?`<div class="list">${dividasAtivas().map(rowDivida).join('')}</div>`:`<p class="small muted">Nenhuma dívida cadastrada além das parcelas de Lançamentos. Cadastre cartão no rotativo, cheque especial, empréstimos e acordos para incluí-los no plano.</p>`}
  </section>
  ${A.parcs.length?`<section class="panel"><h3>Compras parceladas de Lançamentos</h3><p class="small muted" style="margin:-6px 0 10px">Entram no plano pelo calendário das parcelas. Quando uma termina, o valor dela passa para a próxima dívida.</p><div class="list">${A.parcs.map(rowParcelamento).join('')}</div></section>`:''}
  ${quitadas.length?blocoQuitadas(quitadas):''}
  <p class="note">Os valores são estimativas para decidir. O saldo oficial é o informado pelo credor: sempre que receber um extrato, use “Atualizar saldo”.</p>`;
}

function blocoPlano(A){
  const {meta,est,base,plano,orc,minimo,prazoYm,paraPrazo}=A;
  if(!meta) return `<section class="panel plano"><span class="eyebrow">Meta</span><h3>Defina quanto pode destinar às dívidas por mês</h3>
    <p class="small muted" style="margin:0 0 12px">Com esse valor eu monto a ordem de quitação, a data de saída das dívidas e quanto de juros você deixa de pagar. Hoje os pagamentos mínimos somam <b>${money(minimo)}</b> por mês.</p>
    <div class="actions"><button class="btn primary" data-act="metaDividas">Definir meta de quitação</button></div></section>`;
  const ordem = plano ? [...A.e.dividas].sort(est==='bola'?(a,b)=>a.saldo-b.saldo||b.jurosMes-a.jurosMes:(a,b)=>b.jurosMes-a.jurosMes||a.saldo-b.saldo) : [];
  const fimDe = id => plano?.dividas.find(x=>x.id===id)?.fim;
  const ganhoMeses = plano?.fim && base.fim ? MT().mesesEntre(plano.fim,base.fim) : null;
  const ganhoJuros = plano?.fim && base.fim ? r2(base.juros-plano.juros) : null;
  const naoQuita = base.nunca.map(id=>A.e.dividas.find(d=>d.id===id)?.nome).filter(Boolean);
  const prazoOk = prazoYm && plano?.fim ? plano.fim<=prazoYm : null;
  const serie = plano?.serie||[], passo=Math.max(1,Math.ceil(serie.length/18));
  return `<section class="panel plano"><div class="section-head" style="margin-bottom:6px"><h3 style="margin:0">Plano de quitação</h3><div class="right"><button class="btn sm" data-act="metaDividas">${icon(I.edit)}Ajustar meta</button></div></div>
    <div class="seg" style="max-width:520px;margin-bottom:6px">${Object.entries(ESTRATEGIAS).map(([k,v])=>`<button type="button" aria-pressed="${est===k}" data-act="estrategia" data-v="${k}">${v.t}</button>`).join('')}</div>
    <p class="small muted" style="margin:0 0 14px">${ESTRATEGIAS[est].d}</p>
    ${plano.deficit?`<div class="alert danger"><span class="dot"></span><div><p>${money(orc)} por mês não cobre os pagamentos mínimos (faltam ${money(plano.deficit.falta)} em ${mesLabel(plano.deficit.mes)}).</p><p class="hint">Os mínimos somam ${money(minimo)} neste mês. Aumente o valor ou renegocie a parcela de alguma dívida.</p></div></div>`:''}
    <div class="kpis plano-kpis">
      <div class="kpi"><span class="lbl">Valor mensal</span><span class="val">${money(orc)}</span><span class="sub">${orc>minimo?`${money(orc-minimo)} acima dos mínimos`:'igual aos mínimos'}</span></div>
      <div class="kpi"><span class="lbl">Livre das dívidas em</span><span class="val">${plano.fim?esc(mesCurto(plano.fim)):'—'}</span><span class="sub">${plano.fim?`${plano.meses} ${plano.meses===1?'mês':'meses'}${ganhoMeses>0?` · ${ganhoMeses} a menos que no ritmo atual`:''}`:'aumente o valor mensal'}</span></div>
      <div class="kpi"><span class="lbl">Juros até quitar</span><span class="val">${money(plano.juros)}</span><span class="sub">${ganhoJuros>0?`economia de ${money(ganhoJuros)} sobre o ritmo atual`:naoQuita.length?`no ritmo atual, ${esc(naoQuita.join(', '))} não ${naoQuita.length>1?'são quitadas':'é quitada'}`:'mesmo valor do ritmo atual'}</span></div>
      ${prazoYm?`<div class="kpi"><span class="lbl">Prazo desejado · ${esc(mesCurto(prazoYm))}</span><span class="val ${prazoOk===false?'neg':prazoOk?'pos':''}">${paraPrazo?money(paraPrazo):'—'}</span><span class="sub">${paraPrazo?`por mês para quitar até lá${prazoOk?' · o plano atual cumpre':prazoOk===false?` · faltam ${money(paraPrazo-orc)} por mês`:''}`:'prazo curto demais para os valores atuais'}</span></div>`:''}
    </div>
    ${ordem.length?`<h4 class="sub-h">Ordem de quitação</h4><ol class="ordem">${ordem.map((d,i)=>`<li><span class="n">${i+1}</span><div><b>${esc(d.nome)}</b><span class="small muted">${money(d.saldo)} · ${d.jurosMes?String(d.jurosMes).replace('.',',')+'% a.m.':'sem juros'}${d.minimo?` · mínimo ${money(d.minimo)}`:''}</span></div><span class="fim">${fimDe(d.id)?'quitada em '+esc(mesCurto(fimDe(d.id))):'—'}</span></li>`).join('')}</ol>
      <p class="small muted" style="margin:6px 0 0">Todo mês: pague o mínimo de cada dívida e as parcelas de Lançamentos; o que sobrar dos ${money(orc)} vai para a primeira dívida da lista e, quando ela acabar, para a seguinte.</p>`:''}
    ${serie.length>1?`<h4 class="sub-h">Saldo devedor previsto</h4>${colunas(serie.filter((x,i)=>i%passo===0||i===serie.length-1).map(x=>({l:mesCurto(x.mes),v:x.total,titulo:`${mesLabel(x.mes)}: ${money(x.total)}`})),{rotulo:'Saldo devedor previsto mês a mês',compacto:true})}`:''}
  </section>`;
}

function rowDivida(dv){
  const s=saldoDiv(dv), j=+dv.jurosMes||0, jm=MT().jurosDoMes(s,j), parc=+dv.parcela||0;
  const naoCobre = j>0 && s>0 && parc>0 && parc<=jm;
  const pagos=pagamentosDiv(dv.id).filter(p=>p.data>dv.dataSaldo), ops=[];
  if(dv.chavePix) ops.push(`<button class="btn sm pixbtn" data-act="copiarPixDiv" data-id="${dv.id}">${icon(I.copy)}Copiar Pix</button>`);
  ops.push(`<button class="btn sm sage" data-act="pagarDivida" data-id="${dv.id}">${icon(I.check)}Registrar pagamento</button>`);
  ops.push(`<button class="btn sm" data-act="saldoDivida" data-id="${dv.id}">Atualizar saldo</button>`);
  ops.push(`<button class="btn sm ghost" data-act="editDivida" data-id="${dv.id}" aria-label="Editar">${icon(I.edit)}</button>`);
  ops.push(`<button class="btn sm ghost" data-act="delDivida" data-id="${dv.id}" aria-label="Excluir">${icon(I.trash)}</button>`);
  return `<div class="row"><div><div class="t">${esc(dv.nome)}${naoCobre?' <span class="pill atrasada">Pagamento não cobre os juros</span>':''}</div>
    <div class="meta"><span>${esc(TIPOS_DIV_CURTO[dv.tipo]||'Dívida')}${dv.credor?' · '+esc(dv.credor):''}</span><span>${j?String(j).replace('.',',')+'% a.m. ≈ '+money(jm)+' de juros/mês':'sem juros'}</span>${parc?`<span>paga ${money(parc)}${dv.dia?' todo dia '+dv.dia:''}</span>`:'<span>sem pagamento mensal definido</span>'}${pillP(dv.periodo)}<span>saldo informado ${money(dv.saldo)} em ${dataCurta(dv.dataSaldo)}${pagos.length?` · ${pagos.length} ${pagos.length>1?'pagamentos':'pagamento'} depois`:''}</span></div></div>
    <div class="v">${money(s)}<div class="small muted">saldo hoje</div></div><div class="ops">${ops.join('')}</div></div>`;
}
function rowParcelamento(p){
  const pc=p.total?p.pagas/p.total:0;
  return `<div class="row"><div><div class="t">${esc(p.nome)}</div><div class="meta"><span>${p.pagas} de ${p.total} pagas</span><span>parcela ${money(p.parcela)}</span>${p.proxima?`<span>próxima ${dataCurta(p.proxima)}</span>`:''}${p.fim?`<span>termina em ${esc(mesCurto(p.fim))}</span>`:''}${p.credito?'<span class="pill">Crédito</span>':''}</div>
    <div class="bar" style="margin-top:8px;max-width:320px"><i style="width:${(pc*100).toFixed(0)}%"></i></div></div><div class="v">${money(p.restante)}<div class="small muted">a pagar</div></div><div class="ops"></div></div>`;
}
function blocoQuitadas(q){
  return `<section class="panel"><h3>Dívidas quitadas</h3><div class="list">${q.map(d=>`<div class="row"><div><div class="t">${esc(d.nome)} <span class="pill paga">Quitada</span></div><div class="meta"><span>${esc(TIPOS_DIV_CURTO[d.tipo]||'')}</span>${d.quitadaEm?`<span>em ${dataBR(d.quitadaEm)}</span>`:''}<span>pago ${money(sum(pagamentosDiv(d.id),p=>p.valor))} desde o cadastro</span></div></div><div class="v"></div><div class="ops"><button class="btn sm ghost" data-act="reabrirDivida" data-id="${d.id}">Reabrir</button><button class="btn sm ghost" data-act="delDivida" data-id="${d.id}" aria-label="Excluir">${icon(I.trash)}</button></div></div>`).join('')}</div></section>`;
}

function vMetaCredito(){
  const ym=S.mes, C=analiseCredito(ym), teto=C.teto, at=C.atual.total;
  const temDados=C.porMes.some(x=>x.total>0);
  const usoPc = teto ? at/teto : null;
  const livreProx = teto ? r2(teto-C.prox.total) : null;
  const cart=dividasAtivas().filter(d=>d.tipo==='cartao');
  return `
  ${!teto?`<section class="panel plano"><span class="eyebrow">Meta</span><h3>Defina um teto mensal para o cartão de crédito</h3><p class="small muted" style="margin:0 0 12px">${temDados?`Nos últimos 3 meses, a média no crédito foi de <b>${money(C.media)}</b> por mês. Um teto um pouco abaixo disso já cria uma redução gradual.`:'Lance as despesas com a forma de pagamento “Crédito” para eu acompanhar a fatura de cada mês.'}</p><div class="actions"><button class="btn primary" data-act="metaCredito">Definir teto do crédito</button></div></section>`:''}
  <section><div class="section-head"><h2>Cartão de crédito em ${mesLabel(ym)}</h2><p>Despesas com forma de pagamento “Crédito”, pelo vencimento</p>${teto?`<div class="right"><button class="btn sm" data-act="metaCredito">${icon(I.edit)}Ajustar teto</button></div>`:''}</div>
    <div class="kpis">
      <div class="kpi hero"><span class="lbl">No crédito neste mês</span><span class="val ${usoPc>1?'neg':''}">${money(at)}</span><span class="sub">${teto?`${Math.round(usoPc*100)}% do teto de ${money(teto)}`:'sem teto definido'}</span></div>
      <div class="kpi"><span class="lbl">Em compras parceladas</span><span class="val">${money(C.atual.parcelado)}</span><span class="sub">${at?`${Math.round(C.atual.parcelado/at*100)}% da fatura do mês`:'nada parcelado neste mês'}</span></div>
      <div class="kpi"><span class="lbl">Média dos 3 meses anteriores</span><span class="val">${money(C.media)}</span><span class="sub">${C.media&&at?(at<C.media?`<span class="pos">${money(C.media-at)} abaixo da média</span>`:at>C.media?`<span class="neg">${money(at-C.media)} acima da média</span>`:'igual à média'):'—'}</span></div>
      <div class="kpi"><span class="lbl">Já comprometido</span><span class="val">${money(C.comprometido)}</span><span class="sub">nos próximos 6 meses · ${money(C.prox.total)} em ${MESES[+C.prox.mes.slice(5)-1]}</span></div>
    </div></section>
  ${teto&&livreProx!==null?`<div class="alert ${livreProx<0?'danger':livreProx<teto*.25?'warn':'ok'}"><span class="dot"></span><div><p>${livreProx<0?`${mesLabel(C.prox.mes)} já começa ${money(-livreProx)} acima do teto só com parcelas.`:`Para respeitar o teto em ${mesLabel(C.prox.mes)}, novas compras no crédito precisam ficar abaixo de ${money(livreProx)}.`}</p><p class="hint">${livreProx<0?'Evite novas compras parceladas até as parcelas atuais terminarem.':'O valor já considera as parcelas que vão cair na próxima fatura.'}</p></div></div>`:''}
  <section class="panel"><h3>Crédito mês a mês</h3>
    ${temDados?colunas(C.porMes.map(x=>({l:mesCurto(x.mes),v:x.total,vRot:x.total?curto(x.total):'',titulo:`${mesLabel(x.mes)}: ${money(x.total)}${x.parcelado?` (${money(x.parcelado)} em parcelas)`:''}`,cls:(x.mes===ym?'atual ':'')+(x.mes>hoje().slice(0,7)?'futuro ':'')+(teto&&x.total>teto?'acima':'')})),{linha:teto,linhaRot:'teto',rotulo:'Total no crédito por mês'})
      +`<p class="small muted" style="margin:10px 0 0">Colunas claras são meses futuros: só parcelas já assumidas.${teto&&C.usados?` Nos últimos meses com uso, ${C.dentro} de ${C.usados} ficaram dentro do teto.`:''}</p>`
      :`<p class="small muted">Ainda não há despesas no crédito. Ao lançar uma despesa, escolha a forma de pagamento “Crédito”.</p>`}
  </section>
  <div class="grid2">
    <section class="panel"><h3>Onde o crédito foi usado</h3>${C.porCat.length?`<div class="list">${C.porCat.map(x=>linha(esc(x.c.nome),money(x.v))).join('')}</div>`:'<p class="small muted">Sem despesas no crédito neste mês.</p>'}</section>
    <section class="panel"><h3>Como reduzir</h3><ul class="dicas">
      <li>Prefira Pix ou débito para gastos do dia a dia: o dinheiro sai na hora e o mês fecha sem surpresa.</li>
      <li>Antes de parcelar, olhe a coluna dos próximos meses: cada parcela nova diminui o espaço do teto.</li>
      <li>Pague a fatura inteira. Se não der, evite o rotativo: ${cart.length?'cadastre a fatura em aberto em “Quitar dívidas” com os juros informados pelo banco':'o parcelamento da fatura costuma ter juros menores; confirme as taxas com o banco'}.</li>
    </ul></section>
  </div>`;
}

/* ---------- formulários e ações das metas ---------- */
function formDivida(d){
  d=d||{}; const novo=!d.id;
  return `<form data-form="quick">${head(novo?'Nova dívida':'Editar dívida')}<div class="form-grid">
    <div class="field full"><label for="dvN">Nome</label><input id="dvN" name="nome" required maxlength="60" placeholder="Ex.: Fatura Nubank, Empréstimo Caixa" value="${esc(d.nome)}"></div>
    <div class="field"><label for="dvT">Tipo</label><select id="dvT" name="tipo">${opts(Object.entries(TIPOS_DIV),d.tipo||'cartao')}</select></div>
    <div class="field"><label for="dvC">Credor (opcional)</label><input id="dvC" name="credor" maxlength="60" value="${esc(d.credor)}"></div>
    <div class="field"><label for="dvS">Saldo devedor (R$)</label><input id="dvS" name="saldo" inputmode="decimal" required value="${fmtInput(d.saldo)}"></div>
    <div class="field"><label for="dvD">Saldo na data</label><input id="dvD" name="dataSaldo" type="date" required value="${d.dataSaldo||hoje()}"></div>
    <div class="field"><label for="dvJ">Juros ao mês (%)</label><input id="dvJ" name="juros" inputmode="decimal" value="${d.jurosMes?String(d.jurosMes).replace('.',','):''}" placeholder="0"></div>
    <div class="field"><label for="dvP">Pagamento mensal (R$)</label><input id="dvP" name="parcela" inputmode="decimal" value="${fmtInput(d.parcela)}" placeholder="parcela ou mínimo"></div>
    <div class="field"><label for="dvDia">Dia do vencimento</label><input id="dvDia" name="dia" type="number" min="1" max="31" value="${d.dia||''}"></div>
    <div class="field"><label for="dvPer">Pagar com o recebimento</label><select id="dvPer" name="periodo">${opts([['','Decidir depois'],['10','Dia 10'],['20','Dia 20']],d.periodo||'')}</select></div>
    <div class="field"><label for="dvF">Forma de pagamento</label><select id="dvF" name="forma"><option value="">Selecione</option>${opts(FORMAS.map(x=>[x,x]),d.formaPagamento||'Pix')}</select></div>
    <div class="field"><label for="dvK">Chave Pix (opcional)</label><input id="dvK" name="chave" maxlength="140" autocomplete="off" value="${esc(d.chavePix)}"></div>
    <div class="field full"><label for="dvO">Observação</label><input id="dvO" name="obs" maxlength="200" value="${esc(d.obs)}"></div></div>
    <p class="note">Os juros mensais estão no extrato, na fatura ou no contrato (CET ao mês). Sem juros, deixe em branco. Compras parceladas já lançadas em Lançamentos não precisam ser cadastradas aqui.</p>${rodape(novo?'Cadastrar dívida':'Salvar')}</form>`;
}
function lerDivida(f){
  const g=n=>f.elements[n].value.trim(), saldo=parseValor(g('saldo')), juros=g('juros')?parseValor(g('juros')):0, parcela=g('parcela')?parseValor(g('parcela')):null, dia=g('dia')?+g('dia'):null;
  if(!g('nome')) return 'Informe o nome da dívida.';
  if(isNaN(saldo)||saldo<0) return 'Informe o saldo devedor, por exemplo 2350,00.';
  if(isNaN(juros)||juros<0||juros>30) return 'Informe os juros ao mês entre 0 e 30%.';
  if(parcela!==null&&(isNaN(parcela)||parcela<=0)) return 'Informe o pagamento mensal ou deixe em branco.';
  if(dia!==null&&!(dia>=1&&dia<=31)) return 'Informe um dia entre 1 e 31.';
  return {nome:g('nome'),tipo:g('tipo'),credor:g('credor'),saldo:r2(saldo),dataSaldo:g('dataSaldo'),jurosMes:r2(juros*1000)/1000,parcela:parcela===null?null:r2(parcela),dia,periodo:g('periodo'),formaPagamento:g('forma'),chavePix:g('chave'),obs:g('obs')};
}
const catDividas = () => catPorNome('Dívidas e parcelas') || S.cats[0]?.id || '';
function vencDivida(dv, ym){ return ym+'-'+String(Math.min(+dv.dia||10,diasNoMes(ym))).padStart(2,'0'); }

const acoesMetas = {
  mtTab: el => { S.mtTab=el.dataset.v; render(); },
  novaDivida: () => abrirModal(formDivida(), async f=>{ const d=lerDivida(f); if(typeof d==='string') return d;
    await gravarDivida(null,{...d,quitada:d.saldo===0,quitadaEm:d.saldo===0?hoje():null,historico:[{data:d.dataSaldo,saldo:d.saldo}]}); toast('Dívida cadastrada. O plano foi recalculado.'); }),
  editDivida: el => { const dv=S.dividas.find(x=>x.id===el.dataset.id); if(!dv) return;
    abrirModal(formDivida(dv), async f=>{ const d=lerDivida(f); if(typeof d==='string') return d;
      const hist=[...(dv.historico||[])]; if(d.saldo!==+dv.saldo||d.dataSaldo!==dv.dataSaldo) hist.push({data:d.dataSaldo,saldo:d.saldo});
      await gravarDivida(dv.id,{...d,historico:hist}); toast('Dívida atualizada.'); }); },
  saldoDivida: el => { const dv=S.dividas.find(x=>x.id===el.dataset.id); if(!dv) return;
    abrirModal(`<form data-form="quick">${head('Atualizar saldo')}<p class="muted" style="margin:0">${esc(dv.nome)} · estimado hoje ${money(saldoDiv(dv))}</p>
      <div class="form-grid"><div class="field"><label for="usV">Saldo informado pelo credor (R$)</label><input id="usV" name="v" inputmode="decimal" required value="${fmtInput(saldoDiv(dv))}"></div><div class="field"><label for="usD">Data do extrato</label><input id="usD" name="d" type="date" required value="${hoje()}"></div></div>
      <p class="note">Pagamentos registrados depois desta data continuam sendo descontados. Saldo zero marca a dívida como quitada.</p>${rodape('Salvar saldo')}</form>`,
    async f=>{ const v=parseValor(f.elements.v.value), d=f.elements.d.value; if(isNaN(v)||v<0) return 'Informe o saldo.';
      await gravarDivida(dv.id,{saldo:r2(v),dataSaldo:d,historico:[...(dv.historico||[]),{data:d,saldo:r2(v)}],...(v===0?{quitada:true,quitadaEm:d}:{})}); toast(v===0?'Dívida quitada. Parabéns pelo passo!':'Saldo atualizado.'); }); },
  pagarDivida: el => { const dv=S.dividas.find(x=>x.id===el.dataset.id); if(!dv) return; const s=saldoDiv(dv);
    const pend=S.desp.filter(x=>x.dividaId===dv.id && ativa(x) && x.situacao!=='paga').sort((a,b)=>(a.vencimento||'').localeCompare(b.vencimento||''))[0];
    abrirModal(`<form data-form="quick">${head('Registrar pagamento')}<p class="muted" style="margin:0">${esc(dv.nome)} · saldo estimado ${money(s)}${pend?` · lançamento pendente de ${dataBR(pend.vencimento)}`:''}</p>
      <div class="form-grid"><div class="field"><label for="pgV">Valor pago (R$)</label><input id="pgV" name="v" inputmode="decimal" required value="${fmtInput(pend?.valor||Math.min(+dv.parcela||s,s))}"></div><div class="field"><label for="pgD">Pago em</label><input id="pgD" name="d" type="date" required value="${hoje()}"></div>
      <div class="field"><label for="pgF">Forma de pagamento</label><select id="pgF" name="forma">${opts(FORMAS.map(x=>[x,x]),pend?.formaPagamento||dv.formaPagamento||'Pix')}</select></div></div>
      <p class="note">${pend?'O lançamento pendente de Lançamentos será marcado como pago.':'Vira uma despesa paga em “Dívidas e parcelas” em Lançamentos, ligada a esta dívida.'}</p>${rodape('Registrar pagamento')}</form>`,
    async f=>{ const v=parseValor(f.elements.v.value), d=f.elements.d.value, forma=f.elements.forma.value; if(!(v>0)) return 'Informe o valor pago.';
      if(pend) await atualizar('despesas',pend.id,{situacao:'paga',valor:r2(v),dataPagamento:d,formaPagamento:forma});
      else await inserir('despesas',{descricao:'Pagamento · '+dv.nome,valor:r2(v),categoria:catDividas(),comportamento:'fixa',formaPagamento:forma,vencimento:d,dataPagamento:d,situacao:'paga',periodo:dv.periodo||'',parcelas:1,dividaId:dv.id,chavePix:dv.chavePix||''});
      const resta=saldoDiv(dv);
      if(resta<=0.01){ await gravarDivida(dv.id,{quitada:true,quitadaEm:d}); toast('Pagamento registrado. Dívida quitada!'); } else toast(`Pagamento registrado. Saldo estimado: ${money(resta)}.`); }); },
  delDivida: el => { const dv=S.dividas.find(x=>x.id===el.dataset.id); if(!dv) return; const n=S.desp.filter(x=>x.dividaId===dv.id).length;
    confirmar('Excluir dívida',`Excluir “${esc(dv.nome)}”?${n?` Os ${n} lançamentos de pagamento continuam em Lançamentos.`:''} Se ela foi paga, prefira “Atualizar saldo” com zero para guardar o histórico.`,[{t:'Excluir',fn:async()=>{ chk(await sb.from('dividas').delete().eq('id',dv.id).eq('espaco_id',S.esp)); await carregarMetas(); await recarregar('despesas'); toast('Dívida excluída.'); }}]); },
  reabrirDivida: async el => { await gravarDivida(el.dataset.id,{quitada:false,quitadaEm:null}); toast('Dívida reaberta.'); },
  copiarPixDiv: async el => { const dv=S.dividas.find(x=>x.id===el.dataset.id); if(!dv?.chavePix) return;
    try{ await navigator.clipboard.writeText(dv.chavePix); toast('Chave Pix copiada. Cole no app do banco.'); }catch(_){ abrirModal(`<div>${head('Chave Pix')}</div><p class="code" style="word-break:break-all;margin:0">${esc(dv.chavePix)}</p>`,null); } },
  lancarPagDiv: async el => { el.disabled=true; const ym=S.mes, falt=pagamentosFaltando(ym);
    try{ await inserir('despesas',falt.map(dv=>({descricao:'Pagamento · '+dv.nome,valor:r2(dv.parcela),categoria:catDividas(),comportamento:'fixa',formaPagamento:dv.formaPagamento||'',vencimento:vencDivida(dv,ym),situacao:'pendente',periodo:dv.periodo||'',parcelas:1,dividaId:dv.id,chavePix:dv.chavePix||''})));
      toast(`${falt.length} ${falt.length>1?'pagamentos lançados':'pagamento lançado'} em ${mesLabel(ym)}.`); }catch(e){ dbErr(e); el.disabled=false; } },
  estrategia: async el => { const m=metaDe('quitar_dividas'); await salvarMeta('quitar_dividas',{dados:{...(m?.dados||{}),estrategia:el.dataset.v}}); },
  metaDividas: () => { const m=metaDe('quitar_dividas'), e=entradaPlano(null), min=MT().minimoMensal(e);
    abrirModal(`<form data-form="quick">${head('Meta: quitar as dívidas')}<p class="muted" style="margin:0">Os pagamentos mínimos e as parcelas de Lançamentos somam <b>${money(min)}</b> neste mês. Tudo o que você destinar acima disso acelera a quitação.</p>
      <div class="form-grid"><div class="field"><label for="mdV">Valor por mês para dívidas (R$)</label><input id="mdV" name="v" inputmode="decimal" required value="${fmtInput(m?.valorAlvo??min)}"></div>
      <div class="field"><label for="mdP">Quero quitar até (opcional)</label><input id="mdP" name="p" type="month" value="${m?.prazo?m.prazo.slice(0,7):''}" min="${hoje().slice(0,7)}"></div>
      <div class="field full"><label>Ordem de quitação</label><div class="seg" id="segValor">${Object.entries(ESTRATEGIAS).map(([k,v])=>`<button type="button" aria-pressed="${(m?.dados?.estrategia||'avalanche')===k}" data-act="modoValor" data-v="${k}">${v.t}</button>`).join('')}</div><input type="hidden" name="modoValor" value="${m?.dados?.estrategia||'avalanche'}"></div></div>
      <p class="note">Com o prazo, eu calculo quanto por mês seria necessário para cumpri-lo e comparo com o valor escolhido.</p>${rodape('Salvar meta')}</form>`,
    async f=>{ const v=parseValor(f.elements.v.value), p=f.elements.p.value; if(!(v>0)) return 'Informe o valor mensal.';
      await salvarMeta('quitar_dividas',{titulo:'Quitar dívidas',valorAlvo:r2(v),prazo:p?p+'-01':null,dados:{...(m?.dados||{}),estrategia:f.elements.modoValor.value}}); toast('Meta salva. O plano foi recalculado.'); }); },
  metaCredito: () => { const m=metaDe('limite_credito'), C=analiseCredito(S.mes);
    abrirModal(`<form data-form="quick">${head('Meta: teto do cartão de crédito')}<p class="muted" style="margin:0">Média dos últimos 3 meses: <b>${money(C.media)}</b>. Já comprometido em ${mesLabel(C.prox.mes)}: <b>${money(C.prox.total)}</b>.</p>
      <div class="field"><label for="mcV">Teto mensal no crédito (R$)</label><input id="mcV" name="v" inputmode="decimal" required value="${fmtInput(m?.valorAlvo??(C.media?Math.round(C.media*.9):''))}"></div>
      <p class="note">O alerta aparece no Início quando o mês chega a 85% do teto e quando passa dele.</p>${rodape('Salvar teto')}</form>`,
    async f=>{ const v=parseValor(f.elements.v.value); if(!(v>0)) return 'Informe o teto mensal.'; await salvarMeta('limite_credito',{titulo:'Reduzir o uso do crédito',valorAlvo:r2(v)}); toast('Teto do crédito salvo.'); }); }
};

/* alertas do gestor ligados às metas */
function alertasMetas(ym){
  const a=[]; if(S.metasErro||!S.dividas) return a;
  const teto=metaDe('limite_credito')?.valorAlvo;
  if(teto){ const g=sum(despMes(ym).filter(ehCredito),d=>d.valor);
    if(g>teto) a.push({k:'danger',t:`O crédito passou do teto em ${mesLabel(ym)}: ${money(g)} de ${money(+teto)}.`,h:'Até o fim do mês, prefira Pix ou débito. Veja os próximos meses em Metas.'});
    else if(g>=teto*.85) a.push({k:'warn',t:`O crédito já usou ${Math.round(g/teto*100)}% do teto do mês.`,h:`Restam ${money(teto-g)} até o teto de ${money(+teto)}.`}); }
  const crescem=dividasAtivas().filter(d=>+d.jurosMes>0 && +d.parcela>0 && +d.parcela<=MT().jurosDoMes(saldoDiv(d),d.jurosMes));
  if(crescem.length) a.push({k:'danger',t:`${crescem.map(d=>esc(d.nome)).join(', ')}: o pagamento mensal não cobre os juros, então a dívida cresce.`,h:'Priorize esta dívida no plano de quitação ou procure renegociar a taxa.'});
  const falt=pagamentosFaltando(ym);
  if(falt.length) a.push({k:'',t:`${falt.length} ${falt.length>1?'pagamentos de dívidas ainda não foram lançados':'pagamento de dívida ainda não foi lançado'} em ${mesLabel(ym)}.`,h:'Use “Lançar agora” em Metas para incluí-los nos dias 10 e 20.'});
  return a;
}

/* ---------- contas fixas: lançamento automático ---------- */
const HORIZONTE_REC = 11; // mês atual + 11 = 12 meses lançados à frente
const linhaRecorrente = (t, ym) => ({descricao:t.descricao,valor:r2(t.valor),categoria:t.categoria||'',subcategoria:t.subcategoria||'',formaPagamento:t.formaPagamento||'',comportamento:'fixa',periodo:t.periodo||'',
  vencimento:ym+'-'+String(Math.min(+t.dia||10,diasNoMes(ym))).padStart(2,'0'),situacao:'pendente',parcelas:1,recorrenciaId:t.id,chavePix:t.chavePix||'',pixCopiaCola:t.pixCopiaCola||'',favorecido:t.favorecido||''});
// cria o modelo; sem a atualização 008, grava sem o controle de meses lançados
async function inserirRecorrencia(o){ try{ return await inserir('recorrencias',o); }catch(e){ const m=e?.message||'';
  if(o.tipo==='receita' && /(tipo|origem)/.test(m)) throw {message:'Para receitas fixas, execute a atualização 009_receitas_fixas.sql no Supabase (SQL Editor).'};
  if(/gerado_ate/.test(m)){ const {geradoAte,...resto}=o; return await inserirRecorrencia(resto); } throw e; } }
const dataNoMes = (ym,dia) => ym+'-'+String(Math.min(+dia||10,diasNoMes(ym))).padStart(2,'0');
const linhaReceitaFixa = (t, ym) => ({descricao:t.descricao,origem:t.origem||'Salário',valorPrevisto:r2(t.valor),dataPrevista:dataNoMes(ym,t.dia),situacao:'prevista',periodo:t.periodo||'',recorrenciaId:t.id});
let gerandoRec=false;
async function garantirRecorrentes(){
  if(gerandoRec || !S.recor.length || S.fase!=='pronto') return;
  if(S.recor.some(t=>!('geradoAte' in t))){ S.falta008=true; schedule(); return; }
  S.falta008=false;
  const atual=hoje().slice(0,7), base=addMes(atual,HORIZONTE_REC), alvo=S.mes>base?S.mes:base, esp=S.esp;
  gerandoRec=true; const criadas={despesas:0,receitas:0}; let mexeu=false;
  try{
    for(const t of S.recor){
      if(t.ativo===false) continue;
      const desde = t.geradoAte ? addMes(t.geradoAte,1) : (t.inicio||atual);
      if(desde>alvo) continue;
      const R=ehRecR(t), tab=R?'receitas':'despesas', ja=lancsRec(t), rows=[];
      for(let m=desde; m<=alvo; m=addMes(m,1)) if(!ja.some(x=>compL(t,x)===m)) rows.push(R?linhaReceitaFixa(t,m):linhaRecorrente(t,m));
      // trava otimista: só um aparelho lança cada intervalo
      let q=sb.from('recorrencias').update({gerado_ate:alvo}).eq('id',t.id).eq('espaco_id',esp);
      q = t.geradoAte ? q.eq('gerado_ate',t.geradoAte) : q.is('gerado_ate',null);
      const ok=chk(await q.select('id')); mexeu=true;
      if(!ok.length || S.esp!==esp) continue;
      if(rows.length){ chk(await sb.from(tab).insert(rows.map(r=>({...toDb(r),espaco_id:esp})))); criadas[tab]+=rows.length; }
    }
    if(criadas.despesas) await recarregar('despesas');
    if(criadas.receitas) await recarregar('receitas');
    if(mexeu) await recarregar('recorrencias');
  }catch(e){ console.error(e); if(/gerado_ate/.test(e?.message||'')){ S.falta008=true; schedule(); } }
  finally{ gerandoRec=false; }
}
/* alterações no modelo valem para os lançamentos ainda não pagos/recebidos deste mês em diante */
async function aplicarModeloFuturo(t, novo, desde){
  const atual=desde||hoje().slice(0,7), R=ehRecR(t), tab=R?'receitas':'despesas';
  const alvos=lancsRec(t).filter(x=>!quitadoL(t,x) && ativa(x) && compL(t,x)>=atual);
  if(novo.ativo===false){
    const sair=alvos.filter(x=>compL(t,x)>atual).map(x=>x.id);
    if(sair.length) chk(await sb.from(tab).delete().in('id',sair).eq('espaco_id',S.esp));
    chk(await sb.from('recorrencias').update({gerado_ate:atual}).eq('id',t.id).eq('espaco_id',S.esp));
  }
  for(const x of alvos){ if(novo.ativo===false && compL(t,x)>atual) continue;
    const ym=compL(t,x), m={...t,...novo,id:t.id};
    const patch = R ? (({descricao,origem,valorPrevisto,dataPrevista,periodo})=>({descricao,origem,valorPrevisto,dataPrevista,periodo}))(linhaReceitaFixa(m,ym))
      : (l=>({descricao:l.descricao,valor:l.valor,categoria:l.categoria,formaPagamento:l.formaPagamento,periodo:l.periodo,vencimento:l.vencimento,chavePix:l.chavePix,pixCopiaCola:l.pixCopiaCola}))(linhaRecorrente(m,ym));
    chk(await sb.from(tab).update(toDb(patch)).eq('id',x.id).eq('espaco_id',S.esp)); }
  await recarregar(tab);
}

/* ---------- contas, transferências, ajustes e estornos (Etapa 1 da evolução) ---------- */
const TIPOS_CONTA = {corrente:'Conta corrente',poupanca:'Poupança',carteira:'Carteira (dinheiro)',investimento:'Investimento',outra:'Outra'};
const temContas = () => !S.contasErro && Array.isArray(S.contas);
const contasAtivas = () => (S.contas||[]).filter(c=>c.ativa!==false).sort((a,b)=>(b.padrao-a.padrao)||(a.ordem-b.ordem)||a.nome.localeCompare(b.nome,'pt'));
const contaPadrao = () => contasAtivas().find(c=>c.padrao) || contasAtivas()[0] || null;
const contaById = id => (S.contas||[]).find(c=>c.id===id);
const contaNome = id => contaById(id)?.nome || '';
const contaDe = x => x.contaId || contaPadrao()?.id || null;

async function carregarContas(){
  const id=S.esp;
  try{
    const c=chk(await sb.from('contas').select('*').eq('espaco_id',id).order('ordem'));
    const t=chk(await sb.from('transferencias').select('*').eq('espaco_id',id).order('data',{ascending:false}).limit(2000));
    if(S.esp!==id) return; S.contas=c.map(fromDb); S.transf=t.map(fromDb); S.contasErro=false;
  }catch(e){ console.error(e); if(S.esp===id){ S.contas=[]; S.transf=[]; S.contasErro=true; } }
  schedule();
}
async function gravar(t, id, patch){
  if(id) chk(await sb.from(t).update(toDb(patch)).eq('id',id).eq('espaco_id',S.esp));
  else chk(await sb.from(t).insert({...toDb(patch),espaco_id:S.esp}));
  await carregarContas();
}

/* saldo de uma conta até uma data (inclusive) */
function saldoConta(c, ate=hoje()){
  const base=c.dataSaldo; let s=+c.saldoInicial||0;
  if(!base || ate<base) return r2(s);
  const ehPadrao = contaPadrao()?.id===c.id, minha = x => x.contaId ? x.contaId===c.id : ehPadrao;
  for(const r of S.rec) if(r.situacao==='recebida' && r.dataEfetiva && r.dataEfetiva>=base && r.dataEfetiva<=ate && minha(r)) s+= +r.valorRecebido||0;
  for(const d of S.desp){ const dp=d.dataPagamento||d.vencimento; if(d.situacao==='paga' && dp && dp>=base && dp<=ate && minha(d)) s-= +d.valor||0; }
  for(const t of S.transf||[]){ if(!t.data || t.data<base || t.data>ate) continue;
    if(t.contaDestino===c.id) s+= +t.valor||0;
    if(t.tipo==='transferencia' && t.contaOrigem===c.id) s-= +t.valor||0; }
  return r2(s);
}
const saldoEmConta = (ate=hoje()) => r2(contasAtivas().reduce((a,c)=>a+saldoConta(c,ate),0));

/* estornos: dinheiro de volta de uma despesa */
const ehEstorno = r => r.natureza==='estorno';
const estornosDe = id => S.rec.filter(r=>ehEstorno(r) && r.estornoDe===id && r.situacao!=='cancelada');
const valorEstornado = id => sum(estornosDe(id),r=>r.valorRecebido??r.valorPrevisto);
const valorLiq = d => r2(Math.max(0,(+d.valor||0)-valorEstornado(d.id)));

/* faixa com o saldo de cada conta */
function faixaContas(){
  if(S.contasErro) return `<div class="alert warn"><span class="dot"></span><div><p>Para usar contas, transferências e estornos, execute a atualização <b>011_contas_movimentacoes.sql</b> no Supabase (SQL Editor).</p></div></div>`;
  if(!temContas()) return '';
  const cs=contasAtivas();
  if(!cs.length) return `<section class="contas-faixa vazia"><div><b>Cadastre suas contas</b><span class="small muted">Banco, poupança, carteira: com o saldo de cada uma, o Meu Eixo mostra quanto você tem hoje.</span></div><button class="btn sm primary" data-act="novaConta">${icon(I.plus)}Nova conta</button></section>`;
  return `<section class="contas-faixa"><div class="cf-total"><span class="lbl">Saldo em conta</span><b class="num">${money(saldoEmConta())}</b><span class="small muted">hoje, somando ${cs.length} ${cs.length>1?'contas':'conta'}</span></div>
    <div class="cf-lista">${cs.map(c=>{ const s=saldoConta(c); return `<button type="button" class="cf-item" data-act="editConta" data-id="${c.id}"><span class="small muted">${esc(c.nome)}${c.padrao&&!/principal/i.test(c.nome)&&contasAtivas().length>1?' · principal':''}</span><b class="num ${s<0?'neg':''}">${money(s)}</b></button>`; }).join('')}
    <button type="button" class="cf-item cf-add" data-act="novaConta" aria-label="Nova conta">${icon(I.plus)}<span class="small">Conta</span></button></div></section>`;
}

/* aba Movimentações: transferências, ajustes e estornos do mês */
function vMovimentacoes(ym){
  if(S.contasErro) return `<div class="empty"><strong>Atualização pendente</strong>Execute a atualização 011_contas_movimentacoes.sql no Supabase para registrar transferências, ajustes e estornos.</div>`;
  const T=(S.transf||[]).filter(t=>(t.data||'').slice(0,7)===ym).sort((a,b)=>b.data.localeCompare(a.data));
  const E=S.rec.filter(r=>ehEstorno(r) && compRec(r)===ym).sort((a,b)=>String(b.dataEfetiva||b.dataPrevista).localeCompare(String(a.dataEfetiva||a.dataPrevista)));
  if(!T.length && !E.length) return `<div class="empty"><strong>Nenhuma movimentação em ${mesLabel(ym)}</strong>Transferências entre contas, ajustes de saldo e estornos aparecem aqui. Eles não contam como receita nem como despesa.</div>`;
  const rowT = t => { const aj=t.tipo==='ajuste';
    return `<div class="row"><div><div class="t">${aj?'Ajuste de saldo':'Transferência'}${t.descricao&&t.descricao!=='Ajuste de saldo'?' · '+esc(t.descricao):''}</div><div class="meta"><span>${dataCurta(t.data)}</span><span>${aj?esc(contaNome(t.contaDestino)):`${esc(contaNome(t.contaOrigem))} → ${esc(contaNome(t.contaDestino))}`}</span><span class="pill ${aj?'':'mov'}">${aj?'Ajuste':'Entre contas'}</span></div></div>
      <div class="v ${aj?(t.valor<0?'neg':'pos'):''}">${aj&&t.valor>0?'+':''}${money(t.valor)}</div><div class="ops"><button class="btn sm ghost" data-act="editTransf" data-id="${t.id}" aria-label="Editar">${icon(I.edit)}</button><button class="btn sm ghost" data-act="delTransf" data-id="${t.id}" aria-label="Excluir">${icon(I.trash)}</button></div></div>`; };
  const rowE = r => { const d=S.desp.find(x=>x.id===r.estornoDe);
    return `<div class="row"><div><div class="t">${esc(r.descricao)}</div><div class="meta"><span>${dataCurta(r.dataEfetiva||r.dataPrevista)}</span>${d?`<span>${esc(catNome(d.categoria))}</span>`:''}${r.contaId||contaPadrao()?`<span>${esc(contaNome(contaDe(r)))}</span>`:''}<span class="pill paga">Estorno</span></div></div>
      <div class="v pos">+${money(r.valorRecebido??r.valorPrevisto)}</div><div class="ops"><button class="btn sm ghost" data-act="excluir" data-col="receitas" data-id="${r.id}" aria-label="Excluir">${icon(I.trash)}</button></div></div>`; };
  return `<div class="list">${T.map(rowT).join('')}${E.map(rowE).join('')}</div>
    <p class="small muted" style="margin-top:10px">Transferências mudam o saldo de cada conta, mas não o total. Ajustes corrigem o saldo de uma conta. Estornos devolvem dinheiro e reduzem o gasto da despesa original.</p>`;
}

/* formulários */
const optsContas = (sel, extra=[]) => opts([...extra, ...contasAtivas().map(c=>[c.id,c.nome+(c.padrao?' (principal)':'')])], sel);
const campoConta = (sel, rotulo='Conta') => temContas() && contasAtivas().length ? `<div class="field"><label for="fConta">${rotulo}</label><select id="fConta" name="contaId">${optsContas(sel||contaPadrao()?.id)}</select></div>` : '';

function formConta(c){
  c=c||{}; const novo=!c.id, s=c.id?saldoConta(c):null;
  return `<form data-form="quick">${head(novo?'Nova conta':'Editar conta')}${novo?'':`<p class="muted" style="margin:0">Saldo calculado hoje: <b>${money(s)}</b></p>`}
    <div class="form-grid">
      <div class="field full"><label for="ctN">Nome</label><input id="ctN" name="nome" required maxlength="40" value="${esc(c.nome)}" placeholder="Ex.: Nubank, Itaú, Carteira"></div>
      <div class="field"><label for="ctT">Tipo</label><select id="ctT" name="tipo">${opts(Object.entries(TIPOS_CONTA),c.tipo||'corrente')}</select></div>
      <div class="field"><label for="ctS">Saldo (R$)</label><input id="ctS" name="saldo" inputmode="decimal" required value="${fmtInput(c.saldoInicial??'')}" placeholder="0,00"></div>
      <div class="field"><label for="ctD">No início do dia</label><input id="ctD" name="data" type="date" required value="${c.dataSaldo||hoje()}"></div>
      <label class="check full"><input type="checkbox" name="padrao" ${c.padrao||(novo&&!contasAtivas().length)?'checked':''}> Conta principal (usada quando o lançamento não informa a conta)</label>
      ${novo?'':`<label class="check full"><input type="checkbox" name="ativa" ${c.ativa!==false?'checked':''}> Conta em uso (desmarque para arquivar)</label>`}
    </div><p class="note">Informe o saldo que a conta tinha no início do dia escolhido. A partir dele, o Meu Eixo soma o que foi recebido e subtrai o que foi pago nesta conta. Para corrigir uma diferença depois, use “Ajuste de saldo”.</p>${novo?rodape('Criar conta'):`<p class="err" id="formErr"></p><footer><button type="button" class="btn danger" data-act="delConta" data-id="${c.id}" style="margin-right:auto">Excluir</button><button type="button" class="btn" data-act="fechar">Cancelar</button><button class="btn primary" type="submit">Salvar</button></footer>`}</form>`;
}
function formTransf(t){
  t=t||{}; const novo=!t.id, aj=t.tipo==='ajuste', cs=contasAtivas();
  const c0=t.contaDestino||contaPadrao()?.id, saldoReal = aj&&t.id ? r2(saldoConta(contaById(c0),t.data)) : '';
  return `<form data-form="quick" data-id="${t.id||''}">${head(novo?'Nova movimentação':'Editar movimentação')}
    ${novo?`<div class="seg"><button type="button" aria-pressed="false" data-act="novo" data-tipo="despesa">Despesa</button><button type="button" aria-pressed="false" data-act="novo" data-tipo="receita">Receita</button><button type="button" aria-pressed="true">Transferência</button></div>`:''}
    <div class="field full" style="margin-top:12px"><label>O que é</label><div class="seg" id="segValor"><button type="button" aria-pressed="${!aj}" data-act="modoValor" data-v="transferencia" ${cs.length<2?'disabled title="Cadastre ao menos duas contas"':''}>Transferência entre contas</button><button type="button" aria-pressed="${aj}" data-act="modoValor" data-v="ajuste">Ajuste de saldo</button></div><input type="hidden" name="modoValor" value="${aj||cs.length<2?'ajuste':'transferencia'}"></div>
    <div class="form-grid" data-show="transferencia">
      <div class="field"><label for="trO">De</label><select id="trO" name="origem">${optsContas(t.contaOrigem||cs[0]?.id)}</select></div>
      <div class="field"><label for="trD">Para</label><select id="trD" name="destino">${optsContas(t.contaDestino||cs[1]?.id)}</select></div>
      <div class="field"><label for="trV">Valor (R$)</label><input id="trV" name="valor" inputmode="decimal" value="${!aj&&t.valor?fmtInput(t.valor):''}" placeholder="0,00"></div>
    </div>
    <div class="form-grid" data-show="ajuste">
      <div class="field"><label for="ajC">Conta</label><select id="ajC" name="contaAj">${optsContas(c0)}</select></div>
      <div class="field"><label for="ajS">Saldo correto da conta (R$)</label><input id="ajS" name="saldoReal" inputmode="decimal" value="${aj&&t.id?fmtInput(saldoReal):''}" placeholder="como aparece no banco"></div>
      <p class="note full" id="ajPrev" style="margin:0"></p>
    </div>
    <div class="form-grid">
      <div class="field"><label for="trData">Data</label><input id="trData" name="data" type="date" required value="${t.data||hoje()}"></div>
      <div class="field"><label for="trDesc">Descrição (opcional)</label><input id="trDesc" name="descricao" maxlength="80" value="${esc(t.descricao)}" placeholder="Ex.: Guardar na poupança"></div>
    </div>${rodape(novo?'Salvar':'Salvar alterações')}</form>`;
}
function wireTransf(root, t){
  const f=root.querySelector('form');
  const sync=()=>{ const m=f.elements.modoValor.value;
    root.querySelectorAll('[data-show="transferencia"]').forEach(el=>el.hidden=m!=='transferencia'); root.querySelectorAll('[data-show="ajuste"]').forEach(el=>el.hidden=m!=='ajuste');
    const c=contaById(f.elements.contaAj.value), v=parseValor(f.elements.saldoReal.value), prev=root.querySelector('#ajPrev');
    if(m==='ajuste' && c && prev){ const data=f.elements.data.value||hoje(); const atual=r2(saldoConta(c,data)-(t?.tipo==='ajuste'&&t.contaDestino===c.id&&t.data<=data?+t.valor:0));
      prev.innerHTML = isNaN(v) ? `Saldo calculado em ${dataCurta(data)}: <b>${money(atual)}</b>. Informe o saldo correto para criar o ajuste.` : (r2(v-atual)===0 ? 'O saldo já está correto. Nenhum ajuste é necessário.' : `Ajuste de <b>${v-atual>0?'+':''}${money(v-atual)}</b> (calculado ${money(atual)}).`); } };
  f.addEventListener('input',sync); f.addEventListener('change',sync); sync();
}
async function salvarTransf(f, t){
  const E=f.elements, m=E.modoValor.value, data=E.data.value, descricao=E.descricao.value.trim();
  if(!data) return 'Informe a data.';
  if(m==='transferencia'){ const v=parseValor(E.valor.value);
    if(!(v>0)) return 'Informe o valor da transferência.'; if(E.origem.value===E.destino.value) return 'Escolha contas diferentes para origem e destino.';
    await gravar('transferencias',t?.id,{tipo:'transferencia',contaOrigem:E.origem.value,contaDestino:E.destino.value,valor:r2(v),data,descricao}); toast('Transferência registrada.'); return; }
  const c=contaById(E.contaAj.value), v=parseValor(E.saldoReal.value); if(!c) return 'Escolha a conta.'; if(isNaN(v)) return 'Informe o saldo correto da conta.';
  const atual=r2(saldoConta(c,data)-(t?.tipo==='ajuste'&&t.contaDestino===c.id&&t.data<=data?+t.valor:0)), dif=r2(v-atual);
  if(dif===0){ if(t?.id){ chk(await sb.from('transferencias').delete().eq('id',t.id).eq('espaco_id',S.esp)); await carregarContas(); toast('Saldo já estava correto; ajuste removido.'); return; } return 'O saldo já está correto. Nenhum ajuste é necessário.'; }
  await gravar('transferencias',t?.id,{tipo:'ajuste',contaOrigem:null,contaDestino:c.id,valor:dif,data,descricao:descricao||'Ajuste de saldo'}); toast(`Saldo de ${c.nome} ajustado (${dif>0?'+':''}${money(dif)}).`);
}

const acoesContas = {
  novaConta: () => abrirModal(formConta(), async f=>{ const E=f.elements, v=parseValor(E.saldo.value);
    if(!E.nome.value.trim()) return 'Informe o nome da conta.'; if(isNaN(v)) return 'Informe o saldo, por exemplo 1250,00 (pode ser 0).';
    if(E.padrao.checked) for(const c of S.contas.filter(x=>x.padrao)) chk(await sb.from('contas').update({padrao:false}).eq('id',c.id).eq('espaco_id',S.esp));
    await gravar('contas',null,{nome:E.nome.value.trim(),tipo:E.tipo.value,saldoInicial:r2(v),dataSaldo:E.data.value,padrao:E.padrao.checked||!contasAtivas().length,ativa:true,ordem:(S.contas||[]).length+1}); toast('Conta criada.'); }),
  editConta: el => { const c=contaById(el.dataset.id); if(!c) return;
    abrirModal(formConta(c),
    async f=>{ const E=f.elements, v=parseValor(E.saldo.value); if(!E.nome.value.trim()) return 'Informe o nome da conta.'; if(isNaN(v)) return 'Informe o saldo.';
      if(E.padrao.checked) for(const x of S.contas.filter(x=>x.padrao&&x.id!==c.id)) chk(await sb.from('contas').update({padrao:false}).eq('id',x.id).eq('espaco_id',S.esp));
      await gravar('contas',c.id,{nome:E.nome.value.trim(),tipo:E.tipo.value,saldoInicial:r2(v),dataSaldo:E.data.value,padrao:E.padrao.checked,ativa:E.ativa.checked}); toast('Conta atualizada.'); }); },
  delConta: el => { const c=contaById(el.dataset.id); if(!c) return; const n=S.desp.filter(d=>d.contaId===c.id).length+S.rec.filter(r=>r.contaId===c.id).length, nt=(S.transf||[]).filter(t=>t.contaOrigem===c.id||t.contaDestino===c.id).length;
    confirmar('Excluir conta',`Excluir “${esc(c.nome)}”?${n?` ${n} lançamentos ficam sem conta e passam para a conta principal.`:''}${nt?` ${nt} transferências e ajustes desta conta serão apagados.`:''} Para guardar o histórico, prefira desmarcar “Conta em uso”.`,
      [{t:'Excluir conta',fn:async()=>{ chk(await sb.from('contas').delete().eq('id',c.id).eq('espaco_id',S.esp)); await carregarContas(); await recarregar('despesas'); await recarregar('receitas'); toast('Conta excluída.'); }}]); },
  novaTransf: () => { if(!contasAtivas().length){ toast('Cadastre uma conta primeiro.'); return acoesContas.novaConta(); } abrirModal(formTransf(), f=>salvarTransf(f,null), r=>wireTransf(r,null)); },
  editTransf: el => { const t=(S.transf||[]).find(x=>x.id===el.dataset.id); if(t) abrirModal(formTransf(t), f=>salvarTransf(f,t), r=>wireTransf(r,t)); },
  delTransf: el => { const t=(S.transf||[]).find(x=>x.id===el.dataset.id); if(!t) return;
    confirmar('Excluir movimentação',`Excluir ${t.tipo==='ajuste'?'o ajuste':'a transferência'} de ${money(t.valor)} em ${dataBR(t.data)}?`,[{t:'Excluir',fn:async()=>{ chk(await sb.from('transferencias').delete().eq('id',t.id).eq('espaco_id',S.esp)); await carregarContas(); toast('Movimentação excluída.'); }}]); },
  estornar: el => { const d=S.desp.find(x=>x.id===el.dataset.id); if(!d) return; const resta=valorLiq(d);
    abrirModal(`<form data-form="quick">${head('Registrar estorno')}<p class="muted" style="margin:0">${esc(d.descricao)} · ${money(d.valor)}${valorEstornado(d.id)?` · já estornado ${money(valorEstornado(d.id))}`:''}</p>
      <div class="form-grid"><div class="field"><label for="esV">Valor devolvido (R$)</label><input id="esV" name="v" inputmode="decimal" required value="${fmtInput(resta)}"></div><div class="field"><label for="esD">Data</label><input id="esD" name="d" type="date" required value="${hoje()}"></div>${campoConta(d.contaId,'Devolvido na conta')}</div>
      <p class="note">O estorno não conta como receita: ele reduz o gasto desta despesa e volta para o saldo da conta.</p>${rodape('Registrar estorno')}</form>`,
    async f=>{ const v=parseValor(f.elements.v.value), data=f.elements.d.value; if(!(v>0)) return 'Informe o valor devolvido.'; if(v>resta+0.009) return `O valor passa do que falta estornar (${money(resta)}).`;
      await inserir('receitas',{descricao:'Estorno · '+d.descricao,origem:'Reembolso',natureza:'estorno',estornoDe:d.id,valorPrevisto:r2(v),valorRecebido:r2(v),dataPrevista:data,dataEfetiva:data,situacao:'recebida',periodo:'',...(f.elements.contaId?{contaId:f.elements.contaId.value}:{})});
      toast(`Estorno de ${money(v)} registrado.`); }); }
};

/* ---------- ações ---------- */
const acoes = {
  ir: el => { S.view=el.dataset.v; fecharMenu(); render(); window.scrollTo(0,0); },
  mes: el => { S.mes=addMes(S.mes,+el.dataset.n); render(); if(S.mes>addMes(hoje().slice(0,7),HORIZONTE_REC)) garantirRecorrentes(); },
  tab: el => { S.tab=el.dataset.v; render(); },
  fechar: () => fecharModal(),
  recarregarPagina: () => location.reload(),
  auth: el => { S.auth=el.dataset.v; S.authMsg=''; render(); },
  sair: async () => { await sb.auth.signOut(); },
  novo: el => { if(el.dataset.tipo==='transferencia') return acoesContas.novaTransf();
    if(el.dataset.tipo==='receita') abrirModal(formReceita(),salvarReceita,wireReceita);
    else { if(!S.cats.length){ fecharModal(); toast('Crie ao menos uma categoria em Configurações.'); S.view='config'; render(); return; } abrirModal(formDespesa(),salvarDespesa,wireDespesa); } },
  editar: el => { const col=el.dataset.col, id=el.dataset.id;
    if(col==='despesas'){ const d=S.desp.find(x=>x.id===id); if(d) abrirModal(formDespesa(d),salvarDespesa,wireDespesa); }
    else { const r=S.rec.find(x=>x.id===id); if(r) abrirModal(formReceita(r),salvarReceita,wireReceita); } },
  pagar: el => { const d=S.desp.find(x=>x.id===el.dataset.id); if(!d) return;
    abrirModal(`<form data-form="quick" data-ref="${d.id}">${head('Marcar como paga')}<p class="muted" style="margin:0">${esc(d.descricao)}${(+d.parcelas||1)>1?` · parcela ${d.parcelaAtual} de ${d.parcelas}`:''} · vence ${dataBR(d.vencimento)}</p>
      ${d.pixCopiaCola||d.chavePix?`<div class="pix-box"><div><span class="small muted">Chave Pix salva</span><b>${esc(d.chavePix||'Pix copia e cola')}</b></div><button type="button" class="btn sm pixbtn" data-act="copiarPix" data-id="${d.id}">${icon(I.copy)}Copiar</button></div>`:''}
      ${blocoAnexo(d,'Anexe o comprovante do pagamento. Eu confiro o valor e a data para você.')}
      <div class="form-grid"><div class="field"><label for="qV">Valor pago (R$)</label><input id="qV" name="v" inputmode="decimal" required value="${fmtInput(d.valor)}"></div><div class="field"><label for="qD">Pago em</label><input id="qD" name="d" type="date" required value="${hoje()}"></div></div>${rodape('Confirmar pagamento','sage')}</form>`,
    async f=>{ const v=parseValor(f.elements.v.value); if(!(v>0)) return 'Informe o valor pago.'; const arq=await enviarArquivo();
      await atualizar('despesas',d.id,{situacao:'paga',valor:r2(v),dataPagamento:f.elements.d.value,...(arq||{})}); if(arq&&d.comprovante) apagarArquivos([d.comprovante]); toast('Pagamento registrado.'); }); },
  receber: el => { const r=S.rec.find(x=>x.id===el.dataset.id); if(!r) return;
    abrirModal(`<form data-form="quick" data-ref="${r.id}">${head('Registrar recebimento')}<p class="muted" style="margin:0">${esc(r.descricao)} · previsto ${money(r.valorPrevisto)} em ${dataBR(r.dataPrevista)}</p>
      ${blocoAnexo(r,'Anexe o comprovante do recebimento, se tiver.')}
      <div class="form-grid"><div class="field"><label for="qV">Valor recebido (R$)</label><input id="qV" name="v" inputmode="decimal" required value="${fmtInput(r.valorPrevisto)}"></div><div class="field"><label for="qD">Recebido em</label><input id="qD" name="d" type="date" required value="${hoje()}"></div></div>${rodape('Confirmar recebimento','sage')}</form>`,
    async f=>{ const v=parseValor(f.elements.v.value); if(!(v>=0)) return 'Informe o valor recebido.'; const arq=await enviarArquivo();
      await atualizar('receitas',r.id,{situacao:'recebida',valorRecebido:r2(v),dataEfetiva:f.elements.d.value,...(arq||{})}); if(arq&&r.comprovante) apagarArquivos([r.comprovante]); toast('Recebimento registrado.'); }); },
  modo: el => { definirSeg(el.closest('form'),'modo',el.dataset.v); },
  modoValor: el => { definirSeg(el.closest('form'),'modoValor',el.dataset.v); },
  escolherArquivo: () => { const i=$('#arqComp'); if(i){ i.value=''; i.click(); } },
  enviarComprovante: el => { acoes.novo(el); const i=$('#arqComp'); if(i) i.click(); },
  verComp: async el => { const path=el.dataset.path; if(!path) return; const w=window.open('','_blank');
    try{ const d=chk(await sb.storage.from('comprovantes').createSignedUrl(path,600)); if(w) w.location.href=d.signedUrl; else abrirModal(`<div>${head('Comprovante')}</div><p style="margin:0"><a class="btn primary" href="${esc(d.signedUrl)}" target="_blank" rel="noopener">Abrir comprovante</a></p>`,null); }
    catch(e){ if(w) w.close(); dbErr(e); } },
  copiarPix: async el => { const d=S.desp.find(x=>x.id===el.dataset.id)||S.recor.find(x=>x.id===el.dataset.id); if(!d) return; const txt=d.pixCopiaCola||d.chavePix;
    try{ await navigator.clipboard.writeText(txt); toast(d.pixCopiaCola?'Pix copia e cola copiado. Cole no app do banco.':'Chave Pix copiada. Cole no app do banco.'); }
    catch(_){ abrirModal(`<div>${head('Chave Pix')}</div><p class="small muted" style="margin:0">Toque e segure para copiar.</p><p class="code" style="word-break:break-all;margin:0">${esc(txt)}</p>`,null); } },
  periodo: el => atualizar('despesas',el.dataset.id,{periodo:el.dataset.p}),
  periodoR: el => atualizar('receitas',el.dataset.id,{periodo:el.dataset.p}),
  excluir: el => { const col=el.dataset.col, id=el.dataset.id;
    if(col==='despesas'){ const d=S.desp.find(x=>x.id===id); if(!d) return;
      if(d.grupoParcela){ const prox=S.desp.filter(x=>x.grupoParcela===d.grupoParcela&&(+x.parcelaAtual)>=(+d.parcelaAtual));
        confirmar('Excluir parcela',`${esc(d.descricao)} é a parcela ${d.parcelaAtual} de ${d.parcelas}. O que deseja excluir?`,[
          {t:'Só esta parcela',cls:'',fn:async()=>{ await remover('despesas',id); apagarArquivos([d.comprovante]); toast('Parcela excluída.'); }},
          {t:`Esta e as próximas (${prox.length})`,fn:async()=>{ await remover('despesas',prox.map(x=>x.id)); apagarArquivos(prox.map(x=>x.comprovante)); toast(`${prox.length} parcelas excluídas.`); }}]);
      } else confirmar('Excluir despesa',`Excluir “${esc(d.descricao)}” (${money(d.valor)})? Esta ação não pode ser desfeita.`,[{t:'Excluir',fn:async()=>{ await remover('despesas',id); apagarArquivos([d.comprovante]); toast('Despesa excluída.'); }}]);
    } else { const r=S.rec.find(x=>x.id===id); if(!r) return; const t=r.recorrenciaId?S.recor.find(x=>x.id===r.recorrenciaId):null;
      if(t){ const prox=S.rec.filter(x=>x.recorrenciaId===t.id && x.situacao!=='recebida' && compRec(x)>=compRec(r) && x.id!==r.id);
        confirmar('Excluir receita fixa',`${esc(r.descricao)} se repete todo mês. O que deseja excluir?`,[
          {t:'Só este mês',cls:'',fn:async()=>{ await remover('receitas',id); apagarArquivos([r.comprovante]); toast('Receita do mês excluída.'); }},
          {t:`Este e os próximos (${prox.length+1})`,fn:async()=>{ await remover('receitas',[id,...prox.map(x=>x.id)]); apagarArquivos([r.comprovante]); await atualizar('recorrencias',t.id,{ativo:false,geradoAte:addMes(compRec(r),-1)}); toast('Receita fixa encerrada.'); }}]); return; }
      confirmar('Excluir receita',`Excluir “${esc(r.descricao)}”? Esta ação não pode ser desfeita.`,[{t:'Excluir',fn:async()=>{ await remover('receitas',id); apagarArquivos([r.comprovante]); toast('Receita excluída.'); }}]); } },
  conf: async el => { const fn=confirmar.cb?.[+el.dataset.i]; if(!fn) return; el.disabled=true; try{ await fn(); fecharModal(); }catch(e){ dbErr(e); el.disabled=false; } },
  gerarRecorrentes: async el => { el.disabled=true; const ym=S.mes, faltam=recorrentesFaltando(ym); const [Y,M]=ym.split('-').map(Number), last=new Date(Y,M,0).getDate();
    try{ await inserir('despesas',faltam.map(t=>({descricao:t.descricao,valor:r2(t.valor),categoria:t.categoria||'',subcategoria:t.subcategoria||'',formaPagamento:t.formaPagamento||'',comportamento:'fixa',periodo:t.periodo||'',vencimento:ym+'-'+String(Math.min(+t.dia||10,last)).padStart(2,'0'),situacao:'pendente',parcelas:1,recorrenciaId:t.id,chavePix:t.chavePix||'',pixCopiaCola:t.pixCopiaCola||''})));
      toast(`${faltam.length} ${faltam.length>1?'contas fixas lançadas':'conta fixa lançada'} em ${mesLabel(ym)}.`); }catch(e){ dbErr(e); el.disabled=false; } },
  copiarOrc: async () => { await salvarOrc(S.mes,{...orcamentoMes(addMes(S.mes,-1))}); toast('Orçamento copiado do mês anterior.'); },
  novaCat: () => abrirCat(),
  editCat: el => abrirCat(S.cats.find(c=>c.id===el.dataset.id)),
  delCat: el => { const c=S.cats.find(x=>x.id===el.dataset.id); if(!c) return; const n=S.desp.filter(d=>d.categoria===c.id).length;
    if(n){ confirmar('Categoria em uso',`“${esc(c.nome)}” tem ${n} lançamentos. Para excluí-la, mova esses lançamentos para outra categoria editando cada um, ou mantenha a categoria.`,[]); return; }
    confirmar('Excluir categoria',`Excluir a categoria “${esc(c.nome)}”?`,[{t:'Excluir',fn:async()=>{ await remover('categorias',c.id); toast('Categoria excluída.'); }}]); },
  editRecor: el => { const t=S.recor.find(x=>x.id===el.dataset.id); if(!t) return;
    if(ehRecR(t)) return abrirModal(`<form data-form="quick">${head('Receita fixa')}<div class="form-grid">
      <div class="field full"><label for="tD">Descrição</label><input id="tD" name="descricao" required value="${esc(t.descricao)}"></div>
      <div class="field"><label for="tV">Valor (R$)</label><input id="tV" name="valor" inputmode="decimal" required value="${fmtInput(t.valor)}"></div>
      <div class="field"><label for="tDia">Dia do recebimento</label><input id="tDia" name="dia" type="number" min="1" max="31" required value="${t.dia}"></div>
      <div class="field"><label for="tO">Origem</label><select id="tO" name="origem">${opts(ORIGENS.map(x=>[x,x]),t.origem||'Salário')}</select></div>
      <div class="field"><label for="tP">Período</label><select id="tP" name="periodo">${opts([['','Sem período'],['10','Dia 10'],['20','Dia 20']],t.periodo||'')}</select></div>
      <label class="check full"><input type="checkbox" name="ativo" ${t.ativo!==false?'checked':''}> Ativa (lança todo mês)</label></div>
      <p class="note">A alteração vale para os meses ainda não recebidos, do atual em diante. Ao pausar, os meses futuros não recebidos saem de Lançamentos.</p>${rodape('Salvar')}</form>`,
    async f=>{ const v=parseValor(f.elements.valor.value), dia=+f.elements.dia.value; if(!(v>0)) return 'Informe o valor.'; if(!(dia>=1&&dia<=31)) return 'Informe um dia entre 1 e 31.';
      const novo={descricao:f.elements.descricao.value.trim(),valor:r2(v),dia,origem:f.elements.origem.value,periodo:f.elements.periodo.value,ativo:f.elements.ativo.checked};
      await atualizar('recorrencias',t.id,novo); await aplicarModeloFuturo(t,novo); if(novo.ativo&&t.ativo===false) chk(await sb.from('recorrencias').update({gerado_ate:hoje().slice(0,7)}).eq('id',t.id).eq('espaco_id',S.esp)); await recarregar('recorrencias'); await garantirRecorrentes(); toast('Receita fixa atualizada.'); });
    abrirModal(`<form data-form="quick">${head('Conta fixa recorrente')}<div class="form-grid">
      <div class="field full"><label for="tD">Descrição</label><input id="tD" name="descricao" required value="${esc(t.descricao)}"></div>
      <div class="field"><label for="tV">Valor (R$)</label><input id="tV" name="valor" inputmode="decimal" required value="${fmtInput(t.valor)}"></div>
      <div class="field"><label for="tDia">Dia do vencimento</label><input id="tDia" name="dia" type="number" min="1" max="31" required value="${t.dia}"></div>
      <div class="field"><label for="tC">Categoria</label><select id="tC" name="categoria">${opts(S.cats.map(c=>[c.id,c.nome]),t.categoria)}</select></div>
      <div class="field"><label for="tP">Pagar com o recebimento</label><select id="tP" name="periodo">${opts([['','Decidir depois'],['10','Dia 10'],['20','Dia 20']],t.periodo||'')}</select></div>
      <div class="field"><label for="tF">Forma de pagamento</label><select id="tF" name="forma"><option value="">Selecione</option>${opts(FORMAS.map(x=>[x,x]),t.formaPagamento)}</select></div>
      <div class="field"><label for="tK">Chave Pix</label><input id="tK" name="chave" maxlength="140" autocomplete="off" value="${esc(t.chavePix)}"></div>
      <div class="field full"><label for="tCC">Pix copia e cola (opcional)</label><input id="tCC" name="copia" maxlength="600" autocomplete="off" value="${esc(t.pixCopiaCola)}"></div>
      <label class="check full"><input type="checkbox" name="ativo" ${t.ativo!==false?'checked':''}> Ativa (gera lançamento todo mês)</label></div>
      <p class="note">A alteração vale para os lançamentos ainda não pagos deste mês em diante. Meses já pagos não mudam. Ao pausar, os meses futuros não pagos saem de Lançamentos.</p>${rodape('Salvar')}</form>`,
    async f=>{ const v=parseValor(f.elements.valor.value), dia=+f.elements.dia.value; if(!(v>0)) return 'Informe o valor.'; if(!(dia>=1&&dia<=31)) return 'Informe um dia entre 1 e 31.';
      const novo={descricao:f.elements.descricao.value.trim(),valor:r2(v),dia,categoria:f.elements.categoria.value,periodo:f.elements.periodo.value,ativo:f.elements.ativo.checked,formaPagamento:f.elements.forma.value,chavePix:f.elements.chave.value.trim(),pixCopiaCola:f.elements.copia.value.trim()};
      await atualizar('recorrencias',t.id,novo); await aplicarModeloFuturo(t,novo); if(novo.ativo&&t.ativo===false) chk(await sb.from('recorrencias').update({gerado_ate:hoje().slice(0,7)}).eq('id',t.id).eq('espaco_id',S.esp)); await recarregar('recorrencias'); await garantirRecorrentes(); toast('Conta recorrente atualizada.'); }); },
  delRecor: el => { const t=S.recor.find(x=>x.id===el.dataset.id); if(!t) return; const atual=hoje().slice(0,7), R=ehRecR(t), tab=R?'receitas':'despesas';
    const fut=lancsRec(t).filter(x=>!quitadoL(t,x) && ativa(x) && compL(t,x)>atual);
    confirmar(R?'Excluir receita fixa':'Excluir conta fixa',`Excluir “${esc(t.descricao)}”?${fut.length?` Há ${fut.length} ${fut.length>1?'meses futuros lançados':'mês futuro lançado'} e ainda não ${R?'recebido':'pago'}${fut.length>1?'s':''}.`:''} Meses já ${R?'recebidos':'pagos'} continuam em Lançamentos.`,
      fut.length?[{t:'Excluir só o modelo',cls:'',fn:async()=>{ await remover('recorrencias',t.id); toast('Modelo excluído. Os lançamentos continuam em Lançamentos.'); }},
        {t:`Excluir modelo e meses futuros (${fut.length})`,fn:async()=>{ await remover(tab,fut.map(x=>x.id)); await remover('recorrencias',t.id); toast(R?'Receita fixa encerrada.':'Conta fixa encerrada.'); }}]
      :[{t:'Excluir',fn:async()=>{ await remover('recorrencias',t.id); toast('Modelo excluído.'); }}]); },
  exportar: () => { const data={app:'Meu Eixo',espaco:espAtual()?.nome,exportadoEm:new Date().toISOString(),config:S.cfg,categorias:S.cats,receitas:S.rec,despesas:S.desp,recorrencias:S.recor,orcamentos:Object.values(S.orc),dividas:S.dividas||[],metas:S.metas||[],contas:S.contas||[],transferencias:S.transf||[]};
    baixar(`meu-eixo-${(espAtual()?.nome||'dados').toLowerCase().replace(/[^a-z0-9]+/g,'-')}-${hoje()}.json`,JSON.stringify(data,null,2)); toast('Arquivo de exportação gerado.'); },
  apagarTudo: () => abrirModal(`<form data-form="quick">${head('Excluir todos os dados do espaço')}<p style="margin:0">Apaga receitas, despesas, recorrências, orçamentos, dívidas, metas, contas, transferências e o saldo inicial do espaço “${esc(espAtual()?.nome)}”. As categorias são mantidas. Exporte antes se quiser guardar uma cópia.</p><div class="field"><label for="qX">Digite EXCLUIR para confirmar</label><input id="qX" name="x" autocomplete="off"></div>${rodape('Excluir tudo','danger')}</form>`,
    async f=>{ if(f.elements.x.value.trim()!=='EXCLUIR') return 'Digite EXCLUIR em maiúsculas para confirmar.';
      for(const t of ['despesas','receitas','recorrencias','orcamentos','configuracoes']) chk(await sb.from(t).delete().eq('espaco_id',S.esp));
      for(const t of ['dividas','metas','transferencias','contas']){ try{ chk(await sb.from(t).delete().eq('espaco_id',S.esp)); }catch(_){} }
      for(const t of ['despesas','receitas','recorrencias','orcamentos','configuracoes']) await recarregar(t); await carregarMetas(); await carregarContas(); toast('Dados do espaço excluídos.'); }),
  excluirConta: () => abrirModal(`<form data-form="quick">${head('Excluir minha conta')}<p style="margin:0">Sua conta, seu espaço pessoal e os espaços compartilhados que você criou serão apagados de forma definitiva. Espaços criados por outras pessoas continuam existindo para elas. Exporte seus dados antes.</p><div class="field"><label for="qX">Digite EXCLUIR MINHA CONTA para confirmar</label><input id="qX" name="x" autocomplete="off"></div>${rodape('Excluir conta','danger')}</form>`,
    async f=>{ if(f.elements.x.value.trim()!=='EXCLUIR MINHA CONTA') return 'Digite EXCLUIR MINHA CONTA em maiúsculas para confirmar.'; chk(await sb.rpc('excluir_minha_conta')); await sb.auth.signOut(); }),
  editarNome: () => acoes.personalizar(),
  personalizar: () => { fecharMenu(); const corAtual=S.user?.user_metadata?.cor||'salvia';
    abrirModal(`<form data-form="quick">${head('Personalizar')}
      <div class="prev-perfil" id="pvPerfil"><span id="pvAv">${avatarHtml(S.perfil?.foto,iniciais(meuNome()),minhaCor(),64)}</span><div><b id="pvNome" style="font-family:var(--f-display);font-size:18px;font-weight:500">${esc(meuNome()||'Seu nome')}</b><div class="small muted" id="pvFrase">${esc(minhaFrase())}</div></div></div>
      <div class="foto-acoes"><button type="button" class="btn sm" data-act="pzFoto">${icon(I.foto)}${S.perfil?.foto?'Trocar foto':'Escolher foto'}</button><button type="button" class="btn sm ghost" data-act="pzSemFoto" id="pzSemFoto" ${S.perfil?.foto?'':'hidden'}>Remover foto</button><input type="file" id="pzArq" accept="image/*" hidden><input type="hidden" name="foto" value="manter"></div>
      <div class="form-grid">
        <div class="field full"><label for="pzN">Seu nome</label><input id="pzN" name="n" required maxlength="60" autocomplete="name" value="${esc(meuNome())}" placeholder="Como quer ser chamada"></div>
        <div class="field full"><label for="pzF">Sua frase</label><input id="pzF" name="f" maxlength="80" value="${esc(S.user?.user_metadata?.frase||'')}" placeholder="${esc(FRASE_PADRAO)}"></div>
        <div class="field full"><label>Cor</label><div class="cores" id="pzCores">${Object.entries(CORES_AV).map(([k,[t,h]])=>`<button type="button" style="--c:${h}" aria-label="${t}" title="${t}" aria-pressed="${k===corAtual}" data-act="pzCor" data-v="${k}"></button>`).join('')}</div><input type="hidden" name="cor" value="${corAtual}"></div>
      </div><p class="note">Aparecem no menu e na saudação do Início. A frase é opcional.</p>${rodape('Salvar')}</form>`,
    async f=>{ const n=f.elements.n.value.trim(), fr=f.elements.f.value.trim(), cor=f.elements.cor.value; if(!n) return 'Informe o seu nome.';
      const fv=f.elements.foto.value, foto = fv==='manter' ? S.perfil?.foto : (fv||null);
      if(fv!=='manter' && S.fotoOk===false) return 'Para salvar a foto, execute a atualização 010_foto_perfil.sql no Supabase (SQL Editor).';
      chk(await sb.from('perfis').upsert({id:S.user.id,nome:n,...(fv!=='manter'?{foto}:{})})); S.perfil={...S.perfil,nome:n,foto};
      const r=chk(await sb.auth.updateUser({data:{nome:n,frase:fr,cor}})); if(r?.user) S.user=r.user;
      render(); toast('Perfil personalizado.'); },
    root=>{ const f=root.querySelector('form'); const pv=()=>{ const n=f.elements.n.value.trim(); root.querySelector('#pvNome').textContent=n||'Seu nome'; const fv=f.elements.foto.value, ft=fv==='manter'?S.perfil?.foto:fv; root.querySelector('#pvAv').innerHTML=avatarHtml(ft,iniciais(n),CORES_AV[f.elements.cor.value]?.[1]||minhaCor(),64); root.querySelector('#pvFrase').textContent=f.elements.f.value.trim()||FRASE_PADRAO; }; f.addEventListener('input',pv); f._pv=pv;
      root.querySelector('#pzArq').addEventListener('change',async e=>{ const file=e.target.files?.[0]; if(!file) return; try{ f.elements.foto.value=await reduzirFoto(file); root.querySelector('#pzSemFoto').hidden=false; pv(); }catch(x){ $('#formErr').textContent=x.message; } }); }); },
  pzCor: el => { const f=el.closest('form'); f.elements.cor.value=el.dataset.v; el.parentElement.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b===el))); f._pv&&f._pv(); },
  pzFoto: () => { const i=$('#pzArq'); if(i){ i.value=''; i.click(); } },
  pzSemFoto: el => { const f=el.closest('form'); f.elements.foto.value=''; el.hidden=true; f._pv&&f._pv(); },
  trocarSenha: () => abrirModal(`<form data-form="quick">${head('Alterar senha')}<div class="form-grid"><div class="field"><label for="qS1">Nova senha</label><input id="qS1" name="s1" type="password" autocomplete="new-password" minlength="8" required></div><div class="field"><label for="qS2">Repita a nova senha</label><input id="qS2" name="s2" type="password" autocomplete="new-password" minlength="8" required></div></div>${rodape('Alterar senha')}</form>`,
    async f=>{ if(f.elements.s1.value.length<8) return 'Use pelo menos 8 caracteres.'; if(f.elements.s1.value!==f.elements.s2.value) return 'As duas senhas não são iguais.'; chk(await sb.auth.updateUser({password:f.elements.s1.value})); toast('Senha alterada.'); }),
  criarEspaco: () => abrirModal(`<form data-form="quick">${head('Criar espaço compartilhado')}<p class="muted" style="margin:0">Use para finanças da casa ou da família. Ele começa com as categorias padrão e você recebe um código para convidar outras pessoas.</p><div class="field"><label for="qN">Nome do espaço</label><input id="qN" name="n" required maxlength="60" placeholder="Ex.: Casa"></div>${rodape('Criar espaço')}</form>`,
    async f=>{ const n=f.elements.n.value.trim(); if(!n) return 'Informe o nome.'; const id=chk(await sb.rpc('criar_espaco',{nome_espaco:n})); await carregarEspacos(); fecharModal(); await abrirEspaco(id); S.view='config'; render(); toast('Espaço criado. Copie o código de convite para chamar outras pessoas.'); }),
  entrarEspaco: () => abrirModal(`<form data-form="quick">${head('Entrar em um espaço')}<p class="muted" style="margin:0">Peça o código de convite para quem criou o espaço.</p><div class="field"><label for="qC">Código de convite</label><input id="qC" name="c" required maxlength="20" autocomplete="off" style="text-transform:uppercase;letter-spacing:.1em"></div>${rodape('Entrar')}</form>`,
    async f=>{ const id=chk(await sb.rpc('entrar_no_espaco',{codigo:f.elements.c.value})); await carregarEspacos(); fecharModal(); await abrirEspaco(id); toast('Você entrou no espaço.'); }),
  copiarCodigo: async () => { const c=espAtual()?.codigoConvite||''; try{ await navigator.clipboard.writeText(c); toast('Código copiado.'); }catch(_){ const r=document.createRange(); r.selectNodeContents($('#codigo')); const s=getSelection(); s.removeAllRanges(); s.addRange(r); toast('Código selecionado. Copie com o menu do aparelho.'); } },
  novoCodigo: () => confirmar('Gerar novo código','O código atual deixa de funcionar. Quem já é membro continua no espaço.',[{t:'Gerar novo código',cls:'primary',fn:async()=>{ chk(await sb.rpc('novo_codigo_convite',{e:S.esp})); await carregarEspacos(); render(); toast('Novo código gerado.'); }}]),
  renomearEspaco: () => abrirModal(`<form data-form="quick">${head('Renomear espaço')}<div class="field"><label for="qN">Nome</label><input id="qN" name="n" required maxlength="60" value="${esc(espAtual()?.nome)}"></div>${rodape('Salvar')}</form>`,
    async f=>{ const n=f.elements.n.value.trim(); if(!n) return 'Informe o nome.'; chk(await sb.from('espacos').update({nome:n}).eq('id',S.esp)); await carregarEspacos(); render(); toast('Espaço renomeado.'); }),
  removerMembro: el => { const m=(S.membros||[]).find(x=>x.usuario_id===el.dataset.id); if(!m) return; confirmar('Remover membro',`Remover ${esc(m.nome||m.email)} do espaço? A pessoa perde o acesso aos dados deste espaço.`,[{t:'Remover',fn:async()=>{ chk(await sb.from('membros').delete().eq('espaco_id',S.esp).eq('usuario_id',m.usuario_id)); S.membros=null; render(); toast('Membro removido.'); }}]); },
  sairEspaco: () => confirmar('Sair do espaço',`Sair de “${esc(espAtual()?.nome)}”? Você deixa de ver os dados dele. Para voltar, precisará de um novo código.`,[{t:'Sair do espaço',fn:async()=>{ chk(await sb.from('membros').delete().eq('espaco_id',S.esp).eq('usuario_id',S.user.id)); await carregarEspacos(); await abrirEspaco(S.espacos[0].id); toast('Você saiu do espaço.'); }}]),
  excluirEspaco: () => abrirModal(`<form data-form="quick">${head('Excluir espaço')}<p style="margin:0">O espaço “${esc(espAtual()?.nome)}” e todos os dados dele serão apagados para todos os membros.</p><div class="field"><label for="qX">Digite o nome do espaço para confirmar</label><input id="qX" name="x" autocomplete="off"></div>${rodape('Excluir espaço','danger')}</form>`,
    async f=>{ if(f.elements.x.value.trim()!==espAtual()?.nome) return 'O nome digitado não confere.'; chk(await sb.from('espacos').delete().eq('id',S.esp)); await carregarEspacos(); fecharModal(); await abrirEspaco(S.espacos[0].id); toast('Espaço excluído.'); })
};

/* ---------- alimentação: questionário e perfil ---------- */
const N = () => window.MeuEixoNutri;
const ALIMENTOS = [
  {g:'Proteínas', i:['Frango (peito)','Frango (coxa e sobrecoxa)','Ovo','Carne moída','Patinho / acém','Peixe (tilápia, merluza)','Sardinha em lata','Atum em lata','Carne de porco','Fígado','Linguiça','Queijo branco / ricota']},
  {g:'Carboidratos', i:['Arroz branco','Arroz integral','Macarrão','Batata','Batata-doce','Mandioca','Inhame','Cuscuz de milho','Pão francês','Pão integral','Aveia','Tapioca']},
  {g:'Feijões e grãos', i:['Feijão carioca','Feijão preto','Lentilha','Grão-de-bico','Ervilha']},
  {g:'Legumes', i:['Cenoura','Abobrinha','Abóbora','Chuchu','Beterraba','Vagem','Brócolis','Couve-flor','Berinjela','Quiabo','Pimentão','Milho']},
  {g:'Verduras e saladas', i:['Alface','Couve','Repolho','Rúcula','Espinafre','Tomate','Pepino','Cebola']},
  {g:'Frutas', i:['Banana','Maçã','Laranja','Mamão','Melancia','Manga','Abacaxi','Goiaba','Uva','Abacate']},
  {g:'Leite e derivados', i:['Leite','Iogurte natural','Queijo muçarela','Requeijão']}
];
const PASSOS = ['Você','Rotina','Objetivo','Saúde','Refeições','Preferências','Cozinha','Orçamento'];
const CONDICOES = [['nenhuma','Nenhuma'],['hipertensao','Pressão alta'],['diabetes','Diabetes'],['pre_diabetes','Pré-diabetes ou resistência à insulina'],['colesterol','Colesterol ou triglicerídeos altos'],['gastrite','Gastrite ou refluxo'],['intestino','Intestino preso ou sensível'],['anemia','Anemia'],['tireoide','Hipotireoidismo ou hipertireoidismo'],['renal','Doença renal'],['gestante','Gestante'],['amamentando','Amamentando']];
const ALERGIAS = [['lactose','Intolerância à lactose'],['gluten','Glúten / doença celíaca'],['amendoim','Amendoim e castanhas'],['frutos_mar','Peixes e frutos do mar'],['ovo','Ovo'],['soja','Soja']];
const ESTILOS = [['tudo','Como de tudo'],['sem_vermelha','Sem carne vermelha'],['sem_porco','Sem carne de porco'],['vegetariano','Vegetariana (com ovos e leite)'],['vegano','Vegana']];
const EQUIP = [['fogao','Fogão'],['forno','Forno'],['microondas','Micro-ondas'],['airfryer','Air fryer'],['pressao','Panela de pressão'],['liquidificador','Liquidificador'],['processador','Processador / mixer']];
const DIAS = [['dom','Domingo'],['seg','Segunda'],['ter','Terça'],['qua','Quarta'],['qui','Quinta'],['sex','Sexta'],['sab','Sábado']];

const RASCUNHO='meuEixo.quiz';
function perfilVazio(){ return {sexo:'feminino',atividade:'leve',objetivo:'emagrecer',ritmo:'suave',condicoes:['nenhuma'],alergias:[],estilo:'tudo',refeicoes:['cafe','almoco','lanche_tarde','jantar'],horarios:{},gosta:[],naoGosta:[],equipamentos:['fogao','microondas','pressao'],diasPreparo:['dom'],pessoas:1,marmitaLocal:'trabalho',microondasTrabalho:'sim',habilidade:'intermediaria',tempoPreparo:'2h',freezer:'medio'}; }
async function carregarPerfilAlimentar(){
  try{ const d=chk(await sb.from('perfil_alimentar').select('dados,atualizado_em').eq('usuario_id',S.user.id).maybeSingle()); S.perfilAl=d?{...d.dados,_atualizado:d.atualizado_em}:null; }
  catch(e){ console.error(e); S.perfilAl=null; S.perfilAlErro=true; }
  try{ S.pesagens=chk(await sb.from('pesagens').select('data,peso,cintura').eq('usuario_id',S.user.id).order('data')) || []; }catch(_){ S.pesagens=[]; }
}

function chips(nome, lista, sel, multi=true){
  sel = Array.isArray(sel)?sel:[sel];
  return `<div class="chips" data-nome="${nome}" data-multi="${multi?1:0}">${lista.map(([v,t])=>`<button type="button" class="chip" data-act="chip" data-v="${v}" aria-pressed="${sel.includes(v)}">${t}</button>`).join('')}</div>`;
}
function opcoes(nome, lista, sel){
  return `<div class="opcoes" data-nome="${nome}">${lista.map(([v,t,d])=>`<button type="button" class="opcao" data-act="chip" data-v="${v}" aria-pressed="${sel===v}"><b>${t}</b>${d?`<span>${d}</span>`:''}</button>`).join('')}</div>`;
}

function passoQuiz(i,p){
  const at=N().ATIVIDADE, ob=N().OBJETIVOS, R=N().REFEICOES;
  if(i===0) return `<h3>Vamos começar por você</h3><p class="lead">Estes dados servem para calcular seu IMC e quanta energia seu corpo gasta por dia. Ficam guardados só na sua conta; ninguém do espaço compartilhado vê.</p>
    <div class="field"><span class="lbl">Sexo biológico (usado na fórmula de gasto de energia)</span>${opcoes('sexo',[['feminino','Feminino'],['masculino','Masculino']],p.sexo)}</div>
    <div class="form-grid">
      <div class="field"><label for="qNasc">Data de nascimento</label><input id="qNasc" name="nascimento" type="date" required value="${p.nascimento||''}"></div>
      <div class="field"><label for="qAlt">Altura (cm)</label><input id="qAlt" name="altura" inputmode="numeric" required placeholder="Ex.: 165" value="${p.altura||''}"></div>
      <div class="field"><label for="qPeso">Peso atual (kg)</label><input id="qPeso" name="peso" inputmode="decimal" required placeholder="Ex.: 68,5" value="${p.peso?String(p.peso).replace('.',','):''}"></div>
      <div class="field"><label for="qCint">Cintura (cm, opcional)</label><input id="qCint" name="cintura" inputmode="decimal" placeholder="Medida na altura do umbigo" value="${p.cintura?String(p.cintura).replace('.',','):''}"></div>
    </div>`;
  if(i===1) return `<h3>Como é a sua rotina</h3><p class="lead">O nível de atividade muda bastante a quantidade de energia de que você precisa.</p>
    <div class="field"><span class="lbl">Nível de atividade</span>${opcoes('atividade',Object.entries(at).map(([k,v])=>[k,v.t,v.d]),p.atividade)}</div>
    <div class="form-grid">
      <div class="field"><label for="qAcorda">Acordo por volta de</label><input id="qAcorda" name="acorda" type="time" value="${p.acorda||'06:30'}"></div>
      <div class="field"><label for="qDorme">Durmo por volta de</label><input id="qDorme" name="dorme" type="time" value="${p.dorme||'22:30'}"></div>
      <div class="field"><label for="qTrabI">Começo a trabalhar</label><input id="qTrabI" name="trabalhoInicio" type="time" value="${p.trabalhoInicio||'08:00'}"></div>
      <div class="field"><label for="qTrabF">Termino de trabalhar</label><input id="qTrabF" name="trabalhoFim" type="time" value="${p.trabalhoFim||'18:00'}"></div>
      <div class="field full"><label for="qExerc">Atividade física (opcional)</label><input id="qExerc" name="exercicio" maxlength="120" placeholder="Ex.: academia 3x por semana, à noite" value="${esc(p.exercicio)}"></div>
    </div>`;
  if(i===2) return `<h3>O que você quer alcançar</h3><p class="lead">Escolha o objetivo principal. O plano vai equilibrar saúde, praticidade e custo.</p>
    <div class="field">${opcoes('objetivo',Object.entries(ob).map(([k,v])=>[k,v.t]),p.objetivo)}</div>
    <div class="field" data-quiz-show="emagrecer" ${p.objetivo!=='emagrecer'?'hidden':''}><span class="lbl">Ritmo</span>${opcoes('ritmo',[['suave','Suave','Redução de cerca de 15% da energia. Mais fácil de manter.'],['moderado','Moderado','Redução de cerca de 20%. Resultado mais rápido, exige mais disciplina.']],p.ritmo)}</div>
    <div class="field"><label for="qMeta">Peso que gostaria de alcançar (kg, opcional)</label><input id="qMeta" name="pesoMeta" inputmode="decimal" value="${p.pesoMeta?String(p.pesoMeta).replace('.',','):''}"></div>`;
  if(i===3) return `<h3>Saúde e restrições</h3><p class="lead">Ajuda a evitar alimentos que não combinam com você. O Meu Eixo não faz diagnóstico: com qualquer condição de saúde, confirme o plano com seu médico ou nutricionista.</p>
    <div class="field"><span class="lbl">Condições de saúde</span>${chips('condicoes',CONDICOES,p.condicoes)}</div>
    <div class="field"><span class="lbl">Alergias e intolerâncias</span>${chips('alergias',ALERGIAS,p.alergias)}</div>
    <div class="field"><label for="qOutras">Outras restrições ou observações</label><input id="qOutras" name="outrasRestricoes" maxlength="200" value="${esc(p.outrasRestricoes)}" placeholder="Ex.: não posso pimenta; uso medicamento X em jejum"></div>
    <div class="field"><span class="lbl">Estilo de alimentação</span>${opcoes('estilo',ESTILOS,p.estilo)}</div>
    <div class="field"><label for="qAgua">Quanta água você bebe hoje, por dia?</label><select id="qAgua" name="aguaAtual">${opts([['','Selecione'],['menos1','Menos de 1 litro'],['1a2','De 1 a 2 litros'],['mais2','Mais de 2 litros']],p.aguaAtual)}</select></div>`;
  if(i===4) return `<h3>Suas refeições</h3><p class="lead">Marque as refeições que você quer fazer e o horário aproximado.</p>
    <div class="refs">${Object.entries(R).map(([k,v])=>`<div class="ref-linha"><label class="check"><input type="checkbox" name="ref_${k}" ${p.refeicoes.includes(k)?'checked':''}> ${v.t}</label><input type="time" name="hora_${k}" aria-label="Horário: ${v.t}" value="${(p.horarios||{})[k]||{cafe:'07:00',lanche_manha:'10:00',almoco:'12:00',lanche_tarde:'15:30',jantar:'19:30',ceia:'21:30'}[k]}"></div>`).join('')}</div>
    <div class="field"><span class="lbl">Onde você almoça nos dias de trabalho</span>${opcoes('marmitaLocal',[['trabalho','Levo marmita para o trabalho'],['casa','Almoço em casa'],['fora','Como fora / compro marmita']],p.marmitaLocal)}</div>
    <div class="field"><span class="lbl">Tem micro-ondas onde almoça?</span>${opcoes('microondasTrabalho',[['sim','Sim'],['nao','Não']],p.microondasTrabalho)}</div>`;
  if(i===5) return `<h3>Do que você gosta</h3><p class="lead">Toque uma vez para <b class="gosta-t">Gosto</b>, duas para <b class="naogosta-t">Não como</b> e três para voltar ao neutro. O cardápio usa só o que você aceita.</p>
    ${ALIMENTOS.map(g=>`<div class="field"><span class="lbl">${g.g}</span><div class="chips">${g.i.map(a=>{ const st=p.gosta.includes(a)?'gosta':p.naoGosta.includes(a)?'nao':''; return `<button type="button" class="chip tri ${st}" data-act="tri" data-v="${esc(a)}">${esc(a)}</button>`; }).join('')}</div></div>`).join('')}
    <div class="field"><label for="qOutrosG">Outros alimentos que você adora</label><input id="qOutrosG" name="outrosGosta" maxlength="200" value="${esc(p.outrosGosta)}"></div>`;
  if(i===6) return `<h3>Sua cozinha</h3><p class="lead">Assim o plano de marmitas cabe no seu tempo e no seu espaço.</p>
    <div class="field"><span class="lbl">Como você se sente na cozinha</span>${opcoes('habilidade',[['iniciante','Iniciante','Prefiro receitas bem simples.'],['intermediaria','Intermediária','Faço o básico do dia a dia.'],['avancada','Avançada','Gosto de variar e testar receitas.']],p.habilidade)}</div>
    <div class="field"><span class="lbl">Tempo para cozinhar em um dia de preparo</span>${opcoes('tempoPreparo',[['1h','Até 1 hora'],['2h','Até 2 horas'],['3h','Até 3 horas'],['mais','Mais de 3 horas']],p.tempoPreparo)}</div>
    <div class="field"><span class="lbl">Em quais dias pode preparar as marmitas</span>${chips('diasPreparo',DIAS,p.diasPreparo)}</div>
    <div class="field"><span class="lbl">Equipamentos que você tem</span>${chips('equipamentos',EQUIP,p.equipamentos)}</div>
    <div class="field"><span class="lbl">Espaço no freezer</span>${opcoes('freezer',[['nenhum','Não tenho freezer'],['pequeno','Pequeno (até 5 marmitas)'],['medio','Médio (6 a 10)'],['grande','Grande (mais de 10)']],p.freezer)}</div>
    <div class="field"><label for="qPotes">Quantos potes de marmita você tem</label><input id="qPotes" name="potes" type="number" min="0" max="60" inputmode="numeric" value="${p.potes??''}"></div>`;
  return `<h3>Orçamento</h3><p class="lead">Com estes números, o Meu Eixo calcula quanto você pode economizar preparando as próprias refeições.</p>
    <div class="form-grid">
      <div class="field"><label for="qOrc">Quanto quer gastar com alimentação por mês (R$)</label><input id="qOrc" name="orcamento" inputmode="decimal" value="${p.orcamento?fmtInput(p.orcamento):''}" placeholder="Ex.: 600,00"></div>
      <div class="field"><label for="qPess">Quantas pessoas comem dessas compras</label><input id="qPess" name="pessoas" type="number" min="1" max="12" inputmode="numeric" value="${p.pessoas||1}"></div>
      <div class="field"><label for="qMarmP">Quanto paga hoje numa marmita pronta (R$)</label><input id="qMarmP" name="precoMarmita" inputmode="decimal" value="${p.precoMarmita?fmtInput(p.precoMarmita):''}" placeholder="Ex.: 22,00"></div>
      <div class="field"><label for="qMarmQ">Quantas marmitas prontas compra por semana</label><input id="qMarmQ" name="marmitasSemana" type="number" min="0" max="21" inputmode="numeric" value="${p.marmitasSemana??''}"></div>
    </div>`;
}

function vQuiz(){
  const q=S.quiz, i=q.passo, p=q.dados;
  return `<div class="quiz">
    <div class="quiz-topo"><span class="eyebrow">Perfil alimentar · ${i+1} de ${PASSOS.length}</span>
      <div class="quiz-passos">${PASSOS.map((t,k)=>`<button type="button" class="qp ${k<i?'feito':''} ${k===i?'atual':''}" data-act="quizIr" data-i="${k}" ${k>q.max?'disabled':''} aria-label="${t}"><span>${t}</span></button>`).join('')}</div></div>
    <form data-form="quiz" class="quiz-corpo" novalidate>${passoQuiz(i,p)}
      <p class="err" id="quizErr"></p>
      <div class="quiz-nav">${i>0?`<button type="button" class="btn" data-act="quizVoltar">Voltar</button>`:`<button type="button" class="btn ghost" data-act="quizCancelar">${S.perfilAl?'Cancelar':'Depois'}</button>`}
        <button type="submit" class="btn primary">${i===PASSOS.length-1?'Ver meu plano':'Continuar'}</button></div>
    </form></div>`;
}

function lerPasso(form){
  const p=S.quiz.dados, E=form.elements, num=v=>{ const n=parseValor(v); return isNaN(n)?null:n; };
  form.querySelectorAll('.chips[data-nome], .opcoes[data-nome]').forEach(g=>{
    const sel=[...g.querySelectorAll('[aria-pressed="true"]')].map(b=>b.dataset.v);
    p[g.dataset.nome] = g.classList.contains('opcoes') ? (sel[0]||p[g.dataset.nome]) : sel;
  });
  ['nascimento','acorda','dorme','trabalhoInicio','trabalhoFim','exercicio','outrasRestricoes','aguaAtual','outrosGosta'].forEach(k=>{ if(E[k]) p[k]=E[k].value.trim(); });
  ['altura','peso','cintura','pesoMeta','orcamento','precoMarmita'].forEach(k=>{ if(E[k]) p[k]=num(E[k].value); });
  ['potes','pessoas','marmitasSemana'].forEach(k=>{ if(E[k]) p[k]=E[k].value===''?null:parseInt(E[k].value); });
  if(E.ref_cafe){ p.refeicoes=Object.keys(N().REFEICOES).filter(k=>E['ref_'+k].checked); p.horarios={}; Object.keys(N().REFEICOES).forEach(k=>p.horarios[k]=E['hora_'+k].value); }
  if(form.querySelector('[data-act="tri"]')){ p.gosta=[...form.querySelectorAll('.chip.tri.gosta')].map(b=>b.dataset.v); p.naoGosta=[...form.querySelectorAll('.chip.tri.nao')].map(b=>b.dataset.v); }
  try{ localStorage.setItem(RASCUNHO,JSON.stringify(S.quiz)); }catch(_){}
}
function validarPasso(i,p){
  if(i===0){
    if(!p.nascimento) return 'Informe a data de nascimento.';
    const a=N().idade(p.nascimento,hoje()); if(a===null||a<10||a>110) return 'Confira a data de nascimento.';
    if(!(p.altura>=120&&p.altura<=230)) return 'Informe a altura em centímetros, por exemplo 165.';
    if(!(p.peso>=30&&p.peso<=300)) return 'Informe o peso em quilos, por exemplo 68,5.';
    if(p.cintura!==null && p.cintura!==undefined && !(p.cintura>=40&&p.cintura<=200)) return 'Confira a medida da cintura, em centímetros.';
  }
  if(i===3 && (p.condicoes||[]).length>1 && p.condicoes.includes('nenhuma')) p.condicoes=p.condicoes.filter(c=>c!=='nenhuma');
  if(i===4 && !p.refeicoes.length) return 'Escolha pelo menos uma refeição.';
  if(i===4 && !p.refeicoes.includes('almoco') && p.marmitaLocal!=='fora') return 'Inclua o almoço para montarmos as marmitas, ou escolha “Como fora”.';
  return '';
}
async function salvarPerfilAl(){
  const p={...S.quiz.dados}; delete p._atualizado;
  chk(await sb.from('perfil_alimentar').upsert({usuario_id:S.user.id,dados:p,atualizado_em:new Date().toISOString()},{onConflict:'usuario_id'}));
  const ult=(S.pesagens||[]).slice(-1)[0];
  if(!ult || ult.data!==hoje() || +ult.peso!==+p.peso){
    if(ult && ult.data===hoje()) chk(await sb.from('pesagens').delete().eq('usuario_id',S.user.id).eq('data',hoje()));
    chk(await sb.from('pesagens').insert({usuario_id:S.user.id,data:hoje(),peso:p.peso,cintura:p.cintura||null}));
  }
  try{ localStorage.removeItem(RASCUNHO); }catch(_){}
  S.quiz=null; await carregarPerfilAlimentar();
}

function vAlimentacao(){
  if(S.quiz) return vQuiz();
  if(S.perfilAl===undefined) return `<div class="empty"><strong>Carregando seu perfil alimentar…</strong></div>`;
  if(S.perfilAlErro) return `<div class="empty"><strong>O módulo de alimentação precisa de uma atualização no banco</strong>No Supabase, execute o arquivo <b>003_perfil_alimentar.sql</b> no SQL Editor e recarregue a página.</div>`;
  const p=S.perfilAl;
  if(!p) return `<div class="intro-al">
    <span class="eyebrow">Alimentação</span><h2>Vamos montar seu perfil alimentar</h2>
    <p>São 8 etapas rápidas, cerca de 5 minutos. Com elas, o Meu Eixo calcula seu IMC, quanta energia você gasta por dia, quanto de proteína e água precisa, e como montar marmitas equilibradas dentro do seu orçamento.</p>
    <ul><li>Seus dados de saúde ficam só na sua conta.</li><li>Você escolhe os alimentos; o sistema só sugere.</li><li>As metas são estimativas e não substituem nutricionista ou médico.</li></ul>
    <div class="actions"><button class="btn primary" data-act="quizIniciar">Começar questionário</button></div></div>`;
  const c=N().calcular(p,hoje()); if(!c) return `<div class="empty"><strong>Faltam dados no perfil</strong><button class="btn primary" data-act="quizIniciar" style="margin-top:12px">Completar questionário</button></div>`;
  const fx={baixo:'warn',adequado:'ok',acima:'warn',obes1:'danger',obes2:'danger',obes3:'danger'}[c.faixa.k];
  const escala = Math.min(100,Math.max(0,(c.imc-15)/(40-15)*100));
  const ajusteTxt = c.ajuste<0?`${Math.round(-c.ajuste*100)}% abaixo do gasto, para emagrecer`:c.ajuste>0?`${Math.round(c.ajuste*100)}% acima do gasto, para ganhar massa`:'igual ao gasto, para manter';
  const economia = (p.precoMarmita>0 && p.marmitasSemana>0) ? r2(p.precoMarmita*p.marmitasSemana*4.33) : null;
  const pes=S.pesagens||[];
  const evol = pes.length>1 ? r1(pes[pes.length-1].peso - pes[0].peso) : null;
  return `
  <section class="perfil-topo">
    <div><span class="eyebrow">Seu perfil alimentar</span><h2>${esc(N().OBJETIVOS[p.objetivo]?.t||'')}</h2><p class="muted small">Atualizado em ${dataBR((p._atualizado||'').slice(0,10))} · ${c.anos} anos · ${p.altura} cm · ${String(p.peso).replace('.',',')} kg</p></div>
    <div class="actions"><button class="btn" data-act="novaPesagem">Registrar peso</button><button class="btn" data-act="quizEditar">Editar respostas</button></div>
  </section>
  ${c.avisos.length?`<div class="alerts">${c.avisos.map(a=>`<div class="alert warn"><span class="dot"></span><div><p>${a}</p></div></div>`).join('')}</div>`:''}
  <div class="grid2">
    <section class="panel imc">
      <h3>IMC</h3>
      <div class="imc-val"><span class="num">${String(c.imc).replace('.',',')}</span><span class="pill ${fx}">${c.faixa.t}</span></div>
      <div class="imc-escala" aria-hidden="true"><i style="left:${escala}%"></i></div>
      <div class="imc-legenda small muted"><span>15</span><span>18,5</span><span>25</span><span>30</span><span>40</span></div>
      <p class="small" style="margin:12px 0 0">Para a sua altura, a faixa de peso de referência vai de <b>${String(c.pesoRef[0]).replace('.',',')} kg</b> a <b>${String(c.pesoRef[1]).replace('.',',')} kg</b>.${p.pesoMeta?` Sua meta: ${String(p.pesoMeta).replace('.',',')} kg.`:''}</p>
      ${c.cintura?`<p class="small" style="margin:8px 0 0">Cintura de ${String(p.cintura).replace('.',',')} cm: ${c.cintura.t}.</p>`:''}
      <p class="small muted" style="margin:8px 0 0">O IMC não diferencia músculo de gordura. É um ponto de partida, não um diagnóstico.</p>
    </section>
    <section class="panel">
      <h3>Energia por dia</h3>
      <div class="list">
        ${linha('Gasto em repouso',c.tmb.toLocaleString('pt-BR')+' kcal')}
        ${linha('Gasto total com a sua rotina',c.get.toLocaleString('pt-BR')+' kcal')}
        <div class="row" style="grid-template-columns:1fr auto"><span><b>Meta diária</b><div class="small muted">${ajusteTxt}</div></span><b class="num big-meta">${c.meta.toLocaleString('pt-BR')} kcal</b></div>
      </div>
    </section>
  </div>
  <section class="kpis macros">
    <div class="kpi"><span class="lbl">Proteína</span><span class="val">${c.prot===null?'—':c.prot+' g'}</span><span class="sub">${c.prot===null?'definir com profissional':`por dia (${String(c.gkg).replace('.',',')} g por kg)`}</span></div>
    <div class="kpi"><span class="lbl">Carboidratos</span><span class="val">${c.carb===null?'—':c.carb+' g'}</span><span class="sub">por dia, com ${c.fibra} g de fibras</span></div>
    <div class="kpi"><span class="lbl">Gorduras</span><span class="val">${c.gord} g</span><span class="sub">por dia, de boa qualidade</span></div>
    <div class="kpi"><span class="lbl">Água</span><span class="val">${String(c.agua).replace('.',',')} L</span><span class="sub">por dia, cerca de ${Math.round(c.agua*1000/250)} copos</span></div>
  </section>
  <div class="grid2">
    <section class="panel"><h3>Como dividir no dia</h3>
      <div class="list">${c.porRefeicao.map(r=>linha(`${r.t}${p.horarios?.[r.k]?` <span class="small muted">· ${p.horarios[r.k]}</span>`:''}`,r.kcal+' kcal')).join('')}</div></section>
    <section class="panel"><h3>Sua marmita de almoço</h3>
      ${c.marmita?`<div class="prato" aria-hidden="true"><div class="prato-v">Vegetais<br>½</div><div class="prato-p">Proteína<br>¼</div><div class="prato-c">Carboi&shy;drato<br>¼</div></div>
      <div class="list">${linha('Proteína (frango, carne, ovo, peixe)','cerca de '+c.marmita.proteinaG+' g')}${linha('Arroz, macarrão ou tubérculo','cerca de '+c.marmita.carboG+' g')}${linha('Feijão ou lentilha','1 concha (cerca de '+c.marmita.feijaoG+' g)')}${linha('Legumes e salada','pelo menos '+c.marmita.vegetaisG+' g')}</div>
      <p class="small muted" style="margin:10px 0 0">Quantidades de alimento pronto, para cerca de ${c.marmitaKcal} kcal. O cardápio da semana vai ajustar conforme os alimentos escolhidos.</p>`:'<p class="muted small">Você não incluiu o almoço nas refeições.</p>'}
    </section>
  </div>
  <div class="grid2">
    <section class="panel"><h3>Orçamento e economia</h3><div class="list">
      ${linha('Orçamento mensal de alimentação',p.orcamento?money(p.orcamento):'<span class="small muted">não informado</span>')}
      ${linha('Gasto atual com marmitas prontas',economia?money(economia)+'/mês':'<span class="small muted">não informado</span>')}
      ${linha('Pessoas nas compras',p.pessoas||1)}</div>
      <p class="note" style="margin:12px 0 0">${economia?`Hoje você gasta cerca de ${money(economia)} por mês com marmitas prontas. Quando o cardápio estiver pronto, o Meu Eixo mostra o custo de preparar em casa, com preços de Cuiabá, e a economia real.`:'Informe o preço e a quantidade de marmitas prontas para calcularmos a economia.'}</p></section>
    <section class="panel"><h3>Evolução do peso</h3>
      ${pes.length?`<div class="list">${pes.slice(-5).reverse().map(x=>linha(dataBR(x.data),String(x.peso).replace('.',',')+' kg'+(x.cintura?` · cintura ${String(x.cintura).replace('.',',')} cm`:''))).join('')}</div>
      ${evol!==null?`<p class="small" style="margin:10px 0 0">Desde a primeira pesagem: <b>${evol>0?'+':''}${String(evol).replace('.',',')} kg</b>.</p>`:''}`:'<p class="small muted">Registre seu peso de tempos em tempos para acompanhar a evolução.</p>'}
    </section>
  </div>
  <section class="panel"><h3>Suas preferências</h3>
    <p class="small" style="margin:0 0 8px"><b>Gosta:</b> ${p.gosta?.length?p.gosta.map(esc).join(', '):'nenhum alimento marcado'}${p.outrosGosta?', '+esc(p.outrosGosta):''}</p>
    <p class="small" style="margin:0 0 8px"><b>Não come:</b> ${p.naoGosta?.length?p.naoGosta.map(esc).join(', '):'nada marcado'}</p>
    <p class="small" style="margin:0"><b>Restrições:</b> ${[...(p.alergias||[]).map(a=>(ALERGIAS.find(x=>x[0]===a)||[,a])[1]), ESTILOS.find(x=>x[0]===p.estilo)?.[1], p.outrasRestricoes].filter(Boolean).map(esc).join(' · ')||'nenhuma'}</p>
  </section>
  <div class="roadmap"><span class="eyebrow">Próximo passo · Etapa 6</span><h2>Cardápio semanal e plano de marmitas</h2><p style="margin:0">Com este perfil, o próximo módulo monta o cardápio da semana com os alimentos que você aceita, calcula as porções, a lista de compras e o plano de preparo das marmitas.</p></div>`;
}

const acoesAl = {
  quizIniciar: () => { let r=null; try{ r=JSON.parse(localStorage.getItem(RASCUNHO)||'null'); }catch(_){}
    S.quiz = r && r.dados ? r : {passo:0,max:0,dados:{...perfilVazio(),...(S.perfilAl||{})}}; render(); window.scrollTo(0,0); },
  quizEditar: () => { S.quiz={passo:0,max:PASSOS.length-1,dados:{...perfilVazio(),...S.perfilAl}}; render(); window.scrollTo(0,0); },
  quizCancelar: () => { S.quiz=null; try{ localStorage.removeItem(RASCUNHO); }catch(_){} render(); },
  quizVoltar: el => { lerPasso(el.closest('form')); S.quiz.passo--; render(); window.scrollTo(0,0); },
  quizIr: el => { lerPasso($('form[data-form="quiz"]')); S.quiz.passo=+el.dataset.i; render(); window.scrollTo(0,0); },
  chip: el => { const g=el.parentElement; const multi=g.dataset.multi==='1';
    if(multi){ const on=el.getAttribute('aria-pressed')!=='true'; el.setAttribute('aria-pressed',String(on));
      if(g.dataset.nome==='condicoes'){ if(el.dataset.v==='nenhuma'&&on) g.querySelectorAll('[data-v]:not([data-v="nenhuma"])').forEach(b=>b.setAttribute('aria-pressed','false')); else if(on) g.querySelector('[data-v="nenhuma"]')?.setAttribute('aria-pressed','false'); } }
    else { g.querySelectorAll('[data-v]').forEach(b=>b.setAttribute('aria-pressed',String(b===el))); }
    if(g.dataset.nome==='objetivo') document.querySelectorAll('[data-quiz-show]').forEach(x=>x.hidden=x.dataset.quizShow!==el.dataset.v); },
  tri: el => { if(el.classList.contains('gosta')){ el.classList.remove('gosta'); el.classList.add('nao'); } else if(el.classList.contains('nao')) el.classList.remove('nao'); else el.classList.add('gosta'); },
  novaPesagem: () => abrirModal(`<form data-form="quick">${head('Registrar peso')}<div class="form-grid"><div class="field"><label for="pP">Peso (kg)</label><input id="pP" name="peso" inputmode="decimal" required value="${String(S.perfilAl?.peso||'').replace('.',',')}"></div><div class="field"><label for="pC">Cintura (cm, opcional)</label><input id="pC" name="cintura" inputmode="decimal" value="${S.perfilAl?.cintura?String(S.perfilAl.cintura).replace('.',','):''}"></div><div class="field"><label for="pD">Data</label><input id="pD" name="data" type="date" value="${hoje()}" required></div></div>${rodape('Salvar')}</form>`,
    async f=>{ const E=f.elements, peso=parseValor(E.peso.value), cint=E.cintura.value.trim()?parseValor(E.cintura.value):null;
      if(!(peso>=30&&peso<=300)) return 'Informe o peso em quilos, por exemplo 68,5.'; if(cint!==null&&!(cint>=40&&cint<=200)) return 'Confira a medida da cintura.';
      chk(await sb.from('pesagens').delete().eq('usuario_id',S.user.id).eq('data',E.data.value));
      chk(await sb.from('pesagens').insert({usuario_id:S.user.id,data:E.data.value,peso:r2(peso),cintura:cint}));
      const ultima = !(S.pesagens||[]).some(x=>x.data>E.data.value);
      if(ultima){ const dados={...S.perfilAl,peso:r2(peso),...(cint?{cintura:cint}:{})}; delete dados._atualizado; chk(await sb.from('perfil_alimentar').update({dados,atualizado_em:new Date().toISOString()}).eq('usuario_id',S.user.id)); }
      await carregarPerfilAlimentar(); render(); toast('Peso registrado. As metas foram recalculadas.'); })
};
const r1 = v => Math.round(v*10)/10;

/* ---------- cardápio e marmitas ---------- */
const CD = () => window.MeuEixoCardapio;
const DIAS_SEM = ['Segunda','Terça','Quarta','Quinta','Sexta','Sábado','Domingo'];
const DIAS_CURTO = ['Seg','Ter','Qua','Qui','Sex','Sáb','Dom'];
const NOME_REF = {cafe:'Café da manhã',lanche_manha:'Lanche da manhã',almoco:'Almoço',lanche_tarde:'Lanche da tarde',jantar:'Jantar',ceia:'Ceia'};
const GRUPO_NOME = {proteina:'Proteínas',carbo:'Arroz, massas e tubérculos',leguminosa:'Feijões e grãos',paes:'Pães, aveia e tapioca',laticinio:'Leite e derivados',legume:'Legumes',salada:'Verduras e saladas',fruta:'Frutas',gordura:'Óleos'};
async function carregarAlimentacaoEspaco(){
  const id=S.esp;
  try{
    const pl=chk(await sb.from('planos_alimentares').select('mes,dados,atualizado_em').eq('espaco_id',id));
    const li=chk(await sb.from('listas_compra').select('chave,itens').eq('espaco_id',id));
    if(S.esp!==id) return;
    S.planos=Object.fromEntries(pl.map(x=>[x.mes,x.dados])); S.listas=Object.fromEntries(li.map(x=>[x.chave,x.itens||{}])); S.alErro4=false;
  }catch(e){ console.error(e); S.planos={}; S.listas={}; S.alErro4=true; }
  schedule();
}
function ctxDoPerfil(){
  const p=S.perfilAl; if(!p) return null; const c=N().calcular(p,hoje()); if(!c) return null;
  return {porRefeicao:c.porRefeicao, meta:c.meta, prot:c.prot, alergias:p.alergias||[], estilo:p.estilo, pessoas:p.pessoas||1, freezer:p.freezer, diasPreparo:p.diasPreparo||['dom'], marmitaLocal:p.marmitaLocal, horarios:p.horarios||{}, gosta:p.gosta||[], naoGosta:p.naoGosta||[], precoMarmita:p.precoMarmita||null, marmitasSemana:p.marmitasSemana||null, orcamento:p.orcamento||null};
}
const planoMes = () => S.planos?.[S.mes] || null;
async function salvarPlano(dados){ chk(await sb.from('planos_alimentares').upsert({espaco_id:S.esp,mes:S.mes,dados,atualizado_em:new Date().toISOString()},{onConflict:'espaco_id,mes'})); S.planos={...S.planos,[S.mes]:dados}; render(); }
const calcDe = pl => ({porRefeicao:pl.ctx.porRefeicao, meta:pl.ctx.meta, prot:pl.ctx.prot});
const perfDe = pl => pl.ctx;
const diaHoje = () => (new Date(hoje()+'T12:00:00').getDay()+6)%7;
const kc = v => Math.round(v).toLocaleString('pt-BR');

function vCardapios(){
  if(S.alErro4) return `<div class="empty"><strong>O cardápio precisa de uma atualização no banco</strong>No Supabase, execute o arquivo <b>004_cardapio_compras.sql</b> no SQL Editor e recarregue a página.</div>`;
  if(S.planos===undefined || S.perfilAl===undefined) return `<div class="empty"><strong>Carregando o cardápio…</strong></div>`;
  const pl=planoMes();
  if(!pl){
    if(!S.perfilAl) return `<div class="intro-al"><span class="eyebrow">Cardápios e marmitas</span><h2>Primeiro, o seu perfil alimentar</h2><p>O cardápio usa suas metas de energia e proteína, as refeições do seu dia e os alimentos que você aceita. Responda o questionário em Alimentação para começar.</p><div class="actions"><button class="btn primary" data-act="ir" data-v="alimentacao">Ir para o questionário</button></div></div>`;
    const ant=S.planos?.[addMes(S.mes,-1)];
    return `<div class="intro-al"><span class="eyebrow">Cardápio de ${mesLabel(S.mes)}</span><h2>Vamos montar o seu cardápio</h2>
      <p>Com base no seu perfil, monto as combinações de café, lanches e marmitas usando os alimentos que você aceita, com as porções em gramas e em medidas caseiras. Depois você troca o que quiser.</p>
      <ul><li>Cardápio do dia, da semana e do mês, com o total de calorias e proteína.</li><li>Plano de preparo das marmitas nos seus dias de cozinha.</li><li>Lista de compras mensal e reposição semanal.</li></ul>
      <div class="actions"><button class="btn primary" data-act="cdGerar">Montar meu cardápio</button>${ant?`<button class="btn" data-act="cdCopiar">Repetir o cardápio de ${MESES[+addMes(S.mes,-1).slice(5)-1]}</button>`:''}</div></div>`;
  }
  const tab=S.cdTab||'dia';
  const tabs=[['dia','Dia'],['semana','Semana'],['mes','Mês'],['combos','Combinações'],['preparo','Preparo']];
  const body={dia:cdDia,semana:cdSemana,mes:cdMes,combos:cdCombos,preparo:cdPreparo}[tab](pl);
  const desat = S.perfilAl && pl.ctx && (pl.ctx.meta!==N().calcular(S.perfilAl,hoje())?.meta);
  return `${desat?`<div class="alert"><span class="dot"></span><div style="flex:1"><p>Seu perfil mudou desde que este cardápio foi montado (meta de ${kc(pl.ctx.meta)} kcal).</p><div class="actions" style="margin-top:6px"><button class="btn sm primary" data-act="cdAtualizarCtx">Atualizar porções com o perfil atual</button></div></div></div>`:''}
    <div class="tabs" role="tablist">${tabs.map(([k,t])=>`<button role="tab" aria-selected="${tab===k}" data-act="cdTab" data-v="${k}">${t}</button>`).join('')}</div>${body}`;
}
function barraMeta(rot,val,alvo,und){ const pc=alvo?Math.min(130,val/alvo*100):0, cls=pc>110?'warn':pc<85?'warn':''; 
  return `<div class="meta-l"><div class="meta-t"><span>${rot}</span><b class="num">${kc(val)}${und} <span class="muted small">/ ${kc(alvo)}${und}</span></b></div><div class="bar ${cls}"><i style="width:${Math.min(100,pc).toFixed(0)}%"></i></div></div>`; }
function cdDia(pl){
  const d=S.cdDia??diaHoje(), calc=calcDe(pl), p=perfDe(pl), D=CD().dia(pl,d,calc,p);
  const gord=Math.round(calc.meta*0.28/9), carb=calc.prot?Math.round((calc.meta-calc.prot*4-gord*9)/4):null;
  return `<div class="dias">${DIAS_CURTO.map((t,i)=>`<button class="chip" data-act="cdDiaSel" data-v="${i}" aria-pressed="${i===d}">${t}${i===diaHoje()?' · hoje':''}</button>`).join('')}</div>
  <section class="panel"><h3>${DIAS_SEM[d]}: resumo do dia</h3>
    <div class="metas">${barraMeta('Energia',D.kcal,calc.meta,' kcal')}${calc.prot?barraMeta('Proteína',D.p,calc.prot,' g'):''}${carb?barraMeta('Carboidratos',D.c,carb,' g'):''}${barraMeta('Gorduras',D.l,gord,' g')}</div>
    <p class="small muted" style="margin:10px 0 0">Valores aproximados pela Tabela TACO (Unicamp). As porções já consideram o alimento pronto.</p></section>
  ${D.refeicoes.map(r=>{ const lista = r.marmita ? pl.marmitas : (r.ref==='cafe'?pl.cafe:r.ref==='ceia'?pl.ceia:pl.lanche);
    return `<section class="panel refeicao"><div class="ref-cab"><div><span class="eyebrow">${NOME_REF[r.ref]}${p.horarios?.[r.ref]?' · '+p.horarios[r.ref]:''}</span><h3>${esc(r.titulo)}</h3></div>
      <div class="ref-k"><b class="num">${kc(r.kcal)} kcal</b><span class="small muted">meta ${kc(r.alvo)} · ${Math.round(r.p)} g prot.</span></div></div>
      <div class="itens">${r.itens.map(i=>`<div class="item"><span>${esc(i.nome)}</span><span class="muted">${i.medida?esc(i.medida)+' · ':''}${i.g} g</span></div>`).join('')}</div>
      ${lista.length>1?`<div class="field" style="margin-top:12px;max-width:340px"><label for="op_${r.ref}">Opção para ${DIAS_SEM[d].toLowerCase()}</label><select id="op_${r.ref}" data-chg="cdOpcao" data-ref="${r.ref}" data-d="${d}">${lista.map((o,i)=>`<option value="${i}" ${i===r.opcao?'selected':''}>${esc(r.marmita?CD_titulo(o,p):tituloOpcao(o,p))}</option>`).join('')}</select></div>`:''}
    </section>`; }).join('')}`;
}
function CD_titulo(m,p){ return CD().refeicao({marmitas:[m],semana:[{almoco:0}],frutas:[]},0,'almoco',{porRefeicao:[{k:'almoco',kcal:600}],meta:2000,prot:100},p).titulo; }
function tituloOpcao(o,p){ return o.itens.map(i=>i.fruta?'Fruta':CD().nomeItem(i.id,p).replace(/ \(.+\)/,'')).join(' + '); }
function cdSemana(pl){
  const calc=calcDe(pl), p=perfDe(pl), dias=[0,1,2,3,4,5,6].map(d=>CD().dia(pl,d,calc,p));
  const refs=calc.porRefeicao.map(x=>x.k);
  const media=k=>dias.reduce((a,x)=>a+x[k],0)/7;
  const frutas=dias.reduce((a,x)=>a+x.refeicoes.flatMap(r=>r.itens).filter(i=>CD().C[i.id].g==='fruta').length,0);
  const marm=dias.reduce((a,x)=>a+x.refeicoes.filter(r=>r.marmita).length,0);
  return `<section class="kpis macros">
    <div class="kpi"><span class="lbl">Média por dia</span><span class="val">${kc(media('kcal'))}</span><span class="sub">kcal · meta ${kc(calc.meta)}</span></div>
    <div class="kpi"><span class="lbl">Proteína por dia</span><span class="val">${kc(media('p'))} g</span><span class="sub">${calc.prot?'meta '+calc.prot+' g':'média da semana'}</span></div>
    <div class="kpi"><span class="lbl">Frutas na semana</span><span class="val">${frutas}</span><span class="sub">porções (${(frutas/7).toFixed(1).replace('.',',')} por dia)</span></div>
    <div class="kpi"><span class="lbl">Marmitas</span><span class="val">${marm}</span><span class="sub">almoços e jantares na semana</span></div></section>
  <div class="scroll"><table class="semana"><thead><tr><th></th>${DIAS_CURTO.map((t,i)=>`<th>${t}</th>`).join('')}</tr></thead><tbody>
    ${refs.map(ref=>`<tr><th>${NOME_REF[ref]}</th>${dias.map((D,i)=>{ const r=D.refeicoes.find(x=>x.ref===ref); return `<td><button class="cel" data-act="cdIrDia" data-v="${i}">${r?esc(r.titulo):'—'}<span>${r?kc(r.kcal)+' kcal':''}</span></button></td>`; }).join('')}</tr>`).join('')}
    <tr class="tot"><th>Total</th>${dias.map(D=>`<td class="num">${kc(D.kcal)} kcal<br><span class="muted">${Math.round(D.p)} g prot.</span></td>`).join('')}</tr>
  </tbody></table></div>`;
}
function diasNoMes(ym){ const [y,m]=ym.split('-').map(Number); return new Date(y,m,0).getDate(); }
function cdMes(pl){
  const calc=calcDe(pl), p=perfDe(pl), n=diasNoMes(S.mes), sem=CD().consumoSemana(pl,calc,p), f=n/7;
  const grupos={}; Object.entries(sem).forEach(([id,g])=>{ const a=CD().C[id]; (grupos[a.g]=grupos[a.g]||[]).push({id,nome:CD().nomeItem(id,p),g:g*f,a}); });
  const marmMes=Math.round([0,1,2,3,4,5,6].reduce((a,d)=>a+CD().dia(pl,d,calc,p).refeicoes.filter(r=>r.marmita).length,0)*f*(p.pessoas||1));
  const pronto = p.precoMarmita ? r2(p.precoMarmita*marmMes) : null;
  return `<section class="kpis macros">
    <div class="kpi"><span class="lbl">Dias no mês</span><span class="val">${n}</span><span class="sub">${mesLabel(S.mes)}</span></div>
    <div class="kpi"><span class="lbl">Marmitas no mês</span><span class="val">${marmMes}</span><span class="sub">almoço e jantar${(p.pessoas||1)>1?` · ${p.pessoas} pessoas`:''}</span></div>
    <div class="kpi"><span class="lbl">Se fossem prontas</span><span class="val">${pronto?money(pronto):'—'}</span><span class="sub">${p.precoMarmita?`a ${money(p.precoMarmita)} cada`:'informe o preço no perfil'}</span></div>
    <div class="kpi"><span class="lbl">Custo por dia</span><span class="val">${(()=>{ const cp=custoPlano(pl,S.mes); return cp&&cp.cobertura>0?money(cp.dia):'—'; })()}</span><span class="sub">${(()=>{ const cp=custoPlano(pl,S.mes); return cp&&cp.cobertura>0?(cp.cobertura>=0.95?'todas as refeições, com preços pagos':`estimado (${Math.round(cp.cobertura*100)}% dos itens com preço)`):'envie um cupom para calcular'; })()}</span></div></section>
  ${painelEconomia(S.mes)}
  <section class="panel"><h3>Quanto você vai consumir em ${MESES[+S.mes.slice(5)-1]}</h3><p class="small muted" style="margin:-4px 0 12px">Alimento pronto, já somando ${p.pessoas>1?`as ${p.pessoas} pessoas`:'todas as refeições do mês'}.</p>
    ${Object.keys(GRUPO_NOME).filter(g=>grupos[g]).map(g=>`<h4 class="grupo-h">${GRUPO_NOME[g]}</h4><div class="list">${grupos[g].sort((a,b)=>b.g-a.g).map(x=>linha(esc(x.nome), x.a.u?`${Math.round(x.g/x.a.u)} ${x.a.un[1]}`:(x.g>=1000?(Math.round(x.g/100)/10).toString().replace('.',',')+' kg':Math.round(x.g/10)*10+' g'))).join('')}</div>`).join('')}
  </section>
  <div class="actions"><button class="btn primary" data-act="ir" data-v="compras">Ver lista de compras</button></div>`;
}
function selAlimento(slot, grupos, atual, p, extra=''){
  const ids=Object.keys(CD().C).filter(id=>grupos.includes(CD().C[id].g) && CD().permitido(id,{...p,naoGosta:p.naoGosta||[]}));
  if(atual && !ids.includes(atual)) ids.unshift(atual);
  return `<select data-chg="cdSlot" ${slot} ${extra}>${ids.map(id=>`<option value="${id}" ${id===atual?'selected':''}>${esc(CD().nomeItem(id,p))}</option>`).join('')}</select>`;
}
function cdCombos(pl){
  const p=perfDe(pl);
  const opcList=(tipo,lista)=>lista.map((o,i)=>`<div class="combo"><div class="combo-cab"><b>Opção ${i+1}</b>${lista.length>1?`<button class="btn sm ghost" data-act="cdRemover" data-tipo="${tipo}" data-i="${i}">Remover</button>`:''}</div>
    <div class="combo-slots">${o.itens.map((it,j)=>it.fruta?`<label class="slot"><span>Fruta</span><select disabled><option>Varia a cada dia</option></select></label>`:`<label class="slot"><span>${GRUPO_NOME[CD().C[it.id].g]||''}</span>${selAlimento(`data-tipo="${tipo}" data-i="${i}" data-j="${j}"`,[CD().C[it.id].g],it.id,p)}</label>`).join('')}</div></div>`).join('');
  return `<p class="muted small" style="margin:0">Troque qualquer alimento: a mudança vale para todos os dias que usam aquela opção. As porções se ajustam sozinhas às suas metas.</p>
  <section class="panel"><div class="section-head"><h3 style="margin:0">Marmitas (almoço e jantar)</h3><div class="right"><button class="btn sm" data-act="cdAddMarmita">+ Nova marmita</button></div></div>
    ${pl.marmitas.map((m,i)=>`<div class="combo"><div class="combo-cab"><b>${esc(CD_titulo(m,p))}</b>${pl.marmitas.length>2?`<button class="btn sm ghost" data-act="cdRemover" data-tipo="marmitas" data-i="${i}">Remover</button>`:''}</div>
      <div class="combo-slots">
        <label class="slot"><span>Proteína</span>${selAlimento(`data-tipo="marmitas" data-i="${i}" data-k="proteina"`,['proteina','leguminosa'],m.proteina,p)}</label>
        <label class="slot"><span>Acompanhamento</span>${selAlimento(`data-tipo="marmitas" data-i="${i}" data-k="carbo"`,['carbo'],m.carbo,p)}</label>
        <label class="slot"><span>Feijão ou grão</span><select data-chg="cdSlot" data-tipo="marmitas" data-i="${i}" data-k="leguminosa"><option value="">Sem</option>${Object.keys(CD().C).filter(id=>CD().C[id].g==='leguminosa'&&CD().permitido(id,p)).map(id=>`<option value="${id}" ${id===m.leguminosa?'selected':''}>${esc(CD().C[id].n)}</option>`).join('')}</select></label>
        ${(m.legumes||[]).map((v,j)=>`<label class="slot"><span>Legume ${j+1}</span>${selAlimento(`data-tipo="marmitas" data-i="${i}" data-k="legumes" data-j="${j}"`,['legume'],v,p)}</label>`).join('')}
      </div></div>`).join('')}</section>
  <section class="panel"><h3>Café da manhã</h3>${opcList('cafe',pl.cafe)}</section>
  <section class="panel"><h3>Lanches</h3>${opcList('lanche',pl.lanche)}</section>
  ${pl.ceia&&calcDe(pl).porRefeicao.some(x=>x.k==='ceia')?`<section class="panel"><h3>Ceia</h3>${opcList('ceia',pl.ceia)}</section>`:''}
  <section class="panel"><h3>Frutas da semana</h3><p class="small muted" style="margin:-4px 0 10px">Elas se revezam nos cafés e lanches.</p>
    <div class="chips">${Object.keys(CD().C).filter(id=>CD().C[id].g==='fruta'&&CD().permitido(id,p)).map(id=>`<button class="chip" data-act="cdFruta" data-v="${id}" aria-pressed="${pl.frutas.includes(id)}">${esc(CD().C[id].n)}</button>`).join('')}</div></section>
  <div class="actions"><button class="btn" data-act="cdRegerar">Gerar novas combinações</button></div>`;
}
function cdPreparo(pl){
  const calc=calcDe(pl), p=perfDe(pl), ses=CD().preparo(pl,calc,p), ordem={dom:'Domingo',seg:'Segunda',ter:'Terça',qua:'Quarta',qui:'Quinta',sex:'Sexta',sab:'Sábado'};
  const semFreezer=(p.freezer||'medio')==='nenhum';
  return `${ses.map(s=>`<section class="panel"><div class="ref-cab"><div><span class="eyebrow">Dia de preparo</span><h3>${ordem[s.dia]}: marmitas para ${s.n} ${s.n>1?'dias':'dia'}</h3></div>
      <div class="ref-k"><b class="num">${s.potes} potes</b><span class="small muted">${s.geladeira} na geladeira · ${s.freezer} no freezer</span></div></div>
      ${s.freezer && semFreezer?`<div class="alert warn" style="margin:12px 0"><span class="dot"></span><div><p>Sem freezer, comida pronta deve ser consumida em até 3 dias. Inclua outro dia de preparo no seu perfil.</p></div></div>`:''}
      <table class="prep"><thead><tr><th>Alimento</th><th class="r">Comprar / separar (cru)</th><th class="r">Rende pronto</th></tr></thead><tbody>
      ${s.cozinhar.map(x=>`<tr><td>${esc(x.nome)}</td><td class="r">${x.txtCru}</td><td class="r muted">${x.txtPronto}</td></tr>`).join('')}</tbody></table></section>`).join('')}
  <section class="panel"><h3>Ordem de preparo</h3><ol class="passos">
    <li><b>Feijão ou grãos primeiro.</b> Deixe de molho na noite anterior e cozinhe na panela de pressão; enquanto isso, adiante o resto.</li>
    <li><b>Arroz ou massa.</b> Cozinhe a quantidade total da semana de uma vez.</li>
    <li><b>Proteínas.</b> Tempere e prepare no forno, na air fryer ou na frigideira. Carne moída rende bem refogada em panela grande.</li>
    <li><b>Legumes.</b> Cozinhe no vapor ou asse até ficarem macios, mas firmes, para não amolecerem no reaquecimento.</li>
    <li><b>Monte as marmitas.</b> Divida nas porções de cada dia, espere amornar e tampe. Leve à geladeira ou ao freezer em até 2 horas depois de pronto.</li>
    <li><b>Etiquete</b> cada pote com o dia e a data do preparo.</li></ol></section>
  <section class="panel"><h3>Conservação segura</h3><ul class="passos">
    <li>Geladeira (até 5 °C): consumir em até <b>3 dias</b>.</li>
    <li>Freezer (−18 °C): até <b>30 dias</b>. Descongele na geladeira de um dia para o outro ou direto no micro-ondas.</li>
    <li>Não recongele o que já foi descongelado. Folhas e saladas cruas vão à parte, montadas na hora.</li>
    <li>Reaqueça até ficar bem quente por igual.</li></ul>
    <p class="small muted" style="margin:8px 0 0">Referência: boas práticas da Anvisa para alimentos preparados (RDC 216/2004).</p></section>`;
}

/* ---------- lista de compras ---------- */
function vCompras(){
  if(S.alErro4) return `<div class="empty"><strong>A lista de compras precisa de uma atualização no banco</strong>Execute o arquivo <b>004_cardapio_compras.sql</b> no Supabase e recarregue.</div>`;
  if(S.planos===undefined) return `<div class="empty"><strong>Carregando…</strong></div>`;
  const pl=planoMes();
  if(!pl) return `<div class="empty"><strong>Sem cardápio em ${mesLabel(S.mes)}</strong>A lista é gerada a partir do cardápio do mês.<div class="actions" style="justify-content:center;margin-top:12px"><button class="btn primary" data-act="ir" data-v="cardapios">Montar cardápio</button></div></div>`;
  if(S.lcTab==='historico') return `<div class="tabs" role="tablist"><button role="tab" aria-selected="false" data-act="lcTab" data-v="mensal">Compra do mês</button><button role="tab" aria-selected="false" data-act="lcTab" data-v="semanal">Reposição semanal</button><button role="tab" aria-selected="true" data-act="lcTab" data-v="historico">Compras e preços</button></div>${painelEconomia(S.mes)}${vHistoricoCompras()}`;
  const tipo=S.lcTab||'mensal', chave=`${S.mes}:${tipo}`, est=S.listas?.[chave]||{};
  const L=CD().listas(pl,calcDe(pl),perfDe(pl),diasNoMes(S.mes)), itens=L[tipo];
  const ativos=itens.filter(i=>!est[i.id]?.tenho), comprados=ativos.filter(i=>est[i.id]?.ok);
  const estim=i=> est[i.id]?.preco>0 ? est[i.id].preco : CP().custoLinhaLista(i,S.precos||[],CD().C);
  const comPreco=ativos.filter(i=>estim(i)!=null), total=sum(comPreco,i=>estim(i));
  const grupos={}; itens.forEach(i=>(grupos[i.grupo]=grupos[i.grupo]||[]).push(i));
  return `<div class="tabs" role="tablist"><button role="tab" aria-selected="${tipo==='mensal'}" data-act="lcTab" data-v="mensal">Compra do mês (${L.mensal.length})</button><button role="tab" aria-selected="${tipo==='semanal'}" data-act="lcTab" data-v="semanal">Reposição semanal (${L.semanal.length})</button><button role="tab" aria-selected="false" data-act="lcTab" data-v="historico">Compras e preços</button></div>
  <div class="actions"><button class="btn primary" data-act="cupomNovo">${icon(I.foto)}Enviar cupom fiscal</button></div>
  ${painelEconomia(S.mes)}
  <section class="kpis macros">
    <div class="kpi"><span class="lbl">Itens</span><span class="val">${comprados.length}/${ativos.length}</span><span class="sub">comprados${itens.length-ativos.length?` · ${itens.length-ativos.length} já em casa`:''}</span></div>
    <div class="kpi"><span class="lbl">Total estimado</span><span class="val">${money(total)}</span><span class="sub">${comPreco.length} de ${ativos.length} itens com preço</span></div>
    <div class="kpi"><span class="lbl">Mercados</span><span class="val" style="font-size:18px">Comper · Big Lar</span><span class="sub">Cuiabá</span></div>
    <div class="kpi"><span class="lbl">${tipo==='mensal'?'Para':'Para'}</span><span class="val" style="font-size:18px">${tipo==='mensal'?mesLabel(S.mes):'7 dias'}</span><span class="sub">${tipo==='mensal'?'itens duráveis e proteínas para congelar':'frutas, legumes, verduras e frescos'}</span></div></section>
  <p class="note" style="margin:0">Ao voltar do mercado, envie a foto do cupom: os itens são marcados aqui com o valor pago, e os preços passam a estimar as próximas compras. Valores em cinza são estimativas pelo último preço pago.</p>
  ${Object.keys(GRUPO_NOME).filter(g=>grupos[g]).map(g=>`<section class="panel lista"><h3>${GRUPO_NOME[g]}</h3>${grupos[g].map(i=>{ const e=est[i.id]||{};
    return `<div class="lc ${e.ok?'ok':''} ${e.tenho?'tenho':''}"><button class="lc-check" data-act="lcOk" data-id="${i.id}" aria-pressed="${!!e.ok}" aria-label="Marcar ${esc(i.nome)} como comprado" ${e.tenho?'disabled':''}>${icon(I.check)}</button>
      <div class="lc-t"><b>${esc(i.nome)}</b><span>${esc(i.txt)}${i.sub?' · '+esc(i.sub):''}</span></div>
      <input class="inline-input num" inputmode="decimal" placeholder="${estim(i)!=null?'≈ '+fmtInput(estim(i)):'R$'}" aria-label="Preço pago: ${esc(i.nome)}" data-lcpreco="${i.id}" value="${e.preco?fmtInput(e.preco):''}" ${e.tenho?'disabled':''}>
      <button class="btn sm ghost" data-act="lcTenho" data-id="${i.id}">${e.tenho?'Comprar':'Já tenho'}</button></div>`; }).join('')}</section>`).join('')}
  <div class="actions">${tipo==='semanal'?`<button class="btn" data-act="lcLimpar">Começar nova semana</button>`:''}<button class="btn" data-act="ir" data-v="cardapios">Voltar ao cardápio</button></div>`;
}
async function precoManual(id, valor){
  const pl=planoMes(); if(!pl) return; const L=CD().listas(pl,calcDe(pl),perfDe(pl),diasNoMes(S.mes)); const it=[...L.mensal,...L.semanal].find(x=>x.id===id); if(!it) return;
  const a=CD().C[id]; const q = it.und==='kg' ? {gramas:it.qtd*1000} : it.und==='pct' ? {gramas:it.qtd*a.cp.emb} : {unidades:it.qtd};
  chk(await sb.from('precos').delete().eq('espaco_id',S.esp).eq('alimento_id',id).eq('origem','manual').eq('data',hoje()));
  chk(await sb.from('precos').insert({espaco_id:S.esp,alimento_id:id,data:hoje(),valor,origem:'manual',...q}));
  await carregarComprasPrecos();
}
async function salvarLista(chave, novo){ S.listas={...S.listas,[chave]:novo}; render(); chk(await sb.from('listas_compra').upsert({espaco_id:S.esp,chave,itens:novo,atualizado_em:new Date().toISOString()},{onConflict:'espaco_id,chave'})); }
function alterarItem(id, patch){ const chave=`${S.mes}:${S.lcTab||'mensal'}`, est={...(S.listas?.[chave]||{})}; est[id]={...(est[id]||{}),...patch}; return salvarLista(chave,est); }

const acoesCd = {
  cdTab: el => { S.cdTab=el.dataset.v; render(); },
  cdDiaSel: el => { S.cdDia=+el.dataset.v; render(); },
  cdIrDia: el => { S.cdDia=+el.dataset.v; S.cdTab='dia'; render(); window.scrollTo(0,0); },
  cdGerar: async () => { const ctx=ctxDoPerfil(); if(!ctx){ toast('Complete o perfil alimentar primeiro.'); return; } const d={...CD().gerar(S.perfilAl, Date.now()%100000), ctx}; await salvarPlano(d); S.cdTab='dia'; toast('Cardápio montado. Confira e troque o que quiser.'); },
  cdCopiar: async () => { const ant=S.planos[addMes(S.mes,-1)]; const ctx=ctxDoPerfil()||ant.ctx; await salvarPlano({...ant,ctx}); toast('Cardápio do mês anterior repetido.'); },
  cdRegerar: () => confirmar('Gerar novas combinações','As combinações atuais e as trocas que você fez neste mês serão substituídas.',[{t:'Gerar novas',cls:'primary',fn:async()=>{ const pl=planoMes(); const base=S.perfilAl?{...S.perfilAl}:{...pl.ctx}; await salvarPlano({...CD().gerar(base,Date.now()%100000),ctx:ctxDoPerfil()||pl.ctx}); }}]),
  cdAtualizarCtx: async () => { await salvarPlano({...planoMes(),ctx:ctxDoPerfil()}); toast('Porções atualizadas.'); },
  cdAddMarmita: async () => { const pl=structuredClone(planoMes()); const m=pl.marmitas[pl.marmitas.length-1]; pl.marmitas.push({...m,legumes:[...(m.legumes||[])]}); await salvarPlano(pl); toast('Marmita adicionada. Troque os alimentos dela abaixo.'); },
  cdRemover: async el => { const pl=structuredClone(planoMes()), t=el.dataset.tipo, i=+el.dataset.i; pl[t].splice(i,1);
    const ref = t==='marmitas'?['almoco','jantar']:t==='cafe'?['cafe']:t==='ceia'?['ceia']:['lanche_manha','lanche_tarde'];
    pl.semana.forEach(s=>ref.forEach(r=>{ if(s[r]===i) s[r]=0; else if(s[r]>i) s[r]--; })); await salvarPlano(pl); },
  cdFruta: async el => { const pl=structuredClone(planoMes()), id=el.dataset.v; pl.frutas = pl.frutas.includes(id) ? pl.frutas.filter(x=>x!==id) : [...pl.frutas,id]; if(!pl.frutas.length){ toast('Mantenha pelo menos uma fruta.'); return; } await salvarPlano(pl); },
  lcTab: el => { S.lcTab=el.dataset.v; render(); },
  lcOk: el => { const id=el.dataset.id, e=S.listas?.[`${S.mes}:${S.lcTab||'mensal'}`]?.[id]||{}; return alterarItem(id,{ok:!e.ok}); },
  lcTenho: el => { const id=el.dataset.id, e=S.listas?.[`${S.mes}:${S.lcTab||'mensal'}`]?.[id]||{}; return alterarItem(id,{tenho:!e.tenho, ok:false}); },
  lcLimpar: () => confirmar('Começar nova semana','Os itens marcados e os preços da reposição semanal serão limpos.',[{t:'Limpar',cls:'primary',fn:()=>salvarLista(`${S.mes}:semanal`,{})}])
};
async function mudarCombo(t){
  const pl=structuredClone(planoMes()), tipo=t.dataset.tipo, i=+t.dataset.i;
  if(tipo==='marmitas'){ const k=t.dataset.k; if(k==='legumes') pl.marmitas[i].legumes[+t.dataset.j]=t.value; else pl.marmitas[i][k]=t.value||null; }
  else pl[tipo][i].itens[+t.dataset.j].id=t.value;
  await salvarPlano(pl);
}

/* ---------- cupom fiscal, preços e economia ---------- */
const CP = () => window.MeuEixoCupom;
async function carregarComprasPrecos(){
  const id=S.esp;
  try{
    const c=chk(await sb.from('compras').select('*').eq('espaco_id',id).order('data',{ascending:false}).limit(200));
    const p=chk(await sb.from('precos').select('alimento_id,data,valor,gramas,unidades,origem,estabelecimento').eq('espaco_id',id).order('data',{ascending:false}).limit(1000));
    if(S.esp!==id) return; S.compras=c.map(fromDb); S.precos=p; S.alErro5=false;
  }catch(e){ console.error(e); S.compras=[]; S.precos=[]; S.alErro5=true; }
  schedule();
}
const catPorNome = (...nomes) => { for(const n of nomes){ const c=S.cats.find(x=>x.nome.toLowerCase()===n.toLowerCase()); if(c) return c.id; } return null; };
const DESTINOS = [['outro_alimento','Outro alimento'],['limpeza','Limpeza'],['higiene','Higiene e cuidados pessoais'],['outros','Outros (não alimento)'],['ignorar','Não registrar']];

function abrirCupom(){
  if(S.alErro5){ toast('Execute primeiro a atualização 005 do banco no Supabase.'); return; }
  S.cupom=null;
  abrirModal(`<div>${head('Enviar cupom fiscal')}</div>
    <input type="file" id="arqCupom" accept="image/*,application/pdf" hidden>
    <div class="cupom-dica"><b>Para uma boa leitura</b><ul><li>Fotografe o cupom inteiro, reto, sobre uma superfície escura e com boa luz.</li><li>Se o cupom for longo, pode enviar em PDF ou print da NFC-e no app do mercado.</li><li>Você confere todos os itens antes de salvar.</li></ul></div>
    <p class="small muted" id="cupomStatus" style="margin:0"></p>
    <footer><button type="button" class="btn" data-act="fechar">Cancelar</button><button type="button" class="btn primary" data-act="cupomEscolher">${icon(I.foto)}Escolher foto ou arquivo</button></footer>`,null);
  $('#sheet').classList.add('larga');
}
async function processarCupom(input){
  const arq=input.files?.[0]; if(!arq) return; const st=$('#cupomStatus');
  if(arq.size>10*1024*1024){ st.textContent='O arquivo passa de 10 MB. Envie uma foto menor.'; return; }
  st.textContent='Lendo o cupom… isso pode levar até 1 minuto na primeira vez.';
  let hash=null; try{ hash=await LEITOR().hash(arq); }catch(_){}
  let r;
  try{ const texto=await LEITOR().textoDe(arq,p=>{ st.textContent=`Lendo o cupom… ${p}%`; },true); r=CP().interpretarCupom(texto); }
  catch(e){ console.error(e); st.textContent='Não consegui ler este arquivo. Você pode lançar os itens manualmente na próxima tela.'; r={itens:[],total:null,desconto:0,data:null,loja:'',cnpj:'',chave:'',forma:''}; }
  const itens=r.itens.map(i=>{ const s=CP().sugerir(i.descricao); return {...i,...s}; });
  S.cupom={file:arq, hash, ...r, itens: itens.length?itens:[{descricao:'',quantidade:1,unidade:'UN',valorTotal:null,destino:'outro_alimento',confere:true}], data:r.data||hoje(), forma:r.forma||'Débito'};
  renderCupom();
}
function opcoesDestino(it){
  const C=CD().C, p=S.perfilAl||{};
  const alim=Object.keys(C).filter(id=>id!=='azeite'||true).sort((a,b)=>C[a].n.localeCompare(C[b].n,'pt'));
  const v = it.destino==='alimento' ? 'a:'+it.alimento_id : it.destino;
  return `<optgroup label="Alimentos do cardápio">${alim.map(id=>`<option value="a:${id}" ${v==='a:'+id?'selected':''}>${esc(C[id].n)}</option>`).join('')}</optgroup><optgroup label="Outros">${DESTINOS.map(([k,t])=>`<option value="${k}" ${v===k?'selected':''}>${t}</option>`).join('')}</optgroup>`;
}
function renderCupom(){
  const c=S.cupom, soma=r2(c.itens.filter(i=>i.destino!=='ignorar').reduce((a,i)=>a+(+i.valorTotal||0),0));
  const pagar = c.total!=null ? r2(c.total-(+c.desconto||0)) : null;
  const dif = c.total!=null ? r2(soma-c.total) : null;
  const dup = (S.compras||[]).find(x=>(c.chave&&x.chaveAcesso===c.chave)||(c.hash&&x.comprovanteHash===c.hash));
  $('#sheet').innerHTML=`<form data-form="cupom">${head('Conferir compra')}
    ${dup?`<div class="alert warn"><span class="dot"></span><div><p>Este cupom já foi registrado em ${dataBR(dup.data)} (${money(dup.total)}). Salvar de novo vai duplicar o gasto.</p></div></div>`:''}
    <div class="form-grid cupom-cab">
      <div class="field"><label for="cLoja">Mercado</label><input id="cLoja" name="loja" value="${esc(c.loja)}" placeholder="Ex.: Comper"></div>
      <div class="field"><label for="cData">Data da compra</label><input id="cData" name="data" type="date" value="${c.data}"></div>
      <div class="field"><label for="cForma">Forma de pagamento</label><select id="cForma" name="forma">${opts(FORMAS.map(x=>[x,x]),c.forma)}</select></div>
      <div class="field"><label for="cTotal">Total dos itens no cupom (R$)</label><input id="cTotal" name="total" inputmode="decimal" value="${c.total!=null?fmtInput(c.total):''}"></div>
      <div class="field"><label for="cDesc">Desconto (R$)</label><input id="cDesc" name="desconto" inputmode="decimal" value="${c.desconto?fmtInput(c.desconto):''}"></div>
    </div>
    <div class="scroll"><table class="cupom-itens"><thead><tr><th>Item do cupom</th><th class="r">Qtd</th><th>Un</th><th class="r">Valor (R$)</th><th>É o quê?</th><th></th></tr></thead><tbody>
    ${c.itens.map((it,i)=>`<tr class="${it.confere===false?'atencao':''} ${it.destino==='ignorar'?'ignorado':''}">
      <td><input name="d${i}" value="${esc(it.descricao)}" aria-label="Descrição do item ${i+1}"></td>
      <td><input name="q${i}" class="r" inputmode="decimal" value="${String(it.quantidade??1).replace('.',',')}" aria-label="Quantidade"></td>
      <td><input name="u${i}" class="un" value="${esc(it.unidade||'UN')}" aria-label="Unidade"></td>
      <td><input name="v${i}" class="r" inputmode="decimal" value="${it.valorTotal!=null?fmtInput(it.valorTotal):''}" aria-label="Valor total"></td>
      <td><select name="t${i}" aria-label="Classificação">${opcoesDestino(it)}</select></td>
      <td><button type="button" class="btn sm ghost" data-act="cupomDel" data-i="${i}" aria-label="Remover item">${icon(I.trash)}</button></td></tr>`).join('')}
    </tbody></table></div>
    <div class="actions"><button type="button" class="btn sm" data-act="cupomAdd">${icon(I.plus)}Adicionar item</button></div>
    <div class="cupom-total ${dif!==null&&Math.abs(dif)>0.05?'diferente':''}">
      <span>Soma dos itens: <b>${money(soma)}</b>${c.total!=null?` · total do cupom: <b>${money(c.total)}</b>${c.desconto?` · a pagar: <b>${money(pagar)}</b>`:''}`:''}</span>
      <span>${dif===null?'Informe o total do cupom para conferir.':Math.abs(dif)<=0.05?'Os valores conferem.':`Diferença de ${money(Math.abs(dif))}: ${dif>0?'sobra':'falta'} algum item ou valor.`}</span></div>
    <p class="small muted" style="margin:0">Itens em amarelo: quantidade × preço não bate com o total da linha. Itens “Não registrar” ficam fora dos gastos. Ao salvar, a compra vira despesa paga (alimentos em Supermercado, limpeza e higiene em suas categorias), os preços entram no histórico e os itens são marcados na lista de compras.</p>
    ${rodape('Salvar compra')}</form>`;
  $('#sheet').classList.add('larga');
}
function lerCupomForm(f){
  const E=f.elements, c=S.cupom;
  c.loja=E.loja.value.trim(); c.data=E.data.value; c.forma=E.forma.value;
  c.total=E.total.value.trim()?parseValor(E.total.value):null; c.desconto=E.desconto.value.trim()?parseValor(E.desconto.value):0;
  c.itens=c.itens.map((it,i)=>{ const t=E['t'+i].value; const q=parseValor(E['q'+i].value), v=parseValor(E['v'+i].value);
    return {...it, descricao:E['d'+i].value.trim(), quantidade:isNaN(q)?1:q, unidade:E['u'+i].value.trim().toUpperCase()||'UN', valorTotal:isNaN(v)?null:v,
      destino: t.startsWith('a:')?'alimento':t, alimento_id: t.startsWith('a:')?t.slice(2):null}; });
}
async function salvarCupom(f){
  lerCupomForm(f); const c=S.cupom;
  const itens=c.itens.filter(i=>i.destino!=='ignorar' && i.descricao);
  if(!itens.length) return 'Inclua pelo menos um item.';
  if(itens.some(i=>!(i.valorTotal>0))) return 'Há item sem valor. Preencha ou marque como “Não registrar”.';
  if(!c.data) return 'Informe a data da compra.';
  const soma=r2(itens.reduce((a,i)=>a+i.valorTotal,0)), desc=+c.desconto||0, fator=soma>0?(soma-desc)/soma:1;
  const grupos={alimentos:0,limpeza:0,higiene:0,outros:0};
  itens.forEach(i=>{ const g=i.destino==='alimento'||i.destino==='outro_alimento'?'alimentos':i.destino; grupos[g]+=i.valorTotal; });
  anexo={file:c.file, hash:c.hash}; const arq=await enviarArquivo(); anexo=null;
  const loja=c.loja||'mercado', cats={alimentos:catPorNome('Supermercado','Alimentação'), limpeza:catPorNome('Limpeza','Outras despesas'), higiene:catPorNome('Higiene e cuidados pessoais','Outras despesas'), outros:catPorNome('Outras despesas')};
  const nomes={alimentos:'alimentos',limpeza:'limpeza',higiene:'higiene',outros:'outros itens'};
  const linhas=Object.entries(grupos).filter(([,v])=>v>0).map(([g,v])=>({descricao:`Mercado ${loja}: ${nomes[g]}`, valor:r2(v*fator), categoria:cats[g]||'', comportamento:'variavel', formaPagamento:c.forma, dataCompra:c.data, vencimento:c.data, dataPagamento:c.data, situacao:'paga', periodo:'', parcelas:1, obs:'Lançado pelo cupom fiscal', ...(arq||{})}));
  const totPago=r2(linhas.reduce((a,x)=>a+x.valor,0)), alvo=r2(soma-desc); if(linhas.length && totPago!==alvo) linhas[0].valor=r2(linhas[0].valor+alvo-totPago);
  const desp=chk(await sb.from('despesas').insert(linhas.map(r=>({...toDb(r),espaco_id:S.esp}))).select('id'));
  const compra=chk(await sb.from('compras').insert({espaco_id:S.esp,data:c.data,estabelecimento:c.loja,cnpj:c.cnpj||'',total:soma,desconto:desc,forma_pagamento:c.forma,chave_acesso:c.chave||null,comprovante:arq?.comprovante||null,comprovante_hash:c.hash||null,despesa_ids:desp.map(x=>x.id)}).select('id').single());
  const linhasItens=itens.map(i=>{ const m=CP().medidas(i,CD().C); return {compra_id:compra.id,espaco_id:S.esp,descricao:i.descricao,destino:i.destino,alimento_id:i.alimento_id||null,quantidade:i.quantidade,unidade:i.unidade,valor_total:i.valorTotal,gramas:m.gramas,unidades:m.unidades}; });
  const ins=chk(await sb.from('compra_itens').insert(linhasItens).select('id,alimento_id,valor_total,gramas,unidades'));
  const precos=ins.filter(x=>x.alimento_id && (x.gramas>0||x.unidades>0)).map(x=>({espaco_id:S.esp,alimento_id:x.alimento_id,data:c.data,valor:r2(x.valor_total*fator),gramas:x.gramas,unidades:x.unidades,origem:'cupom',estabelecimento:c.loja,compra_item_id:x.id}));
  if(precos.length) chk(await sb.from('precos').insert(precos));
  // marca na lista de compras do mês da compra
  const ym=c.data.slice(0,7), pl=S.planos?.[ym];
  if(pl){ const L=CD().listas(pl,calcDe(pl),perfDe(pl),diasNoMes(ym));
    for(const tipo of ['mensal','semanal']){ const chave=`${ym}:${tipo}`, est={...(S.listas?.[chave]||{})}; let mudou=false;
      itens.filter(i=>i.alimento_id && L[tipo].some(x=>x.id===i.alimento_id)).forEach(i=>{ const e=est[i.alimento_id]||{}; est[i.alimento_id]={...e,ok:true,preco:r2((e.cupom?e.preco||0:0)+i.valorTotal*fator),cupom:true}; mudou=true; });
      if(mudou) await salvarLista(chave,est); } }
  await recarregar('despesas'); await carregarComprasPrecos();
  const nAl=itens.filter(i=>i.alimento_id).length;
  S.cupom=null; toast(`Compra salva: ${money(alvo)}. ${nAl} ${nAl===1?'alimento entrou':'alimentos entraram'} no histórico de preços.`);
}

/* ---------- custo e economia ---------- */
function custoPlano(pl, ym){
  if(!pl) return null;
  const calc=calcDe(pl), p=perfDe(pl), precos=S.precos||[], C=CD().C, pes=Math.max(1,+p.pessoas||1);
  let semana=0, gTot=0, gComPreco=0, marmCusto=0, marmN=0; const faltam=new Set(); let marmCompleta=true;
  for(let d=0;d<7;d++) CD().dia(pl,d,calc,p).refeicoes.forEach(r=>{ let cr=0;
    r.itens.forEach(i=>{ const v=CP().custoConsumo(i.id,i.g,precos,C); gTot+=i.g; if(v!=null){ cr+=v; gComPreco+=i.g; } else { faltam.add(i.id); if(r.marmita) marmCompleta=false; } });
    semana+=cr; if(r.marmita){ marmN++; marmCusto+=cr; } });
  const dias=diasNoMes(ym), cob=gTot?gComPreco/gTot:0;
  const marmMedia = marmN && gComPreco>0 ? marmCusto/marmN : null;
  const marmMes = Math.round(marmN/7*dias*pes);
  return {dia:semana/7*pes, mes:semana/7*dias*pes, cobertura:cob, marmMedia, marmCompleta, marmMes, faltam:[...faltam].map(id=>C[id].cp.n)};
}
function resumoGastoAlimentar(ym){
  const D=despMes(ym).filter(ativa), alim=new Set(S.cats.filter(c=>c.alimentacao).map(c=>c.id)), marmCat=catPorNome('Marmitas compradas');
  const total=sum(D.filter(d=>alim.has(d.categoria)),d=>d.valor), prontas=sum(D.filter(d=>d.categoria===marmCat),d=>d.valor);
  return {total, prontas, mercado:r2(total-prontas)};
}
function painelEconomia(ym){
  const pl=S.planos?.[ym], cp=custoPlano(pl,ym), g=resumoGastoAlimentar(ym);
  const p=pl?.ctx||{}, pronta=(S.perfilAl?.precoMarmita)||p.precoMarmita||null, orc=(S.perfilAl?.orcamento)||p.orcamento||null;
  const h=hoje(), dm=diasNoMes(ym), passados = ym<h.slice(0,7) ? dm : ym>h.slice(0,7) ? 0 : +h.slice(8,10);
  const econUn = (pronta && cp?.marmMedia!=null && cp.marmCompleta) ? pronta-cp.marmMedia : null;
  const econMes = econUn!=null ? econUn*cp.marmMes : null, econHoje = econMes!=null ? econMes*passados/dm : null;
  const cob = cp ? Math.round(cp.cobertura*100) : 0;
  return `<section class="kpis macros economia">
    <div class="kpi"><span class="lbl">Gasto com alimentação</span><span class="val">${money(g.total)}</span><span class="sub">${g.prontas?`${money(g.mercado)} mercado · ${money(g.prontas)} marmitas prontas`:`em ${mesLabel(ym)}`}${orc?` · orçamento ${money(orc)}`:''}</span></div>
    <div class="kpi"><span class="lbl">Custo planejado do mês</span><span class="val">${cp&&cob>0?money(cp.mes):'—'}</span><span class="sub">${cp?(cob>=95?'com preços pagos':cob>0?`estimado com ${cob}% dos itens com preço`:'envie um cupom para calcular'):'sem cardápio no mês'}</span></div>
    <div class="kpi"><span class="lbl">Marmita feita em casa</span><span class="val">${cp?.marmMedia!=null?money(cp.marmMedia):'—'}</span><span class="sub">${cp?.marmMedia!=null&&!cp.marmCompleta?`parcial: faltam preços de ${cp.faltam.length} ${cp.faltam.length>1?'itens':'item'}`:pronta?`pronta custa ${money(pronta)}`:'informe o preço da pronta no perfil'}</span></div>
    <div class="kpi"><span class="lbl">Economia</span><span class="val ${econHoje>0?'pos':''}">${econHoje!=null?money(econHoje):'—'}</span><span class="sub">${econMes!=null?`até hoje · ${money(econMes)} no mês (${cp.marmMes} marmitas)`:'aparece quando todos os ingredientes das marmitas tiverem preço'}</span></div>
  </section>${cp&&cp.faltam.length&&cp.cobertura>0?`<p class="small muted" style="margin:-12px 0 0">Ainda sem preço: ${cp.faltam.slice(0,8).map(esc).join(', ')}${cp.faltam.length>8?'…':''}. Eles entram no cálculo no próximo cupom ou ao digitar o preço na lista.</p>`:''}`;
}

/* ---------- histórico de compras e preços ---------- */
function vHistoricoCompras(){
  if(S.alErro5) return `<div class="empty"><strong>Histórico indisponível</strong>Execute a atualização <b>005_compras_precos.sql</b> no Supabase.</div>`;
  const C=CD().C, precos=S.precos||[];
  const ids=[...new Set(precos.map(p=>p.alimento_id))].filter(id=>C[id]).sort((a,b)=>C[a].n.localeCompare(C[b].n,'pt'));
  const linhaPreco=id=>{ const lst=precos.filter(p=>p.alimento_id===id); const at=CP().precoAtual(id,lst,C), ant=lst.length>1?CP().precoAtual(id,lst.slice(1),C):null;
    const usaUn=C[id].cp.und==='un' && at.porUn!=null; const v=usaUn?at.porUn:at.porKg, va=ant?(usaUn?ant.porUn:ant.porKg):null; const varp=va?((v-va)/va*100):null;
    return `<tr><td>${esc(C[id].cp.n)}</td><td class="r">${money(v)}<span class="muted"> /${usaUn?(id==='ovo'?'ovo':'un'):'kg'}</span></td><td class="r ${varp>0.5?'neg':varp<-0.5?'pos':''}">${varp==null?'—':(varp>0?'+':'')+varp.toFixed(1).replace('.',',')+'%'}</td><td>${dataBR(at.data)}${at.loja?' · '+esc(at.loja):''}</td></tr>`; };
  return `<section class="panel"><div class="section-head"><h3 style="margin:0">Compras registradas</h3><div class="right"><button class="btn sm primary" data-act="cupomNovo">${icon(I.foto)}Enviar cupom fiscal</button></div></div>
    ${(S.compras||[]).length?`<div class="list">${S.compras.slice(0,30).map(c=>`<div class="row" style="grid-template-columns:minmax(0,1fr) auto"><div><div class="t">${esc(c.estabelecimento||'Mercado')}</div><div class="meta"><span>${dataBR(c.data)}</span><span>${esc(c.formaPagamento||'')}</span>${c.desconto>0?`<span>desconto ${money(c.desconto)}</span>`:''}</div></div><div class="v">${money(c.total-(+c.desconto||0))}${c.comprovante?`<div><button class="btn sm ghost" data-act="verComp" data-path="${esc(c.comprovante)}">Ver cupom</button></div>`:''}</div></div>`).join('')}</div>`:`<p class="muted small">Nenhuma compra registrada ainda. Envie a foto do cupom ao voltar do mercado.</p>`}</section>
  <section class="panel"><h3>Preços que você pagou</h3>
    ${ids.length?`<div class="scroll"><table><thead><tr><th>Produto</th><th class="r">Último preço</th><th class="r">Variação</th><th>Quando e onde</th></tr></thead><tbody>${ids.map(linhaPreco).join('')}</tbody></table></div>
    <p class="small muted" style="margin:8px 0 0">Variação em relação à compra anterior do mesmo produto. Estes preços são usados para estimar o custo do cardápio e da lista.</p>`:`<p class="muted small">Os preços aparecem aqui a partir do primeiro cupom.</p>`}</section>`;
}

const acoesCupom = {
  cupomNovo: () => abrirCupom(),
  cupomEscolher: () => { const i=$('#arqCupom'); if(i){ i.value=''; i.click(); } },
  cupomAdd: () => { lerCupomForm($('form[data-form="cupom"]')); S.cupom.itens.push({descricao:'',quantidade:1,unidade:'UN',valorTotal:null,destino:'outro_alimento',confere:true}); renderCupom(); },
  cupomDel: el => { lerCupomForm($('form[data-form="cupom"]')); S.cupom.itens.splice(+el.dataset.i,1); renderCupom(); }
};

/* ---------- lançamento rápido por comprovante ou texto ---------- */
const RC = () => window.MeuEixoReconhecer;
const ehCupom = t => /DOCUMENTO AUXILIAR|NFC-?E|CUPOM FISCAL|DANFE/i.test(t||'') && (String(t).match(/\d+[.,]\d{2}\s*$/gm)||[]).length>=4;
function abrirRapido(){
  abrirModal(`<div>${head('Enviar comprovante')}</div>
    <input type="file" id="arqRapido" accept="image/*,application/pdf" multiple hidden>
    <button type="button" class="drop" data-act="rapidoEscolher">${icon(I.clip)}<b>Escolher comprovantes</b><span>Foto, print ou PDF. Pode selecionar vários de uma vez.</span></button>
    <form data-form="rapidoTexto" class="rapido-texto"><div class="field"><label for="rtTxt">Ou escreva o gasto</label><input id="rtTxt" name="t" autocomplete="off" placeholder="Ex.: uber 23,50 · ifood 45,90 ontem · recebi 150 João"></div><button class="btn primary" type="submit">Lançar</button></form>
    <p class="small muted" style="margin:0">Contas já lançadas, contas fixas, parcelas e recebedores que você já usou são lançados na hora e ficam marcados <b>a conferir</b>. Se for algo novo, eu pergunto só o essencial.</p>
    <p class="err" id="formErr"></p>
    <footer><button type="button" class="btn ghost" data-act="novo" data-tipo="despesa">Lançamento manual completo</button><button type="button" class="btn" data-act="fechar">Fechar</button></footer>`,null);
}
function baseReconhecer(){ return {desp:S.desp, rec:S.rec, recor:recorD(), cats:S.cats}; }
function telaFila(msg){ $('#modal').hidden=false; modalSubmit=null; $('#sheet').innerHTML=`<div>${head('Lendo comprovantes')}</div><div class="fila-prog"><div class="spinner" aria-hidden="true"></div><p id="filaMsg">${msg}</p></div>`; }
async function processarRapido(files, textoR){
  const fila={itens:[], feitos:[]}; S.fila=fila;
  const lista = textoR ? [{texto:textoR}] : [...files].map(f=>({file:f}));
  for(let i=0;i<lista.length;i++){
    if(fila.parar) break;
    const it=lista[i]; let r=it.texto||null, hash=null;
    if(it.file){
      telaFila(`Lendo ${lista.length>1?`${i+1} de ${lista.length}`:'o comprovante'}…`);
      if(it.file.size>10*1024*1024){ fila.feitos.push({tipo:'erro',txt:`${it.file.name}: arquivo maior que 10 MB.`}); continue; }
      try{ hash=await LEITOR().hash(it.file); }catch(_){}
      const dup=hash && [...S.desp.map(x=>({...x,_t:'despesa'})),...S.rec.map(x=>({...x,_t:'receita'}))].find(x=>x.comprovanteHash===hash);
      if(dup){ fila.feitos.push({tipo:'dup',txt:`Já enviado antes: ${dup.descricao} (${money(dup.valor??dup.valorRecebido??dup.valorPrevisto)})`}); continue; }
      try{ r=await LEITOR().ler(it.file, p=>{ const m=$('#filaMsg'); if(m) m.textContent=`Lendo ${lista.length>1?`${i+1} de ${lista.length}`:'o comprovante'}… ${p}%`; }); }
      catch(e){ console.error(e); r={valor:null,data:null,nome:null,chave:null,entrada:false,texto:''}; }
      if(ehCupom(r.texto)){ fila.feitos.push({tipo:'cupom',txt:'Parece um cupom fiscal de mercado.',file:it.file}); continue; }
    }
    const dec = r.valor>0 ? RC().decidir(r, baseReconhecer(), hoje()) : {acao:'novo', tipo:r.entrada?'receita':'despesa', sugestao:RC().conhecido(r.nome||'')};
    try{
      if(dec.acao==='novo'){ const resp=await perguntarNovo(r, dec, it.file, hash, i, lista.length); if(resp) fila.feitos.push(resp); else fila.feitos.push({tipo:'pulado',txt:`Pulado: ${r.nome||'comprovante'}${r.valor?' · '+money(r.valor):''}`}); }
      else fila.feitos.push(await executarAuto(dec, r, it.file, hash));
    }catch(e){ console.error(e); fila.feitos.push({tipo:'erro',txt:`Não foi possível lançar ${r.nome||'o comprovante'}: ${erroAmigavel(e)}`}); }
  }
  mostrarResumoFila();
}
async function subir(file, hash){ if(!file) return {}; anexo={file,hash}; const a=await enviarArquivo(); anexo=null; return a||{}; }
const periodoDaData = d => (+String(d||'').slice(8,10)<=15?'10':'20');
async function executarAuto(dec, r, file, hash){
  const data=r.data||hoje(), arq=await subir(file,hash), nome=r.nome||'';
  if(dec.acao==='pagar'){ const x=dec.alvo, antes={situacao:x.situacao,valor:x.valor,dataPagamento:x.dataPagamento||'',comprovante:x.comprovante||null,comprovanteHash:x.comprovanteHash||null,conferido:true};
    await atualizar('despesas',x.id,{situacao:'paga',valor:r2(r.valor),dataPagamento:data,conferido:false,favorecido:x.favorecido||nome,chavePix:x.chavePix||r.chave||'',formaPagamento:x.formaPagamento||(r.pix?'Pix':''),...arq});
    const parc=(+x.parcelas||1)>1?` (parcela ${x.parcelaAtual} de ${x.parcelas})`:'';
    return {tipo:'ok',txt:`Pago: ${x.descricao}${parc} · ${money(r.valor)}`,motivo:dec.motivo,desfazer:{t:'despesas',id:x.id,patch:antes}}; }
  if(dec.acao==='recorrencia'){ const t=dec.modelo, ym=data.slice(0,7), [Y,M]=ym.split('-').map(Number), last=new Date(Y,M,0).getDate();
    const id=await inserir('despesas',{descricao:t.descricao,valor:r2(r.valor),categoria:t.categoria||'',subcategoria:t.subcategoria||'',formaPagamento:t.formaPagamento||(r.pix?'Pix':''),comportamento:'fixa',periodo:t.periodo||'',vencimento:ym+'-'+String(Math.min(+t.dia||10,last)).padStart(2,'0'),situacao:'paga',dataPagamento:data,parcelas:1,recorrenciaId:t.id,chavePix:t.chavePix||r.chave||'',favorecido:t.favorecido||nome,conferido:false,...arq});
    return {tipo:'ok',txt:`Conta fixa paga: ${t.descricao} · ${money(r.valor)}`,motivo:'conta fixa reconhecida',desfazer:{t:'despesas',id,apagar:true}}; }
  if(dec.acao==='receber'){ const x=dec.alvo, antes={situacao:x.situacao,valorRecebido:x.valorRecebido??null,dataEfetiva:x.dataEfetiva||'',comprovante:x.comprovante||null,comprovanteHash:x.comprovanteHash||null,conferido:true};
    await atualizar('receitas',x.id,{situacao:'recebida',valorRecebido:r2(r.valor),dataEfetiva:data,conferido:false,favorecido:x.favorecido||nome,...arq});
    return {tipo:'ok',txt:`Recebido: ${x.descricao} · ${money(r.valor)}`,motivo:'receita prevista',desfazer:{t:'receitas',id:x.id,patch:antes}}; }
  if(dec.acao==='historico' && dec.tipo==='receita'){ const b=dec.base;
    const id=await inserir('receitas',{descricao:b.descricao,origem:b.origem,valorPrevisto:r2(r.valor),valorRecebido:r2(r.valor),dataPrevista:data,dataEfetiva:data,situacao:'recebida',periodo:periodoDaData(data),favorecido:nome,conferido:false,...arq});
    return {tipo:'ok',txt:`Receita: ${b.descricao} · ${money(r.valor)}`,motivo:'pagador conhecido',desfazer:{t:'receitas',id,apagar:true}}; }
  const b=dec.base, desc=String(b.descricao).replace(/\s+[-–]\s+(janeiro|fevereiro|março|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro).*$/i,'');
  const id=await inserir('despesas',{descricao:desc,valor:r2(r.valor),categoria:b.categoria||'',subcategoria:b.subcategoria||'',formaPagamento:r.pix?'Pix':(b.formaPagamento||''),comportamento:'variavel',periodo:'',dataCompra:data,vencimento:data,dataPagamento:data,situacao:'paga',parcelas:1,chavePix:r.chave||b.chavePix||'',favorecido:nome||b.favorecido||'',conferido:false,...arq});
  return {tipo:'ok',txt:`${desc} · ${money(r.valor)} em ${catNome(b.categoria)}`,motivo:'recebedor conhecido',desfazer:{t:'despesas',id,apagar:true}};
}
function perguntarNovo(r, dec, file, hash, i, n){
  return new Promise(resolve=>{
    S.fila.resolver=resolve; S.fila.atual={r,dec,file,hash}; $('#modal').hidden=false; modalSubmit=null;
    const tipo=dec.tipo||'despesa', sug=dec.sugestao, cats=S.cats;
    const catSel = sug ? (cats.find(c=>c.nome===sug.categoriaNome)?.id||'') : '';
    $('#sheet').innerHTML=`<form data-form="rapidoNovo">${head(n>1?`Comprovante ${i+1} de ${n}: algo novo`:'Algo novo')}
      <p class="small muted" style="margin:0">${r.valor?`Li <b>${money(r.valor)}</b>${r.data?' em '+dataBR(r.data):''}${r.nome?' · '+esc(r.nome):''}. `:'Não consegui ler o valor; preencha abaixo. '}Confirme o que falta e eu guardo para reconhecer da próxima vez.</p>
      <input type="hidden" name="tipo" value="${tipo}"><input type="hidden" name="rep" value="unica">
      <div class="seg" id="segTipo"><button type="button" data-act="rnTipo" data-v="despesa" aria-pressed="${tipo==='despesa'}">Despesa</button><button type="button" data-act="rnTipo" data-v="receita" aria-pressed="${tipo==='receita'}">Receita</button></div>
      <div class="form-grid">
        <div class="field"><label for="rnV">Valor (R$)</label><input id="rnV" name="valor" inputmode="decimal" required value="${r.valor?fmtInput(r.valor):''}"></div>
        <div class="field"><label for="rnD">Data</label><input id="rnD" name="data" type="date" required value="${r.data||hoje()}"></div>
        <div class="field full"><label for="rnDesc">Descrição</label><input id="rnDesc" name="descricao" required maxlength="120" value="${esc(sug?.rotulo||r.nome||'')}" placeholder="Ex.: Uber, iFood, Farmácia"></div>
      </div>
      <div class="field" data-rn="despesa" ${tipo!=='despesa'?'hidden':''}><span class="lbl">Categoria</span><div class="chips" data-nome="categoria">${cats.map(c=>`<button type="button" class="chip" data-act="rnCat" data-v="${c.id}" aria-pressed="${c.id===catSel}">${esc(c.nome)}</button>`).join('')}</div></div>
      <div class="field" data-rn="receita" ${tipo!=='receita'?'hidden':''}><span class="lbl">Origem</span><div class="chips" data-nome="origem">${ORIGENS.map(o=>`<button type="button" class="chip" data-act="rnCat" data-v="${o}" aria-pressed="${o==='Outra'}">${o}</button>`).join('')}</div></div>
      <div class="field" data-rn="despesa" ${tipo!=='despesa'?'hidden':''}><span class="lbl">Como se repete</span><div class="seg" id="segRep"><button type="button" data-act="rnRep" data-v="unica" aria-pressed="true">Só desta vez</button><button type="button" data-act="rnRep" data-v="mensal" aria-pressed="false">Todo mês</button><button type="button" data-act="rnRep" data-v="parcelada" aria-pressed="false">Parcelada</button></div></div>
      <div class="form-grid" data-rn="parc" hidden>
        <div class="field"><label for="rnA">Esta é a parcela nº</label><input id="rnA" name="atual" type="number" min="1" max="120" inputmode="numeric" value="1"></div>
        <div class="field"><label for="rnN">De um total de</label><input id="rnN" name="total" type="number" min="2" max="120" inputmode="numeric" value="12"></div>
      </div>
      ${rodape('Lançar').replace('<button type="button" class="btn" data-act="fechar">Cancelar</button>','<button type="button" class="btn" data-act="rnPular">Pular este</button>')}</form>`;
  });
}
async function salvarNovoRapido(f){
  const E=f.elements, {r,file,hash}=S.fila.atual, tipo=E.tipo.value, valor=parseValor(E.valor.value), data=E.data.value, desc=E.descricao.value.trim();
  if(!(valor>0)) return 'Informe o valor.'; if(!data) return 'Informe a data.'; if(!desc) return 'Informe uma descrição curta.';
  const sel=g=>f.querySelector(`.chips[data-nome="${g}"] [aria-pressed="true"]`)?.dataset.v;
  const arq=await subir(file,hash), nome=r.nome||desc;
  if(tipo==='receita'){ const id=await inserir('receitas',{descricao:desc,origem:sel('origem')||'Outra',valorPrevisto:r2(valor),valorRecebido:r2(valor),dataPrevista:data,dataEfetiva:data,situacao:'recebida',periodo:periodoDaData(data),favorecido:nome,...arq});
    return {tipo:'ok',txt:`Receita: ${desc} · ${money(valor)}`,motivo:'nova',desfazer:{t:'receitas',id,apagar:true}}; }
  const cat=sel('categoria'); if(!cat) return 'Escolha a categoria.';
  const rep=E.rep.value, forma=r.pix?'Pix':'', base={descricao:desc,categoria:cat,subcategoria:'',formaPagamento:forma,favorecido:nome,chavePix:r.chave||'',periodo:''};
  if(rep==='parcelada'){ const A=parseInt(E.atual.value)||1, N=parseInt(E.total.value)||0; if(N<2||A<1||A>N) return `A parcela precisa estar entre 1 e ${N||'o total'}.`;
    const grupo='g'+uid(), rows=[]; for(let n=A;n<=N;n++){ const k=n-A; rows.push({...base,comportamento:'variavel',valor:r2(valor),valorTotal:r2(valor*N),parcelas:N,parcelaAtual:n,grupoParcela:grupo,vencimento:addMesData(data,k),dataCompra:k===0?data:'',situacao:k===0?'paga':'pendente',dataPagamento:k===0?data:'',...(k===0?arq:{})}); }
    const ids=chk(await sb.from('despesas').insert(rows.map(x=>({...toDb(x),espaco_id:S.esp}))).select('id')).map(x=>x.id); await recarregar('despesas');
    return {tipo:'ok',txt:`${desc}: parcela ${A} de ${N} paga, ${N-A} ${N-A===1?'parcela lançada':'parcelas lançadas'} nos próximos meses`,motivo:'nova',desfazer:{t:'despesas',ids,apagar:true}}; }
  let recorrenciaId='';
  if(rep==='mensal') recorrenciaId=await inserirRecorrencia({descricao:desc,valor:r2(valor),categoria:cat,formaPagamento:forma,periodo:'',dia:+data.slice(8,10),inicio:data.slice(0,7),geradoAte:data.slice(0,7),ativo:true,chavePix:r.chave||'',favorecido:nome});
  const id=await inserir('despesas',{...base,comportamento:rep==='mensal'?'fixa':'variavel',valor:r2(valor),vencimento:data,dataCompra:data,dataPagamento:data,situacao:'paga',parcelas:1,recorrenciaId,...arq});
  if(recorrenciaId) garantirRecorrentes();
  return {tipo:'ok',txt:`${desc} · ${money(valor)} em ${catNome(cat)}${rep==='mensal'?' (conta fixa mensal)':''}`,motivo:'nova',desfazer:{t:'despesas',id,apagar:true,recor:recorrenciaId||null}};
}
function mostrarResumoFila(){
  const f=S.fila; if(!f) return;
  const ic={ok:'✓',dup:'•',cupom:'•',pulado:'–',erro:'!'};
  $('#modal').hidden=false;
  $('#sheet').innerHTML=`<div>${head('Pronto')}</div>
    ${f.feitos.length?`<div class="resumo-fila">${f.feitos.map((x,i)=>`<div class="rf ${x.tipo}"><span class="rf-ic" aria-hidden="true">${ic[x.tipo]}</span><div><p>${esc(x.txt)}</p>${x.motivo&&x.motivo!=='nova'?`<span class="small muted">Reconhecido por: ${esc(x.motivo)} · fica marcado a conferir</span>`:''}</div>
      ${x.desfazer&&!x.desfeito?`<button class="btn sm ghost" data-act="rfDesfazer" data-i="${i}">Desfazer</button>`:''}${x.desfeito?'<span class="small muted">desfeito</span>':''}${x.tipo==='cupom'?`<button class="btn sm" data-act="rfCupom" data-i="${i}">Abrir como compra de mercado</button>`:''}</div>`).join('')}</div>`:'<p class="muted">Nada foi lançado.</p>'}
    <footer><button type="button" class="btn" data-act="rapidoMais">Enviar mais</button><button type="button" class="btn primary" data-act="fechar">Concluir</button></footer>`;
  modalSubmit=null;
}
const acoesRapido = {
  rapido: () => abrirRapido(),
  rapidoMais: () => abrirRapido(),
  enviarComprovante: () => { abrirRapido(); setTimeout(()=>$('#arqRapido')?.click(),50); },
  rapidoEscolher: () => { const i=$('#arqRapido'); if(i){ i.value=''; i.click(); } },
  rnTipo: el => { const f=el.closest('form'); f.elements.tipo.value=el.dataset.v; el.parentElement.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b===el)));
    f.querySelectorAll('[data-rn="despesa"]').forEach(x=>x.hidden=el.dataset.v!=='despesa'); f.querySelectorAll('[data-rn="receita"]').forEach(x=>x.hidden=el.dataset.v!=='receita'); f.querySelector('[data-rn="parc"]').hidden = el.dataset.v!=='despesa' || f.elements.rep.value!=='parcelada'; },
  rnCat: el => el.parentElement.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b===el))),
  rnRep: el => { const f=el.closest('form'); f.elements.rep.value=el.dataset.v; el.parentElement.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b===el))); f.querySelector('[data-rn="parc"]').hidden=el.dataset.v!=='parcelada'; },
  rnPular: () => { const r=S.fila?.resolver; if(r){ S.fila.resolver=null; r(null); } },
  rfDesfazer: async el => { const x=S.fila.feitos[+el.dataset.i], d=x.desfazer; el.disabled=true;
    try{ if(d.apagar){ const ids=d.ids||[d.id]; const rows=(d.t==='despesas'?S.desp:S.rec).filter(y=>ids.includes(y.id)); await remover(d.t,ids); apagarArquivos(rows.map(y=>y.comprovante)); if(d.recor){ const fut=S.desp.filter(y=>y.recorrenciaId===d.recor && y.situacao!=='paga').map(y=>y.id); if(fut.length) await remover('despesas',fut); await remover('recorrencias',d.recor); } }
      else { const atual=(d.t==='despesas'?S.desp:S.rec).find(y=>y.id===d.id); if(atual?.comprovante && atual.comprovante!==d.patch.comprovante) apagarArquivos([atual.comprovante]); await atualizar(d.t,d.id,d.patch); }
      x.desfeito=true; mostrarResumoFila(); toast('Lançamento desfeito.'); }catch(e){ dbErr(e); el.disabled=false; } },
  rfCupom: el => { const file=S.fila.feitos[+el.dataset.i].file; abrirCupom(); const dt=new DataTransfer(); dt.items.add(file); const inp=$('#arqCupom'); inp.files=dt.files; processarCupom(inp); },
  conferir: async el => { await atualizar(el.dataset.col, el.dataset.id, {conferido:true}); toast('Conferido.'); },
  conferirTodos: async () => { const d=S.desp.filter(x=>x.conferido===false).map(x=>x.id), r=S.rec.filter(x=>x.conferido===false).map(x=>x.id);
    if(d.length) chk(await sb.from('despesas').update({conferido:true}).in('id',d).eq('espaco_id',S.esp)); if(r.length) chk(await sb.from('receitas').update({conferido:true}).in('id',r).eq('espaco_id',S.esp));
    await recarregar('despesas'); await recarregar('receitas'); toast('Tudo conferido.'); }
};
function blocoConferir(){
  const d=S.desp.filter(x=>x.conferido===false), r=S.rec.filter(x=>x.conferido===false);
  if(!d.length && !r.length) return '';
  return `<section class="panel conferir"><div class="section-head"><h3 style="margin:0">A conferir (${d.length+r.length})</h3><p>Lançados automaticamente pelos comprovantes</p><div class="right"><button class="btn sm" data-act="conferirTodos">Confirmar todos</button></div></div>
    <div class="list">${[...d.map(x=>rowDesp(x)),...r.map(x=>rowRec(x))].join('')}</div></section>`;
}

Object.assign(acoes, acoesAl, acoesCd, acoesCupom, acoesRapido, acoesMetas, acoesContas);

/* ---------- eventos ---------- */
document.addEventListener('click', async e=>{
  const el=e.target.closest('[data-act]'); if(!el) return;
  const fn=acoes[el.dataset.act]; if(!fn) return;
  try{ await fn(el); }catch(err){ dbErr(err); }
});
$('#modal').addEventListener('mousedown',e=>{ if(e.target.id==='modal') fecharModal(); });
document.addEventListener('keydown',e=>{ if(e.key==='Escape'&&!$('#modal').hidden) fecharModal(); });
document.addEventListener('submit', async e=>{
  const f=e.target; e.preventDefault(); const tipo=f.dataset.form; const btn=f.querySelector('[type=submit]');
  if(['login','cadastro','esqueci','novaSenha'].includes(tipo)){
    const err=$('#authErr'); err.textContent=''; btn.disabled=true;
    try{
      if(tipo==='login'){ ls.set(LEMBRAR,f.elements.lembrar.checked?'1':'0'); chk(await sb.auth.signInWithPassword({email:f.elements.email.value.trim(),password:f.elements.senha.value})); }
      else if(tipo==='cadastro'){
        if(f.elements.senha.value.length<8) throw {message:'weak'}; if(f.elements.senha.value!==f.elements.senha2.value){ err.textContent='As duas senhas não são iguais.'; btn.disabled=false; return; }
        const d=chk(await sb.auth.signUp({email:f.elements.email.value.trim(),password:f.elements.senha.value,options:{data:{nome:f.elements.nome.value.trim()},emailRedirectTo:location.origin}}));
        if(!d.session){ S.auth='login'; S.authMsg=`Conta criada. Enviamos um link de confirmação para <b>${esc(f.elements.email.value.trim())}</b>. Abra o e-mail, confirme e depois entre aqui.`; render(); } }
      else if(tipo==='esqueci'){ chk(await sb.auth.resetPasswordForEmail(f.elements.email.value.trim(),{redirectTo:location.origin})); S.authMsg='Se houver uma conta com esse e-mail, você receberá um link para criar uma nova senha em alguns minutos.'; render(); }
      else if(tipo==='novaSenha'){ if(f.elements.senha.value.length<8) throw {message:'weak'}; if(f.elements.senha.value!==f.elements.senha2.value){ err.textContent='As duas senhas não são iguais.'; btn.disabled=false; return; }
        chk(await sb.auth.updateUser({password:f.elements.senha.value})); toast('Nova senha salva.'); const {data}=await sb.auth.getSession(); if(data.session) entrar(data.session); }
    }catch(x){ const el=$('#authErr'); if(el) el.textContent=erroAmigavel(x); }
    const b2=f.querySelector('[type=submit]'); if(b2) b2.disabled=false; return;
  }
  if(tipo==='quiz'){ lerPasso(f); const erro=validarPasso(S.quiz.passo,S.quiz.dados); if(erro){ $('#quizErr').textContent=erro; return; }
    if(S.quiz.passo<PASSOS.length-1){ S.quiz.passo++; S.quiz.max=Math.max(S.quiz.max,S.quiz.passo); render(); window.scrollTo(0,0); return; }
    btn.disabled=true; try{ await salvarPerfilAl(); render(); window.scrollTo(0,0); toast('Perfil salvo. Veja suas metas.'); }catch(x){ $('#quizErr').textContent=erroAmigavel(x); btn.disabled=false; } return; }
  if(tipo==='rapidoTexto'){ const r=RC().lerTexto(f.elements.t.value,hoje()), err=f.parentElement.querySelector('.err'); if(!r){ if(err) err.textContent='Escreva o gasto e o valor, por exemplo: uber 23,50'; return; } if(err) err.textContent=''; f.elements.t.value=''; processarRapido(null,r); return; }
  if(tipo==='rapidoNovo'){ btn.disabled=true; try{ const res=await salvarNovoRapido(f); if(typeof res==='string'){ $('#formErr').textContent=res; btn.disabled=false; return; } const rv=S.fila.resolver; S.fila.resolver=null; rv(res); }catch(x){ $('#formErr').textContent=erroAmigavel(x); btn.disabled=false; } return; }
  if(tipo==='cupom'){ btn.disabled=true; try{ const erro=await salvarCupom(f); if(erro){ $('#formErr').textContent=erro; btn.disabled=false; return; } fecharModal(); render(); }catch(x){ const el=$('#formErr'); if(el) el.textContent=erroAmigavel(x); btn.disabled=false; } return; }
  if(tipo==='saldo'){ const v=parseValor(f.elements.valor.value); if(isNaN(v)){ toast('Informe o saldo, por exemplo 1250,00.'); return; }
    try{ await salvarCfg({saldoInicial:r2(v),dataSaldo:f.elements.data.value}); toast('Saldo inicial salvo.'); }catch(x){ dbErr(x); } return; }
  if(!modalSubmit) return;
  btn.disabled=true;
  try{ const erro=await modalSubmit(f); if(erro){ $('#formErr').textContent=erro; btn.disabled=false; return; } if(!$('#modal').hidden && $('#sheet').contains(f)) fecharModal(); }
  catch(x){ const el=$('#formErr'); if(el) el.textContent=erroAmigavel(x); else dbErr(x); btn.disabled=false; }
});
document.addEventListener('change', async e=>{
  const t=e.target;
  if(t.id==='arqComp'){ processarAnexo(t); return; }
  if(t.id==='arqCupom'){ processarCupom(t); return; }
  if(t.id==='arqRapido'){ if(t.files?.length) processarRapido(t.files); return; }
  if(t.closest && t.closest('form[data-form="cupom"]') && /^[tv]\d+$|^(total|desconto)$/.test(t.name)){ lerCupomForm(t.form); renderCupom(); return; }
  if(t.dataset.chg==='cdSlot'){ try{ await mudarCombo(t); }catch(x){ dbErr(x); } return; }
  if(t.dataset.chg==='cdOpcao'){ const pl=structuredClone(planoMes()); pl.semana[+t.dataset.d][t.dataset.ref]=+t.value; try{ await salvarPlano(pl); }catch(x){ dbErr(x); } return; }
  if(t.dataset.lcpreco){ const v=t.value.trim()===''?null:parseValor(t.value); if(v!==null&&(isNaN(v)||v<0)){ toast('Preço inválido.'); return; } try{ await alterarItem(t.dataset.lcpreco,{preco:v===null?null:r2(v), ...(v>0?{ok:true}:{})}); if(v>0 && !S.alErro5) await precoManual(t.dataset.lcpreco, r2(v)); }catch(x){ dbErr(x); } return; }
  if(t.id==='espacoSel'){ fecharMenu(); try{ await abrirEspaco(t.value); }catch(x){ dbErr(x); } return; }
  if(t.dataset.chg==='fsit'){ S.filtro.sit=t.value; render(); }
  else if(t.dataset.chg==='fcat'){ S.filtro.cat=t.value; render(); }
  else if(t.dataset.orc){ const v=t.value.trim()===''?0:parseValor(t.value); if(isNaN(v)||v<0){ toast('Valor de orçamento inválido.'); return; }
    const lim={...orcamentoMes(S.mes)}; if(v) lim[t.dataset.orc]=r2(v); else delete lim[t.dataset.orc];
    try{ await salvarOrc(S.mes,lim); toast('Orçamento atualizado.'); }catch(x){ dbErr(x); } }
});
function fecharMenu(){ $('#side').classList.remove('open'); $('#scrim').hidden=true; }
$('#menuBtn').addEventListener('click',()=>{ $('#side').classList.add('open'); $('#scrim').hidden=false; });
$('#scrim').addEventListener('click',fecharMenu);
$('#sairBtn').addEventListener('click',()=>acoes.sair().catch(dbErr));
document.addEventListener('visibilitychange',()=>{ if(document.visibilityState==='visible' && S.fase==='pronto') Object.keys(TABELAS).forEach(recarregarDepois); });

/* ---------- início ---------- */
const vSalva=ls.get('meuEixo.view'); if(vSalva && NAV.some(n=>n.id===vSalva)) S.view=vSalva;
if(!configurado){ render(); return; }
let recuperando=false;
sb.auth.onAuthStateChange((evento,session)=>{
  if(evento==='PASSWORD_RECOVERY'){ recuperando=true; S.fase='auth'; S.auth='novaSenha'; render(); return; }
  if(recuperando && evento!=='SIGNED_OUT') return;
  if(evento==='SIGNED_OUT' || !session){ sairLocal(); return; }
  if(evento==='TOKEN_REFRESHED' || evento==='USER_UPDATED'){ S.user=session.user; return; }
  if(!S.user || S.user.id!==session.user.id) setTimeout(()=>entrar(session),0);
});
})();
