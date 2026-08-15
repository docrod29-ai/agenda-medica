'use client'
/**
 * LA LENTE CONTEXTUAL — Capa 4 del shell (§5), la pieza.
 *
 * El porqué, los límites y la regla de fallar cerrado viven en
 * `@/lib/lente/modelo`. Aquí está lo que sólo puede vivir en React: quién es el
 * dueño del estado, cómo se devuelve el foco y por qué el plano es UNO.
 *
 * ── EL DUEÑO DEL ESTADO ES EL SHELL, NO LA PANTALLA ─────────────────────────
 *
 * Si cada superficie guardara su propio «panel abierto», habría tantos planos
 * como pantallas y ninguno sería la Capa 4: serían seis paneles laterales que se
 * parecen. Peor, cada uno decidiría por su cuenta qué hace al cambiar de
 * paciente. El estado vive UNA vez, en el layout del dashboard, y las pantallas
 * sólo saben decir «inspecciona esto».
 *
 * ── LO QUE HACE QUE «VOLVER» SEA EXACTO ─────────────────────────────────────
 *
 * Tres cosas, y las tres son la misma promesa:
 *
 *  1. **La lente no navega.** No hay `router.push`, no hay cambio de ruta, no se
 *     remonta el árbol de la pantalla. El scroll de `<main>`, los filtros, el
 *     borrador a medio escribir y el paciente siguen exactamente donde estaban
 *     porque nunca se tocaron.
 *  2. **El foco vuelve al disparador.** Quien abrió con teclado vuelve al mismo
 *     control, no al principio de la página.
 *  3. **Cambiar de ruta CIERRA la lente.** No se reata al paciente nuevo: si el
 *     médico se fue, lo que estaba inspeccionando dejó de estar en pantalla, y
 *     un plano que sobrevive a la navegación acabaría enseñando la procedencia
 *     de un paciente sobre el expediente de otro. Es la familia
 *     «paciente equivocado» y se corta aquí, en el shell, no en cada llamador.
 *
 * ── DOS PRESENTACIONES, UNA IMPLEMENTACIÓN ──────────────────────────────────
 *
 * Escritorio: columna hermana del lienzo — Capa 4 al lado de la Capa 3, que es
 * lo que §5 describe. No es modal: el médico puede seguir leyendo la pantalla.
 *
 * Teléfono: hoja desde abajo, con telón, foco atrapado y scroll del cuerpo
 * bloqueado. **No es la columna encogida** (§22): a 390px una columna de 420px
 * no cabe, y una lente que tapa la pantalla entera sin ser un diálogo deja al
 * médico sin saber cómo volver.
 *
 * La FORMA la decide el CSS (`.nx-lente`), que es quien sabe de anchos — la
 * lección de RTC-22. Lo único que pregunta JavaScript es la SEMÁNTICA, porque
 * `aria-modal` no es un estilo: en el teléfono el plano sí atrapa, y decirlo
 * cuando no es verdad es peor que no decirlo.
 */
import { createContext, useContext, useEffect, useId, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import { X } from 'lucide-react'
import {
  claveDelHecho, tituloDelHecho, type HechoInspeccionable,
} from '@/lib/lente/modelo'
import { ContenidoDeLaLente } from './contenido'

interface ApiDeLaLente {
  /** El hecho que se está inspeccionando, o `null` si la lente está cerrada. */
  hecho: HechoInspeccionable | null
  /**
   * Inspeccionar un hecho. `origen` es el control que lo pidió: se guarda para
   * devolverle el foco al cerrar, y no se usa para nada más.
   */
  abrir: (hecho: HechoInspeccionable, origen?: HTMLElement | null) => void
  cerrar: () => void
}

const Contexto = createContext<ApiDeLaLente | null>(null)

/**
 * Se devuelve una API INERTE fuera del proveedor en vez de lanzar.
 *
 * Los llamadores son pantallas que también se montan en pruebas y en superficies
 * sin shell (la navegación de la asistente no monta la Capa 4). Reventar ahí
 * convertiría una capacidad opcional en un requisito de montaje, y el fallo
 * saldría como una pantalla en blanco. Sin proveedor, `abrir` no hace nada y
 * `hecho` es `null`: la fila sigue funcionando, sólo que sin lente.
 */
const INERTE: ApiDeLaLente = { hecho: null, abrir: () => {}, cerrar: () => {} }

export function useLente(): ApiDeLaLente {
  return useContext(Contexto) ?? INERTE
}

/** ¿Estamos en el ancho donde la lente es una hoja y no una columna? */
function useEsHoja(): boolean {
  const [esHoja, setEsHoja] = useState(false)
  useEffect(() => {
    // El MISMO corte que separa los dos shells (`nx-lado-escritorio` enciende a
    // 769px). Un corte propio pondría la lente en modo hoja mientras el riel de
    // escritorio sigue en pantalla, o al revés.
    const mq = window.matchMedia('(max-width: 768px)')
    const aplicar = () => setEsHoja(mq.matches)
    aplicar()
    mq.addEventListener('change', aplicar)
    return () => mq.removeEventListener('change', aplicar)
  }, [])
  return esHoja
}

export function LenteProvider({ children }: { children: ReactNode }) {
  /**
   * EL HECHO SE GUARDA CON LA RUTA DESDE LA QUE SE ABRIÓ, Y ESO ES LA DEFENSA.
   *
   * Cambiar de ruta tiene que cerrar la lente: un plano que sobrevive a la
   * navegación se queda enseñando la procedencia de un paciente encima del
   * expediente de otro, que es la familia «paciente equivocado» (REG-312). No se
   * REATA al paciente nuevo —eso sería inventar que lo inspeccionado le
   * pertenece—: desaparece.
   *
   * La primera versión lo hacía con un efecto que llamaba `setHecho(null)` al
   * cambiar `pathname`. Funcionaba y era peor de dos maneras, y el compilador de
   * React lo dijo antes que nadie («cascading renders»):
   *
   *  · **Había un frame de vida.** Entre que la ruta cambia y el efecto corre,
   *    el plano se pinta una vez con el hecho viejo sobre la pantalla nueva. Un
   *    frame es poco tiempo y suficiente para una captura, y sobre todo es un
   *    estado inválido que existe.
   *  · **La invariante quedaba en un efecto**, es decir, en algo que hay que
   *    acordarse de no quitar.
   *
   * Atándolo a la ruta y DERIVANDO, el estado inválido no llega a existir: si la
   * ruta no es la de apertura, no hay hecho que pintar. No es una comprobación
   * que se ejecuta, es una que no se puede saltar.
   */
  const [abierto, setAbierto] = useState<{ hecho: HechoInspeccionable; ruta: string } | null>(null)
  const disparadorRef = useRef<HTMLElement | null>(null)
  const pathname = usePathname()

  const hecho = abierto && abierto.ruta === pathname ? abierto.hecho : null

  const cerrar = () => {
    // El foco vuelve DESPUÉS de que el plano deje de existir: devolverlo
    // mientras el plano sigue montado lo pierde en el siguiente render.
    const volverA = disparadorRef.current
    disparadorRef.current = null
    setAbierto(null)
    if (volverA) queueMicrotask(() => volverA.focus?.())
  }

  const abrir = (nuevo: HechoInspeccionable, origen?: HTMLElement | null) => {
    // Idempotente: volver a pedir el mismo hecho en la misma ruta no reinicia el
    // plano, no vuelve a disparar su lectura y no pisa el disparador guardado.
    if (abierto && abierto.ruta === pathname && claveDelHecho(abierto.hecho) === claveDelHecho(nuevo)) return
    disparadorRef.current = origen ?? null
    setAbierto({ hecho: nuevo, ruta: pathname ?? '' })
  }

  return (
    <Contexto.Provider value={{ hecho, abrir, cerrar }}>
      {children}
    </Contexto.Provider>
  )
}

/**
 * EL PLANO SE MONTA DONDE VA LA CAPA 4, NO AL FINAL DEL ÁRBOL.
 *
 * El proveedor sólo lleva el estado; quien decide el SITIO es el layout, que lo
 * pone como hermano de `<main>` dentro del área de trabajo. Si el proveedor
 * pintara el plano él mismo, la Capa 4 acabaría colgando del final del shell y
 * tendría que volver a su sitio con `position: fixed` — es decir, flotando
 * sobre el trabajo, que es justo lo que RTC-32 quitó del shell.
 */
export function PlanoDeLente() {
  const { hecho, cerrar } = useLente()
  const cajaRef = useRef<HTMLDivElement>(null)
  const tituloId = useId()
  const esHoja = useEsHoja()
  const abierta = hecho !== null

  /**
   * ESCAPE SIEMPRE; TRAMPA DE FOCO Y BLOQUEO DE SCROLL SÓLO EN LA HOJA.
   *
   * En escritorio la lente es una columna del shell, no un diálogo: atrapar el
   * foco ahí encerraría al médico en un panel de consulta mientras el trabajo
   * clínico sigue visible a su izquierda, y bloquear el scroll del cuerpo
   * congelaría la pantalla que la lente existe para explicar.
   *
   * En el teléfono la hoja tapa el trabajo, así que sí es un diálogo y se
   * comporta como tal — mismo criterio que `Modal`, no uno nuevo.
   */
  useEffect(() => {
    if (!abierta) return

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); cerrar(); return }
      if (!esHoja || e.key !== 'Tab') return
      const items = Array.from(
        cajaRef.current?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      ).filter(el => el.offsetParent !== null || el === document.activeElement)
      if (!items.length) { e.preventDefault(); return }
      const primero = items[0], ultimo = items[items.length - 1]
      const activo = document.activeElement as HTMLElement | null
      if (e.shiftKey && (activo === primero || !cajaRef.current?.contains(activo))) {
        e.preventDefault(); ultimo.focus()
      } else if (!e.shiftKey && activo === ultimo) {
        e.preventDefault(); primero.focus()
      }
    }
    document.addEventListener('keydown', onKey)

    let scrollPrevio = ''
    if (esHoja) {
      scrollPrevio = document.body.style.overflow
      document.body.style.overflow = 'hidden'
    }
    return () => {
      document.removeEventListener('keydown', onKey)
      if (esHoja) document.body.style.overflow = scrollPrevio
    }
  }, [abierta, esHoja, cerrar])

  /*
    El foco entra al plano al abrirse, y se REPITE cuando cambia el hecho: sin
    esto, inspeccionar un segundo hecho con la lente ya abierta dejaría al
    lector de pantalla anunciando el plano anterior.

    Va al contenedor y no al primer control: el primer control de este plano es
    «Cerrar», y aterrizar en «Cerrar» es aterrizar en la salida. El contenedor
    lleva `tabIndex={-1}` y `aria-labelledby`, así que el lector anuncia QUÉ se
    está inspeccionando.
  */
  const clave = hecho ? claveDelHecho(hecho) : ''
  useEffect(() => {
    if (!abierta) return
    cajaRef.current?.focus?.()
  }, [abierta, clave])

  if (!hecho) return null

  return (
    <>
      {/* El telón sólo existe en la hoja (lo apaga el CSS en escritorio): en
          escritorio no hay nada que atenuar, porque la lente no tapa el
          trabajo. `aria-hidden` porque un telón no es un control — ver
          POR_QUE_EL_TELON_NO_LLEVA_FOCO en `@/lib/ui/activable`. */}
      <div className="nx-lente-telon" aria-hidden="true" onMouseDown={cerrar} />
      <aside
        ref={cajaRef}
        tabIndex={-1}
        className="nx-lente"
        role="dialog"
        aria-modal={esHoja}
        aria-labelledby={tituloId}
      >
        <div className="nx-lente-cabecera">
          {/*
            La cabecera dice DE QUÉ HABLA el plano, no cómo se llama el plano.
            «Detalle» sería el rótulo de cualquier panel lateral de cualquier
            producto; aquí el encabezado es el hecho concreto y encima va el
            rótulo del gesto, que es lo que hace la interacción reconocible.
          */}
          <div style={{ minWidth: 0 }}>
            <div className="t-overline">De dónde sale</div>
            <div className="t-h2" id={tituloId}>{tituloDelHecho(hecho)}</div>
          </div>
          <button className="btn btn-ghost btn-icon nx-lente-cerrar" onClick={cerrar} aria-label="Cerrar la inspección">
            <X size={16} />
          </button>
        </div>
        <div className="nx-lente-cuerpo">
          {/* `key` por hecho: cada inspección arranca su propia resolución en
              vez de heredar el estado de la anterior. */}
          <ContenidoDeLaLente key={clave} hecho={hecho} />
        </div>
      </aside>
    </>
  )
}
