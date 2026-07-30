/**
 * Biblioteca de preparaciones de infusión — arquitectura de 3 capas.
 *
 * Decisión ICU-Q4.3 del médico dueño, 29-jul-2026:
 *
 *   «No disponemos todavía de las preparaciones locales. NO INVENTAR NINGUNA.
 *    Implementar arquitectura primero.»
 *
 *   Prioridad:  PATIENT_ACTIVE_PREPARATION  >  HOSPITAL_STANDARD  >  REFERENCE_LIBRARY
 *   «REFERENCE_LIBRARY nunca se tratará como estándar local.»
 *
 * ── LA REGLA QUE ESTE MÓDULO HACE IMPOSIBLE DE VIOLAR ────────────────────────
 *
 * Una concentración de referencia **no puede** usarse para calcular una dosis
 * como si fuera la del hospital. Si falta la preparación local, el resultado NO
 * es un número: es `CANNOT_CALCULATE` con `MISSING_CONCENTRATION`, y la app pide
 * los cuatro datos que la decisión enumera.
 *
 * Por eso `resolverPreparacion` devuelve la CAPA junto con el valor: quien
 * calcula tiene que mirarla, no puede ignorarla por descuido.
 *
 * ── LO QUE ESTE MÓDULO NO HACE ───────────────────────────────────────────────
 *
 * No trae ninguna concentración. `REFERENCIA` nace vacía a propósito: cargarla
 * exige una fuente externa citada (la decisión menciona ASHP Standardize 4
 * Safety) y esa carga es su propia unidad de trabajo, con su licencia revisada.
 *
 * Tampoco aprende: «nunca aprender una dilución local automáticamente de una
 * sola infusión». Guardar una preparación como estándar del hospital exige una
 * acción EXPLÍCITA de un usuario autorizado — `promoverAEstandarHospital`.
 *
 * Módulo PURO: sin Firestore, sin reloj.
 */

/** Las tres capas, en orden de MENOR a MAYOR autoridad. */
export const CAPAS_PREPARACION = [
  'REFERENCE_LIBRARY',
  'HOSPITAL_STANDARD',
  'PATIENT_ACTIVE_PREPARATION',
] as const
export type CapaPreparacion = (typeof CAPAS_PREPARACION)[number]

/** Prioridad numérica. Mayor gana. Derivada del orden de arriba, no escrita aparte. */
export const PRIORIDAD_CAPA: Record<CapaPreparacion, number> = Object.fromEntries(
  CAPAS_PREPARACION.map((c, i) => [c, i]),
) as Record<CapaPreparacion, number>

/**
 * Una preparación: cuánto fármaco en cuánto volumen. La concentración se
 * DERIVA, nunca se teclea, para que no pueda contradecir a sus componentes.
 */
export interface Preparacion {
  capa: CapaPreparacion
  medicamento: string
  /** Cantidad total de fármaco en la bolsa/jeringa. */
  cantidadFarmaco: number
  /** Unidad de esa cantidad: 'mg' | 'µg' | 'U'… la valida el motor de infusiones. */
  unidadFarmaco: string
  /** Volumen final de la preparación. */
  volumenFinal: number
  unidadVolumen: string
  /** Sólo para HOSPITAL_STANDARD: quién la autorizó y cuándo. */
  autorizadaPor?: string
  autorizadaEn?: string
  /** Sólo para REFERENCE_LIBRARY: la fuente externa, citada. */
  fuenteExterna?: string
  /** Vigencia declarada por el hospital, si la definió. */
  vigenteDesde?: string
  vigenteHasta?: string
}

export type MotivoNoCalculable =
  | 'MISSING_CONCENTRATION'
  | 'MISSING_WEIGHT'
  | 'MISSING_RATE'

/** Qué le falta al usuario para poder calcular. Los cuatro datos de la decisión. */
export const DATOS_QUE_PIDE: Record<MotivoNoCalculable, readonly string[]> = {
  MISSING_CONCENTRATION: [
    'cantidad total del medicamento',
    'unidad',
    'volumen final',
    'peso si la unidad de dosificación lo requiere',
  ],
  MISSING_WEIGHT: ['peso para dosificación'],
  MISSING_RATE: ['velocidad de infusión (mL/h)'],
}

export type ResolucionPreparacion =
  | { estado: 'RESUELTA'; preparacion: Preparacion; capa: CapaPreparacion }
  | {
      estado: 'CANNOT_CALCULATE'
      motivo: MotivoNoCalculable
      /** Qué pedirle al usuario, ya redactado. */
      pide: readonly string[]
      /**
       * Preparación de REFERENCIA que existe pero **NO se usó**. Se devuelve para
       * poder mostrarla como sugerencia rotulada, nunca para calcular con ella.
       */
      referenciaDisponible?: Preparacion
    }

/**
 * Elige la preparación con la que se va a calcular, respetando la prioridad.
 *
 * ⚠️ `REFERENCE_LIBRARY` **nunca** se devuelve como resuelta. Si es lo único que
 * hay, el resultado es `CANNOT_CALCULATE` — que es literalmente lo que pide la
 * decisión: «No utilizar automáticamente el catálogo de referencia».
 */
export function resolverPreparacion(
  candidatas: readonly Preparacion[],
  medicamento: string,
): ResolucionPreparacion {
  const delMedicamento = candidatas.filter(
    p => p.medicamento.toLowerCase() === medicamento.toLowerCase(),
  )

  const usables = delMedicamento
    .filter(p => p.capa !== 'REFERENCE_LIBRARY')
    .sort((a, b) => PRIORIDAD_CAPA[b.capa] - PRIORIDAD_CAPA[a.capa])

  const ganadora = usables[0]
  if (ganadora !== undefined) {
    return { estado: 'RESUELTA', preparacion: ganadora, capa: ganadora.capa }
  }

  const referencia = delMedicamento.find(p => p.capa === 'REFERENCE_LIBRARY')
  return {
    estado: 'CANNOT_CALCULATE',
    motivo: 'MISSING_CONCENTRATION',
    pide: DATOS_QUE_PIDE.MISSING_CONCENTRATION,
    ...(referencia !== undefined ? { referenciaDisponible: referencia } : {}),
  }
}

/**
 * Lo que se registra cuando el médico dicta «Norepinefrina a 12 mL/h» y NO hay
 * preparación local. El ejemplo literal de la decisión.
 *
 * Se guarda el hecho observado (fármaco + velocidad de bomba) SIN dosis: el dato
 * dictado no se pierde, y la dosis no se inventa.
 */
export interface InfusionSinDosis {
  medication: string
  pumpRate: number
  pumpRateUnit: 'mL/h'
  doseStatus: 'CANNOT_CALCULATE'
  reason: MotivoNoCalculable
  pide: readonly string[]
}

export function registrarSinDosis(
  medication: string,
  pumpRate: number,
  motivo: MotivoNoCalculable = 'MISSING_CONCENTRATION',
): InfusionSinDosis {
  return {
    medication,
    pumpRate,
    pumpRateUnit: 'mL/h',
    doseStatus: 'CANNOT_CALCULATE',
    reason: motivo,
    pide: DATOS_QUE_PIDE[motivo],
  }
}

/** Mensaje único si alguien intenta calcular con una preparación de referencia. */
export const PROHIBIDO_CALCULAR_CON_REFERENCIA =
  'ICU-Q4.3: REFERENCE_LIBRARY nunca se trata como estándar local. Si falta la ' +
  'preparación del hospital, el resultado es CANNOT_CALCULATE / ' +
  'MISSING_CONCENTRATION y se le piden los datos al usuario.'

/** Mensaje único si algo intenta aprender una dilución sola. */
export const PROHIBIDO_APRENDER_DILUCION =
  'ICU-Q4.3: nunca aprender una dilución local automáticamente de una sola ' +
  'infusión. Promover a estándar del hospital exige una acción EXPLÍCITA de un ' +
  'usuario autorizado.'

/**
 * Promueve una preparación usada en un paciente a estándar del hospital.
 *
 * Exige autor y confirmación explícita: la decisión prohíbe que esto ocurra por
 * inferencia. Sin `confirmadoPorUsuario`, lanza.
 */
export function promoverAEstandarHospital(
  preparacion: Preparacion,
  autor: { uid: string; autorizado: boolean },
  confirmadoPorUsuario: boolean,
  fechaIso: string,
): Preparacion {
  if (!confirmadoPorUsuario) throw new Error(PROHIBIDO_APRENDER_DILUCION)
  if (!autor.autorizado) {
    throw new Error('ICU-Q4.3: promover a estándar del hospital exige un usuario AUTORIZADO.')
  }
  return {
    ...preparacion,
    capa: 'HOSPITAL_STANDARD',
    autorizadaPor: autor.uid,
    autorizadaEn: fechaIso,
  }
}

/**
 * La biblioteca de referencia nace VACÍA a propósito.
 *
 * Llenarla exige una fuente externa citada y su licencia revisada — es su propia
 * unidad de trabajo, no un array que alguien rellene de memoria. Un arreglo
 * vacío es honesto; uno con concentraciones inventadas, peligroso.
 */
export const REFERENCE_LIBRARY: readonly Preparacion[] = []
