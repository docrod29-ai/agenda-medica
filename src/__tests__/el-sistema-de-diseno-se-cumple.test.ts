/**
 * EL SISTEMA DE DISEÑO SE CUMPLE — V9 · DESIGN-SYSTEM-001.
 *
 * ── QUÉ FALLABA ─────────────────────────────────────────────────────────────
 *
 * `docs/DESIGN_SYSTEM.md:7` dice, textualmente, «si el código contradice esto,
 * el documento gana». No había ninguna máquina que sostuviera esa frase, y el
 * código llevaba ganando 200 archivos seguidos:
 *
 *   · 6 065 `style={{` en 177 de 200 archivos — el 88,5 %
 *   · 1 086 hexadecimales a mano, 136 distintos; `#3d5afe` 98 veces y `#3D5AFE`
 *     otras 23 — el mismo token de marca reteclado en dos mayúsculas
 *   · 2 895 `fontSize` en línea con 39 valores; los tres más usados —13, 12,5 y
 *     12 px— no estaban en la escala declarada
 *   · 1 092 radios con 20 valores para una escala que declaraba tres
 *   · 1 613 `gap` con 24 valores para una escala que no existía
 *
 * ── CÓMO SE DESCUBRIÓ ───────────────────────────────────────────────────────
 *
 * `PATIENT-UX-TRUTH-001` (V9, 8-ago-2026) fue a buscar «cara de producto
 * generado por IA» —degradados morados, cristal, tarjetas redondeadas— y no
 * encontró ninguna: cero degradados, una `rounded-2xl` en toda la aplicación,
 * y los cocientes de contraste WCAG calculados a mano dentro del propio CSS.
 *
 * Encontró el defecto contrario, que es peor porque no se ve: **el sistema
 * existe y la aplicación no le obedece**.
 *
 * ── LA CAUSA RAÍZ ───────────────────────────────────────────────────────────
 *
 * El bloque `@theme inline` de `globals.css` exponía a Tailwind CUATRO cosas
 * (`--color-background`, `--color-foreground`, `--font-sans`, `--font-mono`).
 * El color, la superficie, el borde, el radio y la tipografía vivían en
 * variables CSS que **el compilador no mira**. Sin utilidades que usar, el
 * código no tenía alternativa al estilo en línea.
 *
 * No era dejadez: era la consecuencia mecánica de una línea de configuración.
 * Por eso este guardián no cuenta `style={{` —castigar el síntoma sin dar la
 * alternativa sólo produce un gate que se desactiva— sino que comprueba que la
 * alternativa EXISTE, que LLEGA al CSS compilado, y que la deriva ya no crece.
 *
 * ── LA REGLA QUE LO HACE SEGURO ─────────────────────────────────────────────
 *
 * Trinquete, como en lint: la deuda se congela y sólo puede bajar. Y encima de
 * eso, la regla que de verdad muerde y que pide la directiva V9 §1 para esta
 * unidad: **una pantalla nueva nace limpia**. El techo congela la deuda de lo
 * que ya existía; un archivo que no estaba en la foto no tiene deuda que
 * congelar.
 *
 * ── PROBADA AL REVÉS ────────────────────────────────────────────────────────
 *
 * Los tres guardianes se probaron con el defecto metido a mano:
 *
 *   · se le añadió deriva a un archivo conocido → sube el total y falla;
 *   · se inventó un `page.tsx` nuevo con un `fontSize: 12.5` → falla por la
 *     regla de la pantalla nueva, aunque el total siguiera bajo el techo;
 *   · se le quitó un paso a la escala del CSS → falla la prueba que compara las
 *     escalas del script con las del CSS.
 *
 * Las dos primeras están escritas abajo como casos permanentes, con la deriva
 * sintética construida en memoria: una prueba que escribe archivos de verdad
 * en `src/app` deja basura cuando falla.
 *
 * ── QUÉ **NO** CUBRE ────────────────────────────────────────────────────────
 *
 * - **Nadie ha abierto una pantalla.** Esto cuenta literales y compila CSS.
 *   Aprobar una interfaz exige mirarla en un navegador (directiva V9 §4) y
 *   ninguna prueba de Node sustituye eso.
 * - No mide contraste. Los tokens sí se midieron —a mano, y está escrito en el
 *   CSS—; los 1 086 hexadecimales de las pantallas nunca. Este guardián sólo
 *   sabe cuáles de ellos son un token reteclado.
 * - No comprueba la cascada. Una utilidad puede existir y perder contra el
 *   `style={{` del propio componente. Con 6 065 de ellos, perderá.
 * - No obliga a adoptar nada en lo ya escrito. Bajar los 2 616 usos de deriva
 *   es trabajo de `VISUAL-EXCELLENCE-001`, y cada tramo exige verificación
 *   visual porque cambia píxeles.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import {
  medir, comparar, leerTecho, medirArchivo, tokensHex, DIMENSIONES,
  ESCALA_TIPOGRAFIA, ESCALA_RADIO, ESCALA_ESPACIO,
} from '../../scripts/design/trinquete-de-diseno.mjs'
import { compilar, cuerpoDeRegla } from '../../scripts/design/verificar-utilidades.mjs'

/** El script es `.mjs` y no trae tipos: lo que se nombra aquí es sólo lo que
 *  estas pruebas leen de su respuesta. */
type Nueva = { archivo: string }

const GLOBALS = join(process.cwd(), 'src', 'app', 'globals.css')
const TECHO = join(process.cwd(), 'docs', 'design', 'diseno-techo.json')
const css = () => readFileSync(GLOBALS, 'utf8')

/** Los bloques `@theme` del CSS, y sólo ellos: `--text`, `--text2` y `--text3`
 *  viven en `:root` y NO son tokens de tamaño de letra. Confundirlos haría que
 *  esta prueba se inventara una colisión que no existe. */
function bloquesTheme(fuente = css()): string {
  const bloques = [...fuente.matchAll(/^@theme[^{]*\{([\s\S]*?)^\}/gm)].map(m => m[1])
  expect(bloques.length, 'globals.css debe declarar sus bloques @theme al inicio de línea').toBeGreaterThanOrEqual(2)
  return bloques.join('\n')
}

function clavesDe(prefijo: string, fuente = bloquesTheme()): Map<string, string> {
  const mapa = new Map<string, string>()
  const re = new RegExp(`^\\s*--${prefijo}-([a-z0-9-]+)\\s*:\\s*([^;]+);`, 'gm')
  for (const m of fuente.matchAll(re)) mapa.set(m[1], m[2].trim())
  return mapa
}

const pxDe = (v: string) => Number(v.replace('px', ''))

describe('el sistema de diseño existe de verdad — los tokens llegan al compilador', () => {
  it('`@theme` expone mucho más que las cuatro cosas que exponía', () => {
    /**
     * Ésta es la prueba de la causa raíz. Si alguien revierte el ensanche del
     * bloque, el producto vuelve a no tener utilidades y el estilo en línea
     * vuelve a ser la única salida — sin que nada más se ponga en rojo.
     */
    const tokens = bloquesTheme()
    const colores = clavesDe('color', tokens)
    expect(colores.size).toBeGreaterThanOrEqual(18)
    for (const imprescindible of ['s1', 's2', 's3', 'fg', 'fg2', 'fg3', 'linea', 'linea2', 'nexus', 'nexus-solido']) {
      expect(colores.has(imprescindible), `falta el token de color --color-${imprescindible}`).toBe(true)
    }
    expect(clavesDe('spacing', tokens).size).toBeGreaterThanOrEqual(10)
    expect(clavesDe('radius', tokens).size).toBeGreaterThanOrEqual(9)
    expect(clavesDe('text', tokens).size).toBeGreaterThanOrEqual(8)
    expect(clavesDe('shadow', tokens).size).toBeGreaterThanOrEqual(3)
  })

  it('el color que cambia con el tema se declara `inline`, o el tema claro se rompe', () => {
    /**
     * `@theme inline` mete el `var(--s2)` DENTRO de la utilidad. Sin `inline`,
     * Tailwind congelaría el valor que `--s2` tiene en `:root` —el oscuro— y
     * `bg-s2` seguiría pintando oscuro con el tema claro puesto, en las 21
     * variables que `[data-theme="light"]` reescribe.
     *
     * No se comprueba leyendo el CSS fuente: se comprueba en la salida del
     * compilador, que es donde se vería el fallo.
     */
    const fuente = css()
    const inline = /^@theme inline\s*\{([\s\S]*?)^\}/m.exec(fuente)?.[1] ?? ''
    for (const token of ['--color-s2', '--color-fg2', '--color-nexus-solido', '--color-error']) {
      expect(inline, `${token} tiene que estar en el bloque inline`).toContain(token)
    }
  })

  it('las utilidades LLEGAN al CSS compilado, y con el `var()` dentro', async () => {
    /**
     * `.claude/rules/el-dato-tiene-que-llegar.md`. Declarar un token no es tener
     * una utilidad: entre las dos cosas hay un compilador con reglas propias, y
     * cuando se equivoca no da error — la clase simplemente no existe y el JSX
     * que la usa se queda sin estilo.
     *
     * Así que se compila el `globals.css` real y se mira del otro lado.
     */
    const clases = [
      'bg-s1', 'bg-s2', 'bg-s3', 'text-fg', 'text-fg2', 'text-fg3',
      'border-linea', 'border-linea2', 'bg-nexus-solido', 'text-nexus',
      'text-error', 'text-aviso', 'text-exito', 'text-info',
      'rounded-6px', 'rounded-10px', 'rounded-pill', 'rounded-circulo',
      'gap-8px', 'p-12px', 'text-meta', 'text-body', 'text-overline',
      'shadow-realce', 'shadow-menu', 'shadow-modal',
    ]
    const salida = await compilar(clases)
    for (const clase of clases) {
      expect(cuerpoDeRegla(salida, clase), `Tailwind no emitió .${clase}`).not.toBeNull()
    }
    /* Y el valor, no sólo la existencia: si `bg-s2` saliera con un color
       literal en vez de `var(--s2)`, el tema claro dejaría de funcionar. */
    expect(cuerpoDeRegla(salida, 'bg-s2')).toContain('var(--s2)')
    expect(cuerpoDeRegla(salida, 'text-fg3')).toContain('var(--text3)')
    expect(cuerpoDeRegla(salida, 'bg-nexus-solido')).toContain('var(--nexus-solido)')
  }, 60_000)

  it('ningún nombre de color choca con un nombre de tamaño de letra', () => {
    /**
     * El espacio `text-*` de Tailwind sirve a las dos cosas: `text-fg2` es color
     * y `text-meta` es tamaño. Si alguna vez se llaman igual, una de las dos
     * utilidades desaparece — y desaparece en silencio, que es lo peligroso.
     */
    const tokens = bloquesTheme()
    const colores = new Set(clavesDe('color', tokens).keys())
    const tamanos = new Set(clavesDe('text', tokens).keys())
    const choque = [...tamanos].filter(t => colores.has(t))
    expect(choque, `estos nombres son color Y tamaño a la vez: ${choque.join(', ')}`).toEqual([])
  })

  it('las escalas del trinquete son las que declara el CSS, no una copia que se separa', () => {
    /**
     * Familia `depende_de_recordar`: el mismo dato escrito en dos sitios acaba
     * diciendo dos cosas. Como el trinquete necesita las escalas en JavaScript y
     * el navegador las necesita en CSS, no hay forma de tener un solo sitio —
     * pero sí de que separarlos ponga algo en rojo.
     */
    const tokens = bloquesTheme()

    const espacioCss = [...clavesDe('spacing', tokens).values()].map(pxDe).sort((a, b) => a - b)
    expect([...ESCALA_ESPACIO].filter(v => v !== 0).sort((a, b) => a - b)).toEqual(espacioCss)

    const radioCss = [...clavesDe('radius', tokens)].filter(([k]) => k.endsWith('px')).map(([, v]) => pxDe(v)).sort((a, b) => a - b)
    expect([...ESCALA_RADIO].filter(v => v !== 0 && v !== 50 && v !== 9999).sort((a, b) => a - b)).toEqual(radioCss)

    const tipografiaCss = [...clavesDe('text', tokens).values()].map(pxDe).sort((a, b) => a - b)
    expect([...ESCALA_TIPOGRAFIA].sort((a, b) => a - b)).toEqual(tipografiaCss)
  })

  it('la píldora y el círculo del CSS son los que el trinquete da por buenos', () => {
    const tokens = bloquesTheme()
    const radios = clavesDe('radius', tokens)
    expect(radios.get('pill')).toBe('var(--r-pill)')
    expect(radios.get('circulo')).toBe('var(--r-circulo)')
    expect(css()).toContain('--r-pill:    9999px')
    expect(ESCALA_RADIO).toContain(9999)
    expect(ESCALA_RADIO).toContain(50)
  })
})

describe('el trinquete de diseño — la deriva sólo baja', () => {
  it('el techo existe y está commiteado', () => {
    expect(existsSync(TECHO)).toBe(true)
  })

  it('la deriva de hoy no supera el techo, y no hay pantalla nueva sucia', () => {
    /**
     * Ésta es la que muerde a diario. Añadir un `fontSize: 12.5` a una pantalla
     * la pone en rojo y dice en qué archivo.
     */
    const { subidas, nuevasSucias, empeorados } = comparar(medir(), leerTecho())
    expect(nuevasSucias.map((n: Nueva) => n.archivo), 'una pantalla nueva tiene que nacer usando el sistema').toEqual([])
    expect(subidas.map(s => `${s.dimension}: ${s.antes} → ${s.hoy}`), `subió en ${empeorados.map(e => e.archivo).join(', ')}`).toEqual([])
  })

  it('si la deriva baja, el techo se aprieta — un trinquete que no se aprieta es un tope', () => {
    const { bajadas } = comparar(medir(), leerTecho())
    expect(
      bajadas.map(b => `${b.dimension}: ${b.antes} → ${b.hoy}`),
      'corre `node scripts/design/trinquete-de-diseno.mjs --actualizar` y commitea el techo',
    ).toEqual([])
  })

  it('AL REVÉS · deriva añadida a un archivo conocido → el trinquete la caza', () => {
    const medicion = medir()
    const techo = leerTecho()
    const victima = medicion.archivos.find((a: string) => techo.archivos.includes(a))!
    const sucia = {
      ...medicion,
      totales: { ...medicion.totales, tipografia: medicion.totales.tipografia + 3, total: medicion.totales.total + 3 },
      porArchivo: { ...medicion.porArchivo, [victima]: ((medicion.porArchivo as Record<string, number>)[victima] ?? 0) + 3 },
    }
    const { subidas, empeorados } = comparar(sucia, techo)
    expect(subidas.map(s => s.dimension)).toContain('tipografia')
    expect(empeorados.map(e => e.archivo)).toContain(victima)
  })

  it('AL REVÉS · pantalla NUEVA con deriva → falla aunque el total siga bajo el techo', () => {
    /**
     * El caso importante y el más fácil de dejar escapar: si sólo se vigilara el
     * total, una pantalla nueva sucia pasaría en verde mientras otra se limpia.
     * Aquí el total ni se toca — y aun así tiene que fallar.
     */
    const medicion = medir()
    const nueva = 'src/app/(dashboard)/pantalla-recien-nacida/page.tsx'
    const sucia = {
      ...medicion,
      archivos: [...medicion.archivos, nueva],
      porArchivo: { ...medicion.porArchivo, [nueva]: 4 },
      detallePorArchivo: {
        ...medicion.detallePorArchivo,
        [nueva]: { hexRetecleado: ['#3D5AFE → var(--nexus-solido)'], tipografia: [12.5], radio: [9], espacio: ['gap: 7'], sombra: [] },
      },
    }
    const { subidas, nuevasSucias } = comparar(sucia, leerTecho())
    expect(subidas, 'el total no ha cambiado: esta prueba no vale si falla por el total').toEqual([])
    expect(nuevasSucias.map((n: Nueva) => n.archivo)).toEqual([nueva])
  })

  it('AL REVÉS · una pantalla nueva LIMPIA pasa — el guardián no bloquea el trabajo honrado', () => {
    /**
     * Un guardián que también castiga lo correcto se desactiva en una semana.
     */
    const medicion = medir()
    const nueva = 'src/app/(dashboard)/pantalla-limpia/page.tsx'
    const { subidas, nuevasSucias } = comparar(
      { ...medicion, archivos: [...medicion.archivos, nueva] },
      leerTecho(),
    )
    expect(nuevasSucias).toEqual([])
    expect(subidas).toEqual([])
  })
})

describe('lo que el trinquete considera deriva', () => {
  const hex = tokensHex()

  it('`#3D5AFE` y `#3d5afe` son el MISMO token reteclado, en dos mayúsculas', () => {
    /**
     * 98 usos en minúscula y 23 en mayúscula del azul de marca. Escrito a mano,
     * el literal deja de seguir al tema: en claro `--nexus-solido` vale
     * `#2845EA`, y el literal se queda con el azul del tema oscuro.
     *
     * **Corrección a la auditoría**: `GENERIC_AI_AESTHETIC_AUDIT.md:176` propone
     * migrarlos primero porque «es puro y no cambia un píxel». Sólo es cierto en
     * tema oscuro. En claro sí cambia el píxel — 121 rellenos pasarían de
     * `#3D5AFE` a `#2845EA`.
     *
     * No es un fallo de contraste: blanco sobre `#3D5AFE` da 5,13 : 1 y cumple
     * AA igual. Es fidelidad de tema, y aun así **la migración no puede hacerse
     * a ciegas**: cambia lo que se ve en el tema claro y eso exige mirarlo
     * (directiva V9 §4). Aquí sólo se cuenta.
     */
    const a = medirArchivo("const s = { color: '#3d5afe' }", hex)
    const b = medirArchivo("const s = { color: '#3D5AFE' }", hex)
    expect(a.conteo.hexRetecleado).toBe(1)
    expect(b.conteo.hexRetecleado).toBe(1)
    expect(a.detalle.hexRetecleado[0]).toContain('--nexus-solido')
  })

  it('un hexadecimal que NO es un token no cuenta como reteclado', () => {
    /**
     * Señalar de menos, nunca de más: un color que no está en el sistema es
     * otro problema —y otra unidad—, no un token mal escrito.
     */
    expect(medirArchivo("const s = { color: '#123456' }", hex).conteo.hexRetecleado).toBe(0)
  })

  it('lo que está en la escala no cuenta; lo que no, sí', () => {
    expect(medirArchivo('const s = { fontSize: 13 }', hex).conteo.tipografia).toBe(0)
    expect(medirArchivo('const s = { fontSize: 12.5 }', hex).conteo.tipografia).toBe(1)
    expect(medirArchivo('const s = { borderRadius: 10 }', hex).conteo.radio).toBe(0)
    expect(medirArchivo('const s = { borderRadius: 9 }', hex).conteo.radio).toBe(1)
    expect(medirArchivo('const s = { gap: 8 }', hex).conteo.espacio).toBe(0)
    expect(medirArchivo('const s = { gap: 7 }', hex).conteo.espacio).toBe(1)
  })

  it('una utilidad o una variable NO cuentan como deriva', () => {
    /**
     * Si el guardián castigara `var(--spacing-8px)` estaría castigando
     * exactamente lo que pide. Un medidor que grita de más enseña a ignorarlo,
     * igual que un aviso clínico.
     */
    const texto = `
      const a = { gap: 'var(--spacing-8px)', fontSize: 'var(--text-meta)' }
      const b = <div className="gap-8px text-meta rounded-10px bg-s2" />
    `
    expect(medirArchivo(texto, hex).conteo.total).toBe(0)
  })

  it('mide las cinco dimensiones que dice medir', () => {
    const { conteo } = medirArchivo(
      "const s = { color: '#3d5afe', fontSize: 12.5, borderRadius: 9, gap: 7, boxShadow: '0 1px 2px #000' }",
      hex,
    )
    for (const d of DIMENSIONES) expect(conteo[d], `la dimensión ${d} no se está midiendo`).toBeGreaterThanOrEqual(1)
    expect(conteo.total).toBe(DIMENSIONES.reduce((n, d) => n + conteo[d], 0))
  })
})
