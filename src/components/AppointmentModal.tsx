'use client'
import { useState, useEffect, useMemo } from 'react'
import { Appointment, AppointmentType, AppointmentStatus, AppointmentOrigin, APPOINTMENT_TYPE_CONFIG, DEFAULT_CONFIG } from '@/types'
import { useConfig } from '@/hooks/useConfig'
import { useAppointments } from '@/hooks/useAppointments'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/context/ToastContext'
import { createAppointment, updateAppointment } from '@/lib/firestore'
import { getAvailableSlots, hasConflict } from '@/lib/availability'
import { StatusBadge } from './StatusBadge'
import { X, Phone, MessageSquare, Clock, AlertCircle, Loader2 } from 'lucide-react'
import { openWhatsApp, msgConfirmacion } from '@/lib/whatsapp'

interface Props {
  open: boolean
  onClose: () => void
  appointment?: Appointment | null
  defaultDate?: string
  defaultHour?: string
  onSaved?: (id: string) => void
}

const TIPOS = Object.entries(APPOINTMENT_TYPE_CONFIG) as [AppointmentType, { label: string; icon: string; defaultMinutes: number }][]

const ORIGENES: AppointmentOrigin[] = ['Manual', 'WhatsApp', 'Teléfono', 'Referido', 'Google Calendar', 'Otro']

const STATUSES_EDIT: AppointmentStatus[] = [
  'pendiente-confirmar', 'confirmada', 'recordatorio-enviado',
  'en-sala', 'en-consulta', 'atendida', 'finalizada',
  'cancelada', 'reagendada', 'no-asistio',
]

export function AppointmentModal({ open, onClose, appointment, defaultDate, defaultHour, onSaved }: Props) {
  const { config } = useConfig()
  const { appointments } = useAppointments()
  const { user } = useAuth()
  const { toast } = useToast()

  const isEdit = !!appointment

  const today = new Date().toISOString().slice(0, 10)

  const [nombre, setNombre]       = useState('')
  const [telefono, setTelefono]   = useState('')
  const [fecha, setFecha]         = useState(defaultDate ?? today)
  const [hora, setHora]           = useState(defaultHour ?? '')
  const [tipo, setTipo]           = useState<AppointmentType>('primera-vez')
  const [duracion, setDuracion]   = useState(60)
  const [motivo, setMotivo]       = useState('')
  const [notas, setNotas]         = useState('')
  const [origen, setOrigen]       = useState<AppointmentOrigin>('Manual')
  const [estado, setEstado]       = useState<AppointmentStatus>('pendiente-confirmar')
  const [consent, setConsent]     = useState(true)
  const [saving, setSaving]       = useState(false)
  const [conflict, setConflict]   = useState(false)

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
    } else {
      setNombre(''); setTelefono(''); setFecha(defaultDate ?? today)
      setHora(defaultHour ?? ''); setTipo('primera-vez'); setDuracion(60)
      setMotivo(''); setNotas(''); setOrigen('Manual')
      setEstado('pendiente-confirmar'); setConsent(true)
    }
  }, [open, appointment, defaultDate, defaultHour, today])

  // Auto-fill duration from type
  useEffect(() => {
    if (!isEdit) {
      const d = config.duraciones?.[tipo] ?? APPOINTMENT_TYPE_CONFIG[tipo].defaultMinutes
      setDuracion(d)
    }
  }, [tipo, config.duraciones, isEdit])

  // Available slots
  const slots = useMemo(() => {
    if (!fecha) return []
    return getAvailableSlots(fecha, duracion, appointments, config, appointment?.id)
  }, [fecha, duracion, appointments, config, appointment?.id])

  // Conflict check
  useEffect(() => {
    if (!fecha || !hora) { setConflict(false); return }
    setConflict(hasConflict(fecha, hora, duracion, appointments, appointment?.id))
  }, [fecha, hora, duracion, appointments, appointment?.id])

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
        medicoNombre: config.nombreMedico ?? '',
        confirmadoPaciente: ['confirmada', 'atendida', 'finalizada'].includes(estado),
        recordatorio24hEnviado: appointment?.recordatorio24hEnviado ?? false,
        recordatorioMismoDiaEnviado: appointment?.recordatorioMismoDiaEnviado ?? false,
        notasInternas: notas.trim(),
        consentimientoMensajes: consent,
        creadoPor: user?.email ?? '',
        updatedPor: user?.email ?? '',
      }

      let id: string
      if (isEdit && appointment) {
        await updateAppointment(appointment.id, payload)
        id = appointment.id
        toast('Cita actualizada', 'success')
        // Sync with Google Calendar in background
        if (user?.uid) {
          fetch('/api/calendar/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'update',
              appointment: { ...appointment, ...payload, id },
              uid: user.uid,
            }),
          }).catch(() => {/* non-critical */})
        }
        // If appointment cancelled → notify waitlist
        const wasCancelled = ['cancelada', 'reagendada', 'no-asistio'].includes(estado) &&
          !['cancelada', 'reagendada', 'no-asistio'].includes(appointment.estado)
        if (wasCancelled) {
          fetch('/api/whatsapp/waitlist-notify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              fecha: appointment.fechaHora.slice(0, 10),
              hora: appointment.fechaHora.slice(11, 16),
            }),
          }).catch(() => {/* non-critical */})
        }
      } else {
        id = await createAppointment({ ...payload, createdAt: '', updatedAt: '' })
        toast('Cita agendada', 'success')
        // Sync with Google Calendar in background
        if (user?.uid) {
          fetch('/api/calendar/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'create',
              appointment: { ...payload, id, createdAt: '', updatedAt: '' },
              uid: user.uid,
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

  if (!open) return null

  return (
    <div className="modal-overlay animate-fade-in" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-wide">
        {/* Header */}
        <div className="modal-header">
          <div>
            <h2 style={{ fontSize: 17, fontWeight: 600, color: 'var(--text)', margin: 0 }}>
              {isEdit ? 'Editar cita' : 'Nueva cita'}
            </h2>
            {isEdit && <StatusBadge status={appointment!.estado} size="sm" />}
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {isEdit && telefono && (
              <button className="btn btn-secondary btn-sm" onClick={handleWhatsApp} title="Enviar por WhatsApp">
                <MessageSquare size={14} /> WhatsApp
              </button>
            )}
            <button className="btn btn-ghost btn-icon" onClick={onClose}>
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="modal-body">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 20px' }}>
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
                  <option key={k} value={k}>{v.icon} {v.label}</option>
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
        </div>

        {/* Footer */}
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose} disabled={saving}>Cancelar</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving || conflict}>
            {saving ? <><Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> Guardando…</> : (isEdit ? 'Guardar cambios' : 'Agendar cita')}
          </button>
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
