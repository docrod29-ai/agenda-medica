/**
 * EL CANAL DE ALERTA — el que no existía.
 *
 * ── EL FALLO ─────────────────────────────────────────────────────────────────
 *
 * Buscado en todo `src/`: `slack|pagerduty|nodemailer|resend|sendgrid|SMTP` →
 * **cero coincidencias**. Los únicos aciertos de «alerta» son clínicos (valores
 * críticos de laboratorio).
 *
 * **A las 3am no pasa nada.** El plan de respuesta a incidentes define el canal
 * de detección como un buzón y el propio documento dice, entre paréntesis,
 * «(definir buzón real)». El buzón no existe.
 *
 * ── POR QUÉ UN WEBHOOK Y NO UN PROVEEDOR ─────────────────────────────────────
 *
 * Un `POST` con JSON lo recibe Slack, Discord, ntfy, Zapier, Make o un script
 * propio. Cero dependencias nuevas, cero cuentas que crear, y la decisión de a
 * dónde llega la alerta se toma con una variable de entorno en dos minutos — no
 * eligiendo hoy un proveedor por el Dr.
 *
 * `sendWhatsApp` no sirve para esto: exige un `clinicId` porque usa las
 * credenciales de **ese** consultorio, y una avería de plataforma no es de nadie
 * en particular.
 *
 * ── LA REGLA QUE ORDENA ESTE ARCHIVO ─────────────────────────────────────────
 *
 * **Si no se pudo avisar, se dice.** Nunca `ok: true` porque «no había nada que
 * hacer». Un canal de alertas que devuelve éxito cuando no está configurado es
 * peor que no tenerlo: se da por cubierto lo que sigue descubierto, que es
 * exactamente el fallo que este módulo existe para reparar.
 */
import { safeLog } from '@/lib/security/sanitize'

export interface AlertaOps {
  /** Qué pasó, en una línea. Va como título. */
  titulo: string
  /** El detalle. Nunca PHI: esto lo lee quien opera, no quien atiende. */
  detalle: string
  gravedad: 'aviso' | 'grave'
  /** De qué trabajo o subsistema viene. */
  origen: string
}

export type ResultadoAlerta =
  | { enviada: true; destino: string }
  | { enviada: false; porQue: string }

/** Tiempo máximo esperando al webhook. Una alerta lenta no puede colgar un cron. */
const TIMEOUT_MS = 5000

/**
 * Manda la alerta al webhook configurado.
 *
 * @returns `enviada: false` con su razón cuando no se pudo. **Nunca miente.**
 */
export async function enviarAlertaOps(a: AlertaOps): Promise<ResultadoAlerta> {
  const url = (process.env.OPS_ALERTA_WEBHOOK ?? '').trim()
  if (!url) {
    /**
     * No está configurado. Se DECLARA y se deja en el registro del servidor: el
     * vigilante puede correr perfectamente y no avisar a nadie, y eso tiene que
     * verse desde fuera.
     */
    safeLog.warn(`[ops/alerta] SIN CANAL: ${a.titulo} — falta OPS_ALERTA_WEBHOOK en Vercel`)
    return { enviada: false, porQue: 'No hay OPS_ALERTA_WEBHOOK configurado: la alerta no llegó a nadie.' }
  }
  if (!/^https:\/\//.test(url)) {
    // Un webhook por HTTP mandaría el estado de la plataforma en claro.
    return { enviada: false, porQue: 'OPS_ALERTA_WEBHOOK tiene que ser https.' }
  }

  const control = new AbortController()
  const t = setTimeout(() => control.abort(), TIMEOUT_MS)
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // `text` es lo que casi todos los receptores (Slack, ntfy…) pintan sin
      // configurar nada; los campos sueltos van al lado para quien los quiera.
      body: JSON.stringify({
        text: `[${a.gravedad.toUpperCase()}] Ausculta · ${a.titulo}\n${a.detalle}`,
        titulo: a.titulo, detalle: a.detalle, gravedad: a.gravedad, origen: a.origen,
        ts: new Date().toISOString(),
      }),
      signal: control.signal,
    })
    if (!r.ok) return { enviada: false, porQue: `El webhook contestó ${r.status}.` }
    return { enviada: true, destino: new URL(url).host }
  } catch (e) {
    // Ni el host completo ni la URL: un webhook lleva su secreto en la ruta.
    safeLog.warn('[ops/alerta] el webhook falló', e)
    return { enviada: false, porQue: 'No se pudo contactar al webhook (red o tiempo agotado).' }
  }
}

export const POR_QUE_NO_MIENTE =
  'Un canal de alertas que devuelve éxito cuando no está configurado es peor ' +
  'que no tenerlo: se da por cubierto lo que sigue descubierto. Por eso ' +
  '`enviada: false` viaja con su razón y el vigilante la enseña en su respuesta.'

export const LO_QUE_HACE_FALTA_DEL_DR =
  'Una variable `OPS_ALERTA_WEBHOOK` en Vercel con una URL https que reciba un ' +
  'POST con JSON. Sirve un webhook de Slack, de Discord, un tema de ntfy.sh o ' +
  'un Zapier. Sin ella el vigilante corre igual y deja el diagnóstico en su ' +
  'respuesta y en el registro, pero no despierta a nadie.'
