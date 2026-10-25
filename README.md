# Nexo PWA

Nexo es una PWA en español para llevar acuerdos y tareas dentro de una dinámica consensuada.

## Estado actual

El prototipo publicado incluye portada instalable, funcionamiento offline, puerta de entrada con PIN opcional y un MVP local con espacios DOM/SUM, acuerdos, tareas, pausa de dinámica, nota privada y perfil por espacio.

La interfaz está construida como JavaScript estático para preservar el despliegue actual en GitHub Pages. Los datos del MVP se guardan en `localStorage` de este navegador. Los espacios DOM y SUM separan los datos en la interfaz, pero **no son cuentas, no se comparten entre dispositivos y no constituyen una frontera de seguridad**. El PIN solo controla la pantalla de entrada y no cifra el almacenamiento. Usa datos ficticios hasta conectar un backend.

## Probar

1. Abre [Nexo en GitHub Pages](https://fnvhub.github.io/Nexo-pwa/).
2. Pulsa **Entrar**, elige usar PIN o continuar sin PIN.
3. Crea un espacio como DOM o SUM y prueba acuerdos, tareas, pausa y perfil.
4. En iPhone/iPad, usa Compartir → Añadir a pantalla de inicio. En Android, usa el menú del navegador → Instalar aplicación.
5. La primera visita necesita conexión; después el service worker guarda la app para abrirla sin conexión.

Para ejecutar una copia local, sirve la raíz del repositorio con cualquier servidor HTTP estático (por ejemplo `python -m http.server 8000`) y abre `http://localhost:8000`. Los service workers requieren HTTPS o localhost.

## Siguiente paso de seguridad

`supabase/schema.sql` es una base de esquema con Row Level Security: cada registro se consulta dentro de una dinámica a la que pertenece la cuenta autenticada, y las SUM solo ven su propia pertenencia. Debe revisarse, desplegarse y probarse con cuentas separadas antes de conectar el cliente. La app aún no se conecta a Supabase ni ofrece autenticación, invitaciones, sincronización ni cifrado de datos en reposo.
