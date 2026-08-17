import { forwardRef } from 'react'
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from 'react'
import { Loader2 } from 'lucide-react'
import Link from 'next/link'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'lg'

/** Lo que decide cómo se PINTA un control, sea el que actúa o el que navega. */
interface Apariencia {
  variant?: Variant
  size?: Size
  /** Icono lucide a la izquierda del texto */
  icon?: ReactNode
  /** Ocupa todo el ancho disponible */
  block?: boolean
}

interface ButtonProps extends Apariencia, ButtonHTMLAttributes<HTMLButtonElement> {
  /** Muestra spinner y deshabilita */
  loading?: boolean
}

const VARIANT_CLASS: Record<Variant, string> = {
  primary: 'btn-primary',
  secondary: 'btn-secondary',
  ghost: 'btn-ghost',
  danger: 'btn-danger',
}

const SIZE_CLASS: Record<Size, string> = {
  sm: 'btn-sm',
  md: '',
  lg: 'btn-lg',
}

/**
 * UNA sola composición de clases para los dos controles. Si `ButtonLink`
 * escribiera la suya, los dos empezarían idénticos y divergirían a la tercera
 * edición — la lección de REG-318, aplicada aquí antes de que ocurra.
 */
function clasesDeBoton({ variant = 'primary', size = 'md' }: Apariencia, className?: string) {
  return ['btn', VARIANT_CLASS[variant], SIZE_CLASS[size], className].filter(Boolean).join(' ')
}

const TAMAÑO_ICONO: Record<Size, number> = { sm: 14, md: 16, lg: 18 }

/**
 * Botón base. Wrapper tipado sobre las clases `.btn` del design system.
 * Variantes: primary (acción), secondary, ghost (terciaria), danger.
 *
 * Para un control que NAVEGA, usa `ButtonLink`: ver su cabecera.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', icon, loading, block, disabled, className, children, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      className={clasesDeBoton({ variant, size }, className)}
      disabled={disabled || loading}
      style={block ? { width: '100%' } : undefined}
      {...rest}
    >
      {loading ? (
        <Loader2 size={TAMAÑO_ICONO[size]} style={{ animation: 'spin 1s linear infinite' }} />
      ) : (
        icon
      )}
      {children}
    </button>
  )
})

interface ButtonLinkProps extends Apariencia, Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> {
  href: string
}

/**
 * EL CONTROL QUE NAVEGA — un enlace con el aspecto de un botón.
 *
 * ── POR QUÉ EXISTE ──────────────────────────────────────────────────────────
 *
 * El patrón que había en siete sitios era un `Button` DENTRO de un `Link`: un
 * `<button>` dentro de un `<a>`. Se ve bien y funciona con el ratón, y por eso
 * sobrevivió. Lo que hace mal, medido en navegador real
 * (`scripts/design/medir-boton-que-navega-v15.mjs`, acta
 * `docs/design/capturas/v15-boton-que-navega/`):
 *
 *   1. **HTML inválido.** El modelo de contenido de `<a>` prohíbe contenido
 *      interactivo dentro. Ningún navegador se queja: el árbol de
 *      accesibilidad queda a interpretación de cada lector de pantalla.
 *   2. **DOS paradas de teclado para UN destino** — medido: 2 en el CTA del
 *      héroe de Hoy, en 1440 y en 390. El médico tabula, cree que llegó al
 *      control, vuelve a tabular y sigue en el mismo sitio.
 *   3. **El mismo nombre accesible dos veces**, una como enlace y otra como
 *      botón, y las dos navegan (el clic del botón burbujea hasta el `<a>`).
 *
 * **axe NO lo ve.** Su regla `nested-interactive` sólo casa con roles
 * `childrenPresentational`, y `link` no es uno: mide 0 nodos sobre esto, antes
 * y después. Por eso hace falta el guardián estático
 * `v15-el-boton-que-navega-es-un-enlace.test.ts` — la vara automática que
 * había no podía cazarlo.
 *
 * ── LA REGLA ────────────────────────────────────────────────────────────────
 *
 * Un control que navega es UN enlace, y parece un botón porque lo dice la
 * HOJA. No hay un botón dentro.
 *
 * ── LO QUE DELIBERADAMENTE NO TIENE ─────────────────────────────────────────
 *
 * `loading` y `disabled` no existen aquí: un enlace no se deshabilita —
 * `pointer-events: none` lo esconde del teclado en vez de anunciarlo. Un
 * destino que a veces no está disponible es un `Button` con `onClick` que
 * navega, o un enlace que no se pinta. Se declara para que nadie los añada
 * «por simetría».
 */
export const ButtonLink = forwardRef<HTMLAnchorElement, ButtonLinkProps>(function ButtonLink(
  { variant = 'primary', size = 'md', icon, block, className, children, href, ...rest },
  ref,
) {
  return (
    <Link
      ref={ref}
      href={href}
      className={clasesDeBoton({ variant, size }, className)}
      style={block ? { width: '100%' } : undefined}
      {...rest}
    >
      {icon}
      {children}
    </Link>
  )
})
