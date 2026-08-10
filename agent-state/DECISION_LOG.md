# Bitácora de decisiones

| Fecha | Decisión | Quién | Por qué |
|---|---|---|---|
| 2026-08-10 | El producto pasa a llamarse **Ausculta** | Dueño | Instrucción explícita a mitad de la ejecución de V9 |
| 2026-08-10 | El nombre se **deriva** de `src/lib/marca.ts`, no se teclea | Orquestador | Estaba a mano en ~400 sitios; la segunda vez no puede costar lo mismo. Guardián: `la-marca-es-una-sola.test.ts` |
| 2026-08-10 | Los **identificadores no se renombran** (dominio, proyecto Firebase, `appId`, caché del SW, llave del tema) | Orquestador | Son llaves, no texto: mandan al médico a un buzón inexistente, convierten la actualización en otra app, tiran la caché y borran el tema elegido. Declarado en `OWNER_DECISIONS_REQUIRED` M-2…M-4 |
| 2026-08-10 | La **documentación histórica** conserva el nombre viejo | Orquestador | Un registro que se reescribe deja de ser un registro. Lo mismo con las citas del dueño y los nombres de los archivos que entregó |
| 2026-08-10 | `VERSION_AVISO` sube a `2026-08`; **no** se fuerza reaceptación | Orquestador (reaceptación → dueño, M-5) | El texto del aviso cambió, y cada paciente guarda su hash: dos textos bajo la misma etiqueta rompen la trazabilidad. Obligar a reaceptar es determinación legal |
| 2026-08-10 | `COPILOT_VERSION` sube a 1.1.0 por el cambio de nombre **dentro del prompt** | Orquestador | El prompt es entrada del modelo: dos textos pueden dar dos salidas. Una nota firmada con v1.0.0 se explica con el prompt de v1.0.0 |
| 2026-08-04 | Ejecutar el Master Loop V7 **sin desplegar y sin fusionar**; sí abrir PR | Dueño | Instrucción explícita |
| 2026-08-04 | Cancelar el trabajo programado que desplegaba cada 20 minutos | Orquestador | Contradecía la instrucción anterior: habría desplegado solo |
| 2026-08-04 | Medir primero con la **regresión de texto** (gratis) antes de gastar audio | Orquestador | Da un número real hoy y no consume presupuesto; el audio queda como B-01 |
| 2026-08-04 | El vocabulario de temporalidad **no** se mete en `negaciones.ts` | Orquestador | Ensancharlo cambiaría qué cuenta como negación: otra defensa, otra decisión |
| 2026-08-04 | Lo aprendido del dictado se acumula por **consultorio**, no por paciente | Dueño (v1024) | Es donde sirve; con el modelo anterior UCI se quedaba fuera para siempre |
