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
import { adminDb } from '@/lib/firebase-admin'
import { validarHorarioDia } from '@/lib/availability'

const MAX_SLOTS_POR_DIA = 24
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
      const doc = docSnap.data()
      if (doc) cfg = { ...cfg, horario: doc.horario ?? cfg.horario, duraciones: doc.duraciones ?? cfg.duraciones, intervaloMinutos: doc.intervaloMinutos ?? cfg.intervaloMinutos }
    }

    // 2. Horario del día
    const d = new Date(fecha + 'T12:00:00')
    const dayKey = DAY_KEYS[d.getDay()]
    const schedule = cfg.horario?.[dayKey]
    if (!schedule?.activo) return NextResponse.json({ ok: true, slots: [], motivo: 'No hay atención este día' })
    if (cfg.diasFestivos?.includes(fecha)) {
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
      console.warn(`[public/availability] ${clinicId} ${fecha}: ${validacion.motivo}`)
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

    // 5. Generar slots
    const slots: string[] = []
    const baseDate = fecha + 'T00:00:00'
    const baseTs = new Date(baseDate).getTime()
    for (let m = startMin; m + duracion <= endMin; m += interval) {
      // Tope absoluto: nunca devolver > MAX_SLOTS_POR_DIA al cliente público
      if (slots.length >= MAX_SLOTS_POR_DIA) {
        console.warn(`[public/availability] tope ${MAX_SLOTS_POR_DIA} alcanzado para ${clinicId} ${fecha}`)
        break
      }
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
    console.error('[public/availability]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
