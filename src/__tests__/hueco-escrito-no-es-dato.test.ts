/**
 * UN HUECO ESCRITO CON LETRAS NO PUEDE ENTRAR COMO DATO — REG-177.
 *
 * Lo que se comprueba aquí no es que exista una función que limpie: es que el
 * texto que el modelo escribe DE VERDAD en las notas del Dr. —«No
 * especificada»— **no sobreviva a la frontera de entrada**.
 *
 * Las pruebas van sobre el ESQUEMA, no sobre el helper, porque el defecto no
 * era que faltara un limpiador: era que nadie lo llamaba en el sitio por el que
 * pasa todo. Probar el helper habría dado verde con el defecto intacto —
 * exactamente el fallo que documenta `scripts/verificar-invariantes-de-datos.md`.
 */
import { describe, it, expect } from 'vitest'
import { MedicamentoAuditado } from '@/lib/expediente/extraction-schema'
import { esHuecoEscrito, sinHuecoEscrito } from '@/lib/expediente/hueco-textual'
import { DOSIS_DESCONOCIDA, esDosisDeclaradaDesconocida } from '@/lib/seguridad/dosis-desconocida'
import { conViaAsumida } from '@/lib/expediente/via-asumida'

const med = (extra: Record<string, unknown>) =>
  MedicamentoAuditado.parse({ nombre: 'metformina', ...extra })

describe('la frontera de extracción no deja pasar un hueco disfrazado', () => {
  it('«No especificada» en dosis entra como vacío', () => {
    expect(med({ dosis: 'No especificada' }).dosis).toBe('')
  })

  it('«no especificada» en via entra como vacío', () => {
    expect(med({ via: 'no especificada' }).via).toBe('')
  })

  it('«Desconocida» en dosis entra como vacío', () => {
    expect(med({ dosis: 'Desconocida' }).dosis).toBe('')
  })

  it('«N/A» en dosis entra como vacío', () => {
    expect(med({ dosis: 'N/A' }).dosis).toBe('')
  })

  it('«sin especificar» en via entra como vacío', () => {
    expect(med({ via: 'sin especificar' }).via).toBe('')
  })

  it('un guion solo no es una dosis', () => {
    expect(med({ dosis: '-' }).dosis).toBe('')
  })

  it('«ninguna» no es una vía', () => {
    expect(med({ via: 'ninguna' }).via).toBe('')
  })
})

describe('sanear no es borrar: el dato de verdad sobrevive intacto', () => {
  it('una dosis real pasa tal cual', () => {
    expect(med({ dosis: '850 mg' }).dosis).toBe('850 mg')
  })

  it('una dosis con ruido conserva la cifra', () => {
    // Igualdad exacta, no `includes`: vaciarla perdería el «1 tableta».
    expect(med({ dosis: '1 tableta, no especificada la marca' }).dosis)
      .toBe('1 tableta, no especificada la marca')
  })

  it('la vía dictada pasa tal cual', () => {
    expect(med({ via: 'oral' }).via).toBe('oral')
  })

  it('«subcutanea» se traduce al vocabulario del tipo', () => {
    expect(med({ via: 'subcutanea' }).via).toBe('sc')
  })

  it('una vía que no se reconoce se enseña, no se inventa', () => {
    expect(med({ via: 'intraperitoneal' }).via).toBe('intraperitoneal')
  })
})

describe('lo que el médico declara a propósito NO es un hueco', () => {
  it('la frase canónica del botón «No la sabe» sobrevive a la frontera', () => {
    // Si esto se vaciara, el botón que el Dr. pidió (REG-176) dejaría de
    // funcionar: su declaración volvería a ser un hueco y la firma se bloquearía.
    expect(med({ dosis: DOSIS_DESCONOCIDA }).dosis).toBe(DOSIS_DESCONOCIDA)
  })

  it('y sigue reconociéndose como declaración después de pasar por el esquema', () => {
    expect(esDosisDeclaradaDesconocida(med({ dosis: DOSIS_DESCONOCIDA }).dosis)).toBe(true)
  })

  it('«desconocida» a secas SÍ es un hueco — no es la declaración', () => {
    expect(med({ dosis: 'desconocida' }).dosis).toBe('')
    expect(esDosisDeclaradaDesconocida('desconocida')).toBe(false)
  })
})

describe('los cuidados que el hueco disfrazado apagaba vuelven a actuar', () => {
  it('el aviso de vía no dictada ve el medicamento saneado', () => {
    const saneado = med({ nombre: 'losartán', via: 'No especificada', source_quote: 'le doy losartán' })
    expect(conViaAsumida([saneado])).toHaveLength(1)
  })

  it('con la vía dictada no hay aviso', () => {
    const saneado = med({ nombre: 'enoxaparina', via: 'subcutanea', source_quote: 'enoxaparina subcutánea' })
    expect(conViaAsumida([saneado])).toHaveLength(0)
  })
})

describe('el reconocedor de huecos, en los bordes', () => {
  it('la cadena vacía es un hueco', () => { expect(esHuecoEscrito('')).toBe(true) })
  it('sólo espacios es un hueco', () => { expect(esHuecoEscrito('   ')).toBe(true) })
  it('null es un hueco', () => { expect(esHuecoEscrito(null)).toBe(true) })
  it('undefined es un hueco', () => { expect(esHuecoEscrito(undefined)).toBe(true) })
  it('con tilde o sin ella, el mismo hueco', () => { expect(esHuecoEscrito('NO ESPECIFICADA')).toBe(true) })
  it('«500 mg» no es un hueco', () => { expect(esHuecoEscrito('500 mg')).toBe(false) })
  it('«1 gota» no es un hueco', () => { expect(esHuecoEscrito('1 gota')).toBe(false) })
  it('sinHuecoEscrito conserva mayúsculas y tildes del dato real', () => {
    expect(sinHuecoEscrito('  Media Tableta  ')).toBe('Media Tableta')
  })
})
