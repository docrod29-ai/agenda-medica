/**
 * CORPUS ORO — ¿DE DÓNDE SALIÓ ESTO? (§B10 · SUP-001)
 *
 * La distancia más grande frente a Abridge, y el §B10 del charter propio.
 *
 * ── LO QUE MIDE ──────────────────────────────────────────────────────────────
 *
 * Que una afirmación de la nota se pueda enlazar al fragmento del dictado que la
 * sostiene — y que cuando NO haya respaldo, se diga, en vez de enlazar al
 * fragmento menos malo.
 */
import { describe, expect, it } from 'vitest'
import {
  afirmacionesSinRespaldo, rastrearNota, respaldoDe, segmentar,
} from '@/lib/expediente/trazabilidad'

const DICTADO = [
  'Buenos días doctor. Tengo dolor de cabeza desde hace tres días.',
  'No he tenido fiebre. Tomo losartán de cincuenta miligramos cada mañana.',
  'Mi mamá tuvo cáncer de mama. Me operaron de la vesícula en 2019.',
].join('\n')

describe('corpus oro · de dónde salió esto', () => {
  it('el dictado se parte en fragmentos localizables', () => {
    const segs = segmentar(DICTADO)
    expect(segs.length).toBeGreaterThan(4)
    // Sin posición no se puede resaltar, que es para lo que existe.
    for (const s of segs) expect(s.hasta).toBeGreaterThan(s.desde)
  })

  describe('lo que sí se dijo se enlaza a su fragmento', () => {
    it.each([
      ['Niega fiebre.', 'fiebre'],
      ['Colecistectomía en 2019.', 'vesícula'],
      ['Paciente con cefalea de tres días.', 'cabeza'],
    ])('«%s» apunta al fragmento que habla de «%s»', (afirmacion, pista) => {
      const r = respaldoDe(afirmacion, segmentar(DICTADO))
      expect(r.estado).not.toBe('sin_respaldo')
      expect(r.segmento?.texto.toLowerCase()).toContain(pista.toLowerCase())
    })
  })

  describe('lo que nadie dijo se declara, no se enlaza', () => {
    it.each([
      'Se documenta nefropatía diabética estadio 4.',
      'Refiere buen apego al tratamiento antihipertensivo.',
      'Se palpa adenopatía cervical derecha.',
    ])('«%s» → sin respaldo Y sin fragmento', afirmacion => {
      /**
       * Lo segundo importa tanto como lo primero: enlazar al fragmento «menos
       * malo» daría por comprobado justo lo que hay que comprobar.
       */
      const r = respaldoDe(afirmacion, segmentar(DICTADO))
      expect(r.estado).toBe('sin_respaldo')
      expect(r.segmento).toBeUndefined()
      expect(r.huerfanas.length).toBeGreaterThan(0)
    })
  })

  describe('la traducción del médico NO es una invención', () => {
    it.each([
      ['Cefalea de tres días.', 'dolor de cabeza'],
      ['Colecistectomía previa.', 'operaron de la vesícula'],
      ['Antecedente de cáncer de mama en la madre.', 'mi mamá'],
    ])('«%s» está respaldada por «%s»', afirmacion => {
      /**
       * EL FALSO POSITIVO QUE HABRÍA MATADO LA FUNCIÓN.
       *
       * Las tres son traducciones correctas que un médico hace al redactar. Un
       * aviso que las señala se aprende a cerrar en dos consultas — y entonces
       * deja de proteger de lo que sí importa, que en esta misma nota era una
       * nefropatía inventada de cero.
       */
      expect(respaldoDe(afirmacion, segmentar(DICTADO)).estado).not.toBe('sin_respaldo')
    })
  })

  describe('lo que sigue marcándose a propósito', () => {
    it('«cada 24 horas» donde se dijo «cada mañana» NO se da por respaldado', () => {
      /**
       * Es una INTERPRETACIÓN de la pauta, no un sinónimo. La tabla de sinónimos
       * es estrictamente lingüística: «dolor de cabeza» ES cefalea; «cada
       * mañana» NO es «cada 24 horas».
       */
      const r = respaldoDe('Losartán 50 mg cada 24 horas.', segmentar(DICTADO))
      expect(r.huerfanas).toContain('horas')
    })
  })

  describe('sobre una nota entera', () => {
    it('separa lo inventado de lo dicho', () => {
      const nota = [
        'Paciente con cefalea de tres días de evolución.',
        'Niega fiebre.',
        'Colecistectomía en 2019.',
        'Se documenta nefropatía diabética estadio 4.',
      ].join('\n')
      const sin = afirmacionesSinRespaldo(nota, DICTADO)
      expect(sin).toHaveLength(1)
      expect(sin[0].afirmacion).toContain('nefropatía')
    })

    it('sin dictado no inventa respaldos ni acusaciones', () => {
      // Nota sin dictado: no hay nada que rastrear. Marcarlo todo «inventado»
      // sería el falso positivo más ruidoso posible.
      expect(rastrearNota('Cualquier cosa.', '')).toEqual([])
    })
  })
})
