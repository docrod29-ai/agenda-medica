/**
 * PLANES que vende el dueño, por NIVEL DE IA + ALCANCE (límites).
 *
 * Fuente ÚNICA de verdad de precios, límites y qué incluye cada plan. Cambia los
 * números aquí y se reflejan en la app (candado de gasto, gates de funciones,
 * página de precios). El plan de un consultorio = su `nivelIA` (pro | premium).
 *
 * Regla de negocio (recomendada):
 *  · Evidencia (PubMed) en AMBOS — PubMed es gratis, casi no cuesta.
 *  · Opus 4.8 + 2ª opinión AUTOMÁTICA solo en Premium (lo caro).
 *  · El LÍMITE de consultas/mes es lo que controla el costo del dueño.
 */
import type { NivelIA } from './ai-keys'

export interface PlanIA {
  clave: 'basico' | 'premium'
  nombre: string
  nivelIA: NivelIA
  precioMXN: number
  /** Notas finales de IA incluidas al mes (el borrador en vivo NO cuenta). */
  limiteConsultas: number
  /** Pacientes máximos (null = ilimitados). */
  pacientesMax: number | null
  /** La 2ª opinión (GPT-5) corre sola tras cada nota (si no, es botón a demanda). */
  segundaOpinionAuto: boolean
  /** Análisis basado en evidencia (PubMed). */
  evidencia: boolean
  soportePrioritario: boolean
}

export const PLANES_IA: Record<NivelIA, PlanIA> = {
  pro: {
    clave: 'basico', nombre: 'Básico', nivelIA: 'pro',
    precioMXN: 549, limiteConsultas: 60, pacientesMax: 150,
    segundaOpinionAuto: false, evidencia: true, soportePrioritario: false,
  },
  premium: {
    clave: 'premium', nombre: 'Premium', nivelIA: 'premium',
    precioMXN: 1299, limiteConsultas: 250, pacientesMax: null,
    segundaOpinionAuto: true, evidencia: true, soportePrioritario: true,
  },
}

export const planDeNivel = (nivel: NivelIA): PlanIA => PLANES_IA[nivel] ?? PLANES_IA.pro

/** Estado de uso vs límite para el candado de gasto (soft). */
export interface EstadoUso {
  usadas: number
  limite: number
  restantes: number
  porcentaje: number      // 0–100+ (puede pasar de 100)
  alerta: 'ok' | 'cerca' | 'excedido'   // cerca ≥80%, excedido ≥100%
}

export function estadoUso(usadas: number, limite: number): EstadoUso {
  const pct = limite > 0 ? Math.round((usadas / limite) * 100) : 0
  return {
    usadas, limite,
    restantes: Math.max(0, limite - usadas),
    porcentaje: pct,
    alerta: pct >= 100 ? 'excedido' : pct >= 80 ? 'cerca' : 'ok',
  }
}
