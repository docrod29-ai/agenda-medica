/**
 * GOLDEN — «Niega alergias a penicilina y sulfas» dejaba al paciente alérgico a
 * las sulfas.
 *
 * ── CÓMO SE DESCUBRIÓ ────────────────────────────────────────────────────────
 *
 * 7-ago-2026. Recorriendo otra vez el camino del alérgeno de punta a punta —el
 * mismo recorrido que encontró REG-144 y REG-171— pero probando el parser
 * canónico contra el campo escrito **como se escribe de verdad**: enumerando.
 * Se corrió el motor real sobre siete redacciones y dos de ellas devolvieron un
 * alérgeno que el campo estaba negando.
 *
 * ── EL DEFECTO ───────────────────────────────────────────────────────────────
 *
 *     «Niega alergias a penicilina y sulfas»
 *       → ['Niega alergias a penicilina', 'sulfas']   ← el « y » separa
 *       → el primero se descarta por negado
 *       → **queda una alergia a las sulfas que nadie afirmó**
 *
 * `esAlergiaNegada` mira el principio de cada fragmento, y el negador está
 * escrito una sola vez: en el primero. El alcance de la negación se perdía en el
 * separador.
 *
 * ── POR QUÉ IMPORTA PARA UN PACIENTE ─────────────────────────────────────────
 *
 * La alergia inventada dispara la alerta crítica del cruce alergia↔fármaco —la
 * que deshabilita Firmar—, se imprime en el recuadro rojo de la receta que va a
 * la farmacia y se sella en una nota firmada, que es inmutable. En el
 * consultorio de un infectólogo una etiqueta falsa de alergia a betalactámicos o
 * a sulfas no es un aviso de más: empuja a segunda línea, que es peor
 * tratamiento. Y al médico sólo le quedaba la salida que este repositorio ya
 * documentó como el fallo a evitar: **borrar el texto del expediente**, con lo
 * que se pierden a la vez el dato y la compuerta.
 *
 * ── LA REGLA QUE LO HACE SEGURO ──────────────────────────────────────────────
 *
 * La negación se hereda dentro de la frase y se corta con un fin de frase
 * (punto, punto y coma, salto) o con una marca de que el fragmento afirma
 * («alérgico a…», «refiere…»). Los dos cortes existen para que la reparación
 * **no se lleve por delante una alergia real** escrita después de una negada:
 * ése es el error caro en la dirección contraria, y es el caso que se ganó el
 * 4-ago (REG-141 del punto) y que aquí se vuelve a fijar.
 *
 * ── QUÉ NO CUBRE ─────────────────────────────────────────────────────────────
 *
 * - No adivina un alcance que el campo no marca: «Niega penicilina, sulfas»
 *   descarta las dos. Si el médico quiso decir «niega penicilina, ES alérgico a
 *   sulfas», tiene que escribirlo con punto o con la palabra que lo afirme —y lo
 *   descartado sigue saliendo por `negacionesEnTexto`, sin esconderse.
 * - `negacionesEnTexto` **todavía no la pinta nadie**: la función existe y no
 *   tiene un solo llamador en la interfaz. Lo descartado es consultable, no
 *   visible. Queda anotado en el backlog.
 * - No toca qué bloquea la firma. Sólo cambia qué dice el campo.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { alergenosDe, negacionesEnTexto, parsearAlergiasTexto } from '@/lib/seguridad/alergias'
import { validarAlergiasVsMedicamentos } from '@/lib/expediente/medical-dictionary'
import { cdsMedicamento } from '@/lib/hospital/cds'

const alergenos = (texto: string) => alergenosDe({ alergias: texto })

describe('LA NEGACIÓN ALCANZA A TODA LA ENUMERACIÓN', () => {
  it('«Niega alergias a penicilina y sulfas» no deja ninguna alergia', () => {
    // El caso medido: devolvía ['sulfas'].
    expect(alergenos('Niega alergias a penicilina y sulfas')).toEqual([])
  })

  it('y tampoco con coma, que es como se enumera de verdad', () => {
    expect(alergenos('Niega alergia a penicilina, sulfas y mariscos')).toEqual([])
    expect(alergenos('niega penicilina y cefalosporinas')).toEqual([])
    expect(alergenos('Sin alergias: penicilina, sulfas')).toEqual([])
  })

  it('lo descartado por herencia SE PUEDE CONSULTAR, no se esconde', () => {
    // Regla 3 de seguridad clínica: nada cambia en silencio. Si el fragmento se
    // descarta por el alcance de la negación, tiene que poder enseñarse.
    expect(negacionesEnTexto('Niega alergias a penicilina y sulfas'))
      .toEqual(['Niega alergias a penicilina', 'sulfas'])
  })
})

describe('Y NO SE LLEVA POR DELANTE UNA ALERGIA REAL', () => {
  it('el punto corta el alcance — el caso que se ganó el 4-ago', () => {
    expect(alergenos('Niega penicilina. Alérgico a sulfas')).toEqual(['Alérgico a sulfas'])
    expect(alergenos('Niega alergias. Refiere intolerancia a metformina'))
      .toEqual(['Refiere intolerancia a metformina'])
  })

  it('el punto y coma y el salto de línea también', () => {
    expect(alergenos('Niega penicilina; sulfas')).toEqual(['sulfas'])
    expect(alergenos('Niega penicilina\nsulfas')).toEqual(['sulfas'])
  })

  it('y la palabra que afirma, dentro de la misma frase', () => {
    expect(alergenos('Niega alergia a penicilina, alérgico a sulfas')).toEqual(['alérgico a sulfas'])
    expect(alergenos('Niega penicilina, reacción a AINE')).toEqual(['reacción a AINE'])
  })

  it('un campo afirmativo enumerado conserva TODOS sus alérgenos', () => {
    expect(alergenos('Alérgico a penicilina y sulfas')).toEqual(['Alérgico a penicilina', 'sulfas'])
    expect(alergenos('Penicilina, Sulfas; Mariscos')).toEqual(['Penicilina', 'Sulfas', 'Mariscos'])
  })

  it('«nunca» y «ausente» siguen negando: venían del CDS hospitalario', () => {
    // Los tenía `hospital/cds.ts` y el canónico no. Al unificar habrían caído.
    expect(alergenos('Nunca ha presentado alergias')).toEqual([])
    expect(alergenos('Ausentes')).toEqual([])
  })
})

describe('DONDE ACABA EL DATO: LA COMPUERTA QUE BLOQUEA LA FIRMA', () => {
  it('el paciente que NIEGA sulfas no dispara la crítica ante TMP/SMX', () => {
    // Lo que medía antes del arreglo: una alerta crítica «Alergia a sulfas y se
    // prescribe Trimetoprima/Sulfametoxazol». Con ella, Firmar queda gris.
    const alertas = validarAlergiasVsMedicamentos(
      parsearAlergiasTexto('Niega alergias a penicilina y sulfas'),
      [{ nombre: 'Trimetoprima/Sulfametoxazol 800/160 mg' }],
    )
    expect(alertas).toEqual([])
  })

  it('pero el que SÍ es alérgico la sigue disparando', () => {
    const alertas = validarAlergiasVsMedicamentos(
      parsearAlergiasTexto('Alérgico a penicilina y sulfas'),
      [{ nombre: 'Trimetoprima/Sulfametoxazol 800/160 mg' }],
    )
    expect(alertas.some(a => a.severidad === 'critica')).toBe(true)
  })
})

describe('EL PUNTO DE ORDEN HOSPITALARIO LEE LO MISMO', () => {
  it('la negación enumerada tampoco alerta ahí', () => {
    const a = cdsMedicamento({ nombre: 'Sulfametoxazol/trimetoprima', alergias: 'niega penicilina, sulfas' })
    expect(a.some(x => x.nivel === 'critica')).toBe(false)
  })

  it('y «Penicilina / Sulfas» son DOS alérgenos también aquí', () => {
    // Su partidor propio no conocía la barra: el término viajaba entero y el
    // cruce podía no dispararse.
    const a = cdsMedicamento({ nombre: 'Amoxicilina', alergias: 'Penicilina / Sulfas' })
    expect(a.some(x => x.nivel === 'critica')).toBe(true)
  })

  it('lee `alergiasEstructuradas` cuando el texto libre está vacío', () => {
    const a = cdsMedicamento({
      nombre: 'Amoxicilina',
      alergias: ['Penicilina'],
    })
    expect(a.some(x => x.nivel === 'critica')).toBe(true)
  })
})

describe('GUARDIÁN — ningún partidor propio del campo de alergias', () => {
  it('el CDS hospitalario ya no tiene el suyo', () => {
    /**
     * El guardián de REG-144 sólo miraba `consulta` y `uci`, y por eso esta
     * quinta copia sobrevivió un año. Se le añade el archivo que se le escapó.
     */
    const cds = readFileSync(join(process.cwd(), 'src', 'lib', 'hospital', 'cds.ts'), 'utf8')
    expect(cds).toContain('alergenosDe(')
    expect(cds, 'cds volvió a partir las alergias a mano').not.toMatch(/alergias[^\n]*\.split\(/)
  })
})
