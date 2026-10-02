// ============ HORARIOS ============
const DIAS_SEMANA = [
  {key:'lun',label:'Lunes'}, {key:'mar',label:'Martes'}, {key:'mie',label:'Miércoles'},
  {key:'jue',label:'Jueves'}, {key:'vie',label:'Viernes'}, {key:'sab',label:'Sábado'}, {key:'dom',label:'Domingo'},
];
function defaultHorario(){
  const h={}; DIAS_SEMANA.forEach(d=>{ h[d.key]={activo: d.key!=='dom', tramos:[{inicio:'10:00',fin:'20:00'}]}; }); return h;
}
// Un día puede tener más de un tramo (ej. 9 a 13 y 16 a 20, con descanso en el medio -- pedido de Ivo,
// 1/10/2026). Formato viejo (antes de los tramos): {activo,inicio,fin} sin array -- se sigue leyendo bien,
// tratado como un único tramo, así no hace falta migrar nada ya guardado.
function tramosDeDia(d){
  if(!d) return [];
  if(Array.isArray(d.tramos)&&d.tramos.length) return d.tramos;
  if(d.inicio&&d.fin) return [{inicio:d.inicio,fin:d.fin}];
  return [];
}
let horarioData = defaultHorario(); // horario laboral del profesional logueado
let horarioEditando = false;

// Horario laboral de CADA profesional (no solo el propio), para que la reserva de horarios reales (interna y
// pública) sepa qué días/horas trabaja de verdad cada uno. Hasta acá se guardaba y se mostraba en "Mi perfil"
// pero nada lo leía al armar los horarios ofrecidos — se ofrecía cualquier hora del día como libre para
// cualquier profesional, sin filtrar. Bug crítico reportado por Ivo el día del lanzamiento (1/10/2026).
let horariosProfs={};
async function loadHorariosProfs(){
  allUsers.filter(u=>esProf(u)).forEach(u=>{ try{ const c=JSON.parse(localStorage.getItem('luffy_horario_'+u.id)||'null'); if(c) horariosProfs[u.id]=c; }catch(e){} });
  if(!DB) return;
  const profs=allUsers.filter(u=>esProf(u));
  await Promise.all(profs.map(u=>Promise.resolve(DB.doc('luffy/horario_'+u.id).get()).then(r=>{ if(r){ horariosProfs[u.id]=r; try{localStorage.setItem('luffy_horario_'+u.id,JSON.stringify(r));}catch(e){} } }).catch(()=>{})));
}
// Si el profesional todavía no guardó nunca su horario en "Mi perfil" (hoy, el caso más común: esto recién
// empieza a importar), se usa el mismo horario por defecto que ya se le muestra ahí (lun a sáb 10 a 20) en vez
// de no filtrar nada — mejor acotar a algo razonable que seguir ofreciendo cualquier hora del día.
function profTrabajaEn(profId,fecha,desdeMin,hastaMin){
  const h=horariosProfs[profId]||defaultHorario();
  const dia=DIAS_SEMANA[(new Date(fecha+'T00:00:00').getDay()+6)%7].key; // getDay(): 0=domingo; DIAS_SEMANA arranca en lunes
  const d=h[dia]; if(!d||!d.activo) return false;
  return tramosDeDia(d).some(t=>desdeMin>=agMin(t.inicio)&&hastaMin<=agMin(t.fin));
}
// HTML de un día del editor de horario (con tramos), compartido entre "Mi perfil" (14-onboarding-social.js) y
// el editor de Admin (15-admin-panel.js) para no duplicar el marcado. onToggleAttr/onCampoAttr(i,campo)/
// onAgregarAttr/onQuitarAttr(i) son los strings de onclick/onchange ya armados por quien llama (cada editor
// apunta a su propio estado en memoria).
function htmlDiaHorarioTramos(label,diaData,onToggleAttr,onCampoAttr,onAgregarAttr,onQuitarAttr){
  const tramos=tramosDeDia(diaData);
  return `<div style="padding:8px 0;border-bottom:1px solid var(--border)">
    <label style="display:flex;align-items:center;gap:6px;font-size:12px;font-weight:600;cursor:pointer">
      <input type="checkbox" ${diaData&&diaData.activo?'checked':''} onchange="${onToggleAttr}"/> ${label}
    </label>
    ${diaData&&diaData.activo?`<div style="margin:6px 0 0 24px">${tramos.map((t,i)=>`<div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">
      <input type="time" value="${t.inicio}" onchange="${onCampoAttr(i,'inicio')}" style="flex:1;min-width:0;background:var(--s2);border:1.5px solid var(--border2);border-radius:8px;padding:6px;color:var(--text);font-family:var(--font);font-size:12px"/>
      <span style="font-size:11px;color:var(--muted2)">a</span>
      <input type="time" value="${t.fin}" onchange="${onCampoAttr(i,'fin')}" style="flex:1;min-width:0;background:var(--s2);border:1.5px solid var(--border2);border-radius:8px;padding:6px;color:var(--text);font-family:var(--font);font-size:12px"/>
      ${tramos.length>1?`<button type="button" onclick="${onQuitarAttr(i)}" style="background:none;border:none;color:#f472b6;font-size:18px;cursor:pointer;padding:0 4px">×</button>`:`<span style="width:26px;flex-shrink:0"></span>`}
    </div>`).join('')}<button type="button" onclick="${onAgregarAttr}" style="background:none;border:none;color:var(--accent2);font-family:var(--font);font-size:11.5px;font-weight:700;cursor:pointer;padding:0">+ agregar otro horario este día (ej. para un descanso)</button></div>`:''}
  </div>`;
}

// Horario sugerido para publicar cada tipo de story — un solo horario global, igual para todo el equipo
const STORY_HORARIOS_DEFAULT = {buenos_dias:'09:00', turnos_libres:'11:00', resultado:'16:00', cierre:'20:00'};
let storyHorarios = {...STORY_HORARIOS_DEFAULT};

function loadStoryHorarios(){
  try{ storyHorarios={...STORY_HORARIOS_DEFAULT, ...JSON.parse(localStorage.getItem('luffy_story_horarios')||'{}')}; }catch(e){}
  if(DB){
    DB.doc('luffy/story_horarios').get().then(r=>{
      const merged=r?{...STORY_HORARIOS_DEFAULT, ...r}:null;
      if(merged&&JSON.stringify(merged)!==JSON.stringify(storyHorarios)){ storyHorarios=merged; try{localStorage.setItem('luffy_story_horarios',JSON.stringify(storyHorarios));}catch(e){} refreshCurrentView(); }
    }).catch(()=>{});
  }
}
function saveStoryHorarios(){
  try{localStorage.setItem('luffy_story_horarios',JSON.stringify(storyHorarios));}catch(e){}
  if(DB){try{DB.doc('luffy/story_horarios').set(storyHorarios);}catch(e){}}
}
async function editarHorariosStories(){
  const v=await uiDialog({title:'Horarios sugeridos de stories',msg:'Formato HH:MM (ej: 12:30)',fields:STORY_TIPOS.map(t=>({label:t.label,value:storyHorarios[t.id]||'',placeholder:'HH:MM'})),ok:'Guardar'});
  if(!v) return;
  STORY_TIPOS.forEach((t,i)=>{ const x=(v[i]||'').trim(); if(/^\d{1,2}:\d{2}$/.test(x)) storyHorarios[t.id]=x; });
  saveStoryHorarios();
  showToast('Horarios de stories actualizados ✓');
  refreshCurrentView();
}

// ---------- Historias de recepcion: 2 cuentas (Inda Barber / Inda Studio) x 2 bloques (mañana / tarde) ----------
// Son las 4 historias predeterminadas, repetidas para cada cuenta. Se tildan una sola vez por dia para todo el equipo de recepcion (clave 'rec').
const STORY_CUENTAS=[{id:'barber',nombre:'Inda Barber',emoji:'💈',color:'#fbbf24'},{id:'studio',nombre:'Inda Studio',emoji:'💅',color:'#f472b6'}];
const STORY_BLOQUES=[{id:'man',label:'Mañana',emoji:'🌅',tipos:['buenos_dias','turnos_libres']},{id:'tar',label:'Tarde',emoji:'🌇',tipos:['resultado','cierre']}];
const STORY_REC_TEXTOS={
  barber:{
    buenos_dias:'Arrancamos el día 💈 Ya estamos en Inda Barber listos para atenderte. Reservá tu turno por DM 👇',
    turnos_libres:'Turnos disponibles para hoy en Inda Barber:\n⏰ [HORA 1]\n⏰ [HORA 2]\n⏰ [HORA 3]\nEscribinos y te reservamos 🙌',
    resultado:'¿Les gusta el resultado? ✨ Este es el trabajo de hoy en Inda Barber. Si querés algo así, reservá tu turno por DM 💈',
    cierre:'Cerramos el día 🙏 ¡Gracias a todos los que pasaron por Inda Barber! Si querés reservar para mañana, escribinos ahora 📩'},
  studio:{
    buenos_dias:'Buenos días desde Inda Studio ✨ Ya estamos listas para consentirte. Reservá tu turno por DM 👇',
    turnos_libres:'Turnos disponibles para hoy en Inda Studio:\n⏰ [HORA 1]\n⏰ [HORA 2]\n⏰ [HORA 3]\nEscribinos y te reservamos 🙌',
    resultado:'Mirá cómo quedó ✨ Este es el trabajo de hoy en Inda Studio. Si querés algo así, reservá tu turno por DM 💅',
    cierre:'Cerramos el día 🙏 ¡Gracias a todas las que pasaron por Inda Studio! Si querés reservar para mañana, escribinos ahora 📩'},
};
let storyRecTextos={};
function loadStoryRecTextos(){
  try{ storyRecTextos=JSON.parse(localStorage.getItem('luffy_story_rec_textos')||'{}'); }catch(e){}
  if(DB){ DB.doc('luffy/stories_rec_textos').get().then(r=>{ const n=r||{}; if(JSON.stringify(n)!==JSON.stringify(storyRecTextos)){ storyRecTextos=n; try{localStorage.setItem('luffy_story_rec_textos',JSON.stringify(n));}catch(e){} refreshCurrentView(); } }).catch(()=>{}); }
}
const storyRecTexto=(cuenta,tipo)=>storyRecTextos[cuenta+'_'+tipo]||STORY_REC_TEXTOS[cuenta][tipo];
const storyRecItems=(bloqueId)=>{ const b=STORY_BLOQUES.find(x=>x.id===bloqueId); return b.tipos.flatMap(tp=>STORY_CUENTAS.map(c=>({id:c.id+'_'+tp,cuenta:c,tipo:STORY_TIPOS.find(t=>t.id===tp),bloque:b}))); };
const storyRecDone=(fecha,id)=>!!(storiesData&&storiesData[fecha]&&storiesData[fecha].rec&&storiesData[fecha].rec[id]&&storiesData[fecha].rec[id].done);
const storyRecHechas=(fecha,bloqueId)=>storyRecItems(bloqueId).filter(i=>storyRecDone(fecha,i.id)).length;

function renderStoriesRec(){
  loadStoriesData();
  const body=document.getElementById('stories-body');
  const hoy=ymdLocal(new Date()); const md=new Date(); md.setDate(md.getDate()+1); const man=ymdLocal(md);
  const dia=(fecha,titulo,esHoy)=>{
    const total=STORY_BLOQUES.reduce((a,b)=>a+storyRecItems(b.id).length,0), hechas=STORY_BLOQUES.reduce((a,b)=>a+storyRecHechas(fecha,b.id),0);
    return `<div style="margin-bottom:22px"><div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.1em;color:${esHoy?'var(--text)':'var(--muted)'};margin-bottom:10px">${titulo} · ${hechas}/${total}</div>
    ${STORY_BLOQUES.map(b=>{ const its=storyRecItems(b.id); const hs=b.tipos.map(t=>storyHorarios[t]).filter(Boolean).join(' y ');
      return `<div style="font-size:12px;font-weight:800;margin:0 0 8px;display:flex;align-items:center;gap:6px">${b.emoji} ${b.label} <span style="color:var(--muted2);font-weight:600">${storyRecHechas(fecha,b.id)}/${its.length}${hs?' · sugeridas '+hs+'hs':''}</span></div>
      ${its.map((it,i)=>{ const ch=(storiesData&&storiesData[fecha]&&storiesData[fecha].rec&&storiesData[fecha].rec[it.id])||{done:false};
        return `<div class="story-card ${ch.done?'done':''}"><div class="story-top"><div class="story-num" style="background:${it.cuenta.color};color:#1a1a1a">${it.cuenta.emoji}</div>
          <div class="story-tipo"><strong>${it.tipo.emoji} ${it.tipo.label}</strong><span style="display:block;color:${it.cuenta.color};font-weight:800">${it.cuenta.nombre}</span><span>${escH(it.tipo.ref)}${storyHorarios[it.tipo.id]?' · Sugerido '+storyHorarios[it.tipo.id]+'hs':''}${ch.done&&ch.por?' · lo subió '+escH(ch.por):''}</span></div>
          <div class="story-check ${ch.done?'done':''}" onclick="toggleStoryRec('${fecha}','${it.id}','${esHoy}')">${ch.done?'✓':''}</div></div>
          <div class="story-texto">${escH(storyRecTexto(it.cuenta.id,it.tipo.id)).replace(/\n/g,'<br>')}<button class="story-copy" onclick="copyStoryRec('${it.id}')">Copiar</button></div></div>`; }).join('')}
      <div style="height:6px"></div>`; }).join('')}</div>`;
  };
  body.innerHTML=dia(hoy,'Hoy',true)+dia(man,'Mañana · para dejarlas listas',false);
}
function copyStoryRec(id){ const it=STORY_BLOQUES.flatMap(b=>storyRecItems(b.id)).find(x=>x.id===id); if(it) copyText(storyRecTexto(it.cuenta.id,it.tipo.id)); }
function toggleStoryRec(fecha,id,esHoy){
  if(!storiesData[fecha]) storiesData[fecha]={};
  if(!storiesData[fecha].rec) storiesData[fecha].rec={};
  const cur=storiesData[fecha].rec[id]||{done:false}; const nuevo=!cur.done;
  storiesData[fecha].rec[id]={done:nuevo,ts:new Date().toISOString(),por:profile.name,porId:profile.id};
  saveStoriesData();
  if(nuevo&&esHoy==='true'){
    const it=STORY_BLOQUES.flatMap(b=>storyRecItems(b.id)).find(x=>x.id===id);
    if(addPuntos(profile.id,'story',ptsDe('story',5),'Story '+it.cuenta.nombre+': '+it.tipo.label,'story:'+fecha+':rec:'+id)!==false) showToast('+'+ptsDe('story',5)+' puntos ⭐');
  }
  renderStoriesRec();
}
function htmlStoriesRecAdmin(){
  const hoy=ymdLocal(new Date());
  const bl=STORY_BLOQUES.map(b=>{ const its=storyRecItems(b.id);
    return `<div style="font-size:11px;font-weight:800;color:var(--muted2);text-transform:uppercase;letter-spacing:.08em;margin:10px 0 2px">${b.emoji} ${b.label} · ${storyRecHechas(hoy,b.id)}/${its.length}</div>`+its.map(i=>{ const c=storiesData&&storiesData[hoy]&&storiesData[hoy].rec&&storiesData[hoy].rec[i.id]; const h=c&&c.ts?new Date(c.ts).toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit'}):'';
      return `<div style="display:flex;align-items:center;gap:8px;padding:7px 0;border-bottom:1px solid var(--border)"><div style="font-size:15px">${i.tipo.emoji}</div><div style="flex:1;font-size:12px">${i.tipo.label} <span style="color:${i.cuenta.color};font-weight:700">· ${i.cuenta.nombre}</span></div>${c&&c.done?`<div style="font-size:11px;color:#34d399;font-weight:700">✓ ${h}${c.por?' · '+escH(c.por):''}</div>`:'<div style="font-size:11px;color:var(--muted)">Pendiente</div>'}</div>`; }).join(''); }).join('');
  return `<div class="prof-card" style="margin-bottom:14px"><div class="pc-hdr"><div class="pc-av" style="background:#4A136B33;border-color:#4A136B">📞</div><div class="pc-info"><strong>Recepción</strong><span>Historias de Inda Barber e Inda Studio · mañana y tarde</span></div></div>${bl}<button class="btn btn-ghost" style="margin-top:10px" onclick="abrirTextosStoriesRec()">✏️ Editar los textos</button></div>`;
}
const taStyle='width:100%;background:var(--s2);border:1.5px solid var(--border2);border-radius:10px;padding:10px;color:var(--text);font-family:var(--font);font-size:13px;resize:vertical';
function abrirTextosStoriesRec(){
  document.getElementById('registro-content').innerHTML=cabeceraModal('Textos de las historias · recepción')+
    `<div style="font-size:11.5px;color:var(--muted2);margin:-4px 0 10px;line-height:1.5">Recepción los copia y los sube tal cual. Usá <b>[HORA 1]</b>, <b>[HORA 2]</b>… donde va cada horario libre.</div>`+
    STORY_CUENTAS.map(c=>`<div style="font-size:12px;font-weight:800;color:${c.color};margin:12px 0 4px">${c.emoji} ${c.nombre}</div>`+STORY_BLOQUES.flatMap(b=>b.tipos.map(tp=>{ const t=STORY_TIPOS.find(x=>x.id===tp); return `<div class="field" style="margin-top:6px"><label>${b.emoji} ${b.label} · ${t.emoji} ${t.label}</label><textarea id="str-${c.id}_${tp}" rows="3" style="${taStyle}">${escH(storyRecTexto(c.id,tp))}</textarea></div>`; })).join('')).join('')+
    `<button class="btn btn-primary" onclick="guardarTextosStoriesRec()" style="margin-top:14px">Guardar</button><button class="btn btn-ghost" onclick="restaurarTextosStoriesRec()" style="margin-top:8px">Volver a los textos originales</button>`;
  openModal('modal-registro');
}
function guardarTextosStoriesRec(restaurar){
  const n={};
  if(!restaurar) STORY_CUENTAS.forEach(c=>STORY_TIPOS.forEach(t=>{ const e=document.getElementById('str-'+c.id+'_'+t.id); if(!e) return; const v=e.value.trim(); if(v&&STORY_REC_TEXTOS[c.id]&&STORY_REC_TEXTOS[c.id][t.id]!==v) n[c.id+'_'+t.id]=v; }));
  storyRecTextos=n; try{localStorage.setItem('luffy_story_rec_textos',JSON.stringify(n));}catch(e){}
  if(DB){ try{ DB.doc('luffy/stories_rec_textos').set(n); }catch(e){} }
  closeModal('modal-registro'); showToast(restaurar?'Textos originales ✓':'Textos guardados ✓'); refreshCurrentView();
}
function restaurarTextosStoriesRec(){ guardarTextosStoriesRec(true); }

// Une dos arboles { fecha: { persona: { item: {done, ts} } } }: en cada casillero gana el cambio mas nuevo.
function mergeTs(t,r){
  let cambio=false;
  Object.keys(r||{}).forEach(k=>{
    const rv=r[k];
    if(!rv||typeof rv!=='object') return;
    if('done' in rv||'ts' in rv){ const lv=t[k]; if(!lv||String(rv.ts||'')>String(lv.ts||'')){ t[k]=rv; cambio=true; } }
    else { if(!t[k]||typeof t[k]!=='object') t[k]={}; if(mergeTs(t[k],rv)) cambio=true; }
  });
  return cambio;
}
function guardarUniendoTs(docPath,localKey,obj){
  try{localStorage.setItem(localKey,JSON.stringify(obj));}catch(e){}
  if(!DB) return;
  const ref=DB.doc(docPath);
  Promise.resolve(ref.get()).then(r=>{
    const cambio=r?mergeTs(obj,r):false;
    if(cambio){ try{localStorage.setItem(localKey,JSON.stringify(obj));}catch(e){} }
    return Promise.resolve(ref.set(obj)).then(()=>{ if(cambio) refreshCurrentView(); });
  }).catch(()=>{ try{ref.set(obj);}catch(e){} });
}
function loadStoriesData(){
  try{storiesData=JSON.parse(localStorage.getItem('luffy_stories')||'{}');}catch(e){storiesData={};}
  if(DB){
    DB.doc('luffy/stories').get().then(r=>{
      if(r&&mergeTs(storiesData,r)){ try{localStorage.setItem('luffy_stories',JSON.stringify(storiesData));}catch(e){} refreshCurrentView(); }
    }).catch(()=>{});
  }
}
function saveStoriesData(){ guardarUniendoTs('luffy/stories','luffy_stories',storiesData); }
function loadPuntosData(){
  try{puntosData=JSON.parse(localStorage.getItem('luffy_puntos')||'{}');}catch(e){puntosData={};}
  try{canjesData=JSON.parse(localStorage.getItem('luffy_canjes')||JSON.stringify(CANJES_DEFAULT));}catch(e){canjesData=[...CANJES_DEFAULT];}
  try{canjesSolicitudes=JSON.parse(localStorage.getItem('luffy_canjes_sol')||'[]');}catch(e){canjesSolicitudes=[];}
  if(DB){
    DB.doc('luffy/puntos').get().then(r=>{
      if(mergePuntos(r)){ persistPuntosLocal(); refreshCurrentView(); }
    }).catch(()=>{});
  }
}
function persistPuntosLocal(){
  try{localStorage.setItem('luffy_puntos',JSON.stringify(puntosData));}catch(e){}
  try{localStorage.setItem('luffy_canjes',JSON.stringify(canjesData));}catch(e){}
  try{localStorage.setItem('luffy_canjes_sol',JSON.stringify(canjesSolicitudes));}catch(e){}
}
const movKey=(m)=>m.uid||(m.ts+'|'+m.tipo+'|'+m.pts+'|'+m.razon);
// Une lo que hay en la nube con lo local: los movimientos se suman (sin repetir), los canjes pendientes toman el estado mas avanzado.
function mergePuntos(remote){
  if(!remote) return false;
  const antes=JSON.stringify({puntosData,canjesData,canjesSolicitudes});
  Object.keys(remote.puntos||{}).forEach(pid=>{
    const rp=remote.puntos[pid]; if(!rp) return;
    const l=puntosData[pid]||(puntosData[pid]={total:0,movimientos:[]});
    if(!l.movimientos) l.movimientos=[];
    const vistos=new Set(l.movimientos.map(movKey));
    (rp.movimientos||[]).forEach(m=>{ if(!vistos.has(movKey(m))){ l.movimientos.push(m); vistos.add(movKey(m)); l.total=(l.total||0)+numV(m.pts); } });
    l.movimientos.sort((x,y)=>String(y.ts||'').localeCompare(String(x.ts||'')));
  });
  if(profile&&profile.role!=='admin'&&Array.isArray(remote.canjes)) canjesData=remote.canjes;
  (remote.solicitudes||[]).forEach(rs=>{
    const ls=canjesSolicitudes.find(s=>s.id===rs.id);
    if(!ls) canjesSolicitudes.push(rs);
    else if(ls.estado==='pendiente'&&rs.estado!=='pendiente') Object.assign(ls,rs);
  });
  return antes!==JSON.stringify({puntosData,canjesData,canjesSolicitudes});
}
function savePuntosData(){
  persistPuntosLocal();
  if(!DB) return;
  const ref=DB.doc('luffy/puntos');
  Promise.resolve(ref.get()).then(r=>{
    const cambio=mergePuntos(r);
    if(cambio) persistPuntosLocal();
    return Promise.resolve(ref.set({puntos:puntosData,canjes:canjesData,solicitudes:canjesSolicitudes})).then(()=>{ if(cambio) refreshCurrentView(); });
  }).catch(()=>{ try{ ref.set({puntos:puntosData,canjes:canjesData,solicitudes:canjesSolicitudes}); }catch(e){} });
}

function getPuntos(profId){
  // Solo lectura — no mutar puntosData aca. Antes creaba la entrada del
  // profesional como efecto secundario de "leer", lo que la desincronizaba
  // del snapshot de la nube en cada render y disparaba un loop de refetch
  // infinito (loadPuntosData -> getPuntos muta -> difiere de la nube ->
  // refreshCurrentView -> renderHub -> loadPuntosData -> ...).
  return puntosData[profId]||{total:0,movimientos:[]};
}
function addPuntos(profId, tipo, pts, razon, uid){
  if(!puntosData[profId]) puntosData[profId]={total:0,movimientos:[]};
  if(uid&&puntosData[profId].movimientos.some(m=>m.uid===uid)) return false; // ya se aplico
  puntosData[profId].total = (puntosData[profId].total||0) + pts;
  puntosData[profId].movimientos.unshift({tipo,pts,razon,uid,ts:new Date().toISOString(),fecha:ymdLocal(new Date())});
  savePuntosData();
}

const STAGES = {
  idea:      {l:'Idea',       c:'#4A136B'},
  guion:     {l:'Guión',     c:'#fbbf24'},
  produccion:{l:'Producción', c:'#60a5fa'},
  edicion:   {l:'Edición',   c:'#f472b6'},
  publicado: {l:'Publicado', c:'#34d399'},
};

// ============ AUTENTICACION (Supabase Auth) ============
// Cada persona tiene una cuenta de Supabase Auth (el email es "<usuario>@inda-luffy.app", no es un mail real).
// Las contraseñas las guarda Supabase (cifradas); la app nunca las guarda. El ROL sale de la tabla luffy_roles,
// que solo el admin puede modificar, y las reglas de la base deciden que puede leer/escribir cada uno.
const AUTH_DOMINIO='@inda-luffy.app';
const authEmail=(u)=>String(u||'').trim().toLowerCase().replace('@','').replace(/ /g,'_')+AUTH_DOMINIO;
// Supabase pide 6+ caracteres; el prefijo fijo deja entrar tambien a las cuentas viejas con claves cortas
const authPass=(p)=>'inda-luffy:'+p;
let signOutPendiente=null;
let cuentasPendientes=[];

async function cargarMiRol(){
  if(!supaClient) return null;
  try{
    const {data:{session}}=await supaClient.auth.getSession();
    if(!session) return null;
    const {data,error}=await supaClient.from('luffy_roles').select('app_id,role').eq('uid',session.user.id).maybeSingle();
    return (error||!data)?null:data;
  }catch(e){ return null; }
}

// Rubros de cada persona: un solo documento compartido { byId: { <id>: [rubros] } }.
// Cada uno cambia solo su entrada (lee la version mas fresca antes de escribir).
let rubrosProf={};
function aplicarRubrosProf(){
  allUsers.forEach(u=>{
    if(rubrosProf[u.id]){ u.rubros=rubrosProf[u.id]; if(esProf(u)&&u.role!=='encargado'&&u.rubros.length) u.profesion=u.rubros.map(nombreRubro).filter(Boolean).join(', ')||u.profesion; }
  });
  if(profile&&rubrosProf[profile.id]){ profile.rubros=rubrosProf[profile.id]; const u=allUsers.find(x=>x.id===profile.id); if(u&&u.profesion) profile.profesion=u.profesion; }
}
async function cargarRubrosProf(){
  if(DB){ try{ const r=await DB.doc('luffy/rubros_prof').get(); if(r&&r.byId) rubrosProf=r.byId; }catch(e){} }
  aplicarRubrosProf();
}
async function guardarRubrosDe(id,lista){
  let base={byId:{}};
  if(DB){ try{ const r=await DB.doc('luffy/rubros_prof').get(); if(r&&r.byId) base=r; }catch(e){} }
  base.byId[id]=lista; rubrosProf=base.byId;
  if(DB){ try{ await DB.doc('luffy/rubros_prof').set(base); }catch(e){} }
  aplicarRubrosProf();
}

// Todo lo que se carga de la nube necesita sesion iniciada
function cargarCatalogos(){
  loadStoryHorarios(); loadStoryRecTextos(); cargarEstadoCaja(); loadProductos(); loadServicios(); loadOfertas(); loadRubros(); loadCombos(); loadReglasReels(); loadTareasRecepcion(); loadTareasEncargado(); loadTareasData(); loadTareasEquipo(); loadCierres(); loadSucursales(); loadPromos(); loadSocial(); loadPuntosReglas(); loadFinanzas(); loadCaja(); loadTurnosRec(); loadProveedores(); loadDecisionesCom(); loadHorariosProfs();
  if(DB) Promise.resolve(DB.doc('luffy/reels').get()).then(r=>{ if(mergeReels(r)){ persistReelsLocal(); refreshCurrentView(); } }).catch(()=>{});
}

// ---------- cuentas pendientes de aprobacion (admin) ----------
async function cargarPendientes(){
  if(!supaClient||!profile||profile.role!=='admin') return;
  try{
    const {data,error}=await supaClient.from('luffy_pending').select('uid,data,created_at').order('created_at');
    if(error) return;
    const nuevas=(data||[]).map(x=>({uid:x.uid,creado:x.created_at,...x.data}));
    if(JSON.stringify(nuevas)!==JSON.stringify(cuentasPendientes)){ cuentasPendientes=nuevas; refreshCurrentView(); }
  }catch(e){}
}
async function aprobarCuenta(uid){
  const p=cuentasPendientes.find(x=>x.uid===uid); if(!p) return;
  let rol=(document.getElementById('ap-rol-'+uid)||{}).value||p.role;
  const adminProf=rol==='adminprof'; if(adminProf) rol='admin'; // administrador que tambien atiende como profesional
  const sucElegida=(document.getElementById('ap-suc-'+uid)||{}).value||null;
  const appId=String(Date.parse(p.creado)||Date.now()); // fijo: si se reintenta, no duplica
  let lista=allUsers;
  if(DB){ try{ const r=await DB.doc('luffy/users').get(); if(r&&Array.isArray(r.list)) lista=r.list; }catch(e){} }
  if(lista.some(u=>u.username===p.username&&u.id!==appId)){ showToast('Ya existe una persona con ese usuario'); return; }
  const {error}=await supaClient.from('luffy_roles').upsert({uid,app_id:appId,role:rol},{onConflict:'uid'});
  if(error){ showToast('No se pudo aprobar: '+error.message); return; }
  if(!lista.some(u=>u.id===appId)){
    lista.push({id:appId,name:p.name,username:p.username,role:rol,color:p.color,emoji:p.emoji,profesion:(rol==='profesional'||adminProf)?(p.profesion||'Profesional'):(ROLES[rol]||rol),sucursal:sucElegida,sucursales:sucElegida?[sucElegida]:[],tambienProf:adminProf||undefined,onboardingDone:false});
    allUsers=lista; saveUsers();
  }
  if((rol==='profesional'||adminProf)&&p.rubros&&p.rubros.length) await guardarRubrosDe(appId,p.rubros);
  await supaClient.from('luffy_pending').delete().eq('uid',uid);
  cuentasPendientes=cuentasPendientes.filter(x=>x.uid!==uid);
  showToast('Cuenta aprobada ✓ Ya puede entrar'); refreshCurrentView();
}
async function rechazarCuenta(uid){
  const p=cuentasPendientes.find(x=>x.uid===uid); if(!p) return;
  if(!await uiConfirm('¿Rechazar la cuenta de '+p.name+'?','No va a poder entrar. Si se equivocó, puede volver a registrarse con otro usuario.',{ok:'Rechazar'})) return;
  await supaClient.from('luffy_pending').delete().eq('uid',uid);
  cuentasPendientes=cuentasPendientes.filter(x=>x.uid!==uid);
  showToast('Cuenta rechazada'); refreshCurrentView();
}
function htmlCuentasPendientes(){
  if(!cuentasPendientes.length) return '';
  return `<div class="sec-title" style="margin:6px 0 10px">🆕 Cuentas esperando aprobación (${cuentasPendientes.length})</div>
  ${cuentasPendientes.map(p=>`<div class="card" style="margin-bottom:8px;border-color:rgba(251,191,36,.45);background:rgba(251,191,36,.05)">
    <div style="font-size:14px;font-weight:800">${escH(p.name)} <span style="font-size:12px;font-weight:600;color:var(--muted2)">@${escH(p.username)}</span></div>
    <div style="font-size:11.5px;color:var(--muted2);margin:3px 0 10px">Pidió ser ${escH(ROLES[p.role]||p.role)}${(p.rubros&&p.rubros.length)?' · '+escH(p.rubros.map(nombreRubro).filter(Boolean).join(', ')):''}</div>
    <div style="display:flex;gap:8px;align-items:center">
      <select id="ap-suc-${p.uid}" style="background:var(--s2);border:1.5px solid var(--border2);border-radius:10px;padding:10px;color:var(--text);font-family:var(--font);font-size:13px;max-width:130px">${sucursales.map((s,i)=>`<option value="${s.id}">${escH(s.nombre)}</option>`).join('')}</select>
      <select id="ap-rol-${p.uid}" style="flex:1;background:var(--s2);border:1.5px solid var(--border2);border-radius:10px;padding:10px;color:var(--text);font-family:var(--font);font-size:13px">${['profesional','recepcionista'].map(r=>`<option value="${r}" ${p.role===r?'selected':''}>${ROLES[r]}</option>`).join('')}<option value="adminprof">Administrador + profesional</option></select>
      <button onclick="aprobarCuenta('${p.uid}')" style="padding:10px 16px;border-radius:10px;border:none;background:#34d399;color:#0b0b10;font-family:var(--font);font-size:13px;font-weight:800;cursor:pointer">Aprobar</button>
      <button onclick="rechazarCuenta('${p.uid}')" style="padding:10px 12px;border-radius:10px;border:1.5px solid var(--border2);background:transparent;color:var(--muted2);font-family:var(--font);font-size:13px;font-weight:700;cursor:pointer">✕</button>
    </div></div>`).join('')}`;
}

// ---------- cambiar mi contraseña ----------
async function definirNuevaPasswordHabilitada(){
  if(!supaClient||!profile) return;
  const v=await uiDialog({title:'Definir nueva contraseña',msg:'El admin te habilitó para ponerte una contraseña nueva, sin necesitar la anterior. Se cierra solo apenas la cambies.',fields:[{label:'Contraseña nueva (mínimo 6)',type:'password'},{label:'Repetí la nueva',type:'password'}],ok:'Definir'});
  if(!v) return;
  if(!v[0]||v[0].length<6){ showToast('Tiene que tener al menos 6 caracteres'); return; }
  if(v[0]!==v[1]){ showToast('Las contraseñas no coinciden'); return; }
  try{
    const {error}=await supaClient.auth.updateUser({password:authPass(v[0])});
    if(error){ showToast('No se pudo cambiar: '+error.message); return; }
    profile.passReset=false;
    await editarUsuario(profile.id,{passReset:false});
    showToast('Contraseña definida ✓'); closeModal('modal-registro'); refreshCurrentView();
  }catch(e){ showToast('No se pudo cambiar la contraseña'); }
}
async function cambiarMiPassword(){
  if(!supaClient) return;
  const v=await uiDialog({title:'Cambiar contraseña',fields:[{label:'Contraseña actual',type:'password'},{label:'Contraseña nueva (mínimo 6)',type:'password'},{label:'Repetí la nueva',type:'password'}],ok:'Cambiar'});
  if(!v) return;
  if(!v[1]||v[1].length<6){ showToast('La nueva tiene que tener al menos 6 caracteres'); return; }
  if(v[1]!==v[2]){ showToast('Las contraseñas nuevas no coinciden'); return; }
  try{
    const {data:{user}}=await supaClient.auth.getUser();
    const chk=await supaClient.auth.signInWithPassword({email:user.email,password:authPass(v[0])});
    if(chk.error){ showToast('La contraseña actual no es correcta'); return; }
    const {error}=await supaClient.auth.updateUser({password:authPass(v[1])});
    showToast(error?'No se pudo cambiar: '+error.message:'Contraseña cambiada ✓');
  }catch(e){ showToast('No se pudo cambiar la contraseña'); }
}

// ============ AUTH ============
// Un admin puede ser tambien profesional (flag tambienProf): entra en todas las listas de equipo, comisiones y puntos.
function esProf(u){ return !!u&&(u.role==='profesional'||u.role==='encargado'||(u.role==='admin'&&!!u.tambienProf)); }
let allUsers = [];

async function loadUsers(){
  try { allUsers=JSON.parse(localStorage.getItem('luffy_users')||'[]'); } catch(e){ allUsers=[]; }
  try { usuariosBaja=JSON.parse(localStorage.getItem('luffy_users_baja')||'[]'); } catch(e){ usuariosBaja=[]; }
  if(DB){
    try{
      const r = await DB.doc('luffy/users').get();
      if(r && Array.isArray(r.list)){ allUsers=r.list; usuariosBaja=Array.isArray(r.bajas)?r.bajas:[]; try{ localStorage.setItem('luffy_users', JSON.stringify(allUsers)); localStorage.setItem('luffy_users_baja', JSON.stringify(usuariosBaja)); }catch(e){} }
    }catch(e){}
  }
  allUsers.forEach(u=>{ delete u.password; }); // las claves las maneja Supabase Auth; se limpian copias viejas
  aplicarRubrosProf();
}

function saveUsers(){
  allUsers.forEach(u=>{ delete u.password; }); // nunca se guardan claves en el listado
  try { localStorage.setItem('luffy_users',JSON.stringify(allUsers)); } catch(e){}
  try { localStorage.setItem('luffy_users_baja',JSON.stringify(usuariosBaja)); } catch(e){}
  if(DB){ try{ DB.doc('luffy/users').set({list:allUsers,bajas:usuariosBaja}); }catch(e){} }
}

const LOGIN_PANTALLAS=['login-welcome','login-form','register-form','recover-form','pantalla-local-form'];
function showWelcome(){
  LOGIN_PANTALLAS.forEach(id=>{
    const el=document.getElementById(id);
    if(el) el.style.display=id==='login-welcome'?'block':'none';
  });
}
function showLoginForm(){
  LOGIN_PANTALLAS.forEach(id=>{
    const el=document.getElementById(id);
    if(el) el.style.display=id==='login-form'?'block':'none';
  });
  setTimeout(()=>document.getElementById('li-user')?.focus(),100);
}
function showRegisterForm(){
  LOGIN_PANTALLAS.forEach(id=>{
    const el=document.getElementById(id);
    if(el) el.style.display=id==='register-form'?'block':'none';
  });
  regRolCambio();
  setTimeout(()=>document.getElementById('reg-name')?.focus(),100);
}
function showPantallaLocalForm(){
  LOGIN_PANTALLAS.forEach(id=>{
    const el=document.getElementById(id);
    if(el) el.style.display=id==='pantalla-local-form'?'block':'none';
  });
  const err=document.getElementById('pl-error'); if(err) err.textContent='';
  const pin=document.getElementById('pl-pin'); if(pin) pin.value='';
  setTimeout(()=>document.getElementById('pl-pin')?.focus(),100);
}
// Solo los profesionales eligen rubros (barberia, peluqueria...): son los que definen que servicios y promos ven
function regRolCambio(){
  const w=document.getElementById('reg-rubros-wrap'), l=document.getElementById('reg-rubros');
  if(!w||!l) return;
  const esProf=document.getElementById('reg-rol')?.value==='profesional';
  w.style.display=esProf?'':'none';
  if(esProf&&!l.children.length) l.innerHTML=rubros.map(r=>`<label class="rub-opt"><input type="checkbox" class="reg-rubro" value="${r.id}"/> ${escH(r.nombre)}</label>`).join('');
}
function showRecoverForm(){
  LOGIN_PANTALLAS.forEach(id=>{
    const el=document.getElementById(id);
    if(el) el.style.display=id==='recover-form'?'block':'none';
  });
}

// ---------- Pantalla local (modo kiosco): se entra con un PIN compartido, sin loguearse como ninguna cuenta ----------
// Pensado para dejar una tablet fija en French mostrando solo esto, sin exponer la cuenta personal de nadie.
async function entrarPantallaLocal(){
  const pin=(document.getElementById('pl-pin')?.value||'').trim();
  const err=document.getElementById('pl-error');
  if(!pin){ if(err) err.textContent='Poné el PIN'; return; }
  if(!DB){ if(err) err.textContent='No hay conexión con el servidor'; return; }
  if(err) err.textContent='Verificando...';
  try{
    const [sucR,promR,userR]=await Promise.all([
      Promise.resolve(DB.doc('luffy/sucursales').get()).catch(()=>null),
      Promise.resolve(DB.doc('luffy/promos_cfg').get()).catch(()=>null),
      Promise.resolve(DB.doc('luffy/users').get()).catch(()=>null),
    ]);
    if(sucR&&sucR.list&&sucR.list.length) sucursales=sucR.list;
    if(promR) promos=aplicarPromosRemotas(promR);
    if(userR&&Array.isArray(userR.list)) allUsers=userR.list;
  }catch(e){}
  const pinReal=(promos&&promos.pinPantalla)||'0000';
  if(pin!==pinReal){ if(err) err.textContent='PIN incorrecto'; return; }
  const suc=sucursalDeKiosco();
  if(!suc){ if(err) err.textContent='No hay ninguna sucursal sin recepción configurada'; return; }
  if(err) err.textContent='';
  await mostrarPantallaKiosco(suc,true);
}

let __doLoginBusy = false;
async function doLogin(){
  if(__doLoginBusy) return; // ignore rapid double-taps on Entrar
  const raw=document.getElementById('li-user')?.value.trim();
  const passInput=document.getElementById('li-pass')?.value;
  const errEl=document.getElementById('li-error');
  if(!raw||!passInput){ errEl.textContent='Completá usuario y contraseña'; return; }
  const userInput=raw.toLowerCase().replace('@','').replace(/ /g,'_');
  errEl.textContent='Verificando...';
  __doLoginBusy = true;
  try{
  if(!supaClient){ errEl.textContent='No hay conexión con el servidor'; return; }
  if(signOutPendiente){ try{ await signOutPendiente; }catch(e){} }
  const {error}=await supaClient.auth.signInWithPassword({email:authEmail(userInput),password:authPass(passInput)});
  if(error){ errEl.textContent='Usuario o contraseña incorrectos (usá el usuario exacto con el que te registraste)'; return; }
  const rol=await cargarMiRol();
  if(!rol){ await supaClient.auth.signOut(); errEl.textContent='Tu cuenta todavía no fue aprobada por el administrador'; return; }
  errEl.textContent='';
  await loginAs(rol.app_id);
  }finally{ __doLoginBusy = false; }
}

let __doRegisterBusy = false;
async function doRegister(){
  if(__doRegisterBusy) return; // ignore rapid double-taps
  const name=document.getElementById('reg-name')?.value.trim();
  const username=document.getElementById('reg-user')?.value.trim().toLowerCase().replace('@','').replace(/ /g,'_');
  const pass=document.getElementById('reg-pass')?.value;
  const role=document.getElementById('reg-rol')?.value;
  const errEl=document.getElementById('reg-error');
  if(!name||!username||!pass){ errEl.textContent='Completá todos los campos'; return; }
  if(pass.length<6){ errEl.textContent='La contraseña tiene que tener al menos 6 caracteres'; return; }
  const rubrosSel=role==='profesional'?[...document.querySelectorAll('.reg-rubro:checked')].map(x=>x.value):[];
  if(role==='profesional'&&!rubrosSel.length){ errEl.textContent='Elegí al menos un rubro'; return; }
  errEl.textContent='Verificando...';
  __doRegisterBusy = true;
  try{
  if(!supaClient){ errEl.textContent='No hay conexión con el servidor'; return; }
  if(signOutPendiente){ try{ await signOutPendiente; }catch(e){} }
  let uid=null;
  const su=await supaClient.auth.signUp({email:authEmail(username),password:authPass(pass)});
  if(su.error){
    if(!/registered|already|exists/i.test(su.error.message)){ errEl.textContent='No se pudo crear la cuenta: '+su.error.message; return; }
    // Puede ser una cuenta que quedo a medio crear (se creo el acceso pero no la solicitud): si la clave coincide, se retoma.
    const si=await supaClient.auth.signInWithPassword({email:authEmail(username),password:authPass(pass)});
    if(si.error){ errEl.textContent='Ese usuario ya existe'; return; }
    uid=si.data.user.id;
    if(await cargarMiRol()){ await supaClient.auth.signOut(); errEl.textContent='Esa cuenta ya está aprobada: iniciá sesión'; return; }
    const ya=await supaClient.from('luffy_pending').select('uid').eq('uid',uid).maybeSingle();
    if(ya.data){ await supaClient.auth.signOut(); errEl.textContent=''; showWelcome(); await uiDialog({title:'Tu solicitud ya está enviada',msg:'Está esperando que el administrador la apruebe. Cuando lo haga, entrá con tu usuario y contraseña.',ok:'Entendido',soloOk:true}); return; }
  } else {
    if(!su.data.session){ errEl.textContent='El servidor todavía pide confirmar por mail. Avisale al admin.'; return; }
    uid=su.data.user.id;
  }
  const colors={profesional:'#4A136B',recepcionista:'#60a5fa',encargado:'#34d399'};
  const emojis={profesional:'✂️',recepcionista:'📞',encargado:'📋'};
  const datos={name,username,role,rubros:rubrosSel,color:colors[role]||'#4A136B',emoji:emojis[role]||'✂️',profesion:role==='profesional'?rubrosSel.map(nombreRubro).filter(Boolean).join(', '):(ROLES[role]||role)};
  const ins=await supaClient.from('luffy_pending').insert({uid,data:datos});
  await supaClient.auth.signOut();
  if(ins.error){ errEl.textContent='No se pudo enviar la solicitud: '+ins.error.message; return; }
  errEl.textContent='';
  showWelcome();
  await uiDialog({title:'Cuenta creada ✓',msg:'Ahora el administrador tiene que aprobarla. Cuando lo haga, entrá con tu usuario y contraseña.',ok:'Entendido',soloOk:true});
  }finally{ __doRegisterBusy = false; }
}

const PERFIL_PRUEBA = {
  onboardingDone: true,
  nicho: 'Soy barbero y ayudo a hombres de 20-35 años en Ezeiza a verse y sentirse bien con cortes modernos y barba prolija, sin perder tiempo ni plata.',
  voz: 'Directo, cercano, con humor porteño',
  palabrasSi: 'resultados, reservá, te queda, transformación, antes/después',
  palabrasNo: 'coaching, LinkedIn, emprender, mindset, sinergia',
};

async function loginAs(id){
  const myToken = ++sessionToken;
  await loadUsers();
  if(myToken!==sessionToken) return; // superseded by a newer login/logout while we awaited
  const u=allUsers.find(x=>x.id===id);
  if(!u) return;
  const rol=await cargarMiRol();
  if(myToken!==sessionToken) return;
  if(!rol||rol.app_id!==id){ showLogin(); return; }
  u.role=rol.role; // el rol no se toma del listado: viene de la tabla protegida
  await revisarEpoca();
  if(myToken!==sessionToken) return;
  await cargarRubrosProf();
  if(myToken!==sessionToken) return;
  profile={...u};
  try{ localStorage.setItem('luffy_session_id', id); }catch(e){}
  cargarCatalogos();
  setTimeout(guiaInicial,1500);
  let modoProf=false;
  if(u.role==='admin'&&u.tambienProf){ try{ modoProf=localStorage.getItem('luffy_modo_'+id)==='prof'; }catch(e){} }
  if(u.role==='admin'&&!modoProf){ enterAdmin(); return; }
  if(modoProf){ profile.role='profesional'; profile.adminReal=true; }
  if(u.role==='encargado'){ enterEncargado(); return; }
  if(u.role==='recepcionista'){ enterRecepcionista(); return; }
  try { dineroData=JSON.parse(localStorage.getItem('luffy_dinero_'+id)||'{"turnos":[]}'); } catch(e){ dineroData={turnos:[]}; }
  try { yoData=JSON.parse(localStorage.getItem('luffy_yo_'+id)||'{"ingresos":[],"gastos":[],"deudas":[]}'); } catch(e){ yoData={ingresos:[],gastos:[],deudas:[]}; }
  try { horarioData=JSON.parse(localStorage.getItem('luffy_horario_'+id)||'null')||defaultHorario(); } catch(e){ horarioData=defaultHorario(); }
  try { const ep=JSON.parse(localStorage.getItem('luffy_perfil_'+id)||'null'); if(ep) Object.assign(profile,ep); } catch(e){}
  loadStoriesData(); loadPuntosData();
  if(DB){
    // Fetch everything in parallel — sequential awaits here made login take several seconds
    const [d,y,ho,cp] = await Promise.all([
      DB.doc('luffy/dinero_'+id).get().catch(()=>null),
      DB.doc('luffy/yo_'+id).get().catch(()=>null),
      DB.doc('luffy/horario_'+id).get().catch(()=>null),
      DB.doc('luffy/perfil_'+id).get().catch(()=>null),
    ]);
    if(myToken!==sessionToken) return; // logged out / a newer login won while we were fetching
    if(d){ dineroData=d; normalizarFechas(dineroData); try{localStorage.setItem('luffy_dinero_'+id,JSON.stringify(dineroData));}catch(e){} }
    if(y){ yoData=y; try{localStorage.setItem('luffy_yo_'+id,JSON.stringify(yoData));}catch(e){} }
    if(ho){ horarioData=ho; try{localStorage.setItem('luffy_horario_'+id,JSON.stringify(horarioData));}catch(e){} }
    if(cp){ Object.assign(profile,cp); try{localStorage.setItem('luffy_perfil_'+id,JSON.stringify(cp));}catch(e){} }
  }
  // Si quedo guardado el perfil de prueba de una version anterior, se descarta: el perfil de creador es solo el que cada persona arma en Contenido.
  try{ const ep0=JSON.parse(localStorage.getItem('luffy_perfil_'+id)||'null'); if(ep0&&ep0.nicho===PERFIL_PRUEBA.nicho) localStorage.removeItem('luffy_perfil_'+id); }catch(e){}
  if(profile.nicho===PERFIL_PRUEBA.nicho){ ['onboardingDone','nicho','voz','palabrasSi','palabrasNo'].forEach(k=>delete profile[k]); }
  if(dineroPollTimer) clearInterval(dineroPollTimer);
  if(profile.role==='profesional') dineroPollTimer=setInterval(()=>{ if(currentScreenId==='hub'||currentScreenId==='dinero') refrescarDineroPropio(); if(['hub','kanban','banco'].includes(currentScreenId)) refrescarReels(); if(currentScreenId==='hub') refrescarRubrosPropios(); if(currentScreenId==='agenda'){ agendaSt.load(); holdsSt.load(); refreshCurrentView(); } }, 45000);
  showHub();
  if(profile.role==='profesional'&&!(profile.rubros&&profile.rubros.length)) setTimeout(()=>{ if(profile&&profile.id===id&&currentScreenId==='hub') abrirRubrosProf(id,true); },900);
}

// Admin que tambien es profesional: alterna entre "Admin" y "Mi perfil profesional" (misma cuenta, mismo login).
async function cambiarModo(m){
  if(!profile||!profile.tambienProf) return;
  const id=profile.id; cerrarMenu();
  try{ localStorage.setItem('luffy_modo_'+id,m); }catch(e){}
  await loginAs(id);
}

function showLogin(cerrarSesion=true){
  sessionToken++;
  if(cerrarSesion&&supaClient) signOutPendiente=supaClient.auth.signOut().catch(()=>{}); // invalidate any loginAs() still in flight so it can't resurrect this session
  profile=null;
  if(recepcionPollTimer){ clearInterval(recepcionPollTimer); recepcionPollTimer=null; }
  if(adminPollTimer){ clearInterval(adminPollTimer); adminPollTimer=null; }
  if(dineroPollTimer){ clearInterval(dineroPollTimer); dineroPollTimer=null; }
  try{ localStorage.removeItem('luffy_session_id'); }catch(e){}
  show('login');
  document.getElementById('nav').style.display='none';
  showWelcome();
}

// Chrome for iOS implements its own "pull to refresh" gesture at the
// browser-chrome level, independent of page CSS (overscroll-behavior /
// position:fixed body do NOT stop it). Only intervene on a genuine
// downward drag (a real finger tap always has a few px of jitter, so
// blocking every touchmove — as a first attempt here did — also breaks
// plain taps on the header, the bottom nav, and inputs). This only
// prevents the browser's refresh gesture from engaging when the drag
// starts on page chrome that isn't meant to scroll at all.
let __touchStartY = null;
document.addEventListener('touchstart', function(e){
  __touchStartY = e.touches[0].clientY;
}, {passive:true});
document.addEventListener('touchmove', function(e){
  if(__touchStartY===null) return;
  const dy = e.touches[0].clientY - __touchStartY;
  if(dy > 10 && !e.target.closest('.scroll, #hub-scroll, .kanban-scroll, .modal-box, .ob-chat, #login, #ag-grid-wrap')){
    e.preventDefault();
  }
}, {passive:false});
document.addEventListener('touchend', function(){ __touchStartY = null; }, {passive:true});

