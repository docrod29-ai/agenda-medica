'use client'
/**
 * EL TEMA TIENE UNA FUENTE DE VERDAD — RTC-05 (registro canónico del equipo rojo).
 *
 * Hasta esta deuda, la lógica del tema (llave de localStorage, ciclo
 * dark→light→auto, pintado sobre <html>) vivía entera dentro del botón
 * flotante. Al mover el control a Operaciones en móvil (§11: el tema es
 * sistema, no trabajo clínico) habría nacido la SEGUNDA copia — la familia
 * `depende_de_recordar`: dos sitios que hay que acordarse de mantener
 * iguales. En su lugar, la lógica vive aquí y los dos controles (el toggle
 * flotante de escritorio y la fila de Operaciones) son dos VISTAS del mismo
 * estado.
 *
 * Dos vistas montadas a la vez (escritorio en /operaciones) se sincronizan
 * por un evento de ventana: quien cicla lo anuncia, todas las instancias lo
 * oyen. Sin el evento, la otra vista se quedaría pintando el modo viejo.
 *
 * Semántica intacta del ThemeToggle original:
 *  - default = OSCURO (marca Ausculta); 'auto' sólo si el usuario lo eligió;
 *  - ciclo: auto → dark → light → auto;
 *  - 'auto' borra la llave (sigue al SO); dark/light la persisten;
 *  - hasta montar no se pinta control alguno (evita flicker SSR).
 */
import { useEffect, useState } from 'react'

export type ModoTema = 'dark' | 'light' | 'auto'

const KEY = 'nexusmed.theme'
/** Lo emite quien cicla; lo escuchan todas las vistas del tema. */
const EVENTO_TEMA = 'nx:tema'

function aplicar(modo: ModoTema) {
  const html = document.documentElement
  if (modo === 'auto') {
    html.removeAttribute('data-theme')
  } else {
    html.setAttribute('data-theme', modo)
  }
}

export function useTema() {
  const [modo, setModo] = useState<ModoTema>('auto')
  const [montado, setMontado] = useState(false)

  useEffect(() => {
    const guardado = (localStorage.getItem(KEY) as ModoTema | null) ?? 'dark'
    setModo(guardado)
    aplicar(guardado)
    setMontado(true)
    const alCambiar = (ev: Event) => {
      const d = (ev as CustomEvent<ModoTema>).detail
      if (d === 'dark' || d === 'light' || d === 'auto') setModo(d)
    }
    window.addEventListener(EVENTO_TEMA, alCambiar)
    return () => window.removeEventListener(EVENTO_TEMA, alCambiar)
  }, [])

  function ciclar() {
    const siguiente: ModoTema = modo === 'auto' ? 'dark' : modo === 'dark' ? 'light' : 'auto'
    setModo(siguiente)
    aplicar(siguiente)
    if (siguiente === 'auto') localStorage.removeItem(KEY)
    else localStorage.setItem(KEY, siguiente)
    window.dispatchEvent(new CustomEvent<ModoTema>(EVENTO_TEMA, { detail: siguiente }))
  }

  const titulo =
    modo === 'auto' ? 'Tema: automático (clic: oscuro)'
    : modo === 'dark' ? 'Tema: oscuro (clic: claro)'
    : 'Tema: claro (clic: automático)'

  return { modo, ciclar, montado, titulo }
}
