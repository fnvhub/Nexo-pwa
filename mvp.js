// Nexo MVP: single-device prototype. Replace LocalStore with the authenticated API adapter before multi-user use.
(() => {
  const host = document.querySelector("#app-screen .workspace-content");
  if (!host) return;
  const KEY = "nexo.mvp.v1";
  const uid = () => crypto.randomUUID();
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || { spaces: [] }; } catch { return { spaces: [] }; } };
  const save = (data) => localStorage.setItem(KEY, JSON.stringify(data));
  const esc = (s = "") => String(s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  let active = null, tab = "inicio";
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

  function base(space) { return `<header class="nexo-row"><div><span class="nexo-tag">${space.role === "DOM" ? "DINÁMICA · DOM" : "ESPACIO · SUM"}</span><h1>${esc(space.name)}</h1></div><button class="nexo-small" data-action="back">Salir</button></header>
    <div class="nexo-alert"><strong>Prototipo local.</strong> Los datos viven en este navegador y no se sincronizan. El PIN protege la entrada en este dispositivo; no cifra los datos. No guardes información sensible todavía.</div>
    <nav class="nexo-tabs" aria-label="Secciones">${["inicio","acuerdos","tareas","perfil"].map(x=>`<button data-tab="${x}" aria-pressed="${tab===x}">${({inicio:"Inicio",acuerdos:"Acuerdos",tareas:"Tareas",perfil:"Perfil"})[x]}</button>`).join("")}</nav>
    <div id="nexo-panel"></div>`; }
  function render() {
    const activeSpace = active && data.spaces.find(s => s.id === active);
    if (!activeSpace) { active = null; shell.innerHTML = `<h1>Tus espacios</h1><p class="nexo-muted">Crea una dinámica de prueba DOM o un espacio SUM. Cada espacio tiene su propio conjunto local de datos.</p><div class="nexo-row"><button data-action="create" data-role="DOM">Crear como DOM</button><button class="secondary" data-action="create" data-role="SUM">Crear como SUM</button></div><div id="spaces"></div>`;
      const list = shell.querySelector("#spaces");
      list.innerHTML = data.spaces.map(s=>`<article class="nexo-card"><span class="nexo-tag">${s.role}</span><h2>${esc(s.name)}</h2><p class="nexo-muted">${s.rules.length} acuerdos · ${s.tasks.length} tareas</p><button data-action="open" data-id="${s.id}">Abrir espacio</button></article>`).join("") || `<p class="nexo-muted">Aún no hay espacios en este dispositivo.</p>`;
      return;
    }
    shell.innerHTML = base(activeSpace);
    const panel=shell.querySelector("#nexo-panel");
    if(tab==="inicio") panel.innerHTML=`<section class="nexo-card"><h2>Resumen</h2><p class="nexo-muted">${activeSpace.rules.length} acuerdos · ${activeSpace.tasks.filter(t=>!t.done).length} tareas pendientes</p><p class="nexo-muted">${activeSpace.pause?"La dinámica está en pausa.":"La dinámica está activa."}</p>${activeSpace.role==="DOM"?`<button class="nexo-small" data-action="pause">${activeSpace.pause?"Reanudar":"Poner en pausa"}</button>`:""}</section><section class="nexo-card"><h2>Nota privada</h2><p class="nexo-muted">Solo se guarda en este navegador.</p><textarea id="note" class="nexo-form" placeholder="Escribe una nota para ti">${esc(activeSpace.note||"")}</textarea><button class="nexo-small" data-action="note">Guardar nota</button></section>`;
    if(tab==="acuerdos") panel.innerHTML=`<section class="nexo-card"><h2>Acuerdos y límites</h2>${activeSpace.role==="DOM"?`<form class="nexo-form" id="rule-form"><input name="title" maxlength="100" required placeholder="Nuevo acuerdo"><textarea name="detail" maxlength="500" placeholder="Detalle (opcional)"></textarea><button>Añadir acuerdo</button></form>`:`<p class="nexo-muted">Los acuerdos registrados en este espacio.</p>`}${activeSpace.rules.map((r,i)=>`<div class="nexo-item"><strong>${esc(r.title)}</strong><p>${esc(r.detail)}</p>${activeSpace.role==="DOM"?`<button class="nexo-small" data-action="delete-rule" data-index="${i}">Eliminar</button>`:""}</div>`).join("")||`<p class="nexo-muted">Todavía no hay acuerdos.</p>`}</section>`;
    if(tab==="tareas") panel.innerHTML=`<section class="nexo-card"><h2>Tareas</h2>${activeSpace.role==="DOM"?`<form class="nexo-form" id="task-form"><input name="title" maxlength="120" required placeholder="Describe una tarea"><input name="due" type="date" aria-label="Fecha límite"><button>Asignar tarea</button></form>`:""}${activeSpace.tasks.map((t,i)=>`<div class="nexo-item"><strong>${esc(t.title)}</strong><p>${t.due?"Fecha: "+esc(t.due):"Sin fecha límite"} · ${t.done?"Completada":"Pendiente"}</p>${!t.done?`<button class="nexo-small" data-action="done" data-index="${i}">${activeSpace.role==="DOM"?"Validar cumplimiento":"Marcar como completada"}</button>`:""}</div>`).join("")||`<p class="nexo-muted">Todavía no hay tareas.</p>`}</section>`;
    if(tab==="perfil") panel.innerHTML=`<section class="nexo-card"><h2>Perfil de este espacio</h2><form id="profile-form" class="nexo-form"><label>Nombre<input name="name" maxlength="80" value="${esc(activeSpace.profile||"")}" placeholder="Cómo quieres que te llamen"></label><label>Forma de tratamiento<select name="address"><option ${activeSpace.address==="Tú"?"selected":""}>Tú</option><option ${activeSpace.address==="Usted"?"selected":""}>Usted</option><option ${activeSpace.address==="Personalizada"?"selected":""}>Personalizada</option></select></label><label>Preferencias y límites<textarea name="limits" maxlength="1000" placeholder="Anota límites y preferencias">${esc(activeSpace.limits||"")}</textarea></label><button>Guardar perfil</button></form></section>`;
  }
  function persist(){save(data);render();}
  shell.addEventListener("click",e=>{const b=e.target.closest("button");if(!b)return; const s=active&&data.spaces.find(x=>x.id===active); if(b.dataset.tab){tab=b.dataset.tab;render();return;} switch(b.dataset.action){case"create":{const name=prompt("Nombre para este espacio:", b.dataset.role==="DOM"?"Mi dinámica":"Mi espacio");if(!name?.trim())return;const space={id:uid(),role:b.dataset.role,name:name.trim(),rules:[],tasks:[],pause:false};data.spaces.push(space);active=space.id;tab="inicio";persist();break;}case"open":active=b.dataset.id;tab="inicio";render();break;case"back":active=null;persist();break;case"pause":s.pause=!s.pause;persist();break;case"note":s.note=shell.querySelector("#note").value;persist();break;case"delete-rule":s.rules.splice(+b.dataset.index,1);persist();break;case"done":s.tasks[+b.dataset.index].done=true;persist();break;}});
  shell.addEventListener("submit",e=>{e.preventDefault();const s=data.spaces.find(x=>x.id===active);const f=e.target;const v=new FormData(f);if(f.id==="rule-form")s.rules.push({id:uid(),title:v.get("title").trim(),detail:v.get("detail").trim()});if(f.id==="task-form")s.tasks.push({id:uid(),title:v.get("title").trim(),due:v.get("due"),done:false});if(f.id==="profile-form"){s.profile=v.get("name").trim();s.address=v.get("address");s.limits=v.get("limits").trim();}persist();});
  // Replace the placeholder workspace with the MVP once the existing PIN gate admits the user.
  const enter = document.querySelector("#enter-button");
  const observer = new MutationObserver(()=>{if(!document.querySelector("#app-screen").hidden){host.hidden=true;shell.hidden=false;render();}else if(!document.querySelector("#pin-screen").hidden){shell.hidden=true;host.hidden=false;}});
  observer.observe(document.querySelector("#app-screen"),{attributes:true,attributeFilter:["hidden"]});
  document.querySelector("#leave-button")?.addEventListener("click",()=>{shell.hidden=true;host.hidden=false;});
})();
