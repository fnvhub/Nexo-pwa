(() => {
  "use strict";

  const CONFIG_KEY = "nexo.supabase.config.v1";
  const SAFETY_TABLE = "dynamic_safety";
  const CHECKIN_TABLE = "dynamic_checkins";
  const root = document.createElement("div");
  root.id = "nexo-safety";
  root.hidden = true;

  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[c]));

  const style = document.createElement("style");
  style.textContent = `
    #nexo-safety{color:#f5f0f7;margin-top:14px}
    #nexo-safety[hidden]{display:none}
    #nexo-safety .ns-card{padding:18px;margin:12px 0;border:1px solid #34283d;background:linear-gradient(180deg,#1a1422,#15101c);border-radius:18px}
    #nexo-safety h2{margin:0 0 8px;font-size:20px}
    #nexo-safety h3{margin:18px 0 8px;font-size:15px}
    #nexo-safety .ns-muted{color:#a99eae;font-size:14px;line-height:1.5}
    #nexo-safety .ns-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
    #nexo-safety .ns-grid button{width:100%;min-height:44px}
    #nexo-safety .ns-green{background:#173322!important;border-color:#3b8056!important;color:#a7e4bc!important}
    #nexo-safety .ns-yellow{background:#352a17!important;border-color:#8b6a2f!important;color:#f1cf8c!important}
    #nexo-safety .ns-red{background:#381a23!important;border-color:#7c3543!important;color:#ffc0c8!important}
    #nexo-safety .ns-form{display:grid;gap:10px}
    #nexo-safety label{display:grid;gap:6px;color:#d9d1df;font-size:13px;font-weight:650}
    #nexo-safety input,#nexo-safety textarea,#nexo-safety select{width:100%;padding:11px;border-radius:11px;border:1px solid #45374e;background:#100c15;color:#f5f0f7;font:inherit}
    #nexo-safety textarea{min-height:74px;resize:vertical}
    #nexo-safety .ns-row{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
    #nexo-safety button{min-height:42px;padding:9px 13px;border:1px solid #6a4c7c;border-radius:12px;background:#8d63ad;color:#fff;font-weight:750}
    #nexo-safety button.ns-secondary{background:#21182a;border-color:#45374e;color:#ddd5e3}
    #nexo-safety .ns-alert{padding:12px;border-radius:12px;background:#2d1a1f;color:#ffc0c8;border:1px solid #6c3440;line-height:1.45}
    #nexo-safety .ns-ok{padding:12px;border-radius:12px;background:#15281d;color:#a7e4bc;border:1px solid #316847}
    #nexo-safety .ns-log{border-top:1px solid #34283d;padding:10px 0}
    #nexo-safety .ns-log:first-child{border-top:0}
    #nexo-safety .ns-dot{display:inline-block;width:9px;height:9px;border-radius:50%;margin-right:6px}
    #nexo-safety .ns-dot.green{background:#69bc8b}.ns-dot.yellow{background:#e0ad62}.ns-dot.red{background:#df7885}
    @media(max-width:560px){#nexo-safety .ns-grid{grid-template-columns:1fr}}
  `;
  document.head.append(style);

  const localRoot = document.querySelector("#nexo-workspace");
  const cloudRoot = document.querySelector("#nexo-cloud");
  if (!localRoot || !cloudRoot) return;
  cloudRoot.after(root);

  let client = null;
  let activeDynamic = null;
  let role = null;
  let currentUser = null;
  let safetyData = null;
  let checkins = [];
  let statusMessage = "";
  let loading = false;

  function readConfig(){
    try{return JSON.parse(localStorage.getItem(CONFIG_KEY)||"null")}catch{return null}
  }

  function connect(){
    if(client) return client;
    const cfg=readConfig();
    if(!cfg || !window.supabase?.createClient) return null;
    client=window.supabase.createClient(cfg.url,cfg.key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
    return client;
  }

  async function session(){
    const c=connect(); if(!c) return null;
    const r=await c.auth.getSession();
    if(r.error) throw r.error;
    currentUser=r.data.session?.user||null;
    return currentUser;
  }

  async function load(){
    if(!activeDynamic)return;
    const c=connect(); if(!c)return;
    loading=true;
    try{
      const u=await session();
      if(!u){root.hidden=true;return}
      const m=await c.from("memberships").select("role").eq("dynamic_id",activeDynamic).eq("user_id",u.id).maybeSingle();
      if(m.error) throw m.error;
      role=m.data?.role||null;
      if(!role){root.hidden=true;return}

      const [s,logs]=await Promise.all([
        c.from(SAFETY_TABLE).select("*").eq("dynamic_id",activeDynamic).maybeSingle(),
        c.from(CHECKIN_TABLE).select("id,user_id,state,note,created_at").eq("dynamic_id",activeDynamic).order("created_at",{ascending:false}).limit(12)
      ]);
      if(s.error) throw s.error;
      if(logs.error) throw logs.error;
      safetyData=s.data||{
        dynamic_id:activeDynamic,
        red_word:"",
        yellow_word:"",
        nonverbal_signal:"",
        hard_limits:"",
        soft_limits:"",
        scope:"",
        exit_plan:"",
        aftercare_dom:"",
        aftercare_sum:"",
        review_interval_days:30,
        last_reviewed_at:null
      };
      checkins=logs.data||[];
      render();
    }catch(e){
      root.hidden=false;
      root.innerHTML=`<section class="ns-card"><h2>Seguridad y consentimiento</h2><p class="ns-alert">No se pudo cargar este módulo: ${esc(e.message||e)}</p><p class="ns-muted">La dinámica principal puede seguir funcionando. Si acabas de instalar esta versión, aplica primero el archivo de migración de Supabase incluido con Nexo 0.8.2.</p></section>`;
    }finally{loading=false}
  }

  function render(){
    if(!activeDynamic||!role||!safetyData){root.hidden=true;return}
    root.hidden=false;
    const reviewed=safetyData.last_reviewed_at
      ? new Date(safetyData.last_reviewed_at).toLocaleDateString("es-ES")
      : "Todavía no revisado";
    const canEdit=role==="DOM";
    const last=checkins[0];
    root.innerHTML=`
      <section class="ns-card">
        <h2>Seguridad y consentimiento</h2>
        <p class="ns-muted">Este panel pertenece a esta dinámica. No guarda fotos, vídeos ni pruebas. El consentimiento es específico, reversible y tiene prioridad sobre cualquier tarea o acuerdo.</p>
        ${last?`<p class="${last.state==="red"?"ns-alert":last.state==="yellow"?"ns-muted":"ns-ok"}"><strong>Último estado:</strong> ${labelState(last.state)} · ${new Date(last.created_at).toLocaleString("es-ES")}</p>`:""}
        <h3>Check-in inmediato</h3>
        <div class="ns-grid">
          <button class="ns-green" data-safety="checkin" data-state="green">🟢 Verde · continuar</button>
          <button class="ns-yellow" data-safety="checkin" data-state="yellow">🟡 Amarillo · revisar</button>
          <button class="ns-red" data-safety="checkin" data-state="red">🔴 Rojo · parar</button>
        </div>
        <p class="ns-muted">Rojo registra el estado y pausa la dinámica en Supabase. La pausa puede revisarse después; no se convierte en una sanción.</p>
      </section>

      <section class="ns-card">
        <h2>Acuerdo de seguridad</h2>
        <p class="ns-muted">Negociadlo fuera de personaje y revisadlo periódicamente. Un acuerdo previo no elimina el derecho a parar.</p>
        <form id="ns-safety-form" class="ns-form">
          <label>Palabra/señal roja · parar inmediatamente<input name="red_word" maxlength="100" value="${esc(safetyData.red_word)}" ${canEdit?"":"disabled"}></label>
          <label>Palabra/señal amarilla · bajar intensidad o comprobar<input name="yellow_word" maxlength="100" value="${esc(safetyData.yellow_word)}" ${canEdit?"":"disabled"}></label>
          <label>Señal no verbal<input name="nonverbal_signal" maxlength="200" value="${esc(safetyData.nonverbal_signal)}"></label>
          <label>Límites duros<textarea name="hard_limits" maxlength="2000">${esc(safetyData.hard_limits)}</textarea></label>
          <label>Límites blandos / negociables<textarea name="soft_limits" maxlength="2000">${esc(safetyData.soft_limits)}</textarea></label>
          <label>Alcance de la dinámica · qué áreas están incluidas<textarea name="scope" maxlength="2000">${esc(safetyData.scope)}</textarea></label>
          <label>Plan de salida · cómo se pausa o termina la dinámica<textarea name="exit_plan" maxlength="2000">${esc(safetyData.exit_plan)}</textarea></label>
          <label>Intervalo de revisión (días)<input name="review_interval_days" type="number" min="1" max="365" value="${Number(safetyData.review_interval_days)||30}" ${canEdit?"":"disabled"}></label>
          <label>Aftercare DOM · qué necesita esta persona después<textarea name="aftercare_dom" maxlength="1500">${esc(safetyData.aftercare_dom)}</textarea></label>
          <label>Aftercare SUM · qué necesita esta persona después<textarea name="aftercare_sum" maxlength="1500">${esc(safetyData.aftercare_sum)}</textarea></label>
          <div class="ns-row"><button ${canEdit?"":"disabled"}>Guardar acuerdo de seguridad</button><span class="ns-muted">Última revisión: ${reviewed}</span></div>
        </form>
      </section>

      <section class="ns-card">
        <h2>Revisión de la dinámica</h2>
        <p class="ns-muted">Revisad límites, alcance, tareas, consecuencias y necesidades de aftercare como personas fuera de los roles.</p>
        <div class="ns-row">
          <button data-safety="review">Marcar revisión ahora</button>
          <span class="ns-muted">Próxima revisión recomendada: ${nextReview()}</span>
        </div>
      </section>

      <section class="ns-card">
        <h2>Historial de check-ins</h2>
        ${checkins.length?checkins.map(c=>`<div class="ns-log"><span class="ns-dot ${c.state}"></span><strong>${labelState(c.state)}</strong><p class="ns-muted">${new Date(c.created_at).toLocaleString("es-ES")} · ${esc(c.note||"Sin nota")}</p></div>`).join(""):"<p class='ns-muted'>Todavía no hay check-ins.</p>"}
      </section>
    `;
  }

  function labelState(s){return s==="red"?"Rojo · parar":s==="yellow"?"Amarillo · revisar":"Verde · continuar"}

  function nextReview(){
    if(!safetyData?.last_reviewed_at)return "pendiente";
    const d=new Date(safetyData.last_reviewed_at);
    d.setDate(d.getDate()+(Number(safetyData.review_interval_days)||30));
    return d.toLocaleDateString("es-ES");
  }

  async function saveForm(form){
    const c=connect(), v=new FormData(form);
    const payload={
      dynamic_id:activeDynamic,
      red_word:String(v.get("red_word")||"").trim(),
      yellow_word:String(v.get("yellow_word")||"").trim(),
      nonverbal_signal:String(v.get("nonverbal_signal")||"").trim(),
      hard_limits:String(v.get("hard_limits")||"").trim(),
      soft_limits:String(v.get("soft_limits")||"").trim(),
      scope:String(v.get("scope")||"").trim(),
      exit_plan:String(v.get("exit_plan")||"").trim(),
      aftercare_dom:String(v.get("aftercare_dom")||"").trim(),
      aftercare_sum:String(v.get("aftercare_sum")||"").trim(),
      review_interval_days:Math.min(365,Math.max(1,Number(v.get("review_interval_days"))||30)),
      updated_by:currentUser.id,
      updated_at:new Date().toISOString()
    };
    if(role!=="DOM"){
      delete payload.red_word;delete payload.yellow_word;delete payload.review_interval_days;delete payload.updated_by;
    }
    const r=await c.from(SAFETY_TABLE).upsert(payload,{onConflict:"dynamic_id"});
    if(r.error)throw r.error;
    statusMessage="Acuerdo de seguridad guardado.";
    await load();
  }

  async function checkin(state){
    const c=connect();await session();
    const note=state==="red"
      ?"Parada de seguridad activada."
      :state==="yellow"?"Necesitamos revisar el estado antes de continuar."
      :"Estado comunicado como apto para continuar.";
    const r=await c.from(CHECKIN_TABLE).insert({dynamic_id:activeDynamic,user_id:currentUser.id,state,note});
    if(r.error)throw r.error;
    if(state==="red"){
      const p=await c.from("dynamics").update({paused:true}).eq("id",activeDynamic);
      if(p.error)throw p.error;
    }
    await load();
  }

  root.addEventListener("click",async e=>{
    const b=e.target.closest("[data-safety]");if(!b)return;
    try{
      if(b.dataset.safety==="checkin"){
        if(b.dataset.state==="red" && !confirm("ROJO: la dinámica se pausará inmediatamente. ¿Confirmas la parada de seguridad?"))return;
        await checkin(b.dataset.state);
      }
      if(b.dataset.safety==="review"){
        if(role!=="DOM")return;
        const c=connect();await session();
        const r=await c.from(SAFETY_TABLE).upsert({dynamic_id:activeDynamic,last_reviewed_at:new Date().toISOString(),updated_by:currentUser.id,updated_at:new Date().toISOString()},{onConflict:"dynamic_id"});
        if(r.error)throw r.error;
        await load();
      }
    }catch(err){
      root.insertAdjacentHTML("afterbegin",`<div class="ns-card"><p class="ns-alert">${esc(err.message||err)}</p></div>`);
    }
  });

  root.addEventListener("submit",async e=>{
    if(e.target.id!=="ns-safety-form")return;
    e.preventDefault();
    try{await session();await saveForm(e.target)}catch(err){root.insertAdjacentHTML("afterbegin",`<div class="ns-card"><p class="ns-alert">${esc(err.message||err)}</p></div>`)}
  });

  document.addEventListener("click",e=>{
    const b=e.target.closest("#nexo-cloud button[data-action='open']");
    if(!b)return;
    activeDynamic=b.dataset.id;
    setTimeout(load,80);
  });

  const observer=new MutationObserver(()=>{
    if(cloudRoot.hidden){root.hidden=true;return}
    if(activeDynamic && cloudRoot.textContent.includes("Tareas de esta dinámica"))setTimeout(load,0);
  });
  observer.observe(cloudRoot,{subtree:true,childList:true,attributes:true,attributeFilter:["hidden"]});

  window.addEventListener("nexo:safety:refresh",load);
})();
