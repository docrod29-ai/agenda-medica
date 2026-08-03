/**
 * GET /api/clinic/exportar?clinicId=…
 *
 * EL RESPALDO DEL CONSULTORIO, DEL LADO DEL SERVIDOR Y EN STREAMING.
 *
 * ── EL FALLO ─────────────────────────────────────────────────────────────────
 *
 * «Respaldo COMPLETO» hacía una lectura por paciente **en serie, en el
 * navegador**, con el médico esperando y sin forma de reanudar. Y bajaba
 * pacientes + notas: nada de adendas, laboratorios, fotografía clínica,
 * antecedentes, citas, cobros, configuración, bloqueos, farmacia,
 * internamientos ni bitácora.
 *
 * Un archivo llamado «respaldo» que no respalda es peor que no tenerlo: se
 * guarda, se duerme tranquilo, y el día que hace falta no está lo que se creía.
 *
 * ── POR QUÉ NDJSON Y NO UN JSON ──────────────────────────────────────────────
 *
 * Una línea por documento, con su ruta completa. Se escribe mientras se lee —sin
 * cargar el consultorio entero en memoria—, se reanuda por donde se quedó, y una
 * línea corrupta no invalida el archivo entero como sí haría un JSON gigante.
 *
 * ── LO QUE NO SE LLEVA ───────────────────────────────────────────────────────
 *
 * Las llaves de API del consultorio (`secretos/`). Un respaldo se descarga, se
 * manda por correo y se deja en un escritorio: meterlas ahí lo convertiría en
 * una filtración de credenciales. Se declaran como excluidas en la cabecera del
 * propio archivo, para que nadie descubra la ausencia el día malo.
 */
import { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { safeLog } from '@/lib/security/sanitize'
import { adminDb } from '@/lib/firebase-admin'
import { verificarCapacidad } from '@/lib/authz/verificar'
import { COLECCIONES, EXCLUIDAS, indiceRespaldo } from '@/lib/clinica/respaldo'

export const maxDuration = 300

/** Cuántos documentos se leen por página. Ni uno por vuelta, ni todos de golpe. */
const PAGINA = 300

export async function GET(req: NextRequest) {
  const clinicId = req.nextUrl.searchParams.get('clinicId')
  if (!clinicId) return NextResponse.json({ error: 'clinicId requerido' }, { status: 400 })

  /**
   * `administrar`: esto se lleva el consultorio entero —expedientes, cobros,
   * bitácora—. No es un acto clínico ni de mostrador; es una decisión del dueño.
   */
  const acc = await verificarCapacidad(req, clinicId, 'administrar')
  if (!acc.ok) return acc.response

  const clinicRef = adminDb.collection('clinics').doc(clinicId)
  const codificador = new TextEncoder()

  const flujo = new ReadableStream<Uint8Array>({
    async start(controlador) {
      const linea = (o: unknown) => controlador.enqueue(codificador.encode(JSON.stringify(o) + '\n'))
      let documentos = 0
      const problemas: string[] = []

      /**
       * La cabecera va PRIMERA y dice qué esperar, incluido lo que NO viene.
       *
       * Un respaldo del que no se sabe qué falta no sirve para decidir si
       * alcanza — y ésa es la única pregunta que importa el día que hace falta.
       */
      linea({
        _tipo: 'cabecera',
        formato: 'nexusmed-respaldo-1',
        clinicId,
        generadoEn: new Date().toISOString(),
        indice: indiceRespaldo(),
        excluidas: EXCLUIDAS,
      })

      /** Recorre una colección por páginas y escribe una línea por documento. */
      const volcar = async (
        ref: FirebaseFirestore.CollectionReference,
        rutaBase: string,
        coleccion: string,
      ): Promise<string[]> => {
        const ids: string[] = []
        let cursor: FirebaseFirestore.QueryDocumentSnapshot | undefined
        for (;;) {
          let q = ref.orderBy('__name__').limit(PAGINA)
          if (cursor) q = q.startAfter(cursor)
          const snap = await q.get()
          if (snap.empty) break
          for (const d of snap.docs) {
            ids.push(d.id)
            linea({ _ruta: `${rutaBase}/${d.id}`, _coleccion: coleccion, ...d.data() })
            documentos++
          }
          cursor = snap.docs[snap.docs.length - 1]
          if (snap.size < PAGINA) break
        }
        return ids
      }

      for (const c of COLECCIONES) {
        try {
          const ids = await volcar(clinicRef.collection(c.ruta), `clinics/${clinicId}/${c.ruta}`, c.ruta)
          for (const hija of c.hijas ?? []) {
            for (const id of ids) {
              try {
                await volcar(
                  clinicRef.collection(c.ruta).doc(id).collection(hija),
                  `clinics/${clinicId}/${c.ruta}/${id}/${hija}`,
                  `${c.ruta}.${hija}`,
                )
              } catch {
                problemas.push(`${c.ruta}/${id}/${hija}`)
              }
            }
          }
        } catch (e) {
          /**
           * Una colección ilegible se DECLARA y el respaldo sigue. Reventar
           * entero por una colección deja al médico sin nada; declararlo le
           * deja el resto y la lista de lo que le falta.
           */
          problemas.push(c.ruta)
          safeLog.warn(`[clinic/exportar] colección ${c.ruta} ilegible`, e)
        }
      }

      // El pie cierra el archivo: si no está, la descarga se cortó a la mitad.
      linea({ _tipo: 'pie', documentos, problemas, completo: problemas.length === 0 })

      void clinicRef.collection('audit_log').add({
        evento: 'export_datos', clinicId,
        medicoUid: acc.uid, medicoEmail: acc.email ?? '',
        meta: { formato: 'nexusmed-respaldo-1', documentos, problemas: problemas.length },
        timestamp: new Date().toISOString(),
      }).catch(() => { /* la bitácora no puede impedir que el dueño se lleve lo suyo */ })

      controlador.close()
    },
  })

  return new Response(flujo, {
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Content-Disposition': `attachment; filename="respaldo_nexusmed_${new Date().toISOString().slice(0, 10)}.ndjson"`,
      'Cache-Control': 'no-store',
    },
  })
}
