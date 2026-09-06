/**
 * GOLDEN — EL AVISO DE ALERGIAS OFRECÍA AÑADIR «NEGADAS» A LA LISTA, Y CADA
 * PULSACIÓN LA AÑADÍA OTRA VEZ.
 *
 * ── QUÉ FALLABA ─────────────────────────────────────────────────────────────
 *
 * En la consulta, sobre un paciente real, el aviso rojo de alergias decía:
 *
 *     «El expediente registra alergia a Negadas — hoy el campo la NIEGA, y la
 *      lista de hoy no la tiene. La alerta al prescribir NO la está mirando.»
 *     Negadas · moderada · nota firmada del 2026-05-27 · [Añadir a la lista]
 *
 * Al pulsar el botón, el campo de alergias del paciente pasó a decir
 * `Negadas, Negadas, Negadas, Nega…`. El botón volvía a ofrecerse después de
 * cada pulsación, así que el bucle no tenía fondo.
 *
 * ── CÓMO SE DESCUBRIÓ ───────────────────────────────────────────────────────
 *
 * El dueño, usando el producto (captura del 30-ago-2026). Ninguna prueba lo
 * cazaba: la proyección se probó con alérgenos de verdad («Penicilina»), que es
 * lo que uno escribe cuando escribe el caso feliz.
 *
 * ── LA CAUSA RAÍZ, QUE SON DOS ──────────────────────────────────────────────
 *
 * 1. `estadoDeAlergias` leía `nota.alergias` **crudo**. El sello de hoy lo
 *    escribe `alergiasDe(patient)`, que sí filtra negaciones — pero el sello es
 *    histórico e **inmutable**, y las notas firmadas anteriores a las
 *    correcciones de negación llevan dentro `{ alergeno: 'Negadas' }`. Arreglar
 *    la escritura no arregla lo ya escrito.
 *
 * 2. El botón concatenaba (`${antes}, ${alergeno}`) mientras quien decidía si
 *    volver a ofrecerlo era `alergiasDe`, que lee el mismo campo con OTRO
 *    criterio. Dos criterios sobre el mismo campo, y entre ellos el bucle: la
 *    lista de hoy nunca «contenía» Negadas, así que el aviso nunca se apagaba.
 *
 * ── LA REGLA QUE LO HACE SEGURO ─────────────────────────────────────────────
 *
 * Lo que se filtra al ESCRIBIR se filtra también al LEER, con la misma
 * definición (`esAlergiaNegada`, la única que hay). Y el campo del paciente no
 * puede acabar con el mismo término dos veces, venga de donde venga.
 *
 * Descartar un fragmento negado NO toca la asimetría de la proyección —afirmar
 * suma, el silencio no resta, la negación de hoy pone en conflicto—: una
 * negación nunca fue una alergia afirmada.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · NO limpia las notas ya firmadas. Son inmutables y deben serlo; lo que
 *   cambia es cómo se leen.
 * · NO limpia el campo de un paciente que ya quedó con «Negadas, Negadas»
 *   escrito. Eso es un dato del expediente y lo edita el médico; el producto no
 *   reescribe el campo de alergias por su cuenta.
 * · NO amplía el vocabulario de negaciones. Se reutiliza `esAlergiaNegada` tal
 *   cual: un término negado que ella no conozca sigue sin conocerse aquí.
 * · NO toca la compuerta que bloquea Firmar, que sigue leyendo `patient`.
 */
import { describe, it, expect } from 'vitest'
import {
  estadoDeAlergias,
  avisoDeAlergiasQueNoSeVen,
  listaConAlergeno,
  type NotaConAlergias,
} from '@/lib/expediente/alergias-longitudinales'

const ASOF = '2026-08-30T12:00:00.000Z'

/** Una nota vieja que selló la negación COMO SI fuera un alérgeno. */
const notaConNegacionSellada: NotaConAlergias = {
  fecha: '2026-05-27T10:00:00.000Z',
  estado: 'firmada',
  alergias: [{ alergeno: 'Negadas', severidad: 'moderada' }],
}

describe('una negación sellada en una nota firmada no es un alérgeno', () => {
  it('no la cuenta como alergia del expediente', () => {
    const estado = estadoDeAlergias([notaConNegacionSellada], { alergias: 'Negadas' }, ASOF)
    expect(estado.alergias).toHaveLength(0)
    expect(estado.enConflicto).toHaveLength(0)
    expect(estado.ausentesDeLaListaDeHoy).toHaveLength(0)
  })

  it('no pinta el aviso rojo — el caso exacto de la captura', () => {
    const estado = estadoDeAlergias([notaConNegacionSellada], { alergias: 'Negadas' }, ASOF)
    expect(avisoDeAlergiasQueNoSeVen(estado)).toBe('')
  })

  it.each([
    'Negadas', 'negadas', 'Negados', 'NKDA', 'nka', 'Ninguna', 'Niega',
    'Interrogadas y negadas', 'No conocidas', 'Alergias negadas', 'Sin alergias',
  ])('tampoco con «%s» sellado como alérgeno', frag => {
    const estado = estadoDeAlergias(
      [{ fecha: '2026-05-27T10:00:00.000Z', estado: 'firmada', alergias: [{ alergeno: frag }] }],
      { alergias: '' }, ASOF,
    )
    expect(estado.alergias).toHaveLength(0)
  })

  /* AL REVÉS: el guardián no puede tragarse la alergia de verdad. Sin esto,
     `return []` pasaría las tres pruebas de arriba. */
  it('una alergia REAL sellada sigue saliendo, y el aviso sigue gritando', () => {
    const estado = estadoDeAlergias(
      [{
        fecha: '2026-05-27T10:00:00.000Z',
        estado: 'firmada',
        alergias: [{ alergeno: 'Negadas' }, { alergeno: 'Penicilina', severidad: 'anafilaxia' }],
      }],
      { alergias: '' }, ASOF,
    )
    expect(estado.alergias.map(a => a.alergeno)).toEqual(['Penicilina'])
    expect(estado.ausentesDeLaListaDeHoy).toHaveLength(1)
    expect(avisoDeAlergiasQueNoSeVen(estado)).toMatch(/Penicilina/)
    expect(avisoDeAlergiasQueNoSeVen(estado)).not.toMatch(/Negadas/)
  })

  /* Y el conflicto de verdad —el que la proyección existe para enseñar— sigue
     entero: alergia sellada + el campo de hoy que la niega por su nombre. */
  it('«niega penicilina» de hoy sigue poniendo la penicilina sellada en conflicto', () => {
    const estado = estadoDeAlergias(
      [{
        fecha: '2026-05-27T10:00:00.000Z',
        estado: 'firmada',
        alergias: [{ alergeno: 'Penicilina', severidad: 'anafilaxia' }],
      }],
      { alergias: 'Niega penicilina' }, ASOF,
    )
    expect(estado.enConflicto.map(a => a.alergeno)).toEqual(['Penicilina'])
    expect(avisoDeAlergiasQueNoSeVen(estado)).toMatch(/hoy el campo la NIEGA/)
  })
})

describe('añadir a la lista no repite un término', () => {
  it('no vuelve a escribir lo que ya está — el bucle de la captura', () => {
    let campo = 'Negadas'
    for (let i = 0; i < 5; i++) campo = listaConAlergeno(campo, 'Negadas')
    expect(campo).toBe('Negadas')
  })

  it('ignora mayúsculas, acentos y espacios sobrantes', () => {
    expect(listaConAlergeno('Penicilina, sulfas', '  PENICILINA ')).toBe('Penicilina, sulfas')
    expect(listaConAlergeno('Ácido acetilsalicílico', 'acido acetilsalicilico'))
      .toBe('Ácido acetilsalicílico')
  })

  /* AL REVÉS: un dedup por subcadena daría por añadida una alergia que no está. */
  it('añade de verdad lo que falta, y no confunde un nombre con otro que lo contiene', () => {
    expect(listaConAlergeno('Penicilina', 'Sulfas')).toBe('Penicilina, Sulfas')
    expect(listaConAlergeno('', 'Penicilina')).toBe('Penicilina')
    expect(listaConAlergeno('Sulfasalazina', 'Sulfas')).toBe('Sulfasalazina, Sulfas')
  })
})
