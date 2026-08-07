/**
 * GOLDEN — el corpus oro del motor de temporalidad, y el defecto que destapó.
 *
 * ── DE DÓNDE SALE ────────────────────────────────────────────────────────────
 *
 * De EVAL-002 del backlog: «el motor se construyó en v1027-v1030 y no tiene
 * corpus: sus casos son los que yo escribí». Una defensa sin medición no se sabe
 * si protege o estorba — y ésta puede degradar un diagnóstico activo si se
 * equivoca, que es el daño peor que sabe hacer.
 *
 * Así que primero se escribió el corpus (`fixtures/temporalidad/corpus-oro.json`,
 * 34 frases sintéticas imitando cómo se resume un interrogatorio en la consulta
 * mexicana) y después se midió. El motor falló 6 de 34 — y los 6 eran la misma
 * frase compuesta.
 *
 * ── QUÉ FALLABA ──────────────────────────────────────────────────────────────
 *
 * El motor juzgaba el tiempo de la FRASE ENTERA y cosechaba todo padecimiento
 * nombrado en ella. Pero en el dictado el antecedente y el padecimiento actual
 * viajan pegados, unidos por una coma o por una «y»:
 *
 *     «Tuvo neumonía hace tres años y ahora tiene diabetes.»
 *
 * La frase llevaba marca de pasado, así que **la diabetes salía también como
 * dicha en pasado**. Si la nota la afirmaba como actual —que es lo correcto— el
 * motor avisaba de un desajuste inexistente sobre un diagnóstico ACTIVO. Y por
 * el otro lado:
 *
 *     «Padeció dengue en 2019 y su asma sigue activa.»
 *
 * el «sigue» del asma indultaba la frase entera y **el dengue dejaba de
 * vigilarse**. Un aviso de más y otro de menos, del mismo defecto.
 *
 * ── POR QUÉ IMPORTA PARA UN PACIENTE ─────────────────────────────────────────
 *
 * Los dos lados hacen daño y no el mismo. El falso positivo empuja a degradar a
 * antecedente una diabetes que está activa —y los antecedentes se arrastran a
 * todas las notas siguientes—. El falso negativo deja pasar la neumonía de hace
 * tres años escrita como diagnóstico de hoy. Y hay un tercer daño, más callado:
 * un aviso que salta donde no debe se acaba ignorando, y con él se ignoran los
 * que sí importan.
 *
 * ── LA REGLA QUE LO HACE SEGURO ──────────────────────────────────────────────
 *
 * La marca de tiempo pertenece a la CLÁUSULA, no a la frase. Se trocea por lo
 * que en el dictado separa dos predicados —los signos y las conjunciones
 * coordinantes— y el presente sólo calla el padecimiento del que habla: si la
 * cláusula en presente nombra uno, habla de ése; si no nombra ninguno, es una
 * elipsis y se refiere a lo recién dicho. La enumeración («Tuvo diabetes e
 * hipertensión») hereda el verbo que comparte, y sólo ella.
 *
 * ── QUÉ NO CUBRE ─────────────────────────────────────────────────────────────
 *
 * · **El vocabulario sigue siendo el límite.** «Tuvo gastritis crónica hace tres
 *   años» no se vigila porque la gastritis no está en ninguna de las dos listas
 *   (TMP-122). Que falte significa que ese caso no se mira — NO que se dé por
 *   bueno.
 * · **«Desde entonces» no está declarado como presente** (TMP-042): la diabetes
 *   de esa frase no se cosecha porque no lleva marca de pasado propia, no porque
 *   el motor entienda que sigue. Acierta por el lado seguro.
 * · **El corpus es sintético y de una sola mano.** Mide que el motor haga lo que
 *   dice su gramática; no mide con qué frecuencia aparece cada forma en la
 *   consulta real del Dr. Eso sigue pendiente (EVAL-001/EVAL-003) y no lo
 *   sustituye este archivo.
 * · **No mide la nota.** Aquí sólo se comprueba qué situó el DICTADO en pasado.
 *   El contraste contra la nota vive en `el-pasado-no-es-el-presente.test.ts`.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { mencionesEnPasado, desajustesTemporales } from '@/lib/expediente/temporalidad'

interface CasoOro {
  id: string
  familia: string
  dictado: string
  esperado: string[]
  porQue: string
}

const CORPUS: { origen: string; casos: CasoOro[] } = JSON.parse(
  readFileSync(join(process.cwd(), 'fixtures', 'temporalidad', 'corpus-oro.json'), 'utf8'),
)

const pasadasDe = (dictado: string) => mencionesEnPasado(dictado).map(m => m.condicion).sort()

describe('EL CORPUS ORO, MEDIDO ENTERO', () => {
  /**
   * Un solo `it(` por dirección de error, a propósito: lo que interesa cuando
   * esto se pone rojo es **qué frase** falló y **hacia dónde**, no cuántas.
   */
  it('ni un falso positivo — es el que degrada un diagnóstico activo', () => {
    const fallos = CORPUS.casos
      .map(c => ({ c, sobran: pasadasDe(c.dictado).filter(x => !c.esperado.includes(x)) }))
      .filter(f => f.sobran.length)
      .map(f => `${f.c.id}: «${f.c.dictado}» → sobra ${JSON.stringify(f.sobran)} · ${f.c.porQue}`)
    expect(fallos).toEqual([])
  })

  it('ni un falso negativo — el pasado que se cuela queda escrito como si fuera de hoy', () => {
    const fallos = CORPUS.casos
      .map(c => ({ c, faltan: c.esperado.filter(x => !pasadasDe(c.dictado).includes(x)) }))
      .filter(f => f.faltan.length)
      .map(f => `${f.c.id}: «${f.c.dictado}» → falta ${JSON.stringify(f.faltan)} · ${f.c.porQue}`)
    expect(fallos).toEqual([])
  })

  it('el corpus es sintético y lo declara: ni un paciente real', () => {
    // La regla de datos: ni en pruebas, ni en fixtures, ni en corpus.
    expect(CORPUS.origen).toMatch(/SINTÉTICO/)
    expect(CORPUS.casos.length).toBeGreaterThanOrEqual(30)
  })

  it('y cada caso dice POR QUÉ está: un caso sin origen se borra en seis meses', () => {
    for (const c of CORPUS.casos) {
      expect(c.porQue.length, c.id).toBeGreaterThan(20)
      expect(c.familia.length, c.id).toBeGreaterThan(0)
    }
  })

  it('cubre las dos direcciones del fallo, no sólo una', () => {
    /**
     * Un corpus que sólo trajera casos que deben avisar certificaría un motor
     * que avisa siempre. La mitad tiene que ser silencio esperado.
     */
    const hablan = CORPUS.casos.filter(c => c.esperado.length).length
    const callan = CORPUS.casos.length - hablan
    expect(hablan).toBeGreaterThanOrEqual(10)
    expect(callan).toBeGreaterThanOrEqual(10)
  })
})

describe('EL DEFECTO QUE EL CORPUS DESTAPÓ — la frase compuesta', () => {
  it('«tuvo neumonía hace tres años y ahora tiene diabetes» NO pone la diabetes en pasado', () => {
    /**
     * El caso que abrió todo esto. La diabetes se dijo en presente; marcarla
     * empuja a degradar a antecedente un diagnóstico activo, y los antecedentes
     * se arrastran a todas las notas siguientes.
     */
    expect(pasadasDe('Tuvo neumonía hace tres años y ahora tiene diabetes.')).toEqual(['neumonía'])
  })

  it('el punto y coma separa dos predicados, y `frases()` no lo parte', () => {
    expect(pasadasDe('El paciente tuvo una fractura de cadera hace dos años; su hipertensión está descontrolada.'))
      .toEqual(['fractura'])
  })

  it('y al revés: un «sigue» ajeno ya no indulta la frase entera', () => {
    // El asma sigue activa; el dengue de 2019 no. Antes se perdían los dos.
    expect(pasadasDe('Padeció dengue en 2019 y su asma sigue activa.')).toEqual(['dengue'])
    expect(pasadasDe('Tuvo COVID en 2021, hipertenso en tratamiento con losartán.')).toEqual(['COVID-19'])
  })

  it('el presente que NO nombra padecimiento sí habla de lo recién dicho', () => {
    /**
     * La otra mitad, y sin ella trocear por cláusulas habría fabricado un aviso
     * nuevo: «actualmente descontrolada» no nombra nada porque se refiere a la
     * diabetes de la cláusula anterior.
     */
    expect(pasadasDe('Tenía diabetes, actualmente descontrolada.')).toEqual([])
    expect(pasadasDe('Tuvo cáncer de colon en 2020, todavía en tratamiento.')).toEqual([])
  })

  it('la enumeración hereda el verbo que comparte, y sólo ella', () => {
    // «e hipertensión» no tiene verbo propio: lo toma de «Tuvo».
    expect(pasadasDe('Tuvo diabetes e hipertensión.')).toEqual(['diabetes', 'hipertensión arterial'])
    // «ahora tiene diabetes» SÍ tiene el suyo: no hereda nada.
    expect(pasadasDe('Tuvo neumonía y ahora tiene diabetes.')).toEqual(['neumonía'])
  })

  it('la trampa original sigue en pie: el presente manda', () => {
    /**
     * Trocear por cláusulas no puede costar la defensa que ya existía. «Desde
     * hace tres años tiene diabetes» es la forma normal de contar un crónico.
     */
    expect(pasadasDe('Desde hace tres años tiene diabetes.')).toEqual([])
    expect(pasadasDe('Tuvo hipertensión y sigue con hipertensión.')).toEqual([])
    expect(pasadasDe('Padeció asma y todavía tiene asma.')).toEqual([])
  })

  it('la cita que ve el médico sigue siendo la FRASE entera, no la cláusula', () => {
    /**
     * Se trocea para juzgar, no para citar: el médico tiene que poder resolverlo
     * sin volver al audio, y media frase no basta para eso.
     */
    const m = mencionesEnPasado('Tuvo neumonía hace tres años y ahora tiene diabetes.')
    expect(m[0].cita).toBe('Tuvo neumonía hace tres años y ahora tiene diabetes.')
  })

  it('y el desajuste contra la nota se calcula sobre lo que quedó, no sobre lo que sobraba', () => {
    /**
     * El dato tiene que LLEGAR: comprobar el motor no basta si el aviso que ve
     * el médico se arma después. Con el defecto vivo, esta nota —que es
     * correcta— sacaba un aviso sobre la diabetes.
     */
    const dictado = 'Tuvo neumonía hace tres años y ahora tiene diabetes.'
    const nota = 'Diabetes mellitus tipo 2 en descontrol. Antecedente de neumonía.'
    expect(desajustesTemporales(mencionesEnPasado(dictado), nota)).toEqual([])
  })
})
