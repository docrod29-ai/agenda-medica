/**
 * GOLDEN — un día sin huecos dice POR QUÉ, y a dónde ir.
 *
 * ── QUÉ FALLABA ─────────────────────────────────────────────────────────────
 *
 * El portal de la asistente selecciona HOY por omisión. Si hoy el consultorio
 * no abre —sábado, domingo, festivo— la pantalla decía «No hay horarios
 * disponibles este día» y ahí terminaba, mientras **dos filas más arriba**
 * había un día con nueve lugares.
 *
 * Visto en el arnés a 1440 px: «Hoy · Sin lugar» seleccionado y en gris,
 * «Domingo 30 · Sin lugar», «Lunes 31 · 9 lugares». El día seleccionado por
 * omisión era, además, un botón **deshabilitado**.
 *
 * ── POR QUÉ ES PEOR QUE UN TEXTO SOSO ───────────────────────────────────────
 *
 * El mensaje decía la verdad y aun así engañaba. «No hay horarios» es cierto en
 * tres situaciones que **no significan lo mismo** para quien está al teléfono
 * con el paciente:
 *
 *   · el consultorio no abre ese día de la semana  → busca otro DÍA
 *   · es festivo                                    → busca otro DÍA
 *   · está lleno                                    → busca otra HORA, o lista de espera
 *
 * Quien lee «no hay horarios» entiende la tercera. Las otras dos se resuelven
 * de otra forma. Es la regla 4 de `clinical-safety` en versión de agenda:
 * **ausencia de hueco no es dato de ausencia**.
 *
 * ── LA REGLA QUE LO HACE SEGURO ─────────────────────────────────────────────
 *
 * El vacío responde a las tres preguntas del §13: qué significa, si es normal,
 * y qué se puede hacer ahora. El «a dónde ir» se **ofrece**, no se salta solo:
 * un cambio de fecha en silencio es justo lo que la asistente no puede
 * permitirse no haber visto.
 *
 * Y si el motivo no se puede saber, se dice lo que se sabe — no se inventa una
 * explicación plausible.
 *
 * ── PROBADO AL REVÉS ────────────────────────────────────────────────────────
 *
 * Devolviendo el mensaje único falla el primer caso; quitando el botón de
 * sugerencia falla el segundo; quitando la comprobación de festivo falla el
 * tercero.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · Es un escáner de fuente: comprueba que los tres motivos y la sugerencia
 *   estén cableados, **no** que se pinten. Eso se miró en el navegador y vive
 *   en el acta.
 * · No cubre el portal PÚBLICO del paciente (`/reservar/[clinicId]`), que tiene
 *   su propio vacío y no se tocó aquí.
 * · No comprueba que el motivo elegido sea el correcto para una configuración
 *   rara (horario activo pero sin franjas, por ejemplo).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const SRC = readFileSync('src/app/(dashboard)/asistente/page.tsx', 'utf8')
/** Sin comentarios: un comentario que cite el defecto satisfaría `toContain`. */
const cuerpo = SRC.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, '')

describe('un día sin huecos dice por qué', () => {
  it('distingue los tres motivos, en vez de dar uno solo', () => {
    expect(cuerpo).toContain('Ese día es festivo')
    expect(cuerpo).toContain('El consultorio no abre ese día de la semana')
    expect(cuerpo).toContain('Ese día ya está lleno')
  })

  it('ofrece el primer día con lugar como acción', () => {
    expect(cuerpo).toContain('primerDiaConLugar')
    expect(cuerpo).toMatch(/onClick=\{\(\) => setFecha\(primerDiaConLugar\.dia\)\}/)
  })

  /**
   * La primera versión de este caso buscaba bloques `useEffect` con una
   * expresión que exigía cierre en varias líneas. Probada al revés con un
   * efecto de UNA línea, no lo veía: no escaneaba ningún bloque y pasaba por
   * vacío. Una prueba que no puede fallar no es una prueba.
   *
   * Ahora se mira el único sitio donde la fecha se mueve a la sugerencia y se
   * exige que esté colgado de un `onClick`.
   */
  it('NO salta de fecha por su cuenta', () => {
    const usos = [...cuerpo.matchAll(/setFecha\(primerDiaConLugar/g)]
    expect(usos.length, 'la fecha se mueve a la sugerencia en un solo sitio').toBe(1)
    const antes = cuerpo.slice(Math.max(0, usos[0].index - 60), usos[0].index)
    expect(antes, 'y ese sitio es un onClick, no un efecto').toContain('onClick')
    // Y ningún efecto la menciona siquiera.
    for (const m of cuerpo.matchAll(/useEffect\(/g)) {
      const trozo = cuerpo.slice(m.index, m.index + 400)
      expect(trozo, 'ningún efecto mueve la fecha a la sugerencia').not.toContain('setFecha(primerDiaConLugar')
    }
  })

  it('el motivo se calcula con el festivo y el horario reales, no adivinando', () => {
    expect(cuerpo).toContain('esFestivo(fecha')
    expect(cuerpo).toMatch(/horario\?\.\[diaSemana\]/)
  })

  it('los lugares de cada día se cuentan UNA vez y los leen lista y sugerencia', () => {
    expect(cuerpo).toContain('lugaresPorDia')
    // La lista ya no recalcula por su cuenta dentro del map.
    expect(cuerpo).not.toContain('const daySlots = getAvailableSlots')
  })

  it('«1 lugar» no se dice en plural', () => {
    expect(cuerpo).toMatch(/lugares === 1 \? 'lugar' : 'lugares'/)
  })
})
