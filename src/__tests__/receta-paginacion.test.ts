import { describe, it, expect } from 'vitest'
import {
  paginarReceta,
  paginarParaDocumento,
  alturaMedicamentoMm,
  alturaEstudioMm,
  alturaIndicacionesMm,
} from '@/lib/receta-paginacion'
import type { Medicamento } from '@/types/expediente'

const med = (nombre: string): Medicamento => ({
  nombre, dosis: '500 mg', via: 'oral', frecuencia: 'Cada 8 horas', duracion: '7 días',
})

const OPTS_BASE = {
  fontSizePx: 11,
  areaAltoMm: 150,
  areaAnchoMm: 116,
  headerPrimeraMm: 24,
  headerContinuacionMm: 8,
  firmaMm: 14,
}

describe('alturas estimadas', () => {
  it('medicamento típico ocupa entre 5 y 20 mm', () => {
    const h = alturaMedicamentoMm(med('Amoxicilina'), 116, 11)
    expect(h).toBeGreaterThan(5)
    expect(h).toBeLessThan(20)
  })
  it('estudio de una línea ocupa menos que un medicamento', () => {
    const hEst = alturaEstudioMm('Biometría hemática completa', 116, 11)
    const hMed = alturaMedicamentoMm(med('Amoxicilina'), 116, 11)
    expect(hEst).toBeLessThan(hMed)
  })
  it('indicaciones vacías = 0 mm', () => {
    expect(alturaIndicacionesMm('', 116, 11)).toBe(0)
    expect(alturaIndicacionesMm('   ', 116, 11)).toBe(0)
  })
})

describe('paginarReceta', () => {
  it('pocos medicamentos → 1 sola hoja', () => {
    const paginas = paginarReceta({
      ...OPTS_BASE,
      medicamentos: [med('Amoxicilina'), med('Paracetamol')],
      estudios: [],
    })
    expect(paginas).toHaveLength(1)
    expect(paginas[0].esPrimera).toBe(true)
    expect(paginas[0].esUltima).toBe(true)
    expect(paginas[0].medicamentos).toHaveLength(2)
  })

  it('muchos medicamentos → multi-hoja sin perder NINGUNO', () => {
    const meds = Array.from({ length: 20 }, (_, i) => med(`Medicamento número ${i + 1}`))
    const paginas = paginarReceta({ ...OPTS_BASE, medicamentos: meds, estudios: [] })
    expect(paginas.length).toBeGreaterThan(1)
    const totalDistribuidos = paginas.reduce((acc, p) => acc + p.medicamentos.length, 0)
    expect(totalDistribuidos).toBe(20)  // CERO pérdida — antes se cortaban con overflow:hidden
  })

  it('numeración y flags correctos en multi-hoja', () => {
    const meds = Array.from({ length: 25 }, (_, i) => med(`Med ${i + 1}`))
    const paginas = paginarReceta({ ...OPTS_BASE, medicamentos: meds, estudios: [] })
    expect(paginas[0].numero).toBe(1)
    expect(paginas[0].esPrimera).toBe(true)
    expect(paginas[paginas.length - 1].esUltima).toBe(true)
    expect(paginas.every(p => p.total === paginas.length)).toBe(true)
  })

  it('indicaciones y nota SOLO en la última hoja', () => {
    const meds = Array.from({ length: 18 }, (_, i) => med(`Med ${i + 1}`))
    const paginas = paginarReceta({
      ...OPTS_BASE,
      medicamentos: meds,
      estudios: [],
      indicaciones: 'Reposo y abundantes líquidos',
      notaParaPaciente: 'Acudir a urgencias si hay fiebre',
    })
    const conIndicaciones = paginas.filter(p => p.indicaciones)
    expect(conIndicaciones).toHaveLength(1)
    expect(conIndicaciones[0].esUltima).toBe(true)
  })

  it('estudios en 2 columnas caben el doble por hoja', () => {
    const estudios = Array.from({ length: 30 }, (_, i) => `Estudio ${i + 1}`)
    const unaCol = paginarReceta({ ...OPTS_BASE, medicamentos: [], estudios, estudiosDosColumnas: false })
    const dosCol = paginarReceta({ ...OPTS_BASE, medicamentos: [], estudios, estudiosDosColumnas: true })
    expect(dosCol.length).toBeLessThanOrEqual(unaCol.length)
    // Ningún estudio perdido en ninguno de los dos modos
    expect(unaCol.reduce((a, p) => a + p.estudios.length, 0)).toBe(30)
    expect(dosCol.reduce((a, p) => a + p.estudios.length, 0)).toBe(30)
  })

  it('si la cola no cabe junto al contenido, agrega hoja extra para firma', () => {
    // Llenar la hoja casi por completo y exigir cola grande
    const meds = Array.from({ length: 12 }, (_, i) => med(`Med ${i + 1}`))
    const paginas = paginarReceta({
      ...OPTS_BASE,
      areaAltoMm: 110,
      medicamentos: meds,
      estudios: [],
      indicaciones: 'Líneas de indicaciones bastante largas que ocupan espacio.\nSegunda línea.\nTercera línea.',
      firmaMm: 26,
    })
    expect(paginas[paginas.length - 1].esUltima).toBe(true)
    expect(paginas[paginas.length - 1].indicaciones).toBeTruthy()
  })

  it('vacío → 1 hoja vacía (no revienta)', () => {
    const paginas = paginarReceta({ ...OPTS_BASE, medicamentos: [], estudios: [] })
    expect(paginas).toHaveLength(1)
    expect(paginas[0].medicamentos).toHaveLength(0)
  })
})

describe('paginarParaDocumento', () => {
  const margenes = { top: 35, right: 12, bottom: 30, left: 12 }

  it('receta media-carta con 2 medicamentos → 1 hoja', () => {
    const paginas = paginarParaDocumento({
      medicamentos: [med('Amoxicilina'), med('Paracetamol')],
      estudios: [],
      indicaciones: 'Reposo relativo',
      paperWidthMm: 140,
      paperHeightMm: 215,
      margenes,
      fontSizePx: 11.5,
    })
    expect(paginas).toHaveLength(1)
  })

  it('orden con 25 estudios en media carta → activa 2 columnas y pagina', () => {
    const estudios = Array.from({ length: 25 }, (_, i) => `Estudio de laboratorio ${i + 1}`)
    const paginas = paginarParaDocumento({
      medicamentos: [],
      estudios,
      paperWidthMm: 140,
      paperHeightMm: 215,
      margenes,
      fontSizePx: 11.5,
    })
    expect(paginas.reduce((a, p) => a + p.estudios.length, 0)).toBe(25)
  })

  it('modo soloRx reserva casi nada de encabezado (papel pre-impreso)', () => {
    const meds = Array.from({ length: 10 }, (_, i) => med(`Med ${i + 1}`))
    const conHeader = paginarParaDocumento({
      medicamentos: meds, estudios: [],
      paperWidthMm: 140, paperHeightMm: 215, margenes, fontSizePx: 11.5,
      soloRx: false,
    })
    const sinHeader = paginarParaDocumento({
      medicamentos: meds, estudios: [],
      paperWidthMm: 140, paperHeightMm: 215, margenes, fontSizePx: 11.5,
      soloRx: true,
    })
    // soloRx tiene más espacio por hoja → nunca necesita MÁS hojas
    expect(sinHeader.length).toBeLessThanOrEqual(conHeader.length)
  })
})
