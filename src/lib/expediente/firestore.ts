import {
  collection, doc, addDoc, getDoc, getDocs, updateDoc, deleteDoc,
  query, orderBy, where,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { NotaMedica } from '@/types/expediente'

/**
 * Notas clínicas viven en:
 *   clinics/{clinicId}/patients/{patientId}/notas/{notaId}
 * Aislamiento multi-tenant heredado de la estructura existente.
 */
function notasCol(clinicId: string, patientId: string) {
  return collection(db, 'clinics', clinicId, 'patients', patientId, 'notas')
}
function notaDoc(clinicId: string, patientId: string, notaId: string) {
  return doc(db, 'clinics', clinicId, 'patients', patientId, 'notas', notaId)
}

export async function getNotas(clinicId: string, patientId: string): Promise<NotaMedica[]> {
  const snap = await getDocs(query(notasCol(clinicId, patientId), orderBy('fechaConsulta', 'desc')))
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as NotaMedica))
}

export async function getNota(clinicId: string, patientId: string, notaId: string): Promise<NotaMedica | null> {
  const snap = await getDoc(notaDoc(clinicId, patientId, notaId))
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as NotaMedica) : null
}

/** Firestore rechaza valores `undefined`. Los eliminamos recursivamente. */
function stripUndefined<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map(v => stripUndefined(v)) as unknown as T
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v === undefined) continue
      out[k] = stripUndefined(v)
    }
    return out as T
  }
  return value
}

export async function createNota(
  clinicId: string,
  patientId: string,
  data: Omit<NotaMedica, 'id'>,
): Promise<string> {
  const ref = await addDoc(notasCol(clinicId, patientId), stripUndefined(data))
  return ref.id
}

/** Borra una nota. Solo borradores (las firmadas son inmutables por las reglas). */
export async function deleteNota(
  clinicId: string,
  patientId: string,
  notaId: string,
): Promise<void> {
  await deleteDoc(notaDoc(clinicId, patientId, notaId))
}

/** Solo se permite actualizar borradores (NOM-024: las firmadas son inmutables) */
export async function updateNota(
  clinicId: string,
  patientId: string,
  notaId: string,
  data: Partial<NotaMedica>,
): Promise<void> {
  await updateDoc(notaDoc(clinicId, patientId, notaId), stripUndefined({
    ...data,
    updatedAt: new Date().toISOString(),
  }))
}

/** Última nota firmada para construir contexto de IA */
export async function getUltimasNotasResumen(
  clinicId: string,
  patientId: string,
  limit = 3,
): Promise<string> {
  const snap = await getDocs(query(
    notasCol(clinicId, patientId),
    where('estado', '==', 'firmada'),
    orderBy('fechaConsulta', 'desc'),
  ))
  const notas = snap.docs.slice(0, limit).map(d => d.data() as NotaMedica)
  if (notas.length === 0) return ''
  return notas
    .map(n => `[${n.fechaConsulta.slice(0, 10)}] ${n.resumenEjecutivo || n.diagnosticos.map(d => d.descripcion).join(', ')}`)
    .join(' · ')
}
