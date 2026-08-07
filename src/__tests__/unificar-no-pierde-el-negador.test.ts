/**
 * REG-202 — Unificar dos parsers perdió el vocabulario de negación de uno.
 *
 * ── QUÉ FALLABA ─────────────────────────────────────────────────────────────
 *
 * REG-201 trajo el punto de orden hospitalario (`hospital/cds.ts`) al parser
 * canónico de alergias, que es lo correcto. Pero ese camino no sólo tenía su
 * propio `split`: tenía **su propia lista de negadores**, y esa lista no era un
 * subconjunto de la canónica. Conocía tres formas que aquí no estaban:
 *
 *     nunca · ausente · descart (a secas, no sólo «descartada»)
 *
 * Al mudarlo, esas tres dejaron de filtrarse. Un campo que decía «nunca ha
 * tenido reacción a penicilina» pasó a valer como una alergia a penicilina y a
 * sacar una alerta **crítica** en el punto de orden — justo donde el hospital
 * llevaba meses sin sacarla, y en el CDS cuyo propósito declarado es la alta
 * especificidad.
 *
 * ── CÓMO SE DESCUBRIÓ ───────────────────────────────────────────────────────
 *
 * Auditando REG-201 antes de darlo por bueno: comparando los dos negadores
 * palabra por palabra en vez de dar por hecho que el canónico era el superior.
 * Reproducido contra `cdsMedicamento` real sobre la rama ya reparada.
 *
 * ── CAUSA RAÍZ ──────────────────────────────────────────────────────────────
 *
 * Una unificación se piensa como «el bueno absorbe al malo», y casi siempre lo
 * es — pero el que se retira puede llevar encima aprendizaje propio que nadie
 * inventarió. Aquí el que se retiraba llevaba tres años de campos escritos por
 * un médico hospitalario.
 *
 * ── LA REGLA QUE LO HACE SEGURO ─────────────────────────────────────────────
 *
 * Al fusionar dos motores que deciden lo mismo, el resultado es la **unión** de
 * lo que cada uno reconocía, no el que se quedó con el archivo. Y una palabra
 * sólo entra al negador si **no puede encabezar el nombre de un alérgeno**: ésa
 * es la condición que impide que ampliar un negador esconda una alergia real,
 * que es el error contrario y el caro.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * - No es un vocabulario completo de negación en español: es la unión de lo que
 *   los dos motores ya reconocían. Una forma de negar que no esté aquí **sigue
 *   registrándose como alergia** — se señala de más, nunca de menos.
 * - No comprueba el cruce alergia↔fármaco, que tiene sus propios casos.
 * - No cubre la negación dentro de una frase («penicilina no, sulfas sí»): el
 *   negador está anclado al principio del fragmento a propósito.
 */
import { describe, it, expect } from 'vitest'
import { esAlergiaNegada, alergenosDe } from '@/lib/seguridad/alergias'
import { cdsMedicamento } from '@/lib/hospital/cds'

describe('REG-202 — el negador canónico es la unión de los dos', () => {
  it('«nunca» sigue siendo una negación después de unificar', () => {
    expect(esAlergiaNegada('nunca ha tenido reacción a penicilina')).toBe(true)
    expect(alergenosDe({ alergias: 'nunca ha tenido reacción a penicilina' })).toEqual([])
  })

  it('«ausente» y «ausentes» también', () => {
    expect(esAlergiaNegada('ausente')).toBe(true)
    expect(esAlergiaNegada('ausentes')).toBe(true)
  })

  it('«descartada» y «descarto» — el hospitalario cortaba en `descart`', () => {
    expect(esAlergiaNegada('descartada alergia a penicilina')).toBe(true)
    expect(esAlergiaNegada('descarto alergia a penicilina')).toBe(true)
  })

  it('«no hay» — lo tenía el hospitalario y no el canónico', () => {
    expect(esAlergiaNegada('no hay alergias conocidas')).toBe(true)
  })

  it('lo que ya reconocía el canónico no se toca', () => {
    for (const negada of [
      'niega alergias',
      'niego alergia a penicilina',
      'negadas',
      'sin alergias conocidas',
      'no refiere alergias',
      'no conocidas',
      'no presenta alergias',
      'no tiene alergias',
      'ninguna',
    ]) {
      expect(esAlergiaNegada(negada), negada).toBe(true)
    }
  })

  it('una alergia AFIRMADA no se filtra por ninguna de las palabras nuevas', () => {
    /*
     * La mitad peligrosa: ampliar un negador puede esconder una alergia real.
     * Ninguna de las palabras añadidas encabeza el nombre de un fármaco.
     */
    for (const real of [
      'alérgico a penicilina',
      'penicilina',
      'sulfas',
      'Trimetoprima/sulfametoxazol (TMP/SMX)',
      'anafilaxia a penicilina',
    ]) {
      expect(esAlergiaNegada(real), real).toBe(false)
    }
  })

  it('el punto de orden ya no saca una crítica sobre una negación con «nunca»', () => {
    // Éste es el caso que la unificación de REG-201 había roto.
    const alertas = cdsMedicamento({
      nombre: 'Penicilina G',
      alergias: 'nunca ha tenido reacción a penicilina',
    })
    expect(alertas.some(a => a.nivel === 'critica')).toBe(false)
  })

  it('y sigue sacándola cuando la alergia es real', () => {
    // El guardián al revés: suprimir de más sería peor que el defecto.
    const alertas = cdsMedicamento({ nombre: 'Penicilina G', alergias: 'alérgico a penicilina' })
    expect(alertas.some(a => a.nivel === 'critica')).toBe(true)
  })
})
