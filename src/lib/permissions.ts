/**
 * Permisos por rol — capa de aplicación.
 *
 * La autorización REAL se hace en Firestore Rules (no en cliente).
 * Esta capa es para UX: ocultar/deshabilitar acciones que el usuario
 * sabe que su rol no puede ejecutar, mostrando mensajes claros.
 */

export type Rol = 'admin' | 'medico' | 'secretaria' | 'recepcion' | 'facturacion'

export const ROL_LABEL: Record<Rol, string> = {
  admin:       'Administrador',
  medico:      'Médico',
  secretaria:  'Asistente / Secretaria',
  recepcion:   'Recepción',
  facturacion: 'Facturación',
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

const PERMS: Record<Rol, Permisos> = {
  admin: ADMIN, medico: MEDICO, secretaria: SECRETARIA,
  recepcion: RECEPCION, facturacion: FACTURACION,
}

/** Devuelve los permisos correspondientes al rol. Defaults seguros si rol desconocido. */
export function permisosPorRol(rol: string | null | undefined): Permisos {
  return PERMS[(rol as Rol) ?? 'admin'] ?? RECEPCION
}

/** Helper: ¿el rol puede ejecutar esta acción? */
export function puede(rol: string | null | undefined, accion: keyof Permisos): boolean {
  return permisosPorRol(rol)[accion]
}
