/**
 * Gestión de solicitudes ARCO (Acceso, Rectificación, Cancelación, Oposición).
 *
 * LFPDPPP Art. 28-32 — el titular de los datos personales tiene derecho a:
 *  - ACCESO: copia de sus datos
 *  - RECTIFICACIÓN: corregir datos inexactos o incompletos
 *  - CANCELACIÓN: solicitar eliminación
 *  - OPOSICIÓN: que sus datos no sean usados para X fin
 *  - REVOCACIÓN: revocar el consentimiento otorgado
 *
 * Plazo de respuesta: 20 días hábiles.
 *
 * Las solicitudes viven en clinics/{clinicId}/arco_requests/{requestId}.
 * Solo médicos/admin de la clínica las pueden ver.
 */
import { collection, addDoc, getDocs, doc, updateDoc, query, orderBy, where } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { logAudit } from '@/lib/expediente/audit-log'

export type ArcoTipo = 'acceso' | 'rectificacion' | 'cancelacion' | 'oposicion' | 'revocacion'

export const ARCO_TIPO_LABEL: Record<ArcoTipo, string> = {
  acceso: 'Acceso (copia de mis datos)',
  rectificacion: 'Rectificación (corrección)',
  cancelacion: 'Cancelación (borrado)',
  oposicion: 'Oposición (no usar para X)',
  revocacion: 'Revocación del consentimiento',
}

export type ArcoEstado = 'recibida' | 'en_proceso' | 'resuelta' | 'rechazada'

export interface ArcoRequest {
  id?: string
  clinicId: string
  /**
   * ID del paciente, SÓLO si la clínica lo identificó.
   *
   * Nunca lo pone el portal público: las reglas lo prohíben. Es lo que habilita
   * «Ejecutar cancelación…» en el panel, y una solicitud anónima que pudiera
   * señalar un expediente convertía ese botón en la supresión del expediente de
   * un tercero.
   */
  patientId?: string
  /** De dónde llegó. `portal-publico` = sin identificar. */
  origen?: 'portal-publico' | 'consultorio'
  /** La clínica vio la identificación. Nace en `false` y sólo el panel la sube. */
  identidadVerificada?: boolean
  /** Datos del solicitante */
  solicitante: {
    nombre: string
    telefono: string
    email?: string
    curp?: string
    identificacion?: string  // descripción del documento (ej "INE folio XXXX")
  }
  tipo: ArcoTipo
  descripcion: string             // qué pide específicamente
  /**
   * ACUSE DE LO ENTREGADO (solicitudes de ACCESO).
   *
   * Sin el hash no hay forma de demostrar QUÉ se entregó. Ante el INAI, «le
   * mandé su expediente» sin constancia es lo mismo que no haberlo mandado.
   */
  paqueteHash?: string
  paqueteFormato?: string
  entregadoEn?: string
  estado: ArcoEstado
  fechaSolicitud: string          // ISO
  fechaResolucion?: string
  resueltoPor?: string            // UID del médico
  resolucion?: string             // qué se hizo (texto libre)
  // Plazo legal (20 días hábiles desde fechaSolicitud) — para alertas
  fechaLimiteRespuesta?: string
}

/** Calcula la fecha límite (20 días hábiles desde la fecha de solicitud). */
export function calcularFechaLimite(fechaSolicitud: string): string {
  const d = new Date(fechaSolicitud)
  let agregados = 0
  while (agregados < 20) {
    d.setDate(d.getDate() + 1)
    // Saltar fines de semana
    if (d.getDay() !== 0 && d.getDay() !== 6) agregados++
  }
  return d.toISOString()
}

/** Crea una nueva solicitud ARCO */
export async function crearSolicitudArco(req: Omit<ArcoRequest, 'id' | 'estado' | 'fechaSolicitud' | 'fechaLimiteRespuesta'>): Promise<string> {
  const fechaSolicitud = new Date().toISOString()
  const payload: Omit<ArcoRequest, 'id'> = {
    ...req,
    /**
     * DE DÓNDE VIENE Y SI ESTÁ VERIFICADA. Las reglas exigen las dos cosas a
     * quien no es miembro: una solicitud que llega del portal público dice
     * quién DICE ser el solicitante, y nada más. Ligarla a un expediente y dar
     * la identidad por verificada son actos de la clínica, con la
     * identificación delante (Art. 29 LFPDPPP).
     */
    origen: 'portal-publico',
    identidadVerificada: false,
    estado: 'recibida',
    fechaSolicitud,
    fechaLimiteRespuesta: calcularFechaLimite(fechaSolicitud),
  }
  const ref = await addDoc(collection(db, 'clinics', req.clinicId, 'arco_requests'), payload)
  /**
   * BITÁCORA. Los eventos `arco_solicitud_recibida` y `arco_solicitud_resuelta`
   * existían en el catálogo, en la lista blanca del servidor y en las etiquetas
   * del panel de Cumplimiento — pero NADIE los emitía. El panel enseñaba
   * categorías que no se llenaban nunca, y el ejercicio de un derecho ARCO
   * quedaba sin constancia de cuándo entró ni de cuándo se contestó.
   */
  void logAudit({
    evento: 'arco_solicitud_recibida', clinicId: req.clinicId,
    patientId: req.patientId, meta: { solicitudId: ref.id, tipo: req.tipo, fechaLimite: payload.fechaLimiteRespuesta },
  })
  return ref.id
}

/** Lista todas las solicitudes ARCO de una clínica */
export async function listarSolicitudesArco(clinicId: string): Promise<ArcoRequest[]> {
  const q = query(collection(db, 'clinics', clinicId, 'arco_requests'), orderBy('fechaSolicitud', 'desc'))
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ ...d.data(), id: d.id } as ArcoRequest))
}

/** Lista solo pendientes */
export async function listarArcoPendientes(clinicId: string): Promise<ArcoRequest[]> {
  const q = query(
    collection(db, 'clinics', clinicId, 'arco_requests'),
    where('estado', 'in', ['recibida', 'en_proceso']),
    orderBy('fechaSolicitud', 'desc'),
  )
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ ...d.data(), id: d.id } as ArcoRequest))
}

/** Resuelve una solicitud (médico/admin marca como resuelta o rechazada) */
export async function resolverSolicitudArco(
  clinicId: string,
  requestId: string,
  resolucion: { estado: 'resuelta' | 'rechazada'; resolucion: string; resueltoPor: string },
): Promise<void> {
  await updateDoc(doc(db, 'clinics', clinicId, 'arco_requests', requestId), {
    ...resolucion,
    fechaResolucion: new Date().toISOString(),
  })
  // El plazo de respuesta se cuenta desde la solicitud: sin este asiento no hay
  // forma de demostrar que se contestó dentro de él.
  void logAudit({
    evento: 'arco_solicitud_resuelta', clinicId,
    meta: { solicitudId: requestId, estado: resolucion.estado },
  })
}
