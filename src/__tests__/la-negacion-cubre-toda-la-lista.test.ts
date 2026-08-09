/**
 * LA NEGACIÓN SE ESCRIBE UNA VEZ Y CUBRE TODA LA ENUMERACIÓN — REG-276.
 *
 * ── LO MEDIDO, ANTES DE TOCAR NADA ──────────────────────────────────────────
 *
 * Lo encontró la rutina `SAFE-002` en su rama. Reproducido aquí el 9-ago-2026
 * sobre el árbol que corre en producción, con `parsearAlergiasTexto` de verdad:
 *
 *     «Niega alergias a penicilina y sulfas»        → ['sulfas']
 *     «Niega alergia a penicilina, sulfas y AINEs»  → ['sulfas', 'AINEs']
 *     «Alérgico a penicilina y sulfas»              → ['Alérgico a penicilina', 'sulfas']
 *
 * Los dos primeros son **alergias fabricadas**: nadie las afirmó. El tercero es
 * el daño de «SMX)» por otra puerta — un alérgeno con la frase pegada no casa
 * con ningún fármaco del catálogo, así que el cruce alergia↔medicamento **puede
 * no dispararse** justo con el que importa.
 *
 * ── POR QUÉ ES DE LOS CAROS ─────────────────────────────────────────────────
 *
 * Una alergia que nadie afirmó apaga el botón de Firmar, se imprime en el
 * recuadro rojo de la receta que va a la farmacia, y se sella dentro de una nota
 * firmada, que es inmutable. En un consultorio de infectología una etiqueta
 * falsa de betalactámicos o de sulfas empuja a segunda línea: **peor tratamiento
 * por un dato inventado**.
 *
 * Y al médico le dejaba como única salida la que este repositorio ya documenta
 * como el fallo a evitar: borrar el texto del expediente, perdiendo a la vez el
 * dato y la compuerta.
 *
 * ── LOS DOS NIVELES, Y POR QUÉ HACEN FALTA LOS DOS ──────────────────────────
 *
 * El campo tiene dos: la ORACIÓN, que cierra el alcance de la negación, y la
 * LISTA dentro de ella, que la hereda. El corte por oración existe para no
 * cometer el error CONTRARIO —llevarse por delante una alergia real escrita
 * después de una negada—, que es el peor de los dos.
 */
import { describe, it, expect } from 'vitest'
import { parsearAlergiasTexto, alergenosDe } from '@/lib/seguridad/alergias'

const alergenos = (t: string) => parsearAlergiasTexto(t).map(a => a.alergeno)

describe('una negación cubre toda su enumeración', () => {
  it('«Niega alergias a penicilina y sulfas» no deja NINGUNA', () => {
    expect(alergenos('Niega alergias a penicilina y sulfas')).toEqual([])
  })

  it('con coma y con «y», tampoco', () => {
    expect(alergenos('Niega alergia a penicilina, sulfas y AINEs')).toEqual([])
  })

  it('«ni» también enumera dentro de la negación', () => {
    expect(alergenos('No refiere alergias a betalactámicos ni sulfas')).toEqual([])
  })
})

describe('y el corte por oración impide el error contrario, que es el peor', () => {
  /**
   * Perder una alergia REAL es peor que arrastrar una falsa: la falsa estorba,
   * la perdida mata. Por eso el punto cierra el alcance.
   */
  it('«Niega alergias. Alérgico a la penicilina.» conserva la penicilina', () => {
    expect(alergenos('Niega alergias. Alérgico a la penicilina.')).toEqual(['penicilina'])
  })

  it('el punto y coma también corta', () => {
    expect(alergenos('Niega penicilina; alérgico a sulfas')).toEqual(['sulfas'])
  })

  it('y el salto de línea', () => {
    expect(alergenos('Niega penicilina\nAlérgico a mariscos')).toEqual(['mariscos'])
  })
})

describe('el prefijo afirmativo no se queda dentro del nombre', () => {
  it('«Alérgico a penicilina y sulfas» da los dos alérgenos limpios', () => {
    expect(alergenos('Alérgico a penicilina y sulfas')).toEqual(['penicilina', 'sulfas'])
  })

  it('el punto final no se pega al alérgeno', () => {
    /**
     * `FIN_DE_ORACION` exige un espacio detrás del punto para no partir
     * «2.5 mg», así que el punto que cierra el texto llegaba pegado. Un
     * «penicilina.» no casa con ningún fármaco del catálogo — el mismo daño
     * que «SMX)».
     */
    expect(alergenos('Alérgico a la penicilina.')).toEqual(['penicilina'])
  })
})

describe('lo que ya funcionaba no se rompe', () => {
  it('la barra sigue SIN separar dentro de un nombre combinado', () => {
    /** TMP/SMX, piperacilina/tazobactam: los que él prescribe todos los días. */
    expect(alergenos('Trimetoprima/sulfametoxazol (TMP/SMX)'))
      .toEqual(['Trimetoprima/sulfametoxazol (TMP/SMX)'])
  })

  it('pero con espacios sí separa: «penicilina / sulfas» es una lista', () => {
    expect(alergenos('penicilina / sulfas')).toEqual(['penicilina', 'sulfas'])
  })

  it('una lista normal se parte igual que antes', () => {
    expect(alergenos('Penicilina, Sulfas; Mariscos')).toEqual(['Penicilina', 'Sulfas', 'Mariscos'])
  })

  it('NKDA sigue siendo una negación entera', () => {
    expect(alergenos('NKDA')).toEqual([])
  })

  it('«naproxeno» sigue siendo un alérgeno y no una negación por su «no»', () => {
    /** La comparación es con el fragmento ENTERO, nunca por prefijo. */
    expect(alergenos('naproxeno')).toEqual(['naproxeno'])
  })
})

describe('y lo que lee la compuerta de la receta es lo mismo', () => {
  it('`alergenosDe` no ve la alergia fabricada', () => {
    /**
     * Es el camino real: de aquí salen el bloqueo de la firma, el recuadro rojo
     * del impreso y el cruce con el fármaco prescrito. Comprobar sólo el parser
     * dejaría sin verificar justo el trecho donde el dato hace daño.
     */
    expect(alergenosDe({ alergias: 'Niega alergias a penicilina y sulfas' })).toEqual([])
  })

  it('y sí ve la real que viene después de una negada', () => {
    expect(alergenosDe({ alergias: 'Niega alergias. Alérgico a la penicilina.' }).length).toBe(1)
  })
})
