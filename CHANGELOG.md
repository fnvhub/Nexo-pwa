# Historial de versiones de Nexo

Las versiones se muestran también en Ajustes dentro de la PWA. Las notas de cada versión registran cambios visibles y pasos de configuración.

## 0.5.0 — 2026-10-25

- Se puede editar una tarea DOM y cambiar instrucciones, frecuencia, repeticiones, fecha u hora límite.
- Se puede borrar una tarea después de confirmar.
- Se añadieron instrucciones obligatorias para que la SUM sepa qué hacer y cuándo se considera terminada.
- La frecuencia puede ser puntual, diaria, semanal o mensual. El progreso se cuenta para el periodo actual.
- Se incorporó acceso por cuenta de correo con Supabase.
- La DOM puede crear una dinámica privada e invitar a una SUM mediante un enlace de un solo uso que vence en siete días.
- Aceptar la invitación añade a la cuenta SUM únicamente a esa dinámica. Las consultas se limitan también con Row Level Security en el servidor.
- El perfil de la SUM y las tareas compartidas quedan dentro de la dinámica correspondiente.
- El texto para compartir incluye el enlace de instalación de Nexo y los pasos para Android y iPhone/iPad.
- La PWA muestra la versión 0.5.0 y descarga las nuevas versiones del módulo.

**Activación requerida:** crear un proyecto Supabase, ejecutar supabase/schema.sql y configurar la URL y clave publicable en Cuenta e invitaciones. Ver README.md.

## 0.4.0 — 2026-10-25

- Se añadió PIN opcional para entrar en el dispositivo.
- Se añadió teclado oculto para introducir el PIN y gestión del PIN desde Ajustes.
- El PIN solo controla la pantalla de entrada; no cifra datos ni sustituye cuentas.

## 0.3.1 — 2026-10-25

- Ajustes y versión visibles dentro de la aplicación.

## 0.3.0 — 2026-10-25

- Se añadió la pantalla de Ajustes y el historial de versiones.

## 0.2.1 — 2026-10-25

- Se simplificó el texto de portada.

## 0.2.0 — 2026-10-25

- Se añadieron instalación PWA, estado de conexión y soporte offline.

## 0.1.0 — 2026-10-25

- Primera versión de la portada de Nexo.