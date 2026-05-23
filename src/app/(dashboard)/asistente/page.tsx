'use client'
/**
 * Portal del Asistente / Secretaria
 *
 * Vista simplificada: nombre, teléfono, doctor, tipo, fecha, hora disponible.
 * Un solo clic → cita creada.
 */
import { useState, useMemo, useEffect } from 'react'
import { useAppointments } from '@/hooks/useAppointments'
import { useConfig } from '@/hooks/useConfig'
import { useDoctors } from '@/hooks/useDoctors'
import { useToast } from '@/context/ToastContext'
import { createAppointment } from '@/lib/firestore'
import { getAvailableSlots } from '@/lib/availability'
import { AppointmentType, APPOINTMENT_TYPE_CONFIG } from '@/types'
import { CalendarDays, Clock, User, Phone, Stethoscope, CheckCircle2, Loader2 } from 'lucide-react'
import { format, addDays } from 'date-fns'
import { es } from 'date-fns/locale'
import { useAuth } from '@/hooks/useAuth'
import { useClinic } from '@/context/ClinicContext'

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

function addDaysToStr(d: string, n: number): string {
  const dt = new Date(d + 'T12:00:00')
  dt.setDate(dt.getDate() + n)
  return dt.toISOString().slice(0, 10)
}

function formatDateLong(d: string): string {
  return new Date(d + 'T12:00:00').toLocaleDateString('es-MX', {
    weekday: 'long', day: 'numeric', month: 'long',
  })
}

const TIPOS: { value: AppointmentType; label: string }[] = Object.entries(APPOINTMENT_TYPE_CONFIG).map(
  ([k, v]) => ({ value: k as AppointmentType, label: v.label })
)

export default function AsistentePage() {
  const { user } = useAuth()
  const { clinicId } = useClinic()
  const { appointments } = useAppointments()
  const { config } = useConfig()
  const { activeDoctors, loading: doctorsLoading } = useDoctors()
  const { toast } = useToast()

  // Form state
  const [nombre, setNombre] = useState('')
  const [telefono, setTelefono] = useState('')
  const [doctorId, setDoctorId] = useState('')
  const [tipo, setTipo] = useState<AppointmentType>('primera-vez')
  const [fecha, setFecha] = useState(todayStr())
  const [horaSeleccionada, setHoraSeleccionada] = useState('')
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)

  // Set default doctor
  useEffect(() => {
    if (!doctorId && activeDoctors.length > 0) {
      setDoctorId(activeDoctors[0].id)
    }
  }, [activeDoctors, doctorId])

  // Reset hour when date/tipo/doctor changes
  useEffect(() => {
    setHoraSeleccionada('')
  }, [fecha, tipo, doctorId])

  // Get effective config (doctor's config if available)
  const efectiveConfig = useMemo(() => {
    const doctor = activeDoctors.find(d => d.id === doctorId)
    if (!doctor) return config
    return {
      ...config,
      horario: doctor.horario,
      duraciones: doctor.duraciones,
      intervaloMinutos: doctor.intervaloMinutos,
    }
  }, [config, activeDoctors, doctorId])

  // Calculate duration for selected type
  const duracion = efectiveConfig.duraciones?.[tipo] ?? 30

  // Available slots for selected date
  const slots = useMemo(() => {
    if (!fecha || !efectiveConfig) return []
    return getAvailableSlots(fecha, duracion, appointments, efectiveConfig)
  }, [fecha, duracion, appointments, efectiveConfig])

  // Generate next 7 days
  const nextDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => addDaysToStr(todayStr(), i))
  }, [])

  const handleSubmit = async () => {
    if (!nombre.trim()) { toast('Ingresa el nombre del paciente', 'error'); return }
    if (!horaSeleccionada) { toast('Selecciona un horario', 'error'); return }

    const doctor = activeDoctors.find(d => d.id === doctorId)
    setSaving(true)
    try {
      await createAppointment(clinicId!, {
        pacienteId: '',
        pacienteNombre: nombre.trim(),
        pacienteTelefono: telefono.replace(/\D/g, ''),
        fechaHora: `${fecha} ${horaSeleccionada}`,
        duracion,
        tipo,
        motivo: '',
        estado: 'confirmada',
        origen: 'Manual',
        medicoNombre: doctor?.nombre || config.nombreMedico || '',
        medicoId: doctorId || '',
        doctorId: doctorId || '',
        lugar: config.nombreClinica || '',
        confirmadoPaciente: false,
        recordatorio24hEnviado: false,
        recordatorioMismoDiaEnviado: false,
        notasInternas: '',
        consentimientoMensajes: !!telefono,
        creadoPor: user?.email || 'asistente',
        updatedPor: user?.email || 'asistente',
        createdAt: '',
        updatedAt: '',
      })

      toast(`Cita agendada para ${nombre.split(' ')[0]}`, 'success')
      setSuccess(true)
      setTimeout(() => {
        setSuccess(false)
        setNombre('')
        setTelefono('')
        setHoraSeleccionada('')
      }, 2500)
    } catch {
      toast('Error al guardar la cita', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ padding: '24px', maxWidth: 900, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', margin: 0 }}>
          Portal del Asistente
        </h1>
        <p style={{ fontSize: 13, color: 'var(--text2)', marginTop: 4 }}>
          Agenda citas rápidamente
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* Left column — patient info */}
        <div style={{
          background: 'var(--s1)',
          border: '1px solid var(--border)',
          borderRadius: 16,
          padding: 24,
        }}>
          <h2 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
            <User size={16} color="var(--teal)" /> Datos del paciente
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Nombre */}
            <div>
              <label style={{ fontSize: 12, color: 'var(--text2)', display: 'block', marginBottom: 6 }}>
                Nombre completo *
              </label>
              <input
                value={nombre}
                onChange={e => setNombre(e.target.value)}
                placeholder="Nombre del paciente"
                style={{
                  width: '100%', background: 'var(--s2)', border: '1px solid var(--border)',
                  borderRadius: 10, padding: '10px 14px', fontSize: 14, color: 'var(--text)',
                  outline: 'none',
                }}
                onFocus={e => e.currentTarget.style.borderColor = 'var(--teal)'}
                onBlur={e => e.currentTarget.style.borderColor = 'var(--border)'}
              />
            </div>

            {/* Teléfono */}
            <div>
              <label style={{ fontSize: 12, color: 'var(--text2)', display: 'block', marginBottom: 6 }}>
                Teléfono (WhatsApp)
              </label>
              <div style={{ position: 'relative' }}>
                <Phone size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)' }} />
                <input
                  value={telefono}
                  onChange={e => setTelefono(e.target.value)}
                  placeholder="656 551 8875"
                  style={{
                    width: '100%', background: 'var(--s2)', border: '1px solid var(--border)',
                    borderRadius: 10, padding: '10px 14px 10px 34px', fontSize: 14, color: 'var(--text)',
                    outline: 'none',
                  }}
                  onFocus={e => e.currentTarget.style.borderColor = 'var(--teal)'}
                  onBlur={e => e.currentTarget.style.borderColor = 'var(--border)'}
                />
              </div>
            </div>

            {/* Doctor selector */}
            {activeDoctors.length > 1 && (
              <div>
                <label style={{ fontSize: 12, color: 'var(--text2)', display: 'block', marginBottom: 6 }}>
                  Médico
                </label>
                <select
                  value={doctorId}
                  onChange={e => setDoctorId(e.target.value)}
                  style={{
                    width: '100%', background: 'var(--s2)', border: '1px solid var(--border)',
                    borderRadius: 10, padding: '10px 14px', fontSize: 14, color: 'var(--text)',
                    outline: 'none',
                  }}
                >
                  {activeDoctors.map(d => (
                    <option key={d.id} value={d.id}>{d.nombre} — {d.especialidad}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Tipo de consulta */}
            <div>
              <label style={{ fontSize: 12, color: 'var(--text2)', display: 'block', marginBottom: 8 }}>
                Tipo de consulta
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {TIPOS.map(t => (
                  <button
                    key={t.value}
                    onClick={() => setTipo(t.value)}
                    style={{
                      padding: '8px 12px', borderRadius: 8, fontSize: 12, fontWeight: 500,
                      border: tipo === t.value ? '1px solid var(--teal)' : '1px solid var(--border)',
                      background: tipo === t.value ? 'rgba(0,212,168,0.1)' : 'var(--s2)',
                      color: tipo === t.value ? 'var(--teal)' : 'var(--text2)',
                      cursor: 'pointer', transition: 'all 0.15s', textAlign: 'left',
                    }}
                  >
                    {APPOINTMENT_TYPE_CONFIG[t.value].icon} {t.label}
                    <span style={{ display: 'block', fontSize: 10, color: 'var(--text3)', marginTop: 2 }}>
                      {duracion === efectiveConfig.duraciones?.[t.value] ? `${efectiveConfig.duraciones?.[t.value]} min` : `${efectiveConfig.duraciones?.[t.value] || 30} min`}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right column — date & time */}
        <div style={{
          background: 'var(--s1)',
          border: '1px solid var(--border)',
          borderRadius: 16,
          padding: 24,
          display: 'flex',
          flexDirection: 'column',
          gap: 20,
        }}>
          {/* Date selector */}
          <div>
            <h2 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
              <CalendarDays size={16} color="var(--teal)" /> Fecha
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {nextDays.map(d => {
                const daySlots = getAvailableSlots(d, duracion, appointments, efectiveConfig)
                const isSelected = d === fecha
                const isToday = d === todayStr()
                return (
                  <button
                    key={d}
                    onClick={() => setFecha(d)}
                    disabled={daySlots.length === 0}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '10px 14px', borderRadius: 10, fontSize: 13,
                      border: isSelected ? '1px solid var(--teal)' : '1px solid var(--border)',
                      background: isSelected ? 'rgba(0,212,168,0.1)' : 'var(--s2)',
                      color: daySlots.length === 0 ? 'var(--text3)' : isSelected ? 'var(--teal)' : 'var(--text)',
                      cursor: daySlots.length === 0 ? 'default' : 'pointer',
                      opacity: daySlots.length === 0 ? 0.4 : 1,
                      transition: 'all 0.15s',
                    }}
                  >
                    <span style={{ textTransform: 'capitalize' }}>
                      {isToday ? '📅 Hoy' : formatDateLong(d)}
                    </span>
                    <span style={{ fontSize: 11, color: isSelected ? 'var(--teal)' : 'var(--text3)' }}>
                      {daySlots.length > 0 ? `${daySlots.length} lugares` : 'Sin lugar'}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Time slots */}
          {fecha && slots.length > 0 && (
            <div>
              <h2 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Clock size={16} color="var(--teal)" /> Horario disponible
              </h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                {slots.map(h => (
                  <button
                    key={h}
                    onClick={() => setHoraSeleccionada(h)}
                    style={{
                      padding: '8px 4px', borderRadius: 8, fontSize: 13, fontWeight: 500,
                      border: horaSeleccionada === h ? '1px solid var(--teal)' : '1px solid var(--border)',
                      background: horaSeleccionada === h ? 'rgba(0,212,168,0.15)' : 'var(--s2)',
                      color: horaSeleccionada === h ? 'var(--teal)' : 'var(--text)',
                      cursor: 'pointer', transition: 'all 0.15s',
                    }}
                  >
                    {h}
                  </button>
                ))}
              </div>
            </div>
          )}

          {fecha && slots.length === 0 && (
            <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text3)', fontSize: 13 }}>
              No hay horarios disponibles este día
            </div>
          )}
        </div>
      </div>

      {/* Summary + submit */}
      {nombre && horaSeleccionada && (
        <div style={{
          marginTop: 20,
          background: 'var(--s1)',
          border: '1px solid var(--teal)',
          borderRadius: 16,
          padding: 20,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>
              {nombre}
            </span>
            <span style={{ fontSize: 13, color: 'var(--text2)' }}>
              {APPOINTMENT_TYPE_CONFIG[tipo].label} · {formatDateLong(fecha)} · {horaSeleccionada} hrs · {duracion} min
            </span>
          </div>
          <button
            onClick={handleSubmit}
            disabled={saving || success}
            style={{
              padding: '12px 28px', borderRadius: 12,
              background: success ? '#10b981' : 'var(--teal)',
              color: '#fff', fontSize: 14, fontWeight: 600, border: 'none',
              cursor: saving || success ? 'default' : 'pointer',
              display: 'flex', alignItems: 'center', gap: 8,
              transition: 'all 0.2s', flexShrink: 0,
            }}
          >
            {saving ? (
              <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Guardando…</>
            ) : success ? (
              <><CheckCircle2 size={16} /> ¡Agendado!</>
            ) : (
              '✅ Agendar cita'
            )}
          </button>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
