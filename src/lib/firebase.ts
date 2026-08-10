import { initializeApp, getApps } from 'firebase/app'
import { getAuth, connectAuthEmulator } from 'firebase/auth'
import {
  getFirestore, initializeFirestore,
  persistentLocalCache, persistentMultipleTabManager,
  connectFirestoreEmulator,
  terminate, clearIndexedDbPersistence,
} from 'firebase/firestore'
import { getStorage, connectStorageEmulator } from 'firebase/storage'

/**
 * MODO EMULADOR — el arnés de capturas, y por qué existe.
 *
 * V10 §33 prohíbe aprobar una pantalla leyendo el JSX: hay que abrirla en un
 * navegador de verdad. Pero las pantallas del flujo dorado exigen sesión, y la
 * única sesión disponible en esta máquina es la de PRODUCCIÓN — con pacientes
 * reales dentro. Capturarla estaría prohibido dos veces: por `data-privacy.md`
 * («cero pacientes reales», y una captura es PHI en un PNG) y por V10 §6.
 *
 * Así que la sesión se fabrica contra los emuladores de Firebase, con pacientes
 * sintéticos sembrados por `scripts/design/sembrar-emulador.mjs`.
 *
 * Tres cerrojos para que esto no pueda tocar producción jamás:
 *   1. sólo si `NEXT_PUBLIC_FIREBASE_EMULATOR === '1'` — ausente por defecto;
 *   2. sólo si `NODE_ENV !== 'production'` — un build de producción lo ignora
 *      aunque la variable se cuele en el entorno de Vercel;
 *   3. `demo-*` como projectId en `.env.emulador`, que ni siquiera existe en
 *      la consola de Firebase.
 *
 * El cerrojo 2 es el que importa: es el que sobrevive a un despiste de
 * configuración. Sin él, una variable mal puesta en Vercel mandaría la app
 * pública a un `localhost` que no responde.
 */
const USAR_EMULADOR =
  process.env.NEXT_PUBLIC_FIREBASE_EMULATOR === '1' &&
  process.env.NODE_ENV !== 'production'

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

// ── App Check (anti-abuso) ──────────────────────────────────────────────
// Verifica que las llamadas a Firestore/Storage vengan de TU app real y no de
// un script/bot que robó tus claves NEXT_PUBLIC. Se activa SOLO si defines el
// site key de reCAPTCHA v3 en NEXT_PUBLIC_FIREBASE_APPCHECK_SITE_KEY; mientras
// no exista, no hace nada (no rompe la app). La enforcement se prende aparte en
// Firebase Console → App Check, cuando ya verificaste que todo sigue funcionando.
if (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_FIREBASE_APPCHECK_SITE_KEY) {
  // Import dinámico: el SDK de App Check no se incluye si no lo usas.
  import('firebase/app-check')
    .then(({ initializeAppCheck, ReCaptchaV3Provider }) => {
      try {
        // Token de depuración en desarrollo (para no ser bloqueado en localhost).
        if (process.env.NODE_ENV !== 'production') {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ;(self as any).FIREBASE_APPCHECK_DEBUG_TOKEN = true
        }
        initializeAppCheck(app, {
          provider: new ReCaptchaV3Provider(process.env.NEXT_PUBLIC_FIREBASE_APPCHECK_SITE_KEY as string),
          isTokenAutoRefreshEnabled: true,
        })
      } catch { /* App Check es defensa extra: nunca debe tronar la app */ }
    })
    .catch(() => { /* SDK no disponible: seguir sin App Check */ })
}

export const auth = getAuth(app)

/**
 * Persistencia offline habilitada (multi-pestaña para uso en varias ventanas).
 *
 * Bajo emulador se usa `getFirestore` pelado: la caché persistente guarda los
 * datos en IndexedDB por `projectId`, y entre corrida y corrida del arnés eso
 * deja documentos de la siembra anterior mezclados con la nueva. Una captura
 * tiene que enseñar exactamente lo que se sembró.
 */
export const db = typeof window !== 'undefined' && !USAR_EMULADOR
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

/**
 * El enchufe a los emuladores va DESPUÉS de crear los tres servicios porque
 * `connect*Emulator` exige una instancia ya construida, y ANTES de que ninguna
 * pantalla haga su primera lectura porque el SDK prohíbe redirigir un cliente
 * que ya habló con la red.
 *
 * Los `catch` vacíos no esconden un fallo real: en desarrollo React monta dos
 * veces y el segundo `connect*` lanza «already started». Un error aquí sí se
 * vería — el arnés se quedaría sin datos y la captura saldría vacía, que es
 * justo la clase de fallo que no puede pasar desapercibido.
 */
if (typeof window !== 'undefined' && USAR_EMULADOR) {
  try { connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true }) } catch { /* ya conectado */ }
  try { connectFirestoreEmulator(db, '127.0.0.1', 8080) } catch { /* ya conectado */ }
  if (storage) { try { connectStorageEmulator(storage, '127.0.0.1', 9199) } catch { /* ya conectado */ } }
}

/**
 * Limpia la caché OFFLINE de Firestore en IndexedDB (expedientes, Dx, medicamentos,
 * transcripciones consultadas) al cerrar sesión — en un dispositivo COMPARTIDO ese
 * residuo clínico no debe quedar. Es la fracción MAYOR de PHI en disco; la limpieza
 * de logout previa solo tocaba localStorage. Best-effort: no bloquea el cierre.
 *
 * `terminate` + `clearIndexedDbPersistence` es la vía oficial; se llama en el logout,
 * justo antes de navegar a /login (el cliente Firestore ya no se vuelve a usar).
 */
export async function limpiarCacheFirestore(): Promise<void> {
  if (typeof window === 'undefined') return
  try {
    await terminate(db)
    await clearIndexedDbPersistence(db)
  } catch { /* si falla (otra pestaña, cliente ocupado) no debe trabar el logout */ }
}

export default app
