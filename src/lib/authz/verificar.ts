/**
 * GUARDIA DE REQUEST POR CAPACIDAD (unidad Nexus OS E0-07).
 *
 * Sustituye a `verificarMedico`/`verificarMiembro` en las rutas de API. Vive en un
 * archivo separado de `capabilities.ts` por dos razones concretas:
 *  1. el núcleo de capacidades queda PURO (se prueba sin un solo mock),
 *  2. no se crea un ciclo de imports: `auth-server.ts` no importa `authz/`;
 *     `authz/` sí importa `auth-server.ts`.
 *
 * La semántica es DELIBERADAMENTE idéntica a la de hoy salvo el último paso, para
 * que ninguna migración de ruta cambie un código de estado:
 *   1. sin token                     → 401 (mismo texto que `verificarMiembro`)
 *   2. `clinicId` vacío              → 400 'Falta clinicId'
 *   3. no es miembro de ESE clinicId → 403 'No tienes acceso a esta clínica.'
 *   4. Firestore revienta            → 500 (fail-CLOSED, igual que hoy)
 *   5. NUEVO: el rol no tiene la capacidad → 403 nombrando la capacidad.
 *      Rol ausente o desconocido ⇒ sin capacidades ⇒ 403.
 */
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { verificarMiembro, verificarModuloIA, type Acceso, type AccesoOk } from '@/lib/auth-server'
import { safeLog } from '@/lib/security/sanitize'
import { tieneCapacidad, type Capacidad } from './capabilities'
import { anotarDenegacion, rutaSinParametros } from '@/lib/ops/lo-que-no-deberia-pasar'

/**
 * 403 uniforme que NOMBRA la capacidad que faltó. El rol NO se incluye en el
 * cuerpo: decir «tu rol (laboratorio) no puede» filtra la composición del equipo a
 * quien sondee la API. El rol sí se anota en el log del servidor.
 */
function sinCapacidad(
  capacidad: Capacidad,
  rol: string | null | undefined,
  quien?: { uid: string; clinicId: string; ruta: string },
): Acceso {
  safeLog.warn('[authz] capacidad denegada', capacidad, 'rol:', rol ?? '(sin rol)')
  /**
   * WS-13 / REG-578 — el log no es una señal: hay que ir a buscarlo sabiendo ya
   * lo que se busca. Se ANOTA para que el vigilante pueda ver el patrón, que es
   * lo único que distingue un rol mal puesto de alguien probando dónde entra.
   *
   * Sin `quien` no se anota: una denegación sin actor no forma patrón, y
   * escribirla sería llenar la colección de filas que no dicen nada.
   */
  if (quien?.uid) {
    anotarDenegacion({
      uid: quien.uid,
      clinicId: quien.clinicId,
      capacidad,
      ruta: rutaSinParametros(quien.ruta),
      cuando: new Date().toISOString(),
    })
  }
  return {
    ok: false,
    response: NextResponse.json(
      { ok: false, error: `Tu rol no tiene permiso para esta acción (requiere: ${capacidad}).` },
      { status: 403 },
    ),
  }
}

/**
 * Exige membresía de ESA clínica Y la capacidad indicada.
 * Sustituto de `verificarMedico` y de `verificarMiembro` en toda ruta de clínica.
 */
export async function verificarCapacidad(
  req: NextRequest,
  clinicId: string,
  capacidad: Capacidad,
): Promise<Acceso> {
  const acceso = await verificarMiembro(req, clinicId)
  if (!acceso.ok) return acceso
  if (!tieneCapacidad(acceso.role, capacidad)) {
    return sinCapacidad(capacidad, acceso.role, {
      uid: acceso.uid, clinicId, ruta: req.nextUrl?.pathname ?? '',
    })
  }
  return acceso
}

/**
 * Entitlement de plan Y capacidad de rol. Sustituto de `verificarModuloIA`, que
 * comprueba el PLAN pero no mira el rol en ningún momento (por eso hoy un rol
 * `laboratorio` puede pedir una nota clínica redactada por la API de IA).
 *
 * ASIMETRÍA DE ERROR QUE HAY QUE PRESERVAR: `verificarModuloIA` es fail-OPEN ante
 * un fallo transitorio de Firestore para los módulos de consulta, y fail-CLOSED
 * (503) para los módulos OPT-IN de pago. En el camino fail-OPEN NO se pudo leer la
 * membresía, así que no hay `clinicId` ni `role` — evaluar la capacidad ahí
 * convertiría un fallo de lectura puntual en un 403 para TODOS, que es el modo de
 * fallo más fácil de introducir sin notarlo. Regla: si el entitlement se resolvió
 * por fail-OPEN, la capacidad NO se evalúa y se anota en el log; el rol se exige
 * solo cuando se pudo leer la membresía.
 */
export async function verificarModuloYCapacidad(
  req: NextRequest,
  modulo: string,
  capacidad: Capacidad,
): Promise<Acceso> {
  const acceso = await verificarModuloIA(req, modulo)
  if (!acceso.ok) return acceso
  // `clinicId` ausente ⇒ el entitlement salió del camino fail-OPEN del catch.
  if (!acceso.clinicId) {
    safeLog.warn('[authz] entitlement por fail-OPEN: no se evalúa la capacidad', capacidad, 'modulo:', modulo)
    return acceso
  }
  if (!tieneCapacidad(acceso.role, capacidad)) return sinCapacidad(capacidad, acceso.role)
  return acceso
}

/**
 * Comprobación de capacidad sobre un acceso YA verificado. Para rutas con
 * sub-acciones (el gateway `hospital/mutar`, donde el rol necesario depende de la
 * acción del body). Devuelve `null` cuando está permitido.
 */
export function exigeCapacidad(acceso: AccesoOk, c: Capacidad): NextResponse | null {
  if (tieneCapacidad(acceso.role, c)) return null
  const r = sinCapacidad(c, acceso.role)
  return r.ok ? null : r.response
}
