'use client'
import { useEffect, useRef } from 'react'
import { useRouter, usePathname } from 'next/navigation'

/**
 * AVISA ANTES DE QUE UNA NAVEGACIÓN TERMINE LA GRABACIÓN — REG-279.
 *
 * ── QUÉ QUEDABA ABIERTO ─────────────────────────────────────────────────────
 *
 * REG-271 y REG-272 arreglaron la PÉRDIDA: el trozo final ya se persiste, el
 * audio sobrevive en IndexedDB y hay `beforeunload` al recargar o cerrar la
 * pestaña. Lo que quedaba era el AVISO dentro de la aplicación.
 *
 * `beforeunload` **no se dispara en un `router.push`**, y
 * `(dashboard)/template.tsx` desmonta la página en cada navegación. Así que
 * tocar «Agenda» en la barra inferior seguía terminando la grabación — ya sin
 * perder audio, pero **sin que el médico se enterara**. Se llevaba la sorpresa
 * al volver, con un cartel de recuperación que es fácil no ver.
 *
 * ── POR QUÉ SE INTERCEPTA EL CLIC Y NO LA RUTA ──────────────────────────────
 *
 * El App Router no expone eventos de ruta: no hay `routeChangeStart` al que
 * engancharse. Las alternativas eran parchear `history.pushState` —global, y
 * capaz de romper cualquier navegación de la aplicación— o mirar los clics.
 *
 * Se miran los clics, y sólo mientras se graba. Es el ámbito más pequeño que
 * cubre el caso real: todas las salidas de la consulta son `<Link>`, tanto en
 * `BottomNav` como en `Sidebar`.
 *
 * ── LO QUE **NO** CUBRE, Y HAY QUE DECIRLO ──────────────────────────────────
 *
 * - **El botón «atrás» del navegador.** Es un `popstate`, no un clic. Cancelarlo
 *   exige empujar una entrada falsa al historial, que es justo la clase de truco
 *   que rompe el atrás para todo lo demás. No se hace.
 * - **Una navegación por código** (`router.push` desde un manejador). Hoy la
 *   consulta no tiene ninguna que salga de la pantalla estando en grabación.
 * - **No impide salir.** Pregunta. Si el médico dice que sí, se navega — el
 *   audio está a salvo y el cartel de recuperación lo espera al volver.
 */
export function useAvisoAlSalirGrabando(
  grabando: boolean,
  confirmar: (mensaje: string, opts?: { titulo?: string; confirmar?: string }) => Promise<boolean>,
) {
  const router = useRouter()
  const pathname = usePathname()
  /**
   * El `confirm` del contexto cambia de identidad en cada render del proveedor;
   * el ref evita rearmar el oyente por eso. Se actualiza en un efecto y no
   * durante el render, que es error del compilador de React.
   */
  const confirmarRef = useRef(confirmar)
  useEffect(() => { confirmarRef.current = confirmar }, [confirmar])

  useEffect(() => {
    if (!grabando) return

    const alHacerClic = (ev: MouseEvent) => {
      // Clic con modificador o botón secundario: el navegador abre en otra
      // pestaña y esta pantalla NO se desmonta. No hay nada que avisar.
      if (ev.defaultPrevented || ev.button !== 0 || ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return

      const ancla = (ev.target as HTMLElement | null)?.closest?.('a[href]') as HTMLAnchorElement | null
      if (!ancla) return
      if (ancla.target && ancla.target !== '_self') return

      const href = ancla.getAttribute('href') ?? ''
      // Sólo navegación interna. Un enlace externo abre fuera y tampoco desmonta.
      if (!href.startsWith('/')) return
      // Enlace a la pantalla en la que ya estamos: el botón central de la barra
      // inferior es exactamente eso durante una consulta. Ni se desmonta ni se
      // pregunta.
      if (href.split('?')[0] === pathname) return

      ev.preventDefault()
      ev.stopPropagation()
      void confirmarRef.current(
        'La grabación en curso se detendrá. El audio queda guardado en este dispositivo y podrás recuperarlo al volver, pero no se transcribirá solo.',
        { titulo: '¿Salir de la consulta?', confirmar: 'Salir' },
      ).then(ok => { if (ok) router.push(href) })
    }

    // En captura: hay que llegar antes que el manejador de `<Link>`.
    document.addEventListener('click', alHacerClic, true)
    return () => document.removeEventListener('click', alHacerClic, true)
  }, [grabando, pathname, router])
}
