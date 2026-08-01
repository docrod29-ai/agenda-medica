'use client'
import { useState, useMemo, useEffect, useRef} from 'react'
import { actualizarContadoresPaciente } from '@/lib/agenda/contadores-paciente'
import { useSearchParams, useRouter } from 'next/navigation'
import { useAppointments } from '@/hooks/useAppointments'
import { useConfig } from '@/hooks/useConfig'
import { useToast } from '@/context/ToastContext'
import { StatusBadge } from '@/components/StatusBadge'
import { calcularRiesgoNoShow, NIVEL_LABEL, NIVEL_COLOR } from '@/lib/no-show-risk'
import { getPatients } from '@/lib/firestore'
import type { Patient } from '@/types'
import { AppointmentModal } from '@/components/AppointmentModal'
import { DoctorFilter, useFiltroMedico, colorMedico } from '@/components/DoctorFilter'
import { CobrarModal } from '@/components/CobrarModal'
import { precioSugerido } from '@/lib/finanzas/precio-consulta'
import { quitarExencion } from '@/lib/cobros'
import { TipoCitaIcon } from '@/components/TipoCitaIcon'
import { useAuth } from '@/hooks/useAuth'
import { Appointment, AppointmentStatus, APPOINTMENT_TYPE_CONFIG } from '@/types'
import { updateAppointment, deleteAppointment } from '@/lib/firestore'
import { useClinic } from '@/context/ClinicContext'
import { openWhatsApp, msgConfirmacion, msgCancelacion, msgRecordatorio24h } from '@/lib/whatsapp'
import {
  Plus, Search, Filter, Trash2, Edit2, MessageSquare,
  ChevronLeft, ChevronRight, CalendarDays, MoreVertical,
  Phone, AlertTriangle, DollarSign, Video, BellRing,
  Stethoscope,
} from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { hoyISO, sumarDiasISO } from '@/lib/timezone'
import { fetchAutenticado } from '@/lib/auth-client'
import { logAudit } from '@/lib/expediente/audit-log'
import { Button, EmptyState, Spinner } from '@/components/ui'
import { AgendaVacia } from '@/components/brand/EmptyArt'
import { useMode } from '@/context/ModeContext'

const STATUS_FILTERS: { label: string; value: AppointmentStatus | 'todas' }[] = [
  { label: 'Todas', value: 'todas' },
  { label: 'Pendientes', value: 'pendiente-confirmar' },
  { label: 'Confirmadas', value: 'confirmada' },
  { label: 'En sala', value: 'en-sala' },
  { label: 'En consulta', value: 'en-consulta' },
  { label: 'Finalizadas', value: 'finalizada' },
  { label: 'Canceladas', value: 'cancelada' },
  { label: 'No asistió', value: 'no-asistio' },
]

function todayStr() {
  return hoyISO()  // zona MX, no UTC
}

function prevDay(d: string) { return sumarDiasISO(d, -1) }
function nextDay(d: string) { return sumarDiasISO(d, 1) }

export default function CitasPage() {
  const params = useSearchParams()
  const router = useRouter()
  const [selectedDate, setSelectedDate] = useState(todayStr())
  // Pide la ventana desde el día que estás viendo: retroceder de día en día
  // sigue trayendo las citas de esas fechas en vez de mostrar el día vacío.
  const { appointments, loading, error: errorCitas } = useAppointments(`${selectedDate} 00:00`)
  const { config } = useConfig()
  const { user } = useAuth()
  const [medicoFiltro, setMedicoFiltro] = useFiltroMedico()
  const [cobrarAppt, setCobrarAppt] = useState<Appointment | null>(null)
  const { clinicId } = useClinic()
  const { toast, confirm } = useToast()
  const [pacientes, setPacientes] = useState<Patient[]>([])

  useEffect(() => {
    if (!clinicId) return
    getPatients(clinicId).then(setPacientes).catch(() => { /* ignore */ })
  }, [clinicId])

  /**
   * "por-cobrar" no es un estado de la cita: es una VISTA. El cobro no lo hace el
   * médico —lo registra la asistente cuando el paciente sale y paga— y hasta ahora
   * no tenía forma de saber a quién le tocaba. Veía la lista completa del día con
   * botón "Cobrar" en todas, incluidas las que ni siquiera habían pasado, y tenía
   * que acordarse de quién ya salió. Esta vista responde su única pregunta:
   * atendidos y todavía sin cobrar.
   */
  const [statusFilter, setStatusFilter] = useState<AppointmentStatus | 'todas' | 'por-cobrar'>('todas')
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editAppt, setEditAppt] = useState<Appointment | null>(null)
  const [menuId, setMenuId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Solo abrir modal cuando es para EDITAR (ya no auto-abre para crear).
  //
  // El `?id=` se quita de la URL en cuanto se abre. Sin eso el modal se reabría
  // solo: `appointments` viene de un onSnapshot en vivo, así que cada cambio
  // volvía a disparar este efecto y el médico no podía cerrarlo.
  const idAbierto = useRef<string | null>(null)
  useEffect(() => {
    const id = params.get('id')
    if (!id || idAbierto.current === id) return
    const found = appointments.find(a => a.id === id)
    if (!found) {
      /**
       * Un enlace a una cita FUERA de la ventana no abría nada y no decía nada.
       *
       * La ventana arranca 120 días atrás, así que cualquier enlace a una cita más
       * antigua caía aquí: la pantalla se quedaba en el día de hoy y el enlace
       * parecía roto. Ahora, una vez cargado, se dice la verdad en vez de
       * quedarse callado.
       */
      if (!loading) {
        idAbierto.current = id
        toast('No encontramos esa cita. Puede ser muy antigua: búscala por fecha.', 'error')
        router.replace('/citas', { scroll: false })
      }
      return
    }
    idAbierto.current = id
    setEditAppt(found)
    setModalOpen(true)
    router.replace('/citas', { scroll: false })
  }, [params, appointments, router, loading, toast])

  // Índice O(1) por id: antes cada fila hacía pacientes.find() lineal → O(filas ×
  // pacientes) en cada tecla del buscador y cada toggle de menú (jank con miles de pacientes).
  const patientById = useMemo(() => new Map(pacientes.map(p => [p.id, p])), [pacientes])

  const filtered = useMemo(() => {
    return appointments.filter(a => {
      if (a.fechaHora.slice(0, 10) !== selectedDate) return false
      if (statusFilter === 'por-cobrar') {
        if (!['atendida', 'finalizada'].includes(a.estado) || a.cobroId || a.cobroExento) return false
      } else if (statusFilter !== 'todas' && a.estado !== statusFilter) return false
      if (search && !a.pacienteNombre.toLowerCase().includes(search.toLowerCase())) return false
      // Filtro multi-doctor: si hay médico seleccionado, solo sus citas
      if (medicoFiltro && a.medicoId !== medicoFiltro) return false
      return true
    }).sort((a, b) => a.fechaHora.localeCompare(b.fechaHora))
  }, [appointments, selectedDate, statusFilter, search, medicoFiltro])

  // Resumen del día (real) — ignora filtros de estado/búsqueda; respeta el de médico
  const daySummary = useMemo(() => {
    const day = appointments.filter(a => a.fechaHora.slice(0, 10) === selectedDate && (!medicoFiltro || a.medicoId === medicoFiltro))
    const conf = day.filter(a => ['confirmada', 'en-sala', 'en-consulta', 'atendida', 'finalizada'].includes(a.estado)).length
    const pend = day.filter(a => ['solicitada', 'pendiente-confirmar', 'pendiente-datos', 'recordatorio-enviado'].includes(a.estado)).length
    const porCobrar = day.filter(a => ['atendida', 'finalizada'].includes(a.estado) && !a.cobroId && !a.cobroExento).length
    return { total: day.length, conf, pend, porCobrar }
  }, [appointments, selectedDate, medicoFiltro])

  // Si el filtro está en "por-cobrar" y ya no queda ninguno (se cobró el último), el
  // chip desaparece pero el filtro se quedaba atascado mostrando "sin citas". Se
  // regresa a "todas" para no dejar la lista vacía con citas que sí existen ese día.
  useEffect(() => {
    if (statusFilter === 'por-cobrar' && daySummary.porCobrar === 0) setStatusFilter('todas')
  }, [statusFilter, daySummary.porCobrar])

  const dateLabel = useMemo(() => {
    const d = new Date(selectedDate + 'T12:00')
    const today = todayStr()
    const tomorrow = nextDay(today)
    if (selectedDate === today) return 'Hoy'
    if (selectedDate === tomorrow) return 'Mañana'
    return format(d, "EEEE d 'de' MMMM", { locale: es })
  }, [selectedDate])

  const handleStatusChange = async (appt: Appointment, newStatus: AppointmentStatus) => {
    try {
      await updateAppointment(clinicId!, appt.id, { estado: newStatus })
      // Contadores del paciente: sin esto, marcar "no asistió" no dejaba rastro y
      // el motor de riesgo de no-show operaba con su señal principal en cero.
      actualizarContadoresPaciente(clinicId!, appt.pacienteId, appt.estado, newStatus, appt.fechaHora)
      /**
       * BITÁCORA. Cancelar una cita desde este menú no dejaba ninguna entrada,
       * mientras que agendar desde el portal público sí la deja. Con dos
       * personas trabajando la misma agenda —médico y asistente— «¿quién canceló
       * esto y cuándo?» no tenía respuesta en ningún sitio.
       */
      logAudit({
        evento: 'cita_estado_cambiado', clinicId: clinicId!, patientId: appt.pacienteId,
        meta: { citaId: appt.id, de: appt.estado, a: newStatus, fechaHora: appt.fechaHora },
      })
      toast(`Estado actualizado: ${newStatus}`, 'success')
      setMenuId(null)
      // Si se liberó el slot (cancelar/no-asistió), avisar a la lista de espera.
      // Antes solo el modal notificaba; las cancelaciones rápidas del dropdown
      // dejaban el hueco sin ofrecer.
      const liberado = ['cancelada', 'reagendada', 'no-asistio'].includes(newStatus) &&
        !['cancelada', 'reagendada', 'no-asistio'].includes(appt.estado)

      /**
       * CANCELAR TAMBIÉN BORRA EL EVENTO DE GOOGLE CALENDAR.
       *
       * El borrado y el modal ya lo hacían; el menú rápido no. Cancelabas desde
       * el "⋮", veías "Estado actualizado" — y en el calendario del paciente la
       * cita seguía viva, sin ninguna marca. Se presentaba al consultorio. Es
       * exactamente el escenario que el comentario de handleDelete dice haber
       * cerrado, y que aquí seguía abierto.
       */
      if (newStatus === 'cancelada' && appt.googleCalendarEventId) {
        try {
          const res = await fetchAutenticado('/api/calendar/sync', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'delete', appointment: appt, clinicId }),
          })
          if (!res.ok) throw new Error('sync')
        } catch {
          toast('La cita se canceló, pero NO se pudo quitar de Google Calendar. El paciente aún la ve: bórrala a mano.', 'error')
        }
      }

      if (liberado) {
        fetchAutenticado('/api/whatsapp/waitlist-notify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fecha: appt.fechaHora.slice(0, 10),
            hora: appt.fechaHora.slice(11, 16),
            clinicId,
            tipo: appt.tipo,
            medicoId: appt.medicoId,   // ofrecer el hueco solo a quien espera con ESE médico
          }),
        }).then(res => {
          if (!res.ok) toast('La cita se actualizó, pero NO se pudo avisar a la lista de espera del hueco libre.', 'error')
        }).catch((e) => {
          console.warn('[waitlist-notify] no se pudo avisar a la lista de espera', e)
          toast('La cita se actualizó, pero NO se pudo avisar a la lista de espera del hueco libre.', 'error')
        })
      }
    } catch {
      toast('Error al actualizar', 'error')
    }
  }

  const handleDelete = async (id: string) => {
    /**
     * Una cita COBRADA no se borra: se cancela.
     *
     * `deleteAppointment` borra el documento y ya. El cobro vive en otra colección
     * con un `citaId` que quedaba apuntando a la nada, y el corte de caja cruza
     * citas × cobros para armar el embudo del día: ese dinero seguía en Finanzas
     * pero su cita ya no existía, así que el corte dejaba de cuadrar sin ninguna
     * explicación visible.
     */
    const aBorrar = appointments.find(a => a.id === id)
    if (aBorrar?.cobroId) {
      toast('Esta cita tiene un cobro registrado. Cámbiala a "cancelada" en vez de borrarla, o el corte de caja no cuadrará.', 'error')
      setMenuId(null)
      return
    }
    /**
     * `confirm` IN-APP, no el nativo.
     *
     * `window.confirm` se ignora EN SILENCIO en una PWA instalada: devuelve false
     * y el borrado simplemente no ocurría, sin ningún mensaje. El médico pulsaba
     * Eliminar y no pasaba nada. El ToastContext ya documenta este motivo y otras
     * pantallas ya usan el confirm propio.
     */
    if (!(await confirm('¿Eliminar esta cita permanentemente?', { peligro: true, confirmar: 'Eliminar' }))) return
    setDeletingId(id)
    const apptBorrada = appointments.find(a => a.id === id)   // capturar antes de borrar (trae el eventId de Google)
    try {
      await deleteAppointment(clinicId!, id)
      /**
       * Borrar DESTRUYE el documento: sin esta entrada no queda ni constancia de
       * que la cita existió. Se registra lo mínimo que permite reconstruir el
       * hecho (a quién, cuándo era, quién la borró) sin volcar datos clínicos.
       */
      logAudit({
        evento: 'cita_borrada', clinicId: clinicId!, patientId: apptBorrada?.pacienteId,
        meta: { citaId: id, fechaHora: apptBorrada?.fechaHora, estado: apptBorrada?.estado },
      })
      // Borrar también el evento en Google Calendar.
      //
      // Antes esto iba con .catch(() => {}) y sin mirar res.ok, y el toast decía
      // "Cita eliminada" pasara lo que pasara: si la sincronización fallaba, el
      // evento seguía vivo en el calendario del PACIENTE, que lo veía en su
      // teléfono y se presentaba al consultorio. Ahora el aviso dice la verdad.
      let calendarioLimpio = true
      if (apptBorrada?.googleCalendarEventId) {
        try {
          const res = await fetchAutenticado('/api/calendar/sync', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'delete', appointment: apptBorrada, clinicId }),
          })
          if (!res.ok) calendarioLimpio = false
        } catch { calendarioLimpio = false }
      }
      if (calendarioLimpio) {
        toast('Cita eliminada', 'info')
      } else {
        toast('Cita eliminada aquí, pero NO se pudo borrar de Google Calendar: el paciente la sigue viendo. Bórrala a mano o avísale.', 'error')
      }
    } catch {
      toast('Error al eliminar', 'error')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div style={{ padding: '24px', maxWidth: 1100, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <h1 className="t-h1" style={{ margin: 0 }}>Citas</h1>
          <DoctorFilter medicoId={medicoFiltro} onChange={setMedicoFiltro} />
        </div>
        <Button icon={<Plus size={16} />} onClick={() => router.push('/asistente')}>Nueva cita</Button>
      </div>

      {/* Date navigator */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, background: 'var(--s1)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px' }}>
        <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setSelectedDate(prevDay(selectedDate))}>
          <ChevronLeft size={16} />
        </button>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', textTransform: 'capitalize' }}>{dateLabel}</span>
          <span style={{ fontSize: 12, color: 'var(--text3)', marginLeft: 8 }}>{selectedDate}</span>
        </div>
        <input
          type="date" value={selectedDate}
          onChange={e => setSelectedDate(e.target.value)}
          style={{ background: 'var(--s2)', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 8px', fontSize: 12, color: 'var(--text2)', cursor: 'pointer' }}
        />
        <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setSelectedDate(nextDay(selectedDate))}>
          <ChevronRight size={16} />
        </button>
        <button className="btn btn-secondary btn-sm" onClick={() => setSelectedDate(todayStr())}>
          Hoy
        </button>
      </div>

      {/* Resumen del día */}
      {!loading && daySummary.total > 0 && (
        <div className="nx-reveal" style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          <DiaChip color="var(--nexus)" value={daySummary.total} label={daySummary.total === 1 ? 'cita' : 'citas'} />
          <DiaChip color="#22c55e" value={daySummary.conf} label="confirmadas" />
          <DiaChip color="#fb923c" value={daySummary.pend} label="pendientes" />
        </div>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: '1 1 200px', maxWidth: 300 }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)' }} />
          <input
            className="input"
            style={{ paddingLeft: 32 }}
            placeholder="Buscar paciente…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {/*
            Va PRIMERO y con su propio contador porque es la única pregunta que la
            asistente se hace todo el día. Si no hay nadie pendiente de cobro no se
            muestra: un cero permanente enseña a ignorar el aviso.
          */}
          {daySummary.porCobrar > 0 && (
            <button
              onClick={() => setStatusFilter(statusFilter === 'por-cobrar' ? 'todas' : 'por-cobrar')}
              className="btn btn-sm"
              style={{
                background: statusFilter === 'por-cobrar' ? 'var(--teal-glow)' : 'var(--s2)',
                color: statusFilter === 'por-cobrar' ? 'var(--teal)' : 'var(--text2)',
                border: `1px solid ${statusFilter === 'por-cobrar' ? 'rgba(61,90,254,0.3)' : 'var(--border)'}`,
                display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              <DollarSign size={13} className="ds-icon" /> Por cobrar
              <span style={{
                background: 'var(--teal)', color: '#fff', borderRadius: 999,
                padding: '1px 6px', fontSize: 11, fontWeight: 600, fontVariantNumeric: 'tabular-nums',
              }}>{daySummary.porCobrar}</span>
            </button>
          )}
          {STATUS_FILTERS.map(f => (
            <button
              key={f.value}
              onClick={() => setStatusFilter(f.value as AppointmentStatus | 'todas')}
              className="btn btn-sm"
              style={{
                background: statusFilter === f.value ? 'var(--teal-glow)' : 'var(--s2)',
                color: statusFilter === f.value ? 'var(--teal)' : 'var(--text2)',
                border: `1px solid ${statusFilter === f.value ? 'rgba(61,90,254,0.3)' : 'var(--border)'}`,
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Count */}
      <div style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 10 }}>
        {filtered.length} cita{filtered.length !== 1 ? 's' : ''}
      </div>

      {/* Table */}
      <div className="card" style={{ padding: 0 }}>
        {loading ? (
          <Spinner center label="Cargando citas…" />
        ) : errorCitas ? (
          /*
            UN FALLO DE CARGA NO PUEDE VERSE COMO «HOY NO HAY NADA».
            El hook ya distinguía las dos cosas y ninguna pantalla leía `error`:
            con la red caída o un permiso denegado, la lista llegaba vacía y aquí
            se pintaba «No hay citas para este filtro». Para este consultorio esa
            pantalla es indistinguible de una pérdida de datos — y el propio hook
            lo tenía escrito en un comentario, para el otro caso.
          */
          <EmptyState
            icon={<CalendarDays size={22} />}
            title="No se pudo cargar la agenda"
            description="Esto NO significa que no tengas citas: no se pudieron leer. Revisa tu conexión y reintenta."
            action={<Button variant="secondary" size="sm" onClick={() => window.location.reload()}>Reintentar</Button>}
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            illustration={<AgendaVacia />}
            icon={<CalendarDays size={22} />}
            title="No hay citas para este filtro"
            description="Cambia de fecha o de médico, o agenda una nueva cita."
            action={<Button icon={<Plus size={16} />} onClick={() => router.push('/asistente')}>Nueva cita</Button>}
          />
        ) : (
          <div>
            {filtered.map((appt, i) => (
              <div key={appt.id} className="nx-reveal" style={{ animationDelay: `${Math.min(i, 12) * 28}ms` }}>
              <AppointmentRowFull
                onConsulta={pid => router.push(`/consulta/${pid}`)}
                appt={appt}
                paciente={patientById.get(appt.pacienteId) ?? null}
                config={config}
                isLast={i === filtered.length - 1}
                menuOpen={menuId === appt.id}
                onMenuToggle={() => setMenuId(menuId === appt.id ? null : appt.id)}
                onEdit={() => { setEditAppt(appt); setModalOpen(true); setMenuId(null) }}
                onDelete={() => { handleDelete(appt.id); setMenuId(null) }}
                onStatusChange={s => handleStatusChange(appt, s)}
                onCobrar={(a) => setCobrarAppt(a)}
                onQuitarCortesia={async (a) => {
                  if (!clinicId) return
                  const ok = await confirm(`¿Quitar la cortesía de ${a.pacienteNombre}? Volverá a aparecer para cobro.`, { confirmar: 'Quitar cortesía' })
                  if (!ok) return
                  try { await quitarExencion(clinicId, a.id); toast('Cortesía quitada; la cita vuelve a cobro', 'info') }
                  catch { toast('No se pudo quitar la cortesía', 'error') }
                }}
                deleting={deletingId === appt.id}
              />
              </div>
            ))}
          </div>
        )}
      </div>

      <AppointmentModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditAppt(null) }}
        appointment={editAppt}
        defaultDate={selectedDate}
        onSaved={() => {}}
      />

      {cobrarAppt && clinicId && user && (
        <CobrarModal
          clinicId={clinicId}
          creadoPor={user.uid}
          prefill={{
            citaId: cobrarAppt.id,
            // estadoActual: para NO retroceder un estado más avanzado (finalizada/
            // pagada) a 'atendida' al cobrar. La consulta ya lo pasaba; Citas no.
            estadoActual: cobrarAppt.estado,
            patientId: cobrarAppt.pacienteId,
            patientNombre: cobrarAppt.pacienteNombre,
            medicoId: cobrarAppt.medicoId,
            medicoNombre: cobrarAppt.medicoNombre,
            concepto: cobrarAppt.tipo === 'teleconsulta' ? 'teleconsulta' : 'consulta',
            /**
             * EL PRECIO, QUE AQUÍ NO LLEGABA.
             *
             * Ésta es la puerta por la que cobra la asistente —la mayoría de los
             * cobros— y el importe abría en blanco. Sin precio tampoco había
             * contra qué restar un abono previo, así que el saldo pendiente no
             * podía enseñarse justo donde más falta hace.
             */
            monto: precioSugerido(config?.preciosPublicos, cobrarAppt.tipo),
          }}
          onClose={() => setCobrarAppt(null)}
          onCobrado={() => setCobrarAppt(null)}
        />
      )}

      {/* Close menu on outside click */}
      {menuId && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9 }} onClick={() => setMenuId(null)} />
      )}
    </div>
  )
}

function DiaChip({ color, value, label }: { color: string; value: number; label: string }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 7,
      background: 'var(--s1)', border: '1px solid var(--border)',
      borderRadius: 99, padding: '7px 13px', fontSize: 13, color: 'var(--text2)',
    }}>
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: color, flexShrink: 0 }} />
      <strong className="t-num" style={{ color: 'var(--text)', fontWeight: 600 }}>{value}</strong> {label}
    </span>
  )
}

function AppointmentRowFull({
  appt, paciente, config, isLast, menuOpen, onMenuToggle, onEdit, onDelete, onStatusChange, onCobrar, onQuitarCortesia, deleting, onConsulta,
}: {
  /** Abre la consulta del paciente. Se recibe del padre para no montar otro router. */
  onConsulta: (pacienteId: string) => void
  appt: Appointment
  paciente: Patient | null
  config: ReturnType<typeof useConfig>['config']
  isLast: boolean
  menuOpen: boolean
  onMenuToggle: () => void
  onEdit: () => void
  onDelete: () => void
  onStatusChange: (s: AppointmentStatus) => void
  onCobrar?: (appt: Appointment) => void
  onQuitarCortesia?: (appt: Appointment) => void
  deleting: boolean
}) {
  const { clinicId: rowClinicId } = useClinic()
  // El ROL, no el modo de pantalla: un médico viendo la app «como secretaria»
  // sigue siendo el médico.
  const { esMedicoReal } = useMode()
  const hora = appt.fechaHora.slice(11, 16)
  const typeCfg = APPOINTMENT_TYPE_CONFIG[appt.tipo]
  // Riesgo de no-show — solo mostrar para citas pendientes/confirmadas (no las ya atendidas)
  const mostrarRiesgo = !['atendida','finalizada','cancelada','no-asistio','pagada'].includes(appt.estado)
  const riesgo = mostrarRiesgo ? calcularRiesgoNoShow(appt, paciente) : null

  const handleWA = () => {
    if (!appt.pacienteTelefono) return
    const msg = msgConfirmacion(appt, config)
    openWhatsApp(appt.pacienteTelefono, msg)
  }

  // Recordatorio "mañana tiene su cita" — abre WhatsApp con el mensaje ya escrito.
  const handleRecordar = () => {
    if (!appt.pacienteTelefono) return
    openWhatsApp(appt.pacienteTelefono, msgRecordatorio24h(appt, config))
  }
  // Cita aún por atender (tiene sentido recordar): no cancelada/atendida/etc.
  const recordable = !['cancelada', 'no-asistio', 'reagendada', 'atendida', 'finalizada', 'pagada'].includes(appt.estado)

  const QUICK_STATUSES: AppointmentStatus[] = ['en-sala', 'en-consulta', 'atendida', 'finalizada', 'cancelada', 'no-asistio']

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 14, padding: '13px 16px',
      borderBottom: isLast ? 'none' : '1px solid var(--border)',
      opacity: deleting ? 0.4 : 1, position: 'relative',
    }}>
      {/* Time */}
      <div style={{ width: 48, textAlign: 'center', flexShrink: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>{hora}</div>
        <div style={{ fontSize: 10, color: 'var(--text3)' }}>{appt.duracion}min</div>
      </div>

      {/* Avatar */}
      <div style={{
        width: 38, height: 38, borderRadius: '50%', background: 'var(--s2)', border: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 600,
        color: 'var(--text2)', flexShrink: 0,
      }}>
        {appt.pacienteNombre.charAt(0).toUpperCase()}
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{appt.pacienteNombre}</div>
          {/* Badge del médico — visible cuando hay multi-doctor */}
          {appt.medicoId && appt.medicoNombre && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              padding: '1px 7px', borderRadius: 100, fontSize: 10.5, fontWeight: 600,
              background: `${colorMedico(appt.medicoId)}22`,
              color: colorMedico(appt.medicoId),
              border: `1px solid ${colorMedico(appt.medicoId)}40`,
            }}>
              {appt.medicoNombre.replace(/^Dr\.?\s+|^Dra\.?\s+/i, '').split(' ')[0]}
            </span>
          )}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text3)', display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
          <TipoCitaIcon tipo={appt.tipo} size={12} /> {typeCfg?.label}
          {appt.motivo ? ` · ${appt.motivo}` : ''}
        </div>
        {appt.pacienteTelefono && (
          <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}><Phone size={11} className="ds-icon" /> {appt.pacienteTelefono}</div>
        )}
      </div>

      {/* Status */}
      <StatusBadge status={appt.estado} size="sm" />

      {/* Riesgo de no-show (solo niveles alto/muy_alto) */}
      {riesgo && (riesgo.nivel === 'alto' || riesgo.nivel === 'muy_alto') && (
        <span
          title={`Riesgo: ${riesgo.score}/100. ${riesgo.recomendacion}`}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 3,
            fontSize: 10, fontWeight: 700,
            background: `${NIVEL_COLOR[riesgo.nivel]}1A`, color: NIVEL_COLOR[riesgo.nivel],
            border: `1px solid ${NIVEL_COLOR[riesgo.nivel]}55`,
            padding: '2px 7px', borderRadius: 100, flexShrink: 0,
          }}>
          <AlertTriangle size={10} className="ds-icon" /> {NIVEL_LABEL[riesgo.nivel]}
        </span>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexShrink: 0 }}>
        {/* Botón Cobrar — no cancelada/no-asistió/reagendada Y sin cobro previo (anti doble cobro) */}
        {appt.estado !== 'cancelada' && appt.estado !== 'no-asistio' && appt.estado !== 'reagendada' && !appt.cobroId && !appt.cobroExento && onCobrar && (
          <button
            onClick={() => onCobrar(appt)}
            title="Registrar cobro"
            style={{
              background: 'rgba(20,184,166,0.15)', color: 'var(--teal)',
              border: '1px solid rgba(20,184,166,0.4)', borderRadius: 6,
              padding: '5px 10px', fontSize: 12, fontWeight: 700, cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', gap: 4,
            }}
          >
            <DollarSign size={13} className="ds-icon" /> Cobrar
          </button>
        )}
        {/* Distintivo de cortesía: el médico decidió no cobrar esta cita. Clic para
            quitarla (vuelve a cobro). Reversible, como promete el modal. */}
        {appt.cobroExento && (
          <button
            onClick={() => onQuitarCortesia?.(appt)}
            title={`${appt.exentoMotivo ? `Cortesía: ${appt.exentoMotivo}` : 'Cortesía (no se cobra)'} · clic para quitar`}
            style={{
              background: 'rgba(168,85,247,0.12)', color: '#a855f7',
              border: '1px solid rgba(168,85,247,0.4)', borderRadius: 6,
              padding: '5px 10px', fontSize: 12, fontWeight: 700, cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap',
            }}
          >
            Cortesía ✕
          </button>
        )}
        {/*
          INICIAR CONSULTA desde la fila de la agenda.
          
          /citas es la pantalla donde el médico ve quién llegó, y NINGUNO de sus
          botones abría el expediente ni la consulta. Para el segundo paciente del
          día y los siguientes había que ir a Pacientes, teclear el nombre, abrir
          el expediente y pulsar "Nueva consulta": 3 clics, 4 pantallas y tecleo,
          por paciente. El atajo de 1 clic solo existía en el dashboard y solo para
          la PRÓXIMA cita.
        */}
        {appt.pacienteId && !['cancelada', 'no-asistio'].includes(appt.estado) && (
          <button
            onClick={e => { e.stopPropagation(); onConsulta(appt.pacienteId) }}
            className="btn btn-sm"
            title="Abrir la consulta de este paciente"
            style={{
              background: 'var(--nexus)', color: '#fff', border: 'none', borderRadius: 6,
              fontSize: 12, fontWeight: 700, cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', gap: 4,
            }}
          >
            <Stethoscope size={13} className="ds-icon" /> Consulta
          </button>
        )}
        {/* Botón Recordar — manda por WhatsApp "mañana tiene su cita" (1 clic) */}
        {recordable && appt.pacienteTelefono && (
          <button
            onClick={handleRecordar}
            title="Enviar recordatorio por WhatsApp"
            style={{
              background: 'rgba(37,211,102,0.15)', color: '#1faa52',
              border: '1px solid rgba(37,211,102,0.4)', borderRadius: 6,
              padding: '5px 10px', fontSize: 12, fontWeight: 700, cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', gap: 4,
            }}
          >
            <BellRing size={13} className="ds-icon" /> Recordar
          </button>
        )}
        {/* Botón Unirse a videollamada para teleconsulta */}
        {appt.tipo === 'teleconsulta' && (
          <button
            onClick={async () => {
              // Enlace con token HMAC (camino seguro de la sala). Si el token falla,
              // abre igual (el endpoint mantiene el respaldo endurecido).
              let t = ''
              try {
                const r = await fetchAutenticado('/api/telesalud/token', {
                  method: 'POST', headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ clinicId: rowClinicId, patientId: appt.pacienteId }),
                })
                if (r.ok) t = (await r.json()).token || ''
              } catch { /* sin token → respaldo endurecido */ }
              const tq = t ? `&t=${encodeURIComponent(t)}` : ''
              window.open(`/teleconsulta/${appt.id}?c=${rowClinicId ?? ''}&p=${appt.pacienteId}&dr=1${tq}`, '_blank', 'noopener')
            }}
            title="Unirse a videollamada"
            style={{
              background: 'rgba(167,139,250,0.15)', color: '#a78bfa',
              border: '1px solid rgba(167,139,250,0.4)', borderRadius: 6,
              padding: '5px 10px', fontSize: 12, fontWeight: 700, cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', gap: 4,
            }}
          >
            <Video size={13} className="ds-icon" /> Unirse
          </button>
        )}
        {appt.pacienteTelefono && (
          <button className="btn btn-ghost btn-icon btn-sm" onClick={handleWA} title="WhatsApp">
            <MessageSquare size={15} />
          </button>
        )}
        <button className="btn btn-ghost btn-icon btn-sm" onClick={onEdit} title="Editar">
          <Edit2 size={15} />
        </button>
        <button className="btn btn-ghost btn-icon btn-sm" onClick={onMenuToggle} title="Más opciones">
          <MoreVertical size={15} />
        </button>
      </div>

      {/* Dropdown menu */}
      {menuOpen && (
        <div style={{
          position: 'absolute', right: 8, top: '100%', zIndex: 20,
          background: 'var(--s1)', border: '1px solid var(--border)', borderRadius: 10,
          padding: 6, minWidth: 200, boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        }}>
          <div style={{ fontSize: 11, color: 'var(--text3)', padding: '4px 10px 6px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Cambiar estado
          </div>
          {QUICK_STATUSES.map(s => (
            <button
              key={s}
              onClick={() => onStatusChange(s)}
              style={{
                display: 'block', width: '100%', textAlign: 'left',
                padding: '7px 10px', borderRadius: 6, border: 'none', cursor: 'pointer',
                fontSize: 13, color: 'var(--text2)', background: 'transparent', transition: 'background 0.1s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--s2)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              {s}
            </button>
          ))}
          {/*
            ELIMINAR ES DEL MÉDICO (decisión del dueño, 2026-08-01).

            Cancelar conserva el registro; eliminar lo destruye, y el mostrador
            no necesita destruir nada para trabajar: una cita que ya no va se
            cancela, con su motivo y su rastro. Las reglas de Firestore son el
            borde real (`allow delete: if isMedico`); esto sólo evita ofrecer un
            botón que va a fallar.

            A la asistente se le dice qué hacer en su lugar, en vez de dejar un
            hueco en el menú sin explicación.
          */}
          <div style={{ height: 1, background: 'var(--border)', margin: '6px 0' }} />
          {esMedicoReal ? (
            <button
              onClick={onDelete}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, width: '100%', textAlign: 'left',
                padding: '7px 10px', borderRadius: 6, border: 'none', cursor: 'pointer',
                fontSize: 13, color: 'var(--red)', background: 'transparent',
              }}
            >
              <Trash2 size={13} /> Eliminar cita
            </button>
          ) : (
            <div style={{ padding: '7px 10px', fontSize: 11.5, color: 'var(--text3)', lineHeight: 1.5 }}>
              Para quitarla de la agenda, <strong>cancélala</strong>: así queda el registro.
              Eliminarla del todo lo hace el médico.
            </div>
          )}
        </div>
      )}
    </div>
  )
}
