'use client'
import { useState, useMemo } from 'react'
import { activable } from '@/lib/ui/activable'
import { useRouter } from 'next/navigation'
import { useAppointments } from '@/hooks/useAppointments'
import { useConfig } from '@/hooks/useConfig'
import { AppointmentModal } from '@/components/AppointmentModal'
import { DoctorFilter, useFiltroMedico, colorMedico } from '@/components/DoctorFilter'
import { StatusBadge } from '@/components/StatusBadge'
import { TipoCitaIcon } from '@/components/TipoCitaIcon'
import { Appointment, APPOINTMENT_TYPE_CONFIG, AppointmentStatus } from '@/types'
import { getWeekDates } from '@/lib/availability'
import { hoyISO, fechaISOLocal } from '@/lib/timezone'
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

/**
 * Semántica VISUAL del estado en la rejilla del calendario.
 *
 * Antes las citas se coloreaban SOLO por médico: una cita cancelada, un "no
 * asistió" y una confirmada se veían idénticas, así que el estado solo era
 * legible abriendo la cita. Ahora el estilo del bloque refleja el estado:
 *  - cancelada / no-asistió → tenue + texto tachado (visualmente "muerta")
 *  - tentativas (solicitada, pendiente-*) → borde punteado
 *  - el resto → sólido (confirmada / atendida / pagada…)
 * La TINTE (hue) sigue siendo la del médico, útil en multi-doctor.
 */
function estiloEstadoCita(estado: AppointmentStatus): { opacity: number; borderStyle: 'solid' | 'dashed'; tachado: boolean } {
  if (estado === 'cancelada' || estado === 'no-asistio') return { opacity: 0.45, borderStyle: 'dashed', tachado: true }
  if (estado === 'solicitada' || estado === 'pendiente-confirmar' || estado === 'pendiente-datos' || estado === 'reagendada') return { opacity: 0.85, borderStyle: 'dashed', tachado: false }
  return { opacity: 1, borderStyle: 'solid', tachado: false }
}

type View = 'semana' | 'mes' | 'dia'

const HOURS = Array.from({ length: 13 }, (_, i) => i + 7) // 7am–7pm

export default function CalendarioPage() {
  const router = useRouter()
  const [baseDate, setBaseDate] = useState(new Date())
  // La ventana de citas se pide desde un mes ANTES de lo que estás viendo, para
  // que navegar hacia atrás traiga esas citas en vez de mostrar el mes vacío.
  const desdeVentana = useMemo(() => {
    const d = new Date(baseDate)
    d.setMonth(d.getMonth() - 1)
    // fechaISOLocal, no toISOString: este último convierte a UTC y corre el día.
    return `${fechaISOLocal(d)} 00:00`
  }, [baseDate])
  const { appointments: allAppointments, loading } = useAppointments(desdeVentana)
  const { config } = useConfig()
  const [medicoFiltro, setMedicoFiltro] = useFiltroMedico()
  // Aplicar filtro de médico antes de pasar a las vistas
  const appointments = useMemo(() => {
    if (!medicoFiltro) return allAppointments
    return allAppointments.filter(a => a.medicoId === medicoFiltro)
  }, [allAppointments, medicoFiltro])
  const [view, setView] = useState<View>('semana')
  const [modalOpen, setModalOpen] = useState(false)
  const [editAppt, setEditAppt] = useState<Appointment | null>(null)
  const [defaultDate, setDefaultDate] = useState('')
  const [defaultHour, setDefaultHour] = useState('')

  const weekDates = useMemo(() => getWeekDates(baseDate), [baseDate])

  // Crear cita: redirige al flujo unificado "Agendar rápido" con fecha/hora prellenada
  const openNew = (fecha: string, hora: string) => {
    const qs = new URLSearchParams()
    if (fecha) qs.set('fecha', fecha)
    if (hora) qs.set('hora', hora)
    const s = qs.toString()
    router.push(s ? `/asistente?${s}` : '/asistente')
  }

  const openEdit = (appt: Appointment) => {
    setEditAppt(appt)
    setModalOpen(true)
  }

  const navigate = (dir: number) => {
    const d = new Date(baseDate)
    if (view === 'semana') d.setDate(d.getDate() + dir * 7)
    else if (view === 'mes') d.setMonth(d.getMonth() + dir)
    else d.setDate(d.getDate() + dir)
    setBaseDate(d)
  }

  const rangeLabel = useMemo(() => {
    if (view === 'semana') {
      const start = weekDates[0]
      const end = weekDates[6]
      if (start.getMonth() === end.getMonth()) {
        return `${format(start, 'd')} – ${format(end, 'd')} de ${format(start, 'MMMM yyyy', { locale: es })}`
      }
      return `${format(start, 'd MMM', { locale: es })} – ${format(end, 'd MMM yyyy', { locale: es })}`
    }
    if (view === 'mes') return format(baseDate, 'MMMM yyyy', { locale: es })
    return format(baseDate, "EEEE d 'de' MMMM", { locale: es })
  }, [view, baseDate, weekDates])

  return (
    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', height: 'calc(100vh - 52px)' }}>
      {/* Topbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', margin: 0 }}>Calendario</h1>
        <DoctorFilter medicoId={medicoFiltro} onChange={setMedicoFiltro} />
        <div style={{ flex: 1 }} />

        {/* View tabs */}
        <div style={{ display: 'flex', background: 'var(--s2)', borderRadius: 8, padding: 3, gap: 2 }}>
          {(['dia', 'semana', 'mes'] as View[]).map(v => (
            <button
              key={v}
              onClick={() => setView(v)}
              style={{
                padding: '5px 14px', borderRadius: 6, border: 'none', cursor: 'pointer',
                fontSize: 13, fontWeight: 500,
                background: view === v ? 'var(--s3)' : 'transparent',
                color: view === v ? 'var(--teal)' : 'var(--text3)',
                textTransform: 'capitalize', transition: 'all var(--mov-rapido) var(--mov-curva)',
              }}
            >
              {v === 'dia' ? 'Día' : v === 'semana' ? 'Semana' : 'Mes'}
            </button>
          ))}
        </div>

        {/* Navigation */}
        <button className="btn btn-ghost btn-icon btn-sm" onClick={() => navigate(-1)}><ChevronLeft size={16} /></button>
        <button
          className="btn btn-secondary btn-sm"
          onClick={() => setBaseDate(new Date())}
          style={{ minWidth: 180, textAlign: 'center', textTransform: 'capitalize' }}
        >
          {rangeLabel}
        </button>
        <button className="btn btn-ghost btn-icon btn-sm" onClick={() => navigate(1)}><ChevronRight size={16} /></button>

        <button className="btn btn-primary btn-sm" onClick={() => openNew(hoyISO(), '')}>
          <Plus size={15} /> Nueva cita
        </button>
      </div>

      {/* Calendar body */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        {view === 'semana' && (
          <WeekView
            weekDates={weekDates}
            appointments={appointments}
            onCellClick={openNew}
            onApptClick={openEdit}
            loading={loading}
          />
        )}
        {view === 'dia' && (
          <DayView
            date={baseDate}
            appointments={appointments}
            onCellClick={(h) => openNew(fechaISOLocal(baseDate), h)}
            onApptClick={openEdit}
            loading={loading}
          />
        )}
        {view === 'mes' && (
          <MonthView
            date={baseDate}
            appointments={appointments}
            onDayClick={(d) => { setBaseDate(d); setView('dia') }}
            onApptClick={openEdit}
            loading={loading}
          />
        )}
      </div>

      <AppointmentModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditAppt(null) }}
        appointment={editAppt}
        defaultDate={defaultDate}
        defaultHour={defaultHour}
        onSaved={() => {}}
      />
    </div>
  )
}

function WeekView({ weekDates, appointments, onCellClick, onApptClick, loading }: {
  weekDates: Date[]
  appointments: Appointment[]
  onCellClick: (fecha: string, hora: string) => void
  onApptClick: (a: Appointment) => void
  loading: boolean
}) {
  const today = hoyISO()
  const DAY_NAMES = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

  return (
    <div style={{ height: '100%', overflow: 'auto', background: 'var(--s1)', border: '1px solid var(--border)', borderRadius: 12 }}>
      {/* Header row */}
      <div style={{ display: 'grid', gridTemplateColumns: '56px repeat(7, 1fr)', borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, zIndex: 10, background: 'var(--s2)' }}>
        <div />
        {weekDates.map((d, i) => {
          const ds = fechaISOLocal(d)
          const isToday = ds === today
          return (
            <div key={i} style={{ padding: '10px 6px', textAlign: 'center', borderLeft: '1px solid var(--border)' }}>
              <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 500 }}>{DAY_NAMES[i]}</div>
              <div style={{
                fontSize: 16, fontWeight: 700,
                color: isToday ? 'var(--teal)' : 'var(--text)',
                background: isToday ? 'var(--teal-glow)' : 'transparent',
                width: 28, height: 28, borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '2px auto 0',
              }}>
                {d.getDate()}
              </div>
            </div>
          )
        })}
      </div>

      {/* Hour rows */}
      {HOURS.map(h => (
        <div key={h} style={{ display: 'grid', gridTemplateColumns: '56px repeat(7, 1fr)', minHeight: 48, borderBottom: '1px solid var(--border)' }}>
          <div style={{ padding: '4px 8px', textAlign: 'right', fontSize: 11, color: 'var(--text3)', flexShrink: 0, borderRight: '1px solid var(--border)' }}>
            {String(h).padStart(2, '0')}:00
          </div>
          {weekDates.map((d, di) => {
            const ds = fechaISOLocal(d)
            const hourStr = `${String(h).padStart(2, '0')}:00`
            const cellAppts = appointments.filter(a =>
              a.fechaHora.startsWith(ds) && parseInt(a.fechaHora.slice(11, 13)) === h
            )
            return (
              <div
                key={di}
                style={{
                  borderLeft: '1px solid var(--border)', position: 'relative', cursor: 'pointer', minHeight: 48,
                  background: di >= 5 ? 'rgba(242,239,233,0.022)' : 'transparent',  // tinte sutil de fin de semana
                }}
                {...activable(() => onCellClick(ds, hourStr), { etiqueta: `Agendar a las ${hourStr}` })}
              >
                {cellAppts.map(a => {
                  const minOffset = parseInt(a.fechaHora.slice(14, 16))
                  const heightPct = Math.min((a.duracion / 60) * 100, 200)
                  // Multi-doctor: colorea según el médico; un solo médico → cobalto de marca
                  const color = a.medicoId ? colorMedico(a.medicoId) : 'var(--nexus)'
                  const est = estiloEstadoCita(a.estado)
                  return (
                    <div
                      key={a.id}
                      {...activable(() => onApptClick(a), { etiqueta: `Cita de ${a.pacienteNombre} a las ${a.fechaHora.slice(11, 16)}` })}
                      onClick={e => { e.stopPropagation(); onApptClick(a) }}
                      title={`${a.pacienteNombre} — ${a.fechaHora.slice(11, 16)}${a.medicoNombre ? ` · ${a.medicoNombre}` : ''} · ${a.estado}`}
                      style={{
                        position: 'absolute', left: 2, right: 2,
                        top: `${(minOffset / 60) * 100}%`,
                        minHeight: 20, height: `${heightPct}%`,
                        background: `color-mix(in srgb, ${color} 13%, transparent)`,
                        border: `1px ${est.borderStyle} color-mix(in srgb, ${color} 40%, transparent)`,
                        borderLeft: `3px ${est.borderStyle} ${color}`,
                        borderRadius: 4, padding: '2px 5px',
                        fontSize: 11, color, fontWeight: 500,
                        opacity: est.opacity,
                        textDecoration: est.tachado ? 'line-through' : 'none',
                        overflow: 'hidden', zIndex: 2, cursor: 'pointer',
                      }}
                    >
                      {a.fechaHora.slice(11, 16)} {a.pacienteNombre.split(' ')[0]}
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}

function DayView({ date, appointments, onCellClick, onApptClick, loading }: {
  date: Date
  appointments: Appointment[]
  onCellClick: (hora: string) => void
  onApptClick: (a: Appointment) => void
  loading: boolean
}) {
  const ds = fechaISOLocal(date)
  const dayAppts = appointments.filter(a => a.fechaHora.startsWith(ds)).sort((a, b) => a.fechaHora.localeCompare(b.fechaHora))

  return (
    <div style={{ height: '100%', overflow: 'auto', background: 'var(--s1)', border: '1px solid var(--border)', borderRadius: 12 }}>
      {HOURS.map(h => {
        const hourStr = `${String(h).padStart(2, '0')}:00`
        const cellAppts = dayAppts.filter(a => parseInt(a.fechaHora.slice(11, 13)) === h)
        return (
          <div
            key={h}
            style={{ display: 'flex', borderBottom: '1px solid var(--border)', minHeight: 56, cursor: 'pointer' }}
            {...activable(() => onCellClick(hourStr), { etiqueta: `Agendar a las ${hourStr}` })}
          >
            <div style={{ width: 64, padding: '8px', textAlign: 'right', fontSize: 12, color: 'var(--text3)', borderRight: '1px solid var(--border)', flexShrink: 0 }}>
              {hourStr}
            </div>
            <div style={{ flex: 1, padding: '4px 8px', display: 'flex', flexDirection: 'column', gap: 3 }}>
              {cellAppts.map(a => {
                const est = estiloEstadoCita(a.estado)
                return (
                <div
                  key={a.id}
                  {...activable(() => onApptClick(a), { etiqueta: `Cita de ${a.pacienteNombre} a las ${a.fechaHora.slice(11, 16)}` })}
                  onClick={e => { e.stopPropagation(); onApptClick(a) }}
                  style={{
                    background: 'rgba(61,90,254,0.1)', border: `1px ${est.borderStyle} rgba(61,90,254,0.3)`,
                    borderLeft: `3px ${est.borderStyle} var(--teal)`, borderRadius: 6, padding: '6px 10px',
                    cursor: 'pointer', opacity: est.opacity,
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', textDecoration: est.tachado ? 'line-through' : 'none' }}>
                    <span>{a.fechaHora.slice(11, 16)} — {a.pacienteNombre}</span>
                    <StatusBadge status={a.estado} size="sm" />
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text3)', display: 'flex', alignItems: 'center', gap: 5 }}>
                    <TipoCitaIcon tipo={a.tipo} size={12} /> {APPOINTMENT_TYPE_CONFIG[a.tipo]?.label} · {a.duracion}min
                  </div>
                </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function MonthView({ date, appointments, onDayClick, onApptClick, loading }: {
  date: Date
  appointments: Appointment[]
  onDayClick: (d: Date) => void
  onApptClick: (a: Appointment) => void
  loading: boolean
}) {
  const today = hoyISO()
  const year = date.getFullYear()
  const month = date.getMonth()
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)

  // Start from Monday
  const startOffset = (firstDay.getDay() + 6) % 7
  const totalCells = Math.ceil((lastDay.getDate() + startOffset) / 7) * 7

  const days: (Date | null)[] = []
  for (let i = 0; i < totalCells; i++) {
    const dayNum = i - startOffset + 1
    if (dayNum < 1 || dayNum > lastDay.getDate()) {
      days.push(null)
    } else {
      days.push(new Date(year, month, dayNum, 12))   // mediodía: ver getWeekDates
    }
  }

  const DAY_HEADERS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

  return (
    <div style={{ height: '100%', background: 'var(--s1)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
      {/* Day headers */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid var(--border)' }}>
        {DAY_HEADERS.map(d => (
          <div key={d} style={{ padding: '8px 0', textAlign: 'center', fontSize: 12, fontWeight: 500, color: 'var(--text3)', borderRight: '1px solid var(--border)' }}>
            {d}
          </div>
        ))}
      </div>

      {/* Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', height: 'calc(100% - 37px)', overflow: 'auto' }}>
        {days.map((d, i) => {
          if (!d) return <div key={i} style={{ borderRight: '1px solid var(--border)', borderBottom: '1px solid var(--border)', background: 'var(--bg)', opacity: 0.3 }} />
          const ds = fechaISOLocal(d)
          const isToday = ds === today
          // Ordenado por hora ANTES del slice(0,3): sin esto, el orden del snapshot
          // (no garantizado cronológico) podía ocultar la cita más temprana del día
          // en la vista previa del mes.
          const dayAppts = appointments.filter(a => a.fechaHora.startsWith(ds))
            .sort((a, b) => a.fechaHora.localeCompare(b.fechaHora))
          return (
            <div
              key={i}
              {...activable(() => onDayClick(d), { etiqueta: `Ver el día ${d.getDate()}` })}
              style={{
                borderRight: '1px solid var(--border)', borderBottom: '1px solid var(--border)',
                padding: '6px', cursor: 'pointer', minHeight: 80,
                background: isToday ? 'rgba(61,90,254,0.05)' : 'transparent',
                transition: 'background var(--mov-rapido) var(--mov-curva)',
              }}
              onMouseEnter={e => !isToday && (e.currentTarget.style.background = 'var(--s2)')}
              onMouseLeave={e => !isToday && (e.currentTarget.style.background = 'transparent')}
            >
              <div style={{
                fontSize: 13, fontWeight: isToday ? 700 : 400,
                color: isToday ? 'var(--teal)' : 'var(--text2)',
                background: isToday ? 'var(--teal-glow)' : 'transparent',
                width: 24, height: 24, borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 3,
              }}>
                {d.getDate()}
              </div>
              {dayAppts.slice(0, 3).map(a => (
                <div
                  key={a.id}
                  {...activable(() => onApptClick(a), { etiqueta: `Cita de ${a.pacienteNombre}` })}
                  onClick={e => { e.stopPropagation(); onApptClick(a) }}
                  style={{
                    fontSize: 10, padding: '2px 5px', borderRadius: 3,
                    background: 'var(--nexus-soft)', color: 'var(--teal)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    marginBottom: 2, cursor: 'pointer',
                  }}
                >
                  {a.fechaHora.slice(11, 16)} {a.pacienteNombre.split(' ')[0]}
                </div>
              ))}
              {dayAppts.length > 3 && (
                <div style={{ fontSize: 10, color: 'var(--text3)' }}>+{dayAppts.length - 3} más</div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
