/**
 * Permisos por rol — capa de aplicación.
 *
 * La autorización REAL se hace en Firestore Rules (no en cliente) y, en las API
 * routes, en `src/lib/authz/`. Esta capa es para UX: ocultar/deshabilitar acciones
 * que el usuario sabe que su rol no puede ejecutar, mostrando mensajes claros.
 *
 * E0-07: este módulo pasó a DERIVAR de `CAPACIDADES_POR_ROL` en vez de definir su
 * propia tabla de 12×8 casillas. Era la cuarta lista de roles del repo y la única
 * que no estaba atada a nada — podía contradecir a la autorización real sin que
 * nada fallara. La firma pública (`Permisos`, `permisosPorRol`, `puede`) y todas
 * las casillas se conservan idénticas; `authz-capabilities.test.ts` lo fija con la
 * tabla anterior copiada literal como oráculo.
 *
 * El `Rol` también se importa ahora de la fuente canónica (E0-06) en lugar de
 * redeclararse.
 */
import { CAPACIDADES_POR_ROL, ROLES, type Capacidad, type Rol } from './authz/capabilities'

export type { Rol }
export { ROLES }

export const ROL_LABEL: Record<Rol, string> = {
  admin:       'Administrador',
  medico:      'Médico',
  secretaria:  'Asistente',
  recepcion:   'Recepción',
  facturacion: 'Facturación',
  enfermeria:  'Enfermería',
  farmacia:    'Farmacia',
  laboratorio: 'Laboratorio',
}

export interface Permisos {
  verAgenda: boolean
  editarAgenda: boolean
  verExpediente: boolean
  editarExpediente: boolean
  firmarNota: boolean
  verCRM: boolean
  verFinanzas: boolean
  configurarClinica: boolean
  invitarMiembros: boolean
  moderarResenas: boolean
  manejarPagos: boolean
  cobrarPagos: boolean
}

/**
 * `manejarPagos` es el ÚNICO permiso que no sale limpio de una capacidad: hoy vale
 * `true` para admin y facturacion pero `false` para medico, aunque medico SÍ tiene
 * `administrar`. Es una asimetría deliberada de la tabla original (el médico
 * configura su consultorio pero no administra la pasarela de pagos) y es justo el
 * objeto de la pregunta Q5 al médico dueño. Se conserva como excepción DECLARADA en
 * lugar de "arreglarla" en silencio: cambiarla es su decisión, no un efecto
 * colateral de esta unidad.
 */
const SIN_MANEJAR_PAGOS: readonly Rol[] = ['medico']

/**
 * Traduce las capacidades del rol a los 12 permisos de UX. Cada línea dice de qué
 * capacidad depende el permiso, así que aflojar una capacidad se ve aquí en vez de
 * quedar en una tabla paralela que nadie compara.
 */
function derivar(rol: Rol): Permisos {
  const tiene = (c: Capacidad) => CAPACIDADES_POR_ROL[rol].includes(c)
  // Quien gestiona agenda, factura o administra, ve la agenda. El staff clínico
  // hospitalario (solo `clinico.leer`) no: su módulo es el censo, no el mostrador.
  const verAgenda = tiene('agenda.gestionar') || tiene('facturar') || tiene('administrar')
  return {
    verAgenda,
    editarAgenda: tiene('agenda.gestionar'),
    // `clinico.escribir`, NO `clinico.leer`: el expediente ambulatorio es del
    // médico; enfermería/farmacia/laboratorio leen el pase de visita, no la consulta.
    verExpediente: tiene('clinico.escribir'),
    editarExpediente: tiene('clinico.escribir'),
    firmarNota: tiene('firmar'),
    verCRM: tiene('equipo.leer'),
    verFinanzas: tiene('facturar'),
    configurarClinica: tiene('administrar'),
    invitarMiembros: tiene('administrar'),
    moderarResenas: tiene('administrar'),
    manejarPagos: (tiene('facturar') || tiene('administrar')) && !SIN_MANEJAR_PAGOS.includes(rol),
    cobrarPagos: tiene('cobrar'),
  }
}

const PERMS: Record<Rol, Permisos> = Object.fromEntries(
  ROLES.map(r => [r, derivar(r)]),
) as Record<Rol, Permisos>

/** Mínimo privilegio de la capa de UX (ver la nota de `permisosPorRol`). */
const RECEPCION: Permisos = PERMS.recepcion

/**
 * Devuelve los permisos correspondientes al rol, con default de MÍNIMO privilegio.
 *
 * Decía "defaults seguros" y hacía lo contrario: el `?? 'admin'` se aplicaba
 * cuando el rol era null/undefined — justo el valor que tiene mientras
 * ClinicContext carga o si falla — y concedía permisos de ADMIN. Un rol
 * desconocido-pero-presente sí caía a RECEPCION, lo que muestra cuál era la
 * intención. Hoy no hay ningún llamador fuera de los tests, así que no se
 * disparaba; se corrige antes de que alguien lo use.
 *
 * E0-07 — ASIMETRÍA DELIBERADA con el servidor: aquí un rol ausente cae a RECEPCION
 * (esto es UX y devolver `undefined` reventaría a quien haga `.verAgenda`), pero
 * `capacidadesDe(null)` devuelve `[]`. La decisión de acceso real la toma el
 * servidor, y ahí sin rol legible no se autoriza nada.
 */
export function permisosPorRol(rol: string | null | undefined): Permisos {
  if (!rol) return RECEPCION
  return PERMS[rol as Rol] ?? RECEPCION
}

/** Helper: ¿el rol puede ejecutar esta acción? */
export function puede(rol: string | null | undefined, accion: keyof Permisos): boolean {
  return permisosPorRol(rol)[accion]
}
