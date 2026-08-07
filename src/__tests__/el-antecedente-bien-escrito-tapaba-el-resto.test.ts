/**
 * GOLDEN — cuanto MEJOR estructurada estaba la nota, menos vigilada quedaba.
 *
 * ── QUÉ FALLABA ─────────────────────────────────────────────────────────────
 *
 * `desajustesTemporales` buscaba cada padecimiento en la nota con un `indexOf`
 * suelto: **una sola vez**. La nota le llega como un texto plano —`resumen`, los
 * diagnósticos y todas las secciones pegados con saltos de línea—, así que la
 * PRIMERA mención decidía por el documento entero. Si esa primera venía bien
 * escrita («Antecedente de neumonía en 2019»), la comprobación se daba por
 * satisfecha y no volvía a mirar.
 *
 * Y ése es exactamente el orden de una historia clínica de NOM-004:
 * «Antecedentes personales patológicos» va antes que «Plan de tratamiento»
 * (`SECCIONES_POR_TIPO.historia_clinica`). El médico que archiva bien el
 * antecedente apagaba la defensa; el que no lo archivaba la conservaba.
 *
 * ── CÓMO SE DESCUBRIÓ ───────────────────────────────────────────────────────
 *
 * Midiendo, no leyendo: EVAL-002 pedía el corpus oro que este motor nunca tuvo
 * —se construyó en v1027-v1030 y sus únicos casos eran los que escribió quien lo
 * escribió—. Al pasar el corpus por el motor real apareció el caso de abajo, y
 * se confirmó de la única forma que no admite discusión: **la misma nota, con
 * dos líneas intercambiadas, avisaba en un orden y callaba en el otro**. Callaba
 * en el orden real.
 *
 * ── POR QUÉ IMPORTA PARA UN PACIENTE ────────────────────────────────────────
 *
 * El dictado dice «tuvo neumonía hace tres años, ya resuelta». La nota la
 * archiva bien en antecedentes Y ADEMÁS receta levofloxacino hoy por esa misma
 * neumonía. El motor existe para enseñar esas dos frases juntas antes de firmar,
 * y con el defecto no enseñaba ninguna: el antibiótico salía impreso, con cédula
 * profesional, contra un diagnóstico que el médico había situado en 2019.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · No mide si el motor OYE bien: entra texto, no audio.
 * · El corpus es **sintético** (regla de datos: cero pacientes reales). Mide
 *   gramática de consulta mexicana, no la distribución real del Dr.
 * · `FUERA_DE_COBERTURA` deja escrito, medido, lo que el motor NO vigila hoy.
 *   Ese número es un trinquete: sólo puede bajar. No se repara aquí porque cada
 *   forma nueva del verbo es un riesgo de aviso de más, y eso se mide aparte.
 * · Sigue sin cubrirse la frase compuesta («tuvo neumonía hace tres años y sigue
 *   con diabetes»): un `PRESENTE` en cualquier parte veta la oración entera.
 *   Anotado en el backlog como TEMP-001, no se toca aquí.
 */
import { describe, it, expect } from 'vitest'
import { SECCIONES_POR_TIPO } from '@/lib/expediente/templates'
import {
  esFrasePasada, mencionesEnPasado, desajustesTemporales, padecimientosEn,
} from '@/lib/expediente/temporalidad'

/**
 * La nota tal y como se la arma `textoDeLaNota` en la pantalla de consulta:
 * `resumen`, luego los diagnósticos, luego las secciones, unidos por `\n`.
 *
 * Se escribe con las líneas separadas para poder intercambiarlas en la prueba —
 * que es la comprobación que descubrió el defecto.
 */
const LINEAS_DE_LA_NOTA = [
  'M 58a, DM2, tos y fiebre de cuatro días.',
  'Bronquitis aguda J20.9',
  'Tos y fiebre.',
  'Cuadro de cuatro días de tos productiva y fiebre.',
  'Madre con diabetes.',
  'No fuma. Vive en zona urbana.',
  'Diabetes mellitus 2. Antecedente de neumonía en 2019, resuelta.',
  'Estertores en base derecha.',
  'Se inicia levofloxacino 750 mg cada 24 horas por neumonía adquirida en la comunidad.',
]
const ANTECEDENTES = 6
const PLAN = 8

const DICTADO = 'Tuvo neumonía hace tres años, ya resuelta. Hoy viene por tos y fiebre de cuatro días.'

describe('EL CASO QUE LO MOTIVA — el antecedente bien escrito tapaba el plan', () => {
  it('la nota archiva bien el antecedente Y receta hoy por lo mismo → avisa', () => {
    const d = desajustesTemporales(mencionesEnPasado(DICTADO), LINEAS_DE_LA_NOTA.join('\n'))
    expect(d).toHaveLength(1)
    expect(d[0].condicion).toBe('neumonía')
    /** Lo que se le enseña al médico tiene que ser el plan, no el antecedente. */
    expect(d[0].enLaNota).toContain('levofloxacino')
  })

  it('el orden de las líneas NO cambia el resultado — ésta es la prueba del defecto', () => {
    const invertida = [...LINEAS_DE_LA_NOTA]
    ;[invertida[ANTECEDENTES], invertida[PLAN]] = [invertida[PLAN], invertida[ANTECEDENTES]]
    const enOrden = desajustesTemporales(mencionesEnPasado(DICTADO), LINEAS_DE_LA_NOTA.join('\n'))
    const alReves = desajustesTemporales(mencionesEnPasado(DICTADO), invertida.join('\n'))
    expect(enOrden).toHaveLength(alReves.length)
    expect(alReves).toHaveLength(1)
  })

  it('el orden real de NOM-004 pone los antecedentes ANTES del plan — por eso callaba', () => {
    const claves = SECCIONES_POR_TIPO.historia_clinica.map(s => s.key)
    expect(claves.indexOf('antecedentesPat')).toBeLessThan(claves.indexOf('planTratamiento'))
  })

  it('si la nota SÓLO lo escribe como antecedente, no avisa', () => {
    const soloAntecedente = LINEAS_DE_LA_NOTA.filter((_, i) => i !== PLAN).join('\n')
    expect(desajustesTemporales(mencionesEnPasado(DICTADO), soloAntecedente)).toEqual([])
  })

  it('una segunda mención bien escrita tampoco avisa', () => {
    const nota = 'Antecedente de neumonía en 2019. La neumonía previa se trató con levofloxacino.'
    expect(desajustesTemporales(mencionesEnPasado(DICTADO), nota)).toEqual([])
  })

  it('un aviso por padecimiento, aunque la nota lo afirme tres veces', () => {
    const nota = 'Neumonía adquirida en la comunidad.\nSe trata la neumonía con levofloxacino.\nControl de la neumonía en una semana.'
    expect(desajustesTemporales(mencionesEnPasado(DICTADO), nota)).toHaveLength(1)
  })
})

/**
 * CORPUS ORO — EVAL-002.
 *
 * Frases de consulta mexicana, sintéticas. `true` = el dictado encuadra lo dicho
 * en el pasado. La mitad del valor está en los `false`: marcar «desde hace tres
 * años tiene diabetes» sería peor que no mirar nada.
 */
const CORPUS: readonly [string, boolean][] = [
  ['Tuvo neumonía hace tres años.', true],
  ['Le operaron de la vesícula en 2019.', true],
  ['Presentó pancreatitis en 2021.', true],
  ['En 2019 tuvo un evento vascular cerebral.', true],
  ['Padeció hepatitis de niño.', true],
  ['Anteriormente tuvo trombosis venosa profunda.', true],
  ['Le resecaron un pólipo durante una cirugía en 2018.', true],
  ['Tenía infección urinaria de repetición.', true],
  ['Sufrió una fractura de cadera hace dos años.', true],
  ['Ya se le quitó el dengue.', true],
  ['Desde hace tres años tiene diabetes.', false],
  ['Sigue con diabetes descontrolada.', false],
  ['Actualmente tiene neumonía.', false],
  ['Tiene diabetes en tratamiento con metformina.', false],
  ['Hace tres años le diagnosticaron diabetes y sigue en control.', false],
  ['Todavía presenta dolor en la cadera operada.', false],
  ['Desde 2019 padece hipertensión.', false],
  ['Persiste la infección urinaria pese al tratamiento.', false],
  ['Aún tiene tos.', false],
  ['Hipertensión en control con losartán.', false],
]

describe('CORPUS ORO — el motor sobre frases de consulta', () => {
  it('cada frase se clasifica como el corpus dice', () => {
    const fallos = CORPUS.filter(([f, esperado]) => esFrasePasada(f) !== esperado).map(([f]) => f)
    expect(fallos).toEqual([])
  })

  it('el corpus tiene frases de las dos clases — si no, no probaría nada', () => {
    expect(CORPUS.filter(([, p]) => p).length).toBeGreaterThan(5)
    expect(CORPUS.filter(([, p]) => !p).length).toBeGreaterThan(5)
  })

  it('toda frase pasada del corpus nombra algún padecimiento del vocabulario', () => {
    /**
     * Una frase en pasado que el vocabulario no reconoce es una frase que el
     * motor lee y suelta. Aquí se separa a propósito de la clasificación
     * temporal: son los dos huecos por los que se pierde un aviso, y se cuentan
     * por separado para saber cuál falló.
     */
    const mudas = CORPUS
      .filter(([f, pasado]) => pasado && padecimientosEn(f).length === 0)
      .map(([f]) => f)
    expect(mudas).toEqual([])
  })
})

/**
 * LO QUE HOY NO SE VIGILA — trinquete, medido el 7-ago-2026.
 *
 * Formas verbales del español de consulta que sí encuadran en pasado y que
 * `PASADO` no reconoce. **Están aquí declaradas, no reparadas**: cada forma
 * nueva ensancha también el riesgo de avisar de más, y ese cambio se mide antes
 * de hacerse — no se cuela dentro de otra reparación.
 *
 * `SIN_COBERTURA` sólo puede BAJAR. Si alguien añade la forma y este número no
 * se actualiza, la prueba se pone roja y obliga a mirar lo que se ganó.
 */
const FUERA_DE_COBERTURA: readonly string[] = [
  'Se recuperó de la neumonía.',
  'Cursó con dengue el año pasado.',
  'Fue operado de apendicectomía a los quince años.',
  'Hospitalizada por neumonía el año pasado.',
  'Ya no tiene la infección urinaria.',
  'Refiere haber tenido pancreatitis.',
]
const SIN_COBERTURA = 6

describe('LO QUE NO SE VIGILA, DECLARADO', () => {
  it('el número de frases sin cobertura no sube', () => {
    const sin = FUERA_DE_COBERTURA.filter(f => !esFrasePasada(f))
    expect(sin.length).toBeLessThanOrEqual(SIN_COBERTURA)
  })

  it('ninguna de ellas avisa de más: no se clasifican como presente afirmado', () => {
    /**
     * Que no se vigilen es señalar de menos, que es la política del módulo. Lo
     * que NO puede pasar es que además arrastren un aviso equivocado: se
     * comprueba que sobre una nota vacía no sale nada.
     */
    for (const f of FUERA_DE_COBERTURA) {
      expect(desajustesTemporales(mencionesEnPasado(f), '')).toEqual([])
    }
  })
})
