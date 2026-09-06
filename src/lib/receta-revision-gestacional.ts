/**
 * LA REVISIÓN GESTACIONAL, TAMBIÉN EN LA PANTALLA QUE IMPRIME — MG-002.
 *
 * ── EL DEFECTO ───────────────────────────────────────────────────────────────
 *
 * La pantalla de receta revisa unidad, mg/kg, techos, alergias, duplicidad,
 * interacciones, controlados y ajuste renal — y NUNCA la tabla de embarazo y
 * lactancia. `EMBARAZO_LACTANCIA` (prescripcion-segura.ts) sólo la consumía el
 * copiloto, y el copiloto sólo se monta en la consulta. Un fármaco AÑADIDO
 * directamente en la receta —el camino que no pasa por la consulta— salía
 * impreso sin una sola señal gestacional. Dos pantallas, dos niveles de
 * seguridad, y el médico sin saberlo.
 *
 * ── POR QUÉ ESTO NO ES UNA COPIA ─────────────────────────────────────────────
 *
 * No se reimplementa la tabla ni el criterio: se llama al MISMO motor
 * (`copiloto`) y se queda uno con sus avisos gestacionales. Una segunda tabla de
 * teratógenos sería una segunda fuente de verdad sobre la misma entidad clínica
 * — justo lo que el invariante prohíbe, y el modo de fallo que produjo este
 * hallazgo.
 *
 * El acoplamiento por el prefijo del `id` está probado en el golden: si el
 * copiloto renombra sus avisos, la prueba se pone roja en vez de dejar la
 * receta muda otra vez.
 *
 * ── LO QUE NO HACE ───────────────────────────────────────────────────────────
 *
 * No decide qué fármaco es teratógeno (eso es la tabla), no bloquea la firma
 * (nivel `revisa`, como el resto de la pantalla) y no afirma un embarazo que
 * nadie confirmó: el propio motor redacta en condicional cuando el diagnóstico
 * es presuntivo o diferencial (REG-364/REG-365).
 *
 * Módulo PURO.
 */
import { copiloto, type Sugerencia } from '@/lib/expediente/copiloto'
import type { Diagnostico } from '@/types/expediente'

/** El prefijo con el que el copiloto nombra sus avisos de riesgo gestacional. */
export const PREFIJO_AVISO_GESTACIONAL = 'gesta:'

export interface EntradaRevisionGestacional {
  sexo?: string
  edad?: number
  /** Diagnósticos que conoce la pantalla: los de la nota y el que se teclee aquí. */
  diagnosticos: readonly { descripcion?: string; tipo?: Diagnostico['tipo'] }[]
  /** El cuadro completo: lo de hoy y lo vigente. Un teratógeno crónico cuenta. */
  medicamentos: readonly { nombre?: string; dosis?: string }[]
}

/**
 * Los avisos de embarazo y lactancia que corresponden a esta receta.
 *
 * Devuelve las sugerencias tal cual las produce el copiloto (con su nivel, su
 * título y su detalle), para que la pantalla las pinte sin reescribir el texto.
 */
export function revisionGestacionalDeLaReceta(e: EntradaRevisionGestacional): Sugerencia[] {
  const medicamentos = e.medicamentos
    .filter(m => (m.nombre ?? '').trim())
    .map(m => ({ nombre: m.nombre ?? '', dosis: m.dosis }))
  if (!medicamentos.length) return []
  const diagnosticos = e.diagnosticos
    .filter(d => (d.descripcion ?? '').trim())
    .map(d => ({ descripcion: d.descripcion ?? '', tipo: d.tipo }))
  return copiloto({ sexo: e.sexo, edad: e.edad, diagnosticos, medicamentos })
    .filter(s => s.id.startsWith(PREFIJO_AVISO_GESTACIONAL))
}

export const POR_QUE_NO_SE_COPIA_LA_TABLA =
  'Porque una segunda tabla de teratógenos es una segunda fuente de verdad ' +
  'sobre la misma entidad clínica: el día que se añada un fármaco a una, la ' +
  'otra seguirá callada. Se llama al mismo motor y se filtran sus avisos.'
