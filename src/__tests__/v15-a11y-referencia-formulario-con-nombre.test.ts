/**
 * V15-A11Y-001 (2ª rebanada) — EL FORMULARIO DE /referencia TIENE NOMBRE:
 * LA ÚNICA DEUDA AXE CRÍTICA DEL INVENTARIO MUERE.
 *
 * ── QUÉ FALLABA ──────────────────────────────────────────────────────────────
 *
 * La carta de referencia/contrarreferencia — una hoja que viaja a OTRO médico —
 * se componía en un formulario donde NINGUNO de los nueve controles (2 selects,
 * 2 inputs, 5 textareas) tenía nombre accesible: los `<label>` existían VISUALES
 * pero sin `htmlFor`, y los controles sin `id`. axe: `label` (CRÍTICO) +
 * `select-name` — la única deuda de severidad crítica de todo el inventario de
 * V15-A11Y-001. Un lector de pantalla anunciaba «cuadro de edición, en blanco»
 * nueve veces: imposible saber si estabas dictando el motivo o el tratamiento.
 *
 * ── CÓMO SE DESCUBRIÓ ────────────────────────────────────────────────────────
 *
 * La primera medición axe de esta pantalla la hizo de pasada el arnés de la
 * franja de instrumentos (Fase 10) — la pantalla nunca había tenido arnés
 * propio. El hallazgo se anotó al backlog de V15-A11Y-001 y el inventario de la
 * 1ª rebanada lo priorizó como candidata inmediata por su severidad.
 *
 * ── LA CAUSA RAÍZ ────────────────────────────────────────────────────────────
 *
 * La pantalla hablaba su propio dialecto de formulario: dos `React.CSSProperties`
 * locales (`input`, `label`) definidos a mano en el cuerpo del componente,
 * anteriores al sistema. Como la asociación label↔control no se ve en pantalla,
 * nadie la echó de menos: el defecto es invisible para quien no navega con
 * tecnología de apoyo — la definición exacta de la deuda que sólo axe caza.
 *
 * ── LA REGLA QUE LO HACE SEGURO ──────────────────────────────────────────────
 *
 * Todo control del formulario habla las clases del sistema (`.label`/`.input` —
 * las mismas que /login y /registro pagaron en su rebanada) y lleva su pareja
 * `htmlFor`/`id`. El dialecto local muere: cero estilos de formulario a mano.
 *
 * ── QUÉ NO CUBRE ─────────────────────────────────────────────────────────────
 *
 * No corre axe ni mide el DOM: eso lo hace el arnés
 * `scripts/design/capturar-referencia-formulario-v15.mjs` (navegador real, dos
 * temas, móvil, y `labeledby` computado control por control). No vigila la HOJA
 * impresa (el papel es fijo a propósito y se imprime por `imprimirElemento`), ni
 * el resto del backlog a11y (contrastes de /chat, botón «Editar»,
 * `nested-interactive` de /pacientes): rebanadas siguientes.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const src = readFileSync(join('src', 'app', '(dashboard)', 'referencia', '[patientId]', 'page.tsx'), 'utf8')
const sinComentarios = src
  .replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\/.*/g, '')

const IDS = [
  'ref-tipo', 'ref-urgencia', 'ref-destino', 'ref-institucion',
  'ref-motivo', 'ref-resumen', 'ref-diagnosticos', 'ref-tratamiento', 'ref-estudios',
] as const

describe('V15-A11Y-001 — el formulario de /referencia tiene nombre', () => {
  it('los nueve controles llevan su pareja htmlFor/id', () => {
    for (const id of IDS) {
      expect(sinComentarios, `falta htmlFor="${id}"`).toContain(`htmlFor="${id}"`)
      expect(sinComentarios, `falta id="${id}"`).toContain(`id="${id}"`)
    }
  })

  it('los labels y controles hablan las clases del sistema, no el dialecto local', () => {
    const labels = sinComentarios.match(/className="label"/g) ?? []
    expect(labels.length, 'un .label por control').toBeGreaterThanOrEqual(IDS.length)
    const inputs = sinComentarios.match(/className="input"/g) ?? []
    expect(inputs.length, 'un .input por control').toBeGreaterThanOrEqual(IDS.length)
    // El dialecto muere: ni los consts locales ni un label/select/textarea
    // estilado a mano con ellos.
    expect(sinComentarios).not.toMatch(/const input: React\.CSSProperties/)
    expect(sinComentarios).not.toMatch(/const label: React\.CSSProperties/)
    expect(sinComentarios).not.toMatch(/<label style=\{label\}/)
    expect(sinComentarios).not.toMatch(/style=\{input\}/)
  })

  it('el título de la carta es el <h1> de la pantalla (page-has-heading-one)', () => {
    // Encontrado por el PRIMER arnés propio de esta página, pagado en la misma
    // corrida (precedente de la 4ª rebanada de REMAINING-SCREENS).
    expect(sinComentarios).toMatch(/<h1 style=\{\{ textAlign: 'center', fontSize: 15, fontWeight: 700/)
    expect(sinComentarios).toContain('{titulo}')
  })

  it('§24: «Atrás» alcanza los 44px táctiles', () => {
    const atras = sinComentarios.slice(sinComentarios.indexOf('onClick={volver}'), sinComentarios.indexOf('Atrás'))
    expect(atras).toContain('minHeight: 44')
  })

  it('congelado funcional: la carta sigue componiéndose y saliendo igual', () => {
    // Prellenado desde la última nota (preferir firmada; ?nota= manda).
    expect(sinComentarios).toContain("searchParams.get('nota')")
    expect(sinComentarios).toContain("notas.find(n => n.estado === 'firmada')")
    /* Alergias SIEMPRE desde el campo estructurado — la hoja viaja a otro
       médico. Desde MI-002 la llamada es `alergiasParaElPapel(patient)`, que
       envuelve a `alergiasParaImpreso` y además decide qué se dice cuando el
       expediente está vacío (antes decía «Negadas / no referidas», que es una
       afirmación clínica que nadie hizo). Cualquiera de las dos satisface lo
       que esta prueba congela: que la fuente no sea el texto libre en crudo. */
    expect(sinComentarios).toMatch(/alergiasPara(Impreso|ElPapel)\(patient\)/)
    // Cédula ausente se DECLARA, no se imprime un guion.
    expect(sinComentarios).toContain('[FALTA CÉDULA PROFESIONAL]')
    // Mismas salidas: PDF + impresión del mismo nodo #doc.
    expect(sinComentarios).toContain("document.getElementById('doc')")
    expect(sinComentarios).toContain('descargarComoPDF(')
    expect(sinComentarios).toContain('imprimirElemento(')
    // La compuerta de config sin cargar sigue frenando las dos salidas.
    expect((sinComentarios.match(/if \(configError\) return/g) ?? []).length).toBe(2)
  })
})
