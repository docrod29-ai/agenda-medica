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
 * CÓMO SE NOMBRA UN DIAGNÓSTICO CUANDO LO VA A LEER OTRO — REG-364.
 *
 * Una sola definición, y vive aquí porque éste es el módulo que sabe qué es un
 * problema del paciente. La usan la lista de la consulta, el resumen del
 * expediente, el cuadro que ven los motores y el prompt de la ruta de
 * evidencia: cuatro lectores que **antes se llevaban sólo la descripción**, así
 * que un `presuntivo` se leía igual que un confirmado. `SUGERIDO ≠ CONFIRMADO`.
 *
 * Un `definitivo` va tal cual. Etiquetar también lo confirmado convertiría la
 * marca en ruido y dejaría de verse justo donde importa.
 */
export function nombreConCerteza(
  d: { descripcion?: string; tipo?: Diagnostico['tipo'] },
): string {
  const t = String(d.descripcion ?? '').trim()
  if (!t) return ''
  return !d.tipo || d.tipo === 'definitivo' ? t : `${t} (${d.tipo})`
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
