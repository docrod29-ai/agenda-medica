/**
 * Versionado de borradores de notas (NOM-024 Art. 6.4).
 *
 * Mientras una nota está en estado 'borrador', cada vez que se guarda
 * se escribe un snapshot a la subcolección:
 *   clinics/{clinicId}/patients/{patientId}/notas/{notaId}/versions/{vId}
 *
 * Esto permite:
 *  - Ver la evolución del borrador (qué cambió en cada versión)
 *  - Restaurar una versión previa accidentalmente borrada
 *  - Cumplir con la trazabilidad pre-firma requerida por NOM-024
 *
 * Al firmar la nota, ya no se versionan nuevos cambios (queda inmutable).
 */
import {
  collection, addDoc, getDocs, query, orderBy, limit as fbLimit,
  doc, getDoc,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { NotaMedica } from '@/types/expediente'

export interface NotaVersion {
  id?: string
  /** Cuándo se guardó esta versión */
  timestamp: string
  /** UID del usuario que la guardó */
  guardadoPor: string
  /** Email del usuario */
  guardadoEmail?: string
  /** Snapshot de la nota en ese momento (sin id) */
  snapshot: Omit<NotaMedica, 'id'>
  /** Tamaño del snapshot en chars para detectar cambios significativos */
  size: number
}

/**
 * Crea una nueva versión del borrador.
 * Se llama ANTES de updateNota cuando el estado sigue siendo 'borrador'.
 */
export async function guardarVersion(
  clinicId: string,
  patientId: string,
  notaId: string,
  snapshot: Omit<NotaMedica, 'id'>,
  guardadoPor: string,
  guardadoEmail?: string,
): Promise<void> {
  // Solo versionar borradores. Si ya está firmada, NO se versiona (queda inmutable).
  if (snapshot.estado === 'firmada') return
  try {
    const ref = collection(db, 'clinics', clinicId, 'patients', patientId, 'notas', notaId, 'versions')
    const version: NotaVersion = {
      timestamp: new Date().toISOString(),
      guardadoPor,
      guardadoEmail,
      snapshot,
      size: JSON.stringify(snapshot).length,
    }
    await addDoc(ref, version)
  } catch {
    /* no-op: no debe romper la operación clínica */
  }
}

/**
 * Lista las últimas N versiones de una nota.
 */
export async function listarVersiones(
  clinicId: string,
  patientId: string,
  notaId: string,
  limite = 20,
): Promise<NotaVersion[]> {
  const ref = collection(db, 'clinics', clinicId, 'patients', patientId, 'notas', notaId, 'versions')
  const q = query(ref, orderBy('timestamp', 'desc'), fbLimit(limite))
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as NotaVersion))
}

/**
 * Obtiene una versión específica (para restaurarla).
 */
export async function obtenerVersion(
  clinicId: string,
  patientId: string,
  notaId: string,
  versionId: string,
): Promise<NotaVersion | null> {
  const snap = await getDoc(
    doc(db, 'clinics', clinicId, 'patients', patientId, 'notas', notaId, 'versions', versionId),
  )
  if (!snap.exists()) return null
  return { id: snap.id, ...snap.data() } as NotaVersion
}
