/**
 * POST /api/telesalud/sala
 *
 * Crea o recupera una sala de video para una cita de teleconsulta.
 * Usa Daily.co (10,000 min/mes gratis · luego $0.004/min). El proveedor es
 * intercambiable: la respuesta { url, name } sirve para cualquiera.
 *
 * Body: { citaId, clinicId }
 * Devuelve: { ok, url, name, expiresAt }
 */
import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'

const DAILY_API_KEY = process.env.DAILY_API_KEY ?? ''
const DAILY_DOMAIN = process.env.DAILY_DOMAIN ?? ''   // ej "miclínica.daily.co"

export async function POST(req: NextRequest) {
  try {
    const { citaId, clinicId } = await req.json()
    if (!citaId || !clinicId) {
      return NextResponse.json({ ok: false, error: 'Faltan citaId o clinicId' }, { status: 400 })
    }

    const citaRef = adminDb.collection('clinics').doc(clinicId).collection('appointments').doc(citaId)
    const snap = await citaRef.get()
    if (!snap.exists) return NextResponse.json({ ok: false, error: 'Cita no encontrada' }, { status: 404 })
    const cita = snap.data()!

    // Si ya hay sala guardada, devolverla
    if (cita.telesaludUrl && cita.telesaludExpiresAt && cita.telesaludExpiresAt > Date.now() / 1000) {
      return NextResponse.json({ ok: true, url: cita.telesaludUrl, name: cita.telesaludNombre, expiresAt: cita.telesaludExpiresAt })
    }

    if (!DAILY_API_KEY) {
      // Fallback de desarrollo: genera URL placeholder. NO usar en producción.
      const fakeName = `consulta-${citaId.slice(0, 8)}`
      const fakeUrl = `https://meet.example.com/${fakeName}`
      return NextResponse.json({
        ok: true,
        url: fakeUrl,
        name: fakeName,
        expiresAt: Math.floor(Date.now() / 1000) + 7200,
        warning: 'DAILY_API_KEY no configurada — usando URL ficticia',
      })
    }

    // Calcular ventana de validez: 30 min antes hasta 2 horas después
    const fechaHora = new Date((cita.fechaHora as string).replace(' ', 'T')).getTime()
    const nbf = Math.floor((fechaHora - 30 * 60_000) / 1000)
    const exp = Math.floor((fechaHora + 2 * 60 * 60_000) / 1000)

    // Crear sala en Daily
    const res = await fetch('https://api.daily.co/v1/rooms', {
      method: 'POST',
      headers: { Authorization: `Bearer ${DAILY_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        privacy: 'private',
        properties: {
          enable_screenshare: true,
          enable_chat: true,
          start_video_off: false,
          start_audio_off: false,
          exp,
          nbf,
        },
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      console.error('[telesalud/sala] Daily error:', res.status, err)
      return NextResponse.json({ ok: false, error: 'No se pudo crear sala' }, { status: 502 })
    }
    const room = await res.json()

    const url = room.url as string
    const name = room.name as string

    // Guardar en la cita
    await citaRef.update({
      telesaludUrl: url,
      telesaludNombre: name,
      telesaludExpiresAt: exp,
      updatedAt: new Date().toISOString(),
    })

    return NextResponse.json({ ok: true, url, name, expiresAt: exp })
  } catch (err) {
    console.error('[telesalud/sala]', err)
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 })
  }
}
