import { describe, it, expect } from 'vitest'
import { construirNotaInmuno, estudiosDe } from '@/lib/inmuno/nota'

describe('inmuno — construirNotaInmuno (puente a la nota clínica)', () => {
  it('arma motivo/huésped desde los campos de cabecera', () => {
    const n = construirNotaInmuno({
      hc_motivo: 'aptitud_pretx',
      hc_huesped: 'SOT — Renal',
      hc_is_estado: 'Va a iniciar (pre-protocolo)',
      hc_fechatx: '2026-01-10',
    }, { nowMs: 0 })
    expect(n.secciones.motivoHuesped).toContain('Aptitud pretrasplante')
    expect(n.secciones.motivoHuesped).toContain('SOT — Renal')
    expect(n.secciones.motivoHuesped).toContain('2026-01-10')
  })

  it('SOT en curso → sugiere trimetoprima/sulfametoxazol (PJP) sin dosis', () => {
    const n = construirNotaInmuno({ hc_huesped: 'SOT — Renal', hc_is_estado: 'En curso' }, { nowMs: 0 })
    const tmp = n.medicamentos.find((m) => /trimetoprima/i.test(m.nombre))
    expect(tmp).toBeTruthy()
    expect(tmp!.dosis).toBe('')          // el motor NO inventa dosis
    expect(n.secciones.planProfilaxis).toContain('Pneumocystis')
  })

  it('no duplica un fármaco aunque aparezca en varias recomendaciones', () => {
    const n = construirNotaInmuno({ hc_huesped: 'SOT — Renal', hc_is_estado: 'En curso', hc_res_cmvpcr: 'Positivo' }, { nowMs: 0 })
    const nombres = n.medicamentos.map((m) => m.nombre.toLowerCase())
    expect(new Set(nombres).size).toBe(nombres.length)
  })

  it('estudios seleccionados → etiquetas legibles para la orden', () => {
    const v = { hc_est_bh: '1', hc_est_igra: '1', hc_est_hemo: '' }
    const est = estudiosDe(v)
    expect(est).toContain('Biometría hemática')
    expect(est).toContain('IGRA / PPD')
    expect(est).not.toContain('Hemocultivos')
    const n = construirNotaInmuno(v)
    expect(n.secciones.estudiosSolicitados).toContain('Biometría hemática')
    expect(n.estudios.length).toBe(2)
  })

  it('sin huésped → sin recomendaciones, sin medicamentos', () => {
    const n = construirNotaInmuno({ hc_motivo: 'otro' })
    expect(n.medicamentos).toHaveLength(0)
    expect(n.secciones.planProfilaxis).toBe('')
  })

  it('el plan anexa el "Fundamento (guías)" con las fuentes reales', () => {
    const n = construirNotaInmuno({ hc_huesped: 'SOT — Renal', hc_is_estado: 'En curso', ['hc_cb_inmuno_anticd20']: '1' }, { nowMs: 0 })
    expect(n.secciones.planProfilaxis).toMatch(/Fundamento \(guías\):/)
    expect(n.secciones.planProfilaxis).toMatch(/Morrison CID 2014/)
  })

  it('la redacción por IA se usa como impresión y plan', () => {
    const n = construirNotaInmuno({ hc_huesped: 'SOT — Renal', hc_is_estado: 'En curso' }, { nowMs: 0, iaTexto: 'RESUMEN DEL CASO. Paciente renal...' })
    expect(n.secciones.impresionPlan).toContain('RESUMEN DEL CASO')
  })
})
