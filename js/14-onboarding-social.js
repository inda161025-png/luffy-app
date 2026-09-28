// ============ ONBOARDING CHAT ============
let obMessages = []; // {role:'ia'|'user', text:''}
let obStep = 0; // 0-9 preguntas, 10 = procesando resultado
let obRespuestas = [];
let obPerfil = {};

const SISTEMA_ESTRATEGA = `Sos un estratega de contenido extremadamente exigente para profesionales de servicios (barbería/estética/salud/bienestar). Tu trabajo es sacarle un NICHO y PILARES que VENDAN, no frases lindas.

REGLAS OBLIGATORIAS:
1) Cero teoría. Todo accionable.
2) No aceptes nichos genéricos. Bajá a: tipo de cliente + problema + resultado + diferencial.
3) Si la respuesta es vaga, repreguntá y obligá a elegir entre opciones concretas.
4) Sé directo y exigente, pero amigable. Usá español rioplatense informal.
5) UNA PREGUNTA POR VEZ. Esperá la respuesta antes de la siguiente.

Vas a hacer exactamente 10 preguntas para construir el perfil de creador de contenido.

Las preguntas deben cubrir:
Q1) Profesión exacta y 3 servicios principales
Q2) Tipo de cliente ideal (quién, qué edad, qué problema tiene)
Q3) Resultado concreto que logran después de trabajar con vos
Q4) Qué te diferencia de otros que hacen lo mismo
Q5) Mayor miedo o inseguridad de tu cliente antes de reservar
Q6) Por qué alguien te elegiría a vos y no a otro más barato
Q7) Qué querés lograr con las redes (turnos, marca personal, escalar)
Q8) Tu estilo de comunicación (serio, con humor, educativo, cercano)
Q9) Zona y modalidad (local fijo, a domicilio, online)
Q10) Una historia real de transformación de un cliente

Después de las 10 respuestas, generás el resultado completo con este formato exacto:

===RESULTADO===
NICHO: "Soy [profesión] y ayudo a [tipo de cliente] a lograr [resultado] resolviendo [problema] con [servicio/método], en [zona], sin [objeción típica]."

PILARES:
- Pilar 1: [nombre] (TOFU) | Subpilares: a) b) c)
- Pilar 2: [nombre] (MOFU) | Subpilares: a) b) c)  
- Pilar 3: [nombre] (BOFU) | Subpilares: a) b) c)

BANCO DE REELS:
1) Hook: | Body: | CTA:
[hasta 9]

VOZ: [3 palabras que describen cómo habla este creador]
PALABRAS_SI: [5 palabras/frases que usa]
PALABRAS_NO: [5 palabras/frases que evita]
===FIN===`;

async function iniciarOnboarding(perfilBase){
  obMessages = [];
  obRespuestas = [];
  obStep = 0;
  obPerfil = perfilBase || {};
  
  const chat = document.getElementById('ob-chat');
  if(chat) chat.innerHTML = '';
  
  // Update avatar
  const av = document.getElementById('ob-av');
  if(av && obPerfil.emoji){ av.textContent=obPerfil.emoji; av.style.background=obPerfil.color+'33'; av.style.borderColor=obPerfil.color; }
  
  // First message from IA
  await obMensajeIA('¡Hola! Soy tu estratega de contenido. Vamos a construir tu perfil de creador juntos — te voy a hacer 10 preguntas, una por una. Necesito que seas específico, sin vueltas. ¿Empezamos?\n\n**Q1) ¿Cuál es tu profesión exacta y cuáles son los 3 servicios que más hacés?**');
}

function obMensajeIA(texto){
  obMessages.push({role:'ia', text:texto});
  renderObChat();
  return new Promise(r=>setTimeout(r,100));
}

function renderObChat(){
  const chat = document.getElementById('ob-chat');
  if(!chat) return;
  chat.innerHTML = obMessages.map(m=>`
    <div class="ob-msg ${m.role}" ${m.role==='ia'?'style="max-width:90%"':''}>
      ${m.text.replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>').replace(/\n/g,'<br>')}
    </div>`).join('');
  setTimeout(()=>chat.scrollTop=chat.scrollHeight, 50);
}

function mostrarCargando(){
  const chat = document.getElementById('ob-chat');
  if(!chat) return;
  const loading = document.createElement('div');
  loading.className = 'ob-msg loading';
  loading.id = 'ob-loading';
  loading.innerHTML = '<div class="ob-dot"></div><div class="ob-dot"></div><div class="ob-dot"></div>';
  chat.appendChild(loading);
  chat.scrollTop = chat.scrollHeight;
}

function quitarCargando(){
  document.getElementById('ob-loading')?.remove();
}

async function obEnviar(){
  const inp = document.getElementById('ob-inp');
  const texto = inp?.value.trim();
  if(!texto) return;
  inp.value = '';
  inp.style.height = 'auto';

  // Add user message
  obMessages.push({role:'user', text:texto});
  obRespuestas.push(texto);
  obStep++;
  renderObChat();

  // No counter shown - IA decides when it has enough info

  mostrarCargando();

  try {
    const s = await claudeAPI.use('sample');
    if(!s) throw new Error('no sample');

    // Always continue conversation — let IA decide when to generate result
    const historial = obMessages.map(m=>`${m.role==='ia'?'Estratega':'Profesional'}: ${m.text}`).join('\n');
    let prompt;
    if(obStep >= 10){
      prompt = `${SISTEMA_ESTRATEGA}\n\nConversación completa:\n${historial}\n\nYa tenés las 10 respuestas. Si aún necesitás aclarar algo, hacelo. Cuando tengas todo lo necesario, generá el resultado con el formato ===RESULTADO===...===FIN===.`;
    } else {
      prompt = `${SISTEMA_ESTRATEGA}\n\nConversación hasta ahora:\n${historial}\n\nLlevás ${obStep} respuestas. Si la última fue vaga, repreguntá. Si fue clara, avanzá a la siguiente pregunta.`;
    }
    
    const res = await s(prompt, {modelTier:'quick'});
    quitarCargando();
    
    // Check if result is included
    if(res.text.includes('===RESULTADO===')){
      procesarResultado(res.text);
    } else {
      await obMensajeIA(res.text);
    }
  } catch(e) {
    quitarCargando();
    await obMensajeIA('Hubo un error. ¿Podés repetir tu respuesta?');
  }
}

function procesarResultado(texto){
  // Extract structured data
  let nicho='', pilares=[], reels=[], voz='', palabrasSi='', palabrasNo='';
  
  try {
    const nichoMatch = texto.match(/NICHO[:\s]+"?([^"\n]+)"?/i);
    if(nichoMatch) nicho = nichoMatch[1].trim();
    
    const vozMatch = texto.match(/VOZ[:\s]+([^\n]+)/i);
    if(vozMatch) voz = vozMatch[1].trim();
    
    const psiMatch = texto.match(/PALABRAS_SI[:\s]+([^\n]+)/i);
    if(psiMatch) palabrasSi = psiMatch[1].trim();
    
    const pnoMatch = texto.match(/PALABRAS_NO[:\s]+([^\n]+)/i);
    if(pnoMatch) palabrasNo = pnoMatch[1].trim();
  } catch(e){}

  // Save to profile
  const pid = obPerfil.id || profile?.id || 'ivo';
  const perfilCompleto = {
    ...obPerfil,
    nicho, voz, palabrasSi, palabrasNo,
    onboardingDone: true,
    onboardingFecha: new Date().toISOString(),
    onboardingRaw: texto,
    respuestas: obRespuestas,
  };
  
  // Save to localStorage
  try { localStorage.setItem('luffy_perfil_'+pid, JSON.stringify(perfilCompleto)); } catch(e){}
  if(DB){ try{ DB.doc('luffy/perfil_'+pid).set(perfilCompleto); }catch(e){} }

  // Update in-memory profile so the hub reflects the new creator profile immediately
  if(profile && profile.id===pid) Object.assign(profile, perfilCompleto);

  // Show result in chat
  const resultHtml = texto
    .replace(/===RESULTADO===/g,'')
    .replace(/===FIN===/g,'')
    .replace(/NICHO:/g,'<h3>🎯 Tu nicho</h3>')
    .replace(/PILARES:/g,'<h3>🏗️ Tus pilares</h3>')
    .replace(/BANCO DE REELS:/g,'<h3>🎬 Banco de reels</h3>')
    .replace(/VOZ:/g,'<h3>🎙️ Tu voz</h3>')
    .replace(/PALABRAS_SI:/g,'<strong>Usás:</strong> ')
    .replace(/PALABRAS_NO:/g,'<strong>Evitás:</strong> ')
    .trim();

  obMessages.push({role:'ia', text:'¡Perfil armado! 🎉 Esto es lo tuyo:'});
  renderObChat();

  setTimeout(()=>{
    const chat = document.getElementById('ob-chat');
    if(!chat) return;
    const resultDiv = document.createElement('div');
    resultDiv.className = 'ob-result';
    resultDiv.innerHTML = resultHtml;
    chat.appendChild(resultDiv);

    const btnDiv = document.createElement('div');
    btnDiv.style.cssText = 'display:flex;flex-direction:column;gap:8px;margin-top:12px';
    btnDiv.innerHTML = `
      <button onclick="terminarOnboarding()" style="width:100%;padding:14px;border-radius:14px;border:none;background:var(--accent);color:#fff;font-family:var(--font);font-size:15px;font-weight:700;cursor:pointer">¡Empezar a crear contenido! →</button>`;
    chat.appendChild(btnDiv);
    chat.scrollTop = chat.scrollHeight;

    // Hide input
    const inputWrap = document.querySelector('.ob-input-wrap');
    if(inputWrap) inputWrap.style.display='none';
  }, 300);
}

function terminarOnboarding(){
  const pid = obPerfil.id || profile?.id;
  if(pid){
    try{ dineroData=JSON.parse(localStorage.getItem('luffy_dinero_'+pid)||'{"turnos":[]}');}catch(e){dineroData={turnos:[]};}
    loadStoriesData();
    loadPuntosData();
  }
  // Show input again for next time
  const inputWrap = document.querySelector('.ob-input-wrap');
  if(inputWrap) inputWrap.style.display='flex';
  showHub();
}

// ============ REPUTACION ============
function getReputacion(userId){
  const data=getPuntos(userId);
  const movs=data.movimientos||[];
  // Base 100, suma pos de reputacion, resta neg de incidentes
  let rep=100;
  movs.forEach(m=>{
    if(m.tipo==='incidente') rep+=m.pts; // pts is negative
    if(m.tipo==='reputacion') rep+=m.pts;
  });
  return Math.max(0,Math.min(100,rep));
}

function getRepColor(rep){
  if(rep>=80) return '#34d399';
  if(rep>=60) return '#fbbf24';
  if(rep>=40) return '#fb923c';
  return '#f472b6';
}

function getRepLabel(rep){
  if(rep>=80) return {label:'Excelente',emoji:'🟢'};
  if(rep>=60) return {label:'Buena',emoji:'🟡'};
  if(rep>=40) return {label:'En riesgo',emoji:'🟠'};
  return {label:'Crítica',emoji:'🔴'};
}

// ============ KANBAN ============
// ============ PERFIL ============
function renderPerfil(){
  const body=document.getElementById('perfil-body');
  const color=profile.color;
  const rep=getReputacion(profile.id);
  const repColor=getRepColor(rep);
  const repInfo=getRepLabel(rep);
  body.innerHTML=`<div style="text-align:center;padding:24px 0">
    <div style="width:80px;height:80px;border-radius:50%;background:${color}33;border:3px solid ${color};display:flex;align-items:center;justify-content:center;font-size:32px;margin:0 auto 12px">${profile.emoji}</div>
    <div style="font-size:22px;font-weight:900;margin-bottom:4px">${profile.name}</div>
    <div style="font-size:13px;color:var(--muted2);margin-bottom:4px">${profile.profesion||ROLES[profile.role]}</div>
    <div style="font-size:11px;font-weight:700;padding:4px 12px;border-radius:20px;background:${color}22;color:${color};display:inline-block">${ROLES[profile.role]}</div>
  </div>
  <div class="card" style="margin-bottom:10px">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
      <div style="font-size:13px;font-weight:700">Reputación</div>
      <div style="font-size:13px;font-weight:800;color:${repColor}">${repInfo.emoji} ${repInfo.label} · ${rep}%</div>
    </div>
    <div class="rep-bar"><div class="rep-fill" style="width:${rep}%;background:${repColor}"></div></div>
    <div style="font-size:11px;color:var(--muted2);margin-top:6px">Arranca en 100 — baja por incidentes</div>
  </div>
  <div class="card" style="margin-bottom:10px">
    <div style="font-size:12px;color:var(--muted2);margin-bottom:12px;font-weight:600">ESTADÍSTICAS</div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;text-align:center">
      <div><div style="font-size:22px;font-weight:900">${reels.filter(r=>r.asignado===profile.name).length}</div><div style="font-size:11px;color:var(--muted2)">Reels</div></div>
      <div><div style="font-size:22px;font-weight:900">${reels.filter(r=>r.asignado===profile.name&&r.stage==='publicado').length}</div><div style="font-size:11px;color:var(--muted2)">Publicados</div></div>
      <div><div style="font-size:22px;font-weight:900">${(dineroData.turnos||[]).length}</div><div style="font-size:11px;color:var(--muted2)">Turnos</div></div>
    </div>
  </div>
  <div onclick="goTo('puntos')" style="background:rgba(251,191,36,.08);border:1px solid rgba(251,191,36,.2);border-radius:14px;padding:14px 16px;display:flex;align-items:center;gap:10px;cursor:pointer">
    <span style="font-size:24px">🏆</span>
    <div style="flex:1"><div style="font-size:14px;font-weight:700">Mis puntos</div><div style="font-size:11px;color:var(--muted2)">Ver ranking y canjear</div></div>
    <div style="font-size:18px;font-weight:900;color:#fbbf24">⭐${getPuntos(profile.id).total||0}</div>
  </div>
  ${profile.role==='profesional'?`<div class="card" style="margin-top:10px;display:flex;align-items:center;gap:10px"><span style="font-size:22px">🏷️</span><div style="flex:1"><div style="font-size:14px;font-weight:700">Mis rubros</div><div style="font-size:11px;color:var(--muted2)">${(profile.rubros&&profile.rubros.length)?escH(profile.rubros.map(nombreRubro).filter(Boolean).join(', ')):'Sin elegir: ves todos los servicios'}</div></div><button onclick="abrirRubrosProf('${profile.id}')" style="padding:8px 14px;border-radius:10px;border:1.5px solid var(--border2);background:transparent;color:var(--muted2);font-family:var(--font);font-size:12px;font-weight:700;cursor:pointer">Cambiar</button></div>`:''}
  <div class="card" style="margin-top:10px;display:flex;align-items:center;gap:10px"><span style="font-size:22px">🔑</span><div style="flex:1"><div style="font-size:14px;font-weight:700">Contraseña</div><div style="font-size:11px;color:var(--muted2)">Cambiala cuando quieras</div></div><button onclick="cambiarMiPassword()" style="padding:8px 14px;border-radius:10px;border:1.5px solid var(--border2);background:transparent;color:var(--muted2);font-family:var(--font);font-size:12px;font-weight:700;cursor:pointer">Cambiar</button></div>
  ${profile.passReset?`<div class="card" style="margin-top:10px;border:1.5px solid #fbbf24;background:rgba(251,191,36,.08)"><div style="display:flex;align-items:center;gap:10px"><span style="font-size:22px">🔓</span><div style="flex:1"><div style="font-size:13px;font-weight:800;color:#fbbf24">El admin te habilitó a cambiar tu contraseña</div><div style="font-size:11px;color:var(--muted2)">No hace falta que sepas la anterior. Se cierra solo apenas la definas.</div></div></div><button class="btn btn-primary" onclick="definirNuevaPasswordHabilitada()" style="margin-top:10px;width:100%">Definir nueva contraseña</button></div>`:''}
  <div id="perfil-contenido">${getPerfilCreadorHTML(color)}</div>
  ${getHorarioHTML(color)}`;
}

let perfilCreadorEditando = false;

function taCss(){ return 'width:100%;background:var(--s2);border:1.5px solid var(--border2);border-radius:10px;padding:10px;color:var(--text);font-family:var(--font);font-size:13px;line-height:1.5;resize:vertical;outline:none'; }

function getPerfilCreadorHTML(color){
  try {
    const ep=JSON.parse(localStorage.getItem('luffy_perfil_'+profile.id)||'null');
    if(perfilCreadorEditando){
      const b=ep||{};
      return `<div style="background:var(--s1);border:1px solid var(--border);border-radius:14px;padding:16px;margin-top:10px">
        <div style="font-size:13px;font-weight:700;margin-bottom:12px">🎯 Editar perfil de creador</div>
        <div style="margin-bottom:10px"><div style="font-size:10px;font-weight:700;color:${color};margin-bottom:4px">NICHO</div><textarea id="pc-nicho" rows="3" style="${taCss()}">${b.nicho||''}</textarea></div>
        <div style="margin-bottom:10px"><div style="font-size:10px;font-weight:700;color:${color};margin-bottom:4px">VOZ</div><textarea id="pc-voz" rows="2" style="${taCss()}">${b.voz||''}</textarea></div>
        <div style="margin-bottom:10px"><div style="font-size:10px;font-weight:700;color:#34d399;margin-bottom:4px">USÁS</div><textarea id="pc-si" rows="2" style="${taCss()}">${b.palabrasSi||''}</textarea></div>
        <div style="margin-bottom:12px"><div style="font-size:10px;font-weight:700;color:#f472b6;margin-bottom:4px">EVITÁS</div><textarea id="pc-no" rows="2" style="${taCss()}">${b.palabrasNo||''}</textarea></div>
        <div style="display:flex;gap:8px">
          <button onclick="cancelarEdicionPerfil()" style="flex:1;padding:12px;border-radius:10px;border:1.5px solid var(--border2);background:transparent;color:var(--muted2);font-family:var(--font);font-size:13px;font-weight:700;cursor:pointer">Cancelar</button>
          <button onclick="guardarPerfilCreadorManual()" style="flex:1;padding:12px;border-radius:10px;border:none;background:${color};color:#fff;font-family:var(--font);font-size:13px;font-weight:700;cursor:pointer">Guardar</button>
        </div>
      </div>`;
    }
    if(!ep||!ep.onboardingDone) return '<div style="background:'+color+'14;border:1.5px solid '+color+'44;border-radius:16px;padding:18px;margin-top:10px"><div style="font-size:28px;margin-bottom:6px">🎬</div><div style="font-size:16px;font-weight:900;margin-bottom:6px">Contenido</div><div style="font-size:13px;line-height:1.6;color:var(--muted2);margin-bottom:14px">¡Bienvenido/a a nuestro onboarding de contenido! Con 10 preguntas (unos 5 minutos) definimos tu <b style="color:var(--text)">nicho, tu voz y tus pilares</b>. Así la IA te arma ideas de reels que suenan a vos y no genéricas.</div><button onclick="reHacerOnboarding()" style="width:100%;padding:13px;border-radius:12px;border:none;background:'+color+';color:#fff;font-family:var(--font);font-size:14px;font-weight:800;cursor:pointer">Empezar onboarding →</button></div>';
    return '<div style="background:var(--s1);border:1px solid var(--border);border-radius:14px;padding:16px;margin-top:10px">'
      +'<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px"><div style="font-size:13px;font-weight:700">🎬 Contenido · tu perfil de creador</div><div style="display:flex;gap:12px"><button onclick="empezarEdicionPerfil()" style="background:none;border:none;color:var(--muted2);font-family:var(--font);font-size:11px;font-weight:600;cursor:pointer">Editar</button><button onclick="reHacerOnboarding()" style="background:none;border:none;color:var(--muted2);font-family:var(--font);font-size:11px;font-weight:600;cursor:pointer">Rehacer con IA →</button></div></div>'
      +(ep.nicho?'<div style="margin-bottom:8px"><div style="font-size:10px;font-weight:700;color:'+color+'">NICHO</div><div style="font-size:12px">'+ep.nicho+'</div></div>':'')
      +(ep.voz?'<div style="margin-bottom:4px"><div style="font-size:10px;font-weight:700;color:'+color+'">VOZ</div><div style="font-size:11px;color:var(--muted2)">'+ep.voz+'</div></div>':'')
      +(ep.palabrasSi?'<div style="margin-bottom:4px"><div style="font-size:10px;font-weight:700;color:#34d399">Usás</div><div style="font-size:11px;color:var(--muted2)">'+ep.palabrasSi+'</div></div>':'')
      +(ep.palabrasNo?'<div><div style="font-size:10px;font-weight:700;color:#f472b6">Evitás</div><div style="font-size:11px;color:var(--muted2)">'+ep.palabrasNo+'</div></div>':'')
      +'</div>';
  } catch(e){ return ''; }
}

function empezarEdicionPerfil(){ perfilCreadorEditando=true; renderPerfil(); }
function cancelarEdicionPerfil(){ perfilCreadorEditando=false; renderPerfil(); }

function guardarPerfilCreadorManual(){
  const nicho=document.getElementById('pc-nicho')?.value.trim()||'';
  const voz=document.getElementById('pc-voz')?.value.trim()||'';
  const palabrasSi=document.getElementById('pc-si')?.value.trim()||'';
  const palabrasNo=document.getElementById('pc-no')?.value.trim()||'';
  let ep={};
  try{ ep=JSON.parse(localStorage.getItem('luffy_perfil_'+profile.id)||'null')||{}; }catch(e){}
  const actualizado={...ep, id:profile.id, nicho, voz, palabrasSi, palabrasNo, onboardingDone:true};
  try{ localStorage.setItem('luffy_perfil_'+profile.id, JSON.stringify(actualizado)); }catch(e){}
  if(DB){ try{ DB.doc('luffy/perfil_'+profile.id).set(actualizado); }catch(e){} }
  Object.assign(profile, actualizado);
  perfilCreadorEditando=false;
  showToast('Perfil actualizado ✓');
  renderPerfil();
}

function getHorarioHTML(color){
  if(profile.role!=='profesional') return '';
  if(horarioEditando){
    return `<div style="background:var(--s1);border:1px solid var(--border);border-radius:14px;padding:16px;margin-top:10px">
      <div style="font-size:13px;font-weight:700;margin-bottom:12px">🕒 Editar mi horario</div>
      ${DIAS_SEMANA.map(d=>{
        const h=horarioData[d.key]||{activo:false,inicio:'10:00',fin:'20:00'};
        return `<div style="display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid var(--border)">
          <label style="display:flex;align-items:center;gap:6px;width:92px;font-size:12px;font-weight:600;flex-shrink:0">
            <input type="checkbox" id="h-activo-${d.key}" ${h.activo?'checked':''} onchange="toggleHorarioDia('${d.key}')"/> ${d.label}
          </label>
          <input type="time" id="h-inicio-${d.key}" value="${h.inicio}" ${h.activo?'':'disabled'} style="flex:1;min-width:0;background:var(--s2);border:1.5px solid var(--border2);border-radius:8px;padding:6px;color:var(--text);font-family:var(--font);font-size:12px"/>
          <span style="font-size:11px;color:var(--muted2)">a</span>
          <input type="time" id="h-fin-${d.key}" value="${h.fin}" ${h.activo?'':'disabled'} style="flex:1;min-width:0;background:var(--s2);border:1.5px solid var(--border2);border-radius:8px;padding:6px;color:var(--text);font-family:var(--font);font-size:12px"/>
        </div>`;
      }).join('')}
      <div style="display:flex;gap:8px;margin-top:14px">
        <button onclick="cancelarEdicionHorario()" style="flex:1;padding:12px;border-radius:10px;border:1.5px solid var(--border2);background:transparent;color:var(--muted2);font-family:var(--font);font-size:13px;font-weight:700;cursor:pointer">Cancelar</button>
        <button onclick="guardarHorarioManual()" style="flex:1;padding:12px;border-radius:10px;border:none;background:${color};color:#fff;font-family:var(--font);font-size:13px;font-weight:700;cursor:pointer">Guardar</button>
      </div>
    </div>`;
  }
  const activos=DIAS_SEMANA.filter(d=>horarioData[d.key]?.activo);
  return `<div style="background:var(--s1);border:1px solid var(--border);border-radius:14px;padding:16px;margin-top:10px">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px"><div style="font-size:13px;font-weight:700">🕒 Mi horario laboral</div><button onclick="empezarEdicionHorario()" style="background:none;border:none;color:var(--muted2);font-family:var(--font);font-size:11px;font-weight:600;cursor:pointer">Editar</button></div>
    ${activos.length?activos.map(d=>`<div style="display:flex;justify-content:space-between;font-size:12px;padding:4px 0"><span>${d.label}</span><span style="color:var(--muted2)">${horarioData[d.key].inicio} – ${horarioData[d.key].fin}</span></div>`).join(''):'<div style="font-size:12px;color:var(--muted);text-align:center;padding:8px">Sin días cargados</div>'}
  </div>`;
}

function toggleHorarioDia(key){
  const chk=document.getElementById('h-activo-'+key);
  const ini=document.getElementById('h-inicio-'+key);
  const fin=document.getElementById('h-fin-'+key);
  if(ini) ini.disabled=!chk.checked;
  if(fin) fin.disabled=!chk.checked;
}

function empezarEdicionHorario(){ horarioEditando=true; renderPerfil(); }
function cancelarEdicionHorario(){ horarioEditando=false; renderPerfil(); }

function guardarHorarioManual(){
  const nuevo={};
  DIAS_SEMANA.forEach(d=>{
    const activo=document.getElementById('h-activo-'+d.key)?.checked||false;
    const inicio=document.getElementById('h-inicio-'+d.key)?.value||'10:00';
    const fin=document.getElementById('h-fin-'+d.key)?.value||'20:00';
    nuevo[d.key]={activo,inicio,fin};
  });
  horarioData=nuevo;
  saveHorario();
  horarioEditando=false;
  showToast('Horario guardado ✓');
  renderPerfil();
}

function salirOnboarding(){ goTo(profile&&profile.role==="profesional"?"perfil":"hub"); }
function reHacerOnboarding(){
  show('onboarding');
  document.getElementById('nav').style.display='none';
  const iw=document.querySelector('.ob-input-wrap');
  if(iw) iw.style.display='flex';
  iniciarOnboarding(profile);
}

// ============ STORIES ============
function renderStories(){
  if(profile&&profile.role==='recepcionista') return renderStoriesRec();
  loadStoriesData();
  const body = document.getElementById('stories-body');
  const color = profile.color;
  const today = new Date();
  const dias = Array.from({length:4},(_,i)=>{const d=new Date(today);d.setDate(today.getDate()+i);return d;});
  const diasSemana = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];

  body.innerHTML = dias.map(d => {
    const dateStr = ymdLocal(d);
    const esHoy = dateStr === ymdLocal(today);
    const dLabel = esHoy ? 'HOY' : diasSemana[d.getDay()]+' '+d.getDate()+'/'+String(d.getMonth()+1).padStart(2,'0');
    const doneDia = STORY_TIPOS.filter(t=>storiesData?.[dateStr]?.[profile.id]?.[t.id]?.done).length;

    return `<div style="margin-bottom:20px">
      <div style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.1em;color:${esHoy?color:'var(--muted)'};margin-bottom:10px;display:flex;align-items:center;gap:8px">
        ${dLabel} · ${doneDia}/${STORY_TIPOS.length}
        ${esHoy?`<div style="display:flex;gap:3px">${STORY_TIPOS.map((_,i)=>`<span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:${i<doneDia?'#34d399':'var(--border2)'}"></span>`).join('')}</div>`:''}
      </div>
      ${STORY_TIPOS.map((tipo,i) => {
        const check = storiesData?.[dateStr]?.[profile.id]?.[tipo.id] || {done:false};
        const texto = check.customText || STORY_TEXTOS[tipo.id] || '';
        return `<div class="story-card ${check.done?'done':''}" id="sc-${dateStr}-${tipo.id}">
          <div class="story-top">
            <div class="story-num" style="background:${color}">${i+1}</div>
            <div class="story-tipo"><strong>${tipo.emoji} ${tipo.label}</strong><span>${tipo.ref}${storyHorarios[tipo.id]?' · Sugerido '+storyHorarios[tipo.id]+'hs':''}</span></div>
            <div class="story-check ${check.done?'done':''}" onclick="toggleStory('${dateStr}','${tipo.id}','${esHoy}')">
              ${check.done?'✓':''}
            </div>
          </div>
          <div class="story-texto">${texto.replace(/\n/g,'<br>')}
            <button class="story-copy" onclick="copyText(\`${texto.replace(/`/g,'\`')}\`)">Copiar</button>
          </div>
        </div>`;
      }).join('')}
    </div>`;
  }).join('');
}

function toggleStory(dateStr, tipoId, esHoy){
  if(!storiesData[dateStr]) storiesData[dateStr]={};
  if(!storiesData[dateStr][profile.id]) storiesData[dateStr][profile.id]={};
  const current = storiesData[dateStr][profile.id][tipoId]||{done:false};
  const nuevoDone = !current.done;
  storiesData[dateStr][profile.id][tipoId] = {
    done: nuevoDone,
    ts: new Date().toISOString(),
    customText: current.customText||'',
  };
  saveStoriesData();

  // Award points if done and today
  if(nuevoDone && esHoy==='true'){
    addPuntos(profile.id,'story',ptsDe('story',5),'Story: '+STORY_TIPOS.find(t=>t.id===tipoId)?.label,'story:'+dateStr+':'+profile.id+':'+tipoId);
    showToast('+'+ptsDe('story',5)+' puntos ⭐');
    // Check if all 4 done today → bonus week check happens server-side
  }
  renderStories();
}

let tareasModalAbierto=false;
function toggleTarea(tareaId){
  const hoy=ymdLocal(new Date());
  if(!tareasData[hoy]) tareasData[hoy]={};
  const current=tareasData[hoy][tareaId]||{done:false};
  tareasData[hoy][tareaId]={done:!current.done, ts:new Date().toISOString(), por:profile.name};
  saveTareasData();
  renderRecepcion();
  if(tareasModalAbierto) abrirTareasCompleto();
}
function abrirTareasCompleto(){
  tareasModalAbierto=true;
  document.getElementById('registro-content').innerHTML=cabeceraModal('📋 Tareas')+htmlTareasRec();
  openModal('modal-registro');
}

function copyText(txt){
  navigator.clipboard?.writeText(txt).then(()=>showToast('Copiado ✓')).catch(()=>{
    const ta=document.createElement('textarea');ta.value=txt;document.body.appendChild(ta);ta.select();document.execCommand('copy');document.body.removeChild(ta);showToast('Copiado ✓');
  });
}

// ============ PUNTOS ============
// Cartel de meritocracia (marca, confirmado 22/09/2026): cerca del ranking/puntos.
function htmlMeritocracia(){
  return '<div style="background:rgba(74,19,107,.08);border:1.5px solid rgba(74,19,107,.33);border-radius:16px;padding:14px 16px;margin-bottom:16px">'
    +'<div style="font-size:13.5px;font-weight:800;font-family:var(--font-title);color:var(--text);line-height:1.35">Sin excusas: lo que hacés se ve, se mide y se paga.</div>'
    +'<div style="font-size:11.5px;color:var(--muted2);margin-top:5px;line-height:1.5">La meritocracia es ley: más puntos, más plata, más lugar en el podio.</div></div>';
}
function renderPuntos(){
  loadPuntosData();
  const body = document.getElementById('puntos-body');
  const myData = getPuntos(profile.id);
  const total = myData.total||0;
  const color = profile.color;
  const ganados = (myData.movimientos||[]).filter(m=>m.pts>0).reduce((s,m)=>s+m.pts,0);
  const canjeados = (myData.movimientos||[]).filter(m=>m.pts<0).reduce((s,m)=>s+Math.abs(m.pts),0);
  const pending = canjesSolicitudes.filter(s=>s.profId===profile.id&&s.estado==='pendiente').length;

  // Ranking
  const ranking = allUsers.filter(p=>esProf(p)).map(p=>({
    ...p, pts: getPuntos(p.id).total||0
  })).sort((a,b)=>b.pts-a.pts);
  const myRank = ranking.findIndex(r=>r.id===profile.id)+1;
  const medals = ['🥇','🥈','🥉'];

  // Next canje they can afford
  const canjeables = canjesData.filter(c=>total>=c.pts);
  const proxCanje = canjesData.filter(c=>total<c.pts).sort((a,b)=>a.pts-b.pts)[0];

  body.innerHTML = `
    <!-- HERO -->
    <div style="position:relative;overflow:hidden;background:${color}12;border:1.5px solid ${color}33;border-radius:24px;padding:28px 20px;text-align:center;margin-bottom:16px">
      <div style="position:absolute;top:-70px;left:50%;transform:translateX(-50%);width:240px;height:200px;background:radial-gradient(closest-side, ${color}55, transparent);pointer-events:none"></div>
      <div style="position:relative;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.12em;color:${color};opacity:.8;margin-bottom:8px">Mis puntos</div>
      <div style="position:relative;font-size:64px;font-weight:900;letter-spacing:-3px;line-height:1;background:linear-gradient(155deg,#fff,${color} 65%);-webkit-background-clip:text;background-clip:text;color:transparent">${total.toLocaleString('es-AR')}</div>
      <div style="position:relative;font-size:13px;color:var(--muted2);margin-top:6px">Puesto ${myRank}° del equipo ${medals[myRank-1]||''}</div>
      ${myRank>1?(()=>{ const arriba=ranking[myRank-2]; const falta=arriba.pts-total; return `<div style="position:relative;display:flex;align-items:center;justify-content:center;gap:6px;font-size:12px;color:var(--muted2);margin-top:8px"><svg width="13" height="13" viewBox="0 0 24 24" fill="${color}"><path d="M12 2c1 3-3 4-3 8a3 3 0 006 0c0-1-.5-2-1-2.5 2 .5 4 3 4 6.5a6 6 0 11-12 0c0-4 2-6 3-8 .5-1.5 2-3.5 3-4z"/></svg>Te falta${falta===1?'':'n'} <b style="color:${color}">${falta} pto${falta===1?'':'s'}</b> para superar a ${escH(arriba.name)}</div>`; })():`<div style="position:relative;font-size:12px;color:#34d399;margin-top:8px;font-weight:700">👑 ¡Estás primero del equipo!</div>`}
      <div style="display:flex;justify-content:center;gap:20px;margin-top:16px;padding-top:16px;border-top:1px solid ${color}22">
        <div style="text-align:center"><div style="font-size:18px;font-weight:900;color:#34d399">+${ganados}</div><div style="font-size:10px;color:var(--muted2);margin-top:2px">Ganados</div></div>
        <div style="width:1px;background:${color}22"></div>
        <div style="text-align:center"><div style="font-size:18px;font-weight:900;color:#f472b6">-${canjeados}</div><div style="font-size:10px;color:var(--muted2);margin-top:2px">Canjeados</div></div>
        <div style="width:1px;background:${color}22"></div>
        <div style="text-align:center"><div style="font-size:18px;font-weight:900;color:var(--muted2)">${(myData.movimientos||[]).length}</div><div style="font-size:10px;color:var(--muted2);margin-top:2px">Acciones</div></div>
      </div>
    </div>

    ${htmlMeritocracia()}
    <!-- PROXIMO CANJE -->
    ${proxCanje?`<div style="background:var(--s1);border:1px solid var(--border);border-radius:16px;padding:14px 16px;margin-bottom:16px">
      <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);margin-bottom:8px">Próximo canje disponible</div>
      <div style="display:flex;align-items:center;gap:10px">
        <div style="font-size:24px">${proxCanje.emoji}</div>
        <div style="flex:1"><div style="font-size:13px;font-weight:700">${proxCanje.label}</div><div style="font-size:11px;color:var(--muted2)">Te faltan ${proxCanje.pts-total} puntos</div></div>
        <div style="text-align:right"><div style="font-size:13px;font-weight:800;color:${color}">⭐${proxCanje.pts}</div></div>
      </div>
      <div style="height:4px;background:var(--border2);border-radius:2px;margin-top:10px;overflow:hidden"><div style="height:100%;width:${Math.min(100,Math.round((total/proxCanje.pts)*100))}%;background:${color};border-radius:2px"></div></div>
      <div style="font-size:10px;color:var(--muted2);text-align:right;margin-top:4px">${Math.min(100,Math.round((total/proxCanje.pts)*100))}%</div>
    </div>`:''}

    <!-- MERCADO -->
    <div class="sec-hdr" style="margin-bottom:12px">
      <span class="sec-title" style="font-size:15px;display:inline-flex;align-items:center;gap:7px"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8h12l1 12H5z"/><path d="M9 8a3 3 0 016 0"/></svg>Mercado de canjes</span>
      ${pending?`<span style="font-size:11px;font-weight:700;padding:3px 10px;border-radius:20px;background:rgba(251,191,36,.2);color:#fbbf24">${pending} pendiente${pending>1?'s':''}</span>`:''}
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:20px">
      ${canjesData.map(c=>{
        const puedo = total >= c.pts;
        return `<div onclick="${puedo?`pedirCanje('${c.id}')`:''}" style="background:${puedo?color+'15':'var(--s1)'};border:1.5px solid ${puedo?color+'33':'var(--border)'};border-radius:18px;padding:16px;cursor:${puedo?'pointer':'default'};transition:all .15s;position:relative;overflow:hidden">
          ${puedo?'':'<div style="position:absolute;inset:0;background:rgba(0,0,0,.3);border-radius:16px;display:flex;align-items:center;justify-content:center"><span style="font-size:18px">🔒</span></div>'}
          <div style="font-size:28px;margin-bottom:8px">${c.emoji}</div>
          <div style="font-size:13px;font-weight:800;margin-bottom:4px;line-height:1.2">${c.label}</div>
          <div style="font-size:14px;font-weight:900;color:${puedo?color:'var(--muted)'}">⭐ ${c.pts}</div>
          ${puedo?`<div style="font-size:10px;font-weight:700;color:${color};margin-top:4px">Tocá para canjear →</div>`:''}
        </div>`;
      }).join('')}
    </div>

    <!-- RANKING -->
    <div class="sec-hdr" style="margin-bottom:12px"><span class="sec-title" style="display:inline-flex;align-items:center;gap:7px"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="10" width="5" height="10" rx="1"/><rect x="9.5" y="5" width="5" height="15" rx="1"/><rect x="16" y="13" width="5" height="7" rx="1"/></svg>Ranking del equipo</span></div>
    ${(()=>{ const medalBg=['linear-gradient(155deg,#FFE59A,#D9A62E)','linear-gradient(155deg,#E7E9EE,#AEB3BE)','linear-gradient(155deg,#E7B487,#B4703A)']; return ranking.map((p,i)=>`<div class="ranking-item" style="${p.id===profile.id?'border-color:'+color+';background:'+color+'08':''}">
      <div class="ranking-pos" style="background:${i<3?medalBg[i]:'var(--s2)'};color:${i<3?'#2a1a05':'var(--muted2)'};font-size:${i<3?'18':'13'}px">${medals[i]||i+1}</div>
      <div class="ranking-av" style="background:${p.color}33;border-color:${p.color}">${p.emoji}</div>
      <div class="ranking-info"><strong>${p.name}${p.id===profile.id?' (vos)':''}</strong><span>${(getPuntos(p.id).movimientos||[]).filter(m=>m.pts>0).length} acciones</span></div>
      <div class="ranking-pts" style="color:${p.color}">⭐ ${p.pts.toLocaleString('es-AR')}</div>
    </div>`).join(''); })()}

    <!-- HISTORIAL -->
    <div class="sec-hdr" style="margin:16px 0 12px"><span class="sec-title">📋 Historial</span></div>
    <div class="card">
      ${!(myData.movimientos||[]).length?
        '<div style="text-align:center;color:var(--muted);font-size:13px;padding:16px">Sin movimientos todavía.<br>¡Subí stories o publicá un reel!</div>':
        (myData.movimientos||[]).slice(0,20).map(m=>`<div class="mov-item">
          <div class="mov-icon">${m.pts>0?'⬆️':'⬇️'}</div>
          <div class="mov-info"><strong>${m.razon}</strong><span>${m.fecha?new Date(m.fecha+'T00:00:00').toLocaleDateString('es-AR',{day:'numeric',month:'short'}):''}</span></div>
          <div class="mov-pts" style="color:${m.pts>0?'#34d399':'#f472b6'};font-weight:800">${m.pts>0?'+':''}${m.pts} pts</div>
        </div>`).join('')
      }
    </div>`;
}

function pedirCanje(canjeId){
  const canje = canjesData.find(c=>c.id===canjeId);
  if(!canje) return;
  const myPts = getPuntos(profile.id).total||0;
  if(myPts < canje.pts){ showToast('No tenés suficientes puntos'); return; }
  canjesSolicitudes.push({
    id:Date.now().toString(),
    profId:profile.id,
    profName:profile.name,
    canjeId:canje.id,
    canjeLabel:canje.label,
    pts:canje.pts,
    estado:'pendiente',
    ts:new Date().toISOString(),
  });
  savePuntosData();
  showToast('Solicitud enviada al admin ✓');
}

