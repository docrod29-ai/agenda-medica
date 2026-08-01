/**
 * El mensaje de un fallo de IA depende de QUIÉN PAGA la llave.
 *
 * La regla que protegen estas pruebas la puso el dueño: «no quiero que a mis
 * clientes les pase eso, está prohibido». Traducida a algo comprobable: cuando
 * la llave es de la PLATAFORMA, el texto que ve el médico no puede contener ni
 * una insinuación de que es culpa suya o de que tiene que pagar.
 *
 * Es una prueba de TEXTO a propósito. El bug de origen no fue un cálculo malo:
 * fue una frase — «No pude responder ahora; intenta de nuevo» — puesta donde
 * debía ir la verdad.
 */
import { describe, it, expect } from 'vitest'
import {
  claseDeFallo, quienPaga, seArreglaReintentando, avisoAlMedico, avisoAlDueno,
} from '@/lib/ia/fallo-proveedor'

describe('claseDeFallo', () => {
  it('401 y 403 son llave inválida', () => {
    expect(claseDeFallo(401)).toBe('llave_invalida')
    expect(claseDeFallo(403)).toBe('llave_invalida')
  })

  it('el saldo agotado de Anthropic viaja disfrazado de 400', () => {
    // Si sólo se mirara el código, esto caería en «otro» y el dueño recibiría
    // «error inesperado» cuando lo que hay que hacer es ir a pagar.
    const cuerpo = '{"type":"error","error":{"type":"invalid_request_error","message":"Your credit balance is too low to access the Anthropic API."}}'
    expect(claseDeFallo(400, cuerpo)).toBe('sin_saldo')
  })

  it('el 429 de OpenAI puede ser «vas muy rápido» o «se acabó el saldo», y no son lo mismo', () => {
    expect(claseDeFallo(429, '{"error":{"code":"rate_limit_exceeded"}}')).toBe('limite_tasa')
    expect(claseDeFallo(429, '{"error":{"code":"insufficient_quota"}}')).toBe('sin_saldo')
  })

  it('529 de Anthropic y 503 son sobrecarga del proveedor', () => {
    expect(claseDeFallo(529)).toBe('sobrecarga')
    expect(claseDeFallo(503)).toBe('sobrecarga')
  })

  it('reconoce la llave inválida por el cuerpo aunque el código no sea 401', () => {
    expect(claseDeFallo(400, '{"error":{"code":"invalid_api_key"}}')).toBe('llave_invalida')
  })
})

describe('seArreglaReintentando', () => {
  it('llave y saldo NO se arreglan reintentando: son de gestión', () => {
    expect(seArreglaReintentando('llave_invalida')).toBe(false)
    expect(seArreglaReintentando('sin_saldo')).toBe(false)
  })
  it('lo transitorio sí', () => {
    expect(seArreglaReintentando('limite_tasa')).toBe(true)
    expect(seArreglaReintentando('sobrecarga')).toBe(true)
  })
})

describe('quienPaga', () => {
  it('sólo la llave del consultorio la paga el consultorio', () => {
    expect(quienPaga('clinica')).toBe('clinica')
  })
  it('prueba, fundador y ninguna corren sobre la plataforma', () => {
    expect(quienPaga('prueba')).toBe('plataforma')
    expect(quienPaga('fundador')).toBe('plataforma')
    expect(quienPaga('ninguna')).toBe('plataforma')
  })
})

describe('avisoAlMedico — la regla del dueño', () => {
  const CULPA = /tu llave|tu cuenta|tu saldo|recarga|paga|configuración/i

  it('con llave de la PLATAFORMA jamás se culpa al médico ni se le manda a pagar', () => {
    const clases = ['llave_invalida', 'sin_saldo', 'limite_tasa', 'sobrecarga', 'timeout', 'otro'] as const
    for (const clase of clases) {
      const a = avisoAlMedico(clase, 'plataforma')
      expect(a.texto, `clase ${clase}`).not.toMatch(CULPA)
      expect(a.accionable, `clase ${clase}`).toBe(false)
    }
  })

  it('con llave de la plataforma siempre se le dice que su dictado está guardado', () => {
    // Es el miedo real a media consulta, y el que disparó todo esto.
    const clases = ['llave_invalida', 'sin_saldo', 'limite_tasa', 'sobrecarga', 'timeout', 'otro'] as const
    for (const clase of clases) {
      expect(avisoAlMedico(clase, 'plataforma').texto, `clase ${clase}`).toMatch(/guardado/i)
    }
  })

  it('con llave PROPIA sí se le dice qué pasó y dónde arreglarlo', () => {
    const a = avisoAlMedico('llave_invalida', 'clinica')
    expect(a.texto).toMatch(/Configuración/)
    expect(a.accionable).toBe(true)
    expect(a.reintentar).toBe(false)
  })

  it('nunca invita a reintentar algo que no puede salir bien', () => {
    for (const quien of ['clinica', 'plataforma'] as const) {
      expect(avisoAlMedico('llave_invalida', quien).reintentar).toBe(false)
      expect(avisoAlMedico('sin_saldo', quien).reintentar).toBe(false)
    }
  })

  it('el mensaje viejo —el del incidente— ya no puede volver a aparecer', () => {
    const clases = ['llave_invalida', 'sin_saldo', 'limite_tasa', 'sobrecarga', 'timeout', 'otro'] as const
    for (const clase of clases) {
      for (const quien of ['clinica', 'plataforma'] as const) {
        expect(avisoAlMedico(clase, quien).texto).not.toMatch(/No pude responder ahora/i)
      }
    }
  })
})

describe('avisoAlDueno', () => {
  it('un fallo de la llave del CONSULTORIO no es incidencia del dueño', () => {
    expect(avisoAlDueno('llave_invalida', 'clinica')).toBeNull()
    expect(avisoAlDueno('sin_saldo', 'clinica')).toBeNull()
  })

  it('llave muerta o sin saldo de la plataforma son URGENTES: el producto está caído', () => {
    expect(avisoAlDueno('llave_invalida', 'plataforma')?.urgente).toBe(true)
    expect(avisoAlDueno('sin_saldo', 'plataforma')?.urgente).toBe(true)
  })

  it('lo transitorio del proveedor no despierta a nadie de madrugada', () => {
    expect(avisoAlDueno('sobrecarga', 'plataforma')?.urgente).toBe(false)
    expect(avisoAlDueno('limite_tasa', 'plataforma')?.urgente).toBe(false)
  })

  it('el aviso dice QUÉ HACER, no sólo qué pasó', () => {
    // «avísame si tengo que pagar»: el texto tiene que nombrar la acción.
    expect(avisoAlDueno('sin_saldo', 'plataforma')?.queHacer).toMatch(/recarga/i)
    expect(avisoAlDueno('llave_invalida', 'plataforma')?.queHacer).toMatch(/vercel/i)
  })
})
