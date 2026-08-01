/**
 * PEDIATRÍA — herramientas de consulta:
 *  1. Dosificación por peso con TOPE de adulto (el error más frecuente y peligroso).
 *  2. Esquema de vacunación de México con detección de atrasos.
 *  3. Motor de percentiles/z-score (LMS de la OMS) + clasificación nutricional.
 *
 * Todo son funciones PURAS y testeadas. Apoyo a la decisión: la dosis final la
 * decide el médico (ajusta por función renal/hepática, prematurez y comorbilidad).
 */

// ═══════════════════════════════════════════════════════════════════════════
// 1. DOSIFICACIÓN POR PESO
// ═══════════════════════════════════════════════════════════════════════════

export interface FarmacoPed {
  nombre: string
  /** mg/kg por DOSIS (si el fármaco se dosifica por toma). */
  mgKgDosis?: [number, number]
  /** mg/kg por DÍA (si se dosifica por día y se divide). */
  mgKgDia?: [number, number]
  /** Tomas al día (para repartir la dosis diaria). */
  tomas?: number
  intervalo: string
  /** Tope por DOSIS (no rebasar al adulto). */
  topeDosis?: number
  /** Tope por DÍA. */
  topeDia?: number
  unidad: string
  /** Piso por toma: hay fármacos que no se dan por debajo de cierta dosis. */
  dosisMinima?: number
  /**
   * Tope en mg/kg/DÍA. Para fármacos (aminoglucósidos) donde el límite de
   * seguridad es por kilo y no hay un tope absoluto validado. Auditoría 2026-07.
   */
  topeMgKgDia?: number
  /**
   * Edad MÍNIMA en meses. Por debajo, el fármaco no debe ofrecerse a un clic:
   * `calcularDosisPediatrica` devuelve un estado bloqueado. Codifica lo que ya
   * decían las notas (ibuprofeno <6m, TMP-SMX <2m, nitrofurantoína <1m).
   */
  edadMinimaMeses?: number
  /** Texto de la restricción por edad, para mostrarla al médico. */
  restriccionEdad?: string
  /**
   * Fármaco de RESCATE/crisis (salbutamol nebulizado): se dosifica por episodio,
   * no por día fijo. NO mostrar un «total/día» — el intervalo de crisis (c/20 min)
   * multiplicaba a cifras absurdas (auditoría 2026-07, validado por el Dr).
   */
  esRescate?: boolean
  nota?: string
}

export const FARMACOS_PED: FarmacoPed[] = [
  { nombre: 'Paracetamol', mgKgDosis: [10, 15], intervalo: 'c/6 h', topeDosis: 1000, topeDia: 4000, unidad: 'mg', nota: 'Máx 75 mg/kg/día. Vigilar dosis acumulada si hay varias presentaciones.' },
  { nombre: 'Ibuprofeno', mgKgDosis: [5, 10], intervalo: 'c/6-8 h', topeDosis: 600, topeDia: 2400, unidad: 'mg', edadMinimaMeses: 6, restriccionEdad: 'No usar en menores de 6 meses; evitar también en deshidratación o lesión renal.', nota: 'Máx 40 mg/kg/día. No en < 6 meses ni en deshidratación/lesión renal.' },
  { nombre: 'Amoxicilina', mgKgDia: [45, 90], tomas: 2, intervalo: 'c/12 h', topeDia: 3000, unidad: 'mg', nota: 'Dosis ALTA (80-90) en otitis media y sospecha de neumococo con sensibilidad disminuida.' },
  { nombre: 'Amoxicilina-clavulanato', mgKgDia: [45, 90], tomas: 2, intervalo: 'c/12 h', topeDia: 3000, unidad: 'mg', nota: 'La dosis se calcula por el componente AMOXICILINA; usar formulación 14:1 para dosis alta.' },
  { nombre: 'Azitromicina', mgKgDia: [10, 10], tomas: 1, intervalo: 'c/24 h', topeDia: 500, unidad: 'mg', nota: 'Día 1: 10 mg/kg; días 2-5: 5 mg/kg (o 10 mg/kg/día × 3 días).' },
  { nombre: 'Cefalexina', mgKgDia: [25, 50], tomas: 3, intervalo: 'c/8 h', topeDia: 4000, unidad: 'mg' },
  { nombre: 'Ceftriaxona', mgKgDia: [50, 75], tomas: 1, intervalo: 'c/24 h', topeDia: 2000, unidad: 'mg', nota: 'Meningitis: 100 mg/kg/día (tope 4 g). No mezclar con calcio en neonatos.' },
  { nombre: 'Cefotaxima', mgKgDia: [100, 200], tomas: 4, intervalo: 'c/6 h', topeDia: 12000, unidad: 'mg' },
  { nombre: 'Clindamicina', mgKgDia: [20, 40], tomas: 3, intervalo: 'c/8 h', topeDia: 2700, unidad: 'mg' },
  { nombre: 'Trimetoprim-sulfametoxazol', mgKgDia: [8, 12], tomas: 2, intervalo: 'c/12 h', topeDia: 320, unidad: 'mg de TMP', edadMinimaMeses: 2, restriccionEdad: 'No usar en menores de 2 meses (riesgo de kernícterus).', nota: 'La dosis se expresa en TRIMETOPRIM. No en < 2 meses.' },
  { nombre: 'Nitrofurantoína', mgKgDia: [5, 7], tomas: 4, intervalo: 'c/6 h', topeDia: 400, unidad: 'mg', edadMinimaMeses: 1, restriccionEdad: 'No usar en menores de 1 mes; contraindicada en insuficiencia renal.', nota: 'Solo IVU baja. No en < 1 mes ni en insuficiencia renal.' },
  { nombre: 'Metronidazol', mgKgDia: [30, 30], tomas: 3, intervalo: 'c/8 h', topeDia: 2000, unidad: 'mg' },
  { nombre: 'Vancomicina', mgKgDia: [40, 60], tomas: 4, intervalo: 'c/6 h', topeDia: 4000, unidad: 'mg', nota: 'Dosificar por AUC/CMI; monitorizar niveles y función renal.' },
  // Neonato ≤7 días: dosis reducida (validado por el Dr). Va ANTES para que el
  // matcher por edad la prefiera; calcularDosisPediatrica elige por edadMeses.
  { nombre: 'Gentamicina neonatal (≤7 días)', mgKgDia: [5, 5], tomas: 2, intervalo: 'c/12 h', topeMgKgDia: 5, unidad: 'mg', edadMinimaMeses: 0, nota: 'Recién nacido ≤7 días: 2.5 mg/kg c/12 h, máx 5 mg/kg/día. Monitorizar niveles y función renal.' },
  // Tope 7.5 mg/kg/día (Dr, ficha técnica). NO hay tope absoluto en mg validado en
  // pediatría → la protección real ante un PESO erróneo es la validación peso-edad.
  { nombre: 'Gentamicina', mgKgDia: [5, 7.5], tomas: 1, intervalo: 'c/24 h', topeMgKgDia: 7.5, unidad: 'mg', nota: 'Dosis única diaria; monitorizar niveles y función renal. En ≤7 días usar la pauta neonatal.' },
  // Tope 15 mg/kg/día y máximo ABSOLUTO 1500 mg/día (validado por el Dr).
  { nombre: 'Amikacina', mgKgDia: [15, 22.5], tomas: 1, intervalo: 'c/24 h', topeMgKgDia: 15, topeDia: 1500, unidad: 'mg', nota: 'Dosis única diaria; monitorizar niveles. Máximo 1500 mg/día. Carga neonatal 10 mg/kg × 1.' },
  { nombre: 'Meropenem', mgKgDia: [60, 60], tomas: 3, intervalo: 'c/8 h', topeDia: 3000, unidad: 'mg', nota: 'Meningitis: 120 mg/kg/día (tope 6 g).' },
  { nombre: 'Prednisona', mgKgDia: [1, 2], tomas: 1, intervalo: 'c/24 h', topeDia: 60, unidad: 'mg' },
  { nombre: 'Dexametasona (croup)', mgKgDosis: [0.15, 0.6], intervalo: 'dosis única', topeDosis: 16, unidad: 'mg' },
  { nombre: 'Salbutamol nebulizado', mgKgDosis: [0.15, 0.15], intervalo: 'c/20 min (crisis)', topeDosis: 5, dosisMinima: 2.5, unidad: 'mg', esRescate: true, nota: 'Crisis: 0.15 mg/kg/dosis (mín 2.5, máx 5 mg) c/20 min × 3, luego c/1-4 h según respuesta. Nebulización continua (0.5 mg/kg/h) es orden aparte y monitorizada. NO tiene un «máximo diario» único.' },
  { nombre: 'Ondansetrón', mgKgDosis: [0.15, 0.15], intervalo: 'c/8 h', topeDosis: 8, unidad: 'mg' },
  { nombre: 'Difenhidramina', mgKgDosis: [1, 1], intervalo: 'c/6 h', topeDosis: 50, unidad: 'mg' },
  { nombre: 'Aciclovir', mgKgDosis: [20, 20], intervalo: 'c/6 h', topeDosis: 800, unidad: 'mg' },
  { nombre: 'Omeprazol', mgKgDia: [1, 1], tomas: 1, intervalo: 'c/24 h', topeDia: 40, unidad: 'mg' },
  { nombre: 'Hierro elemental', mgKgDia: [3, 6], tomas: 1, intervalo: 'c/24 h', topeDia: 200, unidad: 'mg', nota: 'Tratamiento de anemia ferropénica; profilaxis 1-2 mg/kg/día.' },
]

export interface DosisCalculada {
  farmaco: string
  /** Rango por toma, ya con tope aplicado. */
  porToma: { min: number; max: number }
  /** Total al día. */
  porDia: { min: number; max: number }
  intervalo: string
  unidad: string
  /** true si el tope de adulto recortó la dosis calculada. */
  topeAplicado: boolean
  /** Fármaco de rescate/crisis: se dosifica por episodio, no por día. */
  esRescate?: boolean
  /** El fármaco NO corresponde a esta edad: la dosis NO debe usarse. */
  contraindicadoPorEdad?: boolean
  /** Por qué está contraindicado (para mostrarlo). */
  motivoEdad?: string
  nota?: string
}

/**
 * Calcula la dosis pediátrica por peso APLICANDO el tope de adulto.
 *
 * El tope diario se propaga DE REGRESO a la dosis por toma. Sin eso, un fármaco
 * de una sola toma al día mostraba la dosis cruda por peso (ceftriaxona en 50 kg
 * daba 3750 mg por toma) mientras el total diario decía 2000 mg: la receta se
 * escribe con la dosis POR TOMA, así que el tope no servía de nada.
 */
/**
 * SEGURIDAD DE UNIDAD DEL PESO PEDIÁTRICO (decisión del Dr, L6). NexusMED guarda
 * SIEMPRE kg; si se captura en lb se convierte ANTES de dosificar. NO se asume que
 * un peso alto sean libras (un adolescente puede pesar >100 kg; y meter 70 lb como
 * 70 kg pasaría un filtro de tope alto). Por eso: (1) conversión explícita lb→kg;
 * (2) plausibilidad = ADVERTENCIA + confirmación (hard-stop), nunca corrección
 * automática; (3) comparación con el peso previo para detectar el error ≈×2.2046.
 */
export const LB_A_KG = 1 / 2.20462
export function libraAKg(lb: number): number { return lb * LB_A_KG }

export type UnidadPeso = 'kg' | 'lb'
export interface RevisionPeso {
  ok: boolean
  tipo?: 'invalido' | 'implausible' | 'posible_lb_kg'
  motivo?: string
}

/**
 * Revisa un peso YA en kg contra plausibilidad pediátrica y contra el peso previo.
 * `ok:false` = requiere confirmación humana; la UI debe BLOQUEAR el cálculo y el
 * botón "Agregar a nota" hasta que se confirme (no solo mostrar un aviso).
 */
export function revisarPesoPediatrico(pesoKg: number, pesoPrevioKg?: number): RevisionPeso {
  if (!(pesoKg > 0)) return { ok: false, tipo: 'invalido', motivo: 'Peso inválido.' }
  if (pesoKg > 120) {
    return { ok: false, tipo: 'implausible', motivo: `Peso ${pesoKg} kg extraordinariamente alto para pediatría. Verifique peso y unidad antes de calcular (no se asume que sean libras).` }
  }
  if (pesoPrevioKg && pesoPrevioKg > 0) {
    const r = pesoKg / pesoPrevioKg
    if (r >= 1.9 && r <= 2.5) return { ok: false, tipo: 'posible_lb_kg', motivo: `El peso pasó de ${pesoPrevioKg} a ${pesoKg} kg (≈×2.2): ¿se capturó en libras esta vez? Confirme la unidad.` }
    if (r <= 0.53 && r >= 0.4) return { ok: false, tipo: 'posible_lb_kg', motivo: `El peso bajó de ${pesoPrevioKg} a ${pesoKg} kg (≈÷2.2): posible confusión lb/kg. Confirme la unidad.` }
  }
  return { ok: true }
}

export function calcularDosisPediatrica(f: FarmacoPed, pesoKg: number, edadMeses?: number): DosisCalculada | null {
  if (!(pesoKg > 0)) return null

  /**
   * Bloqueo por EDAD — auditoría 2026-07 (P0). Si el fármaco tiene edad mínima y
   * el paciente está por debajo, NO se devuelve una dosis usable: se devuelve un
   * estado contraindicado. Antes el panel ofrecía cualquier fármaco a un clic sin
   * mirar la edad, incluidos los contraindicados en el neonato.
   */
  if (f.edadMinimaMeses != null && edadMeses != null && edadMeses < f.edadMinimaMeses) {
    return {
      farmaco: f.nombre, intervalo: f.intervalo, unidad: f.unidad, topeAplicado: false,
      contraindicadoPorEdad: true,
      motivoEdad: f.restriccionEdad ?? `No indicado por debajo de ${f.edadMinimaMeses} mes(es).`,
      porToma: { min: 0, max: 0 }, porDia: { min: 0, max: 0 }, nota: f.nota,
    }
  }

  /** Cuántas veces al día se administra realmente. */
  const tomasDia = tomasDiaDe(f)

  let minToma: number, maxToma: number
  if (f.mgKgDosis) {
    minToma = f.mgKgDosis[0] * pesoKg
    maxToma = f.mgKgDosis[1] * pesoKg
  } else if (f.mgKgDia) {
    const porDia = f.tomas ?? 1
    minToma = (f.mgKgDia[0] * pesoKg) / porDia
    maxToma = (f.mgKgDia[1] * pesoKg) / porDia
  } else return null

  // Piso por toma (p. ej. salbutamol nebulizado nunca por debajo de 2.5 mg).
  if (f.dosisMinima != null) {
    minToma = Math.max(minToma, f.dosisMinima)
    maxToma = Math.max(maxToma, f.dosisMinima)
  }

  let topeAplicado = false
  if (f.topeDosis != null) {
    if (maxToma > f.topeDosis) { maxToma = f.topeDosis; topeAplicado = true }
    if (minToma > f.topeDosis) { minToma = f.topeDosis; topeAplicado = true }
  }

  // El tope DIARIO limita también lo que puede darse en cada toma.
  if (f.topeDia != null && tomasDia > 0) {
    const maxPorTomaSegunDia = f.topeDia / tomasDia
    if (maxToma > maxPorTomaSegunDia) { maxToma = maxPorTomaSegunDia; topeAplicado = true }
    if (minToma > maxPorTomaSegunDia) { minToma = maxPorTomaSegunDia; topeAplicado = true }
  }

  // El tope mg/kg/DÍA también limita la dosis POR TOMA (REG-018). Sin esto, un
  // aminoglucósido de 1 toma/día (amikacina: rango 15–22.5 pero tope 15) escribía
  // en la receta la dosis/toma cruda (22.5 mg/kg) aunque el total/día sí se recortaba
  // a 15 → la RECETA quedaba 50% arriba del tope de seguridad. Se propaga de regreso
  // a porToma, igual que topeDia.
  if (f.topeMgKgDia != null && tomasDia > 0) {
    const maxPorTomaSegunKgDia = (f.topeMgKgDia * pesoKg) / tomasDia
    if (maxToma > maxPorTomaSegunKgDia) { maxToma = maxPorTomaSegunKgDia; topeAplicado = true }
    if (minToma > maxPorTomaSegunKgDia) { minToma = maxPorTomaSegunKgDia; topeAplicado = true }
  }

  let minDia = minToma * tomasDia
  let maxDia = maxToma * tomasDia
  if (f.topeDia != null) {
    if (maxDia > f.topeDia) { maxDia = f.topeDia; topeAplicado = true }
    if (minDia > f.topeDia) { minDia = f.topeDia; topeAplicado = true }
  }
  // Tope por mg/kg/DÍA (aminoglucósidos): límite de seguridad por kilo cuando no
  // hay tope absoluto en mg. Auditoría 2026-07 (P0).
  if (f.topeMgKgDia != null) {
    const maxSegunKg = f.topeMgKgDia * pesoKg
    if (maxDia > maxSegunKg) { maxDia = maxSegunKg; topeAplicado = true }
    if (minDia > maxSegunKg) { minDia = maxSegunKg; topeAplicado = true }
  }

  /**
   * REDONDEO QUE NO PUEDE VIOLAR UN TOPE (decisión clínica del Dr., REG-042).
   *
   * Antes se redondeaba AL MÁS CERCANO a décimas, y eso dejaba la salida por
   * ENCIMA de un tope que el propio catálogo declara:
   *   · Metronidazol @66.7 kg → 666.7 × 3 = 2000.1 contra topeDia 2000
   *   · Gentamicina neonatal @51.3 kg → 128.3 × 2 = 256.6 contra 256.5
   * Clínicamente 0.1 mg es irrelevante; para un motor de seguridad es una
   * invariante rota, y mañana el mismo comportamiento produce una desviación
   * mayor al cambiar precisión, presentación o número de administraciones.
   *
   * Flujo: CLAMP (ya hecho arriba) → REDONDEAR → RE-VERIFICAR → PISO SI EXCEDE.
   * No se redondea todo hacia abajo: solo cuando el redondeo cruzaría el techo.
   * El epsilon existe para la aritmética de punto flotante, NO para tolerar una
   * violación de la regla farmacológica.
   */
  const DEC = 10                                    // trabajo a décimas de mg
  const EPS = 1e-9
  const aDecimas = (x: number) => Math.round(x * DEC) / DEC
  const pisoDecimas = (x: number) => Math.floor(x * DEC) / DEC
  const menor = (vs: (number | undefined)[]): number | undefined => {
    const ns = vs.filter((v): v is number => typeof v === 'number' && Number.isFinite(v))
    return ns.length ? Math.min(...ns) : undefined
  }
  /**
   * Techos EFECTIVOS. Incluyen los topes ABSOLUTOS del catálogo **y** los que se
   * derivan del propio rango mg/kg: el arnés cazó que sin estos, redondear al
   * más cercano cruzaba el techo por kilo aunque el tope absoluto quedara lejos
   * (Paracetamol @1.85 kg → 27.75 mg redondeaba a 27.8 = 15.03 mg/kg contra un
   * máximo de 15; Amoxicilina @1.85 kg → 90.05 mg/kg/día contra 90).
   */
  const techoToma = menor([
    f.topeDosis,
    f.mgKgDosis ? f.mgKgDosis[1] * pesoKg : undefined,
    f.mgKgDia && tomasDia > 0 ? (f.mgKgDia[1] * pesoKg) / (f.tomas ?? 1) : undefined,
    f.topeDia != null && tomasDia > 0 ? f.topeDia / tomasDia : undefined,
    f.topeMgKgDia != null && tomasDia > 0 ? (f.topeMgKgDia * pesoKg) / tomasDia : undefined,
  ])
  /**
   * Un PISO declarado gana sobre un techo DERIVADO del rango mg/kg. Salbutamol
   * nebulizado a 10 kg da 1.5 mg por peso, pero su `dosisMinima` es 2.5 mg
   * porque por debajo no nebuliza: aplicar el techo derivado lo devolvía a 1.5 e
   * infradosificaba. Los topes ABSOLUTOS del catálogo no se tocan.
   */
  const techoTomaFinal = (f.dosisMinima != null && techoToma != null)
    ? Math.max(techoToma, f.dosisMinima)
    : techoToma

  const r = (x: number, techo?: number) => {
    const n = aDecimas(x)
    if (techo == null || n <= techo + EPS) return n
    return pisoDecimas(techo)   // el redondeo cruzó el techo → baja al escalón inferior
  }

  const tomaMin = r(minToma, techoTomaFinal)
  const tomaMax = r(maxToma, techoTomaFinal)
  /**
   * El total del día se DERIVA de la dosis por toma ya redondeada, no se redondea
   * aparte. Si se calculan por separado, la receta puede decir "666.6 mg × 3" y
   * abajo "2000 mg/día", que no es lo que resulta de administrarla. Como el techo
   * por toma ya contempla los topes diarios, este producto nunca los rebasa.
   */
  const diaMin = tomasDia > 0 ? aDecimas(tomaMin * tomasDia) : aDecimas(minDia)
  const diaMax = tomasDia > 0 ? aDecimas(tomaMax * tomasDia) : aDecimas(maxDia)

  return {
    farmaco: f.nombre, intervalo: f.intervalo, unidad: f.unidad, topeAplicado, nota: f.nota,
    esRescate: f.esRescate,
    porToma: { min: tomaMin, max: tomaMax },
    porDia: { min: diaMin, max: diaMax },
  }
}

/**
 * Tomas al día que el motor aplica REALMENTE a un fármaco. Función pura; era la
 * expresión inline de `calcularDosisPediatrica`. Se EXPORTA para que el arnés de
 * invariantes (`src/__tests__/dosis-invariantes-property.test.ts`) compruebe
 * `porToma × tomas ≤ tope` con las mismas tomas que usó el motor: re-implementarlas
 * en el test haría que el test coincidiera con cualquier bug del motor.
 * Cero cambio de comportamiento.
 */
export function tomasDiaDe(f: FarmacoPed): number {
  return f.mgKgDosis ? tomasPorIntervalo(f.intervalo) : (f.tomas ?? 1)
}

/**
 * Tomas al día implícitas en el texto del intervalo. Distingue la unidad: sin
 * esto, "c/20 min (crisis)" se leía como cada 20 HORAS y devolvía una toma al
 * día para un broncodilatador que se repite cada 20 minutos.
 */
export function tomasPorIntervalo(intervalo: string): number {
  const min = intervalo.match(/c\/(\d+)\s*min/i)
  if (min) return Math.max(1, Math.round(1440 / Number(min[1])))
  const h = intervalo.match(/c\/(\d+)/)
  if (h) return Math.max(1, Math.round(24 / Number(h[1])))
  return 1   // "dosis única" y similares
}

// ═══════════════════════════════════════════════════════════════════════════
// 2. ESQUEMA DE VACUNACIÓN (México)
// ═══════════════════════════════════════════════════════════════════════════

export interface Vacuna {
  nombre: string
  /** Edad de aplicación en MESES (0 = al nacer). */
  mes: number
  detalle: string
}

/** Cartilla Nacional de Vacunación (México). Refuerzos y campañas se anotan aparte. */
export const ESQUEMA_MX: Vacuna[] = [
  { nombre: 'BCG', mes: 0, detalle: 'Dosis única al nacer (tuberculosis meníngea).' },
  { nombre: 'Hepatitis B', mes: 0, detalle: '1ª dosis en las primeras 12 h de vida.' },
  { nombre: 'Hepatitis B', mes: 2, detalle: '2ª dosis.' },
  { nombre: 'Hexavalente / Pentavalente acelular', mes: 2, detalle: '1ª dosis (difteria, tosferina, tétanos, polio, Hib ± hepatitis B).' },
  { nombre: 'Rotavirus', mes: 2, detalle: '1ª dosis (no iniciar después de las 15 semanas).' },
  { nombre: 'Neumocócica conjugada', mes: 2, detalle: '1ª dosis.' },
  { nombre: 'Hexavalente / Pentavalente acelular', mes: 4, detalle: '2ª dosis.' },
  { nombre: 'Rotavirus', mes: 4, detalle: '2ª dosis.' },
  { nombre: 'Neumocócica conjugada', mes: 4, detalle: '2ª dosis.' },
  { nombre: 'Hexavalente / Pentavalente acelular', mes: 6, detalle: '3ª dosis.' },
  { nombre: 'Hepatitis B', mes: 6, detalle: '3ª dosis.' },
  { nombre: 'Influenza', mes: 6, detalle: 'Desde los 6 meses; la 1ª vez son 2 dosis con 4 semanas de diferencia, luego anual hasta los 59 meses.' },
  { nombre: 'SRP (triple viral)', mes: 12, detalle: '1ª dosis (sarampión, rubéola, parotiditis).' },
  { nombre: 'Neumocócica conjugada', mes: 12, detalle: 'Refuerzo.' },
  { nombre: 'Hexavalente / Pentavalente acelular', mes: 18, detalle: '4ª dosis (refuerzo).' },
  { nombre: 'SRP (triple viral)', mes: 18, detalle: '2ª dosis.' },
  { nombre: 'DPT (refuerzo)', mes: 48, detalle: 'Refuerzo a los 4 años.' },
  { nombre: 'VPH', mes: 132, detalle: 'A los 11 años (5º de primaria); esquema según lineamiento vigente.' },
  { nombre: 'Td (tétanos-difteria)', mes: 144, detalle: 'A los 12 años y refuerzo cada 10 años.' },
]

export interface EstadoVacuna { vacuna: Vacuna; estado: 'aplicada' | 'pendiente' | 'atrasada' }

/**
 * Compara la edad (en meses) contra el esquema y marca lo ATRASADO.
 * `aplicadas` son los nombres+mes ya registrados (clave "nombre@mes").
 */
export function vacunasSegunEdad(edadMeses: number, aplicadas: string[] = []): EstadoVacuna[] {
  const set = new Set(aplicadas)
  return ESQUEMA_MX.map(v => {
    const clave = `${v.nombre}@${v.mes}`
    if (set.has(clave)) return { vacuna: v, estado: 'aplicada' as const }
    // Se considera ATRASADA si ya pasó más de 1 mes de la edad indicada.
    if (edadMeses > v.mes + 1) return { vacuna: v, estado: 'atrasada' as const }
    return { vacuna: v, estado: 'pendiente' as const }
  })
}

/**
 * Una fecha `YYYY-MM-DD` leída como día LOCAL, no como medianoche UTC.
 *
 * ── EL FALLO QUE CIERRA ──────────────────────────────────────────────────────
 *
 * `new Date('2020-03-15')` NO es el 15 de marzo: el estándar obliga a leer una
 * fecha suelta como medianoche **UTC**, y en México (UTC−6) eso cae el **14 de
 * marzo a las 18:00** hora local. Como `getDate()` devuelve el día local, la
 * fecha de nacimiento se corría un día hacia atrás.
 *
 * Efecto medido: un niño nacido el 15 de marzo de 2020 «cumplía 2 años» el 14 de
 * marzo de 2022. Un día antes, todos los años, para todos los pacientes.
 *
 * No es cosmético. De esta edad comen la dosis pediátrica por bandas, las
 * contraindicaciones por edad y el calendario de vacunación: cruzar un umbral un
 * día antes es cruzarlo mal, y nadie lo iba a notar porque la cifra se ve
 * perfectamente razonable.
 *
 * Sólo aplica a la fecha SUELTA. Una marca de tiempo completa («…T12:00:00»)
 * lleva su propia hora y se respeta tal cual.
 */
export function fechaLocalDesdeISO(iso: string): Date {
  const s = String(iso ?? '').trim()
  const soloFecha = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
  if (soloFecha) {
    return new Date(Number(soloFecha[1]), Number(soloFecha[2]) - 1, Number(soloFecha[3]))
  }
  return new Date(s)
}

/** Edad en meses a partir de la fecha de nacimiento (ISO) y una fecha de corte. */
export function edadEnMeses(fechaNacimientoISO: string, hoyISO: string): number {
  const n = fechaLocalDesdeISO(fechaNacimientoISO), h = fechaLocalDesdeISO(hoyISO)
  if (isNaN(n.getTime()) || isNaN(h.getTime())) return 0
  let meses = (h.getFullYear() - n.getFullYear()) * 12 + (h.getMonth() - n.getMonth())
  if (h.getDate() < n.getDate()) meses--
  return Math.max(0, meses)
}

/** Edad en años cumplidos a partir de la fecha de nacimiento (ISO). null si inválida. */
export function edadEnAnios(fechaNacimientoISO: string | undefined | null, hoyISO?: string): number | null {
  if (!fechaNacimientoISO) return null
  const n = fechaLocalDesdeISO(fechaNacimientoISO)
  const h = hoyISO ? fechaLocalDesdeISO(hoyISO) : new Date()
  if (isNaN(n.getTime()) || isNaN(h.getTime())) return null
  let a = h.getFullYear() - n.getFullYear()
  if (h.getMonth() < n.getMonth() || (h.getMonth() === n.getMonth() && h.getDate() < n.getDate())) a--
  return a >= 0 && a < 130 ? a : null
}

// ═══════════════════════════════════════════════════════════════════════════
// 3. PERCENTILES / Z-SCORE (método LMS de la OMS)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * z-score por el método LMS (OMS/CDC):  z = ((X/M)^L − 1) / (L·S)   (L ≠ 0)
 *                                       z = ln(X/M) / S             (L = 0)
 * L, M y S se toman de la tabla de referencia OFICIAL para edad y sexo.
 */
export function zScoreLMS(valor: number, L: number, M: number, S: number): number {
  if (!(valor > 0) || !(M > 0) || !(S > 0)) return NaN
  const z = L === 0 ? Math.log(valor / M) / S : (Math.pow(valor / M, L) - 1) / (L * S)
  const r = Math.round(z * 100) / 100
  return r === 0 ? 0 : r      // evita el "-0" al caer justo en la mediana
}

/** Percentil a partir del z-score (función de distribución normal acumulada). */
export function percentilDeZ(z: number): number {
  if (!isFinite(z)) return NaN
  // Aproximación de Abramowitz & Stegun (error < 7.5e-8).
  const b = [0.319381530, -0.356563782, 1.781477937, -1.821255978, 1.330274429]
  const p = 0.2316419, c = 0.39894228
  const x = Math.abs(z)
  const t = 1 / (1 + p * x)
  const poly = t * (b[0] + t * (b[1] + t * (b[2] + t * (b[3] + t * b[4]))))
  const nd = c * Math.exp(-x * x / 2) * poly
  const acum = z >= 0 ? 1 - nd : nd
  return Math.round(acum * 1000) / 10   // en %
}

/** Clasificación nutricional de la OMS por z-score de peso/talla o IMC/edad. */
export function clasificarZ(z: number): { etiqueta: string; nivel: 'bajo' | 'normal' | 'alto' } {
  if (!isFinite(z)) return { etiqueta: 'Sin datos suficientes', nivel: 'normal' }
  if (z < -3) return { etiqueta: 'Desnutrición severa (z < −3)', nivel: 'bajo' }
  if (z < -2) return { etiqueta: 'Desnutrición moderada (z −3 a −2)', nivel: 'bajo' }
  if (z < -1) return { etiqueta: 'Riesgo de desnutrición (z −2 a −1)', nivel: 'bajo' }
  if (z <= 1) return { etiqueta: 'Normal (z −1 a +1)', nivel: 'normal' }
  if (z <= 2) return { etiqueta: 'Riesgo de sobrepeso (z +1 a +2)', nivel: 'alto' }
  if (z <= 3) return { etiqueta: 'Sobrepeso (z +2 a +3)', nivel: 'alto' }
  return { etiqueta: 'Obesidad (z > +3)', nivel: 'alto' }
}

/** IMC pediátrico (se interpreta SIEMPRE por percentil/z para edad y sexo, no por cortes de adulto). */
export function imc(pesoKg: number, tallaCm: number): number {
  if (!(pesoKg > 0) || !(tallaCm > 0)) return NaN
  const m = tallaCm / 100
  return Math.round((pesoKg / (m * m)) * 10) / 10
}

// ═══════════════════════════════════════════════════════════════════════════
// 4. CURVAS DE CRECIMIENTO DE LA OMS (0 a 60 meses)
// ═══════════════════════════════════════════════════════════════════════════

import {
  PESO_EDAD_NINO, PESO_EDAD_NINA,
  TALLA_EDAD_NINO, TALLA_EDAD_NINA,
  IMC_EDAD_NINO, IMC_EDAD_NINA,
  PC_EDAD_NINO, PC_EDAD_NINA,
  type LMS,
} from './oms-crecimiento'

export type Indicador = 'peso' | 'talla' | 'imc' | 'perimetro-cefalico'

const TABLAS: Record<Indicador, { nino: readonly LMS[]; nina: readonly LMS[]; unidad: string; nombre: string }> = {
  'peso': { nino: PESO_EDAD_NINO, nina: PESO_EDAD_NINA, unidad: 'kg', nombre: 'Peso para la edad' },
  'talla': { nino: TALLA_EDAD_NINO, nina: TALLA_EDAD_NINA, unidad: 'cm', nombre: 'Talla para la edad' },
  'imc': { nino: IMC_EDAD_NINO, nina: IMC_EDAD_NINA, unidad: 'kg/m²', nombre: 'IMC para la edad' },
  'perimetro-cefalico': { nino: PC_EDAD_NINO, nina: PC_EDAD_NINA, unidad: 'cm', nombre: 'Perímetro cefálico para la edad' },
}

export interface ResultadoCrecimiento {
  indicador: string
  valor: number
  unidad: string
  z: number
  percentil: number
  /** Mediana de la OMS para esa edad y sexo: el "esperado". */
  mediana: number
  clasificacion: string
  nivel: 'bajo' | 'normal' | 'alto'
  fuente: string
}

/**
 * Calcula el z-score y el percentil de un niño contra el estándar de la OMS.
 *
 * Devuelve null si la edad queda fuera de 0 a 60 meses: estos estándares NO
 * cubren más allá de los 5 años, y extrapolar daría un percentil inventado.
 */
export function evaluarCrecimiento(
  indicador: Indicador, valor: number, edadMeses: number, esNina: boolean,
): ResultadoCrecimiento | null {
  const t = TABLAS[indicador]
  if (!t || !(valor > 0)) return null
  const m = Math.round(edadMeses)
  if (!(m >= 0) || m > 60) return null

  const tabla = esNina ? t.nina : t.nino
  const fila = tabla[m]
  if (!fila) return null
  const [L, M, S] = fila

  const z = zScoreLMS(valor, L, M, S)
  if (!isFinite(z)) return null
  const c = indicador === 'talla'
    ? clasificarTalla(z)
    : indicador === 'perimetro-cefalico'
      ? clasificarPerimetro(z)
      : indicador === 'peso'
        ? clasificarPesoEdad(z)      // peso-para-edad NO usa cortes de IMC (Dr 2026-07)
        : clasificarZ(z)             // IMC-para-edad conserva sobrepeso/obesidad

  return {
    indicador: t.nombre, valor, unidad: t.unidad,
    z, percentil: percentilDeZ(z), mediana: M,
    clasificacion: c.etiqueta, nivel: c.nivel,
    fuente: 'Estándares de crecimiento infantil de la OMS (tablas ampliadas de puntuación z, 0 a 60 meses)',
  }
}

/** La talla baja se llama "talla baja", no "desnutrición": es otro desenlace. */
function clasificarTalla(z: number): { etiqueta: string; nivel: 'bajo' | 'normal' | 'alto' } {
  if (z < -3) return { etiqueta: 'Talla baja severa (z < −3)', nivel: 'bajo' }
  if (z < -2) return { etiqueta: 'Talla baja (z −3 a −2)', nivel: 'bajo' }
  if (z <= 3) return { etiqueta: 'Talla normal para la edad', nivel: 'normal' }
  return { etiqueta: 'Talla alta (z > +3): valorar causa endocrina si es desproporcionada', nivel: 'alto' }
}

/**
 * PESO PARA LA EDAD — categorías OMS validadas por el Dr (auditoría 2026-07).
 * El peso-para-la-edad NO diagnostica sobrepeso ni obesidad: por encima de +2 DE
 * solo indica "peso alto, evaluar otro indicador" (peso-para-talla o IMC/edad).
 * Antes reusaba clasificarZ (de IMC) y etiquetaba «Sobrepeso»/«Obesidad», que es
 * incorrecto para este indicador.
 */
function clasificarPesoEdad(z: number): { etiqueta: string; nivel: 'bajo' | 'normal' | 'alto' } {
  if (z < -3) return { etiqueta: 'Peso muy bajo para la edad / bajo peso grave (z < −3)', nivel: 'bajo' }
  if (z < -2) return { etiqueta: 'Peso bajo para la edad (z −3 a −2)', nivel: 'bajo' }
  if (z <= 2) return { etiqueta: 'Sin bajo peso para la edad', nivel: 'normal' }
  return { etiqueta: 'Peso alto para la edad (z > +2): evaluar peso-para-talla o IMC-para-la-edad; peso-para-la-edad no diagnostica sobrepeso u obesidad', nivel: 'alto' }
}

/** El perímetro cefálico tiene significado propio: micro y macrocefalia. */
function clasificarPerimetro(z: number): { etiqueta: string; nivel: 'bajo' | 'normal' | 'alto' } {
  if (z < -2) return { etiqueta: 'Microcefalia (z < −2): valorar causa y neurodesarrollo', nivel: 'bajo' }
  if (z <= 2) return { etiqueta: 'Perímetro cefálico normal', nivel: 'normal' }
  return { etiqueta: 'Macrocefalia (z > +2): valorar causa y velocidad de crecimiento', nivel: 'alto' }
}

/** Evalúa de una vez todo lo que se pueda con los datos capturados. */
export function evaluarTodo(
  edadMeses: number, esNina: boolean,
  datos: { pesoKg?: number; tallaCm?: number; perimetroCm?: number },
): ResultadoCrecimiento[] {
  const out: ResultadoCrecimiento[] = []
  const push = (r: ResultadoCrecimiento | null) => { if (r) out.push(r) }
  if (datos.pesoKg) push(evaluarCrecimiento('peso', datos.pesoKg, edadMeses, esNina))
  if (datos.tallaCm) push(evaluarCrecimiento('talla', datos.tallaCm, edadMeses, esNina))
  if (datos.perimetroCm) push(evaluarCrecimiento('perimetro-cefalico', datos.perimetroCm, edadMeses, esNina))
  if (datos.pesoKg && datos.tallaCm) {
    const i = imc(datos.pesoKg, datos.tallaCm)
    if (Number.isFinite(i)) push(evaluarCrecimiento('imc', i, edadMeses, esNina))
  }
  return out
}
