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
import { limitarOResponder } from '@/lib/rate-limit'
import { verificarTokenPaciente } from '@/lib/patient-token'

const DAILY_API_KEY = process.env.DAILY_API_KEY ?? ''
const DAILY_DOMAIN = process.env.DAILY_DOMAIN ?? ''   // ej "miclínica.daily.co"

// Ventana de creación de sala: 30 min antes hasta 2 h después de la cita.
const ANTES_MS = 30 * 60_000
const DESPUES_MS = 2 * 60 * 60_000

export async function POST(req: NextRequest) {
  try {
    const { citaId, clinicId, token } = await req.json()
    if (!citaId || !clinicId) {
      return NextResponse.json({ ok: false, error: 'Faltan citaId o clinicId' }, { status: 400 })
    }

    // AUTORIZACIÓN por token HMAC de paciente (camino seguro). Si el enlace trae un
    // token válido para esta clínica, es una prueba de titularidad → cierra el IDOR.
    // Los enlaces YA enviados sin token siguen funcionando por el camino endurecido
    // (ventana + rate-limit + tipo). El log marca los accesos legacy para migrarlos.
    const tk = verificarTokenPaciente(token)
    // La titularidad se comprueba MÁS ADELANTE contra el paciente de la cita:
    // que el token sea de esta clínica no basta. Sin esa segunda comprobación,
    // un paciente con su enlace legítimo podía pedir la sala de la teleconsulta
    // de CUALQUIER otro paciente del mismo consultorio cambiando el citaId.
    const tokenDeEstaClinica = !!tk && tk.clinicId === clinicId

    // Rate-limit por cita: frena la creación masiva de salas de pago (abuso Daily).
    const limite = await limitarOResponder(`telesalud:${clinicId}:${citaId}`, 12, 600,
      'Demasiados intentos de conexión. Espera un momento e inténtalo de nuevo.')
    if (limite) return limite

    const citaRef = adminDb.collection('clinics').doc(clinicId).collection('appointments').doc(citaId)
    const snap = await citaRef.get()
    if (!snap.exists) return NextResponse.json({ ok: false, error: 'Cita no encontrada' }, { status: 404 })
    const cita = snap.data()!

    // Titularidad: el token tiene que ser del paciente DE ESTA cita.
    const autorizadoPorToken = tokenDeEstaClinica && !!tk?.patientId && tk.patientId === cita.pacienteId
    if (tokenDeEstaClinica && !autorizadoPorToken) {
      // Token válido pero de otro paciente: se responde igual que si la cita no
      // existiera, para no confirmar que ese citaId es real.
      console.warn('[telesalud/sala] token de otro paciente para la cita solicitada')
      return NextResponse.json({ ok: false, error: 'Cita no encontrada' }, { status: 404 })
    }

    // Si ya hay sala guardada, devolverla
    if (cita.telesaludUrl && cita.telesaludExpiresAt && cita.telesaludExpiresAt > Date.now() / 1000) {
      return NextResponse.json({ ok: true, url: cita.telesaludUrl, name: cita.telesaludNombre, expiresAt: cita.telesaludExpiresAt })
    }

    // Con token válido la titularidad está probada → no hace falta la ventana. Sin
    // token (enlace legacy) se mantiene el camino endurecido: solo dentro de la ventana.
    if (!autorizadoPorToken) {
      console.warn(`[telesalud/sala] acceso sin token (legacy) cita ${citaId} — migrar el enlace a token`)
      const inicioCita = new Date((cita.fechaHora as string).replace(' ', 'T')).getTime()
      if (!Number.isNaN(inicioCita)) {
        const ahora = Date.now()
        if (ahora < inicioCita - ANTES_MS || ahora > inicioCita + DESPUES_MS) {
          return NextResponse.json({ ok: false, error: 'La sala está disponible 30 min antes y hasta 2 h después de la cita.' }, { status: 403 })
        }
      }
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
