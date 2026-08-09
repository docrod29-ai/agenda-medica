/**
 * GOLDEN — V9 · A11Y-GATE-001 · la accesibilidad deja de no medirse.
 *
 * ── QUÉ FALLABA ──────────────────────────────────────────────────────────────
 *
 * Nada, y ése era el problema: **no había red**. La auditoría de V9 lo contó —
 * **1** prueba de accesibilidad entre 566, y es una expresión regular sobre
 * `layout.tsx`. `next/core-web-vitals` enciende seis reglas, todas sobre
 * atributos ARIA, y ninguna mira los dos mínimos que
 * `.claude/rules/design-system.md` nombra como fallo de compuerta y que sí se
 * pueden ver sin navegador: **un control interactivo que no es `<button>`** y
 * **un campo sin etiqueta**.
 *
 * Medido al encender el conjunto recomendado: **211 avisos en 46 archivos**, de
 * los cuales 37 son controles que el teclado no puede pulsar.
 *
 * ── CÓMO SE DESCUBRIÓ ────────────────────────────────────────────────────────
 *
 * `docs/design/GENERIC_AI_AESTHETIC_AUDIT.md`, hallazgo P1: «nada obliga a
 * nada — `eslint.config.mjs` son 18 líneas, sin `jsx-a11y`». Y el documento de
 * sistema de diseño decía «si el código contradice esto, el documento gana»,
 * sin máquina que lo sostuviera.
 *
 * ── LA REGLA QUE LO HACE SEGURO ──────────────────────────────────────────────
 *
 * Las reglas van en **AVISO**, no en error: `lint-trinquete.mjs` cuenta errores
 * contra un techo de 96 que lleva meses funcionando, y meterle 211 hallazgos lo
 * reventaría. Un gate que nace en rojo acaba en `continue-on-error`.
 *
 * Y el techo es **por regla**, no un total. Un total deja pasar el peor caso:
 * arreglar 20 etiquetas y meter 15 `<div onClick>` bajaría el número y dejaría
 * la aplicación menos accesible. Un `<div onClick>` no lo puede pulsar quien
 * navega con teclado; una etiqueta suelta se lee mal pero se pulsa. No son
 * intercambiables, así que no se suman.
 *
 * ── QUÉ NO CUBRE ─────────────────────────────────────────────────────────────
 *
 * Es análisis estático de JSX. De los siete mínimos de la regla de diseño cubre
 * **dos**. Los otros cinco —contraste real, foco visible, atrapado de foco en un
 * modal, cierre con Escape, objetivo táctil de 44×44— **necesitan el producto
 * corriendo con `axe`**, y este contenedor no tiene credenciales de Firebase.
 * Esa es la otra mitad de `A11Y-GATE-001` y sigue abierta.
 *
 * Tampoco mira si la etiqueta DICE algo: `aria-label="botón"` pasa.
 *
 * Y no prueba que ninguna pantalla sea accesible. Prueba que **la deuda no
 * crece**, que es una afirmación mucho más pequeña y la única que hoy se
 * sostiene.
 *
 * ── ESTE ARCHIVO NO CORRE ESLINT ─────────────────────────────────────────────
 *
 * Analizar `src` entero tarda ~40 s y metería eso en cada `vitest run`. La
 * MEDICIÓN la hace `node scripts/design/trinquete-a11y.mjs`, que es una
 * compuerta aparte igual que `lint-trinquete`. Aquí se comprueba lo que sí es
 * barato y sí se pudre solo: que el techo exista y esté bien formado, que el
 * comparador de verdad compare, y que las reglas sigan encendidas — porque un
 * techo con las reglas apagadas mide cero y aplaude el apagón.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { comparar, TECHO } from '../../scripts/design/trinquete-a11y.mjs'

const techo = JSON.parse(readFileSync(join(process.cwd(), TECHO), 'utf8'))

describe('el techo de accesibilidad', () => {
  it('existe, y dice que sólo puede bajar', () => {
    expect(existsSync(join(process.cwd(), TECHO))).toBe(true)
    expect(techo.porQue).toMatch(/BAJAR/)
  })

  it('es POR REGLA, no un total suelto', () => {
    // Un total deja canjear una etiqueta por un `<div onClick>`.
    expect(Object.keys(techo.porRegla ?? {}).length).toBeGreaterThan(1)
    const porRegla = techo.porRegla as Record<string, number>
    expect(Object.values(porRegla).reduce((a, b) => a + b, 0)).toBe(techo.total)
  })

  it('vigila los dos mínimos de la regla de diseño que se ven sin navegador', () => {
    const reglas = Object.keys(techo.porRegla)
    // «campo sin etiqueta» y «control interactivo que no es <button>».
    expect(reglas).toContain('jsx-a11y/label-has-associated-control')
    expect(reglas.some(r => r === 'jsx-a11y/click-events-have-key-events'
      || r === 'jsx-a11y/no-static-element-interactions')).toBe(true)
  })
})

/**
 * PROBADO AL REVÉS. Sin estos dos casos, `comparar` podría devolver siempre
 * listas vacías y el gate pasaría para siempre sin comprobar nada.
 */
describe('el comparador de verdad compara', () => {
  const base = { total: techo.total, porRegla: { ...techo.porRegla }, porArchivo: {} }

  it('DETECTA que una regla subió', () => {
    const peor = { ...base, porRegla: { ...base.porRegla, 'jsx-a11y/click-events-have-key-events': (base.porRegla['jsx-a11y/click-events-have-key-events'] ?? 0) + 1 } }
    expect(comparar(peor, techo).subieron).toEqual([{
      regla: 'jsx-a11y/click-events-have-key-events',
      tope: base.porRegla['jsx-a11y/click-events-have-key-events'],
      hoy: base.porRegla['jsx-a11y/click-events-have-key-events'] + 1,
    }])
  })

  it('DETECTA que una regla bajó, para poder apretar el trinquete', () => {
    const r = 'jsx-a11y/label-has-associated-control'
    const mejor = { ...base, porRegla: { ...base.porRegla, [r]: base.porRegla[r] - 5 } }
    expect(comparar(mejor, techo).bajaron).toEqual([{ regla: r, tope: base.porRegla[r], hoy: base.porRegla[r] - 5 }])
  })

  it('una regla que DESAPARECE del informe cuenta como cero, no como ausente', () => {
    // Si no, borrar la regla de `eslint.config.mjs` pasaría por «arreglado»:
    // el gate se apagaría solo y diría que todo está bien.
    const sinRegla = { ...base, porRegla: Object.fromEntries(
      Object.entries(base.porRegla).filter(([k]) => k !== 'jsx-a11y/no-autofocus')) }
    const { bajaron } = comparar(sinRegla, techo)
    expect(bajaron.map(b => b.regla)).toContain('jsx-a11y/no-autofocus')
  })

  it('no canjea una regla por otra', () => {
    // 20 etiquetas menos y 15 `<div onClick>` más: el total baja y la
    // aplicación es MENOS accesible. Tiene que fallar igual.
    const canje = { ...base, porRegla: {
      ...base.porRegla,
      'jsx-a11y/label-has-associated-control': base.porRegla['jsx-a11y/label-has-associated-control'] - 20,
      'jsx-a11y/click-events-have-key-events': base.porRegla['jsx-a11y/click-events-have-key-events'] + 15,
    } }
    expect(comparar(canje, techo).subieron.map(s => s.regla)).toEqual(['jsx-a11y/click-events-have-key-events'])
  })
})

/**
 * Y QUE LAS REGLAS SIGAN ENCENDIDAS. El techo no protege nada si mañana alguien
 * quita el bloque de `eslint.config.mjs`: el informe saldría en cero y el
 * trinquete pediría apretarse hasta cero, aplaudiendo el apagón.
 */
describe('las reglas están encendidas donde deben', () => {
  const cfg = readFileSync(join(process.cwd(), 'eslint.config.mjs'), 'utf8')

  it('el conjunto recomendado del plugin se aplica a las pantallas', () => {
    expect(cfg).toContain('eslint-plugin-jsx-a11y')
    expect(cfg).toContain('jsxA11y.configs.recommended.rules')
    expect(cfg).toMatch(/files:\s*\["src\/\*\*\/\*\.tsx"\]/)
  })

  it('en AVISO, para no reventar el trinquete de lint', () => {
    expect(cfg).toContain('"warn"')
  })

  it('respeta lo que el propio plugin apaga', () => {
    // Encender a mano `label-has-for` (obsoleta) y `control-has-associated-label`
    // añadía 596 avisos que el plugin considera ruido. Un medidor que grita de
    // más se aprende a ignorar: REG-245.
    expect(cfg).toMatch(/apagada/)
  })

  it('el plugin es una dependencia DECLARADA, no una que llega de rebote', () => {
    // Llegaba como dependencia transitiva de `eslint-config-next`. Importar algo
    // que nadie declaró es un gate que se apaga el día que la de arriba cambie.
    const pkg = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8'))
    expect(pkg.devDependencies['eslint-plugin-jsx-a11y']).toBeTruthy()
  })
})
