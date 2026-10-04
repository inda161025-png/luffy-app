// ============ GENERADOR ============
const ESTRUCTURAS_REEL=['Lista','Tutorial','Mito vs Verdad','Storytelling','POV','Problema a Solucion','Opinion polemica'];
let lluviaIdeas=[], ideaSel=null, pulirStep=0, pulirAnswers={}, guionStep=0, guionData={};
const PULIR_QS=[
  {id:'tono',q:'¿Cómo la encarás?',opts:['Con humor 😄','Educativo 📚','Emotivo 💜','Polémico 🔥']},
  {id:'duracion',q:'¿Cuánto dura?',opts:['Corto 15-30s','Medio 30-60s','Largo +60s']},
  {id:'sentimiento',q:'¿Qué querés que sienta?',opts:['Identificación','Sorpresa','Motivación','Curiosidad']},
];
const GUION_BLOQUES=[
  {key:'hook',icon:'🎣',label:'Hook',sub:'Primeros 3 segundos'},
  {key:'desarrollo',icon:'📹',label:'Desarrollo',sub:'El cuerpo del reel'},
  {key:'cta',icon:'📣',label:'CTA',sub:'El cierre'},
];

function buildGenHome(){
  setNav('n-hub');
  document.getElementById('gen-back').onclick=()=>goTo('hub');
  document.getElementById('gen-title').textContent='Generador';
  const c=document.getElementById('gen-body');
  const color=profile.color;
  c.innerHTML=`<div style="padding-top:16px">
    <div style="background:${color}15;border:1.5px solid ${color}33;border-radius:20px;padding:20px;margin-bottom:12px;cursor:pointer;display:flex;align-items:center;gap:16px" onclick="buildLluvia()">
      <div style="width:52px;height:52px;border-radius:16px;background:${color}22;display:flex;align-items:center;justify-content:center;font-size:24px;flex-shrink:0">🌧️</div>
      <div style="flex:1"><div style="font-size:16px;font-weight:800;margin-bottom:2px">Lluvia de ideas</div><div style="font-size:12px;color:var(--muted2)">La IA genera ideas basadas en tu perfil</div></div>
      <div style="font-size:20px;color:var(--muted)">›</div>
    </div>
    <div style="background:var(--s1);border:1px solid var(--border);border-radius:16px;padding:16px;margin-bottom:8px;display:flex;align-items:center;gap:12px;cursor:pointer;opacity:.6">
      <div style="font-size:20px">🖼️</div>
      <div><div style="font-size:14px;font-weight:700">Carrusel</div><div style="font-size:12px;color:var(--muted2)">Próximamente</div></div>
    </div>
    <div style="background:rgba(99,255,99,.06);border:1px solid rgba(99,255,99,.15);border-radius:12px;padding:12px 14px;font-size:12px;color:var(--muted2);line-height:1.5">
      💡 <strong style="color:var(--text)">Primera vez generando:</strong> Claude va a pedir permiso. Tocá <strong style="color:#a78bfa">Permitir</strong> y listo — no vuelve a pedir en la sesión.
    </div>
  </div>`;
}

async function buildLluvia(){
  document.getElementById('gen-back').onclick=()=>buildGenHome();
  document.getElementById('gen-title').textContent='Lluvia de ideas';
  const c=document.getElementById('gen-body');
  const color=profile.color;
  c.innerHTML=`<div style="padding-top:16px">
    <div style="margin-bottom:16px"><input class="field input" style="width:100%;background:var(--s2);border:1.5px solid var(--border2);border-radius:12px;padding:12px 14px;color:var(--text);font-family:var(--font);font-size:14px;outline:none" id="lluvia-tema" placeholder="Tema específico... o dejá vacío"/></div>
    <div id="lluvia-wrap"><div style="text-align:center;padding:32px 0"><div class="spinner"></div><div style="font-size:13px;color:var(--muted2)">Generando ideas...</div></div></div>
  </div>`;
  document.getElementById('lluvia-tema').addEventListener('keydown',e=>{if(e.key==='Enter')generarLluvia();});
  await generarLluvia();
}

async function generarLluvia(){
  const tema=document.getElementById('lluvia-tema')?.value.trim()||'';
  const wrap=document.getElementById('lluvia-wrap');
  wrap.innerHTML=`<div style="text-align:center;padding:32px 0"><div class="spinner"></div><div style="font-size:13px;color:var(--muted2)">Generando ideas...</div></div>`;
  
  // Load onboarding profile for context
  let perfilCtx = '';
  try {
    const ep = JSON.parse(localStorage.getItem('luffy_perfil_'+profile.id)||'null');
    if(ep) {
      if(ep.nicho) perfilCtx += 'NICHO: '+ep.nicho+'. ';
      if(ep.voz) perfilCtx += 'VOZ: '+ep.voz+'. ';
      if(ep.palabrasSi) perfilCtx += 'USA: '+ep.palabrasSi+'. ';
      if(ep.palabrasNo) perfilCtx += 'EVITA: '+ep.palabrasNo+'. ';
    }
  } catch(e){}

  const perfilInfo = perfilCtx ? 'PERFIL: '+perfilCtx : '';
  const temaInfo = tema ? 'TEMA: '+tema : '';
  const prompt = 'Genera 5 ideas de reels para '+profile.name+' ('+( profile.profesion||'barbero')+') de barberia/estetica en Argentina. '+perfilInfo+temaInfo+' IMPORTANTE: Solo barberia/estetica, nada de linkedin ni coaching. Devuelve SOLO JSON: {"ideas":[{"emoji":"...","estructura":"Lista|Tutorial|Mito vs Verdad|Storytelling|POV|Problema a Solucion|Opinion polemica","titulo":"...","descripcion":"...","color":"uno de: #4A136B|#f472b6|#34d399|#fbbf24|#60a5fa|#fb923c"}]}';
  try{
    const s=await claudeAPI.use('sample');
    const r=await s(prompt,{modelTier:'quick'});
    const d=JSON.parse(r.text.replace(/```json|```/g,'').trim());
    lluviaIdeas = d.ideas||[];
    wrap.innerHTML = lluviaIdeas.length ? lluviaIdeas.map((idea,i)=>`
      <div class="prof-card" style="cursor:pointer" onclick="seleccionarIdea(${i})">
        <div style="display:flex;align-items:flex-start;gap:12px">
          <div style="font-size:24px">${idea.emoji||'💡'}</div>
          <div style="flex:1">
            <div style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.06em;color:${idea.color||profile.color};margin-bottom:4px">${idea.estructura||''}</div>
            <div style="font-size:14px;font-weight:700;margin-bottom:4px">${idea.titulo||''}</div>
            <div style="font-size:12px;color:var(--muted2)">${idea.descripcion||''}</div>
          </div>
        </div>
      </div>`).join('') : '<div style="text-align:center;color:var(--muted);font-size:13px;padding:24px">No se pudieron generar ideas. Reintentá.</div>';
  }catch(e){
    wrap.innerHTML = '<div style="text-align:center;color:#f472b6;font-size:13px;padding:24px">Error al generar. Reintentá.</div>';
  }
}

function seleccionarIdea(idx){
  ideaSel = {...lluviaIdeas[idx]};
  pulirStep=0; pulirAnswers={};
  buildPulir();
}

function buildPulir(){
  const q=PULIR_QS[pulirStep];
  if(!q){ finalizarPulir(); return; }
  document.getElementById('gen-back').onclick=()=>{ if(pulirStep>0){pulirStep--;buildPulir();}else buildLluvia(); };
  document.getElementById('gen-title').textContent='Afinar idea';
  const color=ideaSel.color||profile.color;
  const c=document.getElementById('gen-body');
  c.innerHTML=`<div style="padding-top:16px">
    <div style="background:${color}15;border:1.5px solid ${color}33;border-radius:16px;padding:14px;margin-bottom:20px">
      <div style="font-size:11px;font-weight:700;color:${color};margin-bottom:4px">${ideaSel.emoji||''} TU IDEA</div>
      <div style="font-size:14px;font-weight:700">${ideaSel.titulo||''}</div>
    </div>
    <div style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);margin-bottom:4px">Paso ${pulirStep+1}/${PULIR_QS.length}</div>
    <div style="font-size:16px;font-weight:800;margin-bottom:16px">${q.q}</div>
    <div style="display:flex;flex-direction:column;gap:10px">
      ${q.opts.map(o=>`<button class="gb-opt" onclick="responderPulir('${q.id}','${o.replace(/'/g,"\\'")}')">${o}</button>`).join('')}
    </div>
  </div>`;
}

function responderPulir(id,val){
  pulirAnswers[id]=val;
  pulirStep++;
  buildPulir();
}

function finalizarPulir(){
  ideaSel.tono=pulirAnswers.tono||'';
  ideaSel.duracion=pulirAnswers.duracion||'';
  ideaSel.sentimiento=pulirAnswers.sentimiento||'';
  guionStep=0; guionData={};
  buildGuionStep();
}

let guionCache={};

async function buildGuionStep(){
  const bloque=GUION_BLOQUES[guionStep];
  if(!bloque){ buildGuionFinal(); return; }
  document.getElementById('gen-back').onclick=()=>{ if(guionStep>0){guionStep--;buildGuionStep();}else buildPulir(); };
  document.getElementById('gen-title').textContent='Guión';
  const color=ideaSel.color||profile.color;
  const c=document.getElementById('gen-body');
  let prev='';
  for(let i=0;i<guionStep;i++){
    const b=GUION_BLOQUES[i];
    prev+=`<div style="background:var(--s2);border-radius:12px;padding:12px 14px;margin-bottom:8px"><div style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:${color};margin-bottom:4px">${b.icon} ${b.label}</div><div style="font-size:13px;line-height:1.5">${guionData[b.key]||''}</div><button onclick="volverGuion(${i})" style="background:none;border:none;color:var(--muted);font-size:11px;cursor:pointer;font-family:var(--font);margin-top:4px">Cambiar</button></div>`;
  }
  c.innerHTML=`<div style="padding-top:12px">${prev}<div class="guion-bloque" style="border-color:${color}33"><div class="gb-hdr"><span class="gb-icon">${bloque.icon}</span><span class="gb-label" style="color:${color}">${bloque.label}</span><span class="gb-paso">${guionStep+1}/3</span></div><div style="font-size:11px;color:var(--muted2);margin-bottom:10px">${bloque.sub}</div><div id="gb-area"><div id="gb-opts"><div class="gb-loading"><div class="spinner" style="width:20px;height:20px;margin-bottom:6px"></div>Generando opciones...</div></div><div style="margin-top:12px;padding-top:12px;border-top:1px solid var(--border)"><div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);margin-bottom:8px">No te convence ninguna</div><div style="display:flex;gap:8px"><input id="gb-feedback" placeholder="¿Qué no te gustó?" style="flex:1;background:var(--s2);border:1.5px solid var(--border2);border-radius:10px;padding:9px 12px;color:var(--text);font-family:var(--font);font-size:13px;outline:none"/><button onclick="regenGuion('${bloque.key}','${color}')" style="padding:0 14px;border-radius:10px;border:none;background:var(--s3);color:var(--muted2);font-family:var(--font);font-size:12px;font-weight:700;cursor:pointer;height:38px">🔄 Nuevas</button></div></div><div style="margin-top:10px"><div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);margin-bottom:8px">O escribí la tuya</div><div class="gb-custom"><input id="gb-custom-inp" placeholder="Tu versión..."/><button onclick="selGuionCustom('${bloque.key}')" style="background:${color}">→</button></div></div></div></div></div>`;
  await genGuionOpts(bloque.key, color);
}

async function genGuionOpts(key, color, feedback){
  const bloque=GUION_BLOQUES.find(b=>b.key===key);
  const ctxParts=[]; if(key!=='hook'){ctxParts.push('Hook: '+guionData.hook);} if(key==='cta'){ctxParts.push('Desarrollo: '+guionData.desarrollo);}
  const ctx=ctxParts.join('. ');
  const instr={hook:'Primeros 2-3 seg para el scroll sin presentacion.',desarrollo:'Cuerpo que fluye del hook sin tecnicismos.',cta:'Cierre breve y accionable.'};
  const parts=['Genera 4 opciones de '+bloque.label+' para reel de '+profile.name+' ('+(profile.profesion||'profesional')+'). Idea: '+ideaSel.titulo+'. Estructura: '+ideaSel.estructura+'. Tono: '+ideaSel.tono+'. Duracion: '+ideaSel.duracion+'.',ctx?'Contexto: '+ctx+'.':'','Instruccion: '+instr[key]+'.',feedback?'FEEDBACK del creador: '+feedback+'. Genera opciones MUY distintas.':'','Devuelve SOLO JSON: {"opciones":["...","...","...","..."]}'];
  const prompt=parts.filter(Boolean).join(' ');
  // Reset feedback and custom inputs
  const fbInp=document.getElementById('gb-feedback');
  const custInp=document.getElementById('gb-custom-inp');
  if(fbInp) fbInp.value='';
  if(custInp) custInp.value='';
  try{
    const s=await claudeAPI.use('sample');
    const r=await s(prompt,{modelTier:'quick'});
    const d=JSON.parse(r.text.replace(/```json|```/g,'').trim());
    const opts=d.opciones||[];
    guionCache[key]=opts;
    const wrap=document.getElementById('gb-opts');
    if(wrap){
      wrap.innerHTML='';
      opts.forEach((o,i)=>{
        const btn=document.createElement('button');
        btn.className='gb-opt';
        btn.style.textAlign='left';
        btn.textContent=o;
        btn.addEventListener('click',()=>seleccionarOpt(key,i));
        wrap.appendChild(btn);
      });
    }
    if(!document.getElementById('gb-feedback')) renderGuionInputs(key,color);
  }catch(e){
    const wrap=document.getElementById('gb-opts');
    if(wrap) wrap.innerHTML='<div style="font-size:12px;color:#f472b6;text-align:center;padding:8px">Error al generar. Reintentá.</div>';
    if(!document.getElementById('gb-feedback')) renderGuionInputs(key,color);
  }
}

async function regenGuion(key,color){
  const feedback=document.getElementById('gb-feedback')?.value.trim()||'variaciones distintas';
  // Show loading — keep area stable
  const optsWrap=document.getElementById('gb-opts');
  if(optsWrap) optsWrap.innerHTML='<div class="gb-loading"><div class="spinner" style="width:20px;height:20px;margin-bottom:6px"></div>Generando nuevas ideas...</div>';
  // Clear feedback input
  const fbInp=document.getElementById('gb-feedback');
  if(fbInp) fbInp.value='';
  await genGuionOpts(key,color,feedback);
}

function renderGuionInputs(key,color){
  const area=document.getElementById('gb-area');
  if(!area) return;
  // Add inputs below opts if not already there
  if(!document.getElementById('gb-feedback')){
    const div=document.createElement('div');
    div.innerHTML='<div style="margin-top:14px"><div style="font-size:11px;color:var(--muted2);margin-bottom:8px;text-align:center">¿No te convence ninguna?</div><div style="display:flex;gap:8px"><input id="gb-feedback" placeholder="Decí qué no te gustó..." style="flex:1;background:var(--s2);border:1.5px solid var(--border2);border-radius:10px;padding:9px 12px;color:var(--text);font-family:var(--font);font-size:13px;outline:none"/><button id="gb-regen-btn" style="padding:0 14px;border-radius:10px;border:none;background:var(--s3);color:var(--muted2);font-family:var(--font);font-size:12px;font-weight:700;cursor:pointer;height:40px">🔄 Nuevas</button></div></div><div style="margin-top:10px;display:flex;gap:8px"><input id="gb-custom-inp" placeholder="O escribí la tuya..." style="flex:1;background:var(--s2);border:1.5px solid var(--border2);border-radius:10px;padding:9px 12px;color:var(--text);font-family:var(--font);font-size:13px;outline:none"/><button id="gb-custom-btn" style="padding:0 14px;border-radius:10px;border:none;color:#fff;font-family:var(--font);font-size:13px;font-weight:700;cursor:pointer;height:40px;background:'+color+'">→</button></div>';
    area.appendChild(div);
    document.getElementById('gb-regen-btn').onclick=()=>regenGuion(key,color);
    document.getElementById('gb-custom-btn').onclick=()=>selGuionCustom(key);
  }
}

function seleccionarOpt(key,idx){
  const opts=guionCache[key]||[];
  const texto=opts[idx]||'';
  if(!texto) return;
  const color=ideaSel.color||profile.color;
  // Replace entire area with edit view — clean, no stale inputs
  const area=document.getElementById('gb-area');
  if(!area) return;
  area.innerHTML=`
    <div style="background:${color}10;border:1.5px solid ${color}33;border-radius:12px;padding:14px;margin-bottom:10px">
      <div style="font-size:10px;font-weight:700;color:${color};margin-bottom:8px;text-transform:uppercase;letter-spacing:.08em">✓ Elegiste — editá si querés</div>
      <textarea id="gb-edit" style="width:100%;background:transparent;border:none;color:var(--text);font-family:var(--font);font-size:13px;line-height:1.6;outline:none;resize:none;min-height:60px" oninput="this.style.height='auto';this.style.height=this.scrollHeight+'px'">${texto}</textarea>
    </div>
    <div style="display:flex;gap:8px">
      <button onclick="volverAOpciones('${key}','${color}')" style="flex:1;padding:12px;border-radius:10px;border:1.5px solid var(--border2);background:transparent;color:var(--muted2);font-family:var(--font);font-size:13px;font-weight:700;cursor:pointer">← Ver opciones</button>
      <button onclick="confirmarOpt('${key}')" style="flex:1;padding:12px;border-radius:10px;border:none;background:${color};color:#fff;font-family:var(--font);font-size:13px;font-weight:700;cursor:pointer">Usar este →</button>
    </div>`;
  setTimeout(()=>{const ta=document.getElementById('gb-edit');if(ta){ta.style.height='auto';ta.style.height=ta.scrollHeight+'px';}},50);
}

function volverAOpciones(key,color){
  const area=document.getElementById('gb-area');
  if(!area) return;
  const opts=guionCache[key]||[];
  // Rebuild opts div
  const optsDiv=document.createElement('div');
  optsDiv.id='gb-opts';
  opts.forEach((o,i)=>{
    const btn=document.createElement('button');
    btn.className='gb-opt';
    btn.style.textAlign='left';
    btn.textContent=o;
    btn.onclick=()=>seleccionarOpt(key,i);
    optsDiv.appendChild(btn);
  });
  area.innerHTML='';
  area.appendChild(optsDiv);
  renderGuionInputs(key,color);
}

function confirmarOpt(key){
  const val=document.getElementById('gb-edit')?.value.trim();
  if(!val){showToast('No puede estar vacío');return;}
  selGuion(key,val);
}

function selGuionCustom(key){
  const val=document.getElementById('gb-custom-inp')?.value.trim();
  selGuion(key,val);
}

function selGuion(key,val){ if(!val?.trim()){showToast('Escribí o elegí una opción');return;} guionData[key]=val.trim(); guionStep++; buildGuionStep(); }
function volverGuion(step){ guionStep=step; for(let i=step;i<GUION_BLOQUES.length;i++) delete guionData[GUION_BLOQUES[i].key]; buildGuionStep(); }

function buildGuionFinal(){
  document.getElementById('gen-title').textContent='Guión listo';
  document.getElementById('gen-back').onclick=()=>{ guionStep=2; buildGuionStep(); };
  const color=ideaSel.color||profile.color;
  const c=document.getElementById('gen-body');
  c.innerHTML=`<div style="padding-top:12px">
    ${GUION_BLOQUES.map(b=>`
    <div class="guion-bloque">
      <div class="gb-hdr"><span class="gb-icon">${b.icon}</span><span class="gb-label" style="color:${color}">${b.label}</span></div>
      <div style="font-size:13px;line-height:1.6;margin-bottom:8px" id="gf-${b.key}">${guionData[b.key]||''}</div>
      <button class="mete-mano-btn" onclick="toggleMM('${b.key}')" style="border-color:${color}44">👋 Mete mano</button>
      <div class="mete-mano-panel" id="mm-${b.key}">
        <div class="mm-chips">${['Más corto','Más directo','Más cercano','Más impacto','Diferente'].map(m=>`<button class="mm-chip" onclick="document.getElementById('mm-inp-${b.key}').value='${m}'">${m}</button>`).join('')}</div>
        <div class="mm-row">
          <input id="mm-inp-${b.key}" placeholder="Ej: más agresivo, con humor..."/>
          <button onclick="ejecutarMM('${b.key}')" style="background:${color}">→</button>
        </div>
        <div class="mm-opts" id="mm-opts-${b.key}"></div>
      </div>
    </div>`).join('')}
    <button class="btn btn-primary" onclick="crearReel()" style="background:${color};margin-bottom:8px">Guardar y editar reel →</button>
    <button class="btn btn-ghost" onclick="buildGenHome()">Volver al inicio</button>
  </div>`;
}

function toggleMM(key){ const p=document.getElementById('mm-'+key); p.classList.toggle('open'); }

async function ejecutarMM(key){
  const inp=document.getElementById('mm-inp-'+key);
  const instruccion=inp?.value.trim();
  if(!instruccion){showToast('Escribí qué querés cambiar');return;}
  const opts=document.getElementById('mm-opts-'+key);
  opts.innerHTML=`<div class="gb-loading">Generando opciones...</div>`;
  const textoActual=document.getElementById('gf-'+key)?.textContent||guionData[key]||'';
  const bloque=GUION_BLOQUES.find(b=>b.key===key);
  const prompt=`Reescribí este ${bloque.label} según la instrucción. Contexto: reel de ${profile.name} sobre "${ideaSel.titulo}".
Texto actual: "${textoActual}"
Instrucción: "${instruccion}"
Guión completo: Hook: ${guionData.hook||''} / Desarrollo: ${guionData.desarrollo||''} / CTA: ${guionData.cta||''}
Devolvé SOLO JSON: {"opciones":["...","...","...","..."]}`;
  try{
    const s=await claudeAPI.use('sample');
    const r=await s(prompt,{modelTier:'quick'});
    const d=JSON.parse(r.text.replace(/\`\`\`json|\`\`\`/g,'').trim());
    opts.innerHTML=(d.opciones||[]).map(o=>`<div class="mm-opt" onclick="aplicarMM('${key}',this)">${o}</div>`).join('');
  }catch(e){ opts.innerHTML=`<div style="font-size:12px;color:#f472b6;padding:8px">Error. Intentá de nuevo.</div>`; }
}

function aplicarMM(key,el){
  const val=el.textContent;
  guionData[key]=val;
  const disp=document.getElementById('gf-'+key);
  if(disp) disp.textContent=val;
  document.getElementById('mm-'+key).classList.remove('open');
  document.getElementById('mm-opts-'+key).innerHTML='';
  document.getElementById('mm-inp-'+key).value='';
  showToast('Aplicado ✓');
}

function crearReel(){
  const reel={
    id:Date.now().toString(),
    titulo:ideaSel.titulo,
    emoji:ideaSel.emoji,
    estructura:ideaSel.estructura,
    color:ideaSel.color,
    descripcion:ideaSel.descripcion,
    tono:ideaSel.tono,
    duracionIdea:ideaSel.duracion,
    sentimiento:ideaSel.sentimiento,
    hook:guionData.hook,
    desarrollo:guionData.desarrollo,
    cta:guionData.cta,
    stage:'guion',
    asignado:profile.name,
    tomas:[],
    creado:new Date().toISOString(),
  };
  reels.unshift(reel);
  saveReels();
  abrirEditor(reel.id);
  showToast('Reel creado ✓');
}

// ============ EDITOR ============
let editReel=null;
const ETAPAS=[
  {key:'guion',     label:'Guión',      color:'#fbbf24'},
  {key:'produccion',label:'Producción', color:'#60a5fa'},
  {key:'edicion',   label:'Edición',    color:'#f472b6'},
  {key:'publicado', label:'Publicado',  color:'#34d399'},
];

function abrirEditor(id){
  editReel=reels.find(r=>r.id===id);
  if(!editReel) return;
  if(!editReel.asignado && profile.role==='profesional'){
    editReel.asignado=profile.name;
    saveReels();
  }
  show('editor');
  document.getElementById('nav').style.display='flex';
  document.getElementById('editor-title').textContent=editReel.titulo||'Reel';
  renderEditor();
}

function renderEditor(){
  const r=editReel;
  const color=r.color||profile.color;
  const etapaIdx=ETAPAS.findIndex(e=>e.key===r.stage);
  const body=document.getElementById('editor-body');

  // Tabs
  const tabs=ETAPAS.map((e,i)=>`<button onclick="cambiarEtapa('${e.key}')" style="flex:1;padding:8px 4px;border-radius:10px;border:none;background:${r.stage===e.key?e.color+'33':'transparent'};color:${r.stage===e.key?e.color:'var(--muted2)'};font-family:var(--font);font-size:10px;font-weight:700;cursor:pointer;white-space:nowrap">${e.label}</button>`).join('');

  let content='';
  if(r.stage==='guion'){
    content=`
      <div class="card" style="border-color:${color}33;background:${color}08;margin-bottom:16px;text-align:center">
        <div style="font-size:32px;margin-bottom:8px">${r.emoji||'🎬'}</div>
        <div style="font-size:17px;font-weight:800;margin-bottom:4px">${r.titulo}</div>
        <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:${color}">${r.estructura||''}</div>
      </div>
      ${bloqueInspo(r)}
      ${[{k:'hook',i:'🎣',l:'Hook'},{k:'desarrollo',i:'📹',l:'Desarrollo'},{k:'cta',i:'📣',l:'CTA'},{k:'descripcion',i:'📝',l:'Descripción para publicar'}].filter(b=>r[b.k]||b.k!=='descripcion').map(b=>`
      <div class="card" style="margin-bottom:10px">
        <div style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:${color};margin-bottom:6px">${b.i} ${b.l}</div>
        <div style="font-size:13px;line-height:1.6;color:var(--text)">${r[b.k]||'—'}</div>
      </div>`).join('')}
      <button class="btn btn-primary" onclick="cambiarEtapa('produccion')" style="background:${color};margin-top:4px">Listo → Producción 🎬</button>`;
  } else if(r.stage==='produccion'){
    const tomas=r.tomas||[];
    content=`
      <div class="sec-hdr"><span class="sec-title">Tomas (${tomas.length})</span><button class="sec-btn" onclick="agregarToma()" style="background:${color}">+ Toma</button></div>
      ${!tomas.length?`<div class="empty"><div class="e-icon">🎬</div><p>Sin tomas.<br>Tocá "+ Toma" o generalas con IA.</p></div><button class="btn btn-ghost" onclick="generarTomas()" style="margin-bottom:12px">✨ Generar con IA</button>`
      :tomas.map((t,i)=>`<div class="card" style="margin-bottom:8px;display:flex;align-items:flex-start;gap:10px">
        <div style="width:28px;height:28px;border-radius:50%;background:${color};display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;color:#fff;flex-shrink:0">${i+1}</div>
        <div style="flex:1"><div style="font-size:12px;font-weight:700;margin-bottom:2px">${t.angulo||'Sin ángulo'} · <span style="color:${color}">${t.tipo==='camara'?'🎥 Cámara':t.tipo==='off'?'🎙 Off':'🤫 Silencio'}</span></div>
        <div style="font-size:12px;color:var(--muted2)">${t.desc||''}</div>
        ${t.dialogo?`<div style="font-size:11px;color:var(--muted);margin-top:4px;font-style:italic">"${t.dialogo}"</div>`:''}
        </div></div>`).join('')}
      ${tomas.length?`<button class="btn btn-primary" onclick="cambiarEtapa('edicion')" style="background:${color};margin-top:8px">Grabado → Edición ✂️</button>`:''}`;
  } else if(r.stage==='edicion'){
    content=`
      <div class="sec-title" style="margin-bottom:12px">Último paso</div>
      <div class="field"><label>Caption / descripción</label><textarea id="ed-caption" placeholder="Texto para la publicación, hashtags...">${r.caption||''}</textarea></div>
      <button class="btn btn-primary" onclick="marcarPublicado()" style="background:#34d399;margin-top:12px">Publicado ✅</button>`;
  } else if(r.stage==='publicado'){
    content=`<div style="text-align:center;padding:40px 20px">
      <div style="font-size:56px;margin-bottom:16px">🎉</div>
      <div style="font-size:22px;font-weight:900;margin-bottom:8px">${r.titulo}</div>
      <div style="font-size:13px;color:var(--muted2);margin-bottom:24px">${r.asignado||''}</div>
      <div style="background:rgba(52,211,153,.1);border:1px solid rgba(52,211,153,.2);border-radius:16px;padding:16px;font-size:13px;color:#34d399">✅ Publicado — cuenta para el tramo de comisión</div>
    </div>`;
  }

  body.innerHTML=`${bannerPlazoEditor(r)}<div style="display:flex;gap:4px;background:var(--s1);border:1px solid var(--border);border-radius:14px;padding:4px;margin-bottom:16px">${tabs}</div>${content}`;
}

function cambiarEtapa(stage){
  if(!editReel) return;
  // Save caption if in edicion
  const cap=document.getElementById('ed-caption');
  if(cap) editReel.caption=cap.value;
  editReel.stage=stage;
  const idx=reels.findIndex(r=>r.id===editReel.id);
  if(idx>-1) reels[idx]=editReel;
  saveReels();
  renderEditor();
}

function guardarReel(){
  if(!editReel) return;
  const i=reels.findIndex(r=>r.id===editReel.id);
  if(i>-1) reels[i]=editReel;
  saveReels();
  showToast('Guardado ✓');
}

async function generarTomas(){
  if(!editReel) return;
  const body=document.getElementById('editor-body');
  const colorActual=editReel.color||profile.color;
  body.innerHTML=`<div style="text-align:center;padding:40px 20px"><div class="spinner"></div><div style="font-size:13px;color:var(--muted2)">Generando tomas...</div></div>`;
  const prompt=`Generá desglose de tomas para este reel:
Hook: "${editReel.hook}" / Desarrollo: "${editReel.desarrollo}" / CTA: "${editReel.cta}"
Creador: ${profile.name} (${profile.profesion||'profesional'})
Máximo 5 tomas. Devolvé SOLO JSON: {"tomas":[{"angulo":"Plano general|Primer plano|Plano medio|Plano detalle|Cenital|Selfie","tipo":"camara|off|silencio","desc":"...","dialogo":"..."}]}`;
  try{
    const s=await claudeAPI.use('sample');
    const r=await s(prompt,{modelTier:'quick'});
    const d=JSON.parse(r.text.replace(/\`\`\`json|\`\`\`/g,'').trim());
    editReel.tomas=d.tomas||[];
    const i=reels.findIndex(r=>r.id===editReel.id);
    if(i>-1) reels[i]=editReel;
    saveReels();
    renderEditor();
  }catch(e){ renderEditor(); showToast('Error generando tomas'); }
}

function agregarToma(){
  if(!editReel.tomas) editReel.tomas=[];
  editReel.tomas.push({angulo:'Plano general',tipo:'camara',desc:'',dialogo:''});
  const i=reels.findIndex(r=>r.id===editReel.id);
  if(i>-1) reels[i]=editReel;
  saveReels();
  renderEditor();
}

// ============ DINERO ============
let dineroTab='trabajo';
let dineroQ=null; // se inicializa a la quincena actual la primera vez que se renderiza
let dineroMesOffset=0; // 0 = mes actual, -1 = mes anterior, etc.

function renderDinero(){
  const body=document.getElementById('dinero-body');
  const color=profile.color;
  const q=dineroQ;
  const now=new Date();
  const r2=now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0');
  const r2end=new Date(now.getFullYear(),now.getMonth()+1,0).getDate();
  body.innerHTML=`
    <div class="dinero-tabs">
      <button class="dt-tab ${dineroTab==='trabajo'?'active':''}" onclick="switchDineroTab('trabajo')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:5px"><path d="M9 7V5a2 2 0 012-2h2a2 2 0 012 2v2M4 7h16l-1 13H5z"/></svg>Trabajo</button>
      <button class="dt-tab ${dineroTab==='yo'?'active':''}" onclick="switchDineroTab('yo')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:5px"><circle cx="12" cy="8" r="3.5"/><path d="M5 20c1.5-4 4-6 7-6s5.5 2 7 6"/></svg>Yo</button>
    </div>
    <div id="dinero-content"></div>`;
  renderDineroContent();
}

function switchDineroTab(tab){ dineroTab=tab; renderDinero(); }

function renderDineroContent(){
  const wrap=document.getElementById('dinero-content');
  if(dineroTab==='trabajo') renderTrabajo(wrap);
  else renderYo(wrap);
}

let dineroVista=null;        // null = resumen | 'turnos' | 'ventas' | 'deudores'
let dineroFiltroMedio='todos';
let dineroExpand=null;       // id del item desplegado en la vista de detalle

function dineroScrollTop(){ const sc=document.getElementById('dinero-body'); if(sc) sc.scrollTop=0; }
function dineroAbrir(vista,medio,expandId){ dineroVista=vista; dineroFiltroMedio=medio||'todos'; dineroExpand=expandId||null; renderDineroContent(); dineroScrollTop(); }
function dineroCerrar(){ dineroVista=null; dineroExpand=null; renderDineroContent(); dineroScrollTop(); }
function dineroFiltro(m){ dineroFiltroMedio=m; dineroExpand=null; renderDineroContent(); }
function dineroToggle(id){ dineroExpand=(dineroExpand===id?null:id); renderDineroContent(); }

function renderTrabajo(wrap){
  const today=new Date();
  if(dineroQ===null) dineroQ = today.getDate()<=15?1:2;
  const q=dineroQ;
  const viewDate=new Date(today.getFullYear(), today.getMonth()+dineroMesOffset, 1);
  const color=profile.color;
  const enElMes = (fechaStr)=>{
    if(!fechaStr) return false;
    const d=new Date(fechaStr+'T00:00:00');
    return d.getMonth()===viewDate.getMonth()&&d.getFullYear()===viewDate.getFullYear()&&(q===1?d.getDate()<=15:d.getDate()>15);
  };
  const porReciente=(a,b)=>new Date(b.creadoEn||b.fecha)-new Date(a.creadoEn||a.fecha);
  const num=(x)=>parseFloat(x)||0;

  const turnos=(dineroData.turnos||[]).filter(t=>enElMes(t.fecha));
  const fact=turnos.reduce((s,t)=>s+num(t.monto),0);
  const reelsQ=reels.filter(r=>r.stage==='publicado'&&r.asignado===profile.name&&r.fecha&&enElMes(r.fecha)).length;
  const fechaQ=viewDate.getFullYear()+'-'+pad2(viewDate.getMonth()+1)+'-'+(q===1?'01':'16');
  let {comision,pct,esOro,tramo,fija,nuevo,tramos,detNuevo}=calcComision(fact,reelsQ,profile,fechaQ);
  const qkVista=quincenaKey(fechaQ);
  const qRes=comisionQuincenaDe(profile,qkVista,dineroData.turnos);
  comision=qRes.normal+qRes.extra;
  const aseg=estadoAsegurado(profile,qkVista,factPorQuincena(dineroData.turnos),comision); const extraAseg=extraAplicable(aseg); comision+=extraAseg;
  const tr=esOro?tramoOro():tramo;
  const nextT=!esOro&&!fija&&!nuevo&&tramo.max!==Infinity&&tramos?tramos[tramos.indexOf(tramo)+1]:null;
  const cfgOro=comCfg().oro;
  const progressPct=(fija||nuevo)?100:(nextT?Math.min(100,(fact/nextT.min)*100):fact>=cfgOro.min?Math.min(100,(reelsQ/cfgOro.reels)*100):100);
  const msgNuevo=nuevo?('🌟 Barbero nuevo: '+detNuevo.n.base+'% base'+(detNuevo.cont?' +'+detNuevo.n.contenido+'% por contenido ✓':' (+'+detNuevo.n.contenido+'% si publicás '+detNuevo.n.reels+' reels)')+(detNuevo.extra?' +'+detNuevo.n.extra+'% por superar '+fpk(detNuevo.n.extraDesde)+' ✓':' (+'+detNuevo.n.extra+'% si superás '+fpk(detNuevo.n.extraDesde)+')')):'';
  const sortedTurnos=[...turnos].sort(porReciente);

  // Ventas de productos: aparte de los cortes, con su propia comision
  const ventas=(dineroData.ventas||[]).filter(v=>enElMes(v.fecha));
  const totalVentas=ventas.reduce((s,v)=>s+num(v.total),0);
  const comisionVentas=ventas.reduce((s,v)=>s+num(v.comision),0);
  const sortedVentas=[...ventas].sort(porReciente);

  // Cobrado por medio de pago (cortes + productos)
  const porMedio=(m)=>turnos.filter(t=>t.medio===m).reduce((s,t)=>s+num(t.aCobrar!=null?t.aCobrar:t.monto),0)+ventas.filter(v=>v.medio===m).reduce((s,v)=>s+num(v.total),0);
  const efect=porMedio('efectivo'), mp=porMedio('mp'), tarjeta=porMedio('tarjeta');

  // Deudores: no suman a la facturacion
  const deudoresPend=(dineroData.deudores||[]).filter(d=>!d.saldado).sort((a,b)=>new Date(a.creadoEn||a.fecha)-new Date(b.creadoEn||b.fecha));
  const deudoresPagadas=(dineroData.deudores||[]).filter(d=>d.saldado&&enElMes(d.fechaPago||(d.anuladaEn?String(d.anuladaEn).slice(0,10):d.fecha))).sort((a,b)=>new Date(b.cobradoEn||b.fecha)-new Date(a.cobradoEn||a.fecha));
  const deudoresTodos=[...deudoresPend,...deudoresPagadas];
  const totalDeuda=deudoresPend.reduce((s,d)=>s+saldoDeuda(d),0);

  // Gastos con el Mercado Pago del local: se descuentan solos de la comisión de la quincena en que se anotaron.
  // Pedido de Ivo (1/10/2026): automático al anotarlo, sin aprobación previa, solo monto + motivo (sin foto).
  const gastosMP=(dineroData.gastosMP||[]).filter(g=>enElMes(g.fecha)).sort(porReciente);
  const totalGastosMP=gastosMP.reduce((s,g)=>s+num(g.monto),0);

  const currentQ=today.getDate()<=15?1:2;
  const esActual = dineroMesOffset===0 && q===currentQ;
  const mesLabel=viewDate.toLocaleDateString('es-AR',{month:'long',year:'numeric'});
  const mesLabelCap=mesLabel.charAt(0).toUpperCase()+mesLabel.slice(1);
  const finMes=new Date(viewDate.getFullYear(),viewDate.getMonth()+1,0).getDate();

  const fechaCorta=(f)=>f?new Date(f+'T00:00:00').toLocaleDateString('es-AR',{day:'numeric',month:'short'}):'';
  const hora=(iso)=>iso?new Date(iso).toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit'}):'';
  const medioColor={efectivo:'#34d399',mp:'#009ee3',tarjeta:'#4A136B'};
  const medioCorto={efectivo:'EFE',mp:'MP',tarjeta:'TAR'};
  const medioLargo={efectivo:'💵 Efectivo',mp:'📱 Mercado Pago',tarjeta:'💳 Tarjeta'};
  const hoyStr=ymdLocal(new Date());
  const cuando=(x)=>x.fecha===hoyStr&&x.creadoEn?' · '+hora(x.creadoEn):(x.fecha?' · '+fechaCorta(x.fecha):'');
  const dline=(a,b,st='')=>`<div style="display:flex;justify-content:space-between;gap:8px;font-size:12px;padding:2px 0;${st}"><span>${a}</span><span style="white-space:nowrap">${b}</span></div>`;

  const card=(lbl,val,sub,col,onclick)=>`<div class="stat-card" ${onclick?`onclick="${onclick}" style="cursor:pointer"`:''}><div class="sc-lbl">${lbl}</div><div class="sc-val" style="font-size:22px;${col?'color:'+col:''}">${val}</div><div class="sc-sub">${sub}</div></div>`;

  const rowTurno=(t,detalle)=>{
    const mc=medioColor[t.medio]||'#888';
    const abierto=detalle&&dineroExpand===t.id;
    const extras=(dineroData.ventas||[]).filter(v=>v.turnoId===t.id);
    const detalleHtml=abierto?`<div style="background:var(--s2);border-radius:10px;padding:10px 12px;margin:-2px 0 8px">
      ${(t.servicios&&t.servicios.length?t.servicios.map(s=>dline(nomSvc(s),fp(s.precio))).join(''):dline(t.servicio||'Servicio',fp(num(t.monto))))}
      ${t.descuento>0?dline(t.descuentoTipo==='oferta'?`🏷️ Oferta ${t.oferta?t.oferta.nombre:''}`:`💵 Efectivo (−${DESC_EFECTIVO_PCT}%)`,'−'+fp(t.descuento),'color:#34d399'):''}
      ${dline('<b>Suma a tu quincena</b>','<b>'+fp(num(t.monto))+'</b>','border-top:1px solid var(--border);margin-top:4px;padding-top:6px')}
      ${extras.map(v=>dline(`📦 ${v.productoNombre} x${v.cantidad}`,fp(v.total)+' · +'+fp(v.comision),'color:var(--muted2)')).join('')}
      <div style="font-size:11px;color:var(--muted2);margin-top:6px">${medioLargo[t.medio]||''} · ${fechaCorta(t.fecha)} ${hora(t.creadoEn)}</div>
      ${t.deudaId?`<div style="font-size:11px;color:#f472b6;margin-top:4px">Estaba en deuda: servicio del ${fechaCorta(t.fechaServicio)}, cobrado el ${fechaCorta(t.fecha)}</div>`:''}
    </div>`:'';
    return `<div class="turno-item" onclick="${detalle?`dineroToggle('${t.id}')`:`dineroAbrir('turnos','todos','${t.id}')`}">
        <div class="ti-dot" style="background:${mc}"></div>
        <div class="ti-info"><strong>${t.cliente||'Cliente'}</strong><span>${t.servicio||''}${cuando(t)}</span></div>
        <div style="text-align:right"><div class="ti-monto">${fp(num(t.monto))}</div><div class="ti-medio" style="background:${mc}22;color:${mc}">${medioCorto[t.medio]||t.medio||''}</div></div>
      </div>${detalleHtml}`;
  };
  const rowVenta=(v,detalle)=>{
    const abierto=detalle&&dineroExpand===v.id;
    const detalleHtml=abierto?`<div style="background:var(--s2);border-radius:10px;padding:10px 12px;margin:-2px 0 8px">
      ${dline(`${v.cantidad} × ${fp(v.precioUnitario||0)}`,fp(v.total))}
      ${dline('<b>Tu comisión</b>','<b>+'+fp(v.comision)+'</b>','color:#4A136B')}
      <div style="font-size:11px;color:var(--muted2);margin-top:6px">${v.cliente?'Cliente: '+v.cliente+' · ':''}${v.medio?(medioLargo[v.medio]||'')+' · ':''}${fechaCorta(v.fecha)} ${hora(v.creadoEn)}</div>
    </div>`:'';
    return `<div class="turno-item" onclick="${detalle?`dineroToggle('${v.id}')`:`dineroAbrir('ventas','todos','${v.id}')`}">
        <div class="ti-dot" style="background:#4A136B"></div>
        <div class="ti-info"><strong>${v.productoNombre}</strong><span>x${v.cantidad}${v.cliente?' · '+v.cliente:''}${cuando(v)}</span></div>
        <div style="text-align:right"><div class="ti-monto">${fp(num(v.total))}</div><div class="ti-medio" style="background:#4A136B22;color:#4A136B">+${fp(num(v.comision))}</div></div>
      </div>${detalleHtml}`;
  };
  const rowDeudor=(d)=>`<div class="turno-item" style="border-color:rgba(244,114,182,.25);cursor:default;${d.saldado?'opacity:.7':''}">
        <div class="ti-dot" style="background:${d.anulada?'var(--muted)':(d.saldado?'#34d399':'#f472b6')}"></div>
        <div class="ti-info"><strong>${escH(d.cliente)}</strong><span>${escH(d.servicio||d.motivo||'')}${d.servicio&&d.motivo?' · '+escH(d.motivo):''} · servicio del ${fechaCorta(d.fecha)}${d.saldado?'':' · hace '+diasDesdeStr(d.fecha)+' d'}</span></div>
        <div style="text-align:right"><div class="ti-monto" style="color:${d.anulada?'var(--muted2)':(d.saldado?'#34d399':'#f472b6')}">${fp(d.saldado?num(d.monto):saldoDeuda(d))}</div>${(!d.saldado&&pagadoDe(d)>0)?`<div style="font-size:10px;color:#34d399;font-weight:700">pagó ${fp(pagadoDe(d))}</div>`:''}${d.saldado?`<div style="font-size:10px;color:${d.anulada?'var(--muted2)':'#34d399'};font-weight:700">${d.anulada?'Anulada':'Cobrado '+fechaCorta(d.fechaPago||d.fecha)+' ✓'}</div>`:(sinRecepcionId(d.sucursal||profile.sucursal)?`<button onclick="abrirCobroDeuda('${profile.id}','${d.id}')" style="background:none;border:none;color:var(--muted2);font-family:var(--font);font-size:10px;font-weight:700;cursor:pointer;text-decoration:underline">Ya pagó</button>`:`<div style="font-size:10px;color:var(--muted2);font-weight:700;max-width:90px;line-height:1.3">La cobra recepción</div>`)}</div>
      </div>`;

  const periodoNav=`
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
      <button onclick="cambiarQuincena(-1)" style="background:var(--s2);border:none;color:var(--text);width:36px;height:36px;border-radius:50%;cursor:pointer;font-size:16px;flex-shrink:0">‹</button>
      <div style="text-align:center">
        <div style="font-size:13px;font-weight:800">${q===1?'1 al 15':'16 al '+finMes} de ${mesLabelCap}</div>
        ${esActual?'<div style="font-size:10px;color:var(--muted2)">Quincena actual</div>':'<div style="font-size:10px;color:var(--muted2)">Histórico</div>'}
      </div>
      <button onclick="cambiarQuincena(1)" ${esActual?'disabled':''} style="background:var(--s2);border:none;color:${esActual?'var(--muted)':'var(--text)'};width:36px;height:36px;border-radius:50%;cursor:${esActual?'default':'pointer'};font-size:16px;opacity:${esActual?'.4':'1'};flex-shrink:0">›</button>
    </div>`;

  // ---------- Vistas de detalle ----------
  if(dineroVista){
    const volver=(titulo,extra='')=>`<div style="display:flex;align-items:center;gap:10px;margin-bottom:14px">
      <button onclick="dineroCerrar()" style="background:var(--s2);border:none;color:var(--text);font-size:16px;width:36px;height:36px;border-radius:50%;cursor:pointer;flex-shrink:0">←</button>
      <div style="font-size:16px;font-weight:800;flex:1">${titulo}</div>${extra}</div>`;
    if(dineroVista==='turnos'){
      const lista=dineroFiltroMedio==='todos'?sortedTurnos:sortedTurnos.filter(t=>t.medio===dineroFiltroMedio);
      const totalLista=lista.reduce((s,t)=>s+num(t.monto),0);
      const chips=[['todos','Todos',sortedTurnos.length],['efectivo','💵 Efectivo',sortedTurnos.filter(t=>t.medio==='efectivo').length],['mp','📱 MP',sortedTurnos.filter(t=>t.medio==='mp').length],['tarjeta','💳 Tarjeta',sortedTurnos.filter(t=>t.medio==='tarjeta').length]];
      wrap.innerHTML=periodoNav+volver('💈 Turnos',`<button class="sec-btn" onclick="abrirRegistroTurno()" style="background:${color}">+ Turno</button>`)+`
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px">${chips.map(([v,l,n])=>`<button onclick="dineroFiltro('${v}')" style="padding:7px 12px;border-radius:20px;border:1.5px solid ${dineroFiltroMedio===v?color:'var(--border2)'};background:${dineroFiltroMedio===v?color+'22':'transparent'};color:${dineroFiltroMedio===v?color:'var(--muted2)'};font-family:var(--font);font-size:12px;font-weight:700;cursor:pointer">${l} (${n})</button>`).join('')}</div>
        <div class="stat-card" style="margin-bottom:12px"><div class="sc-lbl">${lista.length} turnos${dineroFiltroMedio!=='todos'?' · '+(medioLargo[dineroFiltroMedio]||''):''}</div><div class="sc-val">${fp(totalLista)}</div><div class="sc-sub">Tocá un turno para ver el detalle</div></div>
        ${lista.length?lista.map(t=>rowTurno(t,true)).join(''):'<div class="empty"><div class="e-icon">📅</div><p>Sin turnos con este filtro.</p></div>'}`;
      return;
    }
    if(dineroVista==='ventas'){
      wrap.innerHTML=periodoNav+volver('📦 Productos vendidos','<button class="sec-btn" onclick="abrirVentaProducto()" style="background:#4A136B">+ Venta</button>')+`
        <div class="stat-grid">
          ${card('Vendido',fp(totalVentas),sortedVentas.length+' ventas','','')}
          ${card('Tu comisión',fp(comisionVentas),'Aparte de tus cortes','#4A136B','')}
        </div>
        ${sortedVentas.length?sortedVentas.map(v=>rowVenta(v,true)).join(''):'<div class="empty"><div class="e-icon">📦</div><p>Sin ventas de productos este período.</p></div>'}`;
      return;
    }
    if(dineroVista==='senas'){ wrap.innerHTML=periodoNav+volver('💵 Señas','<button class="sec-btn" onclick="abrirFormSena()" style="background:#4A136B">+ Seña</button>')+htmlSenasProf(true); return; }
    wrap.innerHTML=periodoNav+volver('🚫 En rojo — no pagaron','<button class="sec-btn" onclick="abrirCobroDebe()" style="background:#f472b6">+ Turno que debe</button>')+`
      <div class="stat-card" style="margin-bottom:12px;border-color:rgba(244,114,182,.3)"><div class="sc-lbl">Total adeudado</div><div class="sc-val" style="color:#f472b6">${fp(totalDeuda)}</div><div class="sc-sub">${deudoresPend.length} pendientes · suman a la quincena en que paguen</div></div>
      ${deudoresTodos.length?deudoresTodos.map(rowDeudor).join(''):'<div class="empty"><div class="e-icon">✅</div><p>Nadie te debe nada.</p></div>'}`;
    return;
  }

  // ---------- Resumen ----------
  const verTodos=(vista,n,label)=>n>3?`<button onclick="dineroAbrir('${vista}')" style="width:100%;padding:11px;border-radius:12px;border:1.5px solid var(--border2);background:transparent;color:var(--muted2);font-family:var(--font);font-size:12px;font-weight:700;cursor:pointer;margin-bottom:4px">Ver los ${n} ${label} ›</button>`:'';
  wrap.innerHTML=periodoNav+`
    <div style="background:${tr.color}15;border:1.5px solid ${tr.color}30;border-radius:18px;padding:18px;margin-bottom:14px;display:flex;align-items:center;gap:14px">
      <div style="font-size:40px">${tr.emoji}</div>
      <div style="flex:1">
        <div style="font-size:28px;font-weight:900;line-height:1;color:${tr.color}">${tr.pct}%</div>
        <div style="font-size:12px;font-weight:700;color:${tr.color}">${fija?'Comisión fija':(nuevo?'Barbero nuevo':'Tramo '+tr.label)}</div>
        <div style="font-size:11px;color:var(--muted2);margin-top:2px">${fija?'Tu comisión es fija: siempre '+pct+'%':(nuevo?msgNuevo:(nextT?'Faltan '+fp(nextT.min-fact)+' para '+nextT.pct+'%':esOro?'🏆 Tramo máximo':reelsQ<cfgOro.reels?'Publicá '+(cfgOro.reels-reelsQ)+' reels más para el '+cfgOro.pct+'%':''))}</div>
      </div>
    </div>
    <div class="progress-bar"><div class="progress-fill" style="width:${progressPct.toFixed(1)}%;background:${tr.color}"></div></div>
    ${htmlAseguradoProf(aseg)}
    <div class="stat-grid">
      ${card('💈 Facturación cortes',fp(fact),turnos.length+' turnos','',"dineroAbrir('turnos')")}
      ${card('Comisión cortes',fp(comision),pct+'% de tus cortes'+(extraAseg?' + asegurado':''),tr.color,"dineroAbrir('turnos')")}
      ${card('📦 Productos vendidos',fp(totalVentas),ventas.length+' ventas','',"dineroAbrir('ventas')")}
      ${card('Comisión productos',fp(comisionVentas),'Aparte de los cortes','#4A136B',"dineroAbrir('ventas')")}
      ${card('💵 Efectivo',fp(efect),'Cortes + productos','#34d399',"dineroAbrir('turnos','efectivo')")}
      ${card('📱 Mercado Pago',fp(mp),tarjeta?'💳 Tarjeta '+fp(tarjeta):'Cortes + productos','#009ee3',"dineroAbrir('turnos','mp')")}
    </div>

    <div class="card" style="margin-bottom:14px">
      <div style="font-size:11px;font-weight:800;color:var(--muted);text-transform:uppercase;letter-spacing:.08em;margin-bottom:8px">🧾 Detalle de tu quincena</div>
      ${dline('Servicios ('+pct+'% de tu tramo)',fp(qRes.normal))}
      ${qRes.extra>0?dline('🌙 Plata extra (noche y descuentos altos)','+'+fp(qRes.extra),'color:#a78bfa'):''}
      ${extraAseg>0?dline('🛡️ Monto asegurado','+'+fp(extraAseg),'color:#34d399'):''}
      ${dline('📦 Productos','+'+fp(comisionVentas))}
      ${totalGastosMP>0?dline('💳 Gastos con MP del local','−'+fp(totalGastosMP),'color:#f472b6'):''}
      ${dline('<b>Total a cobrar</b>','<b>'+fp(comision+comisionVentas-totalGastosMP)+'</b>','border-top:1px solid var(--border);margin-top:4px;padding-top:6px')}
      ${(qRes.paqNormal+qRes.paqExtra)>0?`<div style="font-size:10.5px;color:var(--muted2);margin-top:6px">De eso, ${fp(qRes.paqNormal)} en Servicios${qRes.paqExtra>0?' y '+fp(qRes.paqExtra)+' en Plata extra':''} vinieron de paquetes ya redimidos.</div>`:''}
    </div>

    <div class="sec-hdr">
      <span class="sec-title">💳 Gastos con el MP del local</span>
      <button class="sec-btn" onclick="abrirFormGastoMP()" style="background:#f472b6">+ Anotar</button><button class="sec-btn" onclick="abrirPedirAdelanto()" style="background:#fbbf24;color:#000">💵 Pedir adelanto</button>
    </div>
    ${!gastosMP.length?'<div class="empty"><div class="e-icon">💳</div><p>Nada anotado este período.</p></div>':gastosMP.map(g=>`<div class="turno-item" style="cursor:default"><div class="ti-dot" style="background:#f472b6"></div><div class="ti-info"><strong>${escH(g.motivo)}</strong><span>${fechaCorta(g.fecha)}</span></div><div style="text-align:right"><div class="ti-monto" style="color:#f472b6">−${fp(num(g.monto))}</div></div></div>`).join('')}

    <div class="sec-hdr">
      <span class="sec-title" style="cursor:pointer" onclick="dineroAbrir('turnos')">💈 Últimos turnos ›</span>
      <button class="sec-btn" onclick="abrirRegistroTurno()" style="background:${color}">+ Turno</button>
    </div>
    ${!sortedTurnos.length?'<div class="empty"><div class="e-icon">📅</div><p>Sin turnos este período.</p></div>':sortedTurnos.slice(0,3).map(t=>rowTurno(t,false)).join('')+verTodos('turnos',sortedTurnos.length,'turnos')}

    <div class="sec-hdr" style="margin-top:20px">
      <span class="sec-title" style="cursor:pointer" onclick="dineroAbrir('ventas')">📦 Últimas ventas de productos ›</span>
      <button class="sec-btn" onclick="abrirVentaProducto()" style="background:#4A136B">+ Venta</button>
    </div>
    ${!sortedVentas.length?'<div class="empty"><div class="e-icon">📦</div><p>Sin ventas de productos este período.</p></div>':sortedVentas.slice(0,3).map(v=>rowVenta(v,false)).join('')+verTodos('ventas',sortedVentas.length,'ventas')}

    ${htmlSenasProf(false)}
    <div class="sec-hdr" style="margin-top:20px">
      <span class="sec-title" style="cursor:pointer" onclick="dineroAbrir('deudores')">🚫 En rojo — no pagaron (${deudoresPend.length}) ›</span>
      <button class="sec-btn" onclick="abrirCobroDebe()" style="background:#f472b6">+ Turno que debe</button>
    </div>
    ${deudoresPend.length?`<div class="stat-card" style="margin-bottom:10px;border-color:rgba(244,114,182,.3)"><div class="sc-lbl">Total adeudado</div><div class="sc-val" style="color:#f472b6">${fp(totalDeuda)}</div><div class="sc-sub">Suma a la quincena en que paguen</div></div>`:''}
    ${!deudoresPend.length?'<div class="empty"><div class="e-icon">✅</div><p>Nadie te debe nada.</p></div>':deudoresPend.slice(0,3).map(rowDeudor).join('')+verTodos('deudores',deudoresPend.length,'pendientes')}`;
}

function cambiarQuincena(dir){
  if(dir<0){
    if(dineroQ===1){ dineroQ=2; dineroMesOffset--; }
    else { dineroQ=1; }
  } else {
    if(dineroQ===2){ dineroQ=1; dineroMesOffset++; }
    else { dineroQ=2; }
  }
  const today=new Date();
  const currentQ=today.getDate()<=15?1:2;
  const esFuturo = dineroMesOffset>0 || (dineroMesOffset===0 && dineroQ>currentQ);
  if(esFuturo){ dineroMesOffset=0; dineroQ=currentQ; }
  renderDineroContent();
}

function renderYo(wrap){
  const gastos=yoData.gastos||[];
  const ingresos=yoData.ingresos||[];
  const now=new Date();
  const mes=now.getMonth(), year=now.getFullYear();
  const ingMes=ingresos.filter(i=>{const d=new Date(i.fecha);return d.getMonth()===mes&&d.getFullYear()===year;}).reduce((s,i)=>s+(parseFloat(i.monto)||0),0);
  const gasMes=gastos.filter(g=>{const d=new Date(g.fecha);return d.getMonth()===mes&&d.getFullYear()===year;}).reduce((s,g)=>s+(parseFloat(g.monto)||0),0);
  const balance=ingMes-gasMes;
  const balColor=balance>=0?'#34d399':'#f472b6';

  wrap.innerHTML=`
    <div style="background:${balColor}15;border:1px solid ${balColor}30;border-radius:18px;padding:20px;text-align:center;margin-bottom:14px">
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;opacity:.7;margin-bottom:6px">Balance del mes</div>
      <div style="font-size:40px;font-weight:900;color:${balColor};letter-spacing:-1px">${fp(balance)}</div>
      <div style="display:flex;justify-content:center;gap:24px;margin-top:14px;padding-top:14px;border-top:1px solid rgba(255,255,255,.1)">
        <div style="text-align:center"><div style="font-size:15px;font-weight:800;color:#34d399">${fp(ingMes)}</div><div style="font-size:10px;opacity:.6;margin-top:2px">Ingresos</div></div>
        <div style="text-align:center"><div style="font-size:15px;font-weight:800;color:#f472b6">${fp(gasMes)}</div><div style="font-size:10px;opacity:.6;margin-top:2px">Gastos</div></div>
      </div>
    </div>
    <div class="sec-hdr"><span class="sec-title">Ingresos</span><button class="sec-btn" onclick="abrirRegistroTipo('ingreso')" style="background:#34d399">+ Ingreso</button></div>
    ${!ingresos.length?'<div class="empty"><div class="e-icon">💵</div><p>Sin ingresos registrados.</p></div>':
    ingresos.slice(-5).reverse().map(i=>`<div class="card" style="margin-bottom:8px;display:flex;align-items:center;gap:10px">
      <div style="width:36px;height:36px;border-radius:10px;background:rgba(52,211,153,.15);display:flex;align-items:center;justify-content:center;font-size:16px">💵</div>
      <div style="flex:1"><div style="font-size:13px;font-weight:600">${i.desc||i.categoria||'Ingreso'}</div><div style="font-size:11px;color:var(--muted2)">${i.fecha||''}</div></div>
      <div style="font-size:14px;font-weight:800;color:#34d399">+${fp(parseFloat(i.monto)||0)}</div>
    </div>`).join('')}
    <div class="sec-hdr" style="margin-top:8px"><span class="sec-title">Gastos</span><button class="sec-btn" onclick="abrirRegistroTipo('gasto')" style="background:#f472b6">+ Gasto</button></div>
    ${!gastos.length?'<div class="empty"><div class="e-icon">🧾</div><p>Sin gastos registrados.</p></div>':
    gastos.slice(-5).reverse().map(g=>`<div class="card" style="margin-bottom:8px;display:flex;align-items:center;gap:10px">
      <div style="width:36px;height:36px;border-radius:10px;background:rgba(244,114,182,.12);display:flex;align-items:center;justify-content:center;font-size:16px">${g.categoria?.split(' ')[0]||'📦'}</div>
      <div style="flex:1"><div style="font-size:13px;font-weight:600">${g.desc||g.categoria||'Gasto'}</div><div style="font-size:11px;color:var(--muted2)">${g.tipo==='fijo'?'Fijo':'Variable'} · ${g.fecha||''}</div></div>
      <div style="font-size:14px;font-weight:800;color:#f472b6">-${fp(parseFloat(g.monto)||0)}</div>
    </div>`).join('')}`;
}


