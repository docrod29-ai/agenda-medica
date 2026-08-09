/**
 * GOLDEN — REG-270 · un valor de pánico CENSURADO se archivaba como normal.
 *
 * ── QUÉ FALLABA ──────────────────────────────────────────────────────────────
 *
 * El laboratorio no siempre da el número: cuando el analizador se satura reporta
 * un límite. «Glucosa >400 mg/dL». «Plaquetas <20 ×10³/µL». «<50» en una
 * hipoglucemia severa.
 *
 * El prompt de visión ordena, con esas palabras, conservar el «<» o el «>»
 * («Si el valor trae "<" o ">", consérvalo en "valor"»), y la IA lo devolvía.
 * Pero `aNumero` pelaba el signo y `evaluarCriticoLab` comparaba el número
 * desnudo contra cortes ESTRICTOS:
 *
 *     «>400» → 400 → `400 > 400` = false → **no crítico**
 *     «<50»  →  50 → `50 < 50`   = false → **no crítico**
 *
 * Y no quedaba ni en ámbar: salía `evaluable: true`, o sea «se juzgó y está
 * bien». El renglón se guardaba en el expediente como un valor normal.
 *
 * ── CÓMO SE DESCUBRIÓ ────────────────────────────────────────────────────────
 *
 * Auditoría del 7-ago-2026 sobre `docs/audit/hallazgos-crudos-workflow.json`
 * (P1). Reproducido antes de tocar nada con `validarPanel` y con `esCriticoLab`
 * sobre las dos rutas: los cinco casos fallaban.
 *
 * ── POR QUÉ IMPORTA PARA UN PACIENTE ─────────────────────────────────────────
 *
 * Los valores censurados no son casos raros: aparecen precisamente en el
 * extremo, que es donde vive el valor de pánico. Una glucosa «<50» sin alerta,
 * una plaqueta «<20» sin alerta, un INR «>5» sin alerta. La red de seguridad
 * que existe «para que un potasio de 7.2 no se pierda» tenía un agujero justo
 * en la forma en que un laboratorio reporta los extremos.
 *
 * ── LA REGLA QUE LO HACE SEGURO ──────────────────────────────────────────────
 *
 * Se razona sobre el INTERVALO, que es lo único que el reporte afirma:
 * «>n» ⇒ (n, ∞); «<n» ⇒ (−∞, n). Si el intervalo entero cae del lado crítico,
 * es crítico. Si cae entero del lado sano, es sano. Si CRUZA el umbral, no se
 * sabe — y se dice que no se sabe (`evaluable: false`), en vez de darlo por
 * bueno. Ningún umbral nuevo: todos son los que ya estaban en `CRITICOS`.
 *
 * ── QUÉ NO CUBRE ─────────────────────────────────────────────────────────────
 *
 * - NO valida los umbrales en sí: siguen sin fuente citada y en
 *   `pendiente_validacion` (C-1 del dueño). Esto arregla CÓMO se comparan, no
 *   CONTRA QUÉ.
 * - NO cubre el rango de referencia del reporte (`referencia`), que sigue
 *   guardándose como texto sin interpretar.
 * - NO cubre valores censurados en `labs-desde-texto.ts` ni en el dictado de
 *   UCI: ésos van por `numA` (REG-036), con cortes inclusivos, y son otro
 *   camino.
 * - NO decide qué hace la pantalla con un «no evaluable»: hoy lo pinta en
 *   ámbar, y qué bloquea o no lo decide el médico dueño.
 */
import { describe, it, expect } from 'vitest'
import { evaluarCriticoLab, esCriticoLab, censuraDe } from '@/lib/hospital/lab-criticos'
import { validarPanel, seriesDesdeHistorial } from '@/lib/expediente/laboratorio/extraccion'
import { parsearLabsFhir } from '@/lib/hospital/fhir-import'

describe('censuraDe — leer el comparador del reporte', () => {
  it('lee > y ≥ como «>», < y ≤ como «<» (igual que el antibiograma)', () => {
    expect(censuraDe('>400')).toBe('>')
    expect(censuraDe('≥400')).toBe('>')
    expect(censuraDe('<50')).toBe('<')
    expect(censuraDe('≤50')).toBe('<')
  })
  it('un valor normal no está censurado', () => {
    expect(censuraDe('120')).toBeUndefined()
    expect(censuraDe(120)).toBeUndefined()
    expect(censuraDe(undefined)).toBeUndefined()
  })
})

describe('EL DEFECTO — el intervalo entero cae del lado crítico', () => {
  it('glucosa «>400» es hiperglucemia de pánico (corte alto = 400)', () => {
    expect(evaluarCriticoLab('Glucosa', '>400', 'mg/dL')).toEqual({ critico: true, evaluable: true })
  })
  it('glucosa «<50» es hipoglucemia de pánico (corte bajo = 50)', () => {
    expect(evaluarCriticoLab('Glucosa', '<50', 'mg/dL')).toEqual({ critico: true, evaluable: true })
  })
  it('potasio «>6.5» dispara la alerta de arritmia', () => {
    expect(esCriticoLab('Potasio', '>6.5', 'mmol/L')).toBe(true)
  })
  it('plaquetas «<20» disparan la alerta de sangrado', () => {
    expect(esCriticoLab('Plaquetas', '<20', 'x10^3/uL')).toBe(true)
  })
  it('INR «>5» dispara la alerta aunque el corte sea estricto', () => {
    expect(esCriticoLab('INR', '>5', '')).toBe(true)
  })
})

describe('LO QUE NO DEBE PASAR — no se inventan alertas', () => {
  it('troponina «<0.01» NO es crítica: el intervalo entero está bajo el corte de 0.04', () => {
    expect(evaluarCriticoLab('Troponina I', '<0.01', 'ng/mL')).toEqual({ critico: false, evaluable: true })
  })
  it('fibrinógeno «>150» NO es crítico: sólo tiene corte bajo (100) y ya lo pasó', () => {
    expect(evaluarCriticoLab('Fibrinógeno', '>150', 'mg/dL')).toEqual({ critico: false, evaluable: true })
  })
  it('un valor sin censurar sigue comparándose exactamente como antes', () => {
    expect(evaluarCriticoLab('Glucosa', 400, 'mg/dL')).toEqual({ critico: false, evaluable: true })
    expect(evaluarCriticoLab('Glucosa', 401, 'mg/dL')).toEqual({ critico: true, evaluable: true })
    expect(evaluarCriticoLab('Glucosa', 50, 'mg/dL')).toEqual({ critico: false, evaluable: true })
    expect(evaluarCriticoLab('Glucosa', 49, 'mg/dL')).toEqual({ critico: true, evaluable: true })
  })
})

describe('LA DUDA SE DECLARA — el intervalo cruza el umbral', () => {
  it('glucosa «>200» contra un corte de 400: no se sabe, y no se da por normal', () => {
    const ev = evaluarCriticoLab('Glucosa', '>200', 'mg/dL')
    expect(ev.critico).toBe(false)
    expect(ev.evaluable).toBe(false)
    expect(ev.motivo).toMatch(/censurado/)
  })
  it('troponina «<0.5» contra un corte de 0.04: podría ser 0.3 y sería crítica', () => {
    expect(evaluarCriticoLab('Troponina I', '<0.5', 'ng/mL').evaluable).toBe(false)
  })
  it('glucosa «<70» contra un corte bajo de 50: podría ser 40', () => {
    expect(evaluarCriticoLab('Glucosa', '<70', 'mg/dL').evaluable).toBe(false)
  })
})

describe('LA RUTA COMPLETA — del PDF al expediente', () => {
  it('el panel marca crítica la glucosa «>400» y conserva el comparador', () => {
    const p = validarPanel({ fecha: '2026-08-07', filas: [{ estudio: 'Glucosa', valor: '>400', unidad: 'mg/dL' }] })
    expect(p.resultados[0]).toMatchObject({ valor: 400, censurada: '>', critico: true })
  })
  it('el panel marca crítica la plaqueta «<20»', () => {
    const p = validarPanel({ fecha: '2026-08-07', filas: [{ estudio: 'Plaquetas', valor: '<20', unidad: 'x10^3/uL' }] })
    expect(p.resultados[0]).toMatchObject({ censurada: '<', critico: true })
  })
  it('cuando la duda no se puede resolver, el renglón queda en «verificar», no en normal', () => {
    const p = validarPanel({ fecha: '2026-08-07', filas: [{ estudio: 'Glucosa', valor: '>200', unidad: 'mg/dL' }] })
    expect(p.resultados[0].critico).toBe(false)
    expect(p.resultados[0].noEvaluable).toBe(true)
    expect(p.resultados[0].motivoNoEvaluable).toMatch(/censurado/)
  })
  it('el comparador llega hasta el punto de la serie, que es lo que imprime la franja de críticos', () => {
    const p = validarPanel({ fecha: '2026-08-07', filas: [{ estudio: 'Glucosa', valor: '>400', unidad: 'mg/dL' }] })
    const series = seriesDesdeHistorial([{ fecha: p.fecha, resultados: p.resultados }])
    expect(series[0].puntos[0]).toMatchObject({ valor: 400, censurada: '>', critico: true })
  })
  it('un valor sin censurar no gana el campo: no se ensucia el documento', () => {
    const p = validarPanel({ fecha: '2026-08-07', filas: [{ estudio: 'Glucosa', valor: '95', unidad: 'mg/dL' }] })
    expect(p.resultados[0].censurada).toBeUndefined()
  })
})

describe('LA OTRA FRONTERA — el LIS por FHIR', () => {
  const bundle = (comparator: string | undefined, value: number) => JSON.stringify({
    resourceType: 'Bundle',
    entry: [{ resource: {
      resourceType: 'Observation',
      code: { text: 'Glucosa' },
      valueQuantity: { value, unit: 'mg/dL', ...(comparator ? { comparator } : {}) },
    } }],
  })

  it('el comparator de FHIR sobrevive al import y dispara la alerta', () => {
    const [r] = parsearLabsFhir(bundle('>', 400))
    expect(r.valor).toBe('>400')
    expect(r.critico).toBe(true)
  })
  it('sin comparator, el valor y el juicio son los de siempre', () => {
    const [r] = parsearLabsFhir(bundle(undefined, 400))
    expect(r.valor).toBe('400')
    expect(r.critico).toBe(false)
  })
})
