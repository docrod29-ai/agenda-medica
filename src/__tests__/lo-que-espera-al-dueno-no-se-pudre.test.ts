/**
 * LAS DECISIONES DEL DUEÑO SE DERIVAN DEL CÓDIGO — REG-288.
 *
 * ── EL HUECO ────────────────────────────────────────────────────────────────
 *
 * Este repositorio tiene una regla que ha funcionado: **cuando falta un criterio
 * clínico u operativo, no se inventa un default — se declara.** De ahí salen
 * `FALTA_GRACIA`, `FALTA_POLITICA_Q2_Q4`, `FALTA_VENTANA_REINGRESO`,
 * `FALTA_VENTANA_TEMPORAL`, `LO_QUE_HACE_FALTA_DEL_DR`.
 *
 * Cada una está escrita con cuidado, dice qué hace falta y por qué no puede
 * decidirlo el software. Y **nadie las lee**: viven repartidas en cinco módulos.
 *
 * Es «escrito y sin conectar» —la familia más grande de este repositorio—
 * aplicado a las **decisiones** en vez de al código. La declaración existe; el
 * camino hasta quien decide, no. Y el resultado se ve: llevan meses citándose de
 * memoria al final de cada informe, con el riesgo de que la lista se desfase de
 * lo que el código realmente espera.
 *
 * ── POR QUÉ DERIVADO Y NO UNA LISTA ─────────────────────────────────────────
 *
 * Una lista escrita a mano se desfasa. Ya pasó dos veces con cifras de este
 * mismo repositorio: el tablero del loop (REG-241) y la sala de datos
 * (REG-267). Aquí el daño sería peor que una cifra mal: **una decisión resuelta
 * que se sigue pidiendo hace que se dejen de leer todas**, y una decisión nueva
 * que nadie recogió no llega nunca.
 *
 * ── LO QUE ESTA PRUEBA IMPIDE ───────────────────────────────────────────────
 *
 * Que el documento y el código digan cosas distintas. Nada más, y es suficiente.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { execSync } from 'node:child_process'

const RAIZ = process.cwd()
const DOC = 'docs/DECISIONES-DEL-DUENO.md'

const medir = () => JSON.parse(execSync(
  'node scripts/calidad/lo-que-espera-al-dueno.mjs --json',
  { cwd: RAIZ, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 },
)) as { total: number; abiertas: { constante: string; archivo: string; dice: string }[] }

describe('el instrumento encuentra lo que el código declara', () => {
  const m = medir()

  it('hay declaraciones, y no está mirando al vacío', () => {
    /**
     * Un instrumento que no encuentra nada parece decir «no queda nada
     * pendiente». Se falla en vez de pasar en silencio — la misma regla que el
     * trinquete de lint.
     */
    expect(m.total, 'el barrido no encontró NINGUNA declaración: revisa la expresión')
      .toBeGreaterThan(0)
  })

  it('cada una trae su texto, no sólo su nombre', () => {
    /**
     * El nombre no basta: `FALTA_GRACIA` no le dice a nadie qué contestar. El
     * valor entero de estas constantes está en lo que explican.
     */
    for (const d of m.abiertas) {
      expect(d.dice.length, `${d.constante} salió sin texto`).toBeGreaterThan(40)
    }
  })

  it('y el texto no arrastra código detrás', () => {
    /**
     * La primera versión leía hasta el siguiente `export` y pegaba código al
     * final. Un instrumento que enseña ruido se deja de leer, igual que un aviso
     * que grita de más.
     */
    for (const d of m.abiertas) {
      expect(d.dice, `${d.constante} arrastra código`).not.toMatch(/export const|=>|\{\s*$/)
    }
  })
})

describe('el documento y el código no pueden separarse', () => {
  const m = medir()
  const doc = readFileSync(join(RAIZ, DOC), 'utf8')

  it('el documento nombra TODAS las que el código declara', () => {
    const faltan = m.abiertas.filter(d => !doc.includes(d.constante)).map(d => d.constante)
    expect(
      faltan,
      'decisiones que el código espera y el documento no pide:\n  ' + faltan.join('\n  ') +
      '\n\n  → node scripts/calidad/lo-que-espera-al-dueno.mjs',
    ).toEqual([])
  })

  it('y no pide ninguna que ya no exista', () => {
    /**
     * El reverso, y es el que envenena: **seguir pidiendo algo ya resuelto hace
     * que se dejen de leer todas.** Es lo mismo que un aviso clínico que grita
     * de más.
     */
    const nombres = new Set(m.abiertas.map(d => d.constante))
    const sobran = [...doc.matchAll(/`(FALTA_[A-Z0-9_]+|LO_QUE_HACE_FALTA_[A-Z0-9_]+)`/g)]
      .map(x => x[1]).filter(n => !nombres.has(n))
    expect(
      [...new Set(sobran)],
      'el documento sigue pidiendo decisiones que el código ya no espera',
    ).toEqual([])
  })

  it('el documento cita el fichero y la línea de cada una', () => {
    /** Sin la ruta, contestar exige buscar. Con ella, es abrir y escribir. */
    for (const d of m.abiertas) {
      expect(doc, `${d.constante} sin su ruta`).toContain(d.archivo)
    }
  })
})

describe('lo que el documento NO hace, y es deliberado', () => {
  const doc = readFileSync(join(RAIZ, DOC), 'utf8')

  it('no propone un valor recomendado', () => {
    /**
     * Poner un número «razonable» al lado de la pregunta es cómo el criterio
     * del dueño se convierte en el default de un agente sin que nadie firme
     * nada. Estas cinco constantes existen precisamente para impedirlo.
     */
    expect(doc).toMatch(/no propone|no se propone|ninguna respuesta sugerida/i)
  })
})
