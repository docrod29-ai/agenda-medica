/**
 * ACUÑAR EL TOKEN DE LA SALA, CON LA VERSIÓN QUE DICE EL EXPEDIENTE.
 *
 * Una capa finísima sobre `enlace-de-sala.ts`: lo único que añade es la lectura
 * de `portalTokenVersion`, que exige Firestore. La decisión —cuántos días, si
 * procede o no— vive en el módulo puro y se prueba allí.
 *
 * Existe para que la regla esté escrita **una vez**. Los tres emisores de
 * servidor (el cron de recordatorios y los dos caminos del bot de WhatsApp)
 * llaman aquí; si mañana cambia el alcance o el techo de vigencia, cambia en un
 * sitio. Escribirlo tres veces es exactamente la causa raíz de REG-300.
 *
 * Sólo servidor.
 */
import { adminDb } from '@/lib/firebase-admin'
import { ES_TELECONSULTA } from '@/lib/telesalud/donde-es'
import { tokenDeSalaParaElPaciente } from '@/lib/telesalud/enlace-de-sala'

export interface PeticionDeToken {
  /** `tipo` de la cita, tal como se guarda. Si no es teleconsulta no se acuña. */
  tipo?: string
  clinicId: string
  patientId?: string
  /** Instante real de inicio de la cita (`instanteMX(...).getTime()`). */
  inicioCitaMs: number
  ahoraMs: number
}

/**
 * Token del enlace de sala para el paciente de esta cita, o `undefined`.
 *
 * `undefined` es una respuesta legítima y frecuente: cita presencial, cita sin
 * expediente vinculado, o cita demasiado lejos para que su credencial viaje hoy
 * por WhatsApp. En todos esos casos `dondeEsLaCita` dice la verdad en vez de
 * mandar un enlace que contesta 404.
 */
export async function tokenDeSalaDesdeElServidor(p: PeticionDeToken): Promise<string | undefined> {
  if (String(p.tipo ?? '').trim().toLowerCase() !== ES_TELECONSULTA) return undefined
  if (!p.clinicId || !p.patientId) return undefined

  let version = 0
  try {
    const snap = await adminDb.collection('clinics').doc(p.clinicId)
      .collection('patients').doc(p.patientId).get()
    version = Number((snap.data() as { portalTokenVersion?: number } | undefined)?.portalTokenVersion ?? 0)
  } catch {
    /* Sin versión conocida se emite la 0, igual que /api/portal/link: el enlace
       sirve, y una revocación posterior lo corta igual. */
  }

  return tokenDeSalaParaElPaciente({
    clinicId: p.clinicId,
    patientId: p.patientId,
    inicioCitaMs: p.inicioCitaMs,
    ahoraMs: p.ahoraMs,
    version,
  })
}
