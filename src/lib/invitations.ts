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
  used: boolean
  usedBy?: string                 // uid del que aceptó
  usedAt?: string                 // ISO
}

const COL = 'clinic_invitations'
const DURACION_MS = 7 * 24 * 60 * 60 * 1000  // 7 días

function generarCodigo(): string {
  const alfabeto = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'  // sin I,O,0,1 para no confundir
  let s = ''
  for (let i = 0; i < 10; i++) s += alfabeto[Math.floor(Math.random() * alfabeto.length)]
  return s
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
  const now = new Date()
  const data: Invitacion = {
    code, clinicId, clinicNombre, role,
    nombreInvitado: nombreInvitado?.trim() || undefined,
    especialidad: especialidad?.trim() || undefined,
    creadoPor: creador.uid,
    creadoPorEmail: creador.email,
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + DURACION_MS).toISOString(),
    used: false,
  }
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
export function esValida(inv: Invitacion): { ok: true } | { ok: false; motivo: string } {
  if (inv.used) return { ok: false, motivo: 'Esta invitación ya fue usada.' }
  if (new Date() > new Date(inv.expiresAt)) return { ok: false, motivo: 'Esta invitación ha expirado.' }
  return { ok: true }
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
