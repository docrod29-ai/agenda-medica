/**
 * Política de PRIVACIDAD de notificaciones (Iteración 8 · §8.6).
 *
 * Las notificaciones se ven en la PANTALLA BLOQUEADA (y en el centro de
 * notificaciones), donde cualquiera cerca puede leerlas. Por eso, por defecto,
 * NO deben contener PHI: nombre del paciente, motivo/diagnóstico, medicamentos,
 * resultados ni contenido clínico. El detalle se ve al ABRIR la app (autenticado).
 *
 * Funciones PURAS (sin DOM), testeables. Devuelven texto seguro para bloqueo.
 */

export type TipoNotifCita = 'cita_proxima' | 'teleconsulta_pronto'

export interface NotifSegura {
  titulo: string
  body: string
}

/**
 * Texto seguro para recordatorios de cita. Nunca incluye nombre del paciente ni
 * el motivo de consulta (contenido clínico). El médico ve el detalle al abrir.
 */
export function notificacionCitaSegura(tipo: TipoNotifCita, opts: { minutos?: number } = {}): NotifSegura {
  const min = opts.minutos
  if (tipo === 'teleconsulta_pronto') {
    return {
      titulo: min ? `Teleconsulta en ${min} min` : 'Teleconsulta próxima',
      body: 'Prepara tu cámara y ábrela en la app.',
    }
  }
  // cita_proxima
  return {
    titulo: 'Cita próxima',
    body: min ? `Tienes una consulta en ${min} minutos. Ábrela en la app.` : 'Tienes una consulta próxima. Ábrela en la app.',
  }
}
