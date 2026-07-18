/**
 * MEDICINA PREVENTIVA — qué tamizaje toca según edad y sexo.
 *
 * ADVERTENCIA DE PROCEDENCIA, distinta a la de los módulos cardiometabólicos:
 * los módulos de dislipidemia, obesidad y MASLD se construyeron leyendo los
 * documentos originales. ESTE módulo NO: recoge recomendaciones de tamizaje
 * ampliamente establecidas (USPSTF, ACS, ADA, CENETEC) tal como se enseñan y
 * practican, pero SIN que se haya leído aquí el documento fuente vigente.
 *
 * Consecuencia práctica: las recomendaciones de tamizaje cambian de versión con
 * frecuencia (la edad de inicio del tamizaje de colon bajó de 50 a 45 años hace
 * pocos años, por ejemplo). Antes de usarlo como referencia dura, el médico debe
 * cotejarlo con la versión vigente. Cada entrada dice de qué organismo proviene
 * para poder verificarla.
 */

export const ADVERTENCIA_PREVENTIVO =
  'Estas recomendaciones de tamizaje no se derivaron de un documento leído en esta herramienta, a diferencia de los módulos cardiometabólicos. Provienen de recomendaciones ampliamente establecidas y deben cotejarse con la versión vigente del organismo que las emite antes de usarse como referencia dura.'

export interface Tamizaje {
  prueba: string
  /** Edad de inicio, en años. */
  desde: number
  /** Edad de fin; null si no tiene tope definido. */
  hasta: number | null
  /** 'ambos' | 'mujer' | 'hombre' */
  sexo: 'ambos' | 'mujer' | 'hombre'
  frecuencia: string
  organismo: string
  /** Condición extra para que aplique (tabaquismo, factores de riesgo). */
  condicion?: string
  nota?: string
}

export const TAMIZAJES: Tamizaje[] = [
  // ── Cáncer ──
  {
    prueba: 'Mastografía', desde: 40, hasta: 74, sexo: 'mujer',
    frecuencia: 'Cada 2 años (algunos esquemas la hacen anual de los 45 a los 54)',
    organismo: 'USPSTF (recomendación de 2024, que bajó la edad de inicio de 50 a 40 años)',
  },
  {
    prueba: 'Citología cervical', desde: 21, hasta: 29, sexo: 'mujer',
    frecuencia: 'Cada 3 años',
    organismo: 'USPSTF · ASCCP',
  },
  {
    prueba: 'Co-prueba de citología y VPH', desde: 30, hasta: 65, sexo: 'mujer',
    frecuencia: 'Cada 5 años, o citología sola cada 3 años',
    organismo: 'USPSTF · ASCCP',
    nota: 'Puede suspenderse después de los 65 años si hubo tamizaje previo adecuado y negativo, sin antecedente de displasia de alto grado.',
  },
  {
    prueba: 'Tamizaje de cáncer colorrectal', desde: 45, hasta: 75, sexo: 'ambos',
    frecuencia: 'Colonoscopía cada 10 años, o sangre oculta inmunoquímica anual, o sigmoidoscopía cada 5 años',
    organismo: 'USPSTF · ACS (la edad de inicio bajó de 50 a 45 años)',
    nota: 'De los 76 a los 85 años se individualiza según estado de salud y tamizaje previo.',
  },
  {
    prueba: 'Tomografía de baja dosis para cáncer de pulmón', desde: 50, hasta: 80, sexo: 'ambos',
    frecuencia: 'Anual',
    organismo: 'USPSTF',
    condicion: 'Historia de tabaquismo de 20 paquetes-año o más, y que fume actualmente o haya dejado de fumar en los últimos 15 años',
  },
  {
    prueba: 'Antígeno prostático específico', desde: 55, hasta: 69, sexo: 'hombre',
    frecuencia: 'Decisión individual compartida; no es tamizaje automático',
    organismo: 'USPSTF (recomendación C: decisión individual)',
    nota: 'Se adelanta la conversación en hombres de raza negra y con antecedente familiar de primer grado.',
  },

  // ── Cardiovascular y metabólico ──
  {
    prueba: 'Presión arterial', desde: 18, hasta: null, sexo: 'ambos',
    frecuencia: 'Anual desde los 40 años; cada 3 a 5 años de los 18 a los 39 si no hay factores de riesgo',
    organismo: 'USPSTF',
  },
  {
    prueba: 'Perfil de lípidos', desde: 20, hasta: null, sexo: 'ambos',
    frecuencia: 'Al menos cada 5 años; se usa PREVENT-ASCVD para estimar riesgo de los 30 a los 79 años',
    organismo: 'Guía ACC/AHA 2026 de dislipidemia',
    nota: 'Antes de los 20 años se tamiza a los 9 a 11 años y de nuevo a los 19, y desde los 2 años si hay antecedente familiar de enfermedad cardiovascular prematura o hipercolesterolemia familiar.',
  },
  {
    prueba: 'Lp(a)', desde: 18, hasta: null, sexo: 'ambos',
    frecuencia: 'UNA sola vez en la vida',
    organismo: 'Guía ACC/AHA 2026 de dislipidemia (COR 1)',
    nota: 'Es determinada genéticamente; una medición basta salvo que cambie el contexto clínico.',
  },
  {
    prueba: 'Glucosa o hemoglobina glucosilada', desde: 35, hasta: 70, sexo: 'ambos',
    frecuencia: 'Cada 3 años',
    organismo: 'USPSTF · ADA',
    condicion: 'Sobrepeso u obesidad. Con factores de riesgo adicionales se inicia antes',
  },
  {
    prueba: 'FIB-4 para hígado graso', desde: 18, hasta: null, sexo: 'ambos',
    frecuencia: 'En la visita inicial y anualmente',
    organismo: 'ADA, Standards of Care 2026',
    condicion: 'Diabetes tipo 2, prediabetes, u obesidad con al menos un factor de riesgo cardiovascular',
    nota: 'Se hace aunque las enzimas hepáticas estén normales: la mayoría de quienes tienen fibrosis significativa las tiene normales.',
  },
  {
    prueba: 'Ultrasonido de aorta abdominal', desde: 65, hasta: 75, sexo: 'hombre',
    frecuencia: 'Una vez',
    organismo: 'USPSTF',
    condicion: 'Que haya fumado alguna vez',
  },

  // ── Infeccioso ──
  {
    prueba: 'VIH', desde: 15, hasta: 65, sexo: 'ambos',
    frecuencia: 'Al menos una vez; se repite según exposición',
    organismo: 'USPSTF · CDC',
  },
  {
    prueba: 'Hepatitis C', desde: 18, hasta: 79, sexo: 'ambos',
    frecuencia: 'Al menos una vez en la vida',
    organismo: 'USPSTF · CDC',
    nota: 'La hepatitis C es curable hoy en prácticamente todos los casos.',
  },
  {
    prueba: 'Hepatitis B', desde: 18, hasta: null, sexo: 'ambos',
    frecuencia: 'Al menos una vez en la vida',
    organismo: 'CDC',
  },
  {
    prueba: 'Sífilis, gonorrea y clamidia', desde: 15, hasta: null, sexo: 'ambos',
    frecuencia: 'Según exposición y factores de riesgo',
    organismo: 'USPSTF · CDC',
    condicion: 'Actividad sexual con riesgo aumentado',
  },

  // ── Otros ──
  {
    prueba: 'Densitometría ósea', desde: 65, hasta: null, sexo: 'mujer',
    frecuencia: 'Según resultado y riesgo',
    organismo: 'USPSTF',
    nota: 'Antes de los 65 años si hay factores de riesgo que igualen el riesgo de una mujer de 65 años.',
  },
  {
    prueba: 'Tamizaje de depresión', desde: 12, hasta: null, sexo: 'ambos',
    frecuencia: 'En cada contacto con el sistema de salud, con instrumento validado (PHQ-2 o PHQ-9)',
    organismo: 'USPSTF',
  },
  {
    prueba: 'Tamizaje de ansiedad', desde: 19, hasta: 64, sexo: 'ambos',
    frecuencia: 'Con instrumento validado (GAD-7)',
    organismo: 'USPSTF (recomendación de 2023)',
  },
  {
    prueba: 'Consumo de alcohol y tabaco', desde: 18, hasta: null, sexo: 'ambos',
    frecuencia: 'En cada evaluación',
    organismo: 'USPSTF',
  },
]

export interface TamizajeAplicable extends Tamizaje {
  /** true cuando la edad ya rebasó la ventana. */
  vencido: boolean
}

/** Devuelve lo que le toca a un paciente por edad y sexo. */
export function tamizajesPara(edad: number, esMujer: boolean): TamizajeAplicable[] {
  if (!(edad >= 0)) return []
  const sexoPaciente = esMujer ? 'mujer' : 'hombre'
  return TAMIZAJES
    .filter(t => t.sexo === 'ambos' || t.sexo === sexoPaciente)
    .filter(t => edad >= t.desde)
    .map(t => ({ ...t, vencido: t.hasta != null && edad > t.hasta }))
}

/** Lo que aún no toca pero está cerca (dentro de los próximos 5 años). */
export function tamizajesProximos(edad: number, esMujer: boolean): Tamizaje[] {
  if (!(edad >= 0)) return []
  const sexoPaciente = esMujer ? 'mujer' : 'hombre'
  return TAMIZAJES
    .filter(t => t.sexo === 'ambos' || t.sexo === sexoPaciente)
    .filter(t => t.desde > edad && t.desde - edad <= 5)
}

// ═══════════════════════════════════════════════════════════════════════════
// TENDENCIAS DE LABORATORIO
// ═══════════════════════════════════════════════════════════════════════════

export interface PuntoLab {
  /** Fecha ISO (YYYY-MM-DD). */
  fecha: string
  valor: number
}

export interface Tendencia {
  primero: PuntoLab
  ultimo: PuntoLab
  /** Cambio absoluto entre el primero y el último. */
  cambio: number
  /** Cambio porcentual respecto al primero. */
  cambioPct: number
  direccion: 'sube' | 'baja' | 'estable'
  /** Días entre la primera y la última medición. */
  dias: number
  /** Texto listo para leer. */
  resumen: string
}

const DIA = 86_400_000

/**
 * Analiza una serie de resultados. Ordena por fecha (no confía en que vengan
 * ordenados) y describe el cambio. Un cambio menor al 5% se considera estable
 * para no llamar "tendencia" al ruido de laboratorio.
 */
export function analizarTendencia(puntos: PuntoLab[], unidad = ''): Tendencia | null {
  const validos = puntos
    .filter(p => Number.isFinite(p.valor) && !isNaN(new Date(p.fecha + 'T00:00:00Z').getTime()))
    .sort((a, b) => a.fecha.localeCompare(b.fecha))
  if (validos.length < 2) return null

  const primero = validos[0]
  const ultimo = validos[validos.length - 1]
  const cambio = Math.round((ultimo.valor - primero.valor) * 100) / 100
  const cambioPct = primero.valor === 0 ? 0 : Math.round((cambio / Math.abs(primero.valor)) * 1000) / 10
  const dias = Math.round(
    (new Date(ultimo.fecha + 'T00:00:00Z').getTime() - new Date(primero.fecha + 'T00:00:00Z').getTime()) / DIA,
  )
  const direccion: Tendencia['direccion'] =
    Math.abs(cambioPct) < 5 ? 'estable' : cambio > 0 ? 'sube' : 'baja'

  const u = unidad ? ` ${unidad}` : ''
  const resumen = direccion === 'estable'
    ? `Estable: de ${primero.valor}${u} a ${ultimo.valor}${u} en ${dias} días (cambio de ${cambioPct}%, dentro del ruido esperable).`
    : `${direccion === 'sube' ? 'En ascenso' : 'En descenso'}: de ${primero.valor}${u} a ${ultimo.valor}${u} en ${dias} días (${cambioPct > 0 ? '+' : ''}${cambioPct}%).`

  return { primero, ultimo, cambio, cambioPct, direccion, dias, resumen }
}

/**
 * Marca los cambios que importan clínicamente aunque el porcentaje parezca
 * pequeño. La creatinina es el ejemplo clásico: subir de 0.9 a 1.4 es "solo"
 * medio punto pero significa perder buena parte de la función renal.
 */
export interface UmbralRelevante { analito: string; regla: string; evaluar: (t: Tendencia) => string | null }

export const CAMBIOS_RELEVANTES: UmbralRelevante[] = [
  {
    analito: 'Creatinina',
    regla: 'Un aumento de 0.3 mg/dL o de 50% define lesión renal aguda (KDIGO).',
    evaluar: t => (t.cambio >= 0.3 || t.cambioPct >= 50)
      ? `Aumento de ${t.cambio} mg/dL (${t.cambioPct}%): cumple criterio de lesión renal aguda por KDIGO. Revisar nefrotóxicos y estado de volumen.`
      : null,
  },
  {
    analito: 'Hemoglobina',
    regla: 'Un descenso de 2 g/dL o más obliga a buscar sangrado o hemólisis.',
    evaluar: t => t.cambio <= -2
      ? `Descenso de ${Math.abs(t.cambio)} g/dL: buscar sangrado, hemólisis o causa carencial.`
      : null,
  },
  {
    analito: 'Plaquetas',
    regla: 'Un descenso de 50% o por debajo de 150 sugiere consumo, secuestro o efecto farmacológico.',
    evaluar: t => (t.cambioPct <= -50 || t.ultimo.valor < 150)
      ? `Plaquetas en ${t.ultimo.valor} (${t.cambioPct}%): valorar consumo, secuestro esplénico, fármacos o hipertensión portal.`
      : null,
  },
  {
    analito: 'Hemoglobina glucosilada',
    regla: 'Un cambio de 0.5% o más es clínicamente significativo.',
    evaluar: t => Math.abs(t.cambio) >= 0.5
      ? `Cambio de ${t.cambio > 0 ? '+' : ''}${t.cambio}%: es un cambio clínicamente significativo, no ruido de laboratorio.`
      : null,
  },
  {
    analito: 'LDL',
    regla: 'Una reducción de 50% o más es la que pide la guía en alto riesgo; un aumento de 10% o más obliga a revisar adherencia.',
    evaluar: t => t.cambioPct <= -50
      ? `Reducción de ${Math.abs(t.cambioPct)}%: alcanza el umbral de 50% que pide la guía en alto riesgo.`
      : t.cambioPct >= 10
        ? `Aumento de ${t.cambioPct}%: revisar adherencia antes de escalar el tratamiento.`
        : null,
  },
  {
    analito: 'TFG',
    regla: 'Un descenso de 30% o más marca progresión de enfermedad renal.',
    evaluar: t => t.cambioPct <= -30
      ? `Descenso de ${Math.abs(t.cambioPct)}%: indica progresión. Reajustar dosis de todo lo que se elimine por riñón.`
      : null,
  },
]

/**
 * Cruza una tendencia con las reglas del analito y devuelve la alerta si aplica.
 *
 * Gana la coincidencia MÁS ESPECÍFICA (la de nombre más largo): "hemoglobina
 * glucosilada" contiene "hemoglobina", y sin esta regla caía en la alerta de
 * anemia en vez de en la de control glucémico.
 */
export function alertaDeTendencia(analito: string, t: Tendencia): string | null {
  const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  const q = norm(analito).trim()
  // Sin nombre (o con una o dos letras) no se adivina: el campo es texto libre y
  // al vaciarlo cualquier subcadena hacía match con la primera regla.
  if (q.length < 3) return null
  // 1) Coincidencia exacta.
  const exacta = CAMBIOS_RELEVANTES.find(r => norm(r.analito) === q)
  if (exacta) return exacta.evaluar(t)
  // 2) Reglas CONTENIDAS en la consulta: la consulta es más específica que la
  //    regla ("hemoglobina glucosilada" contiene "hemoglobina"). Gana la más larga.
  const contenidas = CAMBIOS_RELEVANTES
    .filter(r => q.includes(norm(r.analito)))
    .sort((a, b) => b.analito.length - a.analito.length)
  if (contenidas.length) return contenidas[0].evaluar(t)
  // 3) Reglas que CONTIENEN a la consulta (consulta abreviada). Gana la más corta.
  const contienen = CAMBIOS_RELEVANTES
    .filter(r => norm(r.analito).includes(q))
    .sort((a, b) => a.analito.length - b.analito.length)
  return contienen.length ? contienen[0].evaluar(t) : null
}
