'use client'
/**
 * EL MARCO DE ESCUCHA — grabar es un MODO, no un indicador.
 *
 * ── QUÉ FALLABA ─────────────────────────────────────────────────────────────
 *
 * `MientrasHablas` ya enseña lo que hace falta para trabajar: el nivel de voz
 * moviéndose, el tiempo, las últimas palabras, la sección recién escrita. Es
 * buena barra y no se toca.
 *
 * Lo que no había era **estado**. Con el micrófono abierto la aplicación se ve
 * exactamente igual que con el micrófono cerrado, salvo un borde de 1 px en esa
 * barra. Y la barra vive pegada abajo de la columna de la nota: en cuanto el
 * médico se desplaza a los antecedentes, abre el antibiograma en la otra mitad
 * o mira los laboratorios, deja de tenerla delante.
 *
 * Un micrófono abierto que no se nota es el peor de los dos errores posibles:
 * se graban veinte minutos que nadie pidió, o se cree que graba y no graba.
 *
 * ── LO QUE HACEN LOS QUE SABEN ──────────────────────────────────────────────
 *
 * Medido el 9-ago-2026 sobre capturas reales de producto: **Abridge tiñe la
 * pantalla entera** mientras escucha. **Heidi la vacía** hasta dejar un botón
 * con anillos que laten. Los dos convierten grabar en un modo del que no se
 * puede dudar.
 *
 * ── POR QUÉ UN MARCO Y NO TEÑIR LA PANTALLA ─────────────────────────────────
 *
 * Teñir el fondo cambia el contraste de TODO lo que hay encima — y encima hay
 * una nota clínica, cifras de laboratorio y avisos de alergia que este
 * repositorio lleva meses ajustando a AA. Un marco perimetral se ve desde el
 * otro lado del consultorio y **no toca ni un píxel de lo que se lee**.
 *
 * Hay un segundo motivo, y no es estético: el paciente está enfrente y ve la
 * pantalla. Que se note que el micrófono está abierto es parte de pedirle
 * permiso de verdad, no una vez al principio.
 *
 * ── POR QUÉ NO ES ROJO ──────────────────────────────────────────────────────
 *
 * Rojo es el color de grabar en casi todo el mundo, y aquí **no puede serlo**:
 * en esta aplicación `--peligro` es rojo y significa una alergia, un valor
 * crítico, una dosis fuera de rango. Un marco rojo permanente durante veinte
 * minutos enseña a ignorar el rojo, que es exactamente lo que no puede pasar.
 *
 * Va en el acento —cian-petróleo— por la misma razón por la que el acento es
 * cian-petróleo: es el único territorio libre de significado clínico.
 *
 * ── POR QUÉ SE MONTA UNA SOLA VEZ ───────────────────────────────────────────
 *
 * En el `layout` del panel, escuchando el evento. Así **cualquier** superficie
 * que grabe queda cubierta el día que exista —la consulta, el pase de UCI, la
 * nota de hospital— sin que nadie tenga que acordarse de montar nada. Es el
 * mismo argumento que ya justifica el evento en `estoy-grabando.ts`, y la
 * familia de defectos que evita se llama `depende_de_recordar`.
 */
import { useEffect, useState } from 'react'
import { EVENTO_GRABANDO, type DetalleDeEscucha } from '@/lib/seguridad/estoy-grabando'

export function MarcoEscuchando() {
  const [escuchando, setEscuchando] = useState(false)

  useEffect(() => {
    const alSonar = (ev: Event) => {
      const d = (ev as CustomEvent<DetalleDeEscucha>).detail
      /**
       * El latido de inactividad viaja por este mismo evento y llega SIN
       * `detail`. Ignorarlo es deliberado: si se tomara como «encendido», el
       * marco se pintaría por un latido y ya no sabría apagarse.
       */
      if (d && typeof d.activo === 'boolean') setEscuchando(d.activo)
    }
    window.addEventListener(EVENTO_GRABANDO, alSonar)
    return () => window.removeEventListener(EVENTO_GRABANDO, alSonar)
  }, [])

  if (!escuchando) return null

  return (
    /*
      Todo el aspecto vive en `globals.css`, en `.nx-marco-escuchando`. Aquí no
      hay ni un valor: una sombra escrita en línea es deuda que el trinquete de
      diseño cuenta —y con razón—, y además sería redundante con la animación
      que ya la pinta.
    */
    <div aria-hidden className="nx-marco-escuchando" />
  )
}
