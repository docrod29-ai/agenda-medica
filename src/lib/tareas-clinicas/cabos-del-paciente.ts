/**
 * LOS CABOS SUELTOS DE ESTE PACIENTE, EN EL ORDEN EN QUE DUELEN — REG-266.
 *
 * ── EL HUECO, Y LO DECÍA EL PROPIO CÓDIGO ───────────────────────────────────
 *
 * `tareasDePaciente()` lleva escrito en su comentario, desde que se escribió:
 *
 *     «Los pendientes de UN paciente, **para su expediente**.»
 *
 * Y el expediente no los mostraba. La función **no tenía un solo llamador**.
 *
 * El instrumento de motores sin conectar (REG-255) no la delató porque hay otra
 * `tareasDePaciente` —la de turnos de enfermería en UCI— y el nombre coincide.
 * Un barrido por nombre ve un llamador donde no lo hay. Por eso la comprobación
 * de esta reparación **no busca el nombre: busca el módulo**.
 *
 * ── POR QUÉ IMPORTA MÁS QUE EL WORKLIST ─────────────────────────────────────
 *
 * `/pendientes` ya existía y funciona: enseña los cabos sueltos de TODA la
 * consulta, mezclados. Sirve para trabajar la lista un martes por la tarde.
 *
 * Pero el momento en que un pendiente se resuelve de verdad es otro: **el
 * paciente sentado enfrente**. Ahí es donde «pediste una biometría hace tres
 * semanas y el resultado lleva nueve días sin que nadie lo lea» cambia lo que
 * pasa en los siguientes diez minutos. En un worklist de trescientas filas, ese
 * renglón no se encuentra.
 *
 * ── EL ORDEN, Y POR QUÉ ES ESTE ─────────────────────────────────────────────
 *
 * El propio modelo lo dice: **«completada» es que el trabajo se hizo;
 * «cerrada» es que alguien LO MIRÓ y decidió. Entre esas dos vive exactamente
 * el daño que esto existe para evitar.**
 *
 * Así que ese es el primer grupo, siempre: el resultado ya está en el sistema y
 * nadie lo ha leído. Después lo vencido, y después lo que aún tiene plazo.
 *
 * **Este orden es ADMINISTRATIVO, no clínico.** Es «a qué se le vuelve a
 * preguntar antes», no «qué es más grave». La gravedad la puso quien creó la
 * tarea, en `prioridad`, y aquí sólo se usa para desempatar — nunca se deduce
 * de qué estudio es. Ordenar por criterio médico sí sería inventarse cifras.
 *
 * Módulo PURO.
 */
import type { TareaClinica, EstadoTarea, Prioridad } from './modelo'

/** Estados en los que la tarea sigue reclamando algo. */
const VIVOS: readonly EstadoTarea[] = ['solicitada', 'aceptada', 'en_curso', 'completada']

/**
 * Los tres grupos, en el orden en que se enseñan.
 *
 * `sin_leer` no es un estado del modelo: es el estado `completada` mirado desde
 * el expediente, que es donde ese matiz significa algo.
 */
export type Grupo = 'sin_leer' | 'vencido' | 'en_plazo'

export interface CaboSuelto {
  tarea: TareaClinica
  grupo: Grupo
  /** Días transcurridos desde que venció. `null` si no ha vencido o no tiene plazo. */
  diasVencido: number | null
}

export interface CabosDelPaciente {
  lista: readonly CaboSuelto[]
  /** Cuántos hay en cada grupo, para poder decirlo sin recorrer la lista. */
  sinLeer: number
  vencidos: number
  enPlazo: number
  /**
   * Cerradas y canceladas que se leyeron pero NO se enseñan.
   *
   * Se cuenta para poder distinguir «este paciente no tiene pendientes» de
   * «este paciente nunca tuvo ninguno»: son cosas distintas y la pantalla no
   * debería afirmar la segunda cuando lo cierto es la primera.
   */
  yaCerrados: number
}

const DIA_MS = 86_400_000

const PESO_PRIORIDAD: Record<Prioridad, number> = { critica: 0, alta: 1, normal: 2 }

/** Milisegundos de un ISO, o `null` si no lo es. Nunca lanza. */
function ms(iso?: string): number | null {
  if (!iso) return null
  const n = Date.parse(iso)
  return Number.isFinite(n) ? n : null
}

/**
 * Reparte los pendientes de un paciente en grupos y los ordena.
 *
 * `ahoraMs` se inyecta: un módulo puro no lee el reloj, y así la prueba puede
 * situarse en cualquier instante sin esperar catorce días.
 */
export function cabosDelPaciente(
  tareas: readonly TareaClinica[],
  ahoraMs: number,
): CabosDelPaciente {
  let yaCerrados = 0
  const lista: CaboSuelto[] = []

  for (const t of tareas ?? []) {
    if (!VIVOS.includes(t.estado)) { yaCerrados++; continue }

    const vence = ms(t.venceEn)
    /**
     * `completada` gana a `vencido` a propósito, aunque también esté vencida.
     * Un resultado que ya llegó y nadie ha leído no es lo mismo que un estudio
     * que todavía no se ha hecho, y mezclarlos borra justo la distinción que el
     * modelo existe para sostener.
     */
    const grupo: Grupo =
      t.estado === 'completada' ? 'sin_leer'
      : vence !== null && vence < ahoraMs ? 'vencido'
      : 'en_plazo'

    lista.push({
      tarea: t,
      grupo,
      diasVencido: vence !== null && vence < ahoraMs
        ? Math.floor((ahoraMs - vence) / DIA_MS)
        : null,
    })
  }

  const ORDEN_GRUPO: Record<Grupo, number> = { sin_leer: 0, vencido: 1, en_plazo: 2 }

  lista.sort((a, b) => {
    if (ORDEN_GRUPO[a.grupo] !== ORDEN_GRUPO[b.grupo]) return ORDEN_GRUPO[a.grupo] - ORDEN_GRUPO[b.grupo]

    /* Dentro del grupo: lo más vencido primero. */
    if ((a.diasVencido ?? -1) !== (b.diasVencido ?? -1)) return (b.diasVencido ?? -1) - (a.diasVencido ?? -1)

    /* Luego la prioridad que puso quien la creó. Aquí no se deduce ninguna. */
    const pa = PESO_PRIORIDAD[a.tarea.prioridad] ?? 2
    const pb = PESO_PRIORIDAD[b.tarea.prioridad] ?? 2
    if (pa !== pb) return pa - pb

    /* Y por último la que vence antes; las que no tienen plazo, al final. */
    const va = ms(a.tarea.venceEn) ?? Number.POSITIVE_INFINITY
    const vb = ms(b.tarea.venceEn) ?? Number.POSITIVE_INFINITY
    return va - vb
  })

  return {
    lista,
    sinLeer: lista.filter(c => c.grupo === 'sin_leer').length,
    vencidos: lista.filter(c => c.grupo === 'vencido').length,
    enPlazo: lista.filter(c => c.grupo === 'en_plazo').length,
    yaCerrados,
  }
}

/**
 * Cómo se dice en una línea, para la cabecera.
 *
 * Devuelve `null` cuando no hay nada vivo: una cabecera que dice «0 pendientes»
 * ocupa el mismo sitio que una que dice algo, y enseñar ceros entrena a no mirar.
 */
export function comoSeResume(c: CabosDelPaciente): string | null {
  const partes: string[] = []
  if (c.sinLeer) partes.push(`${c.sinLeer} sin leer`)
  if (c.vencidos) partes.push(`${c.vencidos} vencido${c.vencidos === 1 ? '' : 's'}`)
  if (c.enPlazo) partes.push(`${c.enPlazo} en plazo`)
  return partes.length ? partes.join(' · ') : null
}

export const POR_QUE_SIN_LEER_VA_PRIMERO =
  'El modelo lo dice: «completada» es que el trabajo se hizo, «cerrada» es que ' +
  'alguien lo miró. Entre esas dos vive el daño que este módulo existe para ' +
  'evitar — el laboratorio hecho, el resultado en el sistema, y nadie que lo lea.'

export const POR_QUE_EL_ORDEN_NO_ES_CLINICO =
  'Es a qué se le vuelve a preguntar antes, no qué es más grave. La gravedad la ' +
  'puso quien creó la tarea, en `prioridad`, y aquí sólo desempata.'
