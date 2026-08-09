/**
 * EL CONTRASTE NO SE APRUEBA A OJO — V9 · DESIGN-SYSTEM-001 · REG-291.
 *
 * ── QUÉ FALLABA ─────────────────────────────────────────────────────────────
 *
 * `globals.css` documenta, con la fórmula WCAG escrita a mano, que `--nexus` se
 * aclaró a #6E84FE para leerse COMO TEXTO sobre fondo oscuro, y que usado de
 * RELLENO bajo texto blanco daba **3,28 : 1** — reprueba AA, que pide 4,5. Para
 * eso nació `--nexus-solido` (#3D5AFE, blanco encima = 5,13), y se aplicó a
 * `.btn-primary`.
 *
 * La misma pareja vivía en **21 sitios más**, en `style={{ }}`, donde ninguna
 * hoja de estilo llega: los selectores de plan de la portada, los filtros de
 * pacientes, las pestañas de UCI, el botón de enviar del chat, el alta del
 * consultorio. Y con ella, tres primas de la misma familia:
 *
 *   · blanco sobre `--red`   → 3,30      · blanco sobre `#10b981` → 2,54
 *   · blanco sobre `#25D366` → **1,98**  (el botón de WhatsApp: casi ilegible)
 *   · blanco sobre `--s3` en tema claro → **1,20** (botones desactivados: el
 *     texto simplemente no estaba)
 *   · `--text3` sobre `--s3` en tema claro → 4,20, **con un comentario al lado
 *     que afirmaba «AA sobre --s3»**. Nadie lo había medido ahí.
 *
 * 48 parejas en 22 archivos, todas por debajo de AA, todas en verde.
 *
 * ── CÓMO SE DESCUBRIÓ ───────────────────────────────────────────────────────
 *
 * No mirando pantallas: **calculándolas**. Un cociente de contraste no es una
 * opinión, es una división. `scripts/design/contraste-en-linea.mjs` lee los
 * tokens de los dos temas de `globals.css`, empareja `background` y `color`
 * dentro del mismo objeto de estilo y aplica la fórmula de luminancia relativa
 * de WCAG 2.1.
 *
 * ── LA CAUSA RAÍZ QUE SE ATACA ──────────────────────────────────────────────
 *
 * **La corrección se aplicó donde miró la búsqueda.** Quien arregló el relleno
 * de marca buscó `.btn-primary`, lo arregló bien y lo documentó mejor — y el
 * mismo defecto siguió vivo en el estilo en línea, que es donde vive el 88 % de
 * esta interfaz. Es la familia que este repositorio ya conoce: media defensa.
 *
 * Y la segunda causa, más fina: **un contraste escrito en un comentario no es
 * un contraste medido**. `--text3` decía cumplir sobre `--s3` y no cumplía.
 *
 * ── LA REGLA QUE LO HACE SEGURO ─────────────────────────────────────────────
 *
 * El techo está en **CERO**: no hay deuda congelada que perdonar. Cualquier
 * pareja nueva por debajo de 4,5:1 hace fallar la compuerta, en cualquiera de
 * los dos temas. Los rellenos tienen su token con la cuenta hecha —
 * `--nexus-solido`, `--red-solido`, `--green-solido`, `--amber-solido`,
 * `--whatsapp` + `--whatsapp-t` — y ninguno cambia con el tema, para que el
 * contraste no haya que comprobarlo dos veces.
 *
 * ── QUÉ **NO** CUBRE ────────────────────────────────────────────────────────
 *
 *  · Colores translúcidos (`rgba`, `color-mix`): dependen de lo que haya
 *    detrás, y eso no se sabe leyendo un archivo.
 *  · Color heredado: si el `color` no está en el mismo objeto que el
 *    `background`, no se empareja.
 *  · Las clases de `globals.css`. Esto sólo mira `style={{ }}`.
 *  · Texto grande, al que AA le pide 3:1 — aquí se exige 4,5 a todo. Más
 *    estricto, nunca más laxo.
 *  · Que la pantalla se vea bien. Esto mide una razón matemática; **nadie ha
 *    abierto un navegador**, y la directiva V9 §4 dice que no se aprueba
 *    interfaz leyendo código. Lo que esta prueba garantiza es que no se aprueba
 *    interfaz **ilegible**.
 */
import { describe, it, expect } from 'vitest'
import { mkdtempSync, writeFileSync, rmSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execSync } from 'node:child_process'
import { analizar, leerTemas, contraste, aRgb } from '../../scripts/design/contraste-en-linea.mjs'

const CSS_REAL = 'src/app/globals.css'

/** Un archivo .tsx de mentira, para probar el guardián al revés. */
function conFuente(codigo: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'contraste-'))
  const ruta = join(dir, 'pantalla.tsx')
  writeFileSync(ruta, codigo)
  return ruta
}

describe('la fórmula', () => {
  it('reproduce los cocientes que globals.css afirma haber medido a mano', () => {
    // Los tres números que el propio CSS escribió. Si la fórmula estuviera mal,
    // todo lo demás de este archivo mediría con una regla torcida.
    expect(contraste(aRgb('#ffffff')!, aRgb('#6E84FE')!)).toBeCloseTo(3.28, 1)
    expect(contraste(aRgb('#ffffff')!, aRgb('#3D5AFE')!)).toBeCloseTo(5.13, 1)
    expect(contraste(aRgb('#ffffff')!, aRgb('#2845EA')!)).toBeCloseTo(6.71, 1)
  })

  it('las cifras que globals.css escribe sobre los tokens nuevos son las medidas', () => {
    /*
      Escribir un cociente en un comentario sin haberlo dividido es exactamente
      el defecto que trajo aquí `--text3` («AA sobre --s3», y daba 4,20). Al
      redactar este mismo arreglo se colaron tres cifras a ojo —2,15 / 9,93 /
      4,79— que no eran las reales. Así que las cifras documentadas se fijan
      aquí: si alguien cambia un token y no la cuenta, esto falla.
    */
    const blanco = aRgb('#ffffff')!
    const documentado: Array<[string, string, number]> = [
      ['blanco sobre --red', '#E66464', 3.30],
      ['blanco sobre --green', '#1BA34D', 3.29],
      ['blanco sobre --amber', '#D97706', 3.19],
      ['blanco sobre --red-solido', '#B91C1C', 6.47],
      ['blanco sobre --green-solido', '#14532D', 9.11],
      ['blanco sobre --amber-solido', '#92400E', 7.09],
    ]
    for (const [que, color, esperado] of documentado) {
      expect(contraste(blanco, aRgb(color)!), que).toBeCloseTo(esperado, 1)
    }
    expect(contraste(aRgb('#0B0C0E')!, aRgb('#25D366')!), 'tinta sobre WhatsApp').toBeCloseTo(9.87, 1)
    expect(contraste(blanco, aRgb('#25D366')!), 'blanco sobre WhatsApp').toBeCloseTo(1.98, 1)

    const claro = leerTemas(CSS_REAL).claro
    expect(contraste(claro['--text3'], claro['--s3']), '--text3 sobre --s3 en claro').toBeCloseTo(4.80, 1)
  })

  it('los tokens de relleno nuevos pasan AA con blanco encima, en los dos temas', () => {
    const temas = leerTemas(CSS_REAL)
    for (const tema of ['oscuro', 'claro'] as const) {
      for (const token of ['--nexus-solido', '--red-solido', '--green-solido', '--amber-solido']) {
        const relleno = temas[tema][token]
        expect(relleno, `${token} no existe en el tema ${tema}`).toBeTruthy()
        expect(contraste(aRgb('#ffffff')!, relleno), `${token} en ${tema}`).toBeGreaterThanOrEqual(4.5)
      }
      // WhatsApp conserva su verde de marca; lo que cambia es la tinta.
      expect(contraste(temas[tema]['--whatsapp-t'], temas[tema]['--whatsapp'])).toBeGreaterThanOrEqual(4.5)
    }
  })
})

describe('el guardián, al revés', () => {
  const temas = leerTemas(CSS_REAL)

  it('CAZA el defecto original: relleno de marca con texto blanco', () => {
    const ruta = conFuente(`export const X = () => <button style={{ background: 'var(--nexus)', color: '#fff' }}>Guardar</button>`)
    const hallazgos = analizar([ruta], temas)
    rmSync(ruta, { force: true })
    expect(hallazgos.length).toBeGreaterThan(0)
    expect(hallazgos[0].razon).toBeLessThan(4.5)
  })

  it('CAZA las dos ramas de un mismo ternario, cada una con su pareja', () => {
    const ruta = conFuente(
      `export const X = () => <button style={{ background: on ? 'var(--nexus)' : 'var(--s1)', color: on ? '#fff' : 'var(--text)' }}>x</button>`,
    )
    const hallazgos = analizar([ruta], temas)
    rmSync(ruta, { force: true })
    // Sólo la rama encendida reprueba; la apagada (--text sobre --s1) cumple de sobra.
    expect(hallazgos).toHaveLength(1)
    expect(hallazgos[0].fondo).toBe('var(--nexus)')
  })

  it('APRUEBA el arreglo: el mismo botón con el token de relleno', () => {
    const ruta = conFuente(`export const X = () => <button style={{ background: 'var(--nexus-solido)', color: '#fff' }}>Guardar</button>`)
    const hallazgos = analizar([ruta], temas)
    rmSync(ruta, { force: true })
    expect(hallazgos).toEqual([])
  })

  it('NO acusa cuando las ramas no se pintan juntas — el falso positivo que casi se cuela', () => {
    /*
      Esto es una burbuja de chat real (`chat/page.tsx`): el fondo tiene una
      rama literal y otra que viene de una variable. La primera versión del
      medidor emparejaba «el único fondo literal» con TODOS los textos, y
      acusaba de 1,08:1 a una burbuja que se ve perfectamente. Una compuerta que
      acusa en falso se marca como ruido y deja de proteger — así que esto se
      calla, y lo declara.
    */
    const ruta = conFuente(
      `export const X = () => <div style={{ background: mio ? rolColor : 'var(--s1)', color: mio ? '#040b12' : 'var(--text)' }}>x</div>`,
    )
    const hallazgos = analizar([ruta], temas)
    rmSync(ruta, { force: true })
    expect(hallazgos).toEqual([])
  })
})

describe('los tokens de globals.css se leen de verdad', () => {
  it('un comentario que menciona un token NO se lee como si lo declarara', () => {
    /*
      REGRESIÓN DEL PROPIO MEDIDOR. El bloque claro se documenta a sí mismo con
      la frase «2.74:1 sobre --s3: NO cumplía». Sin quitar comentarios, `--s3:`
      casa con la expresión y se traga el texto hasta el siguiente `;`, que es
      la declaración real de `--text3`. Resultado: `--text3` del tema claro no
      se leía, heredaba el valor oscuro, y la compuerta acusaba a decenas de
      pantallas que cumplen.
    */
    const dir = mkdtempSync(join(tmpdir(), 'css-'))
    const ruta = join(dir, 'g.css')
    writeFileSync(ruta, `:root { --s1: #000000; }\n:root[data-theme="light"] {\n  /* 2.74:1 sobre --s3: NO cumplía nada de nada */\n  --text3: #62666C;\n}\n`)
    const temas = leerTemas(ruta)
    rmSync(dir, { recursive: true, force: true })
    expect(temas.claro['--text3']).toEqual({ r: 0x62, g: 0x66, b: 0x6c })
  })

  it('los dos bloques de tema claro declaran exactamente lo mismo', () => {
    /*
      El tema claro se declara DOS veces: por atributo (`[data-theme="light"]`,
      el interruptor) y por preferencia del sistema (`prefers-color-scheme`).
      Corregir uno y olvidar el otro ya pasó —así nació el defecto de contraste
      de `--text3`, aplicado sólo a un lado— y no se nota, porque cada usuario
      ve sólo uno de los dos caminos.
    */
    const css = execSync(`cat ${CSS_REAL}`, { encoding: 'utf8' }).replace(/\/\*[\s\S]*?\*\//g, '')
    const bloque = (desde: number) => {
      const abre = css.indexOf('{', desde)
      let n = 0, i = abre
      for (; i < css.length; i++) {
        if (css[i] === '{') n++
        else if (css[i] === '}') { n--; if (!n) break }
      }
      return Object.fromEntries(
        [...css.slice(abre + 1, i).matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/gi)].map(m => [m[1], m[2].trim()]),
      )
    }
    const porAtributo = bloque(css.indexOf(':root[data-theme="light"]'))
    const iMedia = css.indexOf('@media (prefers-color-scheme: light)')
    const porPreferencia = bloque(css.indexOf(':root:not([data-theme="dark"]):not([data-theme="light"])', iMedia))
    expect(Object.keys(porAtributo).length).toBeGreaterThan(20)
    expect(porPreferencia).toEqual(porAtributo)
  })
})

describe('la compuerta sobre el repositorio real', () => {
  it('ninguna pareja de estilo en línea baja de 4,5:1 en ninguno de los dos temas', () => {
    const archivos = execSync("git ls-files 'src/app/**/*.tsx' 'src/components/**/*.tsx'", {
      encoding: 'utf8', maxBuffer: 32 * 1024 * 1024,
    }).split('\n').filter(Boolean)
    expect(archivos.length).toBeGreaterThan(100)

    const hallazgos = analizar(archivos, leerTemas(CSS_REAL))
    const detalle = hallazgos
      .map(h => `${h.archivo}:${h.linea} · ${h.tema} · «${h.texto}» sobre «${h.fondo}» = ${h.razon}:1`)
      .join('\n')

    /*
      El límite lo pone el techo en disco, no un número escrito aquí: si un día
      se congela una deuda con su razón, esta prueba y `contraste-en-linea.mjs`
      tienen que decir lo mismo. Dos sitios con el mismo criterio escrito a mano
      se separan; ya pasó con el tablero del loop (REG-241).
    */
    const techo = JSON.parse(readFileSync('docs/design/contraste-techo.json', 'utf8'))
    expect(techo.minimo).toBe(4.5)
    if (techo.total === 0) expect(detalle).toBe('')
    expect(hallazgos.length).toBeLessThanOrEqual(techo.total)
  })
})
