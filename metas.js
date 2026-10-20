/* =====================================================================
   MEU EIXO · cálculos de dívidas e plano de quitação
   - Saldo estimado: saldo informado corrigido pelos juros mensais até a
     data de hoje, menos cada pagamento registrado depois dele, também
     corrigido (juros compostos, mês de 30,44 dias).
   - Plano de quitação: simulação mês a mês. Parcelamentos do Financeiro
     seguem o calendário de parcelas (sem juros adicionais); as demais
     dívidas recebem o pagamento mínimo e o valor que sobrar do orçamento
     mensal vai para a dívida prioritária:
       · avalanche  → maior juros primeiro (paga menos juros no total)
       · bola de neve → menor saldo primeiro (quita mais rápido a 1ª)
     Quando uma dívida acaba, o valor dela passa para a próxima.
   São estimativas para decidir; o saldo oficial é o do credor.
   ===================================================================== */
(() => {
'use strict';
const MES_DIAS = 30.4375;
const r2 = v => Math.round((+v||0)*100)/100;
const dias = (a,b) => Math.round((Date.parse(b+'T12:00:00Z')-Date.parse(a+'T12:00:00Z'))/864e5);
function addMes(ym,n){ let [y,m]=ym.split('-').map(Number); m+=n; while(m>12){m-=12;y++} while(m<1){m+=12;y--} return y+'-'+String(m).padStart(2,'0'); }
const mesesEntre = (a,b) => { const [y1,m1]=a.split('-').map(Number), [y2,m2]=b.split('-').map(Number); return (y2-y1)*12+(m2-m1); };

/** Saldo devedor estimado de uma dívida cadastrada em uma data. */
function saldoEstimado(div, pagamentos, ate){
  if(div.quitada) return 0;
  const j=(+div.jurosMes||0)/100, base=div.dataSaldo;
  if(!base || ate<base) return r2(+div.saldo||0);
  const f = d => j ? Math.pow(1+j, dias(d,ate)/MES_DIAS) : 1;
  let s=(+div.saldo||0)*f(base);
  for(const p of pagamentos||[]) if(p.data>base && p.data<=ate) s-=(+p.valor||0)*f(p.data);
  return r2(Math.max(0,s));
}

/** Juros que a dívida gera por mês sobre um saldo. */
const jurosDoMes = (saldo, jurosMes) => r2((+saldo||0)*(+jurosMes||0)/100);

/**
 * Simulação mês a mês.
 * entrada = { inicio:'AAAA-MM', dividas:[{id,nome,saldo,jurosMes,minimo}],
 *             parcelamentos:[{id,nome,agenda:{'AAAA-MM':valor}}],
 *             orcamento: valor mensal total para dívidas (null = só mínimos),
 *             estrategia:'avalanche'|'bola' }
 */
function simular(e){
  const inicio=e.inicio, est=e.estrategia==='bola'?'bola':'avalanche', plano=e.orcamento!=null;
  const D=(e.dividas||[]).map(d=>({id:d.id,nome:d.nome,s:+d.saldo||0,j:(+d.jurosMes||0)/100,min:+d.minimo||0,fim:null,juros:0,pago:0,semQueda:0}));
  const P=(e.parcelamentos||[]).map(p=>{ const ms=Object.keys(p.agenda||{}).filter(m=>m>=inicio&&p.agenda[m]>0).sort(); return {id:p.id,nome:p.nome,agenda:p.agenda,fim:ms.length?ms[ms.length-1]:null}; });
  const ultimoParc = P.reduce((a,p)=>p.fim&&p.fim>a?p.fim:a, '');
  const serie=[], porMes=[]; let juros=0, deficit=null, m=inicio;
  for(let i=0;i<600;i++){
    const ativos=D.filter(d=>d.s>0.005), fixos=r2(P.reduce((a,p)=>a+(+p.agenda[m]||0),0));
    if(!ativos.length && (!ultimoParc || m>ultimoParc)) break;
    let jm=0;
    for(const d of ativos){ const x=d.s*d.j; d.s+=x; d.juros+=x; jm+=x; }
    juros+=jm;
    let pagoMin=0;
    for(const d of ativos){ const v=Math.min(d.min,d.s); d.s-=v; d.pago+=v; pagoMin+=v; }
    let extra=0;
    if(plano){
      extra=e.orcamento-fixos-pagoMin;
      if(extra< -0.005 && deficit===null) deficit={mes:m,falta:r2(-extra)};
      extra=Math.max(0,extra);
      const ordem=D.filter(d=>d.s>0.005).sort(est==='bola' ? (a,b)=>a.s-b.s||b.j-a.j : (a,b)=>b.j-a.j||a.s-b.s);
      for(const d of ordem){ if(extra<=0.005) break; const v=Math.min(extra,d.s); d.s-=v; d.pago+=v; extra-=v; }
    }
    for(const d of ativos){ if(d.s<=0.005){ d.s=0; if(!d.fim) d.fim=m; } }
    // sem plano: dívida que não diminui por 12 meses nunca será quitada só com o mínimo
    for(const d of D) if(d.s>0.005){ d.semQueda = (d.min<=d.s*d.j+0.005) ? d.semQueda+1 : 0; }
    const total=r2(D.reduce((a,d)=>a+d.s,0)+P.reduce((a,p)=>a+Object.entries(p.agenda).filter(([k,v])=>k>m).reduce((s,[,v])=>s+(+v||0),0),0));
    serie.push({mes:m,total}); porMes.push({mes:m,fixos,minimos:r2(pagoMin),extra:plano?r2(Math.max(0,e.orcamento-fixos-pagoMin)):0,juros:r2(jm)});
    if(!plano && D.some(d=>d.s>0.005) && D.every(d=>d.s<=0.005||d.semQueda>=12) && (!ultimoParc||m>=ultimoParc)) break;
    m=addMes(m,1);
  }
  const nunca=D.filter(d=>d.s>0.005).map(d=>d.id);
  const fimDiv=D.reduce((a,d)=>d.fim&&d.fim>a?d.fim:a,'');
  const fim = nunca.length ? null : ([fimDiv,ultimoParc].filter(Boolean).sort().pop()||null);
  return { fim, meses: fim ? mesesEntre(inicio,fim)+1 : null, juros:r2(juros), nunca, deficit,
    dividas:D.map(d=>({id:d.id,nome:d.nome,fim:d.fim,juros:r2(d.juros),pago:r2(d.pago)})),
    parcelamentos:P.map(p=>({id:p.id,nome:p.nome,fim:p.fim})), serie, porMes };
}

/** Pagamento mínimo do primeiro mês (parcelas do Financeiro + mínimos das dívidas). */
function minimoMensal(e){
  const fixos=(e.parcelamentos||[]).reduce((a,p)=>a+(+p.agenda?.[e.inicio]||0),0);
  return r2(fixos+(e.dividas||[]).reduce((a,d)=>a+Math.min(+d.minimo||0,(+d.saldo||0)*(1+(+d.jurosMes||0)/100)),0));
}

/** Menor valor mensal que quita tudo até o mês-limite (inclusive). null se impossível. */
function valorParaPrazo(e, prazo){
  if(!prazo || prazo<e.inicio) return null;
  const cabe = v => { const r=simular({...e,orcamento:v}); return r.fim && r.fim<=prazo && !r.deficit; };
  let lo=minimoMensal(e), hi=Math.max(lo,1);
  const totalDiv=(e.dividas||[]).reduce((a,d)=>a+(+d.saldo||0),0);
  const maxParc=Math.max(0,...(e.parcelamentos||[]).map(p=>Math.max(0,...Object.entries(p.agenda||{}).filter(([k])=>k>=e.inicio).map(([,v])=>+v||0))));
  hi=Math.max(hi, totalDiv*1.5+(e.parcelamentos||[]).reduce((a,p)=>a+Object.entries(p.agenda||{}).filter(([k])=>k>=e.inicio).reduce((s,[,v])=>s+(+v||0),0),0)+maxParc);
  if(!cabe(hi)) return null;
  if(cabe(lo)) return r2(lo);
  for(let i=0;i<50;i++){ const mid=(lo+hi)/2; if(cabe(mid)) hi=mid; else lo=mid; if(hi-lo<0.01) break; }
  return Math.ceil(hi*100)/100;
}

window.MeuEixoMetas = { saldoEstimado, jurosDoMes, simular, minimoMensal, valorParaPrazo, addMes, mesesEntre };
})();
