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

// NEEDS_CLINICAL_REVIEW: los dos guiones omiten datos de prescripción.
// El médico debe aclararlos; la demo muestra borradores, nunca los completa.
export const DEMO_ESCENARIOS: DemoEscenario[] = [
  {
    cita: { hora: '09:00', iniciales: 'M. F.', edad: 54, sexo: 'F', motivo: 'Control de hipertensión', color: 'var(--nexus)' },
    dictado: [
      'Paciente femenino de 54 años que acude a control de hipertensión arterial.',
      'Refiere buen apego al tratamiento, sin cefalea ni mareo.',
      'A la exploración, tensión arterial 138 sobre 84, frecuencia cardiaca 72, sin edema.',
      'Continúo con losartán y agrego recomendación de dieta baja en sodio.',
    ],
    nota: [
      { seccion: 'Subjetivo', texto: 'Femenino de 54 años en control de HTA. Buen apego al tratamiento. Niega cefalea y mareo.' },
      { seccion: 'Objetivo', texto: 'TA 138/84 mmHg · FC 72 lpm · sin edema.' },
      { seccion: 'Análisis', texto: 'Hipertensión arterial en seguimiento.' },
      { seccion: 'Plan', texto: 'Continuar losartán. Recomendar dieta baja en sodio. Dosis, vía y frecuencia no dictadas: por confirmar con el médico antes de emitir la receta.' },
    ],
    diagnostico: 'Hipertensión arterial',
    medicamentos: [
      { nombre: 'Losartán', indicacion: 'Dosis, vía y frecuencia por confirmar con el médico.' },
    ],
    folio: 'RX-DEMO-A1',
  },
  {
    cita: { hora: '10:30', iniciales: 'J. R.', edad: 38, sexo: 'M', motivo: 'Odinofagia', color: 'var(--green)' },
    dictado: [
      'Masculino de 38 años con dolor de garganta de dos días de evolución.',
      'Refiere fiebre de 38.5 grados y dificultad para deglutir.',
      'A la exploración, faringe hiperémica con exudado amigdalino, adenopatías cervicales dolorosas.',
      'Impresión de faringoamigdalitis probablemente bacteriana; inicio antibiótico y sintomático.',
    ],
    nota: [
      { seccion: 'Subjetivo', texto: 'Masculino de 38 años con odinofagia de 2 días, fiebre referida de 38.5 °C y dificultad para deglutir.' },
      { seccion: 'Objetivo', texto: 'Faringe hiperémica con exudado amigdalino. Adenopatías cervicales dolorosas.' },
      { seccion: 'Análisis', texto: 'Impresión dictada: faringoamigdalitis probablemente bacteriana.' },
      { seccion: 'Plan', texto: 'Se dicta inicio de antibiótico y tratamiento sintomático, sin identificar fármacos ni esquemas. Por confirmar con el médico antes de emitir la receta.' },
    ],
    diagnostico: 'Faringoamigdalitis probablemente bacteriana',
    medicamentos: [],
    folio: 'RX-DEMO-B2',
  },
]

/** Pasos del sandbox, en orden. */
export const DEMO_PASOS = ['agenda', 'dictado', 'nota', 'receta', 'modulos'] as const
export type DemoPaso = typeof DEMO_PASOS[number]

/** Guion del bot de WhatsApp para el explorador interactivo (ficticio). */
export interface TurnoBot {
  /** Opción que toca el visitante para llegar aquí (vacío = inicio). */
  eligio?: string
  /** Lo que responde el bot. */
  bot: string
  /** Opciones que se le ofrecen al visitante. */
  opciones: string[]
}
export const DEMO_WHATSAPP: Record<string, TurnoBot> = {
  inicio: { bot: '¡Hola! Soy el asistente del Dr. ¿Qué deseas hacer?', opciones: ['Agendar cita', 'Ver mis citas'] },
  'Agendar cita': { eligio: 'Agendar cita', bot: '¡Claro! Tengo estos horarios el martes:', opciones: ['10:00', '12:30'] },
  '10:00': { eligio: '10:00', bot: '✅ Listo, tu cita quedó el martes 10:00. Te recuerdo un día antes. ¿Algo más?', opciones: ['Reiniciar'] },
  '12:30': { eligio: '12:30', bot: '✅ Listo, tu cita quedó el martes 12:30. Te recuerdo un día antes. ¿Algo más?', opciones: ['Reiniciar'] },
  'Ver mis citas': { eligio: 'Ver mis citas', bot: 'Tienes 1 cita: martes 10:00 con el Dr. ¿Deseas algo más?', opciones: ['Agendar cita', 'Reiniciar'] },
}

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
