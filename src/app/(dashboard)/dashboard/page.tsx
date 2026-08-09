'use client'
import { useMemo, useState, useEffect } from 'react'
import { PanelPendientes } from '@/components/PanelPendientes'
import { useAppointments } from '@/hooks/useAppointments'
import { useConfig } from '@/hooks/useConfig'
import { useAuth } from '@/hooks/useAuth'
import { useClinic } from '@/context/ClinicContext'
import { useMode } from '@/context/ModeContext'
import { useToast } from '@/context/ToastContext'
import { StatusBadge } from '@/components/StatusBadge'
import { TipoCitaIcon } from '@/components/TipoCitaIcon'
import { Button, EmptyState, Spinner } from '@/components/ui'
import { avatarColor } from '@/lib/avatar-color'
import { Appointment, APPOINTMENT_TYPE_CONFIG } from '@/types'
import { formatDateMX } from '@/lib/availability'
import { Plus, CalendarCheck2, Clock, UserX, ChevronRight, CalendarDays, Users, Settings, Hourglass, Mic } from 'lucide-react'
import Link from 'next/link'
import { useSearchParams, useRouter } from 'next/navigation'
import { hoyISO, sumarDiasISO } from '@/lib/timezone'

function todayStr() {
  return hoyISO()  // zona MX, no UTC
}

function tomorrowStr() {
  return sumarDiasISO(hoyISO(), 1)
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
  const { appointments, loading, error: errorCitas } = useAppointments()
  const { config } = useConfig()
  const { user } = useAuth()
  const { role } = useClinic()
  const { toast } = useToast()
  const searchParams = useSearchParams()

  useEffect(() => {
    const checkout = searchParams.get('checkout')
    const plan = searchParams.get('plan')
    if (checkout === 'success') {
      toast(`¡Plan ${plan ? plan.charAt(0).toUpperCase() + plan.slice(1) : ''} activado! Bienvenido`, 'success')
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

  // Tendencia real de citas en los últimos 7 días (para el sparkline del hero)
  const trend7 = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = sumarDiasISO(today, i - 6)
      return appointments.filter(a => a.fechaHora.startsWith(d) && !['cancelada', 'no-asistio'].includes(a.estado)).length
    })
  }, [appointments, today])

  const now = new Date()
  const fechaLabel = now.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <div style={{ padding: '28px 24px', maxWidth: 1100, margin: '0 auto' }}>
      {/* Hero — saludo editorial + métrica del día con tendencia real */}
      <div className="nx-reveal" style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 28, gap: 20, flexWrap: 'wrap' }}>
        <div>
          <p className="t-overline" style={{ color: 'var(--text3)', textTransform: 'uppercase' }}>{fechaLabel}</p>
          <h1 className="nx-display" style={{ fontSize: 32, color: 'var(--text)', margin: '7px 0 0', fontWeight: 500, lineHeight: 1.1 }}>
            {greet()}
            {nombreSaludo(role, config.nombreMedico, user?.displayName, user?.email) && (
              <>, <span style={{ fontStyle: 'italic' }}>{nombreSaludo(role, config.nombreMedico, user?.displayName, user?.email)}</span></>
            )}
          </h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 20, flexWrap: 'wrap' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 12, color: 'var(--text3)' }}>Citas hoy</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, justifyContent: 'flex-end', marginTop: 2 }}>
              <span className="nx-display" style={{ fontSize: 34, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{loading ? '…' : stats.total}</span>
              {!loading && <Sparkline data={trend7} />}
            </div>
          </div>
          <Link href="/asistente">
            <Button icon={<Plus size={16} />}>Nueva cita</Button>
          </Link>
        </div>
      </div>

      {/* Workflow Orchestrator: "siguiente acción" — lo que necesita atención hoy,
          unificado (cobros pendientes, membresías vencidas, citas por confirmar). */}
      <PanelPendientes />

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(180px, 100%), 1fr))', gap: 14, marginBottom: 28 }}>
        <KpiCard delay={40}
          icon={<CalendarDays size={20} color="var(--teal)" />}
          label="Citas hoy"
          value={loading ? '…' : String(stats.total)}
          sub={stats.manana > 0 ? `${stats.manana} mañana` : ''}
          accentColor="var(--teal)"
        />
        <KpiCard delay={100}
          icon={<CalendarCheck2 size={20} color="var(--green)" />}
          label="Confirmadas"
          value={loading ? '…' : String(stats.confirmadas)}
          sub={stats.total > 0 ? `${Math.round((stats.confirmadas / stats.total) * 100)}%` : '—'}
          accentColor="#22C55E"
        />
        <KpiCard delay={160}
          icon={<Clock size={20} color="#FB923C" />}
          label="Pendientes"
          value={loading ? '…' : String(stats.pendientes)}
          sub="por confirmar"
          accentColor="#FB923C"
        />
        <KpiCard delay={220}
          icon={<UserX size={20} color="var(--red)" />}
          label="No asistieron"
          value={loading ? '…' : String(stats.noShow)}
          sub={stats.canceladas > 0 ? `+ ${stats.canceladas} canceladas` : ''}
          accentColor="#EF4444"
        />
      </div>

      {/* Próxima cita — banda protagonista (Dirección A) */}
      {!loading && stats.prox && <ProxHero appt={stats.prox} />}

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
            <Spinner center label="Cargando citas…" />
          ) : errorCitas ? (
            /* «Tu agenda de hoy está libre» con la red caída es la frase más
               peligrosa de esta pantalla: el médico la lee y se va. */
            <EmptyState
              icon={<CalendarDays size={22} />}
              title="No se pudo cargar la agenda"
              description="No es que no tengas citas: no se pudieron leer. Revisa tu conexión."
              action={<Button variant="secondary" size="sm" onClick={() => window.location.reload()}>Reintentar</Button>}
            />
          ) : todayAppts.length === 0 ? (
            <EmptyState
              icon={<CalendarDays size={22} />}
              title="Sin citas hoy"
              description="Tu agenda de hoy está libre."
              action={<Link href="/asistente"><Button variant="secondary" size="sm" icon={<Plus size={14} />}>Agendar cita</Button></Link>}
            />
          ) : (
            <div>
              {todayAppts.map((a, i) => (
                <AppointmentRow key={a.id} appt={a} isLast={i === todayAppts.length - 1} puedeConsultar={isDoctor} />
              ))}
            </div>
          )}
        </div>

        {/* Right panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Quick links */}
          <div className="card">
            <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text2)', margin: '0 0 12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Accesos rápidos
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {[
                { href: '/calendario', label: 'Ver calendario', icon: <CalendarDays size={15} /> },
                { href: '/lista-espera', label: 'Lista de espera', icon: <Hourglass size={15} /> },
                { href: '/pacientes', label: 'Pacientes', icon: <Users size={15} /> },
                { href: '/configuracion', label: 'Configuración', icon: <Settings size={15} /> },
              ].map(item => (
                <Link key={item.href} href={item.href} style={{ textDecoration: 'none' }}>
                  <div className="nav-item" style={{ padding: '8px 10px', borderRadius: 8 }}>
                    <span style={{ display: 'inline-flex', color: 'var(--text3)' }}>{item.icon}</span>
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

function KpiCard({ icon, label, value, sub, accentColor, delay = 0 }: {
  icon: React.ReactNode
  label: string
  value: string
  sub?: string
  accentColor: string
  delay?: number
}) {
  return (
    <div className="kpi-card nx-reveal" style={{ animationDelay: `${delay}ms` }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span className="kpi-label">{label}</span>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: `color-mix(in srgb, ${accentColor} 9%, transparent)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {icon}
        </div>
      </div>
      <div className="kpi-value">{value}</div>
      {sub && <div className="kpi-delta neutral">{sub}</div>}
    </div>
  )
}

/** Sparkline minimal de la tendencia real (sin librerías). */
function Sparkline({ data, color = 'var(--nexus)' }: { data: number[]; color?: string }) {
  const w = 72, h = 26
  const max = Math.max(1, ...data)
  const pts = data.map((v, i) => {
    const x = data.length > 1 ? (i / (data.length - 1)) * w : 0
    const y = h - (v / max) * (h - 5) - 3
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')
  return (
    <svg className="nx-spark" width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
      <polyline points={pts} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function AppointmentRow({ appt, isLast, puedeConsultar }: { appt: Appointment; isLast: boolean; puedeConsultar: boolean }) {
  const router = useRouter()
  const hora = appt.fechaHora.slice(11, 16)
  const typeCfg = APPOINTMENT_TYPE_CONFIG[appt.tipo]
  const isPast = ['finalizada', 'atendida', 'cancelada', 'no-asistio'].includes(appt.estado)
  // Se puede arrancar la consulta directo desde la agenda si eres médico, la cita
  // tiene paciente y aún no se atendió. Antes había que ir a Citas → abrir la
  // cita → Expediente → Nueva consulta: cuatro saltos cada mañana, por paciente.
  const puedeIniciar = puedeConsultar && !isPast && !!appt.pacienteId

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 14, padding: '12px 20px',
      borderBottom: isLast ? 'none' : '1px solid var(--border)',
      opacity: isPast ? 0.6 : 1, transition: 'background 0.1s',
    }}
      onMouseEnter={e => (e.currentTarget.style.background = 'var(--s2)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
    >
      {/* Área principal: abre la cita */}
      <Link href={`/citas?id=${appt.id}`} style={{ textDecoration: 'none', flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{ width: 44, textAlign: 'center', flexShrink: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>{hora}</div>
          <div style={{ fontSize: 10, color: 'var(--text3)' }}>{appt.duracion}min</div>
        </div>
        <div style={{
          width: 36, height: 36, borderRadius: '50%',
          background: avatarColor(appt.pacienteNombre).bg, color: avatarColor(appt.pacienteNombre).fg,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 14, fontWeight: 600, flexShrink: 0,
        }}>
          {appt.pacienteNombre.charAt(0).toUpperCase()}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {appt.pacienteNombre}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text3)', display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
            <TipoCitaIcon tipo={appt.tipo} size={12} /> {typeCfg?.label}
            {appt.motivo ? ` · ${appt.motivo}` : ''}
          </div>
        </div>
      </Link>

      <StatusBadge status={appt.estado} size="sm" />

      {puedeIniciar && (
        <button
          title="Iniciar consulta con este paciente"
          onClick={() => router.push(`/consulta/${appt.pacienteId}`)}
          className="btn btn-primary btn-sm"
          style={{ flexShrink: 0, gap: 6 }}
        >
          <Mic size={14} /> Consulta
        </button>
      )}
    </div>
  )
}

function ProxHero({ appt }: { appt: Appointment }) {
  const hora = appt.fechaHora.slice(11, 16)
  const typeCfg = APPOINTMENT_TYPE_CONFIG[appt.tipo]
  const [h, m] = hora.split(':').map(Number)
  const apptTime = new Date(); apptTime.setHours(h, m, 0, 0)
  const diffMin = Math.round((apptTime.getTime() - Date.now()) / 60000)
  const cuando = diffMin <= 0 ? 'en curso' : diffMin < 60 ? `en ${diffMin} min` : `en ${Math.floor(diffMin / 60)}h ${diffMin % 60}min`

  return (
    <div className="prox-hero nx-reveal" style={{ animationDelay: '180ms', marginBottom: 22 }}>
      <div className="prox-hero-avatar">{appt.pacienteNombre.charAt(0).toUpperCase()}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="t-overline" style={{ color: 'var(--nexus)' }}>Próxima cita · {cuando}</div>
        <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {appt.pacienteNombre}
        </div>
        <div style={{ fontSize: 13, color: 'var(--text2)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span className="t-num" style={{ fontWeight: 600, color: 'var(--text)' }}>{hora}</span>
          <span style={{ color: 'var(--text3)' }}>·</span>
          <TipoCitaIcon tipo={appt.tipo} size={13} /> {typeCfg?.label}
          {appt.lugar ? <span style={{ color: 'var(--text3)' }}>· {appt.lugar}</span> : null}
        </div>
      </div>
      <Link href={`/consulta/${appt.pacienteId}`} style={{ textDecoration: 'none', flexShrink: 0 }}>
        <button className="prox-hero-cta"><Mic size={16} /> Iniciar consulta</button>
      </Link>
    </div>
  )
}
