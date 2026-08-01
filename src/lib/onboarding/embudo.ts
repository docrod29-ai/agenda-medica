/**
 * DÓNDE SE ATORA UN MÉDICO NUEVO.
 *
 * ── EL OBJETIVO DEL CHARTER, LITERAL ─────────────────────────────────────────
 *
 * «Nuevo médico funcional sin asistencia humana». Eso no se puede afirmar ni
 * desmentir sin mirar el camino real: cuánto tarda desde que crea la cuenta
 * hasta que agenda, atiende, receta y cobra por primera vez.
 *
 * ── POR QUÉ NO HACE FALTA INSTRUMENTAR NADA NUEVO ────────────────────────────
 *
 * Los hitos YA quedan registrados —el paciente tiene `createdAt`, la nota tiene
 * su fecha, el cobro su folio, la cita su alta—. Lo que no existía es la resta.
 * Añadir eventos nuevos habría duplicado la verdad y encima sólo habría servido
 * para los médicos que llegaran DESPUÉS; derivarlo de lo que ya está guardado
 * funciona hacia atrás, con los que ya se atoraron.
 *
 * ── LO QUE DE VERDAD SE BUSCA ────────────────────────────────────────────────
 *
 * No el promedio. El promedio de un embudo lo dominan los que llegaron al final,
 * y los que importan son los que NO llegaron: el paso donde se quedaron es la
 * pantalla que hay que arreglar.
 *
 * Módulo PURO.
 */

export type ClaveHito =
  | 'cuenta'          // creó el consultorio
  | 'paciente'        // registró a su primer paciente
  | 'cita'            // agendó por primera vez
  | 'consulta'        // firmó su primera nota
  | 'receta'          // generó su primera receta
  | 'cobro'           // registró su primer cobro

export interface Hito {
  clave: ClaveHito
  /** Para pantalla, en el orden en que ocurren de verdad. */
  etiqueta: string
  /** Qué significa que alguien se quede AQUÍ. Es lo que se acciona. */
  siSeAtora: string
}

/**
 * El orden importa y no es el obvio.
 *
 * El paciente va ANTES que la cita a propósito: en el consultorio se registra a
 * la persona y luego se le da hora, no al revés. Poner la cita primero haría
 * parecer que todos «se saltan» un paso que en realidad no existe.
 */
export const HITOS: readonly Hito[] = [
  { clave: 'cuenta',   etiqueta: 'Creó su consultorio',   siSeAtora: 'Se registró y no volvió: el problema está en el alta o en el correo de verificación.' },
  { clave: 'paciente', etiqueta: 'Primer paciente',       siSeAtora: 'Entró pero no capturó a nadie. Suele ser un campo obligatorio que no puede llenar.' },
  { clave: 'cita',     etiqueta: 'Primera cita',          siSeAtora: 'Tiene pacientes y no agenda: mirar el horario del consultorio y los huecos disponibles.' },
  { clave: 'consulta', etiqueta: 'Primera nota firmada',  siSeAtora: 'Agenda pero no documenta. Es el paso que sostiene el producto entero.' },
  { clave: 'receta',   etiqueta: 'Primera receta',        siSeAtora: 'Documenta pero no imprime: casi siempre falta la cédula o el membrete.' },
  { clave: 'cobro',    etiqueta: 'Primer cobro',          siSeAtora: 'Usa lo clínico y no lo financiero. Puede ser deliberado: no todos cobran desde aquí.' },
] as const

/** Instantes (ms) de cada hito. `null` = no ha ocurrido. */
export type Instantes = Partial<Record<ClaveHito, number | null>>

export interface PasoEmbudo {
  hito: Hito
  alcanzado: boolean
  /** ms desde la creación de la cuenta. `null` si no se alcanzó o no hay origen. */
  desdeCuentaMs: number | null
}

export interface Embudo {
  pasos: PasoEmbudo[]
  /** El primer hito NO alcanzado. `null` cuando completó todo. */
  atoradoEn: Hito | null
  /** Cuántos hitos completó, de los que hay. */
  completados: number
}

const ms = (v: unknown): number | null => {
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? n : null
}

/**
 * El recorrido de UN consultorio.
 *
 * Un hito posterior alcanzado con uno anterior ausente NO se «corrige»: se
 * enseña tal cual. Pasa de verdad —un médico importa pacientes y su primer
 * paciente «propio» nunca existe— y maquillarlo escondería justo la anomalía
 * que hay que entender.
 */
export function embudoDe(instantes: Instantes): Embudo {
  const origen = ms(instantes.cuenta)
  const pasos: PasoEmbudo[] = HITOS.map(hito => {
    const t = ms(instantes[hito.clave])
    return {
      hito,
      alcanzado: t != null,
      desdeCuentaMs: t != null && origen != null ? Math.max(0, t - origen) : null,
    }
  })
  const primeroPendiente = pasos.find(p => !p.alcanzado)
  return {
    pasos,
    atoradoEn: primeroPendiente ? primeroPendiente.hito : null,
    completados: pasos.filter(p => p.alcanzado).length,
  }
}

/** Una duración en palabras. «4 min», «2 h», «3 días». */
export function duracionCorta(msTotal: number | null): string {
  if (msTotal == null) return '—'
  const min = Math.floor(msTotal / 60_000)
  if (min < 1) return 'menos de 1 min'
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `${h} h`
  const d = Math.floor(h / 24)
  return `${d} día${d === 1 ? '' : 's'}`
}

/**
 * La MEDIANA, no el promedio.
 *
 * Un consultorio que tardó tres semanas en volver desplaza el promedio de todos
 * los demás y hace parecer lento un alta que la mayoría termina en minutos. La
 * mediana dice qué le pasa al médico del medio, que es de quien se puede
 * aprender algo.
 */
export function medianaMs(valores: readonly (number | null)[]): number | null {
  const v = valores.filter((x): x is number => x != null).sort((a, b) => a - b)
  if (!v.length) return null
  const m = Math.floor(v.length / 2)
  return v.length % 2 ? v[m] : Math.round((v[m - 1] + v[m]) / 2)
}

export interface ResumenEmbudo {
  total: number
  /** Cuántos llegaron a cada hito. */
  alcanzaron: Record<ClaveHito, number>
  /** Mediana del tiempo hasta cada hito, entre los que llegaron. */
  medianaHasta: Record<ClaveHito, number | null>
  /** Dónde se quedan: hito → cuántos están parados ahí ahora. */
  atorados: Record<string, number>
}

/** El embudo de TODOS los consultorios, que es donde se ve el patrón. */
export function resumirEmbudos(embudos: readonly Embudo[]): ResumenEmbudo {
  const alcanzaron = {} as Record<ClaveHito, number>
  const medianaHasta = {} as Record<ClaveHito, number | null>
  const atorados: Record<string, number> = {}

  for (const h of HITOS) {
    const suyos = embudos.map(e => e.pasos.find(p => p.hito.clave === h.clave)).filter(Boolean)
    alcanzaron[h.clave] = suyos.filter(p => p!.alcanzado).length
    medianaHasta[h.clave] = medianaMs(suyos.map(p => p!.desdeCuentaMs))
  }
  for (const e of embudos) {
    const k = e.atoradoEn?.clave ?? 'completo'
    atorados[k] = (atorados[k] ?? 0) + 1
  }
  return { total: embudos.length, alcanzaron, medianaHasta, atorados }
}

export const POR_QUE_NO_EL_PROMEDIO =
  'Porque el promedio de un embudo lo dominan los que llegaron al final, y los ' +
  'que importan son los que NO llegaron. El paso donde se quedaron es la ' +
  'pantalla que hay que arreglar.'
