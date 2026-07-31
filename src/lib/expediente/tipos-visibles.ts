import type { TipoNota } from '@/types/expediente'

/**
 * QUÉ TIPOS DE NOTA SE OFRECEN SEGÚN EL CONTEXTO.
 *
 * La consulta mostraba los DOCE tipos siempre, incluidos los hospitalarios
 * (Ingreso, Evolución, Egreso) en una consulta de consultorio — dos filas de
 * chips que saturan la pantalla con opciones que ahí no aplican. Y al revés: los
 * de consultorio no tienen sentido dentro de un internamiento.
 *
 * Se separan por contexto. `activo` siempre se incluye aunque no pertenezca al
 * contexto, para que el tipo seleccionado (p. ej. abierto por enlace) nunca
 * desaparezca de la lista.
 *
 * Puro y determinista → testeable.
 */

/** Tipos propios del internamiento hospitalario. */
const HOSPITALARIOS: TipoNota[] = ['ingreso', 'evolucion', 'egreso']

/** Orden de presentación en consultorio (sin los hospitalarios). */
const AMBULATORIOS: TipoNota[] = [
  'primera_vez', 'seguimiento', 'historia_clinica',
  'valoracion_preoperatoria', 'valoracion_inmuno', 'alta_consulta',
  'nota_postoperatoria', 'nota_anestesia', 'consentimiento',
]

/** Orden de presentación dentro de un internamiento. */
const EN_HOSPITAL: TipoNota[] = [
  'ingreso', 'evolucion', 'egreso',
  'nota_postoperatoria', 'nota_anestesia', 'valoracion_inmuno', 'consentimiento',
]

export function tiposVisibles(esNotaHospital: boolean, activo: TipoNota): TipoNota[] {
  const base = esNotaHospital ? EN_HOSPITAL : AMBULATORIOS
  // El tipo activo siempre presente, sin duplicar.
  return base.includes(activo) ? base : [activo, ...base]
}

export { HOSPITALARIOS }
