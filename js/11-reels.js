// ============ REELS: guardado seguro, reglas, plazos y prendas ============
// La lista de reels es una sola para todo el equipo. Cada dispositivo guarda "uniendo" por id
// (gana la version mas nueva) para que nadie pise lo que hizo otro, y los borrados se anotan
// aparte para que la union no los resucite.
let reelsBorrados=[];
let reelsSnap={};
function reelKey(r){ const {upd,...x}=r; return JSON.stringify(x); }
function snapReels(){ reelsSnap={}; reels.forEach(r=>{ reelsSnap[r.id]=reelKey(r); }); }
function mergeReels(remote){
  if(!remote) return false;
  const antes=JSON.stringify(reels)+JSON.stringify(reelsBorrados);
  const del=new Set([...(reelsBorrados||[]),...(remote.deleted||[])]);
  reelsBorrados=[...del];
  const byId=new Map();
  (remote.list||[]).forEach(r=>{ byId.set(r.id,r); reelsSnap[r.id]=reelKey(r); });
  reels.forEach(l=>{ const r=byId.get(l.id); if(!r||(l.upd||0)>(r.upd||0)) byId.set(l.id,l); });
  reels=[...byId.values()].filter(r=>!del.has(r.id)).sort((a,b)=>String(b.creado||'').localeCompare(String(a.creado||'')));
  return antes!==JSON.stringify(reels)+JSON.stringify(reelsBorrados);
}
function persistReelsLocal(){ try{ localStorage.setItem('luffy_reels',JSON.stringify(reels)); localStorage.setItem('luffy_reels_del',JSON.stringify(reelsBorrados)); }catch(e){} }
function saveReels(){
  const ahora=Date.now();
  reels.forEach(r=>{ if(reelsSnap[r.id]!==reelKey(r)) r.upd=ahora; });
  persistReelsLocal();
  if(!DB){ snapReels(); return; }
  const ref=DB.doc('luffy/reels');
  Promise.resolve(ref.get()).then(remote=>{
    const cambio=mergeReels(remote);
    persistReelsLocal();
    return Promise.resolve(ref.set({list:reels,deleted:reelsBorrados})).then(()=>{ snapReels(); if(cambio) refreshCurrentView(); });
  }).catch(()=>{ try{ ref.set({list:reels,deleted:reelsBorrados}); }catch(e){} });
}
function refrescarReels(){
  if(!DB) return;
  Promise.resolve(DB.doc('luffy/reels').get()).then(remote=>{
    if(mergeReels(remote)){ persistReelsLocal(); refreshCurrentView(); }
  }).catch(()=>{});
}

// ---------- reglas (las define el admin) ----------
const REGLAS_REELS_DEFAULT={plazoDias:3, puntosOk:50, puntosFallo:50, prendas:[{id:'p1',texto:'Invitar el café al equipo'},{id:'p2',texto:'Encargarse de la limpieza un día'},{id:'p3',texto:'Ordenar el depósito'}]};
let reglasReels=JSON.parse(JSON.stringify(REGLAS_REELS_DEFAULT));
function loadReglasReels(){
  try{ const r=JSON.parse(localStorage.getItem('luffy_reglas_reels')||'null'); if(r) reglasReels={...REGLAS_REELS_DEFAULT,...r}; }catch(e){}
  if(DB){
    DB.doc('luffy/reglas_reels').get().then(r=>{
      if(r&&JSON.stringify({...REGLAS_REELS_DEFAULT,...r})!==JSON.stringify(reglasReels)){ reglasReels={...REGLAS_REELS_DEFAULT,...r}; try{localStorage.setItem('luffy_reglas_reels',JSON.stringify(reglasReels));}catch(e){} refreshCurrentView(); }
    }).catch(()=>{});
  }
}
function saveReglasReels(){
  try{localStorage.setItem('luffy_reglas_reels',JSON.stringify(reglasReels));}catch(e){}
  if(DB){ try{DB.doc('luffy/reglas_reels').set(reglasReels);}catch(e){} }
}

// ---------- helpers ----------
function safeUrl(u){
  u=(u||'').trim(); if(!u) return '';
  if(!/^https?:\/\//i.test(u)) u='https://'+u;
  try{ const x=new URL(u); return (x.protocol==='http:'||x.protocol==='https:')?x.href:''; }catch(e){ return ''; }
}
function plataformaUrl(u){
  let h=''; try{ h=new URL(u).hostname.replace(/^www\./,''); }catch(e){}
  if(/(^|\.)instagram\.com$/.test(h)) return {n:'Instagram',e:'📸'};
  if(/(^|\.)tiktok\.com$/.test(h)) return {n:'TikTok',e:'🎵'};
  if(/(^|\.)(youtube\.com|youtu\.be)$/.test(h)) return {n:'YouTube',e:'▶️'};
  return {n:h||'Link',e:'🔗'};
}
function esMio(r){ return !!profile&&(r.asignadoId===profile.id||(!r.asignadoId&&r.asignado===profile.name)); }
function estadoPlazo(r){
  if(!r.vence||r.stage==='publicado'||r.resultado==='cumplido') return null;
  const ms=Date.parse(r.vence)-Date.now();
  if(ms<=0||r.resultado==='vencido') return {vencido:true,texto:'Vencido',color:'#f472b6',ms:0};
  const d=Math.floor(ms/864e5), hs=Math.floor(ms%864e5/36e5), m=Math.floor(ms%36e5/6e4);
  return {vencido:false,texto:d>0?d+'d '+hs+'h':hs+'h '+m+'m',color:ms<864e5?'#f472b6':(ms<2*864e5?'#fbbf24':'#34d399'),ms};
}
function chipPlazo(r){
  const p=estadoPlazo(r); if(!p) return '';
  return `<span style="font-size:10px;font-weight:800;padding:3px 8px;border-radius:10px;background:${p.color}22;color:${p.color};white-space:nowrap">${p.vencido?'⚠️ Vencido':'⏱ '+p.texto}</span>`;
}
function fmtFechaHora(iso){ return iso?new Date(iso).toLocaleDateString('es-AR',{day:'numeric',month:'short'})+' '+new Date(iso).toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit'}):''; }

// ---------- puntos (sin duplicar aunque lo corran dos dispositivos) ----------
function puntosTx(fn){
  if(!DB){ fn(); return; }
  Promise.resolve(DB.doc('luffy/puntos').get()).then(r=>{ mergePuntos(r); fn(); }).catch(()=>fn());
}

// ---------- tomar un reel del banco ----------
async function tomarReel(id){
  if(!profile||profile.role!=='profesional'){ showToast('Solo los profesionales toman reels'); return; }
  let remote=null;
  if(DB){ try{ remote=await DB.doc('luffy/reels').get(); }catch(e){} }
  if(remote) mergeReels(remote);
  const r=reels.find(x=>x.id===id);
  if(!r){ showToast('Ese reel ya no está'); closeModal('modal-registro'); refreshCurrentView(); return; }
  if(r.asignado){ showToast('Ya lo tomó '+r.asignado); closeModal('modal-registro'); refreshCurrentView(); return; }
  const dias=numV(r.plazoDias)||numV(reglasReels.plazoDias)||3;
  const ahora=new Date();
  r.asignado=profile.name; r.asignadoId=profile.id; r.tomadoEn=ahora.toISOString();
  r.plazoDias=dias; r.vence=new Date(ahora.getTime()+dias*864e5).toISOString();
  r.stage='guion'; r.resultado=null;
  if(r.descripcion&&!r.caption) r.caption=r.descripcion;
  saveReels();
  closeModal('modal-registro');
  showToast('Reel tomado ✓ Tenés '+dias+(dias===1?' día':' días'));
  goTo('kanban');
}

// ---------- vencimientos: -puntos y prenda ----------
// Cada profesional revisa los suyos; el admin revisa los de todos.
function revisarVencimientos(){
  if(!profile) return false;
  const ahora=Date.now(), esAdmin=profile.role==='admin';
  const vencidos=[];
  reels.forEach(r=>{
    if(!r.vence||r.resultado||r.stage==='publicado'||!r.asignadoId) return;
    if(Date.parse(r.vence)>ahora) return;
    if(!esAdmin&&r.asignadoId!==profile.id) return;
    r.resultado='vencido'; r.vencidoEn=new Date(ahora).toISOString();
    const pr=reglasReels.prendas||[];
    if(pr.length){ const p=pr[Math.floor(Math.random()*pr.length)]; r.prenda={texto:p.texto,asignadaEn:r.vencidoEn,cumplida:false}; }
    vencidos.push(r);
  });
  if(!vencidos.length) return false;
  saveReels();
  puntosTx(()=>{ vencidos.forEach(r=>addPuntos(r.asignadoId,'reel',-numV(reglasReels.puntosFallo),'Reel vencido: '+r.titulo,'reel:'+r.id+':vencido')); });
  if(!esAdmin) showToast('⚠️ Se venció un reel: −'+reglasReels.puntosFallo+' ⭐ y una prenda');
  return true;
}

function marcarPublicado(){
  const cap=document.getElementById('ed-caption'); if(cap) editReel.caption=cap.value;
  revisarVencimientos();
  const r=reels.find(x=>x.id===editReel.id)||editReel;
  const tarde=!!r.vence&&(r.resultado==='vencido'||Date.parse(r.vence)<Date.now());
  r.stage='publicado';
  r.fechaPublicado=new Date().toISOString();
  if(r.vence&&!r.fecha) r.fecha=hoyStr(); // para que cuente en el tramo de la quincena en que se publica
  let msg;
  if(r.vence&&tarde){ r.resultado='vencido'; msg='Publicado fuera de plazo — sin puntos'; }
  else {
    if(r.vence) r.resultado='cumplido';
    const pts=numV(reglasReels.puntosOk)||50;
    puntosTx(()=>addPuntos(profile.id,'reel',pts,'Reel publicado a tiempo: '+r.titulo,'reel:'+r.id+':ok'));
    msg='¡Publicado! 🎉 +'+pts+' puntos ⭐';
  }
  editReel=r;
  saveReels();
  renderEditor();
  showToast(msg);
}

// ---------- lado profesional: banco, detalle, kanban ----------
let bancoQ='';
let kanbanVista='mios';
function badgesReel(r){
  const u=safeUrl(r.url), p=u?plataformaUrl(u):null;
  return [r.estructura?`<span class="bdg">${escH(r.estructura)}</span>`:'', p?`<span class="bdg">${p.e} ${escH(p.n)}</span>`:'', r.plazoDias?`<span class="bdg">⏱ ${r.plazoDias}d</span>`:''].join('');
}
function renderBancoProf(){
  revisarVencimientos();
  const body=document.getElementById('banco-body');
  if(!body) return;
  const q=bancoQ.trim().toLowerCase();
  const disp=reels.filter(r=>!r.asignado).filter(r=>!q||[r.titulo,r.hook,r.estructura].join(' ').toLowerCase().includes(q));
  const total=reels.filter(r=>!r.asignado).length;
  const dias=numV(reglasReels.plazoDias)||3;
  body.innerHTML=`
    <div class="card" style="margin:14px 0 12px;font-size:12px;color:var(--muted2);line-height:1.6">Elegí un reel, mirá todo el detalle y decidí si lo tomás. Una vez que lo tomás pasa a tu <b style="color:var(--text)">Tablero</b> con un plazo (por defecto <b style="color:var(--text)">${dias} días</b>): si lo publicás a tiempo sumás <b style="color:#34d399">+${reglasReels.puntosOk} ⭐</b>; si no llegás perdés <b style="color:#f472b6">−${reglasReels.puntosFallo} ⭐</b> y te toca una prenda.</div>
    ${total>6?`<input type="search" id="banco-q" placeholder="Buscar reel..." value="${escH(bancoQ)}" oninput="bancoQ=this.value;renderBancoProf();document.getElementById('banco-q').focus();" style="width:100%;background:var(--s1);border:1.5px solid var(--border2);border-radius:12px;padding:12px 14px;color:var(--text);font-family:var(--font);font-size:14px;margin-bottom:12px;outline:none"/>`:''}
    <div class="sec-hdr" style="margin-bottom:10px"><span class="sec-title">Disponibles (${disp.length}${q?' de '+total:''})</span></div>
    ${disp.length?disp.map(r=>`<div class="card reel-card" onclick="abrirDetalleReel('${r.id}')" style="cursor:pointer">
      <div style="display:flex;align-items:flex-start;gap:10px">
        <div style="font-size:26px;line-height:1">${r.emoji||'🎬'}</div>
        <div style="flex:1;min-width:0">
          <div style="font-size:14px;font-weight:800;margin-bottom:4px">${escH(r.titulo)}</div>
          ${r.hook?`<div style="font-size:12px;color:var(--muted2);line-height:1.5;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">🎣 ${escH(r.hook)}</div>`:''}
          <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px">${badgesReel(r)}</div>
        </div>
        <div style="font-size:18px;color:var(--muted);align-self:center">›</div>
      </div></div>`).join(''):`<div class="empty"><div class="e-icon">📝</div><p>${total?'No hay reels que coincidan.':'Todavía no hay reels en el banco.'}</p></div>`}`;
}

function bloqueReel(icono,titulo,texto,color){
  if(!texto) return '';
  return `<div class="card" style="margin-bottom:10px"><div style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:${color};margin-bottom:6px">${icono} ${titulo}</div><div style="font-size:13px;line-height:1.6;white-space:pre-line">${escH(texto)}</div></div>`;
}
function bloqueInspo(r){
  const u=safeUrl(r.url); if(!u) return '';
  const p=plataformaUrl(u);
  return `<a href="${escH(u)}" target="_blank" rel="noopener noreferrer" style="display:flex;align-items:center;gap:10px;background:rgba(74,19,107,.1);border:1.5px solid rgba(74,19,107,.35);border-radius:14px;padding:12px 14px;margin-bottom:10px;text-decoration:none;color:var(--text)">
    <span style="font-size:22px">${p.e}</span><span style="flex:1"><span style="display:block;font-size:13px;font-weight:800">Ver inspiración en ${escH(p.n)}</span><span style="display:block;font-size:11px;color:var(--muted2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:250px">${escH(u)}</span></span><span style="color:var(--accent);font-weight:800">↗</span></a>`;
}
function abrirDetalleReel(id){
  const r=reels.find(x=>x.id===id); if(!r) return;
  const dias=numV(r.plazoDias)||numV(reglasReels.plazoDias)||3;
  const color=r.color||profile.color;
  const c=document.getElementById('registro-content');
  const libre=!r.asignado;
  c.innerHTML=`<div style="display:flex;align-items:center;gap:8px;margin-bottom:12px"><div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:${color}">${escH(r.estructura||'Reel')}</div><button onclick="closeModal('modal-registro')" style="margin-left:auto;background:var(--s3);border:none;color:var(--muted2);font-size:18px;width:32px;height:32px;border-radius:50%;cursor:pointer">×</button></div>
    <div style="font-size:20px;font-weight:900;margin-bottom:12px;line-height:1.25">${r.emoji||'🎬'} ${escH(r.titulo)}</div>
    ${bloqueInspo(r)}
    ${bloqueReel('🎣','Hook (primeros 3 segundos)',r.hook,color)}
    ${bloqueReel('📹','Desarrollo',r.desarrollo,color)}
    ${bloqueReel('📣','CTA',r.cta,color)}
    ${bloqueReel('📝','Descripción para publicar',r.descripcion,color)}
    ${libre?`<div style="background:var(--s2);border-radius:12px;padding:12px 14px;font-size:12px;line-height:1.7;margin:4px 0 14px">
      ⏱ Plazo: <b>${dias} ${dias===1?'día':'días'}</b> desde que lo tomás<br>✅ A tiempo: <b style="color:#34d399">+${reglasReels.puntosOk} ⭐</b><br>❌ Si no llegás: <b style="color:#f472b6">−${reglasReels.puntosFallo} ⭐</b> y una prenda</div>
      <div style="display:flex;gap:8px"><button onclick="closeModal('modal-registro')" style="flex:1;padding:14px;border-radius:12px;border:1.5px solid var(--border2);background:transparent;color:var(--muted2);font-family:var(--font);font-size:14px;font-weight:700;cursor:pointer">Ahora no</button>
      <button onclick="tomarReel('${r.id}')" style="flex:2;padding:14px;border-radius:12px;border:none;background:${profile.color};color:#fff;font-family:var(--font);font-size:14px;font-weight:800;cursor:pointer">✓ Lo tomo</button></div>`
    :`<div style="text-align:center;font-size:13px;color:var(--muted2);padding:10px">Lo tiene ${escH(r.asignado)}</div>`}`;
  openModal('modal-registro');
}

function bannerPlazoEditor(r){
  if(!r.vence) return '';
  const p=estadoPlazo(r);
  if(r.resultado==='cumplido') return `<div style="background:rgba(52,211,153,.1);border:1px solid rgba(52,211,153,.25);border-radius:12px;padding:10px 14px;margin-bottom:12px;font-size:12px;color:#34d399;font-weight:700">✅ Cumpliste el plazo · +${reglasReels.puntosOk} ⭐</div>`;
  if(p&&p.vencido||r.resultado==='vencido') return `<div style="background:rgba(244,114,182,.1);border:1px solid rgba(244,114,182,.3);border-radius:12px;padding:10px 14px;margin-bottom:12px;font-size:12px;color:#f472b6;font-weight:700">⚠️ Plazo vencido · −${reglasReels.puntosFallo} ⭐${r.prenda?'<br>Prenda: '+escH(r.prenda.texto):''}</div>`;
  if(!p) return '';
  return `<div style="background:${p.color}14;border:1px solid ${p.color}40;border-radius:12px;padding:10px 14px;margin-bottom:12px;font-size:12px;font-weight:700;color:${p.color}">⏱ Te quedan ${p.texto} para publicarlo · +${reglasReels.puntosOk} ⭐ si llegás</div>`;
}

function renderKanban(){
  revisarVencimientos();
  const body=document.getElementById('kanban-body');
  const etapas=Object.entries(STAGES);
  const lista=reels.filter(r=>r.asignado&&(kanbanVista==='equipo'||esMio(r)));
  const tog=`<div style="display:flex;gap:6px">${[['mios','Mis reels'],['equipo','Todo el equipo']].map(([v,l])=>`<button onclick="kanbanVista='${v}';renderKanban()" style="padding:7px 14px;border-radius:20px;border:1.5px solid ${kanbanVista===v?'var(--accent)':'var(--border2)'};background:${kanbanVista===v?'rgba(74,19,107,.15)':'transparent'};color:${kanbanVista===v?'var(--accent)':'var(--muted2)'};font-family:var(--font);font-size:12px;font-weight:700;cursor:pointer">${l}</button>`).join('')}<button onclick="goTo('banco')" style="margin-left:auto;padding:7px 14px;border-radius:20px;border:none;background:var(--accent);color:#fff;font-family:var(--font);font-size:12px;font-weight:700;cursor:pointer">📝 Banco</button></div>`;
  body.innerHTML=etapas.map(([key,s])=>{
    const cols=lista.filter(r=>r.stage===key);
    return `<div class="kanban-col">
      <div class="kanban-col-hdr"><div style="width:8px;height:8px;border-radius:50%;background:${s.c}"></div>${s.l} <span style="color:var(--muted)">${cols.length}</span></div>
      ${cols.map(r=>`<div class="kanban-card" onclick="abrirEditor('${r.id}')" ${estadoPlazo(r)&&estadoPlazo(r).vencido?'style="border-color:rgba(244,114,182,.5)"':''}>
        <div class="kc-titulo">${r.emoji||''} ${escH(r.titulo)}</div>
        <div class="kc-sub">${escH(r.asignado||'')}</div>
        ${chipPlazo(r)?`<div style="margin-top:6px">${chipPlazo(r)}</div>`:''}
        ${r.resultado==='cumplido'?'<div style="margin-top:6px;font-size:10px;font-weight:800;color:#34d399">✅ A tiempo</div>':''}
      </div>`).join('')}
    </div>`;
  }).join('');
  document.getElementById('kanban-tools').innerHTML=tog;
}

// ---------- lado admin: banco ----------
let adminBancoFiltro='disp', adminBancoQ='';
function estadoReel(r){ if(!r.asignado) return 'disp'; if(r.stage==='publicado') return 'pub'; if(r.resultado==='vencido'||(estadoPlazo(r)&&estadoPlazo(r).vencido)) return 'venc'; return 'curso'; }
function renderAdminBanco(body){
  revisarVencimientos();
  const del=reels.filter(r=>r.titulo);
  const n={disp:0,curso:0,venc:0,pub:0};
  del.forEach(r=>n[estadoReel(r)]++);
  const q=adminBancoQ.trim().toLowerCase();
  const lista=del.filter(r=>(adminBancoFiltro==='todos'||estadoReel(r)===adminBancoFiltro)&&(!q||[r.titulo,r.hook,r.asignado,r.estructura].join(' ').toLowerCase().includes(q)));
  const chips=[['disp','Disponibles'],['curso','En curso'],['venc','Vencidos'],['pub','Publicados'],['todos','Todos']];
  body.innerHTML+=`
    <div style="display:flex;gap:8px;margin:6px 0 12px">
      <button onclick="abrirFormReel()" class="btn btn-primary" style="flex:1;margin:0">+ Reel nuevo</button>
      <button onclick="abrirImportReels()" class="btn btn-ghost" style="flex:1;margin:0">📥 Cargar varios</button>
    </div>
    <div class="adm-chips sm" style="margin-bottom:10px">${chips.map(([k,l])=>`<button class="${adminBancoFiltro===k?'on':''}" onclick="adminBancoFiltro='${k}';renderAdmin()">${l}${k!=='todos'?' ('+n[k]+')':' ('+del.length+')'}</button>`).join('')}</div>
    ${del.length>8?`<input type="search" id="admbanco-q" placeholder="Buscar por título, hook o persona..." value="${escH(adminBancoQ)}" oninput="adminBancoQ=this.value;renderAdmin();var e=document.getElementById('admbanco-q');e.focus();e.setSelectionRange(e.value.length,e.value.length);" style="width:100%;background:var(--s1);border:1.5px solid var(--border2);border-radius:12px;padding:11px 14px;color:var(--text);font-family:var(--font);font-size:13px;margin-bottom:10px;outline:none"/>`:''}
    ${lista.length?lista.map(r=>{
      const est=estadoReel(r);
      const col={disp:'#4A136B',curso:'#fbbf24',venc:'#f472b6',pub:'#34d399'}[est];
      const lbl={disp:'Disponible',curso:'En curso',venc:'Vencido',pub:'Publicado'}[est];
      return `<div class="prof-card" style="margin-bottom:8px;padding:12px 14px">
        <div style="display:flex;align-items:flex-start;gap:10px">
          <div style="flex:1;min-width:0">
            <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:4px"><span style="font-size:10px;font-weight:800;padding:2px 8px;border-radius:8px;background:${col}22;color:${col}">${lbl}</span>${badgesReel(r)}</div>
            <div style="font-size:14px;font-weight:700;margin-bottom:3px">${escH(r.titulo)}</div>
            ${r.hook?`<div style="font-size:12px;color:var(--muted2);line-height:1.4;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">🎣 ${escH(r.hook)}</div>`:''}
            ${r.asignado?`<div style="font-size:11px;color:var(--muted2);margin-top:4px">👤 ${escH(r.asignado)}${r.vence&&est==='curso'?' · vence '+fmtFechaHora(r.vence):''}${r.prenda?' · 🎽 '+escH(r.prenda.texto)+(r.prenda.cumplida?' (cumplida)':''):''}</div>`:''}
          </div>
          <div style="display:flex;gap:2px;flex-shrink:0">
            <button onclick="abrirFormReel('${r.id}')" title="Editar" style="background:none;border:none;color:var(--muted2);font-size:15px;cursor:pointer;padding:4px 6px">✏️</button>
            <button onclick="borrarReelBanco('${r.id}')" title="Borrar" style="background:none;border:none;color:var(--muted);font-size:18px;cursor:pointer;padding:0 6px">×</button>
          </div>
        </div></div>`;}).join(''):`<div style="text-align:center;color:var(--muted);font-size:13px;padding:24px">${del.length?'No hay reels en este filtro':'Sin reels cargados todavía. Usá "+ Reel nuevo" o "📥 Cargar varios".'}</div>`}`;
}

const inpCss='width:100%;background:var(--s2);border:1.5px solid var(--border2);border-radius:10px;padding:10px 12px;color:var(--text);font-family:var(--font);font-size:13px;outline:none';
function abrirFormReel(id){
  const r=id?reels.find(x=>x.id===id):null;
  const v=(k)=>escH(r?(r[k]==null?'':r[k]):'');
  const c=document.getElementById('registro-content');
  c.innerHTML=`<div style="display:flex;align-items:center;gap:8px;margin-bottom:14px"><div class="modal-title" style="margin:0">${r?'Editar reel':'Reel nuevo'}</div><button onclick="closeModal('modal-registro')" style="margin-left:auto;background:var(--s3);border:none;color:var(--muted2);font-size:18px;width:32px;height:32px;border-radius:50%;cursor:pointer">×</button></div>
    <input type="hidden" id="bk-id" value="${r?r.id:''}"/>
    <div class="field"><label>Título</label><input id="bk-titulo" placeholder="Título del reel" value="${v('titulo')}"/></div>
    <div class="field" style="margin-top:8px"><label>Link de inspiración (Instagram, TikTok...)</label><input id="bk-url" type="url" placeholder="https://www.instagram.com/reel/..." value="${v('url')}"/></div>
    <div class="field" style="margin-top:8px"><label>Hook (primeros 3 seg)</label><textarea id="bk-hook" rows="2" style="${inpCss}">${v('hook')}</textarea></div>
    <div class="field" style="margin-top:8px"><label>Desarrollo / body</label><textarea id="bk-desarrollo" rows="4" style="${inpCss}">${v('desarrollo')}</textarea></div>
    <div class="field" style="margin-top:8px"><label>CTA</label><textarea id="bk-cta" rows="2" style="${inpCss}">${v('cta')}</textarea></div>
    <div class="field" style="margin-top:8px"><label>Descripción para publicar</label><textarea id="bk-descripcion" rows="3" style="${inpCss}">${v('descripcion')}</textarea></div>
    <div style="display:flex;gap:8px;margin-top:8px">
      <div class="field" style="flex:1"><label>Estructura (opcional)</label><select id="bk-estructura" style="${inpCss}"><option value="">—</option>${ESTRUCTURAS_REEL.map(o=>`<option value="${o}" ${r&&r.estructura===o?'selected':''}>${o}</option>`).join('')}</select></div>
      <div class="field" style="flex:1"><label>Plazo en días (vacío = ${reglasReels.plazoDias})</label><input id="bk-plazo" type="number" min="1" placeholder="${reglasReels.plazoDias}" value="${r&&r.plazoDias&&!r.asignado?r.plazoDias:''}"/></div>
    </div>
    <button class="btn btn-primary" onclick="guardarReelBanco()" style="margin-top:14px">${r?'Guardar cambios':'Agregar al banco'}</button>`;
  openModal('modal-registro');
}
function guardarReelBanco(){
  const val=(id)=>(document.getElementById(id)?.value||'').trim();
  const titulo=val('bk-titulo');
  if(!titulo){ showToast('Falta el título'); return; }
  const urlRaw=val('bk-url'); const url=safeUrl(urlRaw);
  if(urlRaw&&!url){ showToast('El link no es válido'); return; }
  const campos={titulo, url, hook:val('bk-hook'), desarrollo:val('bk-desarrollo'), cta:val('bk-cta'), descripcion:val('bk-descripcion'), estructura:val('bk-estructura')};
  const plazo=parseInt(val('bk-plazo'))||0;
  const id=val('bk-id');
  if(id){
    const r=reels.find(x=>x.id===id); if(!r) return;
    Object.assign(r,campos);
    if(!r.asignado) r.plazoDias=plazo||null;
    showToast('Reel actualizado ✓');
  } else {
    const colores=['#4A136B','#f472b6','#34d399','#fbbf24','#60a5fa','#fb923c'];
    reels.unshift({id:Date.now().toString(), ...campos, plazoDias:plazo||null, emoji:'🎬', color:colores[Math.floor(Math.random()*colores.length)], stage:'guion', asignado:null, tomas:[], creado:new Date().toISOString()});
    showToast('Reel agregado al banco ✓');
  }
  saveReels();
  closeModal('modal-registro');
  renderAdmin();
}
async function borrarReelBanco(id){
  const r=reels.find(x=>x.id===id); if(!r) return;
  const extra=r.asignado&&r.stage!=='publicado'?'\nLo tiene '+r.asignado+' en curso.':'';
  if(!await uiConfirm('¿Borrar este reel?',r.titulo+extra)) return;
  reels=reels.filter(x=>x.id!==id);
  if(!reelsBorrados.includes(id)) reelsBorrados.push(id);
  saveReels();
  renderAdmin();
}

// ---------- carga masiva ----------
function parseTabla(txt){
  const t=txt.replace(/\r\n?/g,'\n').replace(/^﻿/,'').trim(); if(!t) return [];
  const p1=t.split('\n')[0];
  const delim=p1.includes('\t')?'\t':(p1.split(';').length>p1.split(',').length?';':',');
  const rows=[]; let row=[], cell='', inQ=false;
  for(let i=0;i<t.length;i++){
    const ch=t[i];
    if(inQ){ if(ch==='"'){ if(t[i+1]==='"'){ cell+='"'; i++; } else inQ=false; } else cell+=ch; }
    else if(ch==='"'&&cell==='') inQ=true;
    else if(ch===delim){ row.push(cell); cell=''; }
    else if(ch==='\n'){ row.push(cell); rows.push(row); row=[]; cell=''; }
    else cell+=ch;
  }
  row.push(cell); rows.push(row);
  return rows.filter(r=>r.some(x=>x.trim()));
}
function reelsDeTabla(txt){
  let rows=parseTabla(txt);
  if(rows.length){ const h=(rows[0][0]||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').trim(); if(h==='titulo'||h==='title') rows=rows.slice(1); }
  const validos=[]; let omitidos=0, linkMalo=0;
  rows.forEach(c=>{
    const g=(i)=>(c[i]||'').trim();
    if(!g(0)){ omitidos++; return; }
    const urlRaw=g(5), url=safeUrl(urlRaw); if(urlRaw&&!url) linkMalo++;
    validos.push({titulo:g(0),hook:g(1),desarrollo:g(2),cta:g(3),descripcion:g(4),url,estructura:g(6),plazoDias:parseInt(g(7))||null});
  });
  return {validos,omitidos,linkMalo};
}
function abrirImportReels(){
  const c=document.getElementById('registro-content');
  c.innerHTML=`<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px"><div class="modal-title" style="margin:0">Cargar varios reels</div><button onclick="closeModal('modal-registro')" style="margin-left:auto;background:var(--s3);border:none;color:var(--muted2);font-size:18px;width:32px;height:32px;border-radius:50%;cursor:pointer">×</button></div>
    <div style="font-size:12px;color:var(--muted2);line-height:1.6;margin-bottom:10px">Armalos en una planilla (Excel o Google Sheets) con estas columnas, en este orden, y pegalos acá o subí el archivo CSV:<br><b style="color:var(--text)">Título · Hook · Desarrollo · CTA · Descripción · Link · Estructura · Plazo (días)</b><br>Solo el título es obligatorio.</div>
    <div style="display:flex;gap:8px;margin-bottom:10px">
      <button onclick="descargarPlantillaReels()" class="btn btn-ghost" style="flex:1;margin:0;padding:10px;font-size:12px">⬇ Plantilla CSV</button>
      <label class="btn btn-ghost" style="flex:1;margin:0;padding:10px;font-size:12px;text-align:center;cursor:pointer">📂 Subir archivo<input type="file" accept=".csv,.tsv,.txt" style="display:none" onchange="importReelsArchivo(this)"/></label>
    </div>
    <textarea id="imp-txt" rows="7" placeholder="O pegá acá las filas copiadas de la planilla..." oninput="previewImportReels()" style="${inpCss};min-height:130px"></textarea>
    <div id="imp-prev" style="font-size:12px;color:var(--muted2);margin:10px 0"></div>
    <button id="imp-btn" class="btn btn-primary" onclick="confirmarImportReels()" style="margin-top:4px" disabled>Importar</button>`;
  openModal('modal-registro');
}
function importReelsArchivo(inp){
  const f=inp.files&&inp.files[0]; if(!f) return;
  const rd=new FileReader();
  rd.onload=()=>{ document.getElementById('imp-txt').value=String(rd.result||''); previewImportReels(); };
  rd.readAsText(f,'utf-8');
}
function previewImportReels(){
  const txt=document.getElementById('imp-txt')?.value||'';
  const {validos,omitidos,linkMalo}=reelsDeTabla(txt);
  const ya=new Set(reels.map(r=>(r.titulo||'').trim().toLowerCase()));
  const repetidos=validos.filter(v=>ya.has(v.titulo.toLowerCase())).length;
  const nuevos=validos.length-repetidos;
  const prev=document.getElementById('imp-prev'), btn=document.getElementById('imp-btn');
  if(!txt.trim()){ prev.textContent=''; btn.disabled=true; btn.textContent='Importar'; return; }
  prev.innerHTML=`<b style="color:var(--text)">${nuevos}</b> reels nuevos para importar${omitidos?` · ${omitidos} filas sin título (se saltean)`:''}${linkMalo?` · <span style="color:#fbbf24">${linkMalo} links no válidos (se cargan sin link)</span>`:''}${repetidos?` · <span style="color:#fbbf24">${repetidos} ya existen con el mismo título (se saltean)</span>`:''}${validos.length?'<div style="margin-top:6px;color:var(--muted)">'+validos.slice(0,3).map(v=>'• '+escH(v.titulo)).join('<br>')+(validos.length>3?'<br>…':'')+'</div>':''}`;
  btn.disabled=!nuevos; btn.textContent=nuevos?'Importar '+nuevos+' reels':'Importar';
}
function confirmarImportReels(){
  const ya=new Set(reels.map(r=>(r.titulo||'').trim().toLowerCase()));
  const validos=reelsDeTabla(document.getElementById('imp-txt')?.value||'').validos.filter(v=>!ya.has(v.titulo.toLowerCase()));
  if(!validos.length) return;
  const colores=['#4A136B','#f472b6','#34d399','#fbbf24','#60a5fa','#fb923c'];
  const base=Date.now();
  const nuevos=validos.map((v,i)=>({id:base+'-'+i, ...v, emoji:'🎬', color:colores[i%colores.length], stage:'guion', asignado:null, tomas:[], creado:new Date(base-i).toISOString()}));
  reels=[...nuevos,...reels];
  saveReels();
  closeModal('modal-registro');
  adminBancoFiltro='disp';
  showToast(nuevos.length+' reels cargados al banco ✓');
  renderAdmin();
}
function descargarPlantillaReels(){
  const filas=[['Título','Hook','Desarrollo','CTA','Descripción','Link','Estructura','Plazo (días)'],
    ['3 errores al cortarte el pelo','¿Sabías que el 90% se corta mal el pelo?','Mostrar los 3 errores con ejemplos cortos','Reservá tu turno por el link de la bio','Tips de corte para que te dure más 💈 #barberia','https://www.instagram.com/reel/XXXXXXXX/','Lista',3],
    ['Antes y después de un fade','Mirá este cambio en 30 segundos','Plano fijo del antes, corte en timelapse, plano del después','Escribinos para tu turno','Fade + barba. Turnos por DM','','Problema a Solucion','']];
  const csv='﻿'+filas.map(f=>f.map(x=>'"'+String(x).replace(/"/g,'""')+'"').join(';')).join('\r\n');
  const a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
  a.download='plantilla-reels.csv';
  document.body.appendChild(a); a.click(); a.remove();
}

// ---------- lado admin: reglas y prendas ----------
function renderAdminReglasReels(body){
  revisarVencimientos();
  const rg=reglasReels;
  const prendas=reels.filter(r=>r.prenda).sort((a,b)=>(a.prenda.cumplida?1:0)-(b.prenda.cumplida?1:0)||String(b.prenda.asignadaEn).localeCompare(String(a.prenda.asignadaEn)));
  const fila=(l,v,fn)=>`<div class="ln"><span>${l}</span><span style="display:flex;align-items:center;gap:10px"><b>${v}</b><button class="lnk" onclick="${fn}">Cambiar</button></span></div>`;
  body.innerHTML+=`
    <div class="sec-title" style="margin:6px 0 10px">⚙️ Reglas de los reels</div>
    <div class="card" style="margin-bottom:14px">
      ${fila('Plazo para publicar (desde que lo toman)',rg.plazoDias+(rg.plazoDias==1?' día':' días'),"editarReglaReel('plazoDias')")}
      ${fila('Puntos si lo publican a tiempo','+'+rg.puntosOk+' ⭐',"editarReglaReel('puntosOk')")}
      ${fila('Puntos que pierden si no llegan','−'+rg.puntosFallo+' ⭐',"editarReglaReel('puntosFallo')")}
      <div style="font-size:11px;color:var(--muted);margin-top:8px;line-height:1.5">Cada reel puede tener su propio plazo al cargarlo. Si no llegan, además se les asigna una prenda al azar de esta lista.</div>
    </div>
    <div class="sec-hdr" style="margin-bottom:8px"><span class="sec-title">🎽 Lista de prendas</span><button class="lnk" onclick="agregarPrendaReel()">+ Agregar</button></div>
    <div class="card" style="margin-bottom:14px">
      ${(rg.prendas||[]).length?rg.prendas.map(p=>`<div class="ln"><span>${escH(p.texto)}</span><button onclick="borrarPrendaReel('${p.id}')" style="background:none;border:none;color:var(--muted);font-size:18px;cursor:pointer">×</button></div>`).join(''):'<div style="font-size:12px;color:var(--muted);padding:6px">Sin prendas: si no llegan solo pierden los puntos.</div>'}
    </div>
    <div class="sec-title" style="margin-bottom:8px">Prendas asignadas (${prendas.filter(r=>!r.prenda.cumplida).length} pendientes)</div>
    ${prendas.length?prendas.map(r=>`<div class="prof-card" style="margin-bottom:8px;padding:12px 14px;${r.prenda.cumplida?'opacity:.6':'border-color:rgba(244,114,182,.35)'}">
      <div style="display:flex;align-items:center;gap:10px">
        <div style="flex:1"><div style="font-size:13px;font-weight:800">🎽 ${escH(r.prenda.texto)}</div>
          <div style="font-size:11px;color:var(--muted2);margin-top:3px">${escH(r.asignado||'')} · por no entregar "${escH(r.titulo)}" a tiempo · ${fmtFechaHora(r.prenda.asignadaEn)}</div></div>
        ${r.prenda.cumplida?'<span style="font-size:11px;font-weight:800;color:#34d399">✓ Cumplida</span>':`<button onclick="cumplirPrendaReel('${r.id}')" style="padding:8px 12px;border-radius:10px;border:none;background:#34d399;color:#0b0b10;font-family:var(--font);font-size:12px;font-weight:800;cursor:pointer;white-space:nowrap">Marcar cumplida</button>`}
      </div></div>`).join(''):'<div style="text-align:center;color:var(--muted);font-size:13px;padding:14px">Todavía nadie tiene prendas 🎉</div>'}`;
}
async function editarReglaReel(k){
  const nom={plazoDias:['Plazo para publicar','Días desde que toman el reel'],puntosOk:['Puntos por publicar a tiempo','Puntos que suman'],puntosFallo:['Puntos por no cumplir','Puntos que pierden']}[k];
  const v=await uiPrompt(nom[0],{msg:nom[1],label:'Cantidad',type:'number',value:reglasReels[k],ok:'Guardar'});
  const n=parseInt(v);
  if(v===null||!(n>0)) return;
  reglasReels[k]=n; saveReglasReels(); renderAdmin();
}
async function agregarPrendaReel(){
  const t=await uiPrompt('Nueva prenda',{msg:'Lo que tiene que hacer quien no llegue a tiempo.',label:'Prenda',placeholder:'Ej: Traer el desayuno el lunes',ok:'Agregar'});
  if(!t||!t.trim()) return;
  reglasReels.prendas=[...(reglasReels.prendas||[]),{id:Date.now().toString(),texto:t.trim()}];
  saveReglasReels(); renderAdmin();
}
async function borrarPrendaReel(id){
  if(!await uiConfirm('¿Sacar esta prenda de la lista?','Las que ya se asignaron no cambian.')) return;
  reglasReels.prendas=(reglasReels.prendas||[]).filter(p=>p.id!==id);
  saveReglasReels(); renderAdmin();
}
function cumplirPrendaReel(id){
  const r=reels.find(x=>x.id===id); if(!r||!r.prenda) return;
  r.prenda={...r.prenda,cumplida:true,cumplidaEn:new Date().toISOString()};
  saveReels(); showToast('Prenda marcada como cumplida ✓'); renderAdmin();
}

