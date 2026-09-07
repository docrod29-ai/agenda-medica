/**
 * GOLDEN — el médico siempre puede teclear la hora, y nadie le borra la que puso.
 *
 * ── QUÉ FALLABA ─────────────────────────────────────────────────────────────
 *
 * Dos defectos del mismo modal, los dos contados por el dueño el 7-sep-2026.
 *
 * 1. EL CAMPO LIBRE VIVÍA EN EL `else`. El desplegable de horas se sustituía por
 *    un `<input type="time">` sólo cuando `slots.length === 0`, es decir, con el
 *    día COMPLETO — justo cuando ya no sirve de nada. Con un solo hueco en la
 *    lista, una hora libre de verdad que la lista no trajera (el cuarto de hora
 *    que deja una cita de 45 min, por ejemplo) era inalcanzable desde la
 *    pantalla. La salida real del consultorio era mover otra cita.
 *
 * 2. LA HORA SE BORRABA SOLA. Al subir la duración después de elegir la hora,
 *    `setHora('')` limpiaba el campo sin decir nada. El defecto que eso
 *    arreglaba era real —se guardaba una cita que terminaba después del cierre—
 *    pero el remedio era una edición en silencio sobre lo que el médico acababa
 *    de teclear: parecía que la pantalla se reseteaba sola.
 *
 * Y el aviso mentía: `hasConflict` devuelve `true` tanto por empalme como por
 * salirse del horario, y el texto decía siempre «ese horario ya está ocupado».
 * Con una cita de 45 min a las 13:30 en una jornada que cierra a las 14:00, ese
 * mensaje es falso — y encima empujaba al médico a la salida de sobreagenda,
 * que el servidor NO acepta para este caso (`route.ts` responde 409 sin
 * excepción; la excepción existe sólo para el empalme).
 *
 * ── LA REGLA QUE LO HACE SEGURO ─────────────────────────────────────────────
 *
 * Se abre la puerta, no la reja: la hora tecleada pasa por los MISMOS chequeos
 * que la elegida (`hasConflict` en la pantalla, 409 en el servidor). Y nada se
 * corrige en silencio — regla 3 de seguridad clínica dicha en interfaz.
 *
 * ── PROBADO AL REVÉS ────────────────────────────────────────────────────────
 *
 * Devolviendo el `slots.length > 0 ? select : input` de antes cae el primer
 * caso; devolviendo el `setHora('')` cae el segundo; borrando `noCabe` del
 * render caen el tercero y el cuarto.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · **No prueba que se PINTE.** Esto lee la fuente, no monta el DOM: el repo no
 *   tiene testing-library. Que el botón se vea, tenga foco visible y contraste
 *   suficiente es del arnés con navegador, y aquí queda NOT_PROVEN.
 * · No cubre el portal público ni el bot de WhatsApp: ahí no hay campo manual y
 *   no debe haberlo — el paciente elige de lo ofrecido.
 * · No dice nada sobre si la hora tecleada es *buena idea* clínicamente. Sólo
 *   que se puede pedir y que, si no cabe, se dice por qué.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/** Sin comentarios: un caso que se satisface con su propia prosa no prueba nada. */
const sinComentarios = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\/.*/g, '')

const MODAL = join('src', 'components', 'AppointmentModal.tsx')
const src = () => sinComentarios(readFileSync(MODAL, 'utf8'))

describe('la hora a mano siempre está', () => {
  it('el campo libre NO depende de que la lista esté vacía', () => {
    const s = src()
    // El interruptor existe y es del médico, no una consecuencia de `slots`.
    expect(s, 'desapareció el interruptor de hora manual').toMatch(/setHoraManual/)
    // La condición del desplegable lo mira: con `slots.length > 0 ? … : …` a
    // secas, teclear una hora libre volvía a ser imposible con el día a medias.
    expect(s, 'el desplegable volvió a ignorar la elección del médico')
      .toMatch(/slots\.length\s*>\s*0\s*&&\s*!horaManual\s*\?/)
  })

  it('el interruptor es un <button> de verdad, no un div que escucha clics', () => {
    // Regla de accesibilidad: un control interactivo que no es `<button>` falla
    // la compuerta. Y `type="button"` para no enviar el formulario sin querer.
    const s = src()
    const boton = s.match(/<button[^>]*onClick=\{\(\)\s*=>\s*setHoraManual[^>]*>/s)
      ?? s.match(/<button[\s\S]{0,400}?setHoraManual\(v\s*=>\s*!v\)[\s\S]{0,400}?>/)
    expect(boton, 'el interruptor de hora manual dejó de ser un <button>').not.toBeNull()
    expect(s, 'el interruptor perdió type="button": envía el formulario').toMatch(/type="button"/)
  })

  it('nadie borra la hora que el médico eligió', () => {
    const s = src()
    /*
     * `setHora('')` sigue siendo legítimo al ABRIR el modal (reset de una cita
     * nueva) y al cambiar de médico. Lo que no puede volver es el borrado dentro
     * del efecto que vigila la duración: ése era el que reseteaba en silencio.
     */
    const efecto = s.match(/setConflict\(hasConflict\([\s\S]*?\n\s*\}, \[fecha, hora, duracion/)
    expect(efecto, 'desapareció el efecto que vigila el conflicto').not.toBeNull()
    expect(efecto![0], 'volvió el borrado silencioso de la hora al cambiar la duración')
      .not.toMatch(/setHora\(''\)/)
  })

  it('el aviso distingue «no cabe» de «está ocupado»', () => {
    const s = src()
    expect(s, 'la pantalla dejó de preguntar POR QUÉ no cabe').toMatch(/porQueNoCabeEnElHorario/)
    // El aviso viejo no puede salir cuando la causa real es el horario: decirle
    // «ya está ocupado» a quien se pasó del cierre lo manda a la salida que el
    // servidor rechaza con 409.
    expect(s, 'el aviso de «ya está ocupado» volvió a taparlo todo')
      .toMatch(/conflict\s*&&\s*!noCabe/)
  })

  it('el guardado se corta ANTES del 409, con el motivo de verdad', () => {
    const s = src()
    const save = s.match(/const handleSave = async \(\) => \{[\s\S]*?setSaving\(true\)/)
    expect(save, 'desapareció handleSave').not.toBeNull()
    expect(save![0], 'handleSave dejó de mirar si la hora cabe en el horario')
      .toMatch(/if\s*\(noCabe\)/)
  })
})

describe('el helper que sostiene el aviso', () => {
  it('sigue exportado y distingue las tres causas', () => {
    const lib = sinComentarios(readFileSync(join('src', 'lib', 'availability.ts'), 'utf8'))
    expect(lib).toMatch(/export function porQueNoCabeEnElHorario/)
    for (const razon of ['dia-cerrado', 'horario-invalido', 'fuera-del-horario']) {
      expect(lib, `el helper dejó de distinguir «${razon}»`).toContain(razon)
    }
  })
})
