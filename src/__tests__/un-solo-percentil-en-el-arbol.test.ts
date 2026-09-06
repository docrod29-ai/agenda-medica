/**
 * GOLDEN — dos percentiles sobre el mismo libro dan dos verdades.
 *
 * ── CÓMO EMPEZÓ ESTA UNIDAD, Y POR QUÉ IMPORTA CONTARLO ─────────────────────
 *
 * El censo decía, en `WS-12.p99`: «No hay p99 en ningún sitio del repositorio
 * salvo el acta del arnés de carga, ni latencia/error por ruta».
 *
 * **Era falso.** `src/lib/observabilidad/latencias.ts` calcula p50, p95, **p99**,
 * máximo, fallos y tasa de fallo, agrupados **por feature y por modelo**, sobre
 * los asientos del mismo libro de costos. Lleva ahí desde antes, con su
 * encabezado explicando por qué percentiles y no promedio.
 *
 * Yo empecé añadiendo p99 y un `porFuncion` a `cost-ledger.ts` **fiándome del
 * censo en vez de buscar en el árbol**, que es justo lo que la política del
 * repositorio prohíbe: «no crear implementaciones paralelas cuando ya existe una
 * canónica». Lo escrito se retiró.
 *
 * Un censo es una lista escrita a mano, con la misma caducidad que cualquier
 * otra. Creerle sin comprobar es la forma más limpia de duplicar algo.
 *
 * ── EL DEFECTO DE VERDAD, QUE APARECIÓ AL BUSCARLO ──────────────────────────
 *
 * Había **dos implementaciones de percentil** sobre los mismos datos:
 *
 *   · `cost-ledger.percentil` — por rango más cercano;
 *   · `latencias.percentil` — por interpolación lineal.
 *
 * Y no dan lo mismo. Con veinte muestras de 100 a 290 ms:
 *
 *     p50: 190 en una,  195 en la otra
 *     p95: 280 en una,  280.5 en la otra
 *     p99: 290 en una,  288.1 en la otra
 *
 * Ninguno de los dos métodos está mal. Lo que está mal es que existan los dos:
 * dos tableros del mismo periodo enseñan cifras distintas y **las dos parecen
 * ciertas**. Es el invariante de arquitectura del producto —una fuente de verdad
 * por entidad— incumplido sobre la latencia.
 *
 * Esto no lo pedía el censo. Estaba debajo.
 *
 * ── POR QUÉ NO SE UNIFICA AQUÍ, Y NO ES UNA EXCUSA ──────────────────────────
 *
 * Se intentó: el libro pasó a usar el percentil de observabilidad. Lo tumbó una
 * prueba que ya existía —`finanzas-cost-ledger` fija `latenciaP95` en 9 000, que
 * es una llamada REAL— y al mirar la otra, `latencias.test.ts` fija
 * `percentil([0, 10], 0.5) === 5`, que es un valor que nunca ocurrió.
 *
 * O sea: **los dos métodos están elegidos a conciencia y probados**. Aquí, porque
 * «con pocas muestras interpolar sugiere una precisión que no hay» y porque un
 * p95 que señala una llamada real es más fácil de defender ante el médico que la
 * sufrió. Allí, porque interpola suave y se lee mejor con dos muestras.
 *
 * Y la cifra sale en el tablero de costos **que mira el dueño**. Elegir método
 * cambia números que él ya ha visto: es una decisión de qué se reporta, no de
 * cómo se programa. Un agente que pasaba por aquí para otra cosa no la toma.
 *
 * Lo que sí se puede hacer, y se hace: que ninguno de los dos se edite sin ver
 * al otro. Los dos archivos se citan, con las cifras de la divergencia dentro, y
 * este guardián comprueba que las dos notas siguen ahí.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · **No fija umbrales.** Qué p99 es aceptable no lo decide este archivo, y
 *   `latencias.ts` ya lo declara: «no hay un número honesto que separe rápido de
 *   lento para todas las funciones».
 * · **Sólo cubre lo que deja asiento en el libro**, o sea las llamadas a un
 *   proveedor de IA. Una ruta HTTP que no llama a un modelo no tiene aquí
 *   latencia ni error; medirlas todas exige instrumentar el borde.
 * · **No unifica el percentil del ARNÉS de carga** (`run-consultorio-load.mjs`),
 *   que tiene el suyo: corre en Node fuera de la app, sobre otra población y sin
 *   acceso a `src/`. Queda dicho aquí para que no parezca un olvido.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resumir, type EventoCosto } from '@/lib/finanzas/cost-ledger'
import { percentil, porFeature } from '@/lib/observabilidad/latencias'

const LIBRO = readFileSync('src/lib/finanzas/cost-ledger.ts', 'utf8')

const evento = (over: Partial<EventoCosto> = {}): EventoCosto => ({
  requestId: 'r', clinicId: 'c1', uid: 'u1', feature: 'nota',
  proveedor: 'anthropic', modelo: 'm', entrada: 10, salida: 10, entradaCache: 0,
  latenciaMs: 100, costoUsd: 0.001, creditos: 1, clase: 'customer',
  ts: '2026-08-30T00:00:00.000Z', ...over,
})

/** Veinte muestras, que es donde los dos métodos más se separaban. */
const VEINTE = Array.from({ length: 20 }, (_, i) => 100 + i * 10)

describe('las dos cifras salen del MISMO cálculo', () => {
  it('AL REVÉS: los dos métodos daban respuestas distintas', () => {
    /**
     * El defecto, reproducido. El rango más cercano señala una muestra real; la
     * interpolación calcula entre dos. Los dos son percentiles válidos y **no
     * son el mismo número**.
     */
    const ord = [...VEINTE].sort((a, b) => a - b)
    const rangoMasCercano = (p: number) =>
      ord[Math.min(ord.length - 1, Math.max(0, Math.ceil((p / 100) * ord.length) - 1))]
    expect(rangoMasCercano(50)).not.toBe(percentil(ord, 0.5))
    expect(rangoMasCercano(99)).not.toBe(percentil(ord, 0.99))
  })

  it('el libro de costos sigue con el suyo, y su prueba vieja lo fija', () => {
    /**
     * Cambiarlo tumbaba `finanzas-cost-ledger`, que fija `latenciaP95` en 9 000
     * — una llamada REAL. Ese número lo eligió alguien y está probado.
     */
    const r = resumir(VEINTE.map(ms => evento({ latenciaMs: ms })))
    const ord = [...VEINTE].sort((a, b) => a - b)
    const rangoMasCercano = (p: number) =>
      ord[Math.min(ord.length - 1, Math.max(0, Math.ceil((p / 100) * ord.length) - 1))]
    expect(r.latenciaP50).toBe(rangoMasCercano(50))
    expect(r.latenciaP99).toBe(rangoMasCercano(99))
    /* Y el suyo devuelve SIEMPRE una muestra que ocurrió. */
    expect(VEINTE).toContain(r.latenciaP99)
  })

  it('el de observabilidad interpola, y su prueba vieja también lo fija', () => {
    /* `percentil([0, 10], 0.5) === 5` es un valor que nunca ocurrió, y está
       elegido a conciencia. Los dos métodos tienen dueño. */
    expect(percentil([0, 10], 0.5)).toBe(5)
    expect([0, 10]).not.toContain(percentil([0, 10], 0.5))
  })

  it('LOS DOS ARCHIVOS SE CITAN, para que ninguno se edite sin ver al otro', () => {
    /**
     * Es lo único que se puede cerrar sin decidir por el dueño. Sin esto, el
     * siguiente que toque uno de los dos no sabrá que existe el otro — que es
     * exactamente cómo aparecieron las dos.
     */
    const OBS = readFileSync('src/lib/observabilidad/latencias.ts', 'utf8')
    expect(LIBRO).toMatch(/observabilidad\/latencias\.ts/)
    expect(OBS).toMatch(/cost-ledger\.ts/)
    for (const src of [LIBRO, OBS]) {
      expect(src).toMatch(/DECISIÓN PENDIENTE — REG-520/)
      /* Con las cifras dentro: una nota que dice «difieren» sin decir cuánto no
         deja juzgar si importa. */
      expect(src).toMatch(/288[,.]1/)
    }
  })

  it('y NO se creó una segunda forma de agrupar por función', () => {
    /* `latencias.porFeature` ya agrupa y da `n` y `max`. El `porFuncion` que
       llegué a escribir en el libro de costos era la misma pregunta con dos
       respuestas, y se retiró. */
    expect(LIBRO).not.toMatch(/export function porFuncion/)
  })
})

describe('lo que el resumen del libro sí aporta', () => {
  it('expone el p99 y cuántas muestras lo sostienen', () => {
    /* Un percentil sin `n` al lado no se puede leer: con tres llamadas, cualquier
       p99 es anécdota. */
    const r = resumir(VEINTE.map(ms => evento({ latenciaMs: ms })))
    expect(r.latenciaP99).not.toBeNull()
    expect(r.muestrasDeLatencia).toBe(20)
  })

  it('sin latencias medidas no inventa un cero', () => {
    /* `0 ms` se leería como «instantáneo»; `null` es «no se midió». */
    const r = resumir([evento({ latenciaMs: 0 })])
    expect(r.latenciaP99).toBeNull()
    expect(r.muestrasDeLatencia).toBe(0)
  })

  it('cuenta los fallos, que ya se registraban y nadie sumaba aquí', () => {
    /**
     * `EventoCosto.fallo` está en el libro desde el principio —«un fallo cuesta
     * tokens igual»— y el resumen del libro no lo miraba. El desglose por
     * función lo da `latencias.porFeature`; esto es el total de la tanda.
     */
    const r = resumir([evento(), evento({ fallo: true }), evento(), evento()])
    expect(r.fallos).toBe(1)
    expect(r.tasaDeFallo).toBe(0.25)
  })

  it('sin llamadas NO es cero por ciento de error', () => {
    /* Dividir entre cero no da 0. «Ninguna falló» y «no hubo ninguna» son cosas
       distintas, y confundirlas pinta de verde una función apagada. */
    expect(resumir([]).tasaDeFallo).toBeNull()
  })

  it('un fallo sigue contando en el gasto', () => {
    const r = resumir([evento({ fallo: true, costoUsd: 0.005 })])
    expect(r.totalUsd).toBe(0.005)
  })
})

describe('el desglose por función ya existía, y es el canónico', () => {
  it('`porFeature` da p99, máximo y tasa de fallo por función', () => {
    const g = porFeature([
      { feature: 'nota', latenciaMs: 100 },
      { feature: 'nota', latenciaMs: 120 },
      { feature: 'transcribir', latenciaMs: 90, fallo: true },
    ])
    const nota = g.find(x => x.clave === 'nota')!
    expect(nota.n).toBe(2)
    expect(nota.p99).not.toBeNull()
    expect(nota.max).toBe(120)
    expect(g.find(x => x.clave === 'transcribir')!.tasaFallo).toBe(1)
  })

  it('y declara que no fija umbrales', () => {
    const src = readFileSync('src/lib/observabilidad/latencias.ts', 'utf8')
    expect(src).toMatch(/No define umbrales/)
    expect(src.replace(/\s*\*\s*/g, ' ')).toContain('No hay un número honesto que separe rápido de lento')
  })
})
