/**
 * El nombre con el que se saluda en la pantalla de inicio.
 *
 * Vivía dentro de `dashboard/page.tsx`; se extrajo (mismo criterio que
 * `resumen-del-dia.ts`) cuando la captura real del arnés V10 mostró el saludo
 * roto — «Buenas tardes, Dra.» — y hacía falta poder probarlo sin montar la
 * pantalla entera.
 */

/** Quita "Dr.", "Dra.", "Dr ", "Dra " del inicio del nombre — evita el "Dr. Dr." duplicado */
export function quitarPrefijoDr(nombre: string): string {
  return nombre.replace(/^Dr\.?\s+|^Dra\.?\s+/i, '').trim()
}

/**
 * Devuelve el PRIMER NOMBRE para saludar según quién está logueado.
 * - Médico/admin: usa config.nombreMedico (nombre del consultorio)
 * - Asistente: usa su displayName de Firebase Auth (lo capturó al registrarse)
 * - Si no hay nada: usa email prefix
 */
export function nombreSaludo(
  role: string | null,
  nombreMedico?: string,
  displayName?: string | null,
  email?: string | null,
): string {
  const esMedico = role === 'medico' || role === 'admin'
  if (esMedico && nombreMedico) {
    return quitarPrefijoDr(nombreMedico).split(' ')[0]
  }
  // El displayName también puede traer el título («Dra. Elena…»): sin quitarlo,
  // el saludo era «Buenas tardes, Dra.» — visto en la captura real del arnés V10.
  if (displayName) return quitarPrefijoDr(displayName).split(' ')[0] || displayName.split(' ')[0]
  if (email) return email.split('@')[0]
  return ''
}
