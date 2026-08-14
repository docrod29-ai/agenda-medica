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
 */
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useClinic } from '@/context/ClinicContext'
import { tareasVivas } from '@/lib/tareas-clinicas/firestore'
import { ordenWorklist, debeEscalar, ETIQUETA_TIPO, type TareaClinica } from '@/lib/tareas-clinicas/modelo'
import { navegarConContinuidad, esClickDeNavegacionSimple } from '@/lib/ui/continuidad'
import { ChevronRight, FileClock, AlertTriangle } from 'lucide-react'

/** Vista previa, no el worklist entero: eso ya es `/pendientes`. */
const TOPE_VISIBLE = 5

export function ContinuidadPanel() {
  const { clinicId } = useClinic()
  const [tareas, setTareas] = useState<TareaClinica[]>([])
  const [cargando, setCargando] = useState(true)
  const [ahora, setAhora] = useState(0)

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

  return (
    <section className="card" style={{ padding: 0 }} aria-label="Continuidad entre consultas">
      <div className="hoy-bloque-head">
        <h2 className="hoy-bloque-titulo">Sigue abierto de antes</h2>
        <Link href="/pendientes" className="hoy-vertodas">
          Ver todo <ChevronRight size={14} />
        </Link>
      </div>
      <div>
        {visibles.map((tarea, i) => (
          <ContinuidadFila key={tarea.id} tarea={tarea} ahora={ahora} isLast={i === visibles.length - 1} />
        ))}
      </div>
      {ordenadas.length > TOPE_VISIBLE && (
        <div className="nx-meta" style={{ padding: '8px 20px 14px' }}>
          +{ordenadas.length - TOPE_VISIBLE} más en el worklist
        </div>
      )}
    </section>
  )
}

function ContinuidadFila({ tarea, ahora, isLast }: { tarea: TareaClinica; ahora: number; isLast: boolean }) {
  const esc = debeEscalar(tarea, ahora)
  const router = useRouter()
  const destino = tarea.patientId ? `/expediente/${tarea.patientId}` : '/pendientes'
  return (
    <Link
      href={destino}
      className="cita-fila"
      style={{ borderBottom: isLast ? 'none' : '1px solid var(--border)', textDecoration: 'none' }}
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
      <div className="cita-principal">
        <div style={{ width: 44, textAlign: 'center', flexShrink: 0, color: esc.escalar ? 'var(--red)' : 'var(--text3)' }}>
          {esc.escalar ? <AlertTriangle size={16} /> : <FileClock size={16} />}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          {/*
            R3 (VISUAL_DNA §2): la identidad del paciente encabeza la entrada —
            misma entidad (TareaClinica) y mismo idioma que /pendientes. Aquí es
            <span>, NO <a>: la FILA ENTERA ya navega al expediente; un enlace
            dentro de un enlace sería nested-interactive (axe) y dos destinos
            para el mismo gesto. El subrayado de a.nx-ident queda para las
            superficies donde la identidad es lo único que navega.
          */}
          <div style={{ display: 'flex', gap: 10, alignItems: 'baseline', flexWrap: 'wrap' }}>
            {tarea.patientNombre && <span className="nx-ident">{tarea.patientNombre}</span>}
            <span className="nx-estado">{ETIQUETA_TIPO[tarea.tipo] ?? 'Pendiente'}</span>
          </div>
          <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {tarea.titulo}
          </div>
        </div>
      </div>
      {esc.escalar && (
        <div className="cita-acciones">
          <span className="nx-critico"><AlertTriangle size={13} /> {esc.motivo}</span>
        </div>
      )}
    </Link>
  )
}
