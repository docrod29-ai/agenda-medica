/**
 * EL CONTRATO DE LA MIGRACIÓN — estados, transiciones y razones estables.
 *
 * ── POR QUÉ ESTE MÓDULO EXISTE ───────────────────────────────────────────────
 *
 * Un médico que se cambia a Ausculta trae años de expediente. La importación es
 * la ÚNICA operación del producto que escribe miles de expedientes de golpe sin
 * que nadie mire fila por fila. Todo lo que en otra pantalla se corrige a mano,
 * aquí se multiplica por cincuenta mil.
 *
 * Lo que había antes vivía en `(dashboard)/migracion/page.tsx`: un bucle en el
 * navegador que llamaba `createPatient` una vez por fila. Sin ensayo, sin
 * procedencia, sin idempotencia, sin cuarentena y sin cuentas. Si se cerraba la
 * pestaña a mitad, nadie sabía por dónde iba; si se reintentaba, se duplicaba
 * el consultorio entero.
 *
 * ── LA REGLA QUE ORDENA TODO LO DEMÁS ────────────────────────────────────────
 *
 * Las dos formas de fallar NO son comparables:
 *
 *  · **Rechazar una fila buena** se ve: sale en el informe con su razón, y el
 *    médico la arregla y la vuelve a subir.
 *  · **Aceptar una fila inventada** no se ve. Una fecha adivinada, un sexo
 *    supuesto o dos pacientes fundidos por error entran al expediente con la
 *    misma cara que un dato correcto, y a partir de ahí son indistinguibles.
 *
 * Por eso ante la duda se CUARENTENA. Siempre. La cuarentena es el producto,
 * no el fallo: es lo que convierte «no sé» en una decisión del médico en vez de
 * en un dato falso con su firma encima.
 *
 * Módulo PURO: sin red, sin reloj, sin Firestore. Sólo tipos y máquina de
 * estados — para que la máquina se pueda probar sin levantar nada.
 */

/* ═══════════════════════ LA MÁQUINA DE ESTADOS ═══════════════════════ */

/**
 * Las etapas del trabajo de importación, en orden.
 *
 * `DRY_RUN` y `HUMAN_APPROVAL` no son adorno: son la frontera. **Ninguna
 * mutación persistente ocurre antes de que las dos hayan pasado.** Esa frontera
 * se comprueba en `puedeEscribir()` y hay una prueba que la mete al revés.
 */
export const ETAPAS = [
  'UPLOAD',
  'DETECT_SCHEMA',
  'MAP_FIELDS',
  'NORMALIZE',
  'VALIDATE',
  'MATCH_DEDUPE',
  'QUARANTINE_AMBIGUOUS',
  'DRY_RUN',
  'HUMAN_APPROVAL',
  'CHUNKED_IMPORT',
  'RECONCILIATION',
  'COMPLETED',
  'PARTIAL',
  'ROLLED_BACK',
  'CANCELLED',
  'FAILED',
] as const

export type Etapa = (typeof ETAPAS)[number]

/** Etapas de las que ya no se sale: el trabajo terminó, bien o mal. */
export const ETAPAS_TERMINALES: readonly Etapa[] = [
  'COMPLETED', 'PARTIAL', 'ROLLED_BACK', 'CANCELLED', 'FAILED',
]

/**
 * Qué transiciones existen. Lo que no está aquí, NO pasa.
 *
 * Una lista blanca en vez de una lista negra a propósito: un estado nuevo que
 * alguien añada sin pensar en sus salidas se queda sin salidas, que es el fallo
 * seguro. Al revés —permitir por omisión— un estado nuevo podría saltarse el
 * ensayo sin que nadie lo note.
 */
export const TRANSICIONES: Readonly<Record<Etapa, readonly Etapa[]>> = {
  UPLOAD:               ['DETECT_SCHEMA', 'CANCELLED', 'FAILED'],
  DETECT_SCHEMA:        ['MAP_FIELDS', 'CANCELLED', 'FAILED'],
  MAP_FIELDS:           ['NORMALIZE', 'CANCELLED', 'FAILED'],
  NORMALIZE:            ['VALIDATE', 'CANCELLED', 'FAILED'],
  VALIDATE:             ['MATCH_DEDUPE', 'CANCELLED', 'FAILED'],
  MATCH_DEDUPE:         ['QUARANTINE_AMBIGUOUS', 'CANCELLED', 'FAILED'],
  QUARANTINE_AMBIGUOUS: ['DRY_RUN', 'CANCELLED', 'FAILED'],
  // Del ensayo se puede volver al mapeo: mirar el informe y corregir columnas es
  // el bucle normal de trabajo, no una excepción.
  DRY_RUN:              ['HUMAN_APPROVAL', 'MAP_FIELDS', 'CANCELLED', 'FAILED'],
  HUMAN_APPROVAL:       ['CHUNKED_IMPORT', 'MAP_FIELDS', 'CANCELLED'],
  // La importación por lotes vuelve a sí misma: cada lote es una transición y el
  // trabajo se puede reanudar tras un reinicio sin cambiar de estado.
  CHUNKED_IMPORT:       ['CHUNKED_IMPORT', 'RECONCILIATION', 'PARTIAL', 'FAILED'],
  RECONCILIATION:       ['COMPLETED', 'PARTIAL', 'ROLLED_BACK', 'FAILED'],
  PARTIAL:              ['CHUNKED_IMPORT', 'ROLLED_BACK'],
  COMPLETED:            [],
  ROLLED_BACK:          [],
  CANCELLED:            [],
  FAILED:               [],
}

export function transicionValida(de: Etapa, a: Etapa): boolean {
  return TRANSICIONES[de].includes(a)
}

/**
 * LA FRONTERA DE ESCRITURA.
 *
 * `true` sólo en las etapas en las que el trabajo ya fue ensayado Y aprobado.
 * Cualquier escritura persistente pasa por aquí; no hay un segundo camino.
 */
export function puedeEscribir(etapa: Etapa): boolean {
  return etapa === 'CHUNKED_IMPORT' || etapa === 'ROLLED_BACK'
}

/* ═══════════════════════ LAS RAZONES ═══════════════════════ */

/**
 * Códigos de razón ESTABLES. Se guardan, se cuentan y se agrupan.
 *
 * Estables quiere decir que no se renombran: un informe de hace un año tiene que
 * seguir queriendo decir lo mismo. El texto en español se puede cambiar cuando
 * se quiera; el código, no.
 */
export const RAZONES = [
  // Identidad
  'MISSING_REQUIRED_IDENTITY',
  'IDENTITY_TOO_SHORT',
  // Fechas
  'INVALID_DATE',
  'AMBIGUOUS_DATE',
  'DATE_IN_FUTURE',
  'DATE_IMPLAUSIBLE',
  // Duplicados
  'DUPLICATE_EXACT',
  'DUPLICATE_AMBIGUOUS',
  'DUPLICATE_IN_SOURCE',
  // Estructura del archivo
  'UNSUPPORTED_FIELD',
  'INVALID_ENCODING',
  'MALFORMED_ROW',
  'FIELD_TOO_LONG',
  'ROW_ARITY_MISMATCH',
  // Valores
  'UNRECOGNIZED_ENUM',
  'INVALID_PHONE',
  'INVALID_EMAIL',
  'INVALID_CURP',
  'MISSING_UNIT',
  // Aislamiento y proceso
  'TENANT_MISMATCH',
  'SOURCE_ID_COLLISION',
  'ALREADY_IMPORTED',
] as const

export type Razon = (typeof RAZONES)[number]

/**
 * El español de cada razón. Se pinta tal cual: el médico lee esto, no el código.
 *
 * Cada frase dice QUÉ pasó y QUÉ hacer. «Fecha inválida» no ayuda a nadie;
 * «no se entiende como fecha — revísala en el archivo» sí.
 */
export const RAZON_TEXTO: Readonly<Record<Razon, string>> = {
  MISSING_REQUIRED_IDENTITY: 'La fila no trae nombre. Sin nombre no se puede abrir un expediente.',
  IDENTITY_TOO_SHORT: 'El nombre es demasiado corto para identificar a alguien.',
  INVALID_DATE: 'La fecha no se entiende. Revísala en el archivo.',
  AMBIGUOUS_DATE: 'La fecha puede leerse de dos maneras (día/mes o mes/día) y no se adivina. Dinos el formato del archivo.',
  DATE_IN_FUTURE: 'La fecha de nacimiento está en el futuro.',
  DATE_IMPLAUSIBLE: 'La fecha de nacimiento da una edad imposible.',
  DUPLICATE_EXACT: 'Ya existe este mismo paciente. No se vuelve a crear.',
  DUPLICATE_AMBIGUOUS: 'Se parece a un paciente que ya tienes, pero no lo suficiente para fundirlos sin que lo mires.',
  DUPLICATE_IN_SOURCE: 'Esta fila se repite dentro del propio archivo.',
  UNSUPPORTED_FIELD: 'Esta columna no corresponde a ningún campo conocido. Se conserva como dato de origen, sin interpretarla.',
  INVALID_ENCODING: 'El archivo trae caracteres que no se pueden leer. Vuelve a exportarlo en UTF-8.',
  MALFORMED_ROW: 'La fila está rota (comillas sin cerrar o separadores de más).',
  FIELD_TOO_LONG: 'Un campo excede el tamaño máximo admitido.',
  ROW_ARITY_MISMATCH: 'La fila tiene un número de columnas distinto al del encabezado.',
  UNRECOGNIZED_ENUM: 'El valor no corresponde a ninguna de las opciones conocidas y no se traduce a la fuerza.',
  INVALID_PHONE: 'El teléfono no tiene dígitos suficientes.',
  INVALID_EMAIL: 'El correo no tiene forma de correo.',
  INVALID_CURP: 'El CURP no tiene 18 caracteres con la forma oficial.',
  MISSING_UNIT: 'La cantidad viene sin unidad. No se supone ninguna.',
  TENANT_MISMATCH: 'Esta fila declara un consultorio distinto al del trabajo de importación.',
  SOURCE_ID_COLLISION: 'Dos filas del archivo declaran el mismo identificador de origen con contenido distinto.',
  ALREADY_IMPORTED: 'Esta misma fila ya se importó en un trabajo anterior.',
}

/** Toda razón tiene texto. El guardián lo comprueba; no es una suposición. */
export function textoDeRazon(r: Razon): string {
  return RAZON_TEXTO[r]
}

/* ═══════════════════════ LOS DESTINOS DE UNA FILA ═══════════════════════ */

/**
 * Dónde acaba cada fila del archivo. **Mutuamente excluyentes y exhaustivos** —
 * de eso depende que las cuentas cuadren en `reconciliacion.ts`.
 *
 * `duplicate` va aparte de `rejected` a propósito: un duplicado NO es un error
 * del archivo, es el resultado correcto de haber importado dos veces. Meterlos
 * en el mismo cubo hacía que el informe dijera «12 errores» en una importación
 * perfecta, y eso enseña a ignorar el informe.
 */
export const DESTINOS = ['accepted', 'rejected', 'duplicate', 'ambiguous', 'quarantined'] as const
export type Destino = (typeof DESTINOS)[number]

/**
 * ¿Este destino escribe algo en el expediente?
 *
 * Sólo `accepted`. Lo demás se conserva en el trabajo de importación para que el
 * médico lo revise, pero no toca el expediente.
 */
export function destinoEscribe(d: Destino): boolean {
  return d === 'accepted'
}

/** El veredicto de una fila, con su porqué legible por máquina. */
export interface Veredicto {
  readonly destino: Destino
  /** Vacío sólo cuando `destino === 'accepted'`. Un rechazo sin razón es un defecto. */
  readonly razones: readonly Razon[]
  /**
   * Detalle legible por MÁQUINA de por qué. No sustituye a `razones`: las
   * explica. Nunca lleva PHI — lleva nombres de campo y formas, no valores.
   */
  readonly detalle?: Readonly<Record<string, string | number | boolean>>
}

export function aceptada(): Veredicto {
  return { destino: 'accepted', razones: [] }
}

export function rechazada(
  destino: Exclude<Destino, 'accepted'>,
  razones: readonly Razon[],
  detalle?: Veredicto['detalle'],
): Veredicto {
  /**
   * Un no-aceptado SIN razón sería un dato perdido en silencio con apariencia de
   * trabajo hecho: el informe contaría la fila como «revisada» y nadie sabría
   * qué revisar. Se prefiere fallar aquí, en el desarrollo, que allí.
   */
  if (razones.length === 0) {
    throw new Error(`migración: destino "${destino}" sin razón — un rechazo sin razón no es revisable`)
  }
  return { destino, razones, detalle }
}
