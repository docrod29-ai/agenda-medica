/**
 * EL SISTEMA DE VIGILANCIA TAMBIÉN SE CAE — y eso no puede costar una consulta.
 *
 * ── LA REGLA, Y SU LÍMITE ────────────────────────────────────────────────────
 *
 * **La telemetría falla ABIERTA.** Si no se puede anotar un incidente, la
 * operación del médico sigue. Un fallo de evidencia que además tumba el guardado
 * de la nota convierte un problema pequeño en la pérdida de una consulta, y eso
 * es exactamente lo contrario de para lo que existe este sistema.
 *
 * `incidentes-servidor.ts` ya lo hacía bien —«dispara y olvida», con el
 * `console.error` como último recurso— y aquí se generaliza esa forma.
 *
 * **Y la seguridad falla CERRADA.** Aislamiento entre consultorios, autorización
 * y autenticación no se degradan porque el vigilante esté malo: si no se puede
 * comprobar que la operación es legítima, la operación no ocurre.
 *
 * La distinción es la que decide todo este archivo: fallar abierto es aceptable
 * cuando lo que se pierde es SABER; es inaceptable cuando lo que se pierde es
 * IMPEDIR.
 *
 * ── POR QUÉ NO SE CALLA DEL TODO ─────────────────────────────────────────────
 *
 * Un sumidero que se traga sus propios errores en silencio es un sistema de
 * detección apagado que parece encendido. Por eso `contarFalloDeTelemetria()`
 * lleva la cuenta en memoria: cuando el vigilante lleva rato sin poder anotar
 * nada, eso también es un incidente, y es el único que él mismo no puede
 * reportar.
 */
import { safeLog } from '@/lib/security/sanitize'

/** Qué clase de invariante protege una comprobación. Decide cómo se falla. */
export type ClaseDeInvariante = 'telemetria' | 'seguridad'

/**
 * Cuántos fallos de anotación seguidos llevamos, y desde cuándo.
 *
 * En memoria del proceso, a propósito: persistirlo exigiría escribir, que es
 * justo lo que no funciona cuando este contador sube. Se pierde al reiniciar y
 * eso está bien — el contador contesta «¿está el vigilante ciego AHORA?».
 */
const estado = { fallosSeguidos: 0, desde: null as string | null, ultimoMotivo: '' }

export function contarFalloDeTelemetria(motivo: string, ahoraISO: string): void {
  estado.fallosSeguidos += 1
  if (!estado.desde) estado.desde = ahoraISO
  estado.ultimoMotivo = String(motivo).slice(0, 200)
}

export function contarExitoDeTelemetria(): void {
  estado.fallosSeguidos = 0
  estado.desde = null
  estado.ultimoMotivo = ''
}

export interface SaludDeLaTelemetria {
  readonly ciega: boolean
  readonly fallosSeguidos: number
  readonly desde: string | null
  readonly ultimoMotivo: string
}

/**
 * ¿Lleva el vigilante rato sin poder anotar?
 *
 * Cinco seguidos: uno es un hipo de red, cinco es que no está anotando nada. No
 * es un umbral clínico ni un SLO — es el punto donde deja de poder explicarse
 * como mala suerte.
 */
export function saludDeLaTelemetria(umbral = 5): SaludDeLaTelemetria {
  return {
    ciega: estado.fallosSeguidos >= umbral,
    fallosSeguidos: estado.fallosSeguidos,
    desde: estado.desde,
    ultimoMotivo: estado.ultimoMotivo,
  }
}

/** SÓLO para pruebas: devuelve el contador a cero. */
export function reiniciarSaludDeTelemetria(): void {
  estado.fallosSeguidos = 0
  estado.desde = null
  estado.ultimoMotivo = ''
}

export interface ResultadoProtegido<T> {
  /** El valor de la operación protegida. Llega SIEMPRE si la operación salió. */
  readonly valor: T
  /** `true` si la anotación falló. La operación siguió igual. */
  readonly telemetriaFallo: boolean
}

/**
 * Ejecuta la operación y anota, en ese orden y sin que lo segundo pueda romper
 * lo primero.
 *
 * Es genérico y síncrono en la operación a propósito: cuando la operación es
 * asíncrona, el llamador la espera y pasa el valor. Aceptar aquí una promesa
 * habría hecho que un `await` de la anotación pudiera colgar la operación, que
 * es el fallo que este módulo existe para no cometer.
 *
 * `anotar` NUNCA se espera. Si lanza, se cuenta y se sigue.
 */
export function conTelemetriaQueFallaAbierta<T>(
  valor: T,
  anotar: () => void,
  ahoraISO: string,
): ResultadoProtegido<T> {
  try {
    anotar()
    contarExitoDeTelemetria()
    return { valor, telemetriaFallo: false }
  } catch (e) {
    contarFalloDeTelemetria((e as Error)?.message ?? 'desconocido', ahoraISO)
    // Último recurso, igual que en `incidentes-servidor.ts`. Ya saneado.
    safeLog.warn('[incidents/telemetria] no se pudo anotar el incidente; la operación sigue')
    return { valor, telemetriaFallo: true }
  }
}

/**
 * La compuerta de seguridad. Falla CERRADA, y no admite discusión.
 *
 * `comprobar` devuelve `true` cuando la operación es legítima. Si LANZA —porque
 * no se pudo verificar—, el resultado es `false`: no se sabe, luego no pasa.
 *
 * Un `?? true` aquí, o un `catch` que devolviera `true` «para no bloquear al
 * médico», convertiría cada caída del verificador en una puerta abierta entre
 * consultorios. Es la diferencia entre perder telemetría y perder aislamiento.
 */
export function compuertaQueFallaCerrada(
  comprobar: () => boolean,
  clase: ClaseDeInvariante = 'seguridad',
): { permitido: boolean; porQue: string } {
  if (clase !== 'seguridad') {
    throw new Error('[incidents/telemetria] esta compuerta es sólo para invariantes de seguridad')
  }
  try {
    const ok = comprobar() === true
    return ok
      ? { permitido: true, porQue: 'la comprobación de seguridad pasó' }
      : { permitido: false, porQue: 'la comprobación de seguridad no pasó' }
  } catch {
    return {
      permitido: false,
      porQue: 'no se pudo comprobar el invariante de seguridad: se deniega. Fallar abierto aquí es abrir la puerta.',
    }
  }
}

export const POR_QUE_UNA_FALLA_ABIERTA_Y_LA_OTRA_CERRADA =
  'Porque fallar abierto cuesta SABER y fallar cerrado cuesta PODER. Perder la ' +
  'anotación de un incidente cuesta enterarse más tarde; perder la comprobación ' +
  'de aislamiento cuesta que un consultorio lea el expediente de otro. Lo ' +
  'primero se recupera; lo segundo no.'
