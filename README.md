# Nexo PWA

Nexo es una PWA móvil en español para coordinar tareas y perfiles dentro de dinámicas compartidas. Esta fase publica la versión **0.6.0** y amplía el flujo de tareas compartidas con revisión explícita.

## Funciones disponibles

- Cuentas Supabase e invitaciones de un solo uso vinculadas a una dinámica.
- Lecturas aisladas por membership y dinámica mediante Row Level Security.
- Tareas puntuales, diarias, semanales o mensuales con meta, instrucciones y vencimiento opcional.
- La persona SUM envía cada cumplimiento. Queda pendiente hasta que la persona DOM lo valida o rechaza.
- Las revisiones conservan autor, hora y nota opcional. El registro de prueba es solo el estado del flujo; Nexo no admite archivos multimedia ni enlaces de evidencia.
- DOM archiva tareas en lugar de borrar su historial. Las acciones no se envían mientras la dinámica está pausada.
- Espacios locales de demostración: sus datos permanecen en el navegador y no se sincronizan.

## Activar o actualizar Supabase

1. Crea un proyecto Supabase y activa la autenticación por correo electrónico.
2. Ejecuta el archivo completo `supabase/schema.sql` en SQL Editor. Es idempotente para la estructura existente y conserva los cumplimientos anteriores como historial aprobado.
3. Configura Site URL y Redirect URLs con `https://fnvhub.github.io/Nexo-pwa/` en Authentication → URL Configuration.
4. En Cuenta e invitaciones, configura la URL del proyecto y su clave publicable (`sb_publishable_…` o la antigua `anon`). No uses `service_role` ni `sb_secret_`.
5. DOM crea una dinámica, genera una invitación y la comparte con SUM. La persona invitada configura el mismo proyecto y canjea el enlace con su cuenta.

La sincronización compartida necesita Supabase configurado, una sesión autenticada y conexión. Sin ello, los espacios locales solo existen en el dispositivo. La aplicación no incluye claves administrativas.

## Alcance y límites

- El flujo compartido cubre perfiles, tareas, envíos y revisiones. Acuerdos versionados, aceptación explícita, color por dinámica, puntos y paneles completos aún no están conectados.
- No hay sincronización en tiempo real ni cola offline para escrituras. Las acciones requieren conexión; no se presentan como sincronizadas hasta que Supabase las confirma.
- Las consecuencias son información acordada; no se ejecutan automáticamente.
- La actualización del esquema debe probarse primero en un proyecto Supabase de ensayo. No se ha probado contra la instancia Supabase del usuario desde este entorno.

## PWA

La PWA se puede instalar desde Safari (Compartir → Añadir a pantalla de inicio) o Chrome (menú → Instalar aplicación). El service worker reemplaza sus cachés versionadas al activar una actualización.
