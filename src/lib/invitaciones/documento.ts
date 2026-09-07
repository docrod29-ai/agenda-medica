/**
 * LA INVITACIÓN COMO DATO — puro, sin Firebase de ningún lado.
 *
 * Vivía dentro de `src/lib/invitations.ts`, que importa el SDK de cliente
 * (`firebase/firestore`, `@/lib/firebase`). Al pasar la CREACIÓN de la
 * invitación al servidor —ver `src/app/api/clinic/invitaciones/route.ts`— la
 * ruta habría tenido que importar ese módulo entero, y con él inicializar una
 * aplicación de cliente dentro de una función de Vercel. Innecesario, y una de
 * las formas conocidas de que el build reviente al recolectar páginas.
 *
 * Aquí sólo está la FORMA del documento y el generador del código. Los dos
 * lados —el navegador, para pintar; el servidor, para escribir— hablan de la
 * misma pieza, que es lo que impide que la forma congelada de `firestore.rules`
 * y lo que se escribe de verdad se separen.
 *
 * `src/lib/invitations.ts` reexporta todo esto: ningún sitio que ya importaba
 * de allí tuvo que cambiar.
 */

export type RolInvitacion = 'secretaria' | 'medico' | 'admin' | 'enfermeria' | 'farmacia' | 'laboratorio'

/** Los roles que una invitación puede llevar. El servidor valida contra esta lista. */
export const ROLES_INVITACION: readonly RolInvitacion[] = [
  'secretaria', 'medico', 'admin', 'enfermeria', 'farmacia', 'laboratorio',
]

export interface Invitacion {
  code: string                    // = doc id
  clinicId: string
  clinicNombre: string
  role: RolInvitacion
  nombreInvitado?: string         // opcional, para mostrar "Bienvenida María"
  /**
   * Correo de la persona invitada. OPCIONAL, y cuando está, MANDA:
   * `/api/clinic/unirse` sólo deja aceptar a esa dirección. Sin él la
   * invitación es al portador — así estaban las emitidas antes de este campo y
   * así se quedan. Ver `invitacionEsParaEsteCorreo`.
   */
  emailInvitado?: string
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

/** Un correo comparable: sin espacios y en minúsculas. Vacío si no es texto. */
function correoNormalizado(v: unknown): string {
  return typeof v === 'string' ? v.trim().toLowerCase() : ''
}

/** Lo que se escribe al crear. Puro, para que la prueba lo fije sin Firestore. */
export function documentoDeInvitacion(p: {
  code: string; clinicId: string; clinicNombre: string; role: RolInvitacion
  creador: { uid: string; email: string }; nombreInvitado?: string; emailInvitado?: string
  especialidad?: string; ahoraMs: number
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
  // Normalizado al escribir, no al comparar: si se guarda «Maria@Gmail.com  » y
  // ella entra como «maria@gmail.com», la comparación del servidor tiene que dar
  // igual sin depender de que alguien se acuerde de normalizar en cada sitio.
  const correo = correoNormalizado(p.emailInvitado)
  if (correo) data.emailInvitado = correo
  const esp = p.especialidad?.trim()
  if (esp) data.especialidad = esp
  return data
}
