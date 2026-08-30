/**
 * GET /api/cron/limpiar-audio
 *
 * BARRE EL AUDIO DE CONSULTA QUE SE QUEDÓ EN STORAGE.
 *
 * ── POR QUÉ EXISTE ───────────────────────────────────────────────────────────
 *
 * Para diarizar una consulta larga, el audio —la conversación entera entre el
 * médico y el paciente, PHI en crudo— se sube a `consultas-audio/{uid}/…` y el
 * hook lo borra en un `finally`. Ese `finally` sólo corre **si el navegador
 * sigue vivo**, y la espera es de hasta seis minutos de sondeo: cerrar la
 * pestaña, perder la red o irse a otra pantalla dejaba el archivo ahí para
 * siempre.
 *
 * Y cuando el borrado fallaba, el código decía «lifecycle rule lo limpia». Una
 * regla de ciclo de vida es **configuración del bucket**, no código; nada en
 * este repositorio la declaraba y nadie la había creado. El patrón más caro de
 * todos: una regla escrita en un comentario que el código de al lado no cumple
 * — y la promesa incumplida era «no dejamos PHI».
 *
 * Esto no sustituye al borrado del hook, que sigue siendo lo primero y lo
 * inmediato: es la red debajo, del lado que no depende de una pestaña.
 *
 * ── LO QUE NO HACE ───────────────────────────────────────────────────────────
 *
 *  · No borra lo que no puede fechar. Borrar ante la duda puede llevarse el
 *    audio de una consulta que se está transcribiendo AHORA, y el médico vería
 *    su dictado fallar sin explicación. Esperar un ciclo no cuesta nada.
 *  · No toca ningún otro prefijo del bucket: la firma y el membrete del médico
 *    viven en `receta-diseno/` y no caducan.
 *  · No lee ni un byte del audio. Sólo el nombre y la fecha.
 */
import { NextRequest, NextResponse } from 'next/server'
import { safeLog } from '@/lib/security/sanitize'
import admin from '@/lib/firebase-admin'
import { PREFIJO_AUDIO, HORAS_DE_VIDA, veredicto } from '@/lib/expediente/audio-caduco'
import { registrarLatido } from '@/lib/ops/latido'
import { correlacionDeTrabajo } from '@/lib/observabilidad/correlacion'

const CRON_SECRET = process.env.CRON_SECRET
const BUCKET = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? ''

/** Tope por ejecución: el cron corre a diario y no debe agotar su tiempo. */
const TOPE_POR_PASADA = 500

export async function GET(req: NextRequest) {
  /* REG-418 — la traza de ESTA ejecución, acuñada al arrancar: un trabajo de
     fondo no nace de un navegador, así que no acepta la que le manden. */
  const correlacion = correlacionDeTrabajo()
  const auth = req.headers.get('authorization')
  // Mismo candado fail-closed que el cron de recordatorios: sin CRON_SECRET en
  // producción no corre, porque un endpoint que borra no puede quedar abierto.
  if (!CRON_SECRET) {
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json({ error: 'CRON_SECRET no configurado (fail-closed)' }, { status: 503 })
    }
  } else if (auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!BUCKET) {
    /**
     * Se DECLARA en vez de responder 200 con cero borrados.
     *
     * «0 archivos borrados» y «no pude mirar» se leen igual desde fuera, y sólo
     * uno de los dos significa que hay PHI esperando.
     */
    return NextResponse.json({
      ok: false,
      error: 'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET no configurado: el barrido no puede mirar el bucket.',
    }, { status: 503 })
  }

  const arranqueCron = Date.now()
  try {
    const bucket = admin.storage().bucket(BUCKET)
    const [objetos] = await bucket.getFiles({ prefix: PREFIJO_AUDIO, maxResults: TOPE_POR_PASADA })

    const ahora = Date.now()
    let borrados = 0
    let conservados = 0
    let fallos = 0

    for (const o of objetos) {
      const v = veredicto(
        { nombre: o.name, creadoEn: (o.metadata?.timeCreated as string | undefined) ?? null },
        ahora,
      )
      if (!v.borrar) { conservados++; continue }
      try {
        await o.delete()
        borrados++
      } catch (e) {
        fallos++
        // Sin el nombre del objeto: es `consultas-audio/{uid}/{clave}`, y la
        // clave de recuperación identifica una consulta.
        safeLog.warn('[cron/limpiar-audio] no se pudo borrar un objeto caducado', e)
      }
    }

    /**
     * Si se llenó la página, quedan más. Se dice, para que un bucket con retraso
     * acumulado no parezca vacío por haberse leído sólo la primera página.
     */
    const hayMas = objetos.length >= TOPE_POR_PASADA
    if (hayMas) {
      safeLog.info(`[cron/limpiar-audio] se alcanzó el tope de ${TOPE_POR_PASADA} por pasada; quedan objetos para el siguiente barrido.`)
    }

    // El latido, para que el vigilante sepa que este barrido sigue vivo: si
    // deja de correr, se acumula PHI sin que nadie se entere.
    await registrarLatido('limpiar-audio', {
      correlacion,
      ok: true, duracionMs: Date.now() - arranqueCron,
      detalle: { revisados: objetos.length, borrados, fallos, hayMas },
    })
    return NextResponse.json({
      ok: true, revisados: objetos.length, borrados, conservados, fallos, hayMas,
      horasDeVida: HORAS_DE_VIDA,
    })
  } catch (e) {
    safeLog.error('[cron/limpiar-audio]', e)
    await registrarLatido('limpiar-audio', {
      correlacion,
      ok: false, duracionMs: Date.now() - arranqueCron,
      error: e instanceof Error ? e.message : 'error',
    })
    return NextResponse.json({ ok: false, error: 'No se pudo barrer el audio temporal' }, { status: 500 })
  }
}
