// ============ ADMIN ============
function enterAdmin(){
  { const b=document.getElementById('adm-modo'); if(b) b.style.display=(profile&&profile.tambienProf)?'':'none'; }
  loadStoriesData();
  loadPuntosData();
  prefetchAdminTeamData();
  if(adminPollTimer) clearInterval(adminPollTimer);
  adminPollTimer=setInterval(()=>{ if(currentScreenId!=='admin') return; const t=window.adminTab||'panel'; if(t==='panel') prefetchAdminTeamData(); if(t==='contenido') refrescarReels(); }, 30000);
  show('admin');
  document.getElementById('nav').style.display='none';
  renderAdmin();
}

// Pulls every team member's cloud doc the Admin dashboard reads from
// localStorage (dinero por profesional, reagendamientos por recepcionista,
// incidentes globales), so the dashboard reflects data entered on OTHER
// devices, not just whatever happens to be cached on this one.
function prefetchAdminTeamData(){
  cargarCajasAdmin();
  if(!DB) return;
  const targets = allUsers.filter(u=>esProf(u)||u.role==='recepcionista');
  const jobs = targets.map(u=>{
    const cloudKey = u.role==='recepcionista' ? 'luffy/rec_'+u.id : 'luffy/dinero_'+u.id;
    const localKey = u.role==='recepcionista' ? 'luffy_rec_'+u.id : 'luffy_dinero_'+u.id;
    return DB.doc(cloudKey).get().then(r=>{
      if(r){ try{localStorage.setItem(localKey, JSON.stringify(r));}catch(e){} }
    }).catch(()=>{});
  });
  allUsers.filter(u=>u.role==='recepcionista').forEach(u=>{
    jobs.push(DB.doc('luffy/dinero_'+u.id).get().then(r=>{
      if(r){ try{localStorage.setItem('luffy_dinero_'+u.id, JSON.stringify(r));}catch(e){} }
    }).catch(()=>{}));
  });
  allUsers.filter(u=>esProf(u)).forEach(u=>{
    jobs.push(DB.doc('luffy/horario_'+u.id).get().then(r=>{
      if(r){ try{localStorage.setItem('luffy_horario_'+u.id, JSON.stringify(r));}catch(e){} }
    }).catch(()=>{}));
  });
  jobs.push(DB.doc('luffy/productos').get().then(r=>{
    if(r && Array.isArray(r.list)){ productos=r.list; try{localStorage.setItem('luffy_productos', JSON.stringify(productos));}catch(e){} }
  }).catch(()=>{}));
  jobs.push(DB.doc('luffy/cierres_cobro').get().then(r=>{
    if(r && r.byKey){ try{localStorage.setItem('luffy_cierres', JSON.stringify(r));}catch(e){} }
  }).catch(()=>{}));
  jobs.push(DB.doc('luffy/incidentes').get().then(r=>{
    if(r && Array.isArray(r.list)){ try{localStorage.setItem('luffy_incidentes', JSON.stringify(r.list));}catch(e){} }
  }).catch(()=>{}));
  cargarPendientes();
  Promise.all(jobs).then(()=>{ adminUltAct=new Date(); refreshCurrentView(); }).catch(()=>{});
}

const ADMIN_SECCIONES=[
  {id:'panel',ico:mi('panel',16),label:'Inicio'},
  {id:'equipo',ico:mi('equipo',16),label:'Equipo',subs:[['estado','Estado'],['cuentas','Cuentas'],['comisiones','Comisiones'],['asegurado','Piso asegurado'],['tareasequipo','Tareas del equipo'],['stories','Stories'],['puntos','Puntos']]},
  {id:'catalogo',ico:mi('catalogo',16),label:'Catálogo',subs:[['servicios','Servicios'],['combos','Combos y ofertas'],['productos','Stock (para vender)'],['proveedores','Proveedores'],['insumos','Insumos']]},
  {id:'contenido',ico:mi('contenido',16),label:'Contenido',subs:[['banco','Banco de reels'],['reglas','Reglas y prendas']]},
  {id:'clientes',ico:mi('clientes',16),label:'Clientes',subs:[['directorio','Clientes'],['crm','CRM'],['deudas','Deudas'],['senas','Señas'],['membresias','Membresías'],['paquetes','Paquetes'],['tarjetas','Tarjetas']]},
  {id:'finanzas',ico:mi('finanzas',16),label:'Finanzas',subs:[['balance','Balance'],['gastos','Gastos'],['fijos','Gastos fijos'],['deudasequipo','Deudas con el equipo'],['costos','Costo por servicio'],['equilibrio','Punto de equilibrio'],['flujo','Flujo anual'],['caja','Caja']]},
  {id:'recepcion',ico:mi('recepcion',16),label:'Recepción'},
  {id:'config',ico:mi('config',16),label:'Configuración',subs:[['sucursales','Sucursales'],['descuentos','Descuentos'],['reservapublica','Reserva pública'],['faq','Preguntas frecuentes']]},
];
window.adminSub={};

function renderAdmin(){
  const body=document.getElementById('admin-body');
  const st=body.scrollTop;
  let tab=window.adminTab||'panel';
  if(!ADMIN_SECCIONES.find(s=>s.id===tab)) tab='panel';
  const sec=ADMIN_SECCIONES.find(s=>s.id===tab);
  const sub=sec.subs?(window.adminSub[tab]||sec.subs[0][0]):null;
  const nav=`<div class="adm-nav">
    ${ADMIN_SECCIONES.map(s=>`<button class="${s.id===tab?'on':''}" onclick="switchAdminTab('${s.id}')"><span>${s.ico}</span>${s.label}</button>`).join('')}
    
  </div>${sec.subs?`<div class="adm-sub">${sec.subs.map(([id,l])=>`<button class="${id===sub?'on':''}" onclick="switchAdminTab('${id}')">${l}</button>`).join('')}</div>`:''}`;
  body.innerHTML=nav+`<div id="adm-content" class="${tab==='panel'?'':'adm-narrow'}"></div>`;
  const c=document.getElementById('adm-content');
  if(tab==='panel'){ renderAdminPanel(c); c.insertAdjacentHTML('afterbegin',htmlAperturaAdmin()+htmlAseguradosPanel()+htmlCobrosEditadosPanel()+htmlTurnosEliminadosPanel()+htmlOcupacionAdmin()+htmlTareasEquipoWidget()); }
  else if(tab==='equipo'){ if(sub==='stories') renderAdminStories(c); else if(sub==='puntos') renderAdminPuntos(c); else if(sub==='asegurado') renderAdminAsegurado(c); else if(sub==='tareasequipo') renderAdminTareasEquipo(c); else if(sub==='cuentas') renderAdminCuentas(c); else if(sub==='comisiones') renderAdminComisiones(c); else renderAdminEstadoEquipo(c); }
  else if(tab==='catalogo'){ if(sub==='productos') renderAdminProductos(c); else if(sub==='combos') renderAdminCombos(c); else if(sub==='proveedores') renderAdminProveedores(c); else if(sub==='insumos') renderAdminInsumos(c); else renderAdminServicios(c); }
  else if(tab==='contenido'){ if(sub==='reglas') renderAdminReglasReels(c); else renderAdminBanco(c); }
  else if(tab==='clientes') renderAdminClientes(c,sub);
  else if(tab==='finanzas') renderAdminFinanzas(c,sub);
  else if(tab==='recepcion') renderAdminRecepcion(c);
  else if(tab==='config'){ if(sub==='descuentos') adminDescuentos(c); else if(sub==='reservapublica') renderAdminReservaPublica(c); else if(sub==='faq') renderAdminFaq(c); else renderAdminSucursales(c); }
  body.scrollTop=st;
}

// Acepta el id de una seccion o de una sub-seccion (y los ids viejos de las 9 pestañas)
function switchAdminTab(tab){
  const legacy={dashboard:'panel',cumples:'recepcion'};
  tab=legacy[tab]||tab;
  const sec=ADMIN_SECCIONES.find(s=>s.id===tab);
  if(sec){ window.adminTab=sec.id; }
  else {
    const dueño=ADMIN_SECCIONES.find(s=>s.subs&&s.subs.some(x=>x[0]===tab))
      ||(tab==='servicios'||tab==='productos'?ADMIN_SECCIONES.find(s=>s.id==='catalogo'):null);
    if(dueño){ window.adminTab=dueño.id; window.adminSub[dueño.id]=tab; }
  }
  renderAdmin();
  const b=document.getElementById('admin-body'); if(b) b.scrollTop=0;
}

function renderAdminIncidentes(){
  const incs=JSON.parse(localStorage.getItem('luffy_incidentes')||'[]').filter(i=>!i.procesado).slice(0,5);
  if(!incs.length) return '';
  return `<div class="sec-title" style="margin:16px 0 10px">⚠️ Incidentes pendientes (${incs.length})</div>`+
    incs.map(i=>`<div class="card" style="margin-bottom:8px;border-color:rgba(244,114,182,.2)">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
        <div style="font-size:18px">⚠️</div>
        <div style="flex:1"><div style="font-size:13px;font-weight:700">${i.profName}</div><div style="font-size:11px;color:var(--muted2)">${i.razon} · Reportó: ${i.reportadoPor}</div></div>
      </div>
      <div style="display:flex;gap:6px">
        <button onclick="procesarIncidente('${i.id}',true)" style="flex:1;padding:8px;border-radius:10px;border:none;background:rgba(244,114,182,.15);color:#f472b6;font-family:var(--font);font-size:12px;font-weight:700;cursor:pointer">Restar puntos</button>
        <button onclick="procesarIncidente('${i.id}',false)" style="flex:1;padding:8px;border-radius:10px;border:none;background:var(--s2);color:var(--muted2);font-family:var(--font);font-size:12px;font-weight:700;cursor:pointer">Ignorar</button>
      </div>
    </div>`).join('');
}

function saveIncidentes(incs){
  try{localStorage.setItem('luffy_incidentes',JSON.stringify(incs));}catch(e){}
  if(DB){try{DB.doc('luffy/incidentes').set({list:incs});}catch(e){}}
}

async function procesarIncidente(id, restarPuntos){
  const incs=JSON.parse(localStorage.getItem('luffy_incidentes')||'[]');
  const inc=incs.find(i=>i.id===id);
  if(!inc) return;
  if(restarPuntos){
    const pts=await uiPrompt('Restar puntos a '+inc.profName,{msg:inc.razon,label:'Cantidad de puntos',type:'number',value:'10',ok:'Restar'});
    if(pts===null) return;
    if(parseInt(pts)>0) addPuntos(inc.profId,'incidente',-parseInt(pts),inc.razon);
  }
  inc.procesado=true;
  saveIncidentes(incs);
  savePuntosData();
  renderAdmin();
  showToast('Incidente procesado ✓');
}

function renderAdminEstadoEquipo(body){
  const hoy=ymdLocal(new Date());
  const profesionales=allUsers.filter(u=>esProf(u));
  const incsPend=JSON.parse(localStorage.getItem('luffy_incidentes')||'[]').filter(i=>!i.procesado);
  const canjesPend=canjesSolicitudes.filter(s=>s.estado==='pendiente');
  body.innerHTML+=`
    ${htmlCuentasPendientes()}
    <div class="sec-title" style="margin:6px 0 10px">Estado del equipo</div>
    ${profesionales.map(p=>{
      const storiesDone=STORY_TIPOS.filter(t=>storiesData?.[hoy]?.[p.id]?.[t.id]?.done).length;
      const rep=getReputacion(p.id);
      const repInfo=getRepLabel(rep);
      const repColor=getRepColor(rep);
      const pts=getPuntos(p.id).total||0;
      let status='green';
      if(storiesDone<STORY_TIPOS.length||rep<60) status='yellow';
      if(rep<40) status='red';
      const statusColor={green:'#34d399',yellow:'#fbbf24',red:'#f472b6'}[status];
      return `<div class="card" style="margin-bottom:8px;border-color:${statusColor}22">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
          <div class="semaforo" style="background:${statusColor}"></div>
          <div style="width:36px;height:36px;border-radius:50%;background:${p.color}33;display:flex;align-items:center;justify-content:center;font-size:16px">${p.emoji||'✂️'}</div>
          <div style="flex:1"><strong style="font-size:13px">${p.name}</strong><div style="font-size:11px;color:var(--muted2)">${storiesDone}/${STORY_TIPOS.length} stories · ⭐${pts}</div></div>
          <div style="text-align:right"><div style="font-size:11px;font-weight:700;color:${repColor}">${repInfo.emoji} ${repInfo.label}</div><div style="font-size:10px;color:var(--muted2)">Rep: ${rep}%</div></div>
        </div>
        <div class="rep-bar"><div class="rep-fill" style="width:${rep}%;background:${repColor}"></div></div>
        <div style="display:flex;align-items:center;gap:8px;margin-top:10px;font-size:11.5px;color:var(--muted2)"><span style="flex:1">🏷️ ${(p.rubros&&p.rubros.length)?escH(p.rubros.map(nombreRubro).filter(Boolean).join(', ')):'<i>Todos los rubros (sin asignar)</i>'}</span><button class="lnk" onclick="abrirRubrosProf('${p.id}')">Cambiar</button></div>
        <div style="display:flex;align-items:center;gap:8px;margin-top:8px;font-size:11.5px;color:var(--muted2)"><span style="flex:1">${sucursalesDe(p).map(x=>chipSucursal(x)).join(' ')||'<i>Sin sucursal asignada</i>'}</span><button class="lnk" onclick="abrirSucursalProf('${p.id}')">Cambiar</button><button class="lnk" onclick="editarCuenta('${p.id}')">Editar cuenta</button></div>
        <div style="display:flex;align-items:center;gap:8px;margin-top:8px;font-size:11.5px;color:var(--muted2)"><span style="flex:1">${p.esEncargado?'📦 <b style="color:#34d399">Encargado</b> · controla el stock · comisión fija <b style="color:var(--text)">'+comisionFijaDe(p)+'%</b> <button class="lnk" onclick="editarComisionFija(\''+p.id+'\')">cambiar %</button>':'📦 No es encargado'}</span><button class="lnk" onclick="toggleEncargado('${p.id}')">${p.esEncargado?'Quitar':'Hacer encargado'}</button></div>
      </div>`;
    }).join('')||'<div class="empty"><div class="e-icon">👥</div><p>Sin profesionales.</p></div>'}

    ${incsPend.length||canjesPend.length?`
    <div class="sec-title" style="margin:14px 0 10px">⚠️ Alertas</div>
    <div class="card">
      ${incsPend.map(i=>`<div class="alert-item"><span style="font-size:16px">⚠️</span><div style="flex:1;font-size:12px"><strong>${i.profName}</strong> — ${i.razon}</div><button onclick="procesarIncidente('${i.id}',true)" style="padding:4px 10px;border-radius:8px;border:none;background:rgba(244,114,182,.15);color:#f472b6;font-family:var(--font);font-size:11px;font-weight:700;cursor:pointer">Ver</button></div>`).join('')}
      ${canjesPend.map(s=>`<div class="alert-item"><span style="font-size:16px">🎁</span><div style="flex:1;font-size:12px"><strong>${s.profName}</strong> quiere canjear ${s.canjeLabel}</div><button onclick="switchAdminTab('puntos')" style="padding:4px 10px;border-radius:8px;border:none;background:rgba(74,19,107,.15);color:#4A136B;font-family:var(--font);font-size:11px;font-weight:700;cursor:pointer">Ver</button></div>`).join('')}
    </div>`:''}
  `;
}

function renderAdminStories(body){
  const hoy = ymdLocal(new Date());
  const diaKeys=['dom','lun','mar','mie','jue','vie','sab'];
  const hoyKey=diaKeys[new Date().getDay()];
  const profesionales = allUsers.filter(p=>esProf(p));
  const html = profesionales.map(p=>{
    const done = STORY_TIPOS.filter(t=>storiesData?.[hoy]?.[p.id]?.[t.id]?.done).length;
    const color = p.color;
    let horarioHoy=null;
    try{ const h=JSON.parse(localStorage.getItem('luffy_horario_'+p.id)||'null'); if(h && h[hoyKey]?.activo) horarioHoy=h[hoyKey]; }catch(e){}
    const movs = STORY_TIPOS.map(t=>{
      const check = storiesData?.[hoy]?.[p.id]?.[t.id];
      const hora = check?.ts ? new Date(check.ts).toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit'}) : '';
      return `<div style="display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid var(--border)">
        <div style="font-size:16px">${t.emoji}</div>
        <div style="flex:1;font-size:12px">${t.label}</div>
        ${check?.done?`<div style="font-size:11px;color:#34d399;font-weight:700">✓ ${hora}</div>`:
        `<div style="font-size:11px;color:var(--muted)">Pendiente</div>`}
      </div>`;
    }).join('');
    return `<div class="prof-card" style="margin-bottom:10px">
      <div class="pc-hdr">
        <div class="pc-av" style="background:${color}33;border-color:${color}">${p.emoji}</div>
        <div class="pc-info"><strong>${p.name}</strong><span>${done}/${STORY_TIPOS.length} stories hoy · ${horarioHoy?'trabaja '+horarioHoy.inicio+'–'+horarioHoy.fin:'no trabaja hoy'}</span></div>
        <div style="margin-left:auto;display:flex;gap:3px">${STORY_TIPOS.map((_,i)=>`<span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:${i<done?'#34d399':'var(--border2)'}"></span>`).join('')}</div>
      </div>
      <div style="height:4px;background:var(--border2);border-radius:2px;margin-bottom:12px;overflow:hidden"><div style="height:100%;width:${Math.round((done/STORY_TIPOS.length)*100)}%;background:#34d399"></div></div>
      ${movs}
    </div>`;
  }).join('');
  body.innerHTML += `<div class="sec-hdr" style="margin-bottom:12px"><span class="sec-title">Stories de hoy</span><button onclick="editarHorariosStories()" style="background:none;border:none;color:var(--muted2);font-family:var(--font);font-size:11px;font-weight:600;cursor:pointer">⏰ Horarios sugeridos</button></div>${htmlStoriesRecAdmin()}${html}`;
}

// ============ ADMIN: PANEL INTERACTIVO ============
let adminPanel={periodo:'quincena', prof:'todos', dia:null, futMes:null, series:{cortes:true, productos:true}};
let adminUltAct=null;
let adminPollTimer=null;

const numV=(x)=>parseFloat(x)||0;
const escH=(s)=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const MESES=['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
const DIAS_SEM=['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
const COL={cortes:'#4A136B', prod:'#34d399', rosa:'#f472b6', oro:'#fbbf24', azul:'#60a5fa', mp:'#009ee3'};

// Las fechas se guardan como YYYY-MM-DD (UTC, igual que el resto de la app): se comparan como texto
function hoyStr(){ return ymdLocal(new Date()); }
function addDias(s,n){ const d=new Date(s+'T00:00:00Z'); d.setUTCDate(d.getUTCDate()+n); return d.toISOString().split('T')[0]; }
function diasEntre(a,b){ return Math.round((new Date(b+'T00:00:00Z')-new Date(a+'T00:00:00Z'))/86400000); }
function finMesUTC(y,m){ return new Date(Date.UTC(y,m,0)).getUTCDate(); }
function pad2(n){ return String(n).padStart(2,'0'); }
function quincenaKey(f){ const p=f.split('-'); return p[0]+'-'+p[1]+'-'+(Number(p[2])<=15?1:2); }
function fpk(n){ n=Math.round(n); const a=Math.abs(n); if(a>=1e6) return (n<0?'-':'')+'$'+(a/1e6).toFixed(a>=1e7?0:1).replace('.0','')+'M'; if(a>=1e3) return (n<0?'-':'')+'$'+Math.round(a/1e3)+'k'; return '$'+n; }
function fechaCortaStr(f){ const p=f.split('-'); return p[2]+'/'+p[1]; }

function rangoPeriodo(key){
  const hoy=hoyStr(); const [y,m,d]=hoy.split('-').map(Number);
  const ms=(yy,mm)=>yy+'-'+pad2(mm);
  const mesAnt=(yy,mm)=>mm===1?[yy-1,12]:[yy,mm-1];
  let desde,hasta,prevDesde,prevHasta,label;
  if(key==='hoy'){ desde=hasta=hoy; prevDesde=prevHasta=addDias(hoy,-1); label='Hoy'; }
  else if(key==='7d'){ desde=addDias(hoy,-6); hasta=hoy; prevDesde=addDias(hoy,-13); prevHasta=addDias(hoy,-7); label='Últimos 7 días'; }
  else if(key==='quincena'){
    if(d<=15){ const [py,pm]=mesAnt(y,m); desde=ms(y,m)+'-01'; hasta=ms(y,m)+'-15'; prevDesde=ms(py,pm)+'-16'; prevHasta=ms(py,pm)+'-'+finMesUTC(py,pm); label='Quincena 1 al 15 de '+MESES[m-1]; }
    else { desde=ms(y,m)+'-16'; hasta=ms(y,m)+'-'+finMesUTC(y,m); prevDesde=ms(y,m)+'-01'; prevHasta=ms(y,m)+'-15'; label='Quincena 16 al '+finMesUTC(y,m)+' de '+MESES[m-1]; }
  }
  else if(key==='mes'){ const [py,pm]=mesAnt(y,m); desde=ms(y,m)+'-01'; hasta=ms(y,m)+'-'+finMesUTC(y,m); prevDesde=ms(py,pm)+'-01'; prevHasta=ms(py,pm)+'-'+finMesUTC(py,pm); label=MESES[m-1]+' '+y; }
  else { const [py,pm]=mesAnt(y,m); const [qy,qm]=mesAnt(py,pm); desde=ms(py,pm)+'-01'; hasta=ms(py,pm)+'-'+finMesUTC(py,pm); prevDesde=ms(qy,qm)+'-01'; prevHasta=ms(qy,qm)+'-'+finMesUTC(qy,qm); label=MESES[pm-1]+' '+py; }
  // si el periodo esta en curso, se compara solo contra el mismo tramo del anterior
  if(hoy>=desde&&hoy<hasta){ const lim=addDias(prevDesde,diasEntre(desde,hoy)); if(lim<prevHasta) prevHasta=lim; }
  return {key,desde,hasta,prevDesde,prevHasta,label:label.charAt(0).toUpperCase()+label.slice(1)};
}

// Turnos futuros: por defecto "desde hoy hasta fin de este mes", pero se puede elegir cualquier otro mes
// completo (ahi arranca del dia 1). Es lo que ya esta agendado y todavia no se cobro (agEstado==='agendado'),
// no se mezcla con D.turnos (eso es historial ya cobrado, otra fuente de datos).
function turnosFuturosRango(mesSel){
  const hoy=hoyStr(), [y,m]=mesSel.split('-').map(Number);
  const desdeMes=mesSel+'-01', hasta=mesSel+'-'+pad2(finMesUTC(y,m));
  return {desde:desdeMes<hoy?hoy:desdeMes, hasta};
}
// Facturacion = suma del precio de lista de los servicios de cada turno agendado (no existe un monto
// cargado en la agenda todavia, eso se termina de definir recien al cobrar -- ver reserva publica). Es un
// estimado "si se cumplen todos", igual que ya se le avisa al cliente en /#reserva.
// Ingreso/egreso: se reparte con la misma proporcion ingreso/comision que tiene el periodo ya facturado
// (cur), en vez de recalcular el % de comision de cada profesional para una quincena que ni termino.
function turnosFuturosResumen(desde,hasta,profF,cur){
  const T=agendaSt.list.filter(a=>agEsActivo(a)&&a.fecha>=desde&&a.fecha<=hasta&&coincideProf(allUsers.find(u=>u.id===a.profId),profF));
  const fact=T.reduce((s,a)=>s+(a.servicios||[]).reduce((s2,sv)=>s2+numV((servicios.find(x=>x.id===sv.svcId)||{}).precio),0),0);
  const ratioEgreso=cur.fact?cur.comEq/cur.fact:0;
  const egreso=Math.round(fact*ratioEgreso);
  return {nT:T.length,fact,ingreso:fact-egreso,egreso};
}

function adminDatos(){
  const turnos=[], ventas=[], deudas=[], anuladas=[];
  todosLosUsuarios().filter(u=>esProf(u)||u.role==='recepcionista').forEach(u=>{
    let dd={}; try{ dd=JSON.parse(localStorage.getItem('luffy_dinero_'+u.id)||'{}'); }catch(e){}
    normalizarFechas(dd);
    (dd.turnos||[]).forEach(t=>turnos.push({...t,prof:u}));
    (dd.ventas||[]).forEach(v=>ventas.push({...v,vendedor:u}));
    (dd.deudores||[]).filter(x=>!x.saldado).forEach(x=>deudas.push({...x,prof:u}));
    (dd.deudores||[]).filter(x=>x.anulada).forEach(x=>anuladas.push({...x,prof:u}));
  });
  return {turnos,ventas,deudas,anuladas};
}

// El % de comision de cada profesional depende de lo que facture en TODA la quincena,
// asi que se calcula sobre la quincena completa y se aplica a la parte que cae en el periodo.
function pctPorQuincena(D){
  const fact={};
  D.turnos.forEach(t=>{ if(!t.fecha) return; const k=t.prof.id+'|'+quincenaKey(t.fecha); fact[k]=(fact[k]||0)+numV(t.monto); });
  const pct={};
  Object.keys(fact).forEach(k=>{
    const [uid,qk]=k.split('|'); const u=todosLosUsuarios().find(x=>x.id===uid);
    const reelsQ=reels.filter(r=>r.stage==='publicado'&&u&&r.asignado===u.name&&r.fecha&&quincenaKey(r.fecha)===qk).length;
    pct[k]=calcComision(fact[k],reelsQ,u,qStart(qk)).pct;
  });
  return pct;
}

function costoVenta(v){ return (v.costoUnitario!=null?numV(v.costoUnitario):numV((productos.find(x=>x.id===v.productoId)||{}).costo))*numV(v.cantidad); }

// El filtro del panel puede ser 'todos', el id de una persona o 'suc:ID' (toda una sucursal)
function coincideProf(u,f){ if(f==='todos') return true; if(String(f).startsWith('suc:')) return !!u&&sucursalesDe(u).includes(f.slice(4)); return !!u&&u.id===f; }
function panelResumen(D,pctMap,desde,hasta,profF){
  const enR=(f)=>f&&f>=desde&&f<=hasta;
  const T=D.turnos.filter(t=>enR(t.fecha)&&coincideProf(t.prof,profF));
  const V=D.ventas.filter(v=>enR(v.fecha)&&coincideProf(v.vendedor,profF));
  const r={T,V};
  r.fact=T.reduce((s,t)=>s+numV(t.monto),0);
  r.nT=T.length;
  r.comEq=T.reduce((s,t)=>s+comTurno(t,pctMap[t.prof.id+'|'+quincenaKey(t.fecha)]||0),0)+extrasAsegurado(D,desde,hasta).filter(x=>coincideProf(x.prof,profF)).reduce((s,x)=>s+extraAplicable(x),0);
  r.quedaCortes=r.fact-r.comEq;
  r.ticket=r.nT?r.fact/r.nT:0;
  r.prodVendido=V.reduce((s,v)=>s+numV(v.total),0);
  r.prodCom=V.reduce((s,v)=>s+numV(v.comision),0);
  r.prodCosto=V.reduce((s,v)=>s+costoVenta(v),0);
  r.unidades=V.reduce((s,v)=>s+numV(v.cantidad),0);
  r.quedaProd=r.prodVendido-r.prodCosto-r.prodCom;
  r.ganancia=r.quedaCortes+r.quedaProd;
  r.descTotal=T.reduce((s,t)=>s+numV(t.descuento),0);
  r.subtotalLista=T.reduce((s,t)=>s+(t.subtotal!=null?numV(t.subtotal):numV(t.monto)),0);
  r.medios={efectivo:0,mp:0,tarjeta:0};
  T.forEach(t=>{ if(r.medios[t.medio]!=null) r.medios[t.medio]+=numV(t.monto); });
  V.forEach(v=>{ if(r.medios[v.medio]!=null) r.medios[v.medio]+=numV(v.total); });
  return r;
}

// ---------- tooltip global ----------
(function(){
  let tip=null;
  const get=()=>tip||(tip=Object.assign(document.body.appendChild(document.createElement('div')),{id:'adm-tip'}));
  document.addEventListener('mouseover',e=>{ const el=e.target.closest&&e.target.closest('[data-tip]'); if(!el){ if(tip) tip.style.display='none'; return; } const txt=el.getAttribute('data-tip'); if(!txt){ if(tip) tip.style.display='none'; return; } const t=get(); t.textContent=txt; t.style.display='block'; });
  document.addEventListener('mousemove',e=>{ if(!tip||tip.style.display==='none') return; const w=tip.offsetWidth; tip.style.left=Math.min(window.innerWidth-w-8,e.clientX+14)+'px'; tip.style.top=(e.clientY+16)+'px'; });
  document.addEventListener('mouseout',e=>{ if(tip&&!(e.relatedTarget&&e.relatedTarget.closest&&e.relatedTarget.closest('[data-tip]'))) tip.style.display='none'; });
})();

// ---------- acciones ----------
function adminPanelPeriodo(k){ adminPanel.periodo=k; adminPanel.dia=null; renderAdmin(); }
function adminPanelFutMes(delta){
  const mesActual=hoyStr().slice(0,7);
  const base=adminPanel.futMes||mesActual;
  const [y,m]=base.split('-').map(Number);
  const d=new Date(Date.UTC(y,m-1+delta,1));
  const nuevo=d.getUTCFullYear()+'-'+pad2(d.getUTCMonth()+1);
  if(nuevo<mesActual) return; // turnos futuros no retrocede antes de este mes
  adminPanel.futMes=nuevo;
  renderAdmin();
}
function adminPanelProfSet(id){ adminPanel.prof=id; adminPanel.dia=null; renderAdmin(); }
function adminPanelProfToggle(id){ adminPanelProfSet(adminPanel.prof===id?'todos':id); }
function adminPanelDia(f){ adminPanel.dia=(adminPanel.dia===f?null:f); renderAdmin(); }
function adminPanelSerie(k){ adminPanel.series[k]=!adminPanel.series[k]; if(!adminPanel.series.cortes&&!adminPanel.series.productos) adminPanel.series[k]=true; renderAdmin(); }
function adminPanelRefrescar(){ showToast('Actualizando…'); if(DB) prefetchAdminTeamData(); else { adminUltAct=new Date(); renderAdmin(); } }

function adminExportCSV(){
  const u=window.__adminUlt; if(!u) return;
  const q=(s)=>'"'+String(s==null?'':s).replace(/"/g,'""')+'"';
  const hora=(iso)=>iso?new Date(iso).toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit'}):'';
  const rows=[['Fecha','Hora','Tipo','Quien','Cliente','Detalle','Medio','Monto','Descuento','Comision','Costo']];
  u.cur.T.forEach(t=>rows.push([t.fecha,hora(t.creadoEn),'Turno',t.prof.name,t.cliente||'',t.servicio||'',t.medio||'',numV(t.monto),numV(t.descuento),'','']));
  u.cur.V.forEach(v=>rows.push([v.fecha,hora(v.creadoEn),'Producto',v.vendedor.name,v.cliente||'',v.productoNombre+' x'+v.cantidad,v.medio||'',numV(v.total),'',numV(v.comision),costoVenta(v)]));
  rows.sort((a,b)=>String(a[0]+a[1]).localeCompare(b[0]+b[1]));
  const csv='﻿'+rows.map(r=>r.map(q).join(';')).join('\r\n');
  const a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
  a.download='inda-'+u.rango.desde+'_'+u.rango.hasta+'.csv';
  document.body.appendChild(a); a.click(); a.remove();
  showToast('Descargando '+(rows.length-1)+' movimientos ✓');
}

// ---------- graficos SVG ----------
function niceMax(v){ if(v<=0) return 1; const e=Math.pow(10,Math.floor(Math.log10(v))); for(const m of [1,2,2.5,5,10]) if(v<=m*e) return m*e; return 10*e; }

function svgDias(dias,ver,hoy,sel){
  const W=760,H=250,pl=48,pr=8,pt=10,pb=26;
  const tot=(d)=>(ver.cortes?d.cortes:0)+(ver.productos?d.prod:0);
  const max=niceMax(Math.max(0,...dias.map(tot)));
  const bw=(W-pl-pr)/dias.length, ih=H-pt-pb;
  const y=(v)=>pt+ih*(1-v/max);
  let s=`<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;display:block">`;
  for(let i=0;i<=4;i++){ const yy=pt+ih*(1-i/4); s+=`<line x1="${pl}" x2="${W-pr}" y1="${yy}" y2="${yy}" stroke="var(--border)" stroke-width="1"/><text x="${pl-6}" y="${yy+3}" text-anchor="end" font-size="10" fill="var(--muted)">${fpk(max*i/4)}</text>`; }
  const paso=Math.ceil(dias.length/16);
  dias.forEach((d,i)=>{
    const x=pl+i*bw+bw*.14, w=bw*.72;
    const futuro=d.f>hoy;
    const hC=ver.cortes?ih*d.cortes/max:0, hP=ver.productos?ih*d.prod/max:0;
    const tip=`${DIAS_SEM[new Date(d.f+'T00:00:00Z').getUTCDay()]} ${fechaCortaStr(d.f)}\nCortes: ${fp(d.cortes)} (${d.nT} turnos)\nProductos: ${fp(d.prod)}\nTotal: ${fp(d.cortes+d.prod)}`;
    s+=`<g data-tip="${escH(tip)}" onclick="adminPanelDia('${d.f}')" style="cursor:pointer">
      <rect x="${pl+i*bw}" y="${pt}" width="${bw}" height="${ih}" fill="${sel===d.f?'rgba(74,19,107,.14)':'transparent'}"/>
      ${hC>0?`<rect x="${x}" y="${pt+ih-hC}" width="${w}" height="${hC}" rx="2" fill="${COL.cortes}"/>`:''}
      ${hP>0?`<rect x="${x}" y="${pt+ih-hC-hP}" width="${w}" height="${hP}" rx="2" fill="${COL.prod}"/>`:''}
      ${!hC&&!hP&&!futuro?`<rect x="${x}" y="${pt+ih-1.5}" width="${w}" height="1.5" fill="var(--border2)"/>`:''}
    </g>`;
    if(i%paso===0) s+=`<text x="${pl+i*bw+bw/2}" y="${H-8}" text-anchor="middle" font-size="10" fill="${d.f===hoy?'var(--accent)':'var(--muted)'}" font-weight="${d.f===hoy?800:500}">${Number(d.f.split('-')[2])}</text>`;
  });
  return s+'</svg>';
}

function svgDonut(items,total){
  const R=54,C=2*Math.PI*R;
  let off=0, s=`<svg viewBox="0 0 140 140" style="width:150px;height:150px;flex-shrink:0"><circle cx="70" cy="70" r="${R}" fill="none" stroke="var(--s3)" stroke-width="22"/>`;
  items.filter(i=>i.v>0).forEach(i=>{
    const len=C*i.v/total;
    s+=`<circle cx="70" cy="70" r="${R}" fill="none" stroke="${i.c}" stroke-width="22" stroke-dasharray="${len} ${C-len}" stroke-dashoffset="${-off}" transform="rotate(-90 70 70)" data-tip="${escH(i.l+': '+fp(i.v)+' ('+Math.round(i.v/total*100)+'%)')}" style="cursor:default"/>`;
    off+=len;
  });
  return s+`<text x="70" y="66" text-anchor="middle" font-size="9" fill="var(--muted)" font-weight="700">COBRADO</text><text x="70" y="82" text-anchor="middle" font-size="15" fill="var(--text)" font-weight="900">${fpk(total)}</text></svg>`;
}

function hbar(label,valTxt,pct,color,opts={}){
  return `<div class="hb ${opts.click?'clickable':''} ${opts.sel?'sel':''}" ${opts.click?`onclick="${opts.click}"`:''} ${opts.tip?`data-tip="${escH(opts.tip)}"`:''}>
    <div style="display:flex;justify-content:space-between;gap:8px;font-size:12px;margin-bottom:3px"><span style="font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${label}</span><span style="font-weight:800;white-space:nowrap">${valTxt}</span></div>
    <div style="height:7px;background:var(--s3);border-radius:4px;overflow:hidden"><div style="height:100%;width:${Math.max(2,Math.min(100,pct))}%;background:${color};border-radius:4px"></div></div>
    ${opts.sub?`<div style="font-size:10.5px;color:var(--muted2);margin-top:3px">${opts.sub}</div>`:''}
  </div>`;
}
function deltaHtml(cur,prev,neutral){
  if(!prev&&!cur) return '<span class="dl">—</span>';
  if(!prev) return '<span class="dl up">nuevo</span>';
  const p=(cur-prev)/prev*100, up=p>=0;
  return `<span class="dl ${neutral?'nt':(up?'up':'down')}">${up?'▲':'▼'} ${Math.abs(Math.round(p))}%</span>`;
}
function pnl(cls,titulo,inner,extra=''){ return `<div class="pnl ${cls}"><div class="pnl-h"><h3>${titulo}</h3>${extra}</div>${inner}</div>`; }
const vacio=(t)=>`<div style="font-size:12px;color:var(--muted);padding:14px 4px;text-align:center">${t}</div>`;

// Resumen semanal para Ivo: no hay envio automatico por WhatsApp (sin API de WhatsApp Business), asi que se genera
// el texto y lo manda el mismo a mano/lo revisa, mismo patron "cola manual" que el resto de la app.
function resumenSemanalTexto(){
  const hasta=hoyStr(), desde=addDias(hasta,-6);
  const D=adminDatos(), pctMap=pctPorQuincena(D);
  const r=panelResumen(D,pctMap,desde,hasta,'todos');
  const resenasBuenas=r.T.filter(t=>t.resenaSent==='buena').length, resenasMalas=r.T.filter(t=>t.resenaSent==='mala').length;
  const stockBajo=productos.filter(p=>numV(p.stock)<=numV(p.alertaStock));
  const deudas=todasLasDeudas(), totalDeuda=deudas.reduce((s,d)=>s+saldoDeuda(d),0);
  const contactarN=contactosPendientesSt.list.filter(x=>!x.atendido).length;
  let txt='📊 Resumen de la semana — Inda Studio\n'+fechaCortaStr(desde)+' al '+fechaCortaStr(hasta)+'\n\n'+
    '💰 Facturado: '+fp(r.fact)+' ('+r.nT+' turno'+(r.nT===1?'':'s')+', ticket promedio '+fp(r.ticket)+')\n'+
    '📦 Productos vendidos: '+fp(r.prodVendido)+'\n'+
    '⭐ Reseñas: '+resenasBuenas+' buenas'+(resenasMalas?', '+resenasMalas+' malas':'');
  const alertas=[];
  if(totalDeuda>0) alertas.push('🚫 '+deudas.length+' cliente'+(deudas.length===1?'':'s')+' debe'+(deudas.length===1?'':'n')+' '+fp(totalDeuda));
  if(stockBajo.length) alertas.push('📦 '+stockBajo.length+' producto'+(stockBajo.length===1?'':'s')+' con poco stock');
  if(contactarN) alertas.push('📞 '+contactarN+' cliente'+(contactarN===1?'':'s')+' para contactar');
  txt+=alertas.length?'\n\n⚠️ Alertas:\n'+alertas.map(a=>'· '+a).join('\n'):'\n\n✅ Sin alertas pendientes.';
  return txt;
}
function compartirResumenSemanal(){ window.open('https://api.whatsapp.com/send?text='+encodeURIComponent(resumenSemanalTexto()),'_blank'); }
function renderAdminPanel(c){
  const P=adminPanel;
  const hoy=hoyStr();
  const rango=rangoPeriodo(P.periodo);
  const D=adminDatos();
  const pctMap=pctPorQuincena(D);
  const cur=panelResumen(D,pctMap,rango.desde,rango.hasta,P.prof);
  const prev=panelResumen(D,pctMap,rango.prevDesde,rango.prevHasta,P.prof);
  window.__adminUlt={rango,cur};
  if(!adminUltAct) adminUltAct=new Date();

  if(!P.futMes) P.futMes=hoy.slice(0,7);
  const futRango=turnosFuturosRango(P.futMes);
  const fut=turnosFuturosResumen(futRango.desde,futRango.hasta,P.prof,cur);
  const [futY,futM]=P.futMes.split('-').map(Number);
  const futEsMesActual=P.futMes===hoy.slice(0,7);

  const profSel=String(P.prof).startsWith('suc:')?{name:'sucursal '+((sucursalDe(P.prof.slice(4))||{}).nombre||'')}:allUsers.find(u=>u.id===P.prof);
  const equipo=allUsers.filter(u=>esProf(u));
  const vendedores=allUsers.filter(u=>esProf(u)||u.role==='recepcionista');

  // stock (foto de hoy)
  const stockU=productos.reduce((s,p)=>s+numV(p.stock),0);
  const stockCosto=productos.reduce((s,p)=>s+numV(p.stock)*numV(p.costo),0);
  const stockVenta=productos.reduce((s,p)=>s+numV(p.stock)*numV(p.precioVenta),0);
  const stockBajo=productos.filter(p=>numV(p.stock)<=numV(p.alertaStock));

  // por dia
  const dias=[]; for(let f=rango.desde;f<=rango.hasta;f=addDias(f,1)) dias.push({f,cortes:0,prod:0,nT:0});
  const idx={}; dias.forEach((d,i)=>idx[d.f]=i);
  cur.T.forEach(t=>{ const d=dias[idx[t.fecha]]; if(d){ d.cortes+=numV(t.monto); d.nT++; } });
  cur.V.forEach(v=>{ const d=dias[idx[v.fecha]]; if(d) d.prod+=numV(v.total); });

  // ranking equipo (cortes)
  const rank=equipo.map(p=>{
    const ts=cur.T.filter(t=>t.prof.id===p.id);
    const fact=ts.reduce((s,t)=>s+numV(t.monto),0);
    const com=ts.reduce((s,t)=>s+comTurno(t,pctMap[p.id+'|'+quincenaKey(t.fecha)]||0),0);
    return {p,fact,com,n:ts.length};
  }).sort((a,b)=>b.fact-a.fact);
  const rankMax=Math.max(1,...rank.map(x=>x.fact));

  // servicios
  const svc={};
  cur.T.forEach(t=>{
    const lista=(t.servicios&&t.servicios.length)?t.servicios:[{nombre:t.servicio||'Sin detalle',precio:numV(t.monto)}];
    lista.forEach(s=>{ const x=svc[s.nombre]||(svc[s.nombre]={c:0,monto:0}); x.c++; x.monto+=numV(s.precio); });
  });
  const svcList=Object.entries(svc).map(([nombre,x])=>({nombre,...x})).sort((a,b)=>b.c-a.c).slice(0,7);

  // productos vendidos
  const prd={};
  cur.V.forEach(v=>{ const k=v.productoId||v.productoNombre; const x=prd[k]||(prd[k]={nombre:v.productoNombre,u:0,total:0,gan:0,id:v.productoId}); x.u+=numV(v.cantidad); x.total+=numV(v.total); x.gan+=numV(v.total)-costoVenta(v)-numV(v.comision); });
  const prdList=Object.values(prd).sort((a,b)=>b.total-a.total).slice(0,7);

  // horas y dias de la semana
  const horas=Array(24).fill(0), sem=Array(7).fill(0);
  cur.T.forEach(t=>{ if(t.creadoEn) horas[new Date(t.creadoEn).getHours()]++; if(t.fecha) sem[new Date(t.fecha+'T00:00:00Z').getUTCDay()]++; });
  const hMin=8,hMax=22; const hMaxV=Math.max(1,...horas.slice(hMin,hMax+1)); const sMaxV=Math.max(1,...sem);

  // descuentos
  const dEf=cur.T.filter(t=>t.descuentoTipo==='efectivo'), dOf=cur.T.filter(t=>t.descuentoTipo==='oferta');
  const sEf=dEf.reduce((s,t)=>s+numV(t.descuento),0), sOf=dOf.reduce((s,t)=>s+numV(t.descuento),0);
  const porOferta={}; dOf.forEach(t=>{ const n=(t.oferta&&t.oferta.nombre)||'Oferta'; const x=porOferta[n]||(porOferta[n]={n:0,m:0}); x.n++; x.m+=numV(t.descuento); });

  // deudores (pendientes, sin importar el periodo)
  const deudas=D.deudas.filter(d=>coincideProf(d.prof,P.prof)).sort((a,b)=>new Date(a.creadoEn||a.fecha)-new Date(b.creadoEn||b.fecha));
  const totalDeuda=deudas.reduce((s,d)=>s+saldoDeuda(d),0);

  // equipo hoy
  const incsPend=JSON.parse(localStorage.getItem('luffy_incidentes')||'[]').filter(i=>!i.procesado);
  const canjesPend=canjesSolicitudes.filter(s=>s.estado==='pendiente');
  const cierresHoy=cierresLista().filter(c=>c.fecha===hoy&&coincideProf(allUsers.find(u=>u.id===c.profId),P.prof));
  const reagHoy=cierresHoy.filter(c=>c.r.reagendo==='si').length;

  // actividad
  const hora=(iso)=>iso?new Date(iso).toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit'}):'';
  const cuando=(x)=>(x.fecha===hoy?'hoy':fechaCortaStr(x.fecha))+' '+hora(x.creadoEn);
  const filtro=(x,u)=>coincideProf(u,P.prof);
  const actividad=[
    ...D.turnos.filter(t=>filtro(t,t.prof)).map(t=>({ts:t.creadoEn||t.fecha,ico:'💈',txt:`<b>${escH(t.prof.name)}</b> cobró ${escH(t.servicio||'un turno')}${t.cliente&&t.cliente!=='Cliente'?' a '+escH(t.cliente):''}`,m:numV(t.monto),extra:cuando(t)})),
    ...D.ventas.filter(v=>filtro(v,v.vendedor)).map(v=>({ts:v.creadoEn||v.fecha,ico:'📦',txt:`<b>${escH(v.vendedor.name)}</b> vendió ${escH(v.productoNombre)} x${v.cantidad}`,m:numV(v.total),extra:cuando(v)})),
  ].sort((a,b)=>new Date(b.ts)-new Date(a.ts)).slice(0,9);

  const cobradoTotal=cur.medios.efectivo+cur.medios.mp+cur.medios.tarjeta;
  const pctEf=cobradoTotal?Math.round(cur.medios.efectivo/cobradoTotal*100):0;

  const kpi=(l,v,sub,col,d,tip,big)=>`<div class="kpi ${big?'big':''}" data-tip="${escH(tip||'')}"><div class="kl">${l}</div><div class="kv" style="color:${col||'var(--text)'}">${v}</div><div class="ks">${d||''}<span>${sub||''}</span></div></div>`;
  const mini=(l,v,sub,col)=>`<div class="mini"><div class="kl">${l}</div><div class="mv" style="color:${col||'var(--text)'}">${v}</div><div class="ks"><span>${sub||''}</span></div></div>`;
  const anterior=(v)=>'Período anterior: '+fp(v);
  const kpiFuturo=()=>`<div class="kpi big futuro" data-tip="Estimado con el precio de lista de los servicios agendados -- el monto real se termina de definir al cobrar cada turno.">
    <div class="kpi-fut-head">
      <div class="kl" style="margin-bottom:0">🔮 Turnos futuros</div>
      <div class="kpi-fut-mes"><button onclick="adminPanelFutMes(-1)">‹</button><span style="font-size:11.5px;font-weight:700;min-width:150px;text-align:center;display:inline-block">${futEsMesActual?'Desde hoy hasta fin de':'Todo'} ${MESES[futM-1]} ${futY}</span><button onclick="adminPanelFutMes(1)">›</button></div>
    </div>
    <div class="kpi-fut-grid">
      <div><div class="kl">Facturación</div><div class="kv">${fp(fut.fact)}</div></div>
      <div><div class="kl">N° de turnos</div><div class="kv">${fut.nT}</div></div>
      <div><div class="kl">Ingreso</div><div class="kv" style="color:${COL.prod}">${fp(fut.ingreso)}</div></div>
      <div><div class="kl">Egreso</div><div class="kv" style="color:${COL.rosa}">${fp(fut.egreso)}</div></div>
    </div>
  </div>`;

  const periodos=[['hoy','Hoy'],['7d','7 días'],['quincena','Quincena'],['mes','Este mes'],['mesant','Mes anterior']];
  const detalleDia=P.dia&&idx[P.dia]!=null?(()=>{
    const T=cur.T.filter(t=>t.fecha===P.dia).sort((a,b)=>new Date(b.creadoEn||0)-new Date(a.creadoEn||0));
    const V=cur.V.filter(v=>v.fecha===P.dia).sort((a,b)=>new Date(b.creadoEn||0)-new Date(a.creadoEn||0));
    return `<div style="border-top:1px solid var(--border);margin-top:10px;padding-top:10px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px"><b style="font-size:13px">${DIAS_SEM[new Date(P.dia+'T00:00:00Z').getUTCDay()]} ${fechaCortaStr(P.dia)} — ${T.length} turnos, ${V.length} ventas</b><button class="lnk" onclick="adminPanelDia('${P.dia}')">Cerrar ✕</button></div>
      ${T.map(t=>`<div class="ln"><span>💈 ${escH(t.prof.name)} · ${escH(t.cliente||'Cliente')} · ${escH(t.servicio||'')}</span><span>${hora(t.creadoEn)} · <b>${fp(numV(t.monto))}</b></span></div>`).join('')}
      ${V.map(v=>`<div class="ln"><span>📦 ${escH(v.vendedor.name)} · ${escH(v.productoNombre)} x${v.cantidad}</span><span>${hora(v.creadoEn)} · <b>${fp(numV(v.total))}</b></span></div>`).join('')}
      ${!T.length&&!V.length?vacio('Sin movimientos ese día'):''}
    </div>`;
  })():'';

  c.innerHTML=`
  <div class="adm-bar">
    <div class="adm-chips">${periodos.map(([k,l])=>`<button class="${P.periodo===k?'on':''}" onclick="adminPanelPeriodo('${k}')">${l}</button>`).join('')}</div>
    <div class="adm-bar-r">
      <select onchange="adminPanelProfSet(this.value)" class="adm-sel"><option value="todos">👥 Todo el equipo</option>${sucursales.length>1?'<optgroup label="Por sucursal">'+sucursales.map(s=>`<option value="suc:${s.id}" ${P.prof==='suc:'+s.id?'selected':''}>📍 ${escH(s.nombre)}</option>`).join('')+'</optgroup>':''}${vendedores.map(u=>`<option value="${u.id}" ${P.prof===u.id?'selected':''}>${escH(u.name)}${u.role==='recepcionista'?' (recepción)':''}</option>`).join('')}</select>
      <button class="adm-btn" onclick="compartirResumenSemanal()" title="Arma un resumen de los últimos 7 días para mandar por WhatsApp">📲 Resumen semanal</button>
      <button class="adm-btn" onclick="adminExportCSV()" title="Descargar los movimientos del período">⬇ CSV</button>
      <button class="adm-btn" onclick="adminPanelRefrescar()" title="Actualizar ahora">⟳ ${adminUltAct.toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit'})}</button>
    </div>
  </div>
  <div style="font-size:12px;color:var(--muted2);margin:2px 2px 12px">${rango.label}${profSel?` · filtrando por <b style="color:var(--text)">${escH(profSel.name)}</b> <button class="lnk" onclick="adminPanelProfSet('todos')">quitar filtro ✕</button>`:''} · comparado con ${rango.prevDesde===rango.prevHasta?fechaCortaStr(rango.prevDesde):fechaCortaStr(rango.prevDesde)+' al '+fechaCortaStr(rango.prevHasta)}</div>

  ${kpiFuturo()}
  <div class="adm-kpis">
    ${kpi('💈 Facturación cortes',fp(cur.fact),cur.nT+(cur.nT===1?' turno':' turnos'),'',deltaHtml(cur.fact,prev.fact),anterior(prev.fact))}
    ${kpi('Queda a la empresa',fp(cur.quedaCortes),(cur.fact?Math.round(cur.quedaCortes/cur.fact*100):0)+'% de los cortes',COL.prod,deltaHtml(cur.quedaCortes,prev.quedaCortes),anterior(prev.quedaCortes))}
    ${kpi('Comisión del equipo',fp(cur.comEq),(cur.fact?Math.round(cur.comEq/cur.fact*100):0)+'% de los cortes',COL.rosa,deltaHtml(cur.comEq,prev.comEq,true),anterior(prev.comEq))}
    ${kpi('💰 Ganancia',fp(cur.ganancia),'cortes + productos',COL.prod,deltaHtml(cur.ganancia,prev.ganancia),anterior(prev.ganancia),true)}
    ${kpi('📦 Ventas de productos',fp(cur.prodVendido),cur.unidades+' u.','',deltaHtml(cur.prodVendido,prev.prodVendido),anterior(prev.prodVendido))}
    ${kpi('Comisiones productos',fp(cur.prodCom),'para quienes vendieron',COL.rosa,deltaHtml(cur.prodCom,prev.prodCom,true),anterior(prev.prodCom))}
    ${kpi('Queda de productos',fp(cur.quedaProd),'venta − costo − comisión',COL.prod,deltaHtml(cur.quedaProd,prev.quedaProd),anterior(prev.quedaProd))}
    ${kpi('🏬 Plata en stock',fp(stockCosto),stockU+' u. · a venta '+fpk(stockVenta),COL.oro,'','Lo que costó el stock que hay hoy. Baja solo con cada venta.')}
  </div>
  <div class="adm-mini">
    ${mini('Turnos',cur.nT,'vs '+prev.nT+' antes')}
    ${mini('Ticket promedio',fp(cur.ticket),'por turno')}
    ${mini('Pagan en efectivo',pctEf+'%','del total cobrado',COL.prod)}
    ${mini('Descuentos dados',fp(cur.descTotal),(cur.subtotalLista?Math.round(cur.descTotal/cur.subtotalLista*100):0)+'% del precio de lista',COL.oro)}
    ${mini('Clientes que deben',fp(totalDeuda),deudas.length+' pendientes',deudas.length?COL.rosa:'')}
    ${mini('Reagendaron hoy',reagHoy,'de '+cierresHoy.length+' turnos cerrados',COL.azul)}
  </div>

  <div class="adm-grid">
    ${pnl('c8','Evolución diaria',`
      <div class="adm-chips sm" style="margin-bottom:6px">
        <button class="${P.series.cortes?'on':''}" onclick="adminPanelSerie('cortes')"><i style="background:${COL.cortes}"></i>Cortes</button>
        <button class="${P.series.productos?'on':''}" onclick="adminPanelSerie('productos')"><i style="background:${COL.prod}"></i>Productos</button>
        <span style="margin-left:auto;font-size:11px;color:var(--muted)">Tocá un día para ver el detalle</span>
      </div>${svgDias(dias,P.series,hoy,P.dia)}${detalleDia}`)}
    ${pnl('c4','⚠️ Para atender',`
      ${(()=>{ const it=[];
        incsPend.forEach(i=>it.push(`<div class="ln"><span>⚠️ Incidente: <b>${escH(i.profName)}</b> — ${escH(i.razon)}</span><button class="lnk" onclick="switchAdminTab('estado')">Ver</button></div>`));
        canjesPend.forEach(s=>it.push(`<div class="ln"><span>🎁 <b>${escH(s.profName)}</b> quiere canjear ${escH(s.canjeLabel)}</span><button class="lnk" onclick="switchAdminTab('puntos')">Ver</button></div>`));
        if(cuentasPendientes.length) it.push(`<div class="ln"><span>🆕 <b>${cuentasPendientes.length}</b> cuenta${cuentasPendientes.length===1?'':'s'} esperando aprobación</span><button class="lnk" onclick="switchAdminTab('estado')">Ver</button></div>`);
        stockBajo.forEach(p=>it.push(`<div class="ln"><span>📦 Poco stock: <b>${escH(p.nombre)}</b> (${p.stock})</span><button class="lnk" onclick="switchAdminTab('productos')">Ver</button></div>`));
        if(totalDeuda) it.push(`<div class="ln"><span>🚫 ${deudas.length} clientes deben <b>${fp(totalDeuda)}</b></span></div>`);
        return it.length?it.join(''):vacio('Todo en orden ✅');})()}`)}

    ${pnl('c4','Equipo',rank.length?rank.map(x=>hbar((x.p.emoji||'✂️')+' '+escH(x.p.name),fp(x.fact),x.fact/rankMax*100,x.p.color||COL.cortes,{click:`adminPanelProfToggle('${x.p.id}')`,sel:P.prof===x.p.id,sub:`${x.n} turnos · comisión ${fp(x.com)} · al local ${fp(x.fact-x.com)}`,tip:'Tocá para filtrar todo el panel por esta persona'})).join(''):vacio('Sin profesionales'),`<span class="hint">tocá para filtrar</span>`)}
    ${pnl('c4','Servicios más pedidos',svcList.length?svcList.map(s=>hbar(escH(s.nombre),s.c+' ×',s.c/svcList[0].c*100,COL.cortes,{sub:'valor de lista '+fp(s.monto)})).join(''):vacio('Sin turnos en el período'))}
    ${pnl('c4','Medios de pago',cobradoTotal?`<div style="display:flex;align-items:center;gap:14px">${svgDonut([{l:'Efectivo',v:cur.medios.efectivo,c:COL.prod},{l:'Mercado Pago',v:cur.medios.mp,c:COL.mp},{l:'Tarjeta',v:cur.medios.tarjeta,c:COL.cortes}],cobradoTotal)}
      <div style="flex:1;font-size:12px">${[['💵 Efectivo',cur.medios.efectivo,COL.prod],['📱 Mercado Pago',cur.medios.mp,COL.mp],['💳 Tarjeta',cur.medios.tarjeta,COL.cortes]].map(([l,v,col])=>`<div class="ln"><span><i class="dot" style="background:${col}"></i>${l}</span><b>${fp(v)}</b></div>`).join('')}<div style="font-size:10.5px;color:var(--muted);margin-top:6px">Cortes + productos</div></div></div>`:vacio('Sin cobros en el período'))}

    ${pnl('c4','Productos más vendidos',prdList.length?prdList.map(p=>hbar(escH(p.nombre),fp(p.total),p.total/prdList[0].total*100,COL.prod,{sub:p.u+' u. · ganancia '+fp(p.gan)})).join(''):vacio('Sin ventas en el período'))}
    ${pnl('c4','Stock',productos.length?`<table class="adm-tbl"><tr><th>Producto</th><th>Unid.</th><th>A costo</th></tr>${[...productos].sort((a,b)=>b.stock*b.costo-a.stock*a.costo).slice(0,8).map(p=>{ const bajo=numV(p.stock)<=numV(p.alertaStock); return `<tr class="${bajo?'low':''}"><td>${escH(p.nombre)}${bajo?' ⚠️':''}</td><td>${p.stock}</td><td>${fp(numV(p.stock)*numV(p.costo))}</td></tr>`; }).join('')}<tr class="tot"><td>Total</td><td>${stockU}</td><td>${fp(stockCosto)}</td></tr></table>`:vacio('Sin productos cargados'),`<button class="lnk" onclick="switchAdminTab('productos')">Gestionar ›</button>`)}
    ${pnl('c4','Clientes que no pagaron',deudas.length?`<div style="font-size:22px;font-weight:900;color:${COL.rosa};margin-bottom:6px">${fp(totalDeuda)}</div><div style="max-height:230px;overflow-y:auto">${deudas.map(d=>`<div class="ln"><span>${escH(d.cliente)} <i style="color:var(--muted)">· ${escH(d.prof.name)} · hace ${diasDesdeStr(d.fecha)} d</i></span><span style="white-space:nowrap"><b>${fp(saldoDeuda(d))}</b> <button class="lnk" style="color:#f472b6" onclick="anularDeuda('${d.prof.id}','${d.id}')">Anular</button></span></div>`).join('')}</div><div style="font-size:10.5px;color:var(--muted);margin-top:6px">Las cobra recepción y suman a la quincena del día de pago${D.anuladas.length?' · Anuladas: '+D.anuladas.length+' ('+fp(D.anuladas.reduce((s,x)=>s+perdidoDeuda(x),0))+' perdido)':''}</div>`:vacio('Nadie debe nada ✅'))}

    ${pnl('c6','Horarios y días con más turnos',`
      <div style="font-size:11px;color:var(--muted2);margin-bottom:6px">Por hora en que se cargó el turno</div>
      <div class="bars">${horas.slice(hMin,hMax+1).map((n,i)=>`<div class="bcol" data-tip="${hMin+i}:00 hs — ${n} turnos"><div class="bfill" style="height:${n/hMaxV*100}%;background:${COL.cortes}"></div><span>${hMin+i}</span></div>`).join('')}</div>
      <div style="font-size:11px;color:var(--muted2);margin:12px 0 6px">Por día de la semana</div>
      <div class="bars">${[1,2,3,4,5,6,0].map(dn=>`<div class="bcol" data-tip="${DIAS_SEM[dn]} — ${sem[dn]} turnos"><div class="bfill" style="height:${sem[dn]/sMaxV*100}%;background:${COL.prod}"></div><span>${DIAS_SEM[dn]}</span></div>`).join('')}</div>`)}
    ${pnl('c6','📉 Plata que dejamos en descuentos',htmlPerdidaDescuentos(rango.desde,rango.hasta,P.prof).html)}

    ${pnl('c6','Equipo hoy',`<table class="adm-tbl"><tr><th>Quién</th><th>Turnos</th><th>Facturó</th><th>Stories</th><th>Rep.</th></tr>${equipo.map(p=>{
        const th=D.turnos.filter(t=>t.prof.id===p.id&&t.fecha===hoy);
        const sd=STORY_TIPOS.filter(t=>storiesData?.[hoy]?.[p.id]?.[t.id]?.done).length;
        const rep=getReputacion(p.id);
        return `<tr><td>${p.emoji||'✂️'} ${escH(p.name)}</td><td>${th.length}</td><td>${fp(th.reduce((s,t)=>s+numV(t.monto),0))}</td><td style="color:${sd>=STORY_TIPOS.length?COL.prod:COL.oro}">${sd}/${STORY_TIPOS.length}</td><td style="color:${getRepColor(rep)}">${rep}%</td></tr>`; }).join('')||'<tr><td colspan="5">Sin equipo</td></tr>'}</table>`)}
    ${pnl('c6','Actividad reciente',actividad.length?actividad.map(a=>`<div class="ln"><span>${a.ico} ${a.txt}<i style="color:var(--muted);font-size:10.5px"> · ${a.extra}</i></span><b>${fp(a.m)}</b></div>`).join(''):vacio('Todavía no hay movimientos'))}
    ${(()=>{ const ci=htmlCierresPanel(rango.desde,rango.hasta,P.prof); return pnl('c6','🧾 Cierre de turnos (recepción)',ci.n?ci.cierre:vacio('Todavía no se cerró ningún turno en este período'))+pnl('c6','⭐ Reseñas de Google declaradas',ci.resenas.length?ci.resenas.slice(0,8).map(c=>`<div class="ln"><span>${escH(c.cliente)} <i style="color:var(--muted)">· atendió ${escH(c.prof)} · cerró ${escH(c.por)} · ${fechaCortaStr(c.fecha)}</i></span></div>`).join('')+'<div style="font-size:10.5px;color:var(--muted);margin-top:8px;line-height:1.5">Las declara recepción y suman +5 puntos. Para controlarlas, compará esta cantidad con las reseñas nuevas que aparecen en Google.</div>':vacio('Ninguna declarada en este período')); })()}
  </div>`;
}

// ---------- ADMIN: servicios por rubro ----------
let adminSvcRubro='todos', adminSvcQ='';
const minsTxt=(m)=>m?(m>=60?(Math.floor(m/60)+' h'+(m%60?' '+(m%60)+' min':'')):m+' min'):'';
function slugRubro(n){ return String(n).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||('r'+Date.now()); }

function renderAdminServicios(body){
  const f=adminSvcRubro, q=adminSvcQ.trim().toLowerCase();
  const sinRubro=servicios.filter(s=>!s.rubro||!rubros.some(r=>r.id===s.rubro)).length;
  const lista=servicios.filter(s=>(f==='todos'||(f==='sin'?(!s.rubro||!rubros.some(r=>r.id===s.rubro)):s.rubro===f))&&(!q||s.nombre.toLowerCase().includes(q)));
  const grupos=[...rubros.map(r=>({id:r.id,nombre:r.nombre})),{id:'',nombre:'Sin rubro'}].map(g=>({...g,items:lista.filter(s=>g.id?s.rubro===g.id:(!s.rubro||!rubros.some(r=>r.id===s.rubro)))})).filter(g=>g.items.length);
  const chip=(id,l,n)=>`<button class="${f===id?'on':''}" onclick="adminSvcRubro='${id}';renderAdmin()">${escH(l)} (${n})</button>`;
  body.innerHTML+=`
    <div style="display:flex;gap:8px;margin:6px 0 12px;flex-wrap:wrap">
      <button onclick="abrirFormServicio()" class="btn btn-primary" style="flex:1;margin:0;min-width:130px">+ Servicio</button>
      <button onclick="abrirImportServicios()" class="btn btn-ghost" style="flex:1;margin:0;min-width:130px">📥 Cargar varios</button>
      <button onclick="abrirRubros()" class="btn btn-ghost" style="flex:1;margin:0;min-width:130px">🏷️ Rubros</button>
    </div>
    <div class="card" style="margin-bottom:12px;font-size:12px;color:var(--muted2);line-height:1.5">💵 Pagando en efectivo hay <b style="color:var(--text)">${DESC_EFECTIVO_PCT}% off</b> automático en los servicios. Los combos se arman en <b style="color:var(--text)">Combos y ofertas</b>. Cada profesional ve solo los servicios de sus rubros (se asignan en Equipo → Estado).</div>
    <div class="adm-chips sm" style="margin-bottom:10px">${chip('todos','Todos',servicios.length)}${rubros.map(r=>chip(r.id,r.nombre,servicios.filter(s=>s.rubro===r.id).length)).join('')}${sinRubro?chip('sin','Sin rubro',sinRubro):''}</div>
    ${servicios.length>8?`<input type="search" id="admsvc-q" placeholder="Buscar servicio..." value="${escH(adminSvcQ)}" oninput="adminSvcQ=this.value;renderAdmin();var e=document.getElementById('admsvc-q');e.focus();e.setSelectionRange(e.value.length,e.value.length);" style="width:100%;background:var(--s1);border:1.5px solid var(--border2);border-radius:12px;padding:11px 14px;color:var(--text);font-family:var(--font);font-size:13px;margin-bottom:10px;outline:none"/>`:''}
    ${grupos.length?grupos.map(g=>`
      <div style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);margin:12px 0 6px">${escH(g.nombre)} · ${g.items.length}</div>
      ${g.items.map(s=>`<div class="prof-card" style="margin-bottom:6px;padding:10px 14px"><div style="display:flex;align-items:center;gap:10px">
        <div style="flex:1;min-width:0">
          <div style="font-size:13.5px;font-weight:700">${escH(s.nombre)}</div>
          <div style="display:flex;gap:5px;flex-wrap:wrap;margin-top:4px">${s.duracion?`<span class="bdg">⏱ ${minsTxt(s.duracion)}</span>`:''}${s.variable?'<span class="bdg">precio "desde"</span>':''}${s.variante?`<span class="bdg">${escH(s.variante.titulo||'Opciones')}: ${escH((s.variante.opciones||[]).map(o=>o.n).join('/'))}</span>`:''}</div>
        </div>
        <div style="font-size:14px;font-weight:800;white-space:nowrap">${s.variable?'<span style="font-size:10px;font-weight:600;color:var(--muted2)">desde </span>':''}${fp(s.precio)}</div>
        <button onclick="abrirFormServicio('${s.id}')" title="Editar" style="background:none;border:none;color:var(--muted2);font-size:15px;cursor:pointer;padding:4px">✏️</button>
        <button onclick="borrarServicio('${s.id}')" title="Borrar" style="background:none;border:none;color:var(--muted);font-size:18px;cursor:pointer;padding:0 4px">×</button>
      </div></div>`).join('')}`).join(''):`<div style="text-align:center;color:var(--muted);font-size:13px;padding:20px">${servicios.length?'No hay servicios en este filtro':'Sin servicios cargados todavía'}</div>`}`;
}

function abrirFormServicio(id){
  const s=id?servicios.find(x=>x.id===id):null;
  const v=(k)=>escH(s&&s[k]!=null?s[k]:'');
  const ops=s&&s.variante?(s.variante.opciones||[]).map(o=>o.n+(numV(o.extra)?':'+o.extra:'')).join(', '):'';
  const c=document.getElementById('registro-content');
  c.innerHTML=`<div style="display:flex;align-items:center;gap:8px;margin-bottom:14px"><div class="modal-title" style="margin:0">${s?'Editar servicio':'Servicio nuevo'}</div><button onclick="closeModal('modal-registro')" style="margin-left:auto;background:var(--s3);border:none;color:var(--muted2);font-size:18px;width:32px;height:32px;border-radius:50%;cursor:pointer">×</button></div>
    <input type="hidden" id="sv-id" value="${s?s.id:''}"/>
    <div class="field"><label>Nombre</label><input id="sv-nombre" placeholder="Ej: Barba" value="${v('nombre')}"/></div>
    <div class="field" style="margin-top:8px"><label>Rubro</label><select id="sv-rubro" style="${inpCss}">${rubros.map(r=>`<option value="${r.id}" ${s?(s.rubro===r.id?'selected':''):(adminSvcRubro===r.id?'selected':'')}>${escH(r.nombre)}</option>`).join('')}</select></div>
    <div style="display:flex;gap:8px;margin-top:8px">
      <div class="field" style="flex:1"><label>Precio ($)</label><input id="sv-precio" type="number" inputmode="decimal" placeholder="0" value="${v('precio')}"/></div>
      <div class="field" style="flex:1"><label>Duración (min)</label><input id="sv-dur" type="number" inputmode="numeric" placeholder="45" value="${v('duracion')}"/></div>
    </div>
    <label style="display:flex;align-items:flex-start;gap:8px;font-size:12px;color:var(--muted2);margin:12px 0;text-transform:none;letter-spacing:0;line-height:1.4"><input id="sv-var" type="checkbox" ${s&&s.variable?'checked':''} style="width:auto;margin-top:2px"/><span>El precio <b style="color:var(--text)">varía</b> ("desde"): el profesional pone el precio final al cobrar</span></label>
    <div class="field"><label>Opciones a elegir al cobrar (opcional)</label>
      <input id="sv-vtit" placeholder="Nombre de la opción. Ej: Largo de barba" value="${escH(s&&s.variante?s.variante.titulo:'')}" style="margin-bottom:6px"/>
      <input id="sv-vops" placeholder="Corta, Media, Larga   (con extra: Larga:2000)" value="${escH(ops)}"/></div>
    <div class="field"><label>💡 Venta cruzada: al elegir este servicio, sugerir también</label>${servicios.filter(x=>x.id!==(s?s.id:'')).map(x=>`<label class="rub-opt"><input type="checkbox" class="sv-sug" value="${x.id}" ${s&&(s.sugiere||[]).includes(x.id)?'checked':''}/> ${escH(x.nombre)}</label>`).join('')||'<div style="font-size:12px;color:var(--muted)">Cargá otros servicios primero.</div>'}</div>
    <button class="btn btn-primary" onclick="guardarServicio()" style="margin-top:14px">${s?'Guardar cambios':'Agregar servicio'}</button>`;
  openModal('modal-registro');
}
function guardarServicio(){
  const val=(i)=>(document.getElementById(i)?.value||'').trim();
  const nombre=val('sv-nombre'), precio=parseFloat(val('sv-precio'))||0;
  if(!nombre||precio<=0){ showToast('Poné nombre y precio'); return; }
  const ops=val('sv-vops').split(',').map(t=>t.trim()).filter(Boolean).map(t=>{ const p=t.split(':'); return {n:p[0].trim(), extra:parseFloat(p[1])||0}; });
  const sugiere=[...document.querySelectorAll('.sv-sug:checked')].map(x=>x.value);
  const campos={nombre, precio, rubro:val('sv-rubro'), duracion:parseInt(val('sv-dur'))||0, variable:document.getElementById('sv-var').checked||undefined, variante:ops.length?{titulo:val('sv-vtit')||'Opción',opciones:ops}:undefined, sugiere:sugiere.length?sugiere:undefined};
  const id=val('sv-id');
  if(id){ const s=servicios.find(x=>x.id===id); if(!s) return; Object.keys(campos).forEach(k=>{ if(campos[k]===undefined) delete s[k]; else s[k]=campos[k]; }); showToast('Servicio actualizado ✓'); }
  else { const s={id:Date.now().toString()}; Object.keys(campos).forEach(k=>{ if(campos[k]!==undefined) s[k]=campos[k]; }); servicios.push(s); showToast('Servicio agregado ✓'); }
  saveServicios(); closeModal('modal-registro'); renderAdmin();
}
async function borrarServicio(id){
  const s=servicios.find(x=>x.id===id); if(!s) return;
  const enCombos=combos.filter(c=>c.servicioIds.includes(id));
  const msg=(enCombos.length?'Está en el combo "'+enCombos.map(c=>c.nombre).join('", "')+'": también se borra ese combo.\n':'')+'Los turnos ya cargados no cambian.';
  if(!await uiConfirm('¿Borrar "'+s.nombre+'"?',msg)) return;
  servicios=servicios.filter(x=>x.id!==id);
  if(enCombos.length){ combos=combos.filter(c=>!c.servicioIds.includes(id)); saveCombos(); }
  ofertas.forEach(o=>{ if(o.servicioIds) o.servicioIds=o.servicioIds.filter(x=>x!==id); });
  saveServicios(); saveOfertas(); renderAdmin();
}

// ---------- carga masiva de servicios ----------
function serviciosDeTabla(txt){
  let rows=parseTabla(txt);
  if(rows.length){ const h=(rows[0][0]||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').trim(); if(h==='nombre'||h==='servicio'||h==='name') rows=rows.slice(1); }
  const norm=(s)=>String(s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
  const validos=[]; let omitidos=0; const rubrosNuevos=new Set();
  rows.forEach(c=>{
    const g=(i)=>(c[i]||'').trim();
    const precio=parseFloat(g(1).replace(/\./g,'').replace(',','.'))||0;
    if(!g(0)||precio<=0){ omitidos++; return; }
    const rn=g(3); const ex=rn&&rubros.find(r=>norm(r.nombre)===norm(rn));
    if(rn&&!ex) rubrosNuevos.add(rn);
    validos.push({nombre:g(0),precio,duracion:parseInt(g(2))||0,rubroNombre:rn,rubroId:ex?ex.id:null,desc:g(4),variable:/desde\)?\s*$/i.test(g(0))||undefined});
  });
  return {validos,omitidos,rubrosNuevos:[...rubrosNuevos]};
}
function abrirImportServicios(){
  const c=document.getElementById('registro-content');
  c.innerHTML=`<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px"><div class="modal-title" style="margin:0">Cargar varios servicios</div><button onclick="closeModal('modal-registro')" style="margin-left:auto;background:var(--s3);border:none;color:var(--muted2);font-size:18px;width:32px;height:32px;border-radius:50%;cursor:pointer">×</button></div>
    <div style="font-size:12px;color:var(--muted2);line-height:1.6;margin-bottom:10px">Pegá filas de una planilla o subí un CSV con estas columnas, en este orden:<br><b style="color:var(--text)">Nombre · Precio · Duración (min) · Rubro · Descripción</b><br>Si el rubro no existe, se crea. Los que ya están (mismo nombre y rubro) se saltean.</div>
    <div style="display:flex;gap:8px;margin-bottom:10px">
      <button onclick="descargarPlantillaServicios()" class="btn btn-ghost" style="flex:1;margin:0;padding:10px;font-size:12px">⬇ Plantilla CSV</button>
      <label class="btn btn-ghost" style="flex:1;margin:0;padding:10px;font-size:12px;text-align:center;cursor:pointer">📂 Subir archivo<input type="file" accept=".csv,.tsv,.txt" style="display:none" onchange="importServiciosArchivo(this)"/></label>
    </div>
    <textarea id="isv-txt" rows="7" placeholder="O pegá acá las filas copiadas de la planilla..." oninput="previewImportServicios()" style="${inpCss};min-height:130px"></textarea>
    <div id="isv-prev" style="font-size:12px;color:var(--muted2);margin:10px 0"></div>
    <button id="isv-btn" class="btn btn-primary" onclick="confirmarImportServicios()" disabled>Importar</button>`;
  openModal('modal-registro');
}
function importServiciosArchivo(inp){
  const f=inp.files&&inp.files[0]; if(!f) return;
  const rd=new FileReader(); rd.onload=()=>{ document.getElementById('isv-txt').value=String(rd.result||''); previewImportServicios(); }; rd.readAsText(f,'utf-8');
}
function serviciosNuevosDeImport(){
  const {validos,omitidos,rubrosNuevos}=serviciosDeTabla(document.getElementById('isv-txt')?.value||'');
  const ya=new Set(servicios.map(s=>s.nombre.toLowerCase()+'|'+(s.rubro||'')));
  const nuevos=validos.filter(v=>!ya.has(v.nombre.toLowerCase()+'|'+(v.rubroId||slugRubro(v.rubroNombre||''))));
  return {validos,nuevos,omitidos,rubrosNuevos};
}
function previewImportServicios(){
  const txt=document.getElementById('isv-txt')?.value||'';
  const prev=document.getElementById('isv-prev'), btn=document.getElementById('isv-btn');
  if(!txt.trim()){ prev.textContent=''; btn.disabled=true; btn.textContent='Importar'; return; }
  const {validos,nuevos,omitidos,rubrosNuevos}=serviciosNuevosDeImport();
  prev.innerHTML=`<b style="color:var(--text)">${nuevos.length}</b> servicios nuevos${validos.length-nuevos.length?` · ${validos.length-nuevos.length} ya existen (se saltean)`:''}${omitidos?` · <span style="color:#fbbf24">${omitidos} filas sin nombre o sin precio (se saltean)</span>`:''}${rubrosNuevos.length?`<div style="margin-top:6px;color:#fbbf24">Se van a crear los rubros: ${rubrosNuevos.map(escH).join(', ')}</div>`:''}${nuevos.length?'<div style="margin-top:6px;color:var(--muted)">'+nuevos.slice(0,4).map(v=>'• '+escH(v.nombre)+' — '+fp(v.precio)).join('<br>')+(nuevos.length>4?'<br>…':'')+'</div>':''}`;
  btn.disabled=!nuevos.length; btn.textContent=nuevos.length?'Importar '+nuevos.length+' servicios':'Importar';
}
function confirmarImportServicios(){
  const {nuevos}=serviciosNuevosDeImport(); if(!nuevos.length) return;
  const base=Date.now();
  nuevos.forEach((v,i)=>{
    let rid=v.rubroId;
    if(!rid&&v.rubroNombre){ rid=slugRubro(v.rubroNombre); if(!rubros.some(r=>r.id===rid)) rubros.push({id:rid,nombre:v.rubroNombre}); }
    const s={id:base+'-'+i,nombre:v.nombre,precio:v.precio,duracion:v.duracion,rubro:rid||''};
    if(v.desc) s.desc=v.desc; if(v.variable) s.variable=true;
    servicios.push(s);
  });
  saveRubros(); saveServicios();
  closeModal('modal-registro'); adminSvcRubro='todos';
  showToast(nuevos.length+' servicios cargados ✓'); renderAdmin();
}
function descargarPlantillaServicios(){
  const filas=[['Nombre','Precio','Duración (min)','Rubro','Descripción'],['Corte de cabello',18000,45,'Barbería',''],['Balayage desde',130000,120,'Peluquería','El precio final depende del largo']];
  const csv='﻿'+filas.map(f=>f.map(x=>'"'+String(x).replace(/"/g,'""')+'"').join(';')).join('\r\n');
  const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'})); a.download='plantilla-servicios.csv';
  document.body.appendChild(a); a.click(); a.remove();
}

// ---------- rubros ----------
function abrirRubros(){
  const c=document.getElementById('registro-content');
  const profs=allUsers.filter(u=>esProf(u));
  c.innerHTML=`<div style="display:flex;align-items:center;gap:8px;margin-bottom:12px"><div class="modal-title" style="margin:0">Rubros</div><button onclick="closeModal('modal-registro')" style="margin-left:auto;background:var(--s3);border:none;color:var(--muted2);font-size:18px;width:32px;height:32px;border-radius:50%;cursor:pointer">×</button></div>
    <div style="font-size:12px;color:var(--muted2);line-height:1.5;margin-bottom:10px">Los rubros ordenan los servicios. Cada profesional ve solo los de los rubros que tiene asignados.</div>
    ${rubros.map(r=>{ const ns=servicios.filter(s=>s.rubro===r.id).length, nc=combos.filter(x=>x.rubro===r.id).length, np=profs.filter(u=>(u.rubros||[]).includes(r.id)).length;
      return `<div class="ln"><span><b>${escH(r.nombre)}</b><br><span style="font-size:10.5px;color:var(--muted)">${ns} servicios${nc?' · '+nc+' combos':''} · ${np} profesionales</span></span><span><button class="lnk" onclick="renombrarRubro('${r.id}')">Renombrar</button> <button class="lnk" style="color:#f472b6" onclick="borrarRubro('${r.id}')">Borrar</button></span></div>`; }).join('')}
    <button class="btn btn-primary" onclick="agregarRubro()" style="margin-top:14px">+ Agregar rubro</button>`;
  openModal('modal-registro');
}
async function agregarRubro(){
  const n=await uiPrompt('Nuevo rubro',{label:'Nombre',placeholder:'Ej: Depilación',ok:'Agregar'});
  if(!n||!n.trim()) return;
  const id=slugRubro(n);
  if(rubros.some(r=>r.id===id)){ showToast('Ese rubro ya existe'); return; }
  rubros.push({id,nombre:n.trim()}); saveRubros(); abrirRubros(); renderAdmin();
}
async function renombrarRubro(id){
  const r=rubros.find(x=>x.id===id); if(!r) return;
  const n=await uiPrompt('Renombrar rubro',{label:'Nombre',value:r.nombre,ok:'Guardar'});
  if(!n||!n.trim()) return;
  r.nombre=n.trim(); saveRubros(); abrirRubros(); renderAdmin();
}
async function borrarRubro(id){
  const r=rubros.find(x=>x.id===id); if(!r) return;
  const ns=servicios.filter(s=>s.rubro===id).length;
  if(ns){ showToast('Tiene '+ns+' servicios: movelos o borralos primero'); return; }
  if(!await uiConfirm('¿Borrar el rubro "'+r.nombre+'"?','A los profesionales que lo tengan asignado se les saca.')) return;
  rubros=rubros.filter(x=>x.id!==id); combos=combos.filter(c=>c.rubro!==id); ofertas.forEach(o=>{ if(o.rubro===id) delete o.rubro; });
  saveRubros(); saveCombos(); saveOfertas(); abrirRubros(); renderAdmin();
}

// ---------- asignar rubros a un profesional ----------
function abrirRubrosProf(profId,primeraVez){
  const u=allUsers.find(x=>x.id===profId); if(!u) return;
  const propio=!!profile&&profile.id===profId;
  const c=document.getElementById('registro-content');
  c.innerHTML=`<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px"><div class="modal-title" style="margin:0">${propio?'¿En qué rubros trabajás?':'Rubros de '+escH(u.name)}</div><button onclick="closeModal('modal-registro')" style="margin-left:auto;background:var(--s3);border:none;color:var(--muted2);font-size:18px;width:32px;height:32px;border-radius:50%;cursor:pointer">×</button></div>
    <div style="font-size:12px;color:var(--muted2);line-height:1.5;margin-bottom:12px">${propio?(primeraVez?'Elegí tus rubros para ver solo los servicios y promos que hacés. ':'')+'Podés elegir más de uno. Al cobrar vas a ver solo los servicios y ofertas de estos rubros.':'Va a ver solo los servicios y ofertas de estos rubros. Si no marcás ninguno, ve todos.'}</div>
    ${rubros.map(r=>`<label class="rub-opt"><input type="checkbox" class="rp-chk" value="${r.id}" ${(u.rubros||[]).includes(r.id)?'checked':''}/> ${escH(r.nombre)} <span style="margin-left:auto;font-size:11px;color:var(--muted);font-weight:500">${servicios.filter(s=>s.rubro===r.id).length} servicios</span></label>`).join('')}
    <button class="btn btn-primary" onclick="guardarRubrosProf('${u.id}')" style="margin-top:10px">Guardar</button>`;
  openModal('modal-registro');
}
// Lee la lista de usuarios mas fresca antes de escribir, para no pisar cuentas nuevas
async function guardarRubrosProf(profId){
  const sel=[...document.querySelectorAll('.rp-chk:checked')].map(x=>x.value);
  const u=allUsers.find(x=>x.id===profId); if(!u){ showToast('No se encontró a la persona'); return; }
  await guardarRubrosDe(profId,sel);
  closeModal('modal-registro'); showToast('Rubros guardados ✓'); refreshCurrentView();
  if(profile&&profile.id===profId) setTimeout(guiaInicial,500);
}
// ---------- Admin: horario laboral de cualquier integrante del equipo ----------
// Pedido de Ivo (1/10/2026): poder cargar el horario de cada profesional él mismo desde Admin, en vez de
// depender de que cada uno entre a su propio perfil y lo haga solo -- hace falta YA para que el fix de
// disponibilidad real (ver profTrabajaEn en 02-horarios-auth.js) proteja a todo el equipo desde hoy.
let admHorario=null;
function abrirHorarioProf(profId){
  const u=allUsers.find(x=>x.id===profId); if(!u) return;
  admHorario={profId,dias:JSON.parse(JSON.stringify(horariosProfs[profId]||defaultHorario()))};
  renderHorarioProf();
  openModal('modal-registro');
}
function admHorarioToggle(key,v){ admHorario.dias[key]={...(admHorario.dias[key]||{tramos:[{inicio:'10:00',fin:'20:00'}]}),activo:v}; renderHorarioProf(); }
function admHorarioCampo(key,i,campo,v){ const tramos=tramosDeDia(admHorario.dias[key]).slice(); tramos[i]={...tramos[i],[campo]:v}; admHorario.dias[key]={...admHorario.dias[key],tramos}; renderHorarioProf(); }
function admHorarioAgregarTramo(key){ const tramos=tramosDeDia(admHorario.dias[key]).slice(); tramos.push({inicio:'10:00',fin:'14:00'}); admHorario.dias[key]={...admHorario.dias[key],activo:true,tramos}; renderHorarioProf(); }
function admHorarioQuitarTramo(key,i){ const tramos=tramosDeDia(admHorario.dias[key]).slice(); tramos.splice(i,1); admHorario.dias[key]={...admHorario.dias[key],tramos}; renderHorarioProf(); }
function renderHorarioProf(){
  const s=admHorario; if(!s) return;
  const u=allUsers.find(x=>x.id===s.profId); const color=(profile&&profile.color)||'#4A136B';
  document.getElementById('registro-content').innerHTML=`<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px"><div class="modal-title" style="margin:0">🕒 Horario de ${escH(u?u.name:'')}</div><button onclick="closeModal('modal-registro')" style="margin-left:auto;background:var(--s3);border:none;color:var(--muted2);font-size:18px;width:32px;height:32px;border-radius:50%;cursor:pointer">×</button></div>
    <div style="font-size:12px;color:var(--muted2);line-height:1.5;margin-bottom:12px">Define qué días y en qué horario se le puede reservar un turno a esta persona (Agenda y reserva pública /#reserva). Se puede agregar más de un horario el mismo día (ej. 9 a 13 y 16 a 20, con descanso en el medio).</div>
    ${DIAS_SEMANA.map(d=>htmlDiaHorarioTramos(d.label,s.dias[d.key],
      `admHorarioToggle('${d.key}',this.checked)`,
      (i,campo)=>`admHorarioCampo('${d.key}',${i},'${campo}',this.value)`,
      `admHorarioAgregarTramo('${d.key}')`,
      (i)=>`admHorarioQuitarTramo('${d.key}',${i})`
    )).join('')}
    <button class="btn btn-primary" onclick="guardarHorarioProf()" style="margin-top:14px;background:${color}">Guardar horario</button>`;
}
async function guardarHorarioProf(){
  const s=admHorario; if(!s) return;
  archivarHorarioPrevio(s.profId);
  horariosProfs[s.profId]=s.dias; // toma efecto ya mismo en profTrabajaEn(), sin esperar un reload
  try{ localStorage.setItem('luffy_horario_'+s.profId, JSON.stringify(s.dias)); }catch(e){}
  if(DB){ try{ await DB.doc('luffy/horario_'+s.profId).set(s.dias); }catch(e){ showToast('Se guardó en este dispositivo; falta conexión para subirlo'); } }
  if(profile&&profile.id===s.profId) horarioData=s.dias; // si el admin se edita a si mismo (tambienProf)
  const u=allUsers.find(x=>x.id===s.profId);
  admHorario=null; closeModal('modal-registro'); showToast('Horario de '+(u?u.name:'')+' guardado ✓');
}
// ---------- Admin: cobros que recepción corrigió — quedan para revisar ----------
// Pedido de Ivo (1/10/2026): recepción puede corregir un cobro mal hecho directo (ver abrirEditarCobro en
// 12-dinero-turnos.js), pero no puede pasar desapercibido -- queda anotado acá hasta que Admin lo marque como
// revisado, con el detalle completo de qué cambió y por qué.
function turnosEditadosPendientes(){
  const out=[];
  allUsers.filter(u=>esProf(u)||u.role==='recepcionista').forEach(u=>{
    let dd={}; try{ dd=JSON.parse(localStorage.getItem('luffy_dinero_'+u.id)||'{}'); }catch(e){}
    (dd.turnos||[]).filter(t=>t.editado&&!t.revisadoAdmin).forEach(t=>out.push({...t,profId:u.id,profNombre:u.name}));
  });
  return out.sort((a,b)=>String(b.editadoEn||'').localeCompare(String(a.editadoEn||'')));
}
function htmlCobrosEditadosPanel(){
  if(!profile||profile.role!=='admin') return '';
  const n=turnosEditadosPendientes().length; if(!n) return '';
  return `<div class="card" onclick="abrirCobrosEditados()" style="cursor:pointer;margin:10px 0;border-color:rgba(251,191,36,.55);background:rgba(251,191,36,.07)"><div style="font-size:13px;font-weight:800;color:#fbbf24">✏️ ${n} ${n===1?'cobro corregido':'cobros corregidos'} por revisar</div><div style="font-size:11.5px;color:var(--muted2)">Recepción corrigió un cobro mal hecho. Tocá para ver qué cambió.</div></div>`;
}
function abrirCobrosEditados(){
  const L=turnosEditadosPendientes();
  document.getElementById('registro-content').innerHTML=cabeceraModal('✏️ Cobros corregidos por revisar ('+L.length+')')+
    (L.length?L.map(t=>{
      const o=t.editOriginal||{};
      return `<div class="card" style="margin-bottom:8px;border-left:5px solid #fbbf24">
        <div style="font-size:13.5px;font-weight:800">${escH(t.cliente||'Cliente')} <span style="color:var(--muted2);font-weight:600">· ${escH(t.profNombre)}</span></div>
        <div style="font-size:11.5px;color:var(--muted2);margin:4px 0">Corrigió ${escH(t.editadoPor)} el ${fechaCortaStr((t.editadoEn||'').slice(0,10))}${t.editMotivo?' · "'+escH(t.editMotivo)+'"':''}</div>
        <div style="font-size:12.5px;background:var(--s2);border-radius:10px;padding:8px 10px;line-height:1.6">
          <div style="color:#f472b6">Antes: ${escH(o.servicio||'—')} · ${fp(numV(o.aCobrar!=null?o.aCobrar:o.monto))} · ${MED_COBRANZA[o.medio]||escH(o.medio||'')}</div>
          <div style="color:#34d399">Ahora: ${escH(t.servicio||'—')} · ${fp(numV(t.aCobrar!=null?t.aCobrar:t.monto))} · ${MED_COBRANZA[t.medio]||escH(t.medio||'')}</div>
        </div>
        <button class="lnk" style="margin-top:6px" onclick="marcarEdicionRevisada('${t.profId}','${t.id}')">✓ Marcar como revisado</button>
      </div>`;
    }).join(''):'<div style="text-align:center;color:var(--muted);font-size:13px;padding:16px">No hay nada por revisar.</div>');
  openModal('modal-registro');
}
async function marcarEdicionRevisada(profId,turnoId){
  const ahora=new Date().toISOString();
  await modificarDineroDe(profId,dd=>{ const t=(dd.turnos||[]).find(x=>x.id===turnoId); if(!t) return false; t.revisadoAdmin=true; t.revisadoPor=profile.name; t.revisadoEn=ahora; return true; });
  showToast('Marcado como revisado ✓'); abrirCobrosEditados(); refreshCurrentView();
}
// ---------- Admin: turnos "para cobrar" que recepción/admin eliminó — quedan para revisar ----------
// Pedido de Ivo (2/10/2026), mismo criterio que los cobros corregidos de arriba: eliminar no puede ser mudo.
function turnosPendientesEliminados(){
  return turnosPendientesSt.list.filter(x=>x.estado==='eliminado'&&!x.revisadoAdmin).sort((a,b)=>String(b.eliminadoEn||'').localeCompare(String(a.eliminadoEn||'')));
}
function htmlTurnosEliminadosPanel(){
  if(!profile||profile.role!=='admin') return '';
  const n=turnosPendientesEliminados().length; if(!n) return '';
  return `<div class="card" onclick="abrirTurnosEliminados()" style="cursor:pointer;margin:10px 0;border-color:rgba(244,114,182,.55);background:rgba(244,114,182,.07)"><div style="font-size:13px;font-weight:800;color:#f472b6">🗑️ ${n} ${n===1?'turno eliminado':'turnos eliminados'} de "Para cobrar"</div><div style="font-size:11.5px;color:var(--muted2)">Alguien sacó un turno que un profesional había mandado a cobrar. Tocá para ver por qué.</div></div>`;
}
function abrirTurnosEliminados(){
  const L=turnosPendientesEliminados();
  document.getElementById('registro-content').innerHTML=cabeceraModal('🗑️ Turnos eliminados de "Para cobrar" ('+L.length+')')+
    (L.length?L.map(x=>`<div class="card" style="margin-bottom:8px;border-left:5px solid #f472b6">
      <div style="font-size:13.5px;font-weight:800">${escH(x.clienteNombre)} <span style="color:var(--muted2);font-weight:600">· ${escH(x.profNombre)}</span></div>
      <div style="font-size:12px;color:var(--muted2);margin:3px 0">${escH(x.servicios.map(s=>s.nombre).join(', '))}</div>
      <div style="font-size:11.5px;color:var(--muted2)">Eliminó ${escH(x.eliminadoPor)} el ${fechaCortaStr((x.eliminadoEn||'').slice(0,10))}${x.eliminadoMotivo?' · "'+escH(x.eliminadoMotivo)+'"':''}</div>
      <button class="lnk" style="margin-top:6px" onclick="marcarEliminacionRevisada('${x.id}')">✓ Marcar como revisado</button>
    </div>`).join(''):'<div style="text-align:center;color:var(--muted);font-size:13px;padding:16px">No hay nada por revisar.</div>');
  openModal('modal-registro');
}
async function marcarEliminacionRevisada(id){
  const ahora=new Date().toISOString();
  await turnosPendientesSt.cambiar(l=>{ const x=l.find(z=>z.id===id); if(x){ x.revisadoAdmin=true; x.revisadoPor=profile.name; x.revisadoEn=ahora; } });
  showToast('Marcado como revisado ✓'); abrirTurnosEliminados(); refreshCurrentView();
}
function refrescarRubrosPropios(){
  if(!DB||!profile||profile.role!=='profesional') return;
  Promise.resolve(DB.doc('luffy/rubros_prof').get()).then(r=>{
    const l=r&&r.byId&&r.byId[profile.id];
    if(l&&JSON.stringify(l)!==JSON.stringify(profile.rubros||[])){ rubrosProf=r.byId; aplicarRubrosProf(); refreshCurrentView(); }
  }).catch(()=>{});
}

// ---------- combos y ofertas ----------
let comboSel=[], ofertaSel=[];
function renderAdminCombos(body){
  const nom=(id)=>(servicios.find(s=>s.id===id)||{}).nombre||'?';
  body.innerHTML+=`
    <div class="sec-hdr" style="margin:6px 0 8px"><span class="sec-title">🧩 Combos</span><button class="lnk" onclick="abrirFormCombo()">+ Nuevo combo</button></div>
    <div class="card" style="margin-bottom:10px;font-size:12px;color:var(--muted2);line-height:1.5">Cuando el profesional elige <b style="color:var(--text)">todos los servicios de un combo</b>, se cobra el precio del combo solo, sin que tenga que hacer nada.</div>
    ${combos.length?combos.map(c=>{ const lista=c.servicioIds.reduce((a,id)=>a+numV((servicios.find(s=>s.id===id)||{}).precio),0);
      return `<div class="prof-card" style="margin-bottom:8px;padding:12px 14px"><div style="display:flex;align-items:center;gap:10px">
        <div style="flex:1;min-width:0"><div style="font-size:14px;font-weight:700">${escH(c.nombre)} ${c.rubro?`<span class="bdg">${escH(nombreRubro(c.rubro))}</span>`:''}</div>
          <div style="font-size:11.5px;color:var(--muted2);margin-top:3px">${c.servicioIds.map(id=>escH(nom(id))).join(' + ')}</div>
          <div style="font-size:11.5px;margin-top:3px"><span style="color:var(--muted2)">Por separado ${fp(lista)}</span> → <b>${fp(c.precio)}</b> <span style="color:#34d399;font-weight:700">(ahorro ${fp(lista-c.precio)})</span></div></div>
        <button onclick="abrirFormCombo('${c.id}')" style="background:none;border:none;color:var(--muted2);font-size:15px;cursor:pointer">✏️</button>
        <button onclick="borrarCombo('${c.id}')" style="background:none;border:none;color:var(--muted);font-size:18px;cursor:pointer">×</button>
      </div></div>`; }).join(''):'<div style="text-align:center;color:var(--muted);font-size:13px;padding:14px">Sin combos cargados</div>'}

    <div class="sec-hdr" style="margin:20px 0 8px"><span class="sec-title">🏷️ Ofertas</span><button class="lnk" onclick="abrirFormOferta()">+ Nueva oferta</button></div>
    ${ofertas.length?ofertas.map(o=>{
      const activa=o.activa!==false;
      const aplica=(o.servicioIds&&o.servicioIds.length)?o.servicioIds.map(id=>(servicios.find(s=>s.id===id)||{}).nombre).filter(Boolean).join(', '):(o.rubro?'Todos los servicios de '+nombreRubro(o.rubro):'Todos los servicios');
      return `<div class="prof-card" style="margin-bottom:8px;${activa?'':'opacity:.55'}"><div style="display:flex;align-items:center;gap:10px">
        <div style="flex:1;min-width:0"><div style="font-size:14px;font-weight:700">${escH(o.nombre)} · −${o.pct}% ${o.rubro?`<span class="bdg">${escH(nombreRubro(o.rubro))}</span>`:''}</div><div style="font-size:11px;color:var(--muted2)">${escH(aplica)}</div></div>
        <button onclick="toggleOferta('${o.id}')" style="padding:6px 12px;border-radius:10px;border:1.5px solid ${activa?'#34d399':'var(--border2)'};background:${activa?'rgba(52,211,153,.12)':'transparent'};color:${activa?'#34d399':'var(--muted2)'};font-family:var(--font);font-size:11px;font-weight:700;cursor:pointer">${activa?'Activa':'Pausada'}</button>
        <button onclick="abrirFormOferta('${o.id}')" style="background:none;border:none;color:var(--muted2);font-size:15px;cursor:pointer">✏️</button>
        <button onclick="borrarOferta('${o.id}')" style="background:none;border:none;color:var(--muted);font-size:18px;cursor:pointer">×</button>
      </div></div>`;
    }).join(''):'<div style="text-align:center;color:var(--muted);font-size:13px;padding:14px">Sin ofertas cargadas</div>'}`;
}
function listaChecksServicios(rubroId,seleccion,fnToggle){
  const l=servicios.filter(s=>!rubroId||s.rubro===rubroId);
  if(!l.length) return '<div style="font-size:12px;color:var(--muted);padding:6px">No hay servicios en este rubro.</div>';
  return l.map(s=>`<label style="display:flex;align-items:center;gap:8px;font-size:13px;padding:6px 2px;text-transform:none;letter-spacing:0;color:var(--text)"><input type="checkbox" ${seleccion.includes(s.id)?'checked':''} onchange="${fnToggle}('${s.id}')" style="width:auto"/> <span style="flex:1">${escH(s.nombre)}</span><span style="color:var(--muted2);font-size:12px">${fp(s.precio)}</span></label>`).join('');
}
const selRubroHtml=(id,valor,conTodos)=>`<select id="${id}" style="${inpCss}">${conTodos?`<option value="" ${!valor?'selected':''}>Todos los rubros</option>`:''}${rubros.map(r=>`<option value="${r.id}" ${valor===r.id?'selected':''}>${escH(r.nombre)}</option>`).join('')}</select>`;

// --- combo ---
function abrirFormCombo(id){
  const c=id?combos.find(x=>x.id===id):null;
  comboSel=c?[...c.servicioIds]:[];
  const cont=document.getElementById('registro-content');
  cont.innerHTML=`<div style="display:flex;align-items:center;gap:8px;margin-bottom:14px"><div class="modal-title" style="margin:0">${c?'Editar combo':'Combo nuevo'}</div><button onclick="closeModal('modal-registro')" style="margin-left:auto;background:var(--s3);border:none;color:var(--muted2);font-size:18px;width:32px;height:32px;border-radius:50%;cursor:pointer">×</button></div>
    <input type="hidden" id="cbo-id" value="${c?c.id:''}"/>
    <div class="field"><label>Nombre del combo</label><input id="cbo-nombre" placeholder="Ej: Corte y Barba" value="${escH(c?c.nombre:'')}"/></div>
    <div class="field" style="margin-top:8px"><label>Rubro</label>${selRubroHtml('cbo-rubro',c?c.rubro:(adminSvcRubro!=='todos'&&adminSvcRubro!=='sin'?adminSvcRubro:'barberia'),false).replace('<select ','<select onchange="comboRefrescar()" ')}</div>
    <div class="field" style="margin-top:8px"><label>Servicios que lo forman (2 o más)</label><div id="cbo-lista" style="max-height:220px;overflow-y:auto;border:1.5px solid var(--border2);border-radius:12px;padding:6px 10px"></div></div>
    <div class="field" style="margin-top:8px"><label>Precio del combo ($)</label><input id="cbo-precio" type="number" inputmode="decimal" placeholder="0" value="${c?c.precio:''}" oninput="comboResumen()"/></div>
    <div class="field" style="margin-top:8px"><label>Duración real de hacerlo junto (minutos) — vacío = suma la de cada servicio por separado</label><input id="cbo-duracion" type="number" inputmode="numeric" placeholder="Ej: 60" value="${c&&c.duracion?c.duracion:''}" oninput="comboResumen()"/></div>
    <div id="cbo-resumen" style="font-size:12px;margin:10px 0;line-height:1.6"></div>
    <button class="btn btn-primary" onclick="guardarCombo()">${c?'Guardar cambios':'Crear combo'}</button>`;
  comboRefrescar(); openModal('modal-registro');
}
function comboRefrescar(){
  const rid=document.getElementById('cbo-rubro').value;
  comboSel=comboSel.filter(id=>{ const s=servicios.find(x=>x.id===id); return s&&s.rubro===rid; });
  document.getElementById('cbo-lista').innerHTML=listaChecksServicios(rid,comboSel,'comboToggle');
  comboResumen();
}
function comboToggle(id){ const i=comboSel.indexOf(id); if(i>=0) comboSel.splice(i,1); else comboSel.push(id); comboResumen(); }
function comboResumen(){
  const lista=comboSel.reduce((a,id)=>a+numV((servicios.find(s=>s.id===id)||{}).precio),0);
  const durSuma=comboSel.reduce((a,id)=>a+svcDuracion(servicios.find(s=>s.id===id)),0);
  const p=parseFloat(document.getElementById('cbo-precio')?.value)||0;
  const durCombo=numV(document.getElementById('cbo-duracion')?.value);
  const el=document.getElementById('cbo-resumen'); if(!el) return;
  el.innerHTML=comboSel.length?`Por separado: <b>${fp(lista)}</b>${p?` · Combo: <b>${fp(p)}</b> · `+(p<lista?`<span style="color:#34d399;font-weight:700">ahorro ${fp(lista-p)}</span>`:`<span style="color:#f472b6;font-weight:700">el combo tiene que costar menos que la suma</span>`):''}<br>Duración sumando cada servicio: <b>${durSuma} min</b>${durCombo?` · Duración real del combo: <b style="color:#a89fff">${durCombo} min</b>`:''}`:'<span style="color:var(--muted)">Marcá los servicios del combo</span>';
}
function guardarCombo(){
  const nombre=(document.getElementById('cbo-nombre').value||'').trim();
  const precio=parseFloat(document.getElementById('cbo-precio').value)||0;
  const rubro=document.getElementById('cbo-rubro').value;
  const lista=comboSel.reduce((a,id)=>a+numV((servicios.find(s=>s.id===id)||{}).precio),0);
  if(!nombre||precio<=0){ showToast('Poné nombre y precio'); return; }
  if(comboSel.length<2){ showToast('Elegí al menos 2 servicios'); return; }
  if(precio>=lista){ showToast('El combo tiene que costar menos que la suma ('+fp(lista)+')'); return; }
  const id=document.getElementById('cbo-id').value;
  const duracion=numV(document.getElementById('cbo-duracion').value)||undefined;
  if(id){ const c=combos.find(x=>x.id===id); if(c) Object.assign(c,{nombre,precio,rubro,servicioIds:[...comboSel],duracion}); }
  else combos.push({id:Date.now().toString(),nombre,precio,rubro,servicioIds:[...comboSel],duracion});
  saveCombos(); closeModal('modal-registro'); showToast('Combo guardado ✓'); renderAdmin();
}
async function borrarCombo(id){
  const c=combos.find(x=>x.id===id); if(!c) return;
  if(!await uiConfirm('¿Borrar el combo "'+c.nombre+'"?','Los servicios se siguen cobrando por separado.')) return;
  combos=combos.filter(x=>x.id!==id); saveCombos(); renderAdmin();
}

// --- oferta ---
function abrirFormOferta(id){
  const o=id?ofertas.find(x=>x.id===id):null;
  ofertaSel=o&&o.servicioIds?[...o.servicioIds]:[];
  const cont=document.getElementById('registro-content');
  cont.innerHTML=`<div style="display:flex;align-items:center;gap:8px;margin-bottom:14px"><div class="modal-title" style="margin:0">${o?'Editar oferta':'Oferta nueva'}</div><button onclick="closeModal('modal-registro')" style="margin-left:auto;background:var(--s3);border:none;color:var(--muted2);font-size:18px;width:32px;height:32px;border-radius:50%;cursor:pointer">×</button></div>
    <input type="hidden" id="of-id" value="${o?o.id:''}"/>
    <div class="field"><label>Nombre de la oferta</label><input id="of-nombre" placeholder="Ej: Promo martes" value="${escH(o?o.nombre:'')}"/></div>
    <div class="field" style="margin-top:8px"><label>Descuento (%)</label><input id="of-pct" type="number" inputmode="decimal" placeholder="20" value="${o?o.pct:''}"/></div>
    <div class="field" style="margin-top:8px"><label>Rubro (quién la ve)</label>${selRubroHtml('of-rubro',o?o.rubro:'',true).replace('<select ','<select onchange="ofertaRefrescar()" ')}</div>
    <div class="field" style="margin-top:8px"><label>Aplica a (si no marcás ninguno, aplica a todos los servicios del rubro)</label><div id="of-lista" style="max-height:200px;overflow-y:auto;border:1.5px solid var(--border2);border-radius:12px;padding:6px 10px"></div></div>
    <button class="btn btn-primary" onclick="guardarOferta()" style="margin-top:14px">${o?'Guardar cambios':'Crear oferta'}</button>`;
  ofertaRefrescar(); openModal('modal-registro');
}
function ofertaRefrescar(){ document.getElementById('of-lista').innerHTML=listaChecksServicios(document.getElementById('of-rubro').value,ofertaSel,'ofertaToggle'); }
function ofertaToggle(id){ const i=ofertaSel.indexOf(id); if(i>=0) ofertaSel.splice(i,1); else ofertaSel.push(id); }
function guardarOferta(){
  const nombre=(document.getElementById('of-nombre').value||'').trim();
  const pct=parseFloat(document.getElementById('of-pct').value)||0;
  const rubro=document.getElementById('of-rubro').value;
  if(!nombre||pct<=0||pct>100){ showToast('Poné nombre y un % entre 1 y 100'); return; }
  const servicioIds=ofertaSel.filter(id=>{ const s=servicios.find(x=>x.id===id); return s&&(!rubro||s.rubro===rubro); });
  const id=document.getElementById('of-id').value;
  if(id){ const o=ofertas.find(x=>x.id===id); if(o){ Object.assign(o,{nombre,pct,servicioIds}); if(rubro) o.rubro=rubro; else delete o.rubro; } }
  else { const o={id:Date.now().toString(),nombre,pct,servicioIds,activa:true}; if(rubro) o.rubro=rubro; ofertas.push(o); }
  saveOfertas(); closeModal('modal-registro'); showToast('Oferta guardada ✓'); renderAdmin();
}
function toggleOferta(id){
  const o=ofertas.find(x=>x.id===id); if(!o) return;
  o.activa=(o.activa===false); saveOfertas(); renderAdmin();
}
async function borrarOferta(id){
  if(!await uiConfirm('¿Borrar esta oferta?','')) return;
  ofertas=ofertas.filter(o=>o.id!==id); saveOfertas(); renderAdmin();
}

function renderAdminProductos(body){
  body.innerHTML += `
    <div class="sec-title" style="margin-bottom:12px">📦 Productos</div>
    <button onclick="mostrarFormProducto()" class="btn btn-primary" style="margin-bottom:14px;width:100%">+ Cargar producto</button>
    <div id="producto-form-wrap"></div>
    ${productos.length ? productos.map(p=>{
      const bajo = p.stock<=p.alertaStock;
      return `<div class="prof-card" style="margin-bottom:10px;${bajo?'border-color:#f472b6':''}">
        <div style="display:flex;align-items:center;gap:10px">
          <div style="font-size:24px">📦</div>
          <div style="flex:1">
            <div style="font-size:14px;font-weight:700">${p.nombre}</div>
            <div style="font-size:11px;color:var(--muted2)">Costo ${fp(p.costo)} · Venta ${fp(p.precioVenta)} · Comisión ${p.comisionPct}%</div>
            <div style="font-size:11px;font-weight:700;margin-top:2px;color:${bajo?'#f472b6':'var(--muted2)'}">Stock: ${p.stock}${bajo?' ⚠️ queda poco':''}</div>
          </div>
          <button onclick="borrarProducto('${p.id}')" style="background:none;border:none;color:var(--muted);font-size:18px;cursor:pointer;flex-shrink:0">×</button>
        </div>
      </div>`;
    }).join('') : '<div style="text-align:center;color:var(--muted);font-size:13px;padding:20px">Sin productos cargados todavía</div>'}
  `;
}

function mostrarFormProducto(){
  const wrap=document.getElementById('producto-form-wrap');
  wrap.innerHTML=`<div class="card" style="margin-bottom:14px">
    <div class="field"><label>Nombre</label><input id="pr-nombre" placeholder="Ej: Cera para pelo"/></div>
    <div class="field" style="margin-top:8px"><label>Costo (lo que te sale a vos)</label><input id="pr-costo" type="number" placeholder="0"/></div>
    <div class="field" style="margin-top:8px"><label>Precio de venta</label><input id="pr-precio" type="number" placeholder="0"/></div>
    <div class="field" style="margin-top:8px"><label>Comisión del profesional (%)</label><input id="pr-comision" type="number" placeholder="10"/></div>
    <div class="field" style="margin-top:8px"><label>Stock inicial</label><input id="pr-stock" type="number" placeholder="0"/></div>
    <div class="field" style="margin-top:8px"><label>Avisar al encargado cuando queden (unidades)</label><input id="pr-alerta" type="number" placeholder="5"/></div>
    <div style="display:flex;gap:8px;margin-top:12px">
      <button onclick="document.getElementById('producto-form-wrap').innerHTML=''" style="flex:1;padding:12px;border-radius:10px;border:1.5px solid var(--border2);background:transparent;color:var(--muted2);font-family:var(--font);font-size:13px;font-weight:700;cursor:pointer">Cancelar</button>
      <button onclick="guardarProducto()" style="flex:1;padding:12px;border-radius:10px;border:none;background:var(--accent);color:#fff;font-family:var(--font);font-size:13px;font-weight:700;cursor:pointer">Guardar</button>
    </div>
  </div>`;
  document.getElementById('pr-nombre')?.focus();
}

function guardarProducto(){
  const nombre=document.getElementById('pr-nombre')?.value.trim();
  if(!nombre){ showToast('Falta el nombre'); return; }
  const costo=parseFloat(document.getElementById('pr-costo')?.value)||0;
  const precioVenta=parseFloat(document.getElementById('pr-precio')?.value)||0;
  const comisionPct=parseFloat(document.getElementById('pr-comision')?.value)||0;
  const stock=parseInt(document.getElementById('pr-stock')?.value)||0;
  const alertaStock=parseInt(document.getElementById('pr-alerta')?.value)||5;
  const nuevo={id:Date.now().toString(), nombre, costo, precioVenta, comisionPct, stock, alertaStock, creado:new Date().toISOString()};
  productosCambiar(l=>{ if(!l.some(x=>x.id===nuevo.id)) l.push(nuevo); return l; });
  showToast('Producto agregado ✓');
  renderAdmin();
}

async function borrarProducto(id){
  if(!await uiConfirm('¿Borrar este producto?','Se saca del catálogo. Las ventas ya hechas no cambian.')) return;
  productosCambiar(l=>l.filter(p=>p.id!==id));
  renderAdmin();
}

function renderAdminCumpleanos(body){
  body=body||document.getElementById('admin-body');
  // Admin can load cumpleanos for recepcionista
  const recUsers=allUsers.filter(u=>u.role==='recepcionista');
  if(!recUsers.length) return;
  const recId=recUsers[0].id;
  let recD={reagendamientos:0,cumpleanos:[],incidentes:[]};
  try { recD=JSON.parse(localStorage.getItem('luffy_rec_'+recId)||'{"reagendamientos":0,"cumpleanos":[],"incidentes":[]}'); } catch(e){}

  body.innerHTML+=`
    <div class="sec-title" style="margin:16px 0 10px">🎂 Gestión de cumpleaños</div>
    <button onclick="agregarCumple('${recId}')" class="sec-btn" style="background:var(--accent);margin-bottom:12px;padding:10px 16px;border-radius:12px;border:none;color:#fff;font-family:var(--font);font-size:13px;font-weight:700;cursor:pointer;width:100%">+ Agregar cumpleaños</button>
    ${(recD.cumpleanos||[]).map(c=>`<div class="card" style="margin-bottom:8px;display:flex;align-items:center;gap:10px">
      <div style="font-size:20px">🎂</div>
      <div style="flex:1"><div style="font-size:13px;font-weight:700">${c.nombre}</div><div style="font-size:11px;color:var(--muted2)">${c.fecha} · ${c.telefono||''}</div></div>
      <button onclick="borrarCumple('${recId}','${c.id}')" style="padding:4px 10px;border-radius:8px;border:none;background:rgba(244,114,182,.15);color:#f472b6;font-family:var(--font);font-size:11px;cursor:pointer">×</button>
    </div>`).join('')||'<div style="font-size:13px;color:var(--muted);text-align:center;padding:12px">Sin cumpleaños cargados</div>'}`;
}

function leerRecLocal(id){ try{ return JSON.parse(localStorage.getItem('luffy_rec_'+id)||'{"reagendamientos":0,"cumpleanos":[],"incidentes":[]}'); }catch(e){ return {reagendamientos:0,cumpleanos:[],incidentes:[]}; } }
async function cambiarCumples(fn){
  for(const u of allUsers.filter(x=>x.role==='recepcionista')){
    let recD=leerRecLocal(u.id);
    if(DB){ try{ const r=await DB.doc('luffy/rec_'+u.id).get(); if(r) recD=r; }catch(e){} }
    if(!recD.cumpleanos) recD.cumpleanos=[];
    fn(recD);
    try{ localStorage.setItem('luffy_rec_'+u.id,JSON.stringify(recD)); }catch(e){}
    if(DB){ try{ await DB.doc('luffy/rec_'+u.id).set(recD); }catch(e){} }
  }
}
async function agregarCumple(){
  const v=await uiDialog({title:'Agregar cumpleaños',msg:'Lo ven todas las recepcionistas.',fields:[{label:'Nombre del cliente',placeholder:'Nombre'},{label:'Fecha (MM-DD)',value:'01-15',placeholder:'MM-DD'},{label:'Teléfono (opcional)',type:'tel'}],ok:'Agregar'});
  if(!v) return;
  const nombre=(v[0]||'').trim(), fecha=(v[1]||'').trim(), telefono=(v[2]||'').trim();
  if(!nombre||!fecha){ showToast('Faltan el nombre o la fecha'); return; }
  const id=Date.now().toString();
  await cambiarCumples(r=>{ r.cumpleanos.push({id,nombre,fecha,telefono:telefono||'',contactado:false}); });
  showToast('Cumpleaños agregado ✓'); renderAdmin();
}
async function borrarCumple(recId,id){
  await cambiarCumples(r=>{ r.cumpleanos=r.cumpleanos.filter(c=>c.id!==id); });
  showToast('Eliminado ✓'); renderAdmin();
}

function renderAdminPuntos(body){
  const profesionales = allUsers.filter(p=>esProf(p));
  const ranking = profesionales.map(p=>({...p,pts:getPuntos(p.id).total||0})).sort((a,b)=>b.pts-a.pts);
  const medals = ['🥇','🥈','🥉'];
  const pendientes = canjesSolicitudes.filter(s=>s.estado==='pendiente');

  const rankHtml = ranking.map((p,i)=>`<div class="ranking-item">
    <div class="ranking-pos" style="background:${i<3?'rgba(251,191,36,.2)':'var(--s2)'};color:${i<3?'#fbbf24':'var(--muted2)'}">${medals[i]||i+1}</div>
    <div class="ranking-av" style="background:${p.color}33;border-color:${p.color}">${p.emoji}</div>
    <div class="ranking-info"><strong>${p.name}</strong><span>${(getPuntos(p.id).movimientos||[]).length} movimientos</span></div>
    <div class="ranking-pts" style="color:${p.color}">⭐${p.pts}</div>
  </div>`).join('');

  const solHtml = pendientes.map(s=>`<div class="card" style="margin-bottom:8px">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
      <div><strong style="font-size:13px">${s.profName}</strong><div style="font-size:11px;color:var(--muted2)">${s.canjeLabel} · ⭐${s.pts}</div></div>
      <div style="display:flex;gap:6px">
        <button onclick="aprobarCanje('${s.id}')" style="padding:6px 12px;border-radius:8px;border:none;background:#34d399;color:#fff;font-family:var(--font);font-size:12px;font-weight:700;cursor:pointer">Aprobar</button>
        <button onclick="rechazarCanje('${s.id}')" style="padding:6px 12px;border-radius:8px;border:none;background:rgba(244,114,182,.2);color:#f472b6;font-family:var(--font);font-size:12px;font-weight:700;cursor:pointer">Rechazar</button>
      </div>
    </div>
  </div>`).join('');

  body.innerHTML += htmlAdminReglasPuntos()+`
    ${htmlMeritocracia()}
    <div class="sec-title" style="margin-bottom:12px">🏆 Ranking</div>
    ${rankHtml}
    <div class="sec-hdr" style="margin:16px 0 12px"><span class="sec-title">Dar/quitar puntos</span></div>
    ${profesionales.map(p=>`<div class="card" style="margin-bottom:8px">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
        <div style="width:36px;height:36px;border-radius:50%;background:${p.color}33;display:flex;align-items:center;justify-content:center;font-size:16px">${p.emoji}</div>
        <div style="flex:1"><strong style="font-size:13px">${p.name}</strong><div style="font-size:11px;color:var(--muted2)">⭐${getPuntos(p.id).total||0} puntos</div></div>
      </div>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        ${puntosAcciones().filter(c=>!c.auto).map(c=>`<button onclick="adminDarPuntos('${p.id}','${c.id}',${c.pts},'${escH(c.label)}')" style="padding:6px 10px;border-radius:8px;border:1.5px solid rgba(52,211,153,.3);background:rgba(52,211,153,.1);color:#34d399;font-family:var(--font);font-size:11px;font-weight:700;cursor:pointer">${c.emoji}+${c.pts}</button>`).join('')}
        <button onclick="adminPuntosNegativos('${p.id}')" style="padding:6px 10px;border-radius:8px;border:1.5px solid rgba(244,114,182,.3);background:rgba(244,114,182,.1);color:#f472b6;font-family:var(--font);font-size:11px;font-weight:700;cursor:pointer">⚠️ Neg</button>
      </div>
    </div>`).join('')}
    ${pendientes.length?`<div class="sec-hdr" style="margin:16px 0 12px"><span class="sec-title">Solicitudes de canje (${pendientes.length})</span></div>${solHtml}`:''}`;
}

function adminDarPuntos(profId, tipo, pts, razon){
  addPuntos(profId, tipo, pts, razon);
  const p = allUsers.find(x=>x.id===profId);
  showToast(`+${pts} pts a ${p?.name} ✓`);
  renderAdmin();
}

async function adminPuntosNegativos(profId){
  const p = allUsers.find(x=>x.id===profId);
  const v = await uiDialog({title:'Quitar puntos a '+(p?p.name:''),fields:[{label:'Razón',placeholder:'¿Qué pasó?'},{label:'Cantidad de puntos',type:'number',value:'10'}],ok:'Quitar'});
  if(!v) return;
  const razon=(v[0]||'').trim(); const pts=parseInt(v[1])||0;
  if(!razon||!pts){ showToast('Poné la razón y los puntos'); return; }
  addPuntos(profId, 'negativo', -pts, razon);
  showToast(`-${pts} pts a ${p?.name}`);
  renderAdmin();
}

function aprobarCanje(solId){
  const sol = canjesSolicitudes.find(s=>s.id===solId);
  if(!sol) return;
  sol.estado = 'aprobado';
  addPuntos(sol.profId, 'canje', -sol.pts, 'Canje: '+sol.canjeLabel);
  savePuntosData();
  showToast('Canje aprobado ✓');
  renderAdmin();
}

function rechazarCanje(solId){
  const sol = canjesSolicitudes.find(s=>s.id===solId);
  if(!sol) return;
  sol.estado = 'rechazado';
  savePuntosData();
  showToast('Canje rechazado');
  renderAdmin();
}

