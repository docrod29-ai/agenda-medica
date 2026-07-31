/**
 * Bloqueo de horarios (vacaciones, ausencias puntuales, bloques de tiempo).
 *
 * Vive en `clinics/{clinicId}/time_blocks/{id}`. Cada bloque tiene fecha
 * de inicio, fecha de fin y motivo opcional. Cuando un slot cae dentro de
 * un bloque, no se ofrece para reservar (ni a través del bot, ni del
 * portal, ni de la agenda).
 *
 * Este archivo es la capa de ACCESO A DATOS (necesita el SDK del navegador).
 * La lógica pura vive en `time-blocks-core.ts` y se re-exporta aquí para que
 * ningún llamador existente cambie. Si tu módulo corre en el SERVIDOR, importa
 * del núcleo directamente — ver el comentario de cabecera de ese archivo.
 */
import {
  collection, doc, addDoc, deleteDoc, getDocs, query, orderBy,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { TimeBlock } from '@/lib/time-blocks-core'

export type { TipoBloque, TimeBlock } from '@/lib/time-blocks-core'
export { estaBloqueado, TIPO_BLOQUE_LABEL } from '@/lib/time-blocks-core'

function col(clinicId: string) {
  return collection(db, 'clinics', clinicId, 'time_blocks')
}

export async function listarBloques(clinicId: string): Promise<TimeBlock[]> {
  const snap = await getDocs(query(col(clinicId), orderBy('desde', 'asc')))
  return snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<TimeBlock, 'id'>) }))
}

export async function crearBloque(
  clinicId: string,
  data: Omit<TimeBlock, 'id' | 'createdAt'>,
): Promise<string> {
  if (new Date(data.hasta) <= new Date(data.desde)) {
    throw new Error('"Hasta" debe ser posterior a "Desde"')
  }
  const ref = await addDoc(col(clinicId), { ...data, createdAt: new Date().toISOString() })
  return ref.id
}

export async function borrarBloque(clinicId: string, id: string): Promise<void> {
  await deleteDoc(doc(col(clinicId), id))
}
