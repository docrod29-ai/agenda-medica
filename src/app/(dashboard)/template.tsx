'use client'

/**
 * TRANSICIÓN DE ENTRADA entre pantallas del panel.
 *
 * Un `template` (a diferencia de `layout`) se re-monta en CADA navegación, así
 * que su animación se reproduce cada vez que cambias de pantalla. Antes cada
 * pantalla aparecía de golpe —un corte seco— y la navegación se sentía estática;
 * ir a la nota, al Consultor, a las citas y volver parecía que nada se movía.
 *
 * Es un crossfade de OPACIDAD, a propósito: NO un desplazamiento. Un `transform`
 * en este contenedor crearía un bloque contenedor y descolocaría los modales y
 * avisos con `position: fixed` que se abren DENTRO de las pantallas (no salen por
 * portal). El fundido logra la sensación fluida sin ese riesgo, y respeta
 * `prefers-reduced-motion`.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="page-transition">{children}</div>
}
