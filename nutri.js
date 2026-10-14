/* =====================================================================
   MEU EIXO · cálculos do perfil alimentar
   Referências usadas:
   - IMC e faixas: Organização Mundial da Saúde (adultos) e, para 60 anos
     ou mais, faixas de Lipschitz (1994), usadas pelo Ministério da Saúde.
   - Gasto em repouso: equação de Mifflin-St Jeor (1990).
   - Fatores de atividade: FAO/OMS.
   - Água: cerca de 35 ml por kg de peso por dia.
   - Proteína: 1,0 a 1,6 g/kg conforme objetivo e atividade.
   - Prato da marmita: metade vegetais, um quarto proteína, um quarto
     carboidrato (modelo do prato saudável, Guia Alimentar brasileiro).
   Estes números são estimativas para organizar a alimentação. Não
   substituem a avaliação de nutricionista ou médico.
   ===================================================================== */
(() => {
'use strict';
const r0 = v => Math.round(v);
const r1 = v => Math.round(v*10)/10;

const ATIVIDADE = {
  sedentario:   {f:1.2,   t:'Sedentária',      d:'Trabalho sentado e pouca caminhada no dia.'},
  leve:         {f:1.375, t:'Levemente ativa', d:'Caminha no dia a dia ou treina 1 a 2 vezes por semana.'},
  moderado:     {f:1.55,  t:'Moderadamente ativa', d:'Treina 3 a 5 vezes por semana ou trabalha em pé, andando.'},
  intenso:      {f:1.725, t:'Muito ativa',     d:'Treina forte 6 a 7 vezes por semana.'},
  muito_intenso:{f:1.9,   t:'Extremamente ativa', d:'Treino forte diário e trabalho físico pesado.'}
};
const OBJETIVOS = {
  emagrecer:  {t:'Emagrecer com saúde'},
  manter:     {t:'Manter o peso e comer melhor'},
  ganhar:     {t:'Ganhar massa muscular'},
  energia:    {t:'Ter mais energia e disposição'},
  economizar: {t:'Comer bem gastando menos'}
};
// Condições em que o plano não aplica corte de calorias e recomenda acompanhamento.
const CONDICOES_SENSIVEIS = ['gestante','amamentando','diabetes','renal','tireoide','gastrite','intestino','anemia','hipertensao','colesterol','pre_diabetes'];

function idade(nasc, hoje){
  if(!nasc) return null;
  const [y,m,d]=nasc.split('-').map(Number), [Y,M,D]=hoje.split('-').map(Number);
  let a=Y-y; if(M<m || (M===m && D<d)) a--; return a;
}

function imcFaixa(imc, anos){
  if(anos!==null && anos>=60){
    if(imc<22) return {k:'baixo', t:'Abaixo do peso'};
    if(imc<=27) return {k:'adequado', t:'Peso adequado'};
    return {k:'acima', t:'Acima do peso'};
  }
  if(imc<18.5) return {k:'baixo', t:'Abaixo do peso'};
  if(imc<25)   return {k:'adequado', t:'Peso adequado'};
  if(imc<30)   return {k:'acima', t:'Sobrepeso'};
  if(imc<35)   return {k:'obes1', t:'Obesidade grau I'};
  if(imc<40)   return {k:'obes2', t:'Obesidade grau II'};
  return {k:'obes3', t:'Obesidade grau III'};
}

function cinturaRisco(cm, sexo){
  if(!cm) return null;
  if(sexo==='feminino') return cm>=88 ? {k:'alto',t:'Risco aumentado (88 cm ou mais)'} : cm>=80 ? {k:'medio',t:'Atenção (80 a 87 cm)'} : {k:'ok',t:'Dentro da referência (abaixo de 80 cm)'};
  return cm>=102 ? {k:'alto',t:'Risco aumentado (102 cm ou mais)'} : cm>=94 ? {k:'medio',t:'Atenção (94 a 101 cm)'} : {k:'ok',t:'Dentro da referência (abaixo de 94 cm)'};
}

const REFEICOES = {
  cafe:{t:'Café da manhã',p:.22}, lanche_manha:{t:'Lanche da manhã',p:.08}, almoco:{t:'Almoço',p:.32},
  lanche_tarde:{t:'Lanche da tarde',p:.12}, jantar:{t:'Jantar',p:.22}, ceia:{t:'Ceia',p:.04}
};

function calcular(p, hoje){
  const peso=+p.peso, alt=+p.altura, anos=idade(p.nascimento, hoje), sexo=p.sexo;
  if(!(peso>0) || !(alt>0) || anos===null) return null;
  const m=alt/100, imc=peso/(m*m), faixa=imcFaixa(imc, anos);
  const refMin = (anos>=60?22:18.5)*m*m, refMax = (anos>=60?27:24.9)*m*m;
  const tmb = 10*peso + 6.25*alt - 5*anos + (sexo==='masculino'?5:-161);
  const at = ATIVIDADE[p.atividade]||ATIVIDADE.sedentario;
  const get = tmb*at.f;
  const cond = (p.condicoes||[]).filter(c=>c!=='nenhuma');
  const sensivel = cond.some(c=>CONDICOES_SENSIVEIS.includes(c));
  const avisos=[];
  let ajuste=0, motivo='';
  if(anos<18){ motivo='menor'; avisos.push('Para menores de 18 anos, o plano deve ser feito com acompanhamento profissional. As metas abaixo usam apenas a manutenção.'); }
  else if(cond.includes('gestante')||cond.includes('amamentando')){ motivo='gestacao'; avisos.push('Na gestação e na amamentação, a necessidade de energia aumenta e deve ser definida pelo seu pré-natal ou nutricionista. O plano não aplica nenhum corte.'); }
  else if(p.objetivo==='emagrecer'){
    if(faixa.k==='baixo' || peso < (refMin+refMax)/2){ motivo='imc_baixo'; avisos.push('Seu peso já está na metade inferior da faixa de referência para a sua altura. O plano vai focar em qualidade e regularidade das refeições, sem reduzir calorias.'); }
    else { ajuste = p.ritmo==='moderado' ? -0.20 : -0.15; if(anos>=60){ ajuste=-0.10; avisos.push('A partir dos 60 anos, o plano usa uma redução mais leve, para preservar a massa muscular.'); } }
  } else if(p.objetivo==='ganhar') ajuste = 0.10;
  if(sensivel && ajuste<0){ ajuste=Math.max(ajuste,-0.10); }
  if(sensivel) avisos.push('Você informou condições de saúde que influenciam a alimentação. Use este plano como organização do dia a dia e confirme as metas com seu médico ou nutricionista.');
  const piso = Math.max(tmb, sexo==='masculino'?1500:1200);
  let meta = get*(1+ajuste);
  if(meta<piso){ meta=piso; if(ajuste<0) avisos.push('A meta foi limitada para não ficar abaixo do mínimo seguro para o seu corpo.'); }
  meta = Math.round(meta/50)*50;
  // proteína: em IMC 30 ou mais, calcula sobre o limite superior do peso de referência
  const pesoBase = imc>=30 ? refMax : peso;
  const gkg = p.objetivo==='ganhar' ? 1.6 : p.objetivo==='emagrecer' ? 1.4 : (['moderado','intenso','muito_intenso'].includes(p.atividade)?1.3:1.1);
  const prot = cond.includes('renal') ? null : r0(pesoBase*gkg);
  if(cond.includes('renal')) avisos.push('Com doença renal, a quantidade de proteína precisa ser definida por profissional. O plano não sugere uma meta de proteína.');
  const agua = r1(Math.min(3.5, Math.max(1.5, peso*0.035)));
  const gord = r0(meta*0.28/9);
  const carb = prot===null ? null : r0((meta - prot*4 - gord*9)/4);
  const fibra = sexo==='masculino' ? 30 : 25;
  const refs = (p.refeicoes&&p.refeicoes.length ? p.refeicoes : ['cafe','almoco','lanche_tarde','jantar']);
  const soma = refs.reduce((a,k)=>a+(REFEICOES[k]?.p||0),0) || 1;
  const porRefeicao = refs.map(k=>({k, t:REFEICOES[k]?.t||k, kcal: Math.round(meta*(REFEICOES[k]?.p||0)/soma/10)*10}));
  const marmitaKcal = (porRefeicao.find(x=>x.k==='almoco')||{}).kcal || null;
  return {
    anos, imc:r1(imc), faixa, pesoRef:[r1(refMin), r1(refMax)], cintura:cinturaRisco(+p.cintura, sexo),
    tmb:r0(tmb), get:r0(get), atividade:at, ajuste, motivo, meta, prot, gkg, gord, carb, fibra, agua,
    porRefeicao, marmitaKcal,
    marmita: marmitaKcal ? { proteinaG: r0(Math.min(150, Math.max(80, (prot||70)*0.35/0.30))), carboG: r0(Math.max(80, marmitaKcal*0.30/1.3)), vegetaisG: 150, feijaoG: 90 } : null,
    avisos
  };
}

window.MeuEixoNutri = { calcular, idade, imcFaixa, ATIVIDADE, OBJETIVOS, REFEICOES };
})();
