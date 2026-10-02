// ============ PROMOS, FIDELIDAD, MEMBRESIAS Y PAQUETES ============
// Todo lo que define el admin (descuentos fijos por horario/profesion, tarjeta de fidelidad, membresia,
// escalera de paquetes y regla de comision con descuentos altos) vive en un solo documento: luffy/promos_cfg.
const PROMOS_DEFAULT={
  fijos:[
    {id:'f1',nombre:'De 9:00 a 12:30 (lunes a jueves)',pct:20,rubro:'barberia,barberia-premium',dias:[1,2,3,4],horaDesde:'09:00',horaHasta:'12:30',sucursales:[],profesion:'',activo:true},
    {id:'f2',nombre:'Fuerzas policiales · Diego Laure',pct:15,rubro:'barberia,barberia-premium',dias:[1,2],horaHasta:'',sucursales:['s1'],profesion:'Fuerzas policiales',activo:true},
    {id:'f3',nombre:'Fuerzas policiales · French',pct:15,rubro:'barberia,barberia-premium',dias:[2,3],horaHasta:'',sucursales:['s2'],profesion:'Fuerzas policiales',activo:true},
    // Peluqueria (Dai): lunes a miercoles. El 15% adicional para fuerzas SE SUMA a la promo (es el unico descuento acumulativo)
    {id:'f4',nombre:'Tratamientos capilares · lun a mié',pct:15,rubro:'peluqueria',servicioIds:['ap2673649','ap2796310','ap2673655','ap2673652'],dias:[1,2,3],horaHasta:'',sucursales:[],profesion:'',extra:{profesion:'Fuerzas policiales',pct:15},activo:true},
    {id:'f5',nombre:'Coloración y baño de luz · lun a mié',pct:10,rubro:'peluqueria',servicioIds:['ap2706066','ap2673675','ap2673670'],dias:[1,2,3],horaHasta:'',sucursales:[],profesion:'',extra:{profesion:'Fuerzas policiales',pct:15},activo:true},
  ],
  // Si el descuento total supera "t1" el profesional cobra "p1"% de lo que pagó el cliente; si llega a "t2", cobra "p2"%
  bloquesRec:[{id:'b1',nombre:'Mañana',desde:'09:00',hasta:'14:30',dias:[1,2,3,4,5,6]},{id:'b2',nombre:'Tarde',desde:'14:30',hasta:'20:30',dias:[1,2,3,4,5,6]}],
  avisoAperturaMin:5, // el admin ve si recepcion ya abrio la caja desde 5 minutos antes de cada bloque
  recPaq:{pct:10,comProf:45}, // recepcion cobra el 10% de la ganancia del salon por cada paquete que vende
  comisiones:{tramos:[{min:0,pct:45},{min:1000000,pct:50},{min:1200000,pct:55}],oro:{min:1200000,pct:60,reels:3},nuevos:{meses:2,base:50,contenido:5,reels:3,extra:5,extraDesde:800000},asegurado:{pct:50}},
  comision:{t1:30,p1:60,t2:50,p2:95},
  noche:{desde:'21:00',pct:70}, // turnos que terminan desde esta hora: sin descuentos y el profesional cobra pct%
  paquetes:[{n:2,pct:5},{n:3,pct:10},{n:4,pct:15}],
  membresia:{creditos:4,descPct:20,servicioId:'',rubro:'barberia,barberia-premium'},
  tarjetas:[{id:'tj-barberia',rubro:'barberia,barberia-premium',nombre:'Tarjeta de fidelidad',activa:true,
    visitas:[{n:2,pct:5},{n:3,pct:10},{n:4,pct:15},{n:10,pct:50}],referidos:[10,15,20,25],premio:{visitas:5,refs:4}},
    // Tarjeta de Dai: 1.° y 2.° servicio normales, 3.° con 10% en cualquier servicio, 6.° tratamiento de hidratacion gratis
    {id:'tj-dai',rubro:'peluqueria,cejas',nombre:'Tarjeta de fidelidad · Dai',activa:true,profs:['1789996303677'],
    visitas:[{n:3,pct:10},{n:6,pct:100,servicioIds:['ap2673649'],label:'Hidratación gratis'}],referidos:[],premio:null}],
};
const clonar=(o)=>JSON.parse(JSON.stringify(o));
const nocheCfg=()=>({desde:'21:00',pct:70,...(promos.noche||{})});
let promos=clonar(PROMOS_DEFAULT);
const DIAS_NOM=['dom','lun','mar','mié','jue','vie','sáb'];
const nombreSvcId=(id)=>((typeof servicios!=='undefined'?servicios:[]).find(x=>x.id===id)||{}).nombre||id;
// nombres (o pedazos de nombre) separados por coma -> ids de servicios
function idsServiciosPorNombre(txt,sep){ const out=[]; String(txt||'').split(sep||',').map(x=>nkey(x)).filter(Boolean).forEach(fr=>servicios.filter(sv=>nkey(sv.nombre).includes(fr)).forEach(sv=>{ if(!out.includes(sv.id)) out.push(sv.id); })); return out; }
function aplicarPromosRemotas(r){ return r?{...clonar(PROMOS_DEFAULT),...r}:null; }
function loadPromos(){
  try{ const r=JSON.parse(localStorage.getItem('luffy_promos_cfg')||'null'); if(r) promos=aplicarPromosRemotas(r); }catch(e){}
  if(DB){
    DB.doc('luffy/promos_cfg').get().then(r=>{
      if(r&&JSON.stringify(r)!==JSON.stringify(promos)){ promos=aplicarPromosRemotas(r); try{localStorage.setItem('luffy_promos_cfg',JSON.stringify(promos));}catch(e){} refreshCurrentView(); }
    }).catch(()=>{});
  }
}
function savePromos(){
  try{localStorage.setItem('luffy_promos_cfg',JSON.stringify(promos));}catch(e){}
  if(DB){ try{DB.doc('luffy/promos_cfg').set(promos);}catch(e){} }
}
// Suma un uso al cupo de una oferta armada con el Creador de ofertas (y a las demas lineas que compartan el mismo
// grupo, para que "10 lugares" sea un pozo comun aunque la oferta tenga varios servicios con % distinto cada uno).
// Relee el doc remoto antes de sumar (mismo cuidado que cambiarClientes) para no perder cupos si dos cobros
// pasan casi al mismo tiempo en dispositivos distintos -- no es 100% a prueba de carreras, pero reduce el riesgo.
async function consumirCupoOferta(reglaId){
  if(DB){ try{ const fresh=await DB.doc('luffy/promos_cfg').get(); if(fresh) promos=aplicarPromosRemotas(fresh); }catch(e){} }
  const f=(promos.fijos||[]).find(x=>x.id===reglaId); if(!f||f.cupo==null) return;
  const grupo=f.grupoOfertaId;
  promos.fijos.forEach(x=>{ if(x.id===reglaId||(grupo&&x.grupoOfertaId===grupo)) x.usos=numV(x.usos)+1; });
  savePromos();
}

// ---------- listas compartidas (membresias, paquetes): se guardan uniendo por id ----------
function almacenLista(doc,localKey,unir){
  const st={list:[]};
  st.merge=(remote)=>{
    if(!remote||!Array.isArray(remote.list)) return false;
    const antes=JSON.stringify(st.list); const m=new Map(st.list.map(x=>[x.id,x]));
    remote.list.forEach(r=>{ const l=m.get(r.id); m.set(r.id,l?unir(l,r):r); });
    st.list=[...m.values()]; return antes!==JSON.stringify(st.list);
  };
  st.persist=()=>{ try{localStorage.setItem(localKey,JSON.stringify(st.list));}catch(e){} };
  st.load=()=>{
    try{ st.list=JSON.parse(localStorage.getItem(localKey)||'[]'); }catch(e){ st.list=[]; }
    if(DB) DB.doc(doc).get().then(r=>{ if(st.merge(r)){ st.persist(); refreshCurrentView(); } }).catch(()=>{});
  };
  st.cambiar=async(fn)=>{
    if(DB){ try{ st.merge(await DB.doc(doc).get()); }catch(e){} }
    const res=fn(st.list); st.persist();
    if(DB){ try{ await DB.doc(doc).set({list:st.list}); }catch(e){ showToast('Se guardó en este dispositivo; falta conexión para subirlo'); } }
    return res;
  };
  return st;
}
const nuevoMayor=(a,b)=>String(b.upd||'')>String(a.upd||'')?b:a;
const membresiasSt=almacenLista('luffy/membresias','luffy_membresias',(a,b)=>{
  const base=nuevoMayor(a,b); const usos=new Map(); [...(a.usos||[]),...(b.usos||[])].forEach(u=>usos.set(u.turnoId,u));
  return {...base,usos:[...usos.values()]};
});
const paquetesSt=almacenLista('luffy/paquetes','luffy_paquetes',(a,b)=>{
  const base=nuevoMayor(a,b); const bi=new Map((b.items||[]).map(i=>[i.id,i]));
  return {...base,items:(a.items||[]).map(i=>({...i,usado:i.usado||(bi.get(i.id)||{}).usado||null}))};
});
const sugerenciasPaqSt=almacenLista('luffy/sugerencias_paq','luffy_sugerencias_paq',nuevoMayor);
// Diego Laure: turnos que un profesional dejo "registrados" y todavia no cobro recepcion (ver "Registrar turno" / "Cobrar")
const turnosPendientesSt=almacenLista('luffy/turnos_pendientes','luffy_turnos_pendientes',nuevoMayor);
// Agenda propia de Luffy (separada de AgendaPro): turnos agendados a futuro, cargados desde acá. Ver "Agenda".
const agendaSt=almacenLista('luffy/agenda','luffy_agenda',nuevoMayor);
// Clientes a contactar (hoy: solo por resena negativa) — cola separada de "incidentes" (esa es para restar puntos al profesional, no aplica aca)
const contactosPendientesSt=almacenLista('luffy/contactos_pendientes','luffy_contactos_pendientes',nuevoMayor);
// Horarios que un profesional bloquea en su propia agenda (ausencia, algo personal) -- puntual (una fecha) o
// recurrente (un dia de la semana, todas las semanas hasta que lo saquen). Pedido por Ivo, 28/09/2026.
const bloqueosAgendaSt=almacenLista('luffy/bloqueos_agenda','luffy_bloqueos_agenda',nuevoMayor);
function loadSocial(){ loadClientes(); membresiasSt.load(); paquetesSt.load(); senasSt.load(); sugerenciasPaqSt.load(); turnosPendientesSt.load(); agendaSt.load(); contactosPendientesSt.load(); bloqueosAgendaSt.load(); }
// El "Sugerir combo" viejo (boton opcional) quedo reemplazado por la pregunta obligatoria
// "¿Le ofreciste un paquete?" dentro del cobro (ver renderPrepagoCobro / guardarCobro).
async function marcarSugerenciaAtendida(id){
  await sugerenciasPaqSt.cambiar(l=>{ const x=l.find(z=>z.id===id); if(x){ x.atendido=true; x.upd=new Date().toISOString(); } });
  refreshCurrentView();
}
function htmlSugerenciasPaqRec(){
  const L=sugerenciasPaqSt.list.filter(x=>!x.atendido).sort((a,b)=>String(b.ts).localeCompare(String(a.ts)));
  if(!L.length) return '';
  return `<div class="sec-hdr" style="margin-top:16px;margin-bottom:8px"><span class="sec-title">🎁 Combos sugeridos (${L.length})</span></div>
    ${L.map(x=>`<div class="card" style="margin-bottom:8px;border-left:5px solid #4A136B"><div style="font-size:14px;font-weight:800;text-transform:capitalize">${escH(x.clienteNombre)}${x.clienteNumero&&verNumeroCliente()?' #'+x.clienteNumero:''}</div>
      <div style="font-size:12px;color:var(--muted2);margin:3px 0"><span style="text-transform:capitalize">${x.tipo==='recordatorio'?'🔔 Nadie le ofreció un combo todavía':escH(nombreRubro(x.rubro)||x.rubro)}</span> · lo dejó <span style="text-transform:capitalize">${escH(x.profNombre)}</span> · ${minutosDesde(x.ts)}</div>
      <div style="display:flex;gap:8px;margin-top:6px"><button class="btn btn-ghost" style="flex:1" onclick="abrirVentaPaquete('${x.clienteId}')">🎁 Armar paquete</button><button class="btn btn-ghost" style="flex:0 0 auto" onclick="marcarSugerenciaAtendida('${x.id}')">✓ Atendido</button></div></div>`).join('')}`;
}
// Paquetes recién vendidos por cualquier profesional: recepción los ve acá para coordinar, en la Agenda, con qué profesional y a qué hora se hace cada servicio
function coordinarItemPaquete(pid,itemId){
  const p=paquetesSt.list.find(x=>x.id===pid); const it=p&&p.items.find(x=>x.id===itemId); if(!it) return;
  agPendingPaquete={paqueteId:pid,itemId,clienteId:p.clienteId,clienteNombre:p.clienteNombre,svcId:it.svcId,nombre:it.nombre};
  abrirAgenda(p.sucursal||null);
  showToast('Elegí un profesional y un horario para '+it.nombre);
}
async function marcarPaqueteAvisado(pid){
  await paquetesSt.cambiar(l=>{ const p=l.find(x=>x.id===pid); if(p){ p.avisado=true; p.upd=new Date().toISOString(); } });
  refreshCurrentView();
}
function htmlPaquetesNuevosRec(){
  const L=paquetesSt.list.filter(p=>!p.avisado).sort((a,b)=>String(b.creadoEn||'').localeCompare(String(a.creadoEn||'')));
  if(!L.length) return '';
  return `<div class="sec-hdr" style="margin-top:16px;margin-bottom:8px"><span class="sec-title">🎁 Paquetes nuevos (${L.length})</span></div>
    ${L.map(p=>`<div class="card" style="margin-bottom:8px;border-left:5px solid #34d399">
      <div style="display:flex;justify-content:space-between;align-items:baseline"><div style="font-size:14px;font-weight:800;text-transform:capitalize">${escH(p.clienteNombre)}${p.clienteNumero&&verNumeroCliente()?' #'+p.clienteNumero:''}</div><b>${fp(p.total)}</b></div>
      <div style="font-size:12px;color:var(--muted2);margin:3px 0">vendió <span style="text-transform:capitalize">${escH(p.vendedorNombre||'')}</span> · ${minutosDesde(p.creadoEn||new Date().toISOString())}</div>
      ${p.items.map(it=>`<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;font-size:12px;padding:3px 0">
        <span>${it.usado?'✅':'⬜'} ${escH(it.nombre)}${it.coord&&it.coord.fecha?` <span style="color:#34d399;font-weight:700">· ${fechaCortaStr(it.coord.fecha)}${it.coord.hora?' '+it.coord.hora+'hs':''}</span>`:''}</span>
        ${!it.usado?`<button class="lnk" style="flex-shrink:0" onclick="coordinarItemPaquete('${p.id}','${it.id}')">${it.coord&&it.coord.fecha?'Editar':'📅 Coordinar'}</button>`:''}
      </div>`).join('')}
      <button class="btn btn-ghost" style="margin-top:8px;width:100%" onclick="marcarPaqueteAvisado('${p.id}')">✓ Ya coordinado, sacar de la cola</button>
    </div>`).join('')}`;
}

// ============ AGENDA (propia de Luffy, separada de AgendaPro — ver negocio/pendientes-app.md) ============
// MVP: un dia a la vez, columnas por profesional, cada 15 min. No lee ni escribe nada de AgendaPro.
const AG_INICIO=8*60, AG_FIN=21*60+30, AG_PASO=15; // minutos desde las 00:00
function agSlots(){ const out=[]; for(let m=AG_INICIO;m<AG_FIN;m+=AG_PASO) out.push(m); return out; }
function agHM(m){ return String(Math.floor(m/60)).padStart(2,'0')+':'+String(m%60).padStart(2,'0'); }
function agMin(hm){ const p=(hm||'00:00').split(':').map(Number); return (p[0]||0)*60+(p[1]||0); }
function agEstado(a){
  if(a.estado==='cancelado') return 'cancelado';
  if(a.paqueteId){ const p=paquetesSt.list.find(x=>x.id===a.paqueteId); const it=p&&p.items.find(x=>x.id===a.itemId); if(it&&it.usado) return 'hecho'; }
  return a.estado||'agendado';
}
// Estados del turno con color (pedido por Ivo, 28/09/2026, describiendo el flujo real con clientes):
// reservado (azul, con globo si vino de /#reserva) -> esperando respuesta del recordatorio de 24hs (rojo suave)
// -> confirmado (naranja) -> no asistio (rojo fuerte, a mano) o hecho (verde, automatico al cobrarlo). El punteo
// de colores es editable a mano en cualquier momento (staff corrige si el automatismo se equivoca).
const AG_ESTADO_COLOR={agendado:'#3b82f6',esperando:'#fca5a5',confirmado:'#fb923c',no_asistio:'#dc2626',hecho:'#34d399'};
const AG_ESTADO_LABEL={agendado:'Reservado',esperando:'Esperando respuesta',confirmado:'Confirmado',no_asistio:'No asistió',hecho:'Hecho'};
// "Activo" = todavia no se resolvio (ni hecho ni no_asistio ni cancelado) -- lo que antes era simplemente
// agEstado(a)==='agendado' ahora tiene que cubrir tambien esperando/confirmado, que siguen siendo turnos futuros.
const AG_ESTADOS_ACTIVOS=['agendado','esperando','confirmado'];
function agEsActivo(a){ return AG_ESTADOS_ACTIVOS.includes(agEstado(a)); }
async function agCambiarEstado(id,nuevoEstado){
  await agendaSt.cambiar(l=>{ const x=l.find(y=>y.id===id); if(x){ x.estado=nuevoEstado; x.upd=new Date().toISOString(); } });
  agAbrirDetalle(id);
  renderAgenda();
}
// Al cobrarle a un cliente, si tenia un turno de hoy con ese profesional todavia sin resolver, se marca "hecho"
// solo (pedido de Ivo: verde automatico al cobrar, sin boton de check-in aparte). Best-effort por cliente+prof+
// fecha de hoy -- no hay (ni hace falta) un link explicito turno<->cobro para esto.
async function agMarcarHechoAutoPorCobro(clienteId,profId,fecha){
  if(!clienteId||!profId) return;
  const candidatos=agendaSt.list.filter(a=>a.clienteId===clienteId&&a.profId===profId&&a.fecha===fecha&&agEsActivo(a)&&!a.paqueteId);
  if(!candidatos.length) return;
  const ahora=new Date().toISOString();
  await agendaSt.cambiar(l=>{ candidatos.forEach(c=>{ const x=l.find(y=>y.id===c.id); if(x){ x.estado='hecho'; x.upd=ahora; } }); });
}

let agState={sucursal:null,fecha:null};
let agSel=null; // formulario en curso
let agPendingPaquete=null; // {paqueteId,itemId,clienteId,clienteNombre,svcId,nombre} al venir de "Coordinar" un paquete
let agPendingReagendo=null; // {clienteId,clienteNombre,servicios,profId,profNombre} al venir de "¿Cuándo vuelve?" en un cobro
let agProfFiltro=null; // si esta seteado, la grilla solo muestra ese profesional (ej. reagendo: no tiene sentido ver la agenda de todos)
let agVolver=null;

function abrirAgenda(sucId){
  agVolver = currentScreenId==='admin' ? ()=>{ show('admin'); enterAdmin(); }
    : currentScreenId==='recepcion' ? ()=>{ show('recepcion'); renderRecepcion(); }
    : ()=>goTo('hub');
  if(sucId) agState.sucursal=sucId;
  if(!agState.sucursal){ const ss=sucursalesDe(profile); agState.sucursal = ss[0] || (sucursales[0]&&sucursales[0].id) || null; }
  if(!agState.fecha) agState.fecha=hoyStr();
  goTo('agenda');
}
function volverDeAgenda(){
  agPendingPaquete=null;
  if(agPendingReagendo){ agPendingReagendo=null; agProfFiltro=null; volverDeAgendaACobro(); return; }
  (agVolver||(()=>goTo('hub')))();
}
// Vuelve al cobro que quedo pendiente mientras se elegia dia/hora del reagendo en la agenda
function volverDeAgendaACobro(){
  (agVolver||(()=>goTo('hub')))();
  renderRegistro();
  openModal('modal-registro');
}
function agNavDia(delta){ const d=new Date(agState.fecha+'T00:00:00'); d.setDate(d.getDate()+delta); agState.fecha=ymdLocal(d); renderAgenda(); }
function agHoy(){ agState.fecha=hoyStr(); renderAgenda(); }

// Recordatorio de turno 24hs antes: cola manual (sin API de WhatsApp Business) con boton para mandar a mano
function turnosRecordatorioManana(){
  const manana=addDias(hoyStr(),1);
  return agendaSt.list.filter(a=>a.fecha===manana&&agEsActivo(a)&&!a.recordado).sort((a,b)=>a.hora.localeCompare(b.hora));
}
function abrirRecordatoriosManana(){
  const L=turnosRecordatorioManana(), manana=addDias(hoyStr(),1);
  document.getElementById('registro-content').innerHTML=cabeceraModal('📲 Recordatorios de mañana')+
    `<div style="font-size:12px;color:var(--muted2);margin:-6px 0 10px">Turnos agendados para ${fechaCortaStr(manana)}. Mandale un WhatsApp para confirmar y bajar los que no vienen.</div>`+
    (L.length?L.map(a=>{
      const c=clienteDe(a.clienteId);
      const nombre=c?c.nombre:a.clienteNombre;
      const txt='Hola '+nombre.split(' ')[0]+'! Te recordamos tu turno mañana '+fechaCortaStr(manana)+' a las '+a.hora+'hs en Inda Studio 💈 ¿Todo bien para venir?';
      const wa=linkWhatsApp(c?c.tel:'',txt);
      return `<div class="card" style="margin-bottom:8px">
        <div style="font-size:13.5px;font-weight:800">${escH(nombre)}</div>
        <div style="font-size:11.5px;color:var(--muted2);margin:2px 0">${a.hora}hs · ${escH((a.servicios[0]||{}).nombre||'')} · ${escH(a.profNombre||'')}</div>
        <div style="display:flex;gap:8px;margin-top:6px">${wa?`<a href="${wa}" target="_blank" rel="noopener" class="btn btn-primary" style="flex:1;text-align:center;text-decoration:none;padding:9px">📲 WhatsApp</a>`:'<span style="font-size:11px;color:var(--muted);flex:1">Sin teléfono cargado</span>'}<button class="btn btn-ghost" onclick="marcarRecordatorioHecho('${a.id}')">✓ Ya avisé</button></div>
      </div>`;
    }).join(''):'<div class="empty"><div class="e-icon">📲</div><p>No hay recordatorios pendientes.</p></div>');
  openModal('modal-registro');
}
async function marcarRecordatorioHecho(id){
  // Mandar el recordatorio de 24hs pasa el turno a "esperando respuesta" (rojo suave) -- asi la Agenda ya
  // refleja que se le escribio y se esta esperando que confirme (pedido de Ivo, 28/09/2026).
  await agendaSt.cambiar(l=>{ const a=l.find(x=>x.id===id); if(a){ a.recordado=true; if(a.estado==='agendado'||!a.estado) a.estado='esperando'; a.upd=new Date().toISOString(); } });
  abrirRecordatoriosManana();
}
// ---------- Bloquear horarios en la propia agenda (pedido de Ivo, 28/09/2026) ----------
// Puntual (una fecha especifica) o recurrente (un dia de la semana, todas las semanas hasta que lo saquen a
// mano -- "bien personalizable", sin fecha de fin: mas simple y es lo que confirmo Ivo que alcanza).
function agBloqueosDeHoy(profId,fecha){
  const dia=new Date(fecha+'T00:00:00').getDay();
  return bloqueosAgendaSt.list.filter(b=>b.profId===profId&&(b.tipo==='puntual'?b.fecha===fecha:b.diaSemana===dia));
}
let bqSel=null;
function agAbrirBloqueo(){
  if(profile.role!=='profesional') return;
  bqSel={tipo:'puntual',fecha:agState.fecha,diaSemana:new Date(agState.fecha+'T00:00:00').getDay(),horaDesde:'09:00',horaHasta:'10:00',nota:''};
  renderBloqueoForm();
  openModal('modal-registro');
}
function renderBloqueoForm(){
  const s=bqSel; if(!s) return;
  const color=(profile&&profile.color)||'#4A136B';
  const mios=bloqueosAgendaSt.list.filter(b=>b.profId===profile.id).sort((a,b)=>(a.tipo==='recurrente'?a.diaSemana:9)-(b.tipo==='recurrente'?b.diaSemana:9));
  document.getElementById('registro-content').innerHTML=cabeceraModal('🚫 Bloquear horario')+`
    <div class="field"><label>¿Cómo se repite?</label><div style="display:flex;gap:6px">
      <button type="button" onclick="bqSel.tipo='puntual';renderBloqueoForm()" style="${pillStyle(s.tipo==='puntual',color)}">Puntual</button>
      <button type="button" onclick="bqSel.tipo='recurrente';renderBloqueoForm()" style="${pillStyle(s.tipo==='recurrente',color)}">Recurrente</button>
    </div></div>
    ${s.tipo==='puntual'
      ?`<div class="field"><label>Fecha</label><input type="date" value="${s.fecha}" onchange="bqSel.fecha=this.value"/></div>`
      :`<div class="field"><label>Día de la semana</label><div style="display:flex;flex-wrap:wrap;gap:6px">${DIAS_NOM.map((d,i)=>`<button type="button" onclick="bqSel.diaSemana=${i};renderBloqueoForm()" style="${pillStyle(s.diaSemana===i,color)}">${d}</button>`).join('')}</div><div style="font-size:11px;color:var(--muted2);margin-top:4px">Se repite todas las semanas, hasta que lo saques de la lista de abajo.</div></div>`}
    <div style="display:flex;gap:8px"><div class="field" style="flex:1"><label>Desde</label><input type="time" value="${s.horaDesde}" onchange="bqSel.horaDesde=this.value"/></div><div class="field" style="flex:1"><label>Hasta</label><input type="time" value="${s.horaHasta}" onchange="bqSel.horaHasta=this.value"/></div></div>
    <div class="field"><label>Motivo (opcional)</label><input type="text" value="${escH(s.nota)}" oninput="bqSel.nota=this.value" placeholder="Ej: turno médico"/></div>
    <button class="btn btn-primary" style="background:${color};margin-top:6px" onclick="bqGuardar()">Bloquear</button>
    ${mios.length?`<div style="margin-top:18px"><div style="font-size:11px;font-weight:800;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px">Tus bloqueos</div>
      ${mios.map(b=>`<div class="card" style="margin-bottom:6px;display:flex;justify-content:space-between;align-items:center;gap:8px">
        <div style="font-size:12.5px">${b.tipo==='recurrente'?'🔁 Todos los '+DIAS_NOM[b.diaSemana]+'s':'📅 '+fechaCortaStr(b.fecha)} · ${b.horaDesde} a ${b.horaHasta}${b.nota?' · '+escH(b.nota):''}</div>
        <button class="lnk" style="color:#f472b6;flex-shrink:0" onclick="bqEliminar('${b.id}')">Sacar</button>
      </div>`).join('')}</div>`:''}`;
}
async function bqGuardar(){
  const s=bqSel; if(!s) return;
  if(!s.horaDesde||!s.horaHasta||s.horaDesde>=s.horaHasta){ showToast('Revisá el rango de horario'); return; }
  const ahora=new Date().toISOString();
  await bloqueosAgendaSt.cambiar(l=>{ l.push({id:'bq'+Date.now().toString(36),profId:profile.id,sucursal:agState.sucursal,tipo:s.tipo,fecha:s.tipo==='puntual'?s.fecha:null,diaSemana:s.tipo==='recurrente'?s.diaSemana:null,horaDesde:s.horaDesde,horaHasta:s.horaHasta,nota:s.nota||'',creadoEn:ahora,upd:ahora}); });
  showToast('Bloqueado ✓');
  renderBloqueoForm();
  renderAgenda();
}
async function bqEliminar(id){
  await bloqueosAgendaSt.cambiar(l=>{ const i=l.findIndex(x=>x.id===id); if(i>=0) l.splice(i,1); });
  renderBloqueoForm();
  renderAgenda();
}
function renderAgenda(){
  const ss = profile.role==='admin' ? sucursales : (sucursalesDe(profile).length?sucursales.filter(x=>sucursalesDe(profile).includes(x.id)):sucursales);
  if(!ss.some(x=>x.id===agState.sucursal)) agState.sucursal = (ss[0]&&ss[0].id)||agState.sucursal;
  const tb=document.getElementById('ag-toolbar');
  const d=new Date(agState.fecha+'T00:00:00');
  const diaTxt=d.toLocaleDateString('es-AR',{weekday:'short',day:'numeric',month:'short'});
  const nRec=turnosRecordatorioManana().length;
  tb.innerHTML=`
    ${agPendingReagendo?`<div style="background:rgba(74,19,107,.14);border:1.5px solid rgba(74,19,107,.5);border-radius:12px;padding:10px 12px;font-size:12.5px;font-weight:700;color:var(--accent2)">📅 Elegí cuándo vuelve ${escH(agPendingReagendo.clienteNombre)} — tocá un horario de ${escH(agPendingReagendo.profNombre)}</div>`:''}
    ${(!agPendingReagendo&&nRec)?`<div class="card" style="margin:0;padding:10px 12px;cursor:pointer;border-color:rgba(96,165,250,.4)" onclick="abrirRecordatoriosManana()"><div style="display:flex;justify-content:space-between;align-items:center"><span style="font-size:12.5px;font-weight:800">📲 ${nRec} recordatorio${nRec===1?'':'s'} de mañana</span><span style="font-size:11px;color:var(--muted2)">enviar ›</span></div></div>`:''}
    <div style="display:flex;align-items:center;gap:8px">
      ${(ss.length>1&&!agProfFiltro)?`<select onchange="agState.sucursal=this.value;agGrid()" style="background:var(--s2);border:1.5px solid var(--border2);border-radius:10px;padding:8px 10px;color:var(--text);font-family:var(--font);font-size:12.5px;font-weight:700">${ss.map(x=>`<option value="${x.id}" ${x.id===agState.sucursal?'selected':''}>${escH(x.nombre)}</option>`).join('')}</select>`:''}
      ${agPendingReagendo?'':`<div style="display:flex;gap:8px;margin-left:auto">${profile.role==='profesional'?`<button class="btn btn-ghost" style="width:auto;padding:8px 14px;font-size:12px" onclick="agAbrirBloqueo()">🚫 Bloquear</button>`:''}<button class="btn btn-primary" style="width:auto;padding:8px 14px;font-size:12px" onclick="agAbrirSlot(null,${AG_INICIO+4*AG_PASO})">+ Turno</button></div>`}
    </div>
    <div style="display:flex;align-items:center;justify-content:center;gap:6px">
      <button onclick="agNavDia(-1)" style="background:var(--s2);border:1.5px solid var(--border2);border-radius:10px;width:30px;height:30px;color:var(--text);cursor:pointer">‹</button>
      <span style="font-size:12.5px;font-weight:800;text-transform:capitalize;min-width:90px;text-align:center">${diaTxt}</span>
      <button onclick="agNavDia(1)" style="background:var(--s2);border:1.5px solid var(--border2);border-radius:10px;width:30px;height:30px;color:var(--text);cursor:pointer">›</button>
      <button class="lnk" onclick="agHoy()">Hoy</button>
    </div>`;
  agGrid();
}
function agGrid(){
  const wrap=document.getElementById('ag-grid'); if(!wrap) return;
  // El rol profesional ve SOLO su propia columna, siempre -- sin importar agProfFiltro (ese es para el sub-flujo
  // temporal de reagendo desde un cobro, no lo pisamos). Recepcion/admin siguen viendo la grilla completa de
  // siempre, con el filtro de reagendo si corresponde (pedido de Ivo, 28/09/2026).
  const soyProfesional=profile.role==='profesional';
  // esProf(), no u.role==='profesional' a secas: un admin con "también trabajo como profesional" (ej. Ivo) nunca
  // aparecía como columna acá, ni en modo admin (viendo todas) ni se le ofrecía a nadie agendarle un turno — su
  // propia Agenda quedaba invisible. Bug reportado por Ivo (1/10/2026).
  const profs=allUsers.filter(u=>esProf(u)&&sucursalesDe(u).includes(agState.sucursal)&&(soyProfesional?u.id===profile.id:(!agProfFiltro||u.id===agProfFiltro)));
  if(!profs.length){ wrap.innerHTML='<div style="padding:24px 16px;text-align:center;color:var(--muted);font-size:13px">No hay profesionales asignados a esta sucursal.</div>'; return; }
  const slots=agSlots(), rowH=32;
  const turnos=agendaSt.list.filter(a=>a.fecha===agState.fecha&&a.sucursal===agState.sucursal&&agEstado(a)!=='cancelado');
  const colorEst=(a)=>{ const e=agEstado(a); if(e==='hecho') return AG_ESTADO_COLOR.hecho; if(a.paqueteId) return '#4A136B'; return AG_ESTADO_COLOR[e]||AG_ESTADO_COLOR.agendado; };
  const labelCol=`<div style="width:40px;flex-shrink:0">${slots.map(m=>`<div style="height:${rowH}px;font-size:9.5px;color:var(--muted2);text-align:right;padding-right:4px;box-sizing:border-box;border-top:1px solid var(--border)">${m%60===0?agHM(m):''}</div>`).join('')}</div>`;
  const cols=profs.map(p=>{
    const mios=turnos.filter(a=>a.profId===p.id);
    const bg=slots.map(m=>`<div onclick="agAbrirSlot('${p.id}',${m})" style="height:${rowH}px;border-top:1px solid var(--border);border-left:1px solid var(--border);cursor:pointer;box-sizing:border-box"></div>`).join('');
    const blocks=mios.map(a=>{
      const startIdx=Math.round((agMin(a.hora)-AG_INICIO)/AG_PASO);
      if(startIdx<0||startIdx>=slots.length) return '';
      const h=Math.max(1,Math.ceil((a.duracion||30)/AG_PASO))*rowH-2;
      return `<div onclick="event.stopPropagation();agAbrirDetalle('${a.id}')" style="position:absolute;left:2px;right:2px;top:${startIdx*rowH}px;height:${h}px;background:${colorEst(a)};border-radius:6px;padding:3px 5px;overflow:hidden;cursor:pointer;color:#fff">
        ${a.origenWeb?'<div style="position:absolute;top:2px;right:3px;font-size:10px">🌐</div>':''}
        <div style="font-size:10.5px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding-right:${a.origenWeb?'12px':'0'}">${escH(a.clienteNombre)}</div>
        <div style="font-size:9px;font-weight:600;opacity:.9;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escH((a.servicios[0]||{}).nombre||'')}${a.paqueteId?' 🎁':''}</div>
      </div>`;
    }).join('');
    // Alguien reservando por la Reserva pública ahora mismo: se marca gris rayado para que nadie le pise el horario
    // mientras el cliente termina de confirmar (pedido de Ivo, 27/09/2026).
    const holds=holdsSt.list.filter(h=>h.profId===p.id&&h.fecha===agState.fecha&&numV(h.expira)>Date.now());
    const holdBlocks=holds.map(h=>{
      const startIdx=Math.round((agMin(h.hora)-AG_INICIO)/AG_PASO);
      if(startIdx<0||startIdx>=slots.length) return '';
      const dur=(h.servicioIds&&h.servicioIds.length)?duracionServicios(h.servicioIds):AG_PASO;
      const hgt=Math.max(1,Math.ceil(dur/AG_PASO))*rowH-2;
      const label=h.estado==='pendiente'?'🌐 '+escH(h.clienteNombre):'🌐 Reservando…';
      return `<div style="position:absolute;left:2px;right:2px;top:${startIdx*rowH}px;height:${hgt}px;background:repeating-linear-gradient(45deg,var(--s3),var(--s3) 6px,var(--s2) 6px,var(--s2) 12px);border:1.5px dashed var(--muted2);border-radius:6px;padding:3px 5px;overflow:hidden;color:var(--muted2);pointer-events:none">
        <div style="font-size:9.5px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${label}</div>
      </div>`;
    }).join('');
    const bloqueoBlocks=agBloqueosDeHoy(p.id,agState.fecha).map(b=>{
      const startIdx=Math.max(0,Math.round((agMin(b.horaDesde)-AG_INICIO)/AG_PASO));
      const endIdx=Math.min(slots.length,Math.round((agMin(b.horaHasta)-AG_INICIO)/AG_PASO));
      if(endIdx<=startIdx) return '';
      return `<div onclick="event.stopPropagation();agAbrirBloqueo()" style="position:absolute;left:2px;right:2px;top:${startIdx*rowH}px;height:${(endIdx-startIdx)*rowH-2}px;background:repeating-linear-gradient(45deg,rgba(244,114,182,.14),rgba(244,114,182,.14) 6px,rgba(244,114,182,.05) 6px,rgba(244,114,182,.05) 12px);border:1.5px dashed #f472b6;border-radius:6px;padding:3px 5px;overflow:hidden;color:#f472b6;cursor:pointer">
        <div style="font-size:9.5px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">🚫 ${escH(b.nota||'Bloqueado')}</div>
      </div>`;
    }).join('');
    return `<div style="flex:1;min-width:0;position:relative">${bg}${blocks}${holdBlocks}${bloqueoBlocks}</div>`;
  }).join('');
  const header=`<div style="display:flex;position:sticky;top:0;background:var(--bg);z-index:2;border-bottom:1.5px solid var(--border2)">
    <div style="width:40px;flex-shrink:0"></div>
    ${profs.map(p=>`<div style="flex:1;min-width:0;padding:8px 4px;text-align:center;font-size:11px;font-weight:800;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escH(p.name)}</div>`).join('')}
  </div>`;
  wrap.innerHTML=header+`<div style="display:flex">${labelCol}${cols}</div>`;
}

function agAbrirSlot(profId,minutos){
  if(agPendingReagendo){ agCrearReagendo(profId||agPendingReagendo.profId,minutos); return; }
  // Un profesional cargando un turno en su propia agenda no tiene sentido que elija "para quien es" -- siempre es
  // el mismo (pedido de Ivo, 28/09/2026: cargar un turno el mismo cuando un cliente le avisa directo).
  if(!profId&&profile.role==='profesional') profId=profile.id;
  const prof=allUsers.find(u=>u.id===profId);
  agSel={
    editId:null, profId:profId||null, profNombre:prof?prof.name:'',
    fecha:agState.fecha, hora:agHM(minutos), duracion:30,
    clienteId:agPendingPaquete?agPendingPaquete.clienteId:null,
    clienteNombre:agPendingPaquete?agPendingPaquete.clienteNombre:'',
    servicios:agPendingPaquete?[agPendingPaquete.svcId]:[],
    rubroAbierto:null, nota:'',
    paqueteId:agPendingPaquete?agPendingPaquete.paqueteId:null,
    itemId:agPendingPaquete?agPendingPaquete.itemId:null,
    repite:false, repiteTipo:'semanal', repiteVeces:4,
  };
  renderAgForm();
  openModal('modal-registro');
}
// Al tocar un horario viniendo de "¿Cuándo vuelve?" en un cobro: ya se sabe cliente y servicios, se agenda directo sin pasar por el formulario
async function agCrearReagendo(profId,minutos){
  const ctx=agPendingReagendo; if(!ctx) return;
  const prof=allUsers.find(u=>u.id===profId)||{id:profId,name:ctx.profNombre};
  const ahora=new Date().toISOString(), hora=agHM(minutos);
  await agendaSt.cambiar(l=>{ l.push({id:'ag'+Date.now().toString(36),sucursal:agState.sucursal,fecha:agState.fecha,hora,duracion:30,
    profId:prof.id,profNombre:prof.name,clienteId:ctx.clienteId,clienteNombre:ctx.clienteNombre,servicios:ctx.servicios,
    nota:'Reagendado',paqueteId:null,itemId:null,estado:'agendado',creadoPorId:profile.id,creadoPorNombre:profile.name,creadoEn:ahora,upd:ahora}); });
  cobro.reagFecha=agState.fecha; cobro.reagHora=hora;
  showToast('Turno reagendado para '+fechaCortaStr(agState.fecha)+' · '+hora+'hs ✓');
  agPendingReagendo=null; agProfFiltro=null;
  volverDeAgendaACobro();
}
function agReagendar(id){
  const a=agendaSt.list.find(x=>x.id===id); if(!a) return;
  agSel={editId:a.id, profId:a.profId, profNombre:a.profNombre, fecha:a.fecha, hora:a.hora, duracion:a.duracion||30,
    clienteId:a.clienteId, clienteNombre:a.clienteNombre, servicios:(a.servicios||[]).map(s=>s.svcId),
    rubroAbierto:null, nota:a.nota||'', paqueteId:a.paqueteId||null, itemId:a.itemId||null};
  renderAgForm();
}
// Un profesional puede reagendar/cancelar turnos que armó él mismo desde su propia agenda, pero no los que le
// cargó recepción -- eso lo sigue resolviendo recepción (pedido de Ivo, 28/09/2026). Admin/recepción sin cambios.
function agPuedeGestionar(a){ return profile.role!=='profesional'||a.creadoPorId===profile.id; }
function agAbrirDetalle(id){
  const a=agendaSt.list.find(x=>x.id===id); if(!a) return;
  const est=agEstado(a);
  const c=clienteDe(a.clienteId);
  const precio=(a.servicios||[]).reduce((s,sv)=>{ const full=servicios.find(x=>x.id===sv.svcId); return s+(full?numV(full.precio):0); },0);
  const wa=c&&c.tel?linkWhatsApp(c.tel,'Hola '+a.clienteNombre.split(' ')[0]+'!'):'';
  const gestiona=agPuedeGestionar(a);
  const cont=document.getElementById('registro-content');
  cont.innerHTML=`<div style="display:flex;align-items:center;gap:8px;margin-bottom:12px"><div class="modal-title" style="margin:0">${escH(a.clienteNombre)}${a.clienteId?` <button class="lnk" style="font-size:12px" onclick="closeModal('modal-registro');abrirClienteDetalle('${a.clienteId}')">↗</button>`:''}</div><button onclick="closeModal('modal-registro')" style="margin-left:auto;background:var(--s3);border:none;color:var(--muted2);font-size:18px;width:32px;height:32px;border-radius:50%;cursor:pointer">×</button></div>
    <div class="card" style="margin-bottom:12px">
      ${(a.servicios||[]).map(s=>`<div style="font-size:14px;font-weight:700;padding:2px 0">${escH(s.nombre)}</div>`).join('')||'<div style="font-size:12px;color:var(--muted)">Sin servicios cargados</div>'}
      ${precio>0?`<div style="font-size:13px;color:var(--muted2);margin-top:2px">${fp(precio)}</div>`:''}
      <div style="font-size:12.5px;color:var(--muted2);margin-top:6px">${fechaCortaStr(a.fecha)} · ${a.hora}hs${a.serieId?' · <span style="color:#60a5fa">🔁 turno fijo</span>':''}</div>
      <div style="font-size:12.5px;color:var(--muted2);margin-top:2px">🔒 Se atenderá con: <b style="color:var(--text)">${escH(a.profNombre)}</b></div>
      ${c&&c.tel?`<div style="display:flex;align-items:center;gap:8px;margin-top:8px;font-size:12.5px"><span>📱 ${escH(c.tel)}</span>${wa?`<a href="${wa}" target="_blank" rel="noopener" class="btn btn-ghost" style="padding:4px 10px;font-size:11.5px;text-decoration:none">💬 Hablar por WhatsApp</a>`:''}</div>`:''}
      ${c&&c.email?`<div style="font-size:12.5px;color:var(--muted2);margin-top:4px">✉️ ${escH(c.email)}</div>`:''}
      ${a.nota?`<div style="font-size:11.5px;color:var(--muted2);margin-top:6px">📝 ${escH(a.nota)}</div>`:''}
    </div>
    ${a.paqueteId?`<div style="font-size:11.5px;color:#4A136B;margin-bottom:10px">🎁 Viene de un paquete ya pagado — se marca hecho solo cuando se le cobra ese servicio.</div>`
      :`<div style="margin-bottom:14px"><div style="font-size:11px;font-weight:800;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px">${escH(AG_ESTADO_LABEL[est]||'')}</div>
        <div style="display:flex;gap:8px">${Object.keys(AG_ESTADO_COLOR).map(k=>`<button onclick="agCambiarEstado('${a.id}','${k}')" title="${escH(AG_ESTADO_LABEL[k])}" style="width:30px;height:30px;border-radius:50%;border:${est===k?'2.5px solid var(--text)':'1.5px solid var(--border2)'};background:${AG_ESTADO_COLOR[k]};cursor:pointer;padding:0"></button>`).join('')}</div></div>`}
    ${est==='cancelado'?'<div style="font-size:12.5px;color:#f472b6;font-weight:700;margin-bottom:10px">🗑️ Cancelado</div>':''}
    <div style="display:flex;gap:8px;flex-wrap:wrap">
      <button class="btn btn-primary" style="flex:1;min-width:120px" onclick="agAbrirCobroDesdeTurno('${a.id}')">$ Pagar</button>
      ${a.clienteId?`<button class="btn btn-ghost" style="flex:1;min-width:120px" onclick="closeModal('modal-registro');abrirClienteDetalle('${a.clienteId}')">📋 Ficha</button>`:''}
    </div>
    ${(gestiona&&est!=='cancelado')?`<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">
      <button class="btn btn-ghost" style="flex:1;min-width:120px" onclick="agReagendar('${a.id}')">✏️ Reagendar</button>
      <button class="btn btn-ghost" style="flex:1;min-width:120px;color:#f472b6" onclick="agCancelar('${a.id}')">🗑️ Cancelar turno</button>
    </div>`:''}`;
  openModal('modal-registro');
}
function renderAgForm(){
  const s=agSel; if(!s) return;
  const color=(profile&&profile.color)||'#4A136B';
  // Mostrar solo los servicios del profesional elegido (sus rubros asignados en Admin → Equipo → Cuentas →
  // Rubros) -- antes se mostraban TODOS los rubros/servicios sin importar quién atiende. Si todavía no se
  // eligió profesional (recepción/admin recién abriendo el form), se muestran todos hasta que elijan a alguien.
  // Pedido de Ivo (2/10/2026).
  const profParaFiltro=s.profId?allUsers.find(u=>u.id===s.profId):null;
  const rbFiltro=profParaFiltro?rubrosDeUsuario(profParaFiltro):null;
  const serviciosForm=rbFiltro?servicios.filter(x=>visiblePorRubro(x,rbFiltro)):servicios;
  const grupos={}; serviciosForm.forEach(x=>{ (grupos[x.rubro||'']=grupos[x.rubro||'']||[]).push(x); });
  const rids=Object.keys(grupos);
  const pill=(x)=>`<button onclick="agToggleServicio('${x.id}')" style="${pillStyle(s.servicios.includes(x.id),color)}">${escH(x.nombre)}</button>`;
  const serviciosHtml=rids.length<=1
    ?`<div style="display:flex;flex-wrap:wrap;gap:6px">${(grupos[rids[0]]||[]).map(pill).join('')}</div>`
    :`<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px">${rids.map(rid=>{ const n=grupos[rid].filter(x=>s.servicios.includes(x.id)).length; return `<button type="button" onclick="agAbrirRubro('${rid}')" style="${pillStyle(s.rubroAbierto===rid,color)}">${escH(nombreRubro(rid)||'Otros')}${n?' ('+n+')':''}</button>`; }).join('')}</div>`
      +(s.rubroAbierto&&grupos[s.rubroAbierto]?`<div style="display:flex;flex-wrap:wrap;gap:6px">${grupos[s.rubroAbierto].map(pill).join('')}</div>`:'<div style="font-size:11.5px;color:var(--muted2)">Tocá un rubro para ver sus servicios.</div>');
  const profs=allUsers.filter(u=>esProf(u)&&sucursalesDe(u).includes(agState.sucursal));
  const cont=document.getElementById('registro-content');
  const box=document.querySelector('#modal-registro .modal-box'); const st=box?box.scrollTop:0;
  cont.innerHTML=`<div style="display:flex;align-items:center;gap:8px;margin-bottom:16px"><div class="modal-title" style="margin:0">${s.editId?'Reagendar':'Agendar turno'} 📅</div><button onclick="agPendingPaquete=null;closeModal('modal-registro')" style="margin-left:auto;background:var(--s3);border:none;color:var(--muted2);font-size:18px;width:32px;height:32px;border-radius:50%;cursor:pointer">×</button></div>
    ${s.paqueteId?`<div style="font-size:11.5px;color:#34d399;margin-bottom:10px">🎁 Coordinando un servicio de un paquete ya pagado</div>`:''}
    <div class="field"><label>¿Para qué cliente?</label><input id="ag-cli" type="text" autocomplete="off" placeholder="Buscá por nombre..." value="${escH(s.clienteNombre)}" oninput="agClienteInput(this.value)" ${s.paqueteId?'readonly':''}/><div id="ag-cli-sug"></div></div>
    ${profile.role==='profesional'?'':`<div class="field"><label>Profesional</label><div style="display:flex;flex-wrap:wrap;gap:6px">${profs.map(p=>`<button type="button" onclick="agElegirProf('${p.id}')" style="${pillStyle(s.profId===p.id,color)}">${escH(p.name)}</button>`).join('')||'<div style="font-size:12px;color:var(--muted)">No hay profesionales en esta sucursal.</div>'}</div></div>`}
    <div style="display:flex;gap:8px"><div class="field" style="flex:1"><label>Fecha</label><input type="date" value="${s.fecha}" onchange="agSel.fecha=this.value"/></div><div class="field" style="flex:1"><label>Hora</label><input type="time" value="${s.hora}" onchange="agSel.hora=this.value"/></div></div>
    <div class="field"><label>¿Qué le va a hacer?</label>${serviciosHtml}</div>
    <div class="field"><label>Duración (minutos)</label><input type="number" inputmode="numeric" value="${s.duracion}" onchange="agSel.duracion=parseInt(this.value)||30"/></div>
    <div class="field"><label>Nota (opcional)</label><input type="text" value="${escH(s.nota)}" oninput="agSel.nota=this.value" placeholder="Ej: viene con su hijo"/></div>
    ${(!s.editId&&!s.paqueteId)?`<label class="rub-opt" style="margin-top:4px"><input type="checkbox" ${s.repite?'checked':''} onchange="agSel.repite=this.checked;renderAgForm()"/> 🔁 Repetir (turno fijo)</label>
    ${s.repite?`<div style="margin:6px 0 4px">
        <div style="font-size:12.5px;color:var(--muted2);margin-bottom:4px">Cada</div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px">${[['semanal','Semana'],['quincenal','2 semanas'],['mensual','Mes']].map(([v,l])=>`<button type="button" onclick="agSel.repiteTipo='${v}';renderAgForm()" style="${pillStyle(s.repiteTipo===v,color)}">${l}</button>`).join('')}</div>
        <div style="display:flex;gap:8px;align-items:center"><span style="font-size:12.5px;color:var(--muted2)">Durante</span><input type="number" min="2" max="26" value="${s.repiteVeces}" oninput="agSel.repiteVeces=Math.min(26,Math.max(2,parseInt(this.value)||2))" style="width:60px;text-align:center"/><span style="font-size:12.5px;color:var(--muted2)">veces (tope 26)</span></div>
        <div style="font-size:11px;color:var(--muted2);margin-top:6px">Se cargan todos de una, validando horario, choques y bloqueos de ${escH(s.profNombre||'el profesional')} — lo que no entre, se avisa cuál quedó afuera y por qué, no se pisa nada en silencio.</div>
      </div>`:''}`:''}
    <button class="btn btn-primary" style="background:${color};margin-top:6px" onclick="agGuardar()">${s.editId?'Guardar cambios':(s.repite?'Agendar todos':'Agendar')}</button>`;
  if(box) box.scrollTop=st;
  agRenderSugerencias();
}
function agClienteInput(v){ agSel.clienteNombre=v; const c=clienteDe(agSel.clienteId); if(c&&c.nombre!==v) agSel.clienteId=null; agRenderSugerencias(); }
function agElegirCliente(id){ const c=clienteDe(id); if(!c) return; agSel.clienteId=c.id; agSel.clienteNombre=c.nombre; const i=document.getElementById('ag-cli'); if(i) i.value=c.nombre; agRenderSugerencias(); avisoSiProblema(c); }
function agQuitarCliente(){ agSel.clienteId=null; agSel.clienteNombre=''; const i=document.getElementById('ag-cli'); if(i){ i.value=''; i.focus(); } agRenderSugerencias(); }
function agRenderSugerencias(){
  const el=document.getElementById('ag-cli-sug'); if(!el) return;
  const sel=clienteDe(agSel.clienteId);
  if(sel){ el.innerHTML=`<div style="font-size:12px;color:#34d399;font-weight:700;margin-top:6px;display:flex;gap:6px;align-items:center">✓ ${escH(idCorto(sel))||'Cliente elegido'} <button class="lnk" onclick="agQuitarCliente()">cambiar</button></div>`; return; }
  const q=(agSel.clienteNombre||'').trim();
  if(q.length<2){ el.innerHTML=''; return; }
  const m=buscarClientes(q).slice(0,5);
  el.innerHTML=`<div style="display:flex;flex-direction:column;gap:4px;margin-top:6px">${m.map(c=>`<button onclick="agElegirCliente('${c.id}')" style="text-align:left;padding:9px 12px;border-radius:10px;border:1.5px solid var(--border2);background:var(--s2);color:var(--text);font-family:var(--font);font-size:13px;font-weight:600;cursor:pointer">${escH(c.nombre)}<div style="font-size:11px;color:var(--muted2);font-weight:500">${escH(idCorto(c))}</div></button>`).join('')}
    ${m.length?'':'<div style="font-size:11.5px;color:var(--muted2);padding:6px 2px">No encontramos a nadie. Cargalo primero desde Clientes.</div>'}</div>`;
}
function agElegirProf(id){ const p=allUsers.find(u=>u.id===id); agSel.profId=id; agSel.profNombre=p?p.name:''; renderAgForm(); }
function agToggleServicio(id){
  const i=agSel.servicios.indexOf(id);
  if(i>=0) agSel.servicios.splice(i,1); else agSel.servicios.push(id);
  const dur=duracionServicios(agSel.servicios);
  if(dur>0) agSel.duracion=dur;
  renderAgForm();
}
function agAbrirRubro(rid){ agSel.rubroAbierto=agSel.rubroAbierto===rid?null:rid; renderAgForm(); }
// Mismo dia-del-mes, n meses despues (Date normaliza los desbordes: el 31 de un mes corto cae unos dias
// despues en el mes siguiente -- aceptable, caso borde raro para un turno de peluqueria/barberia).
function addMeses(s,n){ const [y,m,d]=s.split('-').map(Number); return new Date(Date.UTC(y,m-1+n,d)).toISOString().split('T')[0]; }
// Por que NO se puede agendar esta fecha/hora para este profesional, o null si esta libre.
// Usada para validar cada ocurrencia de un turno recurrente antes de crearla (no pisa nada en silencio).
function agMotivoNoDisponible(profId,fecha,hora,duracion,turnosExistentes){
  if(turnosExistentes.some(a=>a.profId===profId&&a.fecha===fecha&&a.hora===hora&&a.estado!=='cancelado')) return 'ya tiene un turno a esa hora';
  const desdeMin=agMin(hora), hastaMin=desdeMin+(duracion||30);
  if(!profTrabajaEn(profId,fecha,desdeMin,hastaMin)) return 'no trabaja ese día/horario';
  if(agBloqueosDeHoy(profId,fecha).some(b=>desdeMin<agMin(b.horaHasta)&&hastaMin>agMin(b.horaDesde))) return 'tiene un bloqueo ese horario';
  return null;
}
async function agGuardar(){
  const s=agSel; if(!s) return;
  if(!s.clienteId){ showToast('Elegí un cliente'); return; }
  if(!s.profId){ showToast('Elegí quién lo va a atender'); return; }
  if(!s.servicios.length){ showToast('Elegí al menos un servicio'); return; }
  if(!s.fecha||!s.hora){ showToast('Falta la fecha o la hora'); return; }
  const svcObjs=s.servicios.map(id=>servicios.find(x=>x.id===id)).filter(Boolean).map(x=>({svcId:x.id,nombre:x.nombre}));
  const ahora=new Date().toISOString();
  if(s.editId){
    await agendaSt.cambiar(l=>{ const a=l.find(x=>x.id===s.editId); if(a){ Object.assign(a,{profId:s.profId,profNombre:s.profNombre,fecha:s.fecha,hora:s.hora,duracion:s.duracion||30,clienteId:s.clienteId,clienteNombre:s.clienteNombre,servicios:svcObjs,nota:s.nota||''}); a.upd=ahora; } });
  } else if(s.repite&&s.repiteVeces>1){
    // Turno recurrente: crea todas las ocurrencias de una, validando cada fecha contra turnos ya agendados,
    // bloqueos y horario laboral real del profesional (ver agMotivoNoDisponible). Pedido de Ivo (2/10/2026).
    const paso=s.repiteTipo==='quincenal'?2:1;
    const fechas=[]; for(let i=0;i<s.repiteVeces;i++) fechas.push(s.repiteTipo==='mensual'?addMeses(s.fecha,i):addDias(s.fecha,i*paso*7));
    const serieId='sr'+Date.now().toString(36);
    const excluidas=[];
    await agendaSt.cambiar(l=>{
      fechas.forEach((fecha,i)=>{
        const motivo=agMotivoNoDisponible(s.profId,fecha,s.hora,s.duracion,l);
        if(motivo){ excluidas.push({fecha,motivo}); return; }
        l.push({id:'ag'+Date.now().toString(36)+i,sucursal:agState.sucursal,fecha,hora:s.hora,duracion:s.duracion||30,profId:s.profId,profNombre:s.profNombre,clienteId:s.clienteId,clienteNombre:s.clienteNombre,servicios:svcObjs,nota:s.nota||'',paqueteId:null,itemId:null,estado:'agendado',serieId,creadoPorId:profile.id,creadoPorNombre:profile.name,creadoEn:ahora,upd:ahora});
      });
    });
    const creados=fechas.length-excluidas.length;
    agSel=null; closeModal('modal-registro');
    if(excluidas.length){
      await uiDialog({title:creados+' de '+fechas.length+' turnos agendados',msg:'No se pudieron agendar — '+excluidas.map(e=>fechaCortaStr(e.fecha)+' ('+e.motivo+')').join(', ')+'.',ok:'Entendido',soloOk:true});
    } else {
      showToast(creados+' turnos agendados ✓');
    }
    renderAgenda();
    return;
  } else {
    await agendaSt.cambiar(l=>{ l.push({id:'ag'+Date.now().toString(36),sucursal:agState.sucursal,fecha:s.fecha,hora:s.hora,duracion:s.duracion||30,profId:s.profId,profNombre:s.profNombre,clienteId:s.clienteId,clienteNombre:s.clienteNombre,servicios:svcObjs,nota:s.nota||'',paqueteId:s.paqueteId||null,itemId:s.itemId||null,estado:'agendado',creadoPorId:profile.id,creadoPorNombre:profile.name,creadoEn:ahora,upd:ahora}); });
  }
  if(s.paqueteId){
    await paquetesSt.cambiar(l=>{ const p=l.find(x=>x.id===s.paqueteId); const it=p&&p.items.find(x=>x.id===s.itemId); if(it){ it.coord={fecha:s.fecha,hora:s.hora,profId:s.profId,profNombre:s.profNombre}; p.upd=ahora; } });
  }
  agPendingPaquete=null; agSel=null;
  closeModal('modal-registro');
  showToast('Turno agendado ✓');
  renderAgenda();
}
// Atajo "$ Pagar" desde el detalle de un turno: abre el cobro de siempre con el cliente y los servicios ya
// precargados (el profesional/recepción igual revisa todo antes de cobrar, como siempre).
async function agAbrirCobroDesdeTurno(id){
  const a=agendaSt.list.find(x=>x.id===id); if(!a) return;
  closeModal('modal-registro');
  const ok=await abrirRegistroTurno(); if(!ok) return;
  cobro.clienteId=a.clienteId; cobro.cliente=a.clienteNombre;
  cobro.servicios=(a.servicios||[]).map(s=>s.svcId).filter(id=>servicios.some(x=>x.id===id));
  cobroAutoSenas(); // sin esto, una seña ya dejada para este cliente/profesional no se detectaba acá (solo al elegir
  // cliente a mano en el cobro de siempre) y se cobraba el turno completo sin descontarla — el cliente quedaba
  // pagando dos veces. Bug reportado por Ivo (1/10/2026).
  renderRegistro();
}
function agCancelar(id){
  const a=agendaSt.list.find(x=>x.id===id); if(!a) return;
  if(a.serieId){ agAbrirCancelarSerie(a); return; }
  agCancelarUno(id);
}
async function agCancelarUno(id){
  const a=agendaSt.list.find(x=>x.id===id); if(!a) return;
  const ok=await uiConfirm('¿Cancelar este turno?', escH(a.clienteNombre)+' · '+fechaCortaStr(a.fecha)+' '+a.hora+'hs');
  if(!ok) return;
  const ahora=new Date().toISOString();
  await agendaSt.cambiar(l=>{ const x=l.find(y=>y.id===id); if(x){ x.estado='cancelado'; x.upd=ahora; } });
  if(a.paqueteId){ await paquetesSt.cambiar(l=>{ const p=l.find(x=>x.id===a.paqueteId); const it=p&&p.items.find(x=>x.id===a.itemId); if(it){ it.coord=null; p.upd=ahora; } }); }
  showToast('Turno cancelado');
  renderAgenda();
  if(a.fecha>=hoyStr()) abrirWaitlist(a); else closeModal('modal-registro');
}
// Turno que es parte de una serie fija (repetir): preguntar que alcance tiene la cancelacion, en vez de
// cancelar directo -- pedido de Ivo (2/10/2026). Nunca toca los que ya se hicieron (estado 'hecho').
function agAbrirCancelarSerie(a){
  const cont=document.getElementById('registro-content');
  cont.innerHTML=cabeceraModal('🔁 Es un turno fijo')+
    `<div style="font-size:13px;color:var(--muted2);margin-bottom:14px">${escH(a.clienteNombre)} · ${fechaCortaStr(a.fecha)} ${a.hora}hs — es parte de una serie de turnos repetidos. ¿Qué querés cancelar?</div>
    <button class="btn btn-ghost" style="margin-bottom:8px" onclick="agCancelarUno('${a.id}')">Solo este turno</button>
    <button class="btn btn-ghost" style="margin-bottom:8px;color:#fbbf24" onclick="agCancelarSerieDesde('${a.serieId}','${a.fecha}')">Este y los que siguen</button>
    <button class="btn btn-ghost" style="color:#f472b6" onclick="agCancelarSerieCompleta('${a.serieId}')">Toda la serie</button>`;
}
async function agCancelarSerieDesde(serieId,desdeFecha){
  const ok=await uiConfirm('¿Cancelar este turno y los que siguen?','Se cancelan los turnos de esta serie desde '+fechaCortaStr(desdeFecha)+' en adelante (no toca los que ya se hicieron).');
  if(!ok) return;
  const ahora=new Date().toISOString(); let n=0;
  await agendaSt.cambiar(l=>{ l.filter(x=>x.serieId===serieId&&x.fecha>=desdeFecha&&x.estado!=='cancelado'&&x.estado!=='hecho').forEach(x=>{ x.estado='cancelado'; x.upd=ahora; n++; }); });
  showToast(n+' turno'+(n===1?'':'s')+' cancelado'+(n===1?'':'s')+' ✓');
  closeModal('modal-registro'); renderAgenda();
}
async function agCancelarSerieCompleta(serieId){
  const ok=await uiConfirm('¿Cancelar toda la serie?','Se cancelan todos los turnos pendientes de esta serie (no toca los que ya se hicieron).');
  if(!ok) return;
  const ahora=new Date().toISOString(); let n=0;
  await agendaSt.cambiar(l=>{ l.filter(x=>x.serieId===serieId&&x.estado!=='cancelado'&&x.estado!=='hecho').forEach(x=>{ x.estado='cancelado'; x.upd=ahora; n++; }); });
  showToast(n+' turno'+(n===1?'':'s')+' cancelado'+(n===1?'':'s')+' ✓');
  closeModal('modal-registro'); renderAgenda();
}
// Waitlist: al liberarse un horario (cancelacion), ofrecerlo a clientes en riesgo/perdidos del CRM con la oferta de la hora si corresponde
function agCandidatosWaitlist(a){
  const uv=ultimasVisitas();
  return clientesDir.filter(c=>c.tel&&!c.problematico).map(c=>({c,dias:uv[c.id]?diasDesdeStr(uv[c.id].fecha):null})).filter(x=>x.dias!=null&&x.dias>=16).sort((a,b)=>b.dias-a.dias).slice(0,5);
}
function agMensajeWaitlist(a,c){
  const rubroIds=(a.servicios||[]).map(s=>(servicios.find(x=>x.id===s.svcId)||{}).rubro).filter(Boolean);
  const ctx={dia:new Date(a.fecha+'T00:00:00').getDay(),hora:a.hora,sucursal:a.sucursal,cliente:null};
  let oferta=null;
  (promos.fijos||[]).filter(f=>reglaAplica(f,ctx)).forEach(f=>{ if(!rubroIds.some(rb=>rubroEn(f.rubro,rb))) return; if(!oferta||numV(f.pct)>numV(oferta.pct)) oferta=f; });
  const nombresSvc=(a.servicios||[]).map(s=>s.nombre).join(', ');
  let txt='Hola '+c.nombre.split(' ')[0]+'! Se liberó un horario con '+a.profNombre+' el '+fechaCortaStr(a.fecha)+' a las '+a.hora+'hs'+(nombresSvc?' para '+nombresSvc:'')+'. ¿Te sirve?';
  if(oferta) txt+=' Encima tiene '+oferta.pct+'% de descuento por caer en el horario de oferta 🎉';
  return txt;
}
function abrirWaitlist(a){
  const cands=agCandidatosWaitlist(a);
  document.getElementById('registro-content').innerHTML=cabeceraModal('📤 Avisar que se liberó un horario')+
    `<div style="font-size:12px;color:var(--muted2);margin:-6px 0 12px">${fechaCortaStr(a.fecha)} ${a.hora}hs con ${escH(a.profNombre)} — mandale un WhatsApp a alguien que hace tiempo no viene.</div>`+
    (cands.length?cands.map(({c,dias})=>{ const wa=linkWhatsApp(c.tel,agMensajeWaitlist(a,c)); return `<div class="card" style="margin-bottom:8px;display:flex;align-items:center;gap:12px"><div style="flex:1;min-width:0">${escH(c.nombre)}<div style="font-size:11px;color:var(--muted2);font-weight:400">hace ${dias} días</div></div>${wa?`<a href="${wa}" target="_blank" rel="noopener" style="padding:8px 12px;border-radius:10px;background:rgba(52,211,153,.15);color:#34d399;font-size:12px;font-weight:800;text-decoration:none">WhatsApp</a>`:''}</div>`; }).join(''):'<div style="font-size:13px;color:var(--muted)">No hay clientes inactivos con teléfono para ofrecerles.</div>')
    +'<button class="btn btn-ghost" style="width:100%;margin-top:10px" onclick="closeModal(\'modal-registro\')">Cerrar</button>';
  openModal('modal-registro');
}
// Franja en el Inicio del profesional: lo que tiene agendado y cuanto va a sumar de comision cuando lo haga (estimado)
function htmlProximosTurnosHub(){
  if(!profile||profile.role!=='profesional') return '';
  const hoy=hoyStr();
  const L=agendaSt.list.filter(a=>a.profId===profile.id&&a.fecha>=hoy&&agEsActivo(a)).sort((a,b)=>(a.fecha+a.hora).localeCompare(b.fecha+b.hora)).slice(0,5);
  if(!L.length) return '';
  return `<div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);margin:0 0 10px">📅 Tus próximos turnos</div>
    ${L.map(a=>{
      let com=0;
      if(a.paqueteId){ const p=paquetesSt.list.find(x=>x.id===a.paqueteId); const it=p&&p.items.find(x=>x.id===a.itemId); if(it) com=Math.round(numV(it.final)*comisionRubroEstim(it.rubro)/100); }
      else { com=(a.servicios||[]).reduce((s,sv)=>{ const full=servicios.find(x=>x.id===sv.svcId); return s+(full?Math.round(numV(full.precio)*comisionRubroEstim(full.rubro)/100):0); },0); }
      return `<div class="card" style="margin-bottom:8px;cursor:pointer" onclick="abrirAgenda('${a.sucursal}');agState.fecha='${a.fecha}';renderAgenda()">
        <div style="display:flex;justify-content:space-between;align-items:baseline"><b style="font-size:13px">${escH(a.clienteNombre)}</b><span style="font-size:11.5px;color:var(--muted2)">${fechaCortaStr(a.fecha)} · ${a.hora}hs</span></div>
        <div style="font-size:11.5px;color:var(--muted2);margin-top:2px">${escH((a.servicios[0]||{}).nombre||'')}${a.servicios.length>1?' +'+(a.servicios.length-1):''}${a.paqueteId?' · 🎁 ya pagado':''}</div>
        ${com>0?`<div style="font-size:11.5px;color:#34d399;font-weight:700;margin-top:3px">≈ ${fp(com)} de comisión cuando lo hagas</div>`:''}
      </div>`;
    }).join('')}`;
}

// ---------- membresia y paquetes de un cliente ----------
function membresiaActivaDe(cid){ return membresiasSt.list.filter(m=>m.clienteId===cid&&m.usos.length<m.creditos).sort((a,b)=>String(a.creadoEn).localeCompare(String(b.creadoEn)))[0]||null; }
function paquetesAbiertosDe(cid){ return paquetesSt.list.filter(p=>p.clienteId===cid&&p.items.some(i=>!i.usado)); }
function servicioMembresia(){
  const cfg=promos.membresia||{};
  let s=servicios.find(x=>x.id===cfg.servicioId);
  if(!s) s=servicios.filter(x=>rubroEn(cfg.rubro,x.rubro||'')&&/^corte$/i.test(x.nombre.trim()))[0]||servicios.filter(x=>rubroEn(cfg.rubro,x.rubro||'')&&/^corte/i.test(x.nombre.trim())).sort((a,b)=>a.precio-b.precio)[0];
  return s||null;
}
// El corte de la membresia para cada profesional: el configurado si lo ve, o el corte mas barato de su rubro (Barberia / Barberia Premium)
function servicioMembresiaPara(u){
  const rb=rubrosDeUsuario(u); const base=servicioMembresia();
  if(base&&visiblePorRubro(base,rb)) return base;
  return servicios.filter(x=>visiblePorRubro(x,rb)&&rubroEn(promos.membresia.rubro,x.rubro||'')&&/^corte/i.test(x.nombre.trim())).sort((a,b)=>a.precio-b.precio)[0]||null;
}

