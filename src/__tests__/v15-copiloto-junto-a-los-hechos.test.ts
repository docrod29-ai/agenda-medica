/**
 * V15-ENCOUNTER-MODE-001 (Fase 5, §8 comportamiento #8 «contextual
 * intelligence appears beside relevant facts») — el Copiloto y el Panel de
 * Razonamiento se pintan DESPUÉS de Secciones narrativas/Diagnósticos/
 * Medicamentos, no antes.
 *
 * ── QUÉ PROTEGE ─────────────────────────────────────────────────────────────
 *
 * Al re-medir los 9 comportamientos de §8 contra el código actual (con los
 * hallazgos #1 y #5 ya cerrados por rebanadas previas de esta misma fase) se
 * encontró que el comportamiento #8 estaba solo PARCIALMENTE resuelto: el
 * Copiloto (motor de sugerencias — dosis, alergia, renal, prevención) y el
 * Panel de Razonamiento vivían ANTES de Secciones narrativas, Diagnósticos y
 * Medicamentos en el orden vertical de la página — una sola columna sin
 * pestañas (confirmado: `grep gridTemplateColumns` sólo encuentra la
 * cuadrícula de Signos vitales, ninguna estructura de dos columnas).
 *
 * El médico leía "para este paciente…" y las alertas de dosis/alergia ANTES
 * de haber siquiera llegado a la lista editable de Diagnósticos/Medicamentos
 * que las dispara — la inteligencia contextual quedaba desconectada de los
 * hechos que interpreta, no "al lado" de ellos (`entradaCopiloto` SÍ lee
 * `diagnosticos`/`medicamentos`/`signosNum` — el dato ya estaba ahí; era la
 * POSICIÓN en la página la que no acompañaba al dato).
 *
 * Corrección: se movió el bloque `<Copiloto>` + `<PanelRazonamiento>` (sin
 * tocar una sola prop) a que se pinte DESPUÉS de que el médico terminó de
 * capturar Secciones narrativas + Diagnósticos + Medicamentos, y justo antes
 * de "Validación + Acciones" (el cierre/firma) — el Copiloto reacciona a lo
 * que YA quedó fijado, justo antes de firmar, en vez de adelantar una
 * opinión sobre datos que el médico todavía no ha escrito.
 *
 * `entradaCopiloto` (el useMemo que alimenta ambos componentes) no se tocó:
 * mismo dato, sólo cambió dónde se pinta.
 *
 * Probado al revés: contra `git show HEAD:` previo a este cambio, `<Copiloto`
 * aparecía ANTES de la sección "Diagnósticos" y de la sección "Medicamentos"
 * en el texto fuente — los dos primeros casos de la primera suite fallan
 * contra esa versión.
 *
 * ── QUÉ NO CUBRE ─────────────────────────────────────────────────────────────
 *
 * · No renderiza React ni mide posición en el DOM: análisis estático de
 *   fuente (orden textual == orden de render, mismo patrón que el resto de
 *   guardianes `v15-*` de esta fase — el repo no usa
 *   @testing-library/react). La confirmación visual en navegador real vive
 *   en `docs/design/capturas/v15-copiloto-junto-a-los-hechos/`.
 * · No resuelve la asociación FINA por hecho individual (p. ej. una
 *   sugerencia de interacción específica pegada a la fila exacta del
 *   medicamento que la dispara) — eso exige rediseñar el componente
 *   Medicamentos/Diagnósticos en sí, trabajo de Fase 8
 *   (`V15-NOTE-PLAN-CONTINUITY-001`) o Fase 10
 *   (`V15-VISUAL-SYSTEM-001`), no de esta rebanada.
 * · No cubre `Herramientas`, `Evidencia (PubMed)` ni `PROA` — esos paneles
 *   son herramientas bajo demanda, no el motor de sugerencias reactivo de
 *   §8.8, y no se tocaron esta corrida.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const PAGE = readFileSync(
  join(process.cwd(), 'src/app/(dashboard)/consulta/[patientId]/page.tsx'),
  'utf8',
)

function indiceUnico(marca: string): number {
  const i = PAGE.indexOf(marca)
  expect(i, `no se encontró "${marca}" en la página`).toBeGreaterThan(-1)
  expect(PAGE.indexOf(marca, i + 1), `"${marca}" aparece más de una vez`).toBe(-1)
  return i
}

describe('V15 — el Copiloto se pinta junto a los hechos que interpreta, no antes de que existan', () => {
  const iSeccionesNarrativas = indiceUnico("{/* ── Secciones narrativas ── */}")
  const iDiagnosticos = indiceUnico('<Section title="Diagnósticos" icon={<ShieldCheck size={15} />}>')
  const iMedicamentos = indiceUnico('id="seccion-medicamentos"')
  const iCopiloto = indiceUnico('<Copiloto')
  const iPanelRazonamiento = indiceUnico('<PanelRazonamiento entrada={entradaCopiloto} embebido />')
  const iValidacionAcciones = indiceUnico('{/* ── Validación + Acciones ── */}')

  it('Secciones narrativas → Diagnósticos → Medicamentos → Copiloto, en ese orden', () => {
    expect(iSeccionesNarrativas).toBeLessThan(iDiagnosticos)
    expect(iDiagnosticos).toBeLessThan(iMedicamentos)
    expect(iMedicamentos).toBeLessThan(iCopiloto)
  })

  it('el Panel de Razonamiento queda justo junto al Copiloto (no se separaron)', () => {
    expect(iCopiloto).toBeLessThan(iPanelRazonamiento)
    expect(iPanelRazonamiento - iCopiloto).toBeLessThan(1500) // bloque contiguo, no reordenado a distancia
  })

  it('Copiloto/PanelRazonamiento quedan ANTES del cierre (Validación + Acciones), no después', () => {
    expect(iPanelRazonamiento).toBeLessThan(iValidacionAcciones)
  })
})

describe('V15 — freeze funcional: mover el bloque no cambió lo que calcula ni lo que hace', () => {
  it('Copiloto sigue recibiendo la MISMA entrada y los MISMOS callbacks que antes', () => {
    const i = PAGE.indexOf('<Copiloto')
    const bloque = PAGE.slice(i, i + 500)
    expect(bloque).toContain('entrada={entradaCopiloto}')
    expect(bloque).toContain("onAgregarANota={agregarASeccion('copiloto', 'Valoración asistida')}")
    expect(bloque).toContain('prefs={prefsIA}')
    expect(bloque).toContain('const uid = auth.currentUser?.uid')
    expect(bloque).toContain('if (clinicId && uid) registrarAceptacion(clinicId, uid, cat)')
  })

  it('PanelRazonamiento sigue gateado por la MISMA condición de "hay algo que razonar"', () => {
    expect(PAGE).toContain(
      "{(diagnosticos.length > 0 || medicamentos.length > 0 || resumen || Object.keys(signosNum).length > 0) && (",
    )
    expect(PAGE).toContain('Cómo razoné este caso · 12 pasos con fuente y confianza')
  })

  it('entradaCopiloto (el useMemo que alimenta ambos) no se tocó', () => {
    expect(PAGE).toContain('const entradaCopiloto = useMemo(() => ({')
  })
})
