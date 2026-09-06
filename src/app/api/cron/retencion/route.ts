/**
 * GET /api/cron/retencion
 *
 * EL BARRENDERO QUE NO EXISTÍA.
 *
 * ── EL FALLO ─────────────────────────────────────────────────────────────────
 *
 * Había dos crons y **ninguno borraba nada de Firestore** —`limpiar-audio` toca
 * únicamente Cloud Storage—. Mientras tanto `rate_limits` escribe un documento
 * por petición limitada, con un `exp` que su propio código guardaba «para poder
 * purgar con TTL de Firestore **si algún día se activa**». No se activó nunca.
 *
 * Nada de eso rompe hoy. Todo eso rompe con cien consultorios, y por la vía más
 * cara: la factura y el rendimiento de las consultas.
 *
 * ── LO QUE NO TOCA ───────────────────────────────────────────────────────────
 *
 * **Nada del expediente.** El manifiesto sólo enumera colecciones de
 * plataforma, y un guardián comprueba que ninguna sea del consultorio. Cuánto se
 * conserva un expediente lo fija la NOM-004 y el abogado, no un cron.
 */
import { NextRequest, NextResponse } from 'next/server'
import { safeLog } from '@/lib/security/sanitize'
import { adminDb } from '@/lib/firebase-admin'
import { REGLAS, caducado } from '@/lib/ops/retencion'
import { registrarLatido } from '@/lib/ops/latido'
import { correlacionDeTrabajo } from '@/lib/observabilidad/correlacion'

const CRON_SECRET = process.env.CRON_SECRET

export const maxDuration = 300

/** Documentos por página de lectura. */
const PAGINA = 400
/**
 * Tope de borrados por colección y pasada.
 *
 * El cron es diario: si una colección tiene más rezago del que cabe, se declara
 * `hayMas` y se drena en las siguientes. Vaciarlo todo de golpe en la primera
 * ejecución sería la forma más rápida de agotar el tiempo a mitad de camino.
 */
const TOPE = 5000

export async function GET(req: NextRequest) {
  /* REG-566 — la traza de ESTA ejecución, acuñada al arrancar: un trabajo de
     fondo no nace de un navegador, así que no acepta la que le manden. */
  const correlacion = correlacionDeTrabajo()
  const auth = req.headers.get('authorization')
  // Mismo candado fail-closed que los otros crons: un endpoint que BORRA no
  // puede quedar abierto.
  if (!CRON_SECRET) {
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json({ error: 'CRON_SECRET no configurado (fail-closed)' }, { status: 503 })
    }
  } else if (auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const arranque = Date.now()
  const informe: Record<string, { borrados: number; conservados: number; hayMas: boolean; error?: string }> = {}

  try {
    for (const regla of REGLAS) {
      let borrados = 0
      let conservados = 0
      let hayMas = false
      try {
        let cursor: FirebaseFirestore.QueryDocumentSnapshot | undefined
        recorrido: for (;;) {
          let q = adminDb.collection(regla.coleccion).orderBy('__name__').limit(PAGINA)
          if (cursor) q = q.startAfter(cursor)
          const snap = await q.get()
          if (snap.empty) break

          /**
           * Se pagina por `__name__` y se filtra en memoria en vez de consultar
           * por el campo de fecha: un `where` sobre `exp` o `fecha` exigiría un
           * índice creado a mano, y mientras no exista la consulta falla ENTERA
           * y no se borra nada. Un barrendero que no barre porque falta un
           * índice es un barrendero que nadie echa de menos.
           */
          let lote = adminDb.batch()
          let enLote = 0
          for (const d of snap.docs) {
            const v = caducado(regla, d.get(regla.campo), arranque)
            if (!v.borrar) { conservados++; continue }
            lote.delete(d.ref)
            enLote++
            borrados++
            if (enLote >= 400) { await lote.commit(); lote = adminDb.batch(); enLote = 0 }
            if (borrados >= TOPE) {
              if (enLote > 0) await lote.commit()
              hayMas = true
              break recorrido
            }
          }
          if (enLote > 0) await lote.commit()

          cursor = snap.docs[snap.docs.length - 1]
          if (snap.size < PAGINA) break
        }
      } catch (e) {
        /**
         * Una colección que falla se DECLARA y el barrido sigue con las demás.
         * Reventar entero por una deja las otras creciendo, y el informe diría
         * «error» sin decir qué se hizo bien.
         */
        informe[regla.coleccion] = { borrados, conservados, hayMas, error: 'no se pudo barrer' }
        safeLog.warn(`[cron/retencion] ${regla.coleccion} falló`, e)
        continue
      }
      informe[regla.coleccion] = { borrados, conservados, hayMas }
    }

    const conRezago = Object.entries(informe).filter(([, r]) => r.hayMas).map(([c]) => c)
    if (conRezago.length) {
      safeLog.info(`[cron/retencion] queda rezago en: ${conRezago.join(', ')} (se drena mañana)`)
    }

    await registrarLatido('retencion', {
      correlacion,
      ok: true, duracionMs: Date.now() - arranque,
      detalle: {
        borrados: Object.values(informe).reduce((a, r) => a + r.borrados, 0),
        colecciones: Object.keys(informe).length,
        conRezago: conRezago.length,
      },
    })
    return NextResponse.json({ ok: true, informe, conRezago })
  } catch (e) {
    safeLog.error('[cron/retencion]', e)
    await registrarLatido('retencion', {
      correlacion,
      ok: false, duracionMs: Date.now() - arranque,
      error: e instanceof Error ? e.message : 'error',
    })
    return NextResponse.json({ ok: false, error: 'No se pudo barrer' }, { status: 500 })
  }
}
