'use client'
import { useMemo, useState, useEffect } from 'react'
import { useAppointments } from '@/hooks/useAppointments'
import { useConfig } from '@/hooks/useConfig'
import { useAuth } from '@/hooks/useAuth'
import { useClinic } from '@/context/ClinicContext'
import { useMode } from '@/context/ModeContext'
import { useToast } from '@/context/ToastContext'
import { StatusBadge } from '@/components/StatusBadge'
import { Appointment, APPOINTMENT_TYPE_CONFIG } from '@/types'
import { formatDateMX } from '@/lib/availability'
import { Plus, TrendingUp, CalendarCheck2, Clock, UserX, ChevronRight, CalendarDays } from 'lucide-react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

function tomorrowStr() {
  const d = new Date(); d.setDate(d.getDate() + 1)
  return d.toISOString().slice(0, 10)
}

function greet() {
  const h = new Date().getHours()
  if (h < 12) return 'Buenos días'
  if (h < 19) return 'Buenas tardes'
  return 'Buenas noches'
}

/** Quita "Dr.", "Dra.", "Dr ", "Dra " del inicio del nombre — evita el "Dr. Dr." duplicado */
function quitarPrefijoDr(nombre: string): string {
  return nombre.replace(/^Dr\.?\s+|^Dra\.?\s+/i, '').trim()
}

/**
 * Devuelve el PRIMER NOMBRE para saludar según quién está logueado.
 * - Médico/admin: usa config.nombreMedico (nombre del consultorio)
 * - Asistente: usa su displayName de Firebase Auth (lo capturó al registrarse)
 * - Si no hay nada: usa email prefix
 */
function nombreSaludo(
  role: string | null,
  nombreMedico?: string,
  displayName?: string | null,
  email?: string | null,
): string {
  const esMedico = role === 'medico' || role === 'admin'
  if (esMedico && nombreMedico) {
    return quitarPrefijoDr(nombreMedico).split(' ')[0]
  }
  if (displayName) return displayName.split(' ')[0]
  if (email) return email.split('@')[0]
  return ''
}

export default function DashboardPage() {
  const { appointments, loading } = useAppointments()
  const { config } = useConfig()
  const { user } = useAuth()
  const { role } = useClinic()
  const { toast } = useToast()
  const searchParams = useSearchParams()

  useEffect(() => {
    const checkout = searchParams.get('checkout')
    const plan = searchParams.get('plan')
    if (checkout === 'success') {
      toast(`¡Plan ${plan ? plan.charAt(0).toUpperCase() + plan.slice(1) : ''} activado! Bienvenido 🎉`, 'success')
    } else if (checkout === 'cancelled') {
      toast('Pago cancelado. Puedes activar tu plan cuando quieras.', 'info')
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const { isDoctor } = useMode()
  const [showNewModal, setShowNewModal] = useState(false)

  const today = todayStr()
  const tomorrow = tomorrowStr()

  const todayAppts = useMemo(() =>
    appointments.filter(a => a.fechaHora.startsWith(today)).sort((a, b) => a.fechaHora.localeCompare(b.fechaHora)),
    [appointments, today]
  )

  const stats = useMemo(() => {
    const ta = todayAppts
    const confirmadas = ta.filter(a => ['confirmada', 'en-sala', 'en-consulta', 'atendida', 'finalizada'].includes(a.estado)).length
    const pendientes = ta.filter(a => ['solicitada', 'pendiente-confirmar', 'pendiente-datos', 'recordatorio-enviado'].includes(a.estado)).length
    const noShow = ta.filter(a => a.estado === 'no-asistio').length
    const canceladas = ta.filter(a => a.estado === 'cancelada').length
    const manana = appointments.filter(a => a.fechaHora.startsWith(tomorrow)).length
    const prox = todayAppts.find(a => {
      if (['cancelada', 'reagendada', 'no-asistio', 'finalizada'].includes(a.estado)) return false
      return a.fechaHora >= `${today} ${new Date().toTimeString().slice(0, 5)}`
    }) ?? null
    return { total: ta.length, confirmadas, pendientes, noShow, canceladas, manana, prox }
  }, [todayAppts, appointments, today, tomorrow])

  const now = new Date()
  const fechaLabel = now.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <div style={{ padding: '28px 24px', maxWidth: 1100, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28, gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', margin: 0 }}>
            {greet()}{nombreSaludo(role, config.nombreMedico, user?.displayName, user?.email) ? `, ${nombreSaludo(role, config.nombreMedico, user?.displayName, user?.email)}` : ''} 👋
          </h1>
          <p style={{ fontSize: 14, color: 'var(--text2)', marginTop: 4 }}>
            {fechaLabel.charAt(0).toUpperCase() + fechaLabel.slice(1)}
          </p>
        </div>
        <Link href="/asistente">
          <button className="btn btn-primary">
            <Plus size={16} /> Nueva cita
          </button>
        </Link>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginBottom: 28 }}>
        <KpiCard
          icon={<CalendarDays size={20} color="var(--teal)" />}
          label="Citas hoy"
          value={loading ? '…' : String(stats.total)}
          sub={stats.manana > 0 ? `${stats.manana} mañana` : ''}
          accentColor="var(--teal)"
        />
        <KpiCard
          icon={<CalendarCheck2 size={20} color="#22c55e" />}
          label="Confirmadas"
          value={loading ? '…' : String(stats.confirmadas)}
          sub={stats.total > 0 ? `${Math.round((stats.confirmadas / stats.total) * 100)}%` : '—'}
          accentColor="#22c55e"
        />
        <KpiCard
          icon={<Clock size={20} color="#fb923c" />}
          label="Pendientes"
          value={loading ? '…' : String(stats.pendientes)}
          sub="por confirmar"
          accentColor="#fb923c"
        />
        <KpiCard
          icon={<UserX size={20} color="#ef4444" />}
          label="No asistieron"
          value={loading ? '…' : String(stats.noShow)}
          sub={stats.canceladas > 0 ? `+ ${stats.canceladas} canceladas` : ''}
          accentColor="#ef4444"
        />
      </div>

      {/* Body grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 20 }}>
        {/* Today's appointments */}
        <div className="card" style={{ padding: 0 }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h2 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', margin: 0 }}>
              Agenda de hoy
            </h2>
            <Link href="/citas" style={{ fontSize: 13, color: 'var(--teal)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 3 }}>
              Ver todas <ChevronRight size={14} />
            </Link>
          </div>
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text3)', fontSize: 14 }}>
              Cargando citas…
            </div>
          ) : todayAppts.length === 0 ? (
            <div style={{ padding: 48, textAlign: 'center' }}>
              <CalendarDays size={40} color="var(--text3)" style={{ margin: '0 auto 12px' }} />
              <p style={{ color: 'var(--text3)', fontSize: 14, margin: 0 }}>Sin citas hoy</p>
              <Link href="/asistente">
                <button className="btn btn-secondary btn-sm" style={{ marginTop: 12 }}>
                  <Plus size={14} /> Agendar cita
                </button>
              </Link>
            </div>
          ) : (
            <div>
              {todayAppts.map((a, i) => (
                <AppointmentRow key={a.id} appt={a} isLast={i === todayAppts.length - 1} />
              ))}
            </div>
          )}
        </div>

        {/* Right panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Next appointment */}
          <div className="card">
            <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text2)', margin: '0 0 12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Próxima consulta
            </h3>
            {stats.prox ? (
              <NextAppointment appt={stats.prox} />
            ) : (
              <p style={{ fontSize: 13, color: 'var(--text3)', margin: 0 }}>No hay más citas hoy</p>
            )}
          </div>

          {/* Quick links */}
          <div className="card">
            <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text2)', margin: '0 0 12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Accesos rápidos
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {[
                { href: '/calendario', label: 'Ver calendario', icon: '📅' },
                { href: '/lista-espera', label: 'Lista de espera', icon: '⏳' },
                { href: '/pacientes', label: 'Pacientes', icon: '👥' },
                { href: '/configuracion', label: 'Configuración', icon: '⚙️' },
              ].map(item => (
                <Link key={item.href} href={item.href} style={{ textDecoration: 'none' }}>
                  <div className="nav-item" style={{ padding: '8px 10px', borderRadius: 8 }}>
                    <span>{item.icon}</span>
                    <span style={{ fontSize: 13 }}>{item.label}</span>
                    <ChevronRight size={14} style={{ marginLeft: 'auto', color: 'var(--text3)' }} />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function KpiCard({ icon, label, value, sub, accentColor }: {
  icon: React.ReactNode
  label: string
  value: string
  sub?: string
  accentColor: string
}) {
  return (
    <div className="kpi-card">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span className="kpi-label">{label}</span>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: `${accentColor}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {icon}
        </div>
      </div>
      <div className="kpi-value">{value}</div>
      {sub && <div className="kpi-delta neutral">{sub}</div>}
    </div>
  )
}

function AppointmentRow({ appt, isLast }: { appt: Appointment; isLast: boolean }) {
  const hora = appt.fechaHora.slice(11, 16)
  const typeCfg = APPOINTMENT_TYPE_CONFIG[appt.tipo]
  const isPast = ['finalizada', 'atendida', 'cancelada', 'no-asistio'].includes(appt.estado)

  return (
    <Link href={`/citas?id=${appt.id}`} style={{ textDecoration: 'none' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 14, padding: '12px 20px',
        borderBottom: isLast ? 'none' : '1px solid var(--border)',
        cursor: 'pointer', opacity: isPast ? 0.6 : 1,
        transition: 'background 0.1s',
      }}
        onMouseEnter={e => (e.currentTarget.style.background = 'var(--s2)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
      >
        {/* Time */}
        <div style={{ width: 44, textAlign: 'center', flexShrink: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>{hora}</div>
          <div style={{ fontSize: 10, color: 'var(--text3)' }}>{appt.duracion}min</div>
        </div>

        {/* Avatar */}
        <div style={{
          width: 36, height: 36, borderRadius: '50%', background: 'var(--s2)',
          border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 14, fontWeight: 600, color: 'var(--text2)', flexShrink: 0,
        }}>
          {appt.pacienteNombre.charAt(0).toUpperCase()}
        </div>

        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {appt.pacienteNombre}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text3)' }}>
            {typeCfg?.icon} {typeCfg?.label}
            {appt.motivo ? ` · ${appt.motivo}` : ''}
          </div>
        </div>

        {/* Status */}
        <StatusBadge status={appt.estado} size="sm" />
      </div>
    </Link>
  )
}

function NextAppointment({ appt }: { appt: Appointment }) {
  const hora = appt.fechaHora.slice(11, 16)
  const typeCfg = APPOINTMENT_TYPE_CONFIG[appt.tipo]
  const now = new Date()
  const [h, m] = hora.split(':').map(Number)
  const apptTime = new Date(); apptTime.setHours(h, m, 0, 0)
  const diffMin = Math.round((apptTime.getTime() - now.getTime()) / 60000)

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <div style={{
          width: 40, height: 40, borderRadius: '50%', background: 'var(--teal-glow)',
          border: '1px solid rgba(0,212,168,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 16, fontWeight: 700, color: 'var(--teal)',
        }}>
          {appt.pacienteNombre.charAt(0).toUpperCase()}
        </div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{appt.pacienteNombre}</div>
          <div style={{ fontSize: 12, color: 'var(--text3)' }}>{typeCfg?.icon} {typeCfg?.label}</div>
        </div>
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--teal)', marginBottom: 4 }}>{hora} hrs</div>
      {diffMin > 0 && (
        <div style={{ fontSize: 12, color: 'var(--text3)' }}>
          En {diffMin < 60 ? `${diffMin} min` : `${Math.round(diffMin / 60)}h ${diffMin % 60}min`}
        </div>
      )}
      <StatusBadge status={appt.estado} size="sm" />
    </div>
  )
}
