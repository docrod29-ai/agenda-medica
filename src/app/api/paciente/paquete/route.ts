/**
 * POST /api/paciente/paquete — el médico revisa y LIBERA lo que verá el paciente.
 *
 * V9 · `POSTVISIT-001`. Es la única puerta por la que puede nacer un
 * `PaqueteDeVisita`, y por eso concentra las tres defensas de esta unidad.
 *
 * ── 1. EL CONTENIDO SE COMPONE AQUÍ, NO LLEGA DEL NAVEGADOR ─────────────────
 *
 * El cuerpo de la petición trae **a qué nota** se refiere, nunca **qué dice**
 * el paquete. Si la pantalla pudiera mandar el texto, cualquiera con una sesión
 * de médico —o con la consola abierta— podría hacerle llegar al paciente una
 * dosis que nadie firmó, y saldría con el membrete del consultorio.
 *
 * Por eso el servidor relee la nota de Firestore y vuelve a componer en las DOS
 * acciones. `previsualizar` y `liberar` comparten exactamente el mismo camino
 * de composición: lo que el médico aprueba es lo que se guarda.
 *
 * ── 2. LA COMPUERTA DE FIRMA ────────────────────────────────────────────────
 *
 * `puedeComponerse` exige que la nota esté **firmada**. Hasta hoy la hoja del
 * paciente se componía del borrador EN CURSO (`POSTVISIT-GATE-001`): lo que el
 * médico llevaba dictado a medias ya tenía forma de indicación impresa.
 *
 * ── 3. QUIÉN APRUEBA SALE DE LA SESIÓN ──────────────────────────────────────
 *
 * `approvedBy` es el usuario autenticado, jamás un campo del cuerpo. Un campo
 * de cuerpo convierte la firma de aprobación en algo que se puede escribir.
 *
 * ── POR QUÉ `firmar` Y NO `clinico.escribir` ────────────────────────────────
 *
 * Liberar es el acto por el que el consultorio le dice al paciente «esto es lo
 * que quiero que leas». Es aprobación clínica, del mismo orden que firmar la
 * nota, y por eso pide la misma capacidad: médico y admin. La enfermería puede
 * escribir en el expediente y **no** puede liberarle un plan a un paciente.
 */
import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'
import { safeLog } from '@/lib/security/sanitize'
import { verificarCapacidad } from '@/lib/authz/verificar'
import { limitarOResponder } from '@/lib/rate-limit'
import {
  componerPaquete, liberar, puedeComponerse,
  type PaqueteDeVisita,
} from '@/lib/paciente/paquete-de-visita'
import { medicamentosVigentes } from '@/lib/expediente/ordenes-medicamento'
import { telefonoDelConsultorio } from '@/lib/whatsapp/avisar-consultorio'
import type { NotaMedica } from '@/types/expediente'

export const runtime = 'nodejs'

type Accion = 'previsualizar' | 'liberar'

/**
 * La medicación que el paciente YA tenía, antes de esta consulta.
 *
 * Se deriva de sus notas firmadas **excluyendo la de hoy** — incluirla haría
 * que todo saliera «sin cambio», que es la respuesta que parece correcta y no
 * significa nada.
 *
 * Devuelve `null` si no se pudo leer: sin lista previa, `medicationChanges` va
 * `null` y no `[]`. «No sé qué había antes» no es «no había nada».
 */
async function medicacionPrevia(
  clinicId: string, patientId: string, notaDeHoy: string,
): Promise<{ nombre: string }[] | null> {
  try {
    const snap = await adminDb
      .collection('clinics').doc(clinicId)
      .collection('patients').doc(patientId)
      .collection('notas')
      .where('estado', '==', 'firmada')
      .get()
    const previas = snap.docs
      .filter(d => d.id !== notaDeHoy)
      .map(d => {
        const n = d.data() as NotaMedica
        return { fecha: String(n.fechaConsulta ?? ''), medicamentos: n.medicamentos ?? [] }
      })
    return medicamentosVigentes(previas).map(o => ({ nombre: o.medicamento.nombre }))
  } catch (e) {
    safeLog.warn('[paciente/paquete] no se pudo leer la medicación previa', e)
    return null
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const clinicId = String(body?.clinicId ?? '').trim()
    const patientId = String(body?.patientId ?? '').trim()
    const notaId = String(body?.notaId ?? '').trim()
    const accion: Accion = body?.accion === 'liberar' ? 'liberar' : 'previsualizar'
    /**
     * Los signos de alarma los ESCRIBE el médico en su pantalla. Es el único
     * texto del paquete que viaja desde el navegador, y es correcto que viaje:
     * es indicación médica suya, escrita por él, en el momento de aprobar. Lo
     * que no puede viajar es el resto — dosis, estudios, resumen —, que sale de
     * la nota firmada.
     */
    const signosDeAlarma: string[] = Array.isArray(body?.signosDeAlarma)
      ? body.signosDeAlarma.map((s: unknown) => String(s ?? '').trim()).filter(Boolean).slice(0, 12)
      : []

    if (!clinicId || !patientId || !notaId) {
      return NextResponse.json({ ok: false, error: 'Faltan clinicId, patientId o notaId' }, { status: 400 })
    }

    const acceso = await verificarCapacidad(req, clinicId, 'firmar')
    if (!acceso.ok) return acceso.response

    /* Liberar escribe un documento por llamada: sin tope, un bucle deja el
       expediente del paciente lleno de versiones idénticas. */
    const limite = await limitarOResponder(
      `paquete:${clinicId}:${patientId}`, 30, 600,
      'Demasiadas liberaciones seguidas. Espera un momento e inténtalo de nuevo.',
    )
    if (limite) return limite

    const pacienteRef = adminDb
      .collection('clinics').doc(clinicId)
      .collection('patients').doc(patientId)

    const notaSnap = await pacienteRef.collection('notas').doc(notaId).get()
    if (!notaSnap.exists) {
      return NextResponse.json({ ok: false, error: 'Nota no encontrada' }, { status: 404 })
    }
    const nota = { id: notaSnap.id, ...(notaSnap.data() as Omit<NotaMedica, 'id'>) }

    /* La compuerta ANTES de leer nada más: si la nota no puede dar un paquete,
       no hay motivo para tocar el resto del expediente. */
    const veredicto = puedeComponerse(nota)
    if (!veredicto.ok) {
      return NextResponse.json({ ok: false, error: veredicto.motivo }, { status: 409 })
    }

    const [previa, cfgSnap, pacSnap, yaHay] = await Promise.all([
      medicacionPrevia(clinicId, patientId, notaId),
      adminDb.collection('clinics').doc(clinicId).collection('config').doc('main').get(),
      pacienteRef.get(),
      pacienteRef.collection('paquetes_visita').where('notaId', '==', notaId).get(),
    ])

    /**
     * La versión sube con cada liberación de la MISMA nota. Un paquete liberado
     * es inmutable: corregirlo es liberar una versión nueva, igual que una
     * adenda no reescribe la nota.
     */
    const version = yaHay.docs.reduce(
      (max, d) => Math.max(max, Number((d.data() as PaqueteDeVisita).version) || 0), 0) + 1

    const paquete = componerPaquete({
      nota,
      medicacionPrevia: previa,
      proximoSeguimiento: (pacSnap.data() as { proximoSeguimiento?: string } | undefined)?.proximoSeguimiento,
      signosDeAlarma,
      telefonoDelConsultorio: telefonoDelConsultorio(
        cfgSnap.exists ? (cfgSnap.data() as { whatsappConsultorio?: string; telefonoAdmin?: string }) : null),
      version,
    })

    if (accion === 'previsualizar') {
      /* Un DRAFT no se guarda: es lo que el médico está mirando antes de
         decidir. Guardarlo dejaría borradores en el expediente del paciente
         cada vez que alguien abre la pantalla. */
      return NextResponse.json({ ok: true, paquete })
    }

    const aprobadoPor = acceso.email || acceso.uid
    const liberado = liberar(paquete, aprobadoPor, Date.now())
    const ref = await pacienteRef.collection('paquetes_visita').add({ ...liberado, notaId })

    safeLog.info('[paciente/paquete] liberado', { version, paqueteId: ref.id })
    return NextResponse.json({ ok: true, paquete: { ...liberado, id: ref.id } })
  } catch (e) {
    safeLog.error('[paciente/paquete] error', e)
    return NextResponse.json({ ok: false, error: 'Error del servidor' }, { status: 500 })
  }
}
