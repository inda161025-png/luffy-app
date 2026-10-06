// ============ MOTOR DE DESCUENTOS ============
// Una regla puede valer para varios rubros: 'barberia,barberia-premium' (vacio = todos)
function rubroEn(lista,rubro){ return !lista||String(lista).split(',').map(s=>s.trim()).includes(rubro); }
function rubrosNombres(lista){ return lista?String(lista).split(',').map(s=>nombreRubro(s.trim())||s.trim()).join(' / '):'Todos los rubros'; }
function rubroDeLinea(l){
  if(l.tipo==='combo'){ const cb=combos.find(x=>x.id===l.id); return (cb&&cb.rubro)||''; }
  const s=servicios.find(x=>x.id===l.id); return (s&&s.rubro)||'';
}
function ctxCobro(cli){
  const n=new Date(); const hh=/^\d{1,2}:\d{2}$/.test(cobro.hora||'')?cobro.hora.padStart(5,'0'):String(n.getHours()).padStart(2,'0')+':'+String(n.getMinutes()).padStart(2,'0');
  return {dia:n.getDay(), hora:hh, sucursal:sucursalActual(), cliente:cli, fecha:hoyStr()};
}
function reglaAplica(r,ctx){
  if(r.activo===false) return false;
  if(r.dias&&r.dias.length&&!r.dias.includes(ctx.dia)) return false;
  if(r.horaDesde&&ctx.hora<r.horaDesde) return false;
  if(r.horaHasta&&!(ctx.hora<r.horaHasta)) return false;
  if(r.sucursales&&r.sucursales.length&&!r.sucursales.includes(ctx.sucursal)) return false;
  if(r.profesion&&!(ctx.cliente&&nkey(ctx.cliente.profesion)===nkey(r.profesion))) return false;
  // Ofertas exclusivas para clientes logueados (creador de ofertas, 27/09/2026): solo aplican si el
  // cliente tiene cuenta con Google (authUid) -- nadie mas las ve ni las cobra, ni en el mostrador ni en /#reserva.
  if(r.soloCuenta&&!(ctx.cliente&&ctx.cliente.authUid)) return false;
  // Vigencia y cupo de las ofertas armadas con el "Creador de ofertas" (26/09/2026) — opcionales, no afectan a las reglas viejas que no los tienen.
  if(ctx.fecha){ if(r.fechaDesde&&ctx.fecha<r.fechaDesde) return false; if(r.fechaHasta&&ctx.fecha>r.fechaHasta) return false; }
  if(r.cupo!=null&&numV(r.usos)>=numV(r.cupo)) return false;
  return true;
}
const unidadTarj=(t)=>/barberia/.test(String((t&&t.rubro)||''))?'corte':'servicio';
// Un cliente puede tener varias tarjetas activas (una por rubro, ej: barberia + la de Dai en peluqueria).
// mejorTarjetaCliente elige la que corresponde segun el/los rubro(s) que se estan cobrando.
function mejorTarjetaCliente(cli,rubros){
  const L=(cli&&cli.tarjetas)||[]; if(!L.length) return null;
  const rs=rubros==null?null:(Array.isArray(rubros)?rubros:[rubros]);
  if(!rs||!rs.length) return L[0];
  return L.find(t=>t.snap&&rs.some(rb=>rubroEn(t.snap.rubro,rb)))||L[0];
}
function infoDeTarjeta(t){
  if(!t||!t.snap) return null;
  const sn=t.snap, ciclo=Math.max(1,...(sn.visitas||[]).map(s=>s.n));
  const k=(numV(t.visitas)%ciclo)+1;
  const paso=(sn.visitas||[]).find(s=>s.n===k);
  const cupones=(t.cupones||[]).filter(c=>!c.usado&&numV(c.pct)>0.01);
  const pr=sn.premio;
  const regalo=!!pr&&t.regalo!=='usado'&&(t.refs||[]).length>=numV(pr.refs)&&numV(t.visitas)>=numV(pr.visitas);
  return {cardId:t.cardId,rubro:sn.rubro,k,ciclo,pctFid:paso?paso.pct:0,pasoSvcs:(paso&&paso.servicioIds)||null,pasoLabel:(paso&&paso.label)||'',cupones,pctRef:cupones.reduce((a,c)=>a+numV(c.pct),0),regalo};
}
function infoTarjeta(cli,rubros){ return infoDeTarjeta(mejorTarjetaCliente(cli,rubros)); }
// UN SOLO DESCUENTO por cobro: el MAS ALTO de los que aplican (promo fija por horario o profesion, oferta, efectivo,
// fidelidad, cupon de referidos o corte de regalo). Nunca se suman entre si.
// Los cupones de referidos que no se usan quedan guardados para otra visita.
// Los productos van siempre a precio de lista. Lo ya pagado (membresia / paquete) no lleva descuento.
function calcCobro(){
  const lineas=lineasCobro();
  const subtotal=lineas.reduce((a,l)=>a+l.precio,0);
  const ahorroCombo=lineas.filter(l=>l.tipo==='combo').reduce((a,l)=>a+(l.lista-l.precio),0);
  const cli=clienteDe(cobro.clienteId);
  const ctx=ctxCobro(cli);
  const nocheC=nocheCfg(), esNoche=ctx.hora>=String(nocheC.desde).padStart(5,'0'); // de noche: precio de lista, sin ningun descuento
  const cubiertas=new Set(), prepagos=[];
  (cobro.prepagos||[]).forEach(p=>{
    const l=lineas.find(x=>x.tipo==='servicio'&&x.id===p.svcId&&!cubiertas.has(x.id));
    if(l){ cubiertas.add(l.id); prepagos.push({...p,linea:l}); }
  });
  const normales=lineas.filter(l=>!(l.tipo==='servicio'&&cubiertas.has(l.id)));
  // Barberia de Autor no entra en promos, cupones ni ofertas: siempre precio de lista (decidido por Ivo, 3/10/2026). Solo el 10% por efectivo le aplica.
  const normalesPromo=normales.filter(l=>rubroDeLinea(l)!=='barberia-premium'), subPromo=normalesPromo.reduce((a,l)=>a+l.precio,0);
  const subNormal=normales.reduce((a,l)=>a+l.precio,0);
  const prepTotal=prepagos.reduce((a,p)=>a+p.credito,0);
  const base=(rubro)=>normalesPromo.filter(l=>rubroEn(rubro,rubroDeLinea(l))).reduce((a,l)=>a+l.precio,0);
  const D=[];
  const oferta=ofertasVisibles().find(o=>o.id===cobro.ofertaId)||null;
  let fijo=null, ofertaSinEfecto=false;
  const tarjUso={cupones:[],fidSobra:0};
  const tarjCard=mejorTarjetaCliente(cli,normales.map(rubroDeLinea));
  const tarj=infoDeTarjeta(tarjCard);
  // Tope de fidelidad acumulada sin usar (decidido con Ivo, 29/09/2026): si el escalon de fidelidad de hoy
  // pierde contra un descuento mas grande, no se pierde -- se guarda como cupon aparte, hasta un 30% total
  // acumulado por tarjeta (ver mas abajo, donde se calcula tarjUso.fidSobra).
  const TOPE_FID_ACUMULADA=30;
  // Promo fija: puede valer solo para ciertos servicios y sumar un adicional segun la profesion del cliente (ej: fuerzas +15%). Gana la que mas descuenta.
  const baseF=(f)=>normalesPromo.filter(l=>rubroEn(f.rubro,rubroDeLinea(l))&&(!(f.servicioIds&&f.servicioIds.length)||l.ids.some(id=>f.servicioIds.includes(id)))).reduce((a,l)=>a+l.precio,0);
  const extraFijo=(f)=>!!(f.extra&&f.extra.profesion&&cli&&nkey(cli.profesion)===nkey(f.extra.profesion));
  const pctFijo=(f)=>numV(f.pct)+(extraFijo(f)?numV(f.extra.pct):0);
  (promos.fijos||[]).filter(f=>reglaAplica(f,ctx)).forEach(f=>{ const b=baseF(f); if(b<=0) return; const m=Math.round(b*pctFijo(f)/100); if(!fijo||m>fijo._m) fijo={...f,_m:m}; });
  const bT=tarj?base(tarj.rubro):0;
  // candidatos (en este orden se desempata: el primero gana si hay igualdad)
  const cand=[];
  if(tarj&&tarj.regalo&&bT>0) cand.push({tipo:'regalo',label:'Corte de regalo (tarjeta completa)',pct:100,monto:bT});
  if(fijo) cand.push({tipo:'fijo',label:fijo.nombre+(extraFijo(fijo)?' + '+fijo.extra.profesion+' '+numV(fijo.extra.pct)+'%':''),pct:pctFijo(fijo),monto:fijo._m});
  const baseOferta=oferta?normalesPromo.filter(l=>ofertaAplicaA(oferta,l.ids)).reduce((a,l)=>a+l.precio,0):0;
  const descOferta=oferta?Math.round(baseOferta*oferta.pct/100):0;
  ofertaSinEfecto=!!oferta&&descOferta===0&&!esNoche;
  if(descOferta>0) cand.push({tipo:'oferta',label:'Oferta '+oferta.nombre,pct:oferta.pct,monto:descOferta});
  if(tarj&&tarj.pctFid>0){
    // el escalon puede ser sobre un servicio concreto (ej: la hidratacion gratis); si no, sobre todo el rubro de la tarjeta
    const bF=(tarj.pasoSvcs&&tarj.pasoSvcs.length)?normalesPromo.filter(l=>rubroEn(tarj.rubro,rubroDeLinea(l))&&l.ids.some(id=>tarj.pasoSvcs.includes(id))).reduce((a,l)=>a+l.precio,0):bT;
    if(bF>0) cand.push({tipo:'fidelidad',label:tarj.pasoLabel?tarj.pasoLabel+' · visita n°'+tarj.k:'Fidelidad · visita n°'+tarj.k,pct:tarj.pctFid,monto:Math.round(bF*tarj.pctFid/100)});
  }
  let mejorCupon=null;
  if(tarj&&bT>0){ mejorCupon=tarj.cupones.slice().sort((a,b)=>numV(b.pct)-numV(a.pct))[0]||null; if(mejorCupon) cand.push({tipo:'referidos',label:mejorCupon.de==='fidelidad'?'Fidelidad acumulada':'Referidos',pct:numV(mejorCupon.pct),monto:Math.round(bT*numV(mejorCupon.pct)/100)}); }
  const descEfectivo=cobro.medio==='efectivo'?Math.round(subNormal*DESC_EFECTIVO_PCT/100):0;
  if(descEfectivo>0) cand.push({tipo:'efectivo',label:'Pago en efectivo',pct:DESC_EFECTIVO_PCT,monto:descEfectivo});
  // Cuenta con Google (10%) + reseña dejada (5%): unico caso que se SUMA antes de competir (decidido con Ivo,
  // 27/09/2026) -- sin grupo asignado, asi que compite libre contra todo el resto como una mas (igual que efectivo).
  const pctCuenta=(cli&&cli.authUid)?CUENTA_DESC_PCT:0, pctResena=(cli&&cli.resenaGoogle)?RESENA_DESC_PCT:0, pctCuentaTotal=pctCuenta+pctResena;
  if(pctCuentaTotal>0&&subPromo>0){
    const partes=[pctCuenta?'cuenta':null,pctResena?'reseña':null].filter(Boolean).join(' + ');
    cand.push({tipo:'cuenta',label:'⭐ '+partes.charAt(0).toUpperCase()+partes.slice(1),pct:pctCuentaTotal,monto:Math.round(subPromo*pctCuentaTotal/100)});
  }
  // Descuento de cumpleaños: el dia y los 2 siguientes (mismo "valido por 3 dias" que se usa en el resto de la app)
  const diasCumple=cli?diasDesdeCumple(cli.cumple):null;
  if(diasCumple!=null&&diasCumple>=0&&diasCumple<=CUMPLE_DESC_DIAS&&subPromo>0) cand.push({tipo:'cumple',label:'🎂 Cumpleaños',pct:CUMPLE_DESC_PCT,monto:Math.round(subPromo*CUMPLE_DESC_PCT/100)});
  // Tarjeta vs. descuento del dia: si los dos aplican y dan plata, el profesional elige cual usar (capaz le conviene mas el del dia).
  // Si solo aplica uno de los dos (o ninguno), sigue siendo automatico como antes.
  const GRUPO_DESC={regalo:'tarjeta',fidelidad:'tarjeta',referidos:'tarjeta',fijo:'dia',oferta:'dia',cumple:'dia'};
  cand.forEach(c=>{ c.grupo=GRUPO_DESC[c.tipo]||null; });
  const mejorDe=(g)=>cand.filter(c=>c.grupo===g&&c.monto>0).sort((a,b)=>b.monto-a.monto)[0]||null;
  const opcTarjeta=mejorDe('tarjeta'), opcDia=mejorDe('dia');
  const necesitaElegirDesc=!!(opcTarjeta&&opcDia);
  const candElegibles=(necesitaElegirDesc&&cobro.descGrupo)?cand.filter(c=>!c.grupo||c.grupo===cobro.descGrupo):cand;
  let ganador=null; if(!esNoche) candElegibles.forEach(c=>{ if(c.monto>0&&(!ganador||c.monto>ganador.monto)) ganador=c; });
  if(ganador){ D.push(ganador); if(ganador.tipo==='referidos'&&mejorCupon) tarjUso.cupones.push({id:mejorCupon.id,pct:numV(mejorCupon.pct)}); }
  // El escalon de fidelidad de hoy perdio contra un descuento mas grande: en vez de perderse, se banca como
  // cupon aparte (mismo mecanismo que los cupones de referidos), topeado para que no se acumule sin limite.
  if(tarj&&tarj.pctFid>0&&(!ganador||ganador.tipo!=='fidelidad')){
    const fidCand=cand.find(c=>c.tipo==='fidelidad');
    if(fidCand&&fidCand.monto>0){
      const yaBancado=((tarjCard&&tarjCard.cupones)||[]).filter(c=>!c.usado&&c.de==='fidelidad').reduce((a,c)=>a+numV(c.pct),0);
      tarjUso.fidSobra=Math.max(0,Math.min(tarj.pctFid,TOPE_FID_ACUMULADA-yaBancado));
    }
  }
  const topeAlcanzado=false, tope=null;
  const descuento=Math.min(subNormal,D.reduce((a,d)=>a+d.monto,0));
  const descPct=subNormal>0?descuento/subNormal*100:0;
  const descTipo=D.length>1?'mixto':(D[0]?D[0].tipo:null);
  const montoNormal=subNormal-descuento;
  const sn=calcSenasCobro(montoNormal); // seña ya dejada: se descuenta de lo que paga hoy (la comision del profesional no cambia)
  // Comision con descuentos altos: mas de t1% -> p1% de lo que pago el cliente; t2% o mas -> p2% (nunca menos que sobre la mitad del precio)
  const cm=promos.comision||PROMOS_DEFAULT.comision;
  // comFija/comFijaBase acumulan TODO lo que tiene comision fija en este turno: el propio cobro (noche o descuento alto)
  // y, aparte, cada servicio redimido de un paquete cuyo descuento combinado (individual + paquete) ya era alto por si solo.
  let comFija=null, comFijaBase=0, paqueteCredito=0, paqueteComFija=0;
  const addFija=(monto,pct)=>{ if(monto<=0) return; comFija=(comFija||0)+Math.round(monto*pct/100); comFijaBase+=monto; };
  if(esNoche&&subNormal>0) addFija(montoNormal,numV(nocheC.pct)); // turno de noche: comision fija, no importa nada mas
  else if(subNormal>0&&descPct>=cm.t2) addFija(Math.max(montoNormal,subNormal*0.5),cm.p2);
  else if(subNormal>0&&descPct>cm.t1) addFija(montoNormal,cm.p1);
  prepagos.forEach(p=>{
    if(p.kind!=='paq') return;
    paqueteCredito+=numV(p.credito);
    if(p.descPct==null) return;
    if(p.descPct>=cm.t2){ addFija(p.credito,cm.p2); paqueteComFija+=Math.round(numV(p.credito)*cm.p2/100); }
    else if(p.descPct>cm.t1){ addFija(p.credito,cm.p1); paqueteComFija+=Math.round(numV(p.credito)*cm.p1/100); }
  });
  const servicioNeto=montoNormal+prepTotal;
  const lineaProd=(p,cantidad)=>{ const total=p.precioVenta*cantidad; return {producto:p, cantidad, total, comision:Math.round(total*(p.comisionPct||0)/100)}; };
  // prodLineas: lo que agrega AHORA quien está cobrando (va a su propia quincena). prodLineasProf: lo que el
  // profesional ya había cargado al registrar el turno (va a la quincena de ÉL, no de quien cobra). El cliente
  // paga la suma de ambos igual, solo cambia a quién se le atribuye cada producto. Ver cobro.prodsProf.
  const prodLineas=productos.filter(p=>(cobro.prods[p.id]||0)>0).map(p=>lineaProd(p,cobro.prods[p.id]));
  const prodLineasProf=productos.filter(p=>((cobro.prodsProf||{})[p.id]||0)>0).map(p=>lineaProd(p,cobro.prodsProf[p.id]));
  const prodTotal=prodLineas.reduce((a,l)=>a+l.total,0)+prodLineasProf.reduce((a,l)=>a+l.total,0);
  const prodComision=prodLineas.reduce((a,l)=>a+l.comision,0)+prodLineasProf.reduce((a,l)=>a+l.comision,0);
  return {svcs:lineas, lineas, subtotal, subNormal, ahorroCombo, oferta, ofertaSinEfecto, descuentos:D, descuento, descPct, descTipo, fijo, tarj, tarjUso, tope, topeAlcanzado, ctx, esNoche,
    necesitaElegirDesc, opcTarjeta, opcDia, descGrupoActivo:cobro.descGrupo||(ganador?ganador.grupo:null),
    servicioNeto, aCobrarServ:montoNormal-sn.total, senaTotal:sn.total, senasUso:sn.usos, prepagos, prepTotal, comFija, comFijaBase, paqueteCredito, paqueteComFija,
    prodLineas, prodLineasProf, prodTotal, prodComision, total:montoNormal-sn.total+prodTotal};
}
function lineaAReg(l){
  return {id:l.id, nombre:l.nombre, precio:l.precio, opcion:l.opcion||null, combo:l.tipo==='combo'?true:undefined, componentes:l.tipo==='combo'?l.componentes:undefined, lista:l.tipo==='combo'?l.lista:undefined};
}
// ---------- lo que se guarda en el turno / deuda ----------
function camposDescuento(r,cli){
  return {descDetalle:r.descuentos, descPct:Math.round(r.descPct*10)/10, comFija:r.comFija, comFijaBase:r.comFijaBase, aCobrar:r.aCobrarServ,
    prepago:r.prepTotal||0, prepagos:r.prepagos.map(p=>({kind:p.kind,refId:p.refId,itemId:p.itemId,nombre:p.nombre,credito:p.credito,descPct:p.descPct})),
    paqueteCredito:r.paqueteCredito||0, paqueteComFija:r.paqueteComFija||0,
    sena:r.senaTotal>0?{monto:r.senaTotal,ids:r.senasUso.map(x=>x.id)}:null, horaTurno:r.ctx.hora, noche:r.esNoche?true:undefined, fijoId:r.fijo?r.fijo.id:null, fidK:r.tarj?r.tarj.k:null, clienteProfesion:cli?cli.profesion:null};
}
// Despues de guardar el cobro: consume membresia/paquete, suma la visita a la tarjeta, cupones y premio de referidos
async function postCobroCliente(cli,r,turnoId,targetProfId){
  const profP=targetProfId?(allUsers.find(u=>u.id===targetProfId)||{id:targetProfId,name:''}):profile;
  for(const p of r.prepagos){
    if(p.kind==='memb') await membresiasSt.cambiar(l=>{ const m=l.find(x=>x.id===p.refId); if(m&&!m.usos.some(u=>u.turnoId===turnoId)){ m.usos.push({turnoId,fecha:hoyStr(),profId:profP.id,profNombre:profP.name,credito:p.credito}); m.upd=new Date().toISOString(); } });
    if(p.kind==='paq') await paquetesSt.cambiar(l=>{ const pk=l.find(x=>x.id===p.refId); const it=pk&&pk.items.find(i=>i.id===p.itemId); if(it&&!it.usado){ it.usado={turnoId,fecha:hoyStr(),profId:profP.id,profNombre:profP.name}; pk.upd=new Date().toISOString(); } });
  }
  if(!cli) return;
  // Si tenía un turno de hoy con este profesional todavía sin resolver, se marca "hecho" solo al cobrarle
  // (pedido de Ivo, 28/09/2026: verde automático, sin un paso de check-in aparte).
  await agMarcarHechoAutoPorCobro(cli.id,profP.id,hoyStr());
  const usoRegalo=r.descuentos.some(d=>d.tipo==='regalo');
  const usoCup=(r.tarjUso&&r.tarjUso.cupones)||[], fidSobra=(r.tarjUso&&r.tarjUso.fidSobra)||0;
  await cambiarClientes(list=>{
    const c=list.find(x=>x.id===cli.id); if(!c) return;
    const ahora=new Date().toISOString();
    const profFicha=targetProfId||(profile.role==='profesional'?profile.id:null);
    if(profFicha&&!(c.profs||[]).includes(profFicha)) c.profs=[...(c.profs||[]),profFicha];
    const ct=r.tarj&&(c.tarjetas||[]).find(x=>x.cardId===r.tarj.cardId);
    if(ct){
      ct.visitas=numV(ct.visitas)+1;
      usoCup.forEach(u=>{ const cu=(ct.cupones||[]).find(x=>x.id===u.id); if(cu){ cu.pct=Math.round((numV(cu.pct)-u.pct)*100)/100; if(cu.pct<=0.01) cu.usado=true; } });
      if(fidSobra>0.01) ct.cupones=[...(ct.cupones||[]),{id:'sd'+Date.now().toString(36),pct:fidSobra,de:'fidelidad',usado:false}];
      if(usoRegalo) ct.regalo='usado';
    }
    // el que lo refirio gana su descuento cuando el referido hace su primera visita
    if(c.refPor&&!c.refRecompensado){
      const R=list.find(x=>x.id===c.refPor);
      const RT=R&&(R.tarjetas||[]).find(t=>t.snap&&t.snap.referidos&&t.snap.referidos.length);
      if(RT){
        const niveles=RT.snap.referidos||[];
        if(!(RT.refs||[]).includes(c.id)&&(RT.refs||[]).length<niveles.length){
          RT.refs=[...(RT.refs||[]),c.id];
          RT.cupones=[...(RT.cupones||[]),{id:'cu'+Date.now().toString(36),pct:niveles[RT.refs.length-1],de:c.id,usado:false}];
          R.upd=ahora;
        }
      }
      c.refRecompensado=true;
    }
    c.upd=ahora;
  });
}

// ============ TARJETA DE FIDELIDAD ============
function tarjetasDisponibles(){
  const rb=profile?rubrosDeUsuario(profile):null;
  // una tarjeta puede ser solo de ciertos profesionales (ej: la de Dai); recepcion y admin ven todas y eligen
  return (promos.tarjetas||[]).filter(t=>t.activa!==false&&(!rb||profile.role!=='profesional'||String(t.rubro).split(',').some(r=>rb.includes(r.trim())))&&(!profile||profile.role!=='profesional'||!(t.profs&&t.profs.length)||t.profs.includes(profile.id)));
}
function tarjetaParaRubros(cardId){ const L=tarjetasDisponibles(); return (cardId&&L.find(t=>t.id===cardId))||L[0]||null; }
function nuevaTarjetaCliente(card){ return {cardId:card.id,snap:clonar(card),desde:hoyStr(),visitas:0,refs:[],cupones:[],regalo:'no'}; }
async function activarTarjetaCliente(id,cardId){
  const cli=clienteDe(id);
  const L=tarjetasDisponibles().filter(t=>!cli||!(cli.tarjetas||[]).some(x=>x.cardId===t.id));
  if(!L.length){ showToast('Ya tiene todas las tarjetas disponibles'); return; }
  if(!cardId&&L.length>1){
    document.getElementById('registro-content').innerHTML=cabeceraModal('¿Qué tarjeta?')+L.map(t=>`<button class="btn btn-ghost" style="margin-bottom:8px;text-align:left" onclick="closeModal('modal-registro');activarTarjetaCliente('${id}','${t.id}')">⭐ ${escH(t.nombre)} <span style="color:var(--muted2);font-weight:600">· ${escH(rubrosNombres(t.rubro))}</span></button>`).join('');
    openModal('modal-registro'); return;
  }
  if(!cardId) cardId=L[0].id;
  const card=tarjetaParaRubros(cardId); if(!card){ showToast('No hay tarjeta para tu rubro'); return; }
  const res=await cambiarClientes(list=>{
    const c=list.find(x=>x.id===id); if(!c) return {error:'sin-cliente'};
    c.tarjetas=c.tarjetas||[];
    if(c.tarjetas.some(t=>t.cardId===card.id)) return {error:'ya-tiene'};
    c.tarjetas.push(nuevaTarjetaCliente(card)); c.upd=new Date().toISOString();
  });
  if(res&&res.error==='ya-tiene'){ showToast('Ya tiene esta tarjeta'); return; }
  showToast('Tarjeta activada ⭐'); abrirClienteDetalle(id);
}
// Paleta fija por rubro (hash del id) -- sin gradientes ni glow, un color solido por tarjeta para poder
// distinguirlas de un vistazo en la billetera. No depende de config nueva en el admin.
const TARJETA_COLORES=['#4A136B','#0F766E','#9A3412','#1D4ED8','#A21CAF','#065F46','#B91C1C','#3730A3'];
const RUBRO_ICONO={barberia:'✂️','barberia-premium':'✂️',peluqueria:'💇',cosmetologia:'🧴',cejas:'👁️',podologia:'🦶',masajes:'💆',manos:'💅'};
function rubroPrincipal(t){ return String((t&&t.snap&&t.snap.rubro)||'').split(',')[0].trim(); }
function colorDeTarjeta(t){ const key=rubroPrincipal(t)||'x'; let h=0; for(let i=0;i<key.length;i++) h=(h*31+key.charCodeAt(i))>>>0; return TARJETA_COLORES[h%TARJETA_COLORES.length]; }
function iconoDeTarjeta(t){ return RUBRO_ICONO[rubroPrincipal(t)]||'⭐'; }
// Si el cliente tiene mas de una tarjeta, se muestran como una billetera: la primera abierta, el resto
// colapsado en pestañas por rubro -- tocar una pestaña abre esa tarjeta y cierra la anterior.
function htmlTarjetaCliente(c){
  const L=(c&&c.tarjetas)||[]; if(!L.length) return '';
  if(L.length===1) return htmlUnaTarjetaCliente(c,L[0]);
  const wid='wallet'+Math.random().toString(36).slice(2,9);
  const tabs=`<div style="display:flex;gap:6px;margin-bottom:10px;overflow-x:auto;padding-bottom:2px">${L.map((t,i)=>{ const col=colorDeTarjeta(t); return `<button onclick="walletMostrar('${wid}',${i})" data-wtab="${wid}-${i}" data-col="${col}" style="flex-shrink:0;display:flex;align-items:center;gap:5px;padding:7px 13px;border-radius:20px;border:1.5px solid ${i===0?col:'var(--border2)'};background:${i===0?col+'22':'transparent'};color:${i===0?col:'var(--muted2)'};font-family:var(--font);font-size:12px;font-weight:700;cursor:pointer">${iconoDeTarjeta(t)} ${escH(rubrosNombres(t.snap.rubro))}</button>`; }).join('')}</div>`;
  return `<div id="${wid}">${tabs}${L.map((t,i)=>`<div data-wcard="${wid}-${i}" style="${i===0?'':'display:none'}">${htmlUnaTarjetaCliente(c,t)}</div>`).join('')}</div>`;
}
// Tarjeta de papel con visitas que no estan en la app: recepcion/admin fija la cantidad real de visitas,
// queda registrado quien, cuando, de cuanto a cuanto y por que, y se ve como cambia el escalon de descuento.
let ajusteTarjetaSel=null;
function abrirAjusteTarjeta(cid){
  const c=clienteDe(cid); if(!c) return;
  const L=(c.tarjetas||[]).filter(t=>t.snap);
  if(!L.length){ showToast('Este cliente no tiene tarjeta de fidelidad activa'); return; }
  ajusteTarjetaSel={cid,idx:0,visitas:null,motivo:''};
  renderAjusteTarjeta(); openModal('modal-registro');
}
function renderAjusteTarjeta(){
  const s=ajusteTarjetaSel; const c=clienteDe(s.cid); const L=(c.tarjetas||[]).filter(t=>t.snap);
  const t=L[s.idx]||L[0]; const actual=numV(t.visitas);
  const nueva=s.visitas==null?actual:numV(s.visitas);
  const paso=(v)=>{ const i=infoDeTarjeta({...t,visitas:v}); return i?(i.k+'° visita · '+(i.pctFid?i.pctFid+'% de fidelidad':'sin descuento')+(i.pasoLabel?' · '+i.pasoLabel:'')):'—'; };
  const color=(profile&&profile.color)||'#4A136B';
  document.getElementById('registro-content').innerHTML=cabeceraModal('🔧 Ajustar tarjeta física')+`
    <div class="card" style="margin-bottom:12px"><div style="font-size:14px;font-weight:800">${escH(c.nombre)}</div>
      ${L.length>1?`<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px">${L.map((x,i)=>`<button type="button" onclick="ajusteTarjetaSel.idx=${i};ajusteTarjetaSel.visitas=null;renderAjusteTarjeta()" style="${pillStyle(i===s.idx,color)}">${escH(x.rubro||'tarjeta')}</button>`).join('')}</div>`:''}</div>
    <div class="field"><label>Visitas que tiene la tarjeta de papel</label><input type="number" min="0" inputmode="numeric" value="${nueva}" onchange="ajusteTarjetaSel.visitas=Math.max(0,parseInt(this.value)||0);renderAjusteTarjeta()"/></div>
    <div class="card" style="margin-bottom:12px;font-size:12.5px;line-height:1.7">En la app ahora: <b>${actual}</b> visitas → ${paso(actual)}<br>Con el ajuste: <b style="color:var(--text)">${nueva}</b> visitas → <b style="color:var(--text)">${paso(nueva)}</b></div>
    <div class="field"><label>Motivo (obligatorio)</label><input type="text" value="${escH(s.motivo)}" placeholder="Ej: tarjeta de papel con 4 visitas hechas antes de la app" oninput="ajusteTarjetaSel.motivo=this.value"/></div>
    <button class="btn btn-primary" onclick="confirmarAjusteTarjeta()" style="background:${color}" ${nueva===actual?'disabled':''}>Guardar ajuste</button>`;
}
async function confirmarAjusteTarjeta(){
  const s=ajusteTarjetaSel; if(!s) return;
  const motivo=(s.motivo||'').trim(); if(!motivo){ showToast('Poné el motivo del ajuste'); return; }
  const nueva=s.visitas==null?null:s.visitas; const c=clienteDe(s.cid); if(!c||nueva==null) return;
  const L=(c.tarjetas||[]).filter(t=>t.snap); const cardId=L[s.idx].cardId; const de=numV(L[s.idx].visitas);
  const ahora=new Date().toISOString();
  await cambiarClientes(list=>{ const x=list.find(z=>z.id===s.cid); const t=x&&(x.tarjetas||[]).find(q=>q.cardId===cardId); if(t){ t.visitas=nueva; t.ajustes=[...(t.ajustes||[]),{ts:ahora,por:profile.name,porId:profile.id,de,a:nueva,motivo}]; x.upd=ahora; } });
  ajusteTarjetaSel=null; closeModal('modal-registro'); showToast('Tarjeta ajustada: '+de+' → '+nueva+' visitas ✓'); abrirClienteDetalle(s.cid);
}
function walletMostrar(wid,idx){
  document.querySelectorAll(`[data-wcard^="${wid}-"]`).forEach(el=>{ el.style.display=el.dataset.wcard===(wid+'-'+idx)?'':'none'; });
  document.querySelectorAll(`[data-wtab^="${wid}-"]`).forEach(el=>{
    const on=el.dataset.wtab===(wid+'-'+idx), col=el.dataset.col;
    el.style.borderColor=on?col:'var(--border2)'; el.style.background=on?col+'22':'transparent'; el.style.color=on?col:'var(--muted2)';
  });
}
function htmlUnaTarjetaCliente(c,t){
  if(!t||!t.snap) return '';
  const sn=t.snap, inf=infoDeTarjeta(t)||{}, un=unidadTarj(sn);
  const ciclo=inf.ciclo||10, hechas=numV(t.visitas)%ciclo||(numV(t.visitas)>0&&numV(t.visitas)%ciclo===0?ciclo:0);
  const pctDe=(n)=>((sn.visitas||[]).find(s=>s.n===n)||{}).pct;
  const regaloDe=(n)=>{ const x=(sn.visitas||[]).find(v=>v.n===n); return !!(x&&x.servicioIds&&x.servicioIds.length); };
  const nombreRubro_=rubrosNombres(sn.rubro);
  const color=colorDeTarjeta(t), icono=iconoDeTarjeta(t);
  const cir=(n)=>{ const done=n<=hechas, prox=n===hechas+1, pc=pctDe(n);
    return `<div style="text-align:center"><div style="width:100%;aspect-ratio:1;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:${pc?11:13}px;font-weight:800;${done?'background:#fff;color:'+color:prox?'border:2px dashed rgba(255,255,255,.75);color:#fff':'background:rgba(255,255,255,.14);color:rgba(255,255,255,.65)'}">${done?'✓':pc?(regaloDe(n)?'🎁':pc+'%'):n}</div><div style="font-size:9px;opacity:.7;margin-top:2px;color:#fff">${n}°</div></div>`; };
  const niveles=sn.referidos||[];
  const refs=(t.refs||[]).length;
  const regaloHtml=!sn.premio?'':(t.regalo==='usado'?'🎁 Regalo usado':(inf.regalo?'🎁 ¡Tiene un corte de regalo!':`🎁 Corte gratis: ${sn.premio.refs} referidos + ${sn.premio.visitas} cortes`));
  const progreso=Math.round(hechas/ciclo*100);
  return `<div style="margin-bottom:12px;border-radius:22px;padding:18px;color:#fff;background:${color};position:relative;overflow:hidden;box-shadow:0 8px 20px rgba(0,0,0,.28)">
    <div style="position:absolute;top:-20px;right:-16px;font-size:92px;opacity:.13;transform:rotate(12deg);pointer-events:none">${icono}</div>
    <div style="display:flex;justify-content:space-between;align-items:flex-start;position:relative">
      <div><div style="font-size:10px;letter-spacing:.14em;text-transform:uppercase;opacity:.8">${escH(sn.nombre||'Tarjeta de fidelidad')}</div><div style="font-size:19px;font-weight:800;margin-top:2px">${escH(c.nombre)}</div>${nombreRubro_?`<div style="font-size:11px;opacity:.75;margin-top:1px">${escH(nombreRubro_)}</div>`:''}</div>
      <div style="font-size:26px;position:relative">${icono}</div></div>
    <div style="height:4px;background:rgba(255,255,255,.22);border-radius:4px;margin:14px 0 12px;position:relative;overflow:hidden"><div style="height:100%;width:${progreso}%;background:#fff;border-radius:4px"></div></div>
    <div style="display:grid;grid-template-columns:repeat(${ciclo<=6?ciclo:5},1fr);gap:7px;margin-bottom:12px;position:relative">${Array.from({length:ciclo},(_,i)=>cir(i+1)).join('')}</div>
    ${niveles.length?`<div style="font-size:10px;letter-spacing:.1em;text-transform:uppercase;opacity:.75;margin-bottom:6px;position:relative">Referidos ${refs}/${niveles.length}</div>
    <div style="display:flex;gap:8px;position:relative;margin-bottom:10px">${niveles.map((p,i)=>{ const got=i<refs, cu=(t.cupones||[]).filter(x=>x.de!=='fidelidad')[i], usado=cu&&cu.usado; const resta=cu&&!cu.usado&&numV(cu.pct)<p?Math.round(numV(cu.pct)*10)/10:p; return `<div style="flex:1;text-align:center;padding:7px 2px;border-radius:12px;font-size:12px;font-weight:800;${got?(usado?'background:rgba(255,255,255,.12);text-decoration:line-through;opacity:.6':'background:#fff;color:'+color):'border:1.5px dashed rgba(255,255,255,.4);opacity:.8'}">${resta}%</div>`; }).join('')}</div>`:''}
    ${(t.cupones||[]).some(x=>x.de==='fidelidad'&&!x.usado)?`<div style="font-size:11.5px;font-weight:700;position:relative;margin-bottom:8px;background:rgba(255,255,255,.16);border-radius:10px;padding:6px 10px;display:inline-block">💰 Saldo guardado: ${Math.round((t.cupones||[]).filter(x=>x.de==='fidelidad'&&!x.usado).reduce((a,x)=>a+numV(x.pct),0)*10)/10}%</div>`:''}
    <div style="font-size:12px;font-weight:700;position:relative;${inf.regalo?'color:#fff':'opacity:.9'}">${regaloHtml}</div>
    <div style="font-size:11px;opacity:.85;margin-top:6px;position:relative">${inf.regalo?'Próximo corte: 100% bonificado':`Próximo ${un} (n°${inf.k}): ${inf.pasoLabel?'🎁 '+escH(inf.pasoLabel):(inf.pctFid?inf.pctFid+'% de fidelidad':'precio normal')}${inf.pctRef?' + '+inf.pctRef+'% acumulado':''}`}</div>
  </div>`;
}

// ---------- datos del cliente para pasar a AgendaPro ----------
// El profesional carga nombre y apellido, telefono y fecha de nacimiento; el mail lo pide recepcion (si tiene).
function nacTxt(c){ if(c.nacimiento){ const [y,m,d]=c.nacimiento.split('-'); return d+'/'+m+'/'+y; } return c.cumple?cumpleTxt(c.cumple)+' (falta el año)':''; }
function faltanDatosCliente(c){ const f=[]; if(String(c.tel||'').replace(/\D/g,'').length<8) f.push('el teléfono'); if(!c.nacimiento) f.push('la fecha de nacimiento'); return f; }
function clienteDeTurno(t){ return clienteDe(t.clienteId)||(t.cliente?clientesDir.find(x=>x.nkey===nkey(t.cliente)):null)||null; }
function copiarDatosCliente(id){
  const c=clienteDe(id); if(!c) return;
  copyText('Nombre y apellido: '+c.nombre+'\nTeléfono: '+(c.tel||'')+'\nFecha de nacimiento: '+(c.nacimiento?nacTxt(c):'')+(c.email?'\nMail: '+c.email:''));
}
function htmlDatosClienteRec(t,enCierre){
  const c=clienteDeTurno(t);
  if(!c) return `<div style="background:rgba(244,114,182,.08);border:1px solid rgba(244,114,182,.3);border-radius:10px;padding:8px 10px;margin:6px 0;font-size:12px;color:#f472b6;font-weight:700">⚠️ Este turno no tiene ficha de cliente: pedile los datos al profesional.</div>`;
  const rojo=(x)=>`<span style="color:#f472b6;font-weight:700">${x}</span>`;
  const ctxArg=enCierre?",{deCierre:true}":"";
  return `<div style="background:var(--s2);border-radius:10px;padding:8px 10px;margin:6px 0;font-size:12px;line-height:1.75">
    <div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><b style="font-size:11.5px">📋 Datos para AgendaPro</b><button class="lnk" onclick="copiarDatosCliente('${c.id}')">Copiar todo</button></div>
    👤 ${escH(c.nombre)}<br>📞 ${c.tel?escH(c.tel):rojo('falta el teléfono')}<br>🎂 ${c.nacimiento?nacTxt(c):rojo(c.cumple?'falta el año de nacimiento':'falta la fecha de nacimiento')}<br>✉️ ${c.email?escH(c.email):'<span style="color:var(--muted)">sin mail — pedilo</span>'}
    <button class="lnk" onclick="abrirFormCliente('${c.id}'${ctxArg})">✏️ ${c.email?'Editar datos':'Agregar mail'}</button></div>`;
}

// ---------- cobrado en el dia (lo que ya cerro recepcion, o los profesionales de sucursales sin recepcion) ----------
let recCobDia='hoy';
function cobradosDelDia(fecha){
  const cierres=(cierresData&&cierresData.byKey)||{}; const L=[];
  allUsers.filter(u=>esProf(u)||u.role==='recepcionista').forEach(u=>{
    let dd={}; try{ dd=JSON.parse(localStorage.getItem('luffy_dinero_'+u.id)||'{}'); }catch(e){}
    normalizarFechas(dd);
    const ventas=(dd.ventas||[]).filter(v=>v.fecha===fecha&&!v.deudaId); const usadas=new Set();
    (dd.turnos||[]).filter(t=>t.fecha===fecha).forEach(t=>{
      // dd.turnos solo tiene turnos YA cobrados (se empuja recien al guardar el cobro) — no hace falta ningun filtro extra, todo lo de aca ya esta cobrado
      const key='t:'+u.id+':'+t.id, c=cierres[key];
      const ex=ventas.filter(v=>v.turnoId===t.id); ex.forEach(v=>usadas.add(v.id));
      const desc=(t.descDetalle&&t.descDetalle.length)?t.descDetalle.map(d=>d.label+' −'+d.pct+'%').join(' · '):(numV(t.descuento)>0?'descuento −'+fp(t.descuento):'');
      L.push({ts:t.creadoEn,suc:t.sucursal||u.sucursal,cliente:t.cliente||'Cliente',num:t.clienteNumero,prof:u.name,detalle:t.servicio||'Servicio',extras:ex.map(v=>v.productoNombre+' x'+v.cantidad),
        monto:numV(t.aCobrar!=null?t.aCobrar:t.monto)+ex.reduce((a,v)=>a+numV(v.total),0),medio:t.medio,desc,deuda:!!t.deudaId,cierre:c,profId:u.id,turnoId:t.id,editado:!!t.editado});
    });
    ventas.filter(v=>!usadas.has(v.id)).forEach(v=>{
      L.push({ts:v.creadoEn,suc:v.sucursal||u.sucursal,cliente:v.cliente||'Venta de mostrador',prof:u.name,detalle:v.productoNombre+' x'+v.cantidad,extras:[],monto:numV(v.total),medio:v.medio,venta:true});
    });
  });
  return L.sort((a,b)=>String(b.ts).localeCompare(String(a.ts)));
}
const MED_COBRANZA={efectivo:'💵 Efectivo',mp:'📱 Mercado Pago',tarjeta:'💳 Tarjeta'};
// Totales agrupados por medio de pago y por profesional, para el resumen de Cobranzas (pedido de Ivo, 30/09/2026).
function htmlTotalesCobrados(L){
  if(!L.length) return '';
  const porMedio={}; L.forEach(x=>{ const k=x.medio||'otro'; porMedio[k]=(porMedio[k]||0)+x.monto; });
  const porProf={}; L.forEach(x=>{ porProf[x.prof]=(porProf[x.prof]||0)+x.monto; });
  const fila=(label,monto)=>`<div style="display:flex;justify-content:space-between;font-size:12.5px;padding:4px 0"><span style="color:var(--muted2)">${label}</span><span style="font-weight:800">${fp(monto)}</span></div>`;
  return `<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px">
    <div class="card" style="margin:0;padding:10px 12px"><div style="font-size:10.5px;color:var(--muted2);font-weight:700;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">Por medio de pago</div>${Object.keys(porMedio).sort((a,b)=>porMedio[b]-porMedio[a]).map(k=>fila(MED_COBRANZA[k]||escH(k),porMedio[k])).join('')}</div>
    <div class="card" style="margin:0;padding:10px 12px"><div style="font-size:10.5px;color:var(--muted2);font-weight:700;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">Por profesional</div>${Object.keys(porProf).sort((a,b)=>porProf[b]-porProf[a]).map(k=>fila(escH(k),porProf[k])).join('')}</div>
  </div>`;
}
function htmlCobradosInner(){
  const hoy=hoyStr(), fecha=recCobDia==='ayer'?addDias(hoy,-1):hoy; const L=cobradosDelDia(fecha); const total=L.reduce((a,x)=>a+x.monto,0);
  const tab=(k,l)=>`<button onclick="recCobDia='${k}';document.getElementById('rec-cob').innerHTML=htmlCobradosInner()" style="${pillStyle(recCobDia===k,'#34d399')}">${l}</button>`;
  return `<div class="sec-hdr" style="margin-top:16px;margin-bottom:8px"><span class="sec-title">✅ Cobrado ${recCobDia==='ayer'?'ayer':'hoy'} (${L.length})</span><span style="font-size:14px;font-weight:900;color:#34d399">${fp(total)}</span></div>
    <div style="display:flex;gap:6px;margin-bottom:8px">${tab('hoy','Hoy')}${tab('ayer','Ayer')}</div>
    ${htmlTotalesCobrados(L)}
    ${L.length?L.slice(0,40).map(x=>`<div class="card" style="margin-bottom:6px;padding:10px 12px;border-left:5px solid ${(sucursalDe(x.suc)||{}).color||'var(--border2)'}">
      <div style="display:flex;justify-content:space-between;align-items:baseline;gap:8px"><div style="font-size:13px;font-weight:800;min-width:0">${escH(x.cliente)}${x.num&&verNumeroCliente()?' <span style="color:var(--muted2);font-weight:700">#'+x.num+'</span>':''}</div><div style="font-size:16px;font-weight:900;white-space:nowrap">${fp(x.monto)}</div></div>
      <div style="font-size:11.5px;color:var(--muted2);line-height:1.6">${horaDeIso(x.ts)} · ${escH(x.detalle)}${x.extras.length?' + '+escH(x.extras.join(', ')):''}<br>${x.venta?'🛍️ Venta':'✂️'} ${escH(x.prof)} · ${MED_COBRANZA[x.medio]||escH(x.medio||'')}${x.deuda?' · <b style="color:#fbbf24">pago de deuda</b>':''}${x.desc?' · <span style="color:#34d399">'+escH(x.desc)+'</span>':''}${x.cierre&&x.cierre.por?' · cerró '+escH(x.cierre.por):''}${x.editado?' · <b style="color:#fbbf24">✏️ editado</b>':''}</div>
      ${(!x.venta&&!x.deuda)?`<button class="lnk" style="margin-top:4px" onclick="abrirEditarCobro('${x.profId}','${x.turnoId}')">✏️ Editar</button>`:''}</div>`).join(''):'<div class="card" style="text-align:center;color:var(--muted);font-size:13px;padding:16px">No hay cobros registrados</div>'}`;
}
function htmlCobradosRec(){ return `<div id="rec-cob">${htmlCobradosInner()}</div>`; }

// ============ RECEPCION / PROFESIONAL: vender membresia ============
let ventaSel=null;
const MEDIOS_VENTA=[['💵','Efectivo','efectivo'],['📱','Mercado Pago','mp'],['💳','Tarjeta','tarjeta']];
const htmlMedios=(fn,sel,color)=>`<div style="display:flex;gap:8px;margin-bottom:12px">${MEDIOS_VENTA.map(([e,l,v])=>`<button onclick="${fn}('${v}')" style="flex:1;padding:12px 4px;border-radius:12px;border:1.5px solid ${sel===v?color:'var(--border2)'};background:${sel===v?color+'22':'transparent'};color:${sel===v?color:'var(--muted2)'};font-family:var(--font);font-size:12px;font-weight:700;cursor:pointer"><div style="font-size:20px">${e}</div>${l}</button>`).join('')}</div>`;
const cabeceraModal=(t)=>`<div style="display:flex;align-items:center;gap:8px;margin-bottom:12px"><div class="modal-title" style="margin:0">${t}</div><button onclick="closeModal('modal-registro')" style="margin-left:auto;background:var(--s3);border:none;color:var(--muted2);font-size:18px;width:32px;height:32px;border-radius:50%;cursor:pointer">×</button></div>`;
function abrirVentaMembresia(cid){
  const c=clienteDe(cid); if(!c) return;
  const planes=membresiaPlanesDisponibles();
  if(!planes.length){ showToast('El admin todavía no configuró las membresías'); return; }
  if(membresiaActivaDe(cid)){ showToast('Ya tiene una membresía con cortes disponibles'); return; }
  ventaSel={tipo:'memb',cid,medio:'efectivo',planId:planes[0].id};
  renderVentaMembresia(); openModal('modal-registro');
}
function ventaMembresiaPlan(id){ if(ventaSel){ ventaSel.planId=id; renderVentaMembresia(); } }
function ventaMedio(m){ if(ventaSel){ ventaSel.medio=m; ventaSel.tipo==='memb'?renderVentaMembresia():renderVentaPaquete(); } }
function renderVentaMembresia(){
  const s=ventaSel; const c=clienteDe(s.cid); const planes=membresiaPlanesDisponibles();
  const plan=planes.find(p=>p.id===s.planId)||planes[0]; s.planId=plan.id;
  const sv=servicioDePlan(plan), vc=Math.round(plan.precio/plan.creditos);
  const color=(profile&&profile.color)||'#4A136B';
  document.getElementById('registro-content').innerHTML=cabeceraModal('Vender membresía 💳')+`
    <div class="card" style="margin-bottom:12px"><div style="font-size:15px;font-weight:800">${escH(c.nombre)}${verNumeroCliente()?' #'+c.numero:''}</div></div>
    ${planes.length>1?`<div class="field"><label>¿Qué membresía?</label><div style="display:flex;gap:6px;flex-wrap:wrap">${planes.map(p=>`<button onclick="ventaMembresiaPlan('${p.id}')" style="${pillStyle(s.planId===p.id,color)}">${escH(p.nombre)}</button>`).join('')}</div></div>`:''}
    <div class="card" style="margin-bottom:12px"><div style="font-size:12px;color:var(--muted2);line-height:1.6">${plan.creditos} servicios de ${escH(sv.nombre)}, se abonan ahora.<br>Precio fijo: <b style="color:var(--text)">${fp(plan.precio)}</b> (${fp(vc)} por servicio)<br>Vence a los 30 días. Cada servicio le suma al profesional ${fp(vc)}.</div></div>
    <div class="field"><label>¿Cómo paga?</label>${htmlMedios('ventaMedio',s.medio,color)}</div>
    <button class="btn btn-primary" onclick="confirmarVentaMembresia()" style="background:${color}">Cobrar ${fp(plan.precio)} y activar</button>`;
}
// Registro nuevo de una membresia (precio fijo, vence a los 30 dias desde hoy). Lo usan la venta suelta y el cobro de un turno.
function membresiaRecNueva(c,plan,sv,medio){
  const ahora=new Date().toISOString(), hoy=hoyStr();
  return {id:'mb'+Date.now().toString(36),clienteId:c.id,clienteNombre:c.nombre,clienteNumero:c.numero,
    planId:plan.id,planNombre:plan.nombre,servicioId:sv.id,servicioNombre:sv.nombre,rubro:sv.rubro||'',
    creditos:plan.creditos,precio:plan.precio,valorCredito:Math.round(plan.precio/plan.creditos),
    medio,fecha:hoy,vence:addDias(hoy,30),sucursal:sucursalActual(),
    vendedorId:profile.id,vendedorNombre:profile.name,vendedorRol:profile.role,usos:[],creadoEn:ahora,upd:ahora};
}
async function confirmarVentaMembresia(){
  const s=ventaSel; if(!s||s.ocupado) return; s.ocupado=true;
  const c=clienteDe(s.cid); const plan=(promos.membresiaPlanes||[]).find(p=>p.id===s.planId); const sv=plan?servicioDePlan(plan):null;
  if(!c||!plan||!sv){ s.ocupado=false; showToast('Faltan datos'); return; }
  const hoy=hoyStr();
  const r=await membresiasSt.cambiar(l=>{
    if(l.some(m=>m.clienteId===c.id&&m.usos.length<m.creditos&&(!m.vence||m.vence>=hoy))) return {error:true};
    const m=membresiaRecNueva(c,plan,sv,s.medio);
    l.push(m); return {m};
  });
  ventaSel=null;
  if(r.error){ showToast('Ya tenía una membresía activa'); return; }
  closeModal('modal-registro'); showToast('Membresía activada ✓ '+fp(plan.precio)); refreshCurrentView();
}
// Planes que se pueden vender en el cobro de un turno: el servicio del plan tiene que estar entre los servicios
// que se le hacen al cliente (y se cobran como linea propia), y el cliente no puede tener otra membresia activa.
function planesVendiblesEnCobro(cli,servicioIds){
  if(!cli||membresiaActivaDe(cli.id)||cobro.medio==='debe') return [];
  return membresiaPlanesDisponibles().filter(p=>{ const s=servicioDePlanEnCobro(p,servicioIds); return s&&s.rubro==='barberia'; });
}
function cobroVenderMembresia(planId){
  cobro.vendeMembPlanId=cobro.vendeMembPlanId===planId?null:planId;
  refreshCobro();
}

// ============ vender paquete (promos cruzadas) ============
// Cada servicio del paquete calcula primero SU propio mejor descuento (como si se cobrara solo: promo horaria/fuerzas,
// efectivo, fidelidad, referidos — el mas alto de todos). Despues aplicarDescPaquete decide, por linea, si gana ese o el
// % del paquete (nunca los dos).
function mejorDescuentoServicio(svc,cli,ctx,medioEfectivo){
  const precio=precioSvc(svc.id), rubro=svc.rubro||'';
  const tarj=infoTarjeta(cli,rubro);
  const cand=[];
  if(tarj&&tarj.regalo&&rubroEn(tarj.rubro,rubro)) cand.push({tipo:'regalo',label:'Corte de regalo (tarjeta completa)',pct:100,monto:precio});
  (promos.fijos||[]).filter(f=>reglaAplica(f,ctx)).forEach(f=>{
    if(!rubroEn(f.rubro,rubro)) return;
    if(f.servicioIds&&f.servicioIds.length&&!f.servicioIds.includes(svc.id)) return;
    const extra=!!(f.extra&&f.extra.profesion&&cli&&nkey(cli.profesion)===nkey(f.extra.profesion));
    const pct=numV(f.pct)+(extra?numV(f.extra.pct):0), monto=Math.round(precio*pct/100);
    if(monto>0) cand.push({tipo:'fijo',label:f.nombre+(extra?' + '+f.extra.profesion+' '+numV(f.extra.pct)+'%':''),pct,monto});
  });
  if(tarj&&rubroEn(tarj.rubro,rubro)&&tarj.pctFid>0){
    const aplica=!(tarj.pasoSvcs&&tarj.pasoSvcs.length)||tarj.pasoSvcs.includes(svc.id);
    if(aplica){ const m=Math.round(precio*tarj.pctFid/100); if(m>0) cand.push({tipo:'fidelidad',label:(tarj.pasoLabel||'Fidelidad')+' · visita n°'+tarj.k,pct:tarj.pctFid,monto:m}); }
  }
  if(tarj&&rubroEn(tarj.rubro,rubro)){
    const mejorCupon=tarj.cupones.slice().sort((a,b)=>numV(b.pct)-numV(a.pct))[0];
    if(mejorCupon){ const m=Math.round(precio*numV(mejorCupon.pct)/100); if(m>0) cand.push({tipo:'referidos',label:'Referidos',pct:numV(mejorCupon.pct),monto:m}); }
  }
  if(rubro==='barberia-premium') cand.length=0; // Barberia de Autor: sin promos, cupones ni ofertas (decidido por Ivo, 3/10/2026); solo el 10% por efectivo
  if(medioEfectivo){ const m=Math.round(precio*DESC_EFECTIVO_PCT/100); if(m>0) cand.push({tipo:'efectivo',label:'Pago en efectivo',pct:DESC_EFECTIVO_PCT,monto:m}); }
  // Cuenta con Google (10%) + reseña (5%): mismo candidato que ya existe en calcCobro() para el cobro final,
  // pero acá falta para la reserva publica y "Armar paquete" (que usan este motor por-servicio, no calcCobro).
  // Bug real reportado por Ivo/Central el 27/09/2026: se mostraba en /#cuenta pero nunca se aplicaba al reservar.
  // ctx.cliente cubre la reserva publica (ahi "cli" siempre es null a proposito, no tiene ficha completa --
  // ver rpCliente/rpCtx), "cli" cubre "Armar paquete" con una ficha real seleccionada por el staff.
  const idCuenta=(cli&&cli.authUid)?cli:(ctx&&ctx.cliente&&ctx.cliente.authUid?ctx.cliente:null);
  const pctCuenta=idCuenta?CUENTA_DESC_PCT:0, pctResena=idCuenta&&idCuenta.resenaGoogle?RESENA_DESC_PCT:0, pctCuentaTotal=pctCuenta+pctResena;
  if(pctCuentaTotal>0&&rubro!=='barberia-premium'){
    const m=Math.round(precio*pctCuentaTotal/100);
    if(m>0){ const partes=[pctCuenta?'cuenta':null,pctResena?'reseña':null].filter(Boolean).join(' + '); cand.push({tipo:'cuenta',label:'⭐ '+partes.charAt(0).toUpperCase()+partes.slice(1),pct:pctCuentaTotal,monto:m}); }
  }
  let ganador=null; cand.forEach(c=>{ if(!ganador||c.monto>ganador.monto) ganador=c; });
  return ganador;
}
// Arma un paquete con UN solo descuento por servicio, el mas alto: el propio (combo, promo horaria, efectivo,
// fidelidad, etc.) o el % del paquete sobre el precio de lista -- nunca los dos sumados (regla de Ivo, 6/10/2026;
// antes el % del paquete iba encima de lo ya descontado). Los combos de Catalogo -> Combos y ofertas se detectan
// igual que en el cobro (lineasCobro) y cuentan como 1 servicio para el escalon del 5/10/15%.
function calcPaqueteItems(items,cli,ctx,medioEfectivo){
  return aplicarDescPaquete(items.map(svc=>({svc,lista:numV(svc.precio),descInd:mejorDescuentoServicio(svc,cli,ctx,medioEfectivo)})));
}
// base: [{svc,lista,descInd}] con el mejor descuento propio de cada servicio ya elegido. Lo usan calcPaqueteItems y vpCalcFinal.
function aplicarDescPaquete(base){
  // Barberia de Autor no entra en el descuento de paquete ni cuenta para el escalon (decidido por Ivo, 3/10/2026)
  const esAutor=svc=>svc.rubro==='barberia-premium';
  base=base.map(x=>({...x}));
  // Combos: si estan todos sus servicios, el descuento del combo se reparte entre sus lineas y compite como descuento propio
  const libres=base.map((x,i)=>i), ids=base.map(x=>x.svc.id); let enCombos=0;
  combos.filter(c=>comboVigente(c)&&c.servicioIds&&c.servicioIds.length>1&&c.servicioIds.every(id=>ids.includes(id)))
    .map(c=>({c,lista:c.servicioIds.reduce((a,id)=>a+precioSvc(id),0)}))
    .filter(x=>numV(x.c.precio)>0&&x.c.precio<x.lista)
    .sort((a,b)=>(b.lista-b.c.precio)-(a.lista-a.c.precio))
    .forEach(({c,lista})=>{
      const idx=[]; c.servicioIds.forEach(id=>{ const k=libres.find(i=>!idx.includes(i)&&base[i].svc.id===id); if(k!=null) idx.push(k); });
      if(idx.length!==c.servicioIds.length) return;
      idx.forEach(i=>libres.splice(libres.indexOf(i),1)); enCombos+=idx.length-1;
      const descTot=lista-numV(c.precio), pctC=Math.round(descTot/lista*1000)/10; let acum=0;
      idx.forEach((i,j)=>{ const x=base[i]; const m=j===idx.length-1?descTot-acum:Math.round(x.lista*descTot/lista); acum+=m;
        if(!x.descInd||x.descInd.monto<m) x.descInd={tipo:'combo',label:'Combo '+c.nombre,pct:pctC,monto:m}; });
    });
  const pct=pctPaquete(base.filter(x=>!esAutor(x.svc)).length-enCombos);
  let descPaq=0;
  const out=base.map(x=>{
    let descInd=x.descInd, dq=0;
    if(!esAutor(x.svc)&&pct>0){ const m=Math.round(x.lista*pct/100); if(m>(descInd?descInd.monto:0)){ descInd=null; dq=m; descPaq+=m; } }
    const lineaFinal=x.lista-(descInd?descInd.monto:0), final=Math.max(0,lineaFinal-dq);
    const descPct=x.lista>0?Math.round((x.lista-final)/x.lista*1000)/10:0;
    return {...x,descInd,lineaFinal,dq,final,descPct};
  });
  const total=out.reduce((a,x)=>a+x.final,0);
  return {items:out,sub:total+descPaq,pct,descPaq,total,lista:base.reduce((a,x)=>a+x.lista,0)};
}
// Cuanto lleva facturado en paquetes esta quincena (sin plata de comision: para no anclarse mientras se calibra el escalonado)
function facturadoPaqQuincena(recId,qk){ const k=qk||quincenaKey(hoyStr()); return paquetesSt.list.filter(p=>p.vendedorId===recId&&p.vendedorRol==='recepcionista'&&p.fecha&&quincenaKey(p.fecha)===k).reduce((s,p)=>s+numV(p.total),0); }
function progresoPaqSinPlata(totalEnCurso){
  if(!profile||profile.role!=='recepcionista') return '';
  const llevas=facturadoPaqQuincena(profile.id)+numV(totalEnCurso);
  return `<div style="background:rgba(74,19,107,.10);border:1px solid rgba(74,19,107,.3);border-radius:12px;padding:10px 12px;margin-bottom:10px;font-size:12.5px;font-weight:700;color:#a89fff">📦 Llevás ${fp(llevas)} en paquetes esta quincena</div>`;
}
function comPaqQuincena(recId){ const qk=quincenaKey(hoyStr()); return paquetesSt.list.filter(p=>p.vendedorId===recId&&quincenaKey(p.fecha)===qk).reduce((s,p)=>s+comRecPaquete(p),0); }
function pctPaquete(n){ let p=0; (promos.paquetes||[]).forEach(s=>{ if(n>=s.n) p=s.pct; }); return p; }
function abrirVentaPaquete(cid){
  ventaSel={tipo:'paq',cid:cid||null,clienteQ:'',medio:'efectivo',sel:[],rubroAbierto:null,modo:cid?'asignar':''};
  renderVentaPaquete(); openModal('modal-registro');
}
// Herramienta de venta para el profesional: armarle a mano el paquete de la PROXIMA visita, con el cliente todavia sentado
// (no es un paso del cobro de hoy). Arranca preguntando que se le hizo hoy para sugerir con que combinarlo, usando
// "sugiere" (Admin -> Catalogo -> Servicios) — si todavia no hay nada cargado ahi, arranca vacio y se arma a mano igual.
let ppvHoy=[];
function abrirPaqueteProximaVisita(){ ppvHoy=[]; renderPaqueteProximaVisita(); openModal('modal-registro'); }
function ppvToggleHoy(id){ const i=ppvHoy.indexOf(id); if(i>=0) ppvHoy.splice(i,1); else ppvHoy.push(id); renderPaqueteProximaVisita(); }
function ppvSugeridos(){
  const out=new Set();
  ppvHoy.forEach(id=>{ const s=servicios.find(x=>x.id===id); (s&&s.sugiere||[]).forEach(sid=>{ if(servicios.find(x=>x.id===sid)) out.add(sid); }); });
  return out;
}
function renderPaqueteProximaVisita(){
  const vis=serviciosVisibles(), color=(profile&&profile.color)||'#4A136B';
  const pill=(s)=>`<button onclick="ppvToggleHoy('${s.id}')" style="${pillStyle(ppvHoy.includes(s.id),color)}">${escH(s.nombre)}</button>`;
  const nSug=ppvSugeridos().size;
  document.getElementById('registro-content').innerHTML=cabeceraModal('🎁 Paquete para la próxima visita')+
    `<div style="font-size:12.5px;color:var(--muted2);margin-bottom:12px">Mostrale el beneficio ahí en el momento: elegí qué le hiciste hoy y te armamos una propuesta para su próxima visita, ya con el descuento calculado.</div>
    <div style="font-size:12px;font-weight:800;margin-bottom:8px">¿Qué le hiciste hoy?</div>
    <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:16px">${vis.length?vis.map(pill).join(''):'<div style="font-size:12px;color:var(--muted)">No hay servicios cargados para tu rubro.</div>'}</div>
    <button class="btn btn-primary" style="background:${color}" onclick="ppvContinuar()">${nSug?'Ver propuesta sugerida ('+nSug+') →':'Armar el paquete →'}</button>
    ${nSug?`<button class="lnk" style="margin-top:8px;display:block;text-align:center" onclick="ppvSaltar()">Prefiero elegir yo los servicios</button>`:''}`;
}
function ppvContinuar(){
  ventaSel={tipo:'paq',cid:null,clienteQ:'',medio:'efectivo',sel:[...ppvSugeridos()],rubroAbierto:null,modo:'',proximaVisita:true};
  renderVentaPaquete();
}
function ppvSaltar(){
  ventaSel={tipo:'paq',cid:null,clienteQ:'',medio:'efectivo',sel:[],rubroAbierto:null,modo:'',proximaVisita:true};
  renderVentaPaquete();
}
function compartirPaqueteWhatsApp(){
  const s=ventaSel; if(!s) return;
  const items=s.sel.map(id=>servicios.find(x=>x.id===id)).filter(Boolean);
  if(items.length<2){ showToast('Elegí al menos 2 servicios'); return; }
  const c=s.cid?clienteDe(s.cid):null;
  const ctx=ctxCobro(c);
  const R=calcPaqueteItems(items,c,ctx,s.medio==='efectivo');
  const lineas=R.items.map(x=>'• '+x.svc.nombre+': '+fp(x.final)).join('\n');
  const txt=(s.proximaVisita?'🎁 Para tu próxima visita a Inda Studio:\n':'🎁 Arma tu combo en Inda Studio:\n')+lineas+'\n\nTotal: '+fp(R.total)+' (antes '+fp(R.lista)+', ahorrás '+fp(R.lista-R.total)+')\n\n¿Te copa? Coordinamos cuando quieras 💈';
  window.open('https://api.whatsapp.com/send?text='+encodeURIComponent(txt),'_blank');
}
// Entrada directa (hub del profesional, inicio de recepcion): arma el paquete y ve el total primero, el cliente se elige despues
function abrirArmarPaquete(){ abrirVentaPaquete(); }
function ventaToggleSvc(id){ const s=ventaSel; if(!s) return; const i=s.sel.indexOf(id); if(i>=0) s.sel.splice(i,1); else s.sel.push(id); renderVentaPaquete(); }
function ventaAbrirRubro(rid){ const s=ventaSel; if(!s) return; s.rubroAbierto=s.rubroAbierto===rid?null:rid; renderVentaPaquete(); }
function ventaClienteInput(v){ const s=ventaSel; if(!s) return; s.clienteQ=v; if(s.cid){ const c=clienteDe(s.cid); if(c&&c.nombre!==v) s.cid=null; } ventaRenderClienteSug(); }
function ventaElegirCliente(id){ const s=ventaSel; if(!s) return; const c=clienteDe(id); if(!c) return; s.cid=id; s.clienteQ=c.nombre; renderVentaPaquete(); }
function ventaQuitarCliente(){ const s=ventaSel; if(!s) return; s.cid=null; s.clienteQ=''; renderVentaPaquete(); }
function ventaRenderClienteSug(){
  const s=ventaSel; const el=document.getElementById('vp-cli-sug'); if(!el) return;
  const q=(s.clienteQ||'').trim();
  if(q.length<2){ el.innerHTML=''; return; }
  const m=buscarClientes(q).slice(0,6);
  el.innerHTML=`<div style="display:flex;flex-direction:column;gap:4px;margin-top:6px">${m.map(c=>`<button onclick="ventaElegirCliente('${c.id}')" style="text-align:left;padding:9px 12px;border-radius:10px;border:1.5px solid var(--border2);background:var(--s2);color:var(--text);font-family:var(--font);font-size:13px;font-weight:600;cursor:pointer">${escH(c.nombre)}${(c.tarjetas&&c.tarjetas.length)?' 💳':''}<div style="font-size:11px;color:var(--muted2);font-weight:500">${escH(idCorto(c))}</div></button>`).join('')}
    ${m.length?'':'<div style="font-size:11.5px;color:var(--muted2);padding:6px 2px">No encontramos a nadie. Podés terminar de armar el paquete y elegirlo después.</div>'}</div>`;
}
function vpRenderSucursalPicker(){
  document.getElementById('registro-content').innerHTML=cabeceraModal('Reservar turno 📅')+`
    <div style="font-size:13px;color:var(--muted2);margin-bottom:14px">Elegí la sucursal</div>
    ${sucursales.map(s=>`<div class="card" style="cursor:pointer;margin-bottom:10px;border-left:5px solid ${s.color}" onclick="vpElegirSucursalPublico('${s.id}')"><div style="font-size:17px;font-weight:900">${escH(s.nombre)}</div></div>`).join('')}`;
}
function vpElegirSucursalPublico(id){ ventaSel.sucursal=id; renderVentaPaquete(); }
// Iconos por rubro para la lista de "¿Qué te querés hacer?" de la puerta publica (pedido por Ivo, 28/09/2026,
// a partir de 2 capturas de un diseño que nunca llego a mergearse a ninguna rama -- rehecho de cero acá).
const VP_ICONOS_RUBRO={
  'barberia':'<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><line x1="20" y1="4" x2="8.12" y2="15.88"/><line x1="14.47" y1="14.48" x2="20" y2="20"/><line x1="8.12" y1="8.12" x2="12" y2="12"/></svg>',
  'barberia-premium':'<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2c.6 3.4 2 5.6 5 6.2-3 .6-4.4 2.8-5 6.2-.6-3.4-2-5.6-5-6.2 3-.6 4.4-2.8 5-6.2z"/></svg>',
  'peluqueria':'<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 8c1.5-2 3.5-2 5 0s3.5 2 5 0 3.5-2 5 0 3.5 2 5 0"/><path d="M3 14c1.5-2 3.5-2 5 0s3.5 2 5 0 3.5-2 5 0 3.5 2 5 0"/><path d="M3 20c1.5-2 3.5-2 5 0s3.5 2 5 0 3.5-2 5 0 3.5 2 5 0"/></svg>',
  'cosmetologia':'<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s7-7.5 7-12A7 7 0 0 0 5 10c0 4.5 7 12 7 12z"/><circle cx="12" cy="10" r="2.5"/></svg>',
  'cejas':'<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"/><circle cx="12" cy="12" r="3"/></svg>',
  'podologia':'<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><ellipse cx="12" cy="15" rx="4" ry="6"/><circle cx="9" cy="6" r="1.3"/><circle cx="12" cy="4.5" r="1.3"/><circle cx="15" cy="5.5" r="1.3"/><circle cx="17" cy="8" r="1.1"/></svg>',
  'masajes':'<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="5" r="2.2"/><path d="M12 8v6M8 12c1-1.5 2.5-2 4-2s3 .5 4 2M9 20l3-6 3 6"/></svg>',
  'manos':'<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 13V6a1.5 1.5 0 0 1 3 0v6M11 12V4a1.5 1.5 0 0 1 3 0v8M14 12.5V5.5a1.5 1.5 0 0 1 3 0V13M17 11.5a1.5 1.5 0 0 1 3 0V15c0 4-3 7-7 7h-1c-3 0-4.5-1-6-3l-3-4.5c-.6-1 .3-2.2 1.5-1.7L8 14"/></svg>',
};
function vpIconoRubro(rid){ return VP_ICONOS_RUBRO[rid]||'<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/></svg>'; }
// Filas de ancho completo (no la grilla de pills que usa el staff): una por rubro, con icono, nombre, cantidad
// de servicios, flecha de navegar, y si esta seleccionado (algun servicio suyo ya elegido) borde violeta +
// badge "N elegidos". El badge verde de promo se muestra en cualquier fila que tenga una oferta fija activa.
function vpRubroCardsHtml(rids,grupos,s){
  return `<div style="display:flex;flex-direction:column;gap:8px;margin-bottom:8px">${rids.map(rid=>{
    const n=grupos[rid].filter(x=>s.sel.includes(x.id)).length, sel=n>0;
    const pct=rpMejorFijoRubro(s.sucursal,rid);
    return `<div onclick="ventaAbrirRubro('${rid}')" style="position:relative;display:flex;align-items:center;gap:12px;padding:12px 14px;border-radius:14px;border:1.5px solid ${sel?'#8b5cf6':'var(--border2)'};background:${sel?'rgba(139,92,246,.08)':'var(--s2)'};cursor:pointer">
      <div style="color:${sel?'#8b5cf6':'var(--muted2)'};flex-shrink:0">${vpIconoRubro(rid)}</div>
      <div style="flex:1;min-width:0">
        <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap"><span style="font-size:14.5px;font-weight:800">${escH(nombreRubro(rid)||rid)}</span>${sel?`<span style="font-size:10px;font-weight:800;color:#8b5cf6;background:rgba(139,92,246,.15);padding:2px 7px;border-radius:20px;white-space:nowrap">${n} elegido${n===1?'':'s'}</span>`:''}</div>
        <div style="font-size:11.5px;color:var(--muted2);margin-top:1px">${grupos[rid].length} servicio${grupos[rid].length===1?'':'s'}</div>
      </div>
      ${!sel?'<span style="color:var(--muted);font-size:18px;flex-shrink:0">›</span>':''}
      ${pct?`<span style="position:absolute;top:8px;right:10px;font-size:9.5px;font-weight:800;color:#34d399;background:rgba(52,211,153,.14);padding:2px 7px;border-radius:20px">Hasta ${pct}% off</span>`:''}
    </div>`;
  }).join('')}</div>`;
}
function renderVentaPaquete(){
  const s=ventaSel;
  // Puerta publica: si hay mas de una sucursal, primero hay que elegir cual antes de ver servicios (French
  // solo tiene barberia, ver rpRubrosSucursal) -- el staff nunca pasa por aca, ya opera en la suya.
  if(s.publico&&!s.sucursal&&sucursales.length>1){ vpRenderSucursalPicker(); return; }
  if(s.publico&&!s.sucursal) s.sucursal=(sucursales[0]||{}).id||null;
  // Los 3 pasos del wizard nuevo de horarios reales toman la pantalla completa (staff y publico por igual);
  // el resto de esta funcion (elegir servicios) sigue exactamente igual que siempre.
  if(s.modo==='horario'||s.modo==='horarioConfirmar'||s.modo==='horarioGracias'){
    const titulo=s.modo==='horarioGracias'?'📅 Reserva':(s.modo==='horarioConfirmar'?'📅 Confirmar reserva':'📅 Reservar horarios');
    document.getElementById('registro-content').innerHTML=cabeceraModal(titulo)+'<div id="vp-wizard"></div>';
    const body=document.getElementById('vp-wizard');
    if(s.modo==='horario') vpRenderHorarioWizard(body);
    else if(s.modo==='horarioConfirmar') vpRenderConfirmar(body);
    else vpRenderGracias(body);
    return;
  }
  const c=s.cid?clienteDe(s.cid):null; const color=(profile&&profile.color)||'#4A136B';
  const box=document.querySelector('#modal-registro .modal-box'); const st=box?box.scrollTop:0;
  const items=s.sel.map(id=>servicios.find(x=>x.id===id)).filter(Boolean);
  const ctx=vpCtxCobro(c);
  const R=calcPaqueteItems(items,c,ctx,s.medio==='efectivo');
  // Puerta publica: solo se ven los rubros que ofrece la sucursal elegida (French = solo barbería).
  const rubrosPermitidos=s.publico?rpRubrosSucursal(s.sucursal):null;
  const grupos={}; servicios.forEach(x=>{ if(rubrosPermitidos&&!rubrosPermitidos.includes(x.rubro||'')) return; (grupos[x.rubro||'']=grupos[x.rubro||'']||[]).push(x); });
  const rids=Object.keys(grupos);
  const pill=(x)=>`<button onclick="ventaToggleSvc('${x.id}')" style="${pillStyle(s.sel.includes(x.id),color)}">${escH(x.nombre)} · ${fp(x.precio)}</button>`;
  const escala=(promos.paquetes||[]).map(x=>x.n+(x===promos.paquetes[promos.paquetes.length-1]?'+':'')+' = '+x.pct+'%').join(' · ');
  const rubrosHtml=(s.publico&&rids.length>1)
    ?(s.rubroAbierto&&grupos[s.rubroAbierto]
      ?`<button onclick="ventaAbrirRubro('${s.rubroAbierto}')" class="lnk" style="margin-bottom:10px">‹ Otros rubros</button>
        <div style="font-size:14px;font-weight:800;margin-bottom:10px">${escH(nombreRubro(s.rubroAbierto)||'')}</div>
        <div style="display:flex;flex-wrap:wrap;gap:6px">${grupos[s.rubroAbierto].map(pill).join('')}</div>`
      :vpRubroCardsHtml(rids,grupos,s))
    :rids.length<=1
    ?`<div style="display:flex;flex-wrap:wrap;gap:6px">${(grupos[rids[0]]||[]).map(pill).join('')}</div>`
    :`<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px">${rids.map(rid=>{ const n=grupos[rid].filter(x=>s.sel.includes(x.id)).length; return `<button type="button" onclick="ventaAbrirRubro('${rid}')" style="${pillStyle(s.rubroAbierto===rid,color)}">${escH(nombreRubro(rid)||'Otros')}${n?' ('+n+')':''}</button>`; }).join('')}</div>`
      +(s.rubroAbierto&&grupos[s.rubroAbierto]?`<div style="display:flex;flex-wrap:wrap;gap:6px">${grupos[s.rubroAbierto].map(pill).join('')}</div>`:'<div style="font-size:11.5px;color:var(--muted2)">Tocá un rubro para ver sus servicios.</div>');
  const clienteHtml=c
    ?`<div class="field"><label>Cliente</label><div style="font-size:12.5px;font-weight:700;display:flex;align-items:center;gap:8px">👤 ${escH(c.nombre)} <button class="lnk" onclick="ventaQuitarCliente()">cambiar</button></div></div>`
    :`<div class="field"><label>¿Para qué cliente es?</label><input id="vp-cli" type="text" autocomplete="off" placeholder="Buscá por nombre, teléfono o número..." value="${escH(s.clienteQ||'')}" oninput="ventaClienteInput(this.value)"/><div id="vp-cli-sug"></div></div>`;
  const listo=items.length>=2, hayAlgo=items.length>=1;
  const accionesHtml=!hayAlgo?'<div style="font-size:12px;color:var(--muted);text-align:center;padding:6px 0">Elegí al menos un servicio</div>'
    : s.modo==='asignar' ? `${clienteHtml}
      <div class="field"><label>¿Cómo paga?</label>${htmlMedios('ventaMedio',s.medio,color)}</div>
      <button class="btn btn-ghost" style="margin-bottom:8px" onclick="ventaSel.modo='';renderVentaPaquete()">← Volver</button>
      <button class="btn btn-primary" onclick="confirmarVentaPaquete()" style="background:${color}">${!c?'Elegí un cliente para cobrar':'Cobrar '+fp(R.total)+' y vender'}</button>`
    : `<div style="display:flex;gap:8px;flex-wrap:wrap">
        ${(!s.publico&&listo)?`<button class="btn btn-ghost" style="flex:1;min-width:160px" onclick="compartirPaqueteWhatsApp()">📤 Compartir por WhatsApp</button>`:''}
        ${(!s.publico&&listo)?`<button class="btn btn-primary" style="flex:1;min-width:160px;background:${color}" onclick="ventaSel.modo='asignar';renderVentaPaquete()">👤 Asignar a un cliente</button>`:''}
        <button class="btn btn-primary" style="flex:1;min-width:160px;background:${color}" onclick="vpIniciarHorarios()">📅 Reservar horarios reales</button>
      </div>`;
  document.getElementById('registro-content').innerHTML=cabeceraModal(s.publico?'Reservar turno 📅':(s.proximaVisita?'🎁 Paquete para la próxima visita':'Armar paquete 🎁'))+`
    <div style="font-size:11.5px;color:var(--muted2);margin-bottom:10px">Primero el descuento de cada servicio (como si fuera solo) y recién después el % del paquete: 1 = normal · ${escala}</div>
    ${rubrosHtml}
    <div class="card" style="margin:14px 0 10px">
      ${R.items.map(x=>`<div style="padding:4px 0;border-bottom:1px solid var(--border)"><div style="display:flex;justify-content:space-between;font-size:13px"><span>${escH(x.svc.nombre)}</span><span>${fp(x.lista)}</span></div>${x.descInd?`<div style="display:flex;justify-content:space-between;font-size:11px;color:#34d399"><span>↳ ${escH(x.descInd.label)} (−${Math.round(x.descInd.pct*10)/10}%)</span><span>−${fp(x.descInd.monto)}</span></div>`:''}${x.dq>0?`<div style="display:flex;justify-content:space-between;font-size:11px;color:#4A136B"><span>↳ Descuento del paquete (${R.pct}%)</span><span>−${fp(x.dq)}</span></div>`:''}<div style="display:flex;justify-content:space-between;font-size:12.5px;font-weight:700"><span>Queda en</span><span>${fp(x.final)}${x.descPct>0?' ('+x.descPct+'% off en total)':''}</span></div></div>`).join('')||'<div style="font-size:12px;color:var(--muted)">Elegí los servicios del paquete.</div>'}
      ${items.length?`<div style="display:flex;justify-content:space-between;align-items:baseline;margin-top:8px;padding-top:8px;border-top:1.5px solid var(--border2)"><span style="font-size:13px;font-weight:700">TOTAL</span><span style="font-size:22px;font-weight:900">${fp(R.total)}</span></div><div style="font-size:11px;color:var(--muted2)">Precio de lista ${fp(R.lista)} · ahorra ${fp(R.lista-R.total)} en total${!c&&items.length>=2?' · el total puede cambiar un poco al asignarlo a un cliente (tarjeta, referidos)':''}</div>`:''}
    </div>
    ${progresoPaqSinPlata(R.total)}
    ${accionesHtml}`;
  if(box) box.scrollTop=st;
  ventaRenderClienteSug();
}
async function confirmarVentaPaquete(){
  const s=ventaSel; if(!s||s.ocupado) return;
  const items=s.sel.map(id=>servicios.find(x=>x.id===id)).filter(Boolean);
  if(items.length<2){ showToast('Un paquete necesita al menos 2 servicios'); return; }
  const c=s.cid?clienteDe(s.cid):null;
  if(!c){ showToast('Elegí para qué cliente es'); return; }
  s.ocupado=true;
  const ctx=ctxCobro(c);
  const R=calcPaqueteItems(items,c,ctx,s.medio==='efectivo');
  const ahora=new Date().toISOString();
  await paquetesSt.cambiar(l=>{ l.push({id:'pq'+Date.now().toString(36),clienteId:c.id,clienteNombre:c.nombre,clienteNumero:c.numero,
    items:R.items.map((x,i)=>({id:'i'+i,svcId:x.svc.id,nombre:x.svc.nombre,rubro:x.svc.rubro||'',lista:x.lista,descIndLabel:x.descInd?x.descInd.label:'',descIndMonto:x.descInd?x.descInd.monto:0,final:x.final,descPct:x.descPct,usado:null})),
    pct:R.pct,totalLista:R.lista,total:R.total,medio:s.medio,fecha:hoyStr(),sucursal:sucursalActual(),vendedorId:profile.id,vendedorNombre:profile.name,vendedorRol:profile.role,creadoEn:ahora,upd:ahora,avisado:false}); });
  ventaSel=null; closeModal('modal-registro'); showToast('Paquete vendido ✓ '+fp(R.total)); refreshCurrentView();
}

// ============ COBRO: lo que el cliente ya pagó ============
function prepagosDisponibles(){
  const c=clienteDe(cobro.clienteId); if(!c) return [];
  const rb=rubrosDeUsuario(profile); const out=[];
  const m=membresiaActivaDe(c.id);
  if(m){
    const plan=(promos.membresiaPlanes||[]).find(p=>p.id===m.planId);
    const ids=plan?planServicioIds(plan):[m.servicioId];
    const sv=ids.map(id=>servicios.find(x=>x.id===id)).find(x=>x&&(cobro.servicios||[]).includes(x.id))||ids.map(id=>servicios.find(x=>x.id===id)).find(x=>x&&visiblePorRubro(x,rb));
    if(sv) out.push({kind:'memb',refId:m.id,itemId:m.id,svcId:sv.id,credito:m.valorCredito,nombre:'Membresía · '+sv.nombre+' (quedan '+(m.creditos-m.usos.length)+' de '+m.creditos+')'});
  }
  paquetesAbiertosDe(c.id).forEach(p=>p.items.filter(i=>!i.usado).forEach(i=>{ const sv=servicios.find(x=>x.id===i.svcId); if(sv&&visiblePorRubro(sv,rb)) out.push({kind:'paq',refId:p.id,itemId:i.id,svcId:i.svcId,credito:i.final,descPct:i.descPct,nombre:'Paquete · '+i.nombre}); }));
  return out;
}
function cobroTogglePrepago(kind,refId,itemId){
  const disp=prepagosDisponibles().find(p=>p.kind===kind&&p.refId===refId&&p.itemId===itemId); if(!disp) return;
  cobro.prepagos=cobro.prepagos||[];
  const i=cobro.prepagos.findIndex(p=>p.kind===kind&&p.refId===refId&&p.itemId===itemId);
  if(i>=0) cobro.prepagos.splice(i,1);
  else { cobro.prepagos=cobro.prepagos.filter(p=>p.svcId!==disp.svcId); cobro.prepagos.push(disp); if(!cobro.servicios.includes(disp.svcId)) cobro.servicios.push(disp.svcId); }
  refreshCobro();
}
const REAG_OPC=[['si','✅ Lo reagendé yo'],['no_pregunte','🤐 No le pregunté'],['no_quiso','🙅 Le pregunté y no quiso'],['recepcion','📞 Lo hace recepción']];
function cobroReag(e){ cobro.reag.estado=(cobro.reag.estado===e?'':e); if(e==='si'||e==='recepcion') cobro.reag.motivo=''; renderReagCobro(); }
function cobroReagSiNo(v){ cobro.reag.estado=(cobro.reag.estado===v?'':v); if(cobro.reag.estado!=='si'){ cobro.reagFecha=''; cobro.reagHora=''; } renderReagCobro(); }
function cobroReagAgendar(){
  const cli=clienteDe(cobro.clienteId), profTarget=cobroParaProf||profile;
  agPendingReagendo={
    clienteId:cli?cli.id:null, clienteNombre:cli?cli.nombre:(cobro.cliente||'Cliente'),
    servicios:cobro.servicios.map(id=>{ const s=servicios.find(x=>x.id===id); return s?{svcId:s.id,nombre:s.nombre}:null; }).filter(Boolean),
    profId:profTarget.id, profNombre:profTarget.name,
  };
  agProfFiltro=profTarget.id;
  agState.sucursal=sucursalActual();
  closeModal('modal-registro');
  abrirAgenda(agState.sucursal);
}
function renderReagCobro(){
  const el=document.getElementById('cb-reag'); if(!el) return; const color=profile.color, r=cobro.reag||{estado:'',motivo:''};
  if(cobroParaProf){
    el.innerHTML=`<div style="display:flex;gap:8px">${[['si','✅ Sí'],['no','❌ No']].map(([v,l])=>`<button onclick="cobroReagSiNo('${v}')" style="flex:1;${pillStyle(r.estado===v,color)}">${l}</button>`).join('')}</div>
      ${r.estado==='si'?`<button class="lnk" style="margin-top:8px" onclick="cobroReagAgendar()">${cobro.reagFecha?'📅 '+fechaCortaStr(cobro.reagFecha)+' · '+cobro.reagHora+'hs — cambiar':'📅 Elegir día y hora en la Agenda'}</button>`:''}`;
    return;
  }
  el.innerHTML=`<div style="display:flex;flex-wrap:wrap;gap:6px">${REAG_OPC.map(([v,l])=>`<button onclick="cobroReag('${v}')" style="${pillStyle(r.estado===v,color)}">${l}</button>`).join('')}</div>
    ${(r.estado==='no_pregunte'||r.estado==='no_quiso')?`<input type="text" placeholder="${r.estado==='no_quiso'?'¿Por qué no quiso? (ej: viaja, no sabe su agenda)':'Explicación (opcional)'}" value="${escH(r.motivo||'')}" oninput="cobro.reag.motivo=this.value" style="margin-top:8px"/>`:''}
    ${r.estado===''?'<div style="font-size:11px;color:var(--muted);margin-top:6px">Queda anotado en la ficha del cliente.</div>':''}`;
}
function cobroHora(v){ cobro.hora=v; refreshCobro(); }
// Cuando recepción cobra un turno DIRECTO (no desde la cola de "Cosas por cobrar", donde ya se sabe quién
// lo registró), no había forma de decir quién atendió al cliente — la comisión quedaba atribuida a quien
// estaba logueado cobrando, es decir a la propia recepcionista. Bug real reportado por Ivo (1/10/2026): un
// corte quedó cobrado dos veces, una a nombre de la recepcionista y otra del profesional que lo corrigió.
function renderProfAtendioCobro(){
  const el=document.getElementById('cb-profatendio'); if(!el) return;
  const color=profile.color;
  const profs=allUsers.filter(u=>esProf(u)&&sucursalesDe(u).includes(sucursalActual()));
  el.innerHTML=`<div style="display:flex;flex-wrap:wrap;gap:6px">${profs.map(p=>`<button onclick="cobroElegirProfAtendio('${p.id}')" style="${pillStyle(cobro.profAtendioId===p.id,color)}">${escH(p.name)}</button>`).join('')||'<div style="font-size:12px;color:var(--muted)">No hay profesionales cargados en esta sucursal.</div>'}</div>`;
}
function cobroElegirProfAtendio(id){ cobro.profAtendioId=id; refreshCobro(); }
function renderPrepagoCobro(r){
  const el=document.getElementById('cb-prepago'); if(!el) return;
  const color=profile.color, cli=clienteDe(cobro.clienteId);
  const disp=prepagosDisponibles();
  let h='';
  if(cobroParaProf){
    const paqTxt=cobro.paqueteRubro?'🎁 Le comentó algo de '+escH(nombreRubro(cobro.paqueteRubro)||cobro.paqueteRubro):(cobro.paqueteOfrecidoPrev==='si'?'🎁 Le ofreció un paquete':'🎁 No le ofreció ningún paquete');
    h+=`<div style="font-size:12.5px;margin:-2px 0 10px;color:var(--accent2);font-weight:700">${paqTxt}</div>`;
  }
  if(disp.length) h+=`<div class="field"><label>Lo que el cliente ya pagó</label><div style="display:flex;flex-wrap:wrap;gap:6px">${disp.map(p=>{ const on=(cobro.prepagos||[]).some(x=>x.kind===p.kind&&x.refId===p.refId&&x.itemId===p.itemId); return `<button onclick="cobroTogglePrepago('${p.kind}','${p.refId}','${p.itemId}')" style="${pillStyle(on,'#4A136B')}">${on?'✓ ':''}${escH(p.nombre)}</button>`; }).join('')}</div></div>`;
  // Vender la membresia y usar este mismo corte como uso 1, en un solo paso (se crea recien al guardar el cobro).
  const planesCobro=planesVendiblesEnCobro(cli,cobro.servicios||[]);
  if(planesCobro.length) h+=`<div class="field"><label>¿Compra membresía hoy?</label><div style="display:flex;flex-wrap:wrap;gap:6px">${planesCobro.map(p=>{ const on=cobro.vendeMembPlanId===p.id; return `<button type="button" onclick="cobroVenderMembresia('${p.id}')" style="${pillStyle(on,'#4A136B')}">${on?'✓ ':''}💳 Vender ${escH(p.nombre)} y usar este corte</button>`; }).join('')}</div>${planesCobro.some(p=>p.id===cobro.vendeMembPlanId)?`<div style="font-size:11.5px;color:var(--muted2);margin-top:4px">Cobra solo la membresía (${fp(planesCobro.find(p=>p.id===cobro.vendeMembPlanId).precio)}) — el servicio de hoy queda como uso 1. Lo que sea extra (lavado, toalla, etc.) se cobra aparte a precio de lista.</div>`:''}</div>`;
  if(r.tarj){ const inf=r.tarj; h+=`<div style="font-size:12px;margin:-2px 0 10px;color:#fbbf24;font-weight:700">⭐ Tarjeta: ${inf.regalo?'¡corte de regalo!':`${unidadTarj(inf)} n°${inf.k}${inf.pasoLabel?' · 🎁 '+escH(inf.pasoLabel)+' (sumalo al turno)':(inf.pctFid?' · '+inf.pctFid+'% fidelidad':'')}${inf.pctRef?' · '+inf.pctRef+'% en cupones acumulados':''}`}</div>`; }
  const debeC=cli?saldoDeCliente(cli.id,cli.nombre):0;
  if(debeC>0) h+=`<div style="font-size:12px;margin:-2px 0 10px;color:#f472b6;font-weight:800">⚠️ Este cliente debe ${fp(debeC)} de turnos anteriores.</div>`;
  h+=htmlSenasCobro(r);
  if(r.necesitaElegirDesc){
    const on=(g)=>(r.descGrupoActivo===g);
    h+=`<div class="field"><label>¿Qué descuento le aplicás? (los dos convienen, elegí el que más le sirva)</label><div style="display:flex;gap:6px">
      <button type="button" onclick="elegirDescCobro('tarjeta')" style="${pillStyle(on('tarjeta'),'#fbbf24')};flex:1">⭐ ${escH(r.opcTarjeta.label)} (−${fp(r.opcTarjeta.monto)})</button>
      <button type="button" onclick="elegirDescCobro('dia')" style="${pillStyle(on('dia'),'#34d399')};flex:1">🏷️ ${escH(r.opcDia.label)} (−${fp(r.opcDia.monto)})</button>
    </div></div>`;
  } else if(r.descuentos[0]&&r.descuentos[0].tipo!=='efectivo') h+=`<div style="font-size:12px;margin:-2px 0 10px;color:#34d399;font-weight:700">🏷️ Se aplica un solo descuento, el más alto: ${escH(r.descuentos[0].label)} (−${r.descuentos[0].pct}%).</div>`;
  if(cli){
    const av=sugerenciasPaqSt.list.filter(x=>x.clienteId===cli.id&&!x.atendido);
    if(av.length) h+=av.map(a=>`<div class="card" style="margin:2px 0 10px;border-color:rgba(74,19,107,.4);background:rgba(74,19,107,.06)"><div style="font-size:12px;font-weight:700">${a.tipo==='recordatorio'?'🔔 Nadie le ofreció un combo todavía — ofrecéselo vos':'🎁 Le interesa un combo de '+escH(nombreRubro(a.rubro)||a.rubro)}</div><button class="lnk" onclick="marcarSugerenciaAtendida('${a.id}');refreshCobro()" style="margin-top:4px">✓ Ya se lo ofrecí</button></div>`).join('');
  }
  if(profile.role==='profesional'&&cli&&paquetesEnCobroHabilitados()){
    h+=`<div class="field"><label>🎁 ¿Le ofreciste un paquete?</label><div style="display:flex;gap:8px">${[['si','✅ Sí'],['no','❌ No']].map(([v,l])=>`<button type="button" onclick="cobroPaqueteOfrecido('${v}')" style="flex:1;${pillStyle(cobro.paqueteOfrecido===v,color)}">${l}</button>`).join('')}</div></div>`;
    if(cobro.paqueteOfrecido==='si') h+=`<div class="field"><label>¿Qué combinación le gustaría?</label><div style="display:flex;flex-wrap:wrap;gap:6px">${rubros.map(r2=>`<button type="button" onclick="cobro.paqueteRubro=('${r2.id}'===cobro.paqueteRubro?null:'${r2.id}');refreshCobro()" style="${pillStyle(cobro.paqueteRubro===r2.id,color)}">${escH(r2.nombre)}</button>`).join('')}</div></div>`;
  }
  if(cli&&!cli.yaDejoResena){
    h+=`<div class="field"><label>⭐ ¿Dejó una reseña en Google?</label><div style="display:flex;gap:8px">${[['si','✅ Sí'],['no','❌ No']].map(([v,l])=>`<button type="button" onclick="cobroResena('${v}')" style="flex:1;${pillStyle(cobro.resena===v,color)}">${l}</button>`).join('')}</div></div>`;
    if(cobro.resena==='si') h+=`<div class="field"><label>¿Cómo fue?</label><div style="display:flex;gap:8px">${[['buena','🙂 Buena'],['mala','😞 Mala']].map(([v,l])=>`<button type="button" onclick="cobroResenaSent('${v}')" style="flex:1;${pillStyle(cobro.resenaSent===v,color)}">${l}</button>`).join('')}</div>${cobro.resenaSent==='mala'?'<div style="font-size:11px;color:#f472b6;margin-top:4px">Se le va a avisar al admin para que lo contacte.</div>':''}</div>`;
  }
  el.innerHTML=h;
}
// Pedido de Ivo (3/10/2026): en French los profesionales no arman paquetes desde el cobro. Sin recepcion en
// la sucursal, esas piezas (pregunta de paquete, "paquete para la proxima visita", "armar paquete") no se muestran.
function paquetesEnCobroHabilitados(){ return !(profile&&profile.role==='profesional'&&!sucursalConRecepcion(sucursalActual())); }
function cobroPaqueteOfrecido(v){ cobro.paqueteOfrecido=(cobro.paqueteOfrecido===v?'':v); if(cobro.paqueteOfrecido!=='si') cobro.paqueteRubro=null; refreshCobro(); }
function cobroResena(v){ cobro.resena=(cobro.resena===v?'':v); if(cobro.resena!=='si') cobro.resenaSent=''; refreshCobro(); }
function cobroResenaSent(v){ cobro.resenaSent=(cobro.resenaSent===v?'':v); refreshCobro(); }
function htmlDescuentosCobro(r,row){
  return r.descuentos.map(d=>row(({oferta:'🏷️',efectivo:'💵',fijo:'🏷️',fidelidad:'⭐',referidos:'🤝',regalo:'🎁',cumple:'🎂'}[d.tipo]||'🏷️')+' '+escH(d.label)+' (−'+d.pct+'%)','−'+fp(d.monto),'color:#34d399')).join('')
    +r.prepagos.map(p=>row('✓ '+escH(p.nombre)+' (ya pagado)','−'+fp(p.linea.precio),'color:#4A136B')).join('')
    +(r.senaTotal>0?row('💵 Seña que ya dejó','−'+fp(r.senaTotal),'color:#4A136B'):'');
}

