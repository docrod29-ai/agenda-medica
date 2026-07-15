# Iteración 10 — RELIABILITY (outbox / DLQ + reintentos) · Reporte

- **Iteration ID:** nexusmed-whatsapp-010 · **Modo:** RELIABILITY · **Entorno:** staging / rama `feat/whatsapp-excellence` · **Producción:** no alterada · `production_deployment_allowed: false`.
- **Estado:** **PASS — los avisos proactivos de un solo disparo (lista de espera) que fallan por error transitorio se reintentan con backoff; tras agotarse pasan a dead-letter.**

## Hallazgo
Los recordatorios tienen reintento natural (el cron los reenvía mientras la ventana siga abierta, porque no se marca la bandera al fallar). Pero un **aviso de lista de espera** se dispara UNA vez al liberarse un hueco: si el envío falla por un error transitorio (red / 5xx del proveedor), **se perdía** — el paciente nunca se enteraba del espacio.

## Entregado (verificable)
| Pieza | Qué hace |
|---|---|
| `src/lib/whatsapp/reintentos.ts` | **Puro**: `backoffMs(intento)` (exponencial desde 5 min, tope 6 h), `proximoIntentoISO`, `agotado(intentos)` (máx. 5), `vencido(proximoISO, ahora)`. |
| `src/lib/whatsapp/outbox.ts` | Firestore delgado en `clinics/{id}/whatsapp_outbox`: `encolarReintento` (tras el 1er fallo), `entradasVencidas` (pendientes cuyo próximo intento ya venció), `resolverEntrada` (éxito → quita), `reprogramarEntrada` (fallo → backoff, o `estado:'muerto'` al agotarse = dead-letter, sin perder el registro). |
| `waitlist-notify/route.ts` | Si el aviso resulta `'fallo'`, `encolarReintento` con la carga (destino, clave `listaEspera`, datos, texto). |
| `cron/reminders/route.ts` | Al final de cada clínica **drena la cola**: reenvía por `enviarProactivo`; `enviado/optout/omitido` → quita; `fallo` → reprograma/DLQ; `silencio/tope` → deja para el próximo ciclo. Sin cron nuevo. |
| `whatsapp-reintentos.test.ts` | 6 tests puros: backoff exponencial y tope, intento inválido → base, `proximoIntentoISO`, `agotado`, `vencido` (sin fecha / pasada / futura). |

**Archivos:** `whatsapp/reintentos.ts`, `whatsapp/outbox.ts`, `whatsapp-reintentos.test.ts` (nuevos); `waitlist-notify`, `cron/reminders` (cableado). Deps/migraciones: 0.

## Diseño
- **Reutiliza el cron existente** de recordatorios para drenar → no requiere agendar un cron nuevo.
- **Respeta todas las salvaguardas** al reintentar: pasa por `enviarProactivo`, así que sigue honrando opt-out, ventana/plantilla, horas de silencio y tope de frecuencia. En silencio/tope la entrada se queda en cola (no se pierde ni se fuerza).
- **Sin doble envío**: solo la lista de espera encola (los recordatorios ya se auto-reintentan por su bandera).
- **Dead-letter inspeccionable**: al agotar 5 intentos la entrada queda `estado:'muerto'` con el último error, no se borra.

## Pruebas
- `tsc --noEmit` → 0. · `vitest run` → **453/453** (6 nuevos). · `next build` → OK.
- **Límite honesto:** la **política** (backoff, agotado, vencido) está en funciones puras y probada. Las lecturas/escrituras de la cola y el drenado corren en runtime (cron).

## Quality Gate
```
QUALITY GATE: PASS — outbox con backoff exponencial (5 min→6 h, máx 5) + dead-letter
para avisos de lista de espera; drenado en el cron existente respetando opt-out/
ventana/silencio/tope; sin doble envío. tsc 0, 453/453, build OK.
production_deployment_allowed: false.
```

## Cierre de la tanda WhatsApp
Mensajería proactiva completa: aislamiento (4), opt-out WA-2 (5), ventana+plantillas WA-1, estados de entrega (6), tablero (7), horas de silencio (8), tope de frecuencia (9) y outbox/DLQ (10). Pendientes SOLO externos: aprobar plantillas en Meta y registrar sus nombres.
