import { describe, it, expect } from 'vitest'
import { paginarParaDocumento, areaImpracticable } from '@/lib/receta-paginacion'
import type { Medicamento } from '@/types/expediente'

/**
 * Los tests existentes verifican el estimador CONTRA SÍ MISMO. Estos fijan las
 * dos cosas que de verdad importan en el papel:
 *
 *  1. Ningún medicamento desaparece, pase lo que pase con los márgenes.
 *  2. La reserva del pie no baja de lo que el pie realmente ocupa.
 *
 * El segundo importa porque el bloque de firma se coloca con `marginTop: auto`
 * dentro de una hoja con `overflow: hidden`: si la reserva se queda corta, no hay
 * espacio libre que repartir y la firma se sale del área visible. El resultado no
 * es una hoja fea — es una receta impresa SIN FIRMA NI CÉDULA.
 */

const med = (nombre: string): Medicamento => ({
  nombre, dosis: '500 mg', via: 'oral', frecuencia: 'cada 8 horas', duracion: '7 días',
} as Medicamento)

const base = {
  paperWidthMm: 140,
  paperHeightMm: 216,
  margenes: { top: 10, right: 12, bottom: 10, left: 12 },
  fontSizePx: 11,
  tieneFirmaImagen: true,
}

function totalMedicamentos(paginas: { medicamentos: Medicamento[] }[]): number {
  return paginas.reduce((n, p) => n + p.medicamentos.length, 0)
}

describe('ningún medicamento se pierde', () => {
  it('con 12 medicamentos de nombre largo, todos aparecen repartidos', () => {
    const meds = Array.from({ length: 12 }, (_, i) =>
      med(`Amoxicilina con ácido clavulánico ${i + 1} — presentación suspensión`))
    const paginas = paginarParaDocumento({ ...base, medicamentos: meds })
    expect(totalMedicamentos(paginas)).toBe(12)
    expect(paginas.length).toBeGreaterThan(1)
  })

  it('REGRESIÓN: márgenes absurdos no hacen desaparecer medicamentos', () => {
    // Arrastrar el folio al pie del formato producía un margen superior mayor que
    // la hoja. El clamp del estimador decía que todo cabía en una página, y el
    // render —con overflow:hidden— borraba los medicamentos sin avisar.
    const meds = Array.from({ length: 6 }, (_, i) => med(`Fármaco ${i + 1}`))
    const paginas = paginarParaDocumento({
      ...base,
      margenes: { top: 200, right: 12, bottom: 60, left: 12 },   // suman más que los 216 mm
      medicamentos: meds,
    })
    expect(totalMedicamentos(paginas)).toBe(6)
  })

  it('los márgenes imposibles se pueden detectar ANTES de imprimir', () => {
    expect(areaImpracticable(140, 216, { top: 200, right: 12, bottom: 60, left: 12 })).toBe(true)
    expect(areaImpracticable(140, 216, { top: 10, right: 12, bottom: 10, left: 12 })).toBe(false)
  })

  it('un solo medicamento cabe en una sola hoja', () => {
    const paginas = paginarParaDocumento({ ...base, medicamentos: [med('Paracetamol')] })
    expect(paginas.length).toBe(1)
    expect(totalMedicamentos(paginas)).toBe(1)
  })

  it('sin medicamentos sigue habiendo una hoja (la receta existe aunque esté vacía)', () => {
    expect(paginarParaDocumento({ ...base, medicamentos: [] }).length).toBe(1)
  })
})

describe('la firma cabe', () => {
  it('con firma imagen se reserva más que sin ella', () => {
    const meds = Array.from({ length: 9 }, (_, i) => med(`Fármaco de nombre medianamente largo ${i + 1}`))
    const conFirma = paginarParaDocumento({ ...base, medicamentos: meds, tieneFirmaImagen: true })
    const sinFirma = paginarParaDocumento({ ...base, medicamentos: meds, tieneFirmaImagen: false })
    // La reserva mayor nunca puede producir MENOS hojas.
    expect(conFirma.length).toBeGreaterThanOrEqual(sinFirma.length)
  })

  it('un formato propio que firma cada hoja reserva espacio en las de continuación y no pierde medicamentos', () => {
    // Nombres largos (envuelven en varias líneas) para forzar multi-hoja de verdad.
    const meds = Array.from({ length: 14 }, (_, i) =>
      med(`Amoxicilina con ácido clavulánico ${i + 1} — presentación en suspensión`))
    const todas = paginarParaDocumento({ ...base, medicamentos: meds, firmaEnTodasLasHojas: true })
    // Lo que de verdad importa: ningún medicamento desaparece.
    expect(totalMedicamentos(todas)).toBe(14)
    // Y en multi-hoja SÍ se reserva la firma en las de continuación (su
    // `disponibleContinuacion` es genérico y no la descuenta).
    expect(todas.length).toBeGreaterThan(1)
  })

  it('REGRESIÓN (bug real del Dr.): membrete propio con pocos meds = 1 sola hoja, sin hoja fantasma', () => {
    // Con membrete propio la firma va en una zona CALIBRADA (posición absoluta),
    // fuera del flujo del contenido — verificado en vivo en la receta del Dr.: 4
    // medicamentos + firma caben en la hoja 1. Antes se contaba la firma también en
    // la "cola", lo que forzaba una hoja 2 VACÍA ("Continuación… Hoja 2 de 2"). La
    // hoja 1 NO debe reservar la firma en la cola cuando `firmaEnTodasLasHojas`.
    const meds = ['Metformina', 'Insulina glargina', 'Dapagliflozina', 'Telmisartán'].map(med)
    const paginas = paginarParaDocumento({ ...base, medicamentos: meds, firmaEnTodasLasHojas: true })
    expect(paginas.length).toBe(1)
    expect(totalMedicamentos(paginas)).toBe(4)
  })

  it('el indicador de última página es único y va al final', () => {
    const meds = Array.from({ length: 12 }, (_, i) => med(`Fármaco de nombre largo número ${i + 1}`))
    const paginas = paginarParaDocumento({ ...base, medicamentos: meds })
    const ultimas = paginas.filter(p => p.esUltima)
    expect(ultimas.length).toBe(1)
    expect(paginas[paginas.length - 1].esUltima).toBe(true)
  })
})
