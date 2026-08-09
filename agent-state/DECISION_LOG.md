# Bitácora de decisiones

| Fecha | Decisión | Quién | Por qué |
|---|---|---|---|
| 2026-08-04 | Ejecutar el Master Loop V7 **sin desplegar y sin fusionar**; sí abrir PR | Dueño | Instrucción explícita |
| 2026-08-04 | Cancelar el trabajo programado que desplegaba cada 20 minutos | Orquestador | Contradecía la instrucción anterior: habría desplegado solo |
| 2026-08-04 | Medir primero con la **regresión de texto** (gratis) antes de gastar audio | Orquestador | Da un número real hoy y no consume presupuesto; el audio queda como B-01 |
| 2026-08-04 | El vocabulario de temporalidad **no** se mete en `negaciones.ts` | Orquestador | Ensancharlo cambiaría qué cuenta como negación: otra defensa, otra decisión |
| 2026-08-04 | Lo aprendido del dictado se acumula por **consultorio**, no por paciente | Dueño (v1024) | Es donde sirve; con el modelo anterior UCI se quedaba fuera para siempre |
| 2026-08-09 | La comprobación de revocación del portal **falla CERRADA** (503), no abierta (REG-295) | Orquestador — reversible, el dueño puede revertirla | El fail-open no daba servicio al paciente legítimo (su agenda también vive en Firestore y habría fallado igual); sólo revalidaba el enlace revocado durante una incidencia. Mismo criterio que «SIN CONFIGURACIÓN NO SE REAGENDA» en la misma ruta. El dueño ordenó continuar el ítem («sigue con PATIENT-PORTAL-001»), cuyo plan pedía tomar esta decisión |
