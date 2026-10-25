(() => {
  const local = document.querySelector("#nexo-workspace");
  if (!local) return;
  const root = document.createElement("div");
  root.id = "nexo-cloud";
  root.hidden = true;
  local.after(root);
  const CONFIG_KEY = "nexo.supabase.config.v1";
  const PENDING_INVITE = "nexo.pending.invite.v1";
  const INSTALL_URL = "https://fnvhub.github.io/Nexo-pwa/";
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  let config = readConfig(), client = null, user = null, activeDynamic = null;
  let role = "", editingId = null, deleteId = null, messageText = "", messageError = false;
  const styles = document.createElement("style");
  styles.textContent = "#nexo-cloud{color:#f3eef5}#nexo-cloud[hidden]{display:none}.nc-card{padding:18px;margin:12px 0;border:1px solid #403847;background:#19151e;border-radius:16px}.nc-card h2{margin:0 0 10px;font-size:20px}.nc-muted{color:#aaa2ae;font-size:14px;line-height:1.5}.nc-form{display:grid;gap:10px;margin:14px 0}.nc-form input,.nc-form textarea,.nc-form select{width:100%;padding:12px;border-radius:11px;border:1px solid #514958;background:#100e13;color:#f3eef5;font:inherit}.nc-form textarea{min-height:80px}.nc-row{display:flex;gap:9px;flex-wrap:wrap}.nc-row button,.nc-small{width:auto;min-height:40px;padding:9px 13px;background:#29232f;color:#f3eef5;border:1px solid #403847;border-radius:12px;font-size:14px}.nc-alert{padding:12px;border-radius:12px;background:#2a2013;color:#f3d4a4;font-size:13px;line-height:1.5}.nc-item{padding:13px 0;border-top:1px solid #302b35}.nc-item p{margin:5px 0;color:#aaa2ae}.nc-error{color:#ffb3b3}.nc-success{color:#b8e4c8}.nc-tag{font-size:12px;color:#c9a9ff}";
  document.head.append(styles);

  function readConfig() { try { return JSON.parse(localStorage.getItem(CONFIG_KEY) || "null"); } catch { return null; } }
  function isPublishableKey(key) {
    if (key.startsWith("sb_publishable_")) return true;
    if (key.startsWith("sb_secret_")) return false;
    try {
      const part=key.split(".")[1]; if(!part) return false;
      const payload=JSON.parse(atob(part.replace(/-/g,"+").replace(/_/g,"/")));
      return payload.role === "anon";
    } catch { return false; }
  }
  try {
    const token = new URL(location.href).searchParams.get("invite");
    if (token) localStorage.setItem(PENDING_INVITE, token);
  } catch {}
  function frame(title, body) {
    root.innerHTML = '<header class="nc-row" style="align-items:center;justify-content:space-between"><div><span class="nc-tag">CUENTA E INVITACIONES · NEXO v0.5.1</span><h1>' + esc(title) + '</h1></div><button class="nc-small" data-action="local">Volver a espacios locales</button></header><p id="nc-message" class="' + (messageError ? "nc-error" : "nc-muted") + '" role="status">' + esc(messageText) + '</p>' + body;
  }
  function show(message, error) {
    messageText = message || "";
    messageError = !!error;
    const el = root.querySelector("#nc-message");
    if (el) { el.textContent = messageText; el.className = messageError ? "nc-error" : "nc-success"; }
  }
  function connect() {
    if (client) return true;
    if (!config || !window.supabase || !window.supabase.createClient) return false;
    client = window.supabase.createClient(config.url, config.key, {auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
    client.auth.onAuthStateChange((_event, session) => {
      setTimeout(async () => {
        user = session && session.user ? session.user : null;
        if (user) { await acceptInvite(); if (activeDynamic) await renderDynamic(); else await renderHome(); }
        else renderAuth();
      }, 0);
    });
    return true;
  }
  function renderSetup() {
    frame("Conectar cuenta", '<section class="nc-card"><h2>Configura tu espacio privado</h2><p class="nc-muted">Conecta el proyecto Supabase para crear cuentas e invitaciones. Solo usa la URL del proyecto y la clave publicable. Nunca introduzcas una clave service_role.</p><form id="nc-config" class="nc-form"><label>URL del proyecto<input name="url" type="url" required placeholder="https://tu-proyecto.supabase.co" value="' + esc(config && config.url) + '"></label><label>Clave publicable<input name="key" required autocomplete="off" placeholder="sb_publishable_…" value="' + esc(config && config.key) + '"></label><button>Conectar</button></form><p class="nc-muted">Antes, aplica supabase/schema.sql en el SQL Editor de Supabase y añade https://fnvhub.github.io como sitio permitido en Authentication → URL Configuration.</p></section>');
  }
  function renderAuth() {
    frame("Entrar o crear cuenta", '<section class="nc-card"><h2>' + (localStorage.getItem(PENDING_INVITE) ? "Invitación pendiente" : "Acceso privado") + '</h2><p class="nc-muted">Usa la misma cuenta en tus dispositivos. Solo aparecerán las dinámicas donde seas miembro.</p><form id="nc-auth" class="nc-form"><label>Correo electrónico<input name="email" type="email" required autocomplete="email"></label><label>Contraseña<input name="password" type="password" required minlength="8" autocomplete="current-password"></label><div class="nc-row"><button name="mode" value="login">Iniciar sesión</button><button class="nc-small" name="mode" value="signup">Crear cuenta</button></div></form><button class="nc-small" data-action="config">Cambiar configuración</button></section>');
  }
  async function rpc(name, args) {
    const result = await client.rpc(name, args);
    if (result.error) throw result.error;
    return result.data;
  }
  async function acceptInvite() {
    const token = localStorage.getItem(PENDING_INVITE);
    if (!token || !user) return;
    try {
      const id = await rpc("accept_dynamic_invite", {invite_token:token});
      activeDynamic = String(id);
      localStorage.removeItem(PENDING_INVITE);
      history.replaceState({}, "", location.pathname);
      show("Invitación aceptada. Esta cuenta se ha unido solo a esa dinámica.", false);
    } catch (e) { show("No se pudo aceptar la invitación: " + e.message, true); }
  }
  async function render() {
    if (!client) return renderSetup();
    const {data, error} = await client.auth.getSession();
    if (error) { renderAuth(); return show(error.message, true); }
    user = data.session && data.session.user ? data.session.user : null;
    if (!user) return renderAuth();
    await acceptInvite();
    if (activeDynamic) return renderDynamic();
    return renderHome();
  }
  async function renderHome() {
    if (!client || !user) return renderAuth();
    activeDynamic = null;
    frame("Tus dinámicas", '<section class="nc-card"><h2>' + esc(user.email) + '</h2><p class="nc-muted">Cada cuenta solo ve las dinámicas donde es miembro. Una invitación da acceso a un único espacio.</p></section><section class="nc-card"><h2>Crear dinámica DOM</h2><form id="nc-create" class="nc-form"><label>Nombre de la dinámica<input name="name" maxlength="100" required placeholder="Nombre privado para este espacio"></label><button>Crear dinámica</button></form></section><section class="nc-card"><h2>Unirme con invitación</h2><p class="nc-muted">Pega un enlace o código de invitación si no has llegado desde el enlace.</p><form id="nc-join" class="nc-form"><input name="invite" placeholder="Enlace o código de invitación"><button>Unirme</button></form></section><section class="nc-card"><h2>Mis dinámicas</h2><div id="nc-dynamics" class="nc-muted">Cargando…</div></section><button class="nc-small" data-action="signout">Cerrar sesión</button>');
    const {data:members, error} = await client.from("memberships").select("dynamic_id,role").eq("user_id",user.id);
    const list = root.querySelector("#nc-dynamics");
    if (error) return list.innerHTML = '<p class="nc-error">' + esc(error.message) + '</p>';
    const ids = (members || []).map(x => x.dynamic_id);
    if (!ids.length) return list.textContent = "Aún no tienes dinámicas. Crea una como DOM o acepta una invitación.";
    const {data:dynamics, error:dError} = await client.from("dynamics").select("id,name,paused").in("id",ids);
    if (dError) return list.innerHTML = '<p class="nc-error">' + esc(dError.message) + '</p>';
    list.innerHTML = (dynamics || []).map(d => {
      const m = members.find(x => x.dynamic_id === d.id), r = m ? m.role : "SUM";
      return '<article class="nc-item"><strong>' + esc(d.name) + '</strong><p>' + r + ' · ' + (d.paused ? "En pausa" : "Activa") + '</p><div class="nc-row"><button data-action="open" data-id="' + esc(d.id) + '" data-role="' + r + '">Abrir</button>' + (r === "DOM" ? '<button class="nc-small" data-action="invite" data-id="' + esc(d.id) + '" data-name="' + esc(d.name) + '">Crear invitación</button>' : "") + '</div></article>';
    }).join("");
  }
  function period(t) {
    const now = new Date(), d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    if (t.frequency === "monthly") return now.getUTCFullYear() + "-" + String(now.getUTCMonth()+1).padStart(2,"0");
    if (t.frequency === "weekly") d.setUTCDate(d.getUTCDate() - ((d.getUTCDay()+6)%7));
    if (t.frequency === "once") return "once";
    return d.getUTCFullYear() + "-" + String(d.getUTCMonth()+1).padStart(2,"0") + "-" + String(d.getUTCDate()).padStart(2,"0");
  }
  async function renderDynamic() {
    const id = activeDynamic;
    const {data:d, error} = await client.from("dynamics").select("id,name,paused").eq("id",id).single();
    if (error) { activeDynamic = null; await renderHome(); return show(error.message,true); }
    const {data:members} = await client.from("memberships").select("user_id,role").eq("dynamic_id",id);
    role = (members || []).find(m => m.user_id === user.id)?.role || "SUM";
    const results = await Promise.all([
      client.from("tasks").select("*").eq("dynamic_id",id).order("created_at"),
      client.from("profiles").select("user_id,display_name,address_style,preferences,limits").eq("dynamic_id",id),
      client.from("task_completions").select("task_id,user_id,period_key,completed_at").eq("dynamic_id",id)
    ]);
    const err = results.find(r => r.error);
    if (err) return frame(d.name, '<p class="nc-error">' + esc(err.error.message) + '</p>');
    const tasks = results[0].data || [], profiles = results[1].data || [], completions = results[2].data || [];
    const own = profiles.find(p => p.user_id === user.id) || {};
    const nameFor = uid => (profiles.find(p => p.user_id === uid) || {}).display_name || "Miembro";
    const edit = tasks.find(t => t.id === editingId);
    let taskForm = "";
    if (role === "DOM") taskForm = '<section class="nc-card"><h2>' + (edit ? "Editar tarea" : "Nueva tarea") + '</h2><form id="nc-task" class="nc-form"><label>Qué tiene que hacer<input name="title" required maxlength="120" value="' + esc(edit?.title || "") + '"></label><label>Instrucciones claras<textarea name="instructions" required minlength="10" maxlength="1000">' + esc(edit?.instructions || "") + '</textarea></label><label>Frecuencia<select name="frequency"><option value="once" ' + (!edit || edit.frequency==="once"?"selected":"") + '>Puntual</option><option value="daily" ' + (edit?.frequency==="daily"?"selected":"") + '>Diaria</option><option value="weekly" ' + (edit?.frequency==="weekly"?"selected":"") + '>Semanal</option><option value="monthly" ' + (edit?.frequency==="monthly"?"selected":"") + '>Mensual</option></select></label><label>Veces por periodo<input name="required_count" type="number" min="1" max="99" value="' + esc(edit?.required_count || 1) + '"></label><label>Fecha límite<input name="due_date" type="date" value="' + esc(edit?.due_date || "") + '"></label><label>Hora límite<input name="deadline_time" type="time" value="' + esc(edit?.deadline_time || "") + '"></label><div class="nc-row"><button>' + (edit ? "Guardar cambios" : "Asignar tarea") + '</button>' + (edit ? '<button type="button" class="nc-small" data-action="cancel-edit">Cancelar</button>' : "") + '</div></form></section>';
    const taskHtml = tasks.map(t => {
      const key = period(t), target = t.frequency === "once" ? 1 : Number(t.required_count) || 1;
      const mine = completions.filter(c => c.task_id === t.id && c.period_key === key && c.user_id === user.id).length;
      const theirs = completions.filter(c => c.task_id === t.id && c.period_key === key);
      const labels = {once:"Puntual",daily:"Diaria",weekly:"Semanal",monthly:"Mensual"};
      return '<article class="nc-item"><strong>' + esc(t.title) + '</strong><p><strong>Instrucciones:</strong> ' + esc(t.instructions) + '</p><p>' + (labels[t.frequency] || "Puntual") + ' · ' + mine + '/' + target + ' veces este periodo</p><p>' + (t.due_date ? "Fecha límite: " + esc(t.due_date) : "Sin fecha límite") + (t.deadline_time ? " · Hora límite: " + esc(t.deadline_time) : "") + '</p>' + (role==="SUM" && mine<target ? '<button data-action="complete" data-id="' + esc(t.id) + '" data-period="' + esc(key) + '">Marcar una vez como hecha</button>' : "") + (role==="DOM" ? '<p class="nc-muted">' + (theirs.map(c => esc(nameFor(c.user_id)) + ": hecha").join(" · ") || "Aún sin registros") + '</p><div class="nc-row"><button class="nc-small" data-action="edit" data-id="' + esc(t.id) + '">Editar</button><button class="nc-small" data-action="ask-delete" data-id="' + esc(t.id) + '">Borrar</button></div>' + (deleteId===t.id ? '<p class="nc-alert">¿Borrar esta tarea y su historial? No se puede deshacer.</p><div class="nc-row"><button class="nc-small" data-action="delete" data-id="' + esc(t.id) + '">Sí, borrar</button><button class="nc-small" data-action="cancel-delete">Cancelar</button></div>' : "") : "") + '</article>';
    }).join("") || '<p class="nc-muted">Todavía no hay tareas.</p>';
    const profileHtml = role === "DOM"
      ? '<section class="nc-card"><h2>Perfiles de esta dinámica</h2>' + (profiles.map(p => '<article class="nc-item"><strong>' + esc(p.display_name || "Perfil sin nombre") + '</strong><p>' + esc(p.address_style || "") + '</p><p>' + esc(p.preferences || "") + '</p><p>' + esc(p.limits || "") + '</p></article>').join("") || '<p class="nc-muted">La SUM aún no ha completado su perfil.</p>') + '</section>'
      : '<section class="nc-card"><h2>Mi perfil en esta dinámica</h2><form id="nc-profile" class="nc-form"><label>Nombre<input name="display_name" maxlength="80" value="' + esc(own.display_name || "") + '"></label><label>Forma de tratamiento<select name="address_style"><option ' + (own.address_style==="Tú"?"selected":"") + '>Tú</option><option ' + (own.address_style==="Usted"?"selected":"") + '>Usted</option></select></label><label>Preferencias<textarea name="preferences" maxlength="1000">' + esc(own.preferences || "") + '</textarea></label><label>Límites<textarea name="limits" maxlength="1000">' + esc(own.limits || "") + '</textarea></label><button>Guardar mi perfil</button></form></section>';
    frame(d.name, '<p class="nc-muted">Acceso ' + role + ' · ' + (d.paused ? "En pausa" : "Activa") + '</p>' + (role==="DOM" ? '<button class="nc-small" data-action="invite" data-id="' + esc(id) + '" data-name="' + esc(d.name) + '">Invitar a una SUM</button>' : "") + taskForm + '<section class="nc-card"><h2>Tareas de esta dinámica</h2>' + taskHtml + '</section>' + profileHtml + '<button class="nc-small" data-action="home">Volver a mis dinámicas</button>');
  }
  function shareText(name,token) {
    const join = new URL(INSTALL_URL); join.searchParams.set("invite",token);
    return "Te invito a unirte a «" + name + "» en Nexo.\n\n1. Instala la PWA (no hace falta tienda): " + INSTALL_URL + "\n   iPhone/iPad: abre el enlace en Safari → Compartir → Añadir a pantalla de inicio.\n   Android: abre el enlace en Chrome → menú ⋮ → Instalar aplicación.\n\n2. Configura la conexión de Nexo con estos datos públicos del proyecto (la clave publicable no es una clave de administración):\n   URL: " + config.url + "\n   Clave publicable: " + config.key + "\n\n3. Abre este enlace de invitación y crea tu cuenta o inicia sesión: " + join.href + "\n\nEste enlace sirve una vez y caduca en 7 días. Solo da acceso a esta dinámica; no permite ver las demás.";
  }
  root.addEventListener("click", async e => {
    const b = e.target.closest("button"); if (!b) return;
    try {
      switch (b.dataset.action) {
        case "local": root.hidden=true; local.hidden=false; return;
        case "config": client=null; renderSetup(); return;
        case "home": activeDynamic=null; editingId=null; deleteId=null; await renderHome(); return;
        case "signout": await client.auth.signOut(); user=null; activeDynamic=null; await render(); return;
        case "open": activeDynamic=b.dataset.id; role=b.dataset.role; await renderDynamic(); return;
        case "invite": {
          const token=await rpc("create_dynamic_invite",{target_dynamic:b.dataset.id});
          const invitation=shareText(b.dataset.name,token);
          try { await navigator.clipboard.writeText(invitation); show("Invitación copiada.\n\n" + invitation,false); }
          catch { show("Copia y envía este texto:\n\n" + invitation,false); }
          return;
        }
        case "edit": editingId=b.dataset.id; await renderDynamic(); return;
        case "cancel-edit": editingId=null; await renderDynamic(); return;
        case "ask-delete": deleteId=b.dataset.id; await renderDynamic(); return;
        case "cancel-delete": deleteId=null; await renderDynamic(); return;
        case "delete": {
          const {error}=await client.from("tasks").delete().eq("id",b.dataset.id).eq("dynamic_id",activeDynamic);
          if(error) throw error; deleteId=null; editingId=null; await renderDynamic(); return;
        }
        case "complete": {
          await rpc("record_task_completion",{target_task:b.dataset.id}); await renderDynamic(); return;
        }
      }
    } catch(err) { show(err.message || String(err),true); }
  });
  root.addEventListener("submit", async e => {
    e.preventDefault();
    const f=e.target, v=new FormData(f);
    try {
      if(f.id==="nc-config") {
        const key=String(v.get("key")).trim();
        if(!isPublishableKey(key)) throw new Error("La clave debe ser la publicable (sb_publishable_…) o la antigua anon. No uses service_role ni sb_secret_.");
        config={url:String(v.get("url")).replace(/\/$/,""),key};
        localStorage.setItem(CONFIG_KEY,JSON.stringify(config)); connect(); await render(); return;
      }
      if(f.id==="nc-auth") {
        const mode=e.submitter?.value || "login", email=String(v.get("email")).trim(), password=String(v.get("password"));
        const result=mode==="signup" ? await client.auth.signUp({email,password,options:{emailRedirectTo:INSTALL_URL}}) : await client.auth.signInWithPassword({email,password});
        if(result.error) throw result.error;
        if(result.data.session) { user=result.data.user; await acceptInvite(); if(activeDynamic) await renderDynamic(); else await renderHome(); }
        else show("Revisa el correo para confirmar tu cuenta; la invitación queda pendiente.",false);
        return;
      }
      if(f.id==="nc-create") { await rpc("create_dynamic",{dynamic_name:String(v.get("name")).trim()}); await renderHome(); return; }
      if(f.id==="nc-join") {
        let token=String(v.get("invite")).trim(); try { token=new URL(token).searchParams.get("invite") || token; } catch {}
        localStorage.setItem(PENDING_INVITE,token); await acceptInvite(); await render(); return;
      }
      if(f.id==="nc-profile") {
        const profile={dynamic_id:activeDynamic,user_id:user.id,display_name:String(v.get("display_name")).trim(),address_style:String(v.get("address_style")),preferences:String(v.get("preferences")).trim(),limits:String(v.get("limits")).trim(),updated_at:new Date().toISOString()};
        const {error}=await client.from("profiles").upsert(profile,{onConflict:"dynamic_id,user_id"});
        if(error) throw error; await renderDynamic(); show("Perfil guardado dentro de esta dinámica.",false); return;
      }
      if(f.id==="nc-task") {
        const frequency=String(v.get("frequency"));
        const t={dynamic_id:activeDynamic,title:String(v.get("title")).trim(),instructions:String(v.get("instructions")).trim(),frequency,required_count:frequency==="once"?1:Number(v.get("required_count"))||1,due_date:v.get("due_date")||null,deadline_time:v.get("deadline_time")||null};
        const result=editingId ? await client.from("tasks").update(t).eq("id",editingId).eq("dynamic_id",activeDynamic) : await client.from("tasks").insert({...t,created_by:user.id});
        if(result.error) throw result.error; editingId=null; await renderDynamic(); return;
      }
    } catch(err) { show(err.message || String(err),true); }
  });
  root.addEventListener("change", e => {
    if (e.target.form?.id !== "nc-task" || e.target.name !== "frequency") return;
    const wrap=root.querySelector("[data-count-wrap]"), count=root.querySelector('input[name="required_count"]');
    wrap.hidden=e.target.value==="once"; count.required=e.target.value!=="once"; if(e.target.value==="once") count.value="1";
  });
  window.addEventListener("nexo:open-cloud", async () => {
    local.hidden=true; root.hidden=false;
    if (!config || !connect()) return renderSetup();
    await render();
  });
  connect();
})();
