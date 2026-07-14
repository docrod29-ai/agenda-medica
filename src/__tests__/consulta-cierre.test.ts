import { describe, it, expect } from 'vitest'
import { resumenFijo, checklistCierre, type EntradaCierre } from '@/lib/mobile/consulta-cierre'

describe('resumenFijo (§4.2 — datos críticos arriba)', () => {
  it('pone alergias, embarazo y TFG baja como críticos, antes de la edad', () => {
    const chips = resumenFijo({ edad: 54, sexo: 'F', alergias: 'Penicilina', embarazo: true, tfg: 25 })
    const claves = chips.map(c => c.clave)
    // los tres críticos van antes que 'edad'
    expect(claves.indexOf('edad')).toBe(claves.length - 1)
    expect(chips.find(c => c.clave === 'alergia')!.tono).toBe('critico')
    expect(chips.find(c => c.clave === 'embarazo')!.tono).toBe('critico')
    expect(chips.find(c => c.clave === 'tfg')!.tono).toBe('critico') // <30
  })

  it('TFG 30–59 es relevante pero no crítico; ≥60 no aparece', () => {
    expect(resumenFijo({ tfg: 45 }).find(c => c.clave === 'tfg')!.tono).toBe('normal')
    expect(resumenFijo({ tfg: 90 }).find(c => c.clave === 'tfg')).toBeUndefined()
  })

  it('sin alergias/embarazo/tfg solo muestra edad', () => {
    const chips = resumenFijo({ edad: 30, sexo: 'M' })
    expect(chips).toHaveLength(1)
    expect(chips[0].clave).toBe('edad')
  })

  it('trunca alergias largas', () => {
    const larga = 'Penicilina, sulfas, AINEs, mariscos, látex, contraste yodado y más'
    expect(resumenFijo({ alergias: larga })[0].label).toMatch(/…$/)
  })
})

describe('checklistCierre (§4.6 + §5.2 — cierre seguro)', () => {
  const base: EntradaCierre = {
    tieneContenidoNota: true, diagnosticos: 1, medicamentos: 2,
    seguimientoProgramado: true, guardado: 'servidor', hayCambiosSinSincronizar: false,
  }

  it('nunca afirma "servidor" si el guardado es local o sincronizando; advierte y NO bloquea', () => {
    for (const g of ['local', 'sincronizando'] as const) {
      const r = checklistCierre({ ...base, guardado: g })
      expect(r.items.find(i => i.clave === 'guardado')!.estado).toBe('advertencia')
      expect(r.advertencias.join(' ')).toMatch(/no está confirmada en el servidor/i)
      expect(r.bloqueaCierre).toBe(false)
    }
  })

  it('error de sincronización BLOQUEA el cierre (riesgo real de pérdida)', () => {
    const r = checklistCierre({ ...base, guardado: 'error' })
    expect(r.bloqueaCierre).toBe(true)
    expect(r.advertencias.join(' ')).toMatch(/podría no estar guardada/i)
  })

  it('guardado en servidor o firmado NO bloquea y marca ok', () => {
    for (const g of ['servidor', 'firmado'] as const) {
      const r = checklistCierre({ ...base, guardado: g })
      expect(r.items.find(i => i.clave === 'guardado')!.estado).toBe('ok')
      expect(r.bloqueaCierre).toBe(false)
    }
  })

  it('datos clínicos incompletos quedan como pendientes pero NO bloquean (§4.6)', () => {
    const r = checklistCierre({ ...base, tieneContenidoNota: false, diagnosticos: 0, medicamentos: 0, seguimientoProgramado: false })
    expect(r.items.filter(i => i.estado === 'pendiente').length).toBeGreaterThanOrEqual(4)
    expect(r.bloqueaCierre).toBe(false)
  })

  it('advierte cambios sin sincronizar', () => {
    const r = checklistCierre({ ...base, hayCambiosSinSincronizar: true })
    expect(r.advertencias.join(' ')).toMatch(/no se sincronizan/i)
  })
})
