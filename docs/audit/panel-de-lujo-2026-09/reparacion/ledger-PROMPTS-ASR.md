# Bitácora de reparación — PROMPTS Y VOZ

Prompts, valla anti-inyección, lateralidad y sujeto del dictado. Reconstruida
por el orquestador desde los cinco commits de la rebanada.

| ID | Área | Incidente | Estado |
|----|------|-----------|--------|
| RT-002 · B-005 · B-006 | Seguridad clínica (P1) | **La valla anti-inyección se podía cerrar desde dentro**, y no todas las rutas con texto dictado la llevaban | CLOSED — `delimitar()` neutraliza los cierres sin borrar nada; `verificar-nota` mete la nota dentro de la valla; atribuir-roles, corregir y evidencia llevan guarda y valla; guardián de paridad sobre `api/expediente` con exentas por nombre |
| MO-001 · MO-002 | Clínico (P1) | **El lado.** El corrector no toca «derecho» ni «izquierdo», así que el motivo de lateralidad salía de una etapa que nunca lo producía: dos lados para la misma región, o una retractación, pasaban sin preguntar | CLOSED — detector determinista de contradicciones y `verificarLateralidad(dictado, nota)`. No decide cuál es el lado bueno: dice dónde no coinciden |
| MO-007 · MO-015 · B-012 | Voz (P1-P2) | El guardián no comparaba la SECUENCIA de lados (un intercambio con el mismo género se colaba), el aprendizaje podía aprender un lado o un volteo de negación, y la regla G del prompt autorizaba corregir en silencio | CLOSED — el guardián compara la secuencia; el aprendizaje rechaza lados en cualquier forma y volteos de negación; `safety.correcciones_de_audio` queda declarado en el esquema |
| B-013 | Seguridad clínica (P1) | **Un dictado se archivaba bajo el expediente abierto sin comprobar de quién era.** Un laboratorio no se archiva así —hay una compuerta que compara el nombre y pregunta—; un dictado sí | CLOSED — `sujeto-del-dictado.ts`, con el motivo `paciente_nombrado_no_coincide`. «Sin nombre» NO se lee como «coincide» |
| MO-004 | Clínico (P1) | Los estudios dictados no llegaban a la orden: con receta, al firmar se iba directo a /receta y la orden se quedaba en el tintero | CLOSED — `estudiosSolicitados` estructurado con tipo, región, lateralidad, proyección y `source_quote`; el prompt lo pide y PROHÍBE inventar la lateralidad |
| B-001 | Clínico (P1) | El prompt del consultor de evidencia **ordenaba** al modelo ajustar la dosis por función renal y peso — el ajuste tiene motor determinista y ese camino no lo usaba | CLOSED — la orden se retira; el prompt no manda aritmética con otras palabras |
| MC-001 | Clínico (P1) | El prompt preoperatorio ordenaba **asumir** un punto de Caprini a partir de una cirugía mencionada de pasada, contra otra línea del mismo prompt | CLOSED — el prompt deja de contradecirse |

## Nota del orquestador — lo que faltaba conectar

`sujeto-del-dictado.ts` quedó **escrito y sin un solo llamador**: la familia de
defecto más grande del ledger, y en la compuerta que decide de quién es una
consulta. Se cabló en el pipeline durante la integración, tras la compuerta de
ambigüedad. Sólo corre cuando el llamador dice a quién tiene abierto: sin eso el
dictamen viene `undefined`, porque no haber comprobado no es haber comprobado.

Lo mismo con `verificarLateralidad`, que cotejaba nota contra dictado y no lo
llamaba nadie: la consulta lo usa ahora y el aviso llega a la barra.
