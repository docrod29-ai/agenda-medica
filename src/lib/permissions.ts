/**
 * Permisos por rol — capa de aplicación.
 *
 * La autorización REAL se hace en Firestore Rules (no en cliente).
 * Esta capa es para UX: ocultar/deshabilitar acciones que el usuario
 * sabe que su rol no puede ejecutar, mostrando mensajes claros.
 */

export type Rol = 'admin' | 'medico' | 'secretaria' | 'recepcion' | 'facturacion' | 'enfermeria' | 'farmacia' | 'laboratorio'

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

const ADMIN: Permisos = {
  verAgenda: true, editarAgenda: true,
  verExpediente: true, editarExpediente: true, firmarNota: true,
  verCRM: true, verFinanzas: true,
  configurarClinica: true, invitarMiembros: true,
  moderarResenas: true, manejarPagos: true, cobrarPagos: true,
}

const MEDICO: Permisos = {
  verAgenda: true, editarAgenda: true,
  verExpediente: true, editarExpediente: true, firmarNota: true,
  verCRM: true, verFinanzas: true,
  configurarClinica: true, invitarMiembros: true,
  moderarResenas: true, manejarPagos: false, cobrarPagos: true,
}

const SECRETARIA: Permisos = {
  verAgenda: true, editarAgenda: true,
  verExpediente: false, editarExpediente: false, firmarNota: false,
  verCRM: true, verFinanzas: false,
  configurarClinica: false, invitarMiembros: false,
  moderarResenas: false, manejarPagos: false, cobrarPagos: true,
}

const RECEPCION: Permisos = {
  verAgenda: true, editarAgenda: true,
  verExpediente: false, editarExpediente: false, firmarNota: false,
  verCRM: false, verFinanzas: false,
  configurarClinica: false, invitarMiembros: false,
  moderarResenas: false, manejarPagos: false, cobrarPagos: false,
}

const FACTURACION: Permisos = {
  verAgenda: true, editarAgenda: false,
  verExpediente: false, editarExpediente: false, firmarNota: false,
  verCRM: false, verFinanzas: true,
  configurarClinica: false, invitarMiembros: false,
  moderarResenas: false, manejarPagos: true, cobrarPagos: true,
}

// Staff clínico hospitalario (enfermería/farmacia/laboratorio): NO ven el
// expediente ambulatorio ni CRM/finanzas/config; su acceso al módulo de
// hospitalización se controla en las Firestore Rules (isClinicoHospital).
const CLINICO_HOSPITAL: Permisos = {
  verAgenda: false, editarAgenda: false,
  verExpediente: false, editarExpediente: false, firmarNota: false,
  verCRM: false, verFinanzas: false,
  configurarClinica: false, invitarMiembros: false,
  moderarResenas: false, manejarPagos: false, cobrarPagos: false,
}

const PERMS: Record<Rol, Permisos> = {
  admin: ADMIN, medico: MEDICO, secretaria: SECRETARIA,
  recepcion: RECEPCION, facturacion: FACTURACION,
  enfermeria: CLINICO_HOSPITAL, farmacia: CLINICO_HOSPITAL, laboratorio: CLINICO_HOSPITAL,
}

/**
 * Devuelve los permisos correspondientes al rol, con default de MÍNIMO privilegio.
 *
 * Decía "defaults seguros" y hacía lo contrario: el `?? 'admin'` se aplicaba
 * cuando el rol era null/undefined — justo el valor que tiene mientras
 * ClinicContext carga o si falla — y concedía permisos de ADMIN. Un rol
 * desconocido-pero-presente sí caía a RECEPCION, lo que muestra cuál era la
 * intención. Hoy no hay ningún llamador fuera de los tests, así que no se
 * disparaba; se corrige antes de que alguien lo use.
 */
export function permisosPorRol(rol: string | null | undefined): Permisos {
  if (!rol) return RECEPCION
  return PERMS[rol as Rol] ?? RECEPCION
}

/** Helper: ¿el rol puede ejecutar esta acción? */
export function puede(rol: string | null | undefined, accion: keyof Permisos): boolean {
  return permisosPorRol(rol)[accion]
}
