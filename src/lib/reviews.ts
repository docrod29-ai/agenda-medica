/**
 * Reseñas de pacientes.
 *
 * Almacenamiento:
 *  - Solicitud: clinic_review_requests/{token}  (top-level, accesible con token)
 *  - Reseña: clinics/{clinicId}/reviews/{id}
 *
 * Flujo: tras una cita atendida, el médico (o automatización futura) envía un
 * link único al paciente: /resena/{token}. El paciente califica 1-5 y deja
 * texto opcional. La reseña queda con estado="pendiente" hasta que el médico
 * la publica o la rechaza desde el dashboard.
 */
import {
  collection, doc, getDoc, setDoc, updateDoc, query, where, orderBy, getDocs,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'

const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
function generarToken(): string {
  let s = ''
  for (let i = 0; i < 12; i++) s += ALFABETO[Math.floor(Math.random() * ALFABETO.length)]
  return s
}

export interface ReviewRequest {
  token: string
  clinicId: string
  citaId: string
  pacienteId?: string
  pacienteNombre: string
  medicoNombre: string
  createdAt: string
  expiresAt: string
  used: boolean
}

export interface Review {
  id: string
  citaId?: string
  pacienteNombre: string  // se puede mostrar inicial + apellido para privacidad
  rating: number          // 1-5
  texto: string
  estado: 'pendiente' | 'publicada' | 'rechazada'
  createdAt: string
  publicadaEn?: string
  moderadoPor?: string
}

const REQ_COL = 'clinic_review_requests'

/** Crea una solicitud de reseña — devuelve el token para construir el link. */
export async function crearSolicitudResena(
  clinicId: string,
  data: { citaId: string; pacienteId?: string; pacienteNombre: string; medicoNombre: string },
): Promise<ReviewRequest> {
  const token = generarToken()
  const now = new Date()
  const r: ReviewRequest = {
    token, clinicId,
    citaId: data.citaId,
    pacienteId: data.pacienteId,
    pacienteNombre: data.pacienteNombre,
    medicoNombre: data.medicoNombre,
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + 30 * 86400_000).toISOString(),
    used: false,
  }
  await setDoc(doc(db, REQ_COL, token), r)
  return r
}

export async function obtenerSolicitudResena(token: string): Promise<ReviewRequest | null> {
  const snap = await getDoc(doc(db, REQ_COL, token))
  if (!snap.exists()) return null
  return { token, ...(snap.data() as Omit<ReviewRequest, 'token'>) }
}

/** El paciente envía la reseña (queda en estado pendiente, esperando moderación). */
export async function enviarResena(
  token: string,
  data: { rating: number; texto: string },
): Promise<{ ok: boolean; motivo?: string }> {
  if (data.rating < 1 || data.rating > 5) return { ok: false, motivo: 'Calificación inválida' }
  // Se hace por SERVIDOR (Admin SDK): el paciente es anónimo (la regla de `reviews`
  // exige auth) y así crear-reseña + marcar-usada es atómico (no quema el enlace si falla).
  try {
    const res = await fetch('/api/public/resena', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, rating: data.rating, texto: data.texto }),
    })
    const d = await res.json().catch(() => ({ ok: false, motivo: 'Error de red' }))
    return { ok: !!d.ok, motivo: d.motivo }
  } catch {
    return { ok: false, motivo: 'Sin conexión. Intenta de nuevo.' }
  }
}

/** Lista todas las reseñas de la clínica (para dashboard moderación). */
export async function listarResenas(clinicId: string): Promise<Review[]> {
  const snap = await getDocs(query(
    collection(db, 'clinics', clinicId, 'reviews'),
    orderBy('createdAt', 'desc'),
  ))
  return snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<Review, 'id'>) }))
}

/** Solo lista las publicadas (para la página pública del médico). */
export async function listarResenasPublicadas(clinicId: string): Promise<Review[]> {
  const snap = await getDocs(query(
    collection(db, 'clinics', clinicId, 'reviews'),
    where('estado', '==', 'publicada'),
    orderBy('publicadaEn', 'desc'),
  ))
  return snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<Review, 'id'>) }))
}

export async function moderarResena(
  clinicId: string,
  reviewId: string,
  decision: 'publicar' | 'rechazar',
  moderador: string,
): Promise<void> {
  await updateDoc(doc(db, 'clinics', clinicId, 'reviews', reviewId), {
    estado: decision === 'publicar' ? 'publicada' : 'rechazada',
    publicadaEn: decision === 'publicar' ? new Date().toISOString() : null,
    moderadoPor: moderador,
  })
}

/** Anonimiza el nombre: "Juan García López" → "Juan G." */
export function nombreAnonimizado(nombre: string): string {
  const t = nombre.trim()
  if (!t) return 'Anónimo'
  const partes = t.split(/\s+/)
  if (partes.length === 1) return partes[0]
  return `${partes[0]} ${partes[1][0]}.`
}
