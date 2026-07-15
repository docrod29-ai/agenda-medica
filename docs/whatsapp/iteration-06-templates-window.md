# WA-1 (P0) — TEMPLATES_AND_WINDOW · Reporte

- **Iteration ID:** nexusmed-whatsapp-wa1 · **Modo:** TEMPLATES_AND_WINDOW · **Entorno:** staging / rama `feat/whatsapp-excellence` · **Producción:** no alterada · `production_deployment_allowed: false`.
- **Estado:** **PASS — ventana de 24 h + plantillas HSM implementadas; los mensajes proactivos ya NO salen como texto libre fuera de la ventana.** Cierra el P0 WA-1. Falta el paso EXTERNO: aprobar las plantillas en Meta/360dialog.

## El P0 (WA-1)
Meta/WhatsApp **rechaza texto libre fuera de las 24 h** desde el último mensaje entrante del usuario. Los recordatorios y avisos de lista de espera se enviaban siempre como texto libre → para pacientes que no habían escrito en 24 h (la mayoría), Meta los rechazaba silenciosamente (fallaban). Fuera de la ventana hay que usar una **plantilla HSM aprobada**.

## Entregado (verificable, en código)
| Pieza | Qué hace |
|---|---|
| `lib/whatsapp/window.ts` | **Puro**: `ventanaAbierta(ultimoEntranteISO, ahoraMs)`, `requierePlantilla`, `decidirCanalProactivo({ventanaAbierta, plantillaDisponible})` → `texto` \| `plantilla` \| `omitir`. `VENTANA_SERVICIO_MS = 24h`. |
| `lib/whatsapp/templates.ts` | **Puro**: catálogo `PLANTILLAS_DEFAULT` (recordatorio 24h / mismo día / lista de espera) con el mapeo de datos → parámetros posicionales {{1}}..{{n}}; `resolverPlantillaClinica(waConfig, clave)` → null si la clínica no registró un nombre aprobado (sin plantilla no se envía fuera de ventana). |
| `lib/whatsapp/contacts.ts` | Rastreo durable del último entrante: `registrarEntrante` / `ultimoEntranteAt` en `clinics/{id}/whatsapp_contacts/{tel}`. Sin esto no se puede evaluar la ventana. |
| `lib/whatsapp/proactivo.ts` | **Puerta única** `enviarProactivo(...)`: evalúa ventana + plantilla y elige canal. Fuera de ventana sin plantilla → **omite** (no texto libre) y registra. Respeta opt-out (vía sendWhatsApp/Template). |
| `whatsapp-send.ts` | `sendWhatsAppTemplate(clinicId, to, {name, lang, bodyParams}, {proactivo})` — envía plantilla por 360dialog o Meta; respeta opt-out. |
| `webhook/route.ts` | `registrarEntrante(clinicId, from)` en cada mensaje → abre/renueva la ventana. |
| `cron/reminders/route.ts` · `waitlist-notify/route.ts` | Recordatorios 24h/mismo día y avisos de lista de espera pasan por `enviarProactivo`. La lista de espera solo marca `contactado`/crea sesión si el envío fue `enviado`. |
| `whatsapp-window.test.ts` | 9 tests puros: ventana (nunca escribió / 1h / 25h / límite exacto / ISO inválido), decisión de canal (los 3 casos), resolución de plantilla (sin nombre → null, con nombre → parámetros en orden, override de idioma). |

**Archivos:** `window.ts`, `templates.ts`, `contacts.ts`, `proactivo.ts`, `whatsapp-window.test.ts` (nuevos); `whatsapp-send.ts`, `webhook`, `cron/reminders`, `waitlist-notify` (cableado). Deps/migraciones: 0.

## Comportamiento nuevo
- **Dentro de 24 h** (el paciente escribió hace poco): texto libre, como antes.
- **Fuera de 24 h + plantilla aprobada configurada**: se envía la **plantilla HSM**.
- **Fuera de 24 h sin plantilla**: se **omite** (antes: se intentaba texto libre y Meta lo rechazaba → `failed`). Ahora es `skipped` con log claro. No hay regresión: esos mensajes tampoco se entregaban antes.

## Paso EXTERNO del Dr. (para activar entregas fuera de ventana)
1. **Crear y aprobar** estas plantillas en el WhatsApp Manager de Meta (o 360dialog), categoría *Utility*, idioma **es_MX**. Texto sugerido (los `{{n}}` son variables):

   **`recordatorio_cita_24h`** — {{1}} paciente · {{2}} médico · {{3}} fecha · {{4}} hora · {{5}} clínica
   > Hola {{1}} 👋 Le recordamos su cita de mañana con {{2}}. 📅 {{3}} 🕐 {{4}} 📍 {{5}}. Responda SÍ para confirmar o NO para cancelar. Responda BAJA para dejar de recibir estos mensajes.

   **`recordatorio_cita_dia`** — {{1}} paciente · {{2}} médico · {{3}} hora · {{4}} clínica
   > Buenos días {{1}} ☀️ Hoy tiene su cita con {{2}} a las {{3}} en {{4}}. Le esperamos. Responda BAJA para dejar de recibir estos mensajes.

   **`lista_espera_espacio`** — {{1}} paciente · {{2}} médico · {{3}} fecha · {{4}} hora
   > Hola {{1}}, se liberó un espacio con {{2}} el {{3}} a las {{4}}. ¿Le interesa? Responda SÍ para tomarlo o NO para quitarse de la lista.

2. **Registrar los nombres aprobados** en el doc de la clínica `clinics/{id}.whatsapp.plantillas`:
   ```json
   { "recordatorio24h":     { "name": "recordatorio_cita_24h",  "lang": "es_MX" },
     "recordatorioMismoDia": { "name": "recordatorio_cita_dia",  "lang": "es_MX" },
     "listaEspera":          { "name": "lista_espera_espacio",   "lang": "es_MX" } }
   ```
   Mientras no estén registradas, los mensajes dentro de la ventana siguen funcionando; los de fuera de ventana se omiten (visible en los `skipped` del cron).

## Pruebas
- `tsc --noEmit` → 0. · `vitest run` → **426/426** (9 nuevos). · `next build` → OK.
- **Límite honesto:** el envío real a Meta/360dialog y las lecturas/escrituras de Firestore no corren aquí (runtime). Toda la **decisión** (ventana, canal, resolución de plantilla, orden de parámetros) está en funciones puras y probada. No puedo aprobar plantillas (requiere la cuenta de Meta del Dr.) ni conecto cuentas reales.

## Quality Gate
```
QUALITY GATE: PASS — ventana de 24 h evaluada por contacto (whatsapp_contacts),
canal decidido (texto/plantilla/omitir) en puerta única (enviarProactivo), envío
de plantilla HSM por 360dialog y Meta, recordatorios y lista de espera cableados,
sin texto libre fuera de ventana. tsc 0, 426/426, build OK.
Paso externo pendiente: aprobar plantillas en Meta + registrar nombres.
production_deployment_allowed: false.
```

## Siguiente iteración recomendada
Iteración 6 del programa (según la secuencia). El grueso de la infraestructura proactiva (opt-out + ventana + plantillas) ya está; lo que sigue es pulido de experiencia o fiabilidad (inbox/DLQ, Iter. 14).
