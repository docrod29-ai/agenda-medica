/**
 * EL ARNÉS DE LOGO-OFF TIENE QUE OCULTAR ALGO.
 *
 * ── QUÉ FALLABA ─────────────────────────────────────────────────────────────
 *
 * La pasada «logo-off» de la re-puntuación §29 ocultaba
 * `.nx-marca, [data-marca], svg[aria-label*="Ausculta"]`. **Ninguno de los tres
 * existe en este repositorio.** La marca la dibuja `MarcaAusculta` con
 * `aria-hidden` dentro de `.sidebar-logo`, y el nombre del consultorio lo pinta
 * la franja. Resultado: seis capturas llamadas «sin logotipo» que salieron CON
 * el logotipo puesto, y una pregunta de §34 —«¿se reconocería este producto sin
 * su marca?»— contestada sin haber quitado la marca.
 *
 * ── CÓMO SE DESCUBRIÓ ───────────────────────────────────────────────────────
 *
 * Mirando la captura. `pacientes-logo-off.png` traía «Ausculta / Consultorio»
 * en la esquina, entera. Nada falló: el arnés terminó en verde, escribió sus
 * seis PNG y anunció 0 errores de consola.
 *
 * ── LA CAUSA RAÍZ ───────────────────────────────────────────────────────────
 *
 * `addStyleTag` con un selector que no encaja con nada **no es un error**: es
 * CSS válido que no aplica. El arnés pedía una acción y no comprobaba que la
 * acción hubiera ocurrido. Es la misma forma exacta que el `window.scrollTo`
 * de RTC-12 —que scrolleaba la ventana mientras el contenedor con scroll era
 * `<main>`— y la familia de «el dato tiene que LLEGAR»: se dio por entregado en
 * la función que lo emite, sin mirar del otro lado.
 *
 * Cuarta vez en la iteración que el defecto está en el instrumento.
 *
 * ── LA REGLA QUE LO HACE SEGURO ─────────────────────────────────────────────
 *
 * 1. Todo selector del arnés de marca tiene que existir en el código que pinta
 *    la aplicación. Un selector huérfano se detecta aquí, en la suite, y no
 *    seis capturas más tarde.
 * 2. El arnés cuenta en tiempo de ejecución cuántos nodos ocultó y lo escribe
 *    en el acta. Cero nodos se dice en voz alta.
 *
 * Probada al revés: devolviendo `.nx-marca` al selector falla el caso 2;
 * quitando el conteo de `ocultados` falla el caso 3.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · No comprueba que los selectores cubran TODA la marca visible — sólo que los
 *   que hay encajan con algo real. Una marca nueva en una pantalla nueva no la
 *   caza nadie automáticamente.
 * · No corre el navegador: eso lo hace el arnés, que no vive en CI porque
 *   necesita emuladores y build de producción.
 * · No dice nada sobre el score de §29, que es un juicio documentado en
 *   `docs/design/v15/V15-REPUNTUACION-V29.md`, no una aserción.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { globSync } from 'glob'

const ARNES = readFileSync(join(process.cwd(), 'scripts/design/capturar-repuntuacion-v29-v15.mjs'), 'utf8')

/** Los selectores que el arnés declara como «esto es la marca». */
const selectoresDeMarca = (): string[] => {
  const linea = ARNES.match(/const SELECTOR_DE_MARCA = '([^']+)'/)
  expect(linea, 'el arnés ya no declara SELECTOR_DE_MARCA').toBeTruthy()
  return linea![1].split(',').map(s => s.trim()).filter(Boolean)
}

/** El primer trozo del selector que se puede buscar como literal en el fuente. */
const anclaBuscable = (sel: string): string | null => {
  const clase = sel.match(/\.([a-zA-Z0-9_-]+)/)
  if (clase) return clase[1]
  const atributo = sel.match(/\[([a-zA-Z0-9_-]+)/)
  if (atributo) return atributo[1]
  return null
}

/**
 * QUÉ CUENTA COMO «la aplicación», Y POR QUÉ NO ES `src/**`.
 *
 * La primera versión de esta prueba leía `src/**` entero y se leía **a sí
 * misma**: la cabecera de aquí arriba menciona `.nx-marca` para explicar el
 * defecto, así que el selector huérfano se encontraba… en el comentario que
 * cuenta que es huérfano. La prueba pasaba al revés. Es la misma ceguera que
 * `grafo-de-dependencias` tiene escrita y que ya reapareció en el guardián de
 * RTC-10: el lector veía texto donde tenía que ver código.
 *
 * Se mira sólo lo que PINTA la aplicación, y sin comentarios — las líneas `//`
 * antes que los bloques, en ese orden, porque al revés una barra-asterisco
 * dentro de un `//` abre un bloque falso y se come el archivo.
 */
const sinComentarios = (src: string) => src
  .split('\n').filter(l => !l.trimStart().startsWith('//')).join('\n')
  .replace(/\/\*[\s\S]*?\*\//g, '')

const FUENTES = globSync('src/{app,components,hooks}/**/*.{ts,tsx,css}', { cwd: process.cwd() })
  .map(f => sinComentarios(readFileSync(join(process.cwd(), f), 'utf8')))
  .join('\n')

describe('el arnés de logo-off no puede ocultar la nada', () => {
  it('1 · declara sus selectores en un solo sitio', () => {
    expect(selectoresDeMarca().length).toBeGreaterThan(0)
  })

  it('2 · cada selector encaja con algo que existe en la aplicación', () => {
    const huerfanos = selectoresDeMarca().filter(sel => {
      const ancla = anclaBuscable(sel)
      return ancla != null && !FUENTES.includes(ancla)
    })
    expect(
      huerfanos,
      `estos selectores no encajan con nada del código: ${huerfanos.join(' · ')}`,
    ).toEqual([])
  })

  it('3 · el arnés comprueba que el gesto OCURRIÓ, y no sólo que se pidió', () => {
    // Contar los nodos ocultados es la diferencia entre «se aplicó un estilo» y
    // «se ocultó la marca». Sin esto, el arnés vuelve a poder pasar en vacío.
    expect(ARNES).toMatch(/const ocultados = await page\.evaluate/)
    expect(ARNES).toContain('marcasOcultadas[nombre] = ocultados')
    expect(ARNES).toMatch(/ocultados === 0/)
    expect(ARNES).toContain('marcas-ocultadas.json')
  })
})
