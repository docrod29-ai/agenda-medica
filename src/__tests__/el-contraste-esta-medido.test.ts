/**
 * EL CONTRASTE ESTÁ MEDIDO, NO RECORDADO — V9 · A11Y-GATE-001.
 *
 * ── QUÉ FALLABA ─────────────────────────────────────────────────────────────
 *
 * Dos tokens del **tema claro** no cumplían AA, y el CSS afirmaba por escrito
 * que sí:
 *
 * | Token | Sobre `--s3` | Umbral | Lo que decía el comentario |
 * |---|---|---|---|
 * | `--text3` `#6B6F75` | **4.20** | 4.5 | «AA sobre `--bg` y sobre `--s3`» |
 * | `--amber` `#B45309` | **4.17** | 4.5 | «versiones light-mode (contraste AA)» |
 *
 * Y `--amber` fallaba **por los dos lados a la vez**, que es lo que lo hace
 * interesante: también se usa de RELLENO bajo texto casi negro —la franja de
 * «sin conexión» y dos botones de la consulta— y ahí daba **4.18**. Un token, dos
 * trabajos con requisitos opuestos: el mismo defecto que ya se había encontrado y
 * documentado para `--nexus` / `--nexus-solido`, repetido en otro color sin que
 * nadie lo notara, porque **la lección se aplicó al caso, no a la familia**.
 *
 * ── CÓMO SE DESCUBRIÓ ───────────────────────────────────────────────────────
 *
 * Ejecutando la aritmética que hasta hoy sólo estaba escrita. `globals.css`
 * documenta cocientes calculados a mano —«red #E66464 → 4.61»— y están bien; el
 * problema es que **un número a mano vale el día que se escribe**. El tema
 * oscuro se corrigió en su momento y el claro se quedó a medias: el mismo patrón
 * que el propio CSS confiesa unas líneas más arriba («la corrección de contraste
 * se había aplicado sólo a un tema»).
 *
 * ── LA CAUSA RAÍZ QUE SE ATACA ──────────────────────────────────────────────
 *
 * No es que alguien calculara mal: es que **calcular dependía de que alguien se
 * acordara**. Cambiar un token es una línea; recalcular seis cocientes a mano es
 * un rato. Aquí el cálculo corre en cada CI sobre los tokens de verdad, en los
 * DOS temas, con `src/lib/design/contraste.ts` — la misma regla que gobierna lo
 * clínico: el cálculo lo hace un motor determinista, no la memoria.
 *
 * ── LA REGLA QUE LO HACE SEGURO ─────────────────────────────────────────────
 *
 * Todo token semántico de texto cumple **4.5:1 sobre la PEOR de las cuatro
 * superficies**, en los dos temas. No sobre el lienzo —que es la medida
 * favorable— sino sobre `--s3`, la superficie activa, que es donde el texto
 * secundario acaba cuando la fila está seleccionada.
 *
 * ── PROBADO AL REVÉS ────────────────────────────────────────────────────────
 *
 * El motor se prueba con valores conocidos de la norma (blanco/negro = 21,
 * un color contra sí mismo = 1) y **con los dos tokens defectuosos originales**:
 * la prueba comprueba que `#6B6F75` y `#B45309` habrían fallado. Sin eso, este
 * archivo sería una foto del estado actual y no un guardián.
 *
 * ── QUÉ **NO** CUBRE ────────────────────────────────────────────────────────
 *
 * - **No mide pantallas: mide pares de tokens.** No ve el texto sobre una imagen,
 *   ni un `opacity` heredado, ni un color escrito a mano en un `style` (eso es de
 *   `color-trinquete`). Aprobar una pantalla exige abrirla — directiva V9 §4.
 * - **No sabe el tamaño de la letra.** Aplica 4.5 a todo lo que declare como
 *   texto. Es deliberadamente estricto: dar por «grande» un texto sin medirlo es
 *   la forma barata de aprobarlo todo.
 * - No cubre `color-mix()`, gradientes ni modos de fusión.
 * - No sustituye a `axe` sobre la app corriendo, que sigue pendiente: sin
 *   credenciales de Firebase este contenedor no puede levantar el producto.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  parsearColor,
  contraste,
  componer,
  redondear,
  AA_TEXTO,
  type Color,
} from '@/lib/design/contraste'

const CSS = readFileSync(join(process.cwd(), 'src', 'app', 'globals.css'), 'utf8')

/** Extrae `--token: valor;` de un bloque de reglas. */
function tokensDe(bloque: string): Record<string, string> {
  const t: Record<string, string> = {}
  for (const m of bloque.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-fA-F]{3,8}|rgba?\([^)]*\))\s*;/g)) {
    t[m[1]] = m[2]
  }
  return t
}

function bloque(re: RegExp): string {
  const m = re.exec(CSS)
  if (!m) throw new Error(`No se encontró el bloque ${re}`)
  return m[1]
}

const RAIZ = tokensDe(bloque(/:root\s*\{([\s\S]*?)\n\}/))
const CLARO_CRUDO = tokensDe(bloque(/:root\[data-theme="light"\]\s*\{([\s\S]*?)\n\}/))

/** El tema claro hereda de `:root` lo que no redefine. */
const TEMAS: Record<string, Record<string, string>> = {
  oscuro: RAIZ,
  claro: { ...RAIZ, ...CLARO_CRUDO },
}

function color(tema: string, token: string): Color {
  const crudo = TEMAS[tema][token]
  const c = crudo ? parsearColor(crudo) : null
  if (!c) throw new Error(`El token --${token} no existe o no se entiende en el tema ${tema}: ${crudo}`)
  return c
}

/** Las cuatro superficies sobre las que este producto pinta texto. */
const SUPERFICIES = ['bg', 's1', 's2', 's3'] as const

/** Tokens que SIEMPRE son texto. */
const TEXTOS = ['text', 'text2', 'text3', 'red', 'green', 'amber', 'blue', 'purple', 'nexus'] as const

describe('el motor de contraste calcula la norma, no una aproximación', () => {
  it('blanco sobre negro es 21:1 y un color contra sí mismo es 1:1', () => {
    const blanco = parsearColor('#ffffff')!
    const negro = parsearColor('#000000')!
    expect(redondear(contraste(blanco, negro))).toBe(21)
    expect(redondear(contraste(blanco, blanco))).toBe(1)
  })

  it('el orden no cambia el cociente', () => {
    const a = parsearColor('#6E84FE')!
    const b = parsearColor('#0B0C0E')!
    expect(redondear(contraste(a, b))).toBe(redondear(contraste(b, a)))
  })

  it('un color translúcido se compone antes de medirse', () => {
    /**
     * Sin esto, `rgba(239,68,68,0.16)` se mediría como rojo puro y daría un
     * número que ninguna pantalla enseña. Media paleta de este producto son
     * translúcidos.
     */
    const tinte = parsearColor('rgba(239,68,68,0.16)')!
    const lienzo = parsearColor('#0B0C0E')!
    const compuesto = componer(tinte, lienzo)
    expect(compuesto.a).toBe(1)
    // Con 16 % de alfa sobre un lienzo casi negro, el resultado sigue siendo oscuro.
    expect(compuesto.r).toBeLessThan(60)
    expect(contraste(tinte, lienzo)).toBeLessThan(contraste(parsearColor('#ef4444')!, lienzo))
  })

  it('devuelve null en vez de explotar ante lo que no entiende', () => {
    // Quien parsea una hoja de estilos se encuentra `var(--x)` y `transparent`.
    expect(parsearColor('var(--red)')).toBeNull()
    expect(parsearColor('transparent')).toBeNull()
    expect(parsearColor('#12345')).toBeNull()
  })

  it('los dos valores que fallaban habrían fallado aquí (probado al revés)', () => {
    /**
     * Ésta es la prueba que hace de esto un guardián y no una foto. `#6B6F75` y
     * `#B45309` son los valores que el tema claro tenía cuando se escribió este
     * archivo, y los dos reprobaban sobre `--s3`.
     */
    const s3Claro = parsearColor('#ECEAE3')!
    expect(contraste(parsearColor('#6B6F75')!, s3Claro)).toBeLessThan(AA_TEXTO)
    expect(contraste(parsearColor('#B45309')!, s3Claro)).toBeLessThan(AA_TEXTO)
    // Y el amber viejo tampoco servía de relleno bajo el texto casi negro
    // de la franja de «sin conexión».
    expect(contraste(parsearColor('#1a1a1a')!, parsearColor('#B45309')!)).toBeLessThan(AA_TEXTO)
  })
})

describe('todo texto del sistema cumple AA sobre la PEOR superficie, en los dos temas', () => {
  for (const tema of ['oscuro', 'claro']) {
    for (const token of TEXTOS) {
      it(`--${token} (${tema}) sobre cualquiera de las cuatro superficies`, () => {
        const frente = color(tema, token)
        for (const superficie of SUPERFICIES) {
          const r = contraste(frente, color(tema, superficie))
          expect(
            r,
            `--${token} sobre --${superficie} en tema ${tema}: ${redondear(r)}:1 (mínimo ${AA_TEXTO})`,
          ).toBeGreaterThanOrEqual(AA_TEXTO)
        }
      })
    }
  }
})

describe('los rellenos se miden contra el texto que llevan encima', () => {
  /**
   * UN TOKEN NO PUEDE SERVIR PARA LAS DOS COSAS: los requisitos son OPUESTOS.
   * Como TEXTO sobre fondo oscuro hay que aclararlo; como RELLENO bajo texto
   * claro hay que oscurecerlo. El CSS ya lo había aprendido con `--nexus` /
   * `--nexus-solido`; `--amber` repetía el defecto sin que nadie lo notara.
   */
  const RELLENOS: Array<{ token: string; textoEncima: string; donde: string }> = [
    { token: 'nexus-solido', textoEncima: '#ffffff', donde: '.btn-primary y 26 rellenos en línea' },
    { token: 'amber-solido', textoEncima: '#1a1a1a', donde: '.offline-banner y los botones de aviso de la consulta' },
  ]

  for (const tema of ['oscuro', 'claro']) {
    for (const { token, textoEncima, donde } of RELLENOS) {
      it(`--${token} (${tema}) bajo su texto — ${donde}`, () => {
        const r = contraste(parsearColor(textoEncima)!, color(tema, token))
        expect(r, `${textoEncima} sobre --${token} en tema ${tema}: ${redondear(r)}:1`).toBeGreaterThanOrEqual(AA_TEXTO)
      })
    }
  }
})

describe('las insignias se miden sobre el fondo que de verdad tienen debajo', () => {
  /**
   * El fondo de una insignia es translúcido en el tema oscuro, así que su
   * contraste depende de la superficie de la tarjeta que hay debajo (`--s1`).
   * Medirlo sin componer da un número que nadie ve.
   */
  const COLORES = ['green', 'blue', 'amber', 'red', 'purple', 'gris'] as const
  for (const tema of ['oscuro', 'claro']) {
    for (const c of COLORES) {
      it(`insignia ${c} (${tema})`, () => {
        const texto = color(tema, `badge-${c}-t`)
        const fondo = componer(color(tema, `badge-${c}-b`), color(tema, 's1'))
        const r = contraste(texto, fondo)
        expect(r, `insignia ${c} en tema ${tema}: ${redondear(r)}:1`).toBeGreaterThanOrEqual(AA_TEXTO)
      })
    }
  }
})

describe('el tema claro del sistema operativo se mide igual que el manual', () => {
  it('el bloque de `prefers-color-scheme: light` declara los mismos valores', () => {
    /**
     * Hay DOS caminos al tema claro: el interruptor (`[data-theme="light"]`) y la
     * preferencia del sistema. Están escritos dos veces, y lo que se escribe dos
     * veces se desfasa. Si alguien corrige un token en uno y no en el otro, la
     * mitad de los usuarios se queda con el valor viejo — y son justamente los
     * que nunca tocaron el interruptor.
     */
    const auto = tokensDe(bloque(/@media \(prefers-color-scheme: light\) \{[\s\S]*?:root:not\(\[data-theme="dark"\]\):not\(\[data-theme="light"\]\) \{([\s\S]*?)\n  \}/))
    for (const [token, valor] of Object.entries(CLARO_CRUDO)) {
      expect(auto[token], `--${token} difiere entre el tema claro manual y el automático`).toBe(valor)
    }
  })
})
