'use client'
/**
 * QUE EL TECLADO PUEDA HACER LO QUE HACE EL RATÓN.
 *
 * ── EL FALLO ─────────────────────────────────────────────────────────────────
 *
 * 24 sitios de la aplicación tienen un `<div onClick={…}>` sin nada más. Para el
 * ratón es un botón; para el teclado **no existe**: no recibe foco, no responde a
 * Enter, y un lector de pantalla lo anuncia como un párrafo cualquiera.
 *
 * Y no están en la propaganda. Están en las pantallas de trabajo:
 *
 *   · el CALENDARIO — cinco: la cita, la franja horaria, el día, el hueco;
 *   · la lista de PACIENTES y el tablero de CAMAS;
 *   · el pase de UCI y la hoja de enfermería;
 *   · las FILAS de tabla (`ui/Table.tsx`), que es un componente compartido: se
 *     arrastra a todas las tablas de la aplicación de una vez;
 *   · el corte de caja y la nota firmada.
 *
 * Un médico con la mano ocupada —guantes, un teléfono, un paciente— o cualquiera
 * que navegue por teclado se queda sin abrir la cita.
 *
 * ── POR QUÉ UNA SOLA IMPLEMENTACIÓN ──────────────────────────────────────────
 *
 * Porque «acuérdate de poner también `tabIndex` y `onKeyDown`» es exactamente el
 * tipo de regla que se cumple en las primeras cinco pantallas y se olvida en la
 * sexta. Aquí se pide una función y salen las cuatro cosas juntas.
 *
 * ── LO QUE **NO** LLEVA ESTO ─────────────────────────────────────────────────
 *
 * Los TELONES de fondo —`position: fixed; inset: 0` con un `onClick` que cierra—
 * no son controles: son una comodidad del ratón. Darles foco crearía una parada
 * de tabulador fantasma, un rectángulo invisible que atrapa al usuario sin decir
 * qué es. Para ésos está `useCerrarConEscape`, que es lo que el teclado espera.
 */
import { useEffect } from 'react'
import type { KeyboardEvent } from 'react'

/**
 * Convierte un elemento no interactivo en un botón de verdad.
 *
 * ```tsx
 * <div {...activable(() => abrirCita(a.id))} style={…}>
 * ```
 *
 * Enter **y** barra espaciadora: son las dos teclas que activan un botón nativo,
 * y quedarse con una sola deja a medias justo a quien esto viene a ayudar. La
 * barra además se `preventDefault` porque si no la página baja una pantalla.
 */
export function activable(alActivar: () => void, opciones?: { etiqueta?: string }) {
  return {
    role: 'button' as const,
    tabIndex: 0,
    ...(opciones?.etiqueta ? { 'aria-label': opciones.etiqueta } : {}),
    onClick: alActivar,
    onKeyDown: (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        alActivar()
      }
    },
  }
}

/**
 * Escape cierra.
 *
 * Es lo que espera cualquiera que abra un panel sin tocar el ratón, y en cuatro
 * sitios de la aplicación no pasaba nada: el modal de revisión de laboratorios,
 * el filtro de médicos, el menú de la agenda y el de la barra lateral se cerraban
 * ÚNICAMENTE haciendo clic fuera.
 *
 * `activo` evita registrar el escuchador cuando el panel está cerrado, que si no
 * un Escape en cualquier parte dispararía el cierre de algo que no está abierto.
 */
export function useCerrarConEscape(activo: boolean, cerrar: () => void) {
  useEffect(() => {
    if (!activo) return
    const alPulsar = (e: globalThis.KeyboardEvent) => { if (e.key === 'Escape') cerrar() }
    window.addEventListener('keydown', alPulsar)
    return () => window.removeEventListener('keydown', alPulsar)
  }, [activo, cerrar])
}

export const POR_QUE_EL_TELON_NO_LLEVA_FOCO =
  'Un telón de fondo no es un control: es una comodidad del ratón. Darle ' +
  '`tabIndex` crearía una parada de tabulador fantasma —un rectángulo invisible ' +
  'que atrapa al usuario sin decirle qué es—. Lo que el teclado espera de un ' +
  'panel abierto es que Escape lo cierre, y eso es lo que se le pone.'
