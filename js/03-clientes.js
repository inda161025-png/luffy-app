// ============ REINICIO DE DATOS: descartar copias locales viejas ============
// Cuando el admin reinicia las cuentas, se guarda una "epoca" nueva en la nube. Cada dispositivo la compara con la que
// tiene guardada; si cambio, borra sus copias locales para que no vuelvan a subirse datos de prueba.
async function revisarEpoca(){
  if(!DB) return false;
  let n=null; try{ const r=await DB.doc('luffy/epoca').get(); n=r&&r.n; }catch(e){}
  if(!n) return false;
  let mio=null; try{ mio=localStorage.getItem('luffy_epoca'); }catch(e){}
  if(String(n)===mio) return false;
  const prefijos=['luffy_dinero_','luffy_yo_','luffy_rec_','luffy_clientes','luffy_caja_'];
  const exactos=['luffy_puntos','luffy_canjes_sol','luffy_stories','luffy_tareas_data','luffy_cierres','luffy_reels','luffy_reels_del','luffy_productos','luffy_avisos_leidos','luffy_incidentes','luffy_membresias','luffy_paquetes','luffy_senas','luffy_agenda'];
  try{ Object.keys(localStorage).forEach(k=>{ if(prefijos.some(p=>k.startsWith(p))||exactos.includes(k)) localStorage.removeItem(k); }); localStorage.setItem('luffy_epoca',String(n)); }catch(e){}
  reels=[]; reelsBorrados=[]; reelsSnap={}; puntosData={}; canjesSolicitudes=[]; storiesData={}; tareasData={}; productos=[]; clientesDir=[]; membresiasSt.list=[]; paquetesSt.list=[]; senasSt.list=[]; agendaSt.list=[]; cajaDocs={};
  dineroData={turnos:[],ventas:[],deudores:[]}; avisosLeidos=[]; cierresData={byKey:{}};
  return true;
}
async function chequearEpocaViva(){
  if(!DB||!profile) return;
  try{
    const r=await DB.doc('luffy/epoca').get();
    if(r&&r.n&&String(r.n)!==localStorage.getItem('luffy_epoca')) location.reload();
  }catch(e){}
}

// ============ SUCURSALES ============
const SUCURSALES_DEFAULT=[{id:'s1',nombre:'Diego Laure',color:'#4A136B',recepcion:true},{id:'s2',nombre:'French',color:'#f59e0b',recepcion:false}];
let sucursales=JSON.parse(JSON.stringify(SUCURSALES_DEFAULT));
function loadSucursales(){
  try{ const r=JSON.parse(localStorage.getItem('luffy_sucursales')||'null'); if(r&&r.length) sucursales=r; }catch(e){}
  if(DB){
    DB.doc('luffy/sucursales').get().then(r=>{
      if(r&&r.list&&r.list.length&&JSON.stringify(r.list)!==JSON.stringify(sucursales)){ sucursales=r.list; try{localStorage.setItem('luffy_sucursales',JSON.stringify(sucursales));}catch(e){} refreshCurrentView(); }
    }).catch(()=>{});
  }
}
function saveSucursales(){
  try{localStorage.setItem('luffy_sucursales',JSON.stringify(sucursales));}catch(e){}
  if(DB){ try{DB.doc('luffy/sucursales').set({list:sucursales});}catch(e){} }
}
function sucursalDe(id){ return sucursales.find(s=>s.id===id)||null; }
function chipSucursal(sid,chico){
  const s=sucursalDe(sid); if(!s) return '';
  return `<span style="display:inline-flex;align-items:center;gap:4px;font-size:${chico?10:11}px;font-weight:800;padding:3px 9px;border-radius:10px;background:${s.color}22;color:${s.color};border:1px solid ${s.color}55;white-space:nowrap">📍 ${escH(s.nombre)}</span>`;
}
const PALETA_SUC=['#4A136B','#f59e0b','#34d399','#f472b6','#60a5fa','#fb923c'];
function renderAdminSucursales(body){
  const uso=(id)=>allUsers.filter(u=>sucursalesDe(u).includes(id)).length;
  body.innerHTML=`
    <div class="sec-hdr" style="margin:6px 0 8px"><span class="sec-title">📍 Sucursales</span><button class="lnk" onclick="agregarSucursal()">+ Nueva sucursal</button></div>
    <div class="card" style="margin-bottom:10px;font-size:12px;color:var(--muted2);line-height:1.5">Una sucursal tiene recepcionista cuando le asignás una (en Cuentas). Si no tiene, los profesionales de ahí completan las tareas de cierre (reagendó, reseña, seña…) y suman los puntos. Cada profesional pertenece a una sucursal (se asigna en <b style="color:var(--text)">Estado</b> o al aprobar su cuenta). En recepción, cada cobro se ve con el <b style="color:var(--text)">color y el nombre</b> de su sucursal.</div>
    ${sucursales.map(s=>`<div class="prof-card" style="margin-bottom:8px;padding:12px 14px;border-left:5px solid ${s.color}"><div style="display:flex;align-items:center;gap:12px">
      <input type="color" value="${s.color}" onchange="cambiarColorSucursal('${s.id}',this.value)" title="Cambiar color" style="width:38px;height:38px;border:none;background:none;padding:0;cursor:pointer;flex-shrink:0"/>
      <div style="flex:1;min-width:0"><div style="font-size:14px;font-weight:800">${escH(s.nombre)}</div><div style="font-size:11px;color:var(--muted2)">${uso(s.id)} ${uso(s.id)===1?'persona':'personas'} · <span style="color:${sucursalConRecepcion(s.id)?'#34d399':'#f472b6'}">${sucursalConRecepcion(s.id)?'Con recepcionista ('+allUsers.filter(u=>u.role==='recepcionista'&&atiende(u,s.id)).map(u=>escH(u.name.split(' ')[0])).join(', ')+')':'Sin recepcionista: los profesionales cierran sus turnos'}</span></div></div>
      <button onclick="renombrarSucursal('${s.id}')" style="background:none;border:none;color:var(--muted2);font-size:15px;cursor:pointer">✏️</button>
      <button onclick="borrarSucursal('${s.id}')" style="background:none;border:none;color:var(--muted);font-size:18px;cursor:pointer">×</button>
    </div></div>`).join('')}`;
}
async function agregarSucursal(){
  const n=await uiPrompt('Nueva sucursal',{label:'Nombre',placeholder:'Ej: Ezeiza Centro',ok:'Agregar'});
  if(!n||!n.trim()) return;
  sucursales.push({id:'s'+Date.now(),nombre:n.trim(),color:PALETA_SUC[sucursales.length%PALETA_SUC.length]});
  saveSucursales(); renderAdmin();
}
async function renombrarSucursal(id){
  const s=sucursalDe(id); if(!s) return;
  const n=await uiPrompt('Renombrar sucursal',{label:'Nombre',value:s.nombre,ok:'Guardar'});
  if(!n||!n.trim()) return;
  s.nombre=n.trim(); saveSucursales(); renderAdmin();
}
function toggleRecepcionSuc(id){ const s=sucursalDe(id); if(!s) return; s.recepcion=(s.recepcion===false); saveSucursales(); renderAdmin(); }
function cambiarColorSucursal(id,color){ const s=sucursalDe(id); if(!s) return; s.color=color; saveSucursales(); renderAdmin(); }
async function borrarSucursal(id){
  const s=sucursalDe(id); if(!s) return;
  const n=allUsers.filter(u=>sucursalesDe(u).includes(id)).length;
  if(n){ showToast('Tiene '+n+' personas asignadas: movelas primero'); return; }
  if(!await uiConfirm('¿Borrar "'+s.nombre+'"?','Los cobros ya registrados no cambian.')) return;
  sucursales=sucursales.filter(x=>x.id!==id); saveSucursales(); renderAdmin();
}
// Encargado = un profesional que ademas controla el stock. Lo designa el admin (puede ser mas de uno).
async function toggleEncargado(id){
  const u=allUsers.find(x=>x.id===id); if(!u) return;
  if(!u.esEncargado&&!await uiConfirm('¿Hacer encargado a '+u.name+'?','Sigue siendo profesional y suma a su menú "Control de stock" para reponer productos y ver el que queda poco.',{ok:'Hacer encargado'})) return;
  if(await guardarCampoUsuario(id,{esEncargado:!u.esEncargado,comisionFija:null})){ showToast(u.esEncargado?u.name+' ya es encargado ✓':'Listo, ya no es encargado'); renderAdmin(); }
}
async function editarComisionFija(id){
  const u=allUsers.find(x=>x.id===id); if(!u) return;
  const v=await uiPrompt('Comisión fija de '+u.name,{msg:'Cobra siempre este porcentaje de lo que pagan los clientes por sus servicios, sin importar cuánto facture en la quincena.',label:'Comisión (%)',type:'number',value:comisionFijaDe(u)||60,ok:'Guardar'});
  if(v===null) return; const n=Math.min(100,Math.max(1,numV(v)));
  if(await guardarCampoUsuario(id,{comisionFija:n})){ showToast('Comisión fija: '+n+'% ✓'); renderAdmin(); }
}
// Retirado el 23/09/2026: reagendo/resena/seña/paquete ahora se preguntan en el propio cobro (ver renderPrepagoCobro),
// no hace falta "cerrar" el turno despues. La funcion queda vacia por si algo la sigue llamando desde algun lado.
function htmlCierresPendProf(){ return ''; }
// Encargado: aviso de productos con poco stock
function htmlStockBajoEnc(){
  if(!profile||!profile.esEncargado) return '';
  const bajos=productos.filter(p=>numV(p.stock)<=numV(p.alertaStock));
  return bajos.length?`<div class="card" onclick="enterEncargado()" style="cursor:pointer;margin-bottom:14px;border-color:rgba(244,114,182,.5);background:rgba(244,114,182,.07)"><div style="font-size:13px;font-weight:800;color:#f472b6">📦 Queda poco stock (${bajos.length})</div><div style="font-size:11.5px;color:var(--muted2);margin-top:2px">${bajos.slice(0,4).map(p=>escH(p.nombre)+' ('+numV(p.stock)+')').join(' · ')}${bajos.length>4?' …':''} · tocá para reponer</div></div>`:'';
}
function renderCierresPendientesProf(){
  const el=document.getElementById('hub-cierres'); if(!el) return;
  el.innerHTML=htmlCierresPendProf()+htmlStockBajoEnc()+htmlSenasDeudasHub();
}
// ============ CLIENTES (directorio unico del salon) ============
// Hay UNA sola lista de clientes para todo el salon: asi no se repiten nombres y recepcion los ve a todos.
// Cada profesional ve y administra "sus" clientes (los que cargo o atendio); los que ya existen los puede elegir al cobrar.
// El numero (#) lo ven recepcion y el admin; los profesionales identifican al cliente por nombre, profesion y detalle.
// Una visita = un turno, aunque haya tenido varios servicios (Corte y Barba + Permanente = 1 visita, con su desglose).
const PROFESIONES_BASE=['Fuerzas policiales','Bomberos','Maestros / docentes','Personal de salud','Estudiantes'];
let clientesDir=[];
let clientesQ='';
const cumpleTxt=(v)=>{ if(!v) return ''; const [m,d]=v.split('-'); return Number(d)+' de '+MESES[Number(m)-1]; };
function diasHastaCumple(v){
  if(!v) return null; const [m,d]=v.split('-').map(Number); const n=new Date(); const hoy0=new Date(n.getFullYear(),n.getMonth(),n.getDate());
  let s=new Date(n.getFullYear(),m-1,d); if(s<hoy0) s=new Date(n.getFullYear()+1,m-1,d);
  return Math.round((s-hoy0)/864e5);
}
// Dias desde que paso el cumple este año (0 = hoy, negativo = todavia no llego) — para saber si el descuento de cumpleaños sigue vigente
function diasDesdeCumple(v){
  if(!v) return null; const [m,d]=v.split('-').map(Number); const n=new Date(); const hoy0=new Date(n.getFullYear(),n.getMonth(),n.getDate());
  const s=new Date(n.getFullYear(),m-1,d);
  return Math.round((hoy0-s)/864e5);
}
function htmlCumpleSel(v,nac){
  let [m,d]=(v||'').split('-').map(Number), y='';
  if(nac){ const p=String(nac).split('-').map(Number); y=p[0]; m=p[1]; d=p[2]; }
  const st='background:var(--s2);border:1.5px solid var(--border2);border-radius:12px;padding:12px;color:var(--text);font-family:var(--font);font-size:14px;flex:1';
  return `<div style="display:flex;gap:8px"><select id="cl-cd" style="${st}"><option value="">Día</option>${Array.from({length:31},(_,i)=>`<option value="${i+1}" ${d===i+1?'selected':''}>${i+1}</option>`).join('')}</select><select id="cl-cm" style="${st}"><option value="">Mes</option>${MESES.map((n,i)=>`<option value="${i+1}" ${m===i+1?'selected':''}>${n}</option>`).join('')}</select><input id="cl-ca" type="number" inputmode="numeric" placeholder="Año" min="1900" max="${new Date().getFullYear()}" value="${y||''}" style="${st}"/></div>`;
}
// Fecha de nacimiento completa (AAAA-MM-DD) o '' si falta algo o no es una fecha real
function leerNacimientoForm(){
  const d=Number(document.getElementById('cl-cd')?.value), m=Number(document.getElementById('cl-cm')?.value), y=Number(document.getElementById('cl-ca')?.value);
  if(!d||!m||!(y>=1900&&y<=new Date().getFullYear())) return '';
  const t=new Date(y,m-1,d); if(t.getFullYear()!==y||t.getMonth()!==m-1||t.getDate()!==d) return '';
  return y+'-'+pad2(m)+'-'+pad2(d);
}
function leerCumpleForm(){ const d=document.getElementById('cl-cd')?.value, m=document.getElementById('cl-cm')?.value; return d&&m?pad2(m)+'-'+pad2(d):''; }
// Clientes que cumplen en los proximos dias (o hoy), para recepcion
function cumplesClientes(dias){ return clientesDir.map(c=>({c,en:diasHastaCumple(c.cumple)})).filter(x=>x.en!=null&&x.en<=dias).sort((a,b)=>a.en-b.en); }
function nkey(s){ return String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/\s+/g,' ').trim(); }
function verNumeroCliente(){ return !!profile&&profile.role!=='profesional'; }
function profesionesLista(){
  const extra=[...new Set(clientesDir.map(c=>c.profesion).filter(p=>p&&!PROFESIONES_BASE.some(b=>nkey(b)===nkey(p))))];
  return [...PROFESIONES_BASE,...extra];
}
function clienteDe(id){ return id?clientesDir.find(c=>c.id===id)||null:null; }
function persistClientes(){ try{ localStorage.setItem('luffy_clientes',JSON.stringify(clientesDir)); }catch(e){} }
// migracion: antes un cliente tenia una sola tarjeta (c.tarjeta); ahora puede tener varias (c.tarjetas, array)
function normTarjetasCliente(c){
  if(c.tarjeta&&!c.tarjetas){ c.tarjetas=[c.tarjeta]; delete c.tarjeta; }
  else if(!c.tarjetas) c.tarjetas=[];
  return c;
}
function mergeClientes(remote){
  if(!remote||!Array.isArray(remote.list)) return false;
  const antes=JSON.stringify(clientesDir);
  const m=new Map(clientesDir.map(c=>[c.id,c]));
  remote.list.forEach(r=>{ normTarjetasCliente(r); const l=m.get(r.id); if(!l||String(r.upd||'')>String(l.upd||'')) m.set(r.id,r); });
  clientesDir=[...m.values()];
  return antes!==JSON.stringify(clientesDir);
}
function loadClientes(){
  if(!profile) return;
  try{ clientesDir=JSON.parse(localStorage.getItem('luffy_clientes')||'[]'); }catch(e){ clientesDir=[]; }
  clientesDir.forEach(normTarjetasCliente);
  if(DB){
    DB.doc('luffy/clientes').get().then(r=>{ if(mergeClientes(r)){ persistClientes(); refreshCurrentView(); } }).catch(()=>{});
  }
}
// Lee lo ultimo de la nube, aplica el cambio y lo vuelve a guardar (nadie pisa lo que cargo otra persona)
async function cambiarClientes(fn){
  if(DB){ try{ mergeClientes(await DB.doc('luffy/clientes').get()); }catch(e){} }
  const res=fn(clientesDir);
  persistClientes();
  if(DB){ try{ await DB.doc('luffy/clientes').set({list:clientesDir}); }catch(e){ showToast('Se guardó en este dispositivo; falta conexión para subirlo'); } }
  return res;
}
function misClientesLista(){
  if(!profile||profile.role!=='profesional') return clientesDir.slice();
  return clientesDir.filter(c=>c.creadoPor===profile.id||(c.profs||[]).includes(profile.id));
}
function buscarClientes(q,lista){
  const k=nkey(q).replace('#',''); if(!k) return [];
  return (lista||clientesDir).filter(c=>c.nkey.includes(k)||String(c.numero)===k||(c.tel||'').replace(/\D/g,'').includes(k.replace(/\D/g,'')||'§')||nkey(c.ref).includes(k));
}
// Como reconocerlo sin el numero
function idCorto(c){
  const p=[c.profesion,c.ref,c.tel?('…'+String(c.tel).replace(/\D/g,'').slice(-4)):''].filter(Boolean);
  return p.join(' · ');
}
async function crearCliente(d){
  const nombre=(d.nombre||'').trim().replace(/\s+/g,' ');
  return cambiarClientes(list=>{
    const dup=list.find(c=>c.nkey===nkey(nombre));
    if(dup) return {error:'dup',existente:dup};
    const numero=list.reduce((m,c)=>Math.max(m,numV(c.numero)),0)+1;
    const ahora=new Date().toISOString();
    const c={id:'c'+numero+'x'+Date.now().toString(36), numero, nombre, nkey:nkey(nombre), profesion:d.profesion||'', tel:(d.tel||'').trim(), nacimiento:d.nacimiento||'', email:(d.email||'').trim(), ref:(d.ref||'').trim(), nota:(d.nota||'').trim(), cumple:d.cumple||'', genero:d.genero||'',
      creadoPor:profile.id, creadoPorNombre:profile.name, profs:profile.role==='profesional'?[profile.id]:[], sucursal:profile.sucursal||null, refPor:d.refPor||null, tarjetas:[], creado:ahora, upd:ahora};
    if(d.tarjeta) c.tarjetas.push(nuevaTarjetaCliente(d.tarjeta));
    list.push(c);
    return {cliente:c};
  });
}

// ---------- carga masiva de clientes ----------
function clientesDeTabla(txt){
  const rows=parseTabla(txt); if(!rows.length) return {validos:[],omitidos:0,dupTel:0,yaExiste:0};
  const norm=(s)=>String(s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
  const header=rows[0].map(norm);
  const idx=(...names)=>header.findIndex(h=>names.some(n=>h===n||h.includes(n)));
  const iNombres=idx('nombres','nombre','cliente'), iApellidos=idx('apellidos','apellido');
  const iTel=header.findIndex(h=>(h.includes('telefono')||h.includes('celular')||h.includes('whatsapp'))&&!h.includes('secundario'));
  const iEmail=idx('email','mail','correo'), iNota=idx('nota','notas','observacion');
  const esHeader=iNombres>=0||iTel>=0||iEmail>=0;
  const dataRows=esHeader?rows.slice(1):rows;
  const seenTel=new Set();
  const existentes=new Set(clientesDir.map(c=>(c.tel||'').replace(/\D/g,'')).filter(Boolean));
  const validos=[]; let omitidos=0, dupTel=0, yaExiste=0;
  dataRows.forEach(r=>{
    const nombre=[iNombres>=0?r[iNombres]:r[0], iApellidos>=0?r[iApellidos]:''].map(s=>String(s||'').trim()).filter(Boolean).join(' ');
    if(!nombre){ omitidos++; return; }
    const telRaw=iTel>=0?String(r[iTel]||'').trim():'';
    const tel=telRaw.replace(/\D/g,'');
    if(tel){ if(seenTel.has(tel)){ dupTel++; return; } if(existentes.has(tel)){ yaExiste++; return; } seenTel.add(tel); }
    let email=iEmail>=0?String(r[iEmail]||'').trim():'';
    let nota=iNota>=0?String(r[iNota]||'').trim():'';
    if(email.toLowerCase().includes('@tuturno.io')){ email=''; nota=nota||'Pendiente: pedir mail real al cobrar'; }
    validos.push({nombre,tel:telRaw,email,nota});
  });
  return {validos,omitidos,dupTel,yaExiste};
}
function abrirImportClientes(){
  const c=document.getElementById('registro-content');
  c.innerHTML=`<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px"><div class="modal-title" style="margin:0">Importar clientes</div><button onclick="closeModal('modal-registro')" style="margin-left:auto;background:var(--s3);border:none;color:var(--muted2);font-size:18px;width:32px;height:32px;border-radius:50%;cursor:pointer">×</button></div>
    <div style="font-size:12px;color:var(--muted2);line-height:1.6;margin-bottom:10px">Subí un CSV o pegá filas de una planilla (por ejemplo, la exportación de AgendaPro). Reconoce las columnas por el título: <b style="color:var(--text)">Nombre(s)/Apellidos, Teléfono, Email</b> (Nota es opcional). Si no hay títulos, toma la 1ª columna como nombre.<br>Los teléfonos repetidos (entre sí o con un cliente que ya existe) se saltean solos. Los mails <b style="color:var(--text)">@tuturno.io</b> (placeholder de AgendaPro) se vacían y quedan marcados "pendiente" para pedirlos al cobrar.</div>
    <div style="display:flex;gap:8px;margin-bottom:10px">
      <label class="btn btn-ghost" style="flex:1;margin:0;padding:10px;font-size:12px;text-align:center;cursor:pointer">📂 Subir archivo<input type="file" accept=".csv,.tsv,.txt" style="display:none" onchange="importClientesArchivo(this)"/></label>
    </div>
    <textarea id="icl-txt" rows="7" placeholder="O pegá acá las filas copiadas de la planilla..." oninput="previewImportClientes()" style="${inpCss};min-height:130px"></textarea>
    <div id="icl-prev" style="font-size:12px;color:var(--muted2);margin:10px 0"></div>
    <button id="icl-btn" class="btn btn-primary" onclick="confirmarImportClientes()" disabled>Importar</button>`;
  openModal('modal-registro');
}
function importClientesArchivo(inp){
  const f=inp.files&&inp.files[0]; if(!f) return;
  const rd=new FileReader(); rd.onload=()=>{ document.getElementById('icl-txt').value=String(rd.result||''); previewImportClientes(); }; rd.readAsText(f,'utf-8');
}
function previewImportClientes(){
  const txt=document.getElementById('icl-txt')?.value||'';
  const prev=document.getElementById('icl-prev'), btn=document.getElementById('icl-btn');
  if(!txt.trim()){ prev.textContent=''; btn.disabled=true; btn.textContent='Importar'; return; }
  const {validos,omitidos,dupTel,yaExiste}=clientesDeTabla(txt);
  prev.innerHTML=`<b style="color:var(--text)">${validos.length}</b> clientes nuevos para cargar${dupTel?` · ${dupTel} teléfonos repetidos en el archivo (se saltean)`:''}${yaExiste?` · ${yaExiste} ya existen por teléfono (se saltean)`:''}${omitidos?` · <span style="color:#fbbf24">${omitidos} filas sin nombre (se saltean)</span>`:''}${validos.length?'<div style="margin-top:6px;color:var(--muted)">'+validos.slice(0,4).map(v=>'• '+escH(v.nombre)+(v.tel?' — '+escH(v.tel):'')+(v.nota?' · '+escH(v.nota):'')).join('<br>')+(validos.length>4?'<br>…':'')+'</div>':''}`;
  btn.disabled=!validos.length; btn.textContent=validos.length?'Importar '+validos.length+' clientes':'Importar';
}
async function confirmarImportClientes(){
  const txt=document.getElementById('icl-txt')?.value||'';
  const {validos}=clientesDeTabla(txt); if(!validos.length) return;
  const btn=document.getElementById('icl-btn'); if(btn){ btn.disabled=true; btn.textContent='Importando…'; }
  await cambiarClientes(list=>{
    let numero=list.reduce((m,c)=>Math.max(m,numV(c.numero)),0);
    const base=Date.now().toString(36);
    const ahora=new Date().toISOString();
    validos.forEach(v=>{
      numero++;
      list.push({id:'c'+numero+'x'+base, numero, nombre:v.nombre, nkey:nkey(v.nombre), profesion:'', tel:v.tel, nacimiento:'', email:v.email, ref:'', nota:v.nota, cumple:'',
        creadoPor:profile.id, creadoPorNombre:profile.name, profs:[], sucursal:null, refPor:null, tarjetas:[], creado:ahora, upd:ahora});
    });
  });
  closeModal('modal-registro'); showToast(validos.length+' clientes importados ✓'); renderAdmin();
}

// ---------- visitas (salen de los cobros) ----------
function fuentesDinero(){
  if(profile.role==='profesional') return [{dd:dineroData,prof:profile}];
  return todosLosUsuarios().filter(u=>esProf(u)).map(u=>{
    let dd={}; try{ dd=JSON.parse(localStorage.getItem('luffy_dinero_'+u.id)||'{}'); }catch(e){}
    return {dd,prof:u};
  });
}
function visitasDeCliente(cid){
  const V=[];
  fuentesDinero().forEach(({dd,prof})=>{
    (dd.turnos||[]).filter(t=>t.clienteId===cid&&!t.deudaId).forEach(t=>{
      const prods=(dd.ventas||[]).filter(v=>v.turnoId===t.id);
      const total=(t.aCobrar!=null?numV(t.aCobrar):numV(t.monto))+prods.reduce((s,v)=>s+numV(v.total),0);
      V.push({fecha:t.fecha, ts:t.creadoEn, prof:prof.name, total, pagado:true, estado:'', turnoId:t.id, reag:t.reag||null, propio:profile.role==='profesional'&&prof.id===profile.id,
        servicios:(t.servicios&&t.servicios.length?t.servicios.map(s=>({n:nomSvc(s),p:numV(s.precio)})):[{n:t.servicio||'Servicio',p:numV(t.monto)}]),
        detalleDesc:t.descDetalle||null, descuento:numV(t.descuento), prepago:numV(t.prepago),
        productos:prods.map(v=>({n:v.productoNombre+' x'+v.cantidad,p:numV(v.total)}))});
    });
    (dd.deudores||[]).filter(d=>d.clienteId===cid).forEach(d=>V.push({
      fecha:d.fecha, ts:d.creadoEn, prof:prof.name, total:numV(d.monto), pagado:!!d.saldado&&!d.anulada, cobrado:(d.saldado&&!d.anulada&&!pagosDe(d).length)?numV(d.monto):pagadoDe(d), pagos:d.pagos||[],
      estado:d.anulada?'Deuda anulada'+(pagadoDe(d)>0?' (pagó '+fp(pagadoDe(d))+')':''):(d.saldado?'Debía, ya pagó':(pagadoDe(d)>0?'Debe '+fp(saldoDeuda(d))+' (pagó '+fp(pagadoDe(d))+')':'Debe')),
      servicios:(d.servicios&&d.servicios.length?d.servicios.map(s=>({n:nomSvc(s),p:numV(s.precio)})):[{n:d.servicio||d.motivo||'Servicio',p:numV(d.montoServicios!=null?d.montoServicios:d.monto)}]),
      detalleDesc:d.descDetalle||null, descuento:numV(d.descuento), prepago:0,
      productos:(d.productos||[]).map(p=>({n:p.productoNombre+' x'+p.cantidad,p:numV(p.total)}))}));
  });
  return V.sort((a,b)=>String(b.ts||b.fecha).localeCompare(String(a.ts||a.fecha)));
}
// Racha de visitas (gamificacion hacia el cliente): meses seguidos con al menos una visita, contando hacia atras desde el actual.
// Default de Claude (a confirmar con Ivo el criterio exacto y si corresponde algun premio ademas del reconocimiento).
function rachaMeses(c){
  const meses=new Set(visitasDeCliente(c.id).map(v=>String(v.fecha).slice(0,7)));
  if(!meses.size) return 0;
  let racha=0; const cursor=new Date();
  while(meses.has(cursor.getFullYear()+'-'+pad2(cursor.getMonth()+1))){ racha++; cursor.setMonth(cursor.getMonth()-1); }
  return racha;
}
function statsCliente(c){
  const V=visitasDeCliente(c.id);
  const fechas=[...new Set(V.map(v=>v.fecha))].sort();
  const gastado=V.reduce((s,v)=>s+(v.cobrado!=null?v.cobrado:(v.pagado?v.total:0)),0);
  const nServ=V.reduce((s,v)=>s+v.servicios.length,0);
  let cada=null;
  if(fechas.length>=2) cada=Math.round(diasEntre(fechas[0],fechas[fechas.length-1])/(fechas.length-1));
  return {visitas:V.length, servicios:nServ, primera:fechas[0]||null, ultima:fechas[fechas.length-1]||null, cada, gastado, V, barberos:[...new Set(V.map(v=>v.prof))]};
}

// ---------- pantalla "Mis clientes" (profesional) ----------
function renderClientes(){
  const body=document.getElementById('clientes-body'); if(!body||!profile) return;
  const mesIni=hoyStr().slice(0,7);
  const mios=misClientesLista();
  const conStats=mios.map(c=>({c,s:statsCliente(c)}));
  const q=nkey(clientesQ);
  const lista=(q?conStats.filter(({c})=>buscarClientes(clientesQ,[c]).length):conStats).sort((a,b)=>String(b.s.ultima||b.c.creado).localeCompare(String(a.s.ultima||a.c.creado)));
  const nuevos=mios.filter(c=>String(c.creado||'').slice(0,7)===mesIni).length;
  const volvieron=conStats.filter(x=>x.s.visitas>=2).length;
  const color=profile.color;
  body.innerHTML=`
    <div class="stat-grid" style="margin-top:14px;grid-template-columns:repeat(3,1fr)">
      <div class="stat-card"><div class="sc-lbl">Clientes</div><div class="sc-val">${mios.length}</div></div>
      <div class="stat-card"><div class="sc-lbl">Nuevos este mes</div><div class="sc-val">${nuevos}</div></div>
      <div class="stat-card"><div class="sc-lbl">Volvieron</div><div class="sc-val">${volvieron}</div><div class="sc-sub">2+ visitas</div></div>
    </div>
    <div style="display:flex;gap:8px;margin-bottom:12px">
      <input type="search" placeholder="Buscar por nombre, profesión o teléfono..." value="${escH(clientesQ)}" oninput="clientesQ=this.value;renderClientes();var e=document.querySelector('#clientes-body input[type=search]');e.focus();e.setSelectionRange(e.value.length,e.value.length);" style="flex:1;min-width:0;background:var(--s1);border:1.5px solid var(--border2);border-radius:12px;padding:11px 14px;color:var(--text);font-family:var(--font);font-size:14px;outline:none"/>
      <button onclick="abrirFormCliente()" style="padding:0 16px;border-radius:12px;border:none;background:${color};color:#fff;font-family:var(--font);font-size:13px;font-weight:800;cursor:pointer;white-space:nowrap">+ Cliente</button>
    </div>
    ${lista.length?lista.map(({c,s})=>`<div class="card" onclick="abrirClienteDetalle('${c.id}')" style="cursor:pointer;margin-bottom:8px">
      <div style="display:flex;align-items:center;gap:10px">
        <div style="flex:1;min-width:0"><div style="font-size:14px;font-weight:800">${escH(c.nombre)}${verNumeroCliente()?` <span style="color:var(--muted2);font-weight:700">#${c.numero}</span>`:''}${(c.tarjetas&&c.tarjetas.length)?' <span title="Tarjeta de fidelidad">💳</span>':''}${(diasHastaCumple(c.cumple)!=null&&diasHastaCumple(c.cumple)<=3)?' 🎂':''}</div>
          <div style="font-size:11px;color:var(--muted2);margin-top:1px">${escH(idCorto(c))}</div>
          <div style="font-size:11.5px;color:var(--muted2);margin-top:2px">${s.visitas?`${s.visitas} ${s.visitas===1?'visita':'visitas'} · última hace ${diasDesdeStr(s.ultima)} d${s.cada?` · viene cada ~${s.cada} d`:''}`:'Todavía sin visitas'}</div></div>
        <div style="text-align:right"><div style="font-size:13px;font-weight:800">${fp(s.gastado)}</div><div style="font-size:10px;color:var(--muted)">gastó</div></div>
      </div></div>`).join(''):`<div class="empty"><div class="e-icon">👥</div><p>${mios.length?'No hay clientes que coincidan.':'Todavía no cargaste clientes.<br>Se cargan al cobrar un turno, o con "+ Cliente".'}</p></div>`}`;
}

// ---------- ficha del cliente ----------
function abrirClienteDetalle(id){
  const c=clienteDe(id); if(!c) return;
  const s=statsCliente(c);
  const cont=document.getElementById('registro-content');
  const fch=(f)=>f?fechaCortaStr(f):'—';
  const todos=profile.role!=='profesional';
  const m=typeof membresiaActivaDe==='function'?membresiaActivaDe(c.id):null;
  const paqs=typeof paquetesAbiertosDe==='function'?paquetesAbiertosDe(c.id):[];
  cont.innerHTML=`<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px"><div class="modal-title" style="margin:0">${escH(c.nombre)}${verNumeroCliente()?` <span style="color:var(--muted2)">#${c.numero}</span>`:''}</div><button onclick="closeModal('modal-registro')" style="margin-left:auto;background:var(--s3);border:none;color:var(--muted2);font-size:18px;width:32px;height:32px;border-radius:50%;cursor:pointer">×</button></div>
    ${c.problematico?`<div class="card" style="margin-bottom:10px;border-color:rgba(244,114,182,.5);background:rgba(244,114,182,.08)"><div style="font-size:12.5px;font-weight:800;color:#f472b6">🗑️ Marcado como cliente problemático</div><div style="font-size:11.5px;color:var(--muted2);margin-top:2px">Va a avisar cuando alguien lo elija para cobrarle o agendarle un turno.</div></div>`:''}
    ${c.crmManual?`<div class="card" style="margin-bottom:10px;border-color:rgba(96,165,250,.4);background:rgba(96,165,250,.08);display:flex;align-items:center;gap:10px"><div style="flex:1"><div style="font-size:12.5px;font-weight:800;color:#60a5fa">📌 Fijado a mano en "${escH((FRANJAS_CRM.find(f=>f[0]===c.crmManual)||[,c.crmManual])[1].replace(/^\S+\s/,''))}" en el tablero del CRM</div></div><button class="lnk" onclick="crmQuitarPin('${c.id}')">Volver a automático</button></div>`:''}
    ${c.antiguedadDeclarada&&!c.veterano?`<div class="card" style="margin-bottom:10px;border-color:rgba(251,191,36,.4);background:rgba(251,191,36,.06)"><div style="font-size:12.5px;font-weight:800;color:#fbbf24">📋 Declaró en su cuenta: "${escH(ANTIGUEDAD_LABEL[c.antiguedadDeclarada]||c.antiguedadDeclarada)}"${c.antiguedadRevision==='mentira'?' · marcado como no verificado':''}</div>${c.antiguedadRevision!=='mentira'?`<div style="display:flex;gap:8px;margin-top:8px"><button class="btn btn-primary" style="flex:1" onclick="revisarAntiguedad('${c.id}','verdad')">✓ Es verdad · dar veterano</button><button class="btn btn-ghost" style="flex:1" onclick="revisarAntiguedad('${c.id}','mentira')">✗ No es cierto</button></div>`:`<button class="lnk" style="margin-top:4px" onclick="revisarAntiguedad('${c.id}','verdad')">Revisar de nuevo</button>`}</div>`:''}
    ${c.veterano?`<div class="card" style="margin-bottom:10px;border-color:rgba(52,211,153,.4);background:rgba(52,211,153,.06);display:flex;align-items:center;gap:10px"><div style="flex:1"><div style="font-size:12.5px;font-weight:800;color:#34d399">🎖️ Cliente veterano</div><div style="font-size:11.5px;color:var(--muted2);margin-top:2px">Declaró: ${escH(ANTIGUEDAD_LABEL[c.antiguedadDeclarada]||'')}</div></div><button class="lnk" onclick="revisarAntiguedad('${c.id}','mentira')">Quitar</button></div>`:''}
    <div style="font-size:12px;color:var(--muted2);margin-bottom:12px;line-height:1.7">🏷️ ${escH(c.profesion||'Sin profesión')}${c.tel?'<br>📞 '+escH(c.tel):''}${c.ref?'<br>🔎 '+escH(c.ref):''}${c.nota?'<br>📝 '+escH(c.nota):''}${todos&&s.barberos.length?'<br>✂️ Se atiende con: '+escH(s.barberos.join(', ')):''}</div>
    <div style="display:flex;gap:8px;margin-bottom:10px">
      <div class="field" style="flex:1"><label>🎂 Cumpleaños${diasHastaCumple(c.cumple)===0?' <b style="color:#fbbf24">¡es hoy!</b>':''}</label>${htmlCumpleRapido(c)}</div>
    </div>
    <div class="field" style="margin-bottom:12px"><label>✉️ Mail</label><input id="cd-email" type="email" placeholder="nombre@mail.com" value="${escH(c.email||'')}" onblur="guardarEmailRapido('${c.id}',this.value)"/></div>
    ${typeof htmlTarjetaCliente==='function'?htmlTarjetaCliente(c):''}
    ${tarjetaConRegaloListo(c)?`<button class="btn btn-ghost" style="width:100%;margin-bottom:10px" onclick="abrirCanjeRegaloProducto('${c.id}')">🎁 Canjear el regalo por un producto (en vez de corte gratis)</button>`:''}
    ${htmlDeudaCliente(c)}${htmlSenaCliente(c)}
    ${m?`<div class="card" style="margin-bottom:10px;border-color:rgba(74,19,107,.4)"><div style="font-size:12px;font-weight:800;color:#4A136B">💳 Membresía activa</div><div style="font-size:13px;margin-top:3px">Le quedan <b>${m.creditos-m.usos.length}</b> de ${m.creditos} cortes · pagó ${fp(m.precio)} el ${fch(m.fecha)}</div></div>`:''}
    ${paqs.map(p=>`<div class="card" style="margin-bottom:10px;border-color:rgba(52,211,153,.4)"><div style="font-size:12px;font-weight:800;color:#34d399">🎁 Paquete pagado (${p.pct}% off)</div><div style="font-size:12.5px;margin-top:3px">Le faltan: ${p.items.filter(i=>!i.usado).map(i=>escH(i.nombre)+(i.coord&&i.coord.fecha?' ('+fechaCortaStr(i.coord.fecha)+(i.coord.hora?' '+i.coord.hora+'hs':'')+')':'')).join(', ')}</div></div>`).join('')}
    <div class="stat-grid" style="grid-template-columns:repeat(3,1fr)">
      <div class="stat-card"><div class="sc-lbl">Visitas</div><div class="sc-val">${s.visitas}</div><div class="sc-sub">${s.servicios} servicios</div></div>
      <div class="stat-card"><div class="sc-lbl">Viene cada</div><div class="sc-val" style="font-size:21px">${s.cada?'~'+s.cada+' d':'—'}</div></div>
      <div class="stat-card"><div class="sc-lbl">Gastó</div><div class="sc-val" style="font-size:22px">${fp(s.gastado)}</div></div>
    </div>
    ${rachaMeses(c)>=2?`<div class="card" style="margin-bottom:10px;border-color:rgba(251,191,36,.4);background:rgba(251,191,36,.08);text-align:center"><div style="font-size:13px;font-weight:800;color:#fbbf24">🔥 Racha de ${rachaMeses(c)} meses seguidos viniendo</div><div style="font-size:11px;color:var(--muted2);margin-top:2px">Se ve, se mide — cliente fiel</div></div>`:''}
    <div style="font-size:11.5px;color:var(--muted2);margin:-4px 0 12px">Primera visita: ${fch(s.primera)} · Última: ${fch(s.ultima)}</div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">
      <button class="btn btn-ghost" style="flex:1;min-width:120px" onclick="abrirFormCliente('${c.id}')">✏️ Editar datos</button>
      <button class="btn btn-ghost" style="flex:1;min-width:120px" onclick="abrirVentaMembresia('${c.id}')">💳 Vender membresía</button>
      <button class="btn btn-ghost" style="flex:1;min-width:120px" onclick="abrirVentaPaquete('${c.id}')">🎁 Vender paquete</button>
      ${typeof tarjetasDisponibles==='function'&&tarjetasDisponibles().some(t=>!(c.tarjetas||[]).some(x=>x.cardId===t.id))?`<button class="btn btn-ghost" style="flex:1;min-width:120px" onclick="activarTarjetaCliente('${c.id}')">⭐ Activar tarjeta</button>`:''}
      <button class="btn btn-ghost" style="flex:1;min-width:120px;color:#f472b6" onclick="toggleClienteProblema('${c.id}')">${c.problematico?'✓ Quitar marca':'🗑️ Marcar problemático'}</button>
    </div>
    ${profile.role==='admin'?`<button class="btn btn-ghost" style="margin-bottom:14px;color:#f472b6" onclick="borrarClienteAdmin('${c.id}')">🗑️ Eliminar cliente</button>`:''}
    <div class="sec-title" style="margin-bottom:8px">Historial</div>
    ${s.V.length?s.V.map(v=>`<div class="card" style="margin-bottom:8px">
      <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:6px"><b style="font-size:13px">${fch(v.fecha)}${todos?` <span style="font-weight:600;color:var(--muted2);font-size:11.5px">· ${escH(v.prof)}</span>`:''}</b><span style="font-size:12px;font-weight:800">${fp(v.total)}</span></div>
      ${v.servicios.map(x=>`<div style="display:flex;justify-content:space-between;font-size:12px;padding:1px 0"><span>${escH(x.n)}</span><span style="color:var(--muted2)">${fp(x.p)}</span></div>`).join('')}
      ${(v.detalleDesc&&v.detalleDesc.length)?v.detalleDesc.map(d=>`<div style="font-size:11px;color:#34d399;padding:1px 0">${escH(d.label)} −${fp(d.monto)}</div>`).join(''):(v.descuento>0?`<div style="font-size:11px;color:#34d399;padding:1px 0">Descuento −${fp(v.descuento)}</div>`:'')}
      ${v.prepago>0?`<div style="font-size:11px;color:#4A136B;padding:1px 0">Ya pagado (membresía/paquete): ${fp(v.prepago)}</div>`:''}
      ${v.productos.map(x=>`<div style="display:flex;justify-content:space-between;font-size:12px;padding:1px 0;color:var(--muted2)"><span>📦 ${escH(x.n)}</span><span>${fp(x.p)}</span></div>`).join('')}
      ${v.estado?`<div style="font-size:11px;color:#f472b6;margin-top:4px;font-weight:700">${v.estado}</div>`:''}
      ${(v.pagos&&v.pagos.length)?`<div style="font-size:11px;color:var(--muted2);margin-top:2px">${v.pagos.map(p=>'Pagó '+fp(p.monto)+' el '+fechaCortaStr(p.fecha)+' ('+medioTxt(p.medio)+')').join(' · ')}</div>`:''}
      ${v.turnoId?`<div style="font-size:11.5px;margin-top:6px;padding-top:6px;border-top:1px solid var(--border);display:flex;gap:8px;align-items:flex-start"><div style="flex:1;color:${v.reag?(v.reag.estado==='si'?'#34d399':'#fbbf24'):'var(--muted)'}">🔁 ${v.reag?escH((REAG_OPC.find(o=>o[0]===v.reag.estado)||[0,v.reag.estado])[1].replace(/^\S+\s/,''))+(v.reag.motivo?' — «'+escH(v.reag.motivo)+'»':''):'Reagendamiento: sin dato'}</div>${v.propio?`<button class="lnk" onclick="abrirReagVisita('${v.turnoId}','${c.id}')">${v.reag?'Editar':'Anotar'}</button>`:''}</div>`:''}
    </div>`).join(''):'<div style="text-align:center;color:var(--muted);font-size:13px;padding:14px">Todavía no tiene visitas.</div>'}`;
  openModal('modal-registro');
}

// Cumpleaños y mail editables desde la ficha por cualquiera (no solo Admin), guardado al toque sin boton aparte
function htmlCumpleRapido(c){
  let [m,d]=(c.cumple||'').split('-').map(Number);
  const st='background:var(--s2);border:1.5px solid var(--border2);border-radius:12px;padding:11px;color:var(--text);font-family:var(--font);font-size:13px;flex:1';
  return `<div style="display:flex;gap:6px">
    <select id="cd-cumple-d" onchange="guardarCumpleRapido('${c.id}')" style="${st}"><option value="">Día</option>${Array.from({length:31},(_,i)=>`<option value="${i+1}" ${d===i+1?'selected':''}>${i+1}</option>`).join('')}</select>
    <select id="cd-cumple-m" onchange="guardarCumpleRapido('${c.id}')" style="${st}"><option value="">Mes</option>${MESES.map((n,i)=>`<option value="${i+1}" ${m===i+1?'selected':''}>${n}</option>`).join('')}</select>
  </div>`;
}
async function guardarCumpleRapido(id){
  const d=document.getElementById('cd-cumple-d')?.value, m=document.getElementById('cd-cumple-m')?.value;
  if(!d||!m) return;
  const cumple=pad2(m)+'-'+pad2(d);
  await cambiarClientes(list=>{ const c=list.find(x=>x.id===id); if(c){ c.cumple=cumple; c.upd=new Date().toISOString(); } });
  showToast('Cumpleaños guardado ✓ 🎂');
}
async function guardarEmailRapido(id,val){
  const c=clienteDe(id); const email=(val||'').trim().toLowerCase();
  if(c&&email===(c.email||'')) return; // no toco nada si no cambio
  if(email&&!/^\S+@\S+\.\S+$/.test(email)){ showToast('El mail no parece válido'); return; }
  await cambiarClientes(list=>{ const x=list.find(z=>z.id===id); if(x){ x.email=email; x.upd=new Date().toISOString(); } });
  showToast('Mail guardado ✓');
}
// Canjear el "regalo" de una tarjeta completa por un producto en vez de un corte gratis (puntos canjeables por productos)
function tarjetaConRegaloListo(c){ return ((c&&c.tarjetas)||[]).find(t=>{ const inf=infoDeTarjeta(t); return inf&&inf.regalo; })||null; }
function abrirCanjeRegaloProducto(clienteId){
  const c=clienteDe(clienteId); const t=tarjetaConRegaloListo(c); if(!t){ showToast('No tiene un regalo listo para canjear'); return; }
  const disp=productos.filter(p=>p.stock>0);
  document.getElementById('registro-content').innerHTML=cabeceraModal('🎁 Canjear por un producto')+
    `<div style="font-size:12px;color:var(--muted2);margin:-6px 0 12px">En vez del corte gratis, ${escH(c.nombre)} se lleva un producto sin cargo.</div>`+
    (disp.length?disp.map(p=>`<button onclick="confirmarCanjeRegaloProducto('${clienteId}','${t.cardId}','${p.id}')" style="width:100%;text-align:left;padding:11px 14px;border-radius:12px;border:1.5px solid var(--border2);background:var(--s2);color:var(--text);font-family:var(--font);font-size:13.5px;font-weight:700;cursor:pointer;margin-bottom:6px;display:flex;justify-content:space-between"><span>${escH(p.nombre)}</span><span style="color:var(--muted2);font-weight:600">stock ${p.stock}</span></button>`).join(''):'<div style="font-size:13px;color:var(--muted)">No hay productos con stock.</div>');
  openModal('modal-registro');
}
async function confirmarCanjeRegaloProducto(clienteId,cardId,productoId){
  const c=clienteDe(clienteId), p=productos.find(x=>x.id===productoId); if(!c||!p) return;
  if(!await uiConfirm('¿Confirmar canje?','Se le entrega "'+p.nombre+'" gratis y se marca el regalo de la tarjeta como usado.',{ok:'Confirmar'})) return;
  const fecha=hoyStr(), creadoEn=new Date().toISOString(), id=Date.now().toString();
  const venta={id:id+'g', turnoId:null, cliente:c.nombre, clienteId:c.id, sucursal:sucursalActual(), productoId:p.id, productoNombre:p.nombre, cantidad:1, precioUnitario:0, total:0, comision:0, costoUnitario:p.costo||0, medio:'efectivo', fecha, creadoEn, regaloTarjeta:true};
  if(profile.role==='profesional') await modificarDineroDe(profile.id,dd=>{ dd.ventas.push(venta); return true; });
  else { if(!dineroData.ventas) dineroData.ventas=[]; dineroData.ventas.push(venta); saveDinero(); }
  ajustarStock([{id:p.id,delta:-1}]);
  await cambiarClientes(list=>{ const x=list.find(z=>z.id===clienteId); const ct=x&&(x.tarjetas||[]).find(tt=>tt.cardId===cardId); if(ct) ct.regalo='usado'; });
  closeModal('modal-registro'); showToast('Canjeado por '+p.nombre+' ✓'); abrirClienteDetalle(clienteId);
}
// ---------- antigüedad autodeclarada por el cliente en /#cuenta -> credencial de veterano ----------
const ANTIGUEDAD_OPCS=[['menos1','Menos de 1 mes'],['algunos','Algunos meses'],['medioanio','Como medio año'],['unanio','Como un año'],['mas','Más de un año']];
const ANTIGUEDAD_LABEL=Object.fromEntries(ANTIGUEDAD_OPCS);
async function revisarAntiguedad(id,veredicto){
  await cambiarClientes(list=>{ const c=list.find(x=>x.id===id); if(c){ c.antiguedadRevision=veredicto; c.veterano=(veredicto==='verdad'); c.upd=new Date().toISOString(); } });
  showToast(veredicto==='verdad'?'Marcado como veterano 🎖️':'Marca de veterano quitada');
  abrirClienteDetalle(id);
}
async function toggleClienteProblema(id){
  const c=clienteDe(id); if(!c) return;
  const marcar=!c.problematico;
  if(marcar&&!await uiConfirm('¿Marcar a '+c.nombre+' como problemático?','Va a aparecer en una lista aparte del CRM ("🗑️ Problemáticos"), y se va a avisar cuando alguien lo elija para cobrarle o agendarle un turno.',{ok:'Marcar',danger:true})) return;
  await cambiarClientes(list=>{ const x=list.find(z=>z.id===id); if(x){ x.problematico=marcar; x.upd=new Date().toISOString(); } });
  showToast(marcar?'Marcado como problemático 🗑️':'Marca quitada ✓');
  abrirClienteDetalle(id);
}
// ---------- eliminar cliente (solo admin, para borrar fichas de prueba o cargadas por error) ----------
async function borrarClienteAdmin(id){
  if(!profile||profile.role!=='admin'){ showToast('Solo el admin puede eliminar clientes'); return; }
  const c=clienteDe(id); if(!c) return;
  const s=statsCliente(c);
  const aviso=s.visitas>0
    ? `Tiene ${s.visitas} ${s.visitas===1?'visita':'visitas'} registradas. Esa historia se conserva en el dinero de cada profesional y en los reportes, pero el cliente deja de aparecer en el buscador y en su ficha.`
    : 'No tiene visitas registradas.';
  if(!await uiConfirm('¿Eliminar a '+c.nombre+'?', aviso+' Esta acción no se puede deshacer.', {ok:'Eliminar',danger:true})) return;
  await cambiarClientes(list=>{ clientesDir=list.filter(x=>x.id!==id); });
  closeModal('modal-registro'); showToast(c.nombre+' eliminado ✓'); refreshCurrentView();
}

// ---------- reagendamiento de una visita (lo edita el profesional que la hizo) ----------
let reagVisitaSel=null;
function abrirReagVisita(turnoId,cid){
  const t=(dineroData.turnos||[]).find(x=>x.id===turnoId); if(!t) return;
  reagVisitaSel={turnoId,cid,estado:(t.reag&&t.reag.estado)||'',motivo:(t.reag&&t.reag.motivo)||''};
  renderReagVisita(); openModal('modal-registro');
}
function renderReagVisita(){
  const s=reagVisitaSel; if(!s) return; const color=profile.color;
  document.getElementById('registro-content').innerHTML=cabeceraModal('Reagendamiento 🔁')+`<div style="font-size:12px;color:var(--muted2);margin-bottom:10px">¿Qué pasó con el próximo turno de este cliente?</div>
    <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px">${REAG_OPC.map(([v,l])=>`<button onclick="reagVisitaEst('${v}')" style="${pillStyle(s.estado===v,color)}">${l}</button>`).join('')}</div>
    ${(s.estado==='no_pregunte'||s.estado==='no_quiso')?`<input type="text" placeholder="Explicación (opcional)" value="${escH(s.motivo)}" oninput="reagVisitaSel.motivo=this.value"/>`:''}
    <button class="btn btn-primary" onclick="guardarReagVisita()" style="background:${color};margin-top:12px">Guardar</button>`;
}
function reagVisitaEst(e){ reagVisitaSel.estado=e; if(e==='si'||e==='recepcion') reagVisitaSel.motivo=''; renderReagVisita(); }
function guardarReagVisita(){
  const s=reagVisitaSel; if(!s) return; const t=(dineroData.turnos||[]).find(x=>x.id===s.turnoId); if(!t) return;
  if(!s.estado){ showToast('Elegí una opción'); return; }
  t.reag={estado:s.estado,motivo:(s.motivo||'').trim(),ts:new Date().toISOString()}; saveDinero();
  if(s.estado==='si') addPuntos(profile.id,'reagendamiento',ptsReag(),'Reagendamiento: '+(t.cliente||'cliente'),'reag:t:'+profile.id+':'+t.id);
  reagVisitaSel=null; showToast('Anotado ✓'); abrirClienteDetalle(s.cid);
}

// ---------- alta / edicion ----------
let formClienteCtx=null;
function abrirFormCliente(id,ctx){
  const c=id?clienteDe(id):null;
  formClienteCtx=ctx||null;
  const v=(k)=>escH(c?c[k]||'':(ctx&&ctx[k])||'');
  const profs=profesionesLista();
  const actual=c?c.profesion:'';
  const enLista=!actual||profs.some(p=>nkey(p)===nkey(actual));
  const conTarjeta=!c&&typeof tarjetasDisponibles==='function'&&tarjetasDisponibles().length;
  const cont=document.getElementById('registro-content');
  cont.innerHTML=`<div style="display:flex;align-items:center;gap:8px;margin-bottom:14px"><div class="modal-title" style="margin:0">${c?'Editar cliente':'Cliente nuevo'}</div><button onclick="${ctx&&(ctx.deCobro||ctx.deProducto)?'renderRegistro()':(ctx&&ctx.deSena?'renderFormSena()':(ctx&&ctx.deCierre?'renderCierre()':`closeModal('modal-registro')`))}" style="margin-left:auto;background:var(--s3);border:none;color:var(--muted2);font-size:18px;width:32px;height:32px;border-radius:50%;cursor:pointer">×</button></div>
    <input type="hidden" id="cl-id" value="${c?c.id:''}"/>
    <div class="field"><label>Nombre y apellido *</label><input id="cl-nombre" placeholder="Ej: Federico Cruz" value="${v('nombre')}"/></div>
    <div class="field" style="margin-top:8px"><label>Profesión * <span style="color:var(--muted);font-weight:500">(define descuentos como el de fuerzas policiales)</span></label>
      <select id="cl-prof" onchange="document.getElementById('cl-prof-otra').style.display=this.value==='__otra'?'':'none'" style="width:100%;background:var(--s2);border:1.5px solid var(--border2);border-radius:12px;padding:12px;color:var(--text);font-family:var(--font);font-size:14px">
        <option value="">Elegí una profesión…</option>
        ${profs.map(p=>`<option value="${escH(p)}" ${enLista&&nkey(p)===nkey(actual)?'selected':''}>${escH(p)}</option>`).join('')}
        <option value="Otra profesión / oficio" ${enLista&&nkey(actual)==='otra profesion / oficio'?'selected':''}>Otra profesión / oficio</option>
        <option value="__otra" ${!enLista?'selected':''}>➕ Escribir otra nueva…</option>
      </select>
      <input id="cl-prof-otra" placeholder="Ej: Albañil, Contador…" value="${!enLista?escH(actual):''}" style="margin-top:6px;${enLista?'display:none':''}"/></div>
    <div class="field" style="margin-top:8px"><label>Teléfono * <span style="color:var(--muted);font-weight:500">(recepción lo necesita para AgendaPro)</span></label><input id="cl-tel" type="tel" placeholder="11 2345 6789" value="${v('tel')}"/></div>
    <div class="field" style="margin-top:8px"><label>🎂 Fecha de nacimiento * <span style="color:var(--muted);font-weight:500">(día, mes y año)</span></label>${htmlCumpleSel(c?c.cumple:'',c?c.nacimiento:'')}</div>
    <div class="field" style="margin-top:8px"><label>⚧ Género <span style="color:var(--muted);font-weight:500">(opcional)</span></label>
      <select id="cl-genero" style="width:100%;background:var(--s2);border:1.5px solid var(--border2);border-radius:12px;padding:12px;color:var(--text);font-family:var(--font);font-size:14px">
        <option value="" ${!c||!c.genero?'selected':''}>Prefiero no decir / sin dato</option>
        <option value="F" ${c&&c.genero==='F'?'selected':''}>Femenino</option>
        <option value="M" ${c&&c.genero==='M'?'selected':''}>Masculino</option>
        <option value="X" ${c&&c.genero==='X'?'selected':''}>Otro</option>
      </select></div>
    <div class="field" style="margin-top:8px"><label>✉️ Mail <span style="color:var(--muted);font-weight:500">(opcional: lo pide recepción)</span></label><input id="cl-email" type="email" placeholder="nombre@mail.com" value="${v('email')}"/></div>
    <div class="field" style="margin-top:8px"><label>¿Cómo reconocerlo? (opcional)</label><input id="cl-ref" placeholder="Ej: el de la moto, trabaja en la farmacia" value="${v('ref')}"/></div>
    <div class="field" style="margin-top:8px"><label>Notas (opcional)</label><input id="cl-nota" placeholder="Ej: le gusta el fade bajo" value="${v('nota')}"/></div>
    ${conTarjeta?`<label class="rub-opt" style="margin-top:10px"><input type="checkbox" id="cl-tarjeta" checked onchange="document.getElementById('cl-refpor-w').style.display=this.checked?'':'none'"/> ⭐ Quiere la tarjeta de fidelidad</label>
      ${conTarjeta&&tarjetasDisponibles().length>1?`<select id="cl-tarjeta-sel" style="${selFin};margin-top:6px">${tarjetasDisponibles().map(t=>`<option value="${t.id}">${escH(t.nombre)} · ${escH(rubrosNombres(t.rubro))}</option>`).join('')}</select>`:''}
      <div class="field" id="cl-refpor-w" style="margin-top:8px"><label>¿Lo refirió alguien? (opcional)</label><input id="cl-refpor" list="cl-refpor-l" placeholder="Nombre de quien lo recomendó"/><datalist id="cl-refpor-l">${clientesDir.filter(x=>x.tarjetas&&x.tarjetas.length).map(x=>`<option value="${escH(x.nombre)}">`).join('')}</datalist></div>`:''}
    <button class="btn btn-primary" onclick="guardarFormCliente()" style="margin-top:14px">${c?'Guardar cambios':'Agregar cliente'}</button>`;
  openModal('modal-registro');
}
async function guardarFormCliente(){
  const val=(i)=>(document.getElementById(i)?.value||'').trim();
  const nombre=val('cl-nombre').replace(/\s+/g,' ');
  if(!nombre){ showToast('Poné el nombre'); return; }
  let prof=val('cl-prof'); if(prof==='__otra') prof=val('cl-prof-otra');
  if(!prof){ showToast('Elegí la profesión del cliente'); return; }
  const id=val('cl-id'), ctx=formClienteCtx;
  const tel=val('cl-tel'); if(tel.replace(/\D/g,'').length<8){ showToast('Poné el teléfono del cliente (con característica)'); return; }
  const nac=leerNacimientoForm(); if(!nac){ showToast('Poné la fecha de nacimiento completa: día, mes y año'); return; }
  const email=val('cl-email').toLowerCase(); if(email&&!/^\S+@\S+\.\S+$/.test(email)){ showToast('El mail no parece válido'); return; }
  const dupMsg=(d)=>{ showToast('Ya existe «'+d.nombre+'»'+(d.profesion?' ('+d.profesion+')':'')+'. Usá ese cliente o agregale algo al nombre para distinguirlo'); };
  if(id){
    const r=await cambiarClientes(list=>{
      const c=list.find(x=>x.id===id); if(!c) return {error:'no'};
      // El chequeo de duplicado solo tiene sentido si el NOMBRE cambia a uno que ya usa otro cliente (evita un
      // alta por error) -- si el nombre queda igual (ej. solo se está completando la fecha de nacimiento de un
      // cliente que por casualidad comparte nombre con otro, algo comun con +1200 clientes importados), no hay
      // que bloquear la edicion: era un falso positivo real, reportado por Ivo, que dejaba el guardado en loop
      // silencioso (mostraba "actualizado" pero nunca guardaba nada, asi que el cobro volvia a pedir el dato
      // sin fin). 28/09/2026.
      if(nkey(nombre)!==c.nkey){
        const dup=list.find(x=>x.id!==id&&x.nkey===nkey(nombre)); if(dup) return {error:'dup',existente:dup};
      }
      Object.assign(c,{nombre,nkey:nkey(nombre),profesion:prof,tel,nacimiento:nac,email,ref:val('cl-ref'),nota:val('cl-nota'),cumple:leerCumpleForm(),genero:val('cl-genero'),upd:new Date().toISOString()});
      return {cliente:c};
    });
    if(r.error==='dup'){ dupMsg(r.existente); return; }
    if(r.error==='no'){ showToast('No se encontró el cliente — probá de nuevo'); return; }
    showToast('Cliente actualizado ✓');
    if(ctx&&ctx.deCobro){ formClienteCtx=null; renderRegistro(); return; }
    if(ctx&&ctx.deCierre){ formClienteCtx=null; renderCierre(); refreshCurrentView(); return; }
    closeModal('modal-registro'); refreshCurrentView(); return;
  }
  let refPor=null; const rn=val('cl-refpor');
  if(rn){ const rc=clientesDir.find(x=>x.nkey===nkey(rn)&&x.tarjetas&&x.tarjetas.length); if(!rc){ showToast('Quien lo refirió tiene que ser un cliente con tarjeta'); return; } refPor=rc.id; }
  const tarj=document.getElementById('cl-tarjeta')?.checked?tarjetaParaRubros((document.getElementById('cl-tarjeta-sel')||{}).value):null;
  const r=await crearCliente({nombre,profesion:prof,tel,nacimiento:nac,email,ref:val('cl-ref'),nota:val('cl-nota'),cumple:leerCumpleForm(),genero:val('cl-genero'),refPor,tarjeta:tarj});
  if(r.error==='dup'){
    if(ctx&&ctx.deCobro){ dupMsg(r.existente); return; }
    dupMsg(r.existente); return;
  }
  showToast('Cliente creado ✓');
  if(ctx&&ctx.deCobro){ cobro.cliente=r.cliente.nombre; cobro.clienteId=r.cliente.id; formClienteCtx=null; renderRegistro(); return; }
  if(ctx&&ctx.deSena){ senaForm.cliente=r.cliente.nombre; senaForm.clienteId=r.cliente.id; formClienteCtx=null; renderFormSena(); return; }
  if(ctx&&ctx.deProducto){ ventaProd.cliente=r.cliente.nombre; ventaProd.clienteId=r.cliente.id; formClienteCtx=null; renderRegistro(); return; }
  closeModal('modal-registro'); refreshCurrentView();
}

// ---------- elegir cliente al cobrar (mini buscador) ----------
function prodClienteInput(v){ ventaProd.cliente=v; const c=clienteDe(ventaProd.clienteId); if(c&&c.nombre!==v) ventaProd.clienteId=null; renderSugerenciasProd(); }
function prodElegirCliente(id){ const c=clienteDe(id); if(!c) return; ventaProd.clienteId=c.id; ventaProd.cliente=c.nombre; const i=document.getElementById('prod-cliente'); if(i) i.value=c.nombre; renderSugerenciasProd(); }
function prodQuitarCliente(){ ventaProd={cliente:'',clienteId:null}; const i=document.getElementById('prod-cliente'); if(i){ i.value=''; i.focus(); } renderSugerenciasProd(); }
function prodAgregarCliente(){ abrirFormCliente(null,{deProducto:true,nombre:(ventaProd.cliente||'').trim()}); }
function renderSugerenciasProd(){
  const el=document.getElementById('prod-cli-sug'); if(!el) return;
  const sel=clienteDe(ventaProd.clienteId);
  if(sel){ el.innerHTML=`<div style="font-size:12px;color:#34d399;font-weight:700;margin-top:6px">✓ ${escH(idCorto(sel))||'Cliente elegido'} <button class="lnk" onclick="prodQuitarCliente()">cambiar</button></div>`; return; }
  const q=(ventaProd.cliente||'').trim(); if(q.length<2){ el.innerHTML=''; return; }
  const m=buscarClientes(q).slice(0,5); const exacto=m.some(c=>c.nkey===nkey(q)); const color=(profile&&profile.color)||'#4A136B';
  el.innerHTML=`<div style="display:flex;flex-direction:column;gap:4px;margin-top:6px">${m.map(c=>`<button onclick="prodElegirCliente('${c.id}')" style="text-align:left;padding:9px 12px;border-radius:10px;border:1.5px solid var(--border2);background:var(--s2);color:var(--text);font-family:var(--font);font-size:13px;font-weight:600;cursor:pointer">${escH(c.nombre)}<div style="font-size:11px;color:var(--muted2);font-weight:500">${escH(idCorto(c))}</div></button>`).join('')}${exacto?'':`<button onclick="prodAgregarCliente()" style="text-align:left;padding:10px 12px;border-radius:10px;border:1.5px dashed ${color};background:transparent;color:${color};font-family:var(--font);font-size:13px;font-weight:800;cursor:pointer">➕ Agregar «${escH(q)}» como cliente nuevo</button>`}</div>`;
}
function cobroClienteInput(v){
  cobro.cliente=v;
  const c=clienteDe(cobro.clienteId); if(c&&c.nombre!==v){ cobro.clienteId=null; cobro.senasSel=[]; }
  renderSugerenciasCliente(); if(typeof refreshCobro==='function') refreshCobro();
}
function avisoSiProblema(c){ if(c&&c.problematico) showToast('🗑️ '+c.nombre+' está marcado como cliente problemático'); }
function cobroElegirCliente(id){
  const c=clienteDe(id); if(!c) return;
  cobro.clienteId=c.id; cobro.cliente=c.nombre; cobroAutoSenas();
  const inp=document.getElementById('turno-nombre'); if(inp) inp.value=c.nombre;
  renderSugerenciasCliente(); refreshCobro();
  avisoSiProblema(c);
}
function cobroQuitarCliente(){ cobro.senasSel=[]; cobro.clienteId=null; cobro.cliente=''; const i=document.getElementById('turno-nombre'); if(i){ i.value=''; i.focus(); } renderSugerenciasCliente(); refreshCobro(); }
function cobroAgregarCliente(){ abrirFormCliente(null,{deCobro:true,nombre:(cobro.cliente||'').trim()}); }
function renderSugerenciasCliente(){
  const el=document.getElementById('cb-cli-sug'); if(!el) return;
  const sel=clienteDe(cobro.clienteId);
  if(sel){
    const s=statsCliente(sel);
    const dc=diasHastaCumple(sel.cumple);
    el.innerHTML=`<div style="font-size:12px;color:#34d399;font-weight:700;margin-top:6px;display:flex;flex-wrap:wrap;gap:6px;align-items:center">✓ ${escH(idCorto(sel))||'Cliente elegido'} · ${s.visitas} ${s.visitas===1?'visita':'visitas'} <button class="lnk" onclick="cobroQuitarCliente()">cambiar</button></div>${dc===0?'<div style="margin-top:6px;padding:8px 12px;border-radius:10px;background:rgba(251,191,36,.15);color:#fbbf24;font-size:12.5px;font-weight:800">🎂 ¡Hoy cumple años! Saludalo</div>':(dc!=null&&dc<=7?`<div style="margin-top:6px;font-size:11.5px;color:#fbbf24">🎂 Cumple el ${cumpleTxt(sel.cumple)} (en ${dc} ${dc===1?'día':'días'})</div>`:'')}`;
    return;
  }
  const q=(cobro.cliente||'').trim();
  if(q.length<2){ el.innerHTML=''; return; }
  const m=buscarClientes(q).slice(0,5);
  const exacto=m.some(c=>c.nkey===nkey(q));
  el.innerHTML=`<div style="display:flex;flex-direction:column;gap:4px;margin-top:6px">${m.map(c=>`<button onclick="cobroElegirCliente('${c.id}')" style="text-align:left;padding:9px 12px;border-radius:10px;border:1.5px solid var(--border2);background:var(--s2);color:var(--text);font-family:var(--font);font-size:13px;font-weight:600;cursor:pointer">${escH(c.nombre)}${(c.tarjetas&&c.tarjetas.length)?' 💳':''}<div style="font-size:11px;color:var(--muted2);font-weight:500">${escH(idCorto(c))}</div></button>`).join('')}
    ${exacto?'':`<button onclick="cobroAgregarCliente()" style="text-align:left;padding:10px 12px;border-radius:10px;border:1.5px dashed ${profile.color};background:transparent;color:${profile.color};font-family:var(--font);font-size:13px;font-weight:800;cursor:pointer">➕ Agregar «${escH(q)}» como cliente nuevo</button>`}</div>`;
}
// Al guardar el cobro: si escribio un nombre hay que haber elegido uno de la lista (o agregarlo); asi no se duplican
function resolverClienteCobro(){
  const nom=(cobro.cliente||'').trim(); if(!nom) return {cli:null};
  const c=clienteDe(cobro.clienteId)||clientesDir.find(x=>x.nkey===nkey(nom));
  if(!c) return {error:'Elegí al cliente de la lista o tocá "➕ Agregar" para cargarlo nuevo'};
  cobro.clienteId=c.id;
  return {cli:c};
}

