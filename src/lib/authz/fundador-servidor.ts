/**
 * ¿Este UID es el del fundador? — resolución del lado servidor.
 *
 * ── POR QUÉ ESTO NO ES UN PARÁMETRO MÁS ──────────────────────────────────────
 *
 * `fundador.ts` es puro y compara CORREOS, porque la verdad de quién es dueño
 * vive en el correo verificado y no en un campo de Firestore que un `update`
 * pudiera conceder. Pero la exención tiene que aplicarse dentro de
 * `resolverClaveIA`, que sólo recibe un `uid` y a la que llaman **23 rutas**.
 *
 * Pasarle el correo a las 23 sería la receta exacta del fallo que el propio
 * `fundador.ts` advierte: «una clasificación que nunca dispara y que en el
 * tablero se ve idéntica a una que funciona». Basta olvidar una ruta —o que
 * mañana nazca la ruta 24— para que el dueño quede cortado justo ahí, y el
 * síntoma sería «a veces la IA se me apaga», que es indepurable.
 *
 * Así que la traducción uid → fundador se hace UNA vez, en un solo sitio que
 * nadie puede saltarse.
 *
 * ── SEGURIDAD ────────────────────────────────────────────────────────────────
 *
 * Falla CERRADO. Si la consulta a Firebase Auth revienta se devuelve `false`:
 * el dueño queda tratado como cuenta de prueba (molesto, y visible de inmediato
 * en su propia pantalla) en lugar de abrirle a un desconocido una llave sin
 * tope. Un fallo de infraestructura nunca debe conceder privilegios.
 *
 * La caché guarda UIDs, no correos, y sólo los del dueño. Es de proceso y con
 * caducidad: si se añade un socio a `SUPERADMIN_EMAILS`, entra al siguiente
 * refresco sin necesidad de redesplegar.
 */
import admin from '@/lib/firebase-admin'
import { correosFundador } from './fundador'

/** Cuánto vale la resolución antes de volver a preguntarle a Firebase Auth. */
const VIGENCIA_MS = 10 * 60 * 1000

let cache: { uids: Set<string>; expira: number } | null = null

/** Sólo para las pruebas y para forzar un refresco tras cambiar la lista. */
export function olvidarFundadores(): void {
  cache = null
}

async function uidsDelFundador(): Promise<Set<string>> {
  const ahora = Date.now()
  if (cache && cache.expira > ahora) return cache.uids

  const uids = new Set<string>()
  for (const correo of correosFundador(process.env.SUPERADMIN_EMAILS)) {
    try {
      const u = await admin.auth().getUserByEmail(correo)
      /**
       * SÓLO CON EL CORREO VERIFICADO.
       *
       * Sin esta condición, quien registrara una cuenta con el correo del dueño
       * —sin poder abrirlo— heredaría una llave de IA sin tope. Firebase permite
       * crear la cuenta antes de verificar; el privilegio no puede ir antes que
       * la prueba de que el buzón es suyo.
       */
      if (u.emailVerified) uids.add(u.uid)
      else {
        /**
         * RUIDOSO A PROPÓSITO.
         *
         * Un correo de dueño con cuenta SIN verificar deja la exención apagada, y
         * el síntoma sería «al dueño se le acaba la IA a los 30 usos» — un
         * reporte que nadie relaciona con esta línea. Que se vea en los registros
         * con el nombre del problema y no haya que deducirlo.
         */
        console.warn('[fundador] correo de dueño con cuenta SIN verificar: la exención de llave NO se aplica. Verifica el correo o inicia sesión con Google.')
      }
    } catch { /* correo sin cuenta todavía: no es fundador */ }
  }

  cache = { uids, expira: ahora + VIGENCIA_MS }
  return uids
}

/**
 * ¿El dueño de la plataforma? Falla cerrado: ante cualquier error, `false`.
 */
export async function uidEsFundador(uid: string | null | undefined): Promise<boolean> {
  if (!uid) return false
  try {
    return (await uidsDelFundador()).has(uid)
  } catch {
    return false
  }
}

export const POR_QUE_SE_RESUELVE_AQUI_Y_NO_EN_CADA_RUTA =
  'Porque son 23 rutas las que resuelven una llave de IA, y una exención que ' +
  'hay que acordarse de pasar en 23 sitios es una exención que se va a olvidar ' +
  'en el 24. El síntoma sería «a veces se me apaga la IA» —el peor de los ' +
  'reportes— y el propio módulo de fundador advierte contra la clasificación ' +
  'que nunca dispara y en el tablero se ve igual que una que sí.'
