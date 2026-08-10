/**
 * GET /api/calendar/ocupado?clinicId=…&fecha=YYYY-MM-DD
 *
 * Lo que el médico YA tiene en su Google Calendar ese día, como bloqueos que el
 * motor de huecos entiende.
 *
 * ── POR QUÉ EXISTE ───────────────────────────────────────────────────────────
 *
 * La integración con Google era de una sola dirección: Ausculta empujaba sus
 * citas y nada volvía. El médico se ponía una cirugía el jueves de 8 a 12 en
 * Google y la agenda seguía ofreciendo esas horas; el choque se descubría el
 * jueves.
 *
 * ── LO QUE DEVUELVE, Y LO QUE DECLARA ────────────────────────────────────────
 *
 * `conectado: false` cuando este usuario no ha vinculado Google — no es un
 * error, es la mayoría de los casos. `ok: false` cuando SÍ está vinculado y la
 * consulta falló: eso hay que decirlo, porque «no pude preguntar» y «no tiene
 * nada» producen la misma lista vacía y sólo uno de los dos significa que las
 * horas están libres.
 *
 * El token de Google es PERSONAL (`googleTokens/{uid}`), así que sólo se
 * consulta la agenda de quien está pidiendo, y los bloqueos salen marcados con
 * su `medicoId`: la agenda ajena de uno no puede cerrar la de los demás.
 */
import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'
import { verificarCapacidad } from '@/lib/authz/verificar'
import { intervalosOcupados } from '@/lib/google-calendar'
import { comoBloqueos } from '@/lib/calendario/ocupado-externo'
import { instanteMX } from '@/lib/timezone'
import { safeLog } from '@/lib/security/sanitize'
import type { ClinicConfig } from '@/types'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const clinicId = req.nextUrl.searchParams.get('clinicId') ?? ''
  const fecha = req.nextUrl.searchParams.get('fecha') ?? ''
  if (!clinicId || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    return NextResponse.json({ ok: false, error: 'Falta clinicId o fecha' }, { status: 400 })
  }

  // `agenda.gestionar` y no «cualquier miembro»: esto se pide desde la pantalla
  // que agenda, y quien no puede agendar no necesita saber cuándo está ocupado
  // el médico.
  const acc = await verificarCapacidad(req, clinicId, 'agenda.gestionar')
  if (!acc.ok) return acc.response
  const uid = acc.uid

  try {
    const tokenDoc = await adminDb.collection('googleTokens').doc(uid).get()
    if (!tokenDoc.exists) {
      return NextResponse.json({ ok: true, conectado: false, bloqueos: [] })
    }
    const { refreshToken } = tokenDoc.data() as { refreshToken?: string }
    if (!refreshToken) return NextResponse.json({ ok: true, conectado: false, bloqueos: [] })

    const cfgSnap = await adminDb.collection('clinics').doc(clinicId).collection('config').doc('main').get()
    const cfg = (cfgSnap.exists ? cfgSnap.data() : {}) as ClinicConfig
    const tz = cfg.zonaHoraria || 'America/Mexico_City'

    // El día COMPLETO en la zona del consultorio. Pedirlo en UTC traería el día
    // corrido seis horas y ocultaría la mañana o la noche según el huso.
    const desde = instanteMX(fecha, '00:00', tz).toISOString()
    const hasta = instanteMX(fecha, '23:59', tz).toISOString()

    const r = await intervalosOcupados(refreshToken, cfg.googleCalendarId || 'primary', desde, hasta)
    if (!r.ok) {
      return NextResponse.json({
        ok: false, conectado: true, bloqueos: [],
        error: 'No se pudo consultar tu Google Calendar. Los huecos de abajo NO tienen en cuenta lo que ya tengas ahí.',
      })
    }
    return NextResponse.json({ ok: true, conectado: true, bloqueos: comoBloqueos(r.intervalos, uid) })
  } catch (e) {
    safeLog.error('[calendar/ocupado]', e)
    return NextResponse.json({ ok: false, conectado: true, bloqueos: [], error: 'No se pudo consultar Google Calendar.' })
  }
}
