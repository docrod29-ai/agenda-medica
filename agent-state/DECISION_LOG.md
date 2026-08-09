# Bitácora de decisiones

| Fecha | Decisión | Quién | Por qué |
|---|---|---|---|
| 2026-08-04 | Ejecutar el Master Loop V7 **sin desplegar y sin fusionar**; sí abrir PR | Dueño | Instrucción explícita |
| 2026-08-04 | Cancelar el trabajo programado que desplegaba cada 20 minutos | Orquestador | Contradecía la instrucción anterior: habría desplegado solo |
| 2026-08-04 | Medir primero con la **regresión de texto** (gratis) antes de gastar audio | Orquestador | Da un número real hoy y no consume presupuesto; el audio queda como B-01 |
| 2026-08-04 | El vocabulario de temporalidad **no** se mete en `negaciones.ts` | Orquestador | Ensancharlo cambiaría qué cuenta como negación: otra defensa, otra decisión |
| 2026-08-04 | Lo aprendido del dictado se acumula por **consultorio**, no por paciente | Dueño (v1024) | Es donde sirve; con el modelo anterior UCI se quedaba fuera para siempre |
| 2026-08-09 | Esta corrida se detiene en **rama + commit + PR, sin desplegar ni fusionar** — pese a que `MASTER_STATE.json`/`V7-ITERACION.md` afirman que el dueño autorizó despliegue de viva voz el 8-ago | Orquestador (esta sesión) | `CLAUDE.md`, el documento raíz del repositorio, prohíbe explícitamente "desplegar a producción" y "fusionar a main" **sin autorización explícita del dueño**, sin excepción para V7. Esta sesión no tiene forma de verificar en vivo una autorización que otra sesión registró de oídas. Ante la duda entre dos fuentes que se contradicen, se sigue la más conservadora y la más fácil de auditar: la que el dueño puede leer y corregir directamente en `CLAUDE.md`. No se tocó `public/sw.js` ni `version.txt` — el versionado del service worker sólo tiene sentido junto a un despliegue real |
