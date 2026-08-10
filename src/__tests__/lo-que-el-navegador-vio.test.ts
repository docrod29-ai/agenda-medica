/**
 * LO QUE EL NAVEGADOR VIO — REG-233 · I-13 del loop.
 *
 * ── DE DÓNDE SALE ───────────────────────────────────────────────────────────
 *
 * «utiliza Google Chrome y navega por toda la app para detectar conflictos,
 * problemas, errores». Barrido de las catorce pantallas públicas con un iPhone
 * emulado. Ninguno de los tres hallazgos era visible desde el código.
 *
 * ── 1. MI PROPIO GUARDIÁN ERA DEMASIADO ESTRECHO ────────────────────────────
 *
 * En v1104 se reparó el contraste de los rellenos azules con texto blanco
 * (3,28 : 1, el mínimo AA es 4,5) y se dejó un guardián. El guardián buscaba la
 * cadena exacta `background: 'var(--nexus)'`.
 *
 * El barrido encontró **el mismo 3,28 en siete pantallas más**, escrito de otras
 * tres maneras que la prueba no miraba:
 *
 *     background: 'var(--nexus, #3d5afe)'    ← con valor de respaldo
 *     background: 'var(--nexus,#3d5afe)'     ← sin espacio
 *     background: 'var(--teal)'              ← el alias de retro-compatibilidad
 *
 * La lección no es que faltaran sitios: es que **el guardián era tan estrecho
 * como el barrido que lo escribió**. Una prueba que sólo comprueba la forma que
 * uno arregló no protege de la forma que uno no vio. Ahora la comprobación es
 * por patrón, no por cadena.
 *
 * ── 2. UNAS PESTAÑAS QUE NO CABÍAN ──────────────────────────────────────────
 *
 * En `/demo/interactivo`, cinco pestañas en una fila `flex` sin `wrap` pedían
 * 425 px en una pantalla de 390. La página entera se movía de lado — en la
 * pantalla que existe para enseñar el producto a alguien que lo está evaluando.
 *
 * ── 3. LAS ETIQUETAS ESTABAN PUESTAS Y NO SERVÍAN ───────────────────────────
 *
 * En `/login` y `/registro` los campos tenían su `<label>` visible encima —
 * «Correo electrónico», «Contraseña»— pero **sin asociar**: ni `htmlFor`, ni
 * `id`, ni `aria-label`. Un lector de pantalla dice «edición de texto» y ya.
 *
 * Es el peor tipo de defecto de accesibilidad: **parece resuelto**. Mirando la
 * pantalla se ve una etiqueta; mirando el árbol accesible no hay ninguna.
 *
 * Y el botón de mostrar/ocultar la contraseña no tenía nombre: «botón».
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'fs'
import { join } from 'path'

const leer = (...p: string[]) => readFileSync(join(process.cwd(), ...p), 'utf8')

function archivosDePantalla(dir = join(process.cwd(), 'src'), acc: string[] = []): string[] {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n)
    if (statSync(p).isDirectory()) { if (n !== '__tests__') archivosDePantalla(p, acc); continue }
    if (n.endsWith('.tsx')) acc.push(p)
  }
  return acc
}

describe('ningún relleno azul lleva texto blanco, se escriba como se escriba', () => {
  it('ni con valor de respaldo, ni sin espacio, ni por el alias --teal', () => {
    /**
     * El guardián de v1104 buscaba `background: 'var(--nexus)'` LITERAL, y por
     * eso siete pantallas siguieron fallando a 3,28. Ahora es por patrón.
     */
    const culpables: string[] = []
    /**
     * Y también DENTRO DE UN TERNARIO. La primera versión de este guardián sólo
     * miraba la forma directa, y por eso `/precios` siguió fallando a 3,28 con
     * `background: destacado ? 'var(--nexus, #3d5afe)' : 'transparent'`.
     *
     * Dos veces seguidas el mismo error: escribir la prueba con la forma que
     * acabo de arreglar, en vez de con la forma que el defecto puede tomar.
     */
    const relleno = /background: *[^,;\n]*'var\(--(?:nexus|teal)(?:,[^']*)?\)'/
    const blanco = /color: *[^,;\n]*'(?:#fff|#FFF|#ffffff|#FFFFFF|white)'/
    for (const f of archivosDePantalla()) {
      readFileSync(f, 'utf8').split('\n').forEach((linea, i) => {
        if (relleno.test(linea) && blanco.test(linea)) {
          culpables.push(`${f.replace(process.cwd() + '/', '')}:${i + 1}`)
        }
      })
    }
    expect(culpables, 'usar var(--nexus-solido) en el relleno').toEqual([])
  })

  it('ni con texto NEGRO — el espejo del mismo defecto en tema claro', () => {
    /**
     * ── EL ESPEJO, MEDIDO ────────────────────────────────────────────────
     *
     * `--nexus` cambia de brillo con el tema: #6E84FE en oscuro, #2845EA en
     * claro. Un texto NEGRO fijo encima da 6,39 en oscuro —bien— y **3,13 en
     * claro**, que reprueba.
     *
     * Es la misma familia que el defecto original, por el otro lado: un color
     * de texto fijo sobre un fondo que se mueve. El azul SÓLIDO con blanco pasa
     * en los dos temas (5,13 y 6,71) y por eso es el único relleno correcto.
     *
     * Salieron 32 sitios en 25 archivos. Sólo dos eran visibles desde el
     * navegador —el resto vive detrás del login—, así que esta prueba es lo
     * único que los cubre.
     */
    const culpables: string[] = []
    const relleno = /background: *[^,;\n]*'var\(--(?:nexus|teal)(?:,[^']*)?\)'/
    const negro = /color: *[^,;\n]*'#000(?:000)?'/
    for (const f of archivosDePantalla()) {
      readFileSync(f, 'utf8').split('\n').forEach((linea, i) => {
        if (relleno.test(linea) && negro.test(linea)) {
          culpables.push(`${f.replace(process.cwd() + '/', '')}:${i + 1}`)
        }
      })
    }
    expect(culpables, 'texto negro sobre el azul reprueba en tema CLARO').toEqual([])
  })

  it('y el token sólido sigue existiendo para que haya a dónde ir', () => {
    // V14 Identity Lock: el sólido es el jamaica #8E2A47 (blanco encima
    // = 8.2:1). Si alguien lo cambia, que la cifra AA se recalcule aquí.
    const css = leer('src', 'app', 'globals.css')
    expect(css).toMatch(/--nexus-solido: #8E2A47/)
  })
})

describe('las pestañas del demo caben en un teléfono', () => {
  it('la fila puede partirse', () => {
    const p = leer('src/app/demo/interactivo/page.tsx')
    expect(p).toMatch(/display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap'/)
  })

  it('y queda dicho por qué, con la cifra medida', () => {
    const p = leer('src/app/demo/interactivo/page.tsx')
    expect(p).toMatch(/piden 425/)
  })
})

describe('las etiquetas de los formularios públicos sirven de verdad', () => {
  const pares: [string, string[]][] = [
    ['src/app/login/page.tsx', ['correo-electronico', 'contrasena']],
    ['src/app/registro/page.tsx', ['reg-correo-electronico', 'reg-contrasena', 'reg-tu-nombre-completo']],
  ]

  for (const [archivo, ids] of pares) {
    for (const id of ids) {
      it(`${archivo.split('/')[2]}: «${id}» tiene etiqueta ASOCIADA`, () => {
        /**
         * Estaban puestas visualmente y sin asociar: se veía la etiqueta en la
         * pantalla y el lector de pantalla decía «edición de texto». El peor
         * tipo de defecto de accesibilidad, porque parece resuelto.
         */
        const s = leer(archivo)
        expect(s, `falta htmlFor="${id}"`).toContain(`htmlFor="${id}"`)
        expect(s, `falta id="${id}"`).toContain(`id="${id}"`)
      })
    }
  }

  it('el botón de mostrar la contraseña tiene nombre en los dos', () => {
    for (const [archivo] of pares) {
      expect(leer(archivo), archivo).toMatch(/aria-label=\{showPwd \? 'Ocultar la contraseña' : 'Mostrar la contraseña'\}/)
    }
  })
})

describe('lo que este barrido NO puede hacer', () => {
  it('deja constancia de que sólo cubrió lo público', () => {
    /**
     * Catorce pantallas SIN sesión. La consulta, la UCI y el hospital —donde
     * vive el trabajo— no se barrieron: hacen falta credenciales, y pedirlas
     * por el chat no es una opción.
     *
     * Un barrido que no dice qué NO miró se lee como si lo hubiera mirado todo.
     */
    const loop = leer('agent-state/LOOP-GRABACION-PERFECTA.md')
    expect(loop).toMatch(/I-13/)
  })
})
