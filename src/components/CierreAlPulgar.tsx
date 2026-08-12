'use client'
/**
 * V15-MOBILE-001 (Fase 9, §22) — «firmar/cerrar desde el teléfono».
 *
 * La radiografía de la tercera rebanada (`medir-trabajos-moviles-v15.mjs`)
 * midió «Firmar y cerrar nota» a ~2,900px de scroll en /consulta a 390×844:
 * el trabajo móvil «sign/close» de §22 existía, pero el pulgar no llegaba a
 * él. Esta barra pegada al borde inferior de <main> (justo encima del
 * BottomNav) enseña el ESTADO del cierre — lista para firmar, o el motivo
 * real por el que no — y un toque lleva hasta la zona de cierre.
 *
 * LO QUE ESTA BARRA NO HACE, A PROPÓSITO: firmar. Firmar es un acto
 * consecuente (§19: «explicit review for consequential actions»; regla 3/6
 * de seguridad clínica) — el botón real vive junto a la validación NOM-004 y
 * el motivo de bloqueo, y ahí se queda. La barra sólo acorta el viaje: es
 * navegación, no una segunda vía de firma. Si algún día alguien le cablea un
 * `firmar()` aquí, el guardián `v15-cierre-al-pulgar.test.ts` lo caza.
 *
 * Sólo móvil (≤768px, `.nx-cierre-al-pulgar` en globals.css): en escritorio
 * el cierre está a un scroll corto de rueda y la barra sería ruido. Se
 * esconde sola cuando la zona de cierre ya está en pantalla
 * (IntersectionObserver — mismo patrón que el resaltado del ClinicalSpine):
 * dos accesos a «Firmar» a la vez confundirían cuál es el de verdad.
 *
 * Greybox (V15 §12): superficies y texto en variables neutras; el único
 * color es `var(--red)` del motivo de bloqueo, que es semántica de
 * seguridad, no decoración.
 */
import { useEffect, useState } from 'react'
import { ChevronsDown } from 'lucide-react'
import { comportamientoScroll } from '@/lib/ui/movimiento'

/**
 * ¿La barra tiene derecho a existir en este estado del encuentro?
 * Pura y testeable — el guardián la prueba al revés.
 *
 * - `firmada`: no queda nada que cerrar.
 * - `grabando` (incluye pausa y subida): la única acción que domina es la
 *   grabación (§8.6) y lo no esencial se calla (§8.5) — ofrecer el cierre a
 *   media escucha es exactamente el ruido que esa regla prohíbe.
 * - sin `hayContenido`: al principio la acción primaria es EmpezarAGrabar;
 *   una barra de cierre sobre una nota vacía invita a firmar nada.
 */
export function cierreAlPulgarVisible(p: {
  firmada: boolean
  grabando: boolean
  hayContenido: boolean
}): boolean {
  return !p.firmada && !p.grabando && p.hayContenido
}

export interface CierreAlPulgarProps {
  /** Resultado de `cierreAlPulgarVisible` — la página decide con SU estado. */
  visible: boolean
  /** `bloqueosDeFirma.length` de la página — la MISMA fuente que apaga Firmar. */
  bloqueos: number
  /** `motivoNoFirma` de la página — el MISMO texto del renglón junto a Firmar. */
  motivo: string | null
  /** `validacion.puntajeCompletitud` — el MISMO % que ya se pinta en el cierre. */
  completitud: number
  /** id del contenedor de la zona de cierre (ancla del viaje). */
  idDestino: string
}

export function CierreAlPulgar({ visible, bloqueos, motivo, completitud, idDestino }: CierreAlPulgarProps) {
  /**
   * ¿La zona de cierre ya está en pantalla? El rootMargin descuenta ~56px del
   * borde inferior — la altura de esta misma barra — para que «visible» sea
   * visible DE VERDAD para el médico, no tapado detrás de la barra.
   */
  const [cierreEnPantalla, setCierreEnPantalla] = useState(false)
  useEffect(() => {
    if (!visible) return
    const destino = document.getElementById(idDestino)
    if (!destino || typeof IntersectionObserver === 'undefined') return
    const obs = new IntersectionObserver(
      entradas => { for (const e of entradas) setCierreEnPantalla(e.isIntersecting) },
      { rootMargin: '0px 0px -56px 0px', threshold: 0.1 },
    )
    obs.observe(destino)
    return () => obs.disconnect()
  }, [visible, idDestino])

  if (!visible || cierreEnPantalla) return null

  const irAlCierre = () => {
    const destino = document.getElementById(idDestino)
    if (!destino) return
    // El foco viaja con el scroll (teclado/lector de pantalla aterrizan donde
    // aterrizó la vista); reduced-motion respeta la preferencia (§24).
    destino.focus({ preventScroll: true })
    destino.scrollIntoView({ behavior: comportamientoScroll(), block: 'center' })
  }

  const lista = bloqueos === 0
  return (
    <div className="nx-cierre-al-pulgar">
      <button
        type="button"
        onClick={irAlCierre}
        aria-label={lista
          ? 'Nota lista para firmar — ir al cierre de la consulta'
          : 'Ir al cierre de la consulta — aún no se puede firmar'}
        className="nx-cierre-al-pulgar-btn"
      >
        <span style={{ minWidth: 0, flex: 1, textAlign: 'left' }}>
          <span style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>
            {lista ? 'Nota lista para firmar' : 'Aún no se puede firmar'}
          </span>
          <span style={{ display: 'block', fontSize: 10.5, color: lista ? 'var(--text3)' : 'var(--red)', lineHeight: 1.4 }}>
            {lista ? `Completitud: ${completitud}% · revisar y firmar` : motivo}
          </span>
        </span>
        <span aria-hidden="true" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10.5, fontWeight: 600, color: 'var(--text2)', flexShrink: 0 }}>
          Ir al cierre <ChevronsDown size={14} />
        </span>
      </button>
    </div>
  )
}
