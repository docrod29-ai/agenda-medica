/**
 * El lienzo de /consulta tiene un esquema de encabezados honesto —
 * V15-A11Y-001, 5ª rebanada.
 *
 * QUÉ FALLABA: axe midió `heading-order` (moderate) en cada captura POBLADA
 * de V15-ENCOUNTER-MODE-001 — el nodo señalado: `<h4>Sus medicamentos</h4>`
 * de la hoja del paciente. La página tiene UN encabezado propio (el h1 con el
 * nombre del paciente) y las secciones mayores del lienzo ponían su título en
 * `<span>`; los títulos internos saltaban directo a h4. Para un lector de
 * pantalla que navega por encabezados, el esquema era h1 → h4: dos niveles
 * fantasma, y las secciones («Qué es de qué», «Lo que se lleva el paciente»)
 * invisibles en esa navegación. `NerPanel` tenía el defecto simétrico: su
 * título era h3 tras el h1 — un salto, y sólo se veía cuando el panel de
 * entidades se abría.
 *
 * CÓMO SE DESCUBRIÓ: primera captura de V15-ENCOUNTER-MODE-001 que pobló
 * Diagnósticos/Medicamentos (`capturar-copiloto-junto-a-hechos-v15.mjs`) —
 * con datos, la hoja del paciente renderiza y su h4 entra al árbol. Anotado
 * PREEXISTENTE a `V15-A11Y-001` (el inventario de la 1ª rebanada, familia 8);
 * esta rebanada lo re-midió en vivo antes de tocar nada.
 *
 * CAUSA RAÍZ: los títulos de sección se escribieron como cromo visual
 * (`<span>` con peso) y los internos como `<h4>` «porque se ven de ese
 * tamaño» — el nivel del encabezado se eligió por estética, no por posición
 * en el esquema. Nadie lo vio porque el esquema sólo existe para quien navega
 * por encabezados.
 *
 * LA REGLA QUE LO HACE SEGURO: toda sección mayor del lienzo de consulta
 * porta su propio `<h2>`; los títulos internos son `<h3>`. Así CUALQUIER
 * combinación de render (la hoja sola, el plan solo, entidades abiertas o no)
 * produce un esquema sin saltos: h1 → h2 → h3. El estilo viaja en línea, así
 * que el cambio de etiqueta no mueve un píxel (margin: 0 explícito donde el
 * user-agent metería margen).
 *
 * QUÉ NO CUBRE: que axe mida 0 `heading-order` de verdad — con la página
 * poblada, en los dos temas y en móvil — lo mide el arnés de navegador real
 * de esta corrida (`capturar-esquema-encabezados-v15.mjs`). Tampoco vigila
 * superficies fuera de /consulta: el inventario por grep de esta rebanada
 * encontró h4+ SÓLO en estos dos componentes; si otra pantalla gana un h4
 * huérfano mañana, ese será su propio defecto (axe lo caza por superficie).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const HOJA = readFileSync(join(process.cwd(), 'src/components/HojaParaElPaciente.tsx'), 'utf8')
const PLAN = readFileSync(join(process.cwd(), 'src/components/PlanPorProblema.tsx'), 'utf8')
const NER = readFileSync(join(process.cwd(), 'src/components/NerPanel.tsx'), 'utf8')
const CONSULTA = readFileSync(
  join(process.cwd(), 'src/app/(dashboard)/consulta/[patientId]/page.tsx'),
  'utf8',
)

describe('esquema de encabezados del lienzo de consulta (heading-order muere)', () => {
  it('la hoja del paciente porta su h2 y sus bloques son h3 — no h4', () => {
    // Falla contra el árbol previo: el título era <span> y los bloques <h4>.
    expect(HOJA).toMatch(/<h2[^>]*>\s*Lo que se lleva el paciente\s*<\/h2>/)
    expect(HOJA).toMatch(/<h3 style/)
    expect(HOJA).not.toMatch(/<h4/)
  })

  it('el plan por problema porta su h2 y sus problemas son h3 — no h4', () => {
    // Falla contra el árbol previo: el título era <span> y los grupos <h4>.
    expect(PLAN).toMatch(/<h2[^>]*>\s*Qué es de qué\s*<\/h2>/)
    expect(PLAN).toMatch(/<h3 style/)
    expect(PLAN).not.toMatch(/<h4/)
  })

  it('el panel de entidades habla h2, como toda sección mayor del lienzo', () => {
    // Falla contra el árbol previo: era h3 directo tras el h1 del paciente.
    expect(NER).toMatch(/<h2[^>]*>[\s\S]{0,120}Entidades clínicas/)
    expect(NER).not.toMatch(/<h3/)
  })

  it('los h2 nuevos declaran margin: 0 — el cambio de etiqueta no mueve un píxel', () => {
    // El user-agent le pondría margen vertical a un h2 sin estilo; el freeze
    // visual de la rebanada depende de que el margen esté anulado en línea.
    for (const fuente of [HOJA, PLAN]) {
      const h2 = fuente.match(/<h2 style=\{\{([^}]*)\}\}/)
      expect(h2).not.toBeNull()
      expect(h2![1]).toContain('margin: 0')
    }
    expect(NER).toMatch(/<h2 style=\{\{[^}]*margin: 0/)
  })

  it('freeze funcional: la consulta sigue montando las tres secciones', () => {
    // Protege contra un «arreglo» que resolviera el esquema quitando piezas.
    expect(CONSULTA).toContain('<HojaParaElPaciente')
    expect(CONSULTA).toContain('<PlanPorProblema')
    expect(CONSULTA).toContain('<NerPanel')
  })

  it('el h1 del paciente sigue siendo el único h1 del lienzo', () => {
    // El esquema h1 → h2 → h3 presume UN h1: el nombre del paciente.
    const h1s = CONSULTA.match(/<h1[\s>]/g) ?? []
    expect(h1s.length).toBe(1)
  })
})
