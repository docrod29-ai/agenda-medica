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
import {
  SECCIONES, SECCIONES_POR_REFERENCIA, indiceDeSecciones,
  type ExpedienteExportado, type Faltante,
} from '@/lib/expediente/exportacion'

/** Es una lectura amplia: se le da aire, pero no los 300 s de una llamada de IA. */
export const maxDuration = 60

/**
 * Tope por colección.
 *
 * Un expediente real no lo alcanza; existe para que un dato corrupto —o un
 * paciente con miles de documentos por un error— no tumbe la exportación entera.
 * Si se alcanza, se DECLARA en `faltantes`: un recorte que nadie ve se lee como
 * «eso era todo».
 */
const TOPE = 2000

type Doc = Record<string, unknown>

const docs = (snap: FirebaseFirestore.QuerySnapshot): Doc[] =>
  snap.docs.map(d => ({ id: d.id, ...d.data() }))

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

  const faltantes: Faltante[] = []
  const anotar = (seccion: string, porQue: string) => { faltantes.push({ seccion, porQue }) }

  try {
    const clinicRef = adminDb.collection('clinics').doc(clinicId)
    const pacienteRef = clinicRef.collection('patients').doc(patientId)
    const pSnap = await pacienteRef.get()
    if (!pSnap.exists) return NextResponse.json({ error: 'Paciente no encontrado' }, { status: 404 })

    const secciones: Record<string, unknown> = {}

    // ── Lo que cuelga del paciente ────────────────────────────────────────
    for (const s of SECCIONES) {
      try {
        const snap = await pacienteRef.collection(s.ruta).limit(TOPE).get()
        const lista = docs(snap)
        if (snap.size >= TOPE) {
          anotar(s.clave, `Se alcanzó el tope de ${TOPE} documentos; hay más que no vienen en este archivo.`)
        }
        // Las sub-subcolecciones (adendas, versiones) van DENTRO de su nota: una
        // adenda suelta no dice a qué nota enmienda.
        for (const h of s.hijas ?? []) {
          for (const doc of lista) {
            try {
              const sub = await pacienteRef.collection(s.ruta).doc(String(doc.id))
                .collection(h.ruta).limit(TOPE).get()
              if (!sub.empty) doc[h.clave] = docs(sub)
            } catch {
              anotar(`${s.clave}.${h.clave}`, `No se pudo leer en la nota ${String(doc.id)}.`)
            }
          }
        }
        secciones[s.clave] = lista
      } catch (e) {
        // Se declara y se sigue: un expediente al 90 % que dice qué le falta es
        // útil; uno que revienta entero no le sirve a nadie.
        anotar(s.clave, 'No se pudo leer esta sección.')
        safeLog.warn(`[expediente/exportar] sección ${s.clave} ilegible`, e)
      }
    }

    // ── Lo que es suyo pero vive en colecciones de la clínica ─────────────
    for (const r of SECCIONES_POR_REFERENCIA) {
      try {
        const snap = await clinicRef.collection(r.coleccion)
          .where(r.campo, '==', patientId).limit(TOPE).get()
        const lista = docs(snap)
        if (snap.size >= TOPE) {
          anotar(r.clave, `Se alcanzó el tope de ${TOPE} documentos; hay más que no vienen en este archivo.`)
        }
        // Los signos vitales cuelgan del episodio: sin ellos, un internamiento es
        // una fecha de ingreso y poco más.
        if (r.clave === 'internamientos') {
          for (const ep of lista) {
            try {
              const signos = await clinicRef.collection('internamientos').doc(String(ep.id))
                .collection('signos').limit(TOPE).get()
              if (!signos.empty) ep.signos = docs(signos)
            } catch {
              anotar('internamientos.signos', `No se pudieron leer los del episodio ${String(ep.id)}.`)
            }
          }
        }
        secciones[r.clave] = lista
      } catch (e) {
        anotar(r.clave, 'No se pudo leer esta sección.')
        safeLog.warn(`[expediente/exportar] sección ${r.clave} ilegible`, e)
      }
    }

    /**
     * El asiento va DESPUÉS y desde el servidor.
     *
     * Antes lo escribía el navegador que ejecutaba la descarga — el mismo código
     * que podría saltárselo. Una salida masiva de PHI tiene que quedar
     * registrada del lado que el usuario no controla.
     */
    void clinicRef.collection('audit_log').add({
      evento: 'export_datos', clinicId, patientId,
      medicoUid: acc.uid, medicoEmail: acc.email ?? '',
      meta: {
        formato: 'nexusmed-expediente-1',
        secciones: Object.keys(secciones).length,
        faltantes: faltantes.length,
      },
      timestamp: new Date().toISOString(),
    }).catch(() => { /* la bitácora no puede impedir que el titular reciba lo suyo */ })

    const cuerpo: ExpedienteExportado = {
      formato: 'nexusmed-expediente-1',
      generadoEn: new Date().toISOString(),
      paciente: { id: pSnap.id, ...pSnap.data() },
      secciones,
      faltantes,
      indice: indiceDeSecciones(),
    }
    return NextResponse.json(cuerpo)
  } catch (err) {
    safeLog.error('[expediente/exportar] error:', err)
    return NextResponse.json({ error: 'No se pudo armar el expediente' }, { status: 500 })
  }
}
