/**
 * CORPUS ORO — ¿DE QUIÉN ES LA ENFERMEDAD? (§B8 del charter)
 *
 * El eje que faltaba. Ya estaban medidos el «¿sí o no?» (negación, REG-192) y
 * el «¿cuándo?» (temporalidad, REG-200). Éste es el «¿a quién?».
 *
 * ── EL DAÑO QUE EVITA ────────────────────────────────────────────────────────
 *
 * «Mi mamá tuvo cáncer de mama» convertido en antecedente PERSONAL deja una
 * historia clínica impecablemente redactada diciendo que el paciente tuvo un
 * cáncer que nunca tuvo — firmada con cédula. No se ve raro, que es lo que lo
 * hace peligroso.
 *
 * Y el error hacia el otro lado cuesta igual: mandar al apartado familiar un
 * síntoma que el paciente sí tiene («mi esposa dice que ronco») **borra un dato
 * real**.
 */
import { describe, expect, it } from 'vitest'
import { deQuienEs, esAntecedenteFamiliar, frasesDeFamiliar } from '@/lib/expediente/experienciador'

describe('corpus oro · de quién es la enfermedad', () => {
  describe('del familiar — no van a antecedentes personales', () => {
    it.each([
      ['mi mamá tuvo cáncer de mama a los cuarenta', 'mamá'],
      ['mi papá murió de un infarto', 'papá'],
      ['mi abuela era hipertensa', 'abuela'],
      ['mi hermano es alérgico a la penicilina', 'hermano'],
      ['mi tía tiene lupus', 'tía'],
      ['mi abuelo murió de cáncer de próstata', 'abuelo'],
      ['mi jefa es diabética', 'jefa'],
      ['la mamá del paciente tuvo lupus', 'mamá'],
      ['su papá falleció de EPOC', 'papá'],
    ])('«%s» → familiar (%s)', (frase, parentesco) => {
      const r = deQuienEs(frase)
      expect(r.quien).toBe('familiar')
      expect(r.parentesco).toBe(parentesco)
      expect(esAntecedenteFamiliar(frase)).toBe(true)
    })

    it.each([
      'en mi familia todos son diabéticos',
      'antecedentes heredo-familiares de cáncer de colon',
      'por parte de mi madre hay tiroides',
      'eso le viene de familia',
    ])('«%s» → familiar por el marco de la frase', frase => {
      expect(deQuienEs(frase).quien).toBe('familiar')
    })
  })

  describe('del paciente — aunque la frase nombre a un familiar', () => {
    it.each([
      'mi mamá me dijo que yo tuve convulsiones de niño',
      'mi esposa dice que ronco mucho',
      'mi mamá cuenta que me desmayé en la escuela',
    ])('«%s» → paciente: el familiar sólo lo reporta', frase => {
      /**
       * Equivocarse aquí no inventa un dato: BORRA uno real del paciente. El
       * ronquido es suyo; la esposa sólo es quien lo notó.
       */
      expect(deQuienEs(frase).quien).toBe('paciente')
      expect(esAntecedenteFamiliar(frase)).toBe(false)
    })

    it.each([
      'tengo diabetes desde hace diez años',
      'a mí me detectaron hipertensión el año pasado',
      'me operaron de la vesícula',
      'padezco migraña',
    ])('«%s» → paciente por primera persona', frase => {
      expect(deQuienEs(frase).quien).toBe('paciente')
    })
  })

  describe('cuando no se sabe, se dice que no se sabe', () => {
    it.each([
      'dolor abdominal de tres días',
      'refiere fiebre y tos',
      '',
    ])('«%s» → indeterminado', frase => {
      /**
       * No es un fallo: es la respuesta correcta. Un motor que elige dueño sin
       * señal inventa exactamente lo que este módulo existe para impedir.
       */
      expect(deQuienEs(frase).quien).toBe('indeterminado')
      expect(esAntecedenteFamiliar(frase)).toBe(false)
    })
  })

  describe('sobre un dictado entero', () => {
    it('separa las frases del familiar sin tocar las del paciente', () => {
      const dictado = [
        'Paciente de 45 años. Tengo diabetes desde hace diez años.',
        'Mi mamá tuvo cáncer de mama a los cuarenta.',
        'Me operaron de la vesícula en 2019.',
        'Mi papá murió de un infarto.',
      ].join(' ')
      const familiares = frasesDeFamiliar(dictado)
      expect(familiares).toHaveLength(2)
      expect(familiares.map(f => f.parentesco)).toEqual(['mamá', 'papá'])
    })
  })

  describe('una frase con dos dueños', () => {
    it('«yo no tengo diabetes pero mi mamá sí» separa al paciente del familiar', () => {
      /**
       * Analizada entera, esta frase se atribuía al familiar y se perdía lo que
       * de verdad dice: que **el paciente la niega** y que **la mamá sí la
       * tiene**. Dos datos distintos, de dos personas distintas, en catorce
       * palabras.
       *
       * Cada motor por su lado acertaba; juntos mentían. Lo encontró medir la
       * composición, que es lo que nadie prueba.
       */
      const r = frasesDeFamiliar('yo no tengo diabetes pero mi mamá sí')
      expect(r).toHaveLength(1)
      expect(r[0].frase).toBe('mi mamá sí')
      expect(r[0].parentesco).toBe('mamá')
    })

    it('sin conector no parte de más', () => {
      const r = frasesDeFamiliar('mi mamá tuvo cáncer de mama')
      expect(r).toHaveLength(1)
      expect(r[0].frase).toBe('mi mamá tuvo cáncer de mama')
    })
  })

  describe('la trampa que ya costó una vez', () => {
    it('«mamá» y «papá» se reconocen pese al acento', () => {
      /**
       * En JavaScript `\w` es ASCII: `\b` detrás de «mamá» no encuentra límite
       * de palabra y el patrón no dispara. Escrito con `\b`, este motor
       * reconocía «mi abuela» y NO «mi mamá» — media función muerta, que es lo
       * peor para darse cuenta.
       *
       * Es el mismo fallo que tuvo el motor de negación con «no sé».
       */
      for (const f of ['mi mamá es diabética', 'mi papá es hipertenso', 'mi tía tiene asma']) {
        expect(deQuienEs(f).quien, f).toBe('familiar')
      }
    })
  })
})
