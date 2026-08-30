'use client'
/**
 * Wrapper de fetch que adjunta el ID-token de Firebase del usuario actual.
 *
 * Las API routes protegidas (ver auth-server.ts) exigen un header
 * `Authorization: Bearer <idToken>`. Este helper lo agrega automáticamente,
 * para no repetir la lógica en cada call site del cliente.
 *
 * ── EL FALLO QUE ESTO REPARA ─────────────────────────────────────────────────
 *
 * Antes leía `auth.currentUser` y, si venía vacío, LANZABA de inmediato.
 *
 * El problema es CUÁNDO viene vacío. Firebase restaura la sesión de forma
 * asíncrona: durante los primeros instantes tras cargar una pantalla,
 * `currentUser` es `null` aunque el médico lleve toda la mañana dentro. Así que
 * cualquier pantalla que pidiera datos al montarse —el patrón más natural que
 * existe— fallaba con «no hay sesión activa» y enseñaba un error rojo a alguien
 * perfectamente autenticado. Recargar a veces lo arreglaba y a veces no, que es
 * la peor clase de fallo: parece de red.
 *
 * Se descubrió con dos pantallas nuevas de la consola del dueño, mirándolas en
 * un navegador de verdad. Ninguna prueba lo habría visto: la ruta respondía
 * bien, el componente pintaba bien, y lo único roto era el instante.
 *
 * Ahora se ESPERA a que Firebase diga la primera palabra. Si dice que hay
 * usuario, se sigue; si dice que no, se lanza igual que antes. La diferencia es
 * no confundir «todavía no sé» con «no».
 */
import { onAuthStateChanged, type User } from 'firebase/auth'
import { auth } from './firebase'
import { conTiempoLimite } from './fetch-con-timeout'

/**
 * Cuánto se espera a que Firebase resuelva la sesión.
 *
 * Es un techo de cordura, no un tiempo esperado: en la práctica llega en
 * milisegundos. Si algo va tan mal que tarda más, es mejor fallar con un
 * mensaje claro que dejar la pantalla girando para siempre.
 */
export const ESPERA_SESION_MS = 8000

/**
 * El usuario actual, esperando a la primera respuesta de Firebase si hace falta.
 *
 * Devuelve `null` cuando de verdad no hay sesión — no cuando todavía no se sabe.
 */
export function usuarioCuandoSePueda(esperaMs = ESPERA_SESION_MS): Promise<User | null> {
  if (auth.currentUser) return Promise.resolve(auth.currentUser)
  return new Promise(resolve => {
    let resuelto = false
    const listo = (u: User | null) => {
      if (resuelto) return
      resuelto = true
      clearTimeout(temporizador)
      unsub()
      resolve(u)
    }
    // El temporizador se declara antes de usarse en `listo` por el orden de
    // evaluación; `unsub` igual. Ambos existen para el momento en que corre.
    const temporizador = setTimeout(() => listo(auth.currentUser), esperaMs)
    const unsub = onAuthStateChanged(auth, u => listo(u))
  })
}

/**
 * Cuánto se espera al token antes de rendirse.
 *
 * ── EL FALLO QUE ESTO REPARA ────────────────────────────────────────────────
 *
 * `usuarioCuandoSePueda` tenía su techo de cordura desde el principio, con el
 * motivo escrito arriba: «es mejor fallar con un mensaje claro que dejar la
 * pantalla girando para siempre». **La línea de al lado no lo tenía.**
 *
 * `getIdToken()` sin red no falla: Firebase reintenta el refresco por dentro y
 * la promesa se queda pendiente. Como el `await` nunca se resuelve, el `finally`
 * de quien llama tampoco corre — y el botón se queda en «Guardando…» para
 * siempre.
 *
 * HONESTIDAD SOBRE LO QUE ESTE CAMBIO ARREGLA Y LO QUE NO: se puso buscando el
 * «Guardando…» eterno del alta de la asistente, y NO era la causa de aquél —lo
 * era una lectura de Firestore, que se arregló aparte—. Al medir de nuevo, el
 * botón seguía colgado pasado este techo, y eso lo dejó claro.
 *
 * Se queda igualmente, y no por consuelo: `getIdToken()` sin red tampoco falla,
 * reintenta por dentro y deja la promesa pendiente. Es el mismo agujero, en la
 * línea de al lado de la que sí tenía tapa, en un camino que usan 53 archivos.
 * El mismo archivo tenía la regla escrita y la aplicaba a una sola de las dos
 * esperas.
 *
 * 12 s: más que cualquier refresco real, menos que la paciencia de nadie.
 */
export const ESPERA_TOKEN_MS = 12000

/** Mensaje único, para que la interfaz no invente cada una el suyo. */
export const MENSAJE_TOKEN_SIN_RED =
  'No se pudo confirmar tu sesión. Revisa la conexión e inténtalo de nuevo.'

export async function fetchAutenticado(url: string, opts: RequestInit = {}): Promise<Response> {
  const user = await usuarioCuandoSePueda()
  if (!user) throw new Error('No hay sesión activa')
  /**
   * getIdToken() refresca el token automáticamente si expiró (Firebase lo
   * cachea ~1 h y lo renueva solo) — pero sin red se queda colgado, así que
   * lleva el mismo techo de cordura que la espera de sesión.
   */
  const token = await conTiempoLimite(
    user.getIdToken(), ESPERA_TOKEN_MS, 'el token de sesión',
  ).catch(() => { throw new Error(MENSAJE_TOKEN_SIN_RED) })
  const headers = new Headers(opts.headers)
  headers.set('Authorization', `Bearer ${token}`)
  return fetch(url, { ...opts, headers })
}
