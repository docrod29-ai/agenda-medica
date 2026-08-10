'use client'
/**
 * HOY — la pantalla de inicio del médico.  V10 · HOME-001.
 *
 * ── LO QUE ERA, Y POR QUÉ NO PODÍA QUEDARSE ─────────────────────────────────
 *
 * Era un tablero de KPIs: cuatro tarjetas en fila, cada una con su circulito de
 * icono y su color propio (verde, naranja, rojo, azul), sobre una rejilla
 * `1fr 300px` sin una sola consulta de medios.
 *
 * Tres cosas medidas, no opinadas:
 *
 * 1. **En un teléfono no se apilaba.** `1fr 300px` es fijo: a 390 px de ancho
 *    la columna derecha se salía de la pantalla y quedaba cortada, y el título
 *    «Agenda de hoy» se partía en tres renglones con «Ver todas» metido dentro.
 *    Eso es escritorio encogido, que es exactamente lo que la constitución V10
 *    prohíbe en su regla 39.
 *
 * 2. **El mismo número salía dos veces**: «Citas hoy» en el encabezado y otra
 *    vez en la primera tarjeta. Encabezado duplicado, del detector §9.
 *
 * 3. **«Accesos rápidos» repetía la barra lateral**: calendario, lista de
 *    espera, pacientes y configuración ya están, los cuatro, a un clic en el
 *    menú de la izquierda. Navegación duplicada, del detector §9.
 *
 * ── LO QUE ES AHORA ─────────────────────────────────────────────────────────
 *
 * §14 del charter dice, con estas palabras, que **no se construya un tablero de
 * KPIs genérico para médicos**, y que la pantalla de inicio conteste:
 *
 *     ¿qué pasa hoy? · ¿quién sigue? · ¿qué necesita atención? ·
 *     ¿qué puedo continuar? · ¿qué preparó NexusMED?
 *
 * El orden de la pantalla es ahora ese, por urgencia:
 *
 *   1. **Quién sigue** — la próxima cita, arriba del todo, con su botón de
 *      iniciar consulta.  Es lo único que el médico necesita a las 9:00.
 *   2. **Qué necesita atención** — la cola de pendientes que ya existía.
 *   3. **Qué pasa hoy** — la agenda, a todo el ancho, y el recuento del día
 *      convertido en **una línea de texto** dentro de su encabezado.
 *
 * Las cuatro tarjetas se van.  El recuento sigue estando —no se pierde dato—
 * pero ocupa un renglón en vez de una banda de 130 px, y sólo lleva color lo
 * que **pide una acción hoy**: las citas por confirmar.  Los que no asistieron
 * son un hecho del pasado, y van en gris.
 *
 * ── LO QUE ESTA PANTALLA TODAVÍA NO CONTESTA ────────────────────────────────
 *
 * De las cinco preguntas de §14 quedan dos sin fuente de datos: «qué puedo
 * continuar» (notas en borrador sin firmar) y «qué preparó NexusMED».  No hay
 * hook que las lea.  Quedan declaradas en `agent-state/V10_BACKLOG.json` en vez
 * de rellenarse con algo que parezca la respuesta sin serlo.
 */
import { useMemo, useEffect } from 'react'
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
import { Plus, ChevronRight, CalendarDays, Mic } from 'lucide-react'
import Link from 'next/link'
import { useSearchParams, useRouter } from 'next/navigation'
import { hoyISO, sumarDiasISO } from '@/lib/timezone'
import { resumenDelDia, type ConteoDelDia } from '@/lib/hoy/resumen-del-dia'
import { nombreSaludo } from '@/lib/hoy/saludo'

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

/**
 * Devuelve el PRIMER NOMBRE para saludar según quién está logueado.
 * - Médico/admin: usa config.nombreMedico (nombre del consultorio)
 * - Asistente: usa su displayName de Firebase Auth (lo capturó al registrarse)
 * - Si no hay nada: usa email prefix
 */

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
  const saludo = nombreSaludo(role, config.nombreMedico, user?.displayName, user?.email)

  return (
    <div className="hoy">
      {/* Encabezado — fecha, saludo y la ÚNICA acción primaria de la pantalla.
          El recuento de citas ya no vive aquí: vivía aquí y otra vez en la
          primera tarjeta, y el mismo número dos veces no es jerarquía. */}
      <header className="hoy-head nx-reveal">
        <div>
          <p className="t-overline" style={{ color: 'var(--text3)', textTransform: 'uppercase' }}>{fechaLabel}</p>
          <h1 className="nx-display hoy-saludo">
            {greet()}
            {saludo && <>, <span style={{ fontStyle: 'italic' }}>{saludo}</span></>}
          </h1>
        </div>
        <Link href="/asistente" className="hoy-accion">
          <Button icon={<Plus size={16} />}>Nueva cita</Button>
        </Link>
      </header>

      {/* 1 · ¿QUIÉN SIGUE? — lo primero que hace falta a las nueve de la mañana. */}
      {!loading && stats.prox && <ProxHero appt={stats.prox} />}

      {/* 2 · ¿QUÉ NECESITA ATENCIÓN? — cobros, membresías y citas por confirmar. */}
      <PanelPendientes />

      {/* 3 · ¿QUÉ PASA HOY? — la agenda, a todo el ancho.
          Una sola columna: no hay nada que se pueda salir de la pantalla. */}
      <section className="card" style={{ padding: 0 }}>
        <div className="hoy-bloque-head">
          <div style={{ minWidth: 0 }}>
            <h2 className="hoy-bloque-titulo">Agenda de hoy</h2>
            {!loading && !errorCitas && stats.total > 0 && (
              <ResumenDelDia {...stats} />
            )}
          </div>
          <Link href="/citas" className="hoy-vertodas">
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
            description={stats.manana > 0
              ? `Tu agenda de hoy está libre. Mañana tienes ${stats.manana}.`
              : 'Tu agenda de hoy está libre.'}
            action={<Link href="/asistente"><Button variant="secondary" size="sm" icon={<Plus size={14} />}>Agendar cita</Button></Link>}
          />
        ) : (
          <div>
            {todayAppts.map((a, i) => (
              <AppointmentRow key={a.id} appt={a} isLast={i === todayAppts.length - 1} puedeConsultar={isDoctor} />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

/** El recuento del día en UN RENGLÓN. Las reglas viven —y se prueban— en
 *  `src/lib/hoy/resumen-del-dia.ts`; aquí sólo se pintan. */
function ResumenDelDia(conteo: ConteoDelDia) {
  const partes = resumenDelDia(conteo)
  if (partes.length === 0) return null

  return (
    <p className="hoy-resumen">
      {partes.map((p, i) => (
        <span key={p.texto}>
          {i > 0 && <span className="hoy-resumen-sep" aria-hidden="true">·</span>}
          <span className={p.alerta ? 'hoy-resumen-alerta' : undefined}>{p.texto}</span>
        </span>
      ))}
    </p>
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
    <div
      className="cita-fila"
      style={{
        borderBottom: isLast ? 'none' : '1px solid var(--border)',
        opacity: isPast ? 0.6 : 1,
      }}
    >
      {/* Área principal: abre la cita */}
      <Link href={`/citas?id=${appt.id}`} className="cita-principal">
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

      {/* Estado y acción. En pantalla estrecha bajan a su propio renglón en vez
          de aplastar el nombre del paciente hasta dejarlo en dos letras. */}
      <div className="cita-acciones">
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
    <div className="prox-hero nx-reveal" style={{ animationDelay: '120ms' }}>
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
