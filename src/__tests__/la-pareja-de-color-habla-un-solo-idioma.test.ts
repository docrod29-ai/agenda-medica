/**
 * GOLDEN — media pareja seguía al tema y la otra media no.
 *
 * ── QUÉ FALLABA, Y CÓMO SE DESCUBRIÓ ────────────────────────────────────────
 *
 * Pasando axe sobre las quince rutas públicas servidas, **en tema claro**, que
 * es lo que nadie había hecho. En oscuro salían cero violaciones graves; en
 * claro, 21 — todas de contraste, y todas del mismo patrón:
 *
 *     { fg: '#f87171', bg: 'color-mix(in srgb, var(--red) 12%, transparent)' }
 *        ↑ literal de Tailwind        ↑ token del sistema
 *
 * El FONDO ya salía del token y el TEXTO era un literal pensado para fondo
 * oscuro. En oscuro la pareja cuadra por casualidad; en claro el tinte se
 * oscurece mientras el texto sigue siendo el claro. Medido:
 *
 *   · `/demo/razonamiento`  #f87171 sobre su tinte → **2,04 : 1**, y el texto
 *     decía «Amoxicilina choca con una alergia registrada»
 *   · `/seguridad`          #16a34a → 2,61 : 1
 *   · `/terminos`, `/privacidad` forzaban `background: '#fff'` y `color:
 *     '#1a1a1a'`: dos páginas que ignoraban el tema entero
 *   · `/arquitectura`, `/operacion` → 44 nodos de badges con hex literal
 *
 * ── LAS DOS CAUSAS RAÍZ, QUE SON DISTINTAS ──────────────────────────────────
 *
 * **1. La pareja partida.** El token EXISTÍA y sólo lo usaba una mitad.
 * Ninguna revisión de una sola pieza lo encuentra, porque cada mitad está
 * bien: el token es correcto, y el literal es el valor correcto *para fondo
 * oscuro*. Es la familia del acento sin token vista desde el otro lado.
 *
 * **2. El tinte no es la superficie.** Un token semántico se mide contra
 * `--s1`…`--s3` y con eso se da por bueno. Cuando ese mismo color se usa de
 * TINTE bajo su propio texto, el fondo ya no es la superficie: es la superficie
 * mezclada con el color — que en oscuro la aclara y en claro la oscurece. Por
 * eso `--amber` sobre su propio tinte al 14 % pasaba en oscuro y daba 3,98 en
 * claro. La cierra `--tinte`, que vale 14 % en oscuro y 8 % en claro: se separa
 * el PORCENTAJE por tema porque el tono ya está medido y es el bueno.
 *
 * ── PROBADO AL REVÉS ────────────────────────────────────────────────────────
 *
 * Reponiendo `fg: '#f87171'` en `Copiloto.tsx`, el primer caso falla. Con
 * `--tinte: 14%` en el bloque claro, axe vuelve a marcar `/arquitectura`.
 *
 * ── QUÉ **NO** CUBRE ────────────────────────────────────────────────────────
 *
 * · **No mide contraste.** Es un guardián de fuente: caza la FORMA del defecto
 *   —token en el fondo, literal en el texto— no el ratio. El ratio lo mide axe
 *   sobre la página servida, y en los dos temas: es lo único que lo encontró.
 * · **No cubre la aplicación**, sólo las superficies públicas y los componentes
 *   que ya se corrigieron. El interior tiene 346 hex en línea y su propio
 *   trinquete; sanearlo entero es otro trabajo, y está declarado como tal.
 * · No prohíbe todo literal: `opengraph-image.tsx` no puede hablar variables
 *   (satori), y `avatar-color.ts` es una paleta multi-tono legítima.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const leer = (rel: string) => readFileSync(join(process.cwd(), rel), 'utf8')

/** Donde se corrigió la pareja. Un literal nuevo aquí es la reincidencia. */
const PAREJAS_CORREGIDAS = [
  'src/components/Copiloto.tsx',
  'src/components/CalculadorasClinicas.tsx',
  'src/components/RevisionPanel.tsx',
  'src/app/seguridad/page.tsx',
  'src/app/arquitectura/page.tsx',
  'src/app/operacion/page.tsx',
]

/**
 * Los literales de Tailwind que estaban ocupando el papel de un token
 * semántico. No es «todo hex»: son estos seis, que tienen token equivalente.
 */
const LITERALES_CON_TOKEN = /#(?:f87171|4ade80|10b981|16a34a|f59e0b|d97706|b45309|0d9488|4f5bd5|a855f7)\b/i

const sinComentarios = (src: string) =>
  src.replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ').replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' ')

describe('la pareja de color habla un solo idioma', () => {
  it('donde el fondo usa el token, el texto también', () => {
    const culpables: string[] = []
    for (const archivo of PAREJAS_CORREGIDAS) {
      sinComentarios(leer(archivo)).split('\n').forEach((linea, i) => {
        if (LITERALES_CON_TOKEN.test(linea)) culpables.push(`${archivo}:${i + 1} → ${linea.trim().slice(0, 90)}`)
      })
    }
    expect(
      culpables,
      `volvió el literal donde hay token; en tema claro esto no cambia:\n${culpables.join('\n')}`,
    ).toEqual([])
  })

  it('las dos páginas legales dejan de forzar su propio tema', () => {
    for (const p of ['src/app/terminos/page.tsx', 'src/app/privacidad/page.tsx']) {
      const src = sinComentarios(leer(p))
      expect(src, `${p} vuelve a imponer fondo blanco`).not.toMatch(/background:\s*'#fff'/)
      expect(src, `${p} vuelve a imponer texto casi negro`).not.toMatch(/color:\s*'#1a1a1a'/)
      expect(src).toContain("background: 'var(--bg)'")
    }
  })

  it('el tinte semántico tiene un porcentaje POR TEMA, no uno solo', () => {
    const css = leer('src/app/globals.css')
    // Tres bloques de tema: oscuro, claro y el de preferencia del sistema.
    expect((css.match(/--tinte:/g) ?? []).length).toBe(3)
    expect(css, 'el tinte oscuro dejó de ser el ancho').toMatch(/--tinte: 14%/)
    expect(css, 'el tinte claro dejó de ser el estrecho').toMatch(/--tinte: 8%/)
  })

  /**
   * EL QUINTO PAPEL: TEXTO SOBRE SU PROPIO TINTE.
   *
   * Arreglar la pareja destapó el defecto de debajo. Los tokens semánticos
   * están medidos «sobre --s3, la peor superficie» — y eso es cierto de las
   * SUPERFICIES. Cuando el mismo color se usa de TINTE bajo su propio texto,
   * el fondo ya no es una superficie: es la superficie tirando hacia el color.
   * Y cuando el tinte se ANIDA —un panel teñido con filas teñidas dentro, que
   * es como se pintan los avisos del copiloto— se aleja el doble.
   *
   * Medido por axe sobre /demo/razonamiento servida, DESPUÉS de la corrección
   * anterior: --red #E66464 sobre el tinte anidado da 4,21 en oscuro, y
   * --amber #B45309 da 3,80 en claro. En avisos que dicen «Amoxicilina choca
   * con una alergia registrada».
   *
   * Es la misma lección que `--nexus` / `--nexus-solido` ya enseñó para el
   * acento —dos papeles con requisitos OPUESTOS necesitan dos valores— y que
   * nunca se generalizó al resto de la paleta. Aquí está el par que faltaba.
   */
  it('el texto sobre su propio tinte tiene su token, en los tres temas', () => {
    const css = leer('src/app/globals.css')
    for (const tok of ['--red-texto', '--amber-texto', '--green-texto']) {
      expect((css.match(new RegExp(`${tok}:`, 'g')) ?? []).length, `${tok} no está en los tres temas`).toBe(3)
    }
  })

  it('y los avisos clínicos lo usan: son los que se leen peor y más importan', () => {
    for (const p of ['src/components/Copiloto.tsx', 'src/components/CalculadorasClinicas.tsx']) {
      expect(leer(p), `${p} pinta el texto con el token del tinte`).toMatch(/var\(--(?:red|amber|green)-texto\)/)
    }
  })

  /**
   * Y el acto del héroe entra desde la AUSENCIA, no atenuado.
   *
   * Entraba desde `opacity: 0.34`. axe lo marcó en tema claro: a esa opacidad
   * «Padecimiento actual» da 3,55 : 1. Y no se arregla subiendo el número —
   * calculado con la fórmula WCAG sobre las superficies reales, ni al 70 % de
   * opacidad ese texto llega a 4,5. Atenuar texto es pedirle prestada
   * legibilidad al contraste para expresar una secuencia.
   */
  it('el héroe no atenúa texto para decir «todavía no»', () => {
    const css = leer('src/app/globals.css')
    const m = css.match(/@keyframes nx-acto \{([\s\S]*?)\n\}/)
    expect(m, 'ya no existe la secuencia del héroe').toBeTruthy()
    expect(m![1], 'vuelve el texto atenuado por debajo del contraste mínimo')
      .not.toMatch(/opacity:\s*0\.[1-9]/)
    expect(m![1]).toMatch(/opacity:\s*0;/)
  })

  it('y los sitios corregidos lo usan, en vez de fijar el porcentaje', () => {
    // Un token declarado que nadie usa es una decisión escrita y sin conectar.
    const usos = PAREJAS_CORREGIDAS.filter(p => leer(p).includes('var(--tinte)')).length
    expect(usos, 'el tinte por tema se declaró y no se cableó').toBeGreaterThanOrEqual(4)
  })
})
