'use client'
import { useEffect, useRef, useState } from 'react'

/**
 * CLINICAL SPINE — V15-PATIENT-WORKSPACE-001 (§7: "a longitudinal structural
 * element, not a generic activity feed... should allow movement through
 * encounters, diagnoses, medications, labs...").
 *
 * Antes del Patient Anchor, `expediente/[patientId]/page.tsx` era una pila
 * lineal: encuentros, diagnósticos/medicamentos, herramientas, pendientes e
 * internamientos, todo apilado en el mismo peso visual, sin forma de moverse
 * entre ellos salvo desplazar la rueda del ratón. Esto NO es un dashboard de
 * tarjetas ni un índice genérico: es un riel que sólo enseña las categorías
 * que de verdad existen para ESTE paciente — «señalar de menos, nunca de
 * más» — con la posición real de lectura resaltada mientras el médico
 * recorre la página.
 *
 * NO abre ninguna fuente de datos propia. Cada `count`/`detail` llega ya
 * calculado por quien la llama, derivado de los mismos datos que la página
 * ya cargó — una entidad, una fuente de verdad, la misma regla que ya sigue
 * `PatientAnchor`.
 *
 * Los objetivos de desplazamiento son anclas reales en el DOM
 * (`id="spine-<item.id>"`), no rutas nuevas: moverse por el expediente de un
 * paciente no debe "resetear" al médico (§7, "no route should mentally
 * reset the physician").
 */
export interface ClinicalSpineItem {
  /** ID único del item; el ancla de destino real es `spine-<id>` en el DOM. */
  id: string
  label: string
  /** Conteo de una sola unidad (encuentros, episodios…). Nunca se inventa. */
  count?: number
  /** Texto libre cuando un solo número no representaría bien la categoría
   *  (p.ej. "4 dx · 2 fármacos"), en vez de fabricar un total sin sentido. */
  detail?: string
}

export function ClinicalSpine({ items }: { items: ClinicalSpineItem[] }) {
  const [activo, setActivo] = useState<string | null>(null)
  const itemsRef = useRef(items)
  useEffect(() => { itemsRef.current = items })

  /* Resalta en qué tramo del expediente está el médico mientras baja con la
     rueda — no sólo tras pulsar un botón. Sin esto el riel sería sólo una
     lista de atajos, no un elemento de posición longitudinal. */
  useEffect(() => {
    const elementos = itemsRef.current
      .map(it => document.getElementById(`spine-${it.id}`))
      .filter((el): el is HTMLElement => !!el)
    if (elementos.length === 0) return
    const observer = new IntersectionObserver(
      (entradas) => {
        const visibles = entradas
          .filter(e => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        if (visibles.length > 0) {
          const id = visibles[0].target.id.replace(/^spine-/, '')
          setActivo(id)
        }
      },
      { rootMargin: '-88px 0px -65% 0px', threshold: 0 },
    )
    elementos.forEach(el => observer.observe(el))
    return () => observer.disconnect()
    // Se reconstruye si cambia el CONJUNTO de ids (no la identidad del array):
    // pendientes/internamientos aparecen o desaparecen cuando terminan de cargar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.map(it => it.id).join('|')])

  if (items.length === 0) return null

  const irA = (id: string) => {
    setActivo(id)
    document.getElementById(`spine-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <nav
      className="nx-clinical-spine"
      aria-label="Recorrido clínico del paciente"
      style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 6, marginBottom: 16, WebkitOverflowScrolling: 'touch' }}
    >
      {items.map(it => {
        const seleccionado = activo === it.id
        return (
          <button
            key={it.id}
            type="button"
            onClick={() => irA(it.id)}
            aria-current={seleccionado ? 'true' : undefined}
            data-spine-target={`spine-${it.id}`}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0,
              minHeight: 32, padding: '7px 13px', borderRadius: 'var(--r-pill)',
              fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap', cursor: 'pointer',
              border: `1px solid ${seleccionado ? 'var(--text)' : 'var(--border)'}`,
              background: seleccionado ? 'var(--text)' : 'var(--s2)',
              color: seleccionado ? 'var(--bg)' : 'var(--text2)',
            }}
          >
            {it.label}
            {it.detail ? (
              <span style={{ fontSize: 10.5, fontWeight: 800, opacity: 0.85 }}>{it.detail}</span>
            ) : typeof it.count === 'number' ? (
              <span style={{ fontSize: 10.5, fontWeight: 800, opacity: 0.85 }}>{it.count}</span>
            ) : null}
          </button>
        )
      })}
    </nav>
  )
}
