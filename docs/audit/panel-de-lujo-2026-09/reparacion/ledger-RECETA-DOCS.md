# Ledger de reparación — RECETA-DOCS (Panel de Lujo, sep-2026)

Rama `reparacion/RECETA-DOCS`, sobre `7066d3a` (rama base con el motor de dosis
ya reparado). Una fila por hallazgo. El ID es el del Panel de Lujo: el
orquestador asigna los `REG-nnn` al integrar.

| ID | Área | Incidente | Estado | Test / control permanente |
|---|---|---|---|---|
| MI-002 | Receta impresa | La hoja de fábrica afirmaba «ALERGIAS: Negadas / no referidas» con el campo vacío, y leía el texto libre en crudo (una alergia sólo estructurada desaparecía del papel). La carta de referencia y la nota repetían el relleno con su propia frase. | CLOSED | `src/__tests__/el-impreso-no-afirma-alergias-negadas.test.ts` |
| MI-001 | Receta · riñón | El ajuste renal corría sobre los fármacos de HOY; la metformina crónica del expediente no llegaba al motor aunque el bloque de interacciones sí la viera. | CLOSED | `src/__tests__/el-ajuste-renal-de-la-receta-ve-lo-vigente.test.ts` |
| MC-003 | Consentimiento | Se imprimía sólo con la firma del médico: sin renglón para el paciente, su representante, los testigos, el lugar y la fecha, ni huella del texto aceptado. | CLOSED | `src/__tests__/el-consentimiento-lo-firma-quien-consiente.test.ts` |
| MC-004 | Carta de referencia | Se imprimía y desaparecía: ni colección, ni bitácora, ni línea de tiempo. | CLOSED | `src/__tests__/la-carta-de-referencia-queda-en-el-expediente.test.ts` |
| MG-002 | Receta · embarazo | La pantalla nunca consultaba la tabla de embarazo y lactancia: el fármaco añadido aquí salía sin ninguna señal gestacional. | CLOSED | `src/__tests__/la-receta-dice-lo-que-no-comprobo.test.ts` |
| MP-007 | Receta · pediatría | Avisaba por la edad ausente y callaba por el peso ausente: la comprobación mg/kg se apagaba en silencio. | CLOSED | `src/__tests__/la-receta-dice-lo-que-no-comprobo.test.ts` |
| MP-005 (parte impresa) | Receta impresa | El aviso de «volumen sin concentración» vivía sólo en la pantalla; el renglón salía limpio hacia la farmacia y el cuidador. | CLOSED | `src/__tests__/la-receta-dice-lo-que-no-comprobo.test.ts` |
| MO-003 | Orden de imagen | Se podía firmar «Radiografía de extremidades» sin región, lado ni proyección. | CLOSED | `src/__tests__/la-orden-de-imagen-dice-de-que-lado.test.ts` |
| PO-015 | Orden · portal | La misma orden sin lado, respondida al paciente con sello de procedencia. | CLOSED | `src/__tests__/la-orden-de-imagen-dice-de-que-lado.test.ts` |
| MO-012 | Catálogo de imagen | Entradas que imprimían sus propias opciones («columna (cervical / dorsal / lumbar)»). | CLOSED | `src/__tests__/la-orden-de-imagen-dice-de-que-lado.test.ts` |
| MO-005 | Orden emitida | Lo elegido no se guardaba: la orden vivía en el papel y en una tarea, no en el expediente; y FHIR no tenía ServiceRequest. | CLOSED | `src/__tests__/la-orden-de-imagen-dice-de-que-lado.test.ts` · `src/__tests__/lo-que-sale-al-mundo-no-afirma-de-mas.test.ts` |
| MC-010 | Compuerta de firma | Nota postoperatoria y valoración preoperatoria se firmaban sin diagnóstico estructurado. | CLOSED | `src/__tests__/la-compuerta-de-firma-ve-la-clase-y-pide-diagnostico.test.ts` |
| MI-004 (parte compuerta) | Compuerta de firma | «Cefalosporinas» + ceftriaxona no disparaba nada: la comparación por token no ve una clase. | CLOSED | `src/__tests__/la-compuerta-de-firma-ve-la-clase-y-pide-diagnostico.test.ts` |
| PC-001 · PO-001 (parte impreso) | Diagnóstico impreso | `diagnosticoParaImprimir` caía al primer diagnóstico con texto: podía imprimir uno descartado o resuelto. | CLOSED | `src/__tests__/el-impreso-no-lleva-un-diagnostico-descartado.test.ts` |
| MC-009 | Nota quirúrgica | Sin campo para operación planeada, cuenta de gasas, equipo quirúrgico, estudios transoperatorios, piezas a patología ni pronóstico. | CLOSED | `src/__tests__/la-nota-quirurgica-tiene-donde-asentarlo-todo.test.ts` |
| MC-022 | Nota quirúrgica | No había dónde asentar el hospital donde se operó. | CLOSED | `src/__tests__/la-nota-quirurgica-tiene-donde-asentarlo-todo.test.ts` |
| MC-021 | Nota quirúrgica | Ningún dato de fecha del procedimiento del que derivar el día postoperatorio. | PARCIAL | `src/__tests__/la-nota-quirurgica-tiene-donde-asentarlo-todo.test.ts` (el campo existe; el motor y la tarea, en handoff) |
| MI-011 | Notas de consultorio | Sin sección de pronóstico, mientras las hospitalarias la exigen. | CLOSED | `src/__tests__/la-nota-quirurgica-tiene-donde-asentarlo-todo.test.ts` |
| MC-020 | templates.ts | `esHospitalaria` decía que una nota postoperatoria es hospitalaria; la pantalla del expediente decía lo contrario. | CLOSED | `src/__tests__/la-nota-quirurgica-tiene-donde-asentarlo-todo.test.ts` |
| ZL-002 | Bitácora de impresión | El asiento se escribía ANTES de imprimir: con las ventanas emergentes bloqueadas la bitácora afirmaba una emisión que no ocurrió. | CLOSED | `src/__tests__/la-carta-de-referencia-queda-en-el-expediente.test.ts` · `src/__tests__/la-orden-de-imagen-dice-de-que-lado.test.ts` |
| ZL-003 | FHIR | Todas las notas —firma y prescriptor incluidos— se atribuían a la cédula de `config/main`. | CLOSED | `src/__tests__/lo-que-sale-al-mundo-no-afirma-de-mas.test.ts` |
| ZL-004 | FHIR | Toda alergia salía `confirmed` y toda receta histórica `active`. | CLOSED | `src/__tests__/lo-que-sale-al-mundo-no-afirma-de-mas.test.ts` |
| ZL-005 | HL7 | El adaptador fundía saturación arterial y pulsioximetría sin declararlo. | CLOSED | `src/__tests__/lo-que-sale-al-mundo-no-afirma-de-mas.test.ts` |
| ZL-018 | Paginación | Un bloque más alto que la hoja se imprimía cortado por `overflow:hidden`, sin señal. | CLOSED | `src/__tests__/lo-que-sale-al-mundo-no-afirma-de-mas.test.ts` |
| C-015 | Fechas | «Hoy» calculado en UTC en los nombres de archivo y en la fecha impresa de la carta de referencia. | CLOSED (5 impresos de esta rebanada) | `src/__tests__/el-papel-no-dice-1-anios-ni-la-fecha-de-manana.test.ts` |
| C-018 | Edad | «Edad: 1 años» en documentos con cédula profesional. | CLOSED (5 impresos de esta rebanada) | `src/__tests__/el-papel-no-dice-1-anios-ni-la-fecha-de-manana.test.ts` |
| MO-011 | Fricción · consulta corta | Nota + orden + receta costaban tres pantallas y un regreso a la nota entre documento y documento. | PARCIAL | `src/__tests__/la-orden-de-imagen-dice-de-que-lado.test.ts` (catálogo concreto) — enlaces directos añadidos; la pantalla única de cierre y el certificado, en `no-reparado` |
| N-022 | Receta viva | Renovar un crónico obligaba a dictarlo entero otra vez. | PARCIAL | `src/__tests__/la-receta-dice-lo-que-no-comprobo.test.ts` (renovación); recordatorios y adherencia, en handoff |
| PC-022 · PP-014 | Portal · descarga | «Descargar» entregaba sólo un `.doc` que un teléfono de gama baja no abre. | PARCIAL | `abrirRecetaParaImprimir` en `src/lib/receta-word.ts`; el botón del portal, en handoff |

## Lo que este ledger NO dice

No hay entrada para la reproducción `REP-072` (PC-001 en el portal): esa mitad
vive en `src/app/api/portal` y en `paquete-de-visita.ts`, que son de otra
rebanada. Lo que sí quedó cerrado aquí es la función que imprime el médico, que
era el segundo camino del mismo defecto.
