/**
 * QUÉ ES UN EXPEDIENTE — la lista única, y la razón por la que existe.
 *
 * ── EL FALLO ─────────────────────────────────────────────────────────────────
 *
 * El único botón de exportación del expediente (`expediente/[patientId]`)
 * llamaba a `exportarPacienteAFhir({ paciente, notas, config })` y descargaba un
 * archivo llamado **`expediente_<nombre>_FHIR_R4.json`**.
 *
 * Ese archivo no es el expediente. Le faltan, todas declaradas en
 * `firestore.rules` y todas escritas por la propia aplicación:
 *
 *   · `notas/{id}/adendas` — la enmienda a una nota firmada. Parte legal del
 *     expediente (NOM-004), y no salía en ninguna exportación.
 *   · `notas/{id}/versions` — la trazabilidad previa a la firma.
 *   · `laboratorios` — los paneles con sus tendencias.
 *   · `fotos` — la fotografía clínica seriada.
 *   · `clinico/resumen` — alergias estructuradas, antecedentes, valoración del
 *     inmunocomprometido.
 *   · `formularios_previos` — lo que el paciente contestó antes de la consulta.
 *   · `internamientos` y sus `signos`.
 *   · `appointments` y `audit_log` del paciente.
 *
 * Y además `fhir-export.ts` descarta las notas en borrador **en silencio**: si
 * hay contenido clínico sin firmar, el titular recibe un expediente con huecos
 * que nadie le señala.
 *
 * ── POR QUÉ UN MANIFIESTO Y NO UNA FUNCIÓN QUE LEA LO QUE SE ACUERDE ─────────
 *
 * Porque esto ya se olvidó una vez y se volverá a olvidar. Cada vez que se añada
 * una subcolección al paciente, alguien tendrá que acordarse de meterla en la
 * exportación — y no se acordará.
 *
 * Con la lista aquí, `exportacion-completa.test.ts` la compara contra las rutas
 * `match /` que `firestore.rules` declara bajo `patients/{docId}`: **añadir una
 * subcolección nueva y no declararla aquí pone el CI en rojo.** Es la única forma
 * de que esto no vuelva a quedarse atrás.
 *
 * Módulo PURO: quien lea Firestore es la ruta.
 */

export interface SeccionExpediente {
  /** Clave de la sección en el archivo entregado. */
  clave: string
  /** Ruta relativa a `clinics/{clinicId}/patients/{patientId}`. */
  ruta: string
  /** Qué es, en las palabras del médico. Va en el archivo, para el titular. */
  descripcion: string
  /** Sub-subcolección que cuelga de cada documento de esta sección. */
  hijas?: { clave: string; ruta: string; descripcion: string }[]
  /** `true` si es un documento único, no una colección. */
  documentoUnico?: boolean
}

/**
 * TODO lo que cuelga del paciente. Una entrada por `match /` de las reglas.
 *
 * El orden es el del expediente en papel: primero lo clínico, después lo
 * administrativo.
 */
export const SECCIONES: SeccionExpediente[] = [
  {
    clave: 'notas', ruta: 'notas',
    descripcion: 'Notas médicas: consulta, evolución, ingreso, egreso, procedimientos y valoraciones.',
    hijas: [
      { clave: 'adendas', ruta: 'adendas', descripcion: 'Enmiendas a una nota ya firmada. Parte legal del expediente (NOM-004).' },
      { clave: 'versions', ruta: 'versions', descripcion: 'Versiones previas a la firma, para trazabilidad.' },
    ],
  },
  {
    clave: 'laboratorios', ruta: 'laboratorios',
    descripcion: 'Paneles de laboratorio capturados o interpretados de un PDF/foto.',
  },
  {
    clave: 'fotos', ruta: 'fotos',
    descripcion: 'Fotografía clínica seriada. Se entrega la referencia y sus datos, no el binario.',
  },
  {
    clave: 'clinico', ruta: 'clinico', documentoUnico: false,
    descripcion: 'Resumen clínico: alergias estructuradas, antecedentes y valoraciones.',
  },
  {
    clave: 'formularios_previos', ruta: 'formularios_previos',
    descripcion: 'Lo que el paciente contestó antes de la consulta desde su enlace.',
  },
]

/**
 * Lo que NO cuelga del paciente pero es suyo.
 *
 * Vive en colecciones de la clínica y se filtra por `pacienteId`. Va aparte
 * porque la comprobación contra las reglas es distinta: aquí no basta con
 * enumerar `match /`, hace falta saber por qué campo se filtra.
 */
export const SECCIONES_POR_REFERENCIA: { clave: string; coleccion: string; campo: string; descripcion: string }[] = [
  { clave: 'citas', coleccion: 'appointments', campo: 'pacienteId', descripcion: 'Citas: fecha, tipo, estado y médico.' },
  { clave: 'internamientos', coleccion: 'internamientos', campo: 'pacienteId', descripcion: 'Episodios hospitalarios con sus signos vitales.' },
  { clave: 'bitacora', coleccion: 'audit_log', campo: 'patientId', descripcion: 'Quién vio o cambió qué y cuándo (NOM-024).' },
]

/**
 * Subcolecciones del paciente que NO se exportan, con su razón.
 *
 * Existe para que el guardián pueda distinguir «se me olvidó» de «se decidió».
 * Hoy está vacía: todo lo que cuelga del paciente es suyo y se le entrega.
 */
export const EXCLUIDAS: Record<string, string> = {}

export interface Faltante {
  seccion: string
  porQue: string
}

export interface ExpedienteExportado {
  /** Versión del formato, para que quien lo lea sepa qué esperar. */
  formato: 'nexusmed-expediente-1'
  generadoEn: string
  paciente: Record<string, unknown>
  secciones: Record<string, unknown>
  /**
   * Lo que NO se pudo leer, con su razón.
   *
   * ── POR QUÉ ESTE CAMPO ES EL MÁS IMPORTANTE DEL ARCHIVO ──────────────────
   *
   * Un expediente incompleto que no dice que está incompleto es peor que no
   * entregarlo: el médico lo manda, el titular lo recibe, y los dos creen que
   * ahí está todo. Vacío significa «esto es todo lo que hay».
   */
  faltantes: Faltante[]
  /** Qué contiene cada sección, en español, para quien abra el archivo. */
  indice: Record<string, string>
}

/** El índice legible que acompaña al archivo. */
export function indiceDeSecciones(): Record<string, string> {
  const out: Record<string, string> = {}
  for (const s of SECCIONES) {
    out[s.clave] = s.descripcion
    for (const h of s.hijas ?? []) out[`${s.clave}.${h.clave}`] = h.descripcion
  }
  for (const r of SECCIONES_POR_REFERENCIA) out[r.clave] = r.descripcion
  return out
}

/** Todas las claves que el archivo debe traer. Para el guardián y para la ruta. */
export function clavesEsperadas(): string[] {
  return [...SECCIONES.map(s => s.clave), ...SECCIONES_POR_REFERENCIA.map(r => r.clave)].sort()
}

export const POR_QUE_SE_DECLARA_LO_QUE_FALTA =
  'Un expediente incompleto que no dice que está incompleto es peor que no ' +
  'entregarlo: el médico lo manda, el titular lo recibe, y los dos creen que ' +
  'ahí está todo. Por eso `faltantes` viaja siempre, y vacío significa «esto ' +
  'es todo lo que hay».'
