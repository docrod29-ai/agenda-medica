/**
 * Sucursales (multi-sede).
 *
 * Modelo conservador: una clínica puede tener 0 o más sucursales. Si la
 * clínica no usa sucursales, todo sigue funcionando como hasta ahora.
 *
 * Datos en `clinics/{clinicId}/branches/{branchId}`.
 */
import {
  collection, doc, addDoc, getDocs, updateDoc, deleteDoc, query, orderBy,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { Branch } from '@/types'

function col(clinicId: string) {
  return collection(db, 'clinics', clinicId, 'branches')
}

export async function listarSucursales(clinicId: string): Promise<Branch[]> {
  const snap = await getDocs(query(col(clinicId), orderBy('createdAt', 'asc')))
  return snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<Branch, 'id'>) }))
}

export async function crearSucursal(
  clinicId: string,
  data: Omit<Branch, 'id' | 'createdAt'>,
): Promise<string> {
  const ref = await addDoc(col(clinicId), { ...data, createdAt: new Date().toISOString() })
  return ref.id
}

export async function actualizarSucursal(
  clinicId: string,
  id: string,
  data: Partial<Omit<Branch, 'id' | 'createdAt'>>,
): Promise<void> {
  await updateDoc(doc(col(clinicId), id), data)
}

export async function borrarSucursal(clinicId: string, id: string): Promise<void> {
  await deleteDoc(doc(col(clinicId), id))
}
