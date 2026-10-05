// ============ FINANZAS (solo admin): gastos, balance por sucursal y punto de equilibrio ============
// Ingresos = lo que efectivamente entra (servicios cobrados, productos, membresias y paquetes vendidos).
// Egresos = gastos fijos (devengados por dia), variables cargados a mano, cuotas, suscripciones, empleados fijos
//           + lo que se paga a los empleados a comision + el costo de los productos vendidos.
const CAT_GASTOS=[
  {id:'alquiler',n:'Alquiler',c:'#4A136B',t:'fijo'},
  {id:'servicios',n:'Luz, agua, gas e internet',c:'#60a5fa',t:'fijo'},
  {id:'impuestos',n:'Impuestos, monotributo y cargas sociales',c:'#f472b6',t:'fijo'},
  {id:'seguros',n:'Seguros',c:'#e879f9',t:'fijo'},
  {id:'contador',n:'Contador',c:'#c084fc',t:'fijo'},
  {id:'depreciacion',n:'Depreciación de máquinas e instalaciones',c:'#f87171',t:'fijo'},
  {id:'sueldos',n:'Sueldos de recepción y administración',c:'#34d399',t:'sueldo'},
  {id:'personal_limpieza',n:'Personal de limpieza',c:'#6ee7b7',t:'sueldo'},
  {id:'cuotas',n:'Cuotas y préstamos',c:'#f59e0b',t:'cuota'},
  {id:'suscripciones',n:'Suscripciones y sistema administrativo',c:'#a78bfa',t:'suscripcion'},
  {id:'insumos',n:'Insumos y proveedores (ceras, filos, papel…)',c:'#fb923c',t:'variable'},
  {id:'cafeteria',n:'Cafetería',c:'#d97706',t:'variable'},
  {id:'marketing',n:'Publicidad y marketing',c:'#2dd4bf',t:'variable'},
  {id:'mantenimiento',n:'Refacciones, mantenimiento y mejoras',c:'#94a3b8',t:'variable'},
  {id:'limpieza',n:'Productos de limpieza',c:'#84cc16',t:'variable'},
  {id:'otros',n:'Varios',c:'#64748b',t:'variable'},
  {id:'reinversion',n:'Reinversión (equipamiento, mejoras, obra)',c:'#22d3ee',t:'reinversion'},
];
const CAT_AUTO=[
  {id:'comisiones',n:'Comisiones del equipo',c:'#fbbf24',t:'comision'},
  {id:'costoprod',n:'Costo de productos vendidos',c:'#ef4444',t:'variable'},
];
// Movimientos internos de caja: no son gasto ni ingreso (no bajan el margen), pero se registran con nombre/detalle
// para poder rastrearlos — reemplaza el "Retiro" generico que se comia $8,1M sin explicar.
const CAT_INTERNO=[
  {id:'adelanto',n:'Adelanto a un profesional',c:'#fb7185'},
  {id:'liquidacion',n:'Pago de liquidación/comisión',c:'#fbbf24'},
  {id:'retiro_socio',n:'Retiro de un socio',c:'#a78bfa'},
  {id:'devolucion',n:'Devolución de seña o a un cliente',c:'#f472b6'},
  {id:'pago_deuda',n:'Pago de una deuda',c:'#f59e0b'},
  {id:'traspaso',n:'Traspaso / cambio de efectivo',c:'#64748b'},
];
const catInterno=(id)=>CAT_INTERNO.find(c=>c.id===id)||CAT_INTERNO[CAT_INTERNO.length-1];
const GRUPOS_FIN=[['fijo','Gastos fijos'],['sueldo','Empleados fijos'],['cuota','Cuotas y préstamos'],['suscripcion','Suscripciones'],['variable','Gastos variables'],['reinversion','Reinversión'],['comision','Comisiones (empleados a comisión)']];
const catFin=(id)=>[...CAT_GASTOS,...CAT_AUTO].find(c=>c.id===id)||CAT_GASTOS[CAT_GASTOS.length-1];
const FRECUENCIAS=[['mensual','Mensual'],['quincenal','Quincenal'],['semanal','Semanal'],['anual','Anual']];
const DIAS_LARGO=['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];

let finData={gastos:[],fijos:[],consumibles:[],borrados:[],plan:{},cfg:{}};
let finState={periodo:'mes',suc:'todas'};
function persistFin(){ try{ localStorage.setItem('luffy_finanzas',JSON.stringify(finData)); }catch(e){} }
function mergeFin(remote){
  if(!remote) return false;
  const antes=JSON.stringify(finData);
  const del=new Set([...(finData.borrados||[]),...(remote.borrados||[])]);
  ['gastos','fijos','consumibles'].forEach(k=>{
    const m=new Map((finData[k]||[]).map(x=>[x.id,x]));
    (remote[k]||[]).forEach(r=>{ const l=m.get(r.id); if(!l||String(r.upd||'')>String(l.upd||'')) m.set(r.id,r); });
    finData[k]=[...m.values()].filter(x=>!del.has(x.id));
  });
  finData.borrados=[...del]; finData.plan={...(remote.plan||{}),...(finData.plan||{})}; finData.cfg={...(remote.cfg||{}),...(finData.cfg||{})};
  return antes!==JSON.stringify(finData);
}
function loadFinanzas(){
  if(!profile||profile.role!=='admin') return;
  try{ finData={gastos:[],fijos:[],consumibles:[],borrados:[],plan:{},cfg:{},...JSON.parse(localStorage.getItem('luffy_finanzas')||'{}')}; }catch(e){}
  if(DB) DB.doc('luffy/finanzas').get().then(r=>{ if(mergeFin(r)){ persistFin(); refreshCurrentView(); } }).catch(()=>{});
}
async function cambiarFin(fn){
  if(DB){ try{ mergeFin(await DB.doc('luffy/finanzas').get()); }catch(e){} }
  const res=fn(finData); persistFin();
  if(DB){ try{ await DB.doc('luffy/finanzas').set(finData); }catch(e){ showToast('Se guardó en este dispositivo; falta conexión para subirlo'); } }
  return res;
}

// ---------- calculo ----------
function sucDeReg(x,u){ return x.sucursal||(u&&u.sucursal)||((sucursales.find(s=>sucursalConRecepcion(s.id))||sucursales[0]||{}).id)||'s1'; }
function mensualizado(f){ const m=numV(f.monto); return f.frecuencia==='quincenal'?m*2:f.frecuencia==='semanal'?m*52/12:f.frecuencia==='anual'?m/12:m; }
function costoDia(f,fecha){ const [y,m]=fecha.split('-').map(Number); const mo=numV(f.monto); return f.frecuencia==='quincenal'?mo*2/finMesUTC(y,m):f.frecuencia==='semanal'?mo*52/12/finMesUTC(y,m):f.frecuencia==='anual'?mo/365:mo/finMesUTC(y,m); }
function fijoDevengado(f,desde,hasta){
  if(f.activo===false) return 0; const fin=hasta>hoyStr()?hoyStr():hasta; let t=0;
  for(let d=desde;d<=fin;d=addDias(d,1)){ if(f.desde&&d<f.desde) continue; if(f.hasta&&d>f.hasta) continue; t+=costoDia(f,d); }
  return t;
}
function rubroDeTurno(t,prof){
  const s0=(t.servicios&&t.servicios[0])||null;
  if(s0){ const sv=servicios.find(x=>x.id===s0.id); if(sv&&sv.rubro) return sv.rubro; const cb=combos.find(x=>x.id===s0.id); if(cb&&cb.rubro) return cb.rubro; }
  return (prof&&prof.rubros&&prof.rubros[0])||'';
}
// Devuelve por sucursal: ingresos, egresos por categoria, ingreso por profesional y los turnos (con rubro) del periodo.
// "pre" permite reusar los datos ya leidos cuando se calculan muchos periodos seguidos (flujo anual).
function finCalc(desde,hasta,pre){
  const D=pre?pre.D:adminDatos(), pctMap=pre?pre.pctMap:pctPorQuincena(D);
  const nuevo=()=>({ing:{servicios:0,productos:0,membresias:0,paquetes:0,senas:0},eg:{},reinversion:0,interno:[],turnos:[],porProf:{}});
  const S={}; sucursales.forEach(s=>{ S[s.id]=nuevo(); });
  const sx=(id)=>S[id]||(S[id]=nuevo());
  // "reinversion" no cuenta como gasto normal (se muestra aparte, resultado antes/despues de reinvertir)
  const eg=(s,cat,v)=>{ if(cat==='reinversion'){ s.reinversion=(s.reinversion||0)+v; return; } s.eg[cat]=(s.eg[cat]||0)+v; };
  D.turnos.filter(t=>t.fecha>=desde&&t.fecha<=hasta).forEach(t=>{
    const s=sx(sucDeReg(t,t.prof)); const pct=pctMap[t.prof.id+'|'+quincenaKey(t.fecha)]||0;
    const cash=numV(t.aCobrar!=null?t.aCobrar:t.monto);
    s.ing.servicios+=cash; s.porProf[t.prof.id]=(s.porProf[t.prof.id]||0)+cash;
    const com=comTurno(t,pct); eg(s,'comisiones',com);
    s.turnos.push({t,rubro:rubroDeTurno(t,t.prof),com,prof:t.prof});
  });
  D.ventas.filter(v=>v.fecha>=desde&&v.fecha<=hasta).forEach(v=>{
    const s=sx(sucDeReg(v,v.vendedor)); s.ing.productos+=numV(v.total); eg(s,'comisiones',numV(v.comision)); eg(s,'costoprod',costoVenta(v));
  });
  membresiasSt.list.filter(m=>m.fecha>=desde&&m.fecha<=hasta).forEach(m=>{ sx(sucDeReg(m,allUsers.find(u=>u.id===m.vendedorId))).ing.membresias+=numV(m.precio); });
  paquetesSt.list.filter(p=>p.fecha>=desde&&p.fecha<=hasta).forEach(p=>{ const s=sx(sucDeReg(p,allUsers.find(u=>u.id===p.vendedorId))); s.ing.paquetes+=numV(p.total); eg(s,'comisiones',comRecPaquete(p)); });
  senasSt.list.filter(s=>s.fecha>=desde&&s.fecha<=hasta&&s.estado!=='devuelta').forEach(s=>{ sx(sucDeReg(s,allUsers.find(u=>u.id===s.recId))).ing.senas+=numV(s.monto); });
  extrasAsegurado(D,desde,hasta).forEach(x=>{ const ex=extraAplicable(x); if(ex) eg(sx(sucDeReg({},x.prof)),'comisiones',ex); });
  const ids=sucursales.map(s=>s.id), n=Math.max(1,ids.length);
  const reparto=(suc,cat,v)=>{ if(!v) return; if(suc&&suc!=='todas'&&S[suc]) eg(S[suc],cat,v); else ids.forEach(i=>eg(S[i],cat,v/n)); };
  finData.gastos.filter(g=>!g.anulado&&g.fecha>=desde&&g.fecha<=hasta).forEach(g=>reparto(g.sucursal,g.categoria,numV(g.monto)));
  finData.fijos.filter(f=>!f.anulado).forEach(f=>reparto(f.sucursal,f.categoria,fijoDevengado(f,desde,hasta)));
  // gastos anotados en la caja de recepcion (los retiros y pagos de gastos fijos no cuentan: ya estan devengados)
  todasSesiones().forEach(s=>movsVivos(s).filter(m=>m.tipo==='salida').forEach(m=>{
    const f=ymdLocal(new Date(m.ts)); if(f<desde||f>hasta) return;
    const suc=s.sucursal||ids[0];
    if(m.gasto) reparto(suc,m.cat||'otros',numV(m.monto));
    else if(m.interno) sx(suc).interno.push({...m,sucursal:suc}); // adelanto, retiro de socio, devolucion, etc: no es gasto, pero se muestra para no perderlo
  }));
  return S;
}
const sumaIng=(s)=>s.ing.servicios+s.ing.productos+s.ing.membresias+s.ing.paquetes+(s.ing.senas||0);
const sumaEg=(s)=>Object.values(s.eg).reduce((a,b)=>a+b,0);
function juntarS(S,ids){
  const T={ing:{servicios:0,productos:0,membresias:0,paquetes:0,senas:0},eg:{},reinversion:0,interno:[],turnos:[],porProf:{}};
  ids.forEach(i=>{ const s=S[i]; if(!s) return; Object.keys(T.ing).forEach(k=>T.ing[k]+=s.ing[k]); Object.entries(s.eg).forEach(([c,v])=>T.eg[c]=(T.eg[c]||0)+v); T.reinversion+=(s.reinversion||0); T.interno.push(...(s.interno||[])); Object.entries(s.porProf||{}).forEach(([p,v])=>T.porProf[p]=(T.porProf[p]||0)+v); T.turnos.push(...s.turnos); });
  return T;
}
function rangoFin(){ return finState.periodo==='semana'?rangoPeriodo('7d'):rangoPeriodo(finState.periodo); }

// ---------- graficos ----------
function donutFin(items,total,size){
  size=size||160; const r=size/2-13, C=2*Math.PI*r, cx=size/2; let off=0;
  const segs=items.filter(i=>i.v>0).map(i=>{ const len=total>0?i.v/total*C:0; const s=`<circle r="${r}" cx="${cx}" cy="${cx}" fill="none" stroke="${i.c}" stroke-width="24" stroke-dasharray="${len.toFixed(2)} ${(C-len).toFixed(2)}" stroke-dashoffset="${(-off).toFixed(2)}" transform="rotate(-90 ${cx} ${cx})"/>`; off+=len; return s; }).join('');
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" style="flex-shrink:0"><circle r="${r}" cx="${cx}" cy="${cx}" fill="none" stroke="var(--border2)" stroke-width="24"/>${segs}<text x="${cx}" y="${cx-2}" text-anchor="middle" style="font:800 ${size>140?15:12}px var(--font);fill:var(--text)">${fpk(total)}</text><text x="${cx}" y="${cx+14}" text-anchor="middle" style="font:600 10px var(--font);fill:var(--muted2)">egresos</text></svg>`;
}
function torta(S_,titulo,chico){
  const items=Object.entries(S_.eg).filter(([,v])=>v>0.5).map(([id,v])=>({id,v,c:catFin(id).c,n:catFin(id).n})).sort((a,b)=>b.v-a.v);
  const total=items.reduce((a,b)=>a+b.v,0);
  return `<div class="card" style="margin-bottom:10px"><div style="font-size:13px;font-weight:800;margin-bottom:8px">${titulo}</div>
    <div style="display:flex;gap:14px;align-items:center;flex-wrap:wrap;justify-content:center">${donutFin(items,total,chico?130:170)}
    <div style="flex:1;min-width:150px">${items.length?items.map(i=>`<div style="display:flex;align-items:center;gap:7px;font-size:11.5px;padding:2px 0"><span style="width:10px;height:10px;border-radius:3px;background:${i.c};flex-shrink:0"></span><span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escH(i.n)}</span><b>${Math.round(i.v/total*100)}%</b></div>`).join(''):'<div style="font-size:12px;color:var(--muted)">Sin egresos en el período</div>'}</div></div></div>`;
}
const chipsFin=()=>`<div class="fin-chips" style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px">${[['hoy','Hoy'],['semana','Semana'],['quincena','Quincena'],['mes','Mes']].map(([k,l])=>`<button onclick="finSet('periodo','${k}')" style="${pillStyle(finState.periodo===k,'#4A136B')}">${l}</button>`).join('')}</div>
  <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px"><button onclick="finSet('suc','todas')" style="${pillStyle(finState.suc==='todas','#4A136B')}">📍 Todas</button>${sucursales.map(s=>`<button onclick="finSet('suc','${s.id}')" style="${pillStyle(finState.suc===s.id,s.color)}">${escH(s.nombre)}</button>`).join('')}</div>`;
function finSet(k,v){ finState[k]=v; renderAdmin(); }
const linea=(a,b,st='')=>`<div class="ln" style="${st}"><span>${a}</span><span>${b}</span></div>`;

// ---------- balance ----------
function renderAdminFinanzas(c,sub){ ({balance:finBalance,gastos:finGastos,fijos:finFijos,equilibrio:finEquilibrio,costos:finCostos,flujo:finFlujo,caja:adminCaja,deudasequipo:finDeudasEquipo}[sub]||finBalance)(c); }
// ---------- deudas con el equipo (adelantos, liquidaciones y pagos de deuda anotados desde la Caja) ----------
// Distinto de Clientes > Deudas (esas son plata que debe un cliente). Esto es lo que el salón le
// adelantó/pagó a un profesional o socio. Hoy se agrupa por el texto libre "a quién", porque la Caja
// no liga estos movimientos al perfil real del profesional (posible mejora a futuro).
const DEUDA_EQUIPO_TIPOS=['adelanto','liquidacion','pago_deuda'];
function finDeudasEquipo(c){
  const r=rangoFin(), S=finCalc(r.desde,r.hasta);
  const ids=finState.suc==='todas'?sucursales.map(s=>s.id):[finState.suc];
  const T=juntarS(S,ids);
  const L=T.interno.filter(m=>DEUDA_EQUIPO_TIPOS.includes(m.interno)).sort((a,b)=>String(b.ts).localeCompare(String(a.ts)));
  const total=L.reduce((a,m)=>a+numV(m.monto),0);
  const porPersona={};
  L.forEach(m=>{ const k=(m.detalle||'Sin especificar').trim(); const o=porPersona[k]=porPersona[k]||{monto:0,items:[]}; o.monto+=numV(m.monto); o.items.push(m); });
  const filas=Object.entries(porPersona).sort((a,b)=>b[1].monto-a[1].monto);
  c.innerHTML=chipsFin()+`<div class="sec-title" style="margin-bottom:4px">🤝 Deudas con el equipo · ${fp(total)}</div>
    <div style="font-size:11.5px;color:var(--muted2);margin:-2px 2px 10px">${r.label}. Adelantos, liquidaciones/comisiones pagadas y pagos de deuda anotados desde la Caja, agrupados por a quién se le anotó.</div>
    ${filas.length?filas.map(([persona,d])=>`<div class="card" style="margin-bottom:8px"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px"><b style="font-size:13.5px">${escH(persona)}</b><b style="font-size:14px">${fp(d.monto)}</b></div>${d.items.map(m=>{ const ci=catInterno(m.interno); return linea(`<span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:${ci.c};margin-right:6px"></span>${escH(ci.n)}`,`<span style="color:var(--muted2);font-size:11px">${fechaCortaStr(ymdLocal(new Date(m.ts)))}</span> <b>${fp(m.monto)}</b>`); }).join('')}</div>`).join(''):'<div class="empty"><div class="e-icon">🤝</div><p>No hay adelantos, liquidaciones ni pagos de deuda anotados en este período.</p></div>'}`;
}
function finBalance(c){
  const r=rangoFin(), S=finCalc(r.desde,r.hasta);
  const ids=finState.suc==='todas'?sucursales.map(s=>s.id):[finState.suc];
  const T=juntarS(S,ids), ing=sumaIng(T), egr=sumaEg(T), gan=ing-egr, mg=ing>0?Math.round(gan/ing*100):0;
  const reinv=T.reinversion||0, ganDespues=gan-reinv;
  const pctI=(v)=>ing>0?Math.round(v/ing*100)+'%':'—';
  const porGrupo=GRUPOS_FIN.map(([t,n])=>({t,n,cats:Object.entries(T.eg).filter(([id,v])=>v>0.5&&catFin(id).t===t).sort((a,b)=>b[1]-a[1])})).filter(g=>g.cats.length);
  const kpi=(l,v,col,sub2)=>`<div class="stat-card"><div class="sc-lbl">${l}</div><div class="sc-val" style="color:${col||'var(--text)'}">${v}</div><div class="sc-sub">${sub2||''}</div></div>`;
  c.innerHTML=chipsFin()+`<button onclick="abrirExportExcel()" class="btn btn-ghost" style="width:100%;margin-bottom:10px">📥 Exportar a Excel para el contador</button>
    <div style="font-size:11.5px;color:var(--muted2);margin:-4px 2px 10px">${r.label} · ${finState.suc==='todas'?'todo el salón':escH((sucursalDe(finState.suc)||{}).nombre||'')}</div>
    <div class="stat-grid" style="grid-template-columns:repeat(2,1fr)">${kpi('Ingresos',fp(ing),'#34d399')}${kpi('Egresos',fp(egr),'#f472b6')}${kpi('Resultado operativo',fp(gan),gan>=0?'#34d399':'#f472b6',gan>=0?'te queda':'estás perdiendo')}${kpi('Margen',mg+'%',mg>=0?'var(--text)':'#f472b6','de cada $100 que entran')}</div>
    ${reinv>0?`<div class="card" style="margin-bottom:10px;border-color:rgba(34,211,238,.35);background:rgba(34,211,238,.06)">${linea('Resultado operativo (antes de reinvertir)',`<b>${fp(gan)}</b>`)}${linea('− Reinversión del período',`<b style="color:#22d3ee">${fp(reinv)}</b>`)}${linea('<b>= Resultado después de reinversión</b>',`<b style="color:${ganDespues>=0?'#34d399':'#f472b6'}">${fp(ganDespues)}</b>`,'border-top:1px solid var(--border2);margin-top:4px;padding-top:6px')}</div>`:''}
    ${torta(T,'🥧 En qué se va la plata'+(finState.suc==='todas'?' (todo el salón)':''))}
    ${finState.suc==='todas'&&sucursales.length>1?`<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(270px,1fr));gap:10px">${sucursales.map(s=>torta(S[s.id],`<span style="color:${s.color}">●</span> ${escH(s.nombre)} · ganancia ${fp(sumaIng(S[s.id])-sumaEg(S[s.id]))}`,true)).join('')}</div>`:''}
    <div class="sec-title" style="margin:14px 0 8px">⬆️ Ingresos · ${fp(ing)}</div>
    <div class="card" style="margin-bottom:10px">${[['Servicios cobrados',T.ing.servicios],['Productos vendidos',T.ing.productos],['Membresías vendidas',T.ing.membresias],['Paquetes vendidos',T.ing.paquetes],['Señas recibidas',T.ing.senas||0]].map(([n,v])=>linea(n,`<b>${fp(v)}</b> <span style="color:var(--muted);font-size:10.5px">${pctI(v)}</span>`)).join('')}</div>
    <div class="sec-title" style="margin:14px 0 8px">⬇️ Egresos · ${fp(egr)}</div>
    ${porGrupo.map(g=>{ const sub2=g.cats.reduce((a,[,v])=>a+v,0); return `<div class="card" style="margin-bottom:8px"><div style="display:flex;justify-content:space-between;font-size:12.5px;font-weight:800;margin-bottom:4px"><span>${g.n}</span><span>${fp(sub2)} <span style="color:var(--muted);font-size:10.5px;font-weight:600">${pctI(sub2)} de lo que entra</span></span></div>${g.cats.map(([id,v])=>`<div class="ln"><span><span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:${catFin(id).c};margin-right:6px"></span>${escH(catFin(id).n)}</span><span>${fp(v)} <span style="color:var(--muted);font-size:10.5px">${pctI(v)}</span></span></div>`).join('')}</div>`; }).join('')||'<div class="empty"><div class="e-icon">🧾</div><p>Todavía no hay egresos. Cargá tus gastos fijos y variables.</p></div>'}
    ${T.interno.length?`<div class="sec-title" style="margin:14px 0 8px">🔁 Movimientos internos · ${fp(T.interno.reduce((a,m)=>a+numV(m.monto),0))}</div>
    <div class="card" style="margin-bottom:10px;font-size:12px;color:var(--muted2);line-height:1.5">Plata que salió de la caja pero <b style="color:var(--text)">no es gasto</b> (adelantos, retiros de socios, devoluciones, pagos de deuda, cambios de efectivo) — no baja el margen, pero queda anotada acá para que no se pierda.</div>
    <div class="card" style="margin-bottom:10px">${T.interno.slice().sort((a,b)=>String(b.ts).localeCompare(String(a.ts))).map(m=>{ const ci=catInterno(m.interno); return linea(`<span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:${ci.c};margin-right:6px"></span>${escH(ci.n)}${m.detalle?' — '+escH(m.detalle):''} <span style="color:var(--muted);font-size:10.5px">${fechaCortaStr(ymdLocal(new Date(m.ts)))} · ${escH((sucursalDe(m.sucursal)||{}).nombre||'')}</span>`,`<b>${fp(m.monto)}</b>`); }).join('')}</div>`:''}
    ${htmlProximosPagos()}
    <div style="font-size:10.5px;color:var(--muted);margin-top:8px;line-height:1.5">Los gastos fijos se cuentan por día (un alquiler mensual se reparte en los días del mes). Los gastos "Compartidos" se dividen en partes iguales entre las sucursales. Las comisiones del equipo se calculan con el tramo de cada quincena.</div>`;
}
function proximoVenc(f){
  const hoy=hoyStr(), [y,m,d]=hoy.split('-').map(Number);
  if(f.frecuencia==='semanal'){ const dw=numV(f.dia); const n=new Date(hoy+'T00:00:00Z').getUTCDay(); return addDias(hoy,(dw-n+7)%7); }
  if(f.frecuencia==='anual'){ const [mm,dd]=String(f.dia||'01-01').split('-').map(Number); let fe=y+'-'+pad2(mm)+'-'+pad2(dd); if(fe<hoy) fe=(y+1)+'-'+pad2(mm)+'-'+pad2(dd); return fe; }
  const dias=f.frecuencia==='quincenal'?[15,finMesUTC(y,m)]:[Math.min(numV(f.dia)||1,finMesUTC(y,m))];
  for(const dd of dias){ if(dd>=d) return y+'-'+pad2(m)+'-'+pad2(dd); }
  const [y2,m2]=m===12?[y+1,1]:[y,m+1]; return y2+'-'+pad2(m2)+'-'+pad2(f.frecuencia==='quincenal'?15:Math.min(numV(f.dia)||1,finMesUTC(y2,m2)));
}
function htmlProximosPagos(){
  const hoy=hoyStr(); const L=finData.fijos.filter(f=>!f.anulado&&f.activo!==false&&(finState.suc==='todas'||!f.sucursal||f.sucursal==='todas'||f.sucursal===finState.suc)).map(f=>({f,fe:proximoVenc(f)})).sort((a,b)=>a.fe.localeCompare(b.fe)).slice(0,8);
  const q=rangoPeriodo('quincena'); const Sq=finCalc(q.desde,q.hasta); const com=juntarS(Sq,finState.suc==='todas'?sucursales.map(s=>s.id):[finState.suc]).eg.comisiones||0;
  return `<div class="sec-title" style="margin:14px 0 8px">📅 Próximos pagos</div><div class="card">
    ${L.map(({f,fe})=>{ const dd=diasEntre(hoy,fe); return linea(`${escH(f.nombre)} <span style="color:var(--muted);font-size:10.5px">${fechaCortaStr(fe)} · ${dd===0?'hoy':dd===1?'mañana':'en '+dd+' días'}</span>`,`<b>${fp(f.monto)}</b>`,dd<=3?'color:#fbbf24':''); }).join('')}
    ${linea(`💰 Comisiones de la quincena <span style="color:var(--muted);font-size:10.5px">se pagan el ${fechaCortaStr(q.hasta)} · en ${Math.max(0,diasEntre(hoy,q.hasta))} días</span>`,`<b>${fp(com)}</b>`)}
    ${!L.length?'<div style="font-size:12px;color:var(--muted);padding:6px 0">Cargá tus gastos fijos para ver cuándo vence cada uno.</div>':''}</div>`;
}

// ============ Exportar a Excel para el contador (ver finanzas/mockup-exportacion-contador.md) ============
let exportFinState={suc:'todas',mes:''};
function abrirExportExcel(){
  document.getElementById('registro-content').innerHTML=cabeceraModal('📥 Exportar a Excel')+
    `<div style="font-size:12px;color:var(--muted2);margin:-6px 0 12px;line-height:1.5">Arma un .xlsx prolijo para el contador (una hoja por sucursal, formato contable sin $), con los datos reales de la app.</div>
    <div class="field"><label>Sucursal</label><select id="exf-suc" style="${selFin}">
      <option value="todas" ${exportFinState.suc==='todas'?'selected':''}>Ambas (hojas separadas)</option>
      ${sucursales.map(s=>`<option value="${s.id}" ${exportFinState.suc===s.id?'selected':''}>${escH(s.nombre)}</option>`).join('')}
    </select></div>
    <div class="field" style="margin-top:8px"><label>Período</label>
      <select id="exf-modo" onchange="document.getElementById('exf-mes-w').style.display=this.value==='mes'?'':'none'" style="${selFin};width:100%">
        <option value="todo" ${!exportFinState.mes?'selected':''}>Todo junto (histórico completo)</option>
        <option value="mes" ${exportFinState.mes?'selected':''}>Un mes puntual</option>
      </select>
      <div id="exf-mes-w" style="margin-top:6px;${exportFinState.mes?'':'display:none'}"><input id="exf-mes" type="month" value="${exportFinState.mes||hoyStr().slice(0,7)}" style="${selFin};width:100%"/></div>
    </div>
    <button class="btn btn-primary" onclick="generarExcelContador()" style="margin-top:14px">📥 Generar y descargar</button>`;
  openModal('modal-registro');
}
function hojaNombre(base,suc){ const n=base+' - '+suc.nombre; return n.length>31?n.slice(0,31):n; }
function xlsxSheetFromRows(headerLines,colHeaders,rows,moneyCols,totalRow){
  const aoa=[]; headerLines.forEach(l=>aoa.push([l])); aoa.push([]); aoa.push(colHeaders);
  rows.forEach(r=>aoa.push(r)); if(totalRow) aoa.push(totalRow);
  const ws=XLSX.utils.aoa_to_sheet(aoa);
  const headerRowIdx=headerLines.length+1, fmt='#,##0;(#,##0)';
  if(ws['!ref']){
    const range=XLSX.utils.decode_range(ws['!ref']);
    for(let R=headerRowIdx+1;R<=range.e.r;R++) moneyCols.forEach(C=>{ const addr=XLSX.utils.encode_cell({r:R,c:C}); if(ws[addr]&&typeof ws[addr].v==='number') ws[addr].z=fmt; });
  }
  ws['!cols']=colHeaders.map(h=>({wch:Math.max(12,String(h).length+2)}));
  return ws;
}
function quincenasEnRango(D,desde,hasta){
  const out=new Set();
  D.turnos.forEach(t=>{ if(t.fecha>=desde&&t.fecha<=hasta) out.add(quincenaKey(t.fecha)); });
  D.ventas.forEach(v=>{ if(v.fecha>=desde&&v.fecha<=hasta) out.add(quincenaKey(v.fecha)); });
  return [...out].sort();
}
function qLabel(qk){ const p=qk.split('-'); return (p[2]==='1'?'1-15 ':'16-fin ')+(MESES[Number(p[1])-1]||'').slice(0,3)+' '+p[0].slice(2); }
function agregarHojaResumen(wb,suc,T,periodoLabel){
  const ing=sumaIng(T);
  const ingRows=[['Servicios cobrados',T.ing.servicios],['Productos vendidos',T.ing.productos],['Membresías vendidas',T.ing.membresias],['Paquetes vendidos',T.ing.paquetes],['Señas recibidas',T.ing.senas||0]].filter(([,v])=>v>0.5);
  const comisiones=T.eg.comisiones||0, quedaLocal=ing-comisiones;
  const gastoRows=Object.entries(T.eg).filter(([id,v])=>id!=='comisiones'&&v>0.5).sort((a,b)=>b[1]-a[1]).map(([id,v])=>[catFin(id).n,-v]);
  const totGastos=gastoRows.reduce((s,[,v])=>s+v,0);
  const gan=quedaLocal+totGastos, reinv=T.reinversion||0, ganDespues=gan-reinv;
  const rows=[...ingRows,['Total ingresos',ing],['Comisiones a profesionales',-comisiones],['Queda al local',quedaLocal],...gastoRows,['Resultado operativo',gan],['Reinversión del período',-reinv],['Resultado después de reinversión',ganDespues]];
  const ws=xlsxSheetFromRows(['INDA STUDIO — '+suc.nombre,periodoLabel,'Generado: '+fechaCortaStr(hoyStr())],['Concepto','Monto'],rows,[1],null);
  XLSX.utils.book_append_sheet(wb,ws,hojaNombre('Resumen',suc));
}
function agregarHojaIngresos(wb,suc,D,desde,hasta){
  const items=[];
  D.turnos.filter(t=>t.fecha>=desde&&t.fecha<=hasta&&sucDeReg(t,t.prof)===suc.id).forEach(t=>{
    items.push({fecha:t.fecha,row:[fechaCortaStr(t.fecha),nombreRubro(rubroDeTurno(t,t.prof))||'—',t.servicio||'Servicio',numV(t.subtotal!=null?t.subtotal:t.monto),numV(t.descuento||0),numV(t.aCobrar!=null?t.aCobrar:t.monto),medioTxt(t.medio),t.prof.name]});
  });
  D.ventas.filter(v=>v.fecha>=desde&&v.fecha<=hasta&&sucDeReg(v,v.vendedor)===suc.id).forEach(v=>{
    items.push({fecha:v.fecha,row:[fechaCortaStr(v.fecha),'Producto',v.productoNombre+' x'+v.cantidad,numV(v.precioUnitario)*numV(v.cantidad),0,numV(v.total),medioTxt(v.medio),v.vendedor.name]});
  });
  // Mismo criterio que finCalc: membresias, paquetes y señas tambien son ingresos del local
  membresiasSt.list.filter(m=>m.fecha>=desde&&m.fecha<=hasta&&sucDeReg(m,allUsers.find(u=>u.id===m.vendedorId))===suc.id).forEach(m=>{
    items.push({fecha:m.fecha,row:[fechaCortaStr(m.fecha),'Membresía',(m.planNombre||'Membresía')+' · '+(m.clienteNombre||''),numV(m.precio),0,numV(m.precio),medioTxt(m.medio),m.vendedorNombre||'']});
  });
  paquetesSt.list.filter(p=>p.fecha>=desde&&p.fecha<=hasta&&sucDeReg(p,allUsers.find(u=>u.id===p.vendedorId))===suc.id).forEach(p=>{
    items.push({fecha:p.fecha,row:[fechaCortaStr(p.fecha),'Paquete',(p.clienteNombre||'')+' · '+p.items.length+' servicios',numV(p.totalLista),numV(p.totalLista)-numV(p.total),numV(p.total),medioTxt(p.medio),p.vendedorNombre||'']});
  });
  senasSt.list.filter(x=>x.fecha>=desde&&x.fecha<=hasta&&x.estado!=='devuelta'&&sucDeReg(x,allUsers.find(u=>u.id===x.recId))===suc.id).forEach(x=>{
    items.push({fecha:x.fecha,row:[fechaCortaStr(x.fecha),'Seña',(x.clienteNombre||'')+' · '+(x.profNombre||''),numV(x.monto),0,numV(x.monto),medioTxt(x.medio),(allUsers.find(u=>u.id===x.recId)||{}).name||'']});
  });
  items.sort((a,b)=>a.fecha.localeCompare(b.fecha));
  const rows=items.map(x=>x.row), total=rows.reduce((s,r)=>s+r[5],0);
  const ws=xlsxSheetFromRows(['INDA STUDIO — '+suc.nombre,'Ingresos','Generado: '+fechaCortaStr(hoyStr())],['Fecha','Rubro','Servicio','Precio lista','Descuento','Total cobrado','Medio de pago','Profesional'],rows,[3,4,5],['Total del período','','','','',total,'','']);
  XLSX.utils.book_append_sheet(wb,ws,hojaNombre('Ingresos',suc));
}
// Reune, por profesional, lo facturado/efectivo/MP/comision en UNA sucursal y un rango — mismo criterio que finCalc (sucDeReg, comTurno, extrasAsegurado)
function resumenProfPorSucursal(sucId,desde,hasta,D,pctMap){
  const m={}; const get=(u)=>m[u.id]||(m[u.id]={prof:u,facturado:0,efectivo:0,mp:0,comision:0});
  D.turnos.filter(t=>t.fecha>=desde&&t.fecha<=hasta&&sucDeReg(t,t.prof)===sucId).forEach(t=>{
    const y=get(t.prof), cash=numV(t.aCobrar!=null?t.aCobrar:t.monto);
    y.facturado+=cash; if(t.medio==='efectivo') y.efectivo+=cash; else y.mp+=cash;
    const pct=pctMap[t.prof.id+'|'+quincenaKey(t.fecha)]||0; y.comision+=comTurno(t,pct);
  });
  D.ventas.filter(v=>v.fecha>=desde&&v.fecha<=hasta&&sucDeReg(v,v.vendedor)===sucId).forEach(v=>{
    const y=get(v.vendedor), cash=numV(v.total);
    y.facturado+=cash; if(v.medio==='efectivo') y.efectivo+=cash; else y.mp+=cash;
    y.comision+=numV(v.comision);
  });
  extrasAsegurado(D,desde,hasta).forEach(x=>{ if(sucDeReg({},x.prof)===sucId){ const y=get(x.prof); y.comision+=extraAplicable(x); } });
  return Object.values(m);
}
function agregarHojaResumenProf(wb,suc,D,pctMap,desde,hasta){
  const L=resumenProfPorSucursal(suc.id,desde,hasta,D,pctMap).sort((a,b)=>b.facturado-a.facturado);
  const rows=L.map(x=>{
    const pctMPv=x.facturado>0?Math.round(x.mp/x.facturado*100):0, saldo=x.comision-x.mp;
    const saldoTxt=saldo>1?('Local le debe '+fp(saldo)):saldo<-1?('Depositá '+fp(-saldo)):'Cuentas saldadas';
    return [x.prof.name,x.facturado,x.efectivo,x.mp,pctMPv,x.comision,saldoTxt];
  });
  const totFact=L.reduce((s,x)=>s+x.facturado,0);
  const ws=xlsxSheetFromRows(['INDA STUDIO — '+suc.nombre,'Resumen por profesional','Generado: '+fechaCortaStr(hoyStr())],['Profesional','Facturado total','Efectivo (queda en el local)','Mercado Pago (cuenta propia)','% en MP','Comisión que le corresponde','Saldo del período'],rows,[1,2,3,5],['Total',totFact,'','','','','']);
  XLSX.utils.book_append_sheet(wb,ws,hojaNombre('Por profesional',suc));
}
function agregarHojaFichaProf(wb,suc){
  const profs=allUsers.filter(u=>esProf(u)&&sucursalesDe(u).includes(suc.id));
  const rows=profs.map(u=>[u.name,u.aliasMP||'(a completar)',u.monotributo||'(a completar)',u.obraSocial||'(a completar)']);
  const ws=xlsxSheetFromRows(['INDA STUDIO — '+suc.nombre,'Ficha de cada profesional (referencia)','Generado: '+fechaCortaStr(hoyStr())],['Profesional','Alias / cuenta de Mercado Pago','Monotributo (categoría / costo mensual)','Obra social'],rows,[],null);
  XLSX.utils.book_append_sheet(wb,ws,hojaNombre('Ficha prof.',suc));
}
function agregarHojaGastos(wb,suc,D,desde,hasta){
  const items=[], n=Math.max(1,sucursales.length);
  finData.gastos.filter(g=>!g.anulado&&g.fecha>=desde&&g.fecha<=hasta&&(g.sucursal===suc.id||!g.sucursal||g.sucursal==='todas')).forEach(g=>{
    const compartido=!g.sucursal||g.sucursal==='todas', monto=compartido?numV(g.monto)/n:numV(g.monto);
    items.push({fecha:g.fecha,row:[fechaCortaStr(g.fecha),catFin(g.categoria).n,(g.desc||'')+(compartido?' (compartido entre sucursales)':''),monto,g.origen==='proveedor'?'Compra a proveedor':'Carga manual']});
  });
  // Gastos fijos devengados en el periodo (alquiler, sueldos...): mismo reparto que finCalc
  finData.fijos.filter(f=>!f.anulado).forEach(f=>{
    const v=fijoDevengado(f,desde,hasta); if(!v) return;
    const compartido=!f.sucursal||f.sucursal==='todas'; if(!compartido&&f.sucursal!==suc.id) return;
    items.push({fecha:desde,row:[fechaCortaStr(desde),catFin(f.categoria).n,(f.nombre||'Gasto fijo')+' · devengado del período'+(compartido?' (compartido entre sucursales)':''),compartido?v/n:v,'Gasto fijo']});
  });
  // Costo de los productos vendidos en el periodo (finCalc lo resta como costoprod)
  D.ventas.filter(v=>v.fecha>=desde&&v.fecha<=hasta&&sucDeReg(v,v.vendedor)===suc.id).forEach(v=>{
    const c=costoVenta(v); if(!c) return;
    items.push({fecha:v.fecha,row:[fechaCortaStr(v.fecha),'Costo de productos vendidos',v.productoNombre+' x'+v.cantidad,c,'Venta de producto']});
  });
  todasSesiones().forEach(s=>movsVivos(s).filter(m=>m.tipo==='salida'&&m.gasto).forEach(m=>{
    const f=ymdLocal(new Date(m.ts)); if(f<desde||f>hasta) return;
    const sId=s.sucursal||(sucursales[0]||{}).id; if(sId!==suc.id) return;
    items.push({fecha:f,row:[fechaCortaStr(f),catFin(m.cat||'otros').n,m.detalle||m.concepto||'',numV(m.monto),'Movimiento de caja']});
  }));
  items.sort((a,b)=>a.fecha.localeCompare(b.fecha));
  const rows=items.map(x=>x.row), total=rows.reduce((s,r)=>s+r[3],0);
  const ws=xlsxSheetFromRows(['INDA STUDIO — '+suc.nombre,'Gastos','Generado: '+fechaCortaStr(hoyStr())],['Fecha','Categoría','Detalle','Monto','Origen'],rows,[3],['Total del período','','',total,'']);
  XLSX.utils.book_append_sheet(wb,ws,hojaNombre('Gastos',suc));
}
function agregarHojaLiquidacion(wb,suc,D,pctMap,desde,hasta){
  const profs=allUsers.filter(u=>esProf(u)&&sucursalesDe(u).includes(suc.id));
  const qks=quincenasEnRango(D,desde,hasta), rows=[];
  profs.forEach(u=>{
    const turnosSuc=D.turnos.filter(t=>t.prof.id===u.id&&sucDeReg(t,u)===suc.id);
    const ventasSuc=D.ventas.filter(v=>v.vendedor.id===u.id&&sucDeReg(v,u)===suc.id);
    const fmGlobal=factPorQuincena(D.turnos.filter(t=>t.prof.id===u.id));
    qks.forEach(qk=>{
      const c=comisionQuincenaDe(u,qk,turnosSuc); if(!c.fact&&!c.comision) return;
      const aseg=estadoAsegurado(u,qk,fmGlobal,c.comision), extra=extraAplicable(aseg);
      const tq=turnosSuc.filter(t=>t.fecha&&quincenaKey(t.fecha)===qk), vq=ventasSuc.filter(v=>v.fecha&&quincenaKey(v.fecha)===qk);
      const porMedio=(m)=>tq.filter(t=>t.medio===m).reduce((s,t)=>s+numV(t.aCobrar!=null?t.aCobrar:t.monto),0)+vq.filter(v=>v.medio===m).reduce((s,v)=>s+numV(v.total),0);
      const efectivo=porMedio('efectivo'), mp=porMedio('mp')+porMedio('tarjeta'), totalLiq=c.comision+extra, saldo=totalLiq-mp;
      const saldoTxt=saldo>1?('Local le debe '+fp(saldo)):saldo<-1?('Depositá '+fp(-saldo)):'Cuentas saldadas';
      rows.push([qLabel(qk),u.name,nombreRubro((u.rubros&&u.rubros[0])||'')||'—',c.fact,Math.round(c.pct*10)/10,c.normal+c.paqNormal,c.extra+c.paqExtra+extra,totalLiq,efectivo,mp,saldoTxt]);
    });
  });
  const ws=xlsxSheetFromRows(['INDA STUDIO — '+suc.nombre,'Liquidación de empleados','Generado: '+fechaCortaStr(hoyStr())],['Quincena','Profesional','Rubro','Facturado','% comisión','Comisión normal','Plata extra','Total liquidado','Cobró en efectivo','Cobró por MP','Saldo'],rows,[3,5,6,7,8,9],null);
  XLSX.utils.book_append_sheet(wb,ws,hojaNombre('Liquidación',suc));
}
function agregarHojaCaja(wb,suc,T){
  const rows=T.interno.slice().sort((a,b)=>String(a.ts).localeCompare(String(b.ts))).map(m=>[fechaCortaStr(ymdLocal(new Date(m.ts))),catInterno(m.interno).n,m.detalle||'',numV(m.monto)]);
  const ws=xlsxSheetFromRows(['INDA STUDIO — '+suc.nombre,'Caja y movimientos internos','Generado: '+fechaCortaStr(hoyStr())],['Fecha','Tipo','Detalle','Monto'],rows,[3],null);
  XLSX.utils.book_append_sheet(wb,ws,hojaNombre('Caja interno',suc));
}
function generarExcelContador(){
  if(typeof XLSX==='undefined'){ showToast('No se pudo cargar la librería de Excel (revisá la conexión a internet e intentá de nuevo)'); return; }
  const sucSel=document.getElementById('exf-suc').value, modo=document.getElementById('exf-modo').value;
  const mes=modo==='mes'?document.getElementById('exf-mes').value:'';
  if(modo==='mes'&&!mes){ showToast('Elegí el mes'); return; }
  exportFinState={suc:sucSel,mes};
  const desde=mes?mes+'-01':'2000-01-01';
  const hasta=mes?(()=>{ const [y,m]=mes.split('-').map(Number); return mes+'-'+pad2(finMesUTC(y,m)); })():hoyStr();
  const periodoLabel=mes?(MESES[Number(mes.split('-')[1])-1]+' '+mes.split('-')[0]):'Todo el histórico (hasta '+fechaCortaStr(hoyStr())+')';
  const sucs=sucSel==='todas'?sucursales:sucursales.filter(s=>s.id===sucSel);
  if(!sucs.length){ showToast('No hay sucursales cargadas'); return; }
  const D=adminDatos(), pctMap=pctPorQuincena(D), S=finCalc(desde,hasta,{D,pctMap});
  const wb=XLSX.utils.book_new();
  sucs.forEach(suc=>{
    agregarHojaResumen(wb,suc,S[suc.id]||{ing:{servicios:0,productos:0,membresias:0,paquetes:0,senas:0},eg:{},reinversion:0,interno:[]},periodoLabel);
    agregarHojaIngresos(wb,suc,D,desde,hasta);
    agregarHojaResumenProf(wb,suc,D,pctMap,desde,hasta);
    agregarHojaFichaProf(wb,suc);
    agregarHojaGastos(wb,suc,D,desde,hasta);
    agregarHojaLiquidacion(wb,suc,D,pctMap,desde,hasta);
    agregarHojaCaja(wb,suc,S[suc.id]||{interno:[]});
  });
  const nombreSuc=sucSel==='todas'?'Ambas sucursales':sucs[0].nombre;
  XLSX.writeFile(wb,'Inda Studio - '+nombreSuc+' - '+(mes||'historico')+'.xlsx');
  closeModal('modal-registro'); showToast('Excel generado ✓');
}

// ---------- gastos (dia a dia) ----------
function finGastos(c){
  const r=rangoFin(); const ids=finState.suc;
  const L=finData.gastos.filter(g=>!g.anulado&&g.fecha>=r.desde&&g.fecha<=r.hasta&&(ids==='todas'||g.sucursal===ids||(!g.sucursal||g.sucursal==='todas'))).sort((a,b)=>b.fecha.localeCompare(a.fecha)||String(b.creadoEn).localeCompare(String(a.creadoEn)));
  const total=L.reduce((s,g)=>s+numV(g.monto),0);
  const dias={}; L.forEach(g=>{ (dias[g.fecha]=dias[g.fecha]||[]).push(g); });
  c.innerHTML=chipsFin()+`<div class="sec-hdr" style="margin:0 0 8px"><span class="sec-title">🧾 Gastos cargados · ${fp(total)}</span><button class="lnk" onclick="abrirFormGasto('')">+ Cargar gasto</button></div>
    <div style="font-size:11.5px;color:var(--muted2);margin:-2px 2px 4px">${r.label}. Acá van los gastos del día a día (insumos, arreglos, publicidad…). Los que se repiten (alquiler, sueldos, suscripciones) van en "Gastos fijos".</div>
    <div style="font-size:11px;color:var(--muted2);margin:0 2px 10px">📷 Comprobante obligatorio desde ${fp(umbralComprobante())} · <button class="lnk" onclick="editarUmbralComprobante()">Cambiar monto</button></div>
    ${Object.entries(dias).map(([f,l])=>`<div style="font-size:11px;font-weight:800;color:var(--muted);text-transform:uppercase;letter-spacing:.08em;margin:10px 0 4px">${DIAS_LARGO[new Date(f+'T00:00:00Z').getUTCDay()]} ${fechaCortaStr(f)}</div>${l.map(g=>{ const ct=catFin(g.categoria); return `<div class="card" style="margin-bottom:6px;padding:10px 12px"><div style="display:flex;align-items:center;gap:10px">${g.comprobante?`<img src="${g.comprobante}" onclick="verComprobante('${g.id}')" style="width:34px;height:34px;object-fit:cover;border-radius:6px;cursor:pointer;flex-shrink:0"/>`:`<span style="width:10px;height:34px;border-radius:4px;background:${ct.c};flex-shrink:0"></span>`}<div style="flex:1;min-width:0"><div style="font-size:13px;font-weight:700">${escH(g.desc||ct.n)}</div><div style="font-size:11px;color:var(--muted2)">${escH(ct.n)} · ${(g.sucursal&&g.sucursal!=='todas')?escH((sucursalDe(g.sucursal)||{}).nombre||''):'Compartido'}</div></div><b style="font-size:14px">${fp(g.monto)}</b><button class="lnk" onclick="abrirFormGasto('${g.id}')">✏️</button><button class="lnk" style="color:#f472b6" onclick="borrarGasto('${g.id}')">×</button></div></div>`; }).join('')}`).join('')||'<div class="empty"><div class="e-icon">🧾</div><p>No hay gastos cargados en este período.</p></div>'}`;
}
function verComprobante(id){
  const g=finData.gastos.find(x=>x.id===id); if(!g||!g.comprobante) return;
  document.getElementById('registro-content').innerHTML=cabeceraModal('🧾 Comprobante')+`<img src="${g.comprobante}" style="width:100%;border-radius:12px"/>`;
  openModal('modal-registro');
}
function selectCategorias(sel,fn){
  return GRUPOS_FIN.filter(([t])=>t!=='comision').map(([t,n])=>`<optgroup label="${n}">${CAT_GASTOS.filter(x=>x.t===t).map(x=>`<option value="${x.id}" ${sel===x.id?'selected':''}>${escH(x.n)}</option>`).join('')}</optgroup>`).join('');
}
const selFin='width:100%;background:var(--s2);border:1.5px solid var(--border2);border-radius:12px;padding:12px;color:var(--text);font-family:var(--font);font-size:14px';
// Umbral a partir del cual un gasto pide sí o sí foto del comprobante (configurable, default $50.000)
function umbralComprobante(){ const v=numV(finData.cfg&&finData.cfg.comprobanteDesde); return v>0?v:50000; }
async function editarUmbralComprobante(){
  const v=await uiPrompt('Comprobante obligatorio',{msg:'A partir de qué monto un gasto necesita sí o sí una foto del comprobante.',label:'Monto',type:'number',value:umbralComprobante(),ok:'Guardar'});
  if(v==null) return;
  await cambiarFin(d=>{ d.cfg={...(d.cfg||{}),comprobanteDesde:Math.max(0,numV(v))}; });
  showToast('Guardado ✓'); renderAdmin();
}
// Comprime la foto en el navegador antes de guardarla (si no, un comprobante por celular vuela el localStorage)
function comprimirImagen(file,maxW=1000,calidad=.72){
  return new Promise((resolve,reject)=>{
    const rd=new FileReader();
    rd.onload=()=>{
      const img=new Image();
      img.onload=()=>{
        const esc=Math.min(1,maxW/img.width), w=Math.round(img.width*esc)||1, h=Math.round(img.height*esc)||1;
        const cv=document.createElement('canvas'); cv.width=w; cv.height=h;
        cv.getContext('2d').drawImage(img,0,0,w,h);
        resolve(cv.toDataURL('image/jpeg',calidad));
      };
      img.onerror=()=>reject(new Error('imagen inválida'));
      img.src=rd.result;
    };
    rd.onerror=()=>reject(new Error('no se pudo leer el archivo'));
    rd.readAsDataURL(file);
  });
}
let gastoComprobantePend=null;
async function elegirComprobante(inp){
  const f=inp.files&&inp.files[0]; if(!f) return;
  try{ gastoComprobantePend=await comprimirImagen(f); }catch(e){ showToast('No se pudo procesar la foto'); return; }
  renderComprobantePreview();
}
function quitarComprobante(){ gastoComprobantePend=null; renderComprobantePreview(); }
function renderComprobantePreview(){
  const el=document.getElementById('fg-comprobante-prev'); if(!el) return;
  el.innerHTML=gastoComprobantePend?`<div style="display:flex;align-items:center;gap:8px;margin-top:8px"><img src="${gastoComprobantePend}" style="width:52px;height:52px;object-fit:cover;border-radius:8px;border:1px solid var(--border2)"/><span style="font-size:12px;color:#34d399;flex:1">✓ Comprobante listo</span><button class="lnk" style="color:#f472b6" onclick="quitarComprobante()">Quitar</button></div>`:'';
}
function abrirFormGasto(id){
  const g=id?finData.gastos.find(x=>x.id===id):null;
  gastoComprobantePend=g?g.comprobante||null:null;
  document.getElementById('registro-content').innerHTML=cabeceraModal(g?'Editar gasto':'Cargar gasto 🧾')+`
    <div class="field"><label>Monto</label><input id="fg-monto" type="number" inputmode="decimal" placeholder="0" value="${g?g.monto:''}"/></div>
    <div class="field" style="margin-top:8px"><label>Categoría</label><select id="fg-cat" style="${selFin}">${selectCategorias(g?g.categoria:'insumos')}</select></div>
    <div class="field" style="margin-top:8px"><label>Sucursal</label><select id="fg-suc" style="${selFin}"><option value="" ${g||finState.suc!=='todas'?'':'selected'} disabled>Elegí una sucursal…</option>${sucursales.map(s=>`<option value="${s.id}" ${g?(g.sucursal===s.id?'selected':''):(finState.suc===s.id?'selected':'')}>${escH(s.nombre)}</option>`).join('')}<option value="todas" ${g&&g.sucursal==='todas'?'selected':''}>Compartido (se reparte entre sucursales)</option></select></div>
    <div class="field" style="margin-top:8px"><label>Fecha</label><input id="fg-fecha" type="date" value="${g?g.fecha:hoyStr()}"/></div>
    <div class="field" style="margin-top:8px"><label>Detalle (opcional)</label><input id="fg-desc" placeholder="Ej: cera y navajas" value="${escH(g?g.desc||'':'')}"/></div>
    <div class="field" style="margin-top:8px"><label>Foto del comprobante (obligatoria desde ${fp(umbralComprobante())})</label>
      <label class="btn btn-ghost" style="margin:0;text-align:center;cursor:pointer">📷 ${g&&g.comprobante?'Cambiar foto':'Sacar / subir foto'}<input type="file" accept="image/*" capture="environment" style="display:none" onchange="elegirComprobante(this)"/></label>
      <div id="fg-comprobante-prev"></div>
    </div>
    <button class="btn btn-primary" onclick="guardarGasto('${g?g.id:''}')" style="margin-top:14px">${g?'Guardar cambios':'Guardar gasto'}</button>`;
  renderComprobantePreview();
  openModal('modal-registro');
}
async function guardarGasto(id){
  const v=(i)=>document.getElementById(i).value;
  const monto=numV(v('fg-monto')); if(monto<=0){ showToast('Poné el monto'); return; }
  if(!v('fg-suc')){ showToast('Elegí una sucursal (o "Compartido" si es de las dos)'); return; }
  if(monto>=umbralComprobante()&&!gastoComprobantePend){ showToast('Este gasto necesita foto del comprobante (es mayor a '+fp(umbralComprobante())+')'); return; }
  const fecha=v('fg-fecha')||hoyStr(); const ahora=new Date().toISOString();
  await cambiarFin(d=>{
    const dato={monto,categoria:v('fg-cat'),sucursal:v('fg-suc'),fecha,desc:v('fg-desc').trim(),comprobante:gastoComprobantePend||null,upd:ahora};
    const g=id?d.gastos.find(x=>x.id===id):null;
    if(g) Object.assign(g,dato); else d.gastos.push({id:'g'+Date.now().toString(36),creadoEn:ahora,...dato});
  });
  gastoComprobantePend=null;
  closeModal('modal-registro'); showToast('Gasto guardado ✓'); renderAdmin();
}
async function borrarGasto(id){
  const motivo=await pedirMotivoAnulacion('¿Anular este gasto?'); if(!motivo) return;
  await cambiarFin(d=>{ const g=d.gastos.find(x=>x.id===id); if(g) anularRegistro(g,motivo); });
  renderAdmin();
}

// ---------- gastos fijos ----------
function finFijos(c){
  const act=finData.fijos.filter(f=>!f.anulado&&f.activo!==false);
  const ver=(f)=>finState.suc==='todas'||!f.sucursal||f.sucursal==='todas'||f.sucursal===finState.suc;
  const L=finData.fijos.filter(f=>!f.anulado).filter(ver);
  const totMes=L.filter(f=>f.activo!==false).reduce((s,f)=>s+mensualizado(f),0);
  const porTipo=GRUPOS_FIN.filter(([t])=>t!=='comision'&&t!=='variable').map(([t,n])=>({t,n,v:L.filter(f=>f.activo!==false&&catFin(f.categoria).t===t).reduce((s,f)=>s+mensualizado(f),0)})).filter(x=>x.v>0);
  const porSuc=sucursales.map(s=>({s,v:act.reduce((a,f)=>a+((f.sucursal&&f.sucursal!=='todas')?(f.sucursal===s.id?mensualizado(f):0):mensualizado(f)/sucursales.length),0)}));
  c.innerHTML=`<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px"><button onclick="finSet('suc','todas')" style="${pillStyle(finState.suc==='todas','#4A136B')}">📍 Todas</button>${sucursales.map(s=>`<button onclick="finSet('suc','${s.id}')" style="${pillStyle(finState.suc===s.id,s.color)}">${escH(s.nombre)}</button>`).join('')}</div>
    <div class="sec-hdr" style="margin:0 0 8px"><span class="sec-title">📌 Gastos fijos por mes · ${fp(totMes)}</span><button class="lnk" onclick="abrirFormFijo('')">+ Nuevo</button></div>
    ${totMes>0?`<div class="card" style="margin-bottom:10px">${porTipo.map(x=>`<div style="margin-bottom:6px"><div style="display:flex;justify-content:space-between;font-size:12px"><span>${x.n}</span><b>${fp(x.v)} <span style="color:var(--muted);font-weight:600">${Math.round(x.v/totMes*100)}%</span></b></div><div style="height:5px;background:var(--border2);border-radius:3px;margin-top:3px"><div style="height:100%;width:${x.v/totMes*100}%;background:#4A136B;border-radius:3px"></div></div></div>`).join('')}
      ${finState.suc==='todas'&&sucursales.length>1?`<div style="font-size:11px;color:var(--muted2);margin-top:8px;border-top:1px solid var(--border);padding-top:6px">Por sucursal: ${porSuc.map(x=>`<span style="color:${x.s.color};font-weight:800">${escH(x.s.nombre)}</span> ${fp(x.v)}`).join(' · ')}</div>`:''}</div>`:''}
    ${GRUPOS_FIN.filter(([t])=>t!=='comision'&&t!=='variable').map(([t,n])=>{ const l=L.filter(f=>catFin(f.categoria).t===t); if(!l.length) return ''; return `<div style="font-size:11px;font-weight:800;color:var(--muted);text-transform:uppercase;letter-spacing:.08em;margin:12px 0 6px">${n}</div>${l.map(f=>{ const ct=catFin(f.categoria), fe=proximoVenc(f), dd=diasEntre(hoyStr(),fe); return `<div class="card" style="margin-bottom:6px;padding:10px 12px;${f.activo===false?'opacity:.5':''}"><div style="display:flex;align-items:center;gap:10px"><span style="width:10px;height:38px;border-radius:4px;background:${ct.c};flex-shrink:0"></span><div style="flex:1;min-width:0"><div style="font-size:13px;font-weight:800">${escH(f.nombre)}</div><div style="font-size:11px;color:var(--muted2);line-height:1.5">${FRECUENCIAS.find(x=>x[0]===f.frecuencia)?.[1]||'Mensual'} · ${f.frecuencia==='semanal'?'los '+DIAS_LARGO[numV(f.dia)].toLowerCase():'vence '+(f.frecuencia==='anual'?fechaCortaStr(fe):'el '+(f.frecuencia==='quincenal'?'15 y fin de mes':numV(f.dia)||1))} · ${f.sucursal&&f.sucursal!=='todas'?escH((sucursalDe(f.sucursal)||{}).nombre||''):'Compartido'}${f.rubro?' · '+escH(nombreRubro(f.rubro)):''}<br>${f.activo===false?'Pausado':'Próximo pago: '+fechaCortaStr(fe)+' ('+(dd===0?'hoy':dd===1?'mañana':'en '+dd+' días')+')'}</div></div><div style="text-align:right"><b style="font-size:14px">${fp(f.monto)}</b><div style="font-size:10px;color:var(--muted)">${fp(mensualizado(f))}/mes</div></div></div>
      <div style="display:flex;gap:12px;margin-top:6px;padding-left:20px"><button class="lnk" onclick="abrirFormFijo('${f.id}')">Editar</button><button class="lnk" onclick="pausarFijo('${f.id}')">${f.activo===false?'Reactivar':'Pausar'}</button><button class="lnk" style="color:#f472b6" onclick="borrarFijo('${f.id}')">Borrar</button></div></div>`; }).join('')}`; }).join('')||'<div class="empty"><div class="e-icon">📌</div><p>Todavía no cargaste gastos fijos.<br>Alquiler, sueldos de empleados fijos, cuotas, suscripciones, luz, internet…</p></div>'}`;
}
function abrirFormFijo(id){
  const f=id?finData.fijos.find(x=>x.id===id):null;
  document.getElementById('registro-content').innerHTML=cabeceraModal(f?'Editar gasto fijo':'Nuevo gasto fijo 📌')+`
    <div class="field"><label>Nombre</label><input id="ff-nombre" placeholder="Ej: Alquiler local Diego Laure" value="${escH(f?f.nombre:'')}"/></div>
    <div class="field" style="margin-top:8px"><label>Monto</label><input id="ff-monto" type="number" inputmode="decimal" placeholder="0" value="${f?f.monto:''}"/></div>
    <div class="field" style="margin-top:8px"><label>Categoría</label><select id="ff-cat" style="${selFin}">${selectCategorias(f?f.categoria:'alquiler')}</select></div>
    <div style="display:flex;gap:8px;margin-top:8px"><div class="field" style="flex:1"><label>Cada</label><select id="ff-frec" onchange="ffFrec()" style="${selFin}">${FRECUENCIAS.map(([k,l])=>`<option value="${k}" ${(f?f.frecuencia:'mensual')===k?'selected':''}>${l}</option>`).join('')}</select></div>
      <div class="field" style="flex:1" id="ff-dia-w"></div></div>
    <div class="field" style="margin-top:8px"><label>Sucursal</label><select id="ff-suc" style="${selFin}"><option value="todas">Compartido (se reparte entre sucursales)</option>${sucursales.map(s=>`<option value="${s.id}" ${f&&f.sucursal===s.id?'selected':''}>${escH(s.nombre)}</option>`).join('')}</select></div>
    <div class="field" style="margin-top:8px"><label>Rubro al que pertenece (opcional, para el punto de equilibrio)</label><select id="ff-rubro" style="${selFin}"><option value="">General (se reparte entre los rubros)</option>${rubros.map(r=>`<option value="${r.id}" ${f&&f.rubro===r.id?'selected':''}>${escH(r.nombre)}</option>`).join('')}</select></div>
    <button class="btn btn-primary" onclick="guardarFijo('${f?f.id:''}')" style="margin-top:14px">${f?'Guardar cambios':'Guardar gasto fijo'}</button>`;
  window.__ffDia=f?f.dia:''; ffFrec(); openModal('modal-registro');
}
function ffFrec(){
  const fr=document.getElementById('ff-frec').value, w=document.getElementById('ff-dia-w'); const dia=window.__ffDia;
  w.innerHTML=fr==='semanal'?`<label>Día de la semana</label><select id="ff-dia" style="${selFin}">${DIAS_LARGO.map((n,i)=>`<option value="${i}" ${numV(dia)===i?'selected':''}>${n}</option>`).join('')}</select>`
    :fr==='anual'?`<label>Fecha (día y mes)</label><input id="ff-dia" type="date" value="${/^\d\d-\d\d$/.test(dia||'')?new Date().getFullYear()+'-'+dia:''}"/>`
    :fr==='quincenal'?`<label>Se paga</label><div style="padding:13px 4px;font-size:13px;color:var(--muted2)">El 15 y a fin de mes</div><input id="ff-dia" type="hidden" value="15"/>`
    :`<label>Día del mes que vence</label><input id="ff-dia" type="number" min="1" max="31" placeholder="5" value="${numV(dia)||''}"/>`;
}
async function guardarFijo(id){
  const v=(i)=>document.getElementById(i).value;
  const nombre=v('ff-nombre').trim(), monto=numV(v('ff-monto')); if(!nombre||monto<=0){ showToast('Poné el nombre y el monto'); return; }
  const fr=v('ff-frec'); let dia=v('ff-dia'); if(fr==='anual') dia=dia?dia.slice(5):'01-01'; if(fr==='mensual'&&!(numV(dia)>=1&&numV(dia)<=31)){ showToast('Poné el día del mes en que vence'); return; }
  const ahora=new Date().toISOString();
  await cambiarFin(d=>{
    const dato={nombre,monto,categoria:v('ff-cat'),frecuencia:fr,dia,sucursal:v('ff-suc'),rubro:v('ff-rubro'),upd:ahora};
    const f=id?d.fijos.find(x=>x.id===id):null;
    if(f) Object.assign(f,dato); else d.fijos.push({id:'f'+Date.now().toString(36),activo:true,desde:hoyStr().slice(0,8)+'01',creadoEn:ahora,...dato});
  });
  closeModal('modal-registro'); showToast('Guardado ✓'); renderAdmin();
}
async function pausarFijo(id){ await cambiarFin(d=>{ const f=d.fijos.find(x=>x.id===id); if(f){ f.activo=f.activo===false; f.upd=new Date().toISOString(); } }); renderAdmin(); }
async function borrarFijo(id){
  const motivo=await pedirMotivoAnulacion('¿Anular este gasto fijo?'); if(!motivo) return;
  await cambiarFin(d=>{ const f=d.fijos.find(x=>x.id===id); if(f) anularRegistro(f,motivo); }); renderAdmin();
}

// ---------- punto de equilibrio (mismo modelo que la planilla de costos) ----------
// costo variable por servicio = comision + insumos que se gastan en cada servicio
// costo fijo por servicio = gastos fijos / servicios hechos       margen = precio - costo total
// punto de equilibrio = gastos fijos / (precio - costo variable)   ocupacion = servicios / (dias x turnos x profesionales)
const cfgFin=()=>({diasLab:22,turnosDia:10,reserva:5,inversion:15,retiros:15,...(finData.cfg||{})});
function costoInsumosServicio(rubro){ return (finData.consumibles||[]).filter(x=>!x.anulado&&rubroEn(x.rubro,rubro)).reduce((a,x)=>a+numV(x.precio)/Math.max(1,numV(x.rinde)),0); }
function finEquilibrio(c){
  const hoy=hoyStr(), [y,m]=hoy.split('-').map(Number), desde=y+'-'+pad2(m)+'-01', hasta=y+'-'+pad2(m)+'-'+finMesUTC(y,m);
  const diasMes=finMesUTC(y,m), diasPas=Math.max(1,numV(hoy.slice(8))), cf=cfgFin();
  const suc=finState.suc, ids=suc==='todas'?sucursales.map(s=>s.id):[suc], nS=Math.max(1,sucursales.length);
  const S=finCalc(desde,hasta), T=juntarS(S,ids);
  const fijosAlc=finData.fijos.filter(f=>!f.anulado&&f.activo!==false).map(f=>{ const compartido=!f.sucursal||f.sucursal==='todas'; const share=compartido?(suc==='todas'?1:1/nS):(suc==='todas'||f.sucursal===suc?1:0); return {f,monto:mensualizado(f)*share}; }).filter(x=>x.monto>0);
  const totFijo=fijosAlc.reduce((a,x)=>a+x.monto,0);
  const porRubro={};
  T.turnos.forEach(x=>{ const r=x.rubro||'otros'; const o=porRubro[r]||(porRubro[r]={visitas:0,ingreso:0,com:0}); o.visitas++; o.ingreso+=numV(x.t.monto); o.com+=x.com; });
  const pros=allUsers.filter(u=>(esProf(u))&&(suc==='todas'||sucursalesDe(u).includes(suc)));
  pros.forEach(u=>(u.rubros||[]).forEach(r=>{ porRubro[r]=porRubro[r]||{visitas:0,ingreso:0,com:0}; }));
  fijosAlc.forEach(x=>{ if(x.f.rubro) porRubro[x.f.rubro]=porRubro[x.f.rubro]||{visitas:0,ingreso:0,com:0}; });
  const rids=Object.keys(porRubro);
  const generales=fijosAlc.filter(x=>!x.f.rubro).reduce((a,x)=>a+x.monto,0);
  const ingTotal=rids.reduce((a,r)=>a+porRubro[r].ingreso,0);
  const filas=rids.map(r=>{
    const o=porRubro[r]; const cat=servicios.filter(s=>s.rubro===r); const catProm=cat.length?cat.reduce((a,s)=>a+numV(s.precio),0)/cat.length:0;
    const ticket=o.visitas?o.ingreso/o.visitas:catProm; const comPct=o.ingreso>0?o.com/o.ingreso:0.45;
    const insumos=costoInsumosServicio(r), comMonto=ticket*comPct, cv=comMonto+insumos, contrib=ticket-cv;
    const propios=fijosAlc.filter(x=>x.f.rubro===r).reduce((a,x)=>a+x.monto,0);
    const parte=ingTotal>0?o.ingreso/ingTotal:1/Math.max(1,rids.length);
    const fijo=propios+generales*parte;
    const cfServ=o.visitas?fijo/o.visitas:0, costoTotal=cv+cfServ, margen=ticket-costoTotal;
    const pe=contrib>0?Math.ceil(fijo/contrib):0;
    const proy=Math.round(o.visitas/diasPas*diasMes);
    const nPro=Math.max(1,pros.filter(u=>(u.rubros||[]).includes(r)).length), cap=cf.diasLab*cf.turnosDia*nPro;
    const plan=finData.plan[suc+':'+r];
    return {r,nombre:r==='otros'?'Sin rubro':(nombreRubro(r)||r),o,ticket,comPct,comMonto,insumos,cv,contrib,fijo,cfServ,costoTotal,margen,pe,proy,cap,ocup:cap?o.visitas/cap:0,ocupProy:cap?proy/cap:0,nPro,plan,beneficio:margen*o.visitas};
  }).filter(f=>f.o.visitas||f.fijo>0).sort((a,b)=>b.fijo-a.fijo);
  const margenProd=T.ing.productos-(T.eg.costoprod||0);
  const beneficio=filas.reduce((a,f)=>a+(f.o.visitas?f.beneficio:-f.fijo),0)+margenProd;
  const cubierto=filas.reduce((a,f)=>a+f.o.visitas*f.contrib,0);
  c.innerHTML=`<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px"><button onclick="finSet('suc','todas')" style="${pillStyle(suc==='todas','#4A136B')}">📍 Todas</button>${sucursales.map(s=>`<button onclick="finSet('suc','${s.id}')" style="${pillStyle(suc===s.id,s.color)}">${escH(s.nombre)}</button>`).join('')}</div>
    <div class="sec-title" style="margin-bottom:6px">⚖️ Costos y punto de equilibrio · ${MESES[m-1]}</div>
    <div style="font-size:11.5px;color:var(--muted2);margin:0 2px 10px;line-height:1.5">Igual que en tu planilla: cada servicio tiene un <b style="color:var(--text)">costo variable</b> (comisión + insumos que se gastan en cada uno) y una parte de los <b style="color:var(--text)">gastos fijos</b>. Los gastos fijos generales se reparten según lo que factura cada rubro. Los insumos por servicio se cargan en "Costo por servicio".</div>
    <div class="stat-grid" style="grid-template-columns:repeat(3,1fr)">
      <div class="stat-card"><div class="sc-lbl">Gastos fijos / mes</div><div class="sc-val" style="font-size:20px;color:#f472b6">${fp(totFijo)}</div></div>
      <div class="stat-card"><div class="sc-lbl">Ya cubierto</div><div class="sc-val" style="font-size:20px;color:#34d399">${totFijo>0?Math.min(999,Math.round(cubierto/totFijo*100)):0}%</div><div class="sc-sub">${fp(cubierto)}</div></div>
      <div class="stat-card"><div class="sc-lbl">Beneficio del mes</div><div class="sc-val" style="font-size:20px;color:${beneficio>=0?'#34d399':'#f472b6'}">${fp(beneficio)}</div><div class="sc-sub">servicios + productos</div></div></div>
    ${filas.map(f=>{ const prog=f.pe?Math.min(100,f.o.visitas/f.pe*100):0; const proyGan=f.proy*f.contrib-f.fijo; const nPlan=f.plan!=null?numV(f.plan):null; const simN=nPlan!=null?nPlan:f.pe;
      const fila=(a,b,st)=>`<div style="display:flex;justify-content:space-between;font-size:12px;padding:2px 0;${st||''}"><span style="color:var(--muted2)">${a}</span><span>${b}</span></div>`;
      return `<div class="card" style="margin-bottom:10px"><div style="display:flex;justify-content:space-between;align-items:baseline"><div style="font-size:14px;font-weight:800">${escH(f.nombre)}</div><div style="font-size:11.5px;color:var(--muted2)">${f.o.visitas} servicios · gastos fijos <b style="color:var(--text)">${fp(f.fijo)}</b></div></div>
      <div style="margin:8px 0;padding:8px 10px;background:var(--s2);border-radius:10px">
        ${fila('Precio promedio'+(f.o.visitas?'':' (de lista)'),`<b>${fp(f.ticket)}</b>`)}
        ${fila('Comisión del profesional ('+Math.round(f.comPct*100)+'%)','−'+fp(f.comMonto))}
        ${fila('Insumos por servicio (gel, café, papel, cera, filos…)','−'+fp(f.insumos))}
        ${fila('<b>Costo variable</b>','<b>'+fp(f.cv)+'</b>','border-top:1px solid var(--border);margin-top:2px;padding-top:4px')}
        ${fila('Parte de gastos fijos por servicio'+(f.o.visitas?'':' (sin servicios todavía)'),'−'+fp(f.cfServ))}
        ${fila('<b>Margen por servicio</b> (precio − costo total)',`<b style="color:${f.margen>=0?'#34d399':'#f472b6'}">${fp(f.margen)}</b>`,'border-top:1px solid var(--border);margin-top:2px;padding-top:4px')}
      </div>
      ${f.pe?`<div style="display:flex;justify-content:space-between;font-size:12.5px;margin-bottom:4px"><span>Punto de equilibrio: <b>${f.pe}</b> servicios al mes (≈ ${(f.pe/diasMes).toFixed(1)} por día)</span><span>hiciste <b>${f.o.visitas}</b></span></div>
      <div style="height:8px;background:var(--border2);border-radius:4px;overflow:hidden"><div style="height:100%;width:${prog}%;background:${prog>=100?'#34d399':'#fbbf24'};border-radius:4px"></div></div>
      <div style="font-size:11.5px;color:var(--muted2);margin-top:6px;line-height:1.6">Cada servicio aporta ${fp(f.contrib)} y cubre el <b style="color:var(--text)">${f.fijo>0?(f.contrib/f.fijo*100).toFixed(1):0}%</b> de los gastos fijos de este rubro. Con tu ritmo terminás el mes en ~${f.proy} servicios → <b style="color:${proyGan>=0?'#34d399':'#f472b6'}">${proyGan>=0?'ganancia':'pérdida'} de ${fp(Math.abs(proyGan))}</b>.</div>`:''}
      <div style="font-size:11.5px;color:var(--muted2);margin-top:6px">Ocupación: <b style="color:var(--text)">${Math.round(f.ocup*100)}%</b> hoy · proyectada <b style="color:var(--text)">${Math.round(f.ocupProy*100)}%</b> <span style="color:var(--muted)">(${f.nPro} ${f.nPro===1?'profesional':'profesionales'} × ${cfgFin().diasLab} días × ${cfgFin().turnosDia} turnos = ${f.cap} servicios con la agenda llena)</span></div>
      <div style="display:flex;align-items:center;gap:8px;margin-top:8px;padding-top:8px;border-top:1px solid var(--border);font-size:12px"><span style="color:var(--muted2)">Si hago</span><input type="number" min="0" inputmode="numeric" value="${nPlan!=null?nPlan:''}" placeholder="${f.pe||0}" onchange="finPlan('${suc}:${f.r}',this.value)" style="width:80px;padding:6px 8px"/><span style="color:var(--muted2)">servicios: ganancia</span><b style="color:${simN*f.contrib-f.fijo>=0?'#34d399':'#f472b6'}">${fp(simN*f.contrib-f.fijo)}</b></div></div>`; }).join('')||'<div class="empty"><div class="e-icon">⚖️</div><p>Cargá tus gastos fijos para ver cuántos servicios necesitás.</p></div>'}
    ${T.ing.productos>0?`<div class="card" style="margin-bottom:10px"><div style="font-size:13px;font-weight:800;margin-bottom:4px">📦 Productos</div>${linea('Ventas',fp(T.ing.productos))}${linea('Costo de los productos vendidos','−'+fp(T.eg.costoprod||0))}${linea('<b>Ganancia por productos</b>','<b>'+fp(margenProd)+'</b>')}</div>`:''}`;
}
async function finPlan(k,v){ await cambiarFin(d=>{ if(v===''||v==null) delete d.plan[k]; else d.plan[k]=numV(v); }); renderAdmin(); }

