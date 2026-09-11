'use client'
/**
 * LA SESIÓN DEL PACIENTE EN EL PORTAL, APARTE DE LA DEL MÉDICO — D-058.
 *
 * El portal se abre con un enlace firmado, no con sesión de Firebase. Para
 * subir un archivo a Storage el servidor le acuña un token personalizado
 * (`portal: true`, su consultorio y su expediente) y el navegador entra con
 * él. Eso se hace en una app de Firebase SEPARADA, con persistencia en memoria:
 * si un médico abre el enlace de un paciente en su propio navegador, no se le
 * cierra su sesión; y al cerrar la pestaña no queda nada.
 */
import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app'
import { getAuth, signInWithCustomToken, connectAuthEmulator, setPersistence, inMemoryPersistence, type Auth } from 'firebase/auth'
import { getStorage, connectStorageEmulator, type FirebaseStorage } from 'firebase/storage'

const NOMBRE = 'portal-paciente'
const USAR_EMULADORES = process.env.NEXT_PUBLIC_FIREBASE_EMULATORS === '1'

function app(): FirebaseApp {
  if (getApps().some(a => a.name === NOMBRE)) return getApp(NOMBRE)
  return initializeApp({
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  }, NOMBRE)
}

let conectado = false
function conectarEmuladores(auth: Auth, storage: FirebaseStorage) {
  if (conectado || !USAR_EMULADORES) return
  conectado = true
  try { connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true }) } catch { /* ya */ }
  try { connectStorageEmulator(storage, '127.0.0.1', 9199) } catch { /* ya */ }
}

/** Entra con el token del servidor y devuelve el Storage listo para subir. */
export async function storageDelPaciente(tokenPersonalizado: string): Promise<FirebaseStorage> {
  const a = app()
  const auth = getAuth(a)
  const storage = getStorage(a)
  conectarEmuladores(auth, storage)
  await setPersistence(auth, inMemoryPersistence)
  await signInWithCustomToken(auth, tokenPersonalizado)
  return storage
}

export async function cerrarSesionDelPaciente(): Promise<void> {
  if (!getApps().some(a => a.name === NOMBRE)) return
  try { await getAuth(getApp(NOMBRE)).signOut() } catch { /* nada que cerrar */ }
}
