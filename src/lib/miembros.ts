/**
 * Gestión de miembros activos de la clínica.
 *
 * clinic_members/{uid} → { clinicId, role, email, displayName?, invitadoPor?, createdAt }
 *
 * El doc id es el UID del usuario en Firebase Auth. Esto significa que:
 *  - Cada usuario tiene EXACTAMENTE una clínica (multi-clínica = nueva cuenta)
 *  - Las queries son rápidas con where('clinicId', '==', X)
 *  - Borrar el doc = revocar acceso (Firestore Rules dejan de matchear)
 */
import {
  collection, getDocs, query, where, deleteDoc, doc, updateDoc,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { ClinicMember } from '@/types'

export interface MiembroActivo extends ClinicMember {
  uid: string
  email?: string
  invitadoPor?: string
}

/** Lista todos los miembros activos de una clínica. */
export async function listarMiembros(clinicId: string): Promise<MiembroActivo[]> {
  const q = query(collection(db, 'clinic_members'), where('clinicId', '==', clinicId))
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ uid: d.id, ...(d.data() as Omit<MiembroActivo, 'uid'>) }))
}

/**
 * Quita un miembro de la clínica.
 * IMPORTANTE: solo borra la membresía. El usuario Firebase Auth queda pero ya no puede
 * ver datos de esta clínica. Si tenía otra clínica, no afecta.
 */
export async function removerMiembro(uid: string): Promise<void> {
  await deleteDoc(doc(db, 'clinic_members', uid))
}

/** Cambia el rol de un miembro (solo admin debería hacerlo). */
export async function cambiarRolMiembro(
  uid: string,
  nuevoRol: 'admin' | 'medico' | 'secretaria' | 'enfermeria' | 'farmacia' | 'laboratorio',
): Promise<void> {
  await updateDoc(doc(db, 'clinic_members', uid), { role: nuevoRol })
}
