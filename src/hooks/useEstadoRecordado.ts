'use client'
import { useCallback, useSyncExternalStore } from 'react'

/**
 * ESTADO QUE SOBREVIVE A IR Y VOLVER — V9 · NAVIGATION-001.
 *
 * ── QUÉ FALLABA ─────────────────────────────────────────────────────────────
 *
 * La agenda vuelve a hoy, a «todas» y sin filtro **cada vez que se vuelve a
 * ella**. Quien trabaja el jueves desde el martes pone la fecha, entra a un
 * paciente, vuelve… y la pone otra vez. Por cada paciente del día.
 *
 * `router.back()` no lo arregla: el App Router **remonta** la pantalla, así que
 * el `useState(hoy)` se vuelve a evaluar. El navegador restaura el scroll, no el
 * estado de React.
 *
 * ── POR QUÉ `sessionStorage` Y NO LA URL ────────────────────────────────────
 *
 * La URL sería lo canónico y es lo que habría que hacer si esto tuviera que
 * compartirse por enlace. Aquí no: la agenda ya usa su único parámetro (`?id=`)
 * para abrir una cita y lo **borra con `router.replace`** en cuanto la abre.
 * Meter cuatro parámetros más en esa misma URL, con ese `replace` de por medio,
 * es la clase de cambio que se ve pequeño y rompe la apertura de citas.
 *
 * `sessionStorage` tiene además la duración correcta: **la pestaña**. Volver a
 * la agenda en la misma jornada devuelve el día que estabas viendo; abrir el
 * producto mañana empieza en hoy, que es lo que uno espera.
 *
 * ── QUÉ NO SE GUARDA AQUÍ, Y POR QUÉ ────────────────────────────────────────
 *
 * **Nada que sea PHI.** El texto del buscador de la agenda es el nombre de un
 * paciente, y `limpiarBorradoresLocales()` sólo purga las claves con los
 * prefijos declarados en `PREFIJOS_PHI`. Guardar un nombre bajo una clave que
 * nadie purga al cerrar sesión lo deja en el disco de un dispositivo compartido.
 *
 * Este ayudante es para fecha, vista y filtro: preferencias de encuadre, no
 * datos del paciente. Quien quiera recordar algo con PHI tiene que declarar su
 * prefijo en `PREFIJOS_PHI` primero — y eso es una decisión de la regla de
 * privacidad, no de una pantalla.
 *
 * ── QUÉ **NO** CUBRE ────────────────────────────────────────────────────────
 *
 * - No sincroniza entre pestañas: cada pestaña recuerda lo suyo, a propósito.
 * - No valida lo leído más allá del tipo primitivo: quien guarde objetos debe
 *   sanearlos al restaurar, como hace la consulta con sus secciones.
 * - No sustituye a la URL cuando el estado deba poder compartirse por enlace.
 */
/**
 * Interpreta lo leído del almacenamiento. Pura, para poder probarla al revés.
 *
 * `sessionStorage` lo puede escribir cualquier cosa: una versión anterior del
 * producto, una extensión, un dedo en la consola. Una agenda que no abre porque
 * su preferencia guardada es basura sería peor que una agenda que empieza en
 * hoy, así que ante cualquier duda **gana el valor inicial**.
 */
export function leerRecordado<T extends string | number | boolean>(
  crudo: string | null,
  inicial: T,
): T {
  if (crudo === null) return inicial
  try {
    const v = JSON.parse(crudo)
    return typeof v === typeof inicial ? (v as T) : inicial
  } catch {
    return inicial
  }
}

/**
 * ── EL VALOR GUARDADO **ES** EL ESTADO ──────────────────────────────────────
 *
 * No hay copia en `useState` ni en un `useRef`, y no es por elegancia:
 *
 * · `sessionStorage` no existe al renderizar en el servidor, así que lo guardado
 *   no puede leerse en el primer render. Corregirlo después con un `setState`
 *   dentro de un efecto provoca un render en cascada —y el analizador de este
 *   repositorio lo marca como error, con razón—.
 * · Guardarlo en un `ref` y leerlo durante el render es el otro atajo, y también
 *   está prohibido: un ref leído en render no dispara el repintado.
 *
 * `useSyncExternalStore` existe exactamente para esto: una fuente EXTERNA a
 * React, con una foto para el cliente y otra para el servidor. Así no hay dos
 * copias del mismo dato que puedan separarse — que es el defecto que este mismo
 * lote de trabajo persigue en el borrador de la consulta (REG-294).
 */
const oyentes = new Set<() => void>()

function avisar() {
  for (const f of oyentes) f()
}

function suscribirse(f: () => void) {
  oyentes.add(f)
  return () => { oyentes.delete(f) }
}

export function useEstadoRecordado<T extends string | number | boolean>(
  clave: string,
  inicial: T,
): [T, (v: T) => void] {
  const guardado = useSyncExternalStore(
    suscribirse,
    () => {
      // Devuelve la cadena cruda: React compara con Object.is y dos lecturas
      // iguales dan la misma cadena, así que no hay repintado de más.
      try { return sessionStorage.getItem(clave) } catch { return null }
    },
    () => null,   // servidor: no hay almacenamiento, se rinde el valor inicial
  )

  const asignar = useCallback((v: T) => {
    try { sessionStorage.setItem(clave, JSON.stringify(v)) } catch { /* lleno o bloqueado */ }
    avisar()
  }, [clave])

  return [leerRecordado(guardado, inicial), asignar]
}
