'use client'
/**
 * NAVEGACIÓN PÚBLICA — y el menú que en móvil no existía.
 *
 * ── QUÉ HABÍA, MEDIDO EN EL NAVEGADOR ───────────────────────────────────────
 *
 * A 390 px la portada servía una barra con el logotipo y **dos botones de
 * sesión**, y nada más: ni un enlace. Precios, seguridad, demo y paquetes sólo
 * se alcanzaban desplazándose por una página de **9 998 px** —doce pantallas—
 * o desde el pie. En la captura de referencia
 * (`docs/audit/ausculta-transformacion/antes/landing-390-p00.png`) se ve además
 * que los tres elementos ocupan el ancho entero y «Prueba gratis →» llega
 * pegado al borde.
 *
 * El sitio público no tenía menú móvil. No es que estuviera mal diseñado: no
 * estaba.
 *
 * ── LAS DECISIONES ──────────────────────────────────────────────────────────
 *
 * **Se abre desde donde se pulsó.** El panel nace en la esquina del botón
 * (`transform-origin`) y crece hacia abajo. Un cajón que entra desde el borde
 * contrario al dedo rompe la relación causa-efecto: el usuario pulsó AQUÍ y
 * apareció ALLÁ. Los enlaces entran escalonados 22 ms — lo justo para que la
 * lista se lea como una lista y no como un bloque que aparece de golpe.
 *
 * **Cabe en el pulgar.** El panel se ancla arriba pero su contenido se lee de
 * arriba abajo y las acciones de cuenta quedan al final, que es donde llega la
 * mano. Alturas de 48 px: por encima del mínimo de 44×44 de WCAG 2.2.
 *
 * **Dice dónde estás.** `aria-current="page"` y una marca visual — no sólo
 * color: una barra de acento a la izquierda, que sobrevive a la ceguera al
 * color y a un modo de alto contraste.
 *
 * **Teclado.** El disparador es un `<button>` con `aria-expanded`/`aria-controls`.
 * Escape cierra y **devuelve el foco al botón** (WCAG 2.4.3): sin eso, cerrar
 * el menú te deja al principio del documento. El foco entra al panel al abrir y
 * queda atrapado mientras esté abierto.
 *
 * **Áreas seguras.** `padding-bottom` con `env(safe-area-inset-bottom)`: en un
 * iPhone con barra de gestos el último enlace quedaba debajo de ella.
 *
 * ── LO QUE NO SE HIZO, A PROPÓSITO ──────────────────────────────────────────
 *
 * No hay velo oscuro a pantalla completa ni bloqueo de desplazamiento del
 * cuerpo. Son seis enlaces, no una aplicación: el panel es un menú, y tratarlo
 * como un modal de página entera es la razón por la que tantos cajones se
 * sienten pesados. Sí cierra al tocar fuera, al pulsar Escape y al navegar.
 */
import { useEffect, useId, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Menu, X, ArrowRight } from 'lucide-react'
import { MarcaAusculta } from '@/components/MarcaAusculta'

const DESTINOS = [
  { href: '/#recorrido', rotulo: 'Cómo funciona', pista: 'De lo que se dice a la nota firmada' },
  { href: '/demo', rotulo: 'Ver el producto', pista: 'Recorrido con datos ficticios' },
  { href: '/precios', rotulo: 'Precios', pista: '14 días gratis, sin tarjeta' },
  { href: '/seguridad', rotulo: 'Seguridad', pista: 'Qué protegemos y cómo' },
  { href: '/evidencia', rotulo: 'Evidencia', pista: 'De dónde salen las cifras que publicamos' },
]

export function NavPublica() {
  const [abierto, setAbierto] = useState(false)
  const ruta = usePathname()
  const panelRef = useRef<HTMLDivElement>(null)
  const botonRef = useRef<HTMLButtonElement>(null)
  const idPanel = useId()

  useEffect(() => {
    if (!abierto) return
    const panel = panelRef.current
    panel?.querySelector<HTMLElement>('a, button')?.focus()

    const alTeclado = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        setAbierto(false)
        // Devolver el foco es la mitad que casi nadie hace: sin esto, cerrar
        // con Escape deja el foco en <body> y la siguiente tabulación empieza
        // por el principio del documento.
        botonRef.current?.focus()
        return
      }
      if (e.key !== 'Tab' || !panel) return
      const focales = panel.querySelectorAll<HTMLElement>('a[href], button:not([disabled])')
      if (!focales.length) return
      const primero = focales[0], ultimo = focales[focales.length - 1]
      if (e.shiftKey && document.activeElement === primero) { e.preventDefault(); ultimo.focus() }
      else if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primero.focus() }
    }
    const alPulsarFuera = (e: PointerEvent) => {
      const d = e.target as Node
      if (!panel?.contains(d) && !botonRef.current?.contains(d)) setAbierto(false)
    }
    document.addEventListener('keydown', alTeclado)
    document.addEventListener('pointerdown', alPulsarFuera)
    return () => {
      document.removeEventListener('keydown', alTeclado)
      document.removeEventListener('pointerdown', alPulsarFuera)
    }
  }, [abierto])

  const esActual = (href: string) => href !== '/#recorrido' && ruta === href

  return (
    <header className="nx-nav-publica">
      <Link href="/" className="nx-nav-marca" aria-label="Ausculta — inicio">
        <span className="nx-nav-marca-sello"><MarcaAusculta size={17} /></span>
        <span className="nx-nav-marca-texto">Ausculta</span>
      </Link>

      {/* Escritorio: los destinos viven a la vista. */}
      <nav className="nx-nav-destinos" aria-label="Secciones del sitio">
        {DESTINOS.map(d => (
          <Link key={d.href} href={d.href} aria-current={esActual(d.href) ? 'page' : undefined}>
            {d.rotulo}
          </Link>
        ))}
      </nav>

      <div className="nx-nav-cuenta">
        <Link href="/login" className="nx-nav-sesion">Iniciar sesión</Link>
        <Link href="/registro" className="btn btn-primary nx-nav-cta">
          Probar gratis <ArrowRight size={15} aria-hidden="true" />
        </Link>
      </div>

      {/* Móvil: un solo disparador. */}
      <button
        ref={botonRef}
        type="button"
        className="nx-nav-disparador"
        aria-expanded={abierto}
        aria-controls={idPanel}
        aria-label={abierto ? 'Cerrar menú' : 'Abrir menú'}
        onClick={() => setAbierto(v => !v)}
      >
        <span className="nx-nav-disparador-iconos" data-abierto={abierto}>
          <Menu size={21} aria-hidden="true" />
          <X size={21} aria-hidden="true" />
        </span>
      </button>

      <div
        ref={panelRef}
        id={idPanel}
        className="nx-nav-panel"
        data-abierto={abierto}
        inert={!abierto}
      >
        <nav aria-label="Menú">
          {DESTINOS.map((d, i) => (
            <Link
              key={d.href}
              href={d.href}
              className="nx-nav-panel-fila"
              aria-current={esActual(d.href) ? 'page' : undefined}
              style={{ ['--nx-orden' as string]: `${i}` }}
              /* Navegar cierra el menú, y se cierra AQUÍ y no en un efecto
                 sobre la ruta: la causa es el toque, no el cambio de URL — y
                 «Cómo funciona» es un ancla de esta misma página, que no
                 cambia la ruta y tenía que cerrarlo igual. */
              onClick={() => setAbierto(false)}
            >
              <span className="nx-nav-panel-rotulo">{d.rotulo}</span>
              <span className="nx-nav-panel-pista">{d.pista}</span>
            </Link>
          ))}
        </nav>
        <div className="nx-nav-panel-cuenta">
          <Link href="/login" className="btn btn-secondary" onClick={() => setAbierto(false)}>Iniciar sesión</Link>
          <Link href="/registro" className="btn btn-primary" onClick={() => setAbierto(false)}>
            Probar gratis <ArrowRight size={15} aria-hidden="true" />
          </Link>
        </div>
      </div>
    </header>
  )
}
