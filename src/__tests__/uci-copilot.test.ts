/**
 * ICU Copilot (capa de razonamiento). Se prueba lo PURO: el snapshot determinista,
 * el armado de prompts, el parseo tolerante y la fusión dual-model.
 */
import { describe, it, expect } from 'vitest'
import { snapshotUCI, buildCopilotUser, parseSalidaCopilot, fusionarCopilot, COPILOT_SYSTEM, type SalidaCopilot } from '@/lib/uci/copilot'

describe('snapshotUCI — solo salidas de motores (sin recálculo del LLM)', () => {
  it('incluye SOFA, ventilación, POCUS, CKRT y ECMO', () => {
    const s = snapshotUCI({ sexo: 'M', talla: '170', vt: '420', fio2: '60', peep: '10', pplat: '26', pao2: '78', muestra: 'arterial', ckrtMod: 'CVVHDF', ckrtPeso: '70', ckrtDial: '1000', ckrtUf: '150', ecmoConf: 'VA', ecmoSpD: '84', ecmoSpI: '99' })
    expect(s.sofa).toBeDefined()
    expect(s.ventilacion.indiceKirby.valor).toBe(130) // 78/0.6, ya calculado por el motor
    expect(s.ckrt.efluenteMlH).toBe(1150)
    expect(s.ecmo.config).toBe('VA')
  })
})

describe('buildCopilotUser', () => {
  it('mete el snapshot y las preferencias aprendidas', () => {
    const u = buildCopilotUser({ a: 1 }, { discusion: 'Adscrito: bajar volumen', preferencias: ['Prefiere planes concisos'] })
    expect(u).toMatch(/SNAPSHOT DETERMINISTA/)
    expect(u).toMatch(/Adscrito: bajar volumen/)
    expect(u).toMatch(/Prefiere planes concisos/)
  })
  it('el system prohíbe recalcular y dar órdenes', () => {
    expect(COPILOT_SYSTEM).toMatch(/NO calculas/i)
    expect(COPILOT_SYSTEM).toMatch(/NO das órdenes/i)
  })
})

describe('parseSalidaCopilot', () => {
  it('extrae JSON aunque venga con texto alrededor', () => {
    const r = parseSalidaCopilot('Aquí tienes: {"resumen":"x","problemas":[{"sistema":"renal_metabolico","titulo":"AKI","cambio":"Cr 1.6","porque":"congestión","soporte":"CKRT","faltante":"diuresis","prioridad":"alta"}],"faltantesClave":["diuresis"],"seguridad":[]} fin')
    expect(r?.problemas[0].sistema).toBe('renal_metabolico')
    expect(r?.faltantesClave).toContain('diuresis')
  })
  it('devuelve null si no hay JSON', () => {
    expect(parseSalidaCopilot('sin json')).toBeNull()
  })
})

describe('fusionarCopilot', () => {
  const mk = (sistemas: string[]): SalidaCopilot => ({ resumen: '', problemas: sistemas.map(s => ({ sistema: s, titulo: s, cambio: '', porque: '', soporte: '', faltante: '', prioridad: 'media' as const })), faltantesClave: [], seguridad: [] })
  it('el primario manda; la 2ª opinión aporta divergencias por sistema no cubierto', () => {
    const f = fusionarCopilot(mk(['respiratorio', 'hemodinamico']), mk(['respiratorio', 'neurologico']), { primario: 'opus', segunda: 'gpt' })
    expect(f.primario?.problemas.length).toBe(2)
    expect(f.divergencias.map(d => d.sistema)).toEqual(['neurologico'])
  })
})
