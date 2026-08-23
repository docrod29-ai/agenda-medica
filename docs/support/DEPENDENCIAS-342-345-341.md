# Dependencias con los otros carriles — y qué NO se duplicó

Este carril se escribió después de leer los borradores de PR #342
(escala/resiliencia, #310), #345 (router de IA, #313) y #341 (evidencia, #314).
Lo que sigue es el inventario de lo que se **reutiliza**, lo que se **espera**, y
lo que deliberadamente **no se escribió** para no crear una segunda
implementación.

---

## #342 — escala y resiliencia (borrador, rama `claude/ausculta-scale-resilience-8n82vt`)

### Lo que #342 ya tiene y este carril NO reimplementó

| Módulo de #342 | Qué hace | Qué hizo #315 en su lugar |
|---|---|---|
| `src/lib/observability/correlacion.ts` | `nuevoCorrelationId`, `CABECERA_CORRELACION`, `correlacionDeCabecera`, `encounterOpId` | **Nada.** `src/lib/incidents/correlacion-contrato.ts` DECLARA la forma que consume, con los mismos nombres de campo, y una compuerta que rechaza contextos con identificador de paciente. Sin implementación. |
| `src/lib/observability/evento.ts` | Conjunto cerrado de campos de telemetría, `TaxonomiaError` de transporte | Se adoptó la misma **filosofía** (lista de lo permitido, no de lo prohibido) para la identidad del incidente. La taxonomía de #315 es de **producto**, no de transporte: no compite. |
| `src/lib/reliability/reintentos.ts` | Backoff con jitter | La máquina de estados de #315 calcula la espera **sin jitter a propósito**: la dispersión aleatoria es decisión de #342, y un `Math.random()` aquí haría el simulacro no reproducible. |
| `src/lib/reliability/cortacircuitos.ts` · `degradacion.ts` · `cola.ts` · `idempotencia.ts` | Cortacircuitos, modo limitado, colas, claves de idempotencia | #315 **consume** la idea, no el código: `puedeAutoRepararse()` EXIGE que alguien garantice la idempotencia y dice que no cuando nadie la garantiza. Quién la garantiza es #342. |
| `docs/reliability/NO-WHITE-SCREEN-INVENTORY.md` | Inventario de pantalla blanca (N-1 a N-4) | #315 **confirmó** N-1 y N-2 de forma independiente y NO reescribió el inventario. Ver R-08 y R-09. |

### Dependencia de integración exacta

```
necesita:  nuevoCorrelationId · correlacionDeCabecera · CABECERA_CORRELACION · encounterOpId
de:        src/lib/observability/correlacion.ts   (rama de #342)
cuándo:    al integrar #342 en la ruta de lanzamiento
qué tocar en #315: NADA. `ContextoCorrelacion` ya usa los nombres de #342, así
                   que el objeto de allí encaja sin adaptador.
mientras tanto:    el núcleo funciona sin correlación —los campos son
                   opcionales—. Se pierde poder tirar del hilo entre capas, no
                   la detección ni la agrupación.
```

### Por qué NO se copió el código de #342 a esta rama

Dos generadores de `correlationId` distintos producen hilos que **no se cruzan**.
El día que hicieran falta juntos, el registro del navegador y el de la ruta
hablarían de la misma consulta sin poder demostrarlo — que es exactamente el
problema que la correlación viene a resolver.

## #345 — router de IA (borrador)

**Sin dependencia y sin colisión.** #345 vive entero en `src/lib/ia/router/**` y
`scripts/ai/`. #315 no toca ninguno de los dos.

**Punto de encuentro futuro, declarado:** la acción
`respaldo_de_proveedor_autorizado` del catálogo de remediación dice literalmente
«el que el dueño ya aprobó». Quién es ese proveedor y con qué criterio se elige
es decisión de #345 (`decidir.ts`, `disponibilidad.ts`), no de #315. Cuando #345
se integre, la acción deberá delegar en él en vez de dejarlo a quien la llame.

## #341 — evidencia (borrador)

**Sin dependencia y sin colisión.** #341 vive en `src/lib/evidence-integrations/**`.

#315 aporta el runbook `RB-EVIDENCIA` y el contrato del médico para la categoría
`evidence` («No pude consultar evidencia ahora. Tu nota sigue editable») — que es
la frase que #341 pidió en su handoff de degradación. Es contrato, no código
compartido.

## Lo que #315 tocó fuera de su carpeta, y por qué

| Archivo | Qué se hizo | Por qué era necesario |
|---|---|---|
| `src/lib/ia/incidentes-servidor.ts` | Se AÑADEN campos (`firma`, `familia`, `categoria`, `severidad`, `runbookId`, `appVersion`) al mismo documento; se cuenta la salud de la telemetría | Es la única forma de que el núcleo no sea un sistema paralelo. La clave del documento y todo su comportamiento anterior quedan intactos. No pertenece a ninguno de los carriles excluidos. |
| `src/__tests__/modulos-sin-conectar.test.ts` | Tres huérfanos declarados con su motivo y su condición de salida; `familias-de-defecto.ts` sale de la lista porque ahora tiene consumidor | Es el mecanismo previsto por ese guardián. La alternativa era dejar el CI en rojo o borrar trabajo. |
| `src/__tests__/el-camino-del-medico-llega-entero.test.ts` | Trinquete 29 → 39, con la subida declarada módulo a módulo | El propio archivo dice: «no puede subir sin que alguien lo escriba aquí». Se escribió. |

**#342 también toca esos dos archivos de trinquete.** Los cambios son aditivos
(entradas nuevas en una lista, un número con su explicación al lado), así que la
reconciliación es una fusión de listas, no una decisión.

## Lo que NO se tocó, deliberadamente

`src/app/(dashboard)/**` (#306) · `src/lib/asr/**` y `src/hooks/useGrabacion*`
(#302) · `src/lib/expediente/**` y `src/lib/clinical/**` (#303) ·
`src/lib/evidence-integrations/**` (#341) · `src/lib/reliability/**` y
`src/lib/observability/**` (#342) · `src/lib/ia/router/**` (#345) ·
`firestore.rules` y `src/lib/authz/matriz-acceso.ts` (política de seguridad) ·
`src/lib/clinica/respaldo.ts` (manifiesto de respaldo) · Hospital y UCI.
