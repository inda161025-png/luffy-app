// ============ MENU LATERAL, TEMA CLARO/OSCURO Y GUIA RAPIDA ============
function temaActual(){ return document.documentElement.getAttribute('data-theme')==='light'?'light':'dark'; }
function aplicarTema(t){
  if(t==='light') document.documentElement.setAttribute('data-theme','light'); else document.documentElement.removeAttribute('data-theme');
  try{ localStorage.setItem('luffy_theme',t); }catch(e){}
  const m=document.querySelector('meta[name="theme-color"]'); if(m) m.setAttribute('content',t==='light'?'#f4f4f9':'#09090f');
}
function alternarTema(){ aplicarTema(temaActual()==='light'?'dark':'light'); renderMenu(); }

const ICONO_MENU='<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>';

function abrirMenu(){ if(!profile) return; renderMenu(); document.getElementById('menu-lat').classList.add('open'); }
function cerrarMenu(){ document.getElementById('menu-lat').classList.remove('open'); }

function menuIr(accion){
  cerrarMenu();
  const irPerfil=()=>{ goTo('perfil'); };
  const acc={
    perfil:()=>{ if(profile.role==='profesional') irPerfil(); else abrirMiCuenta(); },
    contenido:()=>{ irPerfil(); setTimeout(()=>{ const e=document.getElementById('perfil-contenido'); if(e) e.scrollIntoView({behavior:'smooth',block:'start'}); },150); },
    modoProf:()=>cambiarModo('prof'), modoAdmin:()=>cambiarModo('admin'),
    stock:()=>{ enterEncargado(); }, dinero:()=>goTo('dinero'), clientes:()=>goTo('clientes'), banco:()=>goTo('banco'), puntos:()=>goTo('puntos'), kanban:()=>goTo('kanban'),
    stories:()=>{ if(profile.role==='recepcionista') goToRec('stories'); else goTo('stories'); },
    pantallaFrench:()=>abrirPantallaFrench(),
    agenda:()=>abrirAgenda(),
    misTurnos:()=>abrirCalendarioRec(),
    guia:()=>abrirGuia(true), pass:()=>cambiarMiPassword(), salir:()=>showLogin(),
  };
  (acc[accion]||(()=>{}))();
}

function renderMenu(){
  const p=profile; if(!p) return;
  const claro=temaActual()==='light';
  const it=(ico,txt,accion)=>`<button class="mlat-it" onclick="menuIr('${accion}')"><span>${ico}</span>${txt}</button>`;
  const rubrosTxt=(p.role==='profesional'&&p.rubros&&p.rubros.length)?p.rubros.map(nombreRubro).filter(Boolean).join(', '):(ROLES[p.role]||'');
  const sinRec=sucursalDeKiosco();
  const vePantallaFrench=sinRec&&(p.role==='admin'||p.role==='recepcionista'||sucursalesDe(p).includes(sinRec.id));
  let items='';
  if(p.role==='profesional'){
    items=it(mi('perfil'),'Mi perfil','perfil')+it(mi('contenido'),'Contenido','contenido')+(p.esEncargado?it(mi('stock'),'Control de stock','stock'):'')+it(mi('clientes'),'Mis clientes','clientes')+it('📅','Agenda','agenda')+it(mi('dinero'),'Mi dinero','dinero')+it(mi('banco'),'Banco de reels','banco')+it(mi('kanban'),'Tablero','kanban')+it(mi('historias'),'Historias','stories')+it(mi('puntos'),'Mis puntos','puntos')+(vePantallaFrench?it('📋','Pantalla de '+escH(sinRec.nombre),'pantallaFrench'):'')+(p.adminReal?it('👑','Volver a Admin','modoAdmin'):'');
  } else if(p.role==='recepcionista'){
    items=it(mi('perfil'),'Mi cuenta','perfil')+it('🗓','Mis turnos de esta semana','misTurnos')+it('📅','Agenda','agenda')+it(mi('historias'),'Historias','stories')+(vePantallaFrench?it('📋','Pantalla de '+escH(sinRec.nombre),'pantallaFrench'):'');
  } else {
    items=it(mi('perfil'),'Mi cuenta','perfil')+it('📅','Agenda','agenda')+(p.role==='admin'&&p.tambienProf?it('✂️','Mi perfil profesional','modoProf'):'')+(vePantallaFrench?it('📋','Pantalla de '+escH(sinRec.nombre),'pantallaFrench'):'');
  }
  items+=it(mi('guia'),'Guía rápida','guia')+it(mi('pass'),'Cambiar contraseña','pass');
  document.getElementById('mlat-cnt').innerHTML=`
    <div class="mlat-hd">
      <div class="mlat-av" style="background:${p.color||'#4A136B'}33;border-color:${p.color||'#4A136B'}">${p.emoji||'👤'}</div>
      <div style="flex:1;min-width:0"><div style="font-size:16px;font-weight:800;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escH(p.name)}</div><div style="font-size:11.5px;color:var(--muted2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escH(rubrosTxt)}</div></div>
      <button class="mlat-x" onclick="cerrarMenu()" aria-label="Cerrar">×</button>
    </div>
    <div class="mlat-lista">${items}</div>
    <div class="mlat-pie">
      <button class="mlat-it" onclick="alternarTema()"><span>${claro?'☀️':'🌙'}</span>Modo claro<i class="mlat-sw ${claro?'on':''}"><b></b></i></button>
      <button class="mlat-it mlat-salir" onclick="menuIr('salir')"><span>${mi('salir')}</span>Salir</button>
    </div>`;
}

// Ficha de cuenta para los roles que no tienen pantalla de perfil (recepcion, encargado, admin)
function abrirMiCuenta(){
  const p=profile; if(!p) return;
  const c=document.getElementById('registro-content');
  c.innerHTML=`<div style="display:flex;align-items:center;gap:8px;margin-bottom:16px"><div class="modal-title" style="margin:0">Mi cuenta</div><button onclick="closeModal('modal-registro')" style="margin-left:auto;background:var(--s3);border:none;color:var(--muted2);font-size:18px;width:32px;height:32px;border-radius:50%;cursor:pointer">×</button></div>
    <div style="text-align:center;padding:6px 0 18px"><div style="width:72px;height:72px;border-radius:50%;background:${p.color||'#4A136B'}33;border:3px solid ${p.color||'#4A136B'};display:flex;align-items:center;justify-content:center;font-size:30px;margin:0 auto 10px">${p.emoji||'👤'}</div>
      <div style="font-size:20px;font-weight:900">${escH(p.name)}</div>
      <div style="font-size:12px;color:var(--muted2);margin-top:2px">@${escH(p.username||'')} · ${escH(ROLES[p.role]||p.role)}</div></div>
    ${p.passReset?`<div class="card" style="margin-bottom:10px;border:1.5px solid #fbbf24;background:rgba(251,191,36,.08)"><div style="display:flex;align-items:center;gap:10px"><span style="font-size:22px">🔓</span><div style="flex:1"><div style="font-size:13px;font-weight:800;color:#fbbf24">El admin te habilitó a cambiar tu contraseña</div><div style="font-size:11px;color:var(--muted2)">No hace falta que sepas la anterior. Se cierra solo apenas la definas.</div></div></div><button class="btn btn-primary" onclick="definirNuevaPasswordHabilitada()" style="margin-top:10px;width:100%">Definir nueva contraseña</button></div>`:''}
    <button class="btn btn-ghost" onclick="closeModal('modal-registro');cambiarMiPassword()">🔑 Cambiar contraseña</button>`;
  openModal('modal-registro');
}

function abrirConfigReservaPublica(){
  document.getElementById('registro-content').innerHTML=cabeceraModal('🌐 Reserva pública')+
    `<div style="font-size:12px;color:var(--muted2);margin:-6px 0 12px;line-height:1.5">El cliente entra sin login a <b style="color:var(--text)">${escH(location.origin+location.pathname+'#reserva')}</b>, ve los horarios libres y arma el pedido — el turno se confirma por WhatsApp con recepción/el profesional, no se agenda solo.</div>
    <div class="field"><label>WhatsApp del negocio (a donde llega el pedido)</label><input id="crp-wa" type="tel" placeholder="11 2345 6789" value="${escH(promos.whatsappNegocio||'')}"/></div>
    <div class="field" style="margin-top:8px"><label>Seña obligatoria cuando hay oferta (% del servicio)</label><input id="crp-sena" type="number" inputmode="numeric" value="${numV(promos.senaPublicaPct)||30}"/></div>
    <div style="font-size:11px;font-weight:800;color:var(--muted);text-transform:uppercase;letter-spacing:.08em;margin:14px 0 4px">Links para dejar reseña en Google (para el botón de +${RESENA_DESC_PCT}% en /#cuenta) — cada sucursal tiene su propia ficha</div>
    ${sucursales.map(s=>`<div class="field" style="margin-top:6px"><label>${escH(s.nombre)}</label><input id="crp-resena-${escH(s.id)}" type="url" placeholder="https://g.page/r/..." value="${escH((promos.linksResena&&promos.linksResena[s.id])||'')}"/></div>`).join('')}
    <button class="btn btn-primary" onclick="guardarConfigReservaPublica()" style="margin-top:14px">Guardar</button>`;
  openModal('modal-registro');
}
function guardarConfigReservaPublica(){
  promos.whatsappNegocio=(document.getElementById('crp-wa').value||'').trim();
  const pct=numV(document.getElementById('crp-sena').value); promos.senaPublicaPct=pct>0?pct:30;
  promos.linksResena={};
  sucursales.forEach(s=>{ const v=(document.getElementById('crp-resena-'+s.id)?.value||'').trim(); if(v) promos.linksResena[s.id]=v; });
  savePromos(); closeModal('modal-registro'); showToast('Guardado ✓'); renderAdmin();
}
async function cambiarPinPantalla(){
  const v=await uiPrompt('PIN de la Pantalla local',{msg:'Lo van a usar los chicos de French (o quien corresponda) para entrar a esta pantalla sin loguearse con ninguna cuenta.',label:'PIN (4 a 8 dígitos)',value:(promos&&promos.pinPantalla)||'0000',ok:'Guardar'});
  if(v===null) return;
  const pin=v.trim();
  if(!/^\d{4,8}$/.test(pin)){ showToast('El PIN tiene que ser de 4 a 8 números'); return; }
  promos.pinPantalla=pin; savePromos(); showToast('PIN actualizado ✓'); abrirPantallaFrench();
}
// ---------- Pantalla de French / medidor de salud del local (solo lectura) ----------
// Ojo: ya existe sucursalSinRecepcion(u) (linea ~3060, recibe un usuario y devuelve boolean) — esta es otra cosa, no reemplazarla.
function sucursalDeKiosco(){ return sucursales.find(s=>!sucursalConRecepcion(s.id))||null; }
let pantallaFrenchTimer=null;
async function abrirPantallaFrench(){
  const suc=sucursalDeKiosco(); if(!suc){ showToast('No hay ninguna sucursal sin recepción configurada'); return; }
  await mostrarPantallaKiosco(suc,false);
}
// Pantalla completa (no modal): reemplaza a la que estaba viendo la persona, como cualquier otra pantalla de la app.
// anonimo=true es el modo kiosco (entrado con PIN, sin sesion) — "volver" ahi manda al login, no a ningun hub.
let kioscoAnonimo=false, kioscoVolverRol=null;
async function mostrarPantallaKiosco(suc,anonimo){
  kioscoAnonimo=!!anonimo;
  if(!anonimo) kioscoVolverRol=profile?profile.role:null;
  show('pantalla-kiosco');
  const nav=document.getElementById('nav'); if(nav) nav.style.display='none';
  document.getElementById('pk-body').innerHTML=
    `<div style="font-size:12px;color:var(--muted2);margin-bottom:10px">${escH(suc.nombre)}</div>`
    +(!anonimo&&profile&&profile.role==='admin'?`<div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:10px"><button class="lnk" onclick="cambiarPinPantalla()">🔑 PIN (hoy: ${escH((promos&&promos.pinPantalla)||'0000')})</button><button class="lnk" onclick="editarMetasSalud()">⚙️ Metas de salud</button></div>`:'')
    +`<div id="pf-body" style="font-size:13px;color:var(--muted2)">Cargando…</div>`;
  await renderSaludLocal(suc.id);
  clearInterval(pantallaFrenchTimer);
  pantallaFrenchTimer=setInterval(()=>{ document.getElementById('pf-body')?renderSaludLocal(suc.id):clearInterval(pantallaFrenchTimer); },30000);
}
function volverDePantallaKiosco(){
  clearInterval(pantallaFrenchTimer);
  if(kioscoAnonimo){ kioscoAnonimo=false; show('login'); showWelcome(); return; }
  if(kioscoVolverRol==='admin'){ show('admin'); enterAdmin(); }
  else if(kioscoVolverRol==='recepcionista'){ show('recepcion'); renderRecepcion(); }
  else { goTo('hub'); }
}
// ---------- Reserva pública (sin login, para clientes — ver negocio/pendientes-app.md) ----------
// V1: no cobra de verdad (no hay backend para guardar la clave de Mercado Pago de cada profesional con seguridad).
// El cliente arma el pedido; si el horario tiene oferta, la seña queda anotada en el mensaje pero el alias de MP
// se lo manda recepcion a mano recien cuando confirma por WhatsApp que el horario sigue libre (asi no se le pasan
// datos de pago para un turno que otro cliente ya agarro mientras tanto). No escribe nada en la Agenda real: la
// crea recepcion/el profesional al confirmar, igual que ya se hace hoy con "compartir por WhatsApp".
// Bloqueo temporal del horario: al elegirlo se anota un "hold" con vencimiento, para que no lo vea libre otra
// persona navegando al mismo tiempo. 3 min mientras completa el formulario, extendido a 20 min al mandar el WhatsApp
// (le da tiempo a recepcion a confirmarlo). Vence solo si lo abandona. Mismo patron sin sesion que el resto de la
// reserva publica — igual que el resto, deja de funcionar tal cual una vez que se corra el bloqueo de seguridad
// de la base (paso 2, todavia pendiente) y haya que revisar los permisos de escritura sin login.
const holdsSt=almacenLista('luffy/reservas_holds','luffy_reservas_holds',nuevoMayor);
let rpSesionId='';
let rpState={paso:'sucursal',sucursal:null,servicioIds:[],rubroAbierto:null,profId:null,fecha:'',hora:'',nombre:'',whatsapp:''};
async function mostrarReservaPublica(){
  show('reserva-publica');
  const nav=document.getElementById('nav'); if(nav) nav.style.display='none';
  document.getElementById('rp-body').innerHTML='<div style="text-align:center;padding:40px 0;color:var(--muted2)">Cargando…</div>';
  rpSesionId='rp'+Date.now().toString(36)+Math.random().toString(36).slice(2,8);
  await rpCargarDatos();
  rpState={paso:'sucursal',sucursal:null,servicioIds:[],rubroAbierto:null,profId:null,fecha:hoyStr(),hora:'',nombre:'',whatsapp:''};
  if(sucursales.length<=1){ rpState.sucursal=(sucursales[0]||{}).id||null; rpState.paso='servicios'; }
  rpRender();
}
async function rpCargarDatos(){
  if(!DB) return;
  try{
    const [sucR,userR,promR,svcR,agR,holdR,rubR]=await Promise.all([
      Promise.resolve(DB.doc('luffy/sucursales').get()).catch(()=>null),
      Promise.resolve(DB.doc('luffy/users').get()).catch(()=>null),
      Promise.resolve(DB.doc('luffy/promos_cfg').get()).catch(()=>null),
      Promise.resolve(DB.doc('luffy/servicios').get()).catch(()=>null),
      Promise.resolve(DB.doc('luffy/agenda').get()).catch(()=>null),
      Promise.resolve(DB.doc('luffy/reservas_holds').get()).catch(()=>null),
      Promise.resolve(DB.doc('luffy/rubros').get()).catch(()=>null),
    ]);
    if(sucR&&sucR.list&&sucR.list.length) sucursales=sucR.list;
    if(userR&&Array.isArray(userR.list)) allUsers=userR.list;
    if(promR) promos=aplicarPromosRemotas(promR);
    if(svcR&&svcR.list&&svcR.list.length) servicios=svcR.list;
    if(holdR&&Array.isArray(holdR.list)) holdsSt.list=holdR.list;
    if(agR&&Array.isArray(agR.list)) agendaSt.list=agR.list;
    if(rubR&&rubR.list&&rubR.list.length) rubros=rubR.list;
    // Los rubros de cada profesional (Admin -> Equipo -> Cuentas) viven en un documento aparte
    // (luffy/rubros_prof), no en luffy/users -- sin este paso, rubrosDeUsuario() siempre daba "sin
    // restriccion" acá y el filtro de profesional por rubro no filtraba nada (bug real, reportado por Ivo).
    await cargarRubrosProf();
  }catch(e){}
}
function rpOrden(){ return sucursales.length>1?['sucursal','servicios','profesional','horario','confirmar']:['servicios','profesional','horario','confirmar']; }
function rpVolver(){ const o=rpOrden(); const i=o.indexOf(rpState.paso); if(i>0){ rpState.paso=o[i-1]; rpRender(); } }
function rpBackBtn(){ return rpOrden().indexOf(rpState.paso)>0?`<button onclick="rpVolver()" class="lnk" style="margin-bottom:10px">‹ Atrás</button>`:''; }
function rpDuracion(){ return duracionServicios(rpState.servicioIds); }
// French no tiene los demas rubros. OJO: no usar sucursalConRecepcion() aca — esa funcion mira si HAY UNA
// RECEPCIONISTA ASIGNADA a la sucursal ahora mismo (para el bloqueo de caja/avisos), y una misma recepcionista
// puede estar asignada a las dos sucursales a la vez (para que le llegue todo de las dos) — eso hacia que
// French apareciera con "recepcion" y mostrara todos los rubros (bug real, reportado por Ivo). Lo que hace
// falta es el dato fijo de la sucursal (s.recepcion, cargado en French desde el default de la app), no quien
// la atiende hoy.
function rpRubrosSucursal(sucId){ const s=sucursalDe(sucId); return (s&&s.recepcion===false)?['barberia']:rubros.map(r=>r.id); }
// Mejor % de una promo fija para ese rubro en esa sucursal, sin mirar dia/hora (es una vidriera, no el calculo de un cobro puntual)
// y sin contar las que dependen de la profesion del cliente (la reserva publica todavia no la conoce).
function rpMejorFijoRubro(sucId,rubroId){
  let mejor=0;
  (promos.fijos||[]).forEach(f=>{
    if(f.activo===false||f.profesion) return;
    if(f.sucursales&&f.sucursales.length&&!f.sucursales.includes(sucId)) return;
    if(!rubroEn(f.rubro,rubroId)) return;
    if(numV(f.pct)>mejor) mejor=numV(f.pct);
  });
  return mejor;
}
function rpItems(){ return rpState.servicioIds.map(id=>servicios.find(x=>x.id===id)).filter(Boolean); }
function rpCtx(fecha,hora){ return {dia:new Date(fecha+'T00:00:00').getDay(),hora,sucursal:rpState.sucursal,cliente:null,fecha}; }
// Mismo motor de descuentos que "Armar paquete": primero el mejor descuento individual de cada servicio (acá,
// sin cliente ni pago en efectivo, el unico que puede ganar es una promo fija de franja horaria), y recien
// despues el % de paquete (5/10/15%) sobre lo que quede — asi la reserva publica queda integrada de verdad,
// no es una pantalla aparte con su propia cuenta.
function rpCalc(fecha,hora){ return calcPaqueteItems(rpItems(),null,rpCtx(fecha,hora),false); }
function rpTieneOferta(R){ return R.items.some(x=>x.descInd); }
function rpHoldsVivos(){ const ahora=Date.now(); return holdsSt.list.filter(h=>numV(h.expira)>ahora); }
function rpSlotsLibres(profId,fecha){
  const dur=Math.max(AG_PASO,rpDuracion()), pasos=Math.max(1,Math.ceil(dur/AG_PASO));
  const ocupadoMin=new Set();
  agendaSt.list.filter(a=>a.profId===profId&&a.fecha===fecha&&agEstado(a)!=='cancelado').forEach(a=>{
    const ini=agMin(a.hora), d=Math.max(1,Math.ceil((a.duracion||30)/AG_PASO)); for(let i=0;i<d;i++) ocupadoMin.add(ini+i*AG_PASO);
  });
  rpHoldsVivos().filter(h=>h.profId===profId&&h.fecha===fecha&&h.sesionId!==rpSesionId).forEach(h=>{ ocupadoMin.add(agMin(h.hora)); });
  const hoy=hoyStr(), ahoraMin=fecha===hoy?(new Date().getHours()*60+new Date().getMinutes()):-1;
  return agSlots().filter(m=>{
    if(m+dur>AG_FIN) return false;
    for(let i=0;i<pasos;i++) if(ocupadoMin.has(m+i*AG_PASO)) return false;
    if(fecha===hoy&&m<=ahoraMin+30) return false;
    return true;
  });
}
// Crea un hold nuevo (no actualiza el anterior: mas simple, y los vencidos se limpian solos de la lista en cada escritura)
// Si ya hay un hold de esta misma sesion para el mismo profesional/fecha/hora, lo actualiza en vez de duplicarlo
// (asi cuando el cliente pasa de "eligiendo horario" a "mandar WhatsApp" queda UN solo registro al que sumarle
// los datos de la solicitud, no dos holds sueltos apuntando al mismo horario).
async function rpCrearHold(minutos,extra){
  const ahora=Date.now();
  await holdsSt.cambiar(l=>{
    for(let i=l.length-1;i>=0;i--) if(numV(l[i].expira)<=ahora) l.splice(i,1); // limpia vencidos de paso
    const existente=l.find(h=>h.profId===rpState.profId&&h.fecha===rpState.fecha&&h.hora===rpState.hora&&h.sesionId===rpSesionId);
    if(existente){ Object.assign(existente,{expira:ahora+minutos*60000,upd:new Date().toISOString()},extra||{}); }
    else l.push({id:'h'+Date.now().toString(36)+Math.random().toString(36).slice(2,6),profId:rpState.profId,fecha:rpState.fecha,hora:rpState.hora,sesionId:rpSesionId,expira:ahora+minutos*60000,upd:new Date().toISOString(),...(extra||{})});
  });
}
function rpRender(){
  const body=document.getElementById('rp-body');
  ({sucursal:rpRenderSucursal,servicios:rpRenderServicios,profesional:rpRenderProfesional,horario:rpRenderHorario,confirmar:rpRenderConfirmar,gracias:rpRenderGracias}[rpState.paso]||rpRenderSucursal)(body);
}
function rpRenderSucursal(body){
  body.innerHTML=`<div style="font-size:13px;color:var(--muted2);margin-bottom:14px">Elegí la sucursal</div>
    ${sucursales.map(s=>{
      const rbs=rpRubrosSucursal(s.id);
      const filas=rbs.map(rid=>{ const pct=rpMejorFijoRubro(s.id,rid); return `<div style="display:flex;justify-content:space-between;padding:4px 0;font-size:12.5px"><span style="color:var(--muted2)">${escH(nombreRubro(rid)||rid)}</span><span style="font-weight:700;color:${pct?'#34d399':'var(--muted)'}">${pct?'hasta '+pct+'%':'sin promo'}</span></div>`; }).join('');
      return `<div class="card" style="cursor:pointer;margin-bottom:10px;border-left:5px solid ${s.color}" onclick="rpElegirSucursal('${s.id}')">
        <div style="font-size:17px;font-weight:900;margin-bottom:6px">${escH(s.nombre)}</div>
        ${filas||'<div style="font-size:11.5px;color:var(--muted2)">Sin rubros cargados</div>'}
      </div>`;
    }).join('')}
    <div style="font-size:10.5px;color:var(--muted);margin-top:4px">Eligiendo 2 o más servicios juntos (donde haya) sumás además hasta 15% extra por paquete.</div>`;
}
function rpElegirSucursal(id){ rpState.sucursal=id; rpState.servicioIds=[]; rpState.rubroAbierto=null; rpState.paso='servicios'; rpRender(); }
function rpResumenSeleccion(){
  const items=rpItems(); if(!items.length) return '';
  const lista=items.reduce((s,x)=>s+numV(x.precio),0), pct=pctPaquete(items.length), total=Math.round(lista*(1-pct/100));
  return `<div class="card" style="margin-top:14px;background:rgba(74,19,107,.08);border-color:rgba(74,19,107,.3)">
    <div style="font-size:12px;font-weight:800;margin-bottom:4px">${items.length} servicio${items.length===1?'':'s'} elegido${items.length===1?'':'s'}${pct?' · 🎁 '+pct+'% de descuento por paquete':''}</div>
    <div style="font-size:11.5px;color:var(--muted2)">${items.map(x=>escH(x.nombre)).join(', ')}</div>
    <div style="font-size:16px;font-weight:900;margin-top:4px">${fp(total)}${pct?` <span style="font-size:11px;color:var(--muted2);font-weight:600">antes ${fp(lista)}</span>`:''}</div>
    <div style="font-size:10px;color:var(--muted);margin-top:2px">Estimado — el precio final se termina de calcular con el horario que elijas (puede sumar más descuento).</div>
  </div>`;
}
function rpRenderServicios(body){
  const rbs=rpRubrosSucursal(rpState.sucursal);
  if(rbs.length<=1){ rpRenderServiciosDeRubro(body,rbs[0]||null,true); return; }
  if(!rpState.rubroAbierto){
    body.innerHTML=`${rpBackBtn()}<div style="font-size:13px;color:var(--muted2);margin-bottom:14px">¿Qué te querés hacer?</div>
      ${rbs.map(rid=>{
        const L=servicios.filter(s=>(s.rubro||'')===rid), sel=rpState.servicioIds.filter(id=>{ const sv=servicios.find(x=>x.id===id); return sv&&sv.rubro===rid; }).length;
        return `<div class="card" style="cursor:pointer;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center" onclick="rpAbrirRubro('${rid}')"><div><div style="font-size:14px;font-weight:800">${escH(nombreRubro(rid)||rid)}</div><div style="font-size:11px;color:var(--muted2)">${L.length} servicio${L.length===1?'':'s'}${sel?' · '+sel+' elegido'+(sel===1?'':'s'):''}</div></div><span style="color:var(--muted)">›</span></div>`;
      }).join('')}
      ${rpResumenSeleccion()}
      ${rpBotonesSeleccion(false)}`;
    return;
  }
  rpRenderServiciosDeRubro(body,rpState.rubroAbierto,false);
}
function rpAbrirRubro(rid){ rpState.rubroAbierto=rid; rpRender(); }
function rpCerrarRubro(){ rpState.rubroAbierto=null; rpRender(); }
// Que elegir uno solo y listo se sienta tan valido como seguir agregando (pedido de Ivo, ronda 3): una vez que hay
// algo elegido, "Reservar ahora" queda siempre como opcion principal, y "Agregar otro servicio" (volver a los
// rubros) solo aparece cuando de verdad hay a donde volver — en la lista de un solo rubro ya se ve todo, alcanza
// con seguir tildando ahi mismo.
function rpBotonesSeleccion(conAgregarOtroRubro){
  if(!rpState.servicioIds.length) return '';
  return `<div style="display:flex;flex-direction:column;gap:8px;margin-top:14px">
    <button class="btn btn-primary" style="width:100%;margin:0" onclick="rpContinuarServicios()">📅 Reservar ahora</button>
    ${conAgregarOtroRubro?`<button class="btn btn-ghost" style="width:100%;margin:0" onclick="rpCerrarRubro()">+ Agregar otro servicio</button>`:''}
  </div>`;
}
function rpRenderServiciosDeRubro(body,rid,unico){
  const L=servicios.filter(s=>(s.rubro||'')===rid);
  body.innerHTML=`${unico?rpBackBtn():`<button onclick="rpCerrarRubro()" class="lnk" style="margin-bottom:10px">‹ Otros rubros</button>`}
    <div style="font-size:13px;color:var(--muted2);margin-bottom:14px">${unico?'¿Qué te querés hacer? (elegí uno o más)':escH(nombreRubro(rid)||rid)+' — elegí uno o más'}</div>
    ${L.map(s=>`<label class="rub-opt" style="display:flex;justify-content:space-between;align-items:center"><span><input type="checkbox" onchange="rpToggleServicio('${s.id}')" ${rpState.servicioIds.includes(s.id)?'checked':''}/> ${escH(s.nombre)}</span><b>${fp(s.precio)}</b></label>`).join('')||'<div style="font-size:13px;color:var(--muted)">No hay servicios cargados en este rubro.</div>'}
    ${rpResumenSeleccion()}
    ${rpBotonesSeleccion(!unico)}`;
}
function rpToggleServicio(id){ const i=rpState.servicioIds.indexOf(id); if(i>=0) rpState.servicioIds.splice(i,1); else rpState.servicioIds.push(id); rpRender(); }
function rpContinuarServicios(){ if(!rpState.servicioIds.length){ showToast('Elegí al menos un servicio'); return; } rpState.paso='profesional'; rpRender(); }
function rpRenderProfesional(body){
  const rbs=[...new Set(rpItems().map(s=>s.rubro).filter(Boolean))];
  const profs=allUsers.filter(u=>{
    if(!esProf(u)||!sucursalesDe(u).includes(rpState.sucursal)) return false;
    const ru=rubrosDeUsuario(u); return !ru||rbs.every(r=>ru.includes(r));
  });
  body.innerHTML=`${rpBackBtn()}<div style="font-size:13px;color:var(--muted2);margin-bottom:14px">¿Con quién?</div>
    ${profs.length?profs.map(u=>`<div class="card" style="cursor:pointer;margin-bottom:8px;display:flex;align-items:center;gap:10px" onclick="rpElegirProfesional('${u.id}')"><div style="font-size:24px">${escH(u.emoji||'✂️')}</div><div style="font-size:14px;font-weight:800">${escH(u.name)}</div></div>`).join(''):'<div style="font-size:13px;color:var(--muted)">No hay profesionales que hagan todo lo que elegiste en esta sucursal. Probá con menos servicios.</div>'}`;
}
function rpElegirProfesional(id){ rpState.profId=id; rpState.paso='horario'; rpRender(); }
function rpNavDia(n){ rpState.fecha=addDias(rpState.fecha,n); if(rpState.fecha<hoyStr()) rpState.fecha=hoyStr(); rpRender(); }
function rpRenderHorario(body){
  const prof=allUsers.find(u=>u.id===rpState.profId);
  const libres=rpSlotsLibres(rpState.profId,rpState.fecha);
  const d=new Date(rpState.fecha+'T00:00:00');
  const diaTxt=d.toLocaleDateString('es-AR',{weekday:'long',day:'numeric',month:'long'});
  body.innerHTML=`${rpBackBtn()}<div style="font-size:13px;color:var(--muted2);margin-bottom:6px">Con ${escH(prof?prof.name:'')}</div>
    <div style="display:flex;align-items:center;justify-content:center;gap:10px;margin-bottom:14px">
      <button onclick="rpNavDia(-1)" style="background:var(--s2);border:1.5px solid var(--border2);border-radius:10px;width:34px;height:34px;color:var(--text);cursor:pointer">‹</button>
      <span style="font-size:13.5px;font-weight:800;text-transform:capitalize;min-width:180px;text-align:center">${diaTxt}</span>
      <button onclick="rpNavDia(1)" style="background:var(--s2);border:1.5px solid var(--border2);border-radius:10px;width:34px;height:34px;color:var(--text);cursor:pointer">›</button>
    </div>
    ${libres.length?`<div style="font-size:10.5px;color:var(--muted2);margin-bottom:8px;display:flex;gap:14px;flex-wrap:wrap"><span>🟢 con descuento por franja horaria</span>${libres.length<=2?`<span>🔴 quedan pocos lugares</span>`:''}</div><div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(84px,1fr));gap:8px">${libres.map(m=>{
      const hora=agHM(m); const R=rpCalc(rpState.fecha,hora); const conOferta=rpTieneOferta(R); const pocosLugares=!conOferta&&libres.length<=2;
      const color=conOferta?'#34d399':pocosLugares?'#f87171':'var(--border2)';
      const bg=conOferta?'rgba(52,211,153,.1)':pocosLugares?'rgba(248,113,113,.08)':'var(--s2)';
      const txtColor=conOferta?'#34d399':pocosLugares?'#f87171':'var(--muted2)';
      return `<button onclick="rpElegirHorario('${hora}')" style="padding:10px 6px;border-radius:10px;border:1.5px solid ${color};background:${bg};color:var(--text);font-family:var(--font);cursor:pointer;text-align:center">
      <div style="font-size:13px;font-weight:800">${hora}</div><div style="font-size:10.5px;color:${txtColor};font-weight:700">${fp(R.total)}</div>${conOferta?'<div style="font-size:9px;color:#34d399">🎉 desc.</div>':pocosLugares?'<div style="font-size:9px;color:#f87171">🔥 últimos</div>':''}</button>`; }).join('')}</div>`
      :'<div style="text-align:center;color:var(--muted);font-size:13px;padding:30px 0">No hay horarios libres este día. Probá otro día ›</div>'}`;
}
async function rpElegirHorario(hora){
  rpState.hora=hora;
  document.getElementById('rp-body').innerHTML='<div style="text-align:center;padding:40px 0;color:var(--muted2)">Reservando el horario…</div>';
  await rpCrearHold(3);
  if(rpSlotsLibres(rpState.profId,rpState.fecha).includes(agMin(hora))){ rpState.paso='confirmar'; }
  else { showToast('Justo lo tomó otra persona — elegí otro horario'); rpState.paso='horario'; }
  rpRender();
}
function rpRenderConfirmar(body){
  const prof=allUsers.find(u=>u.id===rpState.profId), suc=sucursales.find(x=>x.id===rpState.sucursal);
  const R=rpCalc(rpState.fecha,rpState.hora), tieneOferta=rpTieneOferta(R);
  const pct=numV(promos.senaPublicaPct)||30, montoSena=Math.round(R.total*pct/100);
  body.innerHTML=`${rpBackBtn()}<div class="card" style="margin-bottom:14px">
      <div style="font-size:12.5px;color:var(--muted2)">con ${escH(prof?prof.name:'')} · ${escH(suc?suc.nombre:'')}</div>
      <div style="font-size:12.5px;color:var(--muted2)">${fechaCortaStr(rpState.fecha)} a las ${rpState.hora}hs</div>
      <div style="margin-top:8px">${R.items.map(x=>`<div style="padding:4px 0;border-bottom:1px solid var(--border)"><div style="display:flex;justify-content:space-between;font-size:13px"><span>${escH(x.svc.nombre)}</span><span>${fp(x.lista)}</span></div>${x.descInd?`<div style="display:flex;justify-content:space-between;font-size:11px;color:#34d399"><span>↳ ${escH(x.descInd.label)}</span><span>−${fp(x.descInd.monto)}</span></div>`:''}${x.dq>0?`<div style="display:flex;justify-content:space-between;font-size:11px;color:#a89fff"><span>↳ Descuento por paquete</span><span>−${fp(x.dq)}</span></div>`:''}</div>`).join('')}</div>
      <div style="font-size:20px;font-weight:900;margin-top:8px">${fp(R.total)}${R.total<R.lista?` <span style="font-size:11px;color:#34d399;font-weight:700">(ahorrás ${fp(R.lista-R.total)})</span>`:''}</div>
    </div>
    <div style="font-size:11px;color:var(--muted2);margin:-8px 0 12px">⏳ Te lo reservamos por unos minutos mientras completás esto.</div>
    <div class="field"><label>Tu nombre</label><input id="rp-nombre" placeholder="Nombre y apellido" value="${escH(rpState.nombre)}"/></div>
    <div class="field" style="margin-top:8px"><label>Tu WhatsApp</label><input id="rp-wa" type="tel" placeholder="11 2345 6789" value="${escH(rpState.whatsapp)}"/></div>
    ${tieneOferta?`<div class="card" style="margin-top:12px;border-color:rgba(52,211,153,.4);background:rgba(52,211,153,.06)"><div style="font-size:12.5px;font-weight:800;color:#34d399">💵 Este horario tiene descuento — hace falta dejar una seña</div><div style="font-size:12px;color:var(--muted2);margin-top:3px">Seña obligatoria: <b style="color:var(--text)">${fp(montoSena)}</b> (${pct}% del total). El local te va a pasar el alias de Mercado Pago para transferirla cuando confirme tu turno por WhatsApp.</div></div>`
      :`<div style="font-size:11px;color:var(--muted2);margin-top:10px">Pagás todo en el local cuando vengas. Si no podés venir, avisá con 3 horas de anticipación o se te cobra el turno completo.</div>`}
    <button class="btn btn-primary" style="width:100%;margin-top:14px" onclick="rpEnviarWhatsApp()">📲 Reservar por WhatsApp</button>
    <div style="font-size:11px;color:var(--muted);margin-top:10px;line-height:1.5">Esto no confirma el turno solo: se abre WhatsApp con el pedido armado, y el local te confirma ahí mismo.</div>`;
}
function rpMensajeWhatsApp(){
  const s=rpState, suc=sucursales.find(x=>x.id===s.sucursal), prof=allUsers.find(u=>u.id===s.profId);
  const R=rpCalc(s.fecha,s.hora), tieneOferta=rpTieneOferta(R);
  const nombresSvc=R.items.map(x=>x.svc.nombre).join(', ');
  const pct=numV(promos.senaPublicaPct)||30, montoSena=Math.round(R.total*pct/100);
  const pagoTxt=tieneOferta?('Este horario tiene descuento, así que dejo una seña de '+fp(montoSena)+' ('+pct+'%) — me pasan el alias de Mercado Pago para transferirla.'):'Pago todo en el local cuando vaya.';
  let txt='¡Hola! Quiero reservar un turno 💈\n\n'+
    (suc?'📍 '+suc.nombre+'\n':'')+
    '✂️ '+nombresSvc+'\n'+
    '🧔 Con: '+(prof?prof.name:'')+'\n'+
    '📅 '+fechaCortaStr(s.fecha)+' a las '+s.hora+'hs\n'+
    '💰 Total: '+fp(R.total)+(R.total<R.lista?' (ya con el descuento aplicado)':'')+'\n\n'+
    pagoTxt+'\n\n'+
    'Soy '+s.nombre+' — mi WhatsApp: '+s.whatsapp;
  if(!tieneOferta) txt+='\n\n(Entiendo que si no aviso con 3hs de anticipación que no puedo ir, se me cobra el turno completo.)';
  return txt;
}
async function rpEnviarWhatsApp(){
  const nombre=(document.getElementById('rp-nombre')?.value||'').trim();
  const whatsapp=(document.getElementById('rp-wa')?.value||'').trim();
  if(!nombre){ showToast('Poné tu nombre'); return; }
  if(whatsapp.replace(/\D/g,'').length<8){ showToast('Poné tu WhatsApp con característica'); return; }
  rpState.nombre=nombre; rpState.whatsapp=whatsapp;
  // Pasa de "hold sin datos" a solicitud real: recepcion la ve en el Inicio (no solo por WhatsApp), 15 min para
  // confirmarla o rechazarla antes de que el horario se libere solo (decidido con Ivo, 27/09/2026).
  const R=rpCalc(rpState.fecha,rpState.hora), tieneOferta=rpTieneOferta(R);
  const pctSena=numV(promos.senaPublicaPct)||30;
  await rpCrearHold(15,{estado:'pendiente',clienteNombre:nombre,clienteWhatsapp:whatsapp,servicioIds:[...rpState.servicioIds],sucursal:rpState.sucursal,total:R.total,tieneOferta,montoSena:tieneOferta?Math.round(R.total*pctSena/100):0,creadoEn:new Date().toISOString()});
  const txt=rpMensajeWhatsApp();
  const wa=promos.whatsappNegocio?linkWhatsApp(promos.whatsappNegocio,txt):('https://api.whatsapp.com/send?text='+encodeURIComponent(txt));
  window.open(wa,'_blank');
  rpState.paso='gracias'; rpRender();
}
function rpRenderGracias(body){
  body.innerHTML=`<div style="text-align:center;padding:40px 16px">
    <div style="font-size:44px;margin-bottom:12px">✅</div>
    <div style="font-size:16px;font-weight:800;margin-bottom:8px">¡Listo, ${escH((rpState.nombre||'').split(' ')[0]||'')}!</div>
    <div style="font-size:13px;color:var(--muted2);line-height:1.6">Se abrió WhatsApp con tu pedido. Mandalo y esperá la confirmación del local.</div>
    <button class="btn btn-ghost" style="margin-top:20px" onclick="mostrarReservaPublica()">Hacer otra reserva</button>
  </div>`;
}

// ---------- Cuenta de cliente (login con Google — ver negocio/pendientes-app.md, PRIORIDAD #1 27/09/2026) ----------
// Cuenta publica separada de las cuentas de staff (admin/profesional/recepcionista): se entra con Google,
// se autoaprueba sola con el rol 'cliente' (ver db/04_seguridad_clientes.sql), y se liga a la ficha
// de clientesDir por telefono (Google no da el telefono, se lo pedimos la primera vez). El "regalo" de
// puntos (1 visita de cortesia en la tarjeta) solo se da al CREAR una ficha nueva -- si el telefono ya
// existia (cliente que ya vino antes en persona), se liga esa ficha sin regalo, como pidio Ivo.
let cuentaSesion=null, cuentaClienteActual=null;
async function cuentaCargarDatosBasicos(){
  if(!DB) return;
  try{ const r=await DB.doc('luffy/promos_cfg').get(); if(r) promos=aplicarPromosRemotas(r); }catch(e){}
}
function cuentaTarjetaDefault(){
  return (promos.tarjetas||[]).find(t=>t.activa!==false&&!(t.profs&&t.profs.length))||(promos.tarjetas||[])[0]||null;
}
async function cuentaAsegurarRol(session){
  try{
    const {data}=await supaClient.from('luffy_roles').select('role').eq('uid',session.user.id).maybeSingle();
    if(data&&data.role) return data.role;
  }catch(e){}
  try{ await supaClient.from('luffy_roles').insert({uid:session.user.id, app_id:'cli_'+session.user.id.replace(/-/g,''), role:'cliente'}); }catch(e){}
  return 'cliente';
}
async function cuentaPedirWhatsapp(){
  const v=await uiDialog({title:'Un dato más',msg:'Pasanos tu WhatsApp para asociar tu cuenta a tu ficha en Inda Studio.',fields:[{label:'Tu WhatsApp (con característica)',type:'tel',placeholder:'Ej: 1122334455'}],ok:'Continuar'});
  if(!v) return null;
  const tel=(v[0]||'').trim();
  if(tel.replace(/\D/g,'').length<8){ showToast('Poné un WhatsApp válido'); return cuentaPedirWhatsapp(); }
  return tel;
}
async function cuentaResolverCliente(session){
  await cuentaCargarDatosBasicos();
  if(DB){ try{ mergeClientes(await DB.doc('luffy/clientes').get()); }catch(e){} }
  const ya=clientesDir.find(x=>x.authUid===session.user.id);
  if(ya) return ya;
  // Si el mail de la cuenta de Google ya estaba cargado en una ficha (recepcion lo pide en el mostrador),
  // se liga directo a esa ficha real -- ni pide el WhatsApp de nuevo ni cuenta como cuenta nueva (mismo
  // criterio anti-duplicado que el telefono: sin regalo de bienvenida). Decidido con Ivo, 27/09/2026.
  const miEmail=(session.user.email||'').trim().toLowerCase();
  if(miEmail){
    const porEmail=clientesDir.find(x=>(x.email||'').trim().toLowerCase()===miEmail);
    if(porEmail){
      const res=await cambiarClientes(list=>{
        const x=list.find(c=>c.id===porEmail.id); if(!x) return {cliente:null};
        if(!x.authUid) x.authUid=session.user.id;
        x.upd=new Date().toISOString();
        return {cliente:x,nuevo:false};
      });
      if(res&&res.cliente) return res.cliente;
    }
  }
  const tel=await cuentaPedirWhatsapp();
  if(!tel) return null;
  const telLimpio=tel.replace(/\D/g,'');
  const res=await cambiarClientes(list=>{
    const existente=list.find(x=>(telLimpio&&(x.tel||'').replace(/\D/g,'')===telLimpio)||(miEmail&&(x.email||'').trim().toLowerCase()===miEmail));
    if(existente){
      if(!existente.authUid) existente.authUid=session.user.id;
      if(!existente.email) existente.email=session.user.email||'';
      existente.upd=new Date().toISOString();
      return {cliente:existente,nuevo:false};
    }
    const numero=list.reduce((m,x)=>Math.max(m,numV(x.numero)),0)+1;
    const ahora=new Date().toISOString();
    const meta=session.user.user_metadata||{};
    const nombreGoogle=(meta.full_name||meta.name||(session.user.email||'').split('@')[0]).trim();
    const nuevo={id:'c'+numero+'x'+Date.now().toString(36), numero, nombre:nombreGoogle, nkey:nkey(nombreGoogle), profesion:'', tel, nacimiento:'', email:session.user.email||'', ref:'Cuenta con Google', nota:'', cumple:'', genero:'',
      creadoPor:'cuenta-cliente', creadoPorNombre:'Cuenta de cliente', profs:[], sucursal:null, refPor:null, authUid:session.user.id, tarjetas:[], creado:ahora, upd:ahora};
    const card=cuentaTarjetaDefault();
    if(card){ const t=nuevaTarjetaCliente(card); t.visitas=1; t.regaloCuenta=true; nuevo.tarjetas.push(t); }
    list.push(nuevo);
    return {cliente:nuevo,nuevo:true};
  });
  if(res&&res.cliente){
    if(res.nuevo) showToast('¡Bienvenido/a! Ya tenés 1 visita de regalo en tu tarjeta 🎁');
    return res.cliente;
  }
  return null;
}
async function mostrarCuenta(){
  show('cuenta-cliente');
  const nav=document.getElementById('nav'); if(nav) nav.style.display='none';
  const body=document.getElementById('cuenta-body');
  body.innerHTML='<div style="text-align:center;padding:40px 0;color:var(--muted2)">Cargando…</div>';
  if(!supaClient){ body.innerHTML='<div class="empty"><p>No se pudo conectar.</p></div>'; return; }
  const {data:{session}}=await supaClient.auth.getSession();
  cuentaSesion=session;
  if(!session){ sessionStorage.removeItem('inda_cuenta_flow'); renderCuentaLogin(); return; }
  await cuentaAsegurarRol(session);
  cuentaClienteActual=await cuentaResolverCliente(session);
  sessionStorage.removeItem('inda_cuenta_flow');
  renderCuentaLogueado();
}
function renderCuentaLogin(){
  document.getElementById('cuenta-body').innerHTML=`<div style="text-align:center;padding:50px 16px">
    <div style="font-size:44px;margin-bottom:14px">⭐</div>
    <div style="font-size:18px;font-weight:900;margin-bottom:8px">Tu cuenta en Inda Studio</div>
    <div style="font-size:13px;color:var(--muted2);margin-bottom:24px;line-height:1.6">Entrá para ver tu tarjeta de fidelidad, tus puntos y ofertas exclusivas.</div>
    <button class="btn btn-primary" onclick="cuentaLoginGoogle()">Continuar con Google</button>
  </div>`;
}
async function cuentaLoginGoogle(){
  sessionStorage.setItem('inda_cuenta_flow','1');
  await supaClient.auth.signInWithOAuth({provider:'google',options:{redirectTo:location.origin+location.pathname+'#cuenta'}});
}
// Cada sucursal tiene su propia ficha de Google, asi que su propio link de reseña. Si sabemos en que
// sucursal se atiende el cliente mostramos solo ese; si no (caso comun: se creo la cuenta sola desde
// /#cuenta y todavia no sabemos su sucursal), mostramos los que esten cargados para que elija.
function cuentaLinksResena(c){
  const L=promos.linksResena||{};
  if(c&&c.sucursal&&L[c.sucursal]){ const s=sucursales.find(x=>x.id===c.sucursal); return [{nombre:s?s.nombre:'',url:L[c.sucursal]}]; }
  return sucursales.filter(s=>L[s.id]).map(s=>({nombre:s.nombre,url:L[s.id]}));
}
// Ofertas creadas con el "Creador de ofertas" marcadas como "solo cuenta" (checkbox nuevo, 27/09/2026).
// Es un listado para mostrarle al cliente logueado lo que tiene disponible hoy -- el que de verdad decide si
// se cobra o no en cada cobro puntual sigue siendo reglaAplica() (mira dia/hora/sucursal reales del turno).
function cuentaOfertasExclusivas(){
  const hoy=hoyStr(), dia=new Date().getDay();
  return (promos.fijos||[]).filter(f=>f.soloCuenta&&f.activo!==false
    &&(!f.fechaDesde||hoy>=f.fechaDesde)&&(!f.fechaHasta||hoy<=f.fechaHasta)
    &&(f.cupo==null||numV(f.usos)<numV(f.cupo))
    &&(!f.dias||!f.dias.length||f.dias.includes(dia)));
}
function renderCuentaLogueado(){
  const c=cuentaClienteActual;
  if(!c){ renderCuentaLogin(); return; }
  const links=cuentaLinksResena(c);
  const exclusivas=cuentaOfertasExclusivas();
  document.getElementById('cuenta-body').innerHTML=`
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
      <div style="font-size:15px;font-weight:800">Hola, ${escH((c.nombre||'').split(' ')[0])} 👋</div>
      <button class="lnk" onclick="cuentaCerrarSesion()">Salir</button>
    </div>
    <div class="card" style="margin-bottom:12px">
      <div style="font-size:11px;font-weight:800;color:var(--muted);text-transform:uppercase;letter-spacing:.08em;margin-bottom:8px">⭐ Tus beneficios</div>
      <div class="ln"><span>Por tener cuenta</span><b style="color:#34d399">${CUENTA_DESC_PCT}% siempre activo</b></div>
      <div class="ln"><span>Por dejar reseña en Google</span>${c.resenaGoogle?`<b style="color:#34d399">${RESENA_DESC_PCT}% activo ✓</b>`:`<b style="color:var(--muted2)">sin usar</b>`}</div>
      ${c.resenaGoogle?'':`<div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap">${links.map(l=>`<a class="btn btn-ghost" style="flex:1;min-width:140px;text-align:center" href="${escH(l.url)}" target="_blank" rel="noopener">Dejar reseña${links.length>1?' · '+escH(l.nombre):''}</a>`).join('')}<button class="btn btn-primary" style="flex:1;min-width:140px" onclick="cuentaMarcarResena()">Ya la dejé (+${RESENA_DESC_PCT}%)</button></div>`}
      <div style="font-size:10.5px;color:var(--muted2);margin-top:8px">Se suman entre sí y compiten contra el resto de las ofertas — se te aplica la que más te convenga.</div>
    </div>
    ${exclusivas.length?`<div class="card" style="margin-bottom:12px;border-color:rgba(168,159,255,.4)">
      <div style="font-size:11px;font-weight:800;color:#a89fff;text-transform:uppercase;letter-spacing:.08em;margin-bottom:8px">🔒 Ofertas exclusivas para vos</div>
      ${exclusivas.map(f=>`<div class="ln"><span>${escH(f.nombre)}</span><b style="color:#a89fff">${f.pct}%</b></div>`).join('')}
      <div style="font-size:10.5px;color:var(--muted2);margin-top:8px">Por tener cuenta con nosotros — se aplican solas cuando vengas, compitiendo igual que el resto.</div>
    </div>`:''}
    ${htmlTarjetaCliente(c)||'<div class="empty"><div class="e-icon">⭐</div><p>Todavía no tenés tarjeta activa. Se activa sola en tu próximo turno.</p></div>'}
    <button class="btn btn-ghost" style="margin-top:16px;width:100%" onclick="location.hash='#reserva';location.reload()">📅 Reservar un turno</button>`;
}
async function cuentaMarcarResena(){
  if(!cuentaClienteActual) return;
  const id=cuentaClienteActual.id;
  await cambiarClientes(list=>{
    const x=list.find(c=>c.id===id); if(x){ x.resenaGoogle=true; x.upd=new Date().toISOString(); }
  });
  cuentaClienteActual=clientesDir.find(c=>c.id===id)||cuentaClienteActual;
  showToast('¡Gracias! Ya tenés el 5% activo ⭐');
  renderCuentaLogueado();
}
async function cuentaCerrarSesion(){
  if(supaClient) await supaClient.auth.signOut();
  sessionStorage.removeItem('inda_cuenta_flow');
  location.hash='#cuenta'; location.reload();
}

async function editarMetasSalud(){
  const v=await uiDialog({title:'Metas del medidor de salud',msg:'Con esto se arma el % de "salud" de cada sucursal. Son puntos de partida, ajustalos cuando tengas más datos reales.',fields:[
    {label:'Meta de reagendamiento (% de turnos, últimos 30 días)',type:'number',value:numV(promos.metaReagendamiento)||40},
    {label:'Meta de reseñas (% de turnos, últimos 30 días)',type:'number',value:numV(promos.metaResenas)||20}],ok:'Guardar'});
  if(!v) return;
  promos.metaReagendamiento=numV(v[0])||40; promos.metaResenas=numV(v[1])||20;
  savePromos(); showToast('Metas actualizadas ✓'); abrirPantallaFrench();
}
// Score 0-100 de una sucursal: promedio de reputacion del equipo, % reagendamiento y % reseñas (ultimos 30 dias) contra una meta.
// Sirve para cualquier sucursal, no solo la sin recepcion (para cuando se quiera sumar Diego Laure).
async function saludLocal(sucId){
  const equipo=allUsers.filter(u=>esProf(u)&&sucursalesDe(u).includes(sucId));
  if(DB){
    await Promise.all(equipo.map(u=>Promise.resolve(DB.doc('luffy/dinero_'+u.id).get()).then(r=>{ if(r){ try{ localStorage.setItem('luffy_dinero_'+u.id, JSON.stringify(r)); }catch(e){} } }).catch(()=>{})));
    try{ const r=await DB.doc('luffy/cierres_cobro').get(); if(r&&r.byKey){ cierresData=r; try{localStorage.setItem('luffy_cierres',JSON.stringify(r));}catch(e){} } }catch(e){}
    try{ const r=await DB.doc('luffy/puntos').get(); if(r){ puntosData=r; try{localStorage.setItem('luffy_puntos',JSON.stringify(r));}catch(e){} } }catch(e){}
  }
  const hoy=hoyStr(), desde30=addDias(hoy,-30);
  let turnos30=0, reag30=0;
  let facturadoHoy=0, turnosHoy=0, efectivoHoy=0, mpHoy=0, reagHoy=0;
  const filas=[], porProf={};
  const MEDIO_TXT={efectivo:'💵 Efectivo',mp:'📱 Mercado Pago',tarjeta:'💳 Tarjeta'};
  equipo.forEach(u=>{
    let dd={turnos:[]}; try{ dd=JSON.parse(localStorage.getItem('luffy_dinero_'+u.id)||'{}'); }catch(e){}
    (dd.turnos||[]).forEach(t=>{
      if(t.deudaId) return;
      if((t.sucursal||u.sucursal||sucId)!==sucId) return;
      const reag=!!(t.reag&&t.reag.estado==='si');
      if(t.fecha>=desde30&&t.fecha<=hoy){ turnos30++; if(reag) reag30++; }
      if(t.fecha===hoy){
        const monto=(t.aCobrar!=null?numV(t.aCobrar):numV(t.monto));
        facturadoHoy+=monto; turnosHoy++; if(reag) reagHoy++;
        if(t.medio==='efectivo') efectivoHoy+=monto; else if(t.medio==='mp') mpHoy+=monto;
        const pr=porProf[u.id]=porProf[u.id]||{name:u.name,monto:0,turnos:0}; pr.monto+=monto; pr.turnos++;
        filas.push({ts:t.creadoEn||'', hora:t.horaTurno||'', cliente:t.cliente||'Cliente',
          serv:(t.servicios&&t.servicios.length)?t.servicios.map(nomSvc).join(', '):(t.servicio||'Servicio'),
          monto, medio:t.medio, prof:u.name});
      }
    });
  });
  const cierres30=cierresLista().filter(c=>{
    const p=allUsers.find(x=>x.id===c.profId), suc=c.sucursal||(p&&p.sucursal);
    return suc===sucId&&c.fecha>=desde30&&c.fecha<=hoy;
  });
  const resena30=cierres30.filter(c=>c.r&&c.r.resena==='si').length;
  const resenaHoy=cierres30.filter(c=>c.fecha===hoy&&c.r&&c.r.resena==='si').length;
  const repProm=equipo.length?Math.round(equipo.reduce((s,u)=>s+getReputacion(u.id),0)/equipo.length):100;
  const metaReag=numV(promos.metaReagendamiento)||40, metaResena=numV(promos.metaResenas)||20;
  const pctReag=turnos30?Math.round(reag30/turnos30*100):0, pctResena=turnos30?Math.round(resena30/turnos30*100):0;
  const scoreReag=Math.min(100,Math.round(pctReag/metaReag*100));
  const scoreResena=Math.min(100,Math.round(pctResena/metaResena*100));
  const scoreFinal=Math.round((repProm+scoreReag+scoreResena)/3);
  filas.sort((a,b)=>String(b.ts).localeCompare(String(a.ts)));
  const ranking=Object.values(porProf).sort((a,b)=>b.monto-a.monto);
  return {scoreFinal, repProm, scoreReag, scoreResena, pctReag, pctResena, metaReag, metaResena, turnos30,
    facturadoHoy, turnosHoy, efectivoHoy, mpHoy, reagHoy, resenaHoy, ranking, filas, MEDIO_TXT};
}
function semaforo(score){ return score>=75?'🟢':score>=50?'🟡':'🔴'; }
function colorScore(score){ return score>=75?'#34d399':score>=50?'#fbbf24':'#f472b6'; }
async function renderSaludLocal(sucId){
  const el=document.getElementById('pf-body'); if(!el) return;
  const s=await saludLocal(sucId);
  if(!document.getElementById('pf-body')) return; // se cerró mientras cargaba
  const barra=(label,score,sub)=>`<div style="margin-bottom:10px"><div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px"><span style="color:var(--muted2)">${label}</span><b style="color:${colorScore(score)}">${semaforo(score)} ${score}%</b></div><div style="height:8px;border-radius:4px;background:var(--s3);overflow:hidden"><div style="height:100%;width:${Math.min(100,score)}%;background:${colorScore(score)}"></div></div>${sub?`<div style="font-size:10.5px;color:var(--muted);margin-top:3px">${sub}</div>`:''}</div>`;
  el.innerHTML=`
    <div class="card" style="margin-bottom:14px;text-align:center;background:${colorScore(s.scoreFinal)}14">
      <div style="font-size:11px;font-weight:800;color:var(--muted2);text-transform:uppercase;letter-spacing:.08em">Salud del local</div>
      <div style="font-size:44px;font-weight:900;color:${colorScore(s.scoreFinal)};line-height:1.2">${semaforo(s.scoreFinal)} ${s.scoreFinal}%</div>
      <div style="font-size:11px;color:var(--muted2)">reputación del equipo + reagendamiento y reseñas de los últimos 30 días</div>
    </div>
    <div class="card" style="margin-bottom:14px">
      ${barra('Reputación del equipo',s.repProm)}
      ${barra('Reagendamiento (30 días)',s.scoreReag,s.pctReag+'% de '+s.turnos30+' turnos · meta '+s.metaReag+'%')}
      ${barra('Reseñas (30 días)',s.scoreResena,s.pctResena+'% de '+s.turnos30+' turnos · meta '+s.metaResena+'%')}
    </div>
    <div style="font-size:11px;font-weight:800;color:var(--muted);text-transform:uppercase;letter-spacing:.08em;margin-bottom:8px">Hoy</div>
    <div class="stat-grid" style="grid-template-columns:repeat(2,1fr);margin-bottom:10px">
      <div class="stat-card"><div class="sc-lbl">Facturado</div><div class="sc-val" style="font-size:20px">${fp(s.facturadoHoy)}</div><div class="sc-sub">${s.turnosHoy} turno${s.turnosHoy===1?'':'s'}</div></div>
      <div class="stat-card"><div class="sc-lbl">Reagendaron</div><div class="sc-val" style="font-size:20px">${s.reagHoy}</div><div class="sc-sub">de ${s.turnosHoy} · ${s.resenaHoy} reseña${s.resenaHoy===1?'':'s'}</div></div>
    </div>
    <div class="card" style="margin-bottom:14px;font-size:12px"><div class="ln"><span>💵 Efectivo</span><b>${fp(s.efectivoHoy)}</b></div><div class="ln"><span>📱 Mercado Pago</span><b>${fp(s.mpHoy)}</b></div></div>
    ${s.ranking.length?`<div style="font-size:11px;font-weight:800;color:var(--muted);text-transform:uppercase;letter-spacing:.08em;margin-bottom:8px">🏆 Ranking de hoy</div>
    ${s.ranking.map((r,i)=>`<div class="ln"><span>${['🥇','🥈','🥉'][i]||(i+1)+'°'} ${escH(r.name)} <i style="color:var(--muted)">· ${r.turnos} turno${r.turnos===1?'':'s'}</i></span><b>${fp(r.monto)}</b></div>`).join('')}`:''}
    <div style="font-size:11px;font-weight:800;color:var(--muted);text-transform:uppercase;letter-spacing:.08em;margin:14px 0 8px">Cobros de hoy</div>
    ${s.filas.length?s.filas.map(f=>`<div class="card" style="margin-bottom:6px;padding:10px 12px"><div style="display:flex;justify-content:space-between;gap:8px;align-items:baseline"><b style="font-size:13.5px">${escH(f.cliente)}</b><b style="font-size:13.5px">${fp(f.monto)}</b></div><div style="font-size:11.5px;color:var(--muted2);margin-top:2px">${escH(f.serv)}</div><div style="font-size:11px;color:var(--muted2);margin-top:3px">✂️ ${escH(f.prof)} · ${s.MEDIO_TXT[f.medio]||f.medio||'—'}${f.hora?' · '+escH(f.hora):''}</div></div>`).join(''):'<div class="empty"><div class="e-icon">📋</div><p>Todavía no hay cobros hoy.</p></div>'}
    <div style="font-size:10.5px;color:var(--muted);text-align:center;margin-top:6px">Se actualiza sola</div>`;
}

// ---------- guia rapida ("consejo 1 de N") ----------
const GUIAS={
  profesional:[
    {e:'👋',t:'Bienvenido/a a Inda App',x:'Acá tenés tu día a día en un solo lugar: cobros, plata, contenido y puntos. Estos consejos te muestran cómo usarlo. Podés saltearlos y volver a verlos cuando quieras desde el menú ☰ → Guía rápida.'},
    {e:'➕',t:'Cobrar un turno',x:'En el Inicio tocá "+ Registrar turno". Elegí qué le hiciste, si tiene una oferta, si se llevó algún producto y cómo pagó. El total se arma solo y recepción lo ve al instante para cobrarle.'},
    {e:'✨',t:'Combos y descuentos automáticos',x:'Si elegís Corte + Barba se cobra el precio del combo sin que hagas nada. Pagando en efectivo hay 10% de descuento en los servicios (si el cliente además tiene una oferta, se aplica la que más descuenta). En la barba elegís el largo.'},
    {e:'👥',t:'Tus clientes',x:'Desde el menú ☰ → Mis clientes armás tu propia base: al cobrar un turno escribí el nombre y el cliente se guarda solo con su número (#). Ahí ves cuántas veces vino, cada cuánto y todo lo que se hizo en cada visita.'},
    {e:'⏳',t:'Cuando el cliente paga después',x:'Elegí "Paga después" como medio de pago y poné su nombre. Queda anotado en rojo y NO suma a tu quincena hasta que pague. El día que pague, recepción le cobra y suma a la quincena de ese día (vos no cobrás deudas desde la app).'},
    {e:'📦',t:'Vender productos',x:'Los productos se cargan en el mismo cobro con los botones + y −. Tu comisión por productos va aparte de la de los cortes, y el stock se descuenta solo.'},
    {e:'🪙',t:'Mi dinero',x:'Ahí ves tu facturación, tu comisión, los productos y el efectivo/Mercado Pago de la quincena. Tocá cualquier tarjeta para ver el detalle, y usá ‹ › para ver quincenas anteriores.'},
    {e:'📱',t:'Historias del día',x:'Marcá las historias que vas publicando. Cada una suma +5 puntos, y el admin ve cómo va cada uno del equipo.'},
    {e:'📝',t:'Banco de reels',x:'Elegí un reel del banco, mirá todo el detalle (con el link de inspiración) y decidí si lo tomás. Pasa a tu Tablero con un plazo: a tiempo suma +50 ⭐, si no llegás resta −50 y te toca una prenda.'},
    {e:'🏆',t:'Puntos y premios',x:'Tus puntos salen de historias, reels y otras acciones. En Mis puntos ves el ranking del equipo y podés canjearlos por premios.'},
    {e:'🎬',t:'Tu perfil y tu contenido',x:'En el menú ☰ → Mi perfil podés cambiar tus rubros (ves solo los servicios de lo que hacés). Y en la sección Contenido armás tu nicho y tus pilares con nuestro onboarding, cuando quieras. También podés cambiar a modo claro u oscuro desde el menú.'},
  ],
  recepcionista:[
    {e:'👋',t:'Bienvenida a Inda App',x:'Esta es tu pantalla de trabajo. Estos consejos te muestran cómo usarla; podés saltearlos y volver a verlos desde el menú ☰ → Guía rápida.'},
    {e:'🔔',t:'Para cobrar',x:'Cuando un profesional termina un turno te aparece acá con todo el detalle: sucursal (con su color), profesional, cliente, qué se hizo, el descuento, los productos y cómo paga. Tocá "Abrir turno" para cobrarlo. Las deudas también las cobrás vos: los profesionales solo las anotan.'},
    {e:'✅',t:'Al cerrar cada turno',x:'Te vamos guiando con unas preguntas: si está agendado, si le contaste los beneficios de seguir viniendo, si reagendó, si dejó seña y si dejó reseña en Google (esa suma puntos). Así no se olvida nada.'},
    {e:'🚫',t:'Clientes que deben',x:'Si un cliente se fue sin pagar, aparece en "Clientes que deben" con quién lo dejó y hace cuánto. Cuando pague, tocá Cobrar: suma a la quincena del profesional del día en que pagó.'},
    {e:'📋',t:'Tareas del día',x:'Tu lista de tareas (limpieza, caja, etc.). Tocá cada una para tildarla.'},
    {e:'💰',t:'Ventas',x:'Vendé productos con el botón "+ Venta": ganás la comisión de cada producto y el stock se descuenta solo. Ves lo vendido de hoy y tu comisión de la quincena.'},
    {e:'🎂',t:'Cumpleaños e incidentes',x:'Te avisamos los cumpleaños de los próximos días para contactar a los clientes (suma puntos). Y si pasa algo con un profesional, lo reportás desde "Reportar incidente". Modo claro/oscuro en el menú ☰.'},
  ],
  encargado:[
    {e:'👋',t:'Bienvenido/a a Inda App',x:'Acá controlás el stock de los productos. Podés volver a ver estos consejos desde el menú ☰ → Guía rápida.'},
    {e:'📦',t:'El stock baja solo',x:'Cada venta que hacen los profesionales o recepción descuenta las unidades automáticamente, así que el número que ves es el real.'},
    {e:'⚠️',t:'Alertas de poco stock',x:'Cuando un producto llega al mínimo que definió el admin, se marca en rojo para que repongas a tiempo.'},
    {e:'➕',t:'Reponer',x:'Cuando llegan productos, tocá "Reponer" en el producto y poné cuántas unidades sumaste. Solo podés tocar cantidades, no precios.'},
  ],
  admin:[
    {e:'👋',t:'Bienvenido al panel',x:'Desde acá ves y manejás todo el negocio. Podés volver a ver estos consejos desde el menú ☰ → Guía rápida.'},
    {e:'📊',t:'El Panel',x:'Facturación, lo que queda al local, comisiones, ganancia y stock, con comparación contra el período anterior. Filtrá por período o por persona, y tocá los gráficos para ver el detalle.'},
    {e:'👥',t:'Equipo y cuentas nuevas',x:'En Equipo → Estado ves cómo va cada uno. Las cuentas nuevas quedan esperando tu aprobación ahí mismo: podés aprobarlas y elegir su rol, o rechazarlas.'},
    {e:'🏷️',t:'Catálogo',x:'Cargá servicios por rubro, combos con precio propio, ofertas y productos con su stock. Cada profesional ve solo lo de sus rubros.'},
    {e:'📝',t:'Contenido y reglas de reels',x:'Cargá reels de a uno o en masa desde una planilla. En Reglas y prendas definís el plazo, los puntos y las prendas por no cumplir.'},
    {e:'💵',t:'Deudas y cobros',x:'En el Panel ves los clientes que no pagaron: podés cobrarlos o anularlos si no se van a cobrar. Modo claro/oscuro y cambio de contraseña, en el menú ☰.'},
  ],
};
let guiaEstado={lista:[],i:0,inicial:false};
function claveGuia(){ return 'luffy_guia_'+((profile&&profile.id)||''); }
function guiaInicial(){
  if(!profile) return;
  if(profile.role==='profesional'&&!(profile.rubros&&profile.rubros.length)) return; // primero eligen sus rubros
  let vista=false; try{ vista=!!localStorage.getItem(claveGuia()); }catch(e){}
  if(vista) return;
  if(!['hub','recepcion','encargado','admin'].includes(currentScreenId)) return;
  abrirGuia(false);
}
function abrirGuia(manual){
  const lista=GUIAS[(profile&&profile.role)||'profesional']||GUIAS.profesional;
  guiaEstado={lista,i:0,inicial:!manual};
  renderGuia();
  document.getElementById('guia-ov').classList.add('open');
}
function renderGuia(){
  const {lista,i}=guiaEstado, g=lista[i], ult=i===lista.length-1;
  document.getElementById('guia-cnt').innerHTML=`
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px"><span style="font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--muted2)">Consejo ${i+1} de ${lista.length}</span><button onclick="cerrarGuia()" style="margin-left:auto;background:none;border:none;color:var(--muted);font-family:var(--font);font-size:12px;font-weight:700;cursor:pointer">Saltar</button></div>
    <div style="height:4px;background:var(--s3);border-radius:2px;overflow:hidden;margin-bottom:20px"><div style="height:100%;width:${Math.round((i+1)/lista.length*100)}%;background:var(--accent);border-radius:2px;transition:width .25s"></div></div>
    <div style="font-size:44px;text-align:center;margin-bottom:10px">${g.e}</div>
    <div style="font-size:19px;font-weight:900;text-align:center;margin-bottom:10px">${g.t}</div>
    <div style="font-size:13.5px;line-height:1.65;color:var(--muted2);text-align:center;margin-bottom:22px;min-height:88px">${g.x}</div>
    <div style="display:flex;gap:8px">
      ${i>0?`<button class="ui-b ghost" onclick="guiaPaso(-1)" style="flex:1">← Anterior</button>`:''}
      <button class="ui-b" onclick="${ult?'cerrarGuia()':'guiaPaso(1)'}" style="flex:2">${ult?'¡Listo!':'Siguiente →'}</button>
    </div>`;
}
function guiaPaso(d){ guiaEstado.i=Math.max(0,Math.min(guiaEstado.lista.length-1,guiaEstado.i+d)); renderGuia(); }
function cerrarGuia(){
  document.getElementById('guia-ov').classList.remove('open');
  try{ localStorage.setItem(claveGuia(),'1'); }catch(e){}
}

// ============ RECEPCION: CIERRE DE TURNO (preguntas al cobrar) ============
// Cada rubro tiene su forma de fidelizar y vender. Estos textos son el punto de partida.
const FIDELIZACION_RUBRO={
  'barberia':'¿Le contaste los beneficios de seguir viniendo (cada 2 o 3 semanas) y, si corresponde, el paquete?',
  'barberia-premium':'¿Le contaste los beneficios de seguir viniendo y de sumar la experiencia completa (barba, limpieza facial)?',
  'peluqueria':'¿Le recomendaste el cuidado en casa y le contaste cuándo conviene volver (retoque o mantenimiento)?',
  'cosmetologia':'¿Le explicaste que los resultados llegan con un plan de sesiones y le ofreciste el paquete?',
  'cejas':'¿Le contaste cada cuánto conviene mantener el diseño y le ofreciste el próximo turno?',
  'podologia':'¿Le explicaste por qué conviene venir seguido para el mantenimiento y le ofreciste el próximo turno?',
  'masajes':'¿Le contaste los beneficios de hacerlo seguido y le ofreciste el paquete de sesiones?',
  'manos':'¿Le contaste que el mantenimiento es cada 15 o 20 días y le ofreciste el próximo turno?',
};
const FIDELIZACION_DEFAULT='¿Le contaste los beneficios de seguir viniendo?';
const ptsReag=()=>ptsDe('reagendamiento',5), ptsResena=()=>ptsDe('resena',5);

let cierresData={byKey:{}};
function loadCierres(){
  try{ cierresData=JSON.parse(localStorage.getItem('luffy_cierres')||'{"byKey":{}}'); }catch(e){ cierresData={byKey:{}}; }
  if(!cierresData.byKey) cierresData.byKey={};
  if(DB){
    DB.doc('luffy/cierres_cobro').get().then(r=>{
      if(r&&r.byKey&&JSON.stringify(r.byKey)!==JSON.stringify(cierresData.byKey)){ cierresData=r; try{localStorage.setItem('luffy_cierres',JSON.stringify(cierresData));}catch(e){} refreshCurrentView(); }
    }).catch(()=>{});
  }
}
// Lee la version mas fresca y agrega solo este cierre, asi nadie pisa el cierre de otra persona
async function guardarCierreRemoto(reg){
  let base={byKey:{}};
  if(DB){ try{ const r=await DB.doc('luffy/cierres_cobro').get(); if(r&&r.byKey) base=r; }catch(e){} }
  base.byKey[reg.key]=reg; cierresData=base;
  try{localStorage.setItem('luffy_cierres',JSON.stringify(cierresData));}catch(e){}
  if(DB){ try{ await DB.doc('luffy/cierres_cobro').set(base); }catch(e){} }
}
function cierresLista(){ let d={byKey:{}}; try{ d=JSON.parse(localStorage.getItem('luffy_cierres')||'{"byKey":{}}'); }catch(e){} return Object.values(d.byKey||{}); }

// Rubro(s) del turno: el de los servicios cobrados; si no se puede saber, los del profesional
function rubrosDelTurno(a){
  const ids=new Set();
  ((a.turno&&a.turno.servicios)||[]).forEach(s=>{
    const sv=servicios.find(x=>x.id===s.id); if(sv&&sv.rubro) ids.add(sv.rubro);
    const cb=combos.find(x=>x.id===s.id); if(cb&&cb.rubro) ids.add(cb.rubro);
  });
  if(!ids.size) ((a.prof&&a.prof.rubros)||[]).forEach(r=>ids.add(r));
  return [...ids];
}
function preguntasCierre(a){
  const rb=rubrosDelTurno(a);
  return [
    {id:'agendado',ico:'📅',q:'¿Está agendado para su próximo turno?'},
    {id:'fideliza',ico:'💬',q:FIDELIZACION_RUBRO[rb[0]]||FIDELIZACION_DEFAULT},
    {id:'reagendo',ico:'🔁',q:'¿Reagendó el cliente?',nota:'Suma +'+ptsReag()+' puntos ⭐'},
    {id:'sena',ico:'💵',q:'¿Dejó seña?'},
    {id:'resena',ico:'⭐',q:'¿Dejó una reseña en Google?',nota:'Suma +'+ptsResena()+' puntos ⭐'},
  ];
}

let cierreSel=null;
async function abrirCierreCobro(key){
  const a=getAvisosPendientes().find(x=>x.key===key);
  if(!a||a.tipo!=='turno'){ showToast('Ese turno ya no está'); return; }
  if(!await cajaOkParaCobrar(a.turno.sucursal||a.prof.sucursal)) return;
  cierreSel={key,r:{},senaMonto:'',senaMedio:'efectivo',senaProf:a.prof.id};
  if(a.turno.reag&&a.turno.reag.estado==='si') cierreSel.r.reagendo='si'; // el profesional ya lo reagendo
  renderCierre(); openModal('modal-registro');
}
function cierreResp(id,v){ cierreSel.r[id]=v; renderCierre(); }
function renderCierre(){
  const s=cierreSel; if(!s) return;
  const a=getAvisosPendientes().find(x=>x.key===s.key); if(!a){ closeModal('modal-registro'); return; }
  const t=a.turno, extras=a.extras||[];
  const total=numV(t.aCobrar!=null?t.aCobrar:t.monto)+extras.reduce((x,e)=>x+numV(e.total),0);
  const medio=({efectivo:'💵 Efectivo',mp:'📱 Mercado Pago',tarjeta:'💳 Tarjeta'}[t.medio]||t.medio||'');
  const pregs=preguntasCierre(a);
  const listos=pregs.every(p=>s.r[p.id]);
  const c=document.getElementById('registro-content');
  const box=document.querySelector('#modal-registro .modal-box'); const st=box?box.scrollTop:0;
  const opt=(id,v,l)=>{ const sel=s.r[id]===v; const col=v==='si'?'#34d399':'#f472b6'; return `<button onclick="cierreResp('${id}','${v}')" style="flex:1;padding:11px;border-radius:12px;border:1.5px solid ${sel?col:'var(--border2)'};background:${sel?col+'22':'transparent'};color:${sel?col:'var(--muted2)'};font-family:var(--font);font-size:14px;font-weight:800;cursor:pointer">${l}</button>`; };
  c.innerHTML=`<div style="display:flex;align-items:center;gap:8px;margin-bottom:12px"><div class="modal-title" style="margin:0">Cerrar turno</div><button onclick="closeModal('modal-registro')" style="margin-left:auto;background:var(--s3);border:none;color:var(--muted2);font-size:18px;width:32px;height:32px;border-radius:50%;cursor:pointer">×</button></div>
    <div class="card" style="margin-bottom:14px;border-color:rgba(251,191,36,.35);background:rgba(251,191,36,.06)">
      <div style="margin-bottom:4px">${chipSucursal(t.sucursal||a.prof.sucursal,true)}</div>
      <div style="font-size:15px;font-weight:800">Cliente: ${escH(t.cliente||'Cliente')}${t.clienteNumero?' #'+t.clienteNumero:''}</div>
      <div style="font-size:11.5px;color:var(--muted2);margin-bottom:6px">Profesional: ${escH(a.prof.name)} · ${escH(t.servicio||'')}${extras.length?' + '+extras.map(e=>escH(e.productoNombre)).join(', '):''}</div>
      ${htmlDatosClienteRec(t,true)}
      <div style="display:flex;justify-content:space-between;align-items:baseline;border-top:1px solid var(--border2);padding-top:6px"><span style="font-size:12px;font-weight:700">COBRAR${medio?' · '+medio:''}</span><span style="font-size:22px;font-weight:900">${fp(total)}</span></div>
    </div>
    ${pregs.map((p,i)=>`<div style="margin-bottom:14px">
      <div style="font-size:13.5px;font-weight:700;line-height:1.45;margin-bottom:8px">${i+1}. ${p.ico} ${escH(p.q)}${p.nota?` <span style="font-size:11px;font-weight:700;color:#fbbf24">· ${p.nota}</span>`:''}</div>
      <div style="display:flex;gap:8px">${opt(p.id,'si','Sí')}${opt(p.id,'no','No')}</div>
      ${p.id==='reagendo'&&t.reag?`<div style="font-size:11.5px;color:#60a5fa;margin-top:6px">El profesional marcó: ${escH((REAG_OPC.find(o=>o[0]===t.reag.estado)||[0,t.reag.estado])[1])}${t.reag.motivo?' — «'+escH(t.reag.motivo)+'»':''}</div>`:''}
      ${p.id==='sena'&&s.r.sena==='si'?`<div style="margin-top:8px;padding:10px 12px;border:1.5px solid rgba(74,19,107,.4);border-radius:12px;background:rgba(74,19,107,.06)"><input type="number" inputmode="decimal" placeholder="¿De cuánto es la seña?" value="${escH(s.senaMonto)}" oninput="cierreSel.senaMonto=this.value" style="width:100%;background:var(--s2);border:1.5px solid var(--border2);border-radius:12px;padding:11px 14px;color:var(--text);font-family:var(--font);font-size:14px;outline:none"/><div style="display:flex;gap:6px;margin-top:8px">${[['efectivo','💵 Efectivo'],['mp','📱 MP'],['tarjeta','💳 Tarjeta']].map(([v,l])=>`<button onclick="cierreSel.senaMedio='${v}';renderCierre()" style="flex:1;${pillStyle(s.senaMedio===v,'#4A136B')}">${l}</button>`).join('')}</div><select onchange="cierreSel.senaProf=this.value" style="${selFin};margin-top:8px">${profesionalesLista().map(u=>`<option value="${u.id}" ${s.senaProf===u.id?'selected':''}>Turno con ${escH(u.name)}</option>`).join('')}</select><div style="font-size:11px;color:var(--muted2);margin-top:6px">Queda a nombre de ${escH((a.turno&&a.turno.cliente)||'el cliente')} y se le descuenta sola en su próximo turno.</div></div>`:''}
    </div>`).join('')}
    <button class="btn btn-primary" onclick="guardarCierreCobro()" style="background:${listos?'#34d399':'var(--s3)'};color:${listos?'#0b0b10':'var(--muted2)'};margin-top:4px">${listos?'✓ Cobrado y turno cerrado':'Respondé las 5 preguntas para cerrar'}</button>`;
  if(box) box.scrollTop=st;
}
async function guardarCierreCobro(){
  const s=cierreSel; if(!s) return;
  const a=getAvisosPendientes().find(x=>x.key===s.key); if(!a){ closeModal('modal-registro'); return; }
  const pregs=preguntasCierre(a);
  if(!pregs.every(p=>s.r[p.id])){ showToast('Falta responder alguna pregunta'); return; }
  const t=a.turno, extras=a.extras||[];
  if(s.r.sena==='si'&&!(numV(s.senaMonto)>0)){ showToast('Poné el monto de la seña'); return; }
  const reg={key:s.key, fecha:hoyStr(), ts:new Date().toISOString(), por:profile.name, porId:profile.id,
    cliente:t.cliente||'Cliente', prof:a.prof.name, profId:a.prof.id, rubro:rubrosDelTurno(a).join(','),
    monto:numV(t.aCobrar!=null?t.aCobrar:t.monto)+extras.reduce((x,e)=>x+numV(e.total),0), turnoTs:t.creadoEn, sucursal:t.sucursal||a.prof.sucursal||null, r:{...s.r}, senaMonto:s.r.sena==='si'?(parseFloat(s.senaMonto)||0):0};
  await guardarCierreRemoto(reg);
  if(s.r.sena==='si'){
    const cliS=clienteDe(t.clienteId)||clientesDir.find(x=>x.nkey===nkey(t.cliente||''));
    const profS=allUsers.find(u=>u.id===(s.senaProf||a.prof.id))||a.prof;
    await crearSena({cli:cliS,prof:profS,monto:numV(s.senaMonto),medio:s.senaMedio||'efectivo',idFijo:'sn'+String(s.key).replace(/[^a-z0-9]/gi,''),nombreCliente:t.cliente});
  }
  let pts=0;
  if(s.r.reagendo==='si'&&!(t.reag&&t.reag.estado==='si')&&!(profile.role==='profesional')){ addPuntos(profile.id,'reagendamiento',ptsReag(),'Reagendamiento: '+reg.cliente,'reag:'+s.key); pts+=ptsReag(); }
  if(s.r.resena==='si'){ addPuntos(profile.id,'resena',ptsResena(),'Reseña en Google: '+reg.cliente,'resena:'+s.key); pts+=ptsResena(); }
  if(!avisosLeidos.includes(s.key)) avisosLeidos.push(s.key);
  saveAvisosLeidos();
  cierreSel=null; closeModal('modal-registro');
  showToast('Turno cerrado ✓'+(pts?' +'+pts+' puntos ⭐':''));
  if(profile.role==='recepcionista') renderRecepcion(); else refreshCurrentView();
}

// ---------- panel del admin: como viene el cierre de turnos ----------
function htmlCierresPanel(desde,hasta,profId){
  const L=cierresLista().filter(c=>c.fecha>=desde&&c.fecha<=hasta&&coincideProf(allUsers.find(u=>u.id===c.profId),profId));
  const n=L.length, pc=(k)=>n?Math.round(L.filter(c=>c.r[k]==='si').length/n*100):0;
  const senas=L.filter(c=>c.r.sena==='si'), senaTot=senas.reduce((s,c)=>s+numV(c.senaMonto),0);
  const resenas=L.filter(c=>c.r.resena==='si').sort((a,b)=>String(b.ts).localeCompare(String(a.ts)));
  const fila=(l,v,sub)=>`<div class="ln"><span>${l}</span><span><b>${v}</b>${sub?` <span style="color:var(--muted);font-size:10.5px">${sub}</span>`:''}</span></div>`;
  const cierre=n?`${fila('📅 Quedaron agendados',pc('agendado')+'%',L.filter(c=>c.r.agendado==='si').length+' de '+n)}
    ${fila('💬 Se les contó de seguir viniendo',pc('fideliza')+'%',L.filter(c=>c.r.fideliza==='si').length+' de '+n)}
    ${fila('🔁 Reagendaron',pc('reagendo')+'%',L.filter(c=>c.r.reagendo==='si').length+' de '+n)}
    ${fila('💵 Dejaron seña',senas.length+(senas.length?' · '+fp(senaTot):''),pc('sena')+'%')}
    ${fila('⭐ Reseñas en Google (declaradas)',resenas.length,pc('resena')+'%')}`:'';
  return {cierre, resenas, n};
}

// ============ AVISO DE VERSION NUEVA ============
// La sesion queda guardada, asi que un celular puede seguir semanas con codigo viejo.
// Cada tanto se compara la pagina publicada con la que se cargo y, si cambio, se avisa (sin recargar sola, para no perder lo que se este haciendo).
let sigVersion=null;
function firmaTexto(t){ let x=5381; for(let i=0;i<t.length;i++) x=((x<<5)+x+t.charCodeAt(i))|0; return x+':'+t.length; }
async function chequearVersion(){
  try{
    // el codigo vive repartido en js/*.js (ver index.html) -- hay que hashear todo eso, no solo el html
    const rutas=[location.pathname,...Array.from(document.querySelectorAll('script[src^="js/"]')).map(s=>s.getAttribute('src'))];
    const textos=await Promise.all(rutas.map(async p=>{
      const r=await fetch(p+(p.includes('?')?'&':'?')+'_v='+Date.now(),{cache:'no-store'});
      return r.ok?await r.text():'';
    }));
    const sig=firmaTexto(textos.join('\u0000'));
    if(sigVersion===null){ sigVersion=sig; return; }
    if(sig!==sigVersion) mostrarAvisoVersion();
  }catch(e){}
}
function mostrarAvisoVersion(){
  if(document.getElementById('ver-nueva')) return;
  const d=document.createElement('div'); d.id='ver-nueva';
  const s=document.createElement('span'); s.textContent='🔄 Hay una versión nueva de la app';
  const b=document.createElement('button'); b.textContent='Actualizar'; b.onclick=()=>location.reload();
  d.appendChild(s); d.appendChild(b); document.body.appendChild(d);
}
chequearVersion();
setInterval(chequearVersion, 5*60*1000);
document.addEventListener('visibilitychange',()=>{ if(!document.hidden) chequearVersion(); });

// ============ START ============
init();
