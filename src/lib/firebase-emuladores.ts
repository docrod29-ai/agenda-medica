/**
 * Compuerta de los emuladores de Firebase — SOLO desarrollo.
 *
 * Existe para que el arnés de capturas V10 (B-V10-2) pueda levantar la app
 * contra Auth + Firestore emulados con un paciente sintético, sin tocar nunca
 * un proyecto real. La condición vive en una función pura para poder probarla
 * al derecho y al revés (regla de testing-gates): un `if` inline dentro de
 * `firebase.ts` no se puede probar sin arrastrar todo el SDK.
 *
 * Doble cerrojo a propósito:
 *  1. `NEXT_PUBLIC_FIREBASE_EMULATORS === '1'` — opt-in explícito; jamás por
 *     defecto.
 *  2. `NODE_ENV !== 'production'` — aunque la bandera se colara en un build de
 *     producción (Vercel), la conexión al emulador NUNCA se activa: una app en
 *     producción apuntando a localhost dejaría al médico sin datos.
 *
 * Los `process.env.*` van como LITERALES en los parámetros por defecto porque
 * Next.js los sustituye en compilación en el bundle del cliente; leerlos a
 * través de un objeto dinámico los dejaría siempre undefined en el navegador.
 */
export function emuladoresActivos(
  bandera: string | undefined = process.env.NEXT_PUBLIC_FIREBASE_EMULATORS,
  nodeEnv: string | undefined = process.env.NODE_ENV,
): boolean {
  return bandera === '1' && nodeEnv !== 'production'
}

/** Puertos únicos del arnés — los mismos que `firebase.json` declara. */
export const EMULADOR_AUTH_URL = 'http://127.0.0.1:9099'
export const EMULADOR_FIRESTORE_HOST = '127.0.0.1'
export const EMULADOR_FIRESTORE_PORT = 8080
