// ============ ANTHROPIC API ============
async function callClaude(prompt, system='') {
  const messages = [{role:'user', content:prompt}];
  const body = {messages};
  if(system) body.system = system;
  const {data:{session}={}} = supaClient ? await supaClient.auth.getSession() : {};
  if(!session) throw new Error('Sesión vencida: volvé a entrar');
  const r = await fetch('/api/chat', {
    method:'POST',
    headers:{'Content-Type':'application/json','Authorization':'Bearer '+session.access_token},
    body:JSON.stringify(body)
  });
  const d = await r.json();
  if(d.error) throw new Error(d.error.message);
  return d.content?.[0]?.text || '';
}

// Override claude.use('sample') with direct API call
const claudeOverride = {
  use: async (type) => {
    if(type === 'sample') {
      return async (prompt, opts) => {
        const text = await callClaude(prompt);
        return {text};
      };
    }
    return null;
  }
};

// Use override when claude is not available (Vercel)
const claudeAPI = typeof claude !== 'undefined' ? claude : claudeOverride;

// ============ CLOUD DB (Supabase) ============
// Backs the same DB.doc(path).get()/.set() interface used throughout the app.
const SUPABASE_URL = 'https://bdwpojszkyugqmuwcrqy.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJkd3BvanN6a3l1Z3FtdXdjcnF5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk1MDcwNDQsImV4cCI6MjEwNTA4MzA0NH0.c_Ty8indxncDqkQTYtB_FyYfvsAsKl7z1OrImiiQjUA';
const supaClient = (typeof window!=='undefined' && window.supabase && window.supabase.createClient)
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

function makeSupabaseDB(client){
  return {
    doc(path){
      return {
        async get(){
          try{
            const { data, error } = await client.from('luffy_data').select('value').eq('key', path).maybeSingle();
            if(error) throw error;
            return data ? data.value : null;
          }catch(e){ return null; }
        },
        async set(value){
          try{
            const { error } = await client.from('luffy_data').upsert({ key: path, value, updated_at: new Date().toISOString() });
            if(error) throw error;
            return true;
          }catch(e){ return false; }
        }
      };
    }
  };
}

// Which screen is currently visible — used to refresh the view in place once
// cloud data arrives after the initial (local-cache) render.
let currentScreenId = null;
function refreshCurrentView(){
  try{
    if(!profile) return;
    ({hub:renderHub, admin:renderAdmin, stories:renderStories, puntos:renderPuntos, recepcion:renderRecepcion, perfil:renderPerfil, encargado:renderEncargado, dinero:renderDineroContent, banco:renderBancoProf, kanban:renderKanban, clientes:renderClientes, crmboard:renderCRM, agenda:renderAgenda, cobranzas:renderCobranzas, caja:renderCajaScreen}[currentScreenId]||(()=>{}))();
  }catch(e){}
}

// ============ STATE ============
const ROLES = {admin:'Administrador', profesional:'Profesional', recepcionista:'Recepcionista', encargado:'Encargado'};
// Nada se borra: se anula con motivo, quién y cuándo, y se puede restaurar (ver abrirAnulados).
function anularRegistro(x,motivo){ const ts=new Date().toISOString(); x.anulado={motivo,por:profile?profile.name:'',porId:profile?profile.id:null,ts}; x.upd=ts; }
function restaurarRegistro(x){ const ts=new Date().toISOString(); x.restauradoEn=ts; x.anulado=null; x.upd=ts; }
async function pedirMotivoAnulacion(titulo){
  const m=await uiPrompt(titulo,{msg:'No se borra: queda anotado con quién y cuándo, y se puede restaurar desde Anulados.',type:'textarea',ok:'Anular'});
  if(m==null) return null; const t=m.trim(); if(!t){ showToast('Poné un motivo'); return null; } return t;
}

// Iconos vectoriales chicos (linea, sin relleno) para reemplazar emojis en los lugares mas visibles: menu, header, pestanas del admin.
const ICN={
  perfil:'<circle cx="12" cy="8" r="3.4"/><path d="M4.5 20c1-4.2 4-6.6 7.5-6.6s6.5 2.4 7.5 6.6"/>',
  contenido:'<rect x="3" y="4" width="18" height="16" rx="2.5"/><path d="M10 9l5 3-5 3z"/>',
  stock:'<path d="M3 7l9-4 9 4-9 4-9-4z"/><path d="M3 7v10l9 4 9-4V7"/><path d="M12 11v10"/>',
  clientes:'<circle cx="8.5" cy="8" r="3"/><circle cx="16" cy="9.5" r="2.4"/><path d="M2.5 20c.6-3.6 3-6 6-6s5.6 2.4 6.2 6"/><path d="M15.3 14.6c2.4.5 4.1 2.4 4.7 5.4"/>',
  dinero:'<rect x="2.5" y="6" width="19" height="13" rx="2.5"/><path d="M2.5 10.2h19"/><circle cx="16.3" cy="14.5" r="1.2" fill="currentColor" stroke="none"/>',
  banco:'<rect x="4" y="6" width="13" height="14" rx="2"/><path d="M8 10.5l4 2.4-4 2.4z"/><path d="M20 9v9a2 2 0 01-2 2H9.5"/>',
  kanban:'<rect x="3" y="4" width="7" height="16" rx="1.4"/><rect x="14" y="4" width="7" height="10" rx="1.4"/>',
  historias:'<rect x="7" y="2" width="10" height="20" rx="3"/><circle cx="12" cy="18" r="1" fill="currentColor" stroke="none"/>',
  puntos:'<polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"/>',
  guia:'<circle cx="12" cy="12" r="9"/><polygon points="15,9 13,13 9,15 11,11"/>',
  pass:'<circle cx="7.5" cy="15.5" r="4.5"/><path d="M10.6 12.4L20 3M15 8l3 3M18 5l2.5 2.5"/>',
  salir:'<path d="M9 21H6a2 2 0 01-2-2V5a2 2 0 012-2h3"/><polyline points="15,17 20,12 15,7"/><line x1="20" y1="12" x2="8" y2="12"/>',
  panel:'<path d="M4 21V10M10 21V6M16 21V13M22 21H2"/>',
  equipo:'<circle cx="9" cy="8" r="3"/><circle cx="17" cy="8.5" r="2.4"/><path d="M2 20.5c.6-3.2 3.3-5.5 7-5.5s6.4 2.3 7 5.5"/><path d="M15.6 15.3c2.6.4 4.5 2.3 5 5.2"/>',
  catalogo:'<path d="M20.4 12.6L11.4 3.6H4v7.4l9 9a2 2 0 002.8 0l4.6-4.6a2 2 0 000-2.8z"/><circle cx="8" cy="8" r="1.4" fill="currentColor" stroke="none"/>',
  finanzas:'<rect x="2" y="7" width="20" height="14" rx="2.2"/><path d="M7 7V5.5A1.5 1.5 0 018.5 4h7A1.5 1.5 0 0117 5.5V7"/><path d="M2 12h20"/>',
  recepcion:'<path d="M21.5 16.7v2.9a1.9 1.9 0 01-2.1 1.9 18.8 18.8 0 01-8.2-2.9 18.5 18.5 0 01-5.7-5.7 18.8 18.8 0 01-2.9-8.3A1.9 1.9 0 014.4 2.6h2.9a1.9 1.9 0 011.9 1.6c.13.9.35 1.8.66 2.7a1.9 1.9 0 01-.43 2L8.1 10.2a15 15 0 005.7 5.7l1.3-1.3a1.9 1.9 0 012-.4c.85.32 1.76.54 2.7.66a1.9 1.9 0 011.7 1.9z"/>',
  moneda:'<circle cx="12" cy="12" r="9"/><path d="M12 6.5v11M9.3 8.9c0-1.3 1.2-2.4 2.7-2.4s2.7 1.1 2.7 2.3c0 1.5-1.3 2-2.7 2.5-1.5.5-2.7 1-2.7 2.5 0 1.2 1.2 2.3 2.7 2.3s2.7-1.1 2.7-2.4"/>',
  idea:'<path d="M9 18.5h6M10 21h4M8.5 14.5A5.5 5.5 0 1115.5 14.5c-.7.6-1.2 1.4-1.2 2.3H9.7c0-.9-.5-1.7-1.2-2.3z"/><path d="M12 2.5v1.3M4.5 6l1 1M19.5 6l-1 1M2.8 12h1.3M19.9 12h1.3"/>',
  config:'<line x1="4" y1="6" x2="20" y2="6"/><circle cx="9" cy="6" r="2" fill="currentColor" stroke="none"/><line x1="4" y1="12" x2="20" y2="12"/><circle cx="16" cy="12" r="2" fill="currentColor" stroke="none"/><line x1="4" y1="18" x2="20" y2="18"/><circle cx="11" cy="18" r="2" fill="currentColor" stroke="none"/>',
  agenda:'<rect x="3" y="5" width="18" height="16" rx="2.2"/><path d="M3 10h18"/><path d="M8 3v4M16 3v4"/>',
  tareas:'<rect x="4" y="4" width="16" height="16" rx="2.2"/><path d="M8 11l2.3 2.3L16 8"/>',
  candado:'<rect x="5" y="10.5" width="14" height="9.5" rx="2"/><path d="M8 10.5V7.5a4 4 0 018 0v3"/>',
  web:'<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.4 2.4 3.6 5.6 3.6 9s-1.2 6.6-3.6 9c-2.4-2.4-3.6-5.6-3.6-9S9.6 5.4 12 3z"/>',
};
// Ícono en circulo de color solido (sin glow), reemplaza el emoji suelto en las cards de stats
function iconoCard(name,color,size){ return `<div style="width:${size||38}px;height:${size||38}px;border-radius:12px;background:${color}1f;color:${color};display:flex;align-items:center;justify-content:center;flex-shrink:0">${mi(name,(size||38)*.5)}</div>`; }
function mi(name,size){ return '<svg viewBox="0 0 24 24" width="'+(size||19)+'" height="'+(size||19)+'" style="stroke:currentColor;stroke-width:1.7;fill:none;stroke-linecap:round;stroke-linejoin:round;vertical-align:-5px">'+(ICN[name]||'')+'</svg>'; }

let profile = null;
// Bumped on every logout/new login attempt so an in-flight loginAs() from a
// rapid double-tap (or one superseded by a later logout) can tell it's
// stale and stop before navigating anywhere — without this, a slow
// pending login could "resurrect" the session right after SALIR.
let sessionToken = 0;
let DB = null;
let reels = [];
// turnos: cortes (lo de siempre). ventas: venta de productos — se cuenta
// aparte de los cortes en toda la app, por pedido explicito. deudores:
// clientes que no pagaron — no suman a la facturacion de la quincena.
let dineroData = {turnos:[], ventas:[], deudores:[]};
let yoData = {ingresos:[],gastos:[],deudas:[]};

// ============ PRODUCTOS ============
let productos = []; // {id, nombre, costo, precioVenta, comisionPct, stock, alertaStock, creado}

function loadProductos(){
  try{ productos=JSON.parse(localStorage.getItem('luffy_productos')||'[]'); }catch(e){ productos=[]; }
  if(DB){
    DB.doc('luffy/productos').get().then(r=>{
      if(r&&r.list&&JSON.stringify(r.list)!==JSON.stringify(productos)){ productos=r.list; try{localStorage.setItem('luffy_productos',JSON.stringify(productos));}catch(e){} refreshCurrentView(); }
    }).catch(()=>{});
  }
}
function persistProductosLocal(){ try{localStorage.setItem('luffy_productos',JSON.stringify(productos));}catch(e){} }
// Suma/resta unidades. Se ve al instante en pantalla y despues se aplica sobre la lista MAS FRESCA de la nube,
// asi dos personas vendiendo a la vez no se pisan (antes cada una escribia su copia entera).
function ajustarStock(items){
  const aplicar=(lista)=>items.forEach(i=>{ const p=lista.find(x=>x.id===i.id); if(p){ p.stock=numV(p.stock)+i.delta; if(i.costo!=null) p.costo=i.costo; } });
  aplicar(productos); persistProductosLocal();
  if(!DB) return;
  const ref=DB.doc('luffy/productos');
  Promise.resolve(ref.get()).then(r=>{
    if(!(r&&Array.isArray(r.list))) return ref.set({list:productos});
    aplicar(r.list); productos=r.list; persistProductosLocal();
    return Promise.resolve(ref.set({list:productos})).then(()=>refreshCurrentView());
  }).catch(()=>{ try{ ref.set({list:productos}); }catch(e){} });
}
// Alta/baja de productos (admin) sobre la lista mas fresca. fn recibe la lista y devuelve la lista nueva.
function productosCambiar(fn){
  productos=fn(productos)||productos; persistProductosLocal();
  if(!DB) return;
  const ref=DB.doc('luffy/productos');
  Promise.resolve(ref.get()).then(r=>{
    const base=(r&&Array.isArray(r.list))?r.list:productos;
    productos=fn(base)||base; persistProductosLocal();
    return ref.set({list:productos});
  }).catch(()=>{ try{ ref.set({list:productos}); }catch(e){} });
}

// ============ SERVICIOS Y OFERTAS (los carga el admin) ============
const DESC_EFECTIVO_PCT = 10; // 10% off en servicios si pagan en efectivo
const CUMPLE_DESC_PCT = 15, CUMPLE_DESC_DIAS = 2; // regalo de cumpleaños: 15% el dia y los 2 siguientes (default de Claude, confirmar con Ivo)
const CUENTA_DESC_PCT = 10, RESENA_DESC_PCT = 5; // premio por tener cuenta con Google (10%) + reseña dejada (5%) -- decidido con Ivo, 27/09/2026: se SUMAN entre si (unico caso hoy), y esa suma compite contra el resto de las promos como una mas (gana la mas alta), igual que ya hace el descuento por efectivo.
const SERVICIOS_DEFAULT = [{id:'s1',nombre:'Corte',precio:18000,rubro:'barberia'},{id:'s2',nombre:'Corte + Barba',precio:20000,rubro:'barberia'}];
let servicios = [...SERVICIOS_DEFAULT]; // {id, nombre, precio}
let ofertas = [];                       // {id, nombre, pct, servicioIds:[] (vacío = todos), activa}

function loadServicios(){
  try{ const s=JSON.parse(localStorage.getItem('luffy_servicios')||'null'); if(s) servicios=s; }catch(e){}
  if(DB){
    DB.doc('luffy/servicios').get().then(r=>{
      if(r&&r.list&&JSON.stringify(r.list)!==JSON.stringify(servicios)){ servicios=r.list; try{localStorage.setItem('luffy_servicios',JSON.stringify(servicios));}catch(e){} refreshCurrentView(); }
    }).catch(()=>{});
  }
}
function saveServicios(){
  try{localStorage.setItem('luffy_servicios',JSON.stringify(servicios));}catch(e){}
  if(DB){try{DB.doc('luffy/servicios').set({list:servicios});}catch(e){}}
}
function loadOfertas(){
  try{ ofertas=JSON.parse(localStorage.getItem('luffy_ofertas')||'[]'); }catch(e){ ofertas=[]; }
  if(DB){
    DB.doc('luffy/ofertas').get().then(r=>{
      if(r&&r.list&&JSON.stringify(r.list)!==JSON.stringify(ofertas)){ ofertas=r.list; try{localStorage.setItem('luffy_ofertas',JSON.stringify(ofertas));}catch(e){} refreshCurrentView(); }
    }).catch(()=>{});
  }
}
function saveOfertas(){
  try{localStorage.setItem('luffy_ofertas',JSON.stringify(ofertas));}catch(e){}
  if(DB){try{DB.doc('luffy/ofertas').set({list:ofertas});}catch(e){}}
}

// ============ RUBROS Y COMBOS ============
// Rubro = sector del negocio (Barberia, Peluqueria...). Cada profesional tiene asignados los suyos
// (u.rubros) y solo ve los servicios, combos y ofertas de esos rubros. Sin rubros asignados ve todo.
const RUBROS_DEFAULT=[{id:'barberia',nombre:'Barbería'},{id:'barberia-premium',nombre:'Barbería de Autor'},{id:'peluqueria',nombre:'Peluquería'},{id:'cosmetologia',nombre:'Cosmetología'},{id:'cejas',nombre:'Cejas y Pestañas'},{id:'podologia',nombre:'Podología'},{id:'masajes',nombre:'Masajes'},{id:'manos',nombre:'Manos'}];
let rubros=JSON.parse(JSON.stringify(RUBROS_DEFAULT));
let combos=[]; // {id, nombre, rubro, servicioIds:[..], precio}
function loadRubros(){
  try{ const r=JSON.parse(localStorage.getItem('luffy_rubros')||'null'); if(r&&r.length) rubros=r; }catch(e){}
  if(DB){
    DB.doc('luffy/rubros').get().then(r=>{
      if(r&&r.list&&r.list.length&&JSON.stringify(r.list)!==JSON.stringify(rubros)){ rubros=r.list; try{localStorage.setItem('luffy_rubros',JSON.stringify(rubros));}catch(e){} refreshCurrentView(); }
    }).catch(()=>{});
  }
}
function saveRubros(){
  try{localStorage.setItem('luffy_rubros',JSON.stringify(rubros));}catch(e){}
  if(DB){try{DB.doc('luffy/rubros').set({list:rubros});}catch(e){}}
}
function loadCombos(){
  try{ combos=JSON.parse(localStorage.getItem('luffy_combos')||'[]'); }catch(e){ combos=[]; }
  if(DB){
    DB.doc('luffy/combos').get().then(r=>{
      if(r&&r.list&&JSON.stringify(r.list)!==JSON.stringify(combos)){ combos=r.list; try{localStorage.setItem('luffy_combos',JSON.stringify(combos));}catch(e){} refreshCurrentView(); }
    }).catch(()=>{});
  }
}
function saveCombos(){
  try{localStorage.setItem('luffy_combos',JSON.stringify(combos));}catch(e){}
  if(DB){try{DB.doc('luffy/combos').set({list:combos});}catch(e){}}
}
function nombreRubro(id){ return (rubros.find(r=>r.id===id)||{}).nombre||''; }
function rubrosDeUsuario(u){ return (u&&Array.isArray(u.rubros)&&u.rubros.length)?u.rubros:null; }
// Combo con "valido hasta" (combos de campaña, ej. Dia de la Madre 2026): despues de esa fecha no se aplica en ningun lado
function comboVigente(c){ return !!c&&(!c.hasta||hoyStr()<=c.hasta); }
function visiblePorRubro(item,rb){ return !rb||!item.rubro||rb.includes(item.rubro); }
function serviciosVisibles(){ const rb=rubrosDeUsuario(profile); return servicios.filter(s=>visiblePorRubro(s,rb)); }
// Duracion para calcular huecos libres en la Agenda: la que cargó el admin en el servicio, o 45min por defecto en barbería
// (pedido de Ivo, 26/09/2026 — antes el default generico de 30 quedaba corto), 30 para el resto sin cargar.
function svcDuracion(sv){ return numV(sv&&sv.duracion)||((sv&&sv.rubro==='barberia')?45:30); }
// Duracion real de un conjunto de servicios elegidos juntos: si son justo los que forman un combo (Catalogo ->
// Combos y ofertas) y ese combo tiene su propia duracion cargada, se usa esa -- hacer varias cosas juntas suele
// llevar MENOS tiempo que la suma de cada una por separado (ej: corte+barba+lavado+toalla a vapor por separado
// suman mucho mas de lo que tarda un barbero haciendolo todo junto). Lo que no queda cubierto por ningun combo
// se sigue sumando servicio por servicio, como siempre.
function duracionServicios(ids){
  const usados=new Set(); let total=0;
  combos.filter(c=>comboVigente(c)&&c.servicioIds&&c.servicioIds.length>1&&numV(c.duracion)>0&&c.servicioIds.every(id=>ids.includes(id)))
    .sort((a,b)=>b.servicioIds.length-a.servicioIds.length)
    .forEach(c=>{
      if(c.servicioIds.some(id=>usados.has(id))) return;
      c.servicioIds.forEach(id=>usados.add(id));
      total+=numV(c.duracion);
    });
  ids.filter(id=>!usados.has(id)).forEach(id=>{ total+=svcDuracion(servicios.find(x=>x.id===id)); });
  return total;
}
function nomSvc(s){ return s.nombre+(s.opcion?' ('+s.opcion+')':''); }

// ============ TAREAS DE RECEPCION ============
const TAREAS_RECEPCION_DEFAULT = [
  // Apertura (turno mañana, 9:00 a 14:30)
  {id:'t1', emoji:'💻', label:'Prender la computadora y abrir la agenda', desde:'08:55', hasta:'10:30'},
  {id:'t2', emoji:'💡', label:'Prender luces, aire y música', desde:'08:55', hasta:'10:30'},
  {id:'t3', emoji:'💰', label:'Abrir la caja: contar el efectivo y anotar el saldo de la cuenta', desde:'08:55', hasta:'10:30'},
  {id:'t4', emoji:'🧹', label:'Ver que el salón esté limpio y ordenado (piso, espejos, sillones)', desde:'08:55', hasta:'10:30'},
  {id:'t5', emoji:'🚽', label:'Revisar que el baño esté limpio y con papel y jabón', desde:'08:55', hasta:'10:30'},
  {id:'t6', emoji:'📅', label:'Revisar la agenda del día y confirmar los primeros turnos', desde:'08:55', hasta:'10:30'},
  // Mañana
  {id:'t7', emoji:'📲', label:'Responder los mensajes pendientes de WhatsApp e Instagram', desde:'10:30', hasta:'12:30'},
  {id:'t8', emoji:'🔔', label:'Confirmar por WhatsApp los turnos de la tarde', desde:'10:30', hasta:'12:30'},
  {id:'t9', emoji:'🧴', label:'Revisar que los productos estén exhibidos y con precio', desde:'10:30', hasta:'12:30'},
  // Mediodía
  {id:'t10', emoji:'🔁', label:'Escribir a clientes que hace más de 30 días no vienen', desde:'12:30', hasta:'14:00'},
  {id:'t11', emoji:'🎂', label:'Revisar cumpleaños de la semana y mandar el saludo', desde:'12:30', hasta:'14:00'},
  {id:'t12', emoji:'🧾', label:'Registrar las ventas de productos de la mañana', desde:'12:30', hasta:'14:00'},
  // Cambio de turno
  {id:'t13', emoji:'🔒', label:'Cerrar la caja de la mañana (contar todo y dejarlo anotado)', desde:'14:00', hasta:'14:30'},
  {id:'t14', emoji:'🧾', label:'Cerrar todos los turnos de la mañana (preguntas de cierre)', desde:'14:00', hasta:'14:30'},
  // Turno tarde (14:30 a 20:30)
  {id:'t15', emoji:'💰', label:'Abrir la caja de la tarde con el saldo que dejó la mañana', desde:'14:30', hasta:'15:30'},
  {id:'t16', emoji:'📲', label:'Responder los mensajes pendientes', desde:'14:30', hasta:'17:30'},
  {id:'t17', emoji:'⭐', label:'Pedir reseña de Google a los clientes que se van conformes', desde:'15:30', hasta:'17:30'},
  {id:'t18', emoji:'🧹', label:'Repasar el salón: barrer pelos y ordenar los puestos', desde:'15:30', hasta:'17:30'},
  // Cierre
  {id:'t19', emoji:'📅', label:'Confirmar los turnos de mañana', desde:'17:30', hasta:'20:30'},
  {id:'t20', emoji:'🧾', label:'Cerrar todos los turnos del día (preguntas de cierre)', desde:'17:30', hasta:'20:30'},
  {id:'t21', emoji:'🧹', label:'Limpiar piso, vidrios y espejos', desde:'19:30', hasta:'20:30'},
  {id:'t22', emoji:'🚽', label:'Limpiar el baño', desde:'19:30', hasta:'20:30'},
  {id:'t23', emoji:'💰', label:'Cerrar la caja del día: contar efectivo y cuenta', desde:'19:45', hasta:'20:30'},
  {id:'t24', emoji:'🔌', label:'Apagar luces, aire, equipos y computadora', desde:'19:45', hasta:'20:30'},
  {id:'t25', emoji:'🔒', label:'Cerrar el local con llave y alarma', desde:'19:45', hasta:'20:30'},
  // Agregadas el 2/10/2026 con la lista real que mandó el equipo (ver operacion/tareas-equipo-2026-10-02.md) —
  // comparadas contra las de arriba para no duplicar (ej. limpieza de baño/piso/sillones/espejo y WhatsApp sin
  // pendientes ya estaban cubiertas). "Respetar horarios de ingreso y egreso" no se sumó como tarea: es una
  // expectativa de conducta, no algo que se tilde una vez — queda pendiente de hablarlo aparte.
  {id:'t26', emoji:'🖥️', label:'Dejar el escritorio despejado y limpio', desde:'19:30', hasta:'20:30'},
  {id:'t27', emoji:'☕', label:'Dejar la cafetera limpia y los elementos de servir (tazas, vasos) en orden', desde:'08:55', hasta:'10:30'},
  {id:'t28', emoji:'🍵', label:'Controlar que haya insumos de infusiones (café, té, azúcar, etc.)', desde:'10:30', hasta:'12:30'},
  {id:'t29', emoji:'📅', label:'Estar atenta a la agenda de las dos sucursales durante el día', desde:'10:30', hasta:'12:30'},
  {id:'t30', emoji:'🧺', label:'Revisar que no queden toallas sucias en la bacha', desde:'15:30', hasta:'17:30'},
  {id:'t31', emoji:'📦', label:'Controlar el stock de productos (no solo que estén exhibidos)', desde:'12:30', hasta:'14:00'},
  {id:'t32', emoji:'🗑️', label:'Vaciar todos los cestos de basura', desde:'19:30', hasta:'20:30'},
  {id:'t33', emoji:'🧻', label:'Reponer papel, jabón y demás insumos del baño', desde:'08:55', hasta:'10:30'},
  {id:'t34', emoji:'🪑', label:'Dejar las sillas en los puestos antes de que entren los profesionales de estética (turno mañana)', desde:'08:45', hasta:'09:00'},
  {id:'t35', emoji:'🪑', label:'Dejar las sillas en los puestos antes de que entren los profesionales de estética (turno tarde)', desde:'14:15', hasta:'14:30'},
];
let tareasRecepcion = [...TAREAS_RECEPCION_DEFAULT]; // admin-editable
let tareasData = {}; // {[fecha]: {[tareaId]: {done, ts}}}

// Checklist de supervisión del encargado (un profesional designado por el admin, flag esEncargado) — pedido de
// Ivo, confirmado el 2/10/2026. Mismo mecanismo que tareasRecepcion (lista admin-editable, se tilda y queda
// registrado), pero sin ventana horaria: son tareas de "estar atento durante el día", no de un momento puntual.
// Reusa el mismo tareasData/toggleTarea/hechaTarea que recepción -- los ids 'eX' no chocan con los 'tX'.
const TAREAS_ENCARGADO_DEFAULT = [
  {id:'e1', emoji:'⏰', label:'Controlar que lleguen a horario'},
  {id:'e2', emoji:'🤝', label:'Supervisar que se cumplan los estándares de atención al cliente'},
  {id:'e3', emoji:'✂️', label:'Observar la calidad de los cortes y detectar cosas para mejorar'},
  {id:'e4', emoji:'🧹', label:'Controlar la limpieza de los puestos'},
  {id:'e5', emoji:'🚽', label:'Supervisar baños, espejos, sillones, etc.'},
  {id:'e6', emoji:'🔧', label:'Informar problemas en el equipo'},
  {id:'e7', emoji:'📣', label:'Informar reclamos de clientes'},
  {id:'e8', emoji:'⚠️', label:'Informar incumplimientos de horarios y normas'},
];
let tareasEncargado = [...TAREAS_ENCARGADO_DEFAULT]; // admin-editable
function loadTareasEncargado(){
  try{ const t=JSON.parse(localStorage.getItem('luffy_tareas_encargado')||'null'); if(t&&t.length) tareasEncargado=t; }catch(e){}
  if(DB){
    DB.doc('luffy/tareas_encargado').get().then(r=>{
      if(r&&r.list&&r.list.length&&JSON.stringify(r.list)!==JSON.stringify(tareasEncargado)){ tareasEncargado=r.list; try{localStorage.setItem('luffy_tareas_encargado',JSON.stringify(tareasEncargado));}catch(e){} refreshCurrentView(); }
    }).catch(()=>{});
  }
}
function saveTareasEncargado(){
  try{localStorage.setItem('luffy_tareas_encargado',JSON.stringify(tareasEncargado));}catch(e){}
  if(DB){try{DB.doc('luffy/tareas_encargado').set({list:tareasEncargado});}catch(e){}}
}

function loadTareasRecepcion(){
  try{ const t=JSON.parse(localStorage.getItem('luffy_tareas_recepcion')||'null'); if(t&&t.length&&t.every(x=>x.desde)) tareasRecepcion=t; }catch(e){}
  if(DB){
    DB.doc('luffy/tareas_recepcion').get().then(r=>{
      if(r&&r.list&&r.list.length&&r.list.every(x=>x.desde)&&JSON.stringify(r.list)!==JSON.stringify(tareasRecepcion)){ tareasRecepcion=r.list; try{localStorage.setItem('luffy_tareas_recepcion',JSON.stringify(tareasRecepcion));}catch(e){} refreshCurrentView(); }
    }).catch(()=>{});
  }
}
function saveTareasRecepcion(){
  try{localStorage.setItem('luffy_tareas_recepcion',JSON.stringify(tareasRecepcion));}catch(e){}
  if(DB){try{DB.doc('luffy/tareas_recepcion').set({list:tareasRecepcion});}catch(e){}}
}
function loadTareasData(){
  try{tareasData=JSON.parse(localStorage.getItem('luffy_tareas_data')||'{}');}catch(e){tareasData={};}
  if(DB){
    DB.doc('luffy/tareas_data').get().then(r=>{
      if(r&&mergeTs(tareasData,r)){ try{localStorage.setItem('luffy_tareas_data',JSON.stringify(tareasData));}catch(e){} refreshCurrentView(); }
    }).catch(()=>{});
  }
}
function saveTareasData(){ guardarUniendoTs('luffy/tareas_data','luffy_tareas_data',tareasData); }

// ============ TAREAS DEL EQUIPO ============
// Distinto de tareasRecepcion (esas son la agenda del día por horario, solo para quien está en el mostrador).
// Esto es para tareas rotativas entre personas de cualquier rol (ej: "Limpiar el baño"), donde importa quién
// la hizo y que no le toque siempre a la misma persona.
let tareasEquipoCfg=[]; // {id, emoji, label, equipo:[userId,...]}
let tareasEquipoLog={}; // {[tareaId]: {[fecha]: {userId, userName, nota, ts}}}
function loadTareasEquipo(){
  try{ const t=JSON.parse(localStorage.getItem('luffy_tareas_equipo')||'null'); if(t) tareasEquipoCfg=t; }catch(e){}
  if(DB){
    DB.doc('luffy/tareas_equipo').get().then(r=>{
      if(r&&r.list&&JSON.stringify(r.list)!==JSON.stringify(tareasEquipoCfg)){ tareasEquipoCfg=r.list; try{localStorage.setItem('luffy_tareas_equipo',JSON.stringify(tareasEquipoCfg));}catch(e){} refreshCurrentView(); }
    }).catch(()=>{});
  }
  try{ tareasEquipoLog=JSON.parse(localStorage.getItem('luffy_tareas_equipo_log')||'{}'); }catch(e){ tareasEquipoLog={}; }
  if(DB){
    DB.doc('luffy/tareas_equipo_log').get().then(r=>{
      if(r&&mergeTs(tareasEquipoLog,r)){ try{localStorage.setItem('luffy_tareas_equipo_log',JSON.stringify(tareasEquipoLog));}catch(e){} refreshCurrentView(); }
    }).catch(()=>{});
  }
}
function saveTareasEquipoCfg(){
  try{localStorage.setItem('luffy_tareas_equipo',JSON.stringify(tareasEquipoCfg));}catch(e){}
  if(DB){try{DB.doc('luffy/tareas_equipo').set({list:tareasEquipoCfg});}catch(e){}}
}
function saveTareasEquipoLog(){ guardarUniendoTs('luffy/tareas_equipo_log','luffy_tareas_equipo_log',tareasEquipoLog); }

const TRAMOS = [
  {min:0,       max:999999,   pct:45, label:'Base',  color:'#888896', emoji:'🌱'},
  {min:1000000, max:1199999,  pct:50, label:'Bronce', color:'#fb923c', emoji:'🥉'},
  {min:1200000, max:Infinity, pct:55, label:'Plata',  color:'#9090b0', emoji:'🥈'},
];
const TRAMO_ORO = {pct:60, label:'Oro', color:'#fbbf24', emoji:'🥇'};

// Stories
const STORY_TIPOS = [
  {id:'buenos_dias',  emoji:'🌅', label:'Buenos días',    ref:'Mostrá que arrancaste el día'},
  {id:'turnos_libres',emoji:'📅', label:'Turnos libres',  ref:'Foto del local o agenda con horarios'},
  {id:'resultado',    emoji:'✂️', label:'Resultado',       ref:'Foto del trabajo realizado'},
  {id:'cierre',       emoji:'🌙', label:'Cierre del día', ref:'Foto tuya o del local al cerrar'},
];
const STORY_TEXTOS = {
  buenos_dias:   'Arrancamos el día ✂️ Ya estamos en el salón listos para atenderte. Reservá tu turno por DM 👇',
  turnos_libres: 'Turnos disponibles para hoy:\n⏰ [HORA 1]\n⏰ [HORA 2]\n⏰ [HORA 3]\nEscribime y te reservo 🙌',
  resultado:     '¿Les gusta el resultado? ✨ Este es el trabajo de hoy. Si querés algo así, reservá tu turno por DM 💈',
  cierre:        'Cerramos el día por hoy 🙏 ¡Gracias a todos los que pasaron! Si querés reservar para mañana, escribime ahora 📩',
};

// Points
const PUNTOS_CONFIG = [
  {id:'story',      label:'Story subida',          pts:5,   emoji:'📱', auto:true},
  {id:'story_week', label:'Semana completa stories',pts:25,  emoji:'🗓', auto:true},
  {id:'reel',       label:'Reel publicado',         pts:50,  emoji:'🎬', auto:true},
  {id:'tramo_oro',  label:'Tramo Oro en quincena',  pts:150, emoji:'🥇', auto:true},
  {id:'cliente',    label:'Cliente nuevo traído',   pts:30,  emoji:'👤', auto:false},
  {id:'quincena',   label:'Quincena sin faltas',    pts:40,  emoji:'⭐', auto:false},
  {id:'reagendamiento', label:'Cliente reagendó (cierre de turno)', pts:30, emoji:'🔁', auto:true},
  {id:'resena',     label:'Reseña en Google (cierre de turno)', pts:5, emoji:'⭐', auto:true},
  {id:'cumple',     label:'Cumpleaños contactado', pts:20, emoji:'🎂', auto:true},
];
const CANJES_DEFAULT = [
  {id:'efectivo',   emoji:'💵', label:'$5.000 en efectivo',  pts:200},
  {id:'libre',      emoji:'🏖️', label:'Día libre',           pts:300},
  {id:'maquinas',   emoji:'✂️', label:'Hora en máquinas',    pts:100},
  {id:'capacitacion',emoji:'🎓',label:'Capacitación',        pts:250},
];

let storiesData = {};
let puntosData = {}; // {[profId]: {total, movimientos:[{fecha,tipo,pts,razon,ts}]}}
let canjesData = []; // canjes disponibles (admin puede editar)
let canjesSolicitudes = []; // solicitudes pendientes

