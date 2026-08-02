/**
 * GET /api/public/availability/[clinicId]?fecha=YYYY-MM-DD&tipo=primera-vez&medicoId=...
 *
 * Devuelve los slots disponibles ese día, considerando:
 *  - El horario del consultorio
 *  - Citas existentes (no se exponen datos del paciente)
 *  - Bloqueos de tiempo (vacaciones, ausencias)
 *  - Días festivos
 */
import { NextRequest, NextResponse } from 'next/server'
import { safeLog } from '@/lib/security/sanitize'
import { adminDb } from '@/lib/firebase-admin'
import { validarHorarioDia, descansosEnMinutos, pisaDescanso } from '@/lib/availability'
import { configParaMedico } from '@/lib/horario-medico'
import { esFestivo } from '@/lib/availability'
import { instanteMX, TZ_DEFAULT } from '@/lib/timezone'
import { ocupadoEnGoogle } from '@/lib/calendario/ocupado-servidor'

/**
 * Mismo cambio que en `lib/availability.ts`, y por el mismo motivo: el tope de
 * 24 recortaba la TARDE de cualquier agenda con citas cortas, y aquí el daño era
 * peor porque es el portal que ve el PACIENTE — la mitad del día simplemente no
 * existía para quien intentaba agendar.
 *
 * Queda un freno anti-desbocado que ninguna agenda real alcanza, para que una
 * configuración corrupta no genere miles de huecos.
 */
const TECHO_ANTIDESBOCADO = 200
const DURACION_MIN_SEGURA = 5

const DAY_KEYS = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'] as const

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ clinicId: string }> },
) {
  try {
    const { clinicId } = await params
    const url = new URL(req.url)
    const fecha = url.searchParams.get('fecha') ?? ''
    const tipo = url.searchParams.get('tipo') ?? 'primera-vez'
    const medicoId = url.searchParams.get('medicoId') ?? undefined

    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
      return NextResponse.json({ error: 'Fecha inválida (YYYY-MM-DD)' }, { status: 400 })
    }
    // Solo permitir consultar fechas razonables (hoy ... +1 año)
    const dt = new Date(fecha + 'T12:00:00')
    const hoy = new Date()
    hoy.setHours(0,0,0,0)
    const limite = new Date(hoy.getTime() + 365 * 86400_000)
    if (dt < hoy || dt > limite) {
      return NextResponse.json({ ok: true, slots: [], motivo: 'Fuera de rango' })
    }

    // 1. Configuración
    const configSnap = await adminDb.collection('clinics').doc(clinicId).collection('config').doc('main').get()
    if (!configSnap.exists) return NextResponse.json({ ok: true, slots: [] })
    let cfg = configSnap.data()!
    // Horario POR MÉDICO: si se pide disponibilidad de un médico concreto, sus
    // horario/duraciones/intervalo pisan a los de la clínica (coherente con el panel).
    if (medicoId) {
      const docSnap = await adminDb.collection('clinics').doc(clinicId).collection('doctors').doc(medicoId).get()
      cfg = configParaMedico(cfg as unknown as import('@/types').ClinicConfig, docSnap.data()) as unknown as typeof cfg
    }

    // 2. Horario del día
    const d = new Date(fecha + 'T12:00:00')
    const dayKey = DAY_KEYS[d.getDay()]
    const schedule = cfg.horario?.[dayKey]
    if (!schedule?.activo) return NextResponse.json({ ok: true, slots: [], motivo: 'No hay atención este día' })
    if (esFestivo(fecha, cfg.diasFestivos as string[] | undefined)) {
      return NextResponse.json({ ok: true, slots: [], motivo: 'Día festivo' })
    }

    const duracionRaw = Number((cfg.duraciones ?? {})[tipo] ?? 30)
    const duracion = Number.isFinite(duracionRaw) && duracionRaw >= DURACION_MIN_SEGURA ? duracionRaw : 30
    const intervalConf = Number(cfg.intervaloMinutos ?? 10)
    const interval = Math.max(intervalConf, duracion)

    // HARD GUARDRAIL: validar el horario antes de generar. Si está corrupto
    // (fin ≤ inicio, jornada > 14h, 24:00 mal formado) NO generamos slots
    // fantasma. Mejor mostrar 0 disponibilidad que 32 lugares ficticios.
    const validacion = validarHorarioDia(schedule.inicio, schedule.fin)
    if (!validacion.valido) {
      safeLog.warn(`[public/availability] ${clinicId} ${fecha}: ${validacion.motivo}`)
      return NextResponse.json({ ok: true, slots: [], motivo: `Configuración del día: ${validacion.motivo}` })
    }
    const { startMin, endMin } = validacion

    // 3. Citas existentes ese día
    /**
     * SOLO EL DÍA CONSULTADO.
     *
     * Esto leía la colección COMPLETA de citas y filtraba el día en memoria. Es un
     * endpoint PÚBLICO, sin autenticación, y el portal lo dispara en cada cambio
     * de fecha: con 15 000 citas eran 15 000 documentos leídos por clic. La
     * transacción de `booking` ya acotaba por rango; aquí se había quedado sin.
     */
    const apptsSnap = await adminDb.collection('clinics').doc(clinicId).collection('appointments')
      .where('fechaHora', '>=', `${fecha} 00:00`)
      .where('fechaHora', '<=', `${fecha} 23:59`)
      .get()
    const dayAppts: { start: number; end: number }[] = []
    apptsSnap.forEach(doc => {
      const a = doc.data()
      if (a.fechaHora?.slice(0, 10) !== fecha) return
      if (['cancelada', 'reagendada', 'no-asistio'].includes(a.estado)) return
      // MULTI-MÉDICO: si se consulta la agenda de un médico, solo bloquean SUS
      // citas. Sin esto, el portal escondía huecos libres de un médico porque
      // otro estaba ocupado a esa hora.
      if (medicoId && a.medicoId && a.medicoId !== medicoId) return
      const [ah, am] = (a.fechaHora.slice(11, 16) || '00:00').split(':').map(Number)
      const start = ah * 60 + am
      const end = start + (a.duracion ?? 30)
      dayAppts.push({ start, end })
    })

    // 4. Bloqueos de tiempo
    const bloquesSnap = await adminDb.collection('clinics').doc(clinicId).collection('time_blocks').get()
    const bloques: { desde: number; hasta: number; medicoId?: string }[] = []
    bloquesSnap.forEach(doc => {
      const b = doc.data()
      const desde = new Date(b.desde).getTime()
      const hasta = new Date(b.hasta).getTime()
      bloques.push({ desde, hasta, medicoId: b.medicoId })
    })

    /**
     * 4.5. LO QUE EL MÉDICO YA TIENE EN SU GOOGLE CALENDAR.
     *
     * Hasta aquí el portal sólo miraba las citas de NexusMED y los bloqueos
     * capturados a mano: una cirugía, una junta o un vuelo apuntados en el
     * calendario personal del médico no existían para el paciente, que reservaba
     * encima. El panel del consultorio sí lo consultaba desde v8xx
     * (`api/calendar/ocupado`); este camino —el que de verdad usa el paciente—
     * no, porque el token vive por `uid` y no había forma de saber de quién era
     * el calendario. Eso lo resolvió el vínculo de v875.
     *
     * TRES CAUTELAS:
     *  · sólo con `medicoId`: sin él no se sabe qué calendario mirar, y mirar el
     *    del dueño le bloquearía huecos a los demás;
     *  · si Google falla, se sigue EXACTAMENTE como antes — nunca se esconde el
     *    día entero por un fallo de red, que dejaría al consultorio sin agenda
     *    pública sin que nadie se entere;
     *  · no viaja nada del evento: sólo el intervalo ocupado. El paciente no ve
     *    qué tiene el médico, sólo que esa hora no está.
     */
    if (medicoId) {
      const g = await ocupadoEnGoogle(clinicId, medicoId, fecha, {
        zonaHoraria: cfg.zonaHoraria as string | undefined,
        googleCalendarId: cfg.googleCalendarId as string | undefined,
      })
      for (const b of g.bloqueos) {
        bloques.push({ desde: Date.parse(b.desde), hasta: Date.parse(b.hasta), medicoId })
      }
      if (g.fallo) {
        safeLog.warn(`[public/availability] ${clinicId} ${fecha}: no se pudo leer el Google Calendar del médico; los huecos NO lo tienen en cuenta.`)
      }
    }

    // 5. Generar slots
    const slots: string[] = []
    /**
     * LA MEDIANOCHE ES LA DEL CONSULTORIO, NO LA DEL SERVIDOR.
     *
     * `new Date(fecha + 'T00:00:00')` se interpreta en la zona del proceso, y en
     * Vercel esa zona es UTC: la medianoche quedaba 6-8 h corrida. Los bloqueos
     * SÍ están guardados como instantes absolutos (`.toISOString()`), así que la
     * comparación enfrentaba un instante correcto contra uno desplazado.
     *
     * Efecto real: el médico bloqueaba «10-ago 14:00-18:00, congreso» y el
     * portal seguía ofreciendo esas horas —el paciente llenaba el formulario
     * entero para chocar con un 409 al final— mientras escondía como ocupadas
     * horas que estaban libres.
     */
    const tzClinica = (cfg.zonaHoraria as string) || TZ_DEFAULT
    const baseTs = instanteMX(fecha, '00:00', tzClinica).getTime()
    // HORARIO PARTIDO: la misma regla que el panel. Si esto se olvidara aquí, el
    // portal ofrecería al paciente la hora de comida del médico y la cita
    // entraría de verdad — el panel no la rechaza, sólo no la ofrece.
    const descansos = descansosEnMinutos(schedule.descansos)
    for (let m = startMin; m + duracion <= endMin; m += interval) {
      if (slots.length >= TECHO_ANTIDESBOCADO) {
        safeLog.warn(`[public/availability] freno anti-desbocado (${TECHO_ANTIDESBOCADO}) en ${clinicId} ${fecha} — revisar horario e intervalo`)
        break
      }
      if (pisaDescanso(m, m + duracion, descansos)) continue
      const ts = baseTs + m * 60 * 1000
      // ¿Bloqueado?
      const bloqueado = bloques.some(b => {
        if (b.medicoId && medicoId && b.medicoId !== medicoId) return false
        return ts >= b.desde && ts < b.hasta
      })
      if (bloqueado) continue
      // ¿Solapa con cita?
      const slotEnd = m + duracion
      const conflicto = dayAppts.some(a => m < a.end && slotEnd > a.start)
      if (conflicto) continue
      slots.push(`${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`)
    }

    return NextResponse.json({ ok: true, slots, duracion })
  } catch (err) {
    safeLog.error('[public/availability]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
