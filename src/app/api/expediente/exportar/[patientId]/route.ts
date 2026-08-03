/**
 * GET /api/expediente/exportar/[patientId]?clinicId=…
 *
 * EL EXPEDIENTE COMPLETO. TODO. Y LO QUE FALTE, DICHO.
 *
 * ── POR QUÉ EXISTE ───────────────────────────────────────────────────────────
 *
 * El botón de exportación del expediente descargaba un archivo llamado
 * `expediente_<nombre>_FHIR_R4.json` que contenía el paciente y **sólo las notas
 * firmadas**. Fuera quedaban las adendas —que son parte legal del expediente—,
 * los laboratorios, la fotografía clínica, los antecedentes estructurados, los
 * formularios previos, los internamientos y la bitácora de accesos. Todo eso lo
 * escribe la propia aplicación y está declarado en `firestore.rules`.
 *
 * Y las notas en borrador se descartaban **en silencio**: si había contenido
 * clínico sin firmar, el titular recibía un expediente con huecos que nadie le
 * señalaba.
 *
 * ── POR QUÉ EN EL SERVIDOR ───────────────────────────────────────────────────
 *
 * El armado vivía en el navegador: una lectura por colección, en serie, con el
 * médico esperando. Peor, el asiento de auditoría de una salida masiva de PHI lo
 * escribía **el mismo código que podría saltárselo** quien la ejecuta. Aquí el
 * asiento es del lado que no se puede manipular desde una consola del navegador.
 *
 * ── LO QUE NO HACE ───────────────────────────────────────────────────────────
 *
 * No empaqueta binarios. De las fotografías clínicas entrega la ficha y su
 * referencia, no el archivo: meter imágenes en un JSON lo haría impracticable, y
 * prometer un ZIP que no existe sería peor que declararlo.
 */
import { NextRequest, NextResponse } from 'next/server'
import { safeLog } from '@/lib/security/sanitize'
import { adminDb } from '@/lib/firebase-admin'
import { verificarCapacidad } from '@/lib/authz/verificar'
import { armarExpediente } from '@/lib/expediente/exportacion-servidor'

/** Es una lectura amplia: se le da aire, pero no los 300 s de una llamada de IA. */
export const maxDuration = 60

export async function GET(req: NextRequest, { params }: { params: Promise<{ patientId: string }> }) {
  const { patientId } = await params
  const clinicId = req.nextUrl.searchParams.get('clinicId')
  if (!clinicId || !patientId) {
    return NextResponse.json({ error: 'clinicId y patientId requeridos' }, { status: 400 })
  }

  /**
   * `clinico.escribir` y no `agenda.gestionar`: esto baja el expediente entero,
   * incluidos diagnósticos, medicamentos y alergias, que las reglas reservan al
   * médico por secreto profesional (NOM-004). Con el permiso de mostrador, una
   * cuenta de recepción se llevaría todo por aquí.
   */
  const acc = await verificarCapacidad(req, clinicId, 'clinico.escribir')
  if (!acc.ok) return acc.response

  try {
    const cuerpo = await armarExpediente(clinicId, patientId)
    if (!cuerpo) return NextResponse.json({ error: 'Paciente no encontrado' }, { status: 404 })

    /**
     * El asiento va DESPUÉS y desde el servidor.
     *
     * Antes lo escribía el navegador que ejecutaba la descarga — el mismo código
     * que podría saltárselo. Una salida masiva de PHI tiene que quedar
     * registrada del lado que el usuario no controla.
     */
    void adminDb.collection('clinics').doc(clinicId).collection('audit_log').add({
      evento: 'export_datos', clinicId, patientId,
      medicoUid: acc.uid, medicoEmail: acc.email ?? '',
      meta: {
        formato: 'nexusmed-expediente-1',
        secciones: Object.keys(cuerpo.secciones).length,
        faltantes: cuerpo.faltantes.length,
      },
      timestamp: new Date().toISOString(),
    }).catch(() => { /* la bitácora no puede impedir que el titular reciba lo suyo */ })

    return NextResponse.json(cuerpo)
  } catch (err) {
    safeLog.error('[expediente/exportar] error:', err)
    return NextResponse.json({ error: 'No se pudo armar el expediente' }, { status: 500 })
  }
}
