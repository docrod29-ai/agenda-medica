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
import { useFiltroMedico, colorMedico } from '@/components/DoctorFilter'
import { TipoCitaIcon } from '@/components/TipoCitaIcon'
import { useToast } from '@/context/ToastContext'
import { getPatients, createPatient } from '@/lib/firestore'
import { elegirExpedienteParaCita } from '@/lib/pacientes/duplicados'
import { normalizarNombre } from '@/lib/csv-pacientes'
import type { Patient } from '@/types'
import { fetchAutenticado } from '@/lib/auth-client'
import { getAvailableSlots } from '@/lib/availability'
import { listarBloques, type TimeBlock } from '@/lib/time-blocks'
import { AppointmentType, APPOINTMENT_TYPE_CONFIG } from '@/types'
import { CalendarDays, Clock, User, Phone, Stethoscope, CheckCircle2, Loader2, ChevronLeft, ChevronRight } from 'lucide-react'
import { format, addDays } from 'date-fns'
import { es } from 'date-fns/locale'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useClinic } from '@/context/ClinicContext'
import { hoyISO, sumarDiasISO } from '@/lib/timezone'
import { configParaMedico } from '@/lib/horario-medico'

function todayStr() {
  return hoyISO()  // fecha en zona MX, no UTC (bug "hoy salta a mañana")
}

function addDaysToStr(d: string, n: number): string {
  return sumarDiasISO(d, n)
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
  return (
    <Suspense fallback={<div style={{ padding: 24, color: 'var(--text3)' }}>Cargando…</div>}>
      <AsistenteInner />
    </Suspense>
  )
}

function AsistenteInner() {
  const { user } = useAuth()
  const { clinicId } = useClinic()
  const { appointments } = useAppointments()
  const { config } = useConfig()
  const { activeDoctors, loading: doctorsLoading } = useDoctors()
  const [medicoPreferido] = useFiltroMedico()
  const { toast } = useToast()
  const sp = useSearchParams()

  // Lectura de query params (?fecha=YYYY-MM-DD&hora=HH:MM)
  const fechaParam = sp.get('fecha')
  const horaParam = sp.get('hora')

  // Form state
  const [nombre, setNombre] = useState('')
  const [telefono, setTelefono] = useState('')
  const [consiente, setConsiente] = useState(true)   // consentimiento de mensajes (visible/toggleable)
  // Typeahead de paciente: sugiere pacientes existentes al escribir (reconocer >
  // recordar) → autollena nombre+teléfono, menos tecleo y menos errores/duplicados.
  const [pacientesDir, setPacientesDir] = useState<Patient[]>([])
  const [mostrarSug, setMostrarSug] = useState(false)
  const [doctorId, setDoctorId] = useState('')
  const [tipo, setTipo] = useState<AppointmentType>('primera-vez')
  const [fecha, setFecha] = useState(fechaParam || todayStr())
  const [horaSeleccionada, setHoraSeleccionada] = useState(horaParam || '')
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)

  // Set default doctor — preferimos el filtro global de la asistente si lo tiene
  useEffect(() => {
    if (!doctorId && activeDoctors.length > 0) {
      const preseleccionado = medicoPreferido && activeDoctors.find(d => d.id === medicoPreferido)
      setDoctorId(preseleccionado ? medicoPreferido : activeDoctors[0].id)
    }
  }, [activeDoctors, doctorId, medicoPreferido])

  // Reset hour when date/tipo/doctor changes
  useEffect(() => {
    setHoraSeleccionada('')
  }, [fecha, tipo, doctorId])

  // Bloqueos (vacaciones/ausencias) → no ofrecer horarios en esos periodos.
  const [bloques, setBloques] = useState<TimeBlock[]>([])
  useEffect(() => {
    if (clinicId) listarBloques(clinicId).then(setBloques).catch(() => {})
  }, [clinicId])

  // Directorio de pacientes para el typeahead (getPatients está cacheado).
  useEffect(() => {
    if (clinicId) getPatients(clinicId).then(setPacientesDir).catch(() => {})
  }, [clinicId])

  const sugerencias = useMemo(() => {
    const q = normalizarNombre(nombre)
    const tel = nombre.replace(/\D/g, '')
    if (q.length < 2 && tel.length < 3) return []
    return pacientesDir.filter(p =>
      (q.length >= 2 && normalizarNombre(p.nombre).includes(q)) ||
      (tel.length >= 3 && (p.telefono || '').replace(/\D/g, '').includes(tel)),
    ).slice(0, 6)
  }, [nombre, pacientesDir])

  const elegirPaciente = (p: Patient) => {
    setNombre(p.nombre)
    setTelefono(p.telefono || '')
    setMostrarSug(false)
  }

  /**
   * EL HORARIO DEL MÉDICO, CON EL MISMO CRITERIO QUE EL SERVIDOR.
   *
   * Aquí se tomaba `doctor.horario ?? config.horario` **siempre**, y esa copia en
   * `doctors/{id}` es un FÓSIL: se escribe al dar de alta al médico y no se
   * vuelve a tocar. `configParaMedico` —que es lo que usan el modal de citas y la
   * ruta que da de alta— sólo la respeta si el médico tiene `horarioPropio`.
   *
   * O sea que esta pantalla, que es la puerta principal para agendar, calculaba
   * los huecos contra un horario que el consultorio ya no tiene, y el servidor
   * validaba contra el vigente. Las dos formas de fallar:
   *
   *  · ofrecer un hueco que el servidor rechaza con un 409 sin explicación;
   *  · esconder huecos que sí estaban libres.
   *
   * Y `duraciones` salía del mismo fósil y viajaba en el POST, así que era una
   * segunda vía para el mismo 409.
   *
   * Era el último `horario ??` crudo que quedaba en `src/`.
   */
  const efectiveConfig = useMemo(
    () => configParaMedico(config, activeDoctors.find(d => d.id === doctorId)),
    [config, activeDoctors, doctorId],
  )

  // Calculate duration for selected type
  const duracion = efectiveConfig.duraciones?.[tipo] ?? 30

  // Available slots for selected date
  const slots = useMemo(() => {
    if (!fecha || !efectiveConfig) return []
    return getAvailableSlots(fecha, duracion, appointments, efectiveConfig, undefined, bloques, doctorId || undefined)
  }, [fecha, duracion, appointments, efectiveConfig, doctorId, bloques])

  // Navegación por MES: se puede avanzar hasta 12 meses (1 año) con las flechas ◀ ▶.
  const MAX_MES_OFFSET = 12
  const [mesOffset, setMesOffset] = useState(0)

  // Fecha (día 1) del mes que se está viendo. offset 0 = mes actual.
  const mesVista = useMemo(() => {
    const base = new Date(todayStr() + 'T12:00:00')
    return new Date(base.getFullYear(), base.getMonth() + mesOffset, 1, 12, 0, 0)
  }, [mesOffset])

  const mesLabel = mesVista.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })

  // Días agendables del mes visto (desde HOY si es el mes actual; nunca días pasados).
  const diasDelMes = useMemo(() => {
    const year = mesVista.getFullYear()
    const month = mesVista.getMonth()
    const ultimoDia = new Date(year, month + 1, 0).getDate()
    const hoy = todayStr()
    const dias: string[] = []
    for (let dia = 1; dia <= ultimoDia; dia++) {
      const iso = `${year}-${String(month + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
      if (iso >= hoy) dias.push(iso)
    }
    return dias
  }, [mesVista])

  const handleSubmit = async () => {
    if (!nombre.trim()) { toast('Ingresa el nombre del paciente', 'error'); return }
    if (!horaSeleccionada) { toast('Selecciona un horario', 'error'); return }

    const doctor = activeDoctors.find(d => d.id === doctorId)
    setSaving(true)
    try {
      // ── Buscar o crear paciente en el directorio (para que aparezca en Expedientes) ──
      const tel = telefono.replace(/\D/g, '')
      const nombreLimpio = nombre.trim()
      let pacienteId = ''
      let avisoSinExpediente = false
      try {
        const pacientes = await getPatients(clinicId!)
        /**
         * CON QUÉ EXPEDIENTE SE FUNDE ESTA CITA.
         *
         * La regla anterior tenía dos ramas y la PRIMERA fundía por TELÉFONO A
         * SOLAS, sin mirar el nombre. En México el celular es de la casa: con la
         * madre registrada con el número de casa, la cita del hijo se colgaba del
         * expediente de ELLA — y con ella la nota, el diagnóstico y la receta que
         * se escribieran después.
         *
         * No es un expediente partido, que se arregla: es información clínica en
         * la persona equivocada, y no se ve como un error. Se ve como un paciente
         * que vino a consulta.
         *
         * El comentario que había aquí se preocupaba justo de eso —«la cita/el
         * expediente caían bajo la persona equivocada»— pero sólo se había
         * endurecido la segunda rama. La primera seguía abierta.
         *
         * Ahora decide `elegirExpedienteParaCita`, que exige DOS cosas: que los
         * nombres se parezcan (el teléfono nunca basta solo) y que los teléfonos
         * no se contradigan. Ante la duda crea uno nuevo, porque de los dos
         * errores posibles el duplicado es el barato.
         */
        const existente = elegirExpedienteParaCita(
          { nombre: nombreLimpio, telefono: tel },
          pacientes,
        )
        if (existente) {
          pacienteId = existente.id
        } else {
          pacienteId = await createPatient(clinicId!, {
            nombre: nombreLimpio,
            telefono: tel,
            noShowCount: 0,
            cancelacionCount: 0,
            createdAt: '',
            updatedAt: '',
            creadoPor: user?.email || 'asistente',
          })
        }
      } catch (e) {
        /**
         * La cita se crea igual —vale más una cita agendada que ninguna— pero YA
         * NO en silencio.
         *
         * Con `pacienteId` vacío la cita queda desligada del expediente: no sale
         * en el historial del paciente, ni en su portal, ni en la campaña de
         * reactivación (todas las huérfanas colapsan bajo la clave vacía). Antes
         * el catch se lo tragaba y el toast decía "Cita agendada" en verde, así
         * que nadie se enteraba nunca.
         */
        console.error('[asistente] no se pudo ligar la cita al expediente:', e)
        pacienteId = ''
        avisoSinExpediente = true
      }

      const res = await fetchAutenticado('/api/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clinicId,
          appointment: {
            pacienteId,
            pacienteNombre: nombreLimpio,
            pacienteTelefono: tel,
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
            consentimientoMensajes: !!telefono && consiente,
            creadoPor: user?.email || 'asistente',
            updatedPor: user?.email || 'asistente',
          },
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.id) { toast(data.error || 'No se pudo agendar la cita', 'error'); return }

      if (avisoSinExpediente) {
        toast(`Cita agendada para ${nombre.split(' ')[0]}, pero NO se pudo ligar al expediente. Revísala en Pacientes.`, 'error')
      } else {
        toast(`Cita agendada para ${nombre.split(' ')[0]}`, 'success')
      }
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

      <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
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
            {/* Nombre — con typeahead de pacientes existentes */}
            <div style={{ position: 'relative' }}>
              <label style={{ fontSize: 12, color: 'var(--text2)', display: 'block', marginBottom: 6 }}>
                Nombre completo *
              </label>
              <input
                value={nombre}
                onChange={e => { setNombre(e.target.value); setMostrarSug(true) }}
                onFocus={e => { e.currentTarget.style.borderColor = 'var(--teal)'; setMostrarSug(true) }}
                onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)'; setTimeout(() => setMostrarSug(false), 150) }}
                placeholder="Escribe para buscar o crear paciente"
                autoComplete="off"
                style={{
                  width: '100%', background: 'var(--s2)', border: '1px solid var(--border)',
                  borderRadius: 10, padding: '10px 14px', fontSize: 14, color: 'var(--text)',
                  outline: 'none',
                }}
              />
              {mostrarSug && sugerencias.length > 0 && (
                <div style={{
                  position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 20, marginTop: 4,
                  background: 'var(--s1)', border: '1px solid var(--border)', borderRadius: 10,
                  boxShadow: '0 12px 30px rgba(0,0,0,0.25)', overflow: 'hidden',
                }}>
                  {sugerencias.map((p, i) => (
                    <button
                      key={p.id}
                      type="button"
                      onMouseDown={e => { e.preventDefault(); elegirPaciente(p) }}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
                        width: '100%', textAlign: 'left', background: 'none', border: 'none',
                        borderTop: i === 0 ? 'none' : '1px solid var(--border)', cursor: 'pointer',
                        padding: '10px 14px',
                      }}
                    >
                      <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text)' }}>{p.nombre}</span>
                      <span style={{ fontSize: 12, color: 'var(--text3)' }}>{p.telefono || 'sin tel.'}</span>
                    </button>
                  ))}
                  <div style={{ padding: '7px 14px', fontSize: 11, color: 'var(--text3)', borderTop: '1px solid var(--border)', background: 'var(--s2)' }}>
                    ¿Nuevo? Sigue escribiendo el nombre completo.
                  </div>
                </div>
              )}
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
              {telefono.trim() && (
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, fontSize: 12.5, color: 'var(--text3)', cursor: 'pointer' }}>
                  <input type="checkbox" checked={consiente} onChange={e => setConsiente(e.target.checked)} />
                  El paciente autoriza recibir recordatorios por WhatsApp
                </label>
              )}
            </div>

            {/* Doctor selector — chips de color para distinguir entre múltiples médicos */}
            {activeDoctors.length > 1 && (
              <div>
                <label style={{ fontSize: 12, color: 'var(--text2)', display: 'block', marginBottom: 8 }}>
                  Médico que atenderá
                </label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {activeDoctors.map(d => {
                    const activo = doctorId === d.id
                    const color = colorMedico(d.id)
                    return (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() => setDoctorId(d.id)}
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: 8,
                          padding: '8px 14px', borderRadius: 'var(--r-pill)', cursor: 'pointer',
                          background: activo ? `color-mix(in srgb, ${color} 15%, transparent)` : 'var(--s2)',
                          color: activo ? color : 'var(--text2)',
                          border: activo ? `1.5px solid ${color}` : '1px solid var(--border)',
                          fontWeight: activo ? 700 : 500, fontSize: 13,
                          transition: 'all .12s',
                        }}
                      >
                        <span style={{
                          width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0,
                        }} />
                        {d.nombre.replace(/^Dr\.?\s+|^Dra\.?\s+/i, '').split(' ').slice(0, 2).join(' ')}
                        {d.especialidad && (
                          <span style={{ fontSize: 11, opacity: 0.75 }}>· {d.especialidad}</span>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Tipo de consulta */}
            <div>
              <label style={{ fontSize: 12, color: 'var(--text2)', display: 'block', marginBottom: 8 }}>
                Tipo de consulta
              </label>
              <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {TIPOS.map(t => (
                  <button
                    key={t.value}
                    onClick={() => setTipo(t.value)}
                    style={{
                      padding: '8px 12px', borderRadius: 8, fontSize: 12, fontWeight: 500,
                      border: tipo === t.value ? '1px solid var(--teal)' : '1px solid var(--border)',
                      background: tipo === t.value ? 'rgba(61,90,254,0.1)' : 'var(--s2)',
                      color: tipo === t.value ? 'var(--teal)' : 'var(--text2)',
                      cursor: 'pointer', transition: 'all 0.15s', textAlign: 'left',
                    }}
                  >
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><TipoCitaIcon tipo={t.value} size={13} /> {t.label}</span>
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
            {/* Navegador de MES con flechas — agenda en cualquier día hasta 1 año adelante */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 12 }}>
              <button
                type="button"
                onClick={() => setMesOffset(m => Math.max(0, m - 1))}
                disabled={mesOffset <= 0}
                aria-label="Mes anterior"
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: 34, height: 34, borderRadius: 8,
                  border: '1px solid var(--border)', background: 'var(--s2)',
                  color: mesOffset <= 0 ? 'var(--text3)' : 'var(--text)',
                  cursor: mesOffset <= 0 ? 'default' : 'pointer',
                  opacity: mesOffset <= 0 ? 0.4 : 1,
                }}
              >
                <ChevronLeft size={18} />
              </button>
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', textTransform: 'capitalize', textAlign: 'center', flex: 1 }}>
                {mesLabel}
              </span>
              <button
                type="button"
                onClick={() => setMesOffset(m => Math.min(MAX_MES_OFFSET, m + 1))}
                disabled={mesOffset >= MAX_MES_OFFSET}
                aria-label="Mes siguiente"
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: 34, height: 34, borderRadius: 8,
                  border: '1px solid var(--border)', background: 'var(--s2)',
                  color: mesOffset >= MAX_MES_OFFSET ? 'var(--text3)' : 'var(--text)',
                  cursor: mesOffset >= MAX_MES_OFFSET ? 'default' : 'pointer',
                  opacity: mesOffset >= MAX_MES_OFFSET ? 0.4 : 1,
                }}
              >
                <ChevronRight size={18} />
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 420, overflowY: 'auto' }}>
              {diasDelMes.map(d => {
                const daySlots = getAvailableSlots(d, duracion, appointments, efectiveConfig, undefined, bloques, doctorId || undefined)
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
                      background: isSelected ? 'rgba(61,90,254,0.1)' : 'var(--s2)',
                      color: daySlots.length === 0 ? 'var(--text3)' : isSelected ? 'var(--teal)' : 'var(--text)',
                      cursor: daySlots.length === 0 ? 'default' : 'pointer',
                      // Un día sin cupo va apagado, pero LEGIBLE: con 0.4 sobre un
                      // texto ya atenuado (--text3) quedaba casi invisible en claro.
                      opacity: daySlots.length === 0 ? 0.6 : 1,
                      transition: 'all 0.15s',
                    }}
                  >
                    <span style={{ textTransform: 'capitalize', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                      {isToday ? <><CalendarDays size={13} className="ds-icon" /> Hoy</> : formatDateLong(d)}
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
                      background: horaSeleccionada === h ? 'rgba(61,90,254,0.15)' : 'var(--s2)',
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
              <><CheckCircle2 size={16} /> Agendar cita</>
            )}
          </button>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
