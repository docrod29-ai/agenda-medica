import { NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'
import { safeLog } from '@/lib/security/sanitize'
import { tokenVigente } from '@/lib/patient-token'

/**
 * ¿SIGUE VIGENTE EL MAGIC-LINK DEL PACIENTE? — PATIENT-PORTAL-001 (P1).
 *
 * ── EL INVARIANTE ────────────────────────────────────────────────────────────
 *
 *      ERROR DE VALIDACIÓN / REVOCACIÓN  ≠  AUTORIZACIÓN
 *
 * Un token cuya vigencia NO se puede comprobar no gana privilegios durante una
 * incidencia. No poder leer el expediente significa «no lo sé», y «no lo sé» no
 * es «adelante».
 *
 * ── LO QUE HABÍA ─────────────────────────────────────────────────────────────
 *
 * `/api/portal` leía `patients/{id}.portalTokenVersion` dentro de un `try`
 * cuyo `catch` estaba vacío y comentado «se deja pasar». El motivo era razonable
 * —«dejar al paciente fuera de su propia agenda por un mal minuto de Firestore
 * es peor que el riesgo que esto acota»— y es FALSO por una razón medible:
 *
 *   si Firestore no responde, las acciones del portal fallan IGUAL unas líneas
 *   más abajo (`session` lee citas, `documentos` lee notas, `reagendar` abre una
 *   transacción). El fail-open no le devolvía la agenda a nadie: sólo le
 *   devolvía la agenda a los enlaces YA REVOCADOS, que son los únicos a los que
 *   el `catch` cambiaba el resultado.
 *
 * O sea: coste de disponibilidad ~0, beneficio para el atacante = todo. El
 * teléfono perdido, el número reciclado y el mensaje reenviado a un grupo
 * volvían a valer justo durante la incidencia, que es cuando nadie mira.
 *
 * `/api/payment/create-checkout` era peor: aceptaba el mismo token y NO
 * comprobaba la revocación en ningún caso.
 *
 * ── LO QUE HACE AHORA ────────────────────────────────────────────────────────
 *
 * Tres estados, no dos. Y el tercero NO se confunde con ninguno de los otros:
 *
 *   · `vigente`        → el expediente dice que este enlace vale.
 *   · `revocado`       → el expediente dice que NO. 401, definitivo.
 *   · `indeterminado`  → no se pudo preguntar. 503 + `Retry-After`, RETRYABLE.
 *
 * El 503 importa tanto como el 401: el enlace NO se quema. Cuando Firestore
 * vuelve, el mismo token del mismo paciente funciona sin que nadie tenga que
 * reemitirlo. Un fail-closed que además invalidase el enlace convertiría una
 * incidencia de cinco minutos en una tarde de llamadas al consultorio.
 *
 * ── EXPEDIENTE QUE NO EXISTE = REVOCADO ──────────────────────────────────────
 *
 * Antes, un token que apuntaba a un paciente inexistente pasaba el control
 * (`portalTokenVersion` ausente → versión 0 → `v >= 0`) y se apoyaba en que las
 * consultas de después devolvieran vacío. Eso es aislamiento por accidente.
 *
 * Un expediente que no está es un paciente dado de baja (cancelación ARCO) o un
 * token que nombra un consultorio que no es el suyo. En los dos casos la
 * respuesta correcta es la misma y se da AQUÍ, en la puerta, no dependiendo de
 * que ninguna consulta de más abajo se equivoque de filtro.
 */

export type Vigencia = 'vigente' | 'revocado' | 'indeterminado'

/** Lo que se pudo averiguar del expediente. `ok:false` = la lectura lanzó. */
export type LecturaDelExpediente =
  | { ok: true; existe: boolean; version: number | undefined }
  | { ok: false }

export const MOTIVO_REVOCADO =
  'Este enlace ya no es válido. Pídele uno nuevo al consultorio.'

export const MOTIVO_INDETERMINADO =
  'No pudimos verificar tu enlace en este momento. Vuelve a intentarlo en un minuto.'

/** Segundos que se le piden al cliente antes de reintentar un `indeterminado`. */
export const REINTENTO_SEG = 30

/**
 * DECISIÓN PURA. Sin red, sin Firestore, sin `NextResponse`: se puede probar
 * con una tabla, y es la única que decide. La lectura y la respuesta son
 * cableado alrededor de esto.
 */
export function decidirVigencia(
  versionDelToken: number,
  lectura: LecturaDelExpediente,
): Vigencia {
  if (!lectura.ok) return 'indeterminado'
  if (!lectura.existe) return 'revocado'
  return tokenVigente(versionDelToken, lectura.version) ? 'vigente' : 'revocado'
}

/**
 * Lee el expediente y decide. No reintenta a propósito: el Admin SDK ya
 * reintenta los fallos transitorios de gRPC por dentro, y un reintento nuestro
 * sólo duplicaría la espera de los fallos que NO son transitorios.
 */
export async function vigenciaDelEnlace(
  clinicId: string,
  patientId: string,
  versionDelToken: number,
): Promise<Vigencia> {
  let lectura: LecturaDelExpediente
  try {
    const snap = await adminDb
      .collection('clinics').doc(clinicId)
      .collection('patients').doc(patientId)
      .get()
    const datos = snap.data() as { portalTokenVersion?: number } | undefined
    lectura = { ok: true, existe: Boolean(snap.exists), version: datos?.portalTokenVersion }
  } catch (e) {
    // NUNCA el token ni el patientId: el identificador de un expediente es un
    // dato de paciente y esto acaba en los logs de Vercel. El clinicId sí
    // —es el inquilino, y sin él la incidencia no se puede localizar—.
    safeLog.error(`[portal] ${clinicId}: no se pudo comprobar la vigencia del enlace`, e)
    lectura = { ok: false }
  }
  return decidirVigencia(versionDelToken, lectura)
}

/**
 * La respuesta que corresponde, o `null` si el enlace vale y el flujo sigue.
 *
 * Ninguno de los dos mensajes dice de QUÉ paciente se trata ni por qué se
 * revocó: el que recibe esto puede ser quien encontró el teléfono.
 */
export function respuestaDeVigencia(v: Vigencia): NextResponse | null {
  if (v === 'vigente') return null
  if (v === 'revocado') {
    return NextResponse.json({ ok: false, error: MOTIVO_REVOCADO }, { status: 401 })
  }
  return NextResponse.json(
    { ok: false, error: MOTIVO_INDETERMINADO },
    { status: 503, headers: { 'Retry-After': String(REINTENTO_SEG) } },
  )
}

/** Atajo para las rutas: lee, decide y devuelve la respuesta lista (o `null`). */
export async function bloquearSiNoVigente(
  clinicId: string,
  patientId: string,
  versionDelToken: number,
): Promise<NextResponse | null> {
  return respuestaDeVigencia(await vigenciaDelEnlace(clinicId, patientId, versionDelToken))
}
