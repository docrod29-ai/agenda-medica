/**
 * AL CLIENTE NO SE LE SIRVE EL ERROR CRUDO — REG-529.
 *
 * ── EL HUECO ─────────────────────────────────────────────────────────────────
 *
 * Cuarenta rutas de `src/app/api` (46 sitios) cerraban su `catch` así:
 *
 *     return NextResponse.json({ error: String(err) }, { status: 500 })
 *
 * `String(err)` de un error del Admin SDK trae nombres de colecciones, rutas
 * de documentos (con el id del paciente dentro), mensajes del proveedor y, a
 * veces, el dato que provocó el fallo. Para quien sondea la API es
 * reconocimiento gratis; para el médico que ve «FirebaseError: 7 PERMISSION_DENIED:
 * Missing or insufficient permissions» no es ninguna ayuda. `public/booking`
 * ya lo había arreglado a mano; las otras cuarenta, no.
 *
 * ── LA REGLA ─────────────────────────────────────────────────────────────────
 *
 * El detalle va al log del servidor, redactado (`safeLog`). Al cliente le
 * llega un mensaje que le dice qué hacer, y nada más. Este helper **no recibe
 * el error**: así no hay forma de que lo filtre. La ruta sigue haciendo su
 * `safeLog.error('[ruta]', err)` justo antes, que es donde el detalle sirve.
 *
 * Cuando la ruta sabe algo útil para el usuario («no se pudo leer la imagen»),
 * lo dice con `mensaje`; lo que no sabe, no lo inventa.
 */
import { NextResponse } from 'next/server'

export const MENSAJE_GENERICO =
  'Ocurrió un error en el servidor. Intenta de nuevo; si sigue pasando, avisa al consultorio.'

export function errorAlCliente(mensaje: string = MENSAJE_GENERICO, status = 500): NextResponse {
  return NextResponse.json({ ok: false, error: mensaje }, { status })
}

/**
 * Para los pocos sitios donde el texto del error se queda dentro de la
 * aplicación (una nota de respaldo que ve el médico, un motivo en un latido):
 * se redacta y se acota, nunca se pasa entero.
 */
export { redactarString } from './sanitize'
