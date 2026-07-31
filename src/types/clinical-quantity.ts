/**
 * ClinicalQuantity — un número clínico NUNCA viaja sin su unidad (Nexus OS E0-04).
 *
 * PORQUÉ EXISTE: el bug de escala es el riesgo número uno de este repo. Hoy se
 * compensa con guardas de RANGO en tiempo de ejecución, motor por motor
 * (`creatininaPlausibleMgDl` en src/lib/expediente/funcion-renal.ts, la misma
 * advertencia duplicada en copiloto.ts, los min/max de laboratorio/analitos.ts).
 * Esas guardas son heurísticas, no pruebas: una creatinina de 20 µmol/L (paciente
 * sano) cae dentro de [0.1, 25] y pasa como si fueran 20 mg/dL. Este módulo mueve
 * la defensa al COMPILADOR: sumar mg con mL o comparar mg/dL con µmol/L deja de
 * ser expresable.
 *
 * ALCANCE DELIBERADO: E0-04 fue SOLO el núcleo. E0-05 lo cableó a los motores
 * críticos (función renal, gasometría, infusiones, seguridad de dosis) y le añadió
 * dos piezas: la dimensión `concentracion_actividad` (U/mL) y `aConcentracionMasa`.
 * Este archivo sigue sin definir ningún umbral, dosis ni criterio de decisión:
 * sólo definiciones del SI y dos factores molares que YA existían en el repo,
 * copiados con su cita.
 *
 * NO se registra en CLINICAL_ENGINE_REGISTRY: no calcula nada clínico y no tiene
 * callers; registrarlo sin ADR subiría la deuda congelada de E0-03 y pondría el
 * CI en rojo. Cuando E0-05 lo meta en un motor, ese motor ya tiene su entrada.
 */

import { num } from '@/lib/uci/num'

// ---------------------------------------------------------------------------
// 1. Catálogo cerrado de dimensiones y sus unidades legales
// ---------------------------------------------------------------------------

/**
 * Dimensión física → unidades legales de esa dimensión.
 *
 * El backlog decía `{valor, unidad, sistema}`; aquí el tercer campo se llama
 * `dimension` a propósito: lo que impide `mg + mL` es la DIMENSIÓN (masa vs.
 * volumen), no el sistema de medida — mg y mL son ambos del SI.
 *
 * Reglas de admisión de una unidad a este catálogo:
 *  - Todas las unidades de una misma dimensión deben ser interconvertibles por
 *    un FACTOR (no una función afín, no una que dependa de un dato del paciente).
 *  - Si convertir exige un dato clínico (masa molar, valencia, superficie
 *    corporal, número de tomas al día), va en DIMENSIÓN APARTE. No convertir es
 *    la respuesta correcta cuando falta criterio; inventar un factor es la peor
 *    falla posible aquí.
 */
export interface UnidadesPorDimension {
  masa:                      'kg' | 'g' | 'mg' | 'µg'
  volumen:                   'L' | 'dL' | 'mL'
  tiempo:                    'd' | 'h' | 'min' | 's'
  sustancia:                 'mol' | 'mmol' | 'µmol'
  concentracion_masa:        'g/dL' | 'mg/dL' | 'mg/L' | 'µg/mL'
  concentracion_sustancia:   'mol/L' | 'mmol/L' | 'µmol/L'
  /** mEq/L NO se convierte a mmol/L aquí: la equivalencia depende de la valencia del ion. */
  concentracion_equivalente: 'mEq/L'
  /**
   * Concentración de ACTIVIDAD biológica (vasopresina, insulina, heparina en la
   * bolsa de infusión). Añadida por E0-05 §3.4: el motor de infusiones maneja
   * diluciones en U/mL y hoy la unidad viaja en un string paralelo
   * (`unidadConc: 'µg/mL' | 'U/mL'`). Dimensión SEPARADA de `concentracion_masa`
   * por el mismo motivo que `tasa_actividad` lo está de `tasa_dosis`: la
   * equivalencia UI↔masa depende del fármaco y del estándar, no de un factor.
   */
  concentracion_actividad:   'U/mL'
  presion:                   'mmHg' | 'kPa' | 'cmH2O'
  /** Depuración CRUDA (Cockcroft-Gault). Ver `depuracion_indexada`. */
  depuracion:                'mL/min'
  /**
   * Depuración INDEXADA a 1.73 m² (CKD-EPI). Dimensión SEPARADA de `depuracion`
   * a propósito, corrigiendo el diseño original de E0-04, que las ponía juntas:
   * pasar de mL/min a mL/min/1.73m² exige la superficie corporal del paciente,
   * así que un "factor" entre ambas no existe. Juntas, `convertir` habría
   * devuelto en silencio el mismo número con otra etiqueta — exactamente el bug
   * que este módulo existe para impedir. Separadas, el compilador lo prohíbe.
   */
  depuracion_indexada:       'mL/min/1.73m²'
  tasa_volumen:              'mL/h'
  /** Tasa de dosis POR PESO. Ver `dosis_por_peso` para mg/kg/dosis. */
  tasa_dosis_peso:           'µg/kg/min' | 'mg/kg/min' | 'mg/kg/día'
  /**
   * mg/kg/DOSIS no es una tasa: es masa por peso y por administración. Pasar de
   * mg/kg/día a mg/kg/dosis exige saber cuántas tomas al día lleva ese fármaco
   * (criterio clínico, no un factor). Dimensión aparte, sin puente automático.
   */
  dosis_por_peso:            'mg/kg/dosis'
  tasa_dosis:                'µg/min' | 'mg/día'
  /**
   * Unidades internacionales por minuto (vasopresina, insulina, heparina). La UI
   * mide ACTIVIDAD biológica, no masa: su equivalencia en mg depende del fármaco
   * y del estándar. Dimensión aparte — nunca convertible a `tasa_dosis`.
   */
  tasa_actividad:            'U/min'
  fraccion:                  '%' | 'fracción'
}

export type Dimension = keyof UnidadesPorDimension
export type UnidadDe<D extends Dimension> = UnidadesPorDimension[D]

/**
 * Marca fantasma. NO se exporta: desde fuera del módulo es imposible escribir a
 * mano `{ valor: 5, unidad: 'mg', dimension: 'masa' }` y hacerlo pasar por
 * cantidad. La única puerta de entrada es `cantidad()` / `cantidadDesde()`.
 */
declare const MARCA: unique symbol

/**
 * Una cantidad clínica: valor + unidad + dimensión, inseparables.
 *
 * Para listas u objetos con cantidades de dimensiones distintas usa
 * `CualquierCantidad` — `ClinicalQuantity<Dimension>` NO acepta una
 * `ClinicalQuantity<'masa'>` (es el precio, buscado, de la invarianza).
 */
export interface ClinicalQuantity<D extends Dimension> {
  readonly valor: number
  readonly unidad: UnidadDe<D>
  readonly dimension: D
  /**
   * MARCA INVARIANTE — NO BORRAR NI SIMPLIFICAR A `readonly [MARCA]: true`.
   *
   * Es la línea que hace que este módulo cumpla su razón de ser. Con `D` sólo en
   * posición covariante (`unidad`, `dimension`), TypeScript ENSANCHA `D` a la
   * unión de las dimensiones y `sumar(mg, mL)` COMPILA SIN ERROR. Al aparecer
   * `D` a la vez como parámetro y como retorno de una función, el genérico se
   * vuelve invariante y el ensanchamiento deja de ser posible.
   *
   * Control negativo ejecutado (DISENO §3.3): sin esta línea, 3 de los 6 casos
   * negativos —incluidos los dos que cita el objetivo del backlog— pasaban en
   * silencio. Si la borras, el CI queda VERDE y la protección desaparece; por
   * eso hay además un guardián en src/__tests__/clinical-quantity.test.ts.
   */
  readonly [MARCA]: (d: D) => D
}

/**
 * Vista de solo lectura para ALMACENAR, SERIALIZAR o LISTAR cantidades de
 * dimensiones distintas. Sirve para guardar y mostrar; NO sirve para colar una
 * cantidad en un motor: asignar un `CualquierCantidad` donde se exige
 * `ClinicalQuantity<'masa'>` sigue siendo error de compilación.
 */
export type CualquierCantidad = { [D in Dimension]: ClinicalQuantity<D> }[Dimension]

// ---------------------------------------------------------------------------
// 2. Factores de conversión (definiciones, no criterio clínico)
// ---------------------------------------------------------------------------

/** Unidad canónica de cada dimensión: aquella en la que se normaliza para operar. */
export const UNIDAD_CANONICA = {
  masa:                      'mg',
  volumen:                   'mL',
  tiempo:                    'min',
  sustancia:                 'mmol',
  concentracion_masa:        'mg/dL',
  concentracion_sustancia:   'mmol/L',
  concentracion_equivalente: 'mEq/L',
  concentracion_actividad:   'U/mL',
  presion:                   'mmHg',
  depuracion:                'mL/min',
  depuracion_indexada:       'mL/min/1.73m²',
  tasa_volumen:              'mL/h',
  tasa_dosis_peso:           'mg/kg/min',
  dosis_por_peso:            'mg/kg/dosis',
  tasa_dosis:                'µg/min',
  tasa_actividad:            'U/min',
  fraccion:                  'fracción',
} as const satisfies { readonly [D in Dimension]: UnidadDe<D> }

/**
 * Factor de cada unidad HACIA la unidad canónica de su dimensión.
 *
 * Todo lo de aquí son definiciones (SI o metrología), no medicina:
 *  - Prefijos del SI: k 1e3, m 1e-3, µ 1e-6; 1 dL = 0.1 L.
 *  - Tiempo: 1 d = 1440 min, 1 h = 60 min.
 *  - 1 mmHg = 133.322387415 Pa y 1 cmH2O = 98.0665 Pa (presión convencional,
 *    gravedad estándar) ⇒ 1 kPa = 1000/133.322387415 mmHg y
 *    1 cmH2O = 98.0665/133.322387415 mmHg.
 *  - 1 % = 0.01 en fracción.
 *
 * El tipo mapeado EXIGE exhaustividad: añadir una unidad al catálogo sin darle
 * factor no compila. Es a propósito — un hueco silencioso aquí sería un bug de
 * escala esperando.
 */
export const FACTORES: { readonly [D in Dimension]: Readonly<Record<UnidadDe<D>, number>> } = {
  masa:                      { kg: 1e6, g: 1e3, mg: 1, 'µg': 1e-3 },
  volumen:                   { L: 1000, dL: 100, mL: 1 },
  tiempo:                    { d: 1440, h: 60, min: 1, s: 1 / 60 },
  sustancia:                 { mol: 1000, mmol: 1, 'µmol': 1e-3 },
  // 1 g/dL = 1000 mg/dL · 1 mg/L = 0.1 mg/dL · 1 µg/mL = 1 mg/L = 0.1 mg/dL
  concentracion_masa:        { 'g/dL': 1000, 'mg/dL': 1, 'mg/L': 0.1, 'µg/mL': 0.1 },
  concentracion_sustancia:   { 'mol/L': 1000, 'mmol/L': 1, 'µmol/L': 1e-3 },
  concentracion_equivalente: { 'mEq/L': 1 },
  concentracion_actividad:   { 'U/mL': 1 },
  presion:                   { mmHg: 1, kPa: 1000 / 133.322387415, cmH2O: 98.0665 / 133.322387415 },
  depuracion:                { 'mL/min': 1 },
  depuracion_indexada:       { 'mL/min/1.73m²': 1 },
  tasa_volumen:              { 'mL/h': 1 },
  // OJO: mg/kg/día → mg/kg/min es aritmética exacta (÷1440), pero convertir una
  // dosis DIARIA a una tasa por minuto NO implica que se administre en infusión
  // continua. El tipo garantiza la aritmética; la vía la decide el médico.
  tasa_dosis_peso:           { 'µg/kg/min': 1e-3, 'mg/kg/min': 1, 'mg/kg/día': 1 / 1440 },
  dosis_por_peso:            { 'mg/kg/dosis': 1 },
  tasa_dosis:                { 'µg/min': 1, 'mg/día': 1000 / 1440 },
  tasa_actividad:            { 'U/min': 1 },
  fraccion:                  { '%': 0.01, 'fracción': 1 },
}

// ---------------------------------------------------------------------------
// 3. Construcción — única puerta de entrada al tipo
// ---------------------------------------------------------------------------

/**
 * Fabrica el objeto con la marca fantasma. La aserción es inevitable y está
 * CONFINADA aquí: `MARCA` no tiene valor en tiempo de ejecución (es `declare`),
 * así que la propiedad no existe en el objeto — sólo en el tipo.
 */
function crear<D extends Dimension>(valor: number, unidad: UnidadDe<D>, dimension: D): ClinicalQuantity<D> {
  return { valor, unidad, dimension } as unknown as ClinicalQuantity<D>
}

/**
 * Construye una cantidad. La unidad DEBE pertenecer a la dimensión declarada:
 * `cantidad(5, 'mL', 'masa')` no compila.
 */
export function cantidad<D extends Dimension>(
  valor: number, unidad: UnidadDe<D>, dimension: D,
): ClinicalQuantity<D> {
  return crear(valor, unidad, dimension)
}

/**
 * Igual que `cantidad`, pero desde un dato del mundo real (formulario, OCR, HL7,
 * voz). Devuelve `null` si no es un número finito — NUNCA inventa un 0. Se apoya
 * en `num()` (coma decimal mexicana, vacío→null), la fuente única del repo.
 */
export function cantidadDesde<D extends Dimension>(
  v: unknown, unidad: UnidadDe<D>, dimension: D,
): ClinicalQuantity<D> | null {
  const n = num(v)
  return n === null ? null : crear(n, unidad, dimension)
}

/**
 * Única puerta de entrada para datos que vienen del EXTERIOR (Firestore, HL7 v2,
 * un formulario, una foto de laboratorio), donde `unidad` y `dimension` llegan
 * como `unknown` y hay que validarlas en TIEMPO DE EJECUCIÓN, no sólo en tipos.
 *
 * PORQUÉ VIVE AQUÍ Y NO EN EL CONSUMIDOR (hallazgo 1 de E1-01): la marca
 * invariante hace que `ClinicalQuantity<Dimension>` NO sea asignable a
 * `CualquierCantidad`, así que escribir este parser fuera del módulo obliga a un
 * `as CualquierCantidad` en CADA consumidor — y por ahí se erosiona la
 * protección de E0-04 sin que ningún test se ponga rojo. Dentro del módulo la
 * aserción ya estaba confinada (ver `crear`), y aquí sigue confinada.
 *
 * NUNCA infiere la dimensión a partir de la unidad. `mL/min` y `mL/min/1.73m²`
 * se separaron a propósito (no existe factor entre ellas: falta la superficie
 * corporal) y adivinar reintroduciría justo el bug que este módulo impide. El
 * productor DEBE declarar la dimensión.
 *
 * Devuelve `null` —nunca un 0, nunca una cantidad "plausible"— si la dimensión
 * no está en el catálogo, si la unidad no pertenece a ESA dimensión, o si el
 * valor no es un número finito. Fallar ruidosamente es el comportamiento seguro.
 */
export function parsearCantidad(valor: unknown, unidad: unknown, dimension: unknown): CualquierCantidad | null {
  if (typeof dimension !== 'string' || !Object.prototype.hasOwnProperty.call(FACTORES, dimension)) return null
  const dim = dimension as Dimension
  if (typeof unidad !== 'string') return null
  // La unidad debe pertenecer a ESA dimensión: 'mL' con dimension 'masa' → null.
  if (!Object.prototype.hasOwnProperty.call(FACTORES[dim], unidad)) return null
  const n = num(valor)
  if (n === null) return null
  // Aserción inevitable y CONFINADA: `crear` devuelve ClinicalQuantity<Dimension>,
  // que por invarianza no es asignable a CualquierCantidad. Es el precio buscado
  // de la marca; la validación de arriba garantiza que el par unidad/dimensión
  // sí es legal en tiempo de ejecución.
  return crear(n, unidad as UnidadDe<Dimension>, dim) as unknown as CualquierCantidad
}

/* Atajos legibles para lo más usado. Azúcar sobre `cantidad`, sin lógica propia. */
export const mg = (v: number) => cantidad(v, 'mg', 'masa')
export const mL = (v: number) => cantidad(v, 'mL', 'volumen')
export const kg = (v: number) => cantidad(v, 'kg', 'masa')
export const mgPorDl = (v: number) => cantidad(v, 'mg/dL', 'concentracion_masa')
export const micromolPorL = (v: number) => cantidad(v, 'µmol/L', 'concentracion_sustancia')
export const mmHg = (v: number) => cantidad(v, 'mmHg', 'presion')

// ---------------------------------------------------------------------------
// 4. Conversión dentro de la misma dimensión
// ---------------------------------------------------------------------------

/** Factor de `unidad` hacia la canónica de `dimension`. */
function factor<D extends Dimension>(dimension: D, unidad: UnidadDe<D>): number {
  return (FACTORES[dimension] as Record<string, number>)[unidad as string]
}

/** Valor de la cantidad expresado en la unidad canónica de su dimensión. */
function enCanonica<D extends Dimension>(q: ClinicalQuantity<D>): number {
  return q.valor * factor(q.dimension, q.unidad)
}

/**
 * Convierte a otra unidad DE LA MISMA DIMENSIÓN. Convertir mg a mL no compila;
 * convertir mg/dL a µmol/L tampoco (eso exige el analito: ver
 * `aConcentracionSustancia`).
 */
export function convertir<D extends Dimension>(
  q: ClinicalQuantity<D>, a: UnidadDe<D>,
): ClinicalQuantity<D> {
  return crear(enCanonica(q) / factor(q.dimension, a), a, q.dimension)
}

// ---------------------------------------------------------------------------
// 5. Operaciones — todas rechazan dimensiones distintas EN COMPILACIÓN
// ---------------------------------------------------------------------------

/**
 * Suma. Normaliza a la unidad canónica ANTES de operar: sumar 1 g + 1 mg sin
 * normalizar daría 2, que es el bug de escala con otro disfraz. El resultado se
 * devuelve en la unidad del PRIMER operando (regla fija, para que sea
 * determinista y no dependa del orden de conversión).
 */
export function sumar<D extends Dimension>(a: ClinicalQuantity<D>, b: ClinicalQuantity<D>): ClinicalQuantity<D> {
  return crear((enCanonica(a) + enCanonica(b)) / factor(a.dimension, a.unidad), a.unidad, a.dimension)
}

/** Resta. Mismas reglas que `sumar` (normaliza, devuelve en la unidad de `a`). */
export function restar<D extends Dimension>(a: ClinicalQuantity<D>, b: ClinicalQuantity<D>): ClinicalQuantity<D> {
  return crear((enCanonica(a) - enCanonica(b)) / factor(a.dimension, a.unidad), a.unidad, a.dimension)
}

/**
 * Compara en la unidad canónica: `comparar(1 g, 1000 mg) === 0`. La igualdad es
 * EXACTA sobre el valor canónico — no se aplica ninguna tolerancia, porque
 * elegir un epsilon sería inventar un criterio que nadie ha decidido.
 */
export function comparar<D extends Dimension>(a: ClinicalQuantity<D>, b: ClinicalQuantity<D>): -1 | 0 | 1 {
  const ca = enCanonica(a)
  const cb = enCanonica(b)
  return ca < cb ? -1 : ca > cb ? 1 : 0
}

/** ¿`a` es mayor que `b`? (comparación en unidad canónica). */
export function esMayor<D extends Dimension>(a: ClinicalQuantity<D>, b: ClinicalQuantity<D>): boolean {
  return comparar(a, b) === 1
}

/** Multiplica por un escalar adimensional. Conserva unidad y dimensión. */
export function escalar<D extends Dimension>(q: ClinicalQuantity<D>, k: number): ClinicalQuantity<D> {
  return crear(q.valor * k, q.unidad, q.dimension)
}

// ---------------------------------------------------------------------------
// 6. Salida hacia el mundo — frontera explícita
// ---------------------------------------------------------------------------

/**
 * Extrae el número EN LA UNIDAD QUE SE EXIGE. Única forma legítima de salir del
 * tipo. Es deliberadamente verbosa: obliga a NOMBRAR la unidad justo donde el
 * número vuelve a ser un `number` suelto. Cuando E0-05 migre CKD-EPI, la firma
 * pedirá `ClinicalQuantity<'concentracion_masa'>` y adentro hará
 * `valorEn(creatinina, 'mg/dL')` — ahí muere el bug de la creatinina en µmol/L,
 * y muere en compilación, no en una guarda de rango.
 */
export function valorEn<D extends Dimension>(q: ClinicalQuantity<D>, unidad: UnidadDe<D>): number {
  return convertir(q, unidad).valor
}

/**
 * Texto para nota, receta o pantalla: "1.2 mg/dL". El redondeo es SÓLO de
 * presentación: no altera la cantidad almacenada (el tipo es readonly).
 */
export function formatear<D extends Dimension>(q: ClinicalQuantity<D>, decimales?: number): string {
  const n = decimales === undefined ? String(q.valor) : q.valor.toFixed(decimales)
  return `${n} ${q.unidad}`
}

/** Etiqueta legible de una cantidad heterogénea (para listas y serialización). */
export function etiqueta(q: CualquierCantidad): string {
  return `${q.valor} ${q.unidad}`
}

// ---------------------------------------------------------------------------
// 7. Conversión masa ↔ sustancia — bloqueada salvo con analito Y fuente
// ---------------------------------------------------------------------------

/**
 * mg/dL → µmol/L NO es convertible en general: depende de la masa molar del
 * analito. El tipo ya lo prohíbe (son dimensiones distintas). La conversión
 * legítima exige nombrar el analito y citar de dónde sale el número.
 */
export interface FactorMolar {
  analito: string
  /** mg/dL × factor = µmol/L */
  factorMgDlAMicromolL: number
  /** De dónde sale el número, verificable. */
  fuente: string
  /** Archivo + símbolo del repo que YA usa este factor (anti-deriva). */
  usadoTambienEn?: string
}

/**
 * Divisor mg/dL → mmol/L del colesterol. Se declara aquí con su valor literal
 * para que el test anti-deriva pueda compararlo contra el `const MMOL = 38.67`
 * de src/lib/expediente/prevent.ts, que es privado de ese módulo.
 */
export const MMOL_COLESTEROL = 38.67

/** Divisor mg/dL → µmol/L de la creatinina, citado en funcion-renal.ts y copiloto.ts. */
export const UMOL_CREATININA = 88.4

/**
 * Catálogo de factores molares. Arranca SOLO con los dos que YA existen en el
 * repo: no se introduce ni un número clínico nuevo. Añadir un tercer analito
 * exige la cita de su fuente; no se añade ninguno "de paso".
 *
 * NEEDS_CLINICAL_REVIEW (no bloquea E0-04): qué otros analitos deben tener
 * conversión masa↔sustancia (glucosa, urea/BUN, bilirrubina, calcio). Hoy el
 * catálogo devuelve `null` para el resto, que es el comportamiento seguro.
 */
export const FACTORES_MOLARES: Readonly<Record<string, FactorMolar>> = {
  creatinina: {
    analito: 'creatinina',
    factorMgDlAMicromolL: UMOL_CREATININA,
    fuente: 'Comentario de src/lib/expediente/funcion-renal.ts («un valor en µmol/L (÷88.4)»), repetido en copiloto.ts.',
    usadoTambienEn: 'src/lib/expediente/funcion-renal.ts → creatininaPlausibleMgDl',
  },
  colesterol: {
    analito: 'colesterol',
    // mg/dL ÷ 38.67 = mmol/L ⇒ mg/dL × (1000/38.67) = µmol/L
    factorMgDlAMicromolL: 1000 / MMOL_COLESTEROL,
    fuente: 'src/lib/expediente/prevent.ts → const MMOL = 38.67, en uso en el cálculo PREVENT.',
    usadoTambienEn: 'src/lib/expediente/prevent.ts → MMOL',
  },
}

/**
 * Convierte una concentración de masa a concentración de sustancia usando la
 * masa molar del analito. Devuelve `null` si el analito NO está en el catálogo:
 * NUNCA adivina una masa molar.
 */
export function aConcentracionSustancia(
  q: ClinicalQuantity<'concentracion_masa'>, analito: string,
): ClinicalQuantity<'concentracion_sustancia'> | null {
  const f = FACTORES_MOLARES[analito]
  if (!f) return null
  return cantidad(valorEn(q, 'mg/dL') * f.factorMgDlAMicromolL, 'µmol/L', 'concentracion_sustancia')
}

/**
 * Inversa de `aConcentracionSustancia`: µmol/L → mg/dL con la masa molar del
 * analito (E0-05 §3.5).
 *
 * PORQUÉ EXISTE: tras E0-05, `ckdEpi2021` exige `concentracion_masa` y una
 * creatinina en µmol/L YA NO COMPILA. Eso cierra el bug, pero deja sin salida al
 * laboratorio que sí reporta en µmol/L (fuera de México es lo habitual). Ésta es
 * la ÚNICA puerta legítima, y obliga a NOMBRAR el analito — que es justo el dato
 * que hace legítima la conversión.
 *
 * Devuelve `null` si el analito no está en FACTORES_MOLARES: NUNCA adivina una
 * masa molar. No añade ningún analito ni factor nuevo al catálogo.
 */
export function aConcentracionMasa(
  q: ClinicalQuantity<'concentracion_sustancia'>, analito: string,
): ClinicalQuantity<'concentracion_masa'> | null {
  const f = FACTORES_MOLARES[analito]
  if (!f) return null
  return cantidad(valorEn(q, 'µmol/L') / f.factorMgDlAMicromolL, 'mg/dL', 'concentracion_masa')
}
