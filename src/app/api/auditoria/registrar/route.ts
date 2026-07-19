import { NextRequest, NextResponse } from 'next/server'
import admin, { adminDb } from '@/lib/firebase-admin'
import { verificarMiembro } from '@/lib/auth-server'

/**
 * Escritura SERVIDOR de la bitácora de auditoría.
 *
 * Por qué existe: la bitácora se escribía desde el navegador, con el reloj del
 * navegador, y la regla de Firestore la permitía con `create: if isMember` sin
 * validar un solo campo. Es decir, cualquier miembro del consultorio podía
 * insertar entradas con el correo y la fecha que quisiera, o atribuirle un acceso
 * a otro médico. Una bitácora que el auditado puede escribir a discreción no
 * acredita nada — y acreditar es justamente para lo que existe (NOM-024).
 *
 * Aquí la identidad y la hora YA NO las pone el cliente:
 *  - `medicoUid` y `medicoEmail` salen del ID-token verificado, no del cuerpo.
 *  - `timestamp` es `serverTimestamp()` de Firestore.
 *  - `clinicId` se comprueba contra la membresía real del solicitante.
 *
 * El cliente solo aporta QUÉ pasó (evento, paciente, nota, meta). Si miente en
 * eso, al menos queda registrado bajo su propia identidad y con la hora del
 * servidor.
 */
export const runtime = 'nodejs'

/** Eventos aceptados. Lista blanca: un evento inventado no entra a la bitácora. */
const EVENTOS = new Set([
  'ia_procesamiento', 'ia_campo_aprobado', 'ia_campo_rechazado',
  'nota_borrador_guardado', 'nota_firmada', 'nota_adenda', 'nota_borrada',
  'consentimiento_grabacion', 'expediente_lectura', 'nota_lectura', 'nota_impresion',
  'receta_generada', 'receta_descargada', 'orden_generada',
  'paciente_creado', 'paciente_modificado', 'paciente_borrado',
  'aviso_privacidad_aceptado', 'arco_solicitud_recibida', 'arco_solicitud_resuelta',
  'login_exitoso', 'login_fallido', 'export_datos',
  'hosp_ingreso', 'hosp_egreso', 'hosp_administracion', 'hosp_traslado', 'hosp_lab_resultado',
])

/** Recorta a texto corto: la bitácora no es sitio para volcar contenido clínico. */
function texto(v: unknown, max = 200): string | undefined {
  if (typeof v !== 'string' || !v) return undefined
  return v.slice(0, max)
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ ok: false, error: 'JSON inválido' }, { status: 400 }) }

  const clinicId = texto(body.clinicId, 128) ?? ''
  const acceso = await verificarMiembro(req, clinicId)
  if (!acceso.ok) return acceso.response

  const evento = texto(body.evento, 64) ?? ''
  if (!EVENTOS.has(evento)) {
    return NextResponse.json({ ok: false, error: 'Evento no reconocido' }, { status: 400 })
  }

  // `meta` es libre por diseño (contadores, ids), pero se acota para que no se
  // convierta en un vertedero de PHI ni en un vector de documentos enormes.
  let meta: Record<string, unknown> | undefined
  if (body.meta && typeof body.meta === 'object') {
    const recortada = JSON.stringify(body.meta).slice(0, 2000)
    try { meta = JSON.parse(recortada) } catch { meta = undefined }   // se truncó a medias → se descarta
  }

  try {
    await adminDb.collection('clinics').doc(clinicId).collection('audit_log').add({
      evento,
      clinicId,
      patientId: texto(body.patientId, 128) ?? null,
      notaId: texto(body.notaId, 128) ?? null,
      // Identidad tomada del token verificado, NUNCA del cuerpo de la petición.
      medicoUid: acceso.uid,
      medicoEmail: acceso.email ?? null,
      rol: acceso.role ?? null,
      contexto: {
        userAgent: texto(req.headers.get('user-agent'), 200) ?? null,
        // Cabecera que pone la propia plataforma; el cliente no la puede falsear.
        ip: texto(req.headers.get('x-forwarded-for'), 64) ?? null,
      },
      meta: meta ?? null,
      // Hora del SERVIDOR. Antes era `new Date()` del navegador.
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      // Se conserva la hora que reportó el cliente solo como dato comparativo:
      // una divergencia grande es en sí misma una señal.
      timestampCliente: texto(body.timestampCliente, 40) ?? null,
    })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message.slice(0, 160) : 'error al registrar' },
      { status: 502 },
    )
  }
}
