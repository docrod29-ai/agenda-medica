'use client'
import { useState, useEffect, useMemo, useRef } from 'react'
import { Patient, type ClinicConfig } from '@/types'
import { listarPacientesCompat, buscarPacientes, TECHO_COMPAT_PACIENTES, createPatient, updatePatient, getConfig } from '@/lib/firestore'
import { edadEnAnios } from '@/lib/expediente/pediatria'
import { getCenso } from '@/lib/hospital/firestore'
import { useToast } from '@/context/ToastContext'
import { useAuth } from '@/hooks/useAuth'
import { useClinic } from '@/context/ClinicContext'
import { useMode } from '@/context/ModeContext'
import { Plus, Search, X, Users, Phone, AlertCircle, AlertTriangle, Calendar, Pencil, Cake, BedDouble, ChevronRight, FileClock } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { PageHeader, Button, ButtonLink, EmptyState, Spinner, Modal } from '@/components/ui'
import { AvisoPrivacidadModal } from '@/components/AvisoPrivacidadModal'
import { ExpedienteVacio } from '@/components/brand/EmptyArt'
import { avatarColor } from '@/lib/avatar-color'
import { buscarPosiblesDuplicados, barrerDuplicados, type ParDuplicado } from '@/lib/pacientes/duplicados'
import { duplicadosProbablesDe } from '@/lib/pacientes/candidatos'
import { describirListaVacia } from '@/lib/pacientes/vacio-de-la-lista'
import { coincideConLaBusqueda, unirResultadosDeBusqueda } from '@/lib/pacientes/busqueda-local'
import { revisarTelefonoDelPaciente } from '@/lib/pacientes/telefono-del-paciente'
import { loQueSePierde, type PlanDeFusion } from '@/lib/pacientes/fusion'
import { fetchAutenticado } from '@/lib/auth-client'
import { construirGuardadoDePaciente } from '@/lib/pacientes/campos-que-se-guardan'
import { navegarConContinuidad } from '@/lib/ui/continuidad'
import { logAudit } from '@/lib/expediente/audit-log'
import { tareasVivas } from '@/lib/tareas-clinicas/firestore'
import { estadoClinicoDeFila, pendienteQueManda, ultimaVezVisto, type LecturaDelWorklist, type EstadoClinicoDeFila } from '@/lib/pacientes/estado-clinico'
import type { TareaClinica } from '@/lib/tareas-clinicas/modelo'
import { DisparadorPorQue, LentePorQue, usePorQue } from '@/components/tareas/PorQueEstaAqui'
import { auth } from '@/lib/firebase'
import { fechaCorta } from '@/lib/formato/fecha'

export default function PacientesPage() {
  const { toast } = useToast()
  const { user } = useAuth()
  const { clinicId } = useClinic()
  const { mode } = useMode()
  const router = useRouter()
  const [patients, setPatients] = useState<Patient[]>([])
  const [loading, setLoading] = useState(true)
  const [errorCarga, setErrorCarga] = useState('')
  const [search, setSearch] = useState('')
  /**
   * REG-347 — LO QUE LA LISTA NO TRAE.
   *
   * `getPatients` dejó de bajarse el consultorio entero (REG-341) y pasó a tener
   * un techo. Bien para la escala, y peligroso aquí si no se dice: en un
   * consultorio de 600 pacientes esta pantalla enseñaría 500 y el médico no
   * tendría forma de saber que faltan cien.
   */
  const [listaTruncada, setListaTruncada] = useState(false)
  /** Resultado de la búsqueda EN EL SERVIDOR, atado al texto que lo produjo. */
  const [busquedaServidor, setBusquedaServidor] = useState<{ q: string; pacientes: Patient[]; truncada: boolean } | null>(null)
  const [filtro, setFiltro] = useState<'recientes' | 'todos' | 'alerta'>('recientes')
  const [modalOpen, setModalOpen] = useState(false)
  const [editPatient, setEditPatient] = useState<Patient | null>(null)
  // Pacientes ACTUALMENTE internados → se marcan (viven en Hospitalización).
  const [internados, setInternados] = useState<Set<string>>(new Set())

  /**
   * §20: la fila de /pacientes es un salto Paciente-lista → Expediente de la
   * cadena de continuidad — el .nx-ident de ESA fila viaja al <h1> del
   * Patient Anchor (la 4ª rebanada lo dejó declarado fuera; ésta lo cablea).
   * Sin origen no hay objeto compartido que preservar y se navega a secas
   * (§20: no animar por decorar). En modo no-médico no hay navegación: abre
   * el editor, como siempre.
   */
  const abrirExpediente = (p: Patient, origen?: HTMLElement | null) => {
    if (origen) navegarConContinuidad(() => router.push(`/expediente/${p.id}`), origen)
    else router.push(`/expediente/${p.id}`)
  }

  const load = async () => {
    if (!clinicId) return
    try {
      const lista = await listarPacientesCompat(clinicId)
      setPatients(lista.pacientes)
      setListaTruncada(lista.truncada)
      getCenso(clinicId).then(c => setInternados(new Set(c.map(i => i.pacienteId)))).catch(() => {})
    } catch (e) {
      // Un fallo de lectura NO puede verse igual que una lista vacía: para un
      // médico con cientos de registros, eso se lee como pérdida total de datos.
      console.error('[pacientes] no se pudo cargar', e)
      setErrorCarga('No se pudo cargar la información. Revisa tu conexión y reintenta.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [clinicId])

  /**
   * RTC-15 — LA LISTA TIENE QUE DECIR ALGO CLÍNICO DE CADA PACIENTE.
   *
   * La re-puntuación §29 dejó a esta pantalla en 5.0/10 (peor superficie del
   * producto) por una sola razón: nombre, teléfono, edad, «Editar». Un CRM.
   *
   * La lectura es la MISMA que ya hacen `/pendientes` y el `ContinuidadPanel`
   * de Hoy — una consulta por consultorio, no una por paciente. Va DESPUÉS de
   * `load()` y sin bloquearlo: los pacientes se pintan cuando llegan, y el
   * estado clínico aterriza encima. Que tarde el worklist no puede retrasar la
   * pantalla a la que se entra veinte veces al día.
   *
   * Si falla, la lectura queda en `sin-leer` y las filas NO dicen «sin
   * pendientes»: dicen nada. Ausencia de dato no es dato de ausencia, y aquí la
   * diferencia es que un cabo suelto invisible se lee como que no existe.
   */
  const [worklist, setWorklist] = useState<LecturaDelWorklist>({ estado: 'sin-leer' })
  const [ahora, setAhora] = useState(0)
  /**
   * LA LENTE, UNA POR PÁGINA. Misma pieza que `/pendientes` y Hoy: una sola
   * plantilla para las cuatro respuestas de §10 sobre la misma entidad. El
   * estado vive aquí arriba y el id baja; ninguna fila guarda si está abierta.
   */
  const { porQueId, disparador: disparadorPorQue, scrollAlAbrir, alternar: alternarPorQue, cerrar: cerrarPorQue } = usePorQue()
  const uid = auth.currentUser?.uid ?? ''
  useEffect(() => {
    if (!clinicId) return
    let vivo = true
    tareasVivas(clinicId)
      .then(w => { if (vivo) { setWorklist({ estado: 'lista', tareas: w.tareas }); setAhora(Date.now()) } })
      .catch(e => { console.error('[pacientes] no se pudo leer el worklist', e) })
    return () => { vivo = false }
  }, [clinicId])

  /**
   * RTC-15/RTC-29 — EL RESPALDO SE MUDÓ A `/operaciones`.
   *
   * Bajar un archivo del consultorio entero no es trabajo clínico: es una
   * operación (§11), y estaba en la cabecera primaria de esta pantalla, junto
   * a «Nuevo paciente». Parte de lo que hacía que `/pacientes` puntuara 5.0 en
   * §29 era ese racimo de tres botones con anatomía de CRM.
   *
   * La conducta no se reescribió en el destino: se extrajo entera a
   * `@/lib/clinica/descargar-respaldo` —misma ruta de servidor, mismo
   * streaming, mismo aviso de que la última línea del archivo declara si quedó
   * completo—. Mover no puede significar perder.
   */


  /**
   * REG-347 — LA BÚSQUEDA PREGUNTA AL SERVIDOR.
   *
   * Filtrar en memoria sobre una lista con techo busca dentro de un RECORTE: la
   * pantalla diría «sin resultados» de un paciente que existe, que es la peor
   * respuesta posible en la pantalla donde se le busca. La consulta indexada no
   * depende del techo.
   *
   * Se mantiene el filtro en memoria por debajo: con menos de dos caracteres no
   * hay consulta todavía, y mientras la del servidor viaja, lo que ya está
   * cargado sigue respondiendo.
   */
  useEffect(() => {
    if (!clinicId) return
    const q = search.trim()
    if (q.length < 2) return
    let vivo = true
    const t = setTimeout(() => {
      buscarPacientes(clinicId, q)
        .then(r => { if (vivo) setBusquedaServidor({ q, pacientes: r.pacientes, truncada: r.truncada }) })
        .catch(() => { /* sin red queda el filtro local, que es mejor que nada */ })
    }, 200)
    return () => { vivo = false; clearTimeout(t) }
  }, [clinicId, search])

  /**
   * ASE-001 — EL SERVIDOR SE UNE AL FILTRO LOCAL; NO LO SUSTITUYE.
   *
   * Esto decía `if (busquedaServidor && …) return busquedaServidor.pacientes`.
   * Y el servidor no sabe «contiene»: su sondeo principal es por PREFIJO sobre
   * `nombre` (`firestore.ts:333`). Teclear «iparraguirre» buscando a «Tadeo
   * Iparraguirre Nolasco» devolvía `[]`, ese vacío pisaba el `includes` local
   * que SÍ lo encontraba, y la pantalla decía «Ninguno de los 6 expedientes
   * coincide» de alguien que estaba a la vista dos líneas más abajo.
   *
   * El vacío del servidor no significa «no está»: significa «no empieza por».
   * Regla 4 de seguridad clínica en clave de directorio — y aquí un «no está»
   * falso abre un segundo expediente y parte las alergias de alguien en dos.
   *
   * REG-347 sigue en pie: el servidor es lo que alcanza POR ENCIMA del techo de
   * REG-341, y por eso no se puede quitar. Lo que cambia es que ya no borra lo
   * que se ve. La regla de coincidencia vive fuera (`pacientes/busqueda-local`)
   * porque es una decisión —qué cuenta como encontrar a alguien— y no un
   * detalle de esta pantalla.
   */
  const resultadosBusqueda = useMemo(() => {
    const q = search.trim()
    if (!q) return null
    const locales = patients.filter(p => coincideConLaBusqueda(p, q))
    const delServidor = busquedaServidor && busquedaServidor.q === q ? busquedaServidor.pacientes : []
    return unirResultadosDeBusqueda(delServidor, locales)
  }, [patients, search, busquedaServidor])

  /**
   * A QUIÉN SE PARECE LO QUE NO ENCONTRÓ.
   *
   * `buscarPosiblesDuplicados` vivía sólo en el formulario de alta: avisaba
   * cuando el médico YA había decidido crear y llevaba medio formulario
   * tecleado. Pero la pregunta «¿este paciente ya está?» se hace antes, y se
   * hace aquí — y aquí la pantalla contestaba «Sin resultados» y se callaba.
   *
   * No se inventa criterio: entra el término como nombre y decide el módulo
   * con su umbral declarado (`UMBRAL_NOMBRE`), que es lo que caza justo lo que
   * la búsqueda por subcadena NO puede cazar — el orden de los apellidos
   * («López García, María» / «María López García»), el dedazo («Gonzáles») y
   * el apellido de en medio que falta. Los acentos y las mayúsculas ya los
   * resuelve la búsqueda normal, así que lo que sobrevive hasta aquí es
   * exactamente el caso que parte expedientes.
   *
   * Sólo con búsqueda VACÍA de resultados: mientras haya filas que enseñar, la
   * respuesta a la búsqueda son las filas.
   */
  const parecidos = useMemo(() => {
    const q = search.trim()
    if (!q || (resultadosBusqueda?.length ?? 0) > 0) return []
    // Un término de sólo dígitos es un teléfono: comparar nombres contra él no
    // significa nada, y el módulo tiene escrito que el teléfono por sí solo
    // NUNCA identifica (lo comparte la familia).
    if (!/[a-zA-ZÀ-ÿñÑ]/.test(q)) return []
    return buscarPosiblesDuplicados({ nombre: q }, patients)
  }, [search, resultadosBusqueda, patients])

  // Recientes: por última cita (desc), top 15. "No se ve toda la lista".
  const recientes = useMemo(() =>
    [...patients]
      .filter(p => p.ultimaCita)
      .sort((a, b) => (b.ultimaCita ?? '').localeCompare(a.ultimaCita ?? ''))
      .slice(0, 15),
    [patients]
  )

  // Con alerta: no-show o cancelaciones.
  const conAlerta = useMemo(() =>
    [...patients]
      .filter(p => (p.noShowCount ?? 0) > 0 || (p.cancelacionCount ?? 0) > 0)
      // ?? 0 en el comparador también: sin él, un contador undefined daba NaN y el
      // orden quedaba inestable, así que los pacientes con más faltas no subían.
      .sort((a, b) => ((b.noShowCount ?? 0) + (b.cancelacionCount ?? 0)) - ((a.noShowCount ?? 0) + (a.cancelacionCount ?? 0))),
    [patients]
  )

  // Todos agrupados por inicial (A, B, C…) con orden alfabético español.
  const grupos = useMemo(() => {
    const ordenados = [...patients].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
    const map = new Map<string, Patient[]>()
    for (const p of ordenados) {
      const ch = (p.nombre.trim()[0] ?? '#').toUpperCase()
      const letra = /[A-ZÑ]/.test(ch) ? ch : '#'
      if (!map.has(letra)) map.set(letra, [])
      map.get(letra)!.push(p)
    }
    return Array.from(map.entries())
  }, [patients])

  /**
   * LOS DUPLICADOS QUE YA ESTABAN DENTRO.
   *
   * La tarjeta del formulario evita los NUEVOS. Los que llevan meses acumulados
   * —de antes de que existiera, o creados desde el asistente— siguen ahí, con el
   * historial partido: las alergias en un expediente y las notas recientes en el
   * otro. Nadie los va a encontrar buscando, porque para encontrarlos hay que
   * sospechar primero que existen.
   *
   * El barrido corre DESPUÉS de pintar la lista, no durante. Sobre miles de
   * pacientes son unas décimas de trabajo, y pagarlas antes del primer pintado
   * haría que la pantalla tardara en abrir — justo la impresión que no se puede
   * dar en el sitio al que se entra veinte veces al día.
   */
  const [duplicados, setDuplicados] = useState<ParDuplicado<Patient>[]>([])
  const [revisandoDuplicados, setRevisandoDuplicados] = useState(false)
  /**
   * ASE-009 — FUNDIR DOS EXPEDIENTES, DESDE LA APP.
   *
   * El barrido los encontraba, el diálogo decía «nada se junta solo», y no
   * había forma de juntarlos: el borrado de pacientes está cerrado en las
   * reglas y el único borrado real vive en `/api/arco/cancelar`. El único
   * camino era fingir una solicitud ARCO de cancelación de alguien que nunca la
   * pidió — falsificar un registro legal para arreglar un problema de datos.
   *
   * El plan lo calcula el SERVIDOR con los documentos reales (`?simular`) y se
   * enseña ANTES: quién absorbe a quién, por qué ése, y qué se pierde. Fundir a
   * dos personas distintas es el daño caro de esta pantalla, así que la última
   * palabra la tiene alguien que ya vio lo que va a pasar.
   */
  const [porFundir, setPorFundir] = useState<{ par: ParDuplicado<Patient>; plan: PlanDeFusion | null; cargando: boolean } | null>(null)
  const [fundiendo, setFundiendo] = useState(false)

  const pedirPlanDeFusion = async (par: ParDuplicado<Patient>) => {
    if (!clinicId) return
    setPorFundir({ par, plan: null, cargando: true })
    try {
      const res = await fetchAutenticado('/api/pacientes/fundir', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clinicId, aId: par.a.id, bId: par.b.id, simular: true }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok || !d.ok) {
        toast(d.error || 'No se pudo revisar la fusión', 'error')
        setPorFundir(null); return
      }
      setPorFundir({ par, plan: d.plan as PlanDeFusion, cargando: false })
    } catch {
      toast('No se pudo conectar para revisar la fusión', 'error')
      setPorFundir(null)
    }
  }

  const confirmarFusion = async () => {
    if (!clinicId || !porFundir?.plan) return
    setFundiendo(true)
    try {
      const res = await fetchAutenticado('/api/pacientes/fundir', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clinicId, aId: porFundir.par.a.id, bId: porFundir.par.b.id }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok || !d.ok) { toast(d.error || 'No se pudo fundir', 'error'); return }
      toast('Expedientes fundidos. El absorbido queda marcado, no borrado: si esto fue un error, sigue ahí.', 'success')
      setPorFundir(null)
      setRevisandoDuplicados(false)
      load()
    } catch {
      toast('No se pudo conectar para fundir', 'error')
    } finally {
      setFundiendo(false)
    }
  }
  useEffect(() => {
    // Todo el `setState` dentro del temporizador, ninguno en el cuerpo del
    // efecto: lo segundo encadena renders y el linter lo marca con razón.
    const t = setTimeout(() => {
      setDuplicados(patients.length < 2 ? [] : barrerDuplicados(patients).pares)
    }, 0)
    return () => clearTimeout(t)
  }, [patients])

  const openEdit = (p: Patient) => { setEditPatient(p); setModalOpen(true) }
  const openNew = () => { setEditPatient(null); setModalOpen(true) }

  /**
   * EL VACÍO DE LA LISTA, DICHO UNA VEZ.
   *
   * Eran cuatro sitios: un héroe ilustrado y tres párrafos grises centrados a
   * 40px, cada uno con su frase escrita a mano y ninguno con un control —el de
   * «Recientes» llegaba a mandar al médico a buscar un chip en NEGRITA en vez
   * de ofrecérselo, que además es un control que no es un `<button>` (§24).
   *
   * La decisión vive fuera de la pantalla (`describirListaVacia`); esto sólo
   * la pinta. El gesto que se ofrece sale de la CAUSA, no del sitio.
   */
  const bloqueVacio = (chip: 'recientes' | 'todos' | 'alerta') => {
    const v = describirListaVacia({
      totalExpedientes: patients.length,
      busqueda: search,
      chip,
      parecidos: parecidos.length,
    })
    return (
      <>
        <EmptyState
          variante={v.variante}
          illustration={v.variante === 'hero' ? <ExpedienteVacio /> : undefined}
          title={v.titulo}
          description={v.descripcion}
          action={
            v.gesto.limpiarBusqueda ? (
              <Button variant="ghost" size="sm" icon={<X size={14} />} onClick={() => setSearch('')}>Limpiar la búsqueda</Button>
            ) : v.gesto.verTodos ? (
              <Button variant="ghost" size="sm" icon={<Users size={14} />} onClick={() => setFiltro('todos')}>Ver todos A-Z</Button>
            ) : v.gesto.nuevoPaciente ? (
              mode === 'medico'
                ? <Button icon={<Plus size={16} />} onClick={openNew}>Nuevo paciente</Button>
                : <ButtonLink href="/asistente" icon={<Calendar size={16} />}>Agendar</ButtonLink>
            ) : undefined
          }
        />
        {v.enseñarParecidos && (
          <>
            {/* El encabezado agrupa hablando (RTC-31) y dice de dónde salen
                estas filas: no son resultados de la búsqueda —la búsqueda no
                encontró ninguno—, son expedientes que se parecen al nombre. */}
            <ListaEncabezado texto="Se parecen al nombre que buscaste" />
            {parecidos.map(c => (
              <PacienteRow key={c.paciente.id} p={c.paciente} mode={mode} internado={internados.has(c.paciente.id)} clinico={estadoClinicoDeFila(c.paciente.id, worklist, ahora)} manda={pendienteQueManda(c.paciente.id, worklist, ahora)} porQueId={porQueId} onAbrirPorQue={alternarPorQue} visto={ultimaVezVisto(c.paciente.ultimaCita, ahora)} onAbrir={origen => mode === 'medico' ? abrirExpediente(c.paciente, origen) : openEdit(c.paciente)} onEditar={() => openEdit(c.paciente)} />
            ))}
          </>
        )}
      </>
    )
  }

  /**
   * RTC-11 — `?editar=<id>` abre el editor de ESE paciente.
   *
   * El botón «Editar datos» del expediente hacía `push('/pacientes')` y te
   * soltaba en la lista con el editor cerrado: un viaje que no llegaba. Con
   * «Editar» fuera de la fila en móvil (la identidad no cabía compartiendo
   * ancho con un botón administrativo), ése pasó a ser el único camino — así
   * que tenía que llegar de verdad.
   *
   * Se espera a que los pacientes estén cargados: antes de eso no hay a quién
   * abrir. Corre una sola vez por id (la bandera) para que cerrar el modal no
   * lo vuelva a abrir mientras el parámetro siga en la URL.
   */
  const editarAtendido = useRef<string | null>(null)
  useEffect(() => {
    if (patients.length === 0) return
    const id = new URLSearchParams(window.location.search).get('editar')
    if (!id || editarAtendido.current === id) return
    const p = patients.find(x => x.id === id)
    if (!p) return
    editarAtendido.current = id
    // El `setState` va DENTRO del temporizador, no en el cuerpo del efecto:
    // lo segundo encadena renders y el linter lo marca con razón (mismo patrón
    // que el barrido de duplicados de más abajo).
    const t = setTimeout(() => openEdit(p), 0)
    return () => clearTimeout(t)
  }, [patients])

  const onSaved = () => {
    setModalOpen(false); setEditPatient(null)
    load()
  }

  return (
    <div className="nx-canvas">
      {/* Header. Modo Secretaria: solo Agendar (unifica flujo). Modo Médico: Agendar + Nuevo paciente. */}
      <PageHeader
        title="Pacientes"
        /* RTC-31: la pantalla dice qué es y de dónde sale lo que hay dentro.
           «Pacientes» a secas no informaba a nadie —el riel ya anuncia dónde
           estás— y era la ÚNICA de las nueve pantallas con cabecera que no lo
           decía, justo la más visitada. */
        subtitle="Todo el que tiene expediente aquí. Cada uno dice lo que quedó abierto y cuándo se le vio."
        actions={mode === 'secretaria' ? (
          <ButtonLink href="/asistente" icon={<Calendar size={16} />}>Agendar (registra paciente)</ButtonLink>
        ) : (
          <>
            <ButtonLink href="/asistente" variant="secondary" icon={<Calendar size={16} />}>Agendar</ButtonLink>
            <Button icon={<Plus size={16} />} onClick={openNew}>Nuevo paciente</Button>
          </>
        )}
      />

      {/*
        El aviso NO es una alarma: es un hallazgo. Por eso va discreto, con el
        número exacto y un solo botón. Un banner rojo permanente sobre algo que
        no es urgente se aprende a ignorar en dos días, y entonces tampoco se ve
        el día que importa.
      */}
      {duplicados.length > 0 && (
        <div style={{
          marginBottom: 14, padding: '11px 14px', borderRadius: 10,
          border: '1px solid var(--border)', background: 'var(--s1)',
          display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
        }}>
          <AlertCircle size={16} style={{ color: 'var(--amber)', flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontSize: 13.5, fontWeight: 600 }}>
              {duplicados.length === 1
                ? 'Hay 1 pareja de expedientes que podrían ser la misma persona'
                : `Hay ${duplicados.length} parejas de expedientes que podrían ser la misma persona`}
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 2 }}>
              Cuando un paciente tiene dos expedientes, su historial queda partido: las alergias en uno y las notas en el otro.
            </div>
          </div>
          <Button size="sm" variant="secondary" onClick={() => setRevisandoDuplicados(true)}>Revisar</Button>
        </div>
      )}

      {revisandoDuplicados && (
        <Modal
          open
          onClose={() => setRevisandoDuplicados(false)}
          size="wide"
          title="Posibles expedientes repetidos"
          footer={<Button variant="secondary" onClick={() => setRevisandoDuplicados(false)}>Cerrar</Button>}
        >
          <p style={{ fontSize: 12.5, color: 'var(--text3)', lineHeight: 1.6, marginTop: 0 }}>
            Abre los dos y compáralos. <strong>Nada se junta solo</strong>: decidir que dos
            expedientes son la misma persona —y cuál se queda— es tuyo, y equivocarse mezclaría el
            historial de dos pacientes distintos. Cuando lo decidas, «Son la misma persona» te enseña
            qué va a pasar antes de hacer nada.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {duplicados.map(par => (
              <div key={`${par.a.id}|${par.b.id}`} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: '10px 12px' }}>
                <div className="nx-meta" style={{ marginBottom: 8 }}>
                  {par.motivo}
                  {par.certeza === 'seguro' && <strong style={{ color: 'var(--amber)' }}> · muy probable</strong>}
                </div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  {[par.a, par.b].map(p => (
                    <div key={p.id} style={{ flex: '1 1 220px', minWidth: 200, padding: '8px 10px', borderRadius: 8, background: 'var(--s1)', border: '1px solid var(--border)' }}>
                      {/* nx-ident (8ª rebanada): identidad estructurada de §2
                          también en la tarjeta de duplicados — no un 13/600
                          en dialecto propio. Envuelve, no se trunca (§24). */}
                      <span className="nx-ident" style={{ display: 'block' }}>{p.nombre}</span>
                      <div className="nx-meta" style={{ margin: '2px 0 7px' }}>
                        {p.edad ? `${p.edad} años` : 'sin edad'}
                        {p.telefono ? ` · ${p.telefono}` : ''}
                        {p.ultimaCita ? ` · última cita ${fechaCorta(p.ultimaCita)}` : ' · sin citas'}
                      </div>
                      <Button size="sm" variant="secondary" onClick={() => {
                        setRevisandoDuplicados(false)
                        if (mode === 'medico') router.push(`/expediente/${p.id}`)
                        else openEdit(p)
                      }}>Abrir</Button>
                    </div>
                  ))}
                </div>
                {/*
                  ASE-009 — LA SALIDA QUE FALTABA.
                  El aviso encontraba la pareja y el médico no tenía qué hacer
                  con ella. Esto no funde: pide el plan al servidor y lo enseña.
                */}
                <div style={{ marginTop: 10 }}>
                  <Button size="sm" variant="secondary" onClick={() => pedirPlanDeFusion(par)}>
                    Son la misma persona…
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Modal>
      )}

      {/*
        QUÉ VA A PASAR, ANTES DE QUE PASE.
        Una fusión no se deshace. El plan sale del servidor con los documentos
        reales —si viajara desde aquí, quien controle el navegador elegiría
        quién absorbe a cuál— y lo que se pierde se dice con nombre y valor.
      */}
      {porFundir && (
        <Modal
          open
          onClose={() => setPorFundir(null)}
          title="Juntar dos expedientes en uno"
          footer={
            <>
              <Button variant="secondary" onClick={() => setPorFundir(null)} disabled={fundiendo}>Volver</Button>
              <Button onClick={confirmarFusion} loading={fundiendo} disabled={!porFundir.plan}>
                Sí, son la misma persona
              </Button>
            </>
          }
        >
          {porFundir.cargando || !porFundir.plan ? (
            <Spinner center label="Revisando los dos expedientes…" />
          ) : (
            <div style={{ display: 'grid', gap: 12 }}>
              <div style={{ fontSize: 14, color: 'var(--text2)', lineHeight: 1.6 }}>
                Se queda el expediente de{' '}
                <strong style={{ color: 'var(--text)' }}>
                  {[porFundir.par.a, porFundir.par.b].find(p => p.id === porFundir.plan!.sobreviveId)?.nombre}
                </strong>{' '}
                y absorbe al otro. {porFundir.plan.porQueSobreviveEse}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.6 }}>
                Se mudan sus notas —con su firma y su hash intactos—, laboratorios, fotos, citas y cobros.
              </div>
              {Object.keys(porFundir.plan.rellena).length > 0 && (
                <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.6, padding: 10, background: 'var(--s1)', border: '1px solid var(--border)', borderRadius: 10 }}>
                  <strong>Se rellenan huecos:</strong>{' '}
                  {Object.entries(porFundir.plan.rellena).map(([k, v]) => `${k} → ${v}`).join(' · ')}
                </div>
              )}
              <div style={{ fontSize: 12, lineHeight: 1.6, padding: 10, border: '1px solid var(--amber)', borderRadius: 10, background: 'color-mix(in srgb, var(--amber) 8%, transparent)' }}>
                <strong style={{ color: 'var(--text)' }}>Lo que se pierde:</strong>
                <ul style={{ margin: '6px 0 0', paddingLeft: 18, color: 'var(--text2)' }}>
                  {loQueSePierde(porFundir.plan).map((l, i) => <li key={i}>{l}</li>)}
                </ul>
              </div>
            </div>
          )}
        </Modal>
      )}

      {/*
        Search — RTC-25: EL PLACEHOLDER NO CABÍA EN UN TELÉFONO.

        Decía «Buscar por nombre, teléfono, correo o CURP…»: medido a 390px,
        327px de texto en un campo de 296px útiles. El médico veía la frase
        cortada, y el propio equipo rojo la transcribió mal («…correo o CUI»)
        — leyendo, justamente, lo que le cabía en la pantalla.

        Se quita «Buscar por», que es lo único que el campo NO necesita decir:
        la lupa a la izquierda ya dice que se busca. Los cuatro campos por los
        que se puede buscar se conservan enteros, que es la información que
        sólo puede dar el placeholder. Y el `aria-label` sigue diciendo la
        frase completa para quien lo oye.
      */}
      <div style={{ position: 'relative', marginBottom: 12, maxWidth: 420 }}>
        <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)' }} />
        <input className="input" style={{ paddingLeft: 32 }} placeholder="Nombre, teléfono, correo o CURP…" aria-label="Buscar un paciente por nombre, teléfono, correo o CURP" value={search} onChange={e => setSearch(e.target.value)} />
        {/* D-002 — un botón que sólo dibuja una X no tiene nombre para quien
            lo oye: el lector de pantalla anunciaba «botón» a secas. WCAG 4.1.2.
            `title` además lo dice con el ratón encima. */}
        {search && (
          <button
            type="button"
            onClick={() => setSearch('')}
            aria-label="Limpiar la búsqueda"
            title="Limpiar la búsqueda"
            style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)' }}
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Chips de organización — solo cuando NO hay búsqueda activa */}
      {!search.trim() && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
          {([
            ['recientes', `Recientes${recientes.length ? ` (${recientes.length})` : ''}`],
            ['todos', `Todos A-Z (${patients.length})`],
            ['alerta', `Con alerta${conAlerta.length ? ` (${conAlerta.length})` : ''}`],
          ] as const).map(([k, label]) => {
            const activo = filtro === k
            // Relleno, no trazo: va --nexus-solido con blanco encima (5.16:1
            // oscuro, 7.0:1 claro — ver globals.css). --teal + negro medía
            // 2.99:1 en claro: el trazo no está pensado para ser fondo.
            return (
              <button key={k} onClick={() => setFiltro(k)} className="nx-chip nx-chip--relleno" aria-pressed={activo} style={{
                padding: '6px 14px', borderRadius: 'var(--r-pill)', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                color: activo ? '#fff' : 'var(--text2)',
                border: `1px solid ${activo ? 'var(--nexus-solido)' : 'var(--border)'}`,
              }}>{label}</button>
            )
          })}
        </div>
      )}

      {/* RTC-31 — UNA LISTA DE TRABAJO NO NECESITA UNA TARJETA ALREDEDOR.
          La tarjeta contenedora (`.card`) dibujaba un marco alrededor de la
          lista entera: una frontera que no separa nada de nada, porque dentro
          hay una sola cosa. `/pendientes` —la superficie que puntúa 1.0 en
          §29— no la tiene: sus filas van a la página y quien agrupa es el
          encabezado del grupo, que además DICE algo («Vistos recientemente»,
          «3 con inasistencias»). El marco era lo genérico; el encabezado es lo
          que informa. */}
      {/**
        * REG-347 — LA LISTA DICE LO QUE NO TRAE.
        *
        * Con el techo de REG-341 esta pantalla enseña como mucho
        * `TECHO_COMPAT_PACIENTES`. Callarlo en la pantalla donde se BUSCA a un
        * paciente sería la peor versión del defecto: «no está» de alguien que
        * sí está. La búsqueda ya pregunta al servidor y no depende del techo —
        * este aviso es para el que RECORRE la lista, no para el que busca.
        */}
      {!loading && !errorCarga && listaTruncada && (
        <div role="status" style={{
          display: 'flex', alignItems: 'flex-start', gap: 8, padding: 12, marginBottom: 12,
          background: 'color-mix(in srgb, var(--amber) 8%, transparent)',
          border: '1px solid var(--amber)', borderRadius: 10, color: 'var(--text2)', fontSize: 14,
        }}>
          <AlertTriangle size={16} style={{ color: 'var(--amber)', flexShrink: 0, marginTop: 1 }} />
          <span>
            Se listan los primeros <strong>{TECHO_COMPAT_PACIENTES}</strong> pacientes.
            Hay más en el consultorio: <strong>búscalos por nombre, teléfono o CURP</strong> —
            la búsqueda sí llega a todos.
          </span>
        </div>
      )}

      <div style={{ borderTop: '1px solid var(--border)' }}>
        {loading ? (
          <Spinner center label="Cargando pacientes…" />
        ) : errorCarga ? (
          <EmptyState
            title="No se pudo cargar"
            description={errorCarga}
            action={<Button onClick={() => window.location.reload()}>Reintentar</Button>}
          />
        ) : patients.length === 0 ? (
          bloqueVacio(filtro)
        ) : resultadosBusqueda ? (
          // Búsqueda activa → resultados aplanados
          resultadosBusqueda.length === 0 ? (
            bloqueVacio(filtro)
          ) : (
            <>
              <ListaEncabezado texto={`${resultadosBusqueda.length} resultado${resultadosBusqueda.length !== 1 ? 's' : ''}`} />
              {resultadosBusqueda.map(p => (
                <PacienteRow key={p.id} p={p} mode={mode} internado={internados.has(p.id)} clinico={estadoClinicoDeFila(p.id, worklist, ahora)} manda={pendienteQueManda(p.id, worklist, ahora)} porQueId={porQueId} onAbrirPorQue={alternarPorQue} visto={ultimaVezVisto(p.ultimaCita, ahora)} onAbrir={origen => mode === 'medico' ? abrirExpediente(p, origen) : openEdit(p)} onEditar={() => openEdit(p)} />
              ))}
            </>
          )
        ) : filtro === 'recientes' ? (
          recientes.length === 0 ? (
            bloqueVacio('recientes')
          ) : (
            <>
              <ListaEncabezado texto="Vistos recientemente" />
              {recientes.map(p => (
                <PacienteRow key={p.id} p={p} mode={mode} internado={internados.has(p.id)} clinico={estadoClinicoDeFila(p.id, worklist, ahora)} manda={pendienteQueManda(p.id, worklist, ahora)} porQueId={porQueId} onAbrirPorQue={alternarPorQue} visto={ultimaVezVisto(p.ultimaCita, ahora)} onAbrir={origen => mode === 'medico' ? abrirExpediente(p, origen) : openEdit(p)} onEditar={() => openEdit(p)} />
              ))}
            </>
          )
        ) : filtro === 'alerta' ? (
          conAlerta.length === 0 ? (
            bloqueVacio('alerta')
          ) : (
            <>
              <ListaEncabezado texto={`${conAlerta.length} con inasistencias / cancelaciones`} />
              {conAlerta.map(p => (
                <PacienteRow key={p.id} p={p} mode={mode} internado={internados.has(p.id)} clinico={estadoClinicoDeFila(p.id, worklist, ahora)} manda={pendienteQueManda(p.id, worklist, ahora)} porQueId={porQueId} onAbrirPorQue={alternarPorQue} visto={ultimaVezVisto(p.ultimaCita, ahora)} onAbrir={origen => mode === 'medico' ? abrirExpediente(p, origen) : openEdit(p)} onEditar={() => openEdit(p)} />
              ))}
            </>
          )
        ) : (
          // Todos A-Z agrupados por inicial
          grupos.map(([letra, lista]) => (
            <div key={letra}>
              {/* RTC-31: la inicial agrupa hablando, no pintando una banda.
                  Al quitar la tarjeta contenedora, la barra de --s2 a todo lo
                  ancho pasó de ser un separador dentro de una caja a ser el
                  elemento más pesado de la pantalla — más que los nombres de
                  los pacientes. Sigue siendo pegajosa (que es lo que sirve al
                  recorrer 300 filas) y sigue hablando el rol del sistema. */}
              <div
                className="t-overline"
                style={{
                  position: 'sticky', top: 0, zIndex: 1,
                  background: 'var(--bg)', padding: '14px 2px 6px',
                }}
              >{letra}</div>
              {lista.map(p => (
                <PacienteRow key={p.id} p={p} mode={mode} internado={internados.has(p.id)} clinico={estadoClinicoDeFila(p.id, worklist, ahora)} manda={pendienteQueManda(p.id, worklist, ahora)} porQueId={porQueId} onAbrirPorQue={alternarPorQue} visto={ultimaVezVisto(p.ultimaCita, ahora)} onAbrir={origen => mode === 'medico' ? abrirExpediente(p, origen) : openEdit(p)} onEditar={() => openEdit(p)} />
              ))}
            </div>
          ))
        )}
      </div>

      {modalOpen && (
        <PatientModal
          patient={editPatient}
          onClose={() => { setModalOpen(false); setEditPatient(null) }}
          onSaved={onSaved}
          userEmail={user?.email ?? ''}
          /*
            La lista YA cargada, para poder avisar de un posible duplicado
            mientras se escribe el nombre en vez de al terminar el formulario.
            Es la misma lista que se ve detrás del modal: cero peticiones nuevas.
          */
          existentes={patients}
          onAbrirExistente={p => {
            setModalOpen(false); setEditPatient(null)
            if (mode === 'medico') router.push(`/expediente/${p.id}`)
            else openEdit(p)
          }}
        />
      )}

      {/*
        LA LENTE — se busca la tarea por id en cada render en vez de guardarla:
        lo que se lee es el pendiente de AHORA, no una copia. Si desapareció de
        la lectura (se cerró en otra pestaña), la lente se queda sin sujeto y no
        se abre, que es mejor que enseñar la ficha de algo que ya no está.
      */}
      <LentePorQue
        tarea={porQueId && worklist.estado === 'lista'
          ? (worklist.tareas.find(t => t.id === porQueId) ?? null)
          : null}
        uid={uid}
        invocador={disparadorPorQue}
        scrollAlAbrir={scrollAlAbrir}
        alCerrar={cerrarPorQue}
      />
    </div>
  )
}

/** Encabezado gris de una sección de la lista. */
function ListaEncabezado({ texto }: { texto: string }) {
  return (
    /* Sin fondo ni caja: el encabezado agrupa hablando, no dibujando. Es el
       rol `.t-overline` del sistema, el mismo que usan los grupos de
       /operaciones desde RTC-29. */
    <div className="t-overline" style={{ padding: '14px 2px 8px' }}>
      {texto}
    </div>
  )
}

/** Fila de paciente reutilizable (búsqueda, recientes, alerta, A-Z). */
function PacienteRow({ p, mode, internado, clinico, manda, porQueId, onAbrirPorQue, visto, onAbrir, onEditar }: {
  p: Patient
  mode: string
  internado?: boolean
  /** RTC-15: lo que la fila dice CLÍNICAMENTE. Se calcula en `@/lib/pacientes/estado-clinico`. */
  clinico: EstadoClinicoDeFila
  /**
   * EL PENDIENTE QUE LA LÍNEA CLÍNICA RESUME — el mismo, no otra lectura.
   *
   * Es lo que convierte la fila de «texto que informa» en «hecho que se puede
   * inspeccionar»: sin él, para saber por qué un resultado venció había que
   * irse a `/pendientes` y buscar al paciente, o sea abandonar la lista.
   */
  manda: TareaClinica | null
  porQueId: string | null
  onAbrirPorQue: (t: TareaClinica, control: HTMLElement) => void
  /** «visto hace 3 días» — el dato ya estaba leído y no se pintaba en ningún sitio. */
  visto: string | null
  /** Recibe el .nx-ident de la fila: el objeto compartido de la coreografía (§20). */
  onAbrir: (origen?: HTMLElement | null) => void
  onEditar: () => void
}) {
  return (
    <div
      /**
       * RTC-11 — la fila tiene variante MÓVIL, y la decide la hoja.
       *
       * Medido a 390px: avatar 38 + «Editar» ~78 + chevron 14 + 3 huecos de 14
       * + padding 32 dejaban ~96px de columna para el nombre, y `.nx-ident` no
       * trunca a propósito (§24) — así que la identidad caía en TRES renglones
       * y el teléfono se partía. Era el defecto #13 de la DNA reaparecido: el
       * dato más importante de la fila comprimido por cromo administrativo.
       *
       * En móvil «Editar» (datos de CONTACTO: administrativo) sale de la fila
       * y el chevron decorativo también. La capacidad no se pierde — vive en
       * el expediente, cuyo «Editar datos» ahora sí abre el editor de ESE
       * paciente (`?editar=`). Es la misma regla de §8.5 que ya se aplicó al
       * pulgar y a los FAB: en el ancho del teléfono, lo clínico gana.
       */
      className="nx-fila-paciente"
      style={{
        position: 'relative',
        display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px',
        borderBottom: '1px solid var(--border)', transition: 'background var(--mov-rapido) var(--mov-curva)',
      }}
      onMouseEnter={e => (e.currentTarget.style.background = 'var(--s2)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
    >
      <div style={{
        width: 38, height: 38, borderRadius: '50%',
        background: avatarColor(p.nombre).bg, color: avatarColor(p.nombre).fg,
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 600, flexShrink: 0,
      }}>
        {p.nombre.charAt(0).toUpperCase()}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* La identidad es el <button> que abre el expediente y su área de
            golpe se estira sobre la fila entera (.nx-fila-abrir::after). La
            fila contenedora NO es control: hacerla role="button" con el botón
            Editar dentro era nested-interactive (axe, 5 nodos) — un control
            dentro de otro control. Ahora son dos botones HERMANOS: Editar
            vive por encima del velo con su propio z-index. El gesto del ratón
            no cambia: clic en cualquier punto de la fila sigue abriendo.
            Y sin ellipsis: la identidad del paciente no se trunca (§24) —
            .nx-ident envuelve. */}
        <button
          type="button"
          className="nx-fila-abrir"
          onClick={e => onAbrir(e.currentTarget.querySelector<HTMLElement>('.nx-ident'))}
          aria-label={`Abrir el expediente de ${p.nombre}`}
        >
          <span className="nx-ident" style={{ display: 'block' }}>{p.nombre}</span>
        </button>
        {/**
          * RTC-15 — LO CLÍNICO VA PRIMERO, Y EN PROSA.
          *
          * Esta línea es la que convierte una libreta de contactos en una lista
          * de trabajo. Va ANTES del teléfono y de la edad porque el orden de la
          * fila dice qué importa: si de este paciente quedó algo abierto, eso
          * pesa más que su número.
          *
          * Habla como `/pendientes` —la superficie que mejor puntuó en §29—:
          * dice la CONSECUENCIA, no el estado. «Resultado — venció y nadie la
          * tomó» no necesita que nadie sepa qué significa un chip rojo. El
          * color acompaña, no informa solo (§29, RTC-17).
          *
          * Y no se pinta nada cuando la lectura no llegó: una fila muda es
          * honesta, una que dice «sin pendientes» por un error de red no.
          */}
        {clinico.clase === 'con-pendientes' && (
          <div
            className="nx-meta nx-fila-clinico"
            style={{
              display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap',
              color: clinico.urgente ? 'var(--red)' : 'var(--text2)',
              fontWeight: clinico.urgente ? 600 : 500,
            }}
          >
            {clinico.urgente
              ? <AlertCircle size={11} style={{ flexShrink: 0 }} />
              : <FileClock size={11} className="ds-icon" style={{ flexShrink: 0 }} />}
            <span>{clinico.etiqueta}</span>
            {clinico.porQue && <span>— {clinico.porQue}</span>}
            {clinico.vivas > 1 && (
              <span style={{ color: 'var(--text3)', fontWeight: 400 }}>
                · {clinico.vivas} pendientes en total
              </span>
            )}
            {/*
              INSPECCIONAR EN EL SITIO — y NUNCA mutar en el sitio.

              La fila decía «Resultado — venció y nadie la tomó» y su único
              verbo era «Editar»: estado clínico presentado como información,
              con un gesto de CRM al lado. Para atenderlo había que abandonar
              la pantalla, que es el modelo de interacción que la re-auditoría
              llamó genérico.

              Lo que NO se hace, y es deliberado: traer aquí los botones de
              avance de estado de `/pendientes`. Esa pantalla separa a
              propósito «Ya se hizo» de «Lo revisé — cerrar»
              (`POR_QUE_COMPLETADA_NO_ES_CERRADA`) porque entre las dos vive el
              daño que el worklist existe para evitar. Un toque para cerrar en
              una lista donde el detalle NO está en pantalla permitiría cerrar
              un resultado sin haberlo leído. Inspeccionar contesta la pregunta
              sin conceder esa autoridad.

              Es la MISMA pieza que usan `/pendientes` y Hoy: una sola
              plantilla para las cuatro respuestas de §10 sobre la misma
              entidad. Y es hermano del botón que abre el expediente, nunca su
              hijo — un control dentro de otro es `nested-interactive`, que
              esta fila ya pagó una vez.
            */}
            {manda && (
              <span className="nx-fila-porque">
                <DisparadorPorQue
                  tarea={manda}
                  abierta={porQueId === manda.id}
                  onAbrir={onAbrirPorQue}
                />
              </span>
            )}
          </div>
        )}
        <div className="nx-meta" style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          {/* «visto hace 3 días» sale de `ultimaCita`, que ya se leía para
              ordenar la pestaña Recientes y no se pintaba en ningún sitio: el
              dato estaba en la mano y el médico tenía que abrir el expediente
              para enterarse de algo que la lista ya sabía. */}
          {visto && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Calendar size={11} className="ds-icon" /> {visto}</span>}
          {p.telefono && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Phone size={11} className="ds-icon" /> {p.telefono}</span>}
          {/* MP-017 — `p.edad &&` escondía al lactante: `edad: 0` es falso en
              JavaScript, así que el único paciente cuya edad más importa era el
              único que salía sin ella. */}
          {p.edad != null && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Cake size={11} className="ds-icon" /> {p.edad === 0 ? 'menos de 1 año' : `${p.edad} años`}</span>}
          {internado && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--nexus)', fontWeight: 600 }}><BedDouble size={11} /> Internado — ver Hospitalización</span>}
        </div>
      </div>
      {(p.noShowCount > 0 || p.cancelacionCount > 0) && (
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          {p.noShowCount > 0 && (
            <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 'var(--r-pill)', background: 'color-mix(in srgb, var(--red) 10%, transparent)', color: 'var(--red)' }}>{p.noShowCount} no-show{p.noShowCount > 1 ? 's' : ''}</span>
          )}
          {p.cancelacionCount > 0 && (
            <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 'var(--r-pill)', background: 'color-mix(in srgb, var(--amber) 10%, transparent)', color: 'var(--amber)' }}>{p.cancelacionCount} cancel.</span>
          )}
        </div>
      )}
      {mode === 'medico' && (
        <button
          className="nx-fila-editar"
          onClick={e => { e.stopPropagation(); onEditar() }}
          title="Editar datos de contacto"
          style={{
            display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0,
            background: 'var(--s2)', border: '1px solid var(--border)',
            color: 'var(--text2)', borderRadius: 8, padding: '6px 10px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
            /* Por encima del velo de .nx-fila-abrir::after: hermano, no hijo,
               del control que abre — el clic en Editar cae aquí y no navega. */
            position: 'relative', zIndex: 1,
          }}
        >
          <Pencil size={12} /> Editar
        </button>
      )}
      {/**
        * RTC-15 (parte de affordance) — un CHEVRON, no un documento.
        *
        * El hallazgo decía «la única affordance por fila es Editar»: lo único
        * que PARECÍA pulsable era el botón administrativo, mientras que abrir
        * el expediente —el trabajo de la pantalla— no se anunciaba. El icono
        * de la derecha era un `FileText`, que dibuja un documento: describe el
        * destino, no el gesto.
        *
        * Se cambia por el chevron, que es lo que dice «esta fila lleva a otro
        * sitio» sin añadir un control. Un botón «Abrir» con texto se descartó a
        * propósito: sería un SEGUNDO control que hace lo mismo que la fila
        * entera, en la pantalla que §29 penaliza justamente por exceso de
        * cromo. La fila ya es pulsable en toda su superficie
        * (`.nx-fila-abrir::after`) y su nombre accesible ya dice el gesto
        * («Abrir el expediente de …»).
        */}
      {mode === 'medico' && <ChevronRight className="nx-fila-chevron" size={16} color="var(--text3)" style={{ flexShrink: 0 }} aria-hidden="true" />}
    </div>
  )
}

function PatientModal({ patient, onClose, onSaved, userEmail, existentes, onAbrirExistente }: {
  patient: Patient | null
  onClose: () => void
  onSaved: () => void
  userEmail: string
  existentes: Patient[]
  onAbrirExistente: (p: Patient) => void
}) {
  const { toast, confirm } = useToast()
  const { clinicId } = useClinic()
  const { mode } = useMode()
  const [saving, setSaving] = useState(false)
  /**
   * El modal se resuelve con una promesa para poder ESPERARLO dentro del
   * guardado, en vez de partir el flujo en dos caminos.
   */
  const [avisoAbierto, setAvisoAbierto] = useState(false)
  /**
   * La configuración del consultorio, para que el aviso lleve SU razón social y
   * SU domicilio. El modal acepta `null` y cae a un texto genérico, pero un
   * aviso de privacidad sin el nombre del responsable del tratamiento no
   * identifica a nadie — que es justo lo que el aviso tiene que hacer.
   */
  const [config, setConfig] = useState<ClinicConfig | null>(null)
  useEffect(() => {
    if (!clinicId) return
    void getConfig(clinicId).then(setConfig).catch(() => setConfig(null))
  }, [clinicId])
  const resolverAviso = useRef<((v: Patient['avisoPrivacidad'] | null) => void) | null>(null)
  const pedirAviso = (): Promise<Patient['avisoPrivacidad'] | null> =>
    new Promise(res => { resolverAviso.current = res; setAvisoAbierto(true) })
  const cerrarAviso = (v: Patient['avisoPrivacidad'] | null) => {
    setAvisoAbierto(false)
    resolverAviso.current?.(v)
    resolverAviso.current = null
  }
  const [f, setF] = useState({
    nombre: patient?.nombre ?? '',
    telefono: patient?.telefono ?? '',
    whatsapp: patient?.whatsapp ?? '',
    email: patient?.email ?? '',
    fechaNacimiento: patient?.fechaNacimiento ?? '',
    edad: String(patient?.edad ?? ''),
    sexo: patient?.sexo ?? '',
    curp: patient?.curp ?? '',
    seguroMedico: patient?.seguroMedico ?? '',
    alergias: patient?.alergias ?? '',
    notas: patient?.notas ?? '',
  })

  const upd = (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setF(prev => ({ ...prev, [key]: e.target.value }))

  /** ASM-001 — se revisa mientras se escribe, no al final: llegar tarde es un obstáculo. */
  const revisionTelefono = useMemo(() => revisarTelefonoDelPaciente(f.telefono), [f.telefono])

  /**
   * POSIBLES DUPLICADOS, MIENTRAS SE ESCRIBE.
   *
   * El aviso llegaba al final, al pulsar Registrar: después de teclear el
   * formulario entero. Llegar tarde lo convierte en un obstáculo — a esas alturas
   * lo que se quiere es guardar, no descubrir que había que hacer otra cosa.
   *
   * Aquí sale en cuanto el nombre tiene forma de nombre, y lo que ofrece es un
   * ATAJO: «abrir su expediente». Ese es el gesto que de verdad quería hacer
   * quien empezó a dar de alta a alguien que ya estaba.
   *
   * Sobre la lista YA cargada: no hay petición nueva ni espera. La comprobación
   * contra datos frescos —la que caza el alta hecha hace diez segundos en otro
   * dispositivo— sigue estando en `handleSave`, que es donde sí se puede pagar
   * una lectura.
   */
  const [descartados, setDescartados] = useState<Set<string>>(new Set())
  const posiblesDuplicados = useMemo(() => {
    if (patient) return []                       // editando: no se está creando nada
    if (f.nombre.trim().length < 5) return []     // aún no hay nombre que comparar
    return buscarPosiblesDuplicados(
      {
        nombre: f.nombre,
        telefono: f.telefono,
        curp: f.curp,
        fechaNacimiento: f.fechaNacimiento,
        edad: f.edad ? Number(f.edad) : undefined,
      },
      existentes,
    ).filter(c => !descartados.has(c.paciente.id))
  }, [patient, f.nombre, f.telefono, f.curp, f.fechaNacimiento, f.edad, existentes, descartados])

  /**
   * La fecha de nacimiento CALCULA la edad — auditoría en vivo 2026-07.
   *
   * Eran dos campos independientes: había que teclear la edad aunque ya se hubiera
   * dado la fecha, nada impedía guardar «nació 2019» con «edad 40», y la edad
   * guardada envejecía mal (un niño registrado a los 6 seguía teniendo 6 al año
   * siguiente). De esa edad comen la dosis pediátrica por peso/edad, los percentiles
   * de la OMS, el esquema de vacunación y las escalas de riesgo cardiovascular.
   * Sigue siendo editable a mano: hay pacientes que sólo saben su edad aproximada.
   */
  const setFechaNacimiento = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fecha = e.target.value
    setF(prev => {
      const edad = edadEnAnios(fecha)
      return { ...prev, fechaNacimiento: fecha, edad: edad != null ? String(edad) : prev.edad }
    })
  }

  const handleSave = async () => {
    // C-023 — el aviso anterior era un anglicismo de formulario («el nombre
    // es …»). Se dice lo que falta y lo que hay que hacer, como una persona.
    if (!f.nombre.trim()) { toast('Falta el nombre del paciente', 'error'); return }
    /**
     * ASR-020 — LA EDAD SÓLO SE EXIGE SI NO HAY FECHA DE NACIMIENTO.
     *
     * Se pedía siempre, incluso con la fecha puesta, que es de donde sale la
     * edad buena. La edad a mano queda para el paciente que sólo la sabe
     * aproximada, que es el caso que el dueño pidió conservar.
     */
    if (!f.fechaNacimiento.trim() && !f.edad.trim()) {
      toast('Falta la edad. Si tienes su fecha de nacimiento, ponla y la calculamos.', 'error'); return
    }
    /**
     * ASM-001 — EL TELÉFONO CON EL QUE SALEN LOS RECORDATORIOS.
     *
     * «12345» se guardaba con un toast en verde. El mensaje que no llega no
     * falla en la pantalla de nadie: se ve igual que uno entregado, y lo que se
     * nota es la inasistencia. Se comprueba la FORMA y se dice qué le falta;
     * el teléfono vacío sigue siendo válido (hay pacientes sin teléfono).
     */
    const tel = revisarTelefonoDelPaciente(f.telefono)
    if (!tel.valido) { toast(`Revisa el teléfono: ${tel.problema}`, 'error'); return }
    setSaving(true)
    try {
      /**
       * QUÉ VIAJA Y QUÉ NO — REG-323.
       *
       * El payload se construye fuera, en `@/lib/pacientes/campos-que-se-guardan`,
       * porque decidir qué se escribe encima de un expediente es una regla
       * clínica y no un detalle de este formulario: mandar SIEMPRE el estado
       * completo hacía que corregir un teléfono en modo secretaria borrara las
       * alergias del paciente. `updateDoc` sobrescribe campo por campo, y un
       * campo que la pantalla no enseñó no lleva lo que alguien escribió: lleva
       * el eco de la copia con la que se abrió el modal, que puede tener 30 s de
       * retraso respecto a lo que el médico acaba de anotar en `/consulta`.
       */
      const payload = construirGuardadoDePaciente(f, {
        modo: mode,
        previo: patient,
        autor: userEmail,
        ahora: new Date().toISOString(),
      })
      if (patient) {
        /**
         * `patient.updatedAt` es la marca que ESTA pantalla vio al abrir el
         * editor. Si el documento cambió desde entonces —el médico anotando una
         * alergia en su pestaña mientras aquí se corregía el teléfono—, la
         * escritura se rechaza en vez de pisarla.
         */
        await updatePatient(clinicId!, patient.id, payload, patient.updatedAt)
        toast('Paciente actualizado', 'success')
      } else {
        /**
         * LA SEGUNDA RED, CONTRA DATOS FRESCOS.
         *
         * La tarjeta de arriba compara contra la lista ya cargada, y esa lista se
         * cachea 30 s en memoria — caché que sólo invalida la pestaña que
         * escribe. Secuencia real de consultorio: la asistente da de alta a
         * «María López» en la tablet; en la laptop del médico la caché es de hace
         * 20 s, así que ni al buscarla ni en la tarjeta aparece, y se crea otra
         * vez. El historial queda partido en dos y no se ve como un error: se ve
         * como un paciente nuevo.
         *
         * Por eso aquí se relee SIN caché. Y sólo se interrumpe cuando el motor
         * está SEGURO: un «probable» ya se ofreció arriba y detenerlo dos veces
         * sería castigar a quien ya decidió.
         */
        /**
         * REG-347 — SE PREGUNTA POR ESTE PACIENTE, NO SE BAJA EL DIRECTORIO.
         *
         * Antes se releía la lista completa sin caché. Con el techo de REG-341
         * eso pasó a ser peor que caro: releía como mucho 500 y el duplicado
         * podía estar entre los que no vinieron — un aviso antiduplicado que
         * falla en silencio justo en los consultorios donde más falta hace.
         *
         * Ahora se hacen dos sondeos indexados: por TELÉFONO, que es la señal
         * fuerte de duplicado, y por NOMBRE. El coste no depende del tamaño del
         * consultorio.
         *
         * LO QUE ESTO NO ALCANZA, declarado: la búsqueda es por PREFIJO, así que
         * un duplicado escrito con el orden de los nombres cambiado —«López
         * María» frente a «María López»— y SIN teléfono en común no aparece.
         * Antes tampoco aparecía por encima del techo, y de forma arbitraria;
         * ahora al menos el hueco es conocido y tiene forma.
         */
        /**
         * REG-351 — los dos sondeos viven ahora en `pacientes/candidatos.ts`.
         * Se escribieron aquí y otras nueve pantallas seguían filtrando el
         * recorte en memoria; copiarlos nueve veces habría garantizado que
         * divergieran. Se respeta el «es otra persona» de la tarjeta: quien ya
         * lo descartó arriba no merece que se lo vuelvan a preguntar al guardar.
         */
        const { seguros } = await duplicadosProbablesDe(clinicId!, payload, descartados)
        if (seguros.length) {
          const d = seguros[0]
          const seguir = await confirm(
            `Ya existe "${d.paciente.nombre}" — ${d.motivo.toLowerCase()}. Si lo creas otra vez, su historial quedará partido en dos expedientes. ¿Crearlo de todas formas?`,
            { peligro: true, confirmar: 'Crear de todas formas' },
          )
          if (!seguir) { setSaving(false); return }
        }
        /**
         * AVISO DE PRIVACIDAD antes de crear el expediente.
         *
         * El portal público SÍ lo pedía; el alta EN EL CONSULTORIO no, y es la
         * puerta por la que entran casi todos. El modal existía desde hace
         * tiempo —con `medioInicial: 'presencial'` de fábrica, o sea escrito
         * justo para esto— y no lo montaba ninguna pantalla.
         *
         * LFPDPPP Art. 9: los datos de salud son sensibles y exigen
         * consentimiento EXPRESO. Un expediente abierto sin él es un
         * incumplimiento que no se ve, porque el sistema funciona igual.
         *
         * No bloquea: si se cancela, el paciente se registra igual y queda SIN
         * consentimiento anotado, que es la verdad. Fingir uno que no se dio
         * sería peor que no tenerlo.
         */
        const consentimiento = await pedirAviso()
        const nuevoId = await createPatient(clinicId!, consentimiento ? { ...payload, avisoPrivacidad: consentimiento } : payload)
        /**
         * BITÁCORA DEL CONSENTIMIENTO.
         *
         * `aviso_privacidad_aceptado` existía en el catálogo de eventos, en la
         * lista blanca del servidor y en las etiquetas del panel de Cumplimiento
         * — y nadie lo emitía. El dato quedaba dentro del expediente del
         * paciente, así que para responder «¿de cuántos pacientes tengo
         * consentimiento?» había que recorrerlos todos.
         */
        if (consentimiento) {
          void logAudit({
            evento: 'aviso_privacidad_aceptado', clinicId: clinicId!,
            patientId: typeof nuevoId === 'string' ? nuevoId : undefined,
            meta: { version: consentimiento.versionAviso, medio: consentimiento.medioAceptacion, conHuella: !!consentimiento.hashTexto },
          })
        }
        toast(consentimiento ? 'Paciente registrado' : 'Paciente registrado — sin aviso de privacidad', consentimiento ? 'success' : 'info')
      }
      onSaved()
    } catch (e) {
      /**
       * UN CONFLICTO NO ES UN FALLO DE RED, Y NO SE DICE IGUAL.
       *
       * «Error al guardar» manda a mirar el wifi mientras lo que pasa es que
       * alguien más está trabajando sobre el mismo paciente. Se dice con esas
       * palabras y se pide recargar, que es lo único que trae la copia buena.
       */
      if ((e as { code?: string })?.code === 'conflicto-de-version') {
        toast('Otra sesión modificó a este paciente mientras tenías el editor abierto. NO se guardó, para no pisar su trabajo. Cierra y vuelve a abrirlo.', 'error')
      } else {
        toast('Error al guardar', 'error')
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      size="wide"
      title={patient ? 'Editar paciente' : 'Nuevo paciente'}
      footer={(
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSave} loading={saving}>{patient ? 'Guardar cambios' : 'Registrar'}</Button>
        </>
      )}
    >
          {/*
            «¿ES ESTE?» — antes de seguir llenando, no después.

            No bloquea nada: el formulario sigue debajo y se puede ignorar. Lo que
            hace es poner a un clic el gesto que de verdad se quería hacer —abrir
            el expediente que ya existe— en el único momento en que sirve, que es
            antes de haberlo tecleado todo.
          */}
          {posiblesDuplicados.length > 0 && (
            <div style={{
              marginBottom: 16, padding: '12px 14px', borderRadius: 10,
              border: '1px solid var(--warn-border)', background: 'var(--warn-bg)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <AlertCircle size={16} style={{ color: 'var(--warn-text)', flexShrink: 0 }} />
                <strong style={{ fontSize: 13.5, color: 'var(--warn-text)' }}>
                  {posiblesDuplicados.length === 1 ? 'Puede que ya esté registrado' : 'Puede que ya estén registrados'}
                </strong>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {posiblesDuplicados.map(c => (
                  <div key={c.paciente.id} style={{
                    display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
                    padding: '8px 10px', borderRadius: 8, background: 'var(--s1)', border: '1px solid var(--border)',
                  }}>
                    <div style={{ flex: 1, minWidth: 180 }}>
                      {/* nx-ident (8ª rebanada): el candidato a duplicado del
                          formulario habla el mismo rol de identidad que la
                          fila del directorio y que la tarjeta del modal. */}
                      <span className="nx-ident" style={{ display: 'block' }}>{c.paciente.nombre}</span>
                      <div className="nx-meta">
                        {c.motivo}
                        {c.paciente.edad ? ` · ${c.paciente.edad} años` : ''}
                        {c.paciente.ultimaCita ? ` · última cita ${fechaCorta(c.paciente.ultimaCita)}` : ''}
                      </div>
                    </div>
                    <Button size="sm" onClick={() => onAbrirExistente(c.paciente)}>
                      Abrir su expediente
                    </Button>
                    {/*
                      «Es otra persona» es tan importante como el aviso. Sin salida,
                      la tarjeta se queda encima del formulario de dos homónimos
                      reales —que existen— y pasa de ayuda a estorbo.
                    */}
                    <button
                      type="button"
                      onClick={() => setDescartados(prev => new Set(prev).add(c.paciente.id))}
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer', padding: '4px 6px',
                        fontSize: 12, color: 'var(--text3)', textDecoration: 'underline',
                      }}
                    >
                      Es otra persona
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/*
            FORMULARIO CORTO — petición del médico dueño (29-jul-2026).
            Solo lo que se llena de verdad al dar de alta a alguien en el consultorio:
            nombre · UN teléfono · edad · fecha de nacimiento · sexo · alergias ·
            servicio médico.

            SE QUITARON DE LA PANTALLA, NO DE LOS DATOS: correo, CURP, notas
            clínicas y el segundo teléfono. Los valores YA GUARDADOS de un paciente
            existente se conservan intactos porque `f` se inicializa desde `patient`
            y `handleSave` los sigue enviando — esconder un campo NO debe borrar
            información del expediente. Se siguen pudiendo buscar pacientes por
            correo o CURP, y el export FHIR los sigue emitiendo si existen.
          */}
          <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 20px' }}>
            {/*
              ASE-020 — CADA CAMPO CON SU `htmlFor`.

              Los siete `<label className="label">` estaban sueltos, sin `htmlFor`
              ni `id`: para un lector de pantalla eran campos SIN NOMBRE, y
              «campo sin etiqueta» es uno de los mínimos que fallan la compuerta
              de `design-system.md` (WCAG 2.2 AA, 3.3.2). Además, al asociarlos,
              pulsar la etiqueta enfoca el campo — que es lo que espera cualquiera.

              ASR-020 — Y UNA SOLA CONVENCIÓN DE NOMBRE. El marcador de posición
              decía «Apellido Apellido, Nombre» y el asistente —la otra puerta que
              crea expedientes en la misma colección— decía «Nombre completo». Dos
              órdenes distintos para la misma persona es la fábrica de duplicados
              que el motor tiene que deshacer después.
            */}
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label className="label" htmlFor="p-nombre">Nombre completo *</label>
              <input id="p-nombre" className="input" value={f.nombre} onChange={upd('nombre')} placeholder="Nombre y apellidos" />
            </div>
            {/*
              UN SOLO teléfono. Antes eran dos (Teléfono y WhatsApp) y en la práctica
              es el mismo número. `handleSave` copia este valor al campo `whatsapp`,
              porque el export FHIR y algunas rutas lo leen por separado: si se
              quedara vacío, un paciente nuevo perdería su contacto móvil ahí.
            */}
            <div className="form-group">
              <label className="label" htmlFor="p-telefono">Teléfono</label>
              <input id="p-telefono" className="input" type="tel" value={f.telefono} onChange={upd('telefono')} placeholder="6641234567"
                aria-invalid={!revisionTelefono.valido} aria-describedby="p-telefono-ayuda" />
              {/*
                ASM-001 — EL NÚMERO, TAL Y COMO LO VERÁ WHATSAPP.
                Enseñarlo antes de guardar es lo que convierte «12345» en un
                error que se ve, y no en un recordatorio que nunca sale.
              */}
              <p id="p-telefono-ayuda" style={{ fontSize: 12, margin: '4px 0 0', color: revisionTelefono.valido ? 'var(--text3)' : 'var(--red)' }}>
                {!revisionTelefono.valido
                  ? revisionTelefono.problema
                  : revisionTelefono.vacio
                    ? 'Sin teléfono no salen recordatorios de cita.'
                    : `Se enviará a ${revisionTelefono.comoSeVera}. Se usa también para los recordatorios por WhatsApp.`}
              </p>
            </div>
            {/*
              MP-017 — CON FECHA DE NACIMIENTO, LA EDAD NO SE TECLEA.

              Eran dos fuentes de verdad para el mismo dato: la fecha (que no
              envejece) y una edad congelada a mano (que sí). La congelada es la
              que imprime la receta, así que un niño registrado a los 6 seguía
              saliendo con 6 dos años después. Con fecha puesta, la edad se
              deriva y el campo se enseña sólo de lectura; sin fecha, sigue
              capturándose a mano, que es el caso que el dueño pidió conservar.
            */}
            <div className="form-group">
              <label className="label" htmlFor="p-edad">Edad {f.fechaNacimiento ? '' : '*'}</label>
              {/* Con fecha, se PINTA la derivada: enseñar la congelada de sólo
                  lectura sería el mismo defecto en la pantalla —«Edad: 6» de un
                  niño de 8— aunque al guardar se corrigiera sola. */}
              <input id="p-edad" className="input" type="number"
                value={f.fechaNacimiento ? String(edadEnAnios(f.fechaNacimiento) ?? '') : f.edad}
                onChange={upd('edad')} min={0} max={130}
                readOnly={!!f.fechaNacimiento} />
              <p style={{ fontSize: 12, color: 'var(--text3)', margin: '4px 0 0' }}>
                {f.fechaNacimiento
                  ? 'Se calcula sola desde la fecha de nacimiento y se mantiene al día. La usan la dosis pediátrica, los percentiles y las escalas de riesgo.'
                  : 'Si sabes su fecha de nacimiento, ponla abajo: la edad se calcula sola y no se queda vieja.'}
              </p>
            </div>
            <div className="form-group">
              <label className="label" htmlFor="p-fecha-nacimiento">Fecha de nacimiento</label>
              <input id="p-fecha-nacimiento" className="input" type="date" value={f.fechaNacimiento} onChange={setFechaNacimiento} />
              <p style={{ fontSize: 12, color: 'var(--text3)', margin: '4px 0 0' }}>
                Las farmacias la piden para dispensar: sale impresa en la receta.
              </p>
            </div>
            <div className="form-group">
              <label className="label" htmlFor="p-sexo">Sexo</label>
              <select id="p-sexo" className="input" value={f.sexo} onChange={upd('sexo')}>
                <option value="">Seleccionar</option>
                <option value="Masculino">Masculino</option>
                <option value="Femenino">Femenino</option>
                <option value="Otro">Otro</option>
              </select>
            </div>
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label className="label" htmlFor="p-seguro">Servicio médico</label>
              <input id="p-seguro" className="input" value={f.seguroMedico} onChange={upd('seguroMedico')} placeholder="IMSS, ISSSTE, Gastos mayores…" />
            </div>
            {/* Dato CLÍNICO — solo médicos/admin pueden verlo y editarlo.
                La asistente solo administra datos demográficos del paciente. */}
            {mode === 'medico' && (
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label className="label" htmlFor="p-alergias">Alergias</label>
                <input id="p-alergias" className="input" value={f.alergias} onChange={upd('alergias')} placeholder="Penicilina, AINES, …" />
              </div>
            )}
          </div>
    {avisoAbierto && (
      <AvisoPrivacidadModal
        config={config}
        onAceptar={d => cerrarAviso(d)}
        onCancelar={() => cerrarAviso(null)}
      />
    )}

    </Modal>
  )
}
