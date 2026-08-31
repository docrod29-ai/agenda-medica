/**
 * GOLDEN — `title=` es comodidad del ratón, nunca el único portador de un dato.
 *
 * ── DE DÓNDE SALE ESTA REGLA ────────────────────────────────────────────────
 *
 * No de un manual: de haberse tropezado TRES veces con el mismo patrón en este
 * carril, cada vez en una pantalla distinta y cada vez pareciendo un defecto
 * aislado.
 *
 *   · unidad 18 — el ESTADO de una cita, en la rejilla del calendario.
 *     «Cita de Nadia Ferreiro Ocampo a las 13:00», de una cita CANCELADA.
 *   · unidad 32 — las CIFRAS de «Ingresos por día» en `/finanzas`.
 *     Nueve barras y ningún importe legible sin ratón.
 *   · esta unidad — en `/citas`: el motivo de una cortesía, el aviso del
 *     calendario descuadrado y —la peor— la RECOMENDACIÓN del riesgo de
 *     no-show, que es lo que le dice a la asistente si toca llamar al paciente.
 *
 * A la tercera deja de ser un defecto y pasa a ser un hábito del código.
 *
 * ── POR QUÉ `title` NO SIRVE ────────────────────────────────────────────────
 *
 * Es un canal de PUNTERO. No aparece al tocar en una tableta —que es la mitad
 * de los sitios donde se usa este producto—, los lectores de pantalla lo
 * anuncian de forma inconsistente o no lo anuncian, y no se ve de lejos. Un
 * dato que sólo está ahí es un dato que la mitad de la gente no tiene.
 *
 * ── LA REGLA ────────────────────────────────────────────────────────────────
 *
 * Si el dato importa, va en el texto visible o en el árbol accesible
 * (`.nx-solo-lector`, o el nombre accesible del control). `title` se queda como
 * comodidad del ratón, que es para lo que sirve. **Nunca solo.**
 *
 * ── PROBADO AL REVÉS ────────────────────────────────────────────────────────
 *
 * Quitando el `.nx-solo-lector` de cualquiera de los tres sitios de `/citas`,
 * cae. Quitando la utilidad de la hoja, cae. Y el barrido comprueba que
 * encuentra código de verdad, para no pasar por vacío el día que la ruta cambie.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · Sólo vigila las pantallas de ESTE carril. El resto de la aplicación tiene
 *   más `title=`; no se han auditado y no se declaran buenos.
 * · No comprueba que el texto oculto se pronuncie bien, ni en qué orden: eso
 *   necesita un lector real, que este carril no ha usado.
 * · No detecta el caso contrario —texto oculto que repite lo visible y hace la
 *   lectura pesada—, que también es un defecto.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

/** Las pantallas que este carril posee y ha auditado. */
const PANTALLAS = [
  'src/app/(dashboard)/citas/page.tsx',
  'src/app/(dashboard)/calendario/page.tsx',
  'src/app/(dashboard)/finanzas/page.tsx',
]

const sinComentarios = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, '')

describe('el barrido encuentra código de verdad', () => {
  it('las pantallas existen y tienen tamaño', () => {
    for (const p of PANTALLAS) {
      expect(readFileSync(p, 'utf8').length, p).toBeGreaterThan(2000)
    }
  })
})

describe('title no es un canal de información', () => {
  it('la utilidad para lector de pantalla existe y no borra del árbol', () => {
    const hoja = readFileSync('src/app/globals.css', 'utf8')
    const i = hoja.indexOf('.nx-solo-lector')
    expect(i, 'la utilidad está declarada').toBeGreaterThan(-1)
    const bloque = hoja.slice(i, hoja.indexOf('}', i))
    // `display:none` la sacaría del árbol accesible, que es lo contrario.
    expect(bloque).not.toMatch(/display:\s*none/)
    expect(bloque).toMatch(/clip-path|clip:/)
  })

  it('los tres datos de /citas que vivían sólo en title ya no lo hacen', () => {
    const s = sinComentarios(readFileSync('src/app/(dashboard)/citas/page.tsx', 'utf8'))
    // Cortesía: el motivo.
    expect(s).toMatch(/nx-solo-lector[\s\S]{0,120}exentoMotivo/)
    // Calendario descuadrado: el aviso.
    expect(s).toMatch(/nx-solo-lector[\s\S]{0,120}avisoDesincronizada/)
    // Riesgo de no-show: la cifra y la recomendación.
    expect(s).toMatch(/nx-solo-lector[\s\S]{0,160}riesgo\.recomendacion/)
  })

  it('la gráfica de finanzas lleva su dato en el árbol, no en el title', () => {
    const s = sinComentarios(readFileSync('src/app/(dashboard)/finanzas/page.tsx', 'utf8'))
    const i = s.indexOf('serieDias.map')
    const barra = s.slice(i, i + 1400)
    expect(barra).toContain('aria-label={dicho}')
  })

  it('el calendario lleva el estado en el nombre accesible, no en el title', () => {
    const s = sinComentarios(readFileSync('src/app/(dashboard)/calendario/page.tsx', 'utf8'))
    expect(s).toContain('etiqueta: etiquetaDeCita(a)')
  })

  it('ningún title de estas pantallas se queda como único portador', () => {
    /**
     * Regla operativa: cada `title={…}` de estas pantallas tiene, cerca, otro
     * canal — `aria-label`, `.nx-solo-lector`, o `etiqueta:`, que es como
     * `activable()` pone el nombre accesible en este repositorio— o es un
     * título de sección que repite un encabezado visible (`title={vacio.titulo}`,
     * `<Card title=…>`), donde el texto YA se ve.
     *
     * `etiqueta:` se añadió después de que este mismo caso marcara el bloque del
     * calendario: el nombre accesible SÍ estaba, pero puesto con el idioma del
     * repositorio en vez de con el atributo crudo. Enseñarle el vocabulario al
     * escáner no es aflojarlo — y de paso el hallazgo era real: el `title`
     * decía el MÉDICO y la etiqueta no, así que en un consultorio de varios
     * «de quién es esta cita» era un dato de ratón. Eso sí se arregló.
     */
    const huerfanos: string[] = []
    for (const p of PANTALLAS) {
      const s = sinComentarios(readFileSync(p, 'utf8'))
      for (const m of s.matchAll(/title=\{/g)) {
        const ventana = s.slice(Math.max(0, m.index! - 420), m.index! + 700)
        const cubierto = /nx-solo-lector|aria-label|etiqueta:|<Card\s|vacio\.titulo/.test(ventana)
        if (!cubierto) {
          huerfanos.push(`${p}: …${s.slice(m.index!, m.index! + 70).replace(/\n/g, ' ')}`)
        }
      }
    }
    expect(huerfanos, `title sin otro canal:\n${huerfanos.join('\n')}`).toEqual([])
  })
})
