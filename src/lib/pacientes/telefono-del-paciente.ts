/**
 * ¿ESTE TELÉFONO SIRVE PARA MANDARLE UN MENSAJE AL PACIENTE?
 *
 * ── EL FALLO QUE ESTO REPARA (ASM-001) ───────────────────────────────────────
 *
 * El editor de pacientes validaba el nombre y la edad y NADA del teléfono:
 * «12345» se guardaba con un «Paciente actualizado» en verde. `updateDoc` lo
 * escribía tal cual, las reglas no miran ese campo, y el único control de
 * teléfono del producto vivía en la reserva pública (`api/public/booking`, que
 * exige 7 dígitos) — o sea, en la puerta por la que NO entra el consultorio.
 *
 * Con ese número salen los recordatorios de cita. Un recordatorio que no llega
 * no falla en la pantalla de nadie: se ve exactamente igual que uno entregado,
 * y lo que se nota es la inasistencia, tres semanas después.
 *
 * ── POR QUÉ ES UN MÓDULO Y NO UN `if` EN EL FORMULARIO ───────────────────────
 *
 * Porque son TRES formularios los que capturan el mismo número —el editor de
 * pacientes, el modal de cita y la lista de espera— y tres `if` escritos por
 * separado divergen. La forma canónica ya existe (`normalizarTelefonoWa`, que
 * es la clave con la que se guarda la baja y con la que se busca al enviar):
 * esto no la reinventa, la usa para poder ENSEÑAR el número tal y como lo verá
 * WhatsApp antes de guardarlo.
 *
 * ── LO QUE NO HACE ───────────────────────────────────────────────────────────
 *
 * No comprueba que la línea exista ni que tenga WhatsApp: eso sólo lo sabe el
 * proveedor cuando el mensaje sale. Comprueba la FORMA, que es lo que se puede
 * saber aquí — y el teléfono vacío es válido: hay pacientes sin teléfono, y
 * exigirlo obligaría a inventarse uno.
 *
 * Módulo PURO: sin red, sin reloj.
 */
import { normalizarTelefonoWa } from '@/lib/whatsapp/telefono'

/** Cuántos dígitos tiene un número nacional mexicano, sin lada de país. */
const DIGITOS_MX = 10

/**
 * E.164: el máximo internacional son 15 dígitos incluida la clave de país, y
 * ningún plan nacional del mundo baja de 7. (UIT-T E.164, §2.)
 */
const MIN_E164 = 8
const MAX_E164 = 15

export interface RevisionDeTelefono {
  /** No se escribió nada. Es válido: el teléfono es opcional. */
  vacio: boolean
  /** ¿Se puede guardar? */
  valido: boolean
  /** Sólo dígitos, como se guarda hoy en `Patient.telefono`. */
  digitos: string
  /** Cómo lo verá WhatsApp: «+52 664 123 4567». Vacío si no sirve. */
  comoSeVera: string
  /** Por qué no sirve, en español llano y con el gesto que lo arregla. */
  problema: string
}

/** «5216641234567» → «+52 664 123 4567». Sólo para leerlo, nunca para guardarlo. */
function paraLeer(digitos: string): string {
  const wa = normalizarTelefonoWa(digitos)          // 52 + 10 dígitos
  if (wa.length === 12 && wa.startsWith('52')) {
    const n = wa.slice(2)
    return `+52 ${n.slice(0, 3)} ${n.slice(3, 6)} ${n.slice(6)}`
  }
  return `+${digitos}`
}

export function revisarTelefonoDelPaciente(raw: string | null | undefined): RevisionDeTelefono {
  const texto = String(raw ?? '').trim()
  if (!texto) {
    return { vacio: true, valido: true, digitos: '', comoSeVera: '', problema: '' }
  }

  const vacío = { vacio: false, digitos: '', comoSeVera: '' }

  // Una letra en un teléfono es casi siempre una columna corrida o un dedazo:
  // no se limpia en silencio (regla 3), se dice.
  if (/[a-zA-ZÀ-ÿñÑ]/.test(texto)) {
    return { ...vacío, valido: false, problema: 'Tiene letras. Un teléfono son sólo números.' }
  }

  const internacional = texto.trimStart().startsWith('+')
  const digitos = texto.replace(/\D/g, '')

  if (!digitos) {
    return { ...vacío, valido: false, problema: 'No tiene ningún número.' }
  }

  if (internacional) {
    if (digitos.length < MIN_E164 || digitos.length > MAX_E164) {
      return {
        ...vacío, valido: false,
        problema: `Con «+» hay que escribir la clave del país y el número completo (entre ${MIN_E164} y ${MAX_E164} cifras). Faltan o sobran dígitos.`,
      }
    }
    return { vacio: false, valido: true, digitos, comoSeVera: paraLeer(digitos), problema: '' }
  }

  // Sin «+»: se asume México, que es lo que el producto ya hace al enviar.
  const mexicano =
    digitos.length === DIGITOS_MX ||
    (digitos.length === 12 && digitos.startsWith('52')) ||
    (digitos.length === 13 && digitos.startsWith('521'))

  if (!mexicano) {
    return {
      ...vacío, valido: false,
      problema: digitos.length < DIGITOS_MX
        ? `Faltan dígitos: en México son ${DIGITOS_MX} con la lada (por ejemplo 6641234567). Si es de otro país, escríbelo con «+» y su clave.`
        : `Sobran dígitos: en México son ${DIGITOS_MX} con la lada. Si es de otro país, escríbelo con «+» y su clave.`,
    }
  }

  return { vacio: false, valido: true, digitos, comoSeVera: paraLeer(digitos), problema: '' }
}
