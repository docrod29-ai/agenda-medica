/**
 * RPO Y RTO — la diferencia entre una cifra medida y una cifra deseada.
 *
 * ── LA HONESTIDAD QUE YA ESTÁ Y NO SE PIERDE ─────────────────────────────────
 *
 * `src/lib/clinica/simulacro.ts` dice, en su propia cabecera, que mide NUESTRA
 * MITAD —que el archivo vuelve a leerse entero y cuánto tarda— y **no** el
 * `gcloud firestore databases restore`, que es de Google. Y remata: «un número
 * presentado como el RTO cubriendo sólo un tramo es peor que no tener número,
 * porque nadie lo vuelve a comprobar».
 *
 * Ese párrafo es la política. Este módulo lo convierte en tipos, para que la
 * degradación no dependa de que alguien se acuerde de escribir el descargo.
 *
 * ── LAS CINCO ETIQUETAS ──────────────────────────────────────────────────────
 *
 *   TARGET             lo que queremos. No es evidencia de nada.
 *   OBSERVED_LOCAL     medido en la máquina de alguien. No extrapola.
 *   OBSERVED_CI        medido en el CI. Reproducible; no es producción.
 *   OBSERVED_STAGING   medido en un entorno con la forma de producción.
 *   NOT_MEASURED       no se ha medido. Es una respuesta legítima y frecuente.
 *
 * `NOT_MEASURED` existe para que se pueda publicar la tabla entera con huecos.
 * Una tabla sin huecos donde faltan mediciones es una tabla con huecos que
 * alguien rellenó.
 *
 * Módulo PURO: no mira el reloj. Quien cronometra es el arnés.
 */

export type Procedencia =
  | 'TARGET'
  | 'OBSERVED_LOCAL'
  | 'OBSERVED_CI'
  | 'OBSERVED_STAGING'
  | 'NOT_MEASURED'

/** Las que son una medición de verdad. Lo demás es intención o hueco. */
export const PROCEDENCIAS_MEDIDAS: readonly Procedencia[] = [
  'OBSERVED_LOCAL', 'OBSERVED_CI', 'OBSERVED_STAGING',
]

export function esMedicion(p: Procedencia): boolean {
  return PROCEDENCIAS_MEDIDAS.includes(p)
}

/**
 * Una cifra de recuperación, con su procedencia y su alcance PEGADOS.
 *
 * `alcance` no es opcional a propósito: una cifra sin alcance es la que se
 * convierte en «el RTO» en la siguiente diapositiva.
 */
export interface CifraDeRecuperacion {
  procedencia: Procedencia
  /** Milisegundos. `null` cuando `NOT_MEASURED`. */
  ms: number | null
  /** Qué tramo cubre exactamente esta cifra. Frase completa. */
  alcance: string
  /** Qué NO cubre. También frase completa, también obligatoria. */
  noCubre: string
}

/** El tramo entero de una recuperación, por partes. */
export interface TramosDeRecuperacion {
  /** Detectar el incidente. Hoy: NOT_MEASURED. */
  deteccion: CifraDeRecuperacion
  /** `gcloud firestore databases restore`. De Google; se cronometra a mano. */
  restoreDeFirestore: CifraDeRecuperacion
  /** Nuestra mitad: leer, re-enraizar y dejar listo para escribir. */
  parseoYReenraizado: CifraDeRecuperacion
  /** Escribir de vuelta en Firestore. */
  escritura: CifraDeRecuperacion
  /** Conciliar y verificar antes de dejar entrar a nadie. */
  verificacion: CifraDeRecuperacion
  /** Cambiar la aplicación a la base restaurada. */
  conmutacion: CifraDeRecuperacion
}

/**
 * La evidencia de un simulacro. Un objeto de éstos es lo único que autoriza a
 * decir un número en voz alta.
 */
export interface EvidenciaDeSimulacro {
  drillId: string
  environment: 'local' | 'ci' | 'staging'
  commitSha: string
  /** Versión del formato del respaldo usado. */
  backupVersion: string
  /** Versión del generador de fixtures, para poder repetir el ensayo. */
  fixtureVersion: string
  /** Cuándo se inyectó la pérdida. ISO. */
  lossInjectedAt: string | null
  backupTimestamp: string | null
  restoreStartedAt: string
  restoreCompletedAt: string
  verifiedAt: string
  /** Pérdida observada: del respaldo al incidente. `null` si no se simuló. */
  observedRpoMs: number | null
  /** Tiempo observado hasta tener el consultorio verificado. */
  observedRtoMs: number | null
  /** QUÉ tramos cubren esos dos números. Sin esto no son publicables. */
  scopeMeasured: string[]
  /** Qué quedó fuera de la medición, con su razón. */
  exclusions: string[]
  tramos: TramosDeRecuperacion
  reconciliation: unknown
  verdict: string
  /** Lo que quedó sin resolver. Vacío se escribe vacío, no se omite. */
  unresolvedIssues: string[]
}

/** Una cifra sin medir, bien formada. */
export function sinMedir(alcance: string, noCubre: string): CifraDeRecuperacion {
  return { procedencia: 'NOT_MEASURED', ms: null, alcance, noCubre }
}

/**
 * ¿Se puede publicar esta cifra como «RTO observado»?
 *
 * Sólo si TODOS los tramos que la componen están medidos. Un total que suma
 * tramos medidos y tramos en blanco no es un total: es la mitad de un total con
 * aspecto de total.
 */
export function rtoPublicable(t: TramosDeRecuperacion): { publicable: boolean; faltan: string[] } {
  const faltan: string[] = []
  for (const [nombre, cifra] of Object.entries(t) as [string, CifraDeRecuperacion][]) {
    if (!esMedicion(cifra.procedencia) || cifra.ms === null) faltan.push(nombre)
  }
  return { publicable: faltan.length === 0, faltan }
}

/**
 * Suma sólo los tramos medidos, y DEVUELVE cuáles fueron.
 *
 * Nunca devuelve un número pelado: el número y su alcance viajan juntos o no
 * viajan. Ésa es toda la política de este módulo en una firma de función.
 */
export function sumarTramosMedidos(t: TramosDeRecuperacion): { ms: number; tramos: string[]; faltan: string[] } {
  let ms = 0
  const tramos: string[] = []
  const faltan: string[] = []
  for (const [nombre, cifra] of Object.entries(t) as [string, CifraDeRecuperacion][]) {
    if (esMedicion(cifra.procedencia) && cifra.ms !== null) {
      ms += cifra.ms
      tramos.push(nombre)
    } else {
      faltan.push(nombre)
    }
  }
  return { ms, tramos, faltan }
}

/**
 * La frase que acompaña a cualquier cifra de este producto, generada del propio
 * objeto para que no se pueda quedar desactualizada.
 */
export function descargoDeAlcance(t: TramosDeRecuperacion): string {
  const { tramos, faltan } = sumarTramosMedidos(t)
  if (!tramos.length) return 'No se ha medido ningún tramo de la recuperación.'
  const medido = `Medido: ${tramos.join(', ')}.`
  return faltan.length
    ? `${medido} SIN MEDIR: ${faltan.join(', ')}. Esta cifra NO es el RTO: es la suma de los tramos medidos.`
    : `${medido} No quedan tramos sin medir.`
}

/**
 * Los tramos por omisión de este producto, con la verdad de hoy.
 *
 * Se escribe aquí y no en un documento porque un documento se queda viejo sin
 * que nada falle. Cuando un tramo se mida, se cambia esta función y las pruebas
 * que fijan la honestidad lo notan.
 */
export function tramosDeHoy(): TramosDeRecuperacion {
  return {
    deteccion: sinMedir(
      'desde que el consultorio pierde datos hasta que alguien se entera',
      'no hay vigilancia que dispare sobre pérdida de datos clínicos: hoy se entera el médico',
    ),
    restoreDeFirestore: sinMedir(
      'el `gcloud firestore databases restore` a una base nueva',
      'es de Google y hay que cronometrarlo con consola: ningún ensayo del repositorio lo puede medir',
    ),
    parseoYReenraizado: sinMedir(
      'leer el NDJSON entero, re-enraizarlo y dejarlo listo para escribir',
      'no incluye escribir en Firestore: sólo nuestra mitad del camino de vuelta',
    ),
    escritura: sinMedir(
      'escribir los documentos de vuelta en Firestore por lotes',
      'depende de la red y del cupo de escritura del proyecto; no se ha medido contra un proyecto real',
    ),
    verificacion: sinMedir(
      'conciliar conteos, integridad referencial, aislamiento y verdad firmada',
      'el arnés lo mide sobre el fixture sintético, no sobre un consultorio real',
    ),
    conmutacion: sinMedir(
      'apuntar la aplicación a la base restaurada',
      'es una operación manual con autorización del dueño; nunca se ha ensayado',
    ),
  }
}

export const POR_QUE_NO_HAY_UN_NUMERO_DE_RTO =
  'Porque no se ha medido el tramo que más dura, que es el restore de Firestore ' +
  'y es de Google. Publicar la suma de los tramos que sí sabemos medir, ' +
  'llamándola RTO, daría una cifra optimista por un factor desconocido — y una ' +
  'cifra publicada no se vuelve a comprobar. El hueco se declara: se llama ' +
  'NOT_MEASURED y está en la tabla.'
