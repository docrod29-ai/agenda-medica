/**
 * PLANES por CRÉDITOS (modelo tipo Asclepius) — fuente ÚNICA de verdad.
 *
 * Idea: cada plan da N CRÉDITOS de IA al mes. Cada acción de IA cuesta créditos
 * según su costo real (una nota con Opus cuesta más que una con Sonnet; separar
 * voces cuesta extra). Cuando se acaban los créditos, la IA se PAUSA (tope duro,
 * para que el gasto del dueño nunca se dispare) — pero el médico puede COMPRAR
 * más créditos o subir de plan. El resto de la app (agenda, expediente manual)
 * sigue funcionando.
 *
 * 1 crédito ≈ 1 consulta con IA "Pro" (voz + nota Sonnet). Cambia los números
 * aquí y se reflejan en toda la app (tope, gates, página de precios).
 *
 * Costos aprox del dueño (USD) por acción — para calcular márgenes:
 *   voz(OpenAI)~$0.06 · diarización(AssemblyAI)~$0.15 · nota Sonnet~$0.08 ·
 *   nota Opus+thinking~$0.60 · verificación GPT-5~$0.04 · evidencia~$0.03
 */
import type { NivelIA } from './ai-keys'

export type ClavePlan = 'agenda' | 'clinica' | 'premium' | 'hospital'

export interface PlanCreditos {
  clave: ClavePlan
  nombre: string
  precioMXN: number
  /** Créditos de IA incluidos al mes (0 = plan sin IA). */
  creditos: number
  /** Nivel de IA para la nota: 'pro' (Sonnet) o 'premium' (Opus+GPT-5). */
  nivelIA: NivelIA
  /** Módulos/funciones incluidas (para la página de precios y los gates). */
  incluye: string[]
  /** Pacientes máximos (null = ilimitado). */
  pacientesMax: number | null
  destacado?: boolean
}

/**
 * COSTO EN CRÉDITOS por acción de IA. La "nota" incluye su transcripción de voz.
 * Ajusta si cambias precios/proveedores.
 */
export const COSTO_CREDITOS = {
  notaPro: 1,          // nota con Sonnet 5
  notaPremium: 3,      // nota con Opus 4.8 + thinking
  diarizacion: 1,      // separar médico/paciente (AssemblyAI) — se suma a la nota
  segundaOpinion: 1,   // verificación GPT-5
  evidencia: 1,        // una pregunta al Consultor / análisis de evidencia
} as const

export const PLANES: Record<ClavePlan, PlanCreditos> = {
  agenda: {
    clave: 'agenda', nombre: 'Agenda', precioMXN: 299, creditos: 0, nivelIA: 'pro',
    pacientesMax: null,
    incluye: [
      'Agenda y citas ilimitadas',
      'Recordatorios por WhatsApp',
      'Expediente básico de pacientes',
      'Portal del paciente',
      'Sin IA de voz/notas (se puede subir de plan)',
    ],
  },
  clinica: {
    clave: 'clinica', nombre: 'Clínica', precioMXN: 799, creditos: 80, nivelIA: 'pro',
    pacientesMax: null, destacado: true,
    incluye: [
      'Todo lo de Agenda',
      'Nota clínica con IA (voz → nota, NOM-004)',
      'Separación médico-paciente automática',
      'Recetas y órdenes',
      'Consultor de evidencia (PubMed) y análisis con citas',
      'Segunda opinión de IA a demanda',
      '80 consultas con IA al mes',
    ],
  },
  premium: {
    clave: 'premium', nombre: 'Premium', precioMXN: 1499, creditos: 150, nivelIA: 'premium',
    pacientesMax: null,
    incluye: [
      'Todo lo de Clínica',
      'IA de máximo razonamiento (Opus 4.8 + thinking)',
      'Segunda opinión GPT-5 AUTOMÁTICA en cada nota',
      '150 créditos al mes (≈50 consultas premium o 150 básicas)',
      'Soporte prioritario',
    ],
  },
  // Plan APARTE: hospitalización. El producto estrella es el de consultorio
  // (Clínica); Hospital es para quien maneja internamiento y se cobra por su lado.
  hospital: {
    clave: 'hospital', nombre: 'Hospital', precioMXN: 1999, creditos: 150, nivelIA: 'premium',
    pacientesMax: null,
    incluye: [
      'Módulo de Hospitalización completo',
      'Censo, tablero de camas y traslados',
      'Indicaciones/MAR, signos y gráficas (NEWS2)',
      'Notas de ingreso, evolución, egreso, postop y anestesia',
      'Interconsultas y laboratorio',
      'Nota con IA de máximo nivel (Opus) · 150 créditos/mes',
    ],
  },
}

export const planPorClave = (c: ClavePlan): PlanCreditos => PLANES[c] ?? PLANES.clinica
export const planPorNivel = (n: NivelIA): PlanCreditos => (n === 'premium' ? PLANES.premium : PLANES.clinica)

/** Paquete de recarga de créditos (top-up) cuando se acaban. */
export const RECARGA = { creditos: 40, precioMXN: 399 }

/** Estado de créditos para el tope de gasto. */
export interface EstadoCreditos {
  usados: number
  incluidos: number
  extra: number          // créditos comprados (top-up) disponibles
  restantes: number
  porcentaje: number
  alerta: 'ok' | 'cerca' | 'agotado'
}

export function estadoCreditos(usados: number, incluidos: number, extra = 0): EstadoCreditos {
  const total = incluidos + extra
  const restantes = Math.max(0, total - usados)
  const pct = total > 0 ? Math.round((usados / total) * 100) : 100
  return {
    usados, incluidos, extra, restantes, porcentaje: pct,
    alerta: restantes <= 0 ? 'agotado' : pct >= 80 ? 'cerca' : 'ok',
  }
}

// ── COMPAT con el modelo anterior (2 planes por nivelIA) ────────────────
// Mantiene funcionando procesar / superadmin / el banner de la consulta sin
// tocarlos mientras se migra al modelo de créditos.
export interface PlanIA {
  clave: 'basico' | 'premium'; nombre: string; nivelIA: NivelIA; precioMXN: number
  limiteConsultas: number; pacientesMax: number | null
  segundaOpinionAuto: boolean; evidencia: boolean; soportePrioritario: boolean
}
export const PLANES_IA: Record<NivelIA, PlanIA> = {
  pro: {
    clave: 'basico', nombre: PLANES.clinica.nombre, nivelIA: 'pro', precioMXN: PLANES.clinica.precioMXN,
    limiteConsultas: PLANES.clinica.creditos, pacientesMax: PLANES.clinica.pacientesMax,
    segundaOpinionAuto: false, evidencia: true, soportePrioritario: false,
  },
  premium: {
    clave: 'premium', nombre: PLANES.premium.nombre, nivelIA: 'premium', precioMXN: PLANES.premium.precioMXN,
    limiteConsultas: PLANES.premium.creditos, pacientesMax: PLANES.premium.pacientesMax,
    segundaOpinionAuto: true, evidencia: true, soportePrioritario: true,
  },
}
export const planDeNivel = (n: NivelIA): PlanIA => PLANES_IA[n] ?? PLANES_IA.pro

export interface EstadoUso { usadas: number; limite: number; restantes: number; porcentaje: number; alerta: 'ok' | 'cerca' | 'excedido' }
export function estadoUso(usadas: number, limite: number): EstadoUso {
  const pct = limite > 0 ? Math.round((usadas / limite) * 100) : 0
  return { usadas, limite, restantes: Math.max(0, limite - usadas), porcentaje: pct, alerta: pct >= 100 ? 'excedido' : pct >= 80 ? 'cerca' : 'ok' }
}
