// ============ ADMIN: Clientes (directorio, membresias, paquetes, tarjetas, descuentos) ============
function adminDatosDescuentos(desde,hasta,profF){
  const filas=[];
  allUsers.filter(u=>(esProf(u))&&coincideProf(u,profF||'todos')).forEach(u=>{
    let dd={}; try{ dd=JSON.parse(localStorage.getItem('luffy_dinero_'+u.id)||'{}'); }catch(e){}
    const add=(t,pend)=>{ if(!(t.fecha>=desde&&t.fecha<=hasta)||numV(t.descuento)<=0) return; filas.push({...t,prof:u,pend}); };
    (dd.turnos||[]).filter(t=>!t.deudaId).forEach(t=>add(t,false));
    (dd.turnos||[]).filter(t=>t.deudaId).forEach(t=>add(t,false));
  });
  return filas;
}
function htmlPerdidaDescuentos(desde,hasta,profF){
  const F=adminDatosDescuentos(desde,hasta,profF);
  const porCli={}, porTipo={};
  F.forEach(t=>{
    const k=t.clienteId||('n:'+(t.cliente||'Cliente'));
    const x=porCli[k]||(porCli[k]={nombre:t.cliente||'Cliente',n:0,monto:0,tipos:new Set(),cid:t.clienteId||null}); x.n++; x.monto+=numV(t.descuento);
    (t.descDetalle&&t.descDetalle.length?t.descDetalle:[{tipo:t.descuentoTipo||'otro',label:t.descuentoTipo==='oferta'?'Oferta':'Efectivo',monto:t.descuento}]).forEach(d=>{ x.tipos.add(d.label); const y=porTipo[d.label]||(porTipo[d.label]={n:0,m:0}); y.n++; y.m+=numV(d.monto); });
  });
  const total=F.reduce((s,t)=>s+numV(t.descuento),0);
  const lista=Object.values(porCli).sort((a,b)=>b.monto-a.monto).slice(0,12);
  const altos=F.filter(t=>t.comFija!=null).length;
  return {total,n:F.length,altos,
    html:`<div style="font-size:22px;font-weight:900;color:#f472b6;margin-bottom:6px">${fp(total)}</div>
    <div style="font-size:11px;color:var(--muted2);margin-bottom:8px">${F.length} turnos con descuento${altos?` · ${altos} con comisión fija por descuento alto`:''}</div>
    ${Object.entries(porTipo).sort((a,b)=>b[1].m-a[1].m).map(([l,y])=>`<div class="ln"><span>${escH(l)} <i style="color:var(--muted)">· ${y.n}</i></span><b>${fp(y.m)}</b></div>`).join('')}
    <div style="font-size:10.5px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);margin:10px 0 4px">Por cliente</div>
    <div style="max-height:230px;overflow-y:auto">${lista.map(x=>`<div class="ln"><span>${escH(x.nombre)}${x.cid?` <i style="color:var(--muted)">#${(clienteDe(x.cid)||{}).numero||''}</i>`:''} <i style="color:var(--muted)">· ${x.n}×</i></span><b>${fp(x.monto)}</b></div>`).join('')||'<div style="font-size:12px;color:var(--muted)">Sin descuentos en el período</div>'}</div>`};
}

let adminCliQ='';
function renderAdminClientes(c,sub){
  ({directorio:adminDirectorio,crm:adminCRM,membresias:adminMembresias,paquetes:adminPaquetes,tarjetas:adminTarjetas,deudas:adminDeudas,senas:adminSenas}[sub]||adminDirectorio)(c);
}
function adminDirectorio(c){
  const q=nkey(adminCliQ);
  const lista=clientesDir.filter(x=>!q||buscarClientes(adminCliQ,[x]).length).sort((a,b)=>b.numero-a.numero);
  c.innerHTML=`<div class="sec-hdr" style="margin:6px 0 8px"><span class="sec-title">👥 Clientes del salón (${clientesDir.length})</span>${profile.role==='admin'?`<button class="lnk" onclick="abrirImportClientes()">📂 Importar</button>`:''}</div>
    <input type="search" placeholder="Buscar por nombre, #, profesión o teléfono…" value="${escH(adminCliQ)}" oninput="adminCliQ=this.value;renderAdmin();var e=document.querySelector('#adm-content input[type=search]');e.focus();e.setSelectionRange(e.value.length,e.value.length);" style="width:100%;background:var(--s1);border:1.5px solid var(--border2);border-radius:12px;padding:11px 14px;color:var(--text);font-family:var(--font);font-size:14px;margin-bottom:10px"/>
    ${lista.slice(0,60).map(x=>{ const s=statsCliente(x); const m=membresiaActivaDe(x.id); return `<div class="card" onclick="abrirClienteDetalle('${x.id}')" style="cursor:pointer;margin-bottom:6px"><div style="display:flex;gap:10px;align-items:center"><div style="flex:1;min-width:0"><div style="font-size:13.5px;font-weight:800">${escH(x.nombre)} <span style="color:var(--muted2)">#${x.numero}</span>${(x.tarjetas&&x.tarjetas.length)?' 💳':''}${m?' 🎫':''}</div><div style="font-size:11px;color:var(--muted2)">${escH(idCorto(x))}${s.barberos.length?' · ✂️ '+escH(s.barberos.join(', ')):''}</div></div><div style="text-align:right;font-size:11.5px;color:var(--muted2)">${s.visitas} visitas<br><b style="color:var(--text)">${fp(s.gastado)}</b></div></div></div>`; }).join('')||'<div class="empty"><div class="e-icon">👥</div><p>No hay clientes.</p></div>'}
    ${lista.length>60?`<div style="text-align:center;font-size:11px;color:var(--muted)">Mostrando 60 de ${lista.length}. Usá el buscador.</div>`:''}`;
}
function adminMembresias(c){
  const L=membresiasSt.list.slice().sort((a,b)=>String(b.creadoEn).localeCompare(String(a.creadoEn)));
  const cobrado=L.reduce((s,m)=>s+numV(m.precio),0);
  const pagadoProf=L.reduce((s,m)=>s+m.usos.reduce((x,u)=>x+numV(u.credito),0),0);
  const pendiente=L.reduce((s,m)=>s+(m.creditos-m.usos.length)*numV(m.valorCredito),0);
  const porCli={}; L.forEach(m=>{ porCli[m.clienteId]=(porCli[m.clienteId]||0)+1; });
  c.innerHTML=`<div class="sec-hdr" style="margin:6px 0 8px"><span class="sec-title">💳 Membresías (${L.length})</span></div>
    <div class="stat-grid" style="grid-template-columns:repeat(3,1fr)">
      <div class="stat-card"><div class="sc-lbl">Cobrado</div><div class="sc-val" style="font-size:20px">${fp(cobrado)}</div></div>
      <div class="stat-card"><div class="sc-lbl">Sumado a los chicos</div><div class="sc-val" style="font-size:20px">${fp(pagadoProf)}</div></div>
      <div class="stat-card"><div class="sc-lbl">Cortes por usar</div><div class="sc-val" style="font-size:20px">${fp(pendiente)}</div></div>
    </div>
    ${L.map(m=>{ const usados=m.usos.length, agotada=usados>=m.creditos, vencida=m.vence&&m.vence<hoyStr(), deb=agotada||vencida; return `<div class="card" style="margin-bottom:8px;border-left:4px solid ${deb?'#f472b6':'#34d399'}">
      <div style="display:flex;justify-content:space-between;gap:8px;align-items:baseline"><div style="font-size:13.5px;font-weight:800">${escH(m.clienteNombre)} <span style="color:var(--muted2)">#${m.clienteNumero}</span>${m.planNombre?' · '+escH(m.planNombre):''}</div><b>${fp(m.precio)}</b></div>
      <div style="display:flex;gap:4px;margin:6px 0">${Array.from({length:m.creditos},(_,i)=>`<div style="flex:1;height:8px;border-radius:4px;background:${i<usados?'#4A136B':'var(--border2)'}"></div>`).join('')}</div>
      <div style="font-size:11.5px;color:var(--muted2);line-height:1.6">Pagó el ${fechaCortaStr(m.fecha)} (${({efectivo:'efectivo',mp:'Mercado Pago',tarjeta:'tarjeta'}[m.medio]||m.medio)}) · vendió ${escH(m.vendedorNombre||'')} · ${usados}/${m.creditos} usados${m.vence?' · vence '+fechaCortaStr(m.vence):''} · membresías pagadas por este cliente: <b style="color:var(--text)">${porCli[m.clienteId]}</b><br>
      ${vencida?'<b style="color:#f472b6">Vencida</b>'+(usados<m.creditos?' — se perdieron '+(m.creditos-usados)+' sin usar':''):agotada?'<b style="color:#f472b6">Tiene que renovar</b> (usó todos)':'<b style="color:#34d399">Al día</b> · le quedan '+(m.creditos-usados)}${m.usos.length?'<br>Usos: '+m.usos.map(u=>fechaCortaStr(u.fecha)+' con '+escH(u.profNombre)).join(' · '):''}</div></div>`; }).join('')||'<div class="empty"><div class="e-icon">💳</div><p>Todavía no se vendió ninguna membresía.<br>Se venden desde la ficha del cliente.</p></div>'}`;
}
function adminPaquetes(c){
  const L=paquetesSt.list.slice().sort((a,b)=>String(b.creadoEn).localeCompare(String(a.creadoEn)));
  const total=L.reduce((s,p)=>s+numV(p.total),0), desc=L.reduce((s,p)=>s+numV(p.totalLista)-numV(p.total),0);
  const gan=L.reduce((s,p)=>s+gananciaPaquete(p),0), com=L.reduce((s,p)=>s+comRecPaquete(p),0);
  const porVend={}; L.forEach(p=>{ const x=porVend[p.vendedorNombre]||(porVend[p.vendedorNombre]={n:0,m:0,com:0,rol:p.vendedorRol,id:p.vendedorId}); x.n++; x.m+=numV(p.total); x.com+=comRecPaquete(p); });
  const tramosTxt=tramosPaquete().map(t=>fp(t.min)+'+ → '+t.pct+'%').join(' · ');
  c.innerHTML=`<div class="sec-hdr" style="margin:6px 0 8px"><span class="sec-title">🎁 Paquetes (${L.length})</span><button class="lnk" onclick="editarComisionRubro()">Comisión por rubro</button></div>
    <div class="card" style="margin-bottom:10px;font-size:12px;color:var(--muted2);line-height:1.5">Ganancia del salón = lo cobrado − lo que se le paga al profesional por cada servicio, según <b style="color:var(--text)">la comisión real de su rubro</b> (ej: 45% barbería, 70% estética). Quien vende el paquete desde recepción cobra, de esa ganancia, según lo facturado en paquetes en la quincena: <b style="color:var(--text)">${tramosTxt}</b> (<button class="lnk" onclick="editarRecPaqTramos()">cambiar tramos</button>). No se le muestra la comisión mientras arma el paquete, para no anclarse a un número mientras se calibra.</div>
    <div class="stat-grid" style="grid-template-columns:repeat(2,1fr)"><div class="stat-card"><div class="sc-lbl">Vendido</div><div class="sc-val" style="font-size:21px">${fp(total)}</div><div class="sc-sub">descuento dado ${fp(desc)}</div></div><div class="stat-card"><div class="sc-lbl">Ganancia del salón</div><div class="sc-val" style="font-size:21px;color:#34d399">${fp(gan-com)}</div><div class="sc-sub">${fp(gan)} − ${fp(com)} de comisión de recepción</div></div></div>
    ${Object.keys(porVend).length?`<div class="card" style="margin-bottom:10px"><div style="font-size:11px;font-weight:800;color:var(--muted);text-transform:uppercase;letter-spacing:.08em;margin-bottom:4px">Por vendedor</div>${Object.entries(porVend).map(([n,x])=>`<div class="ln"><span>${escH(n)} <i style="color:var(--muted)">· ${x.n} vendidos · ${fp(x.m)}</i></span><b>${x.rol==='recepcionista'?'comisión '+fp(x.com)+' · tramo actual '+pctPaqueteDe(x.id).pct+'%':'sin comisión'}</b></div>`).join('')}</div>`:''}
    ${L.map(p=>{ const pd=pctPaqueteDe(p.vendedorId,quincenaKey(p.fecha)); return `<div class="card" style="margin-bottom:8px"><div style="display:flex;justify-content:space-between;align-items:baseline"><div style="font-size:13.5px;font-weight:800">${escH(p.clienteNombre)} <span style="color:var(--muted2)">#${p.clienteNumero}</span></div><b>${fp(p.total)}</b></div>
      <div style="font-size:11.5px;color:var(--muted2);margin:3px 0">${p.pct}% off del paquete · ${fechaCortaStr(p.fecha)} · vendió ${escH(p.vendedorNombre||'')}</div>
      ${p.items.map(i=>`<div style="display:flex;justify-content:space-between;font-size:12px;padding:1px 0;${i.usado?'color:var(--muted2)':''}"><span>${i.usado?'✓':'○'} ${escH(i.nombre)}${i.descPct>0?' · '+i.descPct+'% off':''}${i.usado?' <i>(con '+escH(i.usado.profNombre)+')</i>':''}</span><span>${fp(i.final)}</span></div>`).join('')}
      <div style="font-size:11.5px;margin-top:6px;padding-top:6px;border-top:1px solid var(--border);color:var(--muted2)">Ganancia del salón ≈ <b style="color:var(--text)">${fp(gananciaPaquete(p)-comRecPaquete(p))}</b>${p.vendedorRol==='recepcionista'?` · comisión de ${escH(p.vendedorNombre)}: <b style="color:#4A136B">${fp(comRecPaquete(p))}</b> (${pd.pct}% de ${fp(gananciaPaquete(p))} · tramo de esa quincena)`:' · vendido por un profesional (sin comisión de recepción)'}</div></div>`; }).join('')||'<div class="empty"><div class="e-icon">🎁</div><p>Todavía no se vendió ningún paquete.</p></div>'}`;
}
function adminTarjetas(c){
  const cards=promos.tarjetas||[];
  c.innerHTML=`<div class="sec-hdr" style="margin:6px 0 8px"><span class="sec-title">⭐ Tarjetas de fidelidad</span><button class="lnk" onclick="editarTarjetaCfg('')">+ Nueva tarjeta</button></div>
    <div class="card" style="margin-bottom:10px;font-size:12px;color:var(--muted2);line-height:1.5">Cada cliente conserva las reglas con las que empezó su tarjeta: <b style="color:var(--text)">los profesionales no pueden cambiarlas</b>. Si modificás una tarjeta acá, vale para los clientes nuevos; para los que ya están en curso tenés que aprobarlo con "Aplicar a tarjetas en curso". Un cliente puede tener más de una tarjeta activa a la vez (por ejemplo, la general de barbería y la de un profesional puntual).</div>
    ${cards.map(t=>{ const n=clientesDir.filter(x=>(x.tarjetas||[]).some(y=>y.cardId===t.id)).length; return `<div class="prof-card" style="margin-bottom:10px;padding:14px"><div style="display:flex;align-items:center;gap:8px"><div style="flex:1"><div style="font-size:14px;font-weight:800">${escH(t.nombre)} · ${escH(rubrosNombres(t.rubro))}</div>${t.profs&&t.profs.length?`<div style="font-size:11px;color:#fbbf24">Solo para: ${t.profs.map(id=>escH((allUsers.find(u=>u.id===id)||{name:id}).name)).join(', ')}</div>`:''}<div style="font-size:11px;color:var(--muted2)">${n} clientes con esta tarjeta</div></div><button class="lnk" onclick="editarTarjetaCfg('${t.id}')">Editar</button></div>
      <div style="font-size:12px;line-height:1.7;margin-top:8px">Fidelidad: ${t.visitas.map(v=>`${unidadTarj(t)} ${v.n}° → <b>${v.servicioIds&&v.servicioIds.length?'🎁 '+escH(v.label||'gratis'):v.pct+'%'}</b>`).join(' · ')}<br>${t.referidos.length?'Referidos: '+t.referidos.map((p,i)=>`${i+1}° → <b>${p}%</b>`).join(' · ')+'<br>':''}${t.premio?`🎁 Corte 100% de regalo al completar ${t.premio.refs} referidos y ${t.premio.visitas} cortes`:'Sin premio final'}</div>
      <div style="display:flex;gap:8px;margin-top:10px"><button class="btn btn-ghost" style="flex:1" onclick="aplicarTarjetaEnCurso('${t.id}')">Aplicar a tarjetas en curso</button><button class="btn btn-ghost" style="flex:0 0 auto;color:#f472b6" onclick="borrarTarjetaCfg('${t.id}')">Borrar</button></div></div>`; }).join('')||'<div class="empty"><div class="e-icon">⭐</div><p>No hay tarjetas.</p></div>'}`;
}
let tjEdit=null;
function editarTarjetaCfg(id){
  const t=id?promos.tarjetas.find(x=>x.id===id):null;
  tjEdit=t;
  const profsDisp=allUsers.filter(esProf);
  const rubroLista=t?String(t.rubro||'').split(',').map(s=>s.trim()):['barberia','barberia-premium'];
  const c=document.getElementById('registro-content');
  c.innerHTML=cabeceraModal(t?'Editar tarjeta':'Nueva tarjeta')+`
    <div class="field"><label>Nombre</label><input id="tj-nombre" value="${escH(t?t.nombre:'Tarjeta de fidelidad')}" style="${inpCss}"/></div>
    <div class="field" style="margin-top:10px"><label>Rubros donde vale</label><div style="display:flex;flex-wrap:wrap;gap:6px">${(rubros.length?rubros:[{id:'barberia',nombre:'Barbería'}]).map(r=>`<label class="rub-opt"><input type="checkbox" class="tj-rubro" value="${r.id}" ${rubroLista.includes(r.id)?'checked':''}/> ${escH(r.nombre)}</label>`).join('')}</div></div>
    <div class="field" style="margin-top:10px"><label>Solo para estos profesionales (vacío = todos los del rubro)</label><div style="display:flex;flex-wrap:wrap;gap:6px">${profsDisp.length?profsDisp.map(u=>`<label class="rub-opt"><input type="checkbox" class="tj-prof" value="${u.id}" ${t&&t.profs&&t.profs.includes(u.id)?'checked':''}/> ${escH(u.name)}</label>`).join(''):'<div style="font-size:12px;color:var(--muted)">No hay profesionales cargados todavía</div>'}</div></div>
    <div class="field" style="margin-top:10px"><label>Cantidad de cortes/servicios del ciclo</label><input id="tj-ciclo" type="number" min="1" max="30" value="${t?Math.max(1,...(t.visitas.length?t.visitas.map(x=>x.n):[10])):10}" oninput="renderCasillerosTarjeta()" style="${inpCss}"/></div>
    <div style="font-size:11px;color:var(--muted2);margin-top:4px">Poné el % de descuento de cada corte. Dejalo en 0 si ese corte no tiene descuento.</div>
    <div id="tj-casilleros" style="margin-top:8px"></div>
    <div class="field" style="margin-top:14px"><label>Cantidad de niveles de referidos (0 = sin referidos)</label><input id="tj-refn" type="number" min="0" max="10" value="${t?t.referidos.length:4}" oninput="renderNivelesTarjeta()" style="${inpCss}"/></div>
    <div id="tj-niveles" style="margin-top:8px"></div>
    <div style="display:flex;gap:8px;margin-top:14px">
      <div class="field" style="flex:1"><label>Premio: cortes necesarios</label><input id="tj-premv" type="number" min="0" value="${t&&t.premio?t.premio.visitas:0}" style="${inpCss}"/></div>
      <div class="field" style="flex:1"><label>Premio: referidos necesarios</label><input id="tj-premr" type="number" min="0" value="${t&&t.premio?t.premio.refs:0}" style="${inpCss}"/></div>
    </div>
    <div style="font-size:11px;color:var(--muted2);margin-top:4px">Premio: corte 100% gratis al llegar a los dos. Dejá "cortes necesarios" en 0 si no querés premio.</div>
    <button class="btn btn-primary" onclick="guardarTarjetaCfg('${t?t.id:''}')" style="margin-top:16px">Guardar</button>`;
  renderCasillerosTarjeta(); renderNivelesTarjeta();
  openModal('modal-registro');
}
function renderCasillerosTarjeta(){
  const el=document.getElementById('tj-casilleros'); if(!el) return;
  const n=Math.min(30,Math.max(1,parseInt(document.getElementById('tj-ciclo').value)||1));
  const t=tjEdit;
  el.innerHTML=Array.from({length:n},(_,i)=>{
    const num=i+1, ex=t&&t.visitas.find(x=>x.n===num);
    const gift=ex&&ex.servicioIds&&ex.servicioIds.length?JSON.stringify({servicioIds:ex.servicioIds,label:ex.label||''}):'';
    return `<div style="display:flex;align-items:center;gap:8px;margin-bottom:5px"><span style="width:28px;text-align:right;font-size:12px;color:var(--muted2)">${num}°</span>
      <input type="number" class="tj-visita" data-n="${num}" data-gift='${gift.replace(/'/g,"&#39;")}' min="0" max="100" value="${ex?ex.pct:0}" style="${inpCss};flex:1"/>
      <span style="font-size:12px;color:var(--muted2);width:60px">%${gift?' 🎁':''}</span></div>`;
  }).join('');
}
function renderNivelesTarjeta(){
  const el=document.getElementById('tj-niveles'); if(!el) return;
  const n=Math.min(10,Math.max(0,parseInt(document.getElementById('tj-refn').value)||0));
  const t=tjEdit;
  el.innerHTML=Array.from({length:n},(_,i)=>{
    const num=i+1, ex=t&&t.referidos&&t.referidos[i];
    return `<div style="display:flex;align-items:center;gap:8px;margin-bottom:5px"><span style="width:28px;text-align:right;font-size:12px;color:var(--muted2)">${num}°</span>
      <input type="number" class="tj-ref" min="0" max="100" value="${ex!=null?ex:0}" style="${inpCss};flex:1"/>
      <span style="font-size:12px;color:var(--muted2);width:60px">%</span></div>`;
  }).join('');
}
function guardarTarjetaCfg(id){
  const t=id?promos.tarjetas.find(x=>x.id===id):null;
  const nombre=(document.getElementById('tj-nombre').value||'').trim();
  const rubroSel=[...document.querySelectorAll('.tj-rubro:checked')].map(x=>x.value);
  const visitas=[...document.querySelectorAll('.tj-visita')].map(inp=>{
    const pct=Number(inp.value)||0; if(pct<=0) return null;
    const n=Number(inp.dataset.n); const gift=inp.dataset.gift?JSON.parse(inp.dataset.gift):null;
    return gift?{n,pct,servicioIds:gift.servicioIds,label:gift.label}:{n,pct};
  }).filter(Boolean);
  const referidos=[...document.querySelectorAll('.tj-ref')].map(inp=>Number(inp.value)||0).filter(n=>n>0);
  if(!nombre||!rubroSel.length||!visitas.length){ showToast('Revisá el nombre, los rubros y que algún corte tenga descuento'); return; }
  const pids=[...document.querySelectorAll('.tj-prof:checked')].map(x=>x.value);
  const premv=numV(document.getElementById('tj-premv').value), premr=numV(document.getElementById('tj-premr').value);
  const card={id:t?t.id:'tj'+Date.now().toString(36),nombre,rubro:rubroSel.join(','),activa:true,visitas,referidos,premio:premv>0?{visitas:premv,refs:premr}:null};
  if(pids.length) card.profs=pids;
  promos.tarjetas=t?promos.tarjetas.map(x=>x.id===t.id?card:x):[...(promos.tarjetas||[]),card];
  savePromos(); closeModal('modal-registro'); showToast('Tarjeta guardada ✓ (los clientes ya en curso no cambian)'); renderAdmin();
}
async function aplicarTarjetaEnCurso(id){
  const card=promos.tarjetas.find(x=>x.id===id); if(!card) return;
  const n=clientesDir.filter(x=>(x.tarjetas||[]).some(t=>t.cardId===id)).length;
  if(!await uiConfirm('¿Aplicar a '+n+' tarjetas en curso?','Los clientes que ya empezaron pasan a tener estas reglas. Ya hecho: los cortes y referidos que llevan se mantienen.',{ok:'Aplicar'})) return;
  await cambiarClientes(list=>{ list.forEach(c=>{ (c.tarjetas||[]).forEach(t=>{ if(t.cardId===id){ t.snap=clonar(card); c.upd=new Date().toISOString(); } }); }); });
  showToast('Tarjetas actualizadas ✓'); renderAdmin();
}
async function borrarTarjetaCfg(id){
  if(!await uiConfirm('¿Borrar esta tarjeta?','No se ofrece más a clientes nuevos. Los que ya la tienen la conservan.',{ok:'Borrar'})) return;
  promos.tarjetas=promos.tarjetas.filter(x=>x.id!==id); savePromos(); renderAdmin();
}
function adminDescuentos(c){
  const hoy=hoyStr(); const r=rangoPeriodo('quincena'); const P=htmlPerdidaDescuentos(r.desde,r.hasta);
  const cm=promos.comision, nc=nocheCfg();
  const diasTxt=(d)=>d&&d.length?d.map(x=>DIAS_NOM[x]).join(', '):'todos los días';
  c.innerHTML=`<div class="card" style="margin-bottom:10px;border-color:rgba(52,211,153,.35)">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px"><span style="font-size:13px;font-weight:800">🌐 Reserva pública</span><button class="lnk" onclick="abrirConfigReservaPublica()">Configurar</button></div>
    <div style="font-size:11.5px;color:var(--muted2);line-height:1.5">Link para compartir (sitio web, Instagram, WhatsApp): <b style="color:var(--text);word-break:break-all">${escH(location.origin+location.pathname+'#reserva')}</b></div>
    <div style="font-size:11.5px;color:var(--muted2);margin-top:4px">WhatsApp del negocio: ${promos.whatsappNegocio?escH(promos.whatsappNegocio):'<span style="color:#fbbf24">sin configurar — el cliente va a tener que elegir el contacto a mano</span>'} · Seña obligatoria con oferta: <b style="color:var(--text)">${numV(promos.senaPublicaPct)||30}%</b></div>
  </div>
  <div class="sec-hdr" style="margin:6px 0 8px"><span class="sec-title">🏷️ Descuentos fijos</span><div style="display:flex;gap:10px"><button class="lnk" onclick="abrirCreadorOferta()">🎯 Armar oferta</button><button class="lnk" onclick="editarReglaFija('')">+ Nuevo</button></div></div>
    <div class="card" style="margin-bottom:8px;font-size:12px;color:var(--muted2);line-height:1.5">Se aplican solos según el <b style="color:var(--text)">horario del turno</b>, el día, la sucursal y la profesión del cliente. En cada cobro se aplica <b style="color:var(--text)">un solo descuento: el más alto</b> entre estas promos, el efectivo, las ofertas, la fidelidad y los referidos. Nunca se suman, <b style="color:var(--text)">salvo el adicional que tenga configurada una promo</b> (hoy: +15% para fuerzas en las promos de peluquería).</div>
    ${(promos.fijos||[]).map(f=>`<div class="card" style="margin-bottom:8px;${f.activo===false?'opacity:.55':''}"><div style="display:flex;gap:8px;align-items:center"><div style="flex:1;min-width:0"><div style="font-size:13px;font-weight:800">${escH(f.nombre)} · ${f.pct}%${f.grupoNombre?' <span style="color:var(--muted2);font-weight:600">('+escH(f.grupoNombre)+')</span>':''}${f.soloCuenta?' <span style="color:#a89fff">🔒 solo cuenta</span>':''}</div>
      <div style="font-size:11px;color:var(--muted2);line-height:1.6">${escH(rubrosNombres(f.rubro))}${f.servicioIds&&f.servicioIds.length?' ('+f.servicioIds.map(id=>escH(nombreSvcId(id))).join(', ')+')':''} · ${diasTxt(f.dias)}${f.horaDesde||f.horaHasta?' · de '+(f.horaDesde||'apertura')+' a '+(f.horaHasta||'cierre'):''}${f.sucursales&&f.sucursales.length?' · '+f.sucursales.map(s=>escH((sucursalDe(s)||{}).nombre||s)).join(', '):' · todas las sucursales'}${f.profesion?' · clientes: '+escH(f.profesion):''}${f.extra&&f.extra.profesion?' · <b style="color:#34d399">+'+numV(f.extra.pct)+'% adicional si es '+escH(f.extra.profesion)+' (se suma)</b>':''}${(f.fechaDesde||f.fechaHasta)?' · <b style="color:#a89fff">'+(f.fechaDesde?fechaCortaStr(f.fechaDesde):'ahora')+' a '+(f.fechaHasta?fechaCortaStr(f.fechaHasta):'siempre')+'</b>':''}${f.cupo!=null?' · <b style="color:'+(numV(f.usos)>=numV(f.cupo)?'#f87171':'#fbbf24')+'">'+numV(f.usos)+'/'+f.cupo+' usados</b>':''}</div></div>
      <button class="lnk" onclick="toggleReglaFija('${f.id}')">${f.activo===false?'Activar':'Pausar'}</button><button class="lnk" onclick="editarReglaFija('${f.id}')">Editar</button><button class="lnk" style="color:#f472b6" onclick="borrarReglaFija('${f.id}')">×</button></div></div>`).join('')}
    <div class="sec-hdr" style="margin:16px 0 8px"><span class="sec-title">💰 Comisión con descuentos altos</span><button class="lnk" onclick="editarComisionCfg()">Editar</button></div>
    <div class="card" style="margin-bottom:8px;font-size:12.5px;line-height:1.7">Se aplica un solo descuento por cobro (el más alto). Si el descuento supera el <b>${cm.t1}%</b>: el profesional cobra el <b>${cm.p1}%</b> de lo que pagó el cliente y el salón el ${100-cm.p1}%.<br>Si el descuento llega al <b>${cm.t2}%</b> o más: el profesional cobra el <b>${cm.p2}%</b> y el salón el ${100-cm.p2}%.</div>
    <div class="sec-hdr" style="margin:16px 0 8px"><span class="sec-title">🌙 Turnos de noche</span><button class="lnk" onclick="editarNocheCfg()">Editar</button></div>
    <div class="card" style="margin-bottom:8px;font-size:12.5px;line-height:1.7">Los turnos que terminan a partir de las <b>${escH(nc.desde)}</b> (en cualquier sucursal) van a <b>precio de lista, sin ningún descuento</b> (ni efectivo, ni promos, ni fidelidad, ni referidos) y el profesional cobra el <b>${numV(nc.pct)}%</b> de lo que paga el cliente.</div>
    <div class="sec-hdr" style="margin:16px 0 8px"><span class="sec-title">🎁 Paquetes y 💳 membresía</span><button class="lnk" onclick="editarVentasCfg()">Editar</button></div>
    <div class="card" style="margin-bottom:8px;font-size:12.5px;line-height:1.7">Paquetes (servicios juntos): 1 = normal · ${(promos.paquetes||[]).map(x=>x.n+(x===promos.paquetes[promos.paquetes.length-1]?'+':'')+' = '+x.pct+'%').join(' · ')} · primero se aplica el descuento individual de cada servicio y recién después este %, repartido entre las líneas · la comisión de quien lo vende se ve en Clientes → Paquetes<br>Membresía (precio fijo, vence a los 30 días): ${(promos.membresiaPlanes||[]).map(p=>{ const sv=servicioDePlan(p); return escH(p.nombre)+' — '+p.creditos+' de '+(sv?escH(sv.nombre):'<span style="color:#f87171">sin servicio '+escH(p.servicioNombre)+'</span>')+' por '+fp(p.precio); }).join(' · ')}</div>
    <div class="sec-hdr" style="margin:16px 0 8px"><span class="sec-title">📉 Plata que dejamos en descuentos</span><span style="font-size:11px;color:var(--muted2)">${r.label}</span></div>
    <div class="card">${P.html}</div>`;
}
function toggleReglaFija(id){ const f=promos.fijos.find(x=>x.id===id); if(f){ f.activo=f.activo===false; savePromos(); renderAdmin(); } }
async function borrarReglaFija(id){ if(!await uiConfirm('¿Borrar este descuento fijo?','Deja de aplicarse en los cobros nuevos.',{ok:'Borrar'})) return; promos.fijos=promos.fijos.filter(x=>x.id!==id); savePromos(); renderAdmin(); }
async function editarReglaFija(id){
  const f=id?promos.fijos.find(x=>x.id===id):null;
  const v=await uiDialog({title:f?'Editar descuento fijo':'Nuevo descuento fijo',fields:[
    {label:'Nombre',value:f?f.nombre:''},{label:'Descuento %',type:'number',value:f?f.pct:15},
    {label:'Rubros (ids separados por coma, vacío = todos)',value:f?f.rubro:'barberia,barberia-premium'},
    {label:'Días (ej: lun, mar) — vacío = todos',value:f?(f.dias||[]).map(d=>DIAS_NOM[d]).join(', '):''},
    {label:'Desde la hora (HH:MM) — vacío = desde que abre',value:f?f.horaDesde||'':''},
    {label:'Hasta la hora (HH:MM) — vacío = hasta que cierra',value:f?f.horaHasta:''},
    {label:'Sucursales ('+sucursales.map(s=>s.nombre).join(', ')+') — vacío = todas',value:f?(f.sucursales||[]).map(s=>(sucursalDe(s)||{}).nombre||s).join(', '):''},
    {label:'Profesión del cliente (vacío = cualquiera)',value:f?f.profesion:''},
    {label:'Servicios que incluye (nombres separados por coma) — vacío = todos los del rubro',value:f&&f.servicioIds?f.servicioIds.map(nombreSvcId).join(', '):''},
    {label:'Adicional para esta profesión (se suma al descuento) — vacío = ninguno',value:f&&f.extra?f.extra.profesion:''},
    {label:'Ese adicional es de (%)',type:'number',value:f&&f.extra?f.extra.pct:15}],ok:'Guardar'});
  if(!v) return;
  const pct=numV(v[1]); if(!v[0].trim()||pct<=0||pct>100){ showToast('Poné nombre y un descuento entre 1 y 100'); return; }
  const dk=DIAS_NOM.map(nkey); const dias=v[3].split(',').map(x=>dk.indexOf(nkey(x).slice(0,3))).filter(d=>d>=0);
  const suc=v[6].split(',').map(s=>nkey(s)).filter(Boolean).map(n=>(sucursales.find(s=>nkey(s.nombre)===n)||{}).id).filter(Boolean);
  const hd=v[4].trim(), hh=v[5].trim(); if((hh&&!/^\d{1,2}:\d{2}$/.test(hh))||(hd&&!/^\d{1,2}:\d{2}$/.test(hd))){ showToast('Las horas van como HH:MM'); return; }
  const reg={id:f?f.id:'f'+Date.now().toString(36),nombre:v[0].trim(),pct,rubro:v[2].trim(),dias:[...new Set(dias)],horaDesde:hd?hd.padStart(5,'0'):'',horaHasta:hh?hh.padStart(5,'0'):'',sucursales:suc,profesion:v[7].trim(),activo:f?f.activo!==false:true};
  const sids=idsServiciosPorNombre(v[8]); if(sids.length) reg.servicioIds=sids;
  if(v[9].trim()&&numV(v[10])>0) reg.extra={profesion:v[9].trim(),pct:numV(v[10])};
  promos.fijos=f?promos.fijos.map(x=>x.id===f.id?reg:x):[...(promos.fijos||[]),reg];
  savePromos(); showToast('Descuento guardado ✓'); renderAdmin();
}
// ============ Creador de ofertas (pedido de Ivo, 26/09/2026) ============
// Arma varios "descuentos fijos" de una sola vez -- uno por servicio elegido, cada uno con su propio %,
// todos compartiendo los mismos dias/sucursales/vigencia/cupo (grupoOfertaId los une para mostrarlos y
// para que el cupo sea un pozo comun entre todos los servicios de la oferta, no uno por servicio).
const OFC_DURACIONES=[['1sem','1 semana',7],['2sem','2 semanas',14],['1mes','1 mes',30],['siempre','Siempre activa',null]];
let ofertaCreador=null;
function abrirCreadorOferta(){
  ofertaCreador={nombre:'',rubros:[],serviciosPct:{},pctDefault:15,dias:[],duracion:'siempre',cupo:'',sucursales:[],soloCuenta:false};
  renderCreadorOferta(); openModal('modal-registro');
}
function ofcToggleRubro(id){ const i=ofertaCreador.rubros.indexOf(id); if(i>=0) ofertaCreador.rubros.splice(i,1); else ofertaCreador.rubros.push(id); renderCreadorOferta(); }
function ofcToggleServicio(id){
  if(ofertaCreador.serviciosPct.hasOwnProperty(id)) delete ofertaCreador.serviciosPct[id];
  else ofertaCreador.serviciosPct[id]=numV(ofertaCreador.pctDefault)||15;
  renderCreadorOferta();
}
function ofcSetPct(id,val){ ofertaCreador.serviciosPct[id]=Math.max(1,Math.min(100,numV(val)||0)); renderCreadorOferta(); }
function ofcAplicarATodos(){ const p=Math.max(1,Math.min(100,numV(ofertaCreador.pctDefault)||0)); Object.keys(ofertaCreador.serviciosPct).forEach(id=>ofertaCreador.serviciosPct[id]=p); renderCreadorOferta(); }
function ofcToggleDia(d){ const i=ofertaCreador.dias.indexOf(d); if(i>=0) ofertaCreador.dias.splice(i,1); else ofertaCreador.dias.push(d); renderCreadorOferta(); }
function ofcToggleSucursal(id){ const i=ofertaCreador.sucursales.indexOf(id); if(i>=0) ofertaCreador.sucursales.splice(i,1); else ofertaCreador.sucursales.push(id); renderCreadorOferta(); }
function renderCreadorOferta(){
  const s=ofertaCreador, color='#4A136B';
  const porRubro={}; servicios.forEach(x=>{ (porRubro[x.rubro||'']=porRubro[x.rubro||'']||[]).push(x); });
  const svcsElegidos=Object.keys(s.serviciosPct);
  document.getElementById('registro-content').innerHTML=cabeceraModal('🎯 Armar oferta')+`
    <div class="field"><label>Nombre de la oferta</label><input id="ofc-nombre" placeholder="Ej: Promo primavera" value="${escH(s.nombre)}" onchange="ofertaCreador.nombre=this.value"/></div>
    <div style="font-size:12px;font-weight:800;margin:14px 0 8px">1. ¿Qué rubros?</div>
    <div style="display:flex;flex-wrap:wrap;gap:6px">${rubros.map(r=>`<button onclick="ofcToggleRubro('${r.id}')" style="${pillStyle(s.rubros.includes(r.id),color)}">${escH(r.nombre)}</button>`).join('')}</div>
    ${s.rubros.length?`<div style="font-size:12px;font-weight:800;margin:16px 0 6px">2. ¿Qué servicios, y a qué %?</div>
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px"><span style="font-size:11.5px;color:var(--muted2)">% para los que marques</span><input id="ofc-pctdef" type="number" inputmode="numeric" value="${s.pctDefault}" onchange="ofertaCreador.pctDefault=numV(this.value)" style="width:60px;background:var(--s2);border:1.5px solid var(--border2);border-radius:8px;padding:6px 8px;color:var(--text);font-family:var(--font);font-size:13px;text-align:center"/>${svcsElegidos.length?`<button class="lnk" onclick="ofcAplicarATodos()">Aplicar a los ya marcados</button>`:''}</div>
    ${s.rubros.map(rid=>{ const L=porRubro[rid]||[]; if(!L.length) return ''; return `<div style="font-size:11px;font-weight:800;color:var(--muted2);text-transform:uppercase;letter-spacing:.04em;margin:8px 0 4px">${escH(nombreRubro(rid)||rid)}</div>
      ${L.map(svc=>{ const on=s.serviciosPct.hasOwnProperty(svc.id); return `<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--border)"><input type="checkbox" onchange="ofcToggleServicio('${svc.id}')" ${on?'checked':''}/><div style="flex:1;font-size:13px;min-width:0">${escH(svc.nombre)} <span style="color:var(--muted2);font-size:11px">${fp(svc.precio)}</span></div>${on?`<input type="number" inputmode="numeric" value="${s.serviciosPct[svc.id]}" onchange="ofcSetPct('${svc.id}',this.value)" style="width:56px;background:var(--s2);border:1.5px solid var(--border2);border-radius:8px;padding:6px 6px;color:var(--text);font-family:var(--font);font-size:13px;text-align:center"/><span style="font-size:12px;color:var(--muted2)">%</span>`:''}</div>`; }).join('')}`; }).join('')}` : '<div style="font-size:12px;color:var(--muted);margin-top:8px">Elegí al menos un rubro para ver sus servicios.</div>'}
    <div style="font-size:12px;font-weight:800;margin:16px 0 8px">3. ¿Qué días?</div>
    <div style="display:flex;flex-wrap:wrap;gap:6px">${[1,2,3,4,5,6,0].map(d=>`<button onclick="ofcToggleDia(${d})" style="${pillStyle(s.dias.includes(d),color)}">${DIAS_NOM[d]}</button>`).join('')}</div>
    <div style="font-size:10.5px;color:var(--muted);margin-top:4px">Sin marcar ninguno = todos los días.</div>
    <div style="font-size:12px;font-weight:800;margin:16px 0 8px">4. ¿Cuánto dura?</div>
    <div style="display:flex;flex-wrap:wrap;gap:6px">${OFC_DURACIONES.map(([k,l])=>`<button onclick="ofertaCreador.duracion='${k}';renderCreadorOferta()" style="${pillStyle(s.duracion===k,color)}">${l}</button>`).join('')}</div>
    <div class="field" style="margin-top:10px"><label>Cupo (cantidad de lugares) — vacío = sin límite</label><input id="ofc-cupo" type="number" inputmode="numeric" placeholder="Ej: 10" value="${escH(s.cupo)}" onchange="ofertaCreador.cupo=this.value"/></div>
    <div style="font-size:12px;font-weight:800;margin:16px 0 8px">5. ¿En qué sucursales?</div>
    <div style="display:flex;flex-wrap:wrap;gap:6px">${sucursales.map(x=>`<button onclick="ofcToggleSucursal('${x.id}')" style="${pillStyle(s.sucursales.includes(x.id),color)}">${escH(x.nombre)}</button>`).join('')}</div>
    <div style="font-size:10.5px;color:var(--muted);margin-top:4px">Sin marcar ninguna = todas.</div>
    <div style="font-size:12px;font-weight:800;margin:16px 0 8px">6. ¿Solo para clientes con cuenta (login con Google en /#cuenta)?</div>
    <label class="rub-opt"><input type="checkbox" ${s.soloCuenta?'checked':''} onchange="ofertaCreador.soloCuenta=this.checked"/> 🔒 Exclusiva para clientes logueados — no la ve nadie más</label>
    ${htmlCalculadoraOferta()}
    <button class="btn btn-primary" style="width:100%;margin-top:16px" onclick="ofcGuardar()">Guardar oferta</button>`;
}
function htmlCalculadoraOferta(){
  const s=ofertaCreador; const ids=Object.keys(s.serviciosPct); if(!ids.length) return '';
  const cupo=numV(s.cupo)||null;
  const filas=ids.map(id=>{
    const svc=servicios.find(x=>x.id===id); if(!svc) return '';
    const pct=numV(s.serviciosPct[id]);
    const precioFinal=Math.round(numV(svc.precio)*(1-pct/100));
    const comPct=comisionRubroEstim(svc.rubro);
    const comAntes=Math.round(numV(svc.precio)*comPct/100), comDespues=Math.round(precioFinal*comPct/100);
    const pierde=comAntes-comDespues;
    return `<div style="padding:8px 0;border-bottom:1px solid var(--border)">
      <div style="font-size:12.5px;font-weight:700">${escH(svc.nombre)}</div>
      <div style="font-size:11px;color:var(--muted2)">Precio: ${fp(svc.precio)} → <b style="color:var(--text)">${fp(precioFinal)}</b> (${pct}% off)</div>
      <div style="font-size:11px;color:var(--muted2)">Comisión estimada (${comPct}%, ${nombreRubro(svc.rubro)||svc.rubro}): ${fp(comAntes)} → <b style="color:#fbbf24">${fp(comDespues)}</b> <span style="color:#f87171">(pierde ${fp(pierde)} por vez)</span></div>
      ${cupo?`<div style="font-size:11px;color:var(--muted2)">Si se agotan los ${cupo} lugares: el profesional dejaría de ganar en total <b style="color:#f87171">${fp(pierde*cupo)}</b>, y ganaría <b style="color:#fbbf24">${fp(comDespues*cupo)}</b> por esta oferta.</div>`:''}
    </div>`;
  }).join('');
  return `<div style="font-size:12px;font-weight:800;margin:16px 0 8px">📊 Impacto estimado</div><div class="card">${filas}<div style="font-size:10px;color:var(--muted);margin-top:6px">Estimado con el % de comisión base de cada rubro — quien tenga una comisión fija distinta va a variar un poco.</div></div>`;
}
function ofcGuardar(){
  const s=ofertaCreador;
  const ids=Object.keys(s.serviciosPct);
  if(!s.nombre.trim()){ showToast('Ponele un nombre a la oferta'); return; }
  if(!ids.length){ showToast('Elegí al menos un servicio'); return; }
  const dur=OFC_DURACIONES.find(x=>x[0]===s.duracion);
  const fechaDesde=hoyStr(), fechaHasta=dur&&dur[2]!=null?addDias(fechaDesde,dur[2]):'';
  const cupo=numV(s.cupo)>0?numV(s.cupo):null;
  const grupoOfertaId='og'+Date.now().toString(36);
  const nuevas=ids.map((id,i)=>{
    const svc=servicios.find(x=>x.id===id);
    return {id:'f'+Date.now().toString(36)+i, grupoOfertaId, grupoNombre:s.nombre.trim(), nombre:s.nombre.trim()+' — '+(svc?svc.nombre:id), pct:numV(s.serviciosPct[id]), rubro:svc?svc.rubro:'', servicioIds:[id], dias:[...s.dias], sucursales:[...s.sucursales], fechaDesde, fechaHasta:fechaHasta||undefined, cupo, usos:0, activo:true, soloCuenta:!!s.soloCuenta};
  });
  promos.fijos=[...(promos.fijos||[]),...nuevas];
  savePromos(); ofertaCreador=null; showToast('Oferta guardada ✓ ('+nuevas.length+' servicio'+(nuevas.length===1?'':'s')+')'); renderAdmin();
}
async function editarComisionCfg(){
  const cm=promos.comision;
  const v=await uiDialog({title:'Comisión con descuentos altos',fields:[{label:'Si el descuento supera (%)',type:'number',value:cm.t1},{label:'…el profesional cobra (% de lo que pagó el cliente)',type:'number',value:cm.p1},{label:'Si el descuento llega a (%)',type:'number',value:cm.t2},{label:'…el profesional cobra (%)',type:'number',value:cm.p2}],ok:'Guardar'});
  if(!v) return; promos.comision={t1:numV(v[0]),p1:numV(v[1]),t2:numV(v[2]),p2:numV(v[3])}; savePromos(); renderAdmin();
}
async function editarNocheCfg(){
  const nc=nocheCfg();
  const v=await uiDialog({title:'Turnos de noche',msg:'Los turnos que terminan desde esta hora no llevan descuentos y el profesional cobra un porcentaje fijo.',fields:[{label:'Desde la hora (HH:MM)',value:nc.desde},{label:'El profesional cobra (%)',type:'number',value:nc.pct}],ok:'Guardar'});
  if(!v) return; const h=v[0].trim(), p=numV(v[1]);
  if(!/^\d{1,2}:\d{2}$/.test(h)||p<=0||p>100){ showToast('Poné la hora como HH:MM y un porcentaje entre 1 y 100'); return; }
  promos.noche={desde:h.padStart(5,'0'),pct:p}; savePromos(); showToast('Guardado ✓'); renderAdmin();
}
async function editarVentasCfg(){
  const planes=promos.membresiaPlanes||[];
  const v=await uiDialog({title:'Paquetes y membresía',msg:'Escalera de paquetes: "servicios:%" separados por coma. Las membresías son a precio fijo (no %) y vencen a los 30 días — eso no se edita acá, son reglas del negocio. La comisión de quien vende paquetes se edita aparte, en Clientes → Paquetes.',fields:[
    {label:'Paquetes (ej: 2:5, 3:10, 4:15)',value:(promos.paquetes||[]).map(x=>x.n+':'+x.pct).join(', ')},
    {label:'Membresía: cantidad de servicios (las dos)',type:'number',value:planes[0]?planes[0].creditos:4},
    ...planes.map(p=>({label:'Membresía '+p.nombre+': precio fijo',type:'number',value:p.precio}))],ok:'Guardar'});
  if(!v) return;
  const esc=v[0].split(',').map(s=>s.trim().split(':').map(Number)).filter(a=>a[0]>1&&a[1]>=0).map(a=>({n:a[0],pct:a[1]})).sort((a,b)=>a.n-b.n);
  const creditos=Math.max(1,Math.round(numV(v[1]))||4);
  promos.paquetes=esc.length?esc:promos.paquetes;
  promos.membresiaPlanes=planes.map((p,i)=>({...p,creditos,precio:Math.max(0,numV(v[2+i]))||p.precio}));
  savePromos(); showToast('Guardado ✓'); renderAdmin();
}
async function editarComisionRubro(){
  const cfg=promos.comisionRubro||{}, base=numV((tramosVigentes()[0]||{pct:45}).pct);
  const v=await uiDialog({title:'Comisión real por rubro',msg:'Para calcular la ganancia de un paquete. Vacío = tramo base ('+base+'%), salvo podología/cosmetología/cejas y pestañas/masajes que son 70% por defecto.',
    fields:rubros.map(r=>({label:r.nombre,type:'number',value:cfg[r.id]!=null?cfg[r.id]:(RUBROS_ALTA_COM.includes(r.id)?70:'')}))});
  if(!v) return;
  const nuevo={}; rubros.forEach((r,i)=>{ const n=String(v[i]).trim(); if(n!=='') nuevo[r.id]=Math.min(100,Math.max(0,numV(n))); });
  promos.comisionRubro=nuevo; savePromos(); showToast('Guardado ✓'); renderAdmin();
}
async function editarRecPaqTramos(){
  const T=tramosPaquete();
  const v=await uiDialog({title:'Comisión de quien vende paquetes',msg:'Tramos según lo facturado en paquetes en la quincena (no por venta). Formato "facturado desde:%", separados por coma.',
    fields:[{label:'Tramos (ej: 0:10, 400000:15, 800000:20)',value:T.map(t=>t.min+':'+t.pct).join(', ')}]});
  if(!v) return;
  const t=v[0].split(',').map(x=>x.trim().split(':').map(Number)).filter(a=>a.length===2&&!isNaN(a[0])&&a[1]>=0&&a[1]<=100).map(a=>({min:Math.max(0,a[0]),pct:a[1]})).sort((a,b)=>a.min-b.min);
  if(!t.length){ showToast('Poné al menos un tramo'); return; }
  promos.recPaqTramos=t; savePromos(); showToast('Guardado ✓'); renderAdmin();
}

// ============ VARIOS ============
function horaAhora(){ const n=new Date(); return String(n.getHours()).padStart(2,'0')+':'+String(n.getMinutes()).padStart(2,'0'); }
function comTurno(t,pct){
  const normal=numV(t.monto)*pct/100;
  if(t.comFija==null) return normal;
  const fija=numV(t.comFija)+Math.max(0,numV(t.monto)-numV(t.comFijaBase!=null?t.comFijaBase:t.monto))*pct/100;
  return Math.max(normal,fija); // piso: si su comision normal (tramo, o el fijo de estetica) ya es mayor, no se le baja
}
function comisionConFijas(turnos,fact,pct){ return (turnos||[]).reduce((s,t)=>s+comTurno(t,pct),0); }
// Las sucursales sin recepcionista (ej: French): los profesionales cierran ellos mismos el turno y suman los puntos
function sucursalSinRecepcion(u){ return !!u&&(u.role==='profesional'||(u.role==='admin'&&!!u.tambienProf))&&sinRecepcionId(u.sucursal); }
// Cambia campos de una persona en el listado de usuarios (solo el admin lo puede hacer)
async function guardarCampoUsuario(id,patch){ return editarUsuario(id,patch); }

// ============ PUNTOS: valores que edita el admin ============
let reglasPuntos={valores:{},extra:[]};
function ptsDe(id,def){ const v=reglasPuntos.valores[id]; return v!=null&&v!==''?numV(v):def; }
function loadPuntosReglas(){
  try{ const r=JSON.parse(localStorage.getItem('luffy_puntos_reglas')||'null'); if(r) reglasPuntos={valores:{},extra:[],...r}; }catch(e){}
  if(DB) DB.doc('luffy/puntos_reglas').get().then(r=>{ if(r&&JSON.stringify(r)!==JSON.stringify(reglasPuntos)){ reglasPuntos={valores:{},extra:[],...r}; try{localStorage.setItem('luffy_puntos_reglas',JSON.stringify(reglasPuntos));}catch(e){} refreshCurrentView(); } }).catch(()=>{});
}
function savePuntosReglas(){
  try{localStorage.setItem('luffy_puntos_reglas',JSON.stringify(reglasPuntos));}catch(e){}
  if(DB){ try{DB.doc('luffy/puntos_reglas').set(reglasPuntos);}catch(e){} }
}
function puntosAcciones(){ return [...PUNTOS_CONFIG.map(c=>({...c,pts:ptsDe(c.id,c.pts)})),...(reglasPuntos.extra||[]).map(x=>({...x,auto:false,custom:true}))]; }
function htmlAdminReglasPuntos(){
  return `<div class="sec-hdr" style="margin:6px 0 8px"><span class="sec-title">⚙️ Cuánto vale cada acción</span><button class="lnk" onclick="nuevaAccionPuntos()">+ Nueva acción</button></div>
    <div class="card" style="margin-bottom:14px">${puntosAcciones().map(a=>`<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--border)"><span style="font-size:18px">${a.emoji||'⭐'}</span><div style="flex:1;font-size:13px">${escH(a.label)}<div style="font-size:10.5px;color:var(--muted)">${a.custom?'Se da a mano':(a.auto?'Se suma sola':'Se da a mano')}</div></div><b style="font-size:14px">${a.pts>0?'+':''}${a.pts}</b><button class="lnk" onclick="editarPtsAccion('${a.id}')">Editar</button>${a.custom?`<button class="lnk" style="color:#f472b6" onclick="borrarAccionPuntos('${a.id}')">×</button>`:''}</div>`).join('')}</div>`;
}
async function editarPtsAccion(id){
  const a=puntosAcciones().find(x=>x.id===id); if(!a) return;
  const v=await uiPrompt('Puntos: '+a.label,{label:'Puntos',type:'number',value:a.pts,ok:'Guardar'});
  if(v===null) return;
  const n=parseInt(v); if(isNaN(n)){ showToast('Poné un número'); return; }
  if(a.custom) reglasPuntos.extra=reglasPuntos.extra.map(x=>x.id===id?{...x,pts:n}:x); else reglasPuntos.valores[id]=n;
  savePuntosReglas(); renderAdmin();
}
async function nuevaAccionPuntos(){
  const v=await uiDialog({title:'Nueva acción con puntos',msg:'La vas a poder dar a mano desde "Dar/quitar puntos".',fields:[{label:'Nombre',placeholder:'Ej: Cliente trajo un referido'},{label:'Puntos',type:'number',value:'20'},{label:'Emoji (opcional)',placeholder:'⭐'}],ok:'Agregar'});
  if(!v||!v[0].trim()){ return; }
  reglasPuntos.extra=[...(reglasPuntos.extra||[]),{id:'x'+Date.now().toString(36),label:v[0].trim(),pts:parseInt(v[1])||0,emoji:(v[2]||'').trim()||'⭐'}];
  savePuntosReglas(); renderAdmin();
}
async function borrarAccionPuntos(id){ if(!await uiConfirm('¿Borrar esta acción?','Los puntos ya dados no cambian.')) return; reglasPuntos.extra=reglasPuntos.extra.filter(x=>x.id!==id); savePuntosReglas(); renderAdmin(); }

// ============ RECEPCION: turnos de trabajo, tareas por horario y tablero ============
const hh2=(n)=>String(n).padStart(2,'0');
// Ventana de trabajo de una recepcionista: sus bloques de hoy segun el calendario (o los bloques fijos viejos / todo el dia)
function ventanaRec(u){
  const uu=u||profile; if(!uu) return {desde:'00:00',hasta:'24:00'};
  const bl=bloquesDeUsuarioEn(uu,hoyStr());
  if(bl.length) return {desde:bl.map(b=>b.desde).sort()[0],hasta:bl.map(b=>b.hasta).sort().slice(-1)[0]};
  if(hayCalendario()||(uu.bloquesRec||[]).length) return {desde:'00:00',hasta:'00:00'};
  const t=uu.turnoRec; return t&&t.desde&&t.hasta?t:{desde:'00:00',hasta:'24:00'};
}
function bloquesDe(u){ return bloquesDeUsuarioEn(u,hoyStr()); }
function horaDeIso(iso){ const d=new Date(iso); return hh2(d.getHours())+':'+hh2(d.getMinutes()); }
function enVentana(iso,w){ if(!iso) return false; const h=horaDeIso(iso); return h>=w.desde&&h<w.hasta; }
function tareasDeRec(u){ const w=ventanaRec(u); return tareasRecepcion.filter(t=>t.desde<w.hasta&&t.hasta>w.desde); }
function hechaTarea(id){ return !!(tareasData&&tareasData[hoyStr()]&&tareasData[hoyStr()][id]&&tareasData[hoyStr()][id].done); }
function htmlTareasRec(){
  const ahora=horaAhora(); const todas=tareasDeRec();
  const actuales=todas.filter(t=>t.desde<=ahora&&ahora<t.hasta);
  const atrasadas=todas.filter(t=>t.hasta<=ahora&&!hechaTarea(t.id));
  const futuras=todas.filter(t=>t.desde>ahora).sort((a,b)=>a.desde.localeCompare(b.desde));
  const prox=futuras.length?futuras.filter(t=>t.desde===futuras[0].desde):[];
  const fila=(t,atras)=>{ const done=hechaTarea(t.id), por=(tareasData[hoyStr()]||{})[t.id]; return `<div onclick="toggleTarea('${t.id}')" style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--border);cursor:pointer">
    <div style="width:22px;height:22px;border-radius:7px;border:2px solid ${done?'#34d399':(atras?'#f472b6':'var(--border2)')};background:${done?'#34d399':'transparent'};display:flex;align-items:center;justify-content:center;font-size:13px;flex-shrink:0;color:#0b0b10">${done?'✓':''}</div>
    <div style="flex:1;font-size:13px;${done?'color:var(--muted2);text-decoration:line-through':''}">${t.emoji||'✅'} ${escH(t.label)}${atras?` <span style="font-size:10px;color:#f472b6;font-weight:700">· era de las ${t.desde}</span>`:''}${done&&por&&por.por?` <span style="font-size:10px;color:var(--muted)">· ${escH(por.por)}</span>`:''}</div></div>`; };
  const hechasAhora=actuales.filter(t=>hechaTarea(t.id)).length;
  const rango=actuales.length?actuales[0].desde+' a '+actuales[0].hasta:'';
  return `<div class="sec-hdr" style="margin-top:16px;margin-bottom:8px"><span class="sec-title">📋 Tareas de ahora${rango?' · '+rango:''}${actuales.length?' ('+hechasAhora+'/'+actuales.length+')':''}</span></div>
    <div class="card" style="margin-bottom:8px">${actuales.length?actuales.map(t=>fila(t,false)).join(''):'<div style="font-size:13px;color:var(--muted2);padding:8px 0">No hay tareas en este horario 🎉</div>'}</div>
    ${atrasadas.length?`<details class="card" style="margin-bottom:8px;border-color:rgba(244,114,182,.35)"><summary style="cursor:pointer;font-size:13px;font-weight:800;color:#f472b6">⚠️ Atrasadas (${atrasadas.length})</summary>${atrasadas.map(t=>fila(t,true)).join('')}</details>`:''}
    ${prox.length?`<div style="font-size:11.5px;color:var(--muted2);margin:0 2px 10px">⏭ Próximo bloque a las ${prox[0].desde}: ${prox.length} ${prox.length===1?'tarea':'tareas'}</div>`:''}`;
}
// ---------- checklist de supervisión del encargado (flag esEncargado) ----------
// Mismo mecanismo que tareasRecepcion (admin-editable, se tilda y queda registrado) pero sin ventana horaria:
// son tareas de "estar atento durante el día", no de un momento puntual. Pedido de Ivo, confirmado 2/10/2026.
function htmlTareasEncargado(){
  if(!profile||!profile.esEncargado) return '';
  const hechas=tareasEncargado.filter(t=>hechaTarea(t.id)).length;
  const fila=(t)=>{ const done=hechaTarea(t.id), por=(tareasData[hoyStr()]||{})[t.id]; return `<div onclick="toggleTarea('${t.id}')" style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--border);cursor:pointer">
    <div style="width:22px;height:22px;border-radius:7px;border:2px solid ${done?'#34d399':'var(--border2)'};background:${done?'#34d399':'transparent'};display:flex;align-items:center;justify-content:center;font-size:13px;flex-shrink:0;color:#0b0b10">${done?'✓':''}</div>
    <div style="flex:1;font-size:13px;${done?'color:var(--muted2);text-decoration:line-through':''}">${t.emoji||'✅'} ${escH(t.label)}${done&&por&&por.por?` <span style="font-size:10px;color:var(--muted)">· ${escH(por.por)}</span>`:''}</div></div>`; };
  return `<div class="sec-hdr" style="margin-top:16px;margin-bottom:8px"><span class="sec-title">🕵️ Checklist de encargado (${hechas}/${tareasEncargado.length})</span><button class="sec-btn" onclick="abrirReportarIncidente()" style="background:#f472b6">📣 Reportar</button></div>
    <div class="card" style="margin-bottom:8px">${tareasEncargado.length?tareasEncargado.map(fila).join(''):'<div style="font-size:13px;color:var(--muted2);padding:8px 0">Sin tareas cargadas</div>'}</div>`;
}

// ============ TAREAS DEL EQUIPO (rotativas, cualquier rol) ============
// "Limpiar el baño", etc: no es de un horario fijo como tareasRecepcion, es una tarea que va rotando entre
// las personas que se elijan (de cualquier rol, admin incluido), con un conteo de cuántas veces la hizo cada
// una -- para que no le toque siempre a la misma persona.
function conteoTareaEquipo(tareaId){
  const log=tareasEquipoLog[tareaId]||{}; const c={};
  Object.values(log).forEach(x=>{ if(x&&x.userId) c[x.userId]=(c[x.userId]||0)+1; });
  return c;
}
// A quién le tocaría (la que menos veces la hizo; empate = la que hace más tiempo no la hace)
function sugeridoTareaEquipo(t){
  const c=conteoTareaEquipo(t.id), log=tareasEquipoLog[t.id]||{};
  const ultimaVez=(uid)=>Object.entries(log).filter(([,x])=>x.userId===uid).map(([f])=>f).sort().pop()||'';
  const cand=(t.equipo||[]).map(uid=>({uid,n:c[uid]||0,ult:ultimaVez(uid)}));
  cand.sort((a,b)=>a.n-b.n||a.ult.localeCompare(b.ult));
  return cand[0]||null;
}
function tareaEquipoHechaHoy(tareaId){ return !!(tareasEquipoLog[tareaId]&&tareasEquipoLog[tareaId][hoyStr()]); }
function htmlTareasEquipoWidget(){
  if(!tareasEquipoCfg.length) return '';
  const hoy=hoyStr();
  return `<div class="sec-hdr" style="margin-top:16px;margin-bottom:8px"><span class="sec-title">🔁 Tareas del equipo</span></div>
    ${tareasEquipoCfg.map(t=>{
      const hechaHoy=tareaEquipoHechaHoy(t.id), reg=hechaHoy?tareasEquipoLog[t.id][hoy]:null;
      const sug=sugeridoTareaEquipo(t), nombreSug=sug?(( allUsers.find(u=>u.id===sug.uid)||{}).name||''):'';
      return `<div class="card" style="margin-bottom:8px;padding:12px 14px">
        <div style="display:flex;align-items:center;gap:10px">
          <div style="font-size:20px">${t.emoji||'🔁'}</div>
          <div style="flex:1;min-width:0">
            <div style="font-size:13px;font-weight:700">${escH(t.label)}</div>
            <div style="font-size:11px;color:var(--muted2)">${hechaHoy?'✓ Hoy la hizo '+escH(reg.userName||'')+(reg.nota?' · '+escH(reg.nota):''):(nombreSug?'Le tocaría a '+escH(nombreSug)+' (la que menos veces la hizo)':'Sin gente asignada')}</div>
          </div>
          ${hechaHoy?'':`<button class="lnk" onclick="abrirMarcarTareaEquipo('${t.id}')">Marcar</button>`}
        </div>
      </div>`;
    }).join('')}`;
}
function abrirMarcarTareaEquipo(tareaId){
  const t=tareasEquipoCfg.find(x=>x.id===tareaId); if(!t) return;
  const sug=sugeridoTareaEquipo(t);
  const c=conteoTareaEquipo(t.id);
  document.getElementById('registro-content').innerHTML=cabeceraModal(t.emoji+' '+t.label)+
    `<div class="field"><label>¿Quién la hizo?</label><select id="te-user" style="width:100%;background:var(--s2);border:1.5px solid var(--border2);border-radius:12px;padding:12px;color:var(--text);font-family:var(--font);font-size:14px">${(t.equipo||[]).map(uid=>{ const u=allUsers.find(x=>x.id===uid); return `<option value="${uid}" ${sug&&sug.uid===uid?'selected':''}>${escH(u?u.name:uid)} (${c[uid]||0})</option>`; }).join('')}</select></div>
    <div class="field" style="margin-top:8px"><label>¿Por qué (opcional)?</label><input id="te-nota" placeholder="Ej: le tocaba a otra persona pero no estaba"/></div>
    <button class="btn btn-primary" onclick="guardarTareaEquipo('${tareaId}')" style="margin-top:14px">Marcar hecha</button>`;
  openModal('modal-registro');
}
function guardarTareaEquipo(tareaId){
  const uid=document.getElementById('te-user').value, nota=(document.getElementById('te-nota').value||'').trim();
  const u=allUsers.find(x=>x.id===uid);
  tareasEquipoLog[tareaId]=tareasEquipoLog[tareaId]||{};
  tareasEquipoLog[tareaId][hoyStr()]={userId:uid,userName:u?u.name:'',nota,ts:new Date().toISOString()};
  saveTareasEquipoLog();
  closeModal('modal-registro'); showToast('Tarea marcada ✓'); refreshCurrentView();
}
// ---------- admin: Equipo → Tareas del equipo (crear/editar, ver conteo por persona) ----------
function renderAdminTareasEquipo(c){
  const equipoTodos=allUsers.filter(u=>u.role==='admin'||u.role==='recepcionista'||esProf(u));
  c.innerHTML=`<div class="sec-hdr" style="margin:6px 0 8px"><span class="sec-title">🔁 Tareas del equipo</span><button class="lnk" onclick="abrirFormTareaEquipo('')">+ Nueva</button></div>
    <div class="card" style="margin-bottom:10px;font-size:12px;color:var(--muted2);line-height:1.5">Tareas rotativas entre las personas que elijas (de cualquier rol). Se le sugiere a quien menos veces la hizo, pero cualquiera puede marcarla y elegir quién la hizo de verdad.</div>
    ${tareasEquipoCfg.map(t=>{
      const c2=conteoTareaEquipo(t.id);
      const filas=(t.equipo||[]).map(uid=>{ const u=allUsers.find(x=>x.id===uid); return `<div class="ln"><span>${escH(u?u.name:uid)}</span><b>${c2[uid]||0}</b></div>`; }).join('');
      return `<div class="prof-card" style="margin-bottom:10px;padding:14px"><div style="display:flex;align-items:center;gap:8px;margin-bottom:8px"><div style="flex:1;font-size:14px;font-weight:800">${t.emoji||'🔁'} ${escH(t.label)}</div><button class="lnk" onclick="abrirFormTareaEquipo('${t.id}')">Editar</button><button class="lnk" style="color:#f472b6" onclick="borrarTareaEquipo('${t.id}')">Borrar</button></div>
      <div style="font-size:11px;font-weight:800;color:var(--muted);text-transform:uppercase;letter-spacing:.08em;margin-bottom:4px">Veces que la hizo cada uno</div>${filas||'<div style="font-size:12px;color:var(--muted)">Sin gente asignada</div>'}</div>`;
    }).join('')||'<div class="empty"><div class="e-icon">🔁</div><p>No hay tareas del equipo cargadas.</p></div>'}
    <div class="sec-hdr" style="margin:18px 0 8px"><span class="sec-title">🕵️ Checklist de encargado</span><button class="lnk" onclick="editarTareasEncargado()">Editar</button></div>
    <div class="card" style="margin-bottom:10px;font-size:12px;color:var(--muted2);line-height:1.5">Solo lo ve quien tenga el flag "Encargado" (se asigna en Equipo → Cuentas). Son tareas de estar atento durante el día, sin horario fijo.</div>
    <div class="card">${tareasEncargado.map(t=>`<div style="font-size:12px;padding:3px 0">${t.emoji||'✅'} ${escH(t.label)}</div>`).join('')||'<div style="font-size:12px;color:var(--muted)">Sin tareas cargadas</div>'}</div>`;
}
async function editarTareasEncargado(){
  const actuales=tareasEncargado.map(t=>(t.emoji||'✅')+' '+t.label).join('\n');
  const nuevo=await uiPrompt('Checklist de encargado',{msg:'Una tarea por línea, con el emoji adelante si querés: "⏰ Controlar que lleguen a horario". Sin horario fijo — se puede tildar en cualquier momento del día.',type:'textarea',value:actuales,ok:'Guardar'});
  if(nuevo===null) return;
  const out=[];
  nuevo.split('\n').map(l=>l.trim()).filter(Boolean).forEach((l,i)=>{
    let txt=l, emoji='✅'; const e=/^(\p{Extended_Pictographic}️?)\s*(.*)$/u.exec(txt); if(e&&e[2]){ emoji=e[1]; txt=e[2]; }
    out.push({id:'e'+(i+1),emoji,label:txt});
  });
  if(!out.length){ showToast('Necesitás al menos una tarea'); return; }
  tareasEncargado=out; saveTareasEncargado(); showToast('Checklist actualizado ✓'); renderAdmin();
}
let tareaEquipoEdit=null;
function abrirFormTareaEquipo(id){
  const t=id?tareasEquipoCfg.find(x=>x.id===id):null;
  tareaEquipoEdit=t;
  const equipoTodos=allUsers.filter(u=>u.role==='admin'||u.role==='recepcionista'||esProf(u));
  document.getElementById('registro-content').innerHTML=cabeceraModal(t?'Editar tarea':'Nueva tarea del equipo')+
    `<div class="field"><label>Emoji</label><input id="te-emoji" value="${escH(t?t.emoji||'🔁':'🔁')}" style="width:70px;text-align:center;font-size:20px"/></div>
    <div class="field" style="margin-top:8px"><label>Nombre de la tarea</label><input id="te-label" placeholder="Ej: Limpiar el baño" value="${escH(t?t.label:'')}"/></div>
    <div class="field" style="margin-top:10px"><label>¿Entre quiénes rota?</label><div style="display:flex;flex-wrap:wrap;gap:6px">${equipoTodos.map(u=>`<label class="rub-opt"><input type="checkbox" class="te-persona" value="${u.id}" ${t&&t.equipo&&t.equipo.includes(u.id)?'checked':''}/> ${escH(u.name)}</label>`).join('')||'<div style="font-size:12px;color:var(--muted)">No hay personas cargadas</div>'}</div></div>
    <button class="btn btn-primary" onclick="guardarFormTareaEquipo('${t?t.id:''}')" style="margin-top:14px">Guardar</button>`;
  openModal('modal-registro');
}
function guardarFormTareaEquipo(id){
  const emoji=(document.getElementById('te-emoji').value||'🔁').trim();
  const label=(document.getElementById('te-label').value||'').trim();
  const equipo=[...document.querySelectorAll('.te-persona:checked')].map(x=>x.value);
  if(!label){ showToast('Poné el nombre de la tarea'); return; }
  if(!equipo.length){ showToast('Elegí al menos una persona'); return; }
  const t={id:id||'te'+Date.now().toString(36),emoji,label,equipo};
  tareasEquipoCfg=id?tareasEquipoCfg.map(x=>x.id===id?t:x):[...tareasEquipoCfg,t];
  saveTareasEquipoCfg(); closeModal('modal-registro'); showToast('Guardado ✓'); renderAdmin();
}
async function borrarTareaEquipo(id){
  if(!await uiConfirm('¿Borrar esta tarea?','Se pierde el historial de quién la hizo.',{ok:'Borrar'})) return;
  tareasEquipoCfg=tareasEquipoCfg.filter(x=>x.id!==id);
  saveTareasEquipoCfg(); renderAdmin();
}
// Turnos hechos en mi franja (solo sucursales con recepcion) y cuantos reagendaron
function estadoRecHoy(u){
  const hoy=hoyStr(), w=ventanaRec(u); const turnos=[];
  allUsers.filter(x=>esProf(x)).forEach(p=>{
    let dd={}; try{ dd=JSON.parse(localStorage.getItem('luffy_dinero_'+p.id)||'{}'); }catch(e){}
    (dd.turnos||[]).filter(t=>t.fecha===hoy&&!t.deudaId&&enVentana(t.creadoEn,w)&&atiende(u||profile,t.sucursal||p.sucursal)).forEach(t=>turnos.push({key:'t:'+p.id+':'+t.id,prof:p,t}));
  });
  const cierres=cierresData.byKey||{};
  const cerrados=turnos.filter(x=>cierres[x.key]);
  const reagDe=(x)=>(cierres[x.key]&&cierres[x.key].r&&cierres[x.key].r.reagendo==='si')||(x.t.reag&&x.t.reag.estado==='si');
  const reag=turnos.filter(reagDe).length;
  const sinPreguntar=turnos.filter(x=>x.t.reag&&x.t.reag.estado==='no_pregunte').length, noQuiso=turnos.filter(x=>x.t.reag&&x.t.reag.estado==='no_quiso').length;
  const cnt=(k)=>cerrados.filter(x=>cierres[x.key].r&&cierres[x.key].r[k]==='si').length;
  return {total:turnos.length,cerrados:cerrados.length,pendientes:turnos.length-cerrados.length,reag,sinPreguntar,noQuiso,pct:turnos.length?Math.round(reag/turnos.length*100):0,resenas:cnt('resena'),senas:cnt('sena'),fideliza:cnt('fideliza'),agendados:cnt('agendado'),w,
    porSuc:sucursales.map(s=>({s,n:turnos.filter(x=>(x.t.sucursal||x.prof.sucursal)===s.id).length})).filter(x=>x.n)};
}
// Ultima visita de cada cliente, mirando los cobros de todo el equipo (una sola pasada)
function ultimasVisitas(){
  const m={};
  todosLosUsuarios().filter(u=>esProf(u)).forEach(u=>{
    let dd={}; try{ dd=JSON.parse(localStorage.getItem('luffy_dinero_'+u.id)||'{}'); }catch(e){}
    const add=(x)=>{ if(!x.clienteId) return; const y=m[x.clienteId]||(m[x.clienteId]={fecha:'',n:0,barberos:new Set()}); y.n++; y.barberos.add(u.name); if(x.fecha>y.fecha) y.fecha=x.fecha; };
    (dd.turnos||[]).filter(t=>!t.deudaId).forEach(add); (dd.deudores||[]).forEach(add);
  });
  return m;
}
// Dias sin venir: una visita real (cobrada en Luffy) siempre pisa a la estimada (importada desde AgendaPro).
// Sin visita real, se usa la estimada si el cliente la tiene cargada (ver importarVisitasEstimadas). Devuelve {dias,estimado}.
function diasSinVenirInfo(c,fechaReal){
  if(fechaReal) return {dias:diasDesdeStr(fechaReal),estimado:false};
  if(c.ultimaVisitaEstimada&&c.ultimaVisitaEstimada.fecha) return {dias:diasDesdeStr(c.ultimaVisitaEstimada.fecha),estimado:true};
  return {dias:null,estimado:false};
}
// ---------- importar "ultima visita estimada" (desde AgendaPro, ver marketing/reactivacion-clientes) ----------
// El CSV se lee y se cruza entero en el navegador de quien lo sube (FileReader + parseTabla, igual que
// abrirImportClientes en 03-clientes.js) -- nunca pasa por ninguna herramienta nuestra, solo por Supabase
// al confirmar. Cruza por telefono (10 digitos) y, si el telefono es compartido por mas de un cliente,
// desambigua por nombre; lo que no se puede resolver solo se cuenta, no se escribe (lo revisa una persona).
function filasVisitaEstimada(txt){
  const rows=parseTabla(txt); if(!rows.length) return {validos:[],sinMatch:0,ambiguos:0,total:0};
  const norm=(s)=>String(s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
  const header=rows[0].map(norm);
  const idx=(...names)=>header.findIndex(h=>names.some(n=>h===n||h.includes(n)));
  const iTel10=idx('telefono 10 digitos','10 digitos'), iTelOrig=idx('telefono original');
  const iNombre=idx('nombre'), iApellido=idx('apellido');
  const iFecha=idx('fecha ultima reserva estimada','fecha estimada'), iDiasEst=idx('dias estimados');
  const esHeader=iTel10>=0||iTelOrig>=0||iNombre>=0;
  const dataRows=esHeader?rows.slice(1):rows;
  const porTel={};
  clientesDir.forEach(c=>{ const d=String(c.tel||'').replace(/\D/g,'').slice(-10); if(d) (porTel[d]=porTel[d]||[]).push(c); });
  const hoy=new Date();
  const validos=[]; let sinMatch=0, ambiguos=0;
  dataRows.forEach(r=>{
    const telRaw=iTel10>=0?r[iTel10]:(iTelOrig>=0?r[iTelOrig]:'');
    const tel10=String(telRaw||'').replace(/\D/g,'').slice(-10);
    let fecha=iFecha>=0?String(r[iFecha]||'').trim():'';
    if(!fecha&&iDiasEst>=0){ const dd=Number(r[iDiasEst]); if(dd>0){ const f=new Date(hoy); f.setDate(f.getDate()-dd); fecha=ymdLocal(f); } }
    if(!tel10||!fecha){ sinMatch++; return; }
    const cands=porTel[tel10]||[];
    if(!cands.length){ sinMatch++; return; }
    let elegido=cands[0];
    if(cands.length>1){
      const nombreCsv=norm([iNombre>=0?r[iNombre]:'',iApellido>=0?r[iApellido]:''].filter(Boolean).join(' '));
      const porNombre=cands.filter(c=>{ const n=norm(c.nombre); return nombreCsv&&(n.includes(nombreCsv)||nombreCsv.includes(n)); });
      if(porNombre.length===1) elegido=porNombre[0]; else { ambiguos++; return; }
    }
    validos.push({cliente:elegido,fecha});
  });
  const vistos=new Set(); const finales=validos.filter(v=>!vistos.has(v.cliente.id)&&vistos.add(v.cliente.id));
  return {validos:finales,sinMatch,ambiguos,total:dataRows.length};
}
function abrirImportVisitasEstimadas(){
  const c=document.getElementById('registro-content');
  c.innerHTML=`<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px"><div class="modal-title" style="margin:0">Última visita estimada (AgendaPro)</div><button onclick="closeModal('modal-registro')" style="margin-left:auto;background:var(--s3);border:none;color:var(--muted2);font-size:18px;width:32px;height:32px;border-radius:50%;cursor:pointer">×</button></div>
    <div style="font-size:12px;color:var(--muted2);line-height:1.6;margin-bottom:10px">Subí el CSV de <b style="color:var(--text)">marketing/reactivacion-clientes/ultima-visita-estimada.csv</b>. Cruza por teléfono (y por nombre si el teléfono está repetido entre varios clientes) contra los clientes ya cargados en Luffy. Queda marcada como <b style="color:var(--text)">estimada</b>: el día que a alguien se le cobre un turno de verdad, esa visita real pasa a valer y la estimada se deja de usar sola.<br>Todo el cruce se hace en este dispositivo — nada se guarda hasta que confirmes "Importar".</div>
    <div style="display:flex;gap:8px;margin-bottom:10px">
      <label class="btn btn-ghost" style="flex:1;margin:0;padding:10px;font-size:12px;text-align:center;cursor:pointer">📂 Subir CSV<input type="file" accept=".csv,.tsv,.txt" style="display:none" onchange="importVisitasEstimadasArchivo(this)"/></label>
    </div>
    <textarea id="ive-txt" rows="7" placeholder="O pegá acá el contenido del CSV..." oninput="previewImportVisitasEstimadas()" style="${inpCss};min-height:130px"></textarea>
    <div id="ive-prev" style="font-size:12px;color:var(--muted2);margin:10px 0"></div>
    <button id="ive-btn" class="btn btn-primary" onclick="confirmarImportVisitasEstimadas()" disabled>Importar</button>`;
  openModal('modal-registro');
}
function importVisitasEstimadasArchivo(inp){
  const f=inp.files&&inp.files[0]; if(!f) return;
  const rd=new FileReader(); rd.onload=()=>{ document.getElementById('ive-txt').value=String(rd.result||''); previewImportVisitasEstimadas(); }; rd.readAsText(f,'utf-8');
}
function previewImportVisitasEstimadas(){
  const txt=document.getElementById('ive-txt')?.value||'';
  const prev=document.getElementById('ive-prev'), btn=document.getElementById('ive-btn');
  if(!txt.trim()){ prev.textContent=''; btn.disabled=true; btn.textContent='Importar'; return; }
  const {validos,sinMatch,ambiguos,total}=filasVisitaEstimada(txt);
  prev.innerHTML=`De ${total} filas: <b style="color:var(--text)">${validos.length}</b> clientes para actualizar${sinMatch?` · ${sinMatch} sin un cliente que coincida por teléfono (se saltean)`:''}${ambiguos?` · <span style="color:#fbbf24">${ambiguos} con el mismo teléfono que más de un cliente, sin que el nombre alcance para distinguir (se saltean, revisalos a mano)</span>`:''}`;
  btn.disabled=!validos.length; btn.textContent=validos.length?'Importar '+validos.length+' clientes':'Importar';
}
async function confirmarImportVisitasEstimadas(){
  const txt=document.getElementById('ive-txt')?.value||'';
  const {validos}=filasVisitaEstimada(txt); if(!validos.length) return;
  const btn=document.getElementById('ive-btn'); if(btn){ btn.disabled=true; btn.textContent='Importando…'; }
  const porId=new Map(validos.map(v=>[v.cliente.id,v.fecha]));
  await cambiarClientes(list=>{
    const ahora=new Date().toISOString();
    list.forEach(c=>{ const fecha=porId.get(c.id); if(fecha){ c.ultimaVisitaEstimada={fecha}; c.upd=ahora; } });
  });
  closeModal('modal-registro'); showToast(validos.length+' clientes actualizados con su última visita estimada ✓'); renderAdmin();
}
function linkWhatsApp(tel,txt){ const d=String(tel||'').replace(/\D/g,'').replace(/^0+/,'').replace(/^54/,'').replace(/^9/,''); return d?'https://wa.me/549'+d+(txt?'?text='+encodeURIComponent(txt):''):''; }
let recQ='';
function recRenderBusqueda(){
  const el=document.getElementById('rec-cli-res'); if(!el) return;
  const uv=ultimasVisitas(); const q=recQ.trim();
  if(q.length<2){ el.innerHTML=`<div style="font-size:11.5px;color:var(--muted2)">Escribí al menos 2 letras del nombre, el número (#) o el teléfono. Hay ${clientesDir.length} clientes cargados.</div>`; return; }
  const m=buscarClientes(q).slice(0,8);
  el.innerHTML=m.length?m.map(c=>{ const u=uv[c.id]; const est=!u&&c.ultimaVisitaEstimada&&c.ultimaVisitaEstimada.fecha?diasDesdeStr(c.ultimaVisitaEstimada.fecha):null; return `<div class="card" onclick="abrirClienteDetalle('${c.id}')" style="cursor:pointer;margin-bottom:6px;padding:10px 12px"><div style="display:flex;gap:8px;align-items:center"><div style="flex:1;min-width:0"><div style="font-size:13.5px;font-weight:800">${escH(c.nombre)} <span style="color:var(--muted2)">#${c.numero}</span>${(c.tarjetas&&c.tarjetas.length)?' 💳':''}${membresiaActivaDe(c.id)?' 🎫':''}</div>
    <div style="font-size:11px;color:var(--muted2)">${escH(idCorto(c))}</div><div style="font-size:11px;color:var(--muted2)">${u?`✂️ ${escH([...u.barberos].join(', '))} · ${u.n} ${u.n===1?'visita':'visitas'} · última hace ${diasDesdeStr(u.fecha)} d`:(est!=null?'Sin cobros en Luffy · estimado hace '+est+' d (AgendaPro)':'Sin visitas todavía')}</div></div><span style="color:var(--muted)">›</span></div></div>`; }).join(''):`<div style="font-size:12.5px;color:var(--muted2)">No aparece. Tocá "+ Cliente" para cargarlo.</div>`;
}
function marcarCumpleCliente(cid){
  const k=new Date().getFullYear()+':'+cid; if(!recData.cumpleCli) recData.cumpleCli={};
  recData.cumpleCli[k]=!recData.cumpleCli[k];
  if(recData.cumpleCli[k]){ addPuntos(profile.id,'cumple',ptsDe('cumple',20),'Cumpleaños contactado','cumplecli:'+k); showToast('+'+ptsDe('cumple',20)+' puntos ⭐'); }
  saveRecData(); renderRecepcion();
}
function proximosCumplesManual(){
  const today=new Date();
  return (recData.cumpleanos||[]).filter(c=>{
    if(!c.fecha) return false;
    const [mes,dia]=c.fecha.split('-').map(Number);
    for(let i=0;i<3;i++){
      const d=new Date(today); d.setDate(today.getDate()+i);
      if(d.getMonth()+1===mes&&d.getDate()===dia) return true;
    }
    return false;
  });
}
function htmlCumplesRec(proxCumples){
  proxCumples=proxCumples||proximosCumplesManual();
  const cli=cumplesClientes(3);
  const manual=proxCumples.map(c=>`<div class="card" style="margin-bottom:8px;display:flex;align-items:center;gap:12px"><div style="font-size:28px">🎂</div><div style="flex:1"><div style="font-size:13px;font-weight:700">${escH(c.nombre)}</div><div style="font-size:11px;color:var(--muted2)">${escH(c.fecha)} · ${escH(c.telefono||'Sin teléfono')}</div></div><button onclick="marcarCumple('${c.id}')" style="padding:8px 14px;border-radius:10px;border:none;background:${c.contactado?'rgba(52,211,153,.15)':'var(--s2)'};color:${c.contactado?'#34d399':'var(--muted2)'};font-family:var(--font);font-size:12px;font-weight:700;cursor:pointer">${c.contactado?'✓ Saludado':'Saludar'}</button></div>`).join('');
  const deCli=cli.map(({c,en})=>{ const k=new Date().getFullYear()+':'+c.id, ok=!!(recData.cumpleCli&&recData.cumpleCli[k]); const wa=linkWhatsApp(c.tel,'¡Feliz cumpleaños '+c.nombre.split(' ')[0]+'! 🎉 De parte de todo el equipo de Inda Studio. Como regalo, tenés '+CUMPLE_DESC_PCT+'% off en tu próximo turno — válido hoy y los próximos '+CUMPLE_DESC_DIAS+' días 🎂💈');
    return `<div class="card" style="margin-bottom:8px;display:flex;align-items:center;gap:12px"><div style="font-size:28px">🎂</div><div style="flex:1;min-width:0" onclick="abrirClienteDetalle('${c.id}')"><div style="font-size:13px;font-weight:700">${escH(c.nombre)} <span style="color:var(--muted2)">#${c.numero}</span></div><div style="font-size:11px;color:var(--muted2)">${en===0?'<b style="color:#fbbf24">¡Hoy!</b>':en===1?'Mañana':'En '+en+' días'} · ${cumpleTxt(c.cumple)}</div></div>${wa?`<a href="${wa}" target="_blank" rel="noopener" style="padding:8px 10px;border-radius:10px;background:rgba(52,211,153,.15);color:#34d399;font-size:12px;font-weight:800;text-decoration:none">WhatsApp</a>`:''}<button onclick="marcarCumpleCliente('${c.id}')" style="padding:8px 12px;border-radius:10px;border:none;background:${ok?'rgba(52,211,153,.15)':'var(--s2)'};color:${ok?'#34d399':'var(--muted2)'};font-family:var(--font);font-size:12px;font-weight:700;cursor:pointer">${ok?'✓ Saludado':'Saludar'}</button></div>`; }).join('');
  return `<div class="sec-hdr" style="margin-bottom:10px"><span class="sec-title">🎂 Cumpleaños próximos</span></div>${(manual||deCli)?manual+deCli:'<div class="card" style="text-align:center;color:var(--muted);font-size:13px;padding:20px">Sin cumpleaños en los próximos 3 días 🎉</div>'}`;
}

// ============ CRM: clientes agrupados por hace cuanto no vienen, para armar listas de WhatsApp ============
// Fecha de "ultima visita" = la que ya calcula Luffy (ultimasVisitas), no depende de AgendaPro.
// Una sola pantalla para las dos sucursales, porque el WhatsApp del negocio es un solo numero centralizado.
const FRANJAS_CRM=[
  ['activos','🟢 Activos','0 a 15 días',0,15],
  ['espera','🔵 Turno reservado','ya tiene turno agendado',null,null],
  ['porperder','🟡 Por perder','16 a 30 días',16,30],
  ['inactivos','🟠 Inactivos','31 a 60 días',31,60],
  ['perdidos','🔴 Perdidos','+60 días',61,Infinity],
  ['sin','⚪ Sin visitas en Luffy','nunca se les cobró un turno acá',null,null],
  ['problema','🗑️ Problemáticos','marcados a mano',null,null],
];
const MSJ_CRM={
  porperder:(n)=>'Hola '+n+'! Te escribimos de Inda Studio 💈 Hace unas semanas que no te vemos, ¿te reservamos un turno?',
  inactivos:(n)=>'Hola '+n+'! Te extrañamos en Inda Studio 💈 Hace un tiempo que no venís, ¿querés que te consigamos un turno?',
  // 25% solo para +1 año sin venir (confirmado por Ivo, corregido 2/10/2026 — antes se lo ofrecia a toda la franja 61+ dias por error).
  // De 61 dias a 1 año: mismo recordatorio sin descuento que "En riesgo" (ver marketing/reactivacion-clientes/mensajes.md).
  perdidos:(n,dias)=>(dias!=null&&dias>365)
    ?'Hola '+n+' 👋 Somos INDA (antes Inda House). Hace tiempo que no te vemos y queremos que vuelvas — te dejamos un 25% en tu próximo servicio, válido los próximos 30 días, sin vueltas. Nosotros te separamos el turno, vos elegís el día. ¿Arrancamos esta semana?'
    :'Hola '+n+'! Desde INDA queríamos saber cómo estás — hace un tiempito no te vemos. Tenemos lugar esta semana si querés retomar tu corte/tratamiento de siempre. ¿Te reservamos un horario?',
  sin:(n)=>'Hola '+n+'! Te escribimos de Inda Studio 💈 ¿Te gustaría reservar un turno?',
  espera:()=>'', problema:()=>'',
};
function franjaCRM(dias){
  if(dias==null) return 'sin';
  const f=FRANJAS_CRM.find(x=>x[3]!=null&&dias>=x[3]&&dias<=x[4]);
  return f?f[0]:'perdidos';
}
// Estado automatico del cliente: si esta marcado o tiene un turno futuro agendado, eso pesa mas que los dias sin venir
function clienteTieneTurnoFuturo(cid){
  const hoy=hoyStr();
  return agendaSt.list.some(a=>a.clienteId===cid&&a.fecha>=hoy&&agEsActivo(a));
}
function franjaClienteCRM(c,dias){
  if(c.crmManual) return c.crmManual;
  if(c.problematico) return 'problema';
  if(clienteTieneTurnoFuturo(c.id)) return 'espera';
  return franjaCRM(dias);
}
const CRM_COL_COLOR={activos:'#34d399',espera:'#60a5fa',porperder:'#fbbf24',inactivos:'#fb923c',perdidos:'#f472b6',sin:'#9ca3af',problema:'#6b7280'};
let crmFranja='porperder', crmQ='', crmTarget='crmboard-body', crmVista='tablero';
let crmColVisible={};
const CRM_COL_PAGE=20;
let crmFiltros=null, crmFiltrosAbierto=false;
const CRM_GENEROS=[['M','Masculino'],['F','Femenino'],['X','Otro'],['','Sin dato']];
const CRM_ESTADOS_RES=[['','Todos'],['agendado','Agendado'],['hecho','Hecho'],['cancelado','Cancelado'],['sin-agenda','Sin nada en la Agenda']];
// Reune, en una sola pasada, sucursales/profesionales/servicios/fechas de cada cliente para los filtros avanzados del CRM
function datosCRM(){
  const m={};
  const get=(cid)=>m[cid]||(m[cid]={fecha:'',sucursales:new Set(),profIds:new Set(),servicioIds:new Set(),fechas:[]});
  todosLosUsuarios().filter(u=>esProf(u)).forEach(u=>{
    let dd={}; try{ dd=JSON.parse(localStorage.getItem('luffy_dinero_'+u.id)||'{}'); }catch(e){}
    const add=(x)=>{
      if(!x.clienteId) return;
      const y=get(x.clienteId);
      y.profIds.add(u.id);
      if(x.fecha>y.fecha) y.fecha=x.fecha;
      if(x.fecha) y.fechas.push(x.fecha);
      const sid=x.sucursal||u.sucursal; if(sid) y.sucursales.add(sid);
      (x.servicios||[]).forEach(s=>{ if(s&&s.id) y.servicioIds.add(s.id); });
    };
    (dd.turnos||[]).filter(t=>!t.deudaId).forEach(add);
    (dd.deudores||[]).forEach(add);
  });
  return m;
}
function estadosAgendaCRM(){
  const m={};
  agendaSt.list.forEach(a=>{ if(!a.clienteId) return; (m[a.clienteId]=m[a.clienteId]||new Set()).add(agEstado(a)); });
  return m;
}
function mmddFiltro(d,m){ return d&&m?pad2(Number(m))+'-'+pad2(Number(d)):''; }
function enRangoMMDD(cumple,desde,hasta){
  if(!cumple) return false;
  const d=desde||'01-01', h=hasta||'12-31';
  return d<=h?(cumple>=d&&cumple<=h):(cumple>=d||cumple<=h);
}
function crmFiltroActivo(f){ return !!(f&&(f.sucursales.length||f.profesionales.length||f.servicios.length||f.estadoReserva||f.generos.length||f.cumpleDesde||f.cumpleHasta||f.creadoDesde||f.creadoHasta||f.haReservado||f.nota)); }
function clientePasaFiltros(c,datos,estAg,f){
  const d=datos[c.id];
  if(f.sucursales.length&&!(d&&f.sucursales.some(s=>d.sucursales.has(s)))) return false;
  if(f.profesionales.length&&!(d&&f.profesionales.some(p=>d.profIds.has(p)))) return false;
  if(f.servicios.length&&!(d&&f.servicios.some(s=>d.servicioIds.has(s)))) return false;
  if(f.estadoReserva){
    const est=estAg[c.id];
    if(f.estadoReserva==='sin-agenda'){ if(est&&est.size) return false; }
    else if(!est||!est.has(f.estadoReserva)) return false;
  }
  if(f.generos.length&&!f.generos.includes(c.genero||'')) return false;
  if((f.cumpleDesde||f.cumpleHasta)&&!enRangoMMDD(c.cumple,f.cumpleDesde,f.cumpleHasta)) return false;
  if(f.creadoDesde&&String(c.creado||'').slice(0,10)<f.creadoDesde) return false;
  if(f.creadoHasta&&String(c.creado||'').slice(0,10)>f.creadoHasta) return false;
  if(f.haReservado){
    const fechas=(d&&d.fechas)||[];
    const enRango=fechas.some(fe=>(!f.haDesde||fe>=f.haDesde)&&(!f.haHasta||fe<=f.haHasta));
    if(f.haReservado==='si'&&!enRango) return false;
    if(f.haReservado==='no'&&enRango) return false;
  }
  if(f.nota&&!String(c.nota||'').toLowerCase().includes(f.nota)) return false;
  return true;
}
function crmAplicarFiltros(){
  const checked=(name)=>[...document.querySelectorAll(`input[name="${name}"]:checked`)].map(x=>x.value);
  const val=(id)=>document.getElementById(id)?.value||'';
  const svcSel=document.getElementById('cf-svc');
  crmFiltrosAbierto=true;
  crmFiltros={
    sucursales:checked('cf-suc'), profesionales:checked('cf-prof'),
    servicios:svcSel?[...svcSel.selectedOptions].map(o=>o.value):[],
    estadoReserva:val('cf-estado'), generos:checked('cf-genero'),
    cumpleDesde:mmddFiltro(val('cf-cd1'),val('cf-cm1')), cumpleHasta:mmddFiltro(val('cf-cd2'),val('cf-cm2')),
    creadoDesde:val('cf-creado-desde'), creadoHasta:val('cf-creado-hasta'),
    haReservado:val('cf-ha'), haDesde:val('cf-ha-desde'), haHasta:val('cf-ha-hasta'),
    nota:val('cf-nota').trim().toLowerCase()
  };
  renderCRM();
}
function crmLimpiarFiltros(){ crmFiltros=null; renderCRM(); }
function htmlFiltrosCRM(f){
  const chk=(name,value,label,on)=>`<label style="display:inline-flex;align-items:center;gap:5px;font-size:12px;background:var(--s2);border:1.5px solid var(--border2);border-radius:10px;padding:6px 10px;margin:2px;cursor:pointer"><input type="checkbox" name="${name}" value="${value}" ${on?'checked':''} style="margin:0"/> ${escH(label)}</label>`;
  const selSt='background:var(--s2);border:1.5px solid var(--border2);border-radius:10px;padding:9px 10px;color:var(--text);font-family:var(--font);font-size:13px';
  const dSel=(id,sel)=>`<select id="${id}" style="${selSt};flex:1"><option value="">Día</option>${Array.from({length:31},(_,i)=>`<option value="${i+1}" ${Number(sel)===i+1?'selected':''}>${i+1}</option>`).join('')}</select>`;
  const mSel=(id,sel)=>`<select id="${id}" style="${selSt};flex:1"><option value="">Mes</option>${MESES.map((n,i)=>`<option value="${i+1}" ${Number(sel)===i+1?'selected':''}>${n}</option>`).join('')}</select>`;
  const profs=allUsers.filter(u=>esProf(u));
  const porRubro={}; servicios.forEach(s=>{ (porRubro[s.rubro||'']=porRubro[s.rubro||'']||[]).push(s); });
  const cd1=(f&&f.cumpleDesde?f.cumpleDesde:'-').split('-'), cd2=(f&&f.cumpleHasta?f.cumpleHasta:'-').split('-');
  return `<div style="font-size:12px;font-weight:800;margin-bottom:8px">📍 Local/sede</div>
    <div style="margin-bottom:10px">${sucursales.map(s=>chk('cf-suc',s.id,s.nombre,!!(f&&f.sucursales.includes(s.id)))).join('')}</div>
    <div style="font-size:12px;font-weight:800;margin-bottom:8px">✂️ Profesional</div>
    <div style="margin-bottom:10px">${profs.map(p=>chk('cf-prof',p.id,p.name,!!(f&&f.profesionales.includes(p.id)))).join('')}</div>
    <div style="font-size:12px;font-weight:800;margin-bottom:8px">🧾 Servicios</div>
    <select id="cf-svc" multiple style="${selSt};width:100%;height:110px;margin-bottom:10px">${Object.entries(porRubro).map(([r,L])=>`<optgroup label="${escH(nombreRubro(r)||'Otros')}">${L.map(s=>`<option value="${s.id}" ${f&&f.servicios.includes(s.id)?'selected':''}>${escH(s.nombre)}</option>`).join('')}</optgroup>`).join('')}</select>
    <div style="font-size:12px;font-weight:800;margin-bottom:6px">📅 Estado de la reserva (Agenda)</div>
    <select id="cf-estado" style="${selSt};width:100%;margin-bottom:10px">${CRM_ESTADOS_RES.map(([v,l])=>`<option value="${v}" ${f&&f.estadoReserva===v?'selected':''}>${l}</option>`).join('')}</select>
    <div style="font-size:12px;font-weight:800;margin-bottom:8px">⚧ Género</div>
    <div style="margin-bottom:10px">${CRM_GENEROS.map(([v,l])=>chk('cf-genero',v,l,!!(f&&f.generos.includes(v)))).join('')}</div>
    <div style="font-size:12px;font-weight:800;margin-bottom:6px">🎂 Cumpleaños entre</div>
    <div style="display:flex;gap:6px;margin-bottom:10px">${dSel('cf-cd1',cd1[1])}${mSel('cf-cm1',cd1[0])}<span style="align-self:center;color:var(--muted2)">y</span>${dSel('cf-cd2',cd2[1])}${mSel('cf-cm2',cd2[0])}</div>
    <div style="font-size:12px;font-weight:800;margin-bottom:6px">🆕 Cliente creado entre</div>
    <div style="display:flex;gap:6px;margin-bottom:10px"><input id="cf-creado-desde" type="date" value="${f?f.creadoDesde||'':''}" style="${selSt};flex:1"/><input id="cf-creado-hasta" type="date" value="${f?f.creadoHasta||'':''}" style="${selSt};flex:1"/></div>
    <div style="font-size:12px;font-weight:800;margin-bottom:6px">🔁 ¿Ha reservado?</div>
    <div style="display:flex;gap:6px;margin-bottom:6px"><select id="cf-ha" style="${selSt};flex:1"><option value="">Cualquiera</option><option value="si" ${f&&f.haReservado==='si'?'selected':''}>Sí</option><option value="no" ${f&&f.haReservado==='no'?'selected':''}>No</option></select><input id="cf-ha-desde" type="date" value="${f?f.haDesde||'':''}" style="${selSt};flex:1"/><input id="cf-ha-hasta" type="date" value="${f?f.haHasta||'':''}" style="${selSt};flex:1"/></div>
    <div style="font-size:11px;color:var(--muted2);margin-bottom:10px">Ej: "No" + últimos 60 días = no vino en esos 60 días (base para reactivación).</div>
    <div style="font-size:12px;font-weight:800;margin-bottom:6px">🔎 Personalizado (busca en las notas del cliente)</div>
    <input id="cf-nota" placeholder="Ej: fade, alérgico, VIP…" value="${f?escH(f.nota||''):''}" style="${selSt};width:100%;margin-bottom:12px"/>
    <div style="display:flex;gap:8px"><button class="btn btn-primary" style="flex:1;margin:0" onclick="crmAplicarFiltros()">Aplicar filtros</button>${crmFiltroActivo(f)?`<button class="lnk" onclick="crmLimpiarFiltros()">Limpiar</button>`:''}</div>`;
}
function abrirCRM(){ goTo('crmboard'); }
function crmSet(f){ crmFranja=f; renderCRM(); }
function crmBuscar(v){ crmQ=v; renderCRM(); }
// admin la usa como sub-pestaña de Clientes: renderiza directo en el contenedor "c", sin modal
function adminCRM(c){
  crmTarget='crm-admin-body';
  c.innerHTML=`<div class="sec-hdr" style="margin:6px 0 8px"><span class="sec-title">📱 CRM · Reactivación por WhatsApp</span>${profile.role==='admin'?`<button class="lnk" onclick="abrirImportVisitasEstimadas()">📅 Última visita estimada</button>`:''}</div>
    <div style="font-size:12px;color:var(--muted2);margin-bottom:10px;line-height:1.5">Agrupa a todos los clientes según hace cuánto no vienen, para armar las listas de WhatsApp. Es la misma lista para las dos sucursales (el WhatsApp del negocio es un solo número).</div>
    <div id="crm-admin-body"></div>`;
  renderCRM();
}
// Membresias a las que le queda 1 credito nomas, o que vencen (30 dias) en 5 dias o menos con creditos sin
// usar -- avisar antes de que se quede sin nada o se le venza, para que renueve o venga a usarla.
function membresiasPorVencer(){
  const out=[]; const hoy=hoyStr();
  membresiasSt.list.forEach(m=>{
    const restantes=numV(m.creditos)-(m.usos||[]).length; if(restantes<=0) return;
    if(m.vence&&m.vence<hoy) return; // ya vencida: no tiene sentido avisar para que la use, ya la perdio
    const diasVence=m.vence?diasEntre(hoy,m.vence):null;
    if(restantes===1||(diasVence!=null&&diasVence<=5)){ const c=clienteDe(m.clienteId); if(c) out.push({c,m,restantes,diasVence}); }
  });
  return out;
}
function htmlMembresiasPorVencerRec(){
  const L=membresiasPorVencer();
  if(!L.length) return '<div class="card" style="text-align:center;color:var(--muted);font-size:13px;padding:20px">Nadie está por quedarse sin cortes 🎉</div>';
  return L.map(({c,restantes,diasVence})=>{
    const porDias=diasVence!=null&&diasVence<=5;
    const motivo=porDias?'Vence en '+(diasVence<=0?'menos de 1 día':diasVence+' día'+(diasVence===1?'':'s'))+' · le quedan '+restantes+' sin usar':'Le queda '+restantes+' corte';
    const wa=linkWhatsApp(c.tel,'Hola '+c.nombre.split(' ')[0]+'! '+(porDias?'Tu membresía de Inda Studio está por vencer y todavía te quedan '+restantes+' corte'+(restantes===1?'':'s')+' sin usar 💈 ¿Coordinamos antes de que se pierdan?':'Te queda '+restantes+' corte en tu membresía de Inda Studio 💈 ¿Querés renovarla para no quedarte sin nada?'));
    return `<div class="card" style="margin-bottom:8px;display:flex;align-items:center;gap:12px"><div style="font-size:28px">💳</div><div style="flex:1;min-width:0" onclick="abrirClienteDetalle('${c.id}')"><div style="font-size:13px;font-weight:700">${escH(c.nombre)} <span style="color:var(--muted2)">#${c.numero}</span></div><div style="font-size:11px;color:var(--muted2)">${motivo}</div></div>${wa?`<a href="${wa}" target="_blank" rel="noopener" style="padding:8px 10px;border-radius:10px;background:rgba(52,211,153,.15);color:#34d399;font-size:12px;font-weight:800;text-decoration:none">WhatsApp</a>`:''}</div>`; }).join('');
}
function htmlParaContactarRec(){
  const L=contactosPendientesSt.list.filter(x=>!x.atendido).sort((a,b)=>String(b.creadoEn).localeCompare(String(a.creadoEn)));
  if(!L.length) return '<div class="card" style="text-align:center;color:var(--muted);font-size:13px;padding:20px">Nada pendiente por ahora 🎉</div>';
  return L.map(x=>{ const c=clienteDe(x.clienteId); const wa=c?linkWhatsApp(c.tel,'Hola '+x.clienteNombre.split(' ')[0]+'! Somos Inda Studio 💈 Vimos tu comentario y queríamos saber qué pasó, para poder mejorarlo. ¿Tenés un minuto?'):''; return `<div class="card" style="margin-bottom:8px;display:flex;align-items:center;gap:12px"><div style="font-size:28px">📞</div><div style="flex:1;min-width:0" ${c?`onclick="abrirClienteDetalle('${c.id}')"`:''}><div style="font-size:13px;font-weight:700">${escH(x.clienteNombre)}</div><div style="font-size:11px;color:var(--muted2)">${escH(x.razon)} · ${fechaCortaStr(x.fecha)}</div></div>${wa?`<a href="${wa}" target="_blank" rel="noopener" style="padding:8px 10px;border-radius:10px;background:rgba(52,211,153,.15);color:#34d399;font-size:12px;font-weight:800;text-decoration:none">WhatsApp</a>`:''}<button onclick="marcarContactado('${x.id}')" style="padding:8px 10px;border-radius:10px;border:none;background:var(--s2);color:var(--muted2);font-family:var(--font);font-size:11.5px;font-weight:700;cursor:pointer">✓ Listo</button></div>`; }).join('');
}
async function marcarContactado(id){
  await contactosPendientesSt.cambiar(l=>{ const x=l.find(z=>z.id===id); if(x){ x.atendido=true; x.upd=new Date().toISOString(); } });
  showToast('Marcado como contactado ✓'); renderCRM();
}
function crmSetVista(v){ crmVista=v; renderCRM(); }
// ---------- tablero del CRM: columnas por franja, tarjetas arrastrables (mouse y touch via Pointer Events) ----------
function crmClientesDeCol(franja){
  const uv=ultimasVisitas();
  const q=nkey(crmQ);
  let todos=clientesDir.map(c=>{ const u=uv[c.id]; const {dias,estimado}=diasSinVenirInfo(c,u&&u.fecha); return {c,dias,estimado,franja:franjaClienteCRM(c,dias)}; });
  if(q) todos=todos.filter(x=>x.c.nkey.includes(q)||String(x.c.tel||'').replace(/\D/g,'').includes(q.replace(/\D/g,'')));
  return todos.filter(x=>x.franja===franja).sort((a,b)=>(a.dias==null?1e9:a.dias)-(b.dias==null?1e9:b.dias));
}
// Scroll infinito por columna en vez de barra de scroll + tope fijo: mas prolijo en el celular.
function crmColScroll(el,franja){
  if(el.scrollTop+el.clientHeight<el.scrollHeight-80) return;
  const col=crmClientesDeCol(franja);
  const cur=crmColVisible[franja]||CRM_COL_PAGE;
  if(cur>=col.length) return;
  const color=CRM_COL_COLOR[franja]||'var(--muted2)';
  const next=col.slice(cur,cur+CRM_COL_PAGE);
  crmColVisible[franja]=cur+next.length;
  el.insertAdjacentHTML('beforeend',next.map(({c,dias,estimado})=>crmCardHtml(c,dias,franja,color,estimado)).join(''));
}
function renderCRMTablero(el){
  if(!el) return;
  crmColVisible={};
  const uv=ultimasVisitas();
  const q=nkey(crmQ);
  let todos=clientesDir.map(c=>{ const u=uv[c.id]; const {dias,estimado}=diasSinVenirInfo(c,u&&u.fecha); return {c,dias,estimado,franja:franjaClienteCRM(c,dias)}; });
  if(q) todos=todos.filter(x=>x.c.nkey.includes(q)||String(x.c.tel||'').replace(/\D/g,'').includes(q.replace(/\D/g,'')));
  const total=todos.length;
  el.innerHTML=`<div style="display:flex;align-items:center;gap:8px;padding:0 20px 12px;flex-wrap:wrap">
      <div style="font-size:13px;font-weight:800">${total} cliente${total===1?'':'s'}</div>
      <div style="display:flex;gap:6px;flex-wrap:wrap">${FRANJAS_CRM.map(([f,l])=>{
        const n=todos.filter(x=>x.franja===f).length; const color=CRM_COL_COLOR[f]||'var(--muted2)';
        return `<span style="font-size:10.5px;font-weight:800;padding:3px 9px;border-radius:20px;background:${color}1f;color:${color}">${l.replace(/^\S+\s/,'')} · ${n}</span>`;
      }).join('')}</div>
    </div>
    <div class="kanban-scroll" style="padding:0 20px 4px">${FRANJAS_CRM.map(([f,l])=>{
    const col=todos.filter(x=>x.franja===f).sort((a,b)=>(a.dias==null?1e9:a.dias)-(b.dias==null?1e9:b.dias));
    crmColVisible[f]=Math.min(CRM_COL_PAGE,col.length);
    const mostrar=col.slice(0,crmColVisible[f]);
    const color=CRM_COL_COLOR[f]||'var(--muted2)';
    return `<div class="kanban-col" style="flex:1 1 230px;min-width:230px;width:auto">
      <div class="kanban-col-hdr" style="background:${color}14;border-radius:10px;padding:8px 10px;justify-content:space-between">
        <div style="display:flex;align-items:center;gap:6px;color:${color}"><div style="width:8px;height:8px;border-radius:50%;background:${color}"></div>${l}</div>
        <span style="background:${color};color:#fff;border-radius:20px;padding:1px 8px;font-size:10px">${col.length}</span>
      </div>
      <div class="crm-kcol-body" data-franja="${f}" onscroll="crmColScroll(this,'${f}')">
        ${mostrar.map(({c,dias,estimado})=>crmCardHtml(c,dias,f,color,estimado)).join('')||`<div style="text-align:center;color:var(--muted);font-size:11.5px;padding:14px 6px">Sin clientes</div>`}
      </div>
    </div>`;
  }).join('')}</div>
  <div style="font-size:11px;color:var(--muted2);margin:2px 20px 0">Tocá y arrastrá una tarjeta para moverla de columna. Tocarla sin arrastrar abre la ficha del cliente.</div>`;
}
function inicialesCliente(nombre){
  const p=String(nombre||'').trim().split(/\s+/);
  return ((p[0]?.[0]||'')+(p[1]?.[0]||'')).toUpperCase()||'?';
}
function crmCardHtml(c,dias,franja,color,estimado){
  const msjFn=MSJ_CRM[franja]||MSJ_CRM.sin;
  const wa=linkWhatsApp(c.tel,msjFn(c.nombre.split(' ')[0],dias));
  return `<div class="crm-kcard" style="border-left:3px solid ${color}" onpointerdown="crmPointerDown(event,'${c.id}')">
    <div style="display:flex;align-items:flex-start;gap:8px">
      <div style="flex:1;min-width:0">
        <div style="font-size:12.5px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escH(c.nombre)}${c.crmManual?' 📌':''}</div>
        <div style="font-size:10.5px;color:var(--muted2);margin-top:2px">${dias==null?'Sin visitas':'hace '+dias+' días'}${estimado?' (estimado)':''}${c.tel?'':' · sin teléfono'}</div>
      </div>
      <div style="width:24px;height:24px;border-radius:50%;background:${color}26;color:${color};display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:800;flex-shrink:0">${inicialesCliente(c.nombre)}</div>
    </div>
    ${wa?`<a href="${wa}" target="_blank" rel="noopener" style="display:inline-block;margin-top:8px;padding:5px 9px;border-radius:8px;background:rgba(52,211,153,.15);color:#34d399;font-size:10.5px;font-weight:800;text-decoration:none">WhatsApp</a>`:''}
  </div>`;
}
let crmDrag=null;
function crmPointerDown(e,cid){
  if(e.button!=null&&e.button!==0) return;
  if(e.target.closest('a,button')) return;
  const card=e.currentTarget;
  crmDrag={cid,startX:e.clientX,startY:e.clientY,moved:false,card,ghost:null,pointerId:e.pointerId,scrollEl:card.closest('.kanban-scroll'),scrollDir:0,scrollTimer:null};
  try{ card.setPointerCapture(e.pointerId); }catch(err){}
  card.addEventListener('pointermove',crmPointerMove);
  card.addEventListener('pointerup',crmPointerUp);
  card.addEventListener('pointercancel',crmPointerEnd);
}
function crmPointerMove(e){
  if(!crmDrag) return;
  const d=crmDrag;
  const dx=e.clientX-d.startX, dy=e.clientY-d.startY;
  if(!d.moved){
    if(Math.hypot(dx,dy)<8) return;
    d.moved=true;
    const r=d.card.getBoundingClientRect();
    const ghost=d.card.cloneNode(true);
    ghost.className='crm-kcard crm-drag-ghost';
    ghost.style.width=r.width+'px';
    document.body.appendChild(ghost);
    d.ghost=ghost; d.offX=d.startX-r.left; d.offY=d.startY-r.top;
    d.card.classList.add('dragging');
  }
  if(d.ghost){
    d.ghost.style.left=(e.clientX-d.offX)+'px';
    d.ghost.style.top=(e.clientY-d.offY)+'px';
    document.querySelectorAll('.crm-kcol-body.drop-target').forEach(x=>x.classList.remove('drop-target'));
    const under=document.elementFromPoint(e.clientX,e.clientY);
    const col=under&&under.closest('.crm-kcol-body');
    if(col) col.classList.add('drop-target');
    crmAutoScroll(e.clientX);
  }
}
// El tablero hace scroll horizontal (7 columnas no entran juntas en pantalla): sin esto, arrastrar de una punta a la otra era imposible.
function crmAutoScroll(clientX){
  const d=crmDrag; if(!d||!d.scrollEl) return;
  const r=d.scrollEl.getBoundingClientRect(), edge=44;
  let dir=0;
  if(clientX<r.left+edge) dir=-1;
  else if(clientX>r.right-edge) dir=1;
  if(dir===d.scrollDir) return;
  d.scrollDir=dir;
  if(d.scrollTimer){ clearInterval(d.scrollTimer); d.scrollTimer=null; }
  if(dir) d.scrollTimer=setInterval(()=>{ d.scrollEl.scrollLeft+=dir*14; },16);
}
function crmPointerEnd(e){
  if(!crmDrag) return;
  const d=crmDrag;
  d.card.removeEventListener('pointermove',crmPointerMove);
  d.card.removeEventListener('pointerup',crmPointerUp);
  d.card.removeEventListener('pointercancel',crmPointerEnd);
  if(d.ghost) d.ghost.remove();
  if(d.scrollTimer) clearInterval(d.scrollTimer);
  d.card.classList.remove('dragging');
  document.querySelectorAll('.crm-kcol-body.drop-target').forEach(x=>x.classList.remove('drop-target'));
  crmDrag=null;
  return d;
}
function crmPointerUp(e){
  const d=crmPointerEnd(e); if(!d) return;
  if(!d.moved){ abrirClienteDetalle(d.cid); return; }
  const under=document.elementFromPoint(e.clientX,e.clientY);
  const col=under&&under.closest('.crm-kcol-body');
  if(col&&col.dataset.franja) crmMoverManual(d.cid,col.dataset.franja);
  else renderCRM();
}
async function crmMoverManual(cid,franja){
  const c=clienteDe(cid); if(!c) return;
  if(c.crmManual===franja||(franja==='problema'&&c.problematico&&!c.crmManual)){ renderCRM(); return; }
  if(franja==='problema'){
    await cambiarClientes(list=>{ const x=list.find(z=>z.id===cid); if(x){ x.problematico=true; x.crmManual=null; x.upd=new Date().toISOString(); } });
  } else {
    await cambiarClientes(list=>{ const x=list.find(z=>z.id===cid); if(x){ if(x.problematico) x.problematico=false; x.crmManual=franja; x.upd=new Date().toISOString(); } });
  }
  showToast('Movido a '+(FRANJAS_CRM.find(f=>f[0]===franja)||[,franja])[1].replace(/^\S+\s/,'')+' ✓');
  renderCRM();
}
async function crmQuitarPin(id){
  await cambiarClientes(list=>{ const x=list.find(z=>z.id===id); if(x){ x.crmManual=null; x.upd=new Date().toISOString(); } });
  showToast('Vuelve a calcularse solo ✓');
  abrirClienteDetalle(id);
}
function htmlBuscadorCRM(){
  return `<input type="search" placeholder="Buscar por nombre o teléfono..." value="${escH(crmQ)}" oninput="crmBuscar(this.value)" style="width:100%;background:var(--s1);border:1.5px solid var(--border2);border-radius:12px;padding:11px 14px;color:var(--text);font-family:var(--font);font-size:14px;margin-bottom:10px"/>`;
}
let crmCumplesAbierto=false, crmMembresiasAbierto=false, crmContactarAbierto=false;
function abrirCRMCumples(){
  crmCumplesAbierto=true;
  const proxCumples=proximosCumplesManual();
  document.getElementById('registro-content').innerHTML=cabeceraModal('🎂 Cumpleaños próximos')+htmlCumplesRec(proxCumples).replace(/^<div class="sec-hdr"[\s\S]*?<\/div>/,'');
  openModal('modal-registro');
}
function abrirCRMMembresias(){
  crmMembresiasAbierto=true;
  document.getElementById('registro-content').innerHTML=cabeceraModal('💳 Membresías por vencer')+htmlMembresiasPorVencerRec();
  openModal('modal-registro');
}
function abrirCRMContactar(){
  crmContactarAbierto=true;
  document.getElementById('registro-content').innerHTML=cabeceraModal('📞 Para contactar')+htmlParaContactarRec();
  openModal('modal-registro');
}
function htmlBadgeCRM(icon,n,label,onclick){
  const on=n>0;
  return `<div class="card" style="cursor:pointer;margin:0;padding:10px 6px;text-align:center${on?';background:rgba(251,191,36,.1);border-color:rgba(251,191,36,.4)':''}" onclick="${onclick}">
    <div style="font-size:17px">${icon}</div>
    <div style="font-size:18px;font-weight:900;margin-top:2px${on?';color:#fbbf24':''}">${n}</div>
    <div style="font-size:9.5px;font-weight:700;color:var(--muted2);line-height:1.25">${label}</div>
  </div>`;
}
function renderCRM(){
  const el=document.getElementById(crmTarget); if(!el) return;
  const proxCumples=proximosCumplesManual(), cumplesN=proxCumples.length+cumplesClientes(3).length;
  const membVencerN=membresiasPorVencer().length;
  const contactarN=contactosPendientesSt.list.filter(x=>!x.atendido).length;
  const cabecera=`<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:12px">
    ${htmlBadgeCRM('🎂',cumplesN,'Cumpleaños próximos',"abrirCRMCumples()")}
    ${htmlBadgeCRM('💳',membVencerN,'Membresías por vencer',"abrirCRMMembresias()")}
    ${htmlBadgeCRM('📞',contactarN,'Para contactar',"abrirCRMContactar()")}
  </div>`;
  if(crmCumplesAbierto) abrirCRMCumples();
  else if(crmMembresiasAbierto) abrirCRMMembresias();
  else if(crmContactarAbierto) abrirCRMContactar();
  const vistaTog=`<div style="display:flex;gap:6px;margin-bottom:10px">${[['tablero','🗂️ Tablero'],['lista','📋 Lista']].map(([v,l])=>`<button onclick="crmSetVista('${v}')" style="${pillStyle(crmVista===v,'#4A136B')}">${l}</button>`).join('')}</div>`;
  if(crmVista==='tablero'){
    el.innerHTML=cabecera+vistaTog+htmlBuscadorCRM()+`<div id="crm-tablero-wrap"></div>`;
    renderCRMTablero(document.getElementById('crm-tablero-wrap'));
    return;
  }
  const filtrosBlock=`<details class="card" style="margin-bottom:12px"${crmFiltrosAbierto?' open':''} ontoggle="crmFiltrosAbierto=this.open"><summary style="cursor:pointer;font-size:13px;font-weight:800">🔎 Filtros avanzados${crmFiltroActivo(crmFiltros)?' · activos':''}</summary><div style="margin-top:10px">${htmlFiltrosCRM(crmFiltros)}</div></details>`;
  const q=nkey(crmQ);
  if(crmFiltroActivo(crmFiltros)){
    const datos=datosCRM(), estAg=estadosAgendaCRM();
    let L=clientesDir.filter(c=>clientePasaFiltros(c,datos,estAg,crmFiltros));
    if(q) L=L.filter(c=>c.nkey.includes(q)||String(c.tel||'').replace(/\D/g,'').includes(q.replace(/\D/g,'')));
    const conDias=L.map(c=>{ const d=datos[c.id]; const {dias,estimado}=diasSinVenirInfo(c,d&&d.fecha); return {c,dias,estimado}; }).sort((a,b)=>(a.dias==null?1e9:a.dias)-(b.dias==null?1e9:b.dias));
    el.innerHTML=cabecera+vistaTog+filtrosBlock+
      htmlBuscadorCRM()+
      `<div style="font-size:11.5px;color:var(--muted2);margin-bottom:10px">${conDias.length} cliente${conDias.length===1?'':'s'} con estos filtros · ${conDias.filter(x=>x.c.tel).length} con teléfono cargado</div>
      ${conDias.slice(0,80).map(({c,dias,estimado})=>{ const msjFn=MSJ_CRM[franjaClienteCRM(c,dias)]||MSJ_CRM.sin; const wa=linkWhatsApp(c.tel,msjFn(c.nombre.split(' ')[0],dias)); return `<div class="card" style="margin-bottom:6px;padding:10px 12px;display:flex;align-items:center;gap:10px"><div style="flex:1;min-width:0" onclick="abrirClienteDetalle('${c.id}')"><div style="font-size:13px;font-weight:800">${escH(c.nombre)} <span style="color:var(--muted2)">#${c.numero}</span></div><div style="font-size:11px;color:var(--muted2)">${dias==null?'Sin visitas registradas':'hace '+dias+' días'}${estimado?' (estimado)':''}${c.tel?' · '+escH(c.tel):' · sin teléfono'}</div></div>${wa?`<a href="${wa}" target="_blank" rel="noopener" style="padding:8px 12px;border-radius:10px;background:rgba(52,211,153,.15);color:#34d399;font-size:12px;font-weight:800;text-decoration:none;white-space:nowrap">WhatsApp</a>`:''}</div>`; }).join('')||'<div class="empty"><div class="e-icon">🔎</div><p>Nadie coincide con estos filtros.</p></div>'}
      ${conDias.length>80?`<div style="text-align:center;font-size:11px;color:var(--muted)">Mostrando 80 de ${conDias.length}. Usá el buscador para encontrar a alguien puntual.</div>`:''}`;
    return;
  }
  const uv=ultimasVisitas();
  const todos=clientesDir.map(c=>{ const u=uv[c.id]; const {dias,estimado}=diasSinVenirInfo(c,u&&u.fecha); return {c,u,dias,estimado,franja:franjaClienteCRM(c,dias)}; });
  const counts={}; FRANJAS_CRM.forEach(([f])=>counts[f]=todos.filter(x=>x.franja===f).length);
  let L=todos.filter(x=>x.franja===crmFranja);
  if(q) L=L.filter(x=>x.c.nkey.includes(q)||String(x.c.tel||'').replace(/\D/g,'').includes(q.replace(/\D/g,'')));
  L.sort((a,b)=>(a.dias==null?1e9:a.dias)-(b.dias==null?1e9:b.dias));
  const conTel=L.filter(x=>x.c.tel).length;
  const msjFn=MSJ_CRM[crmFranja]||MSJ_CRM.sin;
  el.innerHTML=cabecera+vistaTog+filtrosBlock+
    `<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px">${FRANJAS_CRM.map(([f,l])=>`<button onclick="crmSet('${f}')" style="${pillStyle(crmFranja===f,'#4A136B')}">${l} (${counts[f]})</button>`).join('')}</div>
    ${htmlBuscadorCRM()}
    <div style="font-size:11.5px;color:var(--muted2);margin-bottom:10px">${L.length} cliente${L.length===1?'':'s'} en esta franja · ${conTel} con teléfono cargado</div>
    ${L.slice(0,80).map(({c,u,dias,estimado})=>{ const wa=linkWhatsApp(c.tel,msjFn(c.nombre.split(' ')[0],dias)); return `<div class="card" style="margin-bottom:6px;padding:10px 12px;display:flex;align-items:center;gap:10px"><div style="flex:1;min-width:0" onclick="abrirClienteDetalle('${c.id}')"><div style="font-size:13px;font-weight:800">${escH(c.nombre)} <span style="color:var(--muted2)">#${c.numero}</span></div><div style="font-size:11px;color:var(--muted2)">${dias==null?'Sin visitas registradas':'hace '+dias+' días'}${estimado?' (estimado)':''}${c.tel?' · '+escH(c.tel):' · sin teléfono'}</div></div>${wa?`<a href="${wa}" target="_blank" rel="noopener" style="padding:8px 12px;border-radius:10px;background:rgba(52,211,153,.15);color:#34d399;font-size:12px;font-weight:800;text-decoration:none;white-space:nowrap">WhatsApp</a>`:''}</div>`; }).join('')||'<div class="empty"><div class="e-icon">📱</div><p>No hay clientes en esta franja.</p></div>'}
    ${L.length>80?`<div style="text-align:center;font-size:11px;color:var(--muted)">Mostrando 80 de ${L.length}. Usá el buscador para encontrar a alguien puntual.</div>`:''}`;
}
// Cuatro medidores del dia, de las dos sucursales (los turnos de French figuran aunque recepcion no los pueda reagendar en persona)
function medidoresRec(){
  const hoy=hoyStr(), w=ventanaRec(profile); const cierres=(cierresData&&cierresData.byKey)||{};
  const S=sucursales.map(s=>({s,total:0,cerrados:0,reag:0,resenas:0,senas:0}));
  allUsers.filter(x=>esProf(x)).forEach(p=>{
    let dd={}; try{ dd=JSON.parse(localStorage.getItem('luffy_dinero_'+p.id)||'{}'); }catch(e){}
    (dd.turnos||[]).filter(t=>t.fecha===hoy&&!t.deudaId&&enVentana(t.creadoEn,w)).forEach(t=>{
      const o=S.find(x=>x.s.id===(t.sucursal||p.sucursal)); if(!o) return;
      // Ya no existe un paso de "cerrar" aparte: todo lo que esta en dd.turnos ya se cobro (y con eso, reagendo/resena/seña ya se preguntaron en el propio cobro)
      o.total++; o.cerrados++;
      if(t.reag&&t.reag.estado==='si') o.reag++;
      if(t.resena==='si') o.resenas++;
      if(t.sena) o.senas++;
    });
  });
  const suma=(k)=>S.reduce((a,x)=>a+x[k],0);
  return {S,w,total:suma('total'),cerrados:suma('cerrados'),reag:suma('reag'),resenas:suma('resenas'),senas:suma('senas')};
}
function htmlTableroRec(){
  const m=medidoresRec(), w=m.w; const hoy=hoyStr();
  const ventasHoy=[...membresiasSt.list.filter(x=>x.fecha===hoy&&x.vendedorId===profile.id).map(x=>numV(x.precio)),...paquetesSt.list.filter(x=>x.fecha===hoy&&x.vendedorId===profile.id).map(x=>numV(x.total))];
  const franja=(w.desde==='00:00'&&w.hasta==='24:00')?'todo el día':(w.desde===w.hasta?'hoy no tenés turno':w.desde+' a '+w.hasta);
  const pct=(a,b)=>b?Math.round(a/b*100):0;
  const porSuc=(fn)=>m.S.map(x=>`<span style="white-space:nowrap"><span style="color:${x.s.color}">●</span> ${escH(x.s.nombre.split(' ')[0])} ${fn(x)}</span>`).join(' · ');
  const tile=(ico,l,val,den,color,barra,sub)=>`<div style="background:var(--s2);border-radius:12px;padding:8px 10px;min-width:0">
    <div style="display:flex;justify-content:space-between;align-items:baseline;font-size:11px;font-weight:800"><span>${ico} ${l}</span><span style="color:${color}">${den!=null?pct(val,den)+'%':''}</span></div>
    <div style="font-size:19px;font-weight:900;color:${color};line-height:1.2">${val}${den!=null?` <span style="font-size:11px;color:var(--muted2);font-weight:700">de ${den}</span>`:''}</div>
    <div style="height:4px;background:var(--border2);border-radius:2px;margin:4px 0;overflow:hidden"><div style="height:100%;width:${Math.min(100,barra)}%;background:${color};border-radius:2px"></div></div>
    <div style="font-size:10px;color:var(--muted2);line-height:1.5">${sub}</div></div>`;
  return `<div class="card" style="margin-top:14px;padding:11px 12px;background:rgba(96,165,250,.08);border-color:rgba(96,165,250,.3)">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px"><div style="font-size:12.5px;font-weight:800">🕐 ${franja==='hoy no tenés turno'?'Hoy no tenés turno':'Tu turno: '+franja}</div><div style="font-size:10.5px;color:var(--muted2)">${m.total-m.cerrados} sin cerrar</div></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
      ${tile('📋','Turnos hechos',m.total,null,'#60a5fa',pct(m.cerrados,m.total),porSuc(x=>x.total)+' · '+m.cerrados+' cerrados')}
      ${tile('⭐','Reseñas',m.resenas,m.cerrados,'#fbbf24',pct(m.resenas,m.cerrados),porSuc(x=>x.resenas+'/'+x.cerrados))}
      ${tile('💵','Señas',m.senas,m.cerrados,'#34d399',pct(m.senas,m.cerrados),porSuc(x=>x.senas+'/'+x.cerrados))}
      ${tile('🔁','Reagendaron',m.reag,m.total,'#a78bfa',pct(m.reag,m.total),porSuc(x=>x.reag+'/'+x.total))}
    </div>
    <div style="font-size:10px;color:var(--muted);margin-top:7px">Cuenta los turnos de las dos sucursales hechos en tu horario. En sucursales sin recepción los cierran los profesionales.</div>
  </div>
  ${ventasHoy.length?`<div style="font-size:12px;color:var(--muted2);margin:8px 2px">💳🎁 Vendiste hoy ${ventasHoy.length} ${ventasHoy.length===1?'membresía/paquete':'membresías/paquetes'} por ${fp(ventasHoy.reduce((a,b)=>a+b,0))}</div>`:''}
  ${facturadoPaqQuincena(profile.id)>0?`<div style="font-size:12px;margin:6px 2px 8px">📦 Llevás <b style="color:#4A136B">${fp(facturadoPaqQuincena(profile.id))}</b> en paquetes esta quincena</div>`:''}`;
}
function htmlClientesRec(){
  return `<div class="sec-hdr" style="margin:16px 0 8px"><span class="sec-title">👥 Clientes del salón</span><button class="sec-btn" onclick="abrirFormCliente()" style="background:#4A136B">+ Cliente</button></div>
    <input id="rec-busq" type="search" placeholder="Buscar cliente por nombre, # o teléfono…" value="${escH(recQ)}" oninput="recQ=this.value;recRenderBusqueda()" style="width:100%;background:var(--s1);border:1.5px solid var(--border2);border-radius:12px;padding:12px 14px;color:var(--text);font-family:var(--font);font-size:14px;outline:none;margin-bottom:8px"/>
    <div id="rec-cli-res"></div>`;
}

// ---------- admin: recepcion (turnos, tareas por horario, cumpleaños) ----------
function renderAdminRecepcion(c){
  const recs=allUsers.filter(u=>u.role==='recepcionista');
  const bloques={}; tareasRecepcion.slice().sort((a,b)=>a.desde.localeCompare(b.desde)).forEach(t=>{ (bloques[t.desde+'–'+t.hasta]=bloques[t.desde+'–'+t.hasta]||[]).push(t); });
  c.innerHTML=htmlAperturaAdmin()+htmlCajaRec()+htmlTurnosPendientesRec()+htmlCalendarioAdmin()+`<div class="sec-hdr" style="margin:18px 0 8px"><span class="sec-title">📞 Recepcionistas</span></div>
    <div class="card" style="margin-bottom:8px;font-size:12px;color:var(--muted2);line-height:1.5">Cada recepcionista trabaja en los <b style="color:var(--text)">bloques</b> que le asignás en el calendario de arriba. Solo ve las tareas de su horario y solo se le cuentan los turnos (y reagendamientos) que se hicieron mientras trabaja. Para sumar otra cuenta, aprobala en Equipo y elegí "Recepcionista".</div>
    ${recs.map(u=>{ const e=estadoRecHoy(u); const w=ventanaRec(u); return `<div class="prof-card" style="margin-bottom:8px;padding:12px 14px"><div style="display:flex;align-items:center;gap:10px"><div style="flex:1"><div style="font-size:14px;font-weight:800">${escH(u.name)} <span style="font-size:11px;color:var(--muted2);font-weight:600">@${escH(u.username||'')}</span></div>
      <div style="font-size:12px;color:var(--muted2)">🕐 Hoy: ${bloquesDe(u).length?bloquesDe(u).map(b=>escH(b.nombre)+' '+b.desde+'–'+b.hasta).join(' + '):(hayCalendario()||(u.bloquesRec||[]).length?'no trabaja':(w.desde==='00:00'&&w.hasta==='24:00'?'sin turnos asignados (todo el día)':w.desde+' a '+w.hasta))}</div></div><button class="lnk" onclick="editarCuenta('${u.id}')">Editar</button></div>
      <div style="font-size:12px;margin-top:8px">Hoy: <b>${e.total}</b> turnos en su horario · reagendaron <b style="color:#60a5fa">${e.reag}</b> (${e.pct}%) · no se les preguntó ${e.sinPreguntar} · no quisieron ${e.noQuiso} · reseñas ${e.resenas}</div></div>`; }).join('')||'<div class="empty"><div class="e-icon">📞</div><p>No hay recepcionistas.</p></div>'}
    <div class="sec-hdr" style="margin:16px 0 8px"><span class="sec-title">📋 Tareas por horario</span><button class="lnk" onclick="editarTareasRecepcion()">Editar</button></div>
    ${Object.entries(bloques).map(([r,l])=>`<div class="card" style="margin-bottom:8px"><div style="font-size:12px;font-weight:800;color:#60a5fa;margin-bottom:4px">${r}</div>${l.map(t=>`<div style="font-size:12px;padding:3px 0">${t.emoji||'✅'} ${escH(t.label)}</div>`).join('')}</div>`).join('')}`;
  renderAdminCumpleanos(c);
}
async function editarTurnoRec(id){
  const u=allUsers.find(x=>x.id===id); if(!u) return; const w=ventanaRec(u);
  const v=await uiDialog({title:'Horario de '+u.name,msg:'Formato HH:MM. Dejalo vacío para que trabaje todo el día.',fields:[{label:'Entra a las',value:w.desde==='00:00'&&w.hasta==='24:00'?'':w.desde,placeholder:'08:00'},{label:'Sale a las',value:w.desde==='00:00'&&w.hasta==='24:00'?'':w.hasta,placeholder:'15:00'}],ok:'Guardar'});
  if(!v) return;
  const a=v[0].trim(), b=v[1].trim();
  let patch;
  if(!a&&!b) patch={turnoRec:null};
  else { if(!/^\d{1,2}:\d{2}$/.test(a)||!/^\d{1,2}:\d{2}$/.test(b)){ showToast('Poné las dos horas como HH:MM'); return; } patch={turnoRec:{desde:a.padStart(5,'0'),hasta:b.padStart(5,'0')}}; if(patch.turnoRec.hasta<=patch.turnoRec.desde){ showToast('La salida tiene que ser después de la entrada'); return; } }
  if(await guardarCampoUsuario(id,patch)){ showToast('Horario guardado ✓'); renderAdmin(); }
}
async function editarTareasRecepcion(){
  const actuales=tareasRecepcion.map(t=>t.desde+'-'+t.hasta+' | '+(t.emoji||'✅')+' '+t.label).join('\n');
  const nuevo=await uiPrompt('Tareas por horario',{msg:'Una tarea por línea: "08:30-10:00 | 💻 Prender la computadora". Si dos recepcionistas trabajan en horarios distintos, cada una ve solo lo de su horario.',type:'textarea',value:actuales,ok:'Guardar'});
  if(nuevo===null) return;
  const out=[]; let mal=0;
  nuevo.split('\n').map(l=>l.trim()).filter(Boolean).forEach((l,i)=>{
    const m=/^(\d{1,2}:\d{2})\s*[-–a]\s*(\d{1,2}:\d{2})\s*\|\s*(.+)$/.exec(l); if(!m){ mal++; return; }
    let txt=m[3].trim(), emoji='✅'; const e=/^(\p{Extended_Pictographic}️?)\s*(.*)$/u.exec(txt); if(e){ emoji=e[1]; txt=e[2]||txt; }
    out.push({id:'t'+(i+1),emoji,label:txt,desde:m[1].padStart(5,'0'),hasta:m[2].padStart(5,'0')});
  });
  if(mal){ showToast('Hay '+mal+' líneas sin el formato "08:30-10:00 | tarea"'); return; }
  if(!out.length){ showToast('Necesitás al menos una tarea'); return; }
  tareasRecepcion=out; saveTareasRecepcion(); showToast('Tareas actualizadas ✓'); renderAdmin();
}


