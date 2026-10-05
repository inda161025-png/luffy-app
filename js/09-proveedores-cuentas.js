// ============ PROVEEDORES, STOCK E INSUMOS ============
// Cada proveedor tiene su lista de productos con precio. Cada item es de uno de dos tipos, y van a lugares separados:
//   📦 Stock (para vender): se crea en Catálogo → Stock, con su costo y precio de venta.
//   🧴 Insumo (de trabajo): va a Catálogo → Insumos (geles, ceras, filos, café…), con cuánto rinde cada unidad.
// Al registrar una compra, se suma al stock o a los insumos. Las compras de insumos se cuentan como gasto en Finanzas;
// la mercadería para vender no (su costo se descuenta cuando se vende).
const PRECARGA=[
  // Para vender
  {n:'Cera para cabello (mate)',t:'stock',u:'unidad',pv:9000},{n:'Cera para cabello (brillo)',t:'stock',u:'unidad',pv:9000},{n:'Pomada fijación fuerte',t:'stock',u:'unidad',pv:10000},
  {n:'Gel fijador',t:'stock',u:'unidad',pv:6000},{n:'Aceite de barba',t:'stock',u:'unidad',pv:12000},{n:'Bálsamo de barba',t:'stock',u:'unidad',pv:12000},
  {n:'Shampoo profesional',t:'stock',u:'unidad',pv:14000},{n:'Acondicionador',t:'stock',u:'unidad',pv:14000},{n:'Crema de afeitar',t:'stock',u:'unidad',pv:8000},
  {n:'Loción post afeitado',t:'stock',u:'unidad',pv:9000},{n:'Tónico capilar',t:'stock',u:'unidad',pv:15000},{n:'Peine de barbero',t:'stock',u:'unidad',pv:4000},
  {n:'Cepillo para barba',t:'stock',u:'unidad',pv:9000},{n:'Mascarilla capilar',t:'stock',u:'unidad',pv:16000},{n:'Protector solar facial',t:'stock',u:'unidad',pv:15000},
  // Insumos de trabajo
  {n:'Gel de afeitar',t:'insumo',u:'bidón',r:200},{n:'Papel de cuello',t:'insumo',u:'rollo',r:200},{n:'Filos de navaja',t:'insumo',u:'caja x100',r:100},
  {n:'Café en cápsulas',t:'insumo',u:'cápsula',r:1},{n:'Cera de uso en el salón',t:'insumo',u:'unidad',r:80},{n:'Talco',t:'insumo',u:'frasco',r:150},
  {n:'Alcohol / desinfectante',t:'insumo',u:'litro',r:100},{n:'Capas descartables',t:'insumo',u:'pack x100',r:100},{n:'Toallas descartables',t:'insumo',u:'pack x100',r:100},
  {n:'Guantes descartables',t:'insumo',u:'caja x100',r:50},{n:'Algodón',t:'insumo',u:'paquete',r:120},{n:'Colorante',t:'insumo',u:'tubo',r:4},{n:'Oxidante',t:'insumo',u:'litro',r:12},
  {n:'Esmalte semipermanente',t:'insumo',u:'frasco',r:15},{n:'Limas descartables',t:'insumo',u:'pack x50',r:50},{n:'Aceite para máquinas',t:'insumo',u:'frasco',r:300},
  {n:'Cera depilatoria',t:'insumo',u:'lata',r:25},{n:'Hoja de bisturí (podología)',t:'insumo',u:'caja x100',r:100},{n:'Crema de masaje',t:'insumo',u:'pote',r:30},
];
let provData={list:[],compras:[],borrados:[]};
let provSel={paso:'',q:'',item:null,provId:'',compra:null};
const persistProv=()=>{ try{ localStorage.setItem('luffy_proveedores',JSON.stringify(provData)); }catch(e){} };
function mergeProv(remote){
  if(!remote) return false; const antes=JSON.stringify(provData);
  const del=new Set([...(provData.borrados||[]),...(remote.borrados||[])]);
  ['list','compras'].forEach(k=>{ const m=new Map((provData[k]||[]).map(x=>[x.id,x])); (remote[k]||[]).forEach(r=>{ const l=m.get(r.id); if(!l||String(r.upd||r.creadoEn||'')>String(l.upd||l.creadoEn||'')) m.set(r.id,r); }); provData[k]=[...m.values()].filter(x=>!del.has(x.id)); });
  provData.borrados=[...del]; return antes!==JSON.stringify(provData);
}
function loadProveedores(){
  if(!profile||profile.role!=='admin') return;
  try{ provData={list:[],compras:[],borrados:[],...JSON.parse(localStorage.getItem('luffy_proveedores')||'{}')}; }catch(e){}
  if(DB) DB.doc('luffy/proveedores').get().then(r=>{ if(mergeProv(r)){ persistProv(); refreshCurrentView(); } }).catch(()=>{});
}
async function cambiarProv(fn){
  if(DB){ try{ mergeProv(await DB.doc('luffy/proveedores').get()); }catch(e){} }
  const res=fn(provData); persistProv();
  if(DB){ try{ await DB.doc('luffy/proveedores').set(provData); }catch(e){ showToast('Se guardó en este dispositivo; falta conexión para subirlo'); } }
  return res;
}
const provDe=(id)=>provData.list.find(p=>p.id===id)||null;
const stockDeItem=(it)=>it.tipo==='stock'?productos.find(p=>p.id===it.linkId)||null:null;
const insumoDeItem=(it)=>it.tipo==='insumo'?(finData.consumibles||[]).find(c=>c.id===it.linkId)||null:null;

// ---------- lista de proveedores ----------
function renderAdminProveedores(c){
  const L=provData.list.filter(p=>!p.anulado).slice().sort((a,b)=>a.nombre.localeCompare(b.nombre));
  const gastado=(pid)=>provData.compras.filter(k=>k.provId===pid).reduce((s,k)=>s+numV(k.total),0);
  c.innerHTML=`<div class="sec-hdr" style="margin:6px 0 8px"><span class="sec-title">🚚 Proveedores (${L.length})</span><button class="lnk" onclick="editarProveedor('')">+ Proveedor</button></div>
    <div class="card" style="margin-bottom:10px;font-size:12px;color:var(--muted2);line-height:1.5">Cargá a quién le comprás y qué. Cada producto puede ser <b style="color:var(--text)">📦 stock para vender</b> (va a Catálogo → Stock) o <b style="color:var(--text)">🧴 insumo de trabajo</b> (va a Catálogo → Insumos). Elegís de una lista ya cargada o lo creás nuevo, y al registrar una compra se suma solo.</div>
    ${L.map(p=>{ const st=p.items.filter(i=>i.tipo==='stock').length, ins=p.items.filter(i=>i.tipo==='insumo').length; const ult=provData.compras.filter(k=>k.provId===p.id).sort((a,b)=>b.fecha.localeCompare(a.fecha))[0];
      return `<div class="card" onclick="abrirProveedor('${p.id}')" style="cursor:pointer;margin-bottom:8px"><div style="display:flex;align-items:center;gap:12px"><div style="font-size:26px">🚚</div><div style="flex:1;min-width:0"><div style="font-size:14px;font-weight:800">${escH(p.nombre)}</div><div style="font-size:11.5px;color:var(--muted2)">${st} para vender · ${ins} insumos${p.tel?' · 📞 '+escH(p.tel):''}</div><div style="font-size:11px;color:var(--muted)">${ult?'Última compra '+fechaCortaStr(ult.fecha)+' · ':''}Comprado en total ${fp(gastado(p.id))}</div></div><span style="color:var(--muted)">›</span></div></div>`; }).join('')||'<div class="empty"><div class="e-icon">🚚</div><p>Todavía no cargaste proveedores.</p></div>'}`;
}
async function editarProveedor(id){
  const p=id?provDe(id):null;
  const v=await uiDialog({title:p?'Editar proveedor':'Nuevo proveedor',fields:[{label:'Nombre',placeholder:'Ej: Distribuidora Barber Pro',value:p?p.nombre:''},{label:'Teléfono (opcional)',type:'tel',value:p?p.tel||'':''},{label:'Notas (opcional)',placeholder:'Ej: entrega los martes',value:p?p.notas||'':''}],ok:'Guardar'});
  if(!v||!v[0].trim()){ return; }
  const ahora=new Date().toISOString(); let nuevoId=id;
  await cambiarProv(d=>{ const x=id?d.list.find(z=>z.id===id):null; if(x) Object.assign(x,{nombre:v[0].trim(),tel:v[1].trim(),notas:v[2].trim(),upd:ahora}); else { nuevoId='pv'+Date.now().toString(36); d.list.push({id:nuevoId,nombre:v[0].trim(),tel:v[1].trim(),notas:v[2].trim(),items:[],creadoEn:ahora,upd:ahora}); } });
  showToast('Guardado ✓'); if(!id) abrirProveedor(nuevoId); else renderAdmin();
}
async function borrarProveedor(id){
  const motivo=await pedirMotivoAnulacion('¿Anular este proveedor?'); if(!motivo) return;
  await cambiarProv(d=>{ const x=d.list.find(z=>z.id===id); if(x) anularRegistro(x,motivo); }); closeModal('modal-registro'); renderAdmin();
}

// ---------- ficha del proveedor ----------
function abrirProveedor(id){
  const p=provDe(id); if(!p) return; provSel.provId=id;
  const fila=(it)=>{ const st=stockDeItem(it), ins=insumoDeItem(it); return `<div style="display:flex;align-items:center;gap:8px;padding:7px 0;border-bottom:1px solid var(--border)"><div style="flex:1;min-width:0"><div style="font-size:13px;font-weight:700">${escH(it.nombre)}</div><div style="font-size:11px;color:var(--muted2)">${fp(it.precio)} por ${escH(it.unidad||'unidad')}${it.tipo==='stock'?` · se vende a ${fp(it.precioVenta||0)}${st?' · stock '+st.stock:''}`:` · rinde ${it.rinde||1} servicios${ins?' · en stock '+numV(ins.stock):''}`}</div></div><button class="lnk" onclick="abrirItemProv('${id}','${it.id}')">✏️</button><button class="lnk" style="color:#f472b6" onclick="borrarItemProv('${id}','${it.id}')">×</button></div>`; };
  const st=p.items.filter(i=>i.tipo==='stock'), ins=p.items.filter(i=>i.tipo==='insumo');
  const compras=provData.compras.filter(k=>k.provId===id).sort((a,b)=>b.fecha.localeCompare(a.fecha)||String(b.creadoEn).localeCompare(String(a.creadoEn))).slice(0,5);
  document.getElementById('registro-content').innerHTML=cabeceraModal('🚚 '+escH(p.nombre))+`
    <div style="font-size:12px;color:var(--muted2);margin-bottom:10px">${p.tel?'📞 '+escH(p.tel)+' · ':''}${escH(p.notas||'')||'Sin notas'} <button class="lnk" onclick="editarProveedor('${id}')">Editar</button></div>
    <div style="display:flex;gap:8px;margin-bottom:12px"><button class="btn btn-primary" style="flex:1" onclick="abrirItemProv('${id}','')">+ Producto o insumo</button><button class="btn btn-ghost" style="flex:1" onclick="abrirCompra('${id}')">🛒 Registrar compra</button></div>
    <div class="sec-title" style="margin:6px 0 4px">📦 Para vender (stock)</div>${st.map(fila).join('')||'<div style="font-size:12px;color:var(--muted);padding:6px 0">Ninguno todavía.</div>'}
    <div class="sec-title" style="margin:14px 0 4px">🧴 Insumos de trabajo</div>${ins.map(fila).join('')||'<div style="font-size:12px;color:var(--muted);padding:6px 0">Ninguno todavía.</div>'}
    ${compras.length?`<div class="sec-title" style="margin:14px 0 4px">Últimas compras</div>${compras.map(k=>`<div class="ln"><span>${fechaCortaStr(k.fecha)} · ${k.items.map(i=>escH(i.nombre)+' x'+i.cant).join(', ')}</span><b>${fp(k.total)}</b></div>`).join('')}`:''}
    <button class="btn btn-ghost" onclick="borrarProveedor('${id}')" style="margin-top:14px;color:#f472b6">Borrar proveedor</button>`;
  openModal('modal-registro');
}

// ---------- agregar / editar un producto o insumo del proveedor ----------
function abrirItemProv(provId,itemId){
  const p=provDe(provId); if(!p) return; provSel.provId=provId;
  if(itemId){ provSel.item={...p.items.find(i=>i.id===itemId)}; provSel.paso='form'; }
  else { provSel.item=null; provSel.paso='elegir'; provSel.q=''; }
  renderItemProv();
}
function renderItemProv(){
  const p=provDe(provSel.provId); if(!p) return; const c=document.getElementById('registro-content');
  const volver=`abrirProveedor('${p.id}')`;
  if(provSel.paso==='elegir'){
    const q=nkey(provSel.q); const yaTiene=new Set(p.items.map(i=>nkey(i.nombre)));
    const L=PRECARGA.filter(x=>!yaTiene.has(nkey(x.n))&&(!q||nkey(x.n).includes(q)));
    const grupo=(t,titulo)=>{ const l=L.filter(x=>x.t===t); return l.length?`<div style="font-size:10.5px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);margin:10px 0 6px">${titulo}</div><div style="display:flex;flex-wrap:wrap;gap:6px">${l.map(x=>`<button onclick="elegirPrecarga('${PRECARGA.indexOf(x)}')" style="${pillStyle(false,'#4A136B')}">${escH(x.n)}</button>`).join('')}</div>`:''; };
    c.innerHTML=cabeceraModal('Agregar a '+escH(p.nombre))+`<button class="btn btn-ghost" onclick="nuevoItemProv()" style="margin-bottom:10px">➕ Cargar uno nuevo</button>
      <input type="search" placeholder="Buscar en la lista ya cargada…" value="${escH(provSel.q)}" oninput="provSel.q=this.value;renderItemProv();var e=document.querySelector('#registro-content input[type=search]');e.focus();e.setSelectionRange(e.value.length,e.value.length);" style="width:100%;background:var(--s1);border:1.5px solid var(--border2);border-radius:12px;padding:11px 14px;color:var(--text);font-family:var(--font);font-size:14px"/>
      ${grupo('stock','📦 Para vender')}${grupo('insumo','🧴 Insumos de trabajo')}${!L.length?'<div style="font-size:12.5px;color:var(--muted);padding:12px 0">No hay coincidencias. Usá "Cargar uno nuevo".</div>':''}
      <button class="btn btn-ghost" onclick="${volver}" style="margin-top:14px">← Volver</button>`;
    return;
  }
  const it=provSel.item; const esStock=it.tipo!=='insumo';
  c.innerHTML=cabeceraModal(it.id?'Editar':'Producto o insumo')+`
    <div class="field"><label>Nombre</label><input id="pi-nombre" value="${escH(it.nombre||'')}" placeholder="Ej: Cera para cabello"/></div>
    <div class="field" style="margin-top:8px"><label>¿Qué es?</label><div style="display:flex;gap:8px">${[['stock','📦 Para vender'],['insumo','🧴 Insumo de trabajo']].map(([v,l])=>`<button onclick="itemProvTipo('${v}')" style="flex:1;${pillStyle((it.tipo||'stock')===v,'#4A136B')}">${l}</button>`).join('')}</div><div style="font-size:11px;color:var(--muted);margin-top:4px">${esStock?'Se crea en Catálogo → Stock, listo para venderse en los cobros.':'Se crea en Catálogo → Insumos y se usa para calcular el costo de cada servicio.'}</div></div>
    <div style="display:flex;gap:8px;margin-top:8px"><div class="field" style="flex:1"><label>Precio de compra</label><input id="pi-precio" type="number" inputmode="decimal" value="${it.precio||''}" placeholder="0"/></div><div class="field" style="flex:1"><label>Unidad</label><input id="pi-unidad" value="${escH(it.unidad||'unidad')}" placeholder="unidad, caja, litro…"/></div></div>
    ${esStock?`<div style="display:flex;gap:8px;margin-top:8px"><div class="field" style="flex:1"><label>Precio de venta</label><input id="pi-pv" type="number" inputmode="decimal" value="${it.precioVenta||''}" placeholder="0"/></div><div class="field" style="flex:1"><label>Comisión del profesional %</label><input id="pi-com" type="number" value="${it.comisionPct!=null?it.comisionPct:10}"/></div></div>`
      :`<div class="field" style="margin-top:8px"><label>¿Para cuántos servicios rinde cada unidad?</label><input id="pi-rinde" type="number" inputmode="numeric" value="${it.rinde||''}" placeholder="Ej: 200"/></div><div class="field" style="margin-top:8px"><label>Rubros que lo usan (ids con coma, vacío = todos)</label><input id="pi-rubro" value="${escH(it.rubro||'')}" placeholder="barberia,barberia-premium"/></div>`}
    <div class="field" style="margin-top:8px"><label>Avisarme cuando queden (unidades)</label><input id="pi-alerta" type="number" value="${it.alerta!=null?it.alerta:2}"/></div>
    <button class="btn btn-primary" onclick="guardarItemProv()" style="margin-top:14px">Guardar</button>
    <button class="btn btn-ghost" onclick="abrirProveedor('${p.id}')" style="margin-top:8px">← Volver</button>`;
}
function itemProvTipo(t){ leerItemForm(); provSel.item.tipo=t; renderItemProv(); }
function leerItemForm(){ const v=(i)=>{ const e=document.getElementById(i); return e?e.value:undefined; }; const it=provSel.item; const set=(k,val)=>{ if(val!==undefined) it[k]=val; };
  set('nombre',v('pi-nombre')); if(v('pi-precio')!==undefined) it.precio=numV(v('pi-precio')); set('unidad',v('pi-unidad')); if(v('pi-pv')!==undefined) it.precioVenta=numV(v('pi-pv')); if(v('pi-com')!==undefined) it.comisionPct=numV(v('pi-com')); if(v('pi-rinde')!==undefined) it.rinde=numV(v('pi-rinde')); set('rubro',v('pi-rubro')); if(v('pi-alerta')!==undefined) it.alerta=numV(v('pi-alerta')); }
function elegirPrecarga(i){ const x=PRECARGA[Number(i)]; provSel.item={nombre:x.n,tipo:x.t,unidad:x.u,precio:'',precioVenta:x.pv||'',rinde:x.r||'',rubro:x.t==='insumo'?'barberia,barberia-premium':'',comisionPct:10,alerta:2}; provSel.paso='form'; renderItemProv(); }
function nuevoItemProv(){ provSel.item={nombre:'',tipo:'stock',unidad:'unidad',precio:'',precioVenta:'',comisionPct:10,alerta:2}; provSel.paso='form'; renderItemProv(); }
async function guardarItemProv(){
  leerItemForm(); const it=provSel.item; const p=provDe(provSel.provId); if(!p) return;
  if(!it.nombre.trim()||numV(it.precio)<=0){ showToast('Poné el nombre y el precio de compra'); return; }
  if(it.tipo==='insumo'&&numV(it.rinde)<=0){ showToast('Poné para cuántos servicios rinde'); return; }
  if(it.tipo==='stock'&&numV(it.precioVenta)<=0){ showToast('Poné el precio de venta'); return; }
  const ahora=new Date().toISOString(); it.nombre=it.nombre.trim();
  let linkId=it.linkId||'';
  if(it.tipo==='stock'){
    const ex=productos.find(x=>x.id===linkId)||productos.find(x=>nkey(x.nombre)===nkey(it.nombre));
    if(ex){ linkId=ex.id; productosCambiar(l=>l.map(x=>x.id===ex.id?{...x,costo:numV(it.precio),precioVenta:numV(it.precioVenta),comisionPct:numV(it.comisionPct),alertaStock:numV(it.alerta)}:x)); }
    else { const nid='pr'+Date.now().toString(36); linkId=nid; productosCambiar(l=>l.some(x=>x.id===nid)?l:[...l,{id:nid,nombre:it.nombre,costo:numV(it.precio),precioVenta:numV(it.precioVenta),comisionPct:numV(it.comisionPct),stock:0,alertaStock:numV(it.alerta),proveedorId:p.id,creado:ahora}]); }
  } else {
    const ex=(finData.consumibles||[]).find(x=>x.id===linkId)||(finData.consumibles||[]).find(x=>nkey(x.nombre)===nkey(it.nombre));
    if(ex){ linkId=ex.id; await cambiarFin(d=>{ const z=d.consumibles.find(k=>k.id===ex.id); if(z) Object.assign(z,{precio:numV(it.precio),rinde:numV(it.rinde),rubro:it.rubro||'',unidad:it.unidad,alerta:numV(it.alerta),proveedorId:p.id,upd:ahora}); }); }
    else { linkId='c'+Date.now().toString(36); await cambiarFin(d=>{ d.consumibles.push({id:linkId,nombre:it.nombre,precio:numV(it.precio),rinde:numV(it.rinde),rubro:it.rubro||'',unidad:it.unidad,stock:0,alerta:numV(it.alerta),proveedorId:p.id,upd:ahora}); }); }
  }
  const dato={nombre:it.nombre,tipo:it.tipo,precio:numV(it.precio),unidad:it.unidad||'unidad',precioVenta:numV(it.precioVenta),comisionPct:numV(it.comisionPct),rinde:numV(it.rinde),rubro:it.rubro||'',alerta:numV(it.alerta),linkId};
  await cambiarProv(d=>{ const x=d.list.find(z=>z.id===p.id); if(!x) return; if(it.id){ const k=x.items.find(z=>z.id===it.id); if(k) Object.assign(k,dato); } else x.items.push({id:'it'+Date.now().toString(36),...dato}); x.upd=ahora; });
  showToast('Guardado ✓ '+(it.tipo==='stock'?'está en Stock':'está en Insumos')); abrirProveedor(p.id); refreshCurrentView();
}
async function borrarItemProv(pid,iid){
  if(!await uiConfirm('¿Sacar este producto del proveedor?','Sigue existiendo en Stock o Insumos; solo se quita de la lista de este proveedor.',{ok:'Sacar'})) return;
  await cambiarProv(d=>{ const x=d.list.find(z=>z.id===pid); if(x){ x.items=x.items.filter(i=>i.id!==iid); x.upd=new Date().toISOString(); } }); abrirProveedor(pid);
}

// ---------- registrar una compra ----------
function abrirCompra(pid){
  const p=provDe(pid); if(!p||!p.items.length){ showToast('Primero cargá productos a este proveedor'); return; }
  provSel.provId=pid; provSel.compra={items:{},sucursal:'todas',fecha:hoyStr()}; p.items.forEach(i=>{ provSel.compra.items[i.id]={cant:0,precio:i.precio}; }); renderCompra();
}
function compraQty(iid,d){ const x=provSel.compra.items[iid]; x.cant=Math.max(0,numV(x.cant)+d); renderCompra(); }
function compraPrecio(iid,v){ provSel.compra.items[iid].precio=numV(v); renderCompra(); }
function renderCompra(){
  const p=provDe(provSel.provId), cp=provSel.compra; const keep=document.querySelector('#modal-registro .modal-box'); const st=keep?keep.scrollTop:0;
  const total=p.items.reduce((s,i)=>s+numV(cp.items[i.id].cant)*numV(cp.items[i.id].precio),0), totIns=p.items.filter(i=>i.tipo==='insumo').reduce((s,i)=>s+numV(cp.items[i.id].cant)*numV(cp.items[i.id].precio),0);
  const fila=(i)=>{ const x=cp.items[i.id]; return `<div style="display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid var(--border)"><div style="flex:1;min-width:0"><div style="font-size:13px;font-weight:700">${i.tipo==='stock'?'📦':'🧴'} ${escH(i.nombre)}</div><div style="display:flex;align-items:center;gap:4px;font-size:11px;color:var(--muted2)">$<input type="number" value="${x.precio}" onchange="compraPrecio('${i.id}',this.value)" style="width:78px;padding:3px 6px;font-size:12px"/> por ${escH(i.unidad||'unidad')}</div></div>
    <button onclick="compraQty('${i.id}',-1)" style="width:32px;height:32px;border-radius:50%;border:1.5px solid var(--border2);background:transparent;color:var(--text);font-size:18px;cursor:pointer">−</button><div style="min-width:22px;text-align:center;font-size:15px;font-weight:800;${x.cant?'color:#4A136B':'color:var(--muted)'}">${x.cant}</div><button onclick="compraQty('${i.id}',1)" style="width:32px;height:32px;border-radius:50%;border:none;background:#4A136B;color:#fff;font-size:18px;cursor:pointer">+</button></div>`; };
  document.getElementById('registro-content').innerHTML=cabeceraModal('🛒 Compra a '+escH(p.nombre))+`${p.items.map(fila).join('')}
    <div class="card" style="margin:12px 0"><div class="ln"><span>Total de la compra</span><b style="font-size:16px">${fp(total)}</b></div>${totIns>0?`<div style="font-size:11px;color:var(--muted2);margin-top:4px">${fp(totIns)} de insumos se cuentan como gasto en Finanzas. La mercadería para vender no: su costo se descuenta cuando se vende.</div>`:''}</div>
    <div style="display:flex;gap:8px"><div class="field" style="flex:1"><label>Fecha</label><input type="date" value="${cp.fecha}" onchange="provSel.compra.fecha=this.value"/></div><div class="field" style="flex:1"><label>Sucursal</label><select onchange="provSel.compra.sucursal=this.value" style="${selFin}"><option value="todas">Compartido</option>${sucursales.map(s=>`<option value="${s.id}" ${cp.sucursal===s.id?'selected':''}>${escH(s.nombre)}</option>`).join('')}</select></div></div>
    <button class="btn btn-primary" onclick="confirmarCompra()" style="margin-top:12px">${total>0?'Registrar compra de '+fp(total):'Elegí cantidades'}</button>
    <button class="btn btn-ghost" onclick="abrirProveedor('${p.id}')" style="margin-top:8px">← Volver</button>`;
  if(keep) keep.scrollTop=st;
}
async function confirmarCompra(){
  const p=provDe(provSel.provId), cp=provSel.compra; if(!p||!cp||cp.ocupado) return;
  const elegidos=p.items.filter(i=>numV(cp.items[i.id].cant)>0); if(!elegidos.length){ showToast('Elegí cuántas unidades compraste'); return; }
  cp.ocupado=true; const ahora=new Date().toISOString();
  const lin=elegidos.map(i=>({itemId:i.id,nombre:i.nombre,tipo:i.tipo,cant:numV(cp.items[i.id].cant),precio:numV(cp.items[i.id].precio)}));
  const total=lin.reduce((s,l)=>s+l.cant*l.precio,0), totIns=lin.filter(l=>l.tipo==='insumo').reduce((s,l)=>s+l.cant*l.precio,0);
  // stock: suma unidades y actualiza el costo
  const stk=elegidos.filter(i=>i.tipo==='stock'&&stockDeItem(i));
  if(stk.length) ajustarStock(stk.map(i=>({id:i.linkId,delta:numV(cp.items[i.id].cant),costo:numV(cp.items[i.id].precio)})));
  // insumos: suma unidades, actualiza el precio y (si corresponde) anota el gasto
  await cambiarFin(d=>{
    elegidos.filter(i=>i.tipo==='insumo').forEach(i=>{ const z=(d.consumibles||[]).find(k=>k.id===i.linkId); if(z){ z.stock=numV(z.stock)+numV(cp.items[i.id].cant); z.precio=numV(cp.items[i.id].precio); z.upd=ahora; } });
    if(totIns>0) d.gastos.push({id:'g'+Date.now().toString(36),fecha:cp.fecha,monto:totIns,categoria:'insumos',sucursal:cp.sucursal,desc:'Compra a '+p.nombre,origen:'proveedor',upd:ahora,creadoEn:ahora});
  });
  await cambiarProv(d=>{ d.compras.push({id:'cm'+Date.now().toString(36),provId:p.id,provNombre:p.nombre,fecha:cp.fecha,sucursal:cp.sucursal,items:lin,total,creadoEn:ahora,upd:ahora}); const x=d.list.find(z=>z.id===p.id); if(x){ x.items.forEach(i=>{ const l=lin.find(k=>k.itemId===i.id); if(l) i.precio=l.precio; }); x.upd=ahora; } });
  provSel.compra=null; showToast('Compra registrada ✓'); abrirProveedor(p.id); refreshCurrentView();
}

// ---------- Insumos (catalogo) ----------
function renderAdminInsumos(c){
  const L=(finData.consumibles||[]).slice().sort((a,b)=>a.nombre.localeCompare(b.nombre));
  c.innerHTML=`<div class="sec-hdr" style="margin:6px 0 8px"><span class="sec-title">🧴 Insumos de trabajo (${L.length})</span><button class="lnk" onclick="editarConsumible('')">+ Insumo</button></div>
    <div class="card" style="margin-bottom:10px;font-size:12px;color:var(--muted2);line-height:1.5">Lo que se gasta en el salón para trabajar (no se vende). Se cargan desde <b style="color:var(--text)">Proveedores</b> y ahí se registran las compras, que suman al stock de acá. Cada uno rinde para cierta cantidad de servicios: con eso se calcula el costo por servicio en Finanzas.</div>
    ${L.map(x=>{ const pv=provData.list.find(p=>p.id===x.proveedorId); const bajo=numV(x.stock)<=numV(x.alerta||0)&&x.alerta!=null; const cps=numV(x.precio)/Math.max(1,numV(x.rinde));
      return `<div class="card" style="margin-bottom:8px;${bajo?'border-color:#f472b6':''}"><div style="display:flex;align-items:center;gap:10px"><div style="font-size:24px">🧴</div><div style="flex:1;min-width:0"><div style="font-size:14px;font-weight:800">${escH(x.nombre)}</div><div style="font-size:11.5px;color:var(--muted2)">${fp(x.precio)} por ${escH(x.unidad||'unidad')} · rinde ${x.rinde} servicios = <b style="color:var(--text)">${fp(cps)}</b> por servicio${pv?' · '+escH(pv.nombre):''}</div><div style="font-size:11.5px;font-weight:700;margin-top:2px;color:${bajo?'#f472b6':'var(--muted2)'}">En stock: ${numV(x.stock)} ${escH(x.unidad||'unidad')}${bajo?' ⚠️ queda poco':''} · alcanza para ~${Math.round(numV(x.stock)*numV(x.rinde))} servicios</div></div></div>
      <div style="display:flex;gap:12px;margin-top:6px;padding-left:34px"><button class="lnk" onclick="ajustarInsumo('${x.id}')">Ajustar stock</button><button class="lnk" onclick="editarConsumible('${x.id}')">Editar</button><button class="lnk" style="color:#f472b6" onclick="borrarConsumible('${x.id}')">Borrar</button></div></div>`; }).join('')||'<div class="empty"><div class="e-icon">🧴</div><p>Todavía no hay insumos.<br>Cargalos desde un proveedor o con "+ Insumo".</p></div>'}`;
}
async function ajustarInsumo(id){
  const x=(finData.consumibles||[]).find(z=>z.id===id); if(!x) return;
  const v=await uiPrompt('Stock de '+x.nombre,{msg:'Poné cuántas unidades hay ahora (contá lo que tenés).',label:'Unidades en stock',type:'number',value:numV(x.stock),ok:'Guardar'});
  if(v===null) return; await cambiarFin(d=>{ const z=d.consumibles.find(k=>k.id===id); if(z){ z.stock=numV(v); z.upd=new Date().toISOString(); } }); renderAdmin();
}
// ============ CUENTAS: sucursales multiples, editar todo, dar de baja ============
// Un profesional o una recepcionista puede trabajar en mas de una sucursal. "sucursales" es la lista; "sucursal" queda como la principal.
// Una sucursal "tiene recepcion" si hay una recepcionista asignada a ella (asi el admin decide que recepcion atiende las dos).
let usuariosBaja=[];
const sucursalesDe=(u)=>!u?[]:(Array.isArray(u.sucursales)&&u.sucursales.length?u.sucursales:(u.sucursal?[u.sucursal]:[]));
const todosLosUsuarios=()=>[...allUsers,...usuariosBaja];
function sucursalConRecepcion(sid){
  const asignadas=allUsers.filter(u=>u.role==='recepcionista'&&sucursalesDe(u).length);
  if(asignadas.length) return asignadas.some(u=>sucursalesDe(u).includes(sid));
  const s=sucursalDe(sid); return !(s&&s.recepcion===false);
}
const sinRecepcionId=(sid)=>!sucursalConRecepcion(sid);
// ¿esta persona atiende esa sucursal? (recepcion: las que tiene asignadas; si no tiene, todas las que tienen recepcion)
function atiende(u,sid){ const ss=sucursalesDe(u||profile); return ss.length?ss.includes(sid):sucursalConRecepcion(sid); }
// Sucursal en la que esta cobrando un profesional que trabaja en varias: la elegida en el cobro, o la ultima de hoy, o la principal
function sucursalActual(){
  const ss=sucursalesDe(profile);
  if(typeof cobro!=='undefined'&&cobro&&cobro.sucursal&&ss.includes(cobro.sucursal)) return cobro.sucursal;
  try{ const r=JSON.parse(localStorage.getItem('luffy_suc_hoy')||'null'); if(r&&r.f===hoyStr()&&ss.includes(r.id)) return r.id; }catch(e){}
  return ss[0]||(profile&&profile.sucursal)||null;
}
function cobroSuc(id){ cobro.sucursal=id; try{ localStorage.setItem('luffy_suc_hoy',JSON.stringify({f:hoyStr(),id})); }catch(e){} refreshCobro(); }
// Selector en el Inicio para quien trabaja en mas de una sucursal: elige donde esta HOY antes de arrancar a cobrar,
// asi "Registrar turno" (Diego Laure) vs "Cobro directo" (French) se decide bien desde el vamos.
function hubElegirSucursal(id){ try{ localStorage.setItem('luffy_suc_hoy',JSON.stringify({f:hoyStr(),id})); }catch(e){} renderHub(); }
function htmlSucursalHub(){
  const ss=sucursalesDe(profile); if(ss.length<2) return '';
  const act=sucursalActual();
  return `<div class="card" style="margin-bottom:10px"><div style="font-size:11px;font-weight:800;color:var(--muted);text-transform:uppercase;letter-spacing:.08em;margin-bottom:8px">📍 ¿Dónde estás hoy?</div>
    <div style="display:flex;gap:6px;flex-wrap:wrap">${ss.map(id=>{ const s=sucursalDe(id)||{id,nombre:id,color:'#4A136B'}; return `<button onclick="hubElegirSucursal('${id}')" style="${pillStyle(act===id,s.color)}">${escH(s.nombre)}</button>`; }).join('')}</div></div>`;
}
function renderSucCobro(){
  const el=document.getElementById('cb-suc'); if(!el) return; const ss=sucursalesDe(profile);
  if(ss.length<2){ el.innerHTML=''; return; }
  const act=sucursalActual();
  el.innerHTML=`<div class="field"><label>📍 ¿En qué sucursal estás?</label><div style="display:flex;gap:6px;flex-wrap:wrap">${ss.map(id=>{ const s=sucursalDe(id)||{id,nombre:id,color:'#4A136B'}; return `<button onclick="cobroSuc('${id}')" style="${pillStyle(act===id,s.color)}">${escH(s.nombre)}</button>`; }).join('')}</div></div>`;
}

// ---------- guardado seguro del listado de cuentas ----------
async function leerUsuariosFresco(){
  let lista=null, bajas=null;
  if(DB){ try{ const r=await DB.doc('luffy/users').get(); if(r&&Array.isArray(r.list)){ lista=r.list; bajas=r.bajas||[]; } }catch(e){} }
  if(!lista) lista=allUsers; if(!bajas) bajas=usuariosBaja;
  return {lista,bajas};
}
async function editarUsuario(id,patch){
  const {lista,bajas}=await leerUsuariosFresco();
  const u=lista.find(x=>x.id===id); if(!u) return false;
  Object.assign(u,patch); allUsers=lista; usuariosBaja=bajas; saveUsers(); return true;
}

// ---------- pantalla Cuentas ----------
const ROL_TXT={admin:'Administrador',profesional:'Profesional',recepcionista:'Recepcionista',encargado:'Encargado (cuenta vieja)'};
function renderAdminCuentas(c){
  const grupos=[['profesional','✂️ Profesionales'],['recepcionista','📞 Recepcionistas'],['encargado','📋 Encargado (cuenta vieja)'],['admin','👑 Administrador']];
  c.innerHTML=`<div class="sec-hdr" style="margin:6px 0 8px"><span class="sec-title">🔧 Cuentas del equipo</span><button class="lnk" style="margin-left:auto" onclick="abrirAnulados()">🗑 Anulados</button><button class="lnk" style="margin-left:8px" onclick="abrirRevisionAccesos()">🔎 Revisión de accesos</button></div>
    <div class="card" style="margin-bottom:10px;font-size:12px;color:var(--muted2);line-height:1.5">Desde acá podés cambiar todo de cada persona: <b style="color:var(--text)">nombre, rol, sucursales</b> (puede estar en más de una), rubros, comisión y <b style="color:var(--text)">darla de baja</b>. Las cuentas nuevas se aprueban en Estado.</div>
    ${grupos.map(([rol,tit])=>{ const L=allUsers.filter(u=>u.role===rol); if(!L.length) return ''; return `<div style="font-size:11px;font-weight:800;color:var(--muted);text-transform:uppercase;letter-spacing:.08em;margin:12px 0 6px">${tit}</div>${L.map(u=>`<div class="card" onclick="editarCuenta('${u.id}')" style="cursor:pointer;margin-bottom:6px;padding:10px 12px"><div style="display:flex;align-items:center;gap:10px"><div style="width:38px;height:38px;border-radius:50%;background:${(u.color||'#4A136B')}33;border:1.5px solid ${u.color||'#4A136B'};display:flex;align-items:center;justify-content:center;font-size:17px;flex-shrink:0">${u.emoji||'👤'}</div><div style="flex:1;min-width:0"><div style="font-size:13.5px;font-weight:800">${escH(u.name)} <span style="font-size:11px;font-weight:600;color:var(--muted2)">@${escH(u.username||'')}</span>${u.esEncargado?' <span style="font-size:10px;background:rgba(52,211,153,.18);color:#34d399;border-radius:6px;padding:1px 6px">ENCARGADO</span>':''}${u.role==='admin'&&u.tambienProf?' <span style="font-size:10px;background:rgba(74,19,107,.18);color:#a89fff;border-radius:6px;padding:1px 6px">TAMBIÉN PROFESIONAL</span>':''}</div><div style="display:flex;gap:4px;flex-wrap:wrap;margin-top:3px">${sucursalesDe(u).map(s=>chipSucursal(s,true)).join('')||'<span style="font-size:10.5px;color:var(--muted)">sin sucursal</span>'}${esProf(u)&&u.rubros&&u.rubros.length?`<span style="font-size:10.5px;color:var(--muted2)">· ${escH(u.rubros.map(nombreRubro).filter(Boolean).join(', '))}</span>`:''}</div></div><span style="color:var(--muted)">✏️</span></div></div>`).join('')}`; }).join('')}
    ${usuariosBaja.length?`<details class="card" style="margin-top:14px"><summary style="cursor:pointer;font-size:13px;font-weight:800;color:var(--muted2)">🗄 Dados de baja (${usuariosBaja.length})</summary>${usuariosBaja.map(u=>`<div class="ln"><span>${escH(u.name)} <i style="color:var(--muted)">· ${ROL_TXT[u.role]||u.role} · baja ${u.baja?fechaCortaStr(u.baja):''}</i></span><button class="lnk" onclick="reactivarCuenta('${u.id}')">Reactivar</button></div>`).join('')}<div style="font-size:10.5px;color:var(--muted);margin-top:6px">Sus cobros y su historia se conservan en los reportes.</div></details>`:''}`;
}
function editarCuenta(id){
  const u=allUsers.find(x=>x.id===id); if(!u) return; const esPro=u.role==='profesional'||(u.role==='admin'&&!!u.tambienProf), esRec=u.role==='recepcionista', esAdm=u.role==='admin';
  const btnClave=`<button class="btn btn-ghost" style="margin-top:10px" onclick="resetearClaveCuenta('${u.id}')">🔑 Resetear contraseña</button>`;
  document.getElementById('registro-content').innerHTML=cabeceraModal('Editar cuenta')+btnClave+`
    <div style="font-size:11.5px;color:var(--muted2);margin:-4px 0 10px">Usuario: <b>@${escH(u.username||'')}</b> (no se cambia)</div>
    <div class="field"><label>Nombre</label><input id="ec-nombre" value="${escH(u.name)}"/></div>
    <div style="display:flex;gap:8px;margin-top:8px"><div class="field" style="flex:1"><label>Emoji</label><input id="ec-emoji" value="${escH(u.emoji||'')}" placeholder="✂️"/></div><div class="field" style="flex:1"><label>Color</label><input id="ec-color" type="color" value="${u.color||'#4A136B'}" style="height:46px;padding:4px"/></div></div>
    ${esAdm?`<label class="rub-opt" style="margin-top:8px"><input type="checkbox" id="ec-tprof" ${u.tambienProf?'checked':''}/> ✂️ También trabajo como profesional (atiendo clientes, cobro y tengo comisión como el resto)</label>
    <div class="field" style="margin-top:8px"><label>Sucursales donde atiendo</label>${sucursales.map(s=>`<label class="rub-opt" style="border-left:5px solid ${s.color}"><input type="checkbox" class="ec-suc" value="${s.id}" ${sucursalesDe(u).includes(s.id)?'checked':''}/> ${escH(s.nombre)}</label>`).join('')}</div>
    ${u.tambienProf?'':'<div style="font-size:11px;color:var(--muted);margin-top:4px">Tildá la casilla y guardá: después vas a poder elegir tus rubros y tu comisión.</div>'}`:''}
    ${esAdm?'':`<div class="field" style="margin-top:8px"><label>Rol</label><select id="ec-rol" style="${selFin}"><option value="profesional" ${u.role==='profesional'?'selected':''}>Profesional</option><option value="recepcionista" ${u.role==='recepcionista'?'selected':''}>Recepcionista</option>${u.role==='encargado'?'<option value="encargado" selected>Encargado (cuenta vieja)</option>':''}</select></div>
    <div class="field" style="margin-top:8px"><label>Sucursales donde trabaja${esRec?' (a cuáles atiende)':''}</label>${sucursales.map(s=>`<label class="rub-opt" style="border-left:5px solid ${s.color}"><input type="checkbox" class="ec-suc" value="${s.id}" ${sucursalesDe(u).includes(s.id)?'checked':''}/> ${escH(s.nombre)}</label>`).join('')}<div style="font-size:11px;color:var(--muted);margin-top:4px">${esRec?'Si atiende las dos sucursales, le llega todo de las dos y en French los profesionales ya no cierran sus turnos.':'Si trabaja en dos, al cobrar elige en cuál está.'}</div></div>`}
    ${esPro?`<div style="display:flex;gap:8px;margin-top:10px"><button class="btn btn-ghost" style="flex:1" onclick="abrirRubrosProf('${u.id}')">🏷️ Rubros</button><button class="btn btn-ghost" style="flex:1" onclick="abrirComisionUsuario('${u.id}')">💰 Comisión</button><button class="btn btn-ghost" style="flex:1" onclick="abrirHorarioProf('${u.id}')">🕒 Horario</button></div>
    <label class="rub-opt" style="margin-top:8px"><input type="checkbox" id="ec-enc" ${u.esEncargado?'checked':''}/> 📦 Es encargado (controla el stock, comisión fija)</label>
    <div class="sec-title" style="margin:14px 0 8px">Datos para el contador (ficha de referencia)</div>
    <div class="field"><label>Alias o cuenta de Mercado Pago</label><input id="ec-mp" value="${escH(u.aliasMP||'')}" placeholder="Ej: fede.barbero.mp"/></div>
    <div class="field" style="margin-top:8px"><label>Monotributo (categoría / costo mensual)</label><input id="ec-mono" value="${escH(u.monotributo||'')}" placeholder="Ej: Categoría C, $45.000/mes"/></div>
    <div class="field" style="margin-top:8px"><label>Obra social</label><input id="ec-os" value="${escH(u.obraSocial||'')}" placeholder="Ej: OSDE, propia"/></div>`:''}
    <button class="btn btn-primary" onclick="guardarCuenta('${u.id}')" style="margin-top:14px">Guardar cambios</button>
    ${profile&&profile.id!==u.id?(u.passReset?`<div class="card" style="margin-top:10px;border:1.5px solid #fbbf24;background:rgba(251,191,36,.08);font-size:12px;color:#fbbf24;font-weight:700">🔓 Habilitado: puede definir una contraseña nueva la próxima vez que entre. Se cierra solo apenas la cambie.</div><button class="btn btn-ghost" onclick="cancelarCambioPassword('${u.id}')" style="margin-top:8px">Cancelar habilitación</button>`:`<button class="btn btn-ghost" onclick="habilitarCambioPassword('${u.id}')" style="margin-top:8px">🔓 Habilitar cambio de contraseña</button>`):''}
    ${esAdm?'':`<button class="btn btn-ghost" onclick="darDeBaja('${u.id}')" style="margin-top:8px;color:#f472b6">🗄 Dar de baja</button>`}`;
  openModal('modal-registro');
}
async function habilitarCambioPassword(id){
  const u=allUsers.find(x=>x.id===id); if(!u) return;
  if(await editarUsuario(id,{passReset:true})){ showToast('Habilitado: '+u.name+' puede definir una contraseña nueva la próxima vez que entre'); editarCuenta(id); }
}
async function cancelarCambioPassword(id){
  const u=allUsers.find(x=>x.id===id); if(!u) return;
  if(await editarUsuario(id,{passReset:false})){ showToast('Cancelado'); editarCuenta(id); }
}
async function guardarCuenta(id){
  const u=allUsers.find(x=>x.id===id); if(!u) return;
  const nombre=document.getElementById('ec-nombre').value.trim(); if(!nombre){ showToast('Poné el nombre'); return; }
  const patch={name:nombre,emoji:document.getElementById('ec-emoji').value.trim()||u.emoji,color:document.getElementById('ec-color').value};
  const rolSel=document.getElementById('ec-rol');
  if(rolSel){
    const ss=[...document.querySelectorAll('.ec-suc:checked')].map(x=>x.value);
    patch.sucursales=ss; patch.sucursal=ss[0]||null;
    if(rolSel.value!==u.role){
      if(supaClient){ const {error}=await supaClient.from('luffy_roles').update({role:rolSel.value}).eq('app_id',id); if(error){ showToast('No se pudo cambiar el rol: '+error.message); return; } }
      patch.role=rolSel.value; if(rolSel.value==='recepcionista') patch.esEncargado=false;
    }
  }
  const tp=document.getElementById('ec-tprof');
  if(tp){ patch.tambienProf=tp.checked; const ss=[...document.querySelectorAll('.ec-suc:checked')].map(x=>x.value); patch.sucursales=ss; patch.sucursal=ss[0]||null; }
  const enc=document.getElementById('ec-enc'); if(enc){ patch.esEncargado=enc.checked; if(enc.checked!==!!u.esEncargado) patch.comisionFija=null; }
  const mp=document.getElementById('ec-mp'); if(mp){ patch.aliasMP=mp.value.trim(); patch.monotributo=document.getElementById('ec-mono').value.trim(); patch.obraSocial=document.getElementById('ec-os').value.trim(); }
  if(await editarUsuario(id,patch)){ closeModal('modal-registro'); showToast('Cuenta actualizada ✓'); renderAdmin(); }
}
async function darDeBaja(id){
  const u=allUsers.find(x=>x.id===id); if(!u) return;
  if(profile&&profile.id===id){ showToast('No podés dar de baja tu propia cuenta'); return; }
  if(!await uiConfirm('¿Dar de baja a '+u.name+'?','Deja de poder entrar a la app y desaparece de las listas. Sus cobros y su historia se conservan en los reportes. Después la podés reactivar.',{ok:'Dar de baja',danger:true})) return;
  let uid=null;
  if(supaClient){
    const r=await supaClient.from('luffy_roles').select('uid').eq('app_id',id).maybeSingle(); uid=r.data?r.data.uid:null;
    const d=await supaClient.from('luffy_roles').delete().eq('app_id',id); if(d.error){ showToast('No se pudo dar de baja: '+d.error.message); return; }
  }
  const {lista,bajas}=await leerUsuariosFresco();
  const x=lista.find(z=>z.id===id); if(!x){ renderAdmin(); return; }
  allUsers=lista.filter(z=>z.id!==id); usuariosBaja=[...bajas.filter(z=>z.id!==id),{...x,baja:hoyStr(),uid}]; saveUsers();
  closeModal('modal-registro'); showToast(x.name+' quedó dada de baja'); renderAdmin();
}
async function reactivarCuenta(id){
  const b=usuariosBaja.find(x=>x.id===id); if(!b) return;
  if(!await uiConfirm('¿Reactivar a '+b.name+'?','Vuelve a poder entrar con su mismo usuario y contraseña.',{ok:'Reactivar'})) return;
  if(supaClient&&b.uid){ const {error}=await supaClient.from('luffy_roles').upsert({uid:b.uid,app_id:b.id,role:b.role},{onConflict:'uid'}); if(error){ showToast('No se pudo reactivar: '+error.message); return; } }
  else if(!b.uid){ showToast('No tengo su cuenta guardada: que se registre de nuevo y la aprobás'); return; }
  const {lista,bajas}=await leerUsuariosFresco(); const {baja,uid,...u}=bajas.find(z=>z.id===id)||b;
  allUsers=[...lista.filter(z=>z.id!==id),u]; usuariosBaja=bajas.filter(z=>z.id!==id); saveUsers(); showToast(u.name+' reactivada ✓'); renderAdmin();
}
async function abrirRevisionAccesos(){
  if(!profile||profile.role!=='admin') return;
  if(!supaClient){ showToast('Sin conexión a la base'); return; }
  const r=await supaClient.from('luffy_roles').select('uid,app_id,role');
  if(r.error){ showToast('No se pudo leer luffy_roles: '+r.error.message); return; }
  const filas=r.data||[], porApp=new Map(filas.map(f=>[f.app_id,f]));
  const idsApp=new Set([...allUsers,...usuariosBaja].map(u=>u.id));
  const ROJO='#f472b6', VERDE='#34d399', GRIS='#94a3b8', AMARILLO='#fbbf24';
  const linea=(u,estado,color,detalle)=>`<div class="ln" style="align-items:flex-start;border-left:4px solid ${color};padding-left:8px;margin-bottom:6px"><span><b>${escH(u.name||u.app_id)}</b> <i style="color:var(--muted)">@${escH(u.username||'')}</i><div style="font-size:11.5px;color:var(--muted2)">${detalle}</div></span><span style="font-size:11px;font-weight:800;color:${color};white-space:nowrap;margin-left:8px">${estado}</span></div>`;
  const activas=allUsers.map(u=>{ const f=porApp.get(u.id);
    if(!f) return linea(u,'ACTIVA SIN ROL',ROJO,`Rol en la app: ${ROLES[u.role]||u.role}. Sin fila en luffy_roles: se quedaría afuera al bloquear.`);
    const dif=f.role!==u.role?` · <b style="color:${AMARILLO}">rol distinto: app ${ROLES[u.role]||u.role}, Supabase ${f.role}</b>`:'';
    return linea(u,'activa',VERDE,`Rol en la app: ${ROLES[u.role]||u.role} · en Supabase: ${f.role}${dif}`); }).join('');
  const bajas=usuariosBaja.map(u=>{ const f=porApp.get(u.id);
    if(f) return linea(u,'DE BAJA CON ROL',ROJO,`Dada de baja el ${fechaCortaStr(u.baja||hoyStr())}, pero su fila en luffy_roles sigue con rol ${f.role}: sigue autorizada.<div style="margin-top:6px"><button class="btn btn-ghost" style="padding:6px 10px;font-size:12px" onclick="revocarAccesoBaja('${u.id}')">Revocar acceso</button></div>`);
    return linea(u,'de baja',GRIS,`Dada de baja el ${fechaCortaStr(u.baja||hoyStr())}. Sin acceso.`); }).join('');
  const huerfanas=filas.filter(f=>!idsApp.has(f.app_id)).map(f=>`<div class="ln" style="border-left:4px solid ${ROJO};padding-left:8px;margin-bottom:6px"><span><b>app_id ${escH(f.app_id)}</b><div style="font-size:11.5px;color:var(--muted2)">Rol ${escH(f.role)} · uid ${escH(f.uid)} · sin cuenta en la app</div></span><span style="font-size:11px;font-weight:800;color:${ROJO}">HUÉRFANA</span></div>`).join('');
  const porAppCuenta={}; filas.forEach(f=>{ (porAppCuenta[f.app_id]=porAppCuenta[f.app_id]||[]).push(f); });
  const dobles=Object.entries(porAppCuenta).filter(([,L])=>L.length>1).map(([app,L])=>`<div class="ln" style="border-left:4px solid ${AMARILLO};padding-left:8px;margin-bottom:6px"><span><b>app_id ${escH(app)}</b><div style="font-size:11.5px;color:var(--muted2)">${L.map(f=>'rol '+escH(f.role)+' · uid '+escH(f.uid)).join(' · ')}</div></span><span style="font-size:11px;font-weight:800;color:${AMARILLO}">DOBLE</span></div>`).join('');
  const sec=(t)=>`<div style="font-size:11px;font-weight:800;color:var(--muted);text-transform:uppercase;letter-spacing:.08em;margin:12px 0 6px">${t}</div>`;
  document.getElementById('registro-content').innerHTML=cabeceraModal('🔎 Revisión de accesos')+
    `<div style="font-size:12px;color:var(--muted2);line-height:1.5">Compara cada cuenta de la app con la tabla de roles de Supabase. Rojo = hay que mirar antes de correr el 03/04.</div>`+
    sec(`Cuentas activas (${allUsers.length})`)+(activas||'<div class="empty"><p>No hay cuentas activas.</p></div>')+
    sec(`Dadas de baja (${usuariosBaja.length})`)+(bajas||'<div class="empty"><p>No hay bajas.</p></div>')+
    sec(`Filas de roles sin cuenta en la app (${filas.filter(f=>!idsApp.has(f.app_id)).length})`)+(huerfanas||'<div class="empty"><p>Ninguna.</p></div>')+
    sec(`Cuentas con más de una fila de roles (${Object.values(porAppCuenta).filter(L=>L.length>1).length})`)+(dobles||'<div class="empty"><p>Ninguna.</p></div>');
  openModal('modal-registro');
}
async function revocarAccesoBaja(id){
  const b=usuariosBaja.find(x=>x.id===id); if(!b||!supaClient) return;
  const r=await supaClient.from('luffy_roles').select('uid').eq('app_id',id);
  if(r.error||!r.data||!r.data.length){ showToast('No encuentro la fila de roles de esa cuenta'); return; }
  if(!await uiConfirm('¿Revocar el acceso de '+b.name+'?','Se borra su fila de roles: no va a poder leer ni escribir datos. Se puede reactivar desde "Dados de baja".',{ok:'Revocar',danger:true})) return;
  const d=await supaClient.from('luffy_roles').delete().eq('app_id',id);
  if(d.error){ showToast('No se pudo revocar: '+d.error.message); return; }
  showToast('Acceso de '+b.name+' revocado ✓'); abrirRevisionAccesos();
}
// ---------- anulados: nada se borra, se puede ver y restaurar ----------
function abrirAnulados(){
  if(!profile||profile.role!=='admin') return;
  const grupos=[
    ['Clientes',clientesAnulados,'clientes',c=>c.nombre],
    ['Gastos',(finData.gastos||[]).filter(x=>x.anulado),'gastos',x=>x.nombre||x.descripcion||x.categoria||'Gasto'],
    ['Gastos fijos',(finData.fijos||[]).filter(x=>x.anulado),'fijos',x=>x.nombre||'Gasto fijo'],
    ['Insumos',(finData.consumibles||[]).filter(x=>x.anulado),'consumibles',x=>x.nombre||'Insumo'],
    ['Proveedores',(provData.list||[]).filter(x=>x.anulado),'proveedores',x=>x.nombre||'Proveedor'],
  ];
  const sec=(t)=>`<div style="font-size:11px;font-weight:800;color:var(--muted);text-transform:uppercase;letter-spacing:.08em;margin:12px 0 6px">${t}</div>`;
  const html=grupos.map(([t,L,tipo,nom])=>sec(`${t} (${L.length})`)+(L.map(x=>`<div class="ln" style="align-items:flex-start;margin-bottom:6px"><span><b>${escH(nom(x))}</b><div style="font-size:11.5px;color:var(--muted2)">Anulado por ${escH(x.anulado.por||'')} el ${fechaCortaStr((x.anulado.ts||'').slice(0,10))} · "${escH(x.anulado.motivo||'')}"</div></span><button class="lnk" onclick="restaurarAnulado('${tipo}','${x.id}')">Restaurar</button></div>`).join('')||'<div style="font-size:12px;color:var(--muted)">Ninguno.</div>')).join('');
  document.getElementById('registro-content').innerHTML=cabeceraModal('🗑 Anulados')+`<div style="font-size:12px;color:var(--muted2);line-height:1.5">Lo que se anuló queda acá con quién y cuándo. Restaurar lo vuelve a contar en la app.</div>`+html;
  openModal('modal-registro');
}
async function restaurarAnulado(tipo,id){
  if(!await uiConfirm('¿Restaurar este registro?','Vuelve a contar en la app.',{ok:'Restaurar'})) return;
  if(tipo==='clientes') await cambiarClientes(l=>{ const x=l.find(z=>z.id===id); if(x) restaurarRegistro(x); });
  else if(tipo==='proveedores') await cambiarProv(d=>{ const x=d.list.find(z=>z.id===id); if(x) restaurarRegistro(x); });
  else { const key={gastos:'gastos',fijos:'fijos',consumibles:'consumibles'}[tipo]; await cambiarFin(d=>{ const x=(d[key]||[]).find(z=>z.id===id); if(x) restaurarRegistro(x); }); }
  abrirAnulados(); renderAdmin();
}
// ---------- sucursales de una persona (varias) ----------
function abrirSucursalProf(profId){
  const u=allUsers.find(x=>x.id===profId); if(!u) return;
  document.getElementById('registro-content').innerHTML=cabeceraModal('Sucursales de '+escH(u.name))+`<div style="font-size:12px;color:var(--muted2);margin-bottom:12px">Podés marcar más de una. En recepción sus cobros se ven con el color de la sucursal donde cobró.</div>
    ${sucursales.map(s=>`<label class="rub-opt" style="border-left:5px solid ${s.color}"><input type="checkbox" class="ec-suc" value="${s.id}" ${sucursalesDe(u).includes(s.id)?'checked':''}/> ${escH(s.nombre)}</label>`).join('')}
    <button class="btn btn-primary" onclick="guardarSucursalProf('${u.id}')" style="margin-top:10px">Guardar</button>`;
  openModal('modal-registro');
}
async function guardarSucursalProf(profId){
  const ss=[...document.querySelectorAll('.ec-suc:checked')].map(x=>x.value); if(!ss.length){ showToast('Elegí al menos una sucursal'); return; }
  if(await editarUsuario(profId,{sucursales:ss,sucursal:ss[0]})){ closeModal('modal-registro'); showToast('Sucursales guardadas ✓'); refreshCurrentView(); }
}

// ============ COMISIONES: esquemas, tramos editables y monto asegurado ============
// Tres esquemas por persona:
//  - "tramos" (el de siempre): 45% base, 50% desde $1.000.000, 55% desde $1.200.000, 60% con 3 reels (todo editable)
//  - "nuevo": primeros N meses desde su inicio: 50% sin mirar facturacion + 5% por contenido (3 reels) + 5% si supera $800.000
//  - "fija": un % fijo (el encargado, 60%)
// Monto asegurado: si tiene un "piso", desde la quincena en que llega a ese piso se le asegura el 50% del piso como minimo.
// Si en una quincena posterior factura menos que el piso, el admin decide si se lo da igual o no.
const COMISIONES_DEFAULT={
  tramos:[{min:0,pct:45},{min:1000000,pct:50},{min:1200000,pct:55}],
  oro:{min:1200000,pct:60,reels:3},
  nuevos:{meses:2,base:50,contenido:5,reels:3,extra:5,extraDesde:800000},
  asegurado:{pct:50},
};
const comCfg=()=>{ const d=clonar(COMISIONES_DEFAULT), p=promos.comisiones||{}; return {tramos:p.tramos||d.tramos,oro:{...d.oro,...(p.oro||{})},nuevos:{...d.nuevos,...(p.nuevos||{})},asegurado:{...d.asegurado,...(p.asegurado||{})}}; };
function tramosVigentes(){
  const t=comCfg().tramos.slice().sort((a,b)=>a.min-b.min);
  return t.map((x,i)=>({min:numV(x.min),max:t[i+1]?numV(t[i+1].min)-1:Infinity,pct:numV(x.pct),label:['Base','Bronce','Plata','Plata+','Élite'][i]||('Tramo '+(i+1)),color:TRAMOS[Math.min(i,2)].color,emoji:TRAMOS[Math.min(i,2)].emoji}));
}
const tramoOro=()=>({...TRAMO_ORO,pct:comCfg().oro.pct,min:comCfg().oro.min,reels:comCfg().oro.reels});
function sumaMeses(f,n){ const [y,m,d]=f.split('-').map(Number); const t=new Date(Date.UTC(y,m-1+n,1)); return t.getUTCFullYear()+'-'+pad2(t.getUTCMonth()+1)+'-'+pad2(Math.min(d,finMesUTC(t.getUTCFullYear(),t.getUTCMonth()+1))); }
function esNuevoEn(u,f){ return !!u&&u.esquema==='nuevo'&&!!u.inicio&&(f||hoyStr())<sumaMeses(u.inicio,comCfg().nuevos.meses); }
function comisionFijaDe(u){ if(!u) return null; if(u.esquema==='fija'||u.esEncargado) return numV(u.comisionFija)>0?numV(u.comisionFija):60; return null; }
// Podología/cosmetología/cejas/masajes cobran un % propio (70% por defecto, confirmado 21/09/2026) en vez del tramo
// general de siempre — solo para quien SOLO hace esos rubros (si mezcla con barbería/peluquería, sigue por tramo
// hasta que exista comisión por servicio en vez de por facturación total de la quincena).
function comisionPorRubroDe(u){
  if(!u||!u.rubros||!u.rubros.length) return null;
  if(!u.rubros.every(r=>RUBROS_ALTA_COM.includes(r))) return null;
  return comisionRubroEstim(u.rubros[0]);
}
function calcComision(fact,reelsQ,u,fechaRef){
  const cfg=comCfg(); const cf=comisionFijaDe(u);
  if(cf) return {comision:fact*cf/100, pct:cf, esOro:false, fija:true, tramo:{min:0,max:Infinity,pct:cf,label:'Fija',color:'#34d399',emoji:'📦'}};
  const cr=comisionPorRubroDe(u);
  if(cr) return {comision:fact*cr/100, pct:cr, esOro:false, porRubro:true, tramo:{min:0,max:Infinity,pct:cr,label:'Por rubro',color:'#e879f9',emoji:'🧴'}};
  if(esNuevoEn(u,fechaRef)){
    const n=cfg.nuevos, cont=reelsQ>=n.reels, extra=fact>=n.extraDesde; const pct=n.base+(cont?n.contenido:0)+(extra?n.extra:0);
    return {comision:fact*pct/100, pct, esOro:false, nuevo:true, detNuevo:{base:n.base,cont,extra,n}, tramo:{min:0,max:Infinity,pct,label:'Nuevo',color:'#60a5fa',emoji:'🌟'}};
  }
  const T=tramosVigentes(); let tramo=T[0]; for(const t of T) if(fact>=t.min) tramo=t;
  const esOro=fact>=cfg.oro.min&&reelsQ>=cfg.oro.reels; const pct=esOro?cfg.oro.pct:tramo.pct;
  return {comision:fact*pct/100, pct, esOro, tramo, tramos:T};
}
// ---------- quincenas ----------
const qStart=(qk)=>{ const p=qk.split('-'); return p[0]+'-'+p[1]+'-'+(p[2]==='1'?'01':'16'); };
const qEnd=(qk)=>{ const p=qk.split('-'); return p[0]+'-'+p[1]+'-'+(p[2]==='1'?'15':pad2(finMesUTC(Number(p[0]),Number(p[1])))); };
function factPorQuincena(turnos){ const m={}; (turnos||[]).forEach(t=>{ if(!t.fecha) return; const k=quincenaKey(t.fecha); m[k]=(m[k]||0)+numV(t.monto); }); return m; }
function reelsDeQuincena(u,qk){ return reels.filter(r=>r.stage==='publicado'&&u&&r.asignado===u.name&&r.fecha&&quincenaKey(r.fecha)===qk).length; }
// Comision base de una quincena (sin el asegurado)
function comisionQuincenaDe(u,qk,turnos){
  const fm=factPorQuincena(turnos), fact=fm[qk]||0; const c=calcComision(fact,reelsDeQuincena(u,qk),u,qStart(qk));
  const ts=(turnos||[]).filter(t=>t.fecha&&quincenaKey(t.fecha)===qk);
  let normal=0, extra=0, paqNormal=0, paqExtra=0;
  ts.forEach(t=>{
    const monto=numV(t.monto), n=monto*c.pct/100, real=comTurno(t,c.pct), ex=Math.max(0,real-n);
    normal+=n; extra+=ex;
    const credPaq=numV(t.paqueteCredito||0);
    if(credPaq>0){
      paqNormal+=credPaq*c.pct/100;
      const fijaPaq=numV(t.paqueteComFija||0);
      if(fijaPaq>0) paqExtra+=Math.max(0,fijaPaq-credPaq*c.pct/100);
    }
  });
  return {fact,pct:c.pct,comision:normal+extra,normal,extra,paqNormal,paqExtra};
}
let decisionesCom={};
function loadDecisionesCom(){
  try{ decisionesCom=JSON.parse(localStorage.getItem('luffy_decisiones_com')||'{}'); }catch(e){ decisionesCom={}; }
  if(DB) DB.doc('luffy/decisiones_com').get().then(r=>{ if(r&&JSON.stringify(r)!==JSON.stringify(decisionesCom)){ decisionesCom=r; try{localStorage.setItem('luffy_decisiones_com',JSON.stringify(decisionesCom));}catch(e){} refreshCurrentView(); } }).catch(()=>{});
}
async function decidirAsegurado(uid,qk,d){
  let base=decisionesCom; if(DB){ try{ const r=await DB.doc('luffy/decisiones_com').get(); if(r) base={...r,...base}; }catch(e){} }
  base[uid+'|'+qk]={d,ts:new Date().toISOString(),por:profile.name}; decisionesCom=base;
  try{localStorage.setItem('luffy_decisiones_com',JSON.stringify(decisionesCom));}catch(e){}
  if(DB){ try{ await DB.doc('luffy/decisiones_com').set(decisionesCom); }catch(e){} }
  showToast(d==='dar'?'Se lo das igual ✓':'No se lo das'); renderAdmin();
}
// Estado del monto asegurado de una persona en una quincena. comBase = comision que le toca sin el asegurado.
function estadoAsegurado(u,qk,factMap,comBase){
  const piso=numV(u&&u.piso); if(!(piso>0)||comisionFijaDe(u)||esNuevoEn(u,qStart(qk))) return null;
  if(!Object.keys(factMap).some(k=>k<=qk&&factMap[k]>=piso)) return null; // todavia no llego al piso
  const garantizado=Math.round(piso*comCfg().asegurado.pct/100); const fact=factMap[qk]||0;
  if(comBase>=garantizado) return {estado:'ok',garantizado,extra:0,piso,fact};
  const extra=Math.round(garantizado-comBase);
  if(fact>=piso) return {estado:'auto',garantizado,extra,piso,fact};
  if(qk===quincenaKey(hoyStr())) return {estado:'en_curso',garantizado,extra,piso,fact};
  const d=decisionesCom[u.id+'|'+qk];
  return {estado:d?(d.d==='dar'?'dado':'no'):'pendiente',garantizado,extra,piso,fact};
}
const extraAplicable=(a)=>a&&(a.estado==='auto'||a.estado==='dado')?a.extra:0;
// Asegurados de todo el equipo cuyo pago (fin de quincena) cae en el rango
function extrasAsegurado(D,desde,hasta){
  const out=[]; const porU={};
  D.turnos.forEach(t=>{ (porU[t.prof.id]=porU[t.prof.id]||{prof:t.prof,turnos:[]}).turnos.push(t); });
  Object.values(porU).forEach(({prof,turnos})=>{
    if(!(numV(prof.piso)>0)) return; const fm=factPorQuincena(turnos);
    Object.keys(fm).forEach(qk=>{ const fin=qEnd(qk); if(fin<desde||fin>hasta) return; const a=estadoAsegurado(prof,qk,fm,comisionQuincenaDe(prof,qk,turnos).comision); if(a&&a.estado!=='ok') out.push({prof,qk,fin,...a});});
  });
  return out;
}
function pendientesAsegurado(){
  const D=adminDatos(); const hoy=hoyStr(); return extrasAsegurado(D,addDias(hoy,-120),hoy).filter(x=>x.estado==='pendiente');
}
// ---------- pantalla del profesional: su asegurado ----------
function htmlAseguradoProf(a){
  if(!a||a.estado==='ok') return a&&a.estado==='ok'?`<div style="font-size:11.5px;color:var(--muted2);margin:6px 2px 10px">🛡 Monto asegurado activo: mínimo ${fp(a.garantizado)} por quincena (${comCfg().asegurado.pct}% de tu piso de ${fp(a.piso)}). Este período lo superaste.</div>`:'';
  const txt={auto:'Llegaste al piso: se te completa hasta el mínimo asegurado.',dado:'El admin decidió dártelo igual ✓',no:'El admin decidió no completártelo esta vez.',pendiente:'Facturaste menos que el piso: el admin lo revisa y decide.',en_curso:'Si esta quincena no llegás al piso de '+fp(a.piso)+', el admin revisa si te lo da igual.'}[a.estado];
  const col=a.estado==='no'?'#f472b6':(a.estado==='pendiente'||a.estado==='en_curso'?'#fbbf24':'#34d399');
  return `<div style="border:1.5px solid ${col}55;background:${col}12;border-radius:14px;padding:10px 12px;margin:6px 0 12px;font-size:12px;line-height:1.5"><b style="color:${col}">🛡 Monto asegurado: ${fp(a.garantizado)}</b> (${comCfg().asegurado.pct}% de tu piso de ${fp(a.piso)})<br>${txt}${a.estado==='auto'||a.estado==='dado'?` Se suman <b>${fp(a.extra)}</b> a tu comisión.`:''}</div>`;
}
// ---------- admin: Equipo → Comisiones ----------
// Lo que anotó un profesional de gastos con el MP del local, dentro de una quincena puntual (se descuenta solo
// de lo que se le paga — ver abrirFormGastoMP en 12-dinero-turnos.js).
function gastosMPQuincena(profId,qk){
  let dd={};
  if(profile&&profile.id===profId&&typeof dineroData!=='undefined'&&dineroData) dd=dineroData;
  else { try{ dd=JSON.parse(localStorage.getItem('luffy_dinero_'+profId)||'{}'); }catch(e){} }
  return (dd.gastosMP||[]).filter(g=>g.fecha&&quincenaKey(g.fecha)===qk).reduce((a,g)=>a+numV(g.monto),0);
}
function renderAdminComisiones(c){
  const cfg=comCfg(), T=tramosVigentes(), n=cfg.nuevos;
  const D=adminDatos(); const qk=quincenaKey(hoyStr());
  const pros=allUsers.filter(u=>esProf(u));
  const esq=(u)=>comisionFijaDe(u)?'Fija '+comisionFijaDe(u)+'%':(u.esquema==='nuevo'?(esNuevoEn(u)?'Nuevo (hasta '+fechaCortaStr(sumaMeses(u.inicio,n.meses))+')':'Nuevo → ya pasó a tramos'):'Por tramos');
  const filas=pros.map(u=>{ const ts=D.turnos.filter(t=>t.prof.id===u.id); const r=comisionQuincenaDe(u,qk,ts); const a=estadoAsegurado(u,qk,factPorQuincena(ts),r.comision); const gmp=gastosMPQuincena(u.id,qk); const ad=adelantoDeQuincena(u,D,qk); const neto=r.comision-gmp-ad.desc;
    return `<div class="card" style="margin-bottom:6px;padding:10px 12px"><div style="display:flex;align-items:center;gap:10px"><div style="flex:1;min-width:0"><div style="font-size:13px;font-weight:800">${escH(u.name)}</div><div style="font-size:11.5px;color:var(--muted2)">${esq(u)}${numV(u.piso)>0?' · piso '+fpk(u.piso):''} · esta quincena ${fp(r.fact)} → <b style="color:var(--text)">${r.pct}%</b> = ${fp(r.comision)}${a&&extraAplicable(a)?' + '+fp(extraAplicable(a))+' asegurado':''}${gmp>0?' · <b style="color:#f472b6">−'+fp(gmp)+' MP del local</b>':''}${ad.desc>0?' · <b style="color:#fbbf24">−'+fp(ad.desc)+' adelanto</b>':''}${(gmp>0||ad.desc>0)?' = <b style="color:var(--text)">'+fp(neto)+'</b>':''}${ad.arrastre>0?' · <span style="color:#fbbf24">queda '+fp(ad.arrastre)+' de adelanto para la quincena que viene</span>':''}</div></div><button class="lnk" onclick="abrirComisionUsuario('${u.id}')">Cambiar</button></div></div>`; }).join('');
  const pend=pendientesAsegurado();
  c.innerHTML=`${htmlAdelantosAdmin()}${pend.length?`<div class="sec-title" style="margin:6px 0 8px;color:#fbbf24">🛡 Asegurados por decidir (${pend.length})</div>${pend.map(x=>`<div class="card" style="margin-bottom:8px;border-color:rgba(251,191,36,.5)"><div style="font-size:13px;font-weight:800">${escH(x.prof.name)} · quincena ${fechaCortaStr(qStart(x.qk))} al ${fechaCortaStr(x.fin)}</div><div style="font-size:12px;color:var(--muted2);margin:3px 0 8px;line-height:1.5">Facturó ${fp(x.fact)} (su piso es ${fpk(x.piso)}). Le corresponde el mínimo asegurado de ${fp(x.garantizado)}: le faltan <b style="color:var(--text)">${fp(x.extra)}</b> para completarlo. Mirá por qué bajó y decidí.</div><div style="display:flex;gap:8px"><button class="btn btn-primary" style="flex:1" onclick="decidirAsegurado('${x.prof.id}','${x.qk}','dar')">Dárselo igual</button><button class="btn btn-ghost" style="flex:1" onclick="decidirAsegurado('${x.prof.id}','${x.qk}','no')">No dárselo</button></div></div>`).join('')}`:''}
    <div class="sec-hdr" style="margin:10px 0 8px"><span class="sec-title">💰 Cómo se paga a cada uno</span></div>${filas||'<div class="empty"><p>No hay profesionales.</p></div>'}
    <div class="sec-hdr" style="margin:18px 0 8px"><span class="sec-title">⚙️ Porcentajes</span></div>
    <div class="card" style="margin-bottom:8px"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px"><b style="font-size:13px">Tramos (por quincena)</b><button class="lnk" onclick="editarTramosCom()">Editar</button></div>${T.map(t=>linea(`${t.emoji} ${t.label}`,`desde ${fp(t.min)} → <b>${t.pct}%</b>`)).join('')}${linea(`${TRAMO_ORO.emoji} Oro`,`desde ${fp(cfg.oro.min)} + ${cfg.oro.reels} reels → <b>${cfg.oro.pct}%</b>`)}</div>
    <div class="card" style="margin-bottom:8px"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px"><b style="font-size:13px">🌟 Barberos nuevos</b><button class="lnk" onclick="editarNuevosCom()">Editar</button></div><div style="font-size:12.5px;line-height:1.7">Primeros <b>${n.meses} meses</b>: <b>${n.base}%</b> sin mirar la facturación<br>+ <b>${n.contenido}%</b> por contenido (${n.reels} reels en la quincena)<br>+ <b>${n.extra}%</b> si superan ${fp(n.extraDesde)} en la quincena</div></div>
    <div class="card"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px"><b style="font-size:13px">🛡 Monto asegurado</b><button class="lnk" onclick="editarAseguradoCom()">Editar</button></div><div style="font-size:12.5px;line-height:1.7">Al llegar a su <b>piso</b> de facturación, se le asegura el <b>${cfg.asegurado.pct}%</b> del piso como mínimo. Si después factura menos, decidís vos si se lo das. El piso se pone a cada persona en "Cambiar".</div></div>`;
}
// ---------- admin: Equipo → Piso asegurado (recorte de renderAdminComisiones, reusando lo mismo) ----------
function renderAdminAsegurado(c){
  const cfg=comCfg(), D=adminDatos(), qk=quincenaKey(hoyStr());
  const pros=allUsers.filter(u=>esProf(u)&&numV(u.piso)>0);
  const pend=pendientesAsegurado();
  const estTxt={auto:'se completó solo',dado:'se le dio igual',no:'no se le dio',pendiente:'por decidir',en_curso:'en curso'};
  const filas=pros.map(u=>{ const ts=D.turnos.filter(t=>t.prof.id===u.id); const r=comisionQuincenaDe(u,qk,ts); const a=estadoAsegurado(u,qk,factPorQuincena(ts),r.comision);
    return `<div class="card" style="margin-bottom:6px;padding:10px 12px"><div style="display:flex;align-items:center;gap:10px"><div style="flex:1;min-width:0"><div style="font-size:13px;font-weight:800">${escH(u.name)}</div><div style="font-size:11.5px;color:var(--muted2)">Piso ${fpk(u.piso)} · asegura ${fp(Math.round(u.piso*cfg.asegurado.pct/100))}${a?' · '+(estTxt[a.estado]||'superado ✓'):' · superado ✓'}</div></div><button class="lnk" onclick="abrirComisionUsuario('${u.id}')">Cambiar piso</button></div></div>`; }).join('');
  c.innerHTML=`${pend.length?`<div class="sec-title" style="margin:6px 0 8px;color:#fbbf24">Por decidir (${pend.length})</div>${pend.map(x=>`<div class="card" style="margin-bottom:8px;border-color:rgba(251,191,36,.5)"><div style="font-size:13px;font-weight:800">${escH(x.prof.name)} · quincena ${fechaCortaStr(qStart(x.qk))} al ${fechaCortaStr(x.fin)}</div><div style="font-size:12px;color:var(--muted2);margin:3px 0 8px;line-height:1.5">Facturó ${fp(x.fact)} (su piso es ${fpk(x.piso)}). Le corresponde el mínimo asegurado de ${fp(x.garantizado)}: le faltan <b style="color:var(--text)">${fp(x.extra)}</b> para completarlo.</div><div style="display:flex;gap:8px"><button class="btn btn-primary" style="flex:1" onclick="decidirAsegurado('${x.prof.id}','${x.qk}','dar')">Dárselo igual</button><button class="btn btn-ghost" style="flex:1" onclick="decidirAsegurado('${x.prof.id}','${x.qk}','no')">No dárselo</button></div></div>`).join('')}`:''}
    <div class="card" style="margin-bottom:10px"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px"><b style="font-size:13px">🛡 Monto asegurado</b><button class="lnk" onclick="editarAseguradoCom()">Editar %</button></div><div style="font-size:12.5px;line-height:1.7">Al llegar a su <b>piso</b> de facturación, se le asegura el <b>${cfg.asegurado.pct}%</b> del piso como mínimo. Si después factura menos, decidís vos si se lo das.</div></div>
    <div class="sec-title" style="margin:14px 0 8px">Quién tiene piso asignado</div>
    ${filas||'<div class="empty"><p>Nadie tiene un piso de facturación cargado todavía. Se pone desde Equipo → Cuentas → "Cambiar".</p></div>'}`;
}
async function editarTramosCom(){
  const cfg=comCfg();
  const v=await uiDialog({title:'Tramos de comisión',msg:'Una línea por tramo: "facturación desde | %". Y el tramo Oro abajo.',fields:[{type:'textarea',value:cfg.tramos.map(t=>t.min+' | '+t.pct).join('\n')},{label:'Oro: facturación desde',type:'number',value:cfg.oro.min},{label:'Oro: reels publicados en la quincena',type:'number',value:cfg.oro.reels},{label:'Oro: %',type:'number',value:cfg.oro.pct}],ok:'Guardar'});
  if(!v) return;
  const tr=v[0].split('\n').map(l=>l.split('|').map(s=>numV(s))).filter(a=>a.length===2&&a[1]>0).map(a=>({min:a[0],pct:a[1]})).sort((a,b)=>a.min-b.min);
  if(!tr.length||tr[0].min!==0){ showToast('El primer tramo tiene que empezar en 0'); return; }
  promos.comisiones={...cfg,tramos:tr,oro:{min:numV(v[1]),reels:numV(v[2]),pct:numV(v[3])}}; savePromos(); showToast('Tramos guardados ✓'); renderAdmin();
}
async function editarNuevosCom(){
  const n=comCfg().nuevos;
  const v=await uiDialog({title:'Barberos nuevos',fields:[{label:'Meses con este esquema',type:'number',value:n.meses},{label:'% base (sin mirar facturación)',type:'number',value:n.base},{label:'% extra por contenido',type:'number',value:n.contenido},{label:'Reels en la quincena para el extra de contenido',type:'number',value:n.reels},{label:'% extra por facturar más de…',type:'number',value:n.extra},{label:'…esta facturación (por quincena)',type:'number',value:n.extraDesde}],ok:'Guardar'});
  if(!v) return; promos.comisiones={...comCfg(),nuevos:{meses:Math.max(1,numV(v[0])),base:numV(v[1]),contenido:numV(v[2]),reels:numV(v[3]),extra:numV(v[4]),extraDesde:numV(v[5])}}; savePromos(); showToast('Guardado ✓'); renderAdmin();
}
async function editarAseguradoCom(){
  const v=await uiPrompt('Monto asegurado',{msg:'Porcentaje del piso de facturación que se le asegura a quien lo alcanzó.',label:'% del piso',type:'number',value:comCfg().asegurado.pct,ok:'Guardar'});
  if(v===null) return; promos.comisiones={...comCfg(),asegurado:{pct:Math.min(100,Math.max(1,numV(v)))}}; savePromos(); showToast('Guardado ✓'); renderAdmin();
}
// ---------- admin: esquema de una persona ----------
let comUsr=null;
function abrirComisionUsuario(id){
  const u=allUsers.find(x=>x.id===id); if(!u) return;
  comUsr={id,esquema:comisionFijaDe(u)?'fija':(u.esquema==='nuevo'?'nuevo':'tramos')};
  renderComisionUsuario();
  openModal('modal-registro');
}
function comUsrEsq(e){ leerComUsr(); comUsr.esquema=e; renderComisionUsuario(); }
function leerComUsr(){ const g=(i)=>{ const e=document.getElementById(i); return e?e.value:undefined; }; ['cu-inicio','cu-fija','cu-piso'].forEach(i=>{ const v=g(i); if(v!==undefined) comUsr[i]=v; }); }
function renderComisionUsuario(){
  const u=allUsers.find(x=>x.id===comUsr.id); const s=comUsr; const n=comCfg().nuevos;
  const opt=(v,t,d)=>`<button onclick="comUsrEsq('${v}')" style="display:block;width:100%;text-align:left;padding:11px 14px;margin-bottom:6px;border-radius:12px;border:2px solid ${s.esquema===v?'#4A136B':'var(--border2)'};background:${s.esquema===v?'rgba(74,19,107,.12)':'var(--s2)'};color:var(--text);font-family:var(--font);cursor:pointer"><div style="font-size:13.5px;font-weight:800">${t}</div><div style="font-size:11.5px;color:var(--muted2);margin-top:2px">${d}</div></button>`;
  const inicio=s['cu-inicio']!==undefined?s['cu-inicio']:(u.inicio||hoyStr()), fija=s['cu-fija']!==undefined?s['cu-fija']:(comisionFijaDe(u)||60), piso=s['cu-piso']!==undefined?s['cu-piso']:(numV(u.piso)||'');
  document.getElementById('registro-content').innerHTML=cabeceraModal('Comisión de '+escH(u.name))+`
    ${opt('tramos','Por tramos','45% → 60% según lo que facture en la quincena')}
    ${opt('nuevo','🌟 Barbero nuevo',`${n.base}% los primeros ${n.meses} meses sin mirar facturación, +${n.contenido}% por contenido y +${n.extra}% si supera ${fpk(n.extraDesde)}. Después pasa solo a tramos.`)}
    ${opt('fija','📦 Comisión fija','Un porcentaje fijo, sin importar lo que facture (ej: el encargado)')}
    ${s.esquema==='nuevo'?`<div class="field"><label>Fecha en que empezó a trabajar</label><input id="cu-inicio" type="date" value="${escH(inicio)}"/></div>`:''}
    ${s.esquema==='fija'?`<div class="field"><label>Comisión fija (%)</label><input id="cu-fija" type="number" value="${escH(fija)}"/></div>`:''}
    ${s.esquema!=='fija'?`<div class="field" style="margin-top:8px"><label>🛡 Piso para el monto asegurado (facturación por quincena) — vacío = sin asegurado</label><input id="cu-piso" type="number" inputmode="decimal" value="${escH(piso)}" placeholder="Ej: 1000000"/></div>`:''}
    <button class="btn btn-primary" onclick="guardarComisionUsuario()" style="margin-top:12px">Guardar</button>`;
}
async function guardarComisionUsuario(){
  leerComUsr(); const s=comUsr; const u=allUsers.find(x=>x.id===s.id); if(!u) return;
  const patch={esquema:s.esquema};
  if(s.esquema==='nuevo'){ patch.inicio=s['cu-inicio']||u.inicio||hoyStr(); patch.comisionFija=null; }
  if(s.esquema==='fija'){ patch.comisionFija=Math.min(100,Math.max(1,numV(s['cu-fija'])||60)); patch.piso=null; }
  if(s.esquema!=='fija') patch.piso=numV(s['cu-piso'])>0?numV(s['cu-piso']):null;
  if(s.esquema!=='fija'&&u.esEncargado) patch.esEncargado=false; // salir de "encargado" si se elige otro esquema
  if(await editarUsuario(s.id,patch)){ closeModal('modal-registro'); showToast('Comisión guardada ✓'); renderAdmin(); }
}
function htmlAseguradosPanel(){
  if(!profile||profile.role!=='admin') return '';
  const n=pendientesAsegurado().length; if(!n) return '';
  return `<div class="card" onclick="switchAdminTab('comisiones')" style="cursor:pointer;margin:10px 0;border-color:rgba(251,191,36,.55);background:rgba(251,191,36,.07)"><div style="font-size:13px;font-weight:800;color:#fbbf24">🛡 ${n} ${n===1?'monto asegurado':'montos asegurados'} por decidir</div><div style="font-size:11.5px;color:var(--muted2)">Alguien facturó menos que su piso. Tocá para revisar.</div></div>`;
}

// Reseteo de contraseña por el admin (función de servidor reset-password, ver supabase/functions/reset-password)
async function resetearClaveCuenta(uid){
  if(!profile||profile.role!=='admin'){ showToast('Solo el admin puede resetear claves'); return; }
  const u=allUsers.find(x=>x.id===uid); if(!u) return;
  const r=await uiPrompt('Nueva contraseña para '+u.name,{msg:'La persona entra con esta clave y después la puede cambiar. Mínimo 4 caracteres.',type:'text',ok:'Resetear'});
  const pw=(r||'').trim(); if(pw.length<4){ if(r!=null) showToast('Mínimo 4 caracteres'); return; }
  // Slug real: Supabase creó la función como "dynamic-function" y el slug no se puede renombrar.
  const rr=await supaClient.from('luffy_roles').select('uid').eq('app_id',uid).maybeSingle();
  if(!rr.data){ showToast('Esa cuenta todavía no tiene usuario de acceso'); return; }
  const { data, error } = await supaClient.functions.invoke('dynamic-function',{body:{uid:rr.data.uid,password:pw}});
  if(error){ let msg=error.message; try{ const j=await error.context.json(); if(j&&j.error) msg=j.error; }catch(e){} showToast('No se pudo resetear: '+msg); return; }
  if(data&&data.error){ showToast('No se pudo resetear: '+data.error); return; }
  closeModal('modal-registro'); showToast('Contraseña de '+u.name+' reseteada ✓');
}
