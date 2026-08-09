# Bitácora de decisiones

| Fecha | Decisión | Quién | Por qué |
|---|---|---|---|
| 2026-08-04 | Ejecutar el Master Loop V7 **sin desplegar y sin fusionar**; sí abrir PR | Dueño | Instrucción explícita |
| 2026-08-04 | Cancelar el trabajo programado que desplegaba cada 20 minutos | Orquestador | Contradecía la instrucción anterior: habría desplegado solo |
| 2026-08-04 | Medir primero con la **regresión de texto** (gratis) antes de gastar audio | Orquestador | Da un número real hoy y no consume presupuesto; el audio queda como B-01 |
| 2026-08-04 | El vocabulario de temporalidad **no** se mete en `negaciones.ts` | Orquestador | Ensancharlo cambiaría qué cuenta como negación: otra defensa, otra decisión |
| 2026-08-04 | Lo aprendido del dictado se acumula por **consultorio**, no por paciente | Dueño (v1024) | Es donde sirve; con el modelo anterior UCI se quedaba fuera para siempre |
| 2026-08-09 | El paquete se libera bajo capacidad **`firmar`**, no `clinico.escribir` | Orquestador | Liberar es un acto de aprobación clínica hacia el paciente, del mismo peso que firmar la nota. Reversible: es una línea del registro de rutas |
| 2026-08-09 | `medicationChanges` gana un cuarto tipo, **`cambiado`** | Orquestador | Con tres tipos la comparación era por nombre, y una warfarina de 2 mg → 10 mg salía «sin cambio» ante alguien que no puede detectar el error. Decisión de UX ordinaria por la especificación (§AUTONOMOUS DECISIONS), no de política clínica |
| 2026-08-09 | El paquete liberado es **inmutable**: `{notaId}__v{n}` con `.create()` | Orquestador | «¿Qué se le dijo exactamente a este paciente?» tiene que poder contestarse dentro de un año, cuando el código que lo compuso ya sea otro |
| 2026-08-09 | El seguimiento sólo se pega al paquete de la **última nota firmada** | Orquestador | Vive en el paciente y se sobrescribe en cada consulta; en una nota vieja pondría el seguimiento de otra consulta. Un hueco es información |
