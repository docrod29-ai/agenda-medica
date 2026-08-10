/**
 * POST /api/paciente/paquete — LO QUE EL MÉDICO LE ENTREGA AL PACIENTE.
 *
 * V9 · `POSTVISIT-001`. Cierra `POSTVISIT-GATE-001` (la hoja se componía del
 * borrador en curso, sin compuerta de firma) y `POSTVISIT-ENTREGA-001` (la hoja
 * no llegaba nunca al paciente: sólo se podía copiar o imprimir).
 *
 * Dos acciones:
 *   · `estado`  — qué se le ha entregado ya de esta nota (para la pantalla).
 *   · `liberar` — compone el paquete desde la nota FIRMADA y lo pasa a RELEASED.
 *
 * ── POR QUÉ EL CONTENIDO NO VIENE DEL NAVEGADOR ─────────────────────────────
 *
 * El cuerpo de la petición trae `clinicId`, `patientId` y `notaId`, y **nada
 * más**. Ni un medicamento, ni una dosis, ni una línea de texto.
 *
 * Si el navegador mandara el contenido, la compuerta de firma sería decorativa:
 * bastaría con llamar a esta ruta con lo que hubiera en pantalla —o con lo que
 * a alguien le apeteciera— para entregarle al paciente algo que el médico nunca
 * firmó. El servidor lee la nota, comprueba que está firmada, y **compone él**.
 *
 * ── FIRMAR NO ES LIBERAR ────────────────────────────────────────────────────
 *
 * Que la nota esté firmada es condición **necesaria y no suficiente**. Firmar
 * va hacia el expediente; liberar va hacia el paciente. Esta ruta es el segundo
 * acto, y por eso existe: sin ella, firmar entregaría solo.
 *
 * ── UNA ENTREGA NO SE EDITA: SE ENTREGA OTRA VEZ ────────────────────────────
 *
 * Cada liberación escribe un documento nuevo con su `version`. Un paquete
 * liberado es inmutable —igual que una nota firmada— porque dentro de un año la
 * pregunta será «¿qué se le dijo exactamente a este paciente?», y la respuesta
 * no puede ser «lo que compondría hoy el código».
 */
import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'
import { verificarCapacidad } from '@/lib/authz/verificar'
import { safeLog } from '@/lib/security/sanitize'
import {
  componerPaquete, liberar, tieneContenidoParaElPaciente,
  ERROR_NOTA_SIN_FIRMAR,
  type NotaParaElPaquete, type PaqueteDeVisita,
} from '@/lib/paciente/paquete-de-visita'
import { medicamentosVigentes } from '@/lib/expediente/ordenes-medicamento'
import type { NotaMedica } from '@/types/expediente'

/** Lo que la pantalla del médico necesita saber de una entrega ya hecha. */
interface EntregaResumen {
  id: string
  version: number
  estado: string
  approvedAt: number | null
  approvedByName: string | null
}

const coleccionPaquetes = (clinicId: string, patientId: string) =>
  adminDb.collection('clinics').doc(clinicId)
    .collection('patients').doc(patientId)
    .collection('paquetes_visita')

/** Las entregas de ESTA nota, de la más nueva a la más vieja. */
async function entregasDeLaNota(clinicId: string, patientId: string, notaId: string): Promise<EntregaResumen[]> {
  const snap = await coleccionPaquetes(clinicId, patientId).where('notaId', '==', notaId).get()
  return snap.docs
    .map(d => {
      const p = d.data() as Partial<PaqueteDeVisita>
      return {
        id: d.id,
        version: Number(p.version ?? 0),
        estado: String(p.estado ?? ''),
        approvedAt: typeof p.approvedAt === 'number' ? p.approvedAt : null,
        approvedByName: typeof p.approvedByName === 'string' ? p.approvedByName : null,
      }
    })
    .sort((a, b) => b.version - a.version)
}

/**
 * QUÉ TOMABA EL PACIENTE ANTES DE ESTA CONSULTA.
 *
 * `null` cuando el expediente **no tiene ninguna otra nota firmada**: entonces
 * no se sabe qué tomaba, y `cambiosDeMedicacion` se calla en vez de marcar todo
 * como «nuevo». Con al menos una nota firmada anterior sí hay línea base, y la
 * lista puede salir vacía —que significa «no consta que tomara nada»—.
 *
 * Se deriva con `medicamentosVigentes`, el mismo motor que pinta «qué toma hoy»
 * en la cabecera de la consulta. Escribir aquí una segunda regla de «lo último
 * que se dijo de cada fármaco» sería que las dos se separen el día que una se
 * arregle.
 */
async function medicacionPreviaA(
  clinicId: string, patientId: string, notaId: string,
): Promise<readonly string[] | null> {
  const snap = await adminDb.collection('clinics').doc(clinicId)
    .collection('patients').doc(patientId)
    .collection('notas')
    .where('estado', '==', 'firmada')
    .get()

  const otras = snap.docs
    .filter(d => d.id !== notaId)
    .map(d => {
      const n = d.data() as Partial<NotaMedica>
      return { fecha: String(n.fechaConsulta ?? n.createdAt ?? ''), medicamentos: n.medicamentos ?? [] }
    })

  if (!otras.length) return null
  return medicamentosVigentes(otras).map(o => String(o.medicamento.nombre ?? '')).filter(Boolean)
}

export async function POST(req: NextRequest) {
  let body: { clinicId?: string; patientId?: string; notaId?: string; accion?: string; seguimiento?: string }
  try { body = await req.json() } catch { return NextResponse.json({ ok: false, error: 'Petición inválida' }, { status: 400 }) }

  const clinicId = String(body.clinicId ?? '').trim()
  const patientId = String(body.patientId ?? '').trim()
  const notaId = String(body.notaId ?? '').trim()
  const accion = String(body.accion ?? 'estado')
  if (!clinicId || !patientId || !notaId) {
    return NextResponse.json({ ok: false, error: 'Faltan datos' }, { status: 400 })
  }

  /**
   * `firmar` y no `clinico.escribir`: liberar es un acto de aprobación con
   * identidad profesional detrás, igual que sellar una nota o una receta. La
   * asistente puede agendar y cobrar; decidir qué lee el paciente de su
   * consulta, no.
   */
  const acceso = await verificarCapacidad(req, clinicId, 'firmar')
  if (!acceso.ok) return acceso.response

  try {
    if (accion === 'estado') {
      return NextResponse.json({ ok: true, entregas: await entregasDeLaNota(clinicId, patientId, notaId) })
    }

    if (accion !== 'liberar') {
      return NextResponse.json({ ok: false, error: 'Acción no soportada' }, { status: 400 })
    }

    const notaSnap = await adminDb.collection('clinics').doc(clinicId)
      .collection('patients').doc(patientId)
      .collection('notas').doc(notaId).get()
    if (!notaSnap.exists) {
      return NextResponse.json({ ok: false, error: 'No encontramos esa nota.' }, { status: 404 })
    }
    const nota = notaSnap.data() as Partial<NotaMedica>

    /**
     * LA COMPUERTA, ANTES DE LEER NADA MÁS.
     *
     * `componerPaquete` vuelve a comprobarlo y lanza — a propósito: la misma
     * regla vive en el motor puro (probada al revés) y en la frontera HTTP, que
     * es la que le tiene que contestar algo entendible al médico.
     */
    if (nota.estado !== 'firmada') {
      return NextResponse.json({ ok: false, error: ERROR_NOTA_SIN_FIRMAR }, { status: 409 })
    }

    const previas = await medicacionPreviaA(clinicId, patientId, notaId)
    const yaEntregado = await entregasDeLaNota(clinicId, patientId, notaId)
    const version = (yaEntregado[0]?.version ?? 0) + 1

    const config = (await adminDb.collection('clinics').doc(clinicId).collection('config').doc('main').get())
      .data() as { whatsappConsultorio?: string; telefonoAdmin?: string } | undefined
    const telefono = String(config?.whatsappConsultorio ?? config?.telefonoAdmin ?? '').trim()

    const paraElPaquete: NotaParaElPaquete = {
      id: notaId,
      estado: String(nota.estado),
      resumenEjecutivo: nota.resumenEjecutivo,
      diagnosticos: nota.diagnosticos,
      medicamentos: nota.medicamentos,
      estudiosOrden: nota.estudiosOrden,
    }

    const borrador = componerPaquete({
      nota: paraElPaquete,
      medicacionPrevia: previas,
      seguimiento: String(body.seguimiento ?? '').trim(),
      /**
       * A quién llamar. Es dato administrativo del consultorio, no indicación
       * médica: se compone, y si no hay teléfono no se inventa una vía.
       */
      reglasDeContacto: telefono
        ? `Si tienes dudas sobre esto, llama a tu consultorio: ${telefono}. Si es una urgencia, acude a urgencias o llama al 911.`
        : '',
      version,
    })

    if (!tieneContenidoParaElPaciente(borrador)) {
      return NextResponse.json(
        { ok: false, error: 'Esta nota no tiene nada que entregarle al paciente: ni resumen, ni medicamentos, ni estudios.' },
        { status: 422 },
      )
    }

    const paquete = liberar(borrador, acceso.uid, Date.now(), nota.firma?.nombreMedico)

    /**
     * El id lleva la versión: una entrega nueva NO pisa la anterior. Lo que se
     * entregó se entregó, y el paciente puede tener las dos delante.
     */
    const docId = `${notaId}__v${paquete.version}`
    try {
      await coleccionPaquetes(clinicId, patientId).doc(docId).create(paquete)
    } catch (e) {
      /**
       * `create` falla si el documento ya existe, y ése es exactamente el caso
       * del doble clic: dos peticiones calculan la misma versión y la segunda
       * llega tarde. Se contesta lo que pasó —ya se entregó— en vez de un 500
       * genérico que invita a volver a pulsar.
       */
      if ((e as { code?: number }).code === 6) {
        return NextResponse.json(
          { ok: false, error: 'Ese resumen ya se entregó. Recarga para ver la entrega.' },
          { status: 409 },
        )
      }
      throw e
    }

    void adminDb.collection('clinics').doc(clinicId).collection('audit_log').add({
      evento: 'paquete_visita_liberado',
      clinicId, patientId, notaId,
      timestamp: new Date().toISOString(),
      uid: acceso.uid,
      meta: { version: paquete.version, medicamentos: paquete.medicationInstructions.length, estudios: paquete.orders.length },
    }).catch(() => {})

    return NextResponse.json({ ok: true, paquete: { ...paquete, id: docId } })
  } catch (e) {
    safeLog.error('[paciente/paquete] error', e)
    return NextResponse.json({ ok: false, error: 'No se pudo entregar el resumen. Intenta de nuevo.' }, { status: 500 })
  }
}
