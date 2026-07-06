// ══════════════════════════════════════════════════════════════
// Firestore — Episodios de internamiento (módulo de hospitalización).
// clinics/{clinicId}/internamientos/{id}  (nivel tenant → el CENSO es una
// sola consulta, no por-paciente). Las notas siguen en el expediente del
// paciente y se vinculan por `internamientoId`.
// ══════════════════════════════════════════════════════════════
import {
  collection, doc, addDoc, getDoc, getDocs, updateDoc, deleteDoc, query, where,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { setDoc, orderBy } from 'firebase/firestore'
import type {
  Internamiento, TipoEgreso, Interconsulta, Indicacion, Administracion, RegistroSignos, RolHospital,
  SolicitudLab, ResultadoLab,
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

/** Registra un ingreso hospitalario (episodio activo). Devuelve el id. */
export async function crearInternamiento(clinicId: string, data: NuevoInternamiento): Promise<string> {
  const now = new Date().toISOString()
  const ref = await addDoc(internamientosCol(clinicId), limpiar({
    ...data,
    estado: 'activo',
    createdAt: now,
    updatedAt: now,
  }))
  return ref.id
}

/** CENSO: todos los internamientos ACTIVOS (ordenados por ingreso, en JS para no exigir índice). */
export async function getCenso(clinicId: string): Promise<Internamiento[]> {
  const snap = await getDocs(query(internamientosCol(clinicId), where('estado', '==', 'activo')))
  return snap.docs
    .map(d => ({ ...d.data(), id: d.id } as Internamiento))
    .sort((a, b) => (a.fechaIngreso < b.fechaIngreso ? 1 : -1))
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

export async function actualizarInternamiento(clinicId: string, id: string, patch: Partial<Internamiento>): Promise<void> {
  await updateDoc(internamientoDoc(clinicId, id), limpiar({ ...patch, updatedAt: new Date().toISOString() }))
}

/** Egresa un episodio (lo saca del censo activo). */
export async function egresarInternamiento(
  clinicId: string,
  id: string,
  egreso: { tipoEgreso: TipoEgreso; resumenEgreso?: string; fechaEgreso?: string },
): Promise<void> {
  await actualizarInternamiento(clinicId, id, {
    estado: 'egresado',
    fechaEgreso: egreso.fechaEgreso ?? new Date().toISOString(),
    tipoEgreso: egreso.tipoEgreso,
    resumenEgreso: egreso.resumenEgreso,
  })
}

function id36() {
  // ID corto sin depender de crypto (suficiente para elementos dentro del episodio)
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)
}

// ── F2 · Interconsultas (array en el doc del internamiento) ──
export async function agregarInterconsulta(clinicId: string, iid: string, ic: Omit<Interconsulta, 'id' | 'estado' | 'fecha'>): Promise<string> {
  const inter = await getInternamiento(clinicId, iid)
  if (!inter) throw new Error('Internamiento no encontrado')
  const nueva: Interconsulta = { ...ic, id: id36(), estado: 'solicitada', fecha: new Date().toISOString() }
  await actualizarInternamiento(clinicId, iid, { interconsultas: [...(inter.interconsultas ?? []), nueva] })
  return nueva.id
}

export async function responderInterconsulta(clinicId: string, iid: string, icId: string, resp: { respuesta?: string; respondidaPor?: string; notaId?: string }): Promise<void> {
  const inter = await getInternamiento(clinicId, iid)
  if (!inter) return
  const interconsultas = (inter.interconsultas ?? []).map(ic =>
    ic.id === icId ? { ...ic, estado: 'respondida' as const, fechaRespuesta: new Date().toISOString(), ...resp } : ic
  )
  await actualizarInternamiento(clinicId, iid, { interconsultas })
}

// ── F3 · Indicaciones médicas + MAR (array en el doc) ──
export async function agregarIndicacion(clinicId: string, iid: string, ind: Omit<Indicacion, 'id' | 'activa' | 'fecha' | 'administraciones'>): Promise<void> {
  const inter = await getInternamiento(clinicId, iid)
  if (!inter) throw new Error('Internamiento no encontrado')
  const nueva: Indicacion = { ...ind, id: id36(), activa: true, fecha: new Date().toISOString(), administraciones: [] }
  await actualizarInternamiento(clinicId, iid, { indicaciones: [...(inter.indicaciones ?? []), nueva] })
}

export async function suspenderIndicacion(clinicId: string, iid: string, indId: string, activa: boolean): Promise<void> {
  const inter = await getInternamiento(clinicId, iid)
  if (!inter) return
  const indicaciones = (inter.indicaciones ?? []).map(x => x.id === indId ? { ...x, activa } : x)
  await actualizarInternamiento(clinicId, iid, { indicaciones })
}

export async function registrarAdministracion(clinicId: string, iid: string, indId: string, adm: Administracion): Promise<void> {
  const inter = await getInternamiento(clinicId, iid)
  if (!inter) return
  const indicaciones = (inter.indicaciones ?? []).map(x =>
    x.id === indId ? { ...x, administraciones: [...x.administraciones, adm] } : x
  )
  await actualizarInternamiento(clinicId, iid, { indicaciones })
}

/** Verificación farmacéutica de una indicación (ciclo cerrado del medicamento). */
export async function verificarIndicacionFarmacia(clinicId: string, iid: string, indId: string, por: string): Promise<void> {
  const inter = await getInternamiento(clinicId, iid)
  if (!inter) return
  const indicaciones = (inter.indicaciones ?? []).map(x =>
    x.id === indId ? { ...x, verificadaFarmacia: true, verificadaPor: por, fechaVerificacion: new Date().toISOString() } : x
  )
  await actualizarInternamiento(clinicId, iid, { indicaciones })
}

/** Guarda los medicamentos que el paciente tomaba en casa (para conciliar). */
export async function guardarMedicamentosCasa(clinicId: string, iid: string, meds: string[]): Promise<void> {
  await actualizarInternamiento(clinicId, iid, { medicamentosCasa: meds, conciliadoAl: new Date().toISOString() })
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

// ── F6 · Enfermería (balance hídrico, escalas, entrega de turno SBAR) ──
export async function agregarBalance(clinicId: string, iid: string, b: { ingresos: number; egresos: number; por?: string }): Promise<void> {
  const inter = await getInternamiento(clinicId, iid); if (!inter) return
  const entrada = { fecha: new Date().toISOString(), ...b }
  await actualizarInternamiento(clinicId, iid, { balanceHidrico: [...(inter.balanceHidrico ?? []), entrada].slice(-100) })
}
export async function agregarEscala(clinicId: string, iid: string, e: { tipo: 'braden' | 'morse'; score: number; riesgo: string; por?: string }): Promise<void> {
  const inter = await getInternamiento(clinicId, iid); if (!inter) return
  const entrada = { fecha: new Date().toISOString(), ...e }
  await actualizarInternamiento(clinicId, iid, { escalas: [...(inter.escalas ?? []), entrada].slice(-100) })
}
export async function agregarSbar(clinicId: string, iid: string, s: { texto: string; por?: string }): Promise<void> {
  const inter = await getInternamiento(clinicId, iid); if (!inter) return
  const entrada = { fecha: new Date().toISOString(), ...s }
  await actualizarInternamiento(clinicId, iid, { sbar: [...(inter.sbar ?? []), entrada].slice(-50) })
}
