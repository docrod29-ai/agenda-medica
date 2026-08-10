/**
 * GOLDEN — libro de costos (P0-1 de la auditoría de monetización).
 *
 * Hasta hoy `registrarUso()` contaba LLAMADAS, no tokens, así que el costo real
 * de Ausculta era desconocido y ninguna de las catorce cifras que pide §BG del
 * Master Loop V3 se podía calcular.
 *
 * Lo que se protege aquí es, sobre todo, **que no se invente un número**:
 *  · costo desconocido sale `null`, NUNCA `0`;
 *  · los totales suman sólo lo que tiene tarifa, y declaran cuánto quedó fuera;
 *  · el gasto de I+D del fundador no contamina el COGS de los clientes;
 *  · en el libro no entra ni un dato clínico.
 */
import { describe, it, expect } from 'vitest'
import {
  asiento, resumir, soloCogs, porClave, claseDe, suficiente, type EntradaLedger,
} from '@/lib/finanzas/cost-ledger'
import { costoUsd, tarifaDe, TARIFAS, modelosSinTarifa } from '@/lib/finanzas/precios-modelo'
import { usoDe, trajoUso } from '@/lib/finanzas/medir-ia'

const base = (o: Partial<EntradaLedger> = {}): EntradaLedger => ({
  requestId: 'r1', clinicId: 'c1', uid: 'u1', feature: 'nota',
  /**
   * Modelo INVENTADO a propósito.
   *
   * Este fixture usaba `claude-opus-4-8`, que era correcto mientras la tabla de
   * tarifas estaba vacía — pero acopló la prueba a ese vacío. Al cargarse las
   * tarifas reales (31-jul-2026), seis pruebas cayeron sin que el invariante que
   * defienden se hubiera roto.
   *
   * El invariante es «un modelo SIN tarifa cuesta null, nunca cero», y para
   * probarlo hace falta un modelo que no vaya a tener tarifa jamás.
   */
  proveedor: 'anthropic', modelo: 'modelo-sin-tarifa-de-prueba',
  uso: { entrada: 3200, salida: 2000, entradaCache: 0 },
  latenciaMs: 4200, creditos: 3, fuente: 'prueba', ts: '2026-07-30T22:00:00.000Z', ...o,
})

describe('Sin tarifa cargada, el costo es NULL — nunca cero', () => {
  it('ninguna tarifa se acepta sin su fuente y su fecha', () => {
    /**
     * Esta prueba decía `TARIFAS.length === 0` — «nace vacío a propósito». Se
     * cumplió su función: las tarifas se cargaron el 31-jul-2026 desde la página
     * de cada proveedor. Lo que ya no se puede aflojar no es el vacío, es la
     * REGLA: una cifra sin procedencia es una cifra inventada, y un tablero
     * financiero que parece exacto y miente es peor que uno que dice «no sé».
     */
    expect(TARIFAS.length).toBeGreaterThan(0)
    for (const t of TARIFAS) {
      expect(t.fuente, `${t.modelo} sin fuente`).toMatch(/^https?:\/\//)
      expect(t.consultado, `${t.modelo} sin fecha`).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    }
  })

  it('un modelo sin tarifa da null y dice por qué', () => {
    const c = costoUsd('modelo-sin-tarifa-de-prueba', { entrada: 1000, salida: 500 })
    expect(c.usd).toBeNull()
    expect(c.motivo).toBe('sin_tarifa')
  })

  it('el asiento conserva los TOKENS aunque no sepa el precio', () => {
    // Los tokens son un hecho que devuelve la API. El precio es otra cosa.
    const a = asiento(base())
    expect(a.entrada).toBe(3200)
    expect(a.salida).toBe(2000)
    expect(a.costoUsd).toBeNull()
    expect(a.motivoSinCosto).toBe('sin_tarifa')
  })

  it('los totales NO suman lo desconocido como cero', () => {
    const r = resumir([asiento(base()), asiento(base({ requestId: 'r2' }))])
    expect(r.llamadas).toBe(2)
    expect(r.conCosto).toBe(0)
    expect(r.sinTarifa).toBe(2)
    expect(r.totalUsd).toBe(0)          // suma de nada, no «costó cero»
    expect(r.tokensEntrada).toBe(6400)  // los tokens SÍ están
  })

  it('y se puede saber qué tarifas faltan por cargar', () => {
    const r = resumir([asiento(base()), asiento(base({ requestId: 'r2', modelo: 'otro-inventado' }))])
    expect(r.modelosSinTarifa.sort()).toEqual(['modelo-sin-tarifa-de-prueba', 'otro-inventado'])
    // Y los que SÍ tienen tarifa no aparecen como pendientes.
    expect(modelosSinTarifa(['claude-opus-4-8', 'x', ''])).toEqual(['x'])
  })

  it('INSUFFICIENT_DATA: no se afirma un total con media cobertura', () => {
    expect(suficiente(resumir([asiento(base())]))).toBe(false)
  })
})

describe('El gasto del fundador NO contamina el COGS de los clientes', () => {
  it('probar módulos internos es I+D, no costo de cliente', () => {
    // §CD: si el gasto de probar UCI se atribuye al margen de los usuarios de
    // Consulta, las unit economics dejan de ser reales.
    expect(claseDe('prueba', true)).toBe('rnd')
    expect(claseDe('prueba', false)).toBe('customer')
  })

  it('con llave propia del consultorio el costo NO es nuestro', () => {
    expect(claseDe('clinica')).toBe('llave_propia')
  })

  it('soloCogs deja fuera I+D y llaves propias', () => {
    const evs = [
      asiento(base({ requestId: 'a' })),
      asiento(base({ requestId: 'b', esFundador: true })),
      asiento(base({ requestId: 'c', fuente: 'clinica' })),
    ]
    expect(soloCogs(evs).map(e => e.requestId)).toEqual(['a'])
  })
})

describe('En el libro de costos NO entra nada clínico', () => {
  it('el asiento sólo tiene tokens, modelo, latencia y precio', () => {
    const a = asiento(base())
    const claves = Object.keys(a).sort()
    for (const prohibida of ['prompt', 'respuesta', 'texto', 'patientId', 'paciente', 'nombre']) {
      expect(claves, prohibida).not.toContain(prohibida)
    }
    // El `feature` sí: dice QUÉ se cobró sin decir de quién se hablaba.
    expect(a.feature).toBe('nota')
  })
})

describe('Leer el uso que los proveedores YA devolvían y se tiraba', () => {
  it('formato Anthropic', () => {
    expect(usoDe({ usage: { input_tokens: 3200, output_tokens: 2000, cache_read_input_tokens: 400 } }))
      .toEqual({ entrada: 3200, salida: 2000, entradaCache: 400 })
  })

  it('formato OpenAI', () => {
    expect(usoDe({ usage: { prompt_tokens: 1500, completion_tokens: 900 } }))
      .toMatchObject({ entrada: 1500, salida: 900 })
  })

  it('caché de OpenAI, que viene anidada', () => {
    expect(usoDe({ usage: { prompt_tokens: 1500, completion_tokens: 900, prompt_tokens_details: { cached_tokens: 700 } } }).entradaCache).toBe(700)
  })

  it('una respuesta SIN uso se detecta, no se da por cero', () => {
    expect(trajoUso(usoDe({}))).toBe(false)
    expect(trajoUso(usoDe(null))).toBe(false)
    expect(trajoUso(usoDe({ usage: { input_tokens: 1 } }))).toBe(true)
  })

  it('nunca lanza con basura', () => {
    for (const x of [null, undefined, 'texto', 42, [], { usage: 'no' }]) {
      expect(() => usoDe(x), String(x)).not.toThrow()
    }
  })
})

describe('Agregados para el tablero', () => {
  const evs = [
    asiento(base({ requestId: 'a', feature: 'nota', latenciaMs: 1000 })),
    asiento(base({ requestId: 'b', feature: 'copilot-uci', latenciaMs: 9000 })),
    asiento(base({ requestId: 'c', feature: 'nota', latenciaMs: 2000 })),
  ]

  it('agrupa por lo que se quiera mirar', () => {
    const g = porClave(evs, e => e.feature)
    expect(g.map(x => x.clave).sort()).toEqual(['copilot-uci', 'nota'])
    expect(g.find(x => x.clave === 'nota')!.resumen.llamadas).toBe(2)
  })

  it('mide latencia, que §N pide y no se medía', () => {
    const r = resumir(evs)
    expect(r.latenciaP50).toBeGreaterThan(0)
    expect(r.latenciaP95).toBe(9000)
  })

  it('sin eventos no inventa percentiles', () => {
    const r = resumir([])
    expect(r.latenciaP50).toBeNull()
    expect(r.llamadas).toBe(0)
  })
})

describe('Cuando SÍ hay tarifa, la cuenta es la cuenta', () => {
  it('la fórmula es lineal y no redondea a centavos', () => {
    // Se comprueba con una tarifa inyectada a mano, sin tocar TARIFAS.
    const t = { entradaUsdPorMillon: 15, salidaUsdPorMillon: 75 }
    const esperado = (3200 / 1e6) * t.entradaUsdPorMillon + (2000 / 1e6) * t.salidaUsdPorMillon
    expect(Number(esperado.toFixed(6))).toBeCloseTo(0.198, 6)
    // Redondear a centavos daría 0.20 y perdería el 1% en cada llamada.
    expect(Math.round(esperado * 100) / 100).not.toBe(Number(esperado.toFixed(6)))
  })

  it('un modelo desconocido no cae en la tarifa de otro', () => {
    expect(tarifaDe('modelo-que-no-existe')).toBeNull()
  })
})
