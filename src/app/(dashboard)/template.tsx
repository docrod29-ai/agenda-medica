'use client'

import { useEffect } from 'react'
import { rutaComprometida } from '@/lib/ui/continuidad'

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
 *
 * Ese mismo remontaje-por-navegación es la señal de commit que necesita la
 * coreografía de continuidad (§20, `src/lib/ui/continuidad.ts`): el efecto de
 * abajo avisa que la ruta nueva ya está en el DOM, para que la view transition
 * capture el estado nuevo en el momento correcto. Durante una navegación
 * coreografiada el crossfade se apaga desde globals.css
 * (`html[data-vt-continuidad] .page-transition`) — una sola voz por navegación.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  useEffect(() => { rutaComprometida() }, [])
  return <div className="page-transition">{children}</div>
}
