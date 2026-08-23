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
import { COLECCIONES, rama, type RamaRespaldo, lineaDeDocumento } from '@/lib/clinica/respaldo'
import { cabeceraV2, pieV2, FORMATO_V2 } from '@/lib/durability/manifiesto'
import { huellaDeEntrada, acumuladorDeConjunto } from '@/lib/durability/huellas'

export const maxDuration = 300

/** Cuántos documentos se leen por página. Ni uno por vuelta, ni todos de golpe. */
const PAGINA = 300

/**
 * Versión del ÁRBOL de colecciones con el que se generó el archivo.
 *
 * Sube cuando cambia la forma del árbol (una rama nueva, una que se va). Sirve
 * para que quien restaure sepa si el archivo trae ramas que este build no
 * conoce, o al revés — hoy eso se descubre por «colección desconocida», una
 * línea rechazada a la vez.
 */
const ESQUEMA = 1

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
       * ── EL PIE TIENE QUE PODER DESMENTIRSE (#312) ─────────────────────────
       *
       * Antes el pie decía `documentos` y `completo`, y `completo` se calculaba
       * de UNA sola cosa: que ninguna colección hubiera lanzado una excepción.
       * Eso deja pasar el fallo caro, que no lanza nada — una rama que nadie
       * declaró se exporta de menos, no falla nada, y el archivo se certifica
       * completo. Es literalmente lo que pasó con `notas/{n}/adendas`.
       *
       * Con el recuento POR COLECCIÓN y la huella del conjunto, quien restaura
       * puede comparar lo que llegó con lo que debía llegar en vez de creerse
       * un booleano.
       */
      const conteos: Record<string, number> = {}
      const conjunto = acumuladorDeConjunto()

      /**
       * La cabecera va PRIMERA y dice qué esperar, incluido lo que NO viene.
       *
       * Un respaldo del que no se sabe qué falta no sirve para decidir si
       * alcanza — y ésa es la única pregunta que importa el día que hace falta.
       */
      linea(cabeceraV2(clinicId, new Date().toISOString(), ESQUEMA))

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
            const l = lineaDeDocumento(rutaBase, coleccion, d.id, d.data())
            linea(l)
            documentos++
            conteos[coleccion] = (conteos[coleccion] ?? 0) + 1
            /**
             * La huella se acumula SUMANDO, no guardando la lista: el respaldo
             * existe para no cargar el consultorio entero en memoria, y una
             * huella que exigiera tener las cien mil a la vez lo contradiría.
             */
            conjunto.añadir(await huellaDeEntrada(l._ruta, l as Record<string, unknown>))
          }
          cursor = snap.docs[snap.docs.length - 1]
          if (snap.size < PAGINA) break
        }
        return ids
      }

      /**
       * Baja por TODAS las ramas, no sólo un nivel.
       *
       * Las adendas y el versionado de una nota viven dos niveles abajo
       * (`patients/{p}/notas/{n}/adendas/{a}`), y con un solo nivel nunca
       * entraban al archivo — mientras el pie decía `completo: true`. La adenda
       * es el único mecanismo de corrección sobre una nota firmada e inmutable:
       * restaurar sin ella devuelve la nota y borra la corrección legal.
       */
      const bajar = async (
        padre: FirebaseFirestore.CollectionReference,
        rutaPadre: string,
        etiquetaPadre: string,
        hijas: (string | RamaRespaldo)[] | undefined,
      ): Promise<void> => {
        const ids = await volcar(padre, rutaPadre, etiquetaPadre)
        for (const h of hijas ?? []) {
          const r = rama(h)
          for (const id of ids) {
            try {
              await bajar(
                padre.doc(id).collection(r.ruta),
                `${rutaPadre}/${id}/${r.ruta}`,
                `${etiquetaPadre}.${r.ruta}`,
                r.hijas,
              )
            } catch {
              problemas.push(`${rutaPadre}/${id}/${r.ruta}`)
            }
          }
        }
      }

      for (const c of COLECCIONES) {
        try {
          await bajar(clinicRef.collection(c.ruta), `clinics/${clinicId}/${c.ruta}`, c.ruta, c.hijas)
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
      linea(pieV2(documentos, conteos, conjunto.valor(), problemas))

      void clinicRef.collection('audit_log').add({
        evento: 'export_datos', clinicId,
        medicoUid: acc.uid, medicoEmail: acc.email ?? '',
        meta: { formato: FORMATO_V2, documentos, problemas: problemas.length },
        timestamp: new Date().toISOString(),
      }).catch(() => { /* la bitácora no puede impedir que el dueño se lleve lo suyo */ })

      controlador.close()
    },
  })

  return new Response(flujo, {
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Content-Disposition': `attachment; filename="respaldo_ausculta_${new Date().toISOString().slice(0, 10)}.ndjson"`,
      'Cache-Control': 'no-store',
    },
  })
}
