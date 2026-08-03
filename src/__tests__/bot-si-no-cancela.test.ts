/**
 * GOLDEN — el «SÍ» del recordatorio CONFIRMA; nunca cancela.
 *
 * ── EL FALLO, ENCONTRADO POR LA AUDITORÍA DE LANZAMIENTO ─────────────────────
 *
 * Dos preguntas distintas compartían el estado `confirmando_cita` y se
 * distinguían por una bandera dentro de `datos`:
 *
 *   «¿confirmas tu cita?»  → SÍ = confirmar
 *   «¿la cancelo?»         → SÍ = cancelar   (con `cancelarSolo: '1'`)
 *
 * Y la cadena que lo rompía:
 *
 *  1. el paciente pide cancelar y abandona sin contestar;
 *  2. la bandera se queda pegada en su sesión, que **no caduca sola** —sólo se
 *     toca cuando el paciente vuelve a escribir—;
 *  3. llega el recordatorio de 24 h y el cron reescribe la sesión con
 *     `merge: true`, que en Firestore **funde los mapas anidados**: la bandera
 *     sobrevive;
 *  4. el paciente responde «SÍ» a «¿confirmas tu cita?» y **se le cancela**, se
 *     avisa al consultorio y su hueco se ofrece a la lista de espera.
 *
 * Confirmar y perder la cita, sin enterarse hasta el día de la consulta.
 *
 * El comentario que ya vivía en ese código advertía de este mismo peligro **en
 * el sentido contrario** (quien pide cancelar y acaba con la cita confirmada).
 * Le faltaba la otra mitad.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const leer = (...p: string[]) => readFileSync(join(process.cwd(), ...p), 'utf8')
const webhook = leer('src', 'app', 'api', 'whatsapp', 'webhook', 'route.ts')
const cron = leer('src', 'app', 'api', 'cron', 'reminders', 'route.ts')

describe('cada pregunta tiene su propio estado', () => {
  it('preguntar «¿la cancelo?» deja la sesión en confirmando_cancelacion', () => {
    // Las dos vías de cancelación: la cita única y la elegida de una lista.
    const veces = (webhook.match(/estado: 'confirmando_cancelacion'/g) ?? []).length
    expect(veces, 'las dos preguntas de cancelación deben usar el estado propio').toBe(2)
  })

  it('el recordatorio sigue usando confirmando_cita', () => {
    expect(cron).toContain("estado: 'confirmando_cita'")
    expect(cron).not.toContain("estado: 'confirmando_cancelacion'")
  })

  it('el sentido del SÍ se decide por el ESTADO, no por una bandera suelta', () => {
    expect(webhook).toContain("const preguntaEraCancelar = estado === 'confirmando_cancelacion'")
  })

  it('las dos ramas se atienden en el mismo bloque', () => {
    expect(webhook).toContain("if (estado === 'confirmando_cita' || estado === 'confirmando_cancelacion') {")
  })
})

describe('la bandera vieja no puede secuestrar el recordatorio', () => {
  it('el cron la escribe VACÍA a propósito', () => {
    /**
     * `merge: true` funde los mapas anidados, así que sin esto una bandera de un
     * diálogo abandonado sobrevivía a la reescritura de la sesión.
     */
    expect(cron).toContain("cancelarSolo: ''")
    expect(cron).toContain('funde los mapas anidados')
  })

  it('pero se sigue leyendo, para no invertir una conversación en vuelo', () => {
    // Al desplegar esto, un paciente a medio diálogo de cancelación tiene su
    // sesión con el estado viejo: si se dejara de leer la bandera, su «SÍ»
    // pasaría a confirmar — el fallo simétrico.
    expect(webhook).toContain("|| String(session?.datos?.cancelarSolo ?? '') === '1'")
  })
})

describe('el estado nuevo no se cuela por otra puerta', () => {
  it('las guardas de intención lo tratan como una conversación en curso', () => {
    // Si «agendar» o una pregunta frecuente pudieran interrumpir aquí, el
    // paciente se quedaría con la cancelación a medias y sin saberlo.
    for (const g of [
      "'esperando_lista', 'confirmando_cita', 'confirmando_cancelacion', 'aviso_privacidad'",
      "'esperando_lista', 'confirmando_cita', 'confirmando_cancelacion', 'cancelar_elegir', 'aviso_privacidad'",
    ]) {
      expect(webhook, g).toContain(g)
    }
  })
})
