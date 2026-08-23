/**
 * LO QUE SE PUEDE CONTAR DE UNA DECISIÓN DE RUTEO — y lo que jamás.
 *
 * #313 §J. Cada operación de ruteo emite un evento con lo necesario para
 * medirla y NADA con lo que reidentificar a nadie.
 *
 * ── POR QUÉ HAY UNA LISTA BLANCA Y NO UNA LISTA NEGRA ────────────────────────
 *
 * Una lista de campos prohibidos protege de lo que alguien pensó en prohibir.
 * El día que se añada un campo nuevo —`resumenCorto`, `primerHallazgo`,
 * `contextoDeLaTarea`— no estará en la lista negra y pasará. Con lista blanca,
 * el campo nuevo falla la prueba hasta que alguien decida que puede salir.
 *
 * Es la misma diferencia que `security-tenant.md` ya exige para las rutas de
 * escritura: lista blanca de campos, no filtro de los malos.
 *
 * ── QUÉ NO ENTRA, LITERAL ────────────────────────────────────────────────────
 *
 * Nombre de paciente · transcripción · diagnóstico · medicamento · texto de la
 * nota · prompt · cuerpo de la respuesta. Ni troceado, ni resumido, ni «sólo
 * las primeras palabras». Y el `correlacionId` es un `requestId`, no un id de
 * paciente: cruzarlo con los logs debe llevar a la petición, nunca a la persona.
 *
 * Módulo PURO.
 */
import type { ResultadoRuteo } from '@/lib/ia/router/decidir'
import type { ClaseTarea, NivelRiesgo, SolicitudTarea } from '@/lib/ia/router/tareas'

/** El evento. Todo lo que sale de aquí es contable, no clínico. */
export interface EventoRuteo {
  /** El `requestId` de la operación. Cruza con los logs y con el libro de costos. */
  correlacionId: string
  claseTarea: ClaseTarea
  riesgo: NivelRiesgo
  /** `null` cuando no hubo decisión. */
  proveedor: string | null
  modelo: string | null
  /** Milisegundos de la llamada, si ya ocurrió. `null` en el momento de decidir. */
  latenciaMs: number | null
  resultado: 'decidido' | 'sin_candidato' | 'ejecutado' | 'fallo_de_ejecucion'
  /** Código de fallo del ruteo o de la ejecución. */
  codigo: string | null
  /** ¿Se usó un respaldo en vez del primario? */
  respaldoUsado: boolean
  /** ¿Se activó segunda revisión? */
  segundaRevision: boolean
  /** Referencia de la evidencia de calidad. Cadena opaca `modelo@clase·version·fecha`. */
  refCalidad: string | null
  /** Tokens estimados en el momento de decidir. */
  tokensEstimados: { entrada: number; salida: number } | null
  /** Tokens observados al ejecutar. */
  tokensObservados: { entrada: number; salida: number } | null
  /** USD estimados por el catálogo. */
  costoEstimadoUsd: number | null
  /** `requestId` del asiento del libro de costos. El costo REAL vive allí. */
  refLedger: string | null
  /** ISO. Se pasa: nada de relojes escondidos. */
  ts: string
}

/**
 * LOS ÚNICOS CAMPOS QUE PUEDEN SALIR.
 *
 * La prueba de no-PHI comprueba que un evento no tenga ninguna clave fuera de
 * esta lista. Añadir un campo obliga a añadirlo aquí a mano, y ese momento es
 * la revisión.
 */
export const CAMPOS_PERMITIDOS: readonly (keyof EventoRuteo)[] = [
  'correlacionId', 'claseTarea', 'riesgo', 'proveedor', 'modelo', 'latenciaMs',
  'resultado', 'codigo', 'respaldoUsado', 'segundaRevision', 'refCalidad',
  'tokensEstimados', 'tokensObservados', 'costoEstimadoUsd', 'refLedger', 'ts',
]

export interface Infraccion {
  campo: string
  motivo: 'campo_no_permitido' | 'valor_no_escalar' | 'correlacion_sospechosa'
}

/**
 * Patrones que delatan que alguien metió un identificador donde no toca.
 *
 * No pretende detectar nombres —`minimizar-phi.ts` ya explica por qué eso no se
 * puede prometer sin un diccionario que no existe—, sino cazar lo que tiene
 * FORMA propia y no debería viajar en un id de correlación.
 */
const SOSPECHOSOS: { re: RegExp; que: string }[] = [
  { re: /\b[A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z0-9]{2}\b/i, que: 'CURP' },
  { re: /\b[\w.+-]+@[\w-]+\.[\w.-]+\b/, que: 'correo' },
  { re: /\bpaciente[-_:/]/i, que: 'referencia a paciente' },
  { re: /\bpatient(Id)?[-_:/]/i, que: 'referencia a paciente' },
]

/**
 * ¿Este evento está limpio?
 *
 * Devuelve la lista de infracciones. Vacía = limpio. Se devuelve la lista y no
 * un booleano para que el fallo diga QUÉ campo, que es lo que hace falta para
 * arreglarlo.
 */
export function infraccionesDePhi(evento: Record<string, unknown>): Infraccion[] {
  const malas: Infraccion[] = []
  for (const [k, v] of Object.entries(evento)) {
    if (!(CAMPOS_PERMITIDOS as readonly string[]).includes(k)) {
      malas.push({ campo: k, motivo: 'campo_no_permitido' })
      continue
    }
    // Los objetos permitidos son sólo los dos de tokens, y sólo con números.
    if (v !== null && typeof v === 'object') {
      const ok = k === 'tokensEstimados' || k === 'tokensObservados'
      const soloNumeros = ok && Object.values(v as object).every(x => typeof x === 'number')
      if (!ok || !soloNumeros) malas.push({ campo: k, motivo: 'valor_no_escalar' })
      continue
    }
    if (typeof v === 'string') {
      for (const s of SOSPECHOSOS) {
        if (s.re.test(v)) { malas.push({ campo: k, motivo: 'correlacion_sospechosa' }); break }
      }
    }
  }
  return malas
}

export const esLibreDePhi = (evento: Record<string, unknown>): boolean =>
  infraccionesDePhi(evento).length === 0

/**
 * Construye el evento de una DECISIÓN (todavía no se ha llamado a nadie).
 *
 * Lee sólo campos ya libres de contenido: la solicitud no lleva prompt ni
 * texto, por diseño de `SolicitudTarea`.
 */
export function eventoDeDecision(s: SolicitudTarea, r: ResultadoRuteo, tsISO: string): EventoRuteo {
  const tokens = (s.tamanoEntradaEstimado ?? 0) + (s.presupuestoSalida ?? 0) > 0
    ? { entrada: s.tamanoEntradaEstimado ?? 0, salida: s.presupuestoSalida ?? 0 }
    : null
  if (!r.ok) {
    return {
      correlacionId: s.correlacionId, claseTarea: s.claseTarea, riesgo: s.riesgo,
      proveedor: null, modelo: null, latenciaMs: null,
      resultado: 'sin_candidato', codigo: r.codigo,
      respaldoUsado: false, segundaRevision: false, refCalidad: null,
      tokensEstimados: tokens, tokensObservados: null,
      costoEstimadoUsd: null, refLedger: null, ts: tsISO,
    }
  }
  return {
    correlacionId: s.correlacionId, claseTarea: s.claseTarea, riesgo: s.riesgo,
    proveedor: r.proveedorSeleccionado, modelo: r.modeloSeleccionado, latenciaMs: null,
    resultado: 'decidido', codigo: null,
    respaldoUsado: false, segundaRevision: r.segundaRevision != null,
    refCalidad: r.refEvidenciaCalidad,
    tokensEstimados: tokens, tokensObservados: null,
    costoEstimadoUsd: r.costoEsperadoUsd,
    refLedger: null, ts: tsISO,
  }
}

/**
 * Cierra el evento con lo que se observó al ejecutar.
 *
 * El COSTO REAL no se copia aquí: vive en el libro de costos, que ya lo calcula
 * con la tarifa vigente en la fecha. Lo que se guarda es la REFERENCIA al
 * asiento. Dos sitios con la cifra del dinero es el principio de dos cifras
 * distintas del dinero.
 */
export function cerrarEvento(
  base: EventoRuteo,
  obs: {
    latenciaMs: number
    exito: boolean
    codigo?: string | null
    respaldoUsado?: boolean
    tokens?: { entrada: number; salida: number } | null
    refLedger?: string | null
  },
): EventoRuteo {
  return {
    ...base,
    latenciaMs: Math.max(0, obs.latenciaMs),
    resultado: obs.exito ? 'ejecutado' : 'fallo_de_ejecucion',
    codigo: obs.codigo ?? base.codigo,
    respaldoUsado: obs.respaldoUsado ?? base.respaldoUsado,
    tokensObservados: obs.tokens ?? null,
    refLedger: obs.refLedger ?? null,
  }
}

export const POR_QUE_LISTA_BLANCA =
  'Porque una lista de campos prohibidos protege de lo que alguien pensó en ' +
  'prohibir. El campo nuevo —«resumenCorto», «primerHallazgo»— no estará en ' +
  'ella y pasará. Con lista blanca, el campo nuevo falla la prueba hasta que ' +
  'alguien decida que puede salir.'

export const POR_QUE_EL_COSTO_REAL_NO_SE_COPIA_AQUI =
  'Porque ya lo calcula el libro de costos con la tarifa vigente en la fecha ' +
  'de la llamada, incluidas las promociones con caducidad. Guardar una segunda ' +
  'cifra del dinero es el principio de dos cifras distintas del dinero.'
