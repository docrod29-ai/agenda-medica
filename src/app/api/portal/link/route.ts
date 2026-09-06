import { NextRequest, NextResponse } from 'next/server'
import { verificarMiembro } from '@/lib/auth-server'
import { verificarCapacidad } from '@/lib/authz/verificar'
import { adminDb } from '@/lib/firebase-admin'
import { linkPortalPaciente, type AlcanceToken } from '@/lib/patient-token'

/**
 * Genera el magic-link del Portal del Paciente para enviarlo (p. ej. por WhatsApp).
 * Requiere ser MIEMBRO de la clínica (médico/asistente). Devuelve { url }.
 */
export async function POST(req: NextRequest) {
  let body: { clinicId?: string; patientId?: string; alcance?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Petición inválida' }, { status: 400 })
  }
  if (!body.clinicId || !body.patientId) {
    return NextResponse.json({ error: 'Falta clinicId o patientId' }, { status: 400 })
  }

  /**
   * EL ALCANCE CLÍNICO SE PIDE, Y LO COBRA `firmar` — POSTVISIT-001.
   *
   * El enlace de mostrador (`agenda`) sigue siendo el de fábrica y lo emite
   * cualquier miembro: sirve para confirmar, cancelar y reagendar. Pero el
   * paquete de la visita y las recetas viven detrás del alcance `clinico`, y
   * hasta hoy la ÚNICA ruta que emitía uno era la de la teleconsulta — o sea que
   * el médico no tenía forma de darle a su paciente el enlace que abre lo que
   * acaba de liberarle. `POSTVISIT-ENTREGA-001` en su forma más literal: la
   * puerta existía y no había llave.
   *
   * Se pide EXPLÍCITAMENTE y se cobra con `firmar`, no con membresía: un enlace
   * clínico es una credencial con secreto médico dentro, y quien la emite tiene
   * que ser quien puede responder por ese contenido. La asistente sigue pudiendo
   * mandar el de la agenda; el del expediente lo emite el médico.
   */
  const pideClinico = String(body.alcance ?? '') === 'clinico'
  const acc = pideClinico
    ? await verificarCapacidad(req, body.clinicId, 'firmar')
    : await verificarMiembro(req, body.clinicId)
  if (!acc.ok) return acc.response
  const alcance: AlcanceToken = pideClinico ? 'clinico' : 'agenda'

  // Origen real desde el navegador del personal (la URL que el médico está usando)
  const origin = req.headers.get('origin') || req.nextUrl.origin
  /**
   * E0-06 — alcance `agenda`, EXPLÍCITO.
   *
   * Esta ruta la puede llamar cualquier miembro (incluida la asistente), y devuelve
   * el token al navegador de quien la llama. Con alcance clínico eso era una
   * credencial de 30 días con secreto médico en manos de un rol que firestore.rules
   * mantiene fuera del expediente: el mismo bypass que ya se cerró en
   * /api/telesalud/token. El enlace sigue sirviendo para lo que se usa —confirmar,
   * cancelar y reagendar citas—; los documentos clínicos exigen un enlace emitido
   * por un médico.
   */
  /**
   * El enlace nace con la VERSIÓN vigente del paciente. Cuando alguien revoca,
   * ese contador sube y todos los enlaces emitidos antes dejan de servir de
   * golpe — que es justo lo que no se podía hacer.
   */
  let version = 0
  try {
    const snap = await adminDb.collection('clinics').doc(body.clinicId)
      .collection('patients').doc(body.patientId).get()
    version = Number((snap.data() as { portalTokenVersion?: number } | undefined)?.portalTokenVersion ?? 0)
  } catch { /* sin versión conocida se emite la 0: el enlace sirve, y una revocación posterior lo corta igual */ }

  /**
   * ── PC-004 · UN ENLACE CLÍNICO SIN TELÉFONO ES UNA PROMESA VACÍA ──────────
   *
   * El enlace de alcance clínico abre «Preguntar». Ahí el portal le dice al
   * paciente que su consultorio va a ver lo que escriba y que, si no puede
   * esperar, llame — y en un consultorio sin `whatsappConsultorio` ni
   * `telefonoAdmin` cargados, «llámales» no lleva a ningún sitio: la escalación
   * tampoco avisa por WhatsApp a nadie, y el paciente lee «Tu consultorio no
   * dejó aquí un teléfono» a las dos de la mañana.
   *
   * Es la recomendación del dueño en PL-P7: exigir teléfono al liberar el
   * alcance clínico. Se comprueba al EMITIR, que es el único momento en que
   * alguien del consultorio está delante y puede arreglarlo.
   *
   * El enlace de agenda no lo exige: ése sirve para confirmar y mover citas, y
   * no promete que nadie conteste nada.
   */
  if (pideClinico) {
    let telefono = ''
    try {
      const cfg = await adminDb.collection('clinics').doc(body.clinicId)
        .collection('config').doc('main').get()
      const c = cfg.data() as { whatsappConsultorio?: string; telefonoAdmin?: string } | undefined
      telefono = String(c?.whatsappConsultorio || c?.telefonoAdmin || '').trim()
    } catch {
      /* No poder comprobarlo no es permiso: cae al mismo sitio que no tenerlo.
         Es el criterio de la revocación del portal, dicho aquí. */
    }
    if (!telefono) {
      return NextResponse.json({
        error: 'Antes de mandar este enlace, carga el teléfono del consultorio en Configuración. '
          + 'Con él, el paciente puede preguntar por el portal y llamar si no puede esperar; sin él, '
          + 'la pantalla le dice que llame y no tiene a dónde.',
      }, { status: 409 })
    }
  }

  const url = linkPortalPaciente(origin, body.clinicId, body.patientId, undefined, alcance, version)
  return NextResponse.json({ url, alcance })
}
