/**
 * EL MARGEN ANTES DE LLAMAR ATRASADA A UNA DOSIS — un solo sitio.
 *
 * ── LO QUE ESTABA MAL ────────────────────────────────────────────────────────
 *
 * `const GRACIA_MIN = 30` estaba escrito DOS VECES, en dos pantallas distintas
 * (el MAR del paciente y el turno de enfermería). Las dos leen el mismo motor y
 * las dos le dicen a la misma enfermera si una dosis va atrasada.
 *
 * Dos copias de un número operativo es una sola cosa: la garantía de que algún
 * día dirán cosas distintas del mismo paciente — y quien lo vea no tendrá forma
 * de saber cuál de las dos pantallas miente.
 *
 * Además el motor lo declara explícitamente (`FALTA_GRACIA`): la gracia depende
 * de los turnos y de la ronda de enfermería, es una **decisión operativa de la
 * unidad**, no un umbral clínico. Y siendo de la unidad, estaba clavada en el
 * código donde el hospital no puede tocarla.
 *
 * ── LA REGLA ─────────────────────────────────────────────────────────────────
 *
 * Un solo valor por omisión, declarado aquí, y la unidad puede fijar el suyo en
 * la configuración (`config.graciaMarMin`). Un valor inválido NO se usa: se cae
 * al de fábrica en vez de reventar la pantalla del MAR o —peor— de inventar un
 * margen que nadie eligió.
 *
 * Módulo PURO.
 */

/**
 * Margen de fábrica, en minutos.
 *
 * 30 min es lo que estaba en las dos pantallas desde el principio; se conserva
 * tal cual para no cambiar en silencio lo que la unidad ya ve. NO es una cifra
 * clínica: es cuánto puede tardar la ronda en llegar a la cama.
 */
export const GRACIA_MAR_DEFECTO = 30

/** Tope de cordura: media jornada de margen ya no es un margen. */
const MAX_MIN = 12 * 60

/**
 * El margen que aplica a esta unidad.
 *
 * @param declarada lo que diga la configuración del consultorio, si dice algo.
 */
export function graciaMar(declarada?: number | null): number {
  // `Number(null)` es 0, y 0 es un margen VÁLIDO que alguien puede querer. Sin
  // este corte, «no declarado» y «declarado sin margen» serían el mismo valor.
  if (declarada === null || declarada === undefined || declarada === '' as unknown) return GRACIA_MAR_DEFECTO
  const n = Number(declarada)
  if (!Number.isFinite(n) || n < 0 || n > MAX_MIN) return GRACIA_MAR_DEFECTO
  return n
}

export const GRACIA_ES_OPERATIVA =
  'El margen antes de marcar una dosis atrasada es un valor OPERATIVO de la ' +
  'unidad —depende de los turnos y de la ronda de enfermería—, no un umbral ' +
  'clínico. Lo fija el hospital en la configuración.'
