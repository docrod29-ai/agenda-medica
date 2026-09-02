/**
 * GOLDEN — REG-449. El umbral de `laboratorio-vision` (D-031) se aplica.
 *
 * Al escribirse salía ROJO (7 de 46, 15,2 %). REG-450 cerró la causa con los
 * números del médico (D-032) y hoy mide 1 de 46. La historia se conserva abajo
 * porque explica POR QUÉ existen estos analitos y estos casos.
 *
 * ── QUÉ FALLABA ──────────────────────────────────────────────────────────────
 *
 * `laboratorio-vision` no tenía umbral ni conjunto. El contrato decía: «No
 * existe. Ninguna hoja real puede entrar sin ser sintética». Lo segundo es
 * cierto y lo primero era una tarea, no un hecho: nadie había escrito las hojas.
 *
 * ── CÓMO SE DESCUBRIÓ, Y QUÉ SE ENCONTRÓ ────────────────────────────────────
 *
 * Se escribieron 8 hojas sintéticas como se imprimen en México —abreviaturas,
 * coma decimal, «>400», unidades del SI— y se midió ANTES de pedirle el número
 * al médico. Con su umbral puesto, la compuerta salía **roja**: 7 de 46 filas
 * (15,2 %) no llegaban al panel, contra un techo del 5 %.
 *
 * Y la causa NO es la visión. **Seis de las siete son cobertura del catálogo**:
 * ácido úrico, neutrófilos, linfocitos, VCM, vitamina D y ferritina no están en
 * `analitos.ts`, que cubre 24. Una hoja de rutina de un laboratorio mexicano
 * trae más de 24 analitos.
 *
 * La séptima es distinta y es la interesante: **glucosa 7,2 mmol/L**. El analito
 * SÍ está en el catálogo; lo que lo tira es que 7,2 no es plausible en mg/dL, así
 * que el validador la rechaza entera. La defensa funciona como se diseñó —mejor
 * fuera que un punto falso de 7,2 mg/dL en la gráfica— pero el efecto es que un
 * paciente cuyo laboratorio reporte en unidades del SI deja de tener serie de
 * glucosa, y nadie lo dice.
 *
 * ── LA REGLA QUE LO HACE SEGURO ──────────────────────────────────────────────
 *
 * Un vocabulario es vocabulario, no criterio (seguridad clínica §5): que falte
 * un término significa que ese caso **no se vigila**, no que se dé por bueno. Por
 * eso lo perdido se cuenta, y por eso la fila sobrevive como texto en
 * `noReconocidas` en vez de desaparecer.
 *
 * ── LO QUE ESTA PRUEBA **NO** CUBRE, Y HAY QUE DECIRLO FUERTE ────────────────
 *
 *  · **NO mide la visión.** Las filas entran como si el modelo las hubiera leído
 *    perfectas. Mide el foso determinista: catálogo, unidades, rangos, `<`/`>`.
 *    Dos de los tres ejes del médico —`valorMalLeido` y `unidadMalLeida`— por
 *    tanto **no se miden aquí**: sólo se ejercen al revés, inyectando el defecto.
 *    Medirlos de verdad pide imágenes y llamadas de API, y es la mitad que falta.
 *  · **El 15,2 % depende de las hojas que escribí yo.** Si hubiera escrito ocho
 *    hojas de química básica, saldría 0 %. Se escribieron para parecerse a las
 *    de verdad, y eso es un juicio mío, no una medición del producto.
 *  · **No mide de quién es la hoja.** `dictaminarSujeto` es otro guardián.
 *  · **No mide analitos inventados con umbral**: se cuentan y se reportan, pero
 *    el médico no fijó número y no se le inventa uno.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { validarPanel, type FilaCruda } from '@/lib/expediente/laboratorio/extraccion'
import { analitoDe } from '@/lib/expediente/laboratorio/analitos'
import {
  CONTRATOS, aplicarUmbral, esVerde, PENDIENTE_DEL_MEDICO,
  LO_QUE_NO_SE_LE_PREGUNTO_DEL_LABORATORIO, type LoMedido, type Umbral,
} from '@/lib/ia/contratos-de-evaluacion'

const RAIZ = process.cwd()
const HOJAS = join(RAIZ, 'synthetic-data/laboratorio-hojas/HOJAS.jsonl')

const UMBRAL: Umbral = CONTRATOS.find(c => c.capacidad === 'laboratorio-vision')!.umbral

/**
 * EL TRINQUETE. Sólo puede BAJAR.
 *
 *  · 1-sep-2026 (REG-449): **7** de 46. Seis eran cobertura del catálogo.
 *  · 2-sep-2026 (REG-450): **1** de 46. El médico entregó el catálogo maestro de
 *    plausibilidad (D-032) y los seis analitos entraron con SUS números.
 *
 * La que queda es la glucosa en mmol/L, y no se arregla con más analitos: el
 * analito ya está y lo tira el rango plausible. Pide normalización de unidad,
 * que es la §27 del catálogo del dueño y es otra unidad de trabajo.
 */
const FILAS_QUE_NO_LLEGAN = 1

interface Hoja { readonly id: string; readonly contexto: string; readonly filas: FilaCruda[] }

const corpus = (): Hoja[] =>
  readFileSync(HOJAS, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l) as Hoja)

/**
 * Lo que la compuerta necesita, con los nombres de eje del contrato.
 *
 * Vive en la prueba y no en `src/lib` a propósito: la lógica de producción que
 * esto ejercita —`validarPanel`— ya existe, y añadir un módulo nuevo sin más
 * consumidor que este golden sería el huérfano que los trinquetes de conexión
 * llevan toda la semana rechazando. Cuando exista la mitad de imágenes y haya
 * un segundo consumidor de verdad, se muda.
 */
function medirElFoso(hojas: readonly Hoja[]): LoMedido & { filas: number; llegan: number; perdidas: number; inventadas: number } {
  let filas = 0, llegan = 0, inventadas = 0
  for (const h of hojas) {
    const panel = validarPanel({ fecha: '2026-09-01', filas: h.filas })
    filas += h.filas.length
    llegan += panel.resultados.length
    /**
     * Un analito INVENTADO: llegó al panel algo que la hoja no traía. Se cuenta
     * y NO tiene umbral — el médico no lo decidió (`LO_QUE_NO_SE_LE_PREGUNTO…`).
     *
     * PREMISA CORREGIDA DOS VECES, y las dos por lo mismo:
     *
     *  1. La primera versión comparaba cadenas a mano y marcaba dos inventados
     *     que no lo eran («Filtrado glomerular» → `tfg`, «c-HDL» → `hdl`).
     *  2. La segunda ya usaba `analitoDe`, pero SIN la unidad — y en cuanto
     *     REG-450 hizo que la unidad desambiguara el diferencial leucocitario,
     *     «Neutrófilos %» volvió a contarse como inventado.
     *
     * La lección es la misma las dos veces: el medidor tiene que llamar al mapeo
     * canónico **con las mismas entradas que usa producción**. Uno con su propia
     * idea de qué es un analito mide otra cosa que el producto.
     */
    const clavesDeLaHoja = new Set(
      h.filas.map(f => analitoDe(String(f.estudio ?? ''), f.unidad?.trim())?.clave).filter(Boolean),
    )
    inventadas += panel.resultados.filter(r => !clavesDeLaHoja.has(r.clave)).length
  }
  const perdidas = filas - llegan
  return {
    filas, llegan, perdidas, inventadas,
    hayConjunto: hojas.length > 0,
    ejes: {
      perdido: filas > 0 ? perdidas / filas : 0,
      /**
       * Las filas entran como si el modelo las hubiera leído perfectas, así que
       * aquí estos dos SIEMPRE son cero por construcción. No es un aprobado: es
       * que este conjunto no los mide. Se ejercen al revés, más abajo.
       */
      valorMalLeido: 0,
      unidadMalLeida: 0,
    },
    resolucion: {
      perdido: filas > 0 ? 1 / filas : 1,
      valorMalLeido: filas > 0 ? 1 / filas : 1,
      unidadMalLeida: filas > 0 ? 1 / filas : 1,
    },
  }
}

describe('EL CONJUNTO EXISTE — antes decía «no existe»', () => {
  it('8 hojas, 46 filas, y ninguna es de un paciente real', () => {
    const hojas = corpus()
    expect(hojas).toHaveLength(8)
    expect(hojas.reduce((n, h) => n + h.filas.length, 0)).toBe(46)
    for (const h of hojas) {
      expect(h.contexto.length, h.id).toBeGreaterThan(40)
      expect(h.filas.length, h.id).toBeGreaterThan(0)
    }
  })

  it('cubre lo que rompe de verdad: abreviaturas, coma decimal, censurados y SI', () => {
    /**
     * Un conjunto de ocho químicas sanguíneas perfectas mediría cero y no diría
     * nada. Cada hoja existe por un caso que sabemos que aparece.
     */
    const texto = readFileSync(HOJAS, 'utf8')
    expect(texto).toMatch(/"TGO"/)          // abreviatura
    expect(texto).toMatch(/"1,2"/)          // coma decimal
    expect(texto).toMatch(/">400"/)         // censurado
    expect(texto).toMatch(/mmol\/L/)        // unidad del SI
  })

  it('y el contrato ya no dice que no existe', () => {
    const c = CONTRATOS.find(x => x.capacidad === 'laboratorio-vision')!
    expect(c.conjunto).toMatch(/laboratorio-hojas/)
    expect(c.conjunto).toMatch(/NO LA VISIÓN/)
  })
})

describe('EL UMBRAL DE D-031 SE APLICA — y hoy REPRUEBA', () => {
  it('el veredicto sale del contrato: tres ejes, dos en cero', () => {
    expect(PENDIENTE_DEL_MEDICO in UMBRAL).toBe(false)
    const lectura = aplicarUmbral(UMBRAL, medirElFoso(corpus()))
    expect(lectura.ejes.map(e => e.nombre)).toEqual(['valorMalLeido', 'unidadMalLeida', 'perdido'])
    expect(lectura.ejes.map(e => e.umbral)).toEqual([0, 0, 0.05])
  })

  it('1 de 46 filas no llega: 2,2 % por debajo del techo del 5 %', () => {
    /**
     * El 1-sep-2026 esto medía 7 de 46 —15,2 %— y la compuerta salía ROJA. Seis
     * de las siete eran cobertura del catálogo, y el médico entregó los números
     * al día siguiente (D-032). No se arregló el umbral: se arregló la causa.
     */
    const m = medirElFoso(corpus())
    expect(m.filas).toBe(46)
    expect(m.perdidas).toBe(FILAS_QUE_NO_LLEGAN)
    expect(m.ejes.perdido).toBeLessThan(0.05)

    const lectura = aplicarUmbral(UMBRAL, m)
    expect(lectura.veredicto).toBe('pasa')
    expect(esVerde(lectura)).toBe(true)
  })

  it('la que queda es la glucosa en mmol/L, y no es cobertura de catálogo', () => {
    /**
     * Un vocabulario es vocabulario, no criterio: que faltara un término
     * significaba que ese caso no se vigilaba, no que estuviera bien. Seis se
     * cubrieron. La séptima NO se cubre con más analitos — el analito ya está.
     */
    const fuera: string[] = []
    for (const h of corpus()) {
      const panel = validarPanel({ fecha: '2026-09-01', filas: h.filas })
      fuera.push(...panel.noReconocidas.map(n => n.estudio))
    }
    expect(fuera).toEqual(['Glucosa'])
  })

  it('la séptima es otra cosa: glucosa en mmol/L se cae entera', () => {
    /**
     * El analito SÍ está en el catálogo. Lo tira el rango plausible: 7,2 no es
     * una glucosa en mg/dL. La defensa hace lo correcto —mejor fuera que un
     * punto falso en la gráfica— pero el paciente cuyo laboratorio reporte en
     * unidades del SI se queda sin serie de glucosa y nadie se lo dice.
     */
    const panel = validarPanel({
      fecha: '2026-09-01',
      filas: [{ estudio: 'Glucosa', valor: '7.2', unidad: 'mmol/L', referencia: '3.9-5.5' }],
    })
    expect(panel.resultados).toHaveLength(0)
    expect(panel.noReconocidas[0].estudio).toBe('Glucosa')
    // Y no se pierde: sobrevive como texto, con su unidad.
    expect(panel.noReconocidas[0].unidad).toBe('mmol/L')
  })

  it('el trinquete: 1 fila, y sólo puede bajar', () => {
    const m = medirElFoso(corpus())
    expect(
      m.perdidas,
      m.perdidas > FILAS_QUE_NO_LLEGAN
        ? 'SUBIÓ: el catálogo cubre menos que ayer, o el validador tira más.'
        : 'BAJÓ: baja FILAS_QUE_NO_LLEGAN y di en el ledger qué se cubrió.',
    ).toBe(FILAS_QUE_NO_LLEGAN)
  })
})

describe('AL REVÉS — los dos ejes que este conjunto NO mide', () => {
  /**
   * `valorMalLeido` y `unidadMalLeida` salen cero por construcción: las filas
   * entran perfectas. Así que se ejercen inyectando el defecto, que es la única
   * forma honesta de saber que la compuerta los vigilaría.
   */
  const conDefecto = (ejes: Record<string, number>): LoMedido => {
    const base = medirElFoso(corpus())
    return { ...base, ejes: { ...base.ejes, ...ejes } }
  }

  it('UN valor mal leído reprueba, aunque no se pierda nada', () => {
    const lectura = aplicarUmbral(UMBRAL, conDefecto({ perdido: 0, valorMalLeido: 1 / 46 }))
    expect(lectura.veredicto).toBe('reprueba')
    expect(lectura.ejes.find(e => e.nombre === 'valorMalLeido')!.veredicto).toBe('reprueba')
  })

  it('UNA unidad mal leída, igual', () => {
    const lectura = aplicarUmbral(UMBRAL, conDefecto({ perdido: 0, unidadMalLeida: 1 / 46 }))
    expect(lectura.veredicto).toBe('reprueba')
  })

  it('el número del contrato manda: con un techo laxo, lo mismo pasa', () => {
    /**
     * La misma pérdida del 15,2 % que reprueba con el 5 % del médico pasa con un
     * 50 % armado aquí, que no está en ningún contrato.
     */
    const laxo: Umbral = {
      valor: 0.5, fuente: 'Sólo para esta prueba: NO es un umbral del producto.',
      ejes: [{ nombre: 'perdido', valor: 0.5, porQue: 'inventado para la prueba' }],
    }
    expect(aplicarUmbral(laxo, medirElFoso(corpus())).veredicto).toBe('pasa')
  })

  it('un conjunto VACÍO no pone la compuerta en verde', () => {
    const lectura = aplicarUmbral(UMBRAL, medirElFoso([]))
    expect(lectura.veredicto).toBe('sin_conjunto')
    expect(esVerde(lectura)).toBe(false)
  })
})

describe('AL REVÉS POR EL OTRO LADO — no se pasa de frenada', () => {
  it('las abreviaturas NO se pierden: para eso está el catálogo', () => {
    /**
     * Si «Glu» y «TGO» no llegaran, la serie temporal se partiría en dos y la
     * gráfica de tendencia mentiría. Es el trabajo principal de `analitos.ts`.
     */
    const hoja = corpus().find(h => h.id === 'LAB-002')!
    const panel = validarPanel({ fecha: '2026-09-01', filas: hoja.filas })
    expect(panel.noReconocidas).toEqual([])
    expect(panel.resultados.map(r => r.clave).sort())
      .toEqual(['alt', 'ast', 'glucosa', 'hba1c', 'hematocrito', 'leucocitos'])
  })

  it('la coma decimal no convierte 1,2 en 12', () => {
    // Un separador mal leído mueve la creatinina un factor de diez.
    const panel = validarPanel({
      fecha: '2026-09-01',
      filas: [{ estudio: 'Creatinina', valor: '1,2', unidad: 'mg/dL' }],
    })
    expect(panel.resultados[0].valor).toBe(1.2)
  })

  it('los censurados conservan el comparador (REG-204)', () => {
    const hoja = corpus().find(h => h.id === 'LAB-003')!
    const panel = validarPanel({ fecha: '2026-09-01', filas: hoja.filas })
    expect(panel.resultados.filter(r => r.censurada).length).toBe(3)
  })

  it('ninguna hoja produce un analito inventado', () => {
    /**
     * Se cuenta y se reporta. NO reprueba: el médico no fijó umbral para esto y
     * no se le inventa uno. Hoy da cero, que es lo que tiene que dar un foso
     * determinista al que se le entregan las filas de la propia hoja.
     */
    expect(medirElFoso(corpus()).inventadas).toBe(0)
  })
})

describe('LO QUE NO SE LE PREGUNTÓ, dicho a tiempo', () => {
  it('el analito inventado queda declarado como decisión pendiente', () => {
    /**
     * Que en la nota decidiera 0 % de alucinación (D-029) no lo decide aquí. Son
     * dos capacidades, y extender una decisión de una a otra es adivinar con
     * papeleo.
     */
    expect(LO_QUE_NO_SE_LE_PREGUNTO_DEL_LABORATORIO).toMatch(/NEEDS_CLINICAL_REVIEW/)
    expect(LO_QUE_NO_SE_LE_PREGUNTO_DEL_LABORATORIO).toMatch(/INVENTADOS/)
  })

  it('y el contrato dice que este conjunto NO mide la visión', () => {
    const c = CONTRATOS.find(x => x.capacidad === 'laboratorio-vision')!
    expect(c.conjunto).toMatch(/dos de\s+los tres ejes sólo se ejercen al revés|sólo se ejercen al revés/)
  })
})
