/**
 * CORPUS ORO — ¿CON CUÁNTA SEGURIDAD LO DIJO? (§B6 del charter)
 *
 * El cuarto eje. Ya estaban el «¿sí o no?» (REG-192), el «¿cuándo?» (REG-200) y
 * el «¿a quién?» (REG-210). Éste es el «¿qué tan seguro?».
 *
 * ── EL DAÑO QUE EVITA ────────────────────────────────────────────────────────
 *
 * «Creo que me dijeron que tenía anemia» aplanado a «Anemia» convierte una duda
 * del paciente en un diagnóstico del expediente. A partir de la segunda consulta
 * ya nadie sabe que era una duda: se lee igual que un dato confirmado y se
 * arrastra a todas las notas siguientes.
 */
import { describe, expect, it } from 'vitest'
import { esIncierto, frasesInciertas, queTanSeguro } from '@/lib/expediente/certeza'

describe('corpus oro · con cuánta seguridad lo dijo', () => {
  describe('el paciente duda', () => {
    it.each([
      ['creo que me dijeron que tenía anemia', 'duda'],
      ['no estoy segura si era penicilina', 'duda'],
      ['no sé si me pusieron la vacuna', 'duda'],
      ['se me hace que es del estómago', 'duda'],
      ['no me acuerdo bien de la dosis', 'duda'],
    ])('«%s» → incierto (%s)', (frase, matiz) => {
      const r = queTanSeguro(frase)
      expect(r.certeza).toBe('incierto')
      expect(r.matiz).toBe(matiz)
      expect(r.marca, 'debe decir QUÉ palabra lo delató').toBeTruthy()
    })
  })

  describe('lo plantea como posible', () => {
    it.each([
      'a lo mejor fue hepatitis',
      'tal vez sea gastritis',
      'probablemente sea alergia',
      'puede ser que sea la presión',
      'quizá fue algo que comí',
    ])('«%s» → posibilidad', frase => {
      expect(queTanSeguro(frase).matiz).toBe('posibilidad')
    })
  })

  describe('se lo dijo otro', () => {
    it.each([
      'me dijeron que estaba prediabético',
      'me comentaron que tenía el hígado graso',
      'en el otro hospital le dijeron que era anemia',
    ])('«%s» → referido', frase => {
      expect(queTanSeguro(frase).matiz).toBe('referido')
    })
  })

  describe('la cifra o la fecha son aproximadas', () => {
    it.each([
      'como cinco años con la presión alta',
      'como unos tres meses',
      'como 2 semanas',
      'más o menos hace dos meses',
    ])('«%s» → aproximado', frase => {
      expect(queTanSeguro(frase).matiz).toBe('aproximado')
    })
  })

  describe('lo afirmado se queda afirmado', () => {
    it.each([
      'tengo diabetes desde hace diez años',
      'me operaron de la vesícula en 2019',
      'dolor abdominal de tres días',
    ])('«%s» → afirmado', frase => {
      expect(esIncierto(frase)).toBe(false)
    })

    it.each([
      'trabaja como enfermero',
      'me siento como mareado',
      'como el año pasado empeoró',
    ])('«%s»: «como» sin número NO es una aproximación', frase => {
      /**
       * «Como» solo es demasiado común. Marcar estas tres llenaría la nota de
       * dudas inventadas — y un aviso que salta de más se aprende a cerrar, que
       * es la forma más rápida de inutilizar una protección.
       */
      expect(esIncierto(frase), frase).toBe(false)
    })
  })

  describe('la constancia cancela la duda', () => {
    it('«me dijeron que tenía anemia, aquí traigo la biometría» → afirmado', () => {
      // Sin esta salvedad, saltaría el aviso teniendo el papel en la mano.
      expect(esIncierto('me dijeron que tenía anemia, aquí traigo la biometría')).toBe(false)
    })

    it('«fue confirmado con biopsia» → afirmado', () => {
      expect(esIncierto('fue confirmado con biopsia')).toBe(false)
    })
  })

  describe('sobre un dictado entero', () => {
    it('separa lo dudoso sin tocar lo afirmado', () => {
      const dictado = [
        'Tengo diabetes desde hace diez años.',
        'Creo que me dijeron que tenía anemia.',
        'Me operaron de la vesícula en 2019.',
        'A lo mejor fue hepatitis.',
      ].join(' ')
      const inciertas = frasesInciertas(dictado)
      expect(inciertas).toHaveLength(2)
      expect(inciertas.map(f => f.matiz)).toEqual(['duda', 'posibilidad'])
    })
  })
})
