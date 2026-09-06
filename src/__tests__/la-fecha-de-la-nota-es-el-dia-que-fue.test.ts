/**
 * GOLDEN — la línea de tiempo del expediente enseñaba el día ANTERIOR, y le
 * inventaba una hora.
 *
 * ── QUÉ FALLABA, Y CÓMO SE DESCUBRIÓ ────────────────────────────────────────
 *
 * Sembrando once encuentros más en el emulador para poder juzgar la línea de
 * tiempo (`scripts/ausculta-transformacion/sembrar-historia-larga.mjs`) y
 * mirándola. Con UN encuentro no había historia que leer, así que estas fechas
 * no las había mirado nadie.
 *
 * Tres pantallas hacían esto:
 *
 *     new Date(nota.fechaConsulta).toLocaleString('es-MX',
 *       { dateStyle: 'medium', timeStyle: 'short' })
 *
 * `fechaConsulta` es una fecha SUELTA (`YYYY-MM-DD`). Medido en
 * `America/Mexico_City`, un encuentro del **1 sep 2026** se pinta
 * **«31 ago 2026, 6:00 p.m.»**. Dos errores en una línea:
 *
 *  1. **El día está mal.** El estándar obliga a leer una fecha sin hora como
 *     medianoche UTC, y al oeste de Greenwich eso cae el día anterior en hora
 *     local. En México (UTC−6) es sistemático, no ocasional.
 *  2. **La hora es inventada.** Pedir `timeStyle` a un valor que no tiene hora
 *     no deja el hueco vacío: lo rellena con esa medianoche desplazada. Un dato
 *     que nadie registró, escrito con la misma tipografía que los que sí.
 *
 * ── POR QUÉ IMPORTA MÁS DE LO QUE PARECE ────────────────────────────────────
 *
 * La fecha es **el eje sobre el que se lee una historia clínica**: qué pasó
 * antes que qué. Y una de las tres pantallas es
 * `/nota/[patientId]/[notaId]` — el visor del documento firmado, donde la
 * fecha no es una etiqueta sino parte de lo que se sostiene medicolegalmente.
 *
 * ── LA CAUSA RAÍZ ───────────────────────────────────────────────────────────
 *
 * `src/lib/fecha-local.ts` lleva el fallo escrito entero desde que se creó —la
 * edad pediátrica que se cumplía un día antes, los días post-trasplante que
 * saltaban de fase— y su único consumidor era `pediatria.ts`. La lección se
 * aprendió en un módulo y no en el de al lado. No faltaba el conocimiento:
 * faltaba que lo usaran los tres sitios que pintan fechas de encuentro.
 *
 * ── PROBADO AL REVÉS ────────────────────────────────────────────────────────
 *
 * El primer caso reproduce la línea anterior y comprueba que SÍ da el día
 * equivocado: si algún día `new Date('YYYY-MM-DD')` dejara de comportarse así,
 * este golden lo diría en vez de seguir protegiendo un fantasma.
 *
 * ── QUÉ **NO** CUBRE ────────────────────────────────────────────────────────
 *
 * · **No fija la zona del proceso.** Se comprueba el comportamiento con el huso
 *   que tenga el entorno, y aparte se demuestra el desplazamiento con
 *   aritmética explícita, que es cierta en cualquier huso al oeste de
 *   Greenwich. Forzar `TZ` desde un test contamina a los que corren después.
 * · **No cubre todas las fechas de la aplicación.** Cubre las tres que pintan
 *   la fecha de un ENCUENTRO. Otras superficies leen marcas de tiempo
 *   completas, donde la hora sí es el dato y `new Date` es correcto.
 * · No comprueba el formato con el que se ve: eso se mira en la captura.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fechaLegible, fechaLocalDesdeISO } from '@/lib/fecha-local'

const leer = (rel: string) => readFileSync(join(process.cwd(), rel), 'utf8')

/** Las tres pantallas que pintan la fecha de un encuentro. */
const PANTALLAS_DE_ENCUENTRO = [
  'src/app/(dashboard)/expediente/[patientId]/page.tsx',
  'src/app/(dashboard)/nota/[patientId]/[notaId]/page.tsx',
  'src/app/(dashboard)/hospitalizacion/[internamientoId]/page.tsx',
]

describe('el defecto existe, y sigue existiendo', () => {
  it('`new Date` sobre una fecha suelta la lee como medianoche UTC', () => {
    // Es el fallo entero, en una línea. Si esto dejara de ser cierto, el
    // arreglo sobraría — y este caso lo diría en vez de proteger un fantasma.
    const d = new Date('2026-09-01')
    expect(d.getUTCHours()).toBe(0)
    expect(d.toISOString().slice(0, 10)).toBe('2026-09-01')
    // Y al oeste de Greenwich, esa medianoche cae el día anterior en local.
    // Se demuestra con aritmética explícita, sin depender del huso del entorno.
    const enMexico = new Date(d.getTime() - 6 * 60 * 60 * 1000)
    expect(enMexico.getUTCDate(), 'en UTC−6 el 1 de septiembre se lee como 31 de agosto').toBe(31)
    expect(enMexico.getUTCMonth()).toBe(7)   // agosto
  })
})

describe('la fecha de la nota es el día que fue', () => {
  it('una fecha suelta se escribe como su día, en cualquier huso', () => {
    const salida = fechaLegible('2026-09-01')
    expect(salida).toContain('2026')
    // El DÍA es lo que se corría. Se comprueba el número y el mes, sin fijar la
    // abreviatura: «sep» y «sept» dependen de la versión de ICU del entorno, y
    // atar el caso a eso lo haría fallar por algo que no es el defecto.
    expect(salida, 'volvió a correrse un día').toMatch(/\b1\b/)
    expect(salida, 'volvió a correrse un día').not.toMatch(/ago|31/)
    // Y el día del objeto Date es el que dice la cadena.
    expect(fechaLocalDesdeISO('2026-09-01').getDate()).toBe(1)
  })

  it('y NO le inventa una hora que nadie registró', () => {
    const salida = fechaLegible('2026-09-01')
    expect(salida, 'la hora es inventada: el dato no la tiene').not.toMatch(/\d{1,2}:\d{2}/)
    expect(salida).not.toMatch(/a\. ?m\.|p\. ?m\./)
  })

  it('pero una marca de tiempo completa sí enseña su hora — ahí el instante ES el dato', () => {
    const salida = fechaLegible('2026-09-01T14:30:00.000Z')
    expect(salida).toMatch(/\d{1,2}:\d{2}/)
  })

  it('vacío es vacío: no se pinta una fecha para un hueco', () => {
    expect(fechaLegible(null)).toBe('')
    expect(fechaLegible(undefined)).toBe('')
    expect(fechaLegible('')).toBe('')
    expect(fechaLegible('no-es-una-fecha')).toBe('')
  })
})

describe('las tres pantallas de encuentro usan el ayudante', () => {
  it('ninguna vuelve a construir la fecha a mano', () => {
    const culpables: string[] = []
    for (const p of PANTALLAS_DE_ENCUENTRO) {
      const limpio = leer(p)
        .replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ')
        .replace(/\/\*[\s\S]*?\*\//g, ' ')
      if (/new Date\([^)]*fechaConsulta[^)]*\)/.test(limpio)) culpables.push(p)
    }
    expect(
      culpables,
      `vuelven a leer una fecha suelta como UTC:\n${culpables.join('\n')}`,
    ).toEqual([])
  })

  it('y las tres importan el ayudante compartido, no una copia', () => {
    const sinAyudante = PANTALLAS_DE_ENCUENTRO.filter(
      p => !leer(p).includes("import { fechaLegible } from '@/lib/fecha-local'"),
    )
    expect(sinAyudante, `no usan el ayudante: ${sinAyudante.join(', ')}`).toEqual([])
  })
})
