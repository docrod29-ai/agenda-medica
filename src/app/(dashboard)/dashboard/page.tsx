'use client'
/**
 * HOY — la pantalla de inicio del médico.  V10 · HOME-001 → V15 · TODAY-001.
 *
 * ── LO QUE ERA EN V10, PARA NO REPETIRLO ────────────────────────────────────
 *
 * Un tablero de KPIs (cuatro tarjetas con circulito de icono sobre una rejilla
 * `1fr 300px` fija) que no se apilaba en teléfono, repetía «Citas hoy» dos
 * veces y duplicaba la barra lateral con «Accesos rápidos». El detalle de esa
 * medición vive en `src/__tests__/la-pantalla-de-hoy-no-es-un-tablero.test.ts`,
 * que sigue vigente: esta pantalla NO vuelve a ser eso.
 *
 * ── EL MODELO DE ZONAS DE V15 (§6 del master loop) ──────────────────────────
 *
 * `docs/ai/NEXUSMED_MASTER_LOOP_V15_STRUCTURAL_UIUX_REARCHITECTURE.md` pide
 * que Hoy sea un lienzo operativo, no un dashboard, con cinco zonas. Por orden
 * de urgencia real —lo que hace falta a las nueve de la mañana antes que lo
 * que puede esperar a media tarde—, quedan así en esta pantalla:
 *
 *   1. **NOW** (`ProxHero`) — quién sigue: la próxima/actual cita, con su
 *      botón de iniciar consulta.
 *   2. **NEEDS ATTENTION** (`PanelPendientes`) — cobros, membresías y citas
 *      por confirmar de HOY. Fuente: `src/lib/workflow.ts`.
 *   3. **TODAY** (sección «Agenda de hoy») — el horario del día, de arriba
 *      abajo, con el recuento en una línea de texto.
 *   4. **CONTINUITY** (`ContinuidadPanel`) — lo que cruzó de una consulta
 *      anterior y sigue sin cerrarse: resultado por revisar, seguimiento,
 *      reconciliación de medicamento. Fuente: `tareasVivas()` de
 *      `src/lib/tareas-clinicas/firestore.ts` — la MISMA que usa `/pendientes`,
 *      no una copia. Nuevo en V15-TODAY-001.
 *
 * **PREPARED BY NEXUS queda deliberadamente sin construir esta corrida.** No
 * existe todavía un hook que lea «contexto preparado para el próximo
 * paciente» — ni en `src/lib` ni en `src/hooks`. Inventar uno para llenar la
 * quinta zona sería fabricar una fuente de verdad nueva fuera de la fase que
 * le corresponde (V15-PATIENT-WORKSPACE-001, Fase 4, es dueña de qué significa
 * «paciente actual»). Se declara aquí, no se rellena con un placeholder — el
 * mismo criterio que ya usó `InstrumentStrip` para «paciente actual».
 */
import { useMemo, useEffect } from 'react'
import { PanelPendientes } from '@/components/PanelPendientes'
import { ContinuidadPanel } from '@/components/ContinuidadPanel'
import { useAppointments } from '@/hooks/useAppointments'
import { useConfig } from '@/hooks/useConfig'
import { useAuth } from '@/hooks/useAuth'
import { useClinic } from '@/context/ClinicContext'
import { useMode } from '@/context/ModeContext'
import { useToast } from '@/context/ToastContext'
import { StatusBadge } from '@/components/StatusBadge'
import { TipoCitaIcon } from '@/components/TipoCitaIcon'
import { Button, ButtonLink, EmptyState, Spinner } from '@/components/ui'
import { avatarColor } from '@/lib/avatar-color'
import { Appointment, APPOINTMENT_TYPE_CONFIG } from '@/types'
import { Plus, ChevronRight, CalendarDays, Mic } from 'lucide-react'
import Link from 'next/link'
import { useSearchParams, useRouter } from 'next/navigation'
import { hoyISO, sumarDiasISO } from '@/lib/timezone'
import { resumenDelDia, type ConteoDelDia } from '@/lib/hoy/resumen-del-dia'
import { nombreSaludo } from '@/lib/hoy/saludo'
import { navegarConContinuidad, esClickDeNavegacionSimple } from '@/lib/ui/continuidad'

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
    <div className="nx-canvas hoy">
      {/* Encabezado — fecha y saludo como KICKER, y SIN ninguna acción.

          RTC-06 ya había bajado «Nueva cita» de primaria a secundaria. No
          bastaba, y la medición de anatomía §29 dijo por qué: seguía siendo
          **la primera acción consecuente de la pantalla, a 8px**. O sea que lo
          primero que Hoy ofrecía hacer era crear una cita — administración —
          por delante de todo el trabajo clínico vivo. Bajarla de peso no
          cambia el orden; sólo cambiarla de sitio lo cambia.

          Ahora vive en el bloque de la AGENDA, que es de lo que habla: sigue a
          un gesto, y ya no compite con el paciente que sigue. La primera
          acción consecuente de Hoy es clínica.

          El recuento de citas tampoco vive aquí: vivía aquí y otra vez en la
          primera tarjeta, y el mismo número dos veces no es jerarquía. */}
      <header className="hoy-head nx-reveal">
        <div>
          <p className="t-overline" style={{ color: 'var(--text3)', textTransform: 'uppercase' }}>{fechaLabel}</p>
          <h1 className="hoy-saludo">
            {greet()}
            {saludo && <>, <span style={{ fontStyle: 'italic' }}>{saludo}</span></>}
          </h1>
        </div>
      </header>

      {/* 1 · ¿QUIÉN SIGUE? — lo primero que hace falta a las nueve de la mañana. */}
      {!loading && stats.prox && <ProxHero appt={stats.prox} />}

      {/* 2 · ¿QUÉ NECESITA ATENCIÓN? — cobros, membresías y citas por confirmar. */}
      <PanelPendientes />

      {/* 3 · ¿QUÉ PASA HOY? — la agenda, a todo el ancho.
          Una sola columna: no hay nada que se pueda salir de la pantalla. */}
      <section className="hoy-bloque">
        <div className="hoy-bloque-head">
          <div style={{ minWidth: 0 }}>
            <h2 className="hoy-bloque-titulo">Agenda de hoy</h2>
            {!loading && !errorCitas && stats.total > 0 && (
              <ResumenDelDia {...stats} />
            )}
          </div>
          <div className="hoy-bloque-acciones">
            {/* Agendar es trabajo de la AGENDA, y por eso vive en su bloque y
                no en la cabecera clínica de la pantalla. Sigue a un gesto. */}
            <ButtonLink href="/asistente" variant="ghost" size="sm" icon={<Plus size={14} />}>
              Nueva cita
            </ButtonLink>
            <Link href="/citas" className="hoy-vertodas">
              Ver todas <ChevronRight size={14} />
            </Link>
          </div>
        </div>

        {loading ? (
          <Spinner center label="Cargando citas…" />
        ) : errorCitas ? (
          /* «Tu agenda de hoy está libre» con la red caída es la frase más
             peligrosa de esta pantalla: el médico la lee y se va. */
          /* El error SÍ conserva su peso: «tu agenda está libre» con la red
             caída es la frase más peligrosa de esta pantalla, y distinguir
             «no hay» de «no se pudo leer» es la regla 4 de seguridad clínica.
             Lo que se aligera es el vacío de verdad, no el fallo. */
          <EmptyState
            icon={<CalendarDays size={22} />}
            title="No se pudo cargar la agenda"
            description="No es que no tengas citas: no se pudieron leer. Revisa tu conexión."
            action={<Button variant="secondary" size="sm" onClick={() => window.location.reload()}>Reintentar</Button>}
          />
        ) : todayAppts.length === 0 ? (
          <EmptyState
            variante="linea"
            title="Hoy no hay citas."
            description={stats.manana > 0 ? `Mañana tienes ${stats.manana}.` : 'La agenda está libre.'}
            action={<ButtonLink href="/asistente" variant="ghost" size="sm" icon={<Plus size={14} />}>Agendar cita</ButtonLink>}
          />
        ) : (
          <div>
            {todayAppts.map((a, i) => (
              <AppointmentRow key={a.id} appt={a} isLast={i === todayAppts.length - 1} puedeConsultar={isDoctor} />
            ))}
          </div>
        )}
      </section>

      {/* 4 · CONTINUIDAD — lo que cruzó de una consulta anterior. Se pinta
          sola y desaparece sola cuando no hay nada abierto: no es un bloque
          fijo con un estado vacío que ocupe espacio a diario. */}
      <ContinuidadPanel />
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
          {/* VISUAL_DNA §2: la hora habla el rol del riel (.riel-hora, 14/600
              tabular) — el 700 inline de antes pesaba MÁS que el nombre del
              paciente de al lado (14/500), invirtiendo R3: la identidad es el
              elemento dominante de su entrada, no la hora. */}
          <span className="riel-hora">{hora}</span>
          <span className="riel-dur">{appt.duracion}min</span>
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
          {/* R3 (VISUAL_DNA §2): la identidad encabeza la entrada como
              .nx-ident y ENVUELVE — el ellipsis de antes truncaba justo el
              nombre del paciente (§24), la misma familia que ya murió en las
              filas de /pacientes y en el Patient Anchor. */}
          <span className="nx-ident" style={{ display: 'block' }}>
            {appt.pacienteNombre}
          </span>
          <div className="nx-meta" style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
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
            onClick={(e) => {
              /* §20: el nombre del paciente de ESTA fila es el objeto que la
                 view transition lleva hasta el encabezado de la consulta —
                 el mismo objeto ganando detalle, no dos pantallas sueltas. */
              const origen = e.currentTarget.closest('.cita-fila')?.querySelector<HTMLElement>('.nx-ident') ?? null
              navegarConContinuidad(() => router.push(`/consulta/${appt.pacienteId}`), origen)
            }}
            /* RTC-06: secundario a propósito — la acción existe en CADA fila
               (misma conducta), pero el único relleno primario de la pantalla
               es el CTA del héroe: la cita INMINENTE. Siete rellenos idénticos
               era la jerarquía diciendo que nada importa más que nada. */
            className="btn btn-secondary btn-sm"
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
  const router = useRouter()
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
        {/* R3 (VISUAL_DNA §2): la identidad del héroe NOW es .nx-ident y
            ENVUELVE — el ellipsis truncaba el nombre del paciente (§24). La
            dominancia del héroe la dan su posición, el avatar y el CTA (§16:
            posición antes que contenedor), no un tamaño inventado. */}
        <span className="nx-ident" style={{ display: 'block', marginTop: 3 }}>
          {appt.pacienteNombre}
        </span>
        <div className="nx-meta" style={{ marginTop: 2, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span className="riel-hora" style={{ display: 'inline' }}>{hora}</span>
          <span>·</span>
          <TipoCitaIcon tipo={appt.tipo} size={13} /> {typeCfg?.label}
          {appt.lugar ? <span>· {appt.lugar}</span> : null}
        </div>
      </div>
      {/* La acción PRIMARIA de Hoy. Era un <button> dentro de este <a>: dos
          paradas de teclado para un destino (medido en 1440 y en 390) y HTML
          inválido — `<a>` prohíbe contenido interactivo dentro. Ahora el
          enlace ES el control, y parece un botón porque lo dice la hoja
          (`.prox-hero-cta`, que se llevó también el `text-decoration` y el
          `flex-shrink` que vivían aquí en línea). §24. */}
      <Link
        href={`/consulta/${appt.pacienteId}`}
        className="prox-hero-cta"
        onClick={(e) => {
          /* §20: sólo el click simple se coreografía; Ctrl/Cmd/central siguen
             abriendo pestaña como cualquier enlace. El objeto compartido es el
             nombre del héroe (.nx-ident), que viaja al <h1> de la consulta. */
          if (!esClickDeNavegacionSimple(e)) return
          e.preventDefault()
          const origen = e.currentTarget.closest('.prox-hero')?.querySelector<HTMLElement>('.nx-ident') ?? null
          navegarConContinuidad(() => router.push(`/consulta/${appt.pacienteId}`), origen)
        }}
      >
        <Mic size={16} /> Iniciar consulta
      </Link>
    </div>
  )
}
