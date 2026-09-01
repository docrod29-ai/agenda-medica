'use client'
import { conMayusculaInicial } from '@/lib/texto-es'
import { useState, useMemo } from 'react'
import { activable } from '@/lib/ui/activable'
import { useRouter } from 'next/navigation'
import { useAppointments } from '@/hooks/useAppointments'
import { useConfig } from '@/hooks/useConfig'
import { AppointmentModal } from '@/components/AppointmentModal'
import { DoctorFilter, useFiltroMedico, colorMedico } from '@/components/DoctorFilter'
import { useDoctors } from '@/hooks/useDoctors'
import { configParaMedico } from '@/lib/horario-medico'
import { StatusBadge } from '@/components/StatusBadge'
import { TipoCitaIcon } from '@/components/TipoCitaIcon'
import { Appointment, APPOINTMENT_TYPE_CONFIG, AppointmentStatus } from '@/types'
import { getWeekDates, esFestivo } from '@/lib/availability'
import { hoyISO } from '@/lib/timezone'
import { ChevronLeft, ChevronRight, Plus, Loader2, AlertCircle } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { useAhoraMinutos } from '@/hooks/useAhoraMinutos'
import { etiquetaDeCita } from '@/lib/agenda/etiqueta-de-cita'
import { horasAEnsenar, estaAbierto, type DiaDeHorario } from '@/lib/agenda/horas-a-ensenar'
import { anclaDeRejilla, diaDeRejilla } from '@/lib/agenda/dia-de-rejilla'

/**
 * Semántica VISUAL del estado en la rejilla del calendario.
 *
 * Antes las citas se coloreaban SOLO por médico: una cita cancelada, un "no
 * asistió" y una confirmada se veían idénticas, así que el estado solo era
 * legible abriendo la cita. Ahora el estilo del bloque refleja el estado:
 *  - cancelada / no-asistió → tenue + texto tachado (visualmente "muerta")
 *  - tentativas (solicitada, pendiente-*) → borde punteado
 *  - el resto → sólido (confirmada / atendida / pagada…)
 * La TINTE (hue) sigue siendo la del médico, útil en multi-doctor.
 */
function estiloEstadoCita(estado: AppointmentStatus): { opacity: number; borderStyle: 'solid' | 'dashed'; tachado: boolean } {
  /**
   * CANCELADA: 0,45 → 0,72.
   *
   * A 0,45 TODO lo que hay dentro de la cita cancelada caía por debajo del
   * contraste mínimo: el nombre del paciente, la insignia de estado y la línea
   * de tipo y duración. Era la última violación de axe que quedaba en el
   * calendario, y aparecía en las tres vistas.
   *
   * La tentación es declararla intocable «porque atenuar es la señal». Pero la
   * señal ya está dicha por otras TRES vías que no cuestan legibilidad:
   *
   *   · el tachado del nombre,
   *   · el borde discontinuo,
   *   · y el estado dentro del nombre accesible («— Cancelada»),
   *     además de la insignia en la vista de día.
   *
   * La opacidad era la única redundante Y la única que hacía ilegible el dato.
   * A 0,72 la cita sigue leyéndose como apagada frente a las vivas —que están a
   * 1 y a 0,85— y su contenido vuelve a poder leerse.
   *
   * Regla que deja: una señal de estado no puede pagarse con el contraste del
   * dato que señala, si hay otra forma de decir lo mismo.
   */
  if (estado === 'cancelada' || estado === 'no-asistio') return { opacity: 0.72, borderStyle: 'dashed', tachado: true }
  if (estado === 'solicitada' || estado === 'pendiente-confirmar' || estado === 'pendiente-datos' || estado === 'reagendada') return { opacity: 0.85, borderStyle: 'dashed', tachado: false }
  return { opacity: 1, borderStyle: 'solid', tachado: false }
}

/** Lunes a domingo, que es como se numera la rejilla de este producto. */
const ORDEN_SEMANA = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'] as const

type View = 'semana' | 'mes' | 'dia'

/**
 * La rejilla YA NO va de 7 a 19 escrito a mano. Se calcula, y por qué está en
 * `lib/agenda/horas-a-ensenar`: una cita a las 20:30 no encontraba celda y
 * desaparecía de la pantalla donde el médico mira su día.
 */

/** Cómo se llama el salto de las flechas según lo que se esté mirando. */
const ETIQUETA_PASO: Record<View, string> = { dia: 'Día', semana: 'Semana', mes: 'Mes' }

export default function CalendarioPage() {
  const router = useRouter()
  /**
   * EL CALENDARIO ABRE EN EL «HOY» DEL CONSULTORIO, no en el del navegador.
   *
   * `new Date()` es el reloj del aparato. `hoyISO()` es el día en la zona del
   * consultorio, y es el que usa TODO lo demás de esta pantalla: la vista de
   * día, y el resaltado de «hoy» en la cabecera de la semana.
   *
   * Cuando los dos no coinciden —y para un consultorio en México con el aparato
   * en UTC eso pasa TODAS LAS TARDES, de las 18:00 en adelante— la rejilla abría
   * en la semana siguiente y **el resaltado de hoy desaparecía**: ningún día en
   * azul, porque el día resaltado no estaba en la semana pintada. El médico
   * abre su agenda de la tarde y se encuentra la semana que viene, vacía, sin
   * ancla.
   *
   * Medido el 31-ago: el navegador decía «Mon Aug 31», el consultorio decía
   * 30-ago, y el calendario abría en «31 ago – 6 sep» sin ningún día marcado.
   *
   * El mediodía evita los bordes de horario de verano al construir la fecha.
   */
  const [baseDate, setBaseDate] = useState(() => anclaDeRejilla(hoyISO()))
  // La ventana de citas se pide desde un mes ANTES de lo que estás viendo, para
  // que navegar hacia atrás traiga esas citas en vez de mostrar el mes vacío.
  const desdeVentana = useMemo(() => {
    const d = new Date(baseDate)
    d.setMonth(d.getMonth() - 1)
    // `diaDeRejilla`, no `toISOString()`: éste da el día en UTC y corre la fecha.
    return `${diaDeRejilla(d)} 00:00`
  }, [baseDate])
  const { appointments: allAppointments, loading, error: falloAgenda } = useAppointments(desdeVentana)
  const { config } = useConfig()
  const [medicoFiltro, setMedicoFiltro] = useFiltroMedico()
  // Aplicar filtro de médico antes de pasar a las vistas
  /*
   * El horario declarado por el consultorio, como lista. Sirve para que la
   * rejilla llegue hasta donde se atiende: una consulta que cierra a las 21:00
   * necesita poder AGENDAR a las 20:00, no sólo ver lo ya agendado.
   */
  /**
   * El horario que manda en la banda: el del MÉDICO FILTRADO si tiene el suyo,
   * y si no el del consultorio.
   *
   * Se resuelve con `configParaMedico`, que es donde vive esa decisión y ya la
   * usa el cálculo de huecos. Sin esto, con el filtro puesto en un médico con
   * horario propio la rejilla pintaría la banda del consultorio mientras el
   * selector de horas ofrece la del médico — la pantalla diciendo una cosa y el
   * motor otra, que es el defecto que esta unidad y la anterior vienen a cerrar.
   *
   * Hoy `horarioPropio` **no lo enciende ninguna pantalla** (lo dice el propio
   * tipo), así que en la práctica esto devuelve el del consultorio siempre. Se
   * cablea igualmente porque el día que se encienda, el defecto ya no está.
   */
  const { doctors } = useDoctors()
  const horariosDelConsultorio = useMemo(
    () => {
      const medico = medicoFiltro ? doctors.find(d => d.id === medicoFiltro) : null
      const cfg = configParaMedico(config, medico)
      /*
       * En orden de lunes a domingo, POR NOMBRE y no por `Object.values`: el
       * orden de las llaves de un objeto que viene de la base no está
       * garantizado, y aquí el índice ES el día de la semana.
       */
      return ORDEN_SEMANA.map(d => cfg?.horario?.[d] ?? {})
    },
    [config, doctors, medicoFiltro],
  )
  /*
   * Los festivos van aparte del horario porque no son del día de la semana sino
   * de la FECHA. `getDaySchedule` ya devuelve `null` en un festivo —así que el
   * selector de horas no ofrece ninguna—, y sin esto la rejilla pintaba el día
   * entero abierto: otra vez la pantalla diciendo una cosa y el motor otra.
   */
  const diasFestivos = useMemo(() => config?.diasFestivos ?? [], [config])
  const appointments = useMemo(() => {
    if (!medicoFiltro) return allAppointments
    return allAppointments.filter(a => a.medicoId === medicoFiltro)
  }, [allAppointments, medicoFiltro])
  /**
   * LA VISTA CON LA QUE ABRE EL CALENDARIO NO PUEDE SER LA MISMA EN UN TELÉFONO.
   *
   * Abría SIEMPRE en semana. Medido a 390 px con la consulta sembrada: siete
   * columnas en 366 px son ~44 px por día, y el bloque de cita sólo alcanza a
   * enseñar «09:45» y un nombre cortado a la mitad («Maria…»). No se puede
   * saber quién viene ni a qué — que es lo único para lo que se abre la agenda.
   *
   * En día, ese mismo bloque tiene el ancho entero y se lee el nombre completo
   * y el motivo. Es el mismo principio que ya gobierna el resto del shell: por
   * breakpoint se decide qué persiste, no se apila todo.
   *
   * Se elige UNA vez, al montar, y no se vuelve a tocar: si el médico cambia a
   * semana en su teléfono —porque quiere ver el hueco del jueves— girar la
   * pantalla no se lo puede deshacer. La preferencia del usuario gana a la
   * inicial desde el momento en que la expresa.
   *
   * Sin ventana (SSR) se elige semana, que es lo que ve el escritorio: el móvil
   * corrige en el primer render del cliente y nunca se ve el estado intermedio,
   * porque el calendario no se pinta hasta tener las citas.
   */
  const [view, setView] = useState<View>(() =>
    typeof window !== 'undefined' && window.matchMedia('(max-width: 640px)').matches ? 'dia' : 'semana',
  )
  /**
   * UN solo «hoy» por render, para el botón de nueva cita y para la vista de
   * día. Antes cada sitio preguntaba por su cuenta; además de sumar llamadas
   * sin zona al trinquete de `timezone-sitios`, dos lecturas en el mismo render
   * pueden caer a distinto lado de la medianoche.
   */
  const hoy = hoyISO()
  const [modalOpen, setModalOpen] = useState(false)
  const [editAppt, setEditAppt] = useState<Appointment | null>(null)
  const [defaultDate, setDefaultDate] = useState('')
  const [defaultHour, setDefaultHour] = useState('')

  const weekDates = useMemo(() => getWeekDates(baseDate), [baseDate])

  // Crear cita: redirige al flujo unificado "Agendar rápido" con fecha/hora prellenada
  const openNew = (fecha: string, hora: string) => {
    const qs = new URLSearchParams()
    if (fecha) qs.set('fecha', fecha)
    if (hora) qs.set('hora', hora)
    const s = qs.toString()
    router.push(s ? `/asistente?${s}` : '/asistente')
  }

  const openEdit = (appt: Appointment) => {
    setEditAppt(appt)
    setModalOpen(true)
  }

  const navigate = (dir: number) => {
    const d = new Date(baseDate)
    if (view === 'semana') d.setDate(d.getDate() + dir * 7)
    else if (view === 'mes') d.setMonth(d.getMonth() + dir)
    else d.setDate(d.getDate() + dir)
    setBaseDate(d)
  }

  const rangeLabel = useMemo(() => {
    if (view === 'semana') {
      const start = weekDates[0]
      const end = weekDates[6]
      if (start.getMonth() === end.getMonth()) {
        return `${format(start, 'd')} – ${format(end, 'd')} de ${format(start, 'MMMM yyyy', { locale: es })}`
      }
      return `${format(start, 'd MMM', { locale: es })} – ${format(end, 'd MMM yyyy', { locale: es })}`
    }
    if (view === 'mes') return format(baseDate, 'MMMM yyyy', { locale: es })
    return format(baseDate, "EEEE d 'de' MMMM", { locale: es })
  }, [view, baseDate, weekDates])

  return (
    <div className="nx-alto-de-trabajo" style={{ padding: '24px', display: 'flex', flexDirection: 'column' }}>
      {/* Topbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', margin: 0 }}>Calendario</h1>
        <DoctorFilter medicoId={medicoFiltro} onChange={setMedicoFiltro} />
        <div style={{ flex: 1 }} />

        {/* View tabs */}
        <div style={{ display: 'flex', background: 'var(--s2)', borderRadius: 8, padding: 3, gap: 2 }}>
          {(['dia', 'semana', 'mes'] as View[]).map(v => (
            <button
              key={v}
              onClick={() => setView(v)}
              className="nx-segmento"
              aria-pressed={view === v}
              style={{
                padding: '5px 14px', borderRadius: 6, border: 'none', cursor: 'pointer',
                fontSize: 13, fontWeight: 500,
                color: view === v ? 'var(--teal)' : 'var(--text3)',
                textTransform: 'capitalize',
              }}
            >
              {v === 'dia' ? 'Día' : v === 'semana' ? 'Semana' : 'Mes'}
            </button>
          ))}
        </div>

        {/* Navigation */}
        {/* LOS DOS BOTONES QUE MUEVEN LA AGENDA NO TENÍAN NOMBRE.
            `button-name`, crítico, en las líneas base de V10 y de V15: dos
            flechas sin una palabra dentro. Quien no ve el icono no sabe que
            son el «anterior» y el «siguiente» del calendario — y son la ÚNICA
            forma de moverse por él. El nombre dice además de qué se mueve, que
            cambia con la vista: no es lo mismo una semana que un mes. */}
        <button
          className="btn btn-ghost btn-icon btn-sm"
          onClick={() => navigate(-1)}
          aria-label={`${ETIQUETA_PASO[view]} anterior`}
        ><ChevronLeft size={16} /></button>
        <button
          className="btn btn-secondary btn-sm"
          onClick={() => setBaseDate(new Date())}
          style={{ minWidth: 180, textAlign: 'center' }}
        >
          {conMayusculaInicial(rangeLabel)}
        </button>
        <button
          className="btn btn-ghost btn-icon btn-sm"
          onClick={() => navigate(1)}
          aria-label={`${ETIQUETA_PASO[view]} siguiente`}
        ><ChevronRight size={16} /></button>

        <button className="btn btn-primary btn-sm" onClick={() => openNew(hoy, '')}>
          <Plus size={15} /> Nueva cita
        </button>
      </div>

      {/* Calendar body */}
      {/*
        EL HUECO NO ES UN DATO — tampoco en la agenda.

        `loading` llegaba a las tres vistas y **ninguna lo usaba**: el prop
        estaba escrito, pasado y sin conectar. El resultado, medido con la red
        lenta: una semana entera dibujada y COMPLETAMENTE VACÍA, idéntica a
        «no tienes ninguna cita». El médico podía mirar su semana y concluir
        que la tenía libre mientras las citas venían de camino.

        Es la regla 4 de seguridad clínica dicha en interfaz: ausencia de dato
        no es dato de ausencia. Un aviso encima de la rejilla, mientras dura, y
        `aria-busy` para quien no lo ve.
      */}
      <div className="nx-agenda-lienzo" style={{ flex: 1, overflow: 'hidden' }} aria-busy={loading || undefined}>
        {loading && (
          <div role="status" className="nx-agenda-cargando">
            <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} aria-hidden="true" />
            Cargando la agenda…
          </div>
        )}
        {/*
          Y CUANDO NO ES QUE TARDE, SINO QUE FALLÓ. El aviso de arriba se pone y
          se quita con `loading`; al fallar la consulta, `loading` baja, la
          rejilla se queda vacía y hasta aquí no decía nada. Una semana vacía
          porque no cargó se lee igual que una semana sin pacientes, y de las dos
          sólo una significa que el médico tiene el día libre. Es el mismo
          razonamiento del aviso de carga, en el caso de al lado.
        */}
        {!loading && falloAgenda && (
          <div role="alert" className="nx-agenda-cargando" style={{ color: 'var(--amber)' }}>
            <AlertCircle size={13} aria-hidden="true" />
            No se pudo cargar tu agenda. Esto NO quiere decir que no tengas citas.
          </div>
        )}
        {view === 'semana' && (
          <WeekView
            weekDates={weekDates}
            appointments={appointments}
            horarios={horariosDelConsultorio}
            festivos={diasFestivos}
            onCellClick={openNew}
            onApptClick={openEdit}
            loading={loading}
          />
        )}
        {view === 'dia' && (
          <DayView
            horarios={horariosDelConsultorio}
            festivos={diasFestivos}
            date={baseDate}
            hoy={hoy}
            appointments={appointments}
            onCellClick={(h) => openNew(diaDeRejilla(baseDate), h)}
            onApptClick={openEdit}
            loading={loading}
          />
        )}
        {view === 'mes' && (
          <MonthView
            date={baseDate}
            appointments={appointments}
            onDayClick={(d) => { setBaseDate(d); setView('dia') }}
            onApptClick={openEdit}
            loading={loading}
          />
        )}
      </div>

      <AppointmentModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditAppt(null) }}
        appointment={editAppt}
        defaultDate={defaultDate}
        defaultHour={defaultHour}
        onSaved={() => {}}
      />
    </div>
  )
}

function WeekView({ weekDates, appointments, horarios, festivos, onCellClick, onApptClick, loading }: {
  weekDates: Date[]
  appointments: Appointment[]
  horarios: DiaDeHorario[]
  festivos: readonly string[]
  onCellClick: (fecha: string, hora: string) => void
  onApptClick: (a: Appointment) => void
  loading: boolean
}) {
  // Cuántos médicos activos hay. Con uno solo, el color por médico no
  // distingue a nadie y se usa el acento de marca — ver colorMedico.
  const { activeDoctors } = useDoctors()
  const cuantosMedicos = activeDoctors.length
  const today = hoyISO()
  const DAY_NAMES = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
  const ahoraMin = useAhoraMinutos()
  /*
   * Las horas se calculan con las citas DE ESTA SEMANA, no con toda la ventana:
   * mirar el lunes no tiene por qué estirar la rejilla por una cita del jueves
   * de dentro de un mes.
   */
  /*
   * Los siete días en texto, UNA vez. Antes cada fila de hora los volvía a
   * calcular —siete por fila, trece filas— y la cabecera otra vez. Además de
   * trabajo repetido, era una conversión de huso por celda — y ésa era
   * justamente la que ponía las citas de un día bajo el rótulo de otro.
   */
  const diasISO = useMemo(() => weekDates.map(diaDeRejilla), [weekDates])
  const HORAS = useMemo(() => {
    const dias = new Set(diasISO)
    return horasAEnsenar(appointments.filter(a => dias.has(a.fechaHora.slice(0, 10))), horarios)
  }, [diasISO, appointments, horarios])
  /* Un festivo cierra el día ENTERO, así que se resuelve por columna y no por celda. */
  const esFestivoElDia = useMemo(() => diasISO.map(d => esFestivo(d, festivos)), [diasISO, festivos])

  return (
    <div style={{ height: '100%', overflow: 'auto', background: 'var(--s1)', border: '1px solid var(--border)', borderRadius: 12 }}>
      {/* Header row */}
      <div style={{ display: 'grid', gridTemplateColumns: '56px repeat(7, 1fr)', borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, zIndex: 10, background: 'var(--s2)' }}>
        <div />
        {weekDates.map((d, i) => {
          const ds = diasISO[i]
          const isToday = ds === today
          return (
            <div key={i} style={{ padding: '10px 6px', textAlign: 'center', borderLeft: '1px solid var(--border)' }}>
              <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 500 }}>{DAY_NAMES[i]}</div>
              <div style={{
                fontSize: 16, fontWeight: 700,
                color: isToday ? 'var(--teal)' : 'var(--text)',
                background: isToday ? 'var(--teal-glow)' : 'transparent',
                width: 28, height: 28, borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '2px auto 0',
              }}>
                {d.getDate()}
              </div>
            </div>
          )
        })}
      </div>

      {/* Hour rows */}
      {HORAS.map(h => (
        <div key={h} style={{ display: 'grid', gridTemplateColumns: '56px repeat(7, 1fr)', minHeight: 48, borderBottom: '1px solid var(--border)' }}>
          <div style={{ padding: '4px 8px', textAlign: 'right', fontSize: 11, color: 'var(--text3)', flexShrink: 0, borderRight: '1px solid var(--border)' }}>
            {String(h).padStart(2, '0')}:00
          </div>
          {weekDates.map((d, di) => {
            const ds = diasISO[di]
            const hourStr = `${String(h).padStart(2, '0')}:00`
            const cellAppts = appointments.filter(a =>
              a.fechaHora.startsWith(ds) && parseInt(a.fechaHora.slice(11, 13)) === h
            )
            return (
              <div
                key={di}
                style={{
                  borderLeft: '1px solid var(--border)', position: 'relative', minHeight: 48,
                  cursor: cellAppts.length === 0 ? 'pointer' : 'default',
                }}
                /**
                 * EL TINTE DE FIN DE SEMANA SE MUDÓ A LA HOJA, y no por gusto:
                 * escrito aquí como `style`, ganaba SIEMPRE a la regla de
                 * `:hover` —un estilo en línea vence a la hoja— y dejaba la
                 * respuesta al ratón muerta en las 91 celdas. Se vio midiendo
                 * el color de fondo antes y después de posar el ratón en el
                 * build de producción: no cambiaba. Leyendo el CSS parecía
                 * bien.
                 */
                data-finde={di >= 5 ? '' : undefined}
                /*
                  Y las horas en que el consultorio NO atiende. Sin esto la fila
                  de las 07:00 se ve igual de agendable que la de las 11:00.
                  Tiñe, no bloquea: agendar fuera de horario sigue pudiéndose.
                */
                data-cerrado={!esFestivoElDia[di] && estaAbierto(h, horarios[di]) ? undefined : ''}
                className="nx-agenda-celda"
                /**
                 * UN BOTÓN DENTRO DE OTRO BOTÓN NO ES NAVEGABLE.
                 *
                 * La celda vacía es un `role="button"` («Agendar a las 09:00») y
                 * cada cita que cae dentro es OTRO `role="button"`. axe lo
                 * marcaba como `nested-interactive`, serio, y estaba en la línea
                 * base de V10 (5 nodos) y en la de V15 (6): medido dos veces por
                 * dos programas de diseño y nunca cerrado.
                 *
                 * No es una etiqueta mal puesta: un control anidado deja al de
                 * dentro sin forma fiable de alcanzarse, y quien navega con
                 * teclado o lector se queda sin poder abrir la cita — que es lo
                 * único que de verdad se hace en esa celda.
                 *
                 * LA REGLA: la celda es botón SÓLO cuando está vacía. Con citas
                 * dentro, las citas son los botones y la celda se queda como
                 * contenedor. El clic con ratón sobre el hueco libre sigue
                 * agendando; lo que desaparece es el control fantasma.
                 *
                 * Lo que esto CUESTA, dicho: en una celda ya ocupada, agendar a
                 * esa hora deja de alcanzarse con teclado desde la rejilla. Se
                 * sigue pudiendo por «Nueva cita», que es un botón de verdad y
                 * el primer destino del tabulador. Se cambia un camino roto por
                 * uno que funciona, no un camino por ninguno.
                 */
                {...(cellAppts.length === 0
                  ? activable(() => onCellClick(ds, hourStr), { etiqueta: `Agendar el ${ds} a las ${hourStr}` })
                  /**
                   * Y en la ocupada, NADA — ni siquiera un `onClick` suelto.
                   *
                   * La primera versión de este arreglo dejaba el clic de ratón
                   * en la celda ocupada, «para no perder función». Eso es un
                   * control que sólo sirve con ratón, que es justo lo que
                   * `teclado-controles` prohíbe. Cambiar un defecto de
                   * accesibilidad por otro no es arreglarlo.
                   *
                   * (Aquel guardián no lo cazó: su regla da por resuelta la
                   * etiqueta si ve `activable(` en cualquier parte, y aquí
                   * aparece en la otra rama del ternario. Se anota abajo; no se
                   * apoya uno en un punto ciego ajeno.)
                   */
                  : {})}
              >
                {/* AHORA — la misma marca que `/citas`, en la columna de hoy. */}
                {ds === today && ahoraMin !== null && Math.floor(ahoraMin / 60) === h && (
                  <div
                    className="nx-agenda-ahora"
                    style={{ top: `${((ahoraMin % 60) / 60) * 100}%` }}
                    role="separator"
                    aria-label={`Ahora son las ${String(Math.floor(ahoraMin / 60)).padStart(2, '0')}:${String(ahoraMin % 60).padStart(2, '0')}`}
                  />
                )}
                {cellAppts.map(a => {
                  const minOffset = parseInt(a.fechaHora.slice(14, 16))
                  const heightPct = Math.min((a.duracion / 60) * 100, 200)
                  // Multi-doctor: colorea según el médico; un solo médico →
                  // cobalto de marca. El SEGUNDO argumento es lo que hace que
                  // esa segunda mitad ocurra de verdad: la condición anterior
                  // preguntaba si la CITA tiene médico, no si el consultorio
                  // tiene varios. Ver colorMedico en DoctorFilter.tsx.
                  const color = a.medicoId ? colorMedico(a.medicoId, cuantosMedicos) : 'var(--nexus)'
                  const est = estiloEstadoCita(a.estado)
                  return (
                    <div
                      key={a.id}
                      className="nx-agenda-bloque"
                      {...activable(() => onApptClick(a), { etiqueta: etiquetaDeCita(a) })}
                      onClick={e => { e.stopPropagation(); onApptClick(a) }}
                      title={`${a.pacienteNombre} — ${a.fechaHora.slice(11, 16)}${a.medicoNombre ? ` · ${a.medicoNombre}` : ''} · ${a.estado}`}
                      style={{
                        position: 'absolute', left: 2, right: 2,
                        top: `${(minOffset / 60) * 100}%`,
                        minHeight: 20, height: `${heightPct}%`,
                        background: `color-mix(in srgb, ${color} 13%, transparent)`,
                        border: `1px ${est.borderStyle} color-mix(in srgb, ${color} 40%, transparent)`,
                        borderLeft: `3px ${est.borderStyle} ${color}`,
                        borderRadius: 4, padding: '2px 5px',
                        /**
                         * EL NOMBRE DEL PACIENTE SE LEE; EL MÉDICO SE DISTINGUE.
                         *
                         * El texto iba en el color del médico (`colorMedico`),
                         * y axe lo cazó por contraste en la rejilla: ámbar
                         * `rgb(217,119,6)` a 11 px, incluso en una cita
                         * CONFIRMADA y a opacidad 1. En la superficie donde el
                         * médico busca a quién tiene a las nueve, el nombre era
                         * lo menos legible del bloque.
                         *
                         * Arreglarlo aclarando ese ámbar no vale: el color sale
                         * de una paleta POR MÉDICO, y una paleta no se audita
                         * un color cada vez — el siguiente médico traería el
                         * siguiente fallo.
                         *
                         * Así que se separan los dos trabajos: la identidad del
                         * médico vive en el borde y en el tinte del fondo (que
                         * es donde ya vivía y donde no compite con la lectura),
                         * y el texto usa el primer plano normal.
                         */
                        fontSize: 11, color: 'var(--text)', fontWeight: 500,
                        opacity: est.opacity,
                        textDecoration: est.tachado ? 'line-through' : 'none',
                        overflow: 'hidden', zIndex: 2, cursor: 'pointer',
                      }}
                    >
                      {a.fechaHora.slice(11, 16)} {a.pacienteNombre.split(' ')[0]}
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}

function DayView({ date, hoy, appointments, horarios, festivos, onCellClick, onApptClick, loading }: {
  date: Date
  hoy: string
  appointments: Appointment[]
  horarios: DiaDeHorario[]
  festivos: readonly string[]
  onCellClick: (hora: string) => void
  onApptClick: (a: Appointment) => void
  loading: boolean
}) {
  const ds = diaDeRejilla(date)
  const ahoraMin = useAhoraMinutos()
  /*
   * En el DÍA, el horario que manda es el de ESE día de la semana, no los siete.
   * `getDay()` da 0 en domingo y este producto numera de lunes a domingo.
   */
  const horarioDelDia = horarios[(date.getDay() + 6) % 7]
  const diaFestivo = esFestivo(ds, festivos)
  /**
   * «Hoy» llega de fuera a propósito. Calcularlo aquí añadía una llamada más a
   * `hoyISO()` sin zona, y `timezone-sitios` lleva trinquete sobre ese número:
   * cada llamada de cliente que cae al valor por omisión es una que habrá que
   * revisar el día que la zona del consultorio deje de publicarse a tiempo.
   * La página ya sabe qué día es; no hacía falta una segunda opinión.
   */
  const esHoy = ds === hoy
  const dayAppts = appointments.filter(a => a.fechaHora.startsWith(ds)).sort((a, b) => a.fechaHora.localeCompare(b.fechaHora))
  /* Las horas de ESTE día, con el horario del consultorio como suelo. */
  const HORAS = useMemo(() => horasAEnsenar(dayAppts, horarioDelDia ? [horarioDelDia] : horarios), [dayAppts, horarios, horarioDelDia])

  return (
    <div style={{ height: '100%', overflow: 'auto', background: 'var(--s1)', border: '1px solid var(--border)', borderRadius: 12 }}>
      {HORAS.map(h => {
        const hourStr = `${String(h).padStart(2, '0')}:00`
        const cellAppts = dayAppts.filter(a => parseInt(a.fechaHora.slice(11, 13)) === h)
        return (
          <div
            key={h}
            className="nx-agenda-celda"
            /* La misma banda que en la semana: aquí sólo hay una columna. */
            data-cerrado={!diaFestivo && estaAbierto(h, horarioDelDia) ? undefined : ''}
            style={{ display: 'flex', borderBottom: '1px solid var(--border)', minHeight: 56, cursor: cellAppts.length === 0 ? 'pointer' : 'default', position: 'relative' }}
            /* Misma regla que en la semana: botón sólo si la hora está libre. */
            {...(cellAppts.length === 0
              ? activable(() => onCellClick(hourStr), { etiqueta: `Agendar a las ${hourStr}` })
              : {})}
          >
            {esHoy && ahoraMin !== null && Math.floor(ahoraMin / 60) === h && (
              <div
                className="nx-agenda-ahora"
                style={{ top: `${((ahoraMin % 60) / 60) * 100}%` }}
                role="separator"
                aria-label={`Ahora son las ${String(Math.floor(ahoraMin / 60)).padStart(2, '0')}:${String(ahoraMin % 60).padStart(2, '0')}`}
              />
            )}
            <div style={{ width: 64, padding: '8px', textAlign: 'right', fontSize: 12, color: 'var(--text3)', borderRight: '1px solid var(--border)', flexShrink: 0 }}>
              {hourStr}
            </div>
            <div style={{ flex: 1, padding: '4px 8px', display: 'flex', flexDirection: 'column', gap: 3 }}>
              {cellAppts.map(a => {
                const est = estiloEstadoCita(a.estado)
                return (
                <div
                  key={a.id}
                  className="nx-agenda-bloque"
                  {...activable(() => onApptClick(a), { etiqueta: etiquetaDeCita(a) })}
                  onClick={e => { e.stopPropagation(); onApptClick(a) }}
                  style={{
                    background: 'var(--nexus-soft)', border: `1px ${est.borderStyle} var(--nexus-borde)`,
                    borderLeft: `3px ${est.borderStyle} var(--teal)`, borderRadius: 6, padding: '6px 10px',
                    cursor: 'pointer',
                    /**
                     * LA OPACIDAD NO VA EN LA TARJETA, VA EN EL NOMBRE.
                     *
                     * Atenuando la tarjeta entera se atenuaba también la
                     * INSIGNIA que dice «Cancelada» y la línea de tipo y
                     * duración. Es al revés: la insignia es justo lo que no
                     * puede costar trabajo leer, porque es la que anuncia el
                     * estado. Atenuar el aviso de cancelación para señalar que
                     * está cancelada se muerde la cola.
                     *
                     * Así que la merma se queda donde significa —el nombre, que
                     * además va tachado— y el resto de la tarjeta se lee a
                     * plena luz. La cita sigue leyéndose apagada por el borde
                     * discontinuo y por el nombre.
                     */
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ opacity: est.opacity, textDecoration: est.tachado ? 'line-through' : 'none' }}>
                      {a.fechaHora.slice(11, 16)} — {a.pacienteNombre}
                    </span>
                    <StatusBadge status={a.estado} size="sm" />
                  </div>
                  {/**
                    * UN TOKEN ATENUADO DEJA DE SERLO SOBRE UNA TARJETA TEÑIDA.
                    *
                    * Esta línea usaba `--text3`, el gris de metadatos. Ese token
                    * está calibrado contra el FONDO DE LA PÁGINA; aquí vive
                    * dentro de una tarjeta con tinte propio
                    * (`rgba(61,90,254,0.1)`), y ahí el contraste se cae — axe lo
                    * marcó en las cinco citas de la vista de día.
                    *
                    * Es primo de la unidad 25: allí un color de identidad hacía
                    * de color de lectura; aquí un gris calibrado para un fondo
                    * se usa sobre otro. `--text2` es el escalón que sigue siendo
                    * secundario y sí se lee sobre la tarjeta.
                    */}
                  <div style={{ fontSize: 12, color: 'var(--text2)', display: 'flex', alignItems: 'center', gap: 5 }}>
                    <TipoCitaIcon tipo={a.tipo} size={12} /> {APPOINTMENT_TYPE_CONFIG[a.tipo]?.label} · {a.duracion}min
                  </div>
                </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function MonthView({ date, appointments, onDayClick, onApptClick, loading }: {
  date: Date
  appointments: Appointment[]
  onDayClick: (d: Date) => void
  onApptClick: (a: Appointment) => void
  loading: boolean
}) {
  const today = hoyISO()
  const year = date.getFullYear()
  const month = date.getMonth()
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)

  // Start from Monday
  const startOffset = (firstDay.getDay() + 6) % 7
  const totalCells = Math.ceil((lastDay.getDate() + startOffset) / 7) * 7

  const days: (Date | null)[] = []
  for (let i = 0; i < totalCells; i++) {
    const dayNum = i - startOffset + 1
    if (dayNum < 1 || dayNum > lastDay.getDate()) {
      days.push(null)
    } else {
      days.push(new Date(year, month, dayNum, 12))   // mediodía: ver getWeekDates
    }
  }

  const DAY_HEADERS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

  return (
    <div style={{ height: '100%', background: 'var(--s1)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
      {/* Day headers */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid var(--border)' }}>
        {DAY_HEADERS.map(d => (
          <div key={d} style={{ padding: '8px 0', textAlign: 'center', fontSize: 12, fontWeight: 500, color: 'var(--text3)', borderRight: '1px solid var(--border)' }}>
            {d}
          </div>
        ))}
      </div>

      {/* Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', height: 'calc(100% - 37px)', overflow: 'auto' }}>
        {days.map((d, i) => {
          if (!d) return <div key={i} style={{ borderRight: '1px solid var(--border)', borderBottom: '1px solid var(--border)', background: 'var(--bg)', opacity: 0.3 }} />
          const ds = diaDeRejilla(d)
          const isToday = ds === today
          // Ordenado por hora ANTES del slice(0,3): sin esto, el orden del snapshot
          // (no garantizado cronológico) podía ocultar la cita más temprana del día
          // en la vista previa del mes.
          const dayAppts = appointments.filter(a => a.fechaHora.startsWith(ds))
            .sort((a, b) => a.fechaHora.localeCompare(b.fechaHora))
          return (
            <div
              key={i}
              /**
                * En el MES el anidamiento se resuelve al revés que en la semana.
                *
                * Allí la celda podía dejar de ser botón porque «agendar a esta
                * hora» se alcanza por «Nueva cita». Aquí el destino de la celda
                * —ver ese día— no tiene otra puerta, y un día CON citas es
                * precisamente el que uno quiere abrir: dejarlo sin control
                * cambiaría un defecto de accesibilidad por una función perdida.
                *
                * Así que el control se muda al NÚMERO del día, que es lo que
                * cualquiera señalaría, y la celda se queda de contenedor. Las
                * píldoras de cita siguen siendo botones y ya no viven dentro de
                * otro. El clic con ratón sobre el resto de la celda sigue
                * abriendo el día.
                */
              style={{
                borderRight: '1px solid var(--border)', borderBottom: '1px solid var(--border)',
                padding: '6px', minHeight: 80,
                background: isToday ? 'var(--nexus-tenue)' : 'transparent',
                transition: 'background var(--mov-rapido) var(--mov-curva)',
              }}
              onMouseEnter={e => !isToday && (e.currentTarget.style.background = 'var(--s2)')}
              onMouseLeave={e => !isToday && (e.currentTarget.style.background = 'transparent')}
            >
              {/**
                * LA CELDA YA NO ES UN CONTROL DE RATÓN; LA CABECERA SÍ ES UN CONTROL.
                *
                * Primero moví el control de la celda al número del día para
                * deshacer el anidamiento, y dejé el `onClick` en la celda «para
                * no perder el clic grande». Eso dejaba un control que sólo
                * funciona con ratón — exactamente lo que prohíbe
                * `teclado-controles`, que lo cazó.
                *
                * La salida no era elegir entre las dos cosas: era hacer el
                * control DE VERDAD lo bastante grande. La cabecera ocupa el
                * ancho de la celda, se alcanza con el tabulador, y de paso
                * enseña cuántas citas hay — que es lo que decide si abrir ese
                * día. Antes ese dato sólo existía en el nombre accesible.
                */}
              <div
                className="nx-agenda-dia-mes"
                {...activable(() => onDayClick(d), {
                  etiqueta: `Ver el día ${d.getDate()}${dayAppts.length ? ` · ${dayAppts.length} ${dayAppts.length === 1 ? 'cita' : 'citas'}` : ' · sin citas'}`,
                })}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  gap: 4, marginBottom: 3, borderRadius: 'var(--r-sm)',
                }}
              >
                <span style={{
                  fontSize: 13, fontWeight: isToday ? 700 : 400,
                  color: isToday ? 'var(--teal)' : 'var(--text2)',
                  background: isToday ? 'var(--teal-glow)' : 'transparent',
                  width: 24, height: 24, borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {d.getDate()}
                </span>
                {dayAppts.length > 0 && (
                  <span style={{ fontSize: 'var(--t-overline)', color: 'var(--text3)', paddingRight: 2 }}>
                    {dayAppts.length}
                  </span>
                )}
              </div>
              {/* La vista de MES era la única de las tres que no pintaba el estado
                  por ningún canal: una cita cancelada y una confirmada salían
                  idénticas, y el nombre accesible ni siquiera decía la hora.
                  Usa el mismo `estiloEstadoCita` que semana y día — una sola
                  gramática de estado para las tres vistas de la misma agenda. */}
              {dayAppts.slice(0, 3).map(a => {
                const est = estiloEstadoCita(a.estado)
                return (
                <div
                  key={a.id}
                  className="nx-agenda-bloque"
                  {...activable(() => onApptClick(a), { etiqueta: etiquetaDeCita(a) })}
                  onClick={e => { e.stopPropagation(); onApptClick(a) }}
                  style={{
                    fontSize: 10, padding: '0 5px', borderRadius: 3,
                    background: 'var(--nexus-soft)',
                    /**
                     * MISMA SEPARACIÓN QUE EN LA SEMANA (unidad 25): el texto
                     * usa el primer plano y el acento se queda en el borde.
                     * `var(--teal)` sobre `--nexus-soft` fallaba contraste, y
                     * aquí a 10 px es donde más se nota.
                     */
                    color: 'var(--text)',
                    borderLeft: `2px ${est.borderStyle} var(--teal)`,
                    /**
                     * 24 px de alto: el mínimo de WCAG 2.2 §2.5.8. Estas
                     * píldoras medían unos 16 y axe las marcaba las tres. Una
                     * cita que no se puede tocar en el móvil no está en la
                     * pantalla. La celda del mes crece si hace falta — que
                     * crezca es preferible a un objetivo inalcanzable.
                     */
                    minHeight: 24,
                    display: 'flex', alignItems: 'center',
                    opacity: est.opacity,
                    textDecoration: est.tachado ? 'line-through' : 'none',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    marginBottom: 2, cursor: 'pointer',
                  }}
                >
                  {a.fechaHora.slice(11, 16)} {a.pacienteNombre.split(' ')[0]}
                </div>
                )
              })}
              {dayAppts.length > 3 && (
                <div style={{ fontSize: 10, color: 'var(--text3)' }}>+{dayAppts.length - 3} más</div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
