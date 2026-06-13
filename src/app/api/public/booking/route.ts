/**
 * POST /api/public/booking
 *
 * Crea una cita desde el portal público.
 * - Verifica que el slot esté libre (anti-doble-agendamiento).
 * - Verifica que la clínica acepte reservas públicas.
 * - Crea el paciente si no existe (por teléfono).
 * - Estado inicial: 'solicitada' (no confirmada hasta que el médico/asistente lo haga).
 */
import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'

interface Body {
  clinicId: string
  tipo: string
  fecha: string         // YYYY-MM-DD
  hora: string          // HH:MM
  medicoId?: string
  paciente: {
    nombre: string
    telefono: string
    email?: string
    motivo?: string
  }
  consentimientos: {
    avisoPrivacidad: boolean
    informado: boolean
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Body
    const { clinicId, tipo, fecha, hora, medicoId, paciente, consentimientos } = body

    if (!clinicId || !tipo || !fecha || !hora || !paciente?.nombre || !paciente?.telefono) {
      return NextResponse.json({ ok: false, error: 'Faltan campos obligatorios' }, { status: 400 })
    }
    if (!consentimientos?.avisoPrivacidad || !consentimientos?.informado) {
      return NextResponse.json({ ok: false, error: 'Se requieren los consentimientos' }, { status: 400 })
    }
    // Validaciones de forma (defensa contra abuso de endpoint público)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return NextResponse.json({ ok: false, error: 'Fecha inválida' }, { status: 400 })
    if (!/^\d{2}:\d{2}$/.test(hora)) return NextResponse.json({ ok: false, error: 'Hora inválida' }, { status: 400 })
    if (paciente.nombre.length > 120 || paciente.nombre.length < 3) return NextResponse.json({ ok: false, error: 'Nombre fuera de rango' }, { status: 400 })
    if (paciente.telefono.replace(/\D/g, '').length < 7) return NextResponse.json({ ok: false, error: 'Teléfono inválido' }, { status: 400 })
    if (paciente.email && paciente.email.length > 200) return NextResponse.json({ ok: false, error: 'Correo demasiado largo' }, { status: 400 })
    if (paciente.motivo && paciente.motivo.length > 500) return NextResponse.json({ ok: false, error: 'Motivo demasiado largo' }, { status: 400 })
    // Fecha futura — no permitir agendar en pasado
    const fechaHoraDt = new Date(`${fecha}T${hora}:00`)
    if (isNaN(fechaHoraDt.getTime()) || fechaHoraDt.getTime() < Date.now()) {
      return NextResponse.json({ ok: false, error: 'No se puede agendar en el pasado' }, { status: 400 })
    }

    const clinicRef = adminDb.collection('clinics').doc(clinicId)
    const clinicSnap = await clinicRef.get()
    if (!clinicSnap.exists) return NextResponse.json({ ok: false, error: 'Clínica no encontrada' }, { status: 404 })

    const clinic = clinicSnap.data()!
    if (clinic.status !== 'active' && clinic.status !== 'trial') {
      return NextResponse.json({ ok: false, error: 'Clínica no activa' }, { status: 403 })
    }

    const configSnap = await clinicRef.collection('config').doc('main').get()
    const cfg = configSnap.data() ?? {}
    if (cfg.publicBookingEnabled === false) {
      return NextResponse.json({ ok: false, error: 'Esta clínica no acepta reservas en línea' }, { status: 403 })
    }
    const duracion = Number((cfg.duraciones ?? {})[tipo] ?? 30)

    // Anti-doble-agendamiento: verifica que el slot siga libre
    const fechaHora = `${fecha} ${hora}`
    const apptsSnap = await clinicRef.collection('appointments').get()
    const [h, m] = hora.split(':').map(Number)
    const start = h * 60 + m
    const end = start + duracion
    let conflicto = false
    apptsSnap.forEach(d => {
      const a = d.data()
      if (a.fechaHora?.slice(0, 10) !== fecha) return
      if (['cancelada', 'reagendada', 'no-asistio'].includes(a.estado)) return
      // MULTI-MÉDICO: el conflicto solo aplica contra citas del mismo médico.
      if (medicoId && a.medicoId && a.medicoId !== medicoId) return
      const [ah, am] = (a.fechaHora.slice(11, 16) || '00:00').split(':').map(Number)
      const aStart = ah * 60 + am
      const aEnd = aStart + (a.duracion ?? 30)
      if (start < aEnd && end > aStart) conflicto = true
    })
    if (conflicto) {
      return NextResponse.json({ ok: false, error: 'Ese horario acaba de ocuparse. Elige otro.' }, { status: 409 })
    }

    // Buscar/crear paciente por teléfono
    const tel = paciente.telefono.replace(/\D/g, '')
    const pacientesSnap = await clinicRef.collection('patients').where('telefono', '==', tel).limit(1).get()
    let pacienteId = ''
    if (!pacientesSnap.empty) {
      pacienteId = pacientesSnap.docs[0].id
    } else {
      const newP = await clinicRef.collection('patients').add({
        nombre: paciente.nombre.trim(),
        telefono: tel,
        // '' en vez de undefined: el Admin SDK rechaza undefined ("Unsupported
        // field value") y abortaba el alta del paciente cuando no había email.
        email: paciente.email?.trim() || '',
        noShowCount: 0, cancelacionCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        creadoPor: 'portal-publico',
      })
      pacienteId = newP.id
    }

    // Crear la cita
    const now = new Date().toISOString()
    const apptRef = await clinicRef.collection('appointments').add({
      pacienteId,
      pacienteNombre: paciente.nombre.trim(),
      pacienteTelefono: tel,
      pacienteEmail: paciente.email?.trim() || '',
      fechaHora,
      duracion,
      tipo,
      motivo: paciente.motivo?.trim() ?? '',
      estado: 'solicitada',
      origen: 'Portal',
      medicoId: medicoId ?? '',
      doctorId: medicoId ?? '',
      lugar: cfg.nombreClinica || '',
      confirmadoPaciente: true,         // viene del propio paciente
      recordatorio24hEnviado: false,
      recordatorioMismoDiaEnviado: false,
      notasInternas: '',
      consentimientoMensajes: true,
      consentimientos: {
        avisoPrivacidad: true,
        informado: true,
        timestamp: now,
      },
      creadoPor: 'portal-publico',
      updatedPor: 'portal-publico',
      createdAt: now,
      updatedAt: now,
    })

    // Auditoría
    await clinicRef.collection('audit_log').add({
      evento: 'cita_solicitada_portal',
      clinicId, patientId: pacienteId, citaId: apptRef.id,
      timestamp: now,
      meta: { tipo, fecha, hora, origen: 'portal-publico' },
    }).catch(() => { /* no romper si falla */ })

    // Notificación WhatsApp al paciente (si el bot está conectado en la clínica)
    try {
      const { sendWhatsApp } = await import('@/lib/whatsapp-send')
      const msg = `¡Hola ${paciente.nombre.split(' ')[0]}! 👋\n\nRecibimos tu solicitud de cita en ${cfg.nombreClinica ?? 'el consultorio'}:\n\n📅 ${fecha} · 🕐 ${hora} h\n\nTe contactaremos para confirmar. Gracias.`
      await sendWhatsApp(clinicId, tel, msg).catch(() => {})
    } catch { /* no romper si la notificación falla */ }

    return NextResponse.json({ ok: true, citaId: apptRef.id, fecha, hora, duracion })
  } catch (err) {
    console.error('[public/booking]', err)
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 })
  }
}
