'use client'
import { useEffect, useRef, useState } from 'react'
import { comportamientoScroll } from '@/lib/ui/movimiento'

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

/**
 * ¿A qué `scrollLeft` hay que llevar el riel para que el ítem activo se vea?
 * `null` = no hay que mover nada.
 *
 * Se saca del componente A PROPÓSITO. El defecto que cerró REG-342 no se podía
 * probar leyendo la fuente —las diez pruebas de scroll que había eran
 * `readFileSync` + `toContain`, y uno de ellas llegaba a comparar POSICIONES DE
 * CARACTERES dentro de un archivo—. Una decisión de desplazamiento que vive en
 * una función pura se prueba con números, y con números se puede afirmar lo
 * único que importa aquí: que de esta cuenta **sólo sale un eje horizontal y
 * sólo para el riel**. Ningún valor de entrada produce un movimiento vertical,
 * porque no hay ninguno que devolver.
 *
 * Todas las coordenadas son INTERNAS al riel (`offsetLeft`, `scrollLeft`,
 * `clientWidth`). No entra la posición de la página en la cuenta, así que no
 * puede salir.
 */
export function destinoDelRiel(m: {
  itemIzq: number
  itemAncho: number
  scrollLeft: number
  anchoVisible: number
}): number | null {
  const { itemIzq, itemAncho, scrollLeft, anchoVisible } = m
  if (!Number.isFinite(itemIzq) || !Number.isFinite(anchoVisible) || anchoVisible <= 0) return null

  const itemDer = itemIzq + itemAncho
  const visibleDer = scrollLeft + anchoVisible

  // Ya se ve entero: un desplazamiento que no hacía falta es un movimiento que
  // el médico no pidió.
  if (itemIzq >= scrollLeft && itemDer <= visibleDer) return null

  /** Un respiro de 2px para que el ítem no quede pegado al borde del riel. */
  const AIRE = 2
  const destino = itemIzq < scrollLeft
    ? itemIzq - AIRE                       // asomaba por la izquierda
    : itemDer - anchoVisible + AIRE        // asomaba por la derecha
  return Math.max(0, destino)
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
   * EL RIEL SE MUEVE CON LA LECTURA — Y SÓLO EL RIEL (REG-342).
   *
   * La intención sigue siendo la de antes: si el médico baja por el expediente y
   * la categoría activa queda fuera de la parte visible del riel, el indicador
   * de posición no indica nada. Se trae el activo a la vista.
   *
   * ── POR QUÉ YA NO SE USA `scrollIntoView` ───────────────────────────────────
   *
   * Porque `scrollIntoView` no mueve un contenedor: mueve **todos los ancestros
   * scrollables** hasta que el elemento se vea. El comentario anterior decía
   * «`nearest`, para no arrastrar la página», y ésa era la intención correcta —
   * pero `nearest` MINIMIZA la corrección, no impide que la haya.
   *
   * Y quien dispara esto es un `IntersectionObserver` que se activa **porque el
   * médico está bajando**. Una vez que el riel sale de pantalla por arriba,
   * `nearest` deja de ser inocuo: para enseñarlo hay que subir `<main>`. El
   * dedo baja, el riel pide que se le vea, la página vuelve arriba. Ése era el
   * rebote — y al pedirlo con desplazamiento suave, además cancelaba el impulso.
   *
   * Y al pedirlo con desplazamiento suave, en iOS además CANCELA la inercia del
   * dedo en vez de sumarse a ella: por eso se sentía como un tirón.
   *
   * Se sustituye por lo único que se quería: mover el `scrollLeft` DEL RIEL. Un
   * contenedor, un eje, ningún ancestro. La posición vertical de la página no
   * se puede tocar desde aquí ni por accidente.
   */
  const rielRef = useRef<HTMLElement | null>(null)
  useEffect(() => {
    const riel = rielRef.current
    if (!activo || !riel) return
    const el = riel.querySelector<HTMLElement>(`[data-spine-target="spine-${activo}"]`)
    if (!el) return

    const destino = destinoDelRiel({
      itemIzq: el.offsetLeft,
      itemAncho: el.offsetWidth,
      scrollLeft: riel.scrollLeft,
      anchoVisible: riel.clientWidth,
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
