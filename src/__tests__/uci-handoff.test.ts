import { describe, it, expect } from 'vitest'
import {
  construirHandoff,
  marcarRevisado,
  listoParaEntregar,
  loQueFaltaDelMedico,
  MOTIVO_PROBLEMAS_VACIOS,
  MOTIVO_CONTINGENCIAS_VACIAS,
  type EntradaHandoff,
} from '@/lib/uci/handoff'

/**
 * Charter §36 — ICU Handoff.
 *
 * La regla que estos casos protegen por encima de todas:
 *   «**Siempre revisado por médico.**»
 *
 * El handoff es el documento que se lee cuando el que conoce al paciente YA SE
 * FUE. Un error que pase el cambio de turno se propaga a un equipo que no tiene
 * con quién contrastarlo.
 *
 * Datos 100 % sintéticos.
 */

const T = '2026-07-30T07:00:00Z'

const entrada = (extra: Partial<EntradaHandoff> = {}): EntradaHandoff => ({
  pacienteId: 'p-ficticio',
  generadoEn: T,
  cama: 'UCI-04',
  diaUci: 4,
  diaVm: 3,
  soportes: ['vm_invasiva', 'vasopresor'],
  cambios: ['Norepinefrina 0.18 → 0.06 µg/kg/min'],
  pendientes: ['Dispositivos: Reevaluar necesidad del CVC — pendiente.'],
  dispositivos: ['CVC yugular derecho', 'Sonda vesical'],
  ...extra,
})

describe('§36 · «siempre revisado por médico» ← está en el TIPO', () => {
  it('el handoff NACE en borrador', () => {
    expect(construirHandoff(entrada()).estado).toBe('BORRADOR')
  })

  it('NO hay forma de construirlo ya revisado', () => {
    // Aunque se intente colar el estado por la entrada.
    const h = construirHandoff({ ...entrada(), ...({ estado: 'REVISADO' } as object) })
    expect(h.estado).toBe('BORRADOR')
    expect(h.revisadoPor).toBeUndefined()
  })

  it('no se puede entregar el turno sin revisión', () => {
    const r = listoParaEntregar(construirHandoff(entrada()))
    expect(r.listo).toBe(false)
    expect(r.motivo).toMatch(/no ha sido revisado/)
  })

  it('marcado por un médico, ya se puede entregar', () => {
    const h = marcarRevisado(construirHandoff(entrada()), 'Dr. Ficticio', T)
    expect(h.estado).toBe('REVISADO')
    expect(h.revisadoPor).toBe('Dr. Ficticio')
    expect(listoParaEntregar(h).listo).toBe(true)
  })

  it('la revisión EXIGE un médico identificado', () => {
    expect(() => marcarRevisado(construirHandoff(entrada()), '   ', T))
      .toThrowError(/médico identificado/)
  })

  it('revisar NO muta el borrador original', () => {
    // La revisión es un hecho aparte, con su autor; el borrador queda como estaba.
    const b = construirHandoff(entrada())
    marcarRevisado(b, 'Dr. Ficticio', T)
    expect(b.estado).toBe('BORRADOR')
  })

  it('que falten secciones NO impide entregar; que nadie lo lea, SÍ', () => {
    // Un paciente puede legítimamente no tener dispositivos.
    const vacio = construirHandoff({ pacienteId: 'p', generadoEn: T })
    expect(listoParaEntregar(vacio).listo).toBe(false)
    expect(listoParaEntregar(marcarRevisado(vacio, 'Dr. X', T)).listo).toBe(true)
  })
})

// ═══════════════════════════════════════════════════════════════════════
describe('§36 · lo que el sistema NO redacta', () => {
  const h = construirHandoff(entrada())

  it('problemas activos va VACÍO y declarado', () => {
    // Es una síntesis clínica, no un volcado de diagnósticos.
    expect(h.problemasActivos).toEqual([])
    expect(h.ausentes.find(a => a.seccion === 'problemas activos')?.motivo)
      .toBe(MOTIVO_PROBLEMAS_VACIOS)
  })

  it('contingencias va VACÍO y declarado', () => {
    // «Si la MAP baja de X, hacer Y» es un plan terapéutico.
    expect(h.contingencias).toEqual([])
    expect(h.ausentes.find(a => a.seccion === 'contingencias')?.motivo)
      .toBe(MOTIVO_CONTINGENCIAS_VACIAS)
  })

  it('los motivos dicen que el sistema NO las propone', () => {
    expect(MOTIVO_PROBLEMAS_VACIOS).toMatch(/no la propone/)
    expect(MOTIVO_CONTINGENCIAS_VACIAS).toMatch(/indicación de tratamiento/)
  })

  it('si el médico SÍ las escribió, se respetan tal cual', () => {
    const conPlan = construirHandoff(entrada({
      problemasActivos: ['Choque séptico de foco abdominal'],
      contingencias: ['Si MAP < 65 pese a NE 0.3, avisar al intensivista de guardia'],
    }))
    expect(conPlan.problemasActivos).toHaveLength(1)
    expect(conPlan.ausentes.some(a => a.seccion === 'contingencias')).toBe(false)
  })

  it('`loQueFaltaDelMedico` es la lista de lo que él tiene que escribir', () => {
    expect(loQueFaltaDelMedico(h).sort()).toEqual(['contingencias', 'problemas activos'])
    const completo = construirHandoff(entrada({ problemasActivos: ['x'], contingencias: ['y'] }))
    expect(loQueFaltaDelMedico(completo)).toEqual([])
  })
})

// ═══════════════════════════════════════════════════════════════════════
describe('§36 · un hueco NUNCA se calla', () => {
  it('cada sección vacía se declara con su motivo', () => {
    // En un handoff, un hueco silencioso se lee como «no hay nada», y en
    // contingencias eso es peligroso.
    const h = construirHandoff({ pacienteId: 'p', generadoEn: T })
    const secciones = h.ausentes.map(a => a.seccion).sort()
    expect(secciones).toContain('soportes')
    expect(secciones).toContain('cambios')
    expect(secciones).toContain('pendientes')
    expect(secciones).toContain('dispositivos')
    expect(secciones).toContain('cama')
    expect(h.ausentes.every(a => a.motivo.trim() !== '')).toBe(true)
  })

  it('distingue «no se documentó» de «no lo propone el sistema»', () => {
    const h = construirHandoff({ pacienteId: 'p', generadoEn: T })
    expect(h.ausentes.find(a => a.seccion === 'dispositivos')?.motivo)
      .toMatch(/No hay dispositivos invasivos registrados/)
    expect(h.ausentes.find(a => a.seccion === 'contingencias')?.motivo)
      .toMatch(/redacta el médico/)
  })

  it('ventilado sin día de VM: se avisa', () => {
    const h = construirHandoff(entrada({ diaVm: null }))
    expect(h.ausentes.find(a => a.seccion === 'día de ventilación')?.motivo)
      .toMatch(/ventilación invasiva pero no consta/)
  })

  it('NO ventilado y sin día de VM: no se avisa de algo que no aplica', () => {
    const h = construirHandoff(entrada({ soportes: ['vasopresor'], diaVm: null }))
    expect(h.ausentes.some(a => a.seccion === 'día de ventilación')).toBe(false)
  })

  it('un handoff COMPLETO no tiene ausencias salvo las del médico', () => {
    const h = construirHandoff(entrada({ problemasActivos: ['x'], contingencias: ['y'] }))
    expect(h.ausentes).toEqual([])
  })
})

// ═══════════════════════════════════════════════════════════════════════
describe('§36 · compone lo que ya existe, sin re-redactarlo', () => {
  const h = construirHandoff(entrada())

  it('los cambios vienen ya redactados por el Morning Brief', () => {
    expect(h.cambios[0]).toBe('Norepinefrina 0.18 → 0.06 µg/kg/min')
  })

  it('los pendientes vienen ya redactados por las metas diarias', () => {
    expect(h.pendientes[0]).toMatch(/Reevaluar necesidad del CVC/)
  })

  it('los soportes vienen de la estancia UCI', () => {
    expect(h.soportes).toEqual(['vm_invasiva', 'vasopresor'])
  })

  it('la identificación no inventa nada ausente', () => {
    const h2 = construirHandoff({ pacienteId: 'p', generadoEn: T })
    expect(h2.cama).toBeNull()
    expect(h2.diaUci).toBeNull()
  })

  it('fecha inválida LANZA', () => {
    expect(() => construirHandoff({ pacienteId: 'p', generadoEn: 'ayer' }))
      .toThrowError(/fecha inválida/)
  })

  it('no muta los arreglos que recibe', () => {
    const soportes = ['vm_invasiva'] as const
    const h3 = construirHandoff(entrada({ soportes }))
    h3.soportes.push('ecmo')
    expect(soportes).toHaveLength(1)
  })
})

/**
 * GOLDEN — «No hay dispositivos invasivos registrados» en un paciente con
 * catéter central y ventilador.
 *
 * La tarjeta de entrega de turno imprimía esa frase SIEMPRE, para todo paciente,
 * porque `pendientes` y `dispositivos` no tienen quién los alimente: no existe
 * ninguna función que los produzca. En una entrega, esa frase se lee como una
 * afirmación clínica de quien entrega — y no comprobó nada.
 */
describe('secciones que el sistema no alimenta', () => {
  const base = { pacienteId: 'p1', generadoEn: '2026-08-02T07:00:00.000Z' }

  it('sin declarar, una sección vacía AFIRMA que no hay', () => {
    const h = construirHandoff(base)
    const d = h.ausentes.find(a => a.seccion === 'dispositivos')!
    expect(d.motivo).toMatch(/No hay dispositivos invasivos registrados/)
  })

  it('declarada SIN FUENTE, dice que el sistema no lo sabe', () => {
    const h = construirHandoff(base, ['dispositivos', 'pendientes'])
    const d = h.ausentes.find(a => a.seccion === 'dispositivos')!
    expect(d.motivo).toMatch(/NO significa que no haya/)
    const p = h.ausentes.find(a => a.seccion === 'pendientes')!
    expect(p.motivo).toMatch(/NO significa que no haya/)
  })

  it('lo que SÍ tiene fuente conserva su afirmación', () => {
    // `soportes` sí se alimenta desde la estancia: si está vacío, está vacío.
    const h = construirHandoff(base, ['dispositivos'])
    const s = h.ausentes.find(a => a.seccion === 'soportes')!
    expect(s.motivo).toMatch(/No hay soportes activos registrados/)
  })

  it('una sección CON datos no aparece como ausente aunque se declare sin fuente', () => {
    const h = construirHandoff({ ...base, dispositivos: ['Catéter venoso central subclavio'] }, ['dispositivos'])
    expect(h.ausentes.find(a => a.seccion === 'dispositivos')).toBeUndefined()
  })
})
