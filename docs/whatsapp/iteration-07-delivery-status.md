# Iteración 6 — DELIVERY_STATUS · Reporte

- **Iteration ID:** nexusmed-whatsapp-006 · **Modo:** DELIVERY_STATUS · **Entorno:** staging / rama `feat/whatsapp-excellence` · **Producción:** no alterada · `production_deployment_allowed: false`.
- **Estado:** **PASS — los callbacks de estado (sent/delivered/read/failed) ya se capturan; fallos permanentes y opt-out de Meta se detectan y honran.**

## Hallazgo
Meta y 360dialog envían callbacks de **estado de entrega** además de los mensajes entrantes. Ambos webhooks los **descartaban** (`if (messages.length === 0) return {ok:true}`). Consecuencia: cero visibilidad de si un recordatorio llegó, y —peor— si Meta reportaba que el usuario se dio de baja (código 131050) o que el número no es alcanzable (131026), se seguía intentando.

## Entregado (verificable)
| Pieza | Qué hace |
|---|---|
| `src/lib/whatsapp/status.ts` | **Puro**: `parsearStatuses(contenedor)` (Meta `value.statuses[]` y 360dialog `payload.statuses[]`, misma forma) → `{wamid, estado, telefono, timestamp, errorCode, errorTitulo}[]`, descarta sin wamid; `esOptoutDeMeta` (131050), `esFalloPermanente` (131026/131050). **Firestore delgado**: `registrarStatus` → `clinics/{id}/whatsapp_status/{wamid}`; si es `failed` con opt-out de Meta, **da de baja** al contacto (`registrarBaja`, via `meta_optout`). |
| `webhook/route.ts` (Meta) | Procesa `value.statuses` antes del early-return; resuelve tenant y registra cada estado. Los mensajes se siguen procesando igual. |
| `360dialog-webhook/route.ts` | Procesa `payload.statuses` (clinicId ya resuelto por api_key) antes del check de mensajes. |
| `whatsapp-status.test.ts` | 6 tests puros: parseo (delivered/read, campos de error, ignora sin wamid / payloads vacíos), clasificación (131050 opt-out+permanente; 131026 permanente no-optout; 131047 no permanente). |

**Archivos:** `whatsapp/status.ts`, `whatsapp-status.test.ts` (nuevos); `webhook/route.ts`, `360dialog-webhook/route.ts` (cableado). Deps/migraciones: 0.

## Valor
- **Visibilidad**: cada envío queda con su estado final (delivered/read/failed) por `wamid` → base para un futuro tablero de entregabilidad.
- **Cierra el bucle con WA-1/WA-2**: si Meta reporta opt-out (131050), el contacto se da de baja automáticamente → deja de recibir proactivos. Un número no entregable (131026) queda marcado como fallo permanente.
- **Idempotente y a prueba de fallos**: `set(..., {merge:true})` por wamid; un error de registro nunca rompe el webhook (que debe responder rápido).

## Pruebas
- `tsc --noEmit` → 0. · `vitest run` → **432/432** (6 nuevos). · `next build` → OK.
- **Límite honesto:** el `set` de Firestore y la baja automática no corren aquí (runtime). El **parseo** (ambos proveedores) y la **clasificación de errores** (qué es opt-out / permanente) están en funciones puras y probadas.

## Quality Gate
```
QUALITY GATE: PASS — statuses parseados (Meta y 360dialog), registrados por wamid
en whatsapp_status, opt-out de Meta (131050) honrado con baja automática, fallo
permanente (131026) clasificado; webhooks siguen respondiendo rápido y procesando
mensajes. tsc 0, 432/432, build OK. production_deployment_allowed: false.
```

## Siguiente iteración recomendada
Iteración 7 del programa. Con opt-out + ventana/plantillas + estados de entrega, la base proactiva está completa; lo natural es un **tablero de entregabilidad** (leer `whatsapp_status` para el médico) o avanzar a fiabilidad (inbox/DLQ, reintentos — Iter. 14).
