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
import { safeLog } from '@/lib/security/sanitize'
import { instanteMX, TZ_DEFAULT } from '@/lib/timezone'
import { adminDb } from '@/lib/firebase-admin'
import { getDaySchedule, validarHorarioDia } from '@/lib/availability'
// Del NÚCLEO PURO: esta ruta corre en el SERVIDOR y `time-blocks` arrastra el SDK
// del navegador, que se inicializa al importarse y revienta el build sin variables.
import { estaBloqueado } from '@/lib/time-blocks-core'
import { limitarOResponder } from '@/lib/rate-limit'
import { elegirExpedienteParaCita } from '@/lib/pacientes/duplicados'

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

    /**
     * RATE-LIMIT (endpoint público sin auth). Sin esto, un script podía crear
     * pacientes y citas 'solicitada' en masa y disparar WhatsApp a números
     * arbitrarios (spam/costo). Dos ventanas: por IP (freno general) y por
     * teléfono+clínica (evita reservas repetidas del mismo número). Es a prueba de
     * fallos: si Firestore falla, `limitar` deja pasar (no bloquea reservas
     * legítimas por un problema de infraestructura).
     */
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'sin-ip'
    const telClave = (paciente.telefono || '').replace(/\D/g, '').slice(-10)
    const limIp = await limitarOResponder(`booking:ip:${ip}`, 8, 3600, 'Demasiadas solicitudes. Intenta más tarde.')
    if (limIp) return limIp
    const limTel = await limitarOResponder(`booking:tel:${clinicId}:${telClave}`, 4, 86400, 'Ya tienes varias solicitudes recientes. Te contactaremos pronto.')
    if (limTel) return limTel

    // Validaciones de forma (defensa contra abuso de endpoint público)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return NextResponse.json({ ok: false, error: 'Fecha inválida' }, { status: 400 })
    if (!/^\d{2}:\d{2}$/.test(hora)) return NextResponse.json({ ok: false, error: 'Hora inválida' }, { status: 400 })
    if (paciente.nombre.length > 120 || paciente.nombre.length < 3) return NextResponse.json({ ok: false, error: 'Nombre fuera de rango' }, { status: 400 })
    if (paciente.telefono.replace(/\D/g, '').length < 7) return NextResponse.json({ ok: false, error: 'Teléfono inválido' }, { status: 400 })
    if (paciente.email && paciente.email.length > 200) return NextResponse.json({ ok: false, error: 'Correo demasiado largo' }, { status: 400 })
    if (paciente.motivo && paciente.motivo.length > 500) return NextResponse.json({ ok: false, error: 'Motivo demasiado largo' }, { status: 400 })
    /**
     * Fecha futura — interpretada en la zona de MÉXICO, no en la del servidor.
     *
     * `new Date('2026-07-20T10:00:00')` sin offset se lee en la zona del proceso,
     * que en Vercel es UTC: seis horas antes del instante real. Hoy no explota
     * porque el portal solo ofrece de mañana en adelante, pero es una bomba de
     * tiempo: el día que se habilite reservar el mismo día, toda la tarde
     * empezaría a rechazarse con "No se puede agendar en el pasado".
     *
     * `instanteMX` ya existe justo para esto — el cron de recordatorios tuvo el
     * mismo bug y así se resolvió.
     */
    const clinicRef = adminDb.collection('clinics').doc(clinicId)
    // Resiliencia (igual que /api/public/clinic): el doc padre puede ser
    // "virtual" en Firestore aunque la config exista. Validamos por config.
    const [clinicSnap, configSnap] = await Promise.all([
      clinicRef.get(),
      clinicRef.collection('config').doc('main').get(),
    ])
    if (!clinicSnap.exists && !configSnap.exists) {
      return NextResponse.json({ ok: false, error: 'Clínica no encontrada' }, { status: 404 })
    }
    const clinic = clinicSnap.exists ? clinicSnap.data()! : null
    if (clinic && clinic.status && clinic.status !== 'active' && clinic.status !== 'trial') {
      return NextResponse.json({ ok: false, error: 'Clínica no activa' }, { status: 403 })
    }

    const cfgBase = configSnap.data() ?? {}
    if (cfgBase.publicBookingEnabled === false) {
      return NextResponse.json({ ok: false, error: 'Esta clínica no acepta reservas en línea' }, { status: 403 })
    }
    // HORARIO POR MÉDICO: si la reserva es para un médico concreto, su horario/
    // duraciones pisan a los de la clínica (igual que el panel y /api/appointments).
    // Sin esto, el portal rechazaba o permitía días según el horario de la clínica,
    // incoherente con lo que el médico realmente atiende.
    let cfg = cfgBase
    if (medicoId) {
      const docSnap = await clinicRef.collection('doctors').doc(medicoId).get()
      const doc = docSnap.data()
      if (doc) cfg = { ...cfgBase, horario: doc.horario ?? cfgBase.horario, duraciones: doc.duraciones ?? cfgBase.duraciones, intervaloMinutos: doc.intervaloMinutos ?? cfgBase.intervaloMinutos }
    }
    const duracion = Number((cfg.duraciones ?? {})[tipo] ?? 30)

    /**
     * La validación de «fecha pasada» va AQUÍ, no arriba con las de forma.
     *
     * Arriba la configuración todavía no se ha leído, así que `instanteMX` caía a
     * México central. El propio comentario que había lo declaraba y lo dejaba
     * pasar: «el bloqueo sí usa la zona real, que es donde importa». No es cierto
     * — en Tijuana (UTC-8) esta comprobación va dos horas adelantada, y el día que
     * se habiliten reservas del mismo día rechazaría como «pasado» un hueco que
     * todavía no ha llegado.
     *
     * Movida aquí, ya se conoce `cfg.zonaHoraria`. El coste es una lectura de
     * Firestore antes de rechazar una fecha pasada; el límite de peticiones ya se
     * aplicó mucho antes, así que no abre nada.
     */
    const tzClinica = cfg.zonaHoraria || TZ_DEFAULT
    const fechaHoraDt = instanteMX(fecha, hora, tzClinica)
    if (isNaN(fechaHoraDt.getTime()) || fechaHoraDt.getTime() < Date.now()) {
      return NextResponse.json({ ok: false, error: 'No se puede agendar en el pasado' }, { status: 400 })
    }

    const fechaHora = `${fecha} ${hora}`

    // RE-VALIDAR el slot en el SERVIDOR (no confiar en que el cliente solo mande
    // horas válidas): día activo/no festivo, dentro del horario, y sin bloqueo.
    const schedule = getDaySchedule(fecha, cfg as unknown as import('@/types').ClinicConfig)
    if (!schedule) return NextResponse.json({ ok: false, error: 'Ese día no hay servicio' }, { status: 409 })
    const vh = validarHorarioDia(schedule.inicio, schedule.fin)
    const [rh, rm] = hora.split(':').map(Number)
    const minSlot = rh * 60 + rm
    if (!vh.valido || minSlot < vh.startMin || minSlot + duracion > vh.endMin) {
      return NextResponse.json({ ok: false, error: 'Horario fuera del servicio' }, { status: 409 })
    }
    const bloquesSnap = await clinicRef.collection('time_blocks').get()
    const bloques = bloquesSnap.docs.map(d => ({ id: d.id, ...d.data() })) as unknown as import('@/lib/time-blocks-core').TimeBlock[]
    if (estaBloqueado(fechaHora, bloques, medicoId, tzClinica)) {
      return NextResponse.json({ ok: false, error: 'Ese horario no está disponible (bloqueo/ausencia)' }, { status: 409 })
    }

    /**
     * BUSCAR O CREAR EL PACIENTE — y no colgarle la cita a quien no es.
     *
     * Esto buscaba por TELÉFONO, tomaba el PRIMERO y le colgaba la cita. Sin
     * mirar el nombre en ningún momento. En México el celular es de la casa, así
     * que la reserva de un hijo aterrizaba en el expediente de quien se hubiera
     * registrado antes con ese número — y con ella la nota, el diagnóstico y la
     * receta que se escribieran después.
     *
     * No es un expediente partido: es información clínica en la persona
     * equivocada, y encima por la puerta más expuesta de todas, donde el
     * paciente reserva solo y no hay nadie mirando.
     *
     * Se sigue consultando por teléfono —es lo que el índice sabe hacer barato—
     * pero ahora se traen VARIOS candidatos y decide el mismo motor que el resto
     * de la aplicación, que exige parecido de NOMBRE. Si ninguno encaja, se crea
     * uno nuevo: de los dos errores posibles, el duplicado es el barato.
     */
    const tel = paciente.telefono.replace(/\D/g, '')
    // `limit(10)` y no `limit(1)`: una familia con el mismo número son varios
    // documentos, y con uno solo se decidía sobre el primero que apareciera.
    const pacientesSnap = await clinicRef.collection('patients').where('telefono', '==', tel).limit(10).get()
    const candidatos = pacientesSnap.docs.map(d => {
      const x = d.data() as { nombre?: string; telefono?: string; whatsapp?: string; curp?: string; fechaNacimiento?: string; edad?: number }
      return { id: d.id, nombre: x.nombre, telefono: x.telefono, whatsapp: x.whatsapp, curp: x.curp, fechaNacimiento: x.fechaNacimiento, edad: x.edad }
    })
    const elegido = elegirExpedienteParaCita({ nombre: paciente.nombre, telefono: tel }, candidatos)
    let pacienteId = ''
    if (elegido) {
      pacienteId = elegido.id
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

    // Crear la cita de forma ATÓMICA: re-chequea el conflicto y escribe en una sola
    // transacción → cierra la carrera check-then-write si dos pacientes reservan el
    // mismo hueco al mismo tiempo.
    const now = new Date().toISOString()
    const apptsCol = clinicRef.collection('appointments')
    const [h, m] = hora.split(':').map(Number)
    const start = h * 60 + m
    const end = start + duracion
    const CONFLICTO = Symbol('conflicto')
    let citaId = ''
    // Centinela por médico+día (mismo mecanismo que la agenda interna): la tx lo
    // lee y escribe → serializa reservas simultáneas del mismo día y cierra la
    // carrera de inserción fantasma que una query dentro de la tx no bloquea.
    const diaRef = clinicRef.collection('slot_locks').doc(fecha)  // un centinela por DÍA: ver /api/appointments
    try {
      await adminDb.runTransaction(async (tx) => {
        await tx.get(diaRef)  // read: fija la versión del día
        const snap = await tx.get(
          apptsCol.where('fechaHora', '>=', `${fecha} 00:00`).where('fechaHora', '<=', `${fecha} 23:59`)
        )
        let conflicto = false
        snap.forEach(d => {
          const a = d.data()
          if (['cancelada', 'reagendada', 'no-asistio'].includes(a.estado)) return
          // MULTI-MÉDICO: el conflicto solo aplica contra citas del mismo médico.
          if (medicoId && a.medicoId && a.medicoId !== medicoId) return
          const [ah, am] = (a.fechaHora?.slice(11, 16) || '00:00').split(':').map(Number)
          const aStart = ah * 60 + am
          const aEnd = aStart + (a.duracion ?? 30)
          if (start < aEnd && end > aStart) conflicto = true
        })
        if (conflicto) throw CONFLICTO

        tx.set(diaRef, { ultimaReserva: now }, { merge: true })  // write: invalida la tx concurrente
        const ref = apptsCol.doc()
        tx.set(ref, {
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
          consentimientos: { avisoPrivacidad: true, informado: true, timestamp: now },
          creadoPor: 'portal-publico',
          updatedPor: 'portal-publico',
          createdAt: now,
          updatedAt: now,
        })
        citaId = ref.id
      })
    } catch (e) {
      if (e === CONFLICTO) {
        return NextResponse.json({ ok: false, error: 'Ese horario acaba de ocuparse. Elige otro.' }, { status: 409 })
      }
      throw e
    }

    // Auditoría
    await clinicRef.collection('audit_log').add({
      evento: 'cita_solicitada_portal',
      clinicId, patientId: pacienteId, citaId,
      timestamp: now,
      meta: { tipo, fecha, hora, origen: 'portal-publico' },
    }).catch(() => { /* no romper si falla */ })

    // Notificación WhatsApp al paciente (si el bot está conectado en la clínica)
    try {
      const { sendWhatsApp } = await import('@/lib/whatsapp-send')
      const msg = `¡Hola ${paciente.nombre.split(' ')[0]}! 👋\n\nRecibimos tu solicitud de cita en ${cfg.nombreClinica ?? 'el consultorio'}:\n\n📅 ${fecha} · 🕐 ${hora} h\n\nTe contactaremos para confirmar. Gracias.`
      await sendWhatsApp(clinicId, tel, msg).catch(() => {})
    } catch { /* no romper si la notificación falla */ }

    return NextResponse.json({ ok: true, citaId, fecha, hora, duracion })
  } catch (err) {
    safeLog.error('[public/booking]', err)
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 })
  }
}
