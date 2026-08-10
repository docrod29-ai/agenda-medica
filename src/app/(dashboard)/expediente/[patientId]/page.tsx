'use client'
import { useState, useEffect } from 'react'
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
import {
  ArrowLeft, Mic, FileText, Loader2, AlertTriangle, CheckCircle2,
  Clock, ChevronDown, ChevronUp, Plus, Printer, Trash2, Send, Pill, ClipboardList, Pencil, Upload,
  Stethoscope, Activity, LogIn, LogOut, UserPlus, ClipboardCheck, ShieldPlus, type LucideIcon,
  Camera, FlaskConical, Link2Off,
} from 'lucide-react'
import { Button, EmptyState, Spinner, Badge } from '@/components/ui'
import { FotosClinicas } from '@/components/FotosClinicas'
import { PanelLaboratorios } from '@/components/laboratorio/PanelLaboratorios'
import { ResumenPaciente } from '@/components/expediente/ResumenPaciente'
import { Herramientas } from '@/components/Herramientas'
import { ExpedienteVacio } from '@/components/brand/EmptyArt'
import { avatarColor } from '@/lib/avatar-color'
import { InternamientosDelPaciente } from '@/components/InternamientosDelPaciente'
import { CabosSueltosDelPaciente } from '@/components/CabosSueltosDelPaciente'
import { tareasDePaciente } from '@/lib/tareas-clinicas/firestore'
import { getInternamientosDePaciente } from '@/lib/hospital/firestore'
import { problemasActivos, resumenProblemas } from '@/lib/expediente/problemas-activos'
import { medicamentosVigentes, resumenVigentes } from '@/lib/expediente/ordenes-medicamento'

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
  const { notas, loading, error: errorNotas, reload } = useExpediente(patientId)
  const [errorPaciente, setErrorPaciente] = useState('')
  const [descargandoTodo, setDescargandoTodo] = useState(false)
  const [patient, setPatient] = useState<Patient | null>(null)
  // Por defecto muestra las notas de CONSULTORIO (no mezclar con hospital). Las
  // notas de hospital viven en su episodio; aquí quedan bajo la pestaña "Hospital".
  const [filtro, setFiltro] = useState<'todas' | 'consulta' | 'hospital'>('consulta')
  const [expandida, setExpandida] = useState<string | null>(null)

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
    // Marca fiable de nota hospitalaria: pertenece a un internamiento. La lista de
    // tipos es respaldo para notas viejas sin ese campo (postop/anestesia/consent.
    // también cuelgan de un internamiento → van a Hospital, no a Consulta).
    const hosp = !!n.internamientoId || ['ingreso', 'evolucion', 'egreso'].includes(n.tipo)
    return filtro === 'hospital' ? hosp : !hosp
  })

  return (
    <div className="page-pad" style={{ maxWidth: 880, margin: '0 auto' }}>
      {/* Back */}
      <button onClick={volver} style={backBtn}>
        <ArrowLeft size={15} /> Atrás
      </button>

      {/* Alergias banner — SIEMPRE rojo y visible */}
      {/* Si la lectura falló, decirlo AQUÍ: donde iría el banner de alergias. */}
      {errorPaciente && (
        <div style={{ background: 'color-mix(in srgb, var(--amber) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--amber) 40%, transparent)', borderRadius: 10, padding: '10px 14px', marginBottom: 12, fontSize: 13, color: 'var(--amber)', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span>⚠ {errorPaciente}</span>
          <button className="btn btn-sm" onClick={() => window.location.reload()}>Reintentar</button>
        </div>
      )}
      {/* Banner de alergias — ÚNICO en el expediente (antes había otro en la
          tarjeta de resumen: dos avisos para lo mismo). Se muestra siempre; rojo
          solo cuando hay alergias REALES, neutro si están negadas (rojo cuando
          no hay alergias es "gritar lobo" y desgasta la señal). */}
      {(() => {
        const a = (patient?.alergias ?? '').trim()
        const sin = !a || /^(ninguna|niega|no|sin|nkda|negad)/i.test(a)
        return (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, borderRadius: 8,
            padding: '10px 14px', fontSize: 13, marginBottom: 16,
            background: sin ? 'var(--s2)' : 'color-mix(in srgb, var(--red) 12%, transparent)',
            border: `1px solid ${sin ? 'var(--border)' : 'color-mix(in srgb, var(--red) 35%, transparent)'}`,
            color: sin ? 'var(--text2)' : 'var(--red)',
          }}>
            <AlertTriangle size={16} style={{ flexShrink: 0 }} />
            <span><strong>Alergias:</strong> {a || 'no registradas'}</span>
          </div>
        )
      })()}

      {/* Patient header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
          <div style={{
            width: 52, height: 52, borderRadius: 16, flexShrink: 0,
            background: avatarColor(patient?.nombre ?? 'Paciente').bg,
            color: avatarColor(patient?.nombre ?? 'Paciente').fg,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 20, fontWeight: 600, fontFamily: 'var(--font-display)',
          }}>
            {(patient?.nombre ?? 'P').charAt(0).toUpperCase()}
          </div>
          <div style={{ minWidth: 0 }}>
            <h1 className="t-h1" style={{ margin: 0 }}>
              {patient?.nombre ?? 'Paciente'}
            </h1>
            <div style={{ fontSize: 13, color: 'var(--text3)', marginTop: 4 }}>
              {patient?.edad ? `${patient.edad} años` : ''}{patient?.sexo ? ` · ${patient.sexo}` : ''}
              {patient?.telefono ? ` · ${patient.telefono}` : ''}
            </div>
          </div>
        </div>
        {/* `exp-actions`: bajo 480px la rejilla pone el CTA primario (Nueva
            consulta con IA) ARRIBA a fila completa — sin ella, .actions-row
            global apila los 4 botones a lo ancho en orden DOM y el primario
            queda CUARTO, bajo tres secundarios de igual peso (V10-DEBT-006). */}
        <div className="actions-row exp-actions">
          <button onClick={() => router.push(`/referencia/${patientId}`)} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--s2)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: 10, padding: '11px 16px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
            <Send size={15} /> Carta de referencia
          </button>
          {/*
            EXPEDIENTE COMPLETO — lo que el archivo llamado «expediente» nunca fue.
            El botón de FHIR de al lado lleva paciente + notas FIRMADAS. Éste
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
            const bundle = exportarPacienteAFhir({ paciente: patient, notas, config })
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
            const rn = resumenNotasExportadas(notas)
            toast(
              rn.borradores > 0
                ? `Archivo FHIR descargado: ${rn.firmadas} nota(s) firmada(s) y ${rn.borradores} en borrador, marcadas como preliminares. Los borradores van sin diagnósticos ni recetas estructuradas.`
                : `Archivo FHIR descargado: ${rn.firmadas} nota(s) firmada(s).`,
              'success',
            )
            logAudit({ evento: 'export_datos', clinicId, patientId, medicoUid: user?.uid, medicoEmail: user?.email ?? undefined, meta: { formato: 'FHIR-R4', notas: notas.length, borradores: rn.borradores } })
            /**
             * FHIR sólo lleva las notas FIRMADAS, y antes se descartaban las
             * demás en silencio. Se dice cuántas quedaron fuera: un archivo con
             * huecos que nadie señala se entrega creyendo que está completo.
             */
            const borradores = notas.filter(n => n.estado !== 'firmada').length
            toast(borradores
              ? `FHIR R4 exportado con ${notas.length - borradores} notas firmadas. ${borradores} en borrador NO van en FHIR — usa «Expediente completo».`
              : 'Expediente exportado en FHIR R4', borradores ? 'info' : 'success')
          }} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--s2)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: 10, padding: '11px 16px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
            <Upload size={15} /> FHIR
          </button>
          <button onClick={() => router.push(`/consulta/${patientId}`)} style={primaryBtn}>
            <Mic size={16} /> Nueva consulta con IA
          </button>
        </div>
      </div>

      {/* Resumen del paciente: alergias, últimos signos, diagnósticos activos y
          actividad — todo de un vistazo (lo que la competencia enseña como fuerte,
          pero aquí la info ya existía, solo estaba dispersa). */}
      <ResumenPaciente patient={patient} notas={notas} />

      {/* Datos del paciente (contacto) — plegado, para editar cuando haga falta. */}
      <DatosPaciente
        patient={patient}
        onEditar={() => router.push('/pacientes')}
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
          duplicadas). Laboratorios y la fotografía seriada, ambas plegadas. */}
      {clinicId && patientId && (
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
        ]} />
      )}

      {/* La valoración del inmunocomprometido vive ahora como TIPO DE NOTA en la
          consulta ("Valoración Inmunocomprometido"), no como sección aquí. */}

      {/* Historia clínica */}
      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '4px 0 12px' }}>
        Historia clínica
      </div>

      {/*
        EL ESTADO ACTUAL, EN UNA LÍNEA (REG-262).

        `resumenProblemas` y `resumenVigentes` decían en su comentario «frase
        corta para el encabezado de la consulta», y no las llamaba nadie.

        No van en la consulta: ahí las dos listas ya se enseñan ENTERAS, y una
        versión corta al lado de la larga es duplicar. Van aquí, donde el
        expediente ya tiene las notas cargadas —así que no cuesta ni una
        lectura más— y no había ningún resumen: para saber qué tiene y qué toma
        había que leerse la lista de notas.

        Se calcula sobre las FIRMADAS: un borrador no es historia clínica.
      */}
      {(() => {
        /* La MISMA proyección que usa la consulta: si aquí se armara distinto,
           el mismo paciente tendría dos «problemas activos» según la pantalla. */
        const firmadas = notas.filter(n => n.estado === 'firmada').map(n => ({
          fecha: n.fechaConsulta ?? n.metadata?.fechaCreacion ?? '',
          medicamentos: n.medicamentos,
          diagnosticos: n.diagnosticos,
        }))
        const problemas = problemasActivos(firmadas)
        const vigentes = medicamentosVigentes(firmadas)
        if (!problemas.length && !vigentes.length) return null
        return (
          <div style={{
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
              </div>
            </div>
          </div>
        )
      })()}

      {/*
        LO QUE QUEDÓ PENDIENTE DE ESTE PACIENTE (REG-266).

        `tareasDePaciente()` decía en su comentario «para su expediente» y el
        expediente no las enseñaba: la función NO tenía un solo llamador.

        Va lo PRIMERO de la pantalla, encima incluso de los ingresos: un cabo
        suelto es lo único de aquí que exige una decisión hoy. Lo demás es
        historia, y la historia espera.
      */}
      {clinicId && (
        <CabosSueltosDelPaciente
          clinicId={clinicId}
          patientId={patientId}
          cargar={tareasDePaciente}
          alAbrirPendientes={() => router.push('/pendientes')}
        />
      )}

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
        <InternamientosDelPaciente
          clinicId={clinicId}
          patientId={patientId}
          cargar={getInternamientosDePaciente}
          alAbrir={id => router.push(`/hospitalizacion/${id}`)}
        />
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
        // Si estás en "Consulta" y no hay notas de consultorio PERO sí de hospital,
        // no muestres un vacío engañoso: apunta a la pestaña Hospital.
        (filtro === 'consulta' && notas.some(n => ['ingreso', 'evolucion', 'egreso'].includes(n.tipo))) ? (
          <EmptyState
            icon={<FileText size={22} />}
            title="Sin notas de consultorio"
            description="Este paciente solo tiene notas de hospitalización. Cambia a la pestaña “Hospital” para verlas."
            action={<Button variant="secondary" onClick={() => setFiltro('hospital')}>Ver notas de Hospital</Button>}
          />
        ) : errorNotas ? (
          /**
           * NO CONFUNDIR "falló la lectura" CON "no hay notas".
           *
           * El hook exponía `error` y la pantalla no lo consumía: ante cualquier
           * fallo de getNotas se hacía setNotas([]) y aquí se pintaba "Sin notas
           * todavía · Crear primera nota". Un paciente con años de historia se veía
           * como paciente nuevo con la red caída o el token vencido — exactamente
           * el patrón que ya provocó un susto de pérdida de datos con el censo.
           */
          <EmptyState
            illustration={<ExpedienteVacio />}
            title="No pudimos cargar el expediente"
            description="Las notas de este paciente están guardadas en el servidor; esto es un problema de conexión, no de tus datos."
            action={<Button onClick={() => reload()}>Reintentar</Button>}
          />
        ) : (
        <EmptyState
          illustration={<ExpedienteVacio />}
          title="Sin notas todavía"
          description="Inicia una consulta para crear la primera nota clínica de este paciente."
          action={<Button icon={<Plus size={16} />} onClick={() => router.push(`/consulta/${patientId}`)}>Crear primera nota</Button>}
        />
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
                if (pid && n.id) router.push(`/consulta/${pid}?nota=${n.id}`)
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
        </div>
      )}
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (max-width: 480px) {
          /* V10-DEBT-006: el CTA primario va PRIMERO en el teléfono. El orden
             DOM se queda como en escritorio (primario a la derecha, foco al
             final de la fila); aquí sólo cambia el orden VISUAL táctil. */
          .exp-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; width: 100%; }
          .exp-actions > button { width: 100%; min-height: 44px; justify-content: center; }
          .exp-actions > button:last-child { order: -1; grid-column: 1 / -1; }
          /* 3 secundarios en 2 columnas dejarían una celda huérfana: el primero
             (Carta de referencia) toma su fila y los otros dos comparten. */
          .exp-actions > button:first-child { grid-column: 1 / -1; }
        }
      `}</style>
    </div>
  )
}

/** Tarjeta colapsable con los datos de contacto del paciente (unificación
 *  de Pacientes + Expedientes en una sola pantalla). */
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
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 12, background: 'var(--s1)', marginBottom: 16, overflow: 'hidden' }}>
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
                  <button onClick={onGenerarReceta} style={{ ...ghostBtn, color: 'var(--teal)', borderColor: 'rgba(20,184,166,0.4)', background: 'rgba(20,184,166,0.08)' }}>
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
