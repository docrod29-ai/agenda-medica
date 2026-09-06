'use client'
/**
 * PESTAÑAS QUE SE ANUNCIAN COMO PESTAÑAS — Panel de Lujo C-026.
 *
 * ── QUÉ FALLABA ──────────────────────────────────────────────────────────────
 *
 * `ui/Tabs` pintaba un `<div class="tabs">` con `<button class="tab">` dentro:
 * a la vista son pestañas y para la tecnología de asistencia eran **botones
 * sueltos**. Sin `role="tablist"`, sin `role="tab"` y sin `aria-selected`, un
 * lector de pantalla anuncia «botón, Recetas» sin decir que es una de cinco ni
 * cuál está puesta, y las flechas no mueven entre ellas.
 *
 * Importa más de lo que parece porque esto no es un componente de adorno: es el
 * que usa Configuración con sus 17 pestañas, y la persona que más las recorre a
 * teclado es justo la que ya lleva media hora en esa pantalla.
 *
 * ── CÓMO SE DESCUBRIÓ ────────────────────────────────────────────────────────
 *
 * Auditoría del Panel de Lujo (6-sep-2026), auditor `C-programador`, hallazgo
 * C-026, confirmado por el equipo rojo.
 *
 * ── LO QUE SE AÑADIÓ, Y POR QUÉ ASÍ ──────────────────────────────────────────
 *
 * El patrón completo de ARIA para pestañas, no la mitad:
 *
 *  · `role="tablist"` en el contenedor, con su nombre (`aria-label`).
 *  · `role="tab"` y `aria-selected` en cada una.
 *  · **Índice de tabulación rotatorio**: sólo la pestaña activa entra en el
 *    orden de tabulación. Sin esto, recorrer Configuración a teclado cuesta 17
 *    pulsaciones antes de llegar al contenido.
 *  · Flechas ← → para cambiar de pestaña, Inicio/Fin para ir a los extremos,
 *    con vuelta circular. Es lo que un lector de pantalla ya le ha prometido a
 *    quien lo usa en cuanto oye «pestaña».
 *
 * `aria-controls` es OPCIONAL y lo pone quien la usa (`panelId`): apuntar a un
 * id que no existe es peor que no apuntar a nada, así que no se inventa uno.
 *
 * ── QUÉ **NO** HACE ──────────────────────────────────────────────────────────
 *
 * No cambia de pestaña al recibir el foco (`activación manual`): el contenido de
 * varias de estas pestañas hace lecturas a Firestore, y activar al pasar
 * dispararía cinco lecturas por recorrer el teclado. Se cambia con la flecha,
 * que es lo que WAI-ARIA llama activación automática — aquí la flecha MUEVE el
 * foco y cambia la pestaña, porque el contenido ya estaba montado por la propia
 * pantalla y no hay coste; lo que no se hace es activar por `focus` recibido de
 * otra forma (un clic del ratón en un contenedor, un `focus()` programático).
 */
import { useRef, type KeyboardEvent, type ReactNode } from 'react'

export interface TabItem<K extends string = string> {
  key: K
  label: ReactNode
  /** Contador opcional mostrado junto al label */
  count?: number
  /** `id` del panel que abre esta pestaña, si la pantalla le puso uno. */
  panelId?: string
}

interface TabsProps<K extends string = string> {
  items: TabItem<K>[]
  value: K
  onChange: (key: K) => void
  className?: string
  /**
   * Cómo se llama este grupo de pestañas. Sin él, la lista se anuncia sin decir
   * de qué es — y en una pantalla con dos grupos de pestañas eso es peor que
   * nada. Tiene valor por defecto para no romper a quien ya la usa.
   */
  etiqueta?: string
}

/** Navegación por pestañas (borde inferior). Wrapper sobre `.tabs`/`.tab`. */
export function Tabs<K extends string = string>({
  items, value, onChange, className, etiqueta = 'Secciones',
}: TabsProps<K>) {
  const contenedor = useRef<HTMLDivElement>(null)

  const irA = (i: number) => {
    const destino = items[(i + items.length) % items.length]
    if (!destino) return
    onChange(destino.key)
    /* El foco viaja con la selección: si se quedara atrás, la siguiente flecha
       saldría del sitio equivocado. */
    contenedor.current
      ?.querySelectorAll<HTMLButtonElement>('[role="tab"]')
      [(i + items.length) % items.length]?.focus()
  }

  const alTeclado = (e: KeyboardEvent<HTMLDivElement>) => {
    const i = items.findIndex(t => t.key === value)
    if (i < 0) return
    if (e.key === 'ArrowRight') { e.preventDefault(); irA(i + 1) }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); irA(i - 1) }
    else if (e.key === 'Home') { e.preventDefault(); irA(0) }
    else if (e.key === 'End') { e.preventDefault(); irA(items.length - 1) }
  }

  return (
    <div
      ref={contenedor}
      role="tablist"
      aria-label={etiqueta}
      onKeyDown={alTeclado}
      className={['tabs', className].filter(Boolean).join(' ')}
    >
      {items.map(t => {
        const activa = value === t.key
        return (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={activa}
            aria-controls={t.panelId}
            /* Índice rotatorio: una sola parada de tabulación para todo el grupo. */
            tabIndex={activa ? 0 : -1}
            className={`tab${activa ? ' active' : ''}`}
            onClick={() => onChange(t.key)}
          >
            {t.label}
            {typeof t.count === 'number' && t.count > 0 && (
              <span style={{ marginLeft: 6, opacity: 0.7 }}>({t.count})</span>
            )}
          </button>
        )
      })}
    </div>
  )
}
