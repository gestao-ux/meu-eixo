/* =====================================================================
   MEU EIXO · reconhecimento de comprovantes
   Decide o que fazer com um comprovante lido:
   - pagar uma conta que já estava lançada (pendente, parcela, conta fixa);
   - lançar uma conta fixa do mês a partir do modelo;
   - repetir o padrão de um recebedor já conhecido (Uber, iFood…);
   - marcar como recebida uma receita prevista;
   - ou pedir as informações mínimas, quando for algo novo.
   ===================================================================== */
(() => {
'use strict';
const sem = s => String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toUpperCase();
const PARADAS = new Set(['LTDA','SA','S','A','ME','EPP','EIRELI','MEI','DO','DA','DE','DOS','DAS','E','EM','COM','PARA','PAGAMENTO','PAGAMENTOS','INSTITUICAO','IP','LIMITADA','CIA','COMERCIO','SERVICOS','TECNOLOGIA','BRASIL','DIGITAL','ONLINE']);
function normNome(s){ return sem(s).replace(/[^A-Z0-9 ]/g,' ').split(/\s+/).filter(t=>t && !PARADAS.has(t) && !/^\d+$/.test(t)).join(' '); }
function similar(a,b){
  a=normNome(a); b=normNome(b); if(!a||!b) return 0;
  if(a===b) return 1;
  const A=new Set(a.split(' ')), B=new Set(b.split(' '));
  const inter=[...A].filter(t=>B.has(t)), uni=new Set([...A,...B]);
  let j=inter.length/uni.size;
  const forte=inter.some(t=>t.length>=4);
  if(forte && (inter.length===A.size || inter.length===B.size)) j=Math.max(j,0.8);
  return j;
}
const normChave = s => String(s||'').toLowerCase().replace(/[\s.\-\/()]/g,'');
const dias = (a,b) => Math.round((Date.parse(b+'T12:00:00Z')-Date.parse(a+'T12:00:00Z'))/864e5);
const perto = (a,b,tol) => a!=null && b!=null && Math.abs(a-b) <= Math.max(tol*b, 0.05);

// recebedores conhecidos → categoria sugerida e nome amigável (só sugestão; a pessoa confirma)
const CONHECIDOS = [
  [/\bUBER\b/,'Transporte','Uber'], [/\b99 ?(POP|TECNOLOGIA|APP)?\b/,'Transporte','99'], [/CABIFY/,'Transporte','Cabify'], [/INDRIVE/,'Transporte','inDrive'],
  [/POSTO|SHELL|IPIRANGA|PETROBRAS|COMBUSTIV|AUTO ?POSTO/,'Transporte','Combustível'], [/ESTACIONAMENTO|ZONA AZUL|SEM PARAR|VELOE|CONECTCAR/,'Transporte','Estacionamento e pedágio'],
  [/IFOOD/,'Alimentação','iFood'], [/RAPPI/,'Alimentação','Rappi'], [/ZE DELIVERY/,'Alimentação','Zé Delivery'], [/AIQFOME/,'Alimentação','aiqfome'],
  [/MARMIT|QUENTINHA/,'Marmitas compradas','Marmita'],
  [/RESTAURANTE|LANCHONETE|PADARIA|PIZZARIA|BURGER|BURGUER|MC ?DONALD|SUBWAY|OUTBACK|CHURRASCARIA|SORVETERIA|CAFETERIA/,'Alimentação','Restaurante'],
  [/COMPER|BIG ?LAR|ATACADAO|ASSAI|SUPERMERCADO|MERCADO|CARREFOUR|FORT ATACAD|ATACADISTA|MODELO SUPER/,'Supermercado','Supermercado'],
  [/ENERGISA|ENERGIA/,'Água, energia e internet','Energia'], [/AGUAS CUIABA|SANEAMENTO|AGUA\b/,'Água, energia e internet','Água'],
  [/\bCLARO\b|\bVIVO\b|\bTIM\b|\bOI\b|INTERNET|FIBRA|TELECOM/,'Água, energia e internet','Internet e telefone'],
  [/NETFLIX|SPOTIFY|PRIME VIDEO|AMAZON PRIME|DISNEY|HBO|\bMAX\b|GLOBOPLAY|YOUTUBE|DEEZER|ICLOUD|APPLE\.COM|GOOGLE ONE|PARAMOUNT/,'Assinaturas','Assinatura'],
  [/FARMACIA|DROGASIL|DROGARIA|PAGUE MENOS|ULTRAFARMA|DROGA ?RAIA|PANVEL|HOSPITAL|CLINICA|LABORATORIO|UNIMED|ODONTO/,'Saúde','Saúde'],
  [/SALAO|BARBEARIA|BOTICARIO|NATURA|ESTETICA|MANICURE/,'Higiene e cuidados pessoais','Cuidados pessoais'],
  [/CINEMA|CINEMARK|INGRESSO|SYMPLA|EVENTIM/,'Lazer','Lazer'],
  [/ESCOLA|FACULDADE|UNIVERSIDADE|CURSO|UDEMY|ALURA|HOTMART/,'Educação','Educação'],
  [/ALUGUEL|IMOBILIARIA|CONDOMINIO/,'Moradia','Moradia']
];
function conhecido(nome){ const n=sem(nome); for(const [re,cat,rot] of CONHECIDOS) if(re.test(n)) return {categoriaNome:cat, rotulo:rot}; return null; }

/* r: {valor, data, nome, chave, entrada}; base: {desp, rec, recor, cats}; hoje: 'AAAA-MM-DD' */
function decidir(r, base, hoje){
  const data=r.data||hoje, v=r.valor, nome=r.nome||'', ch=normChave(r.chave);
  if(r.entrada){
    const prev=base.rec.filter(x=>x.situacao!=='recebida' && x.situacao!=='cancelada' && x.dataPrevista && Math.abs(dias(x.dataPrevista,data))<=12);
    const cand=prev.map(x=>({x, s:(perto(v,+x.valorPrevisto,0.03)?3:0)+(similar(nome,x.favorecido||x.descricao)>=0.5?2:0)})).filter(c=>c.s>=3).sort((a,b)=>b.s-a.s);
    if(cand.length && (cand[0].s>=5 || cand.filter(c=>c.s===cand[0].s).length===1)) return {acao:'receber', alvo:cand[0].x};
    const hist=base.rec.filter(x=>x.situacao==='recebida' && nome && similar(nome,x.favorecido||'')>=0.6).sort((a,b)=>String(b.dataEfetiva).localeCompare(String(a.dataEfetiva)))[0];
    if(hist) return {acao:'historico', tipo:'receita', base:hist};
    return {acao:'novo', tipo:'receita', sugestao:null};
  }
  // 1. conta já lançada e ainda não paga
  const pend=base.desp.filter(x=>x.situacao!=='paga' && x.situacao!=='cancelada' && x.vencimento && Math.abs(dias(x.vencimento,data))<=20);
  const pont=pend.map(x=>{ let s=0; const chOk = ch && ch.length>=5 && normChave(x.chavePix)===ch; const nmOk = nome && similar(nome, x.favorecido||x.descricao)>=0.5;
    if(chOk) s+=3; if(nmOk) s+=2; if(perto(v,+x.valor,0.01)) s+=3; else if(perto(v,+x.valor,0.10)) s+=1;
    s -= Math.min(2, Math.abs(dias(x.vencimento,data))/10); return {x,s,chOk,nmOk,exato:perto(v,+x.valor,0.01)}; }).sort((a,b)=>b.s-a.s);
  const top=pont[0];
  if(top){
    if((top.chOk||top.nmOk) && perto(v,+top.x.valor,0.10)) return {acao:'pagar', alvo:top.x, motivo: top.chOk?'mesma chave Pix':'mesmo recebedor'};
    const exatos=pont.filter(p=>p.exato && Math.abs(dias(p.x.vencimento,data))<=10);
    if(exatos.length===1) return {acao:'pagar', alvo:exatos[0].x, motivo:'mesmo valor e vencimento próximo'};
  }
  // 2. conta fixa do mês ainda não lançada
  const ym=data.slice(0,7);
  const fixa=base.recor.filter(t=>t.ativo!==false && ((ch && ch.length>=5 && normChave(t.chavePix)===ch) || (nome && similar(nome,t.favorecido||t.descricao)>=0.6)) && perto(v,+t.valor,0.15))[0];
  if(fixa && !base.desp.some(x=>x.recorrenciaId===fixa.id && (x.vencimento||'').slice(0,7)===ym)) return {acao:'recorrencia', modelo:fixa};
  // 3. recebedor que já apareceu antes
  const hist=base.desp.filter(x=>x.situacao==='paga' && ((ch && ch.length>=5 && normChave(x.chavePix)===ch) || (nome && similar(nome,x.favorecido||'')>=0.6)))
    .sort((a,b)=>String(b.dataPagamento||b.vencimento).localeCompare(String(a.dataPagamento||a.vencimento)))[0];
  if(hist) return {acao:'historico', tipo:'despesa', base:hist};
  // 4. novo: sugere categoria quando o recebedor é conhecido
  return {acao:'novo', tipo:'despesa', sugestao: conhecido(nome)};
}

// "uber 23,50", "ifood 45,90 ontem", "farmácia 32 12/10"
function lerTexto(txt, hoje){
  let t=String(txt||'').trim(); if(!t) return null;
  let data=hoje;
  if(/\bontem\b/i.test(t)){ const d=new Date(hoje+'T12:00:00Z'); d.setUTCDate(d.getUTCDate()-1); data=d.toISOString().slice(0,10); t=t.replace(/\bontem\b/i,''); }
  const dm=t.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/); if(dm){ let y=dm[3]?(+dm[3]<100?2000+ +dm[3]:+dm[3]):+hoje.slice(0,4); data=`${y}-${String(dm[2]).padStart(2,'0')}-${String(dm[1]).padStart(2,'0')}`; t=t.replace(dm[0],''); }
  const vm=[...t.matchAll(/(?:R\$\s*)?(\d{1,3}(?:\.\d{3})*(?:,\d{1,2})|\d+(?:[.,]\d{1,2})?)/g)].pop();
  if(!vm) return null;
  let s=vm[1]; s = s.includes(',') ? s.replace(/\./g,'').replace(',','.') : s; const valor=Number(s);
  const desc=(t.slice(0,vm.index)+' '+t.slice(vm.index+vm[0].length)).replace(/\s{2,}/g,' ').replace(/^[\s\-–:]+|[\s\-–:]+$/g,'').trim();
  if(!(valor>0) || !desc) return null;
  const entrada=/^(recebi|receb|entrada|\+)/i.test(desc);
  return {valor:Math.round(valor*100)/100, data, nome:desc.replace(/^(recebi|recebido|entrada)\s+(um\s+)?(pix\s+)?(de\s+)?/i,''), chave:null, entrada, pix:false};
}

window.MeuEixoReconhecer = { normNome, similar, conhecido, decidir, lerTexto };
})();
