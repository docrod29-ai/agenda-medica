/**
 * LA PANTALLA DEL PACIENTE SIGUE AL TEMA — V9 · DESIGN-SYSTEM-001 · REG-294/295.
 *
 * ── QUÉ FALLABA ─────────────────────────────────────────────────────────────
 *
 * **REG-294 — dos pantallas del paciente clavadas en el tema claro.**
 *
 * `/privacidad/[clinicId]` (el portal de derechos ARCO) y `/privacidad`
 * (el aviso legal) pintaban su lienzo, sus tarjetas, sus bordes y su texto con
 * hexadecimales de la paleta *slate*: `#f3f4f6` de fondo, `#fff` de tarjeta,
 * `#111827` de título, `#374151` de cuerpo, `#6b7280` de secundario. Es la
 * reaparición del defecto que `globals.css:25-30` ya documentaba.
 *
 * Y no eran coherentes ni consigo mismas: el folio, el icono y los botones
 * `.btn` **sí** siguen al tema. Así que la mitad de la pantalla se movía con el
 * tema y la otra mitad no, que es peor que cualquiera de las dos cosas enteras.
 * Dos contrastes medidos que reprobaban AA:
 *
 * | Dónde | Cociente | Mínimo |
 * |---|---|---|
 * | Contador de caracteres de la solicitud ARCO, `#9ca3af` sobre `#fff` | **2,54 : 1** | 4,5 |
 * | Pie del aviso legal, `#889` sobre `#fff` | **3,48 : 1** | 4,5 |
 *
 * El aviso ámbar de la solicitud era el caso más fino: fondo **literal**
 * (`#fef3c7`) y texto con **token** (`var(--amber)`). En tema claro daba 4,51;
 * en oscuro, donde `--amber` se aclara a `#D97706`, **2,86**. El contraste
 * dependía de un tema que el fondo ignoraba.
 *
 * **REG-295 — el relleno usaba el token del TEXTO.**
 *
 * Los dos CTA finales de la superficie pública —«Confirmar cita» de `/reservar`
 * y «Enviar» de `/resena`— se pintaban `background: var(--teal)` con texto
 * `#040b12`. `--teal` es `--nexus`, que es el azul **para leerse sobre fondo
 * oscuro**; como relleno, en el tema claro se oscurece a `#2845EA` y el texto
 * casi negro encima se hunde:
 *
 * | Tema | Cociente |
 * |---|---|
 * | oscuro (`--nexus` = `#6E84FE`) | 6,02 ✓ |
 * | **claro** (`--nexus` = `#2845EA`) | **2,95** ✗ |
 *
 * Es **exactamente REG-223**, que ya explicó por qué hay dos tokens con
 * requisitos opuestos y arregló `.btn-primary`. Estos dos botones están escritos
 * a mano y se quedaron fuera. Con `--nexus-solido` y texto blanco dan 5,13 en
 * oscuro y 6,71 en claro.
 *
 * ── POR QUÉ IMPORTA AQUÍ MÁS QUE EN OTRO SITIO ──────────────────────────────
 *
 * Son las pantallas donde un paciente **agenda su primera cita** y **ejerce un
 * derecho con plazo legal**. Nadie las usa ochenta veces al día, así que nadie
 * se acostumbra a un texto que se lee mal: simplemente no lo lee.
 *
 * ── CÓMO SE DESCUBRIÓ ───────────────────────────────────────────────────────
 *
 * Contando los hexadecimales que **no** son respaldos de `var()` —los respaldos
 * son código muerto y son otra unidad (`DESIGN-RESPALDOS-001`)— y midiendo cada
 * pareja color/fondo con la fórmula de luminancia relativa WCAG 2.1, la misma
 * que `globals.css` usa a mano en sus comentarios.
 *
 * ── LA REGLA QUE LO HACE SEGURO ─────────────────────────────────────────────
 *
 * En las nueve rutas del paciente, el color sale de un token. Las excepciones se
 * declaran **una a una, con su motivo**, y son pocas a propósito: una lista de
 * excepciones que crece sola deja de ser una lista y pasa a ser una costumbre.
 *
 * Y el relleno nunca usa el token del texto. Ese par —`--nexus` para leer,
 * `--nexus-solido` para rellenar— tiene su razón escrita en `globals.css` y esta
 * prueba lo hace exigible.
 *
 * ── PROBADA AL REVÉS ────────────────────────────────────────────────────────
 *
 * Automatizado abajo, sobre el fuente en memoria: devolviendo `#6b7280` a
 * `/privacidad`, o `background: var(--teal)` al CTA de `/reservar`, cada prueba
 * falla nombrando el archivo.
 *
 * ── QUÉ **NO** CUBRE ────────────────────────────────────────────────────────
 *
 * - **No mide el contraste que se ve.** Comprueba que el color venga de un
 *   token, y los tokens sí están medidos en los dos temas (`globals.css`). Pero
 *   un token bien elegido sobre una superficie inesperada puede seguir sin
 *   leerse. Eso lo dice `axe` sobre la aplicación corriendo — `A11Y-AXE-001`.
 * - **No cubre `rgba(...)` ni `color-mix(...)` a mano.** Sólo hexadecimales.
 * - **No cubre el resto de la aplicación.** Quedan ~21 literales fuera de la
 *   superficie del paciente, casi todos paletas de categoría (`#94a3b8` para
 *   «inactivo») y documentos en papel. Su barrido es `VISUAL-EXCELLENCE-001`.
 * - **Nadie ha abierto estas pantallas.** La conversión a tokens está razonada y
 *   medida, no observada.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join, relative } from 'path'
import { pantallas, esDelPaciente } from '../../scripts/a11y/nombres-accesibles.mjs'

const RAIZ = process.cwd()

/**
 * Los únicos colores literales que pueden quedar en la superficie del paciente,
 * **cada uno con el motivo por el que un token sería peor**.
 *
 * Se identifican por `archivo` + el color, no por número de línea: una línea se
 * mueve con el primer `prettier` y la excepción se evaporaría o —peor— taparía
 * un literal nuevo que cayera en su sitio.
 */
const EXCEPCIONES: { archivo: string; color: string; motivo: string }[] = [
  {
    archivo: 'src/app/mi/[token]/page.tsx',
    color: '#3D5AFE',
    motivo: 'Color de acento por defecto de la RECETA IMPRESA. El papel no sigue al tema de la pantalla: se imprime igual de día y de noche.',
  },
  {
    archivo: 'src/app/mi/[token]/page.tsx',
    color: '#fff',
    motivo: 'Blanco sobre `--nexus-solido`, que es exactamente la pareja para la que ese token existe (5,13 : 1 medido en globals.css).',
  },
  {
    archivo: 'src/app/resena/[token]/page.tsx',
    color: '#fbbf24',
    motivo: 'El oro de la estrella de calificación. Una estrella es oro en los dos temas; con `--amber` saldría marrón en claro.',
  },
  {
    archivo: 'src/app/resena/[token]/page.tsx',
    color: '#fff',
    motivo: 'Blanco sobre `--nexus-solido` — la pareja correcta (REG-295).',
  },
  {
    archivo: 'src/app/reservar/[clinicId]/page.tsx',
    color: '#fff',
    motivo: 'Blanco sobre `--nexus-solido` — la pareja correcta (REG-295).',
  },
  {
    archivo: 'src/app/teleconsulta/[citaId]/page.tsx',
    color: '#000',
    motivo: 'El escenario del vídeo. Un lienzo temático alrededor de un flujo de vídeo altera cómo se percibe la imagen; el negro es la decisión, no el descuido.',
  },
]

const permitido = (archivo: string, color: string) =>
  EXCEPCIONES.some((e) => e.archivo === archivo && e.color.toLowerCase() === color.toLowerCase())

/** Quita los respaldos `var(--x, #hex)`: son código muerto y otra unidad. */
const sinRespaldos = (t: string) => t.replace(/var\(\s*--[a-z0-9-]+\s*,[^)]*\)/gi, 'VAR')

function literales(archivo: string, fuente?: string) {
  const texto = sinRespaldos(fuente ?? readFileSync(archivo, 'utf8'))
  const rel = relative(RAIZ, archivo).replaceAll('\\', '/')
  const fuera: string[] = []
  for (const m of texto.matchAll(/#[0-9a-fA-F]{3,8}\b/g)) {
    if (permitido(rel, m[0])) continue
    fuera.push(`${rel}:${texto.slice(0, m.index).split('\n').length} → ${m[0]}`)
  }
  return fuera
}

const delPaciente = (pantallas() as string[]).filter((f) => esDelPaciente(f))

describe('la superficie del paciente saca su color del sistema, no de la memoria', () => {
  it('hay pantallas del paciente que analizar', () => {
    /** Una compuerta sobre cero archivos pasa siempre. */
    expect(delPaciente.length).toBeGreaterThanOrEqual(9)
  })

  it('ningún color literal fuera de las excepciones declaradas', () => {
    expect(delPaciente.flatMap((f) => literales(f)).sort()).toEqual([])
  })

  it('cada excepción sigue existiendo — una lista de excepciones también se pudre', () => {
    /**
     * Si alguien arregla un literal exento y nadie borra su excepción, la
     * excepción queda ahí cubriendo un color que ya nadie escribe… y el día que
     * ese color reaparezca por otro motivo, pasará sin que nadie lo mire.
     */
    const muertas = EXCEPCIONES.filter((e) => {
      const texto = sinRespaldos(readFileSync(join(RAIZ, e.archivo), 'utf8'))
      return !new RegExp(e.color.replace('#', '#'), 'i').test(texto)
    }).map((e) => `${e.archivo} → ${e.color} ya no se usa: quita la excepción`)
    expect(muertas).toEqual([])
  })

  it('cada excepción explica POR QUÉ un token sería peor', () => {
    /** Una excepción sin motivo es un permiso, y los permisos se heredan. */
    for (const e of EXCEPCIONES) expect(e.motivo.length).toBeGreaterThan(40)
  })

  it('el relleno no usa el token del TEXTO — REG-223, y REG-295 su reaparición', () => {
    /**
     * `--nexus` (y su alias `--teal`) es el azul para LEERSE sobre fondo oscuro.
     * Como relleno bajo texto, en el tema claro se oscurece a `#2845EA` y hunde
     * el contraste de lo que lleve encima. El relleno es `--nexus-solido`.
     *
     * Se mira toda la aplicación, no sólo al paciente: el par de tokens es del
     * sistema y el defecto ya apareció dos veces.
     */
    /**
     * La condición es **relleno Y texto encima**, no relleno a secas. Una barra
     * de progreso o un punto de 6 px se rellenan con `--nexus` y está bien: no
     * llevan nada que leer. Exigirles el token del relleno sería gritar de más,
     * y hay siete de ésos en la aplicación.
     *
     * Se busca `color:` dentro del mismo objeto de estilo, que es donde el
     * defecto vive: `background: var(--teal), color: '#040b12'`.
     */
    /**
     * El objeto de estilo se delimita **contando llaves**, no con una expresión
     * regular. Se probaron las dos formas fáciles y las dos se equivocan:
     * exigir `\n}` al final se salta los objetos de una línea
     * (`const btnPrim: React.CSSProperties = { … }`), y mirar una ventana de
     * caracteres alrededor arrastra el `color:` del elemento vecino — con eso,
     * la barra de progreso de `/finanzas` salía marcada.
     */
    const objetoQueContiene = (texto: string, i: number) => {
      let prof = 0
      let ini = -1
      for (let k = i; k >= 0; k--) {
        if (texto[k] === '}') prof++
        else if (texto[k] === '{') { if (prof === 0) { ini = k; break } prof-- }
      }
      if (ini < 0) return ''
      prof = 0
      for (let k = ini; k < texto.length; k++) {
        if (texto[k] === '{') prof++
        else if (texto[k] === '}') { prof--; if (prof === 0) return texto.slice(ini, k + 1) }
      }
      return texto.slice(ini)
    }

    const malos: string[] = []
    for (const archivo of pantallas() as string[]) {
      const texto = readFileSync(archivo, 'utf8')
      for (const m of texto.matchAll(/background(?:Color)?:\s*'var\(--(?:teal|nexus)\)'/g)) {
        const i = m.index ?? 0
        // `\bcolor:` en minúscula no casa con `backgroundColor:`, que lleva C.
        if (!/\bcolor:\s*'/.test(objetoQueContiene(texto, i))) continue
        malos.push(`${relative(RAIZ, archivo).replaceAll('\\', '/')}:${texto.slice(0, i).split('\n').length}`)
      }
    }
    expect(malos).toEqual([])
  })

  it('caza el defecto cuando se devuelve — probada al revés', () => {
    const conDefecto = (archivo: string, de: string, a: string) => {
      const ruta = join(RAIZ, archivo)
      const original = readFileSync(ruta, 'utf8')
      expect(original.includes(de), `el fuente ya no contiene «${de}»`).toBe(true)
      return literales(ruta, original.replace(de, a))
    }
    const vuelto = conDefecto(
      'src/app/privacidad/[clinicId]/page.tsx',
      "color: 'var(--text3)'",
      "color: '#6b7280'",
    )
    expect(vuelto.length).toBe(1)
    expect(vuelto[0]).toContain('#6b7280')
  })
})
