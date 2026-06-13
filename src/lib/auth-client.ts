'use client'
/**
 * Wrapper de fetch que adjunta el ID-token de Firebase del usuario actual.
 *
 * Las API routes protegidas (ver auth-server.ts) exigen un header
 * `Authorization: Bearer <idToken>`. Este helper lo agrega automáticamente,
 * para no repetir la lógica en cada call site del cliente.
 *
 * - Si no hay usuario logueado, lanza (la ruta respondería 401 de todos modos).
 * - getIdToken() refresca el token automáticamente si expiró (Firebase lo cachea
 *   ~1h y lo renueva solo).
 */
import { auth } from './firebase'

export async function fetchAutenticado(url: string, opts: RequestInit = {}): Promise<Response> {
  const user = auth.currentUser
  if (!user) throw new Error('No hay sesión activa')
  const token = await user.getIdToken()
  const headers = new Headers(opts.headers)
  headers.set('Authorization', `Bearer ${token}`)
  return fetch(url, { ...opts, headers })
}
