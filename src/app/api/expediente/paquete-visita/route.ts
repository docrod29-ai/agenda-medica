import { NextRequest, NextResponse } from 'next/server'
import admin, { adminDb } from '@/lib/firebase-admin'
import { verificarCapacidad } from '@/lib/authz/verificar'
import { safeLog } from '@/lib/security/sanitize'
import {
  componerPaquete, liberar, COLECCION_PAQUETES,
  NOTA_SIN_FIRMAR,
  type PaqueteDeVisita,
} from '@/lib/paciente/paquete-de-visita'
import type { NotaMedica } from '@/types/expediente'

/**
 * ENTREGARLE LA CONSULTA AL PACIENTE — V9 · `POSTVISIT-001`.
 *
 * ── QUÉ CIERRA ──────────────────────────────────────────────────────────────
 *
 * `POSTVISIT-GATE-001` y `POSTVISIT-ENTREGA-001`, que eran las dos mitades del
 * mismo hueco:
 *
 *  · **La compuerta.** La hoja del paciente se componía del **estado vivo de la
 *    pantalla**: el médico podía copiar y entregar una hoja hecha de un borrador
 *    a medio dictar. Aquí la nota se lee de la base y **tiene que estar
 *    firmada**; lo comprueba `componerPaquete`, que lanza si no lo está.
 *  · **El camino.** El contenido estaba resuelto desde REG-242 y el producto no
 *    lo entregaba: dos botones, copiar e imprimir, y nada más. Ahora el paquete
 *    queda escrito donde `/api/portal` lo lee.
 *
 * ── POR QUÉ ESTO ES SERVIDOR Y NO PANTALLA ──────────────────────────────────
 *
 * Porque `approvedBy` tiene que ser **quien de verdad aprobó**, y eso sólo lo
 * sabe quien verificó el token. Si el navegador pudiera escribir el paquete,
 * cualquiera con la sesión abierta podría poner `estado: 'RELEASED'` sobre un
 * borrador y `approvedBy` con el nombre que quisiera. `firestore.rules` mantiene
 * `paquetes_visita` con `write: if false` justamente por esto.
 *
 * ── POR QUÉ EXIGE `firmar` Y NO `clinico.escribir` ──────────────────────────
 *
 * Las dos capacidades son hoy el mismo conjunto de roles ({medico, admin}), así
 * que no estrecha ni amplía el acceso de nadie. Se elige `firmar` porque es el
 * verbo correcto: liberar es un acto de aprobación que queda con nombre y fecha,
 * y el día que las dos capacidades dejen de coincidir esta ruta tiene que
 * seguir a la que lleva identidad detrás.
 *
 * ── LO QUE ESTA RUTA NO HACE ────────────────────────────────────────────────
 *
 * **No vuelve a liberar.** Si ya hay un paquete liberado para esa nota, contesta
 * 409 y no lo toca. Un paquete liberado es inmutable —«lo que se entregó se
 * entregó»— y corregirlo es liberar una **versión nueva**, que necesita que el
 * paciente pueda ver las dos y saber cuál manda. Eso es versionado de documentos
 * y llega con `DOCUMENTS-001` (`POSTVISIT-VERSION-001` en el backlog).
 * Sobreescribir en silencio habría sido la alternativa cómoda y falsa: el
 * paciente leyó una cosa y el expediente diría otra.
 */
export const runtime = 'nodejs'

const texto = (v: unknown, max = 200): string =>
  typeof v === 'string' ? v.trim().slice(0, max) : ''

function refPaciente(clinicId: string, patientId: string) {
  return adminDb.collection('clinics').doc(clinicId).collection('patients').doc(patientId)
}

/**
 * La medicación de la visita ANTERIOR, o `undefined` si no se sabe.
 *
 * La distinción es la que hace segura la casilla de «qué cambió»:
 *
 *  · Hay una nota firmada anterior → se devuelve su medicación, aunque esté
 *    vacía. Vacía es un dato: en esa visita no llevaba nada.
 *  · No hay ninguna → `undefined`. Primera visita registrada aquí **no
 *    significa** que el paciente no tomara nada antes: significa que este
 *    expediente no lo sabe. `cambiosDeMedicacion` lo convierte en `null` y el
 *    paciente no lee una afirmación que nadie puede sostener.
 */
async function medicacionDeLaVisitaAnterior(
  clinicId: string, patientId: string, nota: NotaMedica,
): Promise<NotaMedica['medicamentos'] | undefined> {
  const snap = await refPaciente(clinicId, patientId)
    .collection('notas')
    .where('estado', '==', 'firmada')
    .get()

  const anteriores = snap.docs
    .filter(d => d.id !== nota.id)
    .map(d => ({ id: d.id, ...(d.data() as Omit<NotaMedica, 'id'>) }))
    .filter(n => String(n.fechaConsulta ?? '') < String(nota.fechaConsulta ?? ''))
    .sort((a, b) => String(b.fechaConsulta).localeCompare(String(a.fechaConsulta)))

  const previa = anteriores[0]
  if (!previa) return undefined
  return Array.isArray(previa.medicamentos) ? previa.medicamentos : []
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>
  try { body = await req.json() } catch {
    return NextResponse.json({ ok: false, error: 'JSON inválido' }, { status: 400 })
  }

  const clinicId = texto(body.clinicId, 128)
  const acceso = await verificarCapacidad(req, clinicId, 'firmar')
  if (!acceso.ok) return acceso.response

  const patientId = texto(body.patientId, 128)
  const notaId = texto(body.notaId, 128)
  const accion = texto(body.accion, 32)
  if (!patientId || !notaId) {
    return NextResponse.json({ ok: false, error: 'Falta el paciente o la nota' }, { status: 400 })
  }
  if (accion !== 'estado' && accion !== 'liberar') {
    return NextResponse.json({ ok: false, error: 'Acción no soportada' }, { status: 400 })
  }

  try {
    const refPaquete = refPaciente(clinicId, patientId).collection(COLECCION_PAQUETES).doc(notaId)

    /* Lo que ya se entregó, si se entregó. Las dos acciones lo necesitan. */
    const yaSnap = await refPaquete.get()
    const ya = yaSnap.exists ? (yaSnap.data() as PaqueteDeVisita) : null

    if (accion === 'estado') {
      return NextResponse.json({
        ok: true,
        liberado: ya?.estado === 'RELEASED',
        approvedAt: ya?.approvedAt ?? null,
        version: ya?.version ?? null,
      })
    }

    if (ya?.estado === 'RELEASED') {
      /* No se reescribe lo entregado. Ver la cabecera: es 409, no un `set` alegre. */
      return NextResponse.json({
        ok: false,
        error: 'Esta consulta ya se le entregó al paciente. Para corregirla hace falta una versión nueva.',
        liberado: true,
        approvedAt: ya.approvedAt ?? null,
      }, { status: 409 })
    }

    const notaSnap = await refPaciente(clinicId, patientId).collection('notas').doc(notaId).get()
    if (!notaSnap.exists) {
      return NextResponse.json({ ok: false, error: 'La nota no existe' }, { status: 404 })
    }
    const nota = { id: notaSnap.id, ...(notaSnap.data() as Omit<NotaMedica, 'id'>) }

    /**
     * LA FECHA DE SEGUIMIENTO SALE DEL PACIENTE, DONDE LA ESCRIBE LA CONSULTA.
     *
     * `proximoSeguimiento` no vive en la nota: la pantalla de consulta lo guarda
     * en el paciente al firmar (REG-244). Se lee de ahí y no se le pide al
     * cliente — un cliente que manda la fecha puede mandar cualquiera.
     */
    const pacSnap = await refPaciente(clinicId, patientId).get()
    const cuandoVolver = texto((pacSnap.data() ?? {}).proximoSeguimiento, 64)

    const medicacionPrevia = await medicacionDeLaVisitaAnterior(clinicId, patientId, nota)

    let paquete: PaqueteDeVisita
    try {
      paquete = componerPaquete({ nota, medicacionPrevia, cuandoVolver })
    } catch (e) {
      /**
       * LA COMPUERTA DE FIRMA, CONTESTADA COMO LO QUE ES: 409, no 500.
       *
       * Que la nota no esté firmada no es un fallo del servidor ni del cliente
       * que pidió: es un estado del expediente. El mensaje se le puede enseñar
       * al médico tal cual.
       */
      const msg = e instanceof Error ? e.message : ''
      if (msg === NOTA_SIN_FIRMAR) {
        return NextResponse.json({ ok: false, error: NOTA_SIN_FIRMAR }, { status: 409 })
      }
      throw e
    }

    /**
     * QUIÉN APROBÓ: el correo del token verificado, con el uid como respaldo.
     * Nunca el cuerpo de la petición.
     */
    const quien = acceso.email || acceso.uid
    const liberado = liberar(paquete, quien, Date.now())

    /**
     * LISTA BLANCA DE CAMPOS, no un `set` del objeto que llegó.
     *
     * El paquete lo compone este servidor, así que hoy no hay campo de más. Se
     * enumera igual: el día que `componerPaquete` gane un campo interno, aquí
     * no entra sin que alguien lo escriba.
     */
    await refPaquete.set({
      notaId: liberado.notaId,
      encounterSummary: liberado.encounterSummary,
      medicationInstructions: liberado.medicationInstructions,
      medicationChanges: liberado.medicationChanges,
      orders: liberado.orders,
      followUp: liberado.followUp,
      warningSigns: liberado.warningSigns,
      educationalMaterial: liberado.educationalMaterial,
      documents: liberado.documents,
      unansweredQuestions: liberado.unansweredQuestions,
      clinicianContactRules: liberado.clinicianContactRules,
      language: liberado.language,
      estado: liberado.estado,
      approvedAt: liberado.approvedAt,
      approvedBy: liberado.approvedBy,
      version: liberado.version,
      /* Hora del servidor, junto a `approvedAt`: una divergencia grande es señal. */
      escritoEn: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: false })

    /* Rastro NOM-024. Sin contenido clínico: qué se liberó y quién, no qué dice. */
    void adminDb.collection('clinics').doc(clinicId).collection('audit_log').add({
      evento: 'paquete_visita_liberado',
      clinicId, patientId, notaId,
      medicoUid: acceso.uid,
      medicoEmail: acceso.email ?? null,
      rol: acceso.role ?? null,
      meta: {
        version: liberado.version,
        medicamentos: liberado.medicationInstructions.length,
        estudios: liberado.orders.length,
        cambiosCalculados: liberado.medicationChanges !== null,
      },
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    }).catch(() => {})

    return NextResponse.json({
      ok: true,
      liberado: true,
      approvedAt: liberado.approvedAt,
      version: liberado.version,
    })
  } catch (e) {
    safeLog.error('[paquete-visita] error', e)
    return NextResponse.json({ ok: false, error: 'Error del servidor' }, { status: 500 })
  }
}
