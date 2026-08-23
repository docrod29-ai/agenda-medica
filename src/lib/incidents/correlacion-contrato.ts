/**
 * EL CONTRATO DE CORRELACIÓN — lo que este kernel NECESITA, no lo que implementa.
 *
 * ── POR QUÉ AQUÍ NO HAY IMPLEMENTACIÓN ───────────────────────────────────────
 *
 * La primitiva de correlación ya está escrita, y no aquí: vive en el carril de
 * escala/resiliencia (#310, borrador de PR #342) en
 * `src/lib/observability/correlacion.ts`, con `nuevoCorrelationId()`,
 * la cabecera `x-ausculta-correlation-id`, `correlacionDeCabecera()` y
 * `encounterOpId()`.
 *
 * Escribir aquí una segunda sería exactamente el defecto que este repositorio
 * persigue: dos fuentes de verdad para la misma entidad. Y sería peor que
 * duplicar código — dos generadores distintos producen hilos que **no se cruzan**,
 * así que el día que hicieran falta juntos no habría forma de unir el registro
 * del navegador con el de la ruta.
 *
 * Así que este archivo declara la FORMA que el kernel consume y una compuerta
 * que comprueba que lo que llega es admisible. La implementación llega cuando
 * #342 se integre. Hasta entonces el kernel funciona sin correlación —los campos
 * son opcionales— y lo que se pierde es poder tirar del hilo, no la detección.
 *
 * ── DEPENDENCIA DE INTEGRACIÓN, EXACTA ───────────────────────────────────────
 *
 *   necesita: `nuevoCorrelationId`, `correlacionDeCabecera`, `CABECERA_CORRELACION`
 *   de:       `src/lib/observability/correlacion.ts` (rama de #342)
 *   cuando:   al integrar #342 en la ruta de lanzamiento
 *   qué hacer aquí: nada. `ContextoCorrelacion` ya tiene los nombres de campo de
 *                   #342, así que el objeto de allí encaja sin adaptador.
 *
 * Módulo PURO.
 */

/**
 * El hilo, tal y como lo consume el kernel.
 *
 * Los nombres son los de #342 a propósito: un adaptador que renombra campos es
 * un sitio más donde equivocarse, y renombrarlos aquí obligaría a mantener dos
 * vocabularios para lo mismo.
 */
export interface ContextoCorrelacion {
  readonly correlationId: string
  readonly traceId?: string
  /** Seudónimo del consultorio. NUNCA el `clinicId`. */
  readonly tenantRef?: string
  /** Operación de encuentro, opaca. */
  readonly encounterOpId?: string
  readonly feature: string
  /** PLANTILLA de ruta. */
  readonly ruta?: string
  readonly appVersion: string
}

/** La forma de un identificador admisible: la misma que valida #342. */
const FORMA_ID = /^[a-z0-9-]{8,64}$/

export interface RevisionDeContexto {
  readonly admisible: boolean
  readonly motivos: readonly string[]
}

/**
 * ¿Este contexto puede entrar en un incidente?
 *
 * Rechaza en vez de limpiar, por la misma razón que #342: un identificador
 * «limpiado» sigue siendo texto que alguien de fuera eligió, y ese texto acaba
 * en la telemetría de todo el sistema. Un identificador legítimo ya viene con la
 * forma correcta.
 *
 * Y comprueba lo que #342 no puede comprobar desde su lado: que el hilo **no se
 * derive de nada del paciente**. Un `correlationId` que fuera el id del
 * expediente pasaría la forma y volvería a meter en la telemetría justo lo que
 * se quería sacar. Aquí no se puede detectar el origen, así que se comprueba lo
 * que sí se puede: que no venga acompañado de un identificador de paciente.
 */
export function revisarContexto(c: Partial<ContextoCorrelacion> & Record<string, unknown>): RevisionDeContexto {
  const motivos: string[] = []
  if (typeof c.correlationId === 'string' && !FORMA_ID.test(c.correlationId)) {
    motivos.push('el correlationId no tiene la forma acordada: se descarta y se genera uno nuevo')
  }
  if (typeof c.tenantRef === 'string' && !FORMA_ID.test(c.tenantRef)) {
    motivos.push('el tenantRef no es un seudónimo con la forma acordada')
  }
  /**
   * Campos que no pueden viajar aunque alguien los ponga. La lista no es una
   * defensa —lo es el conjunto cerrado de `EventoIncidente`— sino un aviso
   * temprano para quien esté cableando algo desde el otro lado.
   */
  for (const prohibido of ['patientId', 'pacienteId', 'clinicId', 'uid', 'email', 'telefono', 'nombre', 'curp']) {
    if (prohibido in c) motivos.push(`«${prohibido}» no puede viajar en el contexto de correlación`)
  }
  return { admisible: motivos.length === 0, motivos }
}

export const DEPENDENCIA_DE_INTEGRACION = {
  carril: '#310 / borrador de PR #342',
  modulo: 'src/lib/observability/correlacion.ts',
  simbolos: ['nuevoCorrelationId', 'correlacionDeCabecera', 'CABECERA_CORRELACION', 'encounterOpId'],
  queHaceEsteKernelMientrasTanto:
    'Funciona sin correlación: los campos son opcionales. Se pierde poder tirar ' +
    'del hilo entre capas, no la detección ni la agrupación.',
  loQueNoSeDebeHacer:
    'Escribir aquí un segundo generador. Dos generadores distintos producen ' +
    'hilos que no se cruzan, y entonces el registro del navegador y el de la ' +
    'ruta hablan de la misma consulta sin poder demostrarlo.',
} as const
