import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fusionarDiagnosticos } from '@/lib/expediente/fusionar-diagnosticos'
import { fusionarMedicamentos, loQueSeReceta } from '@/lib/expediente/que-va-en-la-receta'

describe('GP6: re-proyección y recuperación cruzan las fronteras clínicas', () => {
  it('IA definitiva/CIE entra no confirmada y sin CIE', () => {
    const [d] = fusionarDiagnosticos({ previos: [], deLaIaAnterior: [], nuevos: [
      { descripcion: 'Neumonía adquirida en comunidad', tipo: 'definitivo', estado: 'activo', codigoCIE10: 'J18.9' },
    ] })
    expect(d.tipo).toBe('presuntivo')
    expect(d.codigoCIE10).toBeUndefined()
  })
  it('medicamento IA sin intención explícita no cruza a receta', () => {
    const meds = fusionarMedicamentos({ previos: [], deLaIaAnterior: [], nuevos: [
      { nombre: 'Amoxicilina', dosis: '500 mg', via: 'oral', frecuencia: 'cada 8 horas', duracion: '7 días' },
    ] })
    expect(meds[0].estado).toBe('borrador')
    expect(loQueSeReceta(meds)).toHaveLength(0)
  })
  it('no quedan setters directos en los caminos tipoOverride', () => {
    const src=readFileSync(resolve(process.cwd(),'src/app/(dashboard)/consulta/[patientId]/page.tsx'),'utf8')
    expect(src).not.toContain('setDiagnosticos(nuevosDx)\n        dxDeLaIaRef.current = nuevosDx')
    expect(src).not.toContain('setMedicamentos(nuevosMed); medDeLaIaRef.current = nuevosMed')
    expect((src.match(/fusionarDiagnosticos\(\{ previos: \[\], nuevos: nuevosDx/g) ?? []).length).toBeGreaterThanOrEqual(2)
    expect((src.match(/fusionarMedicamentos\(\{ previos: \[\], nuevos: nuevosMed/g) ?? []).length).toBeGreaterThanOrEqual(2)
  })
})
