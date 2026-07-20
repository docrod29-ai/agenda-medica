'use client'
import { useState, useEffect, useMemo } from 'react'
import { Appointment, AppointmentType, AppointmentStatus, AppointmentOrigin, APPOINTMENT_TYPE_CONFIG, DEFAULT_CONFIG } from '@/types'
import { useConfig } from '@/hooks/useConfig'
import { useAppointments } from '@/hooks/useAppointments'
import { useDoctors } from '@/hooks/useDoctors'
import { useFiltroMedico } from '@/components/DoctorFilter'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/context/ToastContext'
import { getAvailableSlots, hasConflict } from '@/lib/availability'
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
   * La ventana la manda el padre. Cada llamada al hook tiene estado propio, así
   * que un `useAppointments()` sin argumento NO heredaba la ventana ampliada de la
   * pantalla que abre el modal: al editar una cita de hace más de 120 días, para
   * el modal ese día estaba VACÍO — ofrecía como libres todos los horarios,
   * incluido el de la cita de al lado, y el chequeo de conflicto decía que no
   * había ninguno. Se podía mover una cita encima de otra sin advertencia.
   */
  const { appointments } = useAppointments(fecha ? `${fecha} 00:00` : undefined)
  const [tipo, setTipo]           = useState<AppointmentType>('primera-vez')
  const [duracion, setDuracion]   = useState(60)
  const [motivo, setMotivo]       = useState('')
  const [notas, setNotas]         = useState('')
  const [origen, setOrigen]       = useState<AppointmentOrigin>('Manual')
  const [estado, setEstado]       = useState<AppointmentStatus>('pendiente-confirmar')
  const [consent, setConsent]     = useState(true)
  const [saving, setSaving]       = useState(false)
  const [conflict, setConflict]   = useState(false)
  const [bloques, setBloques]     = useState<TimeBlock[]>([])
  const [medicoId, setMedicoId]   = useState<string>('')  // médico al que se agenda la cita

  useEffect(() => {
    if (open && clinicId) listarBloques(clinicId).then(setBloques).catch(() => {})
  }, [open, clinicId])

  // Populate on edit
  useEffect(() => {
    if (!open) return
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
    } else {
      setNombre(''); setTelefono(''); setFecha(defaultDate ?? today)
      setHora(defaultHour ?? ''); setTipo('primera-vez'); setDuracion(60)
      setMotivo(''); setNotas(''); setOrigen('Manual')
      setEstado('pendiente-confirmar'); setConsent(true)
      // Nueva cita: al médico que la asistente tiene filtrado, o al primero.
      setMedicoId(filtroMedico || activeDoctors[0]?.id || '')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, appointment, defaultDate, defaultHour, today])

  // Médico seleccionado + su PROPIO horario/duraciones (cada médico agenda distinto).
  const doctorSel = useMemo(() => activeDoctors.find(d => d.id === medicoId), [activeDoctors, medicoId])
  const cfgAgenda = useMemo(() => doctorSel ? {
    ...config,
    horario: doctorSel.horario ?? config.horario,
    duraciones: doctorSel.duraciones ?? config.duraciones,
    intervaloMinutos: doctorSel.intervaloMinutos ?? config.intervaloMinutos,
    zonaHoraria: doctorSel.zonaHoraria ?? config.zonaHoraria,
  } : config, [doctorSel, config])

  // Auto-fill duration from type (según el médico seleccionado)
  useEffect(() => {
    if (!isEdit) {
      const d = cfgAgenda.duraciones?.[tipo] ?? APPOINTMENT_TYPE_CONFIG[tipo].defaultMinutes
      setDuracion(d)
    }
  }, [tipo, cfgAgenda.duraciones, isEdit])

  // Available slots — con el horario del médico y solo SUS citas
  const slots = useMemo(() => {
    if (!fecha) return []
    return getAvailableSlots(fecha, duracion, appointments, cfgAgenda, appointment?.id, bloques, medicoId || undefined)
  }, [fecha, duracion, appointments, cfgAgenda, appointment?.id, medicoId, bloques])

  // Conflict check (médico-aware + bloqueos, igual que los slots)
  useEffect(() => {
    if (!fecha || !hora) { setConflict(false); return }
    setConflict(hasConflict(fecha, hora, duracion, appointments, appointment?.id, bloques, medicoId || undefined, config))
    /**
     * Si se sube la duración DESPUÉS de elegir la hora, esa hora puede dejar de
     * caber. El desplegable se quedaba visualmente en blanco pero el estado seguía
     * con la hora vieja, así que se guardaba una cita que terminaba después del
     * cierre. Se limpia para obligar a elegir de nuevo entre las que sí caben.
     */
    if (hora && slots.length > 0 && !slots.includes(hora)) setHora('')
  }, [fecha, hora, duracion, appointments, appointment?.id, medicoId, bloques])

  const handleSave = async () => {
    if (!nombre.trim()) { toast('Ingresa el nombre del paciente', 'error'); return }
    if (!fecha || !hora) { toast('Selecciona fecha y hora', 'error'); return }
    if (conflict) { toast('Hay un conflicto de horario', 'error'); return }

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
          body: JSON.stringify({ clinicId, appointment: payload, reagendarId: appointment.id }),
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
        // If appointment cancelled → notify waitlist
        const wasCancelled = ['cancelada', 'reagendada', 'no-asistio'].includes(estado) &&
          !['cancelada', 'reagendada', 'no-asistio'].includes(appointment.estado)
        if (wasCancelled) {
          fetchAutenticado('/api/whatsapp/waitlist-notify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              fecha: appointment.fechaHora.slice(0, 10),
              hora: appointment.fechaHora.slice(11, 16),
              clinicId,
              tipo: appointment.tipo,
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
      const msg = `Hola ${nombre} 👋 Aquí puedes ver, confirmar o reagendar tu cita en línea:\n${data.url}`
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
          <Button onClick={handleSave} loading={saving} disabled={saving || conflict}>{isEdit ? 'Guardar cambios' : 'Agendar cita'}</Button>
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
              <input className="input" type="date" value={fecha} onChange={e => setFecha(e.target.value)} min={today} />
            </div>

            {/* Hora */}
            <div className="form-group">
              <label className="label">
                Hora *
                {slots.length > 0 && (
                  <span style={{ marginLeft: 6, fontSize: 11, color: 'var(--text3)' }}>
                    ({slots.length} disponibles)
                  </span>
                )}
              </label>
              {slots.length > 0 ? (
                <select
                  className="input"
                  value={hora}
                  onChange={e => setHora(e.target.value)}
                >
                  <option value="">Seleccionar hora</option>
                  {slots.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              ) : (
                <input className="input" type="time" value={hora} onChange={e => setHora(e.target.value)} />
              )}
              {conflict && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#f87171', marginTop: 4 }}>
                  <AlertCircle size={13} /> Conflicto con otra cita
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
