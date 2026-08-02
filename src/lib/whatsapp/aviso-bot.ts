/**
 * EL AVISO DE PRIVACIDAD EN EL CANAL DONDE NO EXISTÍA.
 *
 * ── EL HUECO ─────────────────────────────────────────────────────────────────
 *
 * El portal público **exige** el consentimiento antes de crear la cita: sin
 * `consentimientos.avisoPrivacidad` la ruta responde 400, y lo que se acepta
 * queda guardado en la cita con su marca de tiempo.
 *
 * El bot de WhatsApp crea el expediente del paciente y su cita **sin aviso
 * ninguno**: el paciente nunca lo ve y no queda constancia de nada. Y por
 * WhatsApp entra una parte grande de los pacientes.
 *
 * Son datos de SALUD —sensibles— recogidos por un canal externo. La misma
 * aplicación que bloquea el alta web por falta de consentimiento la dejaba pasar
 * por aquí.
 *
 * ── LO QUE ESTE MÓDULO HACE Y LO QUE NO ──────────────────────────────────────
 *
 * Arma el mensaje y decide si la respuesta es una aceptación EXPRESA. No decide
 * qué exige la ley: se pide un «SÍ» explícito, que es más de lo que se pediría
 * si bastara el consentimiento tácito, y así no hace falta interpretar nada.
 *
 * Lo que se guarda es lo que pasó: quién aceptó, cuándo, por qué canal y con qué
 * versión del aviso. Nunca se marca aceptado por no contestar.
 *
 * Módulo PURO.
 */
import { VERSION_AVISO } from '@/lib/aviso-privacidad'

export { VERSION_AVISO }

/** Lo que se guarda en la cita y en el expediente. */
export interface ConsentimientoBot {
  avisoPrivacidad: true
  informado: true
  version: string
  via: 'whatsapp'
  timestamp: string
}

/**
 * El mensaje que se le manda antes de pedirle un solo dato.
 *
 * @param baseUrl origen público de la aplicación, para el aviso completo.
 */
export function mensajeAviso(
  nombreClinica: string,
  clinicId: string,
  baseUrl?: string,
): string {
  const base = String(baseUrl ?? '').replace(/\/+$/, '')
  const enlace = base ? `${base}/privacidad/${encodeURIComponent(clinicId)}` : ''
  return [
    `Antes de continuar, un aviso 📄`,
    ``,
    `Para agendar necesito tus datos personales y de salud. *${nombreClinica || 'El consultorio'}* ` +
    `es responsable de tratarlos para darte atención médica e integrar tu expediente, ` +
    `conforme a la LFPDPPP. Puedes pedir acceso, rectificación, cancelación u oposición cuando quieras.`,
    ...(enlace ? ['', `Aviso completo: ${enlace}`] : []),
    ``,
    `¿Aceptas y continuamos? Responde *SÍ* para seguir o *NO* para salir.`,
  ].join('\n')
}

/** ¿La respuesta es una aceptación EXPRESA? Nada más cuenta. */
export function aceptoElAviso(texto: string): boolean {
  const t = String(texto ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()
  return /^(si|s|acepto|de acuerdo|ok|okay|adelante|claro|1)\b/.test(t)
}

/** ¿Dijo que no? Se distingue de «no entendí» para no insistir a quien ya dijo que no. */
export function rechazoElAviso(texto: string): boolean {
  const t = String(texto ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()
  return /^(no|n|nel|cancelar|salir|0)\b/.test(t)
}

/** El sello que se guarda. `ahoraIso` entra para que la prueba sea reproducible. */
export function consentimientoDelBot(ahoraIso: string): ConsentimientoBot {
  return {
    avisoPrivacidad: true,
    informado: true,
    version: VERSION_AVISO,
    via: 'whatsapp',
    timestamp: ahoraIso,
  }
}

export const POR_QUE_SE_PIDE_EXPRESO =
  'Porque son datos de salud, que son sensibles, y porque la misma aplicación ' +
  'bloquea el alta por el portal web cuando falta el consentimiento. Pedir un ' +
  '«sí» explícito evita tener que interpretar hasta dónde llega el ' +
  'consentimiento tácito: se guarda lo que pasó, no una suposición.'
