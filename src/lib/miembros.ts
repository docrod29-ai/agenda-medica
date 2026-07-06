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
import { deleteDoc, doc, updateDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { fetchAutenticado } from '@/lib/auth-client'
import type { ClinicMember } from '@/types'

export interface MiembroActivo extends ClinicMember {
  uid: string
  email?: string
  invitadoPor?: string
}

/** Lista los miembros de una clínica vía API (Admin SDK; no expone `list` en reglas). */
export async function listarMiembros(clinicId: string): Promise<MiembroActivo[]> {
  const res = await fetchAutenticado(`/api/clinic/miembros?clinicId=${encodeURIComponent(clinicId)}`)
  const data = await res.json().catch(() => null)
  if (!data?.ok) return []
  return (data.miembros ?? []) as MiembroActivo[]
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
