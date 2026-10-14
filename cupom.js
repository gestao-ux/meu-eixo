/* =====================================================================
   MEU EIXO · cupom fiscal (NFC-e) e preços
   - interpreta o texto do cupom: itens, quantidades, valores, total,
     desconto, data, loja, CNPJ, chave de acesso e forma de pagamento;
   - sugere a qual alimento do cardápio cada item corresponde;
   - calcula preço por kg / por unidade e o custo das refeições.
   Nada é salvo aqui: a pessoa confere tudo antes.
   ===================================================================== */
(() => {
'use strict';
const sem = s => String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toUpperCase();
const num = s => { if(s==null) return null; s=String(s).replace(/\s/g,'').replace(/[Oo]/g,'0'); if(/,\d{1,3}$/.test(s)) s=s.replace(/\./g,'').replace(',','.'); const n=Number(s); return isFinite(n)?n:null; };
const r2 = v => Math.round(v*100)/100;
const UNID = '(UN|UND|UNID|KG|K6|PC|PCT|PT|CX|LT|L|G|GR|BD|BDJ|DZ|FD|SC|BJ|GF|LA|LAT|FR|POT|MC|MÇ)';
const RE_ITEM = new RegExp(`(\\d{1,4}(?:[.,]\\d{1,3})?)\\s*${UNID}\\.?\\s*[xX*×]?\\s*(\\d{1,5}[.,]\\d{2,3})\\s+(?:[A-Z]\\s+)?(\\d{1,6}[.,]\\d{2})\\s*[A-Z]?\\s*$`,'i');
const RE_CODIGO = /^\s*(?:\d{1,3}\s+)?(?:\d{4,14}\s+)?/;
const IGNORA = /^(CNPJ|CPF|IE\b|INSCR|ENDERE|RUA|AV\.|AVENIDA|CEP|FONE|TEL|DOCUMENTO AUXILIAR|NOTA FISCAL|CONSUMIDOR|DANFE|NFC-?E|CODIGO|COD\.|ITEM|DESCRI|QTD|QTDE|VL |VALOR|TOTAL|SUBTOTAL|DESCONTO|ACRESC|TROCO|FORMA|CARTAO|DINHEIRO|PIX|DEBITO|CREDITO|TRIBUTOS|LEI |CONSULTE|CHAVE|PROTOCOLO|EMISSAO|SERIE|VIA |OBRIGADO|VOLTE|WWW|HTTP)/;

function limparDesc(s){ return String(s||'').replace(RE_CODIGO,'').replace(/\s{2,}/g,' ').replace(/^[^A-Za-zÀ-ú0-9]+/,'').trim(); }

function interpretarCupom(texto){
  const L=String(texto||'').replace(/\r/g,'').split('\n').map(l=>l.replace(/[ \t]+/g,' ').trim()).filter(Boolean);
  const itens=[]; let ultimaDesc='';
  for(let i=0;i<L.length;i++){
    const l=L[i], m=l.match(RE_ITEM);
    if(m){
      let desc=limparDesc(l.slice(0,m.index));
      if(desc.replace(/[^A-Za-z]/g,'').length<3) desc=ultimaDesc;
      const q=num(m[1]), vu=num(m[3]), vt=num(m[4]);
      if(desc && vt!=null && vt>0 && !IGNORA.test(sem(desc))){
        const un=sem(m[2]).replace('K6','KG').replace('UND','UN').replace('UNID','UN');
        const confere = q && vu ? Math.abs(q*vu-vt) <= Math.max(0.05, vt*0.03) : false;
        itens.push({descricao:desc.slice(0,80), quantidade:q||1, unidade:un, valorUnit:vu, valorTotal:vt, confere});
      }
      ultimaDesc=''; continue;
    }
    const s=sem(l);
    if(/[A-Z]{3,}/.test(s) && !IGNORA.test(s) && !/^\d+[.,]\d{2}$/.test(l)) ultimaDesc=limparDesc(l);
  }
  const tudo=L.join('\n'), T=sem(tudo);
  const achar=(re)=>{ const m=T.match(re); return m?num(m[m.length-1]):null; };
  const total = achar(/VALOR\s*(?:A\s*PAGAR|TOTAL)[^\d\n]*(?:R\$)?\s*(\d{1,6}[.,]\d{2})/) ?? achar(/\bTOTAL\b[^\d\n]*(?:R\$)?\s*(\d{1,6}[.,]\d{2})/);
  const desconto = achar(/DESCONTO[S]?[^\d\n]*(?:R\$)?\s*(\d{1,6}[.,]\d{2})/) || 0;
  let data=null; { const m=tudo.match(/(\d{2})\/(\d{2})\/(\d{4})/); if(m) data=`${m[3]}-${m[2]}-${m[1]}`; }
  const cnpj=(tudo.match(/\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}/)||[''])[0];
  let chave=''; { const m=tudo.replace(/[^\d\n ]/g,' ').match(/(?:\d{4}\s?){11}/); if(m){ const d=m[0].replace(/\s/g,''); if(d.length===44) chave=d; } }
  let loja=''; { const i=L.findIndex(l=>/CNPJ/i.test(l)); const cand=(i>0?L.slice(Math.max(0,i-2),i):L.slice(0,2)).filter(l=>/[A-Za-z]{3,}/.test(l)&&!IGNORA.test(sem(l))); loja=(cand[cand.length-1]||L[0]||'').slice(0,60); }
  let forma=''; if(/\bPIX\b/.test(T)) forma='Pix'; else if(/DEBITO/.test(T)) forma='Débito'; else if(/CREDITO/.test(T)) forma='Crédito'; else if(/DINHEIRO/.test(T)) forma='Dinheiro';
  return {itens, total, desconto, data, cnpj, chave, loja, forma, texto:L.join('\n')};
}

/* ---------- a qual alimento cada item corresponde ---------- */
const REGRAS = [
  [/MACARR|ESPAGUET|PENNE|PARAFUSO|TALHARIM|FUSILLI|LASANHA/,'macarrao'],
  [/PEITO.*FRANGO|FRANGO.*PEITO|FILE.*PEITO|FILEZINHO|SASSAMI/,'frango_peito'],
  [/SOBRECOXA|COXA|COXINHA DA ASA|ASA FRANGO|FRANGO INTEIRO|FRANGO RESF|FRANGO CONG/,'frango_coxa'],
  [/\bOVOS?\b/,'ovo'],
  [/MOID[OA]/,'carne_moida'],
  [/PATINHO|ACEM|COXAO|ALCATRA|CONTRA ?FILE|MUSCULO|PALETA|BOVIN/,'patinho'],
  [/TILAPIA|MERLUZA|PESCADA|FILE PEIXE|PEIXE|SALMAO/,'peixe'],
  [/SARDINHA/,'sardinha'], [/\bATUM\b/,'atum'],
  [/LOMBO|PERNIL|SUIN|BISTECA/,'porco'], [/FIGADO/,'figado'], [/LINGUICA|CALABRESA/,'linguica'],
  [/MINAS|FRESCAL|RICOTA|COTTAGE/,'queijo_branco'],
  [/MUSSAREL|MUCAREL|MOZZAR|PRATO\b/,'mussarela'], [/REQUEIJ/,'requeijao'],
  [/IOGURT|YOGURT/,'iogurte'], [/\bLEITE\b(?!.*(CONDENS|COCO|PO\b))/,'leite'],
  [/ARROZ.*INTEG/,'arroz_integral'], [/ARROZ/,'arroz_branco'],
  [/BATATA.*DOCE/,'batata_doce'], [/BATATA/,'batata'], [/MANDIOCA|AIPIM|MACAXEIRA/,'mandioca'], [/INHAME|CARA\b/,'inhame'],
  [/FLOCAO|CUSCUZ|FLOCOS DE MILHO|MILHARINA/,'cuscuz'],
  [/PAO.*INTEG|PAO DE FORMA|PAO FORMA/,'pao_integral'], [/PAO FRANC|PAO SAL|PAOZINHO|\bPAO\b/,'pao_frances'],
  [/AVEIA/,'aveia'], [/TAPIOCA|GOMA/,'tapioca'],
  [/FEIJ.*PRET/,'feijao_preto'], [/FEIJ/,'feijao_carioca'], [/LENTILHA/,'lentilha'], [/GRAO.*BICO/,'grao_de_bico'], [/ERVILHA/,'ervilha'],
  [/CENOURA/,'cenoura'], [/ABOBRINHA/,'abobrinha'], [/ABOBORA|CABOTIA|MORANGA/,'abobora'], [/CHUCHU/,'chuchu'], [/BETERRABA/,'beterraba'], [/VAGEM/,'vagem'],
  [/BROCOLI/,'brocolis'], [/COUVE.?FLOR/,'couve_flor'], [/BERINJELA/,'berinjela'], [/QUIABO/,'quiabo'], [/MILHO/,'milho'],
  [/ALFACE/,'alface'], [/TOMATE(?!.*(MOLHO|EXTRATO|POLPA|PASSATA))/,'tomate'], [/PEPINO/,'pepino'], [/REPOLHO/,'repolho'], [/\bCOUVE\b/,'couve'], [/RUCULA/,'rucula'],
  [/BANANA/,'banana'], [/\bMACA\b|MACA (FUJI|GALA|NAC)/,'maca'], [/LARANJA/,'laranja'], [/MAMAO|PAPAIA|FORMOSA/,'mamao'], [/MELANCIA/,'melancia'], [/\bMANGA\b/,'manga'],
  [/ABACAXI/,'abacaxi'], [/GOIABA/,'goiaba'], [/\bUVA\b/,'uva'], [/ABACATE/,'abacate'],
  [/AZEITE|OLEO (DE )?(SOJA|MILHO|GIRASSOL|CANOLA)|\bOLEO\b/,'azeite']
];
const LIMPEZA=/DETERG|SABAO|LAVA ?ROUPA|AMACIANT|DESINFET|AGUA SANIT|ALVEJ|CANDIDA|ESPONJA|LIMPA|MULTIUSO|SACO.*LIXO|SACO P\/? ?LIXO|PANO|VASSOURA|INSETIC|LUSTRA|PAPEL TOALHA|ALCOOL/;
const HIGIENE=/SHAMPOO|XAMPU|CONDICION|SABONETE|CREME DENT|PASTA DENT|ESCOVA DENT|FIO DENT|PAPEL HIG|DESODOR|ABSORV|FRALDA|HASTE|COTONETE|BARBEAD|LAMINA|PROTETOR|HIDRAT/;
const NAO_ALIMENTO_OUTROS=/SACOLA|PILHA|LAMPADA|VELA|FOSFORO|CARVAO|RACAO/;
function sugerir(desc){
  const d=sem(desc);
  if(LIMPEZA.test(d)) return {destino:'limpeza'};
  if(HIGIENE.test(d)) return {destino:'higiene'};
  if(NAO_ALIMENTO_OUTROS.test(d)) return {destino:'outros'};
  for(const [re,id] of REGRAS) if(re.test(d)) return {destino:'alimento', alimento_id:id};
  return {destino:'outro_alimento'};
}

/* ---------- peso e contagem do item ---------- */
function medidas(item, C){
  const d=sem(item.descricao).replace(/(\d)\s*K6\b/g,'$1KG').replace(/(\d)\s*6R\b/g,'$1GR'), q=+item.quantidade||1, a=item.alimento_id?C[item.alimento_id]:null;
  let gramas=null, unidades=null;
  if(item.unidade==='KG') gramas=q*1000;
  else if(item.unidade==='G'||item.unidade==='GR') gramas=q;
  else {
    const m=d.match(/(\d+(?:[.,]\d+)?)\s*(KG|G|GR|ML|LT|L)\b/);
    if(m){ let v=num(m[1]); const u=m[2]; if(u==='KG'||u==='L'||u==='LT') v*=1000; if(v>0) gramas=q*v; }
    const c=d.match(/(?:C\/|COM |CX |CARTELA |BANDEJA )?(\d{1,2})\s*(?:UN|UNID|OVOS)\b/) || d.match(/\bC\/\s?(\d{1,2})\b/) || (/\bDZ|DUZIA/.test(d)?[0,'12']:null) || (item.unidade==='DZ'?[0,'12']:null);
    if(c && item.alimento_id==='ovo') unidades=q*num(c[1]);
    else if(!gramas && a && a.cp && a.cp.und==='un') unidades=q;
    else if(!gramas && a && a.cp && a.cp.und==='pct' && a.cp.emb) gramas=q*a.cp.emb;
  }
  if(item.alimento_id==='ovo' && !unidades) unidades = q>=6 ? q : q*12;
  return {gramas, unidades};
}

/* ---------- preço de referência e custo ---------- */
// precos: [{alimento_id, data, valor, gramas, unidades, origem}] mais recentes primeiro
function precoAtual(id, precos, C){
  const a=C[id]; if(!a) return null;
  const lista=precos.filter(p=>p.alimento_id===id).sort((x,y)=>String(y.data).localeCompare(String(x.data)));
  for(const p of lista){
    if(p.gramas>0) return {porKg: p.valor/(p.gramas/1000), porUn: a.cp.uc ? p.valor/(p.gramas/1000)*(a.cp.kgUn||a.cp.uc/1000) : null, data:p.data, origem:p.origem, loja:p.estabelecimento};
    if(p.unidades>0) return {porUn: p.valor/p.unidades, porKg: (a.cp.kgUn||a.cp.uc) ? p.valor/p.unidades/((a.cp.kgUn)||(a.cp.uc/1000)) : null, data:p.data, origem:p.origem, loja:p.estabelecimento};
  }
  return null;
}
// custo de comprar o que foi consumido: gramas prontas → gramas compradas → R$
function custoConsumo(id, gProntos, precos, C){
  const a=C[id], pr=precoAtual(id,precos,C); if(!a||!pr) return null;
  const bruto=gProntos/(a.cp.f||1);
  if(a.cp.und==='un' && pr.porUn!=null){ const un=bruto/(a.cp.uc||a.u||100); return un*pr.porUn; }
  if(pr.porKg!=null) return bruto/1000*pr.porKg;
  return null;
}
function custoLinhaLista(item, precos, C){
  const a=C[item.id], pr=precoAtual(item.id,precos,C); if(!a||!pr) return null;
  if(item.und==='un') return pr.porUn!=null ? item.qtd*pr.porUn : (pr.porKg!=null&&a.cp.kgUn ? item.qtd*a.cp.kgUn*pr.porKg : null);
  if(item.und==='pct') return pr.porKg!=null ? item.qtd*(a.cp.emb/1000)*pr.porKg : null;
  return pr.porKg!=null ? item.qtd*pr.porKg : null;
}

window.MeuEixoCupom = { interpretarCupom, sugerir, medidas, precoAtual, custoConsumo, custoLinhaLista };
})();
