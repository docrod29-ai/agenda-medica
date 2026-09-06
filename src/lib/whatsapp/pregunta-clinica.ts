/**
 * ¿HABLA DE MEDICAMENTO O DE SÍNTOMA? — Panel de Lujo PP-003.
 *
 * ── QUÉ FALLABA ──────────────────────────────────────────────────────────────
 * «¿cuántos mL le doy de amoxicilina?» recibía por WhatsApp el COSTO de la
 * consulta: el detector de preguntas frecuentes casaba «cuanto» por subcadena
 * después de que la urgencia no coincidía. No es reaparición de REG-326 (la
 * urgencia sigue por encima): es un hermano nuevo, sobre la subcadena.
 *
 * ── LA REGLA ─────────────────────────────────────────────────────────────────
 * Antes del FAQ, una compuerta con el MISMO vocabulario que `esAdministrativa`
 * en `lib/paciente/pregunta-del-paciente.ts` (medicamento, pastilla, dosis,
 * tratamiento, receta, resultado, síntoma, dolor…) más unidades y verbos de
 * administración. Si casa, el bot NO contesta: escala — crea la misma tarea
 * `pregunta_paciente` que crea el portal y le dice al paciente que su médico
 * la verá. Escalar de más es el lado seguro (`patient-facing-ai.md` §3).
 *
 * ── QUÉ NO CUBRE ─────────────────────────────────────────────────────────────
 * Vocabulario, no criterio (`clinical-safety.md` §5): lo que no esté aquí NO se
 * vigila. No hay detección de negación a propósito («no tengo dolor» también
 * escala: es preferible a contestar la tarifa). No cubre otras lenguas.
 */

function norm(texto: string): string {
  return String(texto ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

/** Vocabulario compartido con `esAdministrativa` (pregunta-del-paciente.ts). */
const VOCABULARIO_CLINICO =
  /\b(medicamento|medicina|medicinas|pastilla|pastillas|tableta|tabletas|capsula|capsulas|jarabe|gotas|inyeccion|dosis|tratamiento|receta|resultado|resultados|estudio|estudios|analisis|laboratorio|sintoma|sintomas|dolor|duele|fiebre|calentura|temperatura|tos|vomito|vomitos|diarrea|mareo|mareos|sangrado|sangre|alergia|alergico|reaccion|efecto secundario|presion|azucar|glucosa|le doy|le puedo dar|puedo tomar|puedo dejar|dejar de tomar|se me olvido|me tomo|tomarme|tomarla|tomarlo|suspender|antibiotico|amoxicilina|paracetamol|ibuprofeno|insulina)\b|\b\d+\s?(ml|mg|mcg|gotas|tabletas|pastillas)\b|\b(ml|mg|mcg|miligramos|mililitros)\b/

export function hablaDeMedicamentoOSintoma(texto: string): boolean {
  return VOCABULARIO_CLINICO.test(norm(texto))
}

/** Lo que se le contesta al paciente cuando su pregunta es para el médico. */
export function textoDePreguntaEscalada(telefonoConsultorio: string): string {
  const tel = String(telefonoConsultorio ?? '').trim()
  return [
    'Esa pregunta es para tu médico y por aquí no puedo contestarla: este canal es para citas.',
    'Ya quedó registrada para que el consultorio la revise y te contacte.',
    // Sin «911» a propósito: esto NO es la respuesta de urgencia (esa gana
    // antes, en `lib/paciente/urgencia.ts`). Ponerlo aquí enseñaría al
    // paciente a ignorarlo el día que sea de verdad.
    tel ? `Si crees que no puede esperar, llama al ${tel} o acude a urgencias.` : 'Si crees que no puede esperar, acude a urgencias.',
  ].join('\n\n')
}

export const ORIGEN_PREGUNTA_WHATSAPP = 'whatsapp:pregunta'
