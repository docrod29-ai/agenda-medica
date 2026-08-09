# Bitácora de decisiones

| Fecha | Decisión | Quién | Por qué |
|---|---|---|---|
| 2026-08-04 | Ejecutar el Master Loop V7 **sin desplegar y sin fusionar**; sí abrir PR | Dueño | Instrucción explícita |
| 2026-08-04 | Cancelar el trabajo programado que desplegaba cada 20 minutos | Orquestador | Contradecía la instrucción anterior: habría desplegado solo |
| 2026-08-04 | Medir primero con la **regresión de texto** (gratis) antes de gastar audio | Orquestador | Da un número real hoy y no consume presupuesto; el audio queda como B-01 |
| 2026-08-04 | El vocabulario de temporalidad **no** se mete en `negaciones.ts` | Orquestador | Ensancharlo cambiaría qué cuenta como negación: otra defensa, otra decisión |
| 2026-08-04 | Lo aprendido del dictado se acumula por **consultorio**, no por paciente | Dueño (v1024) | Es donde sirve; con el modelo anterior UCI se quedaba fuera para siempre |
| 2026-08-09 | El trabajo de V9 sigue en `claude/relaxed-fermi-vkeu6s`, no en `claude/nexus-patient-ux-v9` | Orquestador | La rama persistente de la especificación **ya se fusionó** (PR #279) y no existe en `origin`; su historia está en `main`, que es de donde arranca ésta. La especificación pide no perder trabajo válido y no trabajar sobre `main`: las dos se cumplen. La rama de esta sesión la fija el entorno, y crear otra dejaría dos ramas vivas con el mismo programa |
