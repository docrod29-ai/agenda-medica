/**
 * CUÁNTO OCUPA UN CONSULTORIO, Y CUÁNTO OCUPARÁ.
 *
 * ── LAS TRES ETIQUETAS, OTRA VEZ ─────────────────────────────────────────────
 *
 *   OBSERVADO   se midió sobre datos reales o sobre un fixture, y se dice cuál.
 *   ESCENARIO   se calculó a partir de supuestos declarados. No es un dato.
 *   OBJETIVO    lo que queremos que pase. No es ni lo uno ni lo otro.
 *
 * Un escenario presentado como observación es la forma en que una hoja de
 * cálculo se convierte en una promesa comercial. Aquí van separados por el tipo,
 * no por una nota al pie.
 *
 * ── PRECIOS ──────────────────────────────────────────────────────────────────
 *
 * Este módulo **no trae precios de GCP**. Una cifra de coste sin procedencia ni
 * fecha envejece en semanas y sigue pareciendo autoritativa. Se pasa desde
 * fuera, con su fuente y su `asOf`, o no se calcula coste: se calculan bytes.
 *
 * Módulo PURO.
 */

export type Procedencia = 'OBSERVADO' | 'ESCENARIO' | 'OBJETIVO'

/** Bytes por clase de dato. La unidad es siempre el byte: sin redondeos. */
export interface MedidaDeAlmacenamiento {
  procedencia: Procedencia
  /** De dónde salió: «fixture sintético v1», «consultorio de prueba», … */
  fuente: string
  bytes: number
  documentos: number
}

/** Lo que ocupa un consultorio, por clase de dato. */
export interface HuellaDeConsultorio {
  clinicId: string
  medidoEn: string
  porClaseDeDato: Record<string, MedidaDeAlmacenamiento>
  /** Objetos de Cloud Storage, aparte: no son documentos de Firestore. */
  objetos: MedidaDeAlmacenamiento
}

/** Supuestos de un escenario. Todos obligatorios: un supuesto tácito no existe. */
export interface Supuestos {
  consultasPorDiaHabil: number
  diasHabilesPorMes: number
  /** Bytes que ocupa una consulta completa: nota + versiones + adendas. */
  bytesPorConsulta: number
  /** Fotografías clínicas por cada cien consultas. */
  fotosPorCienConsultas: number
  bytesPorFoto: number
  /** Meses a proyectar. */
  meses: number
  /** De dónde salió cada supuesto. Una frase por supuesto, o no es un supuesto. */
  procedenciaDeLosSupuestos: Record<string, string>
}

export interface Proyeccion {
  procedencia: 'ESCENARIO'
  supuestos: Supuestos
  /** Bytes acumulados mes a mes, empezando por el mes 1. */
  bytesPorMes: number[]
  bytesAlFinal: number
  /** Lo que crece en Firestore frente a lo que crece en Storage. */
  firestoreBytes: number
  storageBytes: number
  /** Qué NO cubre esta proyección. */
  noCubre: string[]
}

/**
 * Proyecta el crecimiento a partir de supuestos declarados.
 *
 * Lineal a propósito: un modelo de crecimiento sofisticado sobre supuestos
 * inventados no es más preciso, sólo más difícil de discutir. Lo que importa
 * del resultado es el ORDEN DE MAGNITUD y qué supuesto lo mueve.
 */
export function proyectar(s: Supuestos): Proyeccion {
  const consultasPorMes = s.consultasPorDiaHabil * s.diasHabilesPorMes
  const fotosPorMes = (consultasPorMes * s.fotosPorCienConsultas) / 100
  const firestorePorMes = consultasPorMes * s.bytesPorConsulta
  const storagePorMes = fotosPorMes * s.bytesPorFoto

  const bytesPorMes: number[] = []
  let acumulado = 0
  for (let m = 0; m < s.meses; m++) {
    acumulado += firestorePorMes + storagePorMes
    bytesPorMes.push(Math.round(acumulado))
  }

  return {
    procedencia: 'ESCENARIO',
    supuestos: s,
    bytesPorMes,
    bytesAlFinal: Math.round(acumulado),
    firestoreBytes: Math.round(firestorePorMes * s.meses),
    storageBytes: Math.round(storagePorMes * s.meses),
    noCubre: [
      'el índice de Firestore, que ocupa aparte y depende de las consultas que se hagan',
      'el audio de consulta, que es efímero por diseño y no acumula',
      'la bitácora de auditoría, que crece con los ACCESOS y no con las consultas',
      'los respaldos guardados por el médico fuera de la plataforma',
      'cualquier coste en dinero: este módulo cuenta bytes, no facturas',
    ],
  }
}

/**
 * El tamaño de un respaldo NDJSON, a partir de lo que ocupa el consultorio.
 *
 * ── POR QUÉ NO ES «LO MISMO QUE OCUPA» ──────────────────────────────────────
 *
 * El NDJSON repite el nombre de cada campo en cada línea y añade la ruta
 * completa del documento. En un consultorio con muchos documentos pequeños eso
 * pesa. El factor se declara como supuesto porque medirlo de verdad exige un
 * consultorio real, y suponer 1.0 haría que el respaldo pareciera caber donde
 * no cabe.
 */
export function tamanoDelRespaldo(
  bytesEnFirestore: number, documentos: number, factorDeSobrecarga: number,
): { bytes: number; procedencia: 'ESCENARIO'; supuesto: string } {
  return {
    bytes: Math.round(bytesEnFirestore * factorDeSobrecarga + documentos * 80),
    procedencia: 'ESCENARIO',
    supuesto:
      `factor de sobrecarga del NDJSON: ${factorDeSobrecarga} (repetir el nombre de cada campo ` +
      'en cada línea), más ~80 bytes de ruta y separadores por documento. Ninguno de los dos ' +
      'se ha medido contra un consultorio real.',
  }
}

/**
 * Coste, SÓLO si quien llama trae el precio con su procedencia y su fecha.
 *
 * Sin `fuente` y sin `asOf` no se calcula: se devuelve el hueco declarado. Un
 * precio sin fecha en un documento de negocio se cita durante años.
 */
export function coste(
  bytes: number,
  precio: { usdPorGbMes: number; fuente: string; asOf: string } | null,
): { usd: number | null; procedencia: Procedencia; porQue: string } {
  if (!precio || !precio.fuente || !precio.asOf) {
    return {
      usd: null, procedencia: 'ESCENARIO',
      porQue: 'NEEDS_CLINICAL_REVIEW no aplica aquí, pero la regla es la misma: no se inventa una cifra. Falta el precio por GB-mes con su fuente citada y su fecha. Quién puede decidirlo: el dueño, con la factura de GCP delante.',
    }
  }
  return {
    usd: (bytes / 1_073_741_824) * precio.usdPorGbMes,
    procedencia: 'ESCENARIO',
    porQue: `precio ${precio.usdPorGbMes} USD/GB-mes según ${precio.fuente}, vigente a ${precio.asOf}. Los precios cambian: esta cifra caduca con esa fecha.`,
  }
}

export const POR_QUE_NO_HAY_TOPE_DE_PACIENTES =
  'Un tope de pacientes por consultorio sería una decisión de producto ' +
  'disfrazada de límite técnico. Lo que crece es el almacenamiento, y crece con ' +
  'las consultas y con las fotografías, no con el número de fichas. Un ' +
  'consultorio con diez mil pacientes que ve a treinta al día ocupa lo mismo ' +
  'que uno con quinientos que ve a treinta al día.'
