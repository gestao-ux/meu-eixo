/* =====================================================================
   MEU EIXO · listas de seleção próprias (substituem a lista nativa)
   - Cada <select> ganha um botão e uma lista elegante; o <select> original
     continua no formulário (valor, validação e eventos "change" iguais).
   - <select multiple> vira lista com várias escolhas: aplica ao tocar em "Aplicar".
   - Teclado: setas, Enter, Esc e busca quando há muitas opções.
   - No celular a lista abre como painel na parte de baixo da tela.
   ===================================================================== */
(() => {
'use strict';
const CHEV='<svg class="dd-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>';
const OK='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5 10 17l9-10"/></svg>';
let aberto=null, seq=0;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const rotulo = sel => {
  if(sel.multiple){ const s=[...sel.selectedOptions]; const vazio=sel.dataset.vazio||'Todas';
    return s.length===0 ? vazio : s.length===1 ? s[0].textContent : `${s.length} ${sel.dataset.plural||'selecionadas'}`; }
  const o=sel.options[sel.selectedIndex]; return o ? o.textContent : '';
};
function botaoDe(sel){ const b=sel.nextElementSibling; return b && b._sel===sel ? b : null; }
function refrescar(raiz=document){
  raiz.querySelectorAll('select[data-dd]').forEach(s=>{ const b=botaoDe(s); if(!b) return;
    b.querySelector('.dd-v').textContent=rotulo(s); b.disabled=s.disabled;
    b.classList.toggle('vazio', s.multiple ? !s.selectedOptions.length : !s.value);
    b.classList.toggle('lido', s.classList.contains('lido')); });
}
function melhorar(sel){
  if(sel.dataset.dd || sel.closest('[data-dd-nativo]')) return;
  sel.dataset.dd='1'; sel.classList.add('dd-nativo'); sel.tabIndex=-1; sel.setAttribute('aria-hidden','true');
  const b=document.createElement('button'); b.type='button'; b.className='dd'+(sel.multiple?' multi':''); b._sel=sel;
  b.id='dd'+(++seq); b.setAttribute('aria-haspopup','listbox'); b.setAttribute('aria-expanded','false');
  const lab = sel.id && document.querySelector(`label[for="${CSS.escape(sel.id)}"]`);
  if(lab){ if(!lab.id) lab.id='ddl'+seq; b.setAttribute('aria-labelledby',lab.id+' '+b.id); lab.addEventListener('click',e=>{ e.preventDefault(); b.focus(); abrir(b); }); }
  else if(sel.getAttribute('aria-label')) b.setAttribute('aria-label',sel.getAttribute('aria-label'));
  b.innerHTML=`<span class="dd-v"></span>${CHEV}`;
  sel.after(b); refrescar(sel.parentElement);
  b.addEventListener('click',()=> aberto&&aberto.b===b ? fechar(true) : abrir(b));
  b.addEventListener('keydown',e=>{ if(['ArrowDown','ArrowUp','Enter',' '].includes(e.key)){ e.preventDefault(); abrir(b); } });
}
function opcoesDe(sel){ return [...sel.options].filter(o=>!o.hidden).map((o,i)=>({o,i,t:o.textContent,v:o.value,dis:o.disabled})); }
function abrir(b){
  if(b.disabled) return; fechar(false);
  const sel=b._sel, multi=sel.multiple, ops=opcoesDe(sel), escolha=new Set([...sel.selectedOptions].map(o=>o.value));
  if(multi && !escolha.size) ops.filter(x=>!x.dis).forEach(x=>escolha.add(x.v));   // sem filtro = todas marcadas
  const pop=document.createElement('div'); pop.className='dd-pop'+(multi?' multi':''); pop.setAttribute('role','listbox'); if(multi) pop.setAttribute('aria-multiselectable','true');
  const titulo = (b.getAttribute('aria-labelledby')||'').split(' ').map(id=>document.getElementById(id)).filter(x=>x && x!==b).map(x=>x.textContent).join(' ') || sel.getAttribute('aria-label') || '';
  const busca = ops.length>9;
  pop.innerHTML = `${titulo?`<div class="dd-tit">${esc(titulo)}</div>`:''}${busca?`<div class="dd-busca"><input type="search" placeholder="Buscar" aria-label="Buscar opção" autocomplete="off"></div>`:''}<div class="dd-lista"></div>${multi?`<div class="dd-rod"><button type="button" class="dd-limpar">Limpar</button><button type="button" class="dd-aplicar">Aplicar</button></div>`:''}`;
  const lista=pop.querySelector('.dd-lista');
  const desenhar = filtro => { const f=(filtro||'').trim().toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu,'');
    const validas=ops.filter(x=>!x.dis), todas=validas.length>0 && validas.every(x=>escolha.has(x.v)), parcial=!todas && escolha.size>0;
    const linhaTodas = multi && !f ? `<div class="dd-op todas${todas?' on':''}${parcial?' parcial':''}" role="option" aria-selected="${todas}" data-i="todas" id="${b.id}-todas"><span class="dd-marca">${parcial?'<i class="dd-traco"></i>':OK}</span><span class="dd-t">${esc(sel.dataset.vazio||'Todas')}</span></div>` : '';
    lista.innerHTML = linhaTodas + ops.filter(x=>!f || x.t.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu,'').includes(f)).map(x=>{ const on=multi?escolha.has(x.v):x.o.selected;
      return `<div class="dd-op${on?' on':''}${x.dis?' dis':''}${!x.v&&!multi?' neutra':''}" role="option" aria-selected="${on}" data-i="${x.i}" id="${b.id}-o${x.i}"><span class="dd-marca">${on||multi?OK:''}</span><span class="dd-t">${esc(x.t)}</span></div>`; }).join('') || '<div class="dd-nada">Nada encontrado</div>';
    ativar(lista.querySelector('.dd-op.on')||lista.querySelector('.dd-op:not(.dis)')); };
  let ativo=null;
  const ativar = el => { if(ativo) ativo.classList.remove('ativo'); ativo=el; if(el){ el.classList.add('ativo'); b.setAttribute('aria-activedescendant',el.id); const t=el.offsetTop, h=el.offsetHeight; if(t<lista.scrollTop) lista.scrollTop=t; else if(t+h>lista.scrollTop+lista.clientHeight) lista.scrollTop=t+h-lista.clientHeight; } };
  const escolher = el => { if(!el || el.classList.contains('dis')) return;
    if(el.dataset.i==='todas'){ const validas=ops.filter(x=>!x.dis); const todas=validas.every(x=>escolha.has(x.v)); escolha.clear(); if(!todas) validas.forEach(x=>escolha.add(x.v)); desenhar(''); ativar(lista.querySelector('.dd-op.todas')); return; }
    const x=ops.find(o=>o.i===+el.dataset.i);
    if(multi){ escolha.has(x.v)?escolha.delete(x.v):escolha.add(x.v); const q=pop.querySelector('.dd-busca input')?.value||''; const i=el.dataset.i; desenhar(q); ativar(lista.querySelector(`[data-i="${i}"]`)); return; }
    if(sel.value!==x.v){ sel.value=x.v; sel.dispatchEvent(new Event('change',{bubbles:true})); }
    fechar(true); refrescar(); };
  lista.addEventListener('pointerdown',e=>e.preventDefault());
  lista.addEventListener('click',e=>escolher(e.target.closest('.dd-op')));
  lista.addEventListener('pointermove',e=>{ const el=e.target.closest('.dd-op'); if(el && el!==ativo && !el.classList.contains('dis')) ativar(el); });
  if(multi){
    pop.querySelector('.dd-limpar').addEventListener('click',()=>{ escolha.clear(); desenhar(pop.querySelector('.dd-busca input')?.value); });
    pop.querySelector('.dd-aplicar').addEventListener('click',()=>{ const validas=ops.filter(x=>!x.dis); if(validas.length && validas.every(x=>escolha.has(x.v))) escolha.clear(); [...sel.options].forEach(o=>o.selected=escolha.has(o.value)); fechar(true); refrescar(); sel.dispatchEvent(new Event('change',{bubbles:true})); });
  }
  pop.addEventListener('keydown',e=>{
    const itens=[...lista.querySelectorAll('.dd-op:not(.dis)')], k=itens.indexOf(ativo);
    if(e.key==='ArrowDown'){ e.preventDefault(); ativar(itens[Math.min(itens.length-1,k+1)]||itens[0]); }
    else if(e.key==='ArrowUp'){ e.preventDefault(); ativar(itens[Math.max(0,k-1)]||itens[0]); }
    else if(e.key==='Enter'){ e.preventDefault(); if(multi && e.target.closest('.dd-busca')===null && !ativo) pop.querySelector('.dd-aplicar').click(); else escolher(ativo); }
    else if(e.key===' ' && multi && !e.target.closest('.dd-busca')){ e.preventDefault(); escolher(ativo); }
    else if(e.key==='Escape'){ e.preventDefault(); fechar(true); }
    else if(e.key==='Tab'){ fechar(false); }
    else if(e.key.length===1 && !e.metaKey && !e.ctrlKey && !e.target.closest('.dd-busca')){ const bi=pop.querySelector('.dd-busca input'); if(bi){ e.preventDefault(); bi.focus(); bi.value+=e.key; bi.dispatchEvent(new Event('input')); } } });
  document.body.appendChild(pop); desenhar('');
  posicionar(b,pop); b.setAttribute('aria-expanded','true'); b.classList.add('aberto');
  aberto={b,pop};
  const alvo=pop.querySelector('.dd-busca input'); if(alvo){ alvo.addEventListener('input',()=>desenhar(alvo.value)); if(!celular()) alvo.focus(); }
  if(!alvo || celular()){ pop.tabIndex=-1; pop.focus({preventScroll:true}); }
  requestAnimationFrame(()=>pop.classList.add('vis'));
}
const celular = () => innerWidth<600;
function posicionar(b,pop){
  if(celular()){ pop.classList.add('folha'); return; }
  const r=b.getBoundingClientRect(), w=Math.max(r.width,230), alt=Math.min(pop.scrollHeight,340);
  pop.style.width=w+'px'; pop.style.left=Math.max(8,Math.min(innerWidth-w-8,r.left))+'px';
  const baixo=innerHeight-r.bottom-10;
  if(baixo<alt && r.top>baixo){ pop.style.bottom=(innerHeight-r.top+6)+'px'; pop.classList.add('cima'); } else pop.style.top=(r.bottom+6)+'px';
}
function fechar(voltarFoco){
  if(!aberto) return; const {b,pop}=aberto; aberto=null;
  b.setAttribute('aria-expanded','false'); b.classList.remove('aberto'); b.removeAttribute('aria-activedescendant');
  pop.classList.remove('vis'); setTimeout(()=>pop.remove(),120); if(voltarFoco && document.contains(b)) b.focus({preventScroll:true});
}
document.addEventListener('pointerdown',e=>{ if(aberto && !aberto.pop.contains(e.target) && !aberto.b.contains(e.target)) fechar(false); },true);
let larg=innerWidth; addEventListener('resize',()=>{ if(Math.abs(innerWidth-larg)>40){ larg=innerWidth; fechar(false); } });   // teclado do celular não fecha a lista
document.addEventListener('scroll',e=>{ if(aberto && !aberto.pop.classList.contains('folha') && !aberto.pop.contains(e.target)) fechar(false); },true);
document.addEventListener('change',()=>setTimeout(refrescar),true);
document.addEventListener('input',()=>setTimeout(refrescar),true);
const varrer = () => document.querySelectorAll('select:not([data-dd])').forEach(melhorar);
new MutationObserver(()=>{ varrer(); if(aberto && !document.contains(aberto.b)) fechar(false); }).observe(document.body,{childList:true,subtree:true});
varrer();
window.MeuEixoSelecao = { refrescar, fechar, aberto:()=>!!aberto };
})();
