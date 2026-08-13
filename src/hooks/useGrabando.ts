'use client'
/**
 * ¿ESTÁ EL MICRÓFONO ABIERTO AHORA? — la compuerta COMPARTIDA de `EVENTO_GRABANDO`.
 *
 * ── POR QUÉ EXISTE (RTC-04, registro canónico del equipo rojo) ──────────────
 *
 * Cada pieza del shell que quería reaccionar a la grabación copiaba este mismo
 * hook en privado: FlowRail y BottomNav ya tenían DOS copias idénticas, y la
 * pila de avisos del layout —el banner de cobro que el equipo rojo encontró a
 * peso íntegro DENTRO del modo encuentro, sobre la franja de alergia— no tenía
 * ninguna, porque nadie se ACORDÓ de copiarla. Ésa es exactamente la familia
 * `depende_de_recordar`: una defensa que hay que recordar copiar es una
 * defensa que la siguiente superficie no tiene.
 *
 * Con la compuerta en un solo lugar, suscribirse es `useGrabando()` y nada
 * más. RTC-05 (los FAB flotantes) consume esta misma compuerta, no una copia.
 *
 * ── QUÉ DEVUELVE ────────────────────────────────────────────────────────────
 *
 * `true` mientras el micrófono está abierto (pausado cuenta como abierto —
 * la semántica la fija `DetalleDeEscucha`, no este hook), `false` al
 * detenerse y en el primer render (SSR/hidratación incluidos: antes del
 * primer evento no se está grabando).
 *
 * La fuente de verdad sigue siendo el evento de
 * `@/lib/seguridad/estoy-grabando` — este hook NO inventa un segundo criterio
 * de «estoy grabando», sólo le da forma de estado React a la señal que ya
 * emiten `useGrabacionAudio` y hermanos.
 */
import { useEffect, useState } from 'react'
import { EVENTO_GRABANDO, type DetalleDeEscucha } from '@/lib/seguridad/estoy-grabando'

export function useGrabando(): boolean {
  const [grabando, setGrabando] = useState(false)
  useEffect(() => {
    const alSonar = (ev: Event) => {
      const d = (ev as CustomEvent<DetalleDeEscucha>).detail
      /* El latido de AutoLogout suena con el MISMO nombre de evento pero sin
         transición: si el detail no trae un booleano, no es una transición de
         micrófono y no cambia el estado pintado. */
      if (!d || typeof d.activo !== 'boolean') return
      setGrabando(d.activo)
    }
    window.addEventListener(EVENTO_GRABANDO, alSonar)
    return () => window.removeEventListener(EVENTO_GRABANDO, alSonar)
  }, [])
  return grabando
}
