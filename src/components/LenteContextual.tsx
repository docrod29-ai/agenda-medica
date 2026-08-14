'use client'
/**
 * LA LENTE CONTEXTUAL — Capa 4 de §5 del Master Loop V15.
 *
 * ── EL HUECO QUE TAPA ───────────────────────────────────────────────────────
 *
 * §5 pide un shell de CUATRO capas: franja de instrumentos · riel de flujo ·
 * lienzo clínico activo · **lente contextual**. `V15-SHELL-GREYBOX-001`
 * construyó las tres primeras y cerró sin la cuarta. RTC-12(a) lo dejó escrito
 * al unificar el lienzo de página: «no decide qué vive en el ancho que queda a
 * la derecha; el lienzo lo reserva, hoy está vacío».
 *
 * Esta es esa pieza, y el ancho reservado es su sitio.
 *
 * ── QUÉ MIDIÓ LA CORRIDA ANTES DE ESCRIBIR NADA ─────────────────────────────
 *
 * `scripts/design/medir-lente-contextual-v15.mjs`, fase «antes»
 * (`docs/design/capturas/v15-lente-contextual/acta-antes.json`):
 *
 *   · La inspección de la fuente existe en **1 de 6** superficies (/consulta).
 *   · La Capa 4 existe en **0 de 6**.
 *   · Inspeccionar EMPUJA la página: la nota pasa de 2141 a 2656px al abrir la
 *     procedencia y a 3013 al abrir «¿de dónde salió esto?» — en el teléfono,
 *     de 2666 a 3886. El disparador no se mueve porque está ARRIBA de lo que
 *     se despliega; todo lo que había debajo sí, entre 515 y 1220px.
 *   · **Escape no cierra nada** en ninguno de los dos, en ninguno de los dos
 *     anchos: se abre con el ratón y se cierra sólo con el ratón.
 *
 * O sea: el patrón de hoy cumple «no navega fuera» y «el foco se queda», y
 * falla «no pierdas el sitio» y «vuelve». Por eso NO se declara cumplido.
 *
 * ── LAS DECISIONES, Y POR QUÉ ───────────────────────────────────────────────
 *
 * 1. **TRANSITORIA POR CONSTRUCCIÓN.** Cerrada no renderiza NADA. §5 prohíbe
 *    por su nombre el «AI Copilot sidebar permanentemente abierto»: si el panel
 *    puede existir vacío, alguien acabará dejándolo abierto «por si acaso».
 *
 * 2. **UNA A LA VEZ.** Abrir una cierra las demás (evento `nx:lente-abierta`,
 *    declarado UNA vez aquí — ningún consumidor teclea la cadena). Dos lentes
 *    abiertas serían dos contextos compitiendo, que es el defecto que la capa
 *    viene a resolver.
 *
 * 3. **ESCRITORIO ANCHO: SE ACOPLA, NO SE SUPERPONE.** Y este punto empezó
 *    siendo el contrario. El plan era flotar el panel sobre «el ancho que queda
 *    a la derecha» que RTC-12(a) declaró reservado, contando con no tapar nada.
 *    La aritmética del propio shell lo refutó antes de escribir el CSS: con
 *    riel 224, lienzo 1100 centrado, medida de lectura 820 y panel 400, el
 *    borde del texto y el del panel se cruzan en TODOS los anchos reales —a
 *    1200 el panel taparía 268px de texto, a 1440 unos 86, y hasta ~1920 no
 *    dejaría libre la columna de lectura—. El canalón reservado existe, pero
 *    no cabe una lente dentro.
 *    Así que a partir de 1200px el shell CEDE ese ancho (`padding-right`) y la
 *    columna de trabajo se estrecha. El texto se re-fluye: es un coste real y
 *    menor al lado del que se evita, porque nada queda escondido detrás del
 *    panel y al cerrar vuelve todo a donde estaba.
 *
 * 4. **POR DEBAJO DE 1200: HOJA INFERIOR EN FLUJO**, hermana de `<main>` dentro
 *    de la columna del shell. Ahí no hay canalón que ocupar, y una hoja `fixed`
 *    con un `bottom` a mano taparía el BottomNav o dejaría aire — el número
 *    mágico que este repositorio ya pagó cuatro veces (los bottoms 78/92/120/136
 *    que mató RTC-32). En flujo, `<main>` cede el alto y la barra del pulgar
 *    sigue exactamente donde estaba, sin que nadie mida nada.
 *
 * 5. **LA VUELTA ES LA PIEZA, NO EL CONSUMIDOR.** Al cerrar, el foco vuelve al
 *    elemento que la abrió (§21: «return exactly where you were»). Si ese
 *    elemento ya no está en el documento no se fuerza nada: robarle el foco al
 *    body es peor que dejarlo donde el navegador lo puso.
 *
 * 6. **LA GEOMETRÍA VIVE EN LA HOJA** (`.nx-lente*` en `globals.css`), no en
 *    JSX — la lección de `nx-stat-grid`: un estilo en línea vence a la hoja en
 *    silencio y ningún medidor de CSS lo ve.
 *
 * ── LO QUE NO ES ────────────────────────────────────────────────────────────
 *
 * · No es un modal: no atrapa el foco, no pone velo y **no bloquea la página**.
 *   Se puede seguir leyendo y desplazando la nota con la lente abierta; ésa es
 *   justo la diferencia.
 * · No decide QUÉ se enseña dentro. El contenido lo renderiza el consumidor en
 *   su propio árbol (portal), así que sigue vivo: si el dato cambia debajo, el
 *   panel lo refleja. Una lente que guarda una copia del contenido enseñaría
 *   la foto de un dato clínico, no el dato.
 */
import { useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

/** El sitio del shell donde aterriza la Capa 4. Lo monta el layout, una vez. */
export const HUECO_DE_LENTE = 'nx-lente-hueco'

/** Una a la vez. Se declara aquí y no se teclea en ningún consumidor. */
const EVENTO_LENTE_ABIERTA = 'nx:lente-abierta'

export interface LenteProps {
  abierta: boolean
  /** Nombre de lo que se está inspeccionando. Es el nombre accesible del panel. */
  titulo: string
  /** Una línea de contexto. Opcional: si no añade nada, no se pone. */
  subtitulo?: string
  /**
   * El control que la abrió. Al cerrar, el foco vuelve ahí. Opcional: sin él
   * se recuerda `document.activeElement` del momento de abrir, que es lo mismo
   * en el caso normal y más frágil si el consumidor mueve el foco antes.
   */
  invocador?: React.RefObject<HTMLElement | null>
  alCerrar: () => void
  children: React.ReactNode
}

export function Lente({ abierta, titulo, subtitulo, invocador, alCerrar, children }: LenteProps) {
  const id = useId()
  const tituloId = `lente-titulo-${id.replace(/[^a-zA-Z0-9-]/g, '')}`
  const tituloRef = useRef<HTMLHeadingElement | null>(null)
  const cerrarRef = useRef(alCerrar)

  useEffect(() => { cerrarRef.current = alCerrar }, [alCerrar])

  /* EL DESTINO SE RESUELVE AL RENDERIZAR, NO EN UN EFECTO.
     Un `useState` + `setState` dentro de un efecto encadena un render de más
     (y el linter lo marca con razón). Aquí no hace falta: la lente es
     TRANSITORIA por construcción —`abierta` nace en `false` en los dos
     consumidores—, así que en el servidor y en la hidratación este componente
     no pinta nada y no hay desajuste posible.
     `document.body` es el respaldo para las superficies que no viven bajo el
     shell del dashboard: la geometría la pone la hoja, no el padre, así que se
     ve bien; lo que pierde es el sitio en la columna, y eso se prefiere a no
     poder enseñar la fuente. */
  const destino = abierta && typeof document !== 'undefined'
    ? (document.getElementById(HUECO_DE_LENTE) ?? document.body)
    : null

  /* Una a la vez + Escape + la vuelta del foco. Un solo efecto porque son la
     misma vida: la que empieza al abrir y termina al cerrar. */
  useEffect(() => {
    if (!abierta) return

    const previo = invocador?.current ?? (document.activeElement as HTMLElement | null)

    /**
     * EL HECHO SIGUE A LA VISTA — y esto lo encontró la medición, no el diseño.
     *
     * En escritorio la lente se acopla al costado y no toca el flujo: el acta
     * «despues» midió 0px de crecimiento y el disparador sin tapar. En el
     * teléfono la hoja inferior le quita alto a `<main>`, y el control que se
     * acaba de pulsar —que estaba a media pantalla— se queda por debajo del
     * nuevo borde: `disparadorTapado: true` en los dos casos móviles.
     *
     * Con el acordeón de antes eso no pasaba (el detalle crecía por DEBAJO del
     * disparador), así que dejarlo así habría sido cambiar un defecto por otro
     * en la pantalla más pequeña. Se desplaza lo MÍNIMO (`block: 'nearest'`) y
     * sólo si de verdad se salió, y al cerrar se devuelve el desplazamiento
     * exacto: «return exactly where you were» dicho en píxeles.
     */
    const scrollport = previo?.closest('main') ?? null
    const scrollPrevio = scrollport?.scrollTop ?? null
    const r1 = window.requestAnimationFrame(() => {
      if (!previo || !scrollport) return
      const p = previo.getBoundingClientRect()
      const s = scrollport.getBoundingClientRect()
      if (p.bottom > s.bottom || p.top < s.top) previo.scrollIntoView({ block: 'nearest' })
    })

    window.dispatchEvent(new CustomEvent(EVENTO_LENTE_ABIERTA, { detail: id }))
    const otraSeAbrio = (e: Event) => {
      if ((e as CustomEvent).detail !== id) cerrarRef.current()
    }
    const alTeclado = (e: KeyboardEvent) => { if (e.key === 'Escape') cerrarRef.current() }

    window.addEventListener(EVENTO_LENTE_ABIERTA, otraSeAbrio)
    document.addEventListener('keydown', alTeclado)

    /* El foco entra al título, no al primer control: lo primero que tiene que
       oír quien usa lector de pantalla es QUÉ se abrió. */
    const t = window.setTimeout(() => tituloRef.current?.focus(), 0)

    return () => {
      window.clearTimeout(t)
      window.cancelAnimationFrame(r1)
      window.removeEventListener(EVENTO_LENTE_ABIERTA, otraSeAbrio)
      document.removeEventListener('keydown', alTeclado)
      /* `preventScroll` y DESPUÉS el desplazamiento exacto: si el foco arrastra
         la vista por su cuenta, lo que se restaura ya no es donde se estaba. */
      if (previo && document.body.contains(previo)) previo.focus({ preventScroll: true })
      if (scrollport && scrollPrevio !== null) scrollport.scrollTop = scrollPrevio
    }
  }, [abierta, id, invocador])

  if (!abierta || !destino) return null

  return createPortal(
    <aside className="nx-lente" data-abierta="si" role="complementary" aria-labelledby={tituloId}>
      <header className="nx-lente-cabecera">
        <div className="nx-lente-rotulo">
          <h2 id={tituloId} ref={tituloRef} tabIndex={-1} className="nx-lente-titulo">{titulo}</h2>
          {subtitulo && <p className="nx-lente-sub">{subtitulo}</p>}
        </div>
        <button type="button" className="nx-lente-cerrar" onClick={alCerrar} aria-label="Cerrar el detalle">
          <X size={18} />
        </button>
      </header>
      <div className="nx-lente-cuerpo">{children}</div>
    </aside>,
    destino,
  )
}

export const POR_QUE_CERRADA_NO_RENDERIZA =
  '§5 prohíbe por su nombre el copiloto permanentemente abierto. Si el panel ' +
  'puede existir vacío, alguien acabará dejándolo abierto «por si acaso», y ' +
  'entonces deja de ser una lente para ser una cuarta columna.'

export const POR_QUE_NO_ES_UN_MODAL =
  'No atrapa el foco, no pone velo y no bloquea la página: con la lente ' +
  'abierta se sigue leyendo y desplazando la nota. Un modal obliga a elegir ' +
  'entre el hecho y su fuente, que es exactamente lo que §21 quiere evitar.'
