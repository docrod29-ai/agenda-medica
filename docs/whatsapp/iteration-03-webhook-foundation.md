# Iteración 3 — WEBHOOK_FOUNDATION · Reporte

- **Iteration ID:** nexusmed-whatsapp-003 · **Modo:** WEBHOOK_FOUNDATION · **Entorno:** staging / rama `feat/whatsapp-excellence` · **Producción:** no alterada · `production_deployment_allowed: false`.
- **Estado:** **PASS (parcial) — deduplicación/idempotencia (WA-3) implementada en AMBOS webhooks + PII fuera de logs; inbox/DLQ formal se difiere.**

## Auditoría (base ya presente)
- **Firma verificada** (X-Hub-Signature-256) sobre el body crudo. ✅
- **Respuesta rápida** en el webhook de Meta (procesa `handleMessage` async y responde `{ok}`). ✅
- **Tenant resuelto del activo** (phoneNumberId / apiKey), no del cliente. ✅
- **Faltaba:** deduplicación (llegaba `wamid` sin usar → un reintento de Meta re-procesaba). Y el teléfono aparecía en logs de error (PII).

## Entregado (verificable)
| Pieza | Qué hace |
|---|---|
| `src/lib/whatsapp/dedup.ts` | `marcarProcesado(wamid)` → `{nuevo}` usando `create()` en `whatsapp_dedup/{wamid}` (existe = duplicado). **Fail-open**: ante wamid inválido o error del store, procesa (nunca descarta un mensaje real). `claveDedup` (id seguro) y `esWamidValido` son **puros**. Campo `expira` para una **política TTL** de Firestore. `telefonoRedactado` (solo últimos 4). |
| `webhook/route.ts` (Meta) | Salta el mensaje si `marcarProcesado(msg.id).nuevo === false`. Log de error con `telefonoRedactado`. |
| `360dialog-webhook/route.ts` | Mismo dedup + redacción (proveedor principal). |
| `whatsapp-dedup.test.ts` | 4 tests de las funciones puras (validez, clave segura/determinista, redacción). |

**Archivos:** `whatsapp/dedup.ts`, `whatsapp-dedup.test.ts` (nuevos); `webhook/route.ts`, `360dialog-webhook/route.ts` (dedup + redacción). Deps/migraciones: 0.

## Seguridad del cambio
- **Fail-open**: un bug de dedup nunca pierde un mensaje real (peor caso = procesar dos veces, el comportamiento previo). Y la creación de cita ya es **atómica**, así que un duplicado no genera doble cita. Riesgo contenido.
- **PII**: el teléfono ya no va completo a los logs (§sin PHI/PII en logs).

## Pruebas
- `tsc --noEmit` → 0. · `vitest run` → **407/407** (4 nuevos). · `next build` → OK.
- **Límite honesto:** el `create()`/ALREADY_EXISTS de Firestore no se ejecuta aquí (necesita runtime). La **decisión** (clave, validez, fail-open) sí está testeada; el store es una llamada delgada y a prueba de fallos.

## Diferido (infra, iteración dedicada 14)
- **Inbox table** (persistir el evento bruto cifrado/minimizado) + **DLQ** (dead-letter) + reintentos con backoff + correlation ID + observabilidad. Es arquitectura de fiabilidad (Iter. 14 RELIABILITY); aquí se cerró el riesgo confirmado (dedup) que era lo urgente.
- **TTL de la colección `whatsapp_dedup`**: el campo `expira` está listo; el Dr. activa la política TTL en la consola de Firestore (o se limpia con un cron).

## Quality Gate
```
QUALITY GATE: PASS (parcial) — webhooks verificados (firma), eventos duplicados
ignorados (dedup por wamid en Meta y 360dialog), respuesta rápida (Meta async),
sin PII en logs (teléfono redactado), fail-open (no se pierden mensajes). tsc 0,
407/407, build OK. Inbox/DLQ formal → Iter. 14. production_deployment_allowed:false.
```

## Siguiente iteración recomendada (no implementada)
**Iteración 4 — TENANT_CONNECTIONS** (verificar aislamiento total: el tenant se resuelve SIEMPRE del activo oficial; pruebas de acceso cruzado A/B, mismo teléfono en dos consultorios, activo desconocido). Verificable por código. O adelantar el **P0 crítico WA-1** (plantillas + ventana de 24 h).
