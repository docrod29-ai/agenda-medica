/**
 * UN TRABAJO, UN CONSULTORIO. Sin excepciones y sin confiar en el cliente.
 *
 * ── POR QUÉ LA MIGRACIÓN ES EL SITIO MÁS PELIGROSO PARA ESTO ─────────────────
 *
 * En el resto del producto, una fuga entre consultorios se cuela de uno en uno:
 * alguien abre un expediente que no le toca. Aquí se cuela de cincuenta mil en
 * cincuenta mil, en una sola operación, y con el aspecto de una importación
 * normal. El padrón entero de un consultorio dentro de otro no se ve como un
 * incidente: se ve como que la importación funcionó.
 *
 * Y el camino de vuelta también existe: una reversión mal acotada borrando
 * expedientes de un consultorio ajeno.
 *
 * ── LAS TRES COMPROBACIONES, Y POR QUÉ NO SOBRA NINGUNA ──────────────────────
 *
 *  1. **El trabajo declara su consultorio y no cambia nunca.** Un `clinicId` que
 *     se pueda reescribir a mitad convierte cualquier trabajo en un puente.
 *  2. **Cada escritura comprueba su ruta.** Que el trabajo sea del consultorio A
 *     no impide que una ruta mal construida apunte al B; `clinic/importar` ya
 *     tuvo que aprender esto y reenraiza SIEMPRE, aunque el origen coincida.
 *  3. **Cada lectura de reconciliación comprueba lo mismo.** Contar documentos
 *     de otro consultorio para cuadrar las cuentas del propio haría que un
 *     descuadre real pasara desapercibido — y de paso revelaría cuántos
 *     pacientes tiene el vecino.
 *
 * Ninguna de las tres confía en el navegador. La pantalla puede mandar el
 * `clinicId` que quiera; estas funciones se ejecutan en el servidor, contra la
 * sesión ya verificada.
 *
 * Módulo PURO: decide y devuelve. Quien llama corta la petición.
 */
import type { Razon } from './contrato'

/** Un consultorio válido: el id de documento de Firestore, sin barras ni trucos. */
const FORMA_CLINIC_ID = /^[A-Za-z0-9_-]{1,128}$/

export function clinicIdValido(id: string): boolean {
  // `.` y `..` son ids reservados en Firestore y romperían la construcción de rutas.
  return FORMA_CLINIC_ID.test(id) && id !== '.' && id !== '..'
}

export type FalloAislamiento =
  | { readonly ok: true }
  | { readonly ok: false; readonly razon: Razon; readonly porQue: string }

const OK: FalloAislamiento = { ok: true }

/**
 * ¿Puede este trabajo tocar este consultorio?
 *
 * `sesion` es el consultorio de la sesión ya verificada en el servidor.
 * `trabajo` es el que declara el trabajo de importación. Que no coincidan no es
 * un caso raro que haya que apañar: es un intento de escribir en un consultorio
 * ajeno, y se corta.
 */
export function trabajoAutorizado(sesion: string, trabajo: string): FalloAislamiento {
  if (!clinicIdValido(sesion) || !clinicIdValido(trabajo)) {
    return { ok: false, razon: 'TENANT_MISMATCH', porQue: 'El identificador de consultorio no tiene forma válida.' }
  }
  if (sesion !== trabajo) {
    return {
      ok: false,
      razon: 'TENANT_MISMATCH',
      porQue: 'El trabajo de importación pertenece a otro consultorio.',
    }
  }
  return OK
}

/**
 * La raíz bajo la que TODO lo de este trabajo tiene que caer.
 *
 * Devolver la raíz en vez de comprobar cadenas sueltas por ahí es lo que hace
 * que no se pueda olvidar: quien quiera escribir tiene que construir la ruta
 * desde aquí.
 */
export function raizDelConsultorio(clinicId: string): string {
  if (!clinicIdValido(clinicId)) throw new Error('migración: clinicId inválido')
  return `clinics/${clinicId}`
}

/**
 * ¿Esta ruta cae dentro del consultorio del trabajo?
 *
 * Se compara con la barra final puesta a propósito. Sin ella, `clinics/abc`
 * daría por buena la ruta `clinics/abcdef/patients/x`, que es de otro
 * consultorio cuyo id empieza igual. Es el fallo de prefijo de toda la vida y
 * aquí valdría un padrón entero.
 */
export function rutaDentroDelConsultorio(ruta: string, clinicId: string): boolean {
  if (!clinicIdValido(clinicId)) return false
  return ruta.startsWith(`${raizDelConsultorio(clinicId)}/`)
}

/**
 * Comprueba una escritura completa: trabajo, sesión y ruta a la vez.
 *
 * Es la compuerta que se llama JUNTO a cada escritura de lote, no una vez al
 * empezar. Entre el arranque de un trabajo y su último lote pueden pasar
 * minutos, y en medio la sesión puede haber cambiado de consultorio en otra
 * pestaña.
 */
export function escrituraAutorizada(args: {
  readonly clinicIdSesion: string
  readonly clinicIdTrabajo: string
  readonly ruta: string
}): FalloAislamiento {
  const t = trabajoAutorizado(args.clinicIdSesion, args.clinicIdTrabajo)
  if (!t.ok) return t
  if (!rutaDentroDelConsultorio(args.ruta, args.clinicIdTrabajo)) {
    return {
      ok: false,
      razon: 'TENANT_MISMATCH',
      porQue: 'La ruta de escritura cae fuera del consultorio del trabajo.',
    }
  }
  return OK
}

/**
 * Filtra unos candidatos a reversión dejando sólo los del consultorio.
 *
 * Devuelve también cuántos se descartaron. Un descarte silencioso aquí sería el
 * fallo peor: la reversión creería haber terminado dejando expedientes vivos, o
 * —al revés, si el filtro faltara— borraría los del vecino y el informe diría
 * que todo fue bien.
 */
export function soloDelConsultorio<T extends { readonly ruta: string }>(
  items: readonly T[],
  clinicId: string,
): { readonly dentro: T[]; readonly fuera: number } {
  const dentro: T[] = []
  let fuera = 0
  for (const i of items) {
    if (rutaDentroDelConsultorio(i.ruta, clinicId)) dentro.push(i)
    else fuera++
  }
  return { dentro, fuera }
}
