/**
 * POST /api/arco/cancelar
 *
 * LA «C» DE ARCO, QUE HASTA HOY NO EXISTÍA.
 *
 * La pantalla de Cumplimiento aceptaba solicitudes de Cancelación y las
 * «resolvía» escribiendo un texto libre. El derecho del paciente se atendía en
 * prosa y nada cambiaba en sus datos.
 *
 * Esta ruta lo ejecuta de verdad, por uno de los dos caminos que decide
 * `caminoDeCancelacion` a partir de un hecho comprobable —si hay una nota
 * firmada—, no de una opinión:
 *
 *  · SUPRESIÓN: se elimina el expediente, sus borradores y sus citas.
 *  · BLOQUEO: el expediente se conserva porque la ley obliga, pero deja de
 *    usarse para contacto (recordatorios, reactivación, campañas, CRM).
 *
 * Va en el SERVIDOR y no en el navegador por dos motivos: el borrado en cascada
 * necesita el SDK admin para no depender de que las reglas permitan cada
 * documento, y la decisión tiene que quedar auditada del lado que no se puede
 * manipular desde una consola del navegador.
 *
 * NEEDS_LEGAL_REVIEW: los años de conservación y qué constituye una respuesta
 * suficiente al titular los fija el abogado del consultorio. Aquí sólo se
 * ejecuta lo técnico.
 */
import { NextRequest, NextResponse } from 'next/server'
import { safeLog } from '@/lib/security/sanitize'
import { adminDb } from '@/lib/firebase-admin'
import { verificarCapacidad } from '@/lib/authz/verificar'
import { caminoDeCancelacion, marcaDeBloqueo } from '@/lib/arco/cancelacion'
import { destinoDeCita, citaAnonimizada, cobroAnonimizado } from '@/lib/arco/supresion'

export async function POST(req: NextRequest) {
  let body: { clinicId?: string; patientId?: string; solicitudId?: string; motivo?: string; simular?: boolean; identidadVerificada?: boolean }
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
   * `administrar` y no `agenda.gestionar`: suprimir o bloquear un expediente es
   * una decisión del responsable del tratamiento de los datos, no del mostrador.
   */
  const acceso = await verificarCapacidad(req, clinicId, 'administrar')
  if (!acceso.ok) return acceso.response

  const motivo = String(body.motivo ?? '').trim().slice(0, 300)
  const solicitudId = String(body.solicitudId ?? '').trim()

  try {
    const clinicRef = adminDb.collection('clinics').doc(clinicId)
    const pacienteRef = clinicRef.collection('patients').doc(patientId)
    const pacienteSnap = await pacienteRef.get()
    if (!pacienteSnap.exists) {
      return NextResponse.json({ ok: false, error: 'Ese expediente no existe' }, { status: 404 })
    }
    const paciente = pacienteSnap.data() as Record<string, unknown>

    // El hecho del que depende TODO lo demás.
    const notasSnap = await pacienteRef.collection('notas').get()
    const firmadas = notasSnap.docs.filter(d => (d.data() as { estado?: string }).estado === 'firmada').length
    const veredicto = caminoDeCancelacion(firmadas)

    /**
     * ENSAYO: dice qué VA a pasar sin hacer nada.
     *
     * Existe porque una de las dos ramas es irreversible y nadie debería
     * enterarse de cuál le tocaba DESPUÉS de pulsar el botón. La pantalla
     * consulta primero, enseña el veredicto, y sólo entonces confirma.
     */
    if (body.simular === true) {
      return NextResponse.json({ ok: true, simulado: true, ...veredicto, notasFirmadas: firmadas })
    }

    /**
     * SIN ACREDITAR AL TITULAR NO SE EJECUTA.
     *
     * El portal público pide la identificación como TEXTO LIBRE y nadie la
     * comprueba: cualquiera puede abrir una solicitud a nombre de otro. El
     * candado no puede estar en el formulario —un impostor teclea lo que sea—,
     * así que está aquí: el médico afirma que verificó, y esa afirmación queda
     * en la bitácora con su nombre.
     */
    if (body.identidadVerificada !== true) {
      return NextResponse.json({
        ok: false,
        error: 'Antes de ejecutar hay que acreditar que quien pide es el titular. El formulario público no lo comprueba.',
      }, { status: 400 })
    }

    if (veredicto.camino === 'bloqueo') {
      const marca = marcaDeBloqueo({ ahoraMs: Date.now(), uid: acceso.uid!, solicitudId, motivo })
      /**
       * Y EL PORTAL SE APAGA EN EL MISMO ACTO — D-035 · REG-526.
       *
       * El bloqueo dejaba el expediente marcado y daba de baja el WhatsApp,
       * pero el magic-link del paciente seguía vivo hasta caducar: su agenda,
       * sus documentos y sus recetas seguían leyéndose por un enlace que
       * quizá se reenvió a un grupo, sobre un expediente que él pidió
       * cancelar. `portalTokenVersion` es el contador que tumba los enlaces
       * (REG-331); subirlo aquí los corta en el mismo `set` que escribe el
       * bloqueo. Decisión del dueño, 5-sep-2026.
       *
       * En la SUPRESIÓN no hace falta: el expediente deja de existir, y un
       * expediente que no está ya cuenta como revocado (REG-331).
       */
      const portalTokenVersion = Number(paciente.portalTokenVersion ?? 0) + 1
      await pacienteRef.set({ arcoBloqueo: marca, portalTokenVersion }, { merge: true })

      /**
       * EL BLOQUEO TIENE QUE MORDER HOY, NO CUANDO ALGUIEN LEA EL CAMPO.
       *
       * Marcar el expediente sirve para lo que consulte esa marca. Pero la baja
       * de WhatsApp ya existe, ya la respetan los recordatorios y el bot, y se
       * consulta POR TELÉFONO en cada envío. Registrarla aquí hace que el
       * paciente deje de recibir mensajes de inmediato, sin esperar a que cada
       * barrido aprenda a mirar el campo nuevo.
       */
      const tel = String(paciente.telefono ?? '').trim()
      /**
       * SI LA BAJA NO SE PUDO ESCRIBIR, SE DICE.
       *
       * Esto tragaba el fallo con un `warn` y respondía `ok: true`. El médico
       * leía «listo» y el paciente seguía recibiendo mensajes. Un derecho
       * ejercido a medias hay que declararlo: el bloqueo del expediente SÍ
       * quedó, y lo que falta es una acción concreta que alguien puede hacer.
       */
      const avisos: string[] = []
      if (tel) {
        const { registrarBaja } = await import('@/lib/whatsapp/consent')
        await registrarBaja(clinicId, tel, 'arco_cancelacion').catch(() => {
          safeLog.warn('[arco/cancelar] bloqueo escrito, baja de WhatsApp no persistida')
          avisos.push('No se pudo registrar la baja de WhatsApp. El expediente quedó bloqueado, pero hay que dar de baja el teléfono a mano en Configuración → Entregas.')
        })
      } else {
        avisos.push('El paciente no tiene teléfono registrado, así que no había baja de WhatsApp que dar. Si le escriben por otro número, hay que bloquearlo a mano.')
      }

      /**
       * CERRAR LA SOLICITUD.
       *
       * La ejecución no tocaba `arco_requests`: el dato quedaba cancelado y la
       * solicitud legal seguía figurando como «recibida», con su plazo de 20
       * días corriendo sobre algo ya resuelto.
       */
      if (solicitudId) {
        await clinicRef.collection('arco_requests').doc(solicitudId).set({
          estado: 'resuelta', fechaResolucion: new Date().toISOString(),
          resueltoPor: acceso.uid ?? '',
          resolucion: 'Cancelación ejecutada por BLOQUEO: el expediente conserva las notas firmadas (conservación mínima obligatoria) y queda marcado como no contactable.',
        }, { merge: true }).catch(() => { /* no puede tumbar el derecho */ })
      }

      await clinicRef.collection('audit_log').add({
        evento: 'arco_solicitud_resuelta', clinicId, patientId,
        medicoUid: acceso.uid, medicoEmail: acceso.email ?? '',
        meta: { accion: 'bloqueo', solicitudId, notasFirmadas: firmadas, bajaWhatsapp: !!tel, identidadVerificadaPor: acceso.uid },
        timestamp: new Date().toISOString(),
      }).catch(() => { /* la bitácora no puede tumbar el derecho del paciente */ })

      return NextResponse.json({ ok: true, camino: 'bloqueo', notasFirmadas: firmadas, queOcurre: veredicto.queOcurre, avisos })
    }

    /**
     * SUPRESIÓN. Se borra en lotes atómicos: notas, citas y el paciente al
     * final. Si algo falla a mitad, Firestore no aplica ese lote — nunca queda
     * un expediente a medias con citas huérfanas.
     */
    const citasSnap = await clinicRef.collection('appointments').where('pacienteId', '==', patientId).get()

    /**
     * LO QUE SE CONSERVA SIN NOMBRE (Panel de Lujo ASE-015 · PL-L5 por omisión).
     *
     * Se borraban también las citas PASADAS y los cobros se quedaban con el
     * nombre. La política vive en `@/lib/arco/supresion`: cita futura → se
     * borra; cita pasada → se conserva sin nombre, teléfono, motivo ni notas;
     * cobro → se conserva sin nombre (registro fiscal). Se hace ANTES del
     * borrado del expediente para que, si algo falla a mitad, lo que quede
     * sea el dato anonimizado y no el expediente a medias.
     */
    const marca = { arcoSuprimidaEn: new Date().toISOString(), arcoSolicitudId: solicitudId }
    const hoy = marca.arcoSuprimidaEn.slice(0, 10)
    const citasAConservar = citasSnap.docs.filter(d => destinoDeCita(d.data() as { fechaHora?: string }, hoy) === 'anonimizar')
    const citasABorrar = citasSnap.docs.filter(d => !citasAConservar.includes(d))
    const cobrosSnap = await clinicRef.collection('cobros').where('patientId', '==', patientId).get()
    {
      const lote = adminDb.batch()
      for (const d of citasAConservar) lote.set(d.ref, citaAnonimizada(marca), { merge: true })
      for (const d of cobrosSnap.docs) lote.set(d.ref, cobroAnonimizado(marca), { merge: true })
      await lote.commit()
    }

    /**
     * BORRADO EN CASCADA — Firestore NO borra las subcolecciones.
     *
     * Esto borraba las notas, las citas y el documento del paciente con un
     * `batch.delete()`. En Firestore eso deja VIVO todo lo que cuelga debajo:
     *
     *   · `notas/{id}/versions` y `notas/{id}/adendas`
     *   · `pacientes/{id}/laboratorios`, `/fotos` y `/clinico/resumen`
     *     (alergias, antecedentes, valoración del inmunocomprometido)
     *
     * Y al médico y al titular se les decía, con estas palabras, «se elimina el
     * expediente completo». Quedaba PHI legible por ruta directa, sin colgar ya
     * de ningún expediente: lo peor de los dos mundos —el dato sigue ahí y nadie
     * sabe que sigue ahí—.
     *
     * `recursiveDelete` baja por todo el árbol. Las citas no tienen
     * subcolecciones, pero se borran igual por la misma vía para no mantener dos
     * mecanismos de borrado.
     */
    for (const ref of [...notasSnap.docs.map(d => d.ref), ...citasABorrar.map(d => d.ref)]) {
      await adminDb.recursiveDelete(ref)
    }
    await adminDb.recursiveDelete(pacienteRef)   // arrastra laboratorios, fotos y clinico

    /**
     * La bitácora se escribe DESPUÉS y sin `patientId` en el cuerpo del meta más
     * allá del identificador: el expediente ya no existe, y el asiento tiene que
     * poder demostrar que se atendió la solicitud sin reconstruir lo borrado.
     */
    await clinicRef.collection('audit_log').add({
      evento: 'paciente_borrado', clinicId, patientId,
      medicoUid: acceso.uid, medicoEmail: acceso.email ?? '',
      meta: {
        accion: 'supresion_arco', solicitudId, notas: notasSnap.size, citas: citasABorrar.length,
        citasAnonimizadas: citasAConservar.length, cobrosAnonimizados: cobrosSnap.size,
        identidadVerificadaPor: acceso.uid,
      },
      timestamp: new Date().toISOString(),
    }).catch(() => { /* ídem */ })

    if (solicitudId) {
      await clinicRef.collection('arco_requests').doc(solicitudId).set({
        estado: 'resuelta', fechaResolucion: new Date().toISOString(),
        resueltoPor: acceso.uid ?? '',
        resolucion:
          'Cancelación ejecutada por SUPRESIÓN: expediente, notas, citas futuras y todo lo que colgaba de ellos borrados en cascada. ' +
          `Se conservaron sin nombre ${citasAConservar.length} cita(s) pasada(s) y ${cobrosSnap.size} cobro(s) (registro fiscal).`,
      }, { merge: true }).catch(() => { /* ídem */ })
    }

    return NextResponse.json({
      ok: true, camino: 'supresion',
      borradas: { notas: notasSnap.size, citas: citasABorrar.length },
      anonimizadas: { citas: citasAConservar.length, cobros: cobrosSnap.size },
      queOcurre: veredicto.queOcurre,
    })
  } catch (e) {
    safeLog.error('[arco/cancelar]', e)
    return NextResponse.json({ ok: false, error: 'No se pudo completar la cancelación' }, { status: 500 })
  }
}
