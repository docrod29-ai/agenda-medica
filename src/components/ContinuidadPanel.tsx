'use client'
/**
 * CONTINUIDAD — lo que cruzó de una consulta a otra y sigue sin resolverse.
 *
 * Zona CONTINUITY de V15-TODAY-001 (Fase 3 de
 * `docs/ai/NEXUSMED_MASTER_LOOP_V15_STRUCTURAL_UIUX_REARCHITECTURE.md`, §6):
 * «result awaiting action; follow-up; medication change needing review;
 * referral; patient question; pending course review».
 *
 * No es una fuente de datos nueva. `tareasVivas()` es la misma que ya lee
 * `/pendientes` (`src/lib/tareas-clinicas/firestore.ts`) — el worklist
 * completo del consultorio. Esta pantalla muestra sólo una vista previa
 * ordenada por urgencia (`ordenWorklist`); el trabajo de moverlas de estado
 * sigue viviendo en `/pendientes`, que es donde ya tiene botones, modal de
 * cancelación y las pruebas de esa transición. Duplicar esa lógica aquí sería
 * la misma clase de error que la carta operativa prohíbe: dos fuentes de
 * verdad para la misma entidad clínica.
 *
 * «Referral» y «patient question» no tienen tipo de tarea todavía —
 * `src/lib/tareas-clinicas/modelo.ts` lo dice de frente en su propio comentario
 * sobre `indicacion_paciente`: sin productor, no se inventa uno aquí para
 * llenar la zona. Lo que no hay fuente para pintar, no se pinta.
 *
 * ── §21 EN HOY: LA FILA DEJÓ DE SER MUDA ────────────────────────────────────
 *
 * Que el trabajo de MOVER un pendiente viva en `/pendientes` no significa que
 * ENTENDERLO tenga que vivir allí también, y esa distinción se había perdido.
 * Medido antes de tocar (`scripts/design/medir-porque-en-hoy-v15.mjs`, acta
 * `docs/design/capturas/v15-porque-en-hoy/acta-antes.json`): esta zona pintaba
 * **5 filas y ninguna podía preguntar nada**; para llegar a las cuatro
 * respuestas de §10 había que IRSE a `/pendientes`, y en el teléfono eso
 * costaba **171px de desplazamiento que no vuelven**.
 *
 * Hoy es donde el médico ve el pendiente por PRIMERA vez. §21 pide «fact →
 * inspect → source → return exactly where you were»: aquí no había «inspect»,
 * había navegar — la pérdida de contexto que §21 existe para evitar.
 *
 * Lo que se añade es la INSPECCIÓN, no el trabajo: se puede preguntar por qué
 * está aquí, quién responde, qué ha pasado y qué sigue, y saltar a la consulta
 * de la que salió. Mover de estado, cancelar con motivo y cerrar siguen siendo
 * de `/pendientes`, con sus botones y sus pruebas. Y las cuatro respuestas no
 * se re-escriben aquí: las pinta la misma pieza que allí
 * (`@/components/tareas/PorQueEstaAqui`), porque dos plantillas para la misma
 * entidad es la trampa de REG-318 montada otra vez.
 */
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useClinic } from '@/context/ClinicContext'
import { auth } from '@/lib/firebase'
import { tareasVivas } from '@/lib/tareas-clinicas/firestore'
import { ordenWorklist, debeEscalar, ETIQUETA_TIPO, type TareaClinica } from '@/lib/tareas-clinicas/modelo'
import { navegarConContinuidad, esClickDeNavegacionSimple } from '@/lib/ui/continuidad'
import { DisparadorPorQue, LentePorQue, usePorQue } from '@/components/tareas/PorQueEstaAqui'
import { ChevronRight, FileClock, AlertTriangle } from 'lucide-react'

/** Vista previa, no el worklist entero: eso ya es `/pendientes`. */
const TOPE_VISIBLE = 5

export function ContinuidadPanel() {
  const { clinicId } = useClinic()
  const [tareas, setTareas] = useState<TareaClinica[]>([])
  const [cargando, setCargando] = useState(true)
  const [ahora, setAhora] = useState(0)
  /* El estado de la lente vive AQUÍ, no en la fila: la lista se reordena por
     urgencia en cada `setAhora`, y una fila que se guardara si está abierta
     perdería la lente al reordenarse. Es la misma decisión —y la misma
     razón— que ya documenta `/pendientes`. */
  const { porQueId, disparador, scrollAlAbrir, alternar, cerrar } = usePorQue()
  const uid = auth.currentUser?.uid ?? ''

  useEffect(() => {
    if (!clinicId) return
    let vivo = true
    tareasVivas(clinicId)
      .then(t => { if (vivo) { setTareas(t); setAhora(Date.now()) } })
      .catch(() => {})
      .finally(() => { if (vivo) setCargando(false) })
    return () => { vivo = false }
  }, [clinicId])

  const ordenadas = useMemo(
    () => [...tareas].sort((a, b) => ordenWorklist(a, b, ahora)),
    [tareas, ahora],
  )

  // Cargando o vacío: no hay zona que pintar. Un bloque vacío con encabezado
  // propio es peor que no mostrarlo — el mismo criterio que ya usa ProxHero.
  if (cargando || ordenadas.length === 0) return null

  const visibles = ordenadas.slice(0, TOPE_VISIBLE)
  const abierta = porQueId ? (ordenadas.find(t => t.id === porQueId) ?? null) : null

  return (
    <section className="hoy-bloque" aria-label="Continuidad entre consultas">
      <div className="hoy-bloque-head">
        <h2 className="hoy-bloque-titulo">Sigue abierto de antes</h2>
        <Link href="/pendientes" className="hoy-vertodas">
          Ver todo <ChevronRight size={14} />
        </Link>
      </div>
      <div>
        {visibles.map((tarea, i) => (
          <ContinuidadFila
            key={tarea.id}
            tarea={tarea}
            ahora={ahora}
            isLast={i === visibles.length - 1}
            porQueId={porQueId}
            onAbrirPorQue={alternar}
          />
        ))}
      </div>
      {ordenadas.length > TOPE_VISIBLE && (
        <div className="nx-meta" style={{ padding: '8px 2px 14px' }}>
          +{ordenadas.length - TOPE_VISIBLE} más en el worklist
        </div>
      )}

      {/*
        §21 EN HOY — inspeccionar sin irse.

        La lente vive en el PANEL, no en la fila: una a la vez, y el estado no
        se pierde cuando la lista se reordena. La tarea se busca por id en cada
        render sobre `ordenadas` —no se guarda una copia—, así que si el
        pendiente cambia debajo, lo que se lee es el de ahora; y si desaparece
        de la lista, la lente se queda sin sujeto y no se abre.
      */}
      <LentePorQue tarea={abierta} uid={uid} invocador={disparador} scrollAlAbrir={scrollAlAbrir} alCerrar={cerrar} />
    </section>
  )
}

/**
 * LA FILA DEJÓ DE SER UN ENLACE ENTERO, y eso es el cambio estructural.
 *
 * Nació como un `<a>` que envolvía toda la fila. Es cómodo —cualquier píxel
 * navega— y es exactamente lo que impedía preguntarle nada: un `<button>`
 * dentro de un `<a>` es `nested-interactive` (axe) y dos destinos para el mismo
 * gesto. La mudez de esta zona no era un botón olvidado: era la forma de la
 * fila.
 *
 * Ahora la fila es la MISMA composición que su hermana de la agenda de Hoy
 * (`AppointmentRow`, dos metros más arriba en la misma pantalla): `.cita-fila`
 * como contenedor, `.cita-principal` como el enlace que navega, y
 * `.cita-acciones` para lo que se le hace a la entrada sin salir de la lista.
 * No es un patrón nuevo — es el que esta pantalla ya usa, aplicado donde
 * faltaba.
 */
function ContinuidadFila({ tarea, ahora, isLast, porQueId, onAbrirPorQue }: {
  tarea: TareaClinica
  ahora: number
  isLast: boolean
  porQueId: string | null
  onAbrirPorQue: (t: TareaClinica, control: HTMLElement) => void
}) {
  const esc = debeEscalar(tarea, ahora)
  const router = useRouter()
  const destino = tarea.patientId ? `/expediente/${tarea.patientId}` : '/pendientes'
  return (
    <div
      className="cita-fila"
      style={{ borderBottom: isLast ? 'none' : '1px solid var(--border)' }}
    >
      <Link
        href={destino}
        className="cita-principal"
        style={{ textDecoration: 'none' }}
        onClick={(e) => {
          /* §20: la fila de continuidad ES el salto Hoy→Paciente de la cadena.
             Sólo se coreografía cuando hay paciente (hay objeto compartido que
             preservar: su nombre viaja al <h1> del Patient Anchor) y el click
             es simple — Ctrl/Cmd/central conservan su pestaña nueva. */
          if (!tarea.patientId || !esClickDeNavegacionSimple(e)) return
          e.preventDefault()
          const origen = e.currentTarget.querySelector<HTMLElement>('.nx-ident')
          navegarConContinuidad(() => router.push(destino), origen)
        }}
      >
        <div style={{ width: 44, textAlign: 'center', flexShrink: 0, color: esc.escalar ? 'var(--red)' : 'var(--text3)' }}>
          {esc.escalar ? <AlertTriangle size={16} /> : <FileClock size={16} />}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          {/*
            R3 (VISUAL_DNA §2): la identidad del paciente encabeza la entrada —
            misma entidad (TareaClinica) y mismo idioma que /pendientes. Aquí es
            <span>, NO <a>: quien navega al expediente es el enlace que la
            envuelve; un enlace dentro de un enlace sería nested-interactive
            (axe) y dos destinos para el mismo gesto. El subrayado de a.nx-ident
            queda para las superficies donde la identidad es lo único que
            navega.
          */}
          <div style={{ display: 'flex', gap: 10, alignItems: 'baseline', flexWrap: 'wrap' }}>
            {tarea.patientNombre && <span className="nx-ident">{tarea.patientNombre}</span>}
            <span className="nx-estado">{ETIQUETA_TIPO[tarea.tipo] ?? 'Pendiente'}</span>
          </div>
          <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {tarea.titulo}
          </div>
        </div>
      </Link>

      {/*
        Lo que se le hace a la entrada SIN salir de Hoy. El motivo de escalada
        va primero porque es estado, no acción: se lee, no se pulsa. El
        disparador de §10 va después y subordinado (§16) — la acción primaria
        de esta fila sigue siendo abrir el expediente.
      */}
      <div className="cita-acciones">
        {esc.escalar && (
          <span className="nx-critico"><AlertTriangle size={13} /> {esc.motivo}</span>
        )}
        <DisparadorPorQue tarea={tarea} abierta={porQueId === tarea.id} onAbrir={onAbrirPorQue} />
      </div>
    </div>
  )
}
