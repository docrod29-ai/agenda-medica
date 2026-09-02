/**
 * ¿La pantalla es de teléfono?
 *
 * POR QUÉ NO ES UN `useEffect` CON `setState`
 * ───────────────────────────────────────────
 * La primera versión de esto leía `matchMedia` en un efecto y empujaba el
 * resultado a un estado. El lint de React lo cazó, y tenía razón dos veces:
 *
 *  1. Llamar a `setState` dentro del cuerpo de un efecto encadena renders.
 *  2. Y sobre todo: **un efecto no se entera de que la ventana cambió**. Un
 *     teléfono que gira, o una ventana de escritorio que alguien estrecha, se
 *     quedaban con la respuesta del primer render para siempre.
 *
 * `useSyncExternalStore` es justo la herramienta para esto: `matchMedia` es un
 * sistema externo al que uno se SUSCRIBE, no un estado que haya que copiar.
 *
 * EL SERVIDOR NO TIENE VENTANA
 * ────────────────────────────
 * Por eso la instantánea del servidor devuelve `false` —«no es un teléfono»— y
 * no intenta adivinar. Leer el ancho durante el render rompería la hidratación.
 * El cliente corrige en cuanto monta, que es lo que este hook garantiza.
 *
 * QUÉ NO HACE
 * ───────────
 * · No dice qué dispositivo es: dice cuánto mide la ventana. Un escritorio con
 *   la ventana estrecha contesta que sí, y está bien — la pregunta real es
 *   cuánto sitio hay, no qué aparato lo sostiene.
 * · No distingue el dedo del ratón. Para eso está `(pointer: coarse)`, que es
 *   otra pregunta y vive en la hoja de estilos.
 */
import { useSyncExternalStore } from 'react'

/** El mismo umbral que la hoja de estilos llama «teléfono». */
export const ANCHO_DE_TELEFONO = '(max-width: 640px)'

function suscribirse(avisar: () => void): () => void {
  if (typeof window === 'undefined' || !window.matchMedia) return () => {}
  const mq = window.matchMedia(ANCHO_DE_TELEFONO)
  mq.addEventListener('change', avisar)
  return () => mq.removeEventListener('change', avisar)
}

const enElCliente = () =>
  typeof window !== 'undefined' && !!window.matchMedia &&
  window.matchMedia(ANCHO_DE_TELEFONO).matches

/** En el servidor no hay ventana: no se adivina, se dice que no. */
const enElServidor = () => false

export function useEsTelefono(): boolean {
  return useSyncExternalStore(suscribirse, enElCliente, enElServidor)
}
