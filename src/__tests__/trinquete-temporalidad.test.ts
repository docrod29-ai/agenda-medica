/**
 * TRINQUETE DEL MOTOR DE TEMPORALIDAD — EVAL-002.
 *
 * ── QUÉ FALTABA ──────────────────────────────────────────────────────────────
 *
 * El motor se construyó en v1027-v1030 y salió **sin corpus**: sus únicos casos
 * eran los que escribió quien lo escribió. Una defensa sin medición no se sabe
 * si protege o estorba, y ésta se equivoca en las dos direcciones caras:
 *
 * · **De menos** — un padecimiento contado en pasado que pasa por activo queda
 *   en el expediente, se copia a la nota siguiente y cambia lo que otro médico
 *   lee dentro de seis meses.
 * · **De más** — marcar «hace tres años que tiene diabetes» gasta el aviso en la
 *   forma más común de contar un crónico. El propio módulo lo dice desde que se
 *   escribió: eso «sería peor que no mirar nada».
 *
 * ── LO QUE LA PRIMERA MEDICIÓN ENCONTRÓ (7-ago-2026) ────────────────────────
 *
 * Dos familias enteras fallaban al 100 %, las dos del lado del falso positivo:
 *
 *     «hace tres años QUE tiene diabetes»  → se marcaba pasado
 *     «tiene diabetes hace tres años»      → se marcaba pasado
 *
 * El motor cubría «**desde** hace tres años tiene diabetes» y no las otras dos
 * formas de decir exactamente lo mismo. Y del lado contrario, «ya se curó» no se
 * reconocía porque el patrón exigía el «le» («ya se **le** curó»).
 *
 * ── POR QUÉ ESTE CORPUS NO SE DA LA RAZÓN A SÍ MISMO ────────────────────────
 *
 * Es la objeción obvia —la escribe el mismo agente que escribió el motor— y se
 * responde con la construcción, no con la promesa:
 *
 * 1. Es el **producto cruzado** de marcos × padecimientos: 496 frases de 31
 *    marcos declarados. Nadie elige caso por caso, que es como se cuelan los
 *    ejemplos que ya pasaban.
 * 2. La etiqueta la pone el **marco**, por gramática española, y está escrita en
 *    el generador **antes** de correr el motor. No puede coincidir por
 *    construcción.
 * 3. Los marcos de control existen para que el arreglo no se pase de listo:
 *    «hace tres años que **tuvo** neumonía» es pasado con el mismo «hace…que».
 *    Si alguien apagara la trampa mirando sólo la marca de tiempo, ese marco se
 *    pone rojo.
 *
 * ── EL PISO ES LO MEDIDO, NO UNA META ────────────────────────────────────────
 *
 * Como en el trinquete de voz (REG-145): los topes son lo que da el motor hoy y
 * **sólo pueden mejorar**. Un trinquete que nace con margen se lo come el
 * siguiente descuido.
 *
 * ── QUÉ NO CUBRE, DECLARADO ──────────────────────────────────────────────────
 *
 * · **No es una medición de producción.** Es sintético y son plantillas, no
 *   dictado real. Dice si la defensa gramatical sigue en pie, no cuánto acierta
 *   sobre la consulta del Dr. Ese número necesita transcripciones y anotación
 *   clínica, y lo produce él, no yo. Presentarlos como lo mismo sería su propia
 *   forma de inventar una cifra.
 * · **No mide el vocabulario.** Que falte un padecimiento significa que ese caso
 *   no se vigila, no que se dé por bueno; el motor lo declara y aquí no se
 *   corrige.
 * · **No mide la frase compuesta.** Cada fila es una oración. «Tuvo neumonía
 *   hace tres años y ahora tiene diabetes» es otro problema y otro corpus.
 * · **No juzga la decisión clínica.** El motor avisa de que el dictado y la nota
 *   no concuerdan en el tiempo; si el antecedente debe escribirse o no lo decide
 *   el médico.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { esFrasePasada, padecimientosEn } from '@/lib/expediente/temporalidad'

interface Fila { id: string; frase: string; etiqueta: 'pasado' | 'presente'; familia: string }

/** CSV mínimo: los campos con coma van entrecomillados por el generador. */
function leerCorpus(): Fila[] {
  const txt = readFileSync(join(process.cwd(), 'fixtures', 'temporalidad', 'corpus-oro.csv'), 'utf8')
  return txt.trim().split('\n').slice(1).map(linea => {
    const campos = linea.match(/("(?:[^"]*)"|[^,]*)/g)!.filter(c => c !== '')
    const limpio = campos.map(c => c.replace(/^"|"$/g, ''))
    return { id: limpio[0], frase: limpio[1], etiqueta: limpio[2] as Fila['etiqueta'], familia: limpio[3] }
  })
}

const CORPUS = leerCorpus()

describe('el corpus existe y es lo que dice ser', () => {
  it('tiene las 496 frases y las dos etiquetas', () => {
    // Si el generador se rompiera y escribiera un archivo corto, un corpus vacío
    // mediría cero y pasaría en verde: por eso el tamaño es parte del contrato.
    expect(CORPUS.length).toBe(496)
    expect(CORPUS.filter(f => f.etiqueta === 'pasado').length).toBeGreaterThan(200)
    expect(CORPUS.filter(f => f.etiqueta === 'presente').length).toBeGreaterThan(200)
  })

  it('el vocabulario reconoce el padecimiento de cada frase', () => {
    // Si el motor no ve el padecimiento, la frase no mide temporalidad: mide otra
    // cosa. Este caso separa un fallo de vocabulario de un fallo de tiempo.
    const ciegas = CORPUS.filter(f => padecimientosEn(f.frase).length === 0)
    expect(ciegas.map(f => f.frase)).toEqual([])
  })
})

describe('MEDICIÓN — el piso es lo medido el 7-ago-2026', () => {
  const fallos = CORPUS.filter(f => esFrasePasada(f.frase) !== (f.etiqueta === 'pasado'))

  it('cero frases mal clasificadas', () => {
    // El criterio es CERO y no un porcentaje: el corpus se controla entero, los
    // marcos son 31 y están declarados. Un fallo aquí es un marco que se rompió,
    // no ruido estadístico. Cuando falle, trae las frases delante.
    expect(fallos.map(f => `[${f.etiqueta}] ${f.frase}  (${f.familia})`)).toEqual([])
  })

  it('ninguna familia de marcos falla entera', () => {
    /**
     * Separado del anterior a propósito. Un fallo repartido puede ser una frase
     * rara; una FAMILIA entera en rojo es una construcción del español que el
     * motor no entiende — que es exactamente lo que encontró esta medición.
     */
    const porFamilia = new Map<string, { total: number; mal: number }>()
    for (const f of CORPUS) {
      const e = porFamilia.get(f.familia) ?? { total: 0, mal: 0 }
      e.total++
      if (esFrasePasada(f.frase) !== (f.etiqueta === 'pasado')) e.mal++
      porFamilia.set(f.familia, e)
    }
    const enteras = [...porFamilia.entries()].filter(([, e]) => e.mal === e.total).map(([k]) => k)
    expect(enteras).toEqual([])
  })
})

describe('LOS CONTROLES — que el arreglo de la trampa no se pase de listo', () => {
  /**
   * «hace…que» es presente cuando el verbo va en presente y pasado cuando va en
   * pretérito. Si alguien apagara la trampa mirando sólo la marca de tiempo,
   * estos dos casos se separan.
   */
  it('«hace tres años que TIENE diabetes» es presente', () => {
    expect(esFrasePasada('hace tres años que tiene diabetes')).toBe(false)
  })

  it('«hace tres años que TUVO neumonía» sigue siendo pasado', () => {
    expect(esFrasePasada('hace tres años que tuvo neumonía')).toBe(true)
  })

  it('y la marca de tiempo sola, sin verbo en presente, sigue siendo pasado', () => {
    expect(esFrasePasada('tuvo neumonía hace tres años')).toBe(true)
  })

  it('el «le» dejó de ser obligatorio, y el que lo trae no se rompió', () => {
    expect(esFrasePasada('ya se curó de la neumonía')).toBe(true)
    expect(esFrasePasada('ya se le quitó la neumonía')).toBe(true)
  })
})
