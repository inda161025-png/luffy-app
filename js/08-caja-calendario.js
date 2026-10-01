// ============ CAJA DE RECEPCION: apertura, movimientos y cierre ============
// Igual que la planilla "Caja chica": se abre con el saldo en efectivo y en cuenta (Mercado Pago / banco), durante el turno
// entran solos los cobros y se anotan a mano las salidas (proveedores, cafe, retiros), y al cerrar se cuenta lo que hay.
// El saldo con el que cierra una caja es el de apertura de la siguiente.
let cajaDocs={};
// Cada salida de caja tiene que quedar con un destino claro — reemplaza el "Retiro" generico
// que se comia $8,1M sin explicar en Agosto-Septiembre. Los "interno" (gasto:false) no bajan el
// margen pero quedan anotados en Finanzas > Balance > "Movimientos internos", con detalle obligatorio.
const CONCEPTOS_CAJA=[
  {id:'proveedor',n:'Pago a proveedor / insumos',tipo:'salida',cat:'insumos',gasto:true},
  {id:'cafe',n:'Café y cafetería',tipo:'salida',cat:'cafeteria',gasto:true},
  {id:'limpieza',n:'Limpieza',tipo:'salida',cat:'limpieza',gasto:true},
  {id:'otro_gasto',n:'Otro gasto',tipo:'salida',cat:'otros',gasto:true},
  {id:'fijo',n:'Pago de gasto fijo (alquiler, sueldo, luz…)',tipo:'salida',gasto:false},
  {id:'reinversion',n:'Reinversión (equipamiento, mejoras, obra)',tipo:'salida',cat:'reinversion',gasto:true,pedirDetalle:true},
  {id:'adelanto',n:'Adelanto a un profesional',tipo:'salida',gasto:false,interno:'adelanto',pedirDetalle:true,detalleLabel:'¿A quién?'},
  {id:'liquidacion',n:'Pago de liquidación/comisión',tipo:'salida',gasto:false,interno:'liquidacion',pedirDetalle:true,detalleLabel:'¿A quién?'},
  {id:'retiro',n:'Retiro de un socio',tipo:'salida',gasto:false,interno:'retiro_socio',pedirDetalle:true,detalleLabel:'¿Qué socio?'},
  {id:'devolucion',n:'Devolución de seña o a un cliente',tipo:'salida',gasto:false,interno:'devolucion',pedirDetalle:true,detalleLabel:'¿A quién?'},
  {id:'pago_deuda',n:'Pago de una deuda',tipo:'salida',gasto:false,interno:'pago_deuda',pedirDetalle:true,detalleLabel:'¿A quién se le pagó?'},
  {id:'deposito',n:'Depósito: del efectivo a la cuenta',tipo:'traspaso',gasto:false,interno:'traspaso'},
  {id:'ingreso_extra',n:'Ingreso extra',tipo:'entrada',gasto:false},
];
const ymHoy=()=>hoyStr().slice(0,7);
const ymPrev=()=>{ const [y,m]=hoyStr().split('-').map(Number); return m===1?(y-1)+'-12':y+'-'+pad2(m-1); };
const persistCaja=(ym)=>{ try{ localStorage.setItem('luffy_caja_'+ym,JSON.stringify(cajaDocs[ym])); }catch(e){} };
function unirSesion(a,b){
  const base=String(b.upd||'')>String(a.upd||'')?b:a; const m=new Map();
  [...(a.movs||[]),...(b.movs||[])].forEach(x=>{ const p=m.get(x.id); m.set(x.id,(p&&p.borrado)?p:x); });
  return {...base,movs:[...m.values()]};
}
function mergeCajaDoc(ym,remote){
  if(!remote||!Array.isArray(remote.sesiones)) return false;
  const cur=cajaDocs[ym]||{sesiones:[]}; const antes=JSON.stringify(cur); const m=new Map(cur.sesiones.map(s=>[s.id,s]));
  remote.sesiones.forEach(r=>{ const l=m.get(r.id); m.set(r.id,l?unirSesion(l,r):r); });
  cajaDocs[ym]={sesiones:[...m.values()]}; return antes!==JSON.stringify(cajaDocs[ym]);
}
function loadCaja(){
  if(!profile||!['recepcionista','admin'].includes(profile.role)) return;
  [ymHoy(),ymPrev()].forEach(ym=>{
    try{ cajaDocs[ym]=JSON.parse(localStorage.getItem('luffy_caja_'+ym)||'{"sesiones":[]}'); }catch(e){ cajaDocs[ym]={sesiones:[]}; }
    if(DB) DB.doc('luffy/caja_'+ym).get().then(r=>{ if(mergeCajaDoc(ym,r)){ persistCaja(ym); refreshCurrentView(); } }).catch(()=>{});
  });
}
async function cambiarCaja(ym,fn){
  if(DB){ try{ mergeCajaDoc(ym,await DB.doc('luffy/caja_'+ym).get()); }catch(e){} }
  if(!cajaDocs[ym]) cajaDocs[ym]={sesiones:[]};
  const res=fn(cajaDocs[ym].sesiones); persistCaja(ym);
  if(DB){ try{ await DB.doc('luffy/caja_'+ym).set(cajaDocs[ym]); }catch(e){ showToast('Se guardó en este dispositivo; falta conexión para subirlo'); } }
  return res;
}
const todasSesiones=()=>Object.values(cajaDocs).flatMap(d=>d.sesiones).sort((a,b)=>String(a.apertura.ts).localeCompare(String(b.apertura.ts)));
const sesionAbierta=()=>todasSesiones().filter(s=>!s.cierre).pop()||null;
const ultimoCierre=()=>{ const c=todasSesiones().filter(s=>s.cierre).pop(); return c?c.cierre:null; };
const movsVivos=(s)=>(s.movs||[]).filter(m=>!m.borrado);

// Lo que entro solo durante la caja: cobros de cada profesional (por medio) y membresias/paquetes vendidos
const enCajaSuc=(s,sid)=>(s.sucursales&&s.sucursales.length)?s.sucursales.includes(sid):sucursalConRecepcion(sid);
function cajaAuto(s){
  const prev=todasSesiones().filter(x=>x.cierre&&String(x.apertura.ts)<String(s.apertura.ts)).pop();
  // lo cobrado desde que cerro la caja anterior (aunque haya sido de noche o con la caja cerrada) entra en la caja que se abre
  const desde=prev?new Date(prev.cierre.ts):new Date(s.apertura.ts), hasta=s.cierre?new Date(s.cierre.ts):new Date();
  const dentro=(iso)=>{ if(!iso) return false; const d=new Date(iso); return d>=desde&&d<=hasta; };
  const lin={}; const add=(k,nombre,medio,m)=>{ if(!m) return; const o=lin[k]||(lin[k]={nombre,ef:0,cta:0}); if(medio==='efectivo') o.ef+=m; else o.cta+=m; };
  allUsers.filter(u=>esProf(u)||u.role==='recepcionista').forEach(u=>{
    let dd={}; try{ dd=JSON.parse(localStorage.getItem('luffy_dinero_'+u.id)||'{}'); }catch(e){}
    if(profile&&u.id===profile.id&&profile.role!=='admin'&&dineroData) dd=dineroData;
    (dd.turnos||[]).filter(t=>dentro(t.creadoEn)&&enCajaSuc(s,t.sucursal||u.sucursal)).forEach(t=>add(u.id,u.name,t.medio,numV(t.aCobrar!=null?t.aCobrar:t.monto)));
    (dd.ventas||[]).filter(v=>dentro(v.creadoEn)&&enCajaSuc(s,v.sucursal||u.sucursal)).forEach(v=>add(u.id,u.name,v.medio,numV(v.total)));
  });
  membresiasSt.list.filter(m=>dentro(m.creadoEn)&&(!m.sucursal||enCajaSuc(s,m.sucursal))).forEach(m=>add('memb','Membresías vendidas',m.medio,numV(m.precio)));
  paquetesSt.list.filter(p=>dentro(p.creadoEn)&&(!p.sucursal||enCajaSuc(s,p.sucursal))).forEach(p=>add('paq','Paquetes vendidos',p.medio,numV(p.total)));
  senasSt.list.filter(x=>dentro(x.ts)&&(!x.sucursal||enCajaSuc(s,x.sucursal))).forEach(x=>add('sena','Señas recibidas',x.medio,numV(x.monto)));
  return Object.values(lin);
}
function cajaSaldos(s){
  const auto=cajaAuto(s); let ef=numV(s.apertura.efectivo), cta=numV(s.apertura.cuenta);
  auto.forEach(x=>{ ef+=x.ef; cta+=x.cta; });
  movsVivos(s).forEach(m=>{ const sg=m.tipo==='entrada'?1:-1; if(m.medio==='efectivo') ef+=sg*numV(m.monto); else cta+=sg*numV(m.monto); });
  return {ef,cta,auto};
}

// ---------- estado publico de la caja: lo leen todos (profesionales incluidos) para saber si ya se puede cobrar ----------
// Solo hay caja de recepcion en las sucursales con recepcionista (hoy Diego Laure). Hasta que no se abre la caja del dia, nadie cobra ahi.
let estadoCaja={};
async function refrescarEstadoCaja(){
  if(!DB) return;
  try{ const r=await DB.doc('luffy/estado_caja').get(); if(r){ estadoCaja=r; try{localStorage.setItem('luffy_estado_caja',JSON.stringify(r));}catch(e){} } }catch(e){}
}
function cargarEstadoCaja(){
  try{ estadoCaja=JSON.parse(localStorage.getItem('luffy_estado_caja')||'{}')||{}; }catch(e){ estadoCaja={}; }
  refrescarEstadoCaja();
}
async function guardarEstadoCaja(o){
  estadoCaja={...estadoCaja,...o}; try{localStorage.setItem('luffy_estado_caja',JSON.stringify(estadoCaja));}catch(e){}
  if(DB){ try{ await DB.doc('luffy/estado_caja').set(estadoCaja); }catch(e){} }
}
// "Abierta hoy" = se abrio la caja hoy (aunque despues la hayan cerrado: si siguen cortando, eso lo cobra recepcion al otro dia)
function cajaAbiertaHoy(sid){
  if(!sid||!sucursalConRecepcion(sid)) return true;
  const hoy=hoyStr(), e=estadoCaja||{};
  if(e.fecha===hoy&&(!(e.sucursales||[]).length||e.sucursales.includes(sid))) return true;
  return todasSesiones().some(s=>s.fecha===hoy&&enCajaSuc(s,sid));
}
async function cajaOkParaCobrar(sid){
  if(cajaAbiertaHoy(sid)) return true;
  await refrescarEstadoCaja();
  if(cajaAbiertaHoy(sid)) return true;
  avisoCajaCerrada(sid); return false;
}
function avisoCajaCerrada(sid){
  const su=sucursalDe(sid)||{nombre:'la sucursal'}; const puede=!!profile&&(profile.role==='recepcionista'||profile.role==='admin');
  document.getElementById('registro-content').innerHTML=cabeceraModal('🔒 La caja no está abierta')+
    `<div style="font-size:13.5px;line-height:1.6;margin-bottom:14px">No se puede cobrar en <b>${escH(su.nombre)}</b> hasta que recepción abra la caja del día (contando el efectivo y comparándolo con lo que dice la app).</div>`+
    (puede?`<button class="btn btn-primary" style="background:#34d399;color:#0b0b10" onclick="closeModal('modal-registro');abrirFormCaja()">Abrir la caja ahora</button>`
      :`<div style="font-size:12px;color:var(--muted2)">Avisale a recepción y volvé a intentar.</div><button class="btn btn-ghost" style="margin-top:10px" onclick="closeModal('modal-registro')">Entendido</button>`);
  openModal('modal-registro');
}
// Sucursal donde esta cobrando la persona (recepcion: la primera con recepcion que atiende)
function sucCajaDe(){
  try{
    if(profile&&profile.role==='recepcionista') return (sucursales.find(x=>sucursalConRecepcion(x.id)&&atiende(profile,x.id))||{}).id||null;
    return sucursalActual();
  }catch(e){ return null; }
}
async function cajaOkAccion(){ return cajaOkParaCobrar(sucCajaDe()); }
// Todo lo que mueve plata pide la caja abierta. Tambien se sale de "Cosas por cobrar"/"Caja" (ver
// cosasPorCobrarAbierto/cajaCompletaAbierta) para que el poll de 15s de recepción no vuelva a pisar esta
// pantalla con la lista de nuevo mientras el usuario todavia la esta completando (bug reportado por Ivo
// 1/10/2026: "se sale del cobro a cada rato" — renderRecepcion() reabría la lista encima de lo que fuera
// que el usuario tuviera abierto, porque esos flags solo se apagaban al cerrar el modal entero).
['abrirVentaMembresia','abrirVentaPaquete','abrirPaqueteProximaVisita','abrirCobroDeuda','abrirFormSena','abrirVentaProducto'].forEach(n=>{
  const f=window[n]; if(typeof f!=='function') return;
  window[n]=async function(...a){ if(!await cajaOkAccion()) return; cosasPorCobrarAbierto=false; cajaCompletaAbierta=false; return f.apply(this,a); };
});
// Acciones de Caja: no mueven plata por si mismas (no piden caja abierta), pero tienen el mismo problema
// de quedar pisadas por el refresco automático si cajaCompletaAbierta sigue prendido.
['abrirCambioRecepcionista','abrirMovCaja','cajaDetalle','abrirCierreCaja'].forEach(n=>{
  const f=window[n]; if(typeof f!=='function') return;
  window[n]=function(...a){ cosasPorCobrarAbierto=false; cajaCompletaAbierta=false; return f.apply(this,a); };
});

// ---------- que se cobro en el dia (todo lo de la sucursal, sin importar quien atendio la caja) ----------
function resumenDiaSuc(sid,fecha){
  const R={ef:0,mp:0,tj:0,debe:0,n:0,otros:0,porProf:{}};
  const add=(medio,m,quien)=>{ m=numV(m); if(!m) return; if(medio==='efectivo') R.ef+=m; else if(medio==='tarjeta') R.tj+=m; else R.mp+=m; R.porProf[quien]=(R.porProf[quien]||0)+m; };
  allUsers.filter(u=>esProf(u)||u.role==='recepcionista').forEach(u=>{
    let dd={}; try{ dd=JSON.parse(localStorage.getItem('luffy_dinero_'+u.id)||'{}'); }catch(e){}
    if(profile&&u.id===profile.id&&profile.role!=='admin'&&dineroData) dd=dineroData;
    (dd.turnos||[]).filter(t=>t.fecha===fecha&&(t.sucursal||u.sucursal)===sid).forEach(t=>{ add(t.medio,t.aCobrar!=null?t.aCobrar:t.monto,u.name); R.n++; });
    (dd.ventas||[]).filter(v=>v.fecha===fecha&&(v.sucursal||u.sucursal)===sid).forEach(v=>{ add(v.medio,v.total,u.name); R.otros++; });
    (dd.deudores||[]).filter(d=>d.fecha===fecha&&(d.sucursal||u.sucursal)===sid&&!d.anulada).forEach(d=>{ R.debe+=numV(d.monto); });
  });
  membresiasSt.list.filter(m=>m.fecha===fecha&&(!m.sucursal||m.sucursal===sid)).forEach(m=>{ add(m.medio,m.precio,'Membresías'); R.otros++; });
  paquetesSt.list.filter(p=>p.fecha===fecha&&(!p.sucursal||p.sucursal===sid)).forEach(p=>{ add(p.medio,p.total,'Paquetes'); R.otros++; });
  senasSt.list.filter(x=>(x.fecha||ymdLocal(new Date(x.ts)))===fecha&&(!x.sucursal||x.sucursal===sid)).forEach(x=>{ add(x.medio,x.monto,'Señas'); R.otros++; });
  R.total=R.ef+R.mp+R.tj;
  return R;
}
function htmlResumenDia(){
  const hoy=hoyStr();
  // Ademas de las sucursales con recepcion propia, mostrar las que hoy quedaron sincronizadas dentro de alguna caja (ej. French con Diego Laure)
  const idsConRecepcion=sucursales.filter(x=>sucursalConRecepcion(x.id)).map(x=>x.id);
  const idsEnSesionHoy=todasSesiones().filter(s=>s.fecha===hoy).flatMap(s=>s.sucursales||[]);
  const idsMostrar=[...new Set([...idsConRecepcion,...idsEnSesionHoy])];
  const L=sucursales.filter(x=>idsMostrar.includes(x.id)); if(!L.length) return '';
  const cards=L.map(su=>{
    const R=resumenDiaSuc(su.id,hoy); const pp=Object.entries(R.porProf).sort((a,b)=>b[1]-a[1]);
    return `<div class="card" style="margin:0;border-left:5px solid ${su.color}"><div style="display:flex;justify-content:space-between;align-items:baseline"><div style="font-size:12.5px;font-weight:800">📊 Hoy en ${escH(su.nombre)}</div><div style="font-size:21px;font-weight:900">${fp(R.total)}</div></div>
      <div style="display:flex;gap:6px;margin:8px 0">${[['💵','Efectivo',R.ef],['📱','M. Pago',R.mp],['💳','Tarjeta',R.tj]].map(([e,l,v])=>`<div style="flex:1;background:var(--s2);border-radius:10px;padding:7px 8px;min-width:0"><div style="font-size:10px;color:var(--muted2);font-weight:700">${e} ${l}</div><div style="font-size:14px;font-weight:800">${fp(v)}</div></div>`).join('')}</div>
      <div style="font-size:11px;color:var(--muted2)">${R.n} ${R.n===1?'turno':'turnos'}${R.otros?' + '+R.otros+' de productos, señas, membresías o paquetes':''}${R.debe>0?' · <span style="color:#f472b6">quedaron debiendo '+fp(R.debe)+'</span>':''}</div>
      ${pp.length?`<details style="margin-top:6px"><summary style="cursor:pointer;font-size:11.5px;font-weight:700;color:var(--muted2)">Por profesional</summary>${pp.map(([n,v])=>`<div class="ln"><span>${escH(n)}</span><b>${fp(v)}</b></div>`).join('')}</details>`:''}</div>`;
  }).join('');
  return `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:10px;margin-top:10px">${cards}</div>`;
}
// La caja anterior ya cerro: lo cobrado desde ese cierre hasta la apertura siguiente entra en la caja que se abre (no se pierde)
function cubiertoPorCaja(iso,sid){
  if(!iso) return true; const ss=todasSesiones(); if(!ss.length) return true;
  const d=new Date(iso);
  return ss.some(s=>enCajaSuc(s,sid)&&d>=new Date(s.apertura.ts)&&(!s.cierre||d<=new Date(s.cierre.ts)));
}
function aperturaCajaDif(){
  const uc=ultimoCierre(); const e=document.getElementById('cj-ef').value, c=document.getElementById('cj-cta').value; const el=document.getElementById('cj-dif');
  if(e===''||c===''||!uc){ el.innerHTML=''; return; }
  const de=numV(e)-numV(uc.efectivo), dc=numV(c)-numV(uc.cuenta); const ok=Math.abs(de)<1&&Math.abs(dc)<1;
  el.innerHTML=`<span style="color:${ok?'#34d399':'#fbbf24'}">${ok?'✓ Coincide con lo que dice la app':'Diferencia con la app: efectivo '+fp(de)+' · cuenta '+fp(dc)}</span>`;
}

// ---------- bloques de recepcion (para saber a que turno pertenece una apertura) ----------
const minDeHora=(h)=>{ const [a,b]=String(h).split(':').map(Number); return a*60+b; };
const horaDeMin=(n)=>pad2(Math.floor(n/60))+':'+pad2(n%60);
const restarMin=(h,m)=>horaDeMin(Math.max(0,minDeHora(h)-m));
function bloquesHoy(){ const dw=new Date().getDay(); return (promos.bloquesRec||[]).filter(b=>!b.dias||!b.dias.length||b.dias.includes(dw)); }
function bloqueParaApertura(){
  const ahora=minDeHora(horaAhora()); const L=bloquesHoy();
  return L.find(b=>ahora>=minDeHora(b.desde)-90&&ahora<minDeHora(b.hasta))||L.find(b=>ahora<minDeHora(b.desde))||null;
}

// ---------- pantalla de recepcion ----------
function htmlCajaRec(){ return htmlCajaRecBase()+htmlResumenDia(); }
// Quien esta a cargo AHORA: el ultimo cambio de recepcionista si hubo, sino quien abrio
function recepcionistaActual(s){
  const L=s.entregas||[]; const ult=L[L.length-1];
  return ult?{id:ult.aId,nombre:ult.aNombre}:{id:s.recId,nombre:s.recNombre};
}
function htmlCajaRecBase(){
  const s=sesionAbierta(); const hoy=hoyStr();
  const btn=(t,f,st)=>`<button onclick="${f}" style="padding:10px 14px;border-radius:12px;border:${st?'none':'1.5px solid var(--border2)'};background:${st||'transparent'};color:${st?'#fff':'var(--text)'};font-family:var(--font);font-size:12.5px;font-weight:800;cursor:pointer">${t}</button>`;
  if(!s) return `<div class="card" style="margin-top:14px;border-color:rgba(251,191,36,.4)"><div style="display:flex;align-items:center;gap:12px"><div style="font-size:26px">💰</div><div style="flex:1"><div style="font-size:14px;font-weight:800">${todasSesiones().some(x=>x.fecha===hoy)?'Caja cerrada':'🔒 Caja sin abrir'}</div><div style="font-size:11.5px;color:var(--muted2)">${todasSesiones().some(x=>x.fecha===hoy)?'Si los profesionales siguen cobrando, lo ves mañana en "Para cobrar".':'Hasta que no la abras nadie puede cobrar en Diego Laure. Contá el efectivo, compará con la app y abrila.'}</div></div>${btn('Abrir caja','abrirFormCaja()','#34d399')}</div></div>`;
  const sd=cajaSaldos(s); const otraFecha=s.fecha!==hoy; const actual=recepcionistaActual(s); const huboCambio=(s.entregas||[]).length>0;
  return `<div class="card" style="margin-top:14px;border-color:${otraFecha?'rgba(244,114,182,.5)':'rgba(52,211,153,.4)'}">
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px"><div style="font-size:24px">💰</div><div style="flex:1"><div style="font-size:14px;font-weight:800">Caja abierta</div><div style="font-size:11.5px;color:${otraFecha?'#f472b6':'var(--muted2)'}">${otraFecha?'⚠️ Quedó abierta del '+fechaCortaStr(s.fecha)+' · ':''}la abrió ${escH(s.recNombre)} a las ${horaDeIso(s.apertura.ts)}${huboCambio?' · ahora a cargo: <b style="color:var(--text)">'+escH(actual.nombre)+'</b>':''}</div></div></div>
    <div style="display:flex;gap:10px;margin-bottom:10px"><div style="flex:1;background:var(--s2);border-radius:12px;padding:10px 12px"><div style="font-size:10.5px;color:var(--muted2);font-weight:700">💵 EFECTIVO</div><div style="font-size:20px;font-weight:900">${fp(sd.ef)}</div></div><div style="flex:1;background:var(--s2);border-radius:12px;padding:10px 12px"><div style="font-size:10.5px;color:var(--muted2);font-weight:700">🏦 CUENTA</div><div style="font-size:20px;font-weight:900">${fp(sd.cta)}</div></div></div>
    <div style="display:flex;gap:8px;flex-wrap:wrap">${btn('🔄 Cambio de recepcionista','abrirCambioRecepcionista()','#60a5fa')}${btn('+ Movimiento','abrirMovCaja()','#4A136B')}${btn('Ver detalle','cajaDetalle(\''+s.id+'\')')}${btn('Cerrar caja','abrirCierreCaja()','#f472b6')}</div></div>`;
}
function abrirCambioRecepcionista(){
  const s=sesionAbierta(); if(!s) return; const sd=cajaSaldos(s); const actual=recepcionistaActual(s);
  if(profile.id===actual.id){ showToast('Ya figurás vos como recepcionista a cargo'); return; }
  document.getElementById('registro-content').innerHTML=cabeceraModal('Cambio de recepcionista 🔄')+`
    <div style="font-size:12.5px;color:var(--muted2);margin-bottom:10px">La caja sigue abierta — esto no la cierra, solo deja anotado que a partir de ahora quedás vos a cargo, ${escH(profile.name)}. Contá lo que hay antes de recibirla.</div>
    <div class="card" style="margin-bottom:10px"><div style="font-size:11px;font-weight:800;color:var(--muted);text-transform:uppercase;letter-spacing:.08em;margin-bottom:4px">Según el sistema debería haber</div>${linea('💵 Efectivo',`<b>${fp(sd.ef)}</b>`)}${linea('🏦 Cuenta',`<b>${fp(sd.cta)}</b>`)}</div>
    <div class="field"><label>💵 Efectivo que contaste</label><input id="cb-ef" type="number" inputmode="decimal" placeholder="0" oninput="cambioCajaDif()"/></div>
    <div class="field" style="margin-top:8px"><label>🏦 Saldo real en la cuenta</label><input id="cb-cta" type="number" inputmode="decimal" placeholder="0" oninput="cambioCajaDif()"/></div>
    <div id="cb-dif" style="font-size:12.5px;font-weight:700;margin:8px 0"></div>
    <div class="field"><label>Nota (si hay diferencia, ¿por qué?)</label><input id="cb-nota" placeholder="Opcional"/></div>
    <button class="btn btn-primary" onclick="confirmarCambioRecepcionista()" style="margin-top:12px;background:#60a5fa">Recibir la caja</button>`;
  openModal('modal-registro');
}
function cambioCajaDif(){
  const s=sesionAbierta(); if(!s) return; const sd=cajaSaldos(s); const e=document.getElementById('cb-ef').value, c=document.getElementById('cb-cta').value; const el=document.getElementById('cb-dif');
  if(e===''||c===''){ el.innerHTML=''; return; }
  const de=numV(e)-sd.ef, dc=numV(c)-sd.cta; const ok=Math.abs(de)<1&&Math.abs(dc)<1;
  el.innerHTML=`<span style="color:${ok?'#34d399':'#fbbf24'}">${ok?'✓ Cuadra perfecto':'Diferencia: efectivo '+fp(de)+' · cuenta '+fp(dc)}</span>`;
}
async function confirmarCambioRecepcionista(){
  const s=sesionAbierta(); if(!s) return; const sd=cajaSaldos(s); const actual=recepcionistaActual(s);
  const e=document.getElementById('cb-ef').value, c=document.getElementById('cb-cta').value; if(e===''||c===''){ showToast('Poné cuánto contaste en efectivo y en la cuenta'); return; }
  const ef=numV(e), cta=numV(c), de=ef-sd.ef, dc=cta-sd.cta;
  if((Math.abs(de)>=1||Math.abs(dc)>=1)&&!await uiConfirm('Hay una diferencia','Efectivo '+fp(de)+' y cuenta '+fp(dc)+' respecto de lo que debería haber. Queda registrado para el admin. ¿Recibir igual?',{ok:'Recibir igual'})) return;
  const nota=document.getElementById('cb-nota').value.trim(); const ts=new Date().toISOString();
  await cambiarCaja(s.fecha.slice(0,7),l=>{ const x=l.find(z=>z.id===s.id); if(x){ x.entregas=[...(x.entregas||[]),{ts,deId:actual.id,deNombre:actual.nombre,aId:profile.id,aNombre:profile.name,efectivo:ef,cuenta:cta,esperadoEf:sd.ef,esperadoCta:sd.cta,difEf:de,difCta:dc,nota}]; x.upd=ts; } });
  closeModal('modal-registro'); showToast('Cambio de recepcionista registrado ✓ — ahora estás vos a cargo'); refreshCurrentView();
}
function abrirFormCaja(){
  const ab=sesionAbierta(); if(ab){ showToast('Hay una caja abierta: primero hay que cerrarla'); return; }
  const ult=todasSesiones().filter(s=>s.cierre).pop(); const uc=ult?ult.cierre:null;
  document.getElementById('registro-content').innerHTML=cabeceraModal('Abrir caja 💰')+`
    ${uc?`<div class="card" style="margin-bottom:12px"><div style="font-size:11px;font-weight:800;color:var(--muted);text-transform:uppercase;letter-spacing:.08em;margin-bottom:4px">Según la app debería haber</div>${linea('💵 Efectivo',`<b>${fp(numV(uc.efectivo))}</b>`)}${linea('🏦 Cuenta',`<b>${fp(numV(uc.cuenta))}</b>`)}<div style="font-size:11px;color:var(--muted2);margin-top:4px">Es lo que contó ${escH(uc.por||'recepción')} al cerrar la caja del ${fechaCortaStr(ult.fecha)} a las ${horaDeIso(uc.ts)}.</div></div>`
      :`<div class="card" style="margin-bottom:12px;font-size:12.5px;color:var(--muted2)">Es la primera caja: contá el efectivo que hay y poné cuánto tenés en la cuenta.</div>`}
    <div style="font-size:12px;color:var(--muted2);margin-bottom:10px;line-height:1.5">${uc?'Contá el efectivo que hay <b style="color:var(--text)">ahora</b> en la caja y compará con lo de arriba. Si no coincide, anotá por qué.':'Sin abrir la caja no se puede cobrar.'}</div>
    <div class="field"><label>💵 Efectivo que contaste</label><input id="cj-ef" type="number" inputmode="decimal" placeholder="0" oninput="aperturaCajaDif()"/></div>
    <div class="field" style="margin-top:8px"><label>🏦 Saldo real en la cuenta (Mercado Pago / banco)</label><input id="cj-cta" type="number" inputmode="decimal" placeholder="0" oninput="aperturaCajaDif()"/></div>
    <div id="cj-dif" style="font-size:12.5px;font-weight:700;margin:8px 0"></div>
    <div class="field"><label>Nota (si hay diferencia, ¿por qué?)</label><input id="cj-nota" placeholder="Opcional"/></div>
    <button class="btn btn-primary" onclick="confirmarAperturaCaja()" style="margin-top:14px;background:#34d399;color:#0b0b10">Abrir caja</button>`;
  openModal('modal-registro');
}
async function confirmarAperturaCaja(){
  const e0=document.getElementById('cj-ef').value, c0=document.getElementById('cj-cta').value; if(e0===''||c0===''){ showToast('Poné cuánto contaste en efectivo y en la cuenta'); return; }
  const ef=numV(e0), cta=numV(c0), nota=(document.getElementById('cj-nota')||{value:''}).value.trim();
  const uc=ultimoCierre();
  if(uc&&(Math.abs(ef-numV(uc.efectivo))>=1||Math.abs(cta-numV(uc.cuenta))>=1)&&!await uiConfirm('No coincide con la app','Efectivo '+fp(ef-numV(uc.efectivo))+' y cuenta '+fp(cta-numV(uc.cuenta))+' respecto de lo que dejó la caja anterior. Queda registrado para el admin. ¿Abrir igual?',{ok:'Abrir igual'})) return;
  const b=bloqueParaApertura(); const ahora=new Date().toISOString();
  // Las sucursales sin recepcion propia (ej. French) quedan siempre sincronizadas dentro de la misma caja: se abren y cierran junto con esta
  const propias=sucursalesDe(profile).length?sucursalesDe(profile):sucursales.filter(x=>sucursalConRecepcion(x.id)).map(x=>x.id);
  const sinRecepcion=sucursales.filter(x=>!sucursalConRecepcion(x.id)).map(x=>x.id);
  const sucursalesSesion=[...new Set([...propias,...sinRecepcion])];
  const r=await cambiarCaja(ymHoy(),l=>{
    if(todasSesiones().some(s=>!s.cierre)) return {error:true};
    const s={id:'cj'+Date.now().toString(36),fecha:hoyStr(),bloque:b?b.id:null,recId:profile.id,recNombre:profile.name,sucursal:profile.sucursal||((sucursales.find(x=>sucursalConRecepcion(x.id))||{}).id)||null,sucursales:sucursalesSesion,
      apertura:{efectivo:ef,cuenta:cta,ts:ahora,difEf:uc?ef-numV(uc.efectivo):0,difCta:uc?cta-numV(uc.cuenta):0,nota,esperadoEf:uc?numV(uc.efectivo):null,esperadoCta:uc?numV(uc.cuenta):null},movs:[],entregas:[],cierre:null,upd:ahora};
    l.push(s); return {s};
  });
  if(r.error){ showToast('Alguien ya abrió la caja'); return; }
  await guardarEstadoCaja({fecha:hoyStr(),abierta:true,ts:ahora,por:profile.name,sucursales:(r.s&&r.s.sucursales)||[]});
  closeModal('modal-registro'); showToast('Caja abierta ✓'); refreshCurrentView();
}
function cajaDetalle(id){
  const s=todasSesiones().find(x=>x.id===id); if(!s) return; const sd=cajaSaldos(s); const editable=!s.cierre&&profile.role==='recepcionista';
  const f=(n)=>fp(n);
  document.getElementById('registro-content').innerHTML=cabeceraModal('Detalle de la caja')+`
    <div style="font-size:12px;color:var(--muted2);margin-bottom:10px">${escH(s.recNombre)} · ${fechaCortaStr(s.fecha)} · abrió ${horaDeIso(s.apertura.ts)}${s.cierre?' · cerró '+horaDeIso(s.cierre.ts):''}</div>
    <div class="card" style="margin-bottom:8px">${linea('<b>Apertura</b>',`💵 ${f(s.apertura.efectivo)} · 🏦 ${f(s.apertura.cuenta)}`)}
      ${(s.apertura.difEf||s.apertura.difCta)?`<div style="font-size:11px;color:#fbbf24;margin-top:2px">Difiere de lo que cerró la caja anterior (efectivo ${fp(s.apertura.difEf)}, cuenta ${fp(s.apertura.difCta)})</div>`:''}${s.apertura.nota?`<div style="font-size:11.5px;color:var(--muted2);margin-top:4px">📝 ${escH(s.apertura.nota)}</div>`:''}</div>
    ${(s.entregas||[]).length?`<div class="sec-title" style="margin:10px 0 6px">🔄 Cambios de recepcionista</div>
    <div class="card" style="margin-bottom:8px">${s.entregas.map(e=>`<div class="ln" style="align-items:flex-start"><span>${escH(e.deNombre)} → <b>${escH(e.aNombre)}</b><span style="color:var(--muted);font-size:10.5px"> · ${horaDeIso(e.ts)}</span>${(e.difEf||e.difCta)?`<div style="font-size:11px;color:#fbbf24">Diferencia: efectivo ${fp(e.difEf)} · cuenta ${fp(e.difCta)}</div>`:''}${e.nota?`<div style="font-size:11px;color:var(--muted2)">📝 ${escH(e.nota)}</div>`:''}</span><span style="white-space:nowrap;font-size:12px">💵 ${f(e.efectivo)}</span></div>`).join('')}</div>`:''}
    <div class="sec-title" style="margin:10px 0 6px">⬆️ Cobros (entran solos)</div>
    <div class="card" style="margin-bottom:8px">${sd.auto.map(x=>linea(escH(x.nombre),`💵 ${f(x.ef)} · 🏦 ${f(x.cta)}`)).join('')||'<div style="font-size:12px;color:var(--muted)">Todavía no hubo cobros.</div>'}</div>
    <div class="sec-title" style="margin:10px 0 6px">✍️ Movimientos anotados</div>
    <div class="card" style="margin-bottom:8px">${movsVivos(s).map(m=>`<div class="ln"><span>${m.tipo==='entrada'?'⬆️':'⬇️'} ${escH(m.concepto)}${m.detalle?' <i style="color:var(--muted)">· '+escH(m.detalle)+'</i>':''} <span style="color:var(--muted);font-size:10.5px">${m.medio==='efectivo'?'efectivo':'cuenta'} · ${horaDeIso(m.ts)}</span></span><span style="white-space:nowrap"><b style="color:${m.tipo==='entrada'?'#34d399':'#f472b6'}">${m.tipo==='entrada'?'+':'−'}${f(m.monto)}</b>${editable?` <button class="lnk" style="color:#f472b6" onclick="borrarMovCaja('${s.id}','${m.id}')">×</button>`:''}</span></div>`).join('')||'<div style="font-size:12px;color:var(--muted)">Sin movimientos.</div>'}</div>
    <div class="card"><div style="font-size:11px;font-weight:800;color:var(--muted);text-transform:uppercase;letter-spacing:.08em;margin-bottom:4px">${s.cierre?'Al cerrar':'Debería haber ahora'}</div>
      ${linea('💵 Efectivo',`<b>${f(s.cierre?s.cierre.esperadoEf:sd.ef)}</b>`)}${linea('🏦 Cuenta',`<b>${f(s.cierre?s.cierre.esperadoCta:sd.cta)}</b>`)}
      ${s.cierre?`${linea('Contado: efectivo / cuenta',`${f(s.cierre.efectivo)} / ${f(s.cierre.cuenta)}`)}${linea('<b>Diferencia</b>',`<b style="color:${(s.cierre.difEf||s.cierre.difCta)?'#f472b6':'#34d399'}">${fp(s.cierre.difEf)} / ${fp(s.cierre.difCta)}</b>`)}${s.cierre.nota?`<div style="font-size:11.5px;color:var(--muted2);margin-top:4px">📝 ${escH(s.cierre.nota)}</div>`:''}`:''}</div>`;
  openModal('modal-registro');
}
let movCajaSel=null;
function abrirMovCaja(){
  movCajaSel={concepto:'proveedor',medio:'efectivo'}; renderMovCaja(); openModal('modal-registro');
}
function movCajaSet(k,v){ movCajaSel[k]=v; renderMovCaja(); }
function renderMovCaja(){
  const s=movCajaSel, color='#4A136B', cp=CONCEPTOS_CAJA.find(c=>c.id===s.concepto);
  const keep=document.getElementById('mv-monto')?document.getElementById('mv-monto').value:'', keepD=document.getElementById('mv-det')?document.getElementById('mv-det').value:'';
  document.getElementById('registro-content').innerHTML=cabeceraModal('Movimiento de caja')+`
    <div class="field"><label>¿Qué es?</label><div style="display:flex;flex-wrap:wrap;gap:6px">${CONCEPTOS_CAJA.map(c=>`<button onclick="movCajaSet('concepto','${c.id}')" style="${pillStyle(s.concepto===c.id,c.tipo==='entrada'?'#34d399':'#f472b6')}">${c.tipo==='entrada'?'⬆️':'⬇️'} ${c.n}</button>`).join('')}</div></div>
    <div class="field" style="margin-top:8px"><label>Monto</label><input id="mv-monto" type="number" inputmode="decimal" placeholder="0" value="${escH(keep)}"/></div>
    ${cp.tipo==='traspaso'?'<div style="font-size:11.5px;color:var(--muted2);margin:4px 0">Sale del efectivo y entra a la cuenta.</div>':`<div class="field" style="margin-top:8px"><label>¿De dónde?</label><div style="display:flex;gap:8px">${[['efectivo','💵 Efectivo'],['cuenta','🏦 Cuenta']].map(([v,l])=>`<button onclick="movCajaSet('medio','${v}')" style="flex:1;${pillStyle(s.medio===v,color)}">${l}</button>`).join('')}</div></div>`}
    <div class="field" style="margin-top:8px"><label>${escH(cp.detalleLabel||'Detalle')}${cp.pedirDetalle?' *':' (opcional)'}</label><input id="mv-det" placeholder="${cp.pedirDetalle?'Obligatorio para esta anotación':'Ej: ceras a proveedor'}" value="${escH(keepD)}"/></div>
    <button class="btn btn-primary" onclick="guardarMovCaja()" style="margin-top:14px;background:${color}">Guardar</button>`;
}
async function guardarMovCaja(){
  const monto=numV(document.getElementById('mv-monto').value); if(monto<=0){ showToast('Poné el monto'); return; }
  const det=document.getElementById('mv-det').value.trim(); const cp=CONCEPTOS_CAJA.find(c=>c.id===movCajaSel.concepto); const ab=sesionAbierta(); if(!ab){ showToast('La caja está cerrada'); return; }
  if(cp.pedirDetalle&&!det){ showToast((cp.detalleLabel||'El detalle')+' es obligatorio para esta anotación'); return; }
  const ts=new Date().toISOString(), base={concepto:cp.n,cat:cp.cat||null,gasto:!!cp.gasto,interno:cp.interno||null,detalle:det,ts,por:profile.name};
  const movs=cp.tipo==='traspaso'?[{...base,id:'m'+Date.now().toString(36)+'a',tipo:'salida',medio:'efectivo',monto},{...base,id:'m'+Date.now().toString(36)+'b',tipo:'entrada',medio:'cuenta',monto}]:[{...base,id:'m'+Date.now().toString(36),tipo:cp.tipo,medio:movCajaSel.medio,monto}];
  await cambiarCaja(ab.fecha.slice(0,7),l=>{ const s=l.find(x=>x.id===ab.id); if(s){ s.movs=[...(s.movs||[]),...movs]; s.upd=new Date().toISOString(); } });
  closeModal('modal-registro'); showToast('Anotado ✓'); refreshCurrentView();
}
async function borrarMovCaja(sid,mid){
  const s=todasSesiones().find(x=>x.id===sid); if(!s||s.cierre) return;
  await cambiarCaja(s.fecha.slice(0,7),l=>{ const x=l.find(z=>z.id===sid); const m=x&&(x.movs||[]).find(z=>z.id===mid); if(m){ m.borrado=true; x.upd=new Date().toISOString(); } });
  cajaDetalle(sid); refreshCurrentView();
}
function abrirCierreCaja(){
  const s=sesionAbierta(); if(!s) return; const sd=cajaSaldos(s);
  document.getElementById('registro-content').innerHTML=cabeceraModal('Cerrar caja 💰')+`
    <div class="card" style="margin-bottom:10px"><div style="font-size:11px;font-weight:800;color:var(--muted);text-transform:uppercase;letter-spacing:.08em;margin-bottom:4px">Según el sistema debería haber</div>${linea('💵 Efectivo',`<b>${fp(sd.ef)}</b>`)}${linea('🏦 Cuenta',`<b>${fp(sd.cta)}</b>`)}</div>
    <div class="field"><label>💵 Efectivo que contaste</label><input id="cc-ef" type="number" inputmode="decimal" placeholder="0" oninput="cierreCajaDif()"/></div>
    <div class="field" style="margin-top:8px"><label>🏦 Saldo real en la cuenta</label><input id="cc-cta" type="number" inputmode="decimal" placeholder="0" oninput="cierreCajaDif()"/></div>
    <div id="cc-dif" style="font-size:12.5px;font-weight:700;margin:8px 0"></div>
    <div class="field"><label>Nota (opcional, ej: por qué hay diferencia)</label><input id="cc-nota" placeholder="Opcional"/></div>
    <button class="btn btn-primary" onclick="confirmarCierreCaja()" style="margin-top:12px;background:#f472b6">Cerrar caja</button>`;
  openModal('modal-registro');
}
function cierreCajaDif(){
  const s=sesionAbierta(); if(!s) return; const sd=cajaSaldos(s); const e=document.getElementById('cc-ef').value, c=document.getElementById('cc-cta').value; const el=document.getElementById('cc-dif');
  if(e===''||c===''){ el.innerHTML=''; return; }
  const de=numV(e)-sd.ef, dc=numV(c)-sd.cta; const ok=Math.abs(de)<1&&Math.abs(dc)<1;
  el.innerHTML=`<span style="color:${ok?'#34d399':'#fbbf24'}">${ok?'✓ Cuadra perfecto':'Diferencia: efectivo '+fp(de)+' · cuenta '+fp(dc)}</span>`;
}
async function confirmarCierreCaja(){
  const s=sesionAbierta(); if(!s) return; const sd=cajaSaldos(s);
  const e=document.getElementById('cc-ef').value, c=document.getElementById('cc-cta').value; if(e===''||c===''){ showToast('Poné cuánto contaste en efectivo y en la cuenta'); return; }
  const ef=numV(e), cta=numV(c), de=ef-sd.ef, dc=cta-sd.cta;
  if((Math.abs(de)>=1||Math.abs(dc)>=1)&&!await uiConfirm('Hay una diferencia','Efectivo '+fp(de)+' y cuenta '+fp(dc)+'. Queda registrada para el admin. ¿Cerrar igual?',{ok:'Cerrar igual'})) return;
  const nota=document.getElementById('cc-nota').value.trim(); const ts=new Date().toISOString();
  await cambiarCaja(s.fecha.slice(0,7),l=>{ const x=l.find(z=>z.id===s.id); if(x&&!x.cierre){ x.cierre={efectivo:ef,cuenta:cta,esperadoEf:sd.ef,esperadoCta:sd.cta,difEf:de,difCta:dc,nota,ts,porId:profile.id,por:profile.name}; x.upd=ts; } });
  await guardarEstadoCaja({abierta:false,cierreTs:ts});
  closeModal('modal-registro'); showToast('Caja cerrada ✓'); refreshCurrentView();
}

// ---------- SOLO ADMIN: ¿abrio recepcion? ----------
// La caja abierta cuenta como "abrio". Se avisa desde 5 minutos antes del inicio del bloque (8:55 para el de las 9:00).
function estadoApertura(){
  const ahora=horaAhora(), hoy=hoyStr(), antes=numV(promos.avisoAperturaMin)||5;
  return bloquesHoy().map(b=>{
    const limite=restarMin(b.desde,antes);
    const ses=todasSesiones().find(s=>s.fecha===hoy&&s.bloque===b.id);
    const asignadas=hayCalendario()?allUsers.filter(u=>u.id===asignadoEn(hoy,b.id)):allUsers.filter(u=>u.role==='recepcionista'&&(u.bloquesRec||[]).includes(b.id));
    const sinAsignar=hayCalendario()&&!asignadas.length;
    return {b,limite,ses,asignadas,sinAsignar,pasado:ahora>=limite,fin:ahora>=b.hasta};
  });
}
function htmlAperturaAdmin(){
  const L=estadoApertura(); if(!L.length) return '';
  const fila=(x)=>{
    const q=x.asignadas.length?' · '+escH(x.asignadas.map(u=>u.name).join(', ')):'';
    let ico,txt,col;
    if(x.ses){ ico='🟢'; col='#34d399'; txt=`Abrió a las <b>${horaDeIso(x.ses.apertura.ts)}</b> (${escH(x.ses.recNombre)})${horaDeIso(x.ses.apertura.ts)>x.b.desde?' · tarde':''}`; }
    else if(x.sinAsignar){ ico='⚪'; col='var(--muted2)'; txt='Nadie asignada en este bloque (mirá el calendario)'; }
    else if(x.fin){ ico='⚫'; col='#94a3b8'; txt='No abrió la caja en este turno'; }
    else if(x.pasado){ ico='🔴'; col='#f472b6'; txt=`<b>Todavía no abrió</b> — tenía que abrir a las ${x.limite} (son las ${horaAhora()})`; }
    else { ico='⚪'; col='var(--muted2)'; txt=`Todavía no es la hora (avisa a las ${x.limite})`; }
    return `<div style="display:flex;gap:8px;align-items:center;font-size:12.5px;padding:3px 0"><span>${ico}</span><span style="flex:1;color:${col}">${escH(x.b.nombre)} ${x.b.desde}–${x.b.hasta}${q}<br><span style="font-size:12px">${txt}</span></span></div>`;
  };
  const alerta=L.some(x=>!x.ses&&x.pasado&&!x.fin&&!x.sinAsignar);
  return `<div class="card" style="margin:10px 0;${alerta?'border-color:rgba(244,114,182,.6);background:rgba(244,114,182,.07)':''}"><div style="font-size:11px;font-weight:800;color:var(--muted);text-transform:uppercase;letter-spacing:.08em;margin-bottom:4px">📞 Apertura de recepción (solo lo ves vos)</div>${L.map(fila).join('')}</div>`;
}
function cargarCajasAdmin(){ loadCaja(); }

// ---------- admin: cajas del mes ----------
function adminCaja(c){
  const ses=todasSesiones().slice().reverse();
  const abiertas=ses.filter(s=>!s.cierre);
  const dif=ses.filter(s=>s.cierre).reduce((a,s)=>a+numV(s.cierre.difEf)+numV(s.cierre.difCta),0);
  c.innerHTML=`${htmlAperturaAdmin()}
    <div class="sec-hdr" style="margin:6px 0 8px"><span class="sec-title">💰 Cajas de recepción</span></div>
    <div class="stat-grid" style="grid-template-columns:repeat(3,1fr)"><div class="stat-card"><div class="sc-lbl">Cajas</div><div class="sc-val">${ses.length}</div></div><div class="stat-card"><div class="sc-lbl">Abiertas</div><div class="sc-val" style="color:${abiertas.length?'#fbbf24':'var(--text)'}">${abiertas.length}</div></div><div class="stat-card"><div class="sc-lbl">Diferencias</div><div class="sc-val" style="font-size:20px;color:${Math.abs(dif)>=1?'#f472b6':'#34d399'}">${fp(dif)}</div><div class="sc-sub">suma de sobrantes y faltantes</div></div></div>
    ${ses.slice(0,40).map(s=>{ const sd=s.cierre?null:cajaSaldos(s); const d=s.cierre?(numV(s.cierre.difEf)+numV(s.cierre.difCta)):0; return `<div class="card" onclick="cajaDetalle('${s.id}')" style="cursor:pointer;margin-bottom:6px;border-left:4px solid ${!s.cierre?'#fbbf24':(Math.abs(d)>=1?'#f472b6':'#34d399')}"><div style="display:flex;justify-content:space-between;gap:8px;align-items:baseline"><div style="font-size:13px;font-weight:800">${fechaCortaStr(s.fecha)} · ${escH(s.recNombre)}</div><div style="font-size:11.5px;color:var(--muted2)">${horaDeIso(s.apertura.ts)}${s.cierre?' → '+horaDeIso(s.cierre.ts):' → abierta'}</div></div>
      <div style="font-size:12px;color:var(--muted2);margin-top:3px">Apertura 💵 ${fp(s.apertura.efectivo)} · 🏦 ${fp(s.apertura.cuenta)}${s.cierre?` · Cierre 💵 ${fp(s.cierre.efectivo)} · 🏦 ${fp(s.cierre.cuenta)}`:` · ahora debería haber 💵 ${fp(sd.ef)} · 🏦 ${fp(sd.cta)}`}${s.cierre&&Math.abs(d)>=1?` · <b style="color:#f472b6">diferencia ${fp(d)}</b>`:''}${(s.apertura.difEf||s.apertura.difCta)?' · <b style="color:#fbbf24">abrió con distinto saldo</b>':''}</div></div>`; }).join('')||'<div class="empty"><div class="e-icon">💰</div><p>Todavía no se abrió ninguna caja.</p></div>'}`;
}

// ---------- admin: bloques y asignacion ----------
async function editarBloquesRec(){
  const actuales=(promos.bloquesRec||[]).map(b=>b.nombre+' | '+b.desde+' | '+b.hasta+' | '+(b.dias||[]).map(d=>DIAS_NOM[d]).join(', ')).join('\n');
  const v=await uiDialog({title:'Bloques de recepción',msg:'Una línea por bloque: nombre | desde | hasta | días (ej: lun, mar, mié, jue, vie, sáb). Se avisa al admin si no abrió la caja 5 minutos antes de cada bloque.',fields:[{type:'textarea',value:actuales},{label:'Avisar minutos antes de que empiece el bloque',type:'number',value:promos.avisoAperturaMin||5}],ok:'Guardar'});
  if(!v) return;
  const dk=DIAS_NOM.map(nkey); const out=[]; let mal=0;
  v[0].split('\n').map(l=>l.trim()).filter(Boolean).forEach((l,i)=>{
    const p=l.split('|').map(s=>s.trim()); if(p.length<3||!/^\d{1,2}:\d{2}$/.test(p[1])||!/^\d{1,2}:\d{2}$/.test(p[2])){ mal++; return; }
    const dias=(p[3]||'').split(',').map(x=>dk.indexOf(nkey(x).slice(0,3))).filter(d=>d>=0);
    const prev=(promos.bloquesRec||[])[i];
    out.push({id:prev?prev.id:'b'+Date.now().toString(36)+i,nombre:p[0],desde:p[1].padStart(5,'0'),hasta:p[2].padStart(5,'0'),dias:[...new Set(dias)].length?[...new Set(dias)]:[1,2,3,4,5,6]});
  });
  if(mal||!out.length){ showToast('Revisá las líneas: nombre | 09:00 | 14:30 | días'); return; }
  promos.bloquesRec=out; promos.avisoAperturaMin=Math.max(0,Math.round(numV(v[1])))||5; savePromos(); showToast('Bloques guardados ✓'); renderAdmin();
}
function abrirBloquesUsuario(id){
  const u=allUsers.find(x=>x.id===id); if(!u) return;
  document.getElementById('registro-content').innerHTML=cabeceraModal('Bloques de '+escH(u.name))+`<div style="font-size:12px;color:var(--muted2);margin-bottom:10px">Solo ve las tareas de sus bloques y solo se le cuentan los turnos que se hacen en ese horario.</div>
    ${(promos.bloquesRec||[]).map(b=>`<label class="rub-opt"><input type="checkbox" class="bq-chk" value="${b.id}" ${(u.bloquesRec||[]).includes(b.id)?'checked':''}/> ${escH(b.nombre)} · ${b.desde} a ${b.hasta} <span style="color:var(--muted);font-size:11px">${(b.dias||[]).map(d=>DIAS_NOM[d]).join(', ')}</span></label>`).join('')}
    <button class="btn btn-primary" onclick="guardarBloquesUsuario('${u.id}')" style="margin-top:12px">Guardar</button>`;
  openModal('modal-registro');
}
async function guardarBloquesUsuario(id){
  const ids=[...document.querySelectorAll('.bq-chk:checked')].map(x=>x.value);
  if(await guardarCampoUsuario(id,{bloquesRec:ids,turnoRec:null})){ closeModal('modal-registro'); showToast('Guardado ✓'); renderAdmin(); }
}

// ---------- paquetes: ganancia del salon y comision de recepcion ----------
// Ganancia del salon (estimada) = lo cobrado menos lo que se les paga a los profesionales por esos servicios.
// Quien vende el paquete (recepcion) cobra un % de esa ganancia; el % se cambia desde el admin.
const recPaq=()=>({pct:10,comProf:45,...(promos.recPaq||{})});
// Podologia, cosmetologia, cejas y masajes: el profesional cobra 70% (confirmado 21/09/2026). El resto va por el tramo base de siempre.
const RUBROS_ALTA_COM=['podologia','cosmetologia','cejas','masajes'];
function comisionRubroEstim(rubroId){
  const cfg=promos.comisionRubro||{};
  if(cfg[rubroId]!=null) return numV(cfg[rubroId]);
  if(RUBROS_ALTA_COM.includes(rubroId)) return 70;
  return numV((tramosVigentes()[0]||{pct:45}).pct);
}
// Tramos de comision de quien vende paquetes, segun lo facturado en paquetes en la quincena (no por venta)
function tramosPaquete(){ return (promos.recPaqTramos&&promos.recPaqTramos.length?promos.recPaqTramos:[{min:0,pct:10},{min:400000,pct:15},{min:800000,pct:20}]).slice().sort((a,b)=>a.min-b.min); }
function pctPaqueteDe(recId,qk){ const fact=facturadoPaqQuincena(recId,qk); const T=tramosPaquete(); let pct=T[0]?T[0].pct:10; T.forEach(t=>{ if(fact>=t.min) pct=t.pct; }); return {pct,fact}; }
function gananciaPaquete(p){ return Math.round(numV(p.total)-(p.items||[]).reduce((s,i)=>s+numV(i.final)*comisionRubroEstim(i.rubro)/100,0)); }
function comRecPaquete(p){ if(p.vendedorRol!=='recepcionista') return 0; const {pct}=pctPaqueteDe(p.vendedorId,quincenaKey(p.fecha)); return Math.round(Math.max(0,gananciaPaquete(p))*pct/100); }
// ---------- costo por servicio (insumos) y capacidad ----------
function finCostos(c){
  const L=finData.consumibles||[]; const cf=cfgFin();
  const porRubro={}; rubros.forEach(r=>{ porRubro[r.id]=costoInsumosServicio(r.id); });
  c.innerHTML=`<div class="sec-hdr" style="margin:0 0 8px"><span class="sec-title">🧴 Insumos por servicio</span><button class="lnk" onclick="editarConsumible('')">+ Nuevo</button></div>
    <div class="card" style="margin-bottom:10px;font-size:12px;color:var(--muted2);line-height:1.5">Lo que se gasta en <b style="color:var(--text)">cada servicio</b>. Ej: un gel de afeitar de $10.000 que rinde 200 servicios cuesta $50 por servicio; una cera de $10.000 que rinde 80, $125. Se usa en el punto de equilibrio para calcular el costo variable de cada servicio.</div>
    ${L.map(x=>`<div class="card" style="margin-bottom:6px;padding:10px 12px"><div style="display:flex;align-items:center;gap:10px"><div style="flex:1;min-width:0"><div style="font-size:13px;font-weight:800">${escH(x.nombre)}</div><div style="font-size:11px;color:var(--muted2)">${fp(x.precio)} · rinde ${x.rinde} servicios · ${x.rubro?escH(rubrosNombres(x.rubro)):'todos los rubros'}</div></div><div style="text-align:right"><b style="font-size:14px">${fp(numV(x.precio)/Math.max(1,numV(x.rinde)))}</b><div style="font-size:10px;color:var(--muted)">por servicio</div></div><button class="lnk" onclick="editarConsumible('${x.id}')">✏️</button><button class="lnk" style="color:#f472b6" onclick="borrarConsumible('${x.id}')">×</button></div></div>`).join('')||'<div class="empty"><div class="e-icon">🧴</div><p>Todavía no cargaste insumos.</p></div>'}
    ${rubros.some(r=>porRubro[r.id]>0)?`<div class="card" style="margin:10px 0"><div style="font-size:11px;font-weight:800;color:var(--muted);text-transform:uppercase;letter-spacing:.08em;margin-bottom:4px">Insumos por servicio, por rubro</div>${rubros.filter(r=>porRubro[r.id]>0).map(r=>linea(escH(r.nombre),'<b>'+fp(porRubro[r.id])+'</b>')).join('')}</div>`:''}
    <div class="sec-hdr" style="margin:16px 0 8px"><span class="sec-title">📐 Capacidad y reservas</span><button class="lnk" onclick="editarCapacidad()">Editar</button></div>
    <div class="card" style="font-size:12.5px;line-height:1.8">Días de trabajo por mes: <b>${cf.diasLab}</b> · Turnos por día por profesional: <b>${cf.turnosDia}</b><br>Capacidad por profesional: <b>${cf.diasLab*cf.turnosDia}</b> servicios al mes con la agenda llena.<br>Del resultado del mes se separa: reservas <b>${cf.reserva}%</b> · inversiones <b>${cf.inversion}%</b> · retiros de socios <b>${cf.retiros}%</b> (se ven en el flujo anual).</div>`;
}
async function editarConsumible(id){
  const x=id?finData.consumibles.find(z=>z.id===id):null;
  const v=await uiDialog({title:x?'Editar insumo':'Nuevo insumo',fields:[{label:'Nombre',placeholder:'Ej: Gel de afeitar',value:x?x.nombre:''},{label:'Precio de compra (por unidad)',type:'number',value:x?x.precio:''},{label:'Cuántos servicios rinde cada unidad',type:'number',value:x?x.rinde:'',placeholder:'Ej: 200'},{label:'Rubros (ids separados por coma, vacío = todos)',value:x?x.rubro:'barberia,barberia-premium'},{label:'Unidad (bidón, rollo, caja…)',value:x?x.unidad||'unidad':'unidad'},{label:'Unidades en stock',type:'number',value:x?numV(x.stock):0},{label:'Avisarme cuando queden',type:'number',value:x&&x.alerta!=null?x.alerta:2}],ok:'Guardar'});
  if(!v) return; const nombre=v[0].trim(), precio=numV(v[1]), rinde=numV(v[2]);
  if(!nombre||precio<=0||rinde<=0){ showToast('Poné nombre, precio y cuántos servicios rinde'); return; }
  const ahora=new Date().toISOString();
  await cambiarFin(d=>{ if(!d.consumibles) d.consumibles=[]; const z=id?d.consumibles.find(k=>k.id===id):null; const dato={nombre,precio,rinde,rubro:v[3].trim(),unidad:v[4].trim()||'unidad',stock:numV(v[5]),alerta:numV(v[6]),upd:ahora}; if(z) Object.assign(z,dato); else d.consumibles.push({id:'c'+Date.now().toString(36),...dato}); });
  showToast('Guardado ✓'); renderAdmin();
}
async function borrarConsumible(id){ if(!await uiConfirm('¿Borrar este insumo?','',{ok:'Borrar'})) return; await cambiarFin(d=>{ d.consumibles=d.consumibles.filter(x=>x.id!==id); d.borrados=[...(d.borrados||[]),id]; }); renderAdmin(); }
async function editarCapacidad(){
  const cf=cfgFin();
  const v=await uiDialog({title:'Capacidad y reservas',fields:[{label:'Días de trabajo por mes',type:'number',value:cf.diasLab},{label:'Turnos por día por profesional',type:'number',value:cf.turnosDia},{label:'Reservas de dinero (% del resultado)',type:'number',value:cf.reserva},{label:'Inversiones (% del resultado)',type:'number',value:cf.inversion},{label:'Retiros de socios (% del resultado)',type:'number',value:cf.retiros}],ok:'Guardar'});
  if(!v) return; await cambiarFin(d=>{ d.cfg={diasLab:numV(v[0])||22,turnosDia:numV(v[1])||10,reserva:numV(v[2]),inversion:numV(v[3]),retiros:numV(v[4])}; }); renderAdmin();
}

// ---------- flujo anual (como la hoja "Cash Flow" de la planilla) ----------
let cajaAnioCargado={};
async function asegurarCajaAnio(y){
  if(cajaAnioCargado[y]||!DB) return; cajaAnioCargado[y]=true; let cambio=false;
  for(let m=1;m<=12;m++){ const ym=y+'-'+pad2(m); if(cajaDocs[ym]) continue; try{ const r=await DB.doc('luffy/caja_'+ym).get(); if(r){ cajaDocs[ym]={sesiones:[]}; mergeCajaDoc(ym,r); persistCaja(ym); cambio=true; } }catch(e){} }
  if(cambio) refreshCurrentView();
}
function finFlujo(c){
  const y=finState.anio||Number(hoyStr().slice(0,4)); asegurarCajaAnio(y);
  const ids=finState.suc==='todas'?sucursales.map(s=>s.id):[finState.suc]; const cf=cfgFin();
  const pre={D:adminDatos()}; pre.pctMap=pctPorQuincena(pre.D);
  const M=[]; for(let m=1;m<=12;m++){ const d=y+'-'+pad2(m)+'-01', h=y+'-'+pad2(m)+'-'+finMesUTC(y,m); M.push(juntarS(finCalc(d,h,pre),ids)); }
  const filas=[]; const suma=(f)=>M.reduce((a,t)=>a+f(t),0);
  const profs=[...new Set(M.flatMap(t=>Object.keys(t.porProf)))].map(id=>allUsers.find(u=>u.id===id)).filter(Boolean);
  const ingRows=[...profs.map(u=>({n:'Ingresos '+u.name,f:t=>t.porProf[u.id]||0})),{n:'Venta de productos',f:t=>t.ing.productos},{n:'Membresías',f:t=>t.ing.membresias},{n:'Paquetes',f:t=>t.ing.paquetes},{n:'Señas recibidas',f:t=>t.ing.senas||0}];
  const catsUsadas=[...CAT_GASTOS,...CAT_AUTO].filter(cat=>suma(t=>t.eg[cat.id]||0)>0.5);
  const egRows=catsUsadas.map(cat=>({n:cat.n,c:cat.c,f:t=>t.eg[cat.id]||0}));
  const totIng=M.map(t=>sumaIng(t)), totEg=M.map(t=>sumaEg(t)), res=M.map((t,i)=>totIng[i]-totEg[i]);
  const rsv=res.map(v=>Math.max(0,v)*cf.reserva/100), inv=res.map(v=>Math.max(0,v)*cf.inversion/100), ret=res.map(v=>Math.max(0,v)*cf.retiros/100), neto=res.map((v,i)=>v-rsv[i]-inv[i]-ret[i]);
  const T=(arr)=>arr.reduce((a,b)=>a+b,0), TI=T(totIng), TE=T(totEg);
  const celda=(v,neg)=>`<td style="text-align:right;padding:5px 8px;white-space:nowrap;${v===0?'color:var(--muted)':''}${neg&&v<0?';color:#f472b6':''}">${v===0?'—':fp(v)}</td>`;
  const fila=(n,vals,base,extra)=>{ const t=T(vals); return `<tr style="${extra||''}"><td style="padding:5px 8px;position:sticky;left:0;background:var(--s1);white-space:nowrap;font-size:12px">${n}</td>${vals.map(v=>celda(v,extra&&extra.includes('bold'))).join('')}<td style="text-align:right;padding:5px 8px;font-weight:800;white-space:nowrap">${t===0?'—':fp(t)}</td><td style="text-align:right;padding:5px 8px;color:var(--muted2);font-size:11px">${base>0&&t!==0?Math.round(t/base*100)+'%':''}</td></tr>`; };
  const titulo=(t)=>`<tr><td colspan="15" style="padding:10px 8px 4px;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:var(--muted)">${t}</td></tr>`;
  c.innerHTML=`<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px"><button onclick="finSet('anio',${y-1})" style="${pillStyle(false,'#4A136B')}">‹ ${y-1}</button><button style="${pillStyle(true,'#4A136B')}">${y}</button><button onclick="finSet('anio',${y+1})" style="${pillStyle(false,'#4A136B')}">${y+1} ›</button></div>
    <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px"><button onclick="finSet('suc','todas')" style="${pillStyle(finState.suc==='todas','#4A136B')}">📍 Todas</button>${sucursales.map(s=>`<button onclick="finSet('suc','${s.id}')" style="${pillStyle(finState.suc===s.id,s.color)}">${escH(s.nombre)}</button>`).join('')}</div>
    <div class="sec-title" style="margin-bottom:6px">📆 Flujo anual ${y}</div>
    <div style="overflow-x:auto;border:1px solid var(--border);border-radius:12px;background:var(--s1)"><table style="border-collapse:collapse;font-size:12px;min-width:1100px;width:100%">
      <thead><tr><th style="text-align:left;padding:8px;position:sticky;left:0;background:var(--s1)"></th>${MESES.map(n=>`<th style="text-align:right;padding:8px;font-size:10.5px;text-transform:uppercase;color:var(--muted2)">${n.slice(0,3)}</th>`).join('')}<th style="text-align:right;padding:8px;font-size:10.5px">TOTAL</th><th style="text-align:right;padding:8px;font-size:10.5px">%</th></tr></thead><tbody>
      ${titulo('Ingresos')}${ingRows.map(r=>fila(escH(r.n),M.map(r.f),TI)).join('')}${fila('<b>TOTAL INGRESOS</b>',totIng,TI,'font-weight:800;border-top:1.5px solid var(--border2)')}
      ${titulo('Gastos')}${egRows.map(r=>fila(`<span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:${r.c};margin-right:6px"></span>${escH(r.n)}`,M.map(r.f),TE)).join('')}${fila('<b>TOTAL GASTOS</b>',totEg,TE,'font-weight:800;border-top:1.5px solid var(--border2)')}
      ${fila('<b>TOTAL INGRESOS − GASTOS</b>',res,TI,'font-weight:800;bold;background:var(--s2)')}
      ${fila('Reservas de dinero ('+cf.reserva+'%)',rsv,0)}${fila('Inversiones ('+cf.inversion+'%)',inv,0)}${fila('Retiros de socios ('+cf.retiros+'%)',ret,0)}
      ${fila('<b>SALDO NETO</b>',neto,TI,'font-weight:800;bold;background:var(--s2)')}
    </tbody></table></div>
    <div style="font-size:10.5px;color:var(--muted);margin-top:8px;line-height:1.5">Reservas, inversiones y retiros se calculan sobre el resultado de cada mes (solo si es positivo) con los porcentajes de "Costo por servicio". El % de cada gasto es sobre el total de gastos; el de cada ingreso, sobre el total de ingresos.</div>`;
}
// ============ CALENDARIO DE TURNOS DE RECEPCION ============
// El admin arma el calendario: cada dia esta dividido en bloques (mañana / tarde) y en cada bloque va una recepcionista.
// Se puede fijar para todas las semanas (plantilla por dia de la semana) o cambiar un dia puntual (excepcion).
// Cada recepcionista ve sus turnos en su pantalla, con un calendario interactivo.
let turnosRec={plantilla:{},exc:{}};
let calRec={mes:null,sel:null,ctx:'admin'};
const PALETA_REC=['#34d399','#60a5fa','#f472b6','#fbbf24','#a78bfa','#fb923c'];
const dowDe=(f)=>new Date(f+'T00:00:00Z').getUTCDay();
const diaActivo=(b,f)=>!b.dias||!b.dias.length||b.dias.includes(dowDe(f));
function persistTurnosRec(){ try{ localStorage.setItem('luffy_turnos_rec',JSON.stringify(turnosRec)); }catch(e){} }
function loadTurnosRec(){
  try{ const r=JSON.parse(localStorage.getItem('luffy_turnos_rec')||'null'); if(r) turnosRec={plantilla:{},exc:{},...r}; }catch(e){}
  if(DB) DB.doc('luffy/turnos_rec').get().then(r=>{ if(r&&JSON.stringify({plantilla:{},exc:{},...r})!==JSON.stringify(turnosRec)){ turnosRec={plantilla:{},exc:{},...r}; persistTurnosRec(); refreshCurrentView(); } }).catch(()=>{});
}
function saveTurnosRec(){ persistTurnosRec(); if(DB){ try{ DB.doc('luffy/turnos_rec').set(turnosRec); }catch(e){} } }
function asignadoEn(f,bid){
  const e=turnosRec.exc[f]; if(e&&Object.prototype.hasOwnProperty.call(e,bid)) return e[bid]||null;
  return (turnosRec.plantilla[dowDe(f)]||{})[bid]||null;
}
function hayCalendario(){ return Object.values(turnosRec.plantilla).some(o=>Object.values(o).some(Boolean))||Object.values(turnosRec.exc).some(o=>Object.values(o).some(Boolean)); }
// Bloques que tiene una persona en una fecha (con el calendario; si todavia no hay calendario, los "bloques fijos" viejos)
function bloquesDeUsuarioEn(u,f){
  if(!u) return [];
  const L=(promos.bloquesRec||[]).filter(b=>diaActivo(b,f));
  return hayCalendario()?L.filter(b=>asignadoEn(f,b.id)===u.id):L.filter(b=>(u.bloquesRec||[]).includes(b.id));
}
function colorRec(u){ const L=allUsers.filter(x=>x.role==='recepcionista'); const i=L.findIndex(x=>x.id===u.id); return PALETA_REC[(i<0?0:i)%PALETA_REC.length]; }
function proximosTurnosDe(u,dias){ const out=[]; const hoy=hoyStr(); for(let i=0;i<dias;i++){ const f=addDias(hoy,i); bloquesDeUsuarioEn(u,f).forEach(b=>out.push({f,b})); } return out; }
const DIAS_CORTO=['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
const fechaLarga=(f)=>DIAS_LARGO[dowDe(f)]+' '+fechaCortaStr(f);

// ---------- grilla del mes ----------
function celdasMes(mes){
  const [y,m]=mes.split('-').map(Number); const n=finMesUTC(y,m); const primero=(new Date(Date.UTC(y,m-1,1)).getUTCDay()+6)%7;
  const c=[]; for(let i=0;i<primero;i++) c.push(null); for(let d=1;d<=n;d++) c.push(mes+'-'+pad2(d)); while(c.length%7) c.push(null); return c;
}
function calNav(d){ const [y,m]=(calRec.mes||hoyStr().slice(0,7)).split('-').map(Number); const n=new Date(Date.UTC(y,m-1+d,1)); calRec.mes=n.getUTCFullYear()+'-'+pad2(n.getUTCMonth()+1); calRec.sel=null; refrescarCal(); }
function calHoy(){ calRec.mes=hoyStr().slice(0,7); calRec.sel=hoyStr(); refrescarCal(); }
function calSel(f){ calRec.sel=(calRec.sel===f?null:f); refrescarCal(); }
function refrescarCal(){ if(calRec.ctx==='rec') renderCalendarioRec(); else renderAdmin(); }
function htmlGridMes(modo){
  const mes=calRec.mes||(calRec.mes=hoyStr().slice(0,7)); const hoy=hoyStr(); const [y,m]=mes.split('-').map(Number);
  const bl=promos.bloquesRec||[]; const yo=profile;
  const celdas=celdasMes(mes);
  const head=['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'].map(d=>`<div style="text-align:center;font-size:10px;font-weight:800;color:var(--muted);text-transform:uppercase;padding:4px 0">${d}</div>`).join('');
  const cel=celdas.map(f=>{
    if(!f) return '<div></div>';
    const esHoy=f===hoy, sel=calRec.sel===f;
    const pills=bl.map(b=>{
      if(!diaActivo(b,f)) return `<div style="margin-top:3px;height:17px;border-radius:6px;background:var(--s2);opacity:.35"></div>`;
      const uid=asignadoEn(f,b.id), u=allUsers.find(x=>x.id===uid); const col=u?colorRec(u):null; const mio=modo==='rec'&&yo&&uid===yo.id;
      const fondo=!u?'transparent':(modo==='rec'&&!mio?col+'18':col+'44');
      const borde=!u?'1.5px dashed var(--border2)':`1.5px solid ${modo==='rec'&&!mio?col+'55':col}`;
      const txt=u?escH(u.name.split(' ')[0]):'—';
      const click=modo==='admin'?`onclick="event.stopPropagation();asignarTurnoRec('${f}','${b.id}')"`:'';
      return `<div ${click} title="${escH(b.nombre)}" style="margin-top:3px;background:${fondo};border:${borde};color:${u?(mio||modo==='admin'?'var(--text)':'var(--muted2)'):'var(--muted)'};border-radius:6px;font-size:9.5px;font-weight:${mio?900:700};padding:2px 2px;text-align:center;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;${modo==='admin'?'cursor:pointer':''}">${txt}</div>`;
    }).join('');
    return `<div onclick="calSel('${f}')" style="cursor:pointer;border:1.5px solid ${sel?'#4A136B':(esHoy?'#fbbf24':'var(--border)')};background:${sel?'rgba(74,19,107,.10)':'var(--s1)'};border-radius:10px;padding:4px;min-height:${bl.length*20+24}px"><div style="font-size:11px;font-weight:${esHoy?900:700};color:${esHoy?'#fbbf24':'var(--muted2)'}">${Number(f.slice(8))}</div>${pills}</div>`;
  }).join('');
  return `<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px"><button onclick="calNav(-1)" style="background:var(--s2);border:none;color:var(--text);width:34px;height:34px;border-radius:50%;cursor:pointer;font-size:16px">‹</button><div style="flex:1;text-align:center;font-size:14px;font-weight:800">${MESES[m-1].charAt(0).toUpperCase()+MESES[m-1].slice(1)} ${y}</div><button onclick="calHoy()" style="background:var(--s2);border:none;color:var(--muted2);padding:0 12px;height:34px;border-radius:17px;cursor:pointer;font-family:var(--font);font-size:11.5px;font-weight:800">Hoy</button><button onclick="calNav(1)" style="background:var(--s2);border:none;color:var(--text);width:34px;height:34px;border-radius:50%;cursor:pointer;font-size:16px">›</button></div>
    <div style="display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:4px">${head}${cel}</div>
    <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:8px;font-size:10.5px;color:var(--muted2)">${bl.map(b=>`<span>${escH(b.nombre)} ${b.desde}–${b.hasta}</span>`).join(' · ')}</div>`;
}
function htmlDetalleDia(f,modo){
  const bl=(promos.bloquesRec||[]).filter(b=>diaActivo(b,f));
  const filas=bl.map(b=>{ const u=allUsers.find(x=>x.id===asignadoEn(f,b.id)); const cs=todasSesiones().find(s=>s.fecha===f&&s.bloque===b.id);
    return `<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border)"><div style="width:10px;height:36px;border-radius:4px;background:${u?colorRec(u):'var(--border2)'}"></div><div style="flex:1"><div style="font-size:13px;font-weight:800">${escH(b.nombre)} · ${b.desde} a ${b.hasta}</div><div style="font-size:12px;color:var(--muted2)">${u?escH(u.name)+(modo==='rec'&&profile&&u.id===profile.id?' (vos)':''):'Sin recepcionista asignada'}${modo==='admin'&&cs?` · abrió la caja a las ${horaDeIso(cs.apertura.ts)}${cs.cierre?' y cerró '+horaDeIso(cs.cierre.ts):''}`:''}</div></div>${modo==='admin'?`<button class="lnk" onclick="asignarTurnoRec('${f}','${b.id}')">Cambiar</button>`:''}</div>`; }).join('');
  return `<div class="card" style="margin-top:10px"><div style="font-size:13px;font-weight:800;margin-bottom:2px">${fechaLarga(f)}${f===hoyStr()?' · hoy':''}</div>${filas||'<div style="font-size:12px;color:var(--muted)">No hay bloques ese día.</div>'}</div>`;
}
function htmlLeyendaRec(){
  const mes=calRec.mes||hoyStr().slice(0,7); const dias=celdasMes(mes).filter(Boolean); const bl=promos.bloquesRec||[];
  return `<div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:10px">${allUsers.filter(u=>u.role==='recepcionista').map(u=>{ const n=dias.reduce((a,f)=>a+bl.filter(b=>diaActivo(b,f)&&asignadoEn(f,b.id)===u.id).length,0); return `<span style="display:inline-flex;align-items:center;gap:6px;background:${colorRec(u)}22;border:1.5px solid ${colorRec(u)};border-radius:14px;padding:4px 10px;font-size:11.5px;font-weight:800">${escH(u.name)} <span style="color:var(--muted2);font-weight:700">${n} turnos</span></span>`; }).join('')}</div>`;
}

// ---------- admin: calendario ----------
function htmlCalendarioAdmin(){
  calRec.ctx='admin';
  return `<div class="sec-hdr" style="margin:6px 0 8px"><span class="sec-title">🗓 Calendario de turnos de recepción</span><button class="lnk" onclick="editarBloquesRec()">Editar bloques</button></div>
    <div class="card" style="margin-bottom:10px;font-size:12px;color:var(--muted2);line-height:1.5">Tocá un bloque de cualquier día para elegir quién lo hace. Podés dejarlo <b style="color:var(--text)">fijo todas las semanas</b> o cambiar solo ese día. Cada recepcionista ve sus turnos en su pantalla${hayCalendario()?'':'. <b style="color:#fbbf24">Todavía no cargaste ningún turno</b>: mientras tanto valen los bloques fijos de cada persona'}.</div>
    ${htmlGridMes('admin')}${htmlLeyendaRec()}${calRec.sel?htmlDetalleDia(calRec.sel,'admin'):''}
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px"><button class="btn btn-ghost" style="flex:1;min-width:140px" onclick="copiarSemanaTurnos()">↻ Repetir una semana en el mes</button><button class="btn btn-ghost" style="flex:1;min-width:140px;color:#f472b6" onclick="limpiarTurnosMes()">Vaciar este mes</button></div>`;
}
function asignarTurnoRec(f,bid){
  const b=(promos.bloquesRec||[]).find(x=>x.id===bid); if(!b) return;
  const recs=allUsers.filter(u=>u.role==='recepcionista'); const act=asignadoEn(f,bid);
  window.__asig={f,bid};
  document.getElementById('registro-content').innerHTML=cabeceraModal(fechaLarga(f))+`<div style="font-size:12.5px;color:var(--muted2);margin-bottom:10px">${escH(b.nombre)} · ${b.desde} a ${b.hasta}</div>
    <div style="display:flex;flex-direction:column;gap:8px">${recs.map(u=>`<button onclick="confirmarAsignacion('${u.id}')" style="display:flex;align-items:center;gap:10px;padding:12px 14px;border-radius:14px;border:2px solid ${act===u.id?colorRec(u):'var(--border2)'};background:${act===u.id?colorRec(u)+'22':'var(--s2)'};color:var(--text);font-family:var(--font);font-size:14px;font-weight:800;cursor:pointer"><span style="width:14px;height:14px;border-radius:50%;background:${colorRec(u)}"></span>${escH(u.name)}${act===u.id?' <span style="margin-left:auto;font-size:11px;color:var(--muted2)">asignada</span>':''}</button>`).join('')||'<div style="font-size:12.5px;color:var(--muted)">No hay recepcionistas. Aprobá una cuenta en Equipo.</div>'}
      <button onclick="confirmarAsignacion('')" style="padding:12px 14px;border-radius:14px;border:2px dashed var(--border2);background:transparent;color:var(--muted2);font-family:var(--font);font-size:13px;font-weight:700;cursor:pointer">Sin asignar</button></div>
    <label class="rub-opt" style="margin-top:12px"><input type="checkbox" id="asig-rep"/> 🔁 Repetir todos los ${DIAS_LARGO[dowDe(f)].toLowerCase()}s</label>`;
  openModal('modal-registro');
}
function migrarLegacyCalendario(){
  if(hayCalendario()) return;
  allUsers.filter(u=>u.role==='recepcionista').forEach(u=>(u.bloquesRec||[]).forEach(bid=>{ const b=(promos.bloquesRec||[]).find(x=>x.id===bid); if(!b) return; (b.dias||[0,1,2,3,4,5,6]).forEach(d=>{ turnosRec.plantilla[d]=turnosRec.plantilla[d]||{}; if(!turnosRec.plantilla[d][bid]) turnosRec.plantilla[d][bid]=u.id; }); }));
}
function confirmarAsignacion(uid){
  const {f,bid}=window.__asig||{}; if(!f) return; const rep=document.getElementById('asig-rep')?.checked;
  migrarLegacyCalendario();
  if(rep){ const d=dowDe(f); turnosRec.plantilla[d]=turnosRec.plantilla[d]||{}; if(uid) turnosRec.plantilla[d][bid]=uid; else delete turnosRec.plantilla[d][bid]; if(turnosRec.exc[f]) delete turnosRec.exc[f][bid]; }
  else { turnosRec.exc[f]=turnosRec.exc[f]||{}; turnosRec.exc[f][bid]=uid||''; }
  saveTurnosRec(); closeModal('modal-registro'); renderAdmin();
}
async function copiarSemanaTurnos(){
  const mes=calRec.mes||hoyStr().slice(0,7); const lunes=celdasMes(mes).filter(Boolean).filter(f=>dowDe(f)===1);
  const v=await uiPrompt('Repetir una semana',{msg:'Elegí el lunes de la semana que querés copiar (día del mes: '+lunes.map(f=>Number(f.slice(8))).join(', ')+'). Se repite todas las semanas de ese día en adelante.',label:'Lunes (número de día)',type:'number',value:lunes.length?Number(lunes[0].slice(8)):1,ok:'Repetir'});
  if(v===null) return; const f0=mes+'-'+pad2(parseInt(v)||1); if(dowDe(f0)!==1){ showToast('Ese día no es lunes'); return; }
  migrarLegacyCalendario();
  for(let i=0;i<7;i++){ const f=addDias(f0,i), d=dowDe(f); turnosRec.plantilla[d]={}; (promos.bloquesRec||[]).forEach(b=>{ const u=asignadoEn(f,b.id); if(u) turnosRec.plantilla[d][b.id]=u; }); }
  Object.keys(turnosRec.exc).forEach(f=>{ if(f>=f0) delete turnosRec.exc[f]; });
  saveTurnosRec(); showToast('Semana repetida ✓'); renderAdmin();
}
async function limpiarTurnosMes(){
  const mes=calRec.mes||hoyStr().slice(0,7);
  if(!await uiConfirm('¿Vaciar los turnos de '+mes+'?','Deja sin asignar todos los bloques de este mes (no toca los otros meses ni los turnos fijos de cada semana).',{ok:'Vaciar'})) return;
  celdasMes(mes).filter(Boolean).forEach(f=>{ turnosRec.exc[f]={}; (promos.bloquesRec||[]).forEach(b=>{ turnosRec.exc[f][b.id]=''; }); });
  saveTurnosRec(); renderAdmin();
}

// ---------- recepcionista: sus turnos ----------
function htmlMisTurnosRec(){
  const u=profile; if(!u||!hayCalendario()) return '';
  const hoy=hoyStr(), ahora=horaAhora(); const mios=bloquesDeUsuarioEn(u,hoy); const prox=proximosTurnosDe(u,21).filter(x=>!(x.f===hoy)).slice(0,6);
  const trabajando=mios.find(b=>b.desde<=ahora&&ahora<b.hasta);
  const otros=(promos.bloquesRec||[]).filter(b=>diaActivo(b,hoy)&&!mios.includes(b)).map(b=>({b,u:allUsers.find(x=>x.id===asignadoEn(hoy,b.id))})).filter(x=>x.u);
  return `<div class="card" style="margin-top:14px"><div style="display:flex;align-items:center;gap:10px;margin-bottom:8px"><div style="font-size:22px">🗓</div><div style="flex:1"><div style="font-size:14px;font-weight:800">Mis turnos</div><div style="font-size:11.5px;color:${trabajando?'#34d399':'var(--muted2)'}">${trabajando?'🟢 Estás en turno ('+escH(trabajando.nombre)+' hasta las '+trabajando.hasta+')':(mios.length?'Hoy: '+mios.map(b=>escH(b.nombre)+' '+b.desde+'–'+b.hasta).join(' + '):'Hoy no tenés turno')}${otros.length?' · '+otros.map(x=>escH(x.b.nombre)+': '+escH(x.u.name.split(' ')[0])).join(' · '):''}</div></div><button onclick="abrirCalendarioRec()" style="padding:9px 14px;border-radius:12px;border:none;background:${colorRec(u)};color:#0b0b10;font-family:var(--font);font-size:12.5px;font-weight:800;cursor:pointer">Ver calendario</button></div>
    <div style="display:flex;gap:6px;overflow-x:auto;padding-bottom:2px">${prox.map(x=>`<button onclick="abrirCalendarioRec('${x.f}')" style="flex:0 0 auto;padding:8px 12px;border-radius:12px;border:1.5px solid ${colorRec(u)}66;background:${colorRec(u)}14;color:var(--text);font-family:var(--font);font-size:11.5px;font-weight:700;cursor:pointer;text-align:left"><div style="font-weight:900">${DIAS_CORTO[dowDe(x.f)]} ${fechaCortaStr(x.f)}</div><div style="color:var(--muted2)">${escH(x.b.nombre)} ${x.b.desde}–${x.b.hasta}</div></button>`).join('')||'<div style="font-size:12px;color:var(--muted)">No tenés turnos asignados en las próximas 3 semanas.</div>'}</div></div>`;
}
function abrirCalendarioRec(f){
  calRec.ctx='rec'; calRec.mes=(f||hoyStr()).slice(0,7); calRec.sel=f||hoyStr();
  renderCalendarioRec(); openModal('modal-registro');
}
function renderCalendarioRec(){
  const n=proximosTurnosDe(profile,31).length;
  document.getElementById('registro-content').innerHTML=`<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px"><div class="modal-title" style="margin:0">Mis turnos 🗓</div><button onclick="calRec.ctx='admin';closeModal('modal-registro')" style="margin-left:auto;background:var(--s3);border:none;color:var(--muted2);font-size:18px;width:32px;height:32px;border-radius:50%;cursor:pointer">×</button></div>
    <div style="font-size:12px;color:var(--muted2);margin-bottom:10px">Tu color: <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${colorRec(profile)};vertical-align:middle"></span> · próximos 30 días: <b style="color:var(--text)">${n} ${n===1?'turno':'turnos'}</b>. Tocá un día para ver el detalle.</div>
    ${htmlGridMes('rec')}${calRec.sel?htmlDetalleDia(calRec.sel,'rec'):''}`;
}

