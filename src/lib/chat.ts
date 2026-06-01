/**
 * Chat interno de la clínica — médico ↔ asistente.
 *
 * Mensajes en `clinics/{clinicId}/chat/{msgId}` (real-time vía onSnapshot).
 * Lectura por usuario en `clinics/{clinicId}/chat_reads/{uid}` con lastReadAt.
 * Aislado multi-tenant por las reglas de Firestore (isMember(clinicId)).
 */
import {
  collection, doc, addDoc, setDoc, getDoc, query, orderBy, limit, onSnapshot,
  serverTimestamp, Timestamp,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'

export interface ChatMessage {
  id: string
  text: string
  senderId: string
  senderEmail: string
  senderName: string
  senderRol: string
  createdAt: string         // ISO (normalizado en cliente)
  createdAtTs?: Timestamp   // por si quieres ordenar/comparar
}

const MAX_TEXT = 2000

function colMensajes(clinicId: string) {
  return collection(db, 'clinics', clinicId, 'chat')
}
function docLectura(clinicId: string, uid: string) {
  return doc(db, 'clinics', clinicId, 'chat_reads', uid)
}

/** Envía un mensaje. Devuelve el id. Lanza si está vacío o demasiado largo. */
export async function enviarMensaje(
  clinicId: string,
  texto: string,
  sender: { uid: string; email: string; nombre: string; rol: string },
): Promise<string> {
  const t = texto.trim()
  if (!t) throw new Error('Mensaje vacío')
  if (t.length > MAX_TEXT) throw new Error(`Máximo ${MAX_TEXT} caracteres`)
  const ref = await addDoc(colMensajes(clinicId), {
    text: t,
    senderId: sender.uid,
    senderEmail: sender.email,
    senderName: sender.nombre,
    senderRol: sender.rol,
    createdAtTs: serverTimestamp(),
  })
  return ref.id
}

/** Suscripción en tiempo real a los últimos N mensajes (orden ASC para mostrar). */
export function suscribirMensajes(
  clinicId: string,
  onMessages: (msgs: ChatMessage[]) => void,
  cantidad = 200,
): () => void {
  const q = query(colMensajes(clinicId), orderBy('createdAtTs', 'desc'), limit(cantidad))
  return onSnapshot(q, snap => {
    const out: ChatMessage[] = []
    snap.forEach(d => {
      const data = d.data() as Record<string, unknown>
      const ts = data.createdAtTs as Timestamp | undefined
      out.push({
        id: d.id,
        text: String(data.text ?? ''),
        senderId: String(data.senderId ?? ''),
        senderEmail: String(data.senderEmail ?? ''),
        senderName: String(data.senderName ?? ''),
        senderRol: String(data.senderRol ?? ''),
        createdAt: ts ? ts.toDate().toISOString() : new Date().toISOString(),
        createdAtTs: ts,
      })
    })
    // Devolvemos ordenado ASC (viejo arriba, nuevo abajo)
    out.reverse()
    onMessages(out)
  })
}

/** Marca como leído hasta este momento. */
export async function marcarComoLeido(clinicId: string, uid: string): Promise<void> {
  await setDoc(docLectura(clinicId, uid), { lastReadAt: new Date().toISOString() })
}

/** Obtiene el último timestamp de lectura del usuario. */
export async function obtenerUltimaLectura(clinicId: string, uid: string): Promise<string | null> {
  try {
    const snap = await getDoc(docLectura(clinicId, uid))
    if (!snap.exists()) return null
    return (snap.data().lastReadAt as string) ?? null
  } catch { return null }
}

/** Suscripción al lastReadAt del usuario. */
export function suscribirLectura(
  clinicId: string, uid: string, onChange: (lastReadAt: string | null) => void,
): () => void {
  return onSnapshot(docLectura(clinicId, uid), snap => {
    onChange(snap.exists() ? (snap.data().lastReadAt as string) ?? null : null)
  })
}

/** Cuenta cuántos mensajes en una lista son no leídos por este usuario. */
export function contarNoLeidos(msgs: ChatMessage[], uid: string, lastReadAt: string | null): number {
  if (!lastReadAt) return msgs.filter(m => m.senderId !== uid).length
  return msgs.filter(m => m.senderId !== uid && m.createdAt > lastReadAt).length
}
