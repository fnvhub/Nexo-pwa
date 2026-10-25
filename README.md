# Nexo PWA

Nexo es una PWA en español para acuerdos, tareas y perfiles dentro de dinámicas consensuadas. La versión publicada es **0.5.0**.

## Qué incluye 0.5.0

- Tareas puntuales, diarias, semanales o mensuales, con repeticiones por periodo, fecha, hora límite e instrucciones.
- Editar y borrar tareas desde el rol DOM. El borrado pide confirmación.
- Acceso por cuenta Supabase, alta e inicio de sesión por correo.
- Una invitación por enlace, vinculada a una dinámica exacta, de un solo uso y con caducidad de siete días.
- Perfiles y tareas compartidos dentro de la dinámica; cada cuenta solo ve sus propias dinámicas y la DOM solo ve perfiles de las dinámicas que administra.
- El texto de invitación incluye el enlace para instalar la PWA y los pasos para Android y iPhone/iPad.
- Historial de versiones dentro de Ajustes y en CHANGELOG.md.

## Activar cuentas e invitaciones

La interfaz ya está publicada, pero el flujo compartido necesita conectarse a un proyecto Supabase propio. No requiere desplegar un servidor adicional.

1. Crea un proyecto Supabase y activa la autenticación por correo electrónico.
2. Abre SQL Editor en Supabase y ejecuta todo el archivo supabase/schema.sql.
3. En Supabase, configura Site URL como https://fnvhub.github.io/Nexo-pwa/ y añade esa misma dirección a Redirect URLs permitidas en Authentication → URL Configuration.
4. Abre Nexo en https://fnvhub.github.io/Nexo-pwa/, entra y pulsa Cuenta e invitaciones. Pega la URL del proyecto y la clave publicable (publishable/anon). No introduzcas la clave service_role.
5. Elige Crear dinámica DOM. En esa dinámica, pulsa Crear invitación y comparte el texto generado.
6. La SUM instala Nexo desde el primer enlace del mensaje, abre el enlace de invitación, crea su cuenta o inicia sesión y completa su perfil.

El enlace de invitación solo concede acceso a esa dinámica; no permite descubrir ni abrir las demás dinámicas de la DOM. Cada invitación se puede canjear una vez y expira en siete días. Si se pierde, la DOM crea otra.

La URL y la clave publicable se guardan en el navegador para poder reconectar el cliente. La clave publicable está diseñada para usarse en el navegador; el aislamiento real depende de las políticas RLS y funciones del SQL.

## Probar

- Para probar la interfaz local, entra, crea un espacio local DOM y abre Tareas. Crea una tarea, luego usa Editar o Borrar.
- Para probar invitaciones y separación real entre cuentas, completa los pasos de Supabase y usa dos correos distintos en dos sesiones/dispositivos.
- La PWA se puede instalar desde Safari (Compartir → Añadir a pantalla de inicio) o Chrome (menú → Instalar aplicación).

## Espacios locales

Los espacios locales siguen disponibles para demostraciones sin backend. Sus datos se guardan solo en el navegador y no se comparten con las cuentas. Usa la opción Cuenta e invitaciones para acceder a perfiles y tareas compartidos.

## Límites actuales

La primera conexión requiere internet y un proyecto Supabase configurado. El flujo remoto cubre cuentas, invitaciones, perfiles y tareas. Los acuerdos y las demás funciones avanzadas todavía no se sincronizan con Supabase. La app no usa la clave secreta service_role. Revisa las reglas de Auth y RLS antes de guardar datos personales reales.