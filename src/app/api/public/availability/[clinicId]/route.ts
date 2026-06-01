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

    // 1. Configuración
    const configSnap = await adminDb.collection('clinics').doc(clinicId).collection('config').doc('main').get()
    if (!configSnap.exists) return NextResponse.json({ ok: true, slots: [] })
    const cfg = configSnap.data()!

    // 2. Horario del día
    const d = new Date(fecha + 'T12:00:00')
    const dayKey = DAY_KEYS[d.getDay()]
    const schedule = cfg.horario?.[dayKey]
    if (!schedule?.activo) return NextResponse.json({ ok: true, slots: [], motivo: 'No hay atención este día' })
    if (cfg.diasFestivos?.includes(fecha)) {
      return NextResponse.json({ ok: true, slots: [], motivo: 'Día festivo' })
    }

    const duracion = Number((cfg.duraciones ?? {})[tipo] ?? 30)
    const interval = Number(cfg.intervaloMinutos ?? 10)
    const [hI, mI] = schedule.inicio.split(':').map(Number)
    const [hF, mF] = schedule.fin.split(':').map(Number)
    const startMin = hI * 60 + mI
    const endMin = hF * 60 + mF

    // 3. Citas existentes ese día
    const apptsSnap = await adminDb.collection('clinics').doc(clinicId).collection('appointments').get()
    const dayAppts: { start: number; end: number }[] = []
    apptsSnap.forEach(doc => {
      const a = doc.data()
      if (a.fechaHora?.slice(0, 10) !== fecha) return
      if (['cancelada', 'reagendada', 'no-asistio'].includes(a.estado)) return
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
