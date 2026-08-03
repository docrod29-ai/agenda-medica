/**
 * «RANGO HORARIO PREFERIDO» — el campo que se capturaba y nadie miraba.
 *
 * ── EL FALLO ─────────────────────────────────────────────────────────────────
 *
 * La lista de espera pide «Rango horario preferido» (`Ej. Mañana, 9-12`), lo
 * guarda en `WaitlistEntry.rangoHorario` y lo **enseña** en la ficha del
 * paciente. El emparejamiento del hueco liberado, en cambio, sólo miraba el
 * `tipo` y la `fechaDeseada`.
 *
 * Resultado: alguien que pidió por la mañana recibía el ofrecimiento de las 18:00
 * y, si contestaba **SÍ**, la cita se creaba a las 18:00. La recepción vio el dato
 * en pantalla, el paciente lo dijo, y el sistema hizo como si no existiera.
 *
 * Es el patrón caro de siempre: **un campo escrito que nadie lee**. Y aquí ni
 * siquiera estaba escondido — se enseña en la lista, así que desde dentro parece
 * que se está usando.
 *
 * ── LA REGLA QUE ORDENA ESTE ARCHIVO ─────────────────────────────────────────
 *
 * El campo es **texto libre**. Interpretarlo mal es peor que no interpretarlo:
 * dejaría fuera de la rueda a un paciente que sí podía venir, y nadie se
 * enteraría nunca —el que no recibe un mensaje no se queja de no haberlo
 * recibido—.
 *
 * Así que se entiende lo inequívoco y **lo demás no filtra**. `entendido: false`
 * significa «no sé», y «no sé» nunca excluye a nadie.
 *
 * Módulo PURO.
 */

/** Minutos desde la medianoche, en la zona del consultorio. */
export interface Franja {
  desde: number
  hasta: number
}

export interface RangoLeido {
  /** `false` = no se pudo interpretar. Entonces NO se filtra. */
  entendido: boolean
  franjas: Franja[]
  /** Qué se reconoció, para el registro. */
  comoSeLeyo: string
}

const NO_ENTENDIDO: RangoLeido = { entendido: false, franjas: [], comoSeLeyo: 'sin interpretar' }

const n = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')

/**
 * Las palabras del día, con la franja que el propio formulario sugiere.
 *
 * `Ej. Mañana, 9-12` es el marcador de posición que ve la recepción, así que
 * «mañana» aquí significa la primera mitad del día — no «el día siguiente». La
 * ambigüedad del español es real y por eso está escrito: si alguien captura
 * «mañana» queriendo decir «el día de mañana», el campo correcto es
 * `fechaDeseada`, que sí existe.
 *
 * Los cortes son de OFICINA, no clínicos: describen cómo habla la gente de su
 * propio horario, no una decisión médica.
 */
const PALABRAS: { clave: RegExp; franja: Franja; nombre: string }[] = [
  { clave: /\bmanana\b|\bmatutino\b|\ba\.?m\.?\b/, franja: { desde: 6 * 60, hasta: 12 * 60 }, nombre: 'mañana' },
  { clave: /\bmediodia\b/, franja: { desde: 12 * 60, hasta: 15 * 60 }, nombre: 'mediodía' },
  { clave: /\btarde\b|\bvespertino\b|\bp\.?m\.?\b/, franja: { desde: 12 * 60, hasta: 19 * 60 }, nombre: 'tarde' },
  { clave: /\bnoche\b|\bnocturno\b/, franja: { desde: 18 * 60, hasta: 22 * 60 }, nombre: 'noche' },
]

/** `9-12`, `9 a 12`, `09:30-12:00`, `de 4 a 7 pm`. */
const NUMERICO = /(\d{1,2})(?::(\d{2}))?\s*(?:h|hrs?|horas?)?\s*(?:-|–|—|a|as|hasta)\s*(\d{1,2})(?::(\d{2}))?/

/**
 * Interpreta el texto que escribió la recepción.
 *
 * @returns `entendido: false` cuando no se reconoce nada. Ese caso **no filtra**.
 */
export function leerRangoHorario(texto: string | undefined | null): RangoLeido {
  const t = n(String(texto ?? '')).trim()
  if (!t) return NO_ENTENDIDO

  const franjas: Franja[] = []
  const nombres: string[] = []

  const m = NUMERICO.exec(t)
  if (m) {
    let h1 = Number(m[1]); const min1 = Number(m[2] ?? 0)
    let h2 = Number(m[3]); const min2 = Number(m[4] ?? 0)
    /**
     * `de 4 a 7 pm` son las 16:00-19:00. Sin esto, un paciente que puede por la
     * tarde quedaba con una franja de madrugada y no le servía ningún hueco.
     * Sólo se aplica a las horas de reloj de 12 h: un `14` no se toca.
     */
    const tarde = /\bp\.?m\.?\b|\btarde\b|\bnoche\b/.test(t)
    if (tarde) {
      if (h1 < 12) h1 += 12
      if (h2 < 12) h2 += 12
    }
    // Un rango al revés («12-9») es un dedazo: no se adivina cuál quiso decir.
    const desde = h1 * 60 + min1
    const hasta = h2 * 60 + min2
    if (h1 <= 23 && h2 <= 24 && min1 < 60 && min2 < 60 && hasta > desde) {
      franjas.push({ desde, hasta })
      nombres.push(`${String(Math.floor(desde / 60)).padStart(2, '0')}:${String(desde % 60).padStart(2, '0')}`
        + `-${String(Math.floor(hasta / 60)).padStart(2, '0')}:${String(hasta % 60).padStart(2, '0')}`)
    }
  }

  if (franjas.length === 0) {
    for (const p of PALABRAS) {
      if (p.clave.test(t)) { franjas.push(p.franja); nombres.push(p.nombre) }
    }
  }

  if (franjas.length === 0) return NO_ENTENDIDO
  return { entendido: true, franjas, comoSeLeyo: nombres.join(' + ') }
}

/**
 * ¿Le sirve este hueco a quien pidió ese rango?
 *
 * @param hhmm hora del hueco, `HH:MM` en la zona del consultorio.
 * @param duracionMin cuánto dura la cita; el hueco tiene que caber ENTERO.
 *
 * Con un rango que no se entendió, o vacío, devuelve `true`: la duda no excluye.
 */
export function huecoSirve(rango: string | undefined | null, hhmm: string, duracionMin = 30): boolean {
  const leido = leerRangoHorario(rango)
  if (!leido.entendido) return true
  const mm = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm ?? ''))
  if (!mm) return true   // sin hora legible tampoco se excluye
  const inicio = Number(mm[1]) * 60 + Number(mm[2])
  const fin = inicio + Math.max(0, duracionMin)
  /**
   * El hueco tiene que CABER dentro de la franja, no sólo empezar dentro.
   *
   * Una cita de 45 min que arranca a las 11:45 termina a las 12:30: a quien
   * pidió «9-12» le rompe la mañana igual que si hubiera empezado a las 12.
   */
  return leido.franjas.some(f => inicio >= f.desde && fin <= f.hasta)
}

export const POR_QUE_LA_DUDA_NO_EXCLUYE =
  'El rango es texto libre. Interpretarlo mal deja fuera de la rueda a un ' +
  'paciente que sí podía venir, y eso no se detecta nunca: el que no recibe un ' +
  'mensaje no se queja de no haberlo recibido. Por eso «no sé» no filtra.'
