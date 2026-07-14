/**
 * Datos y guion del SANDBOX INTERACTIVO (/demo/interactivo).
 *
 * Todo es FICTICIO y determinista: no hay pacientes reales, ni PHI, ni llamadas
 * a IA/Firestore/red. La "transcripción" y la "nota" están pre-escritas; el
 * sandbox solo las revela por pasos para mostrar el flujo real de la app sin
 * ejecutar nada de backend. Se etiqueta siempre como demostración.
 *
 * Módulo PURO (sin React ni DOM) para poder probarlo en aislamiento.
 */

export interface DemoMedicamento {
  nombre: string
  indicacion: string
}

export interface DemoCita {
  hora: string
  /** Iniciales ficticias — nunca un nombre real de paciente. */
  iniciales: string
  edad: number
  sexo: 'M' | 'F'
  motivo: string
  color: string
}

export interface DemoEscenario {
  cita: DemoCita
  /** Dictado ficticio, dividido en fragmentos para revelar por pasos. */
  dictado: string[]
  /** Nota estructurada resultante (S/O/A/P) — pre-escrita, no generada. */
  nota: { seccion: string; texto: string }[]
  diagnostico: string
  medicamentos: DemoMedicamento[]
  folio: string
}

export const DEMO_ESCENARIOS: DemoEscenario[] = [
  {
    cita: { hora: '09:00', iniciales: 'M. F.', edad: 54, sexo: 'F', motivo: 'Control de hipertensión', color: '#3D5AFE' },
    dictado: [
      'Paciente femenino de 54 años que acude a control de hipertensión arterial.',
      'Refiere buen apego al tratamiento, sin cefalea ni mareo.',
      'A la exploración, tensión arterial 138 sobre 84, frecuencia cardiaca 72, sin edema.',
      'Continúo con losartán y agrego recomendación de dieta baja en sodio.',
    ],
    nota: [
      { seccion: 'Subjetivo', texto: 'Femenino de 54 años en control de HTA. Buen apego al tratamiento. Niega cefalea, mareo o disnea.' },
      { seccion: 'Objetivo', texto: 'TA 138/84 mmHg · FC 72 lpm · sin edema periférico. Resto de la exploración sin datos relevantes.' },
      { seccion: 'Análisis', texto: 'Hipertensión arterial esencial en control aceptable (I10).' },
      { seccion: 'Plan', texto: 'Continuar losartán 50 mg c/24 h. Dieta hiposódica. Cita de control en 4 semanas con toma de TA en casa.' },
    ],
    diagnostico: 'Hipertensión arterial esencial (I10)',
    medicamentos: [
      { nombre: 'Losartán 50 mg', indicacion: '1 tableta cada 24 horas' },
      { nombre: 'Dieta hiposódica', indicacion: 'Reducir sal; caminata 30 min/día' },
    ],
    folio: 'RX-DEMO-A1',
  },
  {
    cita: { hora: '10:30', iniciales: 'J. R.', edad: 38, sexo: 'M', motivo: 'Odinofagia', color: '#16a34a' },
    dictado: [
      'Masculino de 38 años con dolor de garganta de dos días de evolución.',
      'Refiere fiebre de 38.5 grados y dificultad para deglutir.',
      'A la exploración, faringe hiperémica con exudado amigdalino, adenopatías cervicales dolorosas.',
      'Impresión de faringoamigdalitis probablemente bacteriana; inicio antibiótico y sintomático.',
    ],
    nota: [
      { seccion: 'Subjetivo', texto: 'Masculino de 38 años con odinofagia de 2 días, fiebre 38.5 °C y disfagia. Sin tos.' },
      { seccion: 'Objetivo', texto: 'Faringe hiperémica con exudado amigdalino bilateral. Adenopatías cervicales anteriores dolorosas.' },
      { seccion: 'Análisis', texto: 'Faringoamigdalitis aguda, criterios de Centor sugerentes de etiología bacteriana (J03.9).' },
      { seccion: 'Plan', texto: 'Amoxicilina 500 mg c/8 h por 7 días. Paracetamol para fiebre/dolor. Reposo e hidratación. Signos de alarma explicados.' },
    ],
    diagnostico: 'Faringoamigdalitis aguda (J03.9)',
    medicamentos: [
      { nombre: 'Amoxicilina 500 mg', indicacion: '1 cápsula cada 8 horas por 7 días' },
      { nombre: 'Paracetamol 500 mg', indicacion: '1 tableta cada 8 horas si fiebre o dolor' },
    ],
    folio: 'RX-DEMO-B2',
  },
]

/** Pasos del sandbox, en orden. */
export const DEMO_PASOS = ['agenda', 'dictado', 'nota', 'receta'] as const
export type DemoPaso = typeof DEMO_PASOS[number]

/** Devuelve el siguiente paso, o el mismo si ya es el último. */
export function siguientePaso(paso: DemoPaso): DemoPaso {
  const i = DEMO_PASOS.indexOf(paso)
  return DEMO_PASOS[Math.min(i + 1, DEMO_PASOS.length - 1)]
}

/** El dictado revelado hasta `n` fragmentos, unido como texto corrido. */
export function dictadoHasta(escenario: DemoEscenario, n: number): string {
  return escenario.dictado.slice(0, Math.max(0, Math.min(n, escenario.dictado.length))).join(' ')
}

/** ¿Ya se reveló todo el dictado? */
export function dictadoCompleto(escenario: DemoEscenario, n: number): boolean {
  return n >= escenario.dictado.length
}
