/**
 * CORPUS ORO — NÚMEROS Y UNIDADES CRÍTICAS (§B5 del charter).
 *
 * El charter enumera los pares donde confundirse **cambia la dosis o el
 * significado**: mg/mcg, mL/min vs mL/h, 0.03/0.3/3, positivo/negativo,
 * RASS −4/+4, PEEP/PIP, pre/post, izquierda/derecha. Y lista el «benchmark
 * numérico y de unidades» como uno de los activos propietarios del §9.
 *
 * La política existía (`politica-critica.ts`: los pares que jamás se
 * autocorrigen). **La medición no.** Esto es la medición.
 *
 * ── LO QUE ENCONTRÓ AL ENCENDERSE (6-ago-2026, REG-209) ──────────────────────
 *
 * De 20 formas reales de dictar una cifra en un consultorio mexicano, el
 * pipeline resolvía 14. Fallaba en **cinco maneras de decir una fracción** — y
 * dos de ellas no perdían el dato: lo **reducían a un valor plausible**, que es
 * el modo de fallo que nadie nota.
 *
 *     «dos coma cinco miligramos»  →  «2 coma 5 mg»    el motor lee 2 mg
 *     «un gramo y medio»           →  «1 g y medio»    el motor lee 1 g
 *
 * En México la **coma es el separador decimal** al dictar. Y «y medio» es la
 * forma normal de decir una dosis y media. Ninguna de las dos estaba cubierta.
 *
 * ── POR QUÉ ES ESTE TIPO DE FALLO Y NO OTRO ──────────────────────────────────
 *
 * Una cifra que DESAPARECE se nota: el campo queda vacío y hay guardianes que lo
 * vigilan. Una cifra que se convierte en otra cifra creíble no la ve nadie —
 * ni el médico al releer, ni el motor de dosis, ni el sello de integridad.
 *
 * Es exactamente el mismo modo de fallo que el pH «7.30 y 5» y que la
 * metformina «852 veces al día»: **el error se lee bien**.
 */
import { describe, expect, it } from 'vitest'
import { normalizar } from '@/lib/asr/normalizacion'

const n = (t: string) => normalizar(t).texto

describe('corpus oro · números y unidades críticas', () => {
  describe('los pares que el charter llama críticos', () => {
    it.each([
      ['dos microgramos por kilo por minuto', '2 mcg/kg/min'],
      ['dos miligramos por kilo por hora', '2 mg/kg/h'],
      ['sesenta mililitros por minuto', '60 mL/min'],
      ['cien mililitros por hora', '100 mL/h'],
    ])('%s → %s', (dictado, esperado) => {
      expect(n(dictado)).toBe(esperado)
    })

    it.each([
      ['cero punto cero tres miligramos', '0.03 mg'],
      ['cero punto tres miligramos', '0.3 mg'],
      ['tres miligramos', '3 mg'],
    ])('el corrimiento del decimal: %s → %s', (dictado, esperado) => {
      expect(n(dictado)).toBe(esperado)
    })
  })

  describe('la coma es el separador decimal mexicano', () => {
    it.each([
      ['dos coma cinco miligramos', '2.5 mg'],
      ['cero coma treinta y cinco microgramos por kilo por minuto', '0.35 mcg/kg/min'],
      ['ph siete coma treinta y cinco', 'ph 7.35'],
    ])('%s → %s', (dictado, esperado) => {
      expect(n(dictado)).toBe(esperado)
    })

    it('«en coma» sigue siendo el estado del paciente, no un decimal', () => {
      // La guarda que lo permite: «coma» sólo separa decimales cuando hay un
      // número delante Y otro detrás. Sin eso, esta frase se rompería.
      expect(n('el paciente esta en coma')).toBe('el paciente esta en coma')
      expect(n('lleva dos dias en coma')).toBe('lleva 2 dias en coma')
    })
  })

  describe('las mitades habladas', () => {
    it.each([
      ['medio gramo', '0.5 g'],
      ['un gramo y medio', '1.5 g'],
      ['dos gramos y medio', '2.5 g'],
      ['un litro y medio', '1.5 L'],
      ['medio comprimido', '0.5 comprimido'],
    ])('%s → %s', (dictado, esperado) => {
      expect(n(dictado)).toBe(esperado)
    })

    it.each([
      'media hora',
      'a medio camino',
      'la media de la serie',
      'dos veces y media',
    ])('«%s» NO se convierte en una dosis', frase => {
      /**
       * «medio» y «media» significan otras cosas. La conversión sólo ocurre
       * cuando detrás viene una unidad de fármaco, donde no puede significar
       * otra cosa.
       *
       * Sin estos cuatro casos, la prueba de arriba pasaría igual con una regla
       * demasiado ávida — y el daño de una regla ávida no se ve hasta que
       * ensucia una nota real.
       */
      expect(n(frase)).not.toMatch(/0\.5|\.5\s/)
    })
  })

  describe('lo que SIGUE sin resolverse, medido y declarado', () => {
    /**
     * No se arregló, y se escribe en vez de callarse.
     *
     * `punto cinco miligramos` (sin el «cero» delante) es ambiguo con «el punto
     * tres del plan»: convertirlo exigiría mirar si detrás hay una unidad, y esa
     * regla toca el lector de números entero. Es un cambio que se decide, no que
     * se cuela.
     *
     * `cinco décimas de miligramo` es poco frecuente y su conversión no es
     * gramatical sino aritmética.
     */
    it('«punto cinco miligramos» todavía no se convierte', () => {
      expect(n('punto cinco miligramos')).toBe('punto 5 mg')
    })

    it('«cinco décimas de miligramo» todavía no se convierte', () => {
      expect(n('cinco décimas de miligramo')).toContain('décimas')
    })
  })
})
