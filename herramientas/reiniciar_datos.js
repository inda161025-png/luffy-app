// Deja las cuentas en cero: cobros, deudas, dinero personal, puntos, historias, tareas, cierres, avisos,
// incidentes, banco de reels, stock y contadores de recepcion. NO toca: usuarios, catalogo (servicios,
// combos, ofertas, rubros), productos (solo el stock pasa a 0), reglas, canjes disponibles, cumpleaños ni el perfil de contenido.
// Se puede volver a correr cuando se quiera (por ejemplo la noche antes del lanzamiento).
const fs=require('fs');
const html=fs.readFileSync(require('path').join(__dirname,'..','index.html'),'utf8');
const BASE=/https:\/\/[a-z0-9]+\.supabase\.co/.exec(html)[0];
const KEY=/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/.exec(html)[0];
let H={apikey:KEY,Authorization:'Bearer '+KEY,'Content-Type':'application/json'};
// Uso:  node herramientas/reiniciar_datos.js [--dry]
// Con la base bloqueada (paso 2 de seguridad) hay que entrar como admin:  ADMIN_USER=usuario ADMIN_PASS=clave node herramientas/reiniciar_datos.js
async function entrarAdmin(){
  if(!process.env.ADMIN_USER) return;
  const r=await fetch(BASE+'/auth/v1/token?grant_type=password',{method:'POST',headers:{apikey:KEY,'Content-Type':'application/json'},body:JSON.stringify({email:process.env.ADMIN_USER+'@inda-luffy.app',password:'inda-luffy:'+process.env.ADMIN_PASS})});
  const j=await r.json(); if(!r.ok) throw new Error('No se pudo entrar como admin'); H={...H,Authorization:'Bearer '+j.access_token};
}
const DRY=process.argv.includes('--dry');
async function todo(){ const r=await fetch(BASE+'/rest/v1/luffy_data?select=key,value&order=key',{headers:H}); return r.json(); }
async function put(key,value){
  if(DRY){ console.log('  (simulacro) '+key); return; }
  const r=await fetch(BASE+'/rest/v1/luffy_data?on_conflict=key',{method:'POST',headers:{...H,Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify({key,value,updated_at:new Date().toISOString()})});
  if(!r.ok) throw new Error(key+' -> '+r.status+' '+await r.text());
  console.log('  reiniciado '+key);
}
(async()=>{
  await entrarAdmin();
  const docs=await todo(); const cambios=[];
  for(const d of docs){
    const k=d.key, v=d.value||{};
    if(k.startsWith('luffy/dinero_')) cambios.push([k,{turnos:[],ventas:[],deudores:[]}]);
    else if(k.startsWith('luffy/yo_')) cambios.push([k,{ingresos:[],gastos:[],deudas:[]}]);
    else if(k.startsWith('luffy/rec_')) cambios.push([k,{...v,reagendamientos:0,incidentes:[]}]);
    else if(k.startsWith('luffy/clientes_')) cambios.push([k,{list:[]}]);
    else if(k==='luffy/puntos') cambios.push([k,{...v,puntos:{},solicitudes:[]}]);
    else if(k==='luffy/stories'||k==='luffy/tareas_data') cambios.push([k,{}]);
    else if(k==='luffy/cierres_cobro') cambios.push([k,{byKey:{}}]);
    else if(k==='luffy/avisos_leidos'||k==='luffy/incidentes') cambios.push([k,{list:[]}]);
    else if(k==='luffy/reels') cambios.push([k,{list:[],deleted:[...new Set([...(v.deleted||[]),...(v.list||[]).map(r=>r.id)])]}]);
    else if(k==='luffy/productos') cambios.push([k,{...v,list:(v.list||[]).map(p=>({...p,stock:0}))}]);
    else if(k.startsWith('luffy/perfil_')&&'password' in v){ const {password,...limpio}=v; cambios.push([k,limpio]); }
  }
  if(docs.some(d=>d.key==='luffy/contador_clientes')) cambios.push(['luffy/contador_clientes',{n:0}]);
  cambios.push(['luffy/epoca',{n:String(Date.now()),fecha:new Date().toISOString()}]);
  console.log((DRY?'SIMULACRO: ':'')+cambios.length+' documentos');
  for(const [k,v] of cambios) await put(k,v);
  console.log('listo');
})().catch(e=>{ console.error('ERROR',e.message); process.exit(1); });
