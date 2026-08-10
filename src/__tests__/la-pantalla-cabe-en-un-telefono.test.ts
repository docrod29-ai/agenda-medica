/**
 * LA PANTALLA CABE EN UN TELÉFONO — y el texto blanco se lee sobre el azul.
 *
 * ── LOS TRES DEFECTOS QUE ESTE GUARDIÁN CIERRA ──────────────────────────────
 *
 * Los tres se encontraron el 7-ago-2026 MIDIENDO producción con un navegador
 * en un iPhone de 390 px, no leyendo el código. Ninguno se ve en una prueba
 * unitaria ni en una captura de escritorio.
 *
 * **1. El botón de registro salía cortado por el borde de la pantalla.**
 * La barra de la portada es `flex` con `nowrap`, 24 px de relleno a cada lado y
 * botones `white-space: nowrap`: pedía 417 px donde había 390, y NADA cedía.
 * La página entera se movía de lado.
 *
 * **2. Cuarenta y una rejillas no podían encoger.**
 * `repeat(auto-fit, minmax(300px, 1fr))` es el error clásico: `auto-fit`
 * colapsa columnas vacías, pero el suelo de 300 px **no baja de 300 px**. En un
 * teléfono de 320 la tarjeta se sale, y con ella la página. La forma correcta —
 * `minmax(min(300px, 100%), 1fr)` — es idéntica en pantalla ancha.
 *
 * **3. El texto blanco sobre el azul de marca daba 3,28 : 1.**
 * El mínimo AA es 4,5. Y no era un botón: eran los 68 usos de `.btn-primary`
 * más 26 rellenos en línea — «Procesar con IA», «Guardar adenda», el CTA del
 * antibiograma, el botón de registro.
 *
 * ── POR QUÉ EL TERCERO ES EL INTERESANTE ────────────────────────────────────
 *
 * `--nexus` se había ACLARADO a propósito, y con razón: como TEXTO sobre el
 * lienzo oscuro necesita separarse del fondo (#6E84FE da 5,96). Pero el mismo
 * token se usaba de RELLENO bajo texto blanco, donde el requisito es el
 * CONTRARIO: hay que oscurecerlo. Un token, dos trabajos incompatibles.
 *
 * Ninguna de las dos decisiones está mal por su cuenta — por eso ninguna
 * revisión de una sola pieza lo encuentra. Es la familia «el sistema se
 * contradice a sí mismo» de `src/lib/calidad/familias-de-defecto.ts`.
 *
 * El tema CLARO nunca lo tuvo, porque allí `--nexus` ya era #2845EA. La
 * corrección existía; sólo se había aplicado a un tema.
 *
 * ── LO QUE ESTA PRUEBA NO PUEDE HACER ───────────────────────────────────────
 *
 * No mide la pantalla: mide el CÓDIGO FUENTE. Un desborde nuevo por otra causa
 * —un `width` fijo, una tabla ancha, una imagen sin `max-width`— pasa por aquí
 * sin despeinarse. Para eso hace falta abrir un navegador con un teléfono
 * emulado, que es exactamente como se encontraron estos tres.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'fs'
import { join } from 'path'

const raiz = join(process.cwd(), 'src')
const leer = (...p: string[]) => readFileSync(join(process.cwd(), ...p), 'utf8')

function archivosDeInterfaz(dir = raiz, acc: string[] = []): string[] {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n)
    if (statSync(p).isDirectory()) { if (n !== '__tests__') archivosDeInterfaz(p, acc); continue }
    if (/\.(tsx|css)$/.test(n)) acc.push(p)
  }
  return acc
}

/** Luminancia relativa, WCAG 2.1 §1.4.3. */
function luminancia(hex: string): number {
  const n = parseInt(hex.replace('#', ''), 16)
  const canal = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(v => {
    const s = v / 255
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * canal[0] + 0.7152 * canal[1] + 0.0722 * canal[2]
}
function contraste(a: string, b: string): number {
  const x = luminancia(a), y = luminancia(b)
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)
}

/** El mínimo de la WCAG 2.1 nivel AA para texto normal. */
const AA = 4.5

describe('el texto blanco se lee sobre el azul de relleno', () => {
  const css = leer('src', 'app', 'globals.css')

  it('la fórmula de contraste reproduce las cifras del comentario del token', () => {
    // Si esto falla, la fórmula está mal y ninguna otra aserción vale nada.
    expect(+contraste('#FFFFFF', '#6E84FE').toFixed(2)).toBe(3.28)
    expect(+contraste('#FFFFFF', '#3D5AFE').toFixed(2)).toBe(5.13)
    expect(+contraste('#FFFFFF', '#2845EA').toFixed(2)).toBe(6.71)
  })

  it('--nexus-solido existe en la identidad única', () => {
    // V14 · D-5/D-6: identidad única Cantera+Instrumento — ya no hay tres
    // bloques de tema. El token debe existir en :root; si volviera a haber
    // más de un bloque de tema, CADA uno tendría que declararlo (así nació
    // este defecto en la era de dos temas).
    const veces = css.match(/--nexus-solido:/g) ?? []
    expect(veces.length).toBeGreaterThanOrEqual(1)
  })

  it('cada valor declarado de --nexus-solido pasa AA con texto blanco', () => {
    const valores = [...css.matchAll(/--nexus-solido:\s*(#[0-9A-Fa-f]{6})/g)].map(m => m[1])
    expect(valores.length).toBeGreaterThanOrEqual(1)
    for (const v of valores) {
      expect(contraste('#FFFFFF', v), `${v} contra blanco`).toBeGreaterThanOrEqual(AA)
    }
  })

  it('.btn-primary se rellena con el sólido, no con el token de texto', () => {
    const regla = /\.btn-primary\s*\{[^}]*\}/.exec(css)?.[0] ?? ''
    expect(regla).toMatch(/background:\s*var\(--nexus-solido\)/)
    expect(regla).not.toMatch(/background:\s*var\(--nexus\)\s*;/)
  })

  it('ningún relleno en línea usa --nexus con texto blanco encima', () => {
    // El defecto vivía en 26 sitios en línea que .btn-primary no alcanza.
    const culpables: string[] = []
    for (const f of archivosDeInterfaz()) {
      if (!f.endsWith('.tsx')) continue
      const src = readFileSync(f, 'utf8')
      src.split('\n').forEach((linea, i) => {
        const rellena = /background:\s*(?:[^,;]*\?\s*)?'var\(--nexus\)'/.test(linea)
        const blanco = /color:\s*(?:[^,;]*\?\s*)?'(?:#fff|#FFF|#ffffff|white)'/.test(linea)
        if (rellena && blanco) culpables.push(`${f.replace(process.cwd() + '/', '')}:${i + 1}`)
      })
    }
    expect(culpables, 'usar var(--nexus-solido) en el relleno').toEqual([])
  })
})

describe('nada obliga a la página a moverse de lado', () => {
  it('ninguna rejilla tiene un suelo que no pueda encoger', () => {
    // minmax(300px, …) no baja de 300 px ni en una pantalla de 320.
    // minmax(min(300px, 100%), …) es idéntico en pantalla ancha y cede en la
    // estrecha. Eran 41 en toda la app.
    const culpables: string[] = []
    for (const f of archivosDeInterfaz()) {
      const src = readFileSync(f, 'utf8')
      src.split('\n').forEach((linea, i) => {
        if (/minmax\(\s*\d+px/.test(linea)) culpables.push(`${f.replace(process.cwd() + '/', '')}:${i + 1}`)
      })
    }
    expect(culpables, 'usar minmax(min(Npx, 100%), …)').toEqual([])
  })

  it('la barra de la portada se estrecha en un teléfono', () => {
    const css = leer('src', 'app', 'globals.css')
    const portada = leer('src', 'app', 'page.tsx')
    // La clase tiene que estar puesta: una regla sin quien la lleve no hace nada
    // — la familia «escrito, probado y sin conectar».
    expect(portada).toMatch(/className="nav-portada"/)
    expect(portada).toMatch(/className="nav-portada-marca"/)
    expect(css).toMatch(/@media \(max-width: 460px\)/)
    expect(css).toMatch(/\.nav-portada \{[^}]*padding-left:\s*12px/)
    // Y el nombre escrito se retira sólo en lo MUY estrecho, no siempre.
    expect(css).toMatch(/@media \(max-width: 380px\)[\s\S]{0,200}\.nav-portada-marca \{ display: none/)
  })
})
