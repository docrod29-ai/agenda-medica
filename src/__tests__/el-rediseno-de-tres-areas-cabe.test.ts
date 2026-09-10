/**
 * EL REDISEÑO DE TRES ÁREAS CABE EN SU COLUMNA — relevo del PR #478, 10-sep-2026.
 *
 * ── CÓMO SE DESCUBRIÓ ────────────────────────────────────────────────────────
 *
 * Levantando el arnés visual (emulador de Firebase, consultorio sintético,
 * Chromium) sobre la rama de Codex fusionada con main v1194, con una consulta
 * cargada a mano. Las 14 620 pruebas estaban en verde y la pantalla se veía
 * mal: `design-system.md` lo dice —«no se aprueba una interfaz leyendo el
 * código»— y aquí volvió a ser literal.
 *
 * Lo que enseñaron las capturas, a 1440 y a 390 px:
 *   · «Copiar» e «Imprimir» de la hoja del paciente partidos LETRA POR LETRA
 *     («Co / pia / r»): la cabecera no envolvía y los botones se encogían.
 *   · Las filas de medicamento no cabían en la columna de la nota (~600 px):
 *     «Duración» y el bote saltaban de línea y la cabecera de columnas quedaba
 *     descolocada de lo que nombraba.
 *   · A 1280 px, tres columnas con el lateral de la app dejaban el resumen en
 *     ~190 px: «ya no» se salía y se cortaba.
 *   · La columna del asistente quedaba vacía debajo de dos tarjetas mientras
 *     el chat de corrección y el catálogo de herramientas seguían dentro de la
 *     nota, y en el asistente sus cabeceras también se partían.
 *
 * El dueño: «por qué vas a desplegar algo que se ve mal; arregla todo».
 *
 * ── LA CAUSA RAÍZ ────────────────────────────────────────────────────────────
 *
 * Todo lo de dentro de la nota estaba escrito para una columna de ~1 050 px
 * (la página de una sola columna). Meterlo en ~600 sin tocarlo rompe lo que
 * no envuelve. Y los estilos en línea de las filas (`S.row`) ganan a cualquier
 * hoja: una regla sin `!important` no se ve aunque esté cargada — se comprobó
 * en el navegador antes de entenderlo.
 *
 * ── QUÉ NO CUBRE ─────────────────────────────────────────────────────────────
 *
 * Esto vigila el CÓDIGO que arregló lo que se vio: que las reglas existan y
 * que los bloques vivan donde deben. No mide píxeles; eso lo hace el arnés
 * (`scripts/ausculta-transformacion/mirar-la-consulta.mjs`) y hay que volver a
 * mirarlo cada vez que se toque la consulta.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const leer = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')
const PAGE = leer('src/app/(dashboard)/consulta/[patientId]/page.tsx')
const CSS = leer('src/components/consulta/consulta-workspace.module.css')
const HOJA = leer('src/components/HojaParaElPaciente.tsx')
const HERR = leer('src/components/Herramientas.tsx')

describe('la hoja del paciente: los botones no se parten', () => {
  it('la cabecera envuelve y los botones no se encogen ni se cortan', () => {
    const cab = HOJA.slice(HOJA.indexOf('<header style={{'), HOJA.indexOf('</header>'))
    expect(cab).toContain("flexWrap: 'wrap'")
    expect((cab.match(/whiteSpace: 'nowrap', flexShrink: 0/g) ?? []).length).toBe(2)
  })
})

describe('las filas de medicamento en una columna estrecha', () => {
  it('la nota es un contenedor de tamaño y las filas llevan su clase', () => {
    expect(CSS).toContain('.nota { container-type: inline-size; }')
    expect(PAGE).toContain('className="nx-med-cabecera"')
    expect(PAGE).toContain('className="nx-med-fila"')
  })

  it('bajo 720 px de nota, la cabecera se apaga y el nombre ocupa su línea — con !important, porque el estilo en línea gana', () => {
    const q = CSS.slice(CSS.indexOf('@container (max-width: 720px)'))
    expect(q).toContain('.nota :global(.nx-med-cabecera) { display: none !important; }')
    expect(q).toContain('.nota :global(.nx-med-fila) > input:first-child { flex-basis: 100% !important; }')
  })
})

describe('las columnas según el ancho', () => {
  it('tres columnas sólo desde 1440; entre 1280 y 1439, dos, con el asistente al lado', () => {
    expect(CSS).toContain('@media (min-width: 1280px) and (max-width: 1439px)')
    expect(CSS).toContain('@media (min-width: 1440px)')
    expect(CSS).not.toMatch(/@media \(min-width: 1280px\) \{/)
    const dos = CSS.slice(CSS.indexOf('@media (min-width: 1280px) and (max-width: 1439px)'), CSS.indexOf('@media (min-width: 1440px)'))
    expect(dos).toContain('.contexto, .nota, .cierre { grid-column: 1; }')
    expect(dos).toContain('.asistente { grid-column: 2; grid-row: 1 / span 3;')
  })

  it('el resumen y el asistente tienen ancho mínimo en tres columnas', () => {
    const tres = CSS.slice(CSS.indexOf('@media (min-width: 1440px)'))
    expect(tres).toContain('minmax(min(220px, 100%), .75fr) minmax(0, 2fr) minmax(min(280px, 100%), .95fr)')
  })
})

describe('el chat de corrección y las herramientas viven en el asistente', () => {
  const asistente = PAGE.slice(PAGE.indexOf('</>} asistente={<>'), PAGE.indexOf('      </>}>', PAGE.indexOf('</>} asistente={<>')))

  it('los dos bloques están dentro de la prop `asistente`, detrás del copiloto', () => {
    expect(asistente).toContain('Corregir por chat')
    expect(asistente).toContain('<Herramientas {...(() => {')
    expect(asistente.indexOf('<Copiloto')).toBeLessThan(asistente.indexOf('Corregir por chat'))
    expect(asistente.indexOf('Corregir por chat')).toBeLessThan(asistente.indexOf('<Herramientas'))
  })

  it('y no quedaron duplicados fuera', () => {
    expect((PAGE.match(/Corregir por chat/g) ?? []).length).toBe(1)
    expect((PAGE.match(/<Herramientas \{\.\.\.\(\(\) => \{/g) ?? []).length).toBe(1)
  })

  it('el renglón del chat envuelve y su campo puede encoger', () => {
    expect(PAGE).toContain("<div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>\n            <input\n              value={instruccionCorr}")
    expect(PAGE).toContain("style={{ flex: '1 1 160px', minWidth: 0, background: 'var(--s1)'")
  })

  it('la cabecera del catálogo envuelve y sus palabras no se parten', () => {
    const cab = HERR.slice(HERR.indexOf("padding: '9px 13px', borderBottom"), HERR.indexOf('{q.trim() && ('))
    expect(cab).toContain("flexWrap: 'wrap'")
    expect(cab).toContain("HERRAMIENTAS CLÍNICAS</span>")
    expect((cab.match(/whiteSpace: 'nowrap'/g) ?? []).length).toBeGreaterThanOrEqual(3)
    expect(cab).toContain("width: 'min(190px, 100%)'")
  })
})
