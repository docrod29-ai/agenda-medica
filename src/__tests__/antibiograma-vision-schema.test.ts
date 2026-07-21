import { describe, it, expect } from 'vitest'
import { PerfilExtraido } from '@/lib/expediente/antibiograma/vision'

/**
 * Regresión del bug "La lectura no cumplió del todo el formato esperado": el schema
 * estricto tumbaba TODA la lectura por una sola variante (minúsculas, 'Sensible',
 * 'Kirby-Bauer', cmi:0). Ahora normaliza sin cambiar el S/I/R real y una fila mala
 * no bota el resto.
 */
describe('PerfilExtraido — schema tolerante de visión', () => {
  it('normaliza interpretaciones en minúscula / palabra completa', () => {
    const r = PerfilExtraido.safeParse({
      organismo: 'E. coli',
      resultados: [
        { antibiotico: 'Meropenem', interpretacion: 's' },
        { antibiotico: 'Ampicilina', interpretacion: 'Resistente' },
        { antibiotico: 'Gentamicina', interpretacion: 'intermedio' },
        { antibiotico: 'Cefepime', interpretacion: 'Sensible' },
      ],
    })
    expect(r.success).toBe(true)
    const map = Object.fromEntries(r.data!.resultados.map(c => [c.antibiotico, c.interpretacion]))
    expect(map).toEqual({ Meropenem: 'S', Ampicilina: 'R', Gentamicina: 'I', Cefepime: 'S' })
  })

  it('método "Kirby-Bauer" no rompe: se mapea a disco', () => {
    const r = PerfilExtraido.safeParse({ organismo: 'x', metodo: 'Kirby-Bauer', resultados: [] })
    expect(r.success).toBe(true)
    expect(r.data!.metodo).toBe('disco')
  })

  it('cmi:0 (no positivo) ya no invalida la lectura', () => {
    const r = PerfilExtraido.safeParse({
      organismo: 'x',
      resultados: [{ antibiotico: 'Vancomicina', interpretacion: 'S', cmi: 0 }],
    })
    expect(r.success).toBe(true)
    expect(r.data!.resultados[0].cmi).toBeNull()
  })

  it('una fila ilegible NO tumba las demás', () => {
    const r = PerfilExtraido.safeParse({
      organismo: 'x',
      resultados: [
        { antibiotico: 'Meropenem', interpretacion: 'S' },
        { interpretacion: 'R' },              // sin nombre → se descarta, no rompe
        { antibiotico: 'Amikacina', interpretacion: 'S' },
      ],
    })
    expect(r.success).toBe(true)
    expect(r.data!.resultados.map(c => c.antibiotico)).toEqual(['Meropenem', 'Amikacina'])
  })

  it('organismo ausente no dispara el warning de schema', () => {
    const r = PerfilExtraido.safeParse({ resultados: [{ antibiotico: 'Ceftriaxona', interpretacion: 'S' }] })
    expect(r.success).toBe(true)
    expect(r.data!.organismo).toBe('')
  })

  it('lectura realista "sucia" pasa completa (sin _schemaWarning)', () => {
    const r = PerfilExtraido.safeParse({
      organismo: 'Staphylococcus aureus',
      muestra: 'hueso',
      metodo: 'Vitek 2',
      resultados: [
        { antibiotico: 'Oxacilina', interpretacion: 'r', cmi_texto: '>4' },
        { antibiotico: 'Clindamicina', interpretacion: 'S', conf: 'MEDIA' },
      ],
      pruebasReportadas: [{ nombre: 'Cefoxitina screen', resultado: 'positivo' }],
      observaciones: 'CTMBS',
    })
    expect(r.success).toBe(true)
    expect(r.data!.metodo).toBe('automatizado')
    expect(r.data!.resultados[0].interpretacion).toBe('R')
  })
})
