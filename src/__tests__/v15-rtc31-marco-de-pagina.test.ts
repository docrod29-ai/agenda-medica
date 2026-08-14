/**
 * RTC-31 — el marco de página deja de ser el de cualquier andamio.
 *
 * ── QUÉ FALLABA, Y CÓMO SE MIDIÓ ────────────────────────────────────────────
 *
 * La segunda pasada de §29 (14-ago-2026, sobre 18 capturas nuevas) dejó cinco
 * superficies empatadas en 2.0–2.5 y una sola en **1.0**: `/pendientes`.
 * Pagados los defectos de contenido de las dos peores (RTC-15 y RTC-29), lo
 * que quedaba **dejó de repartirse por pantalla**: es el marco, y es el mismo
 * en las cinco —título + racimo de botones, buscador de ancho completo, fila
 * de píldoras, contenedor de tarjeta con filas dentro, estado vacío ilustrado—.
 *
 * La correlación es lo que da la causa: la única superficie sin ese marco es
 * justo la única que llega al objetivo. Por eso ninguna cantidad de trabajo
 * dentro de las filas bajaba el score de las otras: el contenido ya era de
 * este producto; el marco seguía siendo de cualquiera.
 *
 * ── LA CAUSA RAÍZ ───────────────────────────────────────────────────────────
 *
 * `PageHeader` nació con `subtitle` OPCIONAL. Ocho pantallas de nueve lo
 * pusieron igualmente; la novena —`/pacientes`, la más visitada— no. Una regla
 * que se cumple ocho de nueve veces no es una regla: es una costumbre, y la
 * excepción cae siempre en la pantalla que más prisa tuvo.
 *
 * ── LA REGLA QUE LO HACE SEGURO ─────────────────────────────────────────────
 *
 * La ley entera vive en `docs/design/v15/V15-MARCO-DE-PAGINA.md`. Lo que este
 * guardián fija:
 *
 * 1. `subtitle` es OBLIGATORIO en el tipo — el compilador se encarga, y aquí
 *    se comprueba que nadie lo devuelva a opcional.
 * 2. Toda pantalla que use `PageHeader` pasa un subtítulo, y **no es un eco
 *    del título**.
 * 3. Una lista de trabajo no lleva `.card` alrededor: agrupa el encabezado,
 *    no la caja.
 *
 * Probado al revés: devolviendo `subtitle?:` falla el caso 1; quitando el
 * subtítulo de `/pacientes` falla el 2; devolviendo `<div className="card"` a
 * la lista falla el 4.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · **No cubre las cinco pantallas**: esta rebanada convierte `/pacientes` y
 *   deja el resto declarado en la tabla del documento. Convertirlas de golpe
 *   sin volver a puntuar sería repintar.
 * · **No juzga la CALIDAD del subtítulo** más allá de que no sea un eco: que
 *   una frase explique de verdad de dónde sale el contenido es un juicio, no
 *   una aserción.
 * · No cubre las píldoras de filtro ni el estado vacío (RTC-30): declarados
 *   como pendientes en el documento, no olvidados.
 * · No mide píxeles ni score — eso es el arnés y la re-puntuación.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { globSync } from 'glob'

const leer = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')
const HEADER = leer('src/components/ui/PageHeader.tsx')

describe('RTC-31 — toda pantalla dice qué es', () => {
  it('1 · `subtitle` es obligatorio en el tipo, no una recomendación', () => {
    expect(HEADER, 'subtitle volvió a ser opcional').not.toMatch(/^\s*subtitle\?:/m)
    expect(HEADER).toMatch(/^\s*subtitle: ReactNode/m)
    // Y se pinta siempre: un `subtitle && (…)` dejaría pasar la cadena vacía.
    expect(HEADER).toMatch(/<div className="page-header-sub">\{subtitle\}<\/div>/)
  })

  it('2 · todas las pantallas con cabecera pasan su subtítulo', () => {
    const pantallas = globSync('src/app/**/*.tsx', { cwd: process.cwd() })
      .filter(f => readFileSync(join(process.cwd(), f), 'utf8').includes('<PageHeader'))
    expect(pantallas.length, 'nadie usa PageHeader: el guardián mide el vacío').toBeGreaterThan(5)
    for (const f of pantallas) {
      const src = readFileSync(join(process.cwd(), f), 'utf8')
      const cabeceras = (src.match(/<PageHeader/g) ?? []).length
      const subtitulos = (src.match(/subtitle=/g) ?? []).length
      expect(subtitulos, `${f}: ${cabeceras} cabeceras y ${subtitulos} subtítulos`).toBeGreaterThanOrEqual(cabeceras)
    }
  })

  it('3 · el subtítulo no es un eco del título', () => {
    /**
     * «Pacientes → Listado de pacientes» no informa: repite. La comprobación es
     * deliberadamente floja —sólo caza el eco literal— porque juzgar si una
     * frase explica de verdad de dónde sale el contenido es un juicio, y los
     * juicios se documentan, no se asertan.
     */
    const pantallas = globSync('src/app/**/*.tsx', { cwd: process.cwd() })
      .map(f => [f, readFileSync(join(process.cwd(), f), 'utf8')] as const)
      .filter(([, src]) => src.includes('<PageHeader'))
    for (const [f, src] of pantallas) {
      for (const m of src.matchAll(/title="([^"]+)"\s*(?:\/\*[\s\S]*?\*\/)?\s*subtitle="([^"]+)"/g)) {
        const [, titulo, sub] = m
        expect(sub.toLowerCase().trim(), `${f}: el subtítulo repite el título`).not.toBe(titulo.toLowerCase().trim())
        expect(sub.length, `${f}: el subtítulo es demasiado corto para decir algo`).toBeGreaterThan(20)
      }
    }
  })
})

describe('RTC-31 — una lista de trabajo no lleva tarjeta alrededor', () => {
  const PACIENTES = leer('src/app/(dashboard)/pacientes/page.tsx')

  it('4 · la lista de /pacientes ya no vive dentro de una `.card`', () => {
    expect(PACIENTES).not.toContain('<div className="card" style={{ padding: 0 }}>')
  })

  it('5 · y quien agrupa es el encabezado, que habla el rol del sistema', () => {
    const enc = PACIENTES.slice(PACIENTES.indexOf('function ListaEncabezado'))
    const cuerpo = enc.slice(0, enc.indexOf('\n}'))
    expect(cuerpo).toContain('className="t-overline"')
    // Sin fondo propio: agrupa hablando, no dibujando.
    expect(cuerpo).not.toMatch(/background: 'var\(--s1\)'/)
  })
})
