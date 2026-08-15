'use client'
/**
 * EL GESTO DE INSPECCIONAR — uno, y el mismo en todo el producto.
 *
 * ── POR QUÉ ES UNA PIEZA Y NO UN BOTÓN POR PANTALLA ─────────────────────────
 *
 * Porque lo que hace reconocible una interacción es que sea LA MISMA. Si cada
 * superficie inventa su forma de preguntar «¿de dónde sale esto?» —aquí un
 * enlace, allá un icono, más allá un chevron—, el médico tiene que aprender tres
 * gestos y no aprende ninguno. Este repositorio ya sabe cómo se cuela un tercer
 * criterio: `ETIQUETA_TIPO` estuvo copiada en dos sitios y la tercera copia iba a
 * nacer con `/pacientes`.
 *
 * Y hay una razón que no es de estilo: el disparador tiene que llegar entero al
 * shell —el elemento, no sólo el hecho— porque de él depende que el foco VUELVA
 * al cerrar. Un llamador que se olvide de pasarlo deja a quien navega con
 * teclado tirado al principio de la página. Aquí no se puede olvidar.
 *
 * ── LO QUE NO ES ────────────────────────────────────────────────────────────
 *
 * No es «ver más», no es «detalles», no es un chevron. Dice **de dónde sale**,
 * que es la pregunta que contesta. Un rótulo genérico convertiría una
 * interacción de trazabilidad en el enésimo botón de expandir.
 */
import { Fingerprint } from 'lucide-react'
import { claveDelHecho, type HechoInspeccionable } from '@/lib/lente/modelo'
import { useLente } from './LenteContextual'

export function Inspeccionar({
  hecho, etiqueta, describe, className, compacto,
}: {
  hecho: HechoInspeccionable
  /** Lo que se lee en el botón. Por defecto, la pregunta que contesta. */
  etiqueta?: string
  /**
   * El nombre accesible completo, cuando la etiqueta visible es corta.
   *
   * En una lista de treinta filas, treinta botones que se llaman «De dónde sale»
   * son treinta controles indistinguibles para un lector de pantalla. Quien
   * llama dice de QUÉ es este, y el nombre accesible queda «De dónde sale:
   * Biometría hemática de Refugio Alcántara».
   */
  describe?: string
  className?: string
  /** En una fila el botón es un icono; en una banda, texto. Misma conducta. */
  compacto?: boolean
}) {
  const { abrir, hecho: abierto } = useLente()
  const texto = etiqueta ?? 'De dónde sale'

  /* Sin `useCallback`: el compilador de React memoiza este componente solo, y
     una memoización manual que él no puede preservar le hace SALTARSE el
     archivo entero — el trinquete de lint lo caza como «Compilation Skipped».
     Optimizar a mano aquí costaba la optimización de todo lo demás. */
  const alPulsar = (e: React.MouseEvent<HTMLButtonElement>) => {
    /* El evento NO sigue subiendo: casi siempre este botón vive DENTRO de una
       fila que navega al expediente. Sin esto, inspeccionar abriría la lente y
       cambiaría de ruta en el mismo gesto — y el cambio de ruta cierra la
       lente, así que el médico vería un parpadeo y acabaría en otra pantalla. */
    e.stopPropagation()
    e.preventDefault()
    abrir(hecho, e.currentTarget)
  }

  return (
    <button
      type="button"
      onClick={alPulsar}
      className={['nx-inspeccionar', compacto ? 'nx-inspeccionar--icono' : '', className]
        .filter(Boolean).join(' ')}
      /* `aria-expanded` dice que este control abre algo y si está abierto. Sin
         él, un lector anuncia un botón que «no hace nada visible»: el plano se
         abre en otra región de la página y nada lo relaciona con el gesto.

         Y se compara POR HECHO, no «¿hay alguna lente abierta?»: con eso, abrir
         un pendiente marcaría como expandidos los treinta botones de la lista y
         un lector de pantalla anunciaría treinta secciones abiertas. */
      aria-expanded={abierto != null && claveDelHecho(abierto) === claveDelHecho(hecho)}
      aria-label={describe ? `De dónde sale: ${describe}` : undefined}
      title={describe ? `De dónde sale: ${describe}` : texto}
    >
      <Fingerprint size={14} aria-hidden="true" />
      {!compacto && <span>{texto}</span>}
    </button>
  )
}
