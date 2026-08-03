/**
 * POST /api/arco/acceso
 *
 * LA «A» DE ARCO, QUE SE RESOLVÍA CON UN `prompt()`.
 *
 * ── EL FALLO ─────────────────────────────────────────────────────────────────
 *
 * `lib/arco.ts` declara los cinco derechos —acceso, rectificación, cancelación,
 * oposición, revocación—, el portal público los recibe, y el panel de
 * Cumplimiento **cuenta el plazo de 20 días hábiles** que fija la LFPDPPP.
 *
 * Pero la única que se ejecutaba de verdad era la Cancelación. El Acceso se
 * «resolvía» así (`cumplimiento/page.tsx`):
 *
 *     const resolucion = prompt('Describe brevemente qué se hizo:')
 *
 * Se guardaba el texto, la solicitud pasaba a «resuelta», y **al titular no se
 * le entregaba nada**. El plazo se contaba, la alerta se pintaba, y no había qué
 * entregar cuando vencía.
 *
 * Es el mismo pecado que este repositorio ya se reprochó al construir
 * `arco/cancelar` —«la pantalla aceptaba solicitudes y las resolvía escribiendo
 * un texto libre»— y que seguía vivo para la A.
 *
 * ── QUÉ HACE ─────────────────────────────────────────────────────────────────
 *
 * Arma el expediente completo con el mismo manifiesto que usa el botón del
 * médico —una sola implementación, para que no entreguen cosas distintas—, lo
 * devuelve, y deja **acuse**: el hash SHA-256 de lo entregado, el conteo por
 * sección y la fecha, escritos en la solicitud y en la bitácora.
 *
 * Sin el hash no hay forma de demostrar QUÉ se entregó. Ante el INAI, «le mandé
 * su expediente» sin constancia es lo mismo que no haberlo mandado.
 *
 * NEEDS_LEGAL_REVIEW: qué constituye una respuesta suficiente al titular y en
 * qué formato debe entregarse lo fija el abogado del consultorio. Aquí sólo se
 * ejecuta lo técnico y se deja el rastro.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'node:crypto'
import { safeLog } from '@/lib/security/sanitize'
import { adminDb } from '@/lib/firebase-admin'
import { verificarCapacidad } from '@/lib/authz/verificar'
import { armarExpediente, conteoDeSecciones } from '@/lib/expediente/exportacion-servidor'

export const maxDuration = 60

export async function POST(req: NextRequest) {
  let body: {
    clinicId?: string; patientId?: string; solicitudId?: string
    simular?: boolean; identidadVerificada?: boolean
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
   * `administrar` y no `clinico.escribir`: entregar el expediente a un tercero
   * —aunque ese tercero sea su titular— es una decisión del responsable del
   * tratamiento de los datos, no un acto clínico.
   */
  const acceso = await verificarCapacidad(req, clinicId, 'administrar')
  if (!acceso.ok) return acceso.response

  const solicitudId = String(body.solicitudId ?? '').trim()

  try {
    const expediente = await armarExpediente(clinicId, patientId)
    if (!expediente) {
      return NextResponse.json({ ok: false, error: 'Ese expediente no existe' }, { status: 404 })
    }
    const conteo = conteoDeSecciones(expediente)

    /**
     * ENSAYO: dice QUÉ se va a entregar, sin entregarlo ni cerrar nada.
     *
     * Existe por la misma razón que en la cancelación: nadie debería enterarse
     * de qué salió del consultorio después de haberlo mandado. La pantalla
     * consulta primero, enseña el conteo y lo que falta, y sólo entonces
     * confirma.
     */
    if (body.simular === true) {
      return NextResponse.json({
        ok: true, simulado: true, conteo, faltantes: expediente.faltantes,
      })
    }

    /**
     * SIN ACREDITAR AL TITULAR NO SE ENTREGA.
     *
     * El portal público pide la identificación como TEXTO LIBRE y nadie la
     * comprueba: cualquiera puede abrir una solicitud a nombre de otro. Y aquí
     * lo que está en juego es **entregar un expediente completo** — el error
     * opuesto al de la cancelación, pero del mismo tamaño.
     *
     * El candado no puede estar en el formulario. Está aquí: el médico afirma
     * que verificó, y esa afirmación queda en la bitácora con su nombre.
     */
    if (body.identidadVerificada !== true) {
      return NextResponse.json({
        ok: false,
        error: 'Antes de entregar hay que acreditar que quien pide es el titular. El formulario público no lo comprueba.',
      }, { status: 400 })
    }

    // El acuse: qué se entregó, exactamente.
    const paquete = JSON.stringify(expediente)
    const hash = createHash('sha256').update(paquete).digest('hex')
    const entregadoEn = new Date().toISOString()

    const clinicRef = adminDb.collection('clinics').doc(clinicId)

    /**
     * CERRAR LA SOLICITUD con lo que REALMENTE se entregó.
     *
     * Si no se cierra, el plazo de 20 días sigue corriendo sobre algo ya
     * resuelto — que es lo que pasaba con la cancelación antes de repararlo.
     */
    if (solicitudId) {
      await clinicRef.collection('arco_requests').doc(solicitudId).set({
        estado: 'resuelta',
        fechaResolucion: entregadoEn,
        resueltoPor: acceso.uid ?? '',
        resolucion: `Acceso ejecutado: se entregó el expediente completo (${Object.entries(conteo).map(([k, n]) => `${k}: ${n}`).join(', ')}).`
          + (expediente.faltantes.length ? ` Secciones no legibles: ${expediente.faltantes.map(f => f.seccion).join(', ')}.` : ''),
        paqueteHash: hash,
        paqueteFormato: expediente.formato,
        entregadoEn,
      }, { merge: true }).catch(() => { /* no puede tumbar el derecho del titular */ })
    }

    await clinicRef.collection('audit_log').add({
      evento: 'arco_solicitud_resuelta', clinicId, patientId,
      medicoUid: acceso.uid, medicoEmail: acceso.email ?? '',
      meta: {
        accion: 'acceso', solicitudId,
        paqueteHash: hash, formato: expediente.formato,
        secciones: Object.keys(conteo).length,
        faltantes: expediente.faltantes.length,
        identidadVerificadaPor: acceso.uid,
      },
      timestamp: entregadoEn,
    }).catch(() => { /* la bitácora no puede tumbar el derecho del titular */ })

    return NextResponse.json({
      ok: true, expediente, paqueteHash: hash, entregadoEn, conteo,
      faltantes: expediente.faltantes,
    })
  } catch (e) {
    safeLog.error('[arco/acceso]', e)
    return NextResponse.json({ ok: false, error: 'No se pudo armar la entrega' }, { status: 500 })
  }
}
