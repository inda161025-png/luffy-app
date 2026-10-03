// ============ DINERO: guardado seguro + DEUDAS ============
// Cada profesional tiene su propio doc de dinero, pero recepcion/admin tambien escriben ahi
// (cuando cobran una deuda). Para que nadie pise lo del otro, todo se guarda "uniendo" por id.
function mergeDinero(target,remote){
  if(!remote) return false;
  let changed=false;
  ['turnos','ventas','gastosMP'].forEach(k=>{
    if(!target[k]) target[k]=[];
    const ids=new Set(target[k].map(x=>x.id));
    (remote[k]||[]).forEach(x=>{ if(!ids.has(x.id)){ target[k].push(x); changed=true; } });
  });
  if(!target.deudores) target.deudores=[];
  (remote.deudores||[]).forEach(rd=>{
    const ld=target.deudores.find(x=>x.id===rd.id);
    if(!ld){ target.deudores.push(rd); changed=true; }
    else {
      const ya=new Set((ld.pagos||[]).map(p=>p.id)); const nuevos=(rd.pagos||[]).filter(p=>!ya.has(p.id));
      if(nuevos.length){ ld.pagos=[...(ld.pagos||[]),...nuevos]; changed=true; }
      if(rd.saldado&&!ld.saldado){ const pg=ld.pagos; Object.assign(ld,rd); if(pg) ld.pagos=pg; changed=true; }
    }
  });
  return changed;
}
function saveDinero(){
  const pid=profile.id, mine=dineroData;
  normalizarFechas(mine);
  try{localStorage.setItem('luffy_dinero_'+pid,JSON.stringify(mine));}catch(e){}
  if(!DB) return;
  const ref=DB.doc('luffy/dinero_'+pid);
  Promise.resolve(ref.get()).then(remote=>{
    const changed=mergeDinero(mine,remote);
    try{localStorage.setItem('luffy_dinero_'+pid,JSON.stringify(mine));}catch(e){}
    return Promise.resolve(ref.set(mine)).then(()=>{ if(changed&&dineroData===mine) refreshCurrentView(); });
  }).catch(()=>{ try{ref.set(mine);}catch(e){} });
}
// El profesional se entera de lo que cobra recepcion/admin sin tener que reiniciar
let dineroPollTimer=null;
function refrescarDineroPropio(){
  if(!DB||!profile||profile.role!=='profesional') return;
  const pid=profile.id, mine=dineroData;
  Promise.resolve(DB.doc('luffy/dinero_'+pid).get()).then(remote=>{
    if(profile&&profile.id===pid&&dineroData===mine&&mergeDinero(mine,remote)){
      try{localStorage.setItem('luffy_dinero_'+pid,JSON.stringify(mine));}catch(e){}
      refreshCurrentView();
    }
  }).catch(()=>{});
}
// Lee-modifica-escribe el dinero de OTRA persona usando la copia mas fresca de la nube
function modificarDineroDe(profId,fn){
  const ref=DB?DB.doc('luffy/dinero_'+profId):null;
  return (ref?Promise.resolve(ref.get()).catch(()=>null):Promise.resolve(null)).then(remote=>{
    let dd=remote;
    if(!dd){ try{ dd=JSON.parse(localStorage.getItem('luffy_dinero_'+profId)||'null'); }catch(e){} }
    dd=dd||{};
    ['turnos','ventas','deudores'].forEach(k=>{ if(!dd[k]) dd[k]=[]; });
    normalizarFechas(dd);
    if(!fn(dd)) return false;
    try{localStorage.setItem('luffy_dinero_'+profId,JSON.stringify(dd));}catch(e){}
    if(ref) return Promise.resolve(ref.set(dd)).then(()=>true);
    return true;
  });
}

function quincenaLabel(f){
  const [y,m,d]=f.split('-').map(Number);
  const fin=new Date(Date.UTC(y,m,0)).getUTCDate();
  return (d<=15?'1 al 15':'16 al '+fin)+' de '+MESES[m-1];
}
function diasDesdeStr(f){ return Math.max(0,Math.round((new Date(hoyStr()+'T00:00:00Z')-new Date(f+'T00:00:00Z'))/86400000)); }

// Deudas pendientes de todo el equipo (usa la copia en memoria si es del usuario actual)
function todasLasDeudas(){
  const out=[];
  allUsers.filter(u=>esProf(u)||u.role==='recepcionista').forEach(u=>{
    let dd={};
    if(profile&&u.id===profile.id&&dineroData) dd=dineroData;
    else { try{ dd=JSON.parse(localStorage.getItem('luffy_dinero_'+u.id)||'{}'); }catch(e){} normalizarFechas(dd); }
    (dd.deudores||[]).filter(x=>!x.saldado).forEach(x=>out.push({...x,prof:u}));
  });
  return out.sort((a,b)=>new Date(a.creadoEn||a.fecha)-new Date(b.creadoEn||b.fecha));
}
function buscarDeuda(profId,id){ return todasLasDeudas().find(d=>d.id===id&&d.prof.id===profId); }
function detalleDeudaHtml(d,chico){
  const rr=(a,b,st='')=>`<div style="display:flex;justify-content:space-between;gap:8px;font-size:${chico?12:13}px;padding:2px 0;${st}"><span>${a}</span><span style="white-space:nowrap">${b}</span></div>`;
  const svc=(d.servicios&&d.servicios.length)?d.servicios.map(s=>rr(escH(nomSvc(s)),fp(s.precio))).join(''):(d.servicio||d.motivo?rr(escH(d.servicio||d.motivo),fp(numV(d.montoServicios!=null?d.montoServicios:d.monto))):'');
  const desc=(d.descDetalle&&d.descDetalle.length)?d.descDetalle.map(x=>rr(escH(x.label),'−'+fp(x.monto),'color:#34d399')).join(''):(d.descuento>0?rr(d.descuentoTipo==='oferta'?`🏷️ Oferta ${escH(d.oferta?d.oferta.nombre:'')}`:'Descuento','−'+fp(d.descuento),'color:#34d399'):'');
  const prods=(d.productos||[]).map(p=>rr(`📦 ${escH(p.productoNombre)} x${p.cantidad}`,fp(p.total),'color:var(--muted2)')).join('');
  return svc+desc+prods+htmlPagosDeuda(d);
}

// ---------- cobrar una deuda ----------
let cobroDeudaSel=null;
function puedeCobrarDeuda(profId,deudaId){
  if(!profile) return false; if(profile.role==='recepcionista') return true; if(profile.id!==profId) return false;
  const d=deudaId?buscarDeuda(profId,deudaId):null; return sinRecepcionId((d&&d.sucursal)||profile.sucursal);
}
// Aplica el pago sobre el dinero del profesional dueño de la deuda.
// La fecha del turno pasa a ser la del PAGO: asi cae en la quincena en que se cobra.
// El admin da de baja una deuda que no se va a cobrar. No suma a nadie; el producto ya salio del stock, queda como perdida.
async function anularDeuda(profId,id){
  const d=buscarDeuda(profId,id);
  if(!d){ showToast('Esa deuda ya no está pendiente'); return; }
  const v=await uiDialog({title:'¿Anular la deuda de '+d.cliente+'?',msg:'Son '+fp(saldoDeuda(d))+'. Deja de figurar como pendiente y no suma a la quincena de nadie. Los productos ya salieron del stock, así que queda como pérdida.',fields:[{label:'Motivo (opcional)',placeholder:'Ej: no se pudo ubicar al cliente'}],ok:'Anular deuda',danger:true});
  if(!v) return;
  const motivo=(v[0]||'').trim();
  modificarDineroDe(profId,dd=>{
    const x=(dd.deudores||[]).find(z=>z.id===id);
    if(!x||x.saldado) return false;
    x.saldado=true; x.anulada=true; x.anuladaEn=new Date().toISOString(); x.anuladaPor=profile.name; x.motivoAnulacion=motivo;
    return true;
  }).then(ok=>{ showToast(ok?'Deuda anulada':'Esa deuda ya no estaba pendiente'); refreshCurrentView(); }).catch(()=>showToast('No se pudo guardar, probá de nuevo'));
}
function saveYo(){ const pid=profile.id; try{localStorage.setItem('luffy_yo_'+pid,JSON.stringify(yoData));}catch(e){} if(DB){try{DB.doc('luffy/yo_'+pid).set(yoData);}catch(e){}} }
function saveHorario(){ const pid=profile.id; try{localStorage.setItem('luffy_horario_'+pid,JSON.stringify(horarioData));}catch(e){} if(DB){try{DB.doc('luffy/horario_'+pid).set(horarioData);}catch(e){}} }

// ---------- gastos con el Mercado Pago del local (se descuentan solos de la comisión) ----------
// Pedido de Ivo (1/10/2026): "los chicos no pueden anotar si hicieron un gasto con el mercadopago del local, y
// que se les descuente de su comisión". Automático al anotarlo (sin aprobación previa), solo monto + motivo,
// sin foto de comprobante -- confirmado con Ivo. Se descuenta en la quincena en que se anota (ver
// renderTrabajo() en 13-generador-editor.js).
function abrirFormGastoMP(){
  document.getElementById('registro-content').innerHTML='';
  renderFormGastoMP();
  openModal('modal-registro');
}
function renderFormGastoMP(){
  const color=(profile&&profile.color)||'#4A136B';
  document.getElementById('registro-content').innerHTML=cabeceraModal('💳 Gasto con el MP del local')+`
    <div style="font-size:12px;color:var(--muted2);margin-bottom:12px;line-height:1.5">Si usaste el Mercado Pago del local para algo tuyo, anotalo acá — se descuenta solo de tu comisión de esta quincena.</div>
    <div class="field"><label>Monto</label><input id="gmp-monto" type="number" inputmode="decimal" placeholder="0" autofocus/></div>
    <div class="field" style="margin-top:8px"><label>¿Para qué fue?</label><input id="gmp-motivo" placeholder="Ej: insumos personales"/></div>
    <button class="btn btn-primary" onclick="guardarGastoMP()" style="background:${color};margin-top:12px">Guardar</button>`;
}
function guardarGastoMP(){
  const monto=numV(document.getElementById('gmp-monto').value);
  const motivo=(document.getElementById('gmp-motivo').value||'').trim();
  if(monto<=0){ showToast('Poné el monto'); return; }
  if(!motivo){ showToast('Poné para qué fue'); return; }
  if(!dineroData.gastosMP) dineroData.gastosMP=[];
  dineroData.gastosMP.push({id:'gmp'+Date.now().toString(36)+Math.random().toString(36).slice(2,6),monto,motivo,fecha:hoyStr(),creadoEn:new Date().toISOString()});
  saveDinero();
  closeModal('modal-registro'); showToast('Anotado ✓ — se descuenta de tu comisión de esta quincena'); refreshCurrentView();
}
async function prewarm(){ try{ const s=await claudeAPI.use('sample'); if(s) await s('ok',{modelTier:'quick'}); }catch(e){} }

// ============ REGISTRO RAPIDO ============
let regState={step:0,tipo:'',monto:0,medio:'',categoria:''};

function openRegistro(){
  regState={step:0,tipo:'',monto:0,medio:'',categoria:''};
  renderRegistro();
  openModal('modal-registro');
}
async function abrirRegistroTurno(){
  if(!await cajaOkParaCobrar(sucursalActual())) return false; // sin caja abierta no se cobra
  regState={step:1,tipo:'turno',monto:0,medio:'',categoria:''};
  resetCobro();
  renderRegistro();
  openModal('modal-registro');
  return true;
}
async function abrirCobroDebe(){ if(!await abrirRegistroTurno()) return; cobro.medio='debe'; refreshCobro(); }
async function abrirRegistroTipo(tipo){
  if((tipo==='turno'||tipo==='producto')&&!await cajaOkParaCobrar(sucursalActual())) return;
  regState={step:1,tipo,monto:0,medio:'',categoria:'',saltoTipo:true};
  renderRegistro();
  openModal('modal-registro');
}
let ventaProd={cliente:'',clienteId:null};
function abrirVentaProducto(){
  ventaProd={cliente:'',clienteId:null};
  regState={step:1,tipo:'producto',monto:0,medio:'',categoria:'',directo:true};
  renderRegistro();
  openModal('modal-registro');
}
function abrirVentasCompleto(){
  const hoy=hoyStr();
  const misVentas=(dineroData.ventas||[]).slice().sort((a,b)=>new Date(b.creadoEn||b.fecha)-new Date(a.creadoEn||a.fecha));
  const ventasHoy=misVentas.filter(v=>v.fecha===hoy);
  const paquetesHoy=paquetesSt.list.filter(p=>p.fecha===hoy&&p.vendedorId===profile.id);
  const membresiasHoy=membresiasSt.list.filter(m=>m.fecha===hoy&&m.vendedorId===profile.id);
  const filas=[
    ...ventasHoy.map(v=>({ico:'📦',n:v.productoNombre+' x'+v.cantidad,cliente:v.cliente,ts:v.creadoEn,monto:v.total})),
    ...paquetesHoy.map(p=>({ico:'🎁',n:'Paquete ('+p.pct+'% off)',cliente:p.clienteNombre,ts:p.creadoEn,monto:p.total})),
    ...membresiasHoy.map(m=>({ico:'🎫',n:'Membresía',cliente:m.clienteNombre,ts:m.creadoEn,monto:m.precio})),
  ].sort((a,b)=>String(b.ts).localeCompare(String(a.ts)));
  document.getElementById('registro-content').innerHTML=cabeceraModal('💰 Lo que vendiste hoy')+
    (filas.length?filas.map(f=>`<div class="turno-item" style="cursor:default"><div class="ti-dot" style="background:#4A136B"></div><div class="ti-info"><strong>${f.ico} ${escH(f.n)}</strong><span>${f.cliente?escH(f.cliente)+' · ':''}${f.ts?new Date(f.ts).toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit'}):''}</span></div><div class="ti-monto">${fp(f.monto)}</div></div>`).join(''):'<div style="text-align:center;color:var(--muted);font-size:13px;padding:16px">Todavía no vendiste nada hoy.</div>')
    +`<button class="btn btn-ghost" style="margin-top:14px" onclick="closeModal('modal-registro');abrirVentaProducto()">+ Venta de producto</button>`;
  openModal('modal-registro');
}
function openModal(id){ document.getElementById(id).classList.add('open'); }
function closeModal(id){ document.getElementById(id).classList.remove('open'); if(id==='modal-registro'){ tareasModalAbierto=false; crmCumplesAbierto=false; crmMembresiasAbierto=false; crmContactarAbierto=false; reservasPendientesAbierto=false; } }

function renderRegistro(){
  const c=document.getElementById('registro-content');
  const color=profile.color;
  const back = (regState.step>0 && !regState.directo && !(regState.step===1&&regState.saltoTipo)) ? `<button onclick="regBack()" style="background:var(--s2);border:none;color:var(--muted2);font-size:16px;width:32px;height:32px;border-radius:50%;cursor:pointer;flex-shrink:0">←</button>` : '';
  if(regState.step===0){
    c.innerHTML=`<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px"><div class="modal-title" style="margin:0">¿Qué registrás?</div><button onclick="closeModal('modal-registro')" style="background:var(--s3);border:none;color:var(--muted2);font-size:18px;width:32px;height:32px;border-radius:50%;cursor:pointer">×</button></div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:20px">
      ${[['💈','Turno','turno'],['📦','Producto','producto'],['💸','Gasto','gasto'],['💵','Ingreso','ingreso']].map(([e,l,v])=>`
      <button onclick="regSelTipo('${v}')" style="padding:16px 8px;border-radius:14px;background:var(--s2);border:1.5px solid var(--border2);cursor:pointer;font-family:var(--font)">
        <div style="font-size:24px;margin-bottom:6px">${e}</div>
        <div style="font-size:13px;font-weight:700;color:var(--text)">${l}</div>
      </button>`).join('')}
    </div>`;
  } else if(regState.step===1){
    if(regState.tipo==='turno'){
      if(profile.role==='profesional'&&!sinRecepcionId(sucursalActual())) renderRegistrarTurnoForm(c,back,color);
      else renderCobroForm(c,back,color);
    } else if(regState.tipo==='producto'){
      c.innerHTML=`<div style="display:flex;align-items:center;gap:8px;margin-bottom:20px">${back}<div class="modal-title" style="margin:0">Venta de producto 📦</div><button onclick="closeModal('modal-registro')" style="margin-left:auto;background:var(--s3);border:none;color:var(--muted2);font-size:18px;width:32px;height:32px;border-radius:50%;cursor:pointer">×</button></div>
        ${!productos.length?'<div style="text-align:center;color:var(--muted);font-size:13px;padding:20px 0">Todavía no hay productos cargados. Pedile al admin que cargue el catálogo.</div>':`
        <div class="field"><label>Cliente (opcional)</label><input id="prod-cliente" type="text" autocomplete="off" placeholder="Buscá o escribí el nombre..." value="${escH(ventaProd.cliente)}" oninput="prodClienteInput(this.value)"/><div id="prod-cli-sug"></div></div>
        <div class="field"><label>Producto</label>
          <select id="prod-sel" style="width:100%;background:var(--s2);border:1.5px solid var(--border2);border-radius:12px;padding:12px;color:var(--text);font-family:var(--font);font-size:14px">
            ${productos.map(p=>`<option value="${p.id}">${p.nombre} — ${fp(p.precioVenta)} (quedan ${p.stock})</option>`).join('')}
          </select>
        </div>
        <div class="field" style="margin-top:10px"><label>Cantidad</label><input id="prod-cant" type="number" value="1" min="1" style="width:100%;background:var(--s2);border:1.5px solid var(--border2);border-radius:12px;padding:13px 15px;color:var(--text);font-family:var(--font);font-size:20px;font-weight:700;outline:none"/></div>
        <div class="field" style="margin-top:10px"><label>Medio de pago</label><select id="prod-medio" style="width:100%;background:var(--s2);border:1.5px solid var(--border2);border-radius:12px;padding:12px;color:var(--text);font-family:var(--font);font-size:14px"><option value="efectivo">💵 Efectivo</option><option value="mp">📱 Mercado Pago</option><option value="tarjeta">💳 Tarjeta</option></select></div>
        <button class="btn btn-primary" onclick="guardarVentaProducto()" style="background:${color};margin-top:12px">Guardar venta</button>`}`;
      if(productos.length) renderSugerenciasProd();
    } else {
      c.innerHTML=`<div style="display:flex;align-items:center;gap:8px;margin-bottom:16px">${back}<div class="paso-num" style="margin:0">Monto</div></div>
      <div class="monto-prefix">$</div>
      <input class="monto-inp" id="reg-monto" type="number" placeholder="0" autofocus/>
      <button class="btn btn-primary" onclick="regConfirmMonto()" style="margin-top:16px">Siguiente →</button>`;
      setTimeout(()=>document.getElementById('reg-monto')?.focus(),100);
    }
  } else if(regState.step===2){
    const medios=regState.tipo==='turno'?[['💵','Efectivo','efectivo'],['📱','Mercado Pago','mp']]:
                 regState.tipo==='gasto'?[['💵','Efectivo','efectivo'],['📱','Mercado Pago','mp'],['💳','Tarjeta','tarjeta']]:
                 [['💵','Efectivo','efectivo'],['📱','Mercado Pago','mp'],['🏦','Transferencia','transferencia']];
    c.innerHTML=`<div style="display:flex;align-items:center;gap:8px;margin-bottom:16px">${back}<div class="paso-num" style="margin:0">Medio de pago</div></div>
    <div style="font-size:22px;font-weight:900;text-align:center;margin-bottom:16px">${fp(regState.monto)}</div>
    <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:20px">
      ${medios.map(([e,l,v])=>`<button onclick="regSelMedio('${v}')" style="padding:14px 16px;border-radius:14px;background:var(--s2);border:1.5px solid var(--border2);cursor:pointer;font-family:var(--font);display:flex;align-items:center;gap:12px;font-size:14px;font-weight:600;color:var(--text)"><span style="font-size:22px">${e}</span>${l}</button>`).join('')}
    </div>`;
  } else if(regState.step===3){
    const cats=regState.tipo==='turno'?['Corte','Color','Mechas','Keratina','Tratamiento','Peinado','Otro']:
               regState.tipo==='gasto'?['🏠 Alquiler','🛒 Comida','🚌 Transporte','💊 Salud','💡 Servicios','🎬 Entretenimiento','📦 Otro']:
               ['💼 Quincena','💰 Extra','🎁 Regalo','📦 Otro'];
    c.innerHTML=`<div style="display:flex;align-items:center;gap:8px;margin-bottom:16px">${back}<div class="paso-num" style="margin:0">Categoría</div></div>
    <div style="font-size:22px;font-weight:900;text-align:center;margin-bottom:4px">${fp(regState.monto)}</div>
    <div style="font-size:13px;color:var(--muted2);text-align:center;margin-bottom:16px">${regState.medio}</div>
    <div class="chips" style="margin-bottom:20px">${cats.map(cat=>`<div class="chip" onclick="regSelCat('${cat}')">${cat}</div>`).join('')}</div>`;
  } else if(regState.step===4){
    const hoy=ymdLocal(new Date());
    c.innerHTML=`<div style="display:flex;align-items:center;gap:8px;margin-bottom:16px">${back}<div class="paso-num" style="margin:0">Confirmar</div></div>
    <div class="card" style="margin-bottom:16px">
      <div style="font-size:28px;font-weight:900;margin-bottom:4px">${fp(regState.monto)}</div>
      <div style="font-size:13px;color:var(--muted2)">${regState.tipo} · ${regState.medio} · ${regState.categoria}</div>
    </div>
    <div class="field"><label>Fecha</label><input type="date" id="reg-fecha" value="${hoy}"/></div>
    <div class="field"><label>Nota (opcional)</label><input type="text" id="reg-nota" placeholder="Ej: nombre del cliente..."/></div>
    <button class="btn btn-primary" onclick="regGuardar()" style="background:${color}">Guardar ${regState.tipo}</button>`;
  }
}

async function regSelTipo(tipo){ if((tipo==='turno'||tipo==='producto')&&!await cajaOkParaCobrar(sucursalActual())) return; regState.tipo=tipo; regState.step=1; if(tipo==='turno') resetCobro(); if(tipo==='producto') ventaProd={cliente:'',clienteId:null}; renderRegistro(); }
function regBack(){ if(regState.step>0){regState.step--;renderRegistro();} else closeModal('modal-registro'); }

// ============ COBRO DE TURNO (servicios + combos + oferta + productos + medio) ============
let cobro = {cliente:'', clienteId:null, senasSel:[], sucursal:'', reag:{estado:'',motivo:''}, prepagos:[], hora:'', servicios:[], opciones:{}, precios:{}, ofertaId:'', prods:{}, prodsProf:{}, venderProd:'', medio:'efectivo', motivo:'', q:'', descGrupo:null, paqueteRubro:null, paqueteOfrecido:'', resena:'', resenaSent:'', reagFecha:'', reagHora:'', profAtendioId:null};
// Cuando recepcion cobra un turno que un profesional dejo "registrado" en Diego Laure (ver turnosPendientesSt),
// el cobro tiene que quedar guardado en la quincena de ESE profesional, no en la de quien lo cobra.
let cobroParaProf=null, cobroPendienteId=null;
function resetCobro(){ cobro={cliente:'', clienteId:null, senasSel:[], sucursal:'', reag:{estado:'',motivo:''}, prepagos:[], hora:'', servicios:[], opciones:{}, precios:{}, ofertaId:'', prods:{}, prodsProf:{}, venderProd:'', medio:'efectivo', motivo:'', q:'', descGrupo:null, paqueteRubro:null, paqueteOfrecido:'', resena:'', resenaSent:'', reagFecha:'', reagHora:'', rubroAbierto:null, profAtendioId:null}; cobroParaProf=null; cobroPendienteId=null; }
function elegirDescCobro(g){ cobro.descGrupo=(cobro.descGrupo===g?null:g); refreshCobro(); }

function ofertasActivas(){ return ofertas.filter(o=>o.activa!==false); }
function ofertasVisibles(){ const rb=rubrosDeUsuario(profile); return ofertasActivas().filter(o=>visiblePorRubro(o,rb)); }
function ofertaAplicaA(o,ids){ return !o.servicioIds||!o.servicioIds.length||[].concat(ids).some(id=>o.servicioIds.includes(id)); }

function quincenaActualInfo(){
  const now=new Date(); const q=now.getDate()<=15?1:2;
  const enQ=f=>{ if(!f) return false; const d=new Date(f+'T00:00:00'); return d.getMonth()===now.getMonth()&&d.getFullYear()===now.getFullYear()&&(q===1?d.getDate()<=15:d.getDate()>15); };
  const fact=(dineroData.turnos||[]).filter(t=>enQ(t.fecha)).reduce((s,t)=>s+(parseFloat(t.monto)||0),0);
  const reelsQ=reels.filter(r=>r.stage==='publicado'&&r.asignado===profile.name&&enQ(r.fecha)).length;
  return calcComision(fact,reelsQ,profile);
}

// Precio de un servicio en este cobro: el de lista (o el que puso el profesional si es "desde") + extra de la opcion elegida
function precioSvc(id){
  const s=servicios.find(x=>x.id===id); if(!s) return 0;
  const ov=numV(cobro.precios[id]);
  const base=(s.variable&&ov>0)?ov:numV(s.precio);
  const op=cobro.opciones[id];
  const extra=op&&s.variante?numV(((s.variante.opciones||[]).find(o=>o.n===op)||{}).extra):0;
  return base+extra;
}
function svcConVariante(id){ const s=servicios.find(x=>x.id===id); return s&&s.variante&&(s.variante.opciones||[]).length?s:null; }

// Lineas de servicio del cobro. Si estan elegidos todos los servicios de un combo, se cobra el precio del combo.
function lineasCobro(){
  const rb=rubrosDeUsuario(profile);
  const elegidos=cobro.servicios.filter(id=>servicios.some(s=>s.id===id));
  const usados=new Set(), lineas=[];
  combos.filter(c=>visiblePorRubro(c,rb)&&c.servicioIds.length>1&&c.servicioIds.every(id=>elegidos.includes(id)))
    .map(c=>({c,lista:c.servicioIds.reduce((a,id)=>a+precioSvc(id),0)}))
    .filter(x=>x.c.precio<x.lista)
    .sort((a,b)=>(b.lista-b.c.precio)-(a.lista-a.c.precio))
    .forEach(({c,lista})=>{
      if(c.servicioIds.some(id=>usados.has(id))) return;
      c.servicioIds.forEach(id=>usados.add(id));
      lineas.push({tipo:'combo',id:c.id,nombre:c.nombre,precio:c.precio,lista,ids:[...c.servicioIds],
        componentes:c.servicioIds.map(id=>(servicios.find(s=>s.id===id)||{}).nombre)});
    });
  elegidos.filter(id=>!usados.has(id)).forEach(id=>{
    const s=servicios.find(x=>x.id===id); const p=precioSvc(id);
    lineas.push({tipo:'servicio',id:s.id,nombre:s.nombre,precio:p,lista:p,ids:[s.id]});
  });
  lineas.forEach(l=>{
    const ops=[], faltan=[];
    l.ids.forEach(id=>{ const s=svcConVariante(id); if(!s) return; const o=cobro.opciones[id]; if(o) ops.push(o); else faltan.push({id,titulo:s.variante.titulo||'Opción',servicio:s.nombre}); });
    l.opcion=ops.join(', ')||null; l.faltan=faltan;
  });
  return lineas;
}

function pillStyle(sel,color){
  return `padding:9px 14px;border-radius:20px;border:1.5px solid ${sel?color:'var(--border2)'};background:${sel?color+'22':'transparent'};color:${sel?color:'var(--muted2)'};cursor:pointer;font-family:var(--font);font-size:12.5px;font-weight:600;transition:all .15s`;
}

function renderCobroForm(c,back,color){
  const vis=serviciosVisibles();
  c.innerHTML=`<div style="display:flex;align-items:center;gap:8px;margin-bottom:16px">${back}<div class="modal-title" style="margin:0">${cobroParaProf?'Cobrar turno 💈':'Cobro del turno 💈'}</div><button onclick="closeModal('modal-registro')" style="margin-left:auto;background:var(--s3);border:none;color:var(--muted2);font-size:18px;width:32px;height:32px;border-radius:50%;cursor:pointer">×</button></div>
    ${cobroParaProf?`<div style="background:rgba(74,19,107,.14);border:1.5px solid rgba(74,19,107,.5);border-radius:12px;padding:10px 12px;margin:-8px 0 16px;font-size:12.5px;font-weight:800;color:var(--accent2)">📝 Paso 2 · Cobrando el turno que registró ${escH(cobroParaProf.name)}</div>`:''}
    <div class="field"><label>Cliente * <span style="color:var(--muted);font-weight:500">(nombre y apellido, teléfono y nacimiento: recepción los necesita)</span></label><input id="turno-nombre" type="text" autocomplete="off" placeholder="Buscá o escribí el nombre..." value="${escH(cobro.cliente)}" oninput="cobroClienteInput(this.value)"/><div id="cb-cli-sug"></div></div>
    ${(!cobroParaProf&&profile.role==='recepcionista')?'<div class="field"><label>¿Quién atendió a este cliente? *</label><div id="cb-profatendio"></div></div>':''}
    <div id="cb-suc"></div>
    <div id="cb-prepago"></div>
    <div class="field"><label>${cobroParaProf?'Qué se hizo':'¿Qué le hiciste?'}</label>
      ${(!cobroParaProf&&vis.length>10)?`<input id="cb-q" type="search" placeholder="Buscar servicio..." value="${escH(cobro.q)}" oninput="cobro.q=this.value;refreshCobro()" style="margin-bottom:8px"/>`:''}
      <div id="cb-serv"></div><div id="cb-extra"></div></div>
    <div id="cb-prods-prof"></div>
    <div class="field"><label>${cobroParaProf?'¿Vos le vendiste algún producto aparte?':'¿Le vendiste algún producto?'}</label><div id="cb-prods"></div></div>
    <div class="field"><label>${cobroParaProf?'🔁 ¿Reagendó?':'🔁 ¿Le reagendaste el turno?'}</label><div id="cb-reag"></div></div>
    <div class="field"><label>Medio de pago</label><div id="cb-medio" style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px"></div></div>
    <div class="field" id="cb-motivo-wrap" style="display:none"><label>Motivo (opcional)</label><input id="cb-motivo" type="text" placeholder="Ej: se le olvidó la billetera, paga mañana..." value="${escH(cobro.motivo)}" oninput="cobro.motivo=this.value"/></div>
    <div class="field" style="display:flex;align-items:center;gap:10px"><label style="margin:0;flex:1">🕐 Hora del turno <span style="color:var(--muted);font-weight:500">(para promos por horario)</span></label><input type="time" value="${escH(cobro.hora||horaAhora())}" onchange="cobroHora(this.value)" style="width:120px"/></div>
    <div id="cb-total"></div>
    <button class="btn btn-primary" onclick="guardarCobro()" style="background:${color};margin-top:12px">Guardar cobro</button>`;
  refreshCobro(); renderSugerenciasCliente();
}

// Productos que el profesional ya cargó al "Registrar turno" (ver cobro.prodsProf) -- de solo lectura acá, van
// a su quincena igual que el servicio. Separado de "cb-prods" (lo que agrega AHORA quien está cobrando, que es
// otra cosa: si recepción vende un producto aparte al momento de cobrar, es una venta de ELLA, no del
// profesional -- antes todo se mezclaba y quedaba mal atribuido). Pedido de Ivo, 1/10/2026.
function renderProdsProfCobro(){
  const el=document.getElementById('cb-prods-prof'); if(!el) return;
  const items=Object.entries(cobro.prodsProf||{}).filter(([id,n])=>n>0);
  if(!items.length){ el.innerHTML=''; return; }
  el.innerHTML=`<div class="card" style="margin-bottom:10px;border-color:rgba(74,19,107,.4)"><div style="font-size:11px;font-weight:800;color:var(--muted2);text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px">📦 Productos que cargó ${escH(cobroParaProf?cobroParaProf.name:'')}</div>${items.map(([id,n])=>{ const p=productos.find(x=>x.id===id); return `<div style="display:flex;justify-content:space-between;font-size:12.5px;padding:2px 0"><span>${escH(p?p.nombre:'(producto borrado)')} x${n}</span><span>${fp((p?p.precioVenta:0)*n)}</span></div>`; }).join('')}</div>`;
}
function renderProdsCobro(targetId,color){
  const prodsEl=document.getElementById(targetId); if(!prodsEl) return;
  const hayProdsElegidos=Object.values(cobro.prods).some(n=>n>0);
  if(cobro.venderProd!=='si'&&!hayProdsElegidos){
    prodsEl.innerHTML=`<div style="display:flex;gap:8px">${[['si','✅ Sí'],['no','❌ No']].map(([v,l])=>`<button type="button" onclick="cobroVenderProd('${v}')" style="flex:1;${pillStyle(cobro.venderProd===v,color)}">${l}</button>`).join('')}</div>`;
  } else {
    const disp=productos.filter(p=>p.stock>0||(cobro.prods[p.id]||0)>0);
    prodsEl.innerHTML=`<button class="lnk" style="margin-bottom:8px" onclick="cobroVenderProd('no')">✕ No, sin productos</button>`+(disp.length?disp.map(p=>{
      const qn=cobro.prods[p.id]||0;
      return `<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border)">
        <div style="flex:1"><div style="font-size:13px;font-weight:600">${escH(p.nombre)}</div><div style="font-size:11px;color:var(--muted2)">${fp(p.precioVenta)} · quedan ${p.stock}</div></div>
        <button onclick="cobroQty('${p.id}',-1)" style="width:32px;height:32px;border-radius:50%;border:1.5px solid var(--border2);background:transparent;color:var(--text);font-size:18px;cursor:pointer">−</button>
        <div style="min-width:20px;text-align:center;font-size:15px;font-weight:800;${qn?`color:${color}`:'color:var(--muted)'}">${qn}</div>
        <button onclick="cobroQty('${p.id}',1)" style="width:32px;height:32px;border-radius:50%;border:none;background:${color};color:#fff;font-size:18px;cursor:pointer">+</button>
      </div>`;
    }).join(''):'<div style="font-size:12px;color:var(--muted)">No hay productos con stock cargados.</div>');
  }
}
function refreshCobro(){
  const color=profile.color;
  const planMemb=cobro.vendeMembPlanId?planesVendiblesEnCobro(clienteDe(cobro.clienteId),cobro.servicios||[]).find(p=>p.id===cobro.vendeMembPlanId):null;
  const membAdd=planMemb?planMemb.precio:0;
  let r;
  if(planMemb){
    // Se muestra el cobro como va a quedar al guardar: el servicio del plan queda cubierto por el uso 1 (ver guardarCobro).
    const guardados=cobro.prepagos;
    cobro.prepagos=[...(guardados||[]),{kind:'memb',refId:'__venta__',itemId:'__venta__',svcId:servicioDePlanEnCobro(planMemb,cobro.servicios).id,credito:Math.round(planMemb.precio/planMemb.creditos),nombre:'Membresía nueva'}];
    r=calcCobro();
    cobro.prepagos=guardados;
  } else r=calcCobro();
  const serv=document.getElementById('cb-serv');
  if(!serv) return;
  // --- servicios: si viene de un turno ya registrado (recepcion cobrando), es de solo lectura: ya lo decidio el profesional ---
  if(cobroParaProf){
    serv.innerHTML=`<div style="display:flex;flex-direction:column;gap:4px">${cobro.servicios.map(id=>{ const s=servicios.find(x=>x.id===id); if(!s) return ''; const op=cobro.opciones[id]; return `<div style="font-size:13px;font-weight:700">✓ ${escH(s.nombre)}${op?' — '+escH(op):''}</div>`; }).join('')||'<div style="font-size:12px;color:var(--muted)">Sin servicios cargados.</div>'}</div>`;
  } else {
    // --- si hay un solo rubro se listan directo; si hay varios, primero el rubro y recien al tocarlo se despliegan sus servicios ---
    const vis=serviciosVisibles();
    const q=(cobro.q||'').trim().toLowerCase();
    const grupos={};
    vis.forEach(s=>{ (grupos[s.rubro||'']=grupos[s.rubro||'']||[]).push(s); });
    const rids=Object.keys(grupos);
    const pill=(s)=>`<button onclick="cobroToggleServicio('${s.id}')" style="${pillStyle(cobro.servicios.includes(s.id),color)}">${escH(s.nombre)} · ${s.variable?'desde ':''}${fp(s.precio)}</button>`;
    if(!vis.length) serv.innerHTML='<div style="font-size:12px;color:var(--muted)">El admin todavía no cargó servicios para tu rubro.</div>';
    else if(q){
      const filtrados=vis.filter(s=>s.nombre.toLowerCase().includes(q));
      serv.innerHTML=filtrados.length?`<div style="display:flex;flex-wrap:wrap;gap:6px">${filtrados.map(pill).join('')}</div>`:'<div style="font-size:12px;color:var(--muted)">No hay servicios que coincidan.</div>';
    } else if(rids.length<=1){
      serv.innerHTML=`<div style="display:flex;flex-wrap:wrap;gap:6px">${grupos[rids[0]].map(pill).join('')}</div>`;
    } else {
      serv.innerHTML=`<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px">${rids.map(rid=>{ const n=grupos[rid].filter(s=>cobro.servicios.includes(s.id)).length; return `<button type="button" onclick="cobroAbrirRubro('${rid}')" style="${pillStyle(cobro.rubroAbierto===rid,color)}">${escH(nombreRubro(rid)||'Otros')}${n?' ('+n+')':''}</button>`; }).join('')}</div>`
        +(cobro.rubroAbierto&&grupos[cobro.rubroAbierto]?`<div style="display:flex;flex-wrap:wrap;gap:6px">${grupos[cobro.rubroAbierto].map(pill).join('')}</div>`:'<div style="font-size:11.5px;color:var(--muted2)">Tocá un rubro para ver sus servicios.</div>');
    }
  }

  // --- combos aplicados, largo de barba, precio final de los "desde" (la variante ya no se pregunta de nuevo si viene de un turno registrado) ---
  const ex=[];
  r.lineas.filter(l=>l.tipo==='combo').forEach(l=>ex.push(`<div style="background:rgba(52,211,153,.1);border:1px solid rgba(52,211,153,.3);border-radius:12px;padding:9px 12px;margin-top:8px;font-size:12px;color:#34d399;font-weight:700">✨ Combo aplicado: ${escH(l.nombre)} ${fp(l.precio)} <span style="font-weight:600;opacity:.85">(ahorrás ${fp(l.lista-l.precio)})</span></div>`));
  if(!cobroParaProf) cobro.servicios.forEach(id=>{
    const s=servicios.find(x=>x.id===id); if(!s) return;
    if(s.variable) ex.push(`<div style="margin-top:8px;display:flex;align-items:center;gap:8px;font-size:12px"><span style="flex:1;color:var(--muted2)">${escH(s.nombre)} — precio final</span><input type="number" inputmode="decimal" placeholder="${s.precio}" value="${cobro.precios[id]||''}" onchange="cobroPrecio('${id}',this.value)" style="width:110px;background:var(--s2);border:1.5px solid var(--border2);border-radius:10px;padding:8px 10px;color:var(--text);font-family:var(--font);font-size:14px;font-weight:700;outline:none"/></div>`);
    if(svcConVariante(id)){
      ex.push(`<div style="margin-top:8px"><div style="font-size:11px;font-weight:700;color:var(--muted2);margin-bottom:5px">${escH(s.nombre)}: ${escH(s.variante.titulo||'Opción')} <span style="color:#f472b6">*</span></div><div style="display:flex;gap:6px;flex-wrap:wrap">${s.variante.opciones.map((o,oi)=>`<button onclick="cobroOpcion('${id}',${oi})" style="${pillStyle(cobro.opciones[id]===o.n,color)}">${escH(o.n)}${numV(o.extra)?' +'+fp(o.extra):''}</button>`).join('')}</div></div>`);
    }
  });
  // Si viene de un turno registrado pero le falta una variante (turno viejo, cargado antes de guardar esto), que recepcion la pueda completar igual, sino queda trabada sin poder cobrar
  else cobro.servicios.forEach(id=>{
    const s=servicios.find(x=>x.id===id);
    if(s&&svcConVariante(id)&&!cobro.opciones[id]) ex.push(`<div style="margin-top:8px"><div style="font-size:11px;font-weight:700;color:var(--muted2);margin-bottom:5px">${escH(s.nombre)}: ${escH(s.variante.titulo||'Opción')} <span style="color:#f472b6">*</span> <span style="color:var(--muted2);font-weight:500">(no quedó cargado, elegilo para poder cobrar)</span></div><div style="display:flex;gap:6px;flex-wrap:wrap">${s.variante.opciones.map((o,oi)=>`<button onclick="cobroOpcion('${id}',${oi})" style="${pillStyle(cobro.opciones[id]===o.n,color)}">${escH(o.n)}${numV(o.extra)?' +'+fp(o.extra):''}</button>`).join('')}</div></div>`);
  });
  if(r.esNoche) ex.unshift(`<div style="background:rgba(74,19,107,.12);border:1px solid rgba(74,19,107,.35);border-radius:12px;padding:9px 12px;margin-top:8px;font-size:12px;color:#a89fff;font-weight:700">🌙 Turno de noche (desde las ${escH(nocheCfg().desde)}): precio de lista, sin descuentos. Tu comisión es ${numV(nocheCfg().pct)}% fijo.</div>`);
  document.getElementById('cb-extra').innerHTML=ex.join('')+htmlAgregados('cb');

  renderProdsProfCobro();
  renderProdsCobro('cb-prods',color);

  document.getElementById('cb-medio').innerHTML=[['💵','Efectivo','efectivo',r.esNoche?'':`−${DESC_EFECTIVO_PCT}% servicios`],['📱','Mercado Pago','mp',''],['💳','Tarjeta','tarjeta',''],['⏳','Paga después','debe','queda debiendo']].map(([e,l,v,sub])=>{
    const sel=cobro.medio===v;
    return `<button onclick="cobroMedio('${v}')" style="min-width:0;padding:12px 3px;border-radius:12px;border:1.5px solid ${sel?color:'var(--border2)'};background:${sel?color+'22':'transparent'};cursor:pointer;font-family:var(--font);font-size:11px;font-weight:700;color:${sel?color:'var(--muted2)'};transition:all .15s"><div style="font-size:20px;margin-bottom:4px">${e}</div>${l}${sub?`<div style="font-size:9.5px;font-weight:600;opacity:.8;margin-top:2px">${sub}</div>`:''}</button>`;
  }).join('');

  renderSucCobro(); renderPrepagoCobro(r); renderReagCobro(); renderProfAtendioCobro();
  const mw=document.getElementById('cb-motivo-wrap'); if(mw) mw.style.display=cobro.medio==='debe'?'':'none';
  const pctServ=r.svcs.length?quincenaActualInfo().pct:0;
  const comServ=r.comFija!=null?Math.round(r.comFija+r.prepTotal*pctServ/100):Math.round(r.servicioNeto*pctServ/100);
  const row=(a,b,style='')=>`<div style="display:flex;justify-content:space-between;gap:10px;font-size:13px;padding:3px 0;${style}"><span>${a}</span><span style="white-space:nowrap">${b}</span></div>`;
  document.getElementById('cb-total').innerHTML=(r.svcs.length||r.prodLineas.length)?`<div class="card" style="margin-top:4px">
    ${r.svcs.map(l=>row(escH(nomSvc(l)),fp(l.precio))).join('')}
    ${htmlDescuentosCobro(r,row)}
    ${r.ofertaSinEfecto?`<div style="font-size:11px;color:var(--muted2);padding:2px 0">La oferta elegida no aplica a los servicios seleccionados.</div>`:''}
    ${r.svcs.length?row('<b>Servicios a cobrar</b>','<b>'+fp(r.aCobrarServ)+'</b>','border-top:1px solid var(--border);margin-top:4px;padding-top:6px'):''}
    ${r.prodLineas.map(l=>row(`${escH(l.producto.nombre)} x${l.cantidad}`,fp(l.total))).join('')}
    ${r.prodLineas.length?row('<b>Productos</b>','<b>'+fp(r.prodTotal)+'</b>','border-top:1px solid var(--border);margin-top:4px;padding-top:6px'):''}
    ${membAdd?row('<b>Membresía nueva (precio fijo)</b>','<b>'+fp(membAdd)+'</b>','border-top:1px solid var(--border);margin-top:4px;padding-top:6px'):''}
    <div style="display:flex;justify-content:space-between;align-items:baseline;margin-top:8px;padding-top:8px;border-top:1.5px solid var(--border2)"><span style="font-size:13px;font-weight:700">${cobro.medio==='debe'?'QUEDA DEBIENDO':'TOTAL A COBRAR'}</span><span style="font-size:24px;font-weight:900">${fp(r.total+membAdd)}</span></div>
    <div style="font-size:11px;color:var(--muted2);margin-top:8px;line-height:1.5">
      ${cobro.medio==='debe'?'⏳ <b>No suma a tu quincena todavía.</b> Cuando pague, se suma a la quincena del día en que pague (no a la de hoy). Recepción lo ve para cobrarle.':r.svcs.length?`Suma a tu quincena: <b>${fp(r.servicioNeto)}</b> → comisión ≈ ${fp(comServ)} ${r.esNoche?'(turno de noche: '+numV(nocheCfg().pct)+'% fijo)':r.comFija!=null?'(descuento alto: comisión fija sobre lo que paga el cliente)':'('+pctServ+'%)'}<br>`:''}
      ${cobro.medio!=='debe'&&r.prodLineas.length?`Productos (aparte de tu quincena): comisión <b>${fp(r.prodComision)}</b>`:''}
    </div>
  </div>`:'';
}

function cobroToggleServicio(id){
  const i=cobro.servicios.indexOf(id);
  if(i>=0){ cobro.servicios.splice(i,1); delete cobro.opciones[id]; delete cobro.precios[id]; } else cobro.servicios.push(id);
  refreshCobro();
}
function cobroAbrirRubro(rid){ cobro.rubroAbierto=cobro.rubroAbierto===rid?null:rid; if(document.getElementById('rt-paq')) refreshRegistroTurno(); else refreshCobro(); }
// Agregados "a un toque" (regla de Ivo, 3/10/2026): lavado y limpieza facial se ofrecen con cualquier corte o barba;
// la toalla a vapor solo si ya hay barba. Cada uno suma su precio de lista como una linea mas del mismo cobro/turno.
const AGREGADOS_REGLA=[{re:/lavado/i},{re:/limpieza facial/i},{re:/toalla/i,soloConBarba:true}];
function agregadosOfrecidos(){
  const sel=(cobro.servicios||[]).map(id=>servicios.find(x=>x.id===id)).filter(Boolean);
  const bases=sel.filter(s=>!AGREGADOS_REGLA.some(a=>a.re.test(s.nombre)));
  if(!bases.some(s=>/corte|barba/i.test(s.nombre))) return [];
  const hayBarba=bases.some(s=>/barba/i.test(s.nombre));
  const vis=serviciosVisibles();
  return AGREGADOS_REGLA.filter(a=>!a.soloConBarba||hayBarba).map(a=>vis.find(s=>a.re.test(s.nombre)&&!cobro.servicios.includes(s.id))).filter(Boolean);
}
function htmlAgregados(modo){
  const ofrec=agregadosOfrecidos(); if(!ofrec.length) return '';
  const color=profile.color||'#4A136B', fn=modo==='rt'?'rtToggleServicio':'cobroToggleServicio';
  return `<div style="margin-top:10px"><div style="font-size:11.5px;color:var(--muted2);margin-bottom:5px">➕ Agregados (se suman al servicio de hoy, a precio de lista)</div><div style="display:flex;gap:6px;flex-wrap:wrap">${ofrec.map(s=>`<button type="button" onclick="${fn}('${s.id}')" style="${pillStyle(false,color)}">+ ${escH(s.nombre)} · ${fp(s.precio)}</button>`).join('')}</div></div>`;
}
function cobroOpcion(id,i){ const s=servicios.find(x=>x.id===id); if(!s||!s.variante) return; cobro.opciones[id]=s.variante.opciones[i].n; refreshCobro(); }
function cobroPrecio(id,v){ const n=parseFloat(v)||0; if(n>0) cobro.precios[id]=n; else delete cobro.precios[id]; refreshCobro(); }
function cobroToggleOferta(id){ cobro.ofertaId=(cobro.ofertaId===id?'':id); refreshCobro(); }
function cobroMedio(m){ cobro.medio=m; refreshCobro(); }
function cobroQty(id,delta){
  const p=productos.find(x=>x.id===id); if(!p) return;
  const q=Math.max(0,Math.min(p.stock,(cobro.prods[id]||0)+delta));
  if(q>0) cobro.prods[id]=q; else delete cobro.prods[id];
  refreshCobro();
}
function cobroVenderProd(v){ cobro.venderProd=v; if(v==='no') cobro.prods={}; refreshCobro(); }

let guardandoCobro=false;
async function guardarCobro(){
  if(guardandoCobro) return;
  if(!await cajaOkParaCobrar(sucursalActual())) return;
  let r=calcCobro();
  if(!r.svcs.length){ showToast('Elegí qué le hiciste'); return; }
  const falta=r.lineas.flatMap(l=>l.faltan)[0];
  if(falta){ showToast('Elegí: '+falta.titulo.toLowerCase()+' ('+falta.servicio+')'); return; }
  for(const l of r.prodLineas){ if(l.cantidad>l.producto.stock){ showToast('No hay stock de '+l.producto.nombre); return; } }
  const rc=resolverClienteCobro(); if(rc.error){ showToast(rc.error); return; }
  const cli=rc.cli;
  if(!cli){ showToast(cobro.medio==='debe'?'Poné el nombre del cliente para poder cobrarle después':'Elegí o cargá al cliente: recepción necesita sus datos'); return; }
  const faltan=faltanDatosCliente(cli);
  if(faltan.length){ showToast('Completá '+faltan.join(' y ')+' de '+cli.nombre); abrirFormCliente(cli.id,{deCobro:true}); return; }
  if(profile.role==='profesional'&&cli&&!cobro.paqueteOfrecido){ showToast('Respondé si le ofreciste un paquete'); return; }
  if(profile.role==='profesional'&&cli&&cobro.paqueteOfrecido==='si'&&!cobro.paqueteRubro){ showToast('Elegí qué combinación le gustaría'); return; }
  if(cli&&!cli.yaDejoResena&&!cobro.resena){ showToast('Respondé si dejó una reseña en Google'); return; }
  if(cobroParaProf&&cobro.reag.estado==='si'&&!cobro.reagFecha){ showToast('Elegí día y hora del reagendo en la Agenda'); return; }
  if(profile.role==='recepcionista'&&!cobroParaProf&&!cobro.profAtendioId){ showToast('Elegí qué profesional atendió al cliente'); return; }
  guardandoCobro=true;
  // profTarget: a quien le queda la comisión. Si viene de "cobrar un turno registrado" ya se sabe (cobroParaProf);
  // si recepción cobra directo, lo que eligió en "¿quién atendió?" (si no, quedaría mal atribuido a la recepcionista).
  const profTarget=cobroParaProf||(profile.role==='recepcionista'&&cobro.profAtendioId?allUsers.find(u=>u.id===cobro.profAtendioId):null), pendId=cobroPendienteId; // capturados antes de que resetCobro() los borre: es el turno "registrado" de otro profesional que recepcion esta cobrando
  try{
    if(cobro.vendeMembPlanId){
      // Membresia vendida en este mismo cobro: se crea recien ahora, y su primer uso es el servicio de hoy.
      const plan=planesVendiblesEnCobro(cli,cobro.servicios||[]).find(p=>p.id===cobro.vendeMembPlanId);
      if(!plan){ showToast('Esa membresía ya no se puede vender en este cobro'); return; }
      const sv=servicioDePlanEnCobro(plan,cobro.servicios), nueva=membresiaRecNueva(cli,plan,sv,cobro.medio);
      let yaTiene=false;
      await membresiasSt.cambiar(l=>{ if(l.some(x=>x.clienteId===cli.id&&x.usos.length<x.creditos&&(!x.vence||x.vence>=nueva.fecha))){ yaTiene=true; return; } l.push(nueva); });
      if(yaTiene){ showToast('Ya tiene una membresía activa: usala desde "Lo que el cliente ya pagó"'); return; }
      cobro.prepagos=[...(cobro.prepagos||[]),{kind:'memb',refId:nueva.id,itemId:nueva.id,svcId:sv.id,credito:nueva.valorCredito,nombre:'Membresía · '+sv.nombre}];
      r=calcCobro();
    }
    const nombresSvc=r.lineas.map(l=>nomSvc(l)).join(' + ');
    const ofD=r.descuentos.find(d=>d.tipo==='oferta');
    const ofertaReg=ofD&&r.oferta?{id:r.oferta.id,nombre:r.oferta.nombre,pct:r.oferta.pct}:null;
    const extra=camposDescuento(r,cli);
    const reag=cobro.reag&&cobro.reag.estado?{estado:cobro.reag.estado,motivo:(cobro.reag.motivo||'').trim(),ts:new Date().toISOString()}:null;
    if(reag) extra.reag=reag;
    if(cobro.resena) extra.resena=cobro.resena;
    if(cobro.resenaSent) extra.resenaSent=cobro.resenaSent;
    const base={clienteId:cli?cli.id:null, clienteNumero:cli?cli.numero:null, sucursal:sucursalActual()};
    let turnoId, esDeuda=cobro.medio==='debe';
    if(esDeuda){
      const idd=Date.now().toString(); turnoId='d'+idd;
      const deuda={
        id:idd, cliente:cli.nombre, ...base, monto:r.total, montoServicios:r.servicioNeto, aCobrarServ:r.aCobrarServ,
        servicio:nombresSvc, servicios:r.lineas.map(lineaAReg), oferta:ofertaReg,
        descuento:r.descuento, descuentoTipo:r.descTipo, subtotal:r.subtotal, ...extra,
        productos:[...r.prodLineas,...r.prodLineasProf].map(l=>({productoId:l.producto.id,productoNombre:l.producto.nombre,cantidad:l.cantidad,precioUnitario:l.producto.precioVenta,total:l.total,comision:l.comision,costoUnitario:l.producto.costo||0})),
        motivo:(cobro.motivo||'').trim(), fecha:ymdLocal(new Date()), creadoEn:new Date().toISOString(), saldado:false
      };
      if(profTarget) await modificarDineroDe(profTarget.id,dd=>{ dd.deudores.push(deuda); return true; });
      else { if(!dineroData.deudores) dineroData.deudores=[]; dineroData.deudores.push(deuda); saveDinero(); }
    } else {
      const id=Date.now().toString(); turnoId=id;
      const fecha=ymdLocal(new Date()), creadoEn=new Date().toISOString();
      const cliente=cli?cli.nombre:((cobro.cliente||'').trim()||'Cliente');
      const turno={
        id, cliente, ...base, servicio:nombresSvc, servicios:r.lineas.map(lineaAReg), oferta:ofertaReg,
        descuento:r.descuento, descuentoTipo:r.descTipo, subtotal:r.subtotal, ...extra,
        monto:r.servicioNeto, // lo unico que suma a la quincena
        medio:cobro.medio, fecha, creadoEn
      };
      const haceVenta=(l,i,pref)=>({id:id+pref+i, turnoId:id, cliente, clienteId:base.clienteId, sucursal:base.sucursal, productoId:l.producto.id, productoNombre:l.producto.nombre, cantidad:l.cantidad, precioUnitario:l.producto.precioVenta, total:l.total, comision:l.comision, costoUnitario:l.producto.costo||0, medio:cobro.medio, fecha, creadoEn});
      // ventasProf: productos que el profesional ya había cargado al registrar el turno -> van a SU quincena,
      // junto con el turno. ventasPropias: productos que agrega AHORA quien está cobrando (recepción, u otro
      // profesional cobrando directo) -> van a la quincena de QUIEN COBRA, nunca a la del profTarget. Antes
      // todo se mezclaba en una sola lista y quedaba atribuido al profesional aunque fuera recepción quien
      // vendió el producto por su cuenta. Pedido de Ivo, 1/10/2026.
      const ventasProf=r.prodLineasProf.map((l,i)=>haceVenta(l,i,'pp'));
      const ventasPropias=r.prodLineas.map((l,i)=>haceVenta(l,i,'p'));
      if(profTarget){
        await modificarDineroDe(profTarget.id,dd=>{ dd.turnos.push(turno); ventasProf.forEach(v=>dd.ventas.push(v)); return true; });
      } else {
        if(!dineroData.turnos) dineroData.turnos=[];
        dineroData.turnos.push(turno);
      }
      if(ventasPropias.length){
        if(!dineroData.ventas) dineroData.ventas=[];
        ventasPropias.forEach(v=>dineroData.ventas.push(v));
      }
      if(!profTarget||ventasPropias.length) saveDinero();
    }
    const todosProds=[...r.prodLineas,...r.prodLineasProf];
    if(todosProds.length) ajustarStock(todosProds.map(l=>({id:l.producto.id,delta:-l.cantidad})));
    closeModal('modal-registro');
    showToast(esDeuda?'Anotado como deuda — recepción lo ve para cobrarle':(profTarget?'Cobro guardado ✓ — se sumó a la quincena de '+profTarget.name:'Cobro guardado — recepción ya lo ve ✓'));
    const resenaResp=cobro.resena, resenaSentResp=cobro.resenaSent, paqueteResp=cobro.paqueteOfrecido, paqueteRubroResp=cobro.paqueteRubro, rolQueCobra=profile.role;
    if(resenaSentResp==='mala'&&cli){
      const profNombre=(profTarget?profTarget.name:profile.name), ahoraIso=new Date().toISOString();
      contactosPendientesSt.cambiar(l=>{ l.push({id:'cp'+Date.now().toString(36),clienteId:cli.id,clienteNombre:cli.nombre,razon:'Dejó una reseña mala con '+profNombre,fecha:hoyStr(),creadoEn:ahoraIso,upd:ahoraIso,atendido:false}); });
    }
    resetCobro();
    refreshCurrentView();
    if(currentScreenId==='dinero') renderDineroContent();
    await postCobroCliente(cli,r,turnoId,profTarget?profTarget.id:null);
    await marcarSenasUsadas(r,turnoId);
    const ptsProfId=profTarget?profTarget.id:profile.id;
    if(reag&&reag.estado==='si') addPuntos(ptsProfId,'reagendamiento',ptsReag(),'Reagendamiento: '+(cli?cli.nombre:'cliente'),'reag:t:'+ptsProfId+':'+turnoId);
    if(cli&&resenaResp==='si'&&!cli.yaDejoResena){
      addPuntos(ptsProfId,'resena',ptsResena(),'Reseña en Google: '+cli.nombre,'resena:t:'+ptsProfId+':'+turnoId);
      await cambiarClientes(list=>{ const c2=list.find(x=>x.id===cli.id); if(c2) c2.yaDejoResena=true; });
    }
    if(cli&&rolQueCobra==='profesional'&&paqueteResp){
      const esSi=paqueteResp==='si'&&paqueteRubroResp;
      await sugerenciasPaqSt.cambiar(l=>{ l.push({id:'sg'+Date.now().toString(36),clienteId:cli.id,clienteNombre:cli.nombre,clienteNumero:cli.numero,rubro:esSi?paqueteRubroResp:null,tipo:esSi?'sugerencia':'recordatorio',profId:ptsProfId,profNombre:(profTarget?profTarget.name:profile.name),sucursal:base.sucursal,ts:new Date().toISOString(),atendido:false,upd:new Date().toISOString()}); });
    }
    if(pendId) await turnosPendientesSt.cambiar(l=>{ const x=l.find(z=>z.id===pendId); if(x){ x.estado='cobrado'; x.upd=new Date().toISOString(); } });
    if(r.fijo&&r.fijo.cupo!=null&&r.descuentos.some(d=>d.tipo==='fijo')) await consumirCupoOferta(r.fijo.id);
  } finally { guardandoCobro=false; }
}

// ============ REGISTRAR TURNO (Diego Laure, paso 1 del profesional — sin cobrar) ============
// El profesional solo anota cliente + servicio + ¿reagendo? + ¿le comento un paquete?. Recepcion cobra despues
// desde la cola de abajo (Paso 2), eligiendo medio de pago, seña y reseña. Ver reglas.md "Cierre de turno".
function rtClienteInput(v){
  cobro.cliente=v;
  const c=clienteDe(cobro.clienteId); if(c&&c.nombre!==v) cobro.clienteId=null;
  rtRenderSugerencias();
}
function rtElegirCliente(id){
  const c=clienteDe(id); if(!c) return;
  cobro.clienteId=c.id; cobro.cliente=c.nombre;
  const inp=document.getElementById('turno-nombre'); if(inp) inp.value=c.nombre;
  rtRenderSugerencias();
}
function rtQuitarCliente(){
  cobro.clienteId=null; cobro.cliente='';
  const i=document.getElementById('turno-nombre'); if(i){ i.value=''; i.focus(); }
  rtRenderSugerencias();
}
function rtRenderSugerencias(){
  const el=document.getElementById('cb-cli-sug'); if(!el) return;
  const sel=clienteDe(cobro.clienteId);
  if(sel){
    const s=statsCliente(sel);
    el.innerHTML=`<div style="font-size:12px;color:#34d399;font-weight:700;margin-top:6px;display:flex;flex-wrap:wrap;gap:6px;align-items:center">✓ ${escH(idCorto(sel))||'Cliente elegido'} · ${s.visitas} ${s.visitas===1?'visita':'visitas'} <button class="lnk" onclick="rtQuitarCliente()">cambiar</button></div>`;
    return;
  }
  const q=(cobro.cliente||'').trim();
  if(q.length<2){ el.innerHTML=''; return; }
  const m=buscarClientes(q).slice(0,5);
  const exacto=m.some(c=>c.nkey===nkey(q));
  el.innerHTML=`<div style="display:flex;flex-direction:column;gap:4px;margin-top:6px">${m.map(c=>`<button onclick="rtElegirCliente('${c.id}')" style="text-align:left;padding:9px 12px;border-radius:10px;border:1.5px solid var(--border2);background:var(--s2);color:var(--text);font-family:var(--font);font-size:13px;font-weight:600;cursor:pointer">${escH(c.nombre)}${(c.tarjetas&&c.tarjetas.length)?' 💳':''}<div style="font-size:11px;color:var(--muted2);font-weight:500">${escH(idCorto(c))}</div></button>`).join('')}
    ${exacto?'':`<div style="font-size:11.5px;color:var(--muted2);padding:6px 2px">Es un cliente nuevo — recepción le carga los datos al cobrarle.</div>`}</div>`;
}
function rtToggleServicio(id){
  const i=cobro.servicios.indexOf(id);
  if(i>=0){ cobro.servicios.splice(i,1); delete cobro.opciones[id]; delete cobro.precios[id]; } else cobro.servicios.push(id);
  refreshRegistroTurno();
}
function rtOpcion(id,i){ const s=servicios.find(x=>x.id===id); if(!s||!s.variante) return; cobro.opciones[id]=s.variante.opciones[i].n; refreshRegistroTurno(); }
function rtPrecio(id,v){ const n=parseFloat(v)||0; if(n>0) cobro.precios[id]=n; else delete cobro.precios[id]; refreshRegistroTurno(); }
function rtReag(v){ cobro.reag.estado=(cobro.reag.estado===v?'':v); refreshRegistroTurno(); }
function rtTogglePaquete(rubroId){ cobro.paqueteRubro=(cobro.paqueteRubro===rubroId?null:rubroId); refreshRegistroTurno(); }
function renderRegistrarTurnoForm(c,back,color){
  c.innerHTML=`<div style="display:flex;align-items:center;gap:8px;margin-bottom:16px">${back}<div class="modal-title" style="margin:0">Registrar turno 📝</div><button onclick="closeModal('modal-registro')" style="margin-left:auto;background:var(--s3);border:none;color:var(--muted2);font-size:18px;width:32px;height:32px;border-radius:50%;cursor:pointer">×</button></div>
    <div style="font-size:12px;color:var(--muted2);margin:-8px 0 12px;line-height:1.5">Recepción lo cobra después. Vos solo anotás qué hiciste y pasás al siguiente cliente.</div>
    <div class="field"><label>Cliente * <span style="color:var(--muted);font-weight:500">(si es nuevo, alcanza con el nombre)</span></label><input id="turno-nombre" type="text" autocomplete="off" placeholder="Buscá o escribí el nombre..." value="${escH(cobro.cliente)}" oninput="rtClienteInput(this.value)"/><div id="cb-cli-sug"></div></div>
    <div id="cb-suc"></div>
    <div class="field"><label>¿Qué le hiciste?</label>
      ${serviciosVisibles().length>10?`<input id="cb-q" type="search" placeholder="Buscar servicio..." value="${escH(cobro.q)}" oninput="cobro.q=this.value;refreshRegistroTurno()" style="margin-bottom:8px"/>`:''}
      <div id="cb-serv"></div><div id="cb-extra"></div></div>
    <div class="field"><label>¿Le vendiste algún producto?</label><div id="cb-prods"></div></div>
    <div class="field"><label>🔁 ¿Reagendó?</label><div id="rt-reag"></div></div>
    <div class="field"><label>🎁 ¿Le comentaste algo de un paquete?</label><div id="rt-paq"></div></div>
    <button class="btn btn-primary" onclick="guardarRegistroTurno()" style="background:${color};margin-top:12px">Registrar turno →</button>`;
  refreshRegistroTurno();
}
function refreshRegistroTurno(){
  const color=profile.color;
  const serv=document.getElementById('cb-serv'); if(!serv) return;
  const vis=serviciosVisibles();
  const q=(cobro.q||'').trim().toLowerCase();
  const grupos={};
  vis.forEach(s=>{ (grupos[s.rubro||'']=grupos[s.rubro||'']||[]).push(s); });
  const rids=Object.keys(grupos);
  const pill=(s)=>`<button onclick="rtToggleServicio('${s.id}')" style="${pillStyle(cobro.servicios.includes(s.id),color)}">${escH(s.nombre)} · ${s.variable?'desde ':''}${fp(s.precio)}</button>`;
  if(!vis.length) serv.innerHTML='<div style="font-size:12px;color:var(--muted)">El admin todavía no cargó servicios para tu rubro.</div>';
  else if(q){
    const filtrados=vis.filter(s=>s.nombre.toLowerCase().includes(q));
    serv.innerHTML=filtrados.length?`<div style="display:flex;flex-wrap:wrap;gap:6px">${filtrados.map(pill).join('')}</div>`:'<div style="font-size:12px;color:var(--muted)">No hay servicios que coincidan.</div>';
  } else if(rids.length<=1){
    serv.innerHTML=`<div style="display:flex;flex-wrap:wrap;gap:6px">${grupos[rids[0]].map(pill).join('')}</div>`;
  } else {
    serv.innerHTML=`<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px">${rids.map(rid=>{ const n=grupos[rid].filter(s=>cobro.servicios.includes(s.id)).length; return `<button type="button" onclick="cobroAbrirRubro('${rid}')" style="${pillStyle(cobro.rubroAbierto===rid,color)}">${escH(nombreRubro(rid)||'Otros')}${n?' ('+n+')':''}</button>`; }).join('')}</div>`
      +(cobro.rubroAbierto&&grupos[cobro.rubroAbierto]?`<div style="display:flex;flex-wrap:wrap;gap:6px">${grupos[cobro.rubroAbierto].map(pill).join('')}</div>`:'<div style="font-size:11.5px;color:var(--muted2)">Tocá un rubro para ver sus servicios.</div>');
  }
  const ex=[];
  cobro.servicios.forEach(id=>{
    const s=servicios.find(x=>x.id===id); if(!s) return;
    if(s.variable) ex.push(`<div style="margin-top:8px;display:flex;align-items:center;gap:8px;font-size:12px"><span style="flex:1;color:var(--muted2)">${escH(s.nombre)} — precio final</span><input type="number" inputmode="decimal" placeholder="${s.precio}" value="${cobro.precios[id]||''}" onchange="rtPrecio('${id}',this.value)" style="width:110px;background:var(--s2);border:1.5px solid var(--border2);border-radius:10px;padding:8px 10px;color:var(--text);font-family:var(--font);font-size:14px;font-weight:700;outline:none"/></div>`);
    if(svcConVariante(id)){
      ex.push(`<div style="margin-top:8px"><div style="font-size:11px;font-weight:700;color:var(--muted2);margin-bottom:5px">${escH(s.nombre)}: ${escH(s.variante.titulo||'Opción')} <span style="color:#f472b6">*</span></div><div style="display:flex;gap:6px;flex-wrap:wrap">${s.variante.opciones.map((o,oi)=>`<button onclick="rtOpcion('${id}',${oi})" style="${pillStyle(cobro.opciones[id]===o.n,color)}">${escH(o.n)}${numV(o.extra)?' +'+fp(o.extra):''}</button>`).join('')}</div></div>`);
    }
  });
  document.getElementById('cb-extra').innerHTML=ex.join('')+htmlAgregados('rt');
  document.getElementById('rt-reag').innerHTML=`<div style="display:flex;gap:8px">${[['si','✅ Sí'],['no','❌ No']].map(([v,l])=>`<button onclick="rtReag('${v}')" style="${pillStyle(cobro.reag.estado===v,color)}">${l}</button>`).join('')}</div>`;
  document.getElementById('rt-paq').innerHTML=`<div style="display:flex;gap:6px;flex-wrap:wrap">${rubros.map(r=>`<button onclick="rtTogglePaquete('${r.id}')" style="${pillStyle(cobro.paqueteRubro===r.id,color)}">${escH(r.nombre)}</button>`).join('')}</div><div style="font-size:11px;color:var(--muted2);margin-top:4px">Tocá el rubro si le comentaste algo; si no, dejalo sin marcar.</div>`;
  renderProdsCobro('cb-prods',color);
  renderSucCobro();
}
async function guardarRegistroTurno(){
  const vis=serviciosVisibles();
  const elegidos=cobro.servicios.filter(id=>vis.some(s=>s.id===id));
  if(!elegidos.length){ showToast('Elegí qué le hiciste'); return; }
  const faltaOpcion=elegidos.find(id=>svcConVariante(id)&&!cobro.opciones[id]);
  if(faltaOpcion){ showToast('Elegí la opción de '+(servicios.find(s=>s.id===faltaOpcion)||{}).nombre); return; }
  const nombre=(cobro.cliente||'').trim();
  if(!nombre){ showToast('Poné el nombre del cliente'); return; }
  const cli=cobro.clienteId?clienteDe(cobro.clienteId):clientesDir.find(x=>x.nkey===nkey(nombre));
  const ahora=new Date().toISOString();
  const opciones={}, precios={};
  elegidos.forEach(id=>{ if(cobro.opciones[id]!=null) opciones[id]=cobro.opciones[id]; if(cobro.precios[id]!=null) precios[id]=cobro.precios[id]; });
  const prods={}; Object.entries(cobro.prods||{}).forEach(([pid,n])=>{ if(n>0) prods[pid]=n; });
  const item={id:'rt'+Date.now().toString(36)+Math.random().toString(36).slice(2,6),
    clienteId:cli?cli.id:null, clienteNombre:cli?cli.nombre:nombre, clienteNumero:cli?cli.numero:null,
    servicios:elegidos.map(id=>({id, nombre:(servicios.find(s=>s.id===id)||{}).nombre, precio:precioSvc(id)})),
    opciones, precios, prods,
    reagendo:cobro.reag.estado==='si'?'si':'no',
    paqueteOfrecido:cobro.paqueteRubro?'si':'',
    paqueteRubro:cobro.paqueteRubro||null,
    profId:profile.id, profNombre:profile.name, sucursal:sucursalActual(),
    ts:ahora, estado:'pendiente', upd:ahora};
  await turnosPendientesSt.cambiar(l=>{ l.push(item); });
  closeModal('modal-registro'); showToast('Turno registrado ✓ — recepción lo va a cobrar');
  resetCobro(); renderHub();
}

// ============ COBRAR UN TURNO REGISTRADO (Diego Laure, paso 2 — lo hace recepción) ============
async function abrirCobrarPendiente(id){
  const pt=turnosPendientesSt.list.find(x=>x.id===id);
  if(!pt||pt.estado!=='pendiente'){ showToast('Ese turno ya no está'); return; }
  const prof=allUsers.find(u=>u.id===pt.profId);
  if(!prof){ showToast('No encuentro al profesional que lo registró'); return; }
  if(!await cajaOkParaCobrar(pt.sucursal)) return;
  resetCobro();
  cobro.clienteId=pt.clienteId; cobro.cliente=pt.clienteNombre;
  cobro.servicios=pt.servicios.map(s=>s.id);
  pt.servicios.forEach(s=>{ const real=servicios.find(x=>x.id===s.id); if(real&&real.variable&&s.precio!==real.precio) cobro.precios[s.id]=s.precio; });
  Object.assign(cobro.opciones, pt.opciones||{});
  Object.assign(cobro.precios, pt.precios||{});
  Object.assign(cobro.prodsProf, pt.prods||{}); // productos que el profesional ya cargó al registrar el turno
  // Hora real del servicio (cuando el profesional lo registró), no "ahora": si recepción tarda en cobrarlo y
  // se pasa de una franja horaria con descuento (ej. 20% antes de las 12), el cliente perdía el descuento que
  // le correspondía por la hora real en que lo atendieron. Bug real reportado por Ivo (1/10/2026). Sigue
  // editable a mano si hace falta (campo "Hora del turno").
  if(pt.ts) cobro.hora=new Date(pt.ts).toTimeString().slice(0,5);
  cobro.sucursal=pt.sucursal;
  if(pt.reagendo==='si') cobro.reag.estado='si';
  cobro.paqueteRubro=pt.paqueteRubro||null;
  cobro.paqueteOfrecidoPrev=pt.paqueteOfrecido||'';
  cobroParaProf=prof; cobroPendienteId=pt.id;
  regState={step:1,tipo:'turno',monto:0,medio:'',categoria:'',directo:true};
  openModal('modal-registro');
  if(!pt.clienteId){ abrirFormCliente(null,{deCobro:true,nombre:pt.clienteNombre}); return; } // cliente nuevo: primero carga sus datos completos
  renderRegistro();
  avisoSiProblema(clienteDe(pt.clienteId));
}
function htmlTurnosPendientesRec(){
  const L=turnosPendientesSt.list.filter(x=>x.estado==='pendiente').sort((a,b)=>String(a.ts).localeCompare(String(b.ts)));
  if(!L.length) return '';
  return `<div class="sec-hdr" style="margin-top:16px;margin-bottom:8px"><span class="sec-title">📝 Turnos para cobrar (${L.length})</span></div>
    ${L.map(x=>`<div class="card" style="margin-bottom:8px;border-left:5px solid #4A136B">
      <div style="font-size:14px;font-weight:800"><span style="text-transform:capitalize">${escH(x.clienteNombre)}</span>${x.clienteNumero&&verNumeroCliente()?' #'+x.clienteNumero:''}</div>
      <div style="font-size:12px;color:var(--muted2);margin:3px 0;text-transform:capitalize">${escH(x.servicios.map(s=>s.nombre).join(', '))}</div>
      <div style="font-size:11px;color:var(--muted2)">✂️ <span style="text-transform:capitalize">${escH(x.profNombre)}</span> · ${minutosDesde(x.ts)}</div>
      <div style="display:flex;align-items:center;gap:8px;margin-top:8px"><button class="btn btn-primary" style="flex:1" onclick="abrirCobrarPendiente('${x.id}')">💳 Cobrar${x.reagendo==='si'||x.paqueteRubro?' <span style="opacity:.75;font-weight:600">('+[x.reagendo==='si'?'reagendó':null,x.paqueteRubro?'comentó '+escH(nombreRubro(x.paqueteRubro)||x.paqueteRubro):null].filter(Boolean).join(' · ')+')</span>':''}</button>
      <button class="btn btn-ghost" style="width:auto;flex:0 0 auto;padding:8px 10px;font-size:12px;color:var(--muted2)" onclick="eliminarTurnoPendiente('${x.id}')" title="Eliminar">🗑️</button></div></div>`).join('')}`;
}
// Pedido de Ivo (2/10/2026): sacar un turno "para cobrar" que un profesional mandó mal (ej. equivocado,
// duplicado). No se cobró nunca, asi que no genera comision/puntos/caja/reagendo -- no toca nada de eso, solo
// cambia el estado de turnosPendientesSt (que ya deja de filtrarse en el proximo refresco de 15s, como cualquier
// otro que ya no esta 'pendiente'). Una seña que el cliente ya haya dejado no depende de este registro: queda
// en senasSt por profId/cliente, disponible para aplicarse al cobro real que se haga despues.
async function eliminarTurnoPendiente(id){
  const pt=turnosPendientesSt.list.find(x=>x.id===id);
  if(!pt||pt.estado!=='pendiente'){ showToast('Ese turno ya no está'); return; }
  const motivo=await uiPrompt('Eliminar turno para cobrar',{msg:'¿Por qué se elimina "'+pt.servicios.map(s=>s.nombre).join(', ')+'" de '+pt.clienteNombre+' ('+pt.profNombre+')? No se va a cobrar, y no genera comisión, puntos, caja ni reagendo.',type:'textarea',ok:'Eliminar'});
  if(motivo==null) return;
  const m=motivo.trim();
  if(!m){ showToast('Poné un motivo breve'); return; }
  const ahora=new Date().toISOString();
  await turnosPendientesSt.cambiar(l=>{ const x=l.find(z=>z.id===id); if(x&&x.estado==='pendiente'){ x.estado='eliminado'; x.eliminadoPorId=profile.id; x.eliminadoPor=profile.name; x.eliminadoEn=ahora; x.eliminadoMotivo=m; x.upd=ahora; } });
  showToast('Turno eliminado'); refreshCurrentView();
}

// ---------- corregir un cobro ya cerrado (ej. se cobró mal) ----------
// Pedido de Ivo (1/10/2026): recepción lo puede corregir directo (sin esperar a Admin), pero queda anotado
// (editado/editadoPor/editOriginal) para que Admin lo revise después — ver turnosEditadosRecientes() en
// 15-admin-panel.js. No rehace el cálculo de descuentos: es una corrección directa para errores comunes
// (servicio equivocado, monto mal tipeado, medio de pago mal elegido), no para turnos con una seña aplicada.
let editCobroSel=null;
function abrirEditarCobro(profId,turnoId){
  let dd={}; try{ dd=JSON.parse(localStorage.getItem('luffy_dinero_'+profId)||'{}'); }catch(e){}
  const t=(dd.turnos||[]).find(x=>x.id===turnoId);
  if(!t){ showToast('No encuentro ese cobro en este dispositivo — probá desde uno que lo haya cargado'); return; }
  if(t.fecha&&diasDesdeStr(t.fecha)>2){ showToast('Ya pasaron más de 2 días — pedile a Ivo que lo corrija desde Admin'); return; }
  editCobroSel={profId,turnoId,servicio:t.servicio||'',monto:numV(t.aCobrar!=null?t.aCobrar:t.monto),medio:t.medio||'efectivo',motivo:''};
  renderEditarCobro();
  openModal('modal-registro');
}
// Lee lo tipeado en los campos libres ANTES de cualquier cambio que re-renderice el form (ej. tocar el medio
// de pago) -- si no, un re-render los pisaba con lo que había al abrir y se perdía lo que la persona ya había
// corregido. Mismo patrón que leerFormSena()/leerComUsr() en otros formularios de esta app.
function leerEditCobro(){
  const g=(i)=>{ const e=document.getElementById(i); return e?e.value:undefined; };
  const s=g('ec-cobro-servicio'); if(s!==undefined) editCobroSel.servicio=s;
  const m=g('ec-cobro-monto'); if(m!==undefined) editCobroSel.monto=m;
  const mo=g('ec-cobro-motivo'); if(mo!==undefined) editCobroSel.motivo=mo;
}
function ecCobroMedio(m){ leerEditCobro(); editCobroSel.medio=m; renderEditarCobro(); }
function renderEditarCobro(){
  const s=editCobroSel; if(!s) return; const color=(profile&&profile.color)||'#4A136B';
  document.getElementById('registro-content').innerHTML=cabeceraModal('✏️ Corregir cobro')+`
    <div style="font-size:12px;color:var(--muted2);margin-bottom:12px;line-height:1.5">Para corregir un error al cobrar (servicio equivocado, monto mal puesto, medio de pago mal elegido). Queda anotado para que Admin lo revise.</div>
    <div class="field"><label>Servicio</label><input id="ec-cobro-servicio" value="${escH(s.servicio)}"/></div>
    <div class="field" style="margin-top:8px"><label>Monto que corresponde cobrar</label><input id="ec-cobro-monto" type="number" inputmode="decimal" value="${s.monto}"/></div>
    <div class="field" style="margin-top:8px"><label>Medio de pago</label>${htmlMedios('ecCobroMedio',s.medio,color)}</div>
    <div class="field" style="margin-top:8px"><label>¿Por qué se corrige? (opcional)</label><input id="ec-cobro-motivo" value="${escH(s.motivo||'')}" placeholder="Ej: se cobró el servicio equivocado"/></div>
    <button class="btn btn-primary" onclick="guardarEdicionCobro()" style="background:${color}">Guardar corrección</button>`;
}
async function guardarEdicionCobro(){
  leerEditCobro();
  const s=editCobroSel; if(!s) return;
  const servicio=(s.servicio||'').trim();
  const monto=numV(s.monto);
  const motivo=(s.motivo||'').trim();
  if(!servicio){ showToast('Poné el servicio'); return; }
  if(monto<=0){ showToast('Poné un monto válido'); return; }
  const ahora=new Date().toISOString();
  const ok=await modificarDineroDe(s.profId,dd=>{
    const t=(dd.turnos||[]).find(x=>x.id===s.turnoId); if(!t) return false;
    if(!t.editOriginal) t.editOriginal={servicio:t.servicio,monto:t.monto,aCobrar:t.aCobrar,medio:t.medio}; // solo la primera vez: se guarda el original real
    t.servicio=servicio; t.monto=monto; t.aCobrar=monto; t.medio=s.medio;
    t.editado=true; t.editadoPor=profile.name; t.editadoEn=ahora; t.editMotivo=motivo;
    return true;
  });
  if(!ok){ showToast('No se encontró el cobro'); return; }
  editCobroSel=null; closeModal('modal-registro'); showToast('Cobro corregido ✓ — queda anotado para que Admin lo revise'); refreshCurrentView();
}

function guardarVentaProducto(){
  const nomP=(ventaProd.cliente||'').trim(); let cli=null;
  if(nomP){ cli=clienteDe(ventaProd.clienteId)||clientesDir.find(x=>x.nkey===nkey(nomP)); if(!cli){ showToast('Elegí al cliente de la lista o tocá "➕ Agregar" para cargarlo nuevo'); return; } }
  const cliente=cli?cli.nombre:'';
  const prodId=document.getElementById('prod-sel')?.value;
  const cantidad=parseInt(document.getElementById('prod-cant')?.value)||0;
  const producto=productos.find(p=>p.id===prodId);
  if(!producto||cantidad<1){ showToast('Elegí un producto y una cantidad válida'); return; }
  if(cantidad>producto.stock){ showToast('No hay stock suficiente (quedan '+producto.stock+')'); return; }
  const fecha=ymdLocal(new Date());
  const total=producto.precioVenta*cantidad;
  const comision=Math.round(total*(producto.comisionPct/100));
  if(!dineroData.ventas) dineroData.ventas=[];
  dineroData.ventas.push({
    id:Date.now().toString(),
    cliente, clienteId:cli?cli.id:null, sucursal:sucursalActual(),
    productoId:producto.id,
    productoNombre:producto.nombre,
    cantidad, precioUnitario:producto.precioVenta, total, comision, costoUnitario:producto.costo||0,
    medio:document.getElementById('prod-medio')?.value||'efectivo',
    fecha, creadoEn:new Date().toISOString()
  });
  saveDinero();
  ajustarStock([{id:producto.id,delta:-cantidad}]);
  closeModal('modal-registro');
  showToast('Venta registrada ✓ +'+fp(comision)+' de comisión');
  refreshCurrentView();
}

function regConfirmMonto(){
  const v=parseFloat(document.getElementById('reg-monto')?.value)||0;
  if(!v){ showToast('Ingresá el monto'); return; }
  regState.monto=v; regState.step=2; renderRegistro();
}
function regSelMedio(m){ regState.medio=m; regState.step=3; renderRegistro(); }
function regSelCat(cat){ regState.categoria=cat; regState.step=4; renderRegistro(); }

function regGuardar(){
  const fecha=document.getElementById('reg-fecha')?.value||ymdLocal(new Date());
  const nota=document.getElementById('reg-nota')?.value.trim()||'';
  const id=Date.now().toString();
  if(regState.tipo==='turno'){
    if(!dineroData.turnos) dineroData.turnos=[];
    dineroData.turnos.push({id,cliente:nota,servicio:regState.categoria,monto:regState.monto,medio:regState.medio,fecha,creadoEn:new Date().toISOString()});
    saveDinero();
  } else if(regState.tipo==='gasto'){
    if(!yoData.gastos) yoData.gastos=[];
    yoData.gastos.push({id,desc:nota||regState.categoria,monto:regState.monto,medio:regState.medio,categoria:regState.categoria,fecha,tipo:'variable'});
    saveYo();
  } else {
    if(!yoData.ingresos) yoData.ingresos=[];
    yoData.ingresos.push({id,desc:nota||regState.categoria,monto:regState.monto,categoria:regState.categoria,fecha});
    saveYo();
  }
  closeModal('modal-registro');
  showToast(regState.tipo.charAt(0).toUpperCase()+regState.tipo.slice(1)+' guardado ✓');
  renderHub();
}

