/**
 * GOLDEN — el arnés de benchmark mide de verdad y no se autoengaña (#314 punto 11).
 *
 * ── QUÉ FALLABA ─────────────────────────────────────────────────────────────
 *
 * No había forma de medir si la tubería de evidencia ancla lo que debe anclar.
 * Y el riesgo de un benchmark nuevo no es que mida mal: es que mida SIEMPRE
 * bien. Un arnés cuyos casos siempre pasan es una diapositiva, no una medida.
 *
 * ── CÓMO SE DESCUBRIÓ ───────────────────────────────────────────────────────
 *
 * Punto 11 de #314 pide medir tasa de afirmación sin respaldo. Para que ese
 * número signifique algo, el arnés tiene que llevar dentro un caso ADVERSARIAL
 * cuya respuesta correcta sea «esta afirmación NO está respaldada».
 *
 * ── CAUSA RAÍZ ──────────────────────────────────────────────────────────────
 *
 * Un benchmark sólo con casos felices no distingue «el sistema funciona» de
 * «el sistema acepta cualquier cosa».
 *
 * ── LA REGLA QUE LO HACE SEGURO ─────────────────────────────────────────────
 *
 * Cada caso DECLARA cuántas afirmaciones deben quedar respaldadas y cuántas no.
 * `cumple` compara contra lo declarado, así que un caso adversarial cuya
 * afirmación inventada se colara pondría el arnés en rojo.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * NO mide calidad clínica, ni latencia real de ningún proveedor, ni costo real.
 * Está declarado en el encabezado de benchmark.ts y esta prueba comprueba que
 * la declaración siga ahí.
 */
import { describe, it, expect } from 'vitest'
import { correrBenchmarkDeEvidencia, correrCaso, percentilDeLatencias, informeLegible, type CasoDeBenchmark } from '@/lib/evidence-integrations/benchmark'
import { adaptadorSintetico } from '@/lib/evidence-integrations/adaptadores/sintetico'
import { uptodate } from '@/lib/evidence-integrations/adaptadores/no-configurado'

const CTX = { ahora: '2026-08-22T10:00:00.000Z', correlacion: 'corr-bench-001' }

/** El pasaje literal que sí está en SYN-0001 del corpus sintético. */
const PASAJE_REAL = 'la diferencia observada en el desenlace primario fue de 1.4 puntos porcentuales'

const CASOS: readonly CasoDeBenchmark[] = [
  {
    id: 'feliz-anclado',
    consulta: { pregunta: '¿duración del tratamiento antimicrobiano?', maximo: 5 },
    sintesisCruda: [{ texto: 'La diferencia cruzó el nulo.', citas: [1], pasajes: [PASAJE_REAL] }],
    esperadasRespaldadas: 1, esperadasSinRespaldo: 0,
    porQue: 'camino feliz: una afirmación con pasaje literal de una fuente recuperada.',
  },
  {
    id: 'adversarial-inventado',
    consulta: { pregunta: '¿duración del tratamiento antimicrobiano?', maximo: 5 },
    sintesisCruda: [{ texto: 'La mortalidad se redujo a la mitad.', citas: [1], pasajes: ['la mortalidad se redujo un cincuenta por ciento en el grupo de intervención'] }],
    esperadasRespaldadas: 0, esperadasSinRespaldo: 1,
    porQue: 'EL CASO QUE HACE ÚTIL AL ARNÉS: una afirmación plausible cuyo pasaje no está en ninguna fuente. Si se colara, el arnés se pondría rojo.',
  },
  {
    id: 'cita-fuera-de-rango',
    consulta: { pregunta: '¿duración del tratamiento antimicrobiano?', maximo: 5 },
    sintesisCruda: [{ texto: 'Afirmación con cita inexistente.', citas: [99], pasajes: [PASAJE_REAL] }],
    esperadasRespaldadas: 0, esperadasSinRespaldo: 1,
    porQue: 'el bug real de consulta/page.tsx:2698: hoy un índice fuera de rango se descarta en silencio.',
  },
]

describe('el arnés mide y sus casos declaran lo que esperan', () => {
  it('todos los casos cumplen su declaración', async () => {
    const informe = await correrBenchmarkDeEvidencia(CASOS, [adaptadorSintetico()], CTX)
    const fallidos = informe.casos.filter(c => !c.cumple)
    expect(fallidos.map(c => `${c.id}: ${c.desviacion}`)).toEqual([])
    expect(informe.casosQueCumplen).toBe(CASOS.length)
  })

  it('el caso adversarial NO se cuela: es el que da sentido a la métrica', async () => {
    const m = await correrCaso(CASOS[1], [adaptadorSintetico()], CTX)
    expect(m.respaldadas).toBe(0)
    expect(m.sinRespaldo).toBe(1)
    expect(m.respuestaRespaldada).toBe(false)
    expect(m.tasaSinRespaldo).toBe(1)
  })

  it('probado al revés: si el arnés aceptara la afirmación inventada, se pondría ROJO', async () => {
    // Se invierte la expectativa del caso adversarial. Si el sistema anclara la
    // afirmación falsa, `cumple` sería true y esta prueba fallaría — que es
    // exactamente lo que queremos que pase el día que la tubería se rompa.
    const invertido: CasoDeBenchmark = { ...CASOS[1], esperadasRespaldadas: 1, esperadasSinRespaldo: 0 }
    const m = await correrCaso(invertido, [adaptadorSintetico()], CTX)
    expect(m.cumple).toBe(false)
    expect(m.desviacion).toMatch(/PASAJE_NO_LITERAL/)
  })

  it('la tasa global de afirmaciones sin respaldo se agrega bien', async () => {
    const informe = await correrBenchmarkDeEvidencia(CASOS, [adaptadorSintetico()], CTX)
    // 1 respaldada de 3 afirmaciones ⇒ 2/3 sin respaldo.
    expect(informe.tasaSinRespaldoGlobal).toBeCloseTo(2 / 3)
  })

  it('es determinista: dos corridas dan lo mismo', async () => {
    const a = await correrBenchmarkDeEvidencia(CASOS, [adaptadorSintetico()], CTX)
    const b = await correrBenchmarkDeEvidencia(CASOS, [adaptadorSintetico()], CTX)
    expect(a.casos.map(c => [c.id, c.respaldadas, c.sinRespaldo, c.fuentesRecuperadas]))
      .toEqual(b.casos.map(c => [c.id, c.respaldadas, c.sinRespaldo, c.fuentesRecuperadas]))
  })
})

describe('la caída de un proveedor se MIDE, no se ignora', () => {
  it('cuenta los fallos por clase', async () => {
    const caido = adaptadorSintetico({ fallo: { estado: 'unavailable', motivo: 'caída simulada del proveedor', clase: 'timeout', latenciaMs: 30_000 } })
    const informe = await correrBenchmarkDeEvidencia([CASOS[0]], [caido], CTX)
    expect(informe.fallosPorClase.timeout).toBe(1)
    // Y con el proveedor caído no hay nada que anclar: la afirmación del caso
    // feliz queda SIN respaldo, que es la respuesta correcta.
    expect(informe.casos[0].respaldadas).toBe(0)
    expect(informe.casos[0].proveedoresNoConsultados).toBe(1)
  })

  it('un timeout de 30 s se reporta con su latencia, no con cero', async () => {
    const caido = adaptadorSintetico({ fallo: { estado: 'unavailable', motivo: 'timeout simulado', clase: 'timeout', latenciaMs: 30_000 } })
    const m = await correrCaso(CASOS[0], [caido], CTX)
    expect(m.latenciaTotalMs).toBe(30_000)
  })

  it('un proveedor sin licencia aparece como no consultado', async () => {
    const m = await correrCaso(CASOS[0], [adaptadorSintetico(), uptodate()], CTX)
    expect(m.proveedoresConsultados).toBe(1)
    expect(m.proveedoresNoConsultados).toBe(1)
  })
})

describe('el informe no inventa números', () => {
  it('costo AUSENTE se informa null, nunca cero', async () => {
    // Un cero inventado aquí acabaría en una diapositiva diciendo «gratis».
    const informe = await correrBenchmarkDeEvidencia(CASOS, [adaptadorSintetico()], CTX)
    expect(informe.costoTotalUsd).toBeNull()
    expect(informeLegible(informe)).toMatch(/NO DECLARADO por ningún adaptador \(no es cero\)/)
  })

  it('el informe declara lo que NO mide', () => {
    const vacio = { casos: [], latenciaP50Ms: 0, latenciaP95Ms: 0, tasaSinRespaldoGlobal: 0, casosQueCumplen: 0, costoTotalUsd: null, fallosPorClase: {} }
    expect(informeLegible(vacio)).toMatch(/NO MIDE: calidad clínica/)
  })

  it('el percentilDeLatencias no revienta con pocos datos', () => {
    expect(percentilDeLatencias([], 0.95)).toBe(0)
    expect(percentilDeLatencias([42], 0.95)).toBe(42)
    expect(percentilDeLatencias([10, 20], 0.5)).toBe(15)
  })
})
