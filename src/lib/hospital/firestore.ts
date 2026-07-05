// ══════════════════════════════════════════════════════════════
// Firestore — Episodios de internamiento (módulo de hospitalización).
// clinics/{clinicId}/internamientos/{id}  (nivel tenant → el CENSO es una
// sola consulta, no por-paciente). Las notas siguen en el expediente del
// paciente y se vinculan por `internamientoId`.
// ══════════════════════════════════════════════════════════════
import {
  collection, doc, addDoc, getDoc, getDocs, updateDoc, query, where,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { Internamiento, TipoEgreso } from '@/types/hospital'

function internamientosCol(clinicId: string) {
  return collection(db, 'clinics', clinicId, 'internamientos')
}
function internamientoDoc(clinicId: string, id: string) {
  return doc(db, 'clinics', clinicId, 'internamientos', id)
}

/** Quita las llaves con valor undefined (Firestore no las acepta). */
function limpiar<T extends object>(o: T): T {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T
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
