/**
 * GOLDEN — un paciente alérgico a TMP/SMX quedaba alérgico a «SMX)».
 *
 * ── ENCONTRADO EN EL CONSULTORIO DEL DR. (5-ago-2026) ────────────────────────
 *
 * Auditando sus pacientes reales apareció un alérgeno llamado **«SMX)»**. Venía
 * de esto:
 *
 *     «Trimetoprima/sulfametoxazol (TMP/SMX)»
 *       → ['Trimetoprima', 'sulfametoxazol (TMP', 'SMX)']
 *
 * La barra estaba entre los separadores. Y los antimicrobianos combinados —los
 * que un infectólogo prescribe todos los días— se escriben con barra: TMP/SMX,
 * piperacilina/tazobactam, amoxicilina/clavulanato.
 *
 * ── POR QUÉ IMPORTA ─────────────────────────────────────────────────────────
 *
 * De este parser leen la compuerta de la receta, la nota, el recurso FHIR y el
 * sesgo del reconocedor. Un alérgeno partido en «SMX)» no coincide con ningún
 * fármaco, así que **el cruce alergia↔fármaco puede no dispararse** justo con el
 * antibiótico al que el paciente sí es alérgico.
 *
 * ── LA REGLA ────────────────────────────────────────────────────────────────
 *
 * La barra separa sólo con **espacio a algún lado**: «penicilina / sulfas» es una
 * lista, «TMP/SMX» es un nombre. Misma solución que ya se aplicó al punto.
 */
import { describe, it, expect } from 'vitest'
import { parsearAlergiasTexto, negacionesEnTexto } from '@/lib/seguridad/alergias'

const alergenos = (t: string) => parsearAlergiasTexto(t).map(a => a.alergeno)

describe('LOS COMBINADOS NO SE PARTEN', () => {
  it('trimetoprima/sulfametoxazol con su sigla — el caso real del Dr.', () => {
    expect(alergenos('Trimetoprima/sulfametoxazol (TMP/SMX)'))
      .toEqual(['Trimetoprima/sulfametoxazol (TMP/SMX)'])
  })

  it('piperacilina/tazobactam', () => {
    expect(alergenos('Piperacilina/tazobactam')).toEqual(['Piperacilina/tazobactam'])
  })

  it('amoxicilina/clavulanato', () => {
    expect(alergenos('Amoxicilina/clavulanato')).toEqual(['Amoxicilina/clavulanato'])
  })

  it('y ya no aparece nunca un fragmento como «SMX)»', () => {
    /**
     * El síntoma exacto que se vio en sus datos. Si vuelve, es que la barra
     * volvió a separar.
     */
    for (const a of alergenos('Trimetoprima/sulfametoxazol (TMP/SMX)')) {
      expect(a).not.toMatch(/^\w{2,4}\)$/)
    }
  })
})

describe('LAS LISTAS DE VERDAD SIGUEN SEPARÁNDOSE', () => {
  it('con la barra rodeada de espacios', () => {
    // Ahí sí es una lista y no un nombre.
    expect(alergenos('Penicilina / sulfas')).toEqual(['Penicilina', 'sulfas'])
  })

  it('con coma', () => {
    expect(alergenos('Penicilina, sulfas')).toEqual(['Penicilina', 'sulfas'])
  })

  it('con punto y coma', () => {
    expect(alergenos('Penicilina; sulfas; mariscos')).toEqual(['Penicilina', 'sulfas', 'mariscos'])
  })

  it('y con «y»', () => {
    expect(alergenos('Penicilina y sulfas')).toEqual(['Penicilina', 'sulfas'])
  })
})

describe('LO QUE YA FUNCIONABA NO SE ROMPIÓ', () => {
  it('la alergia que viene DESPUÉS de una negación sigue apareciendo', () => {
    /**
     * Es el defecto que arregló el separador de punto: sin él, «Niega
     * penicilina. Alérgico a sulfas» era un solo fragmento negado y la alergia
     * a sulfas DESAPARECÍA de la compuerta de la receta.
     */
    /**
     * REG-276 — antes esperaba `['Alérgico a sulfas']`, CON el prefijo dentro
     * del nombre. Se cambia porque un alérgeno llamado «Alérgico a sulfas» no
     * casa con ningún fármaco del catálogo, así que el cruce
     * alergia↔medicamento podía no dispararse justo con el que importa. Es el
     * mismo daño que «SMX)», por otra puerta. Lo que la prueba defiende —que la
     * alergia de después de una negación SIGA APARECIENDO— no cambia.
     */
    expect(alergenos('Niega penicilina. Alérgico a sulfas')).toEqual(['sulfas'])
  })

  it('y las negaciones se siguen reconociendo', () => {
    // «negadas» y «ninguna» son lo que el Dr. escribe de verdad: 14 de sus 23.
    expect(alergenos('negadas')).toEqual([])
    expect(alergenos('ninguna')).toEqual([])
    expect(negacionesEnTexto('Niega penicilina')).toHaveLength(1)
  })

  it('un alérgeno simple sigue igual', () => {
    expect(alergenos('Penicilina')).toEqual(['Penicilina'])
  })
})
