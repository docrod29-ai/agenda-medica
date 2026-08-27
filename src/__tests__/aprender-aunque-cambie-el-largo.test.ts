/**
 * GOLDEN — el 80,6 % de las correcciones del médico se tiraba sin mirarlas.
 *
 * ── EL CUELLO DE BOTELLA, MEDIDO (5-ago-2026) ────────────────────────────────
 *
 * `paresDeUnaNota` sólo aprendía cuando lo oído y lo corregido tenían el mismo
 * número de palabras. Sobre el corpus del Dr.:
 *
 *     mismo largo ....... 363  (19,4 %)
 *     largo distinto .. 1 512  (80,6 %)  ← descartadas enteras
 *
 * Basta que el médico añada un artículo para que toda la nota deje de enseñar.
 * Y de ahí se alimenta el sesgo de vocabulario, que es lo único que cambia lo
 * que el motor OYE.
 *
 * ── POR QUÉ NO BASTABA CON QUITAR EL CANDADO ─────────────────────────────────
 *
 * El motivo original era correcto: comparando por POSICIÓN, una palabra añadida
 * desplaza todas las siguientes y cada «par» sería una coincidencia. Aprender
 * ruido es peor que no aprender.
 *
 * La salida es alinear de verdad —subsecuencia común más larga— y emitir sólo el
 * caso inequívoco: una palabra ocupó el lugar de otra.
 *
 * ── LO QUE ESTE GOLDEN **NO** AFIRMA ─────────────────────────────────────────
 *
 * Que esto mejore mucho el aprendizaje real. Sobre el corpus da apenas un 6 %
 * más de pares, y los que aparecen son ruido de sus filas corruptas. Ese corpus
 * compara forma hablada contra escrita, no correcciones de un médico: **no es el
 * instrumento para medir esto**. Lo que sí es cierto y comprobable es que antes
 * se descartaba el 80,6 % de las oportunidades sin mirarlas.
 */
import { describe, it, expect } from 'vitest'
import { sustituciones, comunes } from '@/lib/asr/alineacion'
import { paresDeUnaNota, identidadDe } from '@/lib/asr/aprendizaje'

/**
 * Desde H-19 el filtro exige saber a quién protege: sin identidad conocida no
 * se aprende nada, y estas pruebas comprueban lo contrario —que lo prohibido
 * sigue prohibido AUNQUE la identidad se conozca—. Paciente sintético.
 */
const YO = identidadDe('Ernestina Quintanilla Robledo')

describe('SE APRENDE AUNQUE EL LARGO CAMBIE', () => {
  it('una palabra corregida con otra añadida al final', () => {
    /**
     * El caso más común en consulta: se arregla el fármaco y se añade la vía.
     * Antes esto no enseñaba nada.
     */
    const r = sustituciones('se indica meropenen hoy', 'se indica meropenem intravenoso hoy')
    expect(r).toContainEqual({ oido: 'meropenen', corregido: 'meropenem' })
  })

  it('y con texto añadido al principio', () => {
    const r = sustituciones('refiere disnea', 'el paciente refiere disnia')
    expect(r).toContainEqual({ oido: 'disnea', corregido: 'disnia' })
  })

  it('el caso de mismo largo sigue funcionando igual', () => {
    // Lo que ya se aprendía no puede dejar de aprenderse.
    const r = sustituciones('el paciente tiene serosa', 'el paciente tiene cirrosis')
    expect(r).toEqual([{ oido: 'serosa', corregido: 'cirrosis' }])
  })
})

describe('NO SE INVENTAN PARES — el criterio no se afloja', () => {
  it('una palabra añadida NO es una corrección', () => {
    // Nadie oyó mal nada: simplemente se añadió texto.
    expect(sustituciones('refiere dolor', 'refiere dolor abdominal')).toEqual([])
  })

  it('una palabra borrada tampoco', () => {
    expect(sustituciones('refiere dolor abdominal', 'refiere dolor')).toEqual([])
  })

  it('y un tramo con varias palabras cambiadas se descarta', () => {
    /**
     * Ahí no se puede saber cuál corresponde a cuál sin adivinar, que es
     * exactamente lo que el candado original evitaba.
     */
    expect(sustituciones('tiene pielo nefritis aguda', 'tiene pielonefritis aguda')).toEqual([])
  })

  it('un texto vacío no produce nada', () => {
    expect(sustituciones('', 'algo')).toEqual([])
    expect(sustituciones('algo', '')).toEqual([])
  })
})

describe('LA ALINEACIÓN ES CORRECTA, NO UNA HEURÍSTICA', () => {
  it('encuentra las palabras conservadas', () => {
    const a = ['el', 'paciente', 'tiene', 'fiebre']
    const b = ['el', 'paciente', 'no', 'tiene', 'fiebre']
    const c = comunes(a, b)
    // 'el', 'paciente', 'tiene', 'fiebre' se conservan: cuatro anclas.
    expect(c).toHaveLength(4)
  })

  it('y no se cuelga con textos enormes', () => {
    /**
     * Guardar la nota importa más que aprender de ella: hay tope.
     */
    const enorme = new Array(5000).fill('palabra')
    expect(comunes(enorme, enorme)).toEqual([])
  })
})

describe('SIGUE SIN APRENDER LO QUE NO DEBE', () => {
  it('las cifras no se aprenden, aunque ahora se alineen', () => {
    // La dosis no se aprende sola: es la regla más importante de este módulo.
    const r = paresDeUnaNota('dar 500 mg hoy', 'dar 850 mg hoy y revisar', YO)
    expect(r).toEqual([])
  })

  it('ni los pares prohibidos por la política crítica', () => {
    const r = paresDeUnaNota('poner mcg por kilo', 'poner mg por kilo ahora', YO)
    expect(r).toEqual([])
  })
})
