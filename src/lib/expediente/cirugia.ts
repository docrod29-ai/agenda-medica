/**
 * CIRUGÍA — herramientas perioperatorias:
 *  1. ASA (estado físico) y RCRI (riesgo cardiaco, Lee).
 *  2. Caprini (riesgo de tromboembolia venosa) con la profilaxis que corresponde.
 *  3. Apfel (náusea y vómito postoperatorios).
 *  4. Profilaxis antibiótica quirúrgica CON re-dosificación intraoperatoria.
 *  5. Lista de verificación de la cirugía segura (OMS).
 *
 * Funciones PURAS y testeadas. Apoyo a la decisión: la indicación la da el médico.
 */

// ═══════════════════════════════════════════════════════════════════════════
// 1. ASA
// ═══════════════════════════════════════════════════════════════════════════

export interface ClaseASA { clase: string; titulo: string; ejemplos: string }

export const ASA: ClaseASA[] = [
  { clase: 'I', titulo: 'Paciente sano', ejemplos: 'Sin enfermedad orgánica. No fumador o consumo mínimo de alcohol.' },
  { clase: 'II', titulo: 'Enfermedad sistémica leve', ejemplos: 'Sin limitación funcional: fumador, embarazo, obesidad (IMC 30-40), diabetes o hipertensión bien controladas.' },
  { clase: 'III', titulo: 'Enfermedad sistémica grave', ejemplos: 'Con limitación funcional: diabetes o hipertensión mal controladas, EPOC, obesidad mórbida, enfermedad renal en diálisis, infarto o EVC de más de 3 meses.' },
  { clase: 'IV', titulo: 'Enfermedad sistémica grave con amenaza constante para la vida', ejemplos: 'Infarto o EVC de menos de 3 meses, isquemia cardiaca en curso, disfunción valvular grave, sepsis, coagulopatía.' },
  { clase: 'V', titulo: 'Moribundo: no se espera que sobreviva sin la cirugía', ejemplos: 'Aneurisma roto, trauma masivo, hemorragia intracraneal con efecto de masa.' },
  { clase: 'VI', titulo: 'Muerte cerebral, donador de órganos', ejemplos: 'Procuración de órganos.' },
]

/** El modificador E se agrega cuando la cirugía es de urgencia. */
export function asaTexto(clase: string, urgencia: boolean): string {
  return `ASA ${clase}${urgencia ? 'E' : ''}`
}

// ═══════════════════════════════════════════════════════════════════════════
// 2. RCRI — índice de riesgo cardiaco revisado (Lee)
// ═══════════════════════════════════════════════════════════════════════════

export const RCRI_FACTORES = [
  'Cirugía de alto riesgo (intraperitoneal, intratorácica o vascular suprainguinal)',
  'Cardiopatía isquémica',
  'Insuficiencia cardiaca',
  'Enfermedad cerebrovascular (EVC o isquemia cerebral transitoria)',
  'Diabetes en tratamiento con insulina',
  'Creatinina mayor de 2 mg/dL',
]

export interface ResultadoRCRI {
  puntaje: number
  categoria: string
  nivel: 'bajo' | 'medio' | 'alto'
  interpretacion: string
}

export function rcri(factores: number): ResultadoRCRI {
  if (factores <= 1) return {
    puntaje: factores, nivel: 'bajo', categoria: 'Riesgo bajo',
    interpretacion: 'Riesgo de evento cardiaco mayor menor al 1%. No se requieren estudios cardiacos adicionales antes de la cirugía; se procede al quirófano.',
  }
  if (factores === 2) return {
    puntaje: factores, nivel: 'medio', categoria: 'Riesgo elevado',
    interpretacion: 'Riesgo de evento cardiaco mayor por arriba del 1%. Valorar capacidad funcional: si es 4 MET o más, se procede; si es menor o desconocida, considerar prueba de esfuerzo solo si el resultado va a cambiar la conducta.',
  }
  return {
    puntaje: factores, nivel: 'alto', categoria: 'Riesgo alto',
    interpretacion: 'Riesgo cardiaco perioperatorio alto. Valoración cardiológica preoperatoria, optimización médica y decisión conjunta sobre el momento y el tipo de procedimiento.',
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 3. CAPRINI — riesgo de tromboembolia venosa
// ═══════════════════════════════════════════════════════════════════════════

export interface FactorCaprini { texto: string; puntos: 1 | 2 | 3 | 5 }

export const CAPRINI_FACTORES: FactorCaprini[] = [
  { texto: 'Edad 41 a 60 años', puntos: 1 },
  { texto: 'Cirugía menor', puntos: 1 },
  { texto: 'IMC mayor de 25', puntos: 1 },
  { texto: 'Edema de miembros inferiores', puntos: 1 },
  { texto: 'Venas varicosas', puntos: 1 },
  { texto: 'Embarazo o puerperio', puntos: 1 },
  { texto: 'Anticonceptivos orales o terapia hormonal', puntos: 1 },
  { texto: 'Sepsis en el último mes', puntos: 1 },
  { texto: 'Enfermedad pulmonar grave o neumonía en el último mes', puntos: 1 },
  { texto: 'Insuficiencia cardiaca en el último mes', puntos: 1 },
  { texto: 'Enfermedad inflamatoria intestinal', puntos: 1 },
  { texto: 'Paciente médico en reposo en cama', puntos: 1 },
  { texto: 'Edad 61 a 74 años', puntos: 2 },
  { texto: 'Cirugía artroscópica', puntos: 2 },
  { texto: 'Cirugía mayor abierta de más de 45 minutos', puntos: 2 },
  { texto: 'Cirugía laparoscópica de más de 45 minutos', puntos: 2 },
  { texto: 'Cáncer', puntos: 2 },
  { texto: 'Confinado a cama más de 72 horas', puntos: 2 },
  { texto: 'Férula o yeso inmovilizador', puntos: 2 },
  { texto: 'Acceso venoso central', puntos: 2 },
  { texto: 'Edad 75 años o más', puntos: 3 },
  { texto: 'Antecedente personal de tromboembolia venosa', puntos: 3 },
  { texto: 'Antecedente familiar de tromboembolia venosa', puntos: 3 },
  { texto: 'Trombofilia (factor V Leiden, protrombina 20210A, anticoagulante lúpico, anticardiolipinas)', puntos: 3 },
  { texto: 'Trombocitopenia inducida por heparina', puntos: 3 },
  { texto: 'Evento vascular cerebral en el último mes', puntos: 5 },
  { texto: 'Artroplastia electiva', puntos: 5 },
  { texto: 'Fractura de cadera, pelvis o extremidad inferior', puntos: 5 },
  { texto: 'Lesión medular aguda en el último mes', puntos: 5 },
  { texto: 'Politraumatismo', puntos: 5 },
]

export interface ResultadoCaprini {
  puntaje: number
  categoria: string
  nivel: 'bajo' | 'medio' | 'alto'
  profilaxis: string
}

export function caprini(puntos: number): ResultadoCaprini {
  if (puntos === 0) return {
    puntaje: 0, categoria: 'Riesgo muy bajo', nivel: 'bajo',
    profilaxis: 'Deambulación temprana. No se requiere profilaxis farmacológica ni mecánica.',
  }
  if (puntos <= 2) return {
    puntaje: puntos, categoria: 'Riesgo bajo', nivel: 'bajo',
    profilaxis: 'Profilaxis mecánica (compresión neumática intermitente) y deambulación temprana.',
  }
  if (puntos <= 4) return {
    puntaje: puntos, categoria: 'Riesgo moderado', nivel: 'medio',
    profilaxis: 'Profilaxis farmacológica (heparina de bajo peso molecular o heparina no fraccionada) o mecánica, según el riesgo de sangrado.',
  }
  return {
    puntaje: puntos, categoria: 'Riesgo alto', nivel: 'alto',
    profilaxis: 'Profilaxis farmacológica MÁS mecánica. En cirugía oncológica abdominopélvica o artroplastia, valorar profilaxis extendida de 28 a 35 días.',
  }
}

/** Suma los puntos de los factores seleccionados (por su texto). */
export function sumarCaprini(seleccionados: string[]): number {
  const set = new Set(seleccionados)
  return CAPRINI_FACTORES.filter(f => set.has(f.texto)).reduce((a, f) => a + f.puntos, 0)
}

// ═══════════════════════════════════════════════════════════════════════════
// 4. APFEL — náusea y vómito postoperatorios
// ═══════════════════════════════════════════════════════════════════════════

export const APFEL_FACTORES = [
  'Sexo femenino',
  'No fumador',
  'Antecedente de náusea o vómito postoperatorio, o de cinetosis',
  'Uso previsto de opioides en el postoperatorio',
]

export interface ResultadoApfel { puntaje: number; riesgo: number; conducta: string }

/** Riesgo aproximado de NVPO según el número de factores (Apfel). */
export function apfel(factores: number): ResultadoApfel {
  const riesgos = [10, 21, 39, 61, 79]
  const n = Math.max(0, Math.min(4, Math.round(factores)))
  const conducta =
    n <= 1 ? 'Riesgo bajo: no se requiere profilaxis de rutina, o se usa un solo antiemético.'
    : n === 2 ? 'Riesgo moderado: profilaxis con dos antieméticos de mecanismos distintos (por ejemplo dexametasona al inicio más ondansetrón al final).'
    : 'Riesgo alto: profilaxis con dos o más antieméticos y estrategia de reducción del riesgo basal (anestesia total intravenosa con propofol, evitar óxido nitroso y anestésicos halogenados, minimizar opioides, hidratación adecuada).'
  return { puntaje: n, riesgo: riesgos[n], conducta }
}

// ═══════════════════════════════════════════════════════════════════════════
// 5. PROFILAXIS ANTIBIÓTICA QUIRÚRGICA
// ═══════════════════════════════════════════════════════════════════════════

export interface AntibioticoProfilaxis {
  nombre: string
  /** Dosis del adulto. */
  dosis: string
  /** Horas entre re-dosis intraoperatorias; null cuando no se re-dosifica. */
  redosisHoras: number | null
  /** Minutos antes de la incisión en que debe iniciarse la infusión. */
  minutosAntes: number
  nota?: string
}

export const ANTIBIOTICOS_PROFILAXIS: AntibioticoProfilaxis[] = [
  { nombre: 'Cefazolina', dosis: '2 g IV (3 g si pesa 120 kg o más)', redosisHoras: 4, minutosAntes: 60 },
  { nombre: 'Cefuroxima', dosis: '1.5 g IV', redosisHoras: 4, minutosAntes: 60 },
  { nombre: 'Cefoxitina', dosis: '2 g IV', redosisHoras: 2, minutosAntes: 60 },
  { nombre: 'Ampicilina-sulbactam', dosis: '3 g IV', redosisHoras: 2, minutosAntes: 60 },
  { nombre: 'Clindamicina', dosis: '900 mg IV', redosisHoras: 6, minutosAntes: 60 },
  { nombre: 'Metronidazol', dosis: '500 mg IV', redosisHoras: null, minutosAntes: 60, nota: 'Su vida media larga hace innecesaria la re-dosis en la mayoría de las cirugías.' },
  { nombre: 'Vancomicina', dosis: '15 mg/kg IV', redosisHoras: null, minutosAntes: 120, nota: 'Se infunde en 60 a 120 minutos para evitar el síndrome del hombre rojo. Solo si hay alergia grave a betalactámicos o colonización por SARM. VERIFICAR CONTRA EL PROTOCOLO INSTITUCIONAL: no se consultó aquí un documento fuente sobre su re-dosificación intraoperatoria, y algunos protocolos sí la contemplan en cirugías prolongadas.' },
  { nombre: 'Gentamicina', dosis: '5 mg/kg IV', redosisHoras: null, minutosAntes: 60, nota: 'Dosis única basada en el peso; no se re-dosifica en el transoperatorio.' },
  { nombre: 'Ciprofloxacino', dosis: '400 mg IV', redosisHoras: 8, minutosAntes: 120, nota: 'Se infunde en 60 minutos.' },
]

export interface EsquemaCirugia { cirugia: string; esquema: string; alergia: string }

export const ESQUEMAS_POR_CIRUGIA: EsquemaCirugia[] = [
  { cirugia: 'Herniorrafia y cirugía de mama (limpia)', esquema: 'Cefazolina', alergia: 'Clindamicina o vancomicina' },
  { cirugia: 'Colecistectomía y vía biliar', esquema: 'Cefazolina', alergia: 'Clindamicina más gentamicina, o ciprofloxacino' },
  { cirugia: 'Gastroduodenal', esquema: 'Cefazolina', alergia: 'Clindamicina más gentamicina' },
  { cirugia: 'Apendicectomía no complicada', esquema: 'Cefoxitina, o cefazolina más metronidazol', alergia: 'Clindamicina más gentamicina' },
  { cirugia: 'Colorrectal', esquema: 'Cefazolina más metronidazol, o cefoxitina, o ampicilina-sulbactam', alergia: 'Clindamicina más gentamicina, o metronidazol más ciprofloxacino' },
  { cirugia: 'Cesárea', esquema: 'Cefazolina ANTES de la incisión (no después de pinzar el cordón)', alergia: 'Clindamicina más gentamicina' },
  { cirugia: 'Histerectomía', esquema: 'Cefazolina', alergia: 'Clindamicina más gentamicina' },
  { cirugia: 'Ortopedia con implante o prótesis', esquema: 'Cefazolina', alergia: 'Vancomicina o clindamicina' },
  { cirugia: 'Cardiaca y vascular', esquema: 'Cefazolina', alergia: 'Vancomicina' },
  { cirugia: 'Urología con instrumentación', esquema: 'Cefazolina, ajustada al urocultivo si lo hay', alergia: 'Gentamicina o ciprofloxacino' },
]

export interface PlanProfilaxis {
  antibiotico: string
  dosis: string
  inicio: string
  redosis: string
  duracion: string
  /** Momentos (en horas desde la incisión) en que tocaría re-dosificar. */
  momentosRedosis: number[]
  nota?: string
}

/**
 * Arma el plan de profilaxis para una cirugía de duración estimada, incluyendo
 * en qué momentos habría que re-dosificar. La re-dosis intraoperatoria es de lo
 * que más se olvida y es lo que sostiene la concentración durante todo el evento.
 */
export function planProfilaxis(ab: AntibioticoProfilaxis, duracionHoras: number): PlanProfilaxis {
  const momentos: number[] = []
  if (ab.redosisHoras && duracionHoras > ab.redosisHoras) {
    for (let t = ab.redosisHoras; t < duracionHoras; t += ab.redosisHoras) momentos.push(t)
  }
  return {
    antibiotico: ab.nombre,
    dosis: ab.dosis,
    inicio: `Iniciar la infusión dentro de los ${ab.minutosAntes} minutos previos a la incisión.`,
    redosis: ab.redosisHoras == null
      ? 'Sin intervalo de re-dosis intraoperatoria cargado en la herramienta; verificar el protocolo institucional en cirugías prolongadas.'
      : momentos.length === 0
        ? `Re-dosis cada ${ab.redosisHoras} h; con la duración estimada no se alcanza el primer intervalo.`
        : `Re-dosis cada ${ab.redosisHoras} h: a las ${momentos.join(' h, a las ')} h de la incisión. También re-dosificar si la pérdida sanguínea supera 1 500 mL.`,
    duracion: 'Suspender al cerrar la herida. NO prolongar la profilaxis más allá de 24 horas: no reduce la infección de sitio quirúrgico y sí aumenta la resistencia y el riesgo de colitis por Clostridioides difficile.',
    momentosRedosis: momentos,
    nota: ab.nota,
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 6. LISTA DE VERIFICACIÓN DE LA CIRUGÍA SEGURA (OMS)
// ═══════════════════════════════════════════════════════════════════════════

export interface FaseChecklist { fase: string; momento: string; puntos: string[] }

export const CHECKLIST_OMS: FaseChecklist[] = [
  {
    fase: 'Entrada',
    momento: 'Antes de la inducción anestésica',
    puntos: [
      'El paciente confirmó su identidad, el sitio, el procedimiento y su consentimiento',
      'El sitio quirúrgico está marcado, o no aplica',
      'Se completó la verificación del equipo de anestesia y de los medicamentos',
      'El pulsioxímetro está colocado y funcionando',
      '¿El paciente tiene alergias conocidas?',
      '¿Hay vía aérea difícil o riesgo de broncoaspiración? Si sí, hay equipo y ayuda disponibles',
      '¿Hay riesgo de pérdida sanguínea mayor de 500 mL (7 mL/kg en niños)? Si sí, hay accesos y líquidos preparados',
    ],
  },
  {
    fase: 'Pausa quirúrgica',
    momento: 'Antes de la incisión en la piel',
    puntos: [
      'Todo el equipo se presentó por su nombre y su función',
      'Se confirmaron en voz alta el paciente, el sitio y el procedimiento',
      'El cirujano anticipa los pasos críticos, la duración y la pérdida sanguínea esperada',
      'El anestesiólogo anticipa aspectos críticos del paciente',
      'El equipo de enfermería confirmó la esterilidad y que no hay problemas con el instrumental',
      '¿Se administró la profilaxis antibiótica en los últimos 60 minutos?',
      '¿Se requieren estudios de imagen? Están desplegados',
    ],
  },
  {
    fase: 'Salida',
    momento: 'Antes de que el paciente salga del quirófano',
    puntos: [
      'La enfermera confirmó en voz alta el nombre del procedimiento registrado',
      'El conteo de gasas, compresas, agujas e instrumental es correcto',
      'Las muestras están etiquetadas con el nombre del paciente',
      '¿Hubo problemas con el instrumental o el equipo que deban resolverse?',
      'El cirujano, el anestesiólogo y la enfermería revisaron los aspectos clave de la recuperación y del manejo postoperatorio',
    ],
  },
]
