// ============ RECEPCIONISTA ============
let recData = {reagendamientos:0, cumpleanos:[], incidentes:[]};
let avisosLeidos = [];
let recepcionPollTimer = null;

function enterRecepcionista(){
  loadStoriesData(); loadPuntosData(); loadTareasData();
  try { recData=JSON.parse(localStorage.getItem('luffy_rec_'+profile.id)||'{"reagendamientos":0,"cumpleanos":[],"incidentes":[]}'); } catch(e){ recData={reagendamientos:0,cumpleanos:[],incidentes:[]}; }
  if(DB){
    DB.doc('luffy/rec_'+profile.id).get().then(r=>{
      if(r&&JSON.stringify(r)!==JSON.stringify(recData)){ recData=r; try{localStorage.setItem('luffy_rec_'+profile.id,JSON.stringify(recData));}catch(e){} refreshCurrentView(); }
    }).catch(()=>{});
  }
  loadDineroPropio();
  loadAvisosLeidos();
  prefetchRecepcionTeamData();
  // Recepción no tiene nav (es pantalla única), así que sin este poll el feed
  // de "para cobrar" quedaba congelado en lo que había al momento del login.
  if(recepcionPollTimer) clearInterval(recepcionPollTimer);
  recepcionPollTimer=setInterval(()=>{ if(currentScreenId==='recepcion'||currentScreenId==='crmboard'||currentScreenId==='agenda') prefetchRecepcionTeamData(); }, 15000);
  show('recepcion');
  document.getElementById('nav').style.display='none';
  renderRecepcion();
}

function loadDineroPropio(){
  try{ dineroData=JSON.parse(localStorage.getItem('luffy_dinero_'+profile.id)||'{"turnos":[],"ventas":[],"deudores":[]}'); }catch(e){ dineroData={turnos:[],ventas:[],deudores:[]}; }
  if(DB){
    DB.doc('luffy/dinero_'+profile.id).get().then(r=>{
      if(r&&JSON.stringify(r)!==JSON.stringify(dineroData)){ dineroData=r; try{localStorage.setItem('luffy_dinero_'+profile.id,JSON.stringify(dineroData));}catch(e){} refreshCurrentView(); }
    }).catch(()=>{});
  }
}
function saveRecData(){
  try { localStorage.setItem('luffy_rec_'+profile.id,JSON.stringify(recData)); } catch(e){}
  if(DB){ try{ DB.doc('luffy/rec_'+profile.id).set(recData); }catch(e){} }
}

// ---- Avisos de cobro: cuando un profesional cierra un turno/venta, recepción
// lo ve al instante acá (detalle de qué cobrar y por qué), sin hablar.
// Es un doc global (no por usuario) para que lo vea cualquier recepcionista.
function loadAvisosLeidos(){
  try { avisosLeidos=JSON.parse(localStorage.getItem('luffy_avisos_leidos')||'[]'); } catch(e){ avisosLeidos=[]; }
  if(DB){
    DB.doc('luffy/avisos_leidos').get().then(r=>{
      if(r && Array.isArray(r.list) && JSON.stringify(r.list)!==JSON.stringify(avisosLeidos)){
        avisosLeidos=r.list;
        try{localStorage.setItem('luffy_avisos_leidos',JSON.stringify(avisosLeidos));}catch(e){}
        refreshCurrentView();
      }
    }).catch(()=>{});
  }
}
function saveAvisosLeidos(){
  try { localStorage.setItem('luffy_avisos_leidos',JSON.stringify(avisosLeidos)); } catch(e){}
  if(DB){ try{ DB.doc('luffy/avisos_leidos').set({list:avisosLeidos}); }catch(e){} }
}
function marcarAvisoVisto(key){ /* solo para ventas de mostrador */
  if(!avisosLeidos.includes(key)) avisosLeidos.push(key);
  saveAvisosLeidos();
  showToast('Marcado como cobrado ✓');
  renderRecepcion();
}
// Trae el dinero_<id> de cada profesional/encargado a localStorage, igual que
// hace el dashboard de admin, para poder armar el feed de avisos.
function prefetchRecepcionTeamData(){
  loadCaja();
  // Turnos pendientes, paquetes, sugerencias y agenda los puede tocar cualquier profesional desde otro dispositivo:
  // sin este refresh periódico, recepción no los veía aparecer/desaparecer hasta recargar la página (F5).
  turnosPendientesSt.load(); paquetesSt.load(); sugerenciasPaqSt.load(); agendaSt.load(); holdsSt.load();
  if(!DB) return Promise.resolve();
  const targets=allUsers.filter(u=>esProf(u));
  const jobs=targets.map(u=>DB.doc('luffy/dinero_'+u.id).get().then(r=>{
    if(r){ try{localStorage.setItem('luffy_dinero_'+u.id, JSON.stringify(r));}catch(e){} }
  }).catch(()=>{}));
  return Promise.all(jobs).then(refreshCurrentView).catch(()=>{});
}
function getAvisosPendientes(){
  const hoy=ymdLocal(new Date()), desde=addDias(hoy,-3);
  const cierres=(cierresData&&cierresData.byKey)||{};
  const profesionales=allUsers.filter(u=>esProf(u));
  // Lo cobrado en una sucursal con recepcion cuando la caja ya estaba cerrada (los chicos siguen cortando) le aparece a recepcion al otro dia
  const dePasado=(x,key,p)=>{ const sid=x.sucursal||p.sucursal; return x.fecha>=desde&&x.fecha<hoy&&sucursalConRecepcion(sid)&&!avisosLeidos.includes(key)&&!cierres[key]&&!cubiertoPorCaja(x.creadoEn,sid); };
  const items=[];
  profesionales.forEach(p=>{
    let dd={turnos:[],ventas:[]};
    try{ dd=JSON.parse(localStorage.getItem('luffy_dinero_'+p.id)||'{"turnos":[]}'); }catch(e){}
    normalizarFechas(dd);
    const turnosSel=(dd.turnos||[]).filter(t=>!t.deudaId&&(t.fecha===hoy||dePasado(t,'t:'+p.id+':'+t.id,p)));
    const ventasSel=(dd.ventas||[]).filter(v=>!v.deudaId&&(v.fecha===hoy||(v.fecha>=desde&&v.fecha<hoy&&(v.turnoId?turnosSel.some(t=>t.id===v.turnoId):dePasado(v,'v:'+p.id+':'+v.id,p)))));
    const ventasUsadas=new Set();
    turnosSel.forEach(t=>{
      const key='t:'+p.id+':'+t.id;
      const extras=ventasSel.filter(v=>{
        if(ventasUsadas.has(v.id)) return false;
        if(v.turnoId) return v.turnoId===t.id;
        if(!v.cliente||!t.cliente) return false;
        if(v.cliente.trim().toLowerCase()!==t.cliente.trim().toLowerCase()) return false;
        return Math.abs(new Date(v.creadoEn)-new Date(t.creadoEn))<45*60*1000;
      });
      extras.forEach(v=>ventasUsadas.add(v.id));
      items.push({key, prof:p, tipo:'turno', turno:t, extras, fecha:t.fecha, leido:avisosLeidos.includes(key)});
    });
    ventasSel.filter(v=>!ventasUsadas.has(v.id)).forEach(v=>{
      const key='v:'+p.id+':'+v.id;
      items.push({key, prof:p, tipo:'venta', venta:v, fecha:v.fecha, leido:avisosLeidos.includes(key)});
    });
  });
  items.sort((a,b)=>{
    const da=new Date((a.turno||a.venta).creadoEn), db=new Date((b.turno||b.venta).creadoEn);
    return db-da;
  });
  return items;
}

function marcarDeudaVista(profId,id){
  const key='u:'+profId+':'+id;
  if(!avisosLeidos.includes(key)) avisosLeidos.push(key);
  saveAvisosLeidos();
  renderRecepcion();
}
function htmlFilaDeuda(d,esNueva){
  return `<div class="card" style="margin-bottom:8px;border-color:rgba(244,114,182,${esNueva?'.55':'.25'});border-left:5px solid ${(sucursalDe(d.sucursal||d.prof.sucursal)||{}).color||'rgba(244,114,182,.25)'};background:rgba(244,114,182,${esNueva?'.07':'.03'})">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;margin-bottom:6px">
      <div><div style="margin-bottom:3px">${chipSucursal(d.sucursal||d.prof.sucursal,true)}</div><div style="font-size:14px;font-weight:800">Cliente: ${escH(d.cliente)}${d.clienteNumero?' <span style="color:var(--muted2);font-weight:700">#'+d.clienteNumero+'</span>':''} ${esNueva?'<span style="font-size:9px;font-weight:800;background:#f472b6;color:#fff;border-radius:6px;padding:2px 6px;vertical-align:middle">NUEVA</span>':''}</div>
        <div style="font-size:11.5px;color:var(--muted2)">Profesional: <b style="color:var(--text)">${escH(d.prof.name)}</b> · servicio del ${fechaCortaStr(d.fecha)} (hace ${diasDesdeStr(d.fecha)} d)</div></div>
      <div style="font-size:18px;font-weight:900;color:#f472b6;white-space:nowrap">${fp(saldoDeuda(d))}</div>
    </div>
    ${detalleDeudaHtml(d,true)}
    ${d.motivo?`<div style="font-size:11px;color:var(--muted2);margin-top:4px">Motivo: ${escH(d.motivo)}</div>`:''}
    <div style="display:flex;gap:8px;margin-top:10px">
      <button onclick="abrirCobroDeuda('${d.prof.id}','${d.id}')" style="flex:1;padding:11px;border-radius:12px;border:none;background:#f472b6;color:#fff;font-family:var(--font);font-size:13px;font-weight:800;cursor:pointer">💰 Cobrar / pago parcial</button>
      ${esNueva?`<button onclick="marcarDeudaVista('${d.prof.id}','${d.id}')" style="padding:11px 14px;border-radius:12px;border:1.5px solid var(--border2);background:transparent;color:var(--muted2);font-family:var(--font);font-size:12px;font-weight:700;cursor:pointer">Ya lo vi</button>`:''}
    </div>
  </div>`;
}
function htmlDeudasFullBody(){
  const deudas=todasLasDeudas(); const hoy=hoyStr();
  const esNueva=(d)=>d.fecha>=addDias(hoy,-2)&&!avisosLeidos.includes('u:'+d.prof.id+':'+d.id);
  return deudas.length?deudas.map(d=>htmlFilaDeuda(d,esNueva(d))).join(''):'<div style="text-align:center;color:var(--muted);font-size:13px;padding:16px">No hay deudas.</div>';
}
function abrirDeudasCompleto(){
  const deudas=todasLasDeudas();
  document.getElementById('registro-content').innerHTML=cabeceraModal('🚫 Clientes que deben ('+deudas.length+')')+htmlDeudasFullBody();
  openModal('modal-registro');
}
// ============ Inicio de recepción: 4 cards grandes (Agenda / Cosas por cobrar / CRM / Caja) ============
// Cada card muestra un numero resumen grande y al tocarla abre el detalle completo (mismo patron en las 4).
function htmlVentasResumenRec(){
  const hoy=hoyStr(), today=new Date();
  const misVentas=dineroData.ventas||[];
  const ventasHoyRec=misVentas.filter(v=>v.fecha===hoy);
  const qRec=today.getDate()<=15?1:2;
  const ventasQuinRec=misVentas.filter(v=>{ if(!v.fecha) return false; const d=new Date(v.fecha+'T00:00:00'); return d.getMonth()===today.getMonth()&&d.getFullYear()===today.getFullYear()&&(qRec===1?d.getDate()<=15:d.getDate()>15); });
  const sumaV=(arr,k)=>arr.reduce((s,v)=>s+(parseFloat(v[k])||0),0);
  const misPaquetesHoy=paquetesSt.list.filter(p=>p.fecha===hoy&&p.vendedorId===profile.id);
  const misMembresiasHoy=membresiasSt.list.filter(m=>m.fecha===hoy&&m.vendedorId===profile.id);
  const totalVendidoHoy=sumaV(ventasHoyRec,'total')+misPaquetesHoy.reduce((s,p)=>s+numV(p.total),0)+misMembresiasHoy.reduce((s,m)=>s+numV(m.precio),0);
  const nVendidoHoy=ventasHoyRec.length+misPaquetesHoy.length+misMembresiasHoy.length;
  const comQuincena=sumaV(ventasQuinRec,'comision'); // la comision de paquetes ya se ve aparte en "Llevás $X en paquetes esta quincena"
  return `<div class="card" style="cursor:pointer;margin-top:14px" onclick="abrirVentasCompleto()">
    <div style="display:flex;justify-content:space-between;align-items:baseline"><span style="font-size:12.5px;font-weight:800">💰 Lo que vendiste vos</span><span style="font-size:11px;color:var(--muted2)">ver detalle ›</span></div>
    <div style="font-size:22px;font-weight:900;margin-top:2px">${fp(totalVendidoHoy)} <span style="font-size:11px;color:var(--muted2);font-weight:600">hoy</span></div>
    <div style="font-size:11px;color:var(--muted2)">${nVendidoHoy} ${nVendidoHoy===1?'venta':'ventas'} (productos, paquetes, membresías) · esta quincena en productos: ${fp(comQuincena)} de comisión</div>
  </div>`;
}
const COL_AGENDA='#3B82F6', COL_COBRAR='#10B981', COL_CRM='#8B5CF6', COL_CAJA='#F59E0B';
function htmlCardAgenda(){
  const n=agendaSt.list.filter(a=>a.fecha===hoyStr()&&agEsActivo(a)).length;
  const nRec=turnosRecordatorioManana().length;
  return `<div class="card" style="cursor:pointer;margin:0" onclick="abrirAgenda()">
    ${iconoCard('agenda',COL_AGENDA)}
    <div style="font-size:24px;font-weight:800;margin-top:8px">${n}</div>
    <div style="font-size:12.5px;font-weight:700">turno${n===1?'':'s'} agendado${n===1?'':'s'} hoy</div>
    <div style="font-size:11px;color:${nRec?COL_AGENDA:'var(--muted2)'}">${nRec?nRec+' recordatorio'+(nRec===1?'':'s')+' de mañana':'Ver Agenda ›'}</div>
  </div>`;
}
function htmlCardCobrar(){
  const nCobrar=turnosPendientesSt.list.filter(x=>x.estado==='pendiente').length;
  const nDeudas=todasLasDeudas().length, nSenas=senasPend().length;
  const total=nCobrar+nDeudas+nSenas;
  const cobradoHoy=cobradosDelDia(hoyStr()).reduce((a,x)=>a+x.monto,0);
  return `<div class="card" style="cursor:pointer;margin:0" onclick="abrirCosasPorCobrar()">
    ${iconoCard('dinero',COL_COBRAR)}
    <div style="font-size:24px;font-weight:800;margin-top:8px">${total}</div>
    <div style="font-size:12.5px;font-weight:700">${total===1?'cosa':'cosas'} por cobrar</div>
    <div style="font-size:11px;color:var(--muted2)">${fp(cobradoHoy)} cobrado hoy</div>
  </div>`;
}
function htmlCardCRM(){
  const uv=ultimasVisitas();
  const nReactivar=clientesDir.filter(c=>{ if(c.problematico) return false; const u=uv[c.id]; return u&&diasDesdeStr(u.fecha)>=30&&!membresiaActivaDe(c.id)&&!clienteTieneTurnoFuturo(c.id); }).length;
  const nCumples=proximosCumplesManual().length+cumplesClientes(3).length;
  return `<div class="card" style="cursor:pointer;margin:0" onclick="abrirCRM()">
    ${iconoCard('clientes',COL_CRM)}
    <div style="font-size:24px;font-weight:800;margin-top:8px">${nReactivar}</div>
    <div style="font-size:12.5px;font-weight:700">para reactivar</div>
    <div style="font-size:11px;color:var(--muted2)">${nCumples?nCumples+' cumpleaños esta semana':'CRM completo ›'}</div>
  </div>`;
}
function htmlCardCaja(){
  const s=sesionAbierta();
  if(!s) return `<div class="card" style="cursor:pointer;margin:0;border-color:rgba(245,158,11,.4)" onclick="abrirCajaCompleto()">
    ${iconoCard('candado',COL_CAJA)}
    <div style="font-size:14.5px;font-weight:700;margin-top:8px">Caja sin abrir</div>
    <div style="font-size:11px;color:var(--muted2)">Diego Laure · tocá para abrirla</div>
  </div>`;
  const sd=cajaSaldos(s);
  return `<div class="card" style="cursor:pointer;margin:0" onclick="abrirCajaCompleto()">
    ${iconoCard('moneda',COL_CAJA)}
    <div style="font-size:24px;font-weight:800;margin-top:8px">${fp(sd.ef)}</div>
    <div style="font-size:12.5px;font-weight:700">en efectivo</div>
    <div style="font-size:11px;color:var(--muted2)">+${fp(sd.cta)} en cuenta · Diego Laure y French</div>
  </div>`;
}
function html4CardsRec(){
  return `<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:14px 0">${htmlCardAgenda()}${htmlCardCobrar()}${htmlCardCRM()}${htmlCardCaja()}</div>`;
}
// ============ Reservas pendientes de la web (pedido de Ivo, 27/09/2026) ============
// Cuando alguien pide un turno por la Reserva pública y manda el WhatsApp, ademas de abrirse el WhatsApp
// queda una "solicitud" real acá (sobre el mismo hold que ya bloqueaba el horario), visible en el Inicio de
// recepción, no solo por WhatsApp. Se vence sola a los 15 minutos si nadie la resuelve.
function rpSolicitudesPendientes(){
  const ahora=Date.now();
  return holdsSt.list.filter(h=>h.estado==='pendiente'&&numV(h.expira)>ahora).sort((a,b)=>numV(a.expira)-numV(b.expira));
}
function htmlBannerReservasPendientes(){
  const L=rpSolicitudesPendientes(); if(!L.length) return '';
  return `<div class="card" style="cursor:pointer;margin-bottom:10px;border-color:rgba(59,130,246,.4);background:rgba(59,130,246,.06)" onclick="abrirReservasPendientes()">
    <div style="display:flex;align-items:center;gap:10px">${iconoCard('web','#3B82F6',34)}<div style="flex:1"><div style="font-size:13px;font-weight:800">${L.length} ${L.length===1?'persona quiere':'personas quieren'} reservar por la web</div><div style="font-size:11px;color:var(--muted2)">Tocá para confirmar o rechazar antes de que se venza</div></div><span style="color:var(--muted)">›</span></div>
  </div>`;
}
// Un combo de 2+ rubros manda un hold "pendiente" por cada rubro (mismo grupoSolicitudId) -- se agrupan acá
// visualmente bajo una sola tarjeta para que recepción vea de una que es un solo pedido de un cliente, aunque
// cada parte se siga confirmando/rechazando por separado (cada una agenda su propio turno real al confirmarla).
function rpGruposSolicitudes(L){
  const vistos=new Set(), grupos=[];
  L.forEach(h=>{
    const key=h.grupoSolicitudId||h.id; if(vistos.has(key)) return; vistos.add(key);
    grupos.push(h.grupoSolicitudId?L.filter(x=>x.grupoSolicitudId===key):[h]);
  });
  return grupos;
}
function htmlReservasPendientesRec(){
  const L=rpSolicitudesPendientes();
  if(!L.length) return '<div class="card" style="text-align:center;color:var(--muted);font-size:13px;padding:20px">Nadie pidió turno por la web todavía 🎉</div>';
  return rpGruposSolicitudes(L).map(grupo=>{
    const h0=grupo[0], wa=linkWhatsApp(h0.clienteWhatsapp,'');
    const totalSena=grupo.reduce((a,h)=>a+(h.tieneOferta?numV(h.montoSena):0),0);
    const partes=grupo.map(h=>{
      const prof=allUsers.find(u=>u.id===h.profId), suc=sucursalDe(h.sucursal);
      const nombresSvc=(h.servicioIds||[]).map(id=>(servicios.find(s=>s.id===id)||{}).nombre).filter(Boolean).join(', ');
      const restante=Math.max(0,Math.round((numV(h.expira)-Date.now())/60000));
      return `<div style="padding:8px 0;border-top:1px solid var(--border)">
        <div style="font-size:11.5px;color:var(--muted2);line-height:1.6">${escH(nombresSvc)} · con ${escH(prof?prof.name:'')} · ${fechaCortaStr(h.fecha)} ${h.hora}hs · ${escH(suc?suc.nombre:'')}<br>${fp(h.total)}${h.tieneOferta?' · seña esperada '+fp(h.montoSena):' · paga en el local'} · <span style="color:#fbbf24">se vence en ${restante} min</span></div>
        <div style="display:flex;gap:8px;margin-top:6px;flex-wrap:wrap">
          <button class="btn btn-ghost" style="flex:1;min-width:110px" onclick="rpAbrirConfirmar('${h.id}')">✅ Confirmar</button>
          <button class="btn btn-ghost" style="flex:1;min-width:110px;color:#f472b6" onclick="rpRechazarSolicitud('${h.id}')">❌ Rechazar</button>
        </div>
      </div>`;
    }).join('');
    return `<div class="card" style="margin-bottom:8px;border-left:4px solid #60a5fa">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px">
        <div style="font-size:13px;font-weight:800">${escH(h0.clienteNombre)}${grupo.length>1?' · combo de '+grupo.length+' partes':''}</div>
        ${wa?`<a href="${wa}" target="_blank" rel="noopener" style="padding:6px 10px;border-radius:10px;background:rgba(52,211,153,.15);color:#34d399;font-size:11.5px;font-weight:800;text-decoration:none;white-space:nowrap">WhatsApp</a>`:''}
      </div>
      ${grupo.length>1&&totalSena>0?`<div style="font-size:11.5px;color:#34d399;font-weight:700;margin-top:2px">Seña total esperada: ${fp(totalSena)}</div>`:''}
      ${partes}
    </div>`;
  }).join('');
}
let reservasPendientesAbierto=false;
function abrirReservasPendientes(){
  reservasPendientesAbierto=true;
  document.getElementById('registro-content').innerHTML=cabeceraModal('🌐 Reservas pendientes de la web')+htmlReservasPendientesRec();
  openModal('modal-registro');
}
async function rpAbrirConfirmar(holdId){
  const h=holdsSt.list.find(x=>x.id===holdId); if(!h) return;
  let montoSenaConfirmado=null;
  if(h.tieneOferta){
    const v=await uiDialog({title:'Confirmar turno',msg:'Este turno tenía seña obligatoria. Confirmá el monto que ya recibiste antes de agendarlo.',fields:[
      {label:'Monto de la seña recibida',type:'number',value:h.montoSena||0}],ok:'Confirmar y agendar'});
    if(!v) return;
    const monto=numV(v[0]);
    if(monto<=0){ showToast('Poné el monto de la seña recibida'); return; }
    montoSenaConfirmado=monto;
  } else {
    if(!await uiConfirm('¿Agendar este turno?',escH(h.clienteNombre)+' · '+fechaCortaStr(h.fecha)+' '+h.hora+'hs')) return;
  }
  await rpConfirmarSolicitud(h,montoSenaConfirmado);
}
async function rpConfirmarSolicitud(h,montoSenaConfirmado){
  let cli=null;
  const tel=String(h.clienteWhatsapp||'').replace(/\D/g,'');
  if(tel) cli=clientesDir.find(c=>String(c.tel||'').replace(/\D/g,'').slice(-8)===tel.slice(-8));
  if(!cli){
    const r=await crearCliente({nombre:h.clienteNombre,tel:h.clienteWhatsapp});
    cli=(r&&(r.cliente||r.existente))||null;
  }
  if(!cli){ showToast('No se pudo cargar el cliente'); return; }
  const prof=allUsers.find(u=>u.id===h.profId);
  const svcObjs=(h.servicioIds||[]).map(id=>servicios.find(x=>x.id===id)).filter(Boolean).map(x=>({svcId:x.id,nombre:x.nombre}));
  const dur=duracionServicios(h.servicioIds||[]);
  const ahora=new Date().toISOString();
  await agendaSt.cambiar(l=>{ l.push({id:'ag'+Date.now().toString(36),sucursal:h.sucursal,fecha:h.fecha,hora:h.hora,duracion:dur||30,profId:h.profId,profNombre:prof?prof.name:'',clienteId:cli.id,clienteNombre:cli.nombre,servicios:svcObjs,nota:montoSenaConfirmado?('Reservado por la web · seña recibida: '+fp(montoSenaConfirmado)):'Reservado por la web',paqueteId:null,itemId:null,estado:'agendado',origenWeb:true,creadoPorId:profile.id,creadoPorNombre:profile.name,creadoEn:ahora,upd:ahora}); });
  await holdsSt.cambiar(l=>{ const i=l.findIndex(x=>x.id===h.id); if(i>=0) l.splice(i,1); });
  showToast('Turno agendado ✓'); refreshCurrentView();
}
async function rpRechazarSolicitud(holdId){
  if(!await uiConfirm('¿Rechazar esta solicitud?','Se la saca de la lista — avisale al cliente por WhatsApp aparte.')) return;
  await holdsSt.cambiar(l=>{ const i=l.findIndex(x=>x.id===holdId); if(i>=0) l.splice(i,1); });
  showToast('Solicitud rechazada'); refreshCurrentView();
}
let cosasPorCobrarAbierto=false, cajaCompletaAbierta=false;
function abrirCosasPorCobrar(){
  cosasPorCobrarAbierto=true;
  const deudas=todasLasDeudas(), sen=senasPend();
  document.getElementById('registro-content').innerHTML=cabeceraModal('💳 Cosas por cobrar')+
    htmlTurnosPendientesRec()+htmlPaquetesNuevosRec()+htmlSugerenciasPaqRec()+
    (deudas.length?`<div class="sec-hdr" style="margin-top:16px;margin-bottom:8px"><span class="sec-title">🚫 Clientes que deben (${deudas.length})</span></div>${htmlDeudasFullBody()}`:'')+
    `<div class="sec-hdr" style="margin-top:16px;margin-bottom:8px"><span class="sec-title">💵 Señas pendientes (${sen.length})</span><button class="sec-btn" onclick="abrirFormSena()" style="background:#4A136B">+ Seña</button></div>${htmlSenasFullBody()}`+
    htmlCobradosRec();
  openModal('modal-registro');
}
function abrirCajaCompleto(){
  cajaCompletaAbierta=true;
  document.getElementById('registro-content').innerHTML=cabeceraModal('💰 Caja')+htmlCajaRecBase()+htmlResumenDia()+htmlTableroRec()+htmlVentasResumenRec();
  openModal('modal-registro');
}
function minutosDesde(iso){
  const min=Math.round((Date.now()-new Date(iso).getTime())/60000);
  if(min<1) return 'recién';
  if(min<60) return 'hace '+min+' min';
  return 'hace '+Math.round(min/60)+'h';
}

function renderRecepcion(){
  if(document.activeElement&&document.activeElement.id==='rec-busq') return; // no interrumpir mientras escribe en el buscador
  if(document.querySelector('#rec-body details[open]')) return; // ni mientras tiene algo desplegado
  const h=new Date().getHours();
  const gr=h<12?'Buenos días 📞':h<20?'Buenas tardes 📞':'Buenas noches 📞';
  document.getElementById('rec-greeting').textContent=gr;

  const hoy=ymdLocal(new Date());
  const stBl=STORY_BLOQUES.map(b=>({b,d:storyRecHechas(hoy,b.id),n:storyRecItems(b.id).length}));
  const stHechas=stBl.reduce((a,x)=>a+x.d,0), stTotal=stBl.reduce((a,x)=>a+x.n,0);
  const tareasAhora=tareasDeRec().filter(t=>t.desde<=horaAhora()&&horaAhora()<t.hasta);
  const tareasAtrasadas=tareasDeRec().filter(t=>t.hasta<=horaAhora()&&!hechaTarea(t.id));
  const tareasPend=tareasAhora.filter(t=>!hechaTarea(t.id)).length+tareasAtrasadas.length;
  const bloqueFaltante=stBl.find(x=>x.d<x.n);
  const body=document.getElementById('rec-body');
  body.innerHTML=`
    ${htmlBannerReservasPendientes()}
    ${html4CardsRec()}
    <button onclick="abrirVentaPaquete()" style="width:100%;margin-bottom:14px;padding:12px;border-radius:12px;border:none;background:var(--accent);color:#fff;font-family:var(--font);font-size:13px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px">${mi('stock',16)} Armar paquete</button>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px">
      <div class="card" style="cursor:pointer;margin:0;display:flex;align-items:center;gap:10px" onclick="abrirTareasCompleto()">
        ${iconoCard('tareas',tareasPend?'#F59E0B':'#10B981',34)}
        <div style="min-width:0"><div style="font-size:12.5px;font-weight:700">${tareasPend?tareasPend+' '+(tareasPend===1?'tarea':'tareas'):'Tareas al día'}</div>
        <div style="font-size:11px;color:var(--muted2)">${tareasAtrasadas.length?tareasAtrasadas.length+' atrasada'+(tareasAtrasadas.length===1?'':'s'):'de tu horario'}</div></div>
      </div>
      <div class="card" style="cursor:pointer;margin:0;display:flex;align-items:center;gap:10px" onclick="goToRec('stories')">
        ${iconoCard('historias',stTotal-stHechas?'#F59E0B':'#10B981',34)}
        <div style="min-width:0"><div style="font-size:12.5px;font-weight:700">${stTotal-stHechas?(stTotal-stHechas)+' '+(stTotal-stHechas===1?'historia':'historias'):'Al día'}</div>
        <div style="font-size:11px;color:var(--muted2)">${bloqueFaltante?bloqueFaltante.b.label:stHechas+'/'+stTotal+' publicadas'}</div></div>
      </div>
    </div>

    ${htmlTareasEquipoWidget()}
    ${htmlClientesRec()}
  `;
  recRenderBusqueda();
  // Si recepcion dejo abierto el modal de "Cosas por cobrar" o "Caja" (algo que otro dispositivo puede
  // estar tocando en cualquier momento), lo refrescamos tambien en cada poll — si no, quedaba mostrando
  // datos viejos hasta que lo cerraba y volvia a abrir (turnos pendientes que no "aparecian" sin F5).
  if(cosasPorCobrarAbierto) abrirCosasPorCobrar();
  else if(cajaCompletaAbierta) abrirCajaCompleto();
  else if(reservasPendientesAbierto) abrirReservasPendientes();
}

function goToRec(dest){
  if(dest==='stories'){
    loadStoriesData();
    renderStories();
    document.getElementById('stories-back').onclick=()=>{
      show('recepcion');
      document.getElementById('nav').style.display='none';
      renderRecepcion();
    };
    show('stories');
  }
}

function marcarCumple(id){
  const c=(recData.cumpleanos||[]).find(x=>x.id===id);
  if(!c) return;
  c.contactado=!c.contactado;
  if(c.contactado) addPuntos(profile.id,'cumple',ptsDe('cumple',20),'Cumpleaños contactado','cumple:'+c.id+':'+new Date().getFullYear());
  saveRecData();
  renderRecepcion();
  if(c.contactado) showToast('+'+ptsDe('cumple',20)+' puntos ⭐');
}

function abrirReportarIncidente(){
  document.getElementById('registro-content').innerHTML=cabeceraModal('⚠️ Reportar incidente')+
    `<div style="font-size:12.5px;color:var(--muted2);margin-bottom:12px">¿Con qué profesional?</div>
    <div style="display:flex;flex-wrap:wrap;gap:6px">${allUsers.filter(u=>esProf(u)).map(u=>`<button onclick="closeModal('modal-registro');reportarIncidente('${u.id}','${escH(u.name)}')" style="padding:9px 14px;border-radius:14px;border:1.5px solid rgba(244,114,182,.3);background:rgba(244,114,182,.06);color:var(--text);font-family:var(--font);font-size:13px;font-weight:600;cursor:pointer">${u.emoji||'✂️'} ${escH(u.name)}</button>`).join('')}</div>`;
  openModal('modal-registro');
}
async function reportarIncidente(profId, profName){
  const r=await uiPrompt('Reportar incidente',{msg:'¿Qué pasó con '+profName+'?',type:'textarea',ok:'Reportar'});
  const razon=(r||'').trim();
  if(!razon) return;
  if(!recData.incidentes) recData.incidentes=[];
  recData.incidentes.push({profId,profName,razon,fecha:new Date().toISOString(),reportadoPor:profile.name});
  saveRecData();
  // Save to shared incidents
  try {
    const incs=JSON.parse(localStorage.getItem('luffy_incidentes')||'[]');
    incs.unshift({id:Date.now().toString(),profId,profName,razon,fecha:new Date().toISOString(),reportadoPor:profile.name,procesado:false});
    saveIncidentes(incs);
  } catch(e){}
  showToast('Incidente reportado ✓');
}

// ============ ENCARGADO ============
function enterEncargado(){
  loadProductos();
  show('encargado');
  document.getElementById('nav').style.display='none';
  renderEncargado();
}

function renderEncargado(){
  const body=document.getElementById('encargado-body');
  if(!body) return;
  body.innerHTML=`
    ${profile&&profile.role==='profesional'?'<button onclick="goTo(\'hub\')" style="background:var(--s2);border:none;color:var(--text);padding:9px 14px;border-radius:12px;cursor:pointer;font-family:var(--font);font-size:12.5px;font-weight:700;margin-top:12px">← Volver al inicio</button>':''}
    <div class="sec-title" style="margin:16px 0 12px">Stock actual</div>
    ${!productos.length?'<div class="empty"><div class="e-icon">📦</div><p>Todavía no hay productos cargados por el admin.</p></div>':
    productos.map(p=>{
      const bajo = p.stock<=p.alertaStock;
      return `<div class="prof-card" style="margin-bottom:10px;${bajo?'border-color:#f472b6':''}">
        <div style="display:flex;align-items:center;gap:12px">
          <div style="font-size:26px">📦</div>
          <div style="flex:1">
            <div style="font-size:14px;font-weight:700">${p.nombre}</div>
            <div style="font-size:${bajo?'20px':'18px'};font-weight:900;color:${bajo?'#f472b6':'var(--text)'}">${p.stock} <span style="font-size:11px;font-weight:600;color:var(--muted2)">unidades</span></div>
            ${bajo?`<div style="font-size:11px;font-weight:700;color:#f472b6;margin-top:2px">⚠️ Queda poco — avisá para reponer (umbral: ${p.alertaStock})</div>`:''}
          </div>
          <button onclick="reponerStock('${p.id}')" style="padding:10px 14px;border-radius:10px;border:none;background:var(--accent);color:#fff;font-family:var(--font);font-size:12px;font-weight:700;cursor:pointer;flex-shrink:0">+ Reponer</button>
        </div>
      </div>`;
    }).join('')}
  `;
}

async function reponerStock(id){
  const p=productos.find(x=>x.id===id);
  if(!p) return;
  const cantStr=await uiPrompt('Reponer stock',{msg:p.nombre,label:'¿Cuántas unidades repusiste?',type:'number',value:'10',ok:'Sumar al stock'});
  if(!cantStr) return;
  const cant=parseInt(cantStr)||0;
  if(!cant||cant<0){ showToast('Ingresá un número válido'); return; }
  ajustarStock([{id:p.id,delta:cant}]);
  showToast('Stock actualizado ✓');
  renderEncargado();
}

