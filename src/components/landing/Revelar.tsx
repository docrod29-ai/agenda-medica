'use client'
/**
 * REVELAR AL ENTRAR — y, sobre todo, NO ESCONDER NADA QUE NO SE VAYA A REVELAR.
 *
 * ── EL RIESGO QUE GOBIERNA ESTE COMPONENTE ───────────────────────────────────
 *
 * La forma habitual de hacer esto —`opacity: 0` en CSS y una clase que lo sube
 * cuando el elemento entra en pantalla— tiene un fallo que sólo se ve el día
 * que falla: si el JavaScript no corre, si `IntersectionObserver` no existe, o
 * si el observador no llega a dispararse, **la portada se queda en blanco**. Y
 * ese día nadie lo ve, porque en la máquina de quien lo escribió siempre corre.
 *
 * Así que se invierte: el contenido nace **visible**. El estado oculto lo pone
 * el propio JavaScript, y sólo cuando ya sabe que va a poder quitarlo. Si algo
 * falla, lo peor que pasa es que no haya animación.
 *
 * ── Y SI EL USUARIO PIDIÓ MENOS MOVIMIENTO ───────────────────────────────────
 *
 * No se prepara nada: se queda visible y quieto desde el primer momento. La
 * pregunta se hace en `@/lib/ui/movimiento`, que es donde este repositorio
 * decidió que se hace una sola vez.
 *
 * El apagador global de `globals.css` (§24) no bastaría por sí solo: anula la
 * DURACIÓN de la transición, pero si el elemento arranca en `opacity: 0` y el
 * observador nunca lo saca de ahí, sigue invisible. La preferencia hay que
 * consultarla ANTES de esconder, no después.
 */
import { useEffect, useRef, type ReactNode } from 'react'
import { prefiereMenosMovimiento } from '@/lib/ui/movimiento'

export function Revelar({ children, retraso = 0 }: { children: ReactNode; retraso?: number }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (prefiereMenosMovimiento()) return
    if (typeof IntersectionObserver === 'undefined') return

    // Sólo AQUÍ se esconde: ya se sabe que hay observador y que el usuario
    // acepta movimiento.
    el.dataset.revelar = 'preparado'
    const obs = new IntersectionObserver(
      entradas => {
        for (const e of entradas) {
          if (!e.isIntersecting) continue
          el.dataset.revelar = 'visible'
          obs.disconnect()   // una vez y ya: esto no es un efecto de scroll
        }
      },
      // Se dispara un poco antes de que asome: llegar animándose se lee mejor
      // que empezar a animarse cuando ya está a la vista.
      { rootMargin: '0px 0px -12% 0px', threshold: 0.01 },
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  return (
    <div
      ref={ref}
      className="nx-revelar"
      style={{ ['--nx-revelar-retraso' as unknown as string]: `${retraso}ms` } as React.CSSProperties}
    >
      {children}
    </div>
  )
}
