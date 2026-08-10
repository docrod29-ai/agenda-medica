'use client'
import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { useCerrarConEscape } from '@/lib/ui/activable'
import { actualizarContadoresPaciente } from '@/lib/agenda/contadores-paciente'
import { useSearchParams, useRouter } from 'next/navigation'
import { useAppointments } from '@/hooks/useAppointments'
import { useConfig } from '@/hooks/useConfig'
import { useToast } from '@/context/ToastContext'
import { estadoCita } from '@/components/StatusBadge'
import { calcularRiesgoNoShow, NIVEL_LABEL } from '@/lib/no-show-risk'
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
import { openWhatsApp, msgConfirmacion, msgRecordatorio24h } from '@/lib/whatsapp'
import {
  Plus, Search, Trash2, Edit2, MessageSquare,
  ChevronLeft, ChevronRight, CalendarDays, MoreVertical,
  Phone, AlertTriangle, DollarSign, Video, BellRing,
  Stethoscope,
} from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { hoyISO, sumarDiasISO, ahoraMinutosDelDia } from '@/lib/timezone'
import { fetchAutenticado } from '@/lib/auth-client'
import { necesitaReparacion, accionDeReparacion, avisoDesincronizada } from '@/lib/calendario/reparar-sync'
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

/**
 * La fecha de la URL se VALIDA antes de creerla. `?d=borrame` dejaría la agenda
 * pidiendo citas de una ventana inexistente y la pantalla en blanco, sin decir
 * por qué. Ante un valor que no es una fecha, hoy.
 */
function paramFecha(v: string | null): string {
  return v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : todayStr()
}

/** Igual con el filtro: sólo se aceptan los valores que la pantalla sabe pintar. */
const FILTROS_VALIDOS = ['todas', 'por-cobrar', 'pendientes', 'pendiente', 'confirmada', 'atendida', 'cancelada', 'no-asistio'] as const
/**
 * «pendientes» es una VISTA, como «por-cobrar»: agrupa los cuatro estados que
 * significan «falta confirmar» (solicitada, pendiente-confirmar,
 * pendiente-datos, recordatorio-enviado). Sin la vista, el renglón de resumen
 * diría «1 por confirmar» y el filtro de un solo estado mostraría cero filas.
 */
const ESTADOS_PENDIENTES: AppointmentStatus[] = ['solicitada', 'pendiente-confirmar', 'pendiente-datos', 'recordatorio-enviado']
type FiltroCitas = AppointmentStatus | 'todas' | 'por-cobrar' | 'pendientes'
function paramFiltro(v: string | null): FiltroCitas {
  return (FILTROS_VALIDOS as readonly string[]).includes(v ?? '')
    ? (v as FiltroCitas)
    : 'todas'
}

function prevDay(d: string) { return sumarDiasISO(d, -1) }
function nextDay(d: string) { return sumarDiasISO(d, 1) }

export default function CitasPage() {
  const params = useSearchParams()
  const router = useRouter()
  /**
   * EL DÍA QUE SE ESTÁ MIRANDO VIVE EN LA URL — REG-302.
   *
   * `selectedDate`, el filtro y la búsqueda eran `useState` puro. Como
   * `(dashboard)/template.tsx` desmonta la página en CADA navegación, volver de
   * una consulta devolvía la agenda a hoy, «todas» y sin búsqueda.
   *
   * En una consulta normal eso es una vez por paciente: el médico que trabaja el
   * jueves desde el martes vuelve a poner la fecha **después de cada uno**.
   *
   * La directiva V9 pide «URL-addressable state» con esas palabras, y aquí es
   * además lo más barato: la URL ya sobrevive al desmontaje, al atrás del
   * navegador y a compartir el enlace. No hace falta almacén nuevo.
   */
  const [selectedDate, setSelectedDate] = useState(() => paramFecha(params.get('d')))
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
  const [statusFilter, setStatusFilter] = useState<FiltroCitas>(() => paramFiltro(params.get('f')))
  const [search, setSearch] = useState(() => params.get('q') ?? '')
  const [modalOpen, setModalOpen] = useState(false)
  const [editAppt, setEditAppt] = useState<Appointment | null>(null)
  const [menuId, setMenuId] = useState<string | null>(null)
  // El menú de la cita se cerraba SOLO con un clic fuera (v963).
  useCerrarConEscape(!!menuId, () => setMenuId(null))
  const [deletingId, setDeletingId] = useState<string | null>(null)

  /**
   * La URL que describe lo que se está mirando ahora mismo. Se omite lo que vale
   * lo de siempre para no ensuciar la barra de direcciones con `?d=hoy&f=todas`.
   */
  const urlAgenda = useCallback(() => {
    const q = new URLSearchParams()
    if (selectedDate !== todayStr()) q.set('d', selectedDate)
    if (statusFilter !== 'todas') q.set('f', statusFilter)
    if (search.trim()) q.set('q', search.trim())
    const s = q.toString()
    return s ? `/citas?${s}` : '/citas'
  }, [selectedDate, statusFilter, search])

  /**
   * Y se escribe en la URL con `replace`, no con `push`: cambiar de día no debe
   * llenar el historial de entradas que el botón «atrás» del navegador tenga que
   * deshacer una por una. Lo que se quiere es que la ENTRADA ACTUAL describa la
   * pantalla actual, para que al volver de una consulta se restaure sola.
   *
   * El rebote es por la búsqueda: sin él se reescribiría la URL en cada tecla.
   */
  // El ref se actualiza en un efecto, no durante el render: tocarlo mientras se
  // renderiza es error del compilador de React y sube el trinquete de lint.
  const urlAgendaRef = useRef(urlAgenda)
  useEffect(() => { urlAgendaRef.current = urlAgenda }, [urlAgenda])
  useEffect(() => {
    const id = setTimeout(() => {
      const destino = urlAgendaRef.current()
      if (destino !== window.location.pathname + window.location.search) {
        router.replace(destino, { scroll: false })
      }
    }, 300)
    return () => clearTimeout(id)
  }, [selectedDate, statusFilter, search, router])

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
        router.replace(urlAgendaRef.current(), { scroll: false })
      }
      return
    }
    idAbierto.current = id
    setEditAppt(found)
    setModalOpen(true)
    router.replace(urlAgendaRef.current(), { scroll: false })
  }, [params, appointments, router, loading, toast])

  // Índice O(1) por id: antes cada fila hacía pacientes.find() lineal → O(filas ×
  // pacientes) en cada tecla del buscador y cada toggle de menú (jank con miles de pacientes).
  const patientById = useMemo(() => new Map(pacientes.map(p => [p.id, p])), [pacientes])

  const filtered = useMemo(() => {
    return appointments.filter(a => {
      if (a.fechaHora.slice(0, 10) !== selectedDate) return false
      if (statusFilter === 'por-cobrar') {
        if (!['atendida', 'finalizada'].includes(a.estado) || a.cobroId || a.cobroExento) return false
      } else if (statusFilter === 'pendientes') {
        if (!ESTADOS_PENDIENTES.includes(a.estado)) return false
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
    const pend = day.filter(a => ESTADOS_PENDIENTES.includes(a.estado)).length
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

  // La fecha completa SIEMPRE en es-MX. Antes el subtítulo repetía el ISO
  // («2026-08-09») y el input nativo enseñaba «08/09/2026» — formato US que
  // aquí se lee 8 de septiembre (defecto nº8 del Visual DNA §6).
  // Mayúscula SÓLO la primera letra — `text-transform: capitalize` produce
  // «Domingo 9 De Agosto De 2026», el mismo defecto ya fichado en calendario
  // («De Agosto», Visual DNA §6 nº18).
  const fechaLarga = useMemo(() => {
    const f = format(new Date(selectedDate + 'T12:00'), "EEEE d 'de' MMMM 'de' yyyy", { locale: es })
    return f.charAt(0).toUpperCase() + f.slice(1)
  }, [selectedDate])

  // ¿Trabaja aquí más de un médico? Si no, el nombre del médico en cada
  // entrada es ruido (la píldora «Ana» en consultorio de una sola médica —
  // defecto nº4 del Visual DNA §6). Se decide por los datos, no por config.
  const multiMedico = useMemo(
    () => new Set(appointments.map(a => a.medicoId).filter(Boolean)).size > 1,
    [appointments],
  )

  /**
   * EL MOMENTO ACTUAL — la hora del consultorio para el marcador de AHORA.
   * Nace tras montar (null en el primer render) para no fabricar un mismatch
   * de hidratación por hora servidor≠cliente (la familia de
   * V10-HARNESS-OBS-001), y se refresca cada minuto.
   */
  const [ahoraHHMM, setAhoraHHMM] = useState<string | null>(null)
  useEffect(() => {
    const tick = () => {
      const min = ahoraMinutosDelDia()
      setAhoraHHMM(`${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`)
    }
    tick()
    const id = setInterval(tick, 60_000)
    return () => clearInterval(id)
  }, [])
  const esHoy = selectedDate === todayStr()

  // Dónde se inserta el marcador de AHORA: antes de la primera cita cuya hora
  // aún no llega. Sólo aplica viendo HOY.
  const indiceAhora = useMemo(() => {
    if (!esHoy || !ahoraHHMM) return -1
    const i = filtered.findIndex(a => a.fechaHora.slice(11, 16) > ahoraHHMM)
    return i === -1 ? filtered.length : i
  }, [esHoy, ahoraHHMM, filtered])

  // Selector de fecha nativo, operado desde un botón con nombre accesible.
  const fechaInputRef = useRef<HTMLInputElement>(null)

  // El cierre del riel: cuántas citas trae mañana (CONTINUIDAD — el día no
  // termina en un vacío, apunta al siguiente). La ventana ya las tiene.
  const citasManana = useMemo(() => {
    const m = nextDay(selectedDate)
    return appointments.filter(a => a.fechaHora.slice(0, 10) === m && !['cancelada', 'reagendada'].includes(a.estado)).length
  }, [appointments, selectedDate])

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
      {/*
        CABECERA — el DÍA es el título, no el nombre del módulo (Visual DNA
        §6 defecto 20). «Citas» ya lo dice la navegación; lo que el médico
        necesita saber en dos segundos es QUÉ día mira y cómo viene.
      */}
      <header style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 18, gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <button className="btn btn-ghost btn-icon btn-sm" aria-label="Día anterior" onClick={() => setSelectedDate(prevDay(selectedDate))}>
              <ChevronLeft size={16} />
            </button>
            <h1 className="nx-display" style={{ margin: 0 }}>{dateLabel.charAt(0).toUpperCase() + dateLabel.slice(1)}</h1>
            <button className="btn btn-ghost btn-icon btn-sm" aria-label="Día siguiente" onClick={() => setSelectedDate(nextDay(selectedDate))}>
              <ChevronRight size={16} />
            </button>
            <button
              className="btn btn-ghost btn-icon btn-sm"
              aria-label="Elegir una fecha en el calendario"
              onClick={() => {
                const el = fechaInputRef.current
                if (!el) return
                if ('showPicker' in el && typeof el.showPicker === 'function') el.showPicker()
                else el.click()
              }}
            >
              <CalendarDays size={16} />
            </button>
            {/* El input nativo enseñaría «08/09/2026» (formato US). Vive oculto
                pero enfocable; el botón de arriba lo abre. */}
            <input
              ref={fechaInputRef}
              className="riel-fecha-input"
              type="date" value={selectedDate}
              aria-label="Ir a una fecha"
              onChange={e => setSelectedDate(paramFecha(e.target.value))}
            />
            {!esHoy && (
              <button className="btn btn-secondary btn-sm" onClick={() => setSelectedDate(todayStr())}>
                Hoy
              </button>
            )}
          </div>
          <div style={{ fontSize: 13, color: 'var(--text3)', marginTop: 2 }}>
            {fechaLarga}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <DoctorFilter medicoId={medicoFiltro} onChange={setMedicoFiltro} />
          <Button icon={<Plus size={16} />} onClick={() => router.push('/asistente')}>Nueva cita</Button>
        </div>
      </header>

      {/*
        UN solo renglón de filtro-resumen (mata la sopa de 12 chips: Visual
        DNA §6 defecto 3). Los segmentos son las preguntas reales del día;
        el resto de estados vive en un selector con nombre. «Por cobrar» sólo
        existe si hay a quién cobrar: un cero permanente enseña a ignorarlo.
      */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14, flexWrap: 'wrap' }}>
        <div className="riel-filtros" role="group" aria-label="Filtrar las citas del día">
          <button className="riel-filtro" aria-pressed={statusFilter === 'todas'} onClick={() => setStatusFilter('todas')}>
            <span className="riel-filtro-n">{daySummary.total}</span> {daySummary.total === 1 ? 'cita' : 'citas'}
          </button>
          {daySummary.pend > 0 && (
            <button className="riel-filtro" aria-pressed={statusFilter === 'pendientes'} onClick={() => setStatusFilter(statusFilter === 'pendientes' ? 'todas' : 'pendientes')}>
              <span className="riel-filtro-n">{daySummary.pend}</span> por confirmar
            </button>
          )}
          {daySummary.porCobrar > 0 && (
            <button className="riel-filtro" aria-pressed={statusFilter === 'por-cobrar'} onClick={() => setStatusFilter(statusFilter === 'por-cobrar' ? 'todas' : 'por-cobrar')}>
              <span className="riel-filtro-n">{daySummary.porCobrar}</span> por cobrar
            </button>
          )}
          <select
            className="riel-filtro-select"
            aria-label="Filtrar por estado de la cita"
            data-activo={!['todas', 'pendientes', 'por-cobrar'].includes(statusFilter)}
            value={['todas', 'pendientes', 'por-cobrar'].includes(statusFilter) ? '' : statusFilter}
            onChange={e => setStatusFilter(e.target.value === '' ? 'todas' : (e.target.value as FiltroCitas))}
          >
            <option value="">Estado…</option>
            {STATUS_FILTERS.filter(f => f.value !== 'todas').map(f => (
              <option key={f.value} value={f.value}>{f.label}</option>
            ))}
          </select>
        </div>
        <div className="riel-buscar" style={{ position: 'relative', flex: '1 1 180px', maxWidth: 280, marginLeft: 'auto' }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)' }} />
          <input
            className="input"
            style={{ paddingLeft: 32 }}
            placeholder="Buscar paciente…"
            aria-label="Buscar un paciente por nombre"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* EL RIEL DEL DÍA (Visual DNA R1) */}
      <div>
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
          <div className="riel">
            {filtered.map((appt, i) => (
              <div key={appt.id}>
                {/* EL MARCADOR DE AHORA — el momento actual, siempre visible
                    viendo hoy. Nace tras montar (sin mismatch de hidratación). */}
                {i === indiceAhora && (
                  <div className="riel-ahora" role="separator" aria-label={`Ahora son las ${ahoraHHMM}`}>
                    <span className="riel-ahora-hora">{ahoraHHMM}</span>
                    <span className="riel-ahora-punto" />
                    <span className="riel-ahora-linea" />
                  </div>
                )}
                <div className="nx-reveal" style={{ animationDelay: `${Math.min(i, 12) * 28}ms` }}>
                <RielEntrada
                  onConsulta={pid => router.push(`/consulta/${pid}`)}
                  appt={appt}
                  paciente={patientById.get(appt.pacienteId) ?? null}
                  config={config}
                  esHoy={esHoy}
                  ahoraHHMM={ahoraHHMM}
                  multiMedico={multiMedico}
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
              </div>
            ))}
            {/* Todas las citas del día ya pasaron: el marcador cierra el riel */}
            {indiceAhora === filtered.length && filtered.length > 0 && (
              <div className="riel-ahora" role="separator" aria-label={`Ahora son las ${ahoraHHMM}`}>
                <span className="riel-ahora-hora">{ahoraHHMM}</span>
                <span className="riel-ahora-punto" />
                <span className="riel-ahora-linea" />
              </div>
            )}
            {/* El riel no muere en el vacío: apunta al día siguiente. */}
            {filtered.length > 0 && (
              <div className="riel-cierre">
                Fin del día ·{' '}
                {citasManana > 0 ? (
                  <button className="riel-filtro" onClick={() => setSelectedDate(nextDay(selectedDate))}>
                    mañana: <span className="riel-filtro-n">{citasManana}</span> {citasManana === 1 ? 'cita' : 'citas'}
                  </button>
                ) : (
                  'mañana sin citas agendadas'
                )}
              </div>
            )}
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

/**
 * LA SIGUIENTE ACCIÓN SEGURA de una cita (Visual DNA R2): cada entrada del
 * riel enseña UNA acción primaria derivada del estado; todo lo demás vive en
 * el menú. El ORDEN es la política, no estilo:
 *
 *   1. cobrar lo atendido — la pregunta de la asistente todo el día;
 *   2. una consulta en curso o en sala — el paciente está AQUÍ;
 *   3. unirse a la teleconsulta de hoy;
 *   4. confirmar lo pendiente (WhatsApp);
 *   5. recordar la cita confirmada de otro día;
 *   6. iniciar la consulta confirmada de hoy.
 *
 * Cancelada / no asistió / reagendada / cobrada: sin acción — no hay
 * siguiente paso seguro que ofrecer.
 */
type AccionPrimaria =
  | { tipo: 'cobrar'; label: string }
  | { tipo: 'consulta'; label: string }
  | { tipo: 'unirse'; label: string }
  | { tipo: 'confirmar'; label: string }
  | { tipo: 'recordar'; label: string }

export function accionPrimaria(appt: Appointment, esHoy: boolean): AccionPrimaria | null {
  const e = appt.estado
  if (['cancelada', 'no-asistio', 'reagendada'].includes(e)) return null
  if (['atendida', 'finalizada'].includes(e) && !appt.cobroId && !appt.cobroExento) {
    return { tipo: 'cobrar', label: 'Cobrar' }
  }
  if (['atendida', 'finalizada', 'pagada'].includes(e)) return null
  if (e === 'en-consulta' && appt.pacienteId) return { tipo: 'consulta', label: 'Continuar consulta' }
  if (e === 'en-sala' && appt.pacienteId) return { tipo: 'consulta', label: 'Iniciar consulta' }
  if (appt.tipo === 'teleconsulta' && esHoy) return { tipo: 'unirse', label: 'Unirse' }
  if (ESTADOS_PENDIENTES.includes(e) && appt.pacienteTelefono) {
    return { tipo: 'confirmar', label: 'Confirmar' }
  }
  if (e === 'confirmada' || e === 'recordatorio-enviado') {
    if (esHoy && appt.pacienteId) return { tipo: 'consulta', label: 'Iniciar consulta' }
    if (appt.pacienteTelefono) return { tipo: 'recordar', label: 'Recordar' }
  }
  return null
}

/** El dibujo del nodo sobre el riel: el estado como MOMENTO, no como color.
 *  «espera» (en sala) y «ahora» (en consulta) se dibujan distinto: hueco
 *  cobalto vs lleno con anillo — lo pidió la revisión independiente (P3.11). */
function momentoDeCita(appt: Appointment): 'proximo' | 'espera' | 'ahora' | 'hecho' | 'cerrado' {
  const e = appt.estado
  if (['cancelada', 'no-asistio', 'reagendada'].includes(e)) return 'cerrado'
  if (['atendida', 'finalizada', 'pagada'].includes(e)) return 'hecho'
  if (e === 'en-consulta') return 'ahora'
  if (e === 'en-sala') return 'espera'
  return 'proximo'
}

/**
 * El tono semántico del punto de estado, EN la paleta del riel (Visual DNA
 * §3: neutro · cobalto · ámbar · rojo · verde). El morado de la paleta de
 * badges no pertenece aquí — la revisión independiente lo cazó (P3.9).
 */
const TONO_RIEL: Record<string, string> = {
  blue: 'var(--nexus)',
  purple: 'var(--nexus)',
  amber: 'var(--amber)',
  red: 'var(--red)',
  green: 'var(--green)',
  gris: 'var(--text3)',
}

function RielEntrada({
  appt, paciente, config, esHoy, multiMedico, menuOpen, onMenuToggle, onEdit, onDelete, onStatusChange, onCobrar, onQuitarCortesia, deleting, onConsulta,
}: {
  /** Abre la consulta del paciente. Se recibe del padre para no montar otro router. */
  onConsulta: (pacienteId: string) => void
  appt: Appointment
  paciente: Patient | null
  config: ReturnType<typeof useConfig>['config']
  esHoy: boolean
  ahoraHHMM: string | null
  multiMedico: boolean
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

  /**
   * REPARAR EL CALENDARIO DESDE LA SESIÓN DEL MÉDICO.
   *
   * El portal escribe con el vínculo `médico ↔ calendario`; cuando ese vínculo
   * falta —o Google falló— la cita queda marcada y esto es la salida: aquí SÍ
   * hay token propio, porque `/api/calendar/sync` escribe con el
   * `googleTokens/{uid}` del que está en sesión.
   *
   * Una cita cancelada se BORRA del calendario, no se actualiza: en el del
   * médico —y en el del paciente, si estaba invitado— no debe quedar nada.
   */
  const [reparando, setReparando] = useState(false)
  const { toast } = useToast()
  const repararSync = async () => {
    if (reparando || !rowClinicId) return
    setReparando(true)
    try {
      const res = await fetchAutenticado('/api/calendar/sync', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: accionDeReparacion(appt.estado), appointment: appt, clinicId: rowClinicId,
        }),
      })
      if (!res.ok) throw new Error('sync')
      toast('Google Calendar quedó al día con esta cita', 'success')
    } catch {
      // Se dice qué sigue fallando, no un «error» a secas: si el calendario no
      // está conectado o ligado, reintentar no lo va a arreglar.
      toast('No se pudo escribir en Google Calendar. Revisa la conexión del calendario en Configuración → Integraciones.', 'error')
    } finally {
      setReparando(false)
    }
  }

  const QUICK_STATUSES: AppointmentStatus[] = ['en-sala', 'en-consulta', 'atendida', 'finalizada', 'cancelada', 'no-asistio']

  const momento = momentoDeCita(appt)
  const accion = accionPrimaria(appt, esHoy)
  const estado = estadoCita(appt.estado)

  // Unirse a la videollamada de una teleconsulta. Enlace con token HMAC (el
  // camino seguro de la sala); si el token falla, abre igual — el endpoint
  // mantiene el respaldo endurecido.
  const abrirTeleconsulta = async () => {
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
  }

  const ejecutar = (a: AccionPrimaria) => {
    switch (a.tipo) {
      case 'cobrar': onCobrar?.(appt); break
      case 'consulta': onConsulta(appt.pacienteId); break
      case 'unirse': void abrirTeleconsulta(); break
      case 'confirmar': handleWA(); break
      case 'recordar': handleRecordar(); break
    }
  }

  const ICONO_ACCION = {
    cobrar: <DollarSign size={13} className="ds-icon" />,
    consulta: <Stethoscope size={13} className="ds-icon" />,
    unirse: <Video size={13} className="ds-icon" />,
    confirmar: <MessageSquare size={13} className="ds-icon" />,
    recordar: <BellRing size={13} className="ds-icon" />,
  } as const

  // ¿La acción sigue disponible aunque no sea LA primaria? Va al menú.
  const puedeCobrar = !['cancelada', 'no-asistio', 'reagendada'].includes(appt.estado) && !appt.cobroId && !appt.cobroExento && !!onCobrar
  const puedeConsulta = !!appt.pacienteId && !['cancelada', 'no-asistio'].includes(appt.estado)

  return (
    <div className="riel-entrada" data-momento={momento} style={{ opacity: deleting ? 0.4 : undefined }}>
      <div className="riel-tiempo">
        <span className="riel-hora">{hora}</span>
        <span className="riel-dur">{appt.duracion} min</span>
      </div>
      <div className="riel-nodo" aria-hidden="true" />

      <div className="riel-cuerpo">
        {/* R3: identidad tipográfica — sin avatar-círculo, sin píldora del
            propio médico (sólo aparece el médico cuando hay más de uno). */}
        <div className="riel-nombre">
          {appt.pacienteNombre}
          {multiMedico && appt.medicoId && appt.medicoNombre && (
            <span className="riel-medico" style={{ color: colorMedico(appt.medicoId) }}>
              {appt.medicoNombre.replace(/^Dr\.?\s+|^Dra\.?\s+/i, '').split(' ')[0]}
            </span>
          )}
        </div>
        <div className="riel-meta">
          <TipoCitaIcon tipo={appt.tipo} size={12} /> {typeCfg?.label}
          {appt.motivo ? ` · ${appt.motivo}` : ''}
        </div>
        <div className="riel-estado-linea">
          {estado && (
            <span className="nx-estado" style={{ ['--estado-tono' as string]: TONO_RIEL[estado.tono] ?? 'var(--text3)' }}>
              {estado.label}
            </span>
          )}
          {appt.cobroExento && (
            <span
              className="nx-estado"
              title={appt.exentoMotivo ? `Cortesía: ${appt.exentoMotivo}` : 'Cortesía (no se cobra)'}
            >
              cortesía
            </span>
          )}
          {/*
            LA CITA DESCUADRADA CON GOOGLE. `googleCalendarSyncStatus` se
            escribía en cinco sitios y no lo leía ninguna pantalla; éste es el
            panel prometido. Es señal que PIDE acción: por eso sí lleva color
            de aviso y es botón, no texto.
          */}
          {necesitaReparacion(appt) && (
            <button
              onClick={repararSync}
              disabled={reparando}
              title={avisoDesincronizada(appt.estado)}
              className="riel-aviso"
            >
              <AlertTriangle size={10} className="ds-icon" />
              {reparando ? 'Reparando…' : 'Calendario descuadrado'}
            </button>
          )}
          {/* Riesgo de no-show alto: señal operativa real — conserva su aviso */}
          {riesgo && (riesgo.nivel === 'alto' || riesgo.nivel === 'muy_alto') && (
            <span className="riel-aviso" title={`Riesgo: ${riesgo.score}/100. ${riesgo.recomendacion}`}>
              <AlertTriangle size={10} className="ds-icon" /> {NIVEL_LABEL[riesgo.nivel]}
            </span>
          )}
        </div>
      </div>

      {/* R2: UNA acción primaria por entrada + el menú. Nada más. */}
      <div className="riel-accion">
        {accion && (
          <button className="btn btn-primary btn-sm" onClick={() => ejecutar(accion)}>
            {ICONO_ACCION[accion.tipo]} {accion.label}
          </button>
        )}
        <button
          className="btn btn-ghost btn-icon btn-sm"
          onClick={onMenuToggle}
          aria-label={`Más acciones para ${appt.pacienteNombre}`}
          aria-expanded={menuOpen}
        >
          <MoreVertical size={15} />
        </button>
      </div>

      {menuOpen && (
        <div className="riel-menu" role="menu" aria-label={`Acciones para ${appt.pacienteNombre}`}>
          <div className="riel-menu-titulo">Acciones</div>
          {puedeCobrar && accion?.tipo !== 'cobrar' && (
            <button className="riel-menu-item" role="menuitem" onClick={() => { onCobrar?.(appt); onMenuToggle() }}>
              <DollarSign size={13} className="ds-icon" /> Registrar cobro
            </button>
          )}
          {puedeConsulta && accion?.tipo !== 'consulta' && (
            <button className="riel-menu-item" role="menuitem" onClick={() => onConsulta(appt.pacienteId)}>
              <Stethoscope size={13} className="ds-icon" /> Abrir consulta
            </button>
          )}
          {appt.tipo === 'teleconsulta' && accion?.tipo !== 'unirse' && (
            <button className="riel-menu-item" role="menuitem" onClick={() => void abrirTeleconsulta()}>
              <Video size={13} className="ds-icon" /> Unirse a videollamada
            </button>
          )}
          {/*
            EL TELÉFONO NO SE PIERDE (revisión independiente, P1.2): la fila
            vieja lo enseñaba siempre; el riel lo saca de la vista pero lo deja
            A UN CLIC, con el número VISIBLE y marcable — antes ni siquiera se
            podía llamar desde aquí.
          */}
          {appt.pacienteTelefono && (
            <a className="riel-menu-item" role="menuitem" href={`tel:${appt.pacienteTelefono}`}>
              <Phone size={13} className="ds-icon" /> Llamar · {appt.pacienteTelefono}
            </a>
          )}
          {appt.pacienteTelefono && accion?.tipo !== 'confirmar' && (
            <button className="riel-menu-item" role="menuitem" onClick={() => { handleWA(); onMenuToggle() }}>
              <MessageSquare size={13} className="ds-icon" /> WhatsApp: confirmar cita
            </button>
          )}
          {recordable && appt.pacienteTelefono && accion?.tipo !== 'recordar' && (
            <button className="riel-menu-item" role="menuitem" onClick={() => { handleRecordar(); onMenuToggle() }}>
              <BellRing size={13} className="ds-icon" /> WhatsApp: recordatorio
            </button>
          )}
          {appt.cobroExento && onQuitarCortesia && (
            <button className="riel-menu-item" role="menuitem" onClick={() => { onQuitarCortesia(appt); onMenuToggle() }}>
              <DollarSign size={13} className="ds-icon" /> Quitar cortesía
            </button>
          )}
          <button className="riel-menu-item" role="menuitem" onClick={onEdit}>
            <Edit2 size={13} className="ds-icon" /> Editar cita
          </button>

          <div className="riel-menu-titulo">Cambiar estado</div>
          {QUICK_STATUSES.map(s => (
            <button key={s} className="riel-menu-item" role="menuitem" onClick={() => onStatusChange(s)}>
              {estadoCita(s)?.label ?? s}
            </button>
          ))}
          {/*
            ELIMINAR ES DEL MÉDICO (decisión del dueño, 2026-08-01). Cancelar
            conserva el registro; eliminar lo destruye. Las reglas de Firestore
            son el borde real; esto sólo evita ofrecer un botón que va a fallar.
          */}
          <div className="riel-menu-sep" />
          {esMedicoReal ? (
            <button className="riel-menu-item riel-menu-peligro" role="menuitem" onClick={onDelete}>
              <Trash2 size={13} className="ds-icon" /> Eliminar cita
            </button>
          ) : (
            <div className="riel-menu-nota">
              Para quitarla de la agenda, <strong>cancélala</strong>: así queda el registro.
              Eliminarla del todo lo hace el médico.
            </div>
          )}
        </div>
      )}
    </div>
  )
}
