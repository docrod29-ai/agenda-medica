/**
 * GOLDEN — «Bajo stock: 0» con el anaquel vacío, y lotes caducados un día antes.
 *
 * Dos contadores que mentían en direcciones opuestas:
 *
 *  · `bajoMinimo` exigía un mínimo CAPTURADO, y el formulario lo deja vacío por
 *    omisión: un consultorio que nunca los captura veía siempre «Bajo stock: 0»
 *    con cero cajas en el anaquel. Un contador en cero se lee como «no falta
 *    nada».
 *  · `caducaEnDias` comparaba contra medianoche UTC: en México un lote que vence
 *    el 2 de agosto salía CADUCADO desde las 18:00 del 1, y dispensarlo pedía
 *    confirmación de riesgo cuando todavía le quedaba el día entero.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { bajoMinimo, estaCaducado, caducaEnDias } from '@/lib/farmacia'
import type { FarmaciaItem } from '@/lib/farmacia'

const item = (o: Partial<FarmaciaItem>): FarmaciaItem => ({
  nombre: 'Ítem de prueba', categoria: 'medicamento', cantidad: 0, unidad: 'pieza',
  activo: true, createdAt: '', updatedAt: '', ...o,
} as FarmaciaItem)

afterEach(() => { vi.useRealTimers() })

describe('bajoMinimo', () => {
  it('sin existencias está bajo mínimo AUNQUE nadie haya capturado el mínimo', () => {
    expect(bajoMinimo(item({ cantidad: 0 }))).toBe(true)
  })

  it('con existencias y sin mínimo declarado, no alarma', () => {
    // Sin mínimo el piso es cero: ni se inventa un umbral ni se calla el vacío.
    expect(bajoMinimo(item({ cantidad: 12 }))).toBe(false)
  })

  it('con mínimo declarado manda el del médico', () => {
    expect(bajoMinimo(item({ cantidad: 5, cantidadMinima: 10 }))).toBe(true)
    expect(bajoMinimo(item({ cantidad: 10, cantidadMinima: 10 }))).toBe(true)
    expect(bajoMinimo(item({ cantidad: 11, cantidadMinima: 10 }))).toBe(false)
  })
})

describe('caducaEnDias', () => {
  it('un lote vence al FINAL de su día, no la tarde anterior', () => {
    // 1 de agosto, 18:00 hora de México (= 2 de agosto 00:00 UTC).
    vi.setSystemTime(new Date('2026-08-02T00:00:00.000Z'))
    expect(estaCaducado(item({ caducidad: '2026-08-02' }))).toBe(false)
    expect(caducaEnDias(item({ caducidad: '2026-08-02' }))).toBeGreaterThanOrEqual(0)
  })

  it('pasado su día, sí está caducado', () => {
    vi.setSystemTime(new Date('2026-08-03T15:00:00.000Z'))
    expect(estaCaducado(item({ caducidad: '2026-08-02' }))).toBe(true)
  })

  it('sin fecha de caducidad no se afirma nada', () => {
    expect(caducaEnDias(item({}))).toBeNull()
    expect(estaCaducado(item({}))).toBe(false)
  })
})
