/**
 * Lo que se escribe sobre una solicitud ARCO al LIGARLA a un expediente
 * (Panel de Lujo ASE-010). Puro; lo usa `/api/arco/ligar` y lo fija la prueba.
 *
 * Sólo se AÑADE: quién es el titular identificado, que se vio su
 * identificación, quién lo afirmó y cuándo. Lo que declaró el ciudadano
 * (solicitante, tipo, descripción, fecha, origen) no se toca — las reglas lo
 * congelan y este parche no lo incluye. El estado pasa a «en proceso»: ya hay
 * alguien trabajando en ella.
 */
export function parcheDeLigado(p: { patientId: string; uid: string; ahoraIso: string }) {
  return {
    patientId: p.patientId,
    identidadVerificada: true,
    identidadVerificadaPor: p.uid,
    identidadVerificadaEn: p.ahoraIso,
    estado: 'en_proceso' as const,
  }
}

/** Campos que el ciudadano declaró y que ligar NUNCA toca. */
export const CAMPOS_QUE_LIGAR_NO_TOCA = ['solicitante', 'tipo', 'descripcion', 'fechaSolicitud', 'origen', 'clinicId'] as const
