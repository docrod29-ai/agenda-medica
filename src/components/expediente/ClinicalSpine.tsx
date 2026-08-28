'use client'
import { useEffect, useRef, useState } from 'react'
import { comportamientoScroll } from '@/lib/ui/movimiento'
import { destinoDelRielHorizontal } from '@/lib/ui/traer-a-la-vista'

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

  /**
   * EL RIEL SE MUEVE CON LA LECTURA — Y **SÓLO** EL RIEL.
   *
   * Si el médico baja por el expediente y la categoría activa está fuera de la
   * parte visible del riel, el indicador de posición no indica nada: señala un
   * sitio que no se ve. Así que el activo se trae a la vista dentro del riel.
   *
   * ── LA PANTALLA QUE BOTABA (REG-337) ───────────────────────────────────────
   *
   * Esto se hacía con `scrollIntoView({ block: 'nearest', inline: 'nearest' })`
   * y el comentario decía «`nearest`, para no arrastrar la página». Es falso:
   * `nearest` elige la ALINEACIÓN, no a quién se desplaza. `scrollIntoView`
   * recorre **todos** los ancestros desplazables —el documento incluido— y
   * mueve cada uno.
   *
   * Con el ancla del paciente en `position: sticky` y este riel justo debajo en
   * flujo normal, al bajar ~100px el riel sale del viewport. El observador de
   * arriba marca otra sección activa → este efecto pide traer a la vista un
   * botón que ya no se ve → el navegador **sube la página** para enseñarlo → al
   * subir vuelve a cambiar la sección visible → otro salto. La pantalla botaba
   * mientras se bajaba, en teléfono y en escritorio: el defecto estaba en la
   * API del DOM, no en el dispositivo.
   *
   * El arreglo es desplazar el scrollport por su nombre. `riel.scrollTo(...)`
   * no puede tocar a un ancestro aunque quiera. La aritmética vive aparte
   * (`lib/ui/traer-a-la-vista.ts`) para poder probarla de verdad, y devuelve
   * `null` cuando el activo ya se ve — un desplazamiento de 0px, animado,
   * se pelea con el dedo del médico igual que uno de 300px.
   */
  const rielRef = useRef<HTMLElement | null>(null)
  useEffect(() => {
    const riel = rielRef.current
    if (!activo || !riel) return
    const el = riel.querySelector<HTMLElement>(`[data-spine-target="spine-${activo}"]`)
    if (!el) return
    const puerto = riel.getBoundingClientRect()
    const caja = el.getBoundingClientRect()
    const destino = destinoDelRielHorizontal({
      scrollLeft: riel.scrollLeft,
      puertoIzquierda: puerto.left,
      puertoDerecha: puerto.right,
      objetivoIzquierda: caja.left,
      objetivoDerecha: caja.right,
      // El mismo aire que `scrollPaddingLeft` de abajo: el corte cae entre
      // ítems, no a media palabra (RT-15).
      margen: 2,
      maximo: riel.scrollWidth - riel.clientWidth,
    })
    if (destino === null) return
    riel.scrollTo({ left: destino, behavior: comportamientoScroll() })
  }, [activo])

  if (items.length === 0) return null

  const irA = (id: string) => {
    setActivo(id)
    document.getElementById(`spine-${id}`)?.scrollIntoView({ behavior: comportamientoScroll(), block: 'start' })
  }

  return (
    /**
      * RTC-18 — EL SPINE DEJA DE VESTIRSE DE FILTRO.
      *
      * Medido el 14-ago contando píldoras en las seis superficies: cuatro no
      * tienen ninguna; `/pacientes` tiene UNA fila de tres, dos con conteos —
      * un filtro que dice cuántos hay informa—; y `/expediente` tenía **ocho en
      * TRES filas, 270px del primer pliegue**. Las tres filas hacían tres
      * trabajos distintos vestidos igual: este riel (navegación longitudinal,
      * §7), el filtro de la historia clínica, y los chips de diagnósticos.
      *
      * O sea que el defecto nunca fue «demasiadas píldoras»: era que **lo que
      * navega y lo que filtra tenían la misma silueta**. El arreglo no es
      * borrar píldoras — es que el riel hable el idioma de NAVEGACIÓN que este
      * producto ya tiene: `.nav-item`, con barra de acento en el activo, que es
      * lo que hablan el FlowRail y el riel de secciones de /configuracion.
      *
      * Aquí la barra va DEBAJO porque el riel es horizontal; en el FlowRail va
      * al costado. Misma gramática, distinta orientación.
      */
    <nav
      ref={rielRef}
      className="nx-clinical-spine"
      aria-label="Recorrido clínico del paciente"
      style={{
        display: 'flex', gap: 2, overflowX: 'auto', marginBottom: 16,
        WebkitOverflowScrolling: 'touch',
        borderBottom: '1px solid var(--border)',
        /* EL CORTE CAE ENTRE ÍTEMS, NO A MEDIA PALABRA (RT-15). En vez de
           tapar el corte con un degradado —que además sería deuda nueva del
           trinquete— se hace que no pueda cortar mal: el desplazamiento se
           ancla al principio de cada ítem. */
        scrollSnapType: 'x proximity',
        scrollPaddingLeft: 2,
      }}
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
              position: 'relative',
              display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0,
              /* §24: 44px de objetivo táctil. La forma de píldora venía con 32
                 y nadie lo miró porque parecía un chip; como riel de
                 navegación se mide con la vara de la navegación. */
              minHeight: 44, padding: '10px 12px',
              fontSize: 14, whiteSpace: 'nowrap', cursor: 'pointer',
              scrollSnapAlign: 'start',
              border: 'none', background: 'none', fontFamily: 'inherit',
              /* Selección = cobalto (VISUAL_DNA §3), pero dicho como lo dice la
                 navegación de este producto: barra de acento y texto que sube
                 de peso — no un relleno que compite con los datos de al lado. */
              fontWeight: seleccionado ? 600 : 500,
              color: seleccionado ? 'var(--text)' : 'var(--text2)',
              boxShadow: seleccionado ? 'inset 0 -2px 0 0 var(--nexus)' : 'none',
            }}
          >
            {it.label}
            {/* nx-num (V15-VISUAL-SYSTEM-001, 8ª rebanada): los conteos del
                riel son cifras clínicas — tabular-nums, como todo dato
                numérico del sistema (§2). */}
            {it.detail ? (
              <span className="nx-num" style={{ fontSize: 12, color: 'var(--text3)' }}>{it.detail}</span>
            ) : typeof it.count === 'number' ? (
              <span className="nx-num" style={{ fontSize: 12, color: 'var(--text3)' }}>{it.count}</span>
            ) : null}
          </button>
        )
      })}
    </nav>
  )
}
