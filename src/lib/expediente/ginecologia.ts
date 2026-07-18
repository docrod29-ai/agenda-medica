/**
 * GINECOLOGÍA Y OBSTETRICIA — herramientas de consulta:
 *  1. Calculadora gestacional (FUM → FPP + edad gestacional, y por ultrasonido).
 *  2. Control prenatal: qué estudios tocan según la semana (NOM-007 / OMS).
 *  3. Profilaxis de preeclampsia con aspirina (ACOG / USPSTF).
 *  4. Índice de Bishop.
 *  5. Conducta ante citología cervical + VPH (ASCCP 2019, simplificado).
 *
 * Funciones PURAS y testeadas. Apoyo a la decisión: la conducta la define el médico.
 */

const DIA = 86_400_000

/**
 * Las fechas se manejan SIEMPRE en UTC: con hora local, un cambio de horario de
 * verano dentro del rango deja el intervalo en 13 días y 23 h y el redondeo hacia
 * abajo restaba un día entero a la edad gestacional.
 */
function fecha(iso: string): Date {
  return new Date(iso + 'T00:00:00Z')
}

// ═══════════════════════════════════════════════════════════════════════════
// 1. CALCULADORA GESTACIONAL
// ═══════════════════════════════════════════════════════════════════════════

export interface Gestacion {
  /** Fecha probable de parto (ISO, YYYY-MM-DD). */
  fpp: string
  semanas: number
  dias: number
  /** "32.4" — formato clínico semanas.días */
  texto: string
  trimestre: 1 | 2 | 3
  /** Días desde la FUM. */
  diasTotales: number
}

/**
 * Regla de Naegele: FPP = FUM + 280 días, corregida por la duración del ciclo
 * (un ciclo de 35 días desplaza la ovulación y por tanto la FPP 7 días).
 */
export function gestacionPorFUM(fumISO: string, hoyISO: string, cicloDias = 28): Gestacion | null {
  const fum = fecha(fumISO), hoy = fecha(hoyISO)
  if (isNaN(fum.getTime()) || isNaN(hoy.getTime())) return null
  const ajuste = Math.round(cicloDias) - 28
  const fpp = new Date(fum.getTime() + (280 + ajuste) * DIA)
  const diasTotales = Math.floor((hoy.getTime() - fum.getTime()) / DIA) - ajuste
  if (diasTotales < 0) return null
  return armar(fpp, diasTotales)
}

/**
 * Edad gestacional a partir de un ultrasonido previo (el método más confiable
 * en el primer trimestre): se toma la EG que reportó el US y se avanza el tiempo.
 */
export function gestacionPorUltrasonido(
  fechaUSISO: string, semanasUS: number, diasUS: number, hoyISO: string,
): Gestacion | null {
  const us = fecha(fechaUSISO), hoy = fecha(hoyISO)
  if (isNaN(us.getTime()) || isNaN(hoy.getTime())) return null
  if (!(semanasUS >= 0) || !(diasUS >= 0)) return null
  const transcurridos = Math.floor((hoy.getTime() - us.getTime()) / DIA)
  if (transcurridos < 0) return null
  const diasTotales = semanasUS * 7 + diasUS + transcurridos
  const fpp = new Date(hoy.getTime() + (280 - diasTotales) * DIA)
  return armar(fpp, diasTotales)
}

function armar(fpp: Date, diasTotales: number): Gestacion {
  const semanas = Math.floor(diasTotales / 7)
  const dias = diasTotales % 7
  return {
    fpp: fpp.toISOString().slice(0, 10),
    semanas, dias,
    texto: `${semanas}.${dias}`,
    trimestre: semanas < 14 ? 1 : semanas < 28 ? 2 : 3,
    diasTotales,
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 2. CONTROL PRENATAL
// ═══════════════════════════════════════════════════════════════════════════

export interface HitoPrenatal {
  /** Ventana en semanas de gestación [desde, hasta]. */
  ventana: [number, number]
  titulo: string
  detalle: string
}

/** Estudios y acciones del control prenatal (NOM-007-SSA2-2016 + recomendaciones OMS). */
export const HITOS_PRENATALES: HitoPrenatal[] = [
  { ventana: [0, 13], titulo: 'Laboratorios de primera consulta', detalle: 'Biometría hemática, grupo y Rh, glucosa, VDRL/sífilis, VIH (con consentimiento), examen general de orina y urocultivo.' },
  { ventana: [0, 12], titulo: 'Ácido fólico', detalle: '400 µg/día (4 mg si antecedente de defecto del tubo neural). Idealmente desde antes del embarazo hasta la semana 12.' },
  { ventana: [11, 14], titulo: 'Ultrasonido del primer trimestre', detalle: 'Fecha la gestación con la mayor precisión (LCC) y evalúa translucencia nucal para tamizaje de aneuploidías.' },
  { ventana: [12, 28], titulo: 'Aspirina si hay riesgo de preeclampsia', detalle: 'Iniciar 81-162 mg/día, idealmente antes de la semana 16, hasta el parto. Ver el evaluador de riesgo.' },
  { ventana: [18, 22], titulo: 'Ultrasonido estructural', detalle: 'Anatomía fetal completa y localización placentaria.' },
  { ventana: [24, 28], titulo: 'Tamizaje de diabetes gestacional', detalle: 'Curva de tolerancia a la glucosa (75 g en un paso o 50 g/100 g en dos pasos). Repetir biometría hemática.' },
  { ventana: [28, 28], titulo: 'Inmunoglobulina anti-D si Rh negativo', detalle: 'En madre Rh negativa no sensibilizada: 300 µg a las 28 semanas y otra dosis posparto si el recién nacido es Rh positivo. Coombs indirecto previo.' },
  { ventana: [27, 36], titulo: 'Vacuna Tdpa', detalle: 'Una dosis en CADA embarazo entre las semanas 27 y 36 para proteger al recién nacido de tosferina. Influenza en temporada, en cualquier trimestre.' },
  { ventana: [35, 37], titulo: 'Cultivo para estreptococo del grupo B', detalle: 'Cultivo vaginal y rectal; si es positivo, profilaxis antibiótica intraparto.' },
  { ventana: [36, 41], titulo: 'Vigilancia de término', detalle: 'Consulta semanal, valorar presentación, movimientos fetales y bienestar. Plan de nacimiento.' },
  { ventana: [41, 42], titulo: 'Embarazo prolongado', detalle: 'Vigilancia fetal estrecha y valorar inducción del trabajo de parto.' },
]

export interface HitoEstado { hito: HitoPrenatal; estado: 'vigente' | 'proximo' | 'vencido' }

/** Ubica en qué punto del control prenatal va la paciente según las semanas. */
export function hitosSegunEG(semanas: number): HitoEstado[] {
  return HITOS_PRENATALES.map(h => {
    if (semanas >= h.ventana[0] && semanas <= h.ventana[1]) return { hito: h, estado: 'vigente' as const }
    if (semanas < h.ventana[0]) return { hito: h, estado: 'proximo' as const }
    return { hito: h, estado: 'vencido' as const }
  })
}

// ═══════════════════════════════════════════════════════════════════════════
// 3. PROFILAXIS DE PREECLAMPSIA CON ASPIRINA (ACOG / USPSTF)
// ═══════════════════════════════════════════════════════════════════════════

export const RIESGO_ALTO_PE = [
  'Preeclampsia en un embarazo previo',
  'Embarazo múltiple',
  'Hipertensión arterial crónica',
  'Diabetes tipo 1 o tipo 2',
  'Enfermedad renal crónica',
  'Enfermedad autoinmune (lupus, síndrome antifosfolípido)',
]

export const RIESGO_MODERADO_PE = [
  'Nuliparidad',
  'IMC mayor de 30',
  'Antecedente familiar de preeclampsia (madre o hermana)',
  'Edad 35 años o más',
  'Antecedente de bajo peso al nacer o resultado perinatal adverso',
  'Intervalo intergenésico mayor de 10 años',
]

export interface ResultadoAspirina {
  indicada: boolean
  motivo: string
  conducta: string
}

/** Un factor de ALTO riesgo, o dos de riesgo MODERADO, indican profilaxis. */
export function aspirinaPreeclampsia(altos: number, moderados: number): ResultadoAspirina {
  if (altos >= 1) return {
    indicada: true,
    motivo: `${altos} factor${altos > 1 ? 'es' : ''} de alto riesgo`,
    conducta: 'Aspirina 81-162 mg/día desde las 12-28 semanas (idealmente antes de la 16) y hasta el parto.',
  }
  if (moderados >= 2) return {
    indicada: true,
    motivo: `${moderados} factores de riesgo moderado`,
    conducta: 'Aspirina 81-162 mg/día desde las 12-28 semanas (idealmente antes de la 16) y hasta el parto.',
  }
  return {
    indicada: false,
    motivo: moderados === 1 ? 'Solo un factor de riesgo moderado' : 'Sin factores de riesgo registrados',
    conducta: 'No se indica profilaxis con aspirina. Continuar el control prenatal habitual con vigilancia de la presión arterial.',
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 4. ÍNDICE DE BISHOP
// ═══════════════════════════════════════════════════════════════════════════

export interface BishopEntrada {
  dilatacion: number   // 0-3
  borramiento: number  // 0-3
  altura: number       // 0-3
  consistencia: number // 0-2
  posicion: number     // 0-2
}

export interface ResultadoBishop {
  puntaje: number
  categoria: string
  interpretacion: string
  /** false mientras falte contestar algún componente. */
  completo: boolean
  /** Componentes que faltan por contestar. */
  faltantes: string[]
}

const COMPONENTES_BISHOP: (keyof BishopEntrada)[] = ['dilatacion', 'borramiento', 'altura', 'consistencia', 'posicion']
const ETIQUETA_BISHOP: Record<keyof BishopEntrada, string> = {
  dilatacion: 'dilatación', borramiento: 'borramiento', altura: 'altura de la presentación',
  consistencia: 'consistencia', posicion: 'posición',
}

/**
 * Evalúa qué tan favorable está el cuello para inducir el trabajo de parto (máximo 13).
 *
 * Un componente sin contestar NO vale cero: cero es también la opción más baja
 * legítima de cada campo, así que sin distinguirlos un cuello a medio explorar
 * se reportaba como desfavorable. Mientras falte algo, `completo` es false y la
 * interfaz no debe mostrar categoría ni dejar pegarlo a la nota.
 */
export function bishop(e: Partial<BishopEntrada>): ResultadoBishop {
  const faltantes = COMPONENTES_BISHOP.filter(k => e[k] == null).map(k => ETIQUETA_BISHOP[k])
  const p = (e.dilatacion ?? 0) + (e.borramiento ?? 0) + (e.altura ?? 0) + (e.consistencia ?? 0) + (e.posicion ?? 0)
  if (faltantes.length > 0) return {
    puntaje: p, completo: false, faltantes,
    categoria: 'Incompleto',
    interpretacion: `Falta explorar: ${faltantes.join(', ')}. El índice de Bishop solo es interpretable con sus cinco componentes.`,
  }
  if (p >= 8) return {
    puntaje: p, completo: true, faltantes: [], categoria: 'Cuello favorable',
    interpretacion: 'Probabilidad de parto vaginal comparable a la del trabajo de parto espontáneo. La inducción con oxitocina es razonable.',
  }
  if (p >= 6) return {
    puntaje: p, completo: true, faltantes: [], categoria: 'Intermedio',
    interpretacion: 'Valorar maduración cervical antes de la inducción según el contexto clínico.',
  }
  return {
    puntaje: p, completo: true, faltantes: [], categoria: 'Cuello desfavorable',
    interpretacion: 'Mayor riesgo de inducción fallida y de cesárea. Se recomienda maduración cervical previa (prostaglandinas o método mecánico).',
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 5. CITOLOGÍA CERVICAL + VPH (ASCCP 2019, simplificado)
// ═══════════════════════════════════════════════════════════════════════════

export type Citologia = 'NILM' | 'ASC-US' | 'LSIL' | 'ASC-H' | 'HSIL' | 'AGC' | 'CANCER'
export type EstadoVPH = 'negativo' | 'positivo-otro' | 'positivo-16-18' | 'desconocido'

export interface ConductaCervical {
  conducta: string
  urgencia: 'rutina' | 'seguimiento' | 'colposcopia' | 'urgente'
  nota?: string
}

/**
 * Conducta ante el resultado de citología cervical y prueba de VPH.
 * Versión simplificada de las guías ASCCP 2019 (manejo basado en riesgo);
 * los casos con antecedente de displasia o tratamiento previo requieren
 * consultar las tablas completas de riesgo.
 */
export function conductaCervical(cito: Citologia, vph: EstadoVPH, edad: number): ConductaCervical {
  if (cito === 'CANCER') return {
    conducta: 'Referencia inmediata a oncología ginecológica para estadificación y tratamiento.',
    urgencia: 'urgente',
  }
  if (cito === 'AGC') return {
    conducta: 'Colposcopía con muestreo endocervical. Agregar muestreo endometrial si tiene 35 años o más, o si hay sangrado anormal o factores de riesgo.',
    urgencia: 'colposcopia',
    nota: 'Las células glandulares atípicas obligan a descartar patología endocervical y endometrial, no solo escamosa.',
  }
  if (cito === 'HSIL') return {
    conducta: edad >= 25
      ? 'Colposcopía. En mayores de 25 años sin deseo de embarazo inmediato es aceptable el tratamiento escisional inmediato (ver y tratar).'
      : 'Colposcopía. En menores de 25 años se prefiere observación y NO el tratamiento escisional inmediato.',
    urgencia: 'colposcopia',
  }
  if (cito === 'ASC-H') return {
    conducta: 'Colposcopía, independientemente del resultado de VPH.',
    urgencia: 'colposcopia',
  }
  if (cito === 'LSIL') return {
    conducta: vph === 'negativo'
      ? 'Con VPH negativo el riesgo es bajo: es aceptable repetir la co-prueba en 1 año en lugar de colposcopía inmediata.'
      : 'Colposcopía.',
    urgencia: vph === 'negativo' ? 'seguimiento' : 'colposcopia',
  }
  if (cito === 'ASC-US') {
    if (vph === 'negativo') return {
      conducta: 'Riesgo muy bajo: regresar al tamizaje de rutina (repetir co-prueba en 3 años).',
      urgencia: 'rutina',
    }
    if (vph === 'desconocido') return {
      conducta: 'Solicitar prueba de VPH refleja: define si va a colposcopía (positiva) o a tamizaje (negativa).',
      urgencia: 'seguimiento',
    }
    return { conducta: 'Colposcopía.', urgencia: 'colposcopia' }
  }
  // NILM
  if (vph === 'positivo-16-18') return {
    conducta: 'Colposcopía: los genotipos 16 y 18 confieren riesgo suficiente aun con citología negativa.',
    urgencia: 'colposcopia',
  }
  if (vph === 'positivo-otro') return {
    conducta: 'Repetir la co-prueba (citología + VPH) en 1 año.',
    urgencia: 'seguimiento',
  }
  return {
    conducta: tamizajeRutina(edad),
    urgencia: 'rutina',
  }
}

/** Intervalo de tamizaje cervical según la edad. */
export function tamizajeRutina(edad: number): string {
  if (edad < 21) return 'No se recomienda el tamizaje cervical antes de los 21 años.'
  if (edad < 30) return 'Citología cada 3 años (de los 21 a los 29 años).'
  if (edad <= 65) return 'Co-prueba (citología + VPH) cada 5 años, o citología sola cada 3 años.'
  return 'Es posible suspender el tamizaje después de los 65 años si hubo tamizaje previo adecuado y negativo, y no hay antecedente de displasia de alto grado.'
}
