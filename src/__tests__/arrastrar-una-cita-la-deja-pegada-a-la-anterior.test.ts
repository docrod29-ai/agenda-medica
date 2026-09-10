/**
 * GOLDEN — ARRASTRAR UNA CITA LA DEJA PEGADA A LA ANTERIOR.
 *
 * ── QUÉ FALLABA ─────────────────────────────────────────────────────────────
 *
 * Mover una cita eran cuatro clics: abrir el modal, cambiar la hora, confirmar,
 * cerrar. En la agenda del día es lo que más se hace —el paciente llama, hay que
 * correrle la cita media hora— y se hace con otro paciente enfrente.
 *
 * ── POR QUÉ NO BASTA CON «SOLTAR DONDE CAYÓ EL DEDO» ────────────────────────
 *
 * Un puntero suelto produce horas absurdas: 16:07, 16:23. Y la salida fácil
 * —redondear a la media hora— traiciona exactamente lo que REG-653, REG-654 y
 * REG-655 arreglaron: que una consulta pueda empezar cuando termina la anterior,
 * caiga donde caiga. Arrastrar con rejilla gruesa volvería a fabricar los huecos
 * artificiales que costó tres reparaciones quitar.
 *
 * ── LA REGLA QUE LO HACE SEGURO ─────────────────────────────────────────────
 *
 * Dos pasos. Primero se redondea al paso menudo (5 min): la mano no es precisa.
 * Después se IMANTA a las aristas —donde termina otra cita, o donde ésta
 * acabaría clavada contra la siguiente— si están a menos de 10 minutos.
 *
 * Las aristas son LAS MISMAS que las de `iniciosPosibles`. Si el motor ofreciera
 * unas horas y el arrastre imantara a otras, arrastrar produciría citas en horas
 * que la lista no ofrece — dos verdades sobre el mismo día.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · Si la cita PUEDE ir ahí. Eso es `hasConflict` (horario, descansos, bloqueos,
 *   empalmes) y el re-chequeo en transacción del servidor. Este módulo traduce
 *   un gesto a un minuto: es aritmética, no autorización.
 * · El recorte contra la jornada: el llamador conoce su horario y este módulo no
 *   lo recibe a propósito, para no tener dos sitios decidiendo dónde acaba el día.
 * · El gesto en sí (puntero, fantasma, soltar) — eso vive en la pantalla y se
 *   comprueba en el arnés visual, no aquí.
 */
import { describe, it, expect } from 'vitest'
import {
  minutoAlSoltar, minutoDelPuntero, aristasImantables, comoHora,
  PASO_AL_SOLTAR, IMAN_MINUTOS,
} from '@/lib/agenda/soltar-cita'
import { iniciosPosibles } from '@/lib/availability'

/** La tarde del acta: primera consulta 15:00-15:45, seguimiento 16:00-16:30. */
const TARDE = [
  { desde: 15 * 60, hasta: 15 * 60 + 45 },
  { desde: 16 * 60, hasta: 16 * 60 + 30 },
]

describe('El imán deja la cita pegada, no «casi» pegada', () => {
  it('soltar a las 15:47 con la anterior terminando a las 15:45 → 15:45', () => {
    // Sin imán, el paso de 5 daría 15:45 por suerte. Con 15:48 daría 15:50 y
    // dejaría un hueco de cinco minutos que nadie quiso.
    expect(comoHora(minutoAlSoltar(15 * 60 + 47, 15, TARDE))).toBe('15:45')
    expect(comoHora(minutoAlSoltar(15 * 60 + 48, 15, TARDE))).toBe('15:45')
    expect(comoHora(minutoAlSoltar(15 * 60 + 52, 15, TARDE))).toBe('15:45')
  })

  it('también imanta hacia ATRÁS: una de 15 min que acabe clavada en las 16:00', () => {
    // La arista es 16:00 − 15 = 15:45. Soltar a las 15:43 la deja terminando
    // exacto cuando empieza la siguiente.
    expect(comoHora(minutoAlSoltar(15 * 60 + 43, 15, TARDE))).toBe('15:45')
  })

  it('AL REVÉS — lejos de una arista NO imanta: 16:20 es una decisión, no puntería', () => {
    // La anterior acaba a las 16:30; 16:20 está a 10 min de 16:30 pero el
    // redondeo manda cuando la arista queda fuera del imán por el otro lado.
    expect(comoHora(minutoAlSoltar(17 * 60 + 3, 30, TARDE))).toBe('17:05')
    expect(comoHora(minutoAlSoltar(18 * 60 + 12, 30, TARDE))).toBe('18:10')
  })

  it('sin paredes no hay imán: sólo el paso de cinco minutos', () => {
    expect(comoHora(minutoAlSoltar(16 * 60 + 7, 30, []))).toBe('16:05')
    expect(comoHora(minutoAlSoltar(16 * 60 + 8, 30, []))).toBe('16:10')
  })
})

describe('Las aristas del arrastre son las MISMAS que las del motor', () => {
  it('cada arista imantable es una hora que el motor sabe ofrecer', () => {
    // Si divergieran, arrastrar crearía citas en horas que la lista no ofrece.
    const duracion = 15
    const posibles = new Set(iniciosPosibles(15 * 60, 19 * 60, duracion, duracion, TARDE))
    for (const arista of aristasImantables(duracion, TARDE)) {
      if (arista < 15 * 60 || arista + duracion > 19 * 60) continue
      expect(posibles.has(arista), `la arista ${comoHora(arista)} no está en iniciosPosibles`).toBe(true)
    }
  })

  it('e incluye las dos familias: donde algo termina y donde algo empieza menos la duración', () => {
    const a = aristasImantables(15, TARDE)
    expect(a).toContain(15 * 60 + 45)        // termina la primera consulta
    expect(a).toContain(16 * 60 + 30)        // termina el seguimiento
    expect(a).toContain(16 * 60 - 15)        // acaba clavada contra las 16:00
  })
})

describe('El puntero se traduce a minutos sin inventar horas', () => {
  it('la mitad de la franja de las 16:00 son las 16:30', () => {
    expect(comoHora(minutoDelPuntero(16, 24, 48))).toBe('16:30')
    expect(comoHora(minutoDelPuntero(16, 0, 48))).toBe('16:00')
  })

  it('fuera de la franja se recorta a sus bordes, no se extrapola', () => {
    expect(comoHora(minutoDelPuntero(16, -50, 48))).toBe('16:00')
    expect(comoHora(minutoDelPuntero(16, 999, 48))).toBe('17:00')
  })

  it('una rejilla sin altura devuelve el inicio de la franja en vez de dividir por cero', () => {
    // Todavía no se ha pintado: no es momento de fabricar una hora.
    expect(comoHora(minutoDelPuntero(16, 30, 0))).toBe('16:00')
    expect(comoHora(minutoDelPuntero(16, 30, NaN))).toBe('16:00')
  })
})

describe('Lo que no se puede leer no se convierte en una hora cualquiera', () => {
  it('un minuto no numérico cae a 0, no a NaN', () => {
    expect(minutoAlSoltar(NaN, 30, TARDE)).toBe(0)
  })

  it('una pared corrupta se ignora en vez de romper el arrastre', () => {
    const conBasura = [...TARDE, { desde: NaN, hasta: NaN }]
    expect(comoHora(minutoAlSoltar(15 * 60 + 47, 15, conBasura))).toBe('15:45')
  })

  it('`comoHora` nunca se sale del día', () => {
    expect(comoHora(-30)).toBe('00:00')
    expect(comoHora(99_999)).toBe('23:59')
  })

  it('un paso corrupto cae al de fábrica en vez de colgar o degenerar', () => {
    expect(comoHora(minutoAlSoltar(16 * 60 + 7, 30, [], { paso: 0 }))).toBe('16:05')
    expect(comoHora(minutoAlSoltar(16 * 60 + 7, 30, [], { paso: NaN }))).toBe('16:05')
  })
})

describe('Las constantes están declaradas, no escondidas en el código', () => {
  it('el paso es de cinco minutos y el imán de diez', () => {
    // Si alguien las cambia, que sea a la vista y con este caso delante: con un
    // imán mucho mayor se robarían posiciones elegidas a propósito.
    expect(PASO_AL_SOLTAR).toBe(5)
    expect(IMAN_MINUTOS).toBe(10)
  })

  it('un imán de cero desactiva el magnetismo y deja sólo el paso', () => {
    expect(comoHora(minutoAlSoltar(15 * 60 + 47, 15, TARDE, { iman: 0 }))).toBe('15:45')
    expect(comoHora(minutoAlSoltar(15 * 60 + 48, 15, TARDE, { iman: 0 }))).toBe('15:50')
  })
})
