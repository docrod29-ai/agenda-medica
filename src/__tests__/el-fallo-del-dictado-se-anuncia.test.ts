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

/** El bloque que sigue a una condición, para no confundir avisos vecinos. */
function bloqueTras(marca: string, largo = 400): string {
  const i = PAGINA.indexOf(marca)
  expect(i, `no se encontró en la pantalla: ${marca}`).toBeGreaterThan(-1)
  return PAGINA.slice(i, i + largo)
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

  it('y no son el mismo rol: enseñar a ignorar un aviso es peor que no tenerlo', () => {
    const err = bloqueTras('{audio.error && (')
    const diar = bloqueTras("{audio.sinDiarizacion && audio.estado === 'listo' && (")
    expect(err).not.toMatch(/role="status"/)
    expect(diar).not.toMatch(/role="alert"/)
  })
})
