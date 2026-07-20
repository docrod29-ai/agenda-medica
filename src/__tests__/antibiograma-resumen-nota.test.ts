import { describe, it, expect } from 'vitest'
import { interpretarAntibiograma } from '@/lib/expediente/antibiograma'
import { resumenParaNota } from '@/lib/expediente/antibiograma/resumen-nota'

/**
 * Lo que este resumen escribe acaba en el expediente firmado. Tiene que llevar el
 * PANEL además de la conclusión: sin él la nota afirma un mecanismo de resistencia
 * sin el dato que lo sustenta, y en seis meses nadie puede reconstruirlo.
 */
const ENTRADA = {
  organismo: 'Klebsiella pneumoniae',
  sitio: 'sangre' as const,
  resultados: [
    { antibiotico: 'Meropenem', interpretacion: 'R' as const },
    { antibiotico: 'Ceftriaxona', interpretacion: 'R' as const },
    { antibiotico: 'Amikacina', interpretacion: 'S' as const },
  ],
}

describe('resumenParaNota', () => {
  const r = interpretarAntibiograma(ENTRADA)
  const texto = resumenParaNota(ENTRADA, r)

  it('encabeza con organismo y sitio', () => {
    expect(texto).toContain('Klebsiella pneumoniae')
    expect(texto).toContain('sangre')
  })

  it('incluye el PANEL, no solo la conclusión', () => {
    expect(texto).toContain('Meropenem R')
    expect(texto).toContain('Amikacina S')
  })

  it('incluye fenotipo y mecanismo cuando el motor los detectó', () => {
    if (r.fenotipos.length) expect(texto).toMatch(/Fenotipo:/)
    if (r.mecanismos.length) expect(texto).toMatch(/Mecanismo:/)
  })

  it('las alertas críticas y el aislamiento van al final, que es lo accionable', () => {
    if (r.alertas.some(a => a.nivel === 'critica')) expect(texto).toMatch(/ALERTAS:/)
    if (r.aislamiento) expect(texto).toMatch(/Aislamiento:/)
  })

  it('conserva la CMI con su símbolo de censura', () => {
    const t = resumenParaNota(
      { organismo: 'Enterococcus faecalis', resultados: [{ antibiotico: 'Gentamicina alto nivel', interpretacion: 'R', cmi: 500, cmiCensurada: '>' }] },
      interpretarAntibiograma({ organismo: 'Enterococcus faecalis', resultados: [{ antibiotico: 'Gentamicina alto nivel', interpretacion: 'R', cmi: 500, cmiCensurada: '>' }] }),
    )
    expect(t).toContain('>500')
  })

  it('no revienta con un panel vacío', () => {
    const vacio = { organismo: 'Escherichia coli', resultados: [] }
    expect(() => resumenParaNota(vacio, interpretarAntibiograma(vacio))).not.toThrow()
  })

  it('no incluye secciones vacías con encabezado suelto', () => {
    const t = resumenParaNota({ organismo: 'Escherichia coli', resultados: [] }, interpretarAntibiograma({ organismo: 'Escherichia coli', resultados: [] }))
    expect(t).not.toMatch(/Terapia:\s*$/)
    expect(t).not.toMatch(/Panel:\s*$/)
  })
})
