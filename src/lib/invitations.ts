/**
 * Invitaciones de clínica — el lado del NAVEGADOR.
 *
 * Colección top-level `clinic_invitations/{code}`. El invitado la LEE con el
 * código directamente (`allow get: if true`), porque todavía no tiene membresía
 * que le abra ninguna otra puerta.
 *
 * Todo lo demás —crear, listar, revocar— pasa por `/api/clinic/invitaciones`
 * (Admin SDK). Ver la cabecera de esa ruta: el listado desde el navegador
 * llevaba tiempo roto contra `allow list: if false`, y la creación desde el
 * navegador ataba lo que el producto puede guardar a que las reglas
 * desplegadas ya conocieran el campo.
 *
 * Flujo:
 *  1. Médico genera invitación → code aleatorio, caduca en 7 días y puede llevar
 *     el CORREO de la persona invitada (entonces sólo ella la acepta).
 *  2. Comparte el enlace /unirse/{code} por WhatsApp o por correo.
 *  3. Invitado abre el enlace y **crea su cuenta ahí mismo**, con contraseña.
 *     Antes esto rebotaba a `/registro?invite=code` y el rebote se perdía: ver
 *     la cabecera de `src/app/unirse/[code]/page.tsx`.
 *  4. /unirse acepta: crea clinic_members/{uid} + marca invitación como used.
 */
import { doc, getDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { invitacionVigente } from '@/lib/security/invitacion-vigente'
import { fetchAutenticado } from '@/lib/auth-client'

/**
 * La FORMA del documento y el generador del código viven aparte y sin Firebase,
 * porque el servidor también los necesita. Se reexportan para que ningún sitio
 * que ya importaba de aquí tenga que cambiar — y para que no aparezca nunca una
 * segunda copia de la forma congelada.
 */
export {
  DURACION_MS, ROLES_INVITACION, generarCodigo, documentoDeInvitacion,
} from '@/lib/invitaciones/documento'
export type { Invitacion, RolInvitacion } from '@/lib/invitaciones/documento'

import type { Invitacion, RolInvitacion } from '@/lib/invitaciones/documento'

const COL = 'clinic_invitations'
const RUTA = '/api/clinic/invitaciones'

/** Crea una invitación. La escribe el SERVIDOR con el rol y el autor validados. */
export async function crearInvitacion(
  clinicId: string,
  clinicNombre: string,
  role: RolInvitacion,
  _creador: { uid: string; email: string },
  nombreInvitado?: string,
  especialidad?: string,
  emailInvitado?: string,
): Promise<Invitacion> {
  // `_creador` se conserva en la firma por compatibilidad con quien ya llamaba
  // así, pero NO se manda: el autor sale del token en el servidor. Mandarlo
  // sería ofrecerle al cliente firmar una invitación con el uid de otro.
  const res = await fetchAutenticado(RUTA, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clinicId, clinicNombre, role, nombreInvitado, especialidad, emailInvitado }),
  })
  const d = await res.json().catch(() => ({}))
  if (!res.ok || !d?.ok) throw new Error(d?.error || 'No se pudo crear la invitación')
  return d.invitacion as Invitacion
}

/**
 * Lee una invitación por código. Ésta SÍ va directa a Firestore: quien la abre
 * todavía no tiene sesión, así que no hay token que mandarle a ninguna ruta.
 * `allow get: if true` existe exactamente para este momento.
 */
export async function obtenerInvitacion(code: string): Promise<Invitacion | null> {
  const snap = await getDoc(doc(db, COL, code))
  if (!snap.exists()) return null
  return { code, ...(snap.data() as Omit<Invitacion, 'code'>) }
}

/** Lista las invitaciones de una clínica (para el panel del médico), vía servidor. */
export async function listarInvitaciones(clinicId: string): Promise<Invitacion[]> {
  const res = await fetchAutenticado(`${RUTA}?clinicId=${encodeURIComponent(clinicId)}`)
  const d = await res.json().catch(() => ({}))
  if (!res.ok || !d?.ok) throw new Error(d?.error || 'No se pudieron leer las invitaciones')
  return (d.invitaciones ?? []) as Invitacion[]
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

/** Revoca una invitación pendiente (la borra), vía servidor. */
export async function revocarInvitacion(code: string, clinicId: string): Promise<void> {
  const res = await fetchAutenticado(`${RUTA}?code=${encodeURIComponent(code)}&clinicId=${encodeURIComponent(clinicId)}`, {
    method: 'DELETE',
  })
  const d = await res.json().catch(() => ({}))
  if (!res.ok || !d?.ok) throw new Error(d?.error || 'No se pudo revocar la invitación')
}
