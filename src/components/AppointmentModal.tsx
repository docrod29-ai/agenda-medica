'use client'
import { FECHA_MAXIMA_AGENDA } from '@/lib/agenda/horizonte'
import { useState, useEffect, useMemo, type CSSProperties } from 'react'
import { Appointment, AppointmentType, AppointmentStatus, AppointmentOrigin, APPOINTMENT_TYPE_CONFIG, DEFAULT_CONFIG } from '@/types'
import { useConfig } from '@/hooks/useConfig'
import { useAppointments } from '@/hooks/useAppointments'
import { useDoctors } from '@/hooks/useDoctors'
import { useFiltroMedico } from '@/components/DoctorFilter'
import { configParaMedico } from '@/lib/horario-medico'
import { instanteMX } from '@/lib/timezone'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/context/ToastContext'
import { getAvailableSlots, hasConflict, porQueNoCabeEnElHorario } from '@/lib/availability'
import { listarBloques, type TimeBlock } from '@/lib/time-blocks'
import { hoyISO } from '@/lib/timezone'
import { useClinic } from '@/context/ClinicContext'
import { StatusBadge } from './StatusBadge'
import { Phone, MessageSquare, Clock, AlertCircle } from 'lucide-react'
import { openWhatsApp, msgConfirmacion } from '@/lib/whatsapp'
import { fetchAutenticado } from '@/lib/auth-client'
import { crearSolicitudResena } from '@/lib/reviews'
import { Modal, Button } from '@/components/ui'
import { Send, Star } from 'lucide-react'
import { useMode } from '@/context/ModeContext'

const ESTADOS_POST_VISITA = new Set<AppointmentStatus>(['atendida', 'finalizada', 'pagada'])

interface Props {
  open: boolean
  onClose: () => void
  appointment?: Appointment | null
  defaultDate?: string
  defaultHour?: string
  onSaved?: (id: string) => void
}

const TIPOS = Object.entries(APPOINTMENT_TYPE_CONFIG) as [AppointmentType, { label: string; defaultMinutes: number }][]

const ORIGENES: AppointmentOrigin[] = ['Manual', 'WhatsApp', 'Teléfono', 'Referido', 'Google Calendar', 'Otro']

const STATUSES_EDIT: AppointmentStatus[] = [
  'pendiente-confirmar', 'confirmada', 'recordatorio-enviado',
  'en-sala', 'en-consulta', 'atendida', 'finalizada',
  'cancelada', 'reagendada', 'no-asistio',
]

/**
 * Los dos avisos de «no se pudo consultar» se ven igual porque dicen lo mismo:
 * que estas horas se están ofreciendo sin haber podido descontar algo. Uno es
 * por el calendario de Google y el otro por la agenda propia. Una sola forma,
 * declarada una vez.
 */
const AVISO_NO_SE_PUDO_CONSULTAR: CSSProperties = {
  display: 'flex', alignItems: 'flex-start', gap: 5,
  fontSize: 11.5, color: 'var(--amber)', marginTop: 6, lineHeight: 1.45,
}

export function AppointmentModal({ open, onClose, appointment, defaultDate, defaultHour, onSaved }: Props) {
  const { config } = useConfig()
  const { activeDoctors } = useDoctors()
  const [filtroMedico] = useFiltroMedico()
  const { user } = useAuth()
  const { clinicId } = useClinic()
  const { toast } = useToast()

  const isEdit = !!appointment

  const today = hoyISO()  // zona MX: el min-date no debe bloquear horas válidas de hoy

  const [nombre, setNombre]       = useState('')
  const [telefono, setTelefono]   = useState('')
  const [fecha, setFecha]         = useState(defaultDate ?? today)
  const [hora, setHora]           = useState(defaultHour ?? '')
  /**
   * ESCRIBIR LA HORA A MANO: SIEMPRE, NO SÓLO CUANDO NO QUEDA NADA.
   *
   * El campo libre existía, pero vivía en el `else` de «¿hay huecos?»: sólo
   * aparecía con el día COMPLETO, que es justo cuando ya no sirve de nada. Con
   * un solo hueco libre en la lista, una hora libre de verdad que la lista no
   * trajera era inalcanzable — y la salida real del consultorio era teclear la
   * hora en otro lado o mover otra cita.
   *
   * Ahora es una elección del médico, no una consecuencia de que la lista esté
   * vacía. La hora tecleada pasa por los mismos chequeos que la elegida
   * (`hasConflict` + el 409 del servidor): se abre la puerta, no la reja.
   */
  const [horaManual, setHoraManual] = useState(false)

  /**
   * La ventana la manda el padre. Cada llamada al hook tiene estado propio, así
   * que un `useAppointments()` sin argumento NO heredaba la ventana ampliada de la
   * pantalla que abre el modal: al editar una cita de hace más de 120 días, para
   * el modal ese día estaba VACÍO — ofrecía como libres todos los horarios,
   * incluido el de la cita de al lado, y el chequeo de conflicto decía que no
   * había ninguno. Se podía mover una cita encima de otra sin advertencia.
   */
  /**
   * Y `error` SE RECOGE, que es la otra forma de llegar al mismo sitio. Cuando la
   * consulta de citas falla, el hook deja `appointments` en `[]` — la misma lista
   * vacía que produce un día de verdad libre. Diez líneas más abajo esta pantalla
   * ya razona así para Google Calendar; le faltaba hacerlo para las citas
   * PROPIAS, que son la fuente principal.
   */
  const { appointments, error: falloCitas } = useAppointments(fecha ? `${fecha} 00:00` : undefined)
  const [tipo, setTipo]           = useState<AppointmentType>('primera-vez')
  const [duracion, setDuracion]   = useState(60)
  const [motivo, setMotivo]       = useState('')
  const [notas, setNotas]         = useState('')
  const [origen, setOrigen]       = useState<AppointmentOrigin>('Manual')
  const [estado, setEstado]       = useState<AppointmentStatus>('pendiente-confirmar')
  const [consent, setConsent]     = useState(true)
  const [saving, setSaving]       = useState(false)
  const [conflict, setConflict]   = useState(false)
  /**
   * Motivo para poner una cita ENCIMA de otra.
   *
   * El charter pide bloquear el empalme accidental y permitir la anulación
   * manual AUTORIZADA Y AUDITADA. Sólo estaba la primera mitad, y eso no evita
   * el sobreagendamiento: lo esconde. Llega una urgencia a una hora ocupada y
   * el médico acaba escribiendo «10:05» a mano, o cancelando la otra cita sin
   * dejar rastro. Teclear un motivo es el gesto que separa «autorizado» de
   * «accidental»: nadie escribe una justificación por error.
   */
  const [motivoSobreagenda, setMotivoSobreagenda] = useState('')
  /**
   * `esMedicoReal` mira el ROL, no el modo de la pantalla: un médico que está
   * viendo la app «como secretaria» sigue pudiendo autorizar, y una asistente no
   * gana el permiso cambiando de modo. El servidor lo vuelve a comprobar; esto
   * es sólo para no ofrecer un botón que va a devolver 403.
   */
  const { esMedicoReal } = useMode()
  const [bloques, setBloques]     = useState<TimeBlock[]>([])
  const [medicoId, setMedicoId]   = useState<string>('')  // médico al que se agenda la cita

  useEffect(() => {
    if (open && clinicId) listarBloques(clinicId).then(setBloques).catch(() => {})
  }, [open, clinicId])

  /**
   * LO QUE EL MÉDICO YA TIENE EN SU GOOGLE CALENDAR.
   *
   * La integración era de UNA dirección: Ausculta empujaba sus citas a Google y
   * nada volvía. El médico se ponía una cirugía el jueves de 8 a 12 en su
   * calendario y esta pantalla seguía ofreciendo esas horas; el choque se
   * descubría el jueves.
   *
   * Llegan convertidos a bloqueos, así que el motor de huecos los descuenta sin
   * enterarse de que vienen de fuera. Si la consulta FALLA se dice —abajo—, en
   * vez de mostrar la agenda como si estuviera libre.
   */
  const [ocupadoGoogle, setOcupadoGoogle] = useState<TimeBlock[]>([])
  const [falloGoogle, setFalloGoogle] = useState(false)
  useEffect(() => {
    let vivo = true
    // El reseteo va DIFERIDO (no `setState` síncrono dentro del efecto): con la
    // llamada directa, cerrar el modal encadenaba un render extra por cada
    // cambio de fecha.
    const limpiar = () => { if (vivo) { setOcupadoGoogle([]); setFalloGoogle(false) } }
    if (!open || !clinicId || !fecha) { void Promise.resolve().then(limpiar); return () => { vivo = false } }
    fetchAutenticado(`/api/calendar/ocupado?clinicId=${encodeURIComponent(clinicId)}&fecha=${fecha}`)
      .then(r => r.json())
      .then((d: { ok?: boolean; conectado?: boolean; bloqueos?: TimeBlock[] }) => {
        if (!vivo) return
        setOcupadoGoogle(d?.bloqueos ?? [])
        // Sin Google vinculado no hay nada que avisar: es la mayoría de los casos.
        setFalloGoogle(d?.conectado === true && d?.ok === false)
      })
      .catch(limpiar)
    return () => { vivo = false }
  }, [open, clinicId, fecha])

  /** Los bloqueos del consultorio MÁS lo que ya está ocupado fuera. */
  const bloquesTotales = useMemo(() => [...bloques, ...ocupadoGoogle], [bloques, ocupadoGoogle])

  // Populate on edit
  useEffect(() => {
    if (!open) return
    // Un motivo de sobreagenda tecleado para OTRA cita no puede viajar con ésta:
    // sería una autorización heredada, que es justo lo contrario de deliberada.
    setMotivoSobreagenda('')
    if (appointment) {
      setNombre(appointment.pacienteNombre)
      setTelefono(appointment.pacienteTelefono)
      setFecha(appointment.fechaHora.slice(0, 10))
      setHora(appointment.fechaHora.slice(11, 16))
      setTipo(appointment.tipo)
      setDuracion(appointment.duracion)
      setMotivo(appointment.motivo ?? '')
      setNotas(appointment.notasInternas ?? '')
      setOrigen(appointment.origen)
      setEstado(appointment.estado)
      setConsent(appointment.consentimientoMensajes)
      // Médico de la cita; si no tiene, cae al filtro activo o al primero.
      setMedicoId(appointment.medicoId || filtroMedico || activeDoctors[0]?.id || '')
      setHoraManual(false)
    } else {
      setNombre(''); setTelefono(''); setFecha(defaultDate ?? today)
      setHora(defaultHour ?? ''); setTipo('primera-vez'); setDuracion(60)
      setMotivo(''); setNotas(''); setOrigen('Manual')
      setEstado('pendiente-confirmar'); setConsent(true)
      // Nueva cita: al médico que la asistente tiene filtrado, o al primero.
      setMedicoId(filtroMedico || activeDoctors[0]?.id || '')
      setHoraManual(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, appointment, defaultDate, defaultHour, today])

  // Médico seleccionado + su PROPIO horario/duraciones (cada médico agenda distinto).
  const doctorSel = useMemo(() => activeDoctors.find(d => d.id === medicoId), [activeDoctors, medicoId])
  const cfgAgenda = useMemo(() => configParaMedico(config, doctorSel), [doctorSel, config])

  // Auto-fill duration from type (según el médico seleccionado)
  useEffect(() => {
    if (!isEdit) {
      const d = cfgAgenda.duraciones?.[tipo] ?? APPOINTMENT_TYPE_CONFIG[tipo].defaultMinutes
      setDuracion(d)
    }
  }, [tipo, cfgAgenda.duraciones, isEdit])

  // Hora ORIGINAL de la cita en edición (HH:MM). getAvailableSlots solo devuelve
  // horas FUTURAS, así que al editar una cita cuya hora ya pasó (marcar "atendida"
  // /"no asistió", corregir notas) su hora no salía en la lista.
  const horaOriginal = useMemo(
    () => (isEdit && appointment ? appointment.fechaHora.slice(11, 16) : ''),
    [isEdit, appointment],
  )

  // Available slots — con el horario del médico y solo SUS citas
  const slots = useMemo(() => {
    if (!fecha) return []
    const base = getAvailableSlots(fecha, duracion, appointments, cfgAgenda, appointment?.id, bloquesTotales, medicoId || undefined)
    // Auditoría 2026-07 (P1): garantiza que la hora original de la cita editada
    // sea SIEMPRE seleccionable (misma fecha), aunque ya haya pasado, para no
    // bloquear el guardado al editar una cita del pasado.
    if (horaOriginal && appointment && fecha === appointment.fechaHora.slice(0, 10) && !base.includes(horaOriginal)) {
      return [...base, horaOriginal].sort()
    }
    return base
  }, [fecha, duracion, appointments, cfgAgenda, appointment?.id, medicoId, bloquesTotales, horaOriginal, appointment])

  // Conflict check (médico-aware + bloqueos, igual que los slots)
  useEffect(() => {
    if (!fecha || !hora) { setConflict(false); return }
    setConflict(hasConflict(fecha, hora, duracion, appointments, appointment?.id, bloquesTotales, medicoId || undefined, cfgAgenda))
    /**
     * LA HORA YA NO SE BORRA SOLA.
     *
     * Subir la duración después de elegir la hora puede dejarla sin caber, y
     * aquí se limpiaba el campo por eso. El defecto que arreglaba era real —se
     * guardaba una cita que terminaba después del cierre— pero el remedio era
     * una edición en silencio sobre lo que el médico acababa de teclear: el
     * campo se quedaba en blanco sin una palabra y parecía que la pantalla se
     * había reseteado sola.
     *
     * Ahora la hora se queda donde está y se DICE qué pasa (`noCabe` más abajo),
     * con la salida que de verdad arregla el caso: bajar la duración o mover la
     * hora. El guardado sigue cerrado mientras no quepa —`handleSave` lo corta y
     * el servidor responde 409—, así que no se pierde ninguna defensa: se pierde
     * el silencio.
     */
  }, [fecha, hora, duracion, appointments, appointment?.id, medicoId, bloquesTotales, horaOriginal, slots])

  /**
   * ¿Por qué no cabe esta hora? Distingue «se sale del horario» de «está
   * ocupada»: `hasConflict` devuelve `true` por las dos causas y el aviso decía
   * siempre «ya está ocupado», que con una cita que se pasa del cierre es
   * sencillamente falso. La hora original de una cita en edición no se juzga:
   * ya está agendada y el horario pudo cambiar después.
   */
  const noCabe = useMemo(
    () => (hora && hora !== horaOriginal ? porQueNoCabeEnElHorario(fecha, hora, duracion, cfgAgenda) : null),
    [fecha, hora, duracion, cfgAgenda, horaOriginal],
  )

  const handleSave = async () => {
    if (!nombre.trim()) { toast('Ingresa el nombre del paciente', 'error'); return }
    if (!fecha || !hora) { toast('Selecciona fecha y hora', 'error'); return }
    /**
     * Fuera del horario no hay salida autorizada: el servidor responde 409 sin
     * excepción para el médico (a diferencia del empalme, que sí la tiene). Se
     * corta aquí con el motivo de verdad en vez de dejar que el guardado falle
     * con un mensaje que no explica nada.
     */
    if (noCabe) {
      toast(
        noCabe.razon === 'dia-cerrado'
          ? 'Ese día el consultorio no da servicio. Elige otra fecha o activa el día en Configuración.'
          : noCabe.razon === 'horario-invalido'
            ? `El horario de ese día está mal configurado (${noCabe.detalle}). Revísalo en Configuración.`
            : `Con ${duracion} min, las ${hora} no caben en el horario de ese día (${noCabe.abre}–${noCabe.cierra}). Baja la duración o mueve la hora.`,
        'error',
      )
      return
    }
    if (conflict && !esMedicoReal) {
      toast('Ese horario ya está ocupado. Sólo el médico puede agendar encima: pídeselo y él lo autoriza.', 'error')
      return
    }
    if (conflict && motivoSobreagenda.trim().length < 5) {
      toast('Ese horario ya está ocupado. Si es deliberado, escribe el motivo para sobreagendar.', 'error')
      return
    }

    setSaving(true)
    try {
      const payload = {
        pacienteId: appointment?.pacienteId ?? '',
        pacienteNombre: nombre.trim(),
        pacienteTelefono: telefono.replace(/\D/g, ''),
        fechaHora: `${fecha} ${hora}`,
        duracion,
        tipo,
        motivo: motivo.trim(),
        estado,
        origen,
        // Médico al que se agenda la cita (elegido en el selector). Se guardan id y
        // nombre; el id se omite si está vacío (undefined rompería updateDoc).
        medicoNombre: doctorSel?.nombre ?? appointment?.medicoNombre ?? config.nombreMedico ?? '',
        ...(medicoId ? { medicoId } : {}),
        // No degradar un consentimiento previo ni "confirmar" solo por el estado:
        // eleva confirmadoPaciente si el estado lo implica, si no conserva el real.
        confirmadoPaciente: appointment?.confirmadoPaciente || ['confirmada', 'atendida', 'finalizada'].includes(estado),
        /**
         * NO se reenvían los marcadores de recordatorio.
         *
         * El modal congela la cita al abrirse y reescribía estos campos con el
         * valor que tenían entonces. Secuencia sin necesidad de un segundo
         * dispositivo: modal abierto a las 10:00 → el cron manda el recordatorio de
         * 24 h y pone la bandera en true → el médico guarda a las 10:10 y la
         * bandera vuelve a FALSE → el siguiente ciclo del cron manda el recordatorio
         * OTRA VEZ. El paciente lo recibe dos veces.
         *
         * Omitirlos deja que `updateDoc` los conserve intactos: es merge por campo.
         */
        notasInternas: notas.trim(),
        consentimientoMensajes: consent,
        creadoPor: user?.email ?? '',
        updatedPor: user?.email ?? '',
      }

      let id: string
      if (isEdit && appointment) {
        // Vía transaccional también al editar: el servidor re-chequea el conflicto
        // excluyendo esta misma cita y toca el centinela del día, así que compite
        // de verdad con las altas simultáneas.
        const res = await fetchAutenticado('/api/appointments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ clinicId, appointment: payload, reagendarId: appointment.id, sobreagendarMotivo: conflict ? motivoSobreagenda.trim() : undefined }),
        })
        if (!res.ok) {
          const j = await res.json().catch(() => ({}))
          toast(j?.error || 'No se pudo actualizar la cita', 'error')
          setSaving(false)
          return
        }
        id = appointment.id
        toast('Cita actualizada', 'success')
        // Sync with Google Calendar in background
        if (user?.uid) {
          fetchAutenticado('/api/calendar/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'update',
              appointment: { ...appointment, ...payload, id },
              clinicId,
            }),
          }).catch(() => {/* non-critical */})
        }
        // Si se LIBERA un hueco FUTURO → avisar a la lista de espera.
        // 'no-asistio' NO libera nada (es un evento ya pasado); y cancelar/reagendar
        // una cita PASADA tampoco ofrece un hueco agendable. Solo se avisa si el
        // horario liberado es futuro, para no mandar "se liberó un horario [ayer]".
        const liberaHueco = ['cancelada', 'reagendada'].includes(estado) &&
          !['cancelada', 'reagendada', 'no-asistio'].includes(appointment.estado)
        /**
         * «Futuro» CON EL RELOJ DEL CONSULTORIO, no el del navegador.
         *
         * `new Date('2026-08-06T09:00')` se interpreta en la zona de quien mira
         * la pantalla. Desde otro huso, una cita de esta tarde podía parecer
         * pasada —y no se avisaba a nadie del hueco— o al revés.
         */
        const esFuturo = instanteMX(appointment.fechaHora.slice(0, 10), appointment.fechaHora.slice(11, 16), cfgAgenda.zonaHoraria).getTime() > Date.now()
        const wasCancelled = liberaHueco && esFuturo
        if (wasCancelled) {
          fetchAutenticado('/api/whatsapp/waitlist-notify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              fecha: appointment.fechaHora.slice(0, 10),
              hora: appointment.fechaHora.slice(11, 16),
              clinicId,
              tipo: appointment.tipo,
              // Y su DURACIÓN: el rango horario del paciente se comprueba contra
              // el hueco entero, y sin esto se daba por supuesto que dura 30 min.
              duracion: appointment.duracion,
              /**
               * EL MÉDICO DEL HUECO — que aquí no viajaba.
               *
               * Sin `medicoId`, el bot cae al «primer médico activo» del
               * consultorio: se cancelaba una cita de la Dra. B desde este modal,
               * el paciente de la lista aceptaba, y la cita se creaba con el
               * Dr. A en un hueco que la Dra. B había liberado. La otra ruta que
               * avisa (la lista de Citas) sí lo mandaba: eran dos caminos con
               * dos comportamientos.
               */
              medicoId: appointment.medicoId,
            }),
          }).catch(() => {/* non-critical */})
        }
      } else {
        const res = await fetchAutenticado('/api/appointments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          // En un alta SÍ hay que sembrar las banderas de recordatorio (el update
          // las omite a propósito para no pisar lo que haya puesto el cron).
          body: JSON.stringify({
            clinicId,
            appointment: { ...payload, recordatorio24hEnviado: false, recordatorioMismoDiaEnviado: false },
            sobreagendarMotivo: conflict ? motivoSobreagenda.trim() : undefined,
          }),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok || !data.id) { toast(data.error || 'No se pudo agendar la cita', 'error'); return }
        id = data.id
        toast('Cita agendada', 'success')
        // Sync with Google Calendar in background
        if (user?.uid) {
          fetchAutenticado('/api/calendar/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'create',
              appointment: { ...payload, id, createdAt: '', updatedAt: '' },
              clinicId,
            }),
          }).catch(() => {/* non-critical */})
        }
      }
      onSaved?.(id)
      onClose()
    } catch {
      toast('Error al guardar la cita', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleWhatsApp = () => {
    if (!appointment || !telefono) return
    const msg = msgConfirmacion(appointment, config)
    openWhatsApp(telefono, msg)
  }

  const [enviandoPortal, setEnviandoPortal] = useState(false)
  const handleEnviarPortal = async () => {
    if (!appointment || !telefono || !clinicId) return
    setEnviandoPortal(true)
    try {
      const r = await fetchAutenticado('/api/portal/link', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clinicId, patientId: appointment.pacienteId }),
      })
      const data = await r.json().catch(() => ({}))
      if (!r.ok || !data.url) { toast(data.error || 'No se pudo generar el enlace', 'error'); return }
      const nombre = (appointment.pacienteNombre || '').split(' ')[0]
      /**
       * SE LE DICE AL PACIENTE QUE EL ENLACE ES SUYO Y CADUCA.
       *
       * El mensaje no advertía nada, y ese enlace da acceso a sus citas —motivo
       * incluido— y permite cancelar y reagendar. Quien lo reenvía a un grupo
       * familiar «para que le recuerden» está repartiendo esa llave sin saberlo.
       */
      const msg = `Hola ${nombre} 👋 Aquí puedes ver, confirmar o reagendar tu cita en línea:\n${data.url}\n\nEs un enlace personal y caduca en unos días — no lo compartas.`
      openWhatsApp(telefono, msg)
    } catch {
      toast('Sin conexión. Intenta de nuevo.', 'error')
    } finally {
      setEnviandoPortal(false)
    }
  }

  const [pidiendoResena, setPidiendoResena] = useState(false)
  const handlePedirResena = async () => {
    if (!appointment || !telefono || !clinicId) return
    /**
     * NO SE LE MANDA AL PACIENTE UN ENLACE QUE EL SERVIDOR NO CONOCE.
     *
     * `crearSolicitudResena` escribe con `setDoc`, y una escritura del SDK sin
     * red **resuelve en local**: la promesa cumple, la función devuelve el
     * token, y dos líneas más abajo se abre WhatsApp con un enlace que contiene
     * ese token. El servidor no lo ha visto nunca.
     *
     * El paciente lo abre y lee «Enlace no válido» — comprobado en
     * `app/resena/[token]`, que es lo que contesta cuando el documento no
     * existe. El médico cree que pidió la reseña; el paciente recibe un enlace
     * roto de su consultorio.
     *
     * Si la red vuelve antes de cerrar la pestaña, la cola de Firestore lo
     * sincroniza y el enlace acaba funcionando. Si no vuelve, se pierde: el
     * mensaje ya salió y el token no existirá jamás.
     *
     * Es «el dato tiene que LLEGAR» en su forma más literal — la regla del
     * repositorio dice que, cuando algo cruza una frontera, hay que mirar del
     * otro lado antes de dar nada por entregado. Aquí la frontera es un mensaje
     * a una persona real, y no se puede deshacer.
     *
     * Se comprueba antes de crear nada: crear el documento y no mandarlo
     * dejaría basura sincronizándose sin motivo.
     */
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      toast('Sin conexión: el enlace de reseña no llegaría al paciente. Inténtalo al recuperar la señal.', 'error')
      return
    }
    setPidiendoResena(true)
    try {
      const req = await crearSolicitudResena(clinicId, {
        citaId: appointment.id,
        pacienteId: appointment.pacienteId,
        pacienteNombre: appointment.pacienteNombre,
        medicoNombre: appointment.medicoNombre,
      })
      const nombre = (appointment.pacienteNombre || '').split(' ')[0]
      const msg = `Hola ${nombre} 🙏 ¿Nos ayudas con una reseña de tu consulta? Solo toma 30 segundos:\n${window.location.origin}/resena/${req.token}`
      openWhatsApp(telefono, msg)
    } catch {
      toast('No se pudo generar la reseña.', 'error')
    } finally {
      setPidiendoResena(false)
    }
  }

  if (!open) return null

  return (
    <Modal
      open
      onClose={onClose}
      size="wide"
      title={(
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
          {isEdit ? 'Editar cita' : 'Nueva cita'}
          {isEdit && <StatusBadge status={appointment!.estado} size="sm" />}
        </span>
      )}
      footer={(
        <>
          {isEdit && telefono && (
            <div style={{ display: 'flex', gap: 8, marginRight: 'auto', flexWrap: 'wrap' }}>
              <Button variant="secondary" size="sm" icon={<MessageSquare size={14} />} onClick={handleWhatsApp}>WhatsApp</Button>
              <Button variant="secondary" size="sm" icon={<Send size={14} />} onClick={handleEnviarPortal} loading={enviandoPortal} title="Enviar al paciente su portal de citas">Portal</Button>
              {appointment && ESTADOS_POST_VISITA.has(appointment.estado) && (
                <Button variant="secondary" size="sm" icon={<Star size={14} />} onClick={handlePedirResena} loading={pidiendoResena} title="Pedir reseña al paciente por WhatsApp">Reseña</Button>
              )}
            </div>
          )}
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSave} loading={saving} disabled={saving || (conflict && (!esMedicoReal || motivoSobreagenda.trim().length < 5))}>{isEdit ? 'Guardar cambios' : 'Agendar cita'}</Button>
        </>
      )}
    >
          <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 20px' }}>
            {/* Médico — a quién se agenda la cita (para consultorios con varios médicos) */}
            {activeDoctors.length > 1 && (
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label className="label">Médico *</label>
                <select className="input" value={medicoId} onChange={e => { setMedicoId(e.target.value); setHora('') }}>
                  {activeDoctors.map(d => <option key={d.id} value={d.id}>{d.nombre}</option>)}
                </select>
                <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 3 }}>La cita se agenda en la agenda de este médico (con su horario).</div>
              </div>
            )}

            {/* Paciente */}
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label className="label">Nombre del paciente *</label>
              <input className="input" value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Nombre completo" />
            </div>

            <div className="form-group">
              <label className="label"><Phone size={12} style={{ display: 'inline', marginRight: 4 }} />Teléfono</label>
              <input className="input" type="tel" value={telefono} onChange={e => setTelefono(e.target.value)} placeholder="6641234567" />
            </div>

            <div className="form-group">
              <label className="label">Origen</label>
              <select className="input" value={origen} onChange={e => setOrigen(e.target.value as AppointmentOrigin)}>
                {ORIGENES.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>

            {/* Tipo */}
            <div className="form-group">
              <label className="label">Tipo de consulta *</label>
              <select className="input" value={tipo} onChange={e => setTipo(e.target.value as AppointmentType)}>
                {TIPOS.map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="label"><Clock size={12} style={{ display: 'inline', marginRight: 4 }} />Duración (min)</label>
              <input className="input" type="number" min={10} max={180} step={5} value={duracion} onChange={e => setDuracion(Number(e.target.value))} />
            </div>

            {/* Fecha */}
            <div className="form-group">
              <label className="label">Fecha *</label>
              <input className="input" type="date" value={fecha} onChange={e => setFecha(e.target.value)} min={today} max={FECHA_MAXIMA_AGENDA} />
            </div>

            {/* Hora */}
            <div className="form-group">
              <label className="label" htmlFor="cita-hora">
                Hora *
                {slots.length > 0 && !horaManual && (
                  <span style={{ marginLeft: 6, fontSize: 11, color: 'var(--text3)' }}>
                    ({slots.length} disponibles)
                  </span>
                )}
              </label>
              {slots.length > 0 && !horaManual ? (
                <select
                  id="cita-hora"
                  className="input"
                  value={hora}
                  onChange={e => setHora(e.target.value)}
                >
                  <option value="">Seleccionar hora</option>
                  {slots.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              ) : (
                <input id="cita-hora" className="input" type="time" value={hora} onChange={e => setHora(e.target.value)} />
              )}
              {/*
                LA PUERTA, NO LA REJA.
                El campo libre existía pero sólo salía con el día COMPLETO —justo
                cuando ya no sirve—, así que una hora libre que la lista no
                trajera era inalcanzable. Se ofrece siempre, y lo tecleado pasa
                por los mismos chequeos que lo elegido: `hasConflict` aquí y el
                409 del servidor después. `type="button"` para que no envíe el
                formulario, y alto de 44 px para que sirva con el dedo.
              */}
              {slots.length > 0 && (
                <button
                  type="button"
                  onClick={() => setHoraManual(v => !v)}
                  style={{
                    background: 'none', border: 'none', padding: '0 2px', marginTop: 2,
                    minHeight: 44, display: 'flex', alignItems: 'center', gap: 5,
                    fontSize: 12, color: 'var(--teal)', cursor: 'pointer', textAlign: 'left',
                  }}
                >
                  <Clock size={13} aria-hidden="true" />
                  {horaManual ? 'Elegir de las horas libres' : 'Escribir la hora a mano'}
                </button>
              )}
              {horaManual && (
                <div style={{ fontSize: 10.5, color: 'var(--text3)', marginTop: 2, lineHeight: 1.45 }}>
                  Puedes poner cualquier hora dentro del horario del día. Si se empalma con otra
                  cita, se avisa aquí abajo y hace falta el motivo del médico.
                </div>
              )}
              {/*
                SI NO SE PUDO PREGUNTAR A GOOGLE, SE DICE.
                «No pude consultar» y «no tiene nada» producen la misma lista
                vacía de ocupación, y sólo uno de los dos significa que esas
                horas están libres. Callarlo haría que la pantalla ofreciera con
                confianza horas que el médico ya tiene tomadas.
              */}
              {/*
                Y LO MISMO PARA LAS CITAS PROPIAS, que es la fuente PRINCIPAL.
                El aviso de aquí abajo existía sólo para Google —el calendario
                secundario— y no para la agenda del consultorio. Con la consulta
                caída, el desplegable ofrecía las horas ya tomadas y el chequeo
                de conflicto decía «no hay». La cita no llega a escribirse
                —el servidor la re-chequea en transacción y devuelve 409—, pero
                para entonces ya se le dijo la hora al paciente por teléfono.
              */}
              {falloCitas && (
                <div style={AVISO_NO_SE_PUDO_CONSULTAR}>
                  <AlertCircle size={13} style={{ flexShrink: 0, marginTop: 1 }} />
                  <span>No se pudo cargar tu agenda de ese día: estas horas <strong>no</strong> descuentan las citas que ya tengas, y no se pudo revisar si hay empalme. Vuelve a abrir el modal cuando cargue.</span>
                </div>
              )}
              {falloGoogle && (
                <div style={AVISO_NO_SE_PUDO_CONSULTAR}>
                  <AlertCircle size={13} style={{ flexShrink: 0, marginTop: 1 }} />
                  <span>No se pudo consultar tu Google Calendar: estas horas <strong>no</strong> descuentan lo que ya tengas ahí.</span>
                </div>
              )}
              {ocupadoGoogle.length > 0 && (
                <div style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 6 }}>
                  Se descontaron {ocupadoGoogle.length} {ocupadoGoogle.length === 1 ? 'evento' : 'eventos'} de tu Google Calendar.
                </div>
              )}
              {/*
                PRIMERO EL MOTIVO DE VERDAD.
                Cuando la hora se sale del horario, `conflict` también es `true`,
                y el aviso de abajo decía «ya está ocupado» — falso, y encima
                mandaba a una salida (el motivo de sobreagenda) que el servidor
                no acepta para este caso: responde 409 sin excepción. Se dice qué
                pasa y qué lo arregla.
              */}
              {noCabe && (
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 5, fontSize: 12, color: 'var(--red)', marginTop: 6, lineHeight: 1.45 }}>
                  <AlertCircle size={13} style={{ flexShrink: 0, marginTop: 1 }} />
                  <span>
                    {noCabe.razon === 'dia-cerrado'
                      ? 'Ese día el consultorio no da servicio. Elige otra fecha, o activa el día en Configuración → Horario.'
                      : noCabe.razon === 'horario-invalido'
                        ? `El horario de ese día está mal configurado (${noCabe.detalle}). Revísalo en Configuración → Horario.`
                        : <>Con <strong>{duracion} min</strong>, las {hora} no caben en el horario de ese día ({noCabe.abre}–{noCabe.cierra}). Baja la duración o mueve la hora.</>}
                  </span>
                </div>
              )}
              {conflict && !noCabe && (
                <div style={{ marginTop: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--red)' }}>
                    <AlertCircle size={13} /> Ese horario ya está ocupado
                  </div>
                  {/*
                    La salida autorizada, no un muro — y sólo para el médico.
                    A la asistente se le dice POR QUÉ no puede, en vez de
                    esconderle el botón: un límite que no se explica se rodea,
                    y la forma de rodearlo aquí es teclear «10:05» a mano, que
                    es justo lo que esto vino a evitar.
                  */}
                  {esMedicoReal ? (
                    <>
                      <input
                        className="input"
                        style={{ marginTop: 6 }}
                        value={motivoSobreagenda}
                        onChange={e => setMotivoSobreagenda(e.target.value)}
                        placeholder="Motivo para sobreagendar (urgencia, indicación del médico…)"
                        maxLength={200}
                      />
                      <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>
                        Sin motivo no se agenda encima. Con motivo, queda registrado quién y por qué.
                      </div>
                    </>
                  ) : (
                    <div style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 6 }}>
                      Agendar encima de otra cita lo autoriza el médico desde su sesión: es una decisión
                      sobre su tiempo de consulta. Elige otro horario o pídeselo.
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Estado (only on edit) */}
            {isEdit && (
              <div className="form-group">
                <label className="label">Estado</label>
                <select className="input" value={estado} onChange={e => setEstado(e.target.value as AppointmentStatus)}>
                  {STATUSES_EDIT.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            )}

            {/* Motivo */}
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label className="label">Motivo de consulta</label>
              <input className="input" value={motivo} onChange={e => setMotivo(e.target.value)} placeholder="Descripción breve del motivo" />
            </div>

            {/* Notas internas */}
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label className="label">Notas internas</label>
              <textarea className="input" value={notas} onChange={e => setNotas(e.target.value)} placeholder="Notas visibles solo para el equipo" rows={2} />
            </div>

            {/* Consent */}
            <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="checkbox" id="consent" checked={consent}
                onChange={e => setConsent(e.target.checked)}
                style={{ accentColor: 'var(--teal)', width: 15, height: 15 }}
              />
              <label htmlFor="consent" style={{ fontSize: 13, color: 'var(--text2)', cursor: 'pointer' }}>
                Paciente acepta recibir mensajes de WhatsApp
              </label>
            </div>
          </div>
    </Modal>
  )
}
