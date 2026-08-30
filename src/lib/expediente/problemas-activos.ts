/**
 * LA LISTA DE PROBLEMAS DEL PACIENTE.
 *
 * ── LA SEGUNDA PREGUNTA DE CUALQUIER CONSULTA ────────────────────────────────
 *
 * La primera es qué está tomando (`ordenes-medicamento.ts`); la segunda es qué
 * tiene. El expediente tampoco la respondía de un vistazo: los diagnósticos
 * viven dentro de cada nota, así que «sus problemas» era «lo que escribí la
 * última vez que lo vi», y para saber si la hipertensión sigue activa había que
 * abrir notas hacia atrás.
 *
 * ── LA MISMA REGLA QUE LA MEDICACIÓN ─────────────────────────────────────────
 *
 * **La nota más reciente que menciona un problema es la que manda sobre ese
 * problema.** No la más reciente en general: una consulta por gripa que no habla
 * de la diabetes no resuelve la diabetes. Interpretar el silencio como
 * resolución vaciaría la lista de lo crónico, que es justo lo que hay que tener
 * delante al prescribir.
 *
 * ── LO QUE NO DECIDE ─────────────────────────────────────────────────────────
 *
 * Nada clínico. No infiere que un problema esté resuelto, no agrupa
 * diagnósticos parecidos, no traduce a CIE-10. Sólo ordena lo que el médico
 * escribió y lo pone donde se ve.
 *
 * Módulo PURO.
 */
import type { Diagnostico } from '@/types/expediente'

/** Una nota, reducida a lo que hace falta aquí. */
export interface NotaConDiagnosticos {
  /** ISO. Ordena qué es «lo último que se dijo». */
  fecha: string
  diagnosticos?: Diagnostico[]
  /** Los borradores no cuentan: la nota de hoy todavía se está escribiendo. */
  estado?: string
}

export interface ProblemaVigente {
  diagnostico: Diagnostico
  /** De qué nota salió la última palabra sobre este problema. */
  dichoEn: string
}

/** Clave para reconocer «el mismo problema» entre notas distintas. */
function claveProblema(d: Pick<Diagnostico, 'descripcion' | 'codigoCIE10'>): string {
  // El código, si lo hay, manda sobre el texto: «DM2» y «Diabetes mellitus tipo 2»
  // son el mismo problema y se escriben de veinte formas.
  const cie = String(d.codigoCIE10 ?? '').trim().toUpperCase()
  if (cie) return `cie:${cie}`
  return String(d.descripcion ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/** ¿Sigue siendo un problema del paciente hoy? */
export function estaVigente(d: Pick<Diagnostico, 'estado' | 'tipo'>): boolean {
  if (d.tipo === 'descartado' || d.tipo === 'diferencial') return false
  return d.estado !== 'resuelto'
}

/**
 * Los problemas del paciente según la última vez que se habló de cada uno.
 *
 * Ordena lo crónico primero: es lo que más pesa al prescribir y lo que no debe
 * quedar escondido detrás de tres catarros.
 */
export function problemasActivos(notas: readonly NotaConDiagnosticos[]): ProblemaVigente[] {
  const ultimaPalabra = new Map<string, ProblemaVigente>()

  // De la más NUEVA a la más vieja: la primera vez que se ve un problema es la
  // última cosa que se dijo de él.
  const orden = [...notas].sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)))
  for (const nota of orden) {
    if (nota.estado && nota.estado !== 'firmada') continue
    for (const dx of nota.diagnosticos ?? []) {
      const k = claveProblema(dx)
      if (!k) continue
      if (ultimaPalabra.has(k)) continue   // ya habló una nota más reciente
      ultimaPalabra.set(k, { diagnostico: dx, dichoEn: nota.fecha })
    }
  }

  const peso = (p: ProblemaVigente) => (p.diagnostico.estado === 'cronico' ? 0 : 1)
  return [...ultimaPalabra.values()]
    .filter(p => estaVigente(p.diagnostico))
    .sort((a, b) => peso(a) - peso(b) || String(b.dichoEn).localeCompare(String(a.dichoEn)))
}

/**
 * CÓMO SE NOMBRA UN DIAGNÓSTICO CUANDO LO VA A LEER OTRO — REG-364 / REG-365.
 *
 * Una sola definición, y vive aquí porque éste es el módulo que sabe qué es un
 * problema del paciente. La usan la lista de la consulta, el resumen del
 * expediente, el cuadro que ven los motores y el prompt de la ruta de
 * evidencia. Antes se llevaban los cuatro sólo la descripción.
 *
 * ── POR QUÉ `presuntivo` NO SE ETIQUETA (REG-365) ───────────────────────────
 *
 * Porque **es el valor de fábrica**, y un valor de fábrica no es un juicio.
 *
 *     extraction-schema.ts:40   .optional().default('presuntivo')
 *     prompts.ts:85             «Por defecto tipo="presuntivo".»
 *     consulta/page.tsx         el botón de añadir crea `tipo: 'presuntivo'`
 *     — y NINGUNA pantalla deja al médico elegir el tipo —
 *
 * Así que `presuntivo` no quiere decir «el médico lo dio por probable»: quiere
 * decir **«nadie dijo nada»**. Escribir «(presuntivo)» al lado de una diabetes
 * crónica confirmada afirma una duda que su médico nunca expresó, y encima lo
 * hace en casi todos los renglones: una etiqueta que sale siempre deja de
 * leerse justo el día que sí significa algo.
 *
 * Es la regla 4 de seguridad clínica por el otro lado: ausencia de dato no es
 * dato de ausencia, y tampoco es dato de duda.
 *
 * ── QUÉ SÍ SE ETIQUETA ──────────────────────────────────────────────────────
 *
 * `descartado` y `diferencial`: a esos **no se llega por omisión**, los escribe
 * el extractor cuando el médico dictó un descarte o un diferencial. Que no
 * lleguen aquí —`estaVigente` los filtra— no quita que esta función tenga que
 * saber nombrarlos: hay otros lectores, y el motor que afirma es el que
 * responde de lo que afirma (REG-364).
 *
 * El día que exista una pantalla donde el médico ELIJA el tipo, `presuntivo`
 * volverá a ser informativo — y hará falta distinguir el elegido del de
 * fábrica. Eso es un cambio de modelo, no de esta función.
 */
export function nombreConCerteza(
  d: { descripcion?: string; tipo?: Diagnostico['tipo'] },
): string {
  const t = String(d.descripcion ?? '').trim()
  if (!t) return ''
  return d.tipo === 'descartado' || d.tipo === 'diferencial' ? `${t} (${d.tipo})` : t
}

/** Frase corta para el encabezado de la consulta. */
export function resumenProblemas(activos: readonly ProblemaVigente[]): string {
  if (!activos.length) return 'Sin problemas registrados'
  const nombres = activos.map(p => nombreConCerteza(p.diagnostico)).filter(Boolean)
  if (nombres.length <= 3) return nombres.join(' · ')
  return `${nombres.slice(0, 3).join(' · ')} y ${nombres.length - 3} más`
}

/**
 * Cuándo fue la última visita, en palabras.
 *
 * Se calcula contra una fecha que se le pasa —no contra `new Date()`— para que
 * la función sea pura y se pueda probar: una función de tiempo que lee el reloj
 * por dentro sólo se puede comprobar con el reloj del que la prueba.
 */
export function haceCuanto(fechaISO: string | undefined, hoyISO: string): string {
  if (!fechaISO) return 'Primera consulta'
  const a = Date.parse(fechaISO.slice(0, 10)), b = Date.parse(hoyISO.slice(0, 10))
  if (!Number.isFinite(a) || !Number.isFinite(b)) return ''
  const dias = Math.round((b - a) / 86400000)
  if (dias < 0) return ''
  if (dias === 0) return 'hoy'
  if (dias === 1) return 'ayer'
  if (dias < 30) return `hace ${dias} días`
  const meses = Math.round(dias / 30)
  if (meses < 12) return `hace ${meses} ${meses === 1 ? 'mes' : 'meses'}`
  const anios = Math.floor(dias / 365)
  return `hace ${anios} ${anios === 1 ? 'año' : 'años'}`
}

export const POR_QUE_EL_SILENCIO_NO_RESUELVE =
  'Porque una consulta por gripa que no habla de la diabetes no resuelve la ' +
  'diabetes. Interpretar el silencio como resolución vaciaría la lista de lo ' +
  'crónico, que es justo lo que hay que tener delante al prescribir.'

/* ── LA PROYECCIÓN, CON LO QUE UNA LISTA NO PUEDE DECIR (WS-10, REG-405) ──── */

/**
 * ¿POR QUÉ NO BASTA CON DEVOLVER LA LISTA?
 *
 * Porque una lista no puede decir **de cuánto historial salió**.
 *
 * `listarNotasCompat` devuelve `{ notas, truncada, techo }` justamente para eso:
 * su encabezado explica que se borró la puerta que devolvía «un array pelado»
 * porque «un array no puede decir que viene recortado; quien lo recibe no tiene
 * forma de saberlo, y con un historial clínico el silencio se lee como *no
 * tiene*».
 *
 * Y a un paso de ahí, `problemasActivos(notas)` volvía a ser exactamente esa
 * puerta: las dos pantallas que la llaman **tienen `truncada` en la mano** y no
 * tenían dónde ponerlo. Con un historial largo, la lista de problemas activos se
 * calculaba sobre una ventana y se enseñaba como si fuera el expediente entero.
 * Una comorbilidad anterior al techo desaparecía sin que nada lo dijera.
 *
 * `estadoDeAlergias` ya tenía este sobre —`asOf`, `version`,
 * `historialRecortado`—. Aquí no se inventa uno nuevo: se usa el mismo.
 *
 * `problemasActivos` se conserva tal cual: es el núcleo puro y lo llaman sus
 * pruebas. Lo que cambia es que las pantallas piden el sobre.
 */
export const VERSION_PROYECCION_PROBLEMAS = 1

export interface EstadoDeProblemas {
  /** ISO del instante al que corresponde esta proyección. Se pasa; no se lee el reloj. */
  readonly asOf: string
  readonly version: number
  readonly problemas: readonly ProblemaVigente[]
  /**
   * true = el historial del que sale esto vino recortado (REG-350). Entonces
   * «no encontré más» NO significa «no hay más», y la pantalla tiene que decirlo.
   */
  readonly historialRecortado: boolean
}

/**
 * Los problemas activos **con el sobre que dice de dónde salieron**.
 *
 * @param asOf ISO del momento de la proyección. Se pasa para que sea pura.
 * @param opciones `historialIncompleto` cuando las notas vinieron recortadas.
 */
export function estadoDeProblemas(
  notas: readonly NotaConDiagnosticos[],
  asOf: string,
  opciones: { historialIncompleto?: boolean } = {},
): EstadoDeProblemas {
  return {
    asOf,
    version: VERSION_PROYECCION_PROBLEMAS,
    problemas: problemasActivos(notas),
    historialRecortado: opciones.historialIncompleto === true,
  }
}

export const POR_QUE_LA_LISTA_NO_BASTA =
  'Una lista no puede decir de cuánto historial salió. `listarNotasCompat` ' +
  'devuelve `truncada` precisamente porque «con un historial clínico el silencio ' +
  'se lee como no tiene», y a un paso de ahí esta proyección volvía a ser la ' +
  'puerta que devuelve un array pelado: las pantallas tenían el recorte en la ' +
  'mano y no tenían dónde ponerlo.'
