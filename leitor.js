/* =====================================================================
   MEU EIXO · leitura de comprovantes
   Tudo roda no próprio aparelho: PDF com texto é lido pelo pdf.js;
   foto, print ou PDF escaneado passa por OCR (Tesseract, português).
   Nada é salvo automaticamente: o resultado só preenche o formulário
   para a pessoa conferir.
   ===================================================================== */
(() => {
'use strict';
const TESS = 'https://cdn.jsdelivr.net/npm/tesseract.js@6.0.1/dist/';
const CORE = 'https://cdn.jsdelivr.net/npm/tesseract.js-core@6.0.0';
const LANG = 'https://cdn.jsdelivr.net/npm/@tesseract.js-data/por@1.0.0/4.0.0_best_int';
const PDFJS = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/';

const MES = {jan:1,fev:2,mar:3,abr:4,mai:5,jun:6,jul:7,ago:8,set:9,out:10,nov:11,dez:12};
const pad = n => String(n).padStart(2,'0');

/* ---------- interpretação do texto ---------- */
function linhas(t){ return String(t||'').replace(/\r/g,'').split('\n').map(l=>l.replace(/[ \t]+/g,' ').trim()).filter(Boolean); }
function numBR(s){ s=s.replace(/\s/g,''); const n=Number(s.replace(/\./g,'').replace(',','.')); return isFinite(n)?Math.round(n*100)/100:null; }
function dataOk(y,m,d){ y=+y; m=+m; d=+d; if(y<100) y+=2000; if(y<2000||y>2100||m<1||m>12||d<1||d>31) return null; return `${y}-${pad(m)}-${pad(d)}`; }

const RE_VALOR = /(?:R\s?\$|RS|R5|BRL)\s*:?\s*(\d{1,3}(?:[.\s]\d{3})*,\d{2}|\d+,\d{2})/gi;
const RE_NUM = /(?<![\d,.])(\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2})(?![\d,])/g;

function acharValor(L){
  const cands=[];
  L.forEach((l,i)=>{
    const low=l.toLowerCase(), prev=(L[i-1]||'').toLowerCase();
    let base=0;
    if(/valor|total|pago|transferid|enviado|pagamento|quantia/.test(low)) base+=3;
    if(/valor|total|quantia/.test(prev)) base+=2;
    if(/saldo|tarifa|limite|juros|desconto|multa|taxa/.test(low)) base-=6;
    let m, achou=false; RE_VALOR.lastIndex=0;
    while((m=RE_VALOR.exec(l))){ achou=true; const v=numBR(m[1]); if(v) cands.push({v,s:base+2,i}); }
    if(!achou && (base>=2 || /valor|total|quantia/.test(prev))){ RE_NUM.lastIndex=0; while((m=RE_NUM.exec(l))){ const v=numBR(m[1]); if(v) cands.push({v,s:base,i}); } }
  });
  if(!cands.length) return null;
  cands.sort((a,b)=>b.s-a.s||a.i-b.i);
  return cands[0].v;
}

function datasDaLinha(l){
  const out=[]; let m;
  const r1=/(\d{1,2})\s*\/\s*(\d{1,2})\s*\/\s*(\d{4}|\d{2})(?!\d)/g; while((m=r1.exec(l))){ const d=dataOk(m[3],m[2],m[1]); if(d) out.push(d); }
  const r2=/(\d{4})-(\d{2})-(\d{2})/g; while((m=r2.exec(l))){ const d=dataOk(m[1],m[2],m[3]); if(d) out.push(d); }
  const r3=/(\d{1,2})\s*(?:de\s+)?(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)[a-zç]*\.?\s*(?:de\s+|\/\s*)?(\d{4})/gi;
  while((m=r3.exec(l))){ const d=dataOk(m[3],MES[m[2].toLowerCase()],m[1]); if(d) out.push(d); }
  return out;
}
function acharData(L){
  const cands=[];
  L.forEach((l,i)=>{
    const low=l.toLowerCase(), prev=(L[i-1]||'').toLowerCase();
    let s=0;
    if(/data|realizad|efetuad|pagament|transa|transfer|enviad|recebid|em\s/.test(low)) s+=2;
    if(/data|realizad|efetuad/.test(prev)) s+=2;
    if(/vencimento|validade|nascimento|emiss/.test(low)) s-=1;
    datasDaLinha(l).forEach(d=>cands.push({d,s,i}));
  });
  if(!cands.length) return null;
  cands.sort((a,b)=>b.s-a.s||a.i-b.i);
  return cands[0].d;
}

const RE_DESTINO = /^(para|destino|destinat[aá]rio|recebedor|favorecido|quem recebeu|benefici[aá]rio|dados do recebedor|dados de quem recebeu)\b\s*:?\s*(.*)$/i;
const RE_ORIGEM = /^(de|origem|pagador|quem pagou|quem enviou|remetente|dados do pagador|dados de quem pagou|dados de quem enviou)\b\s*:?\s*(.*)$/i;
const NAO_NOME = /^(cpf|cnpj|chave|institui|banco|ag[eê]ncia|conta|tipo|valor|data|id|c[oó]digo|autentica|nome:?$|r\$)/i;
function pareceNome(l){ return /[A-Za-zÀ-ú]{2,}/.test(l) && !NAO_NOME.test(l) && (l.replace(/[^0-9]/g,'').length < l.length/3) && l.length<=80; }
function acharNome(L, entrada){
  const RE = entrada ? RE_ORIGEM : RE_DESTINO;
  for(let i=0;i<L.length;i++){
    const m=L[i].match(RE); if(!m) continue;
    const resto=(m[2]||'').trim();
    if(resto && pareceNome(resto) && !/^nome$/i.test(resto)) return limparNome(resto);
    for(let j=i+1;j<Math.min(L.length,i+5);j++){
      const l=L[j]; const n=l.match(/^nome\s*:?\s*(.*)$/i);
      if(n){ if(n[1] && pareceNome(n[1])) return limparNome(n[1]); if(L[j+1] && pareceNome(L[j+1])) return limparNome(L[j+1]); continue; }
      if(pareceNome(l)) return limparNome(l);
    }
  }
  return null;
}
function limparNome(s){ return s.replace(/\s{2,}/g,' ').replace(/[|_]+/g,'').trim().slice(0,80); }

const RE_EMAIL=/[\w.+-]+@[\w-]+\.[\w.]+/;
const RE_UUID=/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
const RE_CNPJ=/\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/;
const RE_FONE=/\+?55\s?\(?\d{2}\)?\s?9?\d{4}-?\d{4}/;
function acharChave(L){
  for(let i=0;i<L.length;i++){
    const m=L[i].match(/^chave(?:\s+pix)?\s*:?\s*(.*)$/i);
    if(m){ const v=(m[1]||'').trim() || (L[i+1]||'').trim(); if(v && !/^tipo/i.test(v) && v.length>=5) return v.replace(/\s+/g,''); }
  }
  const tudo=L.join('\n');
  const u=tudo.match(RE_UUID); if(u) return u[0];
  const e=tudo.match(RE_EMAIL); if(e && !/(suporte|ouvidoria|atendimento|sac|ajuda|contato|noreply|no-reply)/i.test(e[0])) return e[0];
  return null;
}

function interpretar(texto){
  const L=linhas(texto), tudo=L.join('\n').toLowerCase();
  const entrada=/(voc[eê] recebeu|pix recebido|transfer[eê]ncia recebida|recebimento de pix|cr[eé]dito em conta)/.test(tudo);
  return {
    valor: acharValor(L),
    data: acharData(L),
    nome: acharNome(L, entrada),
    chave: entrada ? null : acharChave(L),
    pix: /\bpix\b/.test(tudo),
    entrada,
    texto: L.join('\n')
  };
}

/* ---------- leitura de arquivos ---------- */
const carregados={};
function carregar(src){
  if(carregados[src]) return carregados[src];
  return carregados[src]=new Promise((ok,err)=>{ const s=document.createElement('script'); s.src=src; s.async=true; s.onload=()=>ok(); s.onerror=()=>{ delete carregados[src]; err(new Error('Não foi possível carregar o leitor de comprovantes. Verifique a internet.')); }; document.head.appendChild(s); });
}
let worker=null, aoProgresso=null;
async function ocr(imagem){
  await carregar(TESS+'tesseract.min.js');
  if(!worker){
    worker = await window.Tesseract.createWorker('por', 1, {
      workerPath: TESS+'worker.min.js', corePath: CORE, langPath: LANG,
      logger: m => { if(m.status==='recognizing text' && aoProgresso) aoProgresso(Math.round(m.progress*100)); }
    });
  }
  const { data } = await worker.recognize(imagem);
  return data.text || '';
}
async function imagemReduzida(arquivo){
  const url=URL.createObjectURL(arquivo);
  try{
    const img=await new Promise((ok,err)=>{ const i=new Image(); i.onload=()=>ok(i); i.onerror=()=>err(new Error('Não foi possível abrir a imagem. Use JPG, PNG ou PDF.')); i.src=url; });
    const max=2200, k=Math.min(1, max/Math.max(img.naturalWidth,img.naturalHeight));
    const c=document.createElement('canvas'); c.width=Math.round(img.naturalWidth*k); c.height=Math.round(img.naturalHeight*k);
    const ctx=c.getContext('2d'); ctx.fillStyle='#fff'; ctx.fillRect(0,0,c.width,c.height); ctx.drawImage(img,0,0,c.width,c.height);
    return c;
  } finally { URL.revokeObjectURL(url); }
}
async function textoDoPdf(arquivo){
  await carregar(PDFJS+'pdf.min.js');
  const lib=window.pdfjsLib; lib.GlobalWorkerOptions.workerSrc=PDFJS+'pdf.worker.min.js';
  const doc=await lib.getDocument({data:new Uint8Array(await arquivo.arrayBuffer())}).promise;
  let texto='';
  for(let p=1;p<=Math.min(doc.numPages,3);p++){
    const pg=await doc.getPage(p); const tc=await pg.getTextContent();
    let linha=''; for(const it of tc.items){ linha+=it.str; if(it.hasEOL){ texto+=linha+'\n'; linha=''; } else linha+=' '; } texto+=linha+'\n';
  }
  if(texto.replace(/\s/g,'').length>=20) return texto;
  const pg=await doc.getPage(1); const vp=pg.getViewport({scale:2.2});
  const c=document.createElement('canvas'); c.width=vp.width; c.height=vp.height;
  await pg.render({canvasContext:c.getContext('2d'),viewport:vp}).promise;
  return ocr(c);
}
async function ler(arquivo, progresso){
  aoProgresso=progresso||null;
  const pdf = arquivo.type==='application/pdf' || /\.pdf$/i.test(arquivo.name||'');
  const texto = pdf ? await textoDoPdf(arquivo) : await ocr(await imagemReduzida(arquivo));
  return interpretar(texto);
}
async function hash(arquivo){
  const buf=await crypto.subtle.digest('SHA-256', await arquivo.arrayBuffer());
  return [...new Uint8Array(buf)].map(b=>b.toString(16).padStart(2,'0')).join('');
}

window.MeuEixoLeitor = { ler, interpretar, hash };
})();
