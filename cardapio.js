/* =====================================================================
   MEU EIXO · catálogo de alimentos, cardápio e lista de compras
   Valores nutricionais por 100 g do alimento pronto para consumo,
   aproximados da Tabela Brasileira de Composição de Alimentos (TACO,
   NEPA/Unicamp, 4ª ed.). Itens marcados com fonte "USDA" vêm da base
   FoodData Central (EUA), por não constarem cozidos na TACO.
   Rendimento (fator): gramas do alimento pronto por grama comprada
   (ex.: 1 kg de arroz cru rende cerca de 2,7 kg cozido).
   ===================================================================== */
(() => {
'use strict';
// g: grupo · k,p,c,l: kcal, proteína, carboidrato, gordura por 100 g · u: gramas por unidade de consumo
// cp: compra {n: nome no mercado, und: 'kg'|'un'|'pct'|'L', emb: gramas por embalagem, f: rendimento, uc: gramas por unidade comprada}
// dur: 'semanal' (perecível) | 'mensal' | 'congela' (proteína que pode ir ao freezer)
const C = {
  frango_peito:{n:'Frango grelhado (peito)',chip:'Frango (peito)',g:'proteina',k:159,p:32,c:0,l:2.5,cp:{n:'Peito de frango sem osso',und:'kg',f:0.70},dur:'congela'},
  frango_coxa:{n:'Frango assado (coxa e sobrecoxa)',chip:'Frango (coxa e sobrecoxa)',g:'proteina',k:215,p:28,c:0,l:11,cp:{n:'Coxa e sobrecoxa de frango',und:'kg',f:0.55},dur:'congela'},
  ovo:{n:'Ovo',chip:'Ovo',g:'proteina',k:146,p:13.3,c:0.6,l:9.5,u:50,un:['ovo','ovos'],cp:{n:'Ovos',und:'un',uc:50,f:1},dur:'semanal'},
  carne_moida:{n:'Carne moída refogada',chip:'Carne moída',g:'proteina',k:212,p:26.7,c:0,l:10.9,cp:{n:'Carne moída (acém ou patinho)',und:'kg',f:0.70},dur:'congela'},
  patinho:{n:'Carne em cubos ou bife (patinho)',chip:'Patinho / acém',g:'proteina',k:219,p:35.9,c:0,l:7.3,cp:{n:'Patinho ou acém',und:'kg',f:0.65},dur:'congela'},
  peixe:{n:'Peixe assado (filé)',chip:'Peixe (tilápia, merluza)',g:'proteina',k:122,p:26.6,c:0,l:0.9,cp:{n:'Filé de tilápia ou merluza',und:'kg',f:0.75},dur:'congela'},
  sardinha:{n:'Sardinha em lata',chip:'Sardinha em lata',g:'proteina',k:285,p:15.9,c:0,l:24,u:84,un:['lata','latas'],cp:{n:'Sardinha em lata (125 g)',und:'un',uc:84,f:1},dur:'mensal'},
  atum:{n:'Atum em lata',chip:'Atum em lata',g:'proteina',k:166,p:26.2,c:0,l:6,u:120,un:['lata','latas'],cp:{n:'Atum em lata (170 g)',und:'un',uc:120,f:1},dur:'mensal'},
  porco:{n:'Lombo de porco assado',chip:'Carne de porco',g:'proteina',k:210,p:35.7,c:0,l:6.4,cp:{n:'Lombo de porco',und:'kg',f:0.65},dur:'congela'},
  figado:{n:'Fígado acebolado',chip:'Fígado',g:'proteina',k:225,p:29.9,c:4.2,l:9,cp:{n:'Fígado bovino',und:'kg',f:0.70},dur:'congela'},
  linguica:{n:'Linguiça assada',chip:'Linguiça',g:'proteina',k:296,p:23.2,c:0,l:21.9,cp:{n:'Linguiça',und:'kg',f:0.80},dur:'congela'},
  queijo_branco:{n:'Queijo minas frescal',chip:'Queijo branco / ricota',g:'laticinio',k:264,p:17.4,c:3.2,l:20.2,cp:{n:'Queijo minas frescal',und:'kg',f:1},dur:'semanal',lac:1},
  arroz_branco:{n:'Arroz branco',chip:'Arroz branco',g:'carbo',k:128,p:2.5,c:28.1,l:0.2,cp:{n:'Arroz branco',und:'pct',emb:1000,f:2.7},dur:'mensal',colher:25},
  arroz_integral:{n:'Arroz integral',chip:'Arroz integral',g:'carbo',k:124,p:2.6,c:25.8,l:1,cp:{n:'Arroz integral',und:'pct',emb:1000,f:2.6},dur:'mensal',colher:25},
  macarrao:{n:'Macarrão',chip:'Macarrão',g:'carbo',k:158,p:5.8,c:30.9,l:0.9,fonte:'USDA',cp:{n:'Macarrão',und:'pct',emb:500,f:2.3},dur:'mensal',glu:1},
  batata:{n:'Batata cozida',chip:'Batata',g:'carbo',k:52,p:1.2,c:11.9,l:0,cp:{n:'Batata',und:'kg',f:0.85},dur:'semanal'},
  batata_doce:{n:'Batata-doce cozida',chip:'Batata-doce',g:'carbo',k:77,p:0.6,c:18.4,l:0.1,cp:{n:'Batata-doce',und:'kg',f:0.85},dur:'semanal'},
  mandioca:{n:'Mandioca cozida',chip:'Mandioca',g:'carbo',k:125,p:0.6,c:30.1,l:0.3,cp:{n:'Mandioca',und:'kg',f:0.75},dur:'semanal'},
  inhame:{n:'Inhame cozido',chip:'Inhame',g:'carbo',k:116,p:1.5,c:27.5,l:0.1,fonte:'USDA',cp:{n:'Inhame',und:'kg',f:0.85},dur:'semanal'},
  cuscuz:{n:'Cuscuz de milho',chip:'Cuscuz de milho',g:'carbo',k:113,p:2.2,c:25.3,l:0.7,cp:{n:'Flocão de milho',und:'pct',emb:500,f:2},dur:'mensal'},
  pao_frances:{n:'Pão francês',chip:'Pão francês',g:'paes',k:300,p:8,c:58.6,l:3.1,u:50,un:['pão','pães'],cp:{n:'Pão francês',und:'un',uc:50,f:1},dur:'semanal',glu:1},
  pao_integral:{n:'Pão de forma integral',chip:'Pão integral',g:'paes',k:253,p:9.4,c:49.9,l:3.7,u:25,un:['fatia','fatias'],cp:{n:'Pão de forma integral (450 g)',und:'pct',emb:450,f:1},dur:'semanal',glu:1},
  aveia:{n:'Aveia em flocos',chip:'Aveia',g:'paes',k:394,p:13.9,c:66.6,l:8.5,cp:{n:'Aveia em flocos',und:'pct',emb:500,f:1},dur:'mensal',glu:1},
  tapioca:{n:'Tapioca',chip:'Tapioca',g:'paes',k:240,p:0,c:59,l:0,cp:{n:'Goma de tapioca',und:'pct',emb:500,f:1},dur:'mensal'},
  feijao_carioca:{n:'Feijão carioca',chip:'Feijão carioca',g:'leguminosa',k:76,p:4.8,c:13.6,l:0.5,cp:{n:'Feijão carioca',und:'pct',emb:1000,f:2.4},dur:'mensal'},
  feijao_preto:{n:'Feijão preto',chip:'Feijão preto',g:'leguminosa',k:77,p:4.5,c:14,l:0.5,cp:{n:'Feijão preto',und:'pct',emb:1000,f:2.4},dur:'mensal'},
  lentilha:{n:'Lentilha',chip:'Lentilha',g:'leguminosa',k:93,p:6.3,c:16.3,l:0.5,cp:{n:'Lentilha',und:'pct',emb:500,f:2.4},dur:'mensal'},
  grao_de_bico:{n:'Grão-de-bico',chip:'Grão-de-bico',g:'leguminosa',k:164,p:8.9,c:27.4,l:2.6,fonte:'USDA',cp:{n:'Grão-de-bico',und:'pct',emb:500,f:2.2},dur:'mensal'},
  ervilha:{n:'Ervilha',chip:'Ervilha',g:'leguminosa',k:74,p:4.6,c:13.4,l:0.4,cp:{n:'Ervilha em lata (200 g drenados)',und:'pct',emb:200,f:1},dur:'mensal'},
  cenoura:{n:'Cenoura',chip:'Cenoura',g:'legume',k:30,p:0.8,c:6.7,l:0.2,cp:{n:'Cenoura',und:'kg',f:0.9},dur:'semanal'},
  abobrinha:{n:'Abobrinha',chip:'Abobrinha',g:'legume',k:15,p:1.1,c:3,l:0.2,cp:{n:'Abobrinha',und:'kg',f:0.9},dur:'semanal'},
  abobora:{n:'Abóbora',chip:'Abóbora',g:'legume',k:48,p:1.4,c:10.8,l:0.7,cp:{n:'Abóbora cabotiá',und:'kg',f:0.8},dur:'semanal'},
  chuchu:{n:'Chuchu',chip:'Chuchu',g:'legume',k:19,p:0.4,c:4.8,l:0,cp:{n:'Chuchu',und:'kg',f:0.85},dur:'semanal'},
  beterraba:{n:'Beterraba',chip:'Beterraba',g:'legume',k:32,p:1.3,c:7.2,l:0.1,cp:{n:'Beterraba',und:'kg',f:0.85},dur:'semanal'},
  vagem:{n:'Vagem',chip:'Vagem',g:'legume',k:25,p:1.2,c:5.3,l:0.3,cp:{n:'Vagem',und:'kg',f:0.9},dur:'semanal'},
  brocolis:{n:'Brócolis',chip:'Brócolis',g:'legume',k:25,p:2.1,c:4.4,l:0.5,cp:{n:'Brócolis',und:'kg',f:0.7},dur:'semanal'},
  couve_flor:{n:'Couve-flor',chip:'Couve-flor',g:'legume',k:19,p:1.2,c:3.9,l:0.3,cp:{n:'Couve-flor',und:'kg',f:0.6},dur:'semanal'},
  berinjela:{n:'Berinjela',chip:'Berinjela',g:'legume',k:19,p:0.7,c:4.5,l:0.1,cp:{n:'Berinjela',und:'kg',f:0.9},dur:'semanal'},
  quiabo:{n:'Quiabo',chip:'Quiabo',g:'legume',k:22,p:1.9,c:4.5,l:0.2,cp:{n:'Quiabo',und:'kg',f:0.85},dur:'semanal'},
  milho:{n:'Milho verde',chip:'Milho',g:'legume',k:98,p:3.2,c:17.1,l:2.4,cp:{n:'Milho verde em lata (170 g drenados)',und:'pct',emb:170,f:1},dur:'mensal'},
  alface:{n:'Alface',chip:'Alface',g:'salada',k:11,p:1.3,c:1.7,l:0.2,cp:{n:'Alface (pé)',und:'un',uc:300,f:0.7},dur:'semanal'},
  tomate:{n:'Tomate',chip:'Tomate',g:'salada',k:15,p:1.1,c:3.1,l:0.2,cp:{n:'Tomate',und:'kg',f:0.95},dur:'semanal'},
  pepino:{n:'Pepino',chip:'Pepino',g:'salada',k:10,p:0.9,c:2,l:0,cp:{n:'Pepino',und:'kg',f:0.9},dur:'semanal'},
  repolho:{n:'Repolho',chip:'Repolho',g:'salada',k:17,p:0.9,c:3.9,l:0.1,cp:{n:'Repolho',und:'kg',f:0.85},dur:'semanal'},
  couve:{n:'Couve',chip:'Couve',g:'salada',k:27,p:2.9,c:4.3,l:0.5,cp:{n:'Couve (maço)',und:'un',uc:200,f:0.8},dur:'semanal'},
  rucula:{n:'Rúcula',chip:'Rúcula',g:'salada',k:13,p:1.8,c:2.2,l:0.1,cp:{n:'Rúcula (maço)',und:'un',uc:150,f:0.7},dur:'semanal'},
  banana:{n:'Banana',chip:'Banana',g:'fruta',k:98,p:1.3,c:26,l:0.1,u:70,un:['banana','bananas'],cp:{n:'Banana',und:'un',uc:70,f:1,kgUn:0.11},dur:'semanal'},
  maca:{n:'Maçã',chip:'Maçã',g:'fruta',k:56,p:0.3,c:15.2,l:0,u:130,un:['maçã','maçãs'],cp:{n:'Maçã',und:'un',uc:130,f:1,kgUn:0.15},dur:'semanal'},
  laranja:{n:'Laranja',chip:'Laranja',g:'fruta',k:37,p:1,c:8.9,l:0.1,u:140,un:['laranja','laranjas'],cp:{n:'Laranja',und:'un',uc:140,f:1,kgUn:0.2},dur:'semanal'},
  mamao:{n:'Mamão',chip:'Mamão',g:'fruta',k:40,p:0.5,c:10.4,l:0.1,u:150,un:['fatia','fatias'],cp:{n:'Mamão papaia',und:'un',uc:300,f:1,kgUn:0.45},dur:'semanal'},
  melancia:{n:'Melancia',chip:'Melancia',g:'fruta',k:33,p:0.9,c:8.1,l:0,u:200,un:['fatia','fatias'],cp:{n:'Melancia (pedaço)',und:'kg',f:0.6},dur:'semanal'},
  manga:{n:'Manga',chip:'Manga',g:'fruta',k:72,p:0.4,c:19.4,l:0.2,u:150,un:['manga','mangas'],cp:{n:'Manga',und:'un',uc:250,f:1,kgUn:0.4},dur:'semanal'},
  abacaxi:{n:'Abacaxi',chip:'Abacaxi',g:'fruta',k:48,p:0.9,c:12.3,l:0.1,u:150,un:['fatia','fatias'],cp:{n:'Abacaxi',und:'un',uc:900,f:1,kgUn:1.4},dur:'semanal'},
  goiaba:{n:'Goiaba',chip:'Goiaba',g:'fruta',k:54,p:1.1,c:13,l:0.4,u:150,un:['goiaba','goiabas'],cp:{n:'Goiaba',und:'un',uc:150,f:1,kgUn:0.17},dur:'semanal'},
  uva:{n:'Uva',chip:'Uva',g:'fruta',k:53,p:0.7,c:13.6,l:0.2,u:120,un:['porção','porções'],cp:{n:'Uva',und:'kg',f:0.95},dur:'semanal'},
  abacate:{n:'Abacate',chip:'Abacate',g:'fruta',k:96,p:1.2,c:6,l:8.4,u:100,un:['porção','porções'],cp:{n:'Abacate',und:'un',uc:400,f:1,kgUn:0.6},dur:'semanal'},
  leite:{n:'Leite',chip:'Leite',g:'laticinio',k:61,p:3.2,c:4.6,l:3.3,cp:{n:'Leite integral (1 L)',und:'pct',emb:1000,f:1},dur:'mensal',lac:1},
  iogurte:{n:'Iogurte natural',chip:'Iogurte natural',g:'laticinio',k:51,p:4.1,c:1.9,l:3,u:170,un:['pote','potes'],cp:{n:'Iogurte natural (170 g)',und:'un',uc:170,f:1},dur:'semanal',lac:1},
  mussarela:{n:'Queijo muçarela',chip:'Queijo muçarela',g:'laticinio',k:330,p:22.6,c:3,l:25.2,u:20,un:['fatia','fatias'],cp:{n:'Queijo muçarela fatiado',und:'kg',f:1},dur:'semanal',lac:1},
  requeijao:{n:'Requeijão',chip:'Requeijão',g:'laticinio',k:257,p:9.6,c:2.4,l:23.4,cp:{n:'Requeijão (200 g)',und:'pct',emb:200,f:1},dur:'semanal',lac:1},
  azeite:{n:'Azeite ou óleo (preparo)',g:'gordura',k:884,p:0,c:0,l:100,cp:{n:'Azeite ou óleo (500 ml)',und:'pct',emb:460,f:1},dur:'mensal'}
};
const DEFAULT = {proteina:['frango_peito','carne_moida','ovo','frango_coxa'],carbo:['arroz_branco','macarrao','batata'],paes:['pao_frances','tapioca','aveia'],leguminosa:['feijao_carioca'],legume:['cenoura','abobrinha','brocolis','abobora','vagem'],salada:['alface','tomate'],fruta:['banana','maca','mamao','laranja'],laticinio:['iogurte','leite']};
const PRINCIPAIS = ['frango_peito','frango_coxa','carne_moida','patinho','peixe','porco','ovo','figado','linguica','sardinha','atum'];

function permitido(id, p){
  const a=C[id]; if(!a) return false;
  const nao=new Set(p.naoGosta||[]); if(a.chip && nao.has(a.chip)) return false;
  const al=new Set(p.alergias||[]), est=p.estilo||'tudo';
  if(al.has('gluten') && a.glu) return false;
  if(al.has('ovo') && id==='ovo') return false;
  if(al.has('frutos_mar') && ['peixe','sardinha','atum'].includes(id)) return false;
  const carne=['frango_peito','frango_coxa','carne_moida','patinho','peixe','sardinha','atum','porco','figado','linguica'];
  if((est==='vegetariano'||est==='vegano') && carne.includes(id)) return false;
  if(est==='vegano' && (a.g==='laticinio'||id==='ovo'||id==='queijo_branco')) return false;
  if(est==='sem_vermelha' && ['carne_moida','patinho','figado','porco','linguica'].includes(id)) return false;
  if(est==='sem_porco' && ['porco','linguica'].includes(id)) return false;
  return true;
}
function nomeItem(id, p){ const a=C[id]; if(!a) return id; return (a.lac && (p.alergias||[]).includes('lactose')) ? a.n+' zero lactose' : a.n; }
function pool(grupo, p, opts={}){
  const gosta=new Set(p.gosta||[]);
  const todos=Object.keys(C).filter(id=>C[id].g===grupo && permitido(id,p) && (!opts.filtro || opts.filtro(id)));
  const pref=todos.filter(id=>gosta.has(C[id].chip));
  const def=(DEFAULT[grupo]||[]).filter(id=>todos.includes(id) && !pref.includes(id));
  const min=opts.min||2;
  const out=[...pref]; for(const id of def){ if(out.length>=Math.max(min,pref.length)) break; out.push(id); }
  if(!out.length && opts.qualquer) return todos.slice(0,min);
  return out;
}
function rng(seed){ let s=seed>>>0||1; return ()=>{ s^=s<<13; s>>>=0; s^=s>>17; s^=s<<5; s>>>=0; return s/4294967296; }; }
function embaralhar(a,r){ a=[...a]; for(let i=a.length-1;i>0;i--){ const j=Math.floor(r()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a; }

/* ---------- gerar as escolhas do plano (só ids, sem gramas) ---------- */
function gerar(p, seed){
  const r=rng(seed||Date.now());
  const veg = p.estilo==='vegetariano'||p.estilo==='vegano';
  let prot = pool('proteina',p,{min:3,filtro:id=>PRINCIPAIS.includes(id)&&id!=='ovo'});
  if(prot.length<2 && permitido('ovo',p) && !(p.naoGosta||[]).includes('Ovo')) prot.push('ovo');
  if(veg){ const nao=new Set(p.naoGosta||[]); prot=[...prot, ...['grao_de_bico','lentilha'].filter(id=>permitido(id,p)&&!nao.has(C[id].chip))]; }
  prot=embaralhar(prot,r).slice(0,4);
  const carbs=pool('carbo',p,{min:2,qualquer:true});
  const arroz=carbs.filter(id=>id.startsWith('arroz')), outros=embaralhar(carbs.filter(id=>!id.startsWith('arroz')),r);
  const legum=pool('leguminosa',p,{min:1,qualquer:true}).filter(id=>!(veg&&prot.includes(id))||true);
  const legumes=embaralhar(pool('legume',p,{min:4,qualquer:true}),r);
  const salada=pool('salada',p,{min:2});
  const frutas=embaralhar(pool('fruta',p,{min:3,qualquer:true}),r);
  const paes=pool('paes',p,{min:2});
  const lat=pool('laticinio',p,{min:1}).filter(id=>id!=='queijo_branco');
  const temIog=lat.includes('iogurte')||permitido('iogurte',p)&&!(p.naoGosta||[]).includes('Iogurte natural');
  const temLeite=permitido('leite',p);
  const n = (p.refeicoes||[]).includes('jantar') ? 4 : 3;
  const marmitas=[];
  for(let i=0;i<n;i++){
    const proteina=prot[i%prot.length];
    const usaArroz = arroz.length && (i%2===0 || !outros.length);
    const carbo = usaArroz ? arroz[(i>>1)%arroz.length] : outros[(i>>1)%Math.max(1,outros.length)] || carbs[0];
    const leguminosa = (usaArroz || carbo==='cuscuz') && legum.length ? legum[i%legum.length] : null;
    marmitas.push({proteina, carbo, leguminosa, legumes:[legumes[(2*i)%legumes.length], legumes[(2*i+1)%legumes.length]].filter((v,k,a)=>v&&a.indexOf(v)===k)});
  }
  const cafeCarbs=paes.filter(id=>id!=='aveia'); const cafe=[];
  const protCafe = permitido('ovo',p) && !(p.naoGosta||[]).includes('Ovo') ? 'ovo' : (permitido('queijo_branco',p)?'queijo_branco':null);
  cafeCarbs.slice(0,2).forEach(c=>cafe.push({itens:[{id:c,flex:1}, ...(protCafe?[{id:protCafe,g:protCafe==='ovo'?100:30}]:[]), ...(temLeite?[{id:'leite',g:150}]:[]), {fruta:1}]}));
  if(paes.includes('aveia') && temIog) cafe.push({itens:[{id:'iogurte',g:170},{id:'aveia',flex:1},{fruta:1}]});
  if(!cafe.length) cafe.push({itens:[{fruta:1},{fruta:1}, ...(protCafe?[{id:protCafe,g:100}]:[])]});
  const lanche=[];
  if(temIog) lanche.push({itens:[{id:'iogurte',g:170},{fruta:1}]});
  if(paes.includes('aveia')) lanche.push({itens:[{fruta:1},{id:'aveia',flex:1}]});
  if(paes.includes('pao_integral') && permitido('queijo_branco',p)) lanche.push({itens:[{id:'pao_integral',flex:1},{id:'queijo_branco',g:30}]});
  if(paes.includes('tapioca') && protCafe) lanche.push({itens:[{id:'tapioca',flex:1},{id:protCafe,g:protCafe==='ovo'?50:30}]});
  if(!lanche.length) lanche.push({itens:[{fruta:1},{fruta:1}]});
  const ceia=[{itens:[{fruta:1}]}]; if(temIog) ceia.unshift({itens:[{id:'iogurte',g:170}]});
  const semana=[]; for(let d=0;d<7;d++) semana.push({cafe:d%cafe.length, lanche_manha:(d+1)%lanche.length, almoco:d%n, lanche_tarde:d%lanche.length, jantar:(d+1)%n, ceia:d%ceia.length});
  return {versao:1, seed:seed||0, marmitas, cafe, lanche, ceia, frutas, salada, semana};
}

/* ---------- gramas de cada refeição ---------- */
const r5 = v => Math.round(v/5)*5, r10 = v => Math.round(v/10)*10;
const clamp = (v,a,b) => Math.max(a,Math.min(b,v));
function nut(id,g){ const a=C[id]; const k=g/100; return {kcal:a.k*k,p:a.p*k,c:a.c*k,l:a.l*k}; }
function itemOut(id,g,p){ const a=C[id]; return {id, nome:nomeItem(id,p), g:Math.round(g), medida:medida(id,g), ...nut(id,g)}; }
function medida(id,g){
  const a=C[id]; if(!a) return '';
  if(a.u){ const n=Math.round(g/a.u*2)/2; const t=n===0.5?'½':String(n).replace('.5','½').replace(/^0½$/,'½'); return `${t} ${n>1?a.un[1]:a.un[0]}`; }
  if(a.colher) return `${Math.max(1,Math.round(g/a.colher))} colheres de sopa`;
  if(a.g==='leguminosa') return g>=80 ? `${Math.round(g/90*2)/2===1?'1 concha':String(Math.round(g/90*2)/2).replace('.5','½')+' conchas'}` : '½ concha';
  if(id==='leite') return `${Math.round(g/50)*50} ml`;
  if(id==='azeite') return '1 colher de chá';
  if(id==='aveia') return `${Math.max(1,Math.round(g/15))} colheres de sopa`;
  if(id==='tapioca') return `${Math.max(1,Math.round(g/25))} colheres de sopa de goma`;
  return '';
}
function marmita(m, K, protAlvo, p){
  const out=[];
  const P=C[m.proteina];
  let gp;
  if(m.proteina==='ovo'){ gp = clamp(Math.round(protAlvo/(P.p/100)/50),2,3)*50; }
  else if(P.u){ gp = clamp(Math.round(protAlvo/(P.p/100)/P.u),1,2)*P.u; }
  else gp = clamp(r10(protAlvo/(P.p/100)), 80, P.g==='leguminosa'?250:180);
  out.push(itemOut(m.proteina,gp,p));
  if(m.leguminosa) out.push(itemOut(m.leguminosa,90,p));
  (m.legumes||[]).forEach(v=>out.push(itemOut(v, (m.legumes.length>1?75:150), p)));
  out.push(itemOut('azeite',5,p));
  const usado=out.reduce((a,x)=>a+x.kcal,0);
  const CB=C[m.carbo]; const gc = clamp(r10((K-usado)/(CB.k/100)), 60, CB.k<80?400:300);
  out.splice(1,0,itemOut(m.carbo,gc,p));
  return out;
}
function opcao(o, K, p, fruta, fruta2){
  const fixos=[], flex=[];
  o.itens.forEach(it=>{ if(it.fruta){ const f=fruta; if(f) fixos.push(itemOut(f,C[f].u||150,p)); } else if(it.flex) flex.push(it.id); else fixos.push(itemOut(it.id,it.g,p)); });
  const usado=fixos.reduce((a,x)=>a+x.kcal,0);
  const out=[...fixos];
  flex.forEach(id=>{ const a=C[id]; const base={pao_frances:50,pao_integral:50,tapioca:50,cuscuz:120,aveia:30}[id]||50;
    const max={aveia:45,tapioca:80,pao_frances:100,pao_integral:75,cuscuz:200}[id]||base*2;
    let g=clamp((K-usado)/flex.length/(a.k/100), base*0.5, max);
    g = a.u ? Math.max(a.u/2, Math.round(g/a.u*2)/2*a.u) : (id==='aveia'||id==='tapioca'?Math.max(15,Math.round(g/15)*15):r10(g));
    out.unshift(itemOut(id,g,p)); });
  // se ainda faltar energia, completa com mais uma porção de fruta
  const tot=out.reduce((a,x)=>a+x.kcal,0), fr=out.find(x=>C[x.id].g==='fruta');
  if(fr && K-tot > fr.kcal*0.7){ const f2=fruta2&&fruta2!==fr.id?fruta2:fr.id; out.push(itemOut(f2,C[f2].u||150,p)); }
  return out;
}
function frutaDoDia(plano,d,k){ const f=plano.frutas||[]; return f.length ? f[(d*3+k)%f.length] : null; }
function refeicao(plano, d, ref, calc, p){
  const pr=calc.porRefeicao.find(x=>x.k===ref); if(!pr) return null;
  const K=pr.kcal, sem=plano.semana[d]||{};
  if(ref==='almoco'||ref==='jantar'){
    const m=plano.marmitas[(sem[ref]??0)%plano.marmitas.length]; if(!m) return null;
    const pa = (calc.prot||Math.round(calc.meta*0.18/4)) * (ref==='almoco'?0.32:0.28);
    const itens=marmita(m,K,pa,p);
    if(ref==='jantar' && (plano.salada||[]).length) plano.salada.slice(0,2).forEach(s=>itens.push(itemOut(s,50,p)));
    return {ref, alvo:K, opcao:sem[ref]??0, titulo:tituloMarmita(m,p), marmita:m, itens, ...soma(itens)};
  }
  const lista = ref==='cafe'?plano.cafe : ref==='ceia'?plano.ceia : plano.lanche;
  const idx=(sem[ref]??0)%lista.length, o=lista[idx];
  const k = {cafe:0,lanche_manha:1,lanche_tarde:2,ceia:3}[ref]||0;
  const itens=opcao(o,K,p,frutaDoDia(plano,d,k),frutaDoDia(plano,d,k+4));
  return {ref, alvo:K, opcao:idx, titulo:itens.map(i=>i.nome.replace(/ \(.+\)/,'')).join(' + '), itens, ...soma(itens)};
}
function soma(itens){ return itens.reduce((a,x)=>({kcal:a.kcal+x.kcal,p:a.p+x.p,c:a.c+x.c,l:a.l+x.l}),{kcal:0,p:0,c:0,l:0}); }
function tituloMarmita(m,p){ const n=id=>nomeItem(id,p).replace(/ \(.+\)/,'').replace(/ (grelhado|assado|assada|refogada|cozida|cozido|acebolado)$/,'');
  return `${nomeItem(m.proteina,p).replace(/ \(.+\)/,'')} com ${n(m.carbo).toLowerCase()}${m.leguminosa?' e '+n(m.leguminosa).toLowerCase():''}`; }
function dia(plano,d,calc,p){
  const refs=(calc.porRefeicao||[]).map(x=>x.k);
  const out=refs.map(r=>refeicao(plano,d,r,calc,p)).filter(Boolean);
  return {d, refeicoes:out, ...soma(out.flatMap(r=>r.itens))};
}

/* ---------- consumo e lista de compras ---------- */
function consumoSemana(plano,calc,p){
  const tot={};
  for(let d=0;d<7;d++) dia(plano,d,calc,p).refeicoes.forEach(r=>r.itens.forEach(i=>{ tot[i.id]=(tot[i.id]||0)+i.g; }));
  const pes=Math.max(1,+p.pessoas||1); Object.keys(tot).forEach(k=>tot[k]*=pes);
  return tot;
}
function compraDe(id, gConsumo){
  const a=C[id], cp=a.cp, bruto=gConsumo/(cp.f||1);
  if(cp.und==='un'){ const n=Math.ceil(bruto/(cp.uc||a.u||100));
    if(id==='ovo') return {qtd:n, und:'un', txt:`${n} ovos`, sub: n>=12?`≈ ${Math.ceil(n/12)} ${Math.ceil(n/12)>1?'dúzias':'dúzia'} ou ${Math.ceil(n/30)} ${Math.ceil(n/30)>1?'bandejas':'bandeja'} de 30`:''};
    const kg = cp.kgUn ? Math.round(n*cp.kgUn*10)/10 : null;
    return {qtd:n, und:'un', txt:`${n} ${n>1?'unidades':'unidade'}`, sub: kg?`≈ ${String(kg).replace('.',',')} kg`:''}; }
  if(cp.und==='pct'){ const n=Math.max(1,Math.ceil(bruto/cp.emb)); return {qtd:n, und:'pct', txt:`${n} ${n>1?'pacotes':'pacote'}`, sub:`${fmtKg(bruto)} necessários`}; }
  const kg=Math.max(0.1, Math.ceil(bruto/100)/10);
  return {qtd:kg, und:'kg', txt:`${String(kg).replace('.',',')} kg`, sub:''};
}
function fmtKg(g){ return g>=1000 ? `${String(Math.round(g/100)/10).replace('.',',')} kg` : `${Math.round(g/10)*10} g`; }
function listas(plano,calc,p,diasMes){
  const sem=consumoSemana(plano,calc,p), fator=(diasMes||30)/7;
  const freezer=(p.freezer||'medio')!=='nenhum';
  const mensal=[], semanal=[];
  Object.entries(sem).forEach(([id,g])=>{
    const a=C[id]; const vaiMensal = a.dur==='mensal' || (a.dur==='congela' && freezer);
    const item={id, nome:a.cp.n+(a.lac&&(p.alergias||[]).includes('lactose')?' zero lactose':''), grupo:a.g, consumo:vaiMensal?g*fator:g, ...compraDe(id, vaiMensal?g*fator:g)};
    (vaiMensal?mensal:semanal).push(item);
  });
  const ord={proteina:1,carbo:2,leguminosa:3,paes:4,laticinio:5,legume:6,salada:7,fruta:8,gordura:9};
  const s=(a,b)=>(ord[a.grupo]||9)-(ord[b.grupo]||9)||a.nome.localeCompare(b.nome,'pt');
  return {mensal:mensal.sort(s), semanal:semanal.sort(s), semanaG:sem};
}
/* ---------- plano de preparo das marmitas ---------- */
function preparo(plano,calc,p){
  const dias=(p.diasPreparo&&p.diasPreparo.length?p.diasPreparo:['dom']);
  const ordem=['seg','ter','qua','qui','sex','sab','dom'];
  const idxPrep=dias.map(x=>ordem.indexOf(x)).filter(i=>i>=0).sort((a,b)=>a-b);
  const sessoes=idxPrep.map((ini,k)=>{ const prox = idxPrep[(k+1)%idxPrep.length]; let n = ((prox-ini+7)%7)||7; return {dia:ordem[ini], ini, n}; });
  const pes=Math.max(1,+p.pessoas||1);
  return sessoes.map(s=>{
    const tot={}, potes=[];
    for(let j=0;j<s.n;j++){ const d=(s.ini+1+j)%7; // começa no dia seguinte ao preparo
      ['almoco','jantar'].forEach(ref=>{ const r=refeicao(plano,d,ref,calc,p); if(!r) return;
        if(ref==='jantar' && p.marmitaLocal!=='trabalho' && false) return;
        potes.push({d,ref,dias:j+1,titulo:r.titulo});
        r.itens.filter(i=>i.id!=='azeite' && C[i.id].g!=='salada').forEach(i=>{ tot[i.id]=(tot[i.id]||0)+i.g*pes; }); }); }
    const cozinhar=Object.entries(tot).map(([id,g])=>{ const a=C[id]; const cru=Math.round(g/(a.cp.f||1));
      return {id, nome:nomeItem(id,p), pronto:Math.round(g), cru, grupo:a.g, txtPronto: a.u?medida(id,g):fmtKg(g), txtCru: a.u?medida(id,g):fmtKg(cru)}; })
      .sort((x,y)=>['leguminosa','carbo','proteina','legume'].indexOf(x.grupo)-['leguminosa','carbo','proteina','legume'].indexOf(y.grupo));
    const geladeira=potes.filter(x=>x.dias<=3).length*pes, freezer=potes.filter(x=>x.dias>3).length*pes;
    return {...s, potes:potes.length*pes, geladeira, freezer, cozinhar};
  });
}

window.MeuEixoCardapio = { C, gerar, dia, refeicao, consumoSemana, listas, preparo, permitido, nomeItem, pool, compraDe };
})();
