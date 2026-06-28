import { initializeApp, getApps } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import {
  getFirestore, initializeFirestore,
  persistentLocalCache, persistentMultipleTabManager,
} from 'firebase/firestore'
import { getStorage } from 'firebase/storage'

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  // authDomain = el MISMO dominio de la app (no firebaseapp.com). Así el handler
  // de Google (/__/auth/*) es same-origin → Chrome/Safari no bloquean las cookies
  // entre dominios (la causa del popup en blanco). El proxy en next.config reenvía
  // /__/auth/* y /__/firebase/* a nexomed-agenda.firebaseapp.com.
  authDomain: typeof window !== 'undefined'
    ? window.location.host
    : process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
}

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0]

export const auth = getAuth(app)

// Persistencia offline habilitada (multi-pestaña para uso en varias ventanas)
export const db = typeof window !== 'undefined'
  ? initializeFirestore(app, {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    })
  : getFirestore(app)

// Storage — para subir audio largo de consulta y diarizarlo sin chocar con el
// límite de 4.5MB de las funciones de Vercel. Solo cliente.
// Defensivo: si el bucket no está bien configurado, NO debe tronar la carga de
// la app — queda null y la diarización de audio largo cae a su fallback.
export const storage = (() => {
  if (typeof window === 'undefined') return null
  try { return getStorage(app) } catch { return null }
})()

export default app
