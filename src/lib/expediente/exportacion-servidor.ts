/**
 * ARMAR EL EXPEDIENTE — una sola vez, para los dos que lo entregan.
 *
 * ── POR QUÉ VIVE AQUÍ Y NO DENTRO DE LA RUTA ─────────────────────────────────
 *
 * Lo entregan dos caminos: el botón «Expediente completo» del médico
 * (`api/expediente/exportar`) y la resolución de una solicitud **ARCO de
 * Acceso** (`api/arco/acceso`), que es un derecho del titular con plazo legal.
 *
 * Si cada uno lo armara por su cuenta, en tres meses uno de los dos entregaría
 * menos que el otro y nadie sabría cuál — que es exactamente lo que pasó con las
 * dos implementaciones FHIR divergentes de este repositorio, y con las cinco del
 * cálculo de huecos. La lista de QUÉ se entrega vive en
 * `lib/expediente/exportacion.ts`; el CÓMO se lee vive aquí.
 *
 * Requiere Admin SDK: sólo servidor.
 */
import { adminDb } from '@/lib/firebase-admin'
import { safeLog } from '@/lib/security/sanitize'
import {
  SECCIONES, SECCIONES_POR_REFERENCIA, indiceDeSecciones,
  type ExpedienteExportado, type Faltante,
} from '@/lib/expediente/exportacion'

/**
 * Tope por colección.
 *
 * Un expediente real no lo alcanza; existe para que un dato corrupto —o un
 * paciente con miles de documentos por un error— no tumbe la exportación entera.
 * Si se alcanza, se DECLARA en `faltantes`: un recorte que nadie ve se lee como
 * «eso era todo».
 */
export const TOPE = 2000

type Doc = Record<string, unknown>

const docs = (snap: FirebaseFirestore.QuerySnapshot): Doc[] =>
  snap.docs.map(d => ({ id: d.id, ...d.data() }))

/**
 * Lee TODO lo que la aplicación guarda de un paciente, siguiendo el manifiesto.
 *
 * @returns el expediente, o `null` si el paciente no existe.
 *
 * Nunca lanza por una sección ilegible: la anota en `faltantes` y sigue. Un
 * expediente al 90 % que dice qué le falta es útil; uno que revienta entero no
 * le sirve a nadie.
 */
export async function armarExpediente(
  clinicId: string, patientId: string,
): Promise<ExpedienteExportado | null> {
  const clinicRef = adminDb.collection('clinics').doc(clinicId)
  const pacienteRef = clinicRef.collection('patients').doc(patientId)
  const pSnap = await pacienteRef.get()
  if (!pSnap.exists) return null

  const faltantes: Faltante[] = []
  const anotar = (seccion: string, porQue: string) => { faltantes.push({ seccion, porQue }) }
  const secciones: Record<string, unknown> = {}

  // ── Lo que cuelga del paciente ──────────────────────────────────────────
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
      anotar(s.clave, 'No se pudo leer esta sección.')
      safeLog.warn(`[exportacion] sección ${s.clave} ilegible`, e)
    }
  }

  // ── Lo que es suyo pero vive en colecciones de la clínica ───────────────
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
      safeLog.warn(`[exportacion] sección ${r.clave} ilegible`, e)
    }
  }

  return {
    formato: 'nexusmed-expediente-1',
    generadoEn: new Date().toISOString(),
    paciente: { id: pSnap.id, ...pSnap.data() },
    secciones,
    faltantes,
    indice: indiceDeSecciones(),
  }
}

/** Cuántos documentos trae cada sección. Para el acuse y para el ensayo. */
export function conteoDeSecciones(exp: ExpedienteExportado): Record<string, number> {
  const out: Record<string, number> = {}
  for (const [clave, valor] of Object.entries(exp.secciones)) {
    out[clave] = Array.isArray(valor) ? valor.length : 0
  }
  return out
}
