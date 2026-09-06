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
import { collection, addDoc, getDocs, getDoc, doc, setDoc, updateDoc, query, orderBy, where } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { idIdempotente } from '@/lib/idempotencia'
import { logAudit } from '@/lib/expediente/audit-log'

export type ArcoTipo = 'acceso' | 'rectificacion' | 'cancelacion' | 'oposicion' | 'revocacion'

/**
 * Etiquetas que ve el PACIENTE en el portal de privacidad. Sin marcadores de
 * plantilla: «Oposición (no usar para X)» llegó tal cual a producción (Panel de
 * Lujo PC-014). El guardián `arco-etiquetas-sin-plantilla.test.ts` lo vigila.
 */
export const ARCO_TIPO_LABEL: Record<ArcoTipo, string> = {
  acceso: 'Acceso (una copia de mis datos)',
  rectificacion: 'Rectificación (corregir un dato)',
  cancelacion: 'Cancelación (que se borren mis datos)',
  oposicion: 'Oposición (que no se usen mis datos para un fin concreto)',
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
  /** uid de quien afirmó haber visto la identificación, y cuándo (ISO). */
  identidadVerificadaPor?: string
  identidadVerificadaEn?: string
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

/**
 * Calcula la fecha límite (20 días hábiles desde la fecha de solicitud).
 *
 * NEEDS_LEGAL_REVIEW (Panel de Lujo ASE-024 · PL-L6a): salta sólo sábados y
 * domingos. Si «días hábiles» del art. 32 LFPDPPP excluye además los días de
 * descanso obligatorio del art. 74 LFT, el plazo real es MÁS LARGO que éste.
 * El sesgo actual es conservador —el contador avisa antes, nunca después— y
 * por eso se deja así hasta que el asesor lo confirme; entonces la lista de
 * feriados por año entra aquí como módulo puro con su prueba.
 */
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

/**
 * Lo que se escribe al crear una solicitud. Puro, para probarlo sin Firestore.
 *
 * DOS ORÍGENES (Panel de Lujo ASE-010). Del portal público llega sin expediente
 * y sin verificar: quién DICE ser el solicitante, y nada más. Desde el
 * CONSULTORIO —el médico atendiendo al titular con su identificación delante—
 * nace ya ligada al expediente y verificada, que es lo que las reglas permiten
 * a un miembro y prohíben al público. Antes `crearSolicitudArco` sólo sabía
 * hacer la primera, así que un derecho ejercido en persona no se podía
 * registrar ni ejecutar.
 */
export function documentoDeSolicitudArco(
  req: Omit<ArcoRequest, 'id' | 'estado' | 'fechaSolicitud' | 'fechaLimiteRespuesta'>,
  ahoraIso: string,
  origen: { desde: 'portal-publico' } | { desde: 'consultorio'; patientId: string; verificadaPor: string },
): Omit<ArcoRequest, 'id'> {
  const base: Omit<ArcoRequest, 'id'> = {    ...req,
    estado: 'recibida',
    fechaSolicitud: ahoraIso,
    fechaLimiteRespuesta: calcularFechaLimite(ahoraIso),
  }
  if (origen.desde === 'consultorio') {
    return {
      ...base,
      patientId: origen.patientId,
      origen: 'consultorio',
      identidadVerificada: true,
      identidadVerificadaPor: origen.verificadaPor,
      identidadVerificadaEn: ahoraIso,
    }
  }
  // El portal nunca señala un expediente: las reglas lo rechazan.
  const { patientId: _sinExpediente, ...sinPatientId } = base
  void _sinExpediente
  return { ...sinPatientId, origen: 'portal-publico', identidadVerificada: false }
}

/** Crea una nueva solicitud ARCO */
export async function crearSolicitudArco(
  req: Omit<ArcoRequest, 'id' | 'estado' | 'fechaSolicitud' | 'fechaLimiteRespuesta'>,
  origen: { desde: 'portal-publico' } | { desde: 'consultorio'; patientId: string; verificadaPor: string } = { desde: 'portal-publico' },
  /**
   * ── UN DERECHO EJERCIDO UNA VEZ, UN EXPEDIENTE ────────────────────────────
   *
   * El formulario del portal es público y lo llena una persona desde su
   * teléfono, con la conexión que tenga. Si el `addDoc` commitea y la respuesta
   * se pierde, el paciente ve un error, vuelve a pulsar «Enviar» y quedan DOS
   * solicitudes del mismo derecho — con dos folios, dos plazos legales de
   * respuesta (Art. 32 LFPDPPP) y dos procesos que el consultorio tiene que
   * contestar por separado.
   *
   * La clave se acuña cuando se ABRE el formulario, no cuando se pulsa enviar:
   * acuñarla al enviar haría que cada reintento trajera una nueva.
   */
  claveDeIntento?: string,
): Promise<string> {
  const fechaSolicitud = new Date().toISOString()
  const payload = documentoDeSolicitudArco(req, fechaSolicitud, origen)
  const col = collection(db, 'clinics', req.clinicId, 'arco_requests')
  /**
   * Si ya existe **no se pisa**: la solicitud anterior puede llevar horas con su
   * plazo corriendo, y reescribirla movería `fechaSolicitud` — que es justo la
   * fecha desde la que cuenta el plazo legal.
   */
  const ref = claveDeIntento
    ? await (async () => {
      const r = doc(col, idIdempotente(req.clinicId, 'arco', claveDeIntento))
      const previa = await getDoc(r)
      if (!previa.exists()) await setDoc(r, payload)
      return r
    })()
    : await addDoc(col, payload)  /**
   * BITÁCORA. Los eventos `arco_solicitud_recibida` y `arco_solicitud_resuelta`
   * existían en el catálogo, en la lista blanca del servidor y en las etiquetas
   * del panel de Cumplimiento — pero NADIE los emitía. El panel enseñaba
   * categorías que no se llenaban nunca, y el ejercicio de un derecho ARCO
   * quedaba sin constancia de cuándo entró ni de cuándo se contestó.
   */
  void logAudit({
    evento: 'arco_solicitud_recibida', clinicId: req.clinicId,
    patientId: payload.patientId, meta: { solicitudId: ref.id, tipo: req.tipo, fechaLimite: payload.fechaLimiteRespuesta },
  })
  return ref.id
}

/**
 * LIGAR UNA SOLICITUD A UN EXPEDIENTE (Panel de Lujo ASE-010).
 *
 * Las solicitudes del portal llegan sin `patientId` y el panel manda a
 * «ejecutarla desde su expediente», donde no había ninguna acción. Las reglas
 * ya permitían a un miembro ligar el expediente (es un acto de la clínica, con
 * la identificación delante — Art. 29 LFPDPPP) y ningún código lo hacía.
 *
 * Pasa por el SERVIDOR (`/api/arco/ligar`), no por `updateDoc`: el servidor
 * comprueba que el expediente exista en ESTE consultorio y deja el asiento en
 * la bitácora con el nombre de quien afirmó haber visto la identificación.
 */
export async function ligarSolicitudArco(
  clinicId: string,
  requestId: string,
  patientId: string,
): Promise<{ ok: boolean; error?: string }> {
  const { fetchAutenticado } = await import('@/lib/auth-client')
  try {
    const res = await fetchAutenticado('/api/arco/ligar', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clinicId, solicitudId: requestId, patientId, identidadVerificada: true }),
    })
    const d = await res.json().catch(() => ({ ok: false, error: 'Respuesta ilegible del servidor' }))
    return { ok: !!d.ok, error: d.ok ? undefined : String(d.error ?? 'No se pudo ligar la solicitud') }
  } catch {
    return { ok: false, error: 'Sin conexión. Intenta de nuevo.' }
  }
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
