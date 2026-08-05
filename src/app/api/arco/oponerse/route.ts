/**
 * POST /api/arco/oponerse
 *
 * LA «O» DE ARCO, QUE SE RESOLVÍA CON UN `prompt()`.
 *
 * La pantalla de Cumplimiento aceptaba solicitudes de Oposición y las «resolvía»
 * escribiendo un texto libre: la solicitud pasaba a «resuelta» y **no se apagaba
 * nada**. El paciente que ejercía su derecho por la vía formal —el portal, por
 * escrito, con su plazo de 20 días hábiles— seguía recibiendo recordatorios. El
 * que escribía «BAJA» por WhatsApp sí dejaba de recibirlos. La vía legal
 * correcta era la única que no funcionaba.
 *
 * Es el mismo defecto que ya se cerró en la «A» (v946) y en la «C», encontrado
 * al verificar aquéllas.
 *
 * ── QUÉ HACE ─────────────────────────────────────────────────────────────────
 *
 * Registra la baja del teléfono —el candado que el envío proactivo YA consulta
 * en cada mensaje—, deja la marca en el expediente, cierra la solicitud y lo
 * asienta en la bitácora.
 *
 * ── LO QUE NO HACE, Y LO DICE ────────────────────────────────────────────────
 *
 * No promete apagar lo que no puede. Los fines sin candado real —promociones,
 * compartir con terceros— quedan registrados y se devuelven como avisos, con la
 * acción concreta que le toca a una persona. Es la lección de la Cancelación:
 * tragar el fallo de la baja hacía que el médico leyera «listo» mientras el
 * paciente seguía recibiendo mensajes.
 *
 * ── POR QUÉ EN EL SERVIDOR ───────────────────────────────────────────────────
 *
 * La baja vive en una colección de la clínica que el navegador no debe escribir
 * a discreción, y la decisión tiene que quedar auditada del lado que no se puede
 * manipular desde una consola.
 *
 * NEEDS_LEGAL_REVIEW: qué fines son separables entre sí y qué constituye una
 * respuesta suficiente al titular lo fija el abogado del consultorio. Aquí sólo
 * se ejecuta lo técnico.
 */
import { NextRequest, NextResponse } from 'next/server'
import { safeLog } from '@/lib/security/sanitize'
import { adminDb } from '@/lib/firebase-admin'
import { verificarCapacidad } from '@/lib/authz/verificar'
import { planDeOposicion, marcaDeOposicion, FINES } from '@/lib/arco/oposicion'

export async function POST(req: NextRequest) {
  let body: {
    clinicId?: string; patientId?: string; solicitudId?: string
    fines?: string[]; simular?: boolean; identidadVerificada?: boolean
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'Cuerpo inválido' }, { status: 400 })
  }
  const { clinicId, patientId } = body
  if (!clinicId || !patientId) {
    return NextResponse.json({ ok: false, error: 'Faltan clinicId o patientId' }, { status: 400 })
  }

  /**
   * `administrar`, igual que la Cancelación: decidir para qué se dejan de usar
   * los datos de un titular es del responsable del tratamiento, no del mostrador.
   */
  const acceso = await verificarCapacidad(req, clinicId, 'administrar')
  if (!acceso.ok) return acceso.response

  const solicitudId = String(body.solicitudId ?? '').trim()
  const plan = planDeOposicion(body.fines)

  /** ENSAYO: dice qué va a pasar sin tocar nada. */
  if (body.simular === true) {
    return NextResponse.json({
      ok: true, simulado: true,
      fines: plan.fines,
      queOcurre: plan.fines.map(f => FINES[f].queOcurre),
      avisos: plan.avisos,
    })
  }

  /**
   * SIN ACREDITAR AL TITULAR NO SE EJECUTA.
   *
   * El portal público pide la identificación como texto libre y nadie la
   * comprueba. El candado no puede estar en el formulario —un impostor teclea lo
   * que sea—, así que está aquí: el médico afirma que verificó, y esa afirmación
   * queda en la bitácora con su nombre.
   */
  if (body.identidadVerificada !== true) {
    return NextResponse.json({
      ok: false,
      error: 'Antes de ejecutar hay que acreditar que quien pide es el titular. El formulario público no lo comprueba.',
    }, { status: 400 })
  }

  try {
    const clinicRef = adminDb.collection('clinics').doc(clinicId)
    const pacienteRef = clinicRef.collection('patients').doc(patientId)
    const pacienteSnap = await pacienteRef.get()
    if (!pacienteSnap.exists) {
      return NextResponse.json({ ok: false, error: 'Ese expediente no existe' }, { status: 404 })
    }
    const paciente = pacienteSnap.data() as Record<string, unknown>

    const previos = ((paciente.arcoOposicion as { fines?: string[] } | undefined)?.fines) ?? []
    const marca = marcaDeOposicion({
      ahoraMs: Date.now(), uid: acceso.uid!, solicitudId, fines: plan.fines, previos,
    })
    await pacienteRef.set({ arcoOposicion: marca }, { merge: true })

    /**
     * LA BAJA ES LO QUE MUERDE HOY.
     *
     * La marca del expediente sirve para lo que la consulte. La baja del
     * teléfono se consulta POR TELÉFONO en cada envío proactivo, así que el
     * paciente deja de recibir mensajes de inmediato.
     */
    const avisos = [...plan.avisos]
    const tel = String(paciente.telefono ?? '').trim()
    let bajaRegistrada = false

    if (plan.requiereBajaContacto) {
      if (tel) {
        const { registrarBaja } = await import('@/lib/whatsapp/consent')
        /**
         * SI LA BAJA NO SE PUDO ESCRIBIR, SE DICE.
         *
         * `registrarBaja` devuelve `false` cuando NO persistió, y además puede
         * lanzar. Las dos formas de fallar se atienden: quedarse sólo con el
         * `catch` dejaría pasar el `false` como si fuera un éxito, que es
         * exactamente el engaño que esta ruta existe para no repetir.
         */
        bajaRegistrada = await registrarBaja(clinicId, tel, 'arco_oposicion').catch(() => false)
        if (!bajaRegistrada) {
          safeLog.warn('[arco/oponerse] marca escrita, baja de WhatsApp no persistida')
          avisos.push('No se pudo registrar la baja del teléfono. La oposición quedó asentada en el expediente, pero hay que dar de baja el contacto a mano en Configuración → Entregas.')
        }
      } else {
        avisos.push('El paciente no tiene teléfono registrado, así que no había baja que dar. Si le escriben por otro número, hay que bloquearlo a mano.')
      }
    }

    /**
     * CERRAR LA SOLICITUD. Si no, el plazo de 20 días sigue corriendo sobre algo
     * ya resuelto — el mismo detalle que se corrigió en la Cancelación.
     */
    if (solicitudId) {
      await clinicRef.collection('arco_requests').doc(solicitudId).set({
        estado: 'resuelta', fechaResolucion: new Date().toISOString(),
        resueltoPor: acceso.uid ?? '',
        resolucion: `Oposición ejecutada para: ${plan.fines.map(f => FINES[f].etiqueta).join(', ')}.` +
          (bajaRegistrada ? ' Baja de contacto registrada.' : '') +
          (avisos.length ? ` Pendiente a mano: ${avisos.length} punto(s).` : ''),
      }, { merge: true }).catch(() => { /* no puede tumbar el derecho */ })
    }

    await clinicRef.collection('audit_log').add({
      evento: 'arco_solicitud_resuelta', clinicId, patientId,
      medicoUid: acceso.uid, medicoEmail: acceso.email ?? '',
      meta: {
        accion: 'oposicion', solicitudId, fines: plan.fines,
        bajaContacto: bajaRegistrada, sinEjecutar: plan.soloRegistrados,
        identidadVerificadaPor: acceso.uid,
      },
      timestamp: new Date().toISOString(),
    }).catch(() => { /* la bitácora no puede tumbar el derecho del paciente */ })

    return NextResponse.json({
      ok: true,
      fines: plan.fines,
      bajaContacto: bajaRegistrada,
      queOcurre: plan.fines.map(f => FINES[f].queOcurre),
      avisos,
    })
  } catch (e) {
    safeLog.error('[arco/oponerse] falló', e)
    return NextResponse.json({ ok: false, error: 'No se pudo ejecutar la oposición' }, { status: 500 })
  }
}
