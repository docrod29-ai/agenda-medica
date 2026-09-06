/**
 * GOLDEN — REG-552. El umbral de `laboratorio-vision` (D-040) se aplica.
 *
 * Al escribirse salía ROJO (7 de 46, 15,2 %). REG-553 cerró la causa con los
 * números del médico (D-041) y hoy mide 1 de 46. La historia se conserva abajo
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
 *  · 1-sep-2026 (REG-552): **7** de 46. Seis eran cobertura del catálogo.
 *  · 2-sep-2026 (REG-553): **1** de 46. El médico entregó el catálogo maestro de
 *    plausibilidad (D-041) y los seis analitos entraron con SUS números.
 *
 * La que queda es la glucosa en mmol/L, y no se arregla con más analitos: el
 * analito ya está y lo tira el rango plausible. Pide normalización de unidad,
 * que es la §27 del catálogo del dueño y es otra unidad de trabajo.
 */
const FILAS_QUE_NO_LLEGAN = 0

/**
 * EL SEGUNDO NÚMERO, QUE NO SE PUEDE CALLAR — REG-554.
 *
 * Desde que la fila fuera de rango ya no se tira (§1 de D-041), «llega al panel»
 * y «entra a la serie temporal» dejaron de ser lo mismo. El eje del médico
 * (D-040) mide lo primero y hoy da CERO. Pero dos filas llegan marcadas y sin
 * gráfica, y si sólo se midiera el eje, esas dos desaparecerían del informe justo
 * cuando dejaron de desaparecer del panel.
 *
 * Eran DOS —glucosa en mmol/L y PCR en mg/dL, las dos sin factor—. REG-558 dejó
 * de teclear factores y pasó a calcularlos, y la glucosa se cerró.
 *
 * La que queda es la PCR: se convierte BIEN (84 mg/dL son 840 mg/L) y aun así
 * queda fuera del rango de este producto (0–600). Ése rango es NUESTRO y no
 * tiene fuente citada; el del catálogo del dueño llega a 1000. Bajarlo a cero
 * pide adoptar sus rangos, y eso sigue esperando a que la hoja muda deje de
 * graficarse — ver REG-557.
 */
const FILAS_SIN_GRAFICA = 1

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
     *     REG-553 hizo que la unidad desambiguara el diferencial leucocitario,
     *     «Neutrófilos %» volvió a contarse como inventado.
     *  3. La tercera, sin la MUESTRA — y en cuanto REG-559 la añadió, las ocho
     *     filas de las hojas de orina y LCR se contaron como inventadas.
     *
     * La lección es la misma las dos veces: el medidor tiene que llamar al mapeo
     * canónico **con las mismas entradas que usa producción**. Uno con su propia
     * idea de qué es un analito mide otra cosa que el producto.
     */
    const clavesDeLaHoja = new Set(
      h.filas.map(f => analitoDe(String(f.estudio ?? ''), f.unidad?.trim(), f.muestra)?.clave).filter(Boolean),
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
  it('10 hojas, 54 filas, y ninguna es de un paciente real', () => {
    /**
     * Eran 8 y 46. REG-559 añadió dos: un examen general de orina y un LCR, los
     * dos con la muestra en la CABECERA y los renglones llamándose igual que los
     * de una química sanguínea. Ése era el caso que el nombre del renglón no
     * podía resolver, declarado como hueco desde REG-556.
     */
    const hojas = corpus()
    expect(hojas).toHaveLength(10)
    expect(hojas.reduce((n, h) => n + h.filas.length, 0)).toBe(54)
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

describe('EL UMBRAL DE D-040 SE APLICA — y hoy REPRUEBA', () => {
  it('el veredicto sale del contrato: tres ejes, dos en cero', () => {
    expect(PENDIENTE_DEL_MEDICO in UMBRAL).toBe(false)
    const lectura = aplicarUmbral(UMBRAL, medirElFoso(corpus()))
    expect(lectura.ejes.map(e => e.nombre)).toEqual(['valorMalLeido', 'unidadMalLeida', 'perdido'])
    expect(lectura.ejes.map(e => e.umbral)).toEqual([0, 0, 0.05])
  })

  it('las 54 filas llegan al panel: 0 %', () => {
    /**
     * LA HISTORIA DE ESTE NÚMERO, QUE ES LO QUE HACE HONESTO EL CERO:
     *
     *  · 1-sep (REG-552): 7 de 46 fuera. 15,2 %. ROJO.
     *  · 2-sep (REG-553): 1 de 46. El médico entregó los rangos (D-041).
     *  · 2-sep (REG-554): 0 de 46 — pero NO porque se recuperara nada más, sino
     *    porque su §1 dice que la fila fuera de rango se acepta provisionalmente
     *    en vez de tirarse. Cambió la política, no sólo el número.
     *  · 2-sep (REG-559): 0 de 54. El corpus creció con un examen general de
     *    orina y un LCR, y los dos entran enteros.
     *
     * Por eso justo debajo se mide lo OTRO: cuántas llegan sin gráfica.
     */
    const m = medirElFoso(corpus())
    expect(m.filas, 'REG-559 añadió dos hojas: orina y LCR').toBe(54)
    expect(m.perdidas).toBe(FILAS_QUE_NO_LLEGAN)

    const lectura = aplicarUmbral(UMBRAL, m)
    expect(lectura.veredicto).toBe('pasa')
    expect(esVerde(lectura)).toBe(true)
  })

  it('pero UNA llega sin gráfica, y eso se cuenta aparte', () => {
    /**
     * «Llega al panel» y «entra a la serie» dejaron de ser lo mismo. Si sólo se
     * midiera el eje del médico, estas dos desaparecerían del informe justo
     * cuando dejaron de desaparecer del panel.
     */
    const sinGrafica: string[] = []
    for (const h of corpus()) {
      const panel = validarPanel({ fecha: '2026-09-01', filas: h.filas })
      sinGrafica.push(...panel.resultados.filter(r => !r.graficable).map(r => `${r.clave}:${r.estado}`))
    }
    expect(sinGrafica.sort()).toEqual(['pcr:VERIFY_VALUE_OR_UNIT'])
    expect(sinGrafica.length).toBe(FILAS_SIN_GRAFICA)
  })

  it('y NADA se queda ya en `noReconocidas`: el catálogo cubre este corpus', () => {
    const fuera: string[] = []
    for (const h of corpus()) {
      const panel = validarPanel({ fecha: '2026-09-01', filas: h.filas })
      fuera.push(...panel.noReconocidas.map(n => n.estudio))
    }
    expect(fuera).toEqual([])
  })

  it('la glucosa en mmol/L ya NO se cae — y desde REG-558 se CONVIERTE', () => {
    /**
     * Hasta REG-554 esta fila desaparecía del panel: el analito estaba en el
     * catálogo y lo tiraba el rango plausible, porque 7,2 no es una glucosa en
     * mg/dL. La defensa hacía lo correcto —mejor fuera que un punto falso en la
     * gráfica— pero el paciente cuyo laboratorio reporta en unidades del SI se
     * quedaba sin serie y sin aviso, y eso se ve como una gráfica corta, que es
     * como no verse.
     *
     * REG-554 la aceptó provisionalmente y la marcó, sin convertirla: el factor
     * no estaba en el catálogo del dueño y una equivalencia no se inventa.
     *
     * REG-558 no fue a buscar el factor: quitó la necesidad de tenerlo. Se
     * calcula desde la masa molar de C₆H₁₂O₆, así que ahora 7,2 mmol/L entran a
     * la serie como ~130 mg/dL, que es lo que son.
     */
    const panel = validarPanel({
      fecha: '2026-09-01',
      filas: [{ estudio: 'Glucosa', valor: '7.2', unidad: 'mmol/L', referencia: '3.9-5.5' }],
    })
    expect(panel.noReconocidas).toEqual([])
    const glu = panel.resultados[0]
    expect(glu.estado).toBe('ACCEPTED')
    expect(glu.valor, 'lo que de verdad son').toBeCloseTo(129.7, 1)
    expect(glu.graficable).toBe(true)
    // Y el original nunca se pierde (§27.1).
    expect(glu.valorOriginal).toBe(7.2)
    expect(glu.unidadOriginal).toBe('mmol/L')
  })

  it('el trinquete: 0 filas fuera del panel, y sólo puede bajar', () => {
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
     * Que en la nota decidiera 0 % de alucinación (D-038) no lo decide aquí. Son
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
