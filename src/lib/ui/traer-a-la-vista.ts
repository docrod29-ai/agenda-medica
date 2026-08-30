'use client'
/**
 * TRAER ALGO A LA VISTA **DENTRO DE SU CARRIL**, SIN ARRASTRAR LA PÁGINA.
 *
 * ── EL FALLO ─────────────────────────────────────────────────────────────────
 *
 * `Element.scrollIntoView({ block: 'nearest', inline: 'nearest' })` NO significa
 * «muévete lo mínimo dentro de tu contenedor». Significa «recorre TODOS los
 * ancestros desplazables —el documento incluido— y desplaza cada uno lo mínimo
 * para que yo quede visible». `nearest` sólo elige la ALINEACIÓN, no el
 * conjunto de scrollports que se tocan.
 *
 * El Clinical Spine del expediente (`ClinicalSpine.tsx`) lo usaba para seguir
 * la lectura con el riel horizontal, y su comentario decía literalmente
 * «`nearest`, para no arrastrar la página». No era cierto. Como el ancla del
 * paciente es `position: sticky` y el riel va justo debajo en flujo normal, en
 * cuanto el médico baja ~100px el riel sale del viewport; el
 * IntersectionObserver marca otra sección activa, el efecto llama a
 * `scrollIntoView` sobre un botón del riel que ya no se ve, y el navegador
 * sube la PÁGINA para volver a enseñarlo. Al subir, la sección visible vuelve
 * a cambiar → otro `setActivo` → otro salto. La pantalla «bota» mientras se
 * baja, en teléfono y en escritorio por igual: el defecto está en la API del
 * DOM, no en el dispositivo.
 *
 * ── LA REGLA ─────────────────────────────────────────────────────────────────
 *
 * Cuando lo que se quiere mover es UN carril y sólo ese carril, no se pide
 * `scrollIntoView`: se calcula el destino y se desplaza el scrollport por su
 * nombre (`riel.scrollTo(...)`), que es la única forma de garantizar que
 * ningún ancestro se entera.
 *
 * Este módulo hace la aritmética —pura, sin DOM— para que se pueda probar de
 * verdad y no sólo mirando el texto del componente.
 *
 * ── LO QUE **NO** CUBRE ──────────────────────────────────────────────────────
 *
 * - Sólo el eje horizontal. Un carril vertical necesitaría su gemela; hoy no
 *   hay ninguno en el producto y no se escribe código sin quien lo llame.
 * - No decide CUÁNDO desplazar ni CON QUÉ suavidad — eso lo siguen decidiendo
 *   quien llama y `lib/ui/movimiento.ts`.
 * - No sabe de `direction: rtl`: asume que `scrollLeft` crece hacia la
 *   derecha, que es lo que hace el producto hoy (es-MX, en-US).
 */

export interface MedidasDelRiel {
  /** Desplazamiento horizontal actual del scrollport. */
  scrollLeft: number
  /** Borde izquierdo VISIBLE del scrollport, en coordenadas de viewport. */
  puertoIzquierda: number
  /** Borde derecho VISIBLE del scrollport, en coordenadas de viewport. */
  puertoDerecha: number
  /** Borde izquierdo del objetivo, en las MISMAS coordenadas que el puerto. */
  objetivoIzquierda: number
  /** Borde derecho del objetivo, en las MISMAS coordenadas que el puerto. */
  objetivoDerecha: number
  /** Aire que se deja antes del objetivo al alinearlo al principio. */
  margen?: number
  /** Tope real de desplazamiento (`scrollWidth - clientWidth`), si se conoce. */
  maximo?: number
}

/**
 * Devuelve el `scrollLeft` al que debe ir el carril para que el objetivo quede
 * visible, o `null` si ya lo está —y entonces no se toca nada, que es la mitad
 * del arreglo: un desplazamiento de 0px sigue siendo un desplazamiento, y
 * animado se pelea con el dedo del médico igual que uno de 300px.
 *
 * Alineación mínima, como haría `nearest`: si el objetivo se sale por la
 * izquierda se alinea al principio (con su margen); si se sale por la derecha
 * se alinea al final. Un objetivo más ancho que el puerto se alinea al
 * principio, que es donde empieza a leerse.
 */
export function destinoDelRielHorizontal(medidas: MedidasDelRiel): number | null {
  const {
    scrollLeft, puertoIzquierda, puertoDerecha,
    objetivoIzquierda, objetivoDerecha, margen = 0, maximo,
  } = medidas

  const bordeDeEntrada = puertoIzquierda + margen
  const seSaleIzquierda = objetivoIzquierda < bordeDeEntrada
  const seSaleDerecha = objetivoDerecha > puertoDerecha

  // Ya se ve entero: no hay nada que mover.
  if (!seSaleIzquierda && !seSaleDerecha) return null

  // Más ancho que el puerto (se sale por los dos lados) → al principio.
  const delta = seSaleIzquierda
    ? objetivoIzquierda - bordeDeEntrada
    : objetivoDerecha - puertoDerecha

  let destino = scrollLeft + delta
  if (destino < 0) destino = 0
  if (typeof maximo === 'number' && maximo >= 0 && destino > maximo) destino = maximo

  // El recorte contra los topes puede dejar el destino donde ya estábamos.
  return destino === scrollLeft ? null : destino
}
