/**
 * DÓNDE CAE UNA CITA QUE SE ARRASTRA.
 *
 * ── QUÉ PROBLEMA RESUELVE ────────────────────────────────────────────────────
 *
 * Mover una cita eran cuatro clics: abrir el modal, cambiar la hora, confirmar,
 * cerrar. En la agenda del día eso es lo que más se hace y lo que más cuesta —
 * el paciente llamó, hay que correrle la cita media hora, y el médico está con
 * otro paciente enfrente.
 *
 * Arrastrar es el gesto natural, pero soltar «donde cayó el dedo» produce horas
 * absurdas: 16:07, 16:23. Y redondear a la media hora traiciona justo lo que
 * REG-653/654/655 arreglaron — que una consulta pueda empezar cuando termina la
 * anterior, caiga donde caiga.
 *
 * ── LA REGLA ─────────────────────────────────────────────────────────────────
 *
 * Al soltar, la hora se decide en dos pasos:
 *
 *  1. **Se redondea al paso menudo** (5 min por defecto). Suficiente para que la
 *     mano no tenga que ser precisa, y bastante fino para no mentir sobre dónde
 *     se soltó.
 *  2. **Y luego IMANTA a las aristas**: si a menos de `iman` minutos hay un
 *     instante donde termina otra cita —o donde una consulta de esta duración
 *     acabaría clavada contra la siguiente—, gana ese instante.
 *
 * El imán es lo que hace que arrastrar SIRVA para lo que este producto dice: se
 * suelta «más o menos después de la anterior» y queda pegada exacto, sin un
 * minuto muerto. Sin él, arrastrar produciría agendas con huecos de tres minutos
 * que nadie quiso.
 *
 * ── LO QUE ESTE MÓDULO NO DECIDE ─────────────────────────────────────────────
 *
 * Si la cita PUEDE ir ahí. Eso lo dice `hasConflict` con el horario, los
 * descansos, los bloqueos y las citas vivas, y lo vuelve a decir el servidor en
 * transacción. Aquí sólo se traduce un gesto a un minuto: es aritmética, no
 * autorización.
 *
 * Tampoco recorta contra la jornada. El llamador sabe su horario; este módulo no
 * lo recibe a propósito, para que no haya dos sitios decidiendo dónde acaba el
 * día.
 *
 * Módulo PURO.
 */
import type { Pared } from '@/lib/availability'

/** Redondeo del gesto. Cinco minutos: la mano no es precisa, la agenda sí. */
export const PASO_AL_SOLTAR = 5

/**
 * A cuántos minutos imanta una arista.
 *
 * Diez. Con menos, el imán no se siente y se acaban creando huecos de tres
 * minutos; con mucho más, robaría posiciones que el usuario eligió a propósito
 * —soltar a las 16:20 cuando la anterior acaba a las 16:05 es una decisión, no
 * un error de puntería.
 */
export const IMAN_MINUTOS = 10

/**
 * El minuto del día donde cayó el puntero, dentro de una rejilla por horas.
 *
 * `alto` es la altura de la franja de una hora en píxeles y `y` la distancia
 * desde su borde superior. Se separa de `minutoAlSoltar` porque es la única
 * parte que sabe de píxeles: así la decisión de negocio se puede probar sin
 * inventarse un navegador.
 *
 * Un `alto` no positivo devuelve el inicio de la franja en vez de dividir por
 * cero: una rejilla sin altura todavía no se ha pintado, y no es momento de
 * fabricar una hora.
 */
export function minutoDelPuntero(horaDeLaFranja: number, y: number, alto: number): number {
  if (!Number.isFinite(alto) || alto <= 0) return horaDeLaFranja * 60
  const dentro = Math.min(Math.max(y, 0), alto)
  return Math.round(horaDeLaFranja * 60 + (dentro / alto) * 60)
}

/**
 * Las aristas a las que merece la pena imantar, para una consulta de `duracion`.
 *
 * Son las mismas dos familias que `iniciosPosibles`: donde algo TERMINA (ahí
 * empieza el hueco) y `pared.desde - duracion` (ahí la consulta acaba clavada
 * contra lo siguiente). Se comparte el concepto a propósito: si el motor y el
 * arrastre imantaran a sitios distintos, arrastrar produciría horas que la lista
 * no ofrece.
 */
export function aristasImantables(duracion: number, paredes: readonly Pared[]): number[] {
  const set = new Set<number>()
  for (const p of paredes) {
    if (!Number.isFinite(p?.desde) || !Number.isFinite(p?.hasta)) continue
    set.add(p.hasta)
    set.add(p.desde - duracion)
  }
  return [...set].filter(m => m >= 0).sort((a, b) => a - b)
}

/**
 * El minuto en que empieza la cita soltada.
 *
 * @param minutoCrudo  donde cayó el puntero, ya en minutos del día
 * @param duracion     la de la cita que se arrastra (no cambia al mover)
 * @param paredes      citas vivas y descansos del día, en minutos
 */
export function minutoAlSoltar(
  minutoCrudo: number,
  duracion: number,
  paredes: readonly Pared[] = [],
  opciones?: { paso?: number; iman?: number },
): number {
  if (!Number.isFinite(minutoCrudo)) return 0
  const paso = Number.isFinite(opciones?.paso) && (opciones!.paso as number) >= 1
    ? Math.floor(opciones!.paso as number)
    : PASO_AL_SOLTAR
  const iman = Number.isFinite(opciones?.iman) && (opciones!.iman as number) >= 0
    ? (opciones!.iman as number)
    : IMAN_MINUTOS

  const redondeado = Math.max(0, Math.round(minutoCrudo / paso) * paso)

  /*
   * EL IMÁN SE MIDE CONTRA EL MINUTO CRUDO, NO CONTRA EL REDONDEADO.
   *
   * Si se midiera contra el redondeado, el paso ya habría movido el puntero
   * hasta 2-3 minutos y una arista que estaba justo en el límite del imán
   * entraría o saldría según hacia dónde hubiera redondeado. La distancia que
   * importa es la que el usuario ve: la de su dedo a la arista.
   */
  let mejor = redondeado
  let distancia = iman + 1
  for (const arista of aristasImantables(duracion, paredes)) {
    if (arista < 0) continue
    const d = Math.abs(arista - minutoCrudo)
    // `<` y no `<=`: ante dos aristas igual de cerca gana la PRIMERA en orden
    // cronológico, que es determinista. Un empate resuelto al azar haría que la
    // misma acción diera resultados distintos.
    if (d <= iman && d < distancia) {
      distancia = d
      mejor = arista
    }
  }
  return mejor
}

/** `minutos desde medianoche` → `'HH:MM'`. Sin fabricar horas fuera del día. */
export function comoHora(minutos: number): string {
  const m = Math.max(0, Math.min(Math.round(minutos), 24 * 60 - 1))
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}
