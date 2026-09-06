/**
 * EL DIAGNÓSTICO IMPRESO NO ES UN CÓDIGO HUÉRFANO — REG-516.
 *
 * QUÉ FALLABA. El dueño, con la receta abierta en su teléfono: «ahora no pones
 * diagnóstico, nomás dice CIE-10». Literal: la pantalla componía
 * `descripcion + " (" + codigoCIE10 + ")"`, así que un diagnóstico con código y
 * sin descripción salía impreso como « (A41.9)».
 *
 * CÓMO SE DESCUBRIÓ. Usándolo. No lo cazó ninguna prueba: las que había miraban
 * que el campo existiera, no qué decía cuando media fuente venía vacía.
 *
 * CAUSA RAÍZ. Dos: (1) concatenar sin comprobar que la descripción exista, y
 * (2) la misma composición COPIADA en `/receta` y en `/orden`, así que arreglar
 * una dejaba la otra rota. Fuente de verdad duplicada, que la carta prohíbe.
 *
 * LA REGLA QUE LO HACE SEGURO. Un código no es un diagnóstico: «A41.9» no le
 * dice nada a quien surte la receta. Se imprime UNO —el principal—, se prefiere
 * el `definitivo`, y un código sin descripción NO se imprime: el campo se queda
 * en blanco para que lo escriba el médico.
 *
 * LO QUE NO CUBRE.
 *  · No infiere la descripción a partir del código. Haría falta un catálogo
 *    CIE-10 citado, y rellenar aquí un texto plausible sería poner en la receta
 *    un diagnóstico que nadie escribió.
 *  · No valida que el código sea correcto para esa descripción.
 *  · Es una función pura: que las dos pantallas la llamen lo vigila el caso de
 *    abajo, leyendo la fuente.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { diagnosticoParaImprimir } from '@/lib/expediente/fusionar-diagnosticos'

describe('REG-516 · el diagnóstico que se imprime', () => {
  it('EL CASO: un código sin descripción NO se imprime', () => {
    expect(diagnosticoParaImprimir([{ descripcion: '', codigoCIE10: 'A41.9' }])).toBe('')
  })

  it('la descripción sola sí se imprime: el código es el adorno', () => {
    expect(diagnosticoParaImprimir([{ descripcion: 'Choque séptico' }])).toBe('Choque séptico')
  })

  it('con los dos, van los dos', () => {
    expect(diagnosticoParaImprimir([{ descripcion: 'Choque séptico', codigoCIE10: 'A41.9' }]))
      .toBe('Choque séptico (A41.9)')
  })

  it('UNO solo, y se prefiere el definitivo — no se repite ni se acumula', () => {
    const r = diagnosticoParaImprimir([
      { descripcion: 'Fiebre', tipo: 'presuntivo' },
      { descripcion: 'Urosepsis', tipo: 'definitivo', codigoCIE10: 'A41.51' },
      { descripcion: 'Lesión renal aguda', tipo: 'definitivo' },
    ])
    expect(r).toBe('Urosepsis (A41.51)')
    expect(r).not.toContain(';')
  })

  it('un definitivo SIN descripción no gana a un presuntivo que sí la tiene', () => {
    // Preferir el definitivo no puede significar imprimir un hueco.
    expect(diagnosticoParaImprimir([
      { descripcion: '', tipo: 'definitivo', codigoCIE10: 'A41.9' },
      { descripcion: 'Fiebre de origen urinario', tipo: 'presuntivo' },
    ])).toBe('Fiebre de origen urinario')
  })

  it('sin diagnósticos, cadena vacía — el médico lo escribe', () => {
    expect(diagnosticoParaImprimir([])).toBe('')
    expect(diagnosticoParaImprimir(undefined)).toBe('')
  })

  it('LAS DOS PANTALLAS la llaman: estaba duplicado y por eso persistía', () => {
    for (const ruta of [
      'src/app/(dashboard)/receta/[patientId]/[notaId]/page.tsx',
      'src/app/(dashboard)/orden/[patientId]/[notaId]/page.tsx',
    ]) {
      const src = readFileSync(join(process.cwd(), ruta), 'utf8')
      expect(src, `${ruta} dejó de usar la función única`).toContain('diagnosticoParaImprimir(')
      expect(src, `${ruta} volvió a componer el diagnóstico a mano`)
        .not.toMatch(/principal\.descripcion \+ \(/)
    }
  })
})
