/**
 * GOLDEN — el fallo del dictado se ANUNCIA, no sólo se pinta.
 *
 * ── CÓMO SE DESCUBRIÓ ───────────────────────────────────────────────────────
 *
 * Midiendo por primera vez `/consulta` **grabando** (unidad 54), con micrófono
 * falso. Sin proveedor de ASR, `transcribir-diarizado` contesta 503, y ahí se
 * ve qué hace la pantalla cuando la transcripción de una consulta no se puede
 * hacer.
 *
 * ── LO QUE CREÍ VER, Y ERA FALSO ────────────────────────────────────────────
 *
 * Mi primera sonda vigilaba `[role="alert"]`, `[role="status"]` y clases de
 * *toast* durante doce segundos y no encontró nada. Estuve a punto de escribir
 * que **al médico no se le dice nada**. Era mentira: leyendo el texto de la
 * pantalla aparecían
 *
 *     «No se pudo transcribir (OPENAI_API_KEY no configurada…)»
 *
 * y un botón **«Recuperar audio»**. El producto sí lo dice. Lo que no tenía era
 * ninguno de los roles que yo buscaba — y ahí estaba el hallazgo de verdad.
 *
 * ── EL DEFECTO ──────────────────────────────────────────────────────────────
 *
 * El aviso se pinta en un `<div>` normal. Aparece **de forma asíncrona, después
 * de detener la grabación**, en la única pantalla del producto diseñada para que
 * el médico **esté mirando al paciente y no la pantalla**. Sin región viva, un
 * lector de pantalla no lo anuncia: se acaba de perder la transcripción de una
 * consulta entera y quien no mira no se entera.
 *
 * WCAG 2.2 AA §4.1.3 (mensajes de estado), y la regla 3 de seguridad clínica
 * dicha en voz alta: nada cambia en silencio.
 *
 * ── POR QUÉ DOS ROLES DISTINTOS ─────────────────────────────────────────────
 *
 * · `alert` (asertivo) para el error: se perdió la transcripción y hay una
 *   acción —recuperar o descargar el audio— que caduca con la sesión.
 * · `status` (educado) para «sin separación de voces»: la transcripción SÍ se
 *   hizo, con el motor alterno. Es una advertencia sobre qué revisar, no una
 *   pérdida, y no debe interrumpir.
 *
 * Poner `alert` a los dos sería enseñar a ignorarlos.
 *
 * ── PROBADO AL REVÉS ────────────────────────────────────────────────────────
 *
 * Quitando cualquiera de los dos roles, cae el caso correspondiente.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · Escáner de fuente. Que un lector de pantalla REAL lo diga no lo prueba
 *   nadie aquí: en este carril no se ha usado ninguno, y se dice.
 * · No cubre `uci/page.tsx`, que tiene el mismo aviso: es ALPHA y de otro
 *   carril. Queda anotado, no arreglado.
 * · No juzga el texto de los avisos, sólo que se anuncien.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const PAGINA = readFileSync('src/app/(dashboard)/consulta/[patientId]/page.tsx', 'utf8')
const UCI = readFileSync('src/app/(dashboard)/uci/page.tsx', 'utf8')

/**
 * TODOS los avisos asíncronos del dictado, con el rol que les toca y por qué.
 *
 * La primera versión de esta prueba (unidad 55) cubría dos de los tres de la
 * consulta y **ninguno de UCI**. Dejé sin anunciar justo el que llega MIENTRAS
 * se graba —«faltan N tramos en el texto en vivo»—, que es el momento en que el
 * médico menos mira la pantalla. Es la familia que este carril lleva toda la
 * vuelta encontrando en otros, cometida por mí una unidad antes.
 *
 * `alert` sólo para el que informa de una PÉRDIDA con acciones que caducan.
 * Los demás son advertencias sobre qué revisar: `status`. Ponerles a todos
 * `alert` sería enseñar a ignorarlos.
 */
const AVISOS: { archivo: 'consulta' | 'uci'; marca: string; rol: 'alert' | 'status'; porque: string }[] = [
  { archivo: 'consulta', marca: '{audio.error && (', rol: 'alert',
    porque: 'se perdió la transcripción y hay acciones que caducan con la sesión' },
  { archivo: 'consulta', marca: "{audio.sinDiarizacion && audio.estado === 'listo' && (", rol: 'status',
    porque: 'hubo nota, con el motor alterno' },
  { archivo: 'consulta', marca: '{audio.chunksFallidos > 0 && (', rol: 'status',
    porque: 'el texto en vivo va incompleto; la transcripción final no' },
  { archivo: 'uci', marca: "{audio.sinDiarizacion && audio.estado === 'listo' && (", rol: 'status',
    porque: 'mismo caso que la consulta' },
  { archivo: 'uci', marca: '{audio.chunksFallidos > 0 && (', rol: 'status',
    porque: 'mismo caso que la consulta' },
]

/** El bloque que sigue a una condición, para no confundir avisos vecinos. */
function bloqueTras(marca: string, largo = 400, fuente = PAGINA): string {
  const i = fuente.indexOf(marca)
  expect(i, `no se encontró en la pantalla: ${marca}`).toBeGreaterThan(-1)
  return fuente.slice(i, i + largo)
}

describe('la pantalla sigue teniendo los dos avisos del dictado', () => {
  it('el error del grabador y el aviso de «sin separación de voces»', () => {
    expect(PAGINA).toContain('{audio.error && (')
    expect(PAGINA).toContain("{audio.sinDiarizacion && audio.estado === 'listo' && (")
    // Y el error sigue ofreciendo salvar el audio: es la acción que caduca.
    expect(PAGINA).toContain('Descargar audio')
  })
})

describe('los avisos del dictado se anuncian', () => {
  it('el fallo de transcripción es ASERTIVO: se perdió una consulta', () => {
    const b = bloqueTras('{audio.error && (')
    expect(b, 'el aviso de fallo dejó de anunciarse').toMatch(/role="alert"/)
  })

  it('«sin separación de voces» es EDUCADO: hubo nota, con el motor alterno', () => {
    const b = bloqueTras("{audio.sinDiarizacion && audio.estado === 'listo' && (")
    expect(b, 'el aviso de diarización dejó de anunciarse').toMatch(/role="status"/)
  })

  it('los CINCO avisos del dictado se anuncian, en las dos pantallas', () => {
    for (const a of AVISOS) {
      const fuente = a.archivo === 'consulta' ? PAGINA : UCI
      const b = bloqueTras(a.marca, 500, fuente)
      expect(b, `${a.archivo}: ${a.marca} dejó de anunciarse (${a.porque})`)
        .toMatch(new RegExp(`role="${a.rol}"`))
    }
  })

  it('sólo la PÉRDIDA es asertiva; las advertencias son educadas', () => {
    // Si todo fuera `alert`, el médico aprendería a ignorarlos y el único que
    // importaba de verdad se perdería entre los demás.
    const asertivos = AVISOS.filter(a => a.rol === 'alert')
    expect(asertivos).toHaveLength(1)
    expect(asertivos[0].marca).toBe('{audio.error && (')
  })

  it('y no son el mismo rol: enseñar a ignorar un aviso es peor que no tenerlo', () => {
    const err = bloqueTras('{audio.error && (')
    const diar = bloqueTras("{audio.sinDiarizacion && audio.estado === 'listo' && (")
    expect(err).not.toMatch(/role="status"/)
    expect(diar).not.toMatch(/role="alert"/)
  })
})
