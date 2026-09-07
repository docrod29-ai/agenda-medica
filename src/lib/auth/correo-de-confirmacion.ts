/**
 * EL CORREO DE CONFIRMACIÓN QUE SE ENVIABA A CIEGAS.
 *
 * ── QUÉ FALLABA ──────────────────────────────────────────────────────────────
 *
 * `/registro` mandaba la verificación así:
 *
 *     void sendEmailVerification(cred.user).catch(() => {
 *       console.warn('[registro] no se pudo enviar la verificación de correo')
 *     })
 *
 * Tres cosas a la vez, todas malas:
 *
 *  1. **Nadie se entera si falla.** Un `console.warn` no es un aviso: es un
 *     mensaje para quien tenga la consola del navegador abierta, que no es
 *     nunca la persona que acaba de darse de alta. El médico decía «no me
 *     llegó» y la aplicación seguía comportándose como si lo hubiera mandado.
 *  2. **Ni siquiera se decía que se había mandado.** No había pantalla ni
 *     línea que dijera «te escribimos a esta dirección»: si el correo estaba
 *     mal tecleado, no había forma de notarlo.
 *  3. **Sin `actionCodeSettings`**, el enlace del correo devuelve a la página
 *     por omisión de Firebase en vez de a la aplicación.
 *
 * ── POR QUÉ DOS INTENTOS ─────────────────────────────────────────────────────
 *
 * Añadir la URL de vuelta puede hacer fallar el envío entero
 * (`auth/unauthorized-continue-uri`) si ese dominio no está en la lista de
 * Firebase. Volver mejor el aterrizaje no puede costar el correo, que es lo
 * importante: si el intento con URL falla, se reintenta sin ella.
 *
 * ── LO QUE ESTE MÓDULO NO PUEDE HACER ────────────────────────────────────────
 *
 * El correo lo envía **Firebase**, no este código: aquí sólo se sabe si aceptó
 * el encargo. Que llegue a la bandeja depende de la plantilla y del dominio
 * configurados en la consola de Firebase, y eso no se arregla desde el
 * repositorio. Por eso el resultado dice `enviado` (Firebase lo aceptó), nunca
 * «recibido», y la pantalla añade siempre el recordatorio del correo no deseado.
 */

export interface AjustesDeVuelta {
  url: string
  handleCodeInApp: boolean
}

export type EnvioDeConfirmacion =
  | { enviado: true; a: string; conUrlDeVuelta: boolean }
  | { enviado: false; a: string; porQue: string }

/** Lo que hace Firebase: `sendEmailVerification(user, ajustes?)`, ya atado al usuario. */
export type EnviarVerificacion = (ajustes?: AjustesDeVuelta) => Promise<unknown>

/**
 * Pide el correo de confirmación y DICE qué pasó. Nunca devuelve éxito por no
 * haberlo intentado.
 *
 * @param origen `window.location.origin`, o null si no hay navegador.
 */
export async function pedirCorreoDeConfirmacion(
  destinatario: { email?: string | null },
  enviar: EnviarVerificacion,
  origen?: string | null,
): Promise<EnvioDeConfirmacion> {
  const a = (destinatario.email ?? '').trim()
  if (origen) {
    try {
      await enviar({ url: `${origen}/login`, handleCodeInApp: false })
      return { enviado: true, a, conUrlDeVuelta: true }
    } catch { /* el dominio de vuelta puede no estar autorizado: se reintenta sin él */ }
  }
  try {
    await enviar()
    return { enviado: true, a, conUrlDeVuelta: false }
  } catch (e) {
    const code = (e as { code?: string }).code ?? ''
    return { enviado: false, a, porQue: code || 'desconocido' }
  }
}
