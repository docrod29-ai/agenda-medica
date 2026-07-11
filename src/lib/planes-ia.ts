/**
 * PLANES por CRÉDITOS (modelo tipo Asclepius) — fuente ÚNICA de verdad.
 *
 * Idea: cada plan da N CRÉDITOS de IA "máxima" al mes (nota Opus/GPT-5 +
 * separación de voces). Cuando se acaban, la IA NO se detiene: baja sola a un
 * modo ECONÓMICO (nota Sonnet 5 — excelente y baratísima, sin diarización ni 2ª
 * opinión GPT) que casi no cuesta al dueño. El médico nunca se queda sin IA, y si
 * quiere recuperar la máxima COMPRA más créditos o sube de plan. Así el gasto del
 * dueño se controla sin bloquear al médico con el paciente enfrente.
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
 * MENÚ DE IA (modelo OpenAI/Anthropic): cada nota se genera con uno de 3 MOTORES,
 * y cada motor QUEMA créditos distintos según su costo real. La clave del margen:
 * los créditos son proporcionales al costo, así que 1 crédito te cuesta ~lo mismo
 * (~$1.5 MXN) sin importar el motor → vendiéndolos a ~$5/crédito ganas ~70% en
 * CADA nota, elija lo que elija el médico. Imposible perder.
 *
 *   ⚡ Rápida   (Haiku 4.5)                    → 1 crédito  · te cuesta ~$1.4 MXN
 *   ⭐ Estándar (Sonnet 5 + separación voces)  → 3 créditos · ~$5.2 MXN
 *   💎 Máxima   (Opus 4.8 + GPT-5 + 2ª opinión)→ 10 créditos· ~$15.3 MXN
 */
export type ClaveMotor = 'rapida' | 'estandar' | 'maxima'
export interface Motor {
  clave: ClaveMotor
  nombre: string
  emoji: string
  modelos: string
  /** Créditos que quema una nota con este motor. */
  creditos: number
  /** Perfil de modelo en procesar (live=Haiku, pro=Sonnet, premium=Opus). */
  perfil: 'live' | 'pro' | 'premium'
}
export const MOTORES: Record<ClaveMotor, Motor> = {
  rapida:   { clave: 'rapida',   nombre: 'Rápida',   emoji: '⚡', modelos: 'Haiku 4.5',                   creditos: 1,  perfil: 'live' },
  estandar: { clave: 'estandar', nombre: 'Estándar', emoji: '⭐', modelos: 'Sonnet 5 + separación de voces', creditos: 3,  perfil: 'pro' },
  maxima:   { clave: 'maxima',   nombre: 'Máxima',   emoji: '💎', modelos: 'Opus 4.8 + GPT-5 + 2ª opinión', creditos: 10, perfil: 'premium' },
}
export const motorPorClave = (c?: string): Motor => MOTORES[(c as ClaveMotor)] ?? MOTORES.estandar
/** Motor por defecto según el nivel del plan: Pro/Premium → Máxima; Clínica → Estándar. */
export const motorPorDefecto = (n: NivelIA): Motor => (n === 'premium' ? MOTORES.maxima : MOTORES.estandar)

/**
 * COSTO EN CRÉDITOS de acciones que NO son la nota. El Consultor de evidencia
 * (doble cerebro Claude+GPT) es ligero; gasta del MISMO bote pero poco.
 */
export const COSTO_CREDITOS = {
  consultorPro: 0.5,     // pregunta al Consultor con IA Pro (Sonnet 5 + GPT-4o)
  consultorPremium: 1,   // pregunta al Consultor con IA Premium (Opus 4.8 + GPT-5)
} as const

/** Cuántos créditos cuesta una pregunta al Consultor según el nivel de IA del plan. */
export const costoConsultor = (n: NivelIA): number =>
  n === 'premium' ? COSTO_CREDITOS.consultorPremium : COSTO_CREDITOS.consultorPro

export const PLANES: Record<ClavePlan, PlanCreditos> = {
  agenda: {
    clave: 'agenda', nombre: 'Agenda', precioMXN: 349, creditos: 0, nivelIA: 'pro',
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
    clave: 'clinica', nombre: 'Clínica', precioMXN: 899, creditos: 160, nivelIA: 'pro',
    pacientesMax: null, destacado: true,
    incluye: [
      'Todo lo de Agenda',
      'Nota clínica con IA (voz → nota, NOM-004)',
      'Separación médico-paciente automática',
      'Recetas y órdenes',
      'Consultor de evidencia (PubMed) con doble IA (Claude + GPT)',
      'Menú de IA: elige ⚡ Rápida · ⭐ Estándar · 💎 Máxima por nota',
      '160 créditos/mes (~50 notas Estándar)',
      'Al agotarlos NO se detiene: sigue en ⚡ Rápida gratis o compra más',
    ],
  },
  premium: {
    clave: 'premium', nombre: 'Pro', precioMXN: 1899, creditos: 450, nivelIA: 'premium',
    pacientesMax: null,
    incluye: [
      'Todo lo de Clínica',
      'IA de máximo razonamiento por defecto (💎 Opus 4.8 + GPT-5)',
      'Segunda opinión GPT-5 AUTOMÁTICA en cada nota',
      'Consultor de evidencia con Opus 4.8 + GPT-5',
      '450 créditos/mes (~45 notas Máxima o ~150 Estándar)',
      'Al agotarlos sigue en ⚡ Rápida gratis — nunca te quedas sin IA',
      'Soporte prioritario',
    ],
  },
  // Plan APARTE: hospitalización. El producto estrella es el de consultorio
  // (Clínica); Hospital es para quien maneja internamiento y se cobra por su lado.
  hospital: {
    clave: 'hospital', nombre: 'Hospital', precioMXN: 2900, creditos: 400, nivelIA: 'premium',
    pacientesMax: null,
    incluye: [
      'Módulo de Hospitalización completo',
      'Censo, tablero de camas y traslados',
      'Indicaciones/MAR, signos y gráficas (NEWS2)',
      'Notas de ingreso, evolución, egreso, postop y anestesia',
      'Interconsultas y laboratorio',
      'Menú de IA completo · 400 créditos/mes',
      'Al agotarlos sigue en ⚡ Rápida gratis — nunca se detiene',
    ],
  },
}

export const planPorClave = (c: ClavePlan): PlanCreditos => PLANES[c] ?? PLANES.clinica
export const planPorNivel = (n: NivelIA): PlanCreditos => (n === 'premium' ? PLANES.premium : PLANES.clinica)

/** Paquete de recarga de créditos (top-up) cuando se acaban. Te cuestan ~$150 → +$249 limpio. */
export const RECARGA = { creditos: 100, precioMXN: 399 }

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
