/**
 * EL EVENTO DE TELEMETRÍA — un conjunto CERRADO de campos, y ni uno más.
 *
 * ── POR QUÉ UN CONJUNTO CERRADO Y NO UNA REDACCIÓN ───────────────────────────
 *
 * Ya existe redacción (`src/lib/security/sanitize.ts`): busca CURP, correos,
 * teléfonos y transcripciones dentro de un objeto cualquiera y los tapa. Es
 * buena y aquí se usa como segunda barrera.
 *
 * Pero la redacción es una lista de lo PROHIBIDO, y una lista de lo prohibido
 * siempre va por detrás: el día que alguien mete `motivoConsulta` —texto libre
 * dictado por el paciente— ningún patrón lo caza, porque no parece un CURP ni
 * un teléfono. Parece una frase. Y es PHI.
 *
 * La lista de lo PERMITIDO no tiene ese problema. Un campo nuevo no entra
 * porque no está, y para meterlo hay que editar este archivo, que es
 * exactamente donde debe discutirse.
 *
 * ── QUÉ IDENTIFICA A UN INQUILINO EN TELEMETRÍA ──────────────────────────────
 *
 * `tenantRef`, que es un seudónimo derivado del `clinicId`, no el `clinicId`.
 * No porque el identificador de una clínica sea PHI —no lo es— sino porque la
 * telemetría acaba en sitios con otro control de acceso, y un identificador que
 * cruza con la base de datos convierte cualquier volcado de métricas en un
 * directorio de clientes. El seudónimo permite decir «este inquilino tiene el
 * p99 malo» sin decir cuál.
 *
 * De paciente NO hay identificador. Ninguno, ni seudonimizado. La unidad de
 * observación es la OPERACIÓN, no la persona.
 *
 * Módulo PURO.
 */
import { sanitize } from '@/lib/security/sanitize'
import type { ClaseDeTrabajo } from '@/lib/reliability/clases-de-trabajo'

/** Familia del error, no su texto. El texto puede llevar PHI; la familia no. */
export type TaxonomiaError =
  | 'timeout'
  | 'saturacion'
  | 'autenticacion'
  | 'autorizacion'
  | 'validacion'
  | 'conflicto'
  | 'no-encontrado'
  | 'proveedor-caido'
  | 'circuito-abierto'
  | 'presupuesto-agotado'
  | 'resultado-caduco'
  | 'interno'

export type Desenlace = 'ok' | 'error' | 'degradado' | 'cancelado'

/**
 * EL CONJUNTO CERRADO. Nada fuera de aquí viaja.
 *
 * `readonly` en todos los campos: un evento que se muta después de validarse
 * es un evento que se validó sin validar nada.
 */
export interface EventoTelemetria {
  /** Un identificador por petición del usuario, que cruza todas las capas. */
  readonly correlationId: string
  /** Traza distribuida, cuando la hay. */
  readonly traceId?: string
  /** Seudónimo del consultorio. NUNCA el clinicId crudo. */
  readonly tenantRef: string
  /**
   * Identificador OPACO de la operación de encuentro. No es el identificador del encuentro:
   * es un seudónimo por operación, para poder seguir un guardado concreto
   * sin poder reconstruir el expediente desde la telemetría.
   */
  readonly encounterOpId?: string
  /** Familia del proveedor externo, nunca la llave ni el punto final. */
  readonly provider?: string
  readonly taskClass: ClaseDeTrabajo
  readonly latencyMs: number
  readonly outcome: Desenlace
  readonly retryCount: number
  readonly errorTaxonomy?: TaxonomiaError
  /** Estado del cortacircuitos en el momento del evento. */
  readonly circuitState?: 'cerrado' | 'abierto' | 'medio'
  /** Profundidad de la cola de esa clase al encolar/desencolar. */
  readonly queueDepth?: number
  /** Espera en cola, separada de la latencia de trabajo. */
  readonly queueWaitMs?: number
}

/**
 * La lista de campos permitidos, en tiempo de EJECUCIÓN.
 *
 * El tipo de arriba no protege de nada cuando el evento viene de un JSON, de un
 * `as`, o de un spread con un objeto de dominio dentro. Esta constante sí.
 */
export const CAMPOS_PERMITIDOS = [
  'correlationId', 'traceId', 'tenantRef', 'encounterOpId', 'provider',
  'taskClass', 'latencyMs', 'outcome', 'retryCount', 'errorTaxonomy',
  'circuitState', 'queueDepth', 'queueWaitMs',
] as const

export type CampoPermitido = typeof CAMPOS_PERMITIDOS[number]

export type ResultadoValidacion =
  | { valido: true; evento: EventoTelemetria }
  | { valido: false; camposProhibidos: string[]; motivo: string }

/**
 * Valida y PODA. Un campo que no está en la lista no se limpia: hace fallar la
 * validación.
 *
 * Podría podarse en silencio, y sería más cómodo. Pero un campo de PHI que se
 * poda en silencio no le enseña nada a quien lo escribió: lo volverá a poner
 * mañana en otro sitio, y algún día en uno que no pase por aquí. Fallar hace
 * que se arregle en el origen.
 */
export function validarEvento(candidato: Record<string, unknown>): ResultadoValidacion {
  const permitidos = new Set<string>(CAMPOS_PERMITIDOS)
  const prohibidos = Object.keys(candidato).filter(k => !permitidos.has(k))
  if (prohibidos.length) {
    return {
      valido: false,
      camposProhibidos: prohibidos,
      motivo: `Campos fuera del contrato de telemetría: ${prohibidos.join(', ')}. Si hacen falta, se discuten en src/lib/observability/evento.ts — no se cuelan por un spread.`,
    }
  }
  for (const obligatorio of ['correlationId', 'tenantRef', 'taskClass', 'latencyMs', 'outcome', 'retryCount']) {
    if (candidato[obligatorio] === undefined) {
      return { valido: false, camposProhibidos: [], motivo: `Falta el campo obligatorio ${obligatorio}` }
    }
  }
  if (typeof candidato.latencyMs !== 'number' || !Number.isFinite(candidato.latencyMs) || candidato.latencyMs < 0) {
    return { valido: false, camposProhibidos: [], motivo: 'latencyMs debe ser un número finito no negativo' }
  }
  if (typeof candidato.retryCount !== 'number' || !Number.isInteger(candidato.retryCount) || candidato.retryCount < 0) {
    return { valido: false, camposProhibidos: [], motivo: 'retryCount debe ser un entero no negativo' }
  }

  /**
   * SEGUNDA BARRERA. Los campos permitidos son todos opacos o numéricos, así
   * que en teoría no puede haber PHI aquí. En la práctica alguien meterá un
   * `provider` con el nombre del paciente dentro, o un `correlationId`
   * construido a partir de un correo. `sanitize` lo caza.
   *
   * Si la redacción CAMBIA algo, es que había algo que redactar: eso no se
   * arregla mandando el texto redactado, se arregla no mandándolo.
   */
  const redactado = sanitize(candidato)
  if (JSON.stringify(redactado) !== JSON.stringify(candidato)) {
    return {
      valido: false,
      camposProhibidos: [],
      motivo: 'Un valor del evento contenía un patrón identificable (correo, teléfono, CURP, RFC, token). La telemetría no lleva texto de persona.',
    }
  }

  return { valido: true, evento: candidato as unknown as EventoTelemetria }
}

/**
 * Seudónimo estable de un identificador, para telemetría.
 *
 * FNV-1a de 64 bits sobre `sal + valor`. NO es criptográfico y no se presenta
 * como tal: con la sal conocida, un atacante con la lista de clinicIds puede
 * revertirlo por fuerza bruta. Lo que consigue es que un volcado de métricas
 * SIN la sal no sea un directorio de clientes, que es la amenaza real aquí.
 *
 * La sal es de despliegue, no de inquilino: si cada inquilino tuviera la suya
 * no se podrían comparar dos despliegues, y la sal por inquilino habría que
 * guardarla en algún sitio junto al identificador que oculta.
 */
export function seudonimo(valor: string, sal: string): string {
  const texto = `${sal}::${valor}`
  let h1 = 0x811c9dc5, h2 = 0x01000193
  for (let i = 0; i < texto.length; i += 1) {
    const c = texto.charCodeAt(i)
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0
    h2 = Math.imul(h2 ^ ((c << 3) | (i & 7)), 0x85ebca6b) >>> 0
  }
  return `${h1.toString(16).padStart(8, '0')}${h2.toString(16).padStart(8, '0')}`
}
