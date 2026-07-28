# Protocolo Nexus OS — trabajo reanudable a prueba de créditos

Este programa lleva NexusMED de aplicación médica avanzada a **Clinical Intelligence
Operating System**. Son 68 unidades en 10 etapas. Ninguna sesión las hace todas: el
diseño está pensado para que **cortar la ejecución en cualquier momento no pierda nada**.

## La garantía

> Si se acaban los créditos a mitad de camino, al volver se retoma **exactamente**
> en la siguiente unidad pendiente, con todo el contexto en disco.

Se sostiene sobre tres hechos:

1. **El estado vive en disco, no en la conversación.** `estado.json` es la fuente de
   verdad. Se actualiza **después de cada unidad**, no al final del lote.
2. **La unidad es atómica y pequeña.** Lo máximo que se puede perder por un corte es
   *una* unidad a medio hacer — nunca el avance acumulado.
3. **Cada agente empieza comprobando si su trabajo ya existe.** Si
   `unidades/<ID>/RESULTADO.json` está en disco, devuelve `yaHecho` sin gastar nada.
   Esto hace la ejecución **idempotente**: relanzar el workflow es seguro y barato.

## Archivos

| Archivo | Qué es |
|---|---|
| `backlog.json` | Las 68 unidades, con objetivo, entregables, criterio de aceptación, dependencias y riesgo. **No se edita durante la ejecución.** |
| `estado.json` | Avance real: completadas, en curso, bloqueadas, lo que espera validación del Dr. **Se actualiza tras cada unidad.** |
| `CHECKPOINT.md` | Resumen legible de dónde vamos. Se reescribe en cada unidad. |
| `unidades/<ID>/DISENO.md` | Diseño de esa unidad (archivos a tocar, contratos, riesgos). |
| `unidades/<ID>/RESULTADO.json` | Qué se implementó, gates, tests. **Su existencia = unidad hecha.** |
| `unidades/<ID>/VERIFICACION.json` | Refutación adversarial del resultado. |

## Cómo se ejecuta

```bash
# Un lote (por defecto 3 unidades). Repetir tantas veces como se quiera.
# Es seguro relanzarlo: lo ya hecho se salta solo.
```

Se invoca el workflow `nexus-os`. Parámetros por `args`:

- `lote`: cuántas unidades intentar en esta corrida (default **3**). Sube o baja según créditos.
- `soloEtapa`: p. ej. `"E0"` para trabajar sólo el hardening.
- `soloUnidades`: lista explícita de IDs, ignora el orden.
- `dryRun`: `true` para planificar sin tocar código.

## Orden y dependencias

El workflow **no elige al azar**: toma la primera unidad pendiente cuyas dependencias
estén completadas. Por eso E0 (hardening) va primero — el propio charter lo dice:

> una IA extraordinariamente inteligente sobre una infraestructura que puede
> confundir 135 con 135,000 sigue siendo peligrosa.

## Reglas que el workflow no puede violar

Heredadas de la carta operativa y de los invariantes del programa:

1. **Nunca inventar una regla clínica, un umbral o un gold answer.** Si falta criterio
   médico, la unidad se marca `NEEDS_CLINICAL_REVIEW`, entra en
   `necesitaValidacionDelDr` de `estado.json` y **se detiene ahí**. No se adivina.
2. **Sólo datos sintéticos / fixtures / casos ficticios.** Jamás PHI real.
3. **Gates obligatorios antes de dar una unidad por hecha:** `tsc` limpio, `vitest`
   en verde y `build` OK. Si un gate falla, la unidad queda `bloqueada` con el error —
   no se marca completada.
4. **Nada se despliega a producción dentro del workflow.** El despliegue es una
   decisión aparte y explícita.
5. **No se rompe funcionalidad existente.** Si una unidad exige un cambio con riesgo de
   regresión visible (migraciones de hash, impresión, cobros), se entrega el plan y se
   marca para decisión del Dr. en vez de ejecutarlo a ciegas.

## Si algo sale mal

- **Se acabaron los créditos:** no hay que hacer nada. Se relanza el workflow; las
  unidades con `RESULTADO.json` se saltan solas.
- **Una unidad quedó a medias:** su `RESULTADO.json` no existe, así que se rehace
  completa. El código a medio escribir se detecta en el gate `tsc` del siguiente intento.
- **`estado.json` y los `RESULTADO.json` discrepan:** manda el disco. Los archivos
  `unidades/<ID>/RESULTADO.json` son la evidencia; `estado.json` es el índice.
