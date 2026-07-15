# Iteración 9 — FREQUENCY_CAP · Reporte

- **Iteration ID:** nexusmed-whatsapp-009 · **Modo:** FREQUENCY_CAP · **Entorno:** staging / rama `feat/whatsapp-excellence` · **Producción:** no alterada · `production_deployment_allowed: false`.
- **Estado:** **PASS — tope diario de mensajes proactivos por contacto (anti-spam), configurable, con conteo por día que se reinicia solo.**

## Hallazgo
No había límite a cuántos mensajes iniciados por el consultorio podía recibir un paciente en un día. Un paciente con varias citas, o varias ofertas de lista de espera seguidas, podía recibir muchos mensajes → riesgo de spam y de reportes que dañan la calidad del número.

## Entregado (verificable)
| Pieza | Qué hace |
|---|---|
| `src/lib/whatsapp/frecuencia.ts` | **Puro**: `topeDiario(waConfig)` (default **3**, acotado a [1,20]), `superaTope(enviadosHoy, tope)`, `conteoDeHoy(proactivo, fechaHoy)` (0 si es de otro día), `siguienteConteo` (reinicia en día nuevo, +1 en el mismo). |
| `whatsapp/contacts.ts` | `enviosProactivosHoy` (fail-open → 0) y `registrarEnvioProactivo` (transacción: reinicia en día nuevo, suma en el mismo) sobre el campo `proactivo` del doc de contacto. |
| `whatsapp/proactivo.ts` | Si se pasa `fechaHoyMx`: verifica el tope ANTES de enviar (`'tope'` si lo supera) y **solo cuenta el envío si realmente salió** (`r.ok`). |
| `cron/reminders/route.ts` · `waitlist-notify/route.ts` | Pasan `fechaHoyMx: hoyISO()` → recordatorios y avisos de lista de espera cuentan contra el mismo tope diario del contacto. |
| `whatsapp-frecuencia.test.ts` | 5 tests puros: tope efectivo (default/acotado/floor), `superaTope`, conteo por día (reinicio en día nuevo), `siguienteConteo`. |

**Archivos:** `whatsapp/frecuencia.ts`, `whatsapp-frecuencia.test.ts` (nuevos); `whatsapp/contacts.ts`, `whatsapp/proactivo.ts`, `cron/reminders`, `waitlist-notify` (cableado). Deps/migraciones: 0.

## Diseño
- **Solo cuenta lo que salió**: si el envío falla o cae en opt-out/silencio, no consume cupo.
- **Transacción** para el incremento → conteo correcto ante ejecuciones concurrentes del cron.
- **Reactivo intacto**: el tope es solo para proactivos; las respuestas del bot a mensajes del paciente no cuentan ni se bloquean.
- **Configurable** por clínica (`whatsapp.topeDiarioProactivo`), con un default sensato.

## Pruebas
- `tsc --noEmit` → 0. · `vitest run` → **447/447** (5 nuevos). · `next build` → OK.
- **Límite honesto:** la **lógica** (tope efectivo, conteo por día, reinicio, cuándo bloquear) está en funciones puras y probada. La transacción de Firestore corre en runtime.

## Quality Gate
```
QUALITY GATE: PASS — tope diario proactivo por contacto (default 3, configurable,
acotado), conteo por día que se reinicia solo, solo cuenta envíos exitosos,
transaccional; recordatorios y lista de espera cableados; reactivo no afectado.
tsc 0, 447/447, build OK. production_deployment_allowed: false.
```

## Estado de la mensajería proactiva
Con opt-out (WA-2), ventana 24 h + plantillas (WA-1), estados de entrega (6), tablero (7), horas de silencio (8) y tope de frecuencia (9), la mensajería proactiva de WhatsApp está **completa y con salvaguardas de política**. Lo único que queda es **inbox/DLQ + reintentos con backoff** (Iter. 14, robustez de infraestructura) y la aprobación EXTERNA de plantillas en Meta.
