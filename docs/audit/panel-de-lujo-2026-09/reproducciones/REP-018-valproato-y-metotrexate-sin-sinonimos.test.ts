/**
 * REP-018 · MG-006 (M-ginecologa) — «Ácido valproico» y «Metotrexato» no
 * tienen `sinonimos`: «valproato de magnesio», «divalproato» y «metotrexate»
 * no casan y el teratógeno pasa sin aviso.
 *
 * ── QUÉ FALLA ────────────────────────────────────────────────────────────────
 * `src/lib/expediente/prescripcion-segura.ts:293-294` (EMBARAZO_LACTANCIA):
 * las dos entradas van sin `sinonimos`. El emparejador de copiloto.ts:478-481
 * sólo casa por sinónimo, por nombre completo o por palabra > 5 letras del
 * nombre («valproico»); «valproato de magnesio 200 mg» no contiene ninguna.
 * Igual «metotrexate» vs «metotrexato».
 *
 * ── CÓMO SE DESCUBRIÓ ────────────────────────────────────────────────────────
 * Auditor M-ginecologa, MG-006; equipo rojo confirmado P1 ejecutando `coincide`
 * literalmente con node: «valproato de magnesio 200 mg» → false; «divalproato
 * de sodio 500 mg» → false; «metotrexate 2.5 mg» → false; los nombres del
 * catálogo → true. El propio archivo (:41-49) documenta este defecto exacto
 * como el P0 de la auditoría 2026-07 corregido para IECA/estatinas/AINE.
 *
 * ── CAUSA RAÍZ ───────────────────────────────────────────────────────────────
 * Entradas cuyo `farmaco` no es el principio activo tal como se receta en
 * México, sin lista de sinónimos.
 *
 * ── REGLA ────────────────────────────────────────────────────────────────────
 * clinical-safety §5: el vocabulario es vocabulario, no criterio; el término
 * que falta es un caso que no se vigila.
 *
 * ── TIPO DE PRUEBA ───────────────────────────────────────────────────────────
 * COMPORTAMIENTO: importa `revisarFarmaco` (mismo catálogo, emparejador por
 * sinónimos) y `copiloto` (el emparejador que ve la consulta).
 *
 * ── QUÉ NO CUBRE ─────────────────────────────────────────────────────────────
 * No decide qué nombres comerciales incluir (NEEDS_CLINICAL_REVIEW). No amplía
 * la lista a fármacos ausentes (MG-007). No prueba el guardián general «toda
 * entrada cuyo farmaco no sea principio activo lleva sinonimos».
 */
import { describe, it, expect } from 'vitest'
import { revisarFarmaco } from '@/lib/expediente/prescripcion-segura'
import { copiloto } from '@/lib/expediente/copiloto'

const gestaDe = (nombre: string) => revisarFarmaco(nombre).gestacional?.farmaco
const avisoGesta = (nombre: string) =>
  copiloto({ sexo: 'Femenino', edad: 25, medicamentos: [{ nombre }] }).find(s => s.id === `gesta:${nombre}`)

describe('REP-018 · las presentaciones mexicanas de valproato y metotrexato casan con la entrada gestacional', () => {
  it.each([
    ['Valproato de magnesio 200 mg', 'Ácido valproico'],
    ['Divalproato de sodio 500 mg', 'Ácido valproico'],
    ['Metotrexate 2.5 mg', 'Metotrexato'],
  ])('revisarFarmaco(«%s») → entrada «%s»', (nombre, esperado) => {
    expect(gestaDe(nombre)).toBe(esperado)
  })

  it.each(['Valproato de magnesio 200 mg', 'Metotrexate 2.5 mg'])(
    'copiloto: mujer de 25 años con «%s» recibe el aviso crítico de contraindicación en embarazo', nombre => {
      const s = avisoGesta(nombre)
      expect(s?.nivel, `sin aviso gesta para ${nombre}`).toBe('critico')
    })

  it('control: los nombres tal como están en el catálogo sí casan', () => {
    expect(gestaDe('Ácido valproico 500 mg')).toBe('Ácido valproico')
    expect(gestaDe('Metotrexato 2.5 mg')).toBe('Metotrexato')
    expect(avisoGesta('Metotrexato 2.5 mg')?.nivel).toBe('critico')
  })
})
