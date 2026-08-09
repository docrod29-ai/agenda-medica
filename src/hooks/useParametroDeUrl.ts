'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

/**
 * ESTADO QUE VIVE EN LA URL, PARA QUE VOLVER DEVUELVA LO MISMO.
 *
 * ── QUÉ ROMPÍA ───────────────────────────────────────────────────────────────
 *
 * La agenda guarda fecha, vista, filtro y búsqueda en `useState`, y
 * `(dashboard)/template.tsx` **garantiza** que la página se desmonta en cada
 * navegación. Así que el ciclo real del consultorio —abrir la agenda del jueves
 * el martes, entrar a un paciente, volver, entrar al siguiente— vuelve a poner
 * la fecha **después de cada paciente**. Y quien la pone mal no ve las citas que
 * busca: ve el día de hoy, vacío, y cree que no hay nadie.
 *
 * Es el requisito literal de la directiva V9: «Agenda → Paciente → Consulta →
 * Resultados → Consulta debe devolver **exactamente** el contexto anterior», y
 * la lista de lo que nunca se debe perder incluye `filters`.
 *
 * ── POR QUÉ LA URL Y NO OTRO CONTEXTO EN EL LAYOUT ──────────────────────────
 *
 * Ya existe `BorradorContext`, que sube el borrador de la nota al layout y
 * sobrevive a la navegación sin parpadeo. Habría servido. La URL es mejor aquí
 * por tres razones que el borrador no tiene:
 *
 *  1. **El botón atrás la restaura sola.** El estado del layout sobrevive a la
 *     navegación pero no distingue «volví» de «entré de nuevo»: al retroceder
 *     desde la consulta, la URL de la entrada de historial ya trae el jueves.
 *  2. **Sobrevive a la recarga**, y a que el service worker recargue la pestaña
 *     al desplegar (hallazgo nº 4 de la auditoría de navegación).
 *  3. **Se puede compartir y enlazar.** «Mira la agenda del jueves» pasa a ser
 *     un enlace, que es lo que un usuario espera de una pantalla con fecha.
 *
 * ── `replace`, NUNCA `push` ─────────────────────────────────────────────────
 *
 * Cambiar de día no es navegar: con `push`, retroceder desde la consulta
 * recorrería hacia atrás **cada día que el médico miró** antes de volver a la
 * pantalla anterior de verdad. `replace` reescribe la entrada actual, así que el
 * historial sigue siendo «agenda → consulta» y el atrás sigue significando lo
 * que parece.
 *
 * ── EL REBOTE ES PARA EL BUSCADOR ───────────────────────────────────────────
 *
 * Un `replace` por tecla pulsada es una reescritura de historial por letra. El
 * valor que se pinta es el local —el campo no se traba— y la URL alcanza al
 * texto cuando el médico deja de escribir.
 *
 * ── LO QUE ESTE HOOK NO HACE ────────────────────────────────────────────────
 *
 * No sabe de tipos: todo es cadena. Un filtro que es un objeto no cabe aquí y no
 * debe forzarse — la URL es para lo que el usuario reconocería al leerla.
 * Tampoco guarda scroll: eso es otra cosa y tiene su propio patrón en la
 * consulta.
 */
export interface OpcionesParametro {
  /**
   * Milisegundos de espera antes de escribir en la URL. 0 = inmediato.
   * Sólo para campos que cambian tecla a tecla.
   */
  reboteMs?: number
}

export function useParametroDeUrl(
  clave: string,
  porDefecto: string,
  { reboteMs = 0 }: OpcionesParametro = {},
): [string, (valor: string) => void] {
  const params = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const enLaUrl = params.get(clave) ?? porDefecto

  /**
   * Espejo local para que el campo responda a la tecla aunque la URL vaya con
   * rebote. Se sincroniza cuando la URL cambia por fuera —el botón atrás, un
   * enlace— y no cuando la cambiamos nosotros: eso sería un bucle.
   */
  const [local, setLocal] = useState(enLaUrl)
  const ultimoEscrito = useRef(enLaUrl)
  useEffect(() => {
    if (enLaUrl !== ultimoEscrito.current) {
      ultimoEscrito.current = enLaUrl
      setLocal(enLaUrl)
    }
  }, [enLaUrl])

  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => { if (temporizador.current) clearTimeout(temporizador.current) }, [])

  /**
   * Se lee `window.location.search` y NO el `params` del render, por dos razones:
   *
   *  1. **Corrección.** Entre el render y el clic cabe otra escritura —el rebote
   *     del buscador, por ejemplo—; partir del `params` viejo la borraría.
   *  2. **Estabilidad.** Con `params` en las dependencias, el setter cambia de
   *     identidad en cada render. Un `useEffect` que lo llame y lo declare como
   *     dependencia se convierte en un bucle, y si no lo declara, la regla de
   *     dependencias exhaustivas lo marca. Sin él, el setter es estable como el
   *     de `useState`, que es lo que quien lo usa da por supuesto.
   */
  const escribir = useCallback((valor: string) => {
    const busqueda = typeof window !== 'undefined' ? window.location.search : ''
    ultimoEscrito.current = valor === '' ? porDefecto : valor
    router.replace(urlConParametro(pathname, busqueda, clave, valor, porDefecto), { scroll: false })
  }, [porDefecto, clave, router, pathname])

  const fijar = useCallback((valor: string) => {
    setLocal(valor)
    if (temporizador.current) clearTimeout(temporizador.current)
    if (reboteMs <= 0) { escribir(valor); return }
    temporizador.current = setTimeout(() => escribir(valor), reboteMs)
  }, [escribir, reboteMs])

  return [local, fijar]
}

/**
 * La URL resultante de fijar UN parámetro, conservando los demás.
 *
 * Es una función PURA y exportada a propósito: el hook no se puede renderizar en
 * esta suite —`vitest` corre en entorno `node`, sin DOM— así que lo que decide
 * la corrección vive aquí, donde sí se puede probar. Lo que queda dentro del
 * hook es el cableado, y eso se vigila leyendo la fuente.
 *
 * El valor por DEFECTO no se escribe: una URL llena de parámetros que sólo dicen
 * «lo de siempre» no se puede leer ni compartir, y `?v=todas` sugiere que
 * alguien eligió «todas» cuando nadie eligió nada.
 */
export function urlConParametro(
  pathname: string,
  busqueda: string,
  clave: string,
  valor: string,
  porDefecto: string,
): string {
  const siguientes = new URLSearchParams(busqueda)
  if (valor === porDefecto || valor === '') siguientes.delete(clave)
  else siguientes.set(clave, valor)
  const cadena = siguientes.toString()
  return cadena ? `${pathname}?${cadena}` : pathname
}

/**
 * Quitar UN parámetro sin llevarse los demás por delante.
 *
 * `citas/page.tsx` hacía `router.replace('/citas')` para cerrar el `?id=` de una
 * cita ya abierta, y con eso borraba **toda** la cadena de consulta. En cuanto la
 * agenda guarda su fecha ahí, abrir una cita desde un enlace devolvería al
 * médico al día de hoy. El defecto no existía antes porque no había nada más que
 * borrar; existiría en cuanto lo hubiera.
 */
export function urlSinParametro(pathname: string, params: URLSearchParams, clave: string): string {
  const siguientes = new URLSearchParams(params.toString())
  siguientes.delete(clave)
  const cadena = siguientes.toString()
  return cadena ? `${pathname}?${cadena}` : pathname
}
