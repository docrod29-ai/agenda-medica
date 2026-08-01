import { describe, it, expect } from 'vitest'
import { construirNotaInmuno, estudiosDe, farmacosCandidatos } from '@/lib/inmuno/nota'

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

  /**
   * NINGÚN FÁRMACO ENTRA A LA RECETA SIN UN CLIC.
   *
   * El test anterior afirmaba lo contrario —que un fármaco nombrado en la prosa
   * aparecía solo en `medicamentos`— y por eso el defecto pasaba verde: la
   * suite estaba defendiendo el bug. Nombrar un fármaco no es indicarlo, y de
   * `medicamentos` sale la receta sin pasar por la compuerta de firma.
   */
  it('SOT en curso → NO mete ningún fármaco a la receta por su cuenta', () => {
    const n = construirNotaInmuno({ hc_huesped: 'SOT — Renal', hc_is_estado: 'En curso' }, { nowMs: 0 })
    expect(n.medicamentos).toEqual([])
    expect(n.secciones.planProfilaxis).toContain('Pneumocystis')   // la recomendación SÍ se ve
  })

  it('el fármaco entra sólo si el médico lo marcó, y sin dosis inventada', () => {
    const v = { hc_huesped: 'SOT — Renal', hc_is_estado: 'En curso' }
    const cand = farmacosCandidatos(v, 0)
    const tmp = cand.find((c) => /trimetoprima/i.test(c.nombre))
    expect(tmp).toBeTruthy()
    expect(tmp!.porQue).toContain('Pneumocystis')   // se enseña la frase que lo nombró

    const n = construirNotaInmuno(v, { nowMs: 0, farmacosElegidos: [tmp!.nombre] })
    expect(n.medicamentos).toHaveLength(1)
    expect(n.medicamentos[0].dosis).toBe('')        // el motor NO inventa dosis
  })

  it('un fármaco marcado que ya no es candidato no se cuela', () => {
    const n = construirNotaInmuno({ hc_huesped: 'SOT — Renal', hc_is_estado: 'En curso' },
      { nowMs: 0, farmacosElegidos: ['Rifampicina'] })   // no está en la tabla de candidatos
    expect(n.medicamentos).toEqual([])
  })

  it('no duplica un fármaco aunque aparezca en varias recomendaciones', () => {
    const v = { hc_huesped: 'SOT — Renal', hc_is_estado: 'En curso', hc_res_cmvpcr: 'Positivo' }
    const nombres = farmacosCandidatos(v, 0).map((c) => c.nombre.toLowerCase())
    expect(new Set(nombres).size).toBe(nombres.length)
  })

  /**
   * LOS TRES FALSOS POSITIVOS QUE MOTIVARON EL CAMBIO.
   * Siguen apareciendo como candidatos —la prosa los nombra— pero ya no llegan
   * a la receta solos, que era el daño.
   */
  it('un TAMIZAJE de tuberculosis no prescribe isoniazida', () => {
    const v = { hc_huesped: 'Biológicos / inmunomoduladores', hc_is_estado: 'Va a iniciar (pre-protocolo)' }
    const n = construirNotaInmuno(v, { nowMs: 0 })
    expect(n.medicamentos.some((m) => /isoniazida/i.test(m.nombre))).toBe(false)
    // Y la frase que lo nombraba se le enseña al médico tal cual, para que juzgue.
    const cand = farmacosCandidatos(v, 0).find((c) => /isoniazida/i.test(c.nombre))
    if (cand) expect(cand.porQue).toMatch(/tuberculosis latente/i)
  })

  it('una condición NO cumplida (déficit de G6PD) no prescribe atovacuona', () => {
    const n = construirNotaInmuno({ hc_huesped: 'SOT — Renal', hc_is_estado: 'En curso' }, { nowMs: 0 })
    expect(n.medicamentos.some((m) => /atovacuona/i.test(m.nombre))).toBe(false)
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

  it('la nota NO lleva citas ni referencias (debe parecer nota del médico)', () => {
    const n = construirNotaInmuno({ hc_huesped: 'SOT — Renal', hc_is_estado: 'En curso', ['hc_cb_inmuno_anticd20']: '1' }, { nowMs: 0 })
    expect(n.secciones.planProfilaxis).not.toMatch(/\[.*\]/)          // sin [Fuente]
    expect(n.secciones.planProfilaxis).not.toMatch(/Fundamento|KDIGO|Morrison|ASH 2020/)
    expect(n.secciones.planProfilaxis).toContain('Pneumocystis')       // pero sí el contenido clínico
  })

  it('la redacción por IA se usa como impresión y plan', () => {
    const n = construirNotaInmuno({ hc_huesped: 'SOT — Renal', hc_is_estado: 'En curso' }, { nowMs: 0, iaTexto: 'RESUMEN DEL CASO. Paciente renal...' })
    expect(n.secciones.impresionPlan).toContain('RESUMEN DEL CASO')
  })
})
