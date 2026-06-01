/**
 * Bloqueo de horarios (vacaciones, ausencias puntuales, bloques de tiempo).
 *
 * Vive en `clinics/{clinicId}/time_blocks/{id}`. Cada bloque tiene fecha
 * de inicio, fecha de fin y motivo opcional. Cuando un slot cae dentro de
 * un bloque, no se ofrece para reservar (ni a través del bot, ni del
 * portal, ni de la agenda).
 */
import {
  collection, doc, addDoc, deleteDoc, getDocs, query, orderBy,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'

export type TipoBloque = 'vacaciones' | 'ausencia' | 'evento' | 'mantenimiento' | 'otro'

export interface TimeBlock {
  id: string
  desde: string            // ISO datetime
  hasta: string            // ISO datetime
  tipo: TipoBloque
  motivo?: string
  medicoId?: string        // opcional: bloque solo para un médico
  createdAt: string
  creadoPor: string
}

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

/** Verifica si una fecha/hora cae dentro de algún bloque activo. */
export function estaBloqueado(
  fechaHora: string,                  // ISO o "YYYY-MM-DD HH:MM"
  bloques: TimeBlock[],
  medicoId?: string,
): TimeBlock | null {
  const t = new Date(fechaHora.replace(' ', 'T')).getTime()
  if (isNaN(t)) return null
  for (const b of bloques) {
    const desde = new Date(b.desde).getTime()
    const hasta = new Date(b.hasta).getTime()
    if (t >= desde && t < hasta) {
      // Si el bloque es para un médico específico, solo bloquea a ese médico
      if (b.medicoId && medicoId && b.medicoId !== medicoId) continue
      return b
    }
  }
  return null
}

export const TIPO_BLOQUE_LABEL: Record<TipoBloque, string> = {
  vacaciones: '🌴 Vacaciones',
  ausencia: '✋ Ausencia',
  evento: '📅 Evento',
  mantenimiento: '🔧 Mantenimiento',
  otro: '⏸️ Otro',
}
