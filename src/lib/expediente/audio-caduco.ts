/**
 * EL AUDIO DE LA CONSULTA QUE SE QUEDABA EN STORAGE PARA SIEMPRE.
 *
 * ── EL FALLO ─────────────────────────────────────────────────────────────────
 *
 * Para diarizar una consulta larga, el audio —la conversación entera entre el
 * médico y el paciente, o sea PHI en crudo— se sube a
 * `consultas-audio/{uid}/…`, se le pasa la URL a AssemblyAI y se borra en el
 * `finally` del hook.
 *
 * Ese `finally` sólo corre si el navegador sigue vivo. Y la espera es de **hasta
 * seis minutos** de sondeo: cerrar la pestaña, quedarse sin batería, perder la
 * red o simplemente irse a otra pantalla deja el archivo en el bucket **para
 * siempre**.
 *
 * Y cuando el borrado fallaba, el código lo decía así:
 *
 *     catch { /* lifecycle rule lo limpia *\/ }
 *
 * Una regla de ciclo de vida es **configuración del bucket**, no código. Nada en
 * este repositorio la declara, nadie la había creado, y el comentario la daba
 * por hecha. Es el patrón más caro de todos: **una regla escrita en un
 * comentario que el código de al lado no cumple** — y aquí la promesa
 * incumplida es «no dejamos PHI».
 *
 * ── LA REPARACIÓN ────────────────────────────────────────────────────────────
 *
 * Un barrido del servidor que no depende de que la pestaña sobreviva. Este
 * módulo es la parte que decide: qué objeto es audio de consulta y cuál ya
 * caducó. PURO, para poder probarlo sin bucket.
 */

/** Prefijo único donde vive el audio temporal de consulta. */
export const PREFIJO_AUDIO = 'consultas-audio/'

/**
 * Cuánto puede vivir un audio antes de considerarse abandonado.
 *
 * El sondeo de la diarización dura como mucho ~6 minutos. Veinticuatro horas es
 * margen de sobra para cualquier reintento y para la diferencia de reloj entre
 * el navegador y el bucket, sin dejar la conversación de un paciente ahí un día
 * más de lo necesario.
 *
 * No es un umbral clínico: es cuánto tarda en dejar de ser útil un archivo de
 * trabajo. La nota, que es el registro, ya está guardada en el expediente.
 */
export const HORAS_DE_VIDA = 24

export interface ObjetoStorage {
  /** Ruta completa dentro del bucket. */
  nombre: string
  /** `timeCreated` del objeto, en ISO. Es la fuente autorizada. */
  creadoEn?: string | null
}

export type Veredicto =
  | { borrar: true; porQue: string; edadHoras: number }
  | { borrar: false; porQue: string }

/** ¿Es un objeto del namespace de audio temporal de consulta? */
export function esAudioDeConsulta(nombre: string): boolean {
  const n = String(nombre ?? '')
  // Sin la barra final, `consultas-audio-viejo/…` entraría en el barrido.
  return n.startsWith(PREFIJO_AUDIO) && n.length > PREFIJO_AUDIO.length
}

/**
 * La marca de tiempo que el hook mete en el nombre: `…-<Date.now()>.<ext>`.
 *
 * Es el respaldo para cuando el listado no trae `timeCreated`. Se valida el
 * rango: un número de trece dígitos que no sea un instante razonable no se toma
 * por fecha — adivinar mal aquí significa borrar algo recién subido.
 */
export function fechaEnNombre(nombre: string): number | null {
  const m = /-(\d{13})\.[A-Za-z0-9]+$/.exec(String(nombre ?? ''))
  if (!m) return null
  const t = Number(m[1])
  // 2020-01-01 … 2100-01-01. Fuera de ahí, no es una fecha nuestra.
  return t >= 1_577_836_800_000 && t <= 4_102_444_800_000 ? t : null
}

/**
 * ¿Se borra este objeto?
 *
 * ── LA REGLA QUE ORDENA ESTA FUNCIÓN ─────────────────────────────────────────
 *
 * **Lo que no se puede fechar, no se borra.** Un barrido que borra ante la duda
 * puede llevarse el audio de una consulta que se está transcribiendo en ese
 * mismo momento, y el médico vería su dictado fallar sin explicación. Dejarlo
 * un ciclo más sólo cuesta que se borre en el siguiente barrido.
 */
export function veredicto(obj: ObjetoStorage, ahoraMs: number, horas = HORAS_DE_VIDA): Veredicto {
  if (!esAudioDeConsulta(obj.nombre)) {
    return { borrar: false, porQue: 'no está bajo consultas-audio/' }
  }
  const porMetadato = obj.creadoEn ? Date.parse(obj.creadoEn) : NaN
  const creado = Number.isFinite(porMetadato) ? porMetadato : fechaEnNombre(obj.nombre)
  if (creado === null || !Number.isFinite(creado)) {
    return { borrar: false, porQue: 'no se pudo fechar: ante la duda no se borra' }
  }
  const edadHoras = (ahoraMs - (creado as number)) / 3_600_000
  /**
   * Una fecha en el FUTURO no cuenta como caducada. Pasa con relojes
   * desajustados, y restar daría negativo — que no es «viejo», es «no sé».
   */
  if (edadHoras < 0) return { borrar: false, porQue: 'fechado en el futuro: reloj desajustado' }
  if (edadHoras < horas) {
    return { borrar: false, porQue: `sólo lleva ${edadHoras.toFixed(1)} h; el corte son ${horas} h` }
  }
  return { borrar: true, porQue: `abandonado hace ${edadHoras.toFixed(1)} h`, edadHoras }
}

export const POR_QUE_NO_BASTA_EL_FINALLY =
  'El borrado del hook vive en un `finally` del navegador: sólo corre si la ' +
  'pestaña sigue abierta, y la diarización sondea hasta seis minutos. Cerrarla ' +
  'dejaba la conversación del paciente en el bucket para siempre, con un ' +
  'comentario que confiaba en una regla de ciclo de vida que nadie había creado.'
