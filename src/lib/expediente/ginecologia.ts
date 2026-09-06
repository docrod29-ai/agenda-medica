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
  /**
   * LA CUENTA NO CUADRA CON UN EMBARAZO EN CURSO — Panel de Lujo MG-010.
   *
   * Texto listo para pintar cuando el resultado sale de un dato implausible.
   * Ausente = la cuenta es plausible. Nunca se corrige la cifra en silencio: se
   * devuelve lo calculado Y el aviso, para que el médico vea las dos cosas y
   * decida (regla 3 de seguridad clínica).
   */
  aviso?: string
}

/**
 * PLAUSIBILIDAD DE LA CUENTA GESTACIONAL — Panel de Lujo MG-010 (P2).
 *
 * ── QUÉ FALLABA ──────────────────────────────────────────────────────────────
 *
 * `gestacionPorFUM` no tenía techo ni acotaba el ciclo. Reproducido por el
 * equipo rojo, literalmente:
 *
 *     gestacionPorFUM('2024-09-01', '2026-09-06')
 *       → { semanas: 105, dias: 0, trimestre: 3, fpp: '2025-06-08' }
 *
 * «105 semanas · 3.º trimestre» sale con la misma cara de dato bueno que
 * «32.4», y se puede pegar a la nota. Y el rojo encontró algo peor de lo
 * reportado: un ciclo NEGATIVO no sólo desplaza la fecha probable de parto,
 * **infla la edad gestacional**:
 *
 *     gestacionPorFUM('2026-07-01', '2026-09-06', -5)
 *       → 14 semanas 2 días sobre un embarazo real de 67 días (9.4)
 *
 * ── DE DÓNDE SALEN LOS LÍMITES, Y POR QUÉ NO SON CLÍNICOS ───────────────────
 *
 * Ninguno de estos números es un punto de corte clínico y por eso se pueden
 * escribir aquí sin `NEEDS_CLINICAL_REVIEW`:
 *
 *  · El techo de 45 semanas NO dice cuándo un embarazo es prolongado —de eso ya
 *    habla `HITOS_PRENATALES` con su ventana [41, 42], que es la cifra clínica y
 *    no se toca—. Dice hasta dónde una CUENTA sigue siendo una cuenta de
 *    embarazo: por encima, lo que hay es una FUM mal capturada.
 *  · El rango de ciclo 21-45 días es el rango de entrada del propio dato, no un
 *    criterio de normalidad: fuera de él el ajuste de Naegele deja de tener
 *    sentido aritmético. Un ciclo negativo o de 90 días no es una paciente: es
 *    un teclado.
 *
 * Si el Dr. quiere otros límites, se cambian aquí y en ningún otro sitio.
 */
export const TECHO_SEMANAS_PLAUSIBLES = 45
export const CICLO_MINIMO_DIAS = 21
export const CICLO_MAXIMO_DIAS = 45

/**
 * Regla de Naegele: FPP = FUM + 280 días, corregida por la duración del ciclo
 * (un ciclo de 35 días desplaza la ovulación y por tanto la FPP 7 días).
 */
export function gestacionPorFUM(fumISO: string, hoyISO: string, cicloDias = 28): Gestacion | null {
  const fum = fecha(fumISO), hoy = fecha(hoyISO)
  if (isNaN(fum.getTime()) || isNaN(hoy.getTime())) return null

  /**
   * MG-010 — el ciclo se ACOTA antes de usarlo, y se dice que se acotó.
   *
   * Un ciclo fuera de rango entra por `Number(ciclo) || 28` desde el panel
   * (`PanelGineco.tsx:42`), así que «90» o «-5» llegaban tal cual y contaminaban
   * la edad gestacional. Aquí se ignora el valor imposible —se usa el ciclo
   * estándar— y el aviso lo dice: nada se corrige en silencio.
   */
  const cicloRedondeado = Math.round(cicloDias)
  const cicloFueraDeRango =
    !Number.isFinite(cicloRedondeado) ||
    cicloRedondeado < CICLO_MINIMO_DIAS ||
    cicloRedondeado > CICLO_MAXIMO_DIAS
  const cicloUsado = cicloFueraDeRango ? 28 : cicloRedondeado

  const ajuste = cicloUsado - 28
  const fpp = new Date(fum.getTime() + (280 + ajuste) * DIA)
  const diasTotales = Math.floor((hoy.getTime() - fum.getTime()) / DIA) - ajuste
  if (diasTotales < 0) return null

  const g = armar(fpp, diasTotales)

  const avisos: string[] = []
  if (cicloFueraDeRango) {
    avisos.push(
      `El ciclo de ${cicloDias} días queda fuera del rango que esta cuenta admite ` +
      `(${CICLO_MINIMO_DIAS}-${CICLO_MAXIMO_DIAS}): se calculó con 28 días. Revisa el dato.`,
    )
  }
  if (g.semanas > TECHO_SEMANAS_PLAUSIBLES) {
    avisos.push(
      `Esta FUM da ${g.semanas} semanas, que no corresponde a un embarazo en curso. ` +
      `Revisa la fecha de la última menstruación antes de usar esta cuenta.`,
    )
  }
  return avisos.length ? { ...g, aviso: avisos.join(' ') } : g
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
  /**
   * DE DÓNDE SALE ESTE RENGLÓN — Panel de Lujo MG-021 (P2).
   *
   * ── QUÉ FALLABA ──────────────────────────────────────────────────────────
   *
   * Tres hitos llevan una DOSIS dentro del texto —ácido fólico 400 µg/día,
   * aspirina 81-162 mg/día, inmunoglobulina anti-D 300 µg— y la única fuente
   * estaba en la cabecera del archivo y en `registry.ts`, en una referencia
   * global para los once renglones. El panel los pintaba a pelo, sin fuente y
   * sin decir que el motor está `pendiente_validacion_clinica`.
   *
   * Una cifra de dosis sin fuente al lado, en una pantalla que el médico usa
   * con la paciente delante, es lo que la regla 1 de seguridad clínica prohíbe.
   *
   * ── QUÉ SE HIZO, Y QUÉ **NO** ────────────────────────────────────────────
   *
   * NO se ha cambiado, añadido ni confirmado ninguna cifra: son las mismas que
   * ya estaban. Lo que se añade es de dónde viene cada renglón, repartiendo por
   * hito la referencia que `registry.ts` ya declaraba para el conjunto
   * («NOM-007 / OMS (control prenatal); ACOG-USPSTF…»). Cuál norma respalda
   * cada cifra EXACTA sigue siendo `NEEDS_CLINICAL_REVIEW`: lo decide el Dr., y
   * hasta que lo decida, el panel enseña el estado «pendiente de validación» en
   * vez de callárselo.
   */
  fuente: string
  /**
   * true cuando el renglón lleva una CANTIDAD dentro del detalle: una dosis
   * (ácido fólico, aspirina, anti-D) o una carga de una prueba (los 75 g de la
   * curva de tolerancia). Se marcan las dos porque el guardián que las vigila no
   * puede distinguirlas mirando el texto, y la que importa es la que se le
   * administra a la paciente — que son las cuatro.
   */
  llevaDosis?: boolean
}

/**
 * Estado de validación del bloque prenatal, tal y como lo declara el registro
 * de motores (`registry.ts`: `estado: 'pendiente_validacion'`). Se exporta para
 * que la PANTALLA pueda decirlo — que era la mitad que faltaba de MG-021.
 */
export const HITOS_PRENATALES_ESTADO = 'pendiente_validacion' as const
export const HITOS_PRENATALES_AVISO =
  'Estas recomendaciones y sus dosis están pendientes de validación clínica final. ' +
  'Cada renglón indica su fuente; confírmala antes de prescribir.'

/** Estudios y acciones del control prenatal (NOM-007-SSA2-2016 + recomendaciones OMS). */
export const HITOS_PRENATALES: HitoPrenatal[] = [
  { ventana: [0, 13], titulo: 'Laboratorios de primera consulta', detalle: 'Biometría hemática, grupo y Rh, glucosa, VDRL/sífilis, VIH (con consentimiento), examen general de orina y urocultivo.' , fuente: 'NOM-007-SSA2-2016 (control prenatal)' },
  { ventana: [0, 12], titulo: 'Ácido fólico', detalle: '400 µg/día (4 mg si antecedente de defecto del tubo neural). Idealmente desde antes del embarazo hasta la semana 12.' , fuente: 'NOM-007-SSA2-2016 · OMS (suplementación periconcepcional)', llevaDosis: true },
  { ventana: [11, 14], titulo: 'Ultrasonido del primer trimestre', detalle: 'Fecha la gestación con la mayor precisión (LCC) y evalúa translucencia nucal para tamizaje de aneuploidías.' , fuente: 'OMS (atención prenatal, 2016)' },
  { ventana: [12, 28], titulo: 'Aspirina si hay riesgo de preeclampsia', detalle: 'Iniciar 81-162 mg/día, idealmente antes de la semana 16, hasta el parto. Ver el evaluador de riesgo.' , fuente: 'ACOG · USPSTF (profilaxis de preeclampsia)', llevaDosis: true },
  { ventana: [18, 22], titulo: 'Ultrasonido estructural', detalle: 'Anatomía fetal completa y localización placentaria.' , fuente: 'OMS (atención prenatal, 2016)' },
  { ventana: [24, 28], titulo: 'Tamizaje de diabetes gestacional', detalle: 'Curva de tolerancia a la glucosa (75 g en un paso o 50 g/100 g en dos pasos). Repetir biometría hemática.' , fuente: 'NOM-007-SSA2-2016 · NOM-015-SSA2-2010', llevaDosis: true },
  { ventana: [28, 28], titulo: 'Inmunoglobulina anti-D si Rh negativo', detalle: 'En madre Rh negativa no sensibilizada: 300 µg a las 28 semanas y otra dosis posparto si el recién nacido es Rh positivo. Coombs indirecto previo.' , fuente: 'ACOG (aloinmunización Rh D)', llevaDosis: true },
  { ventana: [27, 36], titulo: 'Vacuna Tdpa', detalle: 'Una dosis en CADA embarazo entre las semanas 27 y 36 para proteger al recién nacido de tosferina. Influenza en temporada, en cualquier trimestre.' , fuente: 'NOM-007-SSA2-2016 · Cartilla Nacional de Salud' },
  { ventana: [35, 37], titulo: 'Cultivo para estreptococo del grupo B', detalle: 'Cultivo vaginal y rectal; si es positivo, profilaxis antibiótica intraparto.' , fuente: 'ACOG (prevención de infección neonatal por EGB)' },
  { ventana: [36, 41], titulo: 'Vigilancia de término', detalle: 'Consulta semanal, valorar presentación, movimientos fetales y bienestar. Plan de nacimiento.' , fuente: 'NOM-007-SSA2-2016' },
  { ventana: [41, 42], titulo: 'Embarazo prolongado', detalle: 'Vigilancia fetal estrecha y valorar inducción del trabajo de parto.' , fuente: 'NOM-007-SSA2-2016' },
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
