// ============ DEUDAS CON PAGOS PARCIALES ============
// Una deuda tiene su total (monto) y una lista de pagos. Cada pago genera su propio turno (y ventas de productos) en
// proporcion a lo pagado, con la fecha del PAGO: asi cada parte suma a la quincena en que realmente se cobra.
const pagosDe=(d)=>d.pagos||[];
const pagadoDe=(d)=>pagosDe(d).reduce((s,p)=>s+numV(p.monto),0);
const saldoDeuda=(d)=>d.anulada?0:Math.max(0,numV(d.monto)-pagadoDe(d));
const perdidoDeuda=(d)=>Math.max(0,numV(d.monto)-pagadoDe(d));
function aplicarPagoDeuda(dd,deudaId,medio,monto){
  const d=(dd.deudores||[]).find(x=>x.id===deudaId);
  if(!d||d.saldado) return false;
  const saldo=saldoDeuda(d); const pago=Math.min(saldo,Math.max(0,Math.round(numV(monto)||saldo))); if(pago<=0) return false;
  const hoy=hoyStr(), ahora=new Date().toISOString();
  const primero=!pagosDe(d).length, completa=pago>=saldo-0.5, entera=primero&&completa;
  const f=entera?1:pago/Math.max(1,numV(d.monto));
  const pid='pg'+Date.now().toString(36)+Math.floor(Math.random()*1000);
  d.pagos=[...pagosDe(d),{id:pid,monto:pago,medio,fecha:hoy,ts:ahora,por:profile.name,porId:profile.id}];
  d.cobradoPor=profile.name; d.medioPago=medio;
  if(completa){ d.saldado=true; d.fechaPago=hoy; d.cobradoEn=ahora; }
  const tid=entera?'d'+deudaId:'d'+deudaId+'x'+d.pagos.length;
  const esc=(x)=>entera?x:Math.round(numV(x)*f);
  if(!dd.turnos.find(t=>t.id===tid)){
    const montoSvc=d.montoServicios!=null?d.montoServicios:d.monto;
    dd.turnos.push({id:tid, cliente:d.cliente, servicio:(d.servicio||d.motivo||'Deuda saldada')+(entera?'':' (pago parcial)'), servicios:d.servicios, oferta:d.oferta||null, descuento:esc(d.descuento||0), descuentoTipo:d.descuentoTipo||null, subtotal:esc(d.subtotal!=null?d.subtotal:numV(d.monto)),
      monto:esc(montoSvc), medio, fecha:hoy, fechaServicio:d.fecha, deudaId, pagoId:pid, parte:entera?1:f, creadoEn:ahora, clienteId:d.clienteId||null, clienteNumero:d.clienteNumero||null, sucursal:d.sucursal||null, descDetalle:d.descDetalle||null, descPct:d.descPct||0, comFija:d.comFija!=null?esc(d.comFija):null, comFijaBase:esc(d.comFijaBase||0), aCobrar:esc(d.aCobrarServ!=null?d.aCobrarServ:montoSvc), prepago:esc(d.prepago||0), prepagos:d.prepagos||[], horaTurno:d.horaTurno||null, reag:d.reag||null});
  }
  (d.productos||[]).forEach((p,i)=>{
    const vid='d'+deudaId+(entera?'':'x'+d.pagos.length)+'p'+i;
    if(!dd.ventas.find(v=>v.id===vid)) dd.ventas.push({...p, id:vid, turnoId:tid, total:esc(p.total), comision:esc(p.comision||0), costoUnitario:entera?p.costoUnitario:(numV(p.costoUnitario)*f), cliente:d.cliente, clienteId:d.clienteId||null, sucursal:d.sucursal||null, medio, fecha:hoy, fechaServicio:d.fecha, deudaId, creadoEn:ahora});
  });
  return true;
}
function htmlPagosDeuda(d){
  const P=pagosDe(d); if(!P.length) return '';
  return `<div style="margin-top:6px;padding-top:6px;border-top:1px dashed var(--border2);font-size:11.5px;color:var(--muted2)"><b style="color:#34d399">Ya pagó ${fp(pagadoDe(d))}</b> en ${P.length} ${P.length===1?'pago':'pagos'}: ${P.map(p=>fechaCortaStr(p.fecha)+' '+fp(p.monto)+' ('+({efectivo:'efectivo',mp:'MP',tarjeta:'tarjeta'}[p.medio]||p.medio)+(p.por?' · '+escH(p.por):'')+')').join(' · ')}</div>`;
}
// Lo que un cliente debe hoy (suma de sus deudas pendientes, con todo el equipo)
function deudasDeCliente(cid,nombre){ return todasLasDeudas().filter(d=>(cid&&d.clienteId===cid)||(!d.clienteId&&nombre&&nkey(d.cliente)===nkey(nombre))); }
const saldoDeCliente=(cid,nombre)=>deudasDeCliente(cid,nombre).reduce((s,d)=>s+saldoDeuda(d),0);
// ---------- modal de cobro (total o parcial) ----------
function abrirCobroDeuda(profId,id){
  if(!puedeCobrarDeuda(profId,id)){ showToast('Las deudas las cobra recepción'); return; }
  const d=buscarDeuda(profId,id);
  if(!d){ showToast('Esa deuda ya no está pendiente'); return; }
  cobroDeudaSel={profId,id,medio:'efectivo'};
  renderCobroDeuda();
  openModal('modal-registro');
}
function cobroDeudaMedio(m){ if(cobroDeudaSel){ const el=document.getElementById('cd-monto'); if(el) cobroDeudaSel.monto=el.value; cobroDeudaSel.medio=m; renderCobroDeuda(); } }
function cdSet(v){ const el=document.getElementById('cd-monto'); if(el) el.value=v; cdEtiqueta(); }
function cdEtiqueta(){
  const s=cobroDeudaSel; const d=s&&buscarDeuda(s.profId,s.id); const b=document.getElementById('cd-btn'), info=document.getElementById('cd-info'); if(!d||!b) return;
  const saldo=saldoDeuda(d), m=Math.round(numV(document.getElementById('cd-monto').value));
  const ok=m>0&&m<=saldo+0.5, completa=ok&&m>=saldo-0.5;
  b.textContent=!ok?(m>saldo?'No puede pagar más de '+fp(saldo):'Poné cuánto pagó'):(completa?'✓ Confirmar cobro de '+fp(m)+' (queda saldada)':'✓ Confirmar pago parcial de '+fp(m));
  if(info) info.innerHTML=ok&&!completa?`Le va a quedar debiendo <b style="color:#f472b6">${fp(saldo-m)}</b>. Queda anotado en su ficha.`:'';
}
function renderCobroDeuda(){
  const c=document.getElementById('registro-content');
  const s=cobroDeudaSel; const d=s&&buscarDeuda(s.profId,s.id);
  if(!d){ closeModal('modal-registro'); return; }
  const color=(profile&&profile.color)||'#4A136B'; const propio=profile&&profile.id===d.prof.id; const saldo=saldoDeuda(d);
  const val=s.monto!==undefined&&s.monto!==''?s.monto:saldo;
  c.innerHTML=`<div style="display:flex;align-items:center;gap:8px;margin-bottom:16px"><div class="modal-title" style="margin:0">Cobrar deuda 🚫</div><button onclick="closeModal('modal-registro')" style="margin-left:auto;background:var(--s3);border:none;color:var(--muted2);font-size:18px;width:32px;height:32px;border-radius:50%;cursor:pointer">×</button></div>
    <div class="card" style="margin-bottom:12px">
      <div style="font-size:16px;font-weight:800">${escH(d.cliente)}</div>
      <div style="font-size:11px;color:var(--muted2);margin-bottom:8px">${propio?'Tu cliente':'Cliente de '+escH(d.prof.name)} · servicio del ${fechaCortaStr(d.fecha)} (hace ${diasDesdeStr(d.fecha)} días)${d.motivo?' · '+escH(d.motivo):''}</div>
      ${detalleDeudaHtml(d,true)}
      <div style="display:flex;justify-content:space-between;align-items:baseline;margin-top:8px;padding-top:8px;border-top:1.5px solid var(--border2)"><span style="font-size:13px;font-weight:700">${pagadoDe(d)>0?'LE FALTA PAGAR':'DEBE'}</span><span style="font-size:24px;font-weight:900;color:#f472b6">${fp(saldo)}</span></div>
    </div>
    <div class="field"><label>¿Cuánto paga ahora?</label><input id="cd-monto" type="number" inputmode="decimal" value="${escH(val)}" oninput="cdEtiqueta()"/>
      <div style="display:flex;gap:6px;margin-top:6px"><button onclick="cdSet(${saldo})" style="${pillStyle(false,color)}">Todo (${fp(saldo)})</button>${saldo>=2000?`<button onclick="cdSet(${Math.round(saldo/2)})" style="${pillStyle(false,color)}">La mitad</button>`:''}</div>
      <div id="cd-info" style="font-size:12px;margin-top:6px"></div></div>
    <div class="field"><label>¿Cómo pagó?</label>
      <div style="display:flex;gap:8px">${[['💵','Efectivo','efectivo'],['📱','Mercado Pago','mp'],['💳','Tarjeta','tarjeta']].map(([e,l,v])=>{ const sel=s.medio===v; return `<button onclick="cobroDeudaMedio('${v}')" style="flex:1;padding:12px 6px;border-radius:12px;border:1.5px solid ${sel?color:'var(--border2)'};background:${sel?color+'22':'transparent'};cursor:pointer;font-family:var(--font);font-size:11px;font-weight:700;color:${sel?color:'var(--muted2)'}"><div style="font-size:20px;margin-bottom:2px">${e}</div>${l}</button>`; }).join('')}</div>
    </div>
    <div style="font-size:11.5px;color:var(--muted2);line-height:1.5;background:var(--s2);border-radius:10px;padding:10px 12px;margin-bottom:12px">Lo que pague se suma a la quincena de <b style="color:var(--text)">${escH(d.prof.name)}</b> del <b style="color:var(--text)">${quincenaLabel(hoyStr())}</b> (la fecha de <b>hoy</b>), no a la del servicio.</div>
    <button id="cd-btn" class="btn btn-primary" onclick="confirmarCobroDeuda()" style="background:${color}">✓ Confirmar</button>`;
  cdEtiqueta();
}
function confirmarCobroDeuda(){
  const s=cobroDeudaSel; if(!s||!puedeCobrarDeuda(s.profId,s.id)){ showToast('Las deudas las cobra recepción'); return; }
  const d=buscarDeuda(s.profId,s.id); if(!d){ closeModal('modal-registro'); return; }
  const saldo=saldoDeuda(d); const el=document.getElementById('cd-monto'); const monto=el?Math.round(numV(el.value)):saldo;
  if(!(monto>0)){ showToast('Poné cuánto pagó'); return; }
  if(monto>saldo+0.5){ showToast('No puede pagar más de lo que debe ('+fp(saldo)+')'); return; }
  const completa=monto>=saldo-0.5;
  const fin=(ok)=>{
    closeModal('modal-registro');
    showToast(ok?(completa?`Deuda saldada ✓ — suma a la quincena del ${quincenaLabel(hoyStr())} de ${d.prof.name}`:`Pago parcial de ${fp(monto)} ✓ — le quedan ${fp(saldo-monto)}`):'Esa deuda ya estaba cobrada');
    cobroDeudaSel=null; refreshCurrentView();
  };
  if(profile.id===s.profId){
    const ok=aplicarPagoDeuda(dineroData,s.id,s.medio,monto);
    if(ok) saveDinero();
    fin(ok);
  } else {
    modificarDineroDe(s.profId,dd=>aplicarPagoDeuda(dd,s.id,s.medio,monto)).then(fin).catch(()=>showToast('No se pudo guardar, probá de nuevo'));
  }
}
// ---------- en la ficha del cliente ----------
function htmlDeudaCliente(c){
  const L=deudasDeCliente(c.id,c.nombre); if(!L.length) return '';
  const total=L.reduce((s,d)=>s+saldoDeuda(d),0);
  return `<div class="card" style="margin-bottom:10px;border-color:rgba(244,114,182,.5);background:rgba(244,114,182,.05)"><div style="font-size:12.5px;font-weight:800;color:#f472b6">🚫 Debe ${fp(total)}</div>${L.map(d=>`<div style="font-size:12px;margin-top:6px;padding-top:6px;border-top:1px solid var(--border)"><div style="display:flex;justify-content:space-between;gap:8px"><span>${escH(d.servicio||d.motivo||'Servicio')} · del ${fechaCortaStr(d.fecha)} (${escH(d.prof.name)})</span><b>${fp(saldoDeuda(d))}</b></div>${htmlPagosDeuda(d)}${puedeCobrarDeuda(d.prof.id,d.id)?`<button class="lnk" onclick="abrirCobroDeuda('${d.prof.id}','${d.id}')" style="margin-top:4px">💰 Cobrar / pago parcial</button>`:''}</div>`).join('')}</div>`;
}
// ============ SEÑAS ============
// Una seña es plata que un cliente deja por adelantado para un turno puntual ya agendado, con un profesional.
// Queda ligada a ese turno de la Agenda (turnoAgendaId) y se descuenta sola al cobrarlo (no le cambia la comision
// al profesional). Estados: pendiente -> aplicada (se uso) | devuelta (se le devolvio la plata) | retenida (se la queda el salon).
const senasSt=almacenLista('luffy/senas','luffy_senas',(a,b)=>{ const base=nuevoMayor(a,b); const m=new Map(); [...(a.usos||[]),...(b.usos||[])].forEach(u=>m.set(u.turnoId,u)); return {...base,usos:[...m.values()]}; });
const saldoSena=(s)=>s.estado==='pendiente'?Math.max(0,numV(s.monto)-(s.usos||[]).reduce((a,u)=>a+numV(u.monto),0)):0;
// Fecha del turno de Agenda al que está ligada (si el turno se reagenda, esto sigue solo porque se busca en vivo).
// Señas viejas sin turnoAgendaId (de antes de este cambio) se tratan como "ya vencidas" -> aparecen en Cosas por cobrar.
function senaFechaTurno(s){ if(!s.turnoAgendaId) return null; const a=agendaSt.list.find(x=>x.id===s.turnoAgendaId); return a?a.fecha:null; }
const senasPend=()=>senasSt.list.filter(s=>saldoSena(s)>0).sort((a,b)=>String(a.ts).localeCompare(String(b.ts)));
const senasPendHoy=()=>senasPend().filter(s=>{ const f=senaFechaTurno(s); return !f||f<=hoyStr(); });
const senasPendFuturas=()=>senasPend().filter(s=>{ const f=senaFechaTurno(s); return f&&f>hoyStr(); });
const senasDeCliente=(cid,nombre)=>senasPend().filter(s=>(cid&&s.clienteId===cid)||(!s.clienteId&&nombre&&nkey(s.clienteNombre)===nkey(nombre)));
const medioTxt=(m)=>({efectivo:'efectivo',mp:'Mercado Pago',tarjeta:'tarjeta'}[m]||m||'');
const profesionalesLista=()=>allUsers.filter(u=>esProf(u));

// ---------- registrar una seña ----------
// La seña se liga a un turno puntual YA agendado (pedido de Ivo, 1/10/2026: en la práctica siempre existe el
// turno antes de que el cliente deje la seña) — de ahí sale el profesional y la fecha para saber cuándo pasa
// de "cola de señas" a "Cosas por cobrar" (ver senasPendHoy/senasPendFuturas).
let senaForm=null;
function abrirFormSena(pre){
  senaForm={cliente:'',clienteId:null,turnoAgendaId:null,monto:'',medio:'efectivo',nota:'',...(pre||{})};
  renderFormSena(); openModal('modal-registro');
}
function senaCampo(k,v){ senaForm[k]=v; if(k==='medio'||k==='turnoAgendaId') renderFormSena(); }
function senaCliInput(v){ senaForm.cliente=v; const c=clienteDe(senaForm.clienteId); if(c&&c.nombre!==v){ senaForm.clienteId=null; senaForm.turnoAgendaId=null; } renderSugSena(); }
function senaElegirCli(id){ const c=clienteDe(id); if(!c) return; senaForm.clienteId=c.id; senaForm.cliente=c.nombre; senaForm.turnoAgendaId=null; renderFormSena(); }
function turnosActivosDeCliente(cid){ return agendaSt.list.filter(a=>a.clienteId===cid&&agEsActivo(a)&&a.fecha>=hoyStr()).sort((a,b)=>(a.fecha+a.hora).localeCompare(b.fecha+b.hora)); }
function senaAgregarCli(){ leerFormSena(); abrirFormCliente(null,{deSena:true,nombre:(senaForm.cliente||'').trim()}); }
function leerFormSena(){ const g=(i)=>{ const e=document.getElementById(i); return e?e.value:undefined; }; const m=g('sn-monto'); if(m!==undefined) senaForm.monto=m; const n=g('sn-nota'); if(n!==undefined) senaForm.nota=n; }
function renderSugSena(){
  const el=document.getElementById('sn-cli-sug'); if(!el) return; const sel=clienteDe(senaForm.clienteId);
  if(sel){ el.innerHTML=`<div style="font-size:12px;color:#34d399;font-weight:700;margin-top:6px">✓ ${escH(sel.nombre)}${verNumeroCliente()?' #'+sel.numero:''} · ${escH(idCorto(sel))} <button class="lnk" onclick="senaForm.clienteId=null;senaForm.cliente='';renderFormSena()">cambiar</button></div>`; return; }
  const q=(senaForm.cliente||'').trim(); if(q.length<2){ el.innerHTML=''; return; }
  const m=buscarClientes(q).slice(0,5); const exacto=m.some(c=>c.nkey===nkey(q)); const color=(profile&&profile.color)||'#4A136B';
  el.innerHTML=`<div style="display:flex;flex-direction:column;gap:4px;margin-top:6px">${m.map(c=>`<button onclick="senaElegirCli('${c.id}')" style="text-align:left;padding:9px 12px;border-radius:10px;border:1.5px solid var(--border2);background:var(--s2);color:var(--text);font-family:var(--font);font-size:13px;font-weight:600;cursor:pointer">${escH(c.nombre)}${verNumeroCliente()?' <span style="color:var(--muted2)">#'+c.numero+'</span>':''}<div style="font-size:11px;color:var(--muted2);font-weight:500">${escH(idCorto(c))}</div></button>`).join('')}${exacto?'':`<button onclick="senaAgregarCli()" style="text-align:left;padding:10px 12px;border-radius:10px;border:1.5px dashed ${color};background:transparent;color:${color};font-family:var(--font);font-size:13px;font-weight:800;cursor:pointer">➕ Agregar «${escH(q)}» como cliente nuevo</button>`}</div>`;
}
function renderFormSena(){
  const s=senaForm; const color=(profile&&profile.color)||'#4A136B';
  const cli=clienteDe(s.clienteId);
  const turnos=cli?turnosActivosDeCliente(cli.id):[];
  const puedeGuardar=cli&&s.turnoAgendaId;
  document.getElementById('registro-content').innerHTML=cabeceraModal('Registrar seña 💵')+`
    <div class="field"><label>Cliente</label><input id="sn-cli" autocomplete="off" placeholder="Buscá o escribí el nombre…" value="${escH(s.cliente)}" oninput="senaCliInput(this.value)"/><div id="sn-cli-sug"></div></div>
    ${cli?`<div class="field" style="margin-top:8px"><label>¿Para qué turno es la seña?</label>
      ${turnos.length?`<div style="display:flex;flex-direction:column;gap:6px">${turnos.map(a=>`<button onclick="senaCampo('turnoAgendaId','${a.id}')" style="text-align:left;${pillStyle(s.turnoAgendaId===a.id,color)}">${fechaCortaStr(a.fecha)} · ${a.hora}hs con ${escH(a.profNombre)}${(a.servicios&&a.servicios.length)?' · '+escH(a.servicios.map(x=>x.nombre).join(', ')):''}</button>`).join('')}</div>`
        :`<div style="font-size:12.5px;color:var(--muted);line-height:1.5">${escH(cli.nombre)} no tiene ningún turno agendado todavía. Cargalo primero en la Agenda y volvé acá para registrar la seña.</div>`}
      </div>`:''}
    <div class="field" style="margin-top:8px"><label>Monto de la seña</label><input id="sn-monto" type="number" inputmode="decimal" placeholder="0" value="${escH(s.monto)}"/></div>
    <div class="field" style="margin-top:8px"><label>¿Cómo la dejó?</label>${htmlMedios('senaMedioSet',s.medio,color)}</div>
    <div class="field" style="margin-top:8px"><label>Nota (opcional)</label><input id="sn-nota" placeholder="Ej: lo dejó en efectivo" value="${escH(s.nota)}"/></div>
    <div style="font-size:11.5px;color:var(--muted2);margin:8px 0">Se le descuenta sola cuando se cobre ese turno.</div>
    <button class="btn btn-primary" onclick="guardarSena()" style="background:${color}" ${puedeGuardar?'':'disabled'}>Guardar seña</button>`;
  renderSugSena();
}
function senaMedioSet(m){ leerFormSena(); senaForm.medio=m; renderFormSena(); }
async function guardarSena(){
  leerFormSena(); const s=senaForm; const cli=clienteDe(s.clienteId);
  if(!cli){ showToast('Elegí al cliente de la lista o tocá "➕ Agregar" para cargarlo'); return; }
  const turno=agendaSt.list.find(a=>a.id===s.turnoAgendaId);
  if(!turno){ showToast('Elegí para qué turno es la seña'); return; }
  const monto=numV(s.monto); if(monto<=0){ showToast('Poné el monto de la seña'); return; }
  const prof=allUsers.find(u=>u.id===turno.profId); if(!prof){ showToast('No encuentro al profesional de ese turno'); return; }
  await crearSena({cli,prof,monto,medio:s.medio,nota:(s.nota||'').trim(),turnoAgendaId:turno.id});
  senaForm=null; closeModal('modal-registro'); showToast('Seña guardada ✓ '+fp(monto)+' de '+cli.nombre); refreshCurrentView();
}
async function crearSena({cli,prof,monto,medio,nota,idFijo,nombreCliente,turnoAgendaId}){
  const ahora=new Date().toISOString();
  return senasSt.cambiar(l=>{
    if(idFijo&&l.some(x=>x.id===idFijo)) return null;
    const x={id:idFijo||'sn'+Date.now().toString(36)+Math.floor(Math.random()*100),clienteId:cli?cli.id:null,clienteNombre:cli?cli.nombre:(nombreCliente||'Cliente'),clienteNumero:cli?cli.numero:null,profId:prof.id,profNombre:prof.name,turnoAgendaId:turnoAgendaId||null,
      monto,medio,fecha:hoyStr(),ts:ahora,estado:'pendiente',usos:[],nota:nota||'',recId:profile.id,recNombre:profile.name,recRol:profile.role,sucursal:sucursalActual()||profile.sucursal||prof.sucursal||null,creadoEn:ahora,upd:ahora};
    l.push(x); return x;
  });
}
// ---------- al cobrar un turno: se descuenta sola ----------
function cobroAutoSenas(){
  const c=clienteDe(cobro.clienteId); if(!c){ cobro.senasSel=[]; return; }
  cobro.senasSel=senasDeCliente(c.id,c.nombre).filter(s=>s.profId===profile.id).map(s=>s.id);
}
function cobroToggleSena(id){ cobro.senasSel=cobro.senasSel||[]; const i=cobro.senasSel.indexOf(id); if(i>=0) cobro.senasSel.splice(i,1); else cobro.senasSel.push(id); refreshCobro(); }
function calcSenasCobro(base){
  let resto=base; const usos=[];
  (cobro.senasSel||[]).forEach(id=>{ const sn=senasSt.list.find(x=>x.id===id); if(!sn) return; const sal=saldoSena(sn); const usa=Math.min(sal,resto); if(usa>0){ usos.push({id,monto:usa}); resto-=usa; } });
  return {usos,total:usos.reduce((a,u)=>a+u.monto,0)};
}
function htmlSenasCobro(r){
  const c=clienteDe(cobro.clienteId); if(!c) return '';
  const L=senasDeCliente(c.id,c.nombre); if(!L.length) return '';
  return `<div class="field"><label>💵 Seña que dejó</label><div style="display:flex;flex-wrap:wrap;gap:6px">${L.map(s=>{ const on=(cobro.senasSel||[]).includes(s.id); return `<button onclick="cobroToggleSena('${s.id}')" style="${pillStyle(on,'#4A136B')}">${on?'✓ ':''}${fp(saldoSena(s))} · ${fechaCortaStr(s.fecha)}${s.profId!==profile.id?' (para '+escH(s.profNombre)+')':''}</button>`; }).join('')}</div><div style="font-size:11px;color:var(--muted);margin-top:4px">${r.senaTotal>0?'Se descuenta de lo que tiene que pagar hoy: '+fp(r.senaTotal)+'.':'Tocá la seña si querés descontarla en este turno.'}</div></div>`;
}
async function marcarSenasUsadas(r,turnoId){
  if(!r.senasUso||!r.senasUso.length) return;
  await senasSt.cambiar(l=>{ r.senasUso.forEach(u=>{ const sn=l.find(x=>x.id===u.id); if(!sn||(sn.usos||[]).some(z=>z.turnoId===turnoId)) return; sn.usos=[...(sn.usos||[]),{turnoId,monto:u.monto,fecha:hoyStr(),profId:profile.id,profNombre:profile.name}]; if(numV(sn.monto)-sn.usos.reduce((a,z)=>a+numV(z.monto),0)<=0.5) sn.estado='aplicada'; sn.upd=new Date().toISOString(); }); });
}
// ---------- devolver o quedarse con una seña (recepcion / admin) ----------
async function resolverSena(id,estado){
  const sn=senasSt.list.find(x=>x.id===id); if(!sn) return;
  const txt=estado==='devuelta'?['¿Devolver la seña?','Se le devuelve '+fp(saldoSena(sn))+' a '+sn.clienteNombre+'. Si hay una caja abierta, se anota la salida.','Devolver']:['¿Quedarse con la seña?','El salón se queda con '+fp(saldoSena(sn))+' (no vino o no reprogramó).','Quedarse con la seña'];
  if(!await uiConfirm(txt[0],txt[1],{ok:txt[2]})) return;
  const monto=saldoSena(sn);
  await senasSt.cambiar(l=>{ const x=l.find(z=>z.id===id); if(x){ x.estado=estado; x.resueltaEn=new Date().toISOString(); x.resueltaPor=profile.name; x.upd=x.resueltaEn; if(estado==='devuelta') x.devuelto=monto; } });
  if(estado==='devuelta'&&profile.role==='recepcionista'&&sesionAbierta()){
    const ab=sesionAbierta(); const ts=new Date().toISOString();
    await cambiarCaja(ab.fecha.slice(0,7),l=>{ const s=l.find(z=>z.id===ab.id); if(s){ s.movs=[...(s.movs||[]),{id:'m'+Date.now().toString(36),tipo:'salida',medio:sn.medio==='efectivo'?'efectivo':'cuenta',monto,concepto:'Devolución de seña',cat:null,gasto:false,detalle:sn.clienteNombre,ts,por:profile.name}]; s.upd=ts; } });
  }
  showToast(estado==='devuelta'?'Seña devuelta ✓':'Listo, el salón se queda con la seña'); refreshCurrentView();
}
function htmlFilaSena(s,acciones){
  const dias=diasDesdeStr(s.fecha); const suc=s.sucursal?chipSucursal(s.sucursal,true):'';
  const fTurno=senaFechaTurno(s);
  return `<div class="card" style="margin-bottom:8px;border-color:rgba(74,19,107,.4);border-left:5px solid ${(sucursalDe(s.sucursal)||{}).color||'#4A136B'}"><div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px"><div style="min-width:0"><div style="font-size:13.5px;font-weight:800">${escH(s.clienteNombre)}${verNumeroCliente()&&s.clienteNumero?' <span style="color:var(--muted2)">#'+s.clienteNumero+'</span>':''}</div><div style="font-size:11.5px;color:var(--muted2);margin-top:2px">Para su turno con <b style="color:var(--text)">${escH(s.profNombre)}</b>${fTurno?' el '+fechaCortaStr(fTurno):''} · la dejó el ${fechaCortaStr(s.fecha)} (hace ${dias} d) · ${medioTxt(s.medio)}${s.nota?' · '+escH(s.nota):''} ${suc}</div></div><div style="text-align:right;white-space:nowrap"><div style="font-size:18px;font-weight:900;color:#4A136B">${fp(saldoSena(s))}</div>${(s.usos||[]).length&&saldoSena(s)<numV(s.monto)?`<div style="font-size:10px;color:var(--muted)">de ${fp(s.monto)}</div>`:''}</div></div>${acciones?`<div style="display:flex;gap:12px;margin-top:6px">${acciones}</div>`:''}</div>`;
}
const accionesSenaRec=(s)=>`<button class="lnk" onclick="resolverSena('${s.id}','devuelta')">Devolver</button><button class="lnk" style="color:var(--muted2)" onclick="resolverSena('${s.id}','retenida')">Se queda el salón</button>`;
// ---------- recepcion ----------
// Separado en dos: las que ya llegaron a (o pasaron) el día de su turno van en "Cosas por cobrar" (accionables
// ahora); las de turnos más adelante quedan en su propia cola, aparte, para no mezclar lo urgente con lo que
// todavía falta. Pedido de Ivo (1/10/2026).
function htmlSenasFullBody(){
  const L=senasPendHoy();
  return L.length?L.map(s=>htmlFilaSena(s,accionesSenaRec(s))).join(''):'<div style="text-align:center;color:var(--muted);font-size:13px;padding:16px">No hay señas pendientes para hoy.</div>';
}
function htmlSenasFuturasBody(){
  const L=senasPendFuturas();
  if(!L.length) return '';
  return `<div class="sec-hdr" style="margin-top:16px;margin-bottom:8px"><span class="sec-title">🗓️ Señas para más adelante (${L.length})</span></div>${L.map(s=>htmlFilaSena(s,accionesSenaRec(s))).join('')}`;
}
function abrirSenasCompleto(){
  const L=senasPend();
  document.getElementById('registro-content').innerHTML=cabeceraModal('💵 Señas pendientes ('+L.length+')')+htmlSenasFullBody();
  openModal('modal-registro');
}
// ---------- profesional (Mi dinero) ----------
function htmlSenasProf(todas){
  const mias=senasSt.list.filter(s=>s.profId===profile.id);
  const pend=mias.filter(s=>saldoSena(s)>0), hist=mias.filter(s=>saldoSena(s)<=0).sort((a,b)=>String(b.ts).localeCompare(String(a.ts)));
  const total=pend.reduce((a,s)=>a+saldoSena(s),0);
  return `${todas?'':`<div class="sec-hdr" style="margin-top:20px"><span class="sec-title" style="cursor:pointer" onclick="dineroAbrir('senas')">💵 Señas — te dejaron (${pend.length}) ›</span><button class="sec-btn" onclick="abrirFormSena()" style="background:#4A136B">+ Seña</button></div>`}
    ${pend.length?`<div class="stat-card" style="margin-bottom:10px;border-color:rgba(74,19,107,.35)"><div class="sc-lbl">Señas por descontar</div><div class="sc-val" style="color:#4A136B">${fp(total)}</div><div class="sc-sub">Se descuentan solas en el próximo turno de cada cliente</div></div>`:''}
    ${!pend.length?'<div class="empty"><div class="e-icon">💵</div><p>No tenés señas pendientes.</p></div>':(todas?pend:pend.slice(0,3)).map(s=>htmlFilaSena(s,'')).join('')+(!todas&&pend.length>3?`<button onclick="dineroAbrir('senas')" style="width:100%;padding:11px;border-radius:12px;border:1.5px solid var(--border2);background:transparent;color:var(--muted2);font-family:var(--font);font-size:12px;font-weight:700;cursor:pointer;margin-bottom:4px">Ver las ${pend.length} señas ›</button>`:'')}
    ${todas&&hist.length?`<div class="sec-title" style="margin:14px 0 8px">Ya usadas o resueltas</div>${hist.slice(0,15).map(s=>`<div class="ln"><span>${escH(s.clienteNombre)} <i style="color:var(--muted)">· ${fechaCortaStr(s.fecha)} · ${s.estado==='aplicada'?'descontada en su turno':(s.estado==='devuelta'?'devuelta':'se quedó el salón')}</i></span><b>${fp(s.monto)}</b></div>`).join('')}`:''}`;
}
function htmlSenasDeudasHub(){
  if(!profile||profile.role!=='profesional') return '';
  const s=senasSt.list.filter(x=>x.profId===profile.id&&saldoSena(x)>0), d=(dineroData.deudores||[]).filter(x=>!x.saldado);
  if(!s.length&&!d.length) return '';
  const sTot=s.reduce((a,x)=>a+saldoSena(x),0), dTot=d.reduce((a,x)=>a+saldoDeuda(x),0);
  return `<div class="card" onclick="goTo('dinero')" style="cursor:pointer;margin-bottom:14px"><div style="display:flex;gap:14px">${s.length?`<div style="flex:1"><div style="font-size:11px;font-weight:800;color:#4A136B">💵 SEÑAS (${s.length})</div><div style="font-size:16px;font-weight:900">${fp(sTot)}</div><div style="font-size:11px;color:var(--muted2)">${s.slice(0,2).map(x=>escH(x.clienteNombre)).join(', ')}${s.length>2?'…':''}</div></div>`:''}${d.length?`<div style="flex:1"><div style="font-size:11px;font-weight:800;color:#f472b6">🚫 DEUDAS (${d.length})</div><div style="font-size:16px;font-weight:900">${fp(dTot)}</div><div style="font-size:11px;color:var(--muted2)">${d.slice(0,2).map(x=>escH(x.cliente)).join(', ')}${d.length>2?'…':''}</div></div>`:''}</div></div>`;
}
// ---------- admin: Clientes → Deudas y Señas ----------
function adminDeudas(c){
  const D=adminDatos(); const pend=D.deudas.slice().sort((a,b)=>new Date(a.creadoEn||a.fecha)-new Date(b.creadoEn||b.fecha));
  const total=pend.reduce((s,d)=>s+saldoDeuda(d),0), cobrado=pend.reduce((s,d)=>s+pagadoDe(d),0);
  const viejas=pend.filter(d=>diasDesdeStr(d.fecha)>=7).length;
  const porProf={}; pend.forEach(d=>{ porProf[d.prof.name]=(porProf[d.prof.name]||0)+saldoDeuda(d); });
  c.innerHTML=`<div class="sec-hdr" style="margin:6px 0 8px"><span class="sec-title">🚫 Deudas pendientes (${pend.length})</span></div>
    <div class="stat-grid" style="grid-template-columns:repeat(3,1fr)"><div class="stat-card"><div class="sc-lbl">Deben</div><div class="sc-val" style="font-size:20px;color:#f472b6">${fp(total)}</div></div><div class="stat-card"><div class="sc-lbl">Ya cobrado en parciales</div><div class="sc-val" style="font-size:20px;color:#34d399">${fp(cobrado)}</div></div><div class="stat-card"><div class="sc-lbl">Hace +7 días</div><div class="sc-val" style="font-size:20px;color:${viejas?'#fbbf24':'var(--text)'}">${viejas}</div></div></div>
    ${Object.keys(porProf).length?`<div class="card" style="margin-bottom:10px"><div style="font-size:11px;font-weight:800;color:var(--muted);text-transform:uppercase;letter-spacing:.08em;margin-bottom:4px">Por profesional (la responsabilidad es de quien atendió)</div>${Object.entries(porProf).map(([n,v])=>`<div class="ln"><span>${escH(n)}</span><b>${fp(v)}</b></div>`).join('')}</div>`:''}
    ${pend.map(d=>`<div class="card" style="margin-bottom:8px;border-left:5px solid ${(sucursalDe(d.sucursal||d.prof.sucursal)||{}).color||'#f472b6'}"><div style="display:flex;justify-content:space-between;gap:10px"><div style="min-width:0"><div style="font-size:13.5px;font-weight:800">${escH(d.cliente)}${d.clienteNumero?' <span style="color:var(--muted2)">#'+d.clienteNumero+'</span>':''}</div><div style="font-size:11.5px;color:var(--muted2)">${chipSucursal(d.sucursal||d.prof.sucursal,true)} Profesional: <b style="color:var(--text)">${escH(d.prof.name)}</b> · servicio del ${fechaCortaStr(d.fecha)} (hace ${diasDesdeStr(d.fecha)} d)${d.motivo?' · '+escH(d.motivo):''}</div></div><div style="text-align:right;white-space:nowrap"><div style="font-size:18px;font-weight:900;color:#f472b6">${fp(saldoDeuda(d))}</div>${pagadoDe(d)>0?`<div style="font-size:10px;color:var(--muted)">de ${fp(d.monto)}</div>`:''}</div></div>${htmlPagosDeuda(d)}<div style="display:flex;gap:12px;margin-top:6px"><button class="lnk" style="color:#f472b6" onclick="anularDeuda('${d.prof.id}','${d.id}')">Anular</button></div></div>`).join('')||'<div class="empty"><div class="e-icon">✅</div><p>Nadie debe nada.</p></div>'}
    <div style="font-size:10.5px;color:var(--muted);margin-top:8px;line-height:1.5">Las deudas las cobra recepción (o el propio profesional en una sucursal sin recepcionista), con pagos parciales. Lo que se paga suma a la quincena del día del pago.</div>`;
}
function adminSenas(c){
  const L=senasPend(); const total=L.reduce((s,x)=>s+saldoSena(x),0);
  const mes=hoyStr().slice(0,7); const usadas=senasSt.list.filter(s=>s.estado==='aplicada'&&(s.usos||[]).some(u=>u.fecha.slice(0,7)===mes)).length;
  const ret=senasSt.list.filter(s=>s.estado==='retenida').reduce((a,s)=>a+numV(s.monto),0), dev=senasSt.list.filter(s=>s.estado==='devuelta').reduce((a,s)=>a+numV(s.devuelto||s.monto),0);
  const porProf={}; L.forEach(s=>{ (porProf[s.profNombre]=porProf[s.profNombre]||[]).push(s); });
  c.innerHTML=`<div class="sec-hdr" style="margin:6px 0 8px"><span class="sec-title">💵 Señas (${L.length} pendientes)</span></div>
    <div class="stat-grid" style="grid-template-columns:repeat(2,1fr)"><div class="stat-card"><div class="sc-lbl">Por descontar</div><div class="sc-val" style="font-size:21px;color:#4A136B">${fp(total)}</div></div><div class="stat-card"><div class="sc-lbl">Descontadas este mes</div><div class="sc-val" style="font-size:21px">${usadas}</div></div><div class="stat-card"><div class="sc-lbl">Devueltas</div><div class="sc-val" style="font-size:20px">${fp(dev)}</div></div><div class="stat-card"><div class="sc-lbl">Se quedó el salón</div><div class="sc-val" style="font-size:20px">${fp(ret)}</div></div></div>
    ${Object.entries(porProf).map(([n,l])=>`<div style="font-size:11px;font-weight:800;color:var(--muted);text-transform:uppercase;letter-spacing:.08em;margin:12px 0 6px">✂️ ${escH(n)} · ${fp(l.reduce((a,s)=>a+saldoSena(s),0))}</div>${l.map(s=>htmlFilaSena(s,accionesSenaRec(s))).join('')}`).join('')||'<div class="empty"><div class="e-icon">💵</div><p>No hay señas pendientes.</p></div>'}
    <button class="btn btn-ghost" onclick="abrirFormSena()" style="margin-top:10px">+ Registrar una seña</button>`;
}

function htmlSenaCliente(c){
  const L=senasDeCliente(c.id,c.nombre); if(!L.length) return '';
  return `<div class="card" style="margin-bottom:10px;border-color:rgba(74,19,107,.5);background:rgba(74,19,107,.06)"><div style="font-size:12.5px;font-weight:800;color:#4A136B">💵 Dejó seña: ${fp(L.reduce((a,s)=>a+saldoSena(s),0))}</div>${L.map(s=>`<div style="font-size:12px;margin-top:4px">${fp(saldoSena(s))} · el ${fechaCortaStr(s.fecha)} · para su turno con <b>${escH(s.profNombre)}</b> (se descuenta sola)</div>`).join('')}</div>`;
}
// ============ INIT ============
// Pantallas publicas por hash (#reserva, #cuenta): un cambio de hash SIN recarga real de documento (click en
// un link con # de la misma pagina, "atras/adelante" del navegador, o un navegador in-app tipo Instagram/
// WhatsApp que reusa la misma pestaña y la restaura desde el bfcache) NUNCA vuelve a ejecutar init() -- eso
// haria que se siga viendo la pantalla vieja (el login de staff) con el hash correcto en la barra pero la
// pantalla equivocada en patalla. Bug real encontrado por Central el 27/09/2026, antes de la campaña de Meta
// Ads. Por eso esta logica vive aparte, en una funcion que se puede volver a llamar sola con 'hashchange' y
// con 'pageshow' (bfcache), no solo una vez al cargar.
async function enrutarHashPublico(){
  // Consolidacion del 27/09/2026 (ver comentario junto a mostrarReservaPublica, en 17-menu-cierre.js): /#reserva
  // ya NO es una pantalla con wizard propio, es la puerta publica de "Armar Paquete". Reintentado el 28/09/2026
  // (pedido explicito de Ivo, coordinado con Web): #reserva puede volver a venir con el paquete armado en la
  // calculadora de sitio-web -- #reserva?sucursal=Nombre&rubros=Rubro1,Rubro2&servicios=Nombre1,Nombre2, todo por
  // NOMBRE (el catalogo de la calculadora es una copia manual, sus ids no coinciden con los reales). Se habia
  // sacado por un bug de combos que no matcheaban; Web saco los combos prearmados de la calculadora asi que se
  // reintenta. vpAplicarParametrosURL (17-menu-cierre.js) hace el match por nombre, best-effort.
  if(location.hash==='#reserva'||location.hash.indexOf('#reserva?')===0){ await mostrarReservaPublica(location.hash.slice('#reserva'.length)); return true; }
  // La vuelta del login con Google puede llegar de varias formas segun el navegador: Supabase reemplaza
  // el hash #cuenta por el token de sesion (#access_token=... o #code=...), y en algunos casos (Safari/iOS,
  // por las protecciones de storage entre sitios en redirects de varios saltos: nuestro sitio -> Google ->
  // Supabase -> nuestro sitio) el sessionStorage que dejamos antes de salir no sobrevive el viaje. Por eso
  // se chequean 3 señales, la mas confiable primero: un parametro en la URL (?cuenta=1, que no depende de
  // storage y sobrevive el redirect siempre porque va en la propia URL), despues el hash directo, y por
  // ultimo el sessionStorage como respaldo para navegadores donde si sobrevive.
  if(location.hash==='#cuenta'||location.search.includes('cuenta=1')||sessionStorage.getItem('inda_cuenta_flow')==='1'){ await mostrarCuenta(); return true; }
  return false;
}
window.addEventListener('hashchange',()=>{ enrutarHashPublico(); });
window.addEventListener('pageshow',(e)=>{ if(e.persisted) enrutarHashPublico(); });
async function init(){
  try { reels=JSON.parse(localStorage.getItem('luffy_reels')||'[]'); } catch(e){}
  try { reelsBorrados=JSON.parse(localStorage.getItem('luffy_reels_del')||'[]'); } catch(e){}
  snapReels();
  try {
    if(typeof claude!=='undefined'){ DB=await claude.use('db'); }
    else if(supaClient){ DB=makeSupabaseDB(supaClient); }
  } catch(e){}
  if(await enrutarHashPublico()) return;
  // Sin sesion la base no deja leer: no se carga nada de la nube hasta que la persona inicie sesion.
  const rolInicio=await cargarMiRol();
  // Keep the session across reloads/app switches — without this, iOS
  // backgrounding the tab (or any reload) forces a fresh login every time.
  if(rolInicio){ await loginAs(rolInicio.app_id); } else { showLogin(false); }
  setInterval(chequearEpocaViva,120000);
}

// ============ HUB ============
function showHub(){
  show('hub');
  document.getElementById('nav').style.display='flex';
  setNav('n-hub');
  renderHub();
  setTimeout(prewarm, 1500);
}

function renderHub(){
  const h = new Date().getHours();
  const gr = h<12?'Buenos días,':h<20?'Buenas tardes,':'Buenas noches,';
  document.getElementById('hub-greeting').textContent = gr;
  document.getElementById('hub-name').textContent = profile.name + ' ' + profile.emoji;
  { const b=document.getElementById('hub-modo'); if(b) b.style.display=profile.adminReal?'flex':'none'; }

  // Avatar
  const av = document.getElementById('hub-av');
  if(av){
    av.textContent = profile.emoji;
    av.style.background = profile.color+'33';
    av.style.borderColor = profile.color;
    av.style.border = '2px solid '+profile.color;
  }

  // Gen button color
  const qaGen = document.getElementById('qa-gen');
  if(qaGen){
    qaGen.style.background = 'var(--s1)';
    qaGen.style.borderColor = profile.color+'33';
  }

  // Tramo banner
  renderTramoBanner();
  renderCierresPendientesProf();
  { const el=document.getElementById('hub-suc-wrap'); if(el) el.innerHTML=htmlSucursalHub(); }
  { const hab=paquetesEnCobroHabilitados()?'':'none';
    ['hub-armar-paquete','hub-paq-proxima'].forEach(id=>{ const b=document.getElementById(id); if(b) b.style.display=hab; }); }
  { const card=document.getElementById('hub-agenda-card');
    if(card&&profile.role==='profesional'){
      const n=agendaSt.list.filter(a=>a.profId===profile.id&&a.fecha===ymdLocal(new Date())&&agEsActivo(a)).length;
      card.style.display='flex';
      const txt=document.getElementById('hub-agenda-txt'); if(txt) txt.textContent='Hoy: '+n+' '+(n===1?'turno reservado':'turnos reservados');
    } else if(card) card.style.display='none';
  }
  { const el=document.getElementById('hub-tareasencargado'); if(el) el.innerHTML=htmlTareasEncargado(); }
  { const el=document.getElementById('hub-tareasequipo'); if(el) el.innerHTML=htmlTareasEquipoWidget(); }

  // Stories dots
  loadStoriesData();
  const hoy = ymdLocal(new Date());
  const storiesDone = STORY_TIPOS.filter(t=>(storiesData?.[hoy]?.[profile.id]?.[t.id]?.done)).length;
  const proximaStory = STORY_TIPOS.find(t=>!(storiesData?.[hoy]?.[profile.id]?.[t.id]?.done));
  const subStories = document.getElementById('qa-stories-sub');
  if(subStories){
    subStories.textContent = !proximaStory
      ? storiesDone+'/'+STORY_TIPOS.length+' — ¡Completo hoy! 🎉'
      : storiesDone+'/'+STORY_TIPOS.length+' · Próxima: '+proximaStory.label+(storyHorarios[proximaStory.id]?' ('+storyHorarios[proximaStory.id]+'hs)':'');
  }
  const dots = document.getElementById('hub-stories-dots');
  if(dots) dots.innerHTML = STORY_TIPOS.map((_,i)=>`<div style="width:8px;height:8px;border-radius:50%;background:${i<storiesDone?'#34d399':'rgba(255,255,255,.15)'}"></div>`).join('');

  // Turnos de hoy (cortes) y ventas de productos — aparte, no se suman
  try {
    const turnosHoy=(dineroData.turnos||[]).filter(t=>t.fecha===hoy);
    const factHoy=turnosHoy.reduce((s,t)=>s+(parseFloat(t.monto)||0),0);
    const subTurnos=document.getElementById('hub-turnos-sub');
    if(subTurnos) subTurnos.textContent = fp(factHoy)+' · '+turnosHoy.length+(turnosHoy.length===1?' turno':' turnos');
    const ventasHoy=(dineroData.ventas||[]).filter(v=>v.fecha===hoy);
    const subVentas=document.getElementById('hub-ventas-sub');
    if(subVentas) subVentas.textContent = ventasHoy.length? '📦 '+fp(ventasHoy.reduce((s,v)=>s+(v.total||0),0))+' en productos' : '';
  } catch(e){}

  // Puntos: franja chica motivacional
  try {
    loadPuntosData();
    const misPuntos=getPuntos(profile.id);
    const ganadosHoy=(misPuntos.movimientos||[]).filter(m=>m.fecha===hoy&&m.pts>0).reduce((s,m)=>s+m.pts,0);
    const proxCanje=canjesData.filter(c=>(misPuntos.total||0)<c.pts).sort((a,b)=>a.pts-b.pts)[0];
    const puntosTxt=document.getElementById('hub-puntos-txt');
    if(puntosTxt){
      puntosTxt.textContent = (ganadosHoy>0?'+'+ganadosHoy+' hoy · ':'')+(misPuntos.total||0)+' puntos'+(proxCanje?' · faltan '+(proxCanje.pts-(misPuntos.total||0))+' para '+proxCanje.label:'');
    }
  } catch(e){}


  // Tramo sub in dinero card
  try {
    const now=new Date(), q=now.getDate()<=15?1:2;
    const turnos=(dineroData.turnos||[]).filter(t=>{if(!t.fecha)return false;const d=new Date(t.fecha+'T00:00:00');return d.getMonth()===now.getMonth()&&d.getFullYear()===now.getFullYear()&&(q===1?d.getDate()<=15:d.getDate()>15);});
    const fact=turnos.reduce((s,t)=>s+(parseFloat(t.monto)||0),0);
    const sub=document.getElementById('hub-tramo-sub');
    if(sub&&fact>0) sub.textContent=fp(fact)+' esta quincena';
  } catch(e){}

  // Banco de reels disponibles (los carga el admin): se ve todo el detalle antes de tomarlos
  revisarVencimientos();
  const banco = reels.filter(r=>!r.asignado);
  const bancoWrap = document.getElementById('hub-banco-wrap');
  const bancoUl = document.getElementById('hub-banco');
  if(banco.length){
    bancoWrap.style.display='block';
    bancoUl.innerHTML = banco.slice(0,3).map(r=>`
      <div class="reel-item" onclick="abrirDetalleReel('${r.id}')" style="margin-bottom:8px;cursor:pointer">
        <div class="ri-info" style="flex:1;min-width:0">
          <strong style="font-size:13px;font-weight:700;display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${r.emoji||'🎬'} ${escH(r.titulo)}</strong>
          <span style="font-size:11px;color:var(--muted2)">${escH(r.estructura||'')}${safeUrl(r.url)?' · '+plataformaUrl(safeUrl(r.url)).e+' inspiración':''}</span>
        </div>
        <span style="font-size:11px;font-weight:700;color:${profile.color};flex-shrink:0">Ver ›</span>
      </div>`).join('') + `<button onclick="goTo('banco')" style="width:100%;padding:11px;border-radius:12px;border:1.5px solid var(--border2);background:transparent;color:var(--muted2);font-family:var(--font);font-size:12px;font-weight:700;cursor:pointer">Ver todo el banco (${banco.length}) ›</button>`;
  } else {
    bancoWrap.style.display='none';
    bancoUl.innerHTML='';
  }

  // Reels propios en progreso
  const mis = reels.filter(r=>esMio(r)&&r.stage!=='publicado');
  const ul = document.getElementById('hub-reels');
  const prendaBanner = reels.filter(r=>esMio(r)&&r.prenda&&!r.prenda.cumplida).map(r=>`<div style="background:rgba(244,114,182,.1);border:1px solid rgba(244,114,182,.35);border-radius:14px;padding:12px 14px;margin-bottom:10px;font-size:12px;line-height:1.5"><b style="color:#f472b6">🎽 Tenés una prenda pendiente</b><br>${escH(r.prenda.texto)}<br><span style="color:var(--muted2)">Por no entregar "${escH(r.titulo)}" a tiempo. El admin la marca como cumplida.</span></div>`).join('');
  if(!mis.length){
    ul.innerHTML=prendaBanner+`<div style="text-align:center;padding:28px 16px;background:var(--s1);border:1px solid var(--border);border-radius:16px">
      <div style="font-size:32px;margin-bottom:10px">🎬</div>
      <div style="font-size:14px;font-weight:700;margin-bottom:6px">Sin reels en progreso</div>
      <div style="font-size:12px;color:var(--muted2);margin-bottom:16px">Generá una idea y empezá a crear contenido</div>
      <button onclick="goTo('generador')" style="padding:10px 20px;border-radius:12px;border:none;background:${profile.color};color:#fff;font-family:var(--font);font-size:13px;font-weight:700;cursor:pointer">Generar idea →</button>
    </div>`;
    return;
  }
  ul.innerHTML = prendaBanner + mis.slice(0,5).map(r=>{
    const st=STAGES[r.stage]||STAGES.idea;
    const d=r.fecha?new Date(r.fecha+'T00:00:00').toLocaleDateString('es-AR',{day:'numeric',month:'short'}):'';
    return `<div class="reel-item" onclick="abrirEditor('${r.id}')" style="margin-bottom:8px">
      <div class="ri-dot" style="background:${st.c};width:10px;height:10px;border-radius:50%;flex-shrink:0"></div>
      <div class="ri-info" style="flex:1;min-width:0">
        <strong style="font-size:13px;font-weight:700;display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${r.emoji||''} ${r.titulo}</strong>
        <span style="font-size:11px;color:var(--muted2)">${r.estructura||''}${d?' · '+d:''}</span>
      </div>
      <div style="display:flex;flex-direction:column;gap:4px;align-items:flex-end;flex-shrink:0"><div class="ri-badge" style="background:${st.c}22;color:${st.c};font-size:10px;font-weight:700;padding:3px 8px;border-radius:10px">${st.l}</div>${chipPlazo(r)}</div>
    </div>`;
  }).join('');
}

function renderTramoBanner(){
  const banner = document.getElementById('tramo-banner');
  try {
    const now=new Date(), q=now.getDate()<=15?1:2;
    const turnos=(dineroData.turnos||[]).filter(t=>{
      if(!t.fecha) return false;
      const d=new Date(t.fecha+'T00:00:00');
      return d.getMonth()===now.getMonth()&&d.getFullYear()===now.getFullYear()&&(q===1?d.getDate()<=15:d.getDate()>15);
    });
    const fact=turnos.reduce((s,t)=>s+(parseFloat(t.monto)||0),0);
    const reelsQ=reels.filter(r=>r.stage==='publicado'&&r.asignado===profile.name&&r.fecha&&(()=>{const d=new Date(r.fecha+'T00:00:00');const now2=new Date();return d.getMonth()===now2.getMonth()&&d.getFullYear()===now2.getFullYear()&&(q===1?d.getDate()<=15:d.getDate()>15);})()).length;
    const {pct,esOro,tramo,fija,nuevo}=calcComision(fact,reelsQ,profile);
    const tr=esOro?tramoOro():tramo;
    banner.style.display='flex';
    banner.style.background=`${tr.color}15`;
    banner.style.border=`1px solid ${tr.color}30`;
    banner.innerHTML=`<div class="tb-emoji">${tr.emoji}</div><div class="tb-info"><strong style="color:${tr.color}">${tr.pct}% — ${fija?'Comisión fija':(nuevo?'Barbero nuevo':'Tramo '+tr.label)}</strong><span>${fp(fact)} esta quincena</span></div><div class="tb-pct" style="color:${tr.color}">›</div>`;
  } catch(e){ banner.style.display='none'; }
}

// ============ DIALOGOS PROPIOS (reemplazan prompt/confirm del navegador) ============
let uiDlgFinish=null;
function uiDialog(o){
  return new Promise(resolve=>{
    if(uiDlgFinish) uiDlgFinish(null);
    const el=document.getElementById('ui-dlg');
    const fields=o.fields||[];
    document.getElementById('ui-dlg-title').textContent=o.title||'';
    document.getElementById('ui-dlg-msg').textContent=o.msg||'';
    const fw=document.getElementById('ui-dlg-fields');
    fw.innerHTML='';
    fields.forEach((f,i)=>{
      const d=document.createElement('div'); d.className='field';
      if(f.label){ const l=document.createElement('label'); l.textContent=f.label; d.appendChild(l); }
      const inp=document.createElement(f.type==='textarea'?'textarea':'input');
      inp.id='ui-f-'+i;
      if(f.type&&f.type!=='textarea'){ inp.type=f.type; if(f.type==='number') inp.inputMode='decimal'; }
      if(f.placeholder) inp.placeholder=f.placeholder;
      inp.value=f.value==null?'':f.value;
      d.appendChild(inp); fw.appendChild(d);
    });
    const ok=document.getElementById('ui-dlg-ok'), cancel=document.getElementById('ui-dlg-cancel');
    ok.textContent=o.ok||'Aceptar'; ok.className='ui-b'+(o.danger?' danger':'');
    cancel.textContent=o.cancel||'Cancelar'; cancel.style.display=o.soloOk?'none':'';
    const finish=(val)=>{
      el.classList.remove('open'); el.removeEventListener('keydown',onKey); el.removeEventListener('click',onBackdrop);
      ok.onclick=null; cancel.onclick=null; uiDlgFinish=null; resolve(val);
    };
    const confirmar=()=>finish(fields.length?fields.map((_,i)=>document.getElementById('ui-f-'+i).value):[]);
    const onKey=(e)=>{ if(e.key==='Escape'){ e.preventDefault(); finish(null); } else if(e.key==='Enter'&&e.target.tagName!=='TEXTAREA'){ e.preventDefault(); confirmar(); } };
    const onBackdrop=(e)=>{ if(e.target===el) finish(null); };
    uiDlgFinish=finish;
    ok.onclick=confirmar; cancel.onclick=()=>finish(null);
    el.addEventListener('keydown',onKey); el.addEventListener('click',onBackdrop);
    el.classList.add('open');
    setTimeout(()=>{ const f=document.getElementById('ui-f-0')||ok; f.focus(); if(f.select&&f.type!=='number') f.select(); },60);
  });
}
// Devuelve el texto escrito, o null si cancelo
function uiPrompt(title,o={}){
  return uiDialog({title,msg:o.msg,fields:[{label:o.label,type:o.type,value:o.value,placeholder:o.placeholder}],ok:o.ok}).then(v=>v===null?null:v[0]);
}
// Devuelve true / false
function uiConfirm(title,msg,o={}){
  return uiDialog({title,msg,ok:o.ok||'Sí, borrar',cancel:o.cancel||'Cancelar',danger:o.danger!==false}).then(v=>v!==null);
}

// ============ UTILS ============
function show(id){
  currentScreenId = id;
  document.body.classList.toggle('adm-wide', id==='admin'||id==='agenda'||id==='crmboard'||id==='cobranzas'||id==='caja');
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}
function goTo(id){
  show(id);
  document.getElementById('nav').style.display=['hub','generador','editor','kanban','dinero','perfil','stories','puntos','banco','clientes'].includes(id)?'flex':'none';
  const navMap2={hub:'n-hub',generador:'n-hub',kanban:'n-kanban',dinero:'n-dinero',stories:'n-hub',puntos:'n-puntos',editor:'n-hub',perfil:'n-hub',banco:'n-hub',clientes:'n-hub'};
  if(navMap2[id]) setNav(navMap2[id]);
  if(id==='hub'){ renderHub(); refrescarReels(); }
  if(id==='generador') buildGenHome();
  if(id==='dinero'){ dineroVista=null; dineroExpand=null; renderDinero(); }
  if(id==='kanban'){ renderKanban(); refrescarReels(); }
  if(id==='banco'){ renderBancoProf(); refrescarReels(); }
  if(id==='clientes'){ clientesQ=''; loadClientes(); renderClientes(); }
  if(id==='perfil') renderPerfil();
  if(id==='stories'){loadStoriesData();renderStories();}
  if(id==='puntos'){loadPuntosData();renderPuntos();}
  if(id==='agenda') renderAgenda();
  if(id==='crmboard'){ crmTarget='crmboard-body'; loadClientes(); renderCRM(); }
  if(id==='cobranzas') renderCobranzas();
  if(id==='caja') renderCajaScreen();
}
function setNav(id){
  ['n-hub','n-kanban','n-dinero','n-puntos'].forEach(n=>{const el=document.getElementById(n);if(el)el.classList.toggle('active',el.id===id);});
}
function showToast(msg){
  const t=document.getElementById('toast');
  t.textContent=msg; t.classList.add('show');
  setTimeout(()=>t.classList.remove('show'),2200);
}
function fp(n){ n=Math.round(n); return (n<0?'-':'')+'$'+Math.abs(n).toLocaleString('es-AR'); }
// Fecha (AAAA-MM-DD) segun la hora local del dispositivo. Nunca usar toISOString() para esto: es UTC.
function ymdLocal(d){ return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }
// Corrige registros viejos que quedaron con la fecha en UTC (cobros hechos despues de las 21 hs figuraban al dia siguiente)
function normalizarFechas(dd){
  if(!dd) return false;
  let cambio=false;
  const fix=(x,campo,iso)=>{
    const f=x&&x[campo], t=x&&x[iso]; if(!f||!t) return;
    const d=new Date(t); if(isNaN(d)) return;
    const local=ymdLocal(d), utc=d.toISOString().split('T')[0];
    if(f!==local&&f===utc){ x[campo]=local; cambio=true; }
  };
  (dd.turnos||[]).forEach(x=>fix(x,'fecha','creadoEn'));
  (dd.ventas||[]).forEach(x=>fix(x,'fecha','creadoEn'));
  (dd.deudores||[]).forEach(x=>{ fix(x,'fecha','creadoEn'); fix(x,'fechaPago','cobradoEn'); });
  return cambio;
}
