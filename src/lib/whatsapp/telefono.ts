/**
 * Normalización PURA de teléfono para WhatsApp — sin dependencias de servidor,
 * así que se puede importar tanto desde el cliente como desde el servidor.
 *
 * Vive aparte de `consent.ts` (que importa firebase-admin y NO es client-safe)
 * para que componentes del cliente puedan usar la misma clave canónica. `consent.ts`
 * la re-exporta para no romper los imports existentes.
 *
 * ── LO QUE ESTO NO HACE NUNCA (Panel de Lujo ASM-002, REP-034) ─────────────────
 *
 * La primera versión unificaba las DOS formas del mismo número mexicano
 * (`521…` y `52…`) con una regla que decía «si no empieza por 52, le falta la
 * lada». Aplicada a «+1 619 555 1234» fabricaba 526195551234: un número
 * mexicano de otra persona, al que salía el recordatorio con nombre, médico,
 * fecha y consultorio — y el envío se reportaba «ok».
 *
 * Ahora sólo se normaliza lo que se ENTIENDE:
 *  · un «+» delante declara el país y se respeta tal cual (E.164 sin el «+»);
 *  · 10 dígitos sin país son un número nacional mexicano → `52` + 10;
 *  · `52` + 10 y `521` + 10 (móvil como lo manda WhatsApp) convergen a `52` + 10;
 *  · cualquier otra cosa NO se adivina: `analizarTelefonoWa` devuelve `ok: false`
 *    con el motivo, y `normalizarTelefonoWa` devuelve cadena vacía. Vacío no se
 *    manda a ningún sitio; fabricado sí se mandaba.
 */

/** Longitud de un número E.164 completo (sin «+»): de 8 a 15 dígitos. */
const E164_MIN = 8
const E164_MAX = 15

export type MotivoTelefonoInvalido =
  | 'vacio'
  | 'longitud'
  | 'mexicano-incompleto'

export type TelefonoAnalizado =
  | {
      ok: true
      /** E.164 sin «+»: `525550101010`, `16195551234`, `34600000000`. */
      e164: string
      /** ¿Es un número mexicano (código 52)? */
      esMexicano: boolean
      /** true cuando venían 10 dígitos sin país y se asumió México. */
      asumidoMx: boolean
    }
  | { ok: false; motivo: MotivoTelefonoInvalido; mensaje: string }

const MENSAJES: Record<MotivoTelefonoInvalido, string> = {
  vacio: 'Falta el teléfono.',
  longitud: 'No entendí ese teléfono: escribe los 10 dígitos (55 1234 5678) o, si es de otro país, empieza por «+» y el código del país.',
  'mexicano-incompleto': 'Un número de México lleva 10 dígitos después del 52.',
}

/**
 * Entiende un teléfono o dice por qué no lo entiende. Nunca inventa un país.
 */
export function analizarTelefonoWa(raw: string): TelefonoAnalizado {
  const limpio = String(raw ?? '').trim()
  const conPais = limpio.startsWith('+') || limpio.startsWith('00')
  const d = limpio.replace(/\D/g, '')
  if (!d) return { ok: false, motivo: 'vacio', mensaje: MENSAJES.vacio }

  const digitos = limpio.startsWith('00') ? d.slice(2) : d

  if (conPais) {
    if (digitos.startsWith('52')) {
      const mx = colapsarMovilMx(digitos)
      if (mx.length !== 12) return { ok: false, motivo: 'mexicano-incompleto', mensaje: MENSAJES['mexicano-incompleto'] }
      return { ok: true, e164: mx, esMexicano: true, asumidoMx: false }
    }
    if (digitos.length < E164_MIN || digitos.length > E164_MAX) {
      return { ok: false, motivo: 'longitud', mensaje: MENSAJES.longitud }
    }
    return { ok: true, e164: digitos, esMexicano: false, asumidoMx: false }
  }

  // Sin «+»: sólo se entienden las tres formas mexicanas conocidas.
  if (digitos.length === 10) return { ok: true, e164: `52${digitos}`, esMexicano: true, asumidoMx: true }
  if (digitos.startsWith('52')) {
    const mx = colapsarMovilMx(digitos)
    if (mx.length === 12) return { ok: true, e164: mx, esMexicano: true, asumidoMx: false }
    return { ok: false, motivo: 'mexicano-incompleto', mensaje: MENSAJES['mexicano-incompleto'] }
  }
  return { ok: false, motivo: 'longitud', mensaje: MENSAJES.longitud }
}

/** `521` + 10 dígitos (móvil como lo manda WhatsApp) → `52` + 10 dígitos. */
function colapsarMovilMx(d: string): string {
  return d.length === 13 && d[2] === '1' ? `52${d.slice(3)}` : d
}

/**
 * Forma CANÓNICA de un teléfono para WhatsApp: E.164 sin «+».
 *
 * Para México es `52` + 10 dígitos (WhatsApp entrega el remitente de un móvil
 * como `52 1 XXXXXXXXXX`, recepción captura 10 dígitos: sin normalizar eran DOS
 * claves para el mismo número y la baja se guardaba bajo una mientras el
 * recordatorio la buscaba bajo la otra).
 *
 * Devuelve `''` cuando el número no se entiende. Quien la use como clave o como
 * destino tiene que comprobar que no esté vacía; `telefonoValidoParaWa` lo
 * dice en una sola llamada.
 */
export function normalizarTelefonoWa(raw: string): string {
  const r = analizarTelefonoWa(raw)
  return r.ok ? r.e164 : ''
}

/**
 * El `wa_id` que manda Meta/360dialog ya viene en formato internacional sin
 * «+» (`5215551234567`, `16195551234`). Se analiza como si trajera el «+»: un
 * remitente de EE.UU. no se convierte en mexicano ni se rechaza por «longitud
 * extraña».
 */
export function normalizarWaId(waId: string): string {
  const d = String(waId ?? '').replace(/\D/g, '')
  if (!d) return ''
  return normalizarTelefonoWa(`+${d}`)
}

/** ¿Se puede usar como destino o como clave? */
export function telefonoValidoParaWa(raw: string): boolean {
  return analizarTelefonoWa(raw).ok
}

/**
 * Cómo lo verá WhatsApp: «+52 55 5010 1010», «+1 619 555 1234», «+34 600000000».
 * Para enseñarlo ANTES de guardar; vacío si no se entiende.
 */
export function formatoLegibleWa(raw: string): string {
  const r = analizarTelefonoWa(raw)
  if (!r.ok) return ''
  const e = r.e164
  if (r.esMexicano) return `+52 ${e.slice(2, 4)} ${e.slice(4, 8)} ${e.slice(8)}`
  if (e.startsWith('1') && e.length === 11) return `+1 ${e.slice(1, 4)} ${e.slice(4, 7)} ${e.slice(7)}`
  return `+${e}`
}

/**
 * CLAVE de contacto (opt-out, ventana de 24 h, sesión del bot): acepta lo que
 * `normalizarTelefonoWa` entiende y, si no, el `wa_id` internacional que manda
 * el proveedor. Una clave equivocada sólo produce un fallo de búsqueda; por eso
 * aquí se puede ser más laxo que con un DESTINO, que se valida estricto con
 * `telefonoValidoParaWa` antes de enviar. Nunca fabrica un `52`.
 */
export function claveTelefonoWa(raw: string): string {
  return normalizarTelefonoWa(raw) || normalizarWaId(raw)
}
