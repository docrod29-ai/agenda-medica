/**
 * EL HILO QUE CRUZA LAS CAPAS — correlationId y compañía.
 *
 * ── EL PROBLEMA ──────────────────────────────────────────────────────────────
 *
 * Un médico dice «se quedó pensando y no guardó». Hoy, para reconstruir eso hay
 * que cruzar a mano: el registro del navegador (que no se guarda), el de la
 * ruta de API (que no lleva identificador de petición), y el asiento del libro
 * de costos (que lleva el suyo propio). Tres registros y ninguna forma de
 * decir que hablan de la misma consulta.
 *
 * Un identificador por petición, propagado, convierte esa arqueología en una
 * consulta. Es la pieza que #310 pide («correlation IDs end-to-end») y la que
 * no existe.
 *
 * ── POR QUÉ NO ES PHI ────────────────────────────────────────────────────────
 *
 * Se genera al azar y no se deriva de nada del paciente. Un identificador
 * derivado (del expediente, del correo, de la hora de la cita) volvería a meter
 * en la telemetría lo que se quería sacar de ella. Por eso `nuevoCorrelationId`
 * NO acepta una semilla de dominio: la firma impide el error.
 *
 * Módulo PURO: la fuente de azar se inyecta para poder probarlo.
 */

/** Alfabeto sin caracteres ambiguos: se leen en voz alta por teléfono. */
const ALFABETO = '23456789abcdefghjkmnpqrstuvwxyz'

/**
 * Identificador nuevo, opaco y sin origen de dominio.
 *
 * @param azar fuente [0,1). Inyectable SÓLO para pruebas.
 */
export function nuevoCorrelationId(azar: () => number = Math.random): string {
  let s = ''
  for (let i = 0; i < 16; i += 1) s += ALFABETO[Math.floor(azar() * ALFABETO.length) % ALFABETO.length]
  return s
}

/** Cabecera con la que viaja entre el navegador y la API. */
export const CABECERA_CORRELACION = 'x-ausculta-correlation-id'

/**
 * Lee el identificador de una petición entrante, o crea uno.
 *
 * ── POR QUÉ SE RECHAZA EN VEZ DE LIMPIAR ─────────────────────────────────────
 *
 * La tentación es quitar los caracteres malos y quedarse con el resto. Pero
 * `x\n[FAKE] admin login ok` limpiado se convierte en `xfakeadminloginok`: ya
 * no puede inyectar una línea en el registro, y sin embargo sigue siendo texto
 * que alguien de fuera eligió y que va a aparecer en la telemetría de todo el
 * sistema.
 *
 * Un identificador de correlación legítimo ya viene con la forma correcta. Si
 * no la tiene, no es un identificador: es otra cosa. Se descarta entera y se
 * genera uno nuevo — el hilo no se pierde, sólo empieza aquí.
 */
export function correlacionDeCabecera(
  valor: string | null | undefined,
  azar: () => number = Math.random,
): { correlationId: string; heredado: boolean } {
  const candidato = (valor ?? '').toLowerCase()
  if (/^[a-z0-9-]{8,64}$/.test(candidato)) return { correlationId: candidato, heredado: true }
  return { correlationId: nuevoCorrelationId(azar), heredado: false }
}

/**
 * Identificador de una OPERACIÓN de encuentro.
 *
 * Es lo que permite seguir «el autoguardado de las 10:42» sin poder decir de
 * qué paciente era. Se compone del seudónimo del encuentro y de un ordinal de
 * operación, ambos opacos.
 */
export function encounterOpId(seudonimoEncuentro: string, ordinal: number): string {
  return `${seudonimoEncuentro}-${String(Math.max(0, Math.floor(ordinal))).padStart(4, '0')}`
}
