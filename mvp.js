// Nexo v0.7.0 — local workspace + visual layer
// Mantiene el modo local del MVP y añade una interfaz oscura tipo habit/task tracker,
// tarjetas de progreso, estados claros y color de identidad por SUM.
(() => {
  const host = document.querySelector("#app-screen .workspace-content");
  if (!host) return;

  const KEY = "nexo.mvp.v1";
  const uid = () => crypto.randomUUID();
  const esc = (s = "") => String(s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const load = () => {
    try { return JSON.parse(localStorage.getItem(KEY)) || { spaces: [] }; }
    catch { return { spaces: [] }; }
  };
  const save = data => localStorage.setItem(KEY, JSON.stringify(data));

  let active = null;
  let tab = "inicio";
  let creatingRole = "";
  let editingTaskId = null;
  let confirmingTaskDelete = null;

  const style = document.createElement("style");
  style.id = "nexo-v07-theme";
  style.textContent = `
    :root{
      --nx-bg:#0b0910;--nx-bg2:#15101c;--nx-card:#1a1422;--nx-card2:#21182b;
      --nx-line:#34283d;--nx-text:#f5f0f7;--nx-muted:#a99eae;
      --nx-plum:#8d63ad;--nx-plum2:#b27bd0;--nx-soft:#2b2035;
      --nx-green:#68bb8a;--nx-amber:#dfad63;--nx-red:#df7885;
      --nx-radius:18px;
    }
    #nexo-workspace{
      width:100%;max-width:760px;color:var(--nx-text);
      font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
    }
    #nexo-workspace *{box-sizing:border-box}
    #nexo-workspace h1,#nexo-workspace h2,#nexo-workspace h3{color:var(--nx-text);letter-spacing:-.02em}
    #nexo-workspace .nexo-row{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
    #nexo-workspace .nexo-row button{flex:0 1 auto}
    #nexo-workspace .nexo-hero{
      padding:22px;border:1px solid var(--nx-line);border-radius:22px;
      background:linear-gradient(145deg,#21182b,#17111f);box-shadow:0 18px 45px rgba(0,0,0,.24);
      margin-bottom:14px
    }
    #nexo-workspace .nexo-hero h1{margin:4px 0 6px;font-size:30px}
    #nexo-workspace .nexo-tag{font-size:11px;color:var(--nx-plum2);font-weight:800;letter-spacing:.12em;text-transform:uppercase}
    #nexo-workspace .nexo-muted{color:var(--nx-muted);font-size:14px;line-height:1.55}
    #nexo-workspace .nexo-alert{padding:12px 14px;border:1px solid #4a3820;border-radius:14px;background:#251b10;color:#e7c78e;font-size:13px;line-height:1.5;margin:12px 0}
    #nexo-workspace .nexo-tabs{display:grid;grid-template-columns:repeat(4,1fr);gap:7px;margin:14px 0}
    #nexo-workspace .nexo-tabs button{
      width:100%;min-height:42px;padding:9px;border:1px solid var(--nx-line);border-radius:13px;
      background:#17111f;color:var(--nx-muted);font-weight:700
    }
    #nexo-workspace .nexo-tabs button[aria-pressed="true"]{
      background:var(--nx-soft);color:#fff;border-color:#604777;box-shadow:inset 0 -2px 0 var(--nx-plum)
    }
    #nexo-workspace .nexo-card{
      padding:18px;margin:12px 0;border:1px solid var(--nx-line);
      background:linear-gradient(180deg,var(--nx-card),#16111d);border-radius:var(--nx-radius);
      box-shadow:0 8px 25px rgba(0,0,0,.12)
    }
    #nexo-workspace .nexo-card h2{font-size:19px;margin:0 0 9px}
    #nexo-workspace .nexo-item{position:relative;padding:16px 0;border-top:1px solid var(--nx-line)}
    #nexo-workspace .nexo-item:first-child{border-top:0}
    #nexo-workspace .nexo-item strong{color:var(--nx-text)}
    #nexo-workspace .nexo-item p{margin:6px 0;color:var(--nx-muted);font-size:14px;line-height:1.5}
    #nexo-workspace .nexo-form{display:grid;gap:10px;margin:14px 0}
    #nexo-workspace .nexo-form label{display:grid;gap:6px;color:#d9d1df;font-size:13px;font-weight:650}
    #nexo-workspace .nexo-form input,#nexo-workspace .nexo-form textarea,#nexo-workspace .nexo-form select{
      width:100%;padding:12px;border-radius:12px;border:1px solid #45374e;background:#100c15;color:var(--nx-text);font:inherit
    }
    #nexo-workspace .nexo-form textarea{min-height:82px;resize:vertical}
    #nexo-workspace button{
      min-height:44px;padding:10px 14px;border:1px solid #6a4c7c;border-radius:13px;
      background:var(--nx-plum);color:#fff;font-weight:750;cursor:pointer;transition:.18s ease
    }
    #nexo-workspace button:hover{background:#a06bc2;transform:translateY(-1px)}
    #nexo-workspace .nexo-small{min-height:38px;padding:8px 12px;font-size:13px;background:#241a2d;border-color:#4a3a53}
    #nexo-workspace .nexo-secondary{background:#17111f;border-color:var(--nx-line);color:#ddd4e3}
    #nexo-workspace .nexo-danger{background:#321820;border-color:#6a303a;color:#f4b6bf}
    #nexo-workspace .nexo-success{background:#14251b;border-color:#2d6847;color:#9fe0b7}
    #nexo-workspace .nexo-progress{height:9px;border-radius:999px;background:#2a2230;overflow:hidden;margin:10px 0 4px}
    #nexo-workspace .nexo-progress>span{display:block;height:100%;border-radius:999px;background:linear-gradient(90deg,var(--nx-plum),var(--nx-plum2))}
    #nexo-workspace .nexo-statgrid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:13px}
    #nexo-workspace .nexo-stat{padding:12px;border:1px solid var(--nx-line);border-radius:14px;background:#15101c}
    #nexo-workspace .nexo-stat b{display:block;font-size:20px;color:#fff}
    #nexo-workspace .nexo-stat span{font-size:11px;color:var(--nx-muted)}
    #nexo-workspace .nexo-status{display:inline-flex;align-items:center;gap:6px;padding:5px 9px;border-radius:999px;font-size:11px;font-weight:800}
    #nexo-workspace .nexo-status.pending{background:#2c2113;color:#e4b66e}
    #nexo-workspace .nexo-status.done{background:#14251b;color:#7fd39e}
    #nexo-workspace .nexo-status.paused{background:#2c2113;color:#e4b66e}
    #nexo-workspace .nexo-sum{
      border-left:4px solid var(--sum-accent,#9a69bb);padding-left:13px
    }
    #nexo-workspace .nexo-sum-dot{width:10px;height:10px;border-radius:50%;background:var(--sum-accent,#9a69bb);display:inline-block}
    @media(max-width:600px){
      #nexo-workspace .nexo-tabs{grid-template-columns:repeat(4,minmax(76px,1fr));overflow:auto}
      #nexo-workspace .nexo-hero{padding:18px}
      #nexo-workspace .nexo-statgrid{grid-template-columns:1fr 1fr 1fr}
    }
  `;
  document.head.append(style);

  // El panel cloud se crea después; estas reglas quedan preparadas desde el principio.
  const cloudStyle = document.createElement("style");
  cloudStyle.id = "nexo-v07-cloud-theme";
  cloudStyle.textContent = `
    #nexo-cloud{color:#f5f0f7!important}
    #nexo-cloud h1,#nexo-cloud h2,#nexo-cloud h3{color:#f5f0f7!important}
    #nexo-cloud .nc-card{border:1px solid #34283d!important;background:linear-gradient(180deg,#1a1422,#16111d)!important;border-radius:18px!important;box-shadow:0 8px 25px rgba(0,0,0,.12)!important}
    #nexo-cloud .nc-muted{color:#a99eae!important}
    #nexo-cloud .nc-form input,#nexo-cloud .nc-form textarea,#nexo-cloud .nc-form select{background:#100c15!important;color:#f5f0f7!important;border:1px solid #45374e!important;border-radius:12px!important}
    #nexo-cloud button{background:#8d63ad!important;color:#fff!important;border-color:#6a4c7c!important;border-radius:13px!important}
    #nexo-cloud .nc-small,#nexo-cloud .nc-row button{background:#241a2d!important;color:#ddd4e3!important;border-color:#4a3a53!important}
    #nexo-cloud .nc-item{border-color:#34283d!important}
    #nexo-cloud .nc-tag{color:#b27bd0!important}
    #nexo-cloud .nc-error{color:#df7885!important}
    #nexo-cloud .nc-success{color:#68bb8a!important}
    #nexo-cloud .nc-alert{background:#251b10!important;color:#e7c78e!important;border-color:#4a3820!important}
  `;
  document.head.append(cloudStyle);

  // Versionado visible: la lógica sigue siendo la existente, pero la interfaz ya identifica 0.7.0.
  const refreshVersionLabels = () => {
    const v = document.querySelector("#settings-version");
    if (v) v.textContent = "0.7.0";
    document.querySelectorAll("#nexo-cloud .nc-tag").forEach(el => {
      if (/NEXO v0\.6\.0/i.test(el.textContent)) el.textContent = el.textContent.replace(/NEXO v0\.6\.0/i, "NEXO v0.7.0");
    });
  };
  const versionObserver = new MutationObserver(refreshVersionLabels);
  versionObserver.observe(document.body,{subtree:true,childList:true});
  refreshVersionLabels();

  const shell = document.createElement("div");
  shell.id = "nexo-workspace";
  shell.hidden = true;
  host.after(shell);

  const data = load();

  const frequencyLabel = f => ({once:"Puntual",daily:"Diaria",weekly:"Semanal",monthly:"Mensual"}[f] || "Puntual");
  function periodKey(task){
    const now=new Date(), d=new Date(now.getFullYear(),now.getMonth(),now.getDate());
    if(task.frequency==="weekly"){const day=(d.getDay()+6)%7;d.setDate(d.getDate()-day)}
    if(task.frequency==="monthly")return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`;
    if(task.frequency==="once")return "once";
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  }
  function targetCount(t){return t.frequency==="once"||!t.frequency?1:Math.max(1,Number(t.requiredCount)||1)}
  function completedCount(t){
    if(!t.frequency&&t.done)return 1;
    return Math.min(Number(t.completions?.[periodKey(t)])||0,targetCount(t));
  }
  function pct(t){return Math.min(100,Math.round(completedCount(t)/targetCount(t)*100))}
  function colorFor(space){
    if(space.sumColor)return space.sumColor;
    const colors=["#9b6bc0","#5f9fca","#c4779b","#6fb38b","#d29a55","#8a86d1"];
    return colors[Math.abs(String(space.id).split("").reduce((a,c)=>a+c.charCodeAt(0),0))%colors.length];
  }
  function persist(){save(data);render()}

  function taskForm(space){
    if(space.role!=="DOM")return "";
    const task=space.tasks.find(t=>t.id===editingTaskId);
    const v=(k,f="")=>esc(task?.[k]??f);
    const frequency=task?.frequency||"once";
    return `<form class="nexo-form nexo-card" id="task-form">
      <strong>${task?"Editar tarea":"Nueva tarea"}</strong>
      <label>Qué tiene que hacer<input name="title" maxlength="120" required placeholder="Acción concreta" value="${v("title")}"></label>
      <label>Instrucciones claras<textarea name="instructions" minlength="10" maxlength="1000" required placeholder="Explica cómo se considera terminada.">${v("instructions")}</textarea></label>
      <label>Frecuencia<select name="frequency">
        <option value="once" ${frequency==="once"?"selected":""}>Puntual</option>
        <option value="daily" ${frequency==="daily"?"selected":""}>Diaria</option>
        <option value="weekly" ${frequency==="weekly"?"selected":""}>Semanal</option>
        <option value="monthly" ${frequency==="monthly"?"selected":""}>Mensual</option>
      </select></label>
      <label data-count-wrap ${frequency==="once"?"hidden":""}><span data-count-label>${({daily:"Veces al día",weekly:"Veces a la semana",monthly:"Veces al mes"}[frequency])||"Veces"}</span><input name="requiredCount" type="number" min="1" max="99" value="${v("requiredCount",1)}" ${frequency==="once"?"":"required"}></label>
      <label>Fecha límite<input name="due" type="date" value="${v("due")}"></label>
      <label>Hora límite<input name="deadlineTime" type="time" value="${v("deadlineTime")}"></label>
      <div class="nexo-row"><button>${task?"Guardar cambios":"Asignar tarea"}</button>${task?'<button type="button" class="nexo-small nexo-secondary" data-action="cancel-edit-task">Cancelar</button>':""}</div>
    </form>`;
  }

  function render(){
    const s=active&&data.spaces.find(x=>x.id===active);
    if(!s){
      shell.innerHTML=`<section class="nexo-hero"><span class="nexo-tag">Nexo · espacio local</span><h1>Tus espacios</h1><p class="nexo-muted">Prueba la aplicación en este dispositivo o entra en Cuentas e invitaciones para usar el espacio sincronizado.</p><div class="nexo-row"><button data-action="accounts">Cuentas e invitaciones</button><button class="nexo-small" data-action="start-create" data-role="DOM">Crear como DOM</button><button class="nexo-small" data-action="start-create" data-role="SUM">Crear como SUM</button></div></section>
      ${creatingRole?`<form class="nexo-form nexo-card" id="create-form"><strong>Nuevo espacio · ${creatingRole}</strong><input name="spaceName" maxlength="100" required placeholder="Nombre del espacio" value="${creatingRole==="DOM"?"Mi dinámica":"Mi espacio"}><div class="nexo-row"><button>Crear espacio</button><button class="nexo-small nexo-secondary" type="button" data-action="cancel-create">Cancelar</button></div></form>`:""}
      <div id="spaces"></div>`;
      shell.querySelector("#spaces").innerHTML=data.spaces.map(x=>`<article class="nexo-card nexo-sum" style="--sum-accent:${colorFor(x)}"><span class="nexo-tag">${x.role}</span><h2>${esc(x.name)}</h2><p class="nexo-muted">${x.rules.length} acuerdos · ${x.tasks.length} tareas</p><button data-action="open" data-id="${x.id}">Abrir espacio</button></article>`).join("")||'<p class="nexo-muted">Aún no hay espacios locales.</p>';
      return;
    }

    const pending=s.tasks.filter(t=>completedCount(t)<targetCount(t)).length;
    const done=s.tasks.length-pending;
    const total=s.tasks.length;
    const overall=total?Math.round(done/total*100):0;
    shell.innerHTML=`<section class="nexo-hero" style="--sum-accent:${colorFor(s)}">
      <div class="nexo-row" style="justify-content:space-between">
        <div><span class="nexo-tag">${s.role==="DOM"?"Dinámica · DOM":"Espacio · SUM"}</span><h1>${esc(s.name)}</h1></div>
        <span class="nexo-status ${s.pause?"paused":"done"}">${s.pause?"En pausa":"Activa"}</span>
      </div>
      <p class="nexo-muted">${s.role==="DOM"?"Panel de control de la dinámica.":"Tu panel personal de tareas y progreso."}</p>
      <div class="nexo-progress"><span style="width:${overall}%"></span></div>
      <div class="nexo-statgrid"><div class="nexo-stat"><b>${overall}%</b><span>progreso</span></div><div class="nexo-stat"><b>${done}</b><span>completadas</span></div><div class="nexo-stat"><b>${pending}</b><span>pendientes</span></div></div>
    </section>
    <div class="nexo-row" style="justify-content:space-between"><div class="nexo-muted">Color de identidad <span class="nexo-sum-dot"></span></div><div class="nexo-row"><button class="nexo-small nexo-secondary" data-action="accounts">Cuenta</button><button class="nexo-small nexo-secondary" data-action="back">Salir</button></div></div>
    <nav class="nexo-tabs" aria-label="Secciones">${["inicio","acuerdos","tareas","perfil"].map(x=>`<button data-tab="${x}" aria-pressed="${tab===x}">${({inicio:"Inicio",acuerdos:"Acuerdos",tareas:"Tareas",perfil:"Perfil"})[x]}</button>`).join("")}</nav>
    <div id="nexo-panel"></div>`;

    const panel=shell.querySelector("#nexo-panel");

    if(tab==="inicio"){
      const next=s.tasks.find(t=>completedCount(t)<targetCount(t));
      panel.innerHTML=`<section class="nexo-card"><h2>Resumen</h2><p class="nexo-muted">${s.rules.length} acuerdos · ${s.tasks.length} tareas</p>${next?`<div class="nexo-item nexo-sum"><strong>Próxima tarea</strong><p>${esc(next.title)}</p><div class="nexo-progress"><span style="width:${pct(next)}%"></span></div><p>${pct(next)}% completada en este periodo</p></div>`:'<div class="nexo-item"><span class="nexo-status done">Todo al día</span><p>Las tareas de este periodo están completadas.</p></div>'}</section>
      ${s.role==="DOM"?`<section class="nexo-card"><h2>Control</h2><p class="nexo-muted">Puedes pausar la dinámica sin perder el historial.</p><button class="nexo-small" data-action="pause">${s.pause?"Reanudar dinámica":"Poner en pausa"}</button></section>`:""}
      <section class="nexo-card"><h2>Nota privada</h2><p class="nexo-muted">Solo se guarda en este dispositivo.</p><textarea id="note" class="nexo-form" placeholder="Nota para ti">${esc(s.note||"")}</textarea><button class="nexo-small" data-action="note">Guardar nota</button></section>`;
    }

    if(tab==="acuerdos"){
      panel.innerHTML=`<section class="nexo-card"><h2>Acuerdos y límites</h2>${s.role==="DOM"?`<form class="nexo-form" id="rule-form"><label>Acuerdo<input name="title" maxlength="100" required placeholder="Nuevo acuerdo"></label><label>Detalle<textarea name="detail" maxlength="500" placeholder="Detalle opcional"></textarea></label><button>Añadir acuerdo</button></form>`:"<p class='nexo-muted'>Acuerdos registrados para este espacio.</p>"}${s.rules.map((r,i)=>`<div class="nexo-item"><strong>${esc(r.title)}</strong><p>${esc(r.detail)}</p>${s.role==="DOM"?`<button class="nexo-small nexo-danger" data-action="delete-rule" data-index="${i}">Eliminar</button>`:""}</div>`).join("")||'<p class="nexo-muted">Todavía no hay acuerdos.</p>'}</section>`;
    }

    if(tab==="tareas"){
      panel.innerHTML=`<section class="nexo-card"><h2>Tareas</h2>${taskForm(s)}${s.tasks.map((t,i)=>{
        const target=targetCount(t),count=completedCount(t),complete=count>=target;
        return `<article class="nexo-item nexo-sum">
          <div class="nexo-row" style="justify-content:space-between"><strong>${esc(t.title)}</strong><span class="nexo-status ${complete?"done":"pending"}">${complete?"Completada":"Pendiente"}</span></div>
          <p><strong>Instrucciones:</strong> ${esc(t.instructions||"Consulta los detalles con el DOM.")}</p>
          <p>${frequencyLabel(t.frequency)}${target>1?` · ${count} de ${target}`:""} · ${complete?"Listo para este periodo":"Pendiente de cumplimiento"}</p>
          <div class="nexo-progress"><span style="width:${pct(t)}%"></span></div>
          <p>${t.due?"Fecha límite: "+esc(t.due):"Sin fecha límite"}${t.deadlineTime?" · "+esc(t.deadlineTime):""}</p>
          ${!complete?`<button class="nexo-small nexo-success" data-action="done" data-index="${i}">${s.role==="DOM"?"Validar cumplimiento":"Marcar como hecha"}</button>`:""}
          ${s.role==="DOM"?`<div class="nexo-row"><button class="nexo-small" data-action="edit-task" data-id="${t.id}">Editar</button><button class="nexo-small nexo-danger" data-action="ask-delete-task" data-id="${t.id}">Borrar</button></div>${confirmingTaskDelete===t.id?`<div class="nexo-alert">¿Borrar “${esc(t.title)}”? Esta acción no se puede deshacer.</div><div class="nexo-row"><button class="nexo-small nexo-danger" data-action="confirm-delete-task" data-id="${t.id}">Sí, borrar</button><button class="nexo-small nexo-secondary" data-action="cancel-delete-task">Cancelar</button></div>`:""}`:""}
        </article>`;
      }).join("")||'<p class="nexo-muted">Todavía no hay tareas.</p>'}</section>`;
    }

    if(tab==="perfil"){
      panel.innerHTML=`<section class="nexo-card"><h2>Perfil</h2><form id="profile-form" class="nexo-form"><label>Nombre<input name="name" maxlength="80" value="${esc(s.profile||"")}" placeholder="Cómo quieres que te llamen"></label><label>Forma de tratamiento<select name="address"><option ${s.address==="Tú"?"selected":""}>Tú</option><option ${s.address==="Usted"?"selected":""}>Usted</option><option ${s.address==="Personalizada"?"selected":""}>Personalizada</option></select></label><label>Preferencias y límites<textarea name="limits" maxlength="1000" placeholder="Anota límites y preferencias">${esc(s.limits||"")}</textarea></label><button>Guardar perfil</button></form></section>`;
    }
  }

  shell.addEventListener("change",e=>{
    if(e.target.form?.id==="task-form"&&e.target.name==="frequency"){
      const f=e.target.form, freq=f.elements.frequency.value;
      f.querySelector("[data-count-wrap]").hidden=freq==="once";
      f.elements.requiredCount.required=freq!=="once";
      f.querySelector("[data-count-label]").textContent=({daily:"Veces al día",weekly:"Veces a la semana",monthly:"Veces al mes"}[freq])||"Veces";
    }
  });

  shell.addEventListener("click",e=>{
    const b=e.target.closest("button");if(!b)return;
    const s=active&&data.spaces.find(x=>x.id===active);
    if(b.dataset.tab){tab=b.dataset.tab;render();return}
    switch(b.dataset.action){
      case"accounts":window.dispatchEvent(new Event("nexo:open-cloud"));break;
      case"start-create":creatingRole=b.dataset.role;render();break;
      case"cancel-create":creatingRole="";render();break;
      case"open":active=b.dataset.id;tab="inicio";render();break;
      case"back":active=null;editingTaskId=null;persist();break;
      case"pause":s.pause=!s.pause;persist();break;
      case"note":s.note=shell.querySelector("#note").value;persist();break;
      case"delete-rule":s.rules.splice(+b.dataset.index,1);persist();break;
      case"edit-task":editingTaskId=b.dataset.id;confirmingTaskDelete=null;render();break;
      case"cancel-edit-task":editingTaskId=null;render();break;
      case"ask-delete-task":confirmingTaskDelete=b.dataset.id;render();break;
      case"cancel-delete-task":confirmingTaskDelete=null;render();break;
      case"confirm-delete-task":s.tasks=s.tasks.filter(t=>t.id!==b.dataset.id);confirmingTaskDelete=null;if(editingTaskId===b.dataset.id)editingTaskId=null;persist();break;
      case"done":{
        const t=s.tasks[+b.dataset.index],key=periodKey(t);
        t.completions={...(t.completions||{}),[key]:Math.min(targetCount(t),completedCount(t)+1)};
        t.done=completedCount(t)>=targetCount(t);persist();break;
      }
    }
  });

  shell.addEventListener("submit",e=>{
    e.preventDefault();
    const f=e.target,v=new FormData(f),s=data.spaces.find(x=>x.id===active);
    if(f.id==="create-form"){
      const space={id:uid(),role:creatingRole,name:String(v.get("spaceName")).trim(),rules:[],tasks:[],pause:false,note:"",sumColor:creatingRole==="SUM"?undefined:undefined};
      data.spaces.push(space);active=space.id;tab="inicio";creatingRole="";persist();return;
    }
    if(f.id==="rule-form"){
      s.rules.push({id:uid(),title:String(v.get("title")).trim(),detail:String(v.get("detail")).trim()});persist();return;
    }
    if(f.id==="task-form"){
      const frequency=String(v.get("frequency"));
      const next={title:String(v.get("title")).trim(),instructions:String(v.get("instructions")).trim(),frequency,requiredCount:frequency==="once"?1:Number(v.get("requiredCount"))||1,due:String(v.get("due")||""),deadlineTime:String(v.get("deadlineTime")||"")};
      const current=s.tasks.find(t=>t.id===editingTaskId);
      if(current){const reset=current.frequency!==frequency||targetCount(current)!==next.requiredCount;Object.assign(current,next,{completions:reset?{}:(current.completions||{})});editingTaskId=null}
      else s.tasks.push({id:uid(),...next,completions:{},done:false});
      persist();return;
    }
    if(f.id==="profile-form"){
      s.profile=String(v.get("name")).trim();s.address=String(v.get("address"));s.limits=String(v.get("limits")).trim();persist();
    }
  });

  const observer=new MutationObserver(()=>{
    const app=document.querySelector("#app-screen");
    if(!app)return;
    if(!app.hidden){host.hidden=true;shell.hidden=false;render()}
    else{shell.hidden=true;host.hidden=false}
  });
  const appScreen=document.querySelector("#app-screen");
  if(appScreen)observer.observe(appScreen,{attributes:true,attributeFilter:["hidden"]});
  document.querySelector("#leave-button")?.addEventListener("click",()=>{shell.hidden=true;host.hidden=false});
})();
