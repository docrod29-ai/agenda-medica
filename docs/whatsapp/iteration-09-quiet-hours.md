# Iteración 8 — RELIABILITY (horas de silencio) · Reporte

- **Iteration ID:** nexusmed-whatsapp-008 · **Modo:** RELIABILITY · **Entorno:** staging / rama `feat/whatsapp-excellence` · **Producción:** no alterada · `production_deployment_allowed: false`.
- **Estado:** **PASS — los mensajes proactivos ya no salen de madrugada; se difieren solos hasta el horario permitido.**

## Hallazgo
Los recordatorios proactivos podían enviarse a cualquier hora según cuándo corriera el cron (p. ej. un recordatorio de mismo día para una cita temprana → 2–5 am). Mala experiencia y roza políticas de mensajería. No había ninguna ventana de silencio.

## Entregado (verificable)
| Pieza | Qué hace |
|---|---|
| `src/lib/whatsapp/horario.ts` | **Puro**: `enSilencio(min, ventana)` (maneja cruce de medianoche y ventana en el mismo día), `enHorarioPermitido`, `resolverSilencio(waConfig)` (default **21:00–08:00**, configurable por clínica `whatsapp.silencio`, o `activo:false` para desactivar). |
| `whatsapp/proactivo.ts` | Si se pasa `minutosDelDiaMx`, verifica horario ANTES de enviar; en silencio devuelve `'silencio'` (no envía, no marca enviado → el próximo ciclo del cron lo reintenta al pasar el silencio). |
| `cron/reminders/route.ts` | Calcula `ahoraMinutosDelDia()` (hora de pared MX) una vez y lo pasa a ambos recordatorios; `silencio` cuenta como `skipped`. |
| `whatsapp-horario.test.ts` | 7 tests puros: ventana que cruza medianoche (21→08), ventana mismo día [01,05), ventana vacía, resolución de config (default / desactivado / válida / inválida). |

**Archivos:** `whatsapp/horario.ts`, `whatsapp-horario.test.ts` (nuevos); `whatsapp/proactivo.ts`, `cron/reminders/route.ts` (cableado). Deps/migraciones: 0.

## Diseño (por qué es fiable sin cola)
- El recordatorio en silencio **no se marca enviado** → el mismo mecanismo de reintento natural del cron (la ventana 23–26 h / 1–4 h sigue abierta) lo reenvía en el siguiente ciclo, ya en horario permitido. No hace falta una cola de diferidos.
- Solo aplica a **recordatorios programados** (cron). Los avisos de **lista de espera** (los dispara una persona al liberarse un hueco, hay que llenarlo ya) y las respuestas **reactivas** del bot no se ven afectados.
- **Reactivo intacto**: el paciente que escribe a las 3 am recibe respuesta; el silencio es solo para lo que inicia el consultorio.

## Pruebas
- `tsc --noEmit` → 0. · `vitest run` → **442/442** (7 nuevos). · `next build` → OK.
- **Límite honesto:** la **decisión** (dentro/fuera de silencio, cruce de medianoche, resolución de config) está en funciones puras y probada. El disparo real depende del reloj del cron en runtime.

## Quality Gate
```
QUALITY GATE: PASS — horas de silencio (default 21:00–08:00 MX, configurables)
para mensajes proactivos, con diferimiento natural vía reintento del cron; lista
de espera y reactivo no afectados. tsc 0, 442/442, build OK.
production_deployment_allowed: false.
```

## Siguiente iteración recomendada
Fiabilidad restante: **inbox/DLQ + reintentos con backoff** para fallos NO permanentes (Iter. 14 del programa) — persistir el evento y reintentar con retroceso exponencial. O un **tope de frecuencia por contacto** (anti-spam: máx. N mensajes/día al mismo número).
