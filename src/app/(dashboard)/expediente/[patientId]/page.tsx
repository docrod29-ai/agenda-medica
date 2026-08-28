'use client'
import { useState, useEffect, useMemo } from 'react'
import dynamic from 'next/dynamic'
import { fetchAutenticado } from '@/lib/auth-client'
import { useParams, useRouter } from 'next/navigation'
import { useSmartBack } from '@/hooks/useSmartBack'
import { useClinic } from '@/context/ClinicContext'
import { useExpediente } from '@/hooks/useExpediente'
import { getPatient, updatePatient } from '@/lib/firestore'
import { deleteNota } from '@/lib/expediente/firestore'
import { useToast } from '@/context/ToastContext'
import { useAuth } from '@/hooks/useAuth'
import type { Patient } from '@/types'
import { TIPO_NOTA_LABEL } from '@/types/expediente'
import type { NotaMedica, TipoNota } from '@/types/expediente'
import type { Internamiento } from '@/types/hospital'
import type { CabosDelPaciente } from '@/lib/tareas-clinicas/cabos-del-paciente'
import {
  ArrowLeft, Mic, FileText, Loader2, CheckCircle2,
  Clock, ChevronDown, ChevronUp, Plus, Printer, Trash2, Send, Pill, ClipboardList, Pencil, Upload,
  Stethoscope, Activity, LogIn, LogOut, UserPlus, ClipboardCheck, ShieldPlus, type LucideIcon,
  Camera, FlaskConical, Link2Off, Sparkles, Bug, ExternalLink,
} from 'lucide-react'
import { Button, EmptyState, Spinner, Badge } from '@/components/ui'
import { FotosClinicas } from '@/components/FotosClinicas'
import { PanelLaboratorios } from '@/components/laboratorio/PanelLaboratorios'
import { ResumenPaciente } from '@/components/expediente/ResumenPaciente'
import { PatientAnchor } from '@/components/expediente/PatientAnchor'
import { ClinicalSpine, type ClinicalSpineItem } from '@/components/expediente/ClinicalSpine'
import { ProcedenciaDeLaNota } from '@/components/expediente/ProcedenciaDeLaNota'
import { navegarConContinuidad } from '@/lib/ui/continuidad'
import { describirVacioDeUnaLista, contar } from '@/lib/ui/vacio-de-una-lista'
import { Herramientas } from '@/components/Herramientas'
import { CAPACIDADES_DEL_PACIENTE } from '@/lib/nav/capacidades-del-paciente'
import { ExpedienteVacio } from '@/components/brand/EmptyArt'
import { InternamientosDelPaciente } from '@/components/InternamientosDelPaciente'
import { CabosSueltosDelPaciente } from '@/components/CabosSueltosDelPaciente'
import { tareasDePaciente } from '@/lib/tareas-clinicas/firestore'
import { getInternamientosDePaciente } from '@/lib/hospital/firestore'
import { problemasActivos, resumenProblemas } from '@/lib/expediente/problemas-activos'
import { medicamentosVigentes, resumenVigentes } from '@/lib/expediente/ordenes-medicamento'

/**
 * ¿ESTA NOTA ES HOSPITALARIA? UNA regla, no dos.
 *
 * Marca fiable: pertenece a un internamiento. La lista de tipos es respaldo
 * para notas viejas sin ese campo (postop/anestesia/consentimiento también
 * cuelgan de un internamiento → van a Hospital, no a Consulta).
 *
 * Vivía SUELTA dentro del filtro, y el aviso de «están en la otra pestaña»
 * preguntaba lo mismo con una regla MÁS POBRE —sólo la lista de tipos—. Con
 * eso, un paciente cuyas notas de hospital fueran todas `postop` contaba como
 * hospitalaria para filtrar y NO para avisar: la pestaña Consulta decía «sin
 * notas» sin mandar a ninguna parte. Dos respuestas a la misma pregunta, que
 * es el defecto que este repositorio persigue por nombre.
 */
const esHospitalaria = (n: NotaMedica) =>
  !!n.internamientoId || ['ingreso', 'evolucion', 'egreso'].includes(n.tipo)

/** Icono lineal por tipo de nota — nodo del timeline clínico. */
const ICONO_TIPO_NOTA: Record<TipoNota, LucideIcon> = {
  historia_clinica: FileText,
  primera_vez: UserPlus,
  seguimiento: Stethoscope,
  alta_consulta: LogOut,
  ingreso: LogIn,
  evolucion: Activity,
  egreso: LogOut,
  valoracion_preoperatoria: ClipboardCheck,
  valoracion_inmuno: ShieldPlus,
  nota_postoperatoria: Activity,
  nota_anestesia: Activity,
  consentimiento: FileText,
  evolucion_uci: Activity,
}

export default function ExpedientePage() {
  const { patientId } = useParams<{ patientId: string }>()
  const router = useRouter()
  const volver = useSmartBack('/pacientes')
  const { clinicId } = useClinic()
  const { user } = useAuth()
  const { toast, confirm } = useToast()
  const {
    notas, loading, error: errorNotas, reload,
    hayMas, cargandoMas, cargarMas, asegurarHistoriaCompleta,
  } = useExpediente(patientId)
  const [errorPaciente, setErrorPaciente] = useState('')
  const [descargandoTodo, setDescargandoTodo] = useState(false)
  const [patient, setPatient] = useState<Patient | null>(null)
  // Por defecto muestra las notas de CONSULTORIO (no mezclar con hospital). Las
  // notas de hospital viven en su episodio; aquí quedan bajo la pestaña "Hospital".
  const [filtro, setFiltro] = useState<'todas' | 'consulta' | 'hospital'>('consulta')
  const [expandida, setExpandida] = useState<string | null>(null)
  // Los dos de abajo NO abren su propia consulta a Firestore: son lo que
  // CabosSueltosDelPaciente/InternamientosDelPaciente YA leyeron, reportado
  // hacia arriba para que el Clinical Spine (§7) pueda mostrar un conteo real
  // sin duplicar la fuente de verdad (Clinical Spine, V15-PATIENT-WORKSPACE-001).
  const [pendientesPaciente, setPendientesPaciente] = useState<CabosDelPaciente | null>(null)
  const [internamientosPaciente, setInternamientosPaciente] = useState<Internamiento[] | null>(null)

  const borrarNota = async (notaId: string) => {
    if (!clinicId) return
    if (!(await confirm('¿Eliminar este borrador? No podrás recuperarlo.', { peligro: true, confirmar: 'Eliminar' }))) return
    try {
      await deleteNota(clinicId, patientId, notaId)
      toast('Borrador eliminado', 'info')
      reload()
    } catch {
      toast('Error al eliminar', 'error')
    }
  }

  useEffect(() => {
    if (!clinicId || !patientId) return
    getPatient(clinicId, patientId).then(setPatient).catch((e) => {
      // La ausencia del banner rojo de alergias se lee como "no tiene alergias".
      // Si no se pudo LEER al paciente hay que decirlo, no callar.
      console.error('[expediente] no se pudo leer el paciente', e)
      setErrorPaciente('No se pudieron cargar los datos del paciente (incluidas sus ALERGIAS). Recarga antes de prescribir.')
    })
    // NOM-024 Art. 6.5: bitácora de accesos — registrar lectura del expediente
    import('@/lib/expediente/audit-log').then(({ logAudit }) => {
      logAudit({
        evento: 'expediente_lectura', clinicId, patientId,
        medicoUid: user?.uid, medicoEmail: user?.email ?? undefined,
      })
    })
  }, [clinicId, patientId, user?.uid, user?.email])

  const notasFiltradas = notas.filter(n => {
    if (filtro === 'todas') return true
    return filtro === 'hospital' ? esHospitalaria(n) : !esHospitalaria(n)
  })

  /*
    EL VACÍO DE LA HISTORIA, DICHO POR EL MÓDULO QUE YA DECIDE ESTO.

    Antes lo decidía la propia pantalla, y le faltaba media respuesta: el aviso
    de «no te confundas, están en la otra pestaña» existía SÓLO para el filtro
    `consulta`. Estando en **Hospital** un paciente con doce notas de
    consultorio caía en «Sin notas todavía. La primera consulta que firmes
    aparece aquí.» — el expediente lleno diciendo que está vacío, que es
    exactamente lo que la rama hermana existía para impedir.

    Se delega en `describirVacioDeUnaLista` porque la regla ya está escrita ahí
    («todo vacío dice cuántos hay FUERA de lo que se está mirando, y el gesto
    sale de la CAUSA»), y escribirla otra vez aquí sería la quinta copia de la
    misma decisión.
  */
  const vacioDeLaHistoria = useMemo(() => {
    const fuera = notas.filter(n => (filtro === 'hospital' ? !esHospitalaria(n) : esHospitalaria(n)))
    return describirVacioDeUnaLista({
      total: notas.length,
      sustantivo: ['nota', 'notas'],
      restricciones: filtro === 'todas' || fuera.length === 0 ? [] : [{
        id: 'ambito',
        // El módulo ya dice CUÁNTAS hay fuera; esta frase dice DÓNDE están.
        frase: `${fuera.length === notas.length ? 'todas' : contar(fuera.length, ['nota', 'notas'])}`
          + ` ${fuera.length === 1 ? 'está' : 'están'} en la pestaña «${filtro === 'hospital' ? 'Consulta' : 'Hospital'}»`,
        gesto: filtro === 'hospital' ? 'Ver notas de Consulta' : 'Ver notas de Hospital',
      }],
      registroVacio: {
        titulo: 'Sin notas todavía.',
        descripcion: 'La primera consulta que firmes aparece aquí.',
        gesto: 'Crear primera nota',
      },
    })
  }, [notas, filtro])

  /*
    EL ESTADO ACTUAL, EN UNA LÍNEA (REG-262) — levantado a `useMemo` para que
    el bloque de abajo Y el Clinical Spine lean el MISMO cálculo: si cada uno
    lo recalculara por su cuenta, un mismo paciente podría mostrar "3
    problemas" en el riel y "4" en el resumen según el momento del render.
    Se calcula sobre las FIRMADAS: un borrador no es historia clínica.
  */
  const { problemas, vigentes } = useMemo(() => {
    const firmadas = notas.filter(n => n.estado === 'firmada').map(n => ({
      fecha: n.fechaConsulta ?? n.metadata?.fechaCreacion ?? '',
      medicamentos: n.medicamentos,
      diagnosticos: n.diagnosticos,
    }))
    return { problemas: problemasActivos(firmadas), vigentes: medicamentosVigentes(firmadas) }
  }, [notas])

  /*
    CLINICAL SPINE (§7, V15-PATIENT-WORKSPACE-001) — sólo enseña las
    categorías que de verdad tienen algo para ESTE paciente ("señalar de
    menos, nunca de más"): Encuentros siempre (es el corazón del expediente,
    incluso en 0), el resto sólo cuando ya cargó y hay algo que mostrar.
    Microbiología, imágenes, procedimientos, órdenes y comunicaciones NO
    tienen todavía una sección propia en esta pantalla — no se inventan
    entradas del riel para secciones que no existen; quedan para cuando esas
    pantallas se construyan.
  */
  /**
   * RTC-10: el riel sigue el orden VISUAL de la página, no al revés. Al subir
   * el estado clínico y los pendientes por encima de las cajas-módulo, un riel
   * que siguiera anunciando «Encuentros» primero mandaría al médico hacia
   * abajo para volver a subir — un índice que miente sobre su propio documento
   * es peor que no tenerlo (§7).
   */
  const spineItems: ClinicalSpineItem[] = [
    ...(problemas.length > 0 || vigentes.length > 0
      ? [{ id: 'problemas', label: 'Diagnósticos y medicamentos', detail: `${problemas.length} dx · ${vigentes.length} fármaco${vigentes.length === 1 ? '' : 's'}` }]
      : []),
    ...(pendientesPaciente && pendientesPaciente.lista.length > 0
      ? [{ id: 'pendientes', label: 'Pendientes', count: pendientesPaciente.lista.length }]
      : []),
    /* P1-12 — el riel NUNCA inventa un total: mientras quede historia sin
       cargar, el número que hay es «cuántas van cargadas», y se dice así. */
    hayMas && !loading
      ? { id: 'encuentros', label: 'Encuentros', detail: `${notas.length} cargadas · hay más` }
      : { id: 'encuentros', label: 'Encuentros', count: loading ? undefined : notas.length },
    ...(internamientosPaciente && internamientosPaciente.length > 0
      ? [{ id: 'internamientos', label: 'Ingresos', count: internamientosPaciente.length }]
      : []),
    ...(clinicId && patientId ? [{ id: 'herramientas', label: 'Laboratorios y fotografía' }] : []),
  ]

  return (
    <div className="nx-canvas">
      {/* Back */}
      <button onClick={volver} style={backBtn}>
        <ArrowLeft size={15} /> Atrás
      </button>

      {/* PATIENT ANCHOR (§7, V15-PATIENT-WORKSPACE-001) — identidad, alergia
          y encuentro en curso, SIEMPRE visible mientras se recorre el
          expediente. Sustituye los dos bloques sueltos que había aquí
          (banner de alergias + encabezado de identidad, cada uno con su
          propio layout): un paciente, un ancla. */}
      <PatientAnchor
        patient={patient}
        notas={notas}
        errorPaciente={errorPaciente}
        onContinuarEncuentro={(notaId) =>
          /* §20 Paciente→Encuentro: el <h1> del ancla ya lleva .nx-vt-paciente,
             así que es el ORIGEN automático — no hay que pasarlo. */
          navegarConContinuidad(() => router.push(`/consulta/${patientId}?nota=${notaId}`))}
        /* RTC-31 (5ª rebanada): la acción primaria sube al ancla. Ver el
           porqué medido en `PatientAnchor` — 720px sin usar a la izquierda de
           un botón que tenía su propia fila. */
        accion={
          <button onClick={() => navegarConContinuidad(() => router.push(`/consulta/${patientId}`))} style={primaryBtn}>
            <Mic size={16} /> Nueva consulta
          </button>
        }
      />

      {/* CLINICAL SPINE (§7, V15-PATIENT-WORKSPACE-001) — recorrido
          longitudinal por el expediente de ESTE paciente. Reemplaza el
          desplazamiento a ciegas por categorías reales con posición
          resaltada mientras se recorre la página. */}
      <ClinicalSpine items={spineItems} />

      {/* RTC-10 → RTC-31 — LO PRIMERO DE UN EXPEDIENTE ES EL PACIENTE, NO SU
          ARCHIVO, Y SU ACCIÓN VIVE CON ÉL.

          Aquí hubo CUATRO botones al mismo peso: tres de documentos/exportación
          y el primario clínico. RTC-10 bajó los tres al final («Documentos y
          exportación», misma conducta y mismos avisos) y dejó al primario solo
          en esta fila. Medido después, esa fila costaba 43px + 24px de margen
          con **720px sin usar a su izquierda**: existía para sostener un botón
          que ya tenía sitio en el ancla del paciente, junto a la otra acción de
          ese paciente. Subió allí, y con la fila se fue su rejilla móvil
          (V10-DEBT-006), que ordenaba cuatro botones donde quedaba uno.
          El invariante de aquella deuda —«el primario es lo primero que
          encuentra el pulgar»— se cumple mejor ahora: en el teléfono cae a un
          renglón completo de 44px justo bajo la identidad, más arriba que
          antes. */}

      {/* Resumen del paciente: alergias, últimos signos, diagnósticos activos y
          actividad — todo de un vistazo (lo que la competencia enseña como fuerte,
          pero aquí la info ya existía, solo estaba dispersa). */}
      <ResumenPaciente patient={patient} notas={notas} />

      {/* RTC-10 — LO CLÍNICO ANTES QUE LAS CAJAS-MÓDULO.
          Estos dos bloques —el estado actual en una línea (dx y qué toma) y lo
          que quedó pendiente de ESTE paciente— vivían DEBAJO del contacto
          plegado y de la barra de herramientas. Medido en navegador el 14-ago:
          el primer viewport de un expediente no traía un solo dato clínico, y
          la historia empezaba a 743px. El equipo rojo lo llamó por su nombre:
          «pila de cajas-módulo» en vez del §7. El orden ahora dice lo que la
          pantalla es: identidad → estado → pendientes → historia; las
          utilidades (contacto, laboratorios, fotografía, capacidades) quedan
          después, que es cuando se buscan. */}
      {/*
        EL ESTADO ACTUAL, EN UNA LÍNEA (REG-262).

        `resumenProblemas` y `resumenVigentes` decían en su comentario «frase
        corta para el encabezado de la consulta», y no las llamaba nadie.

        No van en la consulta: ahí las dos listas ya se enseñan ENTERAS, y una
        versión corta al lado de la larga es duplicar. Van aquí, donde el
        expediente ya tiene las notas cargadas —así que no cuesta ni una
        lectura más— y no había ningún resumen: para saber qué tiene y qué toma
        había que leerse la lista de notas.

        `problemas`/`vigentes` viven en el `useMemo` de arriba — el MISMO
        cálculo que ya lee el Clinical Spine para su conteo "N dx · M
        fármacos"; si cada uno lo recalculara aparte, un mismo paciente
        podría mostrar números distintos según dónde se mire.
      */}
      {(problemas.length > 0 || vigentes.length > 0) && (
        <div id="spine-problemas" style={{
          display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 16,
          background: 'var(--s2)', border: '1px solid var(--border)',
          borderRadius: 11, padding: '10px 13px',
        }}>
          <Stethoscope size={16} style={{ color: 'var(--text3)', flexShrink: 0, marginTop: 2 }} />
          <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.65, minWidth: 0 }}>
            <div><strong style={{ color: 'var(--text)' }}>Problemas:</strong> {resumenProblemas(problemas)}</div>
            <div><strong style={{ color: 'var(--text)' }}>Toma:</strong> {resumenVigentes(vigentes)}</div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 3 }}>
              De lo último que se dijo de cada uno en sus notas <b>firmadas</b>.
              {/* P1-12 — este resumen sale de las notas CARGADAS. Mientras quede
                  historia sin cargar no puede presentarse como el estado actual
                  completo: sería afirmar sobre notas que nadie ha leído. */}
              {hayMas && <> Calculado sobre las notas <b>ya cargadas</b>; queda historia anterior sin cargar.</>}
            </div>
          </div>
        </div>
      )}

      {/*
        LO QUE QUEDÓ PENDIENTE DE ESTE PACIENTE (REG-266).

        `tareasDePaciente()` decía en su comentario «para su expediente» y el
        expediente no las enseñaba: la función NO tenía un solo llamador.

        Va lo PRIMERO de la pantalla, encima incluso de los ingresos: un cabo
        suelto es lo único de aquí que exige una decisión hoy. Lo demás es
        historia, y la historia espera.
      */}
      {clinicId && (
        <div id="spine-pendientes">
          <CabosSueltosDelPaciente
            clinicId={clinicId}
            patientId={patientId}
            cargar={tareasDePaciente}
            alAbrirPendientes={() => router.push('/pendientes')}
            onResumen={setPendientesPaciente}
          />
        </div>
      )}


      {/* Historia clínica — ancla del Clinical Spine ("Encuentros"). */}
      <div id="spine-encuentros" style={{ fontSize: 13, fontWeight: 700, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '4px 0 12px' }}>
        Historia clínica
      </div>

      {/*
        LOS INGRESOS DE ESTE PACIENTE (REG-261).

        `getInternamientosDePaciente()` decía en su comentario «para mostrarlos
        en su expediente» y el expediente NO los mostraba: la función no tenía
        llamador ni prueba.

        Va ANTES de los filtros de notas a propósito: la constitución del
        charter es «un paciente, un expediente longitudinal», y saber que
        estuvo ingresado dos veces es contexto para leer todo lo de abajo, no
        una pestaña más.
      */}
      {clinicId && (
        <div id="spine-internamientos">
          <InternamientosDelPaciente
            clinicId={clinicId}
            patientId={patientId}
            cargar={getInternamientosDePaciente}
            alAbrir={id => router.push(`/hospitalizacion/${id}`)}
            onCargado={setInternamientosPaciente}
          />
        </div>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {([['todas', 'Todas'], ['consulta', 'Consulta'], ['hospital', 'Hospital']] as const).map(([k, l]) => (
          <button key={k} onClick={() => setFiltro(k)} style={chip(filtro === k)}>{l}</button>
        ))}
      </div>

      {/* Timeline */}
      {loading ? (
        <Spinner center label="Cargando expediente…" />
      ) : notasFiltradas.length === 0 ? (
        errorNotas ? (
          /**
           * NO CONFUNDIR "falló la lectura" CON "no hay notas".
           *
           * El hook exponía `error` y la pantalla no lo consumía: ante cualquier
           * fallo de getNotas se hacía setNotas([]) y aquí se pintaba "Sin notas
           * todavía · Crear primera nota". Un paciente con años de historia se veía
           * como paciente nuevo con la red caída o el token vencido — exactamente
           * el patrón que ya provocó un susto de pérdida de datos con el censo.
           *
           * VA PRIMERO, y eso es deliberado: con la lectura caída no se sabe
           * cuántas notas hay, así que ningún recuento de «cuántas están en la
           * otra pestaña» sería cierto. Un fallo no se cuenta, se dice.
           */
          <EmptyState
            illustration={<ExpedienteVacio />}
            title="No pudimos cargar el expediente"
            description="Las notas de este paciente están guardadas en el servidor; esto es un problema de conexión, no de tus datos."
            action={<Button onClick={() => reload()}>Reintentar</Button>}
          />
        ) : (
        /* RTC-30 — este vacío es de UN BLOQUE, no de la pantalla. Arriba ya
           están la identidad del paciente, sus alergias y el riel del Clinical
           Spine: la pantalla no está vacía, la historia sí. El hero ilustrado
           ocupaba media pantalla para decir «no hay notas» y empujaba fuera
           del pliegue lo que sí había.

           Lo que dice ahora lo decide `describirVacioDeUnaLista`, y con eso
           deja de haber un aviso que sólo servía en una dirección: en la
           pestaña Hospital, un paciente con doce notas de consultorio leía
           «Sin notas todavía» sobre un expediente lleno. */
        <>
        {/**
          * P1-12 — un vacío sobre historia A MEDIO CARGAR no es un vacío.
          *
          * `notasFiltradas` se calcula sobre las notas ya cargadas. Si la
          * primera página fuera toda de hospital y el filtro estuviera en
          * Consulta, esta pantalla diría «sin notas» de un paciente con
          * historia de consultorio más atrás. Antes de afirmar que no hay, se
          * ofrece cargar lo que falta.
          */}
        {hayMas && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '0 0 16px' }}>
            <Button variant="secondary" size="sm" onClick={() => { void cargarMas() }} disabled={cargandoMas}>
              {cargandoMas ? 'Cargando…' : 'Cargar notas anteriores'}
            </Button>
            <span style={{ fontSize: 12, color: 'var(--text3)' }}>
              Queda historia anterior sin cargar: <strong>puede haber notas que aquí no se ven</strong>.
            </span>
          </div>
        )}
        <EmptyState
          variante={vacioDeLaHistoria.variante}
          illustration={vacioDeLaHistoria.variante === 'hero' ? <ExpedienteVacio /> : undefined}
          title={vacioDeLaHistoria.titulo}
          description={vacioDeLaHistoria.descripcion}
          action={vacioDeLaHistoria.gestos.length ? (
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
              {vacioDeLaHistoria.gestos.map(g => (
                <Button
                  key={g.id}
                  variant={g.id === 'alta' ? 'ghost' : 'secondary'}
                  size="sm"
                  icon={g.id === 'alta' ? <Plus size={14} /> : undefined}
                  onClick={g.id === 'alta'
                    ? () => navegarConContinuidad(() => router.push(`/consulta/${patientId}`))
                    : () => setFiltro(filtro === 'hospital' ? 'consulta' : 'hospital')}
                >{g.etiqueta}</Button>
              ))}
            </div>
          ) : undefined}
        />
        </>
        )
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          <div className="t-overline" style={{ marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Activity size={12} className="ds-icon" />
            {notasFiltradas.length} {notasFiltradas.length === 1 ? 'consulta' : 'consultas'}
            {(() => {
              const fechas = notasFiltradas.map(n => n.fechaConsulta).filter(Boolean).sort()
              const primera = fechas[0]
              return primera ? <span style={{ color: 'var(--text3)', fontWeight: 500, textTransform: 'none', letterSpacing: 0 }}>· desde {new Date(primera).toLocaleDateString('es-MX', { dateStyle: 'medium' })}</span> : null
            })()}
          </div>
          {notasFiltradas.map((n, i) => (
            <NotaCard
              key={n.id}
              nota={n}
              esUltima={i === notasFiltradas.length - 1}
              abierta={expandida === n.id}
              onToggle={() => setExpandida(expandida === n.id ? null : n.id)}
              // Triple fuente para el patientId: 1) nota.pacienteId (legacy puede no tenerlo),
              // 2) param de la URL via useParams, 3) extraído de window.location.pathname.
              // Si TODO falla, navegamos solo con notaId y dejamos que la ruta de rescate lo resuelva.
              onEditar={() => {
                const pid = n.pacienteId || patientId || (typeof window !== 'undefined' ? window.location.pathname.split('/').filter(Boolean)[1] : '')
                if (pid && n.id) navegarConContinuidad(() => router.push(`/consulta/${pid}?nota=${n.id}`))
                else if (n.id) router.push(`/nota/${n.id}`)  // rescate buscará el paciente
                else toast('No se pudo abrir la nota.', 'error')
              }}
              onImprimir={() => {
                const pidParam = patientId
                const pidNota = n.pacienteId
                const pidPath = typeof window !== 'undefined' ? window.location.pathname.split('/').filter(Boolean)[1] : ''
                const pid = pidNota || pidParam || pidPath
                if (!n.id) { toast('Esta nota no tiene ID. Recarga el expediente.', 'error'); return }
                // Si no tenemos pid de ninguna fuente, vamos a la ruta de rescate (busca en la clínica)
                if (!pid) { router.push(`/nota/${n.id}`); return }
                router.push(`/nota/${pid}/${n.id}`)
              }}
              onGenerarReceta={() => {
                const pid = n.pacienteId || patientId || (typeof window !== 'undefined' ? window.location.pathname.split('/').filter(Boolean)[1] : '')
                if (pid && n.id) router.push(`/receta/${pid}/${n.id}`)
              }}
              onGenerarOrden={() => {
                const pid = n.pacienteId || patientId || (typeof window !== 'undefined' ? window.location.pathname.split('/').filter(Boolean)[1] : '')
                if (pid && n.id) router.push(`/orden/${pid}/${n.id}`)
              }}
              onBorrar={() => borrarNota(n.id)}
            />
          ))}
          {/**
            * P1-12 — LA HISTORIA SIGUE, Y SE DICE.
            *
            * El expediente se leía entero de una sentada: la vida completa del
            * paciente, con los dictados dentro, para pintar las últimas quince
            * líneas. Ahora se lee por páginas — y el hecho de que haya más NO
            * se calla: una línea de tiempo recortada que se presenta como el
            * expediente entero es la regla 4 de seguridad clínica rota en la
            * pantalla donde se mira la historia.
            */}
          {hayMas && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '18px 0 4px' }}>
              <Button variant="secondary" size="sm" onClick={() => { void cargarMas() }} disabled={cargandoMas}>
                {cargandoMas ? 'Cargando…' : 'Cargar notas anteriores'}
              </Button>
              <span style={{ fontSize: 12, color: 'var(--text3)' }}>
                Hay historia anterior que <strong>todavía no se ha cargado</strong>.
              </span>
            </div>
          )}
        </div>
      )}
      {/* Datos del paciente (contacto) — plegado, para editar cuando haga falta. */}
      <DatosPaciente
        patient={patient}
        /**
         * RTC-11: esto era `router.push('/pacientes')` a secas — un viaje de
         * ida sin destino: te dejaba en la lista, con el editor cerrado, y a
         * buscar de nuevo al paciente que acababas de tener abierto. Pasaba
         * inadvertido en escritorio porque «Editar» también vivía en la fila;
         * al quitarlo de la fila en móvil, este rebote se volvía el ÚNICO
         * camino — y no llegaba. Ahora la lista abre el editor de ESE paciente
         * (`?editar=`), que es lo que el botón siempre prometió.
         */
        onEditar={() => router.push(`/pacientes?editar=${encodeURIComponent(patientId)}`)}
        onRevocar={async () => {
          if (!clinicId || !patientId) return
          if (!(await confirm(
            'Los enlaces del portal que ya le enviaste a este paciente dejarán de funcionar. Tendrás que mandarle uno nuevo. ¿Continuar?',
            { peligro: true, confirmar: 'Invalidar' },
          ))) return
          try {
            await updatePatient(clinicId, patientId, { portalTokenVersion: (patient?.portalTokenVersion ?? 0) + 1 })
            toast('Listo: los enlaces anteriores ya no sirven.', 'success')
          } catch {
            toast('No se pudieron invalidar. Revisa tu conexión.', 'error')
          }
        }}
      />

      {/* Herramientas del expediente en UN SOLO bloque (antes eran dos cajas
          separadas, cada una con su encabezado "Herramientas clínicas" — se veían
          duplicadas). Laboratorios y la fotografía seriada, ambas plegadas.

          RTC-09: aquí entran también las dos capacidades que estaban como
          páginas-módulo en el índice ADMINISTRATIVO (§3.2: la IA es contextual,
          nunca un módulo feature-first). El encuentro ya las tenía así —embebe
          `AntibiogramaTool` y abre el consultor con `?paciente=`—; el expediente
          no las había recibido. Las declara `@/lib/nav/capacidades-del-paciente`
          UNA vez, y de ahí las lee el guardián de alcanzabilidad. */}
      {clinicId && patientId && (
        <div id="spine-herramientas">
          <Herramientas items={[
            {
              id: 'laboratorios', nombre: 'Laboratorios', color: 'var(--teal)', icono: <FlaskConical size={14} />,
              para: 'Adjunta PDF o foto → la IA los interpreta → gráficas de tendencia por analito',
              contenido: <PanelLaboratorios clinicId={clinicId} patientId={patientId} />,
            },
            {
              id: 'fotos', nombre: 'Fotografía clínica seriada', color: 'var(--teal)', icono: <Camera size={14} />,
              para: 'Serie por región · comparación antes/después con días de evolución',
              contenido: <FotosClinicas embebido modo="completo" clinicId={clinicId} patientId={patientId} />,
            },
            ...CAPACIDADES_DEL_PACIENTE.map(cap => ({
              id: cap.id,
              nombre: cap.nombre,
              color: 'var(--teal)',
              icono: cap.id === 'consultor' ? <Sparkles size={14} /> : <Bug size={14} />,
              para: cap.para,
              contenido: cap.conPaciente
                ? <CapacidadQueLleva href={cap.conPaciente(patientId)} nombre={cap.nombre} paciente={patient?.nombre ?? ''} />
                : <AntibiogramaDelPaciente />,
            })),
          ]} />
        </div>
      )}

      {/* La valoración del inmunocomprometido vive ahora como TIPO DE NOTA en la
          consulta ("Valoración Inmunocomprometido"), no como sección aquí. */}

      {/* RTC-10 — DOCUMENTOS Y EXPORTACIÓN, subordinados y con nombre.
          Vivían en la cabecera al mismo peso que el CTA clínico. No son el
          trabajo del día: son el archivo. Aquí siguen enteros —misma conducta,
          mismos avisos de lo que cada formato NO lleva— y el primer viewport
          queda para el paciente. */}
      <section style={{ marginTop: 32, paddingTop: 18, borderTop: '1px solid var(--border)' }}>
        <h2 className="t-overline" style={{ margin: '0 0 6px' }}>
          Documentos y exportación
        </h2>
        {/*
          RTC-21 — LA DIFERENCIA SE DICE ANTES DE DESCARGAR, NO DESPUÉS.
          Cuál de los dos archivos lleva qué vivía en un comentario del código
          y en el aviso que sale CUANDO EL ARCHIVO YA SE BAJÓ. El médico elige
          antes, no después: si se entera al terminar de que las notas en
          borrador no iban, ya mandó el archivo equivocado.
        */}
        <p style={{ margin: '0 0 12px', fontSize: 12, lineHeight: 1.5, color: 'var(--text3)', maxWidth: '62ch' }}>
          «Expediente completo» lleva todo lo que esta aplicación guarda del
          paciente. «Enviar a otro sistema» arma el archivo estándar de
          intercambio: las notas firmadas van enteras y las que están{' '}
          <strong style={{ fontWeight: 600, color: 'var(--text2)' }}>en borrador
          también viajan</strong>, marcadas como preliminares y sólo con su
          texto — sin diagnósticos ni recetas estructuradas.
        </p>
        <div className="actions-row">
          <button onClick={() => router.push(`/referencia/${patientId}`)} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--s2)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: 10, padding: '11px 16px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
            <Send size={15} /> Carta de referencia
          </button>
          {/*
            EXPEDIENTE COMPLETO — lo que el archivo llamado «expediente» nunca fue.
            «Enviar a otro sistema» lleva paciente + notas FIRMADAS. Éste
            lleva TODO lo que la aplicación guarda del paciente (adendas,
            laboratorios, fotografía clínica, antecedentes, formularios,
            internamientos con sus signos, citas y bitácora) y DECLARA lo que no
            se pudo leer.
          */}
          <button onClick={async () => {
            if (!clinicId || !patient) return
            setDescargandoTodo(true)
            try {
              const r = await fetchAutenticado(`/api/expediente/exportar/${patientId}?clinicId=${encodeURIComponent(clinicId)}`)
              const cuerpo = await r.json()
              if (!r.ok) { toast(cuerpo?.error || 'No se pudo armar el expediente', 'error'); return }
              const nombre = patient.nombre.replace(/[^\w]/g, '_').slice(0, 30)
              const blob = new Blob([JSON.stringify(cuerpo, null, 2)], { type: 'application/json' })
              const url = URL.createObjectURL(blob)
              const a = document.createElement('a')
              a.href = url
              a.download = `expediente_completo_${nombre}.json`
              a.click()
              URL.revokeObjectURL(url)
              // Lo que falta se DICE. Un expediente incompleto que no lo declara
              // se entrega creyendo que está completo.
              const faltan = (cuerpo.faltantes ?? []) as { seccion: string }[]
              toast(faltan.length
                ? `Expediente descargado, pero ${faltan.length} sección(es) no se pudieron leer: ${faltan.map(f => f.seccion).join(', ')}. Vienen listadas en el archivo.`
                : 'Expediente completo descargado.', faltan.length ? 'info' : 'success')
            } catch {
              toast('No se pudo conectar para armar el expediente', 'error')
            } finally { setDescargandoTodo(false) }
          }} disabled={descargandoTodo} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--s2)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: 10, padding: '11px 16px', fontSize: 14, fontWeight: 600, cursor: descargandoTodo ? 'default' : 'pointer' }}>
            <Upload size={15} /> {descargandoTodo ? 'Armando…' : 'Expediente completo'}
          </button>
          <button onClick={async () => {
            if (!clinicId || !patient) return
            const { exportarPacienteAFhir, resumenNotasExportadas } = await import('@/lib/fhir-export')
            const { logAudit } = await import('@/lib/expediente/audit-log')
            const { config } = await (async () => {
              const { getConfig } = await import('@/lib/firestore')
              return { config: await getConfig(clinicId) }
            })()
            /**
             * P1-12 — LA EXPORTACIÓN PIDE LA HISTORIA COMPLETA, EXPLÍCITAMENTE.
             *
             * La línea de tiempo se lee por páginas; este archivo NO puede
             * llevarse sólo lo que se hubiera pulsado «cargar más» veces
             * suficientes. Un expediente que viaja a otra institución con la
             * mitad de la historia, y sin decirlo, es peor que no mandarlo.
             */
            const historia = await asegurarHistoriaCompleta()
            const notasExportadas = historia.notas
            const bundle = exportarPacienteAFhir({ paciente: patient, notas: notasExportadas, config })
            const json = JSON.stringify(bundle, null, 2)
            const nombre = patient.nombre.replace(/[^\w]/g, '_').slice(0, 30)
            const blob = new Blob([json], { type: 'application/fhir+json' })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `expediente_${nombre}_FHIR_R4.json`
            a.click()
            URL.revokeObjectURL(url)
            /**
             * SE DICE QUÉ LLEVA. Antes las notas en borrador se caían del
             * archivo en silencio: un expediente con huecos que nadie señala se
             * entrega creyendo que está completo.
             */
            /**
             * SE DICE QUÉ LLEVA, UNA VEZ Y VERDAD. — REG-313
             *
             * Aquí salían DOS avisos por una sola descarga, y **se
             * contradecían sobre el mismo archivo**:
             *
             *   1. «… y N en borrador, marcadas como preliminares» → van
             *   2. «N en borrador NO van en FHIR — usa Expediente completo» → no van
             *
             * Mirado del otro lado (`src/lib/fhir-export.ts`, el bucle
             * `notas.filter(n => n.estado !== 'firmada')`): **los borradores SÍ
             * viajan**, con `status: 'preliminary'` y sólo con su narrativa. El
             * aviso 2 era falso, y era el último en pintarse — o sea, el que se
             * leía.
             *
             * Qué costaba: el médico creía que el archivo que acababa de mandar
             * a otra institución no llevaba nada sin firmar. Llevaba. Y de
             * propina le mandaba a exportar el expediente entero para incluir
             * algo que ya estaba dentro.
             *
             * Se queda UN aviso, y dice lo que el exportador hace de verdad.
             */
            const rn = resumenNotasExportadas(notasExportadas)
            /**
             * Y si el techo recortó la historia, se DICE — «lo que no se pudo
             * leer se declara». Un archivo incompleto que se entrega como
             * completo es el mismo defecto que el aviso de arriba corrigió.
             */
            const recorte = historia.truncada
              ? ' AVISO: este paciente tiene más historia de la que cabe en un archivo; lo que va aquí son las notas más recientes, no el expediente entero.'
              : ''
            toast(
              (rn.borradores > 0
                ? `Archivo listo: ${rn.firmadas} nota(s) firmada(s) y ${rn.borradores} en borrador, que viajan marcadas como preliminares y sólo con su texto — sin diagnósticos ni recetas estructuradas.`
                : `Archivo listo con ${rn.firmadas} nota(s) firmada(s).`) + recorte,
              rn.borradores > 0 || historia.truncada ? 'info' : 'success',
            )
            logAudit({ evento: 'export_datos', clinicId, patientId, medicoUid: user?.uid, medicoEmail: user?.email ?? undefined, meta: { formato: 'FHIR-R4', notas: notasExportadas.length, borradores: rn.borradores, truncada: historia.truncada } })
          }}
          /*
            EL NOMBRE ACCESIBLE, A MANO — y no por gusto: medido en navegador,
            las dos líneas del botón se concatenaban SIN espacio y quien lo oye
            con voz escuchaba «Enviar a otro sistemaFHIR R4». El texto en dos
            renglones es para el ojo; el oído necesita que alguien decida dónde
            acaba una frase.
          */
          aria-label="Enviar a otro sistema — archivo FHIR R4"
          style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--s2)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: 10, padding: '9px 16px', fontSize: 14, fontWeight: 600, cursor: 'pointer', textAlign: 'left' }}>
            <Upload size={15} />
            {/*
              RTC-21 (§25) — EL BOTÓN DICE EL TRABAJO; LA SIGLA SE QUEDA DEBAJO.
              «FHIR» solo es jerga de interoperabilidad: no dice qué hace ni
              para quién es. Pero **borrarla sería peor**: cuando otro hospital
              pide «el FHIR», el médico tiene que poder encontrarlo por ese
              nombre. Misma distinción que en RTC-13 con «créditos con IA» —
              §25 prohíbe vender la tecnología como característica, no esconder
              el nombre de un artefacto real que alguien de fuera va a pedir.
            */}
            <span style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.25 }}>
              Enviar a otro sistema
              <span style={{ fontSize: 10.5, fontWeight: 500, color: 'var(--text3)' }}>FHIR R4</span>
            </span>
          </button>
        </div>
      </section>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        /* Aquí vivían las reglas de .exp-actions (V10-DEBT-006): una rejilla
           de 2 columnas para ordenar CUATRO botones en el teléfono. RTC-10
           dejó uno y RTC-31 lo subió al ancla, así que la rejilla ordenaba una
           fila que ya no existe. Se va con ella — el invariante («el primario
           es lo primero que encuentra el pulgar») lo cumple ahora
           .nx-ancla-accion, más arriba en la pantalla.
           (Sin comillas invertidas: esto vive DENTRO de una plantilla de
           cadena y una sola la cerraría a mitad de comentario.) */
      `}</style>
    </div>
  )
}

/** Tarjeta colapsable con los datos de contacto del paciente (unificación
 *  de Pacientes + Expedientes en una sola pantalla). */
/**
 * RTC-09 — la capacidad que SE LLEVA al paciente.
 *
 * El consultor razona sobre el caso, así que necesita saber de quién se habla:
 * su página lee `?paciente=` desde antes (no es una ruta inventada aquí). Se
 * abre en pestaña nueva por la misma razón que en la consulta: la pregunta se
 * hace CON el expediente delante, no en vez de él.
 */
function CapacidadQueLleva({ href, nombre, paciente }: { href: string; nombre: string; paciente: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'flex-start' }}>
      {/* La voz del sistema (t-body), no un tamaño a mano: 13px estaba fuera
          de la escala y el trinquete de diseño lo cazó en la misma corrida. */}
      <p className="t-body" style={{ margin: 0, color: 'var(--text2)' }}>
        {paciente
          ? <>Se abre con <strong style={{ color: 'var(--text)' }}>{paciente}</strong> ya cargado como contexto: no hay que volver a decir de quién se trata.</>
          : <>Se abre con este paciente ya cargado como contexto.</>}
      </p>
      <button
        type="button"
        className="btn btn-secondary btn-sm"
        onClick={() => window.open(href, '_blank', 'noopener')}
      >
        <ExternalLink size={13} /> Abrir {nombre.toLowerCase()}
      </button>
    </div>
  )
}

/**
 * RTC-09 — la capacidad que NO se navega: se USA aquí.
 *
 * El antibiograma interpreta un panel S/I/R que el médico teclea en el momento;
 * mandarlo a otra pantalla era justo el viaje que §3.2 quiere borrar. La
 * consulta ya lo embebía así — este import perezoso es el MISMO patrón, y su
 * chunk sólo se descarga cuando la fila se abre.
 */
const AntibiogramaDelPaciente = dynamic(
  () => import('@/app/(dashboard)/antibiograma/page').then(m => m.AntibiogramaTool),
  { ssr: false, loading: () => <Spinner /> },
)

function DatosPaciente({ patient, onEditar, onRevocar }: { patient: Patient | null; onEditar: () => void; onRevocar: () => void }) {
  const [abierto, setAbierto] = useState(false)
  if (!patient) return null
  const campos: Array<[string, string | undefined]> = [
    ['Edad', patient.edad ? `${patient.edad} años` : undefined],
    ['Sexo', patient.sexo],
    ['Fecha de nacimiento', patient.fechaNacimiento],
    ['Teléfono', patient.telefono],
    ['WhatsApp', patient.whatsapp],
    ['Correo', patient.email],
    ['CURP', patient.curp],
    ['Seguro', patient.seguroMedico],
    ['Alergias', patient.alergias],
    ['Notas', patient.notas],
  ]
  const conValor = campos.filter(([, v]) => v && String(v).trim())
  /*
    RTC-27 — radio 12 → 10, el de la escala.

    No es cosmética suelta: la caja hermana de esta misma pantalla
    («Herramientas clínicas», más abajo) usa 10, así que dos contenedores del
    mismo rango tenían esquinas distintas por 2px. La escala del trinquete es
    {6, 10, 14, 50, 9999}; 12 no está en ella.

    (Comentario de JS, no de JSX. Un comentario de JSX delante del elemento
    raíz de un `return` son DOS nodos hermanos y el archivo no compila; ya
    pasó una vez en `secciones-recetas.tsx`, dentro de un ternario. Y este
    texto no puede CITAR la sintaxis de un comentario de JSX: la secuencia de
    cierre cerraría este bloque a mitad de frase — que es, literalmente, el
    segundo intento de escribir esta nota.)
  */
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 10, background: 'var(--s1)', marginBottom: 16, overflow: 'hidden' }}>
      <button onClick={() => setAbierto(a => !a)} style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px',
        background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text)', textAlign: 'left',
      }}>
        {abierto ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        <span style={{ fontSize: 14, fontWeight: 700 }}>Datos del paciente</span>
        <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text3)' }}>{abierto ? 'ocultar' : 'ver / editar'}</span>
      </button>
      {abierto && (
        <div style={{ padding: '4px 16px 14px', borderTop: '1px solid var(--border)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(180px, 100%), 1fr))', gap: 10, marginTop: 12 }}>
            {conValor.map(([k, v]) => (
              <div key={k}>
                <div style={{ fontSize: 10.5, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{k}</div>
                <div style={{ fontSize: 13.5, color: 'var(--text)', marginTop: 1 }}>{v}</div>
              </div>
            ))}
            {conValor.length === 0 && (
              <div style={{ fontSize: 13, color: 'var(--text3)' }}>Sin datos de contacto capturados.</div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
            <button onClick={onEditar} className="btn btn-secondary btn-sm">
              <Pencil size={13} /> Editar datos
            </button>
            {/*
              REVOCAR LOS ENLACES DEL PORTAL.
              El magic-link va firmado y con fecha, y no había forma de
              invalidar uno ya emitido: un teléfono perdido, un número reciclado
              o un mensaje reenviado a un grupo valían hasta caducar, y la única
              salida era esperar.
            */}
            <button onClick={onRevocar} className="btn btn-secondary btn-sm" title="Invalida todos los enlaces del portal enviados a este paciente">
              <Link2Off size={13} /> Invalidar enlaces del portal
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function NotaCard({ nota, esUltima, abierta, onToggle, onEditar, onImprimir, onGenerarReceta, onGenerarOrden, onBorrar }: {
  nota: NotaMedica; esUltima: boolean; abierta: boolean; onToggle: () => void; onEditar: () => void; onImprimir: () => void; onGenerarReceta: () => void; onGenerarOrden: () => void; onBorrar: () => void
}) {
  const firmada = nota.estado === 'firmada'
  const IconoTipo = ICONO_TIPO_NOTA[nota.tipo] ?? FileText
  const acento = firmada ? 'var(--nexus)' : 'var(--amber)'
  return (
    <div style={{ display: 'flex', gap: 14 }}>
      {/* Riel del timeline — nodo con icono del tipo de nota */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 34, flexShrink: 0 }}>
        <div style={{
          width: 34, height: 34, borderRadius: '50%', marginTop: 12,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: firmada ? 'var(--nexus-soft)' : 'color-mix(in srgb, var(--amber) 12%, transparent)',
          border: `1.5px solid ${acento}`, color: acento,
          zIndex: 1, flexShrink: 0,
        }}>
          <IconoTipo size={16} />
        </div>
        {!esUltima && <div style={{ width: 2, flex: 1, background: 'var(--border)', marginTop: 2 }} />}
      </div>

      {/* Card */}
      <div style={{
        flex: 1, marginBottom: 14, background: 'var(--s1)',
        border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden',
      }}>
        <button onClick={onToggle} style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 16px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', gap: 12,
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{TIPO_NOTA_LABEL[nota.tipo]}</span>
              <Badge tone={firmada ? 'cobalt' : 'amber'} dot>{firmada ? 'Firmada' : 'Borrador'}</Badge>
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--text2)', lineHeight: 1.5 }}>
              {nota.resumenEjecutivo || nota.diagnosticos.map(d => d.descripcion).join(', ') || 'Sin resumen'}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
              <Clock size={11} /> {new Date(nota.fechaConsulta).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' })}
            </div>
          </div>
          {abierta ? <ChevronUp size={16} color="var(--text3)" /> : <ChevronDown size={16} color="var(--text3)" />}
        </button>

        {abierta && (
          <div style={{ padding: '0 16px 16px', borderTop: '1px solid var(--border)' }}>
            {nota.signosVitales && Object.values(nota.signosVitales).some(Boolean) && (
              <div style={{ fontSize: 12, color: 'var(--text2)', margin: '12px 0', display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                {nota.signosVitales.ta && <span>TA {nota.signosVitales.ta}</span>}
                {nota.signosVitales.fc && <span>FC {nota.signosVitales.fc}</span>}
                {nota.signosVitales.fr && <span>FR {nota.signosVitales.fr}</span>}
                {nota.signosVitales.temperatura && <span>T° {nota.signosVitales.temperatura}</span>}
                {nota.signosVitales.spo2 && <span>SpO₂ {nota.signosVitales.spo2}%</span>}
              </div>
            )}
            {nota.secciones.filter(s => s.value.trim()).map(s => (
              <div key={s.key} style={{ marginTop: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--teal)', textTransform: 'uppercase', letterSpacing: 0.5 }}>{s.label}</div>
                <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6, whiteSpace: 'pre-wrap', marginTop: 3 }}>{s.value}</div>
              </div>
            ))}
            {nota.diagnosticos.length > 0 && (
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--teal)', textTransform: 'uppercase' }}>Diagnósticos</div>
                {nota.diagnosticos.map((d, i) => (
                  <div key={i} style={{ fontSize: 13, color: 'var(--text2)', marginTop: 3 }}>
                    • {d.descripcion} {d.codigoCIE10 && <span style={{ color: 'var(--text3)' }}>({d.codigoCIE10})</span>}
                  </div>
                ))}
              </div>
            )}
            {nota.medicamentos.length > 0 && (
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--teal)', textTransform: 'uppercase' }}>Medicamentos</div>
                {nota.medicamentos.map((m, i) => (
                  <div key={i} style={{ fontSize: 13, color: 'var(--text2)', marginTop: 3 }}>
                    • {[`${m.nombre}${m.dosis ? ` ${m.dosis}` : ''}`.trim(), m.via, m.frecuencia, m.duracion].filter(Boolean).join(' · ')}
                  </div>
                ))}
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
              {!firmada && (
                <button onClick={onEditar} style={ghostBtn}>Continuar edición</button>
              )}
              <button onClick={onImprimir} style={ghostBtn}><Printer size={13} /> Imprimir / PDF</button>
              {/* Receta y Orden — solo cuando la nota está firmada (datos confiables) */}
              {firmada && (
                <>
                  <button onClick={onGenerarReceta} style={{ ...ghostBtn, color: 'var(--teal)', borderColor: 'color-mix(in srgb, var(--nexus) 40%, transparent)', background: 'color-mix(in srgb, var(--nexus) 8%, transparent)' }}>
                    <Pill size={13} /> Generar receta
                  </button>
                  <button onClick={onGenerarOrden} style={{ ...ghostBtn, color: 'var(--purple)', borderColor: 'rgba(167,139,250,0.4)', background: 'rgba(167,139,250,0.08)' }}>
                    <ClipboardList size={13} /> Orden médica
                  </button>
                </>
              )}
              {!firmada && (
                <button onClick={onBorrar} style={{ ...ghostBtn, color: 'var(--red)', borderColor: 'color-mix(in srgb, var(--red) 30%, transparent)' }}>
                  <Trash2 size={13} /> Eliminar borrador
                </button>
              )}
            </div>
            {firmada && nota.firma && (
              <div style={{ marginTop: 14, fontSize: 11, color: 'var(--text3)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <CheckCircle2 size={12} color="var(--teal)" />
                Firmada por {nota.firma.nombreMedico} · Céd. {nota.firma.cedulaProfesional} · Sello {nota.metadata.hashIntegridad.slice(0, 12)}…
              </div>
            )}

            {/*
              §21 EN EL SITIO DONDE SE PREGUNTA. La inspección de la fuente
              vivía sólo en la consulta VIVA; la pregunta «¿de dónde salió
              esto?» se hace semanas después, y ese día se entra por aquí.

              Va junto a la firma y no arriba de los botones a propósito: la
              firma dice quién responde por la nota y con qué sello, y la
              procedencia dice de dónde salió su contenido. Son el mismo
              registro medicolegal, y §16 pide agrupar antes que encajonar.
              De paso, ningún control existente cambia de sitio.
            */}
            <ProcedenciaDeLaNota nota={nota} />
          </div>
        )}
      </div>
    </div>
  )
}

const backBtn: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: 'var(--text3)', fontSize: 13, cursor: 'pointer', marginBottom: 16, padding: 0 }
const alergiaBanner: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, background: 'color-mix(in srgb, var(--red) 12%, transparent)', border: '1px solid color-mix(in srgb, var(--red) 35%, transparent)', color: 'var(--red)', borderRadius: 8, padding: '10px 14px', fontSize: 13, marginBottom: 16 }
const primaryBtn: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, background: 'var(--nexus-solido)', color: '#fff', border: 'none', borderRadius: 10, padding: '11px 18px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }
const ghostBtn: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 5, background: 'var(--s2)', border: '1px solid var(--border)', color: 'var(--text2)', borderRadius: 8, padding: '7px 12px', fontSize: 12.5, cursor: 'pointer' }
const chip = (active: boolean): React.CSSProperties => ({ background: active ? 'var(--nexus-solido)' : 'var(--s2)', color: active ? '#fff' : 'var(--text2)', border: '1px solid var(--border)', borderRadius: 'var(--r-pill)', padding: '6px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer' })
