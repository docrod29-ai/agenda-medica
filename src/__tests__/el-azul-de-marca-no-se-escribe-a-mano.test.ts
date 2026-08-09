/**
 * EL AZUL DE MARCA NO SE ESCRIBE A MANO — V9 · DESIGN-SYSTEM-001 · REG-291.
 *
 * ── QUÉ FALLABA ─────────────────────────────────────────────────────────────
 *
 * El sistema de diseño resolvió hace tiempo un problema fino: el azul de marca
 * no puede ser UN color, porque se le piden dos cosas opuestas.
 *
 *   · Como TEXTO sobre fondo oscuro hay que ACLARARLO   → `--nexus`  #6E84FE
 *   · Como RELLENO bajo texto blanco hay que OSCURECERLO → `--nexus-solido`
 *
 * La separación está medida y escrita en `globals.css`. Y **dieciocho sitios se
 * la saltaban**, escribiendo `#3D5AFE` a mano en posición de color de texto o
 * de icono — que es exactamente el uso para el que ese valor NO sirve.
 *
 * Medido con la fórmula de luminancia relativa de WCAG 2.1, `#3D5AFE` como
 * texto da:
 *
 *   sobre --s3  2,96 : 1      sobre --s1  3,56 : 1
 *   sobre --s2  3,30 : 1      sobre --bg  3,81 : 1
 *   sobre su propio tinte al 12 % (el chip)   2,98 – 3,24 : 1
 *   en tema CLARO, sobre el mismo tinte        4,25 : 1
 *
 * **Ninguno llega a 4,5.** El token que corresponde, `--nexus`, da 4,63–5,96 en
 * oscuro y 5,56–6,71 en claro: pasa AA en las ocho combinaciones.
 *
 * Y hay un segundo defecto encima del primero: un hexadecimal a mano **no
 * cambia con el tema**. `--nexus` vale `#6E84FE` en oscuro y `#2845EA` en
 * claro; los dieciocho sitios se quedaban en `#3D5AFE` en los dos.
 *
 * Sitios reparados, entre ellos: la etiqueta «Internado — ver Hospitalización»
 * del listado de pacientes, los chips de dosis, vía y laboratorio del
 * internamiento, el icono de cama de la consulta y de configuración, el estado
 * «En infusión» del MAR y el icono de la pantalla pública de verificación de
 * documento.
 *
 * ── CÓMO SE DESCUBRIÓ ───────────────────────────────────────────────────────
 *
 * `DESIGN-SYSTEM-001` de V9, contando los 123 `#3d5afe` del árbol y separando
 * los que son **fallback** de `var(--nexus, #3d5afe)` —inertes, porque la
 * variable siempre está definida— de los **crudos**, que sí se pintan.
 *
 * Ninguna prueba podía verlo. No hay nada que ejecutar: es un color correcto,
 * en una propiedad correcta, con la sintaxis correcta. Sólo el contraste lo
 * delata, y el contraste no se compila.
 *
 * ── LA FAMILIA ──────────────────────────────────────────────────────────────
 *
 * «El sistema se contradice a sí mismo», la misma de REG-269 (`@keyframes
 * spin`) y la misma que produjo la separación `--nexus` / `--nexus-solido`. El
 * token está bien y cada pantalla está bien; lo que está mal es que la pantalla
 * no use el token. Ninguna revisión de una sola pieza lo encuentra.
 *
 * ── LA REGLA QUE LO HACE SEGURO ─────────────────────────────────────────────
 *
 * Dos guardianes, y hacen falta los dos:
 *
 * 1. **Nadie escribe el azul a mano** salvo los sitios de la lista blanca de
 *    abajo, cada uno con su razón. La lista es corta a propósito: si crece sin
 *    razón escrita, la prueba obliga a escribirla.
 * 2. **El token cumple AA**, calculado aquí sobre el valor que `globals.css`
 *    declara hoy. No se afirma el contraste: se computa. Si alguien devuelve
 *    `--nexus` a `#3D5AFE`, esta prueba cae — que es la comprobación al revés.
 *
 * ── QUÉ **NO** CUBRE ────────────────────────────────────────────────────────
 *
 * - **Sólo vigila ESTE color.** Quedan ~1 200 hexadecimales a mano en el árbol
 *   (151 distintos) y su contraste nunca se ha medido. Éste es el primero de la
 *   serie, no la serie.
 * - **No mira dónde cae el color.** Comprueba el token contra las ocho
 *   superficies declaradas; no sabe si una pantalla puso el texto sobre otra
 *   cosa (una imagen, un degradado, un tinte de tercero).
 * - **No aprueba ninguna pantalla.** Cumplir el contraste de un token no es
 *   cumplir WCAG 2.2 AA: faltan foco, orden de tabulación, etiquetas, tamaño de
 *   objetivo táctil y todo lo demás. Eso es `A11Y-GATE-001`, y sigue abierto.
 * - **No cubre los `var(--nexus, #3d5afe)`.** El fallback es inerte mientras la
 *   variable exista, y hoy existe siempre. Se deja para no cambiar 90 líneas
 *   por una limpieza cosmética.
 * - **Nadie ha abierto una pantalla.** El cambio es de color y se ha calculado,
 *   no mirado. La comprobación en navegador sigue pendiente en el checkpoint.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const RAIZ = join(__dirname, '..')
const CSS = readFileSync(join(RAIZ, 'app/globals.css'), 'utf8')

/** `#3d5afe` o `#3D5AFE`, en cualquier mezcla de mayúsculas. */
const AZUL = /#3[dD]5[aA][fF][eE]/
/** `var(--loquesea, #3d5afe)` — fallback inerte, no se pinta nunca. */
const AZUL_DE_FALLBACK = /var\(\s*--[a-z0-9-]+\s*,\s*#3[dD]5[aA][fF][eE]\s*\)/g

/**
 * LISTA BLANCA. Cada entrada lleva su razón, y la razón es el punto: sin ella
 * esta lista se convierte en el sitio donde se esconden los defectos nuevos.
 */
const PERMITIDOS: Record<string, string> = {
  'app/globals.css':
    'Es la fuente. Aquí es donde el valor SE DECLARA (--nexus-solido) y donde se ' +
    'documenta la medición. Si no pudiera escribirse aquí, no podría escribirse en ninguna parte.',
  'app/global-error.tsx':
    'Se activa cuando falla algo tan arriba que globals.css puede no haber cargado. El propio ' +
    'archivo lo declara en su cabecera. Una variable CSS sin valor deja el botón sin fondo, y ' +
    'este botón es la única salida de una caída total. Además es relleno bajo texto blanco: 5,13:1, pasa.',
  'app/opengraph-image.tsx':
    'Lo dibuja Satori en el servidor para una imagen PNG. No hay documento, no hay cascada, ' +
    'no hay variables CSS. El color tiene que ser literal.',
  'app/page.tsx': 'Trazo del logotipo. La marca es constante: no sigue al tema a propósito, igual que no lo sigue en papel.',
  'app/login/page.tsx': 'Trazo del logotipo. La marca es constante: no sigue al tema a propósito, igual que no lo sigue en papel.',
  'app/registro/page.tsx': 'Trazo del logotipo. La marca es constante: no sigue al tema a propósito, igual que no lo sigue en papel.',
  'app/setup/page.tsx': 'Trazo del logotipo. La marca es constante: no sigue al tema a propósito, igual que no lo sigue en papel.',
  'app/unirse/[code]/page.tsx': 'Trazo del logotipo. La marca es constante: no sigue al tema a propósito, igual que no lo sigue en papel.',
  'components/Sidebar.tsx': 'Trazo del logotipo. La marca es constante: no sigue al tema a propósito, igual que no lo sigue en papel.',
  'app/mi/[token]/page.tsx':
    'Es un DATO, no un estilo: el acento por omisión de la configuración de receta impresa, que ' +
    'viaja al documento y se imprime en papel. El papel no tiene tema oscuro.',
  'lib/demo-sandbox.ts': 'Dato de una cita de demostración, no estilo.',
  'app/(dashboard)/calendario/page.tsx':
    'Paleta categórica: color de reserva de una cita sin médico asignado, uno entre N. Cambiar ' +
    'sólo el azul desequilibra la paleta. → backlog DESIGN-PALETAS-001.',
  'app/(dashboard)/configuracion/page.tsx':
    'Paleta categórica de planes (agenda/clínica/premium/hospital). → backlog DESIGN-PALETAS-001.',
  'app/(dashboard)/configuracion/secciones-cuenta.tsx':
    'Paleta categórica de roles. → backlog DESIGN-PALETAS-001.',
  'app/(dashboard)/consulta/[patientId]/consulta-ui.tsx':
    'Paleta categórica de hablantes de la diarización. → backlog DESIGN-PALETAS-001.',
  'components/PreopAssessment.tsx':
    'Paleta categórica de secciones del preoperatorio. → backlog DESIGN-PALETAS-001.',
  'components/laboratorio/GraficaLab.tsx':
    'Trazo de gráfica sobre --s1: 3,56:1, POR ENCIMA del umbral 3:1 que WCAG pide a un objeto ' +
    'gráfico. No es un fallo de contraste; es ceguera al tema. → backlog DESIGN-GRAFICAS-001.',
  'components/hospital/GraficaSignos.tsx':
    'Mismo caso que GraficaLab: el valor por omisión del trazo. → backlog DESIGN-GRAFICAS-001.',
  'app/(dashboard)/hospitalizacion/[internamientoId]/page.tsx':
    'Un único uso restante, y es el que PASA el color a GraficaSignos. Se mueve cuando se mueva ' +
    'la gráfica. → backlog DESIGN-GRAFICAS-001.',
}

function archivosDeFuente(dir: string, salida: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    if (e === 'node_modules' || e === '__tests__' || e === '.next') continue
    const p = join(dir, e)
    if (statSync(p).isDirectory()) archivosDeFuente(p, salida)
    else if (/\.(tsx?|css)$/.test(e)) salida.push(p)
  }
  return salida
}

// ─── Contraste WCAG 2.1, calculado, no recordado ──────────────────────────────
const canal = (c: number) => (c / 255 <= 0.03928 ? c / 255 / 12.92 : ((c / 255 + 0.055) / 1.055) ** 2.4)
const aRgb = (hex: string): [number, number, number] => {
  const h = hex.replace('#', '')
  return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)) as [number, number, number]
}
const luminancia = (c: [number, number, number]) => 0.2126 * canal(c[0]) + 0.7152 * canal(c[1]) + 0.0722 * canal(c[2])
const contraste = (a: string | [number, number, number], b: string | [number, number, number]) => {
  const la = luminancia(typeof a === 'string' ? aRgb(a) : a)
  const lb = luminancia(typeof b === 'string' ? aRgb(b) : b)
  const [hi, lo] = la > lb ? [la, lb] : [lb, la]
  return (hi + 0.05) / (lo + 0.05)
}
/** Compone un `rgba(...)` sobre un fondo opaco — el tinte de los chips. */
const componer = (tinte: [number, number, number, number], fondo: string): [number, number, number] => {
  const b = aRgb(fondo); const a = tinte[3]
  return [0, 1, 2].map(i => Math.round(tinte[i] * a + b[i] * (1 - a))) as [number, number, number]
}

/** Lee un token del bloque de tema pedido, tal y como está hoy en globals.css. */
function token(nombre: string, tema: 'oscuro' | 'claro'): string {
  const bloque = tema === 'oscuro'
    ? CSS.slice(0, CSS.indexOf(':root[data-theme="light"]'))
    : CSS.slice(CSS.indexOf(':root[data-theme="light"]'))
  const m = bloque.match(new RegExp(`--${nombre}:\\s*(#[0-9a-fA-F]{6})`))
  if (!m) throw new Error(`no se encontró --${nombre} en el tema ${tema}`)
  return m[1]
}

/** Igual, pero para un token declarado como `rgba(...)` — el tinte del chip. */
function tokenRgba(nombre: string, tema: 'oscuro' | 'claro'): [number, number, number, number] {
  const bloque = tema === 'oscuro'
    ? CSS.slice(0, CSS.indexOf(':root[data-theme="light"]'))
    : CSS.slice(CSS.indexOf(':root[data-theme="light"]'))
  const m = bloque.match(new RegExp(`--${nombre}:\\s*rgba\\(([\\d.,\\s]+)\\)`))
  if (!m) throw new Error(`no se encontró --${nombre} como rgba en el tema ${tema}`)
  const p = m[1].split(',').map(s => parseFloat(s.trim()))
  return [p[0], p[1], p[2], p[3]]
}

const SUPERFICIES = {
  oscuro: { bg: 'bg', s1: 's1', s2: 's2', s3: 's3' },
  claro: { bg: 'bg', s1: 's1', s2: 's2', s3: 's3' },
} as const

describe('el azul de marca no se escribe a mano (REG-291)', () => {
  it('ningún archivo pinta #3D5AFE crudo fuera de la lista blanca razonada', () => {
    const infractores: string[] = []
    for (const abs of archivosDeFuente(RAIZ)) {
      const rel = relative(RAIZ, abs).replace(/\\/g, '/')
      if (PERMITIDOS[rel]) continue
      const texto = readFileSync(abs, 'utf8')
      texto.split('\n').forEach((linea, i) => {
        // El fallback de `var(--x, #3d5afe)` no se pinta: se descuenta antes de mirar.
        if (AZUL.test(linea.replace(AZUL_DE_FALLBACK, ''))) infractores.push(`${rel}:${i + 1}`)
      })
    }
    expect(infractores, `Usa var(--nexus) para texto/icono o var(--nexus-solido) para relleno. ` +
      `Si de verdad hace falta el literal, añádelo a PERMITIDOS con su razón:\n${infractores.join('\n')}`)
      .toEqual([])
  })

  it('toda entrada de la lista blanca existe y sigue teniendo el color', () => {
    // Una lista blanca que menciona archivos ya limpios miente sobre el estado real.
    for (const rel of Object.keys(PERMITIDOS)) {
      const texto = readFileSync(join(RAIZ, rel), 'utf8')
      expect(AZUL.test(texto), `${rel} ya no tiene el azul a mano: quítalo de PERMITIDOS`).toBe(true)
    }
  })

  it('cada razón de la lista blanca dice algo — no vale una palabra', () => {
    for (const [rel, razon] of Object.entries(PERMITIDOS)) {
      expect(razon.length, `la razón de ${rel} es demasiado corta para ser una razón`).toBeGreaterThan(20)
    }
  })

  describe('el token que sí se puede usar cumple AA — computado, no recordado', () => {
    for (const tema of ['oscuro', 'claro'] as const) {
      for (const clave of Object.keys(SUPERFICIES[tema])) {
        it(`--nexus sobre --${clave} en tema ${tema} ≥ 4.5:1`, () => {
          const r = contraste(token('nexus', tema), token(clave, tema))
          expect(r, `--nexus (${token('nexus', tema)}) sobre --${clave} (${token(clave, tema)}) = ${r.toFixed(2)}`)
            .toBeGreaterThanOrEqual(4.5)
        })
      }
    }

    it('--nexus sobre el tinte --nexus-soft (el chip) ≥ 4.5:1 en los dos temas', () => {
      // El chip es el caso peor: fondo y texto son el mismo tono, así que el
      // tinte sube la luminancia del fondo y COME contraste. Con el azul crudo
      // daba 2,98–3,24. Se compone el rgba real que declara globals.css.
      for (const tema of ['oscuro', 'claro'] as const) {
        for (const s of ['s1', 's2'] as const) {
          const fondo = componer(tokenRgba('nexus-soft', tema), token(s, tema))
          const r = contraste(token('nexus', tema), fondo)
          expect(r, `${tema}/${s} = ${r.toFixed(2)}`).toBeGreaterThanOrEqual(4.5)
        }
      }
    })

    it('el relleno lleva blanco encima y también pasa AA', () => {
      for (const tema of ['oscuro', 'claro'] as const) {
        const r = contraste('#FFFFFF', token('nexus-solido', tema))
        expect(r, `blanco sobre --nexus-solido (${tema}) = ${r.toFixed(2)}`).toBeGreaterThanOrEqual(4.5)
      }
    })

    it('AL REVÉS: el literal que se reparó SEGUIRÍA reprobando', () => {
      // Si esta comprobación deja de fallar es que #3D5AFE pasó a ser aceptable,
      // y entonces toda la reparación de REG-291 sobra. No es una tautología:
      // usa las superficies reales que declara globals.css hoy.
      for (const s of ['bg', 's1', 's2', 's3'] as const) {
        expect(contraste('#3D5AFE', token(s, 'oscuro'))).toBeLessThan(4.5)
      }
    })
  })

  describe('lo que Tailwind ve no puede volver a encogerse (DESIGN-THEME-001)', () => {
    const crudo = CSS.slice(CSS.indexOf('@theme inline'), CSS.indexOf('@theme inline') + 3000)
    // Sin comentarios: este archivo CITA `--spacing-6` para explicar por qué NO se
    // declara, y una prueba que se dispara con su propia explicación no sirve.
    const bloque = crudo.replace(/\/\*[\s\S]*?\*\//g, '')

    it('el bloque @theme expone las familias del sistema, no cuatro valores', () => {
      // Eran cuatro. De ahí salían los 6 065 estilos en línea: sin utilidades no
      // hay alternativa. Si alguien las quita, el monolito vuelve por mecánica.
      for (const esperado of [
        '--color-canvas', '--color-superficie', '--color-superficie2', '--color-superficie3',
        '--color-linea', '--color-tinta', '--color-tinta2', '--color-tinta3',
        '--color-nexus', '--color-nexus-solido',
        '--color-clinico-rojo', '--color-clinico-ambar', '--color-clinico-verde',
        '--radius-1', '--radius-5', '--radius-pill',
      ]) {
        expect(bloque, `falta ${esperado} en @theme inline`).toContain(esperado)
      }
    })

    it('@theme NO declara --spacing-N: sustituiría el cálculo de p-6 y px-6', () => {
      // En Tailwind v4 `p-6` es `calc(var(--spacing) * 6)` = 24 px. Declarar
      // `--spacing-6` no añade un token: cambia ese cálculo a 6 px, y los cinco
      // `p-6`/`px-6` del árbol encogen sin que falle ninguna prueba de píxeles,
      // porque no hay ninguna. Los `--sp-*` viven en :root y se usan en línea.
      expect(bloque).not.toMatch(/--spacing-\d/)
      expect(CSS).toContain('--sp-8:')
    })

    it('cada token de radio del @theme apunta a un --r-* que existe', () => {
      // «El dato tiene que LLEGAR»: un alias a una variable inexistente compila,
      // se sirve, y produce una esquina recta que nadie relaciona con esto.
      const alias = [...bloque.matchAll(/--radius-[a-z0-9]+:\s*var\((--r-[a-z0-9-]+)\)/g)].map(m => m[1])
      expect(alias.length).toBeGreaterThanOrEqual(7)
      for (const v of alias) expect(CSS, `${v} no está declarado`).toMatch(new RegExp(`\\s${v}:`))
    })
  })
})
