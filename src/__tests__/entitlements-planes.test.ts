/**
 * Candado de ENTITLEMENTS por plan (lo que pidió el Dr para lanzar):
 * "que quien contrate solo la Agenda NO tenga acceso al Pro".
 *
 * Estas pruebas ejercen la MISMA lógica que usa la app (modulosDe / rutaPermitida)
 * y fijan, plan por plan, qué se abre y qué se bloquea. Si alguien cambia el
 * mapeo y por accidente abre el expediente/IA al plan Agenda, esto truena.
 */
import { describe, it, expect } from 'vitest'
import { modulosDe, tieneModulo, rutaPermitida } from '@/lib/modulos'

// Rutas "Pro" (IA de consulta) que el plan Agenda NO debe poder abrir.
const RUTAS_PRO = ['/consulta', '/nota/abc/123', '/receta/abc/123', '/orden/abc/123', '/consultor', '/expediente/abc']
// Rutas de agenda que sí debe abrir el plan Agenda.
const RUTAS_AGENDA = ['/citas', '/calendario', '/asistente', '/lista-espera']

describe('Entitlements: el plan Agenda NO abre el Pro', () => {
  const agenda = { plan: 'agenda' as const }

  it('plan Agenda tiene el módulo agenda pero NO expediente', () => {
    expect(tieneModulo(agenda, 'agenda')).toBe(true)
    expect(tieneModulo(agenda, 'expediente')).toBe(false)
    expect(modulosDe(agenda)).toEqual(['agenda'])
  })

  it('plan Agenda puede entrar a las rutas de agenda', () => {
    for (const r of RUTAS_AGENDA) expect(rutaPermitida(agenda, r)).toBe(true)
  })

  it('plan Agenda queda BLOQUEADO de todas las rutas Pro/IA', () => {
    for (const r of RUTAS_PRO) expect(rutaPermitida(agenda, r)).toBe(false)
  })

  it('una clínica con modulos explícitos ["agenda"] se comporta igual', () => {
    const c = { modulos: ['agenda'] }
    expect(rutaPermitida(c, '/nota/x/y')).toBe(false)
    expect(rutaPermitida(c, '/citas')).toBe(true)
  })
})

describe('Entitlements: Clínica y Pro abren el expediente/IA', () => {
  for (const plan of ['clinica', 'premium'] as const) {
    it(`plan ${plan} abre expediente pero NO hospitalización`, () => {
      const c = { plan }
      expect(tieneModulo(c, 'expediente')).toBe(true)
      for (const r of RUTAS_PRO) expect(rutaPermitida(c, r)).toBe(true)
      expect(tieneModulo(c, 'hospitalizacion')).toBe(false)
      expect(rutaPermitida(c, '/hospitalizacion')).toBe(false)
    })
  }
})

describe('Entitlements: Hospital suma hospitalización', () => {
  it('plan hospital abre hospitalización y el consultorio', () => {
    const c = { plan: 'hospital' }
    expect(tieneModulo(c, 'hospitalizacion')).toBe(true)
    expect(rutaPermitida(c, '/hospitalizacion')).toBe(true)
    expect(tieneModulo(c, 'expediente')).toBe(true)
  })
})

describe('Entitlements: rutas core y compat', () => {
  it('las rutas core están SIEMPRE disponibles (aun en Agenda)', () => {
    const agenda = { plan: 'agenda' }
    for (const r of ['/dashboard', '/configuracion', '/pacientes', '/chat']) {
      expect(rutaPermitida(agenda, r)).toBe(true)
    }
  })

  it('clínica legada SIN plan ni modulos no queda encerrada (base de consultorio, sin Hospital)', () => {
    const legacy = {}
    expect(tieneModulo(legacy, 'expediente')).toBe(true)      // no encerrar a nadie previo
    expect(tieneModulo(legacy, 'hospitalizacion')).toBe(false) // pero Hospital es opt-in
  })
})
