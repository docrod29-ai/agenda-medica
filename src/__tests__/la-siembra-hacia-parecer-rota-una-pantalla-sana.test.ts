/**
 * LA SIEMBRA HACÍA PARECER ROTA UNA PANTALLA SANA — REG-440.
 *
 * ── CÓMO SE DESCUBRIÓ ───────────────────────────────────────────────────────
 *
 * Mirando `/pacientes` a 390 px. Los números salían perfectos —cero
 * desbordamiento, cero objetivos táctiles pequeños, cero campos sin etiqueta,
 * cero errores de consola— y la captura enseñaba la pantalla **vacía**:
 *
 *     Recientes | Todos A-Z (5) | Con alerta (1)
 *     Ninguno tiene citas recientes. Hay 5 expedientes en total.
 *
 * `/pacientes` abre en «Recientes». Con ocho citas hoy en la agenda, una de
 * ellas ya atendida, la primera pantalla de la lista de pacientes no enseñaba a
 * nadie.
 *
 * ── NO ERA UN DEFECTO DEL PRODUCTO ──────────────────────────────────────────
 *
 * «Recientes» filtra por `ultimaCita`, y el producto **sí** lo escribe: al pasar
 * una cita a atendida, finalizada o pagada (`contadores-paciente.ts`, cuyo
 * encabezado documenta que ese campo se leía en cuatro pantallas y no lo
 * escribía nadie — ya se arregló).
 *
 * Lo que fallaba era la SIEMBRA. Escribía `noShowCount` y `cancelacionCount`
 * —lo que dejaría una transición a «no asistió»— y **no** escribía `ultimaCita`,
 * que es lo que deja una transición a «atendida». Escribía la cita ya en estado
 * `atendida`, saltándose el camino que habría tocado al paciente.
 *
 * ── POR QUÉ ESTO MERECE UN GUARDIÁN ─────────────────────────────────────────
 *
 * El guion de siembra tiene escrito en su cabecera que «una siembra bonita
 * produce una auditoría visual mentirosa». Esto mentía en la **otra dirección**,
 * que es igual de caro y menos evidente: hace que una pantalla sana parezca
 * rota. Se tarda lo mismo en perseguir un defecto que no existe — y el final
 * malo no es perder el rato, es «arreglar» una pantalla que estaba bien.
 *
 * Un arnés que miente no es un arnés a medias: es un arnés que produce
 * conclusiones falsas con la autoridad de haber sido medido.
 *
 * ── LA REGLA ────────────────────────────────────────────────────────────────
 *
 * La siembra no inventa el estado derivado de una entidad clínica: lo **deriva**
 * de lo que ella misma siembra, con la MISMA regla que usa el producto. Aquí,
 * `ultimaCita` sale de las citas cuyo estado cuenta como atención efectiva.
 *
 * Este guardián existe para que esas dos listas no se separen. Si mañana el
 * producto añade un cuarto estado de atención efectiva y la siembra no se
 * entera, el arnés vuelve a enseñar menos de lo que hay — y esta vez falla.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · **No ejecuta la siembra.** Compara las dos listas de estados leyendo los
 *   dos archivos. Que el emulador acabe con el documento correcto se ve
 *   corriendo `npm run arnes:sembrar` y mirando la pantalla, y eso **no corre
 *   en CI**.
 * · **No vigila los otros campos derivados.** `noShowCount` y
 *   `cancelacionCount` se siguen escribiendo a mano en la siembra y este
 *   guardián no los ata a las citas sembradas. Se dice, no se esconde: hoy la
 *   siembra no tiene ninguna cita en `no-asistio`, así que derivarlos daría cero
 *   y perdería el caso duro que el número a mano representa.
 * · **No dice que `/pacientes` esté auditada.** Lo único que se afirma es que su
 *   primer pliegue ya enseña lo que enseñaría un consultorio real. El resto de
 *   la pantalla —el A-Z, la búsqueda, la fila de alerta— sigue sin recorrer.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const leer = (...p: string[]) => readFileSync(join(process.cwd(), ...p), 'utf8')

const SIEMBRA = leer('scripts', 'design', 'sembrar-emulador.mjs')
const CONTADORES = leer('src', 'lib', 'agenda', 'contadores-paciente.ts')

/** Los estados que el PRODUCTO considera atención efectiva. */
function estadosDelProducto(): string[] {
  const i = CONTADORES.indexOf('export function esAtencionEfectiva')
  expect(i, 'ya no existe esAtencionEfectiva').toBeGreaterThan(0)
  const cuerpo = CONTADORES.slice(i, CONTADORES.indexOf('}', i))
  return [...cuerpo.matchAll(/estado === '([a-z-]+)'/g)].map(m => m[1]).sort()
}

/** Los estados que la SIEMBRA usa para derivar `ultimaCita`. */
function estadosDeLaSiembra(): string[] {
  const i = SIEMBRA.indexOf('const ESTADOS_QUE_CUENTAN_COMO_ATENCION')
  expect(i, 'la siembra ya no declara los estados de atención').toBeGreaterThan(0)
  const linea = SIEMBRA.slice(i, SIEMBRA.indexOf('\n', i))
  return [...linea.matchAll(/'([a-z-]+)'/g)].map(m => m[1]).sort()
}

describe('la siembra deriva ultimaCita con la regla del producto', () => {
  it('EL CASO: las dos listas de estados son la MISMA', () => {
    /**
     * PROBADO AL REVÉS: quitando «pagada» de la lista de la siembra, este caso
     * cae nombrando la diferencia. Es la forma de que un cuarto estado nuevo en
     * el producto no deje al arnés enseñando de menos en silencio.
     */
    const producto = estadosDelProducto()
    const siembra = estadosDeLaSiembra()
    expect(producto.length, 'no se leyeron los estados del producto').toBeGreaterThan(0)
    expect(
      siembra,
      `la siembra deriva \`ultimaCita\` con [${siembra.join(', ')}] y el producto ` +
      `cuenta como atención [${producto.join(', ')}]. Separadas, el arnés enseña ` +
      'una pantalla más vacía que la realidad — y eso hace perseguir defectos que no existen.',
    ).toEqual(producto)
  })

  it('y la deriva de verdad: no hay una fecha escrita a mano', () => {
    /**
     * El arreglo fácil era poner `ultimaCita: '2026-09-02'` en el paciente y
     * seguir. Duraría hasta que alguien cambiara una cita de estado, y entonces
     * el arnés volvería a mentir sin que nada fallara.
     */
    expect(SIEMBRA).toMatch(/ultimaCitaDe\.set\(c\.pac/)
    expect(SIEMBRA).toMatch(/\.\.\.\(ultimaCitaDe\.has\(p\.id\)/)
    const bloquePaciente = SIEMBRA.slice(SIEMBRA.indexOf('// ── Pacientes'), SIEMBRA.indexOf('UN PAQUETE DE VISITA'))
    expect(
      bloquePaciente,
      'apareció una fecha literal en el bloque del paciente: eso es volver a escribirla a mano',
    ).not.toMatch(/ultimaCita:\s*'20\d\d-/)
  })

  it('y un paciente SIN cita atendida se queda sin el campo', () => {
    /**
     * «Ausencia de dato no es dato de ausencia» (clinical-safety §4) aplicado a
     * la siembra: escribir `ultimaCita: ''` o una fecha vieja para todos haría
     * que «Recientes» enseñara a los cinco, que es la mentira contraria.
     */
    expect(SIEMBRA).toMatch(/ultimaCitaDe\.has\(p\.id\) \?/)
    expect(SIEMBRA).toMatch(/: \{\}\)/)
  })
})

describe('el producto sigue siendo quien manda sobre ese campo', () => {
  it('`esAtencionEfectiva` sigue existiendo y sigue siendo la fuente', () => {
    /**
     * Si alguien borra la función y deja la lista suelta en la siembra, el
     * guardián de arriba pasaría comparando la siembra consigo misma. Aquí no.
     */
    expect(CONTADORES).toContain('export function esAtencionEfectiva')
    expect(CONTADORES).toMatch(/cambios\.ultimaCita = fechaHora\.slice\(0, 10\)/)
  })
})
