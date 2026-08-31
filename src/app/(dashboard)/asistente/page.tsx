'use client'
/**
 * Portal del Asistente / Secretaria
 *
 * Vista simplificada: nombre, teléfono, doctor, tipo, fecha, hora disponible.
 * Un solo clic → cita creada.
 */
import { conMayusculaInicial } from '@/lib/texto-es'
import { mesesHastaElTecho, esFechaDeAgendaValida } from '@/lib/agenda/horizonte'
import { useState, useMemo, useEffect } from 'react'
import { useAppointments } from '@/hooks/useAppointments'
import { useConfig } from '@/hooks/useConfig'
import { useDoctors } from '@/hooks/useDoctors'
import { useFiltroMedico, colorMedico } from '@/components/DoctorFilter'
import { TipoCitaIcon } from '@/components/TipoCitaIcon'
import { useToast } from '@/context/ToastContext'
import { createPatient } from '@/lib/firestore'
import { candidatosDePaciente } from '@/lib/pacientes/candidatos'
import { elegirExpedienteParaCita } from '@/lib/pacientes/duplicados'
import { normalizarNombre } from '@/lib/csv-pacientes'
import type { Patient } from '@/types'
import { fetchAutenticado } from '@/lib/auth-client'
import { getAvailableSlots, esFestivo } from '@/lib/availability'
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
import { conTiempoLimite } from '@/lib/fetch-con-timeout'

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

/**
 * Techo para las lecturas de expediente del alta rápida. Generoso para una
 * conexión mala, muy por debajo de lo que nadie espera mirando un botón.
 */
const ESPERA_EXPEDIENTE_MS = 8000

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
  // Desde REG-351 las sugerencias las trae el SERVIDOR (`sugeridos`, más abajo):
  // no hay un «directorio» en memoria que filtrar, porque ese directorio venía
  // recortado y callaba a quien no cupo.
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

  /**
   * ── EL TYPEAHEAD PREGUNTA AL SERVIDOR (REG-351) ──────────────────────────
   *
   * Esto se bajaba «el directorio» y lo filtraba en memoria. Desde REG-341 ese
   * directorio viene **recortado**, así que en un consultorio grande el
   * typeahead dejaba de sugerir a un paciente que sí existe — y quien agenda,
   * al no verlo, lo da de alta otra vez. El resultado no es una lista fea: es
   * un expediente partido en dos.
   *
   * La sugerencia se ata al texto que la produjo. Sin eso se enseñarían un
   * instante los resultados de la búsqueda anterior, que en una lista de
   * pacientes significa enseñar **otra persona** a quien está agendando.
   */
  const [sugeridos, setSugeridos] = useState<{ q: string; pacientes: Patient[] } | null>(null)
  useEffect(() => {
    if (!clinicId) return
    const q = nombre.trim()
    const tel = q.replace(/\D/g, '')
    // Por debajo de esto no hay consulta: dos letras sondean media agenda.
    if (normalizarNombre(q).length < 2 && tel.length < 3) return
    let vivo = true
    const t = setTimeout(() => {
      candidatosDePaciente(clinicId, { nombre: q, telefono: tel.length >= 3 ? q : '' })
        .then(c => { if (vivo) setSugeridos({ q, pacientes: c.pacientes }) })
        .catch(() => { /* sin red no se sugiere; el alta sigue disponible */ })
    }, 220)
    return () => { vivo = false; clearTimeout(t) }
  }, [clinicId, nombre])

  const sugerencias = useMemo(
    () => (sugeridos && sugeridos.q === nombre.trim() ? sugeridos.pacientes.slice(0, 6) : []),
    [sugeridos, nombre],
  )

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

  /**
   * POR QUÉ ESTE DÍA NO TIENE HUECOS.
   *
   * «No hay horarios» es cierto en tres situaciones que no significan lo
   * mismo para quien está al teléfono: el consultorio no abre ese día de la
   * semana, es festivo, o está lleno. Sólo la tercera se resuelve buscando
   * otra hora; las dos primeras se resuelven buscando otro DÍA.
   *
   * Regla 4 de `clinical-safety` en versión de agenda: ausencia de hueco no
   * es dato de ausencia. Si no se puede saber el motivo, se dice lo que se
   * sabe y nada más — no se inventa una explicación plausible.
   */
  const DIAS_SEMANA = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'] as const
  const motivoSinHorarios = useMemo(() => {
    if (!fecha || !efectiveConfig) return 'No hay horarios disponibles este día'
    if (esFestivo(fecha, efectiveConfig.diasFestivos)) return 'Ese día es festivo: el consultorio no abre.'
    const diaSemana = DIAS_SEMANA[new Date(fecha + 'T12:00:00').getDay()]
    const horario = efectiveConfig.horario?.[diaSemana]
    if (!horario?.activo) return 'El consultorio no abre ese día de la semana.'
    return 'Ese día ya está lleno: no queda ningún hueco libre.'
  }, [fecha, efectiveConfig])

  /**
   * Navegación por MES con las flechas ◀ ▶, hasta el techo REAL de la agenda.
   *
   * Era `12`, escrito a mano. Eso hacía de esta pantalla un tercer horizonte
   * —ni el techo de la plataforma ni la ventana del portal público— y la misma
   * asistente, en `citas`, tenía a su lado un campo que llega a 2050. Dos
   * alcances para la misma persona, y ninguno que dijera el suyo.
   * Ver `@/lib/agenda/horizonte`.
   */
  const MAX_MES_OFFSET = useMemo(() => mesesHastaElTecho(todayStr()), [])
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
      // Ni días pasados ni días que el servidor va a rechazar por pasar el techo.
      if (iso >= hoy && esFechaDeAgendaValida(iso)) dias.push(iso)
    }
    return dias
  }, [mesVista])

  /**
   * CUÁNTOS LUGARES TIENE CADA DÍA DEL MES — una sola vez.
   *
   * Esto se calculaba DENTRO del `map` que pinta la lista, así que
   * `getAvailableSlots` corría una vez por día en cada render, y la sugerencia
   * de «ir al primer día con lugar» lo habría vuelto a correr por su cuenta.
   * Calculado aquí, la lista y la sugerencia leen lo mismo — y no pueden
   * discrepar sobre cuántos lugares tiene un día.
   */
  const lugaresPorDia = useMemo(() => {
    if (!efectiveConfig) return []
    return diasDelMes.map(dia => ({
      dia,
      lugares: getAvailableSlots(dia, duracion, appointments, efectiveConfig, undefined, bloques, doctorId || undefined).length,
    }))
  }, [diasDelMes, duracion, appointments, efectiveConfig, doctorId, bloques])

  /**
   * El primer día del mes a la vista que SÍ tiene lugar. Se OFRECE, no se
   * salta: cambiar la fecha en silencio es lo que la asistente no puede
   * permitirse no haber visto.
   */
  const primerDiaConLugar = useMemo(
    () => lugaresPorDia.find(d => d.lugares > 0 && d.dia !== fecha) ?? null,
    [lugaresPorDia, fecha],
  )


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
        /**
         * CON TECHO, Y CONTRA EL CONJUNTO CORRECTO — las dos cosas.
         *
         * El techo: una lectura del SDK de Firestore sin red **no rechaza**, se
         * queda pendiente. El `try/catch` de abajo no podía capturar nada y el
         * `finally` que devuelve el botón a su sitio no llegaba a correr —
         * «Guardando…» para siempre, medido a 18 s. Vale igual para el sondeo
         * indexado de abajo, que es la misma clase de lectura.
         *
         * REG-351 — CON QUÉ SE COMPARA. Esto leía «el directorio», que desde
         * REG-341 viene recortado: por encima del techo `elegirExpedienteParaCita`
         * comparaba contra una lista que no contenía al paciente y creaba uno
         * nuevo. La regla de abajo seguía siendo correcta; lo que estaba mal era
         * el conjunto sobre el que decidía.
         *
         * Ahora los candidatos salen de dos sondeos indexados —teléfono y
         * nombre— y el coste no depende del tamaño del consultorio.
         */
        const { pacientes, sePudoPreguntar } = await conTiempoLimite(
          candidatosDePaciente(clinicId!, { nombre: nombreLimpio, telefono: tel }),
          ESPERA_EXPEDIENTE_MS, 'el expediente del paciente',
        )
        /**
         * Si NO se pudo preguntar, no se decide. Crear un expediente aquí sería
         * fabricar un duplicado a partir de un fallo de lectura, y colgar de él
         * la cita; el aviso ya existe para el caso de «sin expediente».
         */
        if (!sePudoPreguntar) throw new Error('no se pudo consultar el directorio de pacientes')
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
          pacienteId = await conTiempoLimite(createPatient(clinicId!, {
            nombre: nombreLimpio,
            telefono: tel,
            noShowCount: 0,
            cancelacionCount: 0,
            createdAt: '',
            updatedAt: '',
            creadoPor: user?.email || 'asistente',
          }), ESPERA_EXPEDIENTE_MS, 'el alta del expediente')
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
                          transition: 'all var(--mov-rapido) var(--mov-curva)',
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
              {/**
                * OCHO ALTERNATIVAS DE UNA ELECCIÓN NO SON OCHO OBJETOS.
                *
                * Cada tipo era un rectángulo con su propio borde: ocho cajas de
                * 179×56 con el mismo peso visual, una al lado de otra. Contadas
                * una a una parecen ocho tarjetas, y leídas de golpe son
                * inventario — §6 del encargo: «las tarjetas indican agrupación
                * con sentido, no decoran contenido».
                *
                * Pero además era FALSO como modelo: no son ocho cosas, son ocho
                * formas de contestar UNA pregunta. Un control, no un catálogo.
                *
                * Ahora el borde lo lleva el GRUPO y las opciones viven dentro,
                * separadas por líneas. La única que se destaca es la elegida —
                * que es la información que de verdad hay que ver de un vistazo.
                *
                * De paso deja de ser un montón de `<button>` sueltos y pasa a ser
                * un `radiogroup`: quien navega con teclado recorre el grupo con
                * las flechas en vez de tabular ocho veces, y el lector anuncia
                * «2 de 8» en vez de ocho botones sin relación.
                */}
              <div
                role="radiogroup"
                aria-label="Tipo de consulta"
                style={{
                  display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0,
                  border: '1px solid var(--border)', borderRadius: 'var(--r-md)',
                  overflow: 'hidden',
                }}
              >
                {TIPOS.map((t, i) => {
                  const elegido = tipo === t.value
                  const mins = efectiveConfig.duraciones?.[t.value] || 30
                  return (
                  <button
                    key={t.value}
                    role="radio"
                    aria-checked={elegido}
                    onClick={() => setTipo(t.value)}
                    className="nx-opcion-tipo"
                    data-elegido={elegido ? '' : undefined}
                    style={{
                      padding: '10px 12px', fontSize: 'var(--t-caption)', fontWeight: 500,
                      border: 'none',
                      /* Rejilla interna: línea a la izquierda salvo en la primera
                         columna, y arriba salvo en la primera fila. */
                      borderLeft: i % 2 === 1 ? '1px solid var(--border)' : 'none',
                      borderTop: i >= 2 ? '1px solid var(--border)' : 'none',
                      /* El fondo lo pinta la hoja por `data-elegido`: escrito
                         aquí en línea ganaría a `:hover` y lo dejaría muerto —
                         exactamente el defecto de la unidad 22, que cometí una
                         segunda vez en este mismo archivo antes de acordarme. */
                      color: elegido ? 'var(--teal)' : 'var(--text2)',
                      cursor: 'pointer', textAlign: 'left',
                      transition: 'background var(--mov-rapido) var(--mov-curva), color var(--mov-rapido) var(--mov-curva)',
                    }}
                  >
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontWeight: elegido ? 600 : 500 }}>
                      <TipoCitaIcon tipo={t.value} size={13} /> {t.label}
                    </span>
                    <span style={{ display: 'block', fontSize: 'var(--t-overline)', color: 'var(--text3)', marginTop: 2 }}>
                      {mins} min
                    </span>
                  </button>
                  )
                })}
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
                /* El fondo lo pone `nx-acc-caja`: en línea le ganaba al `:hover`
                   y las flechas del mes no acusaban el puntero. */
                className="nx-acc-caja"
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: 34, height: 34, borderRadius: 8,
                  border: '1px solid var(--border)',
                  color: mesOffset <= 0 ? 'var(--text3)' : 'var(--text)',
                  cursor: mesOffset <= 0 ? 'default' : 'pointer',
                  opacity: mesOffset <= 0 ? 0.4 : 1,
                }}
              >
                <ChevronLeft size={18} />
              </button>
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', textAlign: 'center', flex: 1 }}>
                {conMayusculaInicial(mesLabel)}
              </span>
              <button
                type="button"
                onClick={() => setMesOffset(m => Math.min(MAX_MES_OFFSET, m + 1))}
                disabled={mesOffset >= MAX_MES_OFFSET}
                aria-label="Mes siguiente"
                /* El fondo lo pone `nx-acc-caja`: en línea le ganaba al `:hover`
                   y las flechas del mes no acusaban el puntero. */
                className="nx-acc-caja"
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: 34, height: 34, borderRadius: 8,
                  border: '1px solid var(--border)',
                  color: mesOffset >= MAX_MES_OFFSET ? 'var(--text3)' : 'var(--text)',
                  cursor: mesOffset >= MAX_MES_OFFSET ? 'default' : 'pointer',
                  opacity: mesOffset >= MAX_MES_OFFSET ? 0.4 : 1,
                }}
              >
                <ChevronRight size={18} />
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 420, overflowY: 'auto' }}>
              {lugaresPorDia.map(({ dia: d, lugares }) => {
                const isSelected = d === fecha
                const isToday = d === todayStr()
                return (
                  <button
                    key={d}
                    onClick={() => setFecha(d)}
                    disabled={lugares === 0}
                    /*
                      `nx-chip` pone el fondo, y con eso se arreglan tres cosas
                      de una: el día acusa el puntero —en línea el fondo le
                      ganaba al `:hover`—, el elegido se anuncia por
                      `aria-pressed` en vez de sólo por color, y el tinte deja de
                      ser un `rgba(61,90,254,0.1)` escrito a mano —un azul que no
                      es de la paleta— para ser `--nexus-soft`, el token que ya
                      usan las demás píldoras del producto.
                    */
                    className="nx-chip"
                    aria-pressed={isSelected}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '10px 14px', borderRadius: 10, fontSize: 13,
                      border: isSelected ? '1px solid var(--teal)' : '1px solid var(--border)',
                      color: lugares === 0 ? 'var(--text3)' : isSelected ? 'var(--teal)' : 'var(--text)',
                      cursor: lugares === 0 ? 'default' : 'pointer',
                      // Un día sin cupo va apagado, pero LEGIBLE: con 0.4 sobre un
                      // texto ya atenuado (--text3) quedaba casi invisible en claro.
                      opacity: lugares === 0 ? 0.6 : 1,
                      transition: 'all var(--mov-rapido) var(--mov-curva)',
                    }}
                  >
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                      {isToday ? <><CalendarDays size={13} className="ds-icon" /> Hoy</> : conMayusculaInicial(formatDateLong(d))}
                    </span>
                    <span style={{ fontSize: 11, color: isSelected ? 'var(--teal)' : 'var(--text3)' }}>
                      {lugares > 0 ? `${lugares} ${lugares === 1 ? 'lugar' : 'lugares'}` : 'Sin lugar'}
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
                      cursor: 'pointer', transition: 'all var(--mov-rapido) var(--mov-curva)',
                    }}
                  >
                    {h}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/**
            * EL VACÍO DICE POR QUÉ, Y A DÓNDE IR.
            *
            * Aquí ponía «No hay horarios disponibles este día» y nada más. El
            * problema no era el tono: era que el día seleccionado por omisión
            * es HOY, y si hoy el consultorio no abre —sábado, domingo,
            * festivo— la asistente aterriza en un callejón sin salida
            * mientras, dos filas más arriba, hay un día con nueve lugares.
            *
            * Visto en el arnés: «Hoy · Sin lugar» seleccionado y en gris,
            * «Domingo 30 · Sin lugar», «Lunes 31 · 9 lugares». El mensaje
            * decía la verdad y aun así engañaba, porque quien lo lee entiende
            * «no hay citas» y no «hoy no se abre».
            *
            * Dos arreglos, ninguno mueve nada por su cuenta:
            *  · se dice el MOTIVO cuando se puede saber (cerrado / festivo /
            *    lleno). Ausencia de hueco no es lo mismo que ausencia de día.
            *  · se OFRECE el primer día con lugar, como acción de un clic. No
            *    se salta solo: un cambio de fecha en silencio es justo lo que
            *    la asistente no puede permitirse no haber visto.
            */}
          {fecha && slots.length === 0 && (
            <div style={{ textAlign: 'center', padding: '20px 8px', color: 'var(--text3)', fontSize: 13 }}>
              <div>{motivoSinHorarios}</div>
              {primerDiaConLugar && (
                <button
                  type="button"
                  onClick={() => setFecha(primerDiaConLugar.dia)}
                  className="btn btn-secondary btn-sm"
                  style={{ marginTop: 12 }}
                >
                  Ir al {conMayusculaInicial(formatDateLong(primerDiaConLugar.dia))} · {primerDiaConLugar.lugares} lugares
                </button>
              )}
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
              transition: 'all var(--mov-rapido) var(--mov-curva)', flexShrink: 0,
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
