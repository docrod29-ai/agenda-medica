# Iteración actual — OPS-003 · 8-ago-2026

**Modo**: autónomo, PR sí, despliegue no.

## Qué se hizo

1. Se eligió el ítem de mayor score sobre el backlog de `main` y se **verificó
   antes de tocar nada**, que es la regla. Los dos primeros —`VOICE-004` (el
   signo menos en el balance hídrico) y `SAFE-001` (los cuatro parsers de
   alergias)— ya estaban reparados en la v1031: cerrados con la comprobación
   escrita, no por confianza.

2. Se tomó el punto **C2/C3** del plan de la auditoría de nueve dimensiones.
   **C2 no se reprodujo**: `no\s+padece` estaba en la expresión desde el primer
   día y `condicionesNegadas('No padece diabetes.')` ya devolvía `['diabetes']`.
   Queda como **no confirmado** en el backlog — es el mismo veredicto al que
   llegó el disparo del 7-ago por su cuenta.

3. Corriendo el motor real sobre 18 variantes del habla salió un defecto que
   **nadie había reportado**:

   ```
   condicionesNegadas('¿Enfermedades crónicas como diabetes o presión alta?
                       No, nada más la presión alta.')
     → ['diabetes', 'hipertensión arterial']
   ```

   La respuesta empieza por «no», así que se daban por negadas las dos y
   `corregirCertezaPorNegacion` dejaba la **hipertensión** en `descartado` — la
   crónica que el paciente acababa de afirmar. Reproducido también en
   `agent/safety/SAFE-003` (v1076) y en `agent/safety/SAFE-003-ventana` (v1077).

4. **Y no se abrió PR por ello.** El PR **#237** (`agent/voice/VOICE-005`) ya lo
   resuelve, y mejor: exige que la negación **cierre** la respuesta y no decide
   nada si la respuesta afirma algo. Comprobado corriendo el motor en esa rama.
   Está sin fusionar, como los otros 21.

## Lo que sí se entrega

`scripts/estado-de-las-ramas.mjs` — la comprobación que faltaba en el **paso 1**
del bucle. Dice el siguiente REG y la siguiente versión libres sobre **todas** las
ramas (no sobre `main` solo), y qué ramas tocan un archivo dado.

Medido hoy: **33 ramas vivas · REG 191 en `main` contra 224 en ramas · service
worker v1073 contra v1106 · 22 PRs abiertos, catorce titulados «REG-192 …
(v1074)»** sobre reparaciones distintas.

Un REG repetido sobre cambios distintos deja de acotar el lote de notas
afectado, que es exactamente lo que REG-191 acababa de reparar para IEC 62304.

## Siguiente

Antes de elegir: `node scripts/estado-de-las-ramas.mjs <archivo>`.

El cuello de botella no es técnico: **fusionar o cerrar la cola es del dueño**
(T-1 en `OWNER_DECISIONS_REQUIRED.md`). Mientras no se fusione nada, cada disparo
vuelve a partir del mismo `main` y la cola sólo crece.
