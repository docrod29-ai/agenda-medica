# Iteración 5 — CONSENT_AND_OPTOUT · Reporte

- **Iteration ID:** nexusmed-whatsapp-005 · **Modo:** CONSENT_AND_OPTOUT · **Entorno:** staging / rama `feat/whatsapp-excellence` · **Producción:** no alterada · `production_deployment_allowed: false`.
- **Estado:** **PASS — opt-out (BAJA/STOP) + opt-in (ALTA) por contacto, respetado en TODO envío proactivo, con pie visible.** Cierra WA-2.

## Hallazgo (WA-2)
Los mensajes proactivos (recordatorios, avisos de lista de espera) se enviaban como texto libre **sin mecanismo de baja** ni verificación de consentimiento por contacto. Riesgo de política de WhatsApp/Meta y de cumplimiento (el titular no podía dejar de recibir mensajes).

## Entregado (verificable)
| Pieza | Qué hace |
|---|---|
| `src/lib/whatsapp/consent.ts` | **Puro**: `esPalabraBaja` / `esPalabraAlta` (palabras DEDICADAS — no chocan con "cancelar" cita ni "salir" del menú), `normalizarTelefonoWa` (clave estable lada 52), `conPieOptout`, mensajes de confirmación, `PIE_OPTOUT`. **Firestore delgado**: `estaDadoDeBaja` / `registrarBaja` / `registrarAlta` sobre `clinics/{id}/whatsapp_optout/{telefono}`. |
| `whatsapp-send.ts` | `sendWhatsApp(..., { proactivo:true })`: **antes de enviar** verifica opt-out (no envía → `{ok:false, optout:true}`) y agrega el pie "Responda BAJA…". Las respuestas reactivas del bot (sin la bandera) no se tocan. |
| `webhook/route.ts` | Al inicio de `handleMessage`, ANTES del FAQ: `BAJA/STOP` → `registrarBaja` + confirma + corta; `ALTA` → `registrarAlta` + confirma y sigue. |
| `cron/reminders/route.ts` · `waitlist-notify/route.ts` | Marcan sus envíos `{ proactivo:true }` → respetan la baja y llevan el pie. |
| `whatsapp-consent.test.ts` | 6 tests puros: baja detecta 16 variantes y **rechaza** el vocabulario del bot (cancelar/ salir/ 0/ 1); alta; pie idempotente; normalización de teléfono. |

**Archivos:** `whatsapp/consent.ts`, `whatsapp-consent.test.ts` (nuevos); `whatsapp-send.ts`, `webhook/route.ts`, `cron/reminders/route.ts`, `waitlist-notify/route.ts` (cableado). Deps/migraciones: 0.

## Modelo de política aplicado
- **Proactivo (consultorio inicia):** recordatorio / lista de espera ⇒ respeta opt-out + pie de baja obligatorio.
- **Reactivo (paciente inicia):** el bot responde a un mensaje que el paciente mandó ⇒ no se bloquea (conversación abierta por él). Si en ese mensaje pide BAJA, se confirma y se corta.
- **Palabras dedicadas** para no romper el flujo: `cancelar` sigue siendo cancelar cita; `salir` sigue saliendo del menú.

## Seguridad del cambio
- `sendWhatsApp` es el **único** punto de envío → la verificación se hace en un solo lugar; imposible olvidarla en un envío proactivo nuevo (basta pasar `proactivo:true`).
- **Fail-open documentado**: si la lectura del registro de opt-out falla (Firestore transitorio), se envía (no se bloquean TODOS los recordatorios por un error puntual). Registro de un solo documento → error raro. Alternativa fail-closed evaluada y descartada por impacto operativo.
- La respuesta reactiva no cambia de comportamiento (cero regresión en el bot).

## Pruebas
- `tsc --noEmit` → 0. · `vitest run` → **417/417** (6 nuevos). · `next build` → OK.
- **Límite honesto:** `set/get` de Firestore no corren aquí (runtime). La **decisión** (detección de intención, normalización de clave, pie idempotente, cuándo bloquear) está en funciones puras y probada; el store es una capa delgada a prueba de fallos.

## Quality Gate
```
QUALITY GATE: PASS — opt-out/opt-in por contacto (BAJA/STOP · ALTA), verificado
ANTES de todo envío proactivo en el único chokepoint (sendWhatsApp), pie "Responda
BAJA…" en recordatorios y lista de espera, sin chocar con el flujo del bot,
fail-open documentado. tsc 0, 417/417, build OK. production_deployment_allowed:false.
```

## Siguiente iteración recomendada (no implementada)
**P0 WA-1 — TEMPLATES_AND_WINDOW**: plantillas HSM aprobadas + lógica de ventana de 24 h (un recordatorio fuera de la sesión de 24 h DEBE ir como plantilla, no como texto libre). Es el mayor riesgo de negocio/entregabilidad restante y ahora encaja natural con `proactivo:true`. Alternativa: Iter. 6 según el programa.
