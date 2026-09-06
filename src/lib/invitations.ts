/**
 * Invitaciones de clínica.
 *
 * Colección top-level `clinic_invitations/{code}` para que el invitado pueda
 * leerla directamente con el código del link, antes de tener membresía.
 *
 * Flujo:
 *  1. Médico genera invitación → se guarda con code aleatorio y expira en 7d.
 *  2. Comparte el link /unirse/{code} por WhatsApp/email.
 *  3. Invitado abre el link → si no tiene cuenta, /registro?invite=code → /unirse/code.
 *  4. /unirse acepta: crea clinic_members/{uid} + marca invitación como used.
 */
import {
  collection, doc, getDoc, getDocs, deleteDoc, setDoc,
  query, where, orderBy,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { invitacionVigente } from '@/lib/security/invitacion-vigente'

export type RolInvitacion = 'secretaria' | 'medico' | 'admin' | 'enfermeria' | 'farmacia' | 'laboratorio'

export interface Invitacion {
  code: string                    // = doc id
  clinicId: string
  clinicNombre: string
  role: RolInvitacion
  nombreInvitado?: string         // opcional, para mostrar "Bienvenida María"
  especialidad?: string           // profesión/especialidad (para la ficha del médico)
  creadoPor: string               // uid del médico que invitó
  creadoPorEmail: string
  createdAt: string
  expiresAt: string               // ISO
  /**
   * La MISMA caducidad en epoch-ms. Las reglas de Firestore no saben leer ISO,
   * y sin un número no podían exigir que la invitación caducara (ZL-011): una
   * invitación sin `expiresAt` era eterna. El servidor sigue leyendo `expiresAt`.
   */
  expiresAtMs: number
  used: boolean
  usedBy?: string                 // uid del que aceptó
  usedAt?: string                 // ISO
}

const COL = 'clinic_invitations'
export const DURACION_MS = 7 * 24 * 60 * 60 * 1000  // 7 días

const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'  // sin I,O,0,1 para no confundir

/**
 * Código de invitación con azar CRIPTOGRÁFICO (Panel de Lujo ZL-011).
 *
 * `Math.random` no está pensado para secretos: es predecible si se observa la
 * secuencia. El código es lo único que hace falta para unirse al consultorio,
 * así que sale de `crypto.getRandomValues`. El alfabeto tiene 32 símbolos, que
 * dividen exactamente los 256 valores de un byte: `% 32` no sesga.
 */
export function generarCodigo(azar: (n: number) => Uint8Array = bytesAleatorios): string {
  const bytes = azar(10)
  let s = ''
  for (let i = 0; i < 10; i++) s += ALFABETO[bytes[i] % ALFABETO.length]
  return s
}

function bytesAleatorios(n: number): Uint8Array {
  const out = new Uint8Array(n)
  globalThis.crypto.getRandomValues(out)
  return out
}

/** Lo que se escribe al crear. Puro, para que la prueba lo fije sin Firestore. */
export function documentoDeInvitacion(p: {
  code: string; clinicId: string; clinicNombre: string; role: RolInvitacion
  creador: { uid: string; email: string }; nombreInvitado?: string; especialidad?: string; ahoraMs: number
}): Invitacion {
  const data: Invitacion = {
    code: p.code, clinicId: p.clinicId, clinicNombre: p.clinicNombre, role: p.role,
    creadoPor: p.creador.uid,
    creadoPorEmail: p.creador.email,
    createdAt: new Date(p.ahoraMs).toISOString(),
    expiresAt: new Date(p.ahoraMs + DURACION_MS).toISOString(),
    expiresAtMs: p.ahoraMs + DURACION_MS,
    used: false,
  }
  // Sólo si vienen: Firestore rechaza `undefined` y la regla congela la forma.
  const nombre = p.nombreInvitado?.trim()
  if (nombre) data.nombreInvitado = nombre
  const esp = p.especialidad?.trim()
  if (esp) data.especialidad = esp
  return data
}

/** Crea una invitación y devuelve el código. */
export async function crearInvitacion(
  clinicId: string,
  clinicNombre: string,
  role: RolInvitacion,
  creador: { uid: string; email: string },
  nombreInvitado?: string,
  especialidad?: string,
): Promise<Invitacion> {
  const code = generarCodigo()
  const data = documentoDeInvitacion({
    code, clinicId, clinicNombre, role, creador, nombreInvitado, especialidad, ahoraMs: Date.now(),
  })
  // Usamos el code como ID del doc para lectura O(1) por código
  await setDoc(doc(db, COL, code), data)
  return data
}

/** Lee una invitación por código (sin requerir membresía — el invitado aún no la tiene). */
export async function obtenerInvitacion(code: string): Promise<Invitacion | null> {
  const snap = await getDoc(doc(db, COL, code))
  if (!snap.exists()) return null
  return { code, ...(snap.data() as Omit<Invitacion, 'code'>) }
}

/** Lista las invitaciones de una clínica (para el panel del médico). */
export async function listarInvitaciones(clinicId: string): Promise<Invitacion[]> {
  const q = query(collection(db, COL), where('clinicId', '==', clinicId), orderBy('createdAt', 'desc'))
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ code: d.id, ...(d.data() as Omit<Invitacion, 'code'>) }))
}

/** Verifica si la invitación es válida (no usada, no expirada). */
export function esValida(inv: Invitacion, ahoraMs: number = Date.now()): { ok: true } | { ok: false; motivo: string } {
  // Sin caducidad legible no es válida: una invitación eterna no existe (ZL-011).
  return invitacionVigente(inv, ahoraMs)
}

/**
 * Acepta la invitación vía SERVIDOR (/api/clinic/unirse, Admin SDK). El servidor
 * valida la invitación y crea la membresía con el rol de la invitación en una
 * transacción. El cliente ya NO escribe clinic_members directo (cerraba la
 * escalada de privilegios: auto-asignarse admin en cualquier clínica).
 * El parámetro `user` se conserva por compatibilidad de firma pero no se usa
 * (el uid sale del token en el servidor).
 */
export async function aceptarInvitacion(
  code: string,
  _user?: { uid: string; email: string },
): Promise<{ ok: boolean; motivo?: string; clinicId?: string }> {
  const { fetchAutenticado } = await import('@/lib/auth-client')
  try {
    const res = await fetchAutenticado('/api/clinic/unirse', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    })
    const d = await res.json().catch(() => ({ ok: false, motivo: 'Error de red' }))
    return { ok: !!d.ok, motivo: d.motivo, clinicId: d.clinicId }
  } catch {
    return { ok: false, motivo: 'Sin conexión. Intenta de nuevo.' }
  }
}

/** Revoca una invitación pendiente (la borra). */
export async function revocarInvitacion(code: string): Promise<void> {
  await deleteDoc(doc(db, COL, code))
}
