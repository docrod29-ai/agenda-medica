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
import { errorAlCliente } from '@/lib/security/error-al-cliente'
import { safeLog } from '@/lib/security/sanitize'
import { adminDb } from '@/lib/firebase-admin'
import { limitarOResponder } from '@/lib/rate-limit'
import { verificarTokenPaciente } from '@/lib/patient-token'
import { bloquearSiNoVigente } from '@/lib/portal/vigencia-del-enlace'
import { verificarCapacidad } from '@/lib/authz/verificar'
import { instanteMX, TZ_DEFAULT } from '@/lib/timezone'

const DAILY_API_KEY = process.env.DAILY_API_KEY ?? ''

export async function POST(req: NextRequest) {
  try {
    const { citaId, clinicId, token } = await req.json()
    if (!citaId || !clinicId) {
      return NextResponse.json({ ok: false, error: 'Faltan citaId o clinicId' }, { status: 400 })
    }

    const tk = verificarTokenPaciente(token)

    // Rate-limit por cita: frena la creación masiva de salas de pago (abuso Daily).
    const limite = await limitarOResponder(`telesalud:${clinicId}:${citaId}`, 12, 600,
      'Demasiados intentos de conexión. Espera un momento e inténtalo de nuevo.')
    if (limite) return limite

    const citaRef = adminDb.collection('clinics').doc(clinicId).collection('appointments').doc(citaId)
    const snap = await citaRef.get()
    if (!snap.exists) return NextResponse.json({ ok: false, error: 'Cita no encontrada' }, { status: 404 })
    const cita = snap.data()!

    /**
     * AUTORIZACIÓN SIEMPRE (L2 auditoría maestra 2026-07). Dos vías legítimas:
     *  (a) token HMAC del paciente DE ESTA cita (tk.patientId === cita.pacienteId), o
     *  (b) un miembro clínico autenticado (el médico entra desde el dashboard).
     * Antes existía un camino 'legacy' SIN token que solo pedía estar dentro de la
     * ventana horaria: cualquiera con citaId+clinicId entraba a la sala de otro
     * paciente (peor: la sala existente se devolvía ANTES de comprobar nada). Se
     * elimina ese camino; si un enlace viejo no trae token, el médico lo regenera.
     */
    /**
     * LA RAMA DEL EQUIPO EXIGE ROL CLÍNICO (decisión del dueño, 2026-08-01).
     *
     * Estaba en `verificarMiembro`, o sea CUALQUIER miembro: la asistente del
     * mostrador podía abrir la sala de video de una consulta. El propio registro
     * de rutas lo tenía anotado como pendiente de confirmar.
     *
     * Ya está confirmado: entrar a la teleconsulta es asistir al paciente, no
     * agendarlo. `clinico.leer` deja dentro a médico, admin y al staff clínico
     * hospitalario, y fuera al mostrador.
     *
     * La rama del PACIENTE no se toca: su token HMAC sigue siendo la primera
     * comprobación, y su fallo sigue devolviendo 404 para no confirmar que el
     * citaId existe.
     */
    const autorizadoPorToken = !!tk && tk.clinicId === clinicId && !!tk.patientId && tk.patientId === cita.pacienteId
    /**
     * Y LA REVOCACIÓN, QUE AQUÍ NO SE COMPROBABA — REG-519.
     *
     * Esta ruta acepta el MISMO magic-link que `/api/portal` y que
     * `/api/payment/create-checkout`. Las dos hermanas comprueban
     * `patients/{id}.portalTokenVersion` (REG-331); ésta miraba sólo la firma y
     * la caducidad. Consecuencia: el médico revocaba los enlaces de un paciente,
     * el enlace dejaba de abrir la agenda… y seguía abriendo la SALA DE VIDEO
     * hasta caducar, siete días. Es la credencial que más importa revocar: el
     * cron de recordatorios la manda por WhatsApp para toda teleconsulta, y
     * WhatsApp se reenvía.
     *
     * Misma decisión que las hermanas, con sus tres estados: `revocado` → 401
     * definitivo; `indeterminado` → 503 con `Retry-After`, el enlace NO se quema.
     * Va DESPUÉS de comprobar que el token es de esta cita —un token ajeno sigue
     * recibiendo 404 sin que se lea ningún expediente— y SÓLO en la rama del
     * paciente: el médico entra con su sesión y no tiene token que revocar.
     */
    if (autorizadoPorToken) {
      const noVigente = await bloquearSiNoVigente(clinicId, tk.patientId, tk.version)
      if (noVigente) return noVigente
    }
    let autorizadoPorMiembro = false
    if (!autorizadoPorToken) {
      const acc = await verificarCapacidad(req, clinicId, 'clinico.leer')
      autorizadoPorMiembro = acc.ok
    }
    if (!autorizadoPorToken && !autorizadoPorMiembro) {
      // Sin prueba de titularidad → se responde como si la cita no existiera (no
      // confirma que el citaId sea real).
      safeLog.warn('[telesalud/sala] acceso sin titularidad rechazado')
      return NextResponse.json({ ok: false, error: 'Cita no encontrada' }, { status: 404 })
    }

    // Ya autorizado: si hay sala vigente, devolverla.
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

    /**
     * VENTANA DE VALIDEZ: 30 min antes de la cita, hasta 2 h después.
     *
     * `cita.fechaHora` es HORA DE PARED («2026-08-10 10:00»), sin zona. Se
     * parseaba con `new Date(...)`, que en Vercel corre con TZ=UTC: la sala
     * quedaba abierta de 09:30 a 12:00 UTC mientras la consulta de las 10:00 de
     * México ocurre a las 16:00 UTC. Es decir, médico y paciente entraban a su
     * teleconsulta y la sala llevaba cuatro horas caducada.
     *
     * `instanteMX` con la zona del consultorio es el mismo patrón que ya usa el
     * cron de recordatorios; éste era el último sitio que parseaba a mano.
     */
    const cfgSnap = await adminDb.collection('clinics').doc(clinicId).collection('config').doc('main').get()
    const tzClinica = (cfgSnap.data()?.zonaHoraria as string) || TZ_DEFAULT
    const [fechaParte, horaParte] = String(cita.fechaHora ?? '').split(/[ T]/)
    const fechaHora = instanteMX(fechaParte ?? '', (horaParte ?? '00:00').slice(0, 5), tzClinica).getTime()
    const nbf = Math.floor((fechaHora - 30 * 60_000) / 1000)
    const exp = Math.floor((fechaHora + 2 * 60 * 60_000) / 1000)

    // Crear sala en Daily
    // REG-346 — crear una sala es un POST corto; si tarda, no va a llegar.
    const res = await fetch('https://api.daily.co/v1/rooms', {
      signal: AbortSignal.timeout(15_000),
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
      safeLog.error('[telesalud/sala] Daily error:', res.status, err)
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
    safeLog.error('[telesalud/sala]', err)
    return errorAlCliente()
  }
}
