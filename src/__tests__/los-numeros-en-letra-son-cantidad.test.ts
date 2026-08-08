/**
 * ════════════════════════════════════════════════════════════════════════════
 * GOLDEN — REG-192 · «veinticinco miligramos» no es una dosis sin cantidad
 * ════════════════════════════════════════════════════════════════════════════
 *
 * QUÉ FALLABA
 * `dosisSinNumero()` marcaba como dosis rota una dosis perfectamente dictada:
 *
 *     ALERTA  «veinticinco miligramos»: falta la cantidad.
 *
 * — con la cantidad delante, en la misma frase. Y no se quedaba en el cartel:
 * `corregirVigilado()` levanta `requiereConfirmacion` cuando hay una dosis rota,
 * así que la dosis correcta le pedía confirmación al médico.
 *
 * CÓMO SE DESCUBRIÓ
 * 8-ago-2026, auditando el motor con frases de posología de consulta reales de
 * libro (no de paciente). Se llegó a él por el camino de VOICE-004: el mismo
 * módulo ya había fallado en agosto con el signo menos del balance hídrico, lo
 * que sugería que la lista de cantidades estaba incompleta por más de un sitio.
 *
 * CAUSA RAÍZ
 * `ES_CANTIDAD` enumeraba los números en letra y la enumeración tenía un hueco:
 * iba 1…12, saltaba a 15, a 20 y de ahí a las decenas. Faltaban el 13, el 14,
 * el 16-19 y **todo el 21-29**. Las decenas compuestas con «y» —«treinta y
 * cinco»— se salvaban por accidente, porque la palabra previa a la unidad es
 * «cinco»; sólo caían las que se escriben en una sola palabra.
 *
 * POR QUÉ IMPORTA PARA UN PACIENTE
 * El hueco cae justo sobre la posología más repetida de la consulta: 25 mg es
 * metoprolol, espironolactona, captopril, hidroclorotiazida; 18 unidades es una
 * glargina cualquiera. Esta compuerta existe para avisar de una dosis que perdió
 * su número al transcribirse. Una compuerta que salta donde no debe se acaba
 * ignorando — y con ella se ignora el aviso que sí importa.
 *
 * LA REGLA QUE LO HACE SEGURO
 * Ampliar la lista de cantidades no debilita la defensa: son numerales puros,
 * y ninguno puede aparecer delante de una unidad de dosis significando otra
 * cosa. La defensa sigue siendo «unidad sin cantidad delante»; lo único que
 * cambia es que ahora se reconocen todas las cantidades del 1 al 29.
 *
 * QUÉ NO CUBRE
 * - No cubre el 31-99 en letra escritos sin «y» («treintaicinco»): no es la
 *   forma que produce el reconocedor y no se ha medido.
 * - No corrige nada: sigue siendo un DETECTOR. Una dosis que se perdió sigue
 *   sin recuperarse — se avisa, no se completa (esa política no cambia aquí).
 * - No dice nada sobre si la dosis es CORRECTA para el paciente: de eso se
 *   encargan `src/lib/seguridad/dosis.ts` y el motor de sobredosis (REG-190).
 * - No cubre la unidad como primerísima palabra del dictado: el bucle arranca
 *   en el índice 1 porque necesita una palabra previa que mirar.
 */
import { describe, it, expect } from 'vitest'
import { dosisSinNumero } from '@/lib/uci/dosis-sin-numero'
import { corregirVigilado } from '@/lib/asr/corrector-vigilado'

describe('los números en letra del 13 al 29 son cantidad', () => {
  it('«veinticinco miligramos» no es una dosis rota', () => {
    expect(dosisSinNumero('Metoprolol veinticinco miligramos cada doce horas')).toEqual([])
  })

  it('«dieciocho unidades» de insulina no es una dosis rota', () => {
    expect(dosisSinNumero('Insulina glargina dieciocho unidades subcutáneas')).toEqual([])
  })

  it('cubre todo el hueco que había: 13, 14, 16-19 y 21-29', () => {
    const enLetra = [
      'trece', 'catorce', 'dieciséis', 'diecisiete', 'dieciocho', 'diecinueve',
      'veintiún', 'veintiuno', 'veintiuna', 'veintidós', 'veintitrés',
      'veinticuatro', 'veinticinco', 'veintiséis', 'veintisiete', 'veintiocho',
      'veintinueve',
    ]
    for (const n of enLetra) {
      expect(dosisSinNumero(`Fármaco ${n} miligramos`), n).toEqual([])
    }
  })

  it('el acento no cambia el veredicto: se compara ya normalizado', () => {
    expect(dosisSinNumero('Hidrocortisona dieciseis miligramos')).toEqual([])
    expect(dosisSinNumero('Hidrocortisona dieciséis miligramos')).toEqual([])
  })

  it('sigue valiendo para las cuatro unidades que se dictan en letra', () => {
    expect(dosisSinNumero('Vancomicina veintitrés mililitros')).toEqual([])
    expect(dosisSinNumero('Penicilina veinticuatro unidades')).toEqual([])
    expect(dosisSinNumero('Meropenem veintiséis gramos')).toEqual([])
    expect(dosisSinNumero('Fentanilo veintisiete microgramos')).toEqual([])
  })

  it('lo que ya funcionaba sigue funcionando', () => {
    expect(dosisSinNumero('Metoprolol cincuenta miligramos cada doce horas')).toEqual([])
    expect(dosisSinNumero('Meropenem dos gramos cada ocho horas')).toEqual([])
    expect(dosisSinNumero('Linezolid 600 mg cada doce horas')).toEqual([])
    expect(dosisSinNumero('balance neto -1500 mL')).toEqual([])
  })

  it('las decenas compuestas con «y» siguen pasando', () => {
    expect(dosisSinNumero('Prednisona treinta y cinco miligramos')).toEqual([])
    expect(dosisSinNumero('Furosemida cuarenta y ocho miligramos')).toEqual([])
  })
})

describe('la defensa NO se debilitó', () => {
  /**
   * Éstos son los que se comprueban al revés: si la reparación hubiera aflojado
   * la compuerta, aquí es donde se vería. El caso del meropenem es el del corpus
   * de 498 audios que dio origen al módulo.
   */
  it('la unidad sin cantidad delante se sigue marcando', () => {
    const r = dosisSinNumero('Meropenem gramos cada ocho horas en infusión extendida')
    expect(r).toHaveLength(1)
    expect(r[0].antes).toBe('Meropenem')
    expect(r[0].unidad).toBe('gramos')
  })

  it('dos dosis rotas en la misma frase se marcan las dos', () => {
    expect(dosisSinNumero('Meropenem gramos y linezolid miligramos')).toHaveLength(2)
  })

  it('una palabra que se PARECE a un numeral pero no lo es se sigue marcando', () => {
    // «veintiúnico» no existe; lo que importa es que el anclaje de la expresión
    // sigue exigiendo la palabra ENTERA y no acepta un prefijo que coincida.
    expect(dosisSinNumero('Fármaco veintiunico miligramos')).toHaveLength(1)
    expect(dosisSinNumero('Fármaco dieciochoavo miligramos')).toHaveLength(1)
  })
})

describe('el pipeline vigilado deja de pedir confirmación de más', () => {
  it('una dosis bien dictada en letra ya no levanta requiereConfirmacion', () => {
    const r = corregirVigilado('Metoprolol veinticinco miligramos cada doce horas.')
    expect(r.dosisRotas).toEqual([])
    expect(r.requiereConfirmacion).toBe(false)
  })

  it('una dosis que de verdad perdió su número sí la levanta', () => {
    const r = corregirVigilado('Meropenem gramos cada ocho horas.')
    expect(r.dosisRotas).toHaveLength(1)
    expect(r.requiereConfirmacion).toBe(true)
  })
})
