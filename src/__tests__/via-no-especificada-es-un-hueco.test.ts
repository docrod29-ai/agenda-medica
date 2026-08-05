/**
 * GOLDEN — «no especificada» se guardaba como si fuera una vía.
 *
 * ── ENCONTRADO EN LAS NOTAS FIRMADAS DEL DR. (5-ago-2026) ────────────────────
 *
 * Auditando sus 28 medicamentos en notas firmadas aparecieron vías que **no
 * existen en el tipo**:
 *
 *     oral ................ 23
 *     «no especificada» ....  4   ← no está en el enum
 *     «subcutanea» .........  1   ← el enum dice `sc`
 *
 * Lo que devuelve la IA se guardaba sin validar. Y eso apagaba **dos** cuidados
 * a la vez, justo en el caso en que más falta hacen:
 *
 * **1. El guard de parenterales puros.** Existe para que jamás se imprima
 * «insulina · oral» —una vía que para ese fármaco no existe—:
 *
 *     insulina + 'oral'             → sc   ✅
 *     insulina + ''                 → sc   ✅
 *     insulina + 'no especificada'  → «no especificada»   ❌
 *
 * **2. El aviso de vía no dictada** (decisión del médico dueño el 4-ago:
 * «déjalo oral pero que avise si no se dictó»). Miraba `oral` o vacío, así que
 * con «no especificada» —el caso exacto que tenía que cazar— no saltaba.
 *
 * ── LA REGLA ────────────────────────────────────────────────────────────────
 *
 * Una vía que nadie decidió no es un dato: es un hueco. Se traduce lo traducible
 * («subcutanea» es `sc`) y los huecos se tratan como ausencia, para que los dos
 * cuidados vuelvan a cubrir el caso.
 */
import { describe, it, expect } from 'vitest'
import { normalizarVia, esViaAusente } from '@/lib/expediente/via-normalizada'
import { corregirViaParenteral } from '@/lib/expediente/via-parenteral'
import { conViaAsumida } from '@/lib/expediente/via-asumida'

describe('EL HUECO SE RECONOCE COMO HUECO', () => {
  it('«no especificada» — el valor que la IA escribe de verdad', () => {
    expect(esViaAusente('no especificada')).toBe(true)
    expect(normalizarVia('no especificada')).toBe('')
  })

  it('y sus parientes', () => {
    for (const v of ['sin especificar', 'desconocida', 'n/a', '-', '', '   ']) {
      expect(esViaAusente(v)).toBe(true)
    }
  })

  it('pero una vía de verdad NO es un hueco', () => {
    for (const v of ['oral', 'iv', 'sc', 'subcutanea']) expect(esViaAusente(v)).toBe(false)
  })
})

describe('LO TRADUCIBLE SE TRADUCE AL VOCABULARIO DEL TIPO', () => {
  it('«subcutanea» es `sc` — apareció en sus notas firmadas', () => {
    expect(normalizarVia('subcutanea')).toBe('sc')
    expect(normalizarVia('subcutánea')).toBe('sc')
  })

  it('«intravenosa» es `iv`', () => {
    expect(normalizarVia('intravenosa')).toBe('iv')
    expect(normalizarVia('endovenoso')).toBe('iv')
  })

  it('y lo que ya está bien no se toca', () => {
    expect(normalizarVia('oral')).toBe('oral')
    expect(normalizarVia('sc')).toBe('sc')
  })

  it('lo desconocido se devuelve tal cual, sin inventar una vía', () => {
    /**
     * Enseñar una vía rara es peor que ninguna, pero inventarla es peor que las
     * dos: el médico no vería que hay algo que revisar.
     */
    expect(normalizarVia('por sonda nasogástrica')).toBe('por sonda nasogástrica')
  })
})

describe('EL GUARD DE PARENTERALES VUELVE A CUBRIR EL CASO', () => {
  it('insulina con «no especificada» se corrige a subcutánea', () => {
    // Éste es el que fallaba. Es el fármaco de alto riesgo por excelencia.
    expect(corregirViaParenteral('Insulina glargina', 'no especificada' as never)).toBe('sc')
  })

  it('y los casos que ya funcionaban siguen igual', () => {
    expect(corregirViaParenteral('Insulina glargina', 'oral' as never)).toBe('sc')
    expect(corregirViaParenteral('Insulina glargina', '' as never)).toBe('sc')
  })

  it('una vía que el médico SÍ decidió no se pisa', () => {
    // Si alguien puso una vía a propósito, corregirla sería peor.
    expect(corregirViaParenteral('Insulina glargina', 'subcutanea' as never)).toBe('subcutanea')
  })

  it('y un fármaco con presentación oral no se toca', () => {
    expect(corregirViaParenteral('Paracetamol', 'oral' as never)).toBe('oral')
  })
})

describe('EL AVISO AL MÉDICO VUELVE A SALTAR', () => {
  it('con «no especificada», que es cuando más falta hace', () => {
    const r = conViaAsumida([{ nombre: 'Ceftriaxona', via: 'no especificada', source_quote: 'ceftriaxona un gramo' }])
    expect(r.map(m => m.nombre)).toEqual(['Ceftriaxona'])
  })

  it('pero NO con una vía que alguien decidió', () => {
    // Avisar ahí sería ruido, y el ruido se acaba ignorando junto con lo que importa.
    expect(conViaAsumida([{ nombre: 'Enoxaparina', via: 'subcutanea', source_quote: 'enoxaparina 40' }])).toEqual([])
  })
})
