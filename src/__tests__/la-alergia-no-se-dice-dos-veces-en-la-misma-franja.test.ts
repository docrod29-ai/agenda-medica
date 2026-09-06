/**
 * ── QUÉ FALLABA ─────────────────────────────────────────────────────────────
 *
 * En el primer pliegue de `/consulta`, la franja de alergias decía lo mismo
 * DOS VECES, en rojo, a 700 px de distancia:
 *
 *     Alergias: Penicilina (anafilaxia), sulfas, AINEs   se lee: Penicilina (anafilaxia) · sulfas · AINEs
 *
 * ── CÓMO SE DESCUBRIÓ ───────────────────────────────────────────────────────
 *
 * Mirando la pantalla en el navegador, con un paciente que tiene alergias de
 * verdad. No lo cazó ninguna prueba porque no hay nada roto que probar: los dos
 * textos son correctos por separado.
 *
 * ── CAUSA RAÍZ ──────────────────────────────────────────────────────────────
 *
 * La condición era `alergenos.join(' · ') !== texto.trim()` — comparar dos
 * CADENAS YA PUNTUADAS. El texto escrito separa con «, » y la lectura con
 * « · », así que difieren como cadena aunque digan exactamente lo mismo, y la
 * condición se cumplía SIEMPRE.
 *
 * El comentario del código ya declaraba la intención correcta —«sólo aparece
 * cuando la lectura AÑADE algo»—. Lo que no coincidía era la implementación:
 * un guardián que dice lo que quiere hacer y comprueba otra cosa.
 *
 * ── LA REGLA QUE LO HACE SEGURO ─────────────────────────────────────────────
 *
 * Se compara por CONJUNTO normalizado, no por cadena. Mismos alérgenos, en
 * cualquier orden, con cualquier separador, sin acentos ni mayúsculas → la
 * lectura no añade nada y no se pinta.
 *
 * Y lo contrario importa igual: cuando el texto es prosa clínica —«Niega
 * penicilina. Alérgico a sulfas»— la lectura SÍ añade («sulfas»), y tiene que
 * seguir viéndose. Es la mitad que REG-279/REG-311 dejaron ganada y que este
 * arreglo no puede tirar.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · No dice si la lectura es CORRECTA, sólo si es redundante. Un alérgeno mal
 *   extraído se sigue enseñando — que es lo que debe pasar: el médico tiene que
 *   poder verlo para corregirlo.
 * · No mira la pantalla. Que la franja no duplique se comprobó en navegador y
 *   se registra en la bitácora del carril; aquí se fija la REGLA.
 * · Los separadores reconocidos son los que un médico escribe de verdad
 *   (`, ; · | salto de línea, « y », « e »`). Uno exótico haría que la lectura
 *   se considere distinta y se pinte: falla hacia enseñar de más, no de menos.
 */
import { describe, it, expect } from 'vitest'
import { laLecturaAnadeAlgo, alergenosDe } from '@/lib/seguridad/alergias'

describe('la lectura de alergias sólo se enseña cuando añade algo', () => {
  it('el caso REAL que estaba duplicando: la lectura es el texto con otro separador', () => {
    const escrito = 'Penicilina (anafilaxia), sulfas, AINEs'
    const leidos = alergenosDe({ alergias: escrito })
    // Como CADENA difieren —es lo que engañaba a la condición vieja—…
    expect(leidos.join(' · ')).not.toBe(escrito)
    // …pero como HECHO son lo mismo, así que no se repite.
    expect(laLecturaAnadeAlgo(escrito, leidos)).toBe(false)
  })

  it('prosa clínica: la lectura SÍ añade y tiene que verse (REG-279/REG-311)', () => {
    const escrito = 'Niega penicilina. Alérgico a sulfas'
    const leidos = alergenosDe({ alergias: escrito })
    expect(leidos.length).toBeGreaterThan(0)
    expect(laLecturaAnadeAlgo(escrito, leidos)).toBe(true)
  })

  it('mismo conjunto en otro orden tampoco añade', () => {
    expect(laLecturaAnadeAlgo('sulfas, penicilina', ['Penicilina', 'Sulfas'])).toBe(false)
  })

  it('acentos y mayúsculas no cuentan como diferencia', () => {
    expect(laLecturaAnadeAlgo('Diclofenaco, Metamizól', ['diclofenaco', 'metamizol'])).toBe(false)
  })

  it('« y » separa, como lo escribe un médico', () => {
    expect(laLecturaAnadeAlgo('penicilina y sulfas', ['penicilina', 'sulfas'])).toBe(false)
  })

  it('un alérgeno de MÁS en la lectura sí añade', () => {
    expect(laLecturaAnadeAlgo('penicilina', ['penicilina', 'sulfas'])).toBe(true)
  })

  it('un alérgeno de MENOS en la lectura también añade — el médico tiene que ver que se perdió uno', () => {
    expect(laLecturaAnadeAlgo('penicilina, sulfas', ['penicilina'])).toBe(true)
  })

  it('sin alérgenos leídos no hay nada que enseñar', () => {
    expect(laLecturaAnadeAlgo('lo que sea', [])).toBe(false)
  })
})
