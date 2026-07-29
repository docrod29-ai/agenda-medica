/**
 * FIXTURES de `ClinicalFact` (Nexus OS E1-01).
 *
 * DATOS 100% SINTÉTICOS. Pacientes ficticios (`pac_demo_*`), consultorio ficticio
 * (`clinic_demo`), uids ficticios. NUNCA PHI real — regla 2 de la carta operativa.
 *
 * Están en forma CRUDA (como llegan de Firestore o de HL7: `unidad` y `dimension`
 * son strings sueltos), porque lo que hay que probar es precisamente el paso de
 * `unknown` a `ClinicalFact`. Construirlos ya tipados escondería el trabajo.
 */

export const CLINICA = 'clinic_demo'
export const PACIENTE = 'pac_demo_1'

/** Base reutilizable: todo hecho válido comparte estos campos. */
const base = {
  clinicId: CLINICA,
  pacienteId: PACIENTE,
  estado: 'final',
  certeza: 'confirmed',
  observedAt: '2026-07-28T09:15:00Z',
} as const

/** Cantidad — lo que llega de un laboratorio. Procedencia externa. */
export const HECHO_CANTIDAD = {
  ...base,
  id: 'fact_demo_creatinina',
  concepto: { clave: 'creatinina', etiqueta: 'Creatinina' },
  valor: { clase: 'cantidad', cantidad: { valor: 1.2, unidad: 'mg/dL', dimension: 'concentracion_masa' } },
  fuente: { tipo: 'laboratorio', documentoId: 'lab_demo_1' },
  procedencia: { origen: 'externo', registradoEn: '2026-07-28T10:00:00Z', sistema: 'LIS-DEMO', mensajeId: 'msg_demo_1' },
}

/** Código — un diagnóstico. Procedencia humana. */
export const HECHO_CODIGO = {
  ...base,
  id: 'fact_demo_dx',
  concepto: { clave: 'diagnostico' },
  valor: { clase: 'codigo', concepto: { clave: 'ivu', etiqueta: 'Infección de vías urinarias', codigo: { sistema: 'CIE-10', codigo: 'N39.0' } } },
  fuente: { tipo: 'nota', documentoId: 'nota_demo_1', citaTextual: 'refiere disuria de tres días' },
  procedencia: { origen: 'humano', registradoEn: '2026-07-28T09:20:00Z', autor: { uid: 'uid_demo_medico', nombre: 'Dra. Demo', rol: 'medico' } },
}

/** Booleano — presencia/ausencia. Procedencia de IA (con revisión humana). */
export const HECHO_BOOLEANO = {
  ...base,
  id: 'fact_demo_fiebre',
  concepto: { clave: 'fiebre' },
  valor: { clase: 'booleano', presente: true },
  fuente: { tipo: 'dictado', documentoId: 'audio_demo_1', citaTextual: 'lleva dos días con fiebre' },
  procedencia: {
    origen: 'ia',
    registradoEn: '2026-07-28T09:21:00Z',
    autor: { uid: 'uid_demo_medico', rol: 'medico' },
    modelo: 'modelo-demo',
    promptVersion: 'v1-demo',
    revisadoPorHumano: true,
  },
}

/** Texto — narrativo de verdad. `num('120/80')` es null, así que NO es un número disfrazado. */
export const HECHO_TEXTO = {
  ...base,
  id: 'fact_demo_ta',
  concepto: { clave: 'tension_arterial_texto' },
  valor: { clase: 'texto', texto: '120/80' },
  fuente: { tipo: 'signos' },
  procedencia: { origen: 'humano', registradoEn: '2026-07-28T09:16:00Z', autor: { uid: 'uid_demo_enfermeria', rol: 'enfermeria' } },
}

/** Derivado por un motor determinista, con su versión (invariante 5 del programa). */
export const HECHO_MOTOR = {
  ...base,
  id: 'fact_demo_tfg',
  certeza: 'inferred',
  concepto: { clave: 'tfg' },
  valor: { clase: 'cantidad', cantidad: { valor: 62, unidad: 'mL/min/1.73m²', dimension: 'depuracion_indexada' } },
  fuente: { tipo: 'laboratorio', documentoId: 'lab_demo_1' },
  procedencia: { origen: 'motor', registradoEn: '2026-07-28T10:01:00Z', engineId: 'ckd-epi-2021', engineVersion: '1.0.0' },
}

/** Corrección: NO se edita el hecho anterior, se anexa este apuntando a él. */
export const HECHO_CORREGIDO = {
  ...HECHO_CANTIDAD,
  id: 'fact_demo_creatinina_v2',
  estado: 'corregido',
  valor: { clase: 'cantidad', cantidad: { valor: 2.1, unidad: 'mg/dL', dimension: 'concentracion_masa' } },
  supersedes: { factId: 'fact_demo_creatinina', efecto: 'sustituye', motivo: 'el laboratorio reemitió el resultado' },
}

/** Hecho con ventana de vigencia cerrada (un tratamiento que ya terminó). */
export const HECHO_CON_VIGENCIA = {
  ...HECHO_BOOLEANO,
  id: 'fact_demo_fiebre_ventana',
  validFrom: '2026-07-26T00:00:00Z',
  validTo: '2026-07-28T12:00:00Z',
}

/** Todos los hechos VÁLIDOS: cubren las 4 variantes de valor y las 4 de procedencia. */
export const HECHOS_VALIDOS = [
  HECHO_CANTIDAD,
  HECHO_CODIGO,
  HECHO_BOOLEANO,
  HECHO_TEXTO,
  HECHO_MOTOR,
  HECHO_CORREGIDO,
  HECHO_CON_VIGENCIA,
]

/** Clona quitando una llave de primer nivel (para los casos «sin X»). */
export function sin<T extends object>(o: T, llave: keyof T): Omit<T, keyof T> {
  const copia = { ...o }
  delete copia[llave]
  return copia
}
