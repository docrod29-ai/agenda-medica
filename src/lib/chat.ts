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

/**
 * LO QUE VIAJA EN EL MENSAJE: texto, autor y hora. Nada más (Panel de Lujo ZL-012).
 *
 * `senderName` y `senderRol` viajaban dentro del documento y la regla sólo
 * ataba `senderId`: cualquier miembro podía firmar «Dra. X · medico». El nombre
 * y el rol se RESUELVEN al leer, desde `clinic_members/{uid}` (el rol real) y
 * `members/{uid}` (el apodo elegido), que son la fuente de verdad. Puro, para
 * que la prueba fije la forma exacta que la regla congela.
 */
export function documentoDeMensaje(texto: string, uid: string): { text: string; senderId: string } {
  const t = texto.trim()
  if (!t) throw new Error('Mensaje vacío')
  if (t.length > MAX_TEXT) throw new Error(`Máximo ${MAX_TEXT} caracteres`)
  return { text: t, senderId: uid }
}

/** Envía un mensaje. Devuelve el id. Lanza si está vacío o demasiado largo. */
export async function enviarMensaje(
  clinicId: string,
  texto: string,
  sender: { uid: string; email?: string; nombre?: string; rol?: string },
): Promise<string> {
  const ref = await addDoc(colMensajes(clinicId), {
    ...documentoDeMensaje(texto, sender.uid),
    createdAtTs: serverTimestamp(),
  })
  return ref.id
}

/** Quién es cada uid, resuelto desde las colecciones que sí acreditan identidad. */
export interface IdentidadDeRemitente { nombre: string; rol: string; email: string }

/**
 * Resuelve nombre, rol y correo de un remitente. El ROL sale de
 * `clinic_members/{uid}`, que sólo escribe el admin; el NOMBRE, del apodo en
 * `members/{uid}` y, si no hay, del `displayName`/correo de la membresía.
 * Falla-cerrado: si no se puede leer, no se inventa — «Miembro» sin rol.
 */
export async function resolverRemitente(clinicId: string, uid: string): Promise<IdentidadDeRemitente> {
  let rol = ''
  let email = ''
  let nombre = ''
  try {
    const m = await getDoc(doc(db, 'clinic_members', uid))
    if (m.exists()) {
      const d = m.data() as { role?: string; email?: string; displayName?: string }
      rol = String(d.role ?? '')
      email = String(d.email ?? '')
      nombre = String(d.displayName ?? '')
    }
  } catch { /* sin membresía legible: sin rol */ }
  try {
    const apodo = await getDoc(doc(db, 'clinics', clinicId, 'members', uid))
    const custom = apodo.exists() ? String((apodo.data() as { displayName?: string }).displayName ?? '') : ''
    if (custom) nombre = custom
  } catch { /* el apodo es opcional */ }
  if (!nombre) nombre = email.split('@')[0] || 'Miembro'
  return { nombre, rol, email }
}

/**
 * Suscripción en tiempo real a los últimos N mensajes (orden ASC para mostrar).
 *
 * El nombre y el rol de cada remitente se resuelven aquí y se cachean por uid;
 * lo que el documento diga de sí mismo (`senderName`/`senderRol` de mensajes
 * anteriores a ZL-012) NO se usa: es justo lo que se podía falsificar.
 */
export function suscribirMensajes(
  clinicId: string,
  onMessages: (msgs: ChatMessage[]) => void,
  cantidad = 200,
  resolver: (clinicId: string, uid: string) => Promise<IdentidadDeRemitente> = resolverRemitente,
): () => void {
  const q = query(colMensajes(clinicId), orderBy('createdAtTs', 'desc'), limit(cantidad))
  const identidades = new Map<string, Promise<IdentidadDeRemitente>>()
  const identidadDe = (uid: string) => {
    let p = identidades.get(uid)
    if (!p) { p = resolver(clinicId, uid); identidades.set(uid, p) }
    return p
  }
  let generacion = 0
  return onSnapshot(q, snap => {
    const mia = ++generacion
    const crudos: { id: string; text: string; senderId: string; ts?: Timestamp }[] = []
    snap.forEach(d => {
      const data = d.data() as Record<string, unknown>
      crudos.push({
        id: d.id,
        text: String(data.text ?? ''),
        senderId: String(data.senderId ?? ''),
        ts: data.createdAtTs as Timestamp | undefined,
      })
    })
    void Promise.all(crudos.map(async c => {
      const quien = await identidadDe(c.senderId)
      return {
        id: c.id,
        text: c.text,
        senderId: c.senderId,
        senderEmail: quien.email,
        senderName: quien.nombre,
        senderRol: quien.rol,
        createdAt: c.ts ? c.ts.toDate().toISOString() : new Date().toISOString(),
        createdAtTs: c.ts,
      } satisfies ChatMessage
    })).then(out => {
      if (mia !== generacion) return   // llegó otro snapshot mientras resolvíamos
      // Devolvemos ordenado ASC (viejo arriba, nuevo abajo)
      out.reverse()
      onMessages(out)
    })
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
