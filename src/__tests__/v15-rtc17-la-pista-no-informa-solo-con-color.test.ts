/**
 * RTC-17 — la pista de las ocho etapas deja de informar sólo con color.
 *
 * ── QUÉ FALLABA ─────────────────────────────────────────────────────────────
 *
 * La cola de cierre de §9 —ocho etapas por resultado— tenía tres defectos que
 * el equipo rojo contó (RT-12 + ORT-13):
 *
 * 1. **La etapa actual se distinguía SÓLO por color**: texto teal y tinte
 *    teal. En gris —una impresión, un monitor mal calibrado, un médico
 *    daltónico— la pista dejaba de decir dónde está el trabajo, que es lo
 *    único que la pista existe para decir.
 * 2. **`sin_dato` se decía sólo en cursiva**, y su PORQUÉ vivía únicamente en
 *    el atributo `title`, que en una pantalla táctil no existe. La razón por
 *    la que una etapa no se puede saber es justo lo que hay que poder leer:
 *    es la diferencia entre «todavía no ha pasado» y «esto no lo registramos».
 * 3. **A 390px las ocho píldoras caían en dos renglones** dentro de una fila
 *    de worklist, y ocho etiquetas de 10.5px no se leen: se miran.
 *
 * ── POR QUÉ IMPORTA EN ESTA PANTALLA Y NO EN OTRA ───────────────────────────
 *
 * `/pendientes` es la superficie de referencia del producto —la única que
 * llega al objetivo de §29— y esta pista es lo que la hace distinta: dice en
 * qué punto de las ocho etapas está cada resultado. Un defecto de
 * accesibilidad justo ahí se cobra en la pantalla que más se enseña.
 *
 * ── LA REGLA QUE LO HACE SEGURO ─────────────────────────────────────────────
 *
 * 1. **Un canal que no es color**: un glifo por estado (`✓` hecha, `●` actual,
 *    `○` todavía no, `—` sin dato). El color acompaña; ya no informa solo.
 * 2. **El motivo del «sin dato» llega a quien lee con voz**, no sólo al ratón.
 * 3. **En el teléfono, una línea que se despliega** —«Etapa 3 de 8 · sigue:
 *    Dueño»— con `<details>` NATIVO: trae teclado, foco y lectores de pantalla
 *    sin escribir una línea de JS.
 * 4. **Sólo una forma por ancho.** Dos pistas a la vez serían dos veces el
 *    mismo dato — el defecto que RTC-14 acaba de quitar en las alergias.
 * 5. **El cálculo de las etapas NO cambia.** Esto es cómo se dicen, no qué se
 *    dice: las tres etapas que nunca se marcan como hechas siguen sin
 *    marcarse, porque no hay dato que lo respalde.
 *
 * Probado al revés: quitando los glifos falla el caso 1; devolviendo el motivo
 * sólo al `title` falla el 2; quitando el `<details>` falla el 3.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · **No mide contraste ni ejecuta axe**: los glifos heredan el color del
 *   estado, y ese par ya estaba medido. Lo que este cambio garantiza es que el
 *   color no sea el ÚNICO canal, no que el color sea correcto.
 * · No cubre el `<details>` abierto por defecto: nace cerrado a propósito —en
 *   una fila de worklist, ocho etapas desplegadas serían el defecto 3 otra vez.
 * · No comprueba en navegador que a 390px se enseñe la forma compacta: eso es
 *   el arnés de breakpoints.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { resumenCompacto } from '@/components/tareas/ProgresoResultado'
import { progresoResultado } from '@/lib/tareas-clinicas/progreso-resultado'

const leer = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')
const PISTA = leer('src/components/tareas/ProgresoResultado.tsx')
const CSS = leer('src/app/globals.css')

describe('RTC-17 — el color no es el único canal', () => {
  it('1 · cada estado tiene su glifo, y se pinta', () => {
    expect(PISTA).toMatch(/const GLIFO: Record<EstadoEtapa, string> = \{/)
    for (const g of ['✓', '●', '○', '—']) expect(PISTA).toContain(`'${g}'`)
    expect(PISTA).toMatch(/\{GLIFO\[e\.estado\]\}/)
    // `aria-hidden`: el estado ya viaja en el resumen del grupo; repetirlo
    // sería leerlo dos veces.
    expect(PISTA).toMatch(/<span aria-hidden="true" style=\{\{ marginRight: 4 \}\}>\{GLIFO\[e\.estado\]\}<\/span>/)
  })

  it('2 · el motivo del «sin dato» llega al resumen accesible, no sólo al title', () => {
    expect(PISTA).toMatch(/e\.motivoSinDato \? `\$\{base\} \(\$\{e\.motivoSinDato\}\)` : base/)
  })

  it('3 · en el teléfono la pista se resume y se despliega, con `<details>` nativo', () => {
    expect(PISTA).toContain('<details className="nx-progreso-estrecho">')
    expect(PISTA).toContain('<summary')
    expect(CSS).toContain('.nx-progreso-estrecho { display: none; }')
    expect(CSS).toMatch(/max-width: 560px\)[\s\S]{0,200}\.nx-progreso-ancho \{ display: none; \}/)
  })

  it('4 · el resumen compacto cuenta lo hecho y nombra lo siguiente', () => {
    // Tarea viva sin dueño: dos etapas hechas y el siguiente paso es Dueño.
    expect(resumenCompacto(progresoResultado({ estado: 'solicitada' })))
      .toBe('Etapa 2 de 8 · sigue: Dueño')
  })

  it('5 · una tarea terminal NO promete un siguiente paso', () => {
    /**
     * Cerrada o cancelada no tienen «lo que sigue». Prometerlo sería
     * inventarlo — la misma regla que hace que tres de las ocho etapas nunca
     * se marquen como hechas.
     */
    const cerrada = resumenCompacto(progresoResultado({ estado: 'cerrada', ownerUid: 'u1' }))
    expect(cerrada).not.toContain('sigue:')
    expect(cerrada).toMatch(/^Etapa \d+ de 8$/)
  })

  it('6 · el cálculo de las etapas no se tocó: sigue sin inventar las tres sin dato', () => {
    const etapas = progresoResultado({ estado: 'completada', ownerUid: 'u1' })
    const sinDato = etapas.filter(e => e.estado === 'sin_dato')
    expect(sinDato.map(e => e.clave)).toEqual(['decision', 'accion', 'aviso_paciente'])
    for (const e of sinDato) expect(e.motivoSinDato, `${e.clave} sin motivo`).toBeTruthy()
  })
})
