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
import { instanteMX, TZ_DEFAULT } from '@/lib/timezone'

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

/**
 * Instante (ms UTC) de una entrada que puede venir como instante absoluto (ISO con
 * Z u offset) o como HORA DE PARED ("YYYY-MM-DD HH:MM") de la clínica. L5 auditoría
 * maestra: la hora de pared antes se interpretaba en la zona del RUNTIME (UTC en
 * Vercel) → los bloqueos quedaban corridos ~6h (más para el norte). Ahora la hora
 * de pared se ancla a la zona de la clínica.
 */
function instanteDeEntrada(s: string, tz: string): number {
  if (/[zZ]$|[+-]\d\d:?\d\d$/.test(s)) return new Date(s).getTime()  // ya es absoluto
  const iso = s.replace(' ', 'T')
  return instanteMX(iso.slice(0, 10), iso.slice(11, 16), tz).getTime()
}

/** Verifica si una fecha/hora cae dentro de algún bloque activo. */
export function estaBloqueado(
  fechaHora: string,                  // ISO absoluto o "YYYY-MM-DD HH:MM" (pared)
  bloques: TimeBlock[],
  medicoId?: string,
  tz: string = TZ_DEFAULT,            // zona de la clínica (config.zonaHoraria)
): TimeBlock | null {
  const t = instanteDeEntrada(fechaHora, tz)
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
