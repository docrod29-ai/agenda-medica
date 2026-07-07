// ══════════════════════════════════════════════════════════════
// Firestore — Episodios de internamiento (módulo de hospitalización).
// clinics/{clinicId}/internamientos/{id}  (nivel tenant → el CENSO es una
// sola consulta, no por-paciente). Las notas siguen en el expediente del
// paciente y se vinculan por `internamientoId`.
// ══════════════════════════════════════════════════════════════
import {
  collection, doc, addDoc, getDoc, getDocs, updateDoc, deleteDoc, query, where, onSnapshot,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { setDoc, orderBy } from 'firebase/firestore'
import { fetchAutenticado } from '@/lib/auth-client'
import type {
  Internamiento, TipoEgreso, Interconsulta, Indicacion, Administracion, RegistroSignos, RolHospital,
  SolicitudLab, ResultadoLab, Cama, EstadoCama,
} from '@/types/hospital'

function internamientosCol(clinicId: string) {
  return collection(db, 'clinics', clinicId, 'internamientos')
}
function internamientoDoc(clinicId: string, id: string) {
  return doc(db, 'clinics', clinicId, 'internamientos', id)
}

/**
 * Quita los `undefined` en PROFUNDIDAD (Firestore los rechaza, incluso anidados
 * dentro de arreglos/objetos — p. ej. una administración del MAR sin nota).
 */
function limpiar<T>(o: T): T {
  if (Array.isArray(o)) return o.map(limpiar) as unknown as T
  if (o && typeof o === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(o as Record<string, unknown>)) {
      if (v !== undefined) out[k] = limpiar(v)
    }
    return out as T
  }
  return o
}

export type NuevoInternamiento = Omit<Internamiento, 'id' | 'estado' | 'createdAt' | 'updatedAt'>

/** Registra un ingreso hospitalario (episodio activo). Devuelve el id.
 *  Rechaza si el paciente YA tiene un internamiento activo (evita MAR partido). */
export async function crearInternamiento(clinicId: string, data: NuevoInternamiento): Promise<string> {
  // Ingreso vía GATEWAY: el servidor valida el rol (medico/admin), aplica el
  // guard de duplicado activo y escribe con Admin SDK. El cliente ya no escribe
  // directo (las Rules lo bloquean).
  const res = await mutar(clinicId, null, 'crear', limpiar(data as unknown as Record<string, unknown>))
  if (!res.id) throw new Error('No se pudo registrar el ingreso (sin id).')
  return res.id
}

/** CENSO: todos los internamientos ACTIVOS (ordenados por ingreso, en JS para no exigir índice). */
export async function getCenso(clinicId: string): Promise<Internamiento[]> {
  const snap = await getDocs(query(internamientosCol(clinicId), where('estado', '==', 'activo')))
  return snap.docs
    .map(d => ({ ...d.data(), id: d.id } as Internamiento))
    .sort((a, b) => (a.fechaIngreso < b.fechaIngreso ? 1 : -1))
}

/** CENSO en VIVO: se actualiza solo cuando alguien ingresa/egresa/traslada (onSnapshot).
 *  Devuelve la función para des-suscribir. */
export function suscribirCenso(clinicId: string, cb: (censo: Internamiento[]) => void): () => void {
  return onSnapshot(query(internamientosCol(clinicId), where('estado', '==', 'activo')), snap => {
    cb(snap.docs.map(d => ({ ...d.data(), id: d.id } as Internamiento)).sort((a, b) => (a.fechaIngreso < b.fechaIngreso ? 1 : -1)))
  }, () => { /* error de permisos/red: se conserva el último estado */ })
}

/** UN internamiento en VIVO: refleja indicaciones/MAR/interconsultas/traslados de otros usuarios. */
export function suscribirInternamiento(clinicId: string, id: string, cb: (inter: Internamiento | null) => void): () => void {
  return onSnapshot(internamientoDoc(clinicId, id), snap => {
    cb(snap.exists() ? ({ ...snap.data(), id: snap.id } as Internamiento) : null)
  }, () => { /* error: se conserva el último estado */ })
}

/** Signos vitales seriados en VIVO (subcolección). */
export function suscribirSignos(clinicId: string, iid: string, cb: (signos: RegistroSignos[]) => void): () => void {
  return onSnapshot(signosCol(clinicId, iid), snap => {
    cb(snap.docs.map(d => ({ ...d.data(), id: d.id } as RegistroSignos)).sort((a, b) => (a.fecha < b.fecha ? -1 : 1)))
  }, () => { /* error: se conserva el último estado */ })
}

/** Todos los internamientos (activos + egresados) — para el histórico. */
export async function getInternamientos(clinicId: string): Promise<Internamiento[]> {
  const snap = await getDocs(internamientosCol(clinicId))
  return snap.docs
    .map(d => ({ ...d.data(), id: d.id } as Internamiento))
    .sort((a, b) => (a.fechaIngreso < b.fechaIngreso ? 1 : -1))
}

export async function getInternamiento(clinicId: string, id: string): Promise<Internamiento | null> {
  const snap = await getDoc(internamientoDoc(clinicId, id))
  return snap.exists() ? ({ ...snap.data(), id: snap.id } as Internamiento) : null
}

/** Internamientos de UN paciente (para mostrarlos en su expediente). */
export async function getInternamientosDePaciente(clinicId: string, pacienteId: string): Promise<Internamiento[]> {
  const snap = await getDocs(query(internamientosCol(clinicId), where('pacienteId', '==', pacienteId)))
  return snap.docs
    .map(d => ({ ...d.data(), id: d.id } as Internamiento))
    .sort((a, b) => (a.fechaIngreso < b.fechaIngreso ? 1 : -1))
}

/**
 * TODAS las mutaciones del doc de internamiento pasan por el GATEWAY del servidor
 * (/api/hospital/mutar), que valida el ROL por acción (RBAC real, no de vista) y
 * escribe con Admin SDK en una transacción. Las Firestore Rules bloquean la
 * escritura directa del cliente al doc de internamiento.
 */
async function mutar(clinicId: string, internamientoId: string | null, accion: string, payload: Record<string, unknown>): Promise<{ ok: boolean; id?: string; error?: string }> {
  const res = await fetchAutenticado('/api/hospital/mutar', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clinicId, internamientoId, accion, payload }),
  })
  const data = await res.json().catch(() => ({ ok: false }))
  if (!data.ok) throw new Error(data.error || 'No se pudo completar la acción')
  return data
}

/** Egresa un episodio (lo saca del censo activo). */
export async function egresarInternamiento(clinicId: string, id: string, egreso: { tipoEgreso: TipoEgreso; resumenEgreso?: string; fechaEgreso?: string }): Promise<void> {
  await mutar(clinicId, id, 'egresar', { tipoEgreso: egreso.tipoEgreso, resumenEgreso: egreso.resumenEgreso })
}

// ── F2 · Interconsultas ──
export async function agregarInterconsulta(clinicId: string, iid: string, ic: Omit<Interconsulta, 'id' | 'estado' | 'fecha'>): Promise<string> {
  await mutar(clinicId, iid, 'interconsulta_agregar', { especialidad: ic.especialidad, motivo: ic.motivo, solicitanteNombre: ic.solicitanteNombre })
  return ''
}
export async function responderInterconsulta(clinicId: string, iid: string, icId: string, resp: { respuesta?: string; respondidaPor?: string; notaId?: string }): Promise<void> {
  await mutar(clinicId, iid, 'interconsulta_responder', { icId, respuesta: resp.respuesta, respondidaPor: resp.respondidaPor })
}

// ── F3 · Indicaciones médicas + MAR ──
export async function agregarIndicacion(clinicId: string, iid: string, ind: Omit<Indicacion, 'id' | 'activa' | 'fecha' | 'administraciones'>): Promise<void> {
  await mutar(clinicId, iid, 'indicacion_agregar', { tipo: ind.tipo, descripcion: ind.descripcion, frecuencia: ind.frecuencia, creadaPor: ind.creadaPor })
}
export async function suspenderIndicacion(clinicId: string, iid: string, indId: string, activa: boolean): Promise<void> {
  await mutar(clinicId, iid, 'indicacion_suspender', { indId, activa })
}
export async function registrarAdministracion(clinicId: string, iid: string, indId: string, adm: Administracion): Promise<void> {
  await mutar(clinicId, iid, 'administrar', { indId, adm })
}
export async function verificarIndicacionFarmacia(clinicId: string, iid: string, indId: string, por: string): Promise<void> {
  await mutar(clinicId, iid, 'verificar_farmacia', { indId, por })
}

/** Guarda los medicamentos que el paciente tomaba en casa (para conciliar). */
export async function guardarMedicamentosCasa(clinicId: string, iid: string, meds: string[]): Promise<void> {
  await mutar(clinicId, iid, 'conciliar', { meds })
}

/** Traslado de servicio/cama con registro en el historial de movimientos. */
export async function trasladarInternamiento(clinicId: string, iid: string, dst: { servicio: string; cama: string; por?: string }): Promise<void> {
  await mutar(clinicId, iid, 'trasladar', { servicio: dst.servicio, cama: dst.cama, por: dst.por })
}

/** Cambio de médico tratante (responsable) con registro en el historial. */
export async function cambiarTratante(clinicId: string, iid: string, t: { medicoTratanteId: string; medicoTratanteNombre: string; por?: string }): Promise<void> {
  await mutar(clinicId, iid, 'cambiar_tratante', { medicoTratanteId: t.medicoTratanteId, medicoTratanteNombre: t.medicoTratanteNombre, por: t.por })
}

// ── F3 · Signos vitales seriados (subcolección, pueden ser muchos) ──
function signosCol(clinicId: string, iid: string) {
  return collection(db, 'clinics', clinicId, 'internamientos', iid, 'signos')
}
export async function agregarSignos(clinicId: string, iid: string, s: Omit<RegistroSignos, 'id'>): Promise<void> {
  await addDoc(signosCol(clinicId, iid), limpiar(s as object))
}
export async function getSignos(clinicId: string, iid: string): Promise<RegistroSignos[]> {
  const snap = await getDocs(signosCol(clinicId, iid))
  return snap.docs
    .map(d => ({ ...d.data(), id: d.id } as RegistroSignos))
    .sort((a, b) => (a.fecha < b.fecha ? -1 : 1))  // ascendente para la gráfica
}
export async function borrarSignos(clinicId: string, iid: string, sid: string): Promise<void> {
  await deleteDoc(doc(db, 'clinics', clinicId, 'internamientos', iid, 'signos', sid))
}

// ── F3/V3 · Rol hospitalario por usuario (persistido, sigue al usuario entre dispositivos) ──
export async function getRolUsuario(clinicId: string, uid: string): Promise<RolHospital | null> {
  const snap = await getDoc(doc(db, 'clinics', clinicId, 'hospital_roles', uid))
  return snap.exists() ? ((snap.data().rol as RolHospital) ?? null) : null
}
export async function setRolUsuario(clinicId: string, uid: string, rol: RolHospital): Promise<void> {
  await setDoc(doc(db, 'clinics', clinicId, 'hospital_roles', uid), { rol, updatedAt: new Date().toISOString() }, { merge: true })
}

/** WhatsApp personal para alertas hospitalarias (al médico tratante en persona). */
export async function getTelefonoAlertas(clinicId: string, uid: string): Promise<string> {
  const snap = await getDoc(doc(db, 'clinics', clinicId, 'hospital_roles', uid))
  return snap.exists() ? String((snap.data().telefono as string) ?? '') : ''
}
export async function setTelefonoAlertas(clinicId: string, uid: string, telefono: string): Promise<void> {
  await setDoc(doc(db, 'clinics', clinicId, 'hospital_roles', uid), { telefono: telefono.trim(), updatedAt: new Date().toISOString() }, { merge: true })
}

// ── F4 · Laboratorio (solicitud → resultado) ──
function labCol(clinicId: string) { return collection(db, 'clinics', clinicId, 'laboratorio') }

export async function crearSolicitudLab(clinicId: string, data: Omit<SolicitudLab, 'id' | 'estado' | 'createdAt' | 'updatedAt'>): Promise<string> {
  const now = new Date().toISOString()
  const ref = await addDoc(labCol(clinicId), limpiar({ ...data, estado: 'solicitada', createdAt: now, updatedAt: now }))
  return ref.id
}
export async function getSolicitudesLabDeEpisodio(clinicId: string, iid: string): Promise<SolicitudLab[]> {
  const snap = await getDocs(query(labCol(clinicId), where('internamientoId', '==', iid)))
  return snap.docs.map(d => ({ ...d.data(), id: d.id } as SolicitudLab)).sort((a, b) => (a.fecha < b.fecha ? 1 : -1))
}
/** Solicitudes pendientes de TODA la clínica (bandeja del laboratorio). */
export async function getBandejaLab(clinicId: string): Promise<SolicitudLab[]> {
  const snap = await getDocs(query(labCol(clinicId), where('estado', 'in', ['solicitada', 'en_proceso'])))
  return snap.docs.map(d => ({ ...d.data(), id: d.id } as SolicitudLab)).sort((a, b) => (a.fecha < b.fecha ? 1 : -1))
}
export async function cargarResultadosLab(clinicId: string, ordenId: string, resultados: ResultadoLab[], por: string): Promise<void> {
  await updateDoc(doc(db, 'clinics', clinicId, 'laboratorio', ordenId), limpiar({
    resultados, estado: 'resultado', procesadaPor: por, fechaResultado: new Date().toISOString(), updatedAt: new Date().toISOString(),
  }))
}

// ── F5 · Alertas hospitalarias (lab crítico, NEWS2, interconsulta/resultado) ──
export interface AlertaHospital {
  id?: string
  internamientoId: string
  pacienteNombre: string
  tipo: 'lab_critico' | 'news2' | 'interconsulta' | 'resultado'
  titulo: string
  detalle: string
  destinatarioUid?: string
  destinatarioNombre?: string
  leida: boolean
  fecha: string
  whatsappEnviado?: boolean
}
function alertasCol(clinicId: string) { return collection(db, 'clinics', clinicId, 'hospital_alertas') }
export async function crearAlerta(clinicId: string, a: Omit<AlertaHospital, 'id' | 'leida' | 'fecha'>): Promise<string> {
  const ref = await addDoc(alertasCol(clinicId), limpiar({ ...a, leida: false, fecha: new Date().toISOString() }))
  return ref.id
}
export async function getAlertas(clinicId: string, soloNoLeidas = false): Promise<AlertaHospital[]> {
  const snap = await getDocs(query(alertasCol(clinicId), orderBy('fecha', 'desc')))
  const arr = snap.docs.map(d => ({ ...d.data(), id: d.id } as AlertaHospital))
  return soloNoLeidas ? arr.filter(x => !x.leida) : arr
}
export async function marcarAlertaLeida(clinicId: string, id: string): Promise<void> {
  await updateDoc(doc(db, 'clinics', clinicId, 'hospital_alertas', id), { leida: true })
}

// ── Catálogo de camas (inventario + ocupación) ──
function camasCol(clinicId: string) { return collection(db, 'clinics', clinicId, 'camas') }
export async function crearCama(clinicId: string, c: { servicio: string; etiqueta: string; tipo?: string }): Promise<void> {
  await addDoc(camasCol(clinicId), limpiar({ ...c, clinicId, estado: 'libre' as EstadoCama, createdAt: new Date().toISOString() }))
}
export async function getCamas(clinicId: string): Promise<Cama[]> {
  const snap = await getDocs(camasCol(clinicId))
  return snap.docs.map(d => ({ ...d.data(), id: d.id } as Cama)).sort((a, b) => (a.servicio + a.etiqueta).localeCompare(b.servicio + b.etiqueta))
}
export async function actualizarCamaEstado(clinicId: string, id: string, estado: EstadoCama): Promise<void> {
  await updateDoc(doc(db, 'clinics', clinicId, 'camas', id), { estado })
}
export async function borrarCama(clinicId: string, id: string): Promise<void> {
  await deleteDoc(doc(db, 'clinics', clinicId, 'camas', id))
}

// ── F6 · Enfermería (balance hídrico, escalas, entrega de turno SBAR) — vía gateway ──
export async function agregarBalance(clinicId: string, iid: string, b: { ingresos: number; egresos: number; por?: string }): Promise<void> {
  await mutar(clinicId, iid, 'balance', { ingresos: b.ingresos, egresos: b.egresos, por: b.por })
}
export async function agregarEscala(clinicId: string, iid: string, e: { tipo: 'braden' | 'morse'; score: number; riesgo: string; por?: string }): Promise<void> {
  await mutar(clinicId, iid, 'escala', { tipo: e.tipo, score: e.score, riesgo: e.riesgo, por: e.por })
}
export async function agregarSbar(clinicId: string, iid: string, s: { texto: string; por?: string }): Promise<void> {
  await mutar(clinicId, iid, 'sbar', { texto: s.texto, por: s.por })
}
