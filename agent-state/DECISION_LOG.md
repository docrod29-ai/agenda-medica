# Bitácora de decisiones

| Fecha | Decisión | Quién | Por qué |
|---|---|---|---|
| 2026-08-04 | Ejecutar el Master Loop V7 **sin desplegar y sin fusionar**; sí abrir PR | Dueño | Instrucción explícita |
| 2026-08-04 | Cancelar el trabajo programado que desplegaba cada 20 minutos | Orquestador | Contradecía la instrucción anterior: habría desplegado solo |
| 2026-08-04 | Medir primero con la **regresión de texto** (gratis) antes de gastar audio | Orquestador | Da un número real hoy y no consume presupuesto; el audio queda como B-01 |
| 2026-08-04 | El vocabulario de temporalidad **no** se mete en `negaciones.ts` | Orquestador | Ensancharlo cambiaría qué cuenta como negación: otra defensa, otra decisión |
| 2026-08-04 | Lo aprendido del dictado se acumula por **consultorio**, no por paciente | Dueño (v1024) | Es donde sirve; con el modelo anterior UCI se quedaba fuera para siempre |
| 2026-08-09 | Trabajar `PATIENT-PORTAL-001` (rate-limit del portal) en vez de inventar una nueva especificación V7 — el archivo que el disparo pide leer no existe en el repositorio | Orquestador | Regla de coordinación del propio disparo: repositorio → tests → git → especificación más nueva compatible → estado. V7 se fusionó a `main` (PR #278); V9 (con especificación íntegra) sigue activo y ya fusionado también (PR #279). Se tomó del backlog de V7 el ítem de mayor score que V9 no reclama |
| 2026-08-09 | NO voltear la comprobación de revocación del portal a fail-closed | Orquestador | El código ya trae la razón fail-open escrita y razonada; cambiarla es política, no código — se dejó en `OWNER_DECISIONS_REQUIRED.md` en vez de adivinarla |
