/**
 * GOLDEN — el p99, la tasa de error, y por qué los dos vienen con contexto.
 *
 * ── QUÉ FALTABA ─────────────────────────────────────────────────────────────
 *
 * `WS-12.p99`: «cost-ledger.ts calcula p50 y p95 de las llamadas de IA. No hay
 * p99 en ningún sitio del repositorio salvo el acta del arnés de carga, ni
 * latencia/error por ruta».
 *
 * El p99 es la cifra que describe **el peor día de un médico**. El p95 dice cómo
 * es una consulta normal; el p99 dice cuántas veces al mes alguien se queda
 * mirando una pantalla mientras el paciente espera. No estaba.
 *
 * Y la tasa de error tampoco, con un agravante: `EventoCosto.fallo` **ya se
 * registraba** —«un fallo cuesta tokens igual», dice su comentario desde que
 * existe el libro— y sólo se usaba para no contar consultas fallidas. La cifra
 * que dice si una función está rota se estaba escribiendo y nadie la sumaba.
 * Familia «escrito y sin conectar», sobre un dato que ya estaba en la mesa.
 *
 * ── POR QUÉ EL P99 NO SE PUBLICA PELADO ─────────────────────────────────────
 *
 * Porque con **menos de cien muestras el p99 ES EL MÁXIMO**. No es una
 * aproximación: el percentil por rango más cercano cae en el índice
 * `ceil(0.99·n)−1`, que para `n < 100` es siempre el último. Con 20 llamadas, el
 * «p99» es el pico más alto de las veinte.
 *
 * Publicarlo sin decirlo invita a leer un pico único como una cola, y a
 * perseguir un fantasma — que es la versión de latencia del mismo error que este
 * repositorio ya persigue en las alertas falsas: una cifra que grita de más
 * enseña a ignorarla.
 *
 * Así que van juntos: el p99, cuántas muestras lo sostienen, y si es el máximo.
 *
 * ── LO QUE NO SE INVENTA ────────────────────────────────────────────────────
 *
 * `MUESTRAS_PARA_UN_P99 = 100` **no es un umbral de calidad**: es aritmética del
 * percentil. Qué p99 es aceptable para una consulta sigue sin decidirse, y no se
 * decide aquí — igual que el validador del arnés de carga declara que no aprueba
 * SLOs.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · **Sólo las rutas de IA.** El libro de costos cubre las llamadas a proveedor;
 *   una ruta HTTP que no llama a un modelo no deja asiento y por tanto no tiene
 *   latencia ni error aquí. Medir TODAS exige instrumentar el borde, que es
 *   trabajo de infraestructura y no de este módulo.
 * · **No fija umbrales**, por lo de arriba.
 * · **No agrega entre periodos**: resume la tanda que se le pase.
 */
import { describe, it, expect } from 'vitest'
import {
  resumir, porFuncion, MUESTRAS_PARA_UN_P99, type EventoCosto,
} from '@/lib/finanzas/cost-ledger'

const evento = (over: Partial<EventoCosto> = {}): EventoCosto => ({
  requestId: 'r', clinicId: 'c1', uid: 'u1', feature: 'nota',
  proveedor: 'anthropic', modelo: 'm', entrada: 10, salida: 10, entradaCache: 0,
  latenciaMs: 100, costoUsd: 0.001, creditos: 1, clase: 'customer',
  ts: '2026-08-30T00:00:00.000Z', ...over,
})

describe('el p99 existe, y dice cuánto se puede confiar en él', () => {
  it('AL REVÉS: antes no había p99 en ningún sitio', () => {
    const r = resumir([evento()])
    expect(r).toHaveProperty('latenciaP99')
    expect(r.latenciaP50).not.toBeNull()
    expect(r.latenciaP95).not.toBeNull()
  })

  it('con pocas muestras AVISA de que el p99 es el máximo', () => {
    /**
     * El corazón de la unidad. Con veinte llamadas, `latenciaP99` es el pico más
     * alto de las veinte — y quien lo pinte tiene que poder decirlo.
     */
    const pocos = Array.from({ length: 20 }, (_, i) => evento({ latenciaMs: 100 + i }))
    const r = resumir(pocos)
    expect(r.muestrasDeLatencia).toBe(20)
    expect(r.p99EsElMaximo).toBe(true)
    expect(r.latenciaP99).toBe(Math.max(...pocos.map(e => e.latenciaMs)))
  })

  it('y con muestras suficientes DEJA de avisar', () => {
    /**
     * El caso que impide que el aviso salga siempre: uno que sale siempre no
     * informa de nada y se aprende a ignorar.
     */
    const muchos = Array.from({ length: MUESTRAS_PARA_UN_P99 }, (_, i) => evento({ latenciaMs: 100 + i }))
    const r = resumir(muchos)
    expect(r.p99EsElMaximo).toBe(false)
    /* Y entonces el p99 SÍ separa de la cola: no es el máximo. */
    expect(r.latenciaP99).toBeLessThan(Math.max(...muchos.map(e => e.latenciaMs)))
  })

  it('el p99 nunca queda por debajo del p95, ni el p95 del p50', () => {
    /* Una inversión aquí significa que el ordenado está mal, y se vería como una
       mejora de latencia que no ocurrió. */
    const xs = Array.from({ length: 250 }, (_, i) => evento({ latenciaMs: (i * 37) % 900 }))
    const r = resumir(xs)
    expect(r.latenciaP50!).toBeLessThanOrEqual(r.latenciaP95!)
    expect(r.latenciaP95!).toBeLessThanOrEqual(r.latenciaP99!)
  })

  it('sin latencias medidas no inventa un cero', () => {
    /* `0 ms` se leería como «instantáneo». `null` es «no se midió». */
    const r = resumir([evento({ latenciaMs: 0 })])
    expect(r.latenciaP99).toBeNull()
    expect(r.muestrasDeLatencia).toBe(0)
    expect(r.p99EsElMaximo).toBe(false)
  })

  it('el umbral de muestras es aritmética, no política', () => {
    /**
     * `ceil(0.99·n)−1` es la última posición para todo n < 100. Que sean cien no
     * lo decide nadie: lo decide el percentil.
     */
    expect(MUESTRAS_PARA_UN_P99).toBe(100)
    for (const n of [1, 20, 99]) {
      expect(Math.ceil(0.99 * n) - 1, `n=${n}`).toBe(n - 1)
    }
    expect(Math.ceil(0.99 * 100) - 1).toBeLessThan(99)
  })
})

describe('la tasa de error se calculaba con un dato que ya estaba escrito', () => {
  it('cuenta los fallos y su fracción', () => {
    const r = resumir([evento(), evento({ fallo: true }), evento(), evento()])
    expect(r.fallos).toBe(1)
    expect(r.tasaDeFallo).toBe(0.25)
  })

  it('sin llamadas NO es cero por ciento de error', () => {
    /**
     * Dividir entre cero no da 0. «Ninguna llamada falló» y «no hubo llamadas»
     * son cosas distintas, y confundirlas pinta de verde una función apagada.
     */
    expect(resumir([]).tasaDeFallo).toBeNull()
    expect(resumir([]).fallos).toBe(0)
  })

  it('un fallo sigue contando en el gasto: costó tokens igual', () => {
    /* Es lo que el propio libro lleva escrito. Excluirlo del total daría un
       margen mejor del real. */
    const r = resumir([evento({ fallo: true, costoUsd: 0.005 })])
    expect(r.totalUsd).toBe(0.005)
    expect(r.fallos).toBe(1)
  })
})

describe('por función: el orden es el de mirar cuando algo va mal', () => {
  const eventos = [
    evento({ feature: 'nota', latenciaMs: 100 }),
    evento({ feature: 'nota', latenciaMs: 120 }),
    evento({ feature: 'transcribir', latenciaMs: 90, fallo: true }),
    evento({ feature: 'transcribir', latenciaMs: 95 }),
    evento({ feature: 'evidencia', latenciaMs: 5000 }),
  ]

  it('agrupa por función y cada grupo trae su p99 y su error', () => {
    const g = porFuncion(eventos)
    expect(g.map(x => x.clave).sort()).toEqual(['evidencia', 'nota', 'transcribir'])
    for (const x of g) {
      expect(x.resumen).toHaveProperty('latenciaP99')
      expect(x.resumen).toHaveProperty('tasaDeFallo')
    }
  })

  it('lo que FALLA va primero, no lo que más gasta', () => {
    /**
     * `porClave` ordena por gasto, que es el orden de una factura. Cuando algo va
     * mal, lo primero que se mira es qué está roto — y sólo después, cuál de lo
     * que funciona tarda más.
     */
    const g = porFuncion(eventos)
    expect(g[0].clave).toBe('transcribir')
    expect(g[0].resumen.tasaDeFallo).toBe(0.5)
  })

  it('y entre las que no fallan, la más lenta primero', () => {
    const g = porFuncion(eventos).filter(x => (x.resumen.tasaDeFallo ?? 0) === 0)
    expect(g[0].clave).toBe('evidencia')
  })

  it('es `porClave` por dentro, no una segunda forma de resumir', () => {
    /* Dos maneras de resumir el mismo libro darían dos cifras plausibles y una
       estaría mal. */
    const g = porFuncion(eventos).find(x => x.clave === 'nota')!
    expect(g.resumen).toEqual(resumir(eventos.filter(e => e.feature === 'nota')))
  })
})
