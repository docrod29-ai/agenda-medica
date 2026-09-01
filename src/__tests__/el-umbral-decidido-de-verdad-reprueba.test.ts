/**
 * GOLDEN — REG-447. El umbral que fijó el médico ahora REPRUEBA algo.
 *
 * ── QUÉ FALLABA ──────────────────────────────────────────────────────────────
 *
 * El 31-ago-2026 el médico dueño fijó el primero de los quince umbrales de IA
 * (D-029): para `nota-consulta`, hasta 1 de cada 100 campos dictados puede
 * perderse y CERO pueden inventarse. REG-446 lo dejó escrito en
 * `contratos-de-evaluacion.ts` con su fuente y sus dos ejes.
 *
 * Y ahí se quedó. El contrato lo declaraba, el guardián del censo comprobaba que
 * estuviera bien declarado… y **nadie corría la evaluación contra él**. El arnés
 * (`ia/evaluacion.ts`) medía por un lado; el número vivía por otro; entre los dos
 * no había una sola función. Un umbral que no puede reprobar nada es lo que el
 * propio contrato llama una métrica decorativa — sólo que la decoración la
 * habríamos puesto nosotros encima de una decisión que el médico sí tomó.
 *
 * ── CÓMO SE DESCUBRIÓ ────────────────────────────────────────────────────────
 *
 * Al cerrar REG-446 quedó anotado en su propia entrada del ledger: «que el
 * umbral se APLIQUE es otra mitad, y necesita el conjunto». El conjunto existía
 * desde REG-197 (`casos-oro.ts`). Lo que faltaba era la función que junta los
 * dos, y la escribí yo — o sea que este defecto lo habría creado yo mismo si se
 * hubiera quedado así.
 *
 * ── LA CAUSA RAÍZ ────────────────────────────────────────────────────────────
 *
 * La familia «escrito y sin conectar» de la regla *el dato tiene que LLEGAR*,
 * aplicada a un número en vez de a un campo: el dato acababa en la constante que
 * lo declara, y ahí no ha llegado a ninguna parte.
 *
 * ── LA REGLA QUE LO HACE SEGURO ──────────────────────────────────────────────
 *
 * El veredicto sale del umbral que está **en el contrato**, no de una copia. Y
 * `pasa` no se devuelve nunca por omisión: umbral pendiente, conjunto vacío o
 * eje sin medir tienen cada uno su propio veredicto, y ninguno es verde.
 *
 * ── LO QUE ESTA PRUEBA **NO** CUBRE ──────────────────────────────────────────
 *
 *  · **No ejerce el 1 %.** El corpus tiene CUATRO campos esperados, así que el
 *    escalón más pequeño que se puede medir en el eje `perdida` es 25 % —
 *    veinticinco veces el umbral. En la práctica la compuerta se comporta hoy
 *    como si ese umbral fuera cero: más estricto, no más laxo. Se comprueba
 *    abajo que la lectura lo DECLARA, porque nadie debe creer que el número del
 *    médico está puesto a prueba. Para ejercerlo harían falta ≥ 100 campos.
 *  · **No dice cuánto alucina el producto.** El conjunto es sintético, pequeño y
 *    nuestro. La cifra defendible ante un hospital necesita dictados reales
 *    de-identificados y anotación clínica, y la produce el Dr.
 *  · **No comprueba la traducción de eje a métrica contra la cabeza del médico.**
 *    Que `perdida` se lea como `tasaError` (faltantes + incorrectos) es una
 *    elección de quien escribe el código; se tomó la lectura más estricta y se
 *    dejó por escrito para que él la pueda desmentir.
 *  · **No corre en producción.** Es una compuerta del CI. No bloquea una nota.
 */
import { describe, it, expect } from 'vitest'
import { CASOS_ORO } from '@/lib/ia/casos-oro'
import {
  evaluarConjunto, type SalidaGenerada,
  medirEjes, resolucionDelConjunto, loMedidoDeLaNota,
} from '@/lib/ia/evaluacion'
import {
  CONTRATOS, PENDIENTE_DEL_MEDICO, sinUmbral, type Umbral,
  aplicarUmbral, esVerde,
  LO_QUE_LA_COMPUERTA_NO_HACE, PORQUE_UN_CONJUNTO_VACIO_NO_ES_VERDE,
  PORQUE_UN_UMBRAL_PENDIENTE_NO_ES_VERDE,
} from '@/lib/ia/contratos-de-evaluacion'

/** El umbral REAL del contrato. Si alguien lo cambia allí, esta prueba lo usa. */
const UMBRAL_DE_LA_NOTA: Umbral = CONTRATOS.find(c => c.capacidad === 'nota-consulta')!.umbral

/** La salida perfecta: cada caso devuelve exactamente lo que el oro esperaba. */
const salidaCorrecta = (): SalidaGenerada[] =>
  CASOS_ORO.map(c => ({ id: c.id, campos: { ...c.esperado } }))

const correr = (generadas: SalidaGenerada[], umbral: Umbral = UMBRAL_DE_LA_NOTA) =>
  aplicarUmbral(umbral, loMedidoDeLaNota(evaluarConjunto(CASOS_ORO, generadas).resumen))

describe('EL UMBRAL DE D-029 SE APLICA, no sólo se declara', () => {
  it('el veredicto sale del contrato, no de una copia', () => {
    /**
     * Si el número viviera aquí duplicado, cambiarlo en el contrato no cambiaría
     * nada y tendríamos dos fuentes de verdad para la misma decisión clínica.
     * Se comprueba que los ejes del contrato son los que salen en la lectura.
     */
    expect(PENDIENTE_DEL_MEDICO in UMBRAL_DE_LA_NOTA).toBe(false)
    const lectura = correr(salidaCorrecta())
    expect(lectura.ejes.map(e => e.nombre)).toEqual(['perdida', 'alucinacion'])
    expect(lectura.ejes.map(e => e.umbral)).toEqual([0.01, 0])
  })

  it('con la salida correcta, PASA — y no por casualidad: hay algo medido', () => {
    const { resumen } = evaluarConjunto(CASOS_ORO, salidaCorrecta())
    expect(resumen.casos).toBe(4)
    expect(resumen.camposEsperados).toBe(4)
    expect(esVerde(correr(salidaCorrecta()))).toBe(true)
  })
})

describe('AL REVÉS — con el defecto dentro, reprueba', () => {
  it('un campo dictado que se pierde REPRUEBA el eje `perdida`', () => {
    /**
     * Es el fallo que el médico puso en 1 %: un medicamento que se dictó y no
     * aparece en la nota. Aquí se quita un campo entero de la salida.
     */
    const rota = salidaCorrecta()
    rota[0] = { id: rota[0].id, campos: {} }
    const lectura = correr(rota)
    expect(lectura.veredicto).toBe('reprueba')
    expect(esVerde(lectura)).toBe(false)
    expect(lectura.ejes.find(e => e.nombre === 'perdida')!.veredicto).toBe('reprueba')
    expect(lectura.porQue).toMatch(/perdida/)
  })

  it('un campo CAMBIADO también reprueba: llegar mal no es llegar', () => {
    /**
     * La lectura estricta de `perdida` en acción. Un campo presente pero con
     * otro contenido no es «presente con matices»: la enalapril que sale como
     * enalaprilato no está en la nota.
     */
    const rota = salidaCorrecta()
    rota[0] = { id: rota[0].id, campos: { negativos: 'refiere cefalea de dos meses' } }
    expect(correr(rota).veredicto).toBe('reprueba')
  })

  it('un dato INVENTADO reprueba el eje `alucinacion`, que está en cero', () => {
    /**
     * El fallo caro: no el que falta, el que sobra. Se mete uno de los
     * `prohibidos` del propio corpus —las dos crónicas que el paciente negó— y
     * la compuerta tiene que ponerse roja con UNO solo.
     */
    const rota = salidaCorrecta()
    const caso = CASOS_ORO.find(c => c.id === 'oro-negacion-cronicas')!
    rota[0] = {
      id: caso.id,
      campos: { ...caso.esperado, [caso.prohibidos![0]]: 'sí, desde hace años' },
    }
    const lectura = correr(rota)
    expect(lectura.veredicto).toBe('reprueba')
    expect(lectura.ejes.find(e => e.nombre === 'alucinacion')!.medido).toBeGreaterThan(0)
  })

  it('y el número del contrato es el que manda: con un umbral laxo, lo mismo pasa', () => {
    /**
     * La prueba de que no hay una constante escondida. La MISMA salida rota que
     * reprueba con el 1 % del médico pasa con un 50 % inventado — y ese 50 % no
     * está en ningún contrato: se construye aquí para demostrar que el veredicto
     * se mueve con el número.
     */
    const rota = salidaCorrecta()
    rota[0] = { id: rota[0].id, campos: {} }
    const laxo: Umbral = { valor: 0.5, fuente: 'Sólo para esta prueba: NO es un umbral del producto.', ejes: [{ nombre: 'perdida', valor: 0.5, porQue: 'inventado para la prueba' }] }
    expect(correr(rota, laxo).veredicto).toBe('pasa')
  })
})

describe('AL REVÉS POR EL OTRO LADO — no se pasa de frenada', () => {
  it('la variación de redacción NO reprueba', () => {
    /**
     * Si acentos, mayúsculas y puntuación reprobaran, la compuerta estaría
     * siempre roja y se dejaría de mirar — que es exactamente el argumento con
     * el que el médico descartó el 0 % en el eje `perdida`.
     */
    const variada = CASOS_ORO.map(c => ({
      id: c.id,
      campos: Object.fromEntries(
        Object.entries(c.esperado).map(([k, v]) => [k, `${v.toUpperCase()}.`]),
      ),
    }))
    expect(esVerde(correr(variada))).toBe(true)
  })

  it('un campo de MÁS que sí estaba en el dictado no es una alucinación', () => {
    /**
     * Ausencia en el oro no es invención. El acompañante dijo que le pone la
     * insulina; que la nota lo recoja en un campo que el oro no pedía no es un
     * dato inventado, y marcarlo enseñaría al médico a cerrar el aviso sin leer.
     */
    const conExtra = salidaCorrecta()
    const i = CASOS_ORO.findIndex(c => c.id === 'oro-rol-acompanante')
    conExtra[i] = { ...conExtra[i], campos: { ...conExtra[i].campos, tratamiento: 'insulina' } }
    expect(esVerde(correr(conExtra))).toBe(true)
  })
})

describe('LOS TRES HUECOS QUE NO SON VERDE', () => {
  it('un umbral que espera al médico NO es permiso', () => {
    /**
     * Trece de las quince capacidades están así hoy. Si `NEEDS_CLINICAL_REVIEW`
     * se leyera como aprobado, el hueco se convertiría en un visto bueno — y
     * sería el fallo que el propio contrato existe para impedir.
     */
    /**
     * Se toma del censo, no por nombre: cuando escribí esto el ejemplo era
     * `transcribir`, y AL DÍA SIGUIENTE el médico lo decidió (D-030). Una prueba
     * que nombra una capacidad concreta caduca en cuanto el trabajo avanza.
     */
    const quedanPendientes = sinUmbral()
    expect(quedanPendientes.length, 'si no queda ninguno, este hueco ya no existe').toBeGreaterThan(0)
    const pendiente = quedanPendientes[0].umbral
    const lectura = correr(salidaCorrecta(), pendiente)
    expect(lectura.veredicto).toBe('sin_umbral_decidido')
    expect(esVerde(lectura)).toBe(false)
    expect(lectura.porQue).toBe(PORQUE_UN_UMBRAL_PENDIENTE_NO_ES_VERDE)
  })

  it('un conjunto VACÍO no es permiso: borrar el corpus no pone la compuerta en verde', () => {
    /**
     * Cero casos dan cero errores y cero alucinaciones. Sin esto, la manera más
     * fácil de tener la compuerta verde sería vaciar el corpus, y la compuerta
     * mediría el corpus en vez del producto.
     */
    const lectura = aplicarUmbral(UMBRAL_DE_LA_NOTA, loMedidoDeLaNota(evaluarConjunto([], []).resumen))
    expect(lectura.veredicto).toBe('sin_conjunto')
    expect(esVerde(lectura)).toBe(false)
    expect(lectura.porQue).toBe(PORQUE_UN_CONJUNTO_VACIO_NO_ES_VERDE)
  })

  it('un eje que este arnés no sabe medir tampoco es permiso', () => {
    /**
     * Ausencia de dato no es dato de ausencia (seguridad clínica §4), dicho en
     * lenguaje de compuerta: si mañana el contrato declara un eje nuevo, se dice
     * en vez de ignorarlo.
     */
    const conEjeDesconocido: Umbral = {
      valor: 0, fuente: 'Sólo para esta prueba.',
      ejes: [{ nombre: 'latencia', valor: 0, porQue: 'un eje que este arnés no mide' }],
    }
    const lectura = correr(salidaCorrecta(), conEjeDesconocido)
    expect(lectura.veredicto).toBe('sin_ejes_medibles')
    expect(esVerde(lectura)).toBe(false)
    expect(lectura.porQue).toMatch(/el arnés no lo midió/)
  })

  it('`esVerde` es el ÚNICO sitio donde se define verde', () => {
    /**
     * Sin esta función, cada llamador escribiría `veredicto !== 'reprueba'` y
     * los tres huecos de arriba pasarían a ser un visto bueno por descuido. Se
     * comprueba que ninguno de los cinco veredictos salvo `pasa` es verde.
     */
    for (const v of ['reprueba', 'sin_umbral_decidido', 'sin_conjunto', 'sin_ejes_medibles'] as const) {
      expect(esVerde({ veredicto: v, ejes: [], porQue: '' }), v).toBe(false)
    }
    expect(esVerde({ veredicto: 'pasa', ejes: [], porQue: '' })).toBe(true)
  })
})

describe('LO QUE ESTA COMPUERTA NO PUEDE MEDIR, dicho a tiempo', () => {
  it('el conjunto es demasiado pequeño para ejercer el 1 %, y la lectura lo DICE', () => {
    /**
     * ── LA MEDICIÓN, ANTES DE ESCRIBIR NADA ────────────────────────────────
     *
     * El corpus tiene 4 casos y 4 campos esperados. El escalón más pequeño que
     * se puede medir en `perdida` es 1/4 = 0,25: veinticinco veces el umbral que
     * fijó el médico. O sea que hoy la compuerta se comporta como si ese umbral
     * fuera CERO.
     *
     * Es más estricto, no más laxo, así que se aplica igual. Lo que no se puede
     * hacer es callarlo: nadie debe leer «pasa» y creer que el 1 % de D-029 está
     * puesto a prueba.
     */
    const { resumen } = evaluarConjunto(CASOS_ORO, salidaCorrecta())
    expect(resolucionDelConjunto(resumen).perdida).toBe(0.25)

    const lectura = correr(salidaCorrecta())
    const perdida = lectura.ejes.find(e => e.nombre === 'perdida')!
    expect(perdida.elConjuntoNoAlcanzaElUmbral, 'el 1 % no se está ejerciendo').toBe(true)
    expect(lectura.porQue).toMatch(/demasiado pequeño/)

    // Y el eje que SÍ se ejerce no se marca: el cero de `alucinacion` es
    // alcanzable con un solo caso, así que no hay nada que declarar.
    expect(lectura.ejes.find(e => e.nombre === 'alucinacion')!.elConjuntoNoAlcanzaElUmbral).toBe(false)
  })

  it('con 100 campos esperados el 1 % sí se ejerciría — la resolución es del conjunto, no del código', () => {
    /**
     * La contraprueba de la anterior: la limitación es del corpus. Se construyen
     * cien campos sintéticos y el escalón cae a 0,01, que es justo el umbral.
     */
    const cien = Array.from({ length: 100 }, (_, i) => ({
      id: `c${i}`, entrada: `hallazgo ${i}`, esperado: { hallazgo: `hallazgo ${i}` },
    }))
    const { resumen } = evaluarConjunto(cien, cien.map(c => ({ id: c.id, campos: c.esperado })))
    expect(resolucionDelConjunto(resumen).perdida).toBe(0.01)
    const lectura = aplicarUmbral(UMBRAL_DE_LA_NOTA, loMedidoDeLaNota(resumen))
    expect(lectura.ejes.find(e => e.nombre === 'perdida')!.elConjuntoNoAlcanzaElUmbral).toBe(false)
  })

  it('y NO se presenta como una medición de producción', () => {
    const texto = LO_QUE_LA_COMPUERTA_NO_HACE.join(' ')
    expect(texto).toMatch(/NO son las tasas de error de Ausculta/)
    expect(texto).toMatch(/No corre en producción/)
    expect(LO_QUE_LA_COMPUERTA_NO_HACE.length).toBeGreaterThanOrEqual(4)
  })

  it('la traducción de cada eje a la métrica está escrita, no supuesta', () => {
    /**
     * `perdida` cuenta también los INCORRECTOS. Eso no está en la palabra
     * «perdida» y no lo decidió el médico: lo decidí yo, por el lado estricto.
     * Si no estuviera escrito, dentro de seis meses nadie sabría que el número
     * del contrato y el que mide la compuerta no son exactamente lo mismo.
     */
    const { resumen } = evaluarConjunto(
      [{ id: 'x', entrada: 'tos', esperado: { dx: 'gripe', plan: 'reposo' } }],
      [{ id: 'x', campos: { dx: 'otra cosa' } }],
    )
    // 1 incorrecto + 1 faltante sobre 2 esperados.
    expect(medirEjes(resumen).perdida).toBe(1)
  })
})
