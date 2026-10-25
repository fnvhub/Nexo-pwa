// Nexo MVP: single-device prototype. Replace LocalStore with the authenticated API adapter before multi-user use.
(() => {
  const host = document.querySelector("#app-screen .workspace-content");
  if (!host) return;
  const KEY = "nexo.mvp.v1";
  const uid = () => crypto.randomUUID();
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || { spaces: [] }; } catch { return { spaces: [] }; } };
  const save = (data) => localStorage.setItem(KEY, JSON.stringify(data));
  const esc = (s = "") => String(s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  let active = null, tab = "inicio", creatingRole = "", editingTaskId = null, confirmingTaskDelete = null;
  const style = document.createElement("style");
  style.textContent = `
    .nexo-tabs{display:flex;gap:8px;overflow:auto;margin:16px 0}.nexo-tabs button,.nexo-small{width:auto;min-height:40px;padding:9px 13px;background:#29232f;color:#f3eef5;border:1px solid #403847;border-radius:12px;font-size:14px}
    .nexo-card{padding:18px;margin:12px 0;border:1px solid #403847;background:#19151e;border-radius:16px}.nexo-card h2{font-size:20px;margin:0 0 10px}.nexo-muted{color:#aaa2ae;font-size:14px;line-height:1.5}
    .nexo-form{display:grid;gap:10px;margin:14px 0}.nexo-form input,.nexo-form textarea,.nexo-form select{width:100%;padding:12px;border-radius:11px;border:1px solid #514958;background:#100e13;color:#f3eef5;font:inherit}.nexo-form textarea{min-height:76px;resize:vertical}.nexo-row{display:flex;align-items:center;gap:10px;flex-wrap:wrap}.nexo-row button{flex:1}.nexo-check{width:auto!important}.nexo-alert{padding:12px;border-radius:12px;background:#2a2013;color:#f3d4a4;font-size:13px;line-height:1.5}.nexo-item{padding:13px 0;border-top:1px solid #302b35}.nexo-item p{margin:5px 0;color:#aaa2ae}.nexo-item button{margin-top:8px}.nexo-tag{font-size:12px;color:#c9a9ff}
  `;
  document.head.append(style);
  const shell = document.createElement("div");
  shell.id = "nexo-workspace";
  shell.hidden = true;
  host.after(shell);
  const data = load();

  function base(space) { return `<header class="nexo-row"><div><span class="nexo-tag">${space.role === "DOM" ? "DINÁMICA · DOM" : "ESPACIO · SUM"}</span><h1>${esc(space.name)}</h1></div><div class="nexo-row"><button class="nexo-small" data-action="accounts">Cuentas e invitaciones</button><button class="nexo-small" data-action="back">Salir</button></div></header>
    <div class="nexo-alert"><strong>Prototipo local.</strong> Los datos viven en este navegador y no se sincronizan. El PIN protege la entrada en este dispositivo; no cifra los datos. No guardes información sensible todavía.</div>
    <nav class="nexo-tabs" aria-label="Secciones">${["inicio","acuerdos","tareas","perfil"].map(x=>`<button data-tab="${x}" aria-pressed="${tab===x}">${({inicio:"Inicio",acuerdos:"Acuerdos",tareas:"Tareas",perfil:"Perfil"})[x]}</button>`).join("")}</nav>
    <div id="nexo-panel"></div>`; }
  function periodKey(task) {
    const now = new Date();
    const localDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (task.frequency === "weekly") { const day = (localDate.getDay() + 6) % 7; localDate.setDate(localDate.getDate() - day); }
    if (task.frequency === "monthly") return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`;
    if (task.frequency === "once") return "once";
    return `${localDate.getFullYear()}-${String(localDate.getMonth()+1).padStart(2,"0")}-${String(localDate.getDate()).padStart(2,"0")}`;
  }
  function targetCount(task) { return task.frequency === "once" || !task.frequency ? 1 : Math.max(1, Number(task.requiredCount) || 1); }
  function completedCount(task) {
    if (!task.frequency && task.done) return 1;
    const count = Number(task.completions?.[periodKey(task)]) || 0;
    return Math.min(count, targetCount(task));
  }
  const frequencyLabel = f => ({once:"Puntual",daily:"Diaria",weekly:"Semanal",monthly:"Mensual"}[f] || "Puntual");
  function updateTaskFrequency(form) {
    const frequency = form.elements.frequency.value;
    const countWrap = form.querySelector("[data-count-wrap]");
    const countInput = form.elements.requiredCount;
    const units = {daily:"veces al día",weekly:"veces a la semana",monthly:"veces al mes"};
    countWrap.hidden = frequency === "once";
    countInput.required = frequency !== "once";
    form.querySelector("[data-count-label]").textContent = units[frequency] || "Veces";
  }
  function taskForm(space) {
    if (space.role !== "DOM") return "";
    const task = space.tasks.find(t => t.id === editingTaskId);
    const value = (key, fallback="") => esc(task?.[key] ?? fallback);
    const frequency = task?.frequency || "once";
    return `<form class="nexo-form" id="task-form"><strong>${task ? "Editar tarea" : "Nueva tarea"}</strong><label>Qué tiene que hacer<input name="title" maxlength="120" required placeholder="Acción concreta, por ejemplo: ordenar la mesa" value="${value("title")}"></label><label>Instrucciones claras<textarea name="instructions" minlength="10" maxlength="1000" required placeholder="Explica los pasos y cómo sabrá que está terminado.">${value("instructions")}</textarea></label><label>Frecuencia<select name="frequency"><option value="once" ${frequency==="once"?"selected":""}>Puntual (una vez)</option><option value="daily" ${frequency==="daily"?"selected":""}>Diaria</option><option value="weekly" ${frequency==="weekly"?"selected":""}>Semanal</option><option value="monthly" ${frequency==="monthly"?"selected":""}>Mensual</option></select></label><label data-count-wrap ${frequency==="once"?"hidden":""}><span data-count-label>${({daily:"veces al día",weekly:"veces a la semana",monthly:"veces al mes"}[frequency])||"Veces"}</span><input name="requiredCount" type="number" min="1" max="99" value="${value("requiredCount",1)}" ${frequency==="once"?"":"required"}></label><label>Fecha límite<input name="due" type="date" value="${value("due")}"></label><label>Hora límite<input name="deadlineTime" type="time" aria-label="Hora límite" value="${value("deadlineTime")}"></label><div class="nexo-row"><button>${task?"Guardar cambios":"Asignar tarea"}</button>${task?`<button class="nexo-small" type="button" data-action="cancel-edit-task">Cancelar edición</button>`:""}</div></form>`;
  }
  function render() {
    const activeSpace = active && data.spaces.find(s => s.id === active);
    if (!activeSpace) { active = null; shell.innerHTML = `<h1>Tus espacios</h1><p class="nexo-muted">Crea un espacio de prueba local o accede con cuenta para invitar a otra persona.</p><div class="nexo-row"><button data-action="accounts">Cuenta e invitaciones</button><button class="nexo-small" data-action="start-create" data-role="DOM">Crear como DOM</button><button class="nexo-small" data-action="start-create" data-role="SUM">Crear como SUM</button></div>${creatingRole?`<form class="nexo-form nexo-card" id="create-form"><strong>Nuevo espacio local · ${creatingRole}</strong><input name="spaceName" maxlength="100" required placeholder="Nombre del espacio" value="${creatingRole==="DOM"?"Mi dinámica":"Mi espacio"}"><div class="nexo-row"><button>Crear espacio</button><button class="nexo-small" type="button" data-action="cancel-create">Cancelar</button></div></form>`:""}<div id="spaces"></div>`;
      const list = shell.querySelector("#spaces");
      list.innerHTML = data.spaces.map(s=>`<article class="nexo-card"><span class="nexo-tag">${s.role}</span><h2>${esc(s.name)}</h2><p class="nexo-muted">${s.rules.length} acuerdos · ${s.tasks.length} tareas</p><button data-action="open" data-id="${s.id}">Abrir espacio</button></article>`).join("") || `<p class="nexo-muted">Aún no hay espacios en este dispositivo.</p>`;
      return;
    }
    shell.innerHTML = base(activeSpace);
    const panel=shell.querySelector("#nexo-panel");
    if(tab==="inicio") panel.innerHTML=`<section class="nexo-card"><h2>Resumen</h2><p class="nexo-muted">${activeSpace.rules.length} acuerdos · ${activeSpace.tasks.filter(t=>completedCount(t)<targetCount(t)).length} tareas pendientes</p><p class="nexo-muted">${activeSpace.pause?"La dinámica está en pausa.":"La dinámica está activa."}</p>${activeSpace.role==="DOM"?`<button class="nexo-small" data-action="pause">${activeSpace.pause?"Reanudar":"Poner en pausa"}</button>`:""}</section><section class="nexo-card"><h2>Nota privada</h2><p class="nexo-muted">Solo se guarda en este navegador.</p><textarea id="note" class="nexo-form" placeholder="Escribe una nota para ti">${esc(activeSpace.note||"")}</textarea><button class="nexo-small" data-action="note">Guardar nota</button></section>`;
    if(tab==="acuerdos") panel.innerHTML=`<section class="nexo-card"><h2>Acuerdos y límites</h2>${activeSpace.role==="DOM"?`<form class="nexo-form" id="rule-form"><input name="title" maxlength="100" required placeholder="Nuevo acuerdo"><textarea name="detail" maxlength="500" placeholder="Detalle (opcional)"></textarea><button>Añadir acuerdo</button></form>`:`<p class="nexo-muted">Los acuerdos registrados en este espacio.</p>`}${activeSpace.rules.map((r,i)=>`<div class="nexo-item"><strong>${esc(r.title)}</strong><p>${esc(r.detail)}</p>${activeSpace.role==="DOM"?`<button class="nexo-small" data-action="delete-rule" data-index="${i}">Eliminar</button>`:""}</div>`).join("")||`<p class="nexo-muted">Todavía no hay acuerdos.</p>`}</section>`;
    if(tab==="tareas") panel.innerHTML=`<section class="nexo-card"><h2>Tareas</h2>${taskForm(activeSpace)}${activeSpace.tasks.map((t,i)=>{const target=targetCount(t),count=completedCount(t),complete=count>=target;return `<div class="nexo-item"><strong>${esc(t.title)}</strong><p><strong>Instrucciones:</strong> ${esc(t.instructions||"Consulta con el DOM los detalles de esta tarea.")}</p><p>${frequencyLabel(t.frequency)}${target>1?` · ${count} de ${target} veces en este periodo`:""} · ${complete?"Completada este periodo":"Pendiente"}</p><p>${t.due?"Fecha límite: "+esc(t.due):"Sin fecha límite"}${t.deadlineTime?" · Hora límite: "+esc(t.deadlineTime):""}</p>${!complete?`<button class="nexo-small" data-action="done" data-index="${i}">${activeSpace.role==="DOM"?"Validar cumplimiento":"Marcar como hecha"}</button>`:""}${activeSpace.role==="DOM"?`<div class="nexo-row"><button class="nexo-small" data-action="edit-task" data-id="${t.id}">Editar</button><button class="nexo-small" data-action="ask-delete-task" data-id="${t.id}">Borrar</button></div>${confirmingTaskDelete===t.id?`<p class="nexo-alert">¿Borrar “${esc(t.title)}”? Esta acción no se puede deshacer.</p><div class="nexo-row"><button class="nexo-small" data-action="confirm-delete-task" data-id="${t.id}">Sí, borrar tarea</button><button class="nexo-small" data-action="cancel-delete-task">Cancelar</button></div>`:""}`:""}</div>`}).join("")||`<p class="nexo-muted">Todavía no hay tareas.</p>`}</section>`;
    if(tab==="perfil") panel.innerHTML=`<section class="nexo-card"><h2>Perfil de este espacio</h2><form id="profile-form" class="nexo-form"><label>Nombre<input name="name" maxlength="80" value="${esc(activeSpace.profile||"")}" placeholder="Cómo quieres que te llamen"></label><label>Forma de tratamiento<select name="address"><option ${activeSpace.address==="Tú"?"selected":""}>Tú</option><option ${activeSpace.address==="Usted"?"selected":""}>Usted</option><option ${activeSpace.address==="Personalizada"?"selected":""}>Personalizada</option></select></label><label>Preferencias y límites<textarea name="limits" maxlength="1000" placeholder="Anota límites y preferencias">${esc(activeSpace.limits||"")}</textarea></label><button>Guardar perfil</button></form></section>`;
  }
  function persist(){save(data);render();}
  shell.addEventListener("change",e=>{if(e.target.form?.id==="task-form"&&e.target.name==="frequency")updateTaskFrequency(e.target.form);});
  shell.addEventListener("click",e=>{const b=e.target.closest("button");if(!b)return; const s=active&&data.spaces.find(x=>x.id===active); if(b.dataset.tab){tab=b.dataset.tab;render();return;} switch(b.dataset.action){case"start-create":creatingRole=b.dataset.role;render();break;case"cancel-create":creatingRole="";render();break;case"open":active=b.dataset.id;tab="inicio";render();break;case"back":active=null;creatingRole="";persist();break;case"pause":s.pause=!s.pause;persist();break;case"note":s.note=shell.querySelector("#note").value;persist();break;case"delete-rule":s.rules.splice(+b.dataset.index,1);persist();break;case"edit-task":editingTaskId=b.dataset.id;confirmingTaskDelete=null;render();break;case"cancel-edit-task":editingTaskId=null;render();break;case"ask-delete-task":confirmingTaskDelete=b.dataset.id;render();break;case"cancel-delete-task":confirmingTaskDelete=null;render();break;case"confirm-delete-task":s.tasks=s.tasks.filter(t=>t.id!==b.dataset.id);confirmingTaskDelete=null;if(editingTaskId===b.dataset.id)editingTaskId=null;persist();break;case"accounts":window.dispatchEvent(new Event("nexo:open-cloud"));break;case"done":{const task=s.tasks[+b.dataset.index], key=periodKey(task);task.completions={...(task.completions||{}),[key]:Math.min(targetCount(task),completedCount(task)+1)};task.done=completedCount(task)>=targetCount(task);persist();break;}}});
  shell.addEventListener("submit",e=>{e.preventDefault();const f=e.target;const v=new FormData(f);if(f.id==="create-form"){const space={id:uid(),role:creatingRole,name:v.get("spaceName").trim(),rules:[],tasks:[],pause:false};data.spaces.push(space);active=space.id;tab="inicio";creatingRole="";persist();return;}const s=data.spaces.find(x=>x.id===active);if(f.id==="rule-form")s.rules.push({id:uid(),title:v.get("title").trim(),detail:v.get("detail").trim()});if(f.id==="task-form"){const frequency=v.get("frequency"),next={title:v.get("title").trim(),instructions:v.get("instructions").trim(),frequency,requiredCount:frequency==="once"?1:Number(v.get("requiredCount")),due:v.get("due"),deadlineTime:v.get("deadlineTime")};const current=s.tasks.find(t=>t.id===editingTaskId);if(current){const reset=current.frequency!==frequency||targetCount(current)!==next.requiredCount;Object.assign(current,next,{completions:reset?{}:(current.completions||{})});editingTaskId=null;}else s.tasks.push({id:uid(),...next,completions:{},done:false});}if(f.id==="profile-form"){s.profile=v.get("name").trim();s.address=v.get("address");s.limits=v.get("limits").trim();}persist();});
  // Replace the placeholder workspace with the MVP once the existing PIN gate admits the user.
  const enter = document.querySelector("#enter-button");
  const observer = new MutationObserver(()=>{if(!document.querySelector("#app-screen").hidden){host.hidden=true;shell.hidden=false;render();}else if(!document.querySelector("#pin-screen").hidden){shell.hidden=true;host.hidden=false;}});
  observer.observe(document.querySelector("#app-screen"),{attributes:true,attributeFilter:["hidden"]});
  document.querySelector("#leave-button")?.addEventListener("click",()=>{shell.hidden=true;host.hidden=false;});
})();
