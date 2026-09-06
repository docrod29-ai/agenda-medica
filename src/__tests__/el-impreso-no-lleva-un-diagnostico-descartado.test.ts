/**
 * GOLDEN — el impreso no lleva un diagnóstico que el médico descartó.
 *
 * Panel de Lujo, sep-2026: hallazgos PC-001 (auditor P-cirugía) y PO-001
 * (auditor P-ortopedia), los dos CONFIRMADOS por el equipo rojo en P1. Esta
 * prueba cubre la mitad que vive en el motor de impresión del médico; la del
 * portal (`/api/portal` y el paquete de visita) es de otra rebanada y tiene su
 * propia reproducción.
 *
 * ── QUÉ FALLABA ──────────────────────────────────────────────────────────────
 * `src/lib/expediente/fusionar-diagnosticos.ts:212`
 *
 *     const principal = conTexto.find(d => d.tipo === 'definitivo') ?? conTexto[0]
 *
 * PREFERÍA el definitivo, pero cuando no había ninguno caía al primero con
 * texto — que podía ser un `descartado`, un `diferencial` o un problema ya
 * `resuelto`. Es la función que imprime el diagnóstico de la RECETA y de la
 * ORDEN (sus dos únicos llamadores).
 *
 * ── CÓMO SE DESCUBRIÓ ────────────────────────────────────────────────────────
 * El equipo rojo lo encontró al revisar la propuesta de PO-001, que pedía
 * reusar `diagnosticoParaImprimir` en el portal: al leerla notó que la función
 * «tampoco excluye un descartado cuando es el ÚNICO con texto», y dejó dicho
 * que copiarla sin más no cerraba el caso del esguince con la fractura
 * descartada como único diagnóstico.
 *
 * ── CAUSA RAÍZ ───────────────────────────────────────────────────────────────
 * `estaVigente` —el criterio de «esto sigue siendo un problema del paciente»—
 * lo aplicaban la proyección longitudinal, el resumen del expediente y
 * `problemasDelCuadro`. El único lector que NO lo aplicaba era el que imprime.
 *
 * ── REGLA ────────────────────────────────────────────────────────────────────
 * REG-516, la regla del dueño: en el impreso, «nomás el principal». Y
 * clinical-safety: un documento con cédula profesional no puede afirmar lo
 * contrario de lo que el médico concluyó. El paciente que lo lleva a la
 * farmacia o se lo reenvía a su jefe no tiene cómo detectar el error.
 *
 * ── TIPO DE PRUEBA ───────────────────────────────────────────────────────────
 * COMPORTAMIENTO sobre la función pura. Se prueba al revés: el caso del
 * esguince —un solo diagnóstico, y descartado— falla sin el arreglo, porque
 * antes devolvía justo esa cadena.
 *
 * ── QUÉ NO CUBRE ─────────────────────────────────────────────────────────────
 * No cubre el portal del paciente (`/api/portal`, acción `documentos`) ni el
 * `encounterSummary` del paquete de visita, que arman su propia lista y no
 * llaman a esta función: van en el handoff. No decide si un `presuntivo` debe
 * salir en la copia del paciente —aquí SÍ se imprime, porque es el diagnóstico
 * de trabajo con el que se receta y lo escribió el médico—. No inventa
 * descripción a partir del código CIE-10.
 */
import { describe, it, expect } from 'vitest'
import { diagnosticoParaImprimir } from '@/lib/expediente/fusionar-diagnosticos'

const DEFINITIVO = { descripcion: 'Faringitis aguda sintética', codigoCIE10: 'J02.9', tipo: 'definitivo' }
const DESCARTADO = { descripcion: 'Fractura sintética de tobillo', tipo: 'descartado' }
const DIFERENCIAL = { descripcion: 'Tendinitis sintética', tipo: 'diferencial' }
const RESUELTO = { descripcion: 'Cuadro sintético resuelto', tipo: 'definitivo', estado: 'resuelto' }
const PRESUNTIVO = { descripcion: 'Esguince sintético de tobillo', tipo: 'presuntivo' }

describe('PC-001 · PO-001 — lo descartado no se imprime', () => {
  it('el caso del esguince: si el ÚNICO con texto es un descartado, el campo sale VACÍO', () => {
    // Antes devolvía 'Fractura sintética de tobillo': la receta decía, con
    // cédula y firma, justo lo que el médico acababa de descartar.
    expect(diagnosticoParaImprimir([DESCARTADO])).toBe('')
  })

  it('un diferencial tampoco: es una hipótesis, no el diagnóstico del paciente', () => {
    expect(diagnosticoParaImprimir([DIFERENCIAL])).toBe('')
  })

  it('un problema ya resuelto no se imprime como si fuera de hoy', () => {
    expect(diagnosticoParaImprimir([RESUELTO])).toBe('')
  })

  it('con un definitivo delante, el descartado no le gana ni le añade nada', () => {
    expect(diagnosticoParaImprimir([DESCARTADO, DEFINITIVO]))
      .toBe('Faringitis aguda sintética (J02.9)')
  })

  it('un presuntivo SÍ se imprime: es con lo que se receta, y lo escribió el médico', () => {
    expect(diagnosticoParaImprimir([DESCARTADO, PRESUNTIVO])).toBe('Esguince sintético de tobillo')
  })

  it('control: lo que ya funcionaba sigue igual — uno solo, y el código es el adorno', () => {
    expect(diagnosticoParaImprimir([DEFINITIVO, PRESUNTIVO])).toBe('Faringitis aguda sintética (J02.9)')
    expect(diagnosticoParaImprimir([{ codigoCIE10: 'J02.9' }])).toBe('')
    expect(diagnosticoParaImprimir([])).toBe('')
    expect(diagnosticoParaImprimir(undefined)).toBe('')
  })
})
