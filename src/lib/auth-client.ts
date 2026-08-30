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
import { CABECERA_CORRELACION, nuevaCorrelacion } from '@/lib/observabilidad/correlacion'

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
 * La correlación de ESTA pestaña.
 *
 * Se acuña una vez por carga y viaja en todas las peticiones: así los registros
 * de una misma sesión de trabajo se agrupan solos. No lleva uid ni nada del
 * paciente — su forma no lo permite (ver `observabilidad/correlacion.ts`).
 */
const CORRELACION_DE_LA_PESTANA = nuevaCorrelacion()

export async function fetchAutenticado(url: string, opts: RequestInit = {}): Promise<Response> {
  const user = await usuarioCuandoSePueda()
  if (!user) throw new Error('No hay sesión activa')
  // getIdToken() refresca el token automáticamente si expiró (Firebase lo cachea
  // ~1h y lo renueva solo).
  const token = await user.getIdToken()
  const headers = new Headers(opts.headers)
  headers.set('Authorization', `Bearer ${token}`)
  /* El hilo que permite seguir una petición del navegador al proveedor (WS-13). */
  if (!headers.has(CABECERA_CORRELACION)) headers.set(CABECERA_CORRELACION, CORRELACION_DE_LA_PESTANA)
  return fetch(url, { ...opts, headers })
}
