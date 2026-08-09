/**
 * CUÁNDO UN TRATAMIENTO YA DEBIÓ TERMINAR — §D1 del charter.
 *
 * ── EL AGUJERO ──────────────────────────────────────────────────────────────
 *
 * Un antibiótico prescrito «7 días» hace un mes **sigue apareciendo como
 * vigente**. Para siempre. Porque nadie compara la duración con el calendario.
 *
 * Y de esa lista de vigentes cuelgan el cruce de interacciones, el cruce
 * alergia ↔ fármaco y el motor de dosis. Es el mismo daño de REG-215 por otra
 * puerta: **motores de seguridad razonando sobre un paciente que no existe** —
 * sólo que ahí el paciente lo decía y aquí lo dice el calendario.
 *
 * ── LO QUE EL CHARTER PIDE, LITERAL ─────────────────────────────────────────
 *
 *     «Cuando la duración expira: PROBABLY_COMPLETED. Pide reconciliación.
 *      NO lo marques completado en silencio.»
 *
 * Las tres frases importan, y la tercera más que las otras dos.
 *
 * ── POR QUÉ «PROBABLEMENTE» Y NO «TERMINADA» ────────────────────────────────
 *
 * Porque el sistema **no sabe** si el paciente lo terminó. Sabe que la duración
 * que se escribió ya pasó. Son cosas distintas:
 *
 *   · pudo suspenderlo antes por un efecto adverso;
 *   · pudo alargarlo por indicación de otro médico;
 *   · pudo no surtirlo nunca.
 *
 * Marcarlo «terminada» sería que el sistema afirme un hecho clínico que nadie
 * comprobó. Marcarlo «probablemente terminada» es lo que de verdad se sabe, y
 * abre una tarea para que un humano lo cierre.
 *
 * ── LO QUE NO HACE ──────────────────────────────────────────────────────────
 *
 * No cambia el expediente. Calcula y señala. El cambio de estado lo hace el
 * médico al reconciliar — §C3, no elegir la verdad automáticamente.
 *
 * Módulo PURO, sin dependencias.
 */

/** Días que dura cada unidad que se dicta en un consultorio. */
const DIAS_POR_UNIDAD: Readonly<Record<string, number>> = {
  dia: 1, dias: 1,
  semana: 7, semanas: 7,
  mes: 30, meses: 30,
  año: 365, anio: 365, ano: 365, años: 365, anios: 365, anos: 365,
}

/**
 * Las duraciones que significan «sin fecha de término».
 *
 * Un crónico no caduca: la metformina de un diabético no «termina» a los 30
 * días. Marcarla probablemente terminada llenaría el worklist de tareas falsas
 * cada mes, y un worklist que se llena se abandona.
 */
const SIN_TERMINO = [
  'indefinido', 'indefinida', 'permanente', 'cronico', 'cronica', 'continuo',
  'continua', 'de por vida', 'sin suspender', 'hasta nueva indicacion',
  'mientras lo indique', 'de forma permanente', 'ongoing',
]

const norm = (s: unknown) =>
  String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()

/** Números dictados en palabra, que es como se escriben las duraciones cortas. */
const EN_PALABRA: Readonly<Record<string, number>> = {
  un: 1, una: 1, uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6,
  siete: 7, ocho: 8, nueve: 9, diez: 10, once: 11, doce: 12, catorce: 14,
  quince: 15, veinte: 20, treinta: 30,
}

/**
 * ¿Cuántos días dura esto? `null` si no se puede saber.
 *
 * `null` NO es un fallo: «hasta que se acabe el frasco» es una duración real que
 * no se puede contar, y devolver un número inventado sería peor que no devolver
 * nada.
 */
export function diasDeDuracion(duracion: unknown): number | null {
  const d = norm(duracion)
  if (!d) return null
  if (SIN_TERMINO.some(s => d.includes(s))) return null

  const m = /(\d+|[a-zñáéíóú]+)\s*(dia|dias|semana|semanas|mes|meses|a[nñ]o|a[nñ]os|anio|anios)/.exec(d)
  if (!m) return null

  const n = /^\d+$/.test(m[1]) ? Number(m[1]) : EN_PALABRA[m[1]]
  if (!n || n <= 0) return null

  const unidad = m[2].replace('ñ', 'n')
  const porUnidad = DIAS_POR_UNIDAD[unidad] ?? DIAS_POR_UNIDAD[unidad + 's']
  return porUnidad ? n * porUnidad : null
}

/**
 * Margen antes de dar por terminado un tratamiento.
 *
 * Se espera un poco más de la duración escrita porque el paciente rara vez
 * empieza el mismo día de la consulta —surte la receta al día siguiente, o el
 * lunes— y avisar el día exacto produciría tareas que el médico cierra sin
 * mirar. Dos días es suficiente para cubrir eso sin volverse tarde.
 */
export const DIAS_DE_GRACIA = 2

export interface Vencimiento {
  /** ¿La duración escrita ya pasó, con su margen? */
  yaDebioTerminar: boolean
  /** Días que dura, si se pudo saber. */
  dias: number | null
  /** Días transcurridos desde que se prescribió. */
  transcurridos: number | null
  /** Por qué se concluyó eso. Va a la pantalla. */
  porQue: string
}

/**
 * ¿Este tratamiento ya debió terminar?
 *
 * Ante cualquier duda —duración que no se puede contar, fecha ilegible, crónico—
 * responde **que no**. El error caro es decirle al médico que suspenda algo que
 * el paciente debe seguir tomando.
 */
export function yaDebioTerminar(p: {
  duracion: unknown
  /** Fecha de la nota donde se prescribió, en ISO. */
  prescritoEn: unknown
  ahoraMs: number
}): Vencimiento {
  const dias = diasDeDuracion(p.duracion)
  if (dias === null) {
    return {
      yaDebioTerminar: false, dias: null, transcurridos: null,
      porQue: 'la duración no tiene fecha de término, o no se puede contar',
    }
  }

  const t = Date.parse(String(p.prescritoEn ?? ''))
  if (!Number.isFinite(t)) {
    return {
      yaDebioTerminar: false, dias, transcurridos: null,
      porQue: 'no se sabe cuándo se prescribió',
    }
  }

  const transcurridos = Math.floor((p.ahoraMs - t) / 86_400_000)
  if (transcurridos < 0) {
    // Una fecha en el futuro es un dato roto, no un tratamiento por empezar.
    return { yaDebioTerminar: false, dias, transcurridos, porQue: 'la fecha de prescripción es futura' }
  }

  const vencido = transcurridos > dias + DIAS_DE_GRACIA
  return {
    yaDebioTerminar: vencido,
    dias,
    transcurridos,
    porQue: vencido
      ? `se prescribió para ${dias} días y ya pasaron ${transcurridos}`
      : `lleva ${transcurridos} de ${dias} días`,
  }
}

/** El texto del aviso y de la tarea. Se escribe una vez y se usa en los dos. */
export function comoSeDice(p: { farmaco: string; v: Vencimiento }): string {
  return `${p.farmaco} se prescribió para ${p.v.dias} días y ya pasaron ` +
    `${p.v.transcurridos}. Sigue en su lista como vigente: confirma si lo ` +
    'terminó, lo sigue tomando o se lo suspendieron.'
}

export const POR_QUE_PROBABLEMENTE_Y_NO_TERMINADA =
  'El sistema no sabe si el paciente lo terminó: sabe que la duración escrita ya ' +
  'pasó. Pudo suspenderlo por un efecto adverso, alargarlo por indicación de ' +
  'otro médico, o no surtirlo nunca. Marcarlo «terminada» sería afirmar un hecho ' +
  'clínico que nadie comprobó.'

export const POR_QUE_ANTE_LA_DUDA_NO =
  'El error caro es decirle al médico que suspenda algo que el paciente debe ' +
  'seguir tomando. Ante una duración incontable o una fecha ilegible, se calla.'
