/**
 * GOLDEN — mirar todas las apariciones no bastaba: la ventana cruzaba de
 * apartado y las descartaba todas.
 *
 * ── QUÉ FALLABA ──────────────────────────────────────────────────────────────
 *
 * Con REG-192 ya puesto —el que hizo que se recorrieran TODAS las menciones de
 * la nota, no sólo la primera— este caso, que es el que lo motivó, seguía
 * devolviendo vacío:
 *
 *     dictado: «¿Usted es diabético?  No, nunca me lo han dicho.»
 *     nota:    ANTECEDENTES PERSONALES PATOLÓGICOS: niega diabetes mellitus, niega hipertensión.
 *              IMPRESIÓN DIAGNÓSTICA: 1. Diabetes mellitus tipo 2 descontrolada.
 *
 *     condicionesNegadas(...)  →  [{ condicion: 'diabetes', … }]   ✔ oyó la negación
 *     contradicciones(...)     →  []                               ✘ no dijo nada
 *
 * ── CÓMO SE DESCUBRIÓ ────────────────────────────────────────────────────────
 *
 * El 7-ago-2026, probando la rama de REG-192/193/194 con los motores reales
 * antes de dar por buena la reparación. El arreglo estaba puesto, tenía su
 * golden en verde, y el caso del titular seguía sin avisar.
 *
 * ── LA CAUSA RAÍZ ────────────────────────────────────────────────────────────
 *
 * `mencionSinDisculpa` juzgaba cada aparición con los 60 caracteres previos en
 * crudo. La segunda mención de «diabetes» —la del diagnóstico, la que hay que
 * cazar— tiene el «niega hipertensión» de la LÍNEA DE ARRIBA dentro de esos 60
 * caracteres. Se recorrían todas las apariciones y se descartaban todas.
 *
 * Es exactamente lo que el comentario de `VENTANA_ATRAS` ya temía: «una disculpa
 * ajena taparía una afirmación real». Acortar la ventana lo hacía menos
 * probable; no salirse del apartado lo hace imposible.
 *
 * ── LA REGLA QUE LO HACE SEGURO ──────────────────────────────────────────────
 *
 * El contexto previo se recorta en el último fin de apartado: punto, salto de
 * línea, punto y coma o dos puntos. La coma NO corta — «niega diabetes,
 * hipertensión y asma» es una sola enumeración negada, y cortarla resucitaría el
 * falso positivo que la ventana existía para evitar.
 *
 * Y como al recortar aparecen menciones que antes quedaban tapadas por el motivo
 * equivocado —«glucosa para descartar diabetes», que `DISCULPA_EN_LA_NOTA` no
 * reconoce porque su `descarta` no casa con «descartar»—, el recorte llega junto
 * con `NO_AFIRMA`. Sin él, esta reparación estrenaría un falso positivo de alta
 * frecuencia sobre un aviso que no se puede plegar.
 *
 * ── QUÉ NO CUBRE ─────────────────────────────────────────────────────────────
 *
 * · Una nota sin puntuación —un párrafo corrido— no tiene apartados que recortar
 *   y se comporta como antes: la disculpa de una oración puede alcanzar a la
 *   siguiente. Eso ya no lo arregla la ventana, sino la puntuación de quien
 *   escribe.
 * · `NO_AFIRMA` es vocabulario, no criterio: lo que falte se sigue contando como
 *   afirmación —se avisa de más, no de menos—.
 * · No cambia ningún vocabulario clínico, ningún umbral y ninguna política de
 *   firma. Los dos motores siguen avisando y no corrigiendo.
 */
import { describe, it, expect } from 'vitest'
import { condicionesNegadas, contradicciones } from '@/lib/expediente/negaciones'
import { mencionesEnPasado, desajustesTemporales } from '@/lib/expediente/temporalidad'
import {
  mencionSinDisculpa,
  POR_QUE_EL_CONTEXTO_NO_SALE_DEL_APARTADO,
} from '@/lib/expediente/mencion-en-la-nota'

const DICTADO_DIABETES = '¿Usted es diabético? No, nunca me lo han dicho.'

describe('EL CASO DEL TITULAR, QUE SEGUÍA SIN AVISAR', () => {
  const NOTA = [
    'ANTECEDENTES PERSONALES PATOLÓGICOS: niega diabetes mellitus, niega hipertensión.',
    'IMPRESIÓN DIAGNÓSTICA: 1. Diabetes mellitus tipo 2 descontrolada.',
    'PLAN: metformina 850 mg cada 12 horas.',
  ].join('\n')

  it('el «niega» de la línea de arriba ya no tapa el diagnóstico de abajo', () => {
    const c = contradicciones(condicionesNegadas(DICTADO_DIABETES), NOTA)
    expect(c.map(x => x.condicion)).toEqual(['diabetes'])
  })

  it('y la cita señala el diagnóstico, no el antecedente bien escrito', () => {
    const [c] = contradicciones(condicionesNegadas(DICTADO_DIABETES), NOTA)
    expect(c.enLaNota).toContain('Diabetes mellitus tipo 2 descontrolada')
    expect(c.enLaNota).not.toContain('niega diabetes mellitus')
  })

  it('lo mismo en temporalidad: el apartado de antecedentes no blinda al de abajo', () => {
    const d = desajustesTemporales(
      mencionesEnPasado('Tuvo neumonía hace tres años.'),
      'ANTECEDENTES: antecedente de neumonía en 2023, ya resuelta por completo.\nDX: neumonía adquirida en la comunidad.',
    )
    expect(d.map(x => x.condicion)).toEqual(['neumonía'])
    expect(d[0].enLaNota).toContain('adquirida en la comunidad')
  })

  it('el salto de línea corta aunque no haya punto', () => {
    expect(mencionSinDisculpa('Antecedentes: niega asma\nDiagnóstico: asma persistente', ['asma'], /\bniega\b/))
      .toContain('asma persistente')
  })

  it('y los dos puntos también: «ANTECEDENTES:» es un apartado', () => {
    expect(mencionSinDisculpa('Niega diabetes. DIAGNÓSTICO: diabetes tipo 2', ['diabetes'], /\bniega\b/))
      .toContain('diabetes tipo 2')
  })
})

describe('LO QUE EL RECORTE NO PUEDE ROMPER', () => {
  it('la coma NO corta: una enumeración negada sigue negada entera', () => {
    const negadas = condicionesNegadas('Niega diabetes, hipertensión y asma.')
    expect(negadas).toHaveLength(3)
    expect(contradicciones(negadas, 'Antecedentes: niega diabetes, hipertensión y asma.')).toEqual([])
  })

  it('una mención bien escrita en su propio apartado sigue sin avisar', () => {
    expect(contradicciones(condicionesNegadas(DICTADO_DIABETES),
      'ANTECEDENTES: niega diabetes.\nPLAN: control anual.')).toEqual([])
  })

  it('y si TODAS las apariciones traen su disculpa, tampoco', () => {
    expect(contradicciones(condicionesNegadas(DICTADO_DIABETES),
      'Antecedentes: niega diabetes.\nComentario: la paciente niega diabetes desde el inicio.')).toEqual([])
  })

  it('una nota que sólo lo afirma sigue avisando como siempre', () => {
    expect(contradicciones(condicionesNegadas(DICTADO_DIABETES),
      'Impresión: diabetes mellitus tipo 2.')).toHaveLength(1)
  })
})

describe('EL RECORTE NO PUEDE ESTRENAR FATIGA DE ALERTA', () => {
  const NEGADAS = condicionesNegadas(DICTADO_DIABETES)

  it('«para descartar diabetes» no afirma nada: no avisa', () => {
    expect(contradicciones(NEGADAS,
      'ANTECEDENTES: niega diabetes.\nPLAN: glucosa sérica para descartar diabetes.')).toEqual([])
  })

  it('ni «tamizaje de», ni «riesgo de», ni «prevención de»', () => {
    for (const plan of [
      'PLAN: tamizaje de diabetes.',
      'PLAN: orientación por riesgo de diabetes.',
      'PLAN: prevención de la diabetes.',
    ]) {
      expect(contradicciones(NEGADAS, `ANTECEDENTES: niega diabetes.\n${plan}`)).toEqual([])
    }
  })

  it('pero la marca va PEGADA: no calla al padecimiento vecino que sí se afirma', () => {
    const negadas = condicionesNegadas('¿Diabetes o presión alta? Ninguna.')
    const c = contradicciones(negadas,
      'PLAN: glucosa para descartar diabetes y control de la hipertensión arterial.')
    expect(c.map(x => x.condicion)).toEqual(['hipertensión arterial'])
  })
})

describe('LO QUE YA PROTEGÍA EL MÓDULO SIGUE PROTEGIDO', () => {
  it('«plasma» sigue sin ser «asma» después del recorte', () => {
    expect(mencionSinDisculpa('Laboratorio: glucosa en plasma venoso 96 mg/dL.', ['asma'], /\bniega\b/))
      .toBeNull()
  })

  it('y un término que la nota no nombra sigue devolviendo null', () => {
    expect(mencionSinDisculpa('Nota sin nada de eso.', ['diabetes'], /\bniega\b/)).toBeNull()
  })

  it('está escrito por qué el contexto no sale del apartado', () => {
    expect(POR_QUE_EL_CONTEXTO_NO_SALE_DEL_APARTADO).toContain('coma')
    expect(POR_QUE_EL_CONTEXTO_NO_SALE_DEL_APARTADO.length).toBeGreaterThan(120)
  })
})
