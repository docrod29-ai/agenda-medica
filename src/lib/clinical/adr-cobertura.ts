/**
 * COBERTURA DE ADRs DEL CLINICAL ENGINE REGISTRY — E0-03.
 *
 * ═══ Por qué existe y por qué NO es «un ADR por motor, y punto» ═══
 *
 * El primer intento de esta unidad exigía un ADR para CADA motor registrado.
 * Hay 56 motores y 3 ADRs, así que el gate nacía rojo: 53 fallos el primer día.
 * Un gate que nadie puede poner en verde no se arregla — se ignora, se marca
 * como `skip` y deja de proteger. Un candado que siempre suena es un candado
 * apagado.
 *
 * ═══ El diseño que sí sostiene ═══
 * TRINQUETE (ratchet). La deuda documental existente se declara y se congela;
 * lo único que el gate impide es que CREZCA:
 *
 *   · Un motor que YA tiene ADR → se verifica estricto (campos obligatorios,
 *     que cite su archivo real y su versión). Si el ADR se degrada, el CI cae.
 *   · Un motor SIN ADR → cuenta como deuda. La deuda puede bajar, nunca subir.
 *   · Un motor NUEVO sin ADR → sube la deuda ⇒ **el CI cae**. Que es justo lo
 *     que se quería proteger: que no entre lógica clínica indocumentada.
 *
 * Así el gate arranca en verde, es honesto sobre lo que falta, y cada ADR que
 * se escriba aprieta la tuerca un paso sin poder aflojarse después.
 */

/**
 * Deuda documental CONGELADA a 2026-07-28. Este número solo puede BAJAR.
 *
 * Cómo bajarlo: escribe el ADR del motor, y cuando el gate te diga que la deuda
 * real es menor, actualiza esta constante. Nunca la subas para «arreglar» el CI:
 * si subió es porque entró un motor sin documentar, y eso es el hallazgo.
 */
export const DEUDA_ADR_CONGELADA = 52

/**
 * Campos que todo ADR de motor debe traer. Salen de los ADRs que ya existen
 * (CKD-EPI-2021, FIB-4, NEWS2), no de una plantilla inventada: se documenta lo
 * que de verdad hace falta para auditar un motor clínico.
 */
export const CAMPOS_ADR = [
  'Fuente de verdad',   // qué archivo manda — evita el motor duplicado (REG-007)
  'Referencia',         // de dónde salen los umbrales
  'Golden',             // qué test lo prueba
] as const

/**
 * Documentos de `docs/clinical-decisions/` que NO son ADRs de motor.
 *
 * Ahí viven también las DECISIONES CLÍNICAS del médico dueño, que son otro tipo
 * de documento. El gate anterior los trataba como ADRs huérfanos y se caía por
 * ello — un falso positivo que enmascaraba los hallazgos reales.
 */
export const DOCS_NO_ADR: readonly string[] = [
  'README.md',
  'DECISIONES-2026-07-28.md',   // respuestas del Dr. a las 25 preguntas
  'PREGUNTAS-PENDIENTES.md',    // registro de qué se preguntó
  'PREGUNTAS-TODO-EL-PROGRAMA.md', // mismo tipo que el anterior: preguntas al Dr. de las 63 unidades restantes
  'DECISIONES-ARQUITECTURA-2026-07-28.md', // respuestas del Dr. a PREGUNTAS-TODO-EL-PROGRAMA (bloques A→J), no ADR de motor
  'dosis-amoxicilina.md',       // decisión clínica del Dr., no ADR de motor
  'PREGUNTAS-ABIERTAS-2026-07-29.md', // mismo tipo: preguntas al Dr. con default seguro, no ADR de motor
  'DECISIONES-ICU-VOICE-INFUSION-OBSERVATION.md', // respuestas del Dr. a las 4 preguntas de ICU-001 (benchmark de voz, infusiones, observacion corregida, umbral de confirmacion), no ADR de motor
]
